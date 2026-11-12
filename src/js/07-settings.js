/* ---------- settings ---------- */
function applySettings(){
  [cmMain, cm2].forEach(ed => {
    ed.setOption("lineWrapping", settings.wrap && !cmp.on);
    ed.setOption("lineNumbers", settings.lineNumbers);
    ed.setOption("indentWithTabs", settings.useTabs);
    ed.setOption("tabSize", settings.tabSize); ed.setOption("indentUnit", settings.tabSize);
    ed.setOption("autoCloseBrackets", settings.autoClose);
    ed.setOption("highlightSelectionMatches", settings.smartHighlight ? { minChars:2, wordsOnly:true, delay:80 } : false);
    ed.removeOverlay("ws"); if (settings.ws) ed.addOverlay(wsOverlay);
  });
  $("#paper").classList.toggle("ws-on", settings.ws);
  document.documentElement.style.setProperty("--editor-size", settings.fontSize + "px");
  if (settings.theme === "system") delete document.documentElement.dataset.padTheme; else document.documentElement.dataset.padTheme = settings.theme;
  document.documentElement.dataset.icons = settings.icons === "mono" ? "mono" : "color";
  document.documentElement.dataset.fold = settings.foldStyle === "chevrons" ? "chevrons" : "guides";
  $("#tWrap").setAttribute("aria-pressed", String(settings.wrap));
  $("#tWs").setAttribute("aria-pressed", String(settings.ws));
  cmMain.refresh(); if (!$("#pane2").hidden) cm2.refresh();
  if (cmp.on) compareSoon(0);
  if (typeof mdSoon === "function") mdSoon(0);
  if (hx.tab){ hx.sig = ""; hexRefresh(); }
}
function setSetting(k, v){ settings[k] = v; applySettings(); persistSoon(); }
const THEME_LABEL = { system:"跟隨系統", light:"淺色", dark:"深色" };
const ICON_LABEL = { color:"彩色", mono:"單色" };
const FOLD_LABEL = { guides:"指引線（Notepad++ 樣式）", chevrons:"箭頭（VS Code 樣式）" };

