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

// ============= TAB SWITCHING =============
function switchTab(tabName, pushState = true) {
  document.querySelectorAll(".tab-button").forEach((btn) => btn.classList.remove("active"));
  document.getElementById(`tab-${tabName}`).classList.add("active");

  document.querySelectorAll(".tab-content").forEach((c) => c.classList.remove("active"));
  document.getElementById(`content-${tabName}`).classList.add("active");

  if (pushState) history.replaceState(null, "", `#${tabName}`);

  if (tabName === "weddings") {
    loadPage(1);
  } else if (tabName === "templates") {
    loadTemplates();
  }
}

// Restore tab từ URL hash (nếu không có hash thì giữ Dashboard mặc định, không gọi API)
(function () {
  const tab = location.hash.replace("#", "");
  if (tab === "dashboard" || tab === "weddings" || tab === "templates") {
    switchTab(tab, false);
  }
})();
