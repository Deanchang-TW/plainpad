/* ---------- persistence ----------
   Session metadata (tab order, names, cursors, settings) is small and goes to localStorage synchronously.
   Tab contents go to IndexedDB, and only tabs that changed since the last write are written.
   Only one window owns the session at a time (Web Locks); other windows run unsaved and say so. */
const session = { primary:true, ready:false, warned:false, migrating:false };
let persistTimer;
function persistSoon(){ clearTimeout(persistTimer); persistTimer = setTimeout(persist, 700); }
function storageWarn(){ if (!session.warned){ session.warned = true; toast("瀏覽器拒絕保存資料，這次的修改在重新整理後可能會遺失"); } }
function persistableHex(t){ return t.hex.loading || t.hex.buf.blob.size <= HEX_PERSIST_MAX; }
function sessionMeta(){
  const keep = tabs.filter(t => !isHex(t) || persistableHex(t));
  return { v:2, seq, active: Math.max(0, keep.indexOf(cur())), settings, tabs: keep.map(t => isHex(t)
    ? { kind:"hex", id:t.id, name:t.name, path:t.path, dirty:isDirty(t), cur:t.hex.cur }
    : { id:t.id, name:t.name, path:t.path, lang:t.langId, eol:t.eol, bom:t.bom, enc:t.encoding, untitled:t.untitled, dirty:isDirty(t), cur:t.doc.getCursor(), bm: bmLines(t) }) };
}
function docsPersist(){
  const changed = tabs.filter(t => !isHex(t) && t.savedGen !== t.doc.changeGeneration());
  if (!changed.length) return Promise.resolve(true);
  const recs = changed.map(t => { t.savedGen = t.doc.changeGeneration(); return { id:t.id, text:t.doc.getValue() }; });
  return idbReq("readwrite", st => { recs.forEach(r => st.put(r)); }, "docs").then(() => true, () => { changed.forEach(t => { t.savedGen = undefined; }); storageWarn(); return false; });
}
function persist(){
  if (!session.ready || !session.primary) return;
  clearTimeout(persistTimer);
  hexPersistIdb();
  const docsDone = docsPersist();
  try { localStorage.setItem(STORE_KEY, JSON.stringify(sessionMeta())); } catch(e){ storageWarn(); }
  if (session.migrating) docsDone.then(ok => { if (ok){ session.migrating = false; try { localStorage.removeItem(OLD_STORE_KEY); } catch(e){} } });
}
function readJSON(key){ try { return JSON.parse(localStorage.getItem(key) || "null"); } catch(e){ return null; } }
/* The language a stored tab was saved with. Sessions from before the JSX modes existed saved .tsx as TypeScript and .jsx as
   JavaScript, the only choices then; those move to the JSX variant, which is what the file name now picks. */
function storedLang(o){
  const lang = LANG[o.lang] ? o.lang : undefined, byName = langForName(o.name);
  return (lang === "ts" && byName === "tsx") || (lang === "js" && byName === "jsx") ? byName : lang;
}
function applyStoredSettings(s){ if (s && s.settings) Object.assign(settings, s.settings); if (!Array.isArray(settings.macros)) settings.macros = []; }
async function restore(){
  let s = readJSON(STORE_KEY), legacy = false;
  if (!s){ s = readJSON(OLD_STORE_KEY); legacy = !!s; }
  if (!s || !Array.isArray(s.tabs) || !s.tabs.length) return false;
  applyStoredSettings(s); seq = s.seq || 1;
  const texts = new Map();
  if (!legacy){
    const ids = s.tabs.filter(o => o.kind !== "hex" && o.id).map(o => o.id);
    try { await idbReq("readonly", st => ids.map(id => { const r = st.get(id); r.onsuccess = () => { if (r.result) texts.set(id, r.result.text); }; }), "docs"); } catch(e){}
  }
  const lost = [];
  s.tabs.forEach(o => {
    if (o.kind === "hex"){ if (o.id) tabs.push(hexRestoreTab(o)); return; }
    let text = legacy ? o.text : texts.get(o.id);
    if (text == null){ if (o.untitled && !o.dirty) text = ""; else { lost.push(o.name); return; } }
    const t = makeTab({ id: legacy ? null : o.id, name:o.name, path:o.path || null, text, lang: storedLang(o), eol: EOLS[o.eol] ? o.eol : "LF", bom:!!o.bom, encoding:o.enc || "UTF-8", untitled:!!o.untitled, dirty:!!o.dirty, bm:o.bm });
    if (o.cur) t.doc.setCursor(o.cur);
    if (!legacy) t.savedGen = t.doc.changeGeneration();
    tabs.push(t);
  });
  if (lost.length) setTimeout(() => toast(`這些分頁的內容沒有保存下來：${lost.join("、")}`), 600);
  if (legacy) session.migrating = true;
  if (!tabs.length) return false;
  active = -1; activateTab(Math.min(Math.max(0, s.active | 0), tabs.length - 1), true);
  return true;
}
/* Resolves true when this window owns the session. Waits a few seconds, because a closing window or a preview may still hold it briefly. */
function acquireSession(){
  if (!navigator.locks || typeof navigator.locks.request !== "function") return Promise.resolve(true);
  return new Promise(resolve => {
    const ac = new AbortController(); const timer = setTimeout(() => ac.abort(), 3000);
    const slow = setTimeout(() => toast("正在等待另一個 Plainpad 視窗釋出工作階段…"), 700);
    try {
      navigator.locks.request("plainpad-session", { signal: ac.signal }, () => { clearTimeout(timer); clearTimeout(slow); resolve(true); return new Promise(() => {}); })
        .catch(e => { clearTimeout(slow); resolve(!(e && e.name === "AbortError")); });
    } catch(e){ clearTimeout(timer); clearTimeout(slow); resolve(true); }
  });
}
function showSecondaryBanner(){
  $("#bannerText").textContent = "Plainpad 已經在另一個視窗或分頁開著。這個視窗的內容不會自動保存，關閉另一個視窗後按「重新載入」即可接手原本的工作階段。";
  $("#banner").hidden = false;
}
$("#bannerReload").addEventListener("click", () => location.reload());
function storageCleanup(){
  const ids = new Set(tabs.map(t => t.id));
  idbReq("readonly", st => st.getAllKeys(), "docs").then(keys => { const gone = (keys || []).filter(k => !ids.has(k)); if (gone.length) idbReq("readwrite", st => gone.forEach(k => st.delete(k)), "docs").catch(() => {}); }, () => {});
  idbKeys().then(keys => keys.forEach(k => { const id = String(k).replace(/^base:/, ""); if (!ids.has(id)) idbDel(k); }));
}

