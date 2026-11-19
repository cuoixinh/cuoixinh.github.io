// puppeteer-core lái Google Chrome đã cài trên máy (channel "chrome"), không tự tải Chromium.
const puppeteer = require("puppeteer-core");
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const THEMES_DIR = path.join(ROOT, "public", "themes");
const OUT_DIR = path.join(ROOT, "assets", "images", "templates");
// Ảnh TRỌN thiệp (bìa + cả thân) cho khung "Xem nhanh" (core/components/quick-preview.js).
const LONG_DIR = path.join(ROOT, "assets", "images", "templates-scroll");
const LONG_W = 600; // bề ngang ảnh dài: khung xem nhanh hiện ~330px, đủ nét trên màn x2
const LONG_Q = 0.74;
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

// Khổ ảnh mẫu = lõi màn của mockup điện thoại (391×722), đúng tỉ lệ thẻ mẫu
// (.tt-media ở styles/tailwind-src.css); khung nhìn bằng khổ này nên màn bìa cao
// 100dvh vừa khít một tấm. Đổi số ở đây thì đổi luôn aspect-ratio của .tt-media
// và .tt-skel-media (theme-template/index.html).
const SHOT_W = 391;
const SHOT_H = 722;

// Chụp MÀN ĐẦU của thiệp (khổ 391:722) → assets/images/templates/<tên>.jpg, rồi
// mở thiệp chụp TRỌN → assets/images/templates-scroll/<tên>.jpg.
async function captureAll(onProgress = console.log, selected = null) {
  for (const d of [OUT_DIR, LONG_DIR]) if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });

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
    // CHROME_PATH: máy không cài Google Chrome (CI, container) thì chỉ thẳng tới một bản Chromium.
    browser = await puppeteer.launch({
      headless: true,
      ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: "chrome" }),
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });

    const results = [];

    for (const name of templates) {
      const url = `http://127.0.0.1:${STATIC_PORT}/public/themes/${name}/index.html?preview=true&nosug=1`;
      const outPath = path.join(OUT_DIR, `${name}.jpg`);
      const outRel = path.relative(ROOT, outPath).split(path.sep).join("/");

      onProgress(`📸 [${name}] Đang chụp...`);

      try {
        const page = await browser.newPage();
        // Khung nhìn ĐÚNG bằng khổ ảnh: mục nào cao 100dvh (màn bìa) cũng vừa
        // khít một tấm, chụp xong không phải cắt lại.
        await page.setViewport({
          width: SHOT_W,
          height: SHOT_H,
          deviceScaleFactor: 2,
        });

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
        // padding-bottom về 0 là phòng xa: mẫu nào tự chừa chỗ ở đáy cho thanh
        // xem thử thì giấu thanh xong khoảng chừa đó thành dải trắng cuối ảnh.
        // .reveal (hiệu ứng hiện dần của _common.css) ép hiện luôn: ảnh dài chụp cả thân
        // thiệp một lần, khối nào chưa lọt khung nhìn lúc cuộn qua sẽ thành mảng trống.
        await page.addStyleTag({
          content:
            "body{padding-bottom:0!important}" +
            "[data-no-scan]{display:none!important}" +
            ".reveal{opacity:1!important;transform:none!important;transition:none!important}",
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

        // fullPage: false — chỉ lấy khung nhìn (một tấm 391:722 ở đầu thiệp).
        const head = await page.screenshot({
          type: "jpeg",
          quality: 90,
          clip: { x: 0, y: 0, width: SHOT_W, height: SHOT_H },
        });
        fs.writeFileSync(outPath, head);
        onProgress(`✅ [${name}] Đã lưu → ${outRel}`);

        const longPath = path.join(LONG_DIR, `${name}.jpg`);
        const parts = await captureBody(page, head);
        fs.writeFileSync(longPath, await stitch(browser, parts));
        await page.close();

        results.push({ name, path: outPath, ok: true });
        onProgress(`✅ [${name}] Ảnh trọn thiệp (${parts.length} mảnh) → ${path.relative(ROOT, longPath).split(path.sep).join("/")}`);
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

// Thân thiệp sau màn đầu, thành một dãy ảnh xếp dọc. Mẫu có bìa: mở bìa (đúng
// đường khách bấm) rồi chụp thân, ảnh màn đầu đứng trên cùng. Mẫu không cuộn trang
// (khai CX_THEME.deck) chụp từng màn rồi xếp nối; còn lại chụp cả trang một lần.
async function captureBody(page, head) {
  const hasCover = await page.evaluate(() => {
    const c = document.getElementById("cover-screen");
    return !!c && getComputedStyle(c).display !== "none" && typeof window.openInvitation === "function";
  });
  const parts = [];
  if (hasCover) {
    parts.push(head);
    await page.evaluate(() => window.openInvitation());
    await new Promise((r) => setTimeout(r, 2500));
  }

  const deckCount = await page.evaluate(() => window.CX_THEME?.deck?.slides?.().length || 0);
  if (deckCount) {
    for (let i = 0; i < deckCount; i++) {
      await page.evaluate((k) => {
        const d = window.CX_THEME.deck;
        d.show(d.slides()[k]);
      }, i);
      // Đợi hiệu ứng vào màn của slide chạy xong (chữ hiện dần lệch nhịp nhau).
      await new Promise((r) => setTimeout(r, 2600));
      parts.push(await page.screenshot({ type: "png" }));
    }
    return parts;
  }

  // Cuộn hết thân cho ảnh lazy + đếm số chạy, rồi đợi ảnh tải xong mới chụp.
  await page.evaluate(async () => {
    for (let y = 0; y < document.documentElement.scrollHeight; y += 300) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 40));
    }
    await Promise.all(
      Array.from(document.images)
        .filter((im) => im.src && !im.complete)
        .map((im) => new Promise((r) => { im.onload = im.onerror = r; setTimeout(r, 5000); })),
    );
    window.scrollTo(0, 0);
  });
  await new Promise((r) => setTimeout(r, 800));
  // Không bìa thì màn đầu nằm sẵn trong ảnh cả trang — khỏi xếp ảnh màn đầu lên trên.
  parts.push(await page.screenshot({ type: "png", fullPage: true }));
  return parts;
}

// Ghép dãy ảnh thành một JPEG bề ngang LONG_W — vẽ bằng canvas trong chính Chromium
// đang chạy để khỏi kéo thêm thư viện xử lý ảnh.
async function stitch(browser, parts) {
  const page = await browser.newPage();
  try {
    const b64 = await page.evaluate(
      async (srcs, W, Q) => {
        const imgs = await Promise.all(
          srcs.map((s) => new Promise((ok, no) => {
            const im = new Image();
            im.onload = () => ok(im);
            im.onerror = no;
            im.src = s;
          })),
        );
        const hs = imgs.map((im) => Math.round((im.naturalHeight * W) / im.naturalWidth));
        const c = document.createElement("canvas");
        c.width = W;
        c.height = hs.reduce((a, b) => a + b, 0);
        const g = c.getContext("2d");
        g.imageSmoothingQuality = "high";
        let y = 0;
        imgs.forEach((im, i) => {
          g.drawImage(im, 0, y, W, hs[i]);
          y += hs[i];
        });
        return c.toDataURL("image/jpeg", Q).split(",")[1];
      },
      parts.map((b) => `data:image/${b[0] === 0x89 ? "png" : "jpeg"};base64,${Buffer.from(b).toString("base64")}`),
      LONG_W,
      LONG_Q,
    );
    return Buffer.from(b64, "base64");
  } finally {
    await page.close();
  }
}

module.exports = { captureAll };

// Run directly: node capture.js
if (require.main === module) {
  // node scripts/capture.js [mẫu…] — không kèm tên thì chụp tất cả.
  const only = process.argv.slice(2);
  captureAll(console.log, only.length ? only : null).then((results) => {
    const ok = results.filter((r) => r.ok).length;
    console.log(`\nHoàn thành: ${ok}/${results.length} template.`);
  }).catch(console.error);
}
