// Đạo diễn của sân khấu video quảng cáo: nạp mẫu vào iframe, chờ ảnh/font xong, rồi
// dựng kịch bản theo thời lượng — giữ màn bìa → mở thiệp → giữ hero → cuộn qua từng mục (dừng
// một nhịp ở đầu mỗi mục) → giữ cuối. seek(t) chỉ phụ thuộc t nên bộ quay gọi theo
// từng khung (window.CXPromo.frame), còn tab admin xem trước bằng ?play=1 (giờ thật).
(function () {
  const q = new URLSearchParams(location.search);
  const THEME = (q.get("theme") || "").replace(/[^a-z0-9-]/gi, "");
  const DUR = Math.min(120, Math.max(5, Number(q.get("dur")) || 20));
  const SHOW_MUSIC = q.get("music") !== "0";
  const EVEN = q.get("scroll") === "even";
  const RENDER = !!window.__cxClock;

  const $ = (id) => document.getElementById(id);
  const view = $("pv-view");
  const phone = $("pv-phone");
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  // Vuốt đều: tốc độ không đổi, chỉ tăng/giảm tốc ở RAMP đầu và cuối chặng.
  const RAMP = 0.08;
  // Dừng ở từng mục: mỗi lần vuốt đi PAGE màn (chừa phần chồng để mắt nối được); đầu mục
  // cách chỗ đang đứng từ SNAP màn trở lên thì dừng đúng đầu mục đó.
  const PAGE = 0.8;
  const SNAP = 0.6;
  const glide = (x) => {
    const v = 1 / (1 - RAMP);
    if (x < RAMP) return (v * x * x) / (2 * RAMP);
    if (x > 1 - RAMP) return 1 - (v * (1 - x) * (1 - x)) / (2 * RAMP);
    return v * (x - RAMP / 2);
  };
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
    tCover = hasCover ? clamp(DUR * 0.05, 0.8, 1.2) : 0;
    // Màn hero đứng yên một nhịp rồi mới cuộn; có bìa thì cộng thêm ~1s cho hiệu ứng mở.
    const tHero = clamp(DUR * 0.12, 1.8, 3);
    tScroll = tCover + (hasCover ? 1 : 0) + tHero;
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

  // Toạ độ Y của phần tử trong nội dung khung cuộn, theo layout chứ không theo
  // getBoundingClientRect — hiệu ứng .reveal còn đang trượt (transform) thì vẫn đo đúng.
  function docY(n) {
    let y = 0;
    for (; n; n = n.offsetParent) y += n.offsetTop;
    return y;
  }
  const maxOf = (P) => Math.max(0, P.sc.scrollHeight - P.sc.clientHeight);
  const yIn = (P, el) => docY(el) - (P.isRoot ? 0 : docY(P.sc) + P.sc.clientTop);
  // Đích của chặng đo lại MỖI khung: ảnh tải xong / mục hiện ra làm nội dung phía trên
  // đổi cao thì đích đi theo mục, không dừng lệch vào giữa mục.
  const targetOf = (P, L) => Math.min(maxOf(P), L.el ? yIn(P, L.el) + L.off : (L.abs ?? Infinity));
  const curY = (P) => (P.isRoot ? win().scrollY : P.sc.scrollTop);

  // Vuốt từng màn từ đầu tới đáy, ưu tiên dừng ở đầu mục. Chế độ vuốt đều không có
  // điểm dừng: một chặng từ đầu tới cuối.
  // Thời gian chia theo quãng đường đo lúc dựng; toạ độ thật đo lại lúc chạy (targetOf).
  function buildPlan() {
    const d = doc();
    const sc = scroller(d);
    const P = { sc, isRoot: sc === d.scrollingElement || sc === d.documentElement };
    const vh = P.isRoot ? win().innerHeight : sc.clientHeight;
    const max = maxOf(P);
    const span = Math.max(0.1, tEnd - tScroll);

    const scope = d.getElementById("main-card") || d.body;
    const secs = [...scope.querySelectorAll("[id^='section-'], section")]
      .filter((el) => el.offsetHeight > 0)
      .map((el) => ({ el, y: yIn(P, el) }))
      .filter((s) => s.y > 0 && s.y < max - 4)
      .sort((a, b) => a.y - b.y);

    // Điểm dừng: el + off (bám theo mục), hoặc abs (toạ độ cố định), không có cả hai = đáy.
    // Mỗi bước vuốt đúng PAGE màn; đầu mục nào rơi vào [SNAP, PAGE] màn phía trước thì
    // dừng ngay đầu mục đó (bước ngắn hơn chút, không bao giờ dài hơn PAGE).
    const anchor = (y, w) => {
      let s = null;
      for (const x of secs) if (x.y <= y) s = x;
      return s ? { el: s.el, off: y - s.y, y, w } : { abs: y, y, w };
    };
    const pts = [{ abs: 0, y: 0 }];
    for (let y = 0; !EVEN && max - y > vh * PAGE; ) {
      const snap = secs.find((s) => s.y >= y + vh * SNAP && s.y <= y + vh * PAGE);
      y = snap ? snap.y : y + vh * PAGE;
      pts.push(snap ? { el: snap.el, off: 0, y, w: 1 } : anchor(y, 0.6));
    }
    pts.push({ y: max });

    const wSum = pts.reduce((s, p) => s + (p.w || 0), 0);
    const dwellTotal = Math.min(span * 0.35, wSum * 1.1);
    const travel = span - dwellTotal;
    const dist = pts.reduce((s, p, i) => (i ? s + Math.abs(p.y - pts[i - 1].y) : 0), 0) || 1;

    P.legs = [];
    let t = tScroll;
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i];
      const dt = (travel * Math.abs(p.y - pts[i - 1].y)) / dist;
      P.legs.push({ t0: t, t1: t + dt, el: p.el || null, off: p.off || 0, abs: p.abs, y0: null });
      t += dt;
      if (wSum) t += (dwellTotal * (p.w || 0)) / wSum;
    }
    return P;
  }

  // Chặng đang chạy bắt đầu từ ĐÚNG chỗ đang đứng (y0 chốt ở khung đầu của chặng), nên
  // các chặng nối liền nhau; hết chặng thì bám đích cho tới chặng sau.
  function scrollAt(t) {
    let L = null;
    for (const x of plan.legs) {
      if (t < x.t0) break;
      L = x;
    }
    if (!L) return 0;
    const y1 = targetOf(plan, L);
    if (t >= L.t1) return y1;
    if (L.y0 == null) L.y0 = curY(plan);
    const f = EVEN ? glide : ease;
    return L.y0 + (y1 - L.y0) * f((t - L.t0) / Math.max(0.001, L.t1 - L.t0));
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
