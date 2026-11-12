import Cocoa

final class AppDelegate: NSObject, NSApplicationDelegate, NSWindowDelegate {
    private var window: NSWindow!
    private var shell: WebShell!

    // Files handed over at launch (Finder "Open With", `open -a Plainpad file`) arrive before didFinishLaunching,
    // so the shell has to exist from the start; it queues them until the page is ready.
    func applicationWillFinishLaunching(_ notification: Notification) {
        shell = WebShell()
        // The page owns the language setting; when it reports one, the menu bar is rebuilt in that language.
        shell.onLocale = { [weak self] lang, choice in
            guard let self else { return }
            let before = Localization.current
            Localization.set(lang, choice: choice)
            if Localization.current != before { NSApp.mainMenu = self.buildMenu() }
        }
        NSApp.mainMenu = buildMenu()
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1240, height: 820),
                          styleMask: [.titled, .closable, .miniaturizable, .resizable],
                          backing: .buffered, defer: false)
        window.title = "Plainpad"
        window.minSize = NSSize(width: 720, height: 420)
        window.tabbingMode = .disallowed
        window.contentView = shell.webView
        window.delegate = self
        window.setFrameAutosaveName("PlainpadMain")
        if !window.setFrameUsingName("PlainpadMain") { window.center() }
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
        shell.load()
    }

    // Finder "Open With" and drops on the Dock icon, at launch or later.
    func application(_ application: NSApplication, open urls: [URL]) {
        shell.open(urls.filter { $0.isFileURL })
    }

    // The window is the app: closing it quits, and quitting first lets the page write its session to storage.
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }

    func applicationShouldTerminate(_ sender: NSApplication) -> NSApplication.TerminateReply {
        shell.flush { sender.reply(toApplicationShouldTerminate: true) }
        return .terminateLater
    }

    func windowShouldClose(_ sender: NSWindow) -> Bool {
        NSApp.terminate(nil)
        return false
    }

    // MARK: menu bar

    private func buildMenu() -> NSMenu {
        let main = NSMenu()

        let appMenu = submenu(main, "Plainpad")
        appMenu.addItem(withTitle: L("關於 Plainpad"), action: #selector(NSApplication.orderFrontStandardAboutPanel(_:)), keyEquivalent: "")
        appMenu.addItem(.separator())
        appMenu.addItem(withTitle: L("隱藏 Plainpad"), action: #selector(NSApplication.hide(_:)), keyEquivalent: "h")
        let hideOthers = appMenu.addItem(withTitle: L("隱藏其他"), action: #selector(NSApplication.hideOtherApplications(_:)), keyEquivalent: "h")
        hideOthers.keyEquivalentModifierMask = [.command, .option]
        appMenu.addItem(withTitle: L("顯示全部"), action: #selector(NSApplication.unhideAllApplications(_:)), keyEquivalent: "")
        appMenu.addItem(.separator())
        appMenu.addItem(withTitle: L("結束 Plainpad"), action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")

        // The page handles these shortcuts itself (WKWebView gives key equivalents to the page first); the items are
        // here so the commands are discoverable from the menu bar and still work when the web view has no focus.
        let file = submenu(main, L("檔案"))
        action(file, L("新增分頁"), "newTab", "n")
        action(file, L("開啟…"), "openFile", "o")
        file.addItem(.separator())
        action(file, L("儲存"), "save", "s")
        action(file, L("另存新檔…"), "saveAs", "S")
        action(file, L("全部儲存"), "saveAll", "")
        file.addItem(.separator())
        action(file, L("關閉分頁"), "closeActive", "w")

        let edit = submenu(main, L("編輯"))
        edit.addItem(withTitle: L("復原"), action: Selector(("undo:")), keyEquivalent: "z")
        edit.addItem(withTitle: L("重做"), action: Selector(("redo:")), keyEquivalent: "Z")
        edit.addItem(.separator())
        edit.addItem(withTitle: L("剪下"), action: #selector(NSText.cut(_:)), keyEquivalent: "x")
        edit.addItem(withTitle: L("拷貝"), action: #selector(NSText.copy(_:)), keyEquivalent: "c")
        edit.addItem(withTitle: L("貼上"), action: #selector(NSText.paste(_:)), keyEquivalent: "v")
        edit.addItem(withTitle: L("全選"), action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")
        edit.addItem(.separator())
        action(edit, L("尋找…"), "find", "f")
        action(edit, L("取代…"), "replace", "H")

        let view = submenu(main, L("顯示方式"))
        action(view, L("Markdown 預覽"), "mdPreview", "")
        action(view, L("Hex 檢視"), "toggleHex", "")
        action(view, L("分割檢視"), "toggleSplit", "")
        view.addItem(.separator())
        action(view, L("放大"), "zoomIn", "+")
        action(view, L("縮小"), "zoomOut", "-")
        action(view, L("實際大小"), "zoomReset", "0")
        view.addItem(.separator())
        let fullScreen = view.addItem(withTitle: L("進入全螢幕"), action: #selector(NSWindow.toggleFullScreen(_:)), keyEquivalent: "f")
        fullScreen.keyEquivalentModifierMask = [.command, .control]

        let windowMenu = submenu(main, L("視窗"))
        windowMenu.addItem(withTitle: L("縮到最小"), action: #selector(NSWindow.performMiniaturize(_:)), keyEquivalent: "m")
        windowMenu.addItem(withTitle: L("縮放"), action: #selector(NSWindow.performZoom(_:)), keyEquivalent: "")
        NSApp.windowsMenu = windowMenu

        let help = submenu(main, L("輔助說明"))
        action(help, L("Plainpad 說明"), "help", "?")
        NSApp.helpMenu = help
        return main
    }

    private func submenu(_ parent: NSMenu, _ title: String) -> NSMenu {
        let item = NSMenuItem(title: title, action: nil, keyEquivalent: "")
        let menu = NSMenu(title: title)
        item.submenu = menu
        parent.addItem(item)
        return menu
    }

    private func action(_ menu: NSMenu, _ title: String, _ name: String, _ key: String) {
        let item = menu.addItem(withTitle: title, action: #selector(runAction(_:)), keyEquivalent: key)
        item.target = self
        item.representedObject = name
    }

    @objc private func runAction(_ sender: NSMenuItem) {
        guard let name = sender.representedObject as? String else { return }
        shell.run(name)
    }
}
