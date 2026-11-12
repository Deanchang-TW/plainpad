/* ---------- encodings ----------
   Tab encodings are canonical WHATWG labels. Saving re-encodes in the same encoding the file was opened with.
   Legacy encoders are built from the browser's own decoder, so whatever was read can be written back the same way. */
const ENC_LABEL = Object.fromEntries(ENCODINGS.map(([id, l]) => [id, l.replace(/（.*）/, "")]));
const LEGACY_ENC = { "UTF-8":"utf-8", "UTF-16 LE":"utf-16le", "UTF-16 BE":"utf-16be", "Big5":"big5", "GB18030":"gb18030", "Shift_JIS":"shift_jis", "EUC-KR":"euc-kr", "Windows-1252":"windows-1252" };
function normEnc(e){ return ENC_LABEL[e] ? e : LEGACY_ENC[e] || "utf-8"; }
function encLabel(t){ const e = normEnc(t.encoding); return ENC_LABEL[e] + (t.bom && bomCapable(e) ? " BOM" : ""); }
const bomCapable = e => e === "utf-8" || e === "utf-16le" || e === "utf-16be";
const encTables = {};
function encTable(enc){
  if (encTables[enc]) return encTables[enc];
  const map = new Map(), dec = new TextDecoder(enc);
  const add = (str, bytes) => { if (!str || str.includes("\uFFFD")) return; const cps = [...str]; if (cps.length !== 1) return; const cp = cps[0].codePointAt(0); if (cp < 0x80 || map.has(cp)) return; map.set(cp, bytes); };
  for (let b = 0x80; b <= 0xFF; b++){ const ch = dec.decode(Uint8Array.of(b)); if (ch.length === 1 && !/\p{Cc}/u.test(ch)) add(ch, Uint8Array.of(b)); }
  const R = { big5:[[0xA1, 0xFE], [0x81, 0xA0]], gb18030:[[0x81, 0xFE]], shift_jis:[[0x81, 0x9F], [0xE0, 0xFC]], "euc-kr":[[0x81, 0xFE]] }[enc] || [];
  for (const [lo, hi] of R) for (let lead = lo; lead <= hi; lead++){
    const trails = []; for (let tb = 0x40; tb <= 0xFE; tb++) if (tb !== 0x7F) trails.push(tb);
    const buf = new Uint8Array(trails.length * 3); trails.forEach((tb, i) => { buf[i * 3] = lead; buf[i * 3 + 1] = tb; buf[i * 3 + 2] = 10; });
    dec.decode(buf).split("\n").forEach((seg, i) => { if (i < trails.length) add(seg, Uint8Array.of(lead, trails[i])); });
  }
  if (enc === "gb18030"){
    const seqs = []; for (let a = 0x81; a <= 0x84; a++) for (let b = 0x30; b <= 0x39; b++) for (let c = 0x81; c <= 0xFE; c++) for (let d = 0x30; d <= 0x39; d++) seqs.push([a, b, c, d]);
    const buf = new Uint8Array(seqs.length * 5); seqs.forEach((q, i) => { buf.set(q, i * 5); buf[i * 5 + 4] = 10; });
    dec.decode(buf).split("\n").forEach((seg, i) => { if (i < seqs.length) add(seg, Uint8Array.from(seqs[i])); });
  }
  return (encTables[enc] = map);
}
/* Returns the file bytes for text in enc. Characters the encoding cannot represent are written as "?" and reported. */
function encodeText(text, enc, bom){
  enc = normEnc(enc); const bad = new Map(); let n = 0, out;
  if (enc === "utf-8"){ const b = new TextEncoder().encode(text); out = bom ? new Uint8Array(b.length + 3) : b; if (bom){ out.set([0xEF, 0xBB, 0xBF]); out.set(b, 3); } return { bytes: out, bad:[], badCount:0 }; }
  if (enc === "utf-16le" || enc === "utf-16be"){
    const le = enc === "utf-16le", off = bom ? 2 : 0; out = new Uint8Array(off + text.length * 2);
    if (bom){ out[0] = le ? 0xFF : 0xFE; out[1] = le ? 0xFE : 0xFF; }
    for (let i = 0; i < text.length; i++){ const c = text.charCodeAt(i); out[off + i * 2] = le ? c & 255 : c >> 8; out[off + i * 2 + 1] = le ? c >> 8 : c & 255; }
    return { bytes: out, bad:[], badCount:0 };
  }
  const table = encTable(enc); out = new Uint8Array(text.length * 4);
  for (const ch of text){
    const cp = ch.codePointAt(0);
    if (cp < 0x80){ out[n++] = cp; continue; }
    let b = table.get(cp);
    if (!b && enc === "gb18030" && cp >= 0x10000){ let v = cp - 0x10000; const q = [0, 0, 0, 0]; q[3] = 0x30 + v % 10; v = Math.floor(v / 10); q[2] = 0x81 + v % 126; v = Math.floor(v / 126); q[1] = 0x30 + v % 10; q[0] = 0x90 + Math.floor(v / 10); b = Uint8Array.from(q); }
    if (b){ out.set(b, n); n += b.length; } else { out[n++] = 0x3F; bad.set(ch, (bad.get(ch) || 0) + 1); }
  }
  let badCount = 0; bad.forEach(v => badCount += v);
  return { bytes: out.slice(0, n), bad:[...bad.keys()], badCount };
}
const LANG_HINTS = (() => {
  const set = s => new Set([...s]);
  return {
    han: set("的一是不了在人有我他這个個們们中來来上大為为和國国地到以說说時时要就出會会可也你對对生能而子那得於于著着下自之年過过發发後后作裡里用道行所然家種种事成方多經经麼么去法學学如都同現现當当沒没動动面起看定天分還还進进好小部其些主樣样理心她本前開开但因只從从想實实日者意無无力它與与長长把機机十民第公此已工使情明性知全三又關关點点正業业外將将兩两高間间由問问很最重並并物手應应向頭头文體体政美相見见被利什二等產产或新己制身果加西斯月話话合回特代內内信表化老給给世位次度門门任常先海通教兒儿原東东聲声提立及比員员解水名真論论處处走義义各入幾几口認认條条平系氣气題题活更別别打女變变四神總总何電电數数安少報报才結结反受目太量再感建務务做接必場场件計计管期市直資资命山金指"),
    kana: /[ぁ-ヺ]/, hangul: set("이의다는에하을를가고지기로한서사대도자리수아일나시정어해인구들것있그보게국만상전부등적주제으와성생장무위동년과소각연경문화미우저학했니요면원진개중마공비여라실터신오내될계은할거히반")
  };
})();
function scoreDecoding(txt, enc){
  let s = 0;
  for (const ch of txt){
    const c = ch.codePointAt(0); if (c < 0x80) continue;
    if (c === 0xFFFD){ s -= 30; continue; }
    if (c >= 0xE000 && c <= 0xF8FF){ s -= 5; continue; }
    if (LANG_HINTS.han.has(ch)) s += 2;
    else if (enc === "shift_jis" && LANG_HINTS.kana.test(ch)) s += 2;
    else if (enc === "euc-kr" && LANG_HINTS.hangul.has(ch)) s += 2;
  }
  return s;
}
/* Picks the legacy encoding whose decoding yields the most common CJK characters; falls back to Windows-1252 for Western text. */
function guessLegacy(u8){
  const sample = u8.subarray(0, Math.min(u8.length, 256 * 1024)); let best = null;
  for (const enc of ["big5", "gb18030", "shift_jis", "euc-kr"]){
    let txt; try { txt = new TextDecoder(enc).decode(sample); } catch(e){ continue; }
    const sc = scoreDecoding(txt, enc); if (!best || sc > best.sc) best = { enc, sc };
  }
  return best && best.sc >= 6 ? best.enc : "windows-1252";
}
function decode(buf, enc){
  const u8 = new Uint8Array(buf);
  if (enc){
    let start = 0, bom = false;
    if (enc === "utf-8" && u8[0] === 0xEF && u8[1] === 0xBB && u8[2] === 0xBF){ start = 3; bom = true; }
    if (enc === "utf-16le" && u8[0] === 0xFF && u8[1] === 0xFE){ start = 2; bom = true; }
    if (enc === "utf-16be" && u8[0] === 0xFE && u8[1] === 0xFF){ start = 2; bom = true; }
    return { text: new TextDecoder(enc).decode(u8.subarray(start)), encoding: enc, bom };
  }
  if (u8[0] === 0xEF && u8[1] === 0xBB && u8[2] === 0xBF) return { text: new TextDecoder("utf-8").decode(u8.subarray(3)), encoding:"utf-8", bom:true };
  if (u8[0] === 0xFF && u8[1] === 0xFE) return { text: new TextDecoder("utf-16le").decode(u8.subarray(2)), encoding:"utf-16le", bom:true };
  if (u8[0] === 0xFE && u8[1] === 0xFF) return { text: new TextDecoder("utf-16be").decode(u8.subarray(2)), encoding:"utf-16be", bom:true };
  try { return { text: new TextDecoder("utf-8", { fatal:true }).decode(u8), encoding:"utf-8", bom:false }; }
  catch(e){ const g = guessLegacy(u8); return { text: new TextDecoder(g).decode(u8), encoding:g, bom:false, guessed:true }; }
}
function looksBinary(buf){
  const head = new Uint8Array(buf.slice(0, 8000));
  const isUtf16 = (head[0] === 0xFF && head[1] === 0xFE) || (head[0] === 0xFE && head[1] === 0xFF);
  if (isUtf16) return false;
  let nulls = 0; for (const b of head) if (b === 0) nulls++;
  return nulls > 8;
}
async function openFileObj(f, path){
  if (f.size > 25 * 1024 * 1024) return openHexFile(f, path, "超過 25 MB，以 Hex 檢視開啟");
  const buf = await f.arrayBuffer();
  if (looksBinary(buf)) return openHexFile(f, path, "是二進位檔，以 Hex 檢視開啟");
  const key = path || f.name;
  const existing = tabs.findIndex(t => (t.path || t.name) === key && !isDirty(t) && t.bytes);
  const r = decode(buf);
  const t = makeTab({ name:f.name, path: path || null, text:r.text, eol:detectEol(r.text), bom:r.bom, encoding:r.encoding, bytes:buf });
  const mixed = mixedEolNote(r.text);
  if (r.guessed) toast(`「${f.name}」不是 UTF-8，判斷為 ${ENC_LABEL[r.encoding]}。若顯示亂碼，請從「編碼 > 以其他編碼重新開啟」換一個`);
  else if (mixed) toast(`「${f.name}」混用了多種行尾（${mixed}），存檔時會統一成 ${EOL_LABEL[t.eol]}`);
  if (mixed) t.mixedEol = mixed;
  if (existing >= 0){ if (tabs[existing] === split.tab) showInPane2(t, true); tabs[existing] = t; activateTab(existing, true); renderTabs(); persistSoon(); }
  else addTab(t);
  return t;
}
async function openFiles(list){
  let opened = 0;
  for (const f of [...list]){ try { if (await openFileObj(f)) opened++; } catch(e){ toast(`無法讀取「${f.name}」`); } }
  if (opened) focusEditor();
}
function openFile(){ const fi = $("#fileInput"); fi.value = ""; fi.click(); }
$("#fileInput").addEventListener("change", e => openFiles(e.target.files));

