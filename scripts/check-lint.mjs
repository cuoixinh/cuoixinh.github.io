// Kiểm tĩnh các ràng buộc "làm sai là hỏng/mất dữ liệu" của CLAUDE.md
// (npm run check:lint, thêm --verbose để in cả luật đạt). Chỉ đọc file, không
// cần mạng. ID luật khớp mục LINT-xx của testcase_all.md. Luật gắn `known` là
// lệch đã ghi nhận ở mục 9 của file đó: trượt thì in KNOWN, không làm thoát mã 1.
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const R = fileURLToPath(new URL("..", import.meta.url));
const VERBOSE = process.argv.includes("--verbose");
const read = (f) => fs.readFileSync(path.join(R, f), "utf8");
const exists = (f) => fs.existsSync(path.join(R, f));
const J = JSON.stringify;
const noComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");
const tracked = execSync("git ls-files", { cwd: R, encoding: "utf8" }).split("\n").filter(Boolean);

// Lấy số nguyên khai bằng `NAME = 123` / `NAME: 123` trong một file.
function num(file, name) {
  const m = read(file).match(new RegExp(`\\b${name}\\s*[:=]\\s*(\\d+)`));
  if (!m) throw new Error(`${file}: không thấy ${name}`);
  return Number(m[1]);
}
// Lấy các chuỗi trong mảng `const NAME = [ … ]`.
function strArray(file, name) {
  const s = read(file);
  const i = s.search(new RegExp(`const ${name}\\s*=\\s*(new Set\\()?\\[`));
  if (i < 0) throw new Error(`${file}: không thấy mảng ${name}`);
  const body = s.slice(s.indexOf("[", i), s.indexOf("]", s.indexOf("[", i)) + 1);
  return [...noComments(body).matchAll(/["'`]([^"'`]+)["'`]/g)].map((m) => m[1]);
}
// Mảng bash `NAME=( … )`, mỗi phần tử có thể kèm comment `# …` (comment chứa
// ngoặc tròn nên phải bỏ comment TỪNG DÒNG trước khi tìm dấu đóng).
function bashArray(file, name) {
  const lines = read(file).split("\n");
  const i = lines.findIndex((l) => new RegExp(`^${name}=\\(`).test(l));
  if (i < 0) throw new Error(`${file}: không thấy ${name}=(…)`);
  const out = [];
  for (let k = i; k < lines.length; k++) {
    let l = lines[k].replace(/#.*$/, "");
    if (k === i) l = l.slice(l.indexOf("(") + 1);
    const end = l.indexOf(")");
    out.push(...(end >= 0 ? l.slice(0, end) : l).split(/\s+/).filter(Boolean));
    if (end >= 0) break;
  }
  return out;
}
// Thẻ <script …> kể cả khi viết trên nhiều dòng.
const scriptTags = (html) => [...html.matchAll(/<script\b[^>]*>/g)].map((m) => m[0]);

// ---------------- Khung chạy luật ----------------
const results = [];
function rule(id, title, body, opts = {}) {
  let r;
  try {
    r = body();
  } catch (e) {
    r = { pass: false, got: "THROW " + (e.stack || e) };
  }
  results.push({ id, title, known: opts.known, ...r });
}
const ok = (got) => ({ pass: true, got });
const bad = (list, okText) => ({ pass: list.length === 0, got: list.length ? list.join("\n        ") : okText });

const CFG = "core/config.js";
const WA = "supabase/functions/wedding-admin/index.ts";
const GH = "supabase/functions/guest-handler/index.ts";
const THEMES = fs.readdirSync(path.join(R, "public/themes"))
  .filter((t) => fs.statSync(path.join(R, "public/themes", t)).isDirectory());
const SOLD = THEMES.filter((t) => t !== "base-theme");

// ================= Hằng số khai ở hai nơi =================
rule("LINT-01", "CONFIG.maxWeddings = MAX_WEDDINGS_PER_USER", () => {
  const a = num(CFG, "maxWeddings"), b = num("supabase/functions/_shared/wedding-limits.ts", "MAX_WEDDINGS_PER_USER");
  return { pass: a === b, got: `client ${a} · server ${b}` };
});
rule("LINT-02", "CONFIG.retention (unpaid/serverDraft) = mặc định RETENTION_DAYS của cleanup", () => {
  const u = num(CFG, "unpaidDays"), d = num(CFG, "serverDraftDays");
  const m = read("supabase/functions/cleanup-weddings/index.ts").match(/RETENTION_DAYS'\)\s*\?\?\s*'(\d+)'/);
  const s = m && Number(m[1]);
  return { pass: u === s && d === s, got: `unpaidDays ${u} · serverDraftDays ${d} · RETENTION_DAYS mặc định ${s} (biến môi trường thật phải soi ở Dashboard)` };
});
rule("LINT-03", "CONFIG.trialDays = số ngày dùng thử server cộng vào expires_at", () => {
  const a = num(CFG, "trialDays");
  const m = read(WA).match(/expiresAt\.setDate\(expiresAt\.getDate\(\)\s*\+\s*(\d+)\)/);
  return { pass: m && Number(m[1]) === a, got: `client ${a} · server ${m?.[1]}` };
});
rule("LINT-04", "Trần khách mời / lời chúc khớp client ↔ guest-handler", () => {
  const pairs = [
    ["CONFIG.guestImport.maxRows", num(CFG, "maxRows"), "MAX_PER_SIDE", num(GH, "MAX_PER_SIDE")],
    ["CONFIG.guestImport.maxFieldLength", num(CFG, "maxFieldLength"), "MAX_FIELD_LEN", num(GH, "MAX_FIELD_LEN")],
    ["CONFIG.guestImport.batchSize", num(CFG, "batchSize"), "BATCH_SIZE", num(GH, "BATCH_SIZE")],
    ["CX_WISH_MAX", num("core/helpers/wishes-helper.js", "CX_WISH_MAX"), "MAX_WISHES_PER_GUEST", num(GH, "MAX_WISHES_PER_GUEST")],
    ["CX_WISH_MAX_LEN", num("core/helpers/wishes-helper.js", "CX_WISH_MAX_LEN"), "MAX_WISH_LEN", num(GH, "MAX_WISH_LEN")],
  ];
  return bad(pairs.filter(([, a, , b]) => a !== b).map(([n1, a, n2, b]) => `${n1}=${a} ≠ ${n2}=${b}`),
    pairs.map(([n1, a]) => `${n1}=${a}`).join(" · "));
});
rule("LINT-05", "Trần album / chuyện tình / lịch trình = MAX_ITEMS của wedding-admin", () => {
  const server = num(WA, "MAX_ITEMS");
  const c = {
    "CONFIG.maxLoveStoryItems": num(CFG, "maxLoveStoryItems"),
    MAX_GALLERY_IMAGES: num("invitation-setup/js/10-images.js", "MAX_GALLERY_IMAGES"),
  };
  return bad(Object.entries(c).filter(([, v]) => v !== server).map(([k, v]) => `${k}=${v} ≠ ${server}`), `${J(c)} = ${server}`);
});

// ================= Miền / host =================
rule("LINT-06", "Ba ALLOWED_ORIGINS giống hệt; ALLOWED_BASE_URLS của payment-handler nằm trong đó", () => {
  const files = ["supabase/functions/_shared/ai-provider.ts", WA, GH];
  const sets = files.map((f) => strArray(f, "ALLOWED_ORIGINS").sort());
  const out = [];
  for (let i = 1; i < sets.length; i++) if (J(sets[i]) !== J(sets[0])) out.push(`${files[i]} lệch ${files[0]}`);
  const base = strArray("supabase/functions/payment-handler/index.ts", "ALLOWED_BASE_URLS");
  for (const b of base) if (!sets[0].includes(b)) out.push(`ALLOWED_BASE_URLS có ${b} nhưng ALLOWED_ORIGINS không có`);
  return bad(out, `${sets[0].length} origin khớp ở 3 nơi · ${base.length} base URL đều có mặt`);
});
rule("LINT-07", "Cột ảnh khách sửa được có mặt ở wedding-images.ts + IMAGE_FIELDS", () => {
  const editable = strArray(WA, "CUSTOMER_EDITABLE_FIELDS");
  const imageCols = editable.filter((f) => /_(image|qr)_url$/.test(f));
  const cols = strArray("supabase/functions/_shared/wedding-images.ts", "IMAGE_COLUMNS");
  const fields = strArray(WA, "IMAGE_FIELDS");
  const wi = read("supabase/functions/_shared/wedding-images.ts");
  const out = [];
  for (const c of imageCols) {
    if (!cols.includes(c)) out.push(`${c} thiếu ở IMAGE_COLUMNS (ảnh nằm lại bucket vĩnh viễn)`);
    if (!fields.includes(c)) out.push(`${c} thiếu ở IMAGE_FIELDS (tráo được ảnh/QR)`);
  }
  if (editable.includes("gallery_images") && !/gallery_images/.test(wi)) out.push("gallery_images không được gom");
  if (editable.includes("love_story") && !/love_story/.test(wi)) out.push("love_story[].image_url không được gom");
  return bad(out, `${imageCols.length} cột ảnh + gallery_images + love_story đều được khai`);
});
rule("LINT-31", "ALLOWED_IMAGE_HOSTS có đủ host Supabase + proxy ảnh của cả hai môi trường", () => {
  const hosts = strArray(WA, "ALLOWED_IMAGE_HOSTS");
  const want = new Set();
  for (const f of [CFG, "core/config.staging.js"]) {
    const s = read(f);
    const ref = s.match(/const REF\s*=\s*["']([a-z0-9]+)["']/);
    if (ref) want.add(`${ref[1]}.supabase.co`);
    for (const m of s.matchAll(/https:\/\/([a-z0-9.-]+\.supabase\.co|wedding-image-proxy[a-z0-9.-]*)/g)) want.add(m[1]);
  }
  return bad([...want].filter((h) => !hosts.includes(h)).map((h) => `${h} có trong config nhưng thiếu ở ALLOWED_IMAGE_HOSTS`),
    `${[...want].join(", ")} đều có`);
});

// ================= Deploy =================
rule("LINT-08", "Mỗi Edge Function nằm ở ĐÚNG MỘT danh sách VERIFY / NO_VERIFY", () => {
  const dirs = fs.readdirSync(path.join(R, "supabase/functions")).filter((d) => !d.startsWith("_") && fs.statSync(path.join(R, "supabase/functions", d)).isDirectory());
  const v = bashArray("scripts/deploy-functions.sh", "VERIFY"), n = bashArray("scripts/deploy-functions.sh", "NO_VERIFY");
  const out = [];
  for (const d of dirs) {
    const c = (v.includes(d) ? 1 : 0) + (n.includes(d) ? 1 : 0);
    if (c !== 1) out.push(`${d}: có mặt ở ${c} danh sách`);
  }
  for (const x of [...v, ...n]) if (!dirs.includes(x)) out.push(`${x}: khai trong danh sách nhưng không có thư mục`);
  return bad(out, `${dirs.length} function, mỗi cái đúng một danh sách`);
});
rule("LINT-09", "Ba dãy worker ↔ .toml trong deploy-workers.sh cùng độ dài, file tồn tại", () => {
  const f = "scripts/deploy-workers.sh";
  const names = bashArray(f, "NAMES"), p = bashArray(f, "PROD_CFG"), s = bashArray(f, "STAGING_CFG");
  const out = [];
  if (names.length !== p.length || names.length !== s.length) out.push(`độ dài ${names.length}/${p.length}/${s.length}`);
  for (const t of [...p, ...s]) if (!exists(`cloudflare-worker/${t}`)) out.push(`thiếu cloudflare-worker/${t}`);
  return bad(out, `${names.join(", ")} — đủ ${p.length + s.length} file .toml`);
});
rule("LINT-10", "wrangler*.jsonc: assets.directory = ./dist, not_found_handling = 404-page", () => {
  const out = [];
  for (const f of ["wrangler.jsonc", "wrangler.staging.jsonc"]) {
    const s = read(f);
    if (!/"directory"\s*:\s*"\.\/dist"/.test(s)) out.push(`${f}: assets.directory không phải ./dist (lộ cả repo)`);
    if (!/"not_found_handling"\s*:\s*"404-page"/.test(s)) out.push(`${f}: thiếu not_found_handling 404-page (chết link /<slug>)`);
  }
  return bad(out, "cả hai file đúng");
});
rule("LINT-11", "Terser không bao giờ bật toplevel", () => {
  const s = noComments(read("scripts/deploy-public.mjs"));
  return bad(/toplevel\s*:\s*true/.test(s) ? ["deploy-public.mjs có toplevel: true"] : [], "toplevel luôn false");
});
rule("LINT-12", "Đoạn chuyển hướng trong worker/index.js trùng 404.html", () => {
  const norm = (s) => noComments(s).replace(/<\\\/script>/g, "</script>").replace(/\s+/g, "");
  const a = read("404.html").match(/<script>([\s\S]*?)<\/script>/)[1];
  const w = read("worker/index.js");
  const b = w.slice(w.indexOf("<script>", w.lastIndexOf("PHẢI khớp 404.html")) + 8, w.lastIndexOf("<\\/script>"));
  return { pass: norm(a) === norm(b), got: norm(a) === norm(b) ? "khớp (sau khi bỏ comment + khoảng trắng)" : `lệch:\n        404: ${norm(a).slice(0, 120)}\n        wk : ${norm(b).slice(0, 120)}` };
});

// ================= Mẫu thiệp =================
rule("LINT-13", "Mỗi mẫu có ĐÚNG 3 file, tên thư mục không bắt đầu bằng '_'", () => {
  const out = [];
  for (const t of THEMES) {
    const files = fs.readdirSync(path.join(R, "public/themes", t)).sort();
    if (J(files) !== J(["index.html", "index.js", "theme.css"])) out.push(`${t}: ${files.join(", ")}`);
    if (t.startsWith("_")) out.push(`${t}: tên bắt đầu bằng '_' (Jekyll không publish)`);
  }
  return bad(out, `${THEMES.length} mẫu đều đúng`);
});
rule("LINT-14", "index.html của mẫu: index.js rồi theme-boot.js CUỐI, có no-zoom.js + noindex", () => {
  const out = [];
  for (const t of THEMES) {
    const html = read(`public/themes/${t}/index.html`);
    const srcs = scriptTags(html).map((tag) => (tag.match(/src="([^"]+)"/) || [])[1]).filter(Boolean);
    const iIdx = srcs.findIndex((s) => /(^|\/)index\.js(\?|$)/.test(s));
    const bIdx = srcs.findIndex((s) => /theme-boot\.js/.test(s));
    if (iIdx < 0 || bIdx < 0 || iIdx > bIdx) out.push(`${t}: thứ tự index.js/theme-boot.js sai`);
    if (bIdx !== srcs.length - 1) out.push(`${t}: theme-boot.js không phải script cuối (sau nó còn ${srcs.slice(bIdx + 1).join(", ")})`);
    if (!srcs.some((s) => /no-zoom\.js/.test(s))) out.push(`${t}: thiếu no-zoom.js`);
    if (!/noindex/.test(html) || !/slug/.test(html.slice(0, html.indexOf("noindex") + 1))) out.push(`${t}: thiếu đoạn noindex theo ?slug=`);
  }
  return bad(out, `${THEMES.length} mẫu đều đúng`);
});
// Khối con của thẻ có id cho trước (đếm thẻ cùng tên để tìm thẻ đóng).
function innerById(html, id) {
  const i = html.search(new RegExp(`<([a-z]+)[^>]*\\sid="${id}"`));
  if (i < 0) return null;
  const tag = html.slice(i + 1).match(/^[a-z]+/)[0];
  const re = new RegExp(`<${tag}\\b|</${tag}>`, "g");
  re.lastIndex = i + 1;
  let d = 1, m;
  while ((m = re.exec(html))) {
    d += m[0].startsWith("</") ? -1 : 1;
    if (d === 0) return html.slice(i, m.index);
  }
  return html.slice(i);
}
rule("LINT-15", "Ảnh mẫu: đúng 1 fetchpriority=high, không <img src=\"\">, ảnh #main-card của mẫu có bìa không lazy", () => {
  const out = [];
  for (const t of THEMES) {
    const html = read(`public/themes/${t}/index.html`);
    const imgs = [...html.matchAll(/<img\b[^>]*>/g)].map((m) => m[0]);
    const high = imgs.filter((i) => /fetchpriority="high"/.test(i)).length;
    if (high !== 1) out.push(`${t}: ${high} ảnh fetchpriority=high`);
    const empty = imgs.filter((i) => /\ssrc=""/.test(i));
    if (empty.length) out.push(`${t}: ${empty.length} <img src="">`);
    if (/id="cover-bg-img"/.test(html)) {
      const card = innerById(html, "main-card") || "";
      const lazy = [...card.matchAll(/<img\b[^>]*>/g)].filter((m) => /loading="lazy"/.test(m[0]));
      if (lazy.length) out.push(`${t}: ${lazy.length} ảnh lazy trong #main-card (mẫu có bìa → trống ảnh lúc mở thiệp)`);
    }
  }
  return bad(out, `${THEMES.length} mẫu đều đúng`);
}, { known: "NV-14" });
rule("LINT-16", "index.js của mẫu bọc trong IIFE", () => {
  const out = [];
  for (const t of THEMES) {
    const s = noComments(read(`public/themes/${t}/index.js`)).trim();
    if (!/^\(\s*(function\s*\(\s*\)|\(\s*\)\s*=>)/.test(s) || !/\}\s*\)\s*\(\s*\)\s*;?$/.test(s)) out.push(`${t}: không bọc IIFE (const cấp cao nhất thành biến toàn cục)`);
  }
  return bad(out, `${THEMES.length} mẫu đều bọc IIFE`);
});
rule("LINT-17", "renderCover/renderHero gọi TRƯỚC setupMusic trong renderWedding", () => {
  const out = [];
  for (const t of THEMES) {
    const s = noComments(read(`public/themes/${t}/index.js`));
    const music = s.search(/\bsetupMusic\(/);
    if (music < 0) continue;
    const firsts = [s.search(/\brenderCover\(/), s.search(/\brenderHero\(/)].filter((i) => i >= 0);
    if (!firsts.length) out.push(`${t}: không gọi renderCover/renderHero`);
    else if (Math.min(...firsts) > music) out.push(`${t}: setupMusic đứng trước ảnh màn đầu`);
  }
  return bad(out, `${THEMES.length} mẫu đúng thứ tự`);
});
rule("LINT-18", "Mẫu đang bán có <url> trong sitemap.xml", () => {
  const sm = read("sitemap.xml");
  return bad(SOLD.filter((t) => !sm.includes(`/public/themes/${t}/`)).map((t) => `${t} thiếu trong sitemap`), `${SOLD.length}/${SOLD.length} mẫu có mặt`);
});

// ================= CSS =================
const MANUAL_CSS = fs.readdirSync(path.join(R, "styles")).filter((f) => /^_.*\.css$/.test(f)).map((f) => `styles/${f}`);
rule("LINT-19", "CSS thủ công: không :not() trong selector, không @layer, @import chỉ ở đầu", () => {
  const out = [];
  for (const f of MANUAL_CSS) {
    const css = read(f).replace(/\/\*[\s\S]*?\*\//g, "");
    if (/:not\(/.test(css)) out.push(`${f}: có :not( (cssnano tráo thành rule luôn khớp)`);
    if (/@layer\b/.test(css)) out.push(`${f}: có @layer (bị purge)`);
    const firstRule = css.search(/[^\s@][^{;]*\{/);
    for (const m of css.matchAll(/@import\b/g)) if (firstRule >= 0 && m.index > firstRule) out.push(`${f}: @import nằm sau rule đầu tiên (không chạy)`);
  }
  return bad(out, `${MANUAL_CSS.length} file đạt`);
});
rule("LINT-20", "@keyframes có tiền tố cx-", () => {
  const out = [];
  for (const f of [...MANUAL_CSS, ...THEMES.map((t) => `public/themes/${t}/theme.css`)]) {
    for (const m of read(f).replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/@keyframes\s+([\w-]+)/g)) {
      if (!m[1].startsWith("cx-")) out.push(`${f}: ${m[1]}`);
    }
  }
  return bad(out, "mọi keyframes có tiền tố cx-");
}, { known: "NV-08" });
rule("LINT-21", "Không ghép tên class Tailwind từ chuỗi", () => {
  const out = [];
  const re = /["'`\s](?:bg|text|border|from|to|via|ring|fill|stroke|shadow)-\$\{/;
  for (const f of tracked.filter((f) => /\.(js|html)$/.test(f) && /^(core|js|invitation-setup|my-invitations|checkout|theme-template|public|admin)\//.test(f))) {
    read(f).split("\n").forEach((l, i) => { if (re.test(l)) out.push(`${f}:${i + 1} ${l.trim().slice(0, 80)}`); });
  }
  return bad(out, "không có");
});

// ================= invitation-setup =================
rule("LINT-22", "invitation-setup/js: DOMContentLoaded chỉ là nhánh dự phòng; không window.scrollTo", () => {
  const out = [];
  for (const f of tracked.filter((f) => /^invitation-setup\/js\/.*\.js$/.test(f))) {
    const lines = noComments(read(f)).split("\n");
    lines.forEach((l, i) => {
      if (/addEventListener\(\s*["']DOMContentLoaded/.test(l)) {
        const ctx = lines.slice(Math.max(0, i - 4), i + 1).join("\n");
        if (!/readyState\s*===\s*["']loading/.test(ctx)) out.push(`${f}:${i + 1} DOMContentLoaded không nằm trong nhánh dự phòng`);
      }
      if (/window\.scrollTo\(|documentElement\.scrollTop\s*=/.test(l)) out.push(`${f}:${i + 1} ${l.trim()} (trang không cuộn)`);
    });
  }
  return bad(out, "đạt");
});
rule("LINT-23", "loader.js khai đủ script/partial; bước khớp CX_STEPS; thẻ mount tồn tại", () => {
  const loader = read("invitation-setup/loader.js");
  const arr = loader.slice(loader.indexOf("const SCRIPTS"));
  const scripts = [...arr.slice(0, arr.indexOf("\n  ];")).matchAll(/"((?:\.\.\/)*[\w./-]+\.js)"/g)].map((m) => m[1]);
  const out = [];
  for (const f of fs.readdirSync(path.join(R, "invitation-setup/js"))) {
    if (!scripts.includes(`js/${f}`)) out.push(`js/${f} chưa khai trong SCRIPTS`);
  }
  for (const s of scripts) if (!exists(path.join("invitation-setup", s))) out.push(`SCRIPTS trỏ tới file không có: ${s}`);
  if (scripts.includes("../core/config.js")) out.push("core/config.js không được nằm trong SCRIPTS (nạp hai lần)");
  const pairs = [...loader.matchAll(/\["(mount-[\w-]+)",\s*"(partials\/[\w./-]+)"\]/g)].map((m) => [m[1], m[2]]);
  const partialFiles = [
    ...fs.readdirSync(path.join(R, "invitation-setup/partials")).filter((f) => f.endsWith(".html")).map((f) => `partials/${f}`),
    ...fs.readdirSync(path.join(R, "invitation-setup/partials/steps")).map((f) => `partials/steps/${f}`),
  ];
  for (const p of partialFiles) if (!pairs.some(([, u]) => u === p)) out.push(`${p} chưa khai trong PARTIALS/STEP_PARTIALS`);
  const hosts = read("invitation-setup/index.html") + pairs.map(([, u]) => read(`invitation-setup/${u}`)).join("");
  for (const [m] of pairs) if (!hosts.includes(`id="${m}"`)) out.push(`thiếu thẻ mount #${m}`);
  const stepIds = [...read("invitation-setup/js/20-steps.js").slice(read("invitation-setup/js/20-steps.js").indexOf("const CX_STEPS")).matchAll(/^\s{4}id:\s*"([\w-]+)"/gm)].map((m) => m[1]);
  const stepPartials = pairs.filter(([, u]) => u.startsWith("partials/steps/"));
  if (stepIds.length !== stepPartials.length) out.push(`CX_STEPS có ${stepIds.length} bước, STEP_PARTIALS có ${stepPartials.length}`);
  stepPartials.forEach(([, u], i) => {
    const ds = read(`invitation-setup/${u}`).match(/data-step="([\w-]+)"/)?.[1];
    if (ds !== stepIds[i]) out.push(`${u}: data-step="${ds}" ≠ CX_STEPS[${i}].id="${stepIds[i]}"`);
  });
  return bad(out, `${scripts.length} script · ${pairs.length} partial · ${stepIds.length} bước khớp`);
});

// ================= Trang HTML =================
const PAGES = tracked.filter((f) => f.endsWith(".html") && !/partials\//.test(f) && f !== "core/email-template.html");
rule("LINT-24", "Script CDN có integrity + crossorigin; lucide pin @1.26.0", () => {
  const out = [];
  for (const f of PAGES) {
    for (const tag of scriptTags(read(f))) {
      const src = tag.match(/src="(https:\/\/[^"]+)"/)?.[1];
      if (!src || /cuoixinh\.com/.test(src)) continue;
      if (/youtube\.com\/iframe_api|accounts\.google|googletagmanager/.test(src)) continue; // không có bản cố định để ký
      if (!/integrity="/.test(tag) || !/crossorigin="/.test(tag)) out.push(`${f}: ${src} thiếu integrity/crossorigin`);
      if (/lucide/.test(src) && !/lucide@1\.26\.0\//.test(src)) out.push(`${f}: lucide không pin 1.26.0`);
    }
  }
  return bad(out, `${PAGES.length} trang đạt`);
});
rule("LINT-25", "Trang nạp đủ lucide / x-button.js / no-zoom.js theo thứ nó dùng", () => {
  const out = [];
  const loaderOf = { "invitation-setup/index.html": "invitation-setup/loader.js", "admin/index.html": "admin/loader.js" };
  const partialsOf = { "invitation-setup/index.html": "invitation-setup/partials", "admin/index.html": "admin/partials" };
  const walk = (d) => fs.readdirSync(path.join(R, d), { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? walk(`${d}/${e.name}`) : [`${d}/${e.name}`]));
  for (const f of PAGES) {
    if (["404.html", "router.html"].includes(f)) continue;
    let html = read(f);
    const loaded = html + (loaderOf[f] ? read(loaderOf[f]) : "");
    if (partialsOf[f]) html += walk(partialsOf[f]).filter((p) => p.endsWith(".html")).map(read).join("");
    if (/data-lucide=/.test(html) && !/unpkg\.com\/lucide@/.test(loaded)) out.push(`${f}: dùng data-lucide mà không nạp lucide`);
    if (/<x-button\b/.test(html) && !/x-button\.js/.test(loaded)) out.push(`${f}: dùng <x-button> mà không nạp core/x-button.js`);
    if (/(^|\/)index\.html$/.test(f) && !/no-zoom\.js/.test(read(f))) out.push(`${f}: thiếu no-zoom.js`);
  }
  return bad(out, `${PAGES.length} trang đạt`);
});

// ================= Bản publish =================
rule("LINT-26", "Mục ở gốc repo: hoặc trong INCLUDE, hoặc trong danh sách 'không ra web'; trang HTML nằm trong content Tailwind", () => {
  const include = strArray("scripts/deploy-public.mjs", "INCLUDE");
  // Cố ý KHÔNG ra web. Thêm mục ở gốc repo thì phải quyết định nó thuộc bên nào.
  const PRIVATE = [".claude/", ".gitignore", ".kiro/", ".mcp.json", ".node-version", ".vscode/", "CLAUDE.md", "README.md",
    "admin/", "changelogs/", "cloudflare-worker/", "deploy.bat", "docs/", "documents/", "encrypt.md", "package-lock.json",
    "package.json", "refactor-color.md", "scripts/", "styles/", "supabase/", "tailwind.config.js", "tailwind.fonts.js",
    "tailwind.themes.config.js", "testcase_all.md", "worker/", "wrangler.jsonc", "wrangler.staging.jsonc"];
  const top = [...new Set(tracked.map((f) => (f.includes("/") ? f.split("/")[0] + "/" : f)))];
  const out = top.filter((t) => !include.includes(t) && !PRIVATE.includes(t))
    .map((t) => `${t}: chưa quyết định ra web hay không (thêm vào INCLUDE hoặc PRIVATE của luật này)`);
  const content = [read("tailwind.config.js"), read("tailwind.themes.config.js")].join("\n");
  for (const f of PAGES) {
    const dir = f.includes("/") ? f.split("/")[0] : f;
    if (dir === "public") continue; // themes config quét public/themes/**
    if (!content.includes(`./${dir}`)) out.push(`${f}: thư mục ${dir} không có trong content của Tailwind (class bị purge)`);
  }
  return bad(out, `${top.length} mục gốc đã phân loại · mọi trang có trong content Tailwind`);
});
rule("LINT-27", "core/config.<env>.js nằm trong EXCLUDE và ENVS của admin/loader.js", () => {
  const exclude = strArray("scripts/deploy-public.mjs", "EXCLUDE");
  const envs = [...read("admin/loader.js").matchAll(/\{\s*id:\s*"([\w-]+)"/g)].map((m) => m[1]);
  const files = fs.readdirSync(path.join(R, "core")).filter((f) => /^config\.[\w-]+\.js$/.test(f));
  const out = [];
  for (const f of files) {
    const env = f.split(".")[1];
    if (!exclude.includes(`core/${f}`)) out.push(`core/${f} thiếu trong EXCLUDE (lộ URL môi trường khác)`);
    if (!envs.includes(env)) out.push(`${env} thiếu trong ENVS của admin/loader.js`);
  }
  return bad(out, `${files.join(", ")} đều đã khai`);
});

// ================= Edge Function =================
const FN_FILES = tracked.filter((f) => /^supabase\/functions\/.*\.ts$/.test(f));
rule("LINT-28", "Edge Function: mọi `error` của truy vấn được xử lý; không còn console.error", () => {
  const out = [];
  for (const f of FN_FILES) {
    if (f.endsWith("_shared/axiom.ts")) continue; // chính logger in ra console
    const lines = read(f).split("\n");
    lines.forEach((l, i) => {
      // Nhánh dự phòng khi hàm không được truyền logger (`if (log) … else console.error`) là hợp lệ.
      if (/console\.error\(/.test(l) && !/else\s+console\.error/.test(l)) out.push(`${f}:${i + 1} console.error`);
      const m = l.match(/const\s*\{[^}]*\berror(?:\s*:\s*(\w+))?[^}]*\}\s*=\s*await\b/);
      if (m) {
        const name = m[1] || "error";
        // Truy vấn nhiều dòng + Promise.all kiểm gộp: nhìn tới 40 dòng sau.
        if (!new RegExp(`\\b${name}\\b`).test(lines.slice(i + 1, i + 41).join("\n"))) out.push(`${f}:${i + 1} '${name}' không được xét sau truy vấn`);
      }
    });
  }
  return bad(out, "đạt");
}, { known: "NV-09" });
rule("LINT-29", "Không .ilike( với tham số người dùng", () => {
  const out = [];
  for (const f of FN_FILES) read(f).split("\n").forEach((l, i) => { if (/\.ilike\(/.test(l)) out.push(`${f}:${i + 1} ${l.trim().slice(0, 70)}`); });
  // .or('…ilike…') đã qua escapePostgrestPattern ở danh sách admin — tách riêng để khỏi báo nhầm.
  return bad(out, "không có");
}, { known: "NV-10" });
rule("LINT-30", "Bộ màu mẫu + mã màu cứng", () => ok("xem npm run check:palette (AUTO-EX-02) và UNIT-20 của check:units"));

// ---------------- In kết quả ----------------
results.sort((a, b) => a.id.localeCompare(b.id, "en", { numeric: true }));
let fail = 0, known = 0;
for (const r of results) {
  const status = r.pass ? "PASS " : r.known ? "KNOWN" : "FAIL ";
  if (!r.pass && r.known) known++;
  else if (!r.pass) fail++;
  if (!r.pass || VERBOSE) console.log(`${status} ${r.id}. ${r.title}${r.known && !r.pass ? `  [${r.known}]` : ""}\n        ${r.got}`);
}
console.log(`\nTổng ${results.length} | PASS ${results.length - fail - known} | KNOWN ${known} | FAIL ${fail}`);
process.exit(fail ? 1 : 0);
