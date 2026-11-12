import Cocoa
import WebKit

/// The web view plus everything the page needs from the OS.
///
/// The page is served from `plainpad://app/` by a custom scheme handler rather than from `file://`, which gives it a
/// real origin so localStorage and IndexedDB persist the session like they do in a browser. The page detects the app
/// through `window.webkit.messageHandlers.plainpad` (see src/js/11-native-shell.js) and sends:
///   { type: "ready" }                                     the page has booted and `window.__ppNative` exists
///   { type: "openPanel" }                                 show NSOpenPanel
///   { type: "save", filename, path, data (base64) }       write the file; reply { status, path, filename }
///   { type: "title", name, path, dirty }                  the active tab changed; shown in the window title bar
///   { type: "watch", files: [{ path, mtime }] }           the files the tabs came from, with the modification time the
///                                                         page last saw (null: unknown, take the file's current one)
/// The app calls back into the page through `window.__ppNative.run(name)`, `.open(items)`, `.changed(items)` and
/// `.flush()`. open and changed items carry { token, name, path, mtime }; a changed item for a file that is gone is
/// { path, deleted: true }. Modification times are milliseconds since 1970, and save replies carry the new one too.
final class WebShell: NSObject, WKScriptMessageHandlerWithReply, WKURLSchemeHandler, WKNavigationDelegate, WKUIDelegate {
    static let scheme = "plainpad"
    static let origin = "plainpad://app/"
    private let debug = ProcessInfo.processInfo.environment["PLAINPAD_DEBUG"] != nil
    private func log(_ items: Any...) { if debug { NSLog("%@", items.map { "\($0)" }.joined(separator: " ")) } }

    private(set) var webView: WKWebView!
    private let webRoot: URL
    private var ready = false
    private var pendingOpen: [URL] = []
    private var servedFiles: [String: URL] = [:]
    private var stoppedTasks = Set<ObjectIdentifier>()
    private var lastDirectory: URL?
    /// path → modification time the page knows about (-1: the file was missing). Checked every two seconds and whenever
    /// the app becomes active; a difference is reported to the page once.
    private var watched: [String: Double] = [:]
    private var watchTimer: Timer?

    override init() {
        webRoot = Bundle.main.resourceURL!.appendingPathComponent("web", isDirectory: true)
        super.init()
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default()
        config.setURLSchemeHandler(self, forURLScheme: Self.scheme)
        config.userContentController.addScriptMessageHandler(self, contentWorld: .page, name: "plainpad")
        webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.allowsMagnification = false
        webView.setValue(false, forKey: "drawsBackground")
        if #available(macOS 13.3, *) { webView.isInspectable = true }
        NotificationCenter.default.addObserver(forName: NSApplication.didBecomeActiveNotification, object: nil, queue: .main) { [weak self] _ in
            self?.checkFiles()
        }
        watchTimer = Timer.scheduledTimer(withTimeInterval: 2, repeats: true) { [weak self] _ in self?.checkFiles() }
    }

    func load() {
        webView.load(URLRequest(url: URL(string: Self.origin + "index.html")!))
    }

    // MARK: calls into the page

    func run(_ name: String) {
        guard ready else { return }
        webView.evaluateJavaScript("window.__ppNative.run(\(jsString(name)))") { _, _ in }
    }

    /// Opens files in the page. Each file is registered under a one-time token that the page fetches from
    /// `plainpad://app/__file/<token>`, so the bytes stream from disk instead of being serialised into a string.
    func open(_ urls: [URL]) {
        guard !urls.isEmpty else { return }
        guard ready else { pendingOpen += urls; return }
        var items: [[String: Any]] = []
        for url in urls {
            let token = UUID().uuidString
            servedFiles[token] = url
            let mtime = Self.modificationTime(url.path) ?? -1
            watched[url.path] = mtime
            items.append(["token": token, "name": url.lastPathComponent, "path": url.path, "mtime": mtime])
        }
        lastDirectory = urls.last?.deletingLastPathComponent()
        let json = String(data: try! JSONSerialization.data(withJSONObject: items), encoding: .utf8)!
        webView.evaluateJavaScript("window.__ppNative.open(\(json))") { _, _ in }
    }

    /// Lets the page write its session to storage, then calls `done` (after two seconds at the latest).
    func flush(_ done: @escaping () -> Void) {
        guard ready else { done(); return }
        var called = false
        let finish = { if !called { called = true; done() } }
        webView.callAsyncJavaScript("return await window.__ppNative.flush()", arguments: [:], in: nil, in: .page) { _ in finish() }
        DispatchQueue.main.asyncAfter(deadline: .now() + 2) { finish() }
    }

