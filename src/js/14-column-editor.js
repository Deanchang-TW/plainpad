/* ---------- column editor ---------- */
async function columnEditor(){
  const ed = cm, d = ed.getDoc();
  const body = el("div", { class:"form-grid" });
  body.innerHTML = `
    <label class="radio span"><input type="radio" name="ceKind" id="ceKindText" value="text" checked> 插入文字</label>
    <label for="ceText">文字</label><input type="text" id="ceText" data-autofocus spellcheck="false">
    <label class="radio span"><input type="radio" name="ceKind" id="ceKindNum" value="num"> 插入數字</label>
    <div class="form-sub span" id="ceNum" aria-disabled="true">
      <label for="ceStart">起始</label><input type="number" id="ceStart" value="1">
      <label for="ceStep">遞增</label><input type="number" id="ceStep" value="1">
      <label for="ceRepeat">重複</label><input type="number" id="ceRepeat" value="1" min="1">
      <label for="ceFmt">格式</label><select id="ceFmt"><option value="10">十進位</option><option value="16">十六進位</option><option value="8">八進位</option><option value="2">二進位</option></select>
      <label class="radio span" style="grid-column:1 / -1"><input type="checkbox" id="ceZero"> 前面補零（否則以空白對齊）</label>
    </div>`;
  const sync = () => { const num = body.querySelector("#ceKindNum").checked; body.querySelector("#ceNum").setAttribute("aria-disabled", String(!num)); body.querySelector("#ceText").disabled = num; body.querySelectorAll("#ceNum input, #ceNum select").forEach(x => x.disabled = !num); };
  body.querySelectorAll("input[name=ceKind]").forEach(r => r.addEventListener("change", () => { sync(); (r.value === "num" ? body.querySelector("#ceStart") : body.querySelector("#ceText")).focus(); }));
  sync();
  const r = await ask({ title:"欄編輯器", text:"多重游標或矩形選取時，插在每個游標位置；沒有選取時，從游標所在行一路插到文件結尾，太短的行會補空白。", body, actions:[{ id:"cancel", label:"取消" }, { id:"ok", label:"插入", primary:true }] });
  if (r !== "ok"){ ed.focus(); return; }
  const isNum = body.querySelector("#ceKindNum").checked;
  const ts = ed.getOption("tabSize"); const sels = d.listSelections(); const targets = [];
  if (sels.length > 1) sels.forEach(s => targets.push({ pos: s.from(), pad:"" }));
  else {
    const s = sels[0]; let l0, l1;
    if (s.empty()){ l0 = s.head.line; l1 = d.lastLine(); } else { l0 = s.from().line; l1 = s.to().line; }
    const colOf = p => CodeMirror.countColumn(d.getLine(p.line), p.ch, ts);
    const col = s.empty() ? colOf(s.head) : Math.min(colOf(s.anchor), colOf(s.head));
    for (let l = l0; l <= l1; l++){
      const text = d.getLine(l); const ch = CodeMirror.findColumn(text, col, ts);
      const have = CodeMirror.countColumn(text, ch, ts);
      targets.push({ pos: Pos(l, ch), pad: have < col ? " ".repeat(col - have) : "" });
    }
  }
  targets.sort((a, b) => a.pos.line - b.pos.line || a.pos.ch - b.pos.ch);
  let values;
  if (!isNum) values = targets.map(() => body.querySelector("#ceText").value);
  else {
    const start = Number(body.querySelector("#ceStart").value) || 0, step = Number(body.querySelector("#ceStep").value) || 0;
    const rep = Math.max(1, Math.floor(Number(body.querySelector("#ceRepeat").value) || 1));
    const base = Number(body.querySelector("#ceFmt").value); const zero = body.querySelector("#ceZero").checked;
    const raw = targets.map((_, i) => { const n = Math.trunc(start + Math.floor(i / rep) * step); return { neg: n < 0, s: Math.abs(n).toString(base).toUpperCase() }; });
    const w = Math.max(...raw.map(x => x.s.length));
    values = raw.map(x => zero ? (x.neg ? "-" : "") + x.s.padStart(w, "0") : ((x.neg ? "-" : "") + x.s).padStart(w + (raw.some(y => y.neg) ? 1 : 0), " "));
  }
  if (!values.some(v => v)) { ed.focus(); return; }
  ed.operation(() => { for (let i = targets.length - 1; i >= 0; i--) d.replaceRange(targets[i].pad + values[i], targets[i].pos, null, "+column"); });
  ed.focus(); toast(`已在 ${fmtNum(targets.length)} 行插入`);
}

