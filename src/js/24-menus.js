/* ---------- menus ---------- */
const it = (label, act, key, extra) => Object.assign({ label, act, key }, extra || {});
const MENUS = [
  { label:tr("File"), items: () => [
    it(tr("New tab"), "newTab", "Alt-N"), it(tr("Open…"), "openFile", "Mod-O"), it(tr("Open in Hex…"), "openHex"),
    "-", it(tr("Save"), "save", "Mod-S"), it(tr("Save As…"), "saveAs", "Mod-Shift-S"), it(tr("Save All"), "saveAll"), it(tr("Rename…"), "rename"),
    "-", it(tr("Close Tab"), "closeActive", "Alt-W"), it(tr("Close Other Tabs"), "closeOthers"), it(tr("Close Tabs to the Right"), "closeRight"), it(tr("Close All"), "closeAll") ] },
  { label:tr("Edit"), items: () => [
    it(tr("Undo"), "undo", "Mod-Z"), it(tr("Redo"), "redo", "Mod-Shift-Z"), it(tr("Select All"), "selectAll", "Mod-A"),
    "-", it(tr("Duplicate Line"), "dup", "Mod-D"), it(tr("Delete Line"), "delLine", "Mod-Shift-K"),
    it(tr("Move Line Up"), "up", "Alt-ArrowUp"), it(tr("Move Line Down"), "down", "Alt-ArrowDown"), it(tr("Join Lines"), "join", "Mod-J"),
    "-", it(tr("Column Editor…"), "columnEditor", "Alt-C"), it(tr("Complete Word"), "complete", "Mod-Enter"),
    "-", it(tr("UPPERCASE"), "upper", "Mod-Shift-U"), it(tr("lowercase"), "lower", "Mod-U"), it(tr("Title Case"), "title"), it(tr("Swap Case"), "invert"),
    "-", it(tr("Toggle Line Comment"), "comment", "Mod-/"), it(tr("Indent"), "indent", "Tab"), it(tr("Outdent"), "outdent", "Shift-Tab"),
    "#" + tr("Lines (only the selection when several lines are selected)"),
    it(tr("Sort: Ascending (by code point)"), "sortAsc"), it(tr("Sort: Descending (by code point)"), "sortDesc"), it(tr("Sort: Ignoring Case"), "sortCi"), it(tr("Sort: Natural (numbers by value)"), "sortNat"), it(tr("Sort: By Length"), "sortLen"), it(tr("Reverse lines"), "reverse"),
    it(tr("Remove duplicate lines"), "dedupe"), it(tr("Remove consecutive duplicates"), "dedupeAdj"), it(tr("Remove Empty Lines (including blank ones)"), "noEmpty"),
    it(tr("Trim leading spaces"), "trimStart"), it(tr("Trim trailing spaces"), "trimEnd"), it(tr("Trim leading and trailing spaces"), "trimBoth"), it(tr("Join Lines with Spaces"), "eolToSpace"),
    it(tr("Tabs to spaces"), "tabs2sp"), it(tr("Leading spaces to tabs"), "sp2tabs"),
    "-", it(tr("Insert Date and Time"), "timestamp") ] },
  { label:tr("Search"), items: () => [
    it(tr("Find…"), "find", "Mod-F"), it(tr("Replace…"), "replace", isMac ? "Mod-Alt-F" : "Mod-H"), it(tr("Find in Files…"), "findInFiles", "Mod-Shift-F"),
    it(tr("Find Next"), "next", isMac ? "Mod-G" : "F3"), it(tr("Find Previous"), "prev", isMac ? "Mod-Shift-G" : "Shift-F3"),
    "-", it(tr("Go to Line…"), "gotoLine", isMac ? "Ctrl-G" : "Mod-G"), it(tr("Show / Hide Search Results"), "toggleResults"),
    "#" + tr("Bookmarks"), it(tr("Toggle Bookmark"), "bmToggle", "Mod-F2"), it(tr("Next Bookmark"), "bmNext", "F2"), it(tr("Previous Bookmark"), "bmPrev", "Shift-F2"), it(tr("Clear All Bookmarks"), "bmClear"),
    it(tr("Cut Bookmarked Lines"), "bmCut"), it(tr("Copy Bookmarked Lines"), "bmCopy"), it(tr("Delete Bookmarked Lines"), "bmDelete"), it(tr("Delete Unbookmarked Lines"), "bmKeepOnly"), it(tr("Invert Bookmarks"), "bmInverse"),
    "-", { label:tr("Clear All Marks"), fn: clearMarks } ] },
  { label:tr("View"), items: () => [
    it(tr("Word Wrap"), "toggleWrap", "Alt-Z", { checked: settings.wrap }), it(tr("Show Whitespace and Line Endings"), "toggleWs", null, { checked: settings.ws }), it(tr("Show Line Numbers"), "toggleLineNumbers", null, { checked: settings.lineNumbers }),
    "-", it(tr("Fold All"), "foldAll"), it(tr("Expand All"), "unfoldAll"),
    "-", it(tr("Markdown Preview"), "mdPreview", isMac ? "Ctrl-Shift-M" : "Mod-Shift-M", { checked: md.open }), it(tr("Split View"), "toggleSplit", null, { checked: !$("#pane2").hidden }), it(tr("Sync Scrolling"), "toggleSync", null, { checked: split.sync, disabled: $("#pane2").hidden }),
    "-", it(tr("Zoom In"), "zoomIn", "Mod-="), it(tr("Zoom Out"), "zoomOut", "Mod--"), it(tr("Reset Zoom (now {n}px)", { n:settings.fontSize }), "zoomReset", "Mod-0"),
    "#" + tr("Theme"), ...["system","light","dark"].map(th => ({ label: THEME_LABEL[th], checked: settings.theme === th, radio:true, fn: () => setSetting("theme", th) })) ] },
  { label:tr("Encoding"), items: () => { if (hexActive()) return ["!" + tr("Not for Hex tabs. Set the text column's encoding in the Hex menu.")]; const t = curT(); return [
    "#" + tr("Reopen with Encoding (reinterpret the original file)"), ...ENCODINGS.map(([e, l]) => ({ label:l, disabled: !t.bytes, fn: () => reopenAs(e) })),
    "#" + tr("Save with Encoding (convert to)"), ...ENCODINGS.map(([e, l]) => ({ label:l, checked: normEnc(t.encoding) === e, radio:true, fn: () => A.convertTo(e) })),
    it(tr("Add BOM"), "toggleBom", null, { checked: t.bom && bomCapable(normEnc(t.encoding)), disabled: !bomCapable(normEnc(t.encoding)) }),
    "#" + tr("Line Endings"), ...["CRLF","LF","CR"].map(k => ({ label: EOL_LABEL[k], checked: t.eol === k, radio:true, fn: () => A.setEol(k) })) ]; } },
  { label:tr("Language"), cols:3, items: () => hexActive() ? ["!" + tr("Not for Hex tabs")] : LANGS.flatMap((l, i) => [
    ...(i === 0 || LANGS[i - 1].group !== l.group ? ["#" + l.group] : []),
    { label:l.label, checked: curT().langId === l.id, radio:true, fn: () => setLang(curT(), l.id) }]) },
  { label:tr("Settings"), items: () => [
    "#" + tr("Interface Language"), { label: tr("Match system ({name})", { name: uiLocales().find(l => l.id === systemLocale()).name }), checked: (settings.uiLang || "auto") === "auto", radio:true, fn: () => setUiLang("auto") },
    ...uiLocales().map(l => ({ label: l.name, checked: settings.uiLang === l.id, radio:true, fn: () => setUiLang(l.id) })),
    "-",
    { label:tr("Suggest Completions While Typing"), checked: settings.autoComplete, fn: () => setSetting("autoComplete", !settings.autoComplete) },
    { label:tr("Auto-Close Brackets and Quotes"), checked: settings.autoClose, fn: () => setSetting("autoClose", !settings.autoClose) },
    { label:tr("Highlight Matching Words"), checked: settings.smartHighlight, fn: () => setSetting("smartHighlight", !settings.smartHighlight) },
    it(tr("Indent with Tabs"), "useTabs", null, { checked: settings.useTabs }),
    "#" + tr("Tab Width"), ...[2, 4, 8].map(n => ({ label: tr("{n} spaces", { n }), checked: settings.tabSize === n, radio:true, fn: () => setSetting("tabSize", n) })),
    "#" + tr("Toolbar Icons"), ...["color","mono"].map(k => ({ label: ICON_LABEL[k], checked: (settings.icons === "mono" ? "mono" : "color") === k, radio:true, fn: () => setSetting("icons", k) })),
    "#" + tr("Fold Markers"), ...["guides","chevrons"].map(k => ({ label: FOLD_LABEL[k], checked: (settings.foldStyle === "chevrons" ? "chevrons" : "guides") === k, radio:true, fn: () => setSetting("foldStyle", k) })) ] },
  { label:tr("Tools"), items: () => [
    it(cmp.on ? tr("End Compare") : tr("Compare Two Tabs…"), "compare"), it(tr("Next Difference"), "cmpNext", null, { disabled: !cmp.on }), it(tr("Previous Difference"), "cmpPrev", null, { disabled: !cmp.on }),
    "-", it(tr("Format JSON"), "jsonFmt"), it(tr("Minify JSON to One Line"), "jsonMin"),
    "-", it(tr("Base64 encode"), "b64e"), it(tr("Base64 decode"), "b64d"), it(tr("URL encode"), "urle"), it(tr("URL decode"), "urld"),
    "-", it(tr("Hashes (SHA-1 / SHA-256 / SHA-512)…"), "hashes"), it(tr("Word Count"), "wordCount") ] },
  { label:"Hex", items: () => { const on = hexActive(), off = { disabled:!on }; return [
    it(isHex(cur()) ? tr("View Current Tab as Text") : tr("View Current Tab in Hex"), "toggleHex", HEXKEY), it(tr("Open File in Hex…"), "openHex"),
    "-", it(tr("Find Hex or Text"), "find", "Mod-F", off), it(tr("Go to Offset…"), "hexGoto", isMac ? "Ctrl-G" : "Mod-G", off), it(tr("Select Range…"), "hexSelRange", null, off),
    it(on && hx.tab.hex.ins ? tr("Switch to Overwrite Mode") : tr("Switch to Insert Mode"), "hexIns", "Insert", off),
    "#" + tr("Copy Selection As"), it(tr("Hex String (4D 5A 90 00)"), "hexCopyHex", null, off), it(tr("C / C++ Array"), "hexCopyC", null, off), it(tr("C# Array"), "hexCopyCs", null, off), it("Base64", "hexCopyB64", null, off), it(tr("Text"), "hexCopyText", null, off),
    "#" + tr("Bytes per Row"), ...[8, 16, 32].map(n => ({ label: tr("{n} bytes", { n }), radio:true, checked: settings.hexCols === n, fn: () => hexSetCols(n) })),
    "#" + tr("Text Column Encoding"), ...HEX_ENCS.map(([v, l]) => ({ label:l, radio:true, checked: settings.hexEnc === v, fn: () => hexSetEnc(v) })),
    "#" + tr("Data Inspector"), { label:tr("Show Data Inspector"), checked: settings.hexInsp, fn: () => hexSetInsp(!settings.hexInsp) },
    { label:tr("Little-endian"), radio:true, checked: settings.hexLE, fn: () => hexSetLE(true) }, { label:tr("Big-endian"), radio:true, checked: !settings.hexLE, fn: () => hexSetLE(false) } ]; } },
  { label:tr("Macro"), items: () => [
    it(macro.rec ? tr("Stop Recording") : tr("Start Recording"), "macroRec", "Alt-Shift-R"), it(tr("Play"), "macroPlay", "Alt-Shift-P", { disabled: !settings.lastMacro }), it(tr("Run Multiple Times…"), "macroMulti"),
    it(tr("Save Current Macro…"), "macroSave", null, { disabled: !settings.lastMacro }),
    "#" + tr("Saved Macros"), ...(settings.macros.length ? settings.macros.map(m => ({ label: m.name, fn: () => playMacro(m.name) })) : ["!" + tr("No saved macros")]),
    ...(settings.macros.length ? ["#" + tr("Delete Macro"), ...settings.macros.map(m => ({ label: tr("Delete “{name}”", { name:m.name }), fn: () => { settings.macros = settings.macros.filter(x => x !== m); persistSoon(); toast(tr("Macro deleted")); } }))] : []) ] },
  { label:tr("Window"), items: () => [
    ...tabs.map((t, i) => ({ label: t.name + (isDirty(t) ? " •" : ""), checked: i === active, radio:true, key: i < 8 ? "Alt-" + (i + 1) : null, fn: () => activateTab(i) })),
    "-", it(tr("Help"), "help") ] }
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
    { label:tr("Close"), fn: () => closeTab(tabs.indexOf(t)) }, { label:tr("Close Other Tabs"), fn: () => closeOthers(t) }, { label:tr("Close Tabs to the Right"), fn: () => closeRight(t) },
    "-", { label:tr("Rename…"), fn: () => renameTab(t) }, { label:tr("Save"), fn: () => saveTab(t) },
    { label:tr("Copy File Name"), fn: async () => toast((await copyText(t.name)) ? tr("Copied file name") : tr("Can't write to the clipboard")) },
    ...(t.path ? [{ label:tr("Copy Full Path"), fn: async () => toast((await copyText(t.path)) ? tr("Copied path") : tr("Can't write to the clipboard")) }] : []),
    "-", { label: isHex(t) ? tr("View as Text") : tr("View in Hex"), fn: () => toggleHexView(t) },
    { label:tr("Open in Second View"), disabled: isHex(t), fn: () => { openSplit(t); cm2.focus(); } },
    { label:tr("Compare with Current Tab"), disabled: t === cur() || isHex(t) || isHex(cur()), fn: () => startCompare(t) }
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
  const k = TOOL_KEYS[b.dataset.act]; if (k) b.title += tr(" ({key})", { key:keyLabel(k) });
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
$("#stEnc").addEventListener("click", e => { e.stopPropagation(); openMenu(MENUS.findIndex(m => m.label === tr("Encoding"))); });

