// Hàng đầu của màn mở đầu trên điện thoại (.hero-top): nút menu mở popover mang
// đúng các mục của thanh tab dưới, và cờ .cx-tabbar-off trên <html> (giấu thanh
// tab) chỉ được gỡ khi hàng này cuộn khỏi màn — nút menu và thanh tab không bao
// giờ cùng hiện. Nạp SAU CXNavbar.mount() + core/x-popover.js + account-menu.js.

// Cờ .cx-scrolled: đã rời đầu trang — logo desktop (đứng trần) mờ đi để không
// trôi đè lên nội dung.
(function () {
  let queued = false;
  const sync = () => {
    queued = false;
    document.documentElement.classList.toggle("cx-scrolled", window.scrollY > 24);
  };
  window.addEventListener(
    "scroll",
    () => {
      if (!queued) {
        queued = true;
        requestAnimationFrame(sync);
      }
    },
    { passive: true },
  );
  sync();
})();

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

// Dựng lại mỗi lần mở: số mẫu "Đã chọn" có thể đã đổi từ lần trước.
function cxHeroMenu(btn) {
  const pop = document.getElementById("heroMenu");
  if (!pop) return;
  if (!pop.isOpen) {
    const countEl = document.querySelector('[data-nav-count="cart"]');
    const n = countEl && !countEl.classList.contains("hidden") ? countEl.textContent : "";
    const go = (href) => () => (location.href = href);
    pop.setItems([
      { icon: _cxHeroMenuIcon("home"), label: "Trang chủ", active: true, onClick: go("/") },
      { icon: _cxHeroMenuIcon("layers"), label: "Mẫu thiệp", onClick: go("/theme-template/") },
      { icon: _cxHeroMenuIcon("cart"), label: n ? `Đã chọn (${n})` : "Đã chọn", onClick: go("/my-invitations/") },
      { sep: true },
      // Menu tự đóng khi chọn mục, nên menu tài khoản neo vào nút menu (vẫn trên màn).
      { icon: _cxHeroMenuIcon("user"), label: "Tài khoản", onClick: () => window.CXAccount?.open(btn) },
    ]);
  }
  pop.toggle(btn);
}
