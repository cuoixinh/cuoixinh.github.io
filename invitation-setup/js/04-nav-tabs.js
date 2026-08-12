// Gom dữ liệu cho preview, chuyển tab thanh dưới và trạng thái dirty (*).
//
// Tách từ index.js (dòng 501–815 bản gốc). Thứ tự nạp khai báo ở loader.js.

// ============= PREVIEW WITH REAL DATA =============

let _isPreviewActive = false;

function _savePreviewData() {
  const form = document.getElementById("wedding-form");
  if (!form) return;

  const IMAGE_FIELDS = [
    "cover_image_url",
    "groom_image_url",
    "bride_image_url",
    "groom_qr_url",
    "bride_qr_url",
  ];
  const data = {
    is_active: true,
    theme: WEDDING_THEME,
    slug: WEDDING_SLUG,
    theme_setting: _themeSetting,
  };

  // Collect text fields; convert image filenames → full URLs
  const formData = new FormData(form);
  formData.forEach((value, key) => {
    if (key === "gallery_images_raw" || key === "slug") return;
    if (!value || typeof value !== "string" || !value.trim()) return;
    const v = value.trim();
    data[key] = IMAGE_FIELDS.includes(key) ? getImageUrl(v) : v;
  });

  // Nhạc nền: #music-url-input nằm trong config-panel, NGOÀI <form id="wedding-form">
  // nên FormData ở trên không thấy. Không gửi tay thì preview luôn thiếu music_url
  // → setupMusic() ẩn nút nhạc và không phát gì dù đã chọn bài ở tab Thiết lập.
  const musicUrl = document
    .getElementById("music-url-input")
    ?.value?.trim();
  if (musicUrl) data.music_url = musicUrl;

  // Override single images with pending blob URLs (unsaved new files)
  for (const [field, file] of Object.entries(pendingUploads.singleImages)) {
    data[field] = URL.createObjectURL(file);
  }

  // Gallery: existing filenames → full URLs
  const galleryTextarea = form.querySelector('[name="gallery_images_raw"]');
  const existingFilenames = galleryTextarea
    ? galleryTextarea.value.trim().split("\n").filter(Boolean)
    : [];
  const existingGalleryUrls = existingFilenames.map((f) => getImageUrl(f));

  // Gallery: pending files → blob URLs
  const pendingGalleryUrls = pendingUploads.galleryImages.map((f) =>
    URL.createObjectURL(f),
  );

  const allGalleryUrls = [...existingGalleryUrls, ...pendingGalleryUrls];
  if (allGalleryUrls.length) data.gallery_images = allGalleryUrls;

  // Build image_focal_points (single images + gallery with URL keys)
  const focalPoints = {
    cover_image_url: pendingFocalPoints.cover_image_url,
    groom_image_url: pendingFocalPoints.groom_image_url,
    bride_image_url: pendingFocalPoints.bride_image_url,
    groom_qr_url: pendingFocalPoints.groom_qr_url,
    bride_qr_url: pendingFocalPoints.bride_qr_url,
    gallery_images: {},
  };
  existingFilenames.forEach((filename, i) => {
    const fp = pendingFocalPoints.gallery_images.get(filename);
    if (fp) focalPoints.gallery_images[existingGalleryUrls[i]] = fp;
  });
  pendingUploads.galleryImages.forEach((file, i) => {
    const fp = pendingFocalPoints.gallery_images.get(file);
    if (fp) focalPoints.gallery_images[pendingGalleryUrls[i]] = fp;
  });
  data.image_focal_points = focalPoints;

  // love_story & timeline là mảng JSONB: FormData chỉ lấy được CHUỖI JSON từ
  // hidden input nên phải ghi đè bằng mảng thật; ảnh mốc chưa lưu → blob URL để
  // preview thấy ngay.
  data.timeline = _timelineItems.map((it) => ({ ...it }));
  data.love_story = _loveStoryItems.map((it, idx) => {
    const pending = _loveStoryPendingImages[idx];
    return {
      ...it,
      image_url: pending ? URL.createObjectURL(pending) : it.image_url || null,
    };
  });

  sessionStorage.setItem("preview_data", JSON.stringify(data));
}

