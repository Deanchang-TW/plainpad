// Browser test runner: serves dist/, runs every tests/*.test.mjs in Chromium, prints one line per test.
// Usage: node tests/run.mjs [filter]      (run `node build.mjs` first, or use `npm test`)
// Set CHROMIUM_PATH to use a specific Chromium build.
import { createServer } from "node:http";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { chromium } from "playwright";
import { PLATFORM, applyPlatform } from "./platform.mjs";

const root = new URL("../", import.meta.url).pathname;
const dist = join(root, "dist");
const TYPES = { ".html":"text/html; charset=utf-8", ".js":"text/javascript", ".bin":"application/octet-stream" };

const server = createServer((req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^(\.\.[/\\])+/, "");
  const file = join(dist, path);
  if (!file.startsWith(dist) || !existsSync(file) || !statSync(file).isFile()){ res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": TYPES[extname(file)] || "application/octet-stream" }); res.end(readFileSync(file));
});
await new Promise(r => server.listen(0, "localhost", r));
const base = `http://localhost:${server.address().port}`;

const executablePath = process.env.CHROMIUM_PATH || (existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined);
const browser = await chromium.launch({ executablePath });

/* Fake download capability: records every saved file so tests can compare the exact bytes. */
function fakeDownloads(){
  window.claude = { use: async name => name !== "downloads" ? null : { save: async ({ filename, data }) => {
    const u8 = data instanceof Blob ? new Uint8Array(await data.arrayBuffer()) : typeof data === "string" ? new TextEncoder().encode(data) : new Uint8Array(data.buffer || data);
    let s = ""; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    (window.__saves = window.__saves || []).push({ filename, b64: btoa(s) }); return { status: "saved" }; } } };
}

const ctxHelpers = {
  base, browser, dist, fixtures: join(root, "tests/fixtures"),
  /* A fresh browser profile (empty storage) with fonts blocked; returns a page with Plainpad loaded. */
  /* locale: the browser language. Tests check the Traditional Chinese text by default; the interface follows the browser
     language unless one is chosen in the settings, so pass another locale to see the page in that language. */
  async open({ path = "/test/index.html", init, downloads = true, clipboard = false, viewport = { width:1360, height:860 }, context, locale = "zh-TW" } = {}){
    const ctx = context || await browser.newContext({ viewport, locale, permissions: clipboard ? ["clipboard-read", "clipboard-write"] : [] });
    if (!context){
      await applyPlatform(ctx);
      await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
      if (downloads) await ctx.addInitScript(fakeDownloads);
      if (init) await ctx.addInitScript(init);
    }
    const page = await ctx.newPage();
    page.errors = []; page.on("pageerror", e => page.errors.push(e.message));
    await page.goto(base + path);
    if (path.endsWith("/index.html")) await page.waitForFunction(() => window.__plainpad);
    else await page.waitForSelector("#tabs .tab");
    page.ctx = ctx;
    return page;
  },
  ready: page => page.waitForFunction(() => window.__plainpad),
  saves: async page => (await page.evaluate(() => window.__saves || [])).map(s => ({ filename: s.filename, bytes: Buffer.from(s.b64, "base64") })),
  toast: page => page.evaluate(() => document.querySelector("#toast").textContent)
};

const filter = process.argv[2];
const files = readdirSync(join(root, "tests")).filter(f => f.endsWith(".test.mjs")).sort();
let passed = 0, failed = 0;
console.log(`Keyboard: ${PLATFORM === "mac" ? "macOS (⌘)" : "Ctrl"}`);
for (const f of files){
  const suite = (await import(join(root, "tests", f))).default;
  for (const t of suite){
    const name = `${f.replace(".test.mjs", "")} › ${t.name}`;
    if (filter && !name.includes(filter)) continue;
    const t0 = Date.now(); const contexts = browser.contexts().length;
    try {
      await t.fn(ctxHelpers);
      passed++; console.log(`  ✓ ${name} (${Date.now() - t0} ms)`);
    } catch(e){
      failed++; console.log(`  ✗ ${name}\n      ${String(e && e.stack || e).split("\n").slice(0, 30).join("\n      ")}`);
    }
    for (const c of browser.contexts().slice(contexts)) await c.close().catch(() => {});
  }
}
console.log(`\n${passed} passed, ${failed} failed`);
await browser.close(); server.close();
process.exit(failed ? 1 : 0);
