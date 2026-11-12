const $ = s => document.querySelector(s);
const Pos = CodeMirror.Pos;
const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent);
const STORE_KEY = "plainpad.session.v2", OLD_STORE_KEY = "plainpad.session.v1";
const EOLS = { LF: "\n", CRLF: "\r\n", CR: "\r" };
const EOL_LABEL = { LF: "Unix (LF)", CRLF: "Windows (CR LF)", CR: "Mac 舊式 (CR)" };
const DL_EXT = new Set("txt json md csv html svg gif png jpg jpeg webp pdf zip docx pptx xlsx epub ttf mp4 webm".split(" "));
const BM = "pp-bookmarks", FG = "pp-folds";
const LOCAL = !!window.__ppLocal;   // standalone file opened from disk: ordinary browser downloads, no extension restrictions
const HELP_NAME = "Plainpad 說明.md";

const LANGS = [
  { id:"text", label:"純文字", mode:"text/plain", ext:["txt","log","text"] },
  { id:"c", label:"C", mode:"text/x-csrc", ext:["c","h"] },
  { id:"cpp", label:"C++", mode:"text/x-c++src", ext:["cpp","cc","cxx","hpp","hh","hxx","ino"] },
  { id:"cs", label:"C#", mode:"text/x-csharp", ext:["cs","csx"] },
  { id:"java", label:"Java", mode:"text/x-java", ext:["java"] },
  { id:"kotlin", label:"Kotlin", mode:"text/x-kotlin", ext:["kt","kts"] },
  { id:"js", label:"JavaScript", mode:"text/javascript", ext:["js","mjs","cjs"] },
  { id:"jsx", label:"JavaScript (JSX)", mode:"text/jsx", ext:["jsx"] },
  { id:"ts", label:"TypeScript", mode:"text/typescript", ext:["ts","mts","cts"] },
  { id:"tsx", label:"TypeScript (TSX)", mode:"text/typescript-jsx", ext:["tsx"] },
  { id:"json", label:"JSON", mode:"application/json", ext:["json","jsonc","geojson"] },
  { id:"html", label:"HTML", mode:"htmlmixed", ext:["html","htm","cshtml","razor","vue"] },
  { id:"xml", label:"XML", mode:"application/xml", ext:["xml","svg","xaml","csproj","sln","config","plist","resx","xsd","xsl"] },
  { id:"css", label:"CSS", mode:"text/css", ext:["css"] },
  { id:"scss", label:"SCSS", mode:"text/x-scss", ext:["scss"] },
  { id:"sql", label:"SQL（標準）", mode:"text/x-sql", ext:["sql","ddl"] },
  { id:"mssql", label:"T-SQL（SQL Server）", mode:"text/x-mssql", ext:[] },
  { id:"mysql", label:"MySQL", mode:"text/x-mysql", ext:[] },
  { id:"pgsql", label:"PostgreSQL", mode:"text/x-pgsql", ext:["pgsql","psql"] },
  { id:"py", label:"Python", mode:"text/x-python", ext:["py","pyw"] },
  { id:"go", label:"Go", mode:"text/x-go", ext:["go"] },
  { id:"md", label:"Markdown", mode:"text/x-markdown", ext:["md","markdown","mdx"] },
  { id:"sh", label:"Shell", mode:"text/x-sh", ext:["sh","bash","zsh","command"] },
  { id:"yaml", label:"YAML", mode:"text/x-yaml", ext:["yml","yaml"] },
  { id:"ini", label:"INI / Properties", mode:"text/x-properties", ext:["ini","properties","conf","cfg","env","toml","editorconfig","gitignore"] }
];
const LANG = Object.fromEntries(LANGS.map(l => [l.id, l]));
const ENCODINGS = [
  ["utf-8","UTF-8"],["big5","Big5（繁體中文）"],["gb18030","GB18030（簡體中文）"],["shift_jis","Shift_JIS（日文）"],
  ["euc-kr","EUC-KR（韓文）"],["utf-16le","UTF-16 LE"],["utf-16be","UTF-16 BE"],["windows-1252","Windows-1252（西歐）"]
];

const settings = { wrap:false, ws:false, lineNumbers:true, fontSize:14, theme:"system", useTabs:true, tabSize:4,
  autoComplete:true, autoClose:false, smartHighlight:true, macros:[], lastMacro:null, filesFilter:"", skipDirs:true, mdPreview:false, mdSync:true, icons:"color", foldStyle:"guides", hexCols:16, hexEnc:"ascii", hexInsp:true, hexLE:true };
let tabs = [], active = -1, seq = 1;
let hitMarks = [];
let quiet = 0;

