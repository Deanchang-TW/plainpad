/* ---------- hex editor ---------- */
const HEX_PERSIST_MAX = 200 * 1024 * 1024, HEX_CHUNK = 65536;
const HEXB = Array.from({ length:256 }, (_, i) => i.toString(16).toUpperCase().padStart(2, "0"));
const HEX_ENCS = [["ascii","ASCII"],["windows-1252","Windows-1252"],["utf-8","UTF-8"],["big5","Big5"]];
const HEXKEY = isMac ? "Ctrl-Shift-H" : "Mod-Shift-H";
/* Piece table over a Blob: edits never copy the file, original bytes are read lazily in 64 KB chunks, undo is a snapshot of the piece list. */
class HexBuf {
  constructor(blob){ this.blob = blob; this.add = new Uint8Array(4096); this.addLen = 0; this.cache = new Map(); this.loading = new Map();
    this.pieces = blob.size ? [{ s:0, o:0, l:blob.size }] : []; this.index(); }
  index(){ const st = new Array(this.pieces.length); let n = 0; for (let i = 0; i < this.pieces.length; i++){ st[i] = n; n += this.pieces[i].l; } this.starts = st; this.size = n; }
  setPieces(p){ this.pieces = p; this.index(); }
  find(pos){ let lo = 0, hi = this.pieces.length - 1; while (lo < hi){ const mid = (lo + hi + 1) >> 1; if (this.starts[mid] <= pos) lo = mid; else hi = mid - 1; } return lo; }
  append(bytes){
    if (this.addLen + bytes.length > this.add.length){ let n = this.add.length; while (n < this.addLen + bytes.length) n *= 2; const a = new Uint8Array(n); a.set(this.add.subarray(0, this.addLen)); this.add = a; }
    const off = this.addLen; this.add.set(bytes, off); this.addLen += bytes.length; return off; }
  replace(pos, del, bytes){
    const out = [], end = pos + del; let done = false;
    const ins = () => { if (done) return; done = true; if (bytes && bytes.length) out.push({ s:1, o:this.append(bytes), l:bytes.length }); };
    for (let i = 0; i < this.pieces.length; i++){
      const p = this.pieces[i], a = this.starts[i], b = a + p.l;
      if (b <= pos){ out.push(p); continue; }
      if (a >= end){ ins(); out.push(p); continue; }
      if (a < pos) out.push({ s:p.s, o:p.o, l:pos - a });
      ins();
      if (b > end) out.push({ s:p.s, o:p.o + (end - a), l:b - end });
    }
    ins();
    const m = [];
    for (const p of out){ const q = m[m.length - 1]; if (q && q.s === p.s && q.o + q.l === p.o) m[m.length - 1] = { s:q.s, o:q.o, l:q.l + p.l }; else m.push(p); }
    this.setPieces(m);
  }
  /* mod[i]: 0 = original byte, 1 = edited or inserted, 2 = not loaded yet */
  readSync(pos, len){
    pos = Math.max(0, pos); len = Math.max(0, Math.min(len, this.size - pos)); const data = new Uint8Array(len), mod = new Uint8Array(len), need = []; let ok = true;
    if (!len) return { data, mod, ok, need };
    let i = this.find(pos), w = 0;
    while (w < len && i < this.pieces.length){
      const p = this.pieces[i], from = pos + w - this.starts[i], n = Math.min(p.l - from, len - w);
      if (p.s){ data.set(this.add.subarray(p.o + from, p.o + from + n), w); mod.fill(1, w, w + n); }
      else { let o = p.o + from, k = 0;
        while (k < n){ const ci = Math.floor(o / HEX_CHUNK), co = o - ci * HEX_CHUNK, take = Math.min(n - k, HEX_CHUNK - co), c = this.cache.get(ci);
          if (c) data.set(c.subarray(co, co + take), w + k); else { ok = false; need.push(ci); mod.fill(2, w + k, w + k + take); }
          k += take; o += take; } }
      w += n; i++;
    }
    return { data, mod, ok, need };
  }
  load(chunks){
    return Promise.all([...new Set(chunks)].map(ci => {
      if (this.cache.has(ci)) return null;
      if (!this.loading.has(ci)) this.loading.set(ci, this.blob.slice(ci * HEX_CHUNK, Math.min(this.blob.size, (ci + 1) * HEX_CHUNK)).arrayBuffer().then(b => {
        this.cache.set(ci, new Uint8Array(b)); this.loading.delete(ci); while (this.cache.size > 256) this.cache.delete(this.cache.keys().next().value); }));
      return this.loading.get(ci); }));
  }
  async readAsync(pos, len){
    len = Math.max(0, Math.min(len, this.size - pos)); const data = new Uint8Array(len); if (!len) return data;
    let i = this.find(pos), w = 0; const jobs = [];
    while (w < len && i < this.pieces.length){
      const p = this.pieces[i], from = pos + w - this.starts[i], n = Math.min(p.l - from, len - w);
      if (p.s) data.set(this.add.subarray(p.o + from, p.o + from + n), w);
      else { const at = w; jobs.push(this.blob.slice(p.o + from, p.o + from + n).arrayBuffer().then(b => data.set(new Uint8Array(b), at))); }
      w += n; i++;
    }
    await Promise.all(jobs); return data;
  }
  toBlob(){ return new Blob(this.pieces.map(p => p.s ? this.add.slice(p.o, p.o + p.l) : this.blob.slice(p.o, p.o + p.l))); }
}

const hx = { tab:null, rowH:22, headH:0, scaled:false, bodyH:0, cap:4e6, ignore:null, raf:0, drag:null, findTok:0, findMode:"hex", findCase:false, sig:"", wheel:0, digits:8 };
function isHex(t){ return !!(t && t.kind === "hex"); }
function hexActive(){ return isHex(cur()) && cm === cmMain; }
function focusEditor(){ if (isHex(cur()) && cm === cmMain) $("#hexInput").focus({ preventScroll:true }); else cm.focus(); }
function makeHexTab({ name, blob, path = null, id = null, dirty = false }){
  const doc = CodeMirror.Doc("");
  const t = { id: id || Math.random().toString(36).slice(2), kind:"hex", name, path, doc, langId:"text", eol:"LF", bom:false, encoding:"UTF-8", bytes:null, untitled:false, cleanGen: doc.changeGeneration(true), forceDirty:false, userMarks:[], pendingBm:null };
  const buf = new HexBuf(blob);
  t.hex = { buf, clean: dirty ? null : buf.pieces, cur:0, anchor:0, nib:0, col:"hex", top:0, ins:false, undo:[], redo:[], lastEdit:null, lastPos:-1, version:0, savedVersion:-1, loading:false };
  return t;
}
function openHexFile(f, path, note){
  const t = makeHexTab({ name:f.name, blob:f, path });
  addTab(t);
  toast(`「${f.name}」${note || "以 Hex 檢視開啟"}` + (f.size > HEX_PERSIST_MAX ? "。超過 200 MB，重新整理頁面後不會保留" : ""));
  return t;
}
$("#hexFileInput").addEventListener("change", e => { for (const f of [...e.target.files]) openHexFile(f); focusEditor(); });
function hexRestoreTab(o){
  const t = makeHexTab({ name:o.name, path:o.path || null, id:o.id, blob:new Blob([]), dirty:!!o.dirty }); t.hex.loading = true;
  Promise.all([idbGet(o.id), idbGet("base:" + o.id)]).then(([rec, base]) => {
    const s = t.hex; s.loading = false;
    const blob = (base && base.blob) || (rec && rec.blob);
    if (!blob){ s.clean = s.buf.pieces; const i = tabs.indexOf(t); if (i >= 0){ toast(`「${t.name}」的 Hex 內容沒有保存下來，已關閉這個分頁`); closeTab(i); } return; }
    const b = new HexBuf(blob);
    if (rec && rec.pieces){ const add = rec.add || new Uint8Array(0); b.add = new Uint8Array(Math.max(4096, add.length)); b.add.set(add); b.addLen = add.length; b.setPieces(rec.pieces); }
    s.buf = b; s.savedBase = base && base.blob ? blob : null; s.clean = o.dirty ? null : b.pieces; s.savedVersion = s.version; s.cur = s.anchor = Math.min(o.cur || 0, b.size);
    if (cur() === t){ hx.sig = ""; hexRefresh(); hexEnsureVisible(s.cur, true); } renderTabs();
  });
  return t;
}

