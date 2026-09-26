// Đọc bản khai window.CX_THEME của một mẫu (public/themes/<theme>/index.js) mà không
// dựng cả thiệp: nạp riêng index.js trong iframe rỗng rồi lấy object ra. Dùng ở trang
// Thiết lập (js/25-theme-decl.js) và khung chat XuXi (js/ai-chat-media.js).
// Lỗi / quá hạn → {}. Mỗi mẫu đọc một lần mỗi phiên trang.

(function () {
  const TIMEOUT = 6000;
  const cache = new Map();

  function read(theme) {
    return new Promise((resolve) => {
      const src = `/public/themes/${encodeURIComponent(theme)}/index.js?v=${
        typeof CX_VERSION !== "undefined" ? CX_VERSION : ""
      }`;
      const frame = document.createElement("iframe");
      frame.setAttribute("aria-hidden", "true");
      frame.style.cssText = "position:fixed;width:0;height:0;border:0;opacity:0";
      // Bản giả cho các hàm dùng chung mà mẫu gọi ngay khi chạy — thiếu chúng thì script
      // dừng giữa chừng, nhưng CX_THEME gán ở dòng đầu IIFE nên đã kịp có.
      frame.srcdoc =
        "<script>window.isGroomSide=function(){return true};" +
        "window.addEventListener('error',function(e){e.preventDefault()});<\/script>" +
        `<script src="${src}"><\/script>`;

      let done = false;
      const finish = (decl) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        frame.remove();
        resolve(decl || {});
      };
      const timer = setTimeout(() => finish({}), TIMEOUT);

      frame.addEventListener("load", () => {
        let decl = {};
        try {
          decl = frame.contentWindow?.CX_THEME || {};
        } catch {
          decl = {};
        }
        finish(decl);
      });
      frame.addEventListener("error", () => finish({}));
      document.body.appendChild(frame);
    });
  }

  window.cxReadThemeDecl = function (theme) {
    if (!theme) return Promise.resolve({});
    if (!cache.has(theme)) cache.set(theme, read(theme));
    return cache.get(theme);
  };
})();
