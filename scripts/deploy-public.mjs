#!/usr/bin/env node
/**
 * Copy bản CHẠY ĐƯỢC của web sang thư mục repo public (GitHub Pages), rồi bạn tự
 * commit & push ở đó. Dùng danh sách CHO PHÉP: thứ gì không khai ở INCLUDE thì
 * không bao giờ ra repo public — quên khai file mới chỉ làm thiếu file (thấy ngay),
 * chứ không làm lộ key.
 *
 * Hai chế độ:
 *   --dist   → xuất ra <repo>/dist cho Cloudflare Pages build (xem docs/deploy-cloudflare-pages.md)
 *   mặc định → copy sang một thư mục repo khác trên máy để tự commit & push
 *
 * Cờ: --dry-run · --yes · --build (chạy npm run build trước) · --minify · --target=<đường dẫn>
 *     --env=<tên> → dựng bản cho môi trường khác production bằng cách NỐI
 *       `core/config.<tên>.js` vào cuối `core/config.js` (xem ENV_OVERRIDE).
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import readline from "node:readline";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CONFIG_FILE = path.join(ROOT, "deploy-public.config.json");

/* ---------------------------------------------------------------- danh mục */

// Mọi thứ trang web thật sự tải. Kết thúc bằng "/" = cả thư mục (file mới bên
// trong tự được lấy); còn lại là một file cụ thể.
const INCLUDE = [
  // Trang gốc + routing
  "index.html",
  "404.html",
  "router.html",
  "robots.txt",
  "sitemap.xml",
  // CNAME: chỉ GitHub Pages đọc để giữ custom domain. Cloudflare bỏ qua nó, nên
  // sau khi chuyển xong thì file này biến mất khỏi repo — vì vậy khai OPTIONAL.
  "CNAME",
  // Các trang con
  "checkout/",
  "theme-template/",
  "my-invitations/",
  "invitation-setup/",
  // Mã dùng chung + JS của landing
  "core/",
  "js/",
  // Thiệp
  "public/",
  // CHỈ hai bản CSS đã build — nguồn `_*.css` / `*-src.css` là việc của repo private
  "styles/build.css",
  "styles/themes.css",
  // Ảnh (trừ EXCLUDE bên dưới)
  "assets/",
];

// Mục trong INCLUDE được phép KHÔNG tồn tại. Mọi mục khác mà thiếu là dừng build
// — đó là cách bắt lỗi xoá/đổi tên file mà quên sửa INCLUDE.
const OPTIONAL = new Set(["CNAME"]);

// Loại trừ nằm BÊN TRONG một mục INCLUDE ở trên.
const EXCLUDE = [
  "assets/temp_img/", // ~153MB ảnh gốc, không trang nào tham chiếu
  "assets/data-template/README.md", // ghi chú nội bộ
  // Các file khác biệt môi trường: chúng được NỐI vào core/config.js khi có
  // --env, không bao giờ ra web thành file riêng (ra riêng thì không ai nạp,
  // chỉ tổ lộ URL của môi trường khác).
  "core/config.staging.js",
];

/**
 * --env=<tên> → nối `core/config.<tên>.js` vào cuối `core/config.js`.
 *
 * Cách này để MÃ NGUỒN KHÔNG phải rẽ nhánh theo môi trường: `core/config.js`
 * chỉ có giá trị production, file override chỉ khai những khoá khác đi. Lúc chạy
 * vẫn đúng MỘT file `core/config.js` nên 13 trang HTML và hai loader không phải
 * khai thêm thẻ <script> nào — quan trọng vì mẫu thiệp mới chép từ base-theme sẽ
 * tự đúng, khỏi phải nhớ.
 *
 * REDACT chạy TRƯỚC bước nối, nên purgeSecret của production vẫn bị che.
 */
const ENV_OVERRIDE = {
  file: "core/config.js",
  overrideFor: (env) => `core/config.${env}.js`,
};

