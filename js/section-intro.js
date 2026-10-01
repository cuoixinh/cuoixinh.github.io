// Mục giới thiệu (#intro): tên gõ ở hai ô đổ vào mọi chỗ [data-intro="groom|bride"]
// của phần minh hoạ (hai thiệp + thiệp trong link + lời mời), dựng lại địa chỉ link
// theo tên; dải "Đổi tông" đổi [data-tone] của mọi .intro-toned (màu khai ở CSS).
(function () {
  const root = document.getElementById("intro");
  if (!root) return;
  const groom = document.getElementById("introGroom");
  const bride = document.getElementById("introBride");
  const art = root.querySelector(".intro-art");

  // "Thảo My" → "thaomy": bỏ dấu, đ → d, chỉ giữ chữ và số.
  function slugPart(s) {
    return s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
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
    art.classList.remove("is-pop");
    void art.offsetWidth;
    art.classList.add("is-pop");
  }
  groom.addEventListener("input", sync);
  bride.addEventListener("input", sync);

  // Nút "Tạo thiệp của hai bạn": tên đã gõ (không lấy placeholder) mang sang thiệp
  // MỚI. Còn nháp dở thì cxStartDraft vẫn hỏi trước; chọn tiếp tục là tên bị bỏ qua.
  window.introCreateDraft = function (e) {
    const seed = {};
    if (groom.value.trim()) seed.groom_name = groom.value.trim();
    if (bride.value.trim()) seed.bride_name = bride.value.trim();
    goCreateDraft(e, null, Object.keys(seed).length ? seed : undefined);
  };

  root.querySelectorAll(".intro-tone").forEach((btn) =>
    btn.addEventListener("click", () => {
      root.querySelectorAll(".intro-toned").forEach((el) => (el.dataset.tone = btn.dataset.tone));
      root.querySelectorAll(".intro-tone").forEach((b) => {
        b.classList.toggle("is-on", b === btn);
        b.setAttribute("aria-pressed", String(b === btn));
      });
    }),
  );
})();
