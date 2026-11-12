// Builds Plainpad from src/ into dist/.
//   dist/artifact/plainpad.html + dist/artifact/vendor/*   the page published to Claude (libraries are published next to it)
//   dist/plainpad-standalone.html                          one self-contained file that runs from disk, offline
//   dist/test/index.html                                   the artifact page inside a document shell, with the test hook on
// Usage: node build.mjs [--compare path/to/published.html]
import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync, copyFileSync } from "node:fs";
import { minify } from "terser";
import { tokenizer } from "acorn";

const root = new URL("./", import.meta.url);
const read = p => readFileSync(new URL(p, root), "utf8");
const version = name => JSON.parse(read(`node_modules/${name}/package.json`)).version;
const V = { codemirror: version("codemirror"), marked: version("marked"), dompurify: version("dompurify"), katex: version("katex"), mermaid: version("mermaid") };

// CodeMirror files Plainpad uses, in load order.
const CM_FILES = [
  "lib/codemirror",
  "mode/clike/clike", "mode/javascript/javascript", "mode/jsx/jsx", "mode/xml/xml", "mode/css/css", "mode/htmlmixed/htmlmixed", "mode/sql/sql",
  "mode/python/python", "mode/go/go", "mode/markdown/markdown", "mode/shell/shell", "mode/yaml/yaml", "mode/properties/properties",
  "addon/mode/simple", "addon/mode/overlay",
  "mode/php/php", "mode/sass/sass", "mode/jinja2/jinja2", "mode/stex/stex", "mode/rst/rst", "mode/diff/diff",
  "mode/swift/swift", "mode/dart/dart", "mode/rust/rust", "mode/groovy/groovy", "mode/vb/vb", "mode/pascal/pascal", "mode/fortran/fortran",
  "mode/cobol/cobol", "mode/gas/gas", "mode/ruby/ruby", "mode/perl/perl", "mode/lua/lua", "mode/r/r", "mode/julia/julia",
  "mode/powershell/powershell", "mode/vbscript/vbscript", "mode/tcl/tcl", "mode/haskell/haskell", "mode/erlang/erlang", "mode/clojure/clojure",
  "mode/mllike/mllike", "mode/toml/toml", "mode/dockerfile/dockerfile", "mode/nginx/nginx", "mode/cmake/cmake", "mode/protobuf/protobuf",
  "mode/gherkin/gherkin", "mode/verilog/verilog", "mode/vhdl/vhdl",
  "addon/fold/foldcode", "addon/fold/brace-fold", "addon/fold/xml-fold", "addon/fold/indent-fold", "addon/fold/comment-fold", "addon/fold/markdown-fold",
  "addon/edit/matchbrackets", "addon/edit/closebrackets", "addon/selection/active-line", "addon/search/match-highlighter",
  "addon/comment/comment", "addon/hint/show-hint", "addon/hint/anyword-hint", "addon/runmode/runmode"
];

export const VENDOR = {
  codemirror: `codemirror-${V.codemirror}.min.js`, marked: `marked-${V.marked}.min.js`, purify: `purify-${V.dompurify}.min.js`,
  katex: `katex-${V.katex}.min.js`, mermaid: `mermaid-${V.mermaid}.min.js`
};

async function vendorFiles(){
  const cmSrc = CM_FILES.map(f => `/* codemirror/${f}.js */\n` + read(`node_modules/codemirror/${f}.js`)).join("\n;\n");
  const cm = await minify(cmSrc, { compress: true, mangle: true, format: { comments: false } });
  const lic = read("node_modules/codemirror/LICENSE").replace(/\*\//g, "* /");
  return {
    [VENDOR.codemirror]: `/*! CodeMirror ${V.codemirror} (lib + modes + addons used by Plainpad), MIT License, https://codemirror.net/5/\n${lic}*/\n` + cm.code,
    [VENDOR.marked]: read("node_modules/marked/marked.min.js"),
    [VENDOR.purify]: read("node_modules/dompurify/dist/purify.min.js"),
    [VENDOR.katex]: read("node_modules/katex/dist/katex.min.js"),
    [VENDOR.mermaid]: read("node_modules/mermaid/dist/mermaid.min.js")
  };
}

const listDir = d => readdirSync(new URL(d, root)).sort();

/* ---------- interface languages (see src/js/00-i18n.js) ---------- */
export const LOCALES = ["zh-TW", "en", "zh-CN", "vi"];   // zh-TW is the source text; the others have src/i18n/<locale>.json
const CJK = /[\u3400-\u9fff\uff00-\uffef\u3000-\u303f]/;
const MARKUP_ATTRS = /\s(title|aria-label|placeholder)="([^"]*)"/g;

