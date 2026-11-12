/* ---------- help ---------- */
const HELP = `# Plainpad 說明

在瀏覽器裡使用的 Notepad++ 風格編輯器。這個分頁可以直接關掉，
需要時從「視窗 > 說明」再打開。

## 常用快速鍵（Mac；Windows 把 ⌘ 換成 Ctrl）

| 功能                     | 按鍵                       |
| ------------------------ | -------------------------- |
| 新增 / 關閉分頁          | ⌥N / ⌥W                    |
| 切換到第 1–9 個分頁      | ⌥1 … ⌥9                    |
| 開啟檔案                 | ⌘O，或直接拖進視窗          |
| 儲存 / 另存新檔          | ⌘S / ⇧⌘S                   |
| 尋找 / 取代              | ⌘F / ⌥⌘F（或 ⌃H）           |
| 在檔案中尋找             | ⇧⌘F                        |
| 下一個 / 上一個          | ⌘G / ⇧⌘G（或 F3 / ⇧F3）     |
| 跳至行                   | ⌃G                         |
| 複製行 / 刪除行          | ⌘D / ⇧⌘K                   |
| 上移 / 下移一行          | ⌥↑ / ⌥↓                    |
| 合併行                   | ⌘J                         |
| 切換註解                 | ⌘/                         |
| 轉大寫 / 轉小寫          | ⇧⌘U / ⌘U                   |
| 欄編輯器                 | ⌥C                         |
| 自動完成單字             | ⌘↩                         |
| 切換書籤 / 下一個 / 上一個 | ⌘F2 / F2 / ⇧F2（或點行號左側） |
| 錄製巨集 / 播放巨集      | ⌥⇧R / ⌥⇧P                  |
| 自動換行                 | ⌥Z                         |
| Markdown 預覽            | ⌃⇧M                        |
| 文字 / Hex 檢視切換      | ⌃⇧H                        |
| 縮放                     | ⌘= / ⌘- / ⌘0               |
| 欄（矩形）選取           | 按住 ⌥ 拖曳                 |
| 多重游標                 | 按住 ⌘ 點擊                 |

## 分割檢視與比較

- 「檢視 > 分割檢視」打開第二檢視，可以並排看兩個分頁，或同一個檔案的兩個位置。
  兩邊編輯同一份文件時內容即時同步。
- 「工具 > 比較兩個分頁」逐行比較：黃色是修改、紅色是左邊刪掉、綠色是右邊新增，
  斜線區塊是為了對齊補上的空白。編輯時自動重新比較，↑↓ 跳到上一個 / 下一個差異。

## Markdown 預覽

按工具列的 M↓ 按鈕（或 ⌃⇧M），右側會顯示目前分頁的 Markdown 預覽，邊打邊更新，
捲動會與編輯器同步。預覽中雙擊任一段落，編輯器會跳到那段原始碼。
程式碼區塊會依標註的語言上色（例如 \`\`\`sql、\`\`\`csharp）。
「匯出 HTML」會下載一份含樣式的獨立網頁；「複製 HTML」只複製內文，方便貼到 Confluence 等地方。
預覽裡看不到外部或相對路徑的圖片（網頁沙盒的限制），匯出的 HTML 則可以正常顯示。

數學公式用 LaTeX 語法：行內寫 $E = mc^2$，獨立一段寫 $$ … $$ 或 \`\`\`math 區塊。
要打金額的 $ 符號請寫成 \\$。
圖表用 \`\`\`mermaid 區塊，支援流程圖、循序圖、甘特圖、類別圖、ER 圖、狀態圖等。
第一次用到時才會下載這兩個元件，所以會慢一下。匯出的 HTML 已經把圖表與公式轉好，不需要網路。

## Hex 編輯器

二進位檔和超過 25 MB 的檔案會自動用 Hex 檢視開啟；也可以用「檔案 > 以 Hex 開啟」，
或按工具列的六角形 Hex 按鈕（⌃⇧H）把目前分頁在文字與 Hex 之間切換。

- 左邊是位址，中間是 16 進位位元組，右邊是文字。按 Tab 在兩欄之間切換。
- 直接輸入就會修改：Hex 欄打 0–9、A–F，文字欄打字元。改過的位元組會變成紅色。
- 預設是覆寫模式，按 Insert 鍵或工具列的「覆寫 / 插入」切換。Delete、Backspace 會刪除位元組。
- ⌘Z / ⇧⌘Z 復原與重做；⌘C、⌘X、⌘V 在 Hex 欄處理 hex 字串，在文字欄處理文字。
- 搜尋可以找 hex（?? 代表任意一個位元組，例如 4D 5A ?? 00）或文字，⌘G / ⇧⌘G 找下一個、上一個。
- 「跳至位址」（⌃G）接受 0x1F4、1F4h、500，以及 +100、-0x20 這種相對位移。
- 右側的數值解讀會把游標位置的位元組同時顯示成各種整數、浮點數、time_t 與 FILETIME，可切換大小端。
- 「Hex」選單可以把選取範圍複製成 hex 字串、C / C++ 陣列、C# 陣列或 Base64。
- 大檔案只會讀取畫面上需要的部分，GB 級的檔案也能開；編輯同樣不需要把整個檔案載入記憶體。
- 存檔時，.bin、.exe、.dll 這類副檔名無法直接下載，會詢問要包成 .zip（解壓縮後就是原檔）或存成 .txt 再改名。
- 200 MB 以內的 Hex 分頁會保存在這個瀏覽器裡，重新整理後仍在；更大的不會保留。

## 書籤

點行號左側的空白處，或按 ⌘F2。「搜尋 > 書籤」可以一次複製、剪下、刪除書籤行，
或只保留書籤行。尋找面板的「標記時加書籤」會把所有符合的行加上書籤。

## 巨集

按工具列的紅點開始錄製，打字、方向鍵、刪除與「編輯」選單的指令都會錄進去，
再按一次停止。▶ 播放一次，▶▶ 可以執行指定次數或一直到檔案結尾。
「巨集 > 儲存目前巨集」可以命名保存。滑鼠點擊不會被錄進去。

## 搜尋

- 一般：照字面比對。延伸：可用 \\n \\t \\r \\0 \\xHH \\uHHHH。
- 規則運算式：JavaScript 語法，^ 與 $ 以行為單位；取代可用 $1 或 \\1。
- 「全部列出」把結果列在下方面板，點一下就跳過去。
- 「在檔案中尋找」先選一個資料夾，檔案只在你的瀏覽器裡讀取，不會上傳。
  Chrome 會先跳出「要上傳檔案到這個網站嗎」的確認，那是瀏覽器的固定用語。

## 存檔與工作階段

- 所有分頁、書籤與巨集會自動保存在這個瀏覽器裡（不會上傳）。
- 儲存時會跳出下載確認，網頁無法直接覆寫硬碟上的原檔。
- 存檔時沿用開檔時的編碼（例如 Big5 檔案存回 Big5），行尾依右下角設定（LF / CRLF / CR）。
  要換編碼請用「編碼 > 存檔時使用的編碼」。有字元無法用原編碼表示時，存檔前會詢問。
- 開檔時自動辨識 UTF-8、UTF-16、Big5、GB18030、Shift_JIS、EUC-KR 與 Windows-1252。
  判斷錯誤時，可從「編碼 > 以其他編碼重新開啟」換一個。
`;
const SAMPLE_SQL = `-- 範例：每月訂單彙總（試試「搜尋 > 取代」的規則運算式模式）
SELECT  c.CustomerId,
        c.Name,
        DATEFROMPARTS(YEAR(o.OrderDate), MONTH(o.OrderDate), 1) AS OrderMonth,
        COUNT(*)            AS OrderCount,
        SUM(o.TotalAmount)  AS Revenue
FROM    dbo.Customers AS c
JOIN    dbo.Orders    AS o ON o.CustomerId = c.CustomerId
WHERE   o.OrderDate >= '2026-01-01'
  AND   o.Status IN (N'Paid', N'Shipped')
GROUP BY c.CustomerId,
         c.Name,
         DATEFROMPARTS(YEAR(o.OrderDate), MONTH(o.OrderDate), 1)
ORDER BY Revenue DESC;

/* 區塊註解也能摺疊：點行號右邊的 ⊟ 方塊（「設定 > 摺疊標記」可改成 VS Code 式箭頭） */
CREATE INDEX IX_Orders_Customer_Date
    ON dbo.Orders (CustomerId, OrderDate)
    INCLUDE (TotalAmount, Status);
`;
function openHelp(){
  const i = tabs.findIndex(t => t.name === HELP_NAME);
  if (i < 0){ addTab(makeTab({ name:HELP_NAME, text:HELP })); return; }
  const t = tabs[i]; if (!isDirty(t) && t.doc.getValue() !== HELP){ t.doc.setValue(HELP); t.cleanGen = t.doc.changeGeneration(true); }
  activateTab(i);
}

