/* ---------- menus ---------- */
const it = (label, act, key, extra) => Object.assign({ label, act, key }, extra || {});
const MENUS = [
  { label:"檔案", items: () => [
    it("新增分頁", "newTab", "Alt-N"), it("開啟…", "openFile", "Mod-O"), it("以 Hex 開啟…", "openHex"),
    "-", it("儲存", "save", "Mod-S"), it("另存新檔…", "saveAs", "Mod-Shift-S"), it("全部儲存", "saveAll"), it("重新命名…", "rename"),
    "-", it("關閉分頁", "closeActive", "Alt-W"), it("關閉其他分頁", "closeOthers"), it("關閉右側所有分頁", "closeRight"), it("全部關閉", "closeAll") ] },
  { label:"編輯", items: () => [
    it("復原", "undo", "Mod-Z"), it("重做", "redo", "Mod-Shift-Z"), it("全選", "selectAll", "Mod-A"),
    "-", it("複製目前這行", "dup", "Mod-D"), it("刪除目前這行", "delLine", "Mod-Shift-K"),
    it("上移一行", "up", "Alt-ArrowUp"), it("下移一行", "down", "Alt-ArrowDown"), it("合併行", "join", "Mod-J"),
    "-", it("欄編輯器…", "columnEditor", "Alt-C"), it("自動完成單字", "complete", "Mod-Enter"),
    "-", it("轉為大寫", "upper", "Mod-Shift-U"), it("轉為小寫", "lower", "Mod-U"), it("字首大寫", "title"), it("大小寫互換", "invert"),
    "-", it("切換行註解", "comment", "Mod-/"), it("增加縮排", "indent", "Tab"), it("減少縮排", "outdent", "Shift-Tab"),
    "#行處理（有多行選取時只處理選取範圍）",
    it("排序：遞增（依字元碼）", "sortAsc"), it("排序：遞減（依字元碼）", "sortDesc"), it("排序：不分大小寫", "sortCi"), it("排序：自然順序（數字依大小）", "sortNat"), it("排序：依長度", "sortLen"), it("反轉行序", "reverse"),
    it("移除重複行", "dedupe"), it("移除連續重複行", "dedupeAdj"), it("移除空行（含只有空白的行）", "noEmpty"),
    it("刪除行首空白", "trimStart"), it("刪除行尾空白", "trimEnd"), it("刪除行首與行尾空白", "trimBoth"), it("行尾換成空白（合併成一行）", "eolToSpace"),
    it("Tab 轉空白", "tabs2sp"), it("行首空白轉 Tab", "sp2tabs"),
    "-", it("插入日期時間", "timestamp") ] },
  { label:"搜尋", items: () => [
    it("尋找…", "find", "Mod-F"), it("取代…", "replace", isMac ? "Mod-Alt-F" : "Mod-H"), it("在檔案中尋找…", "findInFiles", "Mod-Shift-F"),
    it("找下一個", "next", isMac ? "Mod-G" : "F3"), it("找上一個", "prev", isMac ? "Mod-Shift-G" : "Shift-F3"),
    "-", it("跳至行…", "gotoLine", isMac ? "Ctrl-G" : "Mod-G"), it("顯示 / 隱藏搜尋結果", "toggleResults"),
    "#書籤", it("切換書籤", "bmToggle", "Mod-F2"), it("下一個書籤", "bmNext", "F2"), it("上一個書籤", "bmPrev", "Shift-F2"), it("清除所有書籤", "bmClear"),
    it("剪下書籤行", "bmCut"), it("複製書籤行", "bmCopy"), it("刪除書籤行", "bmDelete"), it("刪除未加書籤的行", "bmKeepOnly"), it("反轉書籤", "bmInverse"),
    "-", { label:"清除所有標記", fn: clearMarks } ] },
  { label:"檢視", items: () => [
    it("自動換行", "toggleWrap", "Alt-Z", { checked: settings.wrap }), it("顯示空白與行尾", "toggleWs", null, { checked: settings.ws }), it("顯示行號", "toggleLineNumbers", null, { checked: settings.lineNumbers }),
    "-", it("全部摺疊", "foldAll"), it("全部展開", "unfoldAll"),
    "-", it("Markdown 預覽", "mdPreview", isMac ? "Ctrl-Shift-M" : "Mod-Shift-M", { checked: md.open }), it("分割檢視", "toggleSplit", null, { checked: !$("#pane2").hidden }), it("同步捲動", "toggleSync", null, { checked: split.sync, disabled: $("#pane2").hidden }),
    "-", it("放大", "zoomIn", "Mod-="), it("縮小", "zoomOut", "Mod--"), it(`還原字級（目前 ${settings.fontSize}px）`, "zoomReset", "Mod-0"),
    "#主題", ...["system","light","dark"].map(th => ({ label: THEME_LABEL[th], checked: settings.theme === th, radio:true, fn: () => setSetting("theme", th) })) ] },
  { label:"編碼", items: () => { if (hexActive()) return ["!Hex 分頁不適用。文字欄的編碼請到「Hex」選單設定。"]; const t = curT(); return [
    "#以其他編碼重新開啟（重新解讀原始檔案）", ...ENCODINGS.map(([e, l]) => ({ label:l, disabled: !t.bytes, fn: () => reopenAs(e) })),
    "#存檔時使用的編碼（轉換為）", ...ENCODINGS.map(([e, l]) => ({ label:l, checked: normEnc(t.encoding) === e, radio:true, fn: () => A.convertTo(e) })),
    it("加上 BOM", "toggleBom", null, { checked: t.bom && bomCapable(normEnc(t.encoding)), disabled: !bomCapable(normEnc(t.encoding)) }),
    "#行尾格式", ...["CRLF","LF","CR"].map(k => ({ label: EOL_LABEL[k], checked: t.eol === k, radio:true, fn: () => A.setEol(k) })) ]; } },
  { label:"語言", cols:3, items: () => hexActive() ? ["!Hex 分頁不適用"] : LANGS.flatMap((l, i) => [
    ...(i === 0 || LANGS[i - 1].group !== l.group ? ["#" + l.group] : []),
    { label:l.label, checked: curT().langId === l.id, radio:true, fn: () => setLang(curT(), l.id) }]) },
  { label:"設定", items: () => [
    { label:"輸入時提示自動完成", checked: settings.autoComplete, fn: () => setSetting("autoComplete", !settings.autoComplete) },
    { label:"自動補上括號與引號", checked: settings.autoClose, fn: () => setSetting("autoClose", !settings.autoClose) },
    { label:"標示與選取相同的單字", checked: settings.smartHighlight, fn: () => setSetting("smartHighlight", !settings.smartHighlight) },
    it("用 Tab 字元縮排", "useTabs", null, { checked: settings.useTabs }),
    "#Tab 寬度", ...[2, 4, 8].map(n => ({ label: n + " 個空白", checked: settings.tabSize === n, radio:true, fn: () => setSetting("tabSize", n) })),
    "#工具列圖示", ...["color","mono"].map(k => ({ label: ICON_LABEL[k], checked: (settings.icons === "mono" ? "mono" : "color") === k, radio:true, fn: () => setSetting("icons", k) })),
    "#摺疊標記", ...["guides","chevrons"].map(k => ({ label: FOLD_LABEL[k], checked: (settings.foldStyle === "chevrons" ? "chevrons" : "guides") === k, radio:true, fn: () => setSetting("foldStyle", k) })) ] },
  { label:"工具", items: () => [
    it(cmp.on ? "結束比較" : "比較兩個分頁…", "compare"), it("下一個差異", "cmpNext", null, { disabled: !cmp.on }), it("上一個差異", "cmpPrev", null, { disabled: !cmp.on }),
    "-", it("JSON 格式化", "jsonFmt"), it("JSON 壓縮成一行", "jsonMin"),
    "-", it("Base64 編碼", "b64e"), it("Base64 解碼", "b64d"), it("URL 編碼", "urle"), it("URL 解碼", "urld"),
    "-", it("雜湊值（SHA-1 / SHA-256 / SHA-512）…", "hashes"), it("字數統計", "wordCount") ] },
  { label:"Hex", items: () => { const on = hexActive(), off = { disabled:!on }; return [
    it(isHex(cur()) ? "以文字檢視目前分頁" : "以 Hex 檢視目前分頁", "toggleHex", HEXKEY), it("以 Hex 開啟檔案…", "openHex"),
    "-", it("尋找 Hex 或文字", "find", "Mod-F", off), it("跳至位址…", "hexGoto", isMac ? "Ctrl-G" : "Mod-G", off), it("選取範圍…", "hexSelRange", null, off),
    it(on && hx.tab.hex.ins ? "切換為覆寫模式" : "切換為插入模式", "hexIns", "Insert", off),
    "#複製選取範圍為", it("Hex 字串（4D 5A 90 00）", "hexCopyHex", null, off), it("C / C++ 陣列", "hexCopyC", null, off), it("C# 陣列", "hexCopyCs", null, off), it("Base64", "hexCopyB64", null, off), it("文字", "hexCopyText", null, off),
    "#每列位元組", ...[8, 16, 32].map(n => ({ label: n + " 位元組", radio:true, checked: settings.hexCols === n, fn: () => hexSetCols(n) })),
    "#文字欄編碼", ...HEX_ENCS.map(([v, l]) => ({ label:l, radio:true, checked: settings.hexEnc === v, fn: () => hexSetEnc(v) })),
    "#數值解讀", { label:"顯示數值解讀面板", checked: settings.hexInsp, fn: () => hexSetInsp(!settings.hexInsp) },
    { label:"小端（Little-endian）", radio:true, checked: settings.hexLE, fn: () => hexSetLE(true) }, { label:"大端（Big-endian）", radio:true, checked: !settings.hexLE, fn: () => hexSetLE(false) } ]; } },
  { label:"巨集", items: () => [
    it(macro.rec ? "停止錄製" : "開始錄製", "macroRec", "Alt-Shift-R"), it("播放", "macroPlay", "Alt-Shift-P", { disabled: !settings.lastMacro }), it("執行多次…", "macroMulti"),
    it("儲存目前巨集…", "macroSave", null, { disabled: !settings.lastMacro }),
    "#已儲存的巨集", ...(settings.macros.length ? settings.macros.map(m => ({ label: m.name, fn: () => playMacro(m.name) })) : ["!尚未儲存任何巨集"]),
    ...(settings.macros.length ? ["#刪除巨集", ...settings.macros.map(m => ({ label: "刪除「" + m.name + "」", fn: () => { settings.macros = settings.macros.filter(x => x !== m); persistSoon(); toast("已刪除巨集"); } }))] : []) ] },
  { label:"視窗", items: () => [
    ...tabs.map((t, i) => ({ label: t.name + (isDirty(t) ? " •" : ""), checked: i === active, radio:true, key: i < 8 ? "Alt-" + (i + 1) : null, fn: () => activateTab(i) })),
    "-", it("說明", "help") ] }
];
let openMenuIdx = -1, hoverOpenedAt = 0;
function buildMenubar(){
  const bar = $("#menubar"); bar.replaceChildren();
  MENUS.forEach((m, i) => {
    const b = el("button", { class:"menu-btn", type:"button", text:m.label, "aria-haspopup":"menu", "aria-expanded":"false", id:"menuBtn" + i });
    b.addEventListener("mousedown", e => e.preventDefault());
    // Moving onto another menu while one is open switches to it; the click that follows must not close it again.
    b.addEventListener("click", e => { e.stopPropagation(); if (openMenuIdx === i && performance.now() - hoverOpenedAt > 500) closeMenu(); else openMenu(i); });
    b.addEventListener("mouseenter", () => { if (openMenuIdx >= 0 && openMenuIdx !== i){ openMenu(i); hoverOpenedAt = performance.now(); } });
    b.addEventListener("keydown", e => { if (e.key === "ArrowDown"){ e.preventDefault(); openMenu(i); } });
    bar.appendChild(b);
  });
}
function buildPop(items, navIdx){
  const pop = el("div", { class:"menu-pop", role:"menu" });
  items.forEach(x => {
    if (x === "-"){ pop.appendChild(el("div", { class:"menu-sep", role:"separator" })); return; }
    if (typeof x === "string" && x[0] === "#"){ if (pop.childElementCount) pop.appendChild(el("div", { class:"menu-sep" })); pop.appendChild(el("div", { class:"menu-group", text:x.slice(1) })); return; }
    if (typeof x === "string" && x[0] === "!"){ pop.appendChild(el("div", { class:"menu-empty", text:x.slice(1) })); return; }
    const b = el("button", { type:"button", class:"menu-item", role: x.checked !== undefined ? (x.radio ? "menuitemradio" : "menuitemcheckbox") : "menuitem" });
    if (x.checked !== undefined) b.setAttribute("aria-checked", String(!!x.checked));
    if (x.disabled) b.disabled = true;
    b.append(el("span", { class:"chk", text: x.checked ? (x.radio ? "●" : "✓") : "" }), el("span", { class:"lbl", text:x.label }), el("kbd", { text: x.key ? keyLabel(x.key) : "" }));
    b.addEventListener("click", e => { e.stopPropagation(); closeMenu(); focusEditor(); x.act ? run(x.act) : x.fn(); });
    pop.appendChild(b);
  });
  pop.addEventListener("keydown", e => {
    const items2 = [...pop.querySelectorAll(".menu-item:not([disabled])")]; const idx = items2.indexOf(document.activeElement);
    if (e.key === "ArrowDown"){ e.preventDefault(); items2[(idx + 1) % items2.length].focus(); }
    else if (e.key === "ArrowUp"){ e.preventDefault(); items2[(idx - 1 + items2.length) % items2.length].focus(); }
    else if (e.key === "ArrowRight" && navIdx != null){ e.preventDefault(); openMenu((navIdx + 1) % MENUS.length); }
    else if (e.key === "ArrowLeft" && navIdx != null){ e.preventDefault(); openMenu((navIdx - 1 + MENUS.length) % MENUS.length); }
    else if (e.key === "Escape"){ e.preventDefault(); closeMenu(); (navIdx != null ? $("#menuBtn" + navIdx) : cm).focus(); }
  });
  return pop;
}
function placePop(pop, x, y, dropdown){
  if (dropdown) pop.style.maxHeight = Math.max(160, window.innerHeight - y - 8) + "px";
  document.body.appendChild(pop);
  const r = pop.getBoundingClientRect();
  const left = Math.max(8, Math.min(x, window.innerWidth - 8 - r.width));
  const top = !dropdown && y + r.height > window.innerHeight - 8 ? Math.max(8, window.innerHeight - 8 - r.height) : y;
  pop.style.left = left + "px"; pop.style.top = top + "px";
  const first = pop.querySelector(".menu-item:not([disabled])"); first && first.focus({ preventScroll:true });
}
function openMenu(i){
  closeMenu();
  const btn = $("#menuBtn" + i); btn.scrollIntoView({ block:"nearest", inline:"nearest" });
  const pop = buildPop(MENUS[i].items(), i); pop.setAttribute("aria-labelledby", btn.id);
  if (MENUS[i].cols && pop.querySelector(".menu-item")){ pop.classList.add("menu-cols"); pop.style.columnCount = MENUS[i].cols; }
  const r = btn.getBoundingClientRect(); placePop(pop, r.left, r.bottom + 2, true);
  btn.setAttribute("aria-expanded", "true"); openMenuIdx = i;
}
function openTabMenu(t, x, y){
  closeMenu();
  const items = [
    { label:"關閉", fn: () => closeTab(tabs.indexOf(t)) }, { label:"關閉其他分頁", fn: () => closeOthers(t) }, { label:"關閉右側所有分頁", fn: () => closeRight(t) },
    "-", { label:"重新命名…", fn: () => renameTab(t) }, { label:"儲存", fn: () => saveTab(t) },
    { label:"複製檔名", fn: async () => toast((await copyText(t.name)) ? "已複製檔名" : "無法寫入剪貼簿") },
    ...(t.path ? [{ label:"複製完整路徑", fn: async () => toast((await copyText(t.path)) ? "已複製路徑" : "無法寫入剪貼簿") }] : []),
    "-", { label: isHex(t) ? "以文字檢視" : "以 Hex 檢視", fn: () => toggleHexView(t) },
    { label:"在第二檢視開啟", disabled: isHex(t), fn: () => { openSplit(t); cm2.focus(); } },
    { label:"與目前分頁比較", disabled: t === cur() || isHex(t) || isHex(cur()), fn: () => startCompare(t) }
  ];
  const pop = buildPop(items, null); placePop(pop, x, y); openMenuIdx = 99;
}
function closeMenu(){
  document.querySelectorAll(".menu-pop").forEach(p => p.remove());
  document.querySelectorAll(".menu-btn").forEach(b => b.setAttribute("aria-expanded", "false"));
  openMenuIdx = -1;
}
document.addEventListener("mousedown", e => { if (openMenuIdx >= 0 && !e.target.closest(".menu-pop, .menu-btn")) closeMenu(); });
window.addEventListener("resize", () => { if (openMenuIdx >= 0) closeMenu(); });

