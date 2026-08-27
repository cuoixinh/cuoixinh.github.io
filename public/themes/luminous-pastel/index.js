// ============= THEME: LUMINOUS PASTEL =============
// Ivory hơi lạnh · blush · champagne nhạt · xanh xám dịu. Nét riêng: tương phản
// thấp kiểu ảnh chụp ánh sáng tự nhiên, khối nội dung là thẻ kính mờ, album ảnh
// là dải coverflow (tấm giữa nổi lên, hai bên lùi lại và nhạt đi).
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

    preset: {
      heading_font: "Cormorant Garamond",
      body_font: "Quicksand",
      heading_color: "#5f5654", // xám khói trung tính, tương phản thấp
      body_color: "#938a88", // xám nhạt
      accent_color: "#c9b48f", // champagne rất nhạt
      background_color: "#f9f3f1", // ivory ngả hồng — nền #main-card
      swatches: [
        "#5f5654",
        "#7a706e",
        "#938a88",
        "#413a39",
        "#c9b48f",
        "#dcaea8", // dusty pink
        "#e9dbd9",
        "#f3ebe9",
        "#f9f3f1",
        "#ffffff",
      ],
    },

    // Mẫu gom về ba lớp ngữ nghĩa (.cx-h · .cx-t · .cx-a, khai trong theme.css).
    // .cx-hd/.cx-bd/.cx-ac là markup do helper dùng chung sinh ra (dòng thời
    // gian) — GIỮ NGUYÊN khi chép sang mẫu mới.
    // .lp-script (tên cô dâu chú rể) đi theo MÀU tiêu đề nhưng KHÔNG theo font:
    // bảng chọn font chỉ có font Google, đổi xong khách không quay lại được font
    // thư pháp tự host.
    selectors: {
      headingFont: ".cx-h, .font-cormorant",
      bodyFont: "body, .cx-t, .font-inter",
      headingColor: ".cx-h, .cx-hd, .lp-script",
      bodyColor: ".cx-t, .cx-bd",
      accentColor: ".cx-a, .cx-ac",
      background: "body, #main-card",
    },

    // Mục mở đầu KHÔNG hiện dần: nó là thứ khách thấy ngay khi bìa mở ra.
    reveal: ["#main-card section:not(#section-hero)"],

    // Mốc bung bảng đề xuất mẫu khác ở bản xem thử (?preview=true).
    suggest: "#section-gift",

    // Mẫu vẽ đủ mọi mục nên trang Thiết lập không phải bỏ bước nào.
    skipSteps: [],

    // id các mục trùng bảng mặc định của preview-focus-helper.js nên không cần
    // khai `focus`.

    // Album chỉ đo được sau khi thiệp hiện ra: trước đó #main-card còn
    // display:none nên mọi bề ngang đều bằng 0.
    onOpen: () => {
      lpSyncFlow();
      lpSyncDots();
    },
  };

  const _isGroom = isGroomSide();

  // ============= ĐỔ DỮ LIỆU LÊN THIỆP =============
  // Gọi theo đúng thứ tự các mục trong index.html.

  function renderWedding(w) {
    if (!w || !w.is_active) return;

    const side = _isGroom ? "groom" : "bride";
    const partyDate = w[`${side}_party_date`];
    const partyLocation = w[`${side}_party_location`];

    // --- Màn bìa ---
    // Khối dựng ảnh chạy TRƯỚC setupMusic: đây là chỗ ảnh của màn ĐẦU TIÊN nhận
    // src, mà setupMusic kéo YouTube iframe API (script bên thứ ba) về ngay khi
    // chạy — để nó đi trước là ảnh phải xếp hàng sau.
    renderCover(w);

    // --- Mở đầu ---
    renderHero(w, false);
    renderStoryQuote(w.story_quote);

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

    // Lịch nhỏ đánh dấu ngày lễ + ngày tiệc
    setupMiniCalendar(w.ceremony_date, partyDate);

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

    // --- Bản đồ tới nơi đãi tiệc ---
    // Chưa có URL thì hiện minh hoạ thay cho iframe trắng và khoá luôn nút.
    const mapUrl = w[`${side}_party_map_embed_url`];
    renderMap(mapUrl, partyLocation);
    const hasMap = !!extractMapEmbedUrl(mapUrl);
    cxToggle("map-thumbnail-iframe", hasMap);
    cxToggle("map-placeholder", !hasMap);
    document
      .getElementById("map-link")
      ?.classList.toggle("pointer-events-none", !hasMap);

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

    // Ảnh CỐ Ý không loading="lazy": #main-card để display:none cho tới khi
    // khách mở bìa, ảnh lazy sẽ chưa tải gì cả và trống đúng lúc thiệp mở ra.
    flow.innerHTML = urls
      .map((url, i) => {
        const fp = focalPoints?.[images?.[i]];
        return `
        <figure class="lp-slide" data-lb="${i}">
          <div class="lp-slide-img">
            <img src="${url}" alt="" class="w-full h-full object-cover"
              style="object-position:${fp?.x ?? 50}% ${fp?.y ?? 50}%" />
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
  }

  // Đo lại mức phóng/mờ của từng tấm theo khoảng cách tới tâm dải.
  // Gọi được từ ngoài (onOpen) vì trước khi bìa mở, #main-card còn display:none
  // nên mọi phép đo đều ra 0.

  let lpFlowCleanup = null;

  function lpSyncFlow() {
    const flow = document.getElementById("gallery-grid");
    // clientWidth = 0 nghĩa là #main-card còn display:none (khách chưa mở bìa):
    // đo lúc này ra số vô nghĩa, để onOpen gọi lại.
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

  window.lpSyncFlow = lpSyncFlow;

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
      dot.addEventListener("click", () => {
        flow.scrollTo({
          left: card.offsetLeft - (flow.clientWidth - card.offsetWidth) / 2,
          behavior: "smooth",
        });
      });
      bar.appendChild(dot);
    });

    lpSyncDots();
  }

  function lpSyncDots() {
    const flow = document.getElementById("gallery-grid");
    const bar = document.getElementById("album-dots");
    if (!flow || !bar || !bar.children.length) return;

    const cards = [...flow.children];
    const mid = flow.scrollLeft + flow.clientWidth / 2;
    let best = 0;
    let min = Infinity;
    cards.forEach((c, i) => {
      const d = Math.abs(c.offsetLeft + c.offsetWidth / 2 - mid);
      if (d < min) {
        min = d;
        best = i;
      }
    });
    [...bar.children].forEach((d, i) =>
      d.classList.toggle("is-on", i === best),
    );
  }

  // ============= CHUYỆN TÌNH YÊU (phần đặc thù của mẫu) =============
  // Ghi đè renderLoveStory của render-helper.js (nạp TRƯỚC file này): mỗi mẩu
  // chuyện là một thẻ kính mờ nằm so le trái–phải, nối nhau bằng sợi sáng dọc
  // giữa mục (.lp-thread ở theme.css), mốc là một chấm có quầng.
  // Giữ .cx-hd/.cx-ac trên chữ để màu vẫn theo tab Giao diện.

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
          ? ` style="object-position:${ev.focal_point.x}% ${ev.focal_point.y}%"`
          : "";
        return `
      <div class="lp-story ${i % 2 ? "is-right" : "is-left"}">
        <span class="lp-story-dot"></span>
        <div class="lp-glass lp-story-card text-left">
          ${ev.date ? `<div class="lp-story-date cx-ac">${escapeHtml(ev.date)}</div>` : ""}
          ${ev.title ? `<div class="lp-story-title cx-hd">${escapeHtml(ev.title)}</div>` : ""}
          ${ev.content ? `<div class="lp-story-text cx-bd">${escapeHtml(ev.content)}</div>` : ""}
          ${img ? `<img class="lp-story-photo" src="${img}" alt=""${fp} loading="lazy" />` : ""}
        </div>
      </div>`;
      })
      .join("");
  }

  window.renderLoveStory = lpRenderLoveStory;
})();
