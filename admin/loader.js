// Nạp từng "màn" (tab) của trang quản trị từ partials/ rồi mới chèn script
// theo tab. Lý do giống invitation-setup/loader.js: index.html chỉ còn vỏ +
// các thẻ mount rỗng, nội dung tab nằm ở partials/*.html và fetch bất đồng bộ.
// Script theo tab chỉ chạy SAU khi toàn bộ partial đã chèn xong nên không cần
// DOMContentLoaded — lúc mỗi file trong SCRIPTS thực thi, DOM của nó đã có sẵn.
(function () {
  // [id thẻ mount, đường dẫn partial]
  const PARTIALS = [
    ["mount-dashboard", "partials/dashboard-panel.html"],
    ["mount-weddings", "partials/weddings-panel.html"],
    ["mount-templates", "partials/templates-panel.html"],
    ["mount-sample-images", "partials/sample-images-panel.html"],
    ["mount-asset-images", "partials/asset-images-panel.html"],
  ];

  // Thứ tự có phụ thuộc: config (CONFIG global) → core dùng chung (ADMIN_TOKEN,
  // supabaseClient, switchTab) → helper xử lý ảnh + utils (focal point & crop
  // ảnh) → logic riêng từng tab.
  const SCRIPTS = [
    "../core/config.js",
    "../core/auth.js", // nguồn duy nhất cho phiên đăng nhập (ai-dal đính JWT)
    "js/00-core.js",
    "../core/helpers/alert.js",
    // Nén/đo ảnh (thuần canvas) cho tab "Dữ liệu mẫu" và "Ảnh mẫu". Ảnh admin
    // ghi thẳng xuống ổ đĩa nên KHÔNG cần image-bl.js (tầng storage Supabase).
    "../core/helpers/image-helper.js",
    "../core/utils.js",
    // Picker chọn địa điểm cho 4 ô Google Maps ở tab "Dữ liệu mẫu" — đúng
    // picker của trang thiết lập thiệp. Phải đứng SAU utils.js (dùng
    // openBottomSheet/escapeHtml) và cần Leaflet đã có ở index.html.
    "../core/helpers/maps-helper.js",
    // Dùng cho tab "Dữ liệu mẫu": aiDAL (nhờ AI sinh nội dung) và
    // formatLunarDate (tự tính ngày âm từ ngày dương) — cả hai đều thuần
    // logic, không bind DOM của trang nào.
    "../core/dal/ai-dal.js",
    "../invitation-setup/js/09-lunar.js",
    "js/01-weddings.js",
    "js/02-templates.js",
    "js/03-sample-images.js",
    "js/04-sample-data.js",
    // Ô "Nhạc nền" của tab "Dữ liệu mẫu" dùng LẠI nguyên logic YouTube của
    // trang thiết lập thiệp (tìm bài, dán link, gợi ý, nghe thử). Phải đứng SAU
    // 04: nó gọi _onDomReady lúc nạp và _scheduleAutoSave lúc đổi bài — cả hai
    // đều là bản dành riêng cho admin khai báo trong 04-sample-data.js.
    "../invitation-setup/js/11-youtube.js",
    // Phải đứng SAU 03: dùng lại siIdbGet/siIdbPut + hằng SI_IDB_STORE của nó
    // để cất handle thư mục gốc (khác key, xem AX_IDB_KEY).
    "js/05-asset-images.js",
  ];

  function injectPartial(mountId, html) {
    const host = document.getElementById(mountId);
    if (!host) throw new Error("thiếu thẻ mount #" + mountId);
    host.insertAdjacentHTML("beforebegin", html);
    host.remove();
  }

  function loadScripts(srcs) {
    // async = false: tải song song nhưng THỰC THI đúng thứ tự mảng.
    return new Promise((resolve, reject) => {
      let remaining = srcs.length;
      if (!remaining) return resolve();
      srcs.forEach((src) => {
        const s = document.createElement("script");
        s.src = src;
        s.async = false;
        s.onload = () => --remaining === 0 && resolve();
        s.onerror = () => reject(new Error("không tải được " + src));
        document.body.appendChild(s);
      });
    });
  }

  function fetchText(url) {
    return fetch(url).then((r) => {
      if (!r.ok) throw new Error(url + " → HTTP " + r.status);
      return r.text();
    });
  }

  async function boot() {
    const htmls = await Promise.all(PARTIALS.map(([, url]) => fetchText(url)));
    PARTIALS.forEach(([mountId], i) => injectPartial(mountId, htmls[i]));

    await loadScripts(SCRIPTS);

    // Khôi phục tab từ URL hash CHỈ SAU KHI mọi script theo tab đã nạp xong —
    // xem restoreTabFromHash() trong 00-core.js.
    restoreTabFromHash();
  }

  boot().catch((err) => {
    console.error("[loader] nạp trang thất bại:", err);
    document.body.insertAdjacentHTML(
      "afterbegin",
      '<div style="padding:16px;font:14px/1.5 Inter,sans-serif;color:#9f1239;background:#fff1f2;border-bottom:1px solid #fecdd3">' +
        "Không tải được giao diện. Vui lòng tải lại trang." +
        "</div>",
    );
  });
})();
