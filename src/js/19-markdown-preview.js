/* ---------- markdown preview ---------- */
const md = { open:false, timer:0, blocks:[], tab:null, ignoreEd:0, ignoreMd:0, gen:0 };
function syncHeads(){ $("#p1Head").hidden = $("#pane2").hidden && !md.open; }
function mdEd(){ return (cm === cm2 && !$("#pane2").hidden && split.tab) ? cm2 : cmMain; }
function mdTab(){ return mdEd() === cm2 ? split.tab : cur(); }
function toggleMd(force){
  const on = force ?? !md.open; md.open = on;
  $("#pane3").hidden = !on; $("#tMd").setAttribute("aria-pressed", String(on)); syncHeads();
  if (settings.mdPreview !== on){ settings.mdPreview = on; persistSoon(); }
  if (on) renderMd();
  cmMain.refresh(); if (!$("#pane2").hidden) cm2.refresh();
}
function mdSoon(ms = 220){ if (!md.open) return; clearTimeout(md.timer); md.timer = setTimeout(renderMd, ms); }
const CODE_MIME = { c:"text/x-csrc", h:"text/x-csrc", cpp:"text/x-c++src", "c++":"text/x-c++src", cc:"text/x-c++src", cs:"text/x-csharp", csharp:"text/x-csharp", "c#":"text/x-csharp",
  java:"text/x-java", kotlin:"text/x-kotlin", kt:"text/x-kotlin", js:"text/javascript", javascript:"text/javascript", jsx:"text/javascript", mjs:"text/javascript",
  ts:"text/typescript", typescript:"text/typescript", tsx:"text/typescript", json:"application/json", jsonc:"application/json", html:"htmlmixed", htm:"htmlmixed", vue:"htmlmixed",
  xml:"application/xml", svg:"application/xml", xaml:"application/xml", css:"text/css", scss:"text/x-scss", sql:"text/x-sql", tsql:"text/x-mssql", mssql:"text/x-mssql", "t-sql":"text/x-mssql",
  mysql:"text/x-mysql", pgsql:"text/x-pgsql", postgres:"text/x-pgsql", postgresql:"text/x-pgsql", py:"text/x-python", python:"text/x-python", go:"text/x-go", golang:"text/x-go",
  sh:"text/x-sh", bash:"text/x-sh", shell:"text/x-sh", zsh:"text/x-sh", console:"text/x-sh", yaml:"text/x-yaml", yml:"text/x-yaml",
  ini:"text/x-properties", toml:"text/x-properties", properties:"text/x-properties", env:"text/x-properties", md:"text/x-markdown", markdown:"text/x-markdown" };
