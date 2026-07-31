// ============================================================
// IMAGE-HELPER.JS — Xử lý ảnh phía client (thuần canvas)
// ============================================================
//
// Đo kích thước, resize, nén ảnh NGAY TRÊN TRÌNH DUYỆT. Hoàn toàn không đụng
// storage/DB — nơi nào cần đẩy ảnh lên Supabase thì gọi ImageBL (core/bl/), nơi
// nào ghi xuống ổ đĩa (admin, File System Access API) thì tự ghi.
//
// QUY TẮC CHUNG CỦA CẢ WEB: ảnh chỉ được nén ĐÚNG MỘT LẦN, ngay lúc vào state
// (người dùng chọn ảnh / bind ảnh từ đĩa) qua ImageHelper.prepareImage(). Lúc
// lưu KHÔNG nén lại — mã hoá lossy lần hai chỉ làm mất chất lượng và tốn thời
// gian. Các luồng đang theo quy tắc này:
//   - invitation-setup/js/10-images.js  (khách chọn ảnh thiệp)
//   - admin/js/03-sample-images.js      (ảnh mẫu của theme)
//   - admin/js/05-asset-images.js       (kho ảnh dùng chung, ngưỡng riêng)
//
// Ngưỡng truyền theo từng lời gọi (tham số `limits`), KHÔNG giữ state trong
// helper — hai tab admin dùng ngưỡng khác nhau nên biến dùng chung là mầm bug.

