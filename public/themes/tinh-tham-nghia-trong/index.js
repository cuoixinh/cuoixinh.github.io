// Mẫu TÌNH THÂM NGHĨA TRỌNG — thiệp cuộn nền trắng sáng, chữ đen + đỏ son. Chỉ KHAI
// BÁO: window.CX_THEME + renderWedding + phần đặc thù (ảnh xen, lịch tháng đè ảnh, đếm
// ngược, mỗi mốc chuyện tình một trang, băng ảnh vuốt ngang, hiệu ứng vào trang).
// Phần "chạy" nằm ở core/helpers/theme-boot.js. Bọc IIFE: `const` cấp cao nhất là biến toàn cục.

(function () {
  window.CX_THEME = {
    // Trùng TÊN THƯ MỤC và cột `templates.template_name`.
    id: "tinh-tham-nghia-trong",

    wishesMode: "paged",
    giftBox: "phongbi_kem_sap",

    music: { variant: "disc", chrome: "fixed-corner", art: "couple" },

    // Bộ màu MẶC ĐỊNH của mẫu — bản khai máy đọc được của đúng những giá trị
    // :root trong theme.css (nguồn sự thật). Trang Thiết lập đọc nó để hiện mục
    // "Mặc định"; theme_setting.palette ghi đè lên trên lúc chạy.
    // Sinh lại bằng: node scripts/check-theme-palette.mjs --write
    palette: {
      heading: "#1c1a18",
      body: "#2e2a26",
      accent: "#a50000",
      accent_soft: "#e9c9c4",
      on_accent: "#ffffff",
      on_image: "#ffffff",
      on_lightbox: "#ffffff",
      card_bg: "#ffffff",
      page_bg: "#f4f4f4",
      surface: "#f5f5f5",
      band: "#f7f7f7",
      panel: "#ffffff",
      panel_warm: "#ffffff",
      cover: "#ffffff",
      cover_mid: "#f7f7f7",
      cover_veil: "#ffffff",
      lightbox_bg: "#000000",
      line: "#e6e6e6",
      shadow: "#000000",
      scrim: "#000000",
      deco: "#c8c8c8",
      deco_soft: "#f0f0f0",
      deco_2: "#8a1c1c",
      deco_2_soft: "#f3e1e1",
      shine_from: "#ffffff",
      shine_mid: "#f3e3e0",
      shine_to: "#a50000",
    },

    swatches: [
      "#1c1a18",
      "#2e2a26",
      "#a50000",
      "#8a1c1c",
      "#c8c8c8",
      "#e6e6e6",
      "#f5f5f5",
      "#ffffff",
    ],

    // Lời chúc theo tông trắng + đỏ son của mẫu (khách không chỉnh được).
    wishes: {
      bubble: "#ffffff",
      text: "#2e2a26",
      accent: "#a50000",
      btn: "#a50000",
    },

    // Hiệu ứng vào trang do ttSlides lo theo TỪNG TRANG, nên hiệu ứng cuộn chung trỏ vào
    // một id không có để hai bên không chồng lên nhau (mảng rỗng làm theme-boot ném lỗi).
    reveal: ["#tt-no-reveal"],
    suggest: "#section-footer",
    skipSteps: [],

    // Mỗi mốc chuyện tình chiếm trọn một trang, chữ dưới ảnh.
    loveStory: "short",

    onOpen: () => ttSlides(),
  };

  const _isGroom = isGroomSide();
  const _pad = (n) => String(Math.max(0, n)).padStart(2, "0");

  // ============= ĐỔ DỮ LIỆU LÊN THIỆP =============

  function renderWedding(w) {
    if (!w || !w.is_active) return;

    const side = _isGroom ? "groom" : "bride";
    const gallery = Array.isArray(w.gallery_images) ? w.gallery_images : [];
    const galleryFp = w.image_focal_points?.gallery_images;

    // --- Màn bìa (ảnh màn đầu nhận src TRƯỚC setupMusic) ---
    renderCover(w);
    ttFillShots(gallery, galleryFp);

    // Ngày dạng "dd / mm" ở bìa + trang cuối; chữ cái đầu tên gọi đè ảnh trang hồi đáp.
    const md = ttDayMonth(w.ceremony_date);
    ["tt-cover-md", "tt-end-md"].forEach((id) => {
      const el = document.getElementById(id);
      if (el && md) el.innerHTML = md;
    });
    setText("tt-mono", `${ttInitial(w.groom_name)} & ${ttInitial(w.bride_name)}`);
    setText("couple-names-groom", w.groom_name, "----------");
    setText("couple-names-bride", w.bride_name, "----------");
    if (w.story_quote) setText("story-quote", w.story_quote);

    // --- Nhạc nền ---
    setupMusic(w.music_url, w.enable_music);

    // --- Gia đình ---
    renderCoupleInfo(w);
    cxToggle("section-family", cxEnabled(w.enable_family));

    // --- Thư mời: nhà gái bật Vu Quy thì thay toàn bộ phần lễ ---
    const isVuQuy = !_isGroom && cxEnabled(w.vu_quy_enabled);
    const ceremonyName = isVuQuy ? "Lễ Vu Quy" : w.ceremony_name || "Lễ Thành Hôn";
    const ceremonyTime = isVuQuy ? w.vu_quy_time : w.ceremony_time;
    const ceremonyLoc = isVuQuy ? w.vu_quy_location : w.ceremony_location || "";

    setText("ceremony-event-name", ceremonyName);
    renderCeremonyDate(w.ceremony_date, ceremonyTime, w.ceremony_lunar);
    if (ceremonyLoc) {
      setText("ceremony-location-text", ceremonyLoc);
      cxToggle("ceremony-location-wrap", true);
    }

    renderMusicSummary(w, {
      ceremonyName,
      ceremonyTime,
      ceremonyLocation: ceremonyLoc,
    });

    // --- Lịch tháng đè ảnh + đếm ngược (theo ngày giờ lễ) ---
    const partyDate = w[`${side}_party_date`];
    ttRenderCalendar(w.ceremony_date, partyDate);
    ttCountdown(w.ceremony_date, ceremonyTime);

    // --- Tiệc cưới (mỗi nhà một ngày/giờ/nơi riêng) ---
    setText("party-section-label", "Tiệc Mừng " + ceremonyName);
    renderPartyDate(
      partyDate,
      w[`${side}_party_time`],
      w[`${side}_party_lunar`],
      w[`${side}_party_location`],
      "full",
    );
    cxToggle("section-party", cxEnabled(w.enable_party));

    // --- Xác nhận tham dự ---
    const rsvp = document.getElementById("rsvp-section");
    if (rsvp) rsvp.style.display = cxEnabled(w.rsvp_enabled) ? "flex" : "none";
    if (w.rsvp_message) {
      const msg = document.getElementById("rsvp-custom-message");
      if (msg) {
        msg.textContent = w.rsvp_message;
        msg.classList.remove("hidden");
      }
    }

    // --- Lịch trình ngày cưới ---
    if (cxEnabled(w.enable_timeline)) {
      ttRenderTimeline(w.timeline, side, partyDate, w.ceremony_date, ceremonyName);
    }

    // --- Chuyện tình yêu ---
    if (cxEnabled(w.enable_love_story)) {
      ttRenderLoveStory(w.love_story);
    } else {
      cxToggle("love-story", false);
    }

    // --- Album ảnh ---
    if (cxEnabled(w.enable_photos)) {
      renderGallery(gallery, galleryFp);
    } else {
      cxToggle("section-photos", false);
    }

    // --- Hộp mừng cưới ---
    renderQRCodes(w);
    cxToggle("section-gift", cxEnabled(w.enable_gift));

    // --- Bản đồ ---
    renderVenueMaps(w, side);
    ttBindDirections();

    // --- Lời cảm ơn ---
    if (w.footer_text) setText("footer-text", w.footer_text);
    cxToggle("section-footer", cxEnabled(w.enable_footer));
  }

  window.renderWedding = renderWedding;

  // Chữ cái đầu của TÊN GỌI (chữ cuối trong họ tên Việt): "Gia Bảo" → "B".
  function ttInitial(name) {
    const word = String(name || "").trim().split(/\s+/).pop() || "";
    return word.charAt(0).toUpperCase() || "-";
  }

  function ttDayMonth(dateStr) {
    const d = dateStr ? new Date(dateStr + "T00:00:00") : null;
    if (!d || isNaN(d)) return "";
    return `${_pad(d.getDate())}<i>/</i>${_pad(d.getMonth() + 1)}`;
  }

  // ============= ẢNH XEN TRONG CÁC TRANG =============
  // Ô [data-tt-shot="i"] lấy ảnh album thứ i, album ngắn thì quay vòng lại từ
  // đầu ("last" = ảnh cuối). Không có ảnh nào thì hiện ô minh hoạ.

  function ttShotImg(url, fp, eager) {
    return `<img src="${cxImgSrc(url)}" alt="" class="w-full h-full object-cover"
      style="object-position:${cxFocal(fp)}"${eager ? "" : ' loading="lazy"'} />`;
  }

  function ttFillShots(images, focal) {
    document.querySelectorAll("[data-tt-shot]").forEach((slot) => {
      const key = slot.getAttribute("data-tt-shot");
      if (!images.length) {
        // Nền màn bìa để trống thay vì in chữ "Chưa có ảnh" mờ khắp màn.
        slot.innerHTML = slot.classList.contains("tt-cv-bg") ? "" : ttShotImg(createPlaceholderSVG("Chưa có ảnh"), null, true);
        return;
      }
      const idx = key === "last" ? images.length - 1 : Number(key) % images.length;
      // Ảnh trong #main-card của mẫu có bìa KHÔNG lazy (xem CLAUDE.md).
      slot.innerHTML = ttShotImg(images[idx], focal?.[images[idx]], true);
    });
  }

  // ============= LỊCH THÁNG ĐÈ ẢNH =============
  // "dd / mm" + hàng thứ đè đáy ảnh, lưới ngày nằm dưới ảnh. Tuần bắt đầu Thứ Hai;
  // ngày lễ (+ ngày tiệc nếu cùng tháng) tô tròn đỏ.

  function ttRenderCalendar(ceremonyDate, partyDate) {
    const grid = document.getElementById("tt-calendar");
    const heads = document.getElementById("tt-cal-heads");
    if (!grid || !ceremonyDate) return;
    const d = new Date(ceremonyDate + "T00:00:00");
    if (isNaN(d)) return;
    const y = d.getFullYear();
    const m = d.getMonth();
    const marked = new Set([d.getDate()]);
    if (partyDate) {
      const p = new Date(partyDate + "T00:00:00");
      if (p.getFullYear() === y && p.getMonth() === m) marked.add(p.getDate());
    }
    const md = document.getElementById("tt-cal-md");
    if (md) md.innerHTML = ttDayMonth(ceremonyDate);
    if (heads) {
      heads.innerHTML = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"]
        .map((h) => `<span class="cx-on-image">${h}</span>`)
        .join("");
    }

    const lead = (new Date(y, m, 1).getDay() + 6) % 7;
    const days = new Date(y, m + 1, 0).getDate();
    let cells = "<span></span>".repeat(lead);
    for (let i = 1; i <= days; i++) {
      cells += marked.has(i) ? `<span class="is-on">${i}</span>` : `<span>${i}</span>`;
    }
    grid.innerHTML = cells;
  }

  // ============= ĐẾM NGƯỢC =============
  // Tính từ ngày + giờ lễ, nhịp mỗi giây. Không có ngày thì ẩn cả trang; qua giờ
  // lễ thì về 00 và dừng hẳn.

  let _cdTimer = null;

  function ttCountdown(dateStr, timeStr) {
    if (_cdTimer) clearInterval(_cdTimer);
    _cdTimer = null;
    const target = dateStr ? new Date(`${dateStr}T${timeStr || "00:00"}:00`).getTime() : NaN;
    if (isNaN(target)) {
      cxToggle("section-countdown", false);
      return;
    }
    cxToggle("section-countdown", true);

    function tick() {
      const left = Math.max(0, Math.floor((target - Date.now()) / 1000));
      setText("cd-days", _pad(Math.floor(left / 86400)));
      setText("cd-hours", _pad(Math.floor((left % 86400) / 3600)));
      setText("cd-minutes", _pad(Math.floor((left % 3600) / 60)));
      setText("cd-seconds", _pad(left % 60));
      if (!left && _cdTimer) {
        clearInterval(_cdTimer);
        _cdTimer = null;
      }
    }

    tick();
    _cdTimer = setInterval(tick, 1000);
  }

  // ============= LỊCH TRÌNH =============
  // Lọc theo nhà như renderTimeline dùng chung; mỗi nhóm (lễ / tiệc) mở bằng tên
  // + ngày, từng dòng giờ — việc.

  function ttRenderTimeline(items, side, partyDate, ceremonyDate, ceremonyName) {
    const list = document.getElementById("timeline-list-render");
    if (!list || !Array.isArray(items)) return;
    const relevant = items.filter((it) => {
      const t = it.type || "ceremony";
      return t === "ceremony" || (side === "groom" ? t === "party" : t === "bride-party");
    });
    if (!relevant.length) return;

    const groups = cxSortTimelineGroups([
      { label: "Tiệc Cưới", date: partyDate, items: relevant.filter((i) => (i.type || "ceremony") !== "ceremony") },
      { label: ceremonyName, date: ceremonyDate, items: relevant.filter((i) => (i.type || "ceremony") === "ceremony") },
    ]);

    list.innerHTML = groups
      .map((g) => {
        const dt = g.date ? new Date(g.date + "T00:00:00") : null;
        const dateLabel = dt ? ` · ${_pad(dt.getDate())}.${_pad(dt.getMonth() + 1)}` : "";
        const rows = g.items
          .map(
            (it) => `<div class="tt-plan-row">
              <span class="cx-a tt-plan-time">${escapeHtml(it.time || "")}</span>
              <span class="cx-t tt-plan-title">${escapeHtml(it.title || "")}</span>
            </div>`,
          )
          .join("");
        return `<div class="tt-plan-group">
          <div class="cx-h cx-a tt-cap tt-plan-label">${escapeHtml(g.label)}${escapeHtml(dateLabel)}</div>
          ${rows}
        </div>`;
      })
      .join("");
    cxToggle("section-timeline", true);
  }

  // ============= CHUYỆN TÌNH YÊU =============
  // Mỗi mốc là MỘT trang cùng khung với các trang khác: dải đầu, ảnh, ngày, tiêu đề, nội dung.

  function ttRenderLoveStory(events) {
    const section = document.getElementById("love-story");
    const list = document.getElementById("love-story-list");
    if (!section || !list) return;
    if (!Array.isArray(events) || !events.length) {
      section.style.display = "none";
      return;
    }
    section.style.display = "";

    list.innerHTML = events
      .map((ev, i) => {
        const img = ev.image_url
          ? `<div class="tt-photo tt-ls-photo tt-a ${i % 2 ? "tt-fr" : "tt-fl"}">${ttShotImg(ev.image_url, ev.focal_point, true)}</div>`
          : "";
        return `<div class="tt-page tt-ls">
          <div class="cx-t cx-a tt-label tt-a tt-fd">Chuyện của chúng mình</div>
          ${ev.date ? `<div class="cx-h cx-a tt-em tt-a tt-zi" style="--d: 0.3s">${escapeHtml(ev.date)}</div>` : ""}
          ${img}
          <div class="tt-ls-text tt-a tt-fu" style="--d: 0.8s">
            ${ev.title ? `<div class="cx-t tt-ls-title">${escapeHtml(ev.title)}</div>` : ""}
            ${ev.content ? `<div class="cx-t tt-ls-body">${escapeHtml(ev.content)}</div>` : ""}
          </div>
          <div class="cx-h cx-a tt-cap tt-foot tt-a tt-fade" style="--d: 2s">Simple, sincere, endless</div>
        </div>`;
      })
      .join("");
  }

  // ============= ALBUM ẢNH =============
  // Cả album trên một băng vuốt ngang (scroll-snap), số đếm "i / n" bên dưới.
  // Bấm ảnh mở lightbox đúng thứ tự album.

  function renderGallery(images, focalPoints) {
    const reel = document.getElementById("gallery-grid");
    if (!reel) return;
    const urls = images.length
      ? images.map(getImageUrl)
      : Array(2).fill(null).map(() => createPlaceholderSVG("Chưa có ảnh"));

    lightboxImages.length = 0;
    lightboxImages.push(...urls);

    reel.innerHTML = urls
      .map(
        (u, i) =>
          `<div class="tt-reel-cell" data-lb="${i}">${ttShotImg(u, focalPoints?.[images[i]], false)}</div>`,
      )
      .join("");
    setText("tt-reel-n", String(urls.length));
    reel.querySelectorAll("[data-lb]").forEach((el) =>
      el.addEventListener("click", () => openLightbox(Number(el.dataset.lb))),
    );
    if (reel._ttScroll) return;
    reel._ttScroll = true;
    reel.addEventListener(
      "scroll",
      () => {
        const cell = reel.firstElementChild;
        if (!cell) return;
        const i = Math.round(reel.scrollLeft / (cell.offsetWidth + 12));
        setText("tt-reel-i", String(Math.min(reel.children.length, i + 1)));
      },
      { passive: true },
    );
  }

  // ============= BẢN ĐỒ: NÚT CHỈ ĐƯỜNG =============
  // Nút tròn nằm TRONG thẻ link bản đồ (cả bản sao "-2"): chặn mở link thường, đổi link
  // tìm địa điểm (?query=) thành link dẫn đường tới đúng điểm đó. Uỷ quyền một lần trên mục.

  function ttBindDirections() {
    const sec = document.getElementById("section-map");
    if (!sec || sec._ttDir) return;
    sec._ttDir = true;
    sec.addEventListener("click", (e) => {
      const link = e.target.closest("[data-tt-dir]")?.closest("a");
      if (!link) return;
      e.preventDefault();
      const q = new URL(link.href, location.href).searchParams.get("query");
      const url = q ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}` : link.href;
      window.open(url, "_blank", "noopener");
    });
  }

  // ============= MÀN BÌA: TÔ ĐỂ MỞ =============
  // Lòng nhẫn (.tt-ring) có canvas phủ lụa đỏ (màu nhấn của bộ màu + hoạ tiết tim nhỏ),
  // cắt theo mặt nạ lỗ nhẫn TT_RING_HOLE nên chỉ phần trong lỗ được tính. Nét tô xoá lớp
  // phủ (destination-out); phần đã xoá đo thưa trên kênh alpha: quá TT_SCRATCH_DONE thì
  // tan, nhẫn loé sáng, tim bay lên rồi gọi openInvitation(). Viết cho N vòng (.tt-ring).

  const TT_SCRATCH_DONE = 0.6; // tỉ lệ đã tô trên diện tích lòng nhẫn
  const TT_RING_HOLE = "/assets/images/decor/tt-ring-hole.webp";

  function ttScratch() {
    const wrap = document.getElementById("tt-rings");
    if (!wrap || wrap._tt) return;
    wrap._tt = true;
    const rings = [...wrap.querySelectorAll(".tt-ring")];
    let finished = false;
    const hole = new Image();
    hole.src = TT_RING_HOLE;

    const rgb = (name) =>
      (getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "165 0 0")
        .split(/\s+/)
        .map(Number);

    function finishAll() {
      if (finished || !rings.every((r) => r.classList.contains("is-clear"))) return;
      finished = true;
      wrap.classList.add("is-done");
      for (let i = 0; i < 14; i++) {
        const h = document.createElement("span");
        h.className = "tt-burst";
        h.textContent = "♥";
        h.style.left = `${8 + Math.random() * 84}%`;
        h.style.top = `${25 + Math.random() * 50}%`;
        h.style.setProperty("--dx", `${(Math.random() - 0.5) * 140}px`);
        h.style.animationDelay = `${Math.random() * 0.3}s`;
        wrap.appendChild(h);
      }
      setTimeout(() => window.openInvitation?.(), 1100);
    }

    rings.forEach((ring) => {
      const cv = ring.querySelector("canvas");
      const ctx = cv.getContext("2d", { willReadFrequently: true });
      let started = false;
      let last = null;
      let moves = 0;
      let base = 0; // số điểm mẫu còn phủ lúc chưa tô (= diện tích lòng nhẫn)

      // Đếm thưa số điểm còn lớp phủ trên kênh alpha.
      function covered() {
        const data = ctx.getImageData(0, 0, cv.width, cv.height).data;
        let n = 0;
        for (let i = 3; i < data.length; i += 4 * 16) if (data[i] >= 40) n++;
        return n;
      }

      function paint() {
        if (started) return;
        const r = cv.getBoundingClientRect();
        if (!r.width) return;
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        cv.width = Math.round(r.width * dpr);
        cv.height = Math.round(r.height * dpr);
        const [a1, a2, a3] = rgb("--cx-accent-rgb");
        const [o1, o2, o3] = rgb("--cx-on-accent-rgb");
        const g = ctx.createLinearGradient(0, 0, cv.width, cv.height);
        g.addColorStop(0, `rgb(${Math.min(255, a1 + 40)} ${a2 + 10} ${a3 + 10})`);
        g.addColorStop(0.55, `rgb(${a1} ${a2} ${a3})`);
        g.addColorStop(1, `rgb(${a1 * 0.7} ${a2 * 0.7} ${a3 * 0.7})`);
        ctx.globalCompositeOperation = "source-over";
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, cv.width, cv.height);
        // Hoạ tiết tim nhỏ xếp so le.
        ctx.fillStyle = `rgb(${o1} ${o2} ${o3} / 0.14)`;
        const step = 22 * dpr;
        const s = 3.5 * dpr;
        for (let y = step / 2, row = 0; y < cv.height; y += step, row++) {
          for (let x = row % 2 ? step : step / 2; x < cv.width; x += step) {
            ctx.beginPath();
            ctx.moveTo(x, y + s);
            ctx.bezierCurveTo(x - 2.4 * s, y - 0.2 * s, x - 0.9 * s, y - 1.8 * s, x, y - 0.6 * s);
            ctx.bezierCurveTo(x + 0.9 * s, y - 1.8 * s, x + 2.4 * s, y - 0.2 * s, x, y + s);
            ctx.fill();
          }
        }
        // Chỉ giữ lớp phủ trong lỗ nhẫn; mặt nạ chưa tải xong thì vẽ lại khi tải xong.
        if (hole.complete && hole.naturalWidth) {
          ctx.globalCompositeOperation = "destination-in";
          ctx.drawImage(hole, 0, 0, cv.width, cv.height);
        } else {
          hole.addEventListener("load", paint, { once: true });
        }
        base = covered();
      }

      const point = (e) => {
        const r = cv.getBoundingClientRect();
        return { x: ((e.clientX - r.left) / r.width) * cv.width, y: ((e.clientY - r.top) / r.height) * cv.height };
      };

      function stroke(p) {
        ctx.globalCompositeOperation = "destination-out";
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.lineWidth = cv.width * 0.13;
        ctx.beginPath();
        ctx.moveTo((last || p).x, (last || p).y);
        ctx.lineTo(p.x + 0.01, p.y);
        ctx.stroke();
        last = p;
      }

      function check() {
        if (ring.classList.contains("is-clear") || !base) return;
        if (1 - covered() / base >= TT_SCRATCH_DONE) {
          ring.classList.add("is-clear");
          finishAll();
        }
      }

      cv.addEventListener("pointerdown", (e) => {
        if (ring.classList.contains("is-clear")) return;
        started = true;
        wrap.classList.add("is-scratching");
        cv.setPointerCapture?.(e.pointerId);
        last = null;
        stroke(point(e));
      });
      cv.addEventListener("pointermove", (e) => {
        if (!last || ring.classList.contains("is-clear")) return;
        stroke(point(e));
        if (++moves % 8 === 0) check();
      });
      const up = () => {
        last = null;
        if (started) check();
      };
      cv.addEventListener("pointerup", up);
      cv.addEventListener("pointercancel", up);

      // Khổ lòng nhẫn đổi (xoay máy, --vh khoá xong) → vẽ lại lớp phủ khi khách CHƯA tô.
      if (window.ResizeObserver) new ResizeObserver(paint).observe(cv);
      paint();
    });
  }

  ttScratch();

  // ============= HIỆU ỨNG VÀO TRANG =============
  // Trang = .tt-page (+ mục lời chúc do wishes-helper chèn). Trang chiếm >= 50% khung
  // nhìn thì nhận .is-on MỘT LẦN, không gỡ → hiệu ứng .tt-a chạy một lần rồi giữ nguyên,
  // cuộn qua hay quay lại trang trên vẫn còn đủ chữ. Chỉ bật khi thiệp đã mở (onOpen).

  let _ttIO = null;
  let _ttPages = [];

  function ttPages() {
    // Sắp theo vị trí thật: mục lời chúc nằm CUỐI DOM nhưng được đẩy lên bằng flex `order`.
    return [...document.querySelectorAll("#main-card .tt-page, #main-card .cx-wsec")]
      .filter((el) => el.getClientRects().length)
      .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
  }

  function ttScan() {
    const pages = ttPages();
    if (pages.length === _ttPages.length && pages.every((p, i) => p === _ttPages[i])) return;
    _ttPages = pages;
    _ttIO?.disconnect();
    _ttIO = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.intersectionRatio >= 0.5 || (e.isIntersecting && e.intersectionRect.height >= innerHeight * 0.5)) {
            e.target.classList.add("is-on");
          }
        });
      },
      { threshold: [0, 0.5] },
    );
    pages.forEach((p) => _ttIO.observe(p));
  }

  function ttSlides() {
    document.documentElement.classList.add("tt-on");
    ttScan();
    // Mục lời chúc + khối chèn thêm có thể vào sau khi thiệp mở → quét lại.
    const flow = document.querySelector("#main-card .tt-flow");
    if (flow && !flow._ttMO) {
      let t = 0;
      // Chỉ bắt thay đổi ở cấp TRANG (thêm/ẩn mục), bỏ qua chữ đổi trong trang
      // (đồng hồ đếm ngược đổi mỗi giây). ttScan tự thoát khi danh sách trang y nguyên.
      const pageLevel = (m) =>
        m.type === "childList"
          ? m.target === flow || m.target.id === "love-story-list"
          : m.target.parentElement === flow;
      flow._ttMO = new MutationObserver((muts) => {
        if (!muts.some(pageLevel)) return;
        clearTimeout(t);
        t = setTimeout(ttScan, 200);
      });
      flow._ttMO.observe(flow, { childList: true, subtree: true, attributes: true, attributeFilter: ["style", "class"] });
    }
  }
})();
