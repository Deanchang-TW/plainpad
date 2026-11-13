import Foundation

/// The app's own text: the menu bar and the document type names. The page decides the interface language
/// (src/js/00-i18n.js) and reports it with a "locale" message; until it does, the language from the last run is used,
/// or the system's. Keys are the English text, as in the page's src/i18n/*.json; English needs no table.
enum Localization {
    private static let storeKey = "PlainpadInterfaceLanguage"
    static private(set) var current: String = UserDefaults.standard.string(forKey: storeKey) ?? systemLocale()

    /// Same rules as systemLocale() in the page.
    static func systemLocale() -> String {
        for raw in Locale.preferredLanguages {
            let l = raw.lowercased()
            if ["zh-hant", "zh-tw", "zh-hk", "zh-mo"].contains(where: { l.hasPrefix($0) }) { return "zh-TW" }
            if l.hasPrefix("zh") { return "zh-CN" }
            if l.hasPrefix("vi") { return "vi" }
            if l.hasPrefix("en") { return "en" }
        }
        return "en"
    }

    /// Remembers the language for the next launch. A language picked in Settings also becomes the app's AppleLanguages,
    /// so AppKit's own panels (Open, Save, About) follow it from the next launch; "auto" returns them to the system order.
    static func set(_ lang: String, choice: String) {
        current = table[lang] != nil ? lang : "en"
        UserDefaults.standard.set(current, forKey: storeKey)
        let apple = ["zh-TW": "zh-Hant", "zh-CN": "zh-Hans", "en": "en", "vi": "vi"]
        if choice == "auto" { UserDefaults.standard.removeObject(forKey: "AppleLanguages") }
        else if let code = apple[current] { UserDefaults.standard.set([code], forKey: "AppleLanguages") }
    }

    static let table: [String: [String: String]] = [
        "zh-TW": [
            "About Plainpad": "關於 Plainpad", "Hide Plainpad": "隱藏 Plainpad", "Hide Others": "隱藏其他", "Show All": "顯示全部",
            "Quit Plainpad": "結束 Plainpad", "File": "檔案", "New Tab": "新增分頁", "Open…": "開啟…", "Save": "儲存", "Save As…": "另存新檔…",
            "Save All": "全部儲存", "Close Tab": "關閉分頁", "Edit": "編輯", "Undo": "復原", "Redo": "重做", "Cut": "剪下", "Copy": "拷貝",
            "Paste": "貼上", "Select All": "全選", "Find…": "尋找…", "Replace…": "取代…", "View": "顯示方式", "Markdown Preview": "Markdown 預覽",
            "Hex View": "Hex 檢視", "Split View": "分割檢視", "Zoom In": "放大", "Zoom Out": "縮小", "Actual Size": "實際大小",
            "Enter Full Screen": "進入全螢幕", "Window": "視窗", "Minimize": "縮到最小", "Zoom": "縮放", "Help": "輔助說明",
            "Plainpad Help": "Plainpad 說明"
        ],
        "zh-CN": [
            "About Plainpad": "关于 Plainpad", "Hide Plainpad": "隐藏 Plainpad", "Hide Others": "隐藏其他", "Show All": "全部显示",
            "Quit Plainpad": "退出 Plainpad", "File": "文件", "New Tab": "新建标签页", "Open…": "打开…", "Save": "保存", "Save As…": "另存为…",
            "Save All": "全部保存", "Close Tab": "关闭标签页", "Edit": "编辑", "Undo": "撤销", "Redo": "重做", "Cut": "剪切", "Copy": "拷贝",
            "Paste": "粘贴", "Select All": "全选", "Find…": "查找…", "Replace…": "替换…", "View": "显示", "Markdown Preview": "Markdown 预览",
            "Hex View": "Hex 视图", "Split View": "拆分视图", "Zoom In": "放大", "Zoom Out": "缩小", "Actual Size": "实际大小",
            "Enter Full Screen": "进入全屏幕", "Window": "窗口", "Minimize": "最小化", "Zoom": "缩放", "Help": "帮助",
            "Plainpad Help": "Plainpad 帮助"
        ],
        "vi": [
            "About Plainpad": "Giới thiệu về Plainpad", "Hide Plainpad": "Ẩn Plainpad", "Hide Others": "Ẩn các mục khác",
            "Show All": "Hiển thị tất cả", "Quit Plainpad": "Thoát Plainpad", "File": "Tệp", "New Tab": "Thẻ mới", "Open…": "Mở…",
            "Save": "Lưu", "Save As…": "Lưu thành…", "Save All": "Lưu tất cả", "Close Tab": "Đóng thẻ", "Edit": "Sửa",
            "Undo": "Hoàn tác", "Redo": "Làm lại", "Cut": "Cắt", "Copy": "Sao chép", "Paste": "Dán", "Select All": "Chọn tất cả",
            "Find…": "Tìm…", "Replace…": "Thay thế…", "View": "Xem", "Markdown Preview": "Xem trước Markdown",
            "Hex View": "Chế độ Hex", "Split View": "Chia đôi màn hình", "Zoom In": "Phóng to", "Zoom Out": "Thu nhỏ",
            "Actual Size": "Kích thước thực", "Enter Full Screen": "Vào chế độ toàn màn hình", "Window": "Cửa sổ",
            "Minimize": "Thu nhỏ cửa sổ", "Zoom": "Thu phóng", "Help": "Trợ giúp", "Plainpad Help": "Hướng dẫn Plainpad"
        ]
    ]
}

/// The current language's text for an English key (the key itself in English).
func L(_ s: String) -> String { Localization.table[Localization.current]?[s] ?? s }
