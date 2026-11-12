import assert from "node:assert/strict";
import { join } from "node:path";

const names = p => p.evaluate(() => window.__plainpad.tabs().map(t => t.name));

export default [
  { name: "an old localStorage session is migrated to IndexedDB", async fn({ open, ready }){
    const p = await open({ init: () => { if (sessionStorage.getItem("seeded")) return; sessionStorage.setItem("seeded", "1");
      localStorage.setItem("plainpad.session.v1", JSON.stringify({ v:1, seq:3, active:1, settings:{ fontSize:15 }, tabs:[
        { name:"old-a.sql", text:"SELECT 1;\nSELECT 2;", lang:"mssql", eol:"CRLF", bom:false, enc:"Big5", untitled:false, dirty:true, cur:{ line:1, ch:3 }, bm:[1] },
        { name:"old-b.md", text:"# 舊資料", lang:"md", eol:"LF", bom:false, enc:"UTF-8", untitled:false, dirty:false, cur:{ line:0, ch:0 }, bm:[] } ] })); } });
    const state = () => p.evaluate(() => ({ tabs: window.__plainpad.tabs().map(t => [t.name, t.doc.getValue(), t.eol, t.encoding]), font: window.__plainpad.settings.fontSize }));
    const expected = { tabs: [["old-a.sql", "SELECT 1;\nSELECT 2;", "CRLF", "big5"], ["old-b.md", "# 舊資料", "LF", "utf-8"]], font: 15 };
    assert.deepEqual(await state(), expected);
    await p.waitForTimeout(1200);
    assert.deepEqual(await p.evaluate(() => [localStorage.getItem("plainpad.session.v1"), /SELECT 1/.test(localStorage.getItem("plainpad.session.v2"))]), [null, false], "old key removed, text not in localStorage");
    await p.reload(); await ready(p);
    assert.deepEqual(await state(), expected);
    assert.equal(await p.evaluate(() => document.querySelectorAll("#tabs .tab")[0].classList.contains("is-dirty")), true);
    await p.click("#tabs .tab >> nth=0"); assert.equal(await p.locator(".bm-dot").count(), 1, "bookmark kept");
  }},

  { name: "15 MB of text survives a reload and idle saves stay cheap", async fn({ open, ready, toast }){
    const p = await open();
    await p.evaluate(() => { const A = window.__plainpad, line = "SELECT CustomerId, Name, OrderDate, TotalAmount FROM dbo.Orders WHERE Status = 1;\n";
      for (let i = 0; i < 3; i++){ A.A.newTab(); A.cmMain.setValue(line.repeat(60000)); } });
    await p.waitForTimeout(2500);
    const ms = await p.evaluate(() => { const A = window.__plainpad; A.cmMain.setCursor(5, 0); const t = performance.now(); A.persist(); return performance.now() - t; });
    assert.ok(ms < 40, `saving with no text changes took ${ms.toFixed(1)} ms`);
    assert.equal(await toast(p), "");
    await p.waitForTimeout(800); await p.reload(); await ready(p);
    assert.deepEqual(await p.evaluate(() => window.__plainpad.tabs().slice(2).map(t => t.doc.getValue().length)), [4920000, 4920000, 4920000]);
  }},

  { name: "hex tabs store the original once plus the edits, and come back after reload", async fn({ open, ready, fixtures }){
    const p = await open();
    await p.setInputFiles("#fileInput", join(fixtures, "sample.bin")); await p.waitForTimeout(300);
    await p.click('#hexRows .hb[data-i="0"]'); await p.keyboard.type("AABBCCDD"); await p.waitForTimeout(1200);
    const recs = await p.evaluate(() => new Promise(res => { const q = indexedDB.open("plainpad"); q.onsuccess = () => { const a = q.result.transaction("hex").objectStore("hex").getAll(); a.onsuccess = () => res(a.result.map(x => x.id.startsWith("base:") ? "base " + x.blob.size : "edits add=" + x.add.length)); }; }));
    assert.deepEqual(recs.sort(), ["base 1170", "edits add=8"]);
    await p.reload(); await ready(p); await p.waitForTimeout(300);
    const r = await p.evaluate(async () => { const t = window.__plainpad.hx.tab, d = await t.hex.buf.readAsync(0, 5); return [[...d].map(x => x.toString(16).padStart(2, "0")).join(""), t.hex.buf.pieces !== t.hex.clean, document.querySelectorAll("#hexRows .hb.m").length]; });
    assert.deepEqual(r, ["aabbccdd03", true, 4]);
  }},

  { name: "a second window runs unsaved and takes over after the first closes", async fn({ open, ready }){
    const p1 = await open();
    await p1.evaluate(() => { const A = window.__plainpad; A.A.newTab(); A.cmMain.setValue("primary"); A.persist(); });
    const p2 = await open({ context: p1.ctx });
    assert.equal(await p2.isVisible("#banner"), true);
    assert.deepEqual(await names(p2), ["新文件（不會保存）"]);
    await p2.evaluate(() => { window.__plainpad.cmMain.setValue("second"); window.__plainpad.persist(); });
    assert.ok(!(await p1.evaluate(() => localStorage.getItem("plainpad.session.v2"))).includes("不會保存"), "second window wrote nothing");
    await p1.close(); await p2.reload(); await ready(p2);
    assert.equal(await p2.isVisible("#banner"), false);
    assert.equal((await names(p2)).length, 3);
  }},

  { name: "closing the tab shown in the second view never leaves a hex tab there", async fn({ open }){
    const p = await open();
    const r = await p.evaluate(async () => { const A = window.__plainpad; A.addTab(A.makeHexTab({ name:"x.bin", blob:new Blob([new Uint8Array(64)]) }));
      A.A.newTab(); A.cmMain.setValue("abc"); A.run("toggleSplit"); const t = A.tabs()[A.tabs().length - 1];
      t.cleanGen = t.doc.changeGeneration(true); A.run("closeActive"); await new Promise(r => setTimeout(r, 200));
      return [A.tabs()[A.tabs().length - 1].kind, A.split.tab && (A.split.tab.kind || "text")]; });
    assert.deepEqual(r, ["hex", "text"]);
  }},
  { name: "a .tsx tab saved as TypeScript comes back as TypeScript (TSX)", async fn({ open, ready }){
    const p = await open();
    await p.evaluate(() => { const A = window.__plainpad; A.A.newTab(); const t = A.tabs()[A.tabs().length - 1]; t.name = "App.tsx"; t.langId = "ts"; A.cmMain.setValue("const a = <div>x</div>;"); A.persist(); });
    await p.reload(); await ready(p);
    const r = await p.evaluate(() => { const A = window.__plainpad; const t = A.tabs().find(x => x.name === "App.tsx"); return { lang: t.langId, mode: A.cmMain.getOption("mode"), tag: A.cmMain.getTokenTypeAt({ line:0, ch:12 }) }; });
    assert.equal(r.lang, "tsx"); assert.match(r.tag || "", /tag/, "the restored tab highlights JSX");
  }},
];
