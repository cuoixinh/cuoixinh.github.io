// Cấu hình, state toàn cục của trang, bản nháp localStorage và _onDomReady().
// PHẢI nạp đầu tiên: các file sau dùng _onDomReady và state khai báo ở đây.
//
// Tách từ index.js (dòng 1–57 bản gốc). Thứ tự nạp khai báo ở loader.js.

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

// Publish state — controls whether Advanced section is enabled
let IS_PUBLISHED = false;
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

