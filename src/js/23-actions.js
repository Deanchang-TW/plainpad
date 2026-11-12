/* ---------- actions ---------- */
const lineOp = (fn, label) => () => transformLines(fn, label);
const A = {
  newTab, openFile, save: () => saveTab(curT()), saveAs: () => saveTab(curT(), true), saveAll, rename: () => renameTab(), closeActive: () => closeTab(active), closeOthers: () => closeOthers(), closeRight: () => closeRight(), closeAll,
  undo: () => { cm.undo(); focusEditor(); }, redo: () => { cm.redo(); focusEditor(); },
  find: () => openFind("find"), replace: () => openFind("replace"), findInFiles: () => openFind("files"), next: () => findNext(1), prev: () => findNext(-1), gotoLine,
  toggleResults: () => { if (!$("#results").hidden) $("#resClose").click(); else if (lastResults) showResults(lastResults.title, lastResults.groups); else toast(tr("還沒有搜尋結果")); },
  toggleWrap: () => setSetting("wrap", !settings.wrap), toggleWs: () => setSetting("ws", !settings.ws), toggleLineNumbers: () => setSetting("lineNumbers", !settings.lineNumbers),
  zoomIn: () => setSetting("fontSize", Math.min(32, settings.fontSize + 1)), zoomOut: () => setSetting("fontSize", Math.max(9, settings.fontSize - 1)), zoomReset: () => setSetting("fontSize", 14),
  cycleTheme: () => { const order = ["system","light","dark"]; const n = order[(order.indexOf(settings.theme) + 1) % 3]; setSetting("theme", n); toast(tr("主題：{name}", { name:THEME_LABEL[n] })); },
  toggleSplit: () => $("#pane2").hidden ? openSplit(cur()) : closeSplit(),
  toggleSync: () => { if ($("#pane2").hidden){ toast(tr("先打開分割檢視")); return; } setSync(!split.sync); },
  compare: () => cmp.on ? endCompare() : compareDialog(), cmpNext: () => cmpJump(1), cmpPrev: () => cmpJump(-1),
  dup: duplicateLine, delLine: () => cm.execCommand("deleteLine"), up: () => moveLines(-1), down: () => moveLines(1), join: joinLines,
  upper: () => caseOp(s => s.toUpperCase()), lower: () => caseOp(s => s.toLowerCase()), title: () => caseOp(toTitle), invert: () => caseOp(s => [...s].map(c => c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase()).join("")),
  comment: toggleComment, indent: () => cm.execCommand("indentMore"), outdent: () => cm.execCommand("indentLess"),
  sortAsc: lineOp(l => l.slice().sort((a, b) => a < b ? -1 : a > b ? 1 : 0), tr("遞增排序")),
  sortDesc: lineOp(l => l.slice().sort((a, b) => a < b ? 1 : a > b ? -1 : 0), tr("遞減排序")),
  sortCi: lineOp(l => l.slice().sort((a, b) => { const x = a.toLowerCase(), y = b.toLowerCase(); return x < y ? -1 : x > y ? 1 : 0; }), tr("不分大小寫排序")),
  sortNat: lineOp(l => l.slice().sort((a, b) => a.localeCompare(b, "zh-Hant", { numeric:true, sensitivity:"base" })), tr("自然排序")),
  sortLen: lineOp(l => l.slice().sort((a, b) => a.length - b.length), tr("依長度排序")),
  reverse: lineOp(l => l.slice().reverse(), tr("反轉行序")),
  dedupe: lineOp(l => { const s = new Set(); return l.filter(x => s.has(x) ? false : (s.add(x), true)); }, tr("移除重複行")),
  dedupeAdj: lineOp(l => l.filter((x, i) => i === 0 || x !== l[i - 1]), tr("移除連續重複行")),
  noEmpty: lineOp(l => l.filter(x => x.trim() !== ""), tr("移除空行")),
  trimEnd: lineOp(l => l.map(x => x.replace(/[ \t]+$/, "")), tr("刪除行尾空白")),
  trimStart: lineOp(l => l.map(x => x.replace(/^[ \t]+/, "")), tr("刪除行首空白")),
  trimBoth: lineOp(l => l.map(x => x.trim()), tr("刪除行首與行尾空白")),
  eolToSpace: lineOp(l => [l.join(" ")], tr("行尾換成空白")),
  tabs2sp: lineOp(l => l.map(x => expandTabs(x, settings.tabSize)), tr("Tab 轉空白")),
  sp2tabs: lineOp(l => l.map(x => x.replace(/^ +/, s => "\t".repeat(Math.floor(s.length / settings.tabSize)) + " ".repeat(s.length % settings.tabSize))), tr("行首空白轉 Tab")),
  timestamp: insertTimestamp, selectAll: () => { focusEditor(); cm.execCommand("selectAll"); },
  columnEditor, complete: () => complete(cm),
  useTabs: () => setSetting("useTabs", !settings.useTabs),
  jsonFmt: () => applyText(s => JSON.stringify(JSON.parse(s), null, settings.useTabs ? "\t" : settings.tabSize), tr("JSON 格式化"), "json"),
  jsonMin: () => applyText(s => JSON.stringify(JSON.parse(s)), tr("JSON 壓縮"), "json"),
  b64e: () => applyText(b64enc, tr("Base64 編碼")), b64d: () => applyText(b64dec, tr("Base64 解碼")),
  urle: () => applyText(encodeURIComponent, tr("URL 編碼")), urld: () => applyText(s => decodeURIComponent(s.replace(/\+/g, " ")), tr("URL 解碼")),
  hashes, wordCount, foldAll: () => foldAllBlocks(cm), unfoldAll: () => cm.execCommand("unfoldAll"),
  bmToggle, bmNext: () => bmJump(1), bmPrev: () => bmJump(-1), bmClear, bmInverse, bmCopy: () => bmCopy(false), bmCut: () => bmCopy(true), bmDelete: () => bmDelete(), bmKeepOnly,
  macroRec, macroPlay: () => playMacro(null), macroMulti, macroSave,
  help: openHelp, mdPreview: () => toggleMd(),
  openHex: () => { const fi = $("#hexFileInput"); fi.value = ""; fi.click(); }, toggleHex: () => toggleHexView(),
  hexGoto: () => hexGoto(), hexSelRange: () => hexSelRange(), hexIns: () => hexToggleIns(),
  hexCopyHex: () => hexCopyAs("hex"), hexCopyC: () => hexCopyAs("c"), hexCopyCs: () => hexCopyAs("cs"), hexCopyB64: () => hexCopyAs("b64"), hexCopyText: () => hexCopyAs("text"),
  convertTo: enc => { const t = curT(); if (normEnc(t.encoding) === enc) return; t.encoding = enc; if (!bomCapable(enc)) t.bom = false; else if (enc !== "utf-8") t.bom = true; t.forceDirty = true; renderTabs(); updateStatus(); persistSoon();
    const e = encodeText(t.doc.getValue(), enc, false); toast(tr("存檔時會使用 {enc}", { enc:ENC_LABEL[enc] }) + (e.badCount ? tr("；有 {n} 個字元無法表示，存檔時會再詢問", { n:fmtNum(e.badCount) }) : "")); },
  toggleBom: () => { const t = curT(); if (!bomCapable(normEnc(t.encoding))) return; t.bom = !t.bom; t.forceDirty = true; renderTabs(); updateStatus(); persistSoon(); },
  setEol: eol => { const t = curT(); if (t.eol === eol) return; t.eol = eol; t.forceDirty = true; renderTabs(); updateStatus(); persistSoon(); toast(tr("儲存時行尾會使用 {eol}", { eol:EOL_LABEL[eol] })); }
};
const HEX_ROUTE = { undo:() => hexUndo(), redo:() => hexRedo(), find:() => hexFocusFind(), next:() => hexFindNext(1), prev:() => hexFindNext(-1), gotoLine:() => hexGoto(), selectAll:() => hexSelectAll(),
  replace:() => { hexFocusFind(); toast(tr("Hex 檢視沒有取代功能：找到後直接輸入或貼上，就會覆蓋選取的位元組")); } };
const HEX_OK = new Set(["newTab","openFile","openHex","save","saveAs","saveAll","rename","closeActive","closeOthers","closeRight","closeAll","findInFiles","toggleResults","zoomIn","zoomOut","zoomReset","cycleTheme","toggleSplit","toggleSync","mdPreview","help","toggleHex","hexGoto","hexSelRange","hexIns","hexCopyHex","hexCopyC","hexCopyCs","hexCopyB64","hexCopyText"]);
function run(name){
  const f = A[name]; if (!f) return;
  if (hexActive()){ if (HEX_ROUTE[name]){ HEX_ROUTE[name](); return; } if (!HEX_OK.has(name)){ toast(tr("Hex 檢視不支援這個功能，請先切回文字檢視")); return; } }
  else if (/^hex[A-Z]/.test(name)){ toast(tr("這個功能只能在 Hex 檢視使用")); return; }
  if (RECORDABLE.has(name)) recPush({ a:name }); f();
}

