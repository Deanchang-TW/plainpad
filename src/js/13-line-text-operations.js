/* ---------- line & text operations ---------- */
function selLineRange(){
  if (!cm.somethingSelected()) return null;
  const r = cm.listSelections()[0]; let a = r.from().line, b = r.to().line;
  if (b > a && r.to().ch === 0) b--;
  return a === b ? null : [a, b];
}
function transformLines(fn, label){
  const rng = selLineRange(); const d = cm.getDoc();
  const [a, b] = rng || [d.firstLine(), d.lastLine()];
  const lines = []; for (let i = a; i <= b; i++) lines.push(d.getLine(i));
  const out = fn(lines);
  if (out.join("\n") === lines.join("\n")){ toast(tr("Nothing to change")); return; }
  d.replaceRange(out.join("\n"), Pos(a, 0), Pos(b), "+" + label);
  if (rng) d.setSelection(Pos(a, 0), Pos(a + out.length - 1));
  const diff = lines.length - out.length;
  toast(label + (rng ? tr(" (selection)") : tr(" (whole document)")) + (diff > 0 ? tr(": removed {n} lines", { n:fmtNum(diff) }) : ""));
}
function duplicateLine(){
  cm.operation(() => {
    const ranges = cm.listSelections();
    for (let i = ranges.length - 1; i >= 0; i--){
      const r = ranges[i];
      if (r.empty()){ const ln = r.head.line; cm.replaceRange(cm.getLine(ln) + "\n", Pos(ln, 0)); }
      else { cm.replaceRange(cm.getRange(r.from(), r.to()), r.to()); }
    }
  });
}
function moveLines(dir){
  const r = cm.listSelections()[0]; const d = cm.getDoc();
  let a = r.from().line, b = r.to().line; if (b > a && r.to().ch === 0) b--;
  if ((dir < 0 && a === 0) || (dir > 0 && b === d.lastLine())) return;
  const anchor = r.anchor, head = r.head;
  cm.operation(() => {
    if (dir < 0){ const above = d.getLine(a - 1); d.replaceRange("", Pos(a - 1, 0), Pos(a, 0), "+move"); d.replaceRange("\n" + above, Pos(b - 1), null, "+move"); }
    else { const below = d.getLine(b + 1); d.replaceRange("", Pos(b), Pos(b + 1), "+move"); d.replaceRange(below + "\n", Pos(a, 0), null, "+move"); }
    d.setSelection(Pos(anchor.line + dir, anchor.ch), Pos(head.line + dir, head.ch));
  });
}
function joinLines(){
  const rng = selLineRange(); const d = cm.getDoc();
  if (rng){ const [a, b] = rng; const lines = []; for (let i = a; i <= b; i++) lines.push(d.getLine(i));
    const out = lines.map((l, i) => i ? l.trim() : l.replace(/\s+$/, "")).filter((l, i) => i === 0 || l).join(" ");
    d.replaceRange(out, Pos(a, 0), Pos(b)); return; }
  const ln = d.getCursor().line; if (ln >= d.lastLine()) return;
  const cur0 = d.getLine(ln), nxt = d.getLine(ln + 1);
  const keep = cur0.replace(/\s+$/, "").length, lead = nxt.length - nxt.replace(/^\s+/, "").length;
  d.replaceRange(nxt.trim() ? " " : "", Pos(ln, keep), Pos(ln + 1, lead));
}
function caseOp(fn){
  if (!cm.somethingSelected()){ const w = cm.findWordAt(cm.getCursor()); cm.setSelection(w.anchor, w.head); }
  cm.replaceSelections(cm.getSelections().map(fn), "around");
}
const toTitle = s => s.toLowerCase().replace(/(^|[\s_\-./"'(])(\p{L})/gu, (a, p, c) => p + c.toUpperCase());
function expandTabs(l, ts){ let out = "", col = 0; for (const ch of l){ if (ch === "\t"){ const n = ts - (col % ts); out += " ".repeat(n); col += n; } else { out += ch; col++; } } return out; }
function toggleComment(){
  const mode = cm.getModeAt(cm.getCursor());
  if (!mode.lineComment && !mode.blockCommentStart){ toast(tr("This language has no comment syntax. Pick a language at the bottom right first.")); return; }
  cm.toggleComment({ indent:true });
}
function insertTimestamp(){
  const d = new Date(), p = n => String(n).padStart(2, "0");
  cm.replaceSelection(`${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`, "end");
}
function applyText(fn, label, wholeLang){
  try {
    if (cm.somethingSelected()) cm.replaceSelections(cm.getSelections().map(fn), "around");
    else { const d = cm.getDoc(); const out = fn(d.getValue()); d.replaceRange(out, Pos(d.firstLine(), 0), Pos(d.lastLine()), "+tool"); if (wholeLang && curT().langId === "text") setLang(curT(), wholeLang); }
    toast(tr("{label}: done", { label }));
  } catch(e){ toast(tr("{label} failed: {reason}", { label, reason:e.message })); }
}
const b64enc = s => { const b = new TextEncoder().encode(s); let bin = ""; for (let i = 0; i < b.length; i += 0x8000) bin += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(bin); };
const b64dec = s => { const bin = atob(s.replace(/\s+/g, "")); const b = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i); return new TextDecoder("utf-8", { fatal:true }).decode(b); };
function wordCount(){
  const text = cm.somethingSelected() ? cm.getSelections().join("\n") : cm.getValue();
  const cjkRe = /[㐀-鿿豈-﫿぀-ヿ가-힯]/g;   // i18n-ignore: character ranges, not text
  const cjk = (text.match(cjkRe) || []).length;
  const words = (text.replace(cjkRe, " ").match(/[\p{L}\p{N}_'-]+/gu) || []).length;
  const rows = [[tr("Characters"), [...text].length], [tr("Characters (no spaces)"), [...text.replace(/\s/g, "")].length], [tr("CJK characters"), cjk], [tr("Words (English etc.)"), words], [tr("Lines"), text ? text.split("\n").length : 0], [tr("UTF-8 bytes"), new TextEncoder().encode(text).length]];
  const dl = el("dl", { class:"stats" });
  rows.forEach(([k, v]) => dl.append(el("dt", { text:k }), el("dd", { text:fmtNum(v) })));
  ask({ title: cm.somethingSelected() ? tr("Word Count (selection)") : tr("Word Count (whole document)"), body: dl, actions:[{ id:"ok", label:tr("Close"), primary:true }] }).then(() => focusEditor());
}
async function hashes(){
  const t = curT(); const sel = cm.somethingSelected();
  const enc = normEnc(t.encoding);
  const data = encodeText(sel ? cm.getSelections().join(EOLS[t.eol]) : cm.getDoc().getValue(EOLS[t.eol]), enc, !sel && t.bom && bomCapable(enc)).bytes;
  const list = el("div", { class:"hash-list" });
  for (const algo of ["SHA-1", "SHA-256", "SHA-512"]){
    let hex = "";
    try { const buf = await crypto.subtle.digest(algo, data); hex = [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join(""); }
    catch(e){ hex = tr("This browser can't compute it"); }
    const btn = el("button", { class:"mini", type:"button", text:tr("Copy") });
    btn.addEventListener("click", async () => { btn.textContent = (await copyText(hex)) ? tr("Copied") : tr("Failed"); });
    list.append(el("div", { class:"hash-row" }, el("span", { text:algo }), el("code", { text:hex }), btn));
  }
  await ask({ title: sel ? tr("Hashes (selection)") : tr("Hashes (whole document)"), text:tr("Computed as {enc} with {eol} line endings, matching the saved file.", { enc:ENC_LABEL[enc] + (t.bom && !sel && bomCapable(enc) ? " BOM" : ""), eol:EOL_LABEL[t.eol] }), body:list, actions:[{ id:"ok", label:tr("Close"), primary:true }] });
  focusEditor();
}
async function gotoLine(){
  const d = cm.getDoc();
  const v = await promptText({ title:tr("Go to Line"), text:tr("Enter 1 to {n}, or “line:column”.", { n:fmtNum(d.lineCount()) }), value: String(d.getCursor().line + 1), ok:tr("Go") });
  if (v == null) return; const m = /^\s*(\d+)(?:\s*[:,]\s*(\d+))?\s*$/.exec(v); if (!m){ toast(tr("Enter a number")); return; }
  const line = Math.min(Math.max(1, +m[1]), d.lineCount()) - 1; const ch = m[2] ? +m[2] - 1 : 0;
  focusEditor(); cm.setCursor(Pos(line, ch)); cm.scrollIntoView(null, cm.getScrollInfo().clientHeight / 3);
}
function complete(ed = cm){ ed.showHint({ hint: CodeMirror.hint.anyword, completeSingle:false, word:/[\w$À-ɏ]+/, range:2000 }); }
function maybeHint(ed, ch){
  if (!settings.autoComplete || macro.rec || macro.replaying || ed.state.completionActive) return;
  if (ch.origin !== "+input" || ch.text.length !== 1) return;
  const pos = ed.getCursor(); const line = ed.getLine(pos.line).slice(0, pos.ch);
  const m = /[\w$À-ɏ]+$/.exec(line);
  if (m && m[0].length >= 3) complete(ed);
}

