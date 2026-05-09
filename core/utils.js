// ============================================================
// UTILS.JS - Shared utility functions for all templates
// ============================================================

// ============= CONFIGURATION =============
const ENCRYPTION_KEY = CONFIG.security.encryptionKey;
const STORAGE_BASE_URL = CONFIG.cloudflare.imageProxy;

// ============= DOM HELPERS =============

/**
 * Set text content of an element by ID
 * @param {string} id - Element ID
 * @param {string} value - Text value to set
 * @param {string} placeholder - Placeholder text if value is empty
 */
function setText(id, value, placeholder = "") {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = value || placeholder;
}

/**
 * Set attribute of an element by ID
 * @param {string} id - Element ID
 * @param {string} attr - Attribute name
 * @param {string} value - Attribute value
 * @param {string} placeholder - Placeholder value if value is empty
 */
function setAttr(id, attr, value, placeholder = "") {
  const el = document.getElementById(id);
  if (!el) return;
  el.setAttribute(attr, value || placeholder);
}

/**
 * Set image src with ring border styling
 * @param {string} id - Image element ID
 * @param {string} filename - Image filename or URL
 */
function setImageWithRing(id, filename) {
  const el = document.getElementById(id);
  if (!el) return;

  const url = getImageUrl(filename);
  el.setAttribute("src", url);

  // Get parent container
  const container = el.parentElement;
  if (!container) return;

  // If no image (placeholder), remove ring classes
  if (!filename) {
    container.classList.remove("ring-1", "ring-white/80");
  } else {
    // Has image, add ring classes if not present
    if (!container.classList.contains("ring-1")) {
      container.classList.add("ring-1", "ring-white/80");
    }
  }
}

// ============= IMAGE HELPERS =============

/**
 * Get full image URL from filename
 * @param {string} filename - Image filename or URL
 * @returns {string} Full image URL or placeholder SVG
 */
function getImageUrl(filename) {
  if (!filename) {
    return createPlaceholderSVG("Chưa có ảnh");
  }
  // Check if it's already a full URL or relative path
  if (
    filename.startsWith("http") ||
    filename.startsWith("../") ||
    filename.startsWith("./") ||
    filename.startsWith("/")
  ) {
    return filename;
  }
  return `${STORAGE_BASE_URL}/${filename}`;
}

/**
 * Create placeholder SVG with camera icon
 * @param {string} text - Text to display
 * @returns {string} Data URI of SVG
 */
function createPlaceholderSVG(text = "Chưa có ảnh") {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
      <rect width="400" height="400" fill="#f5f5f5"/>
      <g transform="translate(200, 170)">
        <rect x="-35" y="-20" width="70" height="48" rx="5" fill="#d0d0d0"/>
        <path d="M -16,-20 L -10,-28 L 10,-28 L 16,-20 Z" fill="#d0d0d0"/>
        <circle cx="0" cy="4" r="18" fill="#e0e0e0"/>
        <circle cx="0" cy="4" r="12" fill="#f0f0f0"/>
        <circle cx="22" cy="-10" r="3" fill="#e0e0e0"/>
      </g>
      <text x="200" y="250" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" fill="#c0c0c0" font-weight="300" letter-spacing="0.5">No Photo Available</text>
    </svg>
  `;
  return "data:image/svg+xml," + encodeURIComponent(svg);
}

// ============= MAP HELPERS =============

/**
 * Extract clean Google Maps embed URL from iframe HTML or return URL as-is
 * @param {string} value - Raw value (URL or iframe HTML)
 * @returns {string} Clean embed URL
 */
function extractMapEmbedUrl(value) {
  if (!value) return "";

  // Decode HTML entities using DOM
  const textarea = document.createElement("textarea");
  textarea.innerHTML = value;
  const decoded = textarea.value;

  // Check if it's an iframe HTML
  if (decoded.includes("<iframe") && decoded.includes("src=")) {
    // Extract src URL from iframe
    const srcMatch = decoded.match(/src=["']([^"']+)["']/);
    if (srcMatch && srcMatch[1]) {
      return srcMatch[1];
    }
  }

  // If it's already a URL, return as-is
  return value;
}

// ============= ENCRYPTION HELPERS =============

/**
 * Decrypt AES encrypted data
 * @param {string} encryptedText - Encrypted text
 * @returns {string} Decrypted text
 */
function decryptData(encryptedText) {
  if (!encryptedText) return "";
  try {
    const decoded = decodeURIComponent(encryptedText);
    const decrypted = CryptoJS.AES.decrypt(decoded, ENCRYPTION_KEY);
    return decrypted.toString(CryptoJS.enc.Utf8);
  } catch (error) {
    console.error("Decryption error:", error);
    return "";
  }
}

// ============= PREVIEW MODE HELPERS =============

/**
 * Check if in preview mode
 * @returns {boolean} True if in preview mode
 */
function isPreviewMode() {
  return window.location.search.includes("preview=true");
}

/**
 * Show preview mode alert toast
 * @returns {boolean} Always returns true
 */
function showPreviewAlert() {
  const toast = document.createElement("div");
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(212, 165, 165, 0.95);
    color: white;
    padding: 12px 24px;
    border-radius: 8px;
    font-size: 14px;
    z-index: 10000;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    animation: slideDown 0.3s ease;
  `;
  toast.textContent = "Chức năng này không khả dụng ở chế độ xem thử";
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = "slideUp 0.3s ease";
    setTimeout(() => toast.remove(), 300);
  }, 2000);

  return true;
}

// ============= VIEWPORT HELPERS =============

/**
 * Fix viewport height for iOS (avoid browser navbar)
 */
function setVH() {
  const vh = window.innerHeight * 0.01;
  document.documentElement.style.setProperty("--vh", `${vh}px`);
}

/**
 * Initialize viewport height fix
 */
function initViewportFix() {
  setVH();
  window.addEventListener("resize", setVH);
}

// ============= URL HELPERS =============

/**
 * Get slug from URL
 * @returns {string} Wedding slug
 */
function getSlugFromUrl() {
  const urlParams = new URLSearchParams(window.location.search);
  let slug = urlParams.get("slug");

  // Check sessionStorage for redirect from 404.html
  const redirectPath = sessionStorage.getItem("redirect");
  const redirectSearch = sessionStorage.getItem("search");

  if (redirectPath && !slug) {
    // Get slug from path
    slug = redirectPath
      .split("/")
      .filter((p) => p)
      .pop();

    // Merge redirect params with current params
    if (redirectSearch) {
      const redirectParams = new URLSearchParams(redirectSearch);
      redirectParams.forEach((value, key) => {
        if (!urlParams.has(key)) {
          urlParams.set(key, value);
        }
      });
    }

    // Restore original URL using History API
    const newUrl =
      window.location.origin + redirectPath + (redirectSearch || "");
    window.history.replaceState(null, "", newUrl);

    // Clear sessionStorage
    sessionStorage.removeItem("redirect");
    sessionStorage.removeItem("search");
  }

  return slug;
}

/**
 * Get isGroom parameter from URL
 * @returns {boolean} True if groom side
 */
function isGroomSide() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get("isGroom") !== "false";
}

// ============= EXPORT FOR GLOBAL USE =============
// All functions are already in global scope, no need to export
