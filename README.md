# Plainpad

繁體中文 | [English](README.en.md)

在瀏覽器裡使用的 Notepad++ 風格編輯器：多分頁文字編輯、Hex 編輯器、Markdown 預覽（含 Mermaid 與數學公式）、
分割檢視與比較、書籤、巨集、欄編輯器、規則運算式搜尋，以及保留原始編碼的存檔。

介面支援繁體中文、English、简体中文與 Tiếng Việt，預設跟隨瀏覽器或系統語言，可在「設定 > 介面語言」切換。

## 本機啟動

```sh
npm install                        # 第一次才需要
node build.mjs                     # 產生 dist/
open dist/plainpad-standalone.html # macOS；其他系統用瀏覽器開啟這個檔案
```

單檔版本把所有函式庫包在裡面，用 `file://` 直接開就能用，存檔走瀏覽器一般下載。

要用和線上版相同的形式（頁面加 `vendor/` 目錄），必須透過 HTTP 伺服器開啟，用 `file://` 會載不到函式庫：

```sh
npx serve dist/artifact            # 開 http://localhost:3000/plainpad.html
# 或
python3 -m http.server 8000 --directory dist/artifact   # 開 http://localhost:8000/plainpad.html
```

改了 `src/` 之後重新執行 `node build.mjs`，再重新整理頁面。`dist/` 是建置產物，不要手改。

## macOS 應用程式

```sh
npm run build:mac                  # 產生 dist/mac/Plainpad.app（需要 Xcode 或 Command Line Tools）
open dist/mac/Plainpad.app
```

同一份網頁包在原生外殼裡（`macos/`，Swift + WKWebView，沒有其他相依套件）。和網頁版不同的地方：

- 儲存走 macOS 的存檔面板，從磁碟開啟的檔案會直接寫回原路徑，沒有副檔名限制。
- 可以從 Finder 的「打開檔案的應用程式」、拖到 Dock 圖示或 `open -a Plainpad 檔案` 開啟檔案；在 App 裡的「開啟」是 NSOpenPanel。
- 有原生選單列（檔案、編輯、顯示方式、視窗），選單項目會呼叫頁面裡同一個 `run()`。
- 視窗標題顯示目前分頁的檔名，有未儲存修改時關閉按鈕會出現圓點。
- 檔案被其他程式修改時：沒有未儲存修改的分頁自動重新載入（只替換改過的部分，可以復原）；有修改的分頁會先詢問。檔案被刪除時分頁保留並標為未儲存。App 關閉期間的修改，下次開啟時也會偵測到。
- 工作階段一樣保存在頁面的 localStorage / IndexedDB，關閉視窗等於結束 App，結束前會先寫入。

`node build-mac.mjs --universal` 會同時編譯 arm64 與 x86_64。App 只有 ad-hoc 簽章，自己的電腦可以直接執行；要給別人用需要 Developer ID 簽章與公證。
`PLAINPAD_DEBUG=1 dist/mac/Plainpad.app/Contents/MacOS/Plainpad` 會把頁面的請求和橋接訊息印到終端機，頁面也可以用右鍵「檢閱元件」打開 Web Inspector。

## 建置與測試

```sh
npm install          # 函式庫版本固定在 package.json / package-lock.json
npm run build        # 產生 dist/
npm test             # 建置後跑全部 Chromium 測試（約 1 分鐘）
node tests/run.mjs hex      # 只跑名稱含「hex」的測試
PP_PLATFORM=mac node tests/run.mjs   # 模擬 Mac 鍵盤（⌘）；在 Mac 上預設就是這樣
```

測試需要 Chromium。工作環境有 `/opt/pw-browsers/chromium` 時會自動使用，其他環境請設定 `CHROMIUM_PATH`，
或執行 `npx playwright install chromium`。

## 建置產物

