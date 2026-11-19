// "Xem nhanh" một mẫu thiệp: khung máy cuộn tự động ảnh chụp trọn thiệp
// (assets/images/templates-scroll/<mẫu>.jpg, do scripts/capture-scroll.js chụp) —
// khách lướt cả mẫu mà không phải mở trang thiệp. Dùng chung cho dải "Mẫu thiệp" ở
// trang chủ và lưới /theme-template; style `.cx-qp*` ở styles/_quick-preview.css.
// Trang phải nạp core/x-button.js. Bản xem đầy đủ mở NGAY trong tab này. Nút mượn
// .tt-btn-preview/.tt-btn-use của thẻ mẫu để cùng một hình.
(function () {
  const START_MS = 900; // đứng ở đầu thiệp trước khi cuộn
  const END_MS = 1600; // đứng ở cuối trước khi quay lại đầu
  const RESUME_MS = 2500; // khách tự cuộn/chạm xong bao lâu thì cuộn tiếp
  const SCREENS_PER_SEC = 0.22; // tốc độ: số "màn" trôi qua mỗi giây

  const ver = () => (typeof CX_VERSION !== "undefined" ? "?v=" + CX_VERSION : "");
  const longSrc = (theme) => `/assets/images/templates-scroll/${theme}.jpg${ver()}`;
  const fullUrl = (t) => t.previewUrl || `/public/themes/${t.theme}/?preview=true`;
  const coverSrc = (theme) => `/assets/images/templates/${theme}.jpg${ver()}`;

  let root, els, cur, raf, timer, pushed, after;
  let holdUntil = 0;
  let lastTs = 0;
  let pos = 0; // vị trí cuộn dạng số thực: scrollTop làm tròn nên cộng dồn bước nhỏ sẽ đứng im

  function esc(s) {
    return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  }

  function build() {
    root = document.createElement("div");
    root.className = "cx-qp";
    root.hidden = true;
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.innerHTML = `
      <div class="cx-qp-box">
        <div class="cx-qp-head">
          <div class="cx-qp-titles">
            <span class="cx-qp-kicker">Xem nhanh</span>
            <h3 class="cx-qp-name"></h3>
          </div>
          <button type="button" class="cx-qp-x" aria-label="Đóng"><i data-lucide="x"></i></button>
        </div>
        <div class="cx-qp-screen">
          <div class="cx-qp-scroll" tabindex="0" aria-label="Ảnh cả thiệp, tự cuộn">
            <img class="cx-qp-img" alt="" decoding="async" />
          </div>
          <div class="cx-qp-bar"><span></span></div>
        </div>
        <div class="cx-qp-acts">
          <x-button variant="bare" class="tt-btn-preview cx-qp-full"><i data-lucide="eye"></i>Xem đầy đủ</x-button>
          <x-button variant="bare" class="tt-btn-use cx-qp-use"><i data-lucide="play"></i>Tạo ngay</x-button>
        </div>
      </div>`;
    document.body.appendChild(root);
    window.lucide?.createIcons({ root });
    els = {
      name: root.querySelector(".cx-qp-name"),
      scroll: root.querySelector(".cx-qp-scroll"),
      img: root.querySelector(".cx-qp-img"),
      bar: root.querySelector(".cx-qp-bar span"),
    };

    root.addEventListener("click", (e) => {
      if (e.target === root || e.target.closest(".cx-qp-x")) return close();
      if (e.target.closest(".cx-qp-full")) return close(() => (window.location.href = fullUrl(cur)));
      if (e.target.closest(".cx-qp-use")) return close(() => cur.onUse?.());
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && root && !root.hidden) close();
    });
    // Nút Back của điện thoại đóng khung chứ không rời trang (mốc đẩy lúc mở).
    window.addEventListener("popstate", () => {
      if (!pushed) return;
      pushed = false;
      hide();
    });

    // Khách tự cuộn/chạm: dừng tự cuộn, để yên một lúc rồi chạy tiếp từ chỗ đó.
    const pause = () => {
      holdUntil = performance.now() + RESUME_MS;
    };
    ["pointerdown", "wheel", "touchstart", "keydown"].forEach((ev) =>
      els.scroll.addEventListener(ev, pause, { passive: true }),
    );
    els.scroll.addEventListener("scroll", () => {
      if (performance.now() < holdUntil) pos = els.scroll.scrollTop;
      syncBar();
    }, { passive: true });
  }

  function syncBar() {
    const max = els.scroll.scrollHeight - els.scroll.clientHeight;
    els.bar.style.transform = `scaleX(${max > 0 ? Math.min(1, els.scroll.scrollTop / max) : 0})`;
  }

  function tick(ts) {
    raf = requestAnimationFrame(tick);
    const dt = lastTs ? Math.min(64, ts - lastTs) : 0;
    lastTs = ts;
    if (ts < holdUntil) return;
    const sc = els.scroll;
    const max = sc.scrollHeight - sc.clientHeight;
    if (max <= 0) return;
    if (pos >= max - 1) {
      // Hết thiệp: đứng một nhịp rồi lướt về đầu, đứng thêm nhịp nữa mới cuộn lại.
      holdUntil = ts + END_MS + START_MS;
      timer = setTimeout(() => {
        pos = 0;
        sc.scrollTo({ top: 0, behavior: "smooth" });
      }, END_MS);
      return;
    }
    pos = Math.min(max, pos + (sc.clientHeight * SCREENS_PER_SEC * dt) / 1000);
    sc.scrollTop = pos;
  }

  function startScroll() {
    stopScroll();
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    pos = els.scroll.scrollTop;
    lastTs = 0;
    holdUntil = performance.now() + START_MS;
    raf = requestAnimationFrame(tick);
  }

  function stopScroll() {
    cancelAnimationFrame(raf);
    clearTimeout(timer);
  }

  /**
   * t: { theme, name, previewUrl, onUse }
   * Ảnh trọn thiệp chưa có (mẫu mới chưa chụp) thì khung giữ ảnh màn đầu, khách
   * vẫn bấm "Xem đầy đủ" được.
   */
  function open(t) {
    if (!t || !t.theme) return;
    if (!root) build();
    cur = t;
    els.name.textContent = t.name || "";
    root.setAttribute("aria-label", `Xem nhanh mẫu ${t.name || ""}`);
    els.scroll.scrollTop = 0;
    pos = 0;
    syncBar();
    els.scroll.classList.remove("is-long");
    els.img.src = coverSrc(t.theme);

    const want = t.theme;
    const full = new Image();
    full.decoding = "async";
    full.onload = () => {
      if (!cur || cur.theme !== want || root.hidden) return;
      els.img.src = full.src;
      els.scroll.classList.add("is-long");
      startScroll();
    };
    full.src = longSrc(t.theme);

    root.hidden = false;
    document.documentElement.classList.add("cx-qp-lock");
    requestAnimationFrame(() => root.classList.add("is-in"));
    if (!pushed) {
      history.pushState({ cxQp: 1 }, "");
      pushed = true;
    }
    root.querySelector(".cx-qp-x")?.focus({ preventScroll: true });
  }

  function hide() {
    if (!root || root.hidden) return;
    stopScroll();
    root.classList.remove("is-in");
    root.hidden = true;
    document.documentElement.classList.remove("cx-qp-lock");
    const fn = after;
    after = null;
    fn?.();
  }

  // Gỡ mốc lịch sử đã đẩy rồi mới làm tiếp `then` — điều hướng chen giữa lúc
  // history.back() đang chạy thì một trong hai bị huỷ.
  function close(then) {
    after = then || null;
    if (pushed) history.back();
    else hide();
  }

  window.CXQuickPreview = { open, close };
})();
