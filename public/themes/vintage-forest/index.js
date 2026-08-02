// ============= TEMPLATE3 SPECIFIC CODE =============
// Vintage Classic Wedding Template

// Get slug and isGroom from URL
const _weddingSlug = getSlugFromUrl();
const _isGroom = isGroomSide();

// ============= RENDER WEDDING DATA =============

function renderWedding(w) {
  if (!w || !w.is_active) return;

  const side = _isGroom ? "groom" : "bride";

  // --- MUSIC ---
  setupMusic(w.music_url, w.enable_music);

  // --- COVER ---
  renderCover(w);

  // --- HERO ---
  renderHero(w, false);

  // --- COUPLE INFO ---
  setText("invite-groom", w.groom_name, "----------");
  setText("invite-bride", w.bride_name, "----------");
  renderCoupleInfo(w);

  // --- EVENT PHOTO ---
  setAttr("event-photo", "src", getImageUrl(w.cover_image_url));

  // --- CEREMONY DATE ---
  renderCeremonyDate(w.ceremony_date, w.ceremony_time, w.ceremony_lunar);

  // --- CEREMONY LOCATION ---
  const ceremonyLocation = w.ceremony_location || "Tư Gia Nhà Trai";
  setText("ceremony-location", `Tại ${ceremonyLocation}`);

  // --- PARTY DATE ---
  const partyDate = w[`${side}_party_date`];
  const partyTime = w[`${side}_party_time`];
  const partyLunar = w[`${side}_party_lunar`];
  const partyLocation = w[`${side}_party_location`];
  renderPartyDate(partyDate, partyTime, partyLunar, partyLocation, "full");

  // --- MINI CALENDAR ---
  setupMiniCalendar(w.ceremony_date, partyDate);

  // --- LOVE STORY ---
  if (w.enable_love_story === true || w.enable_love_story === "true") {
    renderLoveStory(w.love_story);
  }

  // --- GALLERY ---
  renderTemplate3Gallery(w.gallery_images, w.image_focal_points?.gallery_images);

  // --- QR CODES ---
  renderQRCodes(w);

  // --- MAP ---
  renderMap(w[`${side}_map_embed_url`], partyLocation);
}

// ============= TEMPLATE3 GALLERY (1 large + 2 small pattern) =============

function renderTemplate3Gallery(galleryImages, focalPoints) {
  const objectPositionAt = (idx) => {
    const fp = focalPoints?.[galleryImages?.[idx]];
    return `${fp?.x ?? 50}% ${fp?.y ?? 50}%`;
  };
  const firstImageContainer = document.getElementById("gallery-first-image");
  const gridContainer = document.getElementById("gallery-grid");

  if (!firstImageContainer || !gridContainer) return;

  firstImageContainer.innerHTML = "";
  gridContainer.innerHTML = "";

  if (!galleryImages?.length) {
    // Show placeholder for first image
    const placeholder = createPlaceholderSVG("Chưa có ảnh");
    firstImageContainer.innerHTML = `
      <div class="w-full h-96 rounded-lg overflow-hidden shadow-md">
        <img src="${placeholder}" alt="" class="w-full h-full object-cover cursor-pointer" />
      </div>
    `;
    return;
  }

  const urls = galleryImages.map(getImageUrl);

  // Store for lightbox
  lightboxImages.length = 0;
  lightboxImages.push(...urls);

  // Render first image
  if (urls[0]) {
    firstImageContainer.innerHTML = `
      <div class="w-full h-96 rounded-lg overflow-hidden shadow-md">
        <img src="${urls[0]}" alt="" class="w-full h-full object-cover cursor-pointer" style="object-position: ${objectPositionAt(0)}" onclick="openLightbox(0)" />
      </div>
    `;
  }

  // Render remaining images in pattern: 1 large, 2 small, repeat
  let html = "";
  for (let i = 1; i < urls.length; i += 3) {
    // Large image
    if (urls[i]) {
      html += `
        <div class="w-full h-96 rounded-lg overflow-hidden shadow-md">
          <img src="${urls[i]}" alt="" class="w-full h-full object-cover cursor-pointer" style="object-position: ${objectPositionAt(i)}" onclick="openLightbox(${i})" />
        </div>
      `;
    }

    // Two small images
    if (urls[i + 1] || urls[i + 2]) {
      html += '<div class="grid grid-cols-2 gap-4">';
      if (urls[i + 1]) {
        html += `
          <div class="h-48 rounded-lg overflow-hidden shadow-md">
            <img src="${urls[i + 1]}" alt="" class="w-full h-full object-cover cursor-pointer" style="object-position: ${objectPositionAt(i + 1)}" onclick="openLightbox(${i + 1})" />
          </div>
        `;
      }
      if (urls[i + 2]) {
        html += `
          <div class="h-48 rounded-lg overflow-hidden shadow-md">
            <img src="${urls[i + 2]}" alt="" class="w-full h-full object-cover cursor-pointer" style="object-position: ${objectPositionAt(i + 2)}" onclick="openLightbox(${i + 2})" />
          </div>
        `;
      }
      html += "</div>";
    }
  }

  gridContainer.innerHTML = html;
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

document.querySelectorAll("section").forEach((section, i) => {
  if (i > 0) {
    section.style.opacity = "0";
    section.style.transform = "translateY(30px)";
    section.style.transition = "opacity 0.6s ease, transform 0.6s ease";
    revealObserver.observe(section);
  }
});
