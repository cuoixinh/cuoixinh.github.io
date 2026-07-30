// Upload ảnh thật lên storage và xoá ảnh.
//
// Tách từ index.js (dòng 3141–3301 bản gốc). Thứ tự nạp khai báo ở loader.js.

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

  showToast("Đã xóa ảnh", "default", "trash-2");
}

