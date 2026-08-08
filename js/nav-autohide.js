// Nav tự ẩn/hiện theo hướng & tốc độ cuộn (navbar trong suốt nên không có hiệu ứng nền)
(function initNavAutoHide() {
  const nav = document.getElementById("main-nav");
  const mobileMenu = document.getElementById("mobileMenu");
  if (!nav) return;

  const TOP_THRESHOLD = 80; // gần đầu trang -> luôn hiện navbar
  const MOVE_DEADZONE = 6; // bỏ qua rung lắc/cuộn cực nhẹ
  const FAST_SWIPE_SPEED = 0.6; // px/ms — vuốt lên nhanh mới cho hiện lại navbar

  let lastY = window.scrollY;
  let lastT = performance.now();
  let ticking = false;

  function isMobileMenuOpen() {
    return mobileMenu && !mobileMenu.classList.contains("hidden");
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const currentY = Math.max(window.scrollY, 0);
      const currentT = performance.now();
      const deltaY = currentY - lastY;
      const deltaT = Math.max(currentT - lastT, 1);
      const speed = Math.abs(deltaY) / deltaT; // px/ms

      if (!isMobileMenuOpen()) {
        if (currentY <= TOP_THRESHOLD) {
          // Gần đầu trang: luôn hiện navbar
          nav.classList.remove("nav-hidden");
        } else if (deltaY > MOVE_DEADZONE) {
          // Cuộn xuống: ẩn ngay, không phân biệt tốc độ
          nav.classList.add("nav-hidden");
        } else if (deltaY < -MOVE_DEADZONE) {
          // Cuộn lên: chỉ hiện lại nếu vuốt đủ nhanh (flick).
          // Vuốt lên chậm/từ từ = đang đọc lại nội dung, không show navbar.
          if (speed >= FAST_SWIPE_SPEED) {
            nav.classList.remove("nav-hidden");
          }
        }
      }

      lastY = currentY;
      lastT = currentT;
      ticking = false;
    });
  }

  window.addEventListener("scroll", onScroll, { passive: true });
})();
