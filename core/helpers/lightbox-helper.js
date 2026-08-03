// ============================================================
// LIGHTBOX-HELPER.JS - Image lightbox functionality
// ============================================================

const lightboxImages = [];
let lightboxIndex = 0;
let lightboxScale = 1;

function openLightbox(index) {
  const lightbox = document.getElementById("lightbox");
  const lbImg = document.getElementById("lb-img");

  if (!lightbox || !lbImg) return;

  lightboxIndex = index;
  lightbox.classList.remove("hidden");
  lightbox.classList.add("flex");

  // Allow zoom when viewing image
  document
    .querySelector('meta[name="viewport"]')
    .setAttribute(
      "content",
      "width=device-width, initial-scale=1.0, viewport-fit=cover",
    );

  showLightboxImage();
}

/**
 * Close lightbox
 */
function closeLightbox() {
  const lightbox = document.getElementById("lightbox");
  const lbImg = document.getElementById("lb-img");

  if (!lightbox || !lbImg) return;

  lightbox.classList.add("hidden");
  lightbox.classList.remove("flex");

  // Disable zoom again
  document
    .querySelector('meta[name="viewport"]')
    .setAttribute(
      "content",
      "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover",
    );

  lightboxScale = 1;
  lbImg.style.transform = "scale(1)";
}

/**
 * Show current lightbox image
 */
function showLightboxImage() {
  const lbImg = document.getElementById("lb-img");
  const lbCounter = document.getElementById("lb-counter");

  if (!lbImg || !lbCounter) return;

  lbImg.style.opacity = "0";

  setTimeout(() => {
    lbImg.src = lightboxImages[lightboxIndex];
    lbCounter.textContent = `${lightboxIndex + 1} / ${lightboxImages.length}`;
    lbImg.style.opacity = "1";
  }, 150);
}

/**
 * Show next image in lightbox
 */
function lightboxNext() {
  lightboxIndex = (lightboxIndex + 1) % lightboxImages.length;
  lightboxScale = 1;
  document.getElementById("lb-img").style.transform = "scale(1)";
  showLightboxImage();
}

/**
 * Show previous image in lightbox
 */
function lightboxPrev() {
  lightboxIndex =
    (lightboxIndex - 1 + lightboxImages.length) % lightboxImages.length;
  lightboxScale = 1;
  document.getElementById("lb-img").style.transform = "scale(1)";
  showLightboxImage();
}

function getTouchDistance(touches) {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Initialize lightbox event listeners
 */
function initLightbox() {
  const lightbox = document.getElementById("lightbox");
  const lbImg = document.getElementById("lb-img");

  if (!lightbox || !lbImg) return;

  // Swipe to navigate
  let startX = 0;
  lightbox.addEventListener(
    "touchstart",
    (e) => {
      startX = e.touches[0].clientX;
    },
    { passive: true },
  );

  lightbox.addEventListener("touchend", (e) => {
    const diff = startX - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      diff > 0 ? lightboxNext() : lightboxPrev();
    }
  });

  // Click background to close
  lightbox.addEventListener("click", (e) => {
    if (e.target === lightbox) closeLightbox();
  });

  // Pinch to zoom
  let lastDist = 0;
  let isPinching = false;

  lbImg.addEventListener(
    "touchstart",
    (e) => {
      if (e.touches.length === 2) {
        isPinching = true;
        lastDist = getTouchDistance(e.touches);
        e.preventDefault();
      }
    },
    { passive: false },
  );

  lbImg.addEventListener(
    "touchmove",
    (e) => {
      if (e.touches.length === 2 && isPinching) {
        const dist = getTouchDistance(e.touches);
        const ratio = dist / lastDist;
        lightboxScale = Math.min(Math.max(lightboxScale * ratio, 1), 4);
        lbImg.style.transform = `scale(${lightboxScale})`;
        lastDist = dist;
        e.preventDefault();
      }
    },
    { passive: false },
  );

  lbImg.addEventListener("touchend", (e) => {
    if (e.touches.length < 2) {
      isPinching = false;
      // Snap to 1 if zoomed too small
      if (lightboxScale < 1.05) {
        lightboxScale = 1;
        lbImg.style.transition = "transform 0.2s ease";
        lbImg.style.transform = "scale(1)";
        setTimeout(() => (lbImg.style.transition = ""), 200);
      }
    }
  });
}

// Initialize on load
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initLightbox);
} else {
  initLightbox();
}

// Make functions and variables global
window.openLightbox = openLightbox;
window.closeLightbox = closeLightbox;
window.lightboxNext = lightboxNext;
window.lightboxPrev = lightboxPrev;
window.lightboxImages = lightboxImages;
