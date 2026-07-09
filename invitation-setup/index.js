// Configuration
const WEDDING_ID = new URLSearchParams(window.location.search).get("id");
const DOMAIN = window.location.origin;

// Wedding data cache
let WEDDING_SLUG = "";
let WEDDING_THEME = "basic-gold";
let _currentMusicUrl = "";

// Draft state: true = chỉ có trong localStorage, chưa lên DB
let _isLocalDraft = false;

// Publish state — controls whether Advanced section is enabled
let IS_PUBLISHED = false;
const DRAFT_LOCAL_KEY = `cuoixinh_draft_${WEDDING_ID}`;

function getLocalDraft() {
  try {
    return JSON.parse(localStorage.getItem(DRAFT_LOCAL_KEY) || "null");
  } catch (e) {
    return null;
  }
}
function saveLocalDraft(data) {
  try {
    localStorage.setItem(
      DRAFT_LOCAL_KEY,
      JSON.stringify({ ...data, _localOnly: _isLocalDraft }),
    );
  } catch (e) { console.error("saveLocalDraft:", e); }
}
function clearLocalDraft() {
  try {
    localStorage.removeItem(DRAFT_LOCAL_KEY);
  } catch (e) { console.error("clearLocalDraft:", e); }
}

// ============= INDEXED DB — PENDING IMAGES =============
// Lưu File objects (ảnh chưa upload) vào IndexedDB để sống qua reload/đóng tab.
// localStorage không chứa được File/Blob nên cần IDB.
const _IDB_NAME = "cuoixinh_pending";
const _IDB_VER = 1;
const _IDB_STORE = "uploads";
let _idb = null;

function _openIDB() {
  if (_idb) return Promise.resolve(_idb);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(_IDB_NAME, _IDB_VER);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(_IDB_STORE))
        db.createObjectStore(_IDB_STORE, { keyPath: "key" });
    };
    req.onsuccess = (e) => { _idb = e.target.result; resolve(_idb); };
    req.onerror = (e) => reject(e.target.error);
  });
}

async function _idbPut(record) {
  try {
    const db = await _openIDB();
    await new Promise((res, rej) => {
      const tx = db.transaction(_IDB_STORE, "readwrite");
      tx.objectStore(_IDB_STORE).put(record);
      tx.oncomplete = res;
      tx.onerror = (e) => rej(e.target.error);
    });
  } catch (e) { console.error("_idbPut:", e); }
}

async function _idbDelete(key) {
  if (!key) return;
  try {
    const db = await _openIDB();
    await new Promise((res, rej) => {
      const tx = db.transaction(_IDB_STORE, "readwrite");
      tx.objectStore(_IDB_STORE).delete(key);
      tx.oncomplete = res;
      tx.onerror = (e) => rej(e.target.error);
    });
  } catch (e) { console.error("_idbDelete:", e); }
}

async function _idbGetAll() {
  try {
    const db = await _openIDB();
    return await new Promise((res, rej) => {
      const req = db.transaction(_IDB_STORE, "readonly")
        .objectStore(_IDB_STORE).getAll();
      req.onsuccess = (e) => res(e.target.result || []);
      req.onerror = (e) => rej(e.target.error);
    });
  } catch (e) { console.error("_idbGetAll:", e); return []; }
}

async function _idbClearWedding() {
  try {
    const all = await _idbGetAll();
    const keys = all.filter((r) => r.weddingId === WEDDING_ID).map((r) => r.key);
    if (!keys.length) return;
    const db = await _openIDB();
    await new Promise((res, rej) => {
      const tx = db.transaction(_IDB_STORE, "readwrite");
      const store = tx.objectStore(_IDB_STORE);
      keys.forEach((k) => store.delete(k));
      tx.oncomplete = res;
      tx.onerror = (e) => rej(e.target.error);
    });
  } catch (e) { console.error("_idbClearWedding:", e); }
}

// File → IDB key — cần để biết key nào cần xoá khi user bỏ ảnh gallery pending
const _galleryIdbKeys = new Map();

async function _idbSaveSingle(fieldName, file) {
  await _idbPut({
    key: `${WEDDING_ID}_s_${fieldName}`,
    type: "single",
    fieldName,
    weddingId: WEDDING_ID,
    file,
    focalPoint: pendingFocalPoints[fieldName] || null,
  });
}

async function _idbSaveFocal(fieldName) {
  await _idbPut({
    key: `${WEDDING_ID}_sf_${fieldName}`,
    type: "focal_only",
    fieldName,
    weddingId: WEDDING_ID,
    focalPoint: pendingFocalPoints[fieldName] || null,
  });
}

async function _idbSaveLoveStoryImages() {
  const entries = Object.entries(_loveStoryPendingImages)
    .map(([idx, file]) => ({ idx: parseInt(idx), file }));
  if (!entries.length) {
    await _idbDelete(`${WEDDING_ID}_lsImg`);
    return;
  }
  await _idbPut({
    key: `${WEDDING_ID}_lsImg`,
    type: "love_story_images",
    weddingId: WEDDING_ID,
    images: entries,
  });
}

