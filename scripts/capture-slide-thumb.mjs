// Chụp thumb.jpg (640×360) cho mẫu slide: mở slide-cuoi/templates/<id>/ bằng Chrome không giao
// diện (dữ liệu mẫu theo CX_SLIDE.demo), dựng lại bằng CXSlideEngine rồi vẽ đúng một khung hình.
// node scripts/capture-slide-thumb.mjs [id…] [--scene=open] [--at=<giây trong cảnh>]
// Không khai --at thì lấy lúc mọi thứ trong cảnh đã hiện đủ (scene.still).
import puppeteer from "puppeteer-core";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const TPL_DIR = path.join(ROOT, "slide-cuoi", "templates");
const PORT = 3003;
const OUT_W = 640;
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
};

const args = process.argv.slice(2);
const opt = (k) => args.find((a) => a.startsWith(`--${k}=`))?.split("=")[1];
const sceneId = opt("scene") || "open";
const at = opt("at") != null ? Number(opt("at")) : null;
let ids = args.filter((a) => !a.startsWith("--"));
if (!ids.length) ids = fs.readdirSync(TPL_DIR).filter((d) => fs.existsSync(path.join(TPL_DIR, d, "index.js")));

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0].split("#")[0]);
  if (p.endsWith("/")) p += "index.html";
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT)) return res.writeHead(403).end();
  fs.readFile(file, (err, data) => {
    if (err) return res.writeHead(404).end("Not found");
    res.setHeader("Content-Type", MIME[path.extname(file).toLowerCase()] || "application/octet-stream");
    res.writeHead(200).end(data);
  });
});
await new Promise((r) => server.listen(PORT, "127.0.0.1", r));

const browser = await puppeteer.launch({ channel: "chrome", headless: true });
try {
  for (const id of ids) {
    const page = await browser.newPage();
    page.on("pageerror", (e) => console.warn(`  [${id}] lỗi trang:`, e.message));
    await page.setViewport({ width: 1280, height: 720 });
    await page.goto(`http://127.0.0.1:${PORT}/slide-cuoi/templates/${id}/index.html`, { waitUntil: "networkidle0" });
    const out = await page.evaluate(
      async (sceneId, at, outW) => {
        const D = window.CX_SLIDE;
        const E = window.CXSlideEngine;
        if (D.demo) window.currentThemeName = () => D.demo;
        const w = await cxPreviewWedding();
        const P = await E.build(D, w, {}, {}, {});
        const i = Math.max(0, P.scenes.findIndex((s) => s.id === sceneId));
        const s = P.scenes[i];
        const c = document.createElement("canvas");
        c.width = outW;
        c.height = Math.round((outW * P.H) / P.W);
        E.frame(c.getContext("2d", { alpha: false }), P, P.starts[i] + (at == null ? s.still : Math.min(at, s.dur - 0.05)), { loop: true });
        return { scene: s.id, data: c.toDataURL("image/jpeg", 0.86) };
      },
      sceneId,
      at,
      OUT_W,
    );
    const file = path.join(TPL_DIR, id, "thumb.jpg");
    fs.writeFileSync(file, Buffer.from(out.data.split(",")[1], "base64"));
    console.log(`✓ ${id} (cảnh ${out.scene}) → ${path.relative(ROOT, file)}`);
    await page.close();
  }
} finally {
  await browser.close();
  server.close();
}
