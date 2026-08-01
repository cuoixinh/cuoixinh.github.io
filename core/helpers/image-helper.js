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
// `limits.allowedTypes` (whitelist định dạng NHẬN VÀO) cũng đi theo lời gọi vì
// lý do đó: kho ảnh admin nhận SVG (icon hoa, khung viền), ảnh khách thì không.
//
// ĐẦU RA CÓ THỂ ĐỔI ĐỊNH DẠNG: ảnh phải nén sẽ ra WebP (kèm đuôi file đổi
// theo), ảnh đã đạt ngưỡng thì giữ nguyên bản lẫn định dạng gốc. Lý do và các
// đánh đổi ghi ở compressIfNeeded(). Nơi nào tự đặt tên file cho ảnh sau khi
// nén thì phải lấy đuôi từ `file.name`/`blob.type` của KẾT QUẢ, đừng lấy theo
// tên file người dùng chọn.

window.ImageHelper = (function () {
  // Ngưỡng khai báo tập trung ở core/config.js (CONFIG.image) — sửa số ở đó,
  // không sửa ở đây. Fallback chỉ để helper còn chạy nếu trang nào quên nạp
  // config.js trước.
  const _cfg = (typeof CONFIG !== "undefined" && CONFIG.image) || {};

  // Ngưỡng mặc định = ngưỡng ảnh khách tự upload.
  const DEFAULT_LIMITS = {
    maxWidth: 1920,
    maxHeight: 1920,
    maxSizeMB: 1,
    quality: 0.85,
    // Whitelist định dạng NHẬN VÀO (khác RECOMPRESSABLE = định dạng nén được).
    // Đi theo `limits` chứ không cứng ở đây: kho ảnh admin có SVG thật.
    allowedTypes: _cfg.allowedTypes || [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
      "image/gif",
      "image/avif",
    ],
    ..._cfg.customer,
  };

  // Ảnh gốc từ máy ảnh có thể rất nặng; resize xong mới nhẹ. Đây là chặn đầu
  // vào để không treo trình duyệt khi decode.
  const MAX_INPUT_MB = _cfg.maxInputMB || 50;

  // Định dạng mã hoá lại qua canvas được mà không mất mát ngoài ý muốn.
  // GIF (mất animation), AVIF/BMP/SVG (canvas đổi luôn định dạng, lệch đuôi
  // file) đều bị loại — thà giữ nguyên còn hơn phá file.
  const RECOMPRESSABLE = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

  // Đuôi file theo mime ĐẦU RA. Đổi định dạng thì phải đổi cả tên file: chỗ
  // đẩy lên Storage lấy đuôi từ `file.name` (core/bl/image-bl.js), chỗ ghi
  // xuống đĩa lấy từ `blob.type` — sai một trong hai là lệch đuôi.
  const EXT_BY_TYPE = {
    "image/webp": "webp",
    "image/jpeg": "jpg",
    "image/png": "png",
  };

  function _limits(limits) {
    return { ...DEFAULT_LIMITS, ...(limits || {}) };
  }

  /**
   * Định dạng có nằm trong whitelist NHẬN VÀO không.
   *
   * Khác canRecompress(): cái kia hỏi "nén được không", cái này hỏi "có cho vào
   * web không". GIF/AVIF nhận nhưng không nén; SVG/HEIC thì từ chối thẳng.
   * Whitelist đi theo lời gọi vì kho ảnh admin nhận SVG còn khách thì không.
   * @param {File|Blob} file
   * @param {object} [limits]
   * @returns {boolean}
   */
  function isAllowedType(file, limits) {
    const type = (file?.type || "").toLowerCase();
    const allowed = _limits(limits).allowedTypes;
    // Không khai whitelist → về hành vi cũ, nhận mọi image/*
    if (!allowed || !allowed.length) return type.startsWith("image/");
    return allowed.includes(type);
  }

  /**
   * Chặn file không phải ảnh / sai định dạng / quá nặng trước khi decode.
   * @param {File|Blob} file
   * @param {object} [limits] - Cần khi luồng dùng whitelist riêng (kho ảnh admin)
   * @throws {Error} Nếu không hợp lệ
   */
  function validateImageFile(file, limits) {
    if (!file) {
      throw new Error("File is required");
    }
    if (!file.type.startsWith("image/")) {
      throw new Error("Chỉ chấp nhận file ảnh");
    }
    if (!isAllowedType(file, limits)) {
      throw new Error(
        "Định dạng ảnh không hỗ trợ — hãy dùng JPG, PNG hoặc WebP " +
          "(ảnh iPhone .HEIC cần đổi sang JPG trước khi tải lên)",
      );
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
   * Decode ảnh ra một nguồn vẽ được, kèm hàm dọn. Gọi xong PHẢI gọi `cleanup()`
   * (đóng bitmap / thu hồi objectURL), tốt nhất là trong `finally`.
   *
   * `imageOrientation: "from-image"` là BẮT BUỘC chứ không phải tuỳ chọn: mặc
   * định của createImageBitmap từng là "none" (bỏ qua EXIF) và các trình duyệt
   * theo spec mới không đồng loạt. Thiếu cờ này thì ảnh dọc chụp bằng điện thoại
   * (EXIF orientation 6) sẽ NẰM NGANG sau khi nén — mà chỉ ảnh PHẢI nén mới bị,
   * ảnh nhẹ giữ nguyên bản vẫn còn EXIF nên hiển thị đúng. Cùng một album mà ảnh
   * đúng ảnh sai là lỗi người dùng không thể tự hiểu nổi.
   *
   * Nhánh <img> không cần cờ đó: trình duyệt hiện đại mặc định
   * `image-orientation: from-image` khi render nên drawImage đã ra đúng chiều.
   *
   * @private
   * @returns {Promise<{source: ImageBitmap|HTMLImageElement, cleanup: Function}>}
   * @throws {Error} Nếu cả hai đường decode đều hỏng
   */
  async function _decode(file) {
    if (typeof createImageBitmap === "function") {
      try {
        const bitmap = await createImageBitmap(file, {
          imageOrientation: "from-image",
        });
        return {
          source: bitmap,
          cleanup: () => bitmap.close && bitmap.close(),
        };
      } catch (e) {
        // Safari cũ / định dạng lạ / hết RAM → rơi xuống nhánh <img>
      }
    }

    // objectURL chứ không phải dataURL: base64 phồng thêm 33% và phải giữ
    // nguyên chuỗi đó trong RAM suốt lúc decode.
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error("Failed to load image"));
        el.src = url;
      });
      return { source: img, cleanup: () => URL.revokeObjectURL(url) };
    } catch (e) {
      URL.revokeObjectURL(url);
      throw e;
    }
  }

  /** Kích thước nguồn đã decode (ImageBitmap dùng width, <img> dùng naturalWidth). */
  function _sourceSize(source) {
    return {
      width: source.width || source.naturalWidth,
      height: source.height || source.naturalHeight,
    };
  }

  /**
   * Đọc kích thước thật của ảnh mà không vẽ lại canvas.
   * @param {File|Blob} file
   * @returns {Promise<{width:number,height:number}|null>} null nếu không decode được
   */
  async function getImageDimensions(file) {
    let decoded;
    try {
      decoded = await _decode(file);
    } catch (e) {
      return null;
    }
    try {
      return _sourceSize(decoded.source);
    } finally {
      decoded.cleanup();
    }
  }

  /**
   * Khung ảnh sau khi thu về vừa maxWidth × maxHeight (giữ tỉ lệ).
   * @private
   */
  function _fitInside(width, height, L) {
    if (width <= L.maxWidth && height <= L.maxHeight) return { width, height };
    const ratio = Math.min(L.maxWidth / width, L.maxHeight / height);
    return {
      width: Math.max(1, Math.round(width * ratio)),
      height: Math.max(1, Math.round(height * ratio)),
    };
  }

  /**
   * Vẽ nguồn ĐÃ decode vào canvas đã thu đúng khung.
   *
   * Nhận `source` chứ không nhận `file` để cả việc đo kích thước lẫn việc vẽ
   * dùng CHUNG một lần decode: ảnh 12MP bung ra ~48MB RGBA, decode hai lần cho
   * một tấm là đủ giết tab trên điện thoại khi khách chọn cả album 10 ảnh.
   * Tách khỏi phần encode để encode được NHIỀU định dạng từ một lần vẽ.
   * @private
   * @returns {{canvas:HTMLCanvasElement,ctx:CanvasRenderingContext2D,width:number,height:number}}
   */
  function _drawSource(source, L) {
    const { width: srcW, height: srcH } = _sourceSize(source);
    const { width, height } = _fitInside(srcW, srcH, L);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    // Thu 4000px → 1920px trong MỘT bước drawImage: để mặc định ("low") thì ảnh
    // ra đầy răng cưa, thấy rõ trên ảnh cưới nhiều chi tiết (ren, tóc, chữ).
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(source, 0, 0, width, height);

    return { canvas, ctx, width, height };
  }

  /**
   * Decode + vẽ trong một lần gọi, cho nơi chỉ cần vẽ đúng một lượt.
   * compressIfNeeded() KHÔNG dùng hàm này vì còn phải đo kích thước để quyết
   * định có vẽ hay không — nó tự giữ `_decode` để khỏi decode lần hai.
   * @private
   * @returns {Promise<{canvas:HTMLCanvasElement,ctx:CanvasRenderingContext2D,width:number,height:number}>}
   */
  async function _drawScaled(file, L) {
    const { source, cleanup } = await _decode(file);
    try {
      return _drawSource(source, L);
    } finally {
      cleanup();
    }
  }

  /**
   * Encode canvas ra đúng MỘT định dạng.
   *
   * toBlob với type trình duyệt KHÔNG hỗ trợ thì âm thầm trả về PNG thay vì
   * báo lỗi — không kiểm `blob.type` thì sẽ tưởng đã có bản WebP mà thật ra
   * đang đem một file PNG phình to đi so sánh.
   * @private
   * @returns {Promise<Blob|null>} null nếu trình duyệt không encode được type này
   */
  function _encode(canvas, type, quality) {
    return new Promise((resolve) => {
      canvas.toBlob(
        (blob) => resolve(blob && blob.type === type ? blob : null),
        type,
        quality,
      );
    });
  }

  /**
   * Encode và hạ quality dần cho tới khi đạt maxSizeMB. PNG bỏ qua tham số
   * quality nên chỉ encode đúng một lần — lặp thêm chỉ tốn vòng mã hoá vô ích.
   * @private
   */
  async function _encodeToTarget(canvas, type, L) {
    let quality = L.quality;
    let best = await _encode(canvas, type, quality);
    if (!best) return null;

    const lossy = type === "image/jpeg" || type === "image/webp";
    while (lossy && best.size > L.maxSizeMB * 1024 * 1024 && quality > 0.3) {
      quality -= 0.1;
      const next = await _encode(canvas, type, quality);
      if (!next) break;
      best = next;
    }
    return best;
  }

  /**
   * Ảnh có dùng nền trong suốt thật không. Chỉ cần hỏi khi định dùng JPEG —
   * JPEG không có alpha, ép sang sẽ ra nền đen.
   * @private
   */
  function _hasAlpha(ctx, width, height) {
    try {
      const { data } = ctx.getImageData(0, 0, width, height);
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] !== 255) return true;
      }
      return false;
    } catch (e) {
      return true; // không đọc được pixel → coi như có, đừng liều với JPEG
    }
  }

  /**
   * Blob → File, đổi đuôi theo mime ĐẦU RA (png → webp…).
   * @private
   */
  function _toFile(blob, originalName) {
    const ext = EXT_BY_TYPE[blob.type] || "jpg";
    const base = (originalName || "image").replace(/\.[^.]+$/, "") || "image";
    return new File([blob], `${base}.${ext}`, {
      type: blob.type,
      lastModified: Date.now(),
    });
  }

  /**
   * Vẽ lại ảnh qua canvas theo đúng ngưỡng, GIỮ NGUYÊN định dạng gốc. Luôn mã
   * hoá lại, kể cả khi ảnh đã đạt ngưỡng — dùng compressIfNeeded()/prepareImage()
   * nếu muốn tránh việc đó (và muốn đổi định dạng để nén tốt hơn).
   * @param {File|Blob} file
   * @param {object} [limits] - Ghi đè DEFAULT_LIMITS
   * @returns {Promise<File>}
   */
  async function resizeImage(file, limits) {
    const L = _limits(limits);
    validateImageFile(file, limits);

    const { canvas } = await _drawScaled(file, L);
    const type = _normalizeType(file.type);
    const blob = await _encodeToTarget(canvas, type, L);
    if (!blob) throw new Error("Failed to compress image");

    return _toFile(blob, file.name);
  }

  /** image/jpg không phải mime hợp lệ với canvas — chuẩn hoá về image/jpeg. */
  function _normalizeType(type) {
    return (type || "").toLowerCase() === "image/jpg" ? "image/jpeg" : type;
  }

  /**
   * Nén CHỈ KHI cần: ảnh đã đạt ngưỡng thì trả lại nguyên bản (không mã hoá lại
   * → không mất chất lượng vô ích), chưa đạt thì trả bản đã nén.
   *
   * ĐẦU RA CÓ THỂ ĐỔI ĐỊNH DẠNG (thường là sang WebP). Đây là điều bắt buộc,
   * không phải tối ưu thêm: canvas luôn decode ra RGBA 32-bit rồi encode lại,
   * nên PNG → PNG gần như luôn ra file TO HƠN bản gốc (mất palette indexed, mất
   * tối ưu của encoder gốc), mà PNG lại bỏ qua tham số quality nên không có
   * cách nào ép nhỏ lại. Cho phép đổi sang WebP là đường DUY NHẤT để một tấm
   * PNG nặng nhỏ đi. WebP được chọn thay JPEG vì nhỏ hơn ~25-30% ở cùng chất
   * lượng và vẫn giữ được nền trong suốt (kho ảnh có icon hoa, khung viền).
   *
   * @param {File|Blob} file
   * @param {object} [limits]
   * @returns {Promise<{file: File|Blob, compressed: boolean}>}
   */
  async function compressIfNeeded(file, limits) {
    const L = _limits(limits);
    if (!file || !canRecompress(file)) return { file, compressed: false };

    const tooHeavy = file.size > L.maxSizeMB * 1024 * 1024;

    // MỘT lần decode cho cả đo kích thước lẫn vẽ. Trước đây getImageDimensions()
    // decode một lần rồi _drawScaled() decode lại lần nữa — gấp đôi RAM và thời
    // gian cho mỗi tấm, mà ảnh cưới thì toàn 12MP trở lên.
    let decoded;
    try {
      decoded = await _decode(file);
    } catch (e) {
      return { file, compressed: false }; // không decode được → để yên
    }

    let drawn;
    try {
      const dim = _sourceSize(decoded.source);
      const tooLarge = dim.width > L.maxWidth || dim.height > L.maxHeight;
      if (!tooHeavy && !tooLarge) return { file, compressed: false };
      drawn = _drawSource(decoded.source, L);
    } catch (e) {
      return { file, compressed: false };
    } finally {
      // Nhả bitmap NGAY khi vẽ xong: phần encode bên dưới chỉ cần canvas, giữ
      // thêm bản decode gốc trong lúc mã hoá là thừa một bản ảnh trong RAM.
      decoded.cleanup();
    }
    const { canvas, ctx, width, height } = drawn;

    // WebP trước. Trình duyệt không encode được (Safari < 14) mới lùi về JPEG,
    // và chỉ khi ảnh không có alpha — ép ảnh trong suốt sang JPEG là ra nền đen.
    let best = await _encodeToTarget(canvas, "image/webp", L);
    if (!best && !_hasAlpha(ctx, width, height)) {
      best = await _encodeToTarget(canvas, "image/jpeg", L);
    }

    // Cùng đường không được thì thử giữ định dạng gốc, còn hơn không nén gì.
    if (!best) best = await _encodeToTarget(canvas, _normalizeType(file.type), L);
    if (!best) return { file, compressed: false };

    // CHỐT CỨNG: không bao giờ trả về file to hơn hoặc bằng bản gốc. Ảnh vốn đã
    // tối ưu sẵn (icon PNG ít màu, JPEG quality thấp) có thể phình ra sau khi
    // mã hoá lại — gặp vậy thì giữ nguyên bản, kể cả khi khung ảnh còn vượt
    // ngưỡng: thà để ảnh to hơn 1920px còn hơn giao ra một file vừa nặng hơn
    // vừa mất chất lượng.
    if (best.size >= file.size) return { file, compressed: false };

    return { file: _toFile(best, file.name), compressed: true };
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
    validateImageFile(file, limits);
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
    isAllowedType,
    canRecompress,
    getImageDimensions,
    resizeImage,
    compressIfNeeded,
    prepareImage,
  };
})();