async function _idbAddGallery(file) {
  const key = `${WEDDING_ID}_g_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  _galleryIdbKeys.set(file, key);
  await _idbPut({
    key,
    type: "gallery",
    weddingId: WEDDING_ID,
    file,
    focalPoint: pendingFocalPoints.gallery_images.get(file) || null,
    order: Date.now(),
  });
}

async function _idbRemoveGallery(file) {
  const key = _galleryIdbKeys.get(file);
  _galleryIdbKeys.delete(file);
  await _idbDelete(key);
}

async function _idbSaveGalleryFocal(filename) {
  await _idbPut({
    key: `${WEDDING_ID}_gf_${filename}`,
    type: "gallery_focal",
    filename,
    weddingId: WEDDING_ID,
    focalPoint: pendingFocalPoints.gallery_images.get(filename) || null,
  });
}

async function _idbUpdateGalleryFocal(file) {
  const key = _galleryIdbKeys.get(file);
  if (!key) return;
  try {
    const db = await _openIDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(_IDB_STORE, "readwrite");
      const store = tx.objectStore(_IDB_STORE);
      const req = store.get(key);
      req.onsuccess = (e) => {
        const record = e.target.result;
        if (record) {
          record.focalPoint = pendingFocalPoints.gallery_images.get(file) || null;
          store.put(record);
        }
        resolve();
      };
      req.onerror = (e) => reject(e.target.error);
    });
  } catch (e) { console.error("_idbUpdateFocal:", e); }
}

async function _idbRestoreAll() {
  try {
    const all = await _idbGetAll();
    const mine = all.filter((r) => r.weddingId === WEDDING_ID);
    if (!mine.length) return;

    // Restore single images
    for (const r of mine.filter((r) => r.type === "single")) {
      pendingUploads.singleImages[r.fieldName] = r.file;
      if (r.focalPoint) pendingFocalPoints[r.fieldName] = r.focalPoint;
    }

    // Restore focal-only adjustments for DB images (overrides DB value from fillForm)
    for (const r of mine.filter((r) => r.type === "focal_only")) {
      if (r.focalPoint) pendingFocalPoints[r.fieldName] = r.focalPoint;
    }

    // Restore gallery sorted by insertion order
    const gallery = mine
      .filter((r) => r.type === "gallery")
      .sort((a, b) => (a.order || 0) - (b.order || 0));
    for (const r of gallery) {
      pendingUploads.galleryImages.push(r.file);
      if (r.focalPoint) pendingFocalPoints.gallery_images.set(r.file, r.focalPoint);
      _galleryIdbKeys.set(r.file, r.key);
    }

    // Restore focal-only adjustments for DB gallery images
    for (const r of mine.filter((r) => r.type === "gallery_focal")) {
      if (r.focalPoint && r.filename) pendingFocalPoints.gallery_images.set(r.filename, r.focalPoint);
    }

    // Restore love story pending images
    const lsRec = mine.find((r) => r.type === "love_story_images");
    if (lsRec?.images?.length) {
      lsRec.images.forEach(({ idx, file }) => {
        _loveStoryPendingImages[idx] = file;
      });
    }

    // Re-render image UIs với dữ liệu vừa restore
    ["cover_image_url", "groom_image_url", "bride_image_url", "groom_qr_url", "bride_qr_url"]
      .forEach((f) => renderSingleImageUpload(f));
    renderGalleryGrid();
    if (Object.keys(_loveStoryPendingImages).length) renderLoveStoryList();
  } catch (e) { console.error("_idbRestoreAll:", e); }
}

function getCurrentUser() {
  try {
    const key = Object.keys(localStorage).find(
      (k) => k.startsWith("sb-") && k.endsWith("-auth-token"),
    );
    if (!key) return null;
    let raw = localStorage.getItem(key);
    if (!raw) return null;
    // supabase-js v2 có thể lưu dạng "base64-<b64(json)>" → giải mã (UTF-8) trước khi parse
    if (raw.startsWith("base64-")) {
      raw = decodeURIComponent(escape(atob(raw.slice(7))));
    }
    return JSON.parse(raw)?.user ?? null;
  } catch (e) {
    return null;
  }
}

// ============= SECTION VISIBILITY TOGGLES =============

const SECTION_VIS_FIELDS = {
  family: "enable_family",
  party: "enable_party",
  photos: "enable_photos",
  timeline: "enable_timeline",
  love_story: "enable_love_story",
  music: "enable_music",
  rsvp: "rsvp_enabled",
  gift: "enable_gift",
  footer: "enable_footer",
};

function _updateVisUI(section, enabled) {
  const btn = document.getElementById(`vis-btn-${section}`);
  const knob = document.getElementById(`vis-knob-${section}`);
  if (!btn || !knob) return;
  if (enabled) {
    btn.classList.remove("bg-gray-300");
    btn.classList.add("bg-rose-400");
    knob.classList.remove("translate-x-1");
    knob.classList.add("translate-x-6");
  } else {
    btn.classList.remove("bg-rose-400");
    btn.classList.add("bg-gray-300");
    knob.classList.remove("translate-x-6");
    knob.classList.add("translate-x-1");
  }
}

function toggleSectionVis(section, event) {
  if (event) event.stopPropagation();
  const field = SECTION_VIS_FIELDS[section];
  if (!field) return;
  const hidden = document.getElementById(field);
  if (!hidden) return;
  const newVal = hidden.value !== "true";
  hidden.value = newVal ? "true" : "false";
  // Phát "input" để autosave lưu trạng thái switch (gán .value không tự phát sự kiện)
  hidden.dispatchEvent(new Event("input", { bubbles: true }));
  _updateVisUI(section, newVal);
  if (
    section === "party" &&
    typeof _updateTimelinePartySection === "function"
  ) {
    _updateTimelinePartySection();
  }
}

function _initVisToggles(data) {
  Object.entries(SECTION_VIS_FIELDS).forEach(([section, field]) => {
    const val = data?.[field];
    // Dùng default từ hidden input nếu data không có field
    const hidden = document.getElementById(field);
    const enabled =
      val !== undefined && val !== null
        ? val === true || val === "true"
        : hidden
          ? hidden.value === "true"
          : true;
    if (hidden) hidden.value = enabled ? "true" : "false";
    _updateVisUI(section, enabled);
  });
}

function toggleInfoTooltip(id) {
  const el = document.getElementById(id);
  if (el) el.classList.toggle("hidden");
}
window.toggleInfoTooltip = toggleInfoTooltip;

// ============= ACCORDION SECTIONS =============

function toggleSection(id) {
  const body = document.getElementById(`section-${id}-body`);
  const chevron = document.getElementById(`section-${id}-chevron`);
  if (!body) return;
  const isOpen = !body.classList.contains("hidden");
  const header = body.previousElementSibling;
  if (isOpen) {
    body.classList.add("hidden");
    if (chevron) chevron.classList.remove("rotate-180");
    if (header) {
      header.classList.remove("bg-gray-50");
      header.classList.add("bg-white");
    }
  } else {
    // Love story: thêm 2 mốc mặc định nếu chưa từng có data
    if (id === "love_story" && !_loveStoryKeyExists) {
      _loveStoryItems = [
        { date: "", title: "Lần đầu gặp gỡ", content: "", image_url: null },
        { date: "", title: "Chuyến đi Quy Nhơn", content: "", image_url: null },
      ];
      _loveStoryKeyExists = true;
      _syncLoveStoryHidden();
      renderLoveStoryList();
    }
    body.classList.remove("hidden");
    if (chevron) chevron.classList.add("rotate-180");
    if (header) {
      header.classList.remove("bg-white");
      header.classList.add("bg-gray-50");
    }
  }
}

function _openSectionAndScroll(id) {
  const body = document.getElementById(`section-${id}-body`);
  if (!body) return;
  if (body.classList.contains("hidden")) toggleSection(id);
  const header = body.previousElementSibling;
  (header || body).scrollIntoView({ behavior: "smooth", block: "start" });
}
window._openSectionAndScroll = _openSectionAndScroll;

function _switchTab(prefix, side) {
  ["groom", "bride"].forEach((s) => {
    const tab = document.getElementById(`${prefix}-tab-${s}`);
    const panel = document.getElementById(`${prefix}-panel-${s}`);
    if (!tab || !panel) return;
    if (s === side) {
      tab.classList.add(
        "bg-rose-50",
        "text-rose-600",
        "border-b-2",
        "border-rose-400",
      );
      tab.classList.remove(
        "text-gray-500",
        "hover:bg-gray-50",
        "hover:text-gray-700",
      );
      panel.classList.remove("hidden");
    } else {
      tab.classList.remove(
        "bg-rose-50",
        "text-rose-600",
        "border-b-2",
        "border-rose-400",
      );
      tab.classList.add(
        "text-gray-500",
        "hover:bg-gray-50",
        "hover:text-gray-700",
      );
      panel.classList.add("hidden");
    }
  });
}
window.switchPartyTab = (side) => _switchTab("party", side);
window.switchFamilyTab = (side) => _switchTab("family", side);
window.switchTimelineTab = (side) => _switchTab("timeline", side);

// ============= STEP INDICATOR =============

function setStep(n) {
  if (n >= 3) {
    const dot = document.getElementById("step-3-dot");
    if (dot) {
      dot.className =
        "w-6 h-6 rounded-full bg-rose-500 flex items-center justify-center";
      dot.innerHTML = '<span class="text-white text-[11px] font-bold">3</span>';
    }
    const label = document.getElementById("step-3-label");
    if (label) label.className = "text-[10px] text-rose-600 font-semibold";
    const line = document.getElementById("step-line-3");
    if (line) line.className = "flex-1 h-0.5 bg-rose-300 mx-2";
  }
  if (n >= 4) {
    const dot = document.getElementById("step-4-dot");
    if (dot) {
      dot.className =
        "w-6 h-6 rounded-full bg-rose-500 flex items-center justify-center";
      dot.innerHTML = '<span class="text-white text-[11px] font-bold">4</span>';
    }
    const label = document.getElementById("step-4-label");
    if (label) label.className = "text-[10px] text-rose-600 font-semibold";
    const line = document.getElementById("step-line-4");
    if (line) line.className = "flex-1 h-0.5 bg-rose-300 mx-2";
  }
}

// ============= PREVIEW WITH REAL DATA =============

let _isPreviewActive = false;

function _savePreviewData() {
  const form = document.getElementById("wedding-form");
  if (!form) return;

  const IMAGE_FIELDS = ["cover_image_url", "groom_image_url", "bride_image_url", "groom_qr_url", "bride_qr_url"];
  const data = { is_active: true, theme: WEDDING_THEME, slug: WEDDING_SLUG };

  // Collect text fields; convert image filenames → full URLs
  const formData = new FormData(form);
  formData.forEach((value, key) => {
    if (key === "gallery_images_raw" || key === "slug") return;
    if (!value || typeof value !== "string" || !value.trim()) return;
    const v = value.trim();
    data[key] = IMAGE_FIELDS.includes(key) ? getImageUrl(v) : v;
  });

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
  const pendingGalleryUrls = pendingUploads.galleryImages.map((f) => URL.createObjectURL(f));

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

  sessionStorage.setItem("preview_data", JSON.stringify(data));
}

// ============= BOTTOM NAV TABS =============

function _setActiveTab(tabId) {
  // Chỉ config có active state kiểu tab; draft/publish dùng dirty indicator riêng
  const configBtn = document.getElementById("tab-config");
  if (configBtn) {
    if (tabId === "config") {
      configBtn.classList.add("text-color-secondary", "border-color-secondary");
      configBtn.classList.remove("text-gray-400", "border-transparent");
    } else {
      configBtn.classList.remove("text-color-secondary", "border-color-secondary");
      configBtn.classList.add("text-gray-400", "border-transparent");
    }
  }

  const guestsBtn = document.getElementById("tab-guests");
  if (guestsBtn) {
    if (tabId === "guests") {
      guestsBtn.classList.add("text-color-secondary", "border-color-secondary");
      guestsBtn.classList.remove("text-gray-400", "border-transparent");
    } else {
      guestsBtn.classList.remove("text-color-secondary", "border-color-secondary");
      guestsBtn.classList.add("text-gray-400", "border-transparent");
    }
  }

  // Segmented switch: ẩn focus khi ở tab config/khách mời
  const editBtn    = document.getElementById("switch-edit");
  const previewBtn = document.getElementById("switch-preview");
  if (!editBtn || !previewBtn) return;
  if (tabId === "config" || tabId === "guests") {
    editBtn.classList.remove("bg-white", "shadow-sm", "text-gray-700", "font-semibold");
    editBtn.classList.add("text-gray-400", "font-medium");
    previewBtn.classList.remove("bg-white", "shadow-sm", "text-rose-500", "font-semibold");
    previewBtn.classList.add("text-gray-400", "font-medium");
  } else if (tabId === "preview") {
    previewBtn.classList.add("bg-white", "shadow-sm", "text-rose-500", "font-semibold");
    previewBtn.classList.remove("text-gray-400", "font-medium");
    editBtn.classList.remove("bg-white", "shadow-sm", "text-gray-700", "font-semibold");
    editBtn.classList.add("text-gray-400", "font-medium");
  } else {
    editBtn.classList.add("bg-white", "shadow-sm", "text-gray-700", "font-semibold");
    editBtn.classList.remove("text-gray-400", "font-medium");
    previewBtn.classList.remove("bg-white", "shadow-sm", "text-rose-500", "font-semibold");
    previewBtn.classList.add("text-gray-400", "font-medium");
  }
}

let _isDirty = false;

function _setDirty(dirty) {
  _isDirty = dirty;

  const draft   = document.getElementById("tab-draft");
  const publish = document.getElementById("tab-publish");

  if (draft) {
    draft.classList.toggle("border-rose-400",  dirty);
    draft.classList.toggle("text-rose-500",    dirty);
    draft.classList.toggle("bg-rose-50",       dirty);
    draft.classList.toggle("border-gray-300",  !dirty);
    draft.classList.toggle("text-gray-500",    !dirty);
    draft.classList.toggle("bg-white",         !dirty);
  }
  if (publish) {
    publish.classList.toggle("bg-rose-600", dirty);
    publish.classList.toggle("bg-rose-500", !dirty);
  }
}

function togglePreview() {
  switchTab(_isPreviewActive ? "edit" : "preview");
}

function switchTab(tab) {
  // Danh sách khách mời có luồng mở riêng (panel iframe + URL ?tab=guests)
  if (tab === "guests") { openGuestsPage(); return; }

  const formPanel    = document.getElementById("form-panel");
  const previewPanel = document.getElementById("preview-panel");
  const configPanel  = document.getElementById("config-panel");
  const guestsPanel  = document.getElementById("guests-panel");

  // Rời khỏi danh sách khách mời khi chuyển sang tab khác
  if (guestsPanel) guestsPanel.classList.add("hidden");

  // Persist tab in URL without reloading
  const _url = new URL(window.location.href);
  if (tab === "edit") { _url.searchParams.delete("tab"); }
  else { _url.searchParams.set("tab", tab); }
  history.replaceState(null, "", _url);

  if (tab === "preview") {
    _isPreviewActive = true;
    _savePreviewData();
    const iframe = document.getElementById("preview-iframe");
    iframe.src = `/public/themes/${WEDDING_THEME}/?preview=true&source=live&isGroom=true&t=${Date.now()}`;
    formPanel.classList.add("hidden");
    previewPanel.classList.remove("hidden");
    configPanel.classList.add("hidden");
    setStep(3);
  } else if (tab === "config") {
    _isPreviewActive = false;
    formPanel.classList.add("hidden");
    previewPanel.classList.add("hidden");
    configPanel.classList.remove("hidden");
    _initConfigPanel();
  } else {
    _isPreviewActive = false;
    formPanel.classList.remove("hidden");
    previewPanel.classList.add("hidden");
    configPanel.classList.add("hidden");
  }
  _setActiveTab(tab);
}

function _initConfigPanel() {
  const slugInput = document.getElementById("slug-input");
  if (slugInput && WEDDING_SLUG) slugInput.value = WEDDING_SLUG;
  _updateSlugPreview();

  const ytInput = document.getElementById("youtube-link-input");
  if (ytInput && !ytInput.value && _currentMusicUrl) {
    renderExistingYouTubeMusic(_currentMusicUrl);
  } else if (ytInput?.value) {
    autoPreviewYouTubeMusic();
  } else {
    _showYouTubeSuggestions();
  }

  // Sync clear-button state for all x-inputs in config panel
  document.querySelectorAll('x-input').forEach(el => el.syncClearBtn?.());
}

function _toSlug(str) {
  return (str || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

async function _isSlugAvailable(slug) {
  try {
    const res = await fetch(
      `${CONFIG.supabase.edgeUrl}?slug=${encodeURIComponent(slug)}`,
      { headers: { Authorization: `Bearer ${CONFIG.supabase.anonKey}` } }
    );
    if (!res.ok) return true; // 404 = chưa có ai dùng
    const data = await res.json();
    // Nếu kết quả trả về là wedding này → coi như available
    return !data || data.id === WEDDING_ID;
  } catch { return true; }
}

async function _resolvePublishSlug() {
  // Nếu user đã nhập slug thủ công trong Cấu hình → giữ nguyên
  if (WEDDING_SLUG && !WEDDING_SLUG.startsWith("wedding-")) return WEDDING_SLUG;

  const groomName = (document.querySelector('[name="groom_name"]')?.value || "").trim();
  const brideName = (document.querySelector('[name="bride_name"]')?.value || "").trim();
  if (!groomName || !brideName) return WEDDING_SLUG;

  const groomSlug = _toSlug(groomName);
  const brideSlug = _toSlug(brideName);

  // Lần 1: họ và tên đầy đủ
  const fullSlug = `${groomSlug}-${brideSlug}`;
  if (await _isSlugAvailable(fullSlug)) return fullSlug;

  // Lần 2: thêm "&" ở giữa
  const andSlug = `${groomSlug}-&-${brideSlug}`;
  if (await _isSlugAvailable(andSlug)) return andSlug;

  // Lần 3: random số 2 chữ số
  const rand = Math.floor(Math.random() * 90) + 10; // 10–99
  return `${fullSlug}-${rand}`;
}

function _updateSlugPreview() {
  const input   = document.getElementById("slug-input");
  const preview = document.getElementById("slug-preview");
  const row     = document.getElementById("slug-preview-row");
  if (!input || !preview) return;
  const val = input.value.trim();
  if (val) {
    preview.textContent = `${window.location.origin}/${val}`;
    if (row) row.style.display = "flex";
  } else {
    if (row) row.style.display = "none";
  }
}

function copyInviteLink() {
  const preview = document.getElementById("slug-preview");
  if (!preview?.textContent) return;
  navigator.clipboard.writeText(preview.textContent).then(() => {
    showToast("✅ Đã sao chép link thiệp!");
  }).catch(() => {
    showToast("❌ Không thể sao chép, hãy copy thủ công");
  });
}

async function saveDraft() {
  _setActiveTab("draft");
  const ok = await saveAll({}, "Đang lưu...");
  if (ok) _setActiveTab("edit");
}

async function publishWedding() {
  // Validate form TRƯỚC khi yêu cầu đăng nhập — tránh bắt user đăng nhập rồi mới báo thiếu thông tin
  const form = document.getElementById("wedding-form");
  if (!validateForm(form)) {
    showToast("⚠️ Vui lòng điền đủ thông tin bắt buộc trước khi xuất bản");
    return;
  }

  if (!getCurrentUser()) {
    // Chưa đăng nhập → hiện popup đăng nhập/tạo tài khoản ngay tại chỗ (không rời trang).
    // OAuth vẫn redirect: đính pendingPublish=1 để tự xuất bản khi quay lại.
    if (window.AuthUI) {
      const oauthRedirect = new URL(window.location.href);
      oauthRedirect.searchParams.set("pendingPublish", "1");
      AuthUI.openModal({
        title: "Sẵn sàng gửi thiệp đi chưa?",
        subtitle: "Đăng nhập để kích hoạt và chia sẻ thiệp cưới của bạn",
        oauthRedirect: oauthRedirect.toString(),
        onAuth: () => publishWedding(),
      });
    } else {
      const returnUrl = new URL(window.location.href);
      returnUrl.searchParams.set("pendingPublish", "1");
      window.location.href = `/public/account/?urlRedirect=${encodeURIComponent(returnUrl.toString())}`;
    }
    return;
  }
  _setActiveTab("publish");
  showLoading(true, "Đang chuẩn bị...");
  WEDDING_SLUG = await _resolvePublishSlug();
  // Cập nhật input slug trong panel cấu hình nếu đang mở
  const slugInput = document.getElementById("slug-input");
  if (slugInput) { slugInput.value = WEDDING_SLUG; _updateSlugPreview(); }
  const ok = await saveAll({ is_published: true }, "Đang xuất bản...");
  if (!ok) return;

  IS_PUBLISHED = true;
  _syncAdvancedSection();

  _setActiveTab("edit");
}

// ============= AUTO-SAVE =============
let _autoSaveTimer = null;

function _doAutoSave() {
  const form = document.getElementById("wedding-form");
  if (!form) return;

  const formData = new FormData(form);
  const payload = { id: WEDDING_ID, slug: WEDDING_SLUG, theme: WEDDING_THEME, is_active: true };

  formData.forEach((value, key) => {
    if (key === "gallery_images_raw" || key === "slug") return;
    if (typeof value !== "string") return;
    if (value.trim()) {
      payload[key] = value.trim();
    } else if (key.includes("_url") || key.includes("_lunar")) {
      payload[key] = null;
    }
  });

  // YouTube music
  const ytInput = document.getElementById("youtube-link-input");
  const musicInput = document.getElementById("music-url-input");
  payload.music_url = ytInput?.value?.trim() || musicInput?.value?.trim() || null;

  // Gallery (filenames đã lưu — pending uploads là blob trong memory, ko thể lưu localStorage)
  const galleryTA = document.querySelector('textarea[name="gallery_images_raw"]');
  payload.gallery_images = galleryTA
    ? galleryTA.value.trim().split("\n").filter(Boolean)
    : [];

  saveLocalDraft(payload);
}

function _scheduleAutoSave() {
  _setDirty(true);
  // Đã mua thiệp (đã thanh toán, is_published = true) → không auto-save nữa
  if (IS_PUBLISHED) return;
  clearTimeout(_autoSaveTimer);
  _autoSaveTimer = setTimeout(_doAutoSave, 1500);
}

function _initAutoSave() {
  const form = document.getElementById("wedding-form");
  if (!form) return;
  form.addEventListener("input", _scheduleAutoSave);
  form.addEventListener("change", _scheduleAutoSave);
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
  if (!WEDDING_ID) { showToast("⚠️ Cần lưu thiệp trước khi quản lý khách mời"); return; }

  // Lưu tab vào URL mà không reload
  const _url = new URL(window.location.href);
  _url.searchParams.set("tab", "guests");
  history.replaceState(null, "", _url);

  const formPanel    = document.getElementById("form-panel");
  const previewPanel = document.getElementById("preview-panel");
  const configPanel  = document.getElementById("config-panel");
  const guestsPanel  = document.getElementById("guests-panel");

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
  const iframe     = document.getElementById("guests-iframe");
  if (!IS_PUBLISHED) {
    // Chưa xuất bản: khoá tính năng, không nạp iframe
    if (guestsLock) { guestsLock.classList.remove("hidden"); guestsLock.classList.add("flex"); }
    if (iframe) iframe.classList.add("hidden");
  } else {
    if (guestsLock) { guestsLock.classList.add("hidden"); guestsLock.classList.remove("flex"); }
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

// ============= EXCEL IMPORT =============

let _importState = { headers: [], data: [], side: "" };

function downloadGuestTemplate() {
  if (typeof XLSX === "undefined") { showToast("⚠️ Đang tải thư viện, thử lại sau"); return; }
  guestBL.downloadTemplate();
}

async function handleExcelUpload(event, side) {
  const file = event.target.files[0];
  event.target.value = "";
  if (!file) return;

  try {
    const { headers, data } = await guestBL.parseExcel(file);
    _importState = { headers, data, side };
    _openMappingModal(headers, data);
  } catch (err) {
    showToast("❌ " + err.message);
  }
}

function _openMappingModal(headers, data) {
  const mapping = guestBL.autoDetectMapping(headers);
  const noOpt = `<option value="-1">— Không chọn —</option>`;
  const opts = headers.map((h, i) => `<option value="${i}">${h || "(Cột " + (i+1) + ")"}</option>`).join("");

  document.getElementById("map-full-name").innerHTML = opts;
  document.getElementById("map-display-name").innerHTML = noOpt + opts;
  document.getElementById("map-relationship").innerHTML = noOpt + opts;

  document.getElementById("map-full-name").value = mapping.full_name;
  document.getElementById("map-display-name").value = mapping.display_name;
  document.getElementById("map-relationship").value = mapping.relationship;

  _renderMappingPreview(headers, data.slice(0, 4));

  document.querySelector("input[name='import-mode'][value='overwrite']").checked = true;

  const modal = document.getElementById("import-mapping-modal");
  modal.classList.remove("hidden");
  modal.classList.add("flex");
  if (window.lucide) lucide.createIcons();
}

function closeMappingModal() {
  const modal = document.getElementById("import-mapping-modal");
  modal.classList.add("hidden");
  modal.classList.remove("flex");
}

function _renderMappingPreview(headers, rows) {
  const th = headers.map(h => `<th class="px-2 py-1.5 text-left text-xs font-medium text-gray-500 whitespace-nowrap">${h}</th>`).join("");
  const trs = rows.map(row =>
    `<tr class="border-t border-gray-100">${
      headers.map((_, i) => `<td class="px-2 py-1.5 text-xs text-gray-700 max-w-[100px] truncate">${row[i] ?? ""}</td>`).join("")
    }</tr>`
  ).join("");
  document.getElementById("mapping-preview").innerHTML = `
    <div class="overflow-x-auto rounded-lg border border-gray-200">
      <table class="w-full text-left"><thead class="bg-gray-50"><tr>${th}</tr></thead><tbody>${trs}</tbody></table>
    </div>
    <p class="text-xs text-gray-400 mt-1">Hiển thị ${rows.length} dòng đầu</p>`;
}

async function confirmImport() {
  const colMapping = {
    full_name: parseInt(document.getElementById("map-full-name").value),
    display_name: parseInt(document.getElementById("map-display-name").value),
    relationship: parseInt(document.getElementById("map-relationship").value),
  };

  if (isNaN(colMapping.full_name) || colMapping.full_name < 0) {
    showToast("⚠️ Vui lòng chọn cột Họ và tên");
    return;
  }

  const overwrite = document.querySelector("input[name='import-mode']:checked").value === "overwrite";
  const { data, side } = _importState;

  closeMappingModal();
  showLoading(true, "Đang nhập khẩu...");

  try {
    const result = await guestBL.importGuests(WEDDING_ID, side, data, colMapping, overwrite);
    const skipMsg = result.skipped > 0 ? `, bỏ qua ${result.skipped} trùng` : "";
    showToast(`✅ Đã nhập ${result.inserted} khách${skipMsg}`);
    await loadGuestList(side);
  } catch (err) {
    showToast("❌ Nhập khẩu thất bại: " + err.message);
  } finally {
    showLoading(false);
  }
}

async function loadGuestList(side) {
  if (!WEDDING_ID) return;
  try {
    const guests = await guestDAL.getGuests(WEDDING_ID, side);
    _renderGuestList(guests, side);
  } catch (err) {
    console.error("loadGuestList error:", err);
  }
}

function _renderGuestList(guests, side) {
  const container = document.getElementById(`guest-list-${side}`);
  if (!container) return;

  if (guests.length === 0) {
    container.innerHTML = `<p class="text-xs text-gray-400 text-center py-3">Chưa có khách mời nào</p>`;
    return;
  }

  const rows = guests.map(g => `
    <tr class="border-t border-gray-100 hover:bg-gray-50/50">
      <td class="px-3 py-2.5">
        <p class="text-xs font-medium text-gray-800 truncate max-w-[100px]">${g.full_name}</p>
        ${g.display_name ? `<p class="text-xs text-gray-400 truncate max-w-[100px]">${g.display_name}</p>` : ""}
      </td>
      <td class="px-3 py-2.5 text-xs text-gray-500 truncate max-w-[80px]">${g.relationship || "—"}</td>
      <td class="px-3 py-2.5 text-center">
        ${g.link
          ? `<button type="button" onclick="copyGuestLink('${g.link}')" class="text-rose-400 hover:text-rose-600 transition-colors">
               <i data-lucide="copy" style="width:14px;height:14px"></i>
             </button>`
          : `<span class="text-gray-300 text-xs">—</span>`}
      </td>
      <td class="px-3 py-2.5">
        ${g.viewed
          ? `<span class="inline-flex items-center gap-1 text-xs text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full whitespace-nowrap">✓ Đã xem</span>
             ${g.viewed_at ? `<p class="text-xs text-gray-400 mt-0.5 whitespace-nowrap">${_formatGuestDate(g.viewed_at)}</p>` : ""}`
          : `<span class="text-xs text-gray-400">Chưa xem</span>`}
      </td>
      <td class="px-3 py-2.5 text-xs whitespace-nowrap">
        ${g.confirmed
          ? `<span class="${g.confirmed.includes("Có") ? "text-green-600" : "text-red-500"}">${g.confirmed}</span>`
          : `<span class="text-gray-400">—</span>`}
      </td>
    </tr>`).join("");

  container.innerHTML = `
    <div class="overflow-x-auto rounded-lg border border-gray-200 -mx-0">
      <table class="w-full min-w-[440px]">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-3 py-2 text-left text-xs font-medium text-gray-500">Tên</th>
            <th class="px-3 py-2 text-left text-xs font-medium text-gray-500">Quan hệ</th>
            <th class="px-3 py-2 text-center text-xs font-medium text-gray-500">Link</th>
            <th class="px-3 py-2 text-left text-xs font-medium text-gray-500">Trạng thái</th>
            <th class="px-3 py-2 text-left text-xs font-medium text-gray-500">Xác nhận</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <p class="text-xs text-gray-400 text-right mt-1.5">${guests.length} khách</p>`;

  if (window.lucide) lucide.createIcons();
}

function copyGuestLink(link) {
  navigator.clipboard.writeText(link).then(() => showToast("✅ Đã copy link"));
}

function _formatGuestDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function switchGuestsTab(side) {
  const isGroom = side === "groom";
  document.getElementById("guests-panel-groom").classList.toggle("hidden", !isGroom);
  document.getElementById("guests-panel-bride").classList.toggle("hidden", isGroom);

  const ACTIVE   = ["bg-rose-50", "text-rose-600", "border-b-2", "border-rose-400"];
  const INACTIVE = ["text-gray-500", "hover:bg-gray-50", "hover:text-gray-700"];
  const tabGroom = document.getElementById("tab-guests-groom");
  const tabBride = document.getElementById("tab-guests-bride");

  if (isGroom) {
    tabGroom.classList.add(...ACTIVE);    tabGroom.classList.remove(...INACTIVE);
    tabBride.classList.add(...INACTIVE);  tabBride.classList.remove(...ACTIVE);
  } else {
    tabBride.classList.add(...ACTIVE);    tabBride.classList.remove(...INACTIVE);
    tabGroom.classList.add(...INACTIVE);  tabGroom.classList.remove(...ACTIVE);
  }
}

function generateQuickLink(side) {
  const name = document.getElementById(`quick-link-name-${side}`).value.trim();
  const rel  = document.getElementById(`quick-link-rel-${side}`).value.trim();
  if (!name || !rel) { showToast("❌ Vui lòng nhập tên và quan hệ khách"); return; }

  const slug = WEDDING_SLUG || (WEDDING_ID ? `wedding-${WEDDING_ID.slice(0, 8)}` : "");
  if (!slug) { showToast("❌ Không xác định được thiệp, vui lòng tải lại trang"); return; }

  const encName = encryptData(name);
  const encRel  = encryptData(rel);
  const base    = side === "groom"
    ? `${DOMAIN}/${slug}?isGroom=true`
    : `${DOMAIN}/${slug}`;
  const link = `${base}&name=${encName}&relationship=${encRel}`;

  document.getElementById(`quick-link-output-${side}`).value = link;
  document.getElementById(`quick-link-result-${side}`).classList.remove("hidden");
}

function shareViaMessenger(url, side) {
  if (!url) return;

  const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);

  if (isMobile) {
    window.location.href = `fb-messenger://share?link=${encodeURIComponent(url)}`;
    setTimeout(() => {
      if (!document.hidden && navigator.share) {
        navigator.share({ title: "Thiệp cưới", url }).catch(() => {});
      }
    }, 1500);
    return;
  }

  // Desktop: toggle share panel
  const panel = document.getElementById(`messenger-share-panel-${side}`);
  if (!panel) return;
  panel.classList.toggle("hidden");
  if (!panel.classList.contains("hidden")) lucide.createIcons();
}

