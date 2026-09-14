#!/usr/bin/env node
// Nối changelog SQL của một dòng phiên bản thành MỘT file để dán một lượt vào
// SQL Editor.
//   npm run sql:merge            → dùng dòng phiên bản mới nhất (RC02 > RC01)
//   npm run sql:merge -- RC01    → chỉ định dòng phiên bản
//
// Gộp ĐÚNG hai nhóm, theo đúng thứ tự chạy: schema/ rồi data/. Nhóm manual/ CỐ Ý
// đứng ngoài — hai file trong đó không dán-là-chạy được (một file phải làm bằng
// Dashboard, một file phải thay <PROJECT_REF> trước), gộp vào là mời người dùng
// chạy thẳng rồi đặt cron trỏ nhầm project.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIR = path.join(ROOT, "changelogs");
const GROUPS = ["schema", "data"]; // thứ tự này LÀ thứ tự chạy
const SKIPPED = "manual";
const RC_RE = /^RC\d+$/i;

// Sort tự nhiên: cắt chuỗi thành đoạn chữ/đoạn số rồi so từng đoạn, số so theo
// giá trị — để một file lỡ đặt tên thiếu số 0 không âm thầm nhảy sai chỗ.
const natural = (a, b) => {
  const split = (s) => s.toLowerCase().match(/\d+|\D+/g) || [];
  const A = split(a),
    B = split(b);
  for (let i = 0; i < Math.max(A.length, B.length); i++) {
    const x = A[i],
      y = B[i];
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    const nx = /^\d/.test(x),
      ny = /^\d/.test(y);
    if (nx && ny) {
      const d = Number(x) - Number(y);
      if (d) return d;
    } else if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
};

const dirs = () =>
  fs
    .readdirSync(DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory() && RC_RE.test(e.name))
    .map((e) => e.name)
    .sort(natural);

const arg = process.argv.slice(2).find((a) => !a.startsWith("--"));
const rcs = dirs();
const rc = arg || rcs.at(-1);

if (!rc) {
  console.error(`✗ Không có thư mục RC nào trong ${path.relative(ROOT, DIR)}/.`);
  process.exit(1);
}
const SRC = path.join(DIR, rc);
if (!fs.existsSync(SRC)) {
  console.error(`✗ Không có ${path.relative(ROOT, SRC)}/.`);
  console.error(`  Đang có: ${rcs.join(", ") || "(không có)"}`);
  process.exit(1);
}

// Gom file theo nhóm, giữ nguyên thứ tự nhóm.
const picked = [];
for (const g of GROUPS) {
  const gDir = path.join(SRC, g);
  if (!fs.existsSync(gDir)) continue;
  for (const f of fs.readdirSync(gDir).filter((f) => f.endsWith(".sql")).sort(natural))
    picked.push({ group: g, file: f, abs: path.join(gDir, f) });
}

if (!picked.length) {
  console.error(
    `✗ Không có file .sql nào trong ${path.relative(ROOT, SRC)}/{${GROUPS.join(",")}}/.`,
  );
  process.exit(1);
}

const out = [
  `-- SINH TỰ ĐỘNG bởi scripts/merge-changelogs.mjs — ĐỪNG SỬA TAY, sửa file nguồn rồi chạy lại.`,
  `-- ${rc}  ·  ${picked.length} file  ·  ${GROUPS.join(" → ")}  ·  ${new Date().toISOString()}`,
  `--`,
  `-- CHƯA ĐỦ để dựng xong một project: nhóm ${SKIPPED}/ không nằm trong file này.`,
  `-- Sau khi chạy file này, làm nốt ${SKIPPED}/ theo changelogs/README.md.`,
  ``,
];

for (const { group, file, abs } of picked) {
  const sql = fs.readFileSync(abs, "utf8").split("\r\n").join("\n");
  out.push(
    `-- ${"=".repeat(70)}`,
    `-- ▶ ${rc}/${group}/${file}`,
    `-- ${"=".repeat(70)}`,
    ``,
    sql.trim(),
    ``,
    ``,
  );
}

const dest = path.join(DIR, `${rc}.final.sql`);
fs.writeFileSync(dest, out.join("\n"));

let last = "";
for (const { group, file } of picked) {
  if (group !== last) console.log(`\n  ${group}/`);
  last = group;
  console.log(`    ${file}`);
}

console.log(`\n✅ Đã nối ${picked.length} file thành MỘT file để dán một lượt:`);
console.log(`   ${path.relative(ROOT, dest).split(path.sep).join("/")}`);

// Nhắc phần còn thiếu, kèm tên file thật để khỏi phải đi tra.
const manualDir = path.join(SRC, SKIPPED);
if (fs.existsSync(manualDir)) {
  const left = fs.readdirSync(manualDir).filter((f) => f.endsWith(".sql")).sort(natural);
  if (left.length) {
    console.log(`\n⚠ Chưa xong: ${SKIPPED}/ phải làm TAY, không gộp được —`);
    left.forEach((f) => console.log(`    ${rc}/${SKIPPED}/${f}`));
  }
}
