// Cấu hình, state toàn cục của trang, bản nháp localStorage và _onDomReady().
// PHẢI nạp đầu tiên: các file sau dùng _onDomReady và state khai báo ở đây.

// Configuration
const WEDDING_ID = new URLSearchParams(window.location.search).get("id");
const DOMAIN = window.location.origin;

// Các panel được loader.js nạp động rồi mới chèn script này, nên DOMContentLoaded
// có thể đã bắn xong trước khi file chạy. Ưu tiên hàng đợi của loader — nó chạy
// sau khi TOÀN BỘ script đã nạp, đúng như DOMContentLoaded trước đây.
function _onDomReady(fn) {
  if (window.__cxOnReady) {
    window.__cxOnReady(fn);
  } else if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", fn);
  } else {
    fn();
  }
}

// Wedding data cache
let WEDDING_SLUG = "";
let WEDDING_THEME = "basic-gold";
let _currentMusicUrl = "";

// Tuỳ chỉnh giao diện (font + màu chữ) — lưu vào cột theme_setting (JSONB)
let _themeSetting = {};

// Draft state: true = chỉ có trong localStorage, chưa lên DB
let _isLocalDraft = false;

// Đang đăng nhập hay không — CỜ dùng chung cho cả trang thay vì mỗi nơi tự hỏi
// CXAuth (core/auth.js). Đặt lúc nạp dữ liệu (loadData), trước mỗi lần lưu/xuất
// bản, và tự cập nhật theo mọi biến động phiên nhờ _watchLoginState().
let IS_LOGIN = false;

// IS_PUBLISHED là cờ ĐỌC TỪ DỮ LIỆU, KHÔNG phải quyền: getWeddingById dùng ANON
// KEY nên người đã đăng xuất vẫn đọc được, và bản nháp trong cache cũng giữ cờ đó.
// Nút/chức năng thực chất cần đăng nhập (nhãn "Lưu & Xuất bản", ẩn "Lưu nháp",
// panel khách mời) phải xét `IS_PUBLISHED && IS_LOGIN`.
let IS_PUBLISHED = false;

// Gán cờ và vẽ lại UI phụ thuộc phiên NGAY khi giá trị đổi. Mọi lối cập nhật cờ
// đều đi qua đây — trước kia có nhánh chỉ gán cờ mà quên vẽ lại, nên phát hiện
// mất phiên rồi mà nút vẫn còn nhãn "Lưu & Xuất bản".
function _applyLoginState(loggedIn) {
  if (loggedIn === IS_LOGIN) return IS_LOGIN;
  IS_LOGIN = loggedIn;
  _syncAdvancedSection();
  _updateLocalDraftNotice();
  return IS_LOGIN;
}

// Bản SYNC: trả lời tức thì (đọc storage) — dùng để vẽ UI, không chặn.
function _syncLoginState() {
  return _applyLoginState(!!window.CXAuth?.isLoggedIn());
}

// Bản ASYNC: hỏi supabase (tự refresh token) — BẮT BUỘC dùng trước mỗi quyết định
// GHI (lưu DB, xuất bản), vì access token hết hạn vẫn refresh được nên chỉ
// supabase mới biết chắc phiên còn hay đã mất.
async function _refreshLoginState() {
  return _applyLoginState(!!(await window.CXAuth?.getUser()));
}

// Phiên đăng nhập đổi giữa lúc đang mở trang (bấm đăng nhập trong popup, hoặc
// đăng xuất ở tab khác — CXAuth theo dõi qua onAuthStateChange) → cập nhật cờ và
// vẽ lại bộ nút cho khớp, khỏi phải F5.
let _loginWatchStarted = false;

function _watchLoginState() {
  _syncLoginState();
  if (_loginWatchStarted) return; // gọi lại chỉ để làm mới cờ, đừng đăng ký thêm listener
  _loginWatchStarted = true;
  window.CXAuth?.onChange((user) => _applyLoginState(!!user));
}

const DRAFT_LOCAL_KEY = buildCacheKey("draft", WEDDING_ID);

function getLocalDraft() {
  return getCache(DRAFT_LOCAL_KEY);
}
function saveLocalDraft(data) {
  setCache(DRAFT_LOCAL_KEY, { ...data, _localOnly: _isLocalDraft });
}
function clearLocalDraft() {
  removeCache(DRAFT_LOCAL_KEY);
}

