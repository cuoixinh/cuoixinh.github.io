// Duyên Lành Gõ Cửa — đỏ son + nhũ vàng kiểu thiệp hỷ truyền thống.
// Không có Lịch trình và Chuyện tình. Chỉ khai báo CX_THEME + renderWedding + phần đặc thù (lịch, album, hồi âm).

(function () {
  window.CX_THEME = {
    id: "duyen-lanh-go-cua",
    wishesMode: "card",
    giftBox: "lixi_do_hy",
    music: { variant: "disc", chrome: "fixed-corner", art: "couple" },

    // Bộ màu MẶC ĐỊNH của mẫu — bản khai máy đọc được của đúng những giá trị
    // :root trong theme.css (nguồn sự thật). Trang Thiết lập đọc nó để hiện mục
    // "Mặc định"; theme_setting.palette ghi đè lên trên lúc chạy.
    // Sinh lại bằng: node scripts/check-theme-palette.mjs --write
    palette: {
      heading: "#6e0d13",
      body: "#5e4239",
      accent: "#b5141e",
      accent_soft: "#e6b9a8",
      on_accent: "#fff6e3",
      on_image: "#ffffff",
      on_lightbox: "#ffffff",
      card_bg: "#fffaf1",
      page_bg: "#f2e2d0",
      surface: "#fbf0e1",
      band: "#fff4e6",
      panel: "#ffffff",
      panel_warm: "#fff7ec",
      cover: "#b5141e",
      cover_mid: "#8c0c14",
      cover_veil: "#4a060a",
      lightbox_bg: "#000000",
      line: "#e5c98c",
      shadow: "#4a060a",
      scrim: "#2a0306",
      deco: "#c9a14a",
      deco_soft: "#f3e1ad",
      deco_2: "#b5141e",
      deco_2_soft: "#f2c4b4",
      shine_from: "#b8862b",
      shine_mid: "#f8de90",
      shine_to: "#b8862b",
    },

    swatches: ["#b5141e", "#8c0c14", "#6e0d13", "#c9a14a", "#f8de90", "#b8862b", "#5e4239", "#e5c98c", "#fffaf1", "#ffffff"],

    // Tên khoá bộ màu thay mã hex → lời chúc đổi tông theo bộ màu khách chọn.
    wishes: { bubble: "panel", text: "body", accent: "accent", btn: "accent" },

    reveal: [".dl-body > section"],
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
    renderHero(w, false);
    _renderCoverPhoto2(w);
    _watchCoverOpen();

    setupMusic(w.music_url, w.enable_music);

    // --- Báo tin + hai họ ---
    renderCoupleInfo(w);
    cxToggle("groom-address", !!w.groom_address);
    cxToggle("bride-address", !!w.bride_address);
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

    // Bìa + màn đầu: Thứ · ngày · giờ của lễ (nhà gái bật Vu Quy thì là giờ Vu Quy).
    const cd = w.ceremony_date ? new Date(w.ceremony_date) : null;
    const dmy = _fmtDMY(w.ceremony_date);
    setText("dl-cover-date", dmy, "--.--.----");
    setText("dl-hero-weekday", cd && !isNaN(cd) ? WEEKDAYS[cd.getDay()] : "", "------");
    setText("dl-hero-date", dmy, "--.--.----");
    setText("dl-hero-time", ceremonyTime, "--:--");

    renderMusicSummary(w, { ceremonyName, ceremonyTime, ceremonyLocation: ceremonyLoc });

    // --- Tiệc ---
    const partyLunar = w[`${side}_party_lunar`];
    setText("party-section-label", "Tiệc mừng " + ceremonyName.toLowerCase());
    renderPartyDate(w[`${side}_party_date`], w[`${side}_party_time`], partyLunar, w[`${side}_party_location`], "full");
    cxToggle("party-lunar", !!partyLunar);
    _renderCalendar(w);
    cxToggle("section-party", cxEnabled(w.enable_party));

    // --- Bản đồ ---
    renderVenueMaps(w, side);

    // --- Xác nhận tham dự ---
    const rsvp = document.getElementById("rsvp-section");
    if (rsvp) rsvp.style.display = cxEnabled(w.rsvp_enabled) ? "flex" : "none";
    _watchReply();
    // theme-boot giấu #rsvp-section với khách vãn lai SAU renderWedding → xét lại ở nhịp sau.
    setTimeout(_syncReply);

    // --- Hộp mừng cưới ---
    renderQRCodes(w);
    cxToggle("section-gift", cxEnabled(w.enable_gift));

    // --- Album ---
    if (cxEnabled(w.enable_photos)) {
      renderGallery(w.gallery_images, w.image_focal_points?.gallery_images);
    } else {
      cxToggle("section-photos", false);
    }

    // --- Lời cảm ơn ---
    if (w.footer_text) setText("footer-text", w.footer_text);
    cxToggle("section-footer", cxEnabled(w.enable_footer));
  }

  window.renderWedding = renderWedding;

  // Mở thiệp kiểu tách đôi: openInvitation (helper) gắn .closing lên #cover-screen rồi 600ms sau giấu nó.
  // Bắt đúng lúc đó (nút mở có cả đường touchend riêng nên không nghe click), chép màn bìa vào hai
  // cánh, mỗi cánh cắt một nửa rồi trượt ra hai bên. Bản chép bỏ id để không trùng phần tử gốc.
  let _coverWatched = false;
  function _watchCoverOpen() {
    const screen = document.getElementById("cover-screen");
    const cover = screen?.querySelector(".dl-cover");
    if (_coverWatched || !cover || typeof MutationObserver !== "function") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    _coverWatched = true;
    const mo = new MutationObserver(() => {
      if (!screen.classList.contains("closing") || cover.classList.contains("dl-split")) return;
      mo.disconnect();
      const leaf = cover.querySelector(".dl-cover-in");
      // Phần tử bị helper giấu bằng CSS theo id (vd tên khách khi chưa có) thì bản chép cũng giấu.
      const hidden = [...leaf.querySelectorAll("*")].map((el) => getComputedStyle(el).display === "none");
      ["dl-door--l", "dl-door--r"].forEach((side) => {
        const door = document.createElement("div");
        door.className = "dl-door " + side;
        door.setAttribute("aria-hidden", "true");
        const copy = leaf.cloneNode(true);
        copy.querySelectorAll("*").forEach((el, i) => {
          if (hidden[i]) el.style.display = "none";
          el.removeAttribute("id");
        });
        // Hai ảnh không tách theo cánh: bản gốc tự bay ra hai bên (theme.css).
        copy.querySelectorAll(".dl-duo-pic").forEach((el) => (el.style.visibility = "hidden"));
        door.appendChild(copy);
        cover.appendChild(door);
      });
      // Chữ Hỷ nằm dưới hai ảnh nên nửa trên cánh cửa bị ảnh che: tách nó thành hai nửa ngay
      // trên lớp ảnh, trượt đúng quãng của cánh cửa (--dl-shift).
      const xi = leaf.querySelector(".dl-duo-xi");
      if (xi) {
        cover.style.setProperty("--dl-shift", Math.round(cover.offsetWidth * 0.51) + "px");
        ["dl-xi-half--l", "dl-xi-half--r"].forEach((side) => {
          const half = xi.cloneNode(true);
          half.classList.remove("open-btn");
          half.removeAttribute("onclick");
          half.classList.add("dl-xi-half", side);
          xi.after(half);
        });
      }
      screen.classList.add("dl-opening");
      cover.classList.add("dl-split");
    });
    mo.observe(screen, { attributes: true, attributeFilter: ["class"] });
  }

  // Ảnh thứ hai ở bìa: ảnh đầu album, không có thì ảnh bìa.
  function _renderCoverPhoto2(w) {
    const first = w.gallery_images?.[0];
    const file = first || w.cover_image_url;
    const fp = first ? w.image_focal_points?.gallery_images?.[first] : w.image_focal_points?.cover_image_url;
    const img = document.getElementById("dl-cover-photo-2");
    if (!img || !file) return;
    img.src = getImageUrl(file);
    img.style.objectPosition = cxFocal(fp);
  }

  function _fmtDMY(d) {
    if (!d) return "";
    const t = new Date(d);
    if (isNaN(t)) return "";
    const p = (n) => String(n).padStart(2, "0");
    return `${p(t.getDate())}.${p(t.getMonth() + 1)}.${t.getFullYear()}`;
  }

  // Lịch tháng cưới: tuần bắt đầu từ Thứ Hai; ngày lễ khoanh tròn son, ngày tiệc khác ngày lễ có chấm nhũ.
  function _renderCalendar(w) {
    const box = document.getElementById("mini-calendar");
    const t = w.ceremony_date ? new Date(w.ceremony_date) : null;
    if (!box || !t || isNaN(t)) return;
    const y = t.getFullYear();
    const m = t.getMonth();
    const party = w[`${_isGroom ? "groom" : "bride"}_party_date`];
    const pd = party ? new Date(party) : null;
    const partyDay = pd && !isNaN(pd) && pd.getFullYear() === y && pd.getMonth() === m ? pd.getDate() : 0;
    const lead = (new Date(y, m, 1).getDay() + 6) % 7;
    const days = new Date(y, m + 1, 0).getDate();
    let cells = "";
    for (let i = 0; i < lead; i++) cells += "<span></span>";
    for (let d = 1; d <= days; d++) {
      const cls = d === t.getDate() ? "dl-cal-d is-wed" : d === partyDay ? "dl-cal-d is-party" : "dl-cal-d";
      cells += `<span class="${cls}"><b>${d}</b></span>`;
    }
    box.innerHTML =
      `<div class="dl-cal-title cx-h">Tháng ${m + 1} · ${y}</div>` +
      `<div class="dl-cal-grid dl-cal-head cx-t">${["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((n) => `<span>${n}</span>`).join("")}</div>` +
      `<div class="dl-cal-grid cx-t">${cells}</div>`;
  }

  // Hồi âm: mục lời chúc (wishes-helper dựng ở cuối thân thiệp, dựng lại khi đổi dạng) dời vào
  // cùng tấm với xác nhận tham dự. Cả hai phần đều vắng thì giấu cả tấm.
  function _syncReply() {
    const sec = document.getElementById("section-rsvp");
    const slot = sec?.querySelector(".dl-reply-wish");
    if (!slot) return;
    const wish = document.getElementById("cx-wish-sec");
    if (wish && wish.parentElement !== slot) slot.appendChild(wish);
    const rsvp = document.getElementById("rsvp-section");
    const hasRsvp = !!rsvp && rsvp.style.display !== "none";
    sec.classList.toggle("dl-has-rsvp", hasRsvp);
    sec.classList.toggle("dl-has-wish", !!wish);
    cxToggle("section-rsvp", hasRsvp || !!wish);
  }

  let _replyWatched = false;
  function _watchReply() {
    if (_replyWatched || typeof MutationObserver !== "function") return;
    const body = document.querySelector(".dl-body");
    const slot = document.querySelector(".dl-reply-wish");
    if (!body || !slot) return;
    _replyWatched = true;
    const mo = new MutationObserver(_syncReply);
    mo.observe(body, { childList: true });
    mo.observe(slot, { childList: true });
  }

  // Album: lưới 2 cột — tấm đầu mỗi cụm 3 ảnh tràn ngang, hai tấm sau đứng cạnh nhau.
  // Cụm cuối thiếu một ảnh thì tấm lẻ tràn ngang cho khỏi hở.
  function renderGallery(images, focalPoints) {
    const grid = document.getElementById("gallery-grid");
    if (!grid) return;
    const urls = images?.length
      ? images.map(getImageUrl)
      : Array(3)
          .fill(null)
          .map(() => createPlaceholderSVG("Chưa có ảnh"));

    lightboxImages.length = 0;
    lightboxImages.push(...urls);

    grid.innerHTML = "";
    const n = urls.length;
    urls.forEach((url, i) => {
      const wide = i % 3 === 0 || (i === n - 1 && i % 3 === 1);
      const fp = focalPoints?.[images?.[i]];
      const cell = document.createElement("div");
      cell.className = "dl-gal" + (wide ? " dl-gal--wide" : "");
      cell.innerHTML = `<img src="${cxImgSrc(url)}" alt="" style="object-position:${cxFocal(fp)}">`;
      cell.addEventListener("click", () => openLightbox(i));
      grid.appendChild(cell);
    });
  }
})();
