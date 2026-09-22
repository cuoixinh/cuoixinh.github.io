/**
 * Đối chiếu `core/config.js` với từng bản override môi trường (`core/config.<env>.js`).
 *
 *   node scripts/check-config-env.mjs                    → đọc file trên máy
 *   node scripts/check-config-env.mjs --ref <nhánh>      → đọc từ một nhánh git
 *
 * Bản staging do build NỐI file override vào cuối config.js, và override gán ĐÈ
 * TRỌN object (`CONFIG.supabase = {…}`). Nên thêm một khoá vào config.js là staging
 * lặng lẽ mất khoá đó — production chạy ngon, staging hỏng đúng một tính năng mà
 * không có gì báo. Script này bắt đúng ca đó, cộng hai ca "staging trỏ nhầm sang
 * production" (xem CHECKS bên dưới).
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { execFileSync } from "node:child_process";

const ROOT = path.resolve(import.meta.dirname, "..");
const BASE_FILE = "core/config.js";

const args = process.argv.slice(2);
const REF = args.includes("--ref") ? args[args.indexOf("--ref") + 1] : null;

// Ref của project Supabase production, suy ra từ chính config.js — đừng viết cứng
// ở đây, lệch một lần là script gác nhầm.
let PROD_REF = "";

function read(rel) {
  if (!REF) {
    const abs = path.join(ROOT, rel);
    return fs.existsSync(abs) ? fs.readFileSync(abs, "utf8") : null;
  }
  try {
    return execFileSync("git", ["show", `${REF}:${rel}`], { cwd: ROOT, encoding: "utf8" });
  } catch {
    return null;
  }
}

function listEnvFiles() {
  if (!REF) {
    return fs
      .readdirSync(path.join(ROOT, "core"))
      .filter((f) => /^config\.[a-z0-9-]+\.js$/.test(f))
      .map((f) => `core/${f}`);
  }
  const out = execFileSync("git", ["ls-tree", "--name-only", `${REF}:core`], {
    cwd: ROOT,
    encoding: "utf8",
  });
  return out
    .split("\n")
    .filter((f) => /^config\.[a-z0-9-]+\.js$/.test(f))
    .map((f) => `core/${f}`);
}

/** Chạy nguồn trong sandbox có DOM giả (config.js đụng document lúc nạp). */
function build(src) {
  const ctx = {
    document: {
      querySelectorAll: () => [],
      createElement: () => ({ addEventListener() {}, after() {}, remove() {} }),
    },
    location: { origin: "https://example.test" },
    console: { log() {}, warn() {}, error() {} },
  };
  vm.createContext(ctx);
  vm.runInContext(`${src}\n;globalThis.__CFG = CONFIG;`, ctx);
  return ctx.__CFG;
}

/** Trải object thành cặp [đường.dẫn, giá trị] để so từng khoá một. */
function flatten(obj, prefix = "") {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? flatten(v, `${prefix}${k}.`)
      : [[`${prefix}${k}`, v]],
  );
}

// Hai ca "staging trỏ nhầm sang production": giá trị nào lọt lưới ở đây là môi
// trường test đọc/ghi dữ liệu thật, hoặc dùng chung cache với khách thật.
const CHECKS = [
  {
    hit: (v) => PROD_REF && typeof v === "string" && v.includes(PROD_REF),
    why: () => `còn trỏ vào project production (${PROD_REF})`,
  },
  {
    hit: (v) =>
      typeof v === "string" && v.includes("workers.dev") && !v.includes("-staging."),
    why: () => "dùng worker của production (thiếu hậu tố -staging)",
  },
];

const baseSrc = read(BASE_FILE);
if (!baseSrc) {
  console.error(`✗ Không đọc được ${BASE_FILE}${REF ? ` ở ${REF}` : ""}.`);
  process.exit(1);
}

PROD_REF = baseSrc.match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1] ?? "";

const prod = new Map(flatten(build(baseSrc)));
const envFiles = listEnvFiles();

if (!envFiles.length) {
  console.log("✓ Không có file override môi trường nào — không phải đối chiếu.");
  process.exit(0);
}

let failed = 0;

for (const rel of envFiles) {
  const envName = rel.match(/config\.(.+)\.js$/)[1];
  const src = read(rel);
  const built = new Map(flatten(build(`${baseSrc}\n${src}`)));

  const missing = [...prod.keys()].filter((k) => !built.has(k));
  const leaked = [...built.entries()].flatMap(([k, v]) => {
    const c = CHECKS.find((c) => c.hit(v));
    return c ? [[k, c.why()]] : [];
  });
  const differing = [...prod.keys()].filter(
    (k) => built.has(k) && String(prod.get(k)) !== String(built.get(k)),
  );

  if (missing.length || leaked.length) {
    failed++;
    console.error(`\n✗ ${rel}`);
    for (const k of missing) {
      console.error(`   · MẤT KHOÁ  ${k}`);
    }
    for (const [k, why] of leaked) {
      console.error(`   · ${k} — ${why}`);
    }
    if (missing.length) {
      console.error(
        `   Override gán đè trọn object, nên khoá mới thêm vào ${BASE_FILE} phải khai lại ở đây.`,
      );
    }
  } else {
    console.log(`✓ ${rel} — đủ khoá, ${differing.length} khoá khác production:`);
    for (const k of differing) console.log(`     ${k}`);
  }
}

/* ── Worker preview (og:*) ────────────────────────────────────────────────
   `vars` trong wrangler*.jsonc KHÔNG đi qua build nên không ai đồng bộ hộ:
   lệch anonKey/encryptionKey là thẻ chia sẻ đọc nhầm project hoặc giải mã hỏng
   tên khách, mà trang vẫn chạy bình thường. Đối chiếu tay ở đây.
   Chỉ gỡ comment DÒNG ĐẦY ĐỦ — mọi comment trong hai file đó đều đứng riêng dòng. */
const WRANGLER = [
  { file: "wrangler.jsonc", env: "production" },
  { file: "wrangler.staging.jsonc", env: "staging" },
];
const VAR_MAP = {
  EDGE_URL: "supabase.edgeUrl",
  ANON_KEY: "supabase.anonKey",
  STORAGE_URL: "supabase.storageUrl",
  ENCRYPTION_KEY: "security.encryptionKey",
};

for (const { file, env } of WRANGLER) {
  const raw = read(file);
  if (!raw) continue;
  let vars;
  try {
    vars = JSON.parse(raw.replace(/^\s*\/\/.*$/gm, "")).vars;
  } catch {
    failed++;
    console.error(`\n✗ ${file} — không đọc được JSON`);
    continue;
  }
  if (!vars) continue;

  const rel = env === "production" ? null : `core/config.${env}.js`;
  const src = rel ? read(rel) : null;
  if (rel && !src) continue;
  const cfg = new Map(flatten(build(rel ? `${baseSrc}\n${src}` : baseSrc)));

  const bad = Object.entries(VAR_MAP).flatMap(([k, key]) =>
    String(vars[k] ?? "") !== String(cfg.get(key) ?? "") ? [[k, key]] : [],
  );
  if (bad.length) {
    failed++;
    console.error(`\n✗ ${file} — vars lệch cấu hình ${env}`);
    for (const [k, key] of bad) console.error(`   · ${k} ≠ CONFIG.${key}`);
  } else {
    console.log(`✓ ${file} — vars worker khớp cấu hình ${env}`);
  }
}

if (failed) {
  console.error(`\n✗ ${failed} file override không đạt.`);
  process.exit(1);
}