// Không bao giờ đi vào các thư mục này, dù nằm ở đâu.
const SKIP_DIRS = new Set([".git", "node_modules", ".wrangler", ".temp"]);
const SKIP_NAMES = new Set([".DS_Store", "Thumbs.db", "desktop.ini"]);

// Giá trị bị che khi copy (bản gốc trong repo private giữ nguyên). Không khớp
// được thì script DỪNG — thà hỏng còn hơn im lặng đẩy secret lên public.
const REDACT = [
  {
    file: "core/config.js",
    find: /purgeSecret:\s*"[^"]*"/,
    replace: "purgeSecret: null",
    why: "chỉ admin/js/02-templates.js dùng, mà admin/ không lên repo public",
  },
];

// Thứ ở đích script KHÔNG được đụng vào (repo public tự quản lý).
const TARGET_KEEP = [
  ".git",
  ".github",
  ".gitignore",
  "LICENSE",
  "README.md",
  ".nojekyll",
];

const TEXT_EXT = new Set([
  ".html",
  ".js",
  ".mjs",
  ".css",
  ".json",
  ".txt",
  ".md",
  ".svg",
  ".xml",
]);

// Quét trước khi ghi. Khớp là DỪNG, không cho deploy.
const SECRET_PATTERNS = [
  [/service_role/i, "chuỗi service_role của Supabase"],
  [/SUPABASE_SERVICE_ROLE_KEY/, "tên biến service role key"],
  [/\bsbp_[0-9a-f]{40}\b/i, "Supabase access token (sbp_…)"],
  // Khoá Supabase định dạng MỚI. `sb_secret_…` tương đương service_role cũ, mà
  // nó KHÔNG phải JWT nên phép soi `role` ở dưới không bắt được — phải chặn
  // bằng tiền tố. (`sb_publishable_…` thì công khai, không chặn.)
  [/\bsb_secret_[A-Za-z0-9_-]{10,}\b/, "Supabase secret key (sb_secret_…)"],
  [
    /\b(ghp|gho|ghs)_[A-Za-z0-9]{20,}\b|\bgithub_pat_[A-Za-z0-9_]{20,}\b/,
    "GitHub token",
  ],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, "private key"],
  [/\bsk-[A-Za-z0-9_-]{20,}\b/, "API key dạng sk-…"],
  [/\bAIza[0-9A-Za-z_-]{30,}\b/, "Google API key"],
  [/CHECKSUM_KEY\s*[:=]\s*["'][^"']{8,}/i, "PayOS checksum key"],
  [/b900b06e5901b6671ed9b388e6143fd1/i, "Cloudflare account id"],
  [/SUPABASE_ACCESS_TOKEN\s*[:=]\s*["'][^"'$]{8,}/, "Supabase access token"],
];

// JWT nhúng trong bundle: anon key là công khai theo thiết kế, role khác thì không.
const JWT_RE = /eyJ[A-Za-z0-9_-]{8,}\.(eyJ[A-Za-z0-9_-]{8,})\.[A-Za-z0-9_-]{8,}/g;

/* ------------------------------------------------------------------ tiện ích */

const C = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

function fail(msg) {
  console.error(`\n${C.red("✖ " + msg)}\n`);
  process.exit(1);
}

function human(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const sha1 = (buf) => crypto.createHash("sha1").update(buf).digest("hex");

/**
 * Hỏi một câu ở terminal. KHÔNG được gọi khi không có TTY: stdin đóng thì callback
 * của readline không bao giờ chạy, promise treo, Node hết việc và thoát code 0 —
 * build "xanh" mà chẳng ghi gì. Chặn bằng requireTty() trước mỗi chỗ gọi.
 */
function ask(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((res) => {
    rl.question(question, (a) => (rl.close(), res(a.trim())));
    rl.on("close", () => res(""));
  });
}

function requireTty(what) {
  if (!process.stdin.isTTY) {
    fail(`Không có bàn phím để hỏi ${what}.\n  Trên CI hãy dùng: node scripts/deploy-public.mjs --dist --minify --yes`);
  }
}

/* ------------------------------------------------------------------- tham số */

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const valueOf = (f) => {
  const hit = args.find((a) => a.startsWith(`${f}=`));
  return hit ? hit.slice(f.length + 1) : null;
};
const OPT = {
  dryRun: has("--dry-run"),
  // --dist tự bật: nó ghi vào thư mục build của chính repo, không có gì để lỡ tay đè.
  // Quan trọng cho CI: stdin không phải TTY nên câu hỏi y/N sẽ tự trả lời rỗng.
  yes: has("--yes") || has("-y") || has("--dist"),
  build: has("--build"),
  dist: has("--dist"),
  minify: has("--minify"),
  target: valueOf("--target"),
  env: valueOf("--env"),
};

/* ----------------------------------------------------------------- cấu hình */

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
  } catch {
    return {};
  }
}

const saveConfig = (cfg) =>
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2) + "\n", "utf8");

