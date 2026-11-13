/* ---------- find in files ---------- */
let dirFiles = null, dirName = "", searchToken = 0;
const SKIP_DIRS = /(^|\/)(\.git|\.svn|\.hg|node_modules|bin|obj|\.vs|\.idea|dist|build|packages)\//i;
function pickDir(){ const d = $("#dirInput"); d.value = ""; d.click(); }
$("#dirInput").addEventListener("change", e => {
  dirFiles = [...e.target.files]; dirName = ((dirFiles[0] && dirFiles[0].webkitRelativePath) || "").split("/")[0] || tr("Folder");
  $("#dirLabel").textContent = tr("{folder} ({n} files)", { folder:dirName, n:fmtNum(dirFiles.length) }); $("#dirLabel").title = dirName;
  if ($("#findInput").value) findInFiles();
});
$("#btnPickDir").addEventListener("click", pickDir);
$("#btnFindInFiles").addEventListener("click", () => findInFiles());
function globToRe(pats){
  const list = pats.split(/[\s;,]+/).filter(Boolean); if (!list.length) return null;
  return new RegExp("^(?:" + list.map(p => p.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".")).join("|") + ")$", "i");
}
async function findInFiles(){
  const re = buildRe(); if (!re){ $("#findInput").focus(); return; }
  if (!dirFiles){ pickDir(); return; }
  const fre = globToRe($("#filterInput").value); const token = ++searchToken; const info = $("#findInfo");
  const list = dirFiles.filter(f => { const p = f.webkitRelativePath || f.name; if (settings.skipDirs && SKIP_DIRS.test(p)) return false; if (fre && !fre.test(f.name)) return false; return f.size <= 5 * 1024 * 1024; });
  const groups = []; let total = 0, skipped = 0;
  for (let i = 0; i < list.length; i++){
    if (token !== searchToken) return;
    if (i % 25 === 0){ info.textContent = tr("Searching… {i} / {n}", { i:fmtNum(i), n:fmtNum(list.length) }); await new Promise(r => setTimeout(r, 0)); }
    const f = list[i]; const path = f.webkitRelativePath || f.name;
    try {
      const buf = await f.arrayBuffer(); if (looksBinary(buf)){ skipped++; continue; }
      const text = decode(buf).text.replace(/\r\n?/g, "\n");
      const rows = hitsFromText(text, re, 5000);
      if (rows.length){ const n = rows.reduce((s, r) => s + r.spans.length, 0); total += n; groups.push({ label:path, count:n, target:{ kind:"file", file:f, path }, rows }); }
    } catch(e){ skipped++; }
    if (total >= 50000) break;
  }
  info.textContent = tr("Found {n} matches in {files} files", { files:fmtNum(list.length), n:fmtNum(total) });
  showResults(tr("Search “{text}” in “{folder}”: {n} matches, {files} files", { folder:dirName, text:$("#findInput").value, n:fmtNum(total), files:fmtNum(groups.length) }) + (skipped ? tr(" (skipped {n} binary or unreadable files)", { n:skipped }) : ""), groups);
}

