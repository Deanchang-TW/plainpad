/* ---------- split view & compare ---------- */
const split = { tab:null, linked:null, sync:true };
const cmp = { on:false, left:null, right:null, hunks:[], undo:[], timer:0, idx:-1 };
function showInPane2(t, force){
  if (!t || isHex(t)) return;
  if (t === split.tab && !force) return;
  if (cmp.on && t !== cmp.right) endCompare();
  if (split.linked && split.tab) split.tab.doc.unlinkDoc(split.linked);
  split.tab = t; split.linked = t.doc.linkedDoc({ sharedHist:true });
  cm2.swapDoc(split.linked); cm2.setOption("mode", LANG[t.langId].mode);
  renderPaneHeads(); mdSoon(0);
}
function openSplit(t = cur()){
  if (isHex(t)) t = tabs.find(x => !isHex(x));
  if (!t){ toast("第二檢視只能顯示文字分頁，目前沒有文字分頁"); return; }
  const was = !$("#pane2").hidden;
  $("#pane2").hidden = false; syncHeads();
  showInPane2(t, !was);
  $("#tSplit").setAttribute("aria-pressed", "true"); $("#tSync").setAttribute("aria-pressed", String(split.sync));
  cmMain.refresh(); cm2.refresh();
}
function closeSplit(){
  endCompare();
  if (split.linked && split.tab) split.tab.doc.unlinkDoc(split.linked);
  split.tab = null; split.linked = null; cm2.swapDoc(CodeMirror.Doc(""));
  $("#pane2").hidden = true; syncHeads(); $("#tSplit").setAttribute("aria-pressed", "false"); $("#tSync").setAttribute("aria-pressed", "false");
  if (cm === cm2) cm = cmMain;
  $("#pane1").classList.add("is-focus"); $("#pane2").classList.remove("is-focus");
  cmMain.refresh(); focusEditor(); mdSoon(0);
}
function renderPaneHeads(){
  const t = cur(); $("#p1Name").textContent = t ? "· " + t.name : "";
  const sel = $("#p2Sel"); sel.replaceChildren();
  tabs.forEach((x, i) => { if (!isHex(x)) sel.append(el("option", { value:String(i), text:x.name })); });
  if (split.tab) sel.value = String(tabs.indexOf(split.tab));
}
$("#p2Sel").addEventListener("change", e => { const t = tabs[+e.target.value]; if (t) showInPane2(t); cm2.focus(); });
$("#p2Close").addEventListener("click", closeSplit);
$("#p2Sync").addEventListener("change", e => setSync(e.target.checked));
function setSync(on){ split.sync = on; $("#p2Sync").checked = on; $("#tSync").setAttribute("aria-pressed", String(on && !$("#pane2").hidden)); if (on) syncScrollFrom(cm === cm2 ? cm2 : cmMain); }
let syncLock = false;
function syncScrollFrom(src){
  if (!split.sync || $("#pane2").hidden || syncLock) return;
  const dst = src === cmMain ? cm2 : cmMain; const s = src.getScrollInfo();
  syncLock = true; dst.scrollTo(s.left, s.top); requestAnimationFrame(() => { syncLock = false; });
}