/* ------------------------------------------------------- gom danh sách file */

function walk(relDir, out) {
  const abs = relDir ? path.join(ROOT, relDir) : ROOT;
  for (const ent of fs.readdirSync(abs, { withFileTypes: true })) {
    if (SKIP_NAMES.has(ent.name)) continue;
    const rel = relDir ? `${relDir}/${ent.name}` : ent.name;
    if (ent.isDirectory()) {
      if (SKIP_DIRS.has(ent.name)) continue;
      walk(rel, out);
    } else if (ent.isFile()) {
      out.push(rel);
    }
  }
}

const isExcluded = (rel) =>
  EXCLUDE.some((e) => (e.endsWith("/") ? rel.startsWith(e) : rel === e));

function collect() {
  const out = [];
  for (const entry of INCLUDE) {
    if (entry.endsWith("/")) {
      const dir = entry.slice(0, -1);
      if (!fs.existsSync(path.join(ROOT, dir)))
        fail(`INCLUDE trỏ vào thư mục không có: ${dir}`);
      walk(dir, out);
    } else {
      if (!fs.existsSync(path.join(ROOT, entry))) {
        if (OPTIONAL.has(entry)) continue;
        fail(`INCLUDE trỏ vào file không có: ${entry}`);
      }
      out.push(entry);
    }
  }
  return [...new Set(out)].filter((r) => !isExcluded(r)).sort();
}

/** Đọc file nguồn, áp REDACT nếu có. Cache để chỉ chạm đĩa một lần mỗi file. */
const bytesCache = new Map();
function sourceBytes(rel) {
  if (bytesCache.has(rel)) return bytesCache.get(rel);
  let buf = fs.readFileSync(path.join(ROOT, rel));
  for (const r of REDACT) {
    if (r.file !== rel) continue;
    const txt = buf.toString("utf8");
    if (!r.find.test(txt)) {
      fail(
        `Không tìm thấy đoạn cần che trong ${rel} (${r.why}).\n` +
          `  File nguồn đã đổi → sửa lại REDACT trong scripts/deploy-public.mjs rồi chạy lại.`,
      );
    }
    buf = Buffer.from(txt.replace(r.find, r.replace), "utf8");
  }

  // Nối phần khác biệt môi trường. Chạy SAU REDACT để purgeSecret của production
  // vẫn bị che trong bản staging.
  if (OPT.env && rel === ENV_OVERRIDE.file) {
    const over = ENV_OVERRIDE.overrideFor(OPT.env);
    const abs = path.join(ROOT, over);
    if (!fs.existsSync(abs)) {
      fail(
        `--env=${OPT.env} nhưng không có ${over}.\n` +
          `  Tạo file đó (chỉ khai khoá KHÁC production), hoặc bỏ cờ --env.`,
      );
    }
    buf = Buffer.concat([buf, Buffer.from("\n", "utf8"), fs.readFileSync(abs)]);
  }

  bytesCache.set(rel, buf);
  return buf;
}

