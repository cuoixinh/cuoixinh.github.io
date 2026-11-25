// Không Cần Ảnh — phong bì chấm bi xanh phấn + hồng phấn, chỉ dùng MỘT ảnh (ảnh bìa); khách không tải ảnh thì
// lấy tranh vẽ cô dâu chú rể của mẫu (DEFAULT_COVER). Chỉ khai báo CX_THEME + renderWedding.

(function () {
  window.CX_THEME = {
    id: "khong-can-anh",
    wishesMode: "card",
    giftBox: "lixi_xanh_hy",
    music: { variant: "mini", chrome: "fixed-corner", art: "couple" },

    // Bộ màu MẶC ĐỊNH của mẫu — bản khai máy đọc được của đúng những giá trị
    // :root trong theme.css (nguồn sự thật). Trang Thiết lập đọc nó để hiện mục
    // "Mặc định"; theme_setting.palette ghi đè lên trên lúc chạy.
    // Sinh lại bằng: node scripts/check-theme-palette.mjs --write
    palette: {
      heading: "#2e3b4e",
      body: "#5d6878",
      accent: "#4a6f96",
      accent_soft: "#cfdced",
      on_accent: "#ffffff",
      on_image: "#ffffff",
      on_lightbox: "#ffffff",
      card_bg: "#fbfaf8",
      page_bg: "#eef2f6",
      surface: "#e9eef4",
      band: "#f3f6f9",
      panel: "#ffffff",
      panel_warm: "#fdfcfa",
      cover: "#f6f8fb",
      cover_mid: "#e7edf4",
      cover_veil: "#e7edf4",
      lightbox_bg: "#000000",
      line: "#dbe3ec",
      shadow: "#2e3b4e",
      scrim: "#000000",
      deco: "#d9798e",
      deco_soft: "#f7dfe4",
      deco_2: "#4a6f96",
      deco_2_soft: "#cfdced",
      shine_from: "#4a6f96",
      shine_mid: "#cfdced",
      shine_to: "#eef3f9",
    },

    swatches: ["#4a6f96", "#7f9cbd", "#2e3b4e", "#5d6878", "#cfdced", "#d9798e", "#f7dfe4", "#eef2f6", "#ffffff"],

    // Tên khoá bộ màu thay mã hex → lời chúc đổi tông theo bộ màu khách chọn.
    wishes: { bubble: "panel", text: "body", accent: "accent", btn: "accent" },

    reveal: [".tv-body > section"],

    skipSteps: ["photos", "timeline", "love_story"],

    loveStory: "short",
    onOpen: null,
  };

  const _isGroom = isGroomSide();

  // Tranh vẽ dùng thay ảnh bìa khi khách không tải ảnh. Worker lấy CÙNG file này làm og:image cho
  // thiệp không ảnh (cờ `fallback_cover` trong assets/data-template/khong-can-anh/data.json) —
  // đổi file thì đổi cả hai. Điểm lấy nét chừa mặt hai nhân vật khi bị cắt khổ.
  const DEFAULT_COVER = "/assets/data-template/khong-can-anh/cover.jpg";
  const DEFAULT_FOCAL = { x: 50, y: 35 };

  function renderWedding(w) {
    if (!w || !w.is_active) return;
    w = _withCover(w);
    const side = _isGroom ? "groom" : "bride";

    // Ảnh màn đầu nhận src TRƯỚC setupMusic (YouTube API đi sau).
    renderCover(w);
    _renderCoverDesk(w);
    renderHero(w, false);
    _watchNames();
    _renderMonogram(...cxCouple(w.groom_name, w.bride_name));

    setupMusic(w.music_url, w.enable_music);

    // --- Gia đình ---
    renderCoupleInfo(w);
    cxToggle("section-family", cxEnabled(w.enable_family));

    // --- Lễ: nhà gái bật Vu Quy thì thay tên lễ + giờ + nơi ---
    const isVuQuy = !_isGroom && cxEnabled(w.vu_quy_enabled);
    const ceremonyName = isVuQuy ? "Lễ Vu Quy" : w.ceremony_name || "Lễ Thành Hôn";
    const ceremonyTime = isVuQuy ? w.vu_quy_time : w.ceremony_time;
    const ceremonyLoc = isVuQuy ? w.vu_quy_location : w.ceremony_location || "";
    setText("ceremony-event-name", ceremonyName);
    renderCeremonyDate(w.ceremony_date, ceremonyTime, w.ceremony_lunar);
    cxToggle("invite-lunar", !!w.ceremony_lunar);
    if (ceremonyLoc) {
      setText("ceremony-location-text", ceremonyLoc);
      cxToggle("ceremony-location-wrap", true);
    }

    // Màn đầu + mẩu giấy cạnh lịch: Thứ · ngày · giờ của lễ (nhà gái bật Vu Quy thì là giờ Vu Quy).
    const cd = w.ceremony_date ? new Date(w.ceremony_date) : null;
    const weekday = cd && !isNaN(cd) ? WEEKDAYS[cd.getDay()] : "";
    setText("tv-hero-weekday", weekday, "------");
    setText("tv-hero-date", _fmtDMY(w.ceremony_date), "--.--.----");
    setText("tv-hero-time", ceremonyTime, "--:--");
    _renderCalendar(w, weekday, ceremonyTime);

    renderMusicSummary(w, { ceremonyName, ceremonyTime, ceremonyLocation: ceremonyLoc });

    // --- Tiệc ---
    const partyDate = w[`${side}_party_date`];
    const partyLunar = w[`${side}_party_lunar`];
    setText("party-section-label", "Tiệc mừng " + ceremonyName.toLowerCase());
    renderPartyDate(partyDate, w[`${side}_party_time`], partyLunar, w[`${side}_party_location`], "full");
    cxToggle("party-lunar", !!partyLunar);
    cxToggle("section-party", cxEnabled(w.enable_party));

    // --- Xác nhận tham dự ---
    const rsvp = document.getElementById("rsvp-section");
    if (rsvp) rsvp.style.display = cxEnabled(w.rsvp_enabled) ? "flex" : "none";

    _watchReply();
    // theme-boot giấu #rsvp-section với khách vãn lai SAU renderWedding → xét lại ở nhịp sau.
    setTimeout(_syncReply);

    // --- Hộp mừng cưới ---
    renderQRCodes(w);
    cxToggle("section-gift", cxEnabled(w.enable_gift));

    // --- Bản đồ ---
    renderVenueMaps(w, side);

    // --- Lời cảm ơn ---
    if (w.footer_text) setText("footer-text", w.footer_text);
    cxToggle("section-footer", cxEnabled(w.enable_footer));
  }

  window.renderWedding = renderWedding;

  // Bản sao thiệp có ảnh bìa: khách chưa tải ảnh (hoặc chỉ có ảnh giữ chỗ SVG của bản xem thử)
  // thì thế tranh vẽ vào. Sao chứ không sửa `w` gốc — helper khác vẫn đọc dữ liệu thật.
  // Cả renderMusicSummary cũng nhận bản này nên nút nhạc (art "couple") hiện tranh vẽ.
  function _withCover(w) {
    const s = String(w.cover_image_url || "").trim();
    if (s && !/^data:image\/svg/i.test(s)) return w;
    return {
      ...w,
      cover_image_url: DEFAULT_COVER,
      image_focal_points: { ...(w.image_focal_points || {}), cover_image_url: DEFAULT_FOCAL },
    };
  }

  // Tên đôi chung một hàng: tràn bề ngang thì thu cỡ chữ (đo từ mép trái tên đầu tới mép
  // phải tên cuối — hàng căn giữa nên tràn ra cả hai phía, scrollWidth không thấy phía trái).
  // Lặp vài lượt vì trái tim + khoảng cách giữ cỡ cố định, không co theo tỉ lệ.
  function _fitNames() {
    const h = document.querySelector(".tv-hero-names");
    if (!h || !h.clientWidth || !h.firstElementChild) return;
    h.style.fontSize = "";
    for (let i = 0; i < 4; i++) {
      const used = h.lastElementChild.getBoundingClientRect().right - h.firstElementChild.getBoundingClientRect().left;
      // Chừa 4% cho nét móc của chữ ký thò ra ngoài khung chữ.
      const room = h.clientWidth * 0.96;
      if (used <= room) return;
      const size = parseFloat(getComputedStyle(h).fontSize);
      h.style.fontSize = Math.max(22, Math.floor((size * room) / used)) + "px";
    }
  }

  // Đo lại khi: thiệp mở (#main-card hết display:none → khổ đổi), đổi khổ màn, font tải
  // xong, hoặc tên bị sửa (applyTextOverrides / sửa trực tiếp). Chỉ đổi style nên không tự gọi lại.
  let _namesOn = false;
  function _watchNames() {
    const h = document.querySelector(".tv-hero-names");
    if (_namesOn || !h) return;
    _namesOn = true;
    let w = 0;
    if (typeof ResizeObserver === "function")
      new ResizeObserver(() => {
        if (h.clientWidth !== w) {
          w = h.clientWidth;
          _fitNames();
        }
      }).observe(h);
    if (typeof MutationObserver === "function")
      new MutationObserver(_fitNames).observe(h, { subtree: true, childList: true, characterData: true });
    // fonts.ready có thể xong TRƯỚC khi Jhodes được đòi tải → chờ đúng font đó, và đo lại mỗi lượt tải font.
    document.fonts?.load('64px "Jhodes"').then(_fitNames, () => {});
    document.fonts?.addEventListener?.("loadingdone", _fitNames);
  }

  // Lịch: tự vẽ (lịch dùng chung viết style inline, không hợp nền sẫm) vào đúng #mini-calendar.
  // Tuần bắt đầu từ Thứ Hai; ngày lễ có trái tim, ngày tiệc khác ngày lễ có chấm nhỏ.
  // Mẩu giấy bên trái ghi ngày lễ to + Thứ + giờ.
  function _renderCalendar(w, weekday, time) {
    const box = document.getElementById("mini-calendar");
    const t = w.ceremony_date ? new Date(w.ceremony_date) : null;
    if (!box || !t || isNaN(t)) return;
    const y = t.getFullYear();
    const m = t.getMonth();
    const p = (n) => String(n).padStart(2, "0");
    setText("bn-cal-day", p(t.getDate()), "--");
    setText("bn-cal-weekday", weekday, "------");
    setText("bn-cal-time", time, "--:--");
    // Tắt mục Tiệc thì khách không được mời tới tiệc → không chấm ngày tiệc.
    const party = cxEnabled(w.enable_party) && w[`${_isGroom ? "groom" : "bride"}_party_date`];
    const pd = party ? new Date(party) : null;
    const partyDay = pd && !isNaN(pd) && pd.getFullYear() === y && pd.getMonth() === m ? pd.getDate() : 0;
    const lead = (new Date(y, m, 1).getDay() + 6) % 7;
    const days = new Date(y, m + 1, 0).getDate();
    let cells = "";
    for (let i = 0; i < lead; i++) cells += "<span></span>";
    for (let d = 1; d <= days; d++) {
      const cls = d === t.getDate() ? "tv-cal-d is-wed" : d === partyDay ? "tv-cal-d is-party" : "tv-cal-d";
      const heart = d === t.getDate() ? '<i data-lucide="heart" class="tv-cal-heart"></i>' : "";
      cells += `<span class="${cls}">${heart}<b>${d}</b></span>`;
    }
    box.innerHTML =
      `<div class="tv-cal-title cx-h">Tháng ${p(m + 1)}.${y}</div>` +
      `<div class="tv-cal-grid tv-cal-head cx-t">${["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((n) => `<span>${n}</span>`).join("")}</div>` +
      `<div class="tv-cal-grid cx-h">${cells}</div>`;
    window.lucide?.createIcons({ root: box });
  }

  // Hồi âm: mục lời chúc (wishes-helper dựng ở cuối thân thiệp, dựng lại khi đổi dạng) dời vào
  // cùng tấm với xác nhận tham dự — helper chỉ tìm mục theo id nên dời chỗ không ảnh hưởng.
  // Cả hai phần đều vắng (khách vãn lai, chưa có lời chúc / dạng dải nổi) thì giấu cả tấm.
  function _syncReply() {
    const sec = document.getElementById("section-rsvp");
    const slot = sec?.querySelector(".tv-reply-wish");
    if (!slot) return;
    const wish = document.getElementById("cx-wish-sec");
    if (wish && wish.parentElement !== slot) slot.appendChild(wish);
    const rsvp = document.getElementById("rsvp-section");
    const hasRsvp = !!rsvp && rsvp.style.display !== "none";
    sec.classList.toggle("tv-has-rsvp", hasRsvp);
    sec.classList.toggle("tv-has-wish", !!wish);
    cxToggle("section-rsvp", hasRsvp || !!wish);
  }

  let _replyWatched = false;
  function _watchReply() {
    if (_replyWatched || typeof MutationObserver !== "function") return;
    const body = document.querySelector(".tv-body");
    const slot = document.querySelector(".tv-reply-wish");
    if (!body || !slot) return;
    _replyWatched = true;
    const mo = new MutationObserver(_syncReply);
    mo.observe(body, { childList: true });
    mo.observe(slot, { childList: true });
  }

  // Chữ lồng (dấu sáp, thư báo hỷ, tấm thiệp chữ, con dấu cuối): chữ cái đầu của TÊN GỌI
  // (từ cuối) hai người — mỗi nơi tự xếp hai chữ theo kiểu của mình ở theme.css.
  function _renderMonogram(groom, bride) {
    const ini = (n) => (String(n || "").trim().split(/\s+/).pop() || "").charAt(0).toUpperCase();
    const g = ini(groom);
    const b = ini(bride);
    const html = g && b ? `<span>${g}</span><span>${b}</span>` : "&";
    document.querySelectorAll("[data-tv-mono]").forEach((el) => (el.innerHTML = html));
  }

  // Phong bì ở bìa: vé ghi ngày dạng dd.mm.yy, cuống vé ghi tên gọi hai người.
  function _renderCoverDesk(w) {
    const t = w.ceremony_date ? new Date(w.ceremony_date) : null;
    const p = (n) => String(n).padStart(2, "0");
    setText(
      "tv-cover-date",
      t && !isNaN(t) ? `${p(t.getDate())}.${p(t.getMonth() + 1)}.${String(t.getFullYear()).slice(-2)}` : "",
      "--.--.--",
    );
    // Cuống vé hẹp: chỉ ghi tên gọi (từ cuối của tên).
    const given = (n) => String(n || "").trim().split(/\s+/).pop();
    setText("tv-stub-groom", given(w.groom_name), "----");
    setText("tv-stub-bride", given(w.bride_name), "----");
    cxCoupleOrder("tv-stub-groom", "tv-stub-bride");
  }

  function _fmtDMY(d) {
    if (!d) return "";
    const t = new Date(d);
    if (isNaN(t)) return "";
    const p = (n) => String(n).padStart(2, "0");
    return `${p(t.getDate())}.${p(t.getMonth() + 1)}.${t.getFullYear()}`;
  }
})();
