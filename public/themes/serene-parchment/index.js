// SERENE PARCHMENT — thiệp hiện đại kiểu trang tạp chí: bìa phong bì nhấp nhô có
// đếm ngược, con dấu chữ lồng mở thiệp; thân thiệp ảnh tràn lề, mục đánh số.
// File này chỉ KHAI BÁO: window.CX_THEME + renderWedding + phần đặc thù của mẫu
// (đếm ngược, mở phong bì, tên một dòng, album tạp chí). Phần "chạy" ở theme-boot.js.
// Bọc IIFE, chỉ lộ CX_THEME + renderWedding.

(function () {
  window.CX_THEME = {
    // Trùng TÊN THƯ MỤC và cột `templates.template_name`.
    id: "serene-parchment",

    // Dạng hiện lời chúc khi chủ thiệp chưa chọn (theme_setting.wishes_mode).
    wishesMode: "card",

    // Hộp mừng cưới mặc định — id trong CX_GIFT_BOXES hoặc "none".
    giftBox: "minimalism_brown",

    // Dạng trình phát nhạc — theme-boot.js dựng vào #cx-music-mount.
    music: { variant: "mini", chrome: "fixed-corner", art: "couple" },

    // Bộ màu MẶC ĐỊNH của mẫu — bản khai máy đọc được của đúng những giá trị
    // :root trong theme.css (nguồn sự thật). Trang Thiết lập đọc nó để hiện mục
    // "Mặc định"; theme_setting.palette ghi đè lên trên lúc chạy.
    // Sinh lại bằng: node scripts/check-theme-palette.mjs --write
    palette: {
      heading: "#171717",
      body: "#44403c",
      accent: "#a16207",
      accent_soft: "#d6b56f",
      on_accent: "#ffffff",
      on_image: "#ffffff",
      on_lightbox: "#ffffff",
      card_bg: "#f7f5f1",
      page_bg: "#ece8e1",
      surface: "#efebe4",
      band: "#efebe4",
      panel: "#ffffff",
      panel_warm: "#fbf9f6",
      cover: "#f7f5f1",
      cover_mid: "#efebe4",
      cover_veil: "#f7f5f1",
      lightbox_bg: "#0c0c0c",
      line: "#e2ddd4",
      shadow: "#171717",
      scrim: "#000000",
      deco: "#a16207",
      deco_soft: "#e8dcc4",
      deco_2: "#171717",
      deco_2_soft: "#57534e",
      shine_from: "#d6b56f",
      shine_mid: "#fff8e6",
      shine_to: "#d6b56f",
    },

    // Màu gợi ý trong bộ chọn màu khi khách chỉnh riêng một phần tử.
    swatches: [
      "#171717",
      "#44403c",
      "#57534e",
      "#a16207",
      "#d6b56f",
      "#e2ddd4",
      "#efebe4",
      "#f7f5f1",
      "#ffffff",
    ],

    // Màu lời chúc: thẻ trắng trên nền ngà, tên khách vàng đồng, nút gửi mực.
    wishes: { bubble: "#ffffff", text: "#44403c", accent: "#a16207", btn: "#171717" },

    reveal: ["#main-card section"],
    suggest: "#section-gift",
    skipSteps: [],
    loveStory: "medium",

    // Tên co theo bề ngang THẬT, mà lúc renderWedding chạy #main-card còn
    // display:none → đo lại khi thiệp mở ra.
    onOpen: () => _fitAllNames(),
  };

  const _isGroom = isGroomSide();

  // Con dấu trên phong bì là nét nhận dạng của mẫu → luôn hiện màn bìa, kể cả
  // link chung (mặc định wedding-helper mở thẳng thiệp). Vẫn điền tên khách +
  // bật phiếu hồi âm, chỉ bỏ phần TỰ MỞ. Bọc được vì index.js nạp sau wedding-helper.
  const _greetOriginal = window.setupPersonalizedGreeting;
  window.setupPersonalizedGreeting = function (slug, isGroom) {
    _greetOriginal(slug, isGroom, () => {});
    const wrap = document.getElementById("cover-guest-wrap");
    if (wrap && window.CX_GUEST) {
      wrap.classList.remove("hidden");
      wrap.classList.add("flex");
    } else if (wrap) {
      wrap.classList.add("hidden");
    }
  };

  // Khung "xem trực tiếp" ở trang Thiết lập xin cuộn tới mục đang chỉnh — mục đó
  // nằm sau màn bìa, nên nhận tin là mở thiệp ra rồi mới để helper cuộn.
  window.addEventListener("message", (e) => {
    if (e.data?.type !== "cx-focus") return;
    const cover = document.getElementById("cover-screen");
    if (cover && cover.style.display !== "none") window.openInvitation();
  });

  // Bấm con dấu: ảnh bay ra + phong bì rơi (CSS .is-open ở theme.css), xong mới
  // openInvitation() để màn bìa mờ đi. Giảm chuyển động thì mở ngay.
  let _opening = false;
  function _spOpen() {
    if (_opening) return;
    _opening = true;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById("sp-cover")?.classList.add("is-open");
    setTimeout(() => window.openInvitation(), still ? 0 : 1000);
  }
  // Nghe ở document: <x-button> trong HTML tĩnh chỉ thay mình bằng <button> SAU
  // DOMContentLoaded, gắn thẳng vào phần tử lúc này là mất. Cố ý KHÔNG mang lớp
  // .open-btn — theme-boot bắt touchend của lớp đó và mở thẳng, bỏ qua hiệu ứng;
  // touchend ở đây cũng chặn đúng lỗi iOS Chrome nuốt click mà lớp đó xử lý.
  const _onSeal = (e) => e.target.closest?.("#sp-seal");
  document.addEventListener("click", (e) => _onSeal(e) && _spOpen());
  document.addEventListener(
    "touchend",
    (e) => {
      if (!_onSeal(e)) return;
      e.preventDefault();
      _spOpen();
    },
    { passive: false },
  );

  // "2026-10-18" → "18.10.2026"
  function _fmtDMY(dateStr) {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (isNaN(d)) return "";
    const p = (n) => String(n).padStart(2, "0");
    return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`;
  }

  // Chữ cái đầu của TỪ CUỐI trong tên (tên gọi): "Đình Phúc" → "P".
  function _initial(name) {
    const w = String(name || "").trim().split(/\s+/).pop() || "";
    return w.charAt(0).toUpperCase();
  }

  // ============= ĐẾM NGƯỢC TỚI GIỜ LÀM LỄ =============
  // Giờ lễ dạng "HH:MM"; thiếu giờ thì tính từ 0h. Qua mốc thì đứng ở 00.
  let _cdTimer = null;
  function _spCountdown(dateStr, timeStr) {
    clearInterval(_cdTimer);
    const d = dateStr ? new Date(dateStr) : null;
    if (!d || isNaN(d)) return;
    const [h, m] = String(timeStr || "").split(":").map((n) => parseInt(n, 10));
    const end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h || 0, m || 0).getTime();
    const p = (n) => String(n).padStart(2, "0");
    const tick = () => {
      const s = Math.max(0, Math.floor((end - Date.now()) / 1000));
      // Chữ số đổi mỗi giây → gán thẳng, KHÔNG qua setText (sẽ khoá sửa chữ vô ích).
      const set = (id, v) => {
        const el = document.getElementById(id);
        if (el) el.textContent = p(v);
      };
      set("sp-cd-d", Math.floor(s / 86400));
      set("sp-cd-h", Math.floor(s / 3600) % 24);
      set("sp-cd-m", Math.floor(s / 60) % 60);
      set("sp-cd-s", s % 60);
      if (!s) clearInterval(_cdTimer);
    };
    tick();
    _cdTimer = setInterval(tick, 1000);
  }

  // ============= TÊN LUÔN TRÊN MỘT DÒNG =============
  // Đo khung .sp-fit rồi thu .sp-fit-in bằng transform — scale không bắt bố cục
  // lại nên chữ không nhảy dòng giữa chừng, một lần đo là đủ.
  function _fitNames(row) {
    const inner = row.querySelector(".sp-fit-in");
    if (!inner) return;
    inner.style.setProperty("--sp-fit", "1");
    const avail = row.clientWidth;
    if (!avail) return; // khối còn ẩn, chưa đo được
    const need = inner.getBoundingClientRect().width;
    if (need > avail) inner.style.setProperty("--sp-fit", String(avail / need));
  }

  function _fitAllNames() {
    document.querySelectorAll(".sp-fit").forEach(_fitNames);
  }

  // Font tải xong là bề ngang đổi hẳn → đo lại.
  document.fonts?.ready.then(_fitAllNames);
  window.addEventListener("resize", _fitAllNames, { passive: true });

  // ============= ĐỔ DỮ LIỆU LÊN THIỆP =============
  // Gọi theo đúng thứ tự các mục trong index.html.

  function renderWedding(w) {
    if (!w || !w.is_active) return;

    const side = _isGroom ? "groom" : "bride";

    // --- Màn bìa --- (ảnh màn đầu nhận src TRƯỚC setupMusic)
    renderCover(w);
    // Ảnh in nhỏ: tấm đầu album, chưa có thì ảnh chú rể, cuối cùng là ảnh bìa.
    const second = w.gallery_images?.[0] || w.groom_image_url || w.cover_image_url;
    setAttr("sp-cover-2", "src", getImageUrl(second));
    setText("sp-mono-g", _initial(w.groom_name), "P");
    setText("sp-mono-b", _initial(w.bride_name), "Q");

    // --- Mở đầu ---
    renderHero(w, false);
    if (w.story_quote) setText("story-quote", w.story_quote);
    setText("hero-date", _fmtDMY(w.ceremony_date), "--.--.----");
    const cd = w.ceremony_date ? new Date(w.ceremony_date) : null;
    setText("hero-weekday", cd && !isNaN(cd) ? WEEKDAYS[cd.getDay()] : "", "------");

    // --- Nhạc nền ---
    setupMusic(w.music_url, w.enable_music);

    // --- Gia đình ---
    renderCoupleInfo(w);
    cxToggle("groom-addr-row", !!w.groom_address);
    cxToggle("bride-addr-row", !!w.bride_address);
    cxToggle("section-family", cxEnabled(w.enable_family));

    // --- Lễ: nhà gái bật Vu Quy thì thay toàn bộ phần lễ ---
    const isVuQuy = !_isGroom && cxEnabled(w.vu_quy_enabled);
    const ceremonyName = isVuQuy ? "Lễ Vu Quy" : w.ceremony_name || "Lễ Thành Hôn";
    const ceremonyTime = isVuQuy ? w.vu_quy_time : w.ceremony_time;
    const ceremonyLoc = isVuQuy ? w.vu_quy_location : w.ceremony_location || "";

    setText("ceremony-event-name", ceremonyName);
    renderCeremonyDate(w.ceremony_date, ceremonyTime, w.ceremony_lunar);
    if (ceremonyLoc) {
      setText("ceremony-location-text", ceremonyLoc);
      cxToggle("ceremony-location-wrap", true);
    }
    _spCountdown(w.ceremony_date, ceremonyTime);
    _spCouple = `${w.groom_name || ""} & ${w.bride_name || ""}`;
    _spSetActions("ceremony", {
      title: ceremonyName,
      date: w.ceremony_date,
      time: ceremonyTime,
      loc: ceremonyLoc,
      map: isVuQuy ? w.vu_quy_map_embed_url : w.ceremony_map_embed_url,
    });

    renderMusicSummary(w, {
      ceremonyName,
      ceremonyTime,
      ceremonyLocation: ceremonyLoc,
    });

    // --- Tiệc: giờ / ngày / thứ tách ô (định dạng "parts" của renderPartyDate) ---
    const partyDate = w[`${side}_party_date`];
    setText("party-section-label", "Tiệc Mừng " + ceremonyName);
    renderPartyDate(
      partyDate,
      w[`${side}_party_time`],
      w[`${side}_party_lunar`],
      w[`${side}_party_location`],
      "parts",
    );
    _spSetActions("party", {
      title: "Tiệc Mừng " + ceremonyName,
      date: partyDate,
      time: w[`${side}_party_time`],
      loc: w[`${side}_party_location`],
      map: w[`${side}_party_map_embed_url`],
    });
    const partyOn = cxEnabled(w.enable_party);
    cxToggle("section-party", partyOn);
    document.getElementById("section-ceremony")?.classList.toggle("is-solo", !partyOn);

    _spCalendar(
      { date: w.ceremony_date, label: ceremonyName, time: ceremonyTime },
      { date: partyDate, label: "Tiệc mừng", time: w[`${side}_party_time`] },
    );

    // --- Xác nhận tham dự ---
    const rsvp = document.getElementById("rsvp-section");
    if (rsvp) rsvp.style.display = cxEnabled(w.rsvp_enabled) ? "flex" : "none";
    if (w.rsvp_message) {
      const msg = document.getElementById("rsvp-custom-message");
      if (msg) {
        msg.textContent = w.rsvp_message;
        msg.classList.remove("hidden");
      }
    }

    // --- Lịch trình ngày cưới ---
    if (cxEnabled(w.enable_timeline)) {
      renderTimeline(w.timeline, side, partyDate, w.ceremony_date, ceremonyName);
      cxToggle("section-timeline", true);
    }

    // --- Chuyện tình yêu ---
    if (cxEnabled(w.enable_love_story)) {
      _spStories(w);
    } else {
      cxToggle("love-story", false);
    }

    // --- Album ảnh ---
    if (cxEnabled(w.enable_photos)) {
      renderGallery(w.gallery_images, w.image_focal_points?.gallery_images);
    } else {
      cxToggle("section-photos", false);
    }

    // --- Hộp mừng cưới ---
    renderQRCodes(w);
    cxToggle("section-gift", cxEnabled(w.enable_gift));

    // --- Bản đồ: tiệc, thêm bản đồ lễ khi hai nơi khác nhau ---
    renderVenueMaps(w, side);

    // --- Lời cảm ơn ---
    if (w.footer_text) setText("footer-text", w.footer_text);
    setText("sign-groom", w.groom_name, "----------");
    setText("sign-bride", w.bride_name, "----------");
    setText("footer-date", _fmtDMY(w.ceremony_date), "--.--.----");
    cxToggle("section-footer", cxEnabled(w.enable_footer));

    // Đo lần đầu (bìa đang hiện nên đo được tên ở bìa); thân thiệp đo lại ở onOpen.
    _fitAllNames();
  }

  window.renderWedding = renderWedding;

  const _still = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ============= CHỈ ĐƯỜNG + LƯU LỊCH TRÊN THẺ LỄ / TIỆC =============
  // Chỉ đường: toạ độ/tên trong `q=` của link bản đồ, không có thì lấy tên địa điểm.
  // Lưu lịch: iPhone/Mac tải file .ics (máy tự mở hộp "Thêm vào lịch"), máy khác mở
  // Google Calendar. Giờ để "trôi" (không múi giờ) — lịch hiểu theo giờ của máy.
  const _spEvents = {};
  let _spCouple = "";

  function _mapDest(embed, loc) {
    const url = extractMapEmbedUrl(embed);
    if (url) {
      try {
        const q = new URL(url).searchParams.get("q");
        if (q) return q;
      } catch {}
    }
    return String(loc || "").trim();
  }

  // "2026-12-13" + "10:00" → [Date bắt đầu, có giờ không]; ngày hỏng → null.
  function _evStart(ev) {
    const [y, mo, d] = String(ev.date || "").split("-").map(Number);
    if (!y || !mo || !d) return null;
    const [h, mi] = String(ev.time || "").split(":").map(Number);
    const timed = Number.isFinite(h);
    return [new Date(y, mo - 1, d, timed ? h : 0, timed ? mi || 0 : 0), timed];
  }

  function _spSetActions(key, ev) {
    _spEvents[key] = ev;
    const dest = _mapDest(ev.map, ev.loc);
    const dir = document.getElementById(`${key}-dir`);
    if (dir && dest) dir.href = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}`;
    cxToggle(`${key}-dir`, !!dest);
    cxToggle(`${key}-cal`, !!_evStart(ev));
    cxToggle(`${key}-actions`, !!dest || !!_evStart(ev));
  }

  function _spSaveCal(ev) {
    const st = ev && _evStart(ev);
    if (!st) return;
    const [start, timed] = st;
    const end = timed ? new Date(start.getTime() + 2 * 36e5) : new Date(start.getTime() + 864e5);
    const p = (n) => String(n).padStart(2, "0");
    const day = (d) => `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
    const stamp = (d) => (timed ? `${day(d)}T${p(d.getHours())}${p(d.getMinutes())}00` : day(d));
    const title = `${ev.title} · ${_spCouple}`;
    const link = location.href.split("#")[0];

    if (/iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent)) {
      const esc = (t) => String(t).replace(/[\\,;]/g, "\\$&").replace(/\n/g, "\\n");
      const val = timed ? "" : ";VALUE=DATE";
      const ics = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//CuoiXinh//Thiep cuoi//VI",
        "BEGIN:VEVENT",
        `UID:${stamp(start)}-${Math.random().toString(36).slice(2)}@cuoixinh.com`,
        `DTSTAMP:${stamp(new Date())}`,
        `DTSTART${val}:${stamp(start)}`,
        `DTEND${val}:${stamp(end)}`,
        `SUMMARY:${esc(title)}`,
        ev.loc ? `LOCATION:${esc(ev.loc)}` : "",
        `DESCRIPTION:${esc(link)}`,
        "END:VEVENT",
        "END:VCALENDAR",
      ]
        .filter(Boolean)
        .join("\r\n");
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
      a.download = "thiep-cuoi.ics";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      return;
    }
    const q = new URLSearchParams({
      action: "TEMPLATE",
      text: title,
      dates: `${stamp(start)}/${stamp(end)}`,
      location: ev.loc || "",
      details: link,
    });
    window.open(`https://calendar.google.com/calendar/render?${q}`, "_blank", "noopener");
  }

  // Nghe ở document: <x-button> thay mình bằng <button> sau DOMContentLoaded.
  document.addEventListener("click", (e) => {
    const b = e.target.closest?.("[data-sp-cal]");
    if (b) _spSaveCal(_spEvents[b.dataset.spCal]);
  });

  // ============= LỊCH THÁNG: TIM ĐẶC = NGÀY LỄ, TIM VIỀN = NGÀY TIỆC =============
  // Thay setupMiniCalendar của helper (chấm tròn, style inline). Lịch là tháng của
  // ngày lễ; ngày tiệc khác tháng thì chỉ còn ở dòng chú thích. Tim nảy ra khi
  // lịch vào tầm nhìn (cờ .is-in), không theo .visible của cả mục.
  const _HEART =
    "M30 49C30 49 6 34 6 18 6 10.5 11.5 5 18.5 5c5 0 9 3 11.5 7 2.5-4 6.5-7 11.5-7C48.5 5 54 10.5 54 18c0 16-24 31-24 31Z";
  const _heart = (cls) => `<svg class="${cls}" viewBox="0 0 60 54" aria-hidden="true"><path d="${_HEART}"/></svg>`;
  let _calSeen = null;

  function _spCalendar(main, sub) {
    const box = document.getElementById("mini-calendar");
    if (!box) return;
    const d0 = main.date ? new Date(main.date) : null;
    if (!d0 || isNaN(d0)) {
      box.innerHTML = "";
      return;
    }
    const y = d0.getFullYear();
    const m = d0.getMonth();
    const d1 = sub.date ? new Date(sub.date) : null;
    const hasSub = d1 && !isNaN(d1) && d1.toDateString() !== d0.toDateString();
    const inMonth = (dt) => dt.getFullYear() === y && dt.getMonth() === m;
    const marks = { [d0.getDate()]: "main" };
    if (hasSub && inMonth(d1)) marks[d1.getDate()] = "sub";

    const lead = (new Date(y, m, 1).getDay() + 6) % 7; // tuần bắt đầu từ T2
    let grid =
      ["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((d) => `<div class="sp-cal-wd">${d}</div>`).join("") +
      "<div></div>".repeat(lead);
    for (let d = 1, n = new Date(y, m + 1, 0).getDate(); d <= n; d++) {
      const k = marks[d];
      const sun = (lead + d - 1) % 7 === 6;
      grid += `<div class="sp-cal-d${sun ? " is-sun" : ""}${k ? ` is-${k}` : ""}">${k ? _heart(`sp-heart is-${k}`) : ""}<span>${d}</span></div>`;
    }

    const p = (n) => String(n).padStart(2, "0");
    const dayOf = (dt) => (inMonth(dt) ? String(dt.getDate()) : `${p(dt.getDate())}.${p(dt.getMonth() + 1)}`);
    const leg = (dt, ev, k) =>
      `<div class="flex items-center gap-3">${_heart(`sp-leg is-${k}`)}<span><b class="cx-hd font-medium">${dayOf(dt)}</b> · ${escapeHtml(ev.label)}${ev.time ? `, ${escapeHtml(ev.time)}` : ""}</span></div>`;

    box.classList.remove("is-in");
    box.innerHTML = `
      <div class="flex items-end justify-between px-1">
        <div class="cx-h text-[40px] leading-none">Tháng ${m + 1}</div>
        <div class="sp-num cx-hd text-[24px]">${y}</div>
      </div>
      <div class="sp-hr"></div>
      <div class="sp-cal">${grid}</div>
      <div class="sp-hr"></div>
      <div class="flex flex-col gap-2 px-1 text-[14px]">${leg(d0, main, "main")}${hasSub ? leg(d1, sub, "sub") : ""}</div>`;

    _calSeen?.disconnect();
    _calSeen = new IntersectionObserver(
      (es) => {
        if (!es.some((e) => e.isIntersecting)) return;
        box.classList.add("is-in");
        _calSeen.disconnect();
      },
      { threshold: 0.4 },
    );
    _calSeen.observe(box);
  }

  // ============= CHUYỆN CHÚNG MÌNH: KIỂU STORIES =============
  // Thay renderLoveStory của helper. Mỗi mốc một khung ảnh dọc, vạch tiến độ trên
  // đầu tự chạy (chỉ khi khung trong tầm nhìn), chạm nửa trái/phải để lùi/tiến,
  // hàng ảnh nhỏ bên dưới để nhảy. Ảnh KHÔNG lazy (#main-card ẩn tới khi mở).
  let _styCur = 0;
  let _styDates = [];
  let _stySeen = null;

  function _spStories(w) {
    const section = document.getElementById("love-story");
    const list = document.getElementById("love-story-list");
    if (!section || !list) return;
    const events = Array.isArray(w.love_story) ? w.love_story : [];
    if (!events.length) {
      section.style.display = "none";
      return;
    }
    section.style.display = "";

    const esc = escapeHtml;
    const img = (ev, cls) =>
      ev.image_url
        ? `<img src="${cxImgSrc(ev.image_url)}" alt="" class="${cls}" style="object-position:${cxFocal(ev.focal_point)}">`
        : "";
    const many = events.length > 1;
    _styDates = events.map((ev) => ev.date || "");

    list.innerHTML = `
      <div class="sp-sty">
        <div class="sp-sty-bars">${events.map(() => "<i></i>").join("")}</div>
        <div class="sp-sty-head">
          <span class="sp-sty-av">${esc(_initial(w.groom_name))}&amp;${esc(_initial(w.bride_name))}</span>
          <span class="truncate">${esc(w.groom_name || "")} &amp; ${esc(w.bride_name || "")}</span>
          <small class="sp-sty-yr"></small>
        </div>
        ${events
          .map(
            (ev) => `<div class="sp-sty-s">${img(ev, "sp-sty-img")}<div class="sp-sty-cap">
              ${ev.date ? `<span class="sp-sty-chip">${esc(ev.date)}</span>` : ""}
              ${ev.title ? `<div class="cx-h text-[36px] leading-[1.05] mt-3">${esc(ev.title)}</div>` : ""}
              ${ev.content ? `<p>${esc(ev.content)}</p>` : ""}
            </div></div>`,
          )
          .join("")}
        ${many ? `<button type="button" class="sp-sty-nav is-prev" data-sty="-1" aria-label="Mốc trước"></button><button type="button" class="sp-sty-nav is-next" data-sty="1" aria-label="Mốc sau"></button>` : ""}
      </div>
      ${many ? `<div class="sp-sty-th">${events.map((ev, i) => `<button type="button" data-sty-go="${i}" aria-label="Mốc ${esc(ev.date || String(i + 1))}">${img(ev, "")}<span>${esc(ev.date || "")}</span></button>`).join("")}</div>` : ""}`;

    // Nghe ở khung cha MỘT lần — renderWedding chạy lại thì chỉ thay ruột.
    if (!list.dataset.styBound) {
      list.dataset.styBound = "1";
      list.addEventListener("click", (e) => {
        const b = e.target.closest("[data-sty], [data-sty-go]");
        if (!b) return;
        _styGo(b.dataset.styGo != null ? Number(b.dataset.styGo) : _styCur + Number(b.dataset.sty));
      });
      list.addEventListener("animationend", (e) => {
        if (e.target.closest(".sp-sty-bars")) _styGo(_styCur + 1);
      });
    }

    // Vạch chỉ chạy khi khung đang trong tầm nhìn — chưa mở thiệp / cuộn qua thì dừng.
    const frame = list.querySelector(".sp-sty");
    frame.classList.add("is-paused");
    _stySeen?.disconnect();
    _stySeen = new IntersectionObserver((es) => es.forEach((e) => frame.classList.toggle("is-paused", !e.isIntersecting)), {
      threshold: 0.5,
    });
    _stySeen.observe(frame);
    _styGo(0);
  }

  function _styGo(n) {
    const list = document.getElementById("love-story-list");
    const total = _styDates.length;
    if (!list || !total) return;
    _styCur = (n + total) % total;
    const q = (sel) => list.querySelectorAll(sel);
    q(".sp-sty-s").forEach((el, i) => el.classList.toggle("is-on", i === _styCur));
    q(".sp-sty-th button").forEach((el, i) => el.classList.toggle("is-on", i === _styCur));
    const bars = q(".sp-sty-bars i");
    bars.forEach((el, i) => (el.className = i < _styCur ? "is-done" : ""));
    const bar = bars[_styCur];
    void bar.offsetWidth; // gỡ rồi gắn lại lớp chạy → animation bắt đầu lại từ đầu
    bar.className = total > 1 && !_still() ? "is-run" : "is-done";
    const yr = list.querySelector(".sp-sty-yr");
    if (yr) yr.textContent = _styDates[_styCur];
  }

  // ============= ALBUM: DÀN TRANG TẠP CHÍ =============
  // Mỗi khối là lưới hai cột chia NỬA HÀNG: cột rộng gồm khối chữ + ảnh ngang, mỗi
  // thứ chiếm 2 nửa hàng; ảnh dọc ở cột hẹp dừng giữa một ảnh ngang nên hai cột
  // so le như trang tạp chí. Từ _MAG_SPLIT ảnh chia hai khối: khối 1 chữ bên phải
  // (#sp-mag-note), khối 2 lật cột, chữ bên trái (#sp-mag-note-2). Ảnh KHÔNG lazy
  // (#main-card ẩn tới khi mở thiệp).
  const _MAG_SPLIT = 6;

  // Theo số ảnh của khối: [nửa hàng bắt đầu, số nửa hàng, tỉ lệ ảnh ngang].
  // Khối chữ luôn ở nửa hàng 1–2 của cột rộng.
  const _MAG_PLANS = {
    1: { tall: [[1, 2]], wide: [] },
    2: { tall: [[1, 4]], wide: [[3, 2, "is-r21"]] },
    3: { tall: [[1, 3], [4, 3]], wide: [[3, 4, "is-r11"]] },
    4: { tall: [[1, 3], [4, 3]], wide: [[3, 2, "is-r32"], [5, 2, "is-r32"]] },
    5: {
      tall: [[1, 3], [4, 5]],
      wide: [[3, 2, "is-r21"], [5, 2, "is-r21"], [7, 2, "is-r21"]],
    },
  };

  function renderGallery(images, focalPoints) {
    const grid = document.getElementById("gallery-grid");
    if (!grid) return;
    const notes = [
      document.getElementById("sp-mag-note"),
      document.getElementById("sp-mag-note-2"),
    ];

    // Chưa có ảnh → 4 ô minh hoạ để khách hình dung bố cục lúc đang soạn.
    const urls = images?.length
      ? images.map(getImageUrl)
      : Array(4)
          .fill(null)
          .map(() => createPlaceholderSVG("Chưa có ảnh"));

    // Kho ảnh của lightbox dùng chung — phải khớp thứ tự với lưới.
    lightboxImages.length = 0;
    lightboxImages.push(...urls);

    const place = (el, col, row, span) => {
      el.style.gridColumn = col;
      el.style.gridRow = `${row} / span ${span}`;
      return el;
    };
    const cell = (i, cls) => {
      const fp = focalPoints?.[images?.[i]];
      const el = document.createElement("div");
      el.className = `sp-mag-img ${cls} cursor-pointer`;
      el.innerHTML = `<img src="${cxImgSrc(urls[i])}" alt=""
        style="object-position:${cxFocal(fp)}">`;
      el.addEventListener("click", () => openLightbox(i));
      return el;
    };

    const n = urls.length;
    const sizes = n >= _MAG_SPLIT ? [Math.ceil(n / 2), Math.floor(n / 2)] : [n];
    grid.innerHTML = "";
    let i = 0;
    sizes.forEach((k, b) => {
      const plan = _MAG_PLANS[Math.min(k, 5)];
      const [tc, wc] = b === 1 ? [2, 1] : [1, 2];
      const page = document.createElement("div");
      page.className = b === 1 ? "sp-mag is-flip" : "sp-mag";
      if (notes[b]) page.appendChild(place(notes[b], wc, 1, 2));
      // Đặt ảnh theo thứ tự nửa hàng bắt đầu → đọc từ trên xuống, dọc trước ngang.
      const slots = [
        ...plan.tall.map(([r, s]) => [r, 0, s, tc, "is-tall"]),
        ...plan.wide.map(([r, s, ratio]) => [r, 1, s, wc, ratio]),
      ].sort((a, c) => a[0] - c[0] || a[1] - c[1]);
      slots.forEach(([r, , s, c, cls]) => page.appendChild(place(cell(i++, cls), c, r, s)));
      grid.appendChild(page);
    });
  }
})();
