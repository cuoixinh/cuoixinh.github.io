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
  const musicToggleBtn = document.getElementById("music-toggle");
  if (w.music_url) {
    initYouTubeMusic(w.music_url);
    if (musicToggleBtn) {
      musicToggleBtn.style.display = "flex";
    }
  } else {
    if (musicToggleBtn) {
      musicToggleBtn.style.display = "none";
    }
  }

  // --- MONOGRAM ---
  // Get first letter of first name (last word in full name)
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
  setText("cover-groom-name", w.groom_name, "----------");
  setText("cover-bride-name", w.bride_name, "----------");

  // --- HERO ---
  setAttr("main-photo", "src", getImageUrl(w.cover_image_url));
  setText("couple-names-groom", w.groom_name, "----------");
  setText("couple-names-bride", w.bride_name, "----------");

  if (w.ceremony_date) {
    const d = new Date(w.ceremony_date);
    setText(
      "hero-date",
      `${d.getDate()} · ${String(d.getMonth() + 1).padStart(2, "0")} · ${d.getFullYear()}`,
    );
  }

  // --- QUOTE ---
  if (w.story_quote) setText("story-quote", `"${w.story_quote}"`);

  // --- COUPLE INFO ---
  setAttr("groom-photo", "src", getImageUrl(w.groom_image_url));
  setText("groom-name-label", w.groom_name, "----------");
  setText("groom-father", w.groom_father, "--------------------");
  setText("groom-mother", w.groom_mother, "--------------------");
  setText(
    "groom-address",
    w.groom_address,
    "----------------------------------------",
  );

  setAttr("bride-photo", "src", getImageUrl(w.bride_image_url));
  setText("bride-name-label", w.bride_name, "----------");
  setText("bride-father", w.bride_father, "--------------------");
  setText("bride-mother", w.bride_mother, "--------------------");
  setText(
    "bride-address",
    w.bride_address,
    "----------------------------------------",
  );

  // --- CEREMONY INFO ---
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

    // Start countdown
    startCountdown(w.ceremony_date);
  }
  setText("invite-time", w.ceremony_time, "10:00");
  setText("invite-lunar", w.ceremony_lunar, "--------------------");

  // --- PARTY INFO ---
  const partyDate = w[`${side}_party_date`];
  const partyTime = w[`${side}_party_time`];
  const partyLunar = w[`${side}_party_lunar`];
  const partyLocation = w[`${side}_party_location`];

  if (partyDate) {
    const d = new Date(partyDate);
    const weekdays = [
      "Chủ Nhật",
      "Thứ Hai",
      "Thứ Ba",
      "Thứ Tư",
      "Thứ Năm",
      "Thứ Sáu",
      "Thứ Bảy",
    ];
    setText("party-day", d.getDate());
    setText(
      "party-month-year",
      `Tháng ${d.getMonth() + 1} · ${d.getFullYear()}`,
    );
    setText("party-weekday", weekdays[d.getDay()]);
  }
  setText("party-time", partyTime, "18:00");
  setText("party-lunar", partyLunar ? `${partyLunar}` : "--------------------");
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

  // --- GALLERY ---
  renderGallery(w.gallery_images);

  // --- QR CODE ---
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

  // --- MAP ---
  const mapEmbedRaw = w[`${side}_map_embed_url`];
  const mapEmbed = extractMapEmbedUrl(mapEmbedRaw);

  if (mapEmbed) {
    const iframe = document.getElementById("map-thumbnail-iframe");
    if (iframe) iframe.src = mapEmbed;

    const link = document.getElementById("map-link");
    if (link) link.href = mapEmbed;
  }
  setText("map-location-name", partyLocation, "------------------------");
}

// ============= GALLERY GRID =============

function renderGallery(galleryImages) {
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
      item.innerHTML = `<img src="${url}" alt="" class="w-full h-full object-cover" />`;
    } else {
      item.innerHTML = `<img src="${url}" alt="" class="w-full h-48 object-cover" />`;
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
