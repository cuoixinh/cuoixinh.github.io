// Đối chiếu CX_THEME.palette (index.js) với :root (theme.css) của từng mẫu.
//
//   node scripts/check-theme-palette.mjs          kiểm, lệch thì thoát mã 1
//   node scripts/check-theme-palette.mjs --write  ghi lại palette cho đúng
//
// Hai nơi cùng khai một bộ màu vì mỗi nơi làm một việc: `:root` là màu lúc VẼ
// LẦN ĐẦU (không có JS vẫn đúng màu), còn `CX_THEME.palette` là bản khai cho
// trang Thiết lập đọc. Lệch nhau thì mục "Mặc định" ở tab Giao diện hiện sai
// màu — không vỡ gì nên rất khó phát hiện bằng mắt, phải có script này.
//
// Thuần Node, không cần trình duyệt: giá trị token chỉ là bộ ba RGB hoặc một
// chuỗi var() trỏ tiếp, nên phân giải được bằng cách đọc file.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WRITE = process.argv.includes("--write");

// Gom mọi khai báo `--x: y;` nằm trong khối :root của một file CSS.
function readRootVars(file) {
  const css = fs.readFileSync(path.join(ROOT, file), "utf8");
  const out = {};
  for (const m of css.matchAll(/:root\s*\{([^}]*)\}/g)) {
    for (const d of m[1].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
      out[d[1]] = d[2].split("/*")[0].trim();
    }
  }
  return out;
}

// Lần theo chuỗi var() cho tới khi ra bộ ba RGB.
function resolve(name, scopes, seen = new Set()) {
  if (seen.has(name)) return null;
  seen.add(name);
  for (const s of scopes) {
    if (!(name in s)) continue;
    const v = s[name];
    const triplet = v.match(/^(\d+)\s+(\d+)\s+(\d+)$/);
    if (triplet) return triplet.slice(1, 4).map(Number);
    const ref = v.match(/^var\(\s*(--[\w-]+)\s*\)$/);
    if (ref) return resolve(ref[1], scopes, seen);
    return null;
  }
  return null;
}

const hex = (rgb) =>
  "#" + rgb.map((n) => n.toString(16).padStart(2, "0")).join("");

// Bảng khoá ↔ token: đọc thẳng từ nguồn sự thật để không phải chép lại danh sách.
const helper = fs.readFileSync(
  path.join(ROOT, "core/helpers/theme-setting-helper.js"), "utf8");
const block = helper.match(/const CX_PALETTE_TOKENS = \{([\s\S]*?)\n\};/);
if (!block) {
  console.error("Không đọc được CX_PALETTE_TOKENS trong theme-setting-helper.js");
  process.exit(2);
}
const KEYS = [...block[1].matchAll(/(\w+):\s*"(--[\w-]+)"/g)]
  .map((m) => ({ key: m[1], token: m[2] }));

const colors = readRootVars("styles/_colors.css");
const common = readRootVars("styles/_common.css");

const themes = fs.readdirSync(path.join(ROOT, "public/themes"))
  .filter((d) => fs.existsSync(path.join(ROOT, "public/themes", d, "theme.css")));

let bad = 0;
for (const t of themes) {
  const theme = readRootVars(`public/themes/${t}/theme.css`);
  const scopes = [theme, common, colors];

  const want = {};
  const unresolved = [];
  for (const { key, token } of KEYS) {
    const rgb = resolve(token, scopes);
    if (rgb) want[key] = hex(rgb);
    else unresolved.push(token);
  }
  if (unresolved.length) {
    console.log(`${t.padEnd(17)} KHÔNG phân giải được: ${unresolved.join(", ")}`);
    bad++;
    continue;
  }

  const jsPath = path.join(ROOT, "public/themes", t, "index.js");
  let js = fs.readFileSync(jsPath, "utf8");
  const cur = js.match(/palette: \{([\s\S]*?)\n( *)\},/);
  const got = cur
    ? Object.fromEntries([...cur[1].matchAll(/(\w+):\s*"(#[0-9a-f]{6})"/g)]
        .map((m) => [m[1], m[2]]))
    : null;

  const diff = KEYS.filter(({ key }) => !got || got[key] !== want[key]);
  if (!diff.length) { console.log(`${t.padEnd(17)} OK  ${KEYS.length} khoá khớp`); continue; }

  if (!WRITE) {
    console.log(`${t.padEnd(17)} LỆCH ${diff.length} khoá:`);
    for (const { key } of diff)
      console.log(`     ${key}: theme.css=${want[key]}  index.js=${got ? got[key] : "(chưa khai)"}`);
    bad++;
    continue;
  }

  const body = KEYS.map(({ key }) => `      ${key}: "${want[key]}",`).join("\n");
  const decl =
`    // Bộ màu MẶC ĐỊNH của mẫu — bản khai máy đọc được của đúng những giá trị
    // :root trong theme.css (nguồn sự thật). Trang Thiết lập đọc nó để hiện mục
    // "Mặc định"; theme_setting.palette ghi đè lên trên lúc chạy.
    // Sinh lại bằng: node scripts/check-theme-palette.mjs --write
    palette: {
${body}
    },
`;
  js = cur
    ? js.replace(/ *\/\/ Bộ màu MẶC ĐỊNH của mẫu[\s\S]*?\n *palette: \{[\s\S]*?\n *\},\n/, decl)
    : js.replace(/^( *)preset: \{/m, decl + "\n$1preset: {");
  fs.writeFileSync(jsPath, js);
  console.log(`${t.padEnd(17)} ghi lại ${diff.length} khoá`);
}

if (!WRITE && bad) {
  console.log(`\n==> ${bad} mẫu lệch. Sửa :root trong theme.css rồi chạy lại với --write.`);
  process.exit(1);
}
console.log(WRITE ? "\n==> Đã ghi xong" : "\n==> Khớp hết");
