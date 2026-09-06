// "Đã chọn" luôn hiển thị (kể cả chưa đăng nhập — vì có thể có nháp/đơn trong
// localStorage). Theo phiên chỉ có thanh TRÊN đổi: nút "Đăng nhập" nhường chỗ
// cho chip avatar + tên (CXAccount.mountChip). Thanh tab dưới giữ nguyên mục
// "Tài khoản" ở mọi trạng thái.
function updateNavAuthBtn() {
  const loggedIn = !!window.CXAuth?.isLoggedIn();
  const el = document.getElementById("navLoginBtn");
  if (el) el.style.display = loggedIn ? "none" : "";
  window.CXAccount?.syncChip();
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
  window.CXAccount?.mountChip(); // navbar đã dựng xong ở lúc parse
  updateNavAuthBtn(); // vẽ ngay từ storage (sync) để nút không nhấp nháy
  window.CXAuth?.onChange(updateNavAuthBtn); // đăng nhập/đăng xuất, kể cả ở tab khác
  window.CXAuth?.getUser().then(updateNavAuthBtn); // chốt lại bằng phiên thật
}

document.addEventListener("DOMContentLoaded", _initHomeAuth);

// Nút chung ("Tạo thiệp ngay" ở hero, các mục tạo bằng AI/giọng nói): khách chưa
// chọn mẫu nào, ta lấy đại mẫu đầu tiên. `chosen: false` để hộp thoại "đang có
// thiệp viết dở" không bịa ra chuyện khách muốn chuyển sang mẫu đó.
// params đi kèm sang trang thiết lập qua URL.
function goCreateDraft(e, params) {
  e.preventDefault();
  const first = templates.find((t) => t.status === "active");
  if (first) createDraft(first.id, { chosen: false, params });
}

// Ba thẻ mẫu thiệp ở màn mở đầu, CHỈ ảnh chụp mẫu — không nhúng iframe (ba
// thiệp sống cùng lúc là ba lần tải nguyên trang thiệp) và không in tên mẫu đè
// lên (ảnh đã có sẵn chữ của chính mẫu đó). Tên chỉ nằm ở `aria-label`.
// Thẻ giữa mang .is-lead nên nhô cao hơn hai thẻ bên — dáng này là chủ ý, đừng
// đổi sang cả ba bằng nhau.
// Không có mẫu nào bật thì để #heroPicks rỗng: một hàng thẻ hỏng khó hiểu hơn
// là không có hàng nào.
const HERO_PICK_COUNT = 3;

function initHeroPicks() {
  const row = document.getElementById("heroPicks");
  if (!row) return;

  const list = templates
    .filter((t) => t.status === "active")
    .slice(0, HERO_PICK_COUNT);
  if (!list.length) return;

  // Thẻ giữa của hàng thật (hàng 2 thẻ thì không có thẻ nào nhô lên).
  const lead = list.length === HERO_PICK_COUNT ? 1 : -1;

  // Dáng nan quạt (hai thẻ bên nghiêng và thúc vào dưới thẻ giữa) chỉ hợp khi
  // đủ ba thẻ — thiếu thẻ thì bỏ cờ để hàng về dáng đứng thẳng cách đều.
  row.classList.toggle("is-fan", lead >= 0);

  // KHÔNG `loading="lazy"`: ba tấm này nằm ngay màn đầu, hoãn tải là lộ ba ô
  // trống đúng lúc khách vừa vào trang.
  row.innerHTML = list
    .map(
      (t, i) => `
    <a class="hero-pick${i === lead ? " is-lead" : ""}" href="${t.previewUrl}"
       aria-label="Xem thử mẫu ${t.name}">
      <img src="/assets/images/templates/${t.theme}.jpg" alt="${t.name}" />
    </a>`,
    )
    .join("");
}
