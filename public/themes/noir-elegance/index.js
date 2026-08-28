// ============= THEME: NOIR ELEGANCE =============
// Nền TRẮNG BE nhạt, viền vàng champagne mảnh, chữ thư pháp. Đủ mọi mục như mẫu
// nền; nét riêng nằm ở mục Mở đầu: một tấm ảnh CHIẾM TRỌN màn hình chạy
// carousel, chữ đặt trên hai dải kem mờ ở đầu và chân màn.
//
// File này chỉ KHAI BÁO: window.CX_THEME + renderWedding + phần đặc thù của mẫu
// (carousel mở đầu + album). Phần "chạy" nằm ở core/helpers/theme-boot.js, nạp sau.
//
// Bọc trong IIFE, chỉ lộ CX_THEME + renderWedding + hai hàm mà onclick trong
// HTML gọi tới: `const` cấp cao nhất của script cổ điển là biến toàn cục.

(function () {
  window.CX_THEME = {
    // Trùng TÊN THƯ MỤC và cột `templates.template_name`.
    id: "noir-elegance",

    // Font/màu GỐC: giá trị mặc định trên thanh chỉnh ở tab Giao diện, cũng là
    // điểm "Khôi phục mặc định". Trang Thiết lập đọc qua iframe xem trước.
    // Bộ màu MẶC ĐỊNH của mẫu — bản khai máy đọc được của đúng những giá trị
    // :root trong theme.css (nguồn sự thật). Trang Thiết lập đọc nó để hiện mục
    // "Mặc định"; theme_setting.palette ghi đè lên trên lúc chạy.
    // Sinh lại bằng: node scripts/check-theme-palette.mjs --write
    palette: {
      heading: "#3a322a",
      body: "#857b6f",
      accent: "#b08d57",
      accent_soft: "#e8b4b8",
      on_accent: "#ffffff",
      on_image: "#ffffff",
      on_lightbox: "#ffffff",
      card_bg: "#fdfbf7",
      page_bg: "#f4eee5",
      surface: "#f4eee5",
      band: "#fff5f0",
      panel: "#ffffff",
      panel_warm: "#ffffff",
      cover: "#faf6f0",
      cover_mid: "#f0e8dd",
      cover_veil: "#f0e8dd",
      lightbox_bg: "#000000",
      line: "#e0d5c5",
      shadow: "#3a322a",
      scrim: "#000000",
      deco: "#f4c598",
      deco_soft: "#f7d8ba",
      deco_2: "#f0d0aa",
      deco_2_soft: "#f6e2cd",
      shine_from: "#a67c2e",
      shine_mid: "#e6c887",
      shine_to: "#c79c46",
    },

    preset: {
      heading_font: "Cormorant Garamond",
      body_font: "Montserrat",
      heading_color: "#3a322a", // nâu đen ấm
      body_color: "#857b6f",
      accent_color: "#b08d57", // vàng champagne trầm
      background_color: "#fdfbf7",
      // Màu gợi ý — các nấc be/kem và vàng champagne của chính mẫu.
      swatches: [
        "#3a322a",
        "#5c5145",
        "#857b6f",
        "#b0a698",
        "#b08d57",
        "#c9b48c",
        "#e0d5c5",
        "#f4eee5",
        "#faf6f0",
        "#fdfbf7",
        "#ffffff",
      ],
    },

    // Class mà thanh chỉnh font/màu nhắm tới. Mẫu gom về ba lớp ngữ nghĩa
    // (.cx-h tiêu đề · .cx-t nội dung · .cx-a nhấn, khai trong theme.css).
    // .cx-hd/.cx-bd/.cx-ac là markup do helper dùng chung sinh ra (dòng thời
    // gian, chuyện tình yêu) — GIỮ NGUYÊN.
    // .ne-title/.ne-eyebrow đi theo tiêu đề (đổi màu/font vẫn hợp tông), còn
    // .ne-script cố ý ĐỨNG NGOÀI: đó là font tự host, bảng chọn font chỉ có
    // font Google nên khách đổi rồi sẽ không quay lại được.
    selectors: {
      headingFont: ".cx-h, .ne-title",
      bodyFont: "body, .cx-t, .ne-eyebrow",
      headingColor: ".cx-h, .cx-hd, .ne-title, .ne-script",
      bodyColor: ".cx-t, .cx-bd, .ne-eyebrow",
      accentColor: ".cx-a, .cx-ac",
      background: "body, #main-card",
    },

    // Mục được gán hiệu ứng hiện dần khi cuộn tới.
    reveal: ["#main-card section"],

    // Mốc bung bảng đề xuất mẫu khác ở bản xem thử (?preview=true).
    suggest: "#section-gift",

    // Bước mà trang Thiết lập KHÔNG hiện cho mẫu này (id trùng CX_STEPS ở
    // invitation-setup/js/20-steps.js): mẫu không vẽ mục Gia đình nên cũng
    // đừng bắt khách nhập.
    skipSteps: ["family"],

    // id các mục trùng bảng mặc định của preview-focus-helper.js → không cần
    // khai `focus`.

    // Carousel chạy bằng % nên không phải đo gì sau khi thiệp mở ra.
    onOpen: null,
  };

  const _isGroom = isGroomSide();

  // ============= LUÔN HIỆN MÀN BÌA =============
  // Mặc định của wedding-helper.js là mở thẳng thiệp khi KHÔNG phải link riêng
  // của khách (bản xem thử, xem demo, ai đó mở link trần) — mẫu này thì màn bìa
  // chính là tấm poster nên phải thấy nó trong mọi trường hợp. Bọc hàm chào
  // riêng lại: vẫn điền tên khách + bật ô xác nhận tham dự như cũ, chỉ bỏ phần
  // TỰ MỞ. Bọc ở đây được vì index.js nạp sau wedding-helper.js và trước
  // theme-boot.js (nơi gọi hàm này).
  const _greetOriginal = window.setupPersonalizedGreeting;
  window.setupPersonalizedGreeting = function (slug, isGroom) {
    _greetOriginal(slug, isGroom, () => {});
    // Không phải link riêng thì màn bìa sạch như tấm thiệp giấy, khỏi để lại
    // dãy gạch ngang chỗ tên khách.
    const wrap = document.getElementById("cover-guest-wrap");
    if (wrap && window.CX_GUEST) {
      wrap.classList.remove("hidden");
      wrap.classList.add("flex");
    }
  };

  // Khung "xem trực tiếp" ở trang Thiết lập xin cuộn tới mục đang chỉnh — mục
  // đó nằm sau màn bìa, nên nhận tin là mở thiệp ra rồi mới để helper cuộn.
  window.addEventListener("message", (e) => {
    if (e.data?.type !== "cx-focus") return;
    const cover = document.getElementById("cover-screen");
    if (cover && cover.style.display !== "none") window.openInvitation();
  });

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
    renderHero(w, false); // đổ ảnh bìa vào ô ĐẦU TIÊN của carousel
    setupHeroCarousel(w); // các ô còn lại lấy từ album
    renderStoryQuote(w.story_quote);

    // --- Nhạc nền ---
    setupMusic(w.music_url, w.enable_music);

    // Mẫu này KHÔNG có mục Gia đình: bố cục đi thẳng từ màn ảnh mở đầu sang
    // thư mời. Bước "Gia đình" bên trang Thiết lập vẫn nhập được nhưng thiệp
    // không hiển thị — cố ý, đừng gọi renderCoupleInfo() lại.

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

    // Nhãn góc trái khung mở đầu = tên tỉnh/thành nơi đãi tiệc (đoạn cuối địa
    // chỉ), như dòng địa danh trên poster. Chưa có địa chỉ thì giữ chữ mặc định.
    const place = _placeLabel(partyLocation);
    if (place) setText("hero-place", place);

    // Dòng chân màn bìa: tên nơi đãi tiệc (đoạn ĐẦU của địa chỉ) trên một dòng,
    // phần địa chỉ còn lại ở dòng dưới, rồi tới ngày tiệc dạng d/m/yyyy.
    const [venue, ...rest] = String(partyLocation || "").split(",");
    if (venue.trim()) setText("cover-venue", venue.trim());
    cxToggle("cover-address", rest.length > 0);
    if (rest.length) setText("cover-address", rest.join(",").trim());
    const d = partyDate ? new Date(partyDate) : null;
    if (d && !isNaN(d))
      setText("cover-date", `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`);

    // Lịch nhỏ đánh dấu ngày lễ + ngày tiệc
    setupMiniCalendar(w.ceremony_date, partyDate);

    // Ảnh trên đầu cuốn lịch: lấy tấm THỨ HAI của album (tấm đầu đã chạy ở màn
    // mở đầu), không có thì lùi về ảnh bìa.
    const archKey = w.gallery_images?.[1] || w.gallery_images?.[0] || w.cover_image_url;
    if (archKey) {
      setAttr("party-photo", "src", getImageUrl(archKey));
      applyFocalPoint("party-photo", w.image_focal_points?.gallery_images?.[archKey]);
    }

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

    // --- Album ảnh ---
    // Ngày tiệc tách làm ba dòng cho ô chữ viết tay giữa mảng ảnh.
    const hasPhotos = cxEnabled(w.enable_photos);
    if (hasPhotos) {
      const gd = partyDate ? new Date(partyDate) : null;
      const dateParts =
        gd && !isNaN(gd)
          ? [`${gd.getDate()}.`, `Tháng ${gd.getMonth() + 1}`, String(gd.getFullYear())]
          : null;
      renderGallery(w.gallery_images, w.image_focal_points?.gallery_images, dateParts);
    } else {
      cxToggle("section-photos", false);
    }

    // --- Chuyện tình yêu ---
    const hasStory = cxEnabled(w.enable_love_story);
    if (hasStory) {
      renderLoveStory(w.love_story);
    } else {
      cxToggle("love-story", false);
    }

    // Hai lối tắt trên thanh nhãn chỉ có nghĩa khi mục đích đến còn bật.
    cxToggle("hero-link-story", hasStory);
    cxToggle("hero-link-album", hasPhotos);

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

  // Đoạn cuối của địa chỉ (sau dấu phẩy chót) — "123 Lê Lợi, TP. Thái Nguyên"
  // → "TP. Thái Nguyên". Địa chỉ một đoạn thì lấy nguyên, quá dài thì bỏ qua
  // để nhãn không tràn khỏi một phần ba hàng.
  function _placeLabel(location) {
    const part = String(location || "")
      .split(",")
      .pop()
      .trim();
    return part && part.length <= 22 ? part : "";
  }

  // ============= CAROUSEL MỞ ĐẦU (phần đặc thù của mẫu) =============
  // Ảnh chiếm trọn màn: ô đầu tiên là ảnh bìa (#main-photo, đã có sẵn trong
  // HTML), các ô sau lấy từ album. Trượt bằng % bề ngang nên không cần đo đạc —
  // khỏi móc vào onOpen.

  let _slideIdx = 0;
  let _slideCount = 1;

  function setupHeroCarousel(w) {
    const track = document.getElementById("hero-track");
    if (!track) return;

    // Dựng lại từ đầu: renderWedding có thể chạy nhiều lần trong khung xem trực tiếp.
    track.querySelectorAll("[data-ne-slide]").forEach((el) => el.remove());

    const extras = (w.gallery_images || [])
      .filter((k) => k && k !== w.cover_image_url)
      .slice(0, 5);

    extras.forEach((key) => {
      const fp = w.image_focal_points?.gallery_images?.[key];
      const cell = document.createElement("div");
      cell.dataset.neSlide = "1";
      cell.className = "w-full h-full shrink-0";
      // KHÔNG lazy: cả khối nằm trong #main-card đang display:none, ảnh lazy sẽ
      // chỉ bắt đầu tải khi khách bấm mở bìa — đúng lúc cần thấy ảnh nhất.
      cell.innerHTML = `<img src="${getImageUrl(key)}" alt=""
        class="w-full h-full object-cover"
        style="object-position:${fp?.x ?? 50}% ${fp?.y ?? 50}%">`;
      track.appendChild(cell);
    });

    _slideCount = 1 + extras.length;
    _slideIdx = 0;

    // Một ảnh thì giấu hàng chấm, khung ảnh đứng yên như tấm poster.
    const many = _slideCount > 1;

    const dots = document.getElementById("hero-dots");
    if (dots) {
      dots.innerHTML = many
        ? Array.from({ length: _slideCount }, () => `<span class="ne-dot"></span>`).join("")
        : "";
    }

    _goSlide(0);
  }

  function _goSlide(i) {
    const track = document.getElementById("hero-track");
    if (!track) return;

    _slideIdx = ((i % _slideCount) + _slideCount) % _slideCount; // cuộn vòng
    track.style.transform = `translateX(-${_slideIdx * 100}%)`;
    track.style.transition = "transform .5s ease";

    document
      .querySelectorAll("#hero-dots .ne-dot")
      .forEach((d, k) => d.classList.toggle("is-on", k === _slideIdx));
  }

  window.neJump = (id) => {
    document
      .getElementById(id)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Mở hộp quà: giấu hộp, bung hai mã QR. Một chiều — mở rồi thôi, không có
  // nút đóng lại (khách đang định chuyển khoản thì đừng bắt bấm thêm lần nữa).
  window.neOpenGift = () => {
    const box = document.getElementById("gift-box");
    const qr = document.getElementById("gift-qr");
    if (!box || !qr) return;
    box.classList.add("hidden");
    qr.classList.remove("hidden");
    qr.classList.add("ne-gift-open");
  };

  // Vuốt ngang để đổi ảnh. Gắn trên CẢ mục mở đầu (kể cả hai dải kem mờ ở đầu
  // và chân màn) chứ không riêng khung ảnh, để chỗ nào trong màn cũng vuốt
  // được. Chỉ tính khi vuốt ngang rõ hơn dọc, để không cướp thao tác cuộn trang.
  (function _bindSwipe() {
    const view = document.getElementById("section-hero");
    if (!view) return;
    let x0 = 0;
    let y0 = 0;
    let swiped = false;

    // Vuốt bắt đầu trên hai lối tắt ở dải trên vẫn sinh click lúc nhấc tay →
    // nuốt cú click ngay sau một lần vuốt để không nhảy mục ngoài ý muốn.
    view.addEventListener(
      "click",
      (e) => {
        if (!swiped) return;
        swiped = false;
        e.stopPropagation();
        e.preventDefault();
      },
      true,
    );

    view.addEventListener(
      "touchstart",
      (e) => {
        x0 = e.touches[0].clientX;
        y0 = e.touches[0].clientY;
      },
      { passive: true },
    );
    view.addEventListener(
      "touchend",
      (e) => {
        const dx = e.changedTouches[0].clientX - x0;
        const dy = e.changedTouches[0].clientY - y0;
        if (Math.abs(dx) <= 40 || Math.abs(dx) <= Math.abs(dy)) return;
        _goSlide(_slideIdx + (dx < 0 ? 1 : -1));
        swiped = true;
        setTimeout(() => (swiped = false), 400);
      },
      { passive: true },
    );
  })();

  // ============= CHUYỆN TÌNH YÊU (phần đặc thù của mẫu) =============
  // Bố cục TẠP CHÍ, không dùng bản dòng thời gian của render-helper.js: ảnh lớn
  // ở trên, khối chữ đè lên mép dưới ảnh và lệch trái/phải xen kẽ, số chương to
  // mờ nằm sau tiêu đề. Chữ lấy từ dữ liệu đều qua escapeHtml() (core/utils.js).

  function renderLoveStory(events) {
    const section = document.getElementById("love-story");
    const list = document.getElementById("love-story-list");
    if (!section || !list) return;

    if (!Array.isArray(events) || events.length === 0) {
      section.style.display = "none";
      return;
    }
    section.style.display = "flex";

    list.innerHTML = events
      .map((ev, i) => {
        const no = String(i + 1).padStart(2, "0");
        const img = ev.image_url ? getImageUrl(ev.image_url) : "";
        const fp = ev.focal_point;
        // Lệch phải ở mốc chẵn, lệch trái ở mốc lẻ — nhịp so le của trang tạp chí.
        const side = i % 2 === 0 ? "ne-mag-right" : "ne-mag-left";
        return `
      <article class="ne-mag ${side}">
        ${
          img
            ? `<div class="ne-mag-photo"><img src="${img}" alt=""
                 class="w-full h-full object-cover"
                 style="object-position:${fp?.x ?? 50}% ${fp?.y ?? 50}%"></div>`
            : ""
        }
        <div class="ne-mag-body">
          <span class="ne-mag-no" aria-hidden="true">${no}</span>
          <div class="ne-mag-kicker cx-a">Chương ${no}${
            ev.date ? " · " + escapeHtml(ev.date) : ""
          }</div>
          <h3 class="ne-mag-title cx-h">${escapeHtml(ev.title || "Cột mốc " + no)}</h3>
          ${
            ev.content
              ? `<p class="ne-mag-text cx-t">${escapeHtml(ev.content)}</p>`
              : ""
          }
        </div>
      </article>`;
      })
      .join("");
  }

  // ============= ALBUM ẢNH: GHÉP MẢNG KIỂU POSTER =============
  // Mỗi KHỐI gồm 5 tấm xếp theo đúng bố cục poster ảnh cưới:
  //
  //   ┌─────────── a ───────────┐
  //   ├──── b ────┬─ ngày ─┬────┤
  //   ├─────── d ─────────┤  c  │
  //   │                   ├─────┤
  //   └───────────────────┴──e──┘
  //
  // Dựng bằng flex LỒNG NHAU chứ không phải grid: c và d không có tỉ lệ khai
  // sẵn mà giãn theo chiều cao cột bên cạnh, thứ mà grid với hàng auto không
  // bảo đảm được (hàng bị co về 0). Ô nào thiếu ảnh thì bỏ hẳn thẻ bọc — album
  // ít hơn 5 tấm vẫn ra bố cục cân, không để lỗ.
  //
  // Chỉ số trong lightbox = chỉ số ẢNH GỐC, không phải thứ tự trong DOM.

  // Vị trí trong khối theo chỉ số ảnh: 0→a 1→b 2→c 3→d 4→e.
  const MOS_SLOTS = ["a", "b", "c", "d", "e"];

  function renderGallery(images, focalPoints, dateParts) {
    const grid = document.getElementById("gallery-grid");
    if (!grid) return;

    // Ảnh nằm trong #main-card (đang display:none lúc chưa mở bìa) nên KHÔNG
    // đặt loading="lazy": ảnh lazy sẽ chỉ bắt đầu tải khi bìa mở ra.
    // Chưa có ảnh → 5 ô minh hoạ, để khách hình dung bố cục lúc đang soạn.
    const urls = images?.length
      ? images.map(getImageUrl)
      : Array(5)
          .fill(null)
          .map(() => createPlaceholderSVG("Chưa có ảnh"));

    // Kho ảnh của lightbox dùng chung — phải khớp thứ tự với lưới.
    lightboxImages.length = 0;
    lightboxImages.push(...urls);

    grid.innerHTML = "";

    for (let start = 0; start < urls.length; start += 5) {
      const block = document.createElement("div");
      block.className = "ne-mos";

      // Ô ảnh của một vị trí, chưa có ảnh thì trả null để bên dưới bỏ qua.
      const cellAt = (offset) => {
        const i = start + offset;
        if (i >= urls.length) return null;
        const fp = focalPoints?.[images?.[i]];
        const cell = document.createElement("div");
        cell.className = `ne-cell ne-mos-${MOS_SLOTS[offset]}`;
        cell.innerHTML = `<img src="${urls[i]}" alt=""
          class="w-full h-full object-cover"
          style="object-position:${fp?.x ?? 50}% ${fp?.y ?? 50}%">`;
        cell.addEventListener("click", () => openLightbox(i));
        return cell;
      };

      const a = cellAt(0);
      const b = cellAt(1);
      const c = cellAt(2);
      const d = cellAt(3);
      const e = cellAt(4);

      if (a) block.appendChild(a);

      const mid = document.createElement("div");
      mid.className = "ne-mos-mid";

      if (b || d) {
        const left = document.createElement("div");
        left.className = "ne-mos-left";
        if (b) {
          const top = document.createElement("div");
          top.className = "ne-mos-top";
          top.appendChild(b);
          // Ngày cưới viết tay, chỉ đặt ở KHỐI ĐẦU: lặp lại ở mọi khối thì
          // thành hoạ tiết chứ không còn là điểm nhấn.
          if (start === 0 && dateParts?.length) {
            const t = document.createElement("div");
            t.className = "ne-mos-date ne-script";
            t.innerHTML = dateParts
              .map((p) => `<span>${escapeHtml(p)}</span>`)
              .join("");
            top.appendChild(t);
          }
          left.appendChild(top);
        }
        if (d) left.appendChild(d);
        mid.appendChild(left);
      }

      if (c || e) {
        const right = document.createElement("div");
        right.className = "ne-mos-right";
        if (c) right.appendChild(c);
        if (e) right.appendChild(e);
        mid.appendChild(right);
      }

      if (mid.childElementCount) block.appendChild(mid);
      grid.appendChild(block);
    }
  }

  // ============= TỜ LỊCH TREO TƯỜNG (phần đặc thù của mẫu) =============
  // Ghi đè window.renderMiniCalendar của calendar-helper.js (nạp TRƯỚC file
  // này) thay vì sửa file dùng chung — helper vẫn nguyên cho mẫu khác, còn
  // setupMiniCalendar() ở render-helper.js gọi qua biến toàn cục nên tự nhặt
  // đúng bản này. Ngày đánh dấu lấy từ window.weddingDates (helper gốc set).
  //
  // Tuần bắt đầu từ THỨ HAI, cột Chủ nhật đứng cuối và tô màu nhấn — đúng kiểu
  // lịch treo tường, khác quy ước CN-đứng-đầu của helper gốc.

  function renderWallCalendar() {
    const container = document.getElementById("mini-calendar");
    if (!container || !window.weddingDates?.length) return;

    const { year, month } = window.weddingDates[0];
    const marked = window.weddingDates
      .filter((d) => d.year === year && d.month === month)
      .map((d) => d.day);

    const dayNames = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "CN"];
    // getDay() trả 0 = CN → dời về hệ thứ-2-đầu-tuần.
    const firstDay = (new Date(year, month - 1, 1).getDay() + 6) % 7;
    const daysInMonth = new Date(year, month, 0).getDate();

    const dow = dayNames
      .map((d, i) => `<div class="ne-cal-dow${i === 6 ? " is-sun" : ""}">${d}</div>`)
      .join("");
    const blanks = Array(firstDay).fill(`<div class="ne-cal-day is-blank"></div>`).join("");
    const cells = Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      const sun = (firstDay + i) % 7 === 6 ? " is-sun" : "";
      const on = marked.includes(day) ? " is-marked" : "";
      return `<div class="ne-cal-day${sun}${on}"><span>${day}</span></div>`;
    }).join("");

    container.innerHTML = `
      <div class="ne-cal-head">
        <div class="ne-cal-no cx-a">${String(month).padStart(2, "0")}</div>
        <div class="ne-cal-label">
          <span class="ne-cal-name">Tháng ${month}</span>
          <span class="ne-cal-sep" aria-hidden="true"></span>
          <span class="ne-cal-name">${year}</span>
        </div>
      </div>
      <div class="ne-cal-grid">${dow}${blanks}${cells}</div>`;
  }

  window.renderMiniCalendar = renderWallCalendar;

  // Helper gốc tự vẽ một lần lúc nạp (bằng ngày mặc định) — vẽ lại ngay bằng
  // bản của mẫu để không lóe markup của helper trước khi có dữ liệu thật.
  renderWallCalendar();
})();
