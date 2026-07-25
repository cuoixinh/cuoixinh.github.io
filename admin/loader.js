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
  ];

  // Thứ tự có phụ thuộc: config (CONFIG global) → core dùng chung (ADMIN_TOKEN,
  // supabaseClient, switchTab) → logic riêng từng tab.
  const SCRIPTS = [
    "../core/config.js",
    "js/00-core.js",
    "js/01-weddings.js",
    "js/02-templates.js",
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
