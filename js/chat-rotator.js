// Widget hỗ trợ: xoay vòng câu chữ mỗi 3s, kèm hiệu ứng "đang gõ"
(function initSupportRotator() {
  var msgEl = document.getElementById("supportMsg");
  var typingEl = document.querySelector("#supportCard .support-typing");
  if (!msgEl) return;
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

  // Nút X: đóng thẻ hỗ trợ, thu vào pin tab ở mép phải (mọi kích thước
  // màn hình) — vẫn mở lại được qua click/vuốt vào pin tab.
  var closeBtn = document.getElementById("supportClose");
  var widget = document.getElementById("chatWidget");
  if (closeBtn) {
    closeBtn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      clearInterval(rotTimer);
      if (typeof window.__cxChatCollapse === "function") {
        window.__cxChatCollapse();
      } else if (widget) {
        widget.style.display = "none";
      }
    });
  }
})();
