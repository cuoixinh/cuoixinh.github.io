// ============= THEME: NOIR ELEGANCE =============
// Nền ĐEN, viền vàng champagne mảnh, chữ thư pháp. Đủ mọi mục như mẫu nền; nét
// riêng nằm ở mục Mở đầu: một khung ảnh kiểu poster phim — thanh nhãn ba mục,
// ảnh chạy carousel với mũi tên tròn đè hai mép, nền là chính tấm ảnh đó nhoè đi.
//
// File này chỉ KHAI BÁO: window.CX_THEME + renderWedding + phần đặc thù của mẫu
// (carousel mở đầu + album). Phần "chạy" nằm ở core/helpers/theme-boot.js, nạp sau.
//
// Bọc trong IIFE, chỉ lộ CX_THEME + renderWedding + hai hàm mà onclick trong
// HTML gọi tới: `const` cấp cao nhất của script cổ điển là biến toàn cục.

(function () {
  window.CX_THEME = {
    // Trùng TÊN THƯ MỤC và cột `templates.template_name`.
    id: "noir-elegance",

    // Font/màu GỐC: giá trị mặc định trên thanh chỉnh ở tab Giao diện, cũng là
    // điểm "Khôi phục mặc định". Trang Thiết lập đọc qua iframe xem trước.
    preset: {
      heading_font: "Cormorant Garamond",
      body_font: "Montserrat",
      heading_color: "#f2ece2", // kem sáng trên nền đen
      body_color: "#a59d92",
      accent_color: "#c9a96e", // vàng champagne
      background_color: "#0c0c0e",
      // Màu gợi ý — các nấc đen/xám và vàng champagne của chính mẫu.
      swatches: [
        "#08080a",
        "#0c0c0e",
        "#18171a",
        "#2a2830",
        "#685637",
        "#a8894f",
        "#c9a96e",
        "#dcc9a0",
        "#a59d92",
        "#f2ece2",
        "#ffffff",
      ],
    },

    // Class mà thanh chỉnh font/màu nhắm tới. Mẫu gom về ba lớp ngữ nghĩa
    // (.cx-h tiêu đề · .cx-t nội dung · .cx-a nhấn, khai trong theme.css).
    // .cx-hd/.cx-bd/.cx-ac là markup do helper dùng chung sinh ra (dòng thời
    // gian, chuyện tình yêu) — GIỮ NGUYÊN.
    // .ne-title/.ne-eyebrow đi theo tiêu đề (đổi màu/font vẫn hợp tông), còn
    // .ne-script cố ý ĐỨNG NGOÀI: đó là font tự host, bảng chọn font chỉ có
    // font Google nên khách đổi rồi sẽ không quay lại được.
    selectors: {
      headingFont: ".cx-h, .ne-title",
      bodyFont: "body, .cx-t, .ne-eyebrow",
      headingColor: ".cx-h, .cx-hd, .ne-title, .ne-script",
      bodyColor: ".cx-t, .cx-bd, .ne-eyebrow",
      accentColor: ".cx-a, .cx-ac",
      background: "body, #main-card",
    },

    // Mục được gán hiệu ứng hiện dần khi cuộn tới.
    reveal: ["#main-card section"],

    // Mốc bung bảng đề xuất mẫu khác ở bản xem thử (?preview=true).
    suggest: "#section-gift",

    // id các mục trùng bảng mặc định của preview-focus-helper.js → không cần
    // khai `focus`.

    // Carousel chạy bằng % nên không phải đo gì sau khi thiệp mở ra.
    onOpen: null,
  };

  const _isGroom = isGroomSide();

  // ============= ĐỔ DỮ LIỆU LÊN THIỆP =============
  // Gọi theo đúng thứ tự các mục trong index.html.

  function renderWedding(w) {
    if (!w || !w.is_active) return;

    const side = _isGroom ? "groom" : "bride";

    // --- Màn bìa ---
    // Khối dựng ảnh chạy TRƯỚC setupMusic: đây là chỗ ảnh của màn ĐẦU TIÊN nhận
    // src, mà setupMusic kéo YouTube iframe API (script bên thứ ba) về ngay khi
    // chạy — để nó đi trước là ảnh phải xếp hàng sau.
    renderCover(w);

    // --- Mở đầu ---
    renderHero(w, false); // đổ ảnh bìa vào ô ĐẦU TIÊN của carousel
    setupHeroCarousel(w); // các ô còn lại lấy từ album
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

    // Nhãn góc trái khung mở đầu = tên tỉnh/thành nơi đãi tiệc (đoạn cuối địa
    // chỉ), như dòng địa danh trên poster. Chưa có địa chỉ thì giữ chữ mặc định.
    const place = _placeLabel(partyLocation);
    if (place) setText("hero-place", place);

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
    const hasStory = cxEnabled(w.enable_love_story);
    if (hasStory) {
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

    // Hai lối tắt trên thanh nhãn chỉ có nghĩa khi mục đích đến còn bật.
    cxToggle("hero-link-story", hasStory);
    cxToggle("hero-link-album", hasPhotos);

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

  // Đoạn cuối của địa chỉ (sau dấu phẩy chót) — "123 Lê Lợi, TP. Thái Nguyên"
  // → "TP. Thái Nguyên". Địa chỉ một đoạn thì lấy nguyên, quá dài thì bỏ qua
  // để nhãn không tràn khỏi một phần ba hàng.
  function _placeLabel(location) {
    const part = String(location || "")
      .split(",")
      .pop()
      .trim();
    return part && part.length <= 22 ? part : "";
  }

  // ============= CAROUSEL MỞ ĐẦU (phần đặc thù của mẫu) =============
  // Ô đầu tiên là ảnh bìa (#main-photo, đã có sẵn trong HTML), các ô sau lấy từ
  // album. Trượt bằng % bề ngang nên không cần đo đạc — khỏi móc vào onOpen.
  // Nền nhoè phía sau dùng lại ĐÚNG ảnh đang xem: đọc src của ô hiện tại.

  let _slideIdx = 0;
  let _slideCount = 1;

  function setupHeroCarousel(w) {
    const track = document.getElementById("hero-track");
    if (!track) return;

    // Dựng lại từ đầu: renderWedding có thể chạy nhiều lần trong khung xem trực tiếp.
    track.querySelectorAll("[data-ne-slide]").forEach((el) => el.remove());

    const extras = (w.gallery_images || [])
      .filter((k) => k && k !== w.cover_image_url)
      .slice(0, 5);

    extras.forEach((key) => {
      const fp = w.image_focal_points?.gallery_images?.[key];
      const cell = document.createElement("div");
      cell.dataset.neSlide = "1";
      cell.className = "w-full shrink-0 aspect-[3/4]";
      // KHÔNG lazy: cả khối nằm trong #main-card đang display:none, ảnh lazy sẽ
      // chỉ bắt đầu tải khi khách bấm mở bìa — đúng lúc cần thấy ảnh nhất.
      cell.innerHTML = `<img src="${getImageUrl(key)}" alt=""
        class="w-full h-full object-cover"
        style="object-position:${fp?.x ?? 50}% ${fp?.y ?? 50}%">`;
      track.appendChild(cell);
    });

    _slideCount = 1 + extras.length;
    _slideIdx = 0;

    // Một ảnh thì giấu mũi tên và hàng chấm, khung ảnh đứng yên như tấm poster.
    const many = _slideCount > 1;
    cxToggle("hero-prev", many);
    cxToggle("hero-next", many);

    const dots = document.getElementById("hero-dots");
    if (dots) {
      dots.innerHTML = many
        ? Array.from({ length: _slideCount }, () => `<span class="ne-dot"></span>`).join("")
        : "";
    }

    _goSlide(0);
  }

  function _goSlide(i) {
    const track = document.getElementById("hero-track");
    if (!track) return;

    _slideIdx = ((i % _slideCount) + _slideCount) % _slideCount; // cuộn vòng
    track.style.transform = `translateX(-${_slideIdx * 100}%)`;
    track.style.transition = "transform .5s ease";

    // Nền nhoè bám theo ảnh đang xem.
    const img = track.children[_slideIdx]?.querySelector("img");
    const blur = document.getElementById("hero-blur");
    if (img && blur) blur.src = img.src;

    document
      .querySelectorAll("#hero-dots .ne-dot")
      .forEach((d, k) => d.classList.toggle("is-on", k === _slideIdx));
  }

  // onclick trong HTML gọi thẳng → phải nằm ở window.
  window.neSlide = (step) => _goSlide(_slideIdx + step);

  window.neJump = (id) => {
    document
      .getElementById(id)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Vuốt ngang để đổi ảnh (chỉ tính khi vuốt ngang rõ hơn dọc, để không cướp
  // thao tác cuộn trang).
  (function _bindSwipe() {
    const view = document.getElementById("hero-viewport");
    if (!view) return;
    let x0 = 0;
    let y0 = 0;
    view.addEventListener(
      "touchstart",
      (e) => {
        x0 = e.touches[0].clientX;
        y0 = e.touches[0].clientY;
      },
      { passive: true },
    );
    view.addEventListener(
      "touchend",
      (e) => {
        const dx = e.changedTouches[0].clientX - x0;
        const dy = e.changedTouches[0].clientY - y0;
        if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy))
          _goSlide(_slideIdx + (dx < 0 ? 1 : -1));
      },
      { passive: true },
    );
  })();

  // ============= ALBUM ẢNH =============
  // Hai cột kiểu masonry (.ne-masonry dùng CSS column) — ô cao thấp xen kẽ mà
  // không để lại khoảng trống như lưới grid. Ảnh xếp theo CỘT: ô 1,2,3 nằm cột
  // trái rồi mới sang cột phải, thứ tự trong lightbox vẫn giữ nguyên chỉ số ô.
  // Class viết nguyên chuỗi (không ghép từ biến) để Tailwind không purge mất.

  function renderGallery(images, focalPoints) {
    const grid = document.getElementById("gallery-grid");
    if (!grid) return;

    // Ảnh nằm trong #main-card (đang display:none lúc chưa mở bìa) nên KHÔNG
    // đặt loading="lazy": ảnh lazy sẽ chỉ bắt đầu tải khi bìa mở ra.
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
        "ne-cell " + (i % 3 === 1 ? "aspect-square" : "aspect-[3/4]");
      cell.innerHTML = `<img src="${url}" alt=""
        class="w-full h-full object-cover"
        style="object-position:${fp?.x ?? 50}% ${fp?.y ?? 50}%">`;
      cell.addEventListener("click", () => openLightbox(i));
      grid.appendChild(cell);
    });
  }
})();
