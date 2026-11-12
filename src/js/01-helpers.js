/* ---------- helpers ---------- */
function extOf(name){ const m = /\.([^./\\]+)$/.exec(name || ""); return m ? m[1].toLowerCase() : ""; }
function langForName(name){
  const base = (name || "").toLowerCase().replace(/^\./, ""), e = extOf(name);
  for (const l of LANGS) if (l.ext.includes(base)) return l.id;
  if (/^(docker|container)file[.-]/.test(base)) return "docker";
  for (const l of LANGS) if (l.ext.includes(e)) return l.id;
  return "text";
}
function eolStats(t){ const crlf = (t.match(/\r\n/g) || []).length, cr = (t.match(/\r(?!\n)/g) || []).length, lf = (t.match(/(?<!\r)\n/g) || []).length; return { CRLF:crlf, CR:cr, LF:lf }; }
function detectEol(t){ const n = eolStats(t); return n.CRLF >= n.LF && n.CRLF >= n.CR && n.CRLF ? "CRLF" : n.CR > n.LF ? "CR" : "LF"; }
function mixedEolNote(t){ const n = eolStats(t), kinds = Object.entries(n).filter(([, v]) => v); if (kinds.length < 2) return ""; return kinds.map(([k, v]) => `${k} ${fmtNum(v)} 行`).join("、"); }
function escapeRe(s){ return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
function unescapeExt(s){
  return s.replace(/\\(n|r|t|0|\\|x[0-9a-fA-F]{2}|u[0-9a-fA-F]{4})/g, (a, c) => {
    if (c === "n") return "\n"; if (c === "r") return "\r"; if (c === "t") return "\t"; if (c === "0") return "\0"; if (c === "\\") return "\\";
    return String.fromCharCode(parseInt(c.slice(1), 16));
  });
}
function keyLabel(k){
  let key, mods;
  if (k.endsWith("--")){ key = "-"; mods = k.slice(0, -2).split("-"); }
  else { mods = k.split("-"); key = mods.pop(); }
  const named = { ArrowUp:"↑", ArrowDown:"↓", ArrowLeft:"←", ArrowRight:"→", Enter: isMac ? "↩" : "Enter" };
  if (isMac){
    const sym = { Ctrl:"⌃", Alt:"⌥", Shift:"⇧", Mod:"⌘" };
    return ["Ctrl","Alt","Shift","Mod"].filter(m => mods.includes(m)).map(m => sym[m]).join("") + (named[key] || key);
  }
  const name = { Mod:"Ctrl", Ctrl:"Ctrl", Alt:"Alt", Shift:"Shift" };
  return [...["Mod","Ctrl","Alt","Shift"].filter(m => mods.includes(m)).map(m => name[m]), named[key] || key].join("+");
}
let toastTimer;
function toast(msg){ if (quiet) return; const t = $("#toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("show"), 2600); }
async function copyText(text){
  try { await navigator.clipboard.writeText(text); return true; }
  catch(e){
    const ta = document.createElement("textarea"); ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0"; document.body.appendChild(ta); ta.select();
    let ok = false; try { ok = document.execCommand("copy"); } catch(_){}
    ta.remove(); return ok;
  }
}
function fmtNum(n){ return n.toLocaleString("en-US"); }
function el(tag, props, ...kids){ const e = document.createElement(tag); if (props) for (const [k, v] of Object.entries(props)){ if (k === "class") e.className = v; else if (k === "text") e.textContent = v; else if (k in e && typeof v !== "string") e[k] = v; else e.setAttribute(k, v); } kids.forEach(c => c != null && e.append(c)); return e; }

