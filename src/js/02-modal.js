/* ---------- modal ---------- */
function ask({ title, text = "", body = null, actions }){
  return new Promise(resolve => {
    const modal = $("#modal"), acts = $("#modalActions");
    const prevFocus = document.activeElement;
    $("#modalTitle").textContent = title; $("#modalText").textContent = text; $("#modalText").hidden = !text;
    $("#modalBody").replaceChildren(...(body ? [body] : []));
    acts.replaceChildren();
    let primary = null;
    const done = v => { modal.hidden = true; document.removeEventListener("keydown", onKey, true); resolve(v); if (prevFocus && prevFocus.focus) prevFocus.focus(); };
    actions.forEach(a => { const b = el("button", { type:"button", class:"btn" + (a.primary ? " btn-primary" : ""), text:a.label }); b.addEventListener("click", () => done(a.id)); acts.appendChild(b); if (a.primary) primary = a.id; });
    function onKey(e){
      if (e.key === "Escape"){ e.preventDefault(); e.stopPropagation(); done("cancel"); }
      else if (e.key === "Enter" && primary && !(e.target instanceof HTMLButtonElement) && !(e.target instanceof HTMLSelectElement)){ e.preventDefault(); e.stopPropagation(); done(primary); }
    }
    document.addEventListener("keydown", onKey, true);
    modal.hidden = false;
    const input = $("#modalBody [data-autofocus]") || $("#modalBody input[type=text], #modalBody input[type=number]");
    if (input){ input.focus(); if (input.select) input.select(); } else { const p = acts.querySelector(".btn-primary") || acts.querySelector("button"); p && p.focus(); }
  });
}
async function promptText({ title, text, value = "", ok = tr("確定") }){
  const input = el("input", { type:"text", id:"modalInput", spellcheck:"false" }); input.value = value;
  const r = await ask({ title, text, body: input, actions: [{ id:"cancel", label:tr("取消") }, { id:"ok", label: ok, primary:true }] });
  return r === "ok" ? input.value : null;
}

