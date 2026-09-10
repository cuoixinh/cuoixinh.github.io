/**
 * BL — Storage ảnh: đưa lên / xoá ảnh khỏi Supabase Storage. Phần XỬ LÝ ảnh (đo
 * kích thước, resize, nén) nằm ở core/helpers/image-helper.js.
 * File truyền vào đây PHẢI đã qua ImageHelper.prepareImage().
 */

class ImageBL {
  constructor(storageDAL) {
    this.storage = storageDAL;
  }

  /** 24 ký tự ngẫu nhiên — đủ để không đoán ra và không trùng. */
  static randomId() {
    const b = new Uint8Array(15);
    crypto.getRandomValues(b);
    return Array.from(b, (x) => x.toString(36).padStart(2, "0")).join("").slice(0, 24);
  }

  // Tên file KHÔNG được chứa wedding_id: ai liệt kê được bucket sẽ suy ra id rồi
  // tra tiếp hồ sơ thiệp qua Edge Function. Định danh duy nhất là chuỗi ngẫu
  // nhiên đủ dài — nơi giữ liên hệ file ↔ thiệp là các cột *_url của hàng DB
  // (wedding-admin và cleanup-weddings đều đọc từ đó, không bóc tên file).
  // `weddingId` giữ trong chữ ký vì nơi gọi vẫn truyền vào và để đổi ý còn dễ.
  async uploadSingleImage(weddingId, fieldName, file) {
    const extension = file.name.split(".").pop();
    const filename = `${fieldName}-${ImageBL.randomId()}.${extension}`;

    // Upload to storage
    return await this.storage.uploadFile(filename, file);
  }

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
