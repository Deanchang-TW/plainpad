import assert from "node:assert/strict";
import { MOD, SPOOFED } from "./platform.mjs";
import { join } from "node:path";
import { crc32 } from "node:zlib";

const head = (p, n = 12) => p.evaluate(async n => { const s = window.__plainpad.hx.tab.hex; const d = await s.buf.readAsync(0, n); return { hex: [...d].map(x => x.toString(16).padStart(2, "0")).join(""), size: s.buf.size, cur: s.cur, anchor: s.anchor, dirty: s.buf.pieces !== s.clean }; }, n);
async function openSample(p, fixtures){ await p.setInputFiles("#fileInput", join(fixtures, "sample.bin")); await p.waitForTimeout(300); await p.click('#hexRows .hb[data-i="0"]'); }

/* Reads the single stored entry of a ZIP and checks its CRC. */
function unzipStored(buf){
  assert.equal(buf.readUInt32LE(0), 0x04034b50);
  const method = buf.readUInt16LE(8), crc = buf.readUInt32LE(14), size = buf.readUInt32LE(18), nameLen = buf.readUInt16LE(26), extra = buf.readUInt16LE(28);
  assert.equal(method, 0, "stored, not compressed");
  const data = buf.subarray(30 + nameLen + extra, 30 + nameLen + extra + size);
  assert.equal(crc32(data) >>> 0, crc, "CRC matches");
  return { name: buf.subarray(30, 30 + nameLen).toString("utf8"), data };
}

