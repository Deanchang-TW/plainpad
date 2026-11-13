# Plainpad: project conventions

A Notepad++-style editor for the web (text, hex, Markdown preview). Personal project, GitHub: `Deanchang-TW/plainpad` (public).
This repository is the only source. `dist/` is build output: it is not under version control and must not be edited by hand.

## Commands

```sh
npm install                      # versions are pinned in package-lock.json
npm test                         # build + every browser test (about 1 minute); run after every change
node tests/run.mjs <keyword>     # only tests whose name contains the keyword, e.g. hex, encoding › detects
node build.mjs --compare <file>  # byte-for-byte comparison of the build output, to prove a refactor changed nothing
npm run build:mac                # builds dist/mac/Plainpad.app (Swift + WKWebView shell, needs swiftc)
```

Before running the tests on a machine for the first time, run `npx playwright install chromium`, or point `CHROMIUM_PATH` at a browser.

The tests pick the keyboard from the machine they run on: ⌘ on a Mac, Ctrl elsewhere. `PP_PLATFORM=mac` or `PP_PLATFORM=linux` makes the
page pretend to be the other platform, so both key paths can be checked on one machine. After changing shortcuts or tests, run both:
`node tests/run.mjs` and `PP_PLATFORM=linux node tests/run.mjs` (or `PP_PLATFORM=mac` when not on a Mac).

## Code structure

- `src/js/*.js` are concatenated in file-name order and run inside one IIFE: **all files share one scope**.
  - The number in a new file's name decides where it runs.
  - A top-level `const` used by another file must run before the code that uses it. Function declarations are hoisted; `const` is not.
  - `26-boot.js` runs last. Startup is async: tabs are created only after the session lock and the IndexedDB reads finish.
- **Every command goes through `run(name)`** (`23-actions.js`). Menus, toolbar and shortcuts all call `run`; never call an action function directly.
  - Add new actions to the `A` table.
  - Decide how it behaves in a hex tab: list it in `HEX_ROUTE` to forward it to a hex version, in `HEX_OK` to run it as usual; anything else is blocked with a message.
  - Actions whose names start with `hex` are only available in hex view.
- **There are two kinds of tab**, text and hex, told apart with `isHex(t)`.
  - A hex tab carries an empty CodeMirror document so that shared code paths do not break, but its content means nothing.
  - Any new code that touches `t.doc` must consider hex tabs.
- **Encodings**: `t.encoding` holds the WHATWG name (`utf-8`, `big5`, `gb18030`, `shift_jis`, `euc-kr`, `windows-1252`, `utf-16le`, `utf-16be`).
  - Convert older names with `normEnc()`.
  - Always produce file bytes with `encodeText()`, never `TextEncoder`.
- **Persistence** (`08-persistence.js`):
  - Metadata lives in localStorage under `plainpad.session.v2`; tab content in the IndexedDB stores `docs` and `hex`.
  - When the storage format changes, raise the version number, write a migration and add a migration test (see the first test in `storage.test.mjs`).
- **macOS app** (`macos/`, `build-mac.mjs`): the same page inside a WKWebView, served from the `plainpad://app/` custom scheme.
  - The page checks `NATIVE` (`00-config.js`) to know it is inside the app; `LOCAL` is then true as well.
  - The messages between page and app are documented in the comment at the top of `macos/Sources/WebShell.swift`; `11-native-shell.js` is the page side.
    Change both sides together and update `tests/native.test.mjs`, which stands in for the app with a fake message handler.
  - The page puts `window.__ppNative` on window only when `NATIVE`; the published page must still expose nothing.
  - The Swift side cannot be tested with Playwright: after changing it, run `npm run build:mac` and try the app. `PLAINPAD_DEBUG=1` prints requests and messages.

## Limits of the page's environment

The published page runs in Claude's page sandbox, where many browser features are unavailable:

- `alert`, `confirm` and `prompt` do not appear (`confirm` returns false). Use `ask()` or `promptText()` (`02-modal.js`) for every dialog.
- Saving only works through `claude.use("downloads")`, and only for extensions in `DL_EXT`. Other extensions must be zipped or get `.txt` appended.
- The standalone build (`LOCAL` is true) has no extension limit, because it uses an ordinary browser download.
- localStorage and IndexedDB can throw. Wrap every access in try/catch, and the page must still work without them.
- The only external resource allowed is Google Fonts CSS. Libraries are bundled from npm by `build.mjs` and published in `vendor/`. **Do not add CDN `<script>` tags back.**
- The test hook `window.__plainpad` exists only when `window.__PP_TEST` is true. The published page must expose nothing; the test `editing › the published page has no test hook` checks this.

