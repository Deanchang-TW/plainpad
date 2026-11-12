// Builds the macOS app: dist/mac/Plainpad.app
//   Contents/MacOS/Plainpad          compiled from macos/Sources/*.swift (Cocoa + WebKit, no other dependencies)
//   Contents/Resources/web/          the same page as dist/test/prod.html with its vendor/ files, served from plainpad://app/
//   Contents/Resources/Plainpad.icns rendered from macos/icon.svg with the test browser, then packed with iconutil
// Usage: node build-mac.mjs [--universal]     (--universal also builds x86_64 and merges with lipo)
// Needs Xcode or the Command Line Tools (swiftc). The app is ad-hoc signed, which is enough to run on this machine.
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const root = new URL("./", import.meta.url);
const at = p => new URL(p, root).pathname;
const pkg = JSON.parse(readFileSync(at("package.json"), "utf8"));
const universal = process.argv.includes("--universal");
const sh = (cmd, args, opts = {}) => execFileSync(cmd, args, { stdio: "inherit", cwd: at("."), ...opts });

sh("node", ["build.mjs"]);

const app = at("dist/mac/Plainpad.app/"), contents = app + "Contents/", res = contents + "Resources/";
rmSync(at("dist/mac/"), { recursive: true, force: true });
for (const d of [contents + "MacOS/", res + "web/vendor/"]) mkdirSync(d, { recursive: true });

copyFileSync(at("dist/test/prod.html"), res + "web/index.html");
for (const f of readdirSync(at("dist/artifact/vendor/"))) copyFileSync(at("dist/artifact/vendor/" + f), res + "web/vendor/" + f);
writeFileSync(contents + "Info.plist", readFileSync(at("macos/Info.plist"), "utf8").replaceAll("__VERSION__", pkg.version));
writeFileSync(contents + "PkgInfo", "APPL????");

/* Icon: one 1024 px render, scaled down by sips for the other sizes. */
const iconset = at("dist/mac/Plainpad.iconset/");
mkdirSync(iconset, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const page = await browser.newPage({ viewport: { width: 1024, height: 1024 }, deviceScaleFactor: 1 });
await page.setContent(`<!doctype html><style>html,body{margin:0;background:transparent}svg{display:block}</style>${readFileSync(at("macos/icon.svg"), "utf8")}`);
await page.screenshot({ path: iconset + "icon_512x512@2x.png", omitBackground: true });
await browser.close();
for (const [name, px] of [["icon_16x16", 16], ["icon_16x16@2x", 32], ["icon_32x32", 32], ["icon_32x32@2x", 64], ["icon_128x128", 128], ["icon_128x128@2x", 256], ["icon_256x256", 256], ["icon_256x256@2x", 512], ["icon_512x512", 512]])
  sh("sips", ["-z", String(px), String(px), iconset + "icon_512x512@2x.png", "--out", iconset + name + ".png"], { stdio: "ignore" });
sh("iconutil", ["-c", "icns", iconset, "-o", res + "Plainpad.icns"]);
rmSync(iconset, { recursive: true });

/* Binary */
const sources = readdirSync(at("macos/Sources/")).filter(f => f.endsWith(".swift")).map(f => at("macos/Sources/" + f));
const compile = (arch, out) => sh("xcrun", ["swiftc", "-O", "-target", `${arch}-apple-macos13.0`, "-framework", "Cocoa", "-framework", "WebKit", "-o", out, ...sources]);
const bin = contents + "MacOS/Plainpad";
if (universal){
  compile("arm64", at("dist/mac/Plainpad-arm64")); compile("x86_64", at("dist/mac/Plainpad-x86_64"));
  sh("lipo", ["-create", at("dist/mac/Plainpad-arm64"), at("dist/mac/Plainpad-x86_64"), "-output", bin]);
  rmSync(at("dist/mac/Plainpad-arm64")); rmSync(at("dist/mac/Plainpad-x86_64"));
} else compile(process.arch === "arm64" ? "arm64" : "x86_64", bin);
sh("codesign", ["--force", "--sign", "-", app]);
console.log("Built dist/mac/Plainpad.app", universal ? "(universal)" : `(${process.arch})`, "version", pkg.version);
