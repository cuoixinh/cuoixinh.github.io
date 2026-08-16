// ============= MẪU NỀN (base) =============
// Bản đối chiếu đủ mọi mục. Chép cả thư mục để dựng mẫu mới — xem hướng dẫn ở
// đầu index.html.
//
// File này chỉ KHAI BÁO: window.CX_THEME + renderWedding + phần đặc thù của mẫu
// (ở đây là lưới ảnh). Phần "chạy" nằm ở core/helpers/theme-boot.js, nạp sau.
//
// Bọc trong IIFE, chỉ lộ CX_THEME + renderWedding: `const` cấp cao nhất của
// script cổ điển là biến toàn cục, trùng tên với trang khác là vỡ trang đó.

(function () {
  window.CX_THEME = {
    // Trùng TÊN THƯ MỤC và cột `templates.template_name`.
    id: "base-theme",

    // Font/màu GỐC: giá trị mặc định trên thanh chỉnh ở tab Giao diện, cũng là
    // điểm "Khôi phục mặc định". Trang Thiết lập đọc qua iframe xem trước.
    preset: {
      heading_font: "Cormorant Garamond",
      body_font: "Inter",
      heading_color: "#3f3a38",
      body_color: "#7a736e",
      accent_color: "#b08d57",
      background_color: "#fdfcfa",
      // Màu gợi ý trong bảng chọn — lấy từ chính bảng màu của mẫu.
      swatches: [
        "#3f3a38",
        "#5c5450",
        "#7a736e",
        "#2d2d2d",
        "#b08d57",
        "#c9b896",
        "#e6dcc8",
        "#f2ece1",
        "#fdfcfa",
        "#f7f4ef",
        "#ffffff",
      ],
    },

    // Class mà thanh chỉnh font/màu nhắm tới. Mẫu này gom về ba lớp ngữ nghĩa
    // (.cx-h tiêu đề · .cx-t nội dung · .cx-a nhấn, khai trong theme.css) nên
    // đổi cả thiệp chỉ bằng ba dòng.
    // .cx-hd/.cx-bd/.cx-ac là markup do helper dùng chung sinh ra (dòng thời
    // gian, chuyện tình yêu) — GIỮ NGUYÊN khi chép sang mẫu mới.
    selectors: {
      headingFont: ".cx-h, .font-cormorant",
      bodyFont: "body, .cx-t, .font-inter",
      headingColor: ".cx-h, .cx-hd",
      bodyColor: ".cx-t, .cx-bd",
      accentColor: ".cx-a, .cx-ac",
      background: "body, #main-card",
    },

    // Mục được gán hiệu ứng hiện dần khi cuộn tới.
    reveal: ["#main-card section"],

    // id các mục trùng bảng mặc định của preview-focus-helper.js nên không cần
    // khai `focus`. Đặt id khác thì khai ở đây, ví dụ:
    //   focus: { photos: ["#my-gallery"] },

    // Bỏ qua khi scan ảnh ở admin (scripts/capture.js). Hai mức, khai cái nào
    // cũng được, không cần cả hai:
    //   noScan       — bỏ hết, cho mẫu không bán/đang làm dở (mẫu nền dùng cái này)
    //   noScanStatic — chỉ bỏ ảnh tĩnh vuông (cover/hero), vẫn có ảnh dài toàn
    //                  trang; dùng khi mẫu chưa dựng bìa/hero cho khung vuông
    noScan: true,

    // Chạy ngay sau khi thiệp hiện ra (đo được bề ngang thật) — mẫu nào phải
    // dựng lại carousel/đo đạc thì móc vào đây.
    onOpen: null,
  };

  const _isGroom = isGroomSide();

  // ============= ĐỔ DỮ LIỆU LÊN THIỆP =============
  // Gọi theo đúng thứ tự các mục trong index.html. Bỏ một mục ở HTML thì xoá
  // luôn dòng gọi tương ứng ở đây (helper vẫn an toàn nếu quên, chỉ là code thừa).

  function renderWedding(w) {
    if (!w || !w.is_active) return;

    const side = _isGroom ? "groom" : "bride";

    // --- Nhạc nền ---
    setupMusic(w.music_url, w.enable_music);

    // --- Màn bìa ---
    renderCover(w);

    // --- Mở đầu ---
    renderHero(w, false);
    renderStoryQuote(w.story_quote);

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

    // Khối tóm tắt trong trình phát nhạc (kéo tay nắm xuống mới thấy) — dùng
    // CHÍNH phần lễ đang hiển thị để nhà gái bật Vu Quy thì tóm tắt cũng đổi.
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
    // Chưa có URL thì hiện minh hoạ thay cho iframe trắng và khoá luôn nút.
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

  // ============= ALBUM ẢNH (phần đặc thù của mẫu) =============
  // Lưới ảnh đơn giản + phóng to. Đây là chỗ dễ tạo chất riêng nhất cho mẫu mới
  // (carousel, xếp chồng, cuộn ngang…): đổi hàm này là đủ, miễn vẫn đổ ảnh vào
  // lightboxImages và gọi openLightbox(i).

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
      cell.className =
        "aspect-[3/4] rounded-xl overflow-hidden cursor-pointer shadow-sm";
      cell.innerHTML = `<img src="${url}" alt="" loading="lazy"
        class="w-full h-full object-cover"
        style="object-position:${fp?.x ?? 50}% ${fp?.y ?? 50}%">`;
      cell.addEventListener("click", () => openLightbox(i));
      grid.appendChild(cell);
    });
  }
})();
