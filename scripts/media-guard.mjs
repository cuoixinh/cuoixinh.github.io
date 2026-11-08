/**
 * Chốt chặn rồi deploy kho nhạc (`npm run deploy:media`). Deploy file tĩnh THAY TRỌN kho bằng
 * thư mục cloudflare-media/public/ trên máy, nên trước đó đối chiếu với library.json ĐANG CHẠY:
 * mất một `id` (lựa chọn đã lưu của khách hỏng) hay thiếu một file nhạc trên máy là DỪNG.
 *   npm run deploy:media                  → kiểm rồi deploy
 *   npm run deploy:media -- --force       → cố ý gỡ bài: chỉ cảnh báo · `-- --dry-run` để thử
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = path.resolve(import.meta.dirname, "..");
const MEDIA = path.join(ROOT, "cloudflare-media");
const PUB = path.join(MEDIA, "public");
const args = process.argv.slice(2);
const FORCE = args.includes("--force");
const passArgs = args.filter((a) => a !== "--force");

const errors = [];
const warns = [];

// Địa chỉ kho khai DUY NHẤT ở core/config.js.
function libraryUrl() {
  const src = fs.readFileSync(path.join(ROOT, "core/config.js"), "utf8");
  const m = src.match(/slideMusic\s*:\s*\{[^}]*?library\s*:\s*["']([^"']+)["']/);
  if (!m) throw new Error("Không tìm thấy CONFIG.slideMusic.library trong core/config.js");
  return m[1];
}

// Đường dẫn `file` tính theo library.json (cùng cách trang đọc: new URL(file, base)).
function localPathOf(file) {
  const rel = decodeURIComponent(new URL(file, "https://x/").pathname).replace(/^\/+/, "");
  return path.join(PUB, rel);
}

function readLocal() {
  const p = path.join(PUB, "library.json");
  let j;
  try {
    j = JSON.parse(fs.readFileSync(p, "utf8"));
  } catch (e) {
    errors.push(`library.json trên máy hỏng: ${e.message}`);
    return [];
  }
  const tracks = Array.isArray(j?.tracks) ? j.tracks : null;
  if (!tracks) {
    errors.push('library.json thiếu mảng "tracks"');
    return [];
  }
  const seen = new Set();
  tracks.forEach((t, i) => {
    const at = `bài #${i + 1}${t?.id ? ` (${t.id})` : ""}`;
    for (const k of ["id", "title", "file"]) if (!t?.[k]) errors.push(`${at}: thiếu "${k}"`);
    if (!t?.id) return;
    if (seen.has(t.id)) errors.push(`${at}: trùng id`);
    seen.add(t.id);
    if (t.file && !fs.existsSync(localPathOf(t.file))) errors.push(`${at}: không có file ${t.file} trên máy`);
  });
  return tracks;
}

async function readLive(url) {
  let r;
  try {
    r = await fetch(url + (url.includes("?") ? "&" : "?") + "t=" + Date.now(), {
      headers: { "Cache-Control": "no-cache" },
      signal: AbortSignal.timeout(15000),
    });
  } catch (e) {
    errors.push(`Không tải được kho đang chạy (${url}): ${e.message} — không deploy mù.`);
    return null;
  }
  if (r.status === 404) return []; // kho chưa từng deploy
  if (!r.ok) {
    errors.push(`Kho đang chạy trả ${r.status} (${url}) — không deploy mù.`);
    return null;
  }
  try {
    const j = await r.json();
    return Array.isArray(j?.tracks) ? j.tracks : [];
  } catch (e) {
    errors.push(`library.json đang chạy không đọc được: ${e.message}`);
    return null;
  }
}

const url = libraryUrl();
const local = readLocal();
const live = await readLive(url);

if (live) {
  const localIds = new Set(local.map((t) => t?.id));
  for (const t of live) {
    if (!t?.id) continue;
    if (!localIds.has(t.id)) {
      const msg = `Bài "${t.title || t.id}" (id ${t.id}) đang có trên mạng nhưng KHÔNG còn trong library.json trên máy`;
      (FORCE ? warns : errors).push(msg);
    }
    if (t.file && !fs.existsSync(localPathOf(t.file))) {
      const msg = `File ${t.file} đang phát trên mạng nhưng KHÔNG có trên máy — deploy sẽ xoá nó`;
      (FORCE ? warns : errors).push(msg);
    }
  }
}

warns.forEach((w) => console.warn("⚠️  " + w));
if (errors.length) {
  console.error("\n⛔ DỪNG — không deploy kho nhạc:");
  errors.forEach((e) => console.error("   • " + e));
  console.error(
    "\nChép lại file còn thiếu vào cloudflare-media/public/songs/ (bản sao lưu), hoặc nếu CỐ Ý gỡ bài thì" +
      "\nxoá mục đó khỏi library.json rồi chạy:  npm run deploy:media -- --force\n",
  );
  // exitCode thay vì process.exit(): thoát ngang lúc fetch còn đóng kết nối làm Node trên Windows
  // sập (UV_HANDLE_CLOSING).
  process.exitCode = 1;
} else {
  console.log(`✅ Kho nhạc trên máy đủ ${local.length} bài, khớp kho đang chạy (${live?.length ?? 0} bài). Deploy…\n`);
  const res = spawnSync("npx", ["wrangler", "deploy", ...passArgs], {
    cwd: MEDIA,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  process.exitCode = res.status ?? 1;
}
