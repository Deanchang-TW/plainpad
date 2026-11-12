import assert from "node:assert/strict";

/* The macOS app (macos/) registers window.webkit.messageHandlers.plainpad before the page loads and talks to the page
   through the messages described in macos/Sources/WebShell.swift. These tests stand in for the app and check both
   directions of that contract. */
function fakeBridge(){
  window.__bridge = [];
  window.webkit = { messageHandlers: { plainpad: { postMessage: async msg => {
    window.__bridge.push(msg);
    if (msg.type === "save") return { status: "saved", path: msg.path || "/Users/me/Documents/" + msg.filename, filename: msg.filename };
    return null;
  } } } };
}
const decode = b64 => Buffer.from(b64, "base64").toString("utf8");

export default [
  { name: "inside the macOS app, files open from the bridge and save back to their path without a prompt", async fn({ open }){
    const p = await open({ init: fakeBridge, downloads: false });
    assert.deepEqual(await p.evaluate(() => window.__bridge.map(m => m.type).filter(t => t !== "title" && t !== "watch")), ["ready"], "the page tells the app when it has booted");

    await p.ctx.route("**/__file/*", r => r.fulfill({ body: "hello\n", contentType: "application/octet-stream" }));
    await p.evaluate(() => window.__ppNative.open([{ token: "t1", name: "note.txt", path: "/Users/me/note.txt" }]));
    await p.waitForFunction(() => window.__plainpad.tabs().some(t => t.path === "/Users/me/note.txt"));
    assert.equal(await p.evaluate(() => window.__plainpad.cmMain.getValue()), "hello\n");
    const titles = () => p.evaluate(() => window.__bridge.filter(m => m.type === "title").map(m => [m.name, m.path, m.dirty].join("|")));
    assert.equal((await titles()).pop(), "note.txt|/Users/me/note.txt|false", "the window title follows the active tab");
    /* Opening the same file again (Finder, Dock) switches to its tab instead of adding one, even after a restart has
       dropped the original bytes. */
    await p.evaluate(() => { window.__plainpad.tabs().find(t => t.path === "/Users/me/note.txt").bytes = null; });
    await p.evaluate(() => window.__ppNative.open([{ token: "t2", name: "note.txt", path: "/Users/me/note.txt" }]));
    await p.waitForFunction(() => window.__bridge.length >= 1);
    await p.waitForTimeout(200);
    assert.equal(await p.evaluate(() => window.__plainpad.tabs().filter(t => t.path === "/Users/me/note.txt").length), 1);

    await p.evaluate(() => window.__plainpad.cmMain.setCursor({ line: 1, ch: 0 })); await p.keyboard.insertText("world\n");
    await p.waitForFunction(() => window.__bridge.some(m => m.type === "title" && m.dirty));
    await p.evaluate(() => window.__plainpad.run("save"));
    await p.waitForFunction(() => window.__bridge.some(m => m.type === "save"));
    let saves = (await p.evaluate(() => window.__bridge)).filter(m => m.type === "save");
    assert.equal(saves.length, 1);
    assert.equal(saves[0].path, "/Users/me/note.txt", "a tab from disk writes straight back to its file");
    assert.equal(saves[0].filename, "note.txt");
    assert.equal(decode(saves[0].data), "hello\nworld\n");
    assert.equal(await p.evaluate(() => document.querySelector("#modal:not([hidden])")), null, "no in-page name prompt");
    assert.equal((await titles()).pop(), "note.txt|/Users/me/note.txt|false", "the title drops the edited mark after saving");
    assert.equal(await p.evaluate(() => { const t = window.__plainpad.tabs().find(t => t.path === "/Users/me/note.txt"); return t.forceDirty || !t.doc.isClean(t.cleanGen); }), false, "saved tab is clean");

    /* 另存新檔 leaves the path out so the app shows its save panel, and the tab then follows the chosen file. */
    await p.evaluate(() => window.__plainpad.run("saveAs"));
    await p.waitForFunction(() => window.__bridge.filter(m => m.type === "save").length === 2);
    saves = (await p.evaluate(() => window.__bridge)).filter(m => m.type === "save");
    assert.equal(saves[1].path, null);
    assert.equal(await p.evaluate(() => window.__plainpad.tabs()[window.__plainpad.tabs().length - 1].path), "/Users/me/Documents/note.txt");

    /* A new document has no path either; the suggested name gets .txt so the panel has an extension to show. */
    await p.evaluate(() => window.__plainpad.run("newTab"));
    await p.keyboard.insertText("new");
    await p.evaluate(() => window.__plainpad.run("save"));
    await p.waitForFunction(() => window.__bridge.filter(m => m.type === "save").length === 3);
    saves = (await p.evaluate(() => window.__bridge)).filter(m => m.type === "save");
    assert.equal(saves[2].path, null);
    assert.match(saves[2].filename, /^新文件 \d+\.txt$/);

    /* 開啟 asks the app for its panel instead of using the hidden <input type="file">. */
    await p.evaluate(() => window.__plainpad.run("openFile"));
    assert.equal(await p.evaluate(() => window.__bridge.filter(m => m.type === "openPanel").length), 1);
    assert.equal(await p.evaluate(() => window.__ppNative.flush()), true);
    assert.deepEqual(p.errors, []);
  }},

  { name: "inside the macOS app, a file changed on disk reloads a clean tab and asks for a tab with edits", async fn({ open }){
    const p = await open({ init: fakeBridge, downloads: false });
    const disk = { t1: "one\ntwo\nthree\n", t2: "one\nTWO\nthree\n", t3: "one\nTWO\nthree\nfour\n", t4: "one\nTWO\nthree\nfour\nfive\n" };
    await p.ctx.route("**/__file/*", r => r.fulfill({ body: disk[decodeURIComponent(r.request().url().split("/").pop())], contentType: "application/octet-stream" }));
    const tab = () => p.evaluate(() => { const t = window.__plainpad.tabs().find(t => t.path === "/w/a.txt"); return t && { text: t.doc.getValue(), dirty: t.forceDirty || !t.doc.isClean(t.cleanGen), mtime: t.mtime }; });
    const lastWatch = () => p.evaluate(() => window.__bridge.filter(m => m.type === "watch").pop().files);
    const changed = (item) => p.evaluate(it => window.__ppNative.changed([it]), item);

    await p.evaluate(() => window.__ppNative.open([{ token: "t1", name: "a.txt", path: "/w/a.txt", mtime: 1000 }]));
    await p.waitForFunction(() => window.__plainpad.tabs().some(t => t.path === "/w/a.txt"));
    await p.waitForFunction(() => window.__bridge.some(m => m.type === "watch" && m.files.some(f => f.mtime === 1000)));
    assert.deepEqual(await lastWatch(), [{ path: "/w/a.txt", mtime: 1000 }], "the app is told which file to watch and what the page has seen");

    /* Clean tab: reloads in place. The cursor on the last line stays there, and one undo brings back the old text. */
    await p.evaluate(() => window.__plainpad.cmMain.setCursor({ line: 2, ch: 3 }));
    await changed({ path: "/w/a.txt", token: "t2", name: "a.txt", mtime: 2000 });
    await p.waitForFunction(() => window.__plainpad.cmMain.getValue().includes("TWO"));
    assert.deepEqual(await tab(), { text: disk.t2, dirty: false, mtime: 2000 });
    assert.equal((await p.evaluate(() => window.__plainpad.cmMain.getCursor())).line, 2);
    assert.match(await p.textContent("#toast"), /a\.txt.*已重新載入/);
    assert.deepEqual(await lastWatch(), [{ path: "/w/a.txt", mtime: 2000 }]);

    /* Tab with edits: asks. Keeping leaves the edits alone; reloading takes the disk version, and undo gets the edits back. */
    await p.evaluate(() => { const cm = window.__plainpad.cmMain; cm.replaceRange("mine\n", { line: 0, ch: 0 }); });
    await changed({ path: "/w/a.txt", token: "t3", name: "a.txt", mtime: 3000 });
    await p.waitForSelector("#modal:not([hidden])");
    assert.match(await p.textContent("#modalTitle"), /a\.txt.*已在其他程式中修改/);
    await p.click('#modalActions button:has-text("保留目前內容")');
    assert.deepEqual(await tab(), { text: "mine\n" + disk.t2, dirty: true, mtime: 3000 });

    await changed({ path: "/w/a.txt", token: "t4", name: "a.txt", mtime: 4000 });
    await p.waitForSelector("#modal:not([hidden])");
    await p.click('#modalActions button:has-text("重新載入")');
    await p.waitForFunction(() => window.__plainpad.cmMain.getValue().includes("five"));
    assert.deepEqual(await tab(), { text: disk.t4, dirty: false, mtime: 4000 });
    await p.evaluate(() => window.__plainpad.cmMain.undo());
    assert.equal((await tab()).text, "mine\n" + disk.t2);
    await p.evaluate(() => window.__plainpad.cmMain.redo());

    /* The modification time is kept with the session, so the app can spot changes made while it was closed. */
    await p.evaluate(() => window.__plainpad.persist());
    await p.reload(); await p.waitForFunction(() => window.__plainpad);
    await p.waitForFunction(() => window.__bridge.some(m => m.type === "watch" && m.files.length));
    assert.deepEqual(await lastWatch(), [{ path: "/w/a.txt", mtime: 4000 }]);

    /* Deleted: the tab stays, marked unsaved. */
    await changed({ path: "/w/a.txt", deleted: true });
    await p.waitForFunction(() => /刪除或移走/.test(document.querySelector("#toast").textContent));
    assert.equal((await tab()).dirty, true);
    assert.deepEqual(p.errors, []);
  }}
];
