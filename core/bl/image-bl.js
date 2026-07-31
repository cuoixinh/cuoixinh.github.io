/**
 * BL (Business Logic Layer) - Image Storage
 *
 * Đưa ảnh lên / xoá ảnh khỏi Supabase Storage. Phần XỬ LÝ ảnh (đo kích thước,
 * resize, nén — thuần canvas, không đụng mạng) nằm ở core/helpers/image-helper.js.
 *
 * File truyền vào đây PHẢI đã qua ImageHelper.prepareImage() lúc người dùng
 * chọn ảnh: cả web nén ĐÚNG MỘT LẦN, lúc lưu không nén lại.
 */

class ImageBL {
  constructor(storageDAL) {
    this.storage = storageDAL;
  }

  /**
   * Upload single image
   *
   * @param {string} weddingId - Wedding UUID
   * @param {string} fieldName - Field name (e.g., "cover_image_url")
   * @param {File} file - File đã chuẩn hoá sẵn
   * @returns {Promise<string>} Uploaded filename
   */
  async uploadSingleImage(weddingId, fieldName, file) {
    // Generate filename
    const extension = file.name.split(".").pop();
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    const filename = `${weddingId}-${fieldName}-${timestamp}-${random}.${extension}`;

    // Upload to storage
    return await this.storage.uploadFile(filename, file);
  }

  /**
   * Upload multiple images (gallery)
   * @param {string} weddingId - Wedding UUID
   * @param {Array<File>} files - Array of files
   * @returns {Promise<Object>} Result with filenames and errors
   */
  async uploadMultipleImages(weddingId, files) {
    const filenames = [];
    const errors = [];

    for (let i = 0; i < files.length; i++) {
      try {
        const filename = await this.uploadSingleImage(
          weddingId,
          `gallery-${i}`,
          files[i],
        );
        filenames.push(filename);
      } catch (error) {
        errors.push({
          index: i,
          filename: files[i].name,
          error: error.message,
        });
      }
    }

    return { filenames, errors };
  }

  /**
   * Delete images from storage
   * @param {Array<string>} filenames - Array of filenames
   * @returns {Promise<Array>} Results
   */
  async deleteImages(filenames) {
    if (!filenames || filenames.length === 0) {
      return [];
    }

    // Filter out full URLs (only delete filenames)
    const filenamesToDelete = filenames.filter(
      (f) => f && !f.startsWith("http://") && !f.startsWith("https://"),
    );

    if (filenamesToDelete.length === 0) {
      return [];
    }

    return await this.storage.deleteFiles(filenamesToDelete);
  }

  /**
   * Generate UUID for filename
   * @returns {string} UUID
   */
  generateUUID() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
      /[xy]/g,
      function (c) {
        const r = (Math.random() * 16) | 0;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      },
    );
  }
}

// Export for use in other files
if (typeof window !== "undefined") {
  window.ImageBL = ImageBL;
}
