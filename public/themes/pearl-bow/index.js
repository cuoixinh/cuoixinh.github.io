// Mẫu PEARL BOW — "trang dài" nền trắng, nơ nhung đỏ đính ngọc trai, ren vỏ sò.
// Chỉ KHAI BÁO: window.CX_THEME + renderWedding + phần đặc thù (ảnh xen giữa các
// mục, lịch tháng đè ảnh, đếm ngược tới giây, chuyện tình so le, lịch trình, album).
// Phần "chạy" nằm ở core/helpers/theme-boot.js. Bọc IIFE: `const` cấp cao nhất là biến toàn cục.

(function () {
  window.CX_THEME = {
    // Trùng TÊN THƯ MỤC và cột `templates.template_name`.
    id: "pearl-bow",

    wishesMode: "card",
    giftBox: "hop_trai_tim",

    music: { variant: "disc", chrome: "fixed-corner", art: "couple" },

    // Bộ màu MẶC ĐỊNH của mẫu — bản khai máy đọc được của đúng những giá trị
    // :root trong theme.css (nguồn sự thật). Trang Thiết lập đọc nó để hiện mục
    // "Mặc định"; theme_setting.palette ghi đè lên trên lúc chạy.
    // Sinh lại bằng: node scripts/check-theme-palette.mjs --write
    palette: {
      heading: "#2a1a1a",
      body: "#3d3333",
      accent: "#8b0f14",
      accent_soft: "#e9c9c9",
      on_accent: "#ffffff",
      on_image: "#ffffff",
      on_lightbox: "#ffffff",
      card_bg: "#ffffff",
      page_bg: "#f3efec",
      surface: "#f7f4f1",
      band: "#faf2f2",
      panel: "#ffffff",
      panel_warm: "#faf6f4",
      cover: "#ffffff",
      cover_mid: "#f7f4f1",
      cover_veil: "#ffffff",
      lightbox_bg: "#000000",
      line: "#e6dede",
      shadow: "#000000",
      scrim: "#000000",
      deco: "#8b0f14",
      deco_soft: "#f6e7e7",
      deco_2: "#cfc9c3",
      deco_2_soft: "#f7f4f1",
      shine_from: "#ffffff",
      shine_mid: "#f4f0ec",
      shine_to: "#c9c2bb",
    },

    swatches: [
      "#2a1a1a",
      "#3d3333",
      "#8b0f14",
      "#b3262c",
      "#e9c9c9",
      "#f6e7e7",
      "#cfc9c3",
      "#ece6e2",
      "#f7f4f1",
      "#ffffff",
    ],

    // Lời chúc theo tông đỏ nhung của mẫu (khách không chỉnh được).
    wishes: {
      bubble: "#faf6f4",
      text: "#3d3333",
      accent: "#8b0f14",
      btn: "#8b0f14",
    },

    reveal: [
      "#main-card section",
      "#main-card .pb-shot",
      "#love-story-list > *",
      "#gallery-grid > *",
    ],
    suggest: "#section-gift",
    skipSteps: [],

    // Mốc chuyện tình nằm cạnh ảnh, cột chữ hẹp.
    loveStory: "short",

    onOpen: null,
  };

  const _isGroom = isGroomSide();

  // ============= ĐỔ DỮ LIỆU LÊN THIỆP =============

  function renderWedding(w) {
    if (!w || !w.is_active) return;

    const side = _isGroom ? "groom" : "bride";
    const gallery = Array.isArray(w.gallery_images) ? w.gallery_images : [];
    const galleryFp = w.image_focal_points?.gallery_images;

    // --- Màn bìa + mở đầu (ảnh màn đầu nhận src TRƯỚC setupMusic) ---
    renderCover(w);
    renderHero(w, false);
    if (w.story_quote) setText("story-quote", w.story_quote);

    // Ảnh xen giữa các mục: 6 ảnh đầu của album + ảnh cuối cho lời cảm ơn.
    pbFillShots(gallery, galleryFp);

    // --- Nhạc nền ---
    setupMusic(w.music_url, w.enable_music);

    // --- Gia đình ---
    renderCoupleInfo(w);
    cxToggle("section-family", cxEnabled(w.enable_family));

    // --- Thư mời: nhà gái bật Vu Quy thì thay toàn bộ phần lễ ---
    const isVuQuy = !_isGroom && cxEnabled(w.vu_quy_enabled);
    const ceremonyName = isVuQuy ? "Lễ Vu Quy" : w.ceremony_name || "Lễ Thành Hôn";
    const ceremonyTime = isVuQuy ? w.vu_quy_time : w.ceremony_time;
    const ceremonyLoc = isVuQuy ? w.vu_quy_location : w.ceremony_location || "";

    setText("invite-groom", w.groom_name, "----------");
    setText("invite-bride", w.bride_name, "----------");
    setText("ceremony-event-name", ceremonyName);
    renderCeremonyDate(w.ceremony_date, ceremonyTime, w.ceremony_lunar);
    if (ceremonyLoc) {
      setText("ceremony-location-text", ceremonyLoc);
      cxToggle("ceremony-location-wrap", true);
    }

    renderMusicSummary(w, {
      ceremonyName,
      ceremonyTime,
      ceremonyLocation: ceremonyLoc,
    });

    // --- Lịch tháng + đếm ngược (theo ngày giờ lễ) ---
    const partyDate = w[`${side}_party_date`];
    pbRenderCalendar(w.ceremony_date, partyDate);
    pbCountdown(w.ceremony_date, ceremonyTime);

    // --- Tiệc cưới (mỗi nhà một ngày/giờ/nơi riêng) ---
    setText("party-section-label", "Tiệc Mừng " + ceremonyName);
    renderPartyDate(
      partyDate,
      w[`${side}_party_time`],
      w[`${side}_party_lunar`],
      w[`${side}_party_location`],
      "full",
    );
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

    // --- Lịch trình ngày cưới ---
    if (cxEnabled(w.enable_timeline)) {
      pbRenderTimeline(w.timeline, side, partyDate, w.ceremony_date, ceremonyName);
    }

    // --- Chuyện tình yêu ---
    if (cxEnabled(w.enable_love_story)) {
      pbRenderLoveStory(w.love_story);
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
  }

  window.renderWedding = renderWedding;

  const _pad = (n) => String(Math.max(0, n)).padStart(2, "0");

  // ============= ẢNH XEN GIỮA CÁC MỤC =============
  // Ô [data-pb-shot="i"] lấy ảnh album thứ i ("last" = ảnh cuối, chỉ khi album
  // dài hơn số ô xen). Thiếu ảnh thì ô tự ẩn, không để khung trống.

  const PB_SHOT_COUNT = 6;

  function pbShotImg(url, fp, eager) {
    return `<img src="${cxImgSrc(url)}" alt="" class="w-full h-full object-cover"
      style="object-position:${cxFocal(fp)}"${eager ? "" : ' loading="lazy"'} />`;
  }

  function pbFillShots(images, focal) {
    document.querySelectorAll("[data-pb-shot]").forEach((slot) => {
      const key = slot.getAttribute("data-pb-shot");
      const idx = key === "last" ? images.length - 1 : Number(key);
      const usable = key === "last" ? images.length > PB_SHOT_COUNT : idx < images.length;
      if (!usable || idx < 0) {
        slot.classList.add("hidden");
        return;
      }
      slot.classList.remove("hidden");
      // Ảnh trong #main-card của mẫu có bìa KHÔNG lazy (xem CLAUDE.md).
      slot.innerHTML = pbShotImg(images[idx], focal?.[images[idx]], true);
    });
    // Cặp ảnh thiếu một tấm thì bỏ cả nơ rủ ở giữa.
    const duo = document.querySelector(".pb-duo");
    if (duo) duo.classList.toggle("is-solo", images.length < 5);
  }

  // ============= LỊCH THÁNG =============
  // Tuần bắt đầu Thứ Hai; khoanh tròn ngày lễ (+ ngày tiệc nếu cùng tháng), năm
  // in mờ to phía sau lưới ngày.

  function pbRenderCalendar(ceremonyDate, partyDate) {
    const box = document.getElementById("pb-calendar");
    if (!box || !ceremonyDate) return;
    const d = new Date(ceremonyDate);
    const y = d.getFullYear();
    const m = d.getMonth();
    const marked = new Set([d.getDate()]);
    if (partyDate) {
      const p = new Date(partyDate);
      if (p.getFullYear() === y && p.getMonth() === m) marked.add(p.getDate());
    }

    setText("pb-cal-md", `${_pad(d.getDate())} / ${_pad(m + 1)}`);
    setText("pb-cal-year", String(y));

    const lead = (new Date(y, m, 1).getDay() + 6) % 7;
    const days = new Date(y, m + 1, 0).getDate();
    const heads = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"]
      .map((h) => `<div class="pb-cal-h">${h}</div>`)
      .join("");
    let cells = "<div></div>".repeat(lead);
    for (let i = 1; i <= days; i++) {
      cells += `<div class="pb-cal-d${marked.has(i) ? " is-on" : ""}"><span>${i}</span></div>`;
    }
    box.innerHTML = heads + cells;
  }

  // ============= ĐẾM NGƯỢC =============
  // Tính từ ngày + giờ lễ, nhịp mỗi giây. Không có ngày thì ẩn cả mục lịch;
  // qua giờ lễ thì về 00 và dừng hẳn.

  let _cdTimer = null;

  function pbCountdown(dateStr, timeStr) {
    if (_cdTimer) clearInterval(_cdTimer);
    _cdTimer = null;
    const target = dateStr ? new Date(`${dateStr}T${timeStr || "00:00"}:00`).getTime() : NaN;
    if (isNaN(target)) {
      cxToggle("section-countdown", false);
      return;
    }
    cxToggle("section-countdown", true);

    function tick() {
      const left = Math.max(0, Math.floor((target - Date.now()) / 1000));
      setText("cd-days", _pad(Math.floor(left / 86400)));
      setText("cd-hours", _pad(Math.floor((left % 86400) / 3600)));
      setText("cd-minutes", _pad(Math.floor((left % 3600) / 60)));
      setText("cd-seconds", _pad(left % 60));
      if (!left && _cdTimer) {
        clearInterval(_cdTimer);
        _cdTimer = null;
      }
    }

    tick();
    _cdTimer = setInterval(tick, 1000);
  }

  // ============= LỊCH TRÌNH =============
  // Lọc theo nhà như renderTimeline dùng chung, vẽ thành hàng giờ — việc nối bằng
  // vạch chấm, mỗi nhóm (lễ / tiệc) mở bằng tên + ngày.

  function pbRenderTimeline(items, side, partyDate, ceremonyDate, ceremonyName) {
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
        const dateLabel = dt ? ` · ${_pad(dt.getDate())}.${_pad(dt.getMonth() + 1)}` : "";
        const rows = g.items
          .map(
            (it) => `<div class="pb-plan-row">
              <span class="cx-h cx-a pb-plan-time">${escapeHtml(it.time || "")}</span>
              <span class="pb-plan-dots" aria-hidden="true"></span>
              <span class="cx-t pb-plan-title">${escapeHtml(it.title || "")}</span>
            </div>`,
          )
          .join("");
        return `<div class="pb-plan-group">
          <div class="cx-t pb-plan-label">${escapeHtml(g.label)}${escapeHtml(dateLabel)}</div>
          ${rows}
        </div>`;
      })
      .join("");
    cxToggle("section-timeline", true);
  }

  // ============= CHUYỆN TÌNH YÊU =============
  // Mốc so le: ảnh dọc lệch trái/phải xen với cột chữ (ngày Cinzel đỏ + tiêu đề +
  // nội dung), nơ nhỏ ngăn giữa các mốc.

  function pbRenderLoveStory(events) {
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
        const img = ev.image_url
          ? `<div class="pb-ls-photo">${pbShotImg(ev.image_url, ev.focal_point, true)}</div>`
          : "";
        return `<div class="pb-ls${i % 2 ? " is-flip" : ""}${img ? "" : " no-img"}">
          ${img}
          <div class="pb-ls-text">
            ${ev.date ? `<div class="cx-h cx-a pb-ls-date">${escapeHtml(ev.date)}</div>` : ""}
            ${ev.title ? `<div class="cx-t pb-ls-title">${escapeHtml(ev.title)}</div>` : ""}
            ${ev.content ? `<div class="cx-t pb-ls-body">${escapeHtml(ev.content)}</div>` : ""}
          </div>
        </div>`;
      })
      .join('<svg class="pb-bow-mini pb-ls-sep" aria-hidden="true"><use href="#pb-bow-mini"/></svg>');
  }

  // ============= ALBUM ẢNH =============
  // Ảnh còn lại sau các ô ảnh xen (hết ảnh thì lấy cả album), xếp nhịp: ảnh
  // ngang → thơ (+ hình bàn tiệc ở lượt đầu) → ảnh dọc → thơ → cặp ảnh… Câu thơ là
  // chữ CỐ ĐỊNH của mẫu. Bấm ảnh mở lightbox theo thứ tự album.

  const PB_ALBUM_LINES = [
    ["Em ôm hoa tươi bước về phía anh", "phút này, yêu thương chảy qua đầu ngón tay", "hẹn ước cả đời đã định", "mình cùng nắm tay đi tiếp nhé"],
    ["Yêu là chọn nhau giữa muôn người", "và chọn lại nhau mỗi sớm mai"],
    ["Cảm ơn vì đã đến", "và ở lại thật lâu."],
  ];

  function renderGallery(images, focalPoints) {
    const flow = document.getElementById("gallery-grid");
    if (!flow) return;

    const end = images.length > PB_SHOT_COUNT ? images.length - 1 : images.length;
    let own = images.slice(PB_SHOT_COUNT, end);
    if (!own.length) own = images.slice();
    const urls = own.length
      ? own.map(getImageUrl)
      : Array(2).fill(null).map(() => createPlaceholderSVG("Chưa có ảnh"));

    lightboxImages.length = 0;
    lightboxImages.push(...urls);

    const cell = (i) =>
      `<div class="pb-album-cell" data-lb="${i}">${pbShotImg(urls[i], focalPoints?.[own[i]], false)}</div>`;
    const poem = (k) =>
      `<div class="cx-t pb-poem pb-center pb-album-text">${PB_ALBUM_LINES[k % PB_ALBUM_LINES.length].map(escapeHtml).join("<br>")}</div>`;

    let html = "";
    let i = 0;
    let beat = 0;
    while (i < urls.length) {
      const kind = beat % 3;
      if (kind === 1 && i + 1 < urls.length) {
        html += `<div class="pb-album-pair">${cell(i)}${cell(i + 1)}</div>`;
        i += 2;
      } else {
        html += `<div class="pb-album-single ${kind === 0 ? "is-wide" : "is-tall"}">${cell(i)}</div>`;
        i += 1;
      }
      if (i < urls.length || beat === 0) html += poem(beat);
      if (beat === 0) html += '<svg class="pb-table" aria-hidden="true"><use href="#pb-table"/></svg>';
      beat++;
    }
    flow.innerHTML = html;
    flow.querySelectorAll("[data-lb]").forEach((el) =>
      el.addEventListener("click", () => openLightbox(Number(el.dataset.lb))),
    );
  }
})();