/* IndexedDB keeps hex tabs across reloads (localStorage is too small for binaries) */
let idbP = null;
function idbOpen(){ if (!idbP) idbP = new Promise((res, rej) => { try {
  const r = indexedDB.open("plainpad", 2);
  r.onupgradeneeded = () => { const db = r.result; for (const n of ["hex", "docs"]) if (!db.objectStoreNames.contains(n)) db.createObjectStore(n, { keyPath:"id" }); };
  r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); r.onblocked = () => rej(new Error("blocked"));
} catch(e){ rej(e); } }); return idbP; }
function idbReq(mode, fn, store = "hex"){ return idbOpen().then(db => new Promise((res, rej) => { const tx = db.transaction(store, mode); const r = fn(tx.objectStore(store)); tx.oncomplete = () => res(r && r.result); tx.onerror = tx.onabort = () => rej(tx.error); })); }
const docDel = id => idbReq("readwrite", st => st.delete(id), "docs").catch(() => null);
function hexForget(id){ idbDel(id); idbDel("base:" + id); }
const idbPut = rec => idbReq("readwrite", st => st.put(rec)).catch(() => { storageWarn(); return false; });
const idbGet = id => idbReq("readonly", st => st.get(id)).catch(() => null);
const idbDel = id => idbReq("readwrite", st => st.delete(id)).catch(() => null);
const idbKeys = () => idbReq("readonly", st => st.getAllKeys()).catch(() => []);
/* The original file is stored once; each later write only stores the piece list and the bytes typed so far. */
function hexPersistIdb(){
  for (const t of tabs){ if (!isHex(t)) continue; const s = t.hex, b = s.buf;
    if (s.loading || !persistableHex(t) || s.savedVersion === s.version) continue;
    s.savedVersion = s.version;
    if (s.savedBase !== b.blob){ s.savedBase = b.blob; idbPut({ id:"base:" + t.id, blob:b.blob }); }
    idbPut({ id:t.id, pieces:b.pieces, add:b.add.slice(0, b.addLen) }); }
}

