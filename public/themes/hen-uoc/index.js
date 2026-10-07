// Mẫu HẸN ƯỚC — thiệp cuộn liền mạch nền kem, khối đỏ rượu lệch sau ảnh. Chỉ KHAI BÁO:
// window.CX_THEME + renderWedding + phần đặc thù (ảnh xen, lịch tháng đè ảnh, mỗi mốc
// chuyện tình một trang, băng ảnh vuốt ngang, đếm ngược, chấm chỉ trang + gợi ý cuộn).
// Phần "chạy" nằm ở core/helpers/theme-boot.js. Bọc IIFE: `const` cấp cao nhất là biến toàn cục.

(function () {
  window.CX_THEME = {
    // Trùng TÊN THƯ MỤC và cột `templates.template_name`.
    id: "hen-uoc",

    wishesMode: "card",
    giftBox: "hop_trai_tim",

    music: { variant: "disc", chrome: "fixed-corner", art: "couple" },

    // Bộ màu MẶC ĐỊNH của mẫu — bản khai máy đọc được của đúng những giá trị
    // :root trong theme.css (nguồn sự thật). Trang Thiết lập đọc nó để hiện mục
    // "Mặc định"; theme_setting.palette ghi đè lên trên lúc chạy.
    // Sinh lại bằng: node scripts/check-theme-palette.mjs --write
    palette: {
      heading: "#5c1a24",
      body: "#4a3a34",
      accent: "#7d2633",
      accent_soft: "#eed6d0",
      on_accent: "#fffaf2",
      on_image: "#ffffff",
      on_lightbox: "#ffffff",
      card_bg: "#fbf6ec",
      page_bg: "#f3ebdc",
      surface: "#f6eedf",
      band: "#7d2633",
      panel: "#fbf6ec",
      panel_warm: "#f7efe1",
      cover: "#fbf6ec",
      cover_mid: "#f6eedf",
      cover_veil: "#fbf6ec",
      lightbox_bg: "#000000",
      line: "#e8d8c8",
      shadow: "#000000",
      scrim: "#000000",
      deco: "#7d2633",
      deco_soft: "#eed6d0",
      deco_2: "#a85c5c",
      deco_2_soft: "#f5e8e0",
      shine_from: "#fffaf2",
      shine_mid: "#f5e8e0",
      shine_to: "#eed6d0",
    },

    swatches: [
      "#5c1a24",
      "#7d2633",
      "#a85c5c",
      "#4a3a34",
      "#eed6d0",
      "#f5e8e0",
      "#f6eedf",
      "#fbf6ec",
    ],

    // Lời chúc theo tông kem – đỏ rượu của mẫu (khách không chỉnh được).
    wishes: {
      bubble: "#f7efe1",
      text: "#4a3a34",
      accent: "#7d2633",
      btn: "#7d2633",
    },

    // Hiệu ứng hiện dần do huSlides lo theo TỪNG TRANG (chạy lại mỗi lần lật
    // tới), nên hiệu ứng cuộn chung trỏ vào một id không có để hai bên không chồng
    // lên nhau (mảng rỗng làm theme-boot ném lỗi selector rỗng).
    reveal: ["#hu-no-reveal"],
    suggest: "#section-gift",
    skipSteps: [],

    // Mỗi mốc chuyện tình chiếm trọn một trang, chữ dưới ảnh.
    loveStory: "short",

    onOpen: () => huSlides(),
  };

  const _isGroom = isGroomSide();

  // ============= ĐỔ DỮ LIỆU LÊN THIỆP =============

  function renderWedding(w) {
    if (!w || !w.is_active) return;

    const side = _isGroom ? "groom" : "bride";
    const gallery = Array.isArray(w.gallery_images) ? w.gallery_images : [];
    const galleryFp = w.image_focal_points?.gallery_images;

    // --- Màn bìa + mở đầu (ảnh màn đầu nhận src TRƯỚC setupMusic) ---
    renderCover(w);
    renderHero(w, false);
    if (w.ceremony_date) {
      const d = new Date(w.ceremony_date + "T00:00:00");
      if (!isNaN(d)) {
        setText("hu-hero-date", `${d.getFullYear()}.${_pad(d.getMonth() + 1)}.${_pad(d.getDate())}`);
        setText("hu-cover-date", `${_pad(d.getDate())} · ${_pad(d.getMonth() + 1)} · ${d.getFullYear()}`);
      }
    }
    if (w.story_quote) setText("story-quote", w.story_quote);

    huFillShots(gallery, galleryFp);

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

    setText("invite-groom", w.groom_name, "----------");
    setText("invite-bride", w.bride_name, "----------");
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
    huRenderCalendar(w.ceremony_date, partyDate);
    huCountdown(w.ceremony_date, ceremonyTime);

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
      huRenderTimeline(w.timeline, side, partyDate, w.ceremony_date, ceremonyName);
    }

    // --- Chuyện tình yêu ---
    if (cxEnabled(w.enable_love_story)) {
      huRenderLoveStory(w.love_story);
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

    // --- Lời cảm ơn ---
    if (w.footer_text) setText("footer-text", w.footer_text);
    cxToggle("section-footer", cxEnabled(w.enable_footer));
  }

  window.renderWedding = renderWedding;

  const _pad = (n) => String(Math.max(0, n)).padStart(2, "0");

  // ============= ẢNH XEN TRONG CÁC TRANG =============
  // Ô [data-hu-shot="i"] lấy ảnh album thứ i, album ngắn thì quay vòng lại từ
  // đầu ("last" = ảnh cuối). Không có ảnh nào thì ô tự ẩn.

  function huShotImg(url, fp, eager) {
    return `<img src="${cxImgSrc(url)}" alt="" class="w-full h-full object-cover"
      style="object-position:${cxFocal(fp)}"${eager ? "" : ' loading="lazy"'} />`;
  }

  function huFillShots(images, focal) {
    document.querySelectorAll("[data-hu-shot]").forEach((slot) => {
      const key = slot.getAttribute("data-hu-shot");
      if (!images.length) {
        slot.classList.add("hidden");
        return;
      }
      const idx = key === "last" ? images.length - 1 : Number(key) % images.length;
      slot.classList.remove("hidden");
      // Ảnh trong #main-card của mẫu có bìa KHÔNG lazy (xem CLAUDE.md).
      slot.innerHTML = huShotImg(images[idx], focal?.[images[idx]], true);
    });
  }

  // ============= LỊCH THÁNG ĐÈ ẢNH =============
  // Tuần bắt đầu Thứ Hai; ngày lễ (+ ngày tiệc nếu cùng tháng) khoanh bằng trái tim.

  function huRenderCalendar(ceremonyDate, partyDate) {
    const box = document.getElementById("hu-calendar");
    if (!box || !ceremonyDate) return;
    const d = new Date(ceremonyDate + "T00:00:00");
    if (isNaN(d)) return;
    const y = d.getFullYear();
    const m = d.getMonth();
    const marked = new Set([d.getDate()]);
    if (partyDate) {
      const p = new Date(partyDate + "T00:00:00");
      if (p.getFullYear() === y && p.getMonth() === m) marked.add(p.getDate());
    }
    const md = document.getElementById("hu-cal-md");
    if (md) md.innerHTML = `${_pad(m + 1)}<small> / ${_pad(d.getDate())}</small>`;
    setText("hu-cal-year", `-${y}-`);

    const lead = (new Date(y, m, 1).getDay() + 6) % 7;
    const days = new Date(y, m + 1, 0).getDate();
    const heads = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"]
      .map((h) => `<div class="hu-cal-h">${h}</div>`)
      .join("");
    let cells = "<div></div>".repeat(lead);
    for (let i = 1; i <= days; i++) {
      cells += marked.has(i)
        ? `<div class="hu-cal-d is-on"><svg aria-hidden="true"><use href="#hu-heart-o"/></svg><span>${i}</span></div>`
        : `<div class="hu-cal-d"><span>${i}</span></div>`;
    }
    box.innerHTML = heads + cells;
  }

  // ============= ĐẾM NGƯỢC =============
  // Tính từ ngày + giờ lễ, nhịp mỗi giây. Không có ngày thì ẩn cả trang; qua giờ
  // lễ thì về 00 và dừng hẳn.

  let _cdTimer = null;

  function huCountdown(dateStr, timeStr) {
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

  function huRenderTimeline(items, side, partyDate, ceremonyDate, ceremonyName) {
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
            (it) => `<div class="hu-plan-row">
              <span class="cx-h cx-a hu-plan-time">${escapeHtml(it.time || "")}</span>
              <span class="cx-t hu-plan-title">${escapeHtml(it.title || "")}</span>
            </div>`,
          )
          .join("");
        return `<div class="hu-plan-group">
          <div class="cx-t hu-plan-label">${escapeHtml(g.label)}${escapeHtml(dateLabel)}</div>
          ${rows}
        </div>`;
      })
      .join("");
    cxToggle("section-timeline", true);
  }

  // ============= CHUYỆN TÌNH YÊU =============
  // Mỗi mốc là MỘT trang: ảnh viền đỏ rượu dày trên khối đỏ rượu lệch, ngày dựng đứng ở cạnh
  // còn lại; ảnh đổi bên trái/phải so le giữa các mốc.

  function huRenderLoveStory(events) {
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
          ? `<div class="hu-photo hu-ls-photo hu-a hu-rise" style="--d: 1">${huShotImg(ev.image_url, ev.focal_point, true)}</div>`
          : "";
        const date = ev.date
          ? `<div class="cx-h cx-a hu-ls-date hu-a hu-up" style="--d: 3">${escapeHtml(ev.date)}</div>`
          : "";
        return `<div class="hu-page hu-ls${i % 2 ? " is-flip" : ""}">
          <div class="cx-h cx-a hu-cap hu-a hu-up">Our Story</div>
          <div class="hu-stage hu-ls-stage">
            <div class="hu-block hu-ls-block hu-a hu-grow" style="--d: 2"></div>
            ${img}
            ${date}
          </div>
          <div class="hu-ls-text hu-a hu-up" style="--d: 3">
            ${ev.title ? `<div class="cx-h cx-a hu-title hu-title-sm">${escapeHtml(ev.title)}</div>` : ""}
            ${ev.content ? `<div class="cx-t hu-line">${escapeHtml(ev.content)}</div>` : ""}
          </div>
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
          `<div class="hu-reel-cell" data-lb="${i}">${huShotImg(u, focalPoints?.[images[i]], false)}</div>`,
      )
      .join("");
    setText("hu-reel-n", String(urls.length));
    reel.querySelectorAll("[data-lb]").forEach((el) =>
      el.addEventListener("click", () => openLightbox(Number(el.dataset.lb))),
    );
    reel.addEventListener(
      "scroll",
      () => {
        const cell = reel.firstElementChild;
        if (!cell) return;
        const i = Math.round(reel.scrollLeft / (cell.offsetWidth + 12));
        setText("hu-reel-i", String(Math.min(urls.length, i + 1)));
      },
      { passive: true },
    );
  }

  // ============= LẬT TRANG =============
  // Trang = .hu-page (+ mục lời chúc do wishes-helper chèn). Trang chiếm >= 55%
  // khung nhìn là trang đang mở: nó nhận .is-active (hiệu ứng .hu-a chạy MỘT lần, vuốt
  // qua rồi vẫn giữ cờ nên không ẩn lại), chấm chỉ trang đổi theo, tới trang cuối thì giấu mũi tên vuốt.
  // Chỉ bật khi thiệp đã mở (onOpen) — chưa bật thì mọi thứ hiện sẵn, không mất chữ.

  let _huIO = null;
  let _huRevealIO = null;
  let _huPages = [];

  function huPages() {
    // Sắp theo vị trí thật: mục lời chúc nằm CUỐI DOM nhưng được đẩy lên bằng flex `order`.
    return [...document.querySelectorAll("#main-card .hu-page, #main-card .cx-wsec")]
      .filter((el) => el.getClientRects().length)
      .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
  }

  function huSetActive(page) {
    page.classList.add("is-active");
    const i = _huPages.indexOf(page);
    document.querySelectorAll("#hu-dots button").forEach((b, k) => b.classList.toggle("is-on", k === i));
    document.getElementById("hu-hint")?.classList.toggle("is-end", i === _huPages.length - 1);
  }

  function huScan() {
    const pages = huPages();
    if (pages.length === _huPages.length && pages.every((p, i) => p === _huPages[i])) return;
    _huPages = pages;
    const dots = document.getElementById("hu-dots");
    if (dots) {
      dots.innerHTML = pages.map(() => "<button type=\"button\" tabindex=\"-1\"></button>").join("");
      dots.querySelectorAll("button").forEach((b, k) =>
        b.addEventListener("click", () => _huPages[k]?.scrollIntoView({ behavior: "smooth" })),
      );
    }
    _huIO?.disconnect();
    _huIO = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) huSetActive(e.target);
        });
      },
      { threshold: 0.55 },
    );
    pages.forEach((p) => _huIO.observe(p));
    // Chữ hiện SỚM hơn chấm chỉ trang: mép trên trang vừa qua 85% khung nhìn là chạy,
    // đợi tới 55% như chấm thì vuốt lên thấy một khoảng trống dài.
    _huRevealIO?.disconnect();
    _huRevealIO = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add("is-active");
        });
      },
      { rootMargin: "0px 0px -15% 0px" },
    );
    pages.forEach((p) => _huRevealIO.observe(p));
    // Trang cao hơn khung nhìn (lịch trình dài…) không bao giờ đạt 55%: coi như
    // đã mở để chữ trong đó luôn hiện.
    pages.forEach((p) => p.classList.toggle("is-tall", p.offsetHeight > innerHeight * 1.5));
    const first = pages.find((p) => p.getBoundingClientRect().top >= -innerHeight / 2) || pages[0];
    if (first) huSetActive(first);
  }

  function huSlides() {
    document.documentElement.classList.add("hu-on");
    huScan();
    // Mục lời chúc + khối chèn thêm có thể vào sau khi thiệp mở → quét lại.
    const flow = document.querySelector("#main-card .hu-flow");
    if (flow && !flow._huMO) {
      let t = 0;
      // Chỉ bắt thay đổi ở cấp TRANG (thêm/ẩn mục), bỏ qua chữ đổi trong trang
      // (đồng hồ đếm ngược đổi mỗi giây). huScan tự thoát khi danh sách trang y nguyên.
      const pageLevel = (m) =>
        m.type === "childList"
          ? m.target === flow || m.target.id === "love-story-list"
          : m.target.parentElement === flow;
      flow._huMO = new MutationObserver((muts) => {
        if (!muts.some(pageLevel)) return;
        clearTimeout(t);
        t = setTimeout(huScan, 200);
      });
      flow._huMO.observe(flow, { childList: true, subtree: true, attributes: true, attributeFilter: ["style", "class"] });
    }
  }
})();
