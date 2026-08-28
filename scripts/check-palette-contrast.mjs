// Kiểm tương phản của danh mục bộ màu (core/helpers/card-palette-helper.js).
//
//   node scripts/check-palette-contrast.mjs
//
// Bộ màu là thứ khách bấm một phát rồi dùng luôn — không ai ngồi soi xem chữ có
// đọc được không. Script này chặn ngay lúc thêm bộ mới: bộ nào trượt ngưỡng thì
// sửa giá trị, không bỏ qua.
//
// Ngưỡng theo WCAG 2.1: 4.5:1 cho chữ thường, 7:1 (AAA) cho tiêu đề vì tiêu đề
// thiệp hay dùng font serif nét mảnh, 3:1 cho phần đồ hoạ (icon, vạch nhấn).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const src = fs.readFileSync(
  path.join(ROOT, "core/helpers/card-palette-helper.js"), "utf8");
const body = src.slice(src.indexOf("const CX_PALETTES = ["),
                       src.indexOf("\n];", src.indexOf("const CX_PALETTES = [")) + 3);
const PALETTES = new Function(body + " return CX_PALETTES;")();

const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const lum = (h) => {
  const [r, g, b] = rgb(h).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};

const PAIRS = [
  ["heading", "card_bg", 7, "tiêu đề trên thân thiệp"],
  ["body", "card_bg", 4.5, "chữ đọc trên thân thiệp"],
  ["body", "panel", 4.5, "chữ đọc trên thẻ con"],
  ["body", "band", 4.5, "chữ đọc trên dải nền"],
  ["accent", "card_bg", 3, "màu nhấn trên thân thiệp"],
  ["on_accent", "accent", 4.5, "chữ trên nền nhấn"],
  ["on_image", "scrim", 4.5, "chữ trên ảnh (qua lớp phủ)"],
];

// Nền phải SÁNG: đây là thiệp cưới, không có bộ nền tối.
const LIGHT = ["card_bg", "page_bg", "surface", "panel"];
const MIN_LIGHT_LUM = 0.7;

let bad = 0;
for (const p of PALETTES) {
  const errs = [];
  for (const [a, b, min, what] of PAIRS) {
    if (!p[a] || !p[b]) { errs.push(`thiếu khoá ${!p[a] ? a : b}`); continue; }
    const r = ratio(p[a], p[b]);
    if (r < min) errs.push(`${what}: ${r.toFixed(2)}:1 < ${min}:1  (${a} ${p[a]} / ${b} ${p[b]})`);
  }
  for (const k of LIGHT) {
    if (p[k] && lum(p[k]) < MIN_LIGHT_LUM)
      errs.push(`${k} không đủ sáng: độ sáng ${lum(p[k]).toFixed(2)} < ${MIN_LIGHT_LUM}  (${p[k]})`);
  }
  if (p.scrim && lum(p.scrim) > 0.2)
    errs.push(`scrim phải TỐI: độ sáng ${lum(p.scrim).toFixed(2)} > 0.2  (${p.scrim})`);

  if (errs.length) {
    console.log(`✗ ${p.id} — ${p.name}`);
    errs.forEach((e) => console.log(`    ${e}`));
    bad++;
  } else {
    const w = Math.min(...PAIRS.map(([a, b]) => ratio(p[a], p[b])));
    console.log(`✓ ${p.id.padEnd(16)} ${p.name.padEnd(18)} cặp yếu nhất ${w.toFixed(2)}:1`);
  }
}
console.log(bad ? `\n==> ${bad}/${PALETTES.length} bộ trượt ngưỡng`
                : `\n==> ${PALETTES.length} bộ đều đạt`);
process.exit(bad ? 1 : 0);
