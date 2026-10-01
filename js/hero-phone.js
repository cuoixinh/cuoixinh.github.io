// Khung iPhone ở màn mở đầu (từ lg): mỗi HERO_PHONE_MS đổi sang ảnh mẫu thiệp kế
// tiếp, mờ chéo bằng CSS (.hero-phone-shot.is-on). Tấm kế được gán src TRƯỚC một
// lượt để lúc tới phiên đã tải xong. Dưới lg (khung ẩn) và khi tab ẩn thì đứng yên.
(function () {
  const HERO_PHONE_MS = 4000;
  const shots = [...document.querySelectorAll(".hero-phone-shot")];
  if (shots.length < 2) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const wide = window.matchMedia("(min-width: 1024px)");
  let cur = 0;

  function prime(img) {
    if (img.dataset.src) {
      img.src = img.dataset.src;
      delete img.dataset.src;
    }
  }

  setInterval(() => {
    if (!wide.matches || document.hidden) return;
    const next = (cur + 1) % shots.length;
    // Tấm kế chưa tải xong (mạng chậm) thì giữ tấm hiện tại thêm một lượt.
    if (shots[next].dataset.src || !shots[next].complete) {
      prime(shots[next]);
      return;
    }
    shots[cur].classList.remove("is-on");
    shots[next].classList.add("is-on");
    cur = next;
    prime(shots[(cur + 1) % shots.length]);
  }, HERO_PHONE_MS);

  // Nạp sẵn tấm thứ hai ngay khi khung hiện ra.
  if (wide.matches) prime(shots[1]);
  else wide.addEventListener("change", (e) => e.matches && prime(shots[1]), { once: true });
})();
