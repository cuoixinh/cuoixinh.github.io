// ============= TEMPLATE2 SPECIFIC CODE =============
// Modern Minimalist Wedding Template

// Get slug and isGroom from URL
const _weddingSlug = getSlugFromUrl();
const _isGroom = isGroomSide();

// ============= YOUTUBE MUSIC PLAYER =============

let youtubePlayer = null;
let isYouTubeMusicReady = false;
let isYouTubePlaying = false;

function loadYouTubeAPI() {
  if (!window.YT) {
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    const firstScriptTag = document.getElementsByTagName("script")[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
  }
}

window.onYouTubeIframeAPIReady = function () {
  isYouTubeMusicReady = true;
};

function extractYouTubeVideoId(url) {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/,
    /youtube\.com\/embed\/([^&\n?#]+)/,
    /youtube\.com\/v\/([^&\n?#]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  return null;
}

function initYouTubeMusic(musicUrl) {
  if (
    !musicUrl ||
    (!musicUrl.includes("youtube.com") && !musicUrl.includes("youtu.be"))
  ) {
    return;
  }

  const videoId = extractYouTubeVideoId(musicUrl);
  if (!videoId) return;

  loadYouTubeAPI();

  const checkReady = setInterval(() => {
    if (window.YT && window.YT.Player) {
      clearInterval(checkReady);

      let playerContainer = document.getElementById("youtube-music-player");
      if (!playerContainer) {
        playerContainer = document.createElement("div");
        playerContainer.id = "youtube-music-player";
        playerContainer.style.display = "none";
        document.body.appendChild(playerContainer);
      }

      youtubePlayer = new YT.Player("youtube-music-player", {
        height: "0",
        width: "0",
        videoId: videoId,
        playerVars: {
          autoplay: 1,
          loop: 1,
          playlist: videoId,
          controls: 0,
          showinfo: 0,
          modestbranding: 1,
        },
        events: {
          onReady: (event) => {
            event.target.setVolume(30);
            event.target.playVideo();
            isYouTubePlaying = true;
            updateMusicIcon();
          },
          onStateChange: (event) => {
            if (event.data === YT.PlayerState.ENDED) {
              event.target.playVideo();
            }
            isYouTubePlaying = event.data === YT.PlayerState.PLAYING;
            updateMusicIcon();
          },
        },
      });
    }
  }, 100);
}

function toggleYouTubeMusic() {
  if (!youtubePlayer) return;

  if (isYouTubePlaying) {
    youtubePlayer.pauseVideo();
    isYouTubePlaying = false;
  } else {
    youtubePlayer.playVideo();
    isYouTubePlaying = true;
  }
  updateMusicIcon();
}

function updateMusicIcon() {
  const musicIcon = document.getElementById("music-icon");
  if (musicIcon) {
    musicIcon.className = isYouTubePlaying
      ? "fas fa-pause text-lg"
      : "fas fa-music text-lg";
  }
}

window.toggleYouTubeMusic = toggleYouTubeMusic;

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
    weddingDates[0] = {
      year: d1.getFullYear(),
      month: d1.getMonth() + 1,
      day: d1.getDate(),
    };
    weddingDates[1] = {
      year: d2.getFullYear(),
      month: d2.getMonth() + 1,
      day: d2.getDate(),
    };
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
  images.length = 0;
  urls.forEach((url) => images.push(url));
}

// ============= MINI CALENDAR =============

const weddingDates = [
  { year: 2024, month: 10, day: 20 },
  { year: 2024, month: 10, day: 21 },
];

function renderMiniCalendar() {
  const container = document.getElementById("mini-calendar");
  if (!container) return;

  const { year, month } = weddingDates[0];
  const markedDays = weddingDates.map((d) => d.day);

  const dayNames = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();

  let html = `
    <div style="font-family:'Inter',sans-serif;">
      <div style="text-align:center; font-size:14px; letter-spacing:2px; text-transform:uppercase; color:#8a9a8a; font-weight:600; margin-bottom:12px;">
        Tháng ${month} · ${year}
      </div>
      <div style="display:grid; grid-template-columns:repeat(7,1fr); gap:4px; margin-bottom:6px;">
        ${dayNames.map((d) => `<div style="text-align:center; font-size:11px; color:#b4bfb4; padding:4px 0;">${d}</div>`).join("")}
      </div>
      <div style="display:grid; grid-template-columns:repeat(7,1fr); gap:4px;">
        ${Array(firstDay).fill("<div></div>").join("")}
        ${Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1;
          const isMarked = markedDays.includes(day);
          return `<div style="display:flex; align-items:center; justify-content:center; height:36px;">
            <div style="
              width:32px; height:32px;
              display:flex; align-items:center; justify-content:center;
              border-radius:50%;
              font-size:12px;
              ${
                isMarked
                  ? "background:#c9b896; color:white; font-weight:600; box-shadow:0 2px 8px rgba(201,184,150,0.4);"
                  : "color:#2d3436;"
              }
            ">${day}</div>
          </div>`;
        }).join("")}
      </div>
    </div>
  `;

  container.innerHTML = html;
}

renderMiniCalendar();

// ============= LIGHTBOX =============

const images = [];
const lightbox = document.getElementById("lightbox");
const lbImg = document.getElementById("lb-img");
const lbCounter = document.getElementById("lb-counter");
let lbIndex = 0;
let lbScale = 1;

function openLightbox(index) {
  lbIndex = index;
  lightbox.classList.remove("hidden");
  lightbox.classList.add("flex");
  document
    .querySelector('meta[name="viewport"]')
    .setAttribute(
      "content",
      "width=device-width, initial-scale=1.0, viewport-fit=cover",
    );
  lbShow();
}

function closeLightbox() {
  lightbox.classList.add("hidden");
  lightbox.classList.remove("flex");
  document
    .querySelector('meta[name="viewport"]')
    .setAttribute(
      "content",
      "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover",
    );
  lbScale = 1;
  lbImg.style.transform = "scale(1)";
}

function lbShow() {
  lbImg.style.opacity = "0";
  setTimeout(() => {
    lbImg.src = images[lbIndex];
    lbCounter.textContent = `${lbIndex + 1} / ${images.length}`;
    lbImg.style.opacity = "1";
  }, 150);
}

function lbNext() {
  lbIndex = (lbIndex + 1) % images.length;
  lbShow();
}

function lbPrev() {
  lbIndex = (lbIndex - 1 + images.length) % images.length;
  lbShow();
}

// Swipe
let lbStartX = 0;
lightbox.addEventListener(
  "touchstart",
  (e) => {
    lbStartX = e.touches[0].clientX;
  },
  { passive: true },
);
lightbox.addEventListener("touchend", (e) => {
  const diff = lbStartX - e.changedTouches[0].clientX;
  if (Math.abs(diff) > 50) diff > 0 ? lbNext() : lbPrev();
});

lightbox.addEventListener("click", (e) => {
  if (e.target === lightbox) closeLightbox();
});

// Pinch to zoom
let lbLastDist = 0;
let lbPinching = false;

function getDist(touches) {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

lbImg.addEventListener(
  "touchstart",
  (e) => {
    if (e.touches.length === 2) {
      lbPinching = true;
      lbLastDist = getDist(e.touches);
      e.preventDefault();
    }
  },
  { passive: false },
);

lbImg.addEventListener(
  "touchmove",
  (e) => {
    if (e.touches.length === 2 && lbPinching) {
      const dist = getDist(e.touches);
      const ratio = dist / lbLastDist;
      lbScale = Math.min(Math.max(lbScale * ratio, 1), 4);
      lbImg.style.transform = `scale(${lbScale})`;
      lbLastDist = dist;
      e.preventDefault();
    }
  },
  { passive: false },
);

lbImg.addEventListener("touchend", (e) => {
  if (e.touches.length < 2) {
    lbPinching = false;
    if (lbScale < 1.05) {
      lbScale = 1;
      lbImg.style.transition = "transform 0.2s ease";
      lbImg.style.transform = "scale(1)";
      setTimeout(() => (lbImg.style.transition = ""), 200);
    }
  }
});

// ============= LOAD WEDDING DATA =============

async function loadWeddingData() {
  if (!_weddingSlug) {
    if (!isPreviewMode()) {
      window.location.href = "/";
    }
    return;
  }

  try {
    const wedding = await weddingBL.getWeddingBySlug(_weddingSlug);

    if (!weddingBL.isActive(wedding)) {
      if (!isPreviewMode()) {
        window.location.href = "/";
      }
      return;
    }

    renderWedding(wedding);
  } catch (error) {
    console.error("Lỗi load wedding data:", error);
    if (!isPreviewMode()) {
      window.location.href = "/";
    }
  }
}

loadWeddingData();

// ============= PERSONALIZED GREETING =============

let _markViewedCallback = null;

function setupPersonalizedGreeting() {
  if (isPreviewMode()) {
    openInvitation();
    return;
  }

  const urlParams = new URLSearchParams(window.location.search);
  const encryptedName = urlParams.get("name");
  const encryptedRelationship = urlParams.get("relationship");

  if (!encryptedName || !encryptedRelationship) {
    openInvitation();
    return;
  }

  try {
    const name = decryptData(encryptedName);
    const relationship = decryptData(encryptedRelationship);

    if (!name || !relationship) {
      openInvitation();
      return;
    }

    const coverGuestName = document.getElementById("cover-guest-name");
    if (coverGuestName) coverGuestName.textContent = name;

    const rsvpSection = document.getElementById("rsvp-section");
    if (rsvpSection) rsvpSection.style.display = "block";
  } catch (error) {
    openInvitation();
    return;
  }

  if (_weddingSlug && !isPreviewMode()) {
    weddingBL
      .getWeddingBySlug(_weddingSlug)
      .then((wedding) => {
        const urlParams = new URLSearchParams(window.location.search);
        _markViewedCallback = () => {
          weddingBL.trackView(wedding, _isGroom, urlParams);
        };
      })
      .catch(() => {});
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", setupPersonalizedGreeting);
} else {
  setupPersonalizedGreeting();
}

// ============= COVER SCREEN =============

function openInvitation() {
  if (_markViewedCallback && !isPreviewMode()) {
    _markViewedCallback();
    _markViewedCallback = null;
  }

  const cover = document.getElementById("cover-screen");
  const main = document.getElementById("main-card");

  if (isPreviewMode()) {
    cover.style.display = "none";
    main.style.display = "block";
    window.scrollTo({ top: 0 });
    return;
  }

  cover.style.transition = "opacity 0.6s ease";
  cover.style.opacity = "0";

  setTimeout(() => {
    cover.style.display = "none";
    main.style.display = "block";
    main.style.opacity = "0";
    main.style.transition = "opacity 0.5s ease";

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        main.style.opacity = "1";
      });
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  }, 600);
}

// ============= RSVP =============

function confirmAttend(attending) {
  if (showPreviewAlert()) return;

  const btnAttend = document.getElementById("btn-attend");
  const btnDecline = document.getElementById("btn-decline");
  const msg = document.getElementById("attend-msg");

  btnAttend.style.cssText = "";
  btnDecline.style.cssText = "";

  if (attending) {
    btnAttend.style.background = "#c9b896";
    btnAttend.style.borderColor = "#c9b896";
    btnAttend.style.color = "white";
    msg.textContent = "Cảm ơn bạn! Chúng tôi rất mong được gặp bạn 🌸";
  } else {
    btnDecline.style.background = "#b4bfb4";
    btnDecline.style.borderColor = "#b4bfb4";
    btnDecline.style.color = "white";
    msg.textContent = "Cảm ơn bạn đã phản hồi. Chúc bạn nhiều sức khỏe!";
  }

  msg.classList.remove("hidden");
}

// ============= SAVE QR =============

async function saveQR(id) {
  if (showPreviewAlert()) return;

  const img = document.getElementById(id);
  const filename = `${id}.png`;

  try {
    const response = await fetch(img.src);
    const blob = await response.blob();
    const file = new File([blob], filename, { type: "image/png" });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: "QR Mừng Cưới" });
    } else {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);
    }
  } catch (e) {
    window.open(img.src, "_blank");
  }
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
