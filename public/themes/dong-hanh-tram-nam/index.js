// Đồng Hành Trăm Năm — đám cưới là một chuyến tàu: bảng giờ tàu lật số, vé có lỗ bấm,
// lịch trình là các ga dừng. Không có màn bìa: mục mở đầu là màn đầu tiên.
// Chỉ khai báo CX_THEME + renderWedding; phần chạy nằm ở core/helpers/theme-boot.js.

(function () {
  window.CX_THEME = {
    id: "dong-hanh-tram-nam",
    wishesMode: "card",
    // Vé quà mừng tự có cuống che QR nên mặc định không chồng thêm hộp.
    giftBox: "none",
    music: { variant: "square", chrome: "fixed-corner", art: "couple" },

    // Bộ màu MẶC ĐỊNH của mẫu — bản khai máy đọc được của đúng những giá trị
    // :root trong theme.css (nguồn sự thật). Trang Thiết lập đọc nó để hiện mục
    // "Mặc định"; theme_setting.palette ghi đè lên trên lúc chạy.
    // Sinh lại bằng: node scripts/check-theme-palette.mjs --write
    palette: {
      heading: "#24365e",
      body: "#5a6582",
      accent: "#c2412d",
      accent_soft: "#f3b33d",
      on_accent: "#ffffff",
      on_image: "#ffffff",
      on_lightbox: "#ffffff",
      card_bg: "#efe7cf",
      page_bg: "#e2d8bb",
      surface: "#fff8e6",
      band: "#f6efda",
      panel: "#fff8e6",
      panel_warm: "#f3ecd8",
      cover: "#2f5d50",
      cover_mid: "#26493f",
      cover_veil: "#2f5d50",
      lightbox_bg: "#000000",
      line: "#dccfaa",
      shadow: "#000000",
      scrim: "#000000",
      deco: "#f3b33d",
      deco_soft: "#e6e0cc",
      deco_2: "#22262b",
      deco_2_soft: "#a9b0b8",
      shine_from: "#f3b33d",
      shine_mid: "#d2c399",
      shine_to: "#c2412d",
    },

    swatches: ["#2f5d50", "#24365e", "#c2412d", "#f3b33d", "#5a6582", "#22262b", "#dccfaa", "#efe7cf", "#fff8e6"],

    wishes: { bubble: "#fff8e6", text: "#24365e", accent: "#c2412d", btn: "#c2412d" },

    reveal: ["#love-story", "#section-ceremony", "#section-map", "#rsvp-section", "#section-gift", "#section-footer"],
    revealItems: ["#love-story-list li"],

    // Mẫu không vẽ gia đình, album.
    skipSteps: ["family", "photos"],
    focus: {
      couple: ["#section-hero"],
      party: ["#section-ceremony", "#section-map"],
      timeline: ["#section-ceremony"],
    },

    loveStory: "short",
    onOpen: null,
  };

  const _isGroom = isGroomSide();
  const RM = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const WD = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
  const pad = (n) => String(n).padStart(2, "0");

  function renderWedding(w) {
    if (!w || !w.is_active) return;
    const side = _isGroom ? "groom" : "bride";
    const names = _isGroom ? [w.groom_name, w.bride_name] : [w.bride_name, w.groom_name];

    // --- Mở đầu: bảng giờ tàu + vé ---
    const isVuQuy = !_isGroom && cxEnabled(w.vu_quy_enabled);
    const ceremonyName = isVuQuy ? "Lễ Vu Quy" : w.ceremony_name || "Lễ Thành Hôn";
    const ceremonyTime = isVuQuy ? w.vu_quy_time : w.ceremony_time;
    const ceremonyLoc = isVuQuy ? w.vu_quy_location : w.ceremony_location || "";
    const cd = _date(w.ceremony_date);
    _setFlap("t3-flap-date", cd ? `${pad(cd.getDate())}.${pad(cd.getMonth() + 1)}.${String(cd.getFullYear()).slice(-2)}` : "--.--.--");
    _setFlap("t3-flap-time", ceremonyTime || "--:--");
    setText("t3-name-1", names[0], "----------");
    setText("t3-name-2", names[1], "----------");
    const metYear = cxEnabled(w.enable_love_story) && String(w.love_story?.[0]?.date || "").match(/\d{4}/);
    setText("t3-route-from", metYear ? `Ga Gặp Gỡ, ${metYear[0]}` : "Ga Gặp Gỡ");
    _barcode();
    if (w.story_quote) setText("story-quote", w.story_quote);
    if (window.CX_GUEST) cxToggle("cover-guest-wrap", true);

    setupMusic(w.music_url, w.enable_music);
    renderMusicSummary(w, { ceremonyName, ceremonyTime, ceremonyLocation: ceremonyLoc });

    // --- Các ga đã qua ---
    if (cxEnabled(w.enable_love_story)) _renderPast(w.love_story);
    else cxToggle("love-story", false);

    // --- Lịch trình chuyến đi ---
    _renderLine(w, side);

    // --- Sơ đồ tuyến ---
    const partyOn = cxEnabled(w.enable_party);
    const when = partyOn
      ? ["Tiệc mừng", w[`${side}_party_time`], w[`${side}_party_date`]]
      : [ceremonyName, ceremonyTime, w.ceremony_date];
    const wd = _date(when[2]);
    setText("t3-map-when", [when[0] + (when[1] ? ` lúc ${when[1]}` : ""), wd ? `${WD[wd.getDay()]} ${pad(wd.getDate())}.${pad(wd.getMonth() + 1)}` : ""].filter(Boolean).join(", "));
    setText("t3-map-time", when[1] ? `Khởi hành ${when[1]}` : "");
    _drawMap();
    renderVenueMaps(w, side);

    // --- Xác nhận lên tàu ---
    const rsvp = document.getElementById("rsvp-section");
    if (rsvp) rsvp.style.display = cxEnabled(w.rsvp_enabled) ? "flex" : "none";
    if (w.rsvp_message) {
      setText("rsvp-custom-message", w.rsvp_message);
      cxToggle("rsvp-custom-message", true);
    }

    // --- Vé quà mừng ---
    renderQRCodes(w);
    _bindStubs();
    cxToggle("section-gift", cxEnabled(w.enable_gift));

    // --- Lời cảm ơn ---
    setText("t3-end-1", names[0], "----------");
    setText("t3-end-2", names[1], "----------");
    if (w.footer_text) {
      setText("footer-text", w.footer_text);
      cxToggle("footer-text", true);
    }
    cxToggle("section-footer", cxEnabled(w.enable_footer));

    // Không có màn bìa nên hiệu ứng mở đầu chạy ngay khi đã có dữ liệu.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        document.getElementById("section-hero")?.classList.add("t3-live");
        _runFlaps();
      }),
    );
  }

  window.renderWedding = renderWedding;

  // ============= BẢNG GIỜ TÀU =============
  // Mỗi ký tự một ô; chữ số lật qua vài số rồi dừng đúng giá trị (ô sau lật lâu hơn ô trước).

  function _setFlap(id, text) {
    const el = document.getElementById(id);
    if (!el) return;
    el.dataset.flap = text;
    el.setAttribute("aria-label", text);
    el.innerHTML = [...text]
      .map((ch) => `<b class="t3-fl${/[.:]/.test(ch) ? " is-sep" : ""}" aria-hidden="true">${escapeHtml(ch)}</b>`)
      .join("");
  }

  function _runFlaps() {
    if (RM) return;
    document.querySelectorAll("#section-hero [data-flap]").forEach((row, k) => {
      row.querySelectorAll(".t3-fl").forEach((b, i) => {
        const ch = b.textContent;
        if (!/\d/.test(ch)) return;
        const total = 8 + i * 2 + k * 5;
        let n = 0;
        b.textContent = "0";
        const t = setInterval(() => {
          n++;
          b.textContent = n >= total ? ch : String((+ch + n) % 10);
          b.classList.remove("is-flip");
          void b.offsetWidth;
          b.classList.add("is-flip");
          if (n >= total) clearInterval(t);
        }, 70);
      });
    });
  }

  // Mã vạch trang trí: các vạch rộng hẹp ngẫu nhiên nhưng cố định (hạt giống cố định).
  function _barcode() {
    const el = document.querySelector(".t3-barcode");
    if (!el || el.style.background) return;
    let s = 27;
    const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    const c = "rgb(var(--cx-heading-rgb))";
    const st = [];
    let x = 0;
    while (x < 100) {
      const bw = 0.6 + r() * 2.2;
      const g = 0.5 + r() * 1.6;
      st.push(`${c} ${x}% ${x + bw}%`, `transparent ${x + bw}% ${x + bw + g}%`);
      x += bw + g;
    }
    el.style.background = `linear-gradient(90deg,${st.join(",")})`;
  }

  // ============= CÁC GA ĐÃ QUA (chuyện tình) =============

  function _renderPast(events) {
    const section = document.getElementById("love-story");
    const list = document.getElementById("love-story-list");
    if (!section || !list) return;
    if (!Array.isArray(events) || !events.length) {
      section.style.display = "none";
      return;
    }
    section.style.display = "";
    list.innerHTML = events
      .map((ev) => {
        const ph = ev.image_url
          ? `<img src="${cxImgSrc(ev.image_url)}" alt="" loading="lazy" style="object-position:${cxFocal(ev.focal_point)}">`
          : "";
        return `<li${ph ? "" : ' class="no-ph"'}>${ph}<div>
          ${ev.date ? `<time>${escapeHtml(ev.date)}</time>` : ""}
          ${ev.title ? `<b>${escapeHtml(ev.title)}</b>` : ""}
          ${ev.content ? `<span>${escapeHtml(ev.content)}</span>` : ""}
        </div></li>`;
      })
      .join("");
  }

  // ============= LỊCH TRÌNH: các ga dừng trên một đường ray =============
  // Ga lấy từ tiệc của bên đang xem, lễ vu quy, lễ chính; bật Lịch trình thì chen thêm
  // các mốc của bên đó (mốc trùng ngày + giờ với một ga sẵn có thì bỏ). Ga cuối tô đỏ.

  function _renderLine(w, side) {
    const list = document.getElementById("t3-line");
    if (!list) return;
    const stops = [];
    if (cxEnabled(w.enable_party) && (w[`${side}_party_date`] || w[`${side}_party_time`])) {
      stops.push({
        date: w[`${side}_party_date`],
        time: w[`${side}_party_time`],
        title: side === "groom" ? "Tiệc mừng nhà trai" : "Tiệc mừng nhà gái",
        sub: w[`${side}_party_location`],
      });
    }
    // Nhà gái bật Vu Quy thì lễ vu quy THAY lễ chính, như base-theme.
    if (side === "bride" && cxEnabled(w.vu_quy_enabled)) {
      stops.push({ date: w.ceremony_date, time: w.vu_quy_time, title: "Lễ vu quy", sub: w.vu_quy_location });
    } else {
      stops.push({
        date: w.ceremony_date,
        time: w.ceremony_time,
        title: w.ceremony_name || "Lễ thành hôn",
        sub: w.ceremony_location,
      });
    }

    if (cxEnabled(w.enable_timeline) && Array.isArray(w.timeline)) {
      const dateOf = { ceremony: w.ceremony_date, party: w.groom_party_date, "bride-party": w.bride_party_date };
      const partyOn = cxEnabled(w.enable_party);
      w.timeline.forEach((it) => {
        const t = it.type || "ceremony";
        // Tắt Tiệc = khách không được mời tiệc → bỏ luôn mốc tiệc.
        if (t !== "ceremony" && !partyOn) return;
        if (t === "party" && side !== "groom") return;
        if (t === "bride-party" && side !== "bride") return;
        const date = dateOf[t];
        if (!it.title || stops.some((s) => s.date === date && s.time === it.time)) return;
        stops.push({ date, time: it.time, title: it.title });
      });
    }

    const key = (s) => `${s.date || "9999"}T${s.time || "99:99"}`;
    stops.sort((a, b) => key(a).localeCompare(key(b)));

    let prevDate = null;
    list.innerHTML = stops
      .map((s, i) => {
        const d = _date(s.date);
        const day = d && s.date !== prevDate ? `${WD[d.getDay()]} ${pad(d.getDate())}.${pad(d.getMonth() + 1)}` : "";
        prevDate = s.date;
        const at = [day, s.time].filter(Boolean).join(", ");
        const title = i === stops.length - 1 ? `Ga cuối: ${s.title}` : s.title;
        return `<li style="--d:${i}">
          ${at ? `<time>${escapeHtml(at)}</time>` : ""}
          <b>${escapeHtml(title)}</b>
          ${s.sub ? `<span>${escapeHtml(s.sub)}</span>` : ""}
        </li>`;
      })
      .join("");
  }

  // ============= SƠ ĐỒ TUYẾN (minh hoạ, tàu chạy theo tuyến) =============

  function _drawMap() {
    const box = document.getElementById("t3-map");
    if (!box || box.firstChild) return;
    box.innerHTML = `<svg class="t3-svg" viewBox="0 0 320 220" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Sơ đồ tuyến tới ga Trăm Năm">
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
      <path id="t3-route" class="m-route" pathLength="1" d="M24 212C40 170 90 150 118 128S170 100 205 104"/>
      ${RM ? "" : `<g class="m-train"><rect x="-10" y="-6" width="20" height="11" rx="3"/><circle cx="-5" cy="6" r="2"/><circle cx="5" cy="6" r="2"/><animateMotion dur="5s" repeatCount="indefinite" rotate="auto"><mpath href="#t3-route"/></animateMotion></g>`}
      <g transform="translate(205 104)">
        <circle class="m-halo" r="16"/>
        <path class="m-drop" d="M0 0C-8-10-10-14-10-19a10 10 0 0 1 20 0c0 5-2 9-10 19Z"/><circle class="m-dot" cy="-19" r="4"/>
      </g>
      <text class="m-label" x="220" y="122">Ga Trăm Năm</text>
    </svg>`;
  }

  // ============= VÉ QUÀ MỪNG: chạm cuống là xé rơi, lộ mã QR (một chiều) =============

  function _bindStubs() {
    const sec = document.getElementById("section-gift");
    if (!sec || sec._t3Stub) return;
    sec._t3Stub = true;
    sec.addEventListener("click", (e) => {
      const stub = e.target.closest(".t3-stub");
      const gt = stub?.closest(".t3-gt");
      if (!gt || gt.classList.contains("is-open")) return;
      gt.classList.add("is-open");
      stub.setAttribute("aria-expanded", "true");
    });
  }

  function _date(s) {
    const d = s ? new Date(s + "T00:00:00") : null;
    return d && !isNaN(d.getTime()) ? d : null;
  }
})();
