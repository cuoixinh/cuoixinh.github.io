// ============= THEME: OPULENT CONTRAST =============
// Thiệp nền ĐEN, chữ ngà, đường vàng đồng mảnh. Nét riêng: khung vàng kép có
// hai vệt chéo cắt góc chạy quanh cả thiệp, ảnh tràn viền chui dưới khung, và
// chữ hoa Didone khổ lớn cắt ngang mép ảnh.
//
// File này chỉ KHAI BÁO: window.CX_THEME + renderWedding + phần đặc thù của mẫu
// (dải ảnh cuộn ngang). Phần "chạy" nằm ở core/helpers/theme-boot.js, nạp sau.
//
// Bọc trong IIFE, chỉ lộ CX_THEME + renderWedding: `const` cấp cao nhất của
// script cổ điển là biến toàn cục, trùng tên với trang khác là vỡ trang đó.

(function () {
  window.CX_THEME = {
    // Trùng TÊN THƯ MỤC và cột `templates.template_name`.
    id: "opulent-contrast",

    // Bộ màu MẶC ĐỊNH của mẫu — bản khai máy đọc được của đúng những giá trị
    // :root trong theme.css (nguồn sự thật). Trang Thiết lập đọc nó để hiện mục
    // "Mặc định"; theme_setting.palette ghi đè lên trên lúc chạy.
    // Sinh lại bằng: node scripts/check-theme-palette.mjs --write
    palette: {
      heading: "#f5f1e8",
      body: "#a8a092",
      accent: "#c6a15b",
      accent_soft: "#8a7443",
      on_accent: "#0f0d0b",
      on_image: "#ffffff",
      on_lightbox: "#f5f1e8",
      card_bg: "#0e0d0c",
      page_bg: "#050505",
      surface: "#171512",
      band: "#1c1915",
      panel: "#1a1714",
      panel_warm: "#221d17",
      cover: "#080807",
      cover_mid: "#1a1712",
      cover_veil: "#080807",
      lightbox_bg: "#000000",
      line: "#5c4c2e",
      shadow: "#000000",
      scrim: "#000000",
      deco: "#c6a15b",
      deco_soft: "#6b552e",
      deco_2: "#e0c98a",
      deco_2_soft: "#7d6534",
      shine_from: "#8a6a2f",
      shine_mid: "#f0dba6",
      shine_to: "#b98f42",
    },

    // Màu GỢI Ý trong bộ chọn màu (khách bấm vào một phần tử trên thiệp rồi
    // chỉnh riêng) — lấy từ chính bảng màu của mẫu.
    swatches: [
      "#f5f1e8",
      "#a8a092",
      "#e0c98a",
      "#c6a15b",
      "#8a7443",
      "#5c4c2e",
      "#221d17",
      "#1c1915",
      "#171512",
      "#0e0d0c",
      "#050505",
    ],

    // Mục được gán hiệu ứng hiện dần khi cuộn tới.
    reveal: ["#main-card section"],

    // Mốc bung bảng đề xuất mẫu khác ở bản xem thử (?preview=true).
    suggest: "#section-gift",

    // Mẫu vẽ đủ mọi mục nên trang Thiết lập không bỏ bước nào.
    skipSteps: [],

    // id các mục trùng bảng mặc định của preview-focus-helper.js → không cần
    // khai `focus`.

    // Số đếm của dải ảnh đo theo bề ngang thật, mà lúc renderGallery chạy thì
    // #main-card còn display:none (bề ngang = 0) → đo lại khi thiệp mở ra.
    onOpen: () => _syncGalleryCounter(),
  };

  const _isGroom = isGroomSide();

  // ============= LUÔN HIỆN MÀN BÌA =============
  // Mặc định của wedding-helper.js là mở thẳng thiệp khi KHÔNG phải link riêng
  // của khách (bản xem thử, xem demo, link trần) — nhưng màn bìa của mẫu này
  // chính là tấm poster, phải thấy nó trong mọi trường hợp. Bọc hàm chào riêng
  // lại: vẫn điền tên khách + bật ô xác nhận tham dự, chỉ bỏ phần TỰ MỞ. Bọc ở
  // đây được vì index.js nạp sau wedding-helper.js và trước theme-boot.js.
  const _greetOriginal = window.setupPersonalizedGreeting;
  window.setupPersonalizedGreeting = function (slug, isGroom) {
    _greetOriginal(slug, isGroom, () => {});
    // Không phải link riêng thì màn bìa sạch như tấm poster, khỏi để lại dãy
    // gạch ngang chỗ tên khách.
    const wrap = document.getElementById("cover-guest-wrap");
    if (wrap && window.CX_GUEST) {
      wrap.classList.remove("hidden");
      wrap.classList.add("flex");
    }
  };

  // Khung "xem trực tiếp" ở trang Thiết lập xin cuộn tới mục đang chỉnh — mục
  // đó nằm sau màn bìa, nên nhận tin là mở thiệp ra rồi mới để helper cuộn.
  window.addEventListener("message", (e) => {
    if (e.data?.type !== "cx-focus") return;
    const cover = document.getElementById("cover-screen");
    if (cover && cover.style.display !== "none") window.openInvitation();
  });

  // ============= TIỆN ÍCH RIÊNG =============

  // Chữ cái đầu của TÊN RIÊNG (từ cuối) — dùng dựng monogram "V & Y".
  function _initial(name) {
    const parts = String(name || "").trim().split(/\s+/);
    const last = parts[parts.length - 1] || "";
    return last.charAt(0).toUpperCase();
  }

  // "2026-10-18" → "18.10.2026". Chuỗi rỗng nếu không phân giải được ngày.
  function _fmtDMY(dateStr) {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
  }

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
    renderHero(w, false);
    renderStoryQuote(w.story_quote);

    // --- Nhạc nền ---
    setupMusic(w.music_url, w.enable_music);

    // Monogram + ngày cưới: hai chi tiết riêng của mẫu, lặp lại ở bìa và chân
    // thiệp để đóng khung cả tấm thiệp.
    const mono = `${_initial(w.groom_name)} & ${_initial(w.bride_name)}`;
    setText("cover-monogram", mono.length > 3 ? mono : "", "-- & --");
    setText("footer-monogram", mono.length > 3 ? mono : "", "-- & --");
    const dmy = _fmtDMY(w.ceremony_date);
    setText("cover-date", dmy, "--.--.----");
    setText("hero-date", dmy, "--.--.----");
    setText("footer-date", dmy, "--.--.----");

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

    // Nơi đãi tiệc là thứ khách cần nhất trên tấm poster; chưa có thì lùi về
    // nơi làm lễ.
    setText(
      "cover-venue",
      partyLocation || ceremonyLoc,
      "------------------------",
    );

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
  // Dải ảnh CUỘN NGANG có điểm dừng, mỗi tấm mang số thứ tự; số đếm bên dưới
  // chạy theo tấm đang nằm giữa khung. Bấm một tấm là mở lightbox dùng chung.

  let _stripBound = false;

  function renderGallery(images, focalPoints) {
    const strip = document.getElementById("gallery-strip");
    if (!strip) return;

    // Chưa có ảnh → 4 ô minh hoạ, để khách hình dung bố cục lúc đang soạn.
    const urls = images?.length
      ? images.map(getImageUrl)
      : Array(4)
          .fill(null)
          .map(() => createPlaceholderSVG("Chưa có ảnh"));

    // Kho ảnh của lightbox dùng chung — phải khớp thứ tự với dải.
    lightboxImages.length = 0;
    lightboxImages.push(...urls);

    strip.innerHTML = "";
    urls.forEach((url, i) => {
      const fp = focalPoints?.[images?.[i]];
      const cell = document.createElement("div");
      cell.className = "oc-shot";
      // Ảnh KHÔNG loading="lazy": cả #main-card còn display:none cho tới khi mở
      // bìa, ảnh lazy sẽ chỉ bắt đầu tải sau đó.
      cell.innerHTML =
        `<img src="${url}" alt=""
           style="object-position:${fp?.x ?? 50}% ${fp?.y ?? 50}%">` +
        `<span class="oc-shot-no">${String(i + 1).padStart(2, "0")}</span>`;
      cell.addEventListener("click", () => openLightbox(i));
      strip.appendChild(cell);
    });

    if (!_stripBound) {
      strip.addEventListener("scroll", _syncGalleryCounter, { passive: true });
      _stripBound = true;
    }
    _syncGalleryCounter();
  }

  // Tấm nào có TÂM gần tâm khung cuộn nhất thì tấm đó đang được xem. Đo bằng
  // offsetLeft nên .oc-strip phải là `position: relative` (xem theme.css).
  function _syncGalleryCounter() {
    const strip = document.getElementById("gallery-strip");
    const out = document.getElementById("gallery-counter");
    if (!strip || !out || !strip.children.length) return;

    const mid = strip.scrollLeft + strip.clientWidth / 2;
    let cur = 0;
    let best = Infinity;
    Array.from(strip.children).forEach((el, i) => {
      const d = Math.abs(el.offsetLeft + el.offsetWidth / 2 - mid);
      if (d < best) {
        best = d;
        cur = i;
      }
    });

    const pad = (n) => String(n).padStart(2, "0");
    out.textContent = `${pad(cur + 1)} / ${pad(strip.children.length)}`;
  }
})();
