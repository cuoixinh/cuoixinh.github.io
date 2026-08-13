// Widget hỗ trợ: LUÔN hiện, xoay vòng câu chữ mỗi 3s kèm hiệu ứng "đang gõ".
// Không còn thu vào ghim ở mép phải — bấm X là tắt hẳn và nhớ luôn lựa chọn.
(function initSupportRotator() {
  var msgEl = document.getElementById("supportMsg");
  var typingEl = document.querySelector("#supportCard .support-typing");
  var widget = document.getElementById("chatWidget");
  if (!msgEl) return;

  // Lần trước đã tắt → gỡ ngay, đừng để chớp lên một nhịp rồi mới biến mất.
  var CHAT_HIDDEN_KEY = buildCacheKey("chat_hidden");
  if (widget && getCache(CHAT_HIDDEN_KEY)) {
    widget.remove();
    return;
  }
  var messages = [
    "Bạn cần tư vấn tạo thiệp?<br /><b>Nhắn cho mình nhé →</b>",
    "Có khó khăn gì không?<br /><b>Liên hệ chúng tôi →</b>",
    "Tư vấn miễn phí 24/7 💬",
    "Đội ngũ Cưới Xinh luôn<br /><b>sẵn sàng hỗ trợ bạn 💕</b>",
  ];
  var i = 0;
  function render(idx) {
    msgEl.innerHTML = messages[idx];
    msgEl.classList.remove("animate-msgIn");
    void msgEl.offsetWidth; // reflow để chạy lại animation
    msgEl.classList.add("animate-msgIn");
  }
  function showTyping(on) {
    if (!typingEl) return;
    typingEl.classList.toggle("hidden", !on);
    typingEl.classList.toggle("flex", on);
  }
  render(0);
  var rotTimer = setInterval(function () {
    msgEl.style.visibility = "hidden";
    showTyping(true);
    setTimeout(function () {
      showTyping(false);
      msgEl.style.visibility = "visible";
      i = (i + 1) % messages.length;
      render(i);
    }, 650);
  }, 3000);

  // Nút X: tắt HẲN bong bóng hỗ trợ và nhớ lựa chọn đó (không có ghim ở
  // mép phải để mở lại nữa) — xoá cache thì lần sau lại hiện.
  //
  // Bắt sự kiện ở DOCUMENT chứ không gắn thẳng vào #supportClose: <x-button>
  // TỰ THAY THẾ mình bằng <button> thật lúc DOMContentLoaded, mà file này chạy
  // ngay khi parse tới — gắn vào thẻ cũ thì listener biến mất cùng thẻ đó.
  document.addEventListener("click", function (e) {
    var btn = e.target.closest && e.target.closest("#supportClose");
    if (!btn || !widget) return;
    e.preventDefault();
    e.stopPropagation();
    clearInterval(rotTimer);
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
