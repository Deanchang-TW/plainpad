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
        appMenu.addItem(withTitle: L("About Plainpad"), action: #selector(NSApplication.orderFrontStandardAboutPanel(_:)), keyEquivalent: "")
        appMenu.addItem(.separator())
        appMenu.addItem(withTitle: L("Hide Plainpad"), action: #selector(NSApplication.hide(_:)), keyEquivalent: "h")
        let hideOthers = appMenu.addItem(withTitle: L("Hide Others"), action: #selector(NSApplication.hideOtherApplications(_:)), keyEquivalent: "h")
        hideOthers.keyEquivalentModifierMask = [.command, .option]
        appMenu.addItem(withTitle: L("Show All"), action: #selector(NSApplication.unhideAllApplications(_:)), keyEquivalent: "")
        appMenu.addItem(.separator())
        appMenu.addItem(withTitle: L("Quit Plainpad"), action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")

        // The page handles these shortcuts itself (WKWebView gives key equivalents to the page first); the items are
        // here so the commands are discoverable from the menu bar and still work when the web view has no focus.
        let file = submenu(main, L("File"))
        action(file, L("New Tab"), "newTab", "n")
        action(file, L("Open…"), "openFile", "o")
        file.addItem(.separator())
        action(file, L("Save"), "save", "s")
        action(file, L("Save As…"), "saveAs", "S")
        action(file, L("Save All"), "saveAll", "")
        file.addItem(.separator())
        action(file, L("Close Tab"), "closeActive", "w")

        let edit = submenu(main, L("Edit"))
        edit.addItem(withTitle: L("Undo"), action: Selector(("undo:")), keyEquivalent: "z")
        edit.addItem(withTitle: L("Redo"), action: Selector(("redo:")), keyEquivalent: "Z")
        edit.addItem(.separator())
        edit.addItem(withTitle: L("Cut"), action: #selector(NSText.cut(_:)), keyEquivalent: "x")
        edit.addItem(withTitle: L("Copy"), action: #selector(NSText.copy(_:)), keyEquivalent: "c")
        edit.addItem(withTitle: L("Paste"), action: #selector(NSText.paste(_:)), keyEquivalent: "v")
        edit.addItem(withTitle: L("Select All"), action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")
        edit.addItem(.separator())
        action(edit, L("Find…"), "find", "f")
        action(edit, L("Replace…"), "replace", "H")

        let view = submenu(main, L("View"))
        action(view, L("Markdown Preview"), "mdPreview", "")
        action(view, L("Hex View"), "toggleHex", "")
        action(view, L("Split View"), "toggleSplit", "")
        view.addItem(.separator())
        action(view, L("Zoom In"), "zoomIn", "+")
        action(view, L("Zoom Out"), "zoomOut", "-")
        action(view, L("Actual Size"), "zoomReset", "0")
        view.addItem(.separator())
        let fullScreen = view.addItem(withTitle: L("Enter Full Screen"), action: #selector(NSWindow.toggleFullScreen(_:)), keyEquivalent: "f")
        fullScreen.keyEquivalentModifierMask = [.command, .control]

        let windowMenu = submenu(main, L("Window"))
        windowMenu.addItem(withTitle: L("Minimize"), action: #selector(NSWindow.performMiniaturize(_:)), keyEquivalent: "m")
        windowMenu.addItem(withTitle: L("Zoom"), action: #selector(NSWindow.performZoom(_:)), keyEquivalent: "")
        NSApp.windowsMenu = windowMenu

        let help = submenu(main, L("Help"))
        action(help, L("Plainpad Help"), "help", "?")
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