/**
 * Bỏ comment HTML (20% dung lượng HTML của repo này), giữ nguyên phần còn lại.
 * KHÔNG dùng regex trần: quét tuần tự từ trái sang, ở mỗi bước xem `<!--` hay một
 * khối raw-text đến trước rồi mới xử lý — vì repo có cả `<!--` nằm trong `<script>`
 * lẫn comment chứa chữ `<style>`, làm sai thứ tự là cắt nhầm giữa thân file.
 * Conditional comment (`<!--[if`) giữ nguyên.
 */
function stripHtmlComments(src) {
  const RAW = /<(script|style|pre|textarea)\b[^>]*>/i;
  let out = "";
  let i = 0;
  while (i < src.length) {
    const rest = src.slice(i);
    const c = rest.indexOf("<!--");
    const m = rest.match(RAW);
    const r = m ? m.index : -1;

    if (c === -1 && r === -1) {
      out += rest;
      break;
    }
    // Khối raw-text đến trước → chép nguyên cả khối, không soi bên trong.
    if (c === -1 || (r !== -1 && r < c)) {
      const close = new RegExp(`</${m[1]}\\s*>`, "i");
      const after = rest.slice(r + m[0].length);
      const e = after.match(close);
      const end = e ? r + m[0].length + e.index + e[0].length : rest.length;
      out += rest.slice(0, end);
      i += end;
      continue;
    }
    // Comment đến trước.
    out += rest.slice(0, c);
    if (rest.startsWith("<!--[", c)) {
      out += "<!--[";
      i += c + 5;
      continue;
    }
    const e = rest.indexOf("-->", c + 4);
    if (e === -1) {
      out += rest.slice(c);
      break;
    }
    i += e + 3;
  }
  // Dòng chỉ còn khoảng trắng sau khi gỡ comment thì bỏ luôn.
  return out.replace(/^[ \t]+$\n?/gm, "");
}

/**
 * Rút gọn JS cho bản publish: bỏ comment, nén cú pháp, đổi tên biến CỤC BỘ.
 *
 * Hai cờ `toplevel` phải LUÔN là false. Các file ở đây là classic script chia sẻ
 * biến toàn cục (`CONFIG`, `CX_THEME`, `renderWedding`, `__cxOnReady`…): file này
 * khai, file kia gọi; tên còn bị gọi từ chuỗi HTML (`onclick="…"`), từ `new Function`
 * ở core/x-controls.js, và xuyên iframe (`contentWindow.applyThemeSetting`). terser
 * rút gọn TỪNG FILE nên không thấy các mối nối đó — bật toplevel là đổi tên ở một
 * file trong khi chỗ dùng vẫn giữ tên cũ, hoặc xoá hàm vì tưởng không ai gọi. Cả hai
 * chỉ gãy lúc chạy, build vẫn xanh. Muốn đổi được tên top-level thì phải gộp file vào
 * MỘT scope trước (bundle), không phải bật thêm cờ.
 * Nạp terser bằng dynamic import để khi không dùng --minify thì script chạy chay.
 */
async function minifyAll(files) {
  const mod = await import("terser");
  const minify = mod.minify ?? mod.default?.minify;
  if (!minify) fail("Không nạp được terser. Chạy `npm install` rồi thử lại.");

  const targets = files.filter((r) => r.endsWith(".js"));
  let before = 0;
  let after = 0;
  let html = 0;

  for (const rel of files.filter((r) => r.endsWith(".html"))) {
    const src = sourceBytes(rel).toString("utf8");
    const out = stripHtmlComments(src);
    html += Buffer.byteLength(src) - Buffer.byteLength(out);
    bytesCache.set(rel, Buffer.from(out, "utf8"));
  }

  // Chạy theo lô để không mở 115 tác vụ parse cùng lúc.
  const POOL = 8;
  for (let i = 0; i < targets.length; i += POOL) {
    await Promise.all(
      targets.slice(i, i + POOL).map(async (rel) => {
        const src = sourceBytes(rel).toString("utf8");
        let out;
        try {
          out = await minify(src, {
            compress: { toplevel: false },
            mangle: { toplevel: false },
            format: { comments: false },
            sourceMap: false,
          });
        } catch (e) {
          fail(`terser không parse được ${rel}: ${e?.message || e}`);
        }
        if (typeof out.code !== "string") fail(`terser trả về rỗng cho ${rel}`);
        before += Buffer.byteLength(src);
        after += Buffer.byteLength(out.code);
        bytesCache.set(rel, Buffer.from(out.code, "utf8"));
      }),
    );
  }
  return { count: targets.length, before, after, html };
}

