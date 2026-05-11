// ============= TEMPLATE1 SPECIFIC CODE =============
// Classic Romantic Wedding Template

// Get slug and isGroom from URL
const _weddingSlug = getSlugFromUrl();
const _isGroom = isGroomSide();

// ============= RENDER WEDDING DATA =============

function renderWedding(w) {
  if (!w || !w.is_active) return;

  const side = _isGroom ? "groom" : "bride";

  // --- NHẠC NỀN YOUTUBE ---
  const musicToggleBtn = document.getElementById("music-toggle");

  if (w.music_url) {
    initYouTubeMusic(w.music_url);
    // Show music button
    if (musicToggleBtn) {
      musicToggleBtn.style.display = "flex";
    }
  } else {
    // Hide music button when no music
    if (musicToggleBtn) {
      musicToggleBtn.style.display = "none";
    }
  }

  // --- COVER ---
  setAttr("cover-bg-img", "src", getImageUrl(w.cover_image_url));
  setText("cover-groom-name", w.groom_name, "----------");
  setText("cover-bride-name", w.bride_name, "----------");

  // --- SAVE THE DATE ---
  setImageWithRing("main-photo", w.cover_image_url);
  setText("couple-names-groom", w.groom_name, "----------");
  setText("couple-names-bride", w.bride_name, "----------");

  // --- THÔNG TIN GIA ĐÌNH ---
  setText("groom-father", w.groom_father, "--------------------");
  setText("groom-mother", w.groom_mother, "--------------------");
  setText(
    "groom-address",
    w.groom_address,
    "----------------------------------------",
  );
  setText("groom-name-label", w.groom_name, "----------");
  setImageWithRing("groom-photo", w.groom_image_url);

  setText("bride-father", w.bride_father, "--------------------");
  setText("bride-mother", w.bride_mother, "--------------------");
  setText(
    "bride-address",
    w.bride_address,
    "----------------------------------------",
  );
  setText("bride-name-label", w.bride_name, "----------");
  setImageWithRing("bride-photo", w.bride_image_url);

  // --- LỄ THÀNH HÔN ---
  setText("invite-groom", w.groom_name, "----------");
  setText("invite-bride", w.bride_name, "----------");
  if (w.ceremony_date) {
    const d = new Date(w.ceremony_date);
    const weekdays = [
      "Chủ Nhật",
      "Thứ Hai",
      "Thứ Ba",
      "Thứ Tư",
      "Thứ Năm",
      "Thứ Sáu",
      "Thứ Bảy",
    ];
    setText("invite-day", d.getDate());
    setText(
      "invite-month-year",
      `Tháng ${d.getMonth() + 1} · ${d.getFullYear()}`,
    );
    setText("invite-weekday", weekdays[d.getDay()]);
  }
  setText("invite-time", w.ceremony_time, "--:--");
  setText("invite-lunar", w.ceremony_lunar, "--------------------");

  // --- TIỆC CƯỚI (theo phía nhà trai/gái) ---
  const partyDate = w[`${side}_party_date`];
  const partyTime = w[`${side}_party_time`];
  const partyLunar = w[`${side}_party_lunar`];
  const partyLocation = w[`${side}_party_location`];

  if (partyDate && partyTime) {
    const d = new Date(partyDate);
    setText(
      "party-datetime",
      `${partyTime} - ${d.getDate()}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`,
    );
  } else {
    setText("party-datetime", "--:-- - --.--.----");
  }
  setText("party-lunar", partyLunar ? `(${partyLunar})` : "(----)");
  setText("party-location", partyLocation, "------------------------");

  // --- MINI CALENDAR ---
  const ceremonyDate = w.ceremony_date;
  if (ceremonyDate && partyDate) {
    const d1 = new Date(ceremonyDate);
    const d2 = new Date(partyDate);
    updateWeddingDates([
      {
        year: d1.getFullYear(),
        month: d1.getMonth() + 1,
        day: d1.getDate(),
      },
      {
        year: d2.getFullYear(),
        month: d2.getMonth() + 1,
        day: d2.getDate(),
      },
    ]);
    renderMiniCalendar();
  }

  // --- STORY QUOTE ---
  if (w.story_quote) setText("story-quote", `"${w.story_quote}"`);

  // --- GALLERY ---
  renderCarouselGallery(w.gallery_images);

  // --- HỘP MỪNG CƯỚI ---
  setText("groom-bank-label", w.groom_name, "----------");
  setText("groom-bank-name", w.groom_bank_name, "----------------");
  setText("groom-bank-number", w.groom_bank_number, "------------");
  setText("groom-bank-owner", w.groom_bank_owner, "--------------------");
  setAttr("groom-qr-img", "src", getImageUrl(w.groom_qr_url));

  setText("bride-bank-label", w.bride_name, "----------");
  setText("bride-bank-name", w.bride_bank_name, "----------------");
  setText("bride-bank-number", w.bride_bank_number, "------------");
  setText("bride-bank-owner", w.bride_bank_owner, "--------------------");
  setAttr("bride-qr-img", "src", getImageUrl(w.bride_qr_url));

  // --- BẢN ĐỒ (theo phía nhà trai/gái) ---
  const mapEmbedRaw = w[`${side}_map_embed_url`];
  const mapEmbed = extractMapEmbedUrl(mapEmbedRaw);

  if (mapEmbed) {
    const iframe = document.getElementById("map-thumbnail-iframe");
    if (iframe) iframe.src = mapEmbed;

    // Use embed URL for navigation link as well
    const link = document.getElementById("map-link");
    if (link) link.href = mapEmbed;
  }
  // Địa điểm tổ chức = party_location
  setText("map-location-name", partyLocation, "------------------------");
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

function updateCarousel() {
  const items = track.querySelectorAll(".carousel-item");
  const dots = dotsContainer.querySelectorAll("div");

  for (let i = 0; i < items.length; i++) {
    const diff = Math.abs(i - current);
    if (diff === 0) {
      items[i].style.width = "36%";
      items[i].style.height = "100%";
      items[i].style.opacity = "1";
      items[i].style.transform = "none";
      items[i].style.zIndex = "10";
      items[i].style.boxShadow = "0 20px 40px rgba(212,165,165,0.3)";
      items[i].style.visibility = "visible";
    } else if (diff === 1) {
      const sideH = track.offsetWidth * 0.28 * (4 / 3);
      const mainH = track.offsetWidth * 0.36 * (4 / 3);
      const ratio = sideH / mainH; // ~0.85
      items[i].style.width = "28%";
      items[i].style.height = ratio * 100 + "%";
      items[i].style.opacity = "0.55";
      items[i].style.transform = "none";
      items[i].style.zIndex = "5";
      items[i].style.boxShadow = "0 4px 12px rgba(212,165,165,0.1)";
      items[i].style.visibility = "visible";
    } else {
      items[i].style.width = "0";
      items[i].style.opacity = "0";
      items[i].style.visibility = "hidden";
    }

    dots[i].style.background = i === current ? "#d4a5a5" : "#f5d5d8";
    dots[i].style.width = i === current ? "16px" : "6px";
  }
}

// Swipe handlers
function onStart(x) {
  startX = x;
  isDragging = true;
}

function onEnd(x) {
  if (!isDragging) return;
  isDragging = false;
  const diff = startX - x;
  if (Math.abs(diff) > 30) {
    current =
      diff > 0
        ? Math.min(current + 1, carouselImages.length - 1)
        : Math.max(current - 1, 0);
    updateCarousel();
  }
}

track.addEventListener("touchstart", (e) => onStart(e.touches[0].clientX), {
  passive: true,
});
track.addEventListener("touchend", (e) => onEnd(e.changedTouches[0].clientX));
track.addEventListener("mousedown", (e) => onStart(e.clientX));
track.addEventListener("mouseup", (e) => onEnd(e.clientX));
track.addEventListener("mouseleave", () => {
  isDragging = false;
});

// Carousel observer
const carouselObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        carouselObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.5 },
);
carouselObserver.observe(container);

