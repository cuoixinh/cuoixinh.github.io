// Popover của nút đôi "Tạo thiệp ngay" ở màn mở đầu (index.html): mũi tên mở
// danh sách cách tạo (AI / thủ công). Chỉ lo phần mở-đóng — hành động của từng
// mục vẫn là goCreateWithAi/goCreateDraft trong js/auth-nav.js.

function _heroCtaEls() {
  return {
    btn: document.getElementById("heroCtaMore"),
    menu: document.getElementById("heroCtaMenu"),
  };
}

function closeHeroCtaMenu() {
  const { btn, menu } = _heroCtaEls();
  if (!menu || menu.hidden) return;
  menu.hidden = true;
  btn?.setAttribute("aria-expanded", "false");
  btn?.classList.remove("is-open");
}

function toggleHeroCtaMenu(e) {
  e?.preventDefault();
  e?.stopPropagation();
  const { btn, menu } = _heroCtaEls();
  if (!menu) return;
  const open = menu.hidden;
  menu.hidden = !open;
  btn?.setAttribute("aria-expanded", String(open));
  btn?.classList.toggle("is-open", open);
}

// Bấm ra ngoài hoặc Esc thì đóng. Nghe ở document nên không cần gỡ.
document.addEventListener("click", (e) => {
  if (!e.target.closest?.(".hero-cta-split")) closeHeroCtaMenu();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeHeroCtaMenu();
});
