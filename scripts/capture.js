const puppeteer = require("puppeteer");
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const THEMES_DIR = path.join(ROOT, "public", "themes");
const OUT_DIR = path.join(ROOT, "assets", "images", "templates");
const STATIC_PORT = 3002;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
  ".json": "application/json",
  ".ico": "image/x-icon",
};

function startStaticServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const urlPath = req.url.split("?")[0].split("#")[0];
      const filePath = path.join(ROOT, decodeURIComponent(urlPath));

      // Security: stay within ROOT
      if (!filePath.startsWith(ROOT)) {
        res.writeHead(403).end();
        return;
      }

      fs.readFile(filePath, (err, data) => {
        if (err) {
          res.writeHead(404).end("Not found");
          return;
        }
        const ext = path.extname(filePath).toLowerCase();
        res.setHeader("Content-Type", MIME[ext] || "application/octet-stream");
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.writeHead(200).end(data);
      });
    });

    server.on("error", reject);
    server.listen(STATIC_PORT, "127.0.0.1", () => resolve(server));
  });
}

// Chụp CẢ TRANG thiệp (dải dài) → assets/images/templates/<tên>.jpg.
async function captureAll(onProgress = console.log, selected = null) {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  // Read template folder names, optionally filtered by selected list
  let templates = fs
    .readdirSync(THEMES_DIR)
    .filter((d) => {
      try {
        return fs.statSync(path.join(THEMES_DIR, d)).isDirectory();
      } catch {
        return false;
      }
    })
    .filter((d) => !d.startsWith("."));

  if (selected && selected.length) {
    templates = templates.filter((d) => selected.includes(d));
  }

  if (!templates.length) {
    onProgress("⚠️  Không tìm thấy template nào trong public/themes/");
    return [];
  }

  onProgress(`🔍 Tìm thấy ${templates.length} template: ${templates.join(", ")}`);

  let staticServer;
  let browser;

  try {
    onProgress("🌐 Khởi động static server...");
    staticServer = await startStaticServer();

    onProgress("🚀 Khởi động Chromium...");
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });

    const results = [];

    for (const name of templates) {
      const url = `http://127.0.0.1:${STATIC_PORT}/public/themes/${name}/index.html?preview=true`;
      const outPath = path.join(OUT_DIR, `${name}.jpg`);
      const outRel = path.relative(ROOT, outPath).split(path.sep).join("/");

      onProgress(`📸 [${name}] Đang chụp...`);

      try {
        const page = await browser.newPage();
        await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });

        await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });

        // Mẫu tự khai CX_THEME.noScan = true thì bỏ qua (mẫu nền, mẫu đang làm
        // dở). Chỉ biết được sau khi nạp trang vì cờ nằm trong JS của mẫu —
        // CX_THEME là nguồn sự thật duy nhất, không dựng danh sách loại trừ ở đây.
        const skip = await page.evaluate(() => !!window.CX_THEME?.noScan);
        if (skip) {
          await page.close();
          results.push({ name, ok: true, skipped: true });
          onProgress(`⏭️  [${name}] Bỏ qua (CX_THEME.noScan)`);
          continue;
        }

        // Thứ gì không được vào ảnh thì TỰ ĐÁNH DẤU bằng data-no-scan ở nơi
        // dựng ra nó (thanh xem thử ở core/utils.js, trình phát nhạc ở
        // core/components/music-player.js…) — file này không giữ danh sách
        // phần tử của bất kỳ mẫu nào.
        // padding-bottom là chỗ thanh xem thử chừa ở đáy — giấu thanh rồi thì
        // khoảng chừa đó thành dải trắng cuối ảnh, phải trả về 0.
        await page.addStyleTag({
          content:
            "body{padding-bottom:0!important}" +
            "[data-no-scan]{display:none!important}",
        });

        // Wait for fonts and animations
        await new Promise((r) => setTimeout(r, 2500));

        // Cuộn hết trang cho nội dung lazy + hiệu ứng reveal chạy, rồi về đầu.
        await page.evaluate(async () => {
          await new Promise((r) => {
            let y = 0;
            const step = () => {
              window.scrollBy(0, 300);
              y += 300;
              if (y < document.body.scrollHeight) requestAnimationFrame(step);
              else { window.scrollTo(0, 0); r(); }
            };
            requestAnimationFrame(step);
          });
        });
        await new Promise((r) => setTimeout(r, 1000));

        await page.screenshot({ path: outPath, type: "jpeg", quality: 90, fullPage: true });
        await page.close();

        results.push({ name, path: outPath, ok: true });
        onProgress(`✅ [${name}] Đã lưu → ${outRel}`);
      } catch (err) {
        results.push({ name, ok: false, error: err.message });
        onProgress(`❌ [${name}] Lỗi: ${err.message}`);
      }
    }

    return results;
  } finally {
    if (browser) await browser.close().catch(() => {});
    if (staticServer) staticServer.close();
  }
}

module.exports = { captureAll };

// Run directly: node capture.js
if (require.main === module) {
  captureAll().then((results) => {
    const ok = results.filter((r) => r.ok).length;
    console.log(`\nHoàn thành: ${ok}/${results.length} template.`);
  }).catch(console.error);
}
