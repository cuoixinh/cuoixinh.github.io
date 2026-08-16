const puppeteer = require("puppeteer");
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const THEMES_DIR = path.join(ROOT, "public", "themes");
const OUT_DIR = path.join(ROOT, "assets", "images", "templates");
const STATIC_DIR = path.join(ROOT, "assets", "images", "templates-static");
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

// mode → chụp gì, ghi đâu. Tên file LUÔN là <tên>.jpg, chỉ khác thư mục:
//   "full"  → cả trang, cuộn hết  → assets/images/templates/<tên>.jpg
//   "cover" → màn bìa, 1 khung    → assets/images/templates-static/<tên>.jpg
//   "hero"  → mục hero, 1 khung   → assets/images/templates-static/<tên>.jpg
// Ảnh tĩnh của một mẫu chỉ có MỘT bản: cover hay hero là do mẫu đó hợp cái
// nào, chọn lúc scan rồi ghi đè lên nhau — bên hiển thị (thẻ ở màn Mẫu thiệp)
// cứ lấy templates-static/<tên>.jpg, không phải biết nó được chụp kiểu gì.
// Thư mục tách riêng vì ảnh toàn trang là dải dài cho ô tự cuộn ở trang chủ.
async function captureAll(onProgress = console.log, selected = null, mode = "full") {
  const still = mode === "cover" || mode === "hero"; // chỉ chụp một khung nhìn
  const outDir = still ? STATIC_DIR : OUT_DIR;
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

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

    // Ba mốc theo QUY ƯỚC chung của mọi thiệp (xem CLAUDE.md, mục theme mới),
    // không phải đặc thù mẫu nào. Mẫu đặt id khác thì khai đè trong index.js
    // của mình: CX_THEME.scan = { cover: "#…", hero: "#…" } — đừng thêm nhánh
    // "nếu là mẫu X" vào file này.
    const SEL = { cover: "#cover-screen", main: "#main-card", hero: "#section-hero" };

    for (const name of templates) {
      const url = `http://127.0.0.1:${STATIC_PORT}/public/themes/${name}/index.html?preview=true`;
      const outPath = path.join(outDir, `${name}.jpg`);
      const outRel = path.relative(ROOT, outPath).split(path.sep).join("/");

      const label = { full: "toàn trang", cover: "ảnh bìa", hero: "màn hero" }[mode];
      onProgress(`📸 [${name}] Đang chụp ${label}...`);

      try {
        const page = await browser.newPage();
        // Ảnh tĩnh dựng thẳng trong khung VUÔNG 390×390 (ra 780×780) để chính
        // theme tự co giãn cho vừa ô vuông — thiệp phải responsive tới tỉ lệ
        // này. Chụp 390×844 rồi cắt thì luôn phải hy sinh một khúc.
        await page.setViewport({
          width: 390,
          height: still ? 390 : 844,
          deviceScaleFactor: 2,
        });

        await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });

        // Cờ bỏ qua do CHÍNH mẫu khai trong index.js:
        //   noScan       — bỏ mọi chế độ (mẫu nền, mẫu đang làm dở)
        //   noScanStatic — chỉ bỏ ảnh tĩnh cover/hero, vẫn chụp ảnh dài (mẫu
        //                  chưa dựng bìa/hero cho khung vuông)
        // Chỉ biết được sau khi nạp trang vì cờ nằm trong JS của mẫu —
        // CX_THEME là nguồn sự thật duy nhất, không dựng danh sách loại trừ ở đây.
        const flags = await page.evaluate(() => ({
          all: !!window.CX_THEME?.noScan,
          still: !!window.CX_THEME?.noScanStatic,
          sel: window.CX_THEME?.scan || null,
        }));
        // Mẫu tự khai id khác quy ước thì lấy của mẫu.
        const SELT = { ...SEL, ...(flags.sel || {}) };
        const skipBy = flags.all ? "noScan" : still && flags.still ? "noScanStatic" : null;
        if (skipBy) {
          await page.close();
          results.push({ name, ok: true, skipped: true });
          onProgress(`⏭️  [${name}] Bỏ qua (CX_THEME.${skipBy})`);
          continue;
        }

        // Thứ gì không được vào ảnh thì TỰ ĐÁNH DẤU ở nơi dựng ra nó, file này
        // không giữ danh sách phần tử của bất kỳ mẫu nào. Thuộc tính trần,
        // không cần giá trị:
        //   data-no-scan         — biến mất ở mọi chế độ (thanh xem thử ở
        //     core/utils.js, trình phát nhạc ở core/components/music-player.js…)
        //   data-no-scan-static  — chỉ ở ảnh tĩnh; dành cho chi tiết hợp lý khi
        //     xem cả trang nhưng lọt vào ảnh vuông thì thừa
        // padding-bottom là chỗ thanh xem thử chừa ở đáy — giấu thanh rồi thì
        // khoảng chừa đó thành dải trắng cuối ảnh, phải trả về 0.
        await page.addStyleTag({
          content:
            "body{padding-bottom:0!important}" +
            "[data-no-scan]{display:none!important}" +
            (still ? "[data-no-scan-static]{display:none!important}" : ""),
        });

        // Trang mở bằng ?preview=true — bắt buộc, không có nó loadWeddingData
        // đá về "/" vì URL không mang slug. Nhưng preview cũng tự BỎ QUA màn
        // bìa (openInvitation ẩn màn bìa ngay), nên chế độ cover phải dựng lại:
        // hiện bìa, giấu ruột thiệp.
        // Mẫu không có màn bìa (vd romantic-gold) thì không làm gì — khung hình
        // đầu của thiệp chính là phần hero, đúng thứ đang cần.
        if (mode === "cover") {
          await page.evaluate((sel) => {
            const c = document.querySelector(sel.cover);
            const m = document.querySelector(sel.main);
            if (!c) return;
            c.style.display = "";
            if (m) m.style.display = "none";
            window.scrollTo(0, 0);
          }, SELT);
        }

        // Wait for fonts and animations
        await new Promise((r) => setTimeout(r, 2500));

        // Hero = mục ĐẦU trong lòng thiệp (đã mở sẵn nhờ preview). Kéo nó lên
        // đỉnh khung nhìn rồi chờ hiệu ứng reveal của chính nó chạy xong.
        if (mode === "hero") {
          await page.evaluate((sel) => {
            const h = document.querySelector(sel.hero);
            if (h) h.scrollIntoView({ block: "start" });
          }, SELT);
          await new Promise((r) => setTimeout(r, 1200));
        }

        // Cuộn hết trang cho nội dung lazy + hiệu ứng reveal chạy, rồi về đầu.
        // Ảnh tĩnh bỏ qua: chỉ chụp một khung, mà cuộn sẽ làm lệch khung đó.
        if (!still) {
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
        }

        // Ảnh tĩnh = đúng khung nhìn vuông đã dựng ở trên; toàn trang = cả
        // chiều dài trang.
        await page.screenshot({ path: outPath, type: "jpeg", quality: 90, fullPage: !still });
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