## Rules

- **No U+FFFD character in source files.** Write it as `�` when needed, or the build fails. The character is usually the trace of a lost character from editing.
- **Library upgrades**:
  - Pin exact versions, never ranges.
  - Only adopt versions published at least 14 days ago.
  - Run `npm audit` after upgrading.
  - Mermaid bundles its own DOMPurify and KaTeX into `mermaid.min.js`, so the dependency versions npm shows are not what actually runs. Check with a grep for strings such as `"3\.4\.[0-9]*"`.
  - File names include the version: update `LIB` in `19-markdown-preview.js` to match. The build checks that every vendor file the page refers to exists.
- **Tests**:
  - When behaviour changes, add or update tests with it.
  - When a test fails, first decide whether the code or the test is wrong; explain why when fixing a test.
  - Press app shortcuts in tests with `MOD` from `tests/platform.mjs`, never a hard-coded `Control`; the app uses ⌘ on a Mac.
    Write `Control` only for shortcuts that are Ctrl on a Mac too (⌃G Go to Line, ⌃⇧M Markdown preview, ⌃⇧H hex toggle).
  - Steps that rely on the system clipboard (native copy and paste) cannot run on a spoofed platform; check `SPOOFED`.
  - Sample files and expected output go in `tests/fixtures/`. Expected encoding output was produced with Python codecs; never use the app's own output as the expectation.
- **Interface text** uses words users know, not internal terms. Error messages say how to fix the problem. Translations follow the same rule.
- **Interface languages** (Traditional Chinese, English, Simplified Chinese, Vietnamese):
  - The interface follows the browser or system language by default (`systemLocale()` in `00-i18n.js`); Settings › Interface Language can override it.
  - **Source text and translation keys are English**, so developers who do not read Chinese can read and maintain them. Write interface text in JS as `tr("English text")`.
    With variables use `tr("Saved {name}", { name })`. Never build sentences by concatenation or template strings: word order differs between languages.
  - Text and title, aria-label and placeholder attributes in `src/markup.html` are translated at startup by the same keys. Any text containing a letter counts as
    interface text; for text that is the same in every language, such as `Hex` or `UTF-8`, add `translate="no"` to the element (it affects only the element's
    own text; title and other attributes are still translated).
  - After adding or changing text, add the translations to `src/i18n/zh-TW.json`, `zh-CN.json` and `vi.json`. `node build.mjs --i18n-todo` lists what is missing.
    The build checks that these three locales translate everything, that {…} placeholders match, that no entry is unused, and that code strings contain no Chinese.
  - `src/i18n/en.json` only holds entries whose English differs from the key: plural forms written as `{ "one": "…", "other": "…" }`, chosen by the variable n
    (the key is the other form), or a label that needs its own key because the same English is used elsewhere (e.g. key `Text column`, shown as `Text`).
  - Chinese in code that is not interface text (character ranges, character tables for encoding detection) needs an `i18n-ignore` comment on the same line.
  - The help page and the sample file are in `src/i18n/help/` and `src/i18n/sample/`, one per language. Change all four when changing the content.
  - Tests run with an English browser (locale en-US) by default and assert the English text; `open({ locale:"zh-TW" })` opens the page in another language.
  - The macOS app's menu text is in `macos/Sources/Localization.swift`, also keyed by English; document type names are in `macos/Resources/*.lproj`.
- **Commits**:
  - Personal project: commit and push straight to `main`, no branches or PRs. Before pushing, `git pull --rebase` and make sure `npm test` passes.
  - One change per commit.
  - Title in the English imperative; the body explains why.
  - A pure refactor proves the output is unchanged with `--compare`, or the body says what the tests cover.

## Publishing

- **Hosted page**: publish `dist/artifact/plainpad.html` together with `dist/artifact/vendor/` from a Claude conversation, updating the same URL
  `https://claude.ai/artifact/BA9cscx6RGLUrc2u1qtYZ5`. This can only be done from a Claude conversation.
- **Standalone file**: `dist/plainpad-standalone.html` can be given to anyone as is and works fully offline.
