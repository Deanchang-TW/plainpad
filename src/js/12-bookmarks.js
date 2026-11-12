/* ---------- bookmarks ---------- */
function isBmHandle(h){ return !!(h && h.gutterMarkers && h.gutterMarkers[BM]); }
function isBmLine(doc, line){ return isBmHandle(doc.getLineHandle(line)); }
function setBm(ed, line, on){
  if (on){ const dot = el("div", { class:"bm-dot" }); ed.setGutterMarker(line, BM, dot); ed.addLineClass(line, "background", "bm-line"); }
  else { ed.setGutterMarker(line, BM, null); ed.removeLineClass(line, "background", "bm-line"); }
}
function bmLines(t){
  if (t.pendingBm) return t.pendingBm.slice();
  const out = []; let n = 0; t.doc.eachLine(h => { if (isBmHandle(h)) out.push(n); n++; }); return out;
}
function applyPendingBm(ed, t){
  if (!t.pendingBm) return; const max = t.doc.lineCount();
  ed.operation(() => t.pendingBm.forEach(l => { if (l < max) setBm(ed, l, true); }));
  t.pendingBm = null;
}
function edBmLines(){ const d = cm.getDoc(); const out = []; let n = 0; d.eachLine(h => { if (isBmHandle(h)) out.push(n); n++; }); return out; }
function bmToggle(){ const d = cm.getDoc(); const lines = [...new Set(d.listSelections().map(r => r.head.line))]; cm.operation(() => lines.forEach(l => setBm(cm, l, !isBmLine(d, l)))); persistSoon(); }
function bmJump(dir){
  const lines = edBmLines(); if (!lines.length){ toast(tr("這個分頁沒有書籤，點行號左邊的空白處可以加入")); return; }
  const c = cm.getCursor().line;
  const target = dir > 0 ? (lines.find(l => l > c) ?? lines[0]) : ([...lines].reverse().find(l => l < c) ?? lines[lines.length - 1]);
  cm.setCursor(Pos(target, 0)); cm.scrollIntoView(null, cm.getScrollInfo().clientHeight / 3);
}
function bmClear(){ const lines = edBmLines(); cm.operation(() => lines.forEach(l => setBm(cm, l, false))); persistSoon(); toast(tr("已清除 {n} 個書籤", { n:lines.length })); }
function bmInverse(){ const d = cm.getDoc(); cm.operation(() => { for (let l = 0; l < d.lineCount(); l++) setBm(cm, l, !isBmLine(d, l)); }); persistSoon(); }
async function bmCopy(cut){
  const lines = edBmLines(); if (!lines.length){ toast(tr("沒有書籤行")); return; }
  const d = cm.getDoc(); const text = lines.map(l => d.getLine(l)).join("\n");
  const ok = await copyText(text);
  if (cut) bmDelete(lines, true);
  toast(ok ? (cut ? tr("已剪下 {n} 行", { n:lines.length }) : tr("已複製 {n} 行", { n:lines.length })) : tr("無法寫入剪貼簿，{n} 行沒有複製", { n:lines.length }));
}
function bmDelete(lines = edBmLines(), silent){
  if (!lines.length){ toast(tr("沒有書籤行")); return; }
  const d = cm.getDoc();
  cm.operation(() => { for (let i = lines.length - 1; i >= 0; i--){ const l = lines[i];
    if (l < d.lastLine()) d.replaceRange("", Pos(l, 0), Pos(l + 1, 0), "+bmdelete");
    else if (l > 0) d.replaceRange("", Pos(l - 1), Pos(l), "+bmdelete");
    else { d.replaceRange("", Pos(0, 0), Pos(0), "+bmdelete"); setBm(cm, 0, false); } } });
  if (!silent) toast(tr("已刪除 {n} 行", { n:lines.length }));
  persistSoon();
}
function bmKeepOnly(){
  const lines = edBmLines(); if (!lines.length){ toast(tr("沒有書籤行，所有行都會被刪除，已略過")); return; }
  const d = cm.getDoc(); const text = lines.map(l => d.getLine(l)).join("\n"); const removed = d.lineCount() - lines.length;
  cm.operation(() => { d.replaceRange(text, Pos(0, 0), Pos(d.lastLine()), "+bmkeep"); for (let l = 0; l < lines.length; l++) setBm(cm, l, true); });
  toast(tr("已刪除 {n} 行未加書籤的行", { n:removed })); persistSoon();
}