const LIB = { katex:"vendor/katex-0.19.1.min.js", mermaid:"vendor/mermaid-12.2.0.min.js" };
const libLoads = {};
function loadLib(name, globalName){
  if (window[globalName]) return Promise.resolve(window[globalName]);
  if (!libLoads[name]) libLoads[name] = new Promise((res, rej) => {
    const sc = document.createElement("script"), inline = document.getElementById("pp-lib-" + name);
    if (inline){ sc.textContent = inline.textContent; document.head.appendChild(sc); window[globalName] ? res(window[globalName]) : rej(new Error("內嵌的 " + name + " 無法執行")); return; }
    sc.src = LIB[name]; sc.async = true;
    sc.onload = () => window[globalName] ? res(window[globalName]) : rej(new Error("載入後找不到 " + globalName));
    sc.onerror = () => { delete libLoads[name]; rej(new Error("無法下載 " + name + "，請確認網路連線")); };
    document.head.appendChild(sc);
  });
  return libLoads[name];
}
const escAttr = s => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
if (typeof marked !== "undefined") marked.use({ extensions: [
  { name:"blockMath", level:"block",
    start(src){ const m = /^\$\$/m.exec(src); return m ? m.index : undefined; },
    tokenizer(src){ const m = /^\$\$([\s\S]+?)\$\$[ \t]*(?:\n|$)/.exec(src); if (m) return { type:"blockMath", raw:m[0], text:m[1].trim() }; },
    renderer(t){ return `<div class="md-math md-math-block" data-tex="${escAttr(t.text)}"></div>\n`; } },
  { name:"inlineMath", level:"inline",
    start(src){ const m = /(?<!\\)\$/.exec(src); return m ? m.index : undefined; },
    tokenizer(src){
      let m = /^\$\$((?:\\[\s\S]|[^\\$])+?)\$\$/.exec(src);
      if (m) return { type:"inlineMath", raw:m[0], text:m[1].trim(), display:true };
      m = /^\$(?![\s$])((?:\\[\s\S]|[^\\\n$])+?)(?<!\s)\$(?!\d)/.exec(src);
      if (m) return { type:"inlineMath", raw:m[0], text:m[1], display:false };
    },
    renderer(t){ return `<span class="md-math${t.display ? " md-math-block" : ""}" data-tex="${escAttr(t.text)}"></span>`; } }
]});
function isDarkTheme(){
  const r = document.documentElement;
  if (r.dataset.padTheme) return r.dataset.padTheme === "dark";
  if (r.dataset.theme) return r.dataset.theme === "dark";
  return matchMedia("(prefers-color-scheme: dark)").matches;
}
/* Mermaid: one render at a time (it keeps global config), results cached by theme + source. */
const mm = { cache:new Map(), chain:Promise.resolve(), theme:null, seq:0 };
function mermaidSvg(code, theme){
  const key = theme + "\n" + code;
  if (mm.cache.has(key)) return Promise.resolve(mm.cache.get(key));
  const job = mm.chain.then(async () => {
    if (mm.cache.has(key)) return mm.cache.get(key);
    const mermaid = await loadLib("mermaid", "mermaid");
    if (mm.theme !== theme){ mermaid.initialize({ startOnLoad:false, securityLevel:"strict", theme, fontFamily:getComputedStyle(document.documentElement).getPropertyValue("--ui") || "sans-serif" }); mm.theme = theme; }
    const id = "ppmm" + (++mm.seq);
    let out;
    try { out = { svg: (await mermaid.render(id, code)).svg }; }
    catch(e){ out = { error: String((e && (e.str || e.message)) || e).replace(/^Error:\s*/, "") }; }
    finally { ["", "d", "i"].forEach(pre => { const x = document.getElementById(pre + id); if (x && !x.closest("#mdBody")) x.remove(); }); }
    mm.cache.set(key, out); if (mm.cache.size > 80) mm.cache.delete(mm.cache.keys().next().value);
    return out;
  });
  mm.chain = job.catch(() => {});
  return job;
}
function fillMermaid(box, res){
  if (res.error){ box.classList.add("md-mermaid-err"); box.textContent = "Mermaid 語法錯誤：\n" + res.error; }
  else { box.classList.remove("md-mermaid-err"); box.innerHTML = res.svg; }
}
function renderMath(root){
  const nodes = root.querySelectorAll(".md-math[data-tex]"); if (!nodes.length) return true;
  if (!window.katex){ nodes.forEach(n => { n.classList.add("md-math-pending"); n.textContent = n.classList.contains("md-math-block") ? "$$ " + n.dataset.tex + " $$" : "$" + n.dataset.tex + "$"; }); return false; }
  nodes.forEach(n => { n.classList.remove("md-math-pending"); try { katex.render(n.dataset.tex, n, { displayMode: n.classList.contains("md-math-block"), output:"mathml", throwOnError:false, strict:"ignore", trust:false }); } catch(e){ n.textContent = n.dataset.tex; } });
  return true;
}
function slugify(t){ return t.trim().toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, "").replace(/\s+/g, "-") || "section"; }
/* Renders markdown into a detached element. Each top-level block is wrapped with the source line it starts on, for scroll sync and double-click-to-jump. */
function buildMd(text, forExport){
  if (typeof marked === "undefined" || typeof DOMPurify === "undefined"){ const d = document.createElement("div"); d.append(el("p", { class:"md-empty", text:"Markdown 元件沒有載入，請重新整理頁面再試一次。" })); return d; }
  const tokens = marked.lexer(text);
  let line = 0, html = "";
  for (const tok of tokens){
    const start = line; line += (tok.raw.match(/\n/g) || []).length;
    if (tok.type === "space") continue;
    const one = [tok]; one.links = tokens.links;
    const inner = marked.parser(one);
    html += forExport ? inner : `<div class="md-block" data-line="${start}">${inner}</div>`;
  }
  // Parse inside an inert <template> so images and other resources are not fetched before they are replaced.
  const tpl = document.createElement("template");
  tpl.innerHTML = "<div>" + DOMPurify.sanitize(html, { ADD_ATTR:["target"] }) + "</div>";
  const host = tpl.content.firstChild;
  const used = new Map();
  host.querySelectorAll("h1,h2,h3,h4,h5,h6").forEach(h => { let id = slugify(h.textContent); const n = used.get(id) || 0; used.set(id, n + 1); if (n) id += "-" + n; h.id = id; });
  host.querySelectorAll("a[href]").forEach(a => { if (/^(https?:|mailto:)/i.test(a.getAttribute("href"))){ a.target = "_blank"; a.rel = "noopener noreferrer"; } });
  if (!forExport) host.querySelectorAll("img").forEach(img => {
    const src = img.getAttribute("src") || "";
    if (/^data:image\//i.test(src)) return;
    const ph = el("span", { class:"md-img", title: src }, "圖片：" + (img.getAttribute("alt") || src || "未命名") + "（預覽無法載入外部或相對路徑的圖片，匯出的 HTML 可以）");
    img.replaceWith(ph);
  });
  host.querySelectorAll("pre > code.language-mermaid").forEach(code => { const d = el("div", { class:"md-mermaid" }); d.dataset.code = code.textContent.replace(/\n$/, ""); code.parentNode.replaceWith(d); });
  host.querySelectorAll("pre > code.language-math, pre > code.language-latex, pre > code.language-tex").forEach(code => { const d = el("div", { class:"md-math md-math-block" }); d.dataset.tex = code.textContent.trim(); code.parentNode.replaceWith(d); });
  host.querySelectorAll("pre > code").forEach(code => {
    const m = /language-([\w#+.-]+)/.exec(code.className || ""); const mime = m && CODE_MIME[m[1].toLowerCase()];
    if (mime && CodeMirror.runMode){ const src = code.textContent; code.textContent = ""; try { CodeMirror.runMode(src.replace(/\n$/, ""), mime, code); } catch(e){ code.textContent = src; } }
  });
  return host;
}
function renderMd(){
  if (!md.open) return;
  const t = mdTab(); if (!t) return; md.tab = t;
  $("#mdName").textContent = "· " + t.name; $("#mdNote").hidden = t.langId === "md" || isHex(t);
  if (isHex(t)){ $("#mdBody").replaceChildren(el("p", { class:"md-empty", text:"Hex 分頁沒有 Markdown 預覽。切回文字檢視後就會顯示。" })); md.blocks = []; return; }
  const scroller = $("#mdScroll"), body = $("#mdBody"); const keep = scroller.scrollTop;
  const text = t.doc.getValue();
  if (!text.trim()){ body.replaceChildren(el("p", { class:"md-empty", text:"這個分頁是空的。開始輸入 Markdown，右邊就會即時顯示結果。" })); md.blocks = []; return; }
  const host = buildMd(text, false);
  const mathReady = renderMath(host);
  const theme = isDarkTheme() ? "dark" : "default"; const pending = [];
  host.querySelectorAll(".md-mermaid").forEach(box => {
    const hit = mm.cache.get(theme + "\n" + box.dataset.code);
    if (hit) fillMermaid(box, hit); else { box.append(el("div", { class:"md-mermaid-wait", text:"圖表繪製中…" })); pending.push(box); }
  });
  body.replaceChildren(...host.childNodes);
  const gen = ++md.gen;
  if (!mathReady) loadLib("katex", "katex").then(() => { if (gen === md.gen) renderMath(body); }, e => toast("數學公式元件" + e.message.replace(/^無法下載 katex/, "無法下載")));
  pending.forEach(box => mermaidSvg(box.dataset.code, theme).then(res => { if (gen === md.gen && box.isConnected) fillMermaid(box, res); }, e => { if (box.isConnected){ box.classList.add("md-mermaid-err"); box.textContent = "無法繪製圖表：" + e.message; } }));
  md.blocks = [...body.querySelectorAll(":scope > .md-block")].map(b => ({ line: +b.dataset.line, el: b }));
  md.ignoreMd = performance.now() + 120; scroller.scrollTop = keep;
  if (settings.mdSync) mdSyncFromEditor(mdEd(), true);
}
function mdOffsetForLine(l){
  const B = md.blocks; if (!B.length) return 0;
  let i = 0; while (i + 1 < B.length && B[i + 1].line <= l) i++;
  const a = B[i], b = B[i + 1]; const ta = a.el.offsetTop;
  if (l < a.line) return 0;
  const tb = b ? b.el.offsetTop : ta + a.el.offsetHeight; const lb = b ? b.line : a.line + Math.max(1, Math.round(a.el.offsetHeight / 24));
  return ta + (tb - ta) * Math.min(1, (l - a.line) / Math.max(1, lb - a.line));
}
function mdLineForOffset(y){
  const B = md.blocks; if (!B.length) return 0;
  let i = 0; while (i + 1 < B.length && B[i + 1].el.offsetTop <= y) i++;
  const a = B[i], b = B[i + 1]; const ta = a.el.offsetTop, tb = b ? b.el.offsetTop : ta + a.el.offsetHeight;
  const lb = b ? b.line : a.line + 1;
  return a.line + (lb - a.line) * Math.max(0, Math.min(1, (y - ta) / Math.max(1, tb - ta)));
}
function mdSyncFromEditor(ed, force){
  if (!md.open || !settings.mdSync || ed !== mdEd() || !md.blocks.length) return;
  if (!force && performance.now() < md.ignoreEd) return;
  const info = ed.getScrollInfo(); const scroller = $("#mdScroll"), body = $("#mdBody");
  let target;
  if (info.top <= 1) target = 0;
  else if (info.top + info.clientHeight >= info.height - 2) target = scroller.scrollHeight;
  else {
    const line = ed.lineAtHeight(info.top, "local"); const lt = ed.heightAtLine(line, "local"), ln = ed.heightAtLine(line + 1, "local");
    target = body.offsetTop + mdOffsetForLine(line + Math.max(0, Math.min(1, (info.top - lt) / Math.max(1, ln - lt)))) - 12;
  }
  md.ignoreMd = performance.now() + 120; scroller.scrollTop = target;
}
$("#mdScroll").addEventListener("scroll", () => {
  if (!md.open || !settings.mdSync || performance.now() < md.ignoreMd || !md.blocks.length) return;
  const scroller = $("#mdScroll"), ed = mdEd(); let top;
  if (scroller.scrollTop <= 1) top = 0;
  else if (scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 2) top = ed.getScrollInfo().height;
  else { const l = mdLineForOffset(scroller.scrollTop - $("#mdBody").offsetTop + 12); const li = Math.floor(l); top = ed.heightAtLine(li, "local") + (ed.heightAtLine(li + 1, "local") - ed.heightAtLine(li, "local")) * (l - li); }
  md.ignoreEd = performance.now() + 120; ed.scrollTo(null, top);
});
$("#mdBody").addEventListener("click", e => {
  const a = e.target.closest("a[href]"); if (!a) return;
  const href = a.getAttribute("href");
  if (href.startsWith("#")){ e.preventDefault(); const t = document.getElementById(decodeURIComponent(href.slice(1))); if (t){ md.ignoreMd = 0; $("#mdScroll").scrollTop = t.offsetTop + $("#mdBody").offsetTop - 8; } return; }
  if (!/^(https?:|mailto:)/i.test(href)){ e.preventDefault(); toast("預覽無法開啟相對路徑的連結：" + href); }
});
$("#mdBody").addEventListener("dblclick", e => {
  const b = e.target.closest(".md-block"); if (!b) return;
  const ed = mdEd(); const line = +b.dataset.line;
  ed.focus(); ed.setCursor(Pos(line, 0)); ed.scrollIntoView(null, ed.getScrollInfo().clientHeight / 3);
  b.classList.remove("md-flash"); void b.offsetWidth; b.classList.add("md-flash");
});
$("#mdSync").addEventListener("change", e => { settings.mdSync = e.target.checked; persistSoon(); if (settings.mdSync) mdSyncFromEditor(mdEd(), true); });
$("#mdClose").addEventListener("click", () => { toggleMd(false); focusEditor(); });
const MD_EXPORT_CSS = `body{margin:0;background:#fff;color:#1b2127;font:16px/1.75 "IBM Plex Sans","PingFang TC","Noto Sans TC",system-ui,-apple-system,sans-serif}
.md-body{max-width:780px;margin:0 auto;padding:40px 24px 80px;overflow-wrap:break-word}
h1,h2,h3,h4,h5,h6{line-height:1.3;margin:1.5em 0 .6em;font-weight:600}
h1{font-size:1.85em;padding-bottom:.3em;border-bottom:1px solid #d5dbe1;margin-top:0}h2{font-size:1.45em;padding-bottom:.25em;border-bottom:1px solid #d5dbe1}h3{font-size:1.2em}
p,ul,ol,blockquote,pre,table{margin:0 0 1em}ul,ol{padding-left:1.6em}li+li{margin-top:.2em}
li:has(>input[type=checkbox]){list-style:none;margin-left:-1.3em}li>input[type=checkbox]{margin:0 .45em 0 0}
a{color:#0b7285}code{font:.88em/1.5 "JetBrains Mono","SF Mono",Menlo,Consolas,monospace;background:#f3f5f7;border:1px solid #d5dbe1;border-radius:4px;padding:.08em .35em}
pre{background:#f3f5f7;border:1px solid #d5dbe1;border-radius:6px;padding:12px 14px;overflow-x:auto;line-height:1.55}pre code{background:none;border:0;padding:0;font-size:13px}
blockquote{border-left:3px solid #d5dbe1;padding:.1em 0 .1em 1em;color:#67727e}
table{border-collapse:collapse;display:block;overflow-x:auto}th,td{border:1px solid #d5dbe1;padding:5px 12px;text-align:left}th{background:#f3f5f7}
hr{border:0;border-top:1px solid #d5dbe1;margin:1.8em 0}img{max-width:100%}
math{font-family:"STIX Two Math","Latin Modern Math","Cambria Math",math;font-size:1.12em}.md-math-block{display:block;overflow-x:auto;margin:0 0 1em;text-align:center}
.md-mermaid{margin:0 0 1em;text-align:center;overflow-x:auto}.md-mermaid svg{max-width:100%;height:auto}.md-mermaid-err{color:#c23b2a;white-space:pre-wrap;text-align:left;font-family:monospace}
.cm-keyword{color:#1b3fbf;font-weight:700}.cm-string{color:#a3410f}.cm-number{color:#c25e00}.cm-comment{color:#2c7d32;font-style:italic}.cm-def,.cm-type,.cm-variable-3{color:#7b2cb3}.cm-builtin,.cm-variable-2,.cm-property{color:#0b7285}.cm-atom,.cm-string-2{color:#b00069}.cm-meta,.cm-qualifier{color:#8a5a00}.cm-tag{color:#1b3fbf}.cm-attribute{color:#b45309}`;
async function mdExportHtml(){
  const t = isHex(mdTab()) ? makeTab({ name:mdTab().name, text:"" }) : (md.tab || mdTab()); const host = buildMd(t.doc.getValue(), true);
  if (host.querySelector(".md-math")){ try { await loadLib("katex", "katex"); } catch(e){} renderMath(host); }
  for (const box of host.querySelectorAll(".md-mermaid")){ try { fillMermaid(box, await mermaidSvg(box.dataset.code, "default")); } catch(e){ box.textContent = box.dataset.code; } box.removeAttribute("data-code"); }
  host.querySelectorAll(".md-math").forEach(n => n.removeAttribute("data-tex"));
  const h1 = host.querySelector("h1"); const title = (h1 && h1.textContent.trim()) || t.name.replace(/\.[^.]+$/, "");
  const esc = s => s.replace(/[&<>"]/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;" }[c]));
  return { title, body: host.innerHTML, doc: `<!doctype html>\n<html lang="zh-Hant">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>${esc(title)}</title>\n<style>\n${MD_EXPORT_CSS}\n</style>\n</head>\n<body>\n<article class="md-body">\n${host.innerHTML}\n</article>\n</body>\n</html>\n` };
}
$("#mdCopy").addEventListener("click", async () => { const r = await mdExportHtml(); toast((await copyText(r.body)) ? "已複製 HTML" : "瀏覽器拒絕寫入剪貼簿"); });
$("#mdExport").addEventListener("click", async () => {
  const t = md.tab || mdTab(); const r = await mdExportHtml(); const fname = t.name.replace(/\.[^.]+$/, "") + ".html";
  const dl = await getDownloads();
  if (!dl){ toast((await copyText(r.doc)) ? "這個檢視無法下載，已改為複製完整 HTML" : "這個檢視無法下載檔案"); return; }
  try { await dl.save({ filename: fname, data: r.doc }); toast("已匯出 " + fname); }
  catch(e){ toast(e && e.code === "declined" ? "已取消匯出" : "無法匯出：" + ((e && e.message) || "未知錯誤")); }
});

