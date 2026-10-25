// Mẫu SỚM HÔM CÓ NHAU — thiệp trang dài nền trắng tối giản, ảnh xen ca dao. Chỉ KHAI
// BÁO: window.CX_THEME + renderWedding + phần đặc thù (album theo bố cục cố định, khối ngày
// lớn, lịch tháng đè ảnh). Phần "chạy" nằm ở core/helpers/theme-boot.js.
// Bọc IIFE: `const` cấp cao nhất của script cổ điển là biến toàn cục.

(function () {
  window.CX_THEME = {
    // Trùng TÊN THƯ MỤC và cột `templates.template_name`.
    id: "som-hom-co-nhau",

    wishesMode: "card",
    giftBox: "mungcuoi_ivory",

    music: { variant: "mini", chrome: "fixed-corner", art: "couple" },

    // Bộ màu MẶC ĐỊNH của mẫu — bản khai máy đọc được của đúng những giá trị
    // :root trong theme.css (nguồn sự thật). Trang Thiết lập đọc nó để hiện mục
    // "Mặc định"; theme_setting.palette ghi đè lên trên lúc chạy.
    // Sinh lại bằng: node scripts/check-theme-palette.mjs --write
    palette: {
      heading: "#3b2a4d",
      body: "#3a3342",
      accent: "#7b5ea7",
      accent_soft: "#e9e1f3",
      on_accent: "#ffffff",
      on_image: "#ffffff",
      on_lightbox: "#ffffff",
      card_bg: "#ffffff",
      page_bg: "#f5f1f9",
      surface: "#f7f3fb",
      band: "#f3edf9",
      panel: "#ffffff",
      panel_warm: "#fbf8fd",
      cover: "#ffffff",
      cover_mid: "#f3edf9",
      cover_veil: "#ffffff",
      lightbox_bg: "#000000",
      line: "#e6ddef",
      shadow: "#2a1d38",
      scrim: "#2a1d38",
      deco: "#9466c9",
      deco_soft: "#eadff6",
      deco_2: "#756b80",
      deco_2_soft: "#e6ddef",
      shine_from: "#ffffff",
      shine_mid: "#f3edf9",
      shine_to: "#e6ddef",
    },

    swatches: ["#2a1d38", "#3b2a4d", "#7b5ea7", "#9466c9", "#756b80", "#e9e1f3", "#f5f1f9", "#ffffff"],

    wishes: {
      bubble: "#f7f3fb",
      text: "#3a3342",
      accent: "#7b5ea7",
      btn: "#3b2a4d",
    },

    // Chuyển động do shMotion() của mẫu lo theo từng phần tử (bay vào + parallax), nên
    // hiệu ứng mục chung trỏ vào id không tồn tại để hai bên không chồng nhau.
    reveal: ["#sh-no-reveal"],
    suggest: "#section-footer",
    skipSteps: [],
    loveStory: "short",
    onOpen: null,
  };

  const _isGroom = isGroomSide();
  const _pad = (n) => String(Math.max(0, n)).padStart(2, "0");

  // ============= MÀN BÌA: MỞ PHONG BÌ =============
  // Nhạc bật NGAY trong cú chạm (cxMusicOnOpen — iOS chỉ cho phát khi có cú chạm), rồi
  // chạy cảnh: dấu sáp tan → ảnh bìa rút lên, hai ảnh nấp xoè ra → phong bì cùng bó hoa
  // chìm xuống; xong mới openInvitation(). Gọi lại openInvitation không bật nhạc lần hai.

  const OPEN_MS = 2600;
  let _coverOpening = false;

  function shOpenCover() {
    if (_coverOpening) return;
    _coverOpening = true;
    window.cxMusicOnOpen?.();
    const cover = document.getElementById("sh-cover");
    if (!cover) {
      window.openInvitation();
      return;
    }
    shBurst();
    cover.classList.add("is-open");
    setTimeout(() => window.openInvitation(), OPEN_MS);
  }

  const _rnd = (a, b) => a + Math.random() * (b - a);

  // Cánh hoa bung từ miệng phong bì, xoè hình quạt hướng lên rồi bồng bềnh rơi.
  function shBurst() {
    const box = document.querySelector(".sh-burst");
    if (!box) return;
    const n = 22;
    box.innerHTML = Array.from({ length: n }, (_, i) => {
      const a = ((-165 + (150 * i) / (n - 1)) * Math.PI) / 180;
      const d = _rnd(110, 230);
      return `<i style="--s:${_rnd(8, 16).toFixed(0)}px;--x:${(Math.cos(a) * d).toFixed(0)}px;--y:${(Math.sin(a) * d).toFixed(0)}px;--rot:${_rnd(-220, 220).toFixed(0)}deg;--dl:${_rnd(0, 260).toFixed(0)}ms"></i>`;
    }).join("");
  }

  // Cánh hoa rơi thưa lúc chờ mở bìa. Độ trễ âm để vừa vào đã có cánh giữa màn.
  function shPetals() {
    const box = document.querySelector(".sh-petals");
    if (!box || box.childElementCount) return;
    box.innerHTML = Array.from({ length: 10 }, () => {
      const t = _rnd(11, 18);
      return `<i style="left:${_rnd(0, 100).toFixed(0)}%;--s:${_rnd(8, 14).toFixed(0)}px;--t:${t.toFixed(1)}s;--dl:${(-_rnd(0, t)).toFixed(1)}s;--sw:${_rnd(-40, 40).toFixed(0)}px"></i>`;
    }).join("");
  }

  // Uỷ quyền trên document: <x-button> tự thay mình bằng <button> lúc nạp, gắn thẳng là
  // dính vào thẻ cũ. touchend + preventDefault vì iOS Chrome hay nuốt click.
  const _isOpener = (t) => t?.closest?.("#sh-env, #sh-open-btn");
  document.addEventListener("click", (e) => _isOpener(e.target) && shOpenCover());
  document.addEventListener(
    "touchend",
    (e) => {
      if (!_isOpener(e.target)) return;
      e.preventDefault();
      shOpenCover();
    },
    { passive: false },
  );
  document.addEventListener("keydown", (e) => {
    if ((e.key === "Enter" || e.key === " ") && e.target?.id === "sh-env") {
      e.preventDefault();
      shOpenCover();
    }
  });

  function renderWedding(w) {
    if (!w || !w.is_active) return;

    const side = _isGroom ? "groom" : "bride";
    const gallery = Array.isArray(w.gallery_images) ? w.gallery_images : [];
    const galleryFp = w.image_focal_points?.gallery_images;

    // --- Màn bìa + mở đầu (ảnh màn đầu nhận src TRƯỚC setupMusic) ---
    renderCover(w);
    shPetals();
    renderHero(w, false);
    if (w.story_quote) setText("story-quote", w.story_quote);

    const isVuQuy = !_isGroom && cxEnabled(w.vu_quy_enabled);
    const ceremonyName = isVuQuy ? "Lễ Vu Quy" : w.ceremony_name || "Lễ Thành Hôn";
    const ceremonyTime = isVuQuy ? w.vu_quy_time : w.ceremony_time;
    const ceremonyLoc = isVuQuy ? w.vu_quy_location : w.ceremony_location || "";

    const cd = w.ceremony_date ? new Date(w.ceremony_date + "T00:00:00") : null;
    if (cd && !isNaN(cd)) {
      const dmy = `${_pad(cd.getDate())}.${_pad(cd.getMonth() + 1)}.${cd.getFullYear()}`;
      setText("sh-post-date", ceremonyTime ? `${ceremonyTime} · ${dmy}` : dmy);
      setText("sh-cover-date", dmy);
      setText("sh-date-dot", dmy);
      setText("sh-cer-year", String(cd.getFullYear()));
      setText("sh-cer-month", _pad(cd.getMonth() + 1));
    }

    shFillShots(gallery, galleryFp);

    // --- Nhạc nền ---
    setupMusic(w.music_url, w.enable_music);

    // --- Gia đình ---
    renderCoupleInfo(w);
    cxToggle("section-family", cxEnabled(w.enable_family));

    // --- Thư mời ---
    setText("invite-groom", w.groom_name, "----------");
    setText("invite-bride", w.bride_name, "----------");
    setText("ceremony-event-name", ceremonyName);
    renderCeremonyDate(w.ceremony_date, ceremonyTime, w.ceremony_lunar);
    if (cd && !isNaN(cd)) setText("invite-day", _pad(cd.getDate()));
    if (ceremonyLoc) {
      setText("ceremony-location-text", ceremonyLoc);
      cxToggle("ceremony-location-wrap", true);
    }

    renderMusicSummary(w, {
      ceremonyName,
      ceremonyTime,
      ceremonyLocation: ceremonyLoc,
    });

    // --- Tiệc cưới + lịch tháng đè ảnh ---
    const partyDate = w[`${side}_party_date`];
    setText("party-section-label", "Tiệc Mừng " + ceremonyName);
    renderPartyDate(partyDate, w[`${side}_party_time`], w[`${side}_party_lunar`], w[`${side}_party_location`], "full");
    shRenderCalendar(partyDate || w.ceremony_date, w.ceremony_date);
    cxToggle("section-party", cxEnabled(w.enable_party));

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

    // --- Lịch trình ---
    if (cxEnabled(w.enable_timeline)) {
      shRenderTimeline(w.timeline, side, partyDate, w.ceremony_date, ceremonyName);
    }

    // --- Chuyện tình yêu ---
    if (cxEnabled(w.enable_love_story)) {
      shRenderLoveStory(w.love_story);
    } else {
      cxToggle("love-story", false);
    }

    // --- Album ảnh ---
    if (cxEnabled(w.enable_photos)) {
      renderGallery(gallery, galleryFp);
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

    shMotion();
  }

  window.renderWedding = renderWedding;

  // Ảnh trong #main-card của mẫu có bìa KHÔNG lazy (xem CLAUDE.md).
  function shImg(url, fp) {
    return `<img src="${cxImgSrc(url)}" alt="" class="w-full h-full object-cover"
      style="object-position:${cxFocal(fp)}" />`;
  }

  // Ô [data-sh-shot] (nền lịch tháng) lấy một ảnh album: "last" = ảnh cuối.
  function shFillShots(images, focal) {
    document.querySelectorAll("[data-sh-shot]").forEach((slot) => {
      const key = slot.getAttribute("data-sh-shot");
      if (!images.length) {
        slot.innerHTML = "";
        slot.classList.add("is-empty");
        return;
      }
      const idx = key === "last" ? images.length - 1 : Number(key) % images.length;
      slot.classList.remove("is-empty");
      slot.innerHTML = shImg(images[idx], focal?.[images[idx]]);
    });
  }

  // ============= ALBUM ẢNH — đổ lần lượt vào các hàng [data-sh-take] =============
  // Hàng lấy đủ số ảnh của nó (thiếu thì lấy phần còn lại); khối không còn ảnh nào thì ẩn
  // cả khối kể cả câu thơ. "rest" = mọi ảnh còn dư.

  function renderGallery(images, focalPoints) {
    const section = document.getElementById("section-photos");
    if (!section) return;

    const urls = images?.length
      ? images.map(getImageUrl)
      : Array(4)
          .fill(null)
          .map(() => createPlaceholderSVG("Chưa có ảnh"));

    lightboxImages.length = 0;
    lightboxImages.push(...urls);

    let next = 0;
    section.querySelectorAll(".sh-row").forEach((row) => {
      const want = row.getAttribute("data-sh-take");
      const take = want === "rest" ? urls.length - next : Math.min(Number(want) || 1, urls.length - next);
      row.innerHTML = "";
      row.classList.toggle("hidden", take <= 0);
      row.setAttribute("data-sh-n", String(Math.max(0, take)));
      for (let k = 0; k < take; k++) {
        const i = next++;
        const cell = document.createElement("div");
        cell.className = "sh-cell";
        cell.innerHTML = shImg(urls[i], focalPoints?.[images?.[i]]);
        cell.addEventListener("click", () => openLightbox(i));
        row.appendChild(cell);
      }
    });

    section.querySelectorAll(".sh-blk").forEach((blk) => {
      const has = [...blk.querySelectorAll(".sh-row")].some((r) => !r.classList.contains("hidden"));
      blk.classList.toggle("hidden", !has);
    });
  }

  // ============= LỊCH THÁNG ĐÈ ẢNH =============
  // Tuần bắt đầu Thứ Hai; ngày tiệc + ngày lễ (nếu cùng tháng) khoanh tròn.

  function shRenderCalendar(mainDate, otherDate) {
    const box = document.getElementById("sh-calendar");
    if (!box || !mainDate) return;
    const d = new Date(mainDate + "T00:00:00");
    if (isNaN(d)) return;
    const y = d.getFullYear();
    const m = d.getMonth();
    const marked = new Set([d.getDate()]);
    if (otherDate) {
      const o = new Date(otherDate + "T00:00:00");
      if (o.getFullYear() === y && o.getMonth() === m) marked.add(o.getDate());
    }
    setText("sh-cal-month", `Tháng ${m + 1} · ${y}`);

    const lead = (new Date(y, m, 1).getDay() + 6) % 7;
    const days = new Date(y, m + 1, 0).getDate();
    let html = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((h) => `<div class="sh-cal-h">${h}</div>`).join("");
    html += "<div></div>".repeat(lead);
    for (let i = 1; i <= days; i++) {
      html += `<div class="sh-cal-d${marked.has(i) ? " is-on" : ""}" style="--i:${lead + i}"><span>${i}</span></div>`;
    }
    box.innerHTML = html;
  }

  // ============= LỊCH TRÌNH — dạng chương trình in, mỗi mốc một dòng =============
  // Lọc theo nhà như renderTimeline dùng chung; mỗi nhóm (lễ / tiệc) mở bằng dòng tên +
  // ngày, mốc là "việc ······ giờ" nối bằng đường chấm.

  function shRenderTimeline(items, side, partyDate, ceremonyDate, ceremonyName) {
    const list = document.getElementById("timeline-list-render");
    if (!list || !Array.isArray(items)) return;
    const relevant = items.filter((it) => {
      const t = it.type || "ceremony";
      return t === "ceremony" || (side === "groom" ? t === "party" : t === "bride-party");
    });
    if (!relevant.length) return;

    const groups = cxSortTimelineGroups([
      { label: "Tiệc Cưới", date: partyDate, items: relevant.filter((i) => (i.type || "ceremony") !== "ceremony") },
      { label: ceremonyName, date: ceremonyDate, items: relevant.filter((i) => (i.type || "ceremony") === "ceremony") },
    ]);

    list.innerHTML = groups
      .map((g) => {
        const dt = g.date ? new Date(g.date + "T00:00:00") : null;
        const day = dt && !isNaN(dt) ? `${_pad(dt.getDate())}.${_pad(dt.getMonth() + 1)}` : "";
        const rows = g.items
          .map(
            (it) => `<div class="sh-plan-row">
              <span class="cx-t sh-plan-title">${escapeHtml(it.title || "")}</span>
              <span class="sh-plan-dots"></span>
              <span class="cx-h sh-plan-time">${escapeHtml(it.time || "")}</span>
            </div>`,
          )
          .join("");
        return `<div class="sh-plan-group">
          <div class="cx-t sh-plan-label"><span>${escapeHtml(g.label)}</span>${day ? `<b>${day}</b>` : ""}</div>
          ${rows}
        </div>`;
      })
      .join("");
    cxToggle("section-timeline", true);
  }

  // ============= CHUYỆN TÌNH YÊU — polaroid + năm chữ chìm =============
  // Mốc chẵn ảnh lệch trái, mốc lẻ lệch phải; năm to nằm phía đối diện, sau ảnh.
  // Ngày dài (vd "Tháng 3, 2019") thì thu cỡ chữ chìm để khỏi tràn.

  function shRenderLoveStory(events) {
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
        const date = String(ev.date || "");
        const img = ev.image_url
          ? `<div class="sh-snap"><div class="sh-snap-img"><img src="${cxImgSrc(ev.image_url)}" alt="" class="w-full h-full object-cover" style="object-position:${cxFocal(ev.focal_point)}" /></div></div>`
          : "";
        return `<div class="sh-mile${i % 2 ? " is-r" : ""}${img ? "" : " no-img"}">
          ${date ? `<div class="cx-h sh-mile-year${date.length > 6 ? " is-long" : ""}">${escapeHtml(date)}</div>` : ""}
          ${img}
          <div class="sh-mile-text">
            <div class="cx-t sh-mile-no">${_pad(i + 1)}</div>
            ${ev.title ? `<div class="cx-h sh-mile-title">${escapeHtml(ev.title)}</div>` : ""}
            ${ev.content ? `<div class="cx-t sh-mile-body">${escapeHtml(ev.content)}</div>` : ""}
          </div>
        </div>`;
      })
      .join("");
  }

  // ============= CHUYỂN ĐỘNG KHI VUỐT =============
  // Gắn data-fx (kiểu bay vào, CSS ở theme.css) + --d (độ trễ) lên phần tử, cuộn tới thì
  // thêm .is-in một lần. Ảnh trong .sh-par trôi chậm hơn trang (parallax) bằng `translate`
  // — tách khỏi `scale` của hiệu ứng vào nên hai thứ không đè nhau.

  // Máy bật giảm chuyển động chỉ bỏ parallax (trôi theo từng nhịp cuộn); hiệu ứng vào vẫn chạy.
  const _reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  let _io = null;
  let _parBound = false;

  // Hàng ảnh theo kiểu → cách từng ô bay vào. Hàng cùng kiểu xuất hiện lần sau thì đảo
  // hướng để nhịp trái/phải xen kẽ.
  const ROW_FX = {
    tall: () => ["rise"],
    wide: (n) => [n % 2 ? "right" : "left"],
    pano: (n) => [n % 2 ? "left" : "right"],
    pano2: () => ["left", "right"],
    pair: (n) => (n % 2 ? ["right", "left"] : ["left", "right"]),
    side: () => ["left"],
    offset: () => ["tilt"],
    quad: () => ["pop", "pop", "pop", "pop"],
    grid: () => ["pop"],
  };
  const PARALLAX = new Set(["tall", "wide", "pano", "pano2", "offset"]);

  function _fx(el, kind, delay) {
    if (!el) return;
    el.classList.add("sh-fx");
    el.setAttribute("data-fx", kind);
    if (delay) el.style.setProperty("--d", `${delay}ms`);
  }

  function shMotion() {
    const card = document.getElementById("main-card");
    if (!card) return;

    _fx(document.querySelector(".sh-kicker"), "fade");
    _fx(document.querySelector(".sh-post-title"), "fade", 80);
    _fx(document.querySelector(".sh-post-meta"), "fade", 160);
    _fx(document.getElementById("story-quote"), "fade", 240);
    const hero = document.querySelector("#section-hero .sh-frame");
    _fx(hero, "rise", 200);
    hero?.classList.add("sh-par");

    card.querySelectorAll("#section-family .sh-couple").forEach((row) => {
      row.querySelectorAll(".sh-person").forEach((p, i) => _fx(p, i ? "right" : "left", i * 120));
    });
    // Chữ nằm trong khối đã có hiệu ứng thì đi theo khối, không gắn lồng thêm.
    card.querySelectorAll(".sh-poem, .sh-date-dot, .sh-tt").forEach((el) => {
      if (!el.parentElement.closest(".sh-fx") && !el.classList.contains("sh-fx")) _fx(el, "fade");
    });
    card.querySelectorAll(".sh-heart").forEach((el) => _fx(el, "zoom"));
    card.querySelectorAll(".sh-ava").forEach((el, i) => _fx(el, "zoom", (i % 2) * 140));
    card.querySelectorAll(".sh-script").forEach((el) => _fx(el, "write", 300));

    const seen = {};
    card.querySelectorAll("#section-photos .sh-row").forEach((row) => {
      const shape = row.getAttribute("data-sh-shape");
      const n = (seen[shape] = (seen[shape] ?? -1) + 1);
      const kinds = (ROW_FX[shape] || ROW_FX.grid)(n);
      row.querySelectorAll(".sh-cell").forEach((cell, i) => {
        _fx(cell, kinds[i % kinds.length], i * 120);
        if (shape === "quad" || shape === "grid") cell.style.setProperty("--r", i % 2 ? "2deg" : "-2deg");
        if (PARALLAX.has(shape)) cell.classList.add("sh-par");
      });
    });

    // Lịch trình: dòng tên nhóm hiện trước, từng mốc nối đuôi nhau, đường chấm kéo dài ra.
    card.querySelectorAll(".sh-plan-group").forEach((g) => {
      _fx(g.querySelector(".sh-plan-label"), "fade");
      g.querySelectorAll(".sh-plan-row").forEach((row, i) => {
        _fx(row, "fade", 80 + i * 70);
        _fx(row.querySelector(".sh-plan-dots"), "line", 200 + i * 70);
      });
    });

    // Chuyện tình: năm chữ chìm lướt ngược phía ảnh, ảnh rơi xuống rồi xoay về độ nghiêng.
    card.querySelectorAll(".sh-mile").forEach((m) => {
      const right = m.classList.contains("is-r");
      _fx(m.querySelector(".sh-mile-year"), right ? "left" : "right");
      const snap = m.querySelector(".sh-snap");
      if (snap) {
        _fx(snap, "pop", 120);
        snap.style.setProperty("--r", right ? "12deg" : "-12deg");
      }
      _fx(m.querySelector(".sh-mile-text"), "fade", 280);
    });

    _fx(document.querySelector(".sh-bd-line"), "line", 150);
    _fx(document.querySelector(".sh-names"), "fade", 100);
    const cal = document.querySelector(".sh-calcard");
    _fx(cal, "rise");
    document.querySelector(".sh-calcard-bg")?.classList.add("sh-par");
    _fx(document.getElementById("sh-calendar"), "days");
    card.querySelectorAll(".sh-rsvp-btns .sh-btn, #section-gift [data-cx-gift] > div").forEach((el, i) =>
      _fx(el, "fade", (i % 2) * 120),
    );
    _fx(document.getElementById("map-link"), "rise");

    const items = card.querySelectorAll(".sh-fx");
    if (!("IntersectionObserver" in window)) {
      items.forEach((el) => el.classList.add("is-in"));
      return;
    }
    _io?.disconnect();
    _io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          // Cao 0 = #main-card còn display:none (chưa mở bìa) → chờ lượt báo sau.
          const r = e.boundingClientRect;
          if (!r.height || (!e.isIntersecting && r.top > 0)) return;
          e.target.classList.add("is-in");
          _io.unobserve(e.target);
        });
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    items.forEach((el) => {
      if (!el.classList.contains("is-in")) _io.observe(el);
    });
    _bindParallax();
  }

  // Lệch tối đa 7% chiều cao khung; ảnh cao 116% nên không lộ mép.
  function _bindParallax() {
    if (_parBound || _reduced) return;
    _parBound = true;
    let ticking = false;
    const run = () => {
      ticking = false;
      const vh = window.innerHeight;
      document.querySelectorAll(".sh-par").forEach((box) => {
        const img = box.querySelector("img");
        if (!img) return;
        const r = box.getBoundingClientRect();
        if (!r.height || r.bottom < -100 || r.top > vh + 100) return;
        const k = (r.top + r.height / 2 - vh / 2) / (vh / 2 + r.height / 2);
        img.style.translate = `0 ${(-k * r.height * 0.07).toFixed(1)}px`;
      });
    };
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(run);
    };
    // capture: bắt cả khung cuộn lồng, không chỉ window.
    document.addEventListener("scroll", onScroll, { passive: true, capture: true });
    window.addEventListener("resize", onScroll, { passive: true });
    onScroll();
  }
})();