window.ImageHelper = (function () {
  // Ngưỡng mặc định = ngưỡng ảnh khách tự upload.
  const DEFAULT_LIMITS = {
    maxWidth: 1920,
    maxHeight: 1920,
    maxSizeMB: 1,
    quality: 0.85,
  };

  // Ảnh gốc từ máy ảnh có thể rất nặng; resize xong mới nhẹ. Đây là chặn đầu
  // vào để không treo trình duyệt khi decode.
  const MAX_INPUT_MB = 50;

  // Định dạng mã hoá lại qua canvas được mà không mất mát ngoài ý muốn.
  // GIF (mất animation), AVIF/BMP/SVG (canvas đổi luôn định dạng, lệch đuôi
  // file) đều bị loại — thà giữ nguyên còn hơn phá file.
  const RECOMPRESSABLE = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

  function _limits(limits) {
    return { ...DEFAULT_LIMITS, ...(limits || {}) };
  }

  /**
   * Chặn file không phải ảnh / quá nặng trước khi decode.
   * @param {File|Blob} file
   * @throws {Error} Nếu không hợp lệ
   */
  function validateImageFile(file) {
    if (!file) {
      throw new Error("File is required");
    }
    if (!file.type.startsWith("image/")) {
      throw new Error("Chỉ chấp nhận file ảnh");
    }
    if (file.size > MAX_INPUT_MB * 1024 * 1024) {
      throw new Error(`File quá lớn (tối đa ${MAX_INPUT_MB}MB)`);
    }
  }

  /**
   * Định dạng có mã hoá lại qua canvas được không.
   * @param {File|Blob} file
   * @returns {boolean}
   */
  function canRecompress(file) {
    return RECOMPRESSABLE.includes((file?.type || "").toLowerCase());
  }

  /**
   * Đọc kích thước thật của ảnh mà không vẽ lại canvas.
   * @param {File|Blob} file
   * @returns {Promise<{width:number,height:number}|null>} null nếu không decode được
   */
  async function getImageDimensions(file) {
    if (typeof createImageBitmap === "function") {
      try {
        const bitmap = await createImageBitmap(file);
        const dim = { width: bitmap.width, height: bitmap.height };
        if (bitmap.close) bitmap.close();
        return dim;
      } catch (e) {
        // Safari cũ / định dạng lạ → rơi xuống nhánh <img> bên dưới
      }
    }

    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
        URL.revokeObjectURL(url);
      };
      img.onerror = () => {
        resolve(null);
        URL.revokeObjectURL(url);
      };
      img.src = url;
    });
  }

  /**
   * Vẽ lại ảnh qua canvas theo đúng ngưỡng. Luôn mã hoá lại, kể cả khi ảnh đã
   * đạt ngưỡng — dùng compressIfNeeded()/prepareImage() nếu muốn tránh việc đó.
   * @param {File|Blob} file
   * @param {object} [limits] - Ghi đè DEFAULT_LIMITS
   * @returns {Promise<File>}
   */
  async function resizeImage(file, limits) {
    const L = _limits(limits);
    validateImageFile(file);

    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        const img = new Image();

        img.onload = () => {
          // Calculate new dimensions
          let width = img.width;
          let height = img.height;

          if (width > L.maxWidth || height > L.maxHeight) {
            if (width > height) {
              if (width > L.maxWidth) {
                height = Math.round((height * L.maxWidth) / width);
                width = L.maxWidth;
              }
            } else {
              if (height > L.maxHeight) {
                width = Math.round((width * L.maxHeight) / height);
                height = L.maxHeight;
              }
            }
          }

          // Create canvas and resize
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);

          _compressCanvas(canvas, file, L, L.quality, resolve, reject);
        };

        img.onerror = () => reject(new Error("Failed to load image"));
        img.src = e.target.result;
      };

      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsDataURL(file);
    });
  }

  /**
   * Hạ quality dần cho tới khi đạt maxSizeMB.
   * @private
   */
  function _compressCanvas(canvas, originalFile, L, quality, resolve, reject) {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Failed to compress image"));
          return;
        }

        const sizeMB = blob.size / 1024 / 1024;

        // Còn nặng và còn hạ quality được thì thử lại. PNG bỏ qua tham số
        // quality nên hạ quality chỉ tốn thêm vòng mã hoá vô ích.
        const lossy = /jpeg|jpg|webp/i.test(originalFile.type || "");
        if (sizeMB > L.maxSizeMB && quality > 0.3 && lossy) {
          _compressCanvas(canvas, originalFile, L, quality - 0.1, resolve, reject);
        } else {
          resolve(
            new File([blob], originalFile.name, {
              type: originalFile.type,
              lastModified: Date.now(),
            }),
          );
        }
      },
      originalFile.type,
      quality,
    );
  }

  /**
   * Nén CHỈ KHI cần: ảnh đã đạt ngưỡng thì trả lại nguyên bản (không mã hoá lại
   * → không mất chất lượng vô ích), chưa đạt thì trả bản đã nén.
   * @param {File|Blob} file
   * @param {object} [limits]
   * @returns {Promise<{file: File|Blob, compressed: boolean}>}
   */
  async function compressIfNeeded(file, limits) {
    const L = _limits(limits);
    if (!file || !canRecompress(file)) return { file, compressed: false };

    const tooHeavy = file.size > L.maxSizeMB * 1024 * 1024;
    const dim = await getImageDimensions(file);
    const tooLarge =
      !!dim && (dim.width > L.maxWidth || dim.height > L.maxHeight);

    if (!tooHeavy && !tooLarge) return { file, compressed: false };
    if (!dim) return { file, compressed: false }; // không decode được → để yên

    const out = await resizeImage(file, L);

    // Ảnh vốn đã tối ưu sẵn (JPEG quality thấp chẳng hạn): mã hoá lại có thể ra
    // file NẶNG HƠN. Khung ảnh không vượt ngưỡng thì giữ bản gốc cho lành.
    if (!tooLarge && out.size >= file.size) return { file, compressed: false };

    return { file: out, compressed: true };
  }

  /**
   * ĐIỂM VÀO DUY NHẤT để chuẩn hoá ảnh — mọi luồng upload/lưu ảnh của web đều
   * gọi hàm này, đúng một lần, ngay lúc ảnh vào state.
   *
   * @param {File|Blob} file
   * @param {object} [limits] - Ghi đè ngưỡng mặc định (kho ảnh admin dùng ngưỡng
   *   riêng theo từng danh mục)
   * @returns {Promise<{file: File|Blob, compressed: boolean, savedBytes: number}>}
   * @throws {Error} Nếu không phải ảnh hoặc lớn hơn 50MB
   */
  async function prepareImage(file, limits) {
    validateImageFile(file);
    const res = await compressIfNeeded(file, limits);
    return {
      ...res,
      savedBytes: res.compressed ? file.size - res.file.size : 0,
    };
  }

  return {
    DEFAULT_LIMITS,
    MAX_INPUT_MB,
    validateImageFile,
    canRecompress,
    getImageDimensions,
    resizeImage,
    compressIfNeeded,
    prepareImage,
  };
})();
