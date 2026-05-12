// ============= TEMPLATE1 SPECIFIC CODE =============
// Classic Romantic Wedding Template

// Get slug and isGroom from URL
const _weddingSlug = getSlugFromUrl();
const _isGroom = isGroomSide();

// ============= RENDER WEDDING DATA =============

function renderWedding(w) {
  if (!w || !w.is_active) return;

  const side = _isGroom ? "groom" : "bride";

  // --- MUSIC ---
  setupMusic(w.music_url);

  // --- COVER ---
  renderCover(w);

  // --- HERO ---
  renderHero(w, true); // true = use setImageWithRing

  // --- COUPLE INFO ---
  setText("invite-groom", w.groom_name, "----------");
  setText("invite-bride", w.bride_name, "----------");
  renderCoupleInfo(w);

  // --- CEREMONY DATE ---
  renderCeremonyDate(w.ceremony_date, w.ceremony_time, w.ceremony_lunar);

  // --- PARTY DATE ---
  const partyDate = w[`${side}_party_date`];
  const partyTime = w[`${side}_party_time`];
  const partyLunar = w[`${side}_party_lunar`];
  const partyLocation = w[`${side}_party_location`];
  renderPartyDate(partyDate, partyTime, partyLunar, partyLocation, "full");

  // --- MINI CALENDAR ---
  setupMiniCalendar(w.ceremony_date, partyDate);

  // --- STORY QUOTE ---
  renderStoryQuote(w.story_quote);

  // --- GALLERY ---
  renderCarouselGallery(w.gallery_images);

  // --- QR CODES ---
  renderQRCodes(w);

  // --- MAP ---
  renderMap(w[`${side}_map_embed_url`], partyLocation);
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
    boxShadow: "0 20px 40px rgba(212,165,165,0.3)",
    visibility: "visible",
  },
  side: {
    width: "28%",
    heightRatio: 0.85, // (0.28 * 4/3) / (0.36 * 4/3)
    opacity: "0.55",
    transform: "none",
    zIndex: "5",
    boxShadow: "0 4px 12px rgba(212,165,165,0.1)",
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
    dot.style.background = i === current ? "#d4a5a5" : "#f5d5d8";
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
function renderCarouselGallery(galleryImages) {
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

  carouselImages.forEach((imgSrc) => {
    const item = document.createElement("div");
    item.className =
      "carousel-item shrink-0 rounded-2xl overflow-hidden cursor-pointer";
    item.style.cssText = itemTransition;
    item.innerHTML = `<img src="${imgSrc}" class="w-full h-full object-cover pointer-events-none" alt="">`;
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
