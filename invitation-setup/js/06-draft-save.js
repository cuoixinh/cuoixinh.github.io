// Tự động lưu nháp, thanh toán bản nháp, mã hoá và mở màn khách mời.
//
// Tách từ index.js (dòng 1385–1546 bản gốc). Thứ tự nạp khai báo ở loader.js.

// ============= AUTO-SAVE =============
let _autoSaveTimer = null;

function _doAutoSave() {
  const form = document.getElementById("wedding-form");
  if (!form) return;

  const formData = new FormData(form);
  const payload = {
    id: WEDDING_ID,
    slug: WEDDING_SLUG,
    theme: WEDDING_THEME,
    is_active: true,
    theme_setting: _themeSetting,
  };

  formData.forEach((value, key) => {
    if (key === "gallery_images_raw" || key === "slug") return;
    if (typeof value !== "string") return;
    if (value.trim()) {
      payload[key] = value.trim();
    } else if (key.includes("_url") || key.includes("_lunar")) {
      payload[key] = null;
    }
  });

  // YouTube music — URL thật nằm ở thẻ ẩn (#music-url-input); input chỉ hiện tên bài
  payload.music_url =
    document.getElementById("music-url-input")?.value?.trim() || null;

  // Câu mẫu chia sẻ (ngoài <form>)
  payload.share_message_template =
    document.getElementById("share-message-template")?.value?.trim() || null;

  // Gallery (filenames đã lưu — pending uploads là blob trong memory, ko thể lưu localStorage)
  const galleryTA = document.querySelector(
    'textarea[name="gallery_images_raw"]',
  );
  payload.gallery_images = galleryTA
    ? galleryTA.value.trim().split("\n").filter(Boolean)
    : [];

  saveLocalDraft(payload);
  _syncLocalOrder(); // bản nháp cũng hiện trong "Đơn hàng" (khách: guestOrders) ngay khi đã có tên
}

// tab: tab nào bị sửa để gắn dấu * đúng chỗ ("edit" mặc định — form chính)
function _scheduleAutoSave(tab = "edit") {
  _setDirty(true, tab);
  // Đã mua thiệp (đã thanh toán, is_published = true) → không auto-save nữa
  if (IS_PUBLISHED) return;
  clearTimeout(_autoSaveTimer);
  _autoSaveTimer = setTimeout(_doAutoSave, 1500);
}

function _initAutoSave() {
  const form = document.getElementById("wedding-form");
  if (!form) return;
  // Bọc arrow để không truyền event làm tham số tab
  form.addEventListener("input", () => _scheduleAutoSave("edit"));
  form.addEventListener("change", () => _scheduleAutoSave("edit"));
}

// ============= DRAFT PAYMENT =============

function openPaymentForDraft() {
  setStep(4);
  const templateName =
    sessionStorage.getItem("draft_template_name") || "Thiệp Cưới";
  PaymentModal.open(templateName, WEDDING_THEME, {}, WEDDING_ID);
}

// ============= ENCRYPTION/DECRYPTION FUNCTIONS =============

function encryptData(text) {
  if (!text) return "";
  try {
    const encrypted = CryptoJS.AES.encrypt(text, ENCRYPTION_KEY).toString();
    // Make URL-safe by encoding to Base64
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

// ============= GUESTS PAGE ===============

let _guestsIframeLoadedId = null;

function openGuestsPage(e) {
  if (e) e.preventDefault();
  if (!WEDDING_ID) {
    showToast("⚠️ Cần lưu thiệp trước khi quản lý khách mời");
    return;
  }

  // Lưu tab vào URL mà không reload
  const _url = new URL(window.location.href);
  _url.searchParams.set("tab", "guests");
  history.replaceState(null, "", _url);

  const formPanel = document.getElementById("form-panel");
  const previewPanel = document.getElementById("preview-panel");
  const configPanel = document.getElementById("config-panel");
  const guestsPanel = document.getElementById("guests-panel");

  // Chưa xuất bản → hiện lớp khoá; đã xuất bản → nạp iframe quản lý khách mời
  _updateGuestsPanelLock();

  _isPreviewActive = false;
  formPanel.classList.add("hidden");
  previewPanel.classList.add("hidden");
  configPanel.classList.add("hidden");
  if (guestsPanel) guestsPanel.classList.remove("hidden");
  _setActiveTab("guests");
}

// Đồng bộ lớp khoá / iframe của panel khách mời theo trạng thái xuất bản
function _updateGuestsPanelLock() {
  const guestsLock = document.getElementById("guests-lock");
  const iframe = document.getElementById("guests-iframe");
  if (!IS_PUBLISHED) {
    // Chưa xuất bản: khoá tính năng, không nạp iframe
    if (guestsLock) {
      guestsLock.classList.remove("hidden");
      guestsLock.classList.add("flex");
    }
    if (iframe) iframe.classList.add("hidden");
  } else {
    if (guestsLock) {
      guestsLock.classList.add("hidden");
      guestsLock.classList.remove("flex");
    }
    if (iframe) {
      iframe.classList.remove("hidden");
      if (_guestsIframeLoadedId !== WEDDING_ID) {
        iframe.src = `guests/?id=${WEDDING_ID}&embed=1`;
        _guestsIframeLoadedId = WEDDING_ID;
      }
    }
  }
  if (window.lucide) lucide.createIcons();
}

// Gọi từ trong iframe guests (nút quay lại) để về màn chỉnh sửa mà không load trang
function exitGuestsPanel() {
  switchTab("edit");
}

