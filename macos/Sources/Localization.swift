import Foundation

/// The app's own text: the menu bar and the document type names. The page decides the interface language
/// (src/js/00-i18n.js) and reports it with a "locale" message; until it does, the language from the last run is used,
/// or the system's. Keys are the Traditional Chinese text, as in the page's src/i18n/*.json.
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
        current = table[lang] != nil || lang == "zh-TW" ? lang : "en"
        UserDefaults.standard.set(current, forKey: storeKey)
        let apple = ["zh-TW": "zh-Hant", "zh-CN": "zh-Hans", "en": "en", "vi": "vi"]
        if choice == "auto" { UserDefaults.standard.removeObject(forKey: "AppleLanguages") }
        else if let code = apple[current] { UserDefaults.standard.set([code], forKey: "AppleLanguages") }
    }

    static let table: [String: [String: String]] = [
        "en": [
            "關於 Plainpad": "About Plainpad", "隱藏 Plainpad": "Hide Plainpad", "隱藏其他": "Hide Others", "顯示全部": "Show All",
            "結束 Plainpad": "Quit Plainpad", "檔案": "File", "新增分頁": "New Tab", "開啟…": "Open…", "儲存": "Save",
            "另存新檔…": "Save As…", "全部儲存": "Save All", "關閉分頁": "Close Tab", "編輯": "Edit", "復原": "Undo", "重做": "Redo",
            "剪下": "Cut", "拷貝": "Copy", "貼上": "Paste", "全選": "Select All", "尋找…": "Find…", "取代…": "Replace…",
            "顯示方式": "View", "Markdown 預覽": "Markdown Preview", "Hex 檢視": "Hex View", "分割檢視": "Split View",
            "放大": "Zoom In", "縮小": "Zoom Out", "實際大小": "Actual Size", "進入全螢幕": "Enter Full Screen", "視窗": "Window",
            "縮到最小": "Minimize", "縮放": "Zoom", "輔助說明": "Help", "Plainpad 說明": "Plainpad Help"
        ],
        "zh-CN": [
            "關於 Plainpad": "关于 Plainpad", "隱藏 Plainpad": "隐藏 Plainpad", "隱藏其他": "隐藏其他", "顯示全部": "全部显示",
            "結束 Plainpad": "退出 Plainpad", "檔案": "文件", "新增分頁": "新建标签页", "開啟…": "打开…", "儲存": "保存",
            "另存新檔…": "另存为…", "全部儲存": "全部保存", "關閉分頁": "关闭标签页", "編輯": "编辑", "復原": "撤销", "重做": "重做",
            "剪下": "剪切", "拷貝": "拷贝", "貼上": "粘贴", "全選": "全选", "尋找…": "查找…", "取代…": "替换…",
            "顯示方式": "显示", "Markdown 預覽": "Markdown 预览", "Hex 檢視": "Hex 视图", "分割檢視": "拆分视图",
            "放大": "放大", "縮小": "缩小", "實際大小": "实际大小", "進入全螢幕": "进入全屏幕", "視窗": "窗口",
            "縮到最小": "最小化", "縮放": "缩放", "輔助說明": "帮助", "Plainpad 說明": "Plainpad 帮助"
        ],
        "vi": [
            "關於 Plainpad": "Giới thiệu về Plainpad", "隱藏 Plainpad": "Ẩn Plainpad", "隱藏其他": "Ẩn các mục khác", "顯示全部": "Hiển thị tất cả",
            "結束 Plainpad": "Thoát Plainpad", "檔案": "Tệp", "新增分頁": "Thẻ mới", "開啟…": "Mở…", "儲存": "Lưu",
            "另存新檔…": "Lưu thành…", "全部儲存": "Lưu tất cả", "關閉分頁": "Đóng thẻ", "編輯": "Sửa", "復原": "Hoàn tác", "重做": "Làm lại",
            "剪下": "Cắt", "拷貝": "Sao chép", "貼上": "Dán", "全選": "Chọn tất cả", "尋找…": "Tìm…", "取代…": "Thay thế…",
            "顯示方式": "Xem", "Markdown 預覽": "Xem trước Markdown", "Hex 檢視": "Chế độ Hex", "分割檢視": "Chia đôi màn hình",
            "放大": "Phóng to", "縮小": "Thu nhỏ", "實際大小": "Kích thước thực", "進入全螢幕": "Vào chế độ toàn màn hình", "視窗": "Cửa sổ",
            "縮到最小": "Thu nhỏ cửa sổ", "縮放": "Thu phóng", "輔助說明": "Trợ giúp", "Plainpad 說明": "Hướng dẫn Plainpad"
        ]
    ]
}

/// The current language's text for a Traditional Chinese key (the key itself in Traditional Chinese).
func L(_ s: String) -> String { Localization.table[Localization.current]?[s] ?? s }
