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

// ============= IMAGE CROP HELPERS =============

/**
 * Open image crop modal for QR codes (1:1 aspect ratio)
 * @param {File} file - Image file to crop
 * @param {Function} callback - Callback function with cropped blob
 */
function openImageCropModal(file, callback) {
  // Create modal HTML
  const modalHTML = `
    <div id="crop-modal" class="fixed inset-0 bg-black/80 flex items-center justify-center z-[9999] p-4">
      <div class="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
        <!-- Header -->
        <div class="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 class="text-lg font-semibold text-gray-800">Cắt ảnh QR Code</h3>
          <button onclick="closeCropModal()" class="text-gray-400 hover:text-gray-600 transition-colors">
            <i class="fas fa-times text-xl"></i>
          </button>
        </div>

        <!-- Crop Area -->
        <div class="p-6">
          <div class="bg-gray-100 rounded-lg overflow-hidden relative" style="max-height: 400px; min-height: 300px;">
            <!-- Loading spinner -->
            <div id="crop-loading" class="absolute inset-0 flex items-center justify-center bg-gray-100">
              <div class="text-center">
                <div class="inline-block w-12 h-12 border-4 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
                <p class="text-sm text-gray-500 mt-3">Đang tải ảnh...</p>
              </div>
            </div>
            <!-- Image (hidden initially) -->
            <img id="crop-image" src="" alt="Crop" class="max-w-full opacity-0" />
          </div>
          <p class="text-sm text-gray-500 mt-3 text-center">
            <i class="fas fa-info-circle mr-1"></i>
            Sử dụng chuột hoặc 2 ngón tay để zoom và di chuyển ảnh
          </p>
        </div>

        <!-- Actions -->
        <div class="px-6 py-4 border-t border-gray-200 flex gap-3 justify-end">
          <button 
            onclick="closeCropModal()" 
            class="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
          >
            Hủy
          </button>
          <button 
            onclick="applyCrop()" 
            class="px-6 py-2.5 bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-lg hover:from-pink-600 hover:to-rose-600 transition-all font-medium shadow-md"
          >
            <i class="fas fa-check mr-2"></i>Áp dụng
          </button>
        </div>
      </div>
    </div>
  `;

  // Insert modal into body
  document.body.insertAdjacentHTML("beforeend", modalHTML);

  // Load image
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = document.getElementById("crop-image");
    const loading = document.getElementById("crop-loading");

    img.onload = () => {
      // Hide loading, show image
      loading.style.display = "none";
      img.style.opacity = "1";

      // Initialize Cropper.js after image is fully loaded
      const cropper = new Cropper(img, {
        aspectRatio: 1, // 1:1 for QR codes
        viewMode: 1,
        dragMode: "move",
        autoCropArea: 1,
        restore: false,
        guides: true,
        center: true,
        highlight: false,
        cropBoxMovable: false,
        cropBoxResizable: false,
        toggleDragModeOnDblclick: false,
        zoomOnWheel: true,
        zoomOnTouch: true,
      });

      // Store cropper instance globally
      window._currentCropper = cropper;
      window._cropCallback = callback;
    };

    img.onerror = () => {
      loading.innerHTML = `
        <div class="text-center">
          <i class="fas fa-exclamation-circle text-4xl text-red-500 mb-3"></i>
          <p class="text-sm text-red-600">Không thể tải ảnh</p>
        </div>
      `;
    };

    img.src = e.target.result;
  };

  reader.readAsDataURL(file);
}

/**
 * Close crop modal
 */
function closeCropModal() {
  const modal = document.getElementById("crop-modal");
  if (modal) {
    if (window._currentCropper) {
      window._currentCropper.destroy();
      window._currentCropper = null;
    }
    window._cropCallback = null;
    modal.remove();
  }
}

/**
 * Apply crop and return result
 */
function applyCrop() {
  if (!window._currentCropper || !window._cropCallback) return;

  const cropper = window._currentCropper;
  const callback = window._cropCallback;

  // Get cropped canvas
  const canvas = cropper.getCroppedCanvas({
    width: 800,
    height: 800,
    imageSmoothingEnabled: true,
    imageSmoothingQuality: "high",
  });

  // Convert to blob
  canvas.toBlob(
    (blob) => {
      if (blob) {
        callback(blob);
        closeCropModal();
      }
    },
    "image/png",
    0.95,
  );
}
