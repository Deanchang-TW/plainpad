/* ---------- macOS app shell ----------
   Inside the app (macos/) the page runs in a WKWebView that registers the "plainpad" message handler. Saving goes through
   NSSavePanel, or straight back to the file's path when the tab came from disk; opening comes from NSOpenPanel, Finder or
   the Dock; the menu bar calls run(). Only what the app needs is put on window, and only when the handler exists. */
function nativeCall(msg){ return window.webkit.messageHandlers.plainpad.postMessage(msg); }
function bytesToBase64(data){
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result.slice(r.result.indexOf(",") + 1)); r.onerror = () => rej(r.error); r.readAsDataURL(data instanceof Blob ? data : new Blob([data])); });
}
const nativeDownloads = {
  async save({ filename, data, path }){
    const r = await nativeCall({ type:"save", filename, path: path || null, data: await bytesToBase64(data) });
    if (!r || r.status !== "saved"){ const e = new Error("declined"); e.code = "declined"; throw e; }
    return r;   // { status:"saved", path, filename }
  }
};
/* Files picked natively: the app serves each one once at __file/<token> under the page's own origin, so even large files
   arrive as a Blob without a round trip through a string. */
async function nativeOpen(items){
  let opened = 0;
  for (const it of items){
    try {
      const res = await fetch("__file/" + encodeURIComponent(it.token));
      if (!res.ok) throw new Error(res.status);
      const t = await openFileObj(new File([await res.blob()], it.name), it.path);
      if (t){ t.mtime = it.mtime; opened++; }
    } catch(e){ toast(tr("Can't read “{name}”", { name:it.name })); }
  }
  nativeWatch();
  if (opened) focusEditor();
}
/* The window title follows the active tab: its name, its path (macOS shows the file's icon and lets you ⌘-click the
   title for the folder chain) and whether it has unsaved changes (the dot in the close button). */
let nativeTitleSig = "";
function nativeTitle(){
  const t = cur(); if (!t) return;
  const msg = { type:"title", name:t.name, path:t.path || null, dirty:isDirty(t) };
  const sig = JSON.stringify(msg); if (sig === nativeTitleSig) return; nativeTitleSig = sig;
  nativeCall(msg);
}
/* ---------- files changed outside Plainpad ----------
   The app is told which files the tabs came from and the modification time the page last saw for each ("watch"), and
   reports back when one changes or disappears (changed()). A clean tab reloads in place; a tab with unsaved edits asks.
   The time is stored with the session, so a change made while the app was closed is caught at the next launch. */
let nativeWatchSig = "";
function nativeWatch(){
  const files = tabs.filter(t => t.path).map(t => ({ path:t.path, mtime: t.mtime == null ? null : t.mtime }));
  const sig = JSON.stringify(files); if (sig === nativeWatchSig) return; nativeWatchSig = sig;
  nativeCall({ type:"watch", files });
}
let nativeChangeQueue = Promise.resolve();
function nativeChanged(items){
  for (const it of items){
    const t = tabs.find(x => x.path === it.path); if (!t) continue;
    t.mtime = it.deleted ? null : it.mtime;   // seen: the app won't report this version again
    nativeChangeQueue = nativeChangeQueue.then(() => nativeApplyChange(it)).catch(() => {});
  }
  nativeWatch();
}
async function nativeApplyChange(it){
  let t = tabs.find(x => x.path === it.path); if (!t) return;
  if (it.deleted){
    if (!t.forceDirty){ t.forceDirty = true; renderTabs(); persistSoon(); }
    toast(tr("“{name}” was deleted or moved by another program. The tab keeps its content, and saving recreates the file.", { name:t.name }));
    return;
  }
  const res = await fetch("__file/" + encodeURIComponent(it.token)); if (!res.ok) return;
  const blob = await res.blob();
  t = tabs.find(x => x.path === it.path); if (!t) return;
  if (isDirty(t)){
    activateTab(tabs.indexOf(t));
    const hex = isHex(t);
    const r = await ask({ title:tr("“{name}” was changed by another program", { name:t.name }),
      text: hex ? tr("This tab also has unsaved changes. Reloading uses the version on disk and discards your changes.")
                : tr("This tab also has unsaved changes. Reloading uses the version on disk. You can get your current text back with Undo."),
      actions:[{ id:"keep", label:tr("Keep My Version"), primary:hex }, { id:"reload", label:tr("Reload"), primary:!hex }] });
    if (r !== "reload" || !tabs.includes(t)) return;
  }
  if (isHex(t)){
    if (t.hex.loading) return;
    const i = tabs.indexOf(t), nt = makeHexTab({ name:t.name, path:t.path, blob }); nt.mtime = t.mtime;
    hexForget(t.id); tabs[i] = nt;
    if (i === active) activateTab(i, true);
    renderTabs(); persistSoon();
  } else {
    if (blob.size > 25 * 1024 * 1024){ toast(tr("“{name}” grew past 25 MB in another program. Close the tab and open the file again to view it in Hex.", { name:t.name })); return; }
    reloadTextTab(t, await blob.arrayBuffer());
  }
  if (!isDirty(t) || isHex(t)) toast(tr("“{name}” was changed by another program and has been reloaded", { name:t.name }));
}
/* Replaces only the part of the text that changed, as one undoable step, so the cursor, scroll position, bookmarks and
   folds outside the changed part stay where they were. Keeps the tab's encoding unless it is UTF-8, which re-detects. */
function reloadTextTab(t, buf){
  const r = normEnc(t.encoding) === "utf-8" ? decode(buf) : decode(buf, normEnc(t.encoding));
  const doc = t.doc, old = doc.getValue(), text = r.text.replace(/\r\n?/g, "\n");
  if (text !== old){
    let p = 0; const max = Math.min(old.length, text.length);
    while (p < max && old.charCodeAt(p) === text.charCodeAt(p)) p++;
    let s = 0; while (s < max - p && old.charCodeAt(old.length - 1 - s) === text.charCodeAt(text.length - 1 - s)) s++;
    const scroll = [cmMain, cm2].map(ed => ed.getScrollInfo());
    doc.replaceRange(text.slice(p, text.length - s), doc.posFromIndex(p), doc.posFromIndex(old.length - s), "reload");
    [cmMain, cm2].forEach((ed, i) => ed.scrollTo(scroll[i].left, scroll[i].top));
  }
  t.encoding = r.encoding; t.bom = r.bom; t.eol = detectEol(r.text); t.bytes = buf;
  t.cleanGen = doc.changeGeneration(true); t.forceDirty = false;
  renderTabs(); updateStatus(); persistSoon();
}
function nativeReady(){
  window.__ppNative = { run, open: nativeOpen, changed: nativeChanged, flush: () => Promise.resolve(persist()).then(() => true) };
  nativeCall({ type:"ready" });
  nativeCall({ type:"locale", lang:uiLocale(), choice:settings.uiLang || "auto" });
  nativeTitle(); nativeWatch();
}
