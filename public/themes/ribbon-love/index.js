// Mẫu RIBBON LOVE — "trang dài" nền giấy kem, nơ ruy băng hồng, nhấn đỏ hồng.
// Chỉ KHAI BÁO: window.CX_THEME + renderWedding + phần đặc thù (ảnh xen giữa các
// mục, chuyện tình so le, lịch tháng, lưới lịch trình, album). Phần "chạy" nằm ở
// core/helpers/theme-boot.js. Bọc IIFE: `const` cấp cao nhất là biến toàn cục.

(function () {
  window.CX_THEME = {
    // Trùng TÊN THƯ MỤC và cột `templates.template_name`.
    id: "ribbon-love",

    wishesMode: "chat",
    giftBox: "floral_pink",

    // Đĩa nhạc neo góc phải như mẫu tham chiếu.
    music: { variant: "disc", chrome: "fixed-corner", art: "couple" },

    // Bộ màu MẶC ĐỊNH của mẫu — bản khai máy đọc được của đúng những giá trị
    // :root trong theme.css (nguồn sự thật). Trang Thiết lập đọc nó để hiện mục
    // "Mặc định"; theme_setting.palette ghi đè lên trên lúc chạy.
    // Sinh lại bằng: node scripts/check-theme-palette.mjs --write
    palette: {
      heading: "#5c1f2e",
      body: "#7b3644",
      accent: "#c92a5a",
      accent_soft: "#f1c6d3",
      on_accent: "#ffffff",
      on_image: "#ffffff",
      on_lightbox: "#ffffff",
      card_bg: "#f6f0e4",
      page_bg: "#efe7d8",
      surface: "#faf3e9",
      band: "#fbecee",
      panel: "#fffaf2",
      panel_warm: "#fffaf2",
      cover: "#f6f0e4",
      cover_mid: "#f1e6d6",
      cover_veil: "#f6f0e4",
      lightbox_bg: "#000000",
      line: "#ead9d3",
      shadow: "#000000",
      scrim: "#000000",
      deco: "#d98aa5",
      deco_soft: "#f6dbe4",
      deco_2: "#c92a5a",
      deco_2_soft: "#f1c6d3",
      shine_from: "#ffffff",
      shine_mid: "#f6dbe4",
      shine_to: "#d98aa5",
    },

    swatches: [
      "#5c1f2e",
      "#7b3644",
      "#c92a5a",
      "#e07a9a",
      "#f1c6d3",
      "#d98aa5",
      "#f6dbe4",
      "#ead9d3",
      "#f6f0e4",
      "#fffaf2",
      "#ffffff",
    ],

    // Lời chúc theo tông đỏ hồng của mẫu (khách không chỉnh được).
    wishes: {
      bubble: "#fffaf2",
      text: "#7b3644",
      accent: "#c92a5a",
      btn: "#c92a5a",
    },

    reveal: [
      "#main-card section",
      "#main-card .rl-shot",
      "#main-card .rl-caption",
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
    if (w.ceremony_date) {
      const d = new Date(w.ceremony_date);
      setText("rl-hero-date", `${_pad(d.getDate())}.${_pad(d.getMonth() + 1)}.${d.getFullYear()}`);
    }

    // Ảnh xen giữa các mục: 4 ảnh đầu của album + ảnh cuối cho lời cảm ơn.
    rlFillShots(gallery, galleryFp);

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

    // --- Tiệc cưới (mỗi nhà một ngày/giờ/nơi riêng) ---
    const partyDate = w[`${side}_party_date`];
    setText("party-section-label", "Tiệc Mừng " + ceremonyName);
    renderPartyDate(
      partyDate,
      w[`${side}_party_time`],
      w[`${side}_party_lunar`],
      w[`${side}_party_location`],
      "full",
    );
    cxToggle("section-party", cxEnabled(w.enable_party));

    rlRenderCalendar(w.ceremony_date, partyDate);

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
      rlRenderTimeline(w.timeline, side, partyDate, w.ceremony_date, ceremonyName);
    }

    // --- Chuyện tình yêu ---
    if (cxEnabled(w.enable_love_story)) {
      rlRenderLoveStory(w.love_story);
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

  const _pad = (n) => String(n).padStart(2, "0");

  // ============= ẢNH XEN GIỮA CÁC MỤC =============
  // Ô [data-rl-shot="i"] lấy ảnh album thứ i ("last" = ảnh cuối). Album trừ đi
  // những ảnh này (RL_SHOT_COUNT) — thiếu ảnh thì ô tự ẩn, không để khung trống.

  const RL_SHOT_COUNT = 4;

  function rlShotImg(url, fp, eager) {
    return `<img src="${cxImgSrc(url)}" alt="" class="w-full h-full object-cover"
      style="object-position:${cxFocal(fp)}"${eager ? "" : ' loading="lazy"'} />`;
  }

  function rlFillShots(images, focal) {
    document.querySelectorAll("[data-rl-shot]").forEach((slot) => {
      const key = slot.getAttribute("data-rl-shot");
      const idx = key === "last" ? images.length - 1 : Number(key);
      const usable = key === "last" ? images.length > RL_SHOT_COUNT : idx < images.length;
      if (!usable || idx < 0) {
        slot.classList.add("hidden");
        return;
      }
      slot.classList.remove("hidden");
      // Ảnh trong #main-card của mẫu có bìa KHÔNG lazy (xem CLAUDE.md).
      slot.innerHTML = rlShotImg(images[idx], focal?.[images[idx]], true);
    });
  }

  // ============= LỊCH THÁNG =============
  // Tuần bắt đầu Thứ Hai như mẫu tham chiếu; khoanh tròn ngày lễ (+ ngày tiệc nếu
  // cùng tháng), năm in mờ to phía sau.

  function rlRenderCalendar(ceremonyDate, partyDate) {
    const box = document.getElementById("rl-calendar");
    if (!box || !ceremonyDate) return;
    const d = new Date(ceremonyDate);
    const y = d.getFullYear();
    const m = d.getMonth();
    const marked = new Set([d.getDate()]);
    if (partyDate) {
      const p = new Date(partyDate);
      if (p.getFullYear() === y && p.getMonth() === m) marked.add(p.getDate());
    }

    setText("rl-cal-md", `${_pad(d.getDate())} / ${_pad(m + 1)}`);
    setText("rl-cal-year", String(y));

    const lead = (new Date(y, m, 1).getDay() + 6) % 7;
    const days = new Date(y, m + 1, 0).getDate();
    const heads = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"]
      .map((h) => `<div class="rl-cal-h">${h}</div>`)
      .join("");
    let cells = "<div></div>".repeat(lead);
    for (let i = 1; i <= days; i++) {
      const on = marked.has(i);
      cells += `<div class="rl-cal-d${on ? " is-on" : ""}"><span>${i}</span></div>`;
    }
    box.innerHTML = heads + cells;
  }

  // ============= LỊCH TRÌNH =============
  // Lọc theo nhà như renderTimeline dùng chung, nhưng vẽ thành lưới 3 cột: icon nét
  // + giờ + việc. Icon đi vòng theo thứ tự trong RL_PLAN_ICONS.

  const RL_PLAN_ICONS = ["rl-ic-arch", "rl-ic-rings", "rl-ic-glasses", "rl-ic-cake", "rl-ic-letter"];

  function rlRenderTimeline(items, side, partyDate, ceremonyDate, ceremonyName) {
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

    let n = 0;
    list.innerHTML = groups
      .map((g) => {
        const dt = g.date ? new Date(g.date + "T00:00:00") : null;
        const dateLabel = dt ? ` · ${_pad(dt.getDate())}.${_pad(dt.getMonth() + 1)}` : "";
        const cells = g.items
          .map((it) => {
            const icon = RL_PLAN_ICONS[n++ % RL_PLAN_ICONS.length];
            return `<div class="rl-plan-item">
              <svg class="rl-plan-ic cx-a" aria-hidden="true"><use href="#${icon}"/></svg>
              <div class="cx-h cx-a rl-plan-time">${escapeHtml(it.time || "")}</div>
              <div class="cx-t rl-plan-title">${escapeHtml(it.title || "")}</div>
            </div>`;
          })
          .join("");
        return `<div class="rl-plan-group">
          <div class="cx-h cx-a rl-title">${escapeHtml(g.label)}<span class="rl-plan-date">${escapeHtml(dateLabel)}</span></div>
          <div class="rl-plan-grid">${cells}</div>
        </div>`;
      })
      .join("");
    cxToggle("section-timeline", true);
  }

  // ============= CHUYỆN TÌNH YÊU =============
  // Mốc chẵn: ảnh đứng lệch phải, nơ đỏ nét mảnh ở góc, chữ canh giữa bên dưới.
  // Mốc lẻ: ảnh ngang tràn khung, chữ canh trái cạnh hình tháp bánh.

  function rlRenderLoveStory(events) {
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
          ? `<div class="rl-ls-photo">${rlShotImg(ev.image_url, ev.focal_point, true)}</div>`
          : "";
        const text = `
          ${ev.date ? `<div class="cx-h cx-a rl-ls-date">${escapeHtml(ev.date)}</div>` : ""}
          ${ev.title ? `<div class="cx-t rl-ls-title">${escapeHtml(ev.title)}</div>` : ""}
          ${ev.content ? `<div class="cx-t rl-poem rl-ls-body">${escapeHtml(ev.content)}</div>` : ""}`;
        if (i % 2 === 0) {
          return `<div class="rl-ls rl-ls-a${img ? "" : " no-img"}">
            ${img ? `<div class="rl-ls-frame">${img}<svg class="rl-ls-bow cx-a" aria-hidden="true"><use href="#rl-bow-line"/></svg></div>` : ""}
            <div class="rl-ls-text">${text}</div>
          </div>`;
        }
        return `<div class="rl-ls rl-ls-b">
          ${img}
          <div class="rl-ls-row">
            <div class="rl-ls-text">${text}</div>
            <svg class="rl-ls-tower" aria-hidden="true"><use href="#rl-tower"/></svg>
          </div>
        </div>`;
      })
      .join("");
  }

  // ============= ALBUM ẢNH =============
  // Ảnh còn lại sau các ô ảnh xen, xếp nhịp: cặp ảnh → câu thơ → ảnh đứng → câu
  // thơ… Câu thơ là chữ CỐ ĐỊNH của mẫu. Bấm ảnh mở lightbox theo thứ tự album.

  const RL_ALBUM_LINES = [
    ["Tình yêu giữ chúng mình bên nhau", "trong từng điều nhỏ bé, trong mỗi ngày thường", "và cả ở những góc khuất…"],
    ["Đám cưới là lời ca về mọi điều thuộc về yêu thương", "trước mọi người, bằng giọng chân thành nhất", "nói với người kia", "“Em đồng ý”"],
    ["Cảm ơn vì đã đến", "và ở lại thật lâu."],
  ];

  function renderGallery(images, focalPoints) {
    const flow = document.getElementById("gallery-grid");
    if (!flow) return;

    // Ảnh cuối đã dành cho lời cảm ơn khi album đủ dài.
    const end = images.length > RL_SHOT_COUNT + 1 ? images.length - 1 : images.length;
    const own = images.slice(RL_SHOT_COUNT, end);
    const urls = own.length
      ? own.map(getImageUrl)
      : Array(2).fill(null).map(() => createPlaceholderSVG("Chưa có ảnh"));

    lightboxImages.length = 0;
    lightboxImages.push(...urls);

    const cell = (i, cls) =>
      `<div class="rl-album-cell ${cls}" data-lb="${i}">${rlShotImg(urls[i], focalPoints?.[own[i]], false)}</div>`;

    let html = "";
    let i = 0;
    let beat = 0;
    while (i < urls.length) {
      if (beat % 2 === 0 && i + 1 < urls.length) {
        html += `<div class="rl-album-pair">${cell(i, "")}${cell(i + 1, "")}</div>`;
        i += 2;
      } else {
        html += `<div class="rl-album-single">${cell(i, "")}</div>`;
        i += 1;
      }
      const lines = RL_ALBUM_LINES[beat % RL_ALBUM_LINES.length];
      html += `<div class="cx-t rl-poem rl-center rl-album-text">${lines.map(escapeHtml).join("<br>")}</div>`;
      beat++;
    }
    flow.innerHTML = html;
    flow.querySelectorAll("[data-lb]").forEach((el) =>
      el.addEventListener("click", () => openLightbox(Number(el.dataset.lb))),
    );
  }
})();
