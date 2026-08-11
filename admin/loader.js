// Nạp từng "màn" (tab) của trang quản trị từ partials/ rồi mới chèn script theo
// tab — cùng cách với invitation-setup/loader.js. Script chỉ chạy SAU khi toàn bộ
// partial đã chèn xong nên không cần DOMContentLoaded.
(function () {
  // [id thẻ mount, đường dẫn partial]
  const PARTIALS = [
    ["mount-dashboard", "partials/dashboard-panel.html"],
    ["mount-weddings", "partials/weddings-panel.html"],
    ["mount-templates", "partials/templates-panel.html"],
    ["mount-sample-images", "partials/sample-images-panel.html"],
    ["mount-asset-images", "partials/asset-images-panel.html"],
    ["mount-background", "partials/background-panel.html"],
    ["mount-promo", "partials/promo-panel.html"],
  ];

  // Thứ tự có phụ thuộc: config (CONFIG global) → core dùng chung (ADMIN_TOKEN,
  // supabaseClient, switchTab) → helper xử lý ảnh + utils (focal point & crop
  // ảnh) → logic riêng từng tab.
  // core/config.js KHÔNG nằm ở đây: nó được nạp riêng ở bước mồi trong boot() để
  // lấy CONFIG.version, thêm vào đây nữa là nạp hai lần.
  const SCRIPTS = [
    "../core/x-button.js",
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
    // Ô "Nhạc nền" của tab "Dữ liệu mẫu" dùng LẠI logic YouTube của trang thiết
    // lập thiệp. Phải đứng SAU 04: nó gọi _onDomReady và _scheduleAutoSave — bản
    // dành riêng cho admin khai báo trong 04-sample-data.js.
    "../invitation-setup/js/11-youtube.js",
    // Phải đứng SAU 03: dùng lại siIdbGet/siIdbPut + hằng SI_IDB_STORE của nó
    // để cất handle thư mục gốc (khác key, xem AX_IDB_KEY).
    "js/05-asset-images.js",
    // Ô soạn mã HTML của tab "Ảnh nền": <x-textarea> + cụm nút Hoàn tác/Làm lại.
    // Phải đứng TRƯỚC 06 để thẻ <x-textarea> đã upgrade khi nó gán giá trị.
    "../core/x-controls.js",
    "../core/x-undo.js",
    // Phải đứng SAU 03: dùng lại siIdbGet/siIdbPut + SI_IDB_STORE, và dùng CHUNG
    // handle thư mục assets/ với tab "Ảnh mẫu" (cùng key "assets-root").
    "js/06-background.js",
    "js/07-promo.js",
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

  // Đóng dấu phiên bản (CONFIG.version, xem core/config.js) để đổi số ở đó là
  // ép lấy bản mới của cả bộ partial + script. Chỉ gọi được SAU bước mồi.
  // CONFIG khai bằng `const` ở core/config.js → là binding lexical toàn cục, KHÔNG
  // phải window.CONFIG. Phải đọc bằng tên trần, và bọc typeof phòng khi bước mồi
  // hỏng (thiếu nó thì trả URL trần, trang vẫn chạy chứ không chết cả loader).
  function withVersion(url) {
    const v = typeof CONFIG !== "undefined" ? CONFIG.version : "";
    if (!v) return url;
    return url + (url.includes("?") ? "&" : "?") + "v=" + encodeURIComponent(v);
  }

  async function boot() {
    // Bước mồi: config.js nạp TRẦN (không ?v=) và phải xong trước mọi thứ khác —
    // nó là nơi giữ số phiên bản dùng để đóng dấu phần còn lại.
    await loadScripts(["../core/config.js"]);

    const htmls = await Promise.all(
      PARTIALS.map(([, url]) => fetchText(withVersion(url))),
    );
    PARTIALS.forEach(([mountId], i) => injectPartial(mountId, htmls[i]));

    await loadScripts(SCRIPTS.map(withVersion));

    // Khôi phục tab từ URL hash CHỈ SAU KHI mọi script theo tab đã nạp xong —
    // xem restoreTabFromHash() trong 00-core.js.
    restoreTabFromHash();
  }

  boot().catch((err) => {
    console.error("[loader] nạp trang thất bại:", err);
    document.body.insertAdjacentHTML(
      "afterbegin",
      '<div style="padding:16px;font:14px/1.5 Inter,sans-serif;color:rgb(var(--notice-text-rgb));background:rgb(var(--notice-bg-rgb));border-bottom:1px solid rgb(var(--notice-border-rgb))">' +
        "Không tải được giao diện. Vui lòng tải lại trang." +
        "</div>",
    );
  });
})();
