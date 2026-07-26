// ============= TAB: Ảnh mẫu =============
// Upload ảnh demo + căn điểm lấy nét cho từng theme (public/themes/), lưu
// thẳng ảnh + JSON vào assets/data-template/<theme>/ trên máy qua File System
// Access API. Chỉ chạy trên Chrome/Edge desktop, đang mở qua localhost — xem
// core/utils.js (openFocalPointPicker, openImageCropModal) cho phần UI chọn
// điểm lấy nét / cắt ảnh dùng chung với invitation-setup.

const SI_THEMES = [
  { value: "romantic-gold", label: "Romantic Gold" },
  { value: "vintage-forest", label: "Vintage Forest" },
  { value: "basic-gold", label: "Basic Gold" },
];

const SI_FOCAL_POINT_FIELDS = [
  "cover_image_url",
  "groom_image_url",
  "bride_image_url",
];
const SI_CROP_FIELDS = ["groom_qr_url", "bride_qr_url"];
const SI_SINGLE_FIELDS = [...SI_FOCAL_POINT_FIELDS, ...SI_CROP_FIELDS];
const SI_MAX_GALLERY = 10;
const SI_MAX_LOVE_STORY = CONFIG.maxLoveStoryItems || 10;

const SI_FIELD_BASENAME = {
  cover_image_url: "cover",
  groom_image_url: "groom",
  bride_image_url: "bride",
  groom_qr_url: "groom-qr",
  bride_qr_url: "bride-qr",
};

// resizeImage() không cần upload lên Supabase — truyền storageDAL=null vì chỉ
// dùng phương thức resizeImage() (thuần canvas, không đụng storage).
const siImageBL = new ImageBL(null);

let siRootHandle = null;
let siThemeHandle = null;
let siCurrentTheme = null;
let siData = null;

// ============= IndexedDB: lưu directory handle để không phải chọn lại =============

const SI_IDB_NAME = "cx_admin_fs";
const SI_IDB_STORE = "handles";
const SI_IDB_KEY = "data-template-root";

