// Chung Một Giai Điệu — màn "đang phát" của ứng dụng nghe nhạc: ảnh cưới làm bìa album,
// thanh tiến trình là quãng từ ngày quen tới ngày cưới, chuyện tình chạy thành lời bài hát.
// Chỉ khai báo CX_THEME + renderWedding; phần chạy nằm ở core/helpers/theme-boot.js.

(function () {
  window.CX_THEME = {
    id: "chung-mot-giai-dieu",
    wishesMode: "spotlight",
    // Hàng chạm kèm ảnh bìa — cùng chất "đang phát" với màn mở đầu.
    giftBox: "the_qua_mung",
    music: { variant: "disc", chrome: "fixed-corner", art: "couple" },

    // Bộ màu MẶC ĐỊNH của mẫu — bản khai máy đọc được của đúng những giá trị
    // :root trong theme.css (nguồn sự thật). Trang Thiết lập đọc nó để hiện mục
    // "Mặc định"; theme_setting.palette ghi đè lên trên lúc chạy.
    // Sinh lại bằng: node scripts/check-theme-palette.mjs --write
    palette: {
      heading: "#ffffff",
      body: "#b3a8ab",
      accent: "#8e4b5c",
      accent_soft: "#c98a9a",
      on_accent: "#ffffff",
      on_image: "#ffffff",
      on_lightbox: "#ffffff",
      card_bg: "#1a1416",
      page_bg: "#120e0f",
      surface: "#2a2124",
      band: "#3a2e37",
      panel: "#2a2124",
      panel_warm: "#33302a",
      cover: "#1a1416",
      cover_mid: "#2a2124",
      cover_veil: "#000000",
      lightbox_bg: "#000000",
      line: "#463a3e",
      shadow: "#000000",
      scrim: "#000000",
      deco: "#6e5c62",
      deco_soft: "#c98a9a",
      deco_2: "#8e4b5c",
      deco_2_soft: "#c98a9a",
      shine_from: "#c98a9a",
      shine_mid: "#e8c4cd",
      shine_to: "#8e4b5c",
    },

    loveStory: "short",
    onOpen: null,
  };

  const _isGroom = isGroomSide();
  const RM = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const WD = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
  const pad = (n) => String(n).padStart(2, "0");
  // Tên gọi trong tiêu đề album: chữ cuối của họ tên ("Bảo Ngọc" → "Ngọc").
  const short = (s) => String(s || "").trim().split(/\s+/).pop() || "----";

  function renderWedding(w) {
    if (!w || !w.is_active) return;
    const side = _isGroom ? "groom" : "bride";
    const names = _isGroom ? [w.groom_name, w.bride_name] : [w.bride_name, w.groom_name];

    const isVuQuy = !_isGroom && cxEnabled(w.vu_quy_enabled);
    const ceremonyName = isVuQuy ? "Lễ Vu Quy" : w.ceremony_name || "Lễ Thành Hôn";
    const ceremonyTime = isVuQuy ? w.vu_quy_time : w.ceremony_time;
    const ceremonyLoc = isVuQuy ? w.vu_quy_location : w.ceremony_location || "";
    const cd = _date(w.ceremony_date);

    // --- Mở đầu: ảnh bìa album TRƯỚC setupMusic (ảnh màn đầu không xếp hàng sau YouTube API) ---
    renderHero(w, false);
    const coverUrl = w.cover_image_url ? getImageUrl(w.cover_image_url) : "";
    const bg = document.querySelector(".cm-bg");
    if (bg) bg.style.backgroundImage = coverUrl ? `url("${cxImgSrc(coverUrl)}")` : "";

    const title = `Đám cưới của ${short(names[0])} & ${short(names[1])}`;
    setText("cm-album", cd ? `Đám cưới ${cd.getFullYear()}` : "Đám cưới");
    setText("cm-title", title);
    setText("cm-end-title", title);
    setText("cm-name-1", names[0], "----------");
    setText("cm-name-2", names[1], "----------");
    if (window.CX_GUEST) cxToggle("cover-guest-wrap", true);
    _progress(w, cd);
    _bindHero();

    setupMusic(w.music_url, w.enable_music);
    renderMusicSummary(w, { ceremonyName, ceremonyTime, ceremonyLocation: ceremonyLoc });
    _syncPlay(cxEnabled(w.enable_music) && !!w.music_url);

    // --- Lời bài hát ---
    _renderLyrics(cxEnabled(w.enable_love_story) ? w.love_story : [], w.story_quote);

    // --- Sự kiện sắp tới ---
    _renderEvents(w, side, {
      name: ceremonyName,
      time: ceremonyTime,
      loc: ceremonyLoc,
      map: isVuQuy ? w.vu_quy_map_embed_url : w.ceremony_map_embed_url,
    });
    if (ceremonyLoc) _drawMap(ceremonyName, ceremonyLoc);
    else _drawMap("Tiệc cưới", w[`${side}_party_location`]);

    // --- Danh sách phát (lịch trình) ---
    _renderTracks(w, side);

    // --- Album ---
    if (cxEnabled(w.enable_photos)) {
      renderGallery(w.gallery_images, w.image_focal_points?.gallery_images);
    } else {
      cxToggle("section-photos", false);
    }

    // --- Thực hiện ---
    setText("cm-credit-names", names.filter(Boolean).join(", "), "----------");
    const familyOn = cxEnabled(w.enable_family);
    const sides = _isGroom ? ["groom", "bride"] : ["bride", "groom"];
    sides.forEach((s, i) => {
      const line = _parents(w[`${s}_father`], w[`${s}_mother`]);
      const slot = i === 0 ? "groom" : "bride";
      setText(`cm-credit-${slot}-label`, i === 0 ? "Sản xuất" : "Đồng sản xuất");
      setText(`cm-credit-${slot}`, line, "----------");
      cxToggle(`cm-credit-${slot}-wrap`, familyOn && !!line);
    });
    const release = [
      cd ? `${pad(cd.getDate())}.${pad(cd.getMonth() + 1)}.${cd.getFullYear()}` : "",
      [ceremonyName.toLowerCase(), ceremonyTime].filter(Boolean).join(" "),
    ].filter(Boolean);
    setText("cm-release", release.join(", ") + (w.ceremony_lunar ? `\n${w.ceremony_lunar}` : ""), "----------");

    // --- Xác nhận tham dự ---
    const rsvp = document.getElementById("rsvp-section");
    if (rsvp) rsvp.style.display = cxEnabled(w.rsvp_enabled) ? "" : "none";
    if (w.rsvp_message) {
      setText("rsvp-custom-message", w.rsvp_message);
      cxToggle("rsvp-custom-message", true);
    }

    // --- Quà mừng ---
    renderQRCodes(w);
    cxToggle("section-gift", cxEnabled(w.enable_gift));

    // --- Lời cảm ơn ---
    if (w.footer_text) {
      setText("footer-text", w.footer_text);
      cxToggle("footer-text", true);
    }
    cxToggle("section-footer", cxEnabled(w.enable_footer));

    // Không có màn bìa nên hiệu ứng mở đầu chạy ngay khi đã có dữ liệu.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => document.getElementById("main-card")?.classList.add("cm-live")),
    );
  }

  window.renderWedding = renderWedding;

  // ============= THANH TIẾN TRÌNH: quãng đã yêu / tổng tới ngày cưới =============
  // Chữ bên trái ghi NGUYÊN ô ngày của mốc chuyện tình đầu tiên ("Mùa hè 2018"); thanh chỉ
  // mượn năm trong đó để tính độ dài, không có năm thì dừng ở 80%. Trần
  // CM_PROG_MAX: thanh chạm hết trông như bài đã phát xong, kể cả khi hôm nay là ngày cưới.

  const CM_PROG_MAX = 0.9;

  function _progress(w, until) {
    const card = document.getElementById("main-card");
    const first = cxEnabled(w.enable_love_story) ? String(w.love_story?.[0]?.date || "").trim() : "";
    const y = first.match(/\d{4}/);
    const since = y ? new Date(+y[0], 0, 1) : null;
    const now = new Date();
    let p = 0.8;
    if (since && until && until > since) p = Math.min(CM_PROG_MAX, Math.max(0, (now - since) / (until - since)));
    card?.style.setProperty("--cm-p", (p * 100).toFixed(1) + "%");

    // Không có mốc nào (hoặc tắt Chuyện tình yêu): câu cố định thay cho mốc thời gian.
    const left = first || "Từ lần đầu gặp";
    setText("cm-since", left);
    const days = until ? Math.ceil((until - now) / 864e5) : null;
    setText("cm-until", days == null ? "" : days > 0 ? `-${days} ngày` : days === 0 ? "Hôm nay" : "Đã phát hành");
  }

  // ============= NÚT PHÁT + THẢ TIM =============
  // Thiệp có nhạc: nút điều khiển nhạc thật, trạng thái lấy từ sự kiện cx:music-state.
  // Không có nhạc: nút chỉ tạm dừng hiệu ứng (bìa co lại, lời bài hát đứng yên).

  let _hasMusic = false;

  function _setPaused(on) {
    const card = document.getElementById("main-card");
    card?.classList.toggle("cm-paused", on);
    document.querySelector(".cm-play")?.setAttribute("aria-pressed", on ? "false" : "true");
  }

  function _syncPlay(hasMusic) {
    _hasMusic = hasMusic;
    _setPaused(hasMusic && !window.getMusicInfo?.().playing);
  }

  function _bindHero() {
    const hero = document.getElementById("section-hero");
    if (!hero || hero._cmBound) return;
    hero._cmBound = true;
    window.addEventListener("cx:music-state", (e) => {
      if (_hasMusic) _setPaused(!e.detail?.playing);
    });
    hero.addEventListener("click", (e) => {
      if (e.target.closest(".cm-play")) {
        if (_hasMusic && window.toggleYouTubeMusic) {
          window.toggleYouTubeMusic();
          _setPaused(!window.getMusicInfo?.().playing);
        } else {
          _setPaused(!document.getElementById("main-card")?.classList.contains("cm-paused"));
        }
      }
      const like = e.target.closest(".cm-like");
      if (like) like.setAttribute("aria-pressed", String(like.classList.toggle("is-on")));
    });
  }

  // ============= LỜI BÀI HÁT (karaoke) =============
  // Mỗi mốc chuyện tình là một đoạn lời, năm đứng cột trái như mốc thời gian; câu slogan
  // là điệp khúc khép lại. Đoạn đang hát tô dần chữ trong --cm-dur (theo độ dài chữ) rồi
  // mới sang đoạn sau. Chạy khi mục vào màn; tab ẩn hoặc đang tạm dừng thì đứng chờ.
  // Máy bật giảm chuyển động: hiện trọn mọi đoạn, không chạy.

  const CM_VERSE_MS = [2600, 7000]; // trần/sàn thời lượng một đoạn

  function _renderLyrics(events, quote) {
    const section = document.getElementById("love-story");
    const list = document.getElementById("love-story-list");
    if (!section || !list) return;
    const verse = (when, title, body, cls) => {
      const len = (title + body).length;
      const dur = Math.min(CM_VERSE_MS[1], Math.max(CM_VERSE_MS[0], 1400 + len * 55));
      return `<div class="cm-v${cls ? " " + cls : ""}" style="--cm-dur:${dur}ms" data-dur="${dur}">
        <time>${escapeHtml(when)}</time>
        <div>${title ? `<b><span>${escapeHtml(title)}</span></b>` : ""}${body ? `<p><span>${escapeHtml(body)}</span></p>` : ""}</div>
      </div>`;
    };
    const verses = (Array.isArray(events) ? events : [])
      .filter((ev) => ev.content || ev.title)
      .map((ev) => {
        const d = String(ev.date || "").trim();
        const y = d.match(/\d{4}/);
        return verse(y ? y[0] : d.slice(0, 5), ev.content ? ev.title || "" : "", ev.content || ev.title, "");
      });
    if (quote) verses.push(verse("♪", "", quote, "is-refrain"));
    if (!verses.length) {
      section.style.display = "none";
      return;
    }
    section.style.display = "";
    list.innerHTML = verses.join("");
    clearTimeout(section._cmT);
    section._cmI = 0;
    section.querySelector(".cm-ly")?.classList.toggle("is-static", !!RM);
    if (RM) return;
    _showLine(section);

    if (section._cmIO || !("IntersectionObserver" in window)) return;
    const next = () => {
      const idle = document.hidden || document.getElementById("main-card")?.classList.contains("cm-paused");
      if (idle) return (section._cmT = setTimeout(next, 500));
      const n = list.children.length;
      if (n) {
        section._cmI = (section._cmI + 1) % n;
        _showLine(section);
      }
      section._cmT = setTimeout(next, +(list.children[section._cmI]?.dataset.dur || CM_VERSE_MS[0]) + 600);
    };
    section._cmIO = new IntersectionObserver(
      (es) => {
        if (!es.some((e) => e.isIntersecting)) return;
        section._cmIO.disconnect();
        // Đoạn đầu bắt đầu tô lại đúng lúc khách nhìn thấy.
        _showLine(section, true);
        section._cmT = setTimeout(next, +(list.children[0]?.dataset.dur || CM_VERSE_MS[0]) + 600);
      },
      { threshold: 0.4 },
    );
    section._cmIO.observe(section);
  }

  // Đoạn i sáng + tô dần, đoạn trước mờ vừa, đoạn sau mờ hẳn; dời cả dải để đoạn i
  // đứng ngay dưới mép mờ phía trên.
  function _showLine(section, restart) {
    const list = document.getElementById("love-story-list");
    const verses = list ? [...list.children] : [];
    const i = section._cmI || 0;
    if (!verses[i]) return;
    verses.forEach((v, k) => {
      v.classList.toggle("is-past", k < i);
      if (k !== i || restart) v.classList.remove("is-on");
    });
    void verses[i].offsetWidth; // gỡ rồi gắn lại để animation tô chữ chạy lại từ đầu
    verses[i].classList.add("is-on");
    list.style.transform = `translateY(${-Math.max(0, verses[i].offsetTop - verses[0].offsetTop - 28)}px)`;
  }

  // ============= SỰ KIỆN SẮP TỚI: tiệc của bên đang xem + lễ, xếp theo giờ =============

  function _renderEvents(w, side, cer) {
    const box = document.getElementById("cm-events");
    if (!box) return;
    const evs = [];
    if (cxEnabled(w.enable_party) && (w[`${side}_party_date`] || w[`${side}_party_time`])) {
      evs.push({
        date: w[`${side}_party_date`],
        time: w[`${side}_party_time`],
        title: side === "groom" ? "Tiệc mừng nhà trai" : "Tiệc mừng nhà gái",
        loc: w[`${side}_party_location`],
        lunar: w[`${side}_party_lunar`],
        map: w[`${side}_party_map_embed_url`],
      });
    }
    evs.push({ date: w.ceremony_date, time: cer.time, title: cer.name, loc: cer.loc, lunar: w.ceremony_lunar, map: cer.map });
    const key = (s) => `${s.date || "9999"}T${s.time || "99:99"}`;
    evs.sort((a, b) => key(a).localeCompare(key(b)));

    box.innerHTML = evs
      .map((ev) => {
        const d = _date(ev.date);
        const when = [d ? WD[d.getDay()] : "", ev.time ? `lúc ${ev.time}` : ""].filter(Boolean).join(", ");
        return `<div class="cm-ev">
          <span>${d ? pad(d.getDate()) : "--"}<small>TH${d ? d.getMonth() + 1 : "-"}</small></span>
          <div><b>${escapeHtml(ev.title)}</b>
            ${when ? `<p>${escapeHtml(when)}</p>` : ""}
            ${ev.loc ? `<p>${escapeHtml(ev.loc)}</p>` : ""}
            ${ev.lunar ? `<p>${escapeHtml(ev.lunar)}</p>` : ""}
            ${_directions(ev) ? `<a class="cm-btn" href="${escapeHtml(_directions(ev))}" target="_blank" rel="noopener">Chỉ đường</a>` : ""}
          </div>
        </div>`;
      })
      .join("");
  }

  // Link chỉ đường của một sự kiện: bản đồ đã ghim (extractMapEmbedUrl lọc theo allowlist
  // host) → Maps; chưa ghim mà có địa chỉ thì tìm theo địa chỉ; không có gì thì "".
  function _directions(ev) {
    const embed = extractMapEmbedUrl(ev.map);
    if (embed) return cxMapOpenUrl(embed);
    const q = String(ev.loc || "").trim();
    return q ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}` : "";
  }

  // Bản đồ minh hoạ tông tối như lịch lưu diễn, thẻ nổi ghi địa chỉ nơi làm lễ (lễ chưa
  // có địa chỉ thì lấy nơi đãi tiệc); chỉ đường nằm ở nút của từng sự kiện.
  function _drawMap(name, loc) {
    const box = document.getElementById("cm-map");
    if (!box) return;
    const addr = String(loc || "").trim();
    box.innerHTML = `<svg class="cm-svg" viewBox="0 0 320 220" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
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
    </svg>
    ${addr ? `<p class="cm-mapcard" title="${escapeHtml(addr)}"><b>${escapeHtml(name)}</b><span>${escapeHtml(addr)}</span></p>` : ""}`;
  }

  // ============= DANH SÁCH PHÁT: mốc lịch trình của bên đang xem =============

  function _renderTracks(w, side) {
    const list = document.getElementById("cm-tracks");
    if (!list) return;
    const on = cxEnabled(w.enable_timeline) && Array.isArray(w.timeline);
    const dateOf = { ceremony: w.ceremony_date, party: w.groom_party_date, "bride-party": w.bride_party_date };
    const partyOn = cxEnabled(w.enable_party);
    const items = !on
      ? []
      : w.timeline.filter((it) => {
          const t = it.type || "ceremony";
          // Tắt Tiệc = khách không được mời tiệc → bỏ luôn mốc tiệc.
          if (t !== "ceremony" && !partyOn) return false;
          if (t === "party" && side !== "groom") return false;
          if (t === "bride-party" && side !== "bride") return false;
          return !!it.title;
        });
    const key = (it) => `${dateOf[it.type || "ceremony"] || "9999"}T${it.time || "99:99"}`;
    items.sort((a, b) => key(a).localeCompare(key(b)));
    cxToggle("section-timeline", items.length > 0);
    list.innerHTML = items
      .map((it, i) => {
        const d = _date(dateOf[it.type || "ceremony"]);
        return `<li><i>${i + 1}</i><div><b>${escapeHtml(it.title)}</b>${
          d ? `<small>${WD[d.getDay()]} ${pad(d.getDate())}.${pad(d.getMonth() + 1)}</small>` : ""
        }</div><time>${escapeHtml(it.time || "")}</time></li>`;
      })
      .join("");
  }

  // ============= ALBUM: dải bìa vuông vuốt ngang + phóng to =============

  function renderGallery(images, focalPoints) {
    const grid = document.getElementById("gallery-grid");
    if (!grid) return;
    const urls = images?.length
      ? images.map(getImageUrl)
      : Array(4)
          .fill(null)
          .map(() => createPlaceholderSVG("Chưa có ảnh"));

    lightboxImages.length = 0;
    lightboxImages.push(...urls);

    // Nhân đôi bộ ảnh để dải phim chạy vòng liền mạch; bản sao chỉ để nhìn.
    const cell = (url, i, copy) => `<div class="cm-tile" data-i="${i}"${copy ? ' aria-hidden="true"' : ""}>
        <img src="${cxImgSrc(url)}" alt="" loading="lazy" style="object-position:${cxFocal(focalPoints?.[images?.[i]])}">
        <span>Khoảnh khắc ${pad(i + 1)}</span></div>`;
    grid.innerHTML = urls.map((u, i) => cell(u, i)).join("") + urls.map((u, i) => cell(u, i, true)).join("");
    grid.onclick = (e) => {
      const t = e.target.closest(".cm-tile");
      if (t) openLightbox(+t.dataset.i);
    };
    _autoShelf(grid);
  }

  // Dải phim trôi đều sang trái (CM_REEL_SPEED px/giây), qua hết bộ ảnh đầu thì lùi
  // đúng một bộ nên không thấy chỗ nối. Khách chạm/vuốt thì dừng, buông tay 2 giây
  // chạy tiếp từ chỗ đang đứng. Bỏ nhịp khi tab ẩn hoặc dải ngoài khung nhìn.
  const CM_REEL_SPEED = 28;

  function _autoShelf(grid) {
    if (grid._cmAuto) return;
    grid._cmAuto = true;
    let seen = !("IntersectionObserver" in window);
    let touching = false;
    let holdUntil = 0;
    // scrollLeft bị làm tròn ở màn DPR 1 → cộng dồn vị trí thực ở biến riêng.
    let pos = 0;
    let last = 0;
    grid.addEventListener("pointerdown", () => (touching = true), { passive: true });
    grid.addEventListener("touchstart", () => (touching = true), { passive: true });
    const release = () => {
      if (!touching) return;
      touching = false;
      holdUntil = performance.now() + 2000;
    };
    ["pointerup", "pointercancel", "pointerleave", "touchend", "touchcancel"].forEach((ev) =>
      grid.addEventListener(ev, release, { passive: true }),
    );
    if (!seen) {
      new IntersectionObserver((es) => es.forEach((e) => (seen = e.isIntersecting)), { threshold: 0.1 }).observe(grid);
    }
    const tick = (now) => {
      const dt = last ? Math.min(now - last, 64) : 0;
      last = now;
      // Chu kỳ = khoảng từ ảnh đầu tới bản sao của nó (padding hai mép không tính vào).
      const half = grid.children.length / 2;
      const loop = half ? grid.children[half].offsetLeft - grid.children[0].offsetLeft : 0;
      if (touching || now < holdUntil || !seen || document.hidden || loop <= grid.clientWidth) {
        pos = grid.scrollLeft;
      } else {
        pos += (CM_REEL_SPEED * dt) / 1000;
        if (pos >= loop) pos -= loop;
        grid.scrollLeft = pos;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  // Khách hay tự gõ sẵn "Ông"/"Bà" trước tên → bỏ đi cho khỏi lặp.
  function _parents(father, mother) {
    const clean = (s) => String(s || "").trim().replace(/^(ông|bà)\s+/i, "");
    const f = clean(father);
    const m = clean(mother);
    if (f && m) return `Ông ${f}, bà ${m}`;
    if (f) return `Ông ${f}`;
    return m ? `Bà ${m}` : "";
  }

  function _date(s) {
    const d = s ? new Date(s + "T00:00:00") : null;
    return d && !isNaN(d.getTime()) ? d : null;
  }
})();
