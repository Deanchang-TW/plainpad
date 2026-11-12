// Entry point. Everything else lives in AppDelegate.swift (window, menu bar, Finder integration) and WebShell.swift
// (the WKWebView, the plainpad:// scheme that serves the page, and the save/open bridge the page talks to).
import Cocoa

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.setActivationPolicy(.regular)
app.run()
