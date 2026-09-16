/**
 * BL — Storage ảnh: đưa lên / xoá ảnh khỏi Supabase Storage. Phần XỬ LÝ ảnh (đo
 * kích thước, resize, nén) nằm ở core/helpers/image-helper.js.
 * File truyền vào đây PHẢI đã qua ImageHelper.prepareImage().
 */

class ImageBL {
  constructor(storageDAL) {
    this.storage = storageDAL;
  }

  // Tên file phải khớp allowlist `^[A-Za-z0-9._-]+$` mà wedding-admin
  // (isSafeImageRef) và image-proxy cùng dùng — lệch là ảnh lưu được nhưng lần
  // lưu thiệp sau bị từ chối. Hai hàm dưới giữ đúng giao kèo đó.

  /** Đuôi file suy từ KIỂU MIME, không từ file.name (tên do client đặt, bịa được). */
  static safeExt(file) {
    const MAP = {
      "image/jpeg": "jpg",
      "image/jpg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "image/gif": "gif",
      "image/avif": "avif",
      "image/bmp": "bmp",
      "image/svg+xml": "svg",
    };
    if (MAP[file?.type]) return MAP[file.type];
    const raw = String(file?.name || "").split(".").pop() || "";
    return /^[a-z0-9]{1,5}$/i.test(raw) ? raw.toLowerCase() : "jpg";
  }

  /** Tiền tố tên trường (vd `cover_image_url`, `love_story_image_2`). */
  static safeField(fieldName) {
    const s = String(fieldName || "img").replace(/[^A-Za-z0-9_-]/g, "");
    return s.slice(0, 40) || "img";
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
    const filename = `${ImageBL.safeField(fieldName)}-${ImageBL.randomId()}.${ImageBL.safeExt(file)}`;

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

  generateUUID() {
    return cxUUID();
  }
}

// Export for use in other files
if (typeof window !== "undefined") {
  window.ImageBL = ImageBL;
}
