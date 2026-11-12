/* ---------- keyboard ---------- */
const CODE_KEY = { Slash:"/", Equal:"=", Minus:"-", BracketLeft:"[", BracketRight:"]", Comma:",", Period:"." };
function keyName(e){
  let key;
  if (/^Key[A-Z]$/.test(e.code)) key = e.code.slice(3);
  else if (/^Digit\d$/.test(e.code)) key = e.code.slice(5);
  else if (CODE_KEY[e.code]) key = CODE_KEY[e.code];
  else if (/^(Arrow\w+|F\d{1,2}|Escape|Tab|Enter)$/.test(e.key)) key = e.key;
  else return null;
  const mods = [];
  if (isMac && e.ctrlKey) mods.push("Ctrl");
  if (isMac ? e.metaKey : e.ctrlKey) mods.push("Mod");
  if (e.altKey) mods.push("Alt"); if (e.shiftKey) mods.push("Shift");
  return [...mods, key].join("-");
}
const KEYS = {
  "Alt-N":"newTab", "Alt-W":"closeActive", "Mod-O":"openFile", "Mod-S":"save", "Mod-Shift-S":"saveAs",
  "Mod-F":"find", "Mod-Alt-F":"replace", "Mod-Shift-F":"findInFiles", "F3":"next", "Shift-F3":"prev", "Mod-L":"gotoLine",
  "Alt-Z":"toggleWrap", "Mod-=":"zoomIn", "Mod-Shift-=":"zoomIn", "Mod--":"zoomOut", "Mod-0":"zoomReset",
  "Mod-F2":"bmToggle", "F2":"bmNext", "Shift-F2":"bmPrev", "Alt-Shift-R":"macroRec", "Alt-Shift-P":"macroPlay"
};
if (isMac) Object.assign(KEYS, { "Mod-G":"next", "Mod-Shift-G":"prev", "Ctrl-G":"gotoLine", "Ctrl-H":"replace", "Ctrl-Shift-M":"mdPreview", "Ctrl-Shift-H":"toggleHex" });
else Object.assign(KEYS, { "Mod-H":"replace", "Mod-G":"gotoLine", "Mod-Shift-M":"mdPreview", "Mod-Shift-H":"toggleHex" });
const EDITOR_KEYS = { "Mod-D":"dup", "Mod-Shift-K":"delLine", "Alt-ArrowUp":"up", "Alt-ArrowDown":"down", "Mod-J":"join", "Mod-/":"comment", "Mod-Shift-U":"upper", "Mod-U":"lower", "Alt-C":"columnEditor", "Mod-Enter":"complete" };
document.addEventListener("keydown", e => {
  if (!$("#modal").hidden) return;
  if (e.key === "Escape"){
    if (openMenuIdx >= 0){ e.preventDefault(); closeMenu(); focusEditor(); return; }
    if (cm.state.completionActive) return;
    if (!$("#findPanel").hidden && (cm.hasFocus() || $("#findPanel").contains(document.activeElement))){ e.preventDefault(); closeFind(); return; }
    return;
  }
  const k = keyName(e); if (!k) return;
  let name = KEYS[k];
  if (!name && /^Alt-\d$/.test(k)){ const n = +k.slice(4); if (n >= 1){ e.preventDefault(); e.stopPropagation(); activateTab(n === 9 ? tabs.length - 1 : n - 1); } return; }
  const inEditor = cmMain.hasFocus() || cm2.hasFocus();
  if (!name && inEditor) name = EDITOR_KEYS[k];
  if (!name) return;
  if (inEditor && cm.state.completionActive && (k === "Mod-Enter")) return;
  e.preventDefault(); e.stopPropagation(); closeMenu(); run(name);
}, true);

