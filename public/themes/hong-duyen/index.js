// Mẫu HỒNG DUYÊN — thiệp lật trang tông đỏ đô, chỉ vàng. Chỉ KHAI BÁO:
// window.CX_THEME + renderWedding + phần đặc thù (ảnh xen, chữ lồng tên, mỗi mốc
// chuyện tình một trang, băng ảnh vuốt ngang, đếm ngược, bộ điều khiển lật trang).
// Phần "chạy" nằm ở core/helpers/theme-boot.js. Bọc IIFE: `const` cấp cao nhất là biến toàn cục.

(function () {
  window.CX_THEME = {
    // Trùng TÊN THƯ MỤC và cột `templates.template_name`.
    id: "hong-duyen",

    wishesMode: "guestbook",
    giftBox: "hop_trai_tim",

    music: { variant: "disc", chrome: "fixed-corner", art: "couple" },

    // Bộ màu MẶC ĐỊNH của mẫu — bản khai máy đọc được của đúng những giá trị
    // :root trong theme.css (nguồn sự thật). Trang Thiết lập đọc nó để hiện mục
    // "Mặc định"; theme_setting.palette ghi đè lên trên lúc chạy.
    // Sinh lại bằng: node scripts/check-theme-palette.mjs --write
    palette: {
      heading: "#5a141e",
      body: "#6e3238",
      accent: "#aa182a",
      accent_soft: "#f0c8c4",
      on_accent: "#ffffff",
      on_image: "#ffffff",
      on_lightbox: "#ffffff",
      card_bg: "#ffffff",
      page_bg: "#f8f0ec",
      surface: "#faf5f2",
      band: "#8b0014",
      panel: "#ffffff",
      panel_warm: "#fff7f2",
      cover: "#ffffff",
      cover_mid: "#faf5f2",
      cover_veil: "#ffffff",
      lightbox_bg: "#000000",
      line: "#ecd6cc",
      shadow: "#000000",
      scrim: "#000000",
      deco: "#e8c480",
      deco_soft: "#f8e4be",
      deco_2: "#c8a060",
      deco_2_soft: "#f4e2c0",
      shine_from: "#ffffff",
      shine_mid: "#faecce",
      shine_to: "#e8c480",
    },

    swatches: [
      "#5a141e",
      "#6e3238",
      "#8b0014",
      "#aa182a",
      "#e8c480",
      "#f8e4be",
      "#f0c8c4",
      "#faf5f2",
      "#ffffff",
    ],

    // Lời chúc theo tông đỏ của mẫu (khách không chỉnh được).
    wishes: {
      bubble: "#fff7f2",
      text: "#6e3238",
      accent: "#aa182a",
      btn: "#aa182a",
    },

    // Hiệu ứng hiện dần do hdSlides lo theo TỪNG TRANG, nên hiệu ứng cuộn chung trỏ vào một id không có để hai bên không chồng
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
    if (w.ceremony_date) {
      const d = new Date(w.ceremony_date + "T00:00:00");
      if (!isNaN(d)) setText("hd-cover-date", `${_pad(d.getDate())} · ${_pad(d.getMonth() + 1)} · ${d.getFullYear()}`);
    }
    if (w.story_quote) setText("story-quote", w.story_quote);
    const mono = `${hdInitial(w.groom_name)} & ${hdInitial(w.bride_name)}`;
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

    // --- Lịch tháng đè ảnh + đếm ngược (theo ngày giờ lễ) ---
    const partyDate = w[`${side}_party_date`];
    hdRenderCalendar(w.ceremony_date, partyDate);
    hdCountdown(w.ceremony_date, ceremonyTime);

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
    hdBindDirections();

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

  // ============= LỊCH THÁNG ĐÈ ẢNH =============
  // Tuần bắt đầu Thứ Hai; ngày lễ (+ ngày tiệc nếu cùng tháng) khoanh bằng trái tim.

  function hdRenderCalendar(ceremonyDate, partyDate) {
    const box = document.getElementById("hd-calendar");
    if (!box || !ceremonyDate) return;
    const d = new Date(ceremonyDate);
    const y = d.getFullYear();
    const m = d.getMonth();
    const marked = new Set([d.getDate()]);
    if (partyDate) {
      const p = new Date(partyDate);
      if (p.getFullYear() === y && p.getMonth() === m) marked.add(p.getDate());
    }
    const md = document.getElementById("hd-cal-md");
    if (md) md.innerHTML = `${_pad(d.getDate())}<small>/${_pad(m + 1)}</small>`;
    setText("hd-cal-year", `-${y}-`);

    const lead = (new Date(y, m, 1).getDay() + 6) % 7;
    const days = new Date(y, m + 1, 0).getDate();
    const heads = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"]
      .map((h) => `<div class="hd-cal-h">${h}</div>`)
      .join("");
    let cells = "<div></div>".repeat(lead);
    for (let i = 1; i <= days; i++) {
      cells += marked.has(i)
        ? `<div class="hd-cal-d is-on"><svg aria-hidden="true"><use href="#hd-heart"/></svg><span>${i}</span></div>`
        : `<div class="hd-cal-d"><span>${i}</span></div>`;
    }
    box.innerHTML = heads + cells;
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
  // Mỗi mốc là MỘT trang: ảnh lớn, ngày, tiêu đề, nội dung; mảng đỏ đổi trên/dưới so le.

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

  // ============= BẢN ĐỒ: NÚT CHỈ ĐƯỜNG =============
  // Nút nằm TRONG thẻ link bản đồ (cả bản sao "-2"): chặn mở link thường, đổi link tìm
  // địa điểm (?query=) thành link dẫn đường tới đúng điểm đó. Uỷ quyền một lần trên mục.

  function hdBindDirections() {
    const sec = document.getElementById("section-map");
    if (!sec || sec._hdDir) return;
    sec._hdDir = true;
    sec.addEventListener("click", (e) => {
      const link = e.target.closest("[data-hd-dir]")?.closest("a");
      if (!link) return;
      e.preventDefault();
      const q = new URL(link.href, location.href).searchParams.get("query");
      const url = q ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}` : link.href;
      window.open(url, "_blank", "noopener");
    });
  }

  // ============= LẬT TRANG =============
  // Trang = .hd-page (+ mục lời chúc do wishes-helper chèn). Trang vừa trồi vào
  // khung nhìn (mép trên qua 85% màn) nhận .is-seen MỘT LẦN, không gỡ: hiệu ứng .hd-a
  // chạy ngay lúc đang vuốt tới, cuộn ngược lại thì trang trên vẫn còn nguyên.
  // Trang chiếm >= 55% khung nhìn là trang đang mở (.is-active): chỉ để đổi chấm chỉ
  // trang + giấu mũi tên vuốt ở trang cuối. Chỉ bật khi thiệp đã mở (onOpen).

  let _hdIO = null;
  let _hdSeenIO = null;
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
    _hdSeenIO?.disconnect();
    _hdSeenIO = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          e.target.classList.add("is-seen");
          _hdSeenIO.unobserve(e.target);
        });
      },
      { rootMargin: "0px 0px -15% 0px" },
    );
    pages.filter((p) => !p.classList.contains("is-seen")).forEach((p) => _hdSeenIO.observe(p));
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
