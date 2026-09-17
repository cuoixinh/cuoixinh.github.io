// Đảo ảnh mẫu thiệp trong khung điện thoại ở màn mở đầu (#hero-slides).
// Chỉ đổi cờ .is-on, phần mờ chồng do .hero-slide trong styles/tailwind-src.css lo.

(function () {
  const EVERY_MS = 3800;
  // Cùng mốc với .hero-show ở styles/tailwind-src.css — dưới mốc này cột sản
  // phẩm không hiện nên đừng tải ảnh của nó. Đổi mốc thì đổi cả hai chỗ.
  const WIDE = "(min-width: 1024px)";

  // Ảnh giữ đường dẫn thật ở data-src cho tới khi màn đủ rộng.
  function loadSlides(slides) {
    slides.forEach((img) => {
      if (!img.dataset.src) return;
      img.src = img.dataset.src;
      img.removeAttribute("data-src");
    });
  }

  function start() {
    const box = document.getElementById("hero-slides");
    if (!box) return;
    const slides = box.querySelectorAll(".hero-slide");
    if (slides.length < 2) return;

    // Xoay ngang máy tính bảng / kéo rộng cửa sổ thì mới tải, không thì thôi.
    const mq = window.matchMedia(WIDE);
    const syncSrc = () => {
      if (mq.matches) loadSlides(slides);
    };
    mq.addEventListener("change", syncSrc);
    syncSrc();

    // Máy xin giảm chuyển động thì để yên tấm đầu.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let i = 0;
    let timer = null;

    function tick() {
      slides[i].classList.remove("is-on");
      i = (i + 1) % slides.length;
      slides[i].classList.add("is-on");
    }

    // Tab ẩn thì dừng: đảo ảnh sau lưng người dùng chỉ tốn pin.
    function sync() {
      if (document.hidden) {
        clearInterval(timer);
        timer = null;
      } else if (!timer) {
        timer = setInterval(tick, EVERY_MS);
      }
    }

    document.addEventListener("visibilitychange", sync);
    sync();
  }

  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
