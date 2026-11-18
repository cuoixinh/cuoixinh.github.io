// Thuận Vợ Thuận Chồng — đỏ rượu + xanh olive; bìa là phong bì mở, thân thiệp là "đồ trong phong bì".
// Nội dung gọn: đủ mục trừ Lịch trình và Chuyện tình; không dùng câu slogan (story_quote). Chỉ khai báo CX_THEME + renderWedding.

(function () {
  window.CX_THEME = {
    id: "thuan-vo-thuan-chong",
    wishesMode: "card",
    giftBox: "phongbi_do_hy",
    music: { variant: "mini", chrome: "fixed-corner", art: "couple" },

    // Bộ màu MẶC ĐỊNH của mẫu — bản khai máy đọc được của đúng những giá trị
    // :root trong theme.css (nguồn sự thật). Trang Thiết lập đọc nó để hiện mục
    // "Mặc định"; theme_setting.palette ghi đè lên trên lúc chạy.
    // Sinh lại bằng: node scripts/check-theme-palette.mjs --write
    palette: {
      heading: "#3e1f24",
      body: "#6e5256",
      accent: "#7b1e2f",
      accent_soft: "#e8c4c8",
      on_accent: "#ffffff",
      on_image: "#ffffff",
      on_lightbox: "#ffffff",
      card_bg: "#fbf7f5",
      page_bg: "#f3ece9",
      surface: "#efe6e3",
      band: "#f7eeec",
      panel: "#ffffff",
      panel_warm: "#fdf9f6",
      cover: "#f8f3f1",
      cover_mid: "#efe5e2",
      cover_veil: "#efe5e2",
      lightbox_bg: "#000000",
      line: "#e6d6d4",
      shadow: "#3e1f24",
      scrim: "#000000",
      deco: "#8f9a5e",
      deco_soft: "#dfe3cc",
      deco_2: "#7b1e2f",
      deco_2_soft: "#e8c4c8",
      shine_from: "#7b1e2f",
      shine_mid: "#e8c4c8",
      shine_to: "#f6e8e9",
    },

    swatches: ["#7b1e2f", "#a64a5a", "#3e1f24", "#6e5256", "#e8c4c8", "#8f9a5e", "#e6d6d4", "#f3ece9", "#ffffff"],

    wishes: { bubble: "#ffffff", text: "#6e5256", accent: "#7b1e2f", btn: "#7b1e2f" },

    reveal: [".tv-body > section"],
    revealItems: ["#gallery-grid > div"],

    skipSteps: ["timeline", "love_story"],

    loveStory: "short",
    onOpen: null,
  };

  const _isGroom = isGroomSide();

  function renderWedding(w) {
    if (!w || !w.is_active) return;
    const side = _isGroom ? "groom" : "bride";

    // Ảnh màn đầu nhận src TRƯỚC setupMusic (YouTube API đi sau).
    renderCover(w);
    _renderCoverDesk(w);
    renderHero(w, false);
    _watchNames();
    _renderHeroSnaps(w);
    _renderMonogram(w.groom_name, w.bride_name);

    setupMusic(w.music_url, w.enable_music);

    // --- Gia đình ---
    renderCoupleInfo(w);
    _renderCalendar(w);
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

    // Màn đầu: Thứ · ngày · giờ của lễ (nhà gái bật Vu Quy thì là giờ Vu Quy).
    const cd = w.ceremony_date ? new Date(w.ceremony_date) : null;
    setText("tv-hero-weekday", cd && !isNaN(cd) ? WEEKDAYS[cd.getDay()] : "", "------");
    setText("tv-hero-date", _fmtDMY(w.ceremony_date), "--.--.----");
    setText("tv-hero-time", ceremonyTime, "--:--");

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

    // --- Album ---
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

    // --- Lời cảm ơn ---
    if (w.footer_text) setText("footer-text", w.footer_text);
    cxToggle("section-footer", cxEnabled(w.enable_footer));
  }

  window.renderWedding = renderWedding;

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

  // Ảnh rời ở màn đầu: lấy ảnh album từ tấm thứ hai (tấm đầu đã nằm trên bìa), thiếu thì lặp vòng.
  const _HERO_SNAPS = ["tv-hero-p1", "tv-hero-p2", "tv-hero-p3", "tv-hero-p4", "tv-hero-p5"];
  function _renderHeroSnaps(w) {
    const g = (w.gallery_images || []).filter(Boolean);
    const pool = g.length > 1 ? g.slice(1) : g.length ? g : [w.cover_image_url].filter(Boolean);
    if (!pool.length) return;
    _HERO_SNAPS.forEach((id, i) => {
      const el = document.getElementById(id);
      const file = pool[i % pool.length];
      if (!el) return;
      el.src = getImageUrl(file);
      el.style.objectPosition = cxFocal(w.image_focal_points?.gallery_images?.[file]);
    });
    _heroParallax();
  }

  // Chiều sâu khi cuộn: ghi quãng đã cuộn vào --tv-par, mỗi lớp ảnh tự nhân với hệ số
  // --tv-depth của nó (theme.css) — lớp gần trôi nhanh, lớp xa trôi chậm.
  let _parOn = false;
  function _heroParallax() {
    const box = document.querySelector(".tv-scatter");
    if (_parOn || !box || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    _parOn = true;
    let raf = 0;
    const run = () => {
      raf = 0;
      box.style.setProperty("--tv-par", String(Math.min(window.scrollY, 900) | 0));
    };
    window.addEventListener("scroll", () => raf || (raf = requestAnimationFrame(run)), { passive: true });
  }

  // Lịch: tự vẽ (lịch dùng chung viết style inline, không hợp nền sẫm) vào đúng #mini-calendar.
  // Tuần bắt đầu từ Thứ Hai; ngày lễ có trái tim, ngày tiệc khác ngày lễ có chấm nhỏ.
  // Ảnh bên cạnh lấy tấm album kế sau năm ảnh ở màn đầu.
  function _renderCalendar(w) {
    const box = document.getElementById("mini-calendar");
    const t = w.ceremony_date ? new Date(w.ceremony_date) : null;
    if (!box || !t || isNaN(t)) return;
    const y = t.getFullYear();
    const m = t.getMonth();
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
    const p = (n) => String(n).padStart(2, "0");
    box.innerHTML =
      `<div class="tv-cal-title cx-h">Tháng ${p(m + 1)}.${y}</div>` +
      `<div class="tv-cal-grid tv-cal-head cx-t">${["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((n) => `<span>${n}</span>`).join("")}</div>` +
      `<div class="tv-cal-grid cx-h">${cells}</div>`;
    window.lucide?.createIcons({ root: box });

    const g = (w.gallery_images || []).filter(Boolean);
    const pool = g.length > 1 ? g.slice(1) : g.length ? g : [w.cover_image_url].filter(Boolean);
    const img = document.getElementById("tv-cal-photo");
    if (img && pool.length) {
      const file = pool[5 % pool.length];
      img.src = getImageUrl(file);
      img.style.objectPosition = cxFocal(w.image_focal_points?.gallery_images?.[file]);
    }
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

  // Chữ lồng trên con dấu: chữ cái đầu của TÊN GỌI (từ cuối) hai người, xếp dọc kiểu triện.
  function _renderMonogram(groom, bride) {
    const ini = (n) => (String(n || "").trim().split(/\s+/).pop() || "").charAt(0).toUpperCase();
    const g = ini(groom);
    const b = ini(bride);
    const html = g && b ? `<span>${g}</span><span>${b}</span>` : "&";
    document.querySelectorAll("[data-tv-mono]").forEach((el) => (el.innerHTML = html));
  }

  // Phong bì ở bìa: ảnh phải lấy ảnh đầu album (không có thì ảnh bìa), vé ghi ngày dạng dd.mm.yy.
  function _renderCoverDesk(w) {
    const first = w.gallery_images?.[0];
    const file = first || w.cover_image_url;
    const fp = first
      ? w.image_focal_points?.gallery_images?.[first]
      : w.image_focal_points?.cover_image_url;
    const back = document.getElementById("tv-cover-photo-2");
    if (back && file) {
      back.src = getImageUrl(file);
      back.style.objectPosition = cxFocal(fp);
    }
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
  }

  function _fmtDMY(d) {
    if (!d) return "";
    const t = new Date(d);
    if (isNaN(t)) return "";
    const p = (n) => String(n).padStart(2, "0");
    return `${p(t.getDate())}.${p(t.getMonth() + 1)}.${t.getFullYear()}`;
  }

  // Album khít: lưới 3 cột hàng vuông, mỗi cụm 5 ảnh lấp kín khối 3×4 ô — a to 2×2 · b đứng 1×2 ·
  // c nhỏ 1×1 · d to 2×2 · e nhỏ 1×1; cụm sau lật gương (.is-flip). Cụm cuối thiếu ảnh thì giãn
  // ảnh cuối cho khỏi hở: còn 1 hoặc 3 ảnh → ảnh cuối tràn ngang (f), còn 4 → c thành ô đứng (g).
  // `r` = ô nằm nửa phải → ảnh bay vào từ mép phải (.tv-gal--r).
  const _GAL = [
    { k: "a", r: false },
    { k: "b", r: true },
    { k: "c", r: false },
    { k: "d", r: true },
    { k: "e", r: false },
  ];
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

    grid.innerHTML = "";
    const n = urls.length;
    const tail = n % 5;
    const tailStart = n - tail;
    urls.forEach((url, i) => {
      const t = _GAL[i % 5];
      const flip = Math.floor(i / 5) % 2 === 1;
      let k = t.k;
      let right = t.r !== flip;
      if (i >= tailStart && (tail === 1 || tail === 3) && i === n - 1) {
        k = "f";
        right = false;
      } else if (i >= tailStart && tail === 4 && t.k === "c") k = "g";
      const fp = focalPoints?.[images?.[i]];
      const cell = document.createElement("div");
      cell.className = `tv-gal tv-gal--${k}` + (flip ? " is-flip" : "") + (right ? " tv-gal--r" : "");
      cell.innerHTML = `<img src="${cxImgSrc(url)}" alt="" style="object-position:${cxFocal(fp)}">`;
      cell.addEventListener("click", () => openLightbox(i));
      grid.appendChild(cell);
    });
  }
})();
