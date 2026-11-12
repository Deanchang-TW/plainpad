/* ---------- editors ---------- */
const wsOverlay = { name:"ws", token(stream){
  if (stream.eat(" ")){ while (stream.eat(" ")); return "ws"; }
  stream.next(); while (!stream.eol() && stream.peek() !== " ") stream.next(); return null; } };

function makeEditor(host){
  const ed = CodeMirror(host, {
    value:"", lineNumbers:true, gutters:[BM, "CodeMirror-linenumbers", FG],
    foldOptions:{ widget:"⋯" }, styleActiveLine:{ nonEmpty:false }, matchBrackets:true,
    highlightSelectionMatches:{ minChars:2, wordsOnly:true, delay:80 },
    tabSize:4, indentUnit:4, indentWithTabs:true, smartIndent:false, electricChars:false,
    lineWrapping:false, cursorScrollMargin:6, viewportMargin:20, spellcheck:false,
    extraKeys:{
      "Tab": c => { if (c.somethingSelected() && c.listSelections().some(r => r.anchor.line !== r.head.line)) c.indentSelection("add");
                    else c.replaceSelection(c.getOption("indentWithTabs") ? "\t" : " ".repeat(c.getOption("indentUnit")), "end"); },
      "Shift-Tab": "indentLess"
    }
  });
  ed.setSize("100%", "100%");
  return ed;
}
const cmMain = makeEditor($("#editor"));
const cm2 = makeEditor($("#editor2"));
let cm = cmMain;   // the editor that last had focus; commands act on it

function cur(){ return tabs[active]; }
function curT(){ return (cm === cm2 && split.tab && !$("#pane2").hidden) ? split.tab : cur(); }
function isDirty(t){ if (t.kind === "hex") return t.hex.buf.pieces !== t.hex.clean; return t.forceDirty || !t.doc.isClean(t.cleanGen); }

function makeTab({ name, text = "", lang, eol = "LF", bom = false, encoding = "utf-8", bytes = null, untitled = false, dirty = false, path = null, bm = null, id = null }){
  const langId = lang || langForName(name);
  const doc = CodeMirror.Doc(text, LANG[langId].mode);
  return { id: id || Math.random().toString(36).slice(2), name, path, doc, langId, eol, bom, encoding: normEnc(encoding), bytes, untitled, cleanGen: doc.changeGeneration(true), forceDirty: dirty, userMarks: [], pendingBm: bm && bm.length ? bm : null };
}
function addTab(t, activate = true){
  const only = tabs.length === 1 && tabs[0].untitled && !isDirty(tabs[0]) && tabs[0].doc.getValue() === "" && tabs[0] !== split.tab;
  if (only && t !== tabs[0]){ tabs[0] = t; if (activate) activateTab(0, true); }
  else { tabs.push(t); if (activate) activateTab(tabs.length - 1); }
  renderTabs(); persistSoon();
}
function newTab(){ const n = seq++; addTab(makeTab({ name:`新文件 ${n}`, untitled:true })); focusEditor(); }

function activateTab(i, force){
  if (i < 0 || i >= tabs.length) return;
  if (i === active && !force) { focusEditor(); return; }
  const t = tabs[i];
  if (cmp.on && t !== cmp.left) endCompare();
  if (cm === cmMain) clearHits();
  active = i;
  if (isHex(t)){ cm = cmMain; if (!$("#findPanel").hidden){ $("#findPanel").hidden = true; clearHits(); } }
  cmMain.swapDoc(t.doc);
  cmMain.setOption("mode", LANG[t.langId].mode);
  applyPendingBm(cmMain, t);
  syncHexPane(); $("#tHex").setAttribute("aria-pressed", String(isHex(t)));
  renderTabs(); updateStatus(); syncLangSelect();
  if (!$("#findPanel").hidden && cm === cmMain) refreshHits();
  mdSoon(0);
  const tabEl = $("#tabs").children[i]; tabEl && tabEl.scrollIntoView({ block:"nearest", inline:"nearest" });
  persistSoon();
}

async function closeTab(i){
  const t = tabs[i]; if (!t) return false;
  if (isDirty(t)){
    if (i !== active) activateTab(i);
    const r = await ask({ title:`「${t.name}」尚未儲存`, text:"關閉後，這個分頁的內容會從工作階段中移除。", actions:[
      { id:"cancel", label:"取消" }, { id:"discard", label:"不儲存" }, { id:"save", label:"儲存", primary:true } ]});
    if (r === "save"){ if (!(await saveTab(t))) return false; }
    else if (r !== "discard") return false;
  }
  const idx = tabs.indexOf(t); if (idx < 0) return false;
  if (cmp.on && (t === cmp.left || t === cmp.right)) endCompare();
  tabs.splice(idx, 1); if (isHex(t)) hexForget(t.id); else docDel(t.id);
  if (!tabs.length){ active = -1; const n = seq++; tabs.push(makeTab({ name:`新文件 ${n}`, untitled:true })); activateTab(0, true); }
  else { let next = active; if (idx < active) next = active - 1; else if (idx === active) next = Math.min(idx, tabs.length - 1); active = -1; activateTab(next, true); }
  if (t === split.tab && !$("#pane2").hidden){ const nt = isHex(cur()) ? tabs.find(x => !isHex(x)) : cur(); if (nt) showInPane2(nt, true); else closeSplit(); }
  renderTabs(); persistSoon(); return true;
}
async function closeOthers(keep = cur()){ for (const t of tabs.slice()){ if (t !== keep){ const ok = await closeTab(tabs.indexOf(t)); if (!ok) return; } } }
async function closeRight(from = cur()){ const i = tabs.indexOf(from); for (const t of tabs.slice(i + 1)){ const ok = await closeTab(tabs.indexOf(t)); if (!ok) return; } }
async function closeAll(){ for (const t of tabs.slice()){ const ok = await closeTab(tabs.indexOf(t)); if (!ok) return; } }

