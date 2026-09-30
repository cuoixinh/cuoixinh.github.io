// Upload ảnh thật lên storage và xoá ảnh.
//
// Tách từ index.js (dòng 3141–3301 bản gốc). Thứ tự nạp khai báo ở loader.js.

// ============= ACTUAL UPLOAD FUNCTIONS =============

// Ảnh trong pendingUploads đã được nén sẵn lúc người dùng chọn (prepareImage ở
// 10-images.js) → ở đây chỉ đẩy lên storage, KHÔNG nén lại lần nữa.
async function uploadSingleImage(fieldName, file) {
  return await imageBL.uploadSingleImage(WEDDING_STORAGE_KEY, fieldName, file);
}

// Chưa đăng nhập thì KHÔNG đẩy lên storage: từ RC1.15 bucket chỉ nhận
// `authenticated`, gọi lúc này chỉ tổ ăn một loạt lỗi 403 rồi hiện toast đỏ.
// Nháp của khách chưa đăng nhập nằm trọn trong IndexedDB (_idbRestoreAll), nên
// ảnh vẫn còn nguyên và sẽ được đẩy lên ở lần lưu đầu tiên SAU khi đăng nhập.
// ĐỔI ảnh (khác XOÁ ảnh ở removeImage) cũng bỏ lại một file: tên cũ bị tên mới
// ghi đè trong payload nên không luồng dọn nào còn thấy nó. Gọi ngay sau khi
// upload thành công — xếp hàng sớm hơn là lưu hụt vẫn xoá mất ảnh đang dùng.
// Gửi nguyên giá trị (tên hay URL đầy đủ) — server tự quy về đường dẫn trong bucket.
function _queueReplacedImage(oldValue) {
  if (oldValue) deletedImages.singleImages.push(oldValue);
}

async function uploadAllPendingImages() {
  const uploadedFilenames = {};
  const errors = [];

  // `skipped` để nơi gọi biết KHÔNG được dọn pendingUploads/IndexedDB sau đó:
  // ảnh chưa lên Storage nên dọn là mất hẳn (xem Step 6 của saveAll).
  if (!IS_LOGIN) return { uploadedFilenames, errors, skipped: true };

  // Upload single images
  for (const [fieldName, file] of Object.entries(pendingUploads.singleImages)) {
    const previous = document.querySelector(`input[name="${fieldName}"]`)?.value;
    try {
      const filename = await uploadSingleImage(fieldName, file);
      if (filename !== previous) _queueReplacedImage(previous);
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
        WEDDING_STORAGE_KEY,
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
    const previous = _loveStoryItems[idx]?.image_url;
    try {
      const filename = await uploadSingleImage(`love_story_image_${idx}`, file);
      if (filename !== previous) _queueReplacedImage(previous);
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

  return { uploadedFilenames, errors, skipped: false };
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

    if (existingFilename) deletedImages.singleImages.push(existingFilename);

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
  _imagesChanged();

  showToast("Đã xóa ảnh", "default", "trash-2");
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
  _imagesChanged();

  showToast("Đã xóa ảnh", "default", "trash-2");
}

function removeExistingGalleryImage(index) {
  // Remove from existing images (already in DB)
  const textarea = document.querySelector(
    'textarea[name="gallery_images_raw"]',
  );
  if (!textarea) return;

  const filenames = textarea.value.trim().split("\n").filter(Boolean);
  const deletedFilename = filenames[index];

  if (deletedFilename) deletedImages.galleryImages.push(deletedFilename);

  filenames.splice(index, 1);
  textarea.value = filenames.join("\n");

  // Xoá điểm lấy nét gắn với ảnh này (key = filename, không phụ thuộc index)
  if (deletedFilename) {
    pendingFocalPoints.gallery_images.delete(deletedFilename);
    _idbDelete(`${WEDDING_ID}_gf_${deletedFilename}`);
  }

  // Render grid
  renderGalleryGrid();
  _imagesChanged();

  showToast("Đã xóa ảnh", "default", "trash-2");
}