/* --- layout & rendering --- */
function hexSel(s){ return s.anchor !== s.cur ? [Math.min(s.anchor, s.cur), Math.max(s.anchor, s.cur)] : null; }
function hexTotalRows(){ return Math.floor(hx.tab.hex.buf.size / settings.hexCols) + 1; }
function hexVisRows(){ return Math.max(1, Math.floor(($("#hexScroll").clientHeight - hx.headH) / hx.rowH)); }
function hexMaxScroll(){ const sc = $("#hexScroll"); return Math.max(0, hx.bodyH + hx.headH - sc.clientHeight); }
function syncHexPane(){
  const t = cur(), on = isHex(t); const hadFocus = cmMain.hasFocus() || $("#hexWrap").contains(document.activeElement);
  const was = !$("#hexWrap").hidden;
  $("#hexWrap").hidden = !on; $("#editor").hidden = on;
  if (on){ hx.tab = t; hx.sig = ""; hexRefresh(); }
  else { hx.tab = null; hx.findTok++; if (was) cmMain.refresh(); }
  if (hadFocus && was !== on) focusEditor();
}
function hexLayout(){
  const t = hx.tab; if (!t) return; const s = t.hex, sc = $("#hexScroll"), cols = settings.hexCols, size = s.buf.size;
  const fs = parseFloat(getComputedStyle(sc).fontSize) || 14;
  const sig = [size, cols, fs, sc.clientHeight, sc.clientWidth].join("|"); if (sig === hx.sig) return; hx.sig = sig;
  hx.rowH = fs * 1.6; hx.digits = Math.max(8, size.toString(16).length);
  sc.style.setProperty("--d", hx.digits);
  let h = `<span class="ho"></span><span class="hh">`;
  for (let c = 0; c < cols; c++) h += `<span class="hb${c && c % 8 === 0 ? " g" : ""}">${HEXB[c]}</span>`;
  h += `</span><span class="htc">`;
  for (let c = 0; c < cols; c++) h += `<span class="ht">${(c % 16).toString(16).toUpperCase()}</span>`;
  $("#hexHead").innerHTML = h + "</span>";
  hx.headH = $("#hexHead").offsetHeight;
  const full = hexTotalRows() * hx.rowH; hx.scaled = full > hx.cap; hx.bodyH = hx.scaled ? hx.cap : full;
  $("#hexBody").style.height = hx.bodyH + "px";
  $("#hexContent").style.width = (hx.digits + 2 + cols * 3 + Math.floor((cols - 1) / 8) + 4 + cols + 3) + "ch";
  hexSetTop(s.top);
}
function hexSetTop(row){
  const t = hx.tab; if (!t) return; const s = t.hex, sc = $("#hexScroll"); const maxTop = Math.max(0, hexTotalRows() - hexVisRows());
  s.top = Math.max(0, Math.min(Math.round(row), maxTop));
  const y = hx.scaled ? (maxTop ? s.top / maxTop * hexMaxScroll() : 0) : s.top * hx.rowH;
  if (Math.abs(sc.scrollTop - y) > 0.5){ hx.ignore = y; sc.scrollTop = y; }
}
function hexEnsureVisible(pos, center){
  const t = hx.tab; if (!t) return; const s = t.hex, row = Math.floor(pos / settings.hexCols), vis = hexVisRows();
  if (center) hexSetTop(row - Math.floor(vis / 3));
  else if (row < s.top) hexSetTop(row);
  else if (row > s.top + vis - 1) hexSetTop(row - vis + 1);
}
const W1252 = (() => { const d = new TextDecoder("windows-1252"), a = []; for (let b = 0; b < 256; b++){ const ch = d.decode(Uint8Array.of(b)); a.push(/\p{C}/u.test(ch) ? null : ch); } return a; })();
const big5Cache = new Map(); let big5Dec = null;
function big5Char(a, b){ const k = a << 8 | b; if (big5Cache.has(k)) return big5Cache.get(k); let ch = null; try { big5Dec = big5Dec || new TextDecoder("big5"); ch = big5Dec.decode(Uint8Array.of(a, b)); if (ch.length !== 1 && [...ch].length !== 1 || ch.includes("\uFFFD")) ch = null; } catch(e){} big5Cache.set(k, ch); return ch; }
function isWide(cp){ return (cp >= 0x1100 && cp <= 0x115F) || (cp >= 0x2E80 && cp <= 0xA4CF) || (cp >= 0xAC00 && cp <= 0xD7A3) || (cp >= 0xF900 && cp <= 0xFAFF) || (cp >= 0xFE30 && cp <= 0xFE4F) || (cp >= 0xFF00 && cp <= 0xFF60) || (cp >= 0xFFE0 && cp <= 0xFFE6) || (cp >= 0x1F300 && cp <= 0x1FAFF) || (cp >= 0x20000 && cp <= 0x3FFFD); }
function utf8At(d, i){
  const b = d[i]; if (b < 0xC2 || b > 0xF4) return null; const L = b < 0xE0 ? 2 : b < 0xF0 ? 3 : 4; if (i + L > d.length) return null;
  let cp = b & (0xFF >> (L + 1)); for (let j = 1; j < L; j++){ if ((d[i + j] & 0xC0) !== 0x80) return null; cp = (cp << 6) | (d[i + j] & 0x3F); }
  if (cp < (L === 2 ? 0x80 : L === 3 ? 0x800 : 0x10000) || (cp >= 0xD800 && cp <= 0xDFFF) || cp > 0x10FFFF) return null;
  return { cp, len:L };
}
/* kind per byte: 0 normal, 1 unprintable dot, 2 continuation of a multi-byte character, 3 wide character */
function hexGlyphs(d, enc){
  const n = d.length, g = new Array(n), k = new Uint8Array(n);
  for (let i = 0; i < n; i++){
    const b = d[i];
    if (enc === "utf-8"){ const u = utf8At(d, i); if (u){ const ch = String.fromCodePoint(u.cp); if (!/\p{C}/u.test(ch)){ g[i] = ch; k[i] = isWide(u.cp) ? 3 : 0; for (let j = 1; j < u.len; j++){ g[i + j] = ""; k[i + j] = 2; } i += u.len - 1; continue; } } }
    else if (enc === "big5" && b >= 0x81 && b <= 0xFE && i + 1 < n){ const c = d[i + 1]; if ((c >= 0x40 && c <= 0x7E) || (c >= 0xA1 && c <= 0xFE)){ const ch = big5Char(b, c); if (ch){ g[i] = ch; k[i] = 3; g[i + 1] = ""; k[i + 1] = 2; i++; continue; } } }
    if (b >= 0x20 && b < 0x7F) g[i] = String.fromCharCode(b);
    else if (enc === "windows-1252" && b >= 0x80 && W1252[b]) g[i] = W1252[b];
    else { g[i] = "."; k[i] = 1; }
  }
  return { g, k };
}
const escHtml = s => s === "<" ? "&lt;" : s === "&" ? "&amp;" : s === ">" ? "&gt;" : s;
function hexRender(){
  const t = hx.tab; if (!t || $("#hexWrap").hidden) return; const s = t.hex, buf = s.buf, cols = settings.hexCols, sc = $("#hexScroll");
  const view = $("#hexView"); view.classList.toggle("col-text", s.col === "text"); view.classList.toggle("col-hex", s.col !== "text");
  const total = hexTotalRows(), vis = hexVisRows(); s.top = Math.max(0, Math.min(s.top, Math.max(0, total - vis)));
  const start = s.top * cols, nrows = Math.min(vis + 1, total - s.top), pre = Math.min(start, 3);
  const R = buf.readSync(start - pre, nrows * cols + pre + 3);
  if (!R.ok) buf.load(R.need).then(() => { if (hx.tab === t && t.hex.buf === buf) hexRenderSoon(); });
  const G = hexGlyphs(R.data, settings.hexEnc), sel = hexSel(s), size = buf.size; let html = "";
  for (let r = 0; r < nrows; r++){
    const off = start + r * cols;
    let h = `<div class="hr"><span class="ho">${off.toString(16).toUpperCase().padStart(hx.digits, "0")}</span><span class="hh">`, tx = `<span class="htc">`;
    for (let c = 0; c < cols; c++){
      const i = off + c, w = i - start + pre, gap = c && c % 8 === 0 ? " g" : "";
      if (i > size){ h += `<span class="hb${gap}"></span>`; tx += `<span class="ht"></span>`; continue; }
      const isCur = i === s.cur ? " c" : "";
      if (i === size){ h += `<span class="hb eof${gap}${isCur}" data-i="${i}"></span>`; tx += `<span class="ht eof${isCur}" data-i="${i}"></span>`; continue; }
      const b = R.data[w], m = R.mod[w], sl = sel && i >= sel[0] && i < sel[1] ? " s" : "";
      const hs = m === 2 ? "··" : HEXB[b];
      const cls = "hb" + gap + (m === 1 ? " m" : b === 0 && m === 0 ? " z" : "") + sl + isCur;
      h += isCur && s.col === "hex" ? `<span class="${cls}" data-i="${i}"><i${s.nib === 0 ? ' class="nb"' : ""}>${hs[0]}</i><i${s.nib === 1 ? ' class="nb"' : ""}>${hs[1]}</i></span>` : `<span class="${cls}" data-i="${i}">${hs}</span>`;
      const gk = G.k[w];
      tx += `<span class="ht${gk === 1 ? " d" : gk === 3 ? " w" : ""}${m === 1 ? " m" : ""}${sl}${isCur}" data-i="${i}">${m === 2 ? " " : escHtml(G.g[w])}</span>`;
    }
    html += h + "</span>" + tx + "</span></div>";
  }
  const rows = $("#hexRows"); rows.innerHTML = html;
  rows.style.transform = `translateY(${hx.scaled ? Math.min(sc.scrollTop, hexMaxScroll()) : s.top * hx.rowH}px)`;
}
function hexRenderSoon(){ if (hx.raf) return; hx.raf = requestAnimationFrame(() => { hx.raf = 0; hexRender(); hexInspect(); }); }
function hexRefresh(){
  const t = hx.tab; if (!t) return; hexLayout(); hexRender(); hexInspect(); updateStatus();
  const b = $("#hxIns"); b.textContent = t.hex.ins ? "插入" : "覆寫"; b.setAttribute("aria-pressed", String(t.hex.ins));
}
function hexStatus(){
  const t = hx.tab || cur(); const s = t.hex, sel = hexSel(s);
  $("#stLen").textContent = "大小 " + fmtNum(s.buf.size) + " 位元組";
  $("#stLines").textContent = "Hex 檢視";
  $("#stPos").textContent = `位址 0x${s.cur.toString(16).toUpperCase()}（${fmtNum(s.cur)}）`;
  $("#stSel").textContent = sel ? `選取 ${fmtNum(sel[1] - sel[0])} 位元組` : "選取 0";
  $("#stEol").hidden = $("#stEnc").hidden = $("#stLang").hidden = true;
  $("#stIns").textContent = s.ins ? "INS" : "OVR";
}
function hexChanged(){
  const t = hx.tab; if (!t) return;
  hexRefresh(); hexEnsureVisible(t.hex.cur); hexRenderSoon();
  const sig = tabs.map(x => isDirty(x) ? 1 : 0).join(""); if (sig !== dirtySig) renderTabs();
  persistSoon();
}
function hexMoved(){ const t = hx.tab; if (!t) return; t.hex.lastEdit = null; hexEnsureVisible(t.hex.cur); hexRender(); hexInspect(); updateStatus(); }

