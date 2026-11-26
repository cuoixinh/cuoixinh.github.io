// Duyên Lành Gõ Cửa — đỏ son + nhũ vàng kiểu thiệp hỷ truyền thống.
// Không có Lịch trình và Chuyện tình. Chỉ khai báo CX_THEME + renderWedding + phần đặc thù (lịch, album, hồi âm).

(function () {
  window.CX_THEME = {
    id: "duyen-lanh-go-cua",
    // Lời chúc vẽ riêng thành trang thư tay (theme.css, khối Hồi âm) trên nền dạng "paged" — cố định
    // dạng để lựa chọn ở trang Thiết lập không làm vỡ bản vẽ đó.
    wishesMode: "paged",
    wishesFixed: true,
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
      cover: "#6d1628",
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

    // Tên khoá bộ màu thay mã hex → lời chúc đổi tông theo bộ màu khách chọn. Nhấn = màu tiêu đề
    // (đỏ rượu sẫm) cho cùng tông các mảng đỏ rượu của thiệp, không dùng đỏ son.
    wishes: { bubble: "panel", text: "body", accent: "heading", btn: "heading" },

    // Trừ hero: nó hiện sẵn sau cánh cửa lúc mở bìa, không bay vào lần nữa.
    reveal: [".dl-body > section:not(#section-hero)"],

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
    _plan = _planPhotos(w);
    _renderHeroPhotos();
    _fitHeroNames();
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

    // Mục Lễ: ba ảnh + khối ngày ba cột "14 giờ 00 | thứ · ngày · tháng | Năm 2027".
    _renderTrio();
    const okDate = cd && !isNaN(cd);
    setText("dl-inv-time", _fmtGio(ceremonyTime), "--");
    setText("dl-inv-month", okDate ? "Tháng " + (cd.getMonth() + 1) : "", "Tháng --");
    setText("dl-inv-year", okDate ? "Năm " + cd.getFullYear() : "", "Năm ----");

    renderMusicSummary(w, { ceremonyName, ceremonyTime, ceremonyLocation: ceremonyLoc });

    // --- Tiệc ---
    const partyLunar = w[`${side}_party_lunar`];
    setText("party-section-label", "Tiệc mừng " + ceremonyName.toLowerCase());
    renderPartyDate(w[`${side}_party_date`], w[`${side}_party_time`], partyLunar, w[`${side}_party_location`], "split");
    cxToggle("party-lunar", !!partyLunar);
    setText("dl-party-dmy", _fmtDMY(w[`${side}_party_date`]), "--.--.----");
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
    // Album chỉ nhận những tấm chưa dùng ở chỗ khác; mọi tấm đã dùng hết thì giấu mục.
    const albumLeft = _plan.album.length || !_plan.total;
    if (cxEnabled(w.enable_photos) && albumLeft) {
      renderGallery(
        _plan.album.map((p) => p.f),
        w.image_focal_points?.gallery_images,
      );
    } else {
      cxToggle("section-photos", false);
    }

    // --- Lời cảm ơn ---
    _renderFootPhoto();
    if (w.footer_text) setText("footer-text", w.footer_text);
    cxToggle("section-footer", cxEnabled(w.enable_footer));

    _unveilPhotos();
  }

  window.renderWedding = renderWedding;

  // Lời mời đích danh ở mục Lễ: chép danh xưng + tên khách mà helper đã đổ vào màn bìa (link ?g=,
  // link mã hoá cũ, ?name=&rel= của bản xem thử) — một nguồn cho mọi đường. Danh xưng = phần
  // greet() nối thêm sau câu gốc (dataset.cxInvite) của dòng [data-cx-invite] trên bìa.
  function _syncGuestLine() {
    const out = document.getElementById("dl-guest-name");
    if (!out) return;
    const nameEl = document.getElementById("cover-guest-name");
    const inv = document.querySelector("#cover-screen [data-cx-invite]");
    const base = inv?.dataset.cxInvite || "";
    const text = (inv?.textContent || "").trim();
    const rel = base && text.startsWith(base) ? text.slice(base.length).trim() : "";
    const name = (nameEl?.textContent || "").trim();
    const generic = document.documentElement.classList.contains("cx-guest-generic");
    out.textContent = !generic && base && name ? `${rel} ${name}`.trim() : "Quý Khách";
  }

  (function _watchGuest() {
    _syncGuestLine();
    if (typeof MutationObserver !== "function") return;
    const mo = new MutationObserver(_syncGuestLine);
    const opts = { childList: true, characterData: true, subtree: true };
    const nameEl = document.getElementById("cover-guest-name");
    const inv = document.querySelector("#cover-screen [data-cx-invite]");
    if (nameEl) mo.observe(nameEl, opts);
    if (inv) mo.observe(inv, opts);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  })();

  // Mở thiệp kiểu tách đôi: openInvitation (helper) gắn .closing lên #cover-screen rồi 600ms sau giấu nó.
  // Bắt đúng lúc đó (nút mở có cả đường touchend riêng nên không nghe click), chép màn bìa vào hai
  // cánh, mỗi cánh cắt một nửa rồi trượt ra hai bên. Bản chép bỏ id để không trùng phần tử gốc.
  // Thân thiệp hiện sẵn sau cánh cửa (cửa mở là thấy hero); cờ .dl-opening giữ bìa hiện quá mốc
  // 600ms đó, cánh mở hết mới gỡ.
  const DL_OPEN_MS = 1800; // = thời lượng .dl-door ở theme.css
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
        door.appendChild(copy);
        cover.appendChild(door);
      });
      // Chữ Hỷ nổi trên mép ảnh: tách nó thành hai nửa ở lớp trên cùng, trượt đúng quãng của cánh cửa (--dl-shift).
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
      _heroAt = Date.now() + DL_OPEN_MS * 0.45;
      const main = document.getElementById("main-card");
      if (main) {
        main.classList.add("dl-shown");
        main.style.display = "";
      }
      window.scrollTo({ top: 0 });
      screen.classList.add("dl-opening");
      cover.classList.add("dl-split");
      setTimeout(() => {
        screen.classList.remove("dl-opening");
        main?.classList.remove("dl-shown");
      }, DL_OPEN_MS);
    });
    mo.observe(screen, { attributes: true, attributeFilter: ["class"] });
  }

  // Mọi khung ảnh bay vào khi cuộn tới (CSS .dl-uv ở theme.css): khung lệch trái bay từ trái, lệch phải
  // bay từ phải, khung giữa/tràn khổ bay từ dưới lên. Ảnh mở đầu chờ cửa bìa mở được nửa chừng
  // (_heroAt). Khung đã nằm trên màn (cuộn tới bằng liên kết) thì hiện luôn.
  const DL_UV = ".dl-pic, .dl-trio-pic, .dl-wall-photo, .dl-gal, .dl-foot-photo";
  let _uvIO = null;
  let _heroAt = 0;
  function _unveilPhotos() {
    const els = [...document.querySelectorAll(DL_UV)].filter((el) => !el.classList.contains("dl-uv"));
    const open = (el) => el.classList.add("dl-uv-in");
    els.forEach((el) => el.classList.add("dl-uv"));
    if (typeof IntersectionObserver !== "function") return els.forEach(open);
    _uvIO ||= new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const r = entry.boundingClientRect;
          // Cao 0 = #main-card còn ẩn sau bìa; nằm dưới màn mà chưa chạm thì chờ.
          if (!r.height || (!entry.isIntersecting && r.top > 0)) return;
          const el = entry.target;
          _uvIO.unobserve(el);
          // Hướng bay đo lúc khung đã có khổ thật. Đổi điểm xuất phát với transition tắt + đọc lại style,
          // không thì trình duyệt coi đó là một lần chuyển động và ảnh bay thẳng từ hướng mặc định.
          const vw = document.documentElement.clientWidth || 1;
          const mid = (r.left + r.width / 2) / vw;
          el.style.transition = "none";
          el.dataset.dlFrom = r.width / vw > 0.7 ? "b" : mid < 0.42 ? "l" : mid > 0.58 ? "r" : "b";
          void getComputedStyle(el).translate;
          el.style.transition = "";
          const wait = el.closest(".dl-hero") ? _heroAt - Date.now() : 0;
          if (wait > 0) setTimeout(() => open(el), wait);
          else open(el);
        });
      },
      { threshold: 0, rootMargin: "0px 0px -10% 0px" },
    );
    els.forEach((el) => _uvIO.observe(el));
  }

  // Phân ảnh cho cả thiệp, mỗi tấm dùng đúng MỘT lần từ đầu tới cuối — trừ ảnh bìa (ảnh đôi), dùng chung
  // cho màn bìa và ảnh lớn mở đầu. Ảnh album lần lượt vào: ảnh chân thiệp → ảnh nhỏ mở đầu → ba ảnh mục
  // Lễ (đủ ba mới hiện) → ảnh lịch treo tường; còn lại vào Album. Thiếu ảnh thì chỗ xếp sau để trống
  // (ẩn) chứ không dùng lại tấm đã dùng.
  let _plan = { album: [], total: 0 };
  function _planPhotos(w) {
    const fps = w.image_focal_points || {};
    const seen = new Set();
    const pool = [];
    const add = (f, fp) => {
      if (!f || seen.has(f)) return;
      seen.add(f);
      pool.push({ f, fp });
    };
    add(w.cover_image_url, fps.cover_image_url);
    (Array.isArray(w.gallery_images) ? w.gallery_images : []).forEach((f) => add(f, fps.gallery_images?.[f]));
    let i = w.cover_image_url ? 1 : 0;
    const take = (n) => {
      if (pool.length - i < n) return null;
      i += n;
      return pool.slice(i - n, i);
    };
    const heroMain = w.cover_image_url ? pool[0] : take(1)?.[0] || null;
    const foot = take(1)?.[0] || null;
    const heroSub = take(1)?.[0] || null;
    const trio = take(3) || [];
    const wall = take(1)?.[0] || null;
    return { heroMain, foot, heroSub, trio, wall, album: pool.slice(i), total: pool.length };
  }

  function _setPhoto(img, p) {
    if (!img || !p) return;
    img.src = cxImgSrc(getImageUrl(p.f));
    img.style.objectPosition = cxFocal(p.fp);
  }

  // Mở đầu: ảnh lớn là ảnh bìa (thiệp không có ảnh bìa thì tấm album đầu); không có ảnh nhỏ thì
  // .dl-solo, chỉ còn ảnh lớn ở giữa.
  function _renderHeroPhotos() {
    _setPhoto(document.getElementById("main-photo"), _plan.heroMain);
    _setPhoto(document.getElementById("dl-hero-photo2"), _plan.heroSub);
    document.querySelector(".dl-hero-pics")?.classList.toggle("dl-solo", !_plan.heroSub);
  }

  // Tên đôi ở mở đầu luôn một hàng: tràn thì thu cỡ chữ theo tỉ lệ. Lúc dựng #main-card còn ẩn (rộng 0)
  // nên đo lại qua ResizeObserver khi nó hiện, và khi font viết tay tải xong.
  let _namesRO = null;
  function _fitHeroNames() {
    const h = document.querySelector(".dl-hero-names");
    if (!h) return;
    const fit = () => {
      h.style.fontSize = "";
      const w = h.clientWidth;
      if (!w || h.scrollWidth <= w) return;
      const base = parseFloat(getComputedStyle(h).fontSize);
      h.style.fontSize = Math.max(20, Math.floor((base * w) / h.scrollWidth)) + "px";
    };
    fit();
    document.fonts?.ready.then(fit);
    if (!_namesRO && typeof ResizeObserver === "function") {
      _namesRO = new ResizeObserver(fit);
      _namesRO.observe(h);
    }
  }

  // "14:00" → "14 giờ 00"; chuỗi khác khuôn thì giữ nguyên.
  function _fmtGio(t) {
    const m = /^(\d{1,2}):(\d{2})/.exec(String(t || "").trim());
    return m ? `${m[1]} giờ ${m[2]}` : t || "";
  }

  // Ba ảnh mục Lễ: không đủ ba tấm chưa dùng thì ẩn cả dải.
  function _renderTrio() {
    [1, 2, 3].forEach((n, i) => _setPhoto(document.getElementById(`dl-trio-${n}`), _plan.trio[i]));
    document.querySelector(".dl-trio")?.classList.toggle("hidden", _plan.trio.length < 3);
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
    cxToggle("dl-wall", !!t && !isNaN(t));
    if (!box || !t || isNaN(t)) return;
    _renderWall();
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

  // Ảnh chân thiệp; hết ảnh thì .dl-foot--bare: bỏ ảnh, dải chữ thành tấm đỏ rượu đứng riêng.
  function _renderFootPhoto() {
    _setPhoto(document.getElementById("dl-foot-img"), _plan.foot);
    document.getElementById("section-footer")?.classList.toggle("dl-foot--bare", !_plan.foot);
  }

  // Ảnh lịch treo tường; hết ảnh thì bỏ khung ảnh, chỉ còn tờ lịch.
  function _renderWall() {
    _setPhoto(document.getElementById("dl-wall-img"), _plan.wall);
    document.querySelector(".dl-wall-photo")?.classList.toggle("hidden", !_plan.wall);
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

  // Album: tấm đầu rộng hết khổ (.dl-gal--lead), còn lại xếp hai cột so le bằng CSS columns —
  // tỉ lệ khung đan xen theo vị trí ở theme.css, nên chỉ đánh dấu tấm đầu.
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
    urls.forEach((url, i) => {
      const fp = focalPoints?.[images?.[i]];
      const cell = document.createElement("div");
      // Tấm đầu tràn khổ chỉ khi số ảnh lẻ — phần còn lại luôn đủ cặp cho hai cột.
      cell.className = "dl-gal" + (i === 0 && urls.length % 2 ? " dl-gal--lead" : "");
      cell.innerHTML = `<img src="${cxImgSrc(url)}" alt="" style="object-position:${cxFocal(fp)}">`;
      cell.addEventListener("click", () => openLightbox(i));
      grid.appendChild(cell);
    });
  }
})();
