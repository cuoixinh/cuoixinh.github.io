// Hàng đầu của màn mở đầu trên điện thoại (.hero-top): nút menu mở popover mang
// đúng các mục của thanh tab dưới, và cờ .cx-tabbar-off trên <html> (giấu thanh
// tab) chỉ được gỡ khi hàng này cuộn khỏi màn — nút menu và thanh tab không bao
// giờ cùng hiện. Nạp SAU CXNavbar.mount() + core/x-popover.js + account-menu.js.

(function () {
  const row = document.querySelector(".hero-top");
  const html = document.documentElement;
  // Không có hàng (hoặc trình duyệt thiếu IO) thì trả thanh tab về như mọi trang.
  if (!row || !("IntersectionObserver" in window)) {
    html.classList.remove("cx-tabbar-off");
    return;
  }

  new IntersectionObserver(([e]) => {
    html.classList.toggle("cx-tabbar-off", e.isIntersecting);
    if (!e.isIntersecting) document.getElementById("heroMenu")?.close();
  }).observe(row);
})();

// Icon lấy từ bảng của navbar để menu và thanh tab dùng cùng một hình.
function _cxHeroMenuIcon(name) {
  const d = window.CXNavbar?.ICONS?.[name] || "";
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" ` +
    `fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" ` +
    `stroke-linejoin="round" aria-hidden="true">${d}</svg>`
  );
}

// Dựng lại mỗi lần mở: số đếm và phiên đăng nhập có thể đã đổi từ lần trước.
function cxHeroMenu(btn) {
  const pop = document.getElementById("heroMenu");
  if (!pop) return;
  if (!pop.isOpen) {
    const countEl = document.querySelector('[data-nav-count="cart"]');
    const n = countEl && !countEl.classList.contains("hidden") ? countEl.textContent : "";
    const go = (href) => () => (location.href = href);
    const loggedIn = !!window.CXAuth?.isLoggedIn?.();
    // 3 trang thì xếp 3 cột, 4 trang thì lưới 2×2 — không để ô lẻ trơ một mình.
    pop.style.setProperty("--hm-cols", loggedIn ? "2" : "3");
    pop.setItems([
      { icon: _cxHeroMenuIcon("home"), label: "Trang chủ", active: true, onClick: go("/") },
      { icon: _cxHeroMenuIcon("layers"), label: "Mẫu thiệp", onClick: go("/theme-template/") },
      { icon: _cxHeroMenuIcon("cart"), label: `${loggedIn ? "Thiệp của tôi" : "Đã chọn"}${n ? ` (${n})` : ""}`, onClick: go("/my-invitations/") },
      // Khách mời chỉ có nghĩa khi đã đăng nhập — cùng luật mục `login: true` ở navbar.
      ...(loggedIn
        ? [{ icon: _cxHeroMenuIcon("users"), label: "Khách mời", onClick: go("/guest-list/") }]
        : []),
      { sep: true },
      // Mục tài khoản ghép thẳng vào menu này (không mở thêm popover chồng lên).
      ...(window.CXAccount?.items?.() || []),
    ]);
  }
  pop.toggle(btn);
}

// Màn mờ sau menu chạy theo sự kiện của popover (đóng do bấm ra ngoài, Esc, chọn
// mục hay hàng nút cuộn khỏi màn đều đi qua "close").
(function () {
  const pop = document.getElementById("heroMenu");
  const scrim = document.querySelector(".hero-menu-scrim");
  const btn = document.getElementById("heroMenuBtn");
  if (!pop || !scrim) return;
  pop.addEventListener("open", () => {
    const top = btn ? btn.getBoundingClientRect().bottom + 4 : 0;
    scrim.style.setProperty("--hm-top", `${Math.max(0, Math.round(top))}px`);
    scrim.classList.add("is-on");
  });
  pop.addEventListener("close", () => scrim.classList.remove("is-on"));
})();
