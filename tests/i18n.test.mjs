import assert from "node:assert/strict";

/* Interface languages (src/js/00-i18n.js, src/i18n/). The build already fails when a translation is missing; these
   check that the page picks the language and that nothing on screen is left in Chinese. */
const CJK = /[㐀-鿿＀-￯　-〿]/;
const NATIVE_NAMES = /繁體中文|简体中文/g;   // the language list names each language in itself

async function menuTexts(p){
  const out = {};
  const n = await p.locator("#menubar .menu-btn").count();
  for (let i = 0; i < n; i++){
    const btn = p.locator("#menubar .menu-btn").nth(i);
    await btn.click();
    out[await btn.textContent()] = await p.evaluate(() => document.querySelector(".menu-pop").innerText);
    await p.keyboard.press("Escape");
  }
  return out;
}

export default [
  { name: "an English browser gets the whole interface in English", async fn({ open }){
    const p = await open({ locale: "en-US" });
    assert.equal(await p.evaluate(() => document.documentElement.lang), "en");
    assert.deepEqual(await p.evaluate(() => window.__plainpad.tabs().map(t => t.name)), ["Plainpad Help.md", "monthly-orders.sql"]);
    assert.match(await p.evaluate(() => window.__plainpad.tabs()[0].doc.getValue()), /^# Plainpad Help\n/);
    assert.match(await p.evaluate(() => window.__plainpad.tabs()[1].doc.getValue()), /^-- Sample: monthly order summary/);

    const menus = await menuTexts(p);
    assert.deepEqual(Object.keys(menus).slice(0, 4), ["File", "Edit", "Search", "View"]);
    for (const [name, text] of Object.entries(menus)) assert.ok(!CJK.test(text.replace(NATIVE_NAMES, "")), `the ${name} menu has untranslated text: ${text.match(/.*[㐀-鿿].*/)?.[0]}`);

    /* Everything the page draws itself: toolbar tooltips, find panel, status bar, hidden panels included. */
    await p.evaluate(() => window.__plainpad.run("find"));
    const leftovers = await p.evaluate(re => {
      const cjk = new RegExp(re), bad = [];
      const skip = el => el.closest(".CodeMirror, #mdBody, #resBody, .menu-pop");
      for (const el of document.body.querySelectorAll("*")){
        if (skip(el) || /^(SCRIPT|STYLE)$/.test(el.nodeName)) continue;
        for (const a of ["title", "aria-label", "placeholder"]) if (cjk.test(el.getAttribute(a) || "")) bad.push(a + ": " + el.getAttribute(a));
        for (const n of el.childNodes) if (n.nodeType === 3 && cjk.test(n.nodeValue)) bad.push(n.nodeValue.trim());
      }
      return bad.filter(s => !/繁體中文|简体中文/.test(s));
    }, CJK.source);
    assert.deepEqual(leftovers, []);
    assert.equal(await p.textContent("#stPos"), "Ln 1, Col 1");

    /* Plural forms: one line, then two. */
    await p.evaluate(() => { const A = window.__plainpad; A.A.newTab(); A.cmMain.setValue("abc\ndef\n"); A.cmMain.setSelection({ line: 0, ch: 0 }, { line: 0, ch: 3 }); });
    await p.waitForFunction(() => /line/.test(document.querySelector("#stSel").textContent));
    assert.equal(await p.textContent("#stSel"), "Sel 3 | 1 line");
    await p.evaluate(() => window.__plainpad.cmMain.setSelection({ line: 0, ch: 0 }, { line: 1, ch: 3 }));
    await p.waitForFunction(() => /lines/.test(document.querySelector("#stSel").textContent));
    assert.equal(await p.textContent("#stSel"), "Sel 7 | 2 lines");
    assert.deepEqual(p.errors, []);
  }},

  { name: "Vietnamese and Simplified Chinese browsers get their language", async fn({ open }){
    for (const [locale, file, lang] of [["vi-VN", "Tệp", "vi"], ["zh-CN", "文件", "zh-Hans"], ["zh-HK", "檔案", "zh-Hant"], ["ja-JP", "File", "en"]]){
      const p = await open({ locale });
      assert.equal(await p.locator("#menubar .menu-btn").first().textContent(), file, locale);
      assert.equal(await p.evaluate(() => document.documentElement.lang), lang, locale);
      assert.deepEqual(p.errors, []);
      await p.ctx.close();
    }
  }},

  { name: "the language chosen in Settings sticks across reloads and keeps the tabs", async fn({ open }){
    const p = await open({ locale: "zh-TW" });   // a browser language other than the one picked below
    await p.evaluate(() => { const A = window.__plainpad; A.A.newTab(); A.cmMain.setValue("keep me"); });
    const openSettings = async label => { await p.locator("#menubar .menu-btn", { hasText: label }).click(); };
    await openSettings("設定");
    await Promise.all([p.waitForEvent("load"), p.locator(".menu-pop .menu-item", { hasText: "English" }).click()]);
    await p.waitForFunction(() => window.__plainpad);
    assert.equal(await p.locator("#menubar .menu-btn").first().textContent(), "File");
    assert.ok(await p.evaluate(() => window.__plainpad.tabs().some(t => t.doc.getValue() === "keep me")), "the tabs are still there");

    await p.reload(); await p.waitForFunction(() => window.__plainpad);
    assert.equal(await p.locator("#menubar .menu-btn").first().textContent(), "File", "the choice is remembered");

    await openSettings("Settings");
    assert.match(await p.locator(".menu-pop .menu-item").first().textContent(), /Match system \(繁體中文\)/);
    await Promise.all([p.waitForEvent("load"), p.locator(".menu-pop .menu-item").first().click()]);
    await p.waitForFunction(() => window.__plainpad);
    assert.equal(await p.locator("#menubar .menu-btn").first().textContent(), "檔案", "back to following the browser");
    assert.deepEqual(p.errors, []);
  }}
];
