# Plainpad

在瀏覽器裡使用的 Notepad++ 風格編輯器：多分頁文字編輯、Hex 編輯器、Markdown 預覽（含 Mermaid 與數學公式）、
分割檢視與比較、書籤、巨集、欄編輯器、規則運算式搜尋，以及保留原始編碼的存檔。

## 建置與測試

```sh
npm install          # 函式庫版本固定在 package.json / package-lock.json
npm run build        # 產生 dist/
npm test             # 建置後跑 32 項 Chromium 測試
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
| `dist/test/index.html`、`dist/test/prod.html` | 測試用：前者開啟測試介面，後者是正式頁面（用來確認沒有暴露測試介面） |

`node build.mjs --compare <file>` 會逐位元組比對建置結果與指定檔案。

## 原始碼結構

```
src/head.html        <title>、meta、字型
src/markup.html      版面 HTML
src/styles/*.css     依區塊分檔，按檔名順序串接
src/js/*.js          依功能分檔，按檔名順序串接，包在同一個函式裡執行
build.mjs            組合頁面、打包 CodeMirror、複製其他函式庫
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

## 發佈

把 `dist/artifact/plainpad.html` 連同 `dist/artifact/vendor/` 下的檔案一起發佈。
頁面以相對路徑 `vendor/...` 載入函式庫；建置時會檢查頁面引用的每個函式庫檔案都存在。

## 已知限制

- 在 Claude 的頁面裡，存檔只能下載，且只允許 txt、md、zip、png 等副檔名；其他副檔名要包成 zip 或加上 .txt。單檔版本沒有這個限制。
- 同一個瀏覽器同時開兩個視窗時，第二個視窗不會保存內容，並會顯示提示。
- 超過 200 MB 的 Hex 分頁重新整理後不會保留。
