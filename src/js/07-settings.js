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
/* The interface language is read once when the page starts (00-i18n.js), so a change is saved and the page reloads.
   Tabs, cursors and unsaved edits are all in the session, so nothing is lost. */
function setUiLang(k){
  if ((settings.uiLang || "auto") === k) return;
  if (!session.primary){ toast(tr("Another window holds the session. Change the language in that window.")); return; }
  settings.uiLang = k;
  Promise.resolve(persist()).then(() => location.reload());   // reload only once the tab contents are written
}
const THEME_LABEL = { system:tr("Match system"), light:tr("Light"), dark:tr("Dark") };
const ICON_LABEL = { color:tr("Color"), mono:tr("Monochrome") };
const FOLD_LABEL = { guides:tr("Guide lines (Notepad++ style)"), chevrons:tr("Chevrons (VS Code style)") };

