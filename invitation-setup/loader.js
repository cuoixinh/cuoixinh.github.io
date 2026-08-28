// Nạp các "màn" của trang thiết lập thiệp từ partials/ rồi mới chèn script app.
// index.html chỉ còn phần vỏ (skeleton + các thẻ mount rỗng), toàn bộ panel nằm ở
// partials/*.html và fetch bất đồng bộ — DOMContentLoaded bắn TRƯỚC khi partial
// kịp chèn, nên script app phải được chèn SAU khi inject xong.
// Thư viện CDN bên thứ ba vẫn nằm ở thẻ <script> tĩnh trong index.html.
(function () {
  // [id thẻ mount, đường dẫn partial]. Thứ tự không quan trọng vì mỗi partial thay
  // đúng thẻ mount của nó. Skeleton tách riêng: nó là màn chờ, phải chèn NGAY khi
  // về chứ không đợi các partial khác.
  const SKELETON = ["mount-skeleton", "partials/skeleton.html"];

  const PARTIALS = [
    ["mount-header", "partials/header.html"],
    ["mount-form-panel", "partials/form-panel.html"],
    ["mount-config-panel", "partials/config-panel.html"],
    ["mount-theme-panel", "partials/theme-panel.html"],
    ["mount-guests-panel", "partials/guests-panel.html"],
    ["mount-nav-bottom", "partials/nav-bottom.html"],
    ["mount-import-modal", "partials/import-modal.html"],
  ];

  // Từng bước của form nội dung, mỗi bước một file trong partials/steps/.
  // Thẻ mount nằm TRONG form-panel nên nhóm này phải chèn SAU PARTIALS (request
  // vẫn bắn song song, chỉ hoãn lúc chèn). Thứ tự mảng = thứ tự bước hiển thị,
  // phải khớp CX_STEPS trong js/20-steps.js.
  const STEP_PARTIALS = [
    ["mount-step-couple", "partials/steps/01-couple.html"],
    ["mount-step-ceremony", "partials/steps/02-ceremony.html"],
    ["mount-step-family", "partials/steps/03-family.html"],
    ["mount-step-party", "partials/steps/04-party.html"],
    ["mount-step-photos", "partials/steps/05-photos.html"],
    ["mount-step-timeline", "partials/steps/06-timeline.html"],
    ["mount-step-love_story", "partials/steps/07-love_story.html"],
    ["mount-step-rsvp", "partials/steps/08-rsvp.html"],
    ["mount-step-gift", "partials/steps/09-gift.html"],
    ["mount-step-footer", "partials/steps/10-footer.html"],
  ];

  // Giữ NGUYÊN thứ tự cũ trong index.html — có phụ thuộc: config → DAL → BL →
  // supabase → helpers → x-* → index.js.
  // core/config.js KHÔNG nằm ở đây: nó được nạp riêng ở bước mồi trong boot() để
  // lấy CONFIG.version, thêm vào đây nữa là nạp hai lần.
  const SCRIPTS = [
    "../core/x-button.js",
    "../core/x-popover.js",
    "../core/cache-util.js",
    "../core/helpers/draft-retention.js",
    "../core/constant.js",
    "../core/auth-ui.js",
    "../core/auth.js",
    "../core/utils.js",
    "../core/dal/templates-dal.js",
    "../core/dal/wedding-dal.js",
    "../core/dal/storage-dal.js",
    "../core/dal/guest-dal.js",
    "../core/dal/ai-dal.js",
    "../core/bl/wedding-bl.js",
    "../core/bl/image-bl.js",
    "../core/bl/guest-bl.js",
    "../core/supabase.js",
    "../core/payment.js",
    // Icon riêng (<i data-icon="…">): nút "Trợ lý AI" ở navbar và tiêu đề bảng chat.
    "../core/helpers/icon.js",
    "../core/helpers/maps-helper.js",
    "../core/helpers/alert.js",
    "../core/helpers/image-helper.js",
    "../core/helpers/validate.js",
    "../core/helpers/guide-helper.js",
    "../core/helpers/tooltip.js",
    "../core/components/music-player.js",
    "../core/components/progress.js",
    "../core/helpers/element-color-enum.js",
    "../core/helpers/element-helper.js",
    "../core/helpers/text-preset-helper.js",
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
    // Sau 03 (dùng SECTION_VIS_FIELDS) và sau 04 (dùng switchTab).
    "js/20-steps.js",
    "js/21-shell.js",
    // Sau 04 (dùng _savePreviewData/_previewIframeSrc và cờ _isPreviewActive).
    "js/22-live-preview.js",
    "js/23-pull-refresh.js",
    // Sau các file dựng form: cần _loveStoryItems/_timelineItems/BANK_LIST.
    "js/24-ai-apply.js",
    // Đọc CX_THEME của mẫu đang chọn (bước nào mẫu không có). Sau 20-steps:
    // chỉ phát sự kiện, không ai gọi lúc nạp.
    "js/25-theme-decl.js",
    // Khung chat AI dùng chung với trang chủ; thấy window.cxApplyAiCard thì đổ
    // thẳng vào thiệp đang mở thay vì dựng nháp mới.
    "../core/dal/ai-chat-dal.js",
    "../js/ai-assistant.js",
    "tour-setup.js",
  ];

  // Hàng đợi "chạy khi app đã sẵn sàng". Script nạp động nên nếu chỉ dựa vào
  // readyState thì mỗi file chạy ngay tại vị trí của nó — file nạp sớm không thấy
  // thứ do file nạp sau tạo ra (maps-helper.js chạy trước khi <x-input> upgrade →
  // autocomplete gắn hụt). Hàng đợi chỉ chạy sau khi TOÀN BỘ script đã nạp.
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
    // Skeleton bắn song song và cũng không đóng dấu: nó chỉ là màn chờ, chèn được
    // sớm chừng nào đỡ trắng màn chừng đó, bản cũ vài phút không hại gì.
    const skeletonReq = fetchText(SKELETON[1]);
    const configReq = loadScripts(["../core/config.js"]);

    injectPartial(SKELETON[0], await skeletonReq);
    await configReq;

    const restReq = Promise.all(PARTIALS.map(([, url]) => fetchText(withVersion(url))));
    const stepReq = Promise.all(
      STEP_PARTIALS.map(([, url]) => fetchText(withVersion(url))),
    );

    const htmls = await restReq;
    PARTIALS.forEach(([mountId], i) => injectPartial(mountId, htmls[i]));

    // Sau form-panel: thẻ mount của các bước do chính nó mang vào.
    const stepHtmls = await stepReq;
    STEP_PARTIALS.forEach(([mountId], i) => injectPartial(mountId, stepHtmls[i]));

    // Icon nằm trong partial vừa chèn nên phải dựng lại, nếu không sẽ trống trơn.
    if (window.lucide) window.lucide.createIcons();

    await loadScripts(SCRIPTS.map(withVersion));

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
      '<div style="padding:16px;font:14px/1.5 Inter,sans-serif;color:rgb(var(--notice-text-rgb));background:rgb(var(--notice-bg-rgb));border-bottom:1px solid rgb(var(--notice-border-rgb))">' +
        "Không tải được giao diện. Vui lòng tải lại trang." +
        "</div>",
    );
  });
})();
