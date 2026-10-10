// Chụp một thiệp tham khảo (URL bất kỳ) ở khổ điện thoại thật, để làm mẫu mới.
// Ra .ref-shots/<tên>/: screen-01.png… (từng màn khi cuộn), full.png (cả trang, nếu cuộn thật), page.html, images.txt.
// Dùng: npm run capture:ref -- <url> [--name x] [--device "iPhone 15 Pro"] [--wait 4000] [--max 80] [--no-full] [--headed]
import puppeteer, { KnownDevices } from "puppeteer-core";
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const opt = (k, d) => {
  const i = args.indexOf(`--${k}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : d;
};
const flag = (k) => args.includes(`--${k}`);
const url = args.find((a) => /^https?:\/\//.test(a));
if (!url) {
  console.log('Dùng: npm run capture:ref -- <url> [--name x] [--device "iPhone 15 Pro"] [--wait 4000] [--max 80] [--no-full] [--headed]');
  process.exit(1);
}

const deviceName = opt("device", "iPhone 15 Pro");
const device = KnownDevices[deviceName];
if (!device) {
  console.log(`Không có thiết bị "${deviceName}". Ví dụ: ${Object.keys(KnownDevices).filter((n) => /iPhone 1[45]/.test(n)).join(", ")}`);
  process.exit(1);
}
const name = opt("name", new URL(url).hostname.replace(/^www\./, "") + "-" + (new URL(url).pathname.split("/").filter(Boolean).pop() || "home"));
const wait = +opt("wait", 4000);
const maxScreens = +opt("max", 80);
const outDir = path.join(process.cwd(), ".ref-shots", name);
fs.mkdirSync(outDir, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({ channel: "chrome", headless: !flag("headed") });
try {
  const page = await browser.newPage();
  await page.emulate(device);
  console.log(`🌐 ${url} — ${deviceName} ${device.viewport.width}×${device.viewport.height}`);
  await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });
  // Thiệp thường gọi API rồi mới dựng nội dung sau networkidle: chờ tới khi số ảnh đã tải
  // đứng yên 3 nhịp liền (tối đa 30s), rồi chờ thêm --wait cho hiệu ứng mở đầu chạy xong.
  for (let t = 0, prevCount = -1, still = 0; t < 30 && still < 3; t++) {
    await sleep(1000);
    const count = await page.evaluate(() => [...document.images].filter((i) => i.complete && i.naturalWidth > 1).length);
    still = count > 0 && count === prevCount ? still + 1 : 0;
    prevCount = count;
  }
  await sleep(wait);

  // Nhiều trang thiệp cuộn trong một khung con chứ không cuộn window: chọn phần tử cuộn được lớn nhất.
  const scrollInfo = () =>
    page.evaluate(() => {
      const root = document.scrollingElement;
      let best = root, bestH = root.scrollHeight - root.clientHeight;
      for (const el of document.querySelectorAll("body *")) {
        const st = getComputedStyle(el);
        if (!/(auto|scroll)/.test(st.overflowY)) continue;
        const h = el.scrollHeight - el.clientHeight;
        if (h > bestH + 50 && el.clientHeight > innerHeight * 0.5) { best = el; bestH = h; }
      }
      window.__cxRefScroller = best;
      return { max: bestH, view: best === root ? innerHeight : best.clientHeight, top: best.scrollTop };
    });

  let info = await scrollInfo();
  // Trang cuộn bằng thư viện JS (better-scroll, swiper… dịch bằng transform) thì không có
  // scrollTop để đọc: giả lập vuốt bằng ngón tay, mỗi lần nửa màn.
  const jsScroll = info.max <= 2;
  const cdp = await page.createCDPSession();
  const { width: vw, height: vh } = device.viewport;
  // Toạ độ dọc của các ảnh trước/sau một lần vuốt: phần lớn (≥70%) đứng yên là đã tới đáy.
  // Không so pixel được vì đĩa nhạc quay, dải quà tự trượt… khiến hai ảnh không bao giờ trùng.
  const imgTops = () =>
    page.evaluate(() => [...document.images].map((i) => Math.round(i.getBoundingClientRect().top)));
  let n = 0, last = -1, prevTops = null;
  while (n < maxScreens) {
    const tops = await imgTops();
    if (jsScroll && prevTops && tops.length === prevTops.length && tops.length) {
      const still = tops.filter((t, i) => Math.abs(t - prevTops[i]) <= 1).length;
      if (still / tops.length >= 0.7) break;
    }
    prevTops = tops;
    n++;
    const file = path.join(outDir, `screen-${String(n).padStart(2, "0")}.png`);
    await page.screenshot({ path: file });
    console.log(`📸 ${path.relative(process.cwd(), file)}`);
    if (jsScroll) {
      await cdp.send("Input.synthesizeScrollGesture", {
        x: Math.round(vw / 2), y: Math.round(vh * 0.6),
        yDistance: -Math.round(vh * 0.45), speed: 800,
        gestureSourceType: "touch", preventFling: true,
      });
    } else {
      info = await scrollInfo();
      if (info.top >= info.max - 2 || info.top === last) break;
      last = info.top;
      // Cuộn 90% màn để hai ảnh liền nhau gối lên nhau một chút, không sót đường nối.
      await page.evaluate((dy) => window.__cxRefScroller.scrollBy({ top: dy, behavior: "instant" }), Math.round(info.view * 0.9));
    }
    await sleep(1200);
  }
  if (jsScroll) console.log("ℹ️  Trang cuộn bằng JS — đã chụp bằng vuốt giả lập; full.png chỉ có màn cuối.");

  // Ảnh cả trang chỉ có nghĩa khi window cuộn; trang cuộn trong khung con thì xem các screen-*.png.
  if (!flag("no-full") && !jsScroll) {
    await page.evaluate(() => window.__cxRefScroller.scrollTo({ top: 0, behavior: "instant" }));
    await sleep(800);
    await page.screenshot({ path: path.join(outDir, "full.png"), fullPage: true });
    console.log("📸 full.png");
  }

  fs.writeFileSync(path.join(outDir, "page.html"), await page.content());
  const imgs = await page.evaluate(() => {
    const set = new Set();
    document.querySelectorAll("img[src]").forEach((i) => set.add(i.currentSrc || i.src));
    document.querySelectorAll("*").forEach((el) => {
      const bg = getComputedStyle(el).backgroundImage;
      for (const m of bg.matchAll(/url\("?([^")]+)"?\)/g)) set.add(m[1]);
    });
    return [...set].filter((u) => !u.startsWith("data:"));
  });
  fs.writeFileSync(path.join(outDir, "images.txt"), imgs.join("\n") + "\n");
  console.log(`✅ Xong → .ref-shots/${name}/ (${n} màn, ${imgs.length} ảnh trong images.txt)`);
} finally {
  if (flag("headed")) {
    console.log("Đóng cửa sổ Chrome để kết thúc.");
    await new Promise((r) => browser.on("disconnected", r));
  } else await browser.close();
}
