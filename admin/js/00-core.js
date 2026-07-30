// ============= CORE: config, auth token, tab switching =============
// File này phải nạp đầu tiên (sau core/config.js) — các file theo tab
// (01-weddings.js, 02-templates.js) đều dùng EDGE_URL/ANON_KEY/ADMIN_TOKEN/
// supabaseClient/switchTab khai báo ở đây.

const EDGE_URL = CONFIG.supabase.edgeUrl;
const ANON_KEY = CONFIG.supabase.anonKey;
const SUPABASE_URL = CONFIG.supabase.url;
const DOMAIN = window.location.origin;

const supabaseClient = supabase.createClient(SUPABASE_URL, ANON_KEY);

let ADMIN_TOKEN = sessionStorage.getItem("admin_token");
if (!ADMIN_TOKEN) {
  ADMIN_TOKEN = prompt("Nhập mã quản trị:");
  if (ADMIN_TOKEN) {
    sessionStorage.setItem("admin_token", ADMIN_TOKEN);
  } else {
    document.body.innerHTML =
      '<p style="text-align:center;margin-top:40px;color:#999">Không có quyền truy cập</p>';
  }
}

/**
 * Header chuẩn cho mọi request quản trị tới edge function.
 *
 * Token đi trong HEADER `x-admin-token`, không phải query string: URL bị ghi vào
 * access log của Supabase/Cloudflare, lịch sử trình duyệt và header Referer, nên
 * token nằm trong URL là rò rỉ ra nhiều nơi ngoài tầm kiểm soát.
 */
function adminHeaders(extra = {}) {
  return {
    Authorization: `Bearer ${ANON_KEY}`,
    "x-admin-token": ADMIN_TOKEN,
    ...extra,
  };
}

// ============= CHUYỂN MÀN (Dashboard / Weddings / Templates) =============
// Không còn tab bar — điều hướng qua card ở Dashboard và breadcrumb ở header
// (span#breadcrumb-current đổi nhãn theo màn đang xem). Giữ tên switchTab để
// không phải đổi tên khắp các file gọi nó.
const TAB_NAMES = [
  "dashboard",
  "weddings",
  "templates",
  "sample-images",
  "asset-images",
];
const TAB_BREADCRUMB_LABELS = {
  dashboard: "Quản lý Hệ thống",
  weddings: "Thiệp Cưới",
  templates: "Templates",
  "sample-images": "Dữ liệu mẫu",
  "asset-images": "Ảnh mẫu",
};

function switchTab(tabName, pushState = true) {
  TAB_NAMES.forEach((name) => {
    document.getElementById(`content-${name}`).classList.toggle("hidden", name !== tabName);
  });
  document.getElementById("breadcrumb-current").textContent = TAB_BREADCRUMB_LABELS[tabName];

  if (pushState) history.replaceState(null, "", `#${tabName}`);

  if (tabName === "weddings") {
    loadPage(1);
  } else if (tabName === "templates") {
    loadTemplates();
  } else if (tabName === "sample-images") {
    initSampleImagesPanel();
  } else if (tabName === "asset-images") {
    initAssetImagesPanel();
  }
}

// Restore tab từ URL hash (nếu không có hash thì giữ Dashboard mặc định, không gọi API).
// Gọi từ loader.js SAU KHI toàn bộ script theo tab đã nạp xong (không gọi ở đây
// — lúc file này chạy, js/01-weddings.js…05-asset-images.js chưa nạp nên
// loadPage()/loadTemplates()/initSampleImagesPanel()/initAssetImagesPanel()
// còn undefined).
function restoreTabFromHash() {
  const tab = location.hash.replace("#", "");
  if (TAB_NAMES.includes(tab)) {
    switchTab(tab, false);
  }
}
