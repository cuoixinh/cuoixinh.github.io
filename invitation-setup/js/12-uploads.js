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

// Số ảnh đẩy cùng lúc: chồng thời gian khứ hồi lên nhau; cao quá thì mạng di động
// yếu chia băng thông mỏng ra, cả loạt cùng chạm hạn chờ của StorageDAL.
const UPLOAD_CONCURRENCY = 4;

// Chạy `jobs` (hàm trả Promise, tự bắt lỗi) với tối đa `limit` việc cùng lúc.
async function _runPool(jobs, limit, onDone) {
  let next = 0;
  const worker = async () => {
    while (next < jobs.length) {
      await jobs[next++]();
      onDone?.();
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, jobs.length) }, worker));
}

// Trả thêm `keep` (ảnh lỗi mạng/máy chủ — giữ lại cho lần lưu sau thử tiếp) và `lost`
// (số ảnh hỏng hẳn, code UNREADABLE của StorageDAL — bỏ khỏi hàng chờ, khách phải chọn lại).
async function uploadAllPendingImages() {
  const uploadedFilenames = {};
  const errors = [];
  const keep = { singles: [], gallery: [] };
  let lost = 0;
  // Ảnh hỏng hẳn thì đếm vào `lost`, còn lại `onRetry` ghi ảnh vào `keep`.
  const fail = (label, error, onRetry) => {
    console.error(`Error uploading ${label}:`, error);
    errors.push(`${label}: ${error.message}`);
    if (error.code === "UNREADABLE") lost++;
    else onRetry();
  };

  // `skipped` để nơi gọi biết KHÔNG được dọn pendingUploads/IndexedDB sau đó:
  // ảnh chưa lên Storage nên dọn là mất hẳn (xem Step 6 của saveAll).
  if (!IS_LOGIN) return { uploadedFilenames, errors, skipped: true, keep, lost };

  // Mỗi ảnh một việc, chạy chung một hàng đợi song song (_runPool). Album giữ mảng
  // THƯA theo đúng vị trí trong pendingUploads.galleryImages — saveAll tra tên file
  // theo indexOf của File, tấm hỏng để trống thì các tấm sau không lệch chỗ.
  const gallery = new Array(pendingUploads.galleryImages.length);
  const hadLoveStory = Object.keys(_loveStoryPendingImages).length > 0;
  const jobs = [
    ...Object.entries(pendingUploads.singleImages).map(([fieldName, file]) => async () => {
      const previous = document.querySelector(`input[name="${fieldName}"]`)?.value;
      try {
        const filename = await uploadSingleImage(fieldName, file);
        if (filename !== previous) _queueReplacedImage(previous);
        uploadedFilenames[fieldName] = filename;
      } catch (error) {
        fail(fieldName, error, () => keep.singles.push(fieldName));
      }
    }),
    ...pendingUploads.galleryImages.map((file, i) => async () => {
      try {
        gallery[i] = await uploadSingleImage(`gallery-${i}`, file);
      } catch (error) {
        fail(`Gallery ${i + 1}`, error, () => keep.gallery.push(file));
      }
    }),
    ...Object.entries(_loveStoryPendingImages).map(([idxStr, file]) => async () => {
      const idx = parseInt(idxStr);
      const previous = _loveStoryItems[idx]?.image_url;
      try {
        const filename = await uploadSingleImage(`love_story_image_${idx}`, file);
        if (filename !== previous) _queueReplacedImage(previous);
        _loveStoryItems[idx].image_url = filename;
        delete _loveStoryPendingImages[idxStr];
      } catch (error) {
        fail(`Love story ảnh ${idx + 1}`, error, () => {});
        if (error.code === "UNREADABLE") delete _loveStoryPendingImages[idxStr];
      }
    }),
  ];

  // Tiến độ trên màn chờ: không có số thì chậm trông y như treo.
  let done = 0;
  const tick = () => {
    if (jobs.length > 1) showLoading(true, `Đang tải ảnh lên ${done}/${jobs.length}...`);
  };
  tick();
  await _runPool(jobs, UPLOAD_CONCURRENCY, () => {
    done++;
    tick();
  });

  if (gallery.some(Boolean)) uploadedFilenames.gallery_images = gallery;

  // Ảnh chuyện tình đã lên (hoặc hỏng hẳn) bị gỡ ngay trong vòng trên; tấm lỗi mạng còn
  // nằm lại _loveStoryPendingImages cho lần lưu sau.
  if (hadLoveStory) _syncLoveStoryHidden();

  return { uploadedFilenames, errors, skipped: false, keep, lost };
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

// Xoá theo vị trí trong lưới (thứ tự kéo thả) — tự rẽ sang ảnh đã lưu / ảnh mới.
function removeGalleryItem(globalIndex) {
  const key = galleryItems()[globalIndex];
  if (key instanceof File)
    removeGalleryImage(pendingUploads.galleryImages.indexOf(key));
  else if (key) removeExistingGalleryImage(_gallerySavedFilenames().indexOf(key));
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

