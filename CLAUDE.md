# Plainpad：專案慣例

Notepad++ 風格的網頁編輯器（文字、Hex、Markdown 預覽）。個人專案，GitHub：`Deanchang-TW/plainpad`（私有）。
這個 repo 是唯一的原始碼。`dist/` 是建置產物，不進版本控制，也不要手改。

## 指令

```sh
npm install                      # 版本固定在 package-lock.json
npm test                         # 建置 + 全部瀏覽器測試（約 1 分鐘），每次修改後都要跑
node tests/run.mjs <關鍵字>      # 只跑名稱含關鍵字的測試，例如 hex、encoding › detects
node build.mjs --compare <檔案>  # 逐位元組比對建置結果，用來證明重構沒有改變輸出
```

本機第一次跑測試前要先執行 `npx playwright install chromium`。也可以用 `CHROMIUM_PATH` 指定瀏覽器。

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

## 頁面執行環境的限制

正式版發佈在 Claude 的頁面沙盒裡，很多瀏覽器功能不能用：

- `alert`、`confirm`、`prompt` 不會出現（`confirm` 直接回傳 false）。對話框一律用 `ask()` 或 `promptText()`（`02-modal.js`）。
- 存檔只能透過 `claude.use("downloads")`，而且只允許 `DL_EXT` 裡的副檔名。其他副檔名要包成 zip 或加上 `.txt`。
- 單檔版本（`LOCAL` 為 true）沒有副檔名限制，因為改用瀏覽器的一般下載。
- localStorage 和 IndexedDB 在某些情況會拋出例外，存取都要包 try/catch，取不到資料時頁面也要能正常運作。
- 外部只能載入 Google Fonts 的 CSS。函式庫一律由 `build.mjs` 從 npm 打包，放在 `vendor/` 一起發佈，**不要加回 CDN 的 `<script>`**。
- 測試介面 `window.__plainpad` 只在 `window.__PP_TEST` 為 true 時存在。正式頁面不能暴露任何東西，`editing › the published page has no test hook` 這項測試會檢查。

## 規則

- **原始檔不能出現 U+FFFD 字元**。需要時寫成 `�`，否則建置會失敗。這個字元通常是編輯時漏掉字元的痕跡。
- **函式庫升級**：
  - 版本要寫死，不能用範圍。
  - 只採用已發佈滿 14 天的版本。
  - 升級後跑 `npm audit`。
  - Mermaid 會把自己的 DOMPurify 和 KaTeX 打包進 `mermaid.min.js`，npm 顯示的依賴版本不代表實際執行的版本。可以用 grep 搜 `"3\.4\.[0-9]*"` 這類字串確認。
  - 檔名含版本號，要同步更新 `19-markdown-preview.js` 的 `LIB`。建置時會檢查頁面引用的每個 vendor 檔案都存在。
- **測試**：
  - 行為改變時要同步新增或修改測試。
  - 測試失敗時先判斷是程式錯還是測試錯，修測試要說明原因。
  - 樣本檔和預期輸出放在 `tests/fixtures/`。編碼的預期輸出是用 Python codecs 產生的，不要用 App 自己的輸出當預期值。
- **介面文字用繁體中文**，用使用者熟悉的說法，不要用系統內部的名詞。錯誤訊息要說明怎麼解決。
- **commit**：
  - 一個 commit 只做一件事。
  - 標題用英文祈使句，內文說明原因。
  - 純重構要用 `--compare` 證明輸出沒變，或在內文說明測試涵蓋範圍。

## 發佈

- **線上頁面**：在 Claude 的對話裡發佈 `dist/artifact/plainpad.html`，連同 `dist/artifact/vendor/` 一起，更新到同一個網址 `https://claude.ai/artifact/BA9cscx6RGLUrc2u1qtYZ5`。只有在 Claude 的對話裡才能發佈。
- **單檔版本**：`dist/plainpad-standalone.html` 可以直接給人使用，完全離線可用。
