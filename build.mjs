// Builds Plainpad from src/ into dist/.
//   dist/artifact/plainpad.html + dist/artifact/vendor/*   the page published to Claude (libraries are published next to it)
//   dist/test/index.html                                   the artifact page inside a document shell, with the test hook on
// Usage: node build.mjs [--compare path/to/published.html]
import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync, copyFileSync } from "node:fs";
import { minify } from "terser";

const root = new URL("./", import.meta.url);
const read = p => readFileSync(new URL(p, root), "utf8");
const version = name => JSON.parse(read(`node_modules/${name}/package.json`)).version;
const V = { codemirror: version("codemirror"), marked: version("marked"), dompurify: version("dompurify"), katex: version("katex"), mermaid: version("mermaid") };

// CodeMirror files Plainpad uses, in load order.
const CM_FILES = [
  "lib/codemirror",
  "mode/clike/clike", "mode/javascript/javascript", "mode/xml/xml", "mode/css/css", "mode/htmlmixed/htmlmixed", "mode/sql/sql",
  "mode/python/python", "mode/go/go", "mode/markdown/markdown", "mode/shell/shell", "mode/yaml/yaml", "mode/properties/properties",
  "addon/fold/foldcode", "addon/fold/foldgutter", "addon/fold/brace-fold", "addon/fold/xml-fold", "addon/fold/indent-fold", "addon/fold/comment-fold",
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
export function styles(){ return listDir("src/styles/").filter(f => f.endsWith(".css")).map(f => read("src/styles/" + f)).join(""); }
export function appScript(){
  const code = listDir("src/js/").filter(f => f.endsWith(".js")).map(f => read("src/js/" + f)).join("");
  if (code.includes("�")) throw new Error("A source file contains U+FFFD (a lost character). Write it as \\uFFFD.");
  return `(function(){\n"use strict";\n${code}})();\n`;
}

export function artifactPage(){
  const tags = [VENDOR.codemirror, VENDOR.marked, VENDOR.purify].map(f => `<script src="vendor/${f}"></script>\n`).join("");
  return read("src/head.html") + "<style>\n" + styles() + "</style>\n\n" + read("src/markup.html") + tags + "<script>\n" + appScript() + "</script>\n";
}

function shell(body, headExtra = ""){
  return `<!doctype html>\n<html lang="zh-Hant">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n<style>:root{color-scheme:light}body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>\n${headExtra}</head>\n<body>\n${body}</body>\n</html>\n`;
}

function checkVendorRefs(html, files){
  for (const m of html.matchAll(/vendor\/([\w.-]+\.js)/g)) if (!files[m[1]]) throw new Error(`The page refers to vendor/${m[1]}, which this build does not produce. Update the source to ${Object.keys(files).join(", ")}.`);
}

async function main(){
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
  const i = process.argv.indexOf("--compare");
  if (i > 0){
    const other = readFileSync(process.argv[i + 1], "utf8");
    if (other !== page){ let k = 0; while (other[k] === page[k]) k++; throw new Error(`Build differs from ${process.argv[i + 1]} at character ${k}: …${JSON.stringify(page.slice(k - 40, k + 40))}`); }
    console.log("Identical to", process.argv[i + 1]);
  }
  console.log("Built dist/artifact/plainpad.html", (page.length / 1024).toFixed(0) + " KB,", Object.keys(files).length, "vendor files");
}
if (import.meta.url === `file://${process.argv[1]}`) await main();
