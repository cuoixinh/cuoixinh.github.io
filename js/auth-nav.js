// "Quản lý thiệp" luôn hiển thị (kể cả chưa đăng nhập — vì có thể có nháp/đơn trong
// localStorage). Chỉ nút "Đăng nhập" mới ẩn/hiện theo phiên; đăng nhập mở popup tại chỗ.
function updateNavAuthBtn() {
  const loggedIn = !!getCurrentUser();
  const el = document.getElementById("navLoginBtn");
  if (el) el.style.display = loggedIn ? "none" : "";
}

// Mở popup đăng nhập/tạo tài khoản ngay tại trang hiện tại (giống lúc Xuất bản thiệp).
function openLoginPopup() {
  if (!window.AuthUI) {
    window.location.href = `/public/account/?urlRedirect=${encodeURIComponent(window.location.href)}`;
    return;
  }
  AuthUI.openModal({
    title: "Đăng nhập",
    subtitle: "Đồng bộ thiệp và đơn hàng trên mọi thiết bị của bạn",
    oauthRedirect: window.location.origin + window.location.pathname,
    onAuth: () => updateNavAuthBtn(),
  });
}

// ===== Supabase auth (nguồn tin cậy cho trạng thái đăng nhập trên trang chủ) =====
let _sbClient = null;
let _authUser = null;

function _initHomeAuth() {
  updateNavAuthBtn(); // render ngay từ localStorage (fallback) để tránh nhấp nháy
  // Tái sử dụng client của AuthUI để chỉ có 1 phiên/listener (tránh cảnh báo nhiều GoTrueClient)
  if (window.AuthUI && AuthUI.supabase) {
    _sbClient = AuthUI.supabase;
  } else if (window.supabase && window.CONFIG?.supabase) {
    try {
      _sbClient = window.supabase.createClient(
        CONFIG.supabase.url,
        CONFIG.supabase.anonKey,
      );
    } catch (e) {
      return;
    }
  } else {
    return;
  }
  _sbClient.auth.getSession().then(({ data }) => {
    _authUser = data?.session?.user ?? null;
    updateNavAuthBtn();
  });
  _sbClient.auth.onAuthStateChange((_event, session) => {
    _authUser = session?.user ?? null;
    updateNavAuthBtn();
  });
}

document.addEventListener("DOMContentLoaded", _initHomeAuth);

function toggleMobileMenu() {
  const menu = document.getElementById("mobileMenu");
  const icon = document.getElementById("navHamburgerIcon");
  const open = menu.classList.toggle("hidden");
  icon.className = open ? "fas fa-bars text-base" : "fas fa-xmark text-base";
}

function closeMobileMenu() {
  const menu = document.getElementById("mobileMenu");
  const icon = document.getElementById("navHamburgerIcon");
  menu.classList.add("hidden");
  icon.className = "fas fa-bars text-base";
}

function goCreateDraft(e) {
  e.preventDefault();
  const first = templates.find((t) => t.status === "active");
  if (first) createDraft(first.id);
}

function initHeroImage() {
  const first = templates.find((t) => t.status === "active");
  if (!first) return;
  const img = document.getElementById("hero-preview-img");
  const skeleton = document.getElementById("hero-skeleton");
  const card = document.getElementById("hero-card-preview");
  if (img) {
    img.src = `/assets/images/templates/${first.theme}.jpg`;
    img.onload = () => { if (skeleton) skeleton.style.display = "none"; };
  }
  if (card) {
    card.style.cursor = "pointer";
    card.addEventListener("click", () => { window.location.href = first.previewUrl; });
  }
}

