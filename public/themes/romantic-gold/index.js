// ============= TEMPLATE2 SPECIFIC CODE =============
// Modern Minimalist Wedding Template

// Get slug and isGroom from URL
const _weddingSlug = getSlugFromUrl();
const _isGroom = isGroomSide();

// ============= COUNTDOWN TIMER =============

let countdownInterval = null;

function startCountdown(targetDate) {
  if (!targetDate) return;

  const target = new Date(targetDate).getTime();

  function updateCountdown() {
    const now = new Date().getTime();
    const distance = target - now;

    if (distance < 0) {
      clearInterval(countdownInterval);
      document.getElementById("countdown-days").textContent = "00";
      document.getElementById("countdown-hours").textContent = "00";
      document.getElementById("countdown-minutes").textContent = "00";
      return;
    }

    const days = Math.floor(distance / (1000 * 60 * 60 * 24));
    const hours = Math.floor(
      (distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
    );
    const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));

    document.getElementById("countdown-days").textContent = String(
      days,
    ).padStart(2, "0");
    document.getElementById("countdown-hours").textContent = String(
      hours,
    ).padStart(2, "0");
    document.getElementById("countdown-minutes").textContent = String(
      minutes,
    ).padStart(2, "0");
  }

  updateCountdown();
  countdownInterval = setInterval(updateCountdown, 60000); // Update every minute
}

// ============= RENDER WEDDING DATA =============

function renderWedding(w) {
  if (!w || !w.is_active) return;

  const side = _isGroom ? "groom" : "bride";

  // --- MUSIC ---
  setupMusic(w.music_url, w.enable_music);

  // --- MONOGRAM ---
  const groomInitial = w.groom_name
    ? w.groom_name.trim().split(" ").pop().charAt(0).toUpperCase()
    : "M";
  const brideInitial = w.bride_name
    ? w.bride_name.trim().split(" ").pop().charAt(0).toUpperCase()
    : "H";

  setText("cover-monogram-left", groomInitial);
  setText("cover-monogram-right", brideInitial);
  setText("footer-monogram-left", groomInitial);
  setText("footer-monogram-right", brideInitial);

  // --- COVER ---
  renderCover(w);

  // --- HERO ---
  renderHero(w, false); // false = use setAttr (no ring)

  if (w.ceremony_date) {
    const d = new Date(w.ceremony_date);
    setText(
      "hero-date",
      `${d.getDate()} · ${String(d.getMonth() + 1).padStart(2, "0")} · ${d.getFullYear()}`,
    );
  }

  // --- QUOTE ---
  renderStoryQuote(w.story_quote);

  // --- LOVE STORY ---
  if (w.enable_love_story === true || w.enable_love_story === "true") {
    renderLoveStory(w.love_story);
  }

  // --- COUPLE INFO ---
  renderCoupleInfo(w);

  // --- CEREMONY DATE ---
  renderCeremonyDate(w.ceremony_date, w.ceremony_time, w.ceremony_lunar);

  // Start countdown
  if (w.ceremony_date) {
    startCountdown(w.ceremony_date);
  }

  // --- PARTY DATE ---
  const partyDate = w[`${side}_party_date`];
  const partyTime = w[`${side}_party_time`];
  const partyLunar = w[`${side}_party_lunar`];
  const partyLocation = w[`${side}_party_location`];
  renderPartyDate(partyDate, partyTime, partyLunar, partyLocation, "split");

  // --- MINI CALENDAR ---
  setupMiniCalendar(w.ceremony_date, partyDate);

  // --- GALLERY ---
  renderGallery(w.gallery_images, w.image_focal_points?.gallery_images);

  // --- QR CODES ---
  renderQRCodes(w);

  // --- MAP ---
  renderMap(w[`${side}_map_embed_url`], partyLocation);
}

// ============= GALLERY GRID =============

function renderGallery(galleryImages, focalPoints) {
  const objectPositionAt = (idx) => {
    const fp = focalPoints?.[galleryImages?.[idx]];
    return `${fp?.x ?? 50}% ${fp?.y ?? 50}%`;
  };
  const container = document.getElementById("gallery-grid");
  if (!container) return;

  container.innerHTML = "";

  if (!galleryImages || galleryImages.length === 0) {
    // Show 6 placeholders
    for (let i = 0; i < 6; i++) {
      const item = document.createElement("div");
      item.className = "gallery-item";
      if (i === 0 || i === 5) item.classList.add("tall");
      item.innerHTML = `<img src="${createPlaceholderSVG("Chưa có ảnh")}" alt="" class="w-full h-48 object-cover" />`;
      container.appendChild(item);
    }
    return;
  }

  const urls = galleryImages.map((f) => getImageUrl(f));

  urls.forEach((url, i) => {
    const item = document.createElement("div");
    item.className = "gallery-item cursor-pointer";

    // Make first and last items tall
    if (i === 0 || i === urls.length - 1) {
      item.classList.add("tall");
      item.innerHTML = `<img src="${url}" alt="" class="w-full h-full object-cover" style="object-position: ${objectPositionAt(i)}" />`;
    } else {
      item.innerHTML = `<img src="${url}" alt="" class="w-full h-48 object-cover" style="object-position: ${objectPositionAt(i)}" />`;
    }

    item.addEventListener("click", () => openLightbox(i));
    container.appendChild(item);
  });

  // Store images for lightbox
  lightboxImages.length = 0;
  urls.forEach((url) => lightboxImages.push(url));
}

// ============= LOAD WEDDING DATA =============

loadWeddingData(_weddingSlug, renderWedding);

// ============= PERSONALIZED GREETING =============

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    setupPersonalizedGreeting(_weddingSlug, _isGroom, openInvitation);
  });
} else {
  setupPersonalizedGreeting(_weddingSlug, _isGroom, openInvitation);
}

// ============= VIEWPORT FIX =============

initViewportFix();

// ============= SCROLL ANIMATIONS =============

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = "1";
        entry.target.style.transform = "translateY(0)";
        revealObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.1 },
);

// Apply reveal animation to sections
document.querySelectorAll("section").forEach((section, i) => {
  if (i > 0) {
    // Skip hero section
    section.style.opacity = "0";
    section.style.transform = "translateY(30px)";
    section.style.transition = "opacity 0.6s ease, transform 0.6s ease";
    revealObserver.observe(section);
  }
});