function copyMessengerLink(side) {
  const link = document.getElementById(`quick-link-output-${side}`)?.value;
  if (!link) return;
  navigator.clipboard.writeText(link);
  showToast("📋 Đã copy! Mở Messenger rồi dán link vào hộp chat");
}

// ============= BANK SEARCHABLE SELECT =============

const BANK_LIST = [
  "Vietcombank - Ngân hàng TMCP Ngoại thương Việt Nam",
  "VietinBank - Ngân hàng TMCP Công Thương Việt Nam",
  "BIDV - Ngân hàng TMCP Đầu tư và Phát triển Việt Nam",
  "Agribank - Ngân hàng Nông nghiệp và Phát triển Nông thôn Việt Nam",
  "MB Bank - Ngân hàng TMCP Quân đội",
  "Techcombank - Ngân hàng TMCP Kỹ Thương Việt Nam",
  "ACB - Ngân hàng TMCP Á Châu",
  "VPBank - Ngân hàng TMCP Việt Nam Thịnh Vượng",
  "TPBank - Ngân hàng TMCP Tiên Phong",
  "Sacombank - Ngân hàng TMCP Sài Gòn Thương Tín",
  "HDBank - Ngân hàng TMCP Phát triển TP.HCM",
  "VIB - Ngân hàng TMCP Quốc tế Việt Nam",
  "SHB - Ngân hàng TMCP Sài Gòn - Hà Nội",
  "Eximbank - Ngân hàng TMCP Xuất Nhập khẩu Việt Nam",
  "MSB - Ngân hàng TMCP Hàng Hải Việt Nam",
  "OCB - Ngân hàng TMCP Phương Đông",
  "SeABank - Ngân hàng TMCP Đông Nam Á",
  "VietCapital Bank - Ngân hàng TMCP Bản Việt",
  "SCB - Ngân hàng TMCP Sài Gòn",
  "VietBank - Ngân hàng TMCP Việt Nam Thương Tín",
  "LienVietPostBank - Ngân hàng TMCP Bưu Điện Liên Việt",
  "PVcomBank - Ngân hàng TMCP Đại Chúng Việt Nam",
  "BacABank - Ngân hàng TMCP Bắc Á",
  "VietABank - Ngân hàng TMCP Việt Á",
  "NCB - Ngân hàng TMCP Quốc Dân",
  "SaigonBank - Ngân hàng TMCP Sài Gòn Công Thương",
  "ABBank - Ngân hàng TMCP An Bình",
  "Nam A Bank - Ngân hàng TMCP Nam Á",
  "PGBank - Ngân hàng TMCP Xăng dầu Petrolimex",
  "BaoViet Bank - Ngân hàng TMCP Bảo Việt",
  "GPBank - Ngân hàng TMCP Dầu khí Toàn Cầu",
  "OceanBank - Ngân hàng TMCP Đại Dương",
  "CBBank - Ngân hàng TMCP Xây dựng Việt Nam",
  "KienLongBank - Ngân hàng TMCP Kiên Long",
  "DongA Bank - Ngân hàng TMCP Đông Á",
  "UOB - Ngân hàng United Overseas Bank",
  "Standard Chartered - Ngân hàng Standard Chartered Việt Nam",
  "HSBC - Ngân hàng HSBC Việt Nam",
  "Shinhan Bank - Ngân hàng TNHH MTV Shinhan Việt Nam",
  "Woori Bank - Ngân hàng TNHH MTV Woori Việt Nam",
  "Hong Leong Bank - Ngân hàng TNHH MTV Hong Leong Việt Nam",
  "CIMB - Ngân hàng TNHH MTV CIMB Việt Nam",
  "Public Bank - Ngân hàng TNHH MTV Public Việt Nam",
];

function setupBankSearchableSelect(inputId, dropdownId, hiddenInputId) {
  const input = document.getElementById(inputId);
  const dropdown = document.getElementById(dropdownId);
  const hiddenInput = document.getElementById(hiddenInputId);

  if (!input || !dropdown || !hiddenInput) return;

  let selectedIndex = -1;

  // Render dropdown options
  function renderOptions(banks) {
    if (banks.length === 0) {
      dropdown.innerHTML =
        '<div class="px-4 py-3 text-sm text-gray-500">Không tìm thấy ngân hàng</div>';
      dropdown.classList.remove("hidden");
      return;
    }

    dropdown.innerHTML = banks
      .map(
        (bank, index) => `
      <div class="bank-option px-4 py-3 hover:bg-rose-50 cursor-pointer transition-colors text-sm border-b border-gray-100 last:border-b-0 ${index === selectedIndex ? "bg-rose-50" : ""}" data-value="${bank}">
        ${bank}
      </div>
    `,
      )
      .join("");

    dropdown.classList.remove("hidden");

    // Add click handlers
    dropdown.querySelectorAll(".bank-option").forEach((option) => {
      option.addEventListener("click", () => {
        const value = option.dataset.value;
        input.value = value;
        hiddenInput.value = value;
        // Gán .value bằng code KHÔNG tự phát sự kiện → phát thủ công để autosave (form nghe "input") chạy,
        // nếu không, chọn ngân hàng xong F5 sẽ mất (khác với gõ text vốn tự phát input).
        hiddenInput.dispatchEvent(new Event("input", { bubbles: true }));
        dropdown.classList.add("hidden");
        selectedIndex = -1;
      });
    });
  }

  // Filter banks
  function filterBanks(query) {
    if (!query.trim()) {
      renderOptions(BANK_LIST);
      return;
    }

    const normalizedQuery = query.toLowerCase().trim();
    const filtered = BANK_LIST.filter((bank) =>
      bank.toLowerCase().includes(normalizedQuery),
    );

    renderOptions(filtered);
  }

  // Input event
  input.addEventListener("input", (e) => {
    selectedIndex = -1;
    hiddenInput.value = e.target.value; // Update hidden input as user types
    filterBanks(e.target.value);
  });

  // Focus event
  input.addEventListener("focus", () => {
    filterBanks(input.value);
  });

  // Keyboard navigation
  input.addEventListener("keydown", (e) => {
    const options = dropdown.querySelectorAll(".bank-option");

    if (e.key === "ArrowDown") {
      e.preventDefault();
      selectedIndex = Math.min(selectedIndex + 1, options.length - 1);
      updateSelection(options);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, -1);
      updateSelection(options);
    } else if (
      e.key === "Enter" &&
      selectedIndex >= 0 &&
      options[selectedIndex]
    ) {
      e.preventDefault();
      options[selectedIndex].click();
    } else if (e.key === "Escape") {
      dropdown.classList.add("hidden");
      selectedIndex = -1;
    }
  });

  function updateSelection(options) {
    options.forEach((opt, idx) => {
      if (idx === selectedIndex) {
        opt.classList.add("bg-rose-50");
        opt.scrollIntoView({ block: "nearest" });
      } else {
        opt.classList.remove("bg-rose-50");
      }
    });
  }

  // Click outside to close
  document.addEventListener("click", (e) => {
    if (!input.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.classList.add("hidden");
      selectedIndex = -1;
    }
  });
}

// ============= QUOTE RANDOM =============

const QUOTE_LIST = [
  "Cảm ơn em đã đến bên đời nhau, cùng nhau viết nên câu chuyện của riêng chúng ta.",
  "Tình yêu không phải là nhìn nhau, mà là cùng nhau nhìn về một hướng.",
  "Hạnh phúc là khi có một người để yêu, một nơi để về và một lý do để tin.",
  "Từ hôm nay, anh/em không còn là một, mà là hai người cùng chung một trái tim.",
  "Yêu nhau không chỉ là nói lời yêu, mà là ở bên nhau mỗi ngày.",
  "Tình yêu đích thực là khi hai người cùng nhau trưởng thành.",
  "Hôn nhân không phải là điểm kết thúc, mà là khởi đầu của một hành trình mới.",
  "Tình yêu là khi hai trái tim cùng đập chung một nhịp.",
  "Hạnh phúc nhất là được sống bên người mình yêu mỗi ngày.",
  "Yêu là cho đi không cần đòi hỏi, là chia sẻ không cần tính toán.",
];

function randomQuote() {
  const textarea = document.getElementById("story-quote-textarea");
  if (!textarea) return;

  const randomIndex = Math.floor(Math.random() * QUOTE_LIST.length);
  textarea.value = QUOTE_LIST[randomIndex];
  // Gán .value bằng code không tự phát sự kiện → phát "input" để autosave lưu + x-input đồng bộ
  textarea.dispatchEvent(new Event("input", { bubbles: true }));

  // Add a little animation
  textarea.classList.add("ring-4", "ring-purple-500/20");
  setTimeout(() => {
    textarea.classList.remove("ring-4", "ring-purple-500/20");
  }, 500);
}

// ============= AI: TẠO NỘI DUNG THIỆP =============
// (Đã tách sang ai-modal.js + ai-modal.css để index.js gọn hơn.)

// ============= TIME INPUT VALIDATION =============

function handleTimeInput(event) {
  const char = String.fromCharCode(event.which);
  const input = event.target;
  const value = input.value;

  // Chỉ cho phép số và dấu :
  if (!/[0-9:]/.test(char)) {
    event.preventDefault();
    return false;
  }

  // Tự động thêm dấu : sau khi nhập 2 số đầu
  if (value.length === 2 && char !== ":") {
    input.value = value + ":";
  }

  return true;
}

// ============= LUNAR CALENDAR FUNCTIONS =============
// Thuật toán chuyển đổi âm lịch của Hồ Ngọc Đức

function jdFromDate(dd, mm, yy) {
  const a = Math.floor((14 - mm) / 12);
  const y = yy + 4800 - a;
  const m = mm + 12 * a - 3;
  let jd =
    dd +
    Math.floor((153 * m + 2) / 5) +
    365 * y +
    Math.floor(y / 4) -
    Math.floor(y / 100) +
    Math.floor(y / 400) -
    32045;
  if (jd < 2299161) {
    jd =
      dd + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - 32083;
  }
  return jd;
}

function getNewMoonDay(k, timeZone) {
  const T = k / 1236.85;
  const T2 = T * T;
  const T3 = T2 * T;
  const dr = Math.PI / 180;
  let Jd1 = 2415020.75933 + 29.53058868 * k + 0.0001178 * T2 - 0.000000155 * T3;
  Jd1 = Jd1 + 0.00033 * Math.sin((166.56 + 132.87 * T - 0.009173 * T2) * dr);
  const M = 359.2242 + 29.10535608 * k - 0.0000333 * T2 - 0.00000347 * T3;
  const Mpr = 306.0253 + 385.81691806 * k + 0.0107306 * T2 + 0.00001236 * T3;
  const F = 21.2964 + 390.67050646 * k - 0.0016528 * T2 - 0.00000239 * T3;
  let C1 =
    (0.1734 - 0.000393 * T) * Math.sin(M * dr) + 0.0021 * Math.sin(2 * dr * M);
  C1 = C1 - 0.4068 * Math.sin(Mpr * dr) + 0.0161 * Math.sin(dr * 2 * Mpr);
  C1 = C1 - 0.0004 * Math.sin(dr * 3 * Mpr);
  C1 = C1 + 0.0104 * Math.sin(dr * 2 * F) - 0.0051 * Math.sin(dr * (M + Mpr));
  C1 =
    C1 -
    0.0074 * Math.sin(dr * (M - Mpr)) +
    0.0004 * Math.sin(dr * (2 * F + M));
  C1 =
    C1 -
    0.0004 * Math.sin(dr * (2 * F - M)) -
    0.0006 * Math.sin(dr * (2 * F + Mpr));
  C1 =
    C1 +
    0.001 * Math.sin(dr * (2 * F - Mpr)) +
    0.0005 * Math.sin(dr * (2 * Mpr + M));
  let deltat;
  if (T < -11) {
    deltat =
      0.001 +
      0.000839 * T +
      0.0002261 * T2 -
      0.00000845 * T3 -
      0.000000081 * T * T3;
  } else {
    deltat = -0.000278 + 0.000265 * T + 0.000262 * T2;
  }
  const JdNew = Jd1 + C1 - deltat;
  return Math.floor(JdNew + 0.5 + timeZone / 24);
}

function getSunLongitude(jdn, timeZone) {
  const T = (jdn - 2451545.5 - timeZone / 24) / 36525;
  const T2 = T * T;
  const dr = Math.PI / 180;
  const M = 357.5291 + 35999.0503 * T - 0.0001559 * T2 - 0.00000048 * T * T2;
  const L0 = 280.46645 + 36000.76983 * T + 0.0003032 * T2;
  let DL = (1.9146 - 0.004817 * T - 0.000014 * T2) * Math.sin(dr * M);
  DL =
    DL +
    (0.019993 - 0.000101 * T) * Math.sin(dr * 2 * M) +
    0.00029 * Math.sin(dr * 3 * M);
  let L = L0 + DL;
  L = L * dr;
  L = L - Math.PI * 2 * Math.floor(L / (Math.PI * 2));
  return Math.floor((L / Math.PI) * 6);
}

function getLunarMonth11(yy, timeZone) {
  const off = jdFromDate(31, 12, yy) - 2415021;
  const k = Math.floor(off / 29.530588853);
  let nm = getNewMoonDay(k, timeZone);
  const sunLong = getSunLongitude(nm, timeZone);
  if (sunLong >= 9) {
    nm = getNewMoonDay(k - 1, timeZone);
  }
  return nm;
}

function getLeapMonthOffset(a11, timeZone) {
  const k = Math.floor((a11 - 2415021.076998695) / 29.530588853 + 0.5);
  let last = 0;
  let i = 1;
  let arc = getSunLongitude(getNewMoonDay(k + i, timeZone), timeZone);
  do {
    last = arc;
    i++;
    arc = getSunLongitude(getNewMoonDay(k + i, timeZone), timeZone);
  } while (arc != last && i < 14);
  return i - 1;
}

function convertSolar2Lunar(dd, mm, yy, timeZone = 7) {
  const dayNumber = jdFromDate(dd, mm, yy);
  const k = Math.floor((dayNumber - 2415021.076998695) / 29.530588853);
  let monthStart = getNewMoonDay(k + 1, timeZone);
  if (monthStart > dayNumber) {
    monthStart = getNewMoonDay(k, timeZone);
  }
  let a11 = getLunarMonth11(yy, timeZone);
  let b11 = a11;
  let lunarYear;
  if (a11 >= monthStart) {
    lunarYear = yy;
    a11 = getLunarMonth11(yy - 1, timeZone);
  } else {
    lunarYear = yy + 1;
    b11 = getLunarMonth11(yy + 1, timeZone);
  }
  const lunarDay = dayNumber - monthStart + 1;
  const diff = Math.floor((monthStart - a11) / 29);
  let lunarLeap = 0;
  let lunarMonth = diff + 11;
  if (b11 - a11 > 365) {
    const leapMonthDiff = getLeapMonthOffset(a11, timeZone);
    if (diff >= leapMonthDiff) {
      lunarMonth = diff + 10;
      if (diff == leapMonthDiff) {
        lunarLeap = 1;
      }
    }
  }
  if (lunarMonth > 12) {
    lunarMonth = lunarMonth - 12;
  }
  if (lunarMonth >= 11 && diff < 4) {
    lunarYear -= 1;
  }
  return { day: lunarDay, month: lunarMonth, year: lunarYear, leap: lunarLeap };
}

function getCanChi(year) {
  const can = [
    "Canh",
    "Tân",
    "Nhâm",
    "Quý",
    "Giáp",
    "Ất",
    "Bính",
    "Đinh",
    "Mậu",
    "Kỷ",
  ];
  const chi = [
    "Thân",
    "Dậu",
    "Tuất",
    "Hợi",
    "Tý",
    "Sửu",
    "Dần",
    "Mão",
    "Thìn",
    "Tỵ",
    "Ngọ",
    "Mùi",
  ];
  return can[(year + 6) % 10] + " " + chi[(year + 8) % 12];
}

function formatLunarDate(solarDateString) {
  if (!solarDateString) return "";

  try {
    const solarDate = new Date(solarDateString);
    const dd = solarDate.getDate();
    const mm = solarDate.getMonth() + 1;
    const yy = solarDate.getFullYear();

    const lunar = convertSolar2Lunar(dd, mm, yy, 7);
    const canChi = getCanChi(lunar.year);

    // Format: "19 tháng 9 năm Giáp Thìn"
    return `${lunar.day} tháng ${lunar.month} năm ${canChi}`;
  } catch (error) {
    console.error("Error converting to lunar date:", error);
    return "";
  }
}

// ============= HELPER FUNCTIONS =============

function generateUUID() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Build full image URL from filename
function getImageUrl(filename) {
  return storageDAL.getPublicUrl(filename);
}

// Resize image if too large (use BL layer)
async function resizeImage(
  file,
  maxSizeMB = 1,
  maxWidth = 1920,
  maxHeight = 1920,
  quality = 0.85,
) {
  return await imageBL.resizeImage(file);
}


// ============= IMAGE PREVIEW FUNCTIONS =============

function showImagePreview(fieldName, url) {
  const prefix = fieldName.replace("_url", "").replace("_image", "");
  const uploadArea = document.getElementById(`${prefix}-upload-area`);
  const preview = document.getElementById(`${prefix}-preview`);
  const previewImg = document.getElementById(`${prefix}-preview-img`);

  if (uploadArea && preview && previewImg) {
    uploadArea.classList.add("hidden");
    preview.classList.remove("hidden");
    previewImg.src = url;
  }
}

