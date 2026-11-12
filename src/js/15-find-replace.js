/* ---------- find & replace ---------- */
const findState = { mode:"normal", caseSens:false, word:false, wrap:true, bookmark:false };
function buildRe(){
  const raw = $("#findInput").value; const info = $("#findInfo"), input = $("#findInput");
  input.classList.remove("is-error"); info.classList.remove("is-error");
  if (!raw) return null;
  let src;
  if (findState.mode === "regex") src = raw;
  else { const s = findState.mode === "ext" ? unescapeExt(raw).replace(/\r\n?/g, "\n") : raw; src = escapeRe(s); }
  if (findState.word) src = "(?<![\\p{L}\\p{N}_])(?:" + src + ")(?![\\p{L}\\p{N}_])";
  try { return new RegExp(src, "gm" + (findState.caseSens ? "" : "i") + (findState.word ? "u" : "")); }
  catch(e){
    input.classList.add("is-error"); info.classList.add("is-error"); info.textContent = "運算式錯誤：" + e.message.replace(/^Invalid regular expression: /, ""); return null;
  }
}
function allMatches(text, re, cap = 20000){
  const out = []; re.lastIndex = 0; let m;
  while ((m = re.exec(text))){ out.push([m.index, m[0].length]); if (m[0].length === 0) re.lastIndex++; if (out.length >= cap) break; }
  return out;
}
function groupCount(re){ try { return new RegExp(re.source + "|", re.flags).exec("").length - 1; } catch(e){ return 0; } }
function expandRepl(m, tpl){
  if (findState.mode === "normal") return tpl;
  if (findState.mode === "ext") return unescapeExt(tpl).replace(/\r\n?/g, "\n");
  return tpl.replace(/\$(\$|&|\d{1,2})|\\(\d{1,2}|n|r|t|\\)/g, (all, dd, b) => {
    if (dd !== undefined){ if (dd === "$") return "$"; if (dd === "&") return m[0]; const n = +dd; return n < m.length ? (m[n] ?? "") : all; }
    if (b === "n" || b === "r") return "\n"; if (b === "t") return "\t"; if (b === "\\") return "\\";
    const n = +b; return n < m.length ? (m[n] ?? "") : all;
  });
}
function clearHits(){ hitMarks.forEach(mk => mk.clear()); hitMarks = []; }
let hitTimer;
function refreshHitsSoon(){ clearTimeout(hitTimer); hitTimer = setTimeout(refreshHits, 140); }
function refreshHits(){
  clearHits(); const re = buildRe(); const info = $("#findInfo");
  if (!re){ if (!$("#findInput").value) info.textContent = ""; return []; }
  const d = cm.getDoc(); const all = allMatches(d.getValue(), re);
  cm.operation(() => { for (const [i, len] of all.slice(0, 5000)) if (len) hitMarks.push(d.markText(d.posFromIndex(i), d.posFromIndex(i + len), { className:"cm-hit" })); });
  info.textContent = all.length ? `共 ${fmtNum(all.length)}${all.length >= 20000 ? "+" : ""} 筆` : "找不到";
  return all;
}
function findNext(dir){
  if ($("#findPanel").hidden && !macro.replaying){ openFind("find"); return; }
  const re = buildRe(); if (!re){ if (!$("#findInput").value && !macro.replaying) $("#findInput").focus(); return; }
  const d = cm.getDoc(); const text = d.getValue();
  const from = d.indexFromPos(d.getCursor("from")), to = d.indexFromPos(d.getCursor("to"));
  const all = allMatches(text, re); const info = $("#findInfo");
  if (!all.length){ info.textContent = "找不到「" + $("#findInput").value + "」"; return; }
  let k = -1, wrapped = false;
  if (dir > 0){ k = all.findIndex(([i, len]) => i > from || (i === from && (i + len > to || (len === 0 && from !== to)))); if (k < 0 && from === to) k = all.findIndex(([i]) => i >= to);
                if (k < 0 && findState.wrap){ k = 0; wrapped = true; } }
  else { for (let j = all.length - 1; j >= 0; j--) if (all[j][0] < from){ k = j; break; } if (k < 0 && findState.wrap){ k = all.length - 1; wrapped = true; } }
  if (k < 0){ info.textContent = dir > 0 ? "已到文件結尾" : "已到文件開頭"; return; }
  const [i, len] = all[k];
  d.setSelection(d.posFromIndex(i), d.posFromIndex(i + len));
  cm.scrollIntoView({ from: d.posFromIndex(i), to: d.posFromIndex(i + len) }, 80);
  info.textContent = `第 ${fmtNum(k + 1)} / ${fmtNum(all.length)} 筆` + (wrapped ? (dir > 0 ? "，已從頭開始" : "，已從尾端開始") : "");
}
function replaceOne(){
  const re = buildRe(); if (!re) return; const d = cm.getDoc(); const text = d.getValue();
  const from = d.indexFromPos(d.getCursor("from")), to = d.indexFromPos(d.getCursor("to"));
  re.lastIndex = from; const m = re.exec(text);
  if (m && m.index === from && m[0].length === to - from){
    const rep = expandRepl(m, $("#replInput").value);
    d.replaceRange(rep, d.posFromIndex(from), d.posFromIndex(to), "+replace");
    d.setCursor(d.posFromIndex(from + rep.length));
  }
  findNext(1);
}
function replaceAllIn(doc, re, tpl){
  const text = doc.getValue(); let n = 0; const gc = groupCount(re);
  const out = text.replace(re, (...args) => { n++; return expandRepl(args.slice(0, gc + 1), tpl); });
  if (n && out !== text){ const c = doc.getCursor(); doc.replaceRange(out, Pos(doc.firstLine(), 0), Pos(doc.lastLine()), "+replaceall"); doc.setCursor(c); }
  return n;
}
function replaceAll(allTabs){
  const re = buildRe(); if (!re) return; const tpl = $("#replInput").value;
  if (!allTabs){ const n = replaceAllIn(cm.getDoc(), re, tpl); $("#findInfo").textContent = n ? `已取代 ${fmtNum(n)} 筆` : "找不到"; return; }
  let total = 0, files = 0;
  tabs.forEach(t => { const n = replaceAllIn(t.doc, re, tpl); if (n){ total += n; files++; } });
  renderTabs(); updateStatus(); persistSoon();
  $("#findInfo").textContent = total ? `已在 ${files} 個分頁取代 ${fmtNum(total)} 筆` : "所有分頁都找不到";
}
function markAll(){
  const re = buildRe(); if (!re) return; const t = curT(); const d = cm.getDoc(); const all = allMatches(d.getValue(), re);
  const lines = new Set();
  cm.operation(() => { for (const [i, len] of all){ const p = d.posFromIndex(i); lines.add(p.line); if (len) t.userMarks.push(d.markText(p, d.posFromIndex(i + len), { className:"cm-userMark" })); }
    if (findState.bookmark) lines.forEach(l => setBm(cm, l, true)); });
  if (findState.bookmark) persistSoon();
  $("#findInfo").textContent = `已標記 ${fmtNum(all.length)} 筆` + (findState.bookmark ? `，${fmtNum(lines.size)} 行加上書籤` : "");
}
function clearMarks(){ const t = curT(); t.userMarks.forEach(m => m.clear()); t.userMarks = []; $("#findInfo").textContent = "已清除標記"; }
function openFind(kind){
  const p = $("#findPanel"); const wasHidden = p.hidden; p.hidden = false;
  $("#replaceRow").hidden = kind !== "replace";
  $("#filesRow").hidden = kind !== "files";
  $("#listRow").hidden = kind === "files";
  const sel = cm.getSelection();
  if (sel && !sel.includes("\n") && sel.length < 200){ $("#findInput").value = findState.mode === "regex" ? escapeRe(sel) : sel; }
  const target = kind === "replace" && $("#findInput").value ? $("#replInput") : $("#findInput");
  target.focus(); target.select();
  if (wasHidden){ cmMain.refresh(); if (!$("#pane2").hidden) cm2.refresh(); }
  refreshHits();
}
function closeFind(){ $("#findPanel").hidden = true; clearHits(); cmMain.refresh(); if (!$("#pane2").hidden) cm2.refresh(); focusEditor(); }