| 檔案 | 用途 |
|---|---|
| `dist/artifact/plainpad.html` + `dist/artifact/vendor/*` | 發佈到 Claude 的頁面，函式庫跟頁面一起發佈，不經過第三方 CDN |
| `dist/plainpad-standalone.html` | 單一檔案（約 6 MB），在本機瀏覽器直接開啟，完全離線可用，存檔沒有副檔名限制 |
| `dist/mac/Plainpad.app` | macOS 應用程式（`npm run build:mac`），頁面放在 `Contents/Resources/web/`，由 `plainpad://app/` 自訂協定提供 |
| `dist/test/index.html`、`dist/test/prod.html` | 測試用：前者開啟測試介面，後者是正式頁面（用來確認沒有暴露測試介面） |

`node build.mjs --compare <file>` 會逐位元組比對建置結果與指定檔案。

## 原始碼結構

```
src/head.html        <title>、meta、字型
src/markup.html      版面 HTML
src/styles/*.css     依區塊分檔，按檔名順序串接
src/i18n/            介面翻譯（en、zh-CN、vi 的 JSON，鍵是繁中原文），以及各語言的說明頁與範例檔
src/js/*.js          依功能分檔，按檔名順序串接，包在同一個函式裡執行
build.mjs            組合頁面、打包 CodeMirror、複製其他函式庫
build-mac.mjs        把頁面包成 macOS App；macos/ 是 Swift 原始碼、Info.plist 和圖示
tests/*.test.mjs     瀏覽器測試；tests/fixtures 是樣本檔與預期輸出
```

`src/js` 的各檔案共用同一個作用域（建置時串接後包進一個 IIFE），所以順序有意義：
`00-config` 定義常數，`26-boot` 最後執行啟動流程。這是從單一檔案拆出來的過渡結構，
下一步可以改成真正的 ES 模組，讓每個檔案明確匯入匯出。

主要區塊：

| 檔案 | 內容 |
|---|---|
| `03-editors.js`、`04-tab-strip.js` | 兩個 CodeMirror 編輯器、分頁資料結構與分頁列 |
| `08-persistence.js` | 工作階段保存：中繼資料在 localStorage，內容在 IndexedDB，只寫有變動的分頁；Web Locks 確保只有一個視窗寫入 |
| `09-encodings.js`、`10-open-decode.js`、`11-save.js` | 編碼偵測、以原編碼存檔（編碼表由瀏覽器自己的解碼器反推，保證讀進來的能原樣寫回） |
| `18-split-view-compare.js` | 分割檢視與逐行比較（Myers diff） |
| `19-markdown-preview.js` | Markdown 預覽、Mermaid、KaTeX，以及延遲載入函式庫 |
| `20-hex-editor.js` | Hex 編輯器：以 piece table 管理修改，原檔按 64 KB 區塊延遲讀取 |
| `23-actions.js`、`24-menus.js`、`25-keyboard.js` | 所有指令的入口 `run()`、選單定義、快速鍵 |
| `11-native-shell.js` | macOS App 的橋接：偵測 WKWebView 的訊息處理器，存檔與開檔改走原生面板 |

## 發佈

把 `dist/artifact/plainpad.html` 連同 `dist/artifact/vendor/` 下的檔案一起發佈。
頁面以相對路徑 `vendor/...` 載入函式庫；建置時會檢查頁面引用的每個函式庫檔案都存在。

## 已知限制

- 在 Claude 的頁面裡，存檔只能下載，且只允許 txt、md、zip、png 等副檔名；其他副檔名要包成 zip 或加上 .txt。單檔版本沒有這個限制。
- 同一個瀏覽器同時開兩個視窗時，第二個視窗不會保存內容，並會顯示提示。
- 超過 200 MB 的 Hex 分頁重新整理後不會保留。

## 授權

MIT，見 [LICENSE](LICENSE)。打包進頁面的函式庫（CodeMirror、marked、Mermaid、KaTeX 等）各自沿用原本的授權。
