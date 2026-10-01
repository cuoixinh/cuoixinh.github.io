// Mục giới thiệu (#intro): tên gõ ở hai ô đổ vào mọi chỗ [data-intro="groom|bride"]
// của khung chat minh hoạ (thiệp trong link + lời mời), dựng lại địa chỉ link theo
// tên; dải "Đổi tông" đổi [data-tone] của thiệp minh hoạ (màu khai ở CSS).
(function () {
  const root = document.getElementById("intro");
  if (!root) return;
  const groom = document.getElementById("introGroom");
  const bride = document.getElementById("introBride");
  const mini = root.querySelector(".intro-mini");

  // "Thảo My" → "thaomy": bỏ dấu, đ → d, chỉ giữ chữ và số.
  function slugPart(s) {
    return s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/đ/gi, "d")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
  }

  function sync() {
    const g = groom.value.trim() || groom.placeholder;
    const b = bride.value.trim() || bride.placeholder;
    root.querySelectorAll('[data-intro="groom"]').forEach((el) => (el.textContent = g));
    root.querySelectorAll('[data-intro="bride"]').forEach((el) => (el.textContent = b));
    const url = root.querySelector('[data-intro="url"]');
    if (url) url.textContent = `cuoixinh.com/${slugPart(g)}-${slugPart(b)}`;
    // Nảy nhẹ tên trên thiệp mỗi lần gõ — gỡ rồi gắn lại class để chạy lại animation.
    mini.classList.remove("is-pop");
    void mini.offsetWidth;
    mini.classList.add("is-pop");
  }
  groom.addEventListener("input", sync);
  bride.addEventListener("input", sync);

  root.querySelectorAll(".intro-tone").forEach((btn) =>
    btn.addEventListener("click", () => {
      mini.dataset.tone = btn.dataset.tone;
      root.querySelectorAll(".intro-tone").forEach((b) => {
        b.classList.toggle("is-on", b === btn);
        b.setAttribute("aria-pressed", String(b === btn));
      });
    }),
  );
})();
