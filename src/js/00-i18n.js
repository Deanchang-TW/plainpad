/* ---------- interface languages ----------
   Interface text is written in English and passed through tr(). The English text is the key into
   src/i18n/<locale>.json; the build embeds those tables as I18N (and the help page and the sample file as HELP_DOCS
   and SAMPLE_DOCS), checks that zh-TW, zh-CN and vi translate every string, and fails on Chinese text in the code.
   en.json only holds strings whose English differs from the key: plural forms, and a few short labels.
   tr("Saved {name}", { name }) fills {name}; a translation may be { one, other } to choose by vars.n.
   Text in src/markup.html is translated in place below, by the same keys; translate="no" keeps an element's text as is.
   The language is fixed for the life of the page: choosing another one saves the session and reloads.
   Everything here is a function declaration so that 00-config can call tr() while it is still being set up. */
function uiLocales(){
  return [{ id:"zh-TW", name:"繁體中文", html:"zh-Hant" }, { id:"en", name:"English", html:"en" },   // i18n-ignore: native names
    { id:"zh-CN", name:"简体中文", html:"zh-Hans" }, { id:"vi", name:"Tiếng Việt", html:"vi" }];      // i18n-ignore: native names
}
function systemLocale(){
  const list = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || ""];
  for (const raw of list){
    const l = String(raw).toLowerCase();
    if (/^zh-(tw|hk|mo|hant)/.test(l)) return "zh-TW";
    if (l.startsWith("zh")) return "zh-CN";
    if (l.startsWith("vi")) return "vi";
    if (l.startsWith("en")) return "en";
  }
  return "en";
}
/* The stored choice is read straight from the session record, before settings are restored. */
function uiLocale(){
  if (uiLocale.v) return uiLocale.v;
  let pref = "auto";
  try { const s = JSON.parse(localStorage.getItem("plainpad.session.v2") || "null"); if (s && s.settings && s.settings.uiLang) pref = s.settings.uiLang; } catch(e){}
  return (uiLocale.v = uiLocales().some(l => l.id === pref) ? pref : systemLocale());
}
function tr(src, vars){
  const table = I18N[uiLocale()];
  let s = table && Object.prototype.hasOwnProperty.call(table, src) ? table[src] : src;
  if (s && typeof s === "object") s = vars && Number(String(vars.n).replace(/,/g, "")) === 1 && s.one != null ? s.one : s.other;
  return vars ? s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : s;
}
function translateDom(root){
  const text = /\p{L}/u;   // labels such as "16" or "×" are left alone
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: n => /^(SCRIPT|STYLE|TEXTAREA)$/.test(n.parentNode.nodeName) || n.parentNode.closest("[translate=no]") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
  for (let n; (n = walker.nextNode()); ){
    if (!text.test(n.nodeValue)) continue;
    const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(n.nodeValue); n.nodeValue = m[1] + tr(m[2]) + m[3];
  }
  // Tooltips and labels are translated even on translate="no" elements: the Aa button keeps its text but explains itself.
  for (const el of root.querySelectorAll("[title], [aria-label], [placeholder]"))
    for (const a of ["title", "aria-label", "placeholder"]){ const v = el.getAttribute(a); if (v && text.test(v)) el.setAttribute(a, tr(v)); }
}
document.documentElement.lang = uiLocales().find(l => l.id === uiLocale()).html;
translateDom(document.body);
