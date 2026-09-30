// Navbar trên nằm trên dải tối của màn mở đầu (#hero) thì đặt cờ .is-on-hero
// cho #main-nav — CSS đổi thẻ trắng sang kính tối (styles/tailwind-src.css).
// Phải nạp SAU CXNavbar.mount() và chạy NGAY (không đợi DOMContentLoaded): đặt
// cờ trước nhịp vẽ đầu, không thì navbar hiện thẻ trắng một nhịp rồi mới tối.

(function () {
  // Tổng cao .cx-navbar (12 + 64 + 4): còn ≥ ngần này px của hero dưới đỉnh
  // màn thì navbar vẫn đang nằm trên dải tối.
  const NAV_H = 80;

  function start() {
    const nav = document.getElementById("main-nav");
    const hero = document.getElementById("hero");
    if (!nav || !hero) return;

    let queued = false;
    function sync() {
      queued = false;
      nav.classList.toggle(
        "is-on-hero",
        hero.getBoundingClientRect().bottom > NAV_H,
      );
    }
    function queue() {
      if (queued) return;
      queued = true;
      requestAnimationFrame(sync);
    }

    window.addEventListener("scroll", queue, { passive: true });
    window.addEventListener("resize", queue);
    sync();
  }

  start();
})();
