# Plainpad：專案慣例

Notepad++ 風格的網頁編輯器（文字、Hex、Markdown 預覽）。個人專案，GitHub：`Deanchang-TW/plainpad`（私有）。
這個 repo 是唯一的原始碼。`dist/` 是建置產物，不進版本控制，也不要手改。

## 指令

```sh
npm install                      # 版本固定在 package-lock.json
npm test                         # 建置 + 全部瀏覽器測試（約 1 分鐘），每次修改後都要跑
node tests/run.mjs <關鍵字>      # 只跑名稱含關鍵字的測試，例如 hex、encoding › detects
node build.mjs --compare <檔案>  # 逐位元組比對建置結果，用來證明重構沒有改變輸出
npm run build:mac                # 產生 dist/mac/Plainpad.app（Swift + WKWebView 外殼，需要 swiftc）
```

本機第一次跑測試前要先執行 `npx playwright install chromium`。也可以用 `CHROMIUM_PATH` 指定瀏覽器。

測試預設依執行的電腦選鍵盤：在 Mac 上按 ⌘，其他平台按 Ctrl。`PP_PLATFORM=mac` 或 `PP_PLATFORM=linux` 可以讓頁面假裝成另一個平台，
用來在同一台機器上檢查兩種按鍵路徑。修改快速鍵或測試後，兩種都要跑：`node tests/run.mjs` 和 `PP_PLATFORM=mac node tests/run.mjs`。

## 程式碼結構

- `src/js/*.js` 依檔名順序串接，包在同一個 IIFE 裡執行，**所有檔案共用同一個作用域**。
  - 新增檔案時，用編號決定它在哪裡執行。
  - 在頂層用 `const` 宣告、而且被別的檔案用到的名稱，必須排在使用它的程式「執行」之前。函式宣告會提升，`const` 不會。
  - `26-boot.js` 最後執行，啟動流程是 async：要等工作階段鎖和 IndexedDB 讀完，才會建立分頁。
- **所有指令都經過 `run(name)`**（`23-actions.js`）。選單、工具列、快速鍵都呼叫 `run`，不要直接呼叫動作函式。
  - 新增動作時放進 `A` 表。
  - 要決定它在 Hex 分頁的行為：轉給 Hex 版本的放 `HEX_ROUTE`，照常執行的放 `HEX_OK`，其他會被擋下並提示。
  - 名稱以 `hex` 開頭的動作只在 Hex 檢視可用。
- **分頁有兩種**：文字分頁和 Hex 分頁，用 `isHex(t)` 區分。
  - Hex 分頁帶著一份空的 CodeMirror 文件，讓共用流程不會出錯，但不能拿它的內容做事。
  - 碰到 `t.doc` 的新程式都要先想想 Hex 分頁的情況。
- **編碼**：`t.encoding` 存 WHATWG 標準名稱（`utf-8`、`big5`、`gb18030`、`shift_jis`、`euc-kr`、`windows-1252`、`utf-16le`、`utf-16be`）。
  - 舊名稱用 `normEnc()` 轉換。
  - 產生檔案位元組一律用 `encodeText()`，不要用 `TextEncoder`。
- **保存**（`08-persistence.js`）：
  - 中繼資料存在 localStorage 的 `plainpad.session.v2`，分頁內容存在 IndexedDB 的 `docs` 和 `hex` 兩個 store。
  - 改變儲存格式時，要提高版本號、寫轉移程式，並加上轉移測試（參考 `storage.test.mjs` 的第一項）。

- **macOS App**（`macos/`、`build-mac.mjs`）：同一份頁面裝在 WKWebView 裡，由 `plainpad://app/` 自訂協定提供。
  - 頁面用 `NATIVE`（`00-config.js`）判斷自己在 App 裡；此時 `LOCAL` 也為 true。
  - 頁面和 App 之間的訊息格式寫在 `macos/Sources/WebShell.swift` 開頭的註解，`11-native-shell.js` 是頁面這一側。
    改動其中一邊時兩邊都要改，並更新 `tests/native.test.mjs`（它用假的訊息處理器模擬 App）。
  - 頁面只在 `NATIVE` 時才把 `window.__ppNative` 放到 window 上，正式頁面仍然不能暴露任何東西。
  - Swift 端無法用 Playwright 測，改動後要實際 `npm run build:mac` 跑一次；`PLAINPAD_DEBUG=1` 會印出請求與訊息。

## 頁面執行環境的限制

正式版發佈在 Claude 的頁面沙盒裡，很多瀏覽器功能不能用：