// ============= LINK CHO QR "XEM TRÊN ĐIỆN THOẠI" =============

// Preview đọc dữ liệu từ sessionStorage của trình duyệt này, nên URL iframe quét
// bằng máy khác chỉ ra bản demo. Máy khác chỉ xem được khi thiệp đã nằm trên hệ
// thống → trả link thiệp thật, chưa lưu DB thì trả "" để iframe ẩn mã QR đi.
function _mobilePreviewUrl() {
  if (_isLocalDraft || !WEDDING_SLUG) return "";
  // Clean URL (/slug) do 404.html của GitHub Pages điều hướng — chạy local không
  // có nên trỏ thẳng vào theme để quét từ điện thoại trong cùng mạng LAN vẫn mở được.
  const isLocal = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  const slug = encodeURIComponent(WEDDING_SLUG);
  return isLocal
    ? `${DOMAIN}/public/themes/${WEDDING_THEME}/?slug=${slug}&isGroom=true`
    : `${DOMAIN}/${slug}?isGroom=true`;
}

// src iframe preview. extra: tham số riêng của từng tab (vd "&edit=1").
function _previewIframeSrc(extra = "") {
  const qrUrl = _mobilePreviewUrl();
  const qrParam = qrUrl ? `&qr=${encodeURIComponent(qrUrl)}` : "";
  return `/public/themes/${WEDDING_THEME}/?preview=true&source=live${extra}&isGroom=true${qrParam}&t=${Date.now()}`;
}

// Lưu xong trong lúc đang mở tab Xem trước mà link QR đổi (thiệp lần đầu lên hệ
// thống, hoặc đổi slug) → nạp lại iframe cho QR trỏ đúng. Link không đổi thì thôi:
// điện thoại vốn xem bản đã lưu gần nhất nên không cần reload sau mỗi lần lưu.
function _refreshPreviewQR() {
  const iframe = document.getElementById("preview-iframe");
  if (!_isPreviewActive || !iframe || !iframe.src) return;
  const currentQr =
    new URL(iframe.src, location.origin).searchParams.get("qr") || "";
  if (currentQr === _mobilePreviewUrl()) return;
  _savePreviewData();
  iframe.src = _previewIframeSrc();
}

// ============= BOTTOM NAV TABS =============

// Mục nav (.cx-navitem) → tab nó đại diện. Chỗ đứng của chúng do cxNavReflow()
// (js/21-shell.js) quyết định: đang ở navbar hay đã lùi vào popover "Tùy chọn".
const _NAV_ITEM_TABS = {
  "tab-config": "config",
  "tab-guests": "guests",
  "tab-theme": "theme",
};

let _activeTab = "edit";

function _inNavPop(el) {
  return !!el?.closest("#nav-more-pop");
}

/**
 * Vẽ lại trạng thái đang mở + dấu * cho các mục nav. Mục nào khuất trong popover
 * thì dội trạng thái lên nút "Tùy chọn" — popover đóng lại là không ai thấy.
 * js/21-shell.js gọi lại sau mỗi lần xếp chỗ.
 */
function _syncNavItemState() {
  let popActive = false;
  Object.entries(_NAV_ITEM_TABS).forEach(([id, tab]) => {
    const el = document.getElementById(id);
    if (!el) return;
    const on = tab === _activeTab;
    el.classList.toggle("is-active", on);
    if (on && _inNavPop(el)) popActive = true;
  });
  document.getElementById("nav-more")?.classList.toggle("is-active", popActive);
  _updateDirtyMarks();
}

