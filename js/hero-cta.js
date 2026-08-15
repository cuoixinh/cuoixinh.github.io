// Nút đôi "Tạo thiệp ngay" ở màn mở đầu (index.html): mũi tên mở #heroCtaMenu —
// một <x-popover> (core/x-popover.js) tự lo neo, mũi tên, đóng khi bấm ra ngoài
// / Esc / chọn một mục. Ở đây chỉ dội trạng thái mở về nút để xoay chevron;
// hành động của từng mục vẫn là goCreateDraft/goCreateWithAi/goCreateWithVoice
// trong js/auth-nav.js.

(function _heroCtaInit() {
  const start = () => {
    const menu = document.getElementById("heroCtaMenu");
    const btn = document.getElementById("heroCtaMore");
    if (!menu || !btn) return;
    menu.addEventListener("open", () => btn.classList.add("is-open"));
    menu.addEventListener("close", () => btn.classList.remove("is-open"));
  };
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