/* --- data inspector --- */
function fmtTime(ms){ return Number.isFinite(ms) && ms >= 0 && ms <= 4102444800000 ? new Date(ms).toISOString().replace("T", " ").replace(/\.\d+Z$/, " UTC") : "超出合理範圍"; }
function fmtFloat(x){ return Number.isFinite(x) ? String(Number(x.toPrecision(9))) : String(x); }
function hexInspect(){
  const t = hx.tab; if (!t || !settings.hexInsp || $("#hexInsp").hidden) return; const s = t.hex, buf = s.buf, sel = hexSel(s), pos = sel ? sel[0] : s.cur, le = settings.hexLE;
  const R = buf.readSync(pos, 8); if (!R.ok) buf.load(R.need).then(() => { if (hx.tab === t) hexRenderSoon(); });
  const b = R.data, n = R.ok ? b.length : 0, dv = new DataView(b.buffer);
  const v = (need, f) => n >= need ? String(f()) : "—";
  const u8 = n ? utf8At(b, 0) : null, b5 = n >= 2 && b[0] >= 0x81 ? big5Char(b[0], b[1]) : null;
  const rows = [
    ["位址", `0x${pos.toString(16).toUpperCase()}（${fmtNum(pos)}）`],
    ...(sel ? [["選取長度", `${fmtNum(sel[1] - sel[0])}（0x${(sel[1] - sel[0]).toString(16).toUpperCase()}）`]] : []),
    ["二進位", v(1, () => b[0].toString(2).padStart(8, "0").replace(/^(\d{4})/, "$1 "))],
    ["int8", v(1, () => dv.getInt8(0))], ["uint8", v(1, () => b[0])],
    ["int16", v(2, () => dv.getInt16(0, le))], ["uint16", v(2, () => dv.getUint16(0, le))],
    ["int32", v(4, () => dv.getInt32(0, le))], ["uint32", v(4, () => dv.getUint32(0, le))],
    ["int64", v(8, () => dv.getBigInt64(0, le))], ["uint64", v(8, () => dv.getBigUint64(0, le))],
    ["float（32 位元）", v(4, () => fmtFloat(dv.getFloat32(0, le)))], ["double（64 位元）", v(8, () => fmtFloat(dv.getFloat64(0, le)))],
    ["time_t（32 位元）", v(4, () => fmtTime(dv.getUint32(0, le) * 1000))],
    ["FILETIME", v(8, () => fmtTime(Number(dv.getBigUint64(0, le) / 10000n) - 11644473600000))],
    ["UTF-8 字元", u8 ? `${String.fromCodePoint(u8.cp)}　U+${u8.cp.toString(16).toUpperCase().padStart(4, "0")}` : n && b[0] >= 0x20 && b[0] < 0x7F ? `${String.fromCharCode(b[0])}　U+00${HEXB[b[0]]}` : "—"],
    ["Big5 字元", b5 || "—"]
  ];
  const dl = $("#hexInspBody"); dl.replaceChildren();
  rows.forEach(([k, val]) => dl.append(el("dt", { text:k }), el("dd", { text:val })));
}

/* --- editing --- */
function hexByteAt(pos){ const R = hx.tab.hex.buf.readSync(pos, 1); return R.ok && R.data.length ? R.data[0] : -1; }
function hexEdit(pos, del, bytes, kind){
  const s = hx.tab.hex; const merge = kind === "type" && s.lastEdit === "type" && s.lastPos === pos;
  if (!merge){ s.undo.push({ p:s.buf.pieces, cur:s.cur, anchor:s.anchor }); if (s.undo.length > 1000) s.undo.shift(); }
  s.redo = []; s.buf.replace(pos, del, bytes); s.version++; s.lastEdit = kind;
}
function hexUndo(){ const t = hx.tab; if (!t) return; const s = t.hex, u = s.undo.pop(); if (!u){ toast("沒有可以復原的動作"); return; }
  s.redo.push({ p:s.buf.pieces, cur:s.cur, anchor:s.anchor }); s.buf.setPieces(u.p); s.cur = u.cur; s.anchor = u.anchor; s.nib = 0; s.version++; s.lastEdit = null; hexChanged(); }
function hexRedo(){ const t = hx.tab; if (!t) return; const s = t.hex, u = s.redo.pop(); if (!u){ toast("沒有可以重做的動作"); return; }
  s.undo.push({ p:s.buf.pieces, cur:s.cur, anchor:s.anchor }); s.buf.setPieces(u.p); s.cur = u.cur; s.anchor = u.anchor; s.nib = 0; s.version++; s.lastEdit = null; hexChanged(); }
