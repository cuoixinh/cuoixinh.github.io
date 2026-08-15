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
    window.location.href = `/my-invitations/?urlRedirect=${encodeURIComponent(window.location.href)}`;
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

// Gom về một chỗ để hai lối vào (toggle/close) không lệch trạng thái icon.
function _setMobileMenuOpen(open) {
  const menu = document.getElementById("mobileMenu");
  const icon = document.getElementById("navHamburgerIcon");
  menu.classList.toggle("hidden", !open);
  icon.className = open ? "fas fa-xmark text-base" : "fas fa-bars text-base";
}

function toggleMobileMenu() {
  const menu = document.getElementById("mobileMenu");
  _setMobileMenuOpen(menu.classList.contains("hidden"));
}

function closeMobileMenu() {
  _setMobileMenuOpen(false);
}

// Nút chung ("Tạo thiệp ngay" ở hero, các mục tạo bằng AI/giọng nói): khách chưa
// chọn mẫu nào, ta lấy đại mẫu đầu tiên. `chosen: false` để hộp thoại "đang có
// thiệp viết dở" không bịa ra chuyện khách muốn chuyển sang mẫu đó.
// params đi kèm sang trang thiết lập qua URL (xem goCreateWithAi).
function goCreateDraft(e, params) {
  e.preventDefault();
  const first = templates.find((t) => t.status === "active");
  if (first) createDraft(first.id, { chosen: false, params });
}

// Vào trang thiết lập rồi mở luôn bảng "Tạo nội dung bằng AI". Ý định đi bằng
// QUERY STRING (?open=ai) chứ không phải sessionStorage: đường đi còn vòng qua
// hộp thoại "đang có thiệp viết dở", mà cờ ghi trước rồi khách bấm huỷ là nó nằm
// lại — lần sau vào trang thiết lập bằng đường bất kỳ, bảng AI tự bật lên không
// rõ lý do. Đi theo URL thì không điều hướng = không có gì được ghi.
// Bên đọc + tự xoá khỏi thanh địa chỉ: invitation-setup/ai-modal.js.
function goCreateWithAi(e) {
  goCreateDraft(e, { open: "ai" });
}

// Như trên nhưng mở luôn hộp thoại NÓI của ô "Thông tin cặp đôi" — người dùng
// kể bằng miệng, AI dựng nội dung thiệp từ đó.
function goCreateWithVoice(e) {
  goCreateDraft(e, { open: "voice" });
}

function initHeroImage() {
  const first = templates.find((t) => t.status === "active");
  if (!first) return;
  const img = document.getElementById("hero-preview-img");
  const skeleton = document.getElementById("hero-skeleton");
  const card = document.getElementById("hero-card-preview");
  if (img) {
    // Ảnh ẩn cho tới khi tải xong: mạng chậm / lỗi thì chỉ thấy skeleton,
    // không thấy icon "ảnh hỏng" của trình duyệt.
    img.onload = () => {
      img.style.opacity = "1";
      if (skeleton) skeleton.style.display = "none";
    };
    img.onerror = () => {
      img.style.display = "none";
      if (skeleton) skeleton.classList.add("is-error");
    };
    // Ô xem trước chỉ hiện từ 1024px (.hero-invite-photo) → khổ hẹp đừng tải
    // ảnh mẫu, chờ tới khi màn đủ rộng mới nạp.
    const wide = window.matchMedia("(min-width: 1024px)");
    const loadPreview = () => {
      img.src = `/assets/images/templates/${first.theme}.jpg`;
    };
    if (wide.matches) {
      loadPreview();
    } else {
      wide.addEventListener("change", function once(ev) {
        if (!ev.matches) return;
        wide.removeEventListener("change", once);
        loadPreview();
      });
    }
  }
  // Ảnh mẫu ở hero là <div> nên phải tự cấp vai trò + phím Enter/Space,
  // không thì bàn phím không tới được bản xem thử.
  if (card) {
    const open = () => { window.location.href = first.previewUrl; };
    card.setAttribute("role", "link");
    card.setAttribute("tabindex", "0");
    card.addEventListener("click", open);
    card.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        open();
      }
    });
  }
}

