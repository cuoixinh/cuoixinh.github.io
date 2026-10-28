// Ánh Sáng Đôi Ta — nền cực quang loang màu trôi chậm, nội dung nằm trên các tấm kính mờ.
// Không có màn bìa: mục mở đầu là màn đầu tiên.
// Chỉ khai báo CX_THEME + renderWedding; phần chạy nằm ở core/helpers/theme-boot.js.

(function () {
  window.CX_THEME = {
    id: "anh-sang-doi-ta",
    wishesMode: "card",
    // Ô kính mờ tự che mã QR nên mặc định không chồng thêm hộp.
    giftBox: "none",
    music: { variant: "disc", chrome: "fixed-corner", art: "couple" },

    // Bộ màu MẶC ĐỊNH của mẫu — bản khai máy đọc được của đúng những giá trị
    // :root trong theme.css (nguồn sự thật). Trang Thiết lập đọc nó để hiện mục
    // "Mặc định"; theme_setting.palette ghi đè lên trên lúc chạy.
    // Sinh lại bằng: node scripts/check-theme-palette.mjs --write
    palette: {
      heading: "#15122b",
      body: "#15122b",
      accent: "#7c5cff",
      accent_soft: "#ff7ac6",
      on_accent: "#ffffff",
      on_image: "#ffffff",
      on_lightbox: "#ffffff",
      card_bg: "#f6f4ff",
      page_bg: "#e9e5fa",
      surface: "#ffffff",
      band: "#dcebff",
      panel: "#ffffff",
      panel_warm: "#faf8ff",
      cover: "#ece6ff",
      cover_mid: "#c7b6ff",
      cover_veil: "#f6f4ff",
      lightbox_bg: "#000000",
      line: "#ece8f7",
      shadow: "#3c2896",
      scrim: "#000000",
      deco: "#b9a6ff",
      deco_soft: "#ffb3e0",
      deco_2: "#9eebff",
      deco_2_soft: "#ffe39a",
      shine_from: "#7c5cff",
      shine_mid: "#cfc4ff",
      shine_to: "#ff7ac6",
    },

    swatches: ["#15122b", "#7c5cff", "#ff7ac6", "#3dd6f5", "#ffd36e", "#b9a6ff", "#ffb3e0", "#f6f4ff", "#ffffff"],

    wishes: { bubble: "#ffffff", text: "#15122b", accent: "#7c5cff", btn: "#7c5cff", opacity: 80 },

    reveal: ["#section-invite", "#section-ceremony", "#section-photos", "#section-map", "#rsvp-section", "#section-gift", "#section-footer"],

    // Mẫu không vẽ gia đình, lịch trình, chuyện tình.
    skipSteps: ["family", "timeline", "love_story"],
    focus: {
      couple: ["#section-hero", "#section-invite"],
      ceremony: ["#section-ceremony"],
      party: ["#section-map"],
    },

    loveStory: "short",
    onOpen: null,
  };

  const _isGroom = isGroomSide();
  const RM = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const WD = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
  const pad = (n) => String(n).padStart(2, "0");
  let _cdTimer = 0;

  function renderWedding(w) {
    if (!w || !w.is_active) return;
    const side = _isGroom ? "groom" : "bride";
    const names = _isGroom ? [w.groom_name, w.bride_name] : [w.bride_name, w.groom_name];

    const isVuQuy = !_isGroom && cxEnabled(w.vu_quy_enabled);
    const ceremonyName = isVuQuy ? "Lễ Vu Quy" : w.ceremony_name || "Lễ Thành Hôn";
    const ceremonyTime = isVuQuy ? w.vu_quy_time : w.ceremony_time;
    const ceremonyLoc = isVuQuy ? w.vu_quy_location : w.ceremony_location || "";

    // --- Mở đầu: ảnh, tên, đếm ngược (ảnh gán TRƯỚC setupMusic) ---
    setAttr("main-photo", "src", getImageUrl(w.cover_image_url));
    applyFocalPoint("main-photo", w.image_focal_points?.cover_image_url);
    setText("t4-name-1", names[0], "----------");
    setText("t4-name-2", names[1], "----------");
    _startCountdown(w.ceremony_date, ceremonyTime);
    // Lời chào riêng chạy trước renderWedding: link riêng (CX_GUEST) hay bản xem thử ?guest=
    // đều đã bỏ .hidden khỏi thẻ mời lúc này.
    if (window.CX_GUEST) cxToggle("cover-guest-wrap", true);
    const guestOn = !document.getElementById("cover-guest-wrap")?.classList.contains("hidden");
    document.getElementById("section-hero")?.classList.toggle("has-guest", guestOn);

    setupMusic(w.music_url, w.enable_music);
    renderMusicSummary(w, { ceremonyName, ceremonyTime, ceremonyLocation: ceremonyLoc });

    // --- Lời mời ---
    if (w.story_quote) setText("story-quote", w.story_quote);

    // --- Giờ lễ ---
    // Lễ và tiệc khác ngày thì mỗi ô tự ghi ngày của mình, bỏ dòng ngày chung bên dưới.
    const multiDay = _renderTiles(w, side, ceremonyName, ceremonyTime);
    cxToggle("t4-date-line", !multiDay);
    const cd = _date(w.ceremony_date);
    setText("t4-date", cd ? `${WD[cd.getDay()]}, ${pad(cd.getDate())}.${pad(cd.getMonth() + 1)}.${cd.getFullYear()}` : "", "------------");
    const lunar = _lunar(w.ceremony_lunar);
    setText("t4-lunar", lunar);
    cxToggle("t4-lunar-br", !!lunar);

    // --- Album ảnh ---
    if (cxEnabled(w.enable_photos)) _renderGallery(w.gallery_images, w.image_focal_points?.gallery_images);
    else cxToggle("section-photos", false);

    // --- Địa điểm ---
    const partyOn = cxEnabled(w.enable_party);
    const when = partyOn
      ? ["Tiệc mừng", w[`${side}_party_time`], w[`${side}_party_date`], w[`${side}_party_location`]]
      : [ceremonyName, ceremonyTime, w.ceremony_date, ceremonyLoc];
    const wd = _date(when[2]);
    setText(
      "t4-map-when",
      [when[0], when[1], wd ? `${WD[wd.getDay()].toLowerCase()} ${pad(wd.getDate())}.${pad(wd.getMonth() + 1)}` : ""]
        .filter(Boolean)
        .join(" "),
    );
    _drawMap(_shortName(when[3]));
    renderVenueMaps(w, side);

    // --- Xác nhận tham dự ---
    const rsvp = document.getElementById("rsvp-section");
    if (rsvp) rsvp.style.display = cxEnabled(w.rsvp_enabled) ? "" : "none";
    if (w.rsvp_message) {
      setText("rsvp-custom-message", w.rsvp_message);
      cxToggle("rsvp-custom-message", true);
    }

    // --- Mừng cưới ---
    renderQRCodes(w);
    _bindGlass();
    cxToggle("section-gift", cxEnabled(w.enable_gift));

    // --- Lời cảm ơn ---
    const city = _city(when[3] || ceremonyLoc);
    setText("t4-end-title", city ? `Hẹn gặp ở ${city}` : "Hẹn gặp bạn nhé");
    if (w.footer_text) {
      setText("footer-text", w.footer_text);
      cxToggle("footer-text", true);
    }
    cxToggle("section-footer", cxEnabled(w.enable_footer));

    // Không có màn bìa nên hiệu ứng mở đầu chạy ngay khi đã có dữ liệu.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => document.getElementById("section-hero")?.classList.add("t4-live")),
    );
  }

  window.renderWedding = renderWedding;

  // ============= ĐỒNG HỒ ĐẾM NGƯỢC (chạy từng giây tới giờ lễ) =============

  function _startCountdown(date, time) {
    clearInterval(_cdTimer);
    const m = /^(\d{1,2}):(\d{2})/.exec(time || "");
    const end = date ? new Date(`${date}T${m ? `${pad(m[1])}:${m[2]}` : "00:00"}:00`) : null;
    const u = ["d", "h", "m", "s"].map((k) => document.getElementById(`t4-cd-${k}`));
    if (u.some((el) => !el)) return;
    const tick = () => {
      let s = end && !isNaN(end) ? Math.max(0, Math.floor((end - new Date()) / 1000)) : 0;
      u[0].textContent = Math.floor(s / 86400);
      s %= 86400;
      u[1].textContent = pad(Math.floor(s / 3600));
      s %= 3600;
      u[2].textContent = pad(Math.floor(s / 60));
      u[3].textContent = pad(s % 60);
    };
    tick();
    _cdTimer = setInterval(tick, 1000);
  }

  // ============= GIỜ LỄ: mỗi lễ một ô kính (giờ lớn + tên lễ) =============
  // Lễ chính của bên đang xem (nhà gái bật Vu Quy thì là lễ vu quy) + tiệc của bên đó,
  // xếp theo thời gian. Hai ô khác ngày thì mỗi ô ghi ngày dương + âm của nó; trả về
  // true khi đó để dòng ngày chung bị ẩn.

  function _renderTiles(w, side, ceremonyName, ceremonyTime) {
    const box = document.getElementById("t4-two");
    if (!box) return;
    const tiles = [{ date: w.ceremony_date, time: ceremonyTime, title: ceremonyName, lunar: w.ceremony_lunar }];
    if (cxEnabled(w.enable_party) && (w[`${side}_party_date`] || w[`${side}_party_time`])) {
      tiles.push({
        date: w[`${side}_party_date`] || w.ceremony_date,
        time: w[`${side}_party_time`],
        title: "Tiệc mừng",
        lunar: w[`${side}_party_lunar`],
      });
    }
    const key = (t) => `${t.date || "9999"}T${t.time || "99:99"}`;
    tiles.sort((a, b) => key(a).localeCompare(key(b)));
    box.classList.toggle("is-one", tiles.length === 1);
    const multiDay = tiles.some((t) => t.date !== tiles[0].date);
    box.innerHTML = tiles
      .map((t) => {
        const d = multiDay ? _date(t.date) : null;
        const lunar = d ? _lunar(t.lunar) : "";
        return `<div class="t4-gl"><b class="cx-h">${escapeHtml(t.time || "--:--")}</b><span class="cx-t">${escapeHtml(t.title)}</span>${
          d ? `<small class="t4-tdate cx-t">${WD[d.getDay()]}, ${pad(d.getDate())}.${pad(d.getMonth() + 1)}</small>` : ""
        }${lunar ? `<small class="t4-tlunar cx-t">${escapeHtml(lunar)}</small>` : ""}</div>`;
      })
      .join("");
    return multiDay;
  }

  // "Ngày 12 tháng 2 năm Đinh Mùi" / "Tức ngày …" → "tức ngày 12 tháng 2 năm Đinh Mùi".
  function _lunar(s) {
    const t = String(s || "").trim().replace(/^tức\s+/i, "");
    return t ? `tức ${t.replace(/^Ngày/, "ngày")}` : "";
  }

  // ============= ALBUM: lưới tối đa 6 ô (ô cuối ghi +N), chạm mở trình xem ở đúng ảnh =============

  function _renderGallery(images, focalPoints) {
    const grid = document.getElementById("gallery-grid");
    if (!grid) return;
    const urls = images?.length ? images.map(getImageUrl) : Array.from({ length: 6 }, () => createPlaceholderSVG("Chưa có ảnh"));
    const fp = (i) => cxFocal(focalPoints?.[images?.[i]]);

    const shown = urls.slice(0, 6);
    const more = urls.length - shown.length;
    grid.style.setProperty("--n", shown.length <= 2 ? shown.length : shown.length === 4 ? 2 : 3);
    grid.innerHTML = shown
      .map(
        (u, i) =>
          `<button type="button" class="t4-at" data-t4-lb="${i}" aria-label="Xem ảnh ${i + 1}">
            <img src="${cxImgSrc(u)}" alt="" loading="lazy" style="object-position:${fp(i)}">
            ${more > 0 && i === shown.length - 1 ? `<em>+${more}</em>` : ""}
          </button>`,
      )
      .join("");
    setText("t4-album-count", `${urls.length} ảnh`);

    _buildViewer(urls, fp);
    grid.onclick = (e) => {
      const t = e.target.closest("[data-t4-lb]");
      if (t) _viewer?.open(+t.dataset.t4Lb);
    };
  }

  let _viewer = null;

  // Trình xem album: dải ảnh cuộn ngang có snap, bộ đếm + dải ảnh nhỏ đi theo ảnh đang xem.
  function _buildViewer(urls, fp) {
    const lb = document.getElementById("t4-lb");
    const track = document.getElementById("t4-lbtrack");
    const thumbs = document.getElementById("t4-lbthumbs");
    const n = document.getElementById("t4-lbn");
    if (!lb || !track || !thumbs) return;
    track.innerHTML = urls.map((u, i) => `<img src="${cxImgSrc(u)}" alt="Ảnh cưới ${i + 1}" loading="lazy">`).join("");
    thumbs.innerHTML = urls
      .map(
        (u, i) =>
          `<button type="button" data-t4-lbgo="${i}" aria-label="Ảnh ${i + 1}"><img src="${cxImgSrc(u)}" alt="" loading="lazy" style="object-position:${fp(i)}"></button>`,
      )
      .join("");

    const cur = () => Math.round(track.scrollLeft / (track.clientWidth || 1));
    const go = (i, smooth) => {
      i = Math.max(0, Math.min(urls.length - 1, i));
      track.scrollTo({ left: i * track.clientWidth, behavior: smooth && !RM ? "smooth" : "auto" });
    };
    const sync = () => {
      const i = cur();
      const t = thumbs.children[i];
      if (n) n.textContent = `${i + 1} / ${urls.length}`;
      Array.from(thumbs.children).forEach((b, k) => b.classList.toggle("on", k === i));
      // Dải ảnh nhỏ là khung cuộn lồng nên tự đặt scrollLeft, không dùng scrollIntoView.
      if (t) thumbs.scrollLeft = t.offsetLeft - thumbs.clientWidth / 2 + t.offsetWidth / 2;
    };
    const close = () => {
      lb.classList.remove("open");
      lb.setAttribute("aria-hidden", "true");
    };
    _viewer = {
      open(i) {
        lb.classList.add("open");
        lb.setAttribute("aria-hidden", "false");
        go(i, false);
        sync();
      },
    };

    if (lb._t4Bound) return;
    lb._t4Bound = true;
    track.addEventListener("scroll", sync, { passive: true });
    lb.addEventListener("click", (e) => {
      if (e.target.closest("[data-t4-lbclose]")) return close();
      const st = e.target.closest("[data-t4-lbstep]");
      if (st) return go(cur() + +st.dataset.t4Lbstep, true);
      const g = e.target.closest("[data-t4-lbgo]");
      if (g) go(+g.dataset.t4Lbgo, true);
    });
    document.addEventListener("keydown", (e) => {
      if (!lb.classList.contains("open")) return;
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") go(cur() + (e.key === "ArrowRight" ? 1 : -1), true);
    });
  }

  // ============= BẢN ĐỒ MINH HOẠ (tông tím nhạt) =============

  function _drawMap(label) {
    const box = document.getElementById("t4-map");
    if (!box) return;
    box.innerHTML = `<svg class="t4-svg" viewBox="0 0 320 220" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Bản đồ tới ${escapeHtml(label)}">
      <rect class="m-bg" width="320" height="220"/>
      <path class="m-water" d="M-10 158C50 140 110 180 170 160S270 120 330 140L330 176C270 158 230 200 170 198S60 180-10 196Z"/>
      <rect class="m-park" x="34" y="24" width="64" height="46" rx="8"/>
      <circle class="m-park" cx="268" cy="44" r="24"/>
      <g class="m-roads">
        <path d="M0 100H320"/><path d="M0 38C80 44 200 28 320 34"/>
        <path d="M118 0V220"/><path d="M240 0C236 80 250 150 244 220"/>
        <path d="M60 0C64 70 40 140 70 220"/><path d="M0 128C100 120 180 140 320 126"/>
      </g>
      <g class="m-major"><path d="M0 70C90 76 170 62 320 72"/><path d="M180 0C176 90 190 150 172 220"/></g>
      <path class="m-route" pathLength="1" d="M24 212C40 170 90 150 118 128S170 100 205 104"/>
      <g transform="translate(205 104)">
        <circle class="m-halo" r="16"/>
        <path class="m-drop" d="M0 0C-8-10-10-14-10-19a10 10 0 0 1 20 0c0 5-2 9-10 19Z"/><circle class="m-dot" cy="-19" r="4"/>
      </g>
      <text class="m-label" x="220" y="122">${escapeHtml(label)}</text>
    </svg>`;
  }

  // Nhãn trên bản đồ: đoạn đầu của địa chỉ (tên nhà hàng…), dài quá thì để chữ chung.
  function _shortName(loc) {
    const s = String(loc || "").split(/,|—|–| - /)[0].trim();
    return s && s.length <= 16 ? s : "Điểm hẹn";
  }

  // Tên tỉnh/thành ở cuối địa chỉ cho lời chào cuối thiệp.
  function _city(loc) {
    const parts = String(loc || "").split(",").map((p) => p.trim()).filter(Boolean);
    if (parts.length < 2) return "";
    const c = parts[parts.length - 1].replace(/^(TP\.?|Tp\.?|Thành phố|Tỉnh)\s*/i, "").trim();
    return c.length >= 2 && c.length <= 18 ? c : "";
  }

  // ============= MỪNG CƯỚI: chạm ô kính là kính tan, chạm lại phủ kính =============

  function _bindGlass() {
    const sec = document.getElementById("section-gift");
    if (!sec || sec._t4Glass) return;
    sec._t4Glass = true;
    sec.addEventListener("click", (e) => {
      const g = e.target.closest(".t4-gw");
      if (!g) return;
      g.setAttribute("aria-expanded", g.classList.toggle("is-open"));
    });
  }

  function _date(s) {
    const d = s ? new Date(s + "T00:00:00") : null;
    return d && !isNaN(d.getTime()) ? d : null;
  }
})();