function hexTypeHex(v){
  const s = hx.tab.hex, buf = s.buf, sel = hexSel(s);
  if (sel){ hexEdit(sel[0], sel[1] - sel[0], Uint8Array.of(v << 4), "replace"); s.cur = s.anchor = sel[0]; s.nib = 1; s.lastEdit = "type"; s.lastPos = s.cur; hexChanged(); return; }
  const pos = s.cur;
  if (s.nib === 0){
    if (s.ins || pos >= buf.size) hexEdit(pos, 0, Uint8Array.of(v << 4), "type");
    else { const old = hexByteAt(pos); if (old < 0) return; hexEdit(pos, 1, Uint8Array.of((v << 4) | (old & 15)), "type"); }
    s.nib = 1;
  } else { const old = hexByteAt(pos); if (old < 0) return; hexEdit(pos, 1, Uint8Array.of((old & 0xF0) | v), "type"); s.nib = 0; s.cur = s.anchor = pos + 1; }
  s.lastPos = s.cur; hexChanged();
}
function hexEncodeText(str, silent){
  const enc = settings.hexEnc;
  if (enc === "utf-8") return new TextEncoder().encode(str);
  const out = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++){
    const c = str.charCodeAt(i); let b = c < 0x80 ? c : enc === "windows-1252" ? W1252.indexOf(str[i]) : -1;
    if (b < 0){ if (!silent) toast(enc === "big5" ? "Big5 模式只能直接輸入英數字元。中文請在 Hex 欄輸入，或把文字欄編碼改成 UTF-8" : "這個字元無法用目前的文字欄編碼表示，請改用 UTF-8"); return null; }
    out[i] = b;
  }
  return out;
}
function hexPutBytes(bytes, kind){
  const s = hx.tab.hex, sel = hexSel(s); let pos = s.cur;
  if (sel){ pos = sel[0]; hexEdit(pos, sel[1] - sel[0], bytes, "replace"); }
  else if (s.ins || pos >= s.buf.size) hexEdit(pos, 0, bytes, kind);
  else hexEdit(pos, Math.min(bytes.length, s.buf.size - pos), bytes, kind);
  s.cur = s.anchor = pos + bytes.length; s.nib = 0; s.lastPos = s.cur; hexChanged();
}
function hexTypeText(str){ const bytes = hexEncodeText(str); if (bytes && bytes.length) hexPutBytes(bytes, "type"); }
function hexDelete(forward){
  const s = hx.tab.hex, sel = hexSel(s);
  if (sel){ hexEdit(sel[0], sel[1] - sel[0], null, "del"); s.cur = s.anchor = sel[0]; }
  else if (forward){ if (s.cur >= s.buf.size) return; hexEdit(s.cur, 1, null, "del"); }
  else { if (s.cur <= 0) return; hexEdit(s.cur - 1, 1, null, "del"); s.cur = s.anchor = s.cur - 1; }
  s.nib = 0; hexChanged();
}
function hexParseHex(txt){
  const clean = txt.replace(/\\x|0x/gi, "").replace(/[\s,;:{}\[\]()-]/g, "");
  if (!clean || /[^0-9a-f]/i.test(clean) || clean.length % 2) return null;
  const out = new Uint8Array(clean.length / 2); for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.substr(i * 2, 2), 16); return out;
}
function hexPaste(txt){
  if (!txt) return; const s = hx.tab.hex; let bytes;
  if (s.col === "hex"){ bytes = hexParseHex(txt); if (!bytes){ toast("剪貼簿內容不是 hex 字串（例如 4D 5A 90 00）。要貼上文字請先按 Tab 切到右邊的文字欄"); return; } }
  else { bytes = hexEncodeText(txt); if (!bytes) return; }
  hexPutBytes(bytes, "paste"); toast(`已貼上 ${fmtNum(bytes.length)} 位元組`);
}
function hexDecodeText(d){ try { return new TextDecoder(settings.hexEnc === "ascii" ? "windows-1252" : settings.hexEnc).decode(d); } catch(e){ return new TextDecoder().decode(d); } }
function hexClipText(){
  const s = hx.tab.hex, sel = hexSel(s); if (!sel){ toast("先選取要複製的範圍（Shift + 方向鍵，或用滑鼠拖曳）"); return null; }
  const len = sel[1] - sel[0]; const R = len <= 4 << 20 ? s.buf.readSync(sel[0], len) : null;
  if (!R || !R.ok){ toast("選取範圍太大，請改用「Hex」選單裡的「複製選取範圍為」"); return null; }
  return s.col === "hex" ? Array.from(R.data, b => HEXB[b]).join(" ") : hexDecodeText(R.data);
}
async function hexCopyAs(kind){
  const t = hx.tab; if (!t) return; const s = t.hex, sel = hexSel(s); if (!sel){ toast("先選取要複製的範圍（Shift + 方向鍵，或用滑鼠拖曳）"); return; }
  const len = sel[1] - sel[0]; if (len > 8 << 20){ toast("選取範圍超過 8 MB，無法複製到剪貼簿"); return; }
  const d = await s.buf.readAsync(sel[0], len); let out;
  if (kind === "hex") out = Array.from(d, b => HEXB[b]).join(" ");
  else if (kind === "c" || kind === "cs"){ const lines = []; for (let i = 0; i < d.length; i += 16) lines.push("    " + Array.from(d.subarray(i, i + 16), b => "0x" + HEXB[b]).join(", "));
    out = (kind === "c" ? `unsigned char data[${len}] = {\n` : `byte[] data = new byte[] {\n`) + lines.join(",\n") + "\n};"; }
  else if (kind === "b64"){ let bin = ""; for (let i = 0; i < d.length; i += 0x8000) bin += String.fromCharCode.apply(null, d.subarray(i, i + 0x8000)); out = btoa(bin); }
  else out = hexDecodeText(d);
  toast((await copyText(out)) ? `已複製 ${fmtNum(len)} 位元組` : "瀏覽器拒絕寫入剪貼簿");
}
function hexSelectAll(){ const t = hx.tab; if (!t) return; t.hex.anchor = 0; t.hex.cur = t.hex.buf.size; t.hex.nib = 0; hexMovedNoScroll(); }
function hexMovedNoScroll(){ const t = hx.tab; t.hex.lastEdit = null; hexRender(); hexInspect(); updateStatus(); }
function hexToggleIns(){ const t = hx.tab; if (!t) return; t.hex.ins = !t.hex.ins; t.hex.nib = 0; hexRefresh(); }

