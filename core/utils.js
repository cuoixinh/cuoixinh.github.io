// ============================================================
// UTILS.JS - Shared utility functions for all templates
// ============================================================

// ============= CONFIGURATION =============
const ENCRYPTION_KEY = CONFIG.security.encryptionKey;
const STORAGE_BASE_URL = CONFIG.cloudflare.imageProxy || CONFIG.supabase.storageUrl;

// ============= DOM HELPERS =============

/** Escape ký tự HTML — dùng khi buộc phải ghép chuỗi vào innerHTML. */
function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function setText(id, value, placeholder = "") {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = value || placeholder;
  // Đánh dấu "văn bản bind từ dữ liệu/thiết lập" để trình chỉnh giao diện KHÓA sửa
  // trực tiếp (muốn đổi phải vào tab Thiết lập). setText dùng chung mọi theme nên
  // 1 chỗ này phủ gần hết text bound.
  el.setAttribute("data-cx-bound", "1");
}

function setAttr(id, attr, value, placeholder = "") {
  const el = document.getElementById(id);
  if (!el) return;
  el.setAttribute(attr, value || placeholder);
}

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
      <text x="200" y="250" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" fill="#c0c0c0" font-weight="300" letter-spacing="0.5">${escapeHtml(text)}</text>
    </svg>
  `;
  return "data:image/svg+xml," + encodeURIComponent(svg);
}

// ============= MAP HELPERS =============

/** Lấy URL embed Google Maps sạch từ HTML iframe (hoặc trả lại nguyên URL). */
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

function isPreviewMode() {
  return window.location.search.includes("preview=true");
}

/**
 * Chặn thao tác GHI khi đang xem thử: hiện toast rồi trả về true để nơi gọi
 * `return` sớm. Thiệp THẬT thì trả về false ngay, không hiện gì.
 */
function showPreviewAlert() {
  if (!isPreviewMode()) return false;

  const toast = document.createElement("div");
  // Căn giữa bằng inset-x-0 + mx-auto, KHÔNG dùng -translate-x-1/2: keyframe
  // fadeIn cũng đặt `transform` (translateY) nên nó ghi đè phần dời trái 50% —
  // toast sẽ chạy từ mép phải rồi giật về giữa lúc animation kết thúc.
  // max-w hẹp để câu dài xuống dòng thay vì kéo thành một dải chữ vắt ngang màn.
  toast.className = "fixed top-5 inset-x-0 mx-auto w-max max-w-[240px] z-[10000] px-5 py-2.5 rounded-lg text-[13px] leading-snug text-center text-white shadow-md animate-fade-in";
  toast.style.background = "rgb(var(--card-blush-300-rgb)/0.95)";
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

function isGroomSide() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get("isGroom") !== "false";
}

// ============= EXPORT FOR GLOBAL USE =============
// All functions are already in global scope, no need to export

// ============= IMAGE CROP HELPERS =============

/**
 * Mở modal cắt ảnh QR (tỉ lệ 1:1). Có `giftInfo` thì xem trước theo kiểu block
 * Hộp Mừng Cưới (tên NH / STK / chủ TK).
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
          <div class="rounded-2xl p-4" style="background:linear-gradient(160deg,rgb(var(--surface-tint-rgb)),rgb(var(--surface-tint-warm-rgb)));">
            <div class="flex flex-col gap-1.5 items-center">
              <div id="crop-gift-label" class="text-[11px] text-[rgb(var(--text-caption-rgb))]">Chú Rể</div>
              <div class="bg-white rounded-2xl p-2 shadow-md">
                <div id="crop-preview" class="w-[92px] h-[92px] overflow-hidden"></div>
              </div>
              <div class="flex flex-col gap-0.5 items-center text-center max-w-full">
                <div id="crop-gift-bankname" class="text-[11px] text-[rgb(var(--text-label-rgb))] truncate max-w-[240px]">----------------</div>
                <div id="crop-gift-number" class="text-[13px] text-[rgb(var(--text-heading-rgb))] font-medium truncate max-w-[240px]">------------</div>
                <div id="crop-gift-owner" class="text-[12px] text-[rgb(var(--text-heading-rgb))] font-semibold truncate max-w-[240px]">--------------------</div>
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
      <x-button variant="outline" tone="neutral" onclick="closeCropModal()" class="flex-1">Hủy</x-button>
      <x-button onclick="applyCrop()" class="flex-1">
        <i data-icon="check" class="mr-1"></i>Áp dụng
      </x-button>
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
          <i data-icon="circle-alert" class="text-4xl text-red-500 mb-3"></i>
          <p class="text-sm text-red-600">Không thể tải ảnh</p>
        </div>
      `;
    };

    img.src = e.target.result;
  };

  reader.readAsDataURL(file);
}