function renderGalleryGrid() {
  const container = document.getElementById("gallery-container");
  if (!container) return;

  container.innerHTML = "";
  document.getElementById("gallery-add-btn")?.remove();

  // Get existing filenames from textarea
  const textarea = document.querySelector(
    'textarea[name="gallery_images_raw"]',
  );
  const existingFilenames = textarea
    ? textarea.value.trim().split("\n").filter(Boolean)
    : [];

  // Render existing images from DB
  existingFilenames.forEach((filename, index) => {
    const fullUrl = getImageUrl(filename);
    const div = document.createElement("div");
    div.className =
      "relative rounded-xl overflow-hidden border border-rose-200 shadow-sm group bg-gray-100";
    div.style.width = "100%";
    div.style.aspectRatio = "1";
    div.innerHTML = `
      <img src="${fullUrl}" alt="Gallery ${index + 1}" class="w-full h-full object-contain" />
      <button onclick="adjustGalleryFocalPoint(${index}, '${fullUrl}')" title="Chỉnh điểm lấy nét" class="absolute bottom-1 right-1 bg-black/50 hover:bg-black/70 text-white rounded-full w-6 h-6 flex items-center justify-center transition-colors shadow-md">
        <i data-lucide="focus" class="w-3.5 h-3.5"></i>
      </button>
      <button onclick="removeExistingGalleryImage(${index})" class="absolute top-1 right-1 bg-red-500 rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600 transition-colors shadow-md p-1">
        <img src="../assets/icons/bin.png" alt="Delete" class="w-full h-full" />
      </button>
    `;
    container.appendChild(div);
  });

  // Render pending new uploads
  pendingUploads.galleryImages.forEach((file, index) => {
    const url = URL.createObjectURL(file);
    const globalIndex = existingFilenames.length + index;
    const div = document.createElement("div");
    div.className =
      "relative rounded-xl overflow-hidden border border-rose-200 shadow-sm group bg-gray-100";
    div.style.width = "100%";
    div.style.aspectRatio = "1";
    div.innerHTML = `
      <img src="${url}" alt="New ${index + 1}" class="w-full h-full object-contain" />
      <button onclick="adjustGalleryFocalPoint(${globalIndex}, '${url}')" title="Chỉnh điểm lấy nét" class="absolute bottom-1 right-1 bg-black/50 hover:bg-black/70 text-white rounded-full w-6 h-6 flex items-center justify-center transition-colors shadow-md">
        <i data-lucide="focus" class="w-3.5 h-3.5"></i>
      </button>
      <button onclick="removeGalleryImage(${index})" class="absolute top-1 right-1 bg-red-500 rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600 transition-colors shadow-md p-1">
        <img src="../assets/icons/bin.png" alt="Delete" class="w-full h-full" />
      </button>
    `;
    container.appendChild(div);
  });

  if (typeof lucide !== "undefined") lucide.createIcons();

  const totalImages =
    existingFilenames.length + pendingUploads.galleryImages.length;

  // Render upload button outside grid if not at max
  if (totalImages < MAX_GALLERY_IMAGES) {
    const uploadBtn = document.createElement("button");
    uploadBtn.id = "gallery-add-btn";
    uploadBtn.type = "button";
    uploadBtn.className =
      "mt-2 flex items-center gap-1.5 h-8 px-3 rounded-xl border border-dashed border-rose-300 text-xs text-rose-400 hover:border-rose-400 hover:text-rose-500 transition-colors cursor-pointer";
    uploadBtn.onclick = () =>
      document.getElementById("gallery-file-input").click();
    uploadBtn.innerHTML = `
      <i data-lucide="image-plus" class="w-3.5 h-3.5"></i> Thêm ảnh
    `;
    container.insertAdjacentElement("afterend", uploadBtn);
    if (typeof lucide !== "undefined") lucide.createIcons();
  }
}

function renderSingleImageUpload(fieldName) {
  // Map field names to container IDs
  const containerMap = {
    cover_image_url: "cover",
    groom_image_url: "groom",
    bride_image_url: "bride",
    groom_qr_url: "groom-qr",
    bride_qr_url: "bride-qr",
  };

  const prefix = containerMap[fieldName];
  if (!prefix) {
    console.error(`Unknown field name: ${fieldName}`);
    return;
  }

  const container = document.getElementById(`${prefix}-container`);

  if (!container) {
    console.error(`Container not found: ${prefix}-container`);
    return;
  }

  container.innerHTML = "";

  // Determine size and object-fit based on field
  let sizeClass, objectFit;
  if (fieldName === "cover_image_url") {
    sizeClass = "aspect-[3/4]"; // Khung dọc cho cover
    objectFit = "object-cover";
  } else if (
    fieldName === "groom_image_url" ||
    fieldName === "bride_image_url"
  ) {
    sizeClass = ""; // kích thước cố định 175x100, set inline
    objectFit = "object-cover";
  } else if (fieldName === "groom_qr_url" || fieldName === "bride_qr_url") {
    sizeClass = "aspect-square"; // QR code hình vuông — cover + focal point để cắt theo ý người dùng
    objectFit = "object-cover";
  } else {
    sizeClass = "aspect-square";
    objectFit = "object-contain";
  }

  const _fp = FOCAL_POINT_FIELDS.includes(fieldName) ? pendingFocalPoints[fieldName] : null;
  const _fpStyle = _fp ? ` style="object-position: ${_fp.x}% ${_fp.y}%"` : "";

  // Nút chỉnh khung: QR → cắt lại (crop); ảnh khác → điểm lấy nét (focal)
  const _adjustBtn = CROP_FIELDS.includes(fieldName)
    ? `<button onclick="recropSingleImage('${fieldName}')" title="Cắt lại ảnh" class="absolute bottom-1 right-1 bg-black/50 hover:bg-black/70 text-white rounded-full w-6 h-6 flex items-center justify-center transition-colors shadow-md">
        <i data-lucide="crop" class="w-3.5 h-3.5"></i>
      </button>`
    : FOCAL_POINT_FIELDS.includes(fieldName)
    ? `<button onclick="adjustSingleImageFocalPoint('${fieldName}')" title="Chỉnh điểm lấy nét" class="absolute bottom-1 right-1 bg-black/50 hover:bg-black/70 text-white rounded-full w-6 h-6 flex items-center justify-center transition-colors shadow-md">
        <i data-lucide="focus" class="w-3.5 h-3.5"></i>
      </button>`
    : "";

  // Check if there's a pending upload (new file selected)
  if (pendingUploads.singleImages[fieldName]) {
    // Has new image, show preview from File object
    const url = URL.createObjectURL(pendingUploads.singleImages[fieldName]);
    const div = document.createElement("div");
    div.className = `relative ${sizeClass} rounded-xl overflow-hidden border border-rose-200 shadow-sm group bg-gray-100`;
    if (fieldName === "groom_image_url" || fieldName === "bride_image_url") {
      div.style.width = "100%";
      div.style.maxWidth = "175px";
      div.style.aspectRatio = "1.75";
    }
    div.innerHTML = `
      <img src="${url}" alt="Preview" class="w-full h-full ${objectFit}"${_fpStyle} />
      ${_adjustBtn}
      <button onclick="removeImage('${fieldName}')" class="absolute top-1 right-1 bg-red-500 rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600 transition-colors shadow-md p-1">
        <img src="../assets/icons/bin.png" alt="Delete" class="w-full h-full" />
      </button>
    `;
    container.appendChild(div);
    if (typeof lucide !== "undefined") lucide.createIcons();
  } else {
    // Check if there's an existing filename in hidden input
    const hiddenInput = document.querySelector(`input[name="${fieldName}"]`);
    const existingFilename = hiddenInput ? hiddenInput.value : null;

    if (existingFilename) {
      // Has existing image from DB, build full URL and show preview
      const fullUrl = getImageUrl(existingFilename);
      const div = document.createElement("div");
      div.className = `relative ${sizeClass} rounded-xl overflow-hidden border border-rose-200 shadow-sm group bg-gray-100`;
      if (fieldName === "groom_image_url" || fieldName === "bride_image_url") {
        div.style.width = "100%";
        div.style.maxWidth = "175px";
        div.style.aspectRatio = "1.75";
      }
      div.innerHTML = `
        <img src="${fullUrl}" alt="Preview" class="w-full h-full ${objectFit}"${_fpStyle} />
        ${_adjustBtn}
        <button onclick="removeImage('${fieldName}')" class="absolute top-1 right-1 bg-red-500 rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600 transition-colors shadow-md p-1">
          <img src="../assets/icons/bin.png" alt="Delete" class="w-full h-full" />
        </button>
      `;
      container.appendChild(div);
      if (typeof lucide !== "undefined") lucide.createIcons();
    } else {
      // No image at all, show upload button
      const uploadLabels = {
        cover_image_url: "Chọn ảnh cặp đôi",
        groom_image_url: "Chọn ảnh chú rể",
        bride_image_url: "Chọn ảnh cô dâu",
        groom_qr_url: "Chọn ảnh QR",
        bride_qr_url: "Chọn ảnh QR",
      };
      const uploadLabel = uploadLabels[fieldName] || "Chọn ảnh";

      const uploadBtn = document.createElement("button");
      uploadBtn.type = "button";
      uploadBtn.className = `flex items-center gap-1.5 h-8 px-3 rounded-xl border border-dashed border-rose-300 text-xs text-rose-400 hover:border-rose-400 hover:text-rose-500 transition-colors cursor-pointer`;
      uploadBtn.onclick = () =>
        document.getElementById(`${prefix}-file-input`).click();
      uploadBtn.innerHTML = `
        <i data-lucide="image-plus" class="w-3.5 h-3.5"></i> Thêm ảnh
      `;
      container.appendChild(uploadBtn);
      if (typeof lucide !== "undefined") lucide.createIcons();
    }
  }
}

// ============= PENDING UPLOADS STORAGE =============

const MAX_GALLERY_IMAGES = 10;

const pendingUploads = {
  singleImages: {}, // { fieldName: File }
  galleryImages: [], // [File, File, ...]
};

// Focal point (% x, % y) cho từng ảnh — quyết định object-position khi hiển thị ở các tỉ lệ khác nhau
const FOCAL_POINT_FIELDS = [
  "cover_image_url",
  "groom_image_url",
  "bride_image_url",
];
// Ảnh Hộp mừng cưới (QR) dùng logic CẮT ẢNH (crop 1:1) thay vì focal point
const CROP_FIELDS = ["groom_qr_url", "bride_qr_url"];
const pendingFocalPoints = {
  cover_image_url: { x: 50, y: 50 },
  groom_image_url: { x: 50, y: 50 },
  bride_image_url: { x: 50, y: 50 },
  groom_qr_url: { x: 50, y: 50 },
  bride_qr_url: { x: 50, y: 50 },
  // Map<key, {x,y}> — key là filename (ảnh đã có sẵn) hoặc chính File object (ảnh mới chọn, chưa upload).
  // Dùng key ổn định thay vì index để không bị lệch khi thêm/xoá/sắp xếp lại ảnh.
  gallery_images: new Map(),
};

// Quy đổi global index (vị trí hiển thị trong lưới) sang key ổn định để tra/lưu điểm lấy nét
function resolveGalleryFocalKey(globalIndex) {
  const textarea = document.querySelector(
    'textarea[name="gallery_images_raw"]',
  );
  const existingFilenames = textarea
    ? textarea.value.trim().split("\n").filter(Boolean)
    : [];
  if (globalIndex < existingFilenames.length) {
    return existingFilenames[globalIndex];
  }
  return (
    pendingUploads.galleryImages[globalIndex - existingFilenames.length] || null
  );
}

function getGalleryFocalPoint(key) {
  return pendingFocalPoints.gallery_images.get(key) || { x: 50, y: 50 };
}

function setGalleryFocalPoint(key, focal) {
  pendingFocalPoints.gallery_images.set(key, focal);
}

// Track deleted images (filenames that were in DB but user deleted)
const deletedImages = {
  singleImages: [], // [filename1, filename2, ...]
  galleryImages: [], // [filename1, filename2, ...]
};

// ============= PREVIEW FUNCTIONS (LOCAL) =============

async function handleImageUpload(event, fieldName) {
  const file = event.target.files[0];
  if (!file) return;

  console.log(
    `Selected image for ${fieldName}: ${file.name}, size: ${(file.size / 1024 / 1024).toFixed(2)}MB`,
  );

  if (!file.type.startsWith("image/")) {
    showToast("❌ Chỉ chấp nhận file ảnh!");
    return;
  }

  if (CROP_FIELDS.includes(fieldName)) {
    // Hộp mừng cưới: mở modal cắt ảnh (crop 1:1, có zoom + kéo) rồi lưu ảnh đã cắt
    openImageCropModal(
      file,
      (blob) => _storeCroppedImage(fieldName, blob, file.name),
      _qrGiftInfo(fieldName),
    );
    return;
  }

  if (FOCAL_POINT_FIELDS.includes(fieldName)) {
    // Mở picker chọn điểm lấy nét trước khi xử lý & lưu ảnh
    openFocalPointPicker(file, pendingFocalPoints[fieldName], async (focal) => {
      pendingFocalPoints[fieldName] = focal;
      showLoading(
        true,
        "Ảnh vượt quá dung lượng cho phép, đang nén ảnh lại...",
      );
      try {
        const processedFile = await resizeImage(file, 1, 1920, 1920);
        pendingUploads.singleImages[fieldName] = processedFile;
        _idbSaveSingle(fieldName, processedFile);
        _idbDelete(`${WEDDING_ID}_sf_${fieldName}`);
        renderSingleImageUpload(fieldName);
        showToast("✅ Đã chọn ảnh (chưa lưu)");
      } catch (error) {
        console.error("Error processing image:", error);
        showToast("❌ Lỗi xử lý ảnh: " + error.message);
      } finally {
        showLoading(false);
      }
    }, _qrGiftInfo(fieldName));
  } else {
    // Normal image upload (no crop)
    showLoading(true, "Ảnh vượt quá dung lượng cho phép, đang nén ảnh lại...");

    try {
      // Resize image locally
      const processedFile = await resizeImage(file, 1, 1920, 1920);

      // Store file for later upload
      pendingUploads.singleImages[fieldName] = processedFile;
      _idbSaveSingle(fieldName, processedFile);

      // Render UI
      renderSingleImageUpload(fieldName);

      showToast("✅ Đã chọn ảnh (chưa lưu)");
    } catch (error) {
      console.error("Error processing image:", error);
      showToast("❌ Lỗi xử lý ảnh: " + error.message);
    } finally {
      showLoading(false);
    }
  }
}

/**
 * Với field QR (groom_qr_url/bride_qr_url): đọc thông tin ngân hàng của đúng bên
 * để focal picker hiển thị preview giống block Hộp Mừng Cưới. Field khác → null.
 */
function _qrGiftInfo(fieldName) {
  if (fieldName !== "groom_qr_url" && fieldName !== "bride_qr_url") return null;
  const side = fieldName === "groom_qr_url" ? "groom" : "bride";
  const form = document.getElementById("wedding-form");
  const fd = form ? new FormData(form) : null;
  const v = (n) => (fd ? (fd.get(n) || "").toString().trim() : "");
  const name = v(`${side}_name`);
  return {
    label: (side === "groom" ? "Chú Rể" : "Cô Dâu") + (name ? ` · ${name}` : ""),
    bankName: v(`${side}_bank_name`),
    bankNumber: v(`${side}_bank_number`),
    bankOwner: v(`${side}_bank_owner`),
  };
}

/**
 * Mở picker chỉnh lại điểm lấy nét cho ảnh field đơn (cover/groom/bride/QR) đã có sẵn hoặc đang chờ upload
 */
function adjustSingleImageFocalPoint(fieldName) {
  const pendingFile = pendingUploads.singleImages[fieldName];
  const hiddenInput = document.querySelector(`input[name="${fieldName}"]`);
  const existingFilename = hiddenInput ? hiddenInput.value : null;
  const source =
    pendingFile || (existingFilename ? getImageUrl(existingFilename) : null);
  if (!source) return;

  openFocalPointPicker(source, pendingFocalPoints[fieldName], (focal) => {
    pendingFocalPoints[fieldName] = focal;
    renderSingleImageUpload(fieldName);
    if (pendingUploads.singleImages[fieldName]) {
      _idbSaveSingle(fieldName, pendingUploads.singleImages[fieldName]);
    } else {
      _idbSaveFocal(fieldName);
    }
    showToast("✅ Đã cập nhật điểm lấy nét");
  }, _qrGiftInfo(fieldName));
}

/**
 * Lưu ảnh đã cắt (blob từ crop modal) cho field QR — thay ảnh, xoá focal cũ
 */
function _storeCroppedImage(fieldName, blob, origName) {
  if (!blob) return;
  const base = (origName || "qr").replace(/\.[^.]+$/, "");
  const file = new File([blob], `${base}.png`, { type: "image/png" });
  pendingUploads.singleImages[fieldName] = file;
  _idbSaveSingle(fieldName, file);
  _idbDelete(`${WEDDING_ID}_sf_${fieldName}`); // xoá bản ghi focal-only (nếu có)
  // Crop đã "nướng" khung hình vào ảnh → không cần focal point nữa
  pendingFocalPoints[fieldName] = { x: 50, y: 50 };
  renderSingleImageUpload(fieldName);
  showToast("✅ Đã cắt ảnh (chưa lưu)");
}

/**
 * Mở lại modal cắt ảnh cho field QR (ảnh đang chờ upload hoặc ảnh đã lưu)
 */
async function recropSingleImage(fieldName) {
  let source = pendingUploads.singleImages[fieldName];
  if (!source) {
    const hiddenInput = document.querySelector(`input[name="${fieldName}"]`);
    const existingFilename = hiddenInput ? hiddenInput.value : null;
    if (!existingFilename) return;
    try {
      const resp = await fetch(getImageUrl(existingFilename));
      source = await resp.blob();
    } catch (e) {
      console.error("recrop fetch error:", e);
      showToast("❌ Không tải được ảnh để cắt lại");
      return;
    }
  }
  openImageCropModal(
    source,
    (blob) => _storeCroppedImage(fieldName, blob, source.name),
    _qrGiftInfo(fieldName),
  );
}

/**
 * Mở picker chỉnh lại điểm lấy nét cho 1 ảnh trong thư viện theo index
 */
function adjustGalleryFocalPoint(globalIndex, source) {
  if (!source) return;
  const key = resolveGalleryFocalKey(globalIndex);
  if (!key) return;
  openFocalPointPicker(source, getGalleryFocalPoint(key), (focal) => {
    setGalleryFocalPoint(key, focal);
    if (key instanceof File) _idbUpdateGalleryFocal(key);
    else _idbSaveGalleryFocal(key);
    showToast("✅ Đã cập nhật điểm lấy nét");
  });
}

// ============= YOUTUBE SEARCH =============
function _escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function _renderYtItems(items) {
  return items.map(item => `
    <button type="button" data-yt-url="${_escHtml(item.url)}"
      class="yt-result-btn w-full flex gap-3 p-2 rounded-lg hover:bg-rose-50 text-left transition-colors">
      <img src="${_escHtml(item.thumbnail)}" class="w-20 h-12 rounded object-cover shrink-0 bg-gray-100" loading="lazy" />
      <div class="min-w-0 flex-1">
        <p class="text-xs font-medium text-gray-800 line-clamp-2 leading-snug">${_escHtml(item.title)}</p>
        <p class="text-[10px] text-gray-400 mt-1">${_escHtml(item.channel)}${item.duration ? ' · ' + _escHtml(item.duration) : ''}</p>
      </div>
    </button>
  `).join('');
}

