/* ---------- menus ---------- */
const it = (label, act, key, extra) => Object.assign({ label, act, key }, extra || {});
const MENUS = [
  { label:tr("檔案"), items: () => [
    it(tr("新增分頁"), "newTab", "Alt-N"), it(tr("開啟…"), "openFile", "Mod-O"), it(tr("以 Hex 開啟…"), "openHex"),
    "-", it(tr("儲存"), "save", "Mod-S"), it(tr("另存新檔…"), "saveAs", "Mod-Shift-S"), it(tr("全部儲存"), "saveAll"), it(tr("重新命名…"), "rename"),
    "-", it(tr("關閉分頁"), "closeActive", "Alt-W"), it(tr("關閉其他分頁"), "closeOthers"), it(tr("關閉右側所有分頁"), "closeRight"), it(tr("全部關閉"), "closeAll") ] },
  { label:tr("編輯"), items: () => [
    it(tr("復原"), "undo", "Mod-Z"), it(tr("重做"), "redo", "Mod-Shift-Z"), it(tr("全選"), "selectAll", "Mod-A"),
    "-", it(tr("複製目前這行"), "dup", "Mod-D"), it(tr("刪除目前這行"), "delLine", "Mod-Shift-K"),
    it(tr("上移一行"), "up", "Alt-ArrowUp"), it(tr("下移一行"), "down", "Alt-ArrowDown"), it(tr("合併行"), "join", "Mod-J"),
    "-", it(tr("欄編輯器…"), "columnEditor", "Alt-C"), it(tr("自動完成單字"), "complete", "Mod-Enter"),
    "-", it(tr("轉為大寫"), "upper", "Mod-Shift-U"), it(tr("轉為小寫"), "lower", "Mod-U"), it(tr("字首大寫"), "title"), it(tr("大小寫互換"), "invert"),
    "-", it(tr("切換行註解"), "comment", "Mod-/"), it(tr("增加縮排"), "indent", "Tab"), it(tr("減少縮排"), "outdent", "Shift-Tab"),
    "#" + tr("行處理（有多行選取時只處理選取範圍）"),
    it(tr("排序：遞增（依字元碼）"), "sortAsc"), it(tr("排序：遞減（依字元碼）"), "sortDesc"), it(tr("排序：不分大小寫"), "sortCi"), it(tr("排序：自然順序（數字依大小）"), "sortNat"), it(tr("排序：依長度"), "sortLen"), it(tr("反轉行序"), "reverse"),
    it(tr("移除重複行"), "dedupe"), it(tr("移除連續重複行"), "dedupeAdj"), it(tr("移除空行（含只有空白的行）"), "noEmpty"),
    it(tr("刪除行首空白"), "trimStart"), it(tr("刪除行尾空白"), "trimEnd"), it(tr("刪除行首與行尾空白"), "trimBoth"), it(tr("行尾換成空白（合併成一行）"), "eolToSpace"),
    it(tr("Tab 轉空白"), "tabs2sp"), it(tr("行首空白轉 Tab"), "sp2tabs"),
    "-", it(tr("插入日期時間"), "timestamp") ] },
  { label:tr("搜尋"), items: () => [
    it(tr("尋找…"), "find", "Mod-F"), it(tr("取代…"), "replace", isMac ? "Mod-Alt-F" : "Mod-H"), it(tr("在檔案中尋找…"), "findInFiles", "Mod-Shift-F"),
    it(tr("找下一個"), "next", isMac ? "Mod-G" : "F3"), it(tr("找上一個"), "prev", isMac ? "Mod-Shift-G" : "Shift-F3"),
    "-", it(tr("跳至行…"), "gotoLine", isMac ? "Ctrl-G" : "Mod-G"), it(tr("顯示 / 隱藏搜尋結果"), "toggleResults"),
    "#" + tr("書籤"), it(tr("切換書籤"), "bmToggle", "Mod-F2"), it(tr("下一個書籤"), "bmNext", "F2"), it(tr("上一個書籤"), "bmPrev", "Shift-F2"), it(tr("清除所有書籤"), "bmClear"),
    it(tr("剪下書籤行"), "bmCut"), it(tr("複製書籤行"), "bmCopy"), it(tr("刪除書籤行"), "bmDelete"), it(tr("刪除未加書籤的行"), "bmKeepOnly"), it(tr("反轉書籤"), "bmInverse"),
    "-", { label:tr("清除所有標記"), fn: clearMarks } ] },
  { label:tr("檢視"), items: () => [
    it(tr("自動換行"), "toggleWrap", "Alt-Z", { checked: settings.wrap }), it(tr("顯示空白與行尾"), "toggleWs", null, { checked: settings.ws }), it(tr("顯示行號"), "toggleLineNumbers", null, { checked: settings.lineNumbers }),
    "-", it(tr("全部摺疊"), "foldAll"), it(tr("全部展開"), "unfoldAll"),
    "-", it(tr("Markdown 預覽"), "mdPreview", isMac ? "Ctrl-Shift-M" : "Mod-Shift-M", { checked: md.open }), it(tr("分割檢視"), "toggleSplit", null, { checked: !$("#pane2").hidden }), it(tr("同步捲動"), "toggleSync", null, { checked: split.sync, disabled: $("#pane2").hidden }),
    "-", it(tr("放大"), "zoomIn", "Mod-="), it(tr("縮小"), "zoomOut", "Mod--"), it(tr("還原字級（目前 {n}px）", { n:settings.fontSize }), "zoomReset", "Mod-0"),
    "#" + tr("主題"), ...["system","light","dark"].map(th => ({ label: THEME_LABEL[th], checked: settings.theme === th, radio:true, fn: () => setSetting("theme", th) })) ] },
  { label:tr("編碼"), items: () => { if (hexActive()) return ["!" + tr("Hex 分頁不適用。文字欄的編碼請到「Hex」選單設定。")]; const t = curT(); return [
    "#" + tr("以其他編碼重新開啟（重新解讀原始檔案）"), ...ENCODINGS.map(([e, l]) => ({ label:l, disabled: !t.bytes, fn: () => reopenAs(e) })),
    "#" + tr("存檔時使用的編碼（轉換為）"), ...ENCODINGS.map(([e, l]) => ({ label:l, checked: normEnc(t.encoding) === e, radio:true, fn: () => A.convertTo(e) })),
    it(tr("加上 BOM"), "toggleBom", null, { checked: t.bom && bomCapable(normEnc(t.encoding)), disabled: !bomCapable(normEnc(t.encoding)) }),
    "#" + tr("行尾格式"), ...["CRLF","LF","CR"].map(k => ({ label: EOL_LABEL[k], checked: t.eol === k, radio:true, fn: () => A.setEol(k) })) ]; } },
  { label:tr("語言"), cols:3, items: () => hexActive() ? ["!" + tr("Hex 分頁不適用")] : LANGS.flatMap((l, i) => [
    ...(i === 0 || LANGS[i - 1].group !== l.group ? ["#" + l.group] : []),
    { label:l.label, checked: curT().langId === l.id, radio:true, fn: () => setLang(curT(), l.id) }]) },
  { label:tr("設定"), items: () => [
    "#" + tr("介面語言"), { label: tr("跟隨系統（{name}）", { name: uiLocales().find(l => l.id === systemLocale()).name }), checked: (settings.uiLang || "auto") === "auto", radio:true, fn: () => setUiLang("auto") },
    ...uiLocales().map(l => ({ label: l.name, checked: settings.uiLang === l.id, radio:true, fn: () => setUiLang(l.id) })),
    "-",
    { label:tr("輸入時提示自動完成"), checked: settings.autoComplete, fn: () => setSetting("autoComplete", !settings.autoComplete) },
    { label:tr("自動補上括號與引號"), checked: settings.autoClose, fn: () => setSetting("autoClose", !settings.autoClose) },
    { label:tr("標示與選取相同的單字"), checked: settings.smartHighlight, fn: () => setSetting("smartHighlight", !settings.smartHighlight) },
    it(tr("用 Tab 字元縮排"), "useTabs", null, { checked: settings.useTabs }),
    "#" + tr("Tab 寬度"), ...[2, 4, 8].map(n => ({ label: tr("{n} 個空白", { n }), checked: settings.tabSize === n, radio:true, fn: () => setSetting("tabSize", n) })),
    "#" + tr("工具列圖示"), ...["color","mono"].map(k => ({ label: ICON_LABEL[k], checked: (settings.icons === "mono" ? "mono" : "color") === k, radio:true, fn: () => setSetting("icons", k) })),
    "#" + tr("摺疊標記"), ...["guides","chevrons"].map(k => ({ label: FOLD_LABEL[k], checked: (settings.foldStyle === "chevrons" ? "chevrons" : "guides") === k, radio:true, fn: () => setSetting("foldStyle", k) })) ] },
  { label:tr("工具"), items: () => [
    it(cmp.on ? tr("結束比較") : tr("比較兩個分頁…"), "compare"), it(tr("下一個差異"), "cmpNext", null, { disabled: !cmp.on }), it(tr("上一個差異"), "cmpPrev", null, { disabled: !cmp.on }),
    "-", it(tr("JSON 格式化"), "jsonFmt"), it(tr("JSON 壓縮成一行"), "jsonMin"),
    "-", it(tr("Base64 編碼"), "b64e"), it(tr("Base64 解碼"), "b64d"), it(tr("URL 編碼"), "urle"), it(tr("URL 解碼"), "urld"),
    "-", it(tr("雜湊值（SHA-1 / SHA-256 / SHA-512）…"), "hashes"), it(tr("字數統計"), "wordCount") ] },
  { label:"Hex", items: () => { const on = hexActive(), off = { disabled:!on }; return [
    it(isHex(cur()) ? tr("以文字檢視目前分頁") : tr("以 Hex 檢視目前分頁"), "toggleHex", HEXKEY), it(tr("以 Hex 開啟檔案…"), "openHex"),
    "-", it(tr("尋找 Hex 或文字"), "find", "Mod-F", off), it(tr("跳至位址…"), "hexGoto", isMac ? "Ctrl-G" : "Mod-G", off), it(tr("選取範圍…"), "hexSelRange", null, off),
    it(on && hx.tab.hex.ins ? tr("切換為覆寫模式") : tr("切換為插入模式"), "hexIns", "Insert", off),
    "#" + tr("複製選取範圍為"), it(tr("Hex 字串（4D 5A 90 00）"), "hexCopyHex", null, off), it(tr("C / C++ 陣列"), "hexCopyC", null, off), it(tr("C# 陣列"), "hexCopyCs", null, off), it("Base64", "hexCopyB64", null, off), it(tr("文字"), "hexCopyText", null, off),
    "#" + tr("每列位元組"), ...[8, 16, 32].map(n => ({ label: tr("{n} 位元組", { n }), radio:true, checked: settings.hexCols === n, fn: () => hexSetCols(n) })),
    "#" + tr("文字欄編碼"), ...HEX_ENCS.map(([v, l]) => ({ label:l, radio:true, checked: settings.hexEnc === v, fn: () => hexSetEnc(v) })),
    "#" + tr("數值解讀"), { label:tr("顯示數值解讀面板"), checked: settings.hexInsp, fn: () => hexSetInsp(!settings.hexInsp) },
    { label:tr("小端（Little-endian）"), radio:true, checked: settings.hexLE, fn: () => hexSetLE(true) }, { label:tr("大端（Big-endian）"), radio:true, checked: !settings.hexLE, fn: () => hexSetLE(false) } ]; } },
  { label:tr("巨集"), items: () => [
    it(macro.rec ? tr("停止錄製") : tr("開始錄製"), "macroRec", "Alt-Shift-R"), it(tr("播放"), "macroPlay", "Alt-Shift-P", { disabled: !settings.lastMacro }), it(tr("執行多次…"), "macroMulti"),
    it(tr("儲存目前巨集…"), "macroSave", null, { disabled: !settings.lastMacro }),
    "#" + tr("已儲存的巨集"), ...(settings.macros.length ? settings.macros.map(m => ({ label: m.name, fn: () => playMacro(m.name) })) : ["!" + tr("尚未儲存任何巨集")]),
    ...(settings.macros.length ? ["#" + tr("刪除巨集"), ...settings.macros.map(m => ({ label: tr("刪除「{name}」", { name:m.name }), fn: () => { settings.macros = settings.macros.filter(x => x !== m); persistSoon(); toast(tr("已刪除巨集")); } }))] : []) ] },
  { label:tr("視窗"), items: () => [
    ...tabs.map((t, i) => ({ label: t.name + (isDirty(t) ? " •" : ""), checked: i === active, radio:true, key: i < 8 ? "Alt-" + (i + 1) : null, fn: () => activateTab(i) })),
    "-", it(tr("說明"), "help") ] }
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
    { label:tr("關閉"), fn: () => closeTab(tabs.indexOf(t)) }, { label:tr("關閉其他分頁"), fn: () => closeOthers(t) }, { label:tr("關閉右側所有分頁"), fn: () => closeRight(t) },
    "-", { label:tr("重新命名…"), fn: () => renameTab(t) }, { label:tr("儲存"), fn: () => saveTab(t) },
    { label:tr("複製檔名"), fn: async () => toast((await copyText(t.name)) ? tr("已複製檔名") : tr("無法寫入剪貼簿")) },
    ...(t.path ? [{ label:tr("複製完整路徑"), fn: async () => toast((await copyText(t.path)) ? tr("已複製路徑") : tr("無法寫入剪貼簿")) }] : []),
    "-", { label: isHex(t) ? tr("以文字檢視") : tr("以 Hex 檢視"), fn: () => toggleHexView(t) },
    { label:tr("在第二檢視開啟"), disabled: isHex(t), fn: () => { openSplit(t); cm2.focus(); } },
    { label:tr("與目前分頁比較"), disabled: t === cur() || isHex(t) || isHex(cur()), fn: () => startCompare(t) }
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
  const k = TOOL_KEYS[b.dataset.act]; if (k) b.title += tr("（{key}）", { key:keyLabel(k) });
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
$("#stEnc").addEventListener("click", e => { e.stopPropagation(); openMenu(MENUS.findIndex(m => m.label === tr("編碼"))); });

