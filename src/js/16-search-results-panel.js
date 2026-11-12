/* ---------- search results panel ---------- */
function hitsFromText(text, re, cap){
  const all = allMatches(text, re, cap); if (!all.length) return [];
  const starts = [0]; for (let i = text.indexOf("\n"); i >= 0; i = text.indexOf("\n", i + 1)) starts.push(i + 1);
  const rows = new Map(); let li = 0;
  for (const [idx, len] of all){
    while (li + 1 < starts.length && starts[li + 1] <= idx) li++;
    const ls = starts[li], le = li + 1 < starts.length ? starts[li + 1] - 1 : text.length;
    let row = rows.get(li); if (!row){ row = { line: li, text: text.slice(ls, le), spans: [] }; rows.set(li, row); }
    row.spans.push([idx - ls, Math.min(len, le - idx)]);
  }
  return [...rows.values()];
}
let lastResults = null;
function listHits(allTabs){
  const re = buildRe(); if (!re){ $("#findInput").focus(); return; }
  const groups = []; let total = 0;
  for (const t of (allTabs ? tabs : [curT()])){
    const rows = hitsFromText(t.doc.getValue(), re, 20000);
    if (rows.length){ const n = rows.reduce((s, r) => s + r.spans.length, 0); total += n; groups.push({ label: t.path || t.name, count: n, target: { kind:"tab", tab:t }, rows }); }
  }
  showResults(tr("搜尋「{text}」：{n} 筆", { text:$("#findInput").value, n:fmtNum(total) }) + (allTabs ? tr("，{n} 個分頁", { n:groups.length }) : ""), groups);
}
function showResults(title, groups){
  lastResults = { title, groups };
  const panel = $("#results"), body = $("#resBody");
  panel.hidden = false; $("#resTitle").textContent = title; body.replaceChildren();
  if (!groups.length) body.append(el("div", { class:"res-more", text:tr("沒有符合的結果。") }));
  let shown = 0;
  for (const g of groups){
    const det = el("details", { class:"res-group" }); det.open = true;
    det.append(el("summary", null, g.label + " ", el("span", { class:"cnt", text:tr("（{n} 筆）", { n:fmtNum(g.count) }) })));
    for (const r of g.rows){
      if (shown >= 3000) break;
      shown++;
      let text = r.text, spans = r.spans.map(s => s.slice());
      const lead = text.length - text.replace(/^\s+/, "").length;
      text = text.slice(lead); spans = spans.map(([a, l]) => [a - lead, l]).filter(([a]) => a >= 0);
      if (text.length > 300){ const first = spans.length ? spans[0][0] : 0; const off = Math.max(0, first - 60); text = (off ? "…" : "") + text.slice(off, off + 300); spans = spans.map(([a, l]) => [a - off + (off ? 1 : 0), l]).filter(([a]) => a >= 0 && a < text.length); }
      const tx = el("span", { class:"tx" }); let pos = 0;
      for (const [a, l] of spans){ if (a < pos) continue; tx.append(text.slice(pos, a), el("mark", { text: text.slice(a, a + l) })); pos = a + l; }
      tx.append(text.slice(pos));
      const btn = el("button", { class:"res-row", type:"button" }, el("span", { class:"ln", text:String(r.line + 1) }), tx);
      btn.addEventListener("click", () => jumpToResult(g.target, r.line, r.spans[0]));
      det.append(btn);
    }
    body.append(det);
    if (shown >= 3000){ body.append(el("div", { class:"res-more", text:tr("結果太多，只顯示前 3,000 行。請把搜尋條件縮小。") })); break; }
  }
  cmMain.refresh(); if (!$("#pane2").hidden) cm2.refresh();
}
async function jumpToResult(target, line, span){
  let t;
  if (target.kind === "tab"){ t = target.tab; if (!tabs.includes(t)){ toast(tr("這個分頁已經關閉")); return; } }
  else {
    t = tabs.find(x => x.path === target.path);
    if (!t){ try { t = await openFileObj(target.file, target.path); } catch(e){ t = null; } if (!t){ toast(tr("無法開啟這個檔案")); return; } }
  }
  activateTab(tabs.indexOf(t));
  const d = t.doc; const from = Pos(line, span[0]), to = Pos(line, span[0] + span[1]);
  focusEditor(); d.setSelection(from, to); cmMain.scrollIntoView({ from, to }, cmMain.getScrollInfo().clientHeight / 3);
}
$("#resClose").addEventListener("click", () => { $("#results").hidden = true; cmMain.refresh(); if (!$("#pane2").hidden) cm2.refresh(); focusEditor(); });
$("#resFold").addEventListener("click", () => { const ds = [...document.querySelectorAll("#resBody details")]; const open = ds.some(d => d.open); ds.forEach(d => d.open = !open); $("#resFold").textContent = open ? tr("全部展開") : tr("全部收合"); });
(() => { const grip = $("#resGrip"), panel = $("#results"); let y0 = 0, h0 = 0;
  grip.addEventListener("pointerdown", e => { e.preventDefault(); y0 = e.clientY; h0 = panel.offsetHeight; grip.setPointerCapture(e.pointerId); });
  grip.addEventListener("pointermove", e => { if (!grip.hasPointerCapture(e.pointerId)) return; const h = Math.min(window.innerHeight * 0.7, Math.max(80, h0 - (e.clientY - y0))); panel.style.height = h + "px"; });
  grip.addEventListener("pointerup", () => { cmMain.refresh(); if (!$("#pane2").hidden) cm2.refresh(); });
})();

