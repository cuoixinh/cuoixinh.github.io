// Bản khai của MẪU (window.CX_THEME trong public/themes/<theme>/index.js) đọc từ
// phía trang Thiết lập. Hiện chỉ dùng một khoá: `skipSteps` — danh sách bước mà
// mẫu KHÔNG hiển thị, để thanh bước bỏ luôn bước đó thay vì bắt khách nhập một
// mục sẽ không xuất hiện trên thiệp.
//
// Cách đọc nằm ở core/helpers/theme-decl.js (dùng chung với khung chat XuXi).
//
// Không tìm thấy / lỗi mạng → trả {} và mọi bước hiện như cũ.

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
  _cxDecl = await window.cxReadThemeDecl(theme);
  document.dispatchEvent(
    new CustomEvent("cx-theme-decl", { detail: { theme, decl: _cxDecl } }),
  );
  return _cxDecl;
}
window.cxThemeDeclLoad = cxThemeDeclLoad;

// Đọc ngay khi trang sẵn sàng: thanh bước dựng trước đó vẫn đủ bước, sự kiện
// "cx-theme-decl" sẽ bắt nó vẽ lại nếu mẫu có bỏ bước nào. fillForm() và lúc đổi
// mẫu gọi lại hàm này vì WEDDING_THEME chỉ biết chắc sau khi nháp về.
// WEDDING_THEME khai bằng `let` → là binding toàn cục, KHÔNG phải window.*.
if (window.__cxOnReady)
  window.__cxOnReady(() => {
    if (typeof WEDDING_THEME !== "undefined") cxThemeDeclLoad(WEDDING_THEME);
  });