function _setActiveTab(tabId) {
  _activeTab = tabId;
  _syncNavItemState();

  // Segmented switch: ẩn focus khi ở tab config/khách mời
  const editBtn = document.getElementById("switch-edit");
  const previewBtn = document.getElementById("switch-preview");
  if (!editBtn || !previewBtn) return;

  // Từ 820px trở lên nút này là một TAB như Cấu hình (xem #switch-edit trong
  // styles/_setup.css) — chỗ đó đọc .is-active để gạch trên và tô màu.
  editBtn.classList.toggle("is-active", tabId === "edit");
  if (tabId === "config" || tabId === "guests" || tabId === "theme") {
    editBtn.classList.remove(
      "bg-white",
      "shadow-sm",
      "text-gray-700",
      "font-semibold",
    );
    editBtn.classList.add("text-gray-400", "font-medium");
    previewBtn.classList.remove(
      "bg-white",
      "shadow-sm",
      "text-rose-500",
      "font-semibold",
    );
    previewBtn.classList.add("text-gray-400", "font-medium");
  } else if (tabId === "preview") {
    previewBtn.classList.add(
      "bg-white",
      "shadow-sm",
      "text-rose-500",
      "font-semibold",
    );
    previewBtn.classList.remove("text-gray-400", "font-medium");
    editBtn.classList.remove(
      "bg-white",
      "shadow-sm",
      "text-gray-700",
      "font-semibold",
    );
    editBtn.classList.add("text-gray-400", "font-medium");
  } else {
    editBtn.classList.add(
      "bg-white",
      "shadow-sm",
      "text-gray-700",
      "font-semibold",
    );
    editBtn.classList.remove("text-gray-400", "font-medium");
    previewBtn.classList.remove(
      "bg-white",
      "shadow-sm",
      "text-rose-500",
      "font-semibold",
    );
    previewBtn.classList.add("text-gray-400", "font-medium");
  }
}

let _isDirty = false;
// Theo dõi dirty RIÊNG từng tab để dấu * chỉ hiện ở tab bị sửa: "edit" | "config" | "theme"
const _dirtyTabs = new Set();

function _setDirty(dirty, tab) {
  _isDirty = dirty;
  if (dirty) {
    if (tab) _dirtyTabs.add(tab);
  } else {
    _dirtyTabs.clear();
    _refreshPreviewQR();
  }

  // Mọi thay đổi trên trang đều đi qua đây → cũng là chỗ hẹn tải lại khung
  // "xem trực tiếp" (js/22-live-preview.js), khỏi phải rải listener từng nơi.
  if (dirty && typeof cxLiveTouch === "function") cxLiveTouch();

  const draft = document.getElementById("tab-draft");
  const publish = document.getElementById("tab-publish");

  if (draft) {
    draft.classList.toggle("border-rose-400", dirty);
    draft.classList.toggle("text-rose-500", dirty);
    draft.classList.toggle("bg-rose-50", dirty);
    draft.classList.toggle("border-gray-300", !dirty);
    draft.classList.toggle("text-gray-500", !dirty);
    draft.classList.toggle("bg-white", !dirty);
  }
  if (publish) {
    publish.classList.toggle("bg-rose-600", dirty);
    publish.classList.toggle("bg-rose-500", !dirty);
  }

  _updateDirtyMarks();
}

// Dấu * trên các tab (giống Notepad) — CHỈ hiển thị với thiệp ĐÃ xuất bản mà đang có
// thay đổi chưa lưu. Thiệp chưa xuất bản đã có autosave nên không cần.
function _updateDirtyMarks() {
  const map = {
    "switch-edit": "edit",
    "tab-config": "config",
    "tab-theme": "theme",
  };
  // Mục đang khuất trong popover thì dấu * của nó dội lên nút "Tùy chọn".
  let popDirty = false;
  Object.entries(map).forEach(([id, tab]) => {
    const el = document.getElementById(id);
    const on = IS_PUBLISHED && _dirtyTabs.has(tab);
    el?.querySelector(".tab-dirty-star")?.classList.toggle("hidden", !on);
    if (on && _inNavPop(el)) popDirty = true;
  });
  document
    .querySelector("#nav-more .tab-dirty-star")
    ?.classList.toggle("hidden", !popDirty);
}

function togglePreview() {
  switchTab(_isPreviewActive ? "edit" : "preview");
}

/**
 * Dải "xem trực tiếp" chỉ đi cùng tab Chỉnh sửa. Các tab khác là panel chiếm trọn
 * màn: nhường lại chỗ cho chúng bằng cờ .cx-rail-off trên <html> — cờ này ép
 * --cx-rail-w về 0 nên body, navbar và mọi panel tự trả lại phần bên phải.
 */
