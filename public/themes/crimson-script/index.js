// Crimson Script — thiệp không màn bìa, trang dài nền trắng: tiêu đề serif đỏ + chữ ký tay.
// Chỉ khai báo CX_THEME + renderWedding; phần chạy nằm ở core/helpers/theme-boot.js.

(function () {
  window.CX_THEME = {
    id: "crimson-script",
    wishesMode: "card",
    giftBox: "mungcuoi_ivory",
    music: { variant: "mini", chrome: "fixed-corner", art: "couple" },

    // Sinh lại bằng: npm run check:palette -- --write
    palette: {
      heading: "#5a4547",
      body: "#5f5052",
      accent: "#a8323a",
      accent_soft: "#d99a9e",
      on_accent: "#ffffff",
      on_image: "#ffffff",
      on_lightbox: "#ffffff",
      card_bg: "#ffffff",
      page_bg: "#f4f1ee",
      surface: "#f7f4f2",
      band: "#faf6f4",
      panel: "#ffffff",
      panel_warm: "#ffffff",
      cover: "#ffffff",
      cover_mid: "#f7f4f2",
      cover_veil: "#f7f4f2",
      lightbox_bg: "#000000",
      line: "#e4d9d6",
      shadow: "#000000",
      scrim: "#000000",
      deco: "#a8323a",
      deco_soft: "#f0dcdd",
      deco_2: "#f6dc82",
      deco_2_soft: "#fbf0cc",
      shine_from: "#a8323a",
      shine_mid: "#d99a9e",
      shine_to: "#f0dcdd",
    },

    swatches: ["#a8323a", "#d99a9e", "#5a4547", "#5f5052", "#f6dc82", "#e4d9d6", "#f4f1ee", "#ffffff"],

    wishes: { bubble: "#faf6f4", text: "#5f5052", accent: "#a8323a", btn: "#5a4547" },

    reveal: ["#main-card section"],

    // Mẫu không vẽ gia đình, lịch trình, chuyện tình.
    skipSteps: ["family", "timeline", "love_story"],

    loveStory: "short",
    onOpen: null,
  };

  const _isGroom = isGroomSide();
  const WD = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];

  function renderWedding(w) {
    if (!w || !w.is_active) return;
    const side = _isGroom ? "groom" : "bride";

    // Ảnh màn đầu nhận src TRƯỚC setupMusic (YouTube API đi sau).
    renderHero(w, false);
    setText("cs-hero-date", _fmtDMY(w.ceremony_date), "--.--.----");
    if (w.story_quote) setText("story-quote", `"${w.story_quote}"`);

    setupMusic(w.music_url, w.enable_music);

    // --- Cô dâu chú rể ---
    renderCoupleInfo(w);
    setText("cs-sig-bride", w.bride_name, "----------");
    setText("cs-sig-groom", w.groom_name, "----------");
    _call("cs-groom-call", w.groom_phone);
    _call("cs-bride-call", w.bride_phone);

    // --- Lễ: nhà gái bật Vu Quy thì thay tên lễ + giờ + nơi ---
    const isVuQuy = !_isGroom && cxEnabled(w.vu_quy_enabled);
    const ceremonyName = isVuQuy ? "Lễ Vu Quy" : w.ceremony_name || "Lễ Thành Hôn";
    const ceremonyTime = isVuQuy ? w.vu_quy_time : w.ceremony_time;
    const ceremonyLoc = isVuQuy ? w.vu_quy_location : w.ceremony_location || "";
    setText("ceremony-event-name", ceremonyName);
    setText("cs-hero-event", ceremonyName);
    setText("cs-cer-time", ceremonyTime, "--:--");
    setText("cs-cer-date", _fmtLong(w.ceremony_date), "--------------------");
    setText("cs-cer-lunar", w.ceremony_lunar ? `Âm lịch: ${w.ceremony_lunar}` : "");
    setText("cs-cer-loc", ceremonyLoc);
    cxToggle("cs-cer-loc", !!ceremonyLoc);

    renderMusicSummary(w, { ceremonyName, ceremonyTime, ceremonyLocation: ceremonyLoc });

    // --- Tiệc (mỗi nhà một ngày/giờ/nơi riêng) ---
    const partyDate = w[`${side}_party_date`];
    const partyTime = w[`${side}_party_time`];
    const partyLunar = w[`${side}_party_lunar`];
    setText("party-section-label", "Tiệc mừng " + ceremonyName.toLowerCase());
    setText(
      "cs-party-when",
      [partyTime, _fmtLong(partyDate)].filter(Boolean).join(" · "),
      "--------------------",
    );
    setText("cs-party-lunar", partyLunar ? `Âm lịch: ${partyLunar}` : "");
    setText("cs-party-loc", w[`${side}_party_location`]);
    cxToggle("section-party", cxEnabled(w.enable_party));

    _renderCalendar(w.ceremony_date || partyDate, [w.ceremony_date, partyDate]);

    // --- Xác nhận tham dự ---
    const rsvp = document.getElementById("rsvp-section");
    if (rsvp) rsvp.style.display = cxEnabled(w.rsvp_enabled) ? "flex" : "none";
    if (w.rsvp_message) {
      setText("rsvp-custom-message", w.rsvp_message);
      cxToggle("rsvp-custom-message", true);
    }

    // --- Ảnh ---
    _fillDecoPhotos(w);
    if (cxEnabled(w.enable_photos)) {
      renderGallery(w.gallery_images, w.image_focal_points?.gallery_images);
    } else {
      cxToggle("section-photos", false);
    }

    // --- Hộp mừng cưới ---
    renderQRCodes(w);
    cxToggle("section-gift", cxEnabled(w.enable_gift));

    // --- Bản đồ ---
    renderVenueMaps(w, side);
    _bindDirections();

    // --- Lời cảm ơn ---
    if (w.footer_text) setText("footer-text", w.footer_text);
    cxToggle("section-footer", cxEnabled(w.enable_footer));
  }

  window.renderWedding = renderWedding;

  // Tên khách của link mời: helper chung điền #cover-guest-name, khối chỉ hiện khi link có ?name=.
  if (
    new URLSearchParams(location.search).has("name") &&
    !(typeof isPreviewMode === "function" && isPreviewMode())
  ) {
    // cxToggle nằm ở theme-boot.js (nạp SAU file này) → gỡ class trực tiếp.
    const g = document.getElementById("cs-guest");
    g?.classList.remove("hidden");
    g?.classList.add("flex");
  }

  // ============= ẢNH TRANG TRÍ =============
  // <img data-cs-g="N"> nhận ảnh thứ N của album (quay vòng khi album ít ảnh); album rỗng
  // thì lấy ảnh bìa. Ảnh bầu dục cuối thiệp lấy ảnh cuối album.

  function _fillDecoPhotos(w) {
    const gal = w.gallery_images || [];
    const fps = w.image_focal_points || {};
    const pick = (n) =>
      gal.length
        ? { file: gal[n % gal.length], fp: fps.gallery_images?.[gal[n % gal.length]] }
        : { file: w.cover_image_url, fp: fps.cover_image_url };
    const put = (el, { file, fp }) => {
      if (!el || !file) return;
      el.src = getImageUrl(file);
      el.style.objectPosition = cxFocal(fp);
    };
    document.querySelectorAll("img[data-cs-g]").forEach((el) => put(el, pick(+el.dataset.csG)));
    put(document.getElementById("cs-footer-photo"), pick(gal.length ? gal.length - 1 : 0));
  }

  // ============= ALBUM =============
  // #cs-gal-side: 2 ảnh xếp cột phải, chữ ký tên đè lên · #gallery-grid: phần còn lại tràn
  // bề ngang. Thứ tự lightbox = thứ tự ảnh gốc.

  function renderGallery(images, focalPoints) {
    const urls = images?.length
      ? images.map(getImageUrl)
      : Array(5)
          .fill(null)
          .map(() => createPlaceholderSVG("Chưa có ảnh"));

    lightboxImages.length = 0;
    lightboxImages.push(...urls);

    const img = (i, cls) => {
      const fp = focalPoints?.[images?.[i]];
      return `<img src="${cxImgSrc(urls[i])}" alt="" loading="lazy" data-i="${i}"
        class="cs-ph ${cls}" style="object-position:${cxFocal(fp)}">`;
    };
    const side = urls.slice(0, 2).map((_, i) => img(i, "cs-ph-side")).join("");
    // Ba ảnh tràn ngang như mẫu gốc, phần dư xếp lưới hai cột cho trang khỏi dài.
    const wide = urls.slice(2, 5).map((_, k) => img(k + 2, "cs-ph-wide")).join("");
    const more = urls.slice(5).map((_, k) => img(k + 5, "cs-ph-more")).join("");
    const rest = wide + (more ? `<div class="cs-gal-more">${more}</div>` : "");

    [
      ["cs-gal-side", side],
      ["gallery-grid", rest],
    ].forEach(([id, html]) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.innerHTML = html;
      el.onclick = (e) => {
        const t = e.target.closest("img[data-i]");
        if (t) openLightbox(+t.dataset.i);
      };
    });
    // Album chỉ 1–2 ảnh: không có dải tràn ngang thì giấu luôn chữ đè lên nó.
    document.getElementById("gallery-grid")?.parentElement.classList.toggle("hidden", !rest);
  }

  // Nút gọi: có số thì thành link tel:, không thì giấu (.cs-call-off); không nút nào thì giấu cả hàng.
  function _call(id, phone) {
    const el = document.getElementById(id);
    if (!el) return;
    const num = String(phone || "").replace(/[^\d+]/g, "");
    if (num) el.setAttribute("href", "tel:" + num);
    else el.removeAttribute("href");
    el.classList.toggle("cs-call-off", !num);
    const row = document.getElementById("cs-calls");
    row?.classList.toggle("hidden", !row.querySelector("a[href]"));
  }

  // Nút "Chỉ đường" trong thẻ bản đồ: đổi link xem bản đồ (?query=) thành trang chỉ đường.
  function _bindDirections() {
    const sec = document.getElementById("section-map");
    if (!sec || sec._csDir) return;
    sec._csDir = true;
    sec.addEventListener("click", (e) => {
      const link = e.target.closest("[data-cs-dir]")?.closest("a");
      if (!link) return;
      e.preventDefault();
      const q = new URL(link.href, location.href).searchParams.get("query");
      const url = q
        ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}`
        : link.href;
      window.open(url, "_blank", "noopener");
    });
  }

  // "2026-05-20" → "20.05.2026"; rỗng nếu không phân giải được.
  function _fmtDMY(dateStr) {
    const d = dateStr ? new Date(dateStr) : null;
    if (!d || isNaN(d.getTime())) return "";
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
  }

  // "2026-05-20" → "Thứ Tư, 20.05.2026"; rỗng nếu không phân giải được.
  function _fmtLong(dateStr) {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    const pad = (n) => String(n).padStart(2, "0");
    return `${WD[d.getDay()]}, ${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
  }

  // ============= LỊCH: "Tháng MM  –YYYY–", tuần bắt đầu Thứ Hai, tim khoanh ngày đánh dấu =============

  function _renderCalendar(baseDate, marks) {
    const box = document.getElementById("cs-calendar");
    if (!box) return;
    const d = baseDate ? new Date(baseDate) : null;
    if (!d || isNaN(d.getTime())) {
      box.classList.add("hidden");
      return;
    }
    box.classList.remove("hidden");
    const y = d.getFullYear();
    const m = d.getMonth();
    const marked = new Set(
      marks
        .map((s) => (s ? new Date(s) : null))
        .filter((x) => x && !isNaN(x.getTime()) && x.getFullYear() === y && x.getMonth() === m)
        .map((x) => x.getDate()),
    );
    const pad = (n) => String(n).padStart(2, "0");
    const lead = (new Date(y, m, 1).getDay() + 6) % 7;
    const days = new Date(y, m + 1, 0).getDate();
    const cells = [];
    for (let k = 0; k < lead; k++) cells.push("<div></div>");
    for (let day = 1; day <= days; day++) {
      cells.push(
        marked.has(day)
          ? `<div class="cs-cal-d is-on"><i data-lucide="heart"></i><span class="relative">${day}</span></div>`
          : `<div class="cs-cal-d">${day}</div>`,
      );
    }
    box.innerHTML = `
      <div class="cs-cal-head">
        <div><span class="cs-cal-dd">Tháng</span><span class="cs-cal-mm">${pad(m + 1)}</span></div>
        <div class="cs-cal-yy">–${y}–</div>
      </div>
      <div class="cs-cal-grid">
        ${["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((n) => `<div class="cs-cal-wd">${n}</div>`).join("")}
        ${cells.join("")}
      </div>`;
    window.lucide?.createIcons({ root: box });
  }
})();