/* Every string the interface shows, with where it comes from. Strings passed to tr("…") in src/js, and the text and
   title / aria-label / placeholder attributes of src/markup.html. Chinese anywhere else in a string, template or
   regular expression is reported as a problem, unless its line says i18n-ignore. */
export function i18nKeys(){
  const keys = new Map(), problems = [];
  const add = (k, where) => { if (!keys.has(k)) keys.set(k, where); };
  for (const f of listDir("src/js/").filter(f => f.endsWith(".js"))){
    const code = read("src/js/" + f), lines = code.split("\n");
    const toks = [...tokenizer(code, { ecmaVersion: "latest", locations: true })];
    toks.forEach((k, i) => {
      const type = k.type.label, value = type === "regexp" ? k.value.pattern : k.value;
      // Judge by the source as written: an escape such as \u3000 is not text a translator needs to see.
      if (!["string", "template", "regexp"].includes(type) || typeof value !== "string" || !CJK.test(code.slice(k.start, k.end))) return;
      const line = k.loc.start.line, prev = toks[i - 1], fn = toks[i - 2], before = toks[i - 3];
      const isTr = type === "string" && prev && prev.type.label === "(" && fn && fn.type.label === "name" && fn.value === "tr" && !(before && before.type.label === ".");
      if (isTr) add(value, `src/js/${f}:${line}`);
      else if (!/i18n-ignore/.test(lines[line - 1])) problems.push(`src/js/${f}:${line}: ${JSON.stringify(value.slice(0, 50))} is not passed to tr()`);
    });
  }
  const markup = read("src/markup.html");
  for (const m of markup.matchAll(/>([^<]+)</g)){ const v = m[1].trim(); if (CJK.test(v)) add(v, "src/markup.html"); }
  for (const m of markup.matchAll(MARKUP_ATTRS)) if (CJK.test(m[2])) add(m[2], "src/markup.html");
  return { keys, problems };
}
const placeholders = s => [...String(s).matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join(",");
export function i18nData(){
  const { keys, problems } = i18nKeys();
  const tables = { "zh-TW": {} }, help = {}, sample = {};
  for (const l of LOCALES){
    help[l] = read(`src/i18n/help/${l}.md`); sample[l] = read(`src/i18n/sample/${l}.sql`);
    if (l === "zh-TW") continue;
    const table = tables[l] = JSON.parse(read(`src/i18n/${l}.json`));
    for (const k of keys.keys()){
      if (!(k in table)){ problems.push(`src/i18n/${l}.json: no translation for ${JSON.stringify(k)} (${keys.get(k)})`); continue; }
      const v = table[k], forms = v && typeof v === "object" ? [v.one, v.other].filter(x => x != null) : [v];
      if (!forms.length || forms.some(x => typeof x !== "string" || !x)) problems.push(`src/i18n/${l}.json: empty translation for ${JSON.stringify(k)}`);
      else if (forms.some(x => placeholders(x) !== placeholders(k))) problems.push(`src/i18n/${l}.json: ${JSON.stringify(k)} must keep the placeholders {${placeholders(k)}}`);
    }
    for (const k of Object.keys(table)) if (!keys.has(k)) problems.push(`src/i18n/${l}.json: ${JSON.stringify(k)} is no longer used`);
  }
  if (problems.length) throw new Error("Interface text needs attention (" + problems.length + "):\n  " + problems.slice(0, 40).join("\n  ") + (problems.length > 40 ? "\n  …" : "") + "\nnode build.mjs --i18n-todo lists every missing translation as JSON to fill in.");
  return { tables, help, sample };
}
const jsonInScript = v => JSON.stringify(v).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
export function styles(){ return listDir("src/styles/").filter(f => f.endsWith(".css")).map(f => read("src/styles/" + f)).join(""); }
export function appScript(){
  const code = listDir("src/js/").filter(f => f.endsWith(".js")).map(f => read("src/js/" + f)).join("");
  if (code.includes("�")) throw new Error("A source file contains U+FFFD (a lost character). Write it as \\uFFFD.");
  const { tables, help, sample } = i18nData();
  const data = `const I18N = ${jsonInScript(tables)}, HELP_DOCS = ${jsonInScript(help)}, SAMPLE_DOCS = ${jsonInScript(sample)};\n`;
  return `(function(){\n"use strict";\n${data}${code}})();\n`;
}

export function artifactPage(){
  const tags = [VENDOR.codemirror, VENDOR.marked, VENDOR.purify].map(f => `<script src="vendor/${f}"></script>\n`).join("");
  return read("src/head.html") + "<style>\n" + styles() + "</style>\n\n" + read("src/markup.html") + tags + "<script>\n" + appScript() + "</script>\n";
}

function shell(body, headExtra = ""){
  return `<!doctype html>\n<html lang="zh-Hant">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n<style>:root{color-scheme:light}body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>\n${headExtra}</head>\n<body>\n${body}</body>\n</html>\n`;
}

/* Inline <script> content must not contain "</script", "<script" or "<!--". Writing "<" as the JS escape \x3C keeps the
   meaning inside strings, regular expressions and template literals, which is where these sequences occur in the libraries. */
const inlineSafe = code => code.replace(/<(\/?script|!--)/gi, "\\x3C$1");

export function standalonePage(files){
  const shim = `<script>
/* Standalone build: there is no Claude download capability here, so saving uses an ordinary browser download. */
window.__ppLocal = true;
if (!window.claude) window.claude = { use: async name => name !== "downloads" ? null : { save: async ({ filename, data }) => {
  const a = document.createElement("a"); a.href = URL.createObjectURL(data instanceof Blob ? data : new Blob([data])); a.download = filename;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 60000); return { status: "saved" }; } } };
</script>
`;
  const now = [VENDOR.codemirror, VENDOR.marked, VENDOR.purify].map(f => `<script>\n${inlineSafe(files[f])}\n</script>\n`).join("");
  const lazy = [["katex", VENDOR.katex], ["mermaid", VENDOR.mermaid]].map(([n, f]) => `<script type="text/plain" id="pp-lib-${n}">\n${inlineSafe(files[f])}\n</script>\n`).join("");
  const head = read("src/head.html").replace(/<meta name="claude:[^>]*>\n/, "") + "<style>\n" + styles() + "</style>\n";
  return shell(read("src/markup.html") + shim + now + lazy + "<script>\n" + inlineSafe(appScript()) + "</script>\n", head);
}

function checkVendorRefs(html, files){
  for (const m of html.matchAll(/vendor\/([\w.-]+\.js)/g)) if (!files[m[1]]) throw new Error(`The page refers to vendor/${m[1]}, which this build does not produce. Update the source to ${Object.keys(files).join(", ")}.`);
}

/* node build.mjs --i18n-todo: every key a locale lacks, as JSON ready to translate and merge into its file. */
function i18nTodo(){
  const { keys } = i18nKeys(), out = {};
  for (const l of LOCALES.slice(1)){
    let table = {}; try { table = JSON.parse(read(`src/i18n/${l}.json`)); } catch(e){}
    out[l] = Object.fromEntries([...keys.keys()].filter(k => !(k in table)).map(k => [k, ""]));
  }
  console.log(JSON.stringify(out, null, 1));
}

async function main(){
  if (process.argv.includes("--i18n-todo")) return i18nTodo();
  const files = await vendorFiles();
  const page = artifactPage();
  checkVendorRefs(page, files);
  rmSync(new URL("dist/", root), { recursive: true, force: true });
  for (const dir of ["dist/artifact/vendor/", "dist/test/vendor/"]) mkdirSync(new URL(dir, root), { recursive: true });
  writeFileSync(new URL("dist/artifact/plainpad.html", root), page);
  for (const [name, code] of Object.entries(files)){
    writeFileSync(new URL("dist/artifact/vendor/" + name, root), code);
    copyFileSync(new URL("dist/artifact/vendor/" + name, root), new URL("dist/test/vendor/" + name, root));
  }
  writeFileSync(new URL("dist/test/index.html", root), shell(page, "<script>window.__PP_TEST = true</script>\n"));
  writeFileSync(new URL("dist/test/prod.html", root), shell(page));
  const standalone = standalonePage(files);
  writeFileSync(new URL("dist/plainpad-standalone.html", root), standalone);
  const i = process.argv.indexOf("--compare");
  if (i > 0){
    const other = readFileSync(process.argv[i + 1], "utf8");
    if (other !== page){ let k = 0; while (other[k] === page[k]) k++; throw new Error(`Build differs from ${process.argv[i + 1]} at character ${k}: …${JSON.stringify(page.slice(k - 40, k + 40))}`); }
    console.log("Identical to", process.argv[i + 1]);
  }
  console.log("Built dist/artifact/plainpad.html", (page.length / 1024).toFixed(0) + " KB,", Object.keys(files).length, "vendor files");
  console.log("Built dist/plainpad-standalone.html", (standalone.length / 1048576).toFixed(1) + " MB");
}
if (import.meta.url === `file://${process.argv[1]}`) await main();
