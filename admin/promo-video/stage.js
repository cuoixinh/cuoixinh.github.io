// Đạo diễn của sân khấu video quảng cáo: nạp mẫu vào iframe, chờ ảnh/font xong, rồi
// dựng kịch bản theo thời lượng — giữ màn bìa → mở thiệp → cuộn qua từng mục (dừng
// một nhịp ở đầu mỗi mục) → giữ cuối. seek(t) chỉ phụ thuộc t nên bộ quay gọi theo
// từng khung (window.CXPromo.frame), còn tab admin xem trước bằng ?play=1 (giờ thật).
(function () {
  const q = new URLSearchParams(location.search);
  const THEME = (q.get("theme") || "").replace(/[^a-z0-9-]/gi, "");
  const DUR = Math.min(120, Math.max(5, Number(q.get("dur")) || 20));
  const SHOW_MUSIC = q.get("music") !== "0";
  const RENDER = !!window.__cxClock;

  const $ = (id) => document.getElementById(id);
  const view = $("pv-view");
  const phone = $("pv-phone");
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  $("pv-title").textContent = q.get("title") ?? "Thiệp cưới online";
  $("pv-sub").textContent = q.get("sub") ?? "";
  $("pv-foot").innerHTML = "";
  const foot = q.get("foot") ?? "cuoixinh.com";
  if (foot) {
    const dot = document.createElement("span");
    dot.className = "pv-dot";
    const txt = document.createElement("span");
    txt.textContent = foot;
    $("pv-foot").append(dot, txt);
  }

  if (THEME) {
    const bg = $("pv-bg-img");
    bg.onload = () => (bg.hidden = false);
    bg.src = `/assets/images/templates/${THEME}.jpg`;
  }

  function chrome(title) {
    const host = $("pv-chrome");
    host.innerHTML = window.CXPhoneChrome ? window.CXPhoneChrome.html({ title }) : "";
    measure();
  }

  // Cùng phép đo với khung máy của theme-boot.js: thiệp dựng ở 390px rồi thu theo ô màn.
  function measure() {
    const screen = phone.querySelector(".cx-pshell-screen");
    const port = phone.querySelector(".cx-pviewport");
    const scale = screen.offsetWidth / 390;
    phone.style.setProperty("--cx-scr-scale", String(scale));
    view.style.height = port.offsetHeight / scale + "px";
  }
  chrome("Thiệp cưới");

  // Thiệp chạy trong khung máy (shell=0) tự báo tên đôi uyên ương ra trang cha.
  let titled;
  const gotTitle = new Promise((r) => (titled = r));
  window.addEventListener("message", (e) => {
    if (e.source !== view.contentWindow || e.data?.type !== "cx-shell-title") return;
    chrome(e.data.title);
    titled();
  });

  const win = () => view.contentWindow;
  const doc = () => view.contentDocument;

  function hideChromeOfPreview(d) {
    const st = d.createElement("style");
    // [data-no-scan]: phần chỉ có nghĩa khi người thật xem thử (bảng gợi ý mẫu…) —
    // cùng quy ước với scripts/capture.js. Nút nhạc cũng mang cờ đó nên tách riêng.
    st.textContent =
      "[data-no-scan]:not([data-cx-music]){display:none!important}" +
      (SHOW_MUSIC ? "" : "[data-cx-music='root']{display:none!important}") +
      "html{scroll-behavior:auto!important}";
    d.head.appendChild(st);
  }

  // Ảnh dưới đáy để lazy thì chỉ tải khi cuộn tới → hiện ra giữa video. Ép tải hết.
  async function waitImages(d, ms) {
    d.querySelectorAll("img[loading='lazy']").forEach((img) => (img.loading = "eager"));
    const pending = () =>
      [...d.images].filter((img) => img.currentSrc && !img.currentSrc.startsWith("data:") && !img.complete);
    const until = Date.now() + ms;
    while (pending().length && Date.now() < until) await sleep(150);
  }

  const ready = new Promise((resolve, reject) => {
    if (!THEME) return reject(new Error("Thiếu ?theme="));
    view.addEventListener(
      "load",
      async () => {
        try {
          const d = doc();
          hideChromeOfPreview(d);
          await Promise.race([gotTitle, sleep(8000)]);
          await waitImages(d, 15000);
          await d.fonts?.ready;
          await sleep(1200);
          resolve();
        } catch (e) {
          reject(e);
        }
      },
      { once: true },
    );
    view.src = `/public/themes/${THEME}/?preview=true&shell=0`;
  });

  // ── Kịch bản ────────────────────────────────────────────────────────────────
  let plan = null;
  let opened = false;
  let hasCover = false;
  let tCover = 0;
  let tScroll = 0;
  let tEnd = 0;

  function setupTimes() {
    const d = doc();
    const cover = d.getElementById("cover-screen");
    const main = d.getElementById("main-card");
    hasCover = !!(cover && main && cover.offsetHeight > 0 && main.offsetHeight === 0);
    tCover = hasCover ? clamp(DUR * 0.12, 1.2, 2.5) : 0;
    tScroll = tCover + (hasCover ? 1.4 : 0.4);
    tEnd = DUR - clamp(DUR * 0.08, 0.8, 2);
  }

  // Khung cuộn của thiệp: thường là cả trang; mẫu nào cuộn trong một khối riêng thì
  // lấy khối cuộn được dài nhất.
  function scroller(d) {
    const root = d.scrollingElement || d.documentElement;
    if (root.scrollHeight - root.clientHeight > 40) return root;
    let best = root;
    let range = 0;
    for (const el of d.querySelectorAll("body *")) {
      const r = el.scrollHeight - el.clientHeight;
      if (r <= range || r < 40) continue;
      const oy = getComputedStyle(el).overflowY;
      if (oy === "auto" || oy === "scroll") {
        best = el;
        range = r;
      }
    }
    return best;
  }

  // Các điểm dừng = đầu mỗi mục của thiệp; quá gần nhau thì gộp, quá nhiều so với
  // thời lượng thì lấy rải đều.
  function buildPlan() {
    const d = doc();
    const sc = scroller(d);
    const isRoot = sc === d.scrollingElement || sc === d.documentElement;
    const vh = isRoot ? win().innerHeight : sc.clientHeight;
    const max = Math.max(0, sc.scrollHeight - sc.clientHeight);
    const top0 = isRoot ? 0 : sc.getBoundingClientRect().top;
    const span = Math.max(0.1, tEnd - tScroll);

    const scope = d.getElementById("main-card") || d.body;
    let stops = [...scope.querySelectorAll("[id^='section-'], section")]
      .filter((el) => el.offsetHeight > vh * 0.25)
      .map((el) => Math.round(el.getBoundingClientRect().top - top0 + sc.scrollTop))
      .filter((y) => y > vh * 0.3 && y < max - 4)
      .sort((a, b) => a - b)
      .filter((y, i, a) => i === 0 || y - a[i - 1] > vh * 0.6);
    const cap = Math.max(0, Math.floor(span / 1.6) - 1);
    if (stops.length > cap) {
      const pick = [];
      for (let i = 0; i < cap; i++) pick.push(stops[Math.round(((i + 0.5) * stops.length) / cap - 0.5)]);
      stops = pick;
    }

    const pts = [0, ...stops, max];
    const dwellTotal = Math.min(span * 0.35, stops.length * 1.1);
    const dwell = stops.length ? dwellTotal / stops.length : 0;
    const travel = span - dwellTotal;
    const dist = pts.reduce((s, y, i) => (i ? s + Math.abs(y - pts[i - 1]) : 0), 0) || 1;

    const legs = [];
    let t = tScroll;
    for (let i = 1; i < pts.length; i++) {
      const dt = (travel * Math.abs(pts[i] - pts[i - 1])) / dist;
      legs.push({ t0: t, t1: t + dt, y0: pts[i - 1], y1: pts[i] });
      t += dt;
      if (i < pts.length - 1) t += dwell;
    }
    return { sc, isRoot, max, legs };
  }

  function scrollAt(t) {
    if (!plan || t < tScroll) return 0;
    let y = 0;
    for (const L of plan.legs) {
      if (t < L.t0) break;
      y = t >= L.t1 ? L.y1 : L.y0 + (L.y1 - L.y0) * ease((t - L.t0) / Math.max(0.001, L.t1 - L.t0));
    }
    return y;
  }

  function seek(t) {
    if (hasCover && !opened && t >= tCover) {
      opened = true;
      win().openInvitation?.();
    }
    if (!plan && t >= tScroll) plan = buildPlan();
    if (!plan) return;
    const y = Math.round(scrollAt(t) * 100) / 100;
    if (plan.isRoot) win().scrollTo({ top: y, behavior: "instant" });
    else plan.sc.scrollTop = y;
  }

  // Bộ quay: start() khi đã sẵn sàng, rồi frame(t) cho từng khung.
  function startClock() {
    setupTimes();
    window.__cxClock?.start();
    win().__cxClock?.start();
  }
  function frame(t) {
    window.__cxClock?.tick(t * 1000);
    win().__cxClock?.tick(t * 1000);
    seek(t);
  }

  window.CXPromo = { ready, duration: DUR, startClock, frame };

  // Xem trước ở tab admin: chạy theo giờ thật rồi nạp lại để lặp.
  if (!RENDER && q.get("play") === "1") {
    ready.then(() => {
      setupTimes();
      const t0 = performance.now();
      const loop = () => {
        const t = (performance.now() - t0) / 1000;
        seek(Math.min(t, DUR));
        if (t < DUR + 1) requestAnimationFrame(loop);
        else location.reload();
      };
      requestAnimationFrame(loop);
    });
  }
})();
