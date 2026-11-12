/* ---------- change tracking ---------- */
function onChanges(){
  updateStatus();
  const sig = tabs.map(t => isDirty(t) ? 1 : 0).join(""); if (sig !== dirtySig) renderTabs();
  if (!$("#findPanel").hidden) refreshHitsSoon();
  if (cmp.on) compareSoon();
  mdSoon();
  persistSoon();
}
[cmMain, cm2].forEach(ed => {
  ed.on("changes", onChanges);
  ed.on("cursorActivity", () => { if (ed === cm) updateStatus(); });
  ed.on("overwriteToggle", (c, on) => { $("#stIns").textContent = on ? "OVR" : "INS"; });
  ed.on("drop", (c, e) => { if (e.dataTransfer && e.dataTransfer.types && [...e.dataTransfer.types].includes("Files")) e.preventDefault(); });
  ed.on("focus", () => {
    if (cm !== ed){ if (cm === cmMain || cm === cm2) clearHits(); cm = ed; if (!$("#findPanel").hidden) refreshHits(); }
    $("#pane1").classList.toggle("is-focus", ed === cmMain); $("#pane2").classList.toggle("is-focus", ed === cm2);
    updateStatus(); syncLangSelect(); mdSoon(0);
  });
  ed.on("gutterClick", (c, line, gutter) => { if (gutter === BM){ setBm(c, line, !isBmLine(c.getDoc(), line)); persistSoon(); } });
  ed.on("keyHandled", (c, name) => recPush({ k:name }));
  ed.on("inputRead", (c, ch) => { recPush({ t: ch.text.join("\n") }); maybeHint(c, ch); });
  ed.on("change", (c, ch) => { if (ch.origin === "cut") recPush({ x:1 }); });
  ed.on("scroll", () => { syncScrollFrom(ed); mdSyncFromEditor(ed); });
});

