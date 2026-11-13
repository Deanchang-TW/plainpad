# Plainpad

[繁體中文](README.md) | English

A Notepad++-style editor that runs in the browser: tabbed text editing, a hex editor, Markdown preview (with Mermaid
and math), split view and compare, bookmarks, macros, a column editor, regular-expression search, and saving in the
file's original encoding.

The interface is available in Traditional Chinese, English, Simplified Chinese and Vietnamese. It follows the browser or
system language by default and can be changed under Settings > Interface language.

## Running locally

```sh
npm install                        # first time only
node build.mjs                     # builds dist/
open dist/plainpad-standalone.html # macOS; on other systems open this file in a browser
```

The standalone file has every library built in. It works straight from `file://`, and saving uses the browser's normal
download.

To run the same form as the hosted page (the page plus a `vendor/` folder), serve it over HTTP. Opened from `file://`,
the libraries will not load:

```sh
npx serve dist/artifact            # then open http://localhost:3000/plainpad.html
# or
python3 -m http.server 8000 --directory dist/artifact   # then open http://localhost:8000/plainpad.html
```

After changing anything in `src/`, run `node build.mjs` again and reload the page. `dist/` is build output; do not edit
it by hand.

## macOS app

```sh
npm run build:mac                  # builds dist/mac/Plainpad.app (needs Xcode or the Command Line Tools)
open dist/mac/Plainpad.app
```

The same page runs inside a native shell (`macos/`, Swift + WKWebView, no other dependencies). Differences from the web
version:

- Saving uses the macOS save panel. Files opened from disk are written back to their own path, with no restriction on
  file extensions.
- Files can be opened from Finder's Open With, by dropping them on the Dock icon, or with `open -a Plainpad <file>`.
  Open inside the app shows NSOpenPanel.
- There is a native menu bar (File, Edit, View, Window). Its items call the same `run()` as the page.
- The window title shows the active tab's file name, and the close button shows a dot when there are unsaved changes.
- When another program changes an open file, a tab without unsaved changes reloads by itself (only the changed part is
  replaced, so it can be undone); a tab with changes asks first. If the file is deleted, the tab stays and is marked
  unsaved. Changes made while the app was closed are detected on the next launch.
- The session is still kept in the page's localStorage / IndexedDB. Closing the window quits the app, and the session
  is written out before it quits.

`node build-mac.mjs --universal` builds for both arm64 and x86_64. The app has only an ad-hoc signature, which is fine on
your own Mac; giving it to others needs a Developer ID signature and notarization.
`PLAINPAD_DEBUG=1 dist/mac/Plainpad.app/Contents/MacOS/Plainpad` prints the page's requests and bridge messages to the
terminal. Right-click > Inspect Element opens Web Inspector on the page.

## Build and test

```sh
npm install          # library versions are pinned in package.json / package-lock.json
npm run build        # builds dist/
npm test             # builds, then runs every Chromium test (about 1 minute)
node tests/run.mjs hex      # runs only tests whose name contains "hex"
PP_PLATFORM=mac node tests/run.mjs   # simulates the Mac keyboard (⌘); the default on a Mac
```

The tests need Chromium. `/opt/pw-browsers/chromium` is used automatically when present; elsewhere set
`CHROMIUM_PATH` or run `npx playwright install chromium`.

## Build output

| File | Purpose |
|---|---|
| `dist/artifact/plainpad.html` + `dist/artifact/vendor/*` | The page published to Claude. Libraries are published with the page, not loaded from a third-party CDN |
| `dist/plainpad-standalone.html` | A single file (about 6 MB) to open in a local browser. Fully offline, with no restriction on saved file extensions |
| `dist/mac/Plainpad.app` | The macOS app (`npm run build:mac`). The page lives in `Contents/Resources/web/` and is served from the `plainpad://app/` custom scheme |
| `dist/test/index.html`, `dist/test/prod.html` | For tests: the first exposes the test hook, the second is the production page (used to check that no test hook is exposed) |

`node build.mjs --compare <file>` compares the build output with the given file byte by byte.

## Source layout

```
src/head.html        <title>, meta tags, fonts
src/markup.html      page layout HTML
src/styles/*.css     split by area, concatenated in file-name order
src/i18n/            interface translations (en, zh-CN, vi JSON keyed by the Traditional Chinese text), plus the help page and sample file for each language
src/js/*.js          split by feature, concatenated in file-name order and run inside one function
build.mjs            assembles the page, bundles CodeMirror, copies the other libraries
build-mac.mjs        wraps the page into the macOS app; macos/ holds the Swift sources, Info.plist and icon
tests/*.test.mjs     browser tests; tests/fixtures holds sample files and expected output
```

The files in `src/js` share one scope (they are concatenated and wrapped in a single IIFE at build time), so their order
matters: `00-config` defines constants and `26-boot` runs the startup last. This is a transitional structure split out
of a single file; a next step would be real ES modules with explicit imports and exports.

Main areas:

| File | Contents |
|---|---|
| `03-editors.js`, `04-tab-strip.js` | The two CodeMirror editors, the tab data structure and the tab strip |
| `08-persistence.js` | Session storage: metadata in localStorage, content in IndexedDB, writing only tabs that changed; Web Locks make sure only one window writes |
| `09-encodings.js`, `10-open-decode.js`, `11-save.js` | Encoding detection and saving in the original encoding (the encoding tables are derived from the browser's own decoders, so whatever is read can be written back unchanged) |
| `18-split-view-compare.js` | Split view and line-by-line compare (Myers diff) |
| `19-markdown-preview.js` | Markdown preview, Mermaid, KaTeX, and lazy loading of those libraries |
| `20-hex-editor.js` | Hex editor: edits kept in a piece table, the original file read lazily in 64 KB blocks |
| `23-actions.js`, `24-menus.js`, `25-keyboard.js` | `run()`, the entry point for every command; menu definitions; keyboard shortcuts |
| `11-native-shell.js` | The macOS app bridge: detects the WKWebView message handler and routes saving and opening through native panels |

## Publishing

Publish `dist/artifact/plainpad.html` together with the files under `dist/artifact/vendor/`. The page loads its
libraries from the relative path `vendor/...`, and the build checks that every library file the page refers to exists.

## Known limitations

- Inside Claude's page, saving can only download, and only extensions such as txt, md, zip and png are allowed; other
  extensions must be zipped or get a .txt suffix. The standalone file has no such restriction.
- When two windows of the same browser are open at once, the second one does not keep its content and shows a notice.
- Hex tabs over 200 MB are not kept across a reload.

## License

MIT, see [LICENSE](LICENSE). The bundled libraries (CodeMirror, marked, Mermaid, KaTeX and others) keep their own licenses.