function siOpenIdb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(SI_IDB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(SI_IDB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function siIdbGetHandle() {
  const db = await siOpenIdb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SI_IDB_STORE, "readonly");
    const req = tx.objectStore(SI_IDB_STORE).get(SI_IDB_KEY);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

async function siIdbSetHandle(handle) {
  const db = await siOpenIdb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SI_IDB_STORE, "readwrite");
    tx.objectStore(SI_IDB_STORE).put(handle, SI_IDB_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ============= Init tab =============

async function initSampleImagesPanel() {
  if (!("showDirectoryPicker" in window)) {
    document.getElementById("si-unsupported-banner").classList.remove("hidden");
    document.getElementById("si-body").classList.add("hidden");
    return;
  }

  siPopulateThemeDropdown();

  const savedHandle = await siIdbGetHandle().catch(() => null);
  if (!savedHandle) {
    siSetFolderStatus("disconnected");
    return;
  }

  siRootHandle = savedHandle;
  const perm = await siRootHandle
    .queryPermission({ mode: "readwrite" })
    .catch(() => "denied");
  siSetFolderStatus(perm === "granted" ? "connected" : "needs-reauth");
}

function siPopulateThemeDropdown() {
  const select = document.getElementById("si-theme-select");
  if (select.dataset.populated) return;
  SI_THEMES.forEach((t) => {
    const opt = document.createElement("option");
    opt.value = t.value;
    opt.textContent = t.label;
    select.appendChild(opt);
  });
  select.dataset.populated = "1";
}

function siSetFolderStatus(state) {
  const statusEl = document.getElementById("si-folder-status");
  const btn = document.getElementById("si-connect-btn");
  const themeWrap = document.getElementById("si-theme-select-wrap");

  if (state === "connected") {
    statusEl.textContent = "✅ Đã kết nối";
    statusEl.className = "text-xs text-green-600 mt-0.5";
    btn.textContent = "Đổi thư mục";
    btn.dataset.mode = "pick";
    themeWrap.classList.remove("hidden");
  } else if (state === "needs-reauth") {
    statusEl.textContent = "⚠️ Cần cấp lại quyền truy cập thư mục";
    statusEl.className = "text-xs text-amber-600 mt-0.5";
    btn.textContent = "Cấp lại quyền";
    btn.dataset.mode = "regrant";
    themeWrap.classList.add("hidden");
    document.getElementById("si-form").classList.add("hidden");
  } else {
    statusEl.textContent = "Chưa kết nối";
    statusEl.className = "text-xs text-gray-500 mt-0.5";
    btn.textContent = "Chọn thư mục";
    btn.dataset.mode = "pick";
    themeWrap.classList.add("hidden");
    document.getElementById("si-form").classList.add("hidden");
  }
}

async function connectSampleImagesFolder() {
  const btn = document.getElementById("si-connect-btn");
  try {
    if (btn.dataset.mode === "regrant" && siRootHandle) {
      const perm = await siRootHandle.requestPermission({ mode: "readwrite" });
      if (perm !== "granted") {
        showToast("❌ Chưa cấp quyền truy cập thư mục");
        return;
      }
      siSetFolderStatus("connected");
      return;
    }

    const handle = await window.showDirectoryPicker();
    const perm = await handle.requestPermission({ mode: "readwrite" });
    if (perm !== "granted") {
      showToast("❌ Chưa cấp quyền truy cập thư mục");
      return;
    }
    siRootHandle = handle;
    await siIdbSetHandle(handle);
    siSetFolderStatus("connected");
    showToast("✅ Đã kết nối thư mục");
  } catch (e) {
    if (e.name !== "AbortError") {
      console.error(e);
      showToast("❌ Lỗi chọn thư mục: " + e.message);
    }
  }
}

// ============= Chọn theme → load data hiện có =============

async function onSampleImagesThemeChange() {
  const theme = document.getElementById("si-theme-select").value;
  document.getElementById("si-form").classList.add("hidden");
  siCurrentTheme = null;
  siThemeHandle = null;
  if (!theme || !siRootHandle) return;

  showLoading(true, "Đang tải dữ liệu...");
  try {
    siThemeHandle = await siRootHandle.getDirectoryHandle(theme, {
      create: true,
    });
    siCurrentTheme = theme;
    await siLoadThemeData();
    document.getElementById("si-form").classList.remove("hidden");
  } catch (e) {
    console.error(e);
    showToast("❌ Lỗi tải dữ liệu theme: " + e.message);
  } finally {
    showLoading(false);
  }
}

function siEmptySingle() {
  return { blob: null, focal: { x: 50, y: 50 }, previewUrl: null };
}

function siEmptyData() {
  const singleImages = {};
  SI_SINGLE_FIELDS.forEach((f) => (singleImages[f] = siEmptySingle()));
  return { singleImages, gallery: [], loveStory: [] };
}

async function siReadJsonSafe(dirHandle) {
  try {
    const fh = await dirHandle.getFileHandle("data.json");
    const file = await fh.getFile();
    return JSON.parse(await file.text());
  } catch (e) {
    return {};
  }
}

async function siGetFileOrNull(dirHandle, filename) {
  if (!filename) return null;
  try {
    const fh = await dirHandle.getFileHandle(filename);
    return await fh.getFile();
  } catch (e) {
    return null;
  }
}

async function siLoadThemeData() {
  siData = siEmptyData();
  const json = await siReadJsonSafe(siThemeHandle);

  for (const field of SI_SINGLE_FIELDS) {
    const file = await siGetFileOrNull(siThemeHandle, json[field]);
    if (file) {
      siData.singleImages[field] = {
        blob: file,
        focal: json.image_focal_points?.[field] || { x: 50, y: 50 },
        previewUrl: URL.createObjectURL(file),
      };
    }
  }

  const galleryNames = Array.isArray(json.gallery_images)
    ? json.gallery_images
    : [];
  for (const name of galleryNames) {
    const file = await siGetFileOrNull(siThemeHandle, name);
    if (file) {
      siData.gallery.push({
        blob: file,
        focal: json.image_focal_points?.gallery_images?.[name] || {
          x: 50,
          y: 50,
        },
        previewUrl: URL.createObjectURL(file),
      });
    }
  }

  const loveStoryArr = Array.isArray(json.love_story) ? json.love_story : [];
  for (const item of loveStoryArr) {
    const file = await siGetFileOrNull(siThemeHandle, item.image_url);
    siData.loveStory.push({
      date: item.date || "",
      title: item.title || "",
      content: item.content || "",
      blob: file,
      focal: item.focal_point || { x: 50, y: 50 },
      previewUrl: file ? URL.createObjectURL(file) : null,
    });
  }

  SI_SINGLE_FIELDS.forEach(siRenderSingleImage);
  siRenderGallery();
  siRenderLoveStory();
}

// Bản cục bộ: trang admin không nạp core/utils.js nên không dùng được bản chung.
// Giữ đồng bộ với escapeHtml() trong core/utils.js (escape đủ 5 ký tự).
function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ============= Ảnh đơn (cover / groom / bride / QR) =============

function siRenderSingleImage(fieldName) {
  const container = document.getElementById(`si-${fieldName}-container`);
  if (!container) return;

  const entry = siData.singleImages[fieldName];
  const isFocal = SI_FOCAL_POINT_FIELDS.includes(fieldName);
  const isCrop = SI_CROP_FIELDS.includes(fieldName);
  const sizeClass =
    fieldName === "cover_image_url" ? "aspect-[3/4]" : "aspect-square";
  const fpStyle = isFocal
    ? ` style="object-position: ${entry.focal.x}% ${entry.focal.y}%"`
    : "";

  if (entry.previewUrl) {
    const adjustBtn = isCrop
      ? `<button type="button" onclick="siRecropSingle('${fieldName}')" title="Cắt lại ảnh" class="absolute bottom-1 right-1 bg-black/50 hover:bg-black/70 text-white rounded-full w-6 h-6 flex items-center justify-center transition-colors"><i class="fas fa-crop text-xs"></i></button>`
      : isFocal
        ? `<button type="button" onclick="siAdjustSingleFocal('${fieldName}')" title="Chỉnh điểm lấy nét" class="absolute bottom-1 right-1 bg-black/50 hover:bg-black/70 text-white rounded-full w-6 h-6 flex items-center justify-center transition-colors"><i class="fas fa-crosshairs text-xs"></i></button>`
        : "";
    container.innerHTML = `
      <div class="relative ${sizeClass} rounded-xl overflow-hidden border border-rose-200 shadow-sm group bg-gray-100">
        <img src="${entry.previewUrl}" class="w-full h-full object-cover"${fpStyle} />
        ${adjustBtn}
        <button type="button" onclick="siRemoveSingle('${fieldName}')" class="absolute top-1 right-1 bg-red-500 rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600 transition-colors">
          <i class="fas fa-times text-xs text-white"></i>
        </button>
      </div>`;
  } else {
    container.innerHTML = `
      <button type="button" onclick="document.getElementById('si-${fieldName}-file-input').click()" class="flex items-center gap-1.5 h-8 px-3 rounded-xl border border-dashed border-rose-300 text-xs text-rose-400 hover:border-rose-400 hover:text-rose-500 transition-colors cursor-pointer">
        <i class="fas fa-image text-xs"></i> Chọn ảnh
      </button>`;
  }
}

async function siHandleSingleUpload(event, fieldName) {
  const file = event.target.files[0];
  event.target.value = "";
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    showToast("❌ Chỉ chấp nhận file ảnh!");
    return;
  }

  if (SI_CROP_FIELDS.includes(fieldName)) {
    openImageCropModal(file, (blob) => {
      const namedBlob = new File([blob], "cropped.png", { type: "image/png" });
      siData.singleImages[fieldName] = {
        blob: namedBlob,
        focal: { x: 50, y: 50 },
        previewUrl: URL.createObjectURL(namedBlob),
      };
      siRenderSingleImage(fieldName);
    });
    return;
  }

  const current = siData.singleImages[fieldName].focal;
  openFocalPointPicker(file, current, async (focal) => {
    showLoading(true, "Đang xử lý ảnh...");
    try {
      const resized = await siImageBL.resizeImage(file);
      siData.singleImages[fieldName] = {
        blob: resized,
        focal,
        previewUrl: URL.createObjectURL(resized),
      };
      siRenderSingleImage(fieldName);
    } catch (e) {
      showToast("❌ Lỗi xử lý ảnh: " + e.message);
    } finally {
      showLoading(false);
    }
  });
}

function siAdjustSingleFocal(fieldName) {
  const entry = siData.singleImages[fieldName];
  if (!entry.previewUrl) return;
  openFocalPointPicker(entry.previewUrl, entry.focal, (focal) => {
    entry.focal = focal;
    siRenderSingleImage(fieldName);
    showToast("✅ Đã cập nhật điểm lấy nét");
  });
}

function siRecropSingle(fieldName) {
  const entry = siData.singleImages[fieldName];
  if (!entry.blob) return;
  openImageCropModal(entry.blob, (blob) => {
    const namedBlob = new File([blob], "cropped.png", { type: "image/png" });
    siData.singleImages[fieldName] = {
      blob: namedBlob,
      focal: { x: 50, y: 50 },
      previewUrl: URL.createObjectURL(namedBlob),
    };
    siRenderSingleImage(fieldName);
  });
}

function siRemoveSingle(fieldName) {
  siData.singleImages[fieldName] = siEmptySingle();
  siRenderSingleImage(fieldName);
}

// ============= Album ảnh (gallery) =============

function siRenderGallery() {
  const container = document.getElementById("si-gallery-container");
  container.innerHTML = "";

  siData.gallery.forEach((item, idx) => {
    const div = document.createElement("div");
    div.className =
      "relative aspect-square rounded-xl overflow-hidden border border-rose-200 shadow-sm group bg-gray-100";
    div.innerHTML = `
      <img src="${item.previewUrl}" class="w-full h-full object-cover" style="object-position: ${item.focal.x}% ${item.focal.y}%" />
      <button type="button" onclick="siAdjustGalleryFocal(${idx})" title="Chỉnh điểm lấy nét" class="absolute bottom-1 right-1 bg-black/50 hover:bg-black/70 text-white rounded-full w-6 h-6 flex items-center justify-center transition-colors">
        <i class="fas fa-crosshairs text-xs"></i>
      </button>
      <button type="button" onclick="siRemoveGalleryImage(${idx})" class="absolute top-1 right-1 bg-red-500 rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600 transition-colors">
        <i class="fas fa-times text-xs text-white"></i>
      </button>
    `;
    container.appendChild(div);
  });

  document.getElementById("si-gallery-count").textContent =
    `${siData.gallery.length}/${SI_MAX_GALLERY}`;

  document.getElementById("si-gallery-add-btn")?.remove();
  if (siData.gallery.length < SI_MAX_GALLERY) {
    const btn = document.createElement("button");
    btn.id = "si-gallery-add-btn";
    btn.type = "button";
    btn.className =
      "mt-2 flex items-center gap-1.5 h-8 px-3 rounded-xl border border-dashed border-rose-300 text-xs text-rose-400 hover:border-rose-400 hover:text-rose-500 transition-colors cursor-pointer";
    btn.innerHTML = `<i class="fas fa-image text-xs"></i> Thêm ảnh`;
    btn.onclick = () =>
      document.getElementById("si-gallery-file-input").click();
    container.insertAdjacentElement("afterend", btn);
  }
}

async function siHandleGalleryUpload(event) {
  const files = Array.from(event.target.files || []);
  event.target.value = "";
  const room = SI_MAX_GALLERY - siData.gallery.length;
  if (room <= 0) {
    showToast(`⚠️ Tối đa ${SI_MAX_GALLERY} ảnh`);
    return;
  }

  showLoading(true, "Đang xử lý ảnh...");
  try {
    for (const file of files.slice(0, room)) {
      if (!file.type.startsWith("image/")) continue;
      const resized = await siImageBL.resizeImage(file);
      siData.gallery.push({
        blob: resized,
        focal: { x: 50, y: 50 },
        previewUrl: URL.createObjectURL(resized),
      });
    }
  } catch (e) {
    showToast("❌ Lỗi xử lý ảnh: " + e.message);
  } finally {
    showLoading(false);
  }
  siRenderGallery();
}

function siAdjustGalleryFocal(idx) {
  const item = siData.gallery[idx];
  if (!item) return;
  openFocalPointPicker(item.previewUrl, item.focal, (focal) => {
    item.focal = focal;
    siRenderGallery();
    showToast("✅ Đã cập nhật điểm lấy nét");
  });
}

function siRemoveGalleryImage(idx) {
  siData.gallery.splice(idx, 1);
  siRenderGallery();
}

// ============= Câu chuyện tình yêu =============

function siRenderLoveStory() {
  const list = document.getElementById("si-love-story-list");
  list.innerHTML = "";

  siData.loveStory.forEach((item, idx) => {
    const fpStyle = item.previewUrl
      ? ` style="object-position: ${item.focal.x}% ${item.focal.y}%"`
      : "";
    const div = document.createElement("div");
    div.className = "p-4 border border-gray-200 rounded-xl space-y-2 bg-rose-50/40";
    div.innerHTML = `
      <div class="flex items-center justify-between mb-1">
        <span id="si-ls-label-${idx}" class="text-xs font-medium text-rose-400">${escapeHtml(item.title) || `Mốc ${idx + 1}`}</span>
        <button type="button" onclick="siRemoveLoveStoryItem(${idx})" class="flex items-center gap-1 text-xs text-gray-400 hover:text-red-400 transition-colors">
          <i class="fas fa-trash"></i> Xóa
        </button>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <input type="text" value="${escapeHtml(item.date)}" placeholder="Ví dụ: Mùa xuân năm 2020"
          class="w-full h-10 px-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-rose-300"
          oninput="siData.loveStory[${idx}].date=this.value;" />
        <input type="text" value="${escapeHtml(item.title)}" placeholder="Ví dụ: Lần đầu gặp gỡ"
          class="w-full h-10 px-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-rose-300"
          oninput="siData.loveStory[${idx}].title=this.value;const lb=document.getElementById('si-ls-label-${idx}');if(lb)lb.textContent=this.value||'Mốc ${idx + 1}';" />
      </div>
      <textarea rows="2" placeholder="Nội dung..."
        class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:border-rose-300"
        oninput="siData.loveStory[${idx}].content=this.value;">${escapeHtml(item.content)}</textarea>
      <div class="flex items-center gap-2">
        <input type="file" id="si-ls-file-input-${idx}" accept="image/*" class="hidden" onchange="siHandleLoveStoryUpload(event, ${idx})" />
        ${
          item.previewUrl
            ? `<div class="relative w-16 h-16 rounded-xl overflow-hidden border border-rose-200 flex-shrink-0">
                <img src="${item.previewUrl}" class="w-full h-full object-cover"${fpStyle} />
                <button type="button" onclick="siAdjustLoveStoryFocal(${idx})" title="Chỉnh điểm lấy nét" class="absolute bottom-0.5 right-0.5 w-5 h-5 bg-black/50 rounded-full flex items-center justify-center text-white hover:bg-black/70 transition-colors">
                  <i class="fas fa-crosshairs" style="font-size:10px"></i>
                </button>
                <button type="button" onclick="siRemoveLoveStoryImage(${idx})" class="absolute top-0.5 right-0.5 w-5 h-5 bg-black/50 rounded-full flex items-center justify-center text-white hover:bg-red-500 transition-colors">
                  <i class="fas fa-times" style="font-size:10px"></i>
                </button>
              </div>`
            : `<button type="button" onclick="document.getElementById('si-ls-file-input-${idx}').click()" class="flex items-center gap-1.5 h-8 px-3 rounded-xl border border-dashed border-rose-300 text-xs text-rose-400 hover:border-rose-400 hover:text-rose-500 transition-colors">
                <i class="fas fa-image"></i> Thêm ảnh
              </button>`
        }
      </div>
    `;
    list.appendChild(div);
  });

  document.getElementById("si-love-story-count").textContent =
    `${siData.loveStory.length}/${SI_MAX_LOVE_STORY}`;
}

function siAddLoveStoryItem() {
  if (siData.loveStory.length >= SI_MAX_LOVE_STORY) {
    showToast(`⚠️ Tối đa ${SI_MAX_LOVE_STORY} mốc`);
    return;
  }
  siData.loveStory.push({
    date: "",
    title: "",
    content: "",
    blob: null,
    focal: { x: 50, y: 50 },
    previewUrl: null,
  });
  siRenderLoveStory();
}

function siRemoveLoveStoryItem(idx) {
  siData.loveStory.splice(idx, 1);
  siRenderLoveStory();
}

async function siHandleLoveStoryUpload(event, idx) {
  const file = event.target.files[0];
  event.target.value = "";
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    showToast("❌ Chỉ chấp nhận file ảnh!");
    return;
  }

  const current = siData.loveStory[idx].focal;
  openFocalPointPicker(file, current, async (focal) => {
    showLoading(true, "Đang xử lý ảnh...");
    try {
      const resized = await siImageBL.resizeImage(file);
      siData.loveStory[idx].blob = resized;
      siData.loveStory[idx].focal = focal;
      siData.loveStory[idx].previewUrl = URL.createObjectURL(resized);
      siRenderLoveStory();
    } catch (e) {
      showToast("❌ Lỗi xử lý ảnh: " + e.message);
    } finally {
      showLoading(false);
    }
  });
}

function siAdjustLoveStoryFocal(idx) {
  const item = siData.loveStory[idx];
  if (!item.previewUrl) return;
  openFocalPointPicker(item.previewUrl, item.focal, (focal) => {
    item.focal = focal;
    siRenderLoveStory();
  });
}

function siRemoveLoveStoryImage(idx) {
  siData.loveStory[idx].blob = null;
  siData.loveStory[idx].previewUrl = null;
  siData.loveStory[idx].focal = { x: 50, y: 50 };
  siRenderLoveStory();
}

// ============= Lưu vào ổ đĩa =============

async function siWriteFile(dirHandle, filename, blob) {
  const fh = await dirHandle.getFileHandle(filename, { create: true });
  const writable = await fh.createWritable();
  await writable.write(blob);
  await writable.close();
}

function siExtFromBlob(blob, fallback) {
  const type = blob.type || "";
  if (type.includes("png")) return "png";
  if (type.includes("webp")) return "webp";
  if (type.includes("jpeg") || type.includes("jpg")) return "jpg";
  return fallback;
}

async function siCleanupOrphans(dirHandle, keepFiles) {
  const pattern =
    /^(groom-qr|bride-qr|gallery-\d+|love-story-\d+|cover|groom|bride)\./;
  const toDelete = [];
  for await (const [name] of dirHandle.entries()) {
    if (pattern.test(name) && !keepFiles.has(name)) {
      toDelete.push(name);
    }
  }
  for (const name of toDelete) {
    try {
      await dirHandle.removeEntry(name);
    } catch (e) {
      console.warn("Không xoá được file rác:", name, e);
    }
  }
}

async function saveSampleImages() {
  if (!siThemeHandle || !siCurrentTheme) {
    showToast("❌ Chưa chọn theme hoặc chưa kết nối thư mục");
    return;
  }

  const btn = document.getElementById("si-save-btn");
  btn.disabled = true;
  showLoading(true, "Đang lưu...");

  try {
    const json = { image_focal_points: { gallery_images: {} } };
    const keepFiles = new Set(["data.json"]);

    for (const field of SI_SINGLE_FIELDS) {
      const entry = siData.singleImages[field];
      if (!entry.blob) continue;
      const isCrop = SI_CROP_FIELDS.includes(field);
      const ext = isCrop ? "png" : siExtFromBlob(entry.blob, "jpg");
      const filename = `${SI_FIELD_BASENAME[field]}.${ext}`;
      await siWriteFile(siThemeHandle, filename, entry.blob);
      keepFiles.add(filename);
      json[field] = filename;
      if (SI_FOCAL_POINT_FIELDS.includes(field)) {
        json.image_focal_points[field] = entry.focal;
      }
    }

    const galleryNames = [];
    for (let i = 0; i < siData.gallery.length; i++) {
      const item = siData.gallery[i];
      const ext = siExtFromBlob(item.blob, "jpg");
      const filename = `gallery-${String(i + 1).padStart(2, "0")}.${ext}`;
      await siWriteFile(siThemeHandle, filename, item.blob);
      keepFiles.add(filename);
      galleryNames.push(filename);
      json.image_focal_points.gallery_images[filename] = item.focal;
    }
    if (galleryNames.length) json.gallery_images = galleryNames;

    const loveStoryOut = [];
    for (let i = 0; i < siData.loveStory.length; i++) {
      const item = siData.loveStory[i];
      const entry = { date: item.date, title: item.title, content: item.content };
      if (item.blob) {
        const ext = siExtFromBlob(item.blob, "jpg");
        const filename = `love-story-${String(i + 1).padStart(2, "0")}.${ext}`;
        await siWriteFile(siThemeHandle, filename, item.blob);
        keepFiles.add(filename);
        entry.image_url = filename;
        entry.focal_point = item.focal;
      }
      loveStoryOut.push(entry);
    }
    if (loveStoryOut.length) json.love_story = loveStoryOut;

    // Dọn file rác (ảnh cũ không còn dùng) TRƯỚC khi ghi JSON, để nếu lỗi
    // giữa chừng thì data.json cũ vẫn trỏ tới đúng bộ ảnh còn nguyên vẹn.
    await siCleanupOrphans(siThemeHandle, keepFiles);

    json.updated_at = new Date().toISOString();
    const jsonBlob = new Blob([JSON.stringify(json, null, 2)], {
      type: "application/json",
    });
    await siWriteFile(siThemeHandle, "data.json", jsonBlob);

    showToast("✅ Đã lưu ảnh mẫu cho theme " + siCurrentTheme);

    // Ảnh demo vừa đổi → chụp lại thumbnail preview của template này (dùng
    // chung "Scan Image IFrame" ở tab Templates, xem 02-templates.js).
    if (typeof startScanImages === "function") {
      startScanImages([siCurrentTheme]);
    }
  } catch (e) {
    console.error(e);
    showToast("❌ Lỗi lưu: " + e.message);
  } finally {
    btn.disabled = false;
    showLoading(false);
  }
}

function siPreviewTheme() {
  if (!siCurrentTheme) {
    showToast("⚠️ Hãy chọn theme trước");
    return;
  }
  window.open(
    `../public/themes/${siCurrentTheme}/index.html?preview=true`,
    "_blank",
  );
}
