// Bộ quay "Tạo Video Quảng Cáo" (tab admin) — chạy TRONG `npm run dev`, ở đường /__promo-video/*.
// Chrome không giao diện mở admin/promo-video/stage.html, tiêm đồng hồ ảo (clock.js) rồi
// chụp từng khung → ffmpeg ghép MP4 9:16 (1080×1920), nhạc nền tuỳ chọn. Video ghi ra
// .promo-videos/ (không vào git). Chrome: kênh "chrome" đã cài trên máy, hoặc biến CX_CHROME.
import { spawn } from "node:child_process";
import { createReadStream, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const STAGE_W = 540;
const STAGE_H = 960;
const SCALE = 2; // → 1080×1920
const FPS_ALLOWED = [24, 30, 60];
const THEME_RE = /^[a-z0-9][a-z0-9-]*$/;

function ffmpegPath() {
  try {
    const p = require("ffmpeg-static");
    if (p && existsSync(p)) return p;
  } catch (_) {
    /* chưa cài → thử ffmpeg trong PATH */
  }
  return "ffmpeg";
}

function hasFfmpeg(bin) {
  return new Promise((resolve) => {
    const p = spawn(bin, ["-version"], { stdio: "ignore" });
    p.on("error", () => resolve(false));
    p.on("exit", (code) => resolve(code === 0));
  });
}

async function launchChrome() {
  const puppeteer = (await import("puppeteer-core")).default;
  const args = ["--no-sandbox", "--disable-dev-shm-usage", "--autoplay-policy=no-user-gesture-required", "--mute-audio"];
  const exe = process.env.CX_CHROME;
  return exe
    ? puppeteer.launch({ headless: true, executablePath: exe, args })
    : puppeteer.launch({ headless: true, channel: "chrome", args });
}

/** Quay một mẫu; onFrame(i, total) báo tiến độ. Trả về đường dẫn file MP4. */
async function renderOne(browser, { origin, root, theme, opts, outFile, audioFile, ffmpeg, onFrame, signal }) {
  const fps = opts.fps;
  const total = Math.round(opts.duration * fps);
  const page = await browser.newPage();
  let ff;
  try {
    await page.setViewport({ width: STAGE_W, height: STAGE_H, deviceScaleFactor: SCALE });
    // Server dev chèn một EventSource tự tải lại vào trang trên cùng — sửa file giữa
    // lúc quay là trang nạp lại. Bỏ đi trong phiên quay.
    await page.evaluateOnNewDocument("window.EventSource=function(){return{close(){}}};");
    await page.evaluateOnNewDocument(readFileSync(path.join(root, "admin/promo-video/clock.js"), "utf8"));

    const q = new URLSearchParams({
      theme,
      dur: String(opts.duration),
      title: opts.title,
      sub: opts.subs[theme] ?? "",
      foot: opts.foot,
      music: opts.music ? "1" : "0",
    });
    await page.goto(`${origin}/admin/promo-video/stage.html?${q}`, { waitUntil: "load", timeout: 60000 });
    await page.waitForFunction("window.CXPromo", { timeout: 20000 });
    await page.evaluate("window.CXPromo.ready");
    await page.evaluate("window.CXPromo.startClock()");

    const args = ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(fps), "-c:v", "mjpeg", "-i", "-"];
    if (audioFile) args.push("-stream_loop", "-1", "-i", audioFile);
    args.push("-map", "0:v", "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-r", String(fps));
    if (audioFile) {
      const fadeAt = Math.max(0, opts.duration - 1.5).toFixed(2);
      args.push("-map", "1:a", "-c:a", "aac", "-b:a", "192k", "-af", `afade=t=in:d=0.4,afade=t=out:st=${fadeAt}:d=1.5`);
    }
    args.push("-t", String(opts.duration), "-movflags", "+faststart", outFile);

    ff = spawn(ffmpeg, args, { stdio: ["pipe", "ignore", "pipe"] });
    let ffErr = "";
    ff.stderr.on("data", (b) => (ffErr += b));
    const ffDone = new Promise((resolve, reject) => {
      ff.on("error", reject);
      ff.on("exit", (code) => (code === 0 ? resolve() : reject(new Error("ffmpeg: " + (ffErr.trim() || "mã " + code)))));
    });

    const cdp = await page.createCDPSession();
    for (let i = 0; i < total; i++) {
      if (signal.aborted) throw new Error("Đã huỷ");
      await page.evaluate((t) => window.CXPromo.frame(t), i / fps);
      const { data } = await cdp.send("Page.captureScreenshot", {
        format: "jpeg",
        quality: 92,
        optimizeForSpeed: true,
        // Chrome không giao diện trả ảnh theo px CSS (540×960) dù đã đặt
        // deviceScaleFactor — phải nhân bằng clip.scale mới ra 1080×1920.
        clip: { x: 0, y: 0, width: STAGE_W, height: STAGE_H, scale: SCALE },
      });
      if (!ff.stdin.write(Buffer.from(data, "base64"))) {
        await new Promise((r) => ff.stdin.once("drain", r));
      }
      onFrame(i + 1, total);
    }
    ff.stdin.end();
    await ffDone;
    return outFile;
  } catch (e) {
    ff?.kill("SIGKILL");
    throw e;
  } finally {
    await page.close().catch(() => {});
  }
}

