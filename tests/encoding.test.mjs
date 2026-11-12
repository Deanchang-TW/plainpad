import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const CASES = [
  ["tw-big5", "big5", "Big5"], ["cn-gbk", "gb18030", "GB18030"], ["jp-sjis", "shift_jis", "Shift_JIS"], ["kr-euckr", "euc-kr", "EUC-KR"],
  ["fr-1252", "windows-1252", "Windows-1252"], ["u16", "utf-16le", "UTF-16 LE BOM"], ["mixed", "utf-8", "UTF-8"]
];

async function openFile(p, path){
  await p.setInputFiles("#fileInput", path); await p.waitForTimeout(150);
  return p.evaluate(() => { const A = window.__plainpad, t = A.tabs()[A.tabs().length - 1]; return { enc: t.encoding, eol: t.eol, status: document.querySelector("#stEnc").textContent, toast: document.querySelector("#toast").textContent }; });
}
async function save(p){
  await p.keyboard.press("Control+s"); await p.waitForTimeout(200);
  if (await p.isVisible("#modal")) await p.click("#modalActions .btn-primary");
  await p.waitForTimeout(200);
}

export default [
  { name: "detects each encoding and saves it back byte for byte", async fn({ open, fixtures, saves }){
    const p = await open();
    for (const [file, enc, label] of CASES){
      const r = await openFile(p, join(fixtures, "enc", file + ".txt"));
      assert.equal(r.enc, enc, `${file} detected`); assert.equal(r.status, label);
      if (file === "mixed") assert.match(r.toast, /混用了多種行尾（CRLF 3 行、LF 1 行）/);
      await p.evaluate(() => { const c = window.__plainpad.cmMain; c.replaceRange("OK", { line: c.lastLine(), ch: 0 }); });
      await save(p);
    }
    const out = await saves(p);
    assert.equal(out.length, CASES.length);
    for (const [i, [file]] of CASES.entries()) assert.deepEqual(out[i].bytes, readFileSync(join(fixtures, "enc", file + ".expected")), `${file} round trip`);
  }},

  { name: "characters the encoding cannot hold are caught before saving", async fn({ open, fixtures, saves }){
    const p = await open();
    await openFile(p, join(fixtures, "enc", "tw-big5.txt"));
    await p.evaluate(() => window.__plainpad.cmMain.replaceRange("笑😀", { line:0, ch:0 }));
    await p.keyboard.press("Control+s"); await p.waitForTimeout(200);
    assert.match(await p.textContent("#modalTitle"), /有 1 個字元無法用 Big5 儲存/);
    await p.click("#modalActions .btn-primary"); await p.waitForTimeout(200);
    const [s] = await saves(p);
    assert.ok(s.bytes.toString("utf8").startsWith("笑😀這是繁體"));
    assert.equal(await p.textContent("#stEnc"), "UTF-8");
  }},

  { name: "convert to Big5 drives the hash and the hex view", async fn({ open }){
    const p = await open();
    await p.evaluate(() => { const A = window.__plainpad; A.A.newTab(); A.cmMain.setValue("轉換測試"); A.A.convertTo("big5"); });
    assert.equal(await p.textContent("#stEnc"), "Big5");
    await p.evaluate(() => window.__plainpad.run("hashes")); await p.waitForTimeout(300);
    assert.match(await p.textContent("#modalText"), /^以 Big5 計算/);
    await p.keyboard.press("Escape");
    await p.evaluate(() => window.__plainpad.run("toggleHex")); await p.waitForTimeout(200);
    const hex = await p.evaluate(async () => { const s = window.__plainpad.hx.tab.hex, d = await s.buf.readAsync(0, s.buf.size); return [...d].map(x => x.toString(16).padStart(2, "0")).join(""); });
    assert.equal(hex, "c2e0b4abb4fab8d5");
  }}
];
