// "Quản lý thiệp" luôn hiển thị (kể cả chưa đăng nhập — vì có thể có nháp/đơn trong
// localStorage). Chỉ nút "Đăng nhập" mới ẩn/hiện theo phiên; đăng nhập mở popup tại chỗ.
function updateNavAuthBtn() {
  const loggedIn = !!window.CXAuth?.isLoggedIn();
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

// ===== Trạng thái đăng nhập: hỏi CXAuth (core/auth.js), không tự cache =====
function _initHomeAuth() {
  updateNavAuthBtn(); // vẽ ngay từ storage (sync) để nút không nhấp nháy
  window.CXAuth?.onChange(updateNavAuthBtn); // đăng nhập/đăng xuất, kể cả ở tab khác
  window.CXAuth?.getUser().then(updateNavAuthBtn); // chốt lại bằng phiên thật
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