export default [
  { name: "binary files open in hex view", async fn({ open, fixtures }){
    const p = await open(); await openSample(p, fixtures);
    assert.deepEqual(await head(p), { hex:"4d5a90000300000000010203", size:1170, cur:0, anchor:0, dirty:false });
    assert.match(await p.textContent("#hexRows .hr"), /^000000004D5A9000.*MZ\.\./);
    assert.match(await p.textContent("#tabs .tab.is-active"), /HEX.*sample\.bin/);
  }},

  { name: "overwrite, insert, delete, undo and redo", async fn({ open, fixtures }){
    const p = await open(); await openSample(p, fixtures);
    await p.click('#hexRows .hb[data-i="2"]'); await p.keyboard.type("ff");
    assert.equal((await head(p)).hex, "4d5aff000300000000010203");
    await p.keyboard.press("Insert"); await p.keyboard.type("abcd");
    assert.deepEqual(await head(p), { hex:"4d5affabcd00030000000001", size:1172, cur:5, anchor:5, dirty:true });
    await p.keyboard.press("Backspace"); assert.equal((await head(p)).size, 1171);
    await p.keyboard.press(`${MOD}+z`); await p.keyboard.press(`${MOD}+z`);
    assert.deepEqual(await head(p), { hex:"4d5a90000300000000010203", size:1170, cur:2, anchor:2, dirty:false });
    await p.keyboard.press(`${MOD}+Shift+z`); assert.equal((await head(p)).hex, "4d5affabcd00030000000001");
    await p.keyboard.press("Insert"); await p.keyboard.press("Tab"); await p.keyboard.type("Hi");
    assert.equal((await head(p)).hex, "4d5affabcd48690000000001", "typing in the text column");
  }},

  { name: "inspector decodes integers, floats and time", async fn({ open, fixtures }){
    const p = await open(); await openSample(p, fixtures);
    const field = name => p.evaluate(n => { const dt = [...document.querySelectorAll("#hexInspBody dt")].find(d => d.textContent.startsWith(n)); return dt && dt.nextSibling.textContent; }, name);
    await p.keyboard.press("Shift+ArrowRight"); await p.keyboard.press("Shift+ArrowRight");
    assert.equal(await field("uint16"), "23117");
    assert.match(await p.textContent("#stSel"), /選取 2 位元組/);
    await p.keyboard.press("Control+g"); await p.fill("#modalInput", "1050"); await p.keyboard.press("Enter");
    assert.equal(await field("time_t（32 位元）"), "2023-11-14 22:13:20 UTC");
    await p.keyboard.press("Control+g"); await p.fill("#modalInput", "+4"); await p.keyboard.press("Enter");
    assert.equal(await field("double"), "3.14159");
    await p.selectOption("#hxEnc", "utf-8");
    await p.keyboard.press("Control+g"); await p.fill("#modalInput", "0x408"); await p.keyboard.press("Enter");
    assert.equal(await p.evaluate(() => [...document.querySelectorAll("#hexRows .ht.w")].map(x => x.textContent).join("")), "中文測試");
  }},

  { name: "search with wildcards and case-insensitive text", async fn({ open, fixtures }){
    const p = await open(); await openSample(p, fixtures);
    await p.fill("#hxFind", "54 41 ?? 4C 4D"); await p.keyboard.press("Enter"); await p.waitForTimeout(200);
    assert.equal(await p.textContent("#hxInfo"), "找到：0x48A");
    await p.click('#hxFindMode button[data-m="text"]'); await p.fill("#hxFind", "tailmark"); await p.keyboard.press("Enter"); await p.waitForTimeout(200);
    assert.match(await p.textContent("#hxInfo"), /找到：0x48A（已從頭開始）/);
  }},

  { name: "clipboard: paste hex, copy as hex and C array, cut", async fn({ open, fixtures }){
    const p = await open({ clipboard: true }); await openSample(p, fixtures);
    if (SPOOFED) await p.evaluate(t => { const dt = new DataTransfer(); dt.setData("text/plain", t);   // no native paste when spoofing the platform
      document.querySelector("#hexInput").dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true })); }, "0xDE, 0xAD, 0xBE, 0xEF");
    else { await p.evaluate(() => navigator.clipboard.writeText("0xDE, 0xAD, 0xBE, 0xEF")); await p.keyboard.press(`${MOD}+v`); }
    assert.equal((await head(p, 6)).hex, "deadbeef0300");
    await p.keyboard.press(`${MOD}+Home`); for (let i = 0; i < 4; i++) await p.keyboard.press("Shift+ArrowRight");
    if (!SPOOFED){ await p.keyboard.press(`${MOD}+c`); await p.waitForTimeout(100); assert.equal(await p.evaluate(() => navigator.clipboard.readText()), "DE AD BE EF"); }
    await p.evaluate(() => window.__plainpad.run("hexCopyC")); await p.waitForTimeout(150);
    assert.equal(await p.evaluate(() => navigator.clipboard.readText()), "unsigned char data[4] = {\n    0xDE, 0xAD, 0xBE, 0xEF\n};");
    await p.click('#hexRows .hb[data-i="0"]'); await p.keyboard.press("Shift+ArrowRight"); await p.keyboard.press(`${MOD}+x`); await p.waitForTimeout(100);
    assert.deepEqual(await head(p, 4), { hex:"adbeef03", size:1169, cur:0, anchor:0, dirty:true });
  }},

  { name: "drag selects a range and text-only actions are refused", async fn({ open, fixtures }){
    const p = await open(); await openSample(p, fixtures);
    const a = await p.locator('#hexRows .hb[data-i="3"]').boundingBox(), c = await p.locator('#hexRows .hb[data-i="9"]').boundingBox();
    await p.mouse.move(a.x + 8, a.y + 8); await p.mouse.down(); await p.mouse.move(c.x + 8, c.y + 8, { steps:5 }); await p.mouse.up();
    assert.equal(await p.locator("#hexRows .hb.s").count(), 7);
    await p.evaluate(() => window.__plainpad.run("sortAsc"));
    assert.match(await p.textContent("#toast"), /Hex 檢視不支援這個功能/);
  }},

  { name: "saving a .bin offers a ZIP whose content is the edited file", async fn({ open, fixtures, saves }){
    const p = await open(); await openSample(p, fixtures);
    await p.keyboard.type("00"); await p.keyboard.press(`${MOD}+s`);
    assert.match(await p.textContent("#modalTitle"), /無法用原本的副檔名下載/);
    await p.click("#modalActions .btn-primary"); await p.waitForTimeout(300);
    const [s] = await saves(p); assert.equal(s.filename, "sample.bin.zip");
    const z = unzipStored(s.bytes); assert.equal(z.name, "sample.bin"); assert.equal(z.data.length, 1170); assert.equal(z.data[0], 0);
    assert.equal(await p.evaluate(() => document.querySelector("#tabs .tab.is-active").classList.contains("is-dirty")), false);
  }},

  { name: "text and hex views convert both ways", async fn({ open }){
    const p = await open();
    await p.evaluate(() => { const A = window.__plainpad; A.A.newTab(); A.cmMain.setValue("AB\nC"); A.run("toggleHex"); });
    await p.waitForTimeout(200);
    assert.equal((await head(p, 4)).hex, "41420a43");
    await p.evaluate(() => window.__plainpad.run("toggleHex")); await p.waitForTimeout(200);
    assert.deepEqual(await p.evaluate(() => [window.__plainpad.cmMain.getValue(), document.querySelector("#hexWrap").hidden]), ["AB\nC", true]);
  }},

  { name: "a 512 MB file scrolls, edits and searches without loading it whole", async fn({ open }){
    const p = await open();
    await p.evaluate(() => { const A = window.__plainpad, chunk = new Uint8Array(1 << 20); for (let i = 0; i < chunk.length; i++) chunk[i] = i & 255;
      const parts = []; for (let i = 0; i < 512; i++) parts.push(chunk); parts.push(new TextEncoder().encode("NEEDLE!"));
      A.addTab(A.makeHexTab({ name:"big.dat", blob:new Blob(parts) })); });
    await p.waitForTimeout(300);
    assert.equal(await p.evaluate(() => window.__plainpad.hx.scaled), true);
    await p.click('#hexRows .hb[data-i="0"]'); await p.keyboard.press(`${MOD}+End`); await p.waitForTimeout(300);
    assert.match(await p.textContent("#stPos"), /0x20000007/);
    await p.keyboard.press(`${MOD}+Home`); await p.keyboard.type("EE");
    await p.click('#hxFindMode button[data-m="text"]'); await p.fill("#hxFind", "NEEDLE!"); await p.keyboard.press("Enter");
    await p.waitForFunction(() => /找到|找不到/.test(document.querySelector("#hxInfo").textContent), null, { timeout: 60000 });
    assert.equal(await p.textContent("#hxInfo"), "找到：0x20000000");
    await p.mouse.move(500, 400); await p.mouse.wheel(0, -2200); await p.waitForTimeout(200);
    assert.ok(await p.evaluate(() => window.__plainpad.hx.tab.hex.top) > 1000, "wheel moves by rows in a scaled view");
  }}
];
