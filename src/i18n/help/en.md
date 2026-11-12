# Plainpad Help

A Notepad++-style editor that runs in the browser. You can close this tab,
and open it again any time from Window > Help.

## Common shortcuts (Mac; on Windows use Ctrl instead of ⌘)

| Action                           | Keys                                 |
| -------------------------------- | ------------------------------------ |
| New / close tab                  | ⌥N / ⌥W                              |
| Go to tab 1–9                    | ⌥1 … ⌥9                              |
| Open file                        | ⌘O, or drag files into the window    |
| Save / Save As                   | ⌘S / ⇧⌘S                             |
| Find / Replace                   | ⌘F / ⌥⌘F (or ⌃H)                     |
| Find in files                    | ⇧⌘F                                  |
| Next / previous match            | ⌘G / ⇧⌘G (or F3 / ⇧F3)               |
| Go to line                       | ⌃G                                   |
| Duplicate / delete line          | ⌘D / ⇧⌘K                             |
| Move line up / down              | ⌥↑ / ⌥↓                              |
| Join lines                       | ⌘J                                   |
| Toggle comment                   | ⌘/                                   |
| UPPERCASE / lowercase            | ⇧⌘U / ⌘U                             |
| Column editor                    | ⌥C                                   |
| Complete word                    | ⌘↩                                   |
| Toggle / next / previous bookmark | ⌘F2 / F2 / ⇧F2 (or click left of a line number) |
| Record / play macro              | ⌥⇧R / ⌥⇧P                            |
| Word wrap                        | ⌥Z                                   |
| Markdown preview                 | ⌃⇧M                                  |
| Switch text / Hex view           | ⌃⇧H                                  |
| Zoom                             | ⌘= / ⌘- / ⌘0                         |
| Column (rectangular) selection   | Hold ⌥ and drag                      |
| Multiple cursors                 | Hold ⌘ and click                     |

## Split view and compare

- View > Split View opens a second view, so you can see two tabs side by side, or two places in the same file.
  When both sides show the same document, edits appear in both at once.
- Tools > Compare Two Tabs compares line by line: yellow lines changed, red lines were removed on the left,
  and green lines were added on the right. Hatched blocks are padding that keeps the two sides aligned.
  The comparison updates as you edit, and ↑ ↓ jump to the previous or next difference.

## Markdown preview

Press the M↓ toolbar button (or ⌃⇧M) to show a live preview of the current tab on the right.
It follows your scrolling, and double-clicking a paragraph in the preview jumps to its source.
Code blocks are highlighted by the language you name (for example ```sql or ```csharp).
Export HTML downloads a standalone page with styles. Copy HTML copies only the content, ready to paste into Confluence and similar tools.
The preview can't show external or relative image paths (a limit of the page sandbox), but exported HTML shows them.

Math uses LaTeX syntax: write $E = mc^2$ inline, and $$ … $$ or a ```math block for a display formula.
To type a dollar sign, write \$.
Diagrams use ```mermaid blocks: flowcharts, sequence, Gantt, class, ER and state diagrams, and more.
Both components download the first time you use them, so the first render takes a moment. Exported HTML already contains the rendered diagrams and math and needs no network.

## Hex editor

Binary files and files over 25 MB open in Hex view automatically. You can also use File > Open in Hex,
or press the hexagon Hex toolbar button (⌃⇧H) to switch the current tab between text and Hex.

- The offset is on the left, the hex bytes in the middle and the text on the right. Tab switches between the two columns.
- Typing edits directly: 0–9 and A–F in the Hex column, characters in the text column. Changed bytes turn red.
- Overwrite is the default. Press Insert or the Overwrite / Insert toolbar button to switch. Delete and Backspace remove bytes.
- ⌘Z / ⇧⌘Z undo and redo. ⌘C, ⌘X and ⌘V work with hex strings in the Hex column and with text in the text column.
- Search finds hex (?? matches any one byte, for example 4D 5A ?? 00) or text. ⌘G / ⇧⌘G find the next or previous match.
- Go to Offset (⌃G) accepts 0x1F4, 1F4h and 500, and relative moves such as +100 and -0x20.
- The data inspector on the right shows the bytes at the cursor as integers, floats, time_t and FILETIME, in either byte order.
- The Hex menu copies the selection as a hex string, a C / C++ array, a C# array or Base64.
- Large files are read only where the screen needs them, so even gigabyte files open. Editing doesn't load the whole file into memory either.
- Extensions such as .bin, .exe and .dll can't be downloaded directly, so saving offers a .zip (which unzips to the original file) or a .txt to rename afterwards.
- Hex tabs up to 200 MB are kept in this browser and survive a reload. Larger ones are not kept.

## Bookmarks

Click left of a line number, or press ⌘F2. Search > Bookmarks copies, cuts or deletes all bookmarked lines at once,
or keeps only the bookmarked lines. Bookmark when marking in the find panel bookmarks every matching line.

## Macros

Press the red dot on the toolbar to start recording. Typing, arrow keys, deletes and commands from the Edit menu are recorded.
Press it again to stop. ▶ plays once, and ▶▶ runs a set number of times or until the end of the file.
Macro > Save Current Macro keeps it under a name. Mouse clicks are not recorded.

## Search

- Normal: matches the text literally. Extended: allows \n \t \r \0 \xHH \uHHHH.
- Regular expression: JavaScript syntax, with ^ and $ matching per line. Replacements can use $1 or \1.
- List all shows the results in the panel below. Click one to jump to it.
- Find in files asks you to choose a folder first. The files are read only in your browser and never uploaded.
  Chrome first asks whether to upload files to this site. That is the browser's fixed wording.

## Saving and the session

- All tabs, bookmarks and macros are kept in this browser automatically and never uploaded.
- Saving shows a download prompt, because a web page can't overwrite the original file on disk.
- Saving keeps the file's original encoding (a Big5 file is saved as Big5). Line endings follow the setting at the bottom right (LF / CRLF / CR).
  To change the encoding, use Encoding > Save with Encoding. If some characters can't be represented in the original encoding, you'll be asked before saving.
- Opening detects UTF-8, UTF-16, Big5, GB18030, Shift_JIS, EUC-KR and Windows-1252 automatically.
  If the guess is wrong, pick another one under Encoding > Reopen with Encoding.

## Interface language

Settings > Interface Language switches between 繁體中文, English, 简体中文 and Tiếng Việt. The page reloads, and your tabs stay as they were.
