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
      if (await openFileObj(new File([await res.blob()], it.name), it.path)) opened++;
    } catch(e){ toast(`無法讀取「${it.name}」`); }
  }
  if (opened) focusEditor();
}
function nativeReady(){
  window.__ppNative = { run, open: nativeOpen, flush: () => Promise.resolve(persist()).then(() => true) };
  nativeCall({ type:"ready" });
}
