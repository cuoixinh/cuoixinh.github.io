// ============= THEME: ROMANTIC BLUSH =============
// Hồng phấn · kem trắng · nâu espresso. Nét riêng: mục mở đầu xếp theo lối thiệp
// in (tên thư pháp → hàng ngày giờ → nơi tổ chức → hàng chip nhảy nhanh → ảnh);
// toàn thiệp không dùng hình trang trí, chỉ có chữ và khoảng trắng.
//
// File này chỉ KHAI BÁO: window.CX_THEME + renderWedding + phần đặc thù của mẫu
// (hàng ngày giờ ở mục mở đầu, chip nhảy nhanh, lưới ảnh). Phần "chạy" nằm ở
// core/helpers/theme-boot.js, nạp sau file này.
//
// Bọc trong IIFE, chỉ lộ CX_THEME + renderWedding: `const` cấp cao nhất của
// script cổ điển là biến toàn cục, trùng tên với trang khác là vỡ trang đó.

(function () {
  window.CX_THEME = {
    id: "romantic-blush",

    preset: {
      heading_font: "Cormorant Garamond",
      body_font: "Quicksand",
      heading_color: "#4a3229", // nâu espresso
      body_color: "#8a6f64", // nâu sữa
      accent_color: "#c98a8e", // hồng rose
      background_color: "#fdf8f5", // kem trắng — nền #main-card
      swatches: [
        "#4a3229",
        "#6b4c3f",
        "#8a6f64",
        "#2e1f1a",
        "#c98a8e",
        "#e0a4a8",
        "#e8bcbb",
        "#f0d5d3",
        "#faeae7",
        "#fbf4f0",
        "#ffffff",
      ],
    },

    // Mẫu gom về ba lớp ngữ nghĩa (.cx-h · .cx-t · .cx-a, khai trong theme.css).
    // .cx-hd/.cx-bd/.cx-ac là markup do helper dùng chung sinh ra (dòng thời
    // gian, chuyện tình yêu) — GIỮ NGUYÊN khi chép sang mẫu mới.
    // .rb-script (tên cô dâu chú rể, câu slogan) đi theo MÀU tiêu đề nhưng
    // KHÔNG theo font: bảng chọn font chỉ có font Google, đổi xong khách không
    // quay lại được font thư pháp tự host.
    selectors: {
      headingFont: ".cx-h, .font-cormorant",
      bodyFont: "body, .cx-t, .font-inter",
      headingColor: ".cx-h, .cx-hd, .rb-script",
      bodyColor: ".cx-t, .cx-bd",
      accentColor: ".cx-a, .cx-ac",
      background: "body, #main-card",
    },

    // Mục mở đầu KHÔNG hiện dần: nó là thứ khách thấy ngay khi bìa mở ra, cho
    // trượt vào thì có một nhịp trống trước đã.
    reveal: ["#main-card section:not(#section-hero)"],

    // Mốc bung bảng đề xuất mẫu khác ở bản xem thử (?preview=true).
    suggest: "#section-gift",

    // Mẫu vẽ đủ mọi mục nên trang Thiết lập không phải bỏ bước nào.
    skipSteps: [],

    // id các mục trùng bảng mặc định của preview-focus-helper.js nên không cần
    // khai `focus`.

    onOpen: null,
  };

  const _isGroom = isGroomSide();

  // ============= ĐỔ DỮ LIỆU LÊN THIỆP =============
  // Gọi theo đúng thứ tự các mục trong index.html.

  function renderWedding(w) {
    if (!w || !w.is_active) return;

    const side = _isGroom ? "groom" : "bride";
    const partyDate = w[`${side}_party_date`];
    const partyLocation = w[`${side}_party_location`];

    // --- Màn bìa ---
    // Khối dựng ảnh chạy TRƯỚC setupMusic: đây là chỗ ảnh của màn ĐẦU TIÊN nhận
    // src, mà setupMusic kéo YouTube iframe API (script bên thứ ba) về ngay khi
    // chạy — để nó đi trước là ảnh phải xếp hàng sau.
    renderCover(w);

    // --- Mở đầu ---
    renderHero(w, false);
    renderStoryQuote(w.story_quote);

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

    // Hàng ngày giờ + nơi tổ chức ở mục mở đầu — lấy NGÀY LỄ và nơi ĐÃI TIỆC,
    // đúng cặp thông tin khách cần trước nhất.
    renderHeroBanner(w.ceremony_date, ceremonyTime, partyLocation);

    // Khối tóm tắt trong trình phát nhạc (kéo tay nắm xuống mới thấy) — dùng
    // CHÍNH phần lễ đang hiển thị để nhà gái bật Vu Quy thì tóm tắt cũng đổi.
    renderMusicSummary(w, {
      ceremonyName,
      ceremonyTime,
      ceremonyLocation: ceremonyLoc,
    });

    // --- Tiệc cưới (mỗi nhà một ngày/giờ/nơi riêng) ---
    setText("party-section-label", "Tiệc Mừng " + ceremonyName);
    renderPartyDate(
      partyDate,
      w[`${side}_party_time`],
      w[`${side}_party_lunar`],
      partyLocation,
      "full",
    );
    cxToggle("section-party", cxEnabled(w.enable_party));

    // Lịch nhỏ đánh dấu ngày lễ + ngày tiệc
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
    const hasTimeline = cxEnabled(w.enable_timeline);
    if (hasTimeline) {
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
    const hasPhotos = cxEnabled(w.enable_photos);
    if (hasPhotos) {
      renderGallery(w.gallery_images, w.image_focal_points?.gallery_images);
    } else {
      cxToggle("section-photos", false);
    }

    // --- Hộp mừng cưới ---
    const hasGift = cxEnabled(w.enable_gift);
    renderQRCodes(w);
    cxToggle("section-gift", hasGift);

    // --- Bản đồ tới nơi đãi tiệc ---
    // Chưa có URL thì hiện minh hoạ thay cho iframe trắng và khoá luôn nút.
    const mapUrl = w[`${side}_party_map_embed_url`];
    renderMap(mapUrl, partyLocation);
    const hasMap = !!extractMapEmbedUrl(mapUrl);
    cxToggle("map-thumbnail-iframe", hasMap);
    cxToggle("map-placeholder", !hasMap);
    document
      .getElementById("map-link")
      ?.classList.toggle("pointer-events-none", !hasMap);

    // Chip nhảy nhanh chỉ giữ lại mục thật sự có trên thiệp.
    syncQuickNav({
      timeline: hasTimeline,
      photos: hasPhotos,
      map: true,
      gift: hasGift,
    });

    // --- Lời cảm ơn ---
    if (w.footer_text) setText("footer-text", w.footer_text);
    cxToggle("section-footer", cxEnabled(w.enable_footer));
  }

  window.renderWedding = renderWedding;

  // ============= HÀNG NGÀY GIỜ + NƠI TỔ CHỨC (mục mở đầu) =============
  // Định dạng riêng của mẫu ("THỨ BẢY · 20 / 07.2025 · 17.00") nên không dùng
  // renderCeremonyDate — hàm đó đổ vào các id của mục Thư mời.

  function renderHeroBanner(ceremonyDate, ceremonyTime, venue) {
    if (ceremonyDate) {
      const d = new Date(ceremonyDate);
      setText("hero-weekday", WEEKDAYS[d.getDay()]);
      setText("hero-day", String(d.getDate()).padStart(2, "0"));
      setText(
        "hero-month-year",
        `${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`,
      );
    }
    // Giờ ghi kiểu thiệp in: "17.00" thay cho "17:00".
    setText("hero-time", (ceremonyTime || "").replace(":", "."), "--.--");

    // Nơi tổ chức là MỘT chuỗi ("White Palace, 194 Hoàng Văn Thụ, Phú Nhuận").
    // Tách ở dấu phẩy đầu tiên: vế trước là tên, phần còn lại là địa chỉ.
    const parts = (venue || "").split(",");
    const name = parts.shift()?.trim() || "";
    const address = parts.join(",").trim();
    setText("hero-venue-name", name, "------------");
    setText("hero-venue-address", address, "");
  }

  // ============= CHIP NHẢY NHANH (mục mở đầu) =============
  // Mỗi chip là một liên kết #section-… ; mục bị tắt trong Thiết lập thì ẩn chip
  // đi, và không còn chip nào thì ẩn cả hàng cho khỏi hở một khoảng trống.

  function syncQuickNav(state) {
    let any = false;
    Object.keys(state).forEach((key) => {
      cxToggle("quicknav-" + key, state[key]);
      if (state[key]) any = true;
    });
    cxToggle("hero-quicknav", any);
  }

  // ============= ALBUM ẢNH (phần đặc thù của mẫu) =============
  // Lưới hai cột bo góc mềm. Ảnh CỐ Ý không loading="lazy": #main-card để
  // display:none cho tới khi khách mở bìa, ảnh lazy sẽ chưa tải gì cả và trống
  // đúng lúc thiệp mở ra.

  function renderGallery(images, focalPoints) {
    const grid = document.getElementById("gallery-grid");
    if (!grid) return;

    // Chưa có ảnh → 4 ô minh hoạ, để khách hình dung bố cục lúc đang soạn.
    const urls = images?.length
      ? images.map(getImageUrl)
      : Array(4)
          .fill(null)
          .map(() => createPlaceholderSVG("Chưa có ảnh"));

    // Kho ảnh của lightbox dùng chung — phải khớp thứ tự với lưới.
    lightboxImages.length = 0;
    lightboxImages.push(...urls);

    grid.innerHTML = "";
    urls.forEach((url, i) => {
      const fp = focalPoints?.[images?.[i]];
      const cell = document.createElement("div");
      cell.className = "rb-cell aspect-[3/4]";
      cell.innerHTML = `<img src="${url}" alt=""
        class="w-full h-full object-cover"
        style="object-position:${fp?.x ?? 50}% ${fp?.y ?? 50}%">`;
      cell.addEventListener("click", () => openLightbox(i));
      grid.appendChild(cell);
    });
  }
})();
