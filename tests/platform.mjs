// Which keyboard the tests type on. Plainpad maps its shortcuts to ⌘ on macOS and Ctrl elsewhere,
// so tests press MOD for those. A few shortcuts are Ctrl on both (⌃G go to line, ⌃⇧M Markdown preview);
// those stay "Control".
// PP_PLATFORM=mac or PP_PLATFORM=linux makes the page report that platform, so both paths can be tested on one machine.
export const PLATFORM = process.env.PP_PLATFORM || (process.platform === "darwin" ? "mac" : "linux");
export const MAC = PLATFORM === "mac";
export const MOD = MAC ? "Meta" : "Control";
/* True when the page pretends to be another platform. The browser then has no native copy/paste for MOD+C/V,
   because those come from the real operating system, so tests that need the system clipboard check SPOOFED. */
export const SPOOFED = MAC !== (process.platform === "darwin");

/* Makes pages in this context report PLATFORM when it differs from the machine the tests run on. */
export async function applyPlatform(context){
  if (MAC === (process.platform === "darwin")) return;
  await context.addInitScript(mac => {
    Object.defineProperty(Navigator.prototype, "platform", { get: () => mac ? "MacIntel" : "Linux x86_64" });
  }, MAC);
}
