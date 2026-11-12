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
    assert.deepEqual(await p.evaluate(() => window.__bridge.map(m => m.type).filter(t => t !== "title")), ["ready"], "the page tells the app when it has booted");

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
  }}
];
