#!/usr/bin/env node
// Server tĩnh CHỈ dùng khi chạy local (thay Live Server / python -m http.server).
//
//   npm run dev                    → http://localhost:8000, dữ liệu STAGING
//   npm run dev -- --env=production→ chạy trên dữ liệu production (thiệp thật)
//   npm run dev -- --port=5500     → đổi cổng
//   npm run dev -- --no-reload     → tắt tự tải lại khi sửa file
//
// Lý do tồn tại: local mặc định phải là staging, mà luật của repo là TRONG MÃ
// không có chỗ nào rẽ nhánh theo môi trường. Nên chỗ rẽ nằm ở đây — server tự
// nối `core/config.<env>.js` vào cuối `core/config.js` lúc trả file, y hệt cách
// `scripts/deploy-public.mjs --env=staging` dựng bản staging. Trình duyệt vẫn
// thấy đúng MỘT file `core/config.js`, không trang nào phải khai thêm thẻ script.
//
// Hệ quả cần nhớ: mở trang bằng Live Server (cổng 5500) là KHÔNG qua server này
// → rơi về production. Cổng in ra lúc khởi động mới là cổng chạy staging.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { watch } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const ENV = flag("env", "staging");
const PORT = Number(flag("port", 8000));
const RELOAD = !args.includes("--no-reload");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
};

// ===== Tự tải lại khi sửa file =====

const clients = new Set();
const RELOAD_SNIPPET = `<script>new EventSource("/__reload").onmessage=()=>location.reload()</script>`;

function watchRepo() {
  const skip = /(^|[\\/])(\.git|node_modules|dist|\.vscode)([\\/]|$)/;
  let timer = null;
  try {
    watch(ROOT, { recursive: true }, (_e, file) => {
      if (!file || skip.test(file)) return;
      clearTimeout(timer); // một lần lưu có thể bắn nhiều sự kiện
      timer = setTimeout(() => {
        for (const res of clients) res.write("data: reload\n\n");
      }, 120);
    });
  } catch {
    console.log("  (không theo dõi được thư mục — tự tải lại tắt)");
  }
}

// ===== Nội dung trả về =====

/** `core/config.js` + phần khác biệt của môi trường, nối y như lúc build. */
async function buildConfig() {
  const base = await readFile(path.join(ROOT, "core/config.js"), "utf8");
  if (ENV === "production") return base;

  const override = path.join(ROOT, `core/config.${ENV}.js`);
  try {
    return base + "\n" + (await readFile(override, "utf8"));
  } catch {
    // Thiếu file override mà vẫn chạy tiếp là lặng lẽ dùng dữ liệu production —
    // đúng thứ nguy hiểm nhất ở đây, nên chặn hẳn.
    throw new Error(`Không có core/config.${ENV}.js`);
  }
}

/** Đường dẫn trong repo cho URL, hoặc null nếu trỏ ra ngoài. */
function resolveSafe(pathname) {
  const p = path.resolve(ROOT, "." + decodeURIComponent(pathname));
  return p === ROOT || p.startsWith(ROOT + path.sep) ? p : null;
}

async function readTarget(file) {
  const info = await stat(file);
  return info.isDirectory()
    ? { file: path.join(file, "index.html"), body: await readFile(path.join(file, "index.html")) }
    : { file, body: await readFile(file) };
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname === "/__reload") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    res.write(": ok\n\n");
    clients.add(res);
    req.on("close", () => clients.delete(res));
    return;
  }

  // Mọi thứ no-store: cache của trình duyệt lúc dev chỉ tổ làm mình sửa xong
  // không thấy đổi rồi đi tìm nhầm chỗ.
  const send = (code, type, body) =>
    res.writeHead(code, { "Content-Type": type, "Cache-Control": "no-store" }).end(body);

  if (url.pathname === "/core/config.js") {
    try {
      return send(200, MIME[".js"], await buildConfig());
    } catch (e) {
      return send(500, MIME[".txt"], String(e.message));
    }
  }

  const target = resolveSafe(url.pathname);
  if (!target) return send(403, MIME[".txt"], "Forbidden");

  let hit;
  try {
    hit = await readTarget(target);
  } catch {
    // Không có file → trả 404.html như Cloudflare (not_found_handling: "404-page"),
    // nhờ vậy clean URL `/<slug>` của thiệp chạy được ở local đúng như production.
    try {
      const body = await readFile(path.join(ROOT, "404.html"), "utf8");
      return send(404, MIME[".html"], RELOAD ? body + RELOAD_SNIPPET : body);
    } catch {
      return send(404, MIME[".txt"], "404");
    }
  }

  const ext = path.extname(hit.file).toLowerCase();
  const type = MIME[ext] || "application/octet-stream";
  if (ext === ".html" && RELOAD) {
    return send(200, type, hit.body.toString("utf8") + RELOAD_SNIPPET);
  }
  send(200, type, hit.body);
});

server.listen(PORT, () => {
  const env = ENV === "production" ? "PRODUCTION (dữ liệu thật)" : ENV.toUpperCase();
  console.log(`\n  Cưới Xinh — http://localhost:${PORT}`);
  console.log(`  Môi trường: ${env}`);
  console.log(`  Tự tải lại: ${RELOAD ? "bật" : "tắt"}\n`);
  if (RELOAD) watchRepo();
});
