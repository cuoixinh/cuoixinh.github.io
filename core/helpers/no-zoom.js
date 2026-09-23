// Chặn phóng to trang trên điện thoại (chụm hai ngón · chạm đúp). Tự chạy khi nạp.
// Safari iOS BỎ QUA `user-scalable=no` của thẻ viewport nên phải chặn bằng sự kiện.
// Trang nào nạp core/utils.js thì tự có (utils.js kéo file này theo); trang không
// nạp utils.js (trang chủ) thì tự thêm thẻ script. Lightbox mở zoom tạm bằng thẻ viewport.
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