$("#findInput").addEventListener("input", refreshHitsSoon);
$("#findInput").addEventListener("keydown", e => { if (e.key === "Enter"){ e.preventDefault(); if (!$("#filesRow").hidden) findInFiles(); else findNext(e.shiftKey ? -1 : 1); } else if (e.key === "Escape"){ e.preventDefault(); closeFind(); } });
$("#replInput").addEventListener("keydown", e => { if (e.key === "Enter"){ e.preventDefault(); (e.metaKey || e.ctrlKey) ? replaceAll(false) : replaceOne(); } else if (e.key === "Escape"){ e.preventDefault(); closeFind(); } });
$("#filterInput").addEventListener("keydown", e => { if (e.key === "Enter"){ e.preventDefault(); findInFiles(); } });
$("#filterInput").addEventListener("change", () => { settings.filesFilter = $("#filterInput").value; persistSoon(); });
$("#skipDirs").addEventListener("change", () => { settings.skipDirs = $("#skipDirs").checked; persistSoon(); });
document.querySelectorAll("#findPanel .seg button").forEach(b => b.addEventListener("click", () => {
  findState.mode = b.dataset.mode; document.querySelectorAll("#findPanel .seg button").forEach(x => x.setAttribute("aria-pressed", String(x === b))); refreshHits(); $("#findInput").focus(); }));
function bindChip(id, key){ const c = $(id); c.addEventListener("click", () => { findState[key] = !findState[key]; c.setAttribute("aria-pressed", String(findState[key])); refreshHits(); }); }
bindChip("#optCase", "caseSens"); bindChip("#optWord", "word"); bindChip("#optWrap", "wrap"); bindChip("#optBookmark", "bookmark");
$("#btnNext").addEventListener("click", () => findNext(1));
$("#btnPrev").addEventListener("click", () => findNext(-1));
$("#btnMark").addEventListener("click", markAll);
$("#btnClearMark").addEventListener("click", clearMarks);
$("#btnReplace").addEventListener("click", replaceOne);
$("#btnReplaceAll").addEventListener("click", () => replaceAll(false));
$("#btnReplaceAllTabs").addEventListener("click", () => replaceAll(true));
$("#btnListCur").addEventListener("click", () => listHits(false));
$("#btnListAll").addEventListener("click", () => listHits(true));
$("#findClose").addEventListener("click", closeFind);

