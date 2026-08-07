// ============= TEMPLATE1 SPECIFIC CODE =============
// Classic Romantic Wedding Template

// Get slug and isGroom from URL
const _weddingSlug = getSlugFromUrl();
const _isGroom = isGroomSide();

// ============= RENDER WEDDING DATA =============

function _isEnabled(flag) {
  return flag !== false && flag !== "false";
}

function _toggleEl(id, show) {
  const el = document.getElementById(id);
  if (!el) return;
  if (show) {
    el.classList.remove("hidden");
    if (el.style.display === "none") el.style.display = "";
  } else {
    el.classList.add("hidden");
  }
}

function renderTimeline(items, side, partyDate, ceremonyDate, ceremonyName) {
  const list = document.getElementById("timeline-list-render");
  if (!list) return;
  if (!Array.isArray(items) || items.length === 0) {
    list.innerHTML = "";
    return;
  }

  const relevant = items.filter((item) => {
    const t = item.type || "ceremony";
    if (t === "ceremony") return true;
    if (side === "groom" && t === "party") return true;
    if (side === "bride" && t === "bride-party") return true;
    return false;
  });
  if (relevant.length === 0) {
    list.innerHTML = "";
    return;
  }

  const _sort = (arr) =>
    [...arr].sort((a, b) =>
      !a.time ? 1 : !b.time ? -1 : a.time.localeCompare(b.time),
    );
  const partyItems = _sort(
    relevant.filter((i) => (i.type || "ceremony") !== "ceremony"),
  );
  const ceremonyItems = _sort(
    relevant.filter((i) => (i.type || "ceremony") === "ceremony"),
  );

  function _fmtDate(dateStr) {
    if (!dateStr) return "";
    try {
      const d = new Date(dateStr + "T00:00:00");
      return d.toLocaleDateString("vi-VN", {
        weekday: "short",
        day: "numeric",
        month: "numeric",
        year: "numeric",
      });
    } catch (e) {
      return dateStr;
    }
  }

  function _renderGroup(label, dateStr, groupItems) {
    if (!groupItems.length) return "";
    const dateLabel = _fmtDate(dateStr);
    const items = groupItems.map((item, i) => {
      const pbClass = i === groupItems.length - 1 ? "pb-1" : "pb-4";
      return `
        <div class="relative pl-[14px] ${pbClass} text-left">
          <div class="absolute left-[-6px] top-[3px] w-[10px] h-[10px] rounded-full bg-[rgb(var(--timeline-dot-rgb))] border-2 border-white shadow-[0_0_0_2px_rgb(var(--timeline-dot-rgb))]"></div>
          <div class="text-[0.7rem] font-bold text-red-400 tracking-[0.06em] mb-0.5">${escapeHtml(item.time || "")}</div>
          <div class="text-[0.95rem] font-cormorant text-stone-custom-500 leading-snug">${escapeHtml(item.title || "")}</div>
        </div>`;
    }).join("");
    return `
      <div class="mb-6 last:mb-0">
        <div class="flex items-center gap-2 mb-3">
          <span class="text-[11px] uppercase tracking-widest text-stone-custom-400 font-inter">${escapeHtml(label)}</span>
          ${dateLabel ? `<span class="text-[10px] text-stone-custom-400 font-inter">· ${escapeHtml(dateLabel)}</span>` : ""}
        </div>
        <div class="flex flex-col border-l-2 border-[rgb(var(--timeline-line-rgb))] ml-[5px]">
          ${items}
        </div>
      </div>`;
  }

  list.innerHTML =
    _renderGroup("Tiệc Cưới", partyDate, partyItems) +
    _renderGroup(ceremonyName || "Lễ Thành Hôn", ceremonyDate, ceremonyItems);
}

function renderWedding(w) {
  if (!w || !w.is_active) return;

  const side = _isGroom ? "groom" : "bride";

  // --- MUSIC ---
  setupMusic(w.music_url, w.enable_music);

  // --- COVER ---
  renderCover(w);

  // --- HERO ---
  renderHero(w, true);

  // --- COUPLE INFO ---
  setText("invite-groom", w.groom_name, "----------");
  setText("invite-bride", w.bride_name, "----------");
  renderCoupleInfo(w);

  // --- SECTION: family ---
  _toggleEl("section-family", _isEnabled(w.enable_family));

  // --- CEREMONY / VU QUY ---
  // Bride + vu_quy_enabled → thay toàn bộ ceremony bằng vu quy
  const isVuQuy = !_isGroom && _isEnabled(w.vu_quy_enabled);
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

  setText("ceremony-event-name", ceremonyName);
  setText("party-section-label", "Tiệc Mừng " + ceremonyName);
  renderCeremonyDate(w.ceremony_date, displayTime, w.ceremony_lunar);
  if (displayLoc) {
    setText("ceremony-location-text", displayLoc);
    _toggleEl("ceremony-location-wrap", true);
  }

  // --- PARTY DATE ---
  const partyDate = w[`${side}_party_date`];
  const partyTime = w[`${side}_party_time`];
  const partyLunar = w[`${side}_party_lunar`];
  const partyLocation = w[`${side}_party_location`];
  renderPartyDate(partyDate, partyTime, partyLunar, partyLocation, "full");
  _toggleEl("section-party", _isEnabled(w.enable_party));

  // --- MINI CALENDAR ---
  setupMiniCalendar(w.ceremony_date, partyDate);

  // --- RSVP ---
  const rsvpSection = document.getElementById("rsvp-section");
  if (rsvpSection)
    rsvpSection.style.display = _isEnabled(w.rsvp_enabled) ? "flex" : "none";
  if (w.rsvp_message) {
    const msgEl = document.getElementById("rsvp-custom-message");
    if (msgEl) {
      msgEl.textContent = w.rsvp_message;
      msgEl.classList.remove("hidden");
    }
  }

  // --- TIMELINE ---
  if (_isEnabled(w.enable_timeline)) {
    renderTimeline(w.timeline, side, partyDate, w.ceremony_date, ceremonyName);
    _toggleEl("section-timeline", true);
  }

  // --- STORY QUOTE ---
  renderStoryQuote(w.story_quote);

  // --- LOVE STORY ---
  if (_isEnabled(w.enable_love_story)) {
    renderLoveStory(w.love_story);
  } else {
    _toggleEl("love-story", false);
  }

  // --- GALLERY ---
  if (_isEnabled(w.enable_photos)) {
    renderCarouselGallery(
      w.gallery_images,
      w.image_focal_points?.gallery_images,
    );
  } else {
    _toggleEl("section-photos", false);
  }

  // --- QR CODES ---
  renderQRCodes(w);
  _toggleEl("section-gift", _isEnabled(w.enable_gift));

  // --- MAP (party location) ---
  const partyMapUrl = w[`${side}_party_map_embed_url`];
  const showMap = _isEnabled(w[`${side}_party_show_location`]);
  if (showMap) {
    renderMap(partyMapUrl, partyLocation);
    // Chưa có URL bản đồ → hiện minh họa dữ liệu trống thay cho iframe
    const hasMap = !!extractMapEmbedUrl(partyMapUrl);
    _toggleEl("map-thumbnail-iframe", hasMap);
    _toggleEl("map-placeholder", !hasMap);
    // Không có bản đồ thì vô hiệu hoá click "Mở Maps"
    const mapLink = document.getElementById("map-link");
    if (mapLink) mapLink.classList.toggle("pointer-events-none", !hasMap);
  }
  _toggleEl("section-map", showMap);

  // --- FOOTER ---
  _toggleEl("section-footer", _isEnabled(w.enable_footer));
  if (w.footer_text) setText("footer-text", w.footer_text);
}