function _rewireYtResultBtns(container) {
  container.querySelectorAll('.yt-result-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const url = btn.dataset.ytUrl;
      if (!url) return;
      const ytInput = document.getElementById('youtube-link-input');
      ytInput.value = url;
      ytInput.dispatchEvent(new Event('input', { bubbles: true }));
      container.innerHTML = '';
      autoPreviewYouTubeMusic();
    });
  });
}

let _ytSuggestionsCache = null;

async function _showYouTubeSuggestions() {
  const results = document.getElementById('youtube-search-results');
  if (!results) return;

  if (_ytSuggestionsCache) {
    results.innerHTML = _ytSuggestionsCache;
    _rewireYtResultBtns(results);
    return;
  }

  results.innerHTML = '<p class="text-xs text-gray-400 py-3 text-center">Đang tải gợi ý...</p>';

  try {
    const res = await fetch(
      `${CONFIG.supabase.edgeUrl}?resource=youtube-search&q=${encodeURIComponent('Một đời')}`,
      { headers: { Authorization: `Bearer ${CONFIG.supabase.anonKey}` } }
    );
    const items = await res.json();

    if (!Array.isArray(items) || items.length === 0) {
      results.innerHTML = '';
      return;
    }

    results.innerHTML =
      '<p class="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-1 pb-1 pt-0.5">Gợi ý</p>' +
      _renderYtItems(items);

    _ytSuggestionsCache = results.innerHTML;
    _rewireYtResultBtns(results);
  } catch {
    results.innerHTML = '';
  }
}

async function _doYouTubeSearch(q) {
  const results = document.getElementById('youtube-search-results');
  if (!results) return;

  results.innerHTML = '<p class="text-xs text-gray-400 py-3 text-center">Đang tìm...</p>';

  try {
    const res = await fetch(
      `${CONFIG.supabase.edgeUrl}?resource=youtube-search&q=${encodeURIComponent(q)}`,
      { headers: { Authorization: `Bearer ${CONFIG.supabase.anonKey}` } }
    );
    const items = await res.json();

    if (!Array.isArray(items) || items.length === 0) {
      results.innerHTML = '<p class="text-xs text-gray-400 py-3 text-center">Không tìm thấy kết quả.</p>';
      return;
    }

    results.innerHTML = _renderYtItems(items);
    _rewireYtResultBtns(results);
  } catch {
    results.innerHTML = '<p class="text-xs text-red-400 py-3 text-center">Lỗi tìm kiếm. Vui lòng thử lại.</p>';
  }
}

// ============= YOUTUBE MUSIC FUNCTIONS =============
function extractYouTubeVideoId(url) {
  // Support various YouTube URL formats
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

function autoPreviewYouTubeMusic() {
  const input   = document.getElementById("youtube-link-input");
  const preview = document.getElementById("youtube-preview");
  const error   = document.getElementById("youtube-error");
  const results = document.getElementById("youtube-search-results");
  const val     = input.value.trim();

  if (!val) {
    preview.classList.add("hidden");
    error?.classList.add("hidden");
    input.classList.remove("border-red-400");
    _showYouTubeSuggestions();
    return;
  }

  const isUrl = val.includes('youtube.com') || val.includes('youtu.be');

  if (isUrl) {
    if (results) results.innerHTML = '';
    const videoId = extractYouTubeVideoId(val);
    if (!videoId) {
      preview.classList.add("hidden");
      error?.classList.remove("hidden");
      input.classList.add("border-red-400");
      return;
    }
    error?.classList.add("hidden");
    input.classList.remove("border-red-400");
    showYouTubePreview(videoId, val);
  } else {
    preview.classList.add("hidden");
    error?.classList.add("hidden");
    input.classList.remove("border-red-400");
    _doYouTubeSearch(val);
  }
}

let _ytPreviewPlayer = null;
let _ytApiInjected = false;
const _ytApiQueue = [];

window.onYouTubeIframeAPIReady = function () {
  _ytApiQueue.forEach(cb => cb());
  _ytApiQueue.length = 0;
};

function _ensureYTApi(cb) {
  if (window.YT?.Player) return cb();
  _ytApiQueue.push(cb);
  if (!_ytApiInjected) {
    _ytApiInjected = true;
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(s);
  }
}

function showYouTubePreview(videoId, url) {
  const preview = document.getElementById("youtube-preview");

  if (_ytPreviewPlayer) {
    try { _ytPreviewPlayer.destroy(); } catch {}
    _ytPreviewPlayer = null;
  }

  // Tạo lại player container nếu đã bị remove() lần trước
  let playerWrap = document.getElementById('youtube-player-container');
  if (!playerWrap) {
    playerWrap = document.createElement('div');
    playerWrap.id = 'youtube-player-container';
    playerWrap.className = 'aspect-video bg-black rounded-lg overflow-hidden';
    preview.querySelector('.bg-gray-50').prepend(playerWrap);
  }
  playerWrap.innerHTML = '<div id="_yt_target" style="width:100%;height:100%"></div>';

  const thumb = document.getElementById('youtube-fallback-thumb');
  if (thumb) thumb.style.display = 'none';
  preview.classList.remove("hidden");

  _ensureYTApi(() => {
    _ytPreviewPlayer = new YT.Player('_yt_target', {
      videoId,
      playerVars: { autoplay: 0, modestbranding: 1, rel: 0 },
      events: {
        onError: (e) => {
          if (e.data === 101 || e.data === 150) {
            document.getElementById('youtube-player-container')?.remove();
            const thumb = document.getElementById('youtube-fallback-thumb');
            if (thumb) {
              thumb.src = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
              thumb.style.display = '';
              thumb.onclick = () =>
                window.open(`https://youtu.be/${videoId}`, '_blank');
            }
          }
        }
      }
    });
  });
}

function renderExistingYouTubeMusic(musicUrl) {
  if (
    !musicUrl ||
    (!musicUrl.includes("youtube.com") && !musicUrl.includes("youtu.be"))
  ) {
    return; // Not a YouTube URL
  }

  const input = document.getElementById("youtube-link-input");
  input.value = musicUrl;

  // Auto preview
  autoPreviewYouTubeMusic();
}


// Setup auto-preview on input change
document.addEventListener("DOMContentLoaded", function () {
  const input = document.getElementById("youtube-link-input");
  if (input) {
    // Debounce to avoid too many previews while typing
    let debounceTimer;
    input.addEventListener("input", function () {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        autoPreviewYouTubeMusic();
      }, 500); // Wait 500ms after user stops typing
    });

    // Also preview on paste
    input.addEventListener("paste", function () {
      setTimeout(() => {
        autoPreviewYouTubeMusic();
      }, 100);
    });
  }
});

async function handleGalleryUpload(event) {
  const files = Array.from(event.target.files);
  event.target.value = "";
  if (files.length === 0) return;

  const remainingSlots =
    MAX_GALLERY_IMAGES - pendingUploads.galleryImages.length;
  if (remainingSlots <= 0) {
    showToast(`❌ Đã đạt giới hạn ${MAX_GALLERY_IMAGES} ảnh`);
    return;
  }

  const filesToProcess = files.slice(0, remainingSlots);
  if (files.length > remainingSlots) {
    showToast(`⚠️ Chỉ chọn được ${remainingSlots} ảnh nữa`);
  }

  const errors = [];
  let added = 0;

  for (let i = 0; i < filesToProcess.length; i++) {
    const file = filesToProcess[i];
    if (!file.type.startsWith("image/")) {
      errors.push(`${file.name} không phải ảnh`);
      continue;
    }

    // Open focal point picker for this image
    const focal = await _openFocalPickerAsync(file, { x: 50, y: 50 });
    if (!focal) continue; // user cancelled this image

    showLoading(true, "Đang nén ảnh...");
    try {
      const processedFile = await resizeImage(file, 1, 1920, 1920);
      pendingUploads.galleryImages.push(processedFile);
      pendingFocalPoints.gallery_images.set(processedFile, focal);
      _idbAddGallery(processedFile);
      added++;
      const progress = Math.round((added / filesToProcess.length) * 100);
      const progressEl = document.getElementById("upload-progress");
      if (progressEl) progressEl.textContent = `${progress}%`;
    } catch (error) {
      console.error(`Error processing ${file.name}:`, error);
      errors.push(`${file.name}: ${error.message}`);
    } finally {
      showLoading(false);
    }
  }

  renderGalleryGrid();
  if (added > 0) showToast(`✅ Đã chọn ${added} ảnh (chưa lưu)`);
  if (errors.length > 0) showToast(`⚠️ ${errors.length} ảnh lỗi`);
}

// ============= ACTUAL UPLOAD FUNCTIONS =============

async function uploadSingleImage(fieldName, file) {
  // Use BL layer to upload
  return await imageBL.uploadSingleImage(WEDDING_ID, fieldName, file);
}

async function uploadAllPendingImages() {
  const uploadedFilenames = {};
  const errors = [];

  // Upload single images
  for (const [fieldName, file] of Object.entries(pendingUploads.singleImages)) {
    try {
      const filename = await uploadSingleImage(fieldName, file);
      uploadedFilenames[fieldName] = filename;
      console.log(`Uploaded ${fieldName}: ${filename}`);
    } catch (error) {
      console.error(`Error uploading ${fieldName}:`, error);
      errors.push(`${fieldName}: ${error.message}`);
    }
  }

  // Upload gallery images using BL layer
  if (pendingUploads.galleryImages.length > 0) {
    try {
      const result = await imageBL.uploadMultipleImages(
        WEDDING_ID,
        pendingUploads.galleryImages,
      );

      if (result.filenames.length > 0) {
        uploadedFilenames.gallery_images = result.filenames;
      }

      if (result.errors.length > 0) {
        result.errors.forEach((err) => {
          errors.push(`Gallery ${err.index + 1}: ${err.error}`);
        });
      }
    } catch (error) {
      console.error("Error uploading gallery:", error);
      errors.push(`Gallery: ${error.message}`);
    }
  }

  // Upload love story images
  for (const [idxStr, file] of Object.entries(_loveStoryPendingImages)) {
    const idx = parseInt(idxStr);
    try {
      const filename = await uploadSingleImage(`love_story_image_${idx}`, file);
      _loveStoryItems[idx].image_url = filename;
    } catch (error) {
      console.error(`Error uploading love story image ${idx}:`, error);
      errors.push(`Love story ảnh ${idx + 1}: ${error.message}`);
    }
  }
  if (Object.keys(_loveStoryPendingImages).length > 0) {
    Object.keys(_loveStoryPendingImages).forEach(
      (k) => delete _loveStoryPendingImages[k],
    );
    _syncLoveStoryHidden();
  }

  return { uploadedFilenames, errors };
}

// ============= REMOVE FUNCTIONS =============

function removeImage(fieldName) {
  // Check if this is a pending upload (temp image) or existing image from DB
  if (pendingUploads.singleImages[fieldName]) {
    // This is a temp image, just remove from pendingUploads
    delete pendingUploads.singleImages[fieldName];
    _idbDelete(`${WEDDING_ID}_s_${fieldName}`);
  } else {
    // This is an existing image from DB, mark for deletion
    const hiddenInput = document.querySelector(`input[name="${fieldName}"]`);
    const existingFilename = hiddenInput ? hiddenInput.value : null;

    if (existingFilename) {
      // Extract filename from URL if it's a full URL
      let filename = existingFilename;
      if (existingFilename.startsWith("http")) {
        // Extract filename from URL: https://...workers.dev/abc123.jpg -> abc123.jpg
        filename = existingFilename.split("/").pop();
      }
      deletedImages.singleImages.push(filename);
      console.log("Marked for deletion:", filename);
    }

    if (hiddenInput) hiddenInput.value = "";
  }
  // Clear any focal-only IDB record for this field
  _idbDelete(`${WEDDING_ID}_sf_${fieldName}`);

  // Reset điểm lấy nét về mặc định khi xóa ảnh
  if (FOCAL_POINT_FIELDS.includes(fieldName)) {
    pendingFocalPoints[fieldName] = { x: 50, y: 50 };
  }

  // Render UI
  renderSingleImageUpload(fieldName);

  showToast("🗑️ Đã xóa ảnh");
}

function removeGalleryImage(index) {
  // Remove from pending uploads (temp images not yet saved)
  // These are NEW images user just selected, not in DB yet
  const [removedFile] = pendingUploads.galleryImages.splice(index, 1);

  // Xoá điểm lấy nét gắn với ảnh này (key = chính File object, không phụ thuộc index)
  if (removedFile) {
    pendingFocalPoints.gallery_images.delete(removedFile);
    _idbRemoveGallery(removedFile);
  }

  // Render grid
  renderGalleryGrid();

  showToast("🗑️ Đã xóa ảnh");
}

function removeExistingGalleryImage(index) {
  // Remove from existing images (already in DB)
  const textarea = document.querySelector(
    'textarea[name="gallery_images_raw"]',
  );
  if (!textarea) return;

  const filenames = textarea.value.trim().split("\n").filter(Boolean);
  const deletedFilename = filenames[index];

  // Mark for deletion in Storage
  if (deletedFilename) {
    // Extract filename from URL if it's a full URL
    let filename = deletedFilename;
    if (deletedFilename.startsWith("http")) {
      // Extract filename from URL: https://...workers.dev/abc123.jpg -> abc123.jpg
      filename = deletedFilename.split("/").pop();
    }
    deletedImages.galleryImages.push(filename);
    console.log("Marked gallery image for deletion:", filename);
  }

  filenames.splice(index, 1);
  textarea.value = filenames.join("\n");

  // Xoá điểm lấy nét gắn với ảnh này (key = filename, không phụ thuộc index)
  if (deletedFilename) {
    pendingFocalPoints.gallery_images.delete(deletedFilename);
    _idbDelete(`${WEDDING_ID}_gf_${deletedFilename}`);
  }

  // Render grid
  renderGalleryGrid();

  showToast("🗑️ Đã xóa ảnh");
}

// ============= DATA FUNCTIONS =============

function _showContent() {
  document.getElementById("skeleton-loader")?.classList.add("hidden");
  document.getElementById("actual-content")?.classList.remove("hidden");
  _updateHeaderThemeBadge();
  const params = new URLSearchParams(window.location.search);
  const savedTab = params.get("tab");
  if (savedTab && savedTab !== "edit") switchTab(savedTab);
  // Reset dirty sau khi fill form xong — tránh false positive từ fillForm()
  setTimeout(() => _setDirty(false), 0);

  // Nếu được redirect về sau khi đăng nhập để xuất bản → auto trigger
  if (params.get('pendingPublish') === '1') {
    const cleanUrl = new URL(window.location.href);
    cleanUrl.searchParams.delete('pendingPublish');
    history.replaceState(null, '', cleanUrl.toString());
    setTimeout(() => publishWedding(), 300);
  }
}

function _updateLocalDraftNotice() {
  const notice = document.getElementById("local-draft-notice");
  if (!notice) return;
  notice.classList.toggle("hidden", !(_isLocalDraft && !getCurrentUser()));
}

async function loadData() {
  // Kiểm tra localStorage trước — nếu _localOnly thì KHÔNG gọi DB
  const localData = getLocalDraft();
  if (localData?._localOnly) {
    _isLocalDraft = true;
    if (!localData.theme)
      localData.theme = sessionStorage.getItem("draft_theme") || "basic-gold";
    fillForm(localData);
    _updateLocalDraftNotice();
    _showContent();
    await _idbRestoreAll();
    return;
  }

  // Có thể đã có trong DB → thử fetch
  try {
    const data = await weddingBL.getWeddingById(WEDDING_ID);
    _isLocalDraft = false;
    fillForm(data);
    _updateLocalDraftNotice();
    _showContent();
    await _idbRestoreAll();
    loadGuestList("groom").catch(console.error);
    loadGuestList("bride").catch(console.error);
  } catch (_dbError) {
    // Không có trong DB và không có localStorage → draft hoàn toàn mới
    _isLocalDraft = true;
    WEDDING_THEME = sessionStorage.getItem("draft_theme") || "basic-gold";
    fillForm({ theme: WEDDING_THEME, is_published: false });
    _updateLocalDraftNotice();
    _showContent();
    await _idbRestoreAll();
  }
}

