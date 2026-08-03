// ============= SCROLL FADE =============
// Dải cuộn ngang giữ nội dung trên MỘT hàng: phía nào còn cuộn được thì mờ dần ở
// mép để lộ ra là kéo được. Cách dùng: thêm `data-scroll-fade` + class
// `.scroll-fade` (styles/_common.css) vào chính phần tử có overflow-x-auto.

const SCROLL_FADE_WIDTH = 32; // px, khớp bước 4px của dự án

function _updateScrollFade(el) {
  const max = el.scrollWidth - el.clientWidth;
  // Dưới 1px coi như không cuộn được: tránh mờ nhấp nháy do làm tròn subpixel.
  if (max <= 1) {
    el.style.setProperty("--fade-left", "0px");
    el.style.setProperty("--fade-right", "0px");
    return;
  }
  const left = el.scrollLeft;
  el.style.setProperty("--fade-left", left > 1 ? `${SCROLL_FADE_WIDTH}px` : "0px");
  el.style.setProperty(
    "--fade-right",
    left < max - 1 ? `${SCROLL_FADE_WIDTH}px` : "0px",
  );
}

function initScrollFade() {
  const els = document.querySelectorAll("[data-scroll-fade]");
  if (!els.length) return;

  els.forEach((el) => {
    _updateScrollFade(el);
    el.addEventListener("scroll", () => _updateScrollFade(el), {
      passive: true,
    });

    // Đổi cỡ chữ / xoay máy / font load xong đều làm đổi bề rộng nội dung.
    if ("ResizeObserver" in window) {
      const ro = new ResizeObserver(() => _updateScrollFade(el));
      ro.observe(el);
    }
  });

  window.addEventListener(
    "resize",
    () => els.forEach((el) => _updateScrollFade(el)),
    { passive: true },
  );

  // Font icon (Font Awesome) nạp xong mới biết bề rộng thật của tag.
  if (document.fonts?.ready) {
    document.fonts.ready.then(() => els.forEach(_updateScrollFade));
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initScrollFade);
} else {
  initScrollFade();
}

window.initScrollFade = initScrollFade;
