// Chặn phóng to trang trên điện thoại (chụm hai ngón · chạm đúp). Tự chạy khi nạp.
// Safari iOS BỎ QUA `user-scalable=no` của thẻ viewport nên phải chặn bằng sự kiện.
// MỌI trang index.html khai thẻ script này trong <head> — trang mới cũng phải thêm.
// Lightbox của thiệp mở zoom tạm bằng cách đổi thẻ viewport.
(function () {
  if (window.__cxNoZoom) return;
  window.__cxNoZoom = true;

  const opts = { passive: false };
  ["gesturestart", "gesturechange", "gestureend"].forEach(function (t) {
    document.addEventListener(t, function (e) { e.preventDefault(); }, opts);
  });
  document.addEventListener("touchmove", function (e) {
    if (e.touches.length > 1) e.preventDefault();
  }, opts);
  document.addEventListener("dblclick", function (e) { e.preventDefault(); });
  document.documentElement.style.touchAction = "manipulation";

  // iOS Safari: bàn phím ảo đóng lại mà khung nhìn còn kẹt ở mức zoom → trả về.
  document.addEventListener("focusout", function () {
    window.setTimeout(function () {
      window.scrollTo(window.pageXOffset, window.pageYOffset);
    }, 100);
  });
})();
