// Hộp "Thông tin cá nhân" dùng chung (window.CXProfile): menu tài khoản ở mọi trang
// mở thẳng tại chỗ, không phải sang /my-invitations/. Markup dựng lần đầu mở.
// Cần core/auth.js + x-input/x-button; showToast (alert.js) có thì dùng.

const CXProfile = (function () {
  const ID = "profile-modal";

  function _el() {
    let m = document.getElementById(ID);
    if (m) return m;
    document.body.insertAdjacentHTML(
      "beforeend",
      `<div id="${ID}" class="fixed inset-0 z-[500] hidden items-center justify-center p-4"
        style="background: rgb(var(--scrim-rgb) / 0.5)" role="dialog" aria-modal="true" aria-labelledby="profile-title">
        <div class="w-full max-w-sm overflow-hidden rounded-xl bg-white shadow-xl">
          <div class="flex items-center justify-between border-b border-gray-100 px-5 py-3.5">
            <h3 id="profile-title" class="text-sm font-semibold text-gray-900">Thông tin cá nhân</h3>
            <x-button variant="ghost" tone="neutral" size="sm" icon-only data-profile-close aria-label="Đóng">
              <i data-lucide="x" class="text-sm text-gray-400" style="width:16px;height:16px"></i>
            </x-button>
          </div>
          <form id="profile-form" class="p-5">
            <div class="mb-4">
              <x-input id="profile-name" label="Họ và tên" placeholder="Nhập họ và tên"></x-input>
            </div>
            <div class="mb-4">
              <x-input id="profile-email-input" type="email" label="Email" placeholder="Nhập email"></x-input>
            </div>
            <div class="mb-5">
              <x-input id="profile-phone" type="tel" label="Số điện thoại" placeholder="Nhập số điện thoại"></x-input>
            </div>
            <x-button type="submit" full>Lưu thông tin</x-button>
          </form>
        </div>
      </div>`,
    );
    m = document.getElementById(ID);
    window.lucide?.createIcons({ root: m });
    // Bấm nền tối hoặc nút ✕ thì đóng.
    m.addEventListener("click", (e) => {
      if (e.target === m || e.target.closest("[data-profile-close]")) close();
    });
    m.querySelector("#profile-form").addEventListener("submit", _submit);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && isOpen()) close();
    });
    return m;
  }

  // Gán value cho input bên trong <x-input> rồi báo x-input bật/tắt nút xoá nhanh.
  function _set(id, value) {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = value;
    el.closest("x-input")?.syncClearBtn?.();
  }

  function _toast(msg, type) {
    if (window.showToast) showToast(msg, type);
    else if (type === "error") alert(msg);
  }

  async function open() {
    // Hỏi phiên thật: bản trong storage có thể còn tên/SĐT cũ ngay sau lần lưu.
    const user = (await window.CXAuth?.getUser?.()) || window.CXAuth?.getUserSync?.();
    if (!user) return;
    const m = _el();
    const meta = user.user_metadata || {};
    _set("profile-name", meta.full_name || meta.name || "");
    _set("profile-email-input", user.email || "");
    _set("profile-phone", meta.phone || "");
    m.classList.remove("hidden");
    m.classList.add("flex");
  }

  function close() {
    const m = document.getElementById(ID);
    if (!m) return;
    m.classList.add("hidden");
    m.classList.remove("flex");
  }

  function isOpen() {
    const m = document.getElementById(ID);
    return !!m && !m.classList.contains("hidden");
  }

  async function _submit(e) {
    e.preventDefault();
    const sb = window.CXAuth?.client?.();
    if (!sb || !(await window.CXAuth.getUser())) {
      _toast("Vui lòng đăng nhập", "error");
      return;
    }
    const { error } = await sb.auth.updateUser({
      data: {
        full_name: document.getElementById("profile-name").value,
        phone: document.getElementById("profile-phone").value,
      },
    });
    if (error) {
      _toast("Lỗi cập nhật: " + error.message, "error");
      return;
    }
    close();
    _toast("Đã lưu thông tin cá nhân", "success");
  }

  return { open, close, isOpen };
})();

window.CXProfile = CXProfile;