// Click carousel item to open lightbox
function attachCarouselClickHandler() {
  track.querySelectorAll(".carousel-item").forEach((item, i) => {
    // Clone để xóa hết listener cũ
    const clone = item.cloneNode(true);
    item.parentNode.replaceChild(clone, item);
    clone.dataset.index = i;
    clone.addEventListener("click", () => {
      const idx = parseInt(clone.dataset.index);
      if (idx === current) {
        openLightbox(idx);
      } else {
        current = idx;
        updateCarousel();
      }
    });
  });
}

// Render carousel gallery
function renderCarouselGallery(galleryImages) {
  if (!galleryImages || galleryImages.length === 0) {
    // Show 3 placeholders
    carouselImages.length = 0;
    for (let i = 0; i < 3; i++) {
      carouselImages.push(createPlaceholderSVG("Chưa có ảnh"));
    }
  } else {
    const urls = galleryImages.map((f) => getImageUrl(f));
    carouselImages.length = 0;
    urls.forEach((url) => carouselImages.push(url));
  }

  // Store images for lightbox
  lightboxImages.length = 0;
  carouselImages.forEach((url) => lightboxImages.push(url));

  // Render carousel items
  track.innerHTML = "";
  dotsContainer.innerHTML = "";

  for (let i = 0; i < carouselImages.length; i++) {
    const item = document.createElement("div");
    item.className =
      "carousel-item shrink-0 rounded-2xl overflow-hidden cursor-pointer";
    item.style.cssText =
      "transition: width 0.4s cubic-bezier(0.4,0,0.2,1), height 0.4s cubic-bezier(0.4,0,0.2,1), opacity 0.4s cubic-bezier(0.4,0,0.2,1), box-shadow 0.4s ease;";
    item.innerHTML = `<img src="${carouselImages[i]}" class="w-full h-full object-cover pointer-events-none" alt="">`;
    track.appendChild(item);

    const dot = document.createElement("div");
    dot.style.cssText =
      "height:6px; border-radius:9999px; transition: all 0.3s;";
    dotsContainer.appendChild(dot);
  }

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
