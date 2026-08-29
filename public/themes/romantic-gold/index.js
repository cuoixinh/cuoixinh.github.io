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

    // Bộ màu MẶC ĐỊNH của mẫu — bản khai máy đọc được của đúng những giá trị
    // :root trong theme.css (nguồn sự thật). Trang Thiết lập đọc nó để hiện mục
    // "Mặc định"; theme_setting.palette ghi đè lên trên lúc chạy.
    // Sinh lại bằng: node scripts/check-theme-palette.mjs --write
    palette: {
      heading: "#2d3436",
      body: "#8a9a8a",
      accent: "#a89968",
      accent_soft: "#e8dcc8",
      on_accent: "#ffffff",
      on_image: "#ffffff",
      on_lightbox: "#ffffff",
      card_bg: "#ffffff",
      page_bg: "#f6f7f6",
      surface: "#f6f7f6",
      band: "#f6f7f6",
      panel: "#ffffff",
      panel_warm: "#ffffff",
      cover: "#f6f7f6",
      cover_mid: "#e8ebe8",
      cover_veil: "#e8ebe8",
      lightbox_bg: "#000000",
      line: "#d1d8d1",
      shadow: "#000000",
      scrim: "#000000",
      deco: "#000000",
      deco_soft: "#f5d5d8",
      deco_2: "#000000",
      deco_2_soft: "#f5d5d8",
      shine_from: "#d4a5a5",
      shine_mid: "#e8b4b8",
      shine_to: "#f5d5d8",
    },

    // Màu GỢI Ý trong bộ chọn màu (khách bấm vào một phần tử trên thiệp rồi
    // chỉnh riêng) — lấy từ chính bảng màu của mẫu.
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

    // Poster mở đầu KHÔNG hiện dần: nó choán cả màn ngay khi vào, cho trượt vào
    // thì khách thấy một khoảng trống trước đã.
    reveal: ["#main-card section:not(#section-hero)"],

    // Mốc bung bảng đề xuất mẫu khác ở bản xem thử (?preview=true): cuộn tới
    // mục này là bảng trượt lên. Mặc định của core/utils.js cũng là hộp mừng
    // cưới, khai ra đây để mỗi mẫu tự chọn được chỗ hợp với bố cục của mình.
    suggest: "#section-gift",

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

    // --- Mở đầu: poster tràn viền (mẫu này không có màn bìa) ---
    // ĐỨNG ĐẦU hàm, trước setupMusic: đây là chỗ #main-photo nhận src, mà ảnh đó
    // choán cả màn đầu tiên. setupMusic kéo YouTube iframe API (script bên thứ
    // ba) về ngay khi chạy — để nó đi trước là tấm poster xếp hàng sau.
    renderHero(w, false);
    renderStoryQuote(w.story_quote);
    setText("hero-date", _posterDate(w.ceremony_date), "----.--.--");
    setText("monogram-groom", _initial(w.groom_name), "M");
    setText("monogram-bride", _initial(w.bride_name), "H");

    // --- Nhạc nền ---
    setupMusic(w.music_url, w.enable_music);

    // --- Đếm ngược ---
    startCountdown(w.ceremony_date, w.ceremony_time);

    // Mẫu này KHÔNG có mục Gia đình (không có tên bố mẹ, địa chỉ hai nhà) nên
    // công tắc enable_family bên Thiết lập không tác dụng gì ở đây. Vẫn gọi
    // renderCoupleInfo vì hai ẢNH chú rể / cô dâu được dùng ở mục Thư mời; các
    // setText còn lại trong hàm đó không tìm thấy id nên tự bỏ qua.
    renderCoupleInfo(w);

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
    // Dùng bản vẽ RIÊNG của mẫu (bảng giờ), không gọi renderTimeline() dùng
    // chung — mẫu đó vẽ dòng dọc có chấm, đã dùng cho chuyện tình yêu ngay bên
    // dưới rồi, hai mục liền nhau mà cùng một kiểu thì nhìn lặp.
    if (cxEnabled(w.enable_timeline)) {
      _renderSchedule(w.timeline, side, partyDate, w.ceremony_date, ceremonyName);
      cxToggle("section-timeline", true);
    }

    // --- Chuyện tình yêu ---
    if (cxEnabled(w.enable_love_story)) {
      renderLoveStory(w.love_story);
    } else {
      cxToggle("love-story", false);
    }

    // --- Ảnh minh hoạ cho mục Tiệc / Lịch trình ---
    // Mượn từ CUỐI danh sách album và cắt hẳn ra khỏi phần album vẽ, để không
    // có tấm nào xuất hiện hai lần. Chỉ mượn khi album còn dư: ba khối bố cục
    // đầu đã ăn 6 ảnh, giữ thêm 2 ảnh cho cụm so le mới đủ đẹp.
    const album = Array.isArray(w.gallery_images)
      ? w.gallery_images.slice()
      : [];
    const focals = w.image_focal_points?.gallery_images;
    const partyPhoto = album.length > 8 ? album.pop() : null;
    const timelinePhoto = album.length > 8 ? album.pop() : null;

    _sectionPhoto("party-photo", partyPhoto, focals, "rg-wide-photo");
    _sectionPhoto("timeline-photo", timelinePhoto, focals, "rg-strip-photo");

    // --- Album ảnh ---
    if (cxEnabled(w.enable_photos)) {
      renderGallery(album, focals);
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

  // ============= LỊCH TRÌNH KIỂU BẢNG GIỜ =============
  // Giờ nằm cột trái bằng chữ số Didone, việc nằm cột phải, ngăn nhau bằng nét
  // mảnh — khác hẳn dòng dọc có chấm mà helper dùng chung vẽ.
  // Lọc mốc theo nhà trai/nhà gái giống hệt renderTimeline(): "ceremony" hiện
  // cho cả hai, "party" chỉ nhà trai, "bride-party" chỉ nhà gái.

  // Dữ liệu lịch trình chỉ có GIỜ + TÊN VIỆC, không có icon → suy ra từ từ khoá
  // trong tên. Xét theo thứ tự, khớp trước thắng: "Lễ đón dâu" phải ra nhẫn chứ
  // không ra người. Không khớp gì thì về đồng hồ.
  const RG_TL_ICONS = [
    [/vu quy|thành hôn|đón dâu|lễ |nhẫn/i, "fa-ring"],
    [/bánh/i, "fa-cake-candles"],
    [/tiệc|dùng bữa|nâng ly|khai/i, "fa-champagne-glasses"],
    [/chụp|ảnh|lưu niệm/i, "fa-camera"],
    [/trang điểm|chuẩn bị|trang trí/i, "fa-wand-magic-sparkles"],
    [/văn nghệ|giao lưu|nhạc|hát/i, "fa-music"],
    [/quà|check-?in|mừng/i, "fa-gift"],
    [/cảm ơn|tiễn/i, "fa-heart"],
    [/đón|khách/i, "fa-user-group"],
  ];

  function _tlIcon(title) {
    const t = String(title || "");
    for (const [re, cls] of RG_TL_ICONS) if (re.test(t)) return cls;
    return "fa-clock";
  }

  function _renderSchedule(items, side, partyDate, ceremonyDate, ceremonyName) {
    const list = document.getElementById("timeline-list-render");
    if (!list) return;
    list.innerHTML = "";
    if (!Array.isArray(items) || items.length === 0) return;

    const mine = items.filter((it) => {
      const t = it.type || "ceremony";
      if (t === "ceremony") return true;
      return side === "groom" ? t === "party" : t === "bride-party";
    });
    if (!mine.length) return;

    const byTime = (arr) =>
      [...arr].sort((a, b) =>
        !a.time ? 1 : !b.time ? -1 : a.time.localeCompare(b.time),
      );
    const party = byTime(mine.filter((i) => (i.type || "ceremony") !== "ceremony"));
    const ceremony = byTime(mine.filter((i) => (i.type || "ceremony") === "ceremony"));

    const fmtDate = (s) => {
      if (!s) return "";
      try {
        return new Date(s + "T00:00:00").toLocaleDateString("vi-VN", {
          weekday: "short",
          day: "numeric",
          month: "numeric",
          year: "numeric",
        });
      } catch (e) {
        return s;
      }
    };

    const group = (label, dateStr, rows) => {
      if (!rows.length) return "";
      const date = fmtDate(dateStr);
      return (
        '<div class="rg-sched-group">' +
        '<div class="rg-sched-head">' +
        '<span class="cx-a text-[11px] tracking-[3px] uppercase">' +
        escapeHtml(label) +
        "</span>" +
        (date
          ? '<span class="cx-t text-[10px]">' + escapeHtml(date) + "</span>"
          : "") +
        "</div>" +
        // Đường thời gian DỌC: đường kẻ chạy suốt, mỗi mốc là một huy hiệu tròn
        // đè lên đường, chữ nằm bên phải. Không giới hạn số mốc, tên việc dài
        // vẫn xuống dòng thoải mái.
        '<div class="rg-tl">' +
        rows
          .map(
            (it) =>
              '<div class="rg-tl-item">' +
              '<span class="rg-tl-badge"><i class="fas ' +
              _tlIcon(it.title) +
              '"></i></span>' +
              '<span class="rg-tl-body">' +
              '<span class="rg-tl-time cx-h cx-a">' +
              escapeHtml(it.time || "--:--") +
              "</span>" +
              '<span class="rg-tl-title cx-h">' +
              escapeHtml(it.title || "") +
              "</span>" +
              "</span>" +
              "</div>",
          )
          .join("") +
        "</div>" +
        "</div>"
      );
    };

    list.innerHTML =
      group("Tiệc Cưới", partyDate, party) +
      group(ceremonyName || "Lễ Thành Hôn", ceremonyDate, ceremony);
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
  // Không phải một lưới phẳng: ảnh được rót lần lượt vào 4 khối bố cục
  //   1. tràn viền (1 ảnh hết bề ngang thiệp, kèm một dòng chữ viết tay)
  //   2. bộ ba (1 ảnh lớn + 2 ảnh nhỏ xếp dọc)
  //   3. chồng lệch (2 ảnh so le)
  //   4. lưới (phần còn lại, có xen một ô chữ)
  // Ít ảnh thì khối nào không đủ ảnh sẽ tự ẩn, không để lại chỗ trống.

  const RG_BAND_TEXT = "Forever &amp; Always";

  /**
   * Ảnh minh hoạ cho một mục (tiệc, lịch trình). KHÔNG bấm phóng to được: nó
   * không nằm trong lightboxImages, cho bấm sẽ mở nhầm ảnh khác.
   * Không có ảnh thì giấu cả khối, đừng để lại khung trống.
   */
  function _sectionPhoto(wrapId, file, focalPoints, cls) {
    const wrap = document.getElementById(wrapId);
    if (!wrap) return;
    if (!file) {
      cxToggle(wrapId, false);
      return;
    }
    const fp = focalPoints?.[file];
    wrap.innerHTML = `<img src="${getImageUrl(file)}" alt="" loading="lazy"
      class="${cls}" style="object-position:${fp?.x ?? 50}% ${fp?.y ?? 50}%">`;
    cxToggle(wrapId, true);
  }

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

    // 2. Một ảnh lớn bên trái + hai ảnh nhỏ xếp dọc bên phải
    const trioWrap = document.getElementById("gallery-trio");
    const trio = take(3);
    if (trioWrap && trio) {
      trioWrap.innerHTML = "";
      const box = document.createElement("div");
      box.className = "rg-trio";
      box.appendChild(_photo(trio[0].url, trio[0].fp, n - 3, "rg-trio-a"));
      box.appendChild(_photo(trio[1].url, trio[1].fp, n - 2, "rg-trio-b"));
      box.appendChild(_photo(trio[2].url, trio[2].fp, n - 1, "rg-trio-b"));
      trioWrap.appendChild(box);
    }
    show("gallery-trio", !!(trioWrap && trio));

    // 3. Hai ảnh chồng lệch tầng
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

    // 4. Phần còn lại xếp so le hai cột. Khổ ảnh xoay vòng theo 4 dáng để hai
    // cột lệch nhau — cùng một tỉ lệ cho tất cả thì lại thành lưới phẳng.
    const RG_SHAPES = [
      "aspect-[3/4]",
      "aspect-square",
      "aspect-[4/5]",
      "aspect-[5/6]",
    ];

    grid.innerHTML = "";
    const rest = list.slice(n);
    rest.forEach((p, k) => {
      grid.appendChild(
        _photo(
          p.url,
          p.fp,
          n + k,
          "cursor-pointer shadow-sm " + RG_SHAPES[k % RG_SHAPES.length],
        ),
      );
    });
    grid.classList.toggle("hidden", rest.length === 0);
  }
})();
