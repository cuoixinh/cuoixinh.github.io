// Seaside Film — thiệp dài nền trắng tông be: ảnh biển tràn viền, dải phim Kodak, lịch trên ảnh.
// Chỉ khai báo CX_THEME + renderWedding; phần chạy nằm ở core/helpers/theme-boot.js.

(function () {
  window.CX_THEME = {
    id: "seaside-film",
    wishesMode: "card",
    giftBox: "minimalism_brown",
    music: { variant: "disc", chrome: "fixed-corner", art: "couple" },

    // Sinh lại bằng: npm run check:palette -- --write
    palette: {
      heading: "#2b2826",
      body: "#55504b",
      accent: "#a48a6a",
      accent_soft: "#cdbba3",
      on_accent: "#ffffff",
      on_image: "#ffffff",
      on_lightbox: "#ffffff",
      card_bg: "#ffffff",
      page_bg: "#f6f3ef",
      surface: "#f8f5f1",
      band: "#f6f3ef",
      panel: "#ffffff",
      panel_warm: "#fbf8f4",
      cover: "#ffffff",
      cover_mid: "#f6f3ef",
      cover_veil: "#ffffff",
      lightbox_bg: "#000000",
      line: "#e8e0d6",
      shadow: "#000000",
      scrim: "#000000",
      deco: "#a48a6a",
      deco_soft: "#efe7dc",
      deco_2: "#1c1a19",
      deco_2_soft: "#3a3633",
      shine_from: "#a48a6a",
      shine_mid: "#cdbba3",
      shine_to: "#efe7dc",
    },

    swatches: ["#a48a6a", "#cdbba3", "#2b2826", "#55504b", "#1c1a19", "#e8e0d6", "#f6f3ef", "#ffffff"],

    wishes: { bubble: "#f8f5f1", text: "#55504b", accent: "#a48a6a", btn: "#2b2826" },

    reveal: ["#main-card section"],
    revealItems: ["#gallery-grid img", "#section-film .sf-frame"],

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
    renderCover(w);
    setText("sf-cover-date", _fmtDMY(w.ceremony_date), "--.--.----");
    setText("sf-cover-groom-latin", _latin(w.groom_name));
    setText("sf-cover-bride-latin", _latin(w.bride_name));
    setText("story-quote", w.story_quote ? `“ ${w.story_quote} ”` : "");
    cxToggle("story-quote", !!w.story_quote);

    setupMusic(w.music_url, w.enable_music);

    renderCoupleInfo(w);

    // --- Lễ: nhà gái bật Vu Quy thì thay tên lễ + giờ + nơi ---
    const isVuQuy = !_isGroom && cxEnabled(w.vu_quy_enabled);
    const ceremonyName = isVuQuy ? "Lễ Vu Quy" : w.ceremony_name || "Lễ Thành Hôn";
    const ceremonyTime = isVuQuy ? w.vu_quy_time : w.ceremony_time;
    const ceremonyLoc = isVuQuy ? w.vu_quy_location : w.ceremony_location || "";
    setText("ceremony-event-name", ceremonyName);
    setText("sf-cer-time", ceremonyTime, "--:--");
    setText("sf-cer-wd", _weekday(w.ceremony_date));
    setText("sf-cer-date", _fmtDMY(w.ceremony_date), "--.--.----");
    setText("sf-cer-lunar", w.ceremony_lunar ? `Âm lịch: ${w.ceremony_lunar}` : "");
    cxToggle("sf-cer-lunar", !!w.ceremony_lunar);
    setText("sf-cer-loc", ceremonyLoc);
    cxToggle("sf-cer-loc", !!ceremonyLoc);

    renderMusicSummary(w, { ceremonyName, ceremonyTime, ceremonyLocation: ceremonyLoc });
    _countdown(w.ceremony_date, ceremonyTime);

    // --- Tiệc (mỗi nhà một ngày/giờ/nơi riêng) ---
    const partyDate = w[`${side}_party_date`];
    const partyTime = w[`${side}_party_time`];
    const partyLunar = w[`${side}_party_lunar`];
    const partyLoc = w[`${side}_party_location`] || "";
    const partyOn = cxEnabled(w.enable_party);
    setText("party-section-label", "Tiệc mừng");
    setText("sf-party-time", partyTime, "--:--");
    setText("sf-party-wd", _weekday(partyDate));
    setText("sf-party-date", _fmtDMY(partyDate), "--.--.----");
    setText("sf-party-lunar", partyLunar ? `Âm lịch: ${partyLunar}` : "");
    cxToggle("sf-party-lunar", !!partyLunar);
    setText("sf-party-loc", partyLoc);
    cxToggle("sf-party-loc", !!partyLoc);

    // Tiệc diễn ra trước lễ thì tiệc lên trên; thiếu ngày/giờ thì giữ lễ trước.
    const at = (d, t) => (d ? Date.parse(`${d}T${t || "00:00"}`) || 0 : 0);
    const cerAt = at(w.ceremony_date, ceremonyTime);
    const partyAt = at(partyDate, partyTime);
    const partyFirst = partyOn && cerAt && partyAt && partyAt < cerAt;
    document.getElementById("sf-ev-cer")?.classList.toggle("is-later", !!partyFirst);
    document.getElementById("section-party")?.classList.toggle("is-later", !partyFirst);
    cxToggle("section-party", partyOn);

    _renderCalendar(w.ceremony_date || partyDate, [w.ceremony_date, partyOn ? partyDate : null]);

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

  // ============= ẢNH TRANG TRÍ =============
  // <img data-sf-g="N"> nhận ảnh thứ N của album (quay vòng khi album ít ảnh); album rỗng
  // thì lấy ảnh bìa.

  function _fillDecoPhotos(w) {
    const gal = w.gallery_images || [];
    const fps = w.image_focal_points || {};
    const pick = (n) =>
      gal.length
        ? { file: gal[n % gal.length], fp: fps.gallery_images?.[gal[n % gal.length]] }
        : { file: w.cover_image_url, fp: fps.cover_image_url };
    document.querySelectorAll("img[data-sf-g]").forEach((el) => {
      const { file, fp } = pick(+el.dataset.sfG);
      if (!file) return;
      el.src = getImageUrl(file);
      el.style.objectPosition = cxFocal(fp);
    });
  }

  // ============= ALBUM =============
  // Ảnh đầu tràn viền + hàng chữ "Sweet · Wedding · Invitation", mờ dần về nền; phần còn
  // lại lưới hai cột, cứ mỗi ảnh thứ ba nằm ngang trọn hàng. Thứ tự lightbox = thứ tự gốc.

  function renderGallery(images, focalPoints) {
    const grid = document.getElementById("gallery-grid");
    if (!grid) return;
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
        class="sf-ph ${cls}" style="object-position:${cxFocal(fp)}">`;
    };
    const lead = `<div class="sf-gal-lead">${img(0, "")}
      <div class="sf-row3 is-on-image"><span>Sweet</span><span>Wedding</span><span>Invitation</span></div></div>`;
    const rest = urls
      .slice(1)
      .map((_, k) => img(k + 1, k % 3 === 2 ? "is-wide" : ""))
      .join("");
    grid.innerHTML = lead + (rest ? `<div class="sf-gal-grid">${rest}</div>` : "");
    grid.onclick = (e) => {
      const t = e.target.closest("img[data-i]");
      if (t) openLightbox(+t.dataset.i);
    };
  }

  // Nút "Chỉ đường" trong thẻ bản đồ: đổi link xem bản đồ (?query=) thành trang chỉ đường.
  // Uỷ quyền trên cả mục nên bản đồ thứ hai (renderVenueMaps nhân ra) cũng có.
  function _bindDirections() {
    const sec = document.getElementById("section-map");
    if (!sec || sec._sfDir) return;
    sec._sfDir = true;
    sec.addEventListener("click", (e) => {
      const link = e.target.closest("[data-sf-dir]")?.closest("a");
      if (!link) return;
      e.preventDefault();
      const q = new URL(link.href, location.href).searchParams.get("query");
      const url = q
        ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}`
        : link.href;
      window.open(url, "_blank", "noopener");
    });
  }

  // ============= ĐẾM NGƯỢC tới giờ làm lễ; qua giờ thì về 00 và dừng =============

  let _cdTimer = null;

  function _countdown(dateStr, timeStr) {
    if (_cdTimer) clearInterval(_cdTimer);
    _cdTimer = null;
    const target = dateStr ? new Date(`${dateStr}T${timeStr || "00:00"}:00`).getTime() : NaN;
    cxToggle("sf-countdown", !isNaN(target));
    if (isNaN(target)) return;
    const pad = (n) => String(n).padStart(2, "0");
    function tick() {
      const left = Math.max(0, Math.floor((target - Date.now()) / 1000));
      setText("cd-days", pad(Math.floor(left / 86400)));
      setText("cd-hours", pad(Math.floor((left % 86400) / 3600)));
      setText("cd-minutes", pad(Math.floor((left % 3600) / 60)));
      setText("cd-seconds", pad(left % 60));
      if (!left && _cdTimer) {
        clearInterval(_cdTimer);
        _cdTimer = null;
      }
    }
    tick();
    _cdTimer = setInterval(tick, 1000);
  }

  // ============= LỊCH đặt trên ảnh: "MM / DD", tuần bắt đầu Thứ Hai, năm in chìm =============

  function _renderCalendar(baseDate, marks) {
    const box = document.getElementById("sf-calendar");
    if (!box) return;
    const d = baseDate ? new Date(baseDate) : null;
    if (!d || isNaN(d.getTime())) {
      box.closest(".sf-calcard")?.classList.add("is-empty");
      box.innerHTML = "";
      return;
    }
    box.closest(".sf-calcard")?.classList.remove("is-empty");
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
    for (let k = 0; k < lead; k++) cells.push("<span></span>");
    for (let day = 1; day <= days; day++) {
      cells.push(`<span class="sf-cal-d${marked.has(day) ? " is-on" : ""}">${day}</span>`);
    }
    box.innerHTML = `
      <div class="sf-cal-year">${y}</div>
      <div class="sf-cal-head">${pad(m + 1)}<span>/</span>${pad(d.getDate())}</div>
      <div class="sf-cal-grid">
        ${["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((n) => `<span class="sf-cal-wd">${n}</span>`).join("")}
        ${cells.join("")}
      </div>`;
  }

  // "2026-05-20" → "20.05.2026"; rỗng nếu không phân giải được.
  function _fmtDMY(dateStr) {
    const d = dateStr ? new Date(dateStr) : null;
    if (!d || isNaN(d.getTime())) return "";
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
  }

  // "2026-05-20" → "Thứ Tư"; rỗng nếu không phân giải được.
  function _weekday(dateStr) {
    const d = dateStr ? new Date(dateStr) : null;
    return d && !isNaN(d.getTime()) ? WD[d.getDay()] : "";
  }

  // Dòng chữ Latin mảnh dưới tên ở màn bìa: "Hải Yến" → "HAI YEN".
  function _latin(name) {
    return String(name || "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/đ/gi, "D")
      .toUpperCase()
      .trim();
  }
})();
