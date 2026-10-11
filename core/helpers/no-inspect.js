// Chặn chuột phải + phím tắt mở DevTools / xem nguồn (F12, Ctrl+Shift+I/J/C, Ctrl+U, bản
// Cmd+Option trên Mac) với người dùng phổ thông. KHÔNG phải bảo mật: mở DevTools từ menu
// trình duyệt vẫn được. Tự chạy khi nạp; mọi trang index.html ra web khai thẻ script này
// cạnh no-zoom.js. Bỏ qua ở localhost, và khi CONFIG.noInspect === false (staging) — cờ
// đọc lúc có sự kiện vì file này nạp trong <head>, trước config.js.
(function () {
  if (window.__cxNoInspect) return;
  window.__cxNoInspect = true;
  if (/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)) return;
  const off = () => typeof CONFIG !== "undefined" && CONFIG.noInspect === false;

  // Ô nhập vẫn giữ menu chuột phải (dán, sửa chính tả).
  document.addEventListener("contextmenu", function (e) {
    if (off()) return;
    const t = e.target;
    if (t && t.closest && t.closest("input, textarea, [contenteditable]:not([contenteditable='false'])")) return;
    e.preventDefault();
  });

  // Dùng e.code: trên Mac giữ Option thì e.key thành ký tự đặc biệt.
  const DEV_KEYS = ["KeyI", "KeyJ", "KeyC"];
  document.addEventListener(
    "keydown",
    function (e) {
      if (off()) return;
      const mod = e.ctrlKey || e.metaKey;
      const block =
        e.key === "F12" ||
        (mod && e.shiftKey && DEV_KEYS.indexOf(e.code) >= 0) ||
        (e.metaKey && e.altKey && (DEV_KEYS.indexOf(e.code) >= 0 || e.code === "KeyU")) ||
        (mod && !e.shiftKey && !e.altKey && e.code === "KeyU");
      if (!block) return;
      e.preventDefault();
      e.stopPropagation();
    },
    true,
  );
})();