- `alert`、`confirm`、`prompt` 不會出現（`confirm` 直接回傳 false）。對話框一律用 `ask()` 或 `promptText()`（`02-modal.js`）。
- 存檔只能透過 `claude.use("downloads")`，而且只允許 `DL_EXT` 裡的副檔名。其他副檔名要包成 zip 或加上 `.txt`。
- 單檔版本（`LOCAL` 為 true）沒有副檔名限制，因為改用瀏覽器的一般下載。
- localStorage 和 IndexedDB 在某些情況會拋出例外，存取都要包 try/catch，取不到資料時頁面也要能正常運作。
- 外部只能載入 Google Fonts 的 CSS。函式庫一律由 `build.mjs` 從 npm 打包，放在 `vendor/` 一起發佈，**不要加回 CDN 的 `<script>`**。
- 測試介面 `window.__plainpad` 只在 `window.__PP_TEST` 為 true 時存在。正式頁面不能暴露任何東西，`editing › the published page has no test hook` 這項測試會檢查。

## 規則

- **原始檔不能出現 U+FFFD 字元**。需要時寫成 `\uFFFD`，否則建置會失敗。這個字元通常是編輯時漏掉字元的痕跡。
- **函式庫升級**：
  - 版本要寫死，不能用範圍。
  - 只採用已發佈滿 14 天的版本。
  - 升級後跑 `npm audit`。
  - Mermaid 會把自己的 DOMPurify 和 KaTeX 打包進 `mermaid.min.js`，npm 顯示的依賴版本不代表實際執行的版本。可以用 grep 搜 `"3\.4\.[0-9]*"` 這類字串確認。
  - 檔名含版本號，要同步更新 `19-markdown-preview.js` 的 `LIB`。建置時會檢查頁面引用的每個 vendor 檔案都存在。
- **測試**：
  - 行為改變時要同步新增或修改測試。
  - 測試失敗時先判斷是程式錯還是測試錯，修測試要說明原因。
  - 測試裡按 App 快速鍵時，用 `tests/platform.mjs` 的 `MOD`，不要寫死 `Control`；App 在 Mac 上用 ⌘。
    只有在 Mac 上本來就是 Ctrl 的快速鍵（⌃G 跳至行、⌃⇧M Markdown 預覽、⌃⇧H Hex 切換）才寫 `Control`。
  - 依賴系統剪貼簿的步驟（原生的複製、貼上）在模擬平台時無法執行，用 `SPOOFED` 判斷。
  - 樣本檔和預期輸出放在 `tests/fixtures/`。編碼的預期輸出是用 Python codecs 產生的，不要用 App 自己的輸出當預期值。
- **介面文字**以繁體中文撰寫，用使用者熟悉的說法，不要用系統內部的名詞。錯誤訊息要說明怎麼解決。
- **多國語言**（繁中、英文、簡中、越南文）：
  - JS 裡的介面文字一律寫成 `tr("繁中原文")`，繁中原文就是翻譯的鍵。有變數時用 `tr("已儲存 {name}", { name })`，不要用字串串接或樣板字串組句子，因為各語言語序不同。
  - `src/markup.html` 的文字和 title、aria-label、placeholder 會在啟動時依同樣的鍵翻譯，不需要另外處理。
  - 新增或修改文字後，要在 `src/i18n/en.json`、`zh-CN.json`、`vi.json` 補上翻譯。`node build.mjs --i18n-todo` 會列出缺少的項目。建置會檢查：每個語言都有翻譯、佔位符 {…} 一致、沒有不再使用的項目、tr() 以外沒有中文。
  - 英文需要單複數時，翻譯寫成 `{ "one": "…", "other": "…" }`，依變數 n 選擇。
  - 不是介面文字的中文（字元範圍、編碼偵測用的字表）在同一行加上 `i18n-ignore` 註解。
  - 說明頁與範例檔在 `src/i18n/help/`、`src/i18n/sample/`，每個語言一份，改內容時四份都要改。
  - 測試預設以繁中（瀏覽器 locale zh-TW）執行；`open({ locale:"en-US" })` 可以用其他語言開啟。
  - macOS App 的選單文字在 `macos/Sources/Localization.swift`，文件類型名稱在 `macos/Resources/*.lproj`。
- **commit**：
  - 個人專案，直接 commit 並推送到 `main`，不開分支、不走 PR。推送前先 `git pull --rebase`，並確認 `npm test` 全部通過。
  - 一個 commit 只做一件事。
  - 標題用英文祈使句，內文說明原因。
  - 純重構要用 `--compare` 證明輸出沒變，或在內文說明測試涵蓋範圍。

## 發佈

- **線上頁面**：在 Claude 的對話裡發佈 `dist/artifact/plainpad.html`，連同 `dist/artifact/vendor/` 一起，更新到同一個網址 `https://claude.ai/artifact/BA9cscx6RGLUrc2u1qtYZ5`。只有在 Claude 的對話裡才能發佈。
- **單檔版本**：`dist/plainpad-standalone.html` 可以直接給人使用，完全離線可用。
