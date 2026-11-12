
/* ---------- fold guides ----------
   The fold gutter, drawn the Notepad++ way: a ⊟ box on the first line of a foldable block, a line down its body and a └ on
   its last line; ⊞ once folded. Clicking a box folds or unfolds that block. The VS Code style (設定 › 摺疊標記) uses the
   same markers but shows only chevrons, and only while the pointer is over the gutter. Fold ranges come from the mode's
   fold helper (braces, tags, indentation or headings), the same source foldCode uses. */
const FG_LOOKBACK = 400;   // blocks that start this many lines above the viewport still get their guide drawn
// The XML mode declares no fold helper of its own; tags fold in XML, HTML and the JSX parts of JS/TS through this one.
CodeMirror.registerGlobalHelper("fold", "xmlTags", mode => mode.name === "xml", CodeMirror.fold.xml);
/* Modes that name no folding of their own (SQL, Lua, Perl, Nginx and others) fold by braces, then by indentation.
   Plain text stays unfoldable. */
CodeMirror.registerGlobalHelper("fold", "fallback",
  mode => !mode.fold && mode.name !== "null" && mode.name !== "xml" && !(CodeMirror.helpers.fold && CodeMirror.helpers.fold[mode.name]),
  (cm, start) => CodeMirror.fold.brace(cm, start) || CodeMirror.fold.indent(cm, start));
function fgFoldedAt(cm, line){
  for (const m of cm.findMarks(Pos(line, 0), Pos(line + 1, 0))){ if (!m.__isFold) continue; const f = m.find(-1); if (f && f.line === line) return true; }
  return false;
}
/* The fold range starting on a line, if any. Helpers are chosen by the mode at the position asked, and in JSX the mode at
   column 0 is still JavaScript, so a line that opens a tag is asked again just past its first character. */
function fgRange(cm, line){
  const auto = CodeMirror.fold.auto; let r = auto(cm, Pos(line, 0));
  if (!r){ const m = /\S/.exec(cm.getLine(line)); if (m) r = auto(cm, Pos(line, m.index + 1)); }
  return r && r.to.line > r.from.line ? r : null;
}
/* 檢視 › 全部摺疊. CodeMirror's own foldAll asks each line at column 0 only, which misses JSX tags; this one uses fgRange. */
function foldAllBlocks(cm){
  cm.operation(() => { for (let l = cm.firstLine(), last = cm.lastLine(); l <= last; l++){ const r = fgRange(cm, l); if (r) cm.foldCode(Pos(l, 0), { rangeFinder: () => r }, "fold"); } });
}
function fgMarker(cls){ const d = document.createElement("div"); d.className = cls; if (/fg-[sf]/.test(cls)) d.appendChild(document.createElement("i")); return d; }
function fgUpdate(cm){
  const st = cm.state.ppFolds; if (st) st.timer = 0;
  const { from, to } = cm.getViewport(); if (to <= from) return;
  const n = to - from;
  const start = new Uint8Array(n), folded = new Uint8Array(n), end = new Uint8Array(n), above = new Uint8Array(n), below = new Uint8Array(n);
  const t0 = performance.now();
  for (let s = Math.max(cm.firstLine(), from - FG_LOOKBACK); s < to; s++){
    if (s < from && performance.now() - t0 > 30){ s = from - 1; continue; }   // over budget: skip the rest of the look-back, keep the viewport exact
    const isF = fgFoldedAt(cm, s); let range = null;
    if (!isF){ range = fgRange(cm, s); if (!range) continue; }
    if (s >= from){ if (isF) folded[s - from] = 1; else start[s - from] = 1; }
    if (isF) continue;
    const last = range.to.line;
    for (let l = Math.max(s, from); l < Math.min(last, to); l++) below[l - from] = 1;
    for (let l = Math.max(s + 1, from); l <= Math.min(last, to - 1); l++) above[l - from] = 1;
    if (last >= from && last < to) end[last - from] = 1;
  }
  cm.operation(() => {
    for (let i = 0; i < n; i++){
      let cls = "";
      if (folded[i] || start[i] || above[i] || below[i]){
        cls = "fg " + (folded[i] ? "fg-f" : start[i] ? "fg-s" : end[i] ? "fg-e" : "fg-m") + (above[i] ? " fg-a" : "") + (below[i] ? " fg-b" : "");
      }
      const info = cm.lineInfo(from + i); const old = info && info.gutterMarkers && info.gutterMarkers[FG];
      if ((old ? old.className : "") === cls) continue;
      cm.setGutterMarker(from + i, FG, cls ? fgMarker(cls) : null);
    }
  });
}
function fgSoon(cm, ms){
  const st = cm.state.ppFolds || (cm.state.ppFolds = { timer:0 });
  if (st.timer) clearTimeout(st.timer);
  st.timer = setTimeout(() => fgUpdate(cm), ms);
}
[cmMain, cm2].forEach(ed => {
  ed.on("viewportChange", () => fgSoon(ed, 30));
  ed.on("swapDoc", () => fgSoon(ed, 0));
  ed.on("fold", () => fgSoon(ed, 0)); ed.on("unfold", () => fgSoon(ed, 0));
  ed.on("changes", () => fgSoon(ed, 300));
  ed.on("optionChange", (c, opt) => { if (opt === "mode") fgSoon(ed, 0); });
  // The chevron style shows its markers only while the pointer is over the gutter. The markers live inside the line
  // wrappers, not inside .CodeMirror-gutters, so a CSS :hover on the gutter cannot reach them; a class on the editor can.
  const wrap = ed.getWrapperElement();
  wrap.addEventListener("mousemove", e => { const over = !!e.target.closest(".CodeMirror-gutters, .CodeMirror-gutter-wrapper"); if (wrap.classList.contains("gutter-hover") !== over) wrap.classList.toggle("gutter-hover", over); });
  wrap.addEventListener("mouseleave", () => wrap.classList.remove("gutter-hover"));
  ed.on("gutterClick", (c, line, gutter) => { if (gutter !== FG) return; const r = fgRange(c, line); if (r) c.foldCode(Pos(line, 0), { rangeFinder: () => r }); });
});
