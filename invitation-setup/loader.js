// Nạp các "màn" của trang thiết lập thiệp từ partials/ rồi mới chèn script app.
//
// Vì sao phải làm vậy: index.html chỉ còn phần vỏ (skeleton + các thẻ mount rỗng),
// toàn bộ panel nằm ở partials/*.html và được fetch bất đồng bộ. DOMContentLoaded
// bắn TRƯỚC khi partial kịp chèn vào DOM, nên nếu để script app ở thẻ <script> tĩnh
// thì chúng sẽ chạy lúc DOM còn rỗng. Chèn script sau khi inject xong thì lúc chạy
// readyState đã là interactive/complete → mọi đoạn init theo idiom
// `if (readyState === "loading") … else run()` tự chạy ngay và thấy đủ DOM.
//
// Các thư viện CDN bên thứ ba vẫn nằm ở thẻ <script> tĩnh trong index.html: chúng
// không phụ thuộc DOM của app và luôn tải xong trước file này.
(function () {
  // [id thẻ mount, đường dẫn partial]. Thứ tự chèn không quan trọng vì mỗi partial
  // thay thế đúng thẻ mount của nó, vị trí trong DOM đã cố định sẵn ở index.html.
  // Skeleton tách riêng khỏi PARTIALS: nó là màn chờ, phải chèn NGAY khi về chứ
  // không đợi các partial khác — gộp chung Promise.all thì nó xuất hiện cùng lúc
  // với nội dung thật và mất sạch tác dụng.
  const SKELETON = ["mount-skeleton", "partials/skeleton.html"];

  const PARTIALS = [
    ["mount-header", "partials/header.html"],
    ["mount-form-panel", "partials/form-panel.html"],
    ["mount-config-panel", "partials/config-panel.html"],
    ["mount-theme-panel", "partials/theme-panel.html"],
    ["mount-guests-panel", "partials/guests-panel.html"],
    ["mount-nav-bottom", "partials/nav-bottom.html"],
    ["mount-import-modal", "partials/import-modal.html"],
    ["mount-ai-card", "partials/ai-card.html"],
  ];

  // Giữ NGUYÊN thứ tự cũ trong index.html — có phụ thuộc: config → DAL → BL →
  // supabase → helpers → x-* → index.js.
  const SCRIPTS = [
    "../core/config.js",
    "../core/constant.js",
    "../core/auth-ui.js",
    "../core/utils.js",
    "../core/dal/wedding-dal.js",
    "../core/dal/storage-dal.js",
    "../core/dal/guest-dal.js",
    "../core/dal/ai-dal.js",
    "../core/bl/wedding-bl.js",
    "../core/bl/image-bl.js",
    "../core/bl/guest-bl.js",
    "../core/supabase.js",
    "../core/payment.js",
    "../core/helpers/maps-helper.js",
    "../core/helpers/alert.js",
    "../core/helpers/validate.js",
    "../core/helpers/guide-helper.js",
    "../core/helpers/tooltip.js",
    "../core/helpers/theme-setting-helper.js",
    "../core/x-input.js",
    "../core/x-controls.js",
    "../core/x-speech.js",
    "../core/x-undo.js",
    "../core/x-combobox.js",
    // index.js cũ, tách theo tính năng. 01-state.js phải đứng đầu: nó khai báo
    // state toàn cục và _onDomReady() mà các file sau dùng tới.
    "js/01-state.js",
    "js/02-idb.js",
    "js/03-form-sections.js",
    "js/04-nav-tabs.js",
    "js/05-theme-panel.js",
    "js/06-draft-save.js",
    "js/07-excel-import.js",
    "js/08-bank-quote.js",
    "js/09-lunar.js",
    "js/10-images.js",
    "js/11-youtube.js",
    "js/12-uploads.js",
    "js/13-data.js",
    "js/14-timeline-story.js",
    "js/15-init.js",
    "js/16-ceremony.js",
    "js/17-pickers.js",
    "js/18-theme-picker.js",
    "js/19-ai-optimize.js",
    "ai-modal.js",
    "tour-setup.js",
  ];

  // Hàng đợi "chạy khi app đã sẵn sàng".
  //
  // Trước đây các file dùng DOMContentLoaded, tức chạy sau khi DOM parse xong VÀ
  // mọi thẻ <script> tĩnh đã thực thi. Nay script nạp động nên nếu chỉ dựa vào
  // readyState thì mỗi file chạy ngay tại vị trí của nó trong danh sách — file nạp
  // sớm sẽ không thấy thứ do file nạp sau tạo ra. Cụ thể: maps-helper.js đứng
  // trước x-input.js, chạy ngay thì <x-input name="groom_address"> chưa upgrade
  // nên chưa có <input id="groom_address"> bên trong → autocomplete gắn hụt.
  // Hàng đợi này giữ đúng ngữ nghĩa cũ: chỉ chạy sau khi TOÀN BỘ script đã nạp.
  const readyQueue = [];
  let ready = false;
  window.__cxOnReady = function (fn) {
    if (ready) fn();
    else readyQueue.push(fn);
  };

  function injectPartial(mountId, html) {
    const host = document.getElementById(mountId);
    if (!host) throw new Error("thiếu thẻ mount #" + mountId);
    // Chèn cạnh thẻ mount rồi xoá thẻ mount: DOM thu được giống hệt lúc partial
    // còn nằm inline, không dư thẻ bọc nào làm hỏng layout flex/absolute.
    host.insertAdjacentHTML("beforebegin", html);
    host.remove();
  }

  function loadScripts(srcs) {
    // async = false để trình duyệt tải song song nhưng THỰC THI đúng thứ tự mảng.
    // Bỏ dòng này thì script tạo bằng createElement mặc định là async → sai thứ tự.
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
    // Bắn cả hai nhóm request cùng lúc, nhưng chèn skeleton ngay khi nó về —
    // skeleton nhỏ nên thường tới trước, lấp chỗ trống trong lúc chờ phần còn lại.
    const skeletonReq = fetchText(SKELETON[1]);
    const restReq = Promise.all(PARTIALS.map(([, url]) => fetchText(url)));

    injectPartial(SKELETON[0], await skeletonReq);

    const htmls = await restReq;
    PARTIALS.forEach(([mountId], i) => injectPartial(mountId, htmls[i]));

    // Icon nằm trong partial vừa chèn nên phải dựng lại, nếu không sẽ trống trơn.
    if (window.lucide) window.lucide.createIcons();

    await loadScripts(SCRIPTS);

    ready = true;
    readyQueue.splice(0).forEach((fn) => {
      try {
        fn();
      } catch (e) {
        console.error("[loader] lỗi khi khởi tạo:", e);
      }
    });
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
