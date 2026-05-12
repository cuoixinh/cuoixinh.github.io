// ============================================================
// RENDER-HELPER.JS - Common rendering functions for all templates
// ============================================================

const WEEKDAYS = [
  "Chủ Nhật",
  "Thứ Hai",
  "Thứ Ba",
  "Thứ Tư",
  "Thứ Năm",
  "Thứ Sáu",
  "Thứ Bảy",
];

/**
 * Render ceremony date information
 * @param {string} ceremonyDate - ISO date string
 * @param {string} ceremonyTime - Time string (e.g., "10:00")
 * @param {string} ceremonyLunar - Lunar date string
 */
function renderCeremonyDate(ceremonyDate, ceremonyTime, ceremonyLunar) {
  if (ceremonyDate) {
    const d = new Date(ceremonyDate);
    setText("invite-day", d.getDate());
    setText(
      "invite-month-year",
      `Tháng ${d.getMonth() + 1} · ${d.getFullYear()}`,
    );
    setText("invite-weekday", WEEKDAYS[d.getDay()]);
  }
  setText("invite-time", ceremonyTime, "--:--");
  setText("invite-lunar", ceremonyLunar, "--------------------");
}

/**
 * Render party date information
 * @param {string} partyDate - ISO date string
 * @param {string} partyTime - Time string
 * @param {string} partyLunar - Lunar date string
 * @param {string} partyLocation - Location string
 * @param {string} format - Format type: "full" (template1) or "split" (template2)
 */
function renderPartyDate(
  partyDate,
  partyTime,
  partyLunar,
  partyLocation,
  format = "full",
) {
  if (format === "full") {
    // Template1 format: "18:00 - 20.10.2024"
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
  } else {
    // Template2 format: separate day, month-year, weekday, time
    if (partyDate) {
      const d = new Date(partyDate);
      setText("party-day", d.getDate());
      setText(
        "party-month-year",
        `Tháng ${d.getMonth() + 1} · ${d.getFullYear()}`,
      );
      setText("party-weekday", WEEKDAYS[d.getDay()]);
    }
    setText("party-time", partyTime, "18:00");
    setText(
      "party-lunar",
      partyLunar ? `${partyLunar}` : "--------------------",
    );
  }

  setText("party-location", partyLocation, "------------------------");
}

/**
 * Render couple information (names, parents, addresses, photos)
 * @param {Object} wedding - Wedding data object
 */
function renderCoupleInfo(wedding) {
  // Groom info
  setText("groom-father", wedding.groom_father, "--------------------");
  setText("groom-mother", wedding.groom_mother, "--------------------");
  setText(
    "groom-address",
    wedding.groom_address,
    "----------------------------------------",
  );
  setText("groom-name-label", wedding.groom_name, "----------");

  // Bride info
  setText("bride-father", wedding.bride_father, "--------------------");
  setText("bride-mother", wedding.bride_mother, "--------------------");
  setText(
    "bride-address",
    wedding.bride_address,
    "----------------------------------------",
  );
  setText("bride-name-label", wedding.bride_name, "----------");

  // Photos - check if template uses setImageWithRing or setAttr
  const groomPhoto = document.getElementById("groom-photo");
  const bridePhoto = document.getElementById("bride-photo");

  if (groomPhoto) {
    if (typeof setImageWithRing === "function") {
      setImageWithRing("groom-photo", wedding.groom_image_url);
    } else {
      setAttr("groom-photo", "src", getImageUrl(wedding.groom_image_url));
    }
  }

  if (bridePhoto) {
    if (typeof setImageWithRing === "function") {
      setImageWithRing("bride-photo", wedding.bride_image_url);
    } else {
      setAttr("bride-photo", "src", getImageUrl(wedding.bride_image_url));
    }
  }
}

/**
 * Render QR codes for both groom and bride
 * @param {Object} wedding - Wedding data object
 */
