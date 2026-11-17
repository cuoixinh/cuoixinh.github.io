// Gác ánh xạ "bấm lên thiệp để sửa" (core/helpers/preview-pick.js) cho MỌI mẫu thiệp:
// mở từng mẫu ở chế độ ?preview=true&pick=1 bằng dữ liệu mẫu, đếm số chỗ trên thiệp ứng
// với từng cột, so với scripts/inline-map-baseline.json. Cột đang ánh xạ được mà nay về 0
// → DỪNG (ánh xạ lệch âm thầm khi sửa mẫu/helper). `-- --write` ghi lại mốc.
// Cần Playwright (có sẵn trong môi trường cloud; máy local: npx playwright install chromium).
import fs from "node:fs";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const R = fileURLToPath(new URL("..", import.meta.url));
const BASE = R + "scripts/inline-map-baseline.json";
const WRITE = process.argv.includes("--write");
const PORT = 5600 + Math.floor(Math.random() * 300);

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require("playwright"));
} catch (e) {
  console.error("Thiếu Playwright: npm i -D playwright && npx playwright install chromium");
  process.exit(2);
}

const themes = fs
  .readdirSync(R + "public/themes", { withFileTypes: true })
  .filter((d) => d.isDirectory() && fs.existsSync(`${R}public/themes/${d.name}/index.html`))
  .map((d) => d.name)
  .sort();

const server = spawn(process.execPath, [R + "scripts/dev-server.mjs", `--port=${PORT}`, "--no-reload"], {
  cwd: R,
  stdio: ["ignore", "pipe", "inherit"],
});
await new Promise((ok, fail) => {
  server.stdout.on("data", (b) => String(b).includes(`${PORT}`) && ok());
  server.on("exit", () => fail(new Error("dev-server không chạy được")));
});

const result = {};
const browser = await chromium.launch();
try {
  for (const theme of themes) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const url = `http://localhost:${PORT}/public/themes/${theme}/?preview=true&pick=1`;
    await page.goto(url, { waitUntil: "load" });
    // Dựng xong = CXPick.done() đã chạy; chờ thêm một nhịp cho ảnh lazy/carousel.
    await page.waitForFunction(() => window.CXPick && document.querySelector("[data-cx-field]"), null, { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1500);
    result[theme] = await page.evaluate(() => (window.CXPick ? window.CXPick.scan() : {}));
    await page.close();
  }
} finally {
  await browser.close();
  server.kill();
}

const fields = [...new Set(Object.values(result).flatMap((r) => Object.keys(r)))].sort();
for (const t of themes) {
  const r = result[t];
  console.log(`${t.padEnd(24)} ${String(fields.filter((f) => r[f]).length).padStart(2)} cột · ${Object.values(r).reduce((a, b) => a + b, 0)} chỗ`);
}

if (WRITE) {
  fs.writeFileSync(BASE, JSON.stringify(result, null, 2) + "\n");
  console.log(`\nĐã ghi mốc: ${BASE}`);
  process.exit(0);
}

const base = fs.existsSync(BASE) ? JSON.parse(fs.readFileSync(BASE, "utf8")) : null;
if (!base) {
  console.error("\nChưa có mốc — chạy: npm run check:inline-map -- --write");
  process.exit(1);
}
const lost = [];
for (const [t, r] of Object.entries(base)) {
  for (const f of Object.keys(r)) if (r[f] && !result[t]?.[f]) lost.push(`${t}: ${f}`);
}
if (lost.length) {
  console.error(`\nMẤT ánh xạ (${lost.length}) — bấm lên chỗ đó trên thiệp không còn nhảy đúng ô:\n  ` + lost.join("\n  "));
  console.error("Cố ý bỏ thì chạy lại với -- --write.");
  process.exit(1);
}
console.log("\nÁnh xạ đủ như mốc.");
