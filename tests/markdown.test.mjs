import assert from "node:assert/strict";

const SPEC = [
  "# 會員點數規格", "", "[跳到資料表](#資料表)", "", "## 需求摘要", "", "- [x] 消費累積點數", "- [ ] 點數到期提醒", "", "> 注意：點數不可轉讓。", "",
  "## 資料表", "", "| 欄位 | 型別 | 說明 |", "| --- | --- | --- |", "| MemberId | INT | 會員編號 |", "| Points | INT | 目前點數 |", "",
  "```sql", "SELECT MemberId, SUM(Points) FROM dbo.PointLog GROUP BY MemberId;", "```", "", "![架構圖](diagram.png)", "",
  "<script>window.__xss=1</script><img src=x onerror=\"window.__xss=2\">", "",
  ...Array.from({ length: 80 }, (_, i) => `段落 ${i + 1}：這是一段測試文字。\n`)
].join("\n");

const DIAGRAMS = [
  "# 公式與圖表", "", "質能等價 $E = mc^2$，價格是 \\$5 到 \\$10，代碼 `$x$` 不轉換。", "",
  "$$", "\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}", "$$", "",
  "```math", "\\int_0^\\infty e^{-x^2}\\,dx = \\frac{\\sqrt{\\pi}}{2}", "```", "",
  "錯誤公式 $\\frac{1}{$ 結束。", "",
  "```mermaid", "flowchart LR", "  A[收到訂單] --> B{庫存足夠?}", "  B -- 是 --> C[出貨]", "  B -- 否 --> D[通知補貨]", "```", "",
  "```mermaid", "sequenceDiagram", "  Client->>API: POST /pay", "  API-->>Client: 200 OK", "```", "",
  "```mermaid", "flowchart LR", "  A --> ", "```", "", "最後一段。"
].join("\n");

async function preview(p, text, name){
  await p.evaluate(([t, n]) => { const A = window.__plainpad; A.A.newTab(); A.cmMain.setValue(t); A.tabs()[A.tabs().length - 1].name = n; if (!A.md.open) A.A.mdPreview(); else A.renderMd(); }, [text, name]);
  await p.waitForTimeout(400);
}

export default [
  { name: "code blocks in the newly added languages are highlighted", async fn({ open }){
    const p = await open();
    await preview(p, "```rust\nfn main() {}\n```\n\n```swift\nlet x = 1\n```\n\n```dockerfile\nFROM node:20\n```\n", "a.md");
    const kw = await p.evaluate(() => [...document.querySelectorAll("#mdBody pre code")].map(c => c.querySelectorAll(".cm-keyword").length > 0));
    assert.deepEqual(kw, [true, true, true]);
  }},
  { name: "renders GFM, highlights code and strips scripts", async fn({ open }){
    const p = await open();
    await preview(p, SPEC, "spec.md");
    const r = await p.evaluate(() => { const b = document.querySelector("#mdBody"); return {
      h1: b.querySelector("h1").textContent, tables: b.querySelectorAll("table").length, tasks: b.querySelectorAll("input[type=checkbox]").length,
      keywords: b.querySelectorAll("pre .cm-keyword").length, imagePlaceholders: b.querySelectorAll(".md-img").length,
      scripts: b.querySelectorAll("script").length, handlers: /onerror/.test(b.innerHTML), xss: window.__xss || 0 }; });
    assert.deepEqual(r, { h1:"會員點數規格", tables:1, tasks:2, keywords:4, imagePlaceholders:2, scripts:0, handlers:false, xss:0 });
  }},

  { name: "preview follows edits, scrolls with the editor and jumps back on double-click", async fn({ open }){
    const p = await open();
    await preview(p, SPEC, "spec.md");
    await p.evaluate(() => { const c = window.__plainpad.cmMain; c.scrollTo(null, c.heightAtLine(100, "local")); });
    await p.waitForTimeout(200);
    assert.ok(await p.evaluate(() => document.querySelector("#mdScroll").scrollTop) > 500, "preview scrolled along");
    await p.evaluate(() => window.__plainpad.cmMain.replaceRange("# 改過的標題", { line:0, ch:0 }, { line:0 }));
    await p.waitForTimeout(400);
    assert.equal(await p.textContent("#mdBody h1"), "改過的標題");
    await p.evaluate(() => { document.querySelector("#mdScroll").scrollTop = 0; }); await p.waitForTimeout(150);
    await p.dblclick("#mdBody table");
    assert.equal(await p.evaluate(() => window.__plainpad.cmMain.getCursor().line), 13);
  }},

  { name: "math renders as MathML and bad formulas are marked, not thrown", async fn({ open }){
    const p = await open();
    await preview(p, DIAGRAMS, "math.md");
    await p.waitForFunction(() => document.querySelectorAll("#mdBody math").length >= 3, null, { timeout: 15000 });
    const r = await p.evaluate(() => { const b = document.querySelector("#mdBody"); return { math: b.querySelectorAll("math").length, errors: b.querySelectorAll(".katex-error").length, firstPara: b.querySelector("p").textContent.includes("$5 到 $10"), code: b.querySelector("p code").textContent }; });
    assert.deepEqual(r, { math:3, errors:1, firstPara:true, code:"$x$" });
  }},

  { name: "Mermaid draws diagrams, reports syntax errors and follows the theme", async fn({ open }){
    const p = await open();
    await preview(p, DIAGRAMS, "chart.md");
    await p.waitForFunction(() => document.querySelectorAll("#mdBody .md-mermaid svg").length === 2 && document.querySelector("#mdBody .md-mermaid-err"), null, { timeout: 20000 });
    assert.match(await p.textContent("#mdBody .md-mermaid-err"), /Mermaid syntax error/);
    assert.equal(await p.evaluate(() => [...document.body.children].filter(x => /^[di]?ppmm/.test(x.id)).length), 0, "no leftover render nodes");
    await p.evaluate(() => { const A = window.__plainpad; A.run("cycleTheme"); A.run("cycleTheme"); });
    await p.waitForFunction(() => document.querySelectorAll("#mdBody .md-mermaid svg").length === 2, null, { timeout: 20000 });
    assert.deepEqual(p.errors, []);
  }},

  { name: "HTML export embeds light-theme diagrams and MathML", async fn({ open }){
    const p = await open({ clipboard: true });
    await preview(p, "# T\n\n$a^2$\n\n```mermaid\ngraph TD\nA-->B\n```", "export.md");
    await p.evaluate(() => { const A = window.__plainpad; A.run("cycleTheme"); A.run("cycleTheme"); });
    await p.waitForFunction(() => document.querySelector("#mdBody .md-mermaid svg"), null, { timeout: 20000 });
    await p.click("#mdExport");
    await p.waitForFunction(() => (window.__saves || []).length, null, { timeout: 20000 });
    const html = Buffer.from((await p.evaluate(() => window.__saves[0].b64)), "base64").toString("utf8");
    assert.match(html, /<math/); assert.match(html, /<svg/); assert.doesNotMatch(html, /data-(tex|code)=/);
    assert.match(html, /#ECECFF/i, "diagram uses the light theme");
  }}
];
