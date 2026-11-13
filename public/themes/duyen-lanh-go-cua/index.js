// Duyên Lành Gõ Cửa — thiệp đỏ son chỉ vàng kiểu nhà Việt. Không có màn bìa bấm mở:
// đôi cửa son (#dl-gate) tự mở ra hai bên khi ảnh mở đầu đã tải, chạm vào thì mở sớm.
// Chỉ khai báo CX_THEME + renderWedding + phần đặc thù (cửa, lịch, ba ảnh so le).

(function () {
  window.CX_THEME = {
    id: "duyen-lanh-go-cua",
    wishesMode: "card",
    giftBox: "lixi_do_hy",
    music: { variant: "disc", chrome: "fixed-corner", art: "couple" },

    // Bộ màu MẶC ĐỊNH — bản khai máy đọc được của :root trong theme.css.
    // Sinh lại bằng: node scripts/check-theme-palette.mjs --write
    palette: {
      heading: "#5c1518",
      body: "#6e4a3c",
      accent: "#a01d22",
      accent_soft: "#c9a04a",
      on_accent: "#fff8ea",
      on_image: "#ffffff",
      on_lightbox: "#ffffff",
      card_bg: "#fffbf3",
      page_bg: "#f3e6cc",
      surface: "#fbf1dc",
      band: "#fdf4e3",
      panel: "#ffffff",
      panel_warm: "#fff7e8",
      cover: "#97191e",
      cover_mid: "#741216",
      cover_veil: "#3a0a0c",
      lightbox_bg: "#000000",
      line: "#e6cf9f",
      shadow: "#3a0a0c",
      scrim: "#2a0708",
      deco: "#cfa449",
      deco_soft: "#f3e2b6",
      deco_2: "#c8252b",
      deco_2_soft: "#f6b48a",
      shine_from: "#b6852c",
      shine_mid: "#f1d488",
      shine_to: "#b6852c",
    },

    swatches: ["#a01d22", "#5c1518", "#97191e", "#c8252b", "#cfa449", "#b6852c", "#6e4a3c", "#e6cf9f", "#fbf1dc", "#fffbf3", "#ffffff"],

    wishes: { bubble: "#fff7e8", text: "#6e4a3c", accent: "#a01d22", btn: "#a01d22" },

    // Mở đầu tự hiện theo đôi cửa (.dl-in), không vào danh sách hiện dần khi cuộn.
    reveal: [
      "#section-family",
      "#section-couple",
      "#section-ceremony",
      "#section-party",
      "#rsvp-section",
      "#section-timeline",
      "#love-story",
      "#section-photos",
      "#section-gift",
      "#section-map",
      "#section-footer",
    ],
    revealItems: ["#dl-trip figure", "#gallery-grid > div"],

    focus: {
      couple: ["#section-hero", "#section-couple"],
      photos: ["#section-photos", "#dl-trip"],
    },

    loveStory: "medium",
    onOpen: null,
  };

  const _isGroom = isGroomSide();
  const WD = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
  const pad = (n) => String(n).padStart(2, "0");
  const _date = (s) => {
    if (!s) return null;
    const d = new Date(s);
    return isNaN(d) ? null : d;
  };

  // ============= ĐÔI CỬA MỞ ĐẦU =============
  // Cửa vẽ thuần CSS nên đứng sẵn từ khung hình đầu. Mở khi ảnh mở đầu tải xong
  // (giữ tối thiểu GATE_HOLD cho khách kịp thấy), chậm nhất GATE_MAX dù dữ liệu chưa
  // về — thiệp bị khoá hay lỗi mạng cũng không kẹt sau cánh cửa.
  const GATE_HOLD = 900;
  const GATE_MAX = 3500;
  const gate = document.getElementById("dl-gate");
  const t0 = performance.now();
  let _gateDone = false;

  function openGate() {
    if (_gateDone) return;
    _gateDone = true;
    document.getElementById("section-hero")?.classList.add("dl-in");
    if (!gate) return;
    gate.classList.add("is-open");
    // Gỡ hẳn khi cánh đã khuất: còn nằm đó là chặn cú chạm vào thiệp.
    setTimeout(() => gate.remove(), 2000);
  }

  function openGateSoon() {
    setTimeout(openGate, Math.max(0, GATE_HOLD - (performance.now() - t0)));
  }

  if (gate) {
    if (typeof _cxSkipCover === "function" && _cxSkipCover()) {
      gate.remove();
      openGate();
    } else {
      // Cú chạm này cũng là cú chạm cho phép nhạc phát (youtube-helper mượn nó).
      gate.addEventListener("click", openGate);
      setTimeout(openGate, GATE_MAX);
    }
  }

  // ============= ĐỔ DỮ LIỆU LÊN THIỆP =============

  function renderWedding(w) {
    if (!w || !w.is_active) return;
    const side = _isGroom ? "groom" : "bride";

    // --- Mở đầu (trước setupMusic: ảnh màn đầu nhận src trước) ---
    renderHero(w, false);
    _whenImg(document.getElementById("main-photo"), openGateSoon);
    renderStoryQuote(w.story_quote);
    if (window.CX_GUEST) cxToggle("cover-guest-wrap", true);

    setupMusic(w.music_url, w.enable_music);

    // --- Gia đình + báo tin ---
    renderCoupleInfo(w);
    cxToggle("section-family", cxEnabled(w.enable_family));

    // --- Lễ: nhà gái bật Vu Quy thì thay toàn bộ phần lễ ---
    const isVuQuy = !_isGroom && cxEnabled(w.vu_quy_enabled);
    const ceremonyName = isVuQuy ? "Lễ Vu Quy" : w.ceremony_name || "Lễ Thành Hôn";
    const ceremonyTime = isVuQuy ? w.vu_quy_time : w.ceremony_time;
    const ceremonyLoc = isVuQuy ? w.vu_quy_location : w.ceremony_location || "";
    const cd = _date(w.ceremony_date);

    setText("hero-time", [ceremonyTime, cd ? WD[cd.getDay()] : ""].filter(Boolean).join(" · "), "--:--");
    setText("hero-date", cd ? `${pad(cd.getDate())}.${pad(cd.getMonth() + 1)}.${cd.getFullYear()}` : "", "--.--.----");

    setText("ceremony-event-name", ceremonyName);
    setText("dl-c-time", _clock(ceremonyTime), "-- giờ --");
    if (cd) {
      setText("dl-c-weekday", WD[cd.getDay()]);
      setText("dl-c-day", pad(cd.getDate()));
      setText("dl-c-month", `Tháng ${pad(cd.getMonth() + 1)}`);
      setText("dl-c-year", `Năm ${cd.getFullYear()}`);
    }
    setText("invite-lunar", w.ceremony_lunar ? `(Tức ${_lower(w.ceremony_lunar)})` : "", "--------------------");
    if (ceremonyLoc) {
      setText("ceremony-location-text", ceremonyLoc);
      cxToggle("ceremony-location-wrap", true);
    }

    renderMusicSummary(w, { ceremonyName, ceremonyTime, ceremonyLocation: ceremonyLoc });

    // --- Tiệc ---
    const partyDate = w[`${side}_party_date`];
    const pd = _date(partyDate);
    const partyTime = w[`${side}_party_time`];
    setText("party-section-label", "Tiệc Mừng " + ceremonyName);
    setText("dl-p-time", partyTime, "--:--");
    setText("dl-p-date", pd ? `${WD[pd.getDay()]} · ${pad(pd.getDate())}.${pad(pd.getMonth() + 1)}.${pd.getFullYear()}` : "", "------ · --.--.----");
    const pl = w[`${side}_party_lunar`];
    setText("party-lunar", pl ? `(Tức ${_lower(pl)})` : "", "(----)");
    setText("party-location", w[`${side}_party_location`], "------------------------");
    cxToggle("section-party", cxEnabled(w.enable_party));

    // Lịch tháng: theo ngày tiệc khi có tiệc, không thì theo ngày lễ.
    _renderCal(cxEnabled(w.enable_party) && pd ? pd : cd, [cd, pd]);

    // --- Xác nhận tham dự ---
    const rsvp = document.getElementById("rsvp-section");
    if (rsvp) rsvp.style.display = cxEnabled(w.rsvp_enabled) ? "flex" : "none";
    if (w.rsvp_message) {
      setText("rsvp-custom-message", w.rsvp_message);
      cxToggle("rsvp-custom-message", true);
    }

    // --- Lịch trình ---
    if (cxEnabled(w.enable_timeline)) {
      renderTimeline(w.timeline, side, partyDate, ...cxTimelineCeremony(w, ceremonyName));
      cxToggle("section-timeline", true);
    }

    // --- Chuyện tình yêu ---
    if (cxEnabled(w.enable_love_story)) renderLoveStory(w.love_story);
    else cxToggle("love-story", false);

    // --- Ảnh: ba tấm so le ở mục Lễ + album ---
    const photosOn = cxEnabled(w.enable_photos);
    _renderPhotos(photosOn ? w.gallery_images : null, w.image_focal_points?.gallery_images);
    cxToggle("section-photos", photosOn);
    cxToggle("dl-trip", photosOn);

    // --- Hộp mừng cưới ---
    renderQRCodes(w);
    cxToggle("section-gift", cxEnabled(w.enable_gift));

    // --- Bản đồ ---
    renderVenueMaps(w, side);

    // --- Lời cảm ơn: ảnh bìa làm nền ---
    const endImg = document.getElementById("dl-end-img");
    if (endImg) {
      endImg.src = cxImgSrc(getImageUrl(w.cover_image_url));
      endImg.style.objectPosition = cxFocal(w.image_focal_points?.cover_image_url);
    }
    if (w.footer_text) setText("footer-text", w.footer_text);
    cxToggle("section-footer", cxEnabled(w.enable_footer));
  }

  window.renderWedding = renderWedding;

  // Gọi fn khi ảnh đã có (hoặc hỏng) — ảnh trong suốt 1x1 ban đầu không tính.
  function _whenImg(img, fn) {
    if (!img) return fn();
    if (img.complete && img.naturalWidth > 1) return fn();
    img.addEventListener("load", fn, { once: true });
    img.addEventListener("error", fn, { once: true });
  }

  // "10:00" → "10 giờ 00"; chuỗi lạ thì để nguyên.
  function _clock(t) {
    const m = String(t || "").match(/^(\d{1,2})[:h](\d{2})/);
    return m ? `${pad(+m[1])} giờ ${m[2]}` : t || "";
  }

  // "Ngày 22 tháng 2…" / "Tức ngày 22…" → "ngày 22 tháng 2…" để nối sau chữ "Tức".
  function _lower(s) {
    s = String(s).trim().replace(/^\((.*)\)$/, "$1").replace(/^tức\s+/i, "");
    return s.charAt(0).toLowerCase() + s.slice(1);
  }

  // ============= LỊCH THÁNG =============
  // Tuần bắt đầu thứ Hai như lịch treo tường Việt; ngày cưới nằm trong trái tim.
  function _renderCal(base, marks) {
    const grid = document.getElementById("dl-cal-grid");
    if (!grid) return;
    const d = base || new Date();
    const y = d.getFullYear();
    const m = d.getMonth();
    setText("dl-cal-title", `Tháng ${m + 1} · ${y}`);
    const marked = new Set(
      marks.filter((x) => x && x.getFullYear() === y && x.getMonth() === m).map((x) => x.getDate()),
    );
    const lead = (new Date(y, m, 1).getDay() + 6) % 7;
    const days = new Date(y, m + 1, 0).getDate();
    const head = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"]
      .map((t, i) => `<div class="dl-cal-dow${i === 6 ? " is-sun" : ""}">${t}</div>`)
      .join("");
    let cells = "<div></div>".repeat(lead);
    for (let n = 1; n <= days; n++) {
      const sun = (lead + n - 1) % 7 === 6;
      const on = marked.has(n);
      cells += `<div class="dl-cal-day${sun ? " is-sun" : ""}${on ? " is-on" : ""}">${
        on ? '<svg viewBox="0 0 32 30" aria-hidden="true"><path d="M16 29C7 22 1 16.5 1 10A7.5 7.5 0 0 1 16 6a7.5 7.5 0 0 1 15 4c0 6.5-6 12-15 19z"/></svg>' : ""
      }<span>${n}</span></div>`;
    }
    grid.innerHTML = head + cells;
  }

  // ============= ẢNH =============
  // Ba ảnh đầu lên dải so le (tấm giữa cao hơn) ở mục Lễ; album nhận phần còn lại,
  // còn ít hơn 2 tấm thì album hiện đủ bộ. Mọi ảnh dùng chung một kho lightbox.
  function _renderPhotos(images, focalPoints) {
    const urls = images?.length
      ? images.map(getImageUrl)
      : Array(7).fill(null).map(() => createPlaceholderSVG("Chưa có ảnh"));
    const fp = (i) => cxFocal(focalPoints?.[images?.[i]]);

    lightboxImages.length = 0;
    lightboxImages.push(...urls);

    const img = (i) =>
      `<img src="${cxImgSrc(urls[i])}" alt="" loading="lazy" style="object-position:${fp(i)}">`;

    const trip = document.getElementById("dl-trip");
    const tripN = Math.min(3, urls.length);
    if (trip) {
      trip.innerHTML = "";
      for (let i = 0; i < tripN; i++) {
        const f = document.createElement("figure");
        f.innerHTML = img(i);
        f.addEventListener("click", () => openLightbox(i));
        trip.appendChild(f);
      }
    }

    const grid = document.getElementById("gallery-grid");
    if (!grid) return;
    const from = urls.length - tripN >= 2 ? tripN : 0;
    grid.innerHTML = "";
    for (let i = from; i < urls.length; i++) {
      const cell = document.createElement("div");
      cell.innerHTML = img(i);
      cell.addEventListener("click", () => openLightbox(i));
      grid.appendChild(cell);
    }
  }
})();
