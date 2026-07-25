// ============================================================
// UTILS.JS - Shared utility functions for all templates
// ============================================================

// ============= CONFIGURATION =============
const ENCRYPTION_KEY = CONFIG.security.encryptionKey;
const STORAGE_BASE_URL = CONFIG.cloudflare.imageProxy || CONFIG.supabase.storageUrl;

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
  // Check if it's already a full URL, blob URL, data URL, or relative path
  if (
    filename.startsWith("http") ||
    filename.startsWith("blob:") ||
    filename.startsWith("data:") ||
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
function encryptData(text) {
  if (!text) return "";
  try {
    const encrypted = CryptoJS.AES.encrypt(text, ENCRYPTION_KEY).toString();
    return encodeURIComponent(encrypted);
  } catch (error) {
    console.error("Encryption error:", error);
    throw new Error("Lỗi mã hóa dữ liệu");
  }
}

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
  toast.className = "fixed top-5 left-1/2 -translate-x-1/2 z-[10000] px-6 py-3 rounded-lg text-sm text-white shadow-md animate-fade-in";
  toast.style.background = "rgba(212,165,165,0.95)";
  toast.textContent = "Chức năng này không khả dụng ở chế độ xem thử";
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transition = "opacity 0.3s";
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
 * @param {{label?:string,bankName?:string,bankNumber?:string,bankOwner?:string}} [giftInfo]
 *        Khi có → hiển thị preview kiểu block Hộp Mừng Cưới (tên NH / STK / chủ TK)
 */
function openImageCropModal(file, callback, giftInfo) {
  const sheet = openBottomSheet({
    id: 'crop-modal',
    title: 'Căn chỉnh ảnh QR Code',
    height: '80vh',
    onClose: () => {
      if (window._currentCropper) {
        window._currentCropper.destroy();
        window._currentCropper = null;
      }
      window._cropCallback = null;
      window._closeCropSheet = null;
    },
  });
  if (!sheet) return;
  window._closeCropSheet = sheet.close;

  // QR: xem trước như block Hộp Mừng Cưới (tên NH / STK / chủ TK); ảnh khác: ô vuông đơn giản.
  const previewBlock = giftInfo
    ? `
        <div class="flex-shrink-0 flex flex-col gap-2">
          <p class="text-xs font-semibold text-gray-500">Xem trước trên thiệp</p>
          <div class="rounded-2xl p-4" style="background:linear-gradient(160deg,#fffbf8,#fff5f7);">
            <div class="flex flex-col gap-1.5 items-center">
              <div id="crop-gift-label" class="text-[11px] text-[#8a6b73]">Chú Rể</div>
              <div class="bg-white rounded-2xl p-2 shadow-md">
                <div id="crop-preview" class="w-[92px] h-[92px] overflow-hidden"></div>
              </div>
              <div class="flex flex-col gap-0.5 items-center text-center max-w-full">
                <div id="crop-gift-bankname" class="text-[11px] text-[#a98a92] truncate max-w-[240px]">----------------</div>
                <div id="crop-gift-number" class="text-[13px] text-[#5a3a45] font-medium truncate max-w-[240px]">------------</div>
                <div id="crop-gift-owner" class="text-[12px] text-[#5a3a45] font-semibold truncate max-w-[240px]">--------------------</div>
              </div>
            </div>
          </div>
        </div>`
    : `
        <div class="flex items-center gap-3">
          <p class="text-xs font-semibold text-gray-500 shrink-0">Xem trước</p>
          <div id="crop-preview" class="w-16 h-16 rounded-xl overflow-hidden bg-gray-100 border border-rose-200 shrink-0"></div>
        </div>`;

  sheet.body.innerHTML = `
    <div class="p-4 sm:p-5 flex-1 flex flex-row min-h-0 gap-3 sm:gap-4">
      <!-- TRÁI: ảnh upload để cắt -->
      <div class="flex-1 min-w-0 flex flex-col gap-2">
        <div class="bg-gray-100 rounded-xl overflow-hidden relative flex-1 min-h-0">
          <div id="crop-loading" class="absolute inset-0 flex items-center justify-center bg-gray-100">
            <div class="text-center">
              <div class="inline-block w-10 h-10 border-4 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
              <p class="text-sm text-gray-500 mt-3">Đang tải ảnh...</p>
            </div>
          </div>
          <img id="crop-image" src="" alt="Crop" class="max-w-full opacity-0" />
        </div>
        <p class="text-[11px] sm:text-xs text-gray-400 text-center flex-shrink-0">Dùng 2 ngón tay hoặc cuộn chuột để zoom, kéo để di chuyển</p>
      </div>
      <!-- PHẢI: xem trước -->
      <div class="flex-shrink-0 w-40 sm:w-56 flex flex-col justify-center overflow-y-auto">
        ${previewBlock}
      </div>
    </div>
  `;

  // Đổ thông tin ngân hàng (textContent để an toàn với input người dùng)
  if (giftInfo) {
    const setTxt = (id, val, fallback) => {
      const el = document.getElementById(id);
      if (el) el.textContent = (val && String(val).trim()) || fallback;
    };
    setTxt('crop-gift-label', giftInfo.label, 'Chú Rể');
    setTxt('crop-gift-bankname', giftInfo.bankName, '----------------');
    setTxt('crop-gift-number', giftInfo.bankNumber, '------------');
    setTxt('crop-gift-owner', giftInfo.bankOwner, '--------------------');
  }
  sheet.footer.innerHTML = `
    <div class="px-4 pb-4 flex gap-2">
      <button onclick="closeCropModal()" class="flex-1 h-10 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors">Hủy</button>
      <button onclick="applyCrop()" class="flex-1 h-10 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-1.5">
        <i class="fas fa-check mr-1"></i>Áp dụng
      </button>
    </div>
  `;

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
        aspectRatio: 1,
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
        preview: "#crop-preview",
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
 * Reusable swipe-down-to-close for bottom sheet modals.
 * Returns a cleanup function to remove all listeners.
 */
function _setupBottomSheetSwipe(cardEl, closeFn) {
  if (!cardEl) return () => {};
  let startY = 0, deltaY = 0, active = false;

  function onStart(e) {
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    if (clientY - cardEl.getBoundingClientRect().top > 80) return;
    startY = clientY; deltaY = 0; active = true;
    cardEl.style.transition = "none";
    cardEl.style.userSelect = "none";
  }
  function onMove(e) {
    if (!active) return;
    if (e.cancelable) e.preventDefault();
    e.stopPropagation();
    const y = e.touches ? e.touches[0].clientY : e.clientY;
    deltaY = Math.max(0, y - startY);
    cardEl.style.transform = `translateY(${deltaY}px)`;
  }
  function onEnd() {
    if (!active) return;
    active = false;
    cardEl.style.userSelect = "";
    if (deltaY > 100) {
      cardEl.style.transition = "transform 0.25s cubic-bezier(0.32,0.72,0,1)";
      cardEl.style.transform = "translateY(100%)";
      setTimeout(closeFn, 240);
    } else {
      cardEl.style.transition = "transform 0.2s ease";
      cardEl.style.transform = "translateY(0)";
    }
  }

  cardEl.addEventListener("touchstart", onStart, { passive: true });
  cardEl.addEventListener("mousedown", onStart);
  // non-passive so preventDefault() can block page scroll during drag
  cardEl.addEventListener("touchmove", onMove, { passive: false });
  document.addEventListener("touchend", onEnd);
  document.addEventListener("mousemove", onMove);
  document.addEventListener("mouseup", onEnd);

  return function cleanup() {
    cardEl.removeEventListener("touchmove", onMove);
    document.removeEventListener("touchend", onEnd);
    document.removeEventListener("mousemove", onMove);
    document.removeEventListener("mouseup", onEnd);
  };
}

/**
 * Creates a standard bottom-sheet modal shell (overlay → handle → header → body → footer).
 * Handles: body-scroll lock, swipe-to-close, X button, z-index.
 *
 * @param {object} opts
 * @param {string}   opts.id       - Unique outer modal element ID
 * @param {string}   opts.title    - Header title HTML string
 * @param {string}   [opts.height='92vh'] - CSS height for the card
 * @param {Function} [opts.onClose]       - Extra cleanup run just before removal
 * @returns {{ body: HTMLElement, footer: HTMLElement, close: Function } | null}
 *   Returns null if a modal with that id already exists.
 */
function openBottomSheet({ id, title, height = '80vh', onClose } = {}) {
  if (document.getElementById(id)) return null;

  const modal = document.createElement('div');
  modal.id = id;
  // Mobile: neo cố định ở cạnh đáy (bottom-sheet). Desktop (sm+): căn giữa màn hình.
  modal.className = 'fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-[9999]';
  // Mobile: chiều cao theo tham số height (thường 80dvh, chừa khoảng hở phía trên).
  // sm+ (không còn dính đáy màn hình, tách hẳn thành popup nổi giữa): mở gần full
  // (92vh) để có đủ chỗ cho nội dung nhiều khối preview mà không cần co kéo layout.
  const mobileHeightClass = `h-[${height.replace('vh', 'dvh')}]`;
  modal.innerHTML = `
    <div id="${id}-card" class="bg-white rounded-t-2xl sm:rounded-2xl max-w-3xl w-full flex flex-col overflow-hidden shadow-2xl ${mobileHeightClass} sm:h-[92vh]">
      <div class="flex justify-center items-center pt-2.5 pb-1 flex-shrink-0">
        <span class="w-10 h-1.5 rounded-full bg-gray-300"></span>
      </div>
      <div class="px-5 py-3 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
        <h3 class="text-base font-semibold text-gray-800 flex items-center gap-2">${title}</h3>
        <button type="button" id="${id}-x-btn" class="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors">
          <svg class="w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </button>
      </div>
      <div id="${id}-body" class="flex-1 min-h-0 flex flex-col overflow-hidden"></div>
      <div id="${id}-footer" class="flex-shrink-0"></div>
    </div>
  `;

  document.body.appendChild(modal);
  const prevOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';

  const card  = document.getElementById(`${id}-card`);
  const body  = document.getElementById(`${id}-body`);
  const footer = document.getElementById(`${id}-footer`);

  let closed = false;
  function close() {
    if (closed) return;
    closed = true;
    cleanupSwipe();
    if (typeof onClose === 'function') onClose();
    modal.remove();
    document.body.style.overflow = prevOverflow;
  }

  document.getElementById(`${id}-x-btn`).addEventListener('click', close);
  const cleanupSwipe = _setupBottomSheetSwipe(card, close);

  return { body, footer, close };
}

function closeCropModal() {
  if (typeof window._closeCropSheet === 'function') window._closeCropSheet();
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

// ============= FOCAL POINT PICKER =============

/**
 * Open focal-point picker — let user drag a "focus point" on the image and
 * preview how it will look when cropped at 3 common ratios (1:1, 16:9, 9:16).
 * @param {File|string} imageSource - Image file or existing image URL
 * @param {{x:number,y:number}} [currentFocal] - Current focal point in % (default center)
 * @param {Function} callback - Called with {x, y} in % when user confirms
 */
function openFocalPointPicker(imageSource, currentFocal, callback, giftInfo) {
  const focal = {
    x: currentFocal?.x ?? 50,
    y: currentFocal?.y ?? 50,
  };

  const sheet = openBottomSheet({
    id: 'focal-modal',
    title: 'Căn chỉnh khung hình',
    height: '80vh',
    onClose: () => {
      window._focalPickerCallback = null;
      window._focalPickerReset = null;
      window._closeFocalSheet = null;
      window._focalPickerValue = null;
    },
  });
  if (!sheet) return;
  window._closeFocalSheet = sheet.close;

  // QR: xem trước như block Hộp Mừng Cưới (Basic Gold) — tên NH / STK / tên chủ TK.
  // Ảnh khác: xem trước 3 tỉ lệ như cũ.
  const previewSection = giftInfo
    ? `
      <div class="flex-shrink-0">
        <p class="text-xs font-semibold text-gray-500 mb-2">Xem trước trên thiệp</p>
        <div class="rounded-2xl p-4" style="background:linear-gradient(160deg,#fffbf8,#fff5f7);">
          <div class="flex flex-col gap-1.5 items-center">
            <div id="focal-gift-label" class="text-[11px] text-[#8a6b73]">Chú Rể</div>
            <div class="bg-white rounded-2xl p-2 shadow-md">
              <img id="focal-preview-qr" src="" alt="" class="w-[92px] h-[92px] object-cover" />
            </div>
            <div class="flex flex-col gap-0.5 items-center text-center max-w-full">
              <div id="focal-gift-bankname" class="text-[11px] text-[#a98a92] truncate max-w-[240px]">----------------</div>
              <div id="focal-gift-number" class="text-[13px] text-[#5a3a45] font-medium truncate max-w-[240px]">------------</div>
              <div id="focal-gift-owner" class="text-[12px] text-[#5a3a45] font-semibold truncate max-w-[240px]">--------------------</div>
            </div>
          </div>
        </div>
      </div>`
    : `
      <div class="flex-shrink-0">
        <p class="text-xs font-semibold text-gray-500 mb-2">Xem trước các tỉ lệ</p>
        <!-- Nếu để grid giãn hết bề ngang card (desktop tới max-w-3xl ~768px), ô Dọc
             (9:16) sẽ cao vài trăm px dù popup đã mở full. max-w-[380px] mx-auto giới
             hạn bề rộng cả khối lại (mọi kích thước màn hình) để 3 ô vẫn đúng tỉ lệ
             tương quan với nhau, chỉ là thu nhỏ đồng đều xuống kích thước hợp lý —
             trên màn hẹp hơn 380px, max-width tự nhường cho bề rộng card sẵn có. -->
        <div class="grid grid-cols-3 gap-3 max-w-[340px] sm:max-w-[380px] mx-auto">
          <div>
            <div class="aspect-square rounded-lg overflow-hidden bg-gray-100 border border-gray-200">
              <img id="focal-preview-1-1" src="" alt="" class="w-full h-full object-cover" />
            </div>
            <p class="text-xs text-gray-500 text-center mt-1">Vuông (1:1)</p>
          </div>
          <div>
            <div class="aspect-video rounded-lg overflow-hidden bg-gray-100 border border-gray-200">
              <img id="focal-preview-16-9" src="" alt="" class="w-full h-full object-cover" />
            </div>
            <p class="text-xs text-gray-500 text-center mt-1">Ngang (16:9)</p>
          </div>
          <div>
            <div class="aspect-[9/16] rounded-lg overflow-hidden bg-gray-100 border border-gray-200">
              <img id="focal-preview-9-16" src="" alt="" class="w-full h-full object-cover" />
            </div>
            <p class="text-xs text-gray-500 text-center mt-1">Dọc (9:16)</p>
          </div>
        </div>
      </div>`;

  const hintText = giftInfo
    ? 'Chạm hoặc kéo điểm để chọn phần hiển thị của mã QR.'
    : 'Chạm hoặc kéo điểm đến phần quan trọng nhất (VD: khuôn mặt) để ảnh đẹp ở mọi tỉ lệ.';

  sheet.body.innerHTML = `
    <div class="flex flex-col flex-1 min-h-0 p-5 gap-4">
      <div class="flex flex-col flex-1 min-h-0 gap-2">
        <div id="focal-image-wrap" class="relative rounded-xl overflow-hidden bg-gray-100 cursor-crosshair select-none touch-none flex-1 min-h-0">
          <img id="focal-image" src="" alt="" class="w-full h-full object-contain block pointer-events-none select-none" draggable="false" />
          <div id="focal-marker" class="absolute w-6 h-6 -ml-3 -mt-3 rounded-full border-2 border-white shadow-lg pointer-events-none" style="left:50%;top:50%;background-color:var(--primary);"></div>
        </div>
        <p class="text-xs text-gray-500 flex-shrink-0">${hintText}</p>
      </div>
      ${previewSection}
    </div>
  `;

  // Đổ thông tin ngân hàng vào phần xem trước QR (textContent để an toàn với input người dùng)
  if (giftInfo) {
    const setTxt = (id, val, fallback) => {
      const el = document.getElementById(id);
      if (el) el.textContent = (val && String(val).trim()) || fallback;
    };
    setTxt('focal-gift-label', giftInfo.label, 'Chú Rể');
    setTxt('focal-gift-bankname', giftInfo.bankName, '----------------');
    setTxt('focal-gift-number', giftInfo.bankNumber, '------------');
    setTxt('focal-gift-owner', giftInfo.bankOwner, '--------------------');
  }
  sheet.footer.innerHTML = `
    <div class="px-4 py-3 border-t border-gray-200 flex items-center justify-between gap-2">
      <button onclick="resetFocalPoint()" class="h-10 px-4 bg-sky-50 text-sky-700 rounded-xl text-sm font-medium hover:bg-sky-100 transition-colors flex items-center gap-1.5">
        <svg class="w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
        Đặt lại
      </button>
      <div class="flex gap-2">
        <button onclick="closeFocalPointPicker()" class="h-10 px-4 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors">Hủy</button>
        <button onclick="confirmFocalPoint()" class="h-10 px-5 rounded-xl text-sm font-semibold text-white bg-rose-500 hover:bg-rose-600 transition-colors flex items-center gap-1.5">
          <svg class="w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
          Áp dụng
        </button>
      </div>
    </div>
  `;

  const wrap = document.getElementById("focal-image-wrap");
  const img = document.getElementById("focal-image");
  const marker = document.getElementById("focal-marker");
  const previews = [
    document.getElementById("focal-preview-1-1"),
    document.getElementById("focal-preview-16-9"),
    document.getElementById("focal-preview-9-16"),
  ];
  const qrPreview = document.getElementById("focal-preview-qr");

  // Returns the rendered image bounds within the wrap (accounting for object-contain letterboxing)
  function getImageBounds() {
    const rect = wrap.getBoundingClientRect();
    const nw = img.naturalWidth;
    const nh = img.naturalHeight;
    if (!nw || !nh || !rect.width || !rect.height) {
      return { left: 0, top: 0, width: rect.width || 1, height: rect.height || 1, wrapW: rect.width, wrapH: rect.height };
    }
    const wrapAspect = rect.width / rect.height;
    const imgAspect = nw / nh;
    let imgW, imgH, imgLeft, imgTop;
    if (imgAspect > wrapAspect) {
      imgW = rect.width; imgH = rect.width / imgAspect;
      imgLeft = 0; imgTop = (rect.height - imgH) / 2;
    } else {
      imgH = rect.height; imgW = rect.height * imgAspect;
      imgTop = 0; imgLeft = (rect.width - imgW) / 2;
    }
    return { left: imgLeft, top: imgTop, width: imgW, height: imgH, wrapW: rect.width, wrapH: rect.height };
  }

  function applyToUI() {
    const b = getImageBounds();
    // Convert image-space focal point to wrap-space marker position
    const markerLeft = b.wrapW ? ((b.left + (focal.x / 100) * b.width) / b.wrapW) * 100 : focal.x;
    const markerTop  = b.wrapH ? ((b.top  + (focal.y / 100) * b.height) / b.wrapH) * 100 : focal.y;
    marker.style.left = `${markerLeft}%`;
    marker.style.top  = `${markerTop}%`;
    // Expose image-space values for confirmFocalPoint (marker style is wrap-space, not image-space)
    window._focalPickerValue = { x: focal.x, y: focal.y };
    previews.forEach((p) => {
      if (p) p.style.objectPosition = `${focal.x}% ${focal.y}%`;
    });
    if (qrPreview) qrPreview.style.objectPosition = `${focal.x}% ${focal.y}%`;
  }

  function setFromPointer(e) {
    const rect = wrap.getBoundingClientRect();
    const b = getImageBounds();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    // Convert wrap-space click to image-space percentage
    focal.x = Math.round(Math.max(0, Math.min(100, ((clickX - b.left) / b.width) * 100)));
    focal.y = Math.round(Math.max(0, Math.min(100, ((clickY - b.top) / b.height) * 100)));
    applyToUI();
  }

  let dragging = false;
  wrap.addEventListener("pointerdown", (e) => {
    dragging = true;
    wrap.setPointerCapture(e.pointerId);
    setFromPointer(e);
  });
  wrap.addEventListener("pointermove", (e) => {
    if (dragging) setFromPointer(e);
  });
  wrap.addEventListener("pointerup", () => {
    dragging = false;
  });
  wrap.addEventListener("pointercancel", () => {
    dragging = false;
  });


  function setImageSrc(src) {
    img.src = src;
    previews.forEach((p) => { if (p) p.src = src; });
    if (qrPreview) qrPreview.src = src;
    // Wait for natural dimensions before positioning marker
    if (img.complete && img.naturalWidth) {
      applyToUI();
    } else {
      img.onload = () => applyToUI();
    }
  }

  if (typeof imageSource === "string") {
    setImageSrc(imageSource);
  } else {
    const reader = new FileReader();
    reader.onload = (e) => setImageSrc(e.target.result);
    reader.readAsDataURL(imageSource);
  }

  window._focalPickerCallback = callback;
  window._focalPickerReset = () => {
    focal.x = 50;
    focal.y = 50;
    applyToUI();
  };
}

/**
 * Close focal-point picker modal
 */
function closeFocalPointPicker() {
  if (typeof window._closeFocalSheet === 'function') window._closeFocalSheet();
}

/**
 * Reset điểm lấy nét về giữa ảnh (mặc định)
 */
function resetFocalPoint() {
  if (typeof window._focalPickerReset === "function") {
    window._focalPickerReset();
  }
}

/**
 * Confirm focal point selection and invoke the picker callback
 */
function confirmFocalPoint() {
  if (!window._focalPickerCallback) return;
  // Use image-space values stored by applyToUI (marker.style is wrap-space after letterbox correction)
  const v = window._focalPickerValue || { x: 50, y: 50 };
  const callback = window._focalPickerCallback;
  closeFocalPointPicker();
  callback({ x: v.x, y: v.y });
}

// ============= TIME PICKER =============

function openTimePicker(anchorEl, currentValue, callback) {
  closeTimePicker();

  let initH = 10, initM = 0;
  if (currentValue && /^\d{1,2}:\d{2}$/.test(currentValue)) {
    const [h, m] = currentValue.split(':').map(Number);
    initH = h; initM = m;
  }

  const ITEM_H = 32;
  const VISIBLE = 5;
  const COL_H = ITEM_H * VISIBLE;
  const PAD = ITEM_H * Math.floor(VISIBLE / 2);
  const CYCLES = 7; // enough to scroll freely without hitting edge
  const H_COUNT = 24, M_COUNT = 60;

  // Render CYCLES repetitions for infinite wrap illusion
  const makeItems = (count) => Array.from({ length: count * CYCLES }, (_, i) =>
    `<div style="height:${ITEM_H}px;scroll-snap-align:center;font-size:0.875rem;display:flex;align-items:center;justify-content:center;font-weight:500;color:#1f2937;user-select:none">${String(i % count).padStart(2, '0')}</div>`
  ).join('');

  const colHtml = (id, count) => `
    <div style="position:relative;flex:1;height:${COL_H}px">
      <div style="position:absolute;left:0;right:0;top:0;height:${PAD}px;background:linear-gradient(to bottom,white,rgba(255,255,255,0));z-index:2;pointer-events:none"></div>
      <div style="position:absolute;left:0;right:0;bottom:0;height:${PAD}px;background:linear-gradient(to top,white,rgba(255,255,255,0));z-index:2;pointer-events:none"></div>
      <div style="position:absolute;left:0;right:0;top:50%;transform:translateY(-50%);height:${ITEM_H}px;border-top:1.5px solid #fda4af;border-bottom:1.5px solid #fda4af;border-radius:6px;background:rgba(255,241,242,0.7);z-index:1;pointer-events:none"></div>
      <div id="${id}" style="height:100%;overflow-y:scroll;scroll-snap-type:y mandatory;scrollbar-width:none;-ms-overflow-style:none">
        <div style="padding:${PAD}px 0">${makeItems(count)}</div>
      </div>
    </div>`;

  const popup = document.createElement('div');
  popup.id = 'tp-popup';
  popup.style.cssText = 'position:fixed;z-index:99999;background:white;border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,0.15),0 2px 6px rgba(0,0,0,0.08);overflow:hidden;width:160px';
  popup.innerHTML = `
    <div style="display:flex;align-items:center;padding:8px 10px 0;gap:0">
      ${colHtml('tp-hours', H_COUNT)}
      <div style="flex-shrink:0;font-size:1rem;font-weight:300;color:#d1d5db;padding:0 3px">:</div>
      ${colHtml('tp-minutes', M_COUNT)}
    </div>
    <div class="flex gap-1.5 px-2.5 pb-2.5 pt-1.5">
      <button id="tp-cancel" type="button" class="flex-1 h-8 border border-gray-200 rounded-lg text-xs text-gray-500 bg-white cursor-pointer hover:bg-gray-50 transition-colors">Hủy</button>
      <button id="tp-confirm" type="button" class="flex-1 h-8 bg-rose-500 rounded-lg text-xs font-semibold text-white cursor-pointer hover:bg-rose-600 transition-colors">Xác nhận</button>
    </div>`;

  if (!document.getElementById('tp-scrollbar-css')) {
    const s = document.createElement('style');
    s.id = 'tp-scrollbar-css';
    s.textContent = '#tp-hours::-webkit-scrollbar,#tp-minutes::-webkit-scrollbar{display:none}';
    document.head.appendChild(s);
  }

  document.body.appendChild(popup);

  // Position below/above anchor
  const rect = anchorEl.getBoundingClientRect();
  const popH = COL_H + 8 + 30 + 16;
  const spaceBelow = window.innerHeight - rect.bottom;
  popup.style.top = (spaceBelow >= popH + 8 ? rect.bottom + 6 : rect.top - popH - 6) + 'px';
  popup.style.left = Math.max(8, Math.min(rect.left, window.innerWidth - 168)) + 'px';

  const hEl = document.getElementById('tp-hours');
  const mEl = document.getElementById('tp-minutes');
  const midCycle = Math.floor(CYCLES / 2);

  // Start at middle cycle so user can freely wrap both directions
  hEl.scrollTop = (midCycle * H_COUNT + initH) * ITEM_H;
  mEl.scrollTop = (midCycle * M_COUNT + initM) * ITEM_H;

  // After scroll settles, silently snap back to middle cycle (creates infinite wrap)
  function setupWrap(el, count) {
    let t;
    el.addEventListener('scroll', () => {
      clearTimeout(t);
      t = setTimeout(() => {
        const raw = Math.round(el.scrollTop / ITEM_H);
        const real = ((raw % count) + count) % count;
        const target = (midCycle * count + real) * ITEM_H;
        if (Math.abs(el.scrollTop - target) > 1) el.scrollTop = target;
      }, 120);
    }, { passive: true });
  }
  setupWrap(hEl, H_COUNT);
  setupWrap(mEl, M_COUNT);

  window._timePickerCallback = callback;

  function apply() {
    const rawH = Math.round(hEl.scrollTop / ITEM_H);
    const rawM = Math.round(mEl.scrollTop / ITEM_H);
    const h = ((rawH % H_COUNT) + H_COUNT) % H_COUNT;
    const m = ((rawM % M_COUNT) + M_COUNT) % M_COUNT;
    const val = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    if (typeof window._timePickerCallback === 'function') {
      window._timePickerCallback(val);
      window._timePickerCallback = null;
    }
    closeTimePicker();
  }

  document.getElementById('tp-confirm').addEventListener('click', apply);
  document.getElementById('tp-cancel').addEventListener('click', closeTimePicker);

  setTimeout(() => {
    document.addEventListener('mousedown', _onTpOutside);
    document.addEventListener('touchstart', _onTpOutside, { passive: true });
  }, 0);
}

function _onTpOutside(e) {
  const popup = document.getElementById('tp-popup');
  if (popup && !popup.contains(e.target)) closeTimePicker();
}

function closeTimePicker() {
  const popup = document.getElementById('tp-popup');
  if (popup) popup.remove();
  document.removeEventListener('mousedown', _onTpOutside);
  document.removeEventListener('touchstart', _onTpOutside);
  window._timePickerCallback = null;
}

// ============= DISABLE MOBILE ZOOM =============
(function () {
  const opts = { passive: false };
  ["gesturestart", "gesturechange", "gestureend"].forEach(function (t) {
    document.addEventListener(t, function (e) { e.preventDefault(); }, opts);
  });
  document.addEventListener("touchmove", function (e) {
    if (e.touches.length > 1) e.preventDefault();
  }, opts);
  document.addEventListener("dblclick", function (e) { e.preventDefault(); });
  document.documentElement.style.touchAction = "manipulation";

  // iOS Safari: reset viewport after keyboard dismissal to prevent stuck-zoom state
  document.addEventListener("focusout", function () {
    window.setTimeout(function () {
      window.scrollTo(window.pageXOffset, window.pageYOffset);
    }, 100);
  });
})();

// ============= PREVIEW NAVBAR =============
// Khi navigate thẳng qua URL ?preview=true (từ trang chủ), hiển thị bottom navbar
(function initPreviewNavbar() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("preview") !== "true") return;
  if (params.get("source") === "live") return;
  if (params.get("embedded") === "true") return;

  // Lấy tên theme từ URL path: /public/themes/basic-gold/ → basic-gold
  const pathParts = window.location.pathname.replace(/\/$/, "").split("/").filter(Boolean);
  const themeName = pathParts[pathParts.length - 1] || "basic-gold";
  const themeDisplay = themeName.split("-").map(function (w) {
    return w.charAt(0).toUpperCase() + w.slice(1);
  }).join(" ");

  function _generateUUID() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
    });
  }

  function _chooseTheme() {
    var uuid = _generateUUID();
    try {
      localStorage.setItem(
        "cuoixinh_draft_" + uuid,
        JSON.stringify({ theme: themeName, is_published: false, _localOnly: true })
      );
    } catch (e) {}
    sessionStorage.setItem("draft_theme", themeName);
    sessionStorage.setItem("draft_template_name", themeDisplay);
    sessionStorage.setItem("show_tour", "1");
    window.location.href = "/invitation-setup/?id=" + uuid;
  }

  var NAVBAR_H = 56;

  var navbar = document.createElement("div");
  navbar.id = "preview-nav";
  navbar.className = "fixed bottom-0 left-1/2 -translate-x-1/2 z-[9999] w-full max-w-[430px] md:max-w-[768px] flex items-center justify-end gap-2.5 px-4 py-2.5 bg-white/95 backdrop-blur border-t border-rose-100";
  navbar.style.cssText = "padding-bottom:calc(10px + env(safe-area-inset-bottom,0px));box-shadow:0 -4px 24px rgba(180,80,110,0.10);";

  navbar.innerHTML =
    '<button id="pnav-close" class="flex items-center gap-1 px-3 h-8 rounded-full border border-rose-100 bg-transparent text-xs font-medium text-[#a07080] whitespace-nowrap shrink-0 cursor-pointer hover:bg-rose-50 transition-colors">' +
    '  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>' +
    '  Quay lại' +
    '</button>' +
    '<button id="pnav-choose" class="flex items-center gap-1.5 px-4 h-8 rounded-full text-xs font-bold text-white whitespace-nowrap cursor-pointer hover:opacity-90 transition-opacity" style="background:linear-gradient(135deg,#f472a0,#e05585);box-shadow:0 3px 10px rgba(224,85,133,0.3);">' +
    '  Dùng mẫu này' +
    '  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>' +
    '</button>';

  function _mount() {
    document.body.appendChild(navbar);
    document.body.style.paddingBottom = (navbar.offsetHeight || NAVBAR_H) + "px";

    var musicBtn = document.getElementById("music-toggle");
    if (musicBtn) musicBtn.style.bottom = ((navbar.offsetHeight || NAVBAR_H) + 8) + "px";

    document.getElementById("pnav-close").addEventListener("click", function () { history.back(); });
    document.getElementById("pnav-choose").addEventListener("click", _chooseTheme);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", _mount);
  } else {
    _mount();
  }
})();
