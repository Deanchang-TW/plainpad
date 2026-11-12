/* ---------- tab strip ---------- */
let dragIdx = null, dirtySig = "";
function renderTabs(){
  const wrap = $("#tabs"); wrap.replaceChildren();
  tabs.forEach((t, i) => {
    const tabEl = el("div", { class:"tab" + (i === active ? " is-active" : "") + (isDirty(t) ? " is-dirty" : "") + (isHex(t) ? " is-hex" : ""), role:"tab", "aria-selected": String(i === active), title: (t.path || t.name) + (isDirty(t) ? tr("（未儲存）") : "") + "\n" + tr("雙擊重新命名，按右鍵看更多選項") });
    tabEl.tabIndex = i === active ? 0 : -1; tabEl.draggable = true;
    const x = el("button", { class:"x", type:"button", text:"×", "aria-label":tr("關閉 {name}", { name:t.name }) }); x.tabIndex = -1;
    x.addEventListener("click", e => { e.stopPropagation(); closeTab(tabs.indexOf(t)); });
    tabEl.append(el("span", { class:"dot" })); if (isHex(t)) tabEl.append(el("span", { class:"hexbadge", text:"HEX" }));
    tabEl.append(el("span", { class:"name", text:t.name }), x);
    tabEl.addEventListener("mousedown", e => { if (e.button === 1){ e.preventDefault(); closeTab(tabs.indexOf(t)); } });
    tabEl.addEventListener("click", () => activateTab(tabs.indexOf(t)));
    tabEl.addEventListener("dblclick", () => renameTab(t));
    tabEl.addEventListener("contextmenu", e => { e.preventDefault(); openTabMenu(t, e.clientX, e.clientY); });
    tabEl.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " "){ e.preventDefault(); activateTab(tabs.indexOf(t)); } });
    tabEl.addEventListener("dragstart", e => { dragIdx = tabs.indexOf(t); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/x-plainpad-tab", String(dragIdx)); });
    tabEl.addEventListener("dragover", e => { if (dragIdx === null) return; e.preventDefault(); tabEl.classList.add("drop-before"); });
    tabEl.addEventListener("dragleave", () => tabEl.classList.remove("drop-before"));
    tabEl.addEventListener("drop", e => { if (dragIdx === null) return; e.preventDefault(); e.stopPropagation(); moveTab(dragIdx, tabs.indexOf(t)); dragIdx = null; });
    tabEl.addEventListener("dragend", () => { dragIdx = null; renderTabs(); });
    wrap.appendChild(tabEl);
  });
  const plus = el("button", { class:"newtab", type:"button", text:"+", title:tr("新增分頁 ({key})", { key:keyLabel("Alt-N") }), "aria-label":tr("新增分頁") });
  plus.addEventListener("click", newTab); wrap.appendChild(plus);
  dirtySig = tabs.map(t => isDirty(t) ? 1 : 0).join("");
  renderPaneHeads();
  if (NATIVE){ nativeTitle(); nativeWatch(); }
}
function moveTab(from, to){ if (from === to || from < 0) return; const activeTab = cur(); const [t] = tabs.splice(from, 1); tabs.splice(to, 0, t); active = tabs.indexOf(activeTab); renderTabs(); persistSoon(); }
async function renameTab(t = curT()){
  const v = await promptText({ title:tr("重新命名"), text:tr("副檔名決定語法高亮與下載時的檔案類型。"), value:t.name, ok:tr("重新命名") });
  if (v == null) return; const name = v.trim(); if (!name) return;
  const oldExt = extOf(t.name); t.name = name; t.untitled = false;
  if (!isHex(t) && extOf(name) !== oldExt){ const l = langForName(name); if (l !== "text" || !oldExt) setLang(t, l); }
  renderTabs(); syncLangSelect(); persistSoon(); mdSoon(0);
}

