/* ---------- open / decode ---------- */
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
  if (f.size > 25 * 1024 * 1024) return openHexFile(f, path, tr("is over 25 MB, opened in Hex view"));
  const buf = await f.arrayBuffer();
  if (looksBinary(buf)) return openHexFile(f, path, tr("is a binary file, opened in Hex view"));
  const key = path || f.name;
  // A clean tab for the same file is replaced rather than duplicated. Without a path, only the name is known, so the tab
  // must still hold the bytes it was opened from; with a path (the macOS app), the path alone identifies the file.
  const existing = tabs.findIndex(t => (t.path || t.name) === key && !isDirty(t) && (t.bytes || (path && t.path === path)));
  const r = decode(buf);
  const t = makeTab({ name:f.name, path: path || null, text:r.text, eol:detectEol(r.text), bom:r.bom, encoding:r.encoding, bytes:buf });
  const mixed = mixedEolNote(r.text);
  if (r.guessed) toast(tr("“{name}” is not UTF-8 and was read as {enc}. If the text looks garbled, pick another one under Encoding > Reopen with Encoding.", { name:f.name, enc:ENC_LABEL[r.encoding] }));
  else if (mixed) toast(tr("“{name}” mixes line endings ({kinds}). Saving converts them all to {eol}.", { name:f.name, kinds:mixed, eol:EOL_LABEL[t.eol] }));
  if (mixed) t.mixedEol = mixed;
  if (existing >= 0){ if (tabs[existing] === split.tab) showInPane2(t, true); tabs[existing] = t; activateTab(existing, true); renderTabs(); persistSoon(); }
  else addTab(t);
  return t;
}
async function openFiles(list){
  let opened = 0;
  for (const f of [...list]){ try { if (await openFileObj(f)) opened++; } catch(e){ toast(tr("Can't read “{name}”", { name:f.name })); } }
  if (opened) focusEditor();
}
function openFile(){ if (NATIVE){ nativeCall({ type:"openPanel" }); return; } const fi = $("#fileInput"); fi.value = ""; fi.click(); }
$("#fileInput").addEventListener("change", e => openFiles(e.target.files));

let dragDepth = 0;
const hasFiles = e => e.dataTransfer && [...(e.dataTransfer.types || [])].includes("Files");
window.addEventListener("dragenter", e => { if (!hasFiles(e)) return; e.preventDefault(); dragDepth++; $("#drop").hidden = false; });
window.addEventListener("dragover", e => { if (!hasFiles(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = "copy"; });
window.addEventListener("dragleave", e => { if (!hasFiles(e)) return; dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) $("#drop").hidden = true; });
window.addEventListener("drop", e => { if (!hasFiles(e)) return; e.preventDefault(); dragDepth = 0; $("#drop").hidden = true; openFiles(e.dataTransfer.files); });

async function reopenAs(enc){
  const t = curT();
  if (!t.bytes){ toast(tr("Only tabs opened from a file in this session can be reopened with another encoding")); return; }
  if (isDirty(t)){ const r = await ask({ title:tr("Discard your changes?"), text:tr("Reopening with another encoding replaces the current text with the original file's content."), actions:[{ id:"cancel", label:tr("Cancel") }, { id:"ok", label:tr("Reopen"), primary:true }] }); if (r !== "ok") return; }
  try {
    const r = decode(t.bytes, enc);
    t.doc.setValue(r.text); t.doc.clearHistory(); t.encoding = r.encoding; t.bom = r.bom; t.eol = detectEol(r.text);
    t.cleanGen = t.doc.changeGeneration(true); t.forceDirty = false;
    renderTabs(); updateStatus(); persistSoon(); toast(tr("Reopened as {enc}", { enc:ENC_LABEL[r.encoding] }));
  } catch(e){ toast(tr("This browser doesn't support {enc}", { enc })); }
}

