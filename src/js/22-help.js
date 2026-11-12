/* ---------- help ---------- */
/* The help page and the sample file come from src/i18n/help and src/i18n/sample, one per interface language. */
const HELP = HELP_DOCS[uiLocale()] || HELP_DOCS["zh-TW"];
const SAMPLE_SQL = SAMPLE_DOCS[uiLocale()] || SAMPLE_DOCS["zh-TW"];
function openHelp(){
  const i = tabs.findIndex(t => t.name === HELP_NAME);
  if (i < 0){ addTab(makeTab({ name:HELP_NAME, text:HELP })); return; }
  const t = tabs[i]; if (!isDirty(t) && t.doc.getValue() !== HELP){ t.doc.setValue(HELP); t.cleanGen = t.doc.changeGeneration(true); }
  activateTab(i);
}