function renderQRCodes(wedding) {
  // Groom QR
  setText("groom-bank-label", wedding.groom_name, "----------");
  setText("groom-bank-name", wedding.groom_bank_name, "----------------");
  setText("groom-bank-number", wedding.groom_bank_number, "------------");
  setText("groom-bank-owner", wedding.groom_bank_owner, "--------------------");
  setAttr("groom-qr-img", "src", getImageUrl(wedding.groom_qr_url));

  // Bride QR
  setText("bride-bank-label", wedding.bride_name, "----------");
  setText("bride-bank-name", wedding.bride_bank_name, "----------------");
  setText("bride-bank-number", wedding.bride_bank_number, "------------");
  setText("bride-bank-owner", wedding.bride_bank_owner, "--------------------");
  setAttr("bride-qr-img", "src", getImageUrl(wedding.bride_qr_url));
}

/**
 * Render map iframe and link
 * @param {string} mapEmbedUrl - Raw map embed URL
 * @param {string} locationName - Location name to display
 */
function renderMap(mapEmbedUrl, locationName) {
  const mapEmbed = extractMapEmbedUrl(mapEmbedUrl);

  if (mapEmbed) {
    const iframe = document.getElementById("map-thumbnail-iframe");
    if (iframe) iframe.src = mapEmbed;

    const link = document.getElementById("map-link");
    if (link) link.href = mapEmbed;
  }

  setText("map-location-name", locationName, "------------------------");
}

/**
 * Render cover screen with couple names and background
 * @param {Object} wedding - Wedding data object
 */
function renderCover(wedding) {
  const coverBgImg = document.getElementById("cover-bg-img");
  if (coverBgImg) {
    setAttr("cover-bg-img", "src", getImageUrl(wedding.cover_image_url));
  }

  setText("cover-groom-name", wedding.groom_name, "----------");
  setText("cover-bride-name", wedding.bride_name, "----------");
}

/**
 * Render hero section with main photo and couple names
 * @param {Object} wedding - Wedding data object
 * @param {boolean} useRing - Whether to use setImageWithRing function
 */
function renderHero(wedding, useRing = true) {
  if (useRing && typeof setImageWithRing === "function") {
    setImageWithRing("main-photo", wedding.cover_image_url);
  } else {
    setAttr("main-photo", "src", getImageUrl(wedding.cover_image_url));
  }

  setText("couple-names-groom", wedding.groom_name, "----------");
  setText("couple-names-bride", wedding.bride_name, "----------");
}

/**
 * Render story quote
 * @param {string} quote - Quote text
 */
function renderStoryQuote(quote) {
  if (quote) setText("story-quote", `"${quote}"`);
}

/**
 * Setup mini calendar with ceremony and party dates
 * @param {string} ceremonyDate - ISO date string
 * @param {string} partyDate - ISO date string
 */
function setupMiniCalendar(ceremonyDate, partyDate) {
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
}

/**
 * Setup music player
 * @param {string} musicUrl - YouTube music URL
 */
function setupMusic(musicUrl) {
  const musicToggleBtn = document.getElementById("music-toggle");

  if (musicUrl) {
    initYouTubeMusic(musicUrl);
    if (musicToggleBtn) {
      musicToggleBtn.style.display = "flex";
    }
  } else {
    if (musicToggleBtn) {
      musicToggleBtn.style.display = "none";
    }
  }
}

// Make functions global
window.WEEKDAYS = WEEKDAYS;
window.renderCeremonyDate = renderCeremonyDate;
window.renderPartyDate = renderPartyDate;
window.renderCoupleInfo = renderCoupleInfo;
window.renderQRCodes = renderQRCodes;
window.renderMap = renderMap;
window.renderCover = renderCover;
window.renderHero = renderHero;
window.renderStoryQuote = renderStoryQuote;
window.setupMiniCalendar = setupMiniCalendar;
window.setupMusic = setupMusic;
