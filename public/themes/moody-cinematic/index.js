// ============= THEME: MOODY CINEMATIC =============
// Hiện đại, nền SÁNG: chữ xám trầm, nhấn xanh than. Chất điện ảnh dồn vào ẢNH —
// mọi ảnh lớn bọc trong .mc-cine (hai thanh đen giả tỉ lệ màn ảnh rộng).
// Đủ mọi mục như mẫu nền; nét riêng là album dựng thành DẢI PHIM cuộn ngang.
//
// File này chỉ KHAI BÁO: window.CX_THEME + renderWedding + phần đặc thù của mẫu
// (ở đây là dải phim). Phần "chạy" nằm ở core/helpers/theme-boot.js, nạp sau.
//
// Bọc trong IIFE, chỉ lộ CX_THEME + renderWedding: `const` cấp cao nhất của
// script cổ điển là biến toàn cục, trùng tên với trang khác là vỡ trang đó.

(function () {
  window.CX_THEME = {
    // Trùng TÊN THƯ MỤC và cột `templates.template_name`.
    id: "moody-cinematic",

    // Font/màu GỐC: giá trị mặc định trên thanh chỉnh ở tab Giao diện, cũng là
    // điểm "Khôi phục mặc định". Trang Thiết lập đọc qua iframe xem trước.
    // Bộ màu MẶC ĐỊNH của mẫu — bản khai máy đọc được của đúng những giá trị
    // :root trong theme.css (nguồn sự thật). Trang Thiết lập đọc nó để hiện mục
    // "Mặc định"; theme_setting.palette ghi đè lên trên lúc chạy.
    // Sinh lại bằng: node scripts/check-theme-palette.mjs --write
    palette: {
      heading: "#1e252e",
      body: "#6a7380",
      accent: "#2a3d58",
      accent_soft: "#e8b4b8",
      on_accent: "#ffffff",
      on_image: "#ffffff",
      on_lightbox: "#ffffff",
      card_bg: "#ffffff",
      page_bg: "#f2f4f7",
      surface: "#f2f4f7",
      band: "#fff5f0",
      panel: "#ffffff",
      panel_warm: "#ffffff",
      cover: "#f8f9fb",
      cover_mid: "#e8ebf0",
      cover_veil: "#e8ebf0",
      lightbox_bg: "#000000",
      line: "#dbdfe6",
      shadow: "#000000",
      scrim: "#000000",
      deco: "#0c0e12",
      deco_soft: "#f5d5d8",
      deco_2: "#0c0e12",
      deco_2_soft: "#f5d5d8",
      shine_from: "#d4a5a5",
      shine_mid: "#e8b4b8",
      shine_to: "#f5d5d8",
    },

    preset: {
      heading_font: "Prata",
      body_font: "Montserrat",
      heading_color: "#1e252e", // xám trầm
      body_color: "#6a7380",
      accent_color: "#2a3d58", // xanh than sâu
      background_color: "#ffffff",
      // Màu gợi ý — lấy từ chính bảng màu của mẫu: các nấc xám trung tính và
      // xanh than, không có màu rực để giữ tông trầm.
      swatches: [
        "#1e252e",
        "#3a434f",
        "#6a7380",
        "#9aa3ad",
        "#2a3d58",
        "#3f5273",
        "#7c8ca3",
        "#dbdfe6",
        "#f2f4f7",
        "#f8f9fb",
        "#ffffff",
      ],
    },

    // Class mà thanh chỉnh font/màu nhắm tới. Mẫu gom về ba lớp ngữ nghĩa
    // (.cx-h tiêu đề · .cx-t nội dung · .cx-a nhấn, khai trong theme.css).
    // .cx-hd/.cx-bd/.cx-ac là markup do helper dùng chung sinh ra (dòng thời
    // gian, chuyện tình yêu) — GIỮ NGUYÊN.
    // .mc-eyebrow cố ý ĐỨNG NGOÀI: nhãn chữ hoa giãn rộng là nét nhận dạng của
    // mẫu, đổi màu theo nhấn thì vẫn hợp, nhưng đổi font thì mất chất.
    selectors: {
      headingFont: ".cx-h",
      bodyFont: "body, .cx-t",
      headingColor: ".cx-h, .cx-hd",
      bodyColor: ".cx-t, .cx-bd",
      accentColor: ".cx-a, .cx-ac, .mc-eyebrow",
      background: "body, #main-card",
    },

    // Hiệu ứng hiện dần do _markReveal() ở cuối file lo, không phải theme-boot:
    // trang chia bằng cloneNode và nội dung về sau khi boot đã quét xong DOM thì
    // bản quét một lần của theme-boot không với tới. Selector này cố tình không
    // khớp gì (theme-boot vẫn cần một danh sách khác rỗng để querySelectorAll).
    reveal: ["#cx-no-reveal"],

    // Mốc bung bảng đề xuất mẫu khác ở bản xem thử (?preview=true): cuộn tới
    // mục này là bảng trượt lên. Mặc định của core/utils.js cũng là hộp mừng
    // cưới, khai ra đây để mỗi mẫu tự chọn được chỗ hợp với bố cục của mình.
    suggest: "#section-gift",

    // Thư mời và Gia đình không còn là mục riêng — cả hai nằm trong trang
    // #section-hero, nên phải chỉ lại cho khung xem trực tiếp biết cuộn tới đâu.
    focus: {
      ceremony: ["#section-hero"],
      family: ["#section-family", "#section-hero"],
    },

    // Dựng quyển sách SAU khi #main-card hiện: trước đó thẻ còn display:none
    // nên mọi phép đo chiều cao đều ra 0.
    onOpen: () => {
      setupBook();
      refreshBook();
    },
  };

  const _isGroom = isGroomSide();

  // ============= ĐỔ DỮ LIỆU LÊN THIỆP =============
  // Gọi theo đúng thứ tự các mục trong index.html.

  function renderWedding(w) {
    if (!w || !w.is_active) return;

    const side = _isGroom ? "groom" : "bride";

    // --- Màn bìa ---
    // Khối dựng ảnh chạy TRƯỚC setupMusic: đây là chỗ ảnh của màn ĐẦU TIÊN nhận
    // src, mà setupMusic kéo YouTube iframe API (script bên thứ ba) về ngay khi
    // chạy — để nó đi trước là ảnh phải xếp hàng sau.
    renderCover(w);

    // --- Mở đầu ---
    renderHero(w, false);
    renderStoryQuote(w.story_quote);

    // Ảnh NỀN của dải gia đình: lấy tấm ĐẦU trong album. Không dùng lại ảnh bìa
    // vì tấm đó đã chiếm trọn bề ngang ngay trên đầu cùng trang. Không có ảnh thì
    // khỏi làm gì: lớp phủ đen của dải giữ nguyên nền tối, bố cục không đổi.
    const firstPhoto = w.gallery_images?.[0];
    if (firstPhoto) {
      setAttr("family-photo", "src", getImageUrl(firstPhoto));
      applyFocalPoint("family-photo", w.image_focal_points?.gallery_images?.[firstPhoto]);
    }

    // --- Nhạc nền ---
    setupMusic(w.music_url, w.enable_music);

    // --- Gia đình ---
    renderCoupleInfo(w);
    // Địa chỉ hai nhà là dòng phụ, không bắt buộc: chưa nhập thì ẩn hẳn ô,
    // nếu không setText để lại một dãy gạch ngang giữa dải gia đình.
    cxToggle("groom-address", !!w.groom_address);
    cxToggle("bride-address", !!w.bride_address);
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

    // Khối tóm tắt trong trình phát nhạc (kéo tay nắm xuống mới thấy) — dùng
    // CHÍNH phần lễ đang hiển thị để nhà gái bật Vu Quy thì tóm tắt cũng đổi.
    renderMusicSummary(w, {
      ceremonyName,
      ceremonyTime,
      ceremonyLocation: ceremonyLoc,
    });

    // --- Tiệc cưới (mỗi nhà một ngày/giờ/nơi riêng) ---
    const partyDate = w[`${side}_party_date`];
    const partyLocation = w[`${side}_party_location`];
    setText("party-section-label", "Tiệc Mừng " + ceremonyName);
    renderPartyDate(
      partyDate,
      w[`${side}_party_time`],
      w[`${side}_party_lunar`],
      partyLocation,
      "full",
    );
    cxToggle("section-party", cxEnabled(w.enable_party));

    // Ảnh của tờ lịch: lấy tấm THỨ HAI trong album (tấm đầu đã dùng ở dải gia
    // đình) để hai chỗ không lặp cùng một ảnh; hết ảnh thì lùi dần về tấm đầu
    // rồi về ảnh bìa, luôn có gì đó để hiện. Trích dẫn trên ảnh là chữ TRANG
    // TRÍ fix cứng trong index.html, không phải dữ liệu thiệp.
    const calPhoto = w.gallery_images?.[1] || w.gallery_images?.[0];
    if (calPhoto) {
      setAttr("calendar-photo", "src", getImageUrl(calPhoto));
      applyFocalPoint("calendar-photo", w.image_focal_points?.gallery_images?.[calPhoto]);
    } else if (w.cover_image_url) {
      setAttr("calendar-photo", "src", getImageUrl(w.cover_image_url));
      applyFocalPoint("calendar-photo", w.image_focal_points?.cover_image_url);
    }

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
    // Ảnh lấp chỗ trống lấy tấm THỨ BA trong album (tấm 1 ở dải gia đình, tấm 2
    // ở tờ lịch) để ba chỗ không lặp ảnh; hết thì lùi dần rồi về ảnh bìa.
    if (cxEnabled(w.enable_timeline)) {
      renderTimeline(w.timeline, side, partyDate, w.ceremony_date, ceremonyName);
      cxToggle("section-timeline", true);

      const tlPhoto =
        w.gallery_images?.[2] || w.gallery_images?.[1] || w.gallery_images?.[0];
      if (tlPhoto) {
        setAttr("timeline-fill-photo", "src", getImageUrl(tlPhoto));
        applyFocalPoint(
          "timeline-fill-photo",
          w.image_focal_points?.gallery_images?.[tlPhoto],
        );
        _tlHasPhoto = true;
      } else if (w.cover_image_url) {
        setAttr("timeline-fill-photo", "src", getImageUrl(w.cover_image_url));
        applyFocalPoint("timeline-fill-photo", w.image_focal_points?.cover_image_url);
        _tlHasPhoto = true;
      }
    }

    // --- Chuyện tình yêu (trang báo — hàm riêng của mẫu) ---
    if (cxEnabled(w.enable_love_story)) {
      renderStoryPost(w.love_story);
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

    // Các mục vừa bật/tắt và các trang vừa sinh thêm → dựng lại dải trang.
    // Khách bấm mở bìa trước khi dữ liệu về thì onOpen đã chạy rồi, nên phép
    // đo phải chạy lại ở đây chứ không chỉ ở onOpen.
    refreshBook();
  }

  window.renderWedding = renderWedding;

  // ============= QUYỂN SÁCH — DẢI TRANG LẬT NGANG (nét riêng của mẫu) =============
  // Cả thiệp là MỘT khung cuộn ngang (#cx-pages): mỗi <section> con thành một
  // trang rộng và cao đúng khổ thiệp. Ba việc:
  //   1. Bọc nội dung từng trang vào .mc-page-in rồi THU NHỎ nếu nó cao hơn
  //      trang — bảo đảm không trang nào dài quá màn hình.
  //   2. Đổi cú vuốt/lăn DỌC thành lật trang: xuống → sang phải, lên → trái.
  //   3. Cập nhật chỉ báo trang + hai nút lật.
  // Chạy trong CX_THEME.onOpen (sau khi #main-card hiện) vì mọi phép đo cần
  // thẻ đã có kích thước thật.

  const FLIP_MS = 420; // khoá lật trang: một cú lăn = một trang
  const SWIPE_PX = 40; // ngưỡng vuốt dọc mới tính là lật trang

  // Quãng đường của cú kéo vừa rồi — dùng để tách "bấm xem ảnh" khỏi "kéo lật
  // trang": kéo trúng một khung album rồi nhả thì KHÔNG mở lightbox.
  let _dragPx = 0;

  // setupBook() gán vào đây để refreshBook() dùng lại đúng phép đo đó.
  let _syncPager = () => {};

  function setupBook() {
    const pages = document.getElementById("cx-pages");
    if (!pages || pages.dataset.book === "1") return;
    pages.dataset.book = "1";

    Array.from(pages.children).forEach(_toPage);

    const dots = document.getElementById("cx-dots");
    const pageNo = document.getElementById("cx-page-no");
    const prev = document.getElementById("cx-prev");
    const next = document.getElementById("cx-next");

    // Mục bị tắt (cxToggle) không chiếm chỗ trong dải → không tính là trang.
    const shown = () =>
      Array.from(pages.children).filter((el) => el.offsetParent !== null);
    const index = () =>
      pages.clientWidth ? Math.round(pages.scrollLeft / pages.clientWidth) : 0;

    // Chốt lại sau khi trang đã dừng: trên iOS đà vuốt còn chạy tiếp SAU khi
    // nhấc ngón và có thể kéo qua trang mình vừa nhắm tới — chỉnh về đúng đích
    // một lần nữa khi mọi thứ đã lặng.
    let settle;

    function goTo(i) {
      const max = shown().length - 1;
      const t = Math.max(0, Math.min(max, i));
      pages.scrollTo({ left: t * pages.clientWidth, behavior: "smooth" });

      clearTimeout(settle);
      settle = setTimeout(() => {
        if (index() !== t) {
          pages.scrollTo({ left: t * pages.clientWidth, behavior: "smooth" });
        }
      }, FLIP_MS + 80);
    }

    _syncPager = syncPager;
    function syncPager() {
      const total = shown().length;
      const i = Math.min(index(), total - 1);
      if (dots && dots.children.length !== total) {
        dots.innerHTML = Array(total)
          .fill('<span class="mc-book-dot"></span>')
          .join("");
      }
      if (dots) {
        Array.from(dots.children).forEach((d, k) =>
          d.classList.toggle("is-on", k === i),
        );
      }
      if (pageNo) {
        pageNo.textContent =
          String(i + 1).padStart(2, "0") + " / " + String(total).padStart(2, "0");
      }
      if (prev) prev.disabled = i <= 0;
      if (next) next.disabled = i >= total - 1;
    }

    // --- Lăn chuột / trackpad: dọc thành ngang ---
    let lockUntil = 0;
    pages.addEventListener(
      "wheel",
      (e) => {
        if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return; // cuộn ngang thật
        e.preventDefault();
        if (Math.abs(e.deltaY) < 4 || Date.now() < lockUntil) return;
        lockUntil = Date.now() + FLIP_MS;
        goTo(index() + (e.deltaY > 0 ? 1 : -1));
      },
      { passive: false },
    );

    // --- Chạm: kéo ngón LÊN (tức cuộn xuống) là sang phải, kéo XUỐNG là sang
    // trái; vuốt ngang thì theo đúng chiều ngón.
    // MỘT CÚ VUỐT = ĐÚNG MỘT TRANG, dù vuốt mạnh cỡ nào: đích luôn tính từ
    // trang lúc ĐẶT NGÓN (si), không phải từ index() lúc nhấc ngón — vuốt chéo
    // mạnh thì trình duyệt đã tự cuộn sang trang kế theo đà ngang trước khi
    // nhấc ngón, lấy index() lúc đó rồi +1 là nhảy luôn hai trang.
    let sx = 0;
    let sy = 0;
    let si = 0;
    pages.addEventListener(
      "touchstart",
      (e) => {
        sx = e.touches[0].clientX;
        sy = e.touches[0].clientY;
        si = index();
        _dragPx = 0;
      },
      { passive: true },
    );
    // Nhấc ngón / nhả chuột: chốt hướng và lật. Dùng chung cho cả hai nguồn.
    const endSwipe = (x, y) => {
      if (Date.now() < lockUntil) return;
      const dx = x - sx;
      const dy = y - sy;
      const vertical = Math.abs(dy) > Math.abs(dx);
      const d = vertical ? dy : dx;
      if (Math.abs(d) < SWIPE_PX) return;
      lockUntil = Date.now() + FLIP_MS;
      // Kéo lên / kéo sang trái đều là sang trang sau.
      goTo(si + (d < 0 ? 1 : -1));
    };

    pages.addEventListener("touchend", (e) => {
      const t = e.changedTouches[0];
      _dragPx = Math.max(Math.abs(t.clientX - sx), Math.abs(t.clientY - sy));
      endSwipe(t.clientX, t.clientY);
    });

    // --- Chuột: kéo thả cũng lật trang ---
    // Máy tính không sinh sự kiện touch nào, mà bản xem trước ở trang Thiết lập
    // lại chạy bằng chuột — thiếu nhánh này thì trên đó chỉ lăn chuột mới lật
    // được. Bắt ở #cx-pages nên kéo trúng ảnh, chữ hay khoảng trống đều như nhau.
    let dragging = false;
    pages.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;
      sx = e.clientX;
      sy = e.clientY;
      si = index();
      dragging = true;
      _dragPx = 0;
    });
    pages.addEventListener("mousemove", (e) => {
      if (!dragging) return;
      _dragPx = Math.max(_dragPx, Math.abs(e.clientX - sx), Math.abs(e.clientY - sy));
    });
    // Nghe ở window: nhả chuột ngoài khổ thiệp vẫn phải chốt, nếu không cú kéo
    // kế tiếp bắt đầu với dragging còn treo.
    window.addEventListener("mouseup", (e) => {
      if (!dragging) return;
      dragging = false;
      endSwipe(e.clientX, e.clientY);
    });

    // --- Bàn phím + hai nút lật ---
    document.addEventListener("keydown", (e) => {
      const lb = document.getElementById("lightbox");
      if (lb && !lb.classList.contains("hidden")) return; // đang phóng to ảnh
      if (["ArrowRight", "ArrowDown", "PageDown"].includes(e.key)) goTo(index() + 1);
      else if (["ArrowLeft", "ArrowUp", "PageUp"].includes(e.key)) goTo(index() - 1);
    });
    prev?.addEventListener("click", () => goTo(index() - 1));
    next?.addEventListener("click", () => goTo(index() + 1));

    let ticking = false;
    pages.addEventListener(
      "scroll",
      () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
          ticking = false;
          syncPager();
        });
      },
      { passive: true },
    );
    // Xoay máy / đổi khổ cửa sổ: chia lại trang chứ không chỉ đo lại, chiều
    // cao khả dụng đổi thì số mục vừa một trang cũng đổi.
    let rz;
    window.addEventListener("resize", () => {
      clearTimeout(rz);
      rz = setTimeout(refreshBook, 150);
    });

    refreshBook();
  }

  // Chạy lại được: dữ liệu về sau khi khách đã mở thiệp thì các trang do
  // renderStoryPost()/renderGallery() sinh thêm mới xuất hiện, phải biến
  // chúng thành trang và đo lại. Gọi cuối renderWedding và trong onOpen.
  function refreshBook() {
    const pages = document.getElementById("cx-pages");
    if (!pages) return;
    Array.from(pages.children).forEach(_toPage);
    _syncGroupPages();
    _fitGallery();
    _reflowFlows();
    _fillGalleryTail();
    _fillTimeline();
    _markReveal();
    _syncPager();
  }

  // ── Hiện dần từng khối ──────────────────────────────────────────────────
  // Dùng chung bộ .reveal/.from-*/.visible của styles/_common.css (đúng thứ các
  // mẫu cuộn dọc đang dùng), nhưng TỰ theo dõi: theme-boot quét DOM đúng một lần
  // lúc boot, trong khi các trang dồn nội dung được nhân bản và bài viết/ảnh chỉ
  // có sau khi dữ liệu về — bản sao không ai theo dõi thì nằm lại ở opacity 0.
  // Gọi lại được nhiều lần: khối đã hiện thì bỏ qua, observe trùng là no-op.
  const REVEAL_DIRS = ["from-bottom", "from-left", "from-right"];

  const _revealObs = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add("visible");
        _revealObs.unobserve(e.target);
      });
    },
    { threshold: 0.15 },
  );

  // Khối của một trang. Trang GỘP (data-cx-group) lồng thêm một lớp <section>
  // cho từng mục — lấy sâu thêm một tầng, không thì cả mục Album chỉ là MỘT khối.
  function _revealParts(inner) {
    const out = [];
    Array.from(inner.children).forEach((el) => {
      if (el.tagName === "SECTION") out.push(...el.children);
      else out.push(el);
    });
    return out;
  }

  function _markReveal() {
    document
      .querySelectorAll("#cx-pages > .mc-page > .mc-page-in")
      .forEach((inner) => {
        _revealParts(inner).forEach((el, i) => {
          if (el.classList.contains("visible")) return;
          el.classList.add("reveal", REVEAL_DIRS[i % 3]);
          _revealObs.observe(el);
        });
      });
  }

  // Album: MỘT TRANG = ĐÚNG 4 HÀNG ẢNH, màn ngắn hay dài cũng vậy — chia đều
  // chiều cao trang cho 4 rồi đặt vào --mc-row-h, hàm dồn trang tự cắt đúng 4
  // hàng vì hàng thứ 5 không còn chỗ. Ít ảnh hơn thì để trống phần dưới.
  // Phải chạy TRƯỚC _reflowFlows(): nó chia trang theo chiều cao thật, chưa có
  // chiều cao hàng thì chia theo số cũ. Bản sao lưới ở trang lùi do cloneNode
  // sinh ra sau, mang sẵn biến này trong style nên không phải đặt lại.
  const GALLERY_ROWS = 4;

  function _fitGallery() {
    const grid = document.getElementById("gallery-grid");
    const page = grid?.closest("section.mc-page");
    if (!grid || !page || !page.clientHeight) return;

    const cs = getComputedStyle(page);
    const avail =
      page.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    const rowGap = parseFloat(getComputedStyle(grid).rowGap) || 0;

    // Trang thuần album vẫn phải chừa chỗ cho tiêu đề mục và khe dưới nó.
    const head = document.querySelector("#section-photos > [data-cx-unit]");
    const sec = document.getElementById("section-photos");
    const headH = head ? head.offsetHeight : 0;
    const secGap = sec ? parseFloat(getComputedStyle(sec).rowGap) || 0 : 0;

    const h =
      (avail - headH - secGap - rowGap * (GALLERY_ROWS - 1)) / GALLERY_ROWS;
    if (h > 0) grid.style.setProperty("--mc-row-h", Math.floor(h) + "px");
  }

  // Hàng ảnh CUỐI của album nuốt trọn phần cao còn thừa của trang nó nằm: số
  // ảnh hiếm khi chia chẵn cho lưới nên trang cuối gần như luôn hụt vài hàng,
  // để nguyên là một mảng trắng ở đáy. Phải chạy SAU _reflowFlows() — chỉ khi
  // đã dồn trang xong mới biết hàng cuối rơi vào trang nào và trang đó còn
  // trống bao nhiêu.
  function _fillGalleryTail() {
    const rows = document.querySelectorAll("#cx-pages .mc-grid-row");
    const last = rows[rows.length - 1];
    const page = last?.closest("section.mc-page");
    const inner = page?.querySelector(":scope > .mc-page-in");
    if (!inner || !page.clientHeight) return;

    const cs = getComputedStyle(page);
    const avail =
      page.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    const free = avail - inner.scrollHeight;
    if (free < 8) return; // gần khít rồi, kéo thêm chỉ tổ lệch nhịp lưới

    last.style.height = last.offsetHeight + free + "px";
    last.dataset.cxGrow = "1";
  }

  function _resetGalleryTail() {
    document.querySelectorAll("#cx-pages .mc-grid-row[data-cx-grow]").forEach((r) => {
      r.style.height = "";
      delete r.dataset.cxGrow;
    });
  }

  // Trang Lịch trình khai ít mốc thì nửa dưới trống trơn — lấp bằng một khung
  // ảnh. Hàm này CHỈ quyết định có bật ảnh hay không; cao bao nhiêu là việc của
  // flex (.mc-tl-fill nuốt phần thừa, và co lại nếu đo hụt). Dưới ngưỡng này thì
  // thôi: khung quá dẹt trông như lỗi bố cục chứ không ra ảnh.
  const TL_FILL_MIN = 140;
  let _tlHasPhoto = false;

  function _fillTimeline() {
    const page = document.getElementById("section-timeline");
    const fill = document.getElementById("timeline-fill");
    if (!page || !fill) return;

    // Đo lúc chưa có ảnh, nếu không lần chạy sau lại đo cả chính nó. Ẩn ảnh
    // cũng là lúc trang thôi bị kéo cao trọn khổ (xem .mc-tl-page trong
    // theme.css) — phần mốc mới đo ra chiều cao thật.
    fill.classList.add("hidden");

    const inner = page.querySelector(":scope > .mc-page-in");
    if (!inner || !_tlHasPhoto || !page.clientHeight) return;

    const cs = getComputedStyle(page);
    const avail =
      page.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    const gap = parseFloat(getComputedStyle(inner).rowGap) || 0;
    const free = avail - inner.scrollHeight - gap;
    if (free < TL_FILL_MIN) return;

    fill.classList.remove("hidden");
  }

  // Trang gộp nhiều mục ([data-cx-group]): cả hai mục bên trong cùng bị tắt
  // thì trang phải biến mất, nếu không khách vuốt trúng một trang trắng.
  function _syncGroupPages() {
    document.querySelectorAll("#cx-pages [data-cx-group]").forEach((page) => {
      const live = Array.from(page.querySelectorAll("section")).some(
        (sec) =>
          !sec.classList.contains("hidden") && sec.style.display !== "none",
      );
      page.classList.toggle("hidden", !live);
    });
  }

  // ── Dồn trang ───────────────────────────────────────────────────────────
  // Trang có danh sách dài (chuyện tình yêu, album) là MỘT DÒNG CHẢY: nhét đầy
  // trang rồi mới đẩy phần dư sang trang kế, thay vì chia cứng mỗi mục/ảnh một
  // trang (chia cứng thì trang nào cũng thừa chỗ). Cả trang chảy chung một
  // dòng, nên hai mục đi chung trang thì mục sau bắt đầu ngay dưới mục trước.
  //
  // ĐƠN VỊ cắt được — thứ nhỏ nhất có thể lùi sang trang kế:
  //   · mỗi con TRỰC TIẾP của thẻ khai [data-cx-flow] (một mốc, một hàng ảnh)
  //   · mỗi thẻ khai [data-cx-unit] — TIÊU ĐỀ (măng sét, tiêu đề mục): luôn
  //     dính với nội dung ngay sau nó, không bao giờ đứng lẻ ở cuối trang
  // Đo bằng DOM thật nên chỉ chạy được khi #main-card đã hiện.

  const CX_UNIT_SEL = "[data-cx-unit], [data-cx-flow] > *";

  function _reflowFlows() {
    // Trả hàng ảnh cuối về chiều cao chuẩn TRƯỚC khi đo: để nguyên phần đã kéo
    // giãn ở lượt trước thì lượt này tưởng trang đã đầy và cắt sai chỗ.
    _resetGalleryTail();

    const done = new Set();
    document.querySelectorAll("#cx-pages [data-cx-flow]").forEach((host) => {
      const page = host.closest("section.mc-page");
      if (!page || page.dataset.cxSpill || done.has(page)) return;
      done.add(page);
      _streamPaginate(page);
    });
  }

  // Gom mọi đơn vị đã lùi về chỗ cũ và xoá trang lùi. Trang lùi chỉ chứa BẢN
  // SAO rỗng ruột của các thẻ bọc nên xoá thẳng là xong.
  // PHẢI gọi TRƯỚC khi dựng lại danh sách (renderStoryPost/renderGallery): dựng
  // lại chỉ thay con của thẻ gốc, phần đã lùi sang trang kế không nằm trong đó
  // nên nếu để nguyên thì lượt dồn sau kéo về, thành nội dung lặp hai lần.
  function _streamReset(page) {
    const inner = page.querySelector(":scope > .mc-page-in");
    if (!inner) return null;

    let n = page.nextElementSibling;
    while (n && n.dataset.cxSpill === "stream") {
      const nx = n.nextElementSibling;
      n.querySelectorAll(CX_UNIT_SEL).forEach((el) => {
        (el._cxHome || inner).appendChild(el);
      });
      n.remove();
      n = nx;
    }
    inner
      .querySelectorAll(".mc-stream-off")
      .forEach((el) => el.classList.remove("mc-stream-off"));

    // Trả bài đã cắt chữ (_splitStory) về nguyên văn: xoá mẩu đầu (bản sao) rồi
    // đổ lại toàn văn vào bài gốc. Phải làm SAU vòng gom ở trên — mẩu đầu có thể
    // nằm trên chính trang lùi vừa gỡ và được gom về đây.
    inner.querySelectorAll("[data-cx-frag]").forEach((el) => el.remove());
    inner.querySelectorAll(".mc-story-cont").forEach((el) => {
      el.classList.remove("mc-story-cont");
    });
    inner.querySelectorAll(".mc-post-body").forEach((b) => {
      if (b._cxFull != null) b.textContent = b._cxFull;
    });

    return inner;
  }

  function _unflowAll() {
    document
      .querySelectorAll("#cx-pages section.mc-page:not([data-cx-spill])")
      .forEach((page) => {
        if (page.querySelector("[data-cx-flow]")) _streamReset(page);
      });
  }

  function _streamPaginate(page) {
    const inner = _streamReset(page);
    if (!inner) return;

    if (!page.clientHeight) return;
    const cs = getComputedStyle(page);
    const avail =
      page.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    if (!avail) return;

    // Nhớ chỗ ở của từng đơn vị NGAY BÂY GIỜ, lúc mọi thứ còn nguyên vị trí:
    // renderStoryPost()/renderGallery() dựng lại danh sách mỗi lần có dữ liệu
    // mới nên không giữ được tham chiếu cũ. Đơn vị của mục đang tắt không có
    // hộp bao (getClientRects rỗng) → bỏ qua, chúng không chiếm chỗ.
    let rest = Array.from(inner.querySelectorAll(CX_UNIT_SEL)).filter((el) => {
      el._cxHome = el.parentElement;
      return el.getClientRects().length;
    });

    let curInner = inner;
    let after = page;
    let guard = 0;
    // Bài vừa bị ĐẨY NỐT sang trang mới ở lượt trước mà cắt chữ không thành —
    // gặp lại chính nó là dừng, nếu không mỗi lượt lại đẩy nó sang một trang
    // rỗng mới mãi không thôi.
    let stuck = null;

    while (curInner.scrollHeight > avail && guard++ < 50) {
      // Chỉ còn một đơn vị: đi tiếp chỉ có nghĩa khi nó là bài CẮT CHỮ được.
      if (rest.length <= 1 && !_storyBody(rest[0])) break;

      const sec = document.createElement("section");
      sec.className = "mc-page";
      sec.dataset.cxSpill = "stream";
      const si = document.createElement("div");
      si.className = inner.className;
      sec.appendChild(si);
      after.after(sec);

      const clones = new Map();
      const moved = [];
      const push = (el) => {
        // Thẻ bọc đang chứa nó — ở trang gốc là thẻ thật, ở trang lùi là bản
        // sao; rỗng ruột thì phải ẩn ngay, gap của flex vẫn ăn chỗ như thường.
        // Nhớ lại thẻ bọc đó: phần đầu bài cắt ra sẽ quay về đúng chỗ này.
        const from = el.parentElement;
        el._cxFrom = from;
        _streamMove(el, inner, si, clones);
        _streamHideEmpty(from, curInner);
        moved.unshift(el);
      };

      // Lùi dần đơn vị CUỐI sang trang mới cho tới khi trang này vừa khít.
      while (curInner.scrollHeight > avail && rest.length > 1) push(rest.pop());

      // Tiêu đề ([data-cx-unit]) KHÔNG được đứng lẻ ở cuối trang: nội dung ngay
      // dưới nó vừa lùi đi thì nó phải lùi theo, nếu không "Album Ảnh" nằm cuối
      // trang này mà ảnh lại ở trang bên. Lặp vì có thể hai tiêu đề liền nhau
      // (mục trước hết nội dung, mục sau chỉ còn tiêu đề).
      while (rest.length > 1 && rest[rest.length - 1].hasAttribute("data-cx-unit")) {
        push(rest.pop());
      }

      // Một bài DÀI HƠN CẢ TRANG thì hai vòng trên không đụng tới nó (luôn chừa
      // lại đơn vị cuối). Đẩy nốt sang trang mới rồi cắt chữ ngay bên dưới —
      // không có bước này thì bài dài bị cắt cụt ở đáy trang.
      if (curInner.scrollHeight > avail && rest.length === 1) {
        if (rest[0] === stuck) {
          sec.remove();
          break;
        }
        stuck = rest[0];
        push(rest.pop());
      }

      // Kéo phần đầu bài vừa lùi quay lại lấp cho đầy trang này.
      if (_splitStory(moved[0], curInner, avail)) stuck = null;

      // Không lùi được gì (trang lùi rỗng) thì thôi, nếu không sinh trang trắng.
      if (!si.querySelector(CX_UNIT_SEL)) {
        sec.remove();
        break;
      }

      curInner = si;
      after = sec;
      rest = moved;
    }
  }

  // ── Cắt CHỮ giữa bài (chuyện tình yêu) ──────────────────────────────────
  // Đơn vị dồn trang nhỏ nhất vốn là CẢ một bài, nên bài không vừa chỗ còn lại
  // sẽ nhảy nguyên sang trang sau và để trống nửa trang. Mục chuyện tình yêu
  // đọc như trang báo nên phải kín chữ: giữ lại trên trang trước nhiều chữ nhất
  // còn vừa, phần sau đọc tiếp ở trang kế.
  // Bài quá ngắn thì thôi — cắt ra hai mẩu vụn còn xấu hơn một khoảng trống.

  const STORY_MIN_WORDS = 25;

  function _storyBody(el) {
    return el?.classList?.contains("mc-story-page")
      ? el.querySelector(":scope > .mc-post-body")
      : null;
  }

  // `tail` là bài VỪA LÙI sang trang mới. Trả về true nếu cắt được: phần đầu
  // (bản sao, có dateline/tít/ảnh) quay về trang trước, phần đuôi ở lại bài gốc
  // và giấu dateline/tít/ảnh đi — đọc tiếp như một cột báo tràn trang.
  function _splitStory(tail, curInner, avail) {
    const body = _storyBody(tail);
    const from = tail?._cxFrom;
    if (!body || !from) return false;

    // Chụp lại nguyên văn lần đầu chạm tới — CHỈ để _streamReset() trả bài về
    // như cũ. Phép cắt luôn đi từ phần chữ CÒN LẠI (body.textContent), không
    // phải từ bản chụp: bài dài trải ba trang thì lượt cắt thứ hai mà đọc bản
    // chụp sẽ chép lại cả phần đã nằm ở trang đầu.
    if (body._cxFull == null) body._cxFull = body.textContent;
    const words = body.textContent.split(/\s+/).filter(Boolean);
    if (words.length < STORY_MIN_WORDS * 2) return false;

    const head = tail.cloneNode(true);
    head.dataset.cxFrag = "1";
    head.removeAttribute("id");
    head.querySelectorAll("[id]").forEach((n) => n.removeAttribute("id"));
    const headBody = head.querySelector(".mc-post-body");
    from.appendChild(head);
    _streamHideEmpty(from, curInner); // thẻ bọc vừa bị ẩn vì rỗng → bật lại

    // Nhị phân theo SỐ CHỮ: nhiều nhất mà trang vẫn chưa tràn. Đo bằng DOM thật
    // nên không phải đoán chiều cao dòng, cỡ chữ hay chỗ xuống dòng.
    let lo = STORY_MIN_WORDS;
    let hi = words.length - STORY_MIN_WORDS;
    let best = 0;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      headBody.textContent = words.slice(0, mid).join(" ");
      if (curInner.scrollHeight <= avail) {
        best = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }

    // Chỗ trống không đủ cho cả phần đầu bài → trả trang về nguyên trạng.
    if (!best) {
      head.remove();
      _streamHideEmpty(from, curInner);
      return false;
    }

    headBody.textContent = words.slice(0, best).join(" ");
    body.textContent = words.slice(best).join(" ");
    tail.classList.add("mc-story-cont");
    return true;
  }

  // Chuyển một đơn vị sang trang lùi, dựng lại đúng chuỗi thẻ bọc của nó (mục
  // → danh sách) để lề, khoảng cách và vạch ngăn giữ nguyên. Bản sao BỎ id:
  // id trùng nhau thì setText/getElementById của lần render sau trỏ nhầm chỗ.
  function _streamMove(el, inner, spillInner, clones) {
    const chain = [];
    for (let a = el._cxHome; a && a !== inner; a = a.parentElement) chain.unshift(a);

    let parent = spillInner;
    chain.forEach((a) => {
      let c = clones.get(a);
      if (!c) {
        c = a.cloneNode(false);
        c.removeAttribute("id");
        c.classList.remove("hidden", "mc-stream-off");
        c.style.display = "";
        clones.set(a, c);
        // Đơn vị lùi theo thứ tự NGƯỢC nên thẻ bọc mới luôn đứng trước thẻ đã
        // dựng — prepend là giữ đúng thứ tự gốc.
        parent.prepend(c);
      }
      parent = c;
    });

    parent.prepend(el);
  }

  // Thẻ bọc rỗng (mọi đơn vị bên trong đã lùi đi) vẫn ăn chỗ vì gap của flex —
  // ẩn đi, và ẩn lây lên thẻ cha nếu cha cũng chẳng còn gì hiện.
  function _streamHideEmpty(home, inner) {
    for (let a = home; a && a !== inner; a = a.parentElement) {
      const live = Array.from(a.children).some((c) => c.getClientRects().length);
      a.classList.toggle("mc-stream-off", !live);
    }
  }

  // Biến một <section> thành trang: class bố cục của section chuyển xuống thẻ
  // TRONG, section chỉ còn vai trò khung trang (mốc cuộn + khổ một màn). Giữ lại
  // cờ .hidden để cxToggle() vẫn ẩn/hiện được mục.
  function _toPage(sec) {
    if (sec.classList.contains("mc-page")) return;
    const hidden = sec.classList.contains("hidden");
    const inner = document.createElement("div");
    inner.className =
      "mc-page-in " +
      Array.from(sec.classList)
        .filter((c) => c !== "hidden")
        .join(" ");
    while (sec.firstChild) inner.appendChild(sec.firstChild);
    sec.className = "mc-page" + (hidden ? " hidden" : "");
    sec.appendChild(inner);
  }

  // ============= CHUYỆN TÌNH YÊU — TRANG BÁO (phần đặc thù của mẫu) =============
  // Thay renderLoveStory() chung: mỗi mốc thành một "bài báo" — dateline, tít,
  // chữ chia hai cột căn đều, ảnh kèm chú thích. Class .mc-* khai trong
  // theme.css. Bài lẻ nhận .mc-post-item--lead để ảnh nhảy lên trên tít.

  function renderStoryPost(events) {
    const section = document.getElementById("love-story");
    const list = document.getElementById("love-story-list");
    if (!section || !list) return;

    _unflowAll();

    if (!Array.isArray(events) || events.length === 0) {
      section.style.display = "none";
      return;
    }
    section.style.display = "";

    // Đổ hết vào một dòng chảy; _streamPaginate() nhét đầy trang rồi mới sang
    // trang kế, nên số mốc mỗi trang tuỳ vào chúng dài ngắn thế nào.
    list.innerHTML = events.map(_storyArticle).join("");
  }

  function _storyArticle(ev, i) {
    const img = ev.image_url ? getImageUrl(ev.image_url) : null;
    const fp = ev.focal_point;
    const pos = fp ? ` style="object-position:${fp.x}% ${fp.y}%"` : "";
    // Ảnh nằm trong #main-card (display:none lúc chưa mở bìa) nên KHÔNG lazy.
    const figure = img
      ? `<figure class="mc-post-figure">
           <div class="mc-cine mc-cine-sm w-full aspect-[16/9]">
             <img src="${img}" alt=""${pos} class="w-full h-full object-cover" />
           </div>
         </figure>`
      : "";

    return `
    <article class="mc-story-page${i === 0 ? " mc-story-page--first" : ""}">
      <div class="mc-post-dateline">${escapeHtml(ev.date || "Chuyện của chúng mình")}</div>
      ${ev.title ? `<h3 class="cx-h mc-post-title">${escapeHtml(ev.title)}</h3>` : ""}
      ${figure}
      ${ev.content ? `<div class="cx-t mc-post-body">${escapeHtml(ev.content)}</div>` : ""}
    </article>`;
  }

  // ============= ALBUM ẢNH — ẢNH DỌC NGANG ĐAN XEN (phần đặc thù của mẫu) =============
  // Bố cục CỐ ĐỊNH, không tính theo số ảnh: mỗi hàng hai khung hẹp–rộng, bề
  // ngang đảo chiều giữa các hàng (hai hàng giống hệt nhau đứng cạnh trông như
  // bảng biểu). Ảnh đổ vào lần lượt cho tới hết; hàng cuối lẻ một ảnh thì ảnh
  // đó tự kéo rộng hết hàng. Chiều cao hàng do _fitGallery() đặt để một trang
  // vừa đúng GALLERY_ROWS hàng.
  // Bấm một khung thì mở lightbox dùng chung — điều kiện duy nhất là đổ đúng
  // thứ tự ảnh vào lightboxImages rồi gọi openLightbox(i).

  // Bề ngang hai khung của từng hàng, lặp lại từ đầu khi hết mẫu.
  const ALBUM_ROWS = [
    [40, 60],
    [60, 40],
  ];

  // Ô chữ chiếm chỗ ĐẦU của hàng này (đếm từ 0, tính trên cả album) — hàng thứ
  // ba của trang đầu. Đặt -1 là album không có ô chữ.
  const ALBUM_CAP_ROW = 2;

  function renderGallery(images, focalPoints) {
    const strip = document.getElementById("gallery-grid");
    if (!strip) return;

    _unflowAll();

    // Chưa có ảnh → 4 khung minh hoạ, để khách hình dung bố cục lúc đang soạn.
    const urls = images?.length
      ? images.map(getImageUrl)
      : Array(4)
          .fill(null)
          .map(() => createPlaceholderSVG("Chưa có ảnh"));

    // Kho ảnh của lightbox dùng chung — phải khớp thứ tự với dải phim.
    lightboxImages.length = 0;
    lightboxImages.push(...urls);

    // Ảnh nằm trong #main-card (đang display:none lúc chưa mở bìa) nên KHÔNG
    // đặt loading="lazy": ảnh lazy sẽ chỉ bắt đầu tải khi bìa mở ra.
    // `grow` là phần bề ngang khung chiếm trong hàng (flex-grow), gap do hàng lo.
    const createFrame = (url, i, grow) => {
      const fp = focalPoints?.[images?.[i]];
      const el = document.createElement("div");
      el.className = "mc-frame mc-cine";
      el.style.flex = grow + " 1 0";
      el.innerHTML = `<img src="${url}" alt=""
        class="w-full h-full object-cover"
        style="object-position:${fp?.x ?? 50}% ${fp?.y ?? 50}%">
        <div class="mc-frame-no">${String(i + 1).padStart(2, "0")}</div>`;
      // Kéo qua khung để lật trang thì thôi, đừng mở ảnh — chỉ cú bấm ĐỨNG YÊN
      // mới là ý định xem ảnh.
      el.addEventListener("click", () => {
        if (_dragPx > 6) return;
        openLightbox(i);
      });
      return el;
    };

    // Đổ ảnh vào mẫu hàng cố định cho tới khi hết ảnh. Ô chữ chiếm một chỗ như
    // một tấm ảnh nên hàng mang nó chỉ còn một ảnh.
    strip.innerHTML = "";
    let at = 0;
    for (let r = 0; at < urls.length; r++) {
      const cols = ALBUM_ROWS[r % ALBUM_ROWS.length];
      const el = document.createElement("div");
      el.className = "mc-grid-row";

      cols.forEach((grow, k) => {
        // Ô chữ — chữ TRANG TRÍ fix cứng như trích dẫn ở tờ lịch, không phải dữ
        // liệu thiệp. Luôn nằm bên TRÁI hàng và KHÔNG tiêu thụ ảnh.
        if (r === ALBUM_CAP_ROW && k === 0) {
          const cap = document.createElement("div");
          cap.className = "mc-cap-cell";
          cap.style.flex = grow + " 1 0";
          cap.innerHTML = `<div class="mc-cap-line">collecting memories &#9825;</div>
            <div class="mc-cap-rule"></div>`;
          el.appendChild(cap);
          return;
        }
        // Hàng cuối lẻ một ảnh: bỏ ô còn lại, ảnh kia tự kéo rộng hết hàng.
        if (at >= urls.length) return;
        el.appendChild(createFrame(urls[at], at, grow));
        at++;
      });

      strip.appendChild(el);
    }
  }

  // ============= TỜ LỊCH: tháng lớn (trái) + lưới ngày (phải) =============
  // Ghi đè window.renderMiniCalendar của calendar-helper.js (nạp TRƯỚC file
  // này) thay vì sửa file dùng chung — helper vẫn giữ nguyên cho theme khác,
  // setupMiniCalendar() ở render-helper.js gọi renderMiniCalendar() qua biến
  // toàn cục nên tự nhặt đúng bản ghi đè này. Ngày đánh dấu vẫn lấy từ
  // window.weddingDates (updateWeddingDates() của helper gốc set trước).
  function renderCalendarCard() {
    const container = document.getElementById("mini-calendar");
    if (!container || !window.weddingDates?.length) return;

    const { year, month } = window.weddingDates[0];
    const markedDays = window.weddingDates.map((d) => d.day);
    const dayNames = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
    const firstDay = new Date(year, month - 1, 1).getDay();
    const daysInMonth = new Date(year, month, 0).getDate();

    const dow = dayNames.map((d) => `<div class="mc-cal-dow">${d}</div>`).join("");
    const blanks = Array(firstDay).fill("<div></div>").join("");
    const cells = Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      const marked = markedDays.includes(day) ? " is-marked" : "";
      return `<div class="mc-cal-day${marked}">${day}</div>`;
    }).join("");

    container.innerHTML = `
      <div class="mc-cal-grid-wrap">
        <div class="mc-cal-month">
          <div class="cx-h">Tháng ${month}</div>
          <div class="cx-t mc-cal-year">${year}</div>
        </div>
        <div class="mc-cal-table">${dow}${blanks}${cells}</div>
      </div>`;
  }

  window.renderMiniCalendar = renderCalendarCard;
})();
