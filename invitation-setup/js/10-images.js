// Xem trước ảnh, điểm focal, kho ảnh chờ upload và preview cục bộ.
//
// Tách từ index.js (dòng 2265–2751 bản gốc). Thứ tự nạp khai báo ở loader.js.

// ============= HELPER FUNCTIONS =============

function generateUUID() {
  return cxUUID();
}

// getImageUrl() dùng bản ở core/utils.js (nạp trước file này). CỐ Ý KHÔNG khai
// lại ở đây: classic script chia sẻ biến toàn cục nên `function` khai sau ghi đè
// hàm cùng tên khai trước, im lặng và ở PHẠM VI CẢ TRANG — bản từng nằm ở đây chỉ
// gọi storageDAL.getPublicUrl() nên làm mất mấy nhánh nhận diện `blob:`/`data:`/
// đường dẫn tương đối của bản chuẩn.

// Kiểm định dạng + nén: logic nằm ở core/helpers/image-pick.js (dùng chung với ô chọn
// ảnh trong khung chat XuXi), hai tên này giữ lại cho các file trong trang gọi.
const _checkImageType = (file) => CXImagePick.checkType(file);
const prepareImage = (file) => CXImagePick.prepare(file);

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
      <img src="${cxImgSrc(fullUrl)}" alt="Gallery ${index + 1}" class="w-full h-full object-contain" style="object-position:${cxFocal(fp)}" />
      <x-button variant="overlay" size="xs" icon-only onclick="adjustGalleryFocalPoint(${index}, '${fullUrl}')" title="Chỉnh điểm lấy nét" class="absolute bottom-1 right-1">
        <i data-lucide="focus" class="w-3.5 h-3.5"></i>
      </x-button>
      <x-button tone="danger" size="xs" icon-only onclick="removeExistingGalleryImage(${index})" title="Xoá ảnh" class="absolute top-1 right-1">
        <img src="../assets/icons/bin.png" alt="Delete" class="w-3.5 h-3.5" />
      </x-button>
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
      <img src="${cxImgSrc(url)}" alt="New ${index + 1}" class="w-full h-full object-contain" style="object-position:${cxFocal(fp)}" />
      <x-button variant="overlay" size="xs" icon-only onclick="adjustGalleryFocalPoint(${globalIndex}, '${url}')" title="Chỉnh điểm lấy nét" class="absolute bottom-1 right-1">
        <i data-lucide="focus" class="w-3.5 h-3.5"></i>
      </x-button>
      <x-button tone="danger" size="xs" icon-only onclick="removeGalleryImage(${index})" title="Xoá ảnh" class="absolute top-1 right-1">
        <img src="../assets/icons/bin.png" alt="Delete" class="w-3.5 h-3.5" />
      </x-button>
    `;
    container.appendChild(div);
  });

  if (typeof lucide !== "undefined") lucide.createIcons();

  const totalImages =
    existingFilenames.length + pendingUploads.galleryImages.length;

  // Render upload button outside grid if not at max
  if (totalImages < MAX_GALLERY_IMAGES) {
    // <x-button> tự thay mình bằng <button> khi chèn, nên gắn onclick bằng
    // attribute (thuộc tính .onclick đặt trước khi chèn sẽ mất theo phần tử cũ).
    container.insertAdjacentHTML(
      "afterend",
      `<x-button variant="dashed" size="sm" id="gallery-add-btn" type="button"
         onclick="document.getElementById('gallery-file-input').click()" class="mt-2">
         <i data-lucide="image-plus" class="w-3.5 h-3.5"></i> Thêm ảnh
       </x-button>`
    );
    if (typeof lucide !== "undefined") lucide.createIcons();
  }
}

// Khung xem trước của ảnh chân dung/bìa: form chỉ cần nhận ra ảnh nào đang gắn
// nên khung để nhỏ, khung thật trên thiệp do điểm lấy nét quyết định.
// Ảnh bìa giữ dáng DỌC (3/4) vì thiệp cũng dựng dọc, chỉ cao hơn ảnh dâu/rể chút.
const _PREVIEW_BOX = {
  cover_image_url: { maxWidth: "100px", aspectRatio: "0.75" }, // 100×133
  groom_image_url: { maxWidth: "175px", aspectRatio: "1.75" }, // 175×100
  bride_image_url: { maxWidth: "175px", aspectRatio: "1.75" },
};

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
  if (
    fieldName === "cover_image_url" ||
    fieldName === "groom_image_url" ||
    fieldName === "bride_image_url"
  ) {
    sizeClass = ""; // khổ đặt inline theo _PREVIEW_BOX
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
  const _fpStyle = _fp ? ` style="object-position:${cxFocal(_fp)}"` : "";

  // Nút chỉnh khung: QR → cắt lại (crop); ảnh khác → điểm lấy nét (focal)
  const _adjustBtn = CROP_FIELDS.includes(fieldName)
    ? `<x-button variant="overlay" size="xs" icon-only onclick="recropSingleImage('${fieldName}')" title="Cắt lại ảnh" class="absolute bottom-1 right-1">
        <i data-lucide="crop" class="w-3.5 h-3.5"></i>
      </x-button>`
    : FOCAL_POINT_FIELDS.includes(fieldName)
      ? `<x-button variant="overlay" size="xs" icon-only onclick="adjustSingleImageFocalPoint('${fieldName}')" title="Chỉnh điểm lấy nét" class="absolute bottom-1 right-1">
        <i data-lucide="focus" class="w-3.5 h-3.5"></i>
      </x-button>`
      : "";

  // Check if there's a pending upload (new file selected)
  if (pendingUploads.singleImages[fieldName]) {
    // Has new image, show preview from File object
    const url = URL.createObjectURL(pendingUploads.singleImages[fieldName]);
    const div = document.createElement("div");
    div.className = `relative ${sizeClass} rounded-xl overflow-hidden border border-rose-200 shadow-sm group bg-gray-100`;
    if (_PREVIEW_BOX[fieldName]) {
      div.style.width = "100%";
      div.style.maxWidth = _PREVIEW_BOX[fieldName].maxWidth;
      div.style.aspectRatio = _PREVIEW_BOX[fieldName].aspectRatio;
    }
    div.innerHTML = `
      <img src="${cxImgSrc(url)}" alt="Preview" class="w-full h-full ${objectFit}"${_fpStyle} />
      ${_adjustBtn}
      <x-button tone="danger" size="xs" icon-only onclick="removeImage('${fieldName}')" title="Xoá ảnh" class="absolute top-1 right-1">
        <img src="../assets/icons/bin.png" alt="Delete" class="w-3.5 h-3.5" />
      </x-button>
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
      if (_PREVIEW_BOX[fieldName]) {
        div.style.width = "100%";
        div.style.maxWidth = _PREVIEW_BOX[fieldName].maxWidth;
        div.style.aspectRatio = _PREVIEW_BOX[fieldName].aspectRatio;
      }
      div.innerHTML = `
        <img src="${cxImgSrc(fullUrl)}" alt="Preview" class="w-full h-full ${objectFit}"${_fpStyle} />
        ${_adjustBtn}
        <x-button tone="danger" size="xs" icon-only onclick="removeImage('${fieldName}')" title="Xoá ảnh" class="absolute top-1 right-1">
          <img src="../assets/icons/bin.png" alt="Delete" class="w-3.5 h-3.5" />
        </x-button>
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

      container.insertAdjacentHTML(
        "beforeend",
        `<x-button variant="dashed" size="sm" type="button"
           onclick="document.getElementById('${prefix}-file-input').click()">
           <i data-lucide="image-plus" class="w-3.5 h-3.5"></i> Thêm ảnh
         </x-button>`
      );
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

// Ảnh chỉ vào pendingUploads SAU khi qua picker điểm lấy nét + nén (bất đồng bộ),
// còn xoá ảnh / chỉnh lại focal thì không sinh event nào — listener input/change
// của autosave luôn chạy sớm hơn hoặc không chạy. Mọi thao tác ảnh phải tự gọi
// hàm này, thiếu là mất dấu "chưa lưu" và khung xem trực tiếp vẫn dựng ảnh cũ.
// Sự kiện cx-media-change để ô chọn ảnh trong khung chat XuXi vẽ lại theo.
function _imagesChanged() {
  _scheduleAutoSave("edit");
  window.dispatchEvent(new CustomEvent("cx-media-change"));
}

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

// Ảnh album ĐÃ lưu (tên file, một dòng một tấm trong textarea ẩn). Ảnh mới chọn
// nằm ở pendingUploads.galleryImages — hai nguồn này luôn phải cộng lại khi đếm.
function _gallerySavedFilenames() {
  const textarea = document.querySelector(
    'textarea[name="gallery_images_raw"]',
  );
  return textarea ? textarea.value.trim().split("\n").filter(Boolean) : [];
}

// Quy đổi global index (vị trí hiển thị trong lưới) sang key ổn định để tra/lưu điểm lấy nét
function resolveGalleryFocalKey(globalIndex) {
  const existingFilenames = _gallerySavedFilenames();
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
  // Nhả ô input NGAY (giống handleGalleryUpload/handleLoveStoryImage): giữ lại
  // file cũ thì chọn lại ĐÚNG ảnh đó không bắn `change` nữa — sau khi bấm Hủy ở
  // bảng lấy nét, sau khi xoá ảnh, hay sau một file sai định dạng, cú chọn thứ
  // hai im lặng hoàn toàn nên trông y như upload bị hỏng.
  event.target.value = "";

  // Kiểm định dạng → bảng lấy nét (ảnh bìa/chú rể/cô dâu) hoặc cắt 1:1 (QR) → nén.
  const picked = await CXImagePick.single(fieldName, file, {
    focal: pendingFocalPoints[fieldName],
    giftInfo: _qrGiftInfo(fieldName),
  });
  if (picked) _storePickedImage(fieldName, picked.file, picked.focal);
}

// Ảnh đã chọn xong (qua CXImagePick) → hàng chờ upload + IndexedDB + vẽ lại ô ảnh.
function _storePickedImage(fieldName, file, focal) {
  // Đặt TRƯỚC _idbSaveSingle: bản ghi IDB chép điểm lấy nét từ pendingFocalPoints.
  if (focal) pendingFocalPoints[fieldName] = focal;
  pendingUploads.singleImages[fieldName] = file;
  _idbSaveSingle(fieldName, file);
  _idbDelete(`${WEDDING_ID}_sf_${fieldName}`); // bản ghi chỉ-lấy-nét của ảnh cũ
  renderSingleImageUpload(fieldName);
  _imagesChanged();
}

/**
 * Với field QR (groom_qr_url/bride_qr_url): đọc thông tin ngân hàng của đúng bên
 * để focal picker xem trước giống block Hộp Mừng Cưới. Field khác → null.
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
      _imagesChanged();
      showToast("Đã cập nhật điểm lấy nét", "success");
    },
    _qrGiftInfo(fieldName),
  );
}

/**
 * Lưu ảnh đã cắt (blob từ crop modal) cho field QR — thay ảnh, xoá focal cũ
 */
async function _storeCroppedImage(fieldName, blob, origName) {
  if (!blob) return;
  // Cắt đã "nướng" khung hình vào ảnh → điểm lấy nét về giữa.
  _storePickedImage(fieldName, await CXImagePick.fromCrop(blob, origName), {
    x: 50,
    y: 50,
  });
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

// ============= GALLERY UPLOAD =============

async function handleGalleryUpload(event) {
  const files = Array.from(event.target.files);
  event.target.value = "";
  if (files.length === 0) return;

  // Phải trừ CẢ ảnh đã lưu: chỉ đếm pending thì 8 ảnh trong DB + 1 ảnh mới vẫn
  // cho chọn thêm 9 tấm → 18 ảnh. Lúc lưu, ảnh đã đẩy lên Storage xong rồi
  // wedding-admin mới trả 400 "Tối đa 10 ảnh trong album" → mất cả lượt lưu và
  // để lại file rác. renderGalleryGrid() vốn đã đếm cả hai nguồn.
  const remainingSlots =
    MAX_GALLERY_IMAGES -
    _gallerySavedFilenames().length -
    pendingUploads.galleryImages.length;

  // Từng ảnh: kiểm định dạng → bảng lấy nét → nén (CXImagePick.gallery).
  const added = await CXImagePick.gallery(
    files,
    remainingSlots,
    (file, focal) => {
      pendingUploads.galleryImages.push(file);
      pendingFocalPoints.gallery_images.set(file, focal); // trước _idbAddGallery
      _idbAddGallery(file);
    },
    MAX_GALLERY_IMAGES,
  );

  renderGalleryGrid();
  if (added > 0) _imagesChanged();
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
    _imagesChanged();
    showToast("Đã cập nhật điểm lấy nét", "success");
  });
}

