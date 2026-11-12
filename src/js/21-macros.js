/* ---------- macros ---------- */
const macro = { rec:false, steps:[], replaying:false };
const RECORDABLE = new Set(["dup","delLine","up","down","join","upper","lower","title","invert","comment","indent","outdent","sortAsc","sortDesc","sortCi","sortNat","sortLen","reverse","dedupe","dedupeAdj","noEmpty","trimEnd","trimStart","trimBoth","eolToSpace","tabs2sp","sp2tabs","timestamp","selectAll","next","prev","bmToggle","bmNext","bmPrev"]);
function recPush(step){ if (macro.rec && !macro.replaying) macro.steps.push(step); }
function macroRec(){
  if (!macro.rec){ macro.rec = true; macro.steps = []; toast(tr("開始錄製巨集，再按一次停止")); }
  else {
    macro.rec = false;
    if (macro.steps.length){ settings.lastMacro = macro.steps.slice(); persistSoon(); toast(tr("已錄下 {n} 個步驟", { n:macro.steps.length })); }
    else toast(tr("沒有錄到任何步驟"));
  }
  const b = $("#tRec"); b.classList.toggle("is-rec", macro.rec); b.setAttribute("aria-pressed", String(macro.rec));
  b.title = b.ariaLabel = macro.rec ? tr("停止錄製巨集") : tr("開始錄製巨集");
  b.innerHTML = macro.rec ? '<svg viewBox="0 0 16 16"><rect x="4" y="4" width="8" height="8" rx="1" fill="currentColor"/></svg>' : '<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="4.5" fill="currentColor"/></svg>';
  $("#stRec").hidden = !macro.rec;
  focusEditor();
}
function runKey(ed, name){
  // Cursor commands extend the selection when CodeMirror thinks Shift is held; take that from the recorded key, not the live keyboard.
  const prevShift = ed.display.shift; ed.display.shift = /(^|-)Shift-/.test(name);
  try { return runKeyInner(ed, name); } finally { ed.display.shift = prevShift; }
}
function runKeyInner(ed, name){
  const maps = [...((ed.state && ed.state.keyMaps) || []), ed.getOption("extraKeys"), CodeMirror.keyMap[ed.getOption("keyMap")]].filter(Boolean);
  for (const m of maps){
    let handled = false;
    CodeMirror.lookupKey(name, m, b => { const fn = typeof b === "string" ? CodeMirror.commands[b] : b; if (typeof fn !== "function") return false; const r = fn(ed); if (r === CodeMirror.Pass) return false; handled = true; return true; }, ed);
    if (handled) return true;
  }
  return false;
}
function playSteps(steps){
  const ed = cm;
  for (const s of steps){
    if (s.k) runKey(ed, s.k);
    else if (s.t != null) ed.replaceSelection(s.t);
    else if (s.x) ed.replaceSelection("");
    else if (s.a && A[s.a]) A[s.a]();
  }
}
function getMacro(name){ if (name == null) return settings.lastMacro; const m = settings.macros.find(x => x.name === name); return m && m.steps; }
function playMacro(name, times = 1, untilEof = false){
  const steps = getMacro(name);
  if (macro.rec){ toast(tr("請先停止錄製")); return; }
  if (!steps || !steps.length){ toast(tr("還沒有巨集，先按錄製鍵錄一段")); return; }
  const ed = cm, d = ed.getDoc(); let runs = 0;
  macro.replaying = true; quiet++;
  try {
    // One operation per run: cursor moves like ↓ measure the layout, which a single batched operation would leave stale.
    const once = () => ed.operation(() => playSteps(steps));
    if (!untilEof){ for (; runs < times; runs++) once(); }
    else while (runs < 100000){
      const len0 = d.indexFromPos(Pos(d.lastLine())), pos0 = d.indexFromPos(d.getCursor());
      if (pos0 >= len0 && runs > 0) break;
      const onLast = d.getCursor().line >= d.lastLine();
      once(); runs++;
      if (onLast) break;
      const len1 = d.indexFromPos(Pos(d.lastLine())), pos1 = d.indexFromPos(d.getCursor());
      if (pos1 >= len1) break;
      if (pos1 === pos0 && len1 === len0) break;
    }
  } finally { macro.replaying = false; quiet--; }
  ed.focus(); if (runs > 1) toast(tr("巨集執行了 {n} 次", { n:fmtNum(runs) }));
}
async function macroMulti(){
  const names = [null, ...settings.macros.map(m => m.name)].filter(n => getMacro(n));
  if (!names.length){ toast(tr("還沒有巨集，先按錄製鍵錄一段")); return; }
  const body = el("div", { class:"form-grid" });
  const sel = el("select", { id:"mmName" }); names.forEach(n => sel.append(el("option", { value: n == null ? "" : n, text: n == null ? tr("目前錄製的巨集") : n })));
  const times = el("input", { type:"number", id:"mmTimes", min:"1", value:"10", "data-autofocus":"" });
  const r1 = el("input", { type:"radio", name:"mmMode", id:"mmModeN", value:"n" }); r1.checked = true;
  const r2 = el("input", { type:"radio", name:"mmMode", id:"mmModeEof", value:"eof" });
  body.append(el("label", { for:"mmName", text:tr("巨集") }), sel,
    el("label", { class:"radio" }, r1, " " + tr("執行")), el("div", null, times),
    el("label", { class:"radio span" }, r2, " " + tr("一直執行到檔案結尾")));
  const r = await ask({ title:tr("執行巨集多次"), body, actions:[{ id:"cancel", label:tr("取消") }, { id:"ok", label:tr("執行"), primary:true }] });
  if (r !== "ok") return;
  playMacro(sel.value === "" ? null : sel.value, Math.max(1, Math.min(100000, Math.floor(+times.value || 1))), r2.checked);
}
async function macroSave(){
  if (!settings.lastMacro || !settings.lastMacro.length){ toast(tr("目前沒有錄好的巨集")); return; }
  const name = (await promptText({ title:tr("儲存巨集"), text:tr("儲存後會出現在「巨集」選單，下次開啟仍然可用。"), value:tr("巨集 {n}", { n:settings.macros.length + 1 }), ok:tr("儲存") }) || "").trim();
  if (!name) return;
  settings.macros = settings.macros.filter(m => m.name !== name).concat([{ name, steps: settings.lastMacro.slice() }]);
  persistSoon(); toast(tr("已儲存巨集「{name}」", { name }));
}