function myers(A, B, maxD){
  const N = A.length, M = B.length;
  if (!N) return new Array(M).fill("+");
  if (!M) return new Array(N).fill("-");
  const MAX = N + M, off = MAX + 1; const v = new Int32Array(2 * MAX + 3); const trace = [];
  for (let d = 0; d <= MAX; d++){
    if (d > maxD) return null;
    trace.push(v.slice(off - d - 1, off + d + 2));
    for (let k = -d; k <= d; k += 2){
      let x = (k === -d || (k !== d && v[off + k - 1] < v[off + k + 1])) ? v[off + k + 1] : v[off + k - 1] + 1;
      let y = x - k;
      while (x < N && y < M && A[x] === B[y]){ x++; y++; }
      v[off + k] = x;
      if (x >= N && y >= M){
        const ops = []; let cx = N, cy = M;
        for (let dd = d; dd >= 0; dd--){
          const V = trace[dd], get = kk => V[kk + dd + 1]; const kk = cx - cy;
          const prevK = (kk === -dd || (kk !== dd && get(kk - 1) < get(kk + 1))) ? kk + 1 : kk - 1;
          const prevX = get(prevK), prevY = prevX - prevK;
          while (cx > prevX && cy > prevY){ ops.push("="); cx--; cy--; }
          if (dd > 0) ops.push(cx === prevX ? "+" : "-");
          cx = prevX; cy = prevY;
        }
        return ops.reverse();
      }
    }
  }
  return null;
}
function diffLines(a, b){
  const na = a.length, nb = b.length; let pre = 0, suf = 0;
  while (pre < na && pre < nb && a[pre] === b[pre]) pre++;
  while (suf < na - pre && suf < nb - pre && a[na - 1 - suf] === b[nb - 1 - suf]) suf++;
  const ids = new Map(); const id = s => { let v = ids.get(s); if (v === undefined){ v = ids.size; ids.set(s, v); } return v; };
  const A = new Int32Array(na - pre - suf), B = new Int32Array(nb - pre - suf);
  for (let i = 0; i < A.length; i++) A[i] = id(a[pre + i]);
  for (let i = 0; i < B.length; i++) B[i] = id(b[pre + i]);
  const core = myers(A, B, 3000); if (!core) return null;
  const hunks = []; let ia = pre, ib = pre, i = 0;
  while (i < core.length){
    if (core[i] === "="){ ia++; ib++; i++; continue; }
    const h = { a0:ia, b0:ib, ka:0, kb:0 };
    while (i < core.length && core[i] !== "="){ if (core[i] === "-"){ h.ka++; ia++; } else { h.kb++; ib++; } i++; }
    hunks.push(h);
  }
  return hunks;
}
async function compareDialog(){
  if (tabs.length < 2){ toast("至少要開兩個分頁才能比較"); return; }
  const left = cur();
  if (isHex(left)){ toast("Hex 分頁不支援逐行比較"); return; }
  const others = tabs.filter(t => t !== left && !isHex(t));
  if (!others.length){ toast("沒有其他文字分頁可以比較"); return; }
  const sel = el("select", { id:"cmpTarget", "data-autofocus":"" });
  others.forEach(t => sel.append(el("option", { value:String(tabs.indexOf(t)), text:t.name })));
  const def = split.tab && split.tab !== left ? split.tab : others[others.length - 1];
  sel.value = String(tabs.indexOf(def));
  const r = await ask({ title:`比較「${left.name}」與…`, text:"左邊是目前分頁，右邊是你選的分頁。綠色是右邊多出的行，紅色是左邊被刪掉的行，黃色是修改過的行；編輯時會自動重新比較。", body: sel, actions:[{ id:"cancel", label:"取消" }, { id:"ok", label:"開始比較", primary:true }] });
  if (r !== "ok") return;
  startCompare(tabs[+sel.value]);
}
function startCompare(other){
  if (!other || other === cur() || isHex(other) || isHex(cur())) return;
  endCompare();
  if ($("#pane2").hidden) openSplit(other); else showInPane2(other);
  cmp.on = true; cmp.left = cur(); cmp.right = other; cmp.idx = -1;
  setSync(true); cmMain.setOption("lineWrapping", false); cm2.setOption("lineWrapping", false);
  $("#cmpBar").hidden = false; $("#tCmp").setAttribute("aria-pressed", "true");
  runCompare();
  cmMain.scrollTo(0, 0); cm2.scrollTo(0, 0);
  if (cmp.hunks.length) cmpJump(1);
}
function clearCompareMarks(){ cmp.undo.forEach(f => { try { f(); } catch(e){} }); cmp.undo = []; }
function endCompare(){
  if (!cmp.on) return;
  clearTimeout(cmp.timer); clearCompareMarks();
  cmp.on = false; cmp.left = cmp.right = null; cmp.hunks = [];
  $("#cmpBar").hidden = true; $("#tCmp").setAttribute("aria-pressed", "false");
  cmMain.setOption("lineWrapping", settings.wrap); cm2.setOption("lineWrapping", settings.wrap);
}
function compareSoon(ms = 350){ clearTimeout(cmp.timer); cmp.timer = setTimeout(runCompare, ms); }
function runCompare(){
  if (!cmp.on) return;
  clearCompareMarks();
  const dl = cmp.left.doc, dr = split.linked;
  const hunks = diffLines(dl.getValue("\n").split("\n"), dr.getValue("\n").split("\n"));
  if (!hunks){ cmp.hunks = []; $("#cmpInfo").textContent = "差異太多，無法逐行比較"; return; }
  cmp.hunks = hunks;
  const lineCls = (doc, line, cls) => { const h = doc.addLineClass(line, "background", cls); cmp.undo.push(() => doc.removeLineClass(h, "background", cls)); };
  const pad = (ed, after, n) => {
    const div = el("div", { class:"diff-pad" }); div.style.height = (n * ed.defaultTextHeight()) + "px";
    const w = after < 0 ? ed.addLineWidget(0, div, { above:true }) : ed.addLineWidget(after, div);
    cmp.undo.push(() => w.clear());
  };
  let add = 0, del = 0, chg = 0;
  cmMain.operation(() => cm2.operation(() => {
    for (const h of hunks){
      const both = Math.min(h.ka, h.kb); chg += both; del += h.ka - both; add += h.kb - both;
      for (let i = 0; i < h.ka; i++) lineCls(dl, h.a0 + i, i < both ? "diff-chg" : "diff-del");
      for (let i = 0; i < h.kb; i++) lineCls(dr, h.b0 + i, i < both ? "diff-chg" : "diff-add");
      if (h.ka < h.kb) pad(cmMain, h.ka ? h.a0 + h.ka - 1 : h.a0 - 1, h.kb - h.ka);
      if (h.kb < h.ka) pad(cm2, h.kb ? h.b0 + h.kb - 1 : h.b0 - 1, h.ka - h.kb);
    }
  }));
  $("#cmpInfo").textContent = hunks.length ? `差異 ${hunks.length} 處（修改 ${chg}、刪除 ${del}、新增 ${add} 行）` : "兩份內容完全相同";
  syncScrollFrom(cm === cm2 ? cm2 : cmMain);
}
function cmpJump(dir){
  if (!cmp.on || !cmp.hunks.length){ toast("沒有差異"); return; }
  const line = cmMain.getCursor().line; const H = cmp.hunks;
  let i;
  if (dir > 0){ i = H.findIndex(h => h.a0 > line); if (i < 0) i = 0; }
  else { i = -1; for (let j = H.length - 1; j >= 0; j--) if (H[j].a0 < line){ i = j; break; } if (i < 0) i = H.length - 1; }
  const h = H[i]; cmp.idx = i;
  const la = Math.min(h.a0, cmMain.lineCount() - 1), lb = Math.min(h.b0, cm2.lineCount() - 1);
  cmMain.setCursor(Pos(la, 0)); cm2.setCursor(Pos(lb, 0));
  const top = cmMain.heightAtLine(la, "local") - cmMain.getScrollInfo().clientHeight / 3;
  cmMain.scrollTo(null, Math.max(0, top));
  if (!split.sync){ const top2 = cm2.heightAtLine(lb, "local") - cm2.getScrollInfo().clientHeight / 3; cm2.scrollTo(null, Math.max(0, top2)); }
  $("#cmpInfo").textContent = `第 ${i + 1} / ${H.length} 處差異`;
}
$("#cmpPrev").addEventListener("click", () => cmpJump(-1));
$("#cmpNext").addEventListener("click", () => cmpJump(1));
$("#cmpEnd").addEventListener("click", () => { endCompare(); focusEditor(); });

