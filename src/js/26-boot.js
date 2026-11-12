/* ---------- boot ---------- */
buildMenubar();
(async () => {
session.primary = await acquireSession();
let restored = false;
if (session.primary) restored = await restore();
else { applyStoredSettings(readJSON(STORE_KEY) || readJSON(OLD_STORE_KEY)); showSecondaryBanner(); tabs.push(makeTab({ name:tr("新文件（不會保存）"), untitled:true })); active = -1; activateTab(0, true); restored = true; }
if (!restored){
  tabs.push(makeTab({ name:HELP_NAME, text:HELP }));
  tabs.push(makeTab({ name:"monthly-orders.sql", text:SAMPLE_SQL, lang:"mssql", eol:"CRLF" }));
  active = -1; activateTab(0, true);
}
$("#hxCols").value = String(settings.hexCols); $("#hxEnc").value = settings.hexEnc; $("#hexInsp").hidden = !settings.hexInsp; $("#hxInspBtn").setAttribute("aria-pressed", String(settings.hexInsp)); hexSetLE(settings.hexLE !== false);
$("#filterInput").value = settings.filesFilter || ""; $("#skipDirs").checked = settings.skipDirs !== false;
applySettings(); renderTabs(); updateStatus(); syncLangSelect();
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => mdSoon(0));
new MutationObserver(() => mdSoon(0)).observe(document.documentElement, { attributes:true, attributeFilter:["data-theme"] });
$("#mdSync").checked = settings.mdSync !== false; if (settings.mdPreview) toggleMd(true);
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { cmMain.refresh(); cm2.refresh(); });
window.addEventListener("pagehide", persist);
document.addEventListener("visibilitychange", () => { if (document.hidden) persist(); });
if (window.__PP_TEST) window.__plainpad = { A, run, md, renderMd, hx, makeHexTab, addTab, makeZip, persist, hexFindNext, hexRender, tabs: () => tabs, cmMain, cm2, cmp, split, macro, settings, playMacro, startCompare, showResults };
session.ready = true;
if (session.primary){ storageCleanup(); persistSoon(); }
if (NATIVE) nativeReady();
setTimeout(() => focusEditor(), 50);
})();