/* --- goto & search --- */
function parseOffset(str, base){
  str = str.trim(); let rel = 0; if (/^[+-]/.test(str)){ rel = str[0] === "+" ? 1 : -1; str = str.slice(1).trim(); }
  let n;
  if (/^0x[0-9a-f]+$/i.test(str)) n = parseInt(str.slice(2), 16); else if (/^[0-9a-f]+h$/i.test(str)) n = parseInt(str.slice(0, -1), 16);
  else if (/^\d+$/.test(str)) n = parseInt(str, 10); else if (/^[0-9a-f]+$/i.test(str)) n = parseInt(str, 16); else return null;
  return rel ? base + rel * n : n;
}
async function hexGoto(){
  const t = hx.tab; if (!t) return; const s = t.hex;
  const v = await promptText({ title:"跳至位址", text:`檔案大小 0x${s.buf.size.toString(16).toUpperCase()}（${fmtNum(s.buf.size)}）。0x1F4 或 1F4h 是 16 進位，500 是 10 進位；+100、-0x20 是從目前位置相對移動。`, value:"0x" + s.cur.toString(16).toUpperCase(), ok:"跳至" });
  if (v == null || hx.tab !== t) return; const n = parseOffset(v, s.cur); if (n == null || Number.isNaN(n)){ toast("看不懂這個位址"); return; }
  s.cur = s.anchor = Math.max(0, Math.min(n, s.buf.size)); s.nib = 0; s.lastEdit = null; hexEnsureVisible(s.cur, true); hexRender(); hexInspect(); updateStatus(); focusEditor();
}
async function hexSelRange(){
  const t = hx.tab; if (!t) return; const s = t.hex;
  const v = await promptText({ title:"選取範圍", text:"輸入「起點, 長度」，例如 0x100, 64 或 256, 0x40。數字規則和「跳至位址」相同。", value:"0x" + s.cur.toString(16).toUpperCase() + ", 16", ok:"選取" });
  if (v == null || hx.tab !== t) return; const parts = v.split(/[,，]/); const a = parseOffset(parts[0] || "", s.cur), n = parseOffset(parts[1] || "", 0);
  if (a == null || n == null || n < 0){ toast("格式不正確，請輸入「起點, 長度」"); return; }
  s.anchor = Math.max(0, Math.min(a, s.buf.size)); s.cur = Math.min(s.buf.size, s.anchor + n); s.nib = 0; s.lastEdit = null; hexEnsureVisible(s.anchor, true); hexRender(); hexInspect(); updateStatus(); focusEditor();
}
function hexPattern(){
  const raw = $("#hxFind").value; if (!raw.trim()) return null;
  if (hx.findMode === "hex"){
    const out = [];
    for (const tk of raw.replace(/\\x|0x/gi, " ").replace(/[,;]/g, " ").trim().split(/\s+/)){
      if (/^\?{1,2}$/.test(tk)){ out.push(-1); continue; }
      if (!/^[0-9a-f]+$/i.test(tk) || tk.length % 2) return { error:"Hex 格式不正確，例如：4D 5A ?? 00" };
      for (let i = 0; i < tk.length; i += 2) out.push(parseInt(tk.substr(i, 2), 16));
    }
    return out.length ? { pat:out, ci:false } : null;
  }
  const bytes = hexEncodeText(raw, true); if (!bytes) return { error:"這段文字無法用目前的文字欄編碼表示" };
  const ci = !hx.findCase; return { pat: Array.from(bytes, b => ci && b >= 65 && b <= 90 ? b | 32 : b), ci };
}
function hexMatchAt(d, p, pat, ci){ for (let j = 0; j < pat.length; j++){ const q = pat[j]; if (q < 0) continue; let b = d[p + j]; if (ci && b >= 65 && b <= 90) b |= 32; if (b !== q) return false; } return true; }
async function hexFindNext(dir){
  const t = hx.tab; if (!t) return; const P = hexPattern(), info = $("#hxInfo");
  if (!P){ $("#hxFind").focus(); return; }
  info.classList.toggle("is-error", !!P.error); if (P.error){ info.textContent = P.error; return; }
  const s = t.hex, buf = s.buf, pat = P.pat, ci = P.ci, m = pat.length, size = buf.size, CH = 16 << 20;
  if (m > size){ info.textContent = "找不到"; return; }
  const sel = hexSel(s), from = dir > 0 ? (sel ? sel[0] + 1 : s.cur) : (sel ? sel[0] : s.cur);
  const tok = ++hx.findTok, t0 = performance.now(); let scanned = 0;
  const first = pat[0] >= 0 && !(ci && pat[0] >= 97 && pat[0] <= 122) ? pat[0] : -1;
  const tick = n => { scanned += n; if (performance.now() - t0 > 250) info.textContent = `搜尋中… ${Math.min(99, Math.floor(scanned / size * 100))}%`; };
  async function fwd(a0, a1){
    for (let a = a0; a < a1; a += CH){
      if (tok !== hx.findTok) return -2; const b = Math.min(a1, a + CH), d = await buf.readAsync(a, b - a + m - 1), lim = b - a;
      for (let p = 0; ; p++){ if (first >= 0){ p = d.indexOf(first, p); if (p < 0) break; } if (p >= lim || p + m > d.length) break; if (hexMatchAt(d, p, pat, ci)) return a + p; }
      tick(lim);
    }
    return -1;
  }
  async function bwd(a0, a1){
    for (let b = a1; b > a0; b -= CH){
      if (tok !== hx.findTok) return -2; const a = Math.max(a0, b - CH), d = await buf.readAsync(a, b - a + m - 1);
      for (let p = Math.min(b - a, d.length - m + 1) - 1; p >= 0; p--){ if (first >= 0){ p = d.lastIndexOf(first, p); if (p < 0) break; } if (hexMatchAt(d, p, pat, ci)) return a + p; }
      tick(b - a);
    }
    return -1;
  }
  let at, wrapped = false;
  if (dir > 0){ at = await fwd(from, size); if (at === -1 && from > 0){ at = await fwd(0, Math.min(from, size)); wrapped = at >= 0; } }
  else { at = await bwd(0, from); if (at === -1 && from < size){ at = await bwd(from, size); wrapped = at >= 0; } }
  if (at === -2 || tok !== hx.findTok || hx.tab !== t) return;
  if (at < 0){ info.textContent = "找不到"; return; }
  s.anchor = at; s.cur = at + m; s.nib = 0; s.lastEdit = null; hexEnsureVisible(at, true); hexRender(); hexInspect(); updateStatus();
  info.textContent = `找到：0x${at.toString(16).toUpperCase()}` + (wrapped ? (dir > 0 ? "（已從頭開始）" : "（已從尾端開始）") : "");
}
function hexFocusFind(){ const f = $("#hxFind"); f.focus(); f.select(); }

