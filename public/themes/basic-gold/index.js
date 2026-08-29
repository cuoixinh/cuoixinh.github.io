// ============= THEME: BASIC GOLD =============
// Thiệp một thẻ cao bằng màn hình, tông hồng khói — mở bằng màn bìa.
//
// File này chỉ KHAI BÁO: bản khai CX_THEME + renderWedding + phần đặc thù
// (carousel ảnh). Phần "chạy" (nạp dữ liệu, mở thiệp, hiệu ứng cuộn, viewport)
// nằm ở core/helpers/theme-boot.js, nạp sau file này. Nhờ vậy trang Thiết lập
// nạp lại file này chỉ để đọc CX_THEME mà không gây tác dụng phụ.
//
// Cả file bọc trong IIFE và chỉ lộ ra window.CX_THEME + window.renderWedding:
// `const` ở cấp cao nhất của một script cổ điển là biến toàn cục, trùng tên với
// biến của trang Thiết lập là vỡ cả trang đó.

(function () {
// Bản khai của theme — nguồn sự thật DUY NHẤT về font/màu gốc và về việc thiệp
// dùng class nào, để helper dùng chung không phải biết tên theme.
window.CX_THEME = {
  id: "basic-gold",

  // Font/màu GỐC: giá trị mặc định trên thanh chỉnh ở tab Giao diện và là điểm
  // "Khôi phục mặc định".
    // Bộ màu MẶC ĐỊNH của mẫu — bản khai máy đọc được của đúng những giá trị
    // :root trong theme.css (nguồn sự thật). Trang Thiết lập đọc nó để hiện mục
    // "Mặc định"; theme_setting.palette ghi đè lên trên lúc chạy.
    // Sinh lại bằng: node scripts/check-theme-palette.mjs --write
    palette: {
      heading: "#6b6562",
      body: "#78716c",
      accent: "#d4a5a5",
      accent_soft: "#e8b4b8",
      on_accent: "#ffffff",
      on_image: "#ffffff",
      on_lightbox: "#ffffff",
      card_bg: "#ffffff",
      page_bg: "#ffffff",
      surface: "#fffbf7",
      band: "#fef0f2",
      panel: "#ffffff",
      panel_warm: "#ffffff",
      cover: "#fffbf7",
      cover_mid: "#f5ebe0",
      cover_veil: "#ffe8e0",
      lightbox_bg: "#000000",
      line: "#f5d5d8",
      shadow: "#000000",
      scrim: "#000000",
      deco: "#d4a5a5",
      deco_soft: "#f5d5d8",
      deco_2: "#d4a5a5",
      deco_2_soft: "#f5d5d8",
      shine_from: "#d4a5a5",
      shine_mid: "#e8b4b8",
      shine_to: "#f5d5d8",
    },

  // Màu GỢI Ý trong bộ chọn màu (khách bấm vào một phần tử trên thiệp rồi
  // chỉnh riêng) — lấy từ chính bảng màu của mẫu.
  swatches: [
    "#6b6562", // stone-custom-500
    "#78716c", // stone-custom-400
    "#44403c", // stone-custom-600
    "#2d2d2d",
    "#d4a5a5", // rose-pastel-300
    "#e8b4b8", // rose-pastel-200
    "#f5d5d8", // rose-pastel-100
    "#fef0f2", // rose-pastel-50
    "#fffbf7", // cream-50
    "#fff5f0", // cream-100
    "#ffe8e0", // cream-200
    "#ffffff",
  ],

  // Mục được gán hiệu ứng hiện dần khi cuộn tới.
  reveal: [
    ".invitation-content > *",
    ".w-full.flex.flex-col.gap-8 > *",
    ".flex.gap-4.items-start",
    ".flex.flex-col.gap-4.border",
    ".gallery-item",
  ],

  // Mốc bung bảng đề xuất mẫu khác ở bản xem thử (?preview=true): cuộn tới mục
  // này là bảng trượt lên. Mặc định của core/utils.js cũng là hộp mừng cưới,
  // khai ra đây để mỗi mẫu tự chọn được chỗ hợp với bố cục của mình.
  suggest: "#section-gift",

  // Thiệp vừa hiện ra mới đo được bề ngang thật → dựng lại carousel.
  onOpen: _carouselReinit,

  // Không khai `focus`: id các mục trùng bảng mặc định của preview-focus-helper.
};

const _isGroom = isGroomSide();

// ============= RENDER WEDDING DATA =============

function renderWedding(w) {
  if (!w || !w.is_active) return;

  const side = _isGroom ? "groom" : "bride";

  // --- COVER ---
  // Khối dựng ảnh chạy TRƯỚC setupMusic: đây là chỗ ảnh của màn ĐẦU TIÊN nhận
  // src, mà setupMusic kéo YouTube iframe API (script bên thứ ba) về ngay khi
  // chạy — để nó đi trước là ảnh phải xếp hàng sau.
  renderCover(w);

  // --- HERO ---
  // useRing=false: ảnh hero tràn viền, không có khung để vẽ viền trắng.
  renderHero(w, false);
  _renderHeroSecond(w);

  // --- MUSIC ---
  setupMusic(w.music_url, w.enable_music);

  // --- COUPLE INFO ---
  setText("invite-groom", w.groom_name, "----------");
  setText("invite-bride", w.bride_name, "----------");
  renderCoupleInfo(w);

  // --- SECTION: family ---
  cxToggle("section-family", cxEnabled(w.enable_family));

  // --- CEREMONY / VU QUY ---
  // Bride + vu_quy_enabled → thay toàn bộ ceremony bằng vu quy
  const isVuQuy = !_isGroom && cxEnabled(w.vu_quy_enabled);
  const ceremonyName = isVuQuy
    ? "Lễ Vu Quy"
    : w.ceremony_name || "Lễ Thành Hôn";
  const displayTime = isVuQuy ? w.vu_quy_time : w.ceremony_time;
  const displayLoc = isVuQuy ? w.vu_quy_location : w.ceremony_location || "";

  // Khối tóm tắt trong trình phát nhạc (kéo xuống mới thấy) — dùng CHÍNH phần lễ
  // đang hiển thị, để nhà gái bật Vu Quy thì tóm tắt cũng là Vu Quy.
  renderMusicSummary(w, {
    ceremonyName,
    ceremonyTime: displayTime,
    ceremonyLocation: displayLoc,
  });

  // Đỉnh hero: TÊN LỄ · NĂM (năm lấy từ ngày lễ, chưa có ngày thì chỉ tên lễ)
  const cYear = (w.ceremony_date || "").slice(0, 4);
  setText("hero-eyebrow", ceremonyName + (cYear ? " · " + cYear : ""));

  setText("ceremony-event-name", ceremonyName);
  setText("party-section-label", "Tiệc Mừng " + ceremonyName);
  renderCeremonyDate(w.ceremony_date, displayTime, w.ceremony_lunar);
  if (displayLoc) {
    setText("ceremony-location-text", displayLoc);
    cxToggle("ceremony-location-wrap", true);
  }

  // --- PARTY DATE ---
  const partyDate = w[`${side}_party_date`];
  const partyTime = w[`${side}_party_time`];
  const partyLunar = w[`${side}_party_lunar`];
  const partyLocation = w[`${side}_party_location`];
  renderPartyDate(partyDate, partyTime, partyLunar, partyLocation, "full");
  cxToggle("section-party", cxEnabled(w.enable_party));

  // --- MINI CALENDAR ---
  setupMiniCalendar(w.ceremony_date, partyDate);

  // --- RSVP ---
  const rsvpSection = document.getElementById("rsvp-section");
  if (rsvpSection)
    rsvpSection.style.display = cxEnabled(w.rsvp_enabled) ? "flex" : "none";
  if (w.rsvp_message) {
    const msgEl = document.getElementById("rsvp-custom-message");
    if (msgEl) {
      msgEl.textContent = w.rsvp_message;
      msgEl.classList.remove("hidden");
    }
  }

  // --- TIMELINE ---
  if (cxEnabled(w.enable_timeline)) {
    renderTimeline(w.timeline, side, partyDate, w.ceremony_date, ceremonyName);
    cxToggle("section-timeline", true);
  }

  // --- STORY QUOTE ---
  renderStoryQuote(w.story_quote);

  // --- LOVE STORY ---
  if (cxEnabled(w.enable_love_story)) {
    renderLoveStory(w.love_story);
  } else {
    cxToggle("love-story", false);
  }

  // --- GALLERY ---
  if (cxEnabled(w.enable_photos)) {
    renderCarouselGallery(
      w.gallery_images,
      w.image_focal_points?.gallery_images,
    );
  } else {
    cxToggle("section-photos", false);
  }

  // --- QR CODES ---
  renderQRCodes(w);
  cxToggle("section-gift", cxEnabled(w.enable_gift));

  // --- MAP (party location) ---
  const partyMapUrl = w[`${side}_party_map_embed_url`];
  const showMap = cxEnabled(w[`${side}_party_show_location`]);
  if (showMap) {
    renderMap(partyMapUrl, partyLocation);
    // Chưa có URL bản đồ → hiện minh họa dữ liệu trống thay cho iframe
    const hasMap = !!extractMapEmbedUrl(partyMapUrl);
    cxToggle("map-thumbnail-iframe", hasMap);
    cxToggle("map-placeholder", !hasMap);
    // Không có bản đồ thì vô hiệu hoá click "Mở Maps"
    const mapLink = document.getElementById("map-link");
    if (mapLink) mapLink.classList.toggle("pointer-events-none", !hasMap);
  }
  cxToggle("section-map", showMap);

  // --- FOOTER ---
  cxToggle("section-footer", cxEnabled(w.enable_footer));
  if (w.footer_text) setText("footer-text", w.footer_text);
}

window.renderWedding = renderWedding;

// Lớp ảnh thứ hai của hero: ảnh đầu trong album, hoà vào ảnh bìa bằng mask chéo
// (.cx-hero-img-2). Chưa bật/chưa có album thì ẩn hẳn, hero về một ảnh.
function _renderHeroSecond(w) {
  const el = document.getElementById("main-photo-2");
  if (!el) return;
  const file = cxEnabled(w.enable_photos) ? w.gallery_images?.[0] : null;
  if (!file) {
    el.style.display = "none";
    return;
  }
  el.style.display = "";
  el.src = getImageUrl(file);
  const fp = w.image_focal_points?.gallery_images?.[file];
  if (fp) el.style.objectPosition = fp.x + "% " + fp.y + "%";
}

// ============= CAROUSEL GALLERY (RIÊNG CỦA THEME NÀY) =============

const carouselImages = [];
const track = document.getElementById("carousel-track");
const dotsContainer = document.getElementById("carousel-dots");
const container = document.getElementById("gallery-carousel");
let current = 0;
let startX = 0;
let isDragging = false;

// Fix container height = tallest item (ảnh giữa to nhất)
function fixHeight() {
  if (!track || !container) return;
  const trackWidth = track.offsetWidth;
  const tallest = trackWidth * 0.36 * (4 / 3);
  container.style.height = tallest + "px";
  track.style.height = tallest + "px";
  track.style.alignItems = "center";
}

// Carousel item style configs
const CAROUSEL_STYLES = {
  center: {
    width: "36%",
    height: "100%",
    opacity: "1",
    transform: "none",
    zIndex: "10",
    boxShadow: "0 20px 40px rgb(var(--cx-accent-rgb)/0.3)",
    visibility: "visible",
  },
  side: {
    width: "28%",
    heightRatio: 0.85, // (0.28 * 4/3) / (0.36 * 4/3)
    opacity: "0.55",
    transform: "none",
    zIndex: "5",
    boxShadow: "0 4px 12px rgb(var(--cx-accent-rgb)/0.1)",
    visibility: "visible",
  },
  hidden: {
    width: "0",
    opacity: "0",
    visibility: "hidden",
  },
};

function applyCarouselStyle(item, styleConfig) {
  Object.entries(styleConfig).forEach(([key, value]) => {
    if (key === "heightRatio") {
      item.style.height = value * 100 + "%";
    } else {
      item.style[key] = value;
    }
  });
}

function updateCarousel() {
  if (!track || !dotsContainer) return;
  const items = track.querySelectorAll(".carousel-item");
  const dots = dotsContainer.querySelectorAll("div");

  items.forEach((item, i) => {
    const diff = Math.abs(i - current);
    const style =
      diff === 0
        ? CAROUSEL_STYLES.center
        : diff === 1
          ? CAROUSEL_STYLES.side
          : CAROUSEL_STYLES.hidden;
    applyCarouselStyle(item, style);
  });

  dots.forEach((dot, i) => {
    dot.style.background =
      i === current
        ? "rgb(var(--cx-accent-rgb))"
        : "rgb(var(--cx-line-rgb))";
    dot.style.width = i === current ? "16px" : "6px";
  });
}

// Swipe handlers
const handleSwipe = {
  start: (x) => {
    startX = x;
    isDragging = true;
  },
  end: (x) => {
    if (!isDragging) return;
    isDragging = false;
    const diff = startX - x;
    if (Math.abs(diff) > 30) {
      current = Math.max(
        0,
        Math.min(carouselImages.length - 1, current + (diff > 0 ? 1 : -1)),
      );
      updateCarousel();
    }
  },
};

// Click carousel item to open lightbox
function attachCarouselClickHandler() {
  if (!track) return;
  track.querySelectorAll(".carousel-item").forEach((item, i) => {
    const clone = item.cloneNode(true);
    item.parentNode.replaceChild(clone, item);
    clone.dataset.index = i;
    clone.addEventListener("click", () => {
      const idx = parseInt(clone.dataset.index);
      idx === current ? openLightbox(idx) : ((current = idx), updateCarousel());
    });
  });
}

// Dựng lại sau khi thiệp hiện ra (CX_THEME.onOpen) — lúc đó mới đo được bề ngang.
function _carouselReinit() {
  fixHeight();
  updateCarousel();
  setTimeout(attachCarouselClickHandler, 100);
}

// Render carousel gallery
function renderCarouselGallery(galleryImages, focalPoints) {
  if (!track || !dotsContainer) return;

  // Prepare images
  carouselImages.length = 0;
  if (!galleryImages?.length) {
    carouselImages.push(
      ...Array(3)
        .fill(null)
        .map(() => createPlaceholderSVG("Chưa có ảnh")),
    );
  } else {
    carouselImages.push(...galleryImages.map(getImageUrl));
  }

  // Store for lightbox
  lightboxImages.length = 0;
  lightboxImages.push(...carouselImages);

  // Clear containers
  track.innerHTML = "";
  dotsContainer.innerHTML = "";

  // Create carousel items and dots
  const itemTransition =
    "transition: width 0.4s cubic-bezier(0.4,0,0.2,1), height 0.4s cubic-bezier(0.4,0,0.2,1), opacity 0.4s cubic-bezier(0.4,0,0.2,1), box-shadow 0.4s ease;";
  const dotStyle = "height:6px; border-radius:9999px; transition: all 0.3s;";

  carouselImages.forEach((imgSrc, idx) => {
    const fp = focalPoints?.[galleryImages?.[idx]];
    const objectPosition = `${fp?.x ?? 50}% ${fp?.y ?? 50}%`;
    const item = document.createElement("div");
    item.className =
      "carousel-item shrink-0 rounded-2xl overflow-hidden cursor-pointer";
    item.style.cssText = itemTransition;
    item.innerHTML = `<img src="${imgSrc}" class="w-full h-full object-cover pointer-events-none" style="object-position: ${objectPosition}" alt="">`;
    track.appendChild(item);

    const dot = document.createElement("div");
    dot.style.cssText = dotStyle;
    dotsContainer.appendChild(dot);
  });

  current = Math.floor(carouselImages.length / 2);
  fixHeight();
  updateCarousel();
  setTimeout(attachCarouselClickHandler, 100);
}

// Vuốt + đo lại khi xoay máy. Bọc trong `if`: trang Thiết lập cũng nạp file này
// (để đọc CX_THEME) nhưng không có markup thiệp.
if (track) {
  track.addEventListener(
    "touchstart",
    (e) => handleSwipe.start(e.touches[0].clientX),
    { passive: true },
  );
  track.addEventListener("touchend", (e) =>
    handleSwipe.end(e.changedTouches[0].clientX),
  );
  track.addEventListener("mousedown", (e) => handleSwipe.start(e.clientX));
  track.addEventListener("mouseup", (e) => handleSwipe.end(e.clientX));
  track.addEventListener("mouseleave", () => (isDragging = false));
  window.addEventListener("resize", fixHeight);
}
})();
