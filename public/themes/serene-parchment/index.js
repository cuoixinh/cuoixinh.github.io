// ============= THEME: SERENE PARCHMENT =============
// Thiệp đọc như một LÁ THƯ TAY trên giấy ngà: chữ canh trái, tiêu đề mục viết
// tay, mục "Thư mời" nằm trên giấy kẻ dòng thật, con dấu sáp đỏ thay nút mở
// thiệp, ảnh dán bằng băng dính giấy, mép giấy xé ở màn Mở đầu.
//
// File này chỉ KHAI BÁO: window.CX_THEME + renderWedding + phần đặc thù của mẫu
// (cặp tên một dòng, album ảnh in, dấu bưu điện). Phần "chạy" nằm ở
// core/helpers/theme-boot.js, nạp sau.
//
// Bọc trong IIFE, chỉ lộ CX_THEME + renderWedding: `const` cấp cao nhất của
// script cổ điển là biến toàn cục, trùng tên với trang khác là vỡ trang đó.

(function () {
  window.CX_THEME = {
    // Trùng TÊN THƯ MỤC và cột `templates.template_name`.
    id: "serene-parchment",

    // Bộ màu MẶC ĐỊNH của mẫu — bản khai máy đọc được của đúng những giá trị
    // :root trong theme.css (nguồn sự thật). Trang Thiết lập đọc nó để hiện mục
    // "Mặc định"; theme_setting.palette ghi đè lên trên lúc chạy.
    // Sinh lại bằng: node scripts/check-theme-palette.mjs --write
    palette: {
      heading: "#3a352b",
      body: "#736b5d",
      accent: "#64714e",
      accent_soft: "#98a67f",
      on_accent: "#fbf8f1",
      on_image: "#ffffff",
      on_lightbox: "#f7f2e7",
      card_bg: "#faf6ed",
      page_bg: "#eae2d2",
      surface: "#f2ebdc",
      band: "#f1e9d9",
      panel: "#fdfbf5",
      panel_warm: "#f6efe0",
      cover: "#f8f3e8",
      cover_mid: "#ebe2ce",
      cover_veil: "#f8f3e8",
      lightbox_bg: "#211f1a",
      line: "#ddd2ba",
      shadow: "#4a4132",
      scrim: "#2a2419",
      deco: "#64714e",
      deco_soft: "#b9c3a4",
      deco_2: "#a4553f",
      deco_2_soft: "#d9a893",
      shine_from: "#e6dcc4",
      shine_mid: "#fffdf6",
      shine_to: "#e6dcc4",
    },

    // Màu GỢI Ý trong bộ chọn màu (khách bấm vào một phần tử trên thiệp rồi
    // chỉnh riêng) — lấy từ chính bảng màu của mẫu.
    swatches: [
      "#3a352b",
      "#736b5d",
      "#64714e",
      "#98a67f",
      "#a4553f",
      "#ddd2ba",
      "#f1e9d9",
      "#f2ebdc",
      "#faf6ed",
      "#eae2d2",
      "#fdfbf5",
    ],

    // Mục được gán hiệu ứng hiện dần khi cuộn tới.
    reveal: ["#main-card section"],

    // Mốc bung bảng đề xuất mẫu khác ở bản xem thử (?preview=true).
    suggest: "#section-gift",

    // Mẫu vẽ đủ mọi mục nên trang Thiết lập không bỏ bước nào.
    skipSteps: [],

    // id các mục trùng bảng mặc định của preview-focus-helper.js → không cần
    // khai `focus`.

    // Cặp tên co theo bề ngang THẬT, mà lúc renderWedding chạy thì #main-card
    // còn display:none (bề ngang = 0) → đo lại khi thiệp mở ra.
    onOpen: () => _fitAllNames(),
  };

  const _isGroom = isGroomSide();

  // ============= LUÔN HIỆN MÀN BÌA =============
  // Mặc định của wedding-helper.js là mở thẳng thiệp khi KHÔNG phải link riêng
  // của khách (bản xem thử, xem demo, link trần) — nhưng con dấu sáp trên màn
  // bìa là nét nhận dạng của mẫu, phải thấy nó trong mọi trường hợp. Bọc hàm
  // chào riêng lại: vẫn điền tên khách + bật phiếu hồi âm, chỉ bỏ phần TỰ MỞ.
  // Bọc ở đây được vì index.js nạp sau wedding-helper.js, trước theme-boot.js.
  const _greetOriginal = window.setupPersonalizedGreeting;
  window.setupPersonalizedGreeting = function (slug, isGroom) {
    _greetOriginal(slug, isGroom, () => {});
    // Không phải link riêng thì bìa sạch như trang thư, khỏi để lại dãy gạch
    // ngang ở chỗ "Kính gửi".
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

  // "2026-10-18" → "18.10.2026". Chuỗi rỗng khi chưa có ngày để nơi gọi tự
  // quyết định phần giữ chỗ.
  function _fmtDMY(dateStr) {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (isNaN(d)) return "";
    const p = (n) => String(n).padStart(2, "0");
    return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`;
  }

  // ============= CẶP TÊN LUÔN TRÊN MỘT DÒNG =============
  // Tên dài tới đâu cũng không được xuống dòng: đo bề ngang khung .sp-names rồi
  // thu phần chữ bên trong bằng transform. Dùng transform chứ không phải
  // font-size vì scale không bắt trình duyệt bố cục lại — chữ không nhảy dòng
  // giữa chừng, và một lần đo là đủ.

  function _fitNames(row) {
    const inner = row.firstElementChild;
    if (!inner) return;
    inner.style.setProperty("--sp-fit", "1");
    const avail = row.clientWidth;
    if (!avail) return; // khối còn ẩn, chưa đo được
    const need = inner.getBoundingClientRect().width;
    if (need > avail) inner.style.setProperty("--sp-fit", String(avail / need));
  }

  function _fitAllNames() {
    document.querySelectorAll(".sp-names").forEach(_fitNames);
  }

  // Chữ tay tải xong là bề ngang đổi hẳn → đo lại.
  document.fonts?.ready.then(_fitAllNames);
  window.addEventListener("resize", _fitAllNames, { passive: true });

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
    setText("cover-date", _fmtDMY(w.ceremony_date), "--.--.----");

    // --- Mở đầu ---
    renderHero(w, false);
    // Slogan là nét chữ tay to nhất thiệp — để nguyên câu, không thêm ngoặc kép
    // như renderStoryQuote() của helper.
    if (w.story_quote) setText("story-quote", w.story_quote);
    setText("hero-date", _fmtDMY(w.ceremony_date), "--.--.----");

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

    // Tiệc mỗi nhà một ngày/giờ/nơi riêng — lấy ra sớm vì đoạn thư viết tay và
    // dấu bưu điện ở mục Tiệc mừng đều dùng tới.
    const partyDate = w[`${side}_party_date`];
    const partyLocation = w[`${side}_party_location`];

    // Hai chỗ trống trong đoạn thư viết cứng: ngày và nơi khách sẽ tới.
    setText("letter-date", _fmtDMY(partyDate || w.ceremony_date), "--.--.----");
    setText(
      "letter-venue",
      partyLocation || ceremonyLoc,
      "------------------------",
    );

    // Khối tóm tắt trong trình phát nhạc (kéo tay nắm xuống mới thấy) — dùng
    // CHÍNH phần lễ đang hiển thị để nhà gái bật Vu Quy thì tóm tắt cũng đổi.
    renderMusicSummary(w, {
      ceremonyName,
      ceremonyTime,
      ceremonyLocation: ceremonyLoc,
    });

    // --- Tiệc cưới ---
    setText("party-section-label", "Tiệc Mừng " + ceremonyName);
    renderPartyDate(
      partyDate,
      w[`${side}_party_time`],
      w[`${side}_party_lunar`],
      partyLocation,
      "full",
    );
    _renderPostmark("stamp", partyDate);
    cxToggle("section-party", cxEnabled(w.enable_party));

    // Lịch nhỏ đánh dấu ngày lễ + ngày tiệc
    setupMiniCalendar(w.ceremony_date, partyDate);

    // --- Xác nhận tham dự (mục riêng, không nằm trong thẻ tiệc) ---
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

    // --- Lời cảm ơn + chữ ký cuối thư ---
    if (w.footer_text) setText("footer-text", w.footer_text);
    setText("sign-groom", w.groom_name, "----------");
    setText("sign-bride", w.bride_name, "----------");
    cxToggle("section-footer", cxEnabled(w.enable_footer));

    // Đo lần đầu; thiệp không có màn bìa (bản xem thử) thì đây là lần đo thật,
    // còn lại onOpen sẽ đo lại lúc #main-card hiện ra.
    _fitAllNames();
  }

  window.renderWedding = renderWedding;

  // ============= DẤU BƯU ĐIỆN (phần đặc thù của mẫu) =============
  // Vòng mực đỏ đóng lệch, in ngày tháng. Dùng ở hai chỗ với hai mốc khác nhau
  // (bìa: ngày cưới · thẻ tiệc: ngày đãi tiệc của nhà đang xem) nên nhận tiền
  // tố id thay vì viết cứng.

  function _renderPostmark(prefix, dateStr) {
    const d = dateStr ? new Date(dateStr) : null;
    if (!d || isNaN(d)) return;
    setText(`${prefix}-weekday`, WEEKDAYS[d.getDay()]);
    setText(`${prefix}-day`, d.getDate());
    setText(
      `${prefix}-month-year`,
      `${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`,
    );
  }

  // ============= ALBUM ẢNH (phần đặc thù của mẫu) =============
  // Ảnh in có khung giấy, dán băng dính, nghiêng so le hai bên — như xấp ảnh
  // rời kẹp trong thư. Ảnh KHÔNG lazy: #main-card là display:none cho tới khi
  // bấm mở thiệp nên ảnh lazy sẽ chưa tải gì cả.

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
      const odd = i % 2 === 1;
      const cell = document.createElement("div");
      cell.className = odd
        ? "sp-photo sp-polaroid sp-tilt-r cursor-pointer"
        : "sp-photo sp-polaroid sp-tilt-l cursor-pointer";
      cell.innerHTML = `
        <span class="${odd ? "sp-tape sp-tape-tr" : "sp-tape sp-tape-tl"}"></span>
        <img src="${url}" alt=""
          class="w-full aspect-[3/4] object-cover"
          style="object-position:${fp?.x ?? 50}% ${fp?.y ?? 50}%">
        <span class="sp-note cx-t absolute bottom-2 left-0 right-0 text-center text-[15px]">
          ${String(i + 1).padStart(2, "0")}
        </span>`;
      cell.addEventListener("click", () => openLightbox(i));
      grid.appendChild(cell);
    });
  }
})();
