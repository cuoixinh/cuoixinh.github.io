// Xử lý ảnh phía client bằng canvas: đo kích thước, resize, nén. Không đụng
// storage/DB. Ảnh chỉ nén ĐÚNG MỘT LẦN, lúc vào state, qua prepareImage().
// Ngưỡng truyền theo từng lời gọi (`limits`), helper không giữ state.
// Ảnh phải nén sẽ ra WebP (đổi cả đuôi file) → lấy đuôi từ KẾT QUẢ.

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

  // Có nằm trong whitelist NHẬN VÀO không (khác canRecompress: "nén được không").
  function isAllowedType(file, limits) {
    const type = (file?.type || "").toLowerCase();
    const allowed = _limits(limits).allowedTypes;
    // Không khai whitelist → về hành vi cũ, nhận mọi image/*
    if (!allowed || !allowed.length) return type.startsWith("image/");
    return allowed.includes(type);
  }

  /** Chặn file không phải ảnh / sai định dạng / quá nặng trước khi decode. */
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

  /** Định dạng có mã hoá lại qua canvas được không. */
  function canRecompress(file) {
    return RECOMPRESSABLE.includes((file?.type || "").toLowerCase());
  }

  // Decode ảnh ra nguồn vẽ được; gọi xong PHẢI cleanup(). `imageOrientation:
  // "from-image"` là bắt buộc, thiếu thì ảnh dọc (EXIF orientation 6) nằm ngang.
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

  /** Kích thước thật của ảnh, không vẽ lại canvas. null nếu không decode được. */
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

  /** Khung ảnh sau khi thu vừa maxWidth × maxHeight (giữ tỉ lệ). */
  function _fitInside(width, height, L) {
    if (width <= L.maxWidth && height <= L.maxHeight) return { width, height };
    const ratio = Math.min(L.maxWidth / width, L.maxHeight / height);
    return {
      width: Math.max(1, Math.round(width * ratio)),
      height: Math.max(1, Math.round(height * ratio)),
    };
  }

  // Vẽ nguồn ĐÃ decode vào canvas đã thu đúng khung. Nhận `source` chứ không
  // nhận `file` để đo và vẽ dùng chung một lần decode.
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

  /** Decode + vẽ trong một lần gọi, cho nơi chỉ cần vẽ đúng một lượt. */
  async function _drawScaled(file, L) {
    const { source, cleanup } = await _decode(file);
    try {
      return _drawSource(source, L);
    } finally {
      cleanup();
    }
  }

  // Encode canvas ra đúng một định dạng. toBlob với type không hỗ trợ sẽ âm thầm
  // trả về PNG → phải kiểm `blob.type`.
  function _encode(canvas, type, quality) {
    return new Promise((resolve) => {
      canvas.toBlob(
        (blob) => resolve(blob && blob.type === type ? blob : null),
        type,
        quality,
      );
    });
  }

  // Hạ quality dần tới khi đạt maxSizeMB. PNG bỏ qua quality nên chỉ encode một lần.
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

  // Ảnh có dùng nền trong suốt thật không — chỉ cần hỏi khi định dùng JPEG.
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

  /** Blob → File, đổi đuôi theo mime ĐẦU RA (png → webp…). */
  function _toFile(blob, originalName) {
    const ext = EXT_BY_TYPE[blob.type] || "jpg";
    const base = (originalName || "image").replace(/\.[^.]+$/, "") || "image";
    return new File([blob], `${base}.${ext}`, {
      type: blob.type,
      lastModified: Date.now(),
    });
  }

  // Vẽ lại ảnh theo đúng ngưỡng, GIỮ định dạng gốc và luôn mã hoá lại. Muốn bỏ
  // qua ảnh đã đạt ngưỡng thì dùng compressIfNeeded()/prepareImage().
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

  // Nén CHỈ KHI cần; đạt ngưỡng rồi thì trả nguyên bản. Đầu ra có thể đổi định
  // dạng sang WebP — canvas encode lại PNG gần như luôn ra file to hơn bản gốc.
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

    // Không bao giờ trả về file to hơn bản gốc: ảnh vốn đã tối ưu có thể phình ra
    // sau khi mã hoá lại — gặp vậy thì giữ nguyên bản.
    if (best.size >= file.size) return { file, compressed: false };

    return { file: _toFile(best, file.name), compressed: true };
  }

  // ĐIỂM VÀO DUY NHẤT để chuẩn hoá ảnh — mọi luồng upload/lưu ảnh gọi hàm này,
  // đúng một lần, ngay lúc ảnh vào state.
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