/** Vuốt xuống để đóng bottom-sheet modal. Trả về hàm cleanup. */
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
 * Dựng khung bottom-sheet modal (overlay → handle → header → body → footer),
 * kèm khoá cuộn body, vuốt-để-đóng, nút X, z-index.
 * @returns {{body:HTMLElement, footer:HTMLElement, close:Function}|null}
 *   null nếu đã có modal trùng id.
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
  // Truyền qua biến --cx-sheet-h (kích thước ở .cx-sheet-card trong _common.css)
  // chứ KHÔNG ghép tên class `h-[...]` — class ghép từ chuỗi bị Tailwind purge,
  // thẻ mất chiều cao rồi nở theo nội dung và tràn khỏi màn hình.
  const mobileHeight = height.replace('vh', 'dvh');
  modal.innerHTML = `
    <div id="${id}-card" style="--cx-sheet-h:${mobileHeight}" class="cx-sheet-card bg-white rounded-t-2xl sm:rounded-2xl max-w-3xl w-full flex flex-col overflow-hidden shadow-2xl">
      <div class="flex justify-center items-center pt-2.5 pb-1 flex-shrink-0">
        <span class="w-10 h-1.5 rounded-full bg-gray-300"></span>
      </div>
      <div class="px-5 py-3 flex items-center justify-between flex-shrink-0">
        <h3 class="text-base font-semibold text-gray-800 flex items-center gap-2">${title}</h3>
        <x-button variant="ghost" tone="neutral" size="sm" icon-only type="button" id="${id}-x-btn">
          <svg class="w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </x-button>
      </div>
      <!-- Vạch ngăn header/nội dung thụt vào bằng lề nội dung (mx-5), không kẻ
           chạm mép modal — thẻ riêng chứ không phải border-b của header. -->
      <div class="mx-5 h-px bg-gray-200 flex-shrink-0"></div>
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
 * Mở bảng chọn điểm lấy nét: kéo điểm trên ảnh, xem trước ở 3 tỉ lệ thường gặp
 * (1:1, 16:9, 9:16). callback nhận {x, y} theo %.
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
        <div class="rounded-2xl p-4" style="background:linear-gradient(160deg,rgb(var(--surface-tint-rgb)),rgb(var(--surface-tint-warm-rgb)));">
          <div class="flex flex-col gap-1.5 items-center">
            <div id="focal-gift-label" class="text-[11px] text-[rgb(var(--text-caption-rgb))]">Chú Rể</div>
            <div class="bg-white rounded-2xl p-2 shadow-md">
              <img id="focal-preview-qr" src="" alt="" class="w-[92px] h-[92px] object-cover" />
            </div>
            <div class="flex flex-col gap-0.5 items-center text-center max-w-full">
              <div id="focal-gift-bankname" class="text-[11px] text-[rgb(var(--text-label-rgb))] truncate max-w-[240px]">----------------</div>
              <div id="focal-gift-number" class="text-[13px] text-[rgb(var(--text-heading-rgb))] font-medium truncate max-w-[240px]">------------</div>
              <div id="focal-gift-owner" class="text-[12px] text-[rgb(var(--text-heading-rgb))] font-semibold truncate max-w-[240px]">--------------------</div>
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
          <div id="focal-marker" class="absolute w-6 h-6 -ml-3 -mt-3 rounded-full border-2 border-white shadow-lg pointer-events-none" style="left:50%;top:50%;background-color:rgb(var(--brand-primary-rgb));"></div>
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
      <x-button variant="soft" onclick="resetFocalPoint()" class="text-sky-700">
        <svg class="w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
        Đặt lại
      </x-button>
      <div class="flex gap-2">
        <x-button variant="outline" tone="neutral" onclick="closeFocalPointPicker()">Hủy</x-button>
        <x-button onclick="confirmFocalPoint()">
          <svg class="w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
          Áp dụng
        </x-button>
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
    `<div style="height:${ITEM_H}px;scroll-snap-align:center;font-size:0.875rem;display:flex;align-items:center;justify-content:center;font-weight:500;color:rgb(var(--text-title-rgb));user-select:none">${String(i % count).padStart(2, '0')}</div>`
  ).join('');

  const colHtml = (id, count) => `
    <div style="position:relative;flex:1;height:${COL_H}px">
      <div style="position:absolute;left:0;right:0;top:0;height:${PAD}px;background:linear-gradient(to bottom,white,rgb(var(--white-rgb)/0));z-index:2;pointer-events:none"></div>
      <div style="position:absolute;left:0;right:0;bottom:0;height:${PAD}px;background:linear-gradient(to top,white,rgb(var(--white-rgb)/0));z-index:2;pointer-events:none"></div>
      <div style="position:absolute;left:0;right:0;top:50%;transform:translateY(-50%);height:${ITEM_H}px;border-top:1.5px solid rgb(var(--timeline-dot-rgb));border-bottom:1.5px solid rgb(var(--timeline-dot-rgb));border-radius:6px;background:rgb(var(--notice-bg-rgb)/0.7);z-index:1;pointer-events:none"></div>
      <div id="${id}" style="height:100%;overflow-y:scroll;scroll-snap-type:y mandatory;scrollbar-width:none;-ms-overflow-style:none">
        <div style="padding:${PAD}px 0">${makeItems(count)}</div>
      </div>
    </div>`;

  const popup = document.createElement('div');
  popup.id = 'tp-popup';
  popup.style.cssText = 'position:fixed;z-index:99999;background:white;border-radius:12px;box-shadow:0 8px 24px rgb(var(--scrim-rgb)/0.15),0 2px 6px rgb(var(--scrim-rgb)/0.08);overflow:hidden;width:160px';
  popup.innerHTML = `
    <div style="display:flex;align-items:center;padding:8px 10px 0;gap:0">
      ${colHtml('tp-hours', H_COUNT)}
      <div style="flex-shrink:0;font-size:1rem;font-weight:300;color:rgb(var(--divider-rgb));padding:0 3px">:</div>
      ${colHtml('tp-minutes', M_COUNT)}
    </div>
    <div class="flex gap-1.5 px-2.5 pb-2.5 pt-1.5">
      <x-button variant="outline" tone="neutral" size="sm" id="tp-cancel" type="button" class="flex-1">Hủy</x-button>
      <x-button size="sm" id="tp-confirm" type="button" class="flex-1">Xác nhận</x-button>
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

