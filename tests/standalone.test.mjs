import assert from "node:assert/strict";
import { join } from "node:path";
import { readFileSync } from "node:fs";

/* The standalone file must work from disk with no network at all. */
async function openStandalone(browser, dist){
  const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1360, height: 860 } });
  const blocked = [];
  await ctx.route(/^https?:/, r => { blocked.push(r.request().url()); r.abort(); });
  const p = await ctx.newPage(); p.errors = []; p.on("pageerror", e => p.errors.push(e.message));
  await p.goto("file://" + join(dist, "plainpad-standalone.html"));
  await p.waitForSelector("#tabs .tab");
  return { p, blocked };
}

export default [
  { name: "runs from disk offline, with Markdown, math and Mermaid", async fn({ browser, dist }){
    const { p, blocked } = await openStandalone(browser, dist);
    assert.equal(await p.evaluate(() => "__plainpad" in window), false);
    await p.keyboard.press("Alt+KeyN");
    await p.keyboard.insertText("# 標題\n\n$a^2$\n\n```mermaid\ngraph TD\nA-->B\n```\n\n<img src=x onerror=\"window.__xss=1\">");
    await p.keyboard.press("Control+Shift+KeyM");
    await p.waitForFunction(() => document.querySelector("#mdBody .md-mermaid svg") && document.querySelector("#mdBody math"), null, { timeout: 20000 });
    assert.equal(await p.evaluate(() => [document.querySelector("#mdBody h1").textContent, /onerror/.test(document.querySelector("#mdBody").innerHTML), window.__xss || 0].join("|")), "標題|false|0");
    assert.ok(blocked.every(u => /fonts\.(googleapis|gstatic)\.com/.test(u)), "only web fonts were requested: " + blocked.join(", "));
    assert.deepEqual(p.errors, []);
  }},

  { name: "saves any file name directly as an ordinary download", async fn({ browser, dist, fixtures }){
    const { p } = await openStandalone(browser, dist);
    await p.setInputFiles("#fileInput", join(fixtures, "sample.bin")); await p.waitForTimeout(300);
    await p.click('#hexRows .hb[data-i="0"]'); await p.keyboard.type("00");
    const [dl] = await Promise.all([p.waitForEvent("download"), p.keyboard.press("Control+s")]);
    assert.equal(dl.suggestedFilename(), "sample.bin");
    const bytes = readFileSync(await dl.path()), orig = readFileSync(join(fixtures, "sample.bin"));
    assert.equal(bytes.length, orig.length); assert.equal(bytes[0], 0); assert.deepEqual(bytes.subarray(1), orig.subarray(1));
    await p.setInputFiles("#fileInput", join(fixtures, "enc", "tw-big5.txt")); await p.waitForTimeout(200);
    const [dl2] = await Promise.all([p.waitForEvent("download"), p.keyboard.press("Control+Shift+KeyS").then(async () => { await p.fill("#modalInput", "report.sql"); await p.keyboard.press("Enter"); })]);
    assert.equal(dl2.suggestedFilename(), "report.sql");
    assert.deepEqual(readFileSync(await dl2.path()), readFileSync(join(fixtures, "enc", "tw-big5.txt")), "Big5 bytes unchanged");
  }}
];