/* ------------------------------------------------------------ các phép kiểm */

/** Quét secret trên NỘI DUNG SẼ GHI (tức là sau khi đã che). */
function scanSecrets(files) {
  const hits = [];
  for (const rel of files) {
    if (!TEXT_EXT.has(path.extname(rel).toLowerCase())) continue;
    const txt = sourceBytes(rel).toString("utf8");
    for (const [re, label] of SECRET_PATTERNS) {
      const m = txt.match(re);
      if (m) hits.push({ rel, label, sample: m[0].slice(0, 40) });
    }
    for (const m of txt.matchAll(JWT_RE)) {
      let payload;
      try {
        payload = JSON.parse(Buffer.from(m[1], "base64url").toString("utf8"));
      } catch {
        continue;
      }
      if (payload.role && payload.role !== "anon") {
        hits.push({
          rel,
          label: `JWT role="${payload.role}"`,
          sample: m[0].slice(0, 24) + "…",
        });
      }
    }
  }
  return hits;
}

/** Link tĩnh trong HTML trỏ tới file CÓ trong repo nhưng KHÔNG nằm trong bản public. */
function checkLinks(files) {
  const set = new Set(files);
  const missing = [];
  const attrRe = /(?:src|href)="([^"]+)"/g;
  for (const rel of files) {
    if (!rel.endsWith(".html")) continue;
    const txt = sourceBytes(rel).toString("utf8");
    const baseDir = path.posix.dirname(rel);
    for (const m of txt.matchAll(attrRe)) {
      const raw = m[1];
      if (/^(https?:|\/\/|data:|mailto:|tel:|#|javascript:)/i.test(raw)) continue;
      if (raw.includes("${") || raw.includes("{{")) continue;
      const clean = raw.split(/[?#]/)[0];
      if (!clean) continue;
      const target = clean.startsWith("/")
        ? clean.slice(1)
        : path.posix.normalize(path.posix.join(baseDir, clean));
      if (target.startsWith("..")) continue;
      if (set.has(target)) continue;
      // Trỏ vào thư mục thì coi như đủ khi có index.html của thư mục đó.
      if (set.has(path.posix.join(target, "index.html"))) continue;
      if (fs.existsSync(path.join(ROOT, target))) missing.push({ rel, raw });
    }
  }
  return missing;
}

/** build.css / themes.css cũ hơn nguồn của nó → Tailwind chưa build lại. */
function checkBuildFresh(files) {
  const mtime = (rel) => {
    try {
      return fs.statSync(path.join(ROOT, rel)).mtimeMs;
    } catch {
      return 0;
    }
  };
  const newestOf = (list) => list.reduce((max, rel) => Math.max(max, mtime(rel)), 0);

  const styleSrc = fs
    .readdirSync(path.join(ROOT, "styles"))
    .filter((f) => f.startsWith("_") || f.endsWith("-src.css"))
    .map((f) => `styles/${f}`);
  // Tailwind purge quét cả markup: sửa class trong HTML/JS cũng phải build lại.
  const markup = files.filter((r) => r.endsWith(".html") || r.endsWith(".js"));

  const stale = [];
  const appSrc = newestOf([
    ...styleSrc,
    "tailwind.config.js",
    "tailwind.fonts.js",
    ...markup,
  ]);
  if (mtime("styles/build.css") < appSrc) stale.push("styles/build.css");

  const themeSrc = newestOf([
    ...styleSrc,
    "tailwind.themes.config.js",
    "tailwind.fonts.js",
    ...files.filter((r) => r.startsWith("public/")),
  ]);
  if (mtime("styles/themes.css") < themeSrc) stale.push("styles/themes.css");
  return stale;
}

const readVersion = () =>
  fs
    .readFileSync(path.join(ROOT, "core/config.js"), "utf8")
    .match(/CX_VERSION\s*=\s*"([^"]+)"/)?.[1] ?? null;

/** Segment bắt đầu bằng "_" thì Jekyll của GitHub Pages không publish. */
const checkJekyll = (files) =>
  files.filter((r) => r.split("/").some((seg) => seg.startsWith("_")));

/* -------------------------------------------------------------- so với đích */

function listTarget(targetDir) {
  const out = [];
  const rec = (relDir) => {
    const abs = relDir ? path.join(targetDir, relDir) : targetDir;
    for (const ent of fs.readdirSync(abs, { withFileTypes: true })) {
      const rel = relDir ? `${relDir}/${ent.name}` : ent.name;
      if (TARGET_KEEP.includes(rel)) continue;
      if (ent.isDirectory()) {
        if (SKIP_DIRS.has(ent.name)) continue;
        rec(rel);
      } else if (ent.isFile()) {
        out.push(rel);
      }
    }
  };
  rec("");
  return out;
}

function buildPlan(files, targetDir) {
  const existing = new Set(listTarget(targetDir));
  const add = [];
  const update = [];
  for (const rel of files) {
    if (!existing.has(rel)) {
      add.push(rel);
      continue;
    }
    const src = sourceBytes(rel);
    const cur = fs.readFileSync(path.join(targetDir, rel));
    if (cur.length !== src.length || sha1(cur) !== sha1(src)) update.push(rel);
  }
  const wanted = new Set(files);
  const remove = [...existing].filter((rel) => !wanted.has(rel)).sort();
  return { add, update, remove };
}

function applyPlan(plan, targetDir) {
  for (const rel of [...plan.add, ...plan.update]) {
    const abs = path.join(targetDir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, sourceBytes(rel));
  }
  for (const rel of plan.remove) {
    fs.rmSync(path.join(targetDir, rel), { force: true });
  }
  pruneEmptyDirs(targetDir, "");
}

function pruneEmptyDirs(targetDir, relDir) {
  const abs = relDir ? path.join(targetDir, relDir) : targetDir;
  for (const ent of fs.readdirSync(abs, { withFileTypes: true })) {
    if (!ent.isDirectory()) continue;
    const rel = relDir ? `${relDir}/${ent.name}` : ent.name;
    if (TARGET_KEEP.includes(rel) || SKIP_DIRS.has(ent.name)) continue;
    pruneEmptyDirs(targetDir, rel);
    if (fs.readdirSync(path.join(targetDir, rel)).length === 0) {
      fs.rmdirSync(path.join(targetDir, rel));
    }
  }
}

/* --------------------------------------------------------------------- main */

async function resolveTarget(cfg) {
  // Chế độ CI của Cloudflare Pages: xuất ra <repo>/dist rồi Pages publish thư mục
  // đó. Đây là ngoại lệ DUY NHẤT của chốt "đích không được nằm trong repo".
  if (OPT.dist) {
    const dir = path.join(ROOT, "dist");
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  let target = OPT.target || cfg.target;
  if (!target) {
    console.log(
      C.dim(
        "\nChưa khai thư mục đích. Clone repo PUBLIC về máy trước, rồi dán đường dẫn thư mục đó vào đây." +
          "\nVí dụ: D:\\cuoixinh-public\n",
      ),
    );
    requireTty("thư mục đích");
    target = await ask("Thư mục repo public: ");
    if (!target) fail("Không có thư mục đích.");
  }
  target = path.resolve(target.replace(/^["']|["']$/g, ""));

  if (target === ROOT) fail("Thư mục đích trùng repo hiện tại.");
  const inside = path.relative(ROOT, target);
  if (inside && !inside.startsWith("..") && !path.isAbsolute(inside)) {
    fail(`Thư mục đích nằm BÊN TRONG repo hiện tại (${inside}) — chọn chỗ khác.`);
  }
  const back = path.relative(target, ROOT);
  if (back && !back.startsWith("..") && !path.isAbsolute(back)) {
    fail("Repo hiện tại nằm bên trong thư mục đích — chọn chỗ khác.");
  }
  if (!fs.existsSync(target) || !fs.statSync(target).isDirectory()) {
    fail(`Không thấy thư mục: ${target}\n  Clone repo public về đó trước rồi chạy lại.`);
  }
  return target;
}

async function main() {
  const cfg = loadConfig();
  const target = await resolveTarget(cfg);

  if (OPT.build) {
    console.log(C.dim("\n› npm run build"));
    execFileSync("npm", ["run", "build"], {
      cwd: ROOT,
      stdio: "inherit",
      shell: true,
    });
  }

  const files = collect();
  const version = readVersion();

  // Rút gọn TRƯỚC khi quét: quét phải soi đúng nội dung sẽ ghi ra đĩa.
  const min = OPT.minify ? await minifyAll(files) : null;

  // Quét secret TRƯỚC mọi thứ khác — đây là phép chặn, không phải cảnh báo.
  const secrets = scanSecrets(files);
  if (secrets.length) {
    console.error(C.red("\n✖ Phát hiện thứ giống secret trong bản sắp đẩy public:\n"));
    for (const h of secrets)
      console.error(`   ${h.rel}  →  ${h.label}  ${C.dim(h.sample)}`);
    console.error(
      C.dim(
        "\n  Gỡ giá trị đó ra, hoặc thêm vào REDACT trong scripts/deploy-public.mjs." +
          "\n  Không deploy khi còn dòng nào ở trên.\n",
      ),
    );
    process.exit(1);
  }

  const plan = buildPlan(files, target);
  const totalBytes = files.reduce((n, rel) => n + sourceBytes(rel).length, 0);

  const warns = [];
  if (version && cfg.lastVersion === version) {
    warns.push(
      `CX_VERSION vẫn là ${version} — y hệt lần deploy trước. Người dùng có thể nhận bản TRỘN ` +
        `(partial mới + script cũ). Đổi CX_VERSION trong core/config.js trước khi đẩy.`,
    );
  }
  for (const f of checkBuildFresh(files)) {
    warns.push(`${f} cũ hơn nguồn của nó — chạy \`npm run build\` (hoặc thêm cờ --build).`);
  }
  for (const m of checkLinks(files)) {
    warns.push(
      `${m.rel} trỏ tới "${m.raw}" — file có trong repo nhưng KHÔNG nằm trong bản public.`,
    );
  }
  for (const f of checkJekyll(files)) {
    warns.push(`${f} có tên bắt đầu bằng "_" — GitHub Pages (Jekyll) sẽ không publish.`);
  }

  console.log(`\n${C.bold("Triển khai sang repo public")}`);
  console.log(`  Nguồn  : ${ROOT}`);
  console.log(`  Đích   : ${target}`);
  if (!fs.existsSync(path.join(target, ".git"))) {
    console.log(C.yellow("           (thư mục này chưa phải git repo)"));
  }
  console.log(
    `  Version: ${version ?? "?"}${cfg.lastVersion ? C.dim(`   (lần trước: ${cfg.lastVersion})`) : ""}`,
  );
  console.log(`\n  ${files.length} file được chọn · ${human(totalBytes)}`);
  console.log(
    `  ${C.green(`+${plan.add.length} thêm`)}   ${C.cyan(`~${plan.update.length} ghi đè`)}   ${C.red(`-${plan.remove.length} xoá ở đích`)}`,
  );

  if (min) {
    const cut = ((1 - min.after / min.before) * 100).toFixed(0);
    console.log(
      `  ${C.bold("Rút gọn")}: ${min.count} file JS · ${human(min.before)} → ${human(min.after)} (-${cut}%)` +
        `  ·  HTML bỏ ${human(min.html)} comment` +
        C.dim("\n           (giữ nguyên tên hàm/biến — xem docs/deploy-cloudflare-pages.md §7)"),
    );
  }

  if (OPT.env) {
    console.log(
      `\n  ${C.bold("Môi trường")}: ${OPT.env}` +
        C.dim(`  (nối ${ENV_OVERRIDE.overrideFor(OPT.env)} vào cuối ${ENV_OVERRIDE.file})`),
    );
  }

  if (REDACT.length) {
    console.log(`\n  ${C.bold("Che khi copy")}`);
    for (const r of REDACT)
      console.log(`   ${r.file} → ${r.replace}  ${C.dim("(" + r.why + ")")}`);
  }
  console.log(`\n  ${C.bold("Không copy")}`);
  console.log(
    C.dim(
      "   admin/ · scripts/ · supabase/ · cloudflare-worker/ · changelogs/ · docs/ · documents/\n" +
        "   .kiro/ · .claude/ · .vscode/ · .mcp.json · encrypt.md · CLAUDE.md · README.md\n" +
        "   package*.json · tailwind*.js · styles/_*.css · styles/*-src.css · assets/temp_img/",
    ),
  );

  const show = (label, list, color) => {
    if (!list.length) return;
    console.log(`\n  ${color(label)} (${list.length})`);
    for (const rel of list.slice(0, 15)) console.log(`   ${rel}`);
    if (list.length > 15) console.log(C.dim(`   … còn ${list.length - 15} file`));
  };
  show("Thêm", plan.add, C.green);
  show("Ghi đè", plan.update, C.cyan);
  show("XOÁ ở đích", plan.remove, C.red);

  if (warns.length) {
    console.log(`\n  ${C.yellow("⚠ Cảnh báo")}`);
    for (const w of warns) console.log(`   ${C.yellow("•")} ${w}`);
  }

  if (!plan.add.length && !plan.update.length && !plan.remove.length) {
    console.log(C.green("\n✔ Thư mục đích đã khớp, không có gì phải làm.\n"));
    return;
  }
  if (OPT.dryRun) {
    console.log(C.dim("\n--dry-run: chưa ghi gì cả.\n"));
    return;
  }
  if (!OPT.yes) {
    requireTty("xác nhận ghi");
    const a = await ask(`\n${C.bold("Ghi vào thư mục đích? [y/N] ")}`);
    if (!/^y(es)?$/i.test(a)) {
      console.log(C.dim("Đã huỷ.\n"));
      return;
    }
  }

  applyPlan(plan, target);
  // Chế độ --dist không ghi nhớ gì: máy build của CI là thư mục dùng một lần, và
  // ghi vào đây sẽ đè mất đường dẫn repo public mà chế độ copy đang dùng.
  if (!OPT.dist) {
    cfg.target = target;
    cfg.lastVersion = version;
    cfg.lastDeployAt = new Date().toISOString();
    saveConfig(cfg);
  }

  console.log(
    C.green(
      `\n✔ Xong. Ghi ${plan.add.length + plan.update.length} file, xoá ${plan.remove.length} file.`,
    ),
  );
  if (OPT.dist) {
    console.log(C.dim("\n  Thư mục dist/ sẵn sàng cho Cloudflare Pages.\n"));
    return;
  }
  console.log("\n  Đẩy lên GitHub:\n");
  console.log(C.dim(`    git -C "${target}" add -A`));
  console.log(C.dim(`    git -C "${target}" commit -m "deploy ${version ?? ""}"`));
  console.log(C.dim(`    git -C "${target}" push\n`));
}

main().catch((e) => fail(e?.stack || String(e)));
