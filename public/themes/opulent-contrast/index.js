// OPULENT CONTRAST — thiệp trắng kiểu tạp chí ảnh phim, chữ viết tay xanh mực + tông xanh lam sương.
// Chỉ KHAI BÁO: CX_THEME + renderWedding + phần đặc thù (album rải ảnh vào ba dải xen
// thơ, lịch riêng có trái tim khoanh ngày). Phần "chạy" ở core/helpers/theme-boot.js.
// Bọc IIFE: `const` cấp cao nhất của script cổ điển là biến toàn cục.

(function () {
  window.CX_THEME = {
    id: "opulent-contrast",

    wishesMode: "card",

    giftBox: "lixi_vang_do",

    // Nút góc màn gọn: thẻ nhạc lớn đã nằm ở màn mở đầu, nút này chỉ hiện khi cuộn qua.
    music: { variant: "mini", chrome: "fixed-corner", art: "couple" },

    // Bản khai máy đọc của :root trong theme.css — sinh lại: npm run check:palette -- --write
    palette: {
      heading: "#1c2430",
      body: "#4a5260",
      accent: "#3f5a7a",
      accent_soft: "#a9bccf",
      on_accent: "#ffffff",
      on_image: "#ffffff",
      on_lightbox: "#ffffff",
      card_bg: "#ffffff",
      page_bg: "#e9edf1",
      surface: "#f5f7f9",
      band: "#f2f5f8",
      panel: "#ffffff",
      panel_warm: "#f8f9fa",
      cover: "#eef1f4",
      cover_mid: "#dde3ea",
      cover_veil: "#ffffff",
      lightbox_bg: "#000000",
      line: "#d3d9e0",
      shadow: "#000000",
      scrim: "#000000",
      deco: "#2f4a68",
      deco_soft: "#d4dde8",
      deco_2: "#a39e94",
      deco_2_soft: "#e4e1dc",
      shine_from: "#3f5a7a",
      shine_mid: "#2f4a68",
      shine_to: "#a9bccf",
    },

    swatches: [
      "#1c2430",
      "#4a5260",
      "#3f5a7a",
      "#2f4a68",
      "#a9bccf",
      "#d4dde8",
      "#a39e94",
      "#d3d9e0",
      "#f5f7f9",
      "#ffffff",
    ],

    // Lời chúc trên nền trắng: thẻ xanh sương rất nhạt, tên khách màu xanh lam nhấn.
    wishes: { bubble: "#f2f5f8", text: "#4a5260", accent: "#3f5a7a", btn: "#3f5a7a" },

    reveal: ["#main-card section"],

    suggest: "#section-gift",

    skipSteps: [],

    // Thơ xen giữa ảnh khá dài nên mốc chuyện tình viết ngắn cho thoáng.
    loveStory: "short",

    onOpen: null,
  };

  const _isGroom = isGroomSide();

  // Thẻ nhạc ở màn mở đầu là trình phát THỨ HAI trên trang: helper chỉ tự gắn vào
  // trình phát đầu tiên (nút góc màn) nên phải gắn tay. Iframe chỉ đọc bản khai thì không có thẻ.
  const _musicCard = document.getElementById("oc-music-card");
  if (_musicCard) window.setupMusicPlayer?.(_musicCard);

  function renderWedding(w) {
    if (!w || !w.is_active) return;

    const side = _isGroom ? "groom" : "bride";

    // Ảnh màn đầu nhận src TRƯỚC setupMusic (nó kéo YouTube API về ngay).
    renderCover(w);
    setText("oc-mono-groom", _initial(w.groom_name), "-");
    setText("oc-mono-bride", _initial(w.bride_name), "-");
    renderHero(w, false);
    setText("oc-hero-date", _fmtDMY(w.ceremony_date), "--.--.----");
    // Dấu ngoặc kép do CSS vẽ (.oc-quote) nên đổ nguyên câu, không qua renderStoryQuote.
    if (w.story_quote) setText("story-quote", w.story_quote);
    setText(
      "oc-quote-sign",
      [w.groom_name, w.bride_name].filter(Boolean).join(" & "),
      "----------",
    );

    // Nền mờ của bìa: ảnh đầu album cho khác ảnh polaroid, không có album thì ảnh bìa.
    const g0 = w.gallery_images?.[0];
    const bgFp = g0 ? w.image_focal_points?.gallery_images?.[g0] : w.image_focal_points?.cover_image_url;
    setAttr("oc-cover-bg", "src", getImageUrl(g0 || w.cover_image_url));
    applyFocalPoint("oc-cover-bg", bgFp);

    setupMusic(w.music_url, w.enable_music);
    // Thẻ nhạc: nền là ảnh đầu album (không có thì ảnh bìa), đĩa than in ảnh bìa.
    setAttr("oc-mcard-bg", "src", getImageUrl(g0 || w.cover_image_url));
    applyFocalPoint("oc-mcard-bg", bgFp);
    setAttr("oc-mcard-disc", "src", getImageUrl(w.cover_image_url));
    applyFocalPoint("oc-mcard-disc", w.image_focal_points?.cover_image_url);
    cxToggle("oc-music-card", !!window.__cxMusicOn);

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

    // --- Tiệc cưới ---
    const partyDate = w[`${side}_party_date`];
    setText("party-section-label", "Tiệc Mừng " + ceremonyName);
    renderPartyDate(
      partyDate,
      w[`${side}_party_time`],
      w[`${side}_party_lunar`],
      w[`${side}_party_location`],
      "full",
    );
    _renderCalendar(partyDate || w.ceremony_date, [partyDate, w.ceremony_date]);
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

    // --- Lịch trình ---
    if (cxEnabled(w.enable_timeline)) {
      renderTimeline(w.timeline, side, partyDate, w.ceremony_date, ceremonyName);
      cxToggle("section-timeline", true);
    }

    // --- Chuyện tình yêu ---
    if (cxEnabled(w.enable_love_story)) {
      _renderLoveStory(w.love_story);
    } else {
      cxToggle("love-story", false);
    }

    // --- Album ảnh ---
    if (cxEnabled(w.enable_photos)) {
      renderGallery(w.gallery_images, w.image_focal_points?.gallery_images);
    } else {
      cxToggle("section-photos", false);
    }

    // --- Hộp mừng cưới ---
    renderQRCodes(w);
    cxToggle("section-gift", cxEnabled(w.enable_gift));

    renderVenueMaps(w, side);
    _bindDirections();

    // --- Lời cảm ơn: ảnh cuối album (không có thì ảnh bìa) mờ viền ---
    const gallery = w.gallery_images || [];
    const footerImg = gallery.length ? gallery[gallery.length - 1] : w.cover_image_url;
    const footerFp = gallery.length
      ? w.image_focal_points?.gallery_images?.[footerImg]
      : w.image_focal_points?.cover_image_url;
    setAttr("oc-footer-photo", "src", getImageUrl(footerImg));
    applyFocalPoint("oc-footer-photo", footerFp);
    if (w.footer_text) setText("footer-text", w.footer_text);
    cxToggle("section-footer", cxEnabled(w.enable_footer));
  }

  window.renderWedding = renderWedding;

  // Nút [data-oc-dir] nằm trong link bản đồ (cả bản sao -2): đổi link tìm địa điểm
  // (?query=) thành link dẫn đường tới đúng điểm đó. Uỷ quyền một lần trên mục.
  function _bindDirections() {
    const sec = document.getElementById("section-map");
    if (!sec || sec._ocDir) return;
    sec._ocDir = true;
    sec.addEventListener("click", (e) => {
      const link = e.target.closest("[data-oc-dir]")?.closest("a");
      if (!link) return;
      e.preventDefault();
      const q = new URL(link.href, location.href).searchParams.get("query");
      const url = q
        ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}`
        : link.href;
      window.open(url, "_blank", "noopener");
    });
  }

  // Chữ cái đầu của TÊN RIÊNG (từ cuối) — chữ lồng "T & L" ở bìa.
  function _initial(name) {
    const parts = String(name || "").trim().split(/\s+/);
    return (parts[parts.length - 1] || "").charAt(0).toUpperCase();
  }

  // "2026-10-18" → "18.10.2026"; chuỗi rỗng nếu không phân giải được.
  function _fmtDMY(dateStr) {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
  }

  // ============= CHUYỆN TÌNH: ảnh ngang/dọc xen kẽ =============
  // Xoay vòng ba kiểu theo thứ tự mốc: ảnh ngang tràn bề rộng (chữ dưới, căn trái) · ảnh dọc
  // bên phải (ngày + tiêu đề bên trái) · ảnh dọc bên trái. Mốc không ảnh chỉ có chữ.

  function _renderLoveStory(events) {
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
        const head = `
          ${ev.date ? `<div class="oc-script oc-ls-date">${escapeHtml(ev.date)}</div>` : ""}
          ${ev.title ? `<div class="oc-ls-title">${escapeHtml(ev.title)}</div>` : ""}`;
        const body = ev.content ? `<div class="cx-t oc-ls-body">${escapeHtml(ev.content)}</div>` : "";
        if (!ev.image_url) return `<div class="oc-ls is-text">${head}${body}</div>`;

        const kind = ["is-wide", "is-right", "is-left"][i % 3];
        const fp = ev.focal_point ? ` style="object-position:${cxFocal(ev.focal_point)}"` : "";
        const img = `<img src="${cxImgSrc(ev.image_url)}" alt="" loading="lazy" class="oc-photo oc-ls-img"${fp} />`;
        return kind === "is-wide"
          ? `<div class="oc-ls is-wide">${img}<div class="oc-ls-head">${head}</div>${body}</div>`
          : `<div class="oc-ls ${kind}"><div class="oc-ls-row"><div class="oc-ls-head">${head}</div>${img}</div>${body}</div>`;
      })
      .join("");
  }

  // ============= ALBUM: ba dải xen thơ =============
  // #gallery-grid: 1 ảnh lớn + 1 cặp · #oc-gal-side: 1 ảnh cạnh cột chữ dọc ·
  // #oc-gal-rest: phần còn lại, lặp [lớn, cặp]. Thứ tự lightbox = thứ tự ảnh gốc.

  function renderGallery(images, focalPoints) {
    const urls = images?.length
      ? images.map(getImageUrl)
      : Array(6)
          .fill(null)
          .map(() => createPlaceholderSVG("Chưa có ảnh"));

    lightboxImages.length = 0;
    lightboxImages.push(...urls);

    const img = (i, cls) => {
      const fp = focalPoints?.[images?.[i]];
      return `<img src="${cxImgSrc(urls[i])}" alt="" loading="lazy" data-i="${i}"
        class="oc-photo ${cls}" style="object-position:${cxFocal(fp)}">`;
    };
    // Một ảnh lẻ cuối dải thì dàn hết ngang thay cho cặp thiếu một nửa.
    const pair = (i) =>
      i + 1 < urls.length
        ? `<div class="oc-pair">${img(i, "oc-ph-pair")}${img(i + 1, "oc-ph-pair")}</div>`
        : img(i, "oc-ph-full");

    const mounts = {
      "gallery-grid": "",
      "oc-gal-side": "",
      "oc-gal-rest": "",
    };
    let i = 0;
    if (i < urls.length) mounts["gallery-grid"] += img(i++, "oc-ph-full");
    if (i < urls.length) {
      mounts["gallery-grid"] += pair(i);
      i += 2;
    }
    if (i < urls.length) mounts["oc-gal-side"] += img(i++, "oc-ph-tall");
    while (i < urls.length) {
      mounts["oc-gal-rest"] += img(i++, "oc-ph-full");
      if (i < urls.length) {
        mounts["oc-gal-rest"] += pair(i);
        i += 2;
      }
    }

    Object.entries(mounts).forEach(([id, html]) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.innerHTML = html;
      el.onclick = (e) => {
        const t = e.target.closest("img[data-i]");
        if (t) openLightbox(+t.dataset.i);
      };
    });
    // Không đủ ảnh cho dải cạnh cột chữ dọc thì giấu luôn cột chữ.
    const side = document.getElementById("oc-gal-side");
    side?.parentElement.classList.toggle("hidden", !mounts["oc-gal-side"]);
  }

  // ============= LỊCH: tháng của ngày tiệc, trái tim khoanh ngày cưới =============

  function _renderCalendar(baseDate, marks) {
    const box = document.getElementById("oc-calendar");
    if (!box) return;
    const d = baseDate ? new Date(baseDate) : null;
    if (!d || isNaN(d.getTime())) {
      box.innerHTML = "";
      return;
    }
    const y = d.getFullYear();
    const m = d.getMonth();
    const marked = new Set(
      marks
        .map((s) => (s ? new Date(s) : null))
        .filter((x) => x && !isNaN(x.getTime()) && x.getFullYear() === y && x.getMonth() === m)
        .map((x) => x.getDate()),
    );
    const pad = (n) => String(n).padStart(2, "0");
    // Tuần bắt đầu từ Thứ Hai: getDay() 0 (CN) dồn về cuối.
    const lead = (new Date(y, m, 1).getDay() + 6) % 7;
    const days = new Date(y, m + 1, 0).getDate();
    const cells = [];
    for (let k = 0; k < lead; k++) cells.push("<div></div>");
    for (let day = 1; day <= days; day++) {
      cells.push(
        marked.has(day)
          ? `<div class="oc-cal-d is-on"><i data-lucide="heart"></i><span class="relative">${day}</span></div>`
          : `<div class="oc-cal-d">${day}</div>`,
      );
    }
    box.innerHTML = `
      <div class="oc-cal-head">
        <div class="oc-cal-mm">Tháng ${pad(m + 1)}</div>
        <div class="oc-cal-yy">—${y}—</div>
      </div>
      <div class="oc-cal-grid">
        ${["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((n) => `<div class="oc-cal-wd">${n}</div>`).join("")}
        ${cells.join("")}
      </div>`;
    window.lucide?.createIcons({ root: box });
  }
})();
