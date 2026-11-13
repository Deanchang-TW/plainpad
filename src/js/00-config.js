const $ = s => document.querySelector(s);
const Pos = CodeMirror.Pos;
const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent);
const STORE_KEY = "plainpad.session.v2", OLD_STORE_KEY = "plainpad.session.v1";
const EOLS = { LF: "\n", CRLF: "\r\n", CR: "\r" };
const EOL_LABEL = { LF: "Unix (LF)", CRLF: "Windows (CR LF)", CR: tr("Classic Mac (CR)") };
const DL_EXT = new Set("txt json md csv html svg gif png jpg jpeg webp pdf zip docx pptx xlsx epub ttf mp4 webm".split(" "));
const BM = "pp-bookmarks", FG = "pp-folds";
const NATIVE = !!(window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.plainpad);   // inside the macOS app (macos/)
const LOCAL = !!window.__ppLocal || NATIVE;   // standalone file or native app: files go straight to disk, no extension restrictions
const HELP_NAME = tr("Plainpad Help.md");

/* group: heading in the Language menu and the status-bar list. ext: extensions, or whole file names such as "dockerfile" (lower case).
   alias: extra names a Markdown code block may use (```rust). Ids are stored with each tab, so never rename one. */
const LANGS = [
  { id:"text", group:tr("General"), label:tr("Plain text"), mode:"text/plain", ext:["txt","log","text"] },
  { id:"md", group:tr("General"), label:"Markdown", mode:"text/x-markdown", ext:["md","markdown","mdx"] },
  { id:"rst", group:tr("General"), label:"reStructuredText", mode:"text/x-rst", ext:["rst"] },
  { id:"latex", group:tr("General"), label:"LaTeX", mode:"text/x-stex", ext:["tex","sty","cls","ltx","latex"], alias:["stex"] },
  { id:"diff", group:tr("General"), label:"Diff / Patch", mode:"text/x-diff", ext:["diff","patch","rej"] },

  { id:"html", group:tr("Web"), label:"HTML", mode:"htmlmixed", ext:["html","htm","xhtml","cshtml","razor","vue"] },
  { id:"xml", group:tr("Web"), label:"XML", mode:"application/xml", ext:["xml","svg","xaml","csproj","vbproj","fsproj","sln","config","plist","resx","xsd","xsl","xslt","storyboard","xib","wsdl"] },
  { id:"css", group:tr("Web"), label:"CSS", mode:"text/css", ext:["css"] },
  { id:"scss", group:tr("Web"), label:"SCSS", mode:"text/x-scss", ext:["scss"] },
  { id:"sass", group:tr("Web"), label:"Sass", mode:"text/x-sass", ext:["sass"] },
  { id:"less", group:tr("Web"), label:"Less", mode:"text/x-less", ext:["less"] },
  { id:"js", group:tr("Web"), label:"JavaScript", mode:"text/javascript", ext:["js","mjs","cjs"], alias:["javascript","node"] },
  { id:"jsx", group:tr("Web"), label:"JavaScript (JSX)", mode:"text/jsx", ext:["jsx"] },
  { id:"ts", group:tr("Web"), label:"TypeScript", mode:"text/typescript", ext:["ts","mts","cts"], alias:["typescript"] },
  { id:"tsx", group:tr("Web"), label:"TypeScript (TSX)", mode:"text/typescript-jsx", ext:["tsx"] },
  { id:"json", group:tr("Web"), label:"JSON", mode:"application/json", ext:["json","jsonc","json5","geojson","webmanifest","arb"] },
  { id:"php", group:tr("Web"), label:"PHP", mode:"application/x-httpd-php", ext:["php","phtml","php3","php4","php5","phps"] },
  { id:"jinja", group:tr("Web"), label:"Jinja2 / Twig", mode:"text/jinja2", ext:["j2","jinja","jinja2","twig"], alias:["twig"] },

  { id:"c", group:tr("C family and compiled"), label:"C", mode:"text/x-csrc", ext:["c","h"] },
  { id:"cpp", group:tr("C family and compiled"), label:"C++", mode:"text/x-c++src", ext:["cpp","cc","cxx","c++","hpp","hh","hxx","h++","ino"] },
  { id:"cs", group:tr("C family and compiled"), label:"C#", mode:"text/x-csharp", ext:["cs","csx"], alias:["csharp","c#"] },
  { id:"objc", group:tr("C family and compiled"), label:"Objective-C", mode:"text/x-objectivec", ext:["m","mm"], alias:["objectivec","objective-c"] },
  { id:"java", group:tr("C family and compiled"), label:"Java", mode:"text/x-java", ext:["java"] },
  { id:"kotlin", group:tr("C family and compiled"), label:"Kotlin", mode:"text/x-kotlin", ext:["kt","kts"] },
  { id:"scala", group:tr("C family and compiled"), label:"Scala", mode:"text/x-scala", ext:["scala","sc","sbt"] },
  { id:"groovy", group:tr("C family and compiled"), label:"Groovy / Gradle", mode:"text/x-groovy", ext:["groovy","gvy","gradle","jenkinsfile"] },
  { id:"swift", group:tr("C family and compiled"), label:"Swift", mode:"text/x-swift", ext:["swift"] },
  { id:"dart", group:tr("C family and compiled"), label:"Dart", mode:"application/dart", ext:["dart"] },
  { id:"go", group:tr("C family and compiled"), label:"Go", mode:"text/x-go", ext:["go"], alias:["golang"] },
  { id:"rust", group:tr("C family and compiled"), label:"Rust", mode:"text/x-rustsrc", ext:["rs"] },
  { id:"vb", group:tr("C family and compiled"), label:"Visual Basic .NET", mode:"text/x-vb", ext:["vb","bas","frm"], alias:["vbnet","vb.net"] },
  { id:"pascal", group:tr("C family and compiled"), label:"Pascal / Delphi", mode:"text/x-pascal", ext:["pas","pp","dpr","dpk","lpr"], alias:["delphi"] },
  { id:"fortran", group:tr("C family and compiled"), label:"Fortran", mode:"text/x-fortran", ext:["f","for","f77","f90","f95","f03","f08"] },
  { id:"cobol", group:tr("C family and compiled"), label:"COBOL", mode:"text/x-cobol", ext:["cbl","cob","cpy"] },
  { id:"asm", group:tr("C family and compiled"), label:tr("Assembly (GAS)"), mode:"gas", ext:["s","asm"], alias:["assembly","gas","nasm"] },

  { id:"py", group:tr("Scripting"), label:"Python", mode:"text/x-python", ext:["py","pyw","pyi","gyp"], alias:["python"] },
  { id:"ruby", group:tr("Scripting"), label:"Ruby", mode:"text/x-ruby", ext:["rb","rake","gemspec","ru","podspec","gemfile","rakefile","podfile","fastfile","appfile","matchfile","brewfile","vagrantfile"], alias:["rb"] },
  { id:"perl", group:tr("Scripting"), label:"Perl", mode:"text/x-perl", ext:["pl","pm"] },
  { id:"lua", group:tr("Scripting"), label:"Lua", mode:"text/x-lua", ext:["lua"] },
  { id:"r", group:tr("Scripting"), label:"R", mode:"text/x-rsrc", ext:["r","rprofile"] },
  { id:"julia", group:tr("Scripting"), label:"Julia", mode:"text/x-julia", ext:["jl"] },
  { id:"ps", group:tr("Scripting"), label:"PowerShell", mode:"application/x-powershell", ext:["ps1","psm1","psd1"], alias:["powershell","pwsh","ps1"] },
  { id:"sh", group:tr("Scripting"), label:"Shell", mode:"text/x-sh", ext:["sh","bash","zsh","ksh","command","bashrc","zshrc","bash_profile","zprofile","profile","makefile","gnumakefile","mk"], alias:["shell","console","shellscript"] },
  { id:"vbs", group:tr("Scripting"), label:"VBScript", mode:"text/vbscript", ext:["vbs","vbe","wsf"], alias:["vbscript"] },
  { id:"tcl", group:tr("Scripting"), label:"Tcl", mode:"text/x-tcl", ext:["tcl","tk"] },

  { id:"haskell", group:tr("Functional"), label:"Haskell", mode:"text/x-haskell", ext:["hs"] },
  { id:"erlang", group:tr("Functional"), label:"Erlang", mode:"text/x-erlang", ext:["erl","hrl"] },
  { id:"clojure", group:tr("Functional"), label:"Clojure", mode:"text/x-clojure", ext:["clj","cljs","cljc","edn"] },
  { id:"fsharp", group:tr("Functional"), label:"F#", mode:"text/x-fsharp", ext:["fs","fsi","fsx"], alias:["f#"] },
  { id:"ocaml", group:tr("Functional"), label:"OCaml", mode:"text/x-ocaml", ext:["ml","mli"] },

  { id:"sql", group:tr("Databases"), label:tr("SQL (standard)"), mode:"text/x-sql", ext:["sql","ddl"] },
  { id:"mssql", group:tr("Databases"), label:tr("T-SQL (SQL Server)"), mode:"text/x-mssql", ext:[], alias:["tsql","t-sql"] },
  { id:"mysql", group:tr("Databases"), label:"MySQL", mode:"text/x-mysql", ext:[] },
  { id:"pgsql", group:tr("Databases"), label:"PostgreSQL", mode:"text/x-pgsql", ext:["pgsql","psql"], alias:["postgres","postgresql"] },
  { id:"plsql", group:tr("Databases"), label:tr("PL/SQL (Oracle)"), mode:"text/x-plsql", ext:["pls","pkb","pks","pck"], alias:["oracle"] },
  { id:"sqlite", group:tr("Databases"), label:"SQLite", mode:"text/x-sqlite", ext:[] },

  { id:"yaml", group:tr("Config and data"), label:"YAML", mode:"text/x-yaml", ext:["yml","yaml","pubspec.lock","podfile.lock","pnpm-lock.yaml"] },
  { id:"toml", group:tr("Config and data"), label:"TOML", mode:"text/x-toml", ext:["toml","cargo.lock","poetry.lock","pipfile"] },
  { id:"ini", group:tr("Config and data"), label:"INI / Properties", mode:"text/x-properties", ext:["ini","properties","conf","cfg","env","editorconfig","gitignore","gitattributes","npmrc","dockerignore"] },
  { id:"docker", group:tr("Config and data"), label:"Dockerfile", mode:"text/x-dockerfile", ext:["dockerfile","containerfile"] },
  { id:"nginx", group:tr("Config and data"), label:tr("Nginx config"), mode:"text/x-nginx-conf", ext:["nginx","nginx.conf"] },
  { id:"cmake", group:tr("Config and data"), label:"CMake", mode:"text/x-cmake", ext:["cmake","cmakelists.txt"] },
  { id:"proto", group:tr("Config and data"), label:"Protocol Buffers", mode:"text/x-protobuf", ext:["proto"], alias:["protobuf"] },
  { id:"gherkin", group:tr("Config and data"), label:tr("Gherkin (BDD tests)"), mode:"text/x-feature", ext:["feature"], alias:["cucumber"] },

  { id:"verilog", group:tr("Hardware description"), label:"Verilog", mode:"text/x-verilog", ext:["v","vh"] },
  { id:"sv", group:tr("Hardware description"), label:"SystemVerilog", mode:"text/x-systemverilog", ext:["sv","svh"], alias:["systemverilog"] },
  { id:"vhdl", group:tr("Hardware description"), label:"VHDL", mode:"text/x-vhdl", ext:["vhd","vhdl"] }
];
const LANG = Object.fromEntries(LANGS.map(l => [l.id, l]));
const ENCODINGS = [
  ["utf-8","UTF-8"],["big5",tr("Big5 (Traditional Chinese)")],["gb18030",tr("GB18030 (Simplified Chinese)")],["shift_jis",tr("Shift_JIS (Japanese)")],
  ["euc-kr",tr("EUC-KR (Korean)")],["utf-16le","UTF-16 LE"],["utf-16be","UTF-16 BE"],["windows-1252",tr("Windows-1252 (Western European)")]
];

const settings = { uiLang:"auto", wrap:false, ws:false, lineNumbers:true, fontSize:14, theme:"system", useTabs:true, tabSize:4,
  autoComplete:true, autoClose:false, smartHighlight:true, macros:[], lastMacro:null, filesFilter:"", skipDirs:true, mdPreview:false, mdSync:true, icons:"color", foldStyle:"guides", hexCols:16, hexEnc:"ascii", hexInsp:true, hexLE:true };
let tabs = [], active = -1, seq = 1;
let hitMarks = [];
let quiet = 0;

