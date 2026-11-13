/* ---------- status ---------- */
function updateStatus(){
  if (hexActive()){ hexStatus(); return; }
  const t = curT(); if (!t) return; const d = cm.getDoc();
  $("#stEol").hidden = $("#stEnc").hidden = $("#stLang").hidden = false; $("#stIns").textContent = cm.state.overwrite ? "OVR" : "INS";
  $("#stLen").textContent = tr("Length {n}", { n:fmtNum(d.indexFromPos(Pos(d.lastLine()))) });
  $("#stLines").textContent = tr("Lines {n}", { n:fmtNum(d.lineCount()) });
  const c = d.getCursor();
  $("#stPos").textContent = tr("Ln {line}, Col {col}", { line:fmtNum(c.line + 1), col:fmtNum(c.ch + 1) });
  const sels = d.getSelections(); let chars = 0, lines = 0;
  d.listSelections().forEach((r, i) => { if (sels[i].length){ chars += sels[i].length; lines += Math.abs(r.head.line - r.anchor.line) + 1; } });
  $("#stSel").textContent = chars ? tr("Sel {chars} | {n} lines", { chars:fmtNum(chars), n:fmtNum(lines) }) + (sels.length > 1 ? tr(" ({n} ranges)", { n:sels.length }) : "") : (sels.length > 1 ? tr("{n} cursors", { n:sels.length }) : tr("Sel 0"));
  $("#stEol").textContent = EOL_LABEL[t.eol];
  $("#stEnc").textContent = encLabel(t);
}
function syncLangSelect(){ const t = curT(); if (t) $("#stLang").value = t.langId; }
function setLang(t, id){
  if (isHex(t)) return;
  t.langId = id;
  if (t === cur()) cmMain.setOption("mode", LANG[id].mode);
  if (t === split.tab) cm2.setOption("mode", LANG[id].mode);
  syncLangSelect(); persistSoon(); mdSoon(0);
}