/**
 * Bộ định tuyến /__promo-video/* cho dev-server. Trả về true nếu đã xử lý request.
 *   GET  status                → { ffmpeg, outDir }
 *   POST audio  (thân = file)  → { id }  nhạc nền tạm cho các lượt quay sau
 *   POST jobs   (JSON)         → { id }  {themes[], duration, fps, title, foot, music, subs{}, audio?}
 *   GET  events?id=            → SSE tiến độ (phát lại từ đầu khi nối lại)
 *   POST cancel?id=
 *   GET  file/<tên>.mp4        → video đã quay
 */
export function promoVideoRoutes({ root, port }) {
  const outDir = path.join(root, ".promo-videos");
  const audioDir = path.join(tmpdir(), "cuoixinh-promo-audio");
  const jobs = new Map();
  let running = null; // chỉ một lượt quay mỗi lúc — Chrome + x264 đã ăn hết CPU
  const ffmpeg = ffmpegPath();

  function emit(job, ev) {
    job.events.push(ev);
    for (const res of job.clients) res.write(`data: ${JSON.stringify(ev)}\n\n`);
  }

  async function run(job) {
    const ac = job.ac;
    let browser;
    try {
      if (!(await hasFfmpeg(ffmpeg))) throw new Error("Không tìm thấy ffmpeg — chạy `npm install` ở thư mục gốc (gói ffmpeg-static).");
      mkdirSync(outDir, { recursive: true });
      emit(job, { type: "log", message: "Khởi động Chrome…" });
      browser = await launchChrome();
      for (const theme of job.opts.themes) {
        if (ac.signal.aborted) break;
        const name = `${theme}-${job.opts.duration}s.mp4`;
        emit(job, { type: "start", theme });
        let last = 0;
        try {
          await renderOne(browser, {
            origin: `http://localhost:${port}`,
            root,
            theme,
            opts: job.opts,
            outFile: path.join(outDir, name),
            audioFile: job.audioFile,
            ffmpeg,
            signal: ac.signal,
            onFrame: (i, total) => {
              const now = Date.now();
              if (i === total || now - last > 250) {
                last = now;
                emit(job, { type: "progress", theme, frame: i, total });
              }
            },
          });
          emit(job, { type: "done", theme, url: `/__promo-video/file/${encodeURIComponent(name)}`, file: `.promo-videos/${name}` });
        } catch (e) {
          emit(job, { type: "error", theme, message: e.message });
        }
      }
    } catch (e) {
      emit(job, { type: "error", message: e.message });
    } finally {
      await browser?.close().catch(() => {});
      emit(job, { type: "end" });
      for (const res of job.clients) res.end();
      job.clients.clear();
      running = null;
    }
  }

  const readBody = (req, limit) =>
    new Promise((resolve, reject) => {
      const chunks = [];
      let size = 0;
      req.on("data", (c) => {
        size += c.length;
        if (size > limit) {
          reject(new Error("Tệp quá lớn"));
          req.destroy();
        } else chunks.push(c);
      });
      req.on("end", () => resolve(Buffer.concat(chunks)));
      req.on("error", reject);
    });

  const json = (res, code, body) =>
    res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }).end(JSON.stringify(body));

  return async function handle(req, res, url) {
    if (!url.pathname.startsWith("/__promo-video/")) return false;
    const route = url.pathname.slice("/__promo-video/".length);
    try {
      if (route === "status" && req.method === "GET") {
        json(res, 200, { ffmpeg: await hasFfmpeg(ffmpeg), outDir: ".promo-videos/", busy: !!running });
      } else if (route === "audio" && req.method === "POST") {
        const buf = await readBody(req, 40 * 1024 * 1024);
        if (!buf.length) return json(res, 400, { error: "Tệp rỗng" }), true;
        mkdirSync(audioDir, { recursive: true });
        const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
        writeFileSync(path.join(audioDir, id), buf);
        json(res, 200, { id });
      } else if (route === "jobs" && req.method === "POST") {
        if (running) return json(res, 409, { error: "Đang quay một lượt khác" }), true;
        const b = JSON.parse((await readBody(req, 1024 * 1024)).toString("utf8") || "{}");
        const themes = (Array.isArray(b.themes) ? b.themes : []).filter((t) => THEME_RE.test(t) && existsSync(path.join(root, "public/themes", t, "index.html")));
        if (!themes.length) return json(res, 400, { error: "Chưa chọn mẫu nào" }), true;
        const audioFile = b.audio && /^[a-z0-9]+$/.test(b.audio) ? path.join(audioDir, b.audio) : null;
        if (audioFile && !existsSync(audioFile)) return json(res, 400, { error: "Nhạc nền đã hết hạn, chọn lại tệp" }), true;
        const opts = {
          themes,
          duration: Math.round(Math.min(120, Math.max(5, Number(b.duration) || 20))),
          fps: FPS_ALLOWED.includes(Number(b.fps)) ? Number(b.fps) : 30,
          title: String(b.title ?? "").slice(0, 80),
          foot: String(b.foot ?? "").slice(0, 80),
          music: b.music !== false,
          subs: b.subs && typeof b.subs === "object" ? b.subs : {},
        };
        const id = Date.now().toString(36);
        const job = { id, opts, audioFile, events: [], clients: new Set(), ac: new AbortController() };
        jobs.set(id, job);
        running = job;
        run(job);
        json(res, 200, { id });
      } else if (route === "events" && req.method === "GET") {
        const job = jobs.get(url.searchParams.get("id"));
        if (!job) return json(res, 404, { error: "Không có lượt quay này" }), true;
        res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
        for (const ev of job.events) res.write(`data: ${JSON.stringify(ev)}\n\n`);
        if (job.events.at(-1)?.type === "end") return res.end(), true;
        job.clients.add(res);
        req.on("close", () => job.clients.delete(res));
      } else if (route === "cancel" && req.method === "POST") {
        jobs.get(url.searchParams.get("id"))?.ac.abort();
        json(res, 200, { ok: true });
      } else if (route.startsWith("file/") && req.method === "GET") {
        const name = decodeURIComponent(route.slice(5));
        const file = path.join(outDir, name);
        if (!/^[a-z0-9-]+\.mp4$/.test(name) || !existsSync(file)) return json(res, 404, { error: "Không có tệp" }), true;
        res.writeHead(200, { "Content-Type": "video/mp4", "Content-Length": statSync(file).size, "Cache-Control": "no-store" });
        createReadStream(file).pipe(res);
      } else {
        json(res, 404, { error: "Không có đường này" });
      }
    } catch (e) {
      if (!res.headersSent) json(res, 500, { error: e.message });
    }
    return true;
  };
}
