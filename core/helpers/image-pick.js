// Chọn ảnh cho thiệp — MỘT đường dùng chung cho form ở trang Thiết lập (10-images.js) và ô
// chọn ảnh trong khung chat XuXi (js/ai-chat-media.js): kiểm định dạng → bảng lấy nét
// (ảnh bìa/chú rể/cô dâu, từng ảnh album) hoặc cắt 1:1 (QR) → nén + cảnh báo ảnh nặng.
// Chỉ trả File + điểm lấy nét; lưu vào đâu là việc của nơi gọi. Cần ImageHelper; bảng
// chỉnh ở core/utils.js + Cropper.js — trang chưa nạp (trang chủ) thì tự nạp lúc dùng.

(function () {
  const FOCAL_FIELDS = ["cover_image_url", "groom_image_url", "bride_image_url"];
  const CROP_FIELDS = ["groom_qr_url", "bride_qr_url"];
  // Ảnh không nén được mà vẫn nặng hơn mức này thì báo: khách mời dùng 3G thấy rõ.
  const HEAVY_UNCOMPRESSED_BYTES = 3 * 1024 * 1024;
  const CROPPER_JS = "https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.6.1/cropper.min.js";
  const CROPPER_SRI = "sha384-jzwsV9ieM/KUDMeo+d8dc+jm0GEl7ywPNwg10alB5BodVuC/Kx9RpEnyrl2Om9zH";
  const CROPPER_CSS = "https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.6.1/cropper.min.css";

  const toast = (msg, type, icon) => window.showToast?.(msg, type, icon);
  const loading = (on, msg) => window.showLoading?.(on, msg);

  // Whitelist CONFIG.image.allowedTypes (không kiểm `image/*`: SVG và HEIC lọt qua).
  function checkType(file) {
    if (ImageHelper.isAllowedType(file)) return true;
    toast(
      "Định dạng không hỗ trợ — hãy dùng JPG, PNG hoặc WebP (ảnh iPhone .HEIC cần đổi sang JPG).",
      "error",
    );
    return false;
  }

  // Nén MỘT LẦN lúc chọn; lúc lưu (12-uploads.js) không nén lại. compressIfNeeded có
  // nhiều đường trả NGUYÊN BẢN im lặng → bắt cờ `compressed` để còn cảnh báo.
  async function prepare(file) {
    const { file: processed, compressed } = await ImageHelper.prepareImage(file);
    if (!compressed && processed.size > HEAVY_UNCOMPRESSED_BYTES) {
      const mb = (processed.size / 1024 / 1024).toFixed(1);
      toast(
        `Ảnh ${mb}MB không nén được — khách mời sẽ tải rất chậm. Nên đổi sang JPG rồi tải lại.`,
        "warning",
      );
    }
    return processed;
  }

  function loadScript(src, integrity) {
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src;
      if (integrity) {
        s.integrity = integrity;
        s.crossOrigin = "anonymous";
      }
      s.onload = resolve;
      s.onerror = () => reject(new Error("không tải được " + src));
      document.head.appendChild(s);
    });
  }

  let _utilsReq = null;
  let _cropperReq = null;

  // Bảng lấy nét / cắt ảnh sống ở core/utils.js; trang chủ không nạp sẵn file đó.
  function ensurePickers(needCrop) {
    const jobs = [];
    if (typeof openFocalPointPicker !== "function") {
      const v = typeof CONFIG !== "undefined" && CONFIG.version ? "?v=" + CONFIG.version : "";
      _utilsReq = _utilsReq || loadScript("/core/utils.js" + v);
      jobs.push(_utilsReq);
    }
    if (needCrop && !window.Cropper) {
      if (!_cropperReq) {
        const css = document.createElement("link");
        css.rel = "stylesheet";
        css.href = CROPPER_CSS;
        document.head.appendChild(css);
        _cropperReq = loadScript(CROPPER_JS, CROPPER_SRI);
      }
      jobs.push(_cropperReq);
    }
    return Promise.all(jobs);
  }

  // Resolve null khi sheet `id` rời DOM mà chưa xác nhận (nút X, vuốt, bấm nền). Cả hai
  // bảng gọi callback TRƯỚC khi thẻ bị gỡ, nên lượt xác nhận luôn thắng.
  function onSheetGone(id, finish) {
    const obs = new MutationObserver(() => {
      if (document.getElementById(id)) return;
      obs.disconnect();
      finish(null);
    });
    obs.observe(document.body, { childList: true });
  }

  // Bảng lấy nét dạng Promise: {x,y} khi xác nhận, null khi huỷ.
  function focal(source, current, giftInfo) {
    return new Promise((resolve) => {
      let done = false;
      const finish = (v) => {
        if (done) return;
        done = true;
        resolve(v);
      };
      openFocalPointPicker(source, current || { x: 50, y: 50 }, finish, giftInfo);
      if (document.getElementById("focal-modal")) onSheetGone("focal-modal", finish);
      else finish(null);
    });
  }

  // Bảng cắt 1:1 (QR) dạng Promise: Blob PNG 800×800 khi xác nhận, null khi huỷ.
  function crop(source, giftInfo) {
    return new Promise((resolve) => {
      let done = false;
      const finish = (v) => {
        if (done) return;
        done = true;
        resolve(v);
      };
      openImageCropModal(source, finish, giftInfo);
      if (document.getElementById("crop-modal")) onSheetGone("crop-modal", finish);
      else finish(null);
    });
  }

  // Blob đã cắt → File PNG đã qua nén như mọi ảnh khác. Ảnh cắt 800×800 hầu như luôn
  // đạt ngưỡng nên trả nguyên bản.
  async function fromCrop(blob, origName) {
    const base = (origName || "qr").replace(/\.[^.]+$/, "");
    const cropped = new File([blob], `${base}.png`, { type: "image/png" });
    try {
      return await prepare(cropped);
    } catch (e) {
      console.warn("Không nén được ảnh cắt, giữ nguyên bản gốc:", e);
      return cropped;
    }
  }

  // Một ảnh cho field `field`. Trả { file, focal, cropped } hoặc null khi khách huỷ /
  // ảnh hỏng. `opts.focal` là điểm lấy nét đang có, `opts.giftInfo` để xem trước QR.
  async function single(field, file, opts = {}) {
    if (!checkType(file)) return null;
    const isCrop = CROP_FIELDS.includes(field);
    const isFocal = FOCAL_FIELDS.includes(field);
    if (isCrop || isFocal) {
      try {
        await ensurePickers(isCrop);
      } catch {
        toast("Không mở được bảng chỉnh ảnh, bạn thử lại nhé.", "error");
        return null;
      }
    }

    if (isCrop) {
      // Cắt đã "nướng" khung hình vào ảnh → điểm lấy nét về giữa.
      const blob = await crop(file, opts.giftInfo || null);
      if (!blob) return null;
      const out = { file: await fromCrop(blob, file.name), focal: { x: 50, y: 50 }, cropped: true };
      toast("Đã cắt ảnh (chưa lưu)", "success");
      return out;
    }

    let point = null;
    if (isFocal) {
      point = await focal(file, opts.focal, opts.giftInfo || null);
      if (!point) return null;
    }
    loading(true, "Đang xử lý ảnh...");
    try {
      const out = { file: await prepare(file), focal: point, cropped: false };
      toast("Đã chọn ảnh (chưa lưu)", "success");
      return out;
    } catch (error) {
      console.error("Error processing image:", error);
      toast("Lỗi xử lý ảnh: " + error.message, "error");
      return null;
    } finally {
      loading(false);
    }
  }

  // Nhiều ảnh cho album, tối đa `room` tấm (nơi gọi trừ CẢ ảnh đã lưu lẫn ảnh đang chờ —
  // chỉ đếm một nguồn là lọt quá trần, lưu xong server mới trả 400). Mỗi ảnh qua bảng
  // lấy nét rồi nén, xong gọi `onAdd(file, focal)` NGAY (nơi gọi lưu theo thứ tự chọn).
  // Trả số ảnh đã thêm. `max` chỉ để in câu báo khi album đã đầy.
  async function gallery(files, room, onAdd, max) {
    if (room <= 0) {
      toast(`Đã đạt giới hạn ${max || 10} ảnh`, "error");
      return 0;
    }
    const list = files.slice(0, room);
    if (files.length > room) toast(`Chỉ chọn được ${room} ảnh nữa`, "warning");
    try {
      await ensurePickers(false);
    } catch {
      toast("Không mở được bảng chỉnh ảnh, bạn thử lại nhé.", "error");
      return 0;
    }

    const errors = [];
    let added = 0;
    for (const file of list) {
      if (!ImageHelper.isAllowedType(file)) {
        errors.push(`${file.name}: định dạng không hỗ trợ`);
        continue;
      }
      const point = await focal(file, { x: 50, y: 50 });
      if (!point) continue; // khách bỏ riêng ảnh này
      loading(true, "Đang xử lý ảnh...");
      try {
        await onAdd(await prepare(file), point);
        added++;
        const progress = document.getElementById("upload-progress");
        if (progress) progress.textContent = `${Math.round((added / list.length) * 100)}%`;
      } catch (error) {
        console.error(`Error processing ${file.name}:`, error);
        errors.push(`${file.name}: ${error.message}`);
      } finally {
        loading(false);
      }
    }
    if (added > 0) toast(`Đã chọn ${added} ảnh (chưa lưu)`, "success");
    if (errors.length > 0) toast(`${errors.length} ảnh lỗi`, "warning");
    return added;
  }

  window.CXImagePick = { single, gallery, focal, crop, fromCrop, checkType, prepare };
})();
