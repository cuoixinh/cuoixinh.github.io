// Bản khai của MẪU (window.CX_THEME trong public/themes/<theme>/index.js) đọc từ
// phía trang Thiết lập. Hiện chỉ dùng một khoá: `skipSteps` — danh sách bước mà
// mẫu KHÔNG hiển thị, để thanh bước bỏ luôn bước đó thay vì bắt khách nhập một
// mục sẽ không xuất hiện trên thiệp.
//
// Cách đọc: nạp riêng index.js của mẫu trong một iframe rỗng (srcdoc) rồi lấy
// CX_THEME ra — rẻ hơn nhiều so với dựng cả thiệp, và luôn đúng vì đọc chính
// đối tượng mẫu khai chứ không đoán từ tên. Mẫu gọi vài hàm dùng chung ngay khi
// chạy nên iframe cấp sẵn bản giả cho chúng; có lỗi thì cũng không sao: CX_THEME
// được gán ở dòng ĐẦU của IIFE, sau đó mới tới phần chạy.
//
// Không tìm thấy / lỗi mạng → trả {} và mọi bước hiện như cũ.

const _CX_DECL_TIMEOUT = 6000;

let _cxDecl = {};
let _cxDeclTheme = null;

/** Bản khai của mẫu đang chọn — {} khi chưa đọc xong hoặc mẫu không khai gì. */
function cxThemeDecl() {
  return _cxDecl;
}
window.cxThemeDecl = cxThemeDecl;

/**
 * Đọc bản khai của `theme` rồi phát sự kiện "cx-theme-decl" cho phần khác vẽ
 * lại. Gọi lại với cùng tên mẫu thì không làm gì.
 */
async function cxThemeDeclLoad(theme) {
  if (!theme || theme === _cxDeclTheme) return _cxDecl;
  _cxDeclTheme = theme;
  _cxDecl = await _cxReadThemeDecl(theme);
  document.dispatchEvent(
    new CustomEvent("cx-theme-decl", { detail: { theme, decl: _cxDecl } }),
  );
  return _cxDecl;
}
window.cxThemeDeclLoad = cxThemeDeclLoad;

function _cxReadThemeDecl(theme) {
  return new Promise((resolve) => {
    const src = `/public/themes/${encodeURIComponent(theme)}/index.js?v=${
      typeof CX_VERSION !== "undefined" ? CX_VERSION : ""
    }`;
    const frame = document.createElement("iframe");
    frame.setAttribute("aria-hidden", "true");
    frame.style.cssText = "position:fixed;width:0;height:0;border:0;opacity:0";
    // Bản giả cho các hàm dùng chung mà mẫu gọi ngay khi chạy — thiếu chúng thì
    // script dừng giữa chừng, nhưng CX_THEME thì đã kịp gán rồi.
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
    const timer = setTimeout(() => finish({}), _CX_DECL_TIMEOUT);

    frame.addEventListener("load", () => {
      let decl = {};
      try {
        decl = frame.contentWindow?.CX_THEME || {};
      } catch (e) {
        decl = {};
      }
      finish(decl);
    });
    frame.addEventListener("error", () => finish({}));
    document.body.appendChild(frame);
  });
}

// Đọc ngay khi trang sẵn sàng: thanh bước dựng trước đó vẫn đủ bước, sự kiện
// "cx-theme-decl" sẽ bắt nó vẽ lại nếu mẫu có bỏ bước nào. fillForm() và lúc đổi
// mẫu gọi lại hàm này vì WEDDING_THEME chỉ biết chắc sau khi nháp về.
// WEDDING_THEME khai bằng `let` → là binding toàn cục, KHÔNG phải window.*.
if (window.__cxOnReady)
  window.__cxOnReady(() => {
    if (typeof WEDDING_THEME !== "undefined") cxThemeDeclLoad(WEDDING_THEME);
  });