// ============= LỚP ĐỀ XUẤT Ở BẢN XEM THỬ =============
// Mở /public/themes/* với ?preview=true: cuộn tới mục mà mẫu khai ở
// CX_THEME.suggest thì các thẻ mẫu khác NỔI LÊN TRÊN thiệp (kiểu màn đề xuất
// cuối video của YouTube) — vuốt ngang để xem, dưới là hai việc (Về trang chủ ·
// Dùng ngay mẫu này), góc trên phải là nút Ẩn. Hình dạng khai ở .cx-sug* trong
// styles/_common.css; ở đây chỉ dựng khung, chọn mốc bung và nối sự kiện.
(function initPreviewSuggest() {
  const params = new URLSearchParams(window.location.search);

  // CHỈ chạy ở bản xem thử mẫu thiệp, không phải thiệp thật.
  if (params.get("preview") !== "true") return;

  // `source=live` = khung Xem trực tiếp của trang Thiết lập (04-nav-tabs.js):
  // khách đang soạn thiệp CỦA MÌNH, gợi ý đổi mẫu ở đó là lạc chỗ.
  if (params.get("source") === "live") return;

  // shell=0 + nằm trong iframe → đang chạy TRONG khung điện thoại của bản xem
  // trước trên máy tính. Đây mới là trang có cuộn nên bảng dựng ở đây, nhưng mọi
  // cú điều hướng phải nhờ trang ngoài làm — đổi URL của iframe thì khách kẹt
  // lại bên trong thân máy.
  const IN_SHELL = params.get("shell") === "0" && window.self !== window.top;

  // Nằm trong iframe của người khác (bản xem trước ở admin, hộp chọn mẫu…) mà
  // KHÔNG phải khung máy của mình → chỉ là ô xem hình, đừng chen gợi ý vào.
  if (window.self !== window.top && !IN_SHELL) return;

  // Trang khung máy (cùng điều kiện với _cxPreviewShell ở theme-boot.js): không
  // có gì để cuộn, chỉ đứng nghe lệnh của iframe bên trong.
  const IS_SHELL_HOST =
    params.get("shell") !== "0" &&
    window.self === window.top &&
    window.innerWidth >= 820;

  // Lấy tên theme từ URL path: /public/themes/basic-gold/ → basic-gold
  const pathParts = window.location.pathname.replace(/\/$/, "").split("/").filter(Boolean);
  const themeName = pathParts[pathParts.length - 1] || "basic-gold";

  function _display(slug) {
    return String(slug || "").split("-").map(function (w) {
      return w.charAt(0).toUpperCase() + w.slice(1);
    }).join(" ");
  }

  const themeDisplay = _display(themeName);

  // Tạo nháp — hoặc hỏi trước nếu khách còn thiệp làm dở. Dùng chung với nút
  // "Dùng ngay" ở trang chủ qua core/helpers/draft-start.js; trang thiệp phải
  // nạp file đó, thiếu là nút này không làm gì.
  function _chooseTheme(theme, display) {
    if (typeof cxStartDraft !== "function") {
      console.error("Thiếu core/helpers/draft-start.js");
      return;
    }
    const slug = theme || themeName;
    cxStartDraft(slug, display || _display(slug));
  }

  if (IS_SHELL_HOST) {
    window.addEventListener("message", function (e) {
      const d = e.data || {};
      if (d.type === "cx-sug-go" && typeof d.url === "string") window.location.href = d.url;
      else if (d.type === "cx-sug-use") _chooseTheme(d.theme, d.display);
    });
    return;
  }

  function _go(url) {
    if (IN_SHELL) return parent.postMessage({ type: "cx-sug-go", url: url }, "*");
    window.location.href = url;
  }

  function _use(theme, display) {
    if (IN_SHELL) {
      return parent.postMessage(
        { type: "cx-sug-use", theme: theme, display: display },
        "*"
      );
    }
    _chooseTheme(theme, display);
  }

  // Việc CHÍNH đứng cuối, tức gần ngón cái nhất. `go` = đường dẫn nội bộ.
  const SUG_ACTS = [
    { id: "sug-home", label: "Về trang chủ", icon: "home", go: "/" },
    {
      id: "sug-use",
      label: "Dùng ngay mẫu này",
      icon: "note",
      aria: "Tạo thiệp với mẫu này",
      primary: true,
    },
  ];

  // Hình học lấy NGUYÊN từ bộ icon lucide (house · square-pen · x)
  // rồi nhúng thẳng: trang thiệp không nạp thư viện lucide, kéo cả thư viện về
  // chỉ vì ba icon là không đáng — cùng cách landing đang làm với icon sparkles,
  // và cùng cách alert.js giữ bảng _LUCIDE_PATHS. Đừng tự vẽ lại cho "gần giống":
  // nét và bo góc của lucide đồng bộ với nhau, vẽ tay là lạc khỏi bộ.
  const SUG_ICONS = {
    home:
      '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/>' +
      '<path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    // "sticky-note-check": GHÉP từ hai glyph lucide có thật — thân + góc gấp của
    // `sticky-note`, cộng nét tick của `check` thu nhỏ đặt vào giữa tờ giấy.
    note:
      '<path d="M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11l5-5V5a2 2 0 0 0-2-2z"/>' +
      '<path d="M15 21v-4a2 2 0 0 1 2-2h4"/>' +
      '<path d="m8 11 2.4 2.4L15 8.8"/>',
    // eye: nút "Xem thử" trên từng thẻ mẫu — cặp đôi của eye-off bên dưới.
    eye:
      '<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/>' +
      '<circle cx="12" cy="12" r="3"/>',
    // eye-off: nút "Ẩn" ở góc trên phải, đúng glyph YouTube dùng cho việc tắt
    // màn đề xuất.
    hide:
      '<path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49"/>' +
      '<path d="M14.084 14.158a3 3 0 0 1-4.242-4.242"/>' +
      '<path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143"/>' +
      '<path d="m2 2 20 20"/>',
  };

  function _sugIcon(name, size) {
    return (
      '<svg xmlns="http://www.w3.org/2000/svg" width="' + (size || 15) +
      '" height="' + (size || 15) + '"' +
      ' viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"' +
      ' stroke-linecap="round" stroke-linejoin="round">' +
      (SUG_ICONS[name] || "") +
      "</svg>"
    );
  }

  function _esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  const panel = document.createElement("div");
  panel.id = "preview-suggest";
  panel.className = "cx-sug";
  // Chỉ có nghĩa khi người thật đang xem thử → bỏ khỏi ảnh scan mẫu thiệp
  // (scripts/capture.js).
  panel.setAttribute("data-no-scan", "");
  panel.innerHTML =
    '<div class="cx-sug-bar">' +
    // Tiêu đề chỉ hiện khi đã có thẻ — tải hỏng mà vẫn còn dòng chữ trống trơn
    // thì trông như thiệp lỗi. Nút Ẩn thì luôn có, đẩy sang phải bằng margin
    // nên tiêu đề vắng mặt cũng không kéo nó về giữa.
    '<span class="cx-sug-title" id="sug-title" style="display:none">' +
    "Các mẫu bạn có thể sẽ thích</span>" +
    '<button type="button" id="sug-close" class="cx-sug-hide"' +
    ' aria-label="Ẩn gợi ý mẫu thiệp">' +
    _sugIcon("hide", 14) + "Ẩn</button>" +
    "</div>" +
    '<div class="cx-sug-row" id="sug-row"></div>' +
    '<div class="cx-sug-dots" id="sug-dots"></div>' +
    '<div class="cx-sug-acts">' +
    SUG_ACTS.map(function (it) {
      return (
        '<x-button variant="bare" id="' + it.id + '"' +
        ' class="cx-sug-btn' + (it.primary ? " cx-sug-primary" : "") + '"' +
        ' aria-label="' + (it.aria || it.label) + '">' +
        '<span class="cx-sug-ico">' + _sugIcon(it.icon) + "</span>" +
        it.label +
        "</x-button>"
      );
    }).join("") +
    "</div>";

  // --- DANH SÁCH MẪU KHÁC ---
  // Nạp một lần, đúng lần lớp phủ bung ra đầu tiên: khách chưa xem tới đó thì
  // request này không tranh băng thông với ảnh thiệp.
  let loaded = false;

  function _loadThemes() {
    if (loaded) return;
    loaded = true;

    // Cùng nguồn với trang chủ (js/templates-data.js): Worker cache nếu có,
    // không thì Edge Function `public-templates`. KHÔNG gọi thẳng REST của
    // Supabase — mọi truy vấn bảng đều phải đi qua Edge Function.
    const cacheUrl = CONFIG.cloudflare && CONFIG.cloudflare.templatesCache;
    const req = cacheUrl
      ? fetch(cacheUrl + "/")
      : fetch(CONFIG.supabase.edgeUrl + "?resource=public-templates", {
          headers: { Authorization: "Bearer " + CONFIG.supabase.anonKey },
        });

    req
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (rows) {
        const all = (rows || [])
          .map(function (t) {
            return {
              theme: t.theme,
              name: t.name,
              desc: t.description,
              cat: t.category,
              url: t.previewUrl,
            };
          })
          .filter(function (t) { return t.theme; });

        // Gợi ý theo THỂ LOẠI của mẫu đang xem, lấy hết chứ không cắt bớt:
        // khách vào xem một mẫu vintage thì thứ đáng gợi ý là các mẫu vintage
        // còn lại. Mẫu đang xem không nằm trong danh sách (nó ở ngay đây rồi).
        const cur = all.filter(function (t) { return t.theme === themeName; })[0];
        const rest = all.filter(function (t) { return t.theme !== themeName; });
        const same = cur && cur.cat
          ? rest.filter(function (t) { return t.cat === cur.cat; })
          : [];

        // Thể loại chỉ có mỗi mẫu đang xem thì thà gợi ý mẫu khác thể loại còn
        // hơn không gợi ý gì.
        _renderThemes(same.length ? same : rest);
      })
      .catch(function () {
        // Mất mạng thì chỉ mất dãy thẻ, hai nút hành động vẫn dùng được — cho
        // phép thử lại ở lần bung sau.
        loaded = false;
      });
  }

  // Hai việc làm được với MỘT mẫu trong dãy, bày ngay trên thẻ: xem thử mẫu đó
  // (giống bấm cả thẻ) và tạo nháp bằng mẫu đó luôn — khách ưng ngay tấm ảnh
  // thì khỏi phải mở mẫu ra mới bấm được "Dùng ngay" ở đáy.
  const SUG_CARD_ACTS = [
    { act: "view", label: "Xem thử", icon: "eye" },
    { act: "use", label: "Dùng mẫu", icon: "note", primary: true },
  ];

  // Thẻ dùng ẢNH CHỤP SẴN của mẫu (/assets/images/templates/*.jpg) — cùng bộ
  // ảnh với lưới mẫu ở trang chủ và /theme-template.
  function _renderThemes(list) {
    const row = document.getElementById("sug-row");
    if (!row) return;
    row.innerHTML = list
      .map(function (t) {
        const url = t.url || "/public/themes/" + t.theme + "/?preview=true";
        const name = t.name || t.theme;
        return (
          '<div class="cx-sug-card" role="button" tabindex="0"' +
          ' data-url="' + _esc(url) + '"' +
          ' data-theme="' + _esc(t.theme) + '"' +
          ' data-name="' + _esc(name) + '"' +
          ' aria-label="Xem mẫu ' + _esc(name) + '">' +
          '<img src="/assets/images/templates/' + _esc(t.theme) + '.jpg"' +
          ' alt="" loading="lazy" />' +
          '<div class="cx-sug-info">' +
          '<p class="cx-sug-name">' + _esc(name) + "</p>" +
          '<p class="cx-sug-desc">' + _esc(t.desc || "") + "</p>" +
          '<div class="cx-sug-mini flex-col">' +
          SUG_CARD_ACTS.map(function (a) {
            return (
              '<x-button variant="bare" data-act="' + a.act + '"' +
              ' class="cx-sug-mini-btn' + (a.primary ? " is-primary" : "") + '"' +
              ' aria-label="' + _esc(a.label + " " + name) + '">' +
              '<span class="cx-sug-ico">' + _sugIcon(a.icon, 12) + "</span>" +
              a.label +
              "</x-button>"
            );
          }).join("") +
          "</div>" +
          "</div>" +
          "</div>"
        );
      })
      .join("");

    const title = document.getElementById("sug-title");
    if (title) title.style.display = list.length ? "" : "none";

    const cards = Array.from(row.querySelectorAll(".cx-sug-card"));
    cards.forEach(function (card) {
      card.addEventListener("click", function () { _go(card.dataset.url); });
      // Cả thẻ là một nút → nút con phải chặn nổi bọt, không thì bấm "Dùng mẫu"
      // vừa tạo nháp vừa điều hướng sang trang xem thử.
      card.querySelectorAll("[data-act]").forEach(function (btn) {
        btn.addEventListener("click", function (e) {
          e.stopPropagation();
          if (btn.dataset.act === "use") _use(card.dataset.theme, card.dataset.name);
          else _go(card.dataset.url);
        });
      });
      card.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          _go(card.dataset.url);
        }
      });
    });

    _buildDots(row, cards);
  }

  // Chấm dưới dãy thẻ: một chấm một thẻ, bấm thì cuộn tới thẻ đó. Chỉ số thẻ
  // đang xem suy ra bằng cách so `offsetLeft` với vị trí cuộn — chắc chắn hơn
  // là chia cho bề ngang thẻ, vì thẻ đầu/cuối còn có padding của dãy.
  // Một thẻ thì không cần chấm nào.
  function _buildDots(row, cards) {
    const dots = document.getElementById("sug-dots");
    if (!dots) return;

    if (cards.length < 2) {
      dots.innerHTML = "";
      dots.style.display = "none";
      return;
    }
    dots.style.display = "";
    dots.innerHTML = cards
      .map(function (_, i) {
        return (
          '<button type="button" class="cx-sug-dot' + (i ? "" : " is-on") + '"' +
          ' aria-label="Mẫu thứ ' + (i + 1) + '"></button>'
        );
      })
      .join("");

    const items = Array.from(dots.children);

    function _sync() {
      let best = 0;
      let min = Infinity;
      cards.forEach(function (c, i) {
        const d = Math.abs(c.offsetLeft - row.scrollLeft);
        if (d < min) {
          min = d;
          best = i;
        }
      });
      items.forEach(function (d, i) {
        d.classList.toggle("is-on", i === best);
      });
    }

    row.addEventListener("scroll", _sync, { passive: true });
    items.forEach(function (d, i) {
      d.addEventListener("click", function () {
        row.scrollTo({ left: cards[i].offsetLeft, behavior: "smooth" });
      });
    });
  }

  // --- MỐC BUNG BẢNG ---
  // Mỗi mẫu tự khai `CX_THEME.suggest` = selector của mục mà bảng phải bung ra
  // khi khách cuộn tới. Mặc định là hộp mừng cưới — mục gần cuối thiệp ở mọi
  // mẫu hiện có. Bung rồi thì ĐỨNG YÊN: chỉ nút X mới đóng, cuộn ngược lên
  // không thu lại (khách đang cân nhắc mẫu khác, giật bảng đi là mất mạch).
  const SUG_ANCHOR = "#section-gift";
  let dismissed = false;

  function _open() {
    if (dismissed || panel.classList.contains("is-open")) return;
    panel.classList.add("is-open");
    _loadThemes();
  }

  function _close() {
    panel.classList.remove("is-open");
  }

  // Mốc dự phòng khi mục được khai KHÔNG có thật hoặc bị tắt (enable_gift =
  // false): lấy mục hiển thị cuối cùng, để bảng vẫn có lúc xuất hiện.
  function _lastSection() {
    const host = document.getElementById("main-card") || document.body;
    return Array.from(host.querySelectorAll("section"))
      .filter(function (el) {
        return el.offsetParent !== null && el.offsetHeight > 0;
      })
      .pop();
  }

  let watched = null;
  let watcher = null;

  function _watch(el) {
    if (!el || el === watched || !("IntersectionObserver" in window)) return;
    if (watcher) watcher.disconnect();
    watched = el;
    watcher = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        watcher.disconnect();
        _open();
      });
    });
    watcher.observe(el);
  }

  function _hidden(el) {
    return !el || el.offsetParent === null || el.offsetHeight === 0;
  }

  function _mount() {
    document.body.appendChild(panel);

    document.getElementById("sug-close").addEventListener("click", function () {
      dismissed = true;
      _close();
    });

    SUG_ACTS.forEach(function (it) {
      const el = document.getElementById(it.id);
      if (!el) return;
      el.addEventListener("click", function () {
        if (it.primary) return _use();
        _go(it.go);
      });
    });

    // Markup của mục có sẵn từ đầu nên bám được ngay; mục bị `display:none` cũng
    // bám được — IntersectionObserver chỉ báo khi nó hiện ra và lọt vào tầm
    // nhìn, đúng thứ mình cần.
    const T = window.CX_THEME || {};
    _watch(document.querySelector(T.suggest || SUG_ANCHOR));

    // Mục được khai có thể bị TẮT theo dữ liệu thiệp (enable_gift = false) —
    // chỉ sau khi API trả dữ liệu mới biết. Lúc đó chuyển sang mốc dự phòng,
    // nếu không thì bảng chẳng bao giờ bung.
    setTimeout(function () {
      if (!panel.classList.contains("is-open") && _hidden(watched)) {
        _watch(_lastSection());
      }
    }, 2500);

    // Mở/đóng bằng tay — để thử nhanh trong console, và cho mẫu nào muốn tự
    // quyết định lúc nào là đúng lúc.
    window.cxSuggest = {
      show: function () {
        dismissed = false;
        _open();
      },
      hide: _close,
    };
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", _mount);
  } else {
    _mount();
  }
})();
