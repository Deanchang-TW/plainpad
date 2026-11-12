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
    else { const v = await promptText({ title: asNew ? tr("另存新檔") : tr("儲存「{name}」", { name:t.name }), text:tr("輸入檔名，副檔名會決定語法高亮。"), value: t.untitled && !extOf(name) ? name + ".txt" : name, ok:tr("儲存") });
    if (v == null || !v.trim()) return false; name = v.trim(); }
  }
  const text = t.doc.getValue(EOLS[t.eol]);
  let enc = normEnc(t.encoding), bom = t.bom && bomCapable(enc);
  let out = encodeText(text, enc, bom);
  if (out.badCount){
    const sample = out.bad.slice(0, 12).join(tr("　"));
    const r = await ask({ title:tr("有 {n} 個字元無法用 {enc} 儲存", { n:fmtNum(out.badCount), enc:ENC_LABEL[enc] }), text:tr("例如：{sample}。改存成 UTF-8 可以保留所有字元；照 {enc} 存的話，這些字元會變成「?」。", { sample, enc:ENC_LABEL[enc] }),
      actions:[{ id:"cancel", label:tr("取消") }, { id:"keep", label:tr("用 ? 取代，照 {enc} 存", { enc:ENC_LABEL[enc] }) }, { id:"utf8", label:tr("改存成 UTF-8"), primary:true }] });
    if (r === "cancel") return false;
    if (r === "utf8"){ enc = "utf-8"; bom = false; out = encodeText(text, enc, false); }
  }
  if (!out.bytes.length){ toast(tr("空白檔案無法下載，至少要有一個字元")); return false; }
  let fname = name;
  if (!LOCAL && !DL_EXT.has(extOf(name))){
    const r = await ask({ title:tr("這個副檔名無法直接下載"), text:tr("網頁沙盒只允許 txt、md、json、html、csv、svg 等格式。可以先存成「{name}.txt」，下載後把結尾的 .txt 刪掉；或複製全文貼到其他編輯器。", { name }), actions:[
      { id:"cancel", label:tr("取消") }, { id:"copy", label:tr("複製全文") }, { id:"txt", label:tr("存成 .txt"), primary:true } ]});
    if (r === "copy"){ (await copyText(text)) ? toast(tr("已複製全文")) : toast(tr("瀏覽器拒絕複製，請改用 ⌘A ⌘C")); return false; }
    if (r !== "txt") return false;
    fname = name + ".txt";
  }
  const dl = await getDownloads();
  if (!dl){
    const r = await ask({ title:tr("這個檢視無法下載檔案"), text:tr("可以先複製全文，貼到其他地方儲存。"), actions:[{ id:"cancel", label:tr("取消") }, { id:"copy", label:tr("複製全文"), primary:true }] });
    if (r === "copy") (await copyText(text)) ? toast(tr("已複製全文")) : toast(tr("瀏覽器拒絕複製"));
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
    toast(tr("已儲存 {name}（{enc}、{eol}）", { name:fname, enc:ENC_LABEL[enc] + (bom ? " BOM" : ""), eol:EOL_LABEL[t.eol] }) + (t.mixedEol ? tr("，行尾已統一") : "")); t.mixedEol = null;
    return true;
  } catch(e){
    const code = e && e.code;
    if (code === "declined") toast(tr("已取消儲存"));
    else if (code === "rate_limited") toast(tr("已有一個儲存對話框開著，請先處理"));
    else toast(tr("無法儲存：{reason}", { reason:(e && e.message) || code || tr("未知錯誤") }));
    return false;
  }
}
async function saveAll(){
  const dirty = tabs.filter(isDirty);
  if (!dirty.length){ toast(tr("沒有未儲存的分頁")); return; }
  for (const t of dirty){ activateTab(tabs.indexOf(t)); if (!(await saveTab(t))) return; }
}