function fillForm(data) {
  const form = document.getElementById("wedding-form");
  if (!form) return;

  console.log("Filling form with data:", data);
  console.log(
    "Available Flatpickr instances:",
    window.flatpickrInstances ? Object.keys(window.flatpickrInstances) : "none",
  );

  // Save slug + theme for generating links
  if (data.slug) {
    WEDDING_SLUG = data.slug;
    if (data.theme) WEDDING_THEME = data.theme;
    // Điền slug vào input
    const slugInput = document.getElementById("slug-input");
    if (slugInput) slugInput.value = data.slug;
    // Update links
    const groomLink = document.getElementById("link-groom");
    const brideLink = document.getElementById("link-bride");
    if (groomLink) groomLink.value = `${DOMAIN}/${data.slug}?isGroom=true`;
    if (brideLink) brideLink.value = `${DOMAIN}/${data.slug}`;
  }

  // Process image_focal_points FIRST so pendingFocalPoints is ready before any renderSingleImageUpload call
  if (data.image_focal_points) {
    let points = data.image_focal_points;
    if (typeof points === "string") { try { points = JSON.parse(points); } catch (e) { points = {}; } }
    if (points && typeof points === "object") {
      FOCAL_POINT_FIELDS.forEach((field) => {
        if (points[field] && typeof points[field].x === "number") {
          pendingFocalPoints[field] = { x: points[field].x, y: points[field].y };
        }
      });
      const galleryFp = points.gallery_images;
      const entries = galleryFp && typeof galleryFp === "object" && !Array.isArray(galleryFp)
        ? Object.entries(galleryFp).filter(([, p]) => p && typeof p.x === "number" && typeof p.y === "number")
        : [];
      pendingFocalPoints.gallery_images = new Map(entries);
    }
  }

  Object.keys(data).forEach((key) => {
    let el = form.querySelector(`[name="${key}"]`);
    // Các control tuỳ biến (<x-input>/<x-date>/<x-time>) giữ attribute name và đứng trước
    // <input> con → phải nhắm vào control thật bên trong.
    if (el && el.tagName.startsWith("X-"))
      el = el.querySelector("input, textarea, select") || el;

    if (key === "gallery_images") {
      const textarea = form.querySelector('[name="gallery_images_raw"]');
      if (textarea) {
        console.log("Gallery images from DB:", data[key]);
        // Store filenames in textarea
        const images = Array.isArray(data[key]) ? data[key] : [];
        textarea.value = images.join("\n");
        console.log("Textarea value:", textarea.value);
        renderGalleryGrid();
      }
      return; // Skip the rest for gallery_images
    }

    // Skip if data is null
    if (data[key] == null) return;

    // Special handling for bank fields
    if (key === "groom_bank_name") {
      const input = document.getElementById("groom-bank-input");
      const hidden = document.getElementById("groom-bank-value");
      if (input) input.value = data[key];
      if (hidden) hidden.value = data[key];
      return;
    }

    if (key === "bride_bank_name") {
      const input = document.getElementById("bride-bank-input");
      const hidden = document.getElementById("bride-bank-value");
      if (input) input.value = data[key];
      if (hidden) hidden.value = data[key];
      return;
    }

    // Special handling for section visibility toggles
    if (key in SECTION_VIS_FIELDS) {
      // handled by _initVisToggles below
      return;
    }

    // Special handling for timeline (JSON string)
    if (key === "timeline") {
      let items = [];
      try {
        items =
          typeof data[key] === "string"
            ? JSON.parse(data[key])
            : Array.isArray(data[key])
              ? data[key]
              : [];
      } catch (e) {
        items = [];
      }
      _timelineItems = items;
      _syncTimelineHidden();
      renderTimelineList();
      return;
    }

    // Special handling for love_story (JSONB)
    if (key === "love_story") {
      const raw = data[key];
      if (raw === null || raw === undefined) return;
      let items = [];
      try {
        items =
          typeof raw === "string"
            ? JSON.parse(raw)
            : Array.isArray(raw)
              ? raw
              : [];
      } catch (e) {
        items = [];
      }
      _loveStoryItems = items;
      _loveStoryKeyExists = true;
      _syncLoveStoryHidden();
      renderLoveStoryList();
      return;
    }

    // image_focal_points already processed before this loop
    if (key === "image_focal_points") return;

    // Special handling for YouTube music URL
    if (key === "music_url") {
      _currentMusicUrl = data[key] || "";
      if (data[key]) renderExistingYouTubeMusic(data[key]);
      return;
    }

    // Check if this is a date field with Flatpickr
    if (window.flatpickrInstances && window.flatpickrInstances[key]) {
      console.log(`Setting date for ${key} using Flatpickr:`, data[key]);
      // Set value using Flatpickr instance
      window.flatpickrInstances[key].setDate(data[key], true);

      // Manually trigger lunar date update for date fields
      if (
        key === "ceremony_date" ||
        key === "groom_party_date" ||
        key === "bride_party_date"
      ) {
        const event = new Event("change", { bubbles: true });
        el.dispatchEvent(event);
      }
    } else if (el) {
      // Store value in input for non-date fields
      el.value = data[key];
      // Gán .value bằng code không phát "input" → tự đồng bộ nút "x" xoá của
      // <x-input>/<x-textarea> để nó hiện đúng khi ô có nội dung sau khi nạp DB.
      el.closest("x-input, x-textarea")?.syncClearBtn?.();
    }

    // For image URL fields, render the UI
    if (
      key === "cover_image_url" ||
      key === "groom_image_url" ||
      key === "bride_image_url" ||
      key === "groom_qr_url" ||
      key === "bride_qr_url"
    ) {
      if (data[key]) {
        renderSingleImageUpload(key);
      }
    } else if (key.includes("_url") && data[key]) {
      showImagePreview(key, data[key]);
    }
  });

  _initVisToggles(data);
  if (typeof initMapDisplays === "function") initMapDisplays(data);
  initCeremonySection(data);

  IS_PUBLISHED = !!data.is_published;
  _syncAdvancedSection();

  if (typeof lucide !== "undefined") lucide.createIcons();

  // Sync clear-button state on all x-input components after programmatic fill
  document.querySelectorAll('x-input').forEach(el => el.syncClearBtn?.());
}

