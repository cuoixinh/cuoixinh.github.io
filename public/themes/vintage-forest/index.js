// ============= THEME: VINTAGE FOREST =============
// Trắng & hồng phấn, tối giản. Mẫu LẤY ẢNH LÀM CHÍNH: rút gọn còn 8 mục (không
// có Gia đình, không có Lịch trình ngày cưới), bù lại album chứa tới ~18 ảnh
// qua 5 khối bố cục chia hai cụm, và Chuyện chúng mình viết thành VĂN XUÔI liền
// mạch thay cho dòng thời gian có chấm mốc.
// Màn bìa là tấm thiệp viền kép trên nền ảnh mờ; mở ra là poster ngày cưới cỡ
// lớn kèm đếm ngược tới từng GIÂY.
//
// File này chỉ KHAI BÁO: window.CX_THEME + renderWedding + phần đặc thù của mẫu.
// Phần "chạy" nằm ở core/helpers/theme-boot.js, nạp sau file này.
//
// Bọc trong IIFE, chỉ lộ CX_THEME + renderWedding: `const` cấp cao nhất của
// script cổ điển là biến toàn cục, trùng tên với trang khác là vỡ trang đó.

(function () {
  window.CX_THEME = {
    id: "vintage-forest",

    // Bước mà trang Thiết lập KHÔNG hiện cho mẫu này (id trùng CX_STEPS ở
    // invitation-setup/js/20-steps.js): mẫu không vẽ mục Gia đình lẫn Lịch trình
    // nên cũng đừng bắt khách nhập.
    skipSteps: ["family", "timeline"],

    // Độ dài mốc chuyện tình XuXi viết (xem base-theme). Các mốc nối thành đoạn văn xuôi liền mạch, cần chữ dày mới thành bài.
    loveStory: "long",

    // Dạng hiện lời chúc khi chủ thiệp chưa chọn (theme_setting.wishes_mode).
    wishesMode: "spotlight",

    // Hộp mừng cưới khi chủ thiệp chưa chọn (theme_setting.gift_box): id trong
    // CX_GIFT_BOXES (core/helpers/gift-box-helper.js) hoặc "none". Mẫu KHÔNG tự vẽ hộp.
    giftBox: "lixi_hong_mai",

    // Dạng trình phát nhạc — theme-boot.js dựng vào #cx-music-mount.
    music: { variant: "disc", chrome: "fixed-corner", art: "couple" },

    // Bộ màu MẶC ĐỊNH của mẫu — bản khai máy đọc được của đúng những giá trị
    // :root trong theme.css (nguồn sự thật). Trang Thiết lập đọc nó để hiện mục
    // "Mặc định"; theme_setting.palette ghi đè lên trên lúc chạy.
    // Sinh lại bằng: node scripts/check-theme-palette.mjs --write
    palette: {
      heading: "#1a1a1a",
      body: "#7a7a7a",
      accent: "#f3a8b8",
      accent_soft: "#e8b4b8",
      on_accent: "#ffffff",
      on_image: "#ffffff",
      on_lightbox: "#ffffff",
      card_bg: "#ffffff",
      page_bg: "#fdf1f3",
      surface: "#fdf1f3",
      band: "#fdf1f3",
      panel: "#ffffff",
      panel_warm: "#fffdfa",
      cover: "#ffffff",
      cover_mid: "#fdf1f3",
      cover_veil: "#fdf1f3",
      lightbox_bg: "#000000",
      line: "#f6d6dd",
      shadow: "#000000",
      scrim: "#000000",
      deco: "#be2c34",
      deco_soft: "#f5d5d8",
      deco_2: "#be2c34",
      deco_2_soft: "#f5d5d8",
      shine_from: "#d4a5a5",
      shine_mid: "#e8b4b8",
      shine_to: "#f5d5d8",
    },

    // Bộ màu RIÊNG của mẫu (hiện ngay sau "Mặc định"): cùng khuôn với màu gốc — thân thiệp và
    // thẻ con TRẮNG cố định, màu chủ đạo nằm ở dải nền xen kẽ, nét kẻ, trái tim, chữ viết tay.
    // Nhấn đủ đậm để chữ trắng đọc được → chữ số trên trái tim/ô ngày đổi sang trắng qua `vars`;
    // `hold` giữ mấy ô giấy trắng đứng yên khi khách kéo "Độ đậm".
    palettes: [
      {
        id: "vintage-forest-hong-phan",
        name: "Hồng phấn",
        heading: "#29191c",
        body: "#655054",
        accent: "#bd5167",
        accent_soft: "#f2b0bd",
        on_accent: "#ffffff",
        on_image: "#ffffff",
        on_lightbox: "#ffffff",
        card_bg: "#ffffff",
        page_bg: "#f7cfd7",
        surface: "#f7cfd7",
        band: "#f7cfd7",
        panel: "#ffffff",
        panel_warm: "#fdfbfc",
        cover: "#ffffff",
        cover_mid: "#f7cfd7",
        cover_veil: "#f7cfd7",
        lightbox_bg: "#000000",
        line: "#f1c6ce",
        shadow: "#29191c",
        scrim: "#181012",
        deco: "#bd5167",
        deco_soft: "#f2b0bd",
        deco_2: "#bd5167",
        deco_2_soft: "#f2b0bd",
        shine_from: "#ffffff",
        shine_mid: "#f8d3da",
        shine_to: "#ee96a7",
        giftBox: "lixi_hong_mai",
        wishes: { text: "body", accent: "heading", btn: "heading" },
        hold: ["card_bg", "panel", "panel_warm", "cover"],
        vars: { "--vf-on-accent-rgb": "#ffffff" },
      },
      {
        id: "vintage-forest-do-ruou",
        name: "Đỏ rượu",
        heading: "#29191c",
        body: "#6e565a",
        accent: "#8a2839",
        accent_soft: "#eab8c0",
        on_accent: "#ffffff",
        on_image: "#ffffff",
        on_lightbox: "#ffffff",
        card_bg: "#ffffff",
        page_bg: "#f8dde2",
        surface: "#f8dde2",
        band: "#f8dde2",
        panel: "#ffffff",
        panel_warm: "#fdfbfc",
        cover: "#ffffff",
        cover_mid: "#f8dde2",
        cover_veil: "#f8dde2",
        lightbox_bg: "#000000",
        line: "#f1c6cd",
        shadow: "#29191c",
        scrim: "#181012",
        deco: "#8a2839",
        deco_soft: "#eab8c0",
        deco_2: "#8a2839",
        deco_2_soft: "#eab8c0",
        shine_from: "#ffffff",
        shine_mid: "#f4d7dc",
        shine_to: "#e3a0ab",
        giftBox: "lixi_do_hy",
        wishes: { text: "body", accent: "heading", btn: "heading" },
        hold: ["card_bg", "panel", "panel_warm", "cover"],
        // Khối xen kẽ đỏ rượu chữ ngà nhấn vàng — cùng bảng với màu gốc của som-hom-co-nhau.
        vars: {
          "--vf-on-accent-rgb": "#ffffff",
          "--vf-tint-bg-rgb": "#5a1621",
          "--vf-tint-heading-rgb": "#fbefe6",
          "--vf-tint-body-rgb": "#efdcd5",
          "--vf-tint-accent-rgb": "#e3c27f",
          "--vf-tint-line-rgb": "#8f6440",
          "--vf-tint-paper-rgb": "#5a1621",
          "--vf-tint-panel-rgb": "#6b2230",
        },
      },
      {
        id: "vintage-forest-do-son",
        name: "Đỏ son",
        heading: "#29191b",
        body: "#6f585b",
        accent: "#d13d51",
        accent_soft: "#eeb5bc",
        on_accent: "#ffffff",
        on_image: "#ffffff",
        on_lightbox: "#ffffff",
        card_bg: "#ffffff",
        page_bg: "#fae1e4",
        surface: "#fae1e4",
        band: "#fae1e4",
        panel: "#ffffff",
        panel_warm: "#fdfbfc",
        cover: "#ffffff",
        cover_mid: "#fae1e4",
        cover_veil: "#fae1e4",
        lightbox_bg: "#000000",
        line: "#f1c6cc",
        shadow: "#29191b",
        scrim: "#181011",
        deco: "#d13d51",
        deco_soft: "#eeb5bc",
        deco_2: "#d13d51",
        deco_2_soft: "#eeb5bc",
        shine_from: "#ffffff",
        shine_mid: "#f5d6da",
        shine_to: "#e89ca6",
        giftBox: "lixi_do_hy",
        wishes: { text: "body", accent: "heading", btn: "heading" },
        hold: ["card_bg", "panel", "panel_warm", "cover"],
        vars: { "--vf-on-accent-rgb": "#ffffff" },
      },
      {
        id: "vintage-forest-dao",
        name: "Đào",
        heading: "#291e19",
        body: "#6e5d56",
        accent: "#c15222",
        accent_soft: "#f1c4b1",
        on_accent: "#ffffff",
        on_image: "#ffffff",
        on_lightbox: "#ffffff",
        card_bg: "#ffffff",
        page_bg: "#fae8e1",
        surface: "#fae8e1",
        band: "#fae8e1",
        panel: "#ffffff",
        panel_warm: "#fdfcfb",
        cover: "#ffffff",
        cover_mid: "#fae8e1",
        cover_veil: "#fae8e1",
        lightbox_bg: "#000000",
        line: "#f1d3c6",
        shadow: "#291e19",
        scrim: "#181310",
        deco: "#c15222",
        deco_soft: "#f1c4b1",
        deco_2: "#c15222",
        deco_2_soft: "#f1c4b1",
        shine_from: "#ffffff",
        shine_mid: "#f7ded4",
        shine_to: "#edb197",
        giftBox: "lixi_hong_mai",
        wishes: { text: "body", accent: "heading", btn: "heading" },
        hold: ["card_bg", "panel", "panel_warm", "cover"],
        vars: { "--vf-on-accent-rgb": "#ffffff" },
      },
      {
        id: "vintage-forest-vang-kem",
        name: "Vàng kem",
        heading: "#292419",
        body: "#6b6354",
        accent: "#936d22",
        accent_soft: "#eedbb5",
        on_accent: "#ffffff",
        on_image: "#ffffff",
        on_lightbox: "#ffffff",
        card_bg: "#ffffff",
        page_bg: "#faf1e1",
        surface: "#faf1e1",
        band: "#faf1e1",
        panel: "#ffffff",
        panel_warm: "#fdfdfb",
        cover: "#ffffff",
        cover_mid: "#faf1e1",
        cover_veil: "#faf1e1",
        lightbox_bg: "#000000",
        line: "#f1e2c6",
        shadow: "#292419",
        scrim: "#181610",
        deco: "#936d22",
        deco_soft: "#eedbb5",
        deco_2: "#936d22",
        deco_2_soft: "#eedbb5",
        shine_from: "#ffffff",
        shine_mid: "#f5ebd6",
        shine_to: "#e8ce9c",
        giftBox: "phongbi_trang_vang",
        wishes: { text: "body", accent: "heading", btn: "heading" },
        hold: ["card_bg", "panel", "panel_warm", "cover"],
        vars: { "--vf-on-accent-rgb": "#ffffff" },
      },
      {
        id: "vintage-forest-nau-be",
        name: "Nâu be",
        heading: "#292119",
        body: "#6d6055",
        accent: "#926d4b",
        accent_soft: "#e0d0c2",
        on_accent: "#ffffff",
        on_image: "#ffffff",
        on_lightbox: "#ffffff",
        card_bg: "#ffffff",
        page_bg: "#f5ede6",
        surface: "#f5ede6",
        band: "#f5ede6",
        panel: "#ffffff",
        panel_warm: "#fdfcfb",
        cover: "#ffffff",
        cover_mid: "#f5ede6",
        cover_veil: "#f5ede6",
        lightbox_bg: "#000000",
        line: "#e9dace",
        shadow: "#292119",
        scrim: "#181410",
        deco: "#926d4b",
        deco_soft: "#e0d0c2",
        deco_2: "#926d4b",
        deco_2_soft: "#e0d0c2",
        shine_from: "#ffffff",
        shine_mid: "#eee5dd",
        shine_to: "#d5c0ae",
        giftBox: "minimalism_brown",
        wishes: { text: "body", accent: "heading", btn: "heading" },
        hold: ["card_bg", "panel", "panel_warm", "cover"],
        vars: { "--vf-on-accent-rgb": "#ffffff" },
      },
      {
        id: "vintage-forest-xanh-sage",
        name: "Xanh sage",
        heading: "#20281a",
        body: "#5b6852",
        accent: "#627c50",
        accent_soft: "#cfdbc7",
        on_accent: "#ffffff",
        on_image: "#ffffff",
        on_lightbox: "#ffffff",
        card_bg: "#ffffff",
        page_bg: "#ecf3e7",
        surface: "#ecf3e7",
        band: "#ecf3e7",
        panel: "#ffffff",
        panel_warm: "#fcfdfb",
        cover: "#ffffff",
        cover_mid: "#ecf3e7",
        cover_veil: "#ecf3e7",
        lightbox_bg: "#000000",
        line: "#dae5d2",
        shadow: "#20281a",
        scrim: "#141810",
        deco: "#627c50",
        deco_soft: "#cfdbc7",
        deco_2: "#627c50",
        deco_2_soft: "#cfdbc7",
        shine_from: "#ffffff",
        shine_mid: "#e5ebe0",
        shine_to: "#c0cfb4",
        giftBox: "phongbi_xanh_la",
        wishes: { text: "body", accent: "heading", btn: "heading" },
        hold: ["card_bg", "panel", "panel_warm", "cover"],
        vars: { "--vf-on-accent-rgb": "#ffffff" },
      },
      {
        id: "vintage-forest-xanh-ngoc",
        name: "Xanh ngọc",
        heading: "#192927",
        body: "#526865",
        accent: "#3a8075",
        accent_soft: "#c0e3dd",
        on_accent: "#ffffff",
        on_image: "#ffffff",
        on_lightbox: "#ffffff",
        card_bg: "#ffffff",
        page_bg: "#e5f6f3",
        surface: "#e5f6f3",
        band: "#e5f6f3",
        panel: "#ffffff",
        panel_warm: "#fbfdfd",
        cover: "#ffffff",
        cover_mid: "#e5f6f3",
        cover_veil: "#e5f6f3",
        lightbox_bg: "#000000",
        line: "#ccebe6",
        shadow: "#192927",
        scrim: "#101817",
        deco: "#3a8075",
        deco_soft: "#c0e3dd",
        deco_2: "#3a8075",
        deco_2_soft: "#c0e3dd",
        shine_from: "#ffffff",
        shine_mid: "#dcefec",
        shine_to: "#abd9d1",
        giftBox: "phongbi_xanh_la",
        wishes: { text: "body", accent: "heading", btn: "heading" },
        hold: ["card_bg", "panel", "panel_warm", "cover"],
        vars: { "--vf-on-accent-rgb": "#ffffff" },
      },
      {
        id: "vintage-forest-xanh-duong",
        name: "Xanh dương",
        heading: "#192129",
        body: "#56616e",
        accent: "#4377b1",
        accent_soft: "#bcd0e6",
        on_accent: "#ffffff",
        on_image: "#ffffff",
        on_lightbox: "#ffffff",
        card_bg: "#ffffff",
        page_bg: "#e3ecf7",
        surface: "#e3ecf7",
        band: "#e3ecf7",
        panel: "#ffffff",
        panel_warm: "#fbfcfd",
        cover: "#ffffff",
        cover_mid: "#e3ecf7",
        cover_veil: "#e3ecf7",
        lightbox_bg: "#000000",
        line: "#c9daed",
        shadow: "#192129",
        scrim: "#101418",
        deco: "#4377b1",
        deco_soft: "#bcd0e6",
        deco_2: "#4377b1",
        deco_2_soft: "#bcd0e6",
        shine_from: "#ffffff",
        shine_mid: "#dae5f1",
        shine_to: "#a6c0dd",
        giftBox: "hop_navy_vang",
        wishes: { text: "body", accent: "heading", btn: "heading" },
        hold: ["card_bg", "panel", "panel_warm", "cover"],
        vars: { "--vf-on-accent-rgb": "#ffffff" },
      },
      {
        id: "vintage-forest-tim",
        name: "Tím oải hương",
        heading: "#211929",
        body: "#655a72",
        accent: "#8b62b9",
        accent_soft: "#d0c0e3",
        on_accent: "#ffffff",
        on_image: "#ffffff",
        on_lightbox: "#ffffff",
        card_bg: "#ffffff",
        page_bg: "#ede5f6",
        surface: "#ede5f6",
        band: "#ede5f6",
        panel: "#ffffff",
        panel_warm: "#fcfbfd",
        cover: "#ffffff",
        cover_mid: "#ede5f6",
        cover_veil: "#ede5f6",
        lightbox_bg: "#000000",
        line: "#dacceb",
        shadow: "#211929",
        scrim: "#141018",
        deco: "#8b62b9",
        deco_soft: "#d0c0e3",
        deco_2: "#8b62b9",
        deco_2_soft: "#d0c0e3",
        shine_from: "#ffffff",
        shine_mid: "#e5dcef",
        shine_to: "#c0abd9",
        giftBox: "phongbi_origami_tim",
        wishes: { text: "body", accent: "heading", btn: "heading" },
        hold: ["card_bg", "panel", "panel_warm", "cover"],
        vars: { "--vf-on-accent-rgb": "#ffffff" },
      },
      {
        id: "vintage-forest-xam",
        name: "Xám bạc",
        heading: "#1e2124",
        body: "#5a626d",
        accent: "#6c7684",
        accent_soft: "#cdd0d6",
        on_accent: "#ffffff",
        on_image: "#ffffff",
        on_lightbox: "#ffffff",
        card_bg: "#ffffff",
        page_bg: "#eaedf1",
        surface: "#eaedf1",
        band: "#eaedf1",
        panel: "#ffffff",
        panel_warm: "#fbfcfd",
        cover: "#ffffff",
        cover_mid: "#eaedf1",
        cover_veil: "#eaedf1",
        lightbox_bg: "#000000",
        line: "#d6dae1",
        shadow: "#1e2124",
        scrim: "#101418",
        deco: "#6c7684",
        deco_soft: "#cdd0d6",
        deco_2: "#6c7684",
        deco_2_soft: "#cdd0d6",
        shine_from: "#ffffff",
        shine_mid: "#e3e5e8",
        shine_to: "#bcc1c8",
        giftBox: "phongbi_kem_sap",
        wishes: { text: "body", accent: "heading", btn: "heading" },
        hold: ["card_bg", "panel", "panel_warm", "cover"],
        vars: { "--vf-on-accent-rgb": "#ffffff" },
      },
    ],

    // Màu GỢI Ý trong bộ chọn màu (khách bấm vào một phần tử trên thiệp rồi
    // chỉnh riêng) — lấy từ chính bảng màu của mẫu.
    swatches: [
      "#1a1a1a",
      "#3f3f3f",
      "#7a7a7a",
      "#a8a8a8",
      "#f3a8b8",
      "#f7c9d3",
      "#fbdde3",
      "#fdf1f3",
      "#e8b4a0",
      "#9db08a",
      "#ffffff",
    ],

    // Poster mở đầu KHÔNG hiện dần: nó choán cả màn ngay khi vào, cho trượt vào
    // thì khách thấy một khoảng trống trước đã.
    reveal: ["#main-card section:not(#section-hero)"],

    // Mốc bung bảng đề xuất mẫu khác ở bản xem thử (?preview=true): cuộn tới
    // mục này là bảng trượt lên. Mặc định của core/utils.js cũng là chân
    // thiệp, khai ra đây để mỗi mẫu tự chọn được chỗ hợp với bố cục của mình.
    suggest: "#section-footer",

    // Cụm ảnh thứ hai không có trong bảng mặc định của preview-focus-helper.js.
    focus: { photos: ["#section-photos", "#section-photos-2"] },

    // Màu lời chúc (cố định theo mẫu): tên khách + nút gửi màu than, chữ xám đậm —
    // hồng phấn làm chữ thì không đọc nổi trên nền trắng.
    wishes: { text: "#666666", accent: "#1a1a1a", btn: "#1a1a1a" },

    onOpen: null,
  };

  const _isGroom = isGroomSide();

  // Link riêng (?g= hoặc ?name= cũ) hiện lời mời ngay, khỏi đợi giải mã xong mới nhảy chữ;
  // link chung thì setupPersonalizedGreeting() tự gỡ .hidden.
  try {
    const q = new URLSearchParams(window.location.search);
    if (q.get("name") || q.get("g")) {
      document.getElementById("cover-guest-wrap")?.classList.remove("hidden");
    }
  } catch (e) {}

  // ============= ĐỔ DỮ LIỆU LÊN THIỆP =============

  function renderWedding(w) {
    if (!w || !w.is_active) return;

    const side = _isGroom ? "groom" : "bride";

    // --- Màn bìa + poster mở đầu ---
    // Khối dựng ảnh chạy TRƯỚC setupMusic: đây là chỗ ảnh của màn ĐẦU TIÊN nhận
    // src, mà setupMusic kéo YouTube iframe API (script bên thứ ba) về ngay khi
    // chạy — để nó đi trước là ảnh phải xếp hàng sau.

    renderCover(w);
    setAttr("cover-photo", "src", getImageUrl(w.cover_image_url));
    applyFocalPoint("cover-photo", w.image_focal_points?.cover_image_url);
    setText("cover-date", _coverDate(w.ceremony_date), "-- · -- · ----");

    renderHero(w, false);
    renderStoryQuote(w.story_quote);
    setText("hero-day", _dayMonth(w.ceremony_date), "--/--");
    setText("hero-year", _year(w.ceremony_date), "----");
    setText("footer-date", _coverDate(w.ceremony_date), "-- · -- · ----");
    startCountdown(w.ceremony_date, w.ceremony_time);

    // --- Nhạc nền ---
    setupMusic(w.music_url, w.enable_music);

    // --- Thư mời: nhà gái bật Vu Quy thì thay toàn bộ phần lễ ---
    const isVuQuy = !_isGroom && cxEnabled(w.vu_quy_enabled);
    const ceremonyName = isVuQuy ? "Lễ Vu Quy" : w.ceremony_name || "Lễ Thành Hôn";
    const ceremonyTime = isVuQuy ? w.vu_quy_time : w.ceremony_time;
    const ceremonyLoc = isVuQuy ? w.vu_quy_location : w.ceremony_location || "";

    // Mẫu này KHÔNG có mục Gia đình (không có tên bố mẹ, địa chỉ hai nhà) — bước
    // đó đã bỏ qua skipSteps. Vẫn gọi
    // renderCoupleInfo vì hai ẢNH chú rể / cô dâu được dùng ở mục Thư mời; các
    // setText còn lại trong hàm đó không tìm thấy id nên tự bỏ qua.
    renderCoupleInfo(w);

    setText("invite-groom", w.groom_name, "----------");
    setText("invite-bride", w.bride_name, "----------");
    setText("ceremony-event-name", ceremonyName);
    renderCeremonyDate(w.ceremony_date, ceremonyTime, w.ceremony_lunar);
    cxToggle("invite-lunar", !!w.ceremony_lunar);
    if (ceremonyLoc) {
      setText("ceremony-location-text", ceremonyLoc);
      cxToggle("ceremony-location-wrap", true);
    }

    _vfCouple = [w.bride_name, w.groom_name].filter(Boolean).join(" & ");
    _vfSetActions("ceremony", {
      title: ceremonyName,
      date: w.ceremony_date,
      time: ceremonyTime,
      loc: ceremonyLoc,
      map: isVuQuy ? w.vu_quy_map_embed_url : w.ceremony_map_embed_url,
    });

    // Khối tóm tắt trong trình phát nhạc — dùng CHÍNH phần lễ đang hiển thị.
    renderMusicSummary(w, {
      ceremonyName,
      ceremonyTime,
      ceremonyLocation: ceremonyLoc,
    });

    // --- Tiệc cưới (mỗi nhà một ngày/giờ/nơi riêng) ---
    const partyDate = w[`${side}_party_date`];
    const partyLocation = w[`${side}_party_location`];
    const partyTime = w[`${side}_party_time`];
    // Dạng tách (ngày · thứ · tháng-năm · giờ từng ô) để dựng khối ngày serif.
    renderPartyDate(partyDate, partyTime, w[`${side}_party_lunar`], partyLocation, "split");
    setText("party-time", partyTime, "--:--");
    cxToggle("party-lunar", !!w[`${side}_party_lunar`]);
    _vfSetActions("party", {
      title: "Tiệc Mừng " + ceremonyName,
      date: partyDate,
      time: partyTime,
      loc: partyLocation,
      map: w[`${side}_party_map_embed_url`],
    });
    cxToggle("section-party", cxEnabled(w.enable_party));

    // Dòng địa danh cuối poster: nơi đãi tiệc là chỗ khách phải tới, không có
    // thì lùi về nơi làm lễ. Trống thì giấu cả dòng, đừng để trơ mỗi icon.
    const heroPlace = _shortPlace(partyLocation || ceremonyLoc);
    setText("hero-place", heroPlace, "");
    cxToggle("hero-place-wrap", !!heroPlace);

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

    // --- Chuyện chúng mình (văn xuôi) ---
    if (cxEnabled(w.enable_love_story)) {
      _renderStoryProse(w.love_story, w.groom_name, w.bride_name);
    } else {
      cxToggle("love-story", false);
    }

    // --- Ảnh cho các mục ngoài album ---
    // Album tối đa 10 tấm nên không đủ để chia riêng: CHẤP NHẬN DÙNG LẠI ảnh,
    // album vẫn vẽ đủ cả 10 tấm (không cắt tấm nào ra). Mỗi mục lấy một vị trí
    // khác nhau cho đỡ trùng nhau; album rỗng thì lùi về ảnh bìa.
    const album = Array.isArray(w.gallery_images) ? w.gallery_images.slice() : [];
    const focals = w.image_focal_points?.gallery_images;
    const _pick = (i) => album[i] || w.cover_image_url;

    _sectionPhoto("party-photo", _pick(album.length >> 1), focals, "vf-wide-photo");
    _renderCalendar(w.ceremony_date, cxEnabled(w.enable_party) ? partyDate : null, _pick(album.length - 1), focals);

    // --- Album ảnh ---
    if (cxEnabled(w.enable_photos)) {
      renderGallery(album, focals);
    } else {
      cxToggle("section-photos", false);
      cxToggle("section-photos-2", false);
    }

    // --- Hộp mừng cưới ---
    renderQRCodes(w);
    cxToggle("section-gift", cxEnabled(w.enable_gift));

    // --- Bản đồ: tiệc, thêm bản đồ lễ khi hai nơi khác nhau ---
    renderVenueMaps(w, side);

    // --- Lời cảm ơn ---
    if (w.footer_text) setText("footer-text", w.footer_text);
    cxToggle("section-footer", cxEnabled(w.enable_footer));

    vfStripeWatch();
  }

  window.renderWedding = renderWedding;

  // Bộ màu có khối xen kẽ RIÊNG (`--vf-tint-bg-rgb` khác dải nhạt chung, vd Đỏ rượu): mục
  // đang HIỆN sau màn mở đầu xen kẽ đều màu / trắng theo flex `order` (lời chúc, khối chèn
  // thêm đánh lại order). Không có thì trả .vf-tint về đúng markup gốc.
  function vfStripe() {
    const hero = document.getElementById("section-hero");
    const host = hero && hero.parentElement;
    if (!host) return;
    const root = getComputedStyle(document.documentElement);
    const on = root.getPropertyValue("--vf-tint-bg-rgb").trim() !== root.getPropertyValue("--cx-band-rgb").trim();
    const secs = [...host.children]
      .filter((el) => el.tagName === "SECTION" && el !== hero)
      .map((el, i) => {
        if (el.dataset.vfTint == null) el.dataset.vfTint = el.classList.contains("vf-tint") ? "1" : "0";
        return { el, i, st: getComputedStyle(el) };
      });
    const shown = secs
      .filter((s) => s.st.display !== "none")
      .sort((a, b) => (parseInt(a.st.order, 10) || 0) - (parseInt(b.st.order, 10) || 0) || a.i - b.i);
    secs.forEach((s) => {
      const n = shown.indexOf(s);
      s.el.classList.toggle("vf-tint", on ? n >= 0 && n % 2 === 0 : s.el.dataset.vfTint === "1");
    });
  }

  // Chạy lại khi bộ màu đổi (thẻ <style> trong <head>), khi mục ẩn/hiện hay khối chèn thêm.
  // toggle không đổi gì thì không sinh mutation nên không tự gọi vòng.
  let _stripeMo = null;
  function vfStripeWatch() {
    vfStripe();
    if (_stripeMo) return;
    let queued = false;
    _stripeMo = new MutationObserver(() => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        vfStripe();
      });
    });
    _stripeMo.observe(document.head, { childList: true, subtree: true, characterData: true });
    const host = document.getElementById("section-hero")?.parentElement;
    if (host) {
      _stripeMo.observe(host, { childList: true });
      host.querySelectorAll(":scope > section").forEach((s) =>
        _stripeMo.observe(s, { attributes: true, attributeFilter: ["class", "style"] }),
      );
    }
  }

  // ============= CHỈ ĐƯỜNG + LƯU LỊCH Ở PHẦN LỄ / TIỆC =============
  // Chỉ đường: toạ độ/tên trong `q=` của link bản đồ, không có thì lấy tên địa điểm.
  // Lưu lịch: iPhone/Mac tải file .ics (máy tự mở hộp "Thêm vào lịch"), máy khác mở
  // Google Calendar. Giờ để "trôi" (không múi giờ) — lịch hiểu theo giờ của máy.
  const _vfEvents = {};
  let _vfCouple = "";

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

  function _vfSetActions(key, ev) {
    _vfEvents[key] = ev;
    const dest = _mapDest(ev.map, ev.loc);
    const dir = document.getElementById(`${key}-dir`);
    if (dir && dest) dir.href = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}`;
    cxToggle(`${key}-dir`, !!dest);
    cxToggle(`${key}-cal`, !!_evStart(ev));
    cxToggle(`${key}-actions`, !!dest || !!_evStart(ev));
  }

  function _vfSaveCal(ev) {
    const st = ev && _evStart(ev);
    if (!st) return;
    const [start, timed] = st;
    const end = timed ? new Date(start.getTime() + 2 * 36e5) : new Date(start.getTime() + 864e5);
    const p = (n) => String(n).padStart(2, "0");
    const day = (d) => `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
    const stamp = (d) => (timed ? `${day(d)}T${p(d.getHours())}${p(d.getMinutes())}00` : day(d));
    const title = _vfCouple ? `${ev.title} · ${_vfCouple}` : ev.title;
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
    const b = e.target.closest?.("[data-vf-cal]");
    if (b) _vfSaveCal(_vfEvents[b.dataset.vfCal]);
  });

  // ============= POSTER MỞ ĐẦU =============

  /** "15/9" — ngày/tháng cỡ lớn, dòng trên của poster. */
  function _dayMonth(dateStr) {
    const d = _date(dateStr);
    return d ? `${d.getDate()}/${d.getMonth() + 1}` : "";
  }

  /** "2024" — dòng dưới của poster. */
  function _year(dateStr) {
    const d = _date(dateStr);
    return d ? String(d.getFullYear()) : "";
  }

  /** "20 · 05 · 2025" — dòng ngày ở màn bìa và cuối thiệp. */
  function _coverDate(dateStr) {
    const d = _date(dateStr);
    if (!d) return "";
    const p = (n) => String(n).padStart(2, "0");
    return `${p(d.getDate())} · ${p(d.getMonth() + 1)} · ${d.getFullYear()}`;
  }

  function _date(dateStr) {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    return isNaN(d) ? null : d;
  }

  /**
   * Địa danh ngắn cho poster: giữ HAI cụm cuối của địa chỉ (thường là
   * huyện + tỉnh). Địa chỉ đầy đủ dài mấy dòng sẽ phá bố cục poster.
   */
  function _shortPlace(location) {
    if (!location) return "";
    const parts = location
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    return parts.slice(-2).join(", ");
  }

  // ============= ĐẾM NGƯỢC TỚI NGÀY CƯỚI =============
  // Chỉ tính từ ceremony_date (+ giờ nếu có) nên không cần thêm gì ở trang
  // Thiết lập. Hiện tới GIÂY nên nhịp chạy mỗi giây; qua ngày cưới thì về 00 và
  // dừng hẳn.

  let _cdTimer = null;

  function startCountdown(dateStr, timeStr) {
    if (_cdTimer) clearInterval(_cdTimer);
    const target = dateStr
      ? new Date(`${dateStr}T${timeStr || "00:00"}:00`).getTime()
      : NaN;
    if (isNaN(target)) return;

    const pad = (n) => String(Math.max(0, n)).padStart(2, "0");

    function tick() {
      const left = target - Date.now();
      if (left <= 0) {
        ["cd-days", "cd-hours", "cd-minutes", "cd-seconds"].forEach((id) =>
          setText(id, "00"),
        );
        clearInterval(_cdTimer);
        _cdTimer = null;
        return;
      }
      const sec = Math.floor(left / 1000);
      setText("cd-days", pad(Math.floor(sec / 86400)));
      setText("cd-hours", pad(Math.floor((sec % 86400) / 3600)));
      setText("cd-minutes", pad(Math.floor((sec % 3600) / 60)));
      setText("cd-seconds", pad(sec % 60));
    }

    tick();
    _cdTimer = setInterval(tick, 1000);
  }

  // ============= CHUYỆN CHÚNG MÌNH — VĂN XUÔI =============
  // Khác các mẫu trước: không vẽ dòng thời gian có chấm mốc. Nội dung các mốc
  // được nối thành những ĐOẠN VĂN liền mạch (bỏ mốc thời gian và tiêu đề từng
  // mốc), ảnh của các mốc chèn xen giữa. Ảnh ở đây KHÔNG bấm phóng to được: nó
  // không nằm trong lightboxImages, cho bấm sẽ mở nhầm ảnh khác.

  const VF_STORY_MAX_PHOTOS = 2;
  const VF_DROPCAP_MIN = 110;

  function _renderStoryProse(events, groomName, brideName) {
    const list = document.getElementById("love-story-list");
    if (!list) return;

    const items = Array.isArray(events) ? events : [];
    // Mốc nào chỉ có tiêu đề mà không có nội dung thì lấy chính tiêu đề làm câu.
    const paras = items
      .map((ev) => (ev.content || ev.title || "").trim())
      .filter(Boolean);
    if (!paras.length) {
      cxToggle("love-story", false);
      return;
    }

    const photos = items
      .filter((ev) => ev.image_url)
      .slice(0, VF_STORY_MAX_PHOTOS);

    // Ảnh chèn sau đoạn nào: rải đều theo số đoạn để không dồn hết xuống cuối.
    const gap = Math.max(1, Math.ceil(paras.length / (photos.length + 1)));

    let html = "";
    let used = 0;
    paras.forEach((text, i) => {
      // Chữ cái lớn cao 3 dòng: đoạn mở ngắn hơn chừng đó thì chữ lớn trơ ra
      // một mình nên bỏ.
      html +=
        '<p class="cx-t vf-para' +
        (i === 0 && text.length >= VF_DROPCAP_MIN ? " vf-para-lead" : "") +
        '">' +
        escapeHtml(text) +
        "</p>";
      if (used < photos.length && (i + 1) % gap === 0 && i < paras.length - 1) {
        const p = photos[used++];
        const fp = p.focal_point;
        html +=
          `<img src="${cxImgSrc(p.image_url)}" alt="" loading="lazy"` +
          ` class="vf-story-photo" style="object-position:${cxFocal(fp)}">`;
      }
    });
    list.innerHTML = html;

    // Chữ ký cuối mục: tên hai người thay cho dấu "&" mặc định.
    const names = [brideName, groomName].filter(Boolean).join(" & ");
    if (names) setText("story-sign", names);

    cxToggle("love-story", true);
  }

  // ============= ALBUM ẢNH =============
  // Không phải một lưới phẳng: ảnh được rót lần lượt vào 3 khối bố cục, chia
  // hai cụm kẹp lấy mục Chuyện chúng mình.
  //   Cụm 1  1. mở màn (1 ảnh NGANG tràn viền kèm chữ viết tay + hàng 3 ảnh nhỏ)
  //          2. cặp lệch tầng (2 ảnh cạnh nhau, kèm một dòng chữ viết tay)
  //   Cụm 2  3. phần còn lại — dáng chọn theo SỐ ẢNH dư (1 · 2 · 3 · 4 · ≥5)
  // Sáu ảnh đầu vào hai khối của cụm 1, bao nhiêu còn lại dồn hết sang cụm 2 nên
  // album 7–10 tấm vẫn ra bố cục tử tế. Khối nào không đủ ảnh thì tự ẩn; cụm 2
  // hết ảnh thì ẩn cả mục, đừng để trơ mỗi dòng chữ xen giữa.

  // ============= LỊCH THÁNG CƯỚI =============
  // Mẫu tự vẽ thay cho calendar-helper.js (helper đó viết style nội tuyến nên
  // theme.css không nắn được). Chỉ vẽ THÁNG LÀM LỄ: ngày lễ là ô đặc, ngày tiệc
  // là ô viền và chỉ đánh dấu khi tiệc rơi vào đúng tháng đó.

  const VF_WD = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

  function _renderCalendar(ceremonyDate, partyDate, photoFile, focalPoints) {
    const box = document.getElementById("vf-cal");
    if (!box) return;

    const d = ceremonyDate ? new Date(ceremonyDate) : null;
    if (!d || isNaN(d.getTime())) {
      cxToggle("vf-cal", false);
      return;
    }

    const year = d.getFullYear();
    const month = d.getMonth();
    const first = new Date(year, month, 1).getDay();
    const total = new Date(year, month + 1, 0).getDate();
    const cerDay = d.getDate();

    const p = partyDate ? new Date(partyDate) : null;
    const parDay =
      p &&
      !isNaN(p.getTime()) &&
      p.getFullYear() === year &&
      p.getMonth() === month &&
      p.getDate() !== cerDay
        ? p.getDate()
        : 0;

    let cells = '<span class="vf-cal-c"></span>'.repeat(first);
    for (let n = 1; n <= total; n++) {
      const cls = ["vf-cal-d"];
      if ((first + n - 1) % 7 === 0) cls.push("vf-cal-sun");
      if (n === cerDay) cls.push("vf-cal-on");
      else if (n === parDay) cls.push("vf-cal-alt");
      cells += `<span class="vf-cal-c"><span class="${cls.join(" ")}">${n}</span></span>`;
    }

    const head = VF_WD.map(
      (w, i) => `<span${i === 0 ? ' class="vf-cal-sun"' : ""}>${w}</span>`,
    ).join("");

    // Chú thích hai dấu: chấm đặc = ngày lễ, vòng viền = ngày tiệc (cùng tháng).
    let note = `<span><i class="vf-cal-key vf-cal-key-on"></i>Lễ cưới · ${cerDay}</span>`;
    if (parDay) note += `<span><i class="vf-cal-key"></i>Tiệc mừng · ${parDay}</span>`;

    // Ảnh tràn viền trên đầu thẻ. Không mượn được ảnh thì bỏ hẳn khối, đừng để
    // khung trống.
    const fp = photoFile ? focalPoints?.[photoFile] : null;
    const top = photoFile
      ? `<div class="vf-cal-top"><img src="${cxImgSrc(photoFile)}" alt=""
          loading="lazy" style="object-position:${cxFocal(fp)}">
          <svg class="vf-cal-wave" viewBox="0 0 390 40" preserveAspectRatio="none"
            aria-hidden="true">
            <path d="M0 40C96 38 176 8 258 6c54-1 94 8 132 16v18H0z"
              fill="rgb(var(--cx-card-bg-rgb))" />
          </svg></div>`
      : "";

    box.innerHTML = `
      ${top}
      <div class="cx-h vf-cal-mon">Tháng ${month + 1}</div>
      <div class="vf-cal-grid vf-cal-hd cx-t">${head}</div>
      <div class="vf-cal-grid">${cells}</div>
      <div class="cx-t vf-cal-note">${note}</div>`;
  }

  const VF_BAND_TEXT = "Forever &amp; Always";
  const VF_STACK_TEXT = "you &amp; me &#9825;";

  /**
   * Ảnh minh hoạ cho một mục (tiệc). KHÔNG bấm phóng to được: nó không nằm
   * trong lightboxImages. Không có ảnh thì giấu cả khối, đừng để khung trống.
   */
  function _sectionPhoto(wrapId, file, focalPoints, cls) {
    const wrap = document.getElementById(wrapId);
    if (!wrap) return;
    if (!file) {
      cxToggle(wrapId, false);
      return;
    }
    const fp = focalPoints?.[file];
    wrap.innerHTML = `<img src="${cxImgSrc(file)}" alt="" loading="lazy"
      class="${cls}" style="object-position:${cxFocal(fp)}">`;
    cxToggle(wrapId, true);
  }

  /** Một ô ảnh bấm được để phóng to. `i` là vị trí trong lightboxImages. */
  function _photo(url, fp, i, cls) {
    const el = document.createElement("div");
    el.className = cls;
    el.innerHTML = `<img src="${cxImgSrc(url)}" alt="" loading="lazy"
      class="w-full h-full object-cover"
      style="object-position:${cxFocal(fp)}">`;
    el.addEventListener("click", () => openLightbox(i));
    return el;
  }

  function renderGallery(images, focalPoints) {
    const grid = document.getElementById("gallery-rest");
    if (!grid) return;

    const list = images?.length
      ? images.map((f) => ({ url: getImageUrl(f), fp: focalPoints?.[f] }))
      : Array.from({ length: 12 }, (_, i) => ({
          url: createPlaceholderSVG(`Ảnh ${i + 1}`),
          fp: null,
        }));

    // Kho ảnh của lightbox dùng chung — thứ tự phải khớp chỉ số truyền vào _photo.
    lightboxImages.length = 0;
    lightboxImages.push(...list.map((p) => p.url));

    let n = 0; // ảnh kế tiếp chưa dùng
    const take = (k) => (n + k <= list.length ? list.slice(n, (n += k)) : null);

    // 1. Ảnh NGANG tràn viền (chữ viết tay đè lên) + hàng ba ảnh nhỏ ngay dưới.
    // Chỉ đủ ảnh ngang mà thiếu ba ảnh nhỏ thì vẫn dựng, hàng dưới tự bỏ.
    const leadWrap = document.getElementById("gallery-lead");
    const lead = take(1);
    if (leadWrap && lead) {
      leadWrap.innerHTML = "";
      const box = document.createElement("div");
      box.className = "vf-lead";

      const big = document.createElement("div");
      big.className = "vf-band-photo";
      big.appendChild(_photo(lead[0].url, lead[0].fp, n - 1, "vf-band-img"));
      const cap = document.createElement("div");
      cap.className = "vf-band-cap vf-on vf-script";
      cap.innerHTML = VF_BAND_TEXT;
      big.appendChild(cap);
      box.appendChild(big);

      const three = take(3);
      if (three) {
        const row = document.createElement("div");
        row.className = "vf-lead-row";
        three.forEach((p, k) =>
          row.appendChild(_photo(p.url, p.fp, n - 3 + k, "vf-lead-i")),
        );
        box.appendChild(row);
      }
      leadWrap.appendChild(box);
    }
    cxToggle("gallery-lead", !!(leadWrap && lead));

    // 2. Cặp ảnh đứng cạnh nhau; cột phải có một dòng chữ viết tay ở khoảng
    // trống phía trên rồi mới tới ảnh.
    const stackWrap = document.getElementById("gallery-stack");
    const stack = take(2);
    if (stackWrap && stack) {
      stackWrap.innerHTML = "";
      const box = document.createElement("div");
      box.className = "vf-stack";
      const [a, b] = stack;
      box.appendChild(_photo(a.url, a.fp, n - 2, "vf-stack-a"));

      const right = document.createElement("div");
      right.className = "vf-stack-r";
      const cap = document.createElement("div");
      cap.className = "vf-stack-cap vf-script cx-a";
      cap.innerHTML = VF_STACK_TEXT;
      right.appendChild(cap);
      right.appendChild(_photo(b.url, b.fp, n - 1, "vf-stack-b"));
      box.appendChild(right);

      stackWrap.appendChild(box);
    }
    cxToggle("gallery-stack", !!(stackWrap && stack));

    // 3. Toàn bộ ảnh CÒN LẠI. Từ 2 đến 4 tấm thì bày kiểu ẢNH CHỒNG ẢNH: mỗi
    // tấm một khổ, nghiêng mỗi tấm một chiều và gối lên nhau như ảnh rời rải
    // trên bàn — vị trí khai sẵn trong theme.css theo số tấm (.vf-col-<số>).
    // Một tấm thì để nằm ngang một mình, từ 5 tấm trở lên xếp so le hai cột
    // (chồng chừng ấy ảnh là rối).
    const rest = list.slice(n);
    const REST_CLS =
      rest.length >= 5
        ? ["vf-mosaic", "vf-mosaic-i"]
        : rest.length >= 2
          ? ["vf-col vf-col-" + rest.length, "vf-col-i"]
          : ["vf-set vf-set-1", "vf-set-i"];

    if (grid) {
      grid.innerHTML = "";
      grid.className = REST_CLS[0];
      rest.forEach((p, k) =>
        grid.appendChild(_photo(p.url, p.fp, n + k, REST_CLS[1])),
      );
    }

    // Hết ảnh cho cụm 2 thì ẩn cả mục — còn mỗi phần chữ xen giữa là một mục
    // trống trơn.
    cxToggle("section-photos-2", rest.length > 0);
  }
})();
