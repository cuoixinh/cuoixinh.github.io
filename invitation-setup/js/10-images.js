// Xem trước ảnh, điểm focal, kho ảnh chờ upload và preview cục bộ.
//
// Tách từ index.js (dòng 2265–2751 bản gốc). Thứ tự nạp khai báo ở loader.js.

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
    const fp = getGalleryFocalPoint(filename);
    const div = document.createElement("div");
    div.className =
      "relative rounded-xl overflow-hidden border border-rose-200 shadow-sm group bg-gray-100";
    div.style.width = "100%";
    div.style.aspectRatio = "1";
    div.innerHTML = `
      <img src="${fullUrl}" alt="Gallery ${index + 1}" class="w-full h-full object-contain" style="object-position: ${fp.x}% ${fp.y}%" />
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
    const fp = getGalleryFocalPoint(file);
    const div = document.createElement("div");
    div.className =
      "relative rounded-xl overflow-hidden border border-rose-200 shadow-sm group bg-gray-100";
    div.style.width = "100%";
    div.style.aspectRatio = "1";
    div.innerHTML = `
      <img src="${url}" alt="New ${index + 1}" class="w-full h-full object-contain" style="object-position: ${fp.x}% ${fp.y}%" />
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

  const _fp = FOCAL_POINT_FIELDS.includes(fieldName)
    ? pendingFocalPoints[fieldName]
    : null;
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
    showToast("Chỉ chấp nhận file ảnh!", "error");
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
    openFocalPointPicker(
      file,
      pendingFocalPoints[fieldName],
      async (focal) => {
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
          showToast("Đã chọn ảnh (chưa lưu)", "success");
        } catch (error) {
          console.error("Error processing image:", error);
          showToast("Lỗi xử lý ảnh: " + error.message, "error");
        } finally {
          showLoading(false);
        }
      },
      _qrGiftInfo(fieldName),
    );
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

      showToast("Đã chọn ảnh (chưa lưu)", "success");
    } catch (error) {
      console.error("Error processing image:", error);
      showToast("Lỗi xử lý ảnh: " + error.message, "error");
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
    label:
      (side === "groom" ? "Chú Rể" : "Cô Dâu") + (name ? ` · ${name}` : ""),
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

  openFocalPointPicker(
    source,
    pendingFocalPoints[fieldName],
    (focal) => {
      pendingFocalPoints[fieldName] = focal;
      renderSingleImageUpload(fieldName);
      if (pendingUploads.singleImages[fieldName]) {
        _idbSaveSingle(fieldName, pendingUploads.singleImages[fieldName]);
      } else {
        _idbSaveFocal(fieldName);
      }
      showToast("Đã cập nhật điểm lấy nét", "success");
    },
    _qrGiftInfo(fieldName),
  );
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
  showToast("Đã cắt ảnh (chưa lưu)", "success");
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
      showToast("Không tải được ảnh để cắt lại", "error");
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
    showToast("Đã cập nhật điểm lấy nét", "success");
  });
}

