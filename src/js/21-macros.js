/* ---------- macros ---------- */
const macro = { rec:false, steps:[], replaying:false };
const RECORDABLE = new Set(["dup","delLine","up","down","join","upper","lower","title","invert","comment","indent","outdent","sortAsc","sortDesc","sortCi","sortNat","sortLen","reverse","dedupe","dedupeAdj","noEmpty","trimEnd","trimStart","trimBoth","eolToSpace","tabs2sp","sp2tabs","timestamp","selectAll","next","prev","bmToggle","bmNext","bmPrev"]);
function recPush(step){ if (macro.rec && !macro.replaying) macro.steps.push(step); }
function macroRec(){
  if (!macro.rec){ macro.rec = true; macro.steps = []; toast(tr("Recording a macro. Press again to stop.")); }
  else {
    macro.rec = false;
    if (macro.steps.length){ settings.lastMacro = macro.steps.slice(); persistSoon(); toast(tr("Recorded {n} steps", { n:macro.steps.length })); }
    else toast(tr("Nothing was recorded"));
  }
  const b = $("#tRec"); b.classList.toggle("is-rec", macro.rec); b.setAttribute("aria-pressed", String(macro.rec));
  b.title = b.ariaLabel = macro.rec ? tr("Stop recording macro") : tr("Start recording macro");
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
  if (macro.rec){ toast(tr("Stop recording first")); return; }
  if (!steps || !steps.length){ toast(tr("No macro yet. Press Record to record one.")); return; }
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
  ed.focus(); if (runs > 1) toast(tr("The macro ran {n} times", { n:fmtNum(runs) }));
}
async function macroMulti(){
  const names = [null, ...settings.macros.map(m => m.name)].filter(n => getMacro(n));
  if (!names.length){ toast(tr("No macro yet. Press Record to record one.")); return; }
  const body = el("div", { class:"form-grid" });
  const sel = el("select", { id:"mmName" }); names.forEach(n => sel.append(el("option", { value: n == null ? "" : n, text: n == null ? tr("Current recording") : n })));
  const times = el("input", { type:"number", id:"mmTimes", min:"1", value:"10", "data-autofocus":"" });
  const r1 = el("input", { type:"radio", name:"mmMode", id:"mmModeN", value:"n" }); r1.checked = true;
  const r2 = el("input", { type:"radio", name:"mmMode", id:"mmModeEof", value:"eof" });
  body.append(el("label", { for:"mmName", text:tr("Macro") }), sel,
    el("label", { class:"radio" }, r1, " " + tr("Run")), el("div", null, times),
    el("label", { class:"radio span" }, r2, " " + tr("Run until the end of the file")));
  const r = await ask({ title:tr("Run Macro Multiple Times"), body, actions:[{ id:"cancel", label:tr("Cancel") }, { id:"ok", label:tr("Run"), primary:true }] });
  if (r !== "ok") return;
  playMacro(sel.value === "" ? null : sel.value, Math.max(1, Math.min(100000, Math.floor(+times.value || 1))), r2.checked);
}
async function macroSave(){
  if (!settings.lastMacro || !settings.lastMacro.length){ toast(tr("There is no recorded macro")); return; }
  const name = (await promptText({ title:tr("Save Macro"), text:tr("Saved macros appear in the Macro menu and stay available next time."), value:tr("Macro {n}", { n:settings.macros.length + 1 }), ok:tr("Save") }) || "").trim();
  if (!name) return;
  settings.macros = settings.macros.filter(m => m.name !== name).concat([{ name, steps: settings.lastMacro.slice() }]);
  persistSoon(); toast(tr("Saved macro “{name}”", { name }));
}