/* --- save --- */
const CRC_T = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++){ let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
/* Minimal ZIP writer: one stored (uncompressed) entry, so the bytes inside are exactly the file. */
async function makeZip(name, blob){
  let crc = 0xFFFFFFFF; const CH = 8 << 20;
  for (let a = 0; a < blob.size; a += CH){ const d = new Uint8Array(await blob.slice(a, a + CH).arrayBuffer()); for (let i = 0; i < d.length; i++) crc = CRC_T[(crc ^ d[i]) & 255] ^ (crc >>> 8);
    if (blob.size > CH) toast(`正在封裝… ${Math.min(100, Math.round((a + d.length) / blob.size * 100))}%`); }
  crc = (crc ^ 0xFFFFFFFF) >>> 0;
  const fn = new TextEncoder().encode(name), now = new Date(), size = blob.size;
  const time = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1), date = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  const lh = new DataView(new ArrayBuffer(30)); lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(10, time, true); lh.setUint16(12, date, true); lh.setUint32(14, crc, true); lh.setUint32(18, size, true); lh.setUint32(22, size, true); lh.setUint16(26, fn.length, true);
  const cd = new DataView(new ArrayBuffer(46)); cd.setUint32(0, 0x02014b50, true); cd.setUint16(4, 20, true); cd.setUint16(6, 20, true); cd.setUint16(8, 0x0800, true); cd.setUint16(12, time, true); cd.setUint16(14, date, true); cd.setUint32(16, crc, true); cd.setUint32(20, size, true); cd.setUint32(24, size, true); cd.setUint16(28, fn.length, true);
  const eo = new DataView(new ArrayBuffer(22)); eo.setUint32(0, 0x06054b50, true); eo.setUint16(8, 1, true); eo.setUint16(10, 1, true); eo.setUint32(12, 46 + fn.length, true); eo.setUint32(16, 30 + fn.length + size, true);
  return new Blob([lh, fn, blob, cd, fn, eo]);
}
async function hexSave(t, asNew){
  let name = t.name; const s = t.hex;
  if (s.loading){ toast("內容還在載入，請稍候再存"); return false; }
  if (asNew && !NATIVE){ const v = await promptText({ title:"另存新檔", text:"輸入檔名。", value:name, ok:"儲存" }); if (v == null || !v.trim()) return false; name = v.trim(); }
  const dl = await getDownloads(); if (!dl){ toast("這個檢視無法下載檔案"); return false; }
  const blob = s.buf.toBlob(); let fname = name, data = blob;
  if (!LOCAL && !DL_EXT.has(extOf(name))){
    const tooBig = blob.size > 0xFFFF0000;
    const r = await ask({ title:`「${name}」無法用原本的副檔名下載`, text:`網頁沙盒只允許下載 png、pdf、zip、txt 等少數格式。可以包成「${name}.zip」，解壓縮後就是原檔（不壓縮、內容一個位元組都不變）；或存成「${name}.txt」，下載後把結尾的 .txt 刪掉。`,
      actions:[{ id:"cancel", label:"取消" }, { id:"txt", label:"存成 .txt", primary:tooBig }, ...(tooBig ? [] : [{ id:"zip", label:"包成 .zip", primary:true }])] });
    if (r === "zip"){ data = await makeZip(name, blob); fname = name + ".zip"; } else if (r === "txt") fname = name + ".txt"; else return false;
  }
  try { const r = await dl.save({ filename:fname, data, path: asNew ? null : t.path }); if (r && r.path){ t.path = r.path; name = fname = r.filename; } }
  catch(e){ const code = e && e.code; toast(code === "declined" ? "已取消儲存" : code === "rate_limited" ? "已有一個儲存對話框開著，請先處理" : "無法儲存：" + ((e && e.message) || code || "未知錯誤")); return false; }
  s.buf = new HexBuf(blob); s.clean = s.buf.pieces; s.undo = []; s.redo = []; s.version++; s.lastEdit = null; t.name = name;
  renderTabs(); if (hx.tab === t){ hx.sig = ""; hexRefresh(); } persistSoon(); toast("已儲存 " + fname); return true;
}

/* --- switch a tab between text and hex in place --- */
async function toggleHexView(t = cur()){
  const i = tabs.indexOf(t); if (i < 0) return; if (i !== active) activateTab(i);
  if (cmp.on) endCompare(); if (t === split.tab && !$("#pane2").hidden) closeSplit();
  let nt;
  if (!isHex(t)){
    const dirty = isDirty(t);
    let blob;
    if (t.bytes && !dirty) blob = new Blob([t.bytes]);
    else { const e = encodeText(t.doc.getValue(EOLS[t.eol]), t.encoding, t.bom && bomCapable(normEnc(t.encoding))); blob = new Blob([e.bytes]); if (e.badCount) toast(`有 ${e.badCount} 個字元無法用 ${ENC_LABEL[normEnc(t.encoding)]} 表示，在 Hex 中顯示為 ?`); }
    nt = makeHexTab({ name:t.name, path:t.path, blob, dirty }); docDel(t.id);
  } else {
    const s = t.hex; if (s.loading) return;
    if (s.buf.size > 25 * 1024 * 1024){ toast("超過 25 MB 的檔案只能用 Hex 檢視"); return; }
    const data = await s.buf.readAsync(0, s.buf.size), dirty = isDirty(t), r = decode(data.buffer);
    if (looksBinary(data.buffer)) toast("這看起來是二進位檔，以文字顯示可能會是亂碼；在文字檢視下修改再存檔會破壞內容");
    nt = makeTab({ name:t.name, path:t.path, text:r.text, eol:detectEol(r.text), bom:r.bom, encoding:r.encoding, bytes: dirty ? null : data.buffer, dirty });
    hexForget(t.id);
  }
  const j = tabs.indexOf(t); if (j < 0) return;
  tabs[j] = nt; cm = cmMain; active = -1; activateTab(j, true); renderTabs(); persistSoon(); focusEditor();
}

