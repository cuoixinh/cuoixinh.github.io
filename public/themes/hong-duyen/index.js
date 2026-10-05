// Mẫu HỒNG DUYÊN — thiệp lật trang tông hồng, hoạ tiết sen. Chỉ KHAI BÁO:
// window.CX_THEME + renderWedding + phần đặc thù (ảnh xen, chữ lồng tên, mỗi mốc
// chuyện tình một trang, băng ảnh vuốt ngang, đếm ngược, bộ điều khiển lật trang).
// Phần "chạy" nằm ở core/helpers/theme-boot.js. Bọc IIFE: `const` cấp cao nhất là biến toàn cục.

(function () {
  window.CX_THEME = {
    // Trùng TÊN THƯ MỤC và cột `templates.template_name`.
    id: "hong-duyen",

    wishesMode: "card",
    giftBox: "phongbi_hong_no",

    music: { variant: "disc", chrome: "fixed-corner", art: "couple" },

    // Bộ màu MẶC ĐỊNH của mẫu — bản khai máy đọc được của đúng những giá trị
    // :root trong theme.css (nguồn sự thật). Trang Thiết lập đọc nó để hiện mục
    // "Mặc định"; theme_setting.palette ghi đè lên trên lúc chạy.
    // Sinh lại bằng: node scripts/check-theme-palette.mjs --write
    palette: {
      heading: "#5e2a3d",
      body: "#7a4a5a",
      accent: "#c94c78",
      accent_soft: "#f6c9d8",
      on_accent: "#ffffff",
      on_image: "#ffffff",
      on_lightbox: "#ffffff",
      card_bg: "#ffffff",
      page_bg: "#fbeef2",
      surface: "#fff7f9",
      band: "#fbe4ec",
      panel: "#ffffff",
      panel_warm: "#fff7f9",
      cover: "#ffffff",
      cover_mid: "#fff7f9",
      cover_veil: "#ffffff",
      lightbox_bg: "#000000",
      line: "#f3d6e0",
      shadow: "#000000",
      scrim: "#000000",
      deco: "#e07a9b",
      deco_soft: "#f8d6e2",
      deco_2: "#96b48c",
      deco_2_soft: "#d6e6ce",
      shine_from: "#ffffff",
      shine_mid: "#fbe4ec",
      shine_to: "#e07a9b",
    },

    swatches: [
      "#5e2a3d",
      "#7a4a5a",
      "#c94c78",
      "#e07a9b",
      "#f6c9d8",
      "#fbe4ec",
      "#d6e6ce",
      "#fff7f9",
      "#ffffff",
    ],

    // Lời chúc theo tông hồng của mẫu (khách không chỉnh được).
    wishes: {
      bubble: "#fff7f9",
      text: "#7a4a5a",
      accent: "#c94c78",
      btn: "#c94c78",
    },

    // Hiệu ứng hiện dần do hdSlides lo theo TỪNG TRANG (chạy lại mỗi lần lật
    // tới), nên hiệu ứng cuộn chung trỏ vào một id không có để hai bên không chồng
    // lên nhau (mảng rỗng làm theme-boot ném lỗi selector rỗng).
    reveal: ["#hd-no-reveal"],
    suggest: "#section-gift",
    skipSteps: [],

    // Mỗi mốc chuyện tình chiếm trọn một trang, chữ dưới ảnh.
    loveStory: "short",

    onOpen: () => hdSlides(),
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
    if (w.story_quote) setText("story-quote", w.story_quote);
    const mono = `${hdInitial(w.groom_name)} & ${hdInitial(w.bride_name)}`;
    setText("hd-mono", mono);
    setText("hd-mono-2", mono);

    hdFillShots(gallery, galleryFp);

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

    hdCountdown(w.ceremony_date, ceremonyTime);

    // --- Tiệc cưới (mỗi nhà một ngày/giờ/nơi riêng) ---
    const partyDate = w[`${side}_party_date`];
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
      hdRenderTimeline(w.timeline, side, partyDate, w.ceremony_date, ceremonyName);
    }

    // --- Chuyện tình yêu ---
    if (cxEnabled(w.enable_love_story)) {
      hdRenderLoveStory(w.love_story);
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

  // Chữ cái đầu của TÊN GỌI (chữ cuối trong họ tên Việt): "Đức Anh" → "A".
  function hdInitial(name) {
    const word = String(name || "").trim().split(/\s+/).pop() || "";
    return word.charAt(0).toUpperCase() || "-";
  }

  // ============= ẢNH XEN TRONG CÁC TRANG =============
  // Ô [data-hd-shot="i"] lấy ảnh album thứ i, album ngắn thì quay vòng lại từ
  // đầu ("last" = ảnh cuối). Không có ảnh nào thì ô tự ẩn.

  function hdShotImg(url, fp, eager) {
    return `<img src="${cxImgSrc(url)}" alt="" class="w-full h-full object-cover"
      style="object-position:${cxFocal(fp)}"${eager ? "" : ' loading="lazy"'} />`;
  }

  function hdFillShots(images, focal) {
    document.querySelectorAll("[data-hd-shot]").forEach((slot) => {
      const key = slot.getAttribute("data-hd-shot");
      if (!images.length) {
        slot.classList.add("hidden");
        return;
      }
      const idx = key === "last" ? images.length - 1 : Number(key) % images.length;
      slot.classList.remove("hidden");
      // Ảnh trong #main-card của mẫu có bìa KHÔNG lazy (xem CLAUDE.md).
      slot.innerHTML = hdShotImg(images[idx], focal?.[images[idx]], true);
    });
  }

  // ============= ĐẾM NGƯỢC =============
  // Tính từ ngày + giờ lễ, nhịp mỗi giây. Không có ngày thì ẩn cả trang; qua giờ
  // lễ thì về 00 và dừng hẳn.

  let _cdTimer = null;

  function hdCountdown(dateStr, timeStr) {
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

  function hdRenderTimeline(items, side, partyDate, ceremonyDate, ceremonyName) {
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
            (it) => `<div class="hd-plan-row">
              <span class="cx-h cx-a hd-plan-time">${escapeHtml(it.time || "")}</span>
              <span class="cx-t hd-plan-title">${escapeHtml(it.title || "")}</span>
            </div>`,
          )
          .join("");
        return `<div class="hd-plan-group">
          <div class="cx-t hd-plan-label">${escapeHtml(g.label)}${escapeHtml(dateLabel)}</div>
          ${rows}
        </div>`;
      })
      .join("");
    cxToggle("section-timeline", true);
  }

  // ============= CHUYỆN TÌNH YÊU =============
  // Mỗi mốc là MỘT trang: ảnh lớn, ngày, tiêu đề, nội dung; hoa sen đổi góc so le.

  function hdRenderLoveStory(events) {
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
          ? `<div class="hd-frame hd-ls-photo hd-a hd-zoom">${hdShotImg(ev.image_url, ev.focal_point, true)}</div>`
          : "";
        return `<div class="hd-page hd-ls${i % 2 ? " is-flip" : ""}">
          <svg class="hd-branch hd-ls-branch hd-a hd-fade" style="--d: 4" aria-hidden="true"><use href="#hd-branch"/></svg>
          <div class="cx-h cx-a hd-title hd-a hd-up">Chuyện của chúng mình</div>
          ${img}
          <div class="hd-ls-text hd-a hd-up" style="--d: 2">
            ${ev.date ? `<div class="cx-h cx-a hd-ls-date">${escapeHtml(ev.date)}</div>` : ""}
            ${ev.title ? `<div class="cx-t hd-ls-title">${escapeHtml(ev.title)}</div>` : ""}
            ${ev.content ? `<div class="cx-t hd-ls-body">${escapeHtml(ev.content)}</div>` : ""}
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
          `<div class="hd-reel-cell" data-lb="${i}">${hdShotImg(u, focalPoints?.[images[i]], false)}</div>`,
      )
      .join("");
    setText("hd-reel-n", String(urls.length));
    reel.querySelectorAll("[data-lb]").forEach((el) =>
      el.addEventListener("click", () => openLightbox(Number(el.dataset.lb))),
    );
    reel.addEventListener(
      "scroll",
      () => {
        const cell = reel.firstElementChild;
        if (!cell) return;
        const i = Math.round(reel.scrollLeft / (cell.offsetWidth + 12));
        setText("hd-reel-i", String(Math.min(urls.length, i + 1)));
      },
      { passive: true },
    );
  }

  // ============= LẬT TRANG =============
  // Trang = .hd-page (+ mục lời chúc do wishes-helper chèn). Trang chiếm >= 55%
  // khung nhìn là trang đang mở: nó nhận .is-active (hiệu ứng .hd-a chạy lại mỗi
  // lần lật tới), chấm chỉ trang đổi theo, tới trang cuối thì giấu mũi tên vuốt.
  // Chỉ bật khi thiệp đã mở (onOpen) — chưa bật thì mọi thứ hiện sẵn, không mất chữ.

  let _hdIO = null;
  let _hdPages = [];

  function hdPages() {
    // Sắp theo vị trí thật: mục lời chúc nằm CUỐI DOM nhưng được đẩy lên bằng flex `order`.
    return [...document.querySelectorAll("#main-card .hd-page, #main-card .cx-wsec")]
      .filter((el) => el.getClientRects().length)
      .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
  }

  function hdSetActive(page) {
    _hdPages.forEach((p) => p.classList.toggle("is-active", p === page));
    const i = _hdPages.indexOf(page);
    document.querySelectorAll("#hd-dots button").forEach((b, k) => b.classList.toggle("is-on", k === i));
    document.getElementById("hd-hint")?.classList.toggle("is-end", i === _hdPages.length - 1);
  }

  function hdScan() {
    const pages = hdPages();
    if (pages.length === _hdPages.length && pages.every((p, i) => p === _hdPages[i])) return;
    _hdPages = pages;
    const dots = document.getElementById("hd-dots");
    if (dots) {
      dots.innerHTML = pages.map(() => "<button type=\"button\" tabindex=\"-1\"></button>").join("");
      dots.querySelectorAll("button").forEach((b, k) =>
        b.addEventListener("click", () => _hdPages[k]?.scrollIntoView({ behavior: "smooth" })),
      );
    }
    _hdIO?.disconnect();
    _hdIO = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) hdSetActive(e.target);
        });
      },
      { threshold: 0.55 },
    );
    pages.forEach((p) => _hdIO.observe(p));
    // Trang cao hơn khung nhìn (lịch trình dài…) không bao giờ đạt 55%: coi như
    // đã mở để chữ trong đó luôn hiện.
    pages.forEach((p) => p.classList.toggle("is-tall", p.offsetHeight > innerHeight * 1.5));
    const first = pages.find((p) => p.getBoundingClientRect().top >= -innerHeight / 2) || pages[0];
    if (first) hdSetActive(first);
  }

  function hdSlides() {
    document.documentElement.classList.add("hd-on");
    hdScan();
    // Mục lời chúc + khối chèn thêm có thể vào sau khi thiệp mở → quét lại.
    const flow = document.querySelector("#main-card .hd-flow");
    if (flow && !flow._hdMO) {
      let t = 0;
      // Chỉ bắt thay đổi ở cấp TRANG (thêm/ẩn mục), bỏ qua chữ đổi trong trang
      // (đồng hồ đếm ngược đổi mỗi giây). hdScan tự thoát khi danh sách trang y nguyên.
      const pageLevel = (m) =>
        m.type === "childList"
          ? m.target === flow || m.target.id === "love-story-list"
          : m.target.parentElement === flow;
      flow._hdMO = new MutationObserver((muts) => {
        if (!muts.some(pageLevel)) return;
        clearTimeout(t);
        t = setTimeout(hdScan, 200);
      });
      flow._hdMO.observe(flow, { childList: true, subtree: true, attributes: true, attributeFilter: ["style", "class"] });
    }
  }
})();