    // MARK: messages from the page

    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage,
                               replyHandler: @escaping (Any?, String?) -> Void) {
        guard let body = message.body as? [String: Any], let type = body["type"] as? String else {
            replyHandler(nil, "unknown message"); return
        }
        log("message", type, (body["path"] as? String) ?? "", (body["filename"] as? String) ?? "")
        switch type {
        case "ready":
            ready = true
            replyHandler(nil, nil)
            let urls = pendingOpen; pendingOpen = []
            open(urls)
        case "openPanel":
            replyHandler(nil, nil)
            showOpenPanel()
        case "title":
            replyHandler(nil, nil)
            if let window = webView.window {
                window.title = (body["name"] as? String) ?? "Plainpad"
                window.representedURL = (body["path"] as? String).flatMap { $0.isEmpty ? nil : URL(fileURLWithPath: $0) }
                window.isDocumentEdited = (body["dirty"] as? Bool) ?? false
            }
        case "save":
            save(body, replyHandler)
        case "watch":
            replyHandler(nil, nil)
            var next: [String: Double] = [:]
            for file in (body["files"] as? [[String: Any]]) ?? [] {
                guard let path = file["path"] as? String, !path.isEmpty else { continue }
                next[path] = (file["mtime"] as? Double) ?? watched[path] ?? Self.modificationTime(path) ?? -1
            }
            watched = next
            checkFiles()
        default:
            replyHandler(nil, "unknown message \(type)")
        }
    }

    private func showOpenPanel() {
        let panel = NSOpenPanel()
        panel.allowsMultipleSelection = true
        panel.canChooseDirectories = false
        panel.directoryURL = lastDirectory
        panel.beginSheetModal(for: webView.window!) { response in
            if response == .OK { self.open(panel.urls) }
        }
    }

    private func save(_ body: [String: Any], _ reply: @escaping (Any?, String?) -> Void) {
        guard let filename = body["filename"] as? String, let base64 = body["data"] as? String,
              let data = Data(base64Encoded: base64) else { reply(nil, "bad save message"); return }
        let known = (body["path"] as? String).flatMap { $0.isEmpty ? nil : URL(fileURLWithPath: $0) }
        // A tab that came from disk saves straight back to its file; anything else asks where to put it.
        if let url = known, FileManager.default.fileExists(atPath: url.deletingLastPathComponent().path) {
            do { try write(data, to: url); log("wrote", url.path); reply(saved(url), nil); return } catch { log("write failed", error); /* fall through to the panel */ }
        }
        let panel = NSSavePanel()
        panel.nameFieldStringValue = filename
        panel.canCreateDirectories = true
        panel.isExtensionHidden = false
        panel.directoryURL = known?.deletingLastPathComponent() ?? lastDirectory
        panel.beginSheetModal(for: webView.window!) { response in
            guard response == .OK, let url = panel.url else { reply(["status": "declined"], nil); return }
            do { try self.write(data, to: url); reply(self.saved(url), nil) }
            catch { reply(nil, error.localizedDescription) }
        }
    }

    private func write(_ data: Data, to url: URL) throws {
        try data.write(to: url, options: .atomic)
        lastDirectory = url.deletingLastPathComponent()
        watched[url.path] = Self.modificationTime(url.path) ?? -1   // our own write is not an outside change
    }

    private func saved(_ url: URL) -> [String: Any] {
        ["status": "saved", "path": url.path, "filename": url.lastPathComponent, "mtime": watched[url.path] ?? -1]
    }

    // MARK: files changed outside Plainpad

    static func modificationTime(_ path: String) -> Double? {
        guard let date = (try? FileManager.default.attributesOfItem(atPath: path))?[.modificationDate] as? Date else { return nil }
        return (date.timeIntervalSince1970 * 1000).rounded()
    }

    private func checkFiles() {
        guard ready, !watched.isEmpty else { return }
        var changes: [[String: Any]] = []
        for (path, known) in watched {
            let now = Self.modificationTime(path) ?? -1
            if now == known { continue }
            watched[path] = now
            if now < 0 {
                changes.append(["path": path, "deleted": true])
            } else {
                let token = UUID().uuidString
                servedFiles[token] = URL(fileURLWithPath: path)
                changes.append(["path": path, "token": token, "name": (path as NSString).lastPathComponent, "mtime": now])
            }
        }
        guard !changes.isEmpty, let json = try? JSONSerialization.data(withJSONObject: changes),
              let text = String(data: json, encoding: .utf8) else { return }
        log("changed on disk:", changes.map { $0["path"] as? String ?? "" }.joined(separator: ", "))
        webView.evaluateJavaScript("window.__ppNative.changed(\(text))") { _, _ in }
    }

    // MARK: plainpad:// scheme

    func webView(_ webView: WKWebView, start task: WKURLSchemeTask) {
        log("request", task.request.url?.absoluteString ?? "?")
        guard let url = task.request.url, url.host == "app" else { fail(task, 404); return }
        var path = url.path
        if path.isEmpty || path == "/" { path = "/index.html" }
        if path.hasPrefix("/__file/") {
            let token = String(path.dropFirst("/__file/".count)).removingPercentEncoding ?? ""
            guard let file = servedFiles.removeValue(forKey: token) else { fail(task, 404); return }
            stream(file, to: task)
            return
        }
        let file = webRoot.appendingPathComponent(String(path.dropFirst())).standardizedFileURL
        guard file.path.hasPrefix(webRoot.path), let data = try? Data(contentsOf: file) else { fail(task, 404); return }
        task.didReceive(response(url, status: 200, mime: mimeType(file), length: data.count))
        task.didReceive(data)
        task.didFinish()
    }

    func webView(_ webView: WKWebView, stop task: WKURLSchemeTask) {
        stoppedTasks.insert(ObjectIdentifier(task))
    }

    private func stream(_ file: URL, to task: WKURLSchemeTask) {
        let id = ObjectIdentifier(task)
        guard let handle = try? FileHandle(forReadingFrom: file),
              let size = (try? file.resourceValues(forKeys: [.fileSizeKey]))?.fileSize else { fail(task, 404); return }
        task.didReceive(response(task.request.url!, status: 200, mime: "application/octet-stream", length: size))
        DispatchQueue.global(qos: .userInitiated).async {
            defer { try? handle.close() }
            while true {
                let chunk = handle.readData(ofLength: 4 << 20)
                let stopped = DispatchQueue.main.sync { self.stoppedTasks.contains(id) }
                if stopped { DispatchQueue.main.async { self.stoppedTasks.remove(id) }; return }
                if chunk.isEmpty { DispatchQueue.main.async { task.didFinish() }; return }
                DispatchQueue.main.async { task.didReceive(chunk) }
            }
        }
    }

    private func response(_ url: URL, status: Int, mime: String, length: Int) -> HTTPURLResponse {
        HTTPURLResponse(url: url, statusCode: status, httpVersion: "HTTP/1.1",
                        headerFields: ["Content-Type": mime, "Content-Length": String(length), "Cache-Control": "no-cache"])!
    }

    private func fail(_ task: WKURLSchemeTask, _ status: Int) {
        task.didReceive(response(task.request.url!, status: status, mime: "text/plain", length: 0))
        task.didFinish()
    }

    private func mimeType(_ file: URL) -> String {
        switch file.pathExtension.lowercased() {
        case "html": return "text/html; charset=utf-8"
        case "js", "mjs": return "text/javascript; charset=utf-8"
        case "css": return "text/css; charset=utf-8"
        case "json": return "application/json"
        case "svg": return "image/svg+xml"
        case "png": return "image/png"
        case "woff2": return "font/woff2"
        default: return "application/octet-stream"
        }
    }

    // MARK: navigation

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) { log("navigation failed:", error) }
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) { log("provisional navigation failed:", error) }
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) { log("loaded", webView.url?.absoluteString ?? "?") }
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) { log("web content process terminated"); webView.reload() }

    // Links in the help and in Markdown previews open in the default browser; the window only ever shows the page.
    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        if let url = action.request.url, url.scheme != Self.scheme, url.scheme != "about", url.scheme != "blob", url.scheme != "data" {
            NSWorkspace.shared.open(url)
            decisionHandler(.cancel)
            return
        }
        decisionHandler(.allow)
    }

    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = action.request.url { NSWorkspace.shared.open(url) }
        return nil
    }

    // <input type="file"> in the page (the folder picker for 在檔案中尋找 uses this).
    func webView(_ webView: WKWebView, runOpenPanelWith parameters: WKOpenPanelParameters, initiatedByFrame frame: WKFrameInfo,
                 completionHandler: @escaping ([URL]?) -> Void) {
        let panel = NSOpenPanel()
        panel.allowsMultipleSelection = parameters.allowsMultipleSelection
        panel.canChooseDirectories = parameters.allowsDirectories
        panel.canChooseFiles = !parameters.allowsDirectories
        panel.directoryURL = lastDirectory
        panel.beginSheetModal(for: webView.window!) { response in
            completionHandler(response == .OK ? panel.urls : nil)
        }
    }

    private func jsString(_ s: String) -> String {
        String(data: try! JSONSerialization.data(withJSONObject: [s]), encoding: .utf8)!.dropFirst().dropLast().description
    }
}
