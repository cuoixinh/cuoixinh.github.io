// Menu "Tài khoản" dùng chung cho MỌI trang có navbar (core/components/navbar.js).
// Một luật duy nhất, không trang nào tự chế:
//   chưa đăng nhập → popover một mục "Đăng nhập"
//   đã đăng nhập   → "Thiệp của tôi" · "Thông tin cá nhân" · "Đăng xuất"
//
//   <button onclick="CXAccount.open(this)">   ← navbar truyền chính nút vừa bấm
//   CXAccount.configure({ onLogin, onProfile, onLogout })  ← trang ghi đè khi cần
//   CXAccount.mountChip()  ← chip avatar + tên ở thanh trên, chỉ hiện khi đã đăng nhập
//
// Mặc định: onLogin gọi openLoginPopup() của trang (không có thì sang
// /my-invitations/), onProfile gọi openProfileModal() nếu trang có, không thì
// sang /my-invitations/ — nơi duy nhất có form hồ sơ.
// Cần core/x-popover.js + core/auth.js (nạp trước file này).

const CXAccount = (function () {
  const ICON = (d) =>
    `<svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" ` +
    `fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" ` +
    `stroke-linejoin="round" aria-hidden="true">${d}</svg>`;

  const ICONS = {
    cards: ICON(
      '<rect width="7" height="7" x="3" y="3" rx="1.5"/><rect width="7" height="7" x="14" y="3" rx="1.5"/><rect width="7" height="7" x="14" y="14" rx="1.5"/><rect width="7" height="7" x="3" y="14" rx="1.5"/>',
    ),
    user: ICON(
      '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="10" r="3"/><path d="M7 20.7a8 8 0 0 1 10 0"/>',
    ),
    out: ICON(
      '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>',
    ),
    in: ICON(
      '<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" x2="3" y1="12" y2="12"/>',
    ),
  };

  const MANAGE_URL = "/my-invitations/";
  let _hooks = {};

  function configure(hooks) {
    _hooks = Object.assign(_hooks, hooks || {});
  }

  function _pop() {
    let el = document.getElementById("cx-account-pop");
    if (el) return el;
    el = document.createElement("x-popover");
    el.id = "cx-account-pop";
    el.setAttribute("width", "230");
    el.setAttribute("arrow", ""); // thuộc tính cờ vẫn phải truyền đủ 2 tham số
    document.body.appendChild(el);
    return el;
  }

  function _login() {
    if (_hooks.onLogin) return _hooks.onLogin();
    if (window.openLoginPopup) return openLoginPopup();
    window.location.href = `${MANAGE_URL}?urlRedirect=${encodeURIComponent(location.href)}`;
  }

  // Form hồ sơ chỉ có ở trang quản lý thiệp; trang khác thì sang đó.
  function _profile() {
    if (_hooks.onProfile) return _hooks.onProfile();
    if (window.openProfileModal) return openProfileModal();
    window.location.href = MANAGE_URL;
  }

  async function _logout() {
    if (_hooks.onLogout) return _hooks.onLogout();
    await window.CXAuth?.client?.()?.auth?.signOut();
    window.location.replace(window.location.pathname);
  }

  /** Mở menu, neo theo phần tử vừa bấm (mục ở thanh trên hay thanh tab dưới). */
  function open(anchorEl) {
    const pop = _pop();
    if (!pop.setItems) return _login(); // x-popover chưa nạp → ít nhất vẫn đăng nhập được
    const loggedIn = !!window.CXAuth?.isLoggedIn();
    pop.setItems(
      loggedIn
        ? [
            {
              icon: ICONS.cards,
              label: "Thiệp của tôi",
              onClick: () => (window.location.href = MANAGE_URL),
            },
            { icon: ICONS.user, label: "Thông tin cá nhân", onClick: _profile },
            { icon: ICONS.out, label: "Đăng xuất", onClick: _logout },
          ]
        : [{ icon: ICONS.in, label: "Đăng nhập", onClick: _login }],
    );
    pop.toggle(anchorEl);
  }

  function close() {
    document.getElementById("cx-account-pop")?.close();
  }

  // ===== Chip "đang đăng nhập" ở thanh trên (desktop) =====
  // Avatar + tên, bấm vào mở chính popover trên. Chỉ hiện khi có phiên nên trang
  // vẫn phải tự ẩn nút "Đăng nhập" của mình — hai thứ chiếm cùng một chỗ.

  const _esc = (s) =>
    String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

  function _syncChip() {
    const el = document.getElementById("cx-account-chip");
    if (!el) return;
    const u = window.CXAuth?.getUserSync?.();
    el.style.display = u ? "" : "none";
    // Chip và mục "Tài khoản" của THANH TRÊN chiếm cùng một vai trò → chỉ một
    // cái hiện. Thanh tab dưới không đụng tới: ở mobile luôn là "Tài khoản".
    document.querySelectorAll('#main-nav [data-nav="account"]').forEach((it) => {
      it.style.display = u ? "none" : "";
    });
    if (!u) return;
    const meta = u.user_metadata || {};
    const name = meta.full_name || meta.name || (u.email || "").split("@")[0] || "Tài khoản";
    const avatar = meta.avatar_url || meta.picture || "";
    el.title = u.email || name;
    // Chữ cái đầu nằm SẴN dưới ảnh: link avatar của Google/Facebook chết là
    // chuyện thường, onerror gỡ ảnh đi thì lộ ngay chữ cái, không thành ô trống.
    el.innerHTML =
      `<span class="cx-accchip-av"><span>${_esc(name.trim().charAt(0).toUpperCase())}</span>` +
      (avatar
        ? `<img src="${_esc(avatar)}" alt="" referrerpolicy="no-referrer" onerror="this.remove()" />`
        : "") +
      `</span><span class="cx-accchip-name">${_esc(name)}</span>` +
      // Mũi tên báo "bấm ra menu"; x-popover đặt aria-expanded lên chính nút này
      // nên CSS lật được nó mà JS không phải theo dõi trạng thái mở.
      `<svg class="cx-accchip-caret" xmlns="http://www.w3.org/2000/svg" width="14" height="14" ` +
      `viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" ` +
      `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">` +
      `<polyline points="6 9 12 15 18 9"/></svg>`;
  }

  let _chipBound = false;

  /**
   * Dựng chip vào vùng hành động của navbar. Gọi được ngay sau CXNavbar.mount()
   * dù core/auth.js nạp sau — tự đợi DOM xong mới dựng, lúc đó CXAuth đã có.
   */
  function mountChip(container) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => mountChip(container), { once: true });
      return;
    }
    const host = container || document.querySelector(".cx-navactions");
    if (!host) return;
    if (!document.getElementById("cx-account-chip")) {
      // x-button tự thay mình bằng <button> ngay khi chèn → query lại sau đó.
      host.insertAdjacentHTML(
        "beforeend",
        `<x-button variant="bare" id="cx-account-chip" class="cx-accchip" ` +
          `onclick="CXAccount.open(this)" aria-label="Tài khoản"></x-button>`,
      );
    }
    _syncChip();
    if (_chipBound) return;
    _chipBound = true;
    window.CXAuth?.onChange(_syncChip);
    window.CXAuth?.getUser?.().then(_syncChip); // chốt lại bằng phiên thật
  }

  return { open, close, configure, mountChip, syncChip: _syncChip };
})();

window.CXAccount = CXAccount;