async function saveAll(overrides = {}, label = "Đang lưu...") {
  const form = document.getElementById("wedding-form");
  if (!validateForm(form)) { showLoading(false); return false; }

  try {
    // Step 1: Upload pending images
    showLoading(true, "Đang tải ảnh lên server...");
    const { uploadedFilenames, errors } = await uploadAllPendingImages();
    showLoading(true, label);

    if (errors.length > 0) {
      console.error("Upload errors:", errors);
      showToast(`⚠️ ${errors.length} ảnh lỗi khi upload`);
    }

    // Step 2: Prepare form data
    const form = document.getElementById("wedding-form");
    const formData = new FormData(form);
    const payload = { id: WEDDING_ID, slug: WEDDING_SLUG };

    // Step 2.5: Get YouTube music URL (prioritize textbox input over hidden input)
    const youtubeTextbox = document.getElementById("youtube-link-input");
    const musicUrlInput = document.getElementById("music-url-input");

    // Use textbox value if available, otherwise use hidden input
    const musicUrl =
      youtubeTextbox?.value?.trim() || musicUrlInput?.value?.trim();

    if (musicUrl) {
      // Validate YouTube URL
      const videoId = extractYouTubeVideoId(musicUrl);
      if (videoId) {
        payload.music_url = musicUrl;
      } else {
        console.warn("Invalid YouTube URL:", musicUrl);
      }
    } else {
      // If empty, explicitly set to null to clear music
      payload.music_url = null;
    }

    // Add deleted images list
    const allDeletedImages = [
      ...deletedImages.singleImages,
      ...deletedImages.galleryImages,
    ];
    console.log("Deleted images to send:", allDeletedImages);
    if (allDeletedImages.length > 0) {
      payload.deleted_images = allDeletedImages;
      console.log("Added deleted_images to payload:", payload.deleted_images);
    }

    formData.forEach((value, key) => {
      if (key === "gallery_images_raw" || key === "slug") return;
      if (typeof value !== "string") return; // skip File objects
      if (value.trim()) {
        payload[key] = value.trim();
      } else if (key.includes("_url") || key.includes("_lunar")) {
        payload[key] = null;
      }
    });

    // Step 3: Add uploaded filenames to payload
    for (const [fieldName, filename] of Object.entries(uploadedFilenames)) {
      if (fieldName === "gallery_images") {
        // Get existing gallery filenames from form
        const textarea = document.querySelector(
          'textarea[name="gallery_images_raw"]',
        );
        const existingFilenames = textarea
          ? textarea.value.trim().split("\n").filter(Boolean)
          : [];

        // Merge existing filenames with newly uploaded filenames
        payload.gallery_images = [...existingFilenames, ...filename];
      } else {
        payload[fieldName] = filename;
      }
    }

    // Handle gallery images if no new uploads
    if (!uploadedFilenames.gallery_images) {
      const textarea = document.querySelector(
        'textarea[name="gallery_images_raw"]',
      );
      if (textarea) {
        payload.gallery_images = textarea.value
          .trim()
          .split("\n")
          .filter(Boolean);
      }
    }

    // Step 3.5: Build điểm lấy nét (focal points) cho payload
    // gallery_images lưu dạng map { filename: {x,y} } — tra theo tên file (key ổn định),
    // không phụ thuộc thứ tự/ index nên thêm/xoá/sắp xếp lại ảnh không làm lệch dữ liệu
    const galleryFocalMap = {};
    const newGalleryFilenames = uploadedFilenames.gallery_images || [];
    pendingUploads.galleryImages.forEach((file, i) => {
      const fn = newGalleryFilenames[i];
      if (fn) galleryFocalMap[fn] = getGalleryFocalPoint(file);
    });
    (payload.gallery_images || []).forEach((fn) => {
      if (!(fn in galleryFocalMap))
        galleryFocalMap[fn] = getGalleryFocalPoint(fn);
    });

    payload.image_focal_points = {
      cover_image_url: pendingFocalPoints.cover_image_url,
      groom_image_url: pendingFocalPoints.groom_image_url,
      bride_image_url: pendingFocalPoints.bride_image_url,
      groom_qr_url: pendingFocalPoints.groom_qr_url,
      bride_qr_url: pendingFocalPoints.bride_qr_url,
      gallery_images: galleryFocalMap,
    };

    // Apply overrides (e.g. is_published: true from publishWedding)
    Object.assign(payload, overrides);

    // Step 4: Luôn lưu vào localStorage trước
    saveLocalDraft(payload);

    // Step 4b: Lưu DB nếu record đã tồn tại, hoặc user đã đăng nhập
    if (!_isLocalDraft) {
      // Record đã có trong DB → PATCH bình thường
      await weddingBL.updateWedding(payload);
    } else if (getCurrentUser()) {
      // Local draft + đã đăng nhập → tạo record trong DB lần đầu
      const generatedSlug = payload.slug || `wedding-${WEDDING_ID.slice(0, 8)}`;
      await fetch(CONFIG.supabase.edgeUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${CONFIG.supabase.anonKey}`,
        },
        body: JSON.stringify({
          manage_id: WEDDING_ID,
          theme: WEDDING_THEME,
          is_published: false,
          slug: generatedSlug,
        }),
      });
      WEDDING_SLUG = generatedSlug;
      payload.slug = generatedSlug;
      await weddingBL.updateWedding(payload);
      _isLocalDraft = false;
      clearLocalDraft();
    }
    // else: chỉ localStorage, chưa đăng nhập → không lưu DB

    _updateLocalDraftNotice();

    // Step 5: Update hidden inputs with uploaded filenames
    for (const [fieldName, filename] of Object.entries(uploadedFilenames)) {
      if (fieldName !== "gallery_images") {
        const hiddenInput = document.querySelector(
          `input[name="${fieldName}"]`,
        );
        if (hiddenInput) {
          hiddenInput.value = filename;
        }
      }
    }

    // Update gallery textarea with all filenames (existing + new)
    if (uploadedFilenames.gallery_images) {
      const textarea = document.querySelector(
        'textarea[name="gallery_images_raw"]',
      );
      if (textarea) {
        const existingFilenames = textarea.value
          .trim()
          .split("\n")
          .filter(Boolean);
        const allFilenames = [
          ...existingFilenames,
          ...uploadedFilenames.gallery_images,
        ];
        textarea.value = allFilenames.join("\n");
      }
    }

    // Step 6: Clear pending uploads and deleted images
    pendingUploads.singleImages = {};
    pendingUploads.galleryImages = [];
    deletedImages.singleImages = [];
    deletedImages.galleryImages = [];
    _galleryIdbKeys.clear();
    _idbClearWedding();

    // Step 7: Re-render UI to reflect saved state
    renderSingleImageUpload("cover_image_url");
    renderSingleImageUpload("groom_image_url");
    renderSingleImageUpload("bride_image_url");
    renderSingleImageUpload("groom_qr_url");
    renderSingleImageUpload("bride_qr_url");
    renderGalleryGrid();

    if (_isLocalDraft && !getCurrentUser()) {
      showToast(
        "💾 Đã lưu nháp vào thiết bị (đăng nhập để đồng bộ lên server)",
      );
    } else {
      showToast("✅ Đã lưu thành công!");
    }
    _setDirty(false);
    return true;
  } catch (e) {
    console.error("Save error:", e);
    showToast("❌ Lỗi: " + e.message);
    return false;
  } finally {
    showLoading(false);
  }
}

function copyText(inputId) {
  const input = document.getElementById(inputId);
  if (!input) return;

  navigator.clipboard.writeText(input.value);
  showToast("📋 Đã copy link!");
}

async function applySlug() {
  const input = document.getElementById("slug-input");
  if (!input) return;

  const newSlug = input.value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  if (!newSlug) {
    showToast("❌ Vui lòng nhập slug hợp lệ");
    return;
  }

  input.value = newSlug;

  try {
    showLoading(true, "Đang cập nhật slug...");

    // Use BL layer to update slug
    await weddingBL.updateWedding({ id: WEDDING_ID, slug: newSlug });

    WEDDING_SLUG = newSlug;
    const groomLink = document.getElementById("link-groom");
    const brideLink = document.getElementById("link-bride");
    if (groomLink) groomLink.value = `${DOMAIN}/${newSlug}?isGroom=true`;
    if (brideLink) brideLink.value = `${DOMAIN}/${newSlug}`;
    showToast("✅ Đã cập nhật slug!");
  } catch (e) {
    showToast("❌ " + e.message);
  } finally {
    showLoading(false);
  }
}

// ============= TIMELINE =============
// Mỗi item: { time, title, type }  type = "ceremony" | "party"
// Backward compat: item không có type → coi là "ceremony"

let _timelineItems = [];

function _syncTimelineHidden() {
  const hidden = document.getElementById("timeline-value");
  if (hidden) hidden.value = JSON.stringify(_timelineItems);
}

function _ensureTimelineDefault(type) {
  const has = _timelineItems.some(i => (i.type || "ceremony") === type);
  if (!has) {
    _timelineItems.push({ time: "", title: "", type });
    _syncTimelineHidden();
    renderTimelineList();
  }
}

function _renderTimelineRows(listEl, type, colorClass) {
  listEl.innerHTML = "";
  _timelineItems.forEach((item, idx) => {
    if ((item.type || "ceremony") !== type) return;
    const div = document.createElement("div");
    div.className = `flex items-center gap-2 ${colorClass} rounded-2xl p-3 border`;
    div.innerHTML = `
      <input
        type="text"
        value="${escapeHtml(item.time || "")}"
        placeholder="Chọn giờ"
        readonly
        class="w-24 flex-shrink-0 h-10 px-2 border border-gray-200 rounded-xl text-sm text-gray-800 bg-white outline-none cursor-pointer text-center hover:border-rose-300 focus:border-rose-400 focus:ring-2 focus:ring-rose-400/20"
        onclick="openTimePicker(this, this.value, v => { _timelineItems[${idx}].time=v; this.value=v; _syncTimelineHidden(); })"
      />
      <input
        type="text"
        value="${escapeHtml(item.title || "")}"
        placeholder="Mô tả sự kiện"
        class="flex-1 min-w-0 h-10 px-3 border border-gray-200 rounded-xl text-sm text-gray-800 bg-white outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-400/20"
        oninput="_timelineItems[${idx}].title=this.value;_syncTimelineHidden();"
      />
      <button type="button" onclick="removeTimelineItem(${idx})"
        class="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-red-100 hover:bg-red-200 text-red-500 rounded-lg transition-colors" title="Xóa">
        <i data-lucide="trash-2" class="w-4 h-4"></i>
      </button>
    `;
    listEl.appendChild(div);
  });
}

function renderTimelineList() {
  const cList = document.getElementById("timeline-list");
  if (cList) _renderTimelineRows(cList, "ceremony", "bg-cyan-50 border-cyan-100");
  const pList = document.getElementById("timeline-party-list");
  if (pList) _renderTimelineRows(pList, "party", "bg-amber-50 border-amber-100");
  const bpList = document.getElementById("timeline-bride-party-list");
  if (bpList) _renderTimelineRows(bpList, "bride-party", "bg-amber-50 border-amber-100");
  if (typeof lucide !== "undefined") lucide.createIcons();
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function addTimelineItem(type = "ceremony") {
  const max = CONFIG.maxLoveStoryItems || 10;
  if (
    _timelineItems.filter((i) => (i.type || "ceremony") === type).length >= max
  ) {
    showToast(`⚠️ Tối đa ${max} mốc`);
    return;
  }
  _timelineItems.push({ time: "", title: "", type });
  _syncTimelineHidden();
  renderTimelineList();
  const listId = type === "bride-party" ? "timeline-bride-party-list"
    : type === "party" ? "timeline-party-list"
    : "timeline-list";
  const list = document.getElementById(listId);
  if (list) {
    const inputs = list.querySelectorAll("input[type=text]");
    if (inputs.length >= 2) inputs[inputs.length - 2]?.focus();
  }
}

function removeTimelineItem(idx) {
  _timelineItems.splice(idx, 1);
  _syncTimelineHidden();
  renderTimelineList();
}

function _updateTimelinePartySection() {
  const enabled = document.getElementById("enable_party")?.value === "true";
  ["timeline-party-sub", "timeline-bride-party-sub"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = enabled ? "" : "none";
  });
  if (enabled) {
    _updateTimelinePartyDateBadge();
    _updateTimelineBridePartyDateBadge();
  }
}

function _updateTimelinePartyDateBadge() {
  const badge = document.getElementById("timeline-party-date-badge");
  const text = document.getElementById("timeline-party-date-text");
  const btn = document.getElementById("btn-add-party");
  const noDate = document.getElementById("timeline-party-no-date");
  if (!badge || !text) return;
  const val = document.querySelector('input[name="groom_party_date"]')?.value || "";
  if (!val) {
    badge.classList.add("hidden");
    if (btn) btn.style.display = "none";
    if (noDate) noDate.classList.remove("hidden");
    return;
  }
  const d = new Date(val + "T00:00:00");
  text.textContent = `${WEEKDAYS_VI[d.getDay()]}, ${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  badge.classList.remove("hidden");
  if (btn) btn.style.display = "";
  if (noDate) noDate.classList.add("hidden");
  _ensureTimelineDefault("party");
  if (typeof lucide !== "undefined") lucide.createIcons();
}

function _updateTimelineBridePartyDateBadge() {
  const badge = document.getElementById("timeline-bride-party-date-badge");
  const text = document.getElementById("timeline-bride-party-date-text");
  const btn = document.getElementById("btn-add-bride-party");
  const noDate = document.getElementById("timeline-bride-party-no-date");
  if (!badge || !text) return;
  const val = document.querySelector('input[name="bride_party_date"]')?.value || "";
  if (!val) {
    badge.classList.add("hidden");
    if (btn) btn.style.display = "none";
    if (noDate) noDate.classList.remove("hidden");
    return;
  }
  const d = new Date(val + "T00:00:00");
  text.textContent = `${WEEKDAYS_VI[d.getDay()]}, ${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  badge.classList.remove("hidden");
  if (btn) btn.style.display = "";
  if (noDate) noDate.classList.add("hidden");
  _ensureTimelineDefault("bride-party");
  if (typeof lucide !== "undefined") lucide.createIcons();
}

// ============= LOVE STORY =============

const MAX_LOVE_STORY_ITEMS = CONFIG.maxLoveStoryItems || 10;

let _loveStoryItems = [];
let _loveStoryKeyExists = false; // true = đã có data (kể cả []), false = chưa từng set
const _loveStoryPendingImages = {}; // { idx: File }

function _syncLoveStoryHidden() {
  const hidden = document.getElementById("love-story-value");
  if (hidden) hidden.value = JSON.stringify(_loveStoryItems);
}

function _loveStoryImagePreview(idx) {
  const item = _loveStoryItems[idx];
  const pending = _loveStoryPendingImages[idx];
  if (pending) return URL.createObjectURL(pending);
  if (item?.image_url) return getImageUrl(item.image_url);
  return null;
}

function renderLoveStoryList() {
  const list = document.getElementById("love-story-list");
  if (!list) return;
  list.innerHTML = "";
  _loveStoryItems.forEach((item, idx) => {
    const preview = _loveStoryImagePreview(idx);
    const _lsFp = item.focal_point;
    const lsFpStyle = _lsFp ? ` style="object-position:${_lsFp.x}% ${_lsFp.y}%"` : "";
    const div = document.createElement("div");
    div.className =
      "bg-rose-50 rounded-2xl p-3 border border-rose-100 space-y-2";
    div.innerHTML = `
      <div class="flex items-center justify-between mb-1">
        <span id="ls-label-${idx}" class="text-xs font-medium text-rose-400">${escapeHtml(item.title) || `Mốc ${idx + 1}`}</span>
        <button type="button" onclick="removeLoveStoryItem(${idx})"
          class="flex items-center gap-1 text-xs text-gray-400 hover:text-red-400 transition-colors">
          <i data-lucide="x" class="w-3.5 h-3.5"></i> Xóa
        </button>
      </div>
      <input type="text" value="${escapeHtml(item.date || "")}" placeholder="Ví dụ: Mùa xuân năm 2020"
        class="w-full h-10 px-3 py-2 border border-gray-200 rounded-md text-sm text-gray-800 bg-white outline-none transition-all placeholder:text-gray-400/50 focus:ring-2 focus:ring-rose-500/30 focus:ring-offset-2"
        oninput="_loveStoryItems[${idx}].date=this.value;_syncLoveStoryHidden();" />
      <input type="text" value="${escapeHtml(item.title || "")}" placeholder="Ví dụ: Lần đầu gặp gỡ"
        class="w-full h-10 px-3 py-2 border border-gray-200 rounded-md text-sm text-gray-800 bg-white outline-none transition-all placeholder:text-gray-400/50 focus:ring-2 focus:ring-rose-500/30 focus:ring-offset-2"
        oninput="_loveStoryItems[${idx}].title=this.value;_syncLoveStoryHidden();const lb=document.getElementById('ls-label-${idx}');if(lb)lb.textContent=this.value||'Mốc ${idx + 1}';" />
      <textarea placeholder="Kể ngắn về khoảnh khắc này..." rows="2"
        class="w-full px-3 py-2 border border-gray-200 rounded-md text-sm text-gray-800 bg-white outline-none transition-all placeholder:text-gray-400/50 focus:ring-2 focus:ring-rose-500/30 focus:ring-offset-2 resize-none"
        oninput="_loveStoryItems[${idx}].content=this.value;_syncLoveStoryHidden();"
      >${escapeHtml(item.content || "")}</textarea>
      <div class="flex items-center flex-wrap gap-2">
        <input type="file" id="ls-img-input-${idx}" accept="image/*" class="hidden"
          onchange="handleLoveStoryImage(${idx}, this)" />
        ${
          preview
            ? `
        <div class="relative w-16 h-16 rounded-xl overflow-hidden border border-rose-200 flex-shrink-0">
          <img src="${preview}" class="w-full h-full object-cover"${lsFpStyle} />
          <button type="button" onclick="adjustLoveStoryFocalPoint(${idx})"
            title="Chỉnh điểm lấy nét" class="absolute bottom-0.5 right-0.5 w-5 h-5 bg-black/50 rounded-full flex items-center justify-center text-white hover:bg-black/70 transition-colors">
            <i data-lucide="focus" class="w-3 h-3"></i>
          </button>
          <button type="button" onclick="removeLoveStoryImage(${idx})"
            class="absolute top-0.5 right-0.5 w-5 h-5 bg-black/50 rounded-full flex items-center justify-center text-white hover:bg-red-500 transition-colors">
            <i data-lucide="x" class="w-3 h-3"></i>
          </button>
        </div>`
            : `
        <button type="button" onclick="document.getElementById('ls-img-input-${idx}').click()"
          class="flex items-center gap-1.5 h-8 px-3 rounded-xl border border-dashed border-rose-300 text-xs text-rose-400 hover:border-rose-400 hover:text-rose-500 transition-colors">
          <i data-lucide="image-plus" class="w-3.5 h-3.5"></i> Thêm ảnh
        </button>`
        }
      </div>
    `;
    list.appendChild(div);
  });
  if (typeof lucide !== "undefined") lucide.createIcons();
}

// Wraps openFocalPointPicker as a Promise. Resolves with {x,y} on confirm, null on cancel.
function _openFocalPickerAsync(source, currentFocal) {
  return new Promise((resolve) => {
    let done = false;
    function finish(val) {
      if (done) return;
      done = true;
      resolve(val);
    }
    openFocalPointPicker(source, currentFocal || { x: 50, y: 50 }, (focal) =>
      finish(focal),
    );
    const origClose = window._closeFocalSheet;
    window._closeFocalSheet = (...args) => {
      setTimeout(() => finish(null), 0);
      if (origClose) origClose(...args);
    };
  });
}

async function handleLoveStoryImage(idx, input) {
  const file = input.files[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    showToast("❌ Chỉ chấp nhận file ảnh!");
    return;
  }
  input.value = "";
  const focal = await _openFocalPickerAsync(
    file,
    _loveStoryItems[idx]?.focal_point,
  );
  if (!focal) return;
  showLoading(true, "Đang xử lý ảnh...");
  try {
    const processed = await resizeImage(file, 1, 1920, 1920);
    _loveStoryPendingImages[idx] = processed;
    _loveStoryItems[idx].focal_point = focal;
    _syncLoveStoryHidden();
    _idbSaveLoveStoryImages();
  } catch (e) {
    showToast("❌ Lỗi xử lý ảnh");
  } finally {
    showLoading(false);
  }
  renderLoveStoryList();
}

async function adjustLoveStoryFocalPoint(idx) {
  const source = _loveStoryPendingImages[idx]
    ? URL.createObjectURL(_loveStoryPendingImages[idx])
    : _loveStoryItems[idx]?.image_url
      ? getImageUrl(_loveStoryItems[idx].image_url)
      : null;
  if (!source) return;
  const focal = await _openFocalPickerAsync(
    source,
    _loveStoryItems[idx]?.focal_point,
  );
  if (!focal) return;
  _loveStoryItems[idx].focal_point = focal;
  _syncLoveStoryHidden();
  renderLoveStoryList();
  showToast("✅ Đã cập nhật điểm lấy nét");
}

function removeLoveStoryImage(idx) {
  delete _loveStoryPendingImages[idx];
  _loveStoryItems[idx].image_url = null;
  _loveStoryItems[idx].focal_point = null;
  _syncLoveStoryHidden();
  _idbSaveLoveStoryImages();
  renderLoveStoryList();
}

function addLoveStoryItem() {
  if (_loveStoryItems.length >= MAX_LOVE_STORY_ITEMS) {
    showToast(`⚠️ Tối đa ${MAX_LOVE_STORY_ITEMS} mốc`);
    return;
  }
  _loveStoryItems.push({ date: "", title: "", content: "", image_url: null });
  _syncLoveStoryHidden();
  renderLoveStoryList();
  const list = document.getElementById("love-story-list");
  if (list) {
    const inputs = list.querySelectorAll("input[type=text]");
    if (inputs.length) inputs[inputs.length - 2]?.focus();
  }
}

function removeLoveStoryItem(idx) {
  delete _loveStoryPendingImages[idx];
  _loveStoryItems.splice(idx, 1);
  // Re-key pending images after splice
  const reKeyed = {};
  Object.entries(_loveStoryPendingImages).forEach(([k, v]) => {
    const n = parseInt(k);
    if (n > idx) reKeyed[n - 1] = v;
    else if (n < idx) reKeyed[n] = v;
  });
  Object.keys(_loveStoryPendingImages).forEach(
    (k) => delete _loveStoryPendingImages[k],
  );
  Object.assign(_loveStoryPendingImages, reKeyed);
  _syncLoveStoryHidden();
  _idbSaveLoveStoryImages();
  renderLoveStoryList();
}

// ============= INITIALIZATION =============

const WEEKDAYS_VI = [
  "Chủ Nhật",
  "Thứ Hai",
  "Thứ Ba",
  "Thứ Tư",
  "Thứ Năm",
  "Thứ Sáu",
  "Thứ Bảy",
];

function _updateTimelineDateBadge() {
  const badge = document.getElementById("timeline-date-badge");
  const text = document.getElementById("timeline-date-text");
  const btn = document.getElementById("btn-add-ceremony");
  const noDate = document.getElementById("timeline-ceremony-no-date");
  if (!badge || !text) return;
  const val = document.querySelector('input[name="ceremony_date"]')?.value || "";
  if (!val) {
    badge.classList.add("hidden");
    if (btn) btn.style.display = "none";
    if (noDate) noDate.classList.remove("hidden");
    return;
  }
  const d = new Date(val + "T00:00:00");
  text.textContent = `${WEEKDAYS_VI[d.getDay()]}, ${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  badge.classList.remove("hidden");
  if (btn) btn.style.display = "";
  if (noDate) noDate.classList.add("hidden");
  _ensureTimelineDefault("ceremony");
  if (typeof lucide !== "undefined") lucide.createIcons();
}

function setupLunarDateListeners() {
  // Helper function to update lunar display
  const updateLunarDisplay = (dateValue, displayEl, valueEl) => {
    if (dateValue) {
      const lunarDate = formatLunarDate(dateValue);
      const fullText = `Tức ngày ${lunarDate}`;
      displayEl.textContent = fullText;
      valueEl.value = fullText;
      displayEl.classList.remove("italic", "text-gray-500");
      displayEl.classList.add("text-gray-700");
    } else {
      displayEl.textContent = "Chọn ngày để tự động tính ngày âm lịch";
      valueEl.value = "";
      displayEl.classList.add("italic", "text-gray-500");
      displayEl.classList.remove("text-gray-700");
    }
  };

  // Helper function to subtract one day from a date string
  const subtractOneDay = (dateString) => {
    const date = new Date(dateString);
    date.setDate(date.getDate() - 1);
    return date.toISOString().split("T")[0];
  };

  // Lễ thành hôn (chung)
  const ceremonyDate = document.querySelector('input[name="ceremony_date"]');
  const ceremonyTime = document.querySelector('input[name="ceremony_time"]');
  const ceremonyLunarDisplay = document.getElementById(
    "ceremony-lunar-display",
  );
  const ceremonyLunarValue = document.getElementById("ceremony-lunar-value");

  if (ceremonyDate && ceremonyLunarDisplay && ceremonyLunarValue) {
    ceremonyDate.addEventListener("change", (e) => {
      updateLunarDisplay(
        e.target.value,
        ceremonyLunarDisplay,
        ceremonyLunarValue,
      );

      // Auto-fill party dates if empty
      const groomPartyDate = document.querySelector(
        'input[name="groom_party_date"]',
      );
      const bridePartyDate = document.querySelector(
        'input[name="bride_party_date"]',
      );

      if (e.target.value) {
        const oneDayBefore = subtractOneDay(e.target.value);

        // Fill groom party date if empty
        if (groomPartyDate && !groomPartyDate.value) {
          if (
            window.flatpickrInstances &&
            window.flatpickrInstances["groom_party_date"]
          ) {
            window.flatpickrInstances["groom_party_date"].setDate(
              oneDayBefore,
              true,
            );
          } else {
            groomPartyDate.value = oneDayBefore;
          }
          // Trigger change event to update lunar date
          const event = new Event("change", { bubbles: true });
          groomPartyDate.dispatchEvent(event);
        }

        // Fill bride party date if empty
        if (bridePartyDate && !bridePartyDate.value) {
          if (
            window.flatpickrInstances &&
            window.flatpickrInstances["bride_party_date"]
          ) {
            window.flatpickrInstances["bride_party_date"].setDate(
              oneDayBefore,
              true,
            );
          } else {
            bridePartyDate.value = oneDayBefore;
          }
          // Trigger change event to update lunar date
          const event = new Event("change", { bubbles: true });
          bridePartyDate.dispatchEvent(event);
        }
      }
    });
    ceremonyDate.addEventListener("blur", (e) => {
      updateLunarDisplay(
        e.target.value,
        ceremonyLunarDisplay,
        ceremonyLunarValue,
      );
    });
  }

  // Auto-fill party time when ceremony time is entered
  if (ceremonyTime) {
    ceremonyTime.addEventListener("change", (e) => {
      const groomPartyTime = document.querySelector(
        'input[name="groom_party_time"]',
      );
      const bridePartyTime = document.querySelector(
        'input[name="bride_party_time"]',
      );

      // Fill party times with 17:00 if empty
      if (groomPartyTime && !groomPartyTime.value) {
        groomPartyTime.value = "17:00";
      }
      if (bridePartyTime && !bridePartyTime.value) {
        bridePartyTime.value = "17:00";
      }
    });
    ceremonyTime.addEventListener("blur", (e) => {
      const groomPartyTime = document.querySelector(
        'input[name="groom_party_time"]',
      );
      const bridePartyTime = document.querySelector(
        'input[name="bride_party_time"]',
      );

      // Fill party times with 17:00 if empty
      if (groomPartyTime && !groomPartyTime.value) {
        groomPartyTime.value = "17:00";
      }
      if (bridePartyTime && !bridePartyTime.value) {
        bridePartyTime.value = "17:00";
      }
    });
  }

  // Tiệc cưới nhà trai
  const groomPartyDate = document.querySelector(
    'input[name="groom_party_date"]',
  );
  const groomPartyLunarDisplay = document.getElementById(
    "groom-party-lunar-display",
  );
  const groomPartyLunarValue = document.getElementById(
    "groom-party-lunar-value",
  );

  if (groomPartyDate && groomPartyLunarDisplay && groomPartyLunarValue) {
    groomPartyDate.addEventListener("change", (e) => {
      updateLunarDisplay(
        e.target.value,
        groomPartyLunarDisplay,
        groomPartyLunarValue,
      );
    });
    groomPartyDate.addEventListener("blur", (e) => {
      updateLunarDisplay(
        e.target.value,
        groomPartyLunarDisplay,
        groomPartyLunarValue,
      );
    });
  }

  // Tiệc cưới nhà gái
  const bridePartyDate = document.querySelector(
    'input[name="bride_party_date"]',
  );
  const bridePartyLunarDisplay = document.getElementById(
    "bride-party-lunar-display",
  );
  const bridePartyLunarValue = document.getElementById(
    "bride-party-lunar-value",
  );

  if (bridePartyDate && bridePartyLunarDisplay && bridePartyLunarValue) {
    bridePartyDate.addEventListener("change", (e) => {
      updateLunarDisplay(
        e.target.value,
        bridePartyLunarDisplay,
        bridePartyLunarValue,
      );
    });
    bridePartyDate.addEventListener("blur", (e) => {
      updateLunarDisplay(
        e.target.value,
        bridePartyLunarDisplay,
        bridePartyLunarValue,
      );
    });
  }

  // Auto-fill party location from address
  const groomAddress = document.querySelector('input[name="groom_address"]');
  const groomPartyLocation = document.querySelector(
    'input[name="groom_party_location"]',
  );

  if (groomAddress && groomPartyLocation) {
    groomAddress.addEventListener("change", (e) => {
      if (e.target.value && !groomPartyLocation.value) {
        groomPartyLocation.value = e.target.value;
      }
    });
    groomAddress.addEventListener("blur", (e) => {
      if (e.target.value && !groomPartyLocation.value) {
        groomPartyLocation.value = e.target.value;
      }
    });
  }

  const brideAddress = document.querySelector('input[name="bride_address"]');
  const bridePartyLocation = document.querySelector(
    'input[name="bride_party_location"]',
  );

  if (brideAddress && bridePartyLocation) {
    brideAddress.addEventListener("change", (e) => {
      if (e.target.value && !bridePartyLocation.value) {
        bridePartyLocation.value = e.target.value;
      }
    });
    brideAddress.addEventListener("blur", (e) => {
      if (e.target.value && !bridePartyLocation.value) {
        bridePartyLocation.value = e.target.value;
      }
    });
  }
}

function initializePage() {
  const idLabel = document.getElementById("wedding-id-label");
  const groomLink = document.getElementById("link-groom");
  const brideLink = document.getElementById("link-bride");

  if (idLabel) idLabel.textContent = `ID: ${WEDDING_ID}`;

  // Links will be updated after loading data with slug
  if (groomLink) groomLink.value = "Đang tải...";
  if (brideLink) brideLink.value = "Đang tải...";

  // Setup bank searchable select
  setupBankSearchableSelect(
    "groom-bank-input",
    "groom-bank-dropdown",
    "groom-bank-value",
  );
  setupBankSearchableSelect(
    "bride-bank-input",
    "bride-bank-dropdown",
    "bride-bank-value",
  );

  // Initialize single image uploads
  renderSingleImageUpload("cover_image_url");
  renderSingleImageUpload("groom_image_url");
  renderSingleImageUpload("bride_image_url");
  renderSingleImageUpload("groom_qr_url");
  renderSingleImageUpload("bride_qr_url");

  // Initialize gallery grid
  renderGalleryGrid();

  // Setup lunar date auto-fill
  setupLunarDateListeners();

  // Bind ceremony date → timeline heading badge
  _updateTimelineDateBadge();
  const ceremonyDateInput = document.querySelector(
    'input[name="ceremony_date"]',
  );
  if (ceremonyDateInput) {
    ceremonyDateInput.addEventListener("change", _updateTimelineDateBadge);
    ceremonyDateInput.addEventListener("input", _updateTimelineDateBadge);
  }

  // Party sub-section visibility + date badge
  _updateTimelinePartySection();
  const groomPartyDateEl = document.querySelector('input[name="groom_party_date"]');
  if (groomPartyDateEl) {
    groomPartyDateEl.addEventListener("change", _updateTimelinePartyDateBadge);
    groomPartyDateEl.addEventListener("input", _updateTimelinePartyDateBadge);
  }
  const bridePartyDateEl = document.querySelector('input[name="bride_party_date"]');
  if (bridePartyDateEl) {
    bridePartyDateEl.addEventListener("change", _updateTimelineBridePartyDateBadge);
    bridePartyDateEl.addEventListener("input", _updateTimelineBridePartyDateBadge);
  }

  // Setup form submit handler
  const form = document.getElementById("wedding-form");
  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      saveAll();
    });
  }

  // Auto-save to localStorage on any form change
  _initAutoSave();

  // Sync party "Trùng địa điểm" khi user gõ tay vào ceremony/vu_quy location
  ["ceremony_location", "vu_quy_location"].forEach((name) => {
    document.querySelector(`input[name="${name}"]`)
      ?.addEventListener("input", _syncPartyIfSame);
  });

  // Xoá rỗng ô địa điểm → ẩn luôn tag bản đồ bên dưới (tag đồng bộ với input)
  [
    ["ceremony", "ceremony_location"],
    ["vu_quy", "vu_quy_location"],
    ["groom_party", "groom_party_location"],
    ["bride_party", "bride_party_location"],
  ].forEach(([mapSide, name]) => {
    const inp = document.querySelector(`input[name="${name}"]`);
    inp?.addEventListener("input", () => {
      if (!inp.value.trim() && typeof clearMapAddress === "function") clearMapAddress(mapSide);
    });
  });

  // Auto-open couple section on load
  toggleSection("couple");

  // Load data after Flatpickr is ready
  if (WEDDING_ID) {
    // Wait for Flatpickr to initialize
    const checkFlatpickr = setInterval(() => {
      if (window.flatpickrInstances) {
        clearInterval(checkFlatpickr);
        loadData();
      }
    }, 50);
  } else {
    showToast("❌ Không tìm thấy ID thiệp cưới!");
  }

  if (typeof lucide !== "undefined") lucide.createIcons();
}

// ============= EXPOSE TO GLOBAL SCOPE =============

window.handleTimeInput = handleTimeInput;
window.randomQuote = randomQuote;
window.handleImageUpload = handleImageUpload;
window.handleGalleryUpload = handleGalleryUpload;
window.removeImage = removeImage;
window.removeGalleryImage = removeGalleryImage;
window.removeExistingGalleryImage = removeExistingGalleryImage;
window.saveAll = saveAll;
window.copyText = copyText;
// ============= CEREMONY SECTION =============

function toggleVuQuy(event) {
  if (event) event.stopPropagation();
  const hidden = document.getElementById("vu_quy_enabled");
  const fields = document.getElementById("vu-quy-fields");
  if (!hidden) return;
  const newVal = hidden.value !== "true";
  hidden.value = newVal ? "true" : "false";
  // Phát "input" để autosave lưu trạng thái (gán .value không tự phát sự kiện)
  hidden.dispatchEvent(new Event("input", { bubbles: true }));
  const btn = document.getElementById("vis-btn-vu-quy");
  const knob = document.getElementById("vis-knob-vu-quy");
  if (btn && knob) {
    if (newVal) {
      btn.classList.remove("bg-gray-300");
      btn.classList.add("bg-rose-400");
      knob.classList.remove("translate-x-1");
      knob.classList.add("translate-x-6");
    } else {
      btn.classList.remove("bg-rose-400");
      btn.classList.add("bg-gray-300");
      knob.classList.remove("translate-x-6");
      knob.classList.add("translate-x-1");
    }
  }
  if (fields) fields.classList.toggle("hidden", !newVal);
}



// Khi địa điểm nguồn (ceremony/vu_quy) thay đổi, re-sync tất cả party đang bật "Trùng địa điểm"
function _syncPartyIfSame() {
  ["groom", "bride"].forEach((side) => {
    const btn = document.getElementById(`${side}-party-same-btn`);
    if (btn?.dataset.active === "true") togglePartySameLoc(side, null, true);
  });
}

// Callback được maps-helper.js gọi sau applyMapPicker / clearMapAddress
window._onLocationSourceChanged = (src) => {
  if (src === "ceremony" || src === "vu_quy") _syncPartyIfSame();
};

function togglePartySameLoc(side, event, force) {
  if (event) event.stopPropagation();
  // <x-check> sở hữu trạng thái + hiển thị (box/icon/viền); ở đây chỉ đọc/ghi .checked
  const check = document.querySelector(`x-check[key="${side}-party-same"]`);
  if (!check) return;
  const newActive = force !== undefined ? force : check.checked;
  check.checked = newActive;

  const locationInput = document.querySelector(`input[name="${side}_party_location"]`);
  const mapEmbedInput = document.getElementById(`${side}_party_map_embed_url`);
  const mapDisplay = document.getElementById(`${side}_party-map-display`);
  const mapAddress = document.getElementById(`${side}_party-map-address`);
  // Nút "Bản đồ" là suffix-button bên trong <x-input> (không có id riêng) → lấy qua x-input
  const partyXInput = document.querySelector(`x-input[name="${side}_party_location"]`);
  const mapBtn = (partyXInput && partyXInput.querySelector("button:not(.x-clear)"))
    || document.getElementById(`${side}-party-map-btn`);
  // Nút X xoá của x-input và nút X trên tag bản đồ — phải khoá luôn khi "trùng địa điểm"
  const xClearBtn = partyXInput && partyXInput.querySelector(".x-clear");
  const tagClearBtn = mapDisplay && mapDisplay.querySelector("button");

  if (newActive) {
    // Resolve source: groom → ceremony; bride → vu_quy if enabled, else ceremony
    let srcLocName = "ceremony_location";
    let srcMapId = "ceremony_map_embed_url";
    let srcAddrId = "ceremony-map-address";
    if (side === "bride") {
      const vuQuyEnabled = document.getElementById("vu_quy_enabled")?.value === "true";
      if (vuQuyEnabled) {
        srcLocName = "vu_quy_location";
        srcMapId = "vu_quy_map_embed_url";
        srcAddrId = "vu_quy-map-address";
      }
    }
    const srcLoc = document.querySelector(`input[name="${srcLocName}"]`);
    const srcMap = document.getElementById(srcMapId);
    const srcAddr = document.getElementById(srcAddrId);

    if (locationInput) {
      locationInput.value = srcLoc?.value || "";
      locationInput.readOnly = true;
      // Dùng ! (important) để đè bg-white/text mặc định của x-input → nhìn rõ trạng thái khoá
      locationInput.classList.add("!bg-gray-100", "!text-gray-400", "cursor-not-allowed");
      // Phát input để autosave lưu giá trị vừa bind (form nghe "input")
      locationInput.dispatchEvent(new Event("input", { bubbles: true }));
    }
    if (mapEmbedInput && srcMap) mapEmbedInput.value = srcMap.value || "";
    if (mapDisplay && mapAddress && srcAddr?.textContent?.trim()) {
      mapAddress.textContent = srcAddr.textContent;
      mapDisplay.classList.remove("hidden");
      mapDisplay.classList.add("flex");
    }
    if (mapBtn) {
      mapBtn.disabled = true;
      mapBtn.classList.add("opacity-40", "cursor-not-allowed");
    }
    // Ẩn nút xoá (inline style đè class 'hidden' mà x-input tự bật/tắt theo giá trị)
    if (xClearBtn) xClearBtn.style.display = "none";
    if (tagClearBtn) tagClearBtn.style.display = "none";
  } else {
    if (locationInput) {
      locationInput.readOnly = false;
      locationInput.classList.remove("!bg-gray-100", "!text-gray-400", "cursor-not-allowed");
    }
    if (mapBtn) {
      mapBtn.disabled = false;
      mapBtn.classList.remove("opacity-40", "cursor-not-allowed");
    }
    // Trả lại nút xoá (bỏ inline style để x-input tự quản lý hiển thị theo giá trị)
    if (xClearBtn) xClearBtn.style.display = "";
    if (tagClearBtn) tagClearBtn.style.display = "";
  }
}

function initCeremonySection(data) {
  // Default: vu quy enabled unless explicitly saved as false
  const vuQuyEnabled =
    data?.vu_quy_enabled !== false && data?.vu_quy_enabled !== "false";
  const hidden = document.getElementById("vu_quy_enabled");
  const btn = document.getElementById("vis-btn-vu-quy");
  const knob = document.getElementById("vis-knob-vu-quy");
  const fields = document.getElementById("vu-quy-fields");
  if (hidden) hidden.value = vuQuyEnabled ? "true" : "false";
  if (btn) {
    btn.classList.toggle("bg-rose-400", vuQuyEnabled);
    btn.classList.toggle("bg-gray-300", !vuQuyEnabled);
  }
  if (knob) {
    knob.classList.toggle("translate-x-6", vuQuyEnabled);
    knob.classList.toggle("translate-x-1", !vuQuyEnabled);
  }
  if (fields) fields.classList.toggle("hidden", !vuQuyEnabled);

  // Default "same as ceremony" checked if party_location is empty (new draft)
  ["groom", "bride"].forEach((side) => {
    const partyLoc = document.querySelector(`input[name="${side}_party_location"]`);
    const hasOwnLocation = partyLoc?.value?.trim();
    togglePartySameLoc(side, null, !hasOwnLocation);
  });
}

window.applySlug = applySlug;
window.copyInviteLink = copyInviteLink;
window.switchGuestsTab = switchGuestsTab;
window.generateQuickLink = generateQuickLink;
window.shareViaMessenger = shareViaMessenger;
window.copyMessengerLink = copyMessengerLink;
window.addTimelineItem = addTimelineItem;
window.removeTimelineItem = removeTimelineItem;
window.addLoveStoryItem = addLoveStoryItem;
window.removeLoveStoryItem = removeLoveStoryItem;
window.handleLoveStoryImage = handleLoveStoryImage;
window.removeLoveStoryImage = removeLoveStoryImage;
window.adjustLoveStoryFocalPoint = adjustLoveStoryFocalPoint;
window.openThemePicker = openThemePicker;
window.toggleSectionVis = toggleSectionVis;
window.toggleVuQuy = toggleVuQuy;
window.togglePartySameLoc = togglePartySameLoc;

window.switchTab = switchTab;
window.saveDraft = saveDraft;
window.publishWedding = publishWedding;
// YouTube functions removed - now auto-preview on input

// ============= FLATPICKR INIT =============

// Cấu hình flatpickr DÙNG CHUNG cho mọi ô ngày (form thiết lập + modal AI qua
// <x-date>). Tách ra factory để control ngày ở mọi nơi đồng nhất.
window._weddingFpOptions = function (input) {
  return {
    locale: {
        months: {
          shorthand: [
            "T1",
            "T2",
            "T3",
            "T4",
            "T5",
            "T6",
            "T7",
            "T8",
            "T9",
            "T10",
            "T11",
            "T12",
          ],
          longhand: [
            "Tháng 1",
            "Tháng 2",
            "Tháng 3",
            "Tháng 4",
            "Tháng 5",
            "Tháng 6",
            "Tháng 7",
            "Tháng 8",
            "Tháng 9",
            "Tháng 10",
            "Tháng 11",
            "Tháng 12",
          ],
        },
        weekdays: {
          shorthand: ["CN", "T2", "T3", "T4", "T5", "T6", "T7"],
          longhand: [
            "Chủ Nhật",
            "Thứ Hai",
            "Thứ Ba",
            "Thứ Tư",
            "Thứ Năm",
            "Thứ Sáu",
            "Thứ Bảy",
          ],
        },
        firstDayOfWeek: 1,
        rangeSeparator: " đến ",
        weekAbbreviation: "Tuần",
        scrollTitle: "Cuộn để tăng",
        toggleTitle: "Nhấp để chuyển đổi",
      },
      dateFormat: "Y-m-d",
      altInput: true,
      altFormat: "d/m/Y",
      allowInput: false,
      disableMobile: true,
      minDate: "today",
      onReady: function (selectedDates, dateStr, instance) {
        instance.altInput.placeholder = "Chọn ngày...";
      },
      onChange: function (selectedDates, dateStr, instance) {
        const event = new Event("change", { bubbles: true });
        input.dispatchEvent(event);
      },
      onClose: function (selectedDates, dateStr, instance) {
        const event = new Event("change", { bubbles: true });
        input.dispatchEvent(event);
      },
  };
};

// Khởi tạo flatpickr cho 1 ô ngày bằng cấu hình chung + đăng ký instance theo name.
window.createWeddingDatepicker = function (input) {
  if (!window.flatpickr || !input || input._flatpickr) return input?._flatpickr || null;
  const instance = flatpickr(input, window._weddingFpOptions(input));
  if (!window.flatpickrInstances) window.flatpickrInstances = {};
  if (input.name) window.flatpickrInstances[input.name] = instance;
  return instance;
};

document.addEventListener("DOMContentLoaded", function () {
  const dateInputs = document.querySelectorAll('input[type="date"]');
  window.flatpickrInstances = {};

  dateInputs.forEach((input) => window.createWeddingDatepicker(input));
  // Đánh dấu đã init xong → <x-date> thêm SAU (VD modal AI) sẽ tự init flatpickr.
  window._weddingDateReady = true;

  // Wire time pickers
  document.querySelectorAll("input[data-timepicker]").forEach((input) => {
    input.addEventListener("click", () => {
      openTimePicker(input, input.value, (val) => {
        input.value = val;
        input.dispatchEvent(new Event("change", { bubbles: true }));
      });
    });
  });
});

// ============= SCALE PREVIEW IFRAME =============

function scalePreviewIframe() {
  const wrap = document.getElementById("phone-frame-wrap");
  const iframe = document.getElementById("preview-iframe");
  if (!wrap || !iframe) return;
  const scale = Math.min(1, wrap.offsetWidth / 390);
  iframe.style.transform = `scale(${scale})`;
  iframe.style.width = "390px";
}
window.addEventListener("resize", scalePreviewIframe);
document.addEventListener("DOMContentLoaded", scalePreviewIframe);

// ============= MUSIC UPLOAD CONTAINER =============

document.addEventListener("DOMContentLoaded", function () {
  const musicContainer = document.getElementById("music-upload-container");
  const musicFileInput = document.getElementById("music-file-input");
  if (musicContainer && musicFileInput) {
    musicContainer.addEventListener("click", function () {
      musicFileInput.click();
    });
  }
});

// ============= EXTRACT MAP URL =============

function extractMapUrl(textarea) {
  const value = textarea.value.trim();
  if (value.includes("<iframe") && value.includes("src=")) {
    const srcMatch = value.match(/src=["']([^"']+)["']/);
    if (srcMatch && srcMatch[1]) {
      textarea.value = srcMatch[1];
      showToast("✅ Đã trích xuất URL từ iframe");
    }
  }
}
window.extractMapUrl = extractMapUrl;

// ============= THEME PICKER =============

async function openThemePicker() {
  const sheet = openBottomSheet({
    id: "theme-picker-modal",
    title: "Chọn mẫu thiệp",
    height: "80vh",
  });
  if (!sheet) return;

  // Cho phép grid scroll trong body
  sheet.body.className = "flex-1 min-h-0 overflow-y-auto";
  sheet.body.innerHTML = `<div class="flex items-center justify-center py-10 text-gray-400 text-sm">Đang tải...</div>`;

  try {
    const res = await fetch(`${CONFIG.supabase.edgeUrl}?resource=public-templates`, {
      headers: { Authorization: `Bearer ${CONFIG.supabase.anonKey}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const rows = await res.json();

    sheet.body.innerHTML = `
      <div class="flex flex-col divide-y divide-gray-100">
        ${rows
          .map((t) => {
            const isCurrent = t.theme === WEDDING_THEME;
            const thumb = t.thumbnailUrl || `/assets/images/templates/${t.theme}.jpg`;
            return `
            <button type="button"
              ${isCurrent ? 'id="theme-picker-current"' : ""}
              onclick="_applyThemeChange('${t.theme}','${t.name}')"
              class="flex items-center gap-4 px-4 py-3 text-left transition-colors w-full ${isCurrent ? "bg-rose-50" : "hover:bg-gray-50"}">
              <img src="${thumb}" alt="${t.name}"
                class="w-16 h-24 rounded-xl object-cover object-top flex-shrink-0 border-2 ${isCurrent ? "border-rose-400" : "border-gray-200"}"
                loading="lazy" onerror="this.style.background='#f3f4f6'" />
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium ${isCurrent ? "text-rose-600" : "text-gray-800"}">${t.name}</p>
                ${t.description ? `<p class="text-xs text-gray-400 mt-0.5 line-clamp-2">${t.description}</p>` : ""}
                <div class="flex items-center gap-1.5 mt-1">
                  <span class="text-xs font-semibold text-rose-500">${t.price.toLocaleString("vi-VN")}đ</span>
                  ${t.originalPrice > t.price ? `<span class="text-[11px] text-gray-400 line-through">${t.originalPrice.toLocaleString("vi-VN")}đ</span>` : ""}
                </div>
              </div>
              ${isCurrent
                ? `<span class="flex-shrink-0 bg-rose-500 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">Đang dùng</span>`
                : `<svg class="flex-shrink-0 w-4 h-4 text-gray-300" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>`}
            </button>`;
          })
          .join("")}
      </div>`;

    // Auto scroll đến mẫu đang dùng
    requestAnimationFrame(() => {
      const current = document.getElementById("theme-picker-current");
      if (current) current.scrollIntoView({ block: "center", behavior: "smooth" });
    });
  } catch {
    sheet.body.innerHTML = `<div class="text-center text-red-500 py-10 text-sm">Không thể tải danh sách mẫu. Vui lòng thử lại.</div>`;
  }
}

function closeThemePicker() {
  const el = document.getElementById("theme-picker-modal");
  if (el) el.remove();
}

function _updateHeaderThemeBadge(displayName) {
  // Thumbnail của mẫu đang dùng
  const thumb = document.getElementById("header-theme-thumb");
  if (thumb && WEDDING_THEME) {
    thumb.src = `../assets/images/templates/${WEDDING_THEME}.jpg`;
    thumb.style.display = "";
  }
  const el = document.getElementById("header-theme-name");
  if (!el) return;
  if (displayName) { el.textContent = displayName; return; }
  const stored = sessionStorage.getItem("draft_template_name");
  if (stored) { el.textContent = stored; return; }
  el.textContent = WEDDING_THEME
    .split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

function _applyThemeChange(newTheme, displayName) {
  if (newTheme === WEDDING_THEME) {
    closeThemePicker();
    return;
  }
  WEDDING_THEME = newTheme;
  sessionStorage.setItem("draft_theme", newTheme);
  if (displayName) sessionStorage.setItem("draft_template_name", displayName);
  _updateHeaderThemeBadge(displayName);
  if (_isPreviewActive) {
    _savePreviewData();
    const iframe = document.getElementById("preview-iframe");
    if (iframe)
      iframe.src = `/public/themes/${WEDDING_THEME}/?preview=true&source=live&isGroom=true&t=${Date.now()}`;
  }
  closeThemePicker();
  showToast("✅ Đã đổi mẫu thiệp");
}
window._applyThemeChange = _applyThemeChange;

// ============= ADVANCED SECTION LOCK =============

function _syncAdvancedSection() {
  const draftTab  = document.getElementById("tab-draft");
  if (draftTab) draftTab.classList.toggle("hidden", IS_PUBLISHED);

  // Tab Khách mời: vẫn bấm được, tooltip báo khi chưa xuất bản (không gắn badge trên navbar)
  const guestsTab = document.getElementById("tab-guests");
  if (guestsTab) {
    guestsTab.title = IS_PUBLISHED
      ? ""
      : "Cần xuất bản thiệp trước khi quản lý khách mời";
  }

  // Nếu panel khách mời đang mở → cập nhật lại lớp khoá/iframe ngay
  const guestsPanel = document.getElementById("guests-panel");
  if (guestsPanel && !guestsPanel.classList.contains("hidden")) {
    _updateGuestsPanelLock();
  }
  if (window.lucide) lucide.createIcons();
}

// ============= START =============

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializePage);
} else {
  initializePage();
}