/* toolbar + status bar */
const TOOL_KEYS = { newTab:"Alt-N", openFile:"Mod-O", save:"Mod-S", closeActive:"Alt-W", undo:"Mod-Z", redo:"Mod-Shift-Z", find:"Mod-F", replace: isMac ? "Mod-Alt-F" : "Mod-H", findInFiles:"Mod-Shift-F", toggleWrap:"Alt-Z", zoomIn:"Mod-=", zoomOut:"Mod--", bmToggle:"Mod-F2", macroRec:"Alt-Shift-R", macroPlay:"Alt-Shift-P", mdPreview: isMac ? "Ctrl-Shift-M" : "Mod-Shift-M", toggleHex: isMac ? "Ctrl-Shift-H" : "Mod-Shift-H" };
document.querySelectorAll(".tool[data-act]").forEach(b => {
  const k = TOOL_KEYS[b.dataset.act]; if (k) b.title += "（" + keyLabel(k) + "）";
  b.addEventListener("mousedown", e => e.preventDefault());
  b.addEventListener("click", () => { run(b.dataset.act); if (!["find","replace","findInFiles","openFile","openHex","toggleHex","save","saveAll","compare","macroMulti","macroRec"].includes(b.dataset.act)) focusEditor(); });
});
const langSel = $("#stLang");
for (const l of LANGS){
  let g = langSel.lastElementChild;
  if (!g || g.label !== l.group){ g = el("optgroup"); g.label = l.group; langSel.appendChild(g); }
  g.appendChild(el("option", { value:l.id, text:l.label }));
}
langSel.addEventListener("change", () => { setLang(curT(), langSel.value); focusEditor(); });
$("#stEol").addEventListener("click", () => { const order = ["LF","CRLF","CR"]; A.setEol(order[(order.indexOf(curT().eol) + 1) % 3]); });
$("#stEnc").addEventListener("click", e => { e.stopPropagation(); openMenu(MENUS.findIndex(m => m.label === "編碼")); });

