// ============= THEME: VINTAGE FOREST =============
// Trắng & hồng phấn, tối giản. Mẫu LẤY ẢNH LÀM CHÍNH: rút gọn còn 8 mục (không
// có Gia đình, không có Lịch trình ngày cưới), bù lại album chứa tới ~18 ảnh
// qua 5 khối bố cục chia hai cụm, và Chuyện chúng mình viết thành VĂN XUÔI liền
// mạch thay cho dòng thời gian có chấm mốc.
// Nét riêng: KHÔNG có màn bìa — mở link là vào thẳng poster ngày cưới cỡ lớn,
// kèm đếm ngược tới từng GIÂY.
//
// File này chỉ KHAI BÁO: window.CX_THEME + renderWedding + phần đặc thù của mẫu.
// Phần "chạy" nằm ở core/helpers/theme-boot.js, nạp sau file này.
//
// Bọc trong IIFE, chỉ lộ CX_THEME + renderWedding: `const` cấp cao nhất của
// script cổ điển là biến toàn cục, trùng tên với trang khác là vỡ trang đó.

(function () {
  window.CX_THEME = {
    id: "vintage-forest",

    preset: {
      heading_font: "Playfair Display",
      body_font: "Be Vietnam Pro",
      heading_color: "#1a1a1a", // đen than
      body_color: "#7a7a7a",
      accent_color: "#f3a8b8", // hồng phấn
      background_color: "#ffffff", // #main-card
      swatches: [
        "#1a1a1a",
        "#3f3f3f",
        "#7a7a7a",
        "#a8a8a8",
        "#f3a8b8",
        "#f7c9d3",
        "#fbdde3",
        "#fdf1f3",
        "#e8b4a0",
        "#9db08a",
        "#ffffff",
      ],
    },

    // Mẫu gom về ba lớp ngữ nghĩa (.cx-h · .cx-t · .cx-a, khai trong theme.css).
    // .cx-hd/.cx-bd/.cx-ac là markup do helper dùng chung sinh ra — giữ nguyên.
    // Cố ý KHÔNG gồm .vf-num / .vf-date-* (kiểu chữ số là nét nhận dạng) và .vf-on
    // (chữ nằm TRÊN ảnh, đổi sang màu sẫm là chìm nghỉm).
    selectors: {
      headingFont: ".cx-h, .font-playfair",
      bodyFont: "body, .cx-t",
      headingColor: ".cx-h, .cx-hd",
      bodyColor: ".cx-t, .cx-bd",
      accentColor: ".cx-a, .cx-ac",
      background: "body, #main-card",
    },

    // Poster mở đầu KHÔNG hiện dần: nó choán cả màn ngay khi vào, cho trượt vào
    // thì khách thấy một khoảng trống trước đã.
    reveal: ["#main-card section:not(#section-hero)"],

    // Mốc bung bảng đề xuất mẫu khác ở bản xem thử (?preview=true): cuộn tới
    // mục này là bảng trượt lên. Mặc định của core/utils.js cũng là hộp mừng
    // cưới, khai ra đây để mỗi mẫu tự chọn được chỗ hợp với bố cục của mình.
    suggest: "#section-gift",

    // Cụm ảnh thứ hai không có trong bảng mặc định của preview-focus-helper.js.
    focus: { photos: ["#section-photos", "#section-photos-2"] },

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

    // --- Mở đầu: poster ngày cưới (mẫu này không có màn bìa) ---
    // Khối dựng ảnh chạy TRƯỚC setupMusic: đây là chỗ ảnh của màn ĐẦU TIÊN nhận
    // src, mà setupMusic kéo YouTube iframe API (script bên thứ ba) về ngay khi
    // chạy — để nó đi trước là ảnh phải xếp hàng sau.

    renderHero(w, false);
    renderStoryQuote(w.story_quote);
    setText("hero-day", _dayMonth(w.ceremony_date), "--/--");
    setText("hero-year", _year(w.ceremony_date), "----");
    setText("footer-date", _dottedDate(w.ceremony_date), "----.--.--");
    startCountdown(w.ceremony_date, w.ceremony_time);

    // --- Nhạc nền ---
    setupMusic(w.music_url, w.enable_music);

    // --- Thư mời: nhà gái bật Vu Quy thì thay toàn bộ phần lễ ---
    const isVuQuy = !_isGroom && cxEnabled(w.vu_quy_enabled);
    const ceremonyName = isVuQuy ? "Lễ Vu Quy" : w.ceremony_name || "Lễ Thành Hôn";
    const ceremonyTime = isVuQuy ? w.vu_quy_time : w.ceremony_time;
    const ceremonyLoc = isVuQuy ? w.vu_quy_location : w.ceremony_location || "";

    // Mẫu này KHÔNG có mục Gia đình (không có tên bố mẹ, địa chỉ hai nhà) nên
    // công tắc enable_family bên Thiết lập không tác dụng gì ở đây. Vẫn gọi
    // renderCoupleInfo vì hai ẢNH chú rể / cô dâu được dùng ở mục Thư mời; các
    // setText còn lại trong hàm đó không tìm thấy id nên tự bỏ qua.
    renderCoupleInfo(w);

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

    // Dòng địa danh cuối poster: nơi đãi tiệc là chỗ khách phải tới, không có
    // thì lùi về nơi làm lễ. Trống thì giấu cả dòng, đừng để trơ mỗi icon.
    const heroPlace = _shortPlace(partyLocation || ceremonyLoc);
    setText("hero-place", heroPlace, "");
    cxToggle("hero-place-wrap", !!heroPlace);

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

    // --- Chuyện chúng mình (văn xuôi) ---
    if (cxEnabled(w.enable_love_story)) {
      _renderStoryProse(w.love_story, w.groom_name, w.bride_name);
    } else {
      cxToggle("love-story", false);
    }

    // --- Ảnh cho các mục ngoài album ---
    // Album tối đa 10 tấm nên không đủ để chia riêng: CHẤP NHẬN DÙNG LẠI ảnh,
    // album vẫn vẽ đủ cả 10 tấm (không cắt tấm nào ra). Mỗi mục lấy một vị trí
    // khác nhau cho đỡ trùng nhau; album rỗng thì lùi về ảnh bìa.
    const album = Array.isArray(w.gallery_images) ? w.gallery_images.slice() : [];
    const focals = w.image_focal_points?.gallery_images;
    const _pick = (i) => album[i] || w.cover_image_url;

    _sectionPhoto("party-photo", _pick(album.length >> 1), focals, "vf-wide-photo");
    _renderCalendar(w.ceremony_date, partyDate, _pick(album.length - 1), focals);

    // --- Album ảnh ---
    if (cxEnabled(w.enable_photos)) {
      renderGallery(album, focals);
    } else {
      cxToggle("section-photos", false);
      cxToggle("section-photos-2", false);
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

  // ============= HỘP MỪNG CƯỚI =============
  // Mặc định ĐÓNG, bấm nút mới mở: thông tin chuyển khoản không nên đập vào mắt
  // khách ngay khi cuộn tới. Gọi từ onclick trong index.html nên phải lộ ra
  // window (index.js bọc trong IIFE).

  // MỘT CHIỀU: mở rồi thì thôi, không có đường đóng lại (bóc phong bao ra rồi
  // gấp lại là vô duyên) — muốn thấy lại phong bao thì tải lại trang.
  // Hai việc xảy ra CÙNG LÚC (phong bao thu, hộp giãn) và phong bao KHÔNG bị gỡ
  // khỏi DOM: chờ cái này xong mới chạy cái kia, hoặc ẩn thẻ giữa chừng, đều
  // làm bố cục nhảy một nhịp.
  function toggleGift() {
    const box = document.getElementById("gift-box");
    const env = document.getElementById("gift-env");
    if (!box || !box.classList.contains("is-closed")) return;

    env?.setAttribute("aria-expanded", "true");
    env?.classList.add("is-opening");
    box.classList.remove("is-closed");
  }

  window.cxToggleGift = toggleGift;

  // ============= POSTER MỞ ĐẦU =============

  /** "15/9" — ngày/tháng cỡ lớn, dòng trên của poster. */
  function _dayMonth(dateStr) {
    const d = _date(dateStr);
    return d ? `${d.getDate()}/${d.getMonth() + 1}` : "";
  }

  /** "2024" — dòng dưới của poster. */
  function _year(dateStr) {
    const d = _date(dateStr);
    return d ? String(d.getFullYear()) : "";
  }

  /** "2025.05.20" — dòng ngày ở cuối thiệp. */
  function _dottedDate(dateStr) {
    const d = _date(dateStr);
    if (!d) return "";
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}`;
  }

  function _date(dateStr) {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    return isNaN(d) ? null : d;
  }

  /**
   * Địa danh ngắn cho poster: giữ HAI cụm cuối của địa chỉ (thường là
   * huyện + tỉnh). Địa chỉ đầy đủ dài mấy dòng sẽ phá bố cục poster.
   */
  function _shortPlace(location) {
    if (!location) return "";
    const parts = location
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    return parts.slice(-2).join(", ");
  }

  // ============= ĐẾM NGƯỢC TỚI NGÀY CƯỚI =============
  // Chỉ tính từ ceremony_date (+ giờ nếu có) nên không cần thêm gì ở trang
  // Thiết lập. Hiện tới GIÂY nên nhịp chạy mỗi giây; qua ngày cưới thì về 00 và
  // dừng hẳn.

  let _cdTimer = null;

  function startCountdown(dateStr, timeStr) {
    if (_cdTimer) clearInterval(_cdTimer);
    const target = dateStr
      ? new Date(`${dateStr}T${timeStr || "00:00"}:00`).getTime()
      : NaN;
    if (isNaN(target)) return;

    const pad = (n) => String(Math.max(0, n)).padStart(2, "0");

    function tick() {
      const left = target - Date.now();
      if (left <= 0) {
        ["cd-days", "cd-hours", "cd-minutes", "cd-seconds"].forEach((id) =>
          setText(id, "00"),
        );
        clearInterval(_cdTimer);
        _cdTimer = null;
        return;
      }
      const sec = Math.floor(left / 1000);
      setText("cd-days", pad(Math.floor(sec / 86400)));
      setText("cd-hours", pad(Math.floor((sec % 86400) / 3600)));
      setText("cd-minutes", pad(Math.floor((sec % 3600) / 60)));
      setText("cd-seconds", pad(sec % 60));
    }

    tick();
    _cdTimer = setInterval(tick, 1000);
  }

  // ============= CHUYỆN CHÚNG MÌNH — VĂN XUÔI =============
  // Khác các mẫu trước: không vẽ dòng thời gian có chấm mốc. Nội dung các mốc
  // được nối thành những ĐOẠN VĂN liền mạch (bỏ mốc thời gian và tiêu đề từng
  // mốc), ảnh của các mốc chèn xen giữa. Ảnh ở đây KHÔNG bấm phóng to được: nó
  // không nằm trong lightboxImages, cho bấm sẽ mở nhầm ảnh khác.

  const VF_STORY_MAX_PHOTOS = 2;

  function _renderStoryProse(events, groomName, brideName) {
    const list = document.getElementById("love-story-list");
    if (!list) return;

    const items = Array.isArray(events) ? events : [];
    // Mốc nào chỉ có tiêu đề mà không có nội dung thì lấy chính tiêu đề làm câu.
    const paras = items
      .map((ev) => (ev.content || ev.title || "").trim())
      .filter(Boolean);
    if (!paras.length) {
      cxToggle("love-story", false);
      return;
    }

    const photos = items
      .filter((ev) => ev.image_url)
      .slice(0, VF_STORY_MAX_PHOTOS);

    // Ảnh chèn sau đoạn nào: rải đều theo số đoạn để không dồn hết xuống cuối.
    const gap = Math.max(1, Math.ceil(paras.length / (photos.length + 1)));

    let html = "";
    let used = 0;
    paras.forEach((text, i) => {
      html +=
        '<p class="cx-t vf-para' +
        (i === 0 ? " vf-para-lead" : "") +
        '">' +
        escapeHtml(text) +
        "</p>";
      if (used < photos.length && (i + 1) % gap === 0 && i < paras.length - 1) {
        const p = photos[used++];
        const fp = p.focal_point;
        html +=
          `<img src="${getImageUrl(p.image_url)}" alt="" loading="lazy"` +
          ` class="vf-story-photo" style="object-position:${fp?.x ?? 50}% ${fp?.y ?? 50}%">`;
      }
    });
    list.innerHTML = html;

    // Chữ ký cuối mục: tên hai người thay cho dấu "&" mặc định.
    const names = [brideName, groomName].filter(Boolean).join(" & ");
    if (names) setText("story-sign", names);

    cxToggle("love-story", true);
  }

  // ============= ALBUM ẢNH =============
  // Không phải một lưới phẳng: ảnh được rót lần lượt vào 3 khối bố cục, chia
  // hai cụm kẹp lấy mục Chuyện chúng mình.
  //   Cụm 1  1. mở màn (1 ảnh NGANG tràn viền kèm chữ viết tay + hàng 3 ảnh nhỏ)
  //          2. cặp lệch tầng (2 ảnh cạnh nhau, kèm một dòng chữ viết tay)
  //   Cụm 2  3. phần còn lại — dáng chọn theo SỐ ẢNH dư (1 · 2 · 3 · 4 · ≥5)
  // Sáu ảnh đầu vào hai khối của cụm 1, bao nhiêu còn lại dồn hết sang cụm 2 nên
  // album 7–10 tấm vẫn ra bố cục tử tế. Khối nào không đủ ảnh thì tự ẩn; cụm 2
  // hết ảnh thì ẩn cả mục, đừng để trơ mỗi dòng chữ xen giữa.

  // ============= LỊCH THÁNG CƯỚI =============
  // Mẫu tự vẽ thay cho calendar-helper.js (helper đó viết style nội tuyến nên
  // theme.css không nắn được). Chỉ vẽ THÁNG LÀM LỄ: ngày lễ là ô đặc, ngày tiệc
  // là ô viền và chỉ đánh dấu khi tiệc rơi vào đúng tháng đó.

  const VF_WD = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

  function _renderCalendar(ceremonyDate, partyDate, photoFile, focalPoints) {
    const box = document.getElementById("vf-cal");
    if (!box) return;

    const d = ceremonyDate ? new Date(ceremonyDate) : null;
    if (!d || isNaN(d.getTime())) {
      cxToggle("vf-cal", false);
      return;
    }

    const year = d.getFullYear();
    const month = d.getMonth();
    const first = new Date(year, month, 1).getDay();
    const total = new Date(year, month + 1, 0).getDate();
    const cerDay = d.getDate();

    const p = partyDate ? new Date(partyDate) : null;
    const parDay =
      p &&
      !isNaN(p.getTime()) &&
      p.getFullYear() === year &&
      p.getMonth() === month &&
      p.getDate() !== cerDay
        ? p.getDate()
        : 0;

    let cells = '<span class="vf-cal-c"></span>'.repeat(first);
    for (let n = 1; n <= total; n++) {
      const cls = ["vf-cal-d"];
      if ((first + n - 1) % 7 === 0) cls.push("vf-cal-sun");
      if (n === cerDay) cls.push("vf-cal-on");
      else if (n === parDay) cls.push("vf-cal-alt");
      cells += `<span class="vf-cal-c"><span class="${cls.join(" ")}">${n}</span></span>`;
    }

    const head = VF_WD.map(
      (w, i) => `<span${i === 0 ? ' class="vf-cal-sun"' : ""}>${w}</span>`,
    ).join("");

    let note = `${WEEKDAYS[d.getDay()]}, ngày ${cerDay} tháng ${month + 1} năm ${year}`;
    if (parDay) note += ` · Tiệc ngày ${parDay}`;

    // Ảnh tràn viền trên đầu thẻ. Không mượn được ảnh thì bỏ hẳn khối, đừng để
    // khung trống.
    const fp = photoFile ? focalPoints?.[photoFile] : null;
    const top = photoFile
      ? `<div class="vf-cal-top"><img src="${getImageUrl(photoFile)}" alt=""
          loading="lazy" style="object-position:${fp?.x ?? 50}% ${fp?.y ?? 50}%">
          <svg class="vf-cal-wave" viewBox="0 0 390 40" preserveAspectRatio="none"
            aria-hidden="true">
            <path d="M0 40C96 38 176 8 258 6c54-1 94 8 132 16v18H0z"
              fill="rgb(var(--vf-card-bg-rgb))" />
          </svg></div>`
      : "";

    box.innerHTML = `
      ${top}
      <div class="cx-h vf-cal-mon">Tháng ${month + 1}</div>
      <div class="vf-cal-grid vf-cal-hd cx-t">${head}</div>
      <div class="vf-cal-grid">${cells}</div>
      <div class="cx-t vf-cal-note">${note}</div>`;
  }

  const VF_BAND_TEXT = "Forever &amp; Always";
  const VF_STACK_TEXT = "you &amp; me &#9825;";

  /**
   * Ảnh minh hoạ cho một mục (tiệc). KHÔNG bấm phóng to được: nó không nằm
   * trong lightboxImages. Không có ảnh thì giấu cả khối, đừng để khung trống.
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
    const grid = document.getElementById("gallery-rest");
    if (!grid) return;

    const list = images?.length
      ? images.map((f) => ({ url: getImageUrl(f), fp: focalPoints?.[f] }))
      : Array.from({ length: 12 }, (_, i) => ({
          url: createPlaceholderSVG(`Ảnh ${i + 1}`),
          fp: null,
        }));

    // Kho ảnh của lightbox dùng chung — thứ tự phải khớp chỉ số truyền vào _photo.
    lightboxImages.length = 0;
    lightboxImages.push(...list.map((p) => p.url));

    let n = 0; // ảnh kế tiếp chưa dùng
    const take = (k) => (n + k <= list.length ? list.slice(n, (n += k)) : null);

    // 1. Ảnh NGANG tràn viền (chữ viết tay đè lên) + hàng ba ảnh nhỏ ngay dưới.
    // Chỉ đủ ảnh ngang mà thiếu ba ảnh nhỏ thì vẫn dựng, hàng dưới tự bỏ.
    const leadWrap = document.getElementById("gallery-lead");
    const lead = take(1);
    if (leadWrap && lead) {
      leadWrap.innerHTML = "";
      const box = document.createElement("div");
      box.className = "vf-lead";

      const big = document.createElement("div");
      big.className = "vf-band-photo";
      big.appendChild(_photo(lead[0].url, lead[0].fp, n - 1, "vf-band-img"));
      const cap = document.createElement("div");
      cap.className = "vf-band-cap vf-on vf-script";
      cap.innerHTML = VF_BAND_TEXT;
      big.appendChild(cap);
      box.appendChild(big);

      const three = take(3);
      if (three) {
        const row = document.createElement("div");
        row.className = "vf-lead-row";
        three.forEach((p, k) =>
          row.appendChild(_photo(p.url, p.fp, n - 3 + k, "vf-lead-i")),
        );
        box.appendChild(row);
      }
      leadWrap.appendChild(box);
    }
    cxToggle("gallery-lead", !!(leadWrap && lead));

    // 2. Cặp ảnh đứng cạnh nhau; cột phải có một dòng chữ viết tay ở khoảng
    // trống phía trên rồi mới tới ảnh.
    const stackWrap = document.getElementById("gallery-stack");
    const stack = take(2);
    if (stackWrap && stack) {
      stackWrap.innerHTML = "";
      const box = document.createElement("div");
      box.className = "vf-stack";
      const [a, b] = stack;
      box.appendChild(_photo(a.url, a.fp, n - 2, "vf-stack-a"));

      const right = document.createElement("div");
      right.className = "vf-stack-r";
      const cap = document.createElement("div");
      cap.className = "vf-stack-cap vf-script cx-a";
      cap.innerHTML = VF_STACK_TEXT;
      right.appendChild(cap);
      right.appendChild(_photo(b.url, b.fp, n - 1, "vf-stack-b"));
      box.appendChild(right);

      stackWrap.appendChild(box);
    }
    cxToggle("gallery-stack", !!(stackWrap && stack));

    // 3. Toàn bộ ảnh CÒN LẠI. Từ 2 đến 4 tấm thì bày kiểu ẢNH CHỒNG ẢNH: mỗi
    // tấm một khổ, nghiêng mỗi tấm một chiều và gối lên nhau như ảnh rời rải
    // trên bàn — vị trí khai sẵn trong theme.css theo số tấm (.vf-col-<số>).
    // Một tấm thì để nằm ngang một mình, từ 5 tấm trở lên xếp so le hai cột
    // (chồng chừng ấy ảnh là rối).
    const rest = list.slice(n);
    const REST_CLS =
      rest.length >= 5
        ? ["vf-mosaic", "vf-mosaic-i"]
        : rest.length >= 2
          ? ["vf-col vf-col-" + rest.length, "vf-col-i"]
          : ["vf-set vf-set-1", "vf-set-i"];

    if (grid) {
      grid.innerHTML = "";
      grid.className = REST_CLS[0];
      rest.forEach((p, k) =>
        grid.appendChild(_photo(p.url, p.fp, n + k, REST_CLS[1])),
      );
    }

    // Hết ảnh cho cụm 2 thì ẩn cả mục — còn mỗi phần chữ xen giữa là một mục
    // trống trơn.
    cxToggle("section-photos-2", rest.length > 0);
  }
})();
