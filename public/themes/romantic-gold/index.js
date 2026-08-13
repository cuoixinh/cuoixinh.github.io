// ============= THEME: ROMANTIC GOLD =============
// Sage + vàng đồng, thân thiệp cuộn dài theo từng mục. Nét riêng: KHÔNG có màn
// bìa — mở link là vào thẳng mục mở đầu dạng POSTER (ảnh tràn viền, chữ đè lên
// ảnh); kèm chữ lồng tên viết tắt và đồng hồ đếm ngược tới ngày cưới.
//
// File này chỉ KHAI BÁO: window.CX_THEME + renderWedding + phần đặc thù của mẫu.
// Phần "chạy" nằm ở core/helpers/theme-boot.js, nạp sau file này.
//
// Bọc trong IIFE, chỉ lộ CX_THEME + renderWedding: `const` cấp cao nhất của
// script cổ điển là biến toàn cục, trùng tên với trang khác là vỡ trang đó.

(function () {
  window.CX_THEME = {
    id: "romantic-gold",

    preset: {
      heading_font: "Cormorant Garamond",
      body_font: "Inter",
      heading_color: "#2d3436", // than chì
      body_color: "#8a9a8a", // sage-400
      accent_color: "#a89968", // gold-400
      background_color: "#ffffff", // #main-card
      swatches: [
        "#2d3436",
        "#4a5250",
        "#8a9a8a", // sage-400
        "#b4bfb4", // sage-300
        "#a89968", // gold-400
        "#c9b896", // gold-300
        "#e8dcc8", // gold-200
        "#f5f0e8", // gold-100
        "#f6f7f6", // sage-50
        "#e8ebe8", // sage-100
        "#ffffff",
      ],
    },

    // Mẫu gom về ba lớp ngữ nghĩa (.cx-h · .cx-t · .cx-a, khai trong theme.css).
    // .cx-hd/.cx-bd/.cx-ac là markup do helper dùng chung sinh ra — giữ nguyên.
    // Cố ý KHÔNG gồm .rg-on/.rg-gold: đó là chữ nằm TRÊN ảnh poster, đổi sang
    // màu sẫm là chìm nghỉm vào ảnh.
    selectors: {
      headingFont: ".cx-h, .font-cormorant",
      bodyFont: "body, .cx-t, .font-inter",
      headingColor: ".cx-h, .cx-hd",
      bodyColor: ".cx-t, .cx-bd",
      accentColor: ".cx-a, .cx-ac",
      background: "body, #main-card",
    },

    // Poster mở đầu KHÔNG hiện dần: nó choán cả màn ngay khi vào, cho trượt vào
    // thì khách thấy một khoảng trống trước đã.
    reveal: ["#main-card section:not(#section-hero)"],

    // id các mục trùng bảng mặc định của preview-focus-helper.js.
    onOpen: null,
  };

  const _isGroom = isGroomSide();

  // Lời chào trên poster chỉ hiện khi link gửi riêng cho một khách (?name=);
  // tên do setupPersonalizedGreeting() đổ vào #cover-guest-name.
  // Chạy ngay: chỉ phụ thuộc URL, không đợi dữ liệu thiệp về.
  try {
    if (new URLSearchParams(window.location.search).get("name")) {
      document.getElementById("cover-guest-wrap")?.classList.remove("hidden");
    }
  } catch (e) {}

  // ============= ĐỔ DỮ LIỆU LÊN THIỆP =============

  function renderWedding(w) {
    if (!w || !w.is_active) return;

    const side = _isGroom ? "groom" : "bride";

    // --- Nhạc nền ---
    setupMusic(w.music_url, w.enable_music);

    // --- Mở đầu: poster tràn viền (mẫu này không có màn bìa) ---
    renderHero(w, false);
    renderStoryQuote(w.story_quote);
    setText("hero-date", _posterDate(w.ceremony_date), "----.--.--");
    setText("monogram-groom", _initial(w.groom_name), "M");
    setText("monogram-bride", _initial(w.bride_name), "H");

    // --- Đếm ngược ---
    startCountdown(w.ceremony_date, w.ceremony_time);

    // Mẫu này KHÔNG có mục Gia đình (không markup, không gọi renderCoupleInfo)
    // — công tắc enable_family bên Thiết lập vì thế không tác dụng gì ở đây.

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

    // Khối tóm tắt trong trình phát nhạc — dùng CHÍNH phần lễ đang hiển thị.
    renderMusicSummary(w, {
      ceremonyName,
      ceremonyTime,
      ceremonyLocation: ceremonyLoc,
    });

    // --- Tiệc cưới (mỗi nhà một ngày/giờ/nơi riêng) ---
    const partyDate = w[`${side}_party_date`];
    const partyLocation = w[`${side}_party_location`];
    setText("party-section-label", "Tiệc Mừng " + ceremonyName);
    renderPartyDate(
      partyDate,
      w[`${side}_party_time`],
      w[`${side}_party_lunar`],
      partyLocation,
      "full",
    );
    cxToggle("section-party", cxEnabled(w.enable_party));

    setupMiniCalendar(w.ceremony_date, partyDate);

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
      renderTimeline(w.timeline, side, partyDate, w.ceremony_date, ceremonyName);
      cxToggle("section-timeline", true);
    }

    // --- Chuyện tình yêu ---
    if (cxEnabled(w.enable_love_story)) {
      renderLoveStory(w.love_story);
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

    // --- Bản đồ tới nơi đãi tiệc ---
    const mapUrl = w[`${side}_party_map_embed_url`];
    renderMap(mapUrl, partyLocation);
    const hasMap = !!extractMapEmbedUrl(mapUrl);
    cxToggle("map-thumbnail-iframe", hasMap);
    cxToggle("map-placeholder", !hasMap);
    document
      .getElementById("map-link")
      ?.classList.toggle("pointer-events-none", !hasMap);

    // --- Lời cảm ơn ---
    if (w.footer_text) setText("footer-text", w.footer_text);
    cxToggle("section-footer", cxEnabled(w.enable_footer));
  }

  window.renderWedding = renderWedding;

  // ============= POSTER MỞ ĐẦU =============

  /** Ngày cưới dạng 2025.05.20 cho dòng dưới cùng của poster. */
  function _posterDate(dateStr) {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (isNaN(d)) return "";
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}`;
  }

  /** Chữ cái đầu của TÊN (từ cuối cùng) — dùng cho chữ lồng. */
  function _initial(name) {
    const w = (name || "").trim().split(/\s+/).pop();
    return w ? w.charAt(0).toUpperCase() : "";
  }

  // ============= ĐẾM NGƯỢC TỚI NGÀY CƯỚI =============
  // Chỉ tính từ ceremony_date (+ giờ nếu có) nên không cần thêm gì ở trang
  // Thiết lập. Qua ngày cưới thì về 00 và dừng hẳn.

  let _cdTimer = null;

  function startCountdown(dateStr, timeStr) {
    if (_cdTimer) clearInterval(_cdTimer);
    if (!dateStr) {
      cxToggle("section-countdown", false);
      return;
    }

    const target = new Date(`${dateStr}T${timeStr || "00:00"}:00`).getTime();
    if (isNaN(target)) {
      cxToggle("section-countdown", false);
      return;
    }

    const pad = (n) => String(Math.max(0, n)).padStart(2, "0");

    function tick() {
      const left = target - Date.now();
      if (left <= 0) {
        setText("cd-days", "00");
        setText("cd-hours", "00");
        setText("cd-minutes", "00");
        clearInterval(_cdTimer);
        _cdTimer = null;
        return;
      }
      const min = Math.floor(left / 60000);
      setText("cd-days", pad(Math.floor(min / 1440)));
      setText("cd-hours", pad(Math.floor((min % 1440) / 60)));
      setText("cd-minutes", pad(min % 60));
    }

    tick();
    _cdTimer = setInterval(tick, 60000); // chỉ hiện tới PHÚT nên mỗi phút một nhịp
  }

  // ============= ALBUM ẢNH =============
  // Không phải một lưới phẳng: ảnh được rót lần lượt vào 3 khối bố cục
  //   1. tràn viền (1 ảnh hết bề ngang thiệp, kèm một dòng chữ viết tay)
  //   2. chồng lệch (2 ảnh so le)
  //   3. lưới (phần còn lại)
  // Ít ảnh thì khối nào không đủ ảnh sẽ tự ẩn, không để lại chỗ trống.

  const RG_BAND_TEXT = "Forever &amp; Always";

  /** Một ô ảnh bấm được để phóng to. `i` là vị trí trong lightboxImages. */
  function _photo(url, fp, i, cls) {
    const el = document.createElement("div");
    el.className = cls;
    el.innerHTML = `<img src="${url}" alt="" loading="lazy"
      class="w-full h-full object-cover"
      style="object-position:${fp?.x ?? 50}% ${fp?.y ?? 50}%">`;
    el.addEventListener("click", () => openLightbox(i));
    return el;
  }

  function renderGallery(images, focalPoints) {
    const grid = document.getElementById("gallery-grid");
    if (!grid) return;

    const list = images?.length
      ? images.map((f) => ({ url: getImageUrl(f), fp: focalPoints?.[f] }))
      : Array.from({ length: 8 }, (_, i) => ({
          url: createPlaceholderSVG(`Ảnh ${i + 1}`),
          fp: null,
        }));

    // Kho ảnh của lightbox dùng chung — thứ tự phải khớp chỉ số truyền vào _photo.
    lightboxImages.length = 0;
    lightboxImages.push(...list.map((p) => p.url));

    let n = 0; // ảnh kế tiếp chưa dùng
    const take = (k) => (n + k <= list.length ? list.slice(n, (n += k)) : null);
    const show = (id, on) => cxToggle(id, on);

    // 1. Một ảnh tràn hết bề ngang, chữ viết tay đè lên
    const bandWrap = document.getElementById("gallery-band");
    const band = take(1);
    if (bandWrap && band) {
      bandWrap.innerHTML = "";
      const box = document.createElement("div");
      box.className = "rg-band-photo";
      box.appendChild(_photo(band[0].url, band[0].fp, n - 1, "rg-band-img"));
      const cap = document.createElement("div");
      cap.className = "rg-band-cap rg-on rg-script";
      cap.innerHTML = RG_BAND_TEXT;
      box.appendChild(cap);
      bandWrap.appendChild(box);
    }
    show("gallery-band", !!(bandWrap && band));

    // 2. Hai ảnh chồng lệch tầng
    const stackWrap = document.getElementById("gallery-stack");
    const stack = take(2);
    if (stackWrap && stack) {
      stackWrap.innerHTML = "";
      const box = document.createElement("div");
      box.className = "rg-stack";
      const [a, b] = stack;
      box.appendChild(_photo(a.url, a.fp, n - 2, "rg-stack-a"));
      box.appendChild(_photo(b.url, b.fp, n - 1, "rg-stack-b"));
      stackWrap.appendChild(box);
    }
    show("gallery-stack", !!(stackWrap && stack));

    // 3. Phần còn lại xếp lưới, ảnh đầu chiếm cả hàng cho có nhịp
    grid.innerHTML = "";
    const rest = list.slice(n);
    rest.forEach((p, k) => {
      grid.appendChild(
        _photo(
          p.url,
          p.fp,
          n + k,
          "rounded-xl overflow-hidden cursor-pointer shadow-sm " +
            (k === 0 && rest.length % 2 === 1 ? "rg-photo-wide" : "aspect-[3/4]"),
        ),
      );
    });
    grid.classList.toggle("hidden", rest.length === 0);
  }
})();
