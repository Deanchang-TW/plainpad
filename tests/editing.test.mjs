import assert from "node:assert/strict";
import { MOD } from "./platform.mjs";

const P = fn => `(${fn})(window.__plainpad)`;   // page.evaluate(P(A => ...)) runs fn in the page with A = the test hook

export default [
  { name: "page loads with both default tabs and no errors", async fn({ open }){
    const p = await open();
    assert.deepEqual(await p.evaluate(P(A => A.tabs().map(t => t.name))), ["Plainpad 說明.md", "monthly-orders.sql"]);
    const tb = await p.locator(".tools .tool").first().boundingBox();
    assert.ok(tb.x < 40, `toolbar starts at the left edge (x=${tb.x})`);
    assert.deepEqual(p.errors, []);
  }},

  { name: "toolbar icon style switches to mono from the settings menu and survives a reload", async fn({ open }){
    const p = await open();
    assert.equal(await p.evaluate(() => document.documentElement.dataset.icons), "color", "colour icons by default");
    assert.ok(await p.locator(".tools .tool svg .f").count() > 10, "icons carry a fill shape for the colour style");
    await p.click(".menu-btn:has-text(\"設定\")"); await p.click(".menu-pop .menu-item:has-text(\"單色\")");
    assert.equal(await p.evaluate(() => document.documentElement.dataset.icons), "mono");
    await p.waitForTimeout(1000); await p.reload(); await p.waitForSelector("#tabs .tab");
    assert.equal(await p.evaluate(() => document.documentElement.dataset.icons), "mono", "the choice is stored with the other settings");
  }},

  { name: "tsx files highlight JSX instead of treating it as a string", async fn({ open }){
    const p = await open();
    const src = "const App = () => {\n  return (\n    <div className=\"a\" style={{ backgroundImage: `url(${x})` }}>\n      {theme === 'dark' && <span>it's</span>}\n    </div>\n  );\n};\nconst after = 1;\n";
    const r = await p.evaluate(src => { const A = window.__plainpad; A.A.newTab(); A.cmMain.setValue(src); A.cmMain.setOption("mode", "text/typescript-jsx");
      return { tag: A.cmMain.getTokenTypeAt({ line:2, ch:5 }), kw: A.cmMain.getTokenTypeAt({ line:7, ch:2 }), attr: A.cmMain.getTokenTypeAt({ line:2, ch:10 }) }; }, src);
    assert.match(r.tag || "", /tag/, "the <div> is a tag");
    assert.match(r.kw || "", /keyword/, "code after the JSX is still parsed as code");
    assert.match(r.attr || "", /attribute/, "className is an attribute");
    assert.equal(await p.evaluate(() => [...document.querySelectorAll("#stLang option")].find(o => o.value === "tsx").textContent), "TypeScript (TSX)");
  }},

  { name: "fold guides mark block start, body and end, and a click folds the block", async fn({ open }){
    const p = await open();
    await p.evaluate(P(A => { A.A.newTab(); A.cmMain.setValue("function a(){\n  if (x){\n    y();\n  }\n  z();\n}\nlast();"); A.cmMain.setOption("mode", "text/javascript"); }));
    await p.waitForFunction(() => document.querySelectorAll(".CodeMirror-gutter-elt .fg").length >= 6);
    const cls = await p.evaluate(() => { const out = []; document.querySelectorAll(".CodeMirror-code > div").forEach(d => { const m = d.querySelector(".fg"); out.push(m ? m.className.replace(/^fg /, "") : ""); }); return out; });
    assert.deepEqual(cls.slice(0, 7), ["fg-s fg-b", "fg-s fg-a fg-b", "fg-m fg-a fg-b", "fg-e fg-a fg-b", "fg-m fg-a fg-b", "fg-e fg-a", ""], "outer block: start, body, end; inner block nested with the outer line continuing");
    await p.click(".CodeMirror-code > div:nth-child(2) .fg i");
    assert.equal(await p.evaluate(P(A => A.cmMain.findMarks({ line:1, ch:0 }, { line:2, ch:0 }).filter(m => m.__isFold).length)), 1, "clicking the box folds the inner block");
    await p.waitForFunction(() => document.querySelector(".CodeMirror-code > div:nth-child(2) .fg.fg-f"));
    assert.ok(await p.evaluate(() => !!document.querySelector(".CodeMirror-foldmarker")), "the folded line shows the placeholder");
    await p.click(".menu-btn:has-text(\"設定\")"); await p.click(".menu-pop .menu-item:has-text(\"VS Code\")");
    assert.equal(await p.evaluate(() => document.documentElement.dataset.fold), "chevrons");
  }},

  { name: "macro records typing and cursor keys, then runs to end of file", async fn({ open }){
    const p = await open();
    await p.evaluate(P(A => { A.A.newTab(); A.cmMain.setValue("alpha\nbeta\ngamma"); A.cmMain.setCursor(0, 0); A.cmMain.focus(); }));
    await p.keyboard.press("Alt+Shift+KeyR"); await p.keyboard.type("- "); await p.keyboard.press("ArrowDown"); await p.keyboard.press("Home"); await p.keyboard.press("Alt+Shift+KeyR");
    await p.evaluate(P(A => A.playMacro(null, 1, true)));
    assert.equal(await p.evaluate(P(A => A.cmMain.getValue())), "- alpha\n- beta\n- gamma");
  }},

  { name: "column editor inserts zero-padded numbers down the column", async fn({ open }){
    const p = await open();
    await p.evaluate(P(A => { A.A.newTab(); A.cmMain.setValue("a\nbb\n\nd"); A.cmMain.setCursor(0, 1); A.cmMain.focus(); }));
    await p.keyboard.press("Alt+KeyC");
    await p.click("#ceKindNum"); await p.fill("#ceStart", "8"); await p.check("#ceZero"); await p.click("#modalActions .btn-primary");
    assert.equal(await p.evaluate(P(A => A.cmMain.getValue())), "a08\nb09b\n 10\nd11");
  }},

  { name: "compare finds changed, added and removed lines", async fn({ open }){
    const p = await open();
    const r = await p.evaluate(P(A => { A.A.newTab(); A.cmMain.setValue("l1\nl2\nl3\nl4\nl5"); A.A.newTab(); A.cmMain.setValue("l1\nl2 changed\nl3\nnew\nl5\nl6");
      const t = A.tabs(); A.startCompare(t[t.length - 2]); return { hunks: A.cmp.hunks, info: document.querySelector("#cmpInfo").textContent }; }));
    assert.deepEqual(r.hunks, [{ a0:1, b0:1, ka:1, kb:1 }, { a0:3, b0:3, ka:1, kb:1 }, { a0:5, b0:5, ka:1, kb:0 }], "left is the current tab, which has the extra last line");
    assert.match(r.info, /第 1 \/ 3 處差異|差異 3 處/);
  }},

  { name: "list all matches and jump to one", async fn({ open }){
    const p = await open();
    await p.evaluate(P(A => { A.A.newTab(); A.cmMain.setValue("foo bar\nbaz foo foo\nnone"); }));
    await p.keyboard.press(`${MOD}+KeyF`); await p.fill("#findInput", "foo"); await p.click("#btnListCur");
    assert.equal(await p.locator(".res-row").count(), 2);
    assert.match(await p.textContent("#resTitle"), /3 筆/);
    await p.click(".res-row >> nth=1");
    assert.deepEqual(await p.evaluate(P(A => { const c = A.cmMain.getCursor(); return [c.line, c.ch]; })), [1, 7]);
  }},

  { name: "bookmarks: keep only bookmarked lines", async fn({ open }){
    const p = await open();
    await p.evaluate(P(A => { A.A.newTab(); A.cmMain.setValue("one\ntwo\nthree"); A.cmMain.setCursor(1, 0); A.cmMain.focus(); }));
    await p.keyboard.press(`${MOD}+F2`);
    assert.equal(await p.locator(".bm-dot").count(), 1);
    await p.evaluate(P(A => A.A.bmKeepOnly()));
    assert.equal(await p.evaluate(P(A => A.cmMain.getValue())), "two");
  }},

  { name: "every menu opens without errors and the page fits a phone", async fn({ open }){
    const p = await open();
    const n = await p.locator(".menu-btn").count();
    for (let i = 0; i < n; i++){ await p.click("#menuBtn" + i); assert.ok(await p.locator(".menu-pop").count(), `menu ${i} opened`); }
    await p.keyboard.press("Escape");
    await p.setViewportSize({ width:400, height:800 });
    assert.equal(await p.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0);
    assert.deepEqual(p.errors, []);
  }},

  { name: "the published page has no test hook and loads every script", async fn({ open }){
    const failedRequests = [];
    const p = await open({ path: "/test/prod.html", downloads: false });
    p.on("response", r => { if (r.status() >= 400) failedRequests.push(r.url()); });
    await p.reload(); await p.waitForSelector("#tabs .tab");
    assert.equal(await p.evaluate(() => "__plainpad" in window), false);
    assert.deepEqual(failedRequests, []);
  }}
];
