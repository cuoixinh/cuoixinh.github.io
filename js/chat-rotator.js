// Widget hỗ trợ: chỉ một bong bóng Messenger + nút X. Bấm X là tắt HẲN và nhớ
// lựa chọn đó (không có ghim ở mép phải để mở lại) — xoá cache thì lần sau lại hiện.
(function initSupportBubble() {
  var widget = document.getElementById("chatWidget");
  if (!widget) return;

  // Lần trước đã tắt → gỡ ngay, đừng để chớp lên một nhịp rồi mới biến mất.
  var CHAT_HIDDEN_KEY = buildCacheKey("chat_hidden");
  if (getCache(CHAT_HIDDEN_KEY)) {
    widget.remove();
    return;
  }

  // Bắt sự kiện ở DOCUMENT chứ không gắn thẳng vào #supportClose: <x-button>
  // TỰ THAY THẾ mình bằng <button> thật lúc DOMContentLoaded, mà file này chạy
  // ngay khi parse tới — gắn vào thẻ cũ thì listener biến mất cùng thẻ đó.
  document.addEventListener("click", function (e) {
    var btn = e.target.closest && e.target.closest("#supportClose");
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    widget.remove();
    setCache(CHAT_HIDDEN_KEY, true);
  });

  // Mới vào chưa hiện; cuộn quá nửa màn mới thả bong bóng ra.
  widget.classList.add("is-away");
  function _revealChat() {
    if ((window.scrollY || 0) < window.innerHeight * 0.5) return;
    widget.classList.remove("is-away");
    window.removeEventListener("scroll", _revealChat);
  }
  window.addEventListener("scroll", _revealChat, { passive: true });
  _revealChat();
})();
