#!/usr/bin/env node
// Nối các changelog SQL thành MỘT file để dán một lượt vào SQL Editor.
//   npm run sql:merge -- RC1                       → changelogs/RC1.final.sql
//   npm run sql:merge -- RC1 --ref=<project-ref>   → đổi luôn ref production trong file
// Thứ tự là thứ tự CHẠY. Tên file đã đánh số 3 chữ số nên sort chữ cũng ra đúng; vẫn
// sort tự nhiên để một file lỡ đặt tên thiếu số 0 không âm thầm nhảy sai chỗ.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIR = path.join(ROOT, "changelogs");
const PROD_REF = "lcobawmkywtxhpezndsh";

const args = process.argv.slice(2);
const prefix = args.find((a) => !a.startsWith("--"));
const ref = (args.find((a) => a.startsWith("--ref=")) || "").slice(6);

if (!prefix) {
  console.error("Cách dùng: npm run sql:merge -- <tiền tố> [--ref=<project-ref>]");
  console.error("  vd: npm run sql:merge -- RC1 --ref=gmtnoxdwoumbtdmqmisk");
  process.exit(1);
}

// Sort tự nhiên: cắt chuỗi thành đoạn chữ/đoạn số rồi so từng đoạn, số so theo giá trị.
const natural = (a, b) => {
  const split = (s) => s.toLowerCase().match(/\d+|\D+/g) || [];
  const A = split(a), B = split(b);
  for (let i = 0; i < Math.max(A.length, B.length); i++) {
    const x = A[i], y = B[i];
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    const nx = /^\d/.test(x), ny = /^\d/.test(y);
    if (nx && ny) { const d = Number(x) - Number(y); if (d) return d; }
    else if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
};

// Gom mọi .sql khớp tiền tố. Bỏ qua chính file kết quả để chạy lại lần hai không
// tự nối vào mình.
const files = fs
  .readdirSync(DIR)
  .filter((f) => f.startsWith(prefix) && f.endsWith(".sql") && !f.endsWith(".final.sql"))
  .sort(natural);

if (!files.length) {
  console.error(`✗ Không có file .sql nào khớp tiền tố "${prefix}" trong changelogs/.`);
  process.exit(1);
}

const out = [
  `-- SINH TỰ ĐỘNG bởi scripts/merge-changelogs.mjs — ĐỪNG SỬA TAY, sửa file nguồn rồi chạy lại.`,
  `-- Tiền tố: ${prefix}   ·   ${files.length} file   ·   ${new Date().toISOString()}`,
  ref ? `-- Đã đổi ref project: ${PROD_REF} → ${ref}` : `-- Ref project: GIỮ NGUYÊN (${PROD_REF}) — chạy trên môi trường khác thì thêm --ref=<ref>`,
  ``,
];
let swapped = 0;
for (const rel of files) {
  let sql = fs.readFileSync(path.join(DIR, rel), "utf8").split("\r\n").join("\n");
  if (ref) {
    const n = sql.split(PROD_REF).length - 1;
    if (n) { sql = sql.split(PROD_REF).join(ref); swapped += n; }
  }
  out.push(`-- ${"=".repeat(70)}`, `-- ▶ changelogs/${rel}`, `-- ${"=".repeat(70)}`, ``, sql.trim(), ``, ``);
}

const dest = path.join(DIR, `${prefix}.final.sql`);
fs.writeFileSync(dest, out.join("\n"));

files.forEach((f, i) => console.log(`  ${String(i + 1).padStart(2)}. ${f}`));
console.log(`
✅ Đã nối ${files.length} file trên thành MỘT file để dán một lượt:`);
console.log(`   ${path.relative(ROOT, dest)}`);
if (ref) console.log(`   Đổi ${swapped} chỗ "${PROD_REF}" → "${ref}"`);
else console.log(`   ⚠ Còn nguyên ref production trong file — RC1_010 có cron.schedule gọi URL đó.`);
