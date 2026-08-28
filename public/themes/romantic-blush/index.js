// ============= THEME: ROMANTIC BLUSH =============
// Hồng phấn · kem trắng · nâu espresso. Nét riêng: mục mở đầu xếp theo lối thiệp
// in (tên thư pháp → hàng ngày giờ → nơi tổ chức → hàng chip nhảy nhanh → ảnh);
// toàn thiệp không dùng hình trang trí, chỉ có chữ và khoảng trắng.
//
// File này chỉ KHAI BÁO: window.CX_THEME + renderWedding + phần đặc thù của mẫu
// (hàng ngày giờ ở mục mở đầu, chip nhảy nhanh, lưới ảnh). Phần "chạy" nằm ở
// core/helpers/theme-boot.js, nạp sau file này.
//
// Bọc trong IIFE, chỉ lộ CX_THEME + renderWedding: `const` cấp cao nhất của
// script cổ điển là biến toàn cục, trùng tên với trang khác là vỡ trang đó.

(function () {
  window.CX_THEME = {
    id: "romantic-blush",

    // Bộ màu MẶC ĐỊNH của mẫu — bản khai máy đọc được của đúng những giá trị
    // :root trong theme.css (nguồn sự thật). Trang Thiết lập đọc nó để hiện mục
    // "Mặc định"; theme_setting.palette ghi đè lên trên lúc chạy.
    // Sinh lại bằng: node scripts/check-theme-palette.mjs --write
    palette: {
      heading: "#4a3229",
      body: "#8a6f64",
      accent: "#c98a8e",
      accent_soft: "#e8b4b8",
      on_accent: "#ffffff",
      on_image: "#ffffff",
      on_lightbox: "#ffffff",
      card_bg: "#fdf8f5",
      page_bg: "#fbf4f0",
      surface: "#fbf4f0",
      band: "#fff5f0",
      panel: "#ffffff",
      panel_warm: "#fffcf7",
      cover: "#fdf8f5",
      cover_mid: "#f6e5e1",
      cover_veil: "#f6e5e1",
      lightbox_bg: "#000000",
      line: "#f0d5d3",
      shadow: "#000000",
      scrim: "#000000",
      deco: "#d4a5a5",
      deco_soft: "#f5d5d8",
      deco_2: "#d4a5a5",
      deco_2_soft: "#f5d5d8",
      shine_from: "#ffffff",
      shine_mid: "#fdf5ec",
      shine_to: "#e6d8ca",
    },

    preset: {
      heading_font: "Cormorant Garamond",
      body_font: "Quicksand",
      heading_color: "#4a3229", // nâu espresso
      body_color: "#8a6f64", // nâu sữa
      accent_color: "#c98a8e", // hồng rose
      background_color: "#fdf8f5", // kem trắng — nền #main-card
      swatches: [
        "#4a3229",
        "#6b4c3f",
        "#8a6f64",
        "#2e1f1a",
        "#c98a8e",
        "#e0a4a8",
        "#e8bcbb",
        "#f0d5d3",
        "#faeae7",
        "#fbf4f0",
        "#ffffff",
      ],
    },

    // Mẫu gom về ba lớp ngữ nghĩa (.cx-h · .cx-t · .cx-a, khai trong theme.css).
    // .cx-hd/.cx-bd/.cx-ac là markup do helper dùng chung sinh ra (dòng thời
    // gian, chuyện tình yêu) — GIỮ NGUYÊN khi chép sang mẫu mới.
    // .rb-script (tên cô dâu chú rể, câu slogan) đi theo MÀU tiêu đề nhưng
    // KHÔNG theo font: bảng chọn font chỉ có font Google, đổi xong khách không
    // quay lại được font thư pháp tự host.
    selectors: {
      headingFont: ".cx-h, .font-cormorant",
      bodyFont: "body, .cx-t, .font-inter",
      headingColor: ".cx-h, .cx-hd, .rb-script",
      bodyColor: ".cx-t, .cx-bd",
      accentColor: ".cx-a, .cx-ac",
      background: "body, #main-card",
    },

    // Mục mở đầu KHÔNG hiện dần: nó là thứ khách thấy ngay khi bìa mở ra, cho
    // trượt vào thì có một nhịp trống trước đã.
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
    const hasTimeline = cxEnabled(w.enable_timeline);
    if (hasTimeline) {
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
    const hasPhotos = cxEnabled(w.enable_photos);
    if (hasPhotos) {
      renderGallery(w.gallery_images, w.image_focal_points?.gallery_images);
    } else {
      cxToggle("section-photos", false);
    }

    // --- Hộp mừng cưới ---
    const hasGift = cxEnabled(w.enable_gift);
    renderQRCodes(w);
    cxToggle("section-gift", hasGift);

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

    // Chip nhảy nhanh chỉ giữ lại mục thật sự có trên thiệp.
    syncQuickNav({
      timeline: hasTimeline,
      photos: hasPhotos,
      map: true,
      gift: hasGift,
    });

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

  // ============= CHIP NHẢY NHANH (mục mở đầu) =============
  // Mỗi chip là một liên kết #section-… ; mục bị tắt trong Thiết lập thì ẩn chip
  // đi, và không còn chip nào thì ẩn cả hàng cho khỏi hở một khoảng trống.

  function syncQuickNav(state) {
    let any = false;
    Object.keys(state).forEach((key) => {
      cxToggle("quicknav-" + key, state[key]);
      if (state[key]) any = true;
    });
    cxToggle("hero-quicknav", any);
  }

  // ============= ALBUM ẢNH (phần đặc thù của mẫu) =============
  // Dàn đúng theo cặp trang của album ảnh in trong mẫu tham chiếu:
  //   · Trang A — ảnh tràn viền cả trang; đè lên nửa dưới, lệch sang phải là một
  //     THẺ TRẮNG: ảnh nhỏ ở trên, hai dòng chữ viết tay (dòng sau có cụm nhỏ
  //     hơn), rồi mấy dòng chữ xám li ti.
  //   · Trang B — trang giấy trắng: ảnh ngang ở trên; dưới là ảnh ĐỨNG bên trái
  //     và ảnh thấp hơn bên phải, cụm chữ viết tay canh phải lấp khoảng trắng
  //     hụt dưới ảnh phải, dòng cuối nhỏ hơn hẳn.
  //   · Trang C — biến tấu để album không lặp style: lưới ảnh đứng + hai ảnh
  //     vuông ở trên, dải ảnh ngang có chữ đè lên ở dưới.
  // Chữ trên album là văn bản CỐ ĐỊNH của mẫu (RB_CARD_TEXTS / RB_SCRIPT_TEXTS)
  // — slogan của khách đã hiện ở mục mở đầu rồi.
  // Ảnh CỐ Ý không loading="lazy": #main-card để display:none cho tới khi khách
  // mở bìa, ảnh lazy sẽ chưa tải gì cả và trống đúng lúc thiệp mở ra.

  const RB_CARD_TEXTS = [
    {
      lead: "When soul",
      tail: "fall",
      em: "in love",
      sub: "And when our eyes met, I knew. I wasn't just looking at you — I was looking at my soul mate.",
    },
    {
      lead: "Two hearts",
      tail: "one",
      em: "story",
      sub: "Ngày mình gặp nhau, cả thế giới bỗng dịu lại. Từ hôm ấy, mỗi ngày bình thường đều hoá đặc biệt.",
    },
  ];

  const RB_SCRIPT_TEXTS = [
    ["Your soul", "is what", "makes you", "attractive"],
    ["Every day", "with you", "is my", "favourite day"],
    ["Together", "is our", "favourite", "place"],
  ];

  function rbShot(url, fp, i, cls) {
    return `
      <div class="rb-shot ${cls || ""}" data-lb="${i}">
        <img src="${url}" alt="" class="w-full h-full object-cover"
          style="object-position:${fp?.x ?? 50}% ${fp?.y ?? 50}%" />
      </div>`;
  }

  // Cụm chữ viết tay canh phải; dòng CUỐI nhỏ hơn hẳn như chữ ký khép lại.
  function rbScriptLines(lines) {
    return `<div class="rb-album-script">${lines
      .map(
        (l, i) =>
          `<span${i === lines.length - 1 ? ' class="rb-script-last"' : ""}>${escapeHtml(l)}</span>`,
      )
      .join("")}</div>`;
  }

  // Mỗi kiểu trang nhận (take, shot, card, script): take() lấy chỉ số ảnh kế
  // tiếp (hết ảnh trả null), shot() dựng một ô ảnh, card/script là văn bản của
  // trang. Kiểu nào cũng phải ăn ÍT NHẤT một ảnh, không thì vòng dựng trang
  // không bao giờ dừng. Khổ từng ô do theme.css chia (mọi trang cao bằng nhau)
  // nên ở đây KHÔNG khai tỉ lệ ảnh.
  const RB_ALBUM_LAYOUTS = [
    // Trang A — ảnh tràn viền + thẻ trắng đè lên.
    (take, shot, card) => {
      const bg = take();
      const inner = take();
      return `
      <div class="rb-page-bleed">
        ${shot(bg)}
        <div class="rb-quote-card">
          ${shot(inner, "rb-card-shot")}
          <div class="rb-card-lead">${escapeHtml(card.lead)}</div>
          <div class="rb-card-tail">${escapeHtml(card.tail)}
            <span class="rb-card-em">${escapeHtml(card.em)}</span>
          </div>
          <p class="rb-card-sub">${escapeHtml(card.sub)}</p>
        </div>
      </div>`;
    },

    // Trang B — trang giấy trắng.
    (take, shot, card, script) => {
      const wide = take();
      const l = take();
      const r = take();
      return `
      <div class="rb-page">
        ${shot(wide)}
        ${
          l !== null
            ? `<div class="rb-page-pair">
          ${shot(l)}
          <div class="rb-pair-side">
            ${shot(r)}
            ${rbScriptLines(script)}
          </div>
        </div>`
            : rbScriptLines(script)
        }
      </div>`;
    },

    // Trang C — lưới ảnh ở trên, dải ảnh có chữ ở dưới.
    (take, shot, card, script) => {
      const tall = take();
      const a = take();
      const b = take();
      const band = take();
      return `
      <div class="rb-page">
        <div class="rb-split-grid">
          ${shot(tall, "rb-shot-tall")}
          ${shot(a)}
          ${shot(b)}
        </div>
        ${
          band !== null
            ? `<div class="rb-band">
          ${shot(band)}
          <div class="rb-band-line">${escapeHtml(script.slice(0, 2).join(" "))}</div>
        </div>`
            : rbScriptLines(script)
        }
      </div>`;
    },
  ];

  function rbAlbumPages(urls, fpOf) {
    const pages = [];
    let i = 0;
    let b = 0;
    const take = () => (i < urls.length ? i++ : null);
    const shot = (idx, cls) =>
      idx === null ? "" : rbShot(urls[idx], fpOf(idx), idx, cls);

    while (i < urls.length) {
      const layout = RB_ALBUM_LAYOUTS[b % RB_ALBUM_LAYOUTS.length];
      pages.push(
        layout(
          take,
          shot,
          RB_CARD_TEXTS[b % RB_CARD_TEXTS.length],
          RB_SCRIPT_TEXTS[b % RB_SCRIPT_TEXTS.length],
        ),
      );
      b += 1;
    }
    return pages.join("");
  }

  function renderGallery(images, focalPoints) {
    const grid = document.getElementById("gallery-grid");
    if (!grid) return;

    // Chưa có ảnh → vài ô minh hoạ, để khách hình dung bố cục lúc đang soạn.
    const urls = images?.length
      ? images.map(getImageUrl)
      : Array(5)
          .fill(null)
          .map(() => createPlaceholderSVG("Chưa có ảnh"));

    // Kho ảnh của lightbox dùng chung — phải khớp thứ tự với lưới.
    lightboxImages.length = 0;
    lightboxImages.push(...urls);

    grid.innerHTML = rbAlbumPages(urls, (i) => focalPoints?.[images?.[i]]);
    grid.querySelectorAll("[data-lb]").forEach((el) => {
      el.addEventListener("click", () => openLightbox(Number(el.dataset.lb)));
    });

    rbSetupAlbumDots();
    rbSetupAlbumSwipe();
  }

  // ============= ALBUM: CHẤM CHỈ SỐ ẢNH =============
  // Mỗi khung hình một chấm; chấm đang xem dài ra. Bấm chấm thì trượt tới khung
  // đó. Chấm đang xem xác định bằng khung nào gần TÂM dải nhất (dải canh giữa).

  let rbDotsCleanup = null;

  function rbSetupAlbumDots() {
    rbDotsCleanup?.();
    rbDotsCleanup = null;

    const album = document.getElementById("gallery-grid");
    const bar = document.getElementById("album-dots");
    if (!album || !bar) return;

    const cards = [...album.children];
    bar.innerHTML = "";
    if (cards.length < 2) return;

    cards.forEach((card, i) => {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.className = "rb-dot";
      dot.setAttribute("aria-label", `Khung hình ${i + 1}`);
      dot.addEventListener("click", () => {
        album.scrollTo({
          left: card.offsetLeft - (album.clientWidth - card.offsetWidth) / 2,
          behavior: "smooth",
        });
      });
      bar.appendChild(dot);
    });

    const dots = [...bar.children];
    let ticking = false;
    const sync = () => {
      ticking = false;
      const mid = album.scrollLeft + album.clientWidth / 2;
      let best = 0;
      let min = Infinity;
      cards.forEach((c, i) => {
        const d = Math.abs(c.offsetLeft + c.offsetWidth / 2 - mid);
        if (d < min) {
          min = d;
          best = i;
        }
      });
      dots.forEach((d, i) => d.classList.toggle("is-on", i === best));
    };

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(sync);
    };

    album.addEventListener("scroll", onScroll, { passive: true });
    sync();

    rbDotsCleanup = () => album.removeEventListener("scroll", onScroll);
  }

  // ============= ALBUM: VUỐT DỌC = TRƯỢT SANG ẢNH KẾ =============
  // Khi dải album đang chắn ngang màn mà khách CHƯA xem hết, cử chỉ cuộn dọc bị
  // giữ lại và đổi thành TRƯỢT MỀM sang khung hình kế tiếp — một cử chỉ đi một
  // khung, có chuyển động rõ ràng nên không ai tưởng trang bị đơ. Xem tới ảnh
  // cuối mới nhả cho trang đi tiếp. Lúc bắt đầu giữ, dải được kéo về GIỮA MÀN
  // HÌNH một lần cho khách xem trọn khung.
  // CHỈ giữ cử chỉ cuộn XUỐNG. Cuộn LÊN luôn cho trang chạy bình thường: giữ cả
  // hai chiều thì khách muốn quay lại phải vuốt ngược hết dải ảnh mới thoát ra
  // được.
  // Không cộng thẳng vào scrollLeft: dải có scroll-snap mandatory, cộng từng ít
  // một sẽ bị snap kéo lại, nhìn như treo.
  // Phải nghe với { passive: false } thì preventDefault mới có tác dụng.

  const RB_SWIPE_MIN = 34; // px vuốt dọc tối thiểu để tính là một cử chỉ
  // Số lần cử chỉ dọc được đổi thành trượt ngang trong MỘT lượt ghé album: đủ
  // để khách thấy có trang thứ hai (tức là tự hiểu vuốt ngang xem tiếp được),
  // hết lượt thì trả cuộn dọc về trang. Rời album rồi quay lại là tính lại lượt.
  const RB_SWIPE_MAX = 1;
  let rbSwipeCleanup = null;

  function rbSetupAlbumSwipe() {
    rbSwipeCleanup?.();
    rbSwipeCleanup = null;

    const album = document.getElementById("gallery-grid");
    if (!album) return;
    // Máy tắt hiệu ứng chuyển động: giữ cuộn dọc nguyên bản, khỏi giữ khách lại.
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    // Dải đang chắn ngang màn (cắt qua khoảng giữa) thì mới giữ cử chỉ — và
    // không giữ khi đang mở ảnh phóng to, kẻo khách không cuộn được trong đó.
    const engaged = () => {
      if (!document.getElementById("lightbox")?.classList.contains("hidden"))
        return false;
      const r = album.getBoundingClientRect();
      const h = window.innerHeight || 0;
      return r.top < h * 0.4 && r.bottom > h * 0.6;
    };

    // Chỉ nhận chiều XUỐNG (dir > 0), khi dải còn ảnh chưa xem và lượt giữ chưa
    // dùng hết.
    const room = (dir) => {
      if (dir <= 0 || used >= RB_SWIPE_MAX) return false;
      const max = album.scrollWidth - album.clientWidth;
      return max > 1 && album.scrollLeft < max - 2;
    };

    let busy = false;
    let centered = false;
    let used = 0;

    // Kéo dải về giữa màn hình MỘT LẦN mỗi lượt vào tầm giữ — không lặp lại thì
    // sẽ đánh nhau với chính cú cuộn của khách. Rời khỏi tầm thì cho phép lại.
    const centerOnce = () => {
      if (centered) return;
      centered = true;
      album.scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "nearest",
      });
    };

    const onPageScroll = () => {
      if (engaged()) {
        centerOnce();
        return;
      }
      // Ra khỏi tầm giữ → nạp lại lượt cho lần ghé sau.
      centered = false;
      used = 0;
    };

    // Trượt tới khung hình kế tiếp, canh giữa dải.
    const slide = () => {
      const mid = album.scrollLeft + album.clientWidth / 2;
      const next = [...album.children].find(
        (c) => c.offsetLeft + c.offsetWidth / 2 > mid + 8,
      );
      if (!next) return false;

      busy = true;
      used += 1;
      album.scrollTo({
        left: next.offsetLeft - (album.clientWidth - next.offsetWidth) / 2,
        behavior: "smooth",
      });
      setTimeout(() => {
        busy = false;
      }, 420);
      return true;
    };

    const gesture = (dir, e) => {
      if (!engaged() || !room(dir)) return;
      e.preventDefault();
      centerOnce();
      if (busy) return;
      slide();
    };

    let acc = 0;
    const onWheel = (e) => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      if (!engaged() || !room(Math.sign(e.deltaY))) {
        acc = 0;
        return;
      }
      e.preventDefault();
      centerOnce();
      if (busy) return;
      // Chuột lăn cho delta lớn, bàn di cho hàng chục delta nhỏ → cộng dồn.
      acc += e.deltaY;
      if (acc < RB_SWIPE_MIN) return;
      if (slide()) acc = 0;
    };

    let y0 = 0;
    let x0 = 0;
    const onTouchStart = (e) => {
      y0 = e.touches[0].clientY;
      x0 = e.touches[0].clientX;
    };
    const onTouchMove = (e) => {
      const dy = y0 - e.touches[0].clientY;
      const dx = x0 - e.touches[0].clientX;
      // Vuốt ngang thật thì để dải tự cuộn theo kiểu của trình duyệt.
      if (Math.abs(dx) > Math.abs(dy)) return;
      // Vuốt LÊN (dy < 0) để nguyên cho trang cuộn ngược ra khỏi album.
      if (dy <= 0) return;
      if (dy < RB_SWIPE_MIN) {
        // Vẫn phải chặn ngay từ đoạn vuốt đầu, không thì trang kịp trôi xuống.
        if (engaged() && room(1)) e.preventDefault();
        return;
      }
      y0 = e.touches[0].clientY;
      x0 = e.touches[0].clientX;
      gesture(Math.sign(dy), e);
    };

    window.addEventListener("scroll", onPageScroll, { passive: true });
    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });

    rbSwipeCleanup = () => {
      window.removeEventListener("scroll", onPageScroll);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
    };
  }

  // ============= CHUYỆN TÌNH YÊU (phần đặc thù của mẫu) =============
  // Ghi đè renderLoveStory của render-helper.js (nạp TRƯỚC file này): mỗi mẩu
  // chuyện là MỘT tờ giấy rách mép, góc trái trên cong lên. Chữ hiện dần từng
  // ký tự như đang viết; MỘT cây bút máy chạy theo đầu con chữ rồi mờ đi khi
  // viết xong (không gác lại trên giấy).
  // Giữ .cx-hd/.cx-ac trên từng dòng chữ để màu vẫn theo tab Giao diện; riêng
  // FONT bị ghim ở theme.css cho ra nét viết tay.

  const RB_INK_MS = 26; // nhịp hiện mỗi ký tự

  // MỘT cây bút máy dùng chung cho cả mục, nằm trong #love-story-list và chỉ
  // hiện lúc đang viết — viết xong thì mờ đi, không gác lại trên giấy.
  const RB_PEN = `
    <svg class="rb-pen" viewBox="0 0 160 22" fill="none" aria-hidden="true">
      <path d="M2 11 24 5.5v11L2 11Z" fill="#15120f" />
      <path d="M12 11h9" stroke="#6b6b6b" stroke-width="1" />
      <rect x="24" y="4.5" width="10" height="13" rx="2" fill="#3a342e" />
      <rect x="34" y="3.5" width="88" height="15" rx="7.5" fill="#15120f" />
      <rect x="40" y="6" width="70" height="3" rx="1.5" fill="#fff" opacity=".14" />
      <rect x="118" y="3.5" width="40" height="15" rx="7.5" fill="#0d0b09" />
      <rect x="116" y="3.5" width="4" height="15" fill="#8c8c8c" opacity=".7" />
      <rect x="130" y="1" width="4" height="12" rx="2" fill="#8c8c8c" opacity=".8" />
    </svg>`;

  // Cắt chuỗi thành từng ký tự bọc <span> để hiện dần. Dấu cách để nguyên (không
  // bọc) cho trình duyệt còn chỗ ngắt dòng như văn bản thường.
  function rbInk(str) {
    return [...String(str)]
      .map((ch) =>
        ch === " " ? " " : `<span class="rb-ink">${escapeHtml(ch)}</span>`,
      )
      .join("");
  }

  // Hiện dần từng ký tự, bút bám theo ký tự vừa hiện rồi biến mất khi viết xong.
  // Toạ độ tính trong #love-story-list vì cây bút neo theo khung đó.
  function rbWrite(wrap, pen, done) {
    const chars = wrap.querySelectorAll(".rb-ink");
    const stage = pen?.parentElement;
    let i = 0;

    const finish = () => {
      chars.forEach((el) => el.classList.add("is-inked"));
      if (pen) pen.style.opacity = "0";
      done?.();
    };

    const step = () => {
      // Cuộn vượt qua tờ giấy giữa chừng thì viết nốt ngay, khỏi giữ cây bút ở
      // một chỗ khách không còn nhìn thấy.
      if (i >= chars.length || !rbInView(wrap)) {
        finish();
        return;
      }
      const el = chars[i++];
      el.classList.add("is-inked");
      if (pen && stage) {
        const r = el.getBoundingClientRect();
        const s = stage.getBoundingClientRect();
        // transform-origin của bút đặt ngay đầu ngòi (theme.css) nên translate
        // chính là toạ độ đầu ngòi; nhấc lên vài px cho ngòi chạm chân chữ.
        pen.style.transform =
          `translate(${r.right - s.left}px, ${r.bottom - s.top - 7}px)` +
          " perspective(340px) rotateX(26deg) rotateZ(-24deg)";
        pen.style.opacity = "1";
      }
      setTimeout(step, RB_INK_MS);
    };
    step();
  }

  function rbInView(el) {
    const r = el.getBoundingClientRect();
    return r.bottom > 0 && r.top < (window.innerHeight || 0);
  }

  // Chỉ MỘT tờ được viết tại một thời điểm: vuốt nhanh làm nhiều tờ cùng lọt vào
  // tầm nhìn, để chạy song song thì cây bút (chỉ có một) nhảy loạn giữa các tờ.
  // Tờ đến lượt mà đã cuộn qua mất thì hiện thẳng chữ.
  const rbQueue = [];
  let rbBusy = false;

  function rbEnqueue(wrap, pen) {
    rbQueue.push(wrap);
    rbPump(pen);
  }

  function rbPump(pen) {
    if (rbBusy) return;
    const wrap = rbQueue.shift();
    if (!wrap) return;

    if (!rbInView(wrap)) {
      wrap
        .querySelectorAll(".rb-ink")
        .forEach((el) => el.classList.add("is-inked"));
      rbPump(pen);
      return;
    }

    rbBusy = true;
    rbWrite(wrap, pen, () => {
      rbBusy = false;
      rbPump(pen);
    });
  }

  // Chỉ viết khi tờ giấy vào tầm nhìn — cũng là lúc DUY NHẤT đo được toạ độ:
  // #main-card để display:none cho tới khi khách mở bìa, đo trước đó ra 0.
  // Máy tắt hiệu ứng chuyển động thì hiện thẳng chữ, không chạy bút.
  function rbSetupWriter(wrap, pen) {
    const reduced = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const start = () => {
      if (reduced) {
        wrap
          .querySelectorAll(".rb-ink")
          .forEach((el) => el.classList.add("is-inked"));
        return;
      }
      requestAnimationFrame(() => rbEnqueue(wrap, pen));
    };

    if (!("IntersectionObserver" in window)) {
      start();
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          io.disconnect();
          start();
        });
      },
      { threshold: 0.2 },
    );
    io.observe(wrap);
  }

  function rbRenderLoveStory(events) {
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
      .map((ev) => {
        const img = ev.image_url ? getImageUrl(ev.image_url) : null;
        const fp = ev.focal_point
          ? ` style="object-position:${ev.focal_point.x}% ${ev.focal_point.y}%"`
          : "";
        return `
      <div class="rb-paper-wrap">
        <div class="rb-paper text-left">
          ${ev.date ? `<div class="rb-story-date cx-ac">${rbInk(ev.date)}</div>` : ""}
          ${ev.title ? `<div class="rb-story-title cx-hd">${rbInk(ev.title)}</div>` : ""}
          ${ev.content ? `<div class="rb-story-text cx-hd">${rbInk(ev.content)}</div>` : ""}
          ${img ? `<img class="rb-story-photo" src="${img}" alt=""${fp} loading="lazy" />` : ""}
        </div>
      </div>`;
      })
      .join("");

    // Vẽ lại danh sách (xem trước ở trang Thiết lập) → bỏ hàng đợi cũ.
    rbQueue.length = 0;
    rbBusy = false;

    list.insertAdjacentHTML("beforeend", RB_PEN);
    const pen = list.querySelector(".rb-pen");
    list
      .querySelectorAll(".rb-paper-wrap")
      .forEach((wrap) => rbSetupWriter(wrap, pen));
  }

  window.renderLoveStory = rbRenderLoveStory;
})();
