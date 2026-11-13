/* ---------- save ---------- */
let downloadsP = null;
function getDownloads(){
  if (!downloadsP) downloadsP = NATIVE ? Promise.resolve(nativeDownloads) : (window.claude && typeof window.claude.use === "function") ? window.claude.use("downloads").catch(() => null) : Promise.resolve(null);
  return downloadsP;
}
async function saveTab(t = curT(), asNew = false){
  if (isHex(t)) return hexSave(t, asNew);
  let name = t.name;
  if (asNew || t.untitled){
    if (NATIVE){ if (t.untitled && !extOf(name)) name += ".txt"; }   // the save panel asks for the name
    else { const v = await promptText({ title: asNew ? tr("Save As") : tr("Save “{name}”", { name:t.name }), text:tr("Enter a file name. The extension sets the syntax highlighting."), value: t.untitled && !extOf(name) ? name + ".txt" : name, ok:tr("Save") });
    if (v == null || !v.trim()) return false; name = v.trim(); }
  }
  const text = t.doc.getValue(EOLS[t.eol]);
  let enc = normEnc(t.encoding), bom = t.bom && bomCapable(enc);
  let out = encodeText(text, enc, bom);
  if (out.badCount){
    const sample = out.bad.slice(0, 12).join(tr(" "));
    const r = await ask({ title:tr("{n} characters can't be saved in {enc}", { n:fmtNum(out.badCount), enc:ENC_LABEL[enc] }), text:tr("For example: {sample}. Saving as UTF-8 keeps every character. Saving as {enc} turns them into “?”.", { sample, enc:ENC_LABEL[enc] }),
      actions:[{ id:"cancel", label:tr("Cancel") }, { id:"keep", label:tr("Replace with ? and Save as {enc}", { enc:ENC_LABEL[enc] }) }, { id:"utf8", label:tr("Save as UTF-8"), primary:true }] });
    if (r === "cancel") return false;
    if (r === "utf8"){ enc = "utf-8"; bom = false; out = encodeText(text, enc, false); }
  }
  if (!out.bytes.length){ toast(tr("An empty file can't be downloaded. Add at least one character.")); return false; }
  let fname = name;
  if (!LOCAL && !DL_EXT.has(extOf(name))){
    const r = await ask({ title:tr("This extension can't be downloaded directly"), text:tr("The page sandbox only allows formats such as txt, md, json, html, csv and svg. You can save as “{name}.txt” and remove the trailing .txt after downloading, or copy the text into another editor.", { name }), actions:[
      { id:"cancel", label:tr("Cancel") }, { id:"copy", label:tr("Copy All Text") }, { id:"txt", label:tr("Save as .txt"), primary:true } ]});
    if (r === "copy"){ (await copyText(text)) ? toast(tr("Copied all text")) : toast(tr("The browser blocked copying. Use ⌘A ⌘C instead.")); return false; }
    if (r !== "txt") return false;
    fname = name + ".txt";
  }
  const dl = await getDownloads();
  if (!dl){
    const r = await ask({ title:tr("This view can't download files"), text:tr("You can copy all the text and save it somewhere else."), actions:[{ id:"cancel", label:tr("Cancel") }, { id:"copy", label:tr("Copy All Text"), primary:true }] });
    if (r === "copy") (await copyText(text)) ? toast(tr("Copied all text")) : toast(tr("The browser blocked copying"));
    return false;
  }
  try {
    const r = await dl.save({ filename: fname, data: out.bytes, path: asNew || t.untitled ? null : t.path });
    if (r && r.path){ t.path = r.path; name = fname = r.filename; }
    if (r && r.mtime != null) t.mtime = r.mtime;
    const renamed = name !== t.name; t.name = name; t.untitled = false;
    if (renamed){ const l = langForName(name); if (l !== "text") setLang(t, l); }
    t.cleanGen = t.doc.changeGeneration(true); t.forceDirty = false;
    t.encoding = enc; t.bom = bom; t.bytes = out.bytes.buffer;
    renderTabs(); updateStatus(); persistSoon();
    toast(tr("Saved {name} ({enc}, {eol})", { name:fname, enc:ENC_LABEL[enc] + (bom ? " BOM" : ""), eol:EOL_LABEL[t.eol] }) + (t.mixedEol ? tr(", line endings unified") : "")); t.mixedEol = null;
    return true;
  } catch(e){
    const code = e && e.code;
    if (code === "declined") toast(tr("Save canceled"));
    else if (code === "rate_limited") toast(tr("A save dialog is already open. Finish that one first."));
    else toast(tr("Can't save: {reason}", { reason:(e && e.message) || code || tr("unknown error") }));
    return false;
  }
}
async function saveAll(){
  const dirty = tabs.filter(isDirty);
  if (!dirty.length){ toast(tr("No unsaved tabs")); return; }
  for (const t of dirty){ activateTab(tabs.indexOf(t)); if (!(await saveTab(t))) return; }
}

