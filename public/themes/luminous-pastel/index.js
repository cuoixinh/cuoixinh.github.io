// ============= THEME: LUMINOUS PASTEL =============
// Ivory ngả hồng · hồng đất · champagne · sage. Nét riêng: nền gradient pastel
// liền suốt thiệp, khối nội dung là thẻ kính mờ, album ảnh là dải coverflow
// (tấm giữa nổi lên, hai bên lùi lại và nhạt đi).
//
// File này chỉ KHAI BÁO: window.CX_THEME + renderWedding + phần đặc thù của mẫu
// (hàng ngày giờ ở mục mở đầu, album coverflow, chuyện tình yêu). Phần "chạy"
// nằm ở core/helpers/theme-boot.js, nạp sau file này.
//
// Bọc trong IIFE, chỉ lộ CX_THEME + renderWedding: `const` cấp cao nhất của
// script cổ điển là biến toàn cục, trùng tên với trang khác là vỡ trang đó.

(function () {
  window.CX_THEME = {
    id: "luminous-pastel",

    // Độ dài mốc chuyện tình XuXi viết (xem base-theme). Thẻ kính mờ so le trái–phải, bề ngang hẹp — đoạn ngắn mới gọn thẻ.
    loveStory: "short",

    // Dạng hiện lời chúc khi chủ thiệp chưa chọn (theme_setting.wishes_mode).
    wishesMode: "card",

    // Hộp mừng cưới khi chủ thiệp chưa chọn (theme_setting.gift_box): id trong
    // CX_GIFT_BOXES (core/helpers/gift-box-helper.js) hoặc "none". Mẫu KHÔNG tự vẽ hộp.
    giftBox: "hop_trang_hong",

    // Dạng trình phát nhạc — theme-boot.js dựng vào #cx-music-mount.
    music: { variant: "ring", chrome: "fixed-corner", art: "couple" },

    // Bộ màu MẶC ĐỊNH của mẫu — bản khai máy đọc được của đúng những giá trị
    // :root trong theme.css (nguồn sự thật). Trang Thiết lập đọc nó để hiện mục
    // "Mặc định"; theme_setting.palette ghi đè lên trên lúc chạy.
    // Sinh lại bằng: node scripts/check-theme-palette.mjs --write
    palette: {
      heading: "#4a3d3b",
      body: "#6e605d",
      accent: "#8a6a40",
      accent_soft: "#ecc8a8",
      on_accent: "#ffffff",
      on_image: "#ffffff",
      on_lightbox: "#ffffff",
      card_bg: "#fbf6f3",
      page_bg: "#f5ece8",
      surface: "#f5ece8",
      band: "#fff5f0",
      panel: "#ffffff",
      panel_warm: "#ffffff",
      cover: "#fbf6f3",
      cover_mid: "#f2e4e1",
      cover_veil: "#f2e4e1",
      lightbox_bg: "#000000",
      line: "#e8d8d3",
      shadow: "#000000",
      scrim: "#000000",
      deco: "#9e5a63",
      deco_soft: "#ecc4c4",
      deco_2: "#5b7160",
      deco_2_soft: "#c8d8c4",
      shine_from: "#d4a5a5",
      shine_mid: "#e8b4b8",
      shine_to: "#f5d5d8",
    },

    // Màu GỢI Ý trong bộ chọn màu (khách bấm vào một phần tử trên thiệp rồi
    // chỉnh riêng) — lấy từ chính bảng màu của mẫu.
    swatches: [
      "#4a3d3b",
      "#6e605d",
      "#2e2624",
      "#8a6a40", // champagne đậm
      "#9e5a63", // hồng đất
      "#5b7160", // sage
      "#ecc8a8",
      "#ecc4c4",
      "#e8d8d3",
      "#fbf6f3",
      "#ffffff",
    ],

    // Mục mở đầu KHÔNG hiện dần: nó là thứ khách thấy ngay khi mở link.
    reveal: ["#main-card section:not(#section-hero)"],

    // Mốc bung bảng đề xuất mẫu khác ở bản xem thử (?preview=true).
    suggest: "#section-gift",

    // Mẫu vẽ đủ mọi mục nên trang Thiết lập không phải bỏ bước nào.
    skipSteps: [],

    // id các mục trùng bảng mặc định của preview-focus-helper.js nên không cần
    // khai `focus`.

    onOpen: null,
  };

  const _isGroom = isGroomSide();

  // ============= ĐỔ DỮ LIỆU LÊN THIỆP =============
  // Gọi theo đúng thứ tự các mục trong index.html.

  function renderWedding(w) {
    if (!w || !w.is_active) return;

    const side = _isGroom ? "groom" : "bride";
    const partyDate = w[`${side}_party_date`];
    const partyLocation = w[`${side}_party_location`];

    // --- Mở đầu ---
    // Chạy TRƯỚC setupMusic: đây là chỗ ảnh của màn ĐẦU TIÊN nhận src, mà
    // setupMusic kéo YouTube iframe API (script bên thứ ba) về ngay khi chạy —
    // để nó đi trước là ảnh phải xếp hàng sau.
    renderHero(w, false);
    renderStoryQuote(w.story_quote);
    lpSetupHeroNames();
    lpSetupProgress();

    // --- Nhạc nền ---
    setupMusic(w.music_url, w.enable_music);

    // --- Gia đình ---
    renderCoupleInfo(w);
    cxToggle("section-family", cxEnabled(w.enable_family));

    // --- Thư mời: nhà gái bật Vu Quy thì thay toàn bộ phần lễ ---
    const isVuQuy = !_isGroom && cxEnabled(w.vu_quy_enabled);
    const ceremonyName = isVuQuy
      ? "Lễ Vu Quy"
      : w.ceremony_name || "Lễ Thành Hôn";
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

    // Hàng ngày giờ + nơi tổ chức ở mục mở đầu — lấy NGÀY LỄ và nơi ĐÃI TIỆC,
    // đúng cặp thông tin khách cần trước nhất.
    renderHeroBanner(w.ceremony_date, ceremonyTime, partyLocation);

    // Khối tóm tắt trong trình phát nhạc (kéo tay nắm xuống mới thấy) — dùng
    // CHÍNH phần lễ đang hiển thị để nhà gái bật Vu Quy thì tóm tắt cũng đổi.
    renderMusicSummary(w, {
      ceremonyName,
      ceremonyTime,
      ceremonyLocation: ceremonyLoc,
    });

    // --- Tiệc cưới (mỗi nhà một ngày/giờ/nơi riêng) ---
    setText("party-section-label", "Tiệc Mừng " + ceremonyName);
    renderPartyDate(
      partyDate,
      w[`${side}_party_time`],
      w[`${side}_party_lunar`],
      partyLocation,
      "full",
    );
    cxToggle("section-party", cxEnabled(w.enable_party));

    // Ảnh nền nhạt của thẻ Tiệc cưới: tấm ĐẦU của album, không có album thì ảnh
    // bìa; không có ảnh nào thì để thẻ kính trơn.
    const partyBg = w.gallery_images?.[0] || w.cover_image_url;
    if (partyBg) {
      setAttr("lp-party-bg", "src", getImageUrl(partyBg));
      applyFocalPoint(
        "lp-party-bg",
        partyBg === w.cover_image_url
          ? w.image_focal_points?.cover_image_url
          : w.image_focal_points?.gallery_images?.[partyBg],
      );
    }
    cxToggle("lp-party-bg", !!partyBg);

    // Lịch nhỏ đánh dấu ngày lễ + ngày tiệc
    setupMiniCalendar(w.ceremony_date, partyDate);

    // --- Xác nhận tham dự ---
    const rsvp = document.getElementById("rsvp-section");
    if (rsvp) rsvp.style.display = cxEnabled(w.rsvp_enabled) ? "flex" : "none";
    // Lối tắt ở mục mở đầu chỉ có nghĩa khi phần RSVP thật sự hiện.
    cxToggle(
      "lp-rsvp-cue",
      cxEnabled(w.rsvp_enabled) && cxEnabled(w.enable_party),
    );
    if (w.rsvp_message) {
      const msg = document.getElementById("rsvp-custom-message");
      if (msg) {
        msg.textContent = w.rsvp_message;
        msg.classList.remove("hidden");
      }
    }

    // --- Lịch trình ngày cưới ---
    if (cxEnabled(w.enable_timeline)) {
      renderTimeline(
        w.timeline,
        side,
        partyDate,
        w.ceremony_date,
        ceremonyName,
      );
      cxToggle("section-timeline", true);
    }

    // --- Chuyện tình yêu ---
    if (cxEnabled(w.enable_love_story)) {
      renderLoveStory(w.love_story);
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
    cxToggle("section-footer", cxEnabled(w.enable_footer));
  }

  window.renderWedding = renderWedding;

  // ============= HÀNG NGÀY GIỜ + NƠI TỔ CHỨC (mục mở đầu) =============
  // Định dạng riêng của mẫu ("THỨ BẢY · 20 / 07.2025 · 17.00") nên không dùng
  // renderCeremonyDate — hàm đó đổ vào các id của mục Thư mời.

  function renderHeroBanner(ceremonyDate, ceremonyTime, venue) {
    if (ceremonyDate) {
      const d = new Date(ceremonyDate);
      setText("hero-weekday", WEEKDAYS[d.getDay()]);
      setText("hero-day", String(d.getDate()).padStart(2, "0"));
      setText(
        "hero-month-year",
        `${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`,
      );
    }
    // Giờ ghi kiểu thiệp in: "17.00" thay cho "17:00".
    setText("hero-time", (ceremonyTime || "").replace(":", "."), "--.--");

    // Nơi tổ chức là MỘT chuỗi ("White Palace, 194 Hoàng Văn Thụ, Phú Nhuận").
    // Tách ở dấu phẩy đầu tiên: vế trước là tên, phần còn lại là địa chỉ.
    const parts = (venue || "").split(",");
    const name = parts.shift()?.trim() || "";
    const address = parts.join(",").trim();
    setText("hero-venue-name", name, "------------");
    setText("hero-venue-address", address, "");
  }

  // ============= ALBUM ẢNH: DẢI COVERFLOW =============
  // Ảnh xếp NGANG, mỗi tấm dừng đúng giữa khi vuốt (scroll-snap). Tấm gần tâm
  // dải nhất được phóng to và rõ nhất; càng ra xa càng nhỏ, mờ và nhạt đi — đúng
  // cảm giác "hazy" của mẫu. Trang vẫn cuộn dọc bình thường.
  // Khổ tấm ảnh do theme.css quyết định (.lp-slide), ở đây chỉ lo dữ liệu và
  // phần đo đạc.

  const LP_CAPTIONS = [
    "When soul fall in love",
    "Every day with you",
    "Two hearts, one story",
    "Your soul is what makes you attractive",
    "Together is our favourite place",
  ];

  function renderGallery(images, focalPoints) {
    const flow = document.getElementById("gallery-grid");
    if (!flow) return;

    // Chưa có ảnh → vài ô minh hoạ, để khách hình dung bố cục lúc đang soạn.
    const urls = images?.length
      ? images.map(getImageUrl)
      : Array(5)
          .fill(null)
          .map(() => createPlaceholderSVG("Chưa có ảnh"));

    // Kho ảnh của lightbox dùng chung — phải khớp thứ tự với dải.
    lightboxImages.length = 0;
    lightboxImages.push(...urls);

    flow.innerHTML = urls
      .map((url, i) => {
        const fp = focalPoints?.[images?.[i]];
        return `
        <figure class="lp-slide" data-lb="${i}">
          <div class="lp-slide-img">
            <img src="${cxImgSrc(url)}" alt="" class="w-full h-full object-cover"
              style="object-position:${cxFocal(fp)}" loading="lazy" />
          </div>
          <figcaption class="lp-hand lp-slide-cap">${escapeHtml(
            LP_CAPTIONS[i % LP_CAPTIONS.length],
          )}</figcaption>
        </figure>`;
      })
      .join("");

    flow.querySelectorAll("[data-lb]").forEach((el) => {
      el.addEventListener("click", () => openLightbox(Number(el.dataset.lb)));
    });

    lpSetupFlow();
    lpSetupDots();
    lpSetupNav();
  }

  // Đo lại mức phóng/mờ của từng tấm theo khoảng cách tới tâm dải.

  let lpFlowCleanup = null;

  function lpSyncFlow() {
    const flow = document.getElementById("gallery-grid");
    // clientWidth = 0: dải đang bị ẩn (tắt mục Album…), đo lúc này ra số vô nghĩa.
    if (!flow || !flow.clientWidth) return;
    const mid = flow.scrollLeft + flow.clientWidth / 2;
    [...flow.children].forEach((card) => {
      const d = Math.abs(card.offsetLeft + card.offsetWidth / 2 - mid);
      // 0 ở giữa dải → 1 khi cách một khổ tấm ảnh.
      const t = Math.min(1, d / (card.offsetWidth || 1));
      card.style.setProperty("--lp-off", t.toFixed(3));
      card.classList.toggle("is-mid", t < 0.35);
    });
  }


  function lpSetupFlow() {
    lpFlowCleanup?.();
    lpFlowCleanup = null;

    const flow = document.getElementById("gallery-grid");
    if (!flow) return;

    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        lpSyncFlow();
        lpSyncDots();
        lpSyncNav();
      });
    };

    flow.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    lpSyncFlow();

    lpFlowCleanup = () => {
      flow.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }

  // ============= ALBUM: CHẤM CHỈ SỐ ẢNH =============
  // Mỗi tấm một chấm; chấm đang xem dài ra. Bấm chấm thì trượt tới tấm đó.

  function lpSetupDots() {
    const flow = document.getElementById("gallery-grid");
    const bar = document.getElementById("album-dots");
    if (!flow || !bar) return;

    const cards = [...flow.children];
    bar.innerHTML = "";
    if (cards.length < 2) return;

    cards.forEach((card, i) => {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.className = "lp-dot";
      dot.setAttribute("aria-label", `Ảnh ${i + 1}`);
      dot.addEventListener("click", () => lpSlideTo(flow, card));
      bar.appendChild(dot);
    });

    lpSyncDots();
  }

  // Chỉ số tấm đang nằm gần tâm dải nhất.
  function lpMidIndex(flow) {
    const mid = flow.scrollLeft + flow.clientWidth / 2;
    let best = 0;
    let min = Infinity;
    [...flow.children].forEach((c, i) => {
      const d = Math.abs(c.offsetLeft + c.offsetWidth / 2 - mid);
      if (d < min) {
        min = d;
        best = i;
      }
    });
    return best;
  }

  function lpSlideTo(flow, card) {
    flow.scrollTo({
      left: card.offsetLeft - (flow.clientWidth - card.offsetWidth) / 2,
      behavior: "smooth",
    });
  }

  function lpSyncDots() {
    const flow = document.getElementById("gallery-grid");
    const bar = document.getElementById("album-dots");
    if (!flow || !bar || !bar.children.length) return;

    const best = lpMidIndex(flow);
    [...bar.children].forEach((d, i) =>
      d.classList.toggle("is-on", i === best),
    );
  }

  // ============= ALBUM: HÀNG LÙI · "3 / 10" · TỚI =============
  // Xem hết album không cần vuốt. Nút là x-button nên tra id SAU khi nó đã tự
  // thay bằng <button> thật (renderWedding chạy sau khi DOM sẵn sàng).

  function lpSetupNav() {
    const flow = document.getElementById("gallery-grid");
    const nav = document.getElementById("album-nav");
    if (!flow || !nav) return;

    const many = flow.children.length > 1;
    nav.classList.toggle("hidden", !many);
    if (!many) return;

    const step = (dir) => {
      const cards = [...flow.children];
      const i = Math.max(
        0,
        Math.min(cards.length - 1, lpMidIndex(flow) + dir),
      );
      lpSlideTo(flow, cards[i]);
    };
    // Gán onclick (không addEventListener) để gọi lại renderGallery không
    // chồng thêm handler.
    const prev = document.getElementById("album-prev");
    const next = document.getElementById("album-next");
    if (prev) prev.onclick = () => step(-1);
    if (next) next.onclick = () => step(1);

    lpSyncNav();
  }

  function lpSyncNav() {
    const flow = document.getElementById("gallery-grid");
    const count = document.getElementById("album-count");
    if (!flow || !count || !flow.children.length) return;

    const i = lpMidIndex(flow);
    const n = flow.children.length;
    count.textContent = `${i + 1} / ${n}`;
    const prev = document.getElementById("album-prev");
    const next = document.getElementById("album-next");
    if (prev) prev.disabled = i === 0;
    if (next) next.disabled = i === n - 1;
  }

  // ============= TÊN Ở MỤC MỞ ĐẦU: LUÔN MỘT DÒNG =============
  // Thu font-size của .lp-hero-names tới khi tên vừa tấm kính (trần = cỡ khai
  // trong class, sàn = LP_NAMES_MIN). Đo lại khi font Signora tải xong, khi đổi
  // khổ màn và khi khách sửa tên ngay trên thiệp.

  const LP_NAMES_MIN = 24;

  function lpFitHeroNames() {
    const box = document.querySelector(".lp-hero-names");
    // clientWidth = 0: khối đang ẩn, đo lúc này ra số vô nghĩa.
    if (!box || !box.clientWidth) return;

    box.style.fontSize = "";
    box.classList.remove("is-wrap");
    let size = parseFloat(getComputedStyle(box).fontSize);
    if (box.scrollWidth <= box.clientWidth) return;

    // Ước một bước theo tỉ lệ rồi lùi từng px cho chắc (padding không co theo).
    size = Math.max(
      LP_NAMES_MIN,
      Math.floor((size * box.clientWidth) / box.scrollWidth),
    );
    box.style.fontSize = size + "px";
    while (box.scrollWidth > box.clientWidth && size > LP_NAMES_MIN) {
      size -= 1;
      box.style.fontSize = size + "px";
    }
    if (box.scrollWidth > box.clientWidth) box.classList.add("is-wrap");
  }

  let lpNamesBound = false;

  function lpSetupHeroNames() {
    lpFitHeroNames();
    const box = document.querySelector(".lp-hero-names");
    if (!box || lpNamesBound) return;
    lpNamesBound = true;

    document.fonts?.ready.then(lpFitHeroNames);
    window.addEventListener("resize", lpFitHeroNames);
    // Sửa chữ trực tiếp trên thiệp đổi text node bên trong — đo lại theo.
    let pending = false;
    new MutationObserver(() => {
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => {
        pending = false;
        lpFitHeroNames();
      });
    }).observe(box, { characterData: true, childList: true, subtree: true });
  }

  // ============= VẠCH TIẾN ĐỘ ĐỌC THIỆP =============
  // Thiệp cuộn theo window. Vẽ bằng scaleX (không đổi width) cho khỏi reflow
  // mỗi lần cuộn. Chỉ gắn một lần dù renderWedding có chạy lại.

  let lpProgressBound = false;

  function lpSetupProgress() {
    const bar = document.getElementById("lp-progress-bar");
    if (!bar || lpProgressBound) return;
    lpProgressBound = true;

    let ticking = false;
    const sync = () => {
      ticking = false;
      const el = document.scrollingElement || document.documentElement;
      const max = el.scrollHeight - el.clientHeight;
      bar.style.transform = `scaleX(${max > 0 ? Math.min(1, el.scrollTop / max) : 0})`;
    };
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(sync);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    sync();
  }

  // ============= CHUYỆN TÌNH YÊU (phần đặc thù của mẫu) =============
  // Ghi đè renderLoveStory của render-helper.js (nạp TRƯỚC file này): mỗi mẩu
  // chuyện là một thẻ kính mờ nằm so le trái–phải, nối nhau bằng sợi sáng dọc
  // giữa mục (.lp-thread ở theme.css), mốc là một chấm có quầng.
  // Giữ .cx-hd/.cx-bd trên chữ để màu vẫn theo tab Giao diện; ngày dùng màu
  // hồng đất (--cx-deco-rgb) khai ở .lp-story-date.

  function lpRenderLoveStory(events) {
    const section = document.getElementById("love-story");
    if (!section) return;

    if (!Array.isArray(events) || events.length === 0) {
      section.style.display = "none";
      return;
    }
    section.style.display = "";

    const list = document.getElementById("love-story-list");
    if (!list) return;

    list.innerHTML = events
      .map((ev, i) => {
        const img = ev.image_url ? getImageUrl(ev.image_url) : null;
        const fp = ev.focal_point
          ? ` style="object-position:${cxFocal(ev.focal_point)}"`
          : "";
        return `
      <div class="lp-story ${i % 2 ? "is-right" : "is-left"}">
        <span class="lp-story-dot"></span>
        <div class="lp-glass lp-story-card text-left">
          ${ev.date ? `<div class="lp-story-date">${escapeHtml(ev.date)}</div>` : ""}
          ${ev.title ? `<div class="lp-story-title cx-hd">${escapeHtml(ev.title)}</div>` : ""}
          ${ev.content ? `<div class="lp-story-text cx-bd">${escapeHtml(ev.content)}</div>` : ""}
          ${img ? `<img class="lp-story-photo" src="${cxImgSrc(img)}" alt=""${fp} loading="lazy" />` : ""}
        </div>
      </div>`;
      })
      .join("");
  }

  window.renderLoveStory = lpRenderLoveStory;
})();