function _syncRail(tab) {
  document.documentElement.classList.toggle("cx-rail-off", tab !== "edit");
}

function switchTab(tab) {
  // Từ 820px trở lên không có chế độ Xem trước riêng nữa (thiệp nằm sẵn trong
  // khung điện thoại cạnh form) — link cũ ?tab=preview vẫn phải mở được trang.
  if (tab === "preview" && window.cxLiveWide?.()) tab = "edit";

  // Danh sách khách mời có luồng mở riêng (panel iframe + URL ?tab=guests)
  if (tab === "guests") {
    openGuestsPage();
    return;
  }

  _syncRail(tab);

  const formPanel = document.getElementById("form-panel");
  const previewPanel = document.getElementById("preview-panel");
  const configPanel = document.getElementById("config-panel");
  const themePanel = document.getElementById("theme-panel");
  const guestsPanel = document.getElementById("guests-panel");

  // Rời khỏi danh sách khách mời khi chuyển sang tab khác
  if (guestsPanel) guestsPanel.classList.add("hidden");
  if (themePanel) themePanel.classList.add("hidden");

  // Persist tab in URL without reloading
  const _url = new URL(window.location.href);
  if (tab === "edit") {
    _url.searchParams.delete("tab");
  } else {
    _url.searchParams.set("tab", tab);
  }
  history.replaceState(null, "", _url);

  if (tab === "preview") {
    _isPreviewActive = true;
    _savePreviewData();
    const iframe = document.getElementById("preview-iframe");
    iframe.src = _previewIframeSrc();
    formPanel.classList.add("hidden");
    previewPanel.classList.remove("hidden");
    configPanel.classList.add("hidden");
  } else if (tab === "config") {
    _isPreviewActive = false;
    formPanel.classList.add("hidden");
    previewPanel.classList.add("hidden");
    configPanel.classList.add("hidden");
    if (themePanel) themePanel.classList.add("hidden");
    configPanel.classList.remove("hidden");
    _initConfigPanel();
  } else if (tab === "theme") {
    _isPreviewActive = false;
    formPanel.classList.add("hidden");
    previewPanel.classList.add("hidden");
    configPanel.classList.add("hidden");
    // Nạp preview thiệp vào ngay trong tab giao diện để xem trực tiếp khi chỉnh
    _savePreviewData();
    const tIframe = document.getElementById("theme-preview-iframe");
    if (tIframe) {
      // edit=1 → bật runtime chỉnh chi tiết từng dòng chữ (chỉ ở tab Giao diện).
      tIframe.src = _previewIframeSrc("&edit=1");
    }
    if (themePanel) themePanel.classList.remove("hidden");
    _initThemePanel();
  } else {
    _isPreviewActive = false;
    formPanel.classList.remove("hidden");
    previewPanel.classList.add("hidden");
    configPanel.classList.add("hidden");
  }
  _setActiveTab(tab);
  // Về lại tab Chỉnh sửa → dải bên phải dựng lại theo dữ liệu vừa lưu.
  if (typeof cxLiveRefresh === "function") cxLiveRefresh();
}

function _initConfigPanel() {
  const slugInput = document.getElementById("slug-input");
  if (slugInput && WEDDING_SLUG) slugInput.value = WEDDING_SLUG;
  _updateSlugPreview();

  // Input hiển thị TÊN bài, URL thật nằm ở thẻ ẩn #music-url-input.
  const musicUrlHidden = document.getElementById("music-url-input");
  if (musicUrlHidden?.value) {
    // Đã chọn bài (tag + preview dựng sẵn từ lần load) → giữ nguyên
  } else if (_currentMusicUrl) {
    renderExistingYouTubeMusic(_currentMusicUrl);
  } else {
    _showYouTubeSuggestions();
  }

  // Sync clear-button state for all x-inputs in config panel
  document.querySelectorAll("x-input").forEach((el) => el.syncClearBtn?.());
}