let dragDepth = 0;
const hasFiles = e => e.dataTransfer && [...(e.dataTransfer.types || [])].includes("Files");
window.addEventListener("dragenter", e => { if (!hasFiles(e)) return; e.preventDefault(); dragDepth++; $("#drop").hidden = false; });
window.addEventListener("dragover", e => { if (!hasFiles(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = "copy"; });
window.addEventListener("dragleave", e => { if (!hasFiles(e)) return; dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) $("#drop").hidden = true; });
window.addEventListener("drop", e => { if (!hasFiles(e)) return; e.preventDefault(); dragDepth = 0; $("#drop").hidden = true; openFiles(e.dataTransfer.files); });

async function reopenAs(enc){
  const t = curT();
  if (!t.bytes){ toast("只有這次從檔案開啟的分頁可以換編碼重新開啟"); return; }
  if (isDirty(t)){ const r = await ask({ title:"放棄目前的修改？", text:"以其他編碼重新開啟會用原始檔案內容取代目前的文字。", actions:[{ id:"cancel", label:"取消" }, { id:"ok", label:"重新開啟", primary:true }] }); if (r !== "ok") return; }
  try {
    const r = decode(t.bytes, enc);
    t.doc.setValue(r.text); t.doc.clearHistory(); t.encoding = r.encoding; t.bom = r.bom; t.eol = detectEol(r.text);
    t.cleanGen = t.doc.changeGeneration(true); t.forceDirty = false;
    renderTabs(); updateStatus(); persistSoon(); toast("已以 " + ENC_LABEL[r.encoding] + " 重新開啟");
  } catch(e){ toast("這個瀏覽器不支援 " + enc); }
}

