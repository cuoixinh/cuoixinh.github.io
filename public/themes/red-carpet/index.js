// Red Carpet — đám cưới dựng như buổi công chiếu: nền xanh đêm thành phố, dải phim, vé mời có cuống.
// Chỉ khai báo CX_THEME + renderWedding; phần chạy nằm ở core/helpers/theme-boot.js.

(function () {
  window.CX_THEME = {
    id: "red-carpet",
    wishesMode: "card",
    giftBox: "phongbi_do_hy",
    music: { variant: "disc", chrome: "fixed-corner", art: "couple" },

    // Bộ màu MẶC ĐỊNH của mẫu — bản khai máy đọc được của đúng những giá trị
    // :root trong theme.css (nguồn sự thật). Trang Thiết lập đọc nó để hiện mục
    // "Mặc định"; theme_setting.palette ghi đè lên trên lúc chạy.
    // Sinh lại bằng: node scripts/check-theme-palette.mjs --write
    palette: {
      heading: "#f4eee6",
      body: "#c9cce0",
      accent: "#f0b872",
      accent_soft: "#e8a0b4",
      on_accent: "#161d38",
      on_image: "#fffaf4",
      on_lightbox: "#ffffff",
      card_bg: "#161d38",
      page_bg: "#0e1326",
      surface: "#1e2748",
      band: "#121830",
      panel: "#222c50",
      panel_warm: "#2a3054",
      cover: "#0e1326",
      cover_mid: "#161d38",
      cover_veil: "#0e1326",
      lightbox_bg: "#000000",
      line: "#3a4670",
      shadow: "#000000",
      scrim: "#060914",
      deco: "#f0b872",
      deco_soft: "#f8deb4",
      deco_2: "#080a14",
      deco_2_soft: "#1e2238",
      shine_from: "#f0b872",
      shine_mid: "#fce2b4",
      shine_to: "#e8a0b4",
    },

    swatches: ["#f0b872", "#f8deb4", "#f4eee6", "#c9cce0", "#e8a0b4", "#3a4670", "#161d38", "#0e1326", "#080a14"],

    wishes: { bubble: "#1e2748", text: "#c9cce0", accent: "#f0b872", btn: "#f0b872" },

    reveal: ["#main-card section"],
    revealItems: ["#gallery-grid .rc-fr", "#love-story-list .rc-ch", "#section-ceremony .rc-tk"],

    loveStory: "short",
    onOpen: null,
  };

  const _isGroom = isGroomSide();
  const WD = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
  const pad = (n) => String(n).padStart(2, "0");

  function renderWedding(w) {
    if (!w || !w.is_active) return;
    const side = _isGroom ? "groom" : "bride";

    // Ảnh màn đầu nhận src TRƯỚC setupMusic (YouTube API đi sau).
    renderCover(w);
    setText("rc-cover-date", _fmtDMY(w.ceremony_date), "--.--.----");

    renderHero(w, false);
    setText("story-quote", w.story_quote ? `“${w.story_quote}”` : "");
    cxToggle("story-quote", !!w.story_quote);
    const cd = _date(w.ceremony_date);
    setText("rc-hero-dm", cd ? `${pad(cd.getDate())}/${pad(cd.getMonth() + 1)}` : "", "--/--");

    setupMusic(w.music_url, w.enable_music);

    // --- Lễ: nhà gái bật Vu Quy thì thay tên lễ + giờ + nơi ---
    const isVuQuy = !_isGroom && cxEnabled(w.vu_quy_enabled);
    const ceremonyName = isVuQuy ? "Lễ Vu Quy" : w.ceremony_name || "Lễ Thành Hôn";
    const ceremonyTime = isVuQuy ? w.vu_quy_time : w.ceremony_time;
    const ceremonyLoc = isVuQuy ? w.vu_quy_location : w.ceremony_location || "";

    // --- Gia đình + hai vai chính ---
    renderCoupleInfo(w);
    setText("rc-fam-title", `${ceremonyName} của con chúng tôi`);
    cxToggle("section-family", cxEnabled(w.enable_family));

    setText("ceremony-event-name", ceremonyName);
    _fillTicket("cer", w.ceremony_date, ceremonyTime, w.ceremony_lunar, ceremonyLoc);
    setText("rc-sched-line", [_weekday(w.ceremony_date), _fmtDMY(w.ceremony_date)].filter(Boolean).join(", "), "--------------------");
    setText("rc-sched-lunar", w.ceremony_lunar || "");
    cxToggle("rc-sched-lunar", !!w.ceremony_lunar);

    renderMusicSummary(w, { ceremonyName, ceremonyTime, ceremonyLocation: ceremonyLoc });
    _countdown(w.ceremony_date);

    // --- Tiệc (mỗi nhà một ngày/giờ/nơi riêng) ---
    const partyDate = w[`${side}_party_date`];
    const partyTime = w[`${side}_party_time`];
    const partyOn = cxEnabled(w.enable_party);
    setText("party-section-label", isVuQuy ? "Tiệc Mừng Vu Quy" : "Tiệc Cưới");
    _fillTicket("party", partyDate, partyTime, w[`${side}_party_lunar`], w[`${side}_party_location`] || "");

    // Tiệc diễn ra trước lễ thì vé tiệc lên trên; thiếu ngày/giờ thì giữ lễ trước.
    const at = (d, t) => (d ? Date.parse(`${d}T${t || "00:00"}`) || 0 : 0);
    const cerAt = at(w.ceremony_date, ceremonyTime);
    const partyAt = at(partyDate, partyTime);
    const partyFirst = partyOn && cerAt && partyAt && partyAt < cerAt;
    document.getElementById("section-party")?.classList.toggle("is-first", !!partyFirst);
    cxToggle("section-party", partyOn);

    _renderCalendar(w.ceremony_date || partyDate, [w.ceremony_date, partyOn ? partyDate : null]);

    // --- Xác nhận tham dự ---
    const rsvp = document.getElementById("rsvp-section");
    if (rsvp) rsvp.style.display = cxEnabled(w.rsvp_enabled) ? "flex" : "none";
    if (w.rsvp_message) {
      setText("rsvp-custom-message", w.rsvp_message);
      cxToggle("rsvp-custom-message", true);
    }

    // --- Lịch trình ---
    if (cxEnabled(w.enable_timeline)) {
      renderTimeline(w.timeline, side, partyDate, w.ceremony_date, ceremonyName);
      cxToggle("section-timeline", true);
    }

    // --- Chuyện tình ---
    if (cxEnabled(w.enable_love_story)) {
      _renderChapters(w.love_story);
    } else {
      cxToggle("love-story", false);
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

    // --- Lời cảm ơn + danh đề cuối phim ---
    setText("rc-cr-groom", w.groom_name, "----------");
    setText("rc-cr-bride", w.bride_name, "----------");
    if (w.footer_text) setText("footer-text", w.footer_text);
    cxToggle("section-footer", cxEnabled(w.enable_footer));
  }

  window.renderWedding = renderWedding;

  // Một tấm vé: giờ, thứ + ngày, âm lịch, nơi; số vé lấy theo ngày-tháng ("No. 0612").
  function _fillTicket(key, dateStr, time, lunar, loc) {
    const d = _date(dateStr);
    setText(`rc-${key}-time`, time, "--:--");
    setText(`rc-${key}-wd`, _weekday(dateStr) || "Ngày");
    setText(`rc-${key}-date`, _fmtDMY(dateStr), "--.--.----");
    setText(`rc-${key}-lunar`, lunar || "");
    cxToggle(`rc-${key}-lunar`, !!lunar);
    setText(`rc-${key}-loc`, loc);
    cxToggle(`rc-${key}-loc`, !!loc);
    setText(`rc-${key}-no`, d ? `No. ${pad(d.getDate())}${pad(d.getMonth() + 1)}` : "No. ----");
  }

  // ============= ẢNH TRANG TRÍ =============
  // <img data-rc-g="N"> nhận ảnh thứ N của album (quay vòng khi album ít ảnh); album rỗng
  // thì lấy ảnh bìa.

  function _fillDecoPhotos(w) {
    const gal = w.gallery_images || [];
    const fps = w.image_focal_points || {};
    const pick = (n) =>
      gal.length
        ? { file: gal[n % gal.length], fp: fps.gallery_images?.[gal[n % gal.length]] }
        : { file: w.cover_image_url, fp: fps.cover_image_url };
    document.querySelectorAll("img[data-rc-g]").forEach((el) => {
      const { file, fp } = pick(+el.dataset.rcG);
      if (!file) return;
      el.src = getImageUrl(file);
      el.style.objectPosition = cxFocal(fp);
    });
  }

  // ============= CHUYỆN TÌNH: mỗi mốc một "chương", ảnh và chữ so le trái/phải =============

  function _renderChapters(events) {
    const section = document.getElementById("love-story");
    const list = document.getElementById("love-story-list");
    if (!section || !list) return;
    if (!Array.isArray(events) || !events.length) {
      section.style.display = "none";
      return;
    }
    section.style.display = "";
    list.innerHTML = events
      .map((ev, i) => {
        const ph = ev.image_url
          ? `<figure class="rc-ch-ph"><img src="${cxImgSrc(ev.image_url)}" alt="" loading="lazy"
              style="object-position:${cxFocal(ev.focal_point)}"></figure>`
          : "";
        return `<article class="rc-ch${i % 2 ? " is-rev" : ""}${ph ? "" : " no-ph"}">
          ${ph}
          <div class="rc-ch-txt">
            <span class="rc-cap">Chương ${pad(i + 1)}${ev.date ? ` · ${escapeHtml(ev.date)}` : ""}</span>
            ${ev.title ? `<h3 class="rc-ch-title">${escapeHtml(ev.title)}</h3>` : ""}
            ${ev.content ? `<p class="rc-ch-body cx-t">${escapeHtml(ev.content)}</p>` : ""}
          </div>
        </article>`;
      })
      .join("");
  }

  // ============= ALBUM =============
  // Ảnh đầu lớn kèm cuộn phim dọc (4 ảnh kế tiếp) đè mép phải; phần còn lại là hai cuộn
  // phim dọc so le. Thứ tự lightbox = thứ tự gốc.

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

    const img = (i) => {
      const fp = focalPoints?.[images?.[i]];
      return `<img src="${cxImgSrc(urls[i])}" alt="" loading="lazy" data-i="${i}"
        style="object-position:${cxFocal(fp)}">`;
    };
    const reel = urls.slice(1, 5);
    const lead = `<div class="rc-gal-lead rc-fr">${img(0)}
      ${reel.length ? `<div class="rc-strip">${reel.map((_, k) => `<div class="rc-strip-cell">${img(k + 1)}</div>`).join("")}</div>` : ""}
    </div>`;
    // Hai cuộn phim dọc: ảnh chẵn/lẻ chia hai cột, số khung đếm theo thứ tự gốc.
    const cell = (i) => `<div class="rc-fr rc-gal-cell" data-fr="${pad(i - 4)}A">${img(i)}</div>`;
    const cols = [[], []];
    for (let i = 5; i < urls.length; i++) cols[(i - 5) % 2].push(cell(i));
    const rest = cols[0].length
      ? `<div class="rc-gal-grid">${cols.map((c) => `<div class="rc-roll">${c.join("")}</div>`).join("")}</div>`
      : "";
    grid.innerHTML = lead + rest;
    grid.onclick = (e) => {
      const t = e.target.closest("img[data-i]");
      if (t) openLightbox(+t.dataset.i);
    };
  }

  // Nút "Chỉ đường" trong thẻ bản đồ: đổi link xem bản đồ (?query=) thành trang chỉ đường.
  // Uỷ quyền trên cả mục nên bản đồ thứ hai (renderVenueMaps nhân ra) cũng có.
  function _bindDirections() {
    const sec = document.getElementById("section-map");
    if (!sec || sec._rcDir) return;
    sec._rcDir = true;
    sec.addEventListener("click", (e) => {
      const link = e.target.closest("[data-rc-dir]")?.closest("a");
      if (!link) return;
      e.preventDefault();
      const q = new URL(link.href, location.href).searchParams.get("query");
      const url = q
        ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}`
        : link.href;
      window.open(url, "_blank", "noopener");
    });
  }

  // Số ngày còn lại tới ngày lễ; đã qua hoặc chưa có ngày thì ẩn dòng.
  function _countdown(dateStr) {
    const d = _date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const left = d ? Math.round((d.setHours(0, 0, 0, 0) - today.getTime()) / 86400000) : -1;
    cxToggle("rc-countdown", left > 0);
    if (left > 0) setText("rc-cd-days", String(left));
  }

  // ============= LỊCH THÁNG: tuần bắt đầu Thứ Hai, ngày lễ/tiệc đánh dấu tim =============

  function _renderCalendar(baseDate, marks) {
    const box = document.getElementById("rc-calendar");
    if (!box) return;
    const d = _date(baseDate);
    if (!d) {
      box.innerHTML = "";
      cxToggle("rc-calendar", false);
      return;
    }
    cxToggle("rc-calendar", true);
    const y = d.getFullYear();
    const m = d.getMonth();
    const marked = new Set(
      marks
        .map(_date)
        .filter((x) => x && x.getFullYear() === y && x.getMonth() === m)
        .map((x) => x.getDate()),
    );
    const lead = (new Date(y, m, 1).getDay() + 6) % 7;
    const days = new Date(y, m + 1, 0).getDate();
    const cells = [];
    for (let k = 0; k < lead; k++) cells.push("<span></span>");
    for (let day = 1; day <= days; day++) {
      cells.push(`<span class="rc-cal-d${marked.has(day) ? " is-on" : ""}">${day}</span>`);
    }
    box.innerHTML = `
      <div class="rc-cal-head"><span class="rc-cal-m">Tháng ${m + 1}</span><span class="rc-cal-y">${y}</span></div>
      <div class="rc-cal-grid">
        ${["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((n) => `<span class="rc-cal-wd">${n}</span>`).join("")}
        ${cells.join("")}
      </div>`;
  }

  function _date(s) {
    const d = s ? new Date(s) : null;
    return d && !isNaN(d.getTime()) ? d : null;
  }

  // "2026-12-06" → "06.12.2026"; rỗng nếu không phân giải được.
  function _fmtDMY(s) {
    const d = _date(s);
    return d ? `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}` : "";
  }

  function _weekday(s) {
    const d = _date(s);
    return d ? WD[d.getDay()] : "";
  }
})();