// ============= CAROUSEL GALLERY (TEMPLATE1 SPECIFIC) =============

const carouselImages = [];
const track = document.getElementById("carousel-track");
const dotsContainer = document.getElementById("carousel-dots");
const container = document.getElementById("gallery-carousel");
let current = 0;
let startX = 0;
let isDragging = false;

// Fix container height = tallest item (ảnh giữa to nhất)
function fixHeight() {
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
    boxShadow: "0 20px 40px rgb(var(--shadow-soft-rgb)/0.3)",
    visibility: "visible",
  },
  side: {
    width: "28%",
    heightRatio: 0.85, // (0.28 * 4/3) / (0.36 * 4/3)
    opacity: "0.55",
    transform: "none",
    zIndex: "5",
    boxShadow: "0 4px 12px rgb(var(--shadow-soft-rgb)/0.1)",
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
    dot.style.background = i === current ? "rgb(var(--shadow-soft-rgb))" : "rgb(var(--card-blush-100-rgb))";
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

// Add swipe event listeners
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

// Carousel observer
const carouselObserver = new IntersectionObserver(
  (entries) =>
    entries.forEach(
      (entry) =>
        entry.isIntersecting && carouselObserver.unobserve(entry.target),
    ),
  { threshold: 0.5 },
);
carouselObserver.observe(container);

// Click carousel item to open lightbox
function attachCarouselClickHandler() {
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

// Render carousel gallery
function renderCarouselGallery(galleryImages, focalPoints) {
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

// Init resize listener for carousel
window.addEventListener("resize", fixHeight);

// ============= LOAD WEDDING DATA =============

loadWeddingData(_weddingSlug, renderWedding);

// ============= PERSONALIZED GREETING =============

// Store callback for carousel re-init
const carouselReinitCallback = () => {
  fixHeight();
  updateCarousel();
  setTimeout(attachCarouselClickHandler, 100);
};

// Override global openInvitation to include carousel re-init
const originalOpenInvitation = window.openInvitation;
window.openInvitation = function () {
  originalOpenInvitation(carouselReinitCallback);
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    setupPersonalizedGreeting(_weddingSlug, _isGroom, () => {
      originalOpenInvitation(carouselReinitCallback);
    });
  });
} else {
  setupPersonalizedGreeting(_weddingSlug, _isGroom, () => {
    originalOpenInvitation(carouselReinitCallback);
  });
}

// ============= VIEWPORT FIX =============

initViewportFix();

// ============= SCROLL ANIMATIONS =============

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        revealObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.15 },
);

// Gán class reveal cho từng phần tử
document
  .querySelectorAll(
    [
      ".invitation-content > *",
      ".w-full.flex.flex-col.gap-8 > *",
      ".flex.gap-4.items-start",
      ".flex.flex-col.gap-4.border",
      ".gallery-item",
    ].join(","),
  )
  .forEach((el, i) => {
    const mod = i % 3;
    if (mod === 0) el.classList.add("reveal", "from-bottom");
    else if (mod === 1) el.classList.add("reveal", "from-left");
    else el.classList.add("reveal", "from-right");

    revealObserver.observe(el);
  });

// ============= IDLE PULSE FOR RSVP BUTTONS =============

const btnAttend = document.getElementById("btn-attend");
const btnDecline = document.getElementById("btn-decline");
if (btnAttend) btnAttend.classList.add("btn-idle");
if (btnDecline) btnDecline.classList.add("btn-idle");

// ============= FIX iOS CHROME TOUCH =============

const openBtn = document.querySelector(".open-btn");
if (openBtn) {
  openBtn.addEventListener(
    "touchend",
    function (e) {
      e.preventDefault();
      window.openInvitation();
    },
    { passive: false },
  );
}