/* --- input --- */
const hexInput = $("#hexInput");
hexInput.addEventListener("focus", () => { cm = cmMain; $("#hexView").classList.add("focused"); $("#pane1").classList.add("is-focus"); $("#pane2").classList.remove("is-focus"); updateStatus(); });
hexInput.addEventListener("blur", () => $("#hexView").classList.remove("focused"));
hexInput.addEventListener("keydown", e => {
  const t = hx.tab; if (!t || e.isComposing || t.hex.loading) return; const s = t.hex, cols = settings.hexCols, size = s.buf.size, k = e.key;
  const mod = isMac ? e.metaKey : e.ctrlKey;
  if (mod && !e.altKey){
    const kk = k.toLowerCase();
    if (kk === "z"){ e.preventDefault(); e.shiftKey ? hexRedo() : hexUndo(); return; }
    if (kk === "y"){ e.preventDefault(); hexRedo(); return; }
    if (kk === "a"){ e.preventDefault(); hexSelectAll(); return; }
    if (kk === "c" || kk === "x"){ const txt = hexClipText(); if (txt == null){ e.preventDefault(); return; }
      hexInput.value = txt; hexInput.select(); setTimeout(() => { hexInput.value = ""; if (kk === "x") hexDelete(true); }, 0); return; }
    if (kk === "v") return;
  }
  let to = null; const vis = hexVisRows(), rowStart = s.cur - s.cur % cols;
  if (k === "ArrowLeft") to = mod ? rowStart : s.cur - 1;
  else if (k === "ArrowRight") to = mod ? Math.min(rowStart + cols - 1, size) : s.cur + 1;
  else if (k === "ArrowUp") to = mod ? 0 : (s.cur - cols >= 0 ? s.cur - cols : s.cur);
  else if (k === "ArrowDown") to = mod ? size : (s.cur + cols <= size ? s.cur + cols : (Math.floor(s.cur / cols) < Math.floor(size / cols) ? size : s.cur));
  else if (k === "PageUp") to = Math.max(s.cur % cols, s.cur - vis * cols);
  else if (k === "PageDown") to = Math.min(size, s.cur + vis * cols);
  else if (k === "Home") to = mod || e.ctrlKey ? 0 : rowStart;
  else if (k === "End") to = mod || e.ctrlKey ? size : Math.min(rowStart + cols - 1, size);
  if (to !== null){ e.preventDefault(); s.cur = Math.max(0, Math.min(to, size)); if (!e.shiftKey) s.anchor = s.cur; s.nib = 0; hexMoved(); return; }
  if (k === "Tab"){ e.preventDefault(); s.col = s.col === "hex" ? "text" : "hex"; s.nib = 0; hexMoved(); return; }
  if (k === "Insert"){ e.preventDefault(); hexToggleIns(); return; }
  if (k === "Delete"){ e.preventDefault(); hexDelete(true); return; }
  if (k === "Backspace"){ e.preventDefault(); hexDelete(false); return; }
  if (k === "Escape"){ if (hexSel(s)){ e.preventDefault(); e.stopPropagation(); s.anchor = s.cur; hexMoved(); } return; }
  if (k.length === 1 && !e.ctrlKey && !e.metaKey){
    e.preventDefault();
    if (s.col === "hex"){ if (/^[0-9a-f]$/i.test(k)) hexTypeHex(parseInt(k, 16)); }
    else hexTypeText(k);
  }
});
hexInput.addEventListener("paste", e => { e.preventDefault(); if (hx.tab) hexPaste(e.clipboardData.getData("text/plain")); });
hexInput.addEventListener("compositionend", () => setTimeout(() => { const v = hexInput.value; hexInput.value = ""; if (v && hx.tab && hx.tab.hex.col === "text") hexTypeText(v); }, 0));
(() => {
  const sc = $("#hexScroll");
  const place = (j, origin) => { const s = hx.tab.hex, size = s.buf.size; s.nib = 0;
    if (j === origin){ s.anchor = s.cur = origin; } else if (j > origin){ s.anchor = origin; s.cur = Math.min(size, j + 1); } else { s.anchor = Math.min(size, origin + 1); s.cur = j; } };
  sc.addEventListener("pointerdown", e => {
    if (e.button !== 0 || !hx.tab) return; const cell = e.target.closest("[data-i]");
    if (e.target === sc) return;            // native scrollbar
    e.preventDefault(); hexInput.focus({ preventScroll:true }); if (!cell) return;
    const s = hx.tab.hex, i = +cell.dataset.i; s.col = cell.classList.contains("ht") ? "text" : "hex"; s.lastEdit = null;
    const sel = hexSel(s); const origin = e.shiftKey ? (sel ? (s.anchor < s.cur ? s.anchor : s.anchor - 1) : s.cur) : i;
    hx.drag = { origin }; place(i, origin); try { sc.setPointerCapture(e.pointerId); } catch(_){}
    hexRender(); hexInspect(); updateStatus();
  });
  sc.addEventListener("pointermove", e => {
    if (!hx.drag || !hx.tab) return; const s = hx.tab.hex, r = sc.getBoundingClientRect();
    if (e.clientY < r.top + hx.headH) hexSetTop(s.top - 1); else if (e.clientY > r.bottom - 4) hexSetTop(s.top + 1);
    const y = Math.max(r.top + hx.headH + 2, Math.min(e.clientY, r.bottom - 6));
    const elx = document.elementFromPoint(Math.max(r.left + 2, Math.min(e.clientX, r.right - 20)), y); const cell = elx && elx.closest && elx.closest("#hexRows [data-i]");
    if (!cell){ hexRender(); return; }
    const before = s.cur + "|" + s.anchor; place(+cell.dataset.i, hx.drag.origin);
    if (before !== s.cur + "|" + s.anchor){ hexRender(); hexInspect(); updateStatus(); }
  });
  const end = () => { hx.drag = null; };
  sc.addEventListener("pointerup", end); sc.addEventListener("pointercancel", end);
  sc.addEventListener("scroll", () => {
    if (!hx.tab) return;
    if (hx.ignore != null && Math.abs(sc.scrollTop - hx.ignore) < 2){ hx.ignore = null; hexRenderSoon(); return; }
    hx.ignore = null; const maxTop = Math.max(0, hexTotalRows() - hexVisRows()), ms = hexMaxScroll();
    hx.tab.hex.top = hx.scaled ? Math.round(ms ? sc.scrollTop / ms * maxTop : 0) : Math.min(maxTop, Math.floor(sc.scrollTop / hx.rowH + 0.01));
    hexRenderSoon();
  });
  /* Huge files compress millions of rows into a capped scroll height, so the wheel steps by rows instead of pixels. */
  sc.addEventListener("wheel", e => {
    if (!hx.tab || !hx.scaled || e.ctrlKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return; e.preventDefault();
    hx.wheel += e.deltaMode === 1 ? e.deltaY * hx.rowH : e.deltaY; const rows = Math.trunc(hx.wheel / hx.rowH);
    if (rows){ hx.wheel -= rows * hx.rowH; hexSetTop(hx.tab.hex.top + rows); hexRenderSoon(); }
  }, { passive:false });
  if (window.ResizeObserver) new ResizeObserver(() => { if (hx.tab && !$("#hexWrap").hidden) hexRefresh(); }).observe(sc);
})();

/* --- hex toolbar --- */
function hexSetCols(n){ settings.hexCols = n; $("#hxCols").value = String(n); persistSoon(); if (hx.tab){ hexRefresh(); hexEnsureVisible(hx.tab.hex.cur, true); hexRender(); } }
function hexSetEnc(v){ settings.hexEnc = v; $("#hxEnc").value = v; persistSoon(); if (hx.tab){ hexRender(); } }
function hexSetInsp(on){ settings.hexInsp = on; $("#hexInsp").hidden = !on; $("#hxInspBtn").setAttribute("aria-pressed", String(on)); persistSoon(); if (hx.tab){ hx.sig = ""; hexRefresh(); } }
function hexSetLE(le){ settings.hexLE = le; document.querySelectorAll("#hxEndian button").forEach(b => b.setAttribute("aria-pressed", String((b.dataset.le === "1") === le))); persistSoon(); hexInspect(); }
HEX_ENCS.forEach(([v, l]) => $("#hxEnc").append(el("option", { value:v, text:l })));
$("#hxCols").addEventListener("change", e => { hexSetCols(+e.target.value); focusEditor(); });
$("#hxEnc").addEventListener("change", e => { hexSetEnc(e.target.value); focusEditor(); });
$("#hxIns").addEventListener("click", () => { hexToggleIns(); focusEditor(); });
$("#hxGoto").addEventListener("click", () => hexGoto());
$("#hxInspBtn").addEventListener("click", () => { hexSetInsp(!settings.hexInsp); focusEditor(); });
$("#hxText").addEventListener("click", () => toggleHexView());
$("#hxPrev").addEventListener("click", () => hexFindNext(-1));
$("#hxNext").addEventListener("click", () => hexFindNext(1));
$("#hxCase").addEventListener("click", e => { hx.findCase = !hx.findCase; e.currentTarget.setAttribute("aria-pressed", String(hx.findCase)); });
$("#hxFind").addEventListener("keydown", e => { if (e.key === "Enter"){ e.preventDefault(); hexFindNext(e.shiftKey ? -1 : 1); } else if (e.key === "Escape"){ e.preventDefault(); e.stopPropagation(); focusEditor(); } });
document.querySelectorAll("#hxFindMode button").forEach(b => b.addEventListener("click", () => {
  hx.findMode = b.dataset.m; document.querySelectorAll("#hxFindMode button").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
  $("#hxFind").placeholder = hx.findMode === "hex" ? "搜尋 hex：4D 5A ?? 00" : "搜尋文字"; $("#hxCase").hidden = hx.findMode === "hex"; $("#hxFind").focus(); }));
document.querySelectorAll("#hxEndian button").forEach(b => b.addEventListener("click", () => hexSetLE(b.dataset.le === "1")));

