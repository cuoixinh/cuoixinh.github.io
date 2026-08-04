// Thanh kéo dạng viên thuốc dùng chung. Bọc một <input type="range"> có sẵn
// trong DOM: input gốc được giữ nguyên nhưng trong suốt và đè lên trên (kéo,
// chạm, phím mũi tên vẫn chạy như native), phần nhìn thấy là track/fill do CSS
// vẽ — styles/_progress.css.

(function () {
  const defaultFormat = (v) => v + "%";

  function ratio(input) {
    const min = Number(input.min || 0);
    const max = Number(input.max ?? 100);
    const val = Number(input.value || 0);
    if (!(max > min)) return 0;
    return Math.min(1, Math.max(0, (val - min) / (max - min))) * 100;
  }

  // Đổi value/min/max bằng code không bắn sự kiện 'input' → phải gọi tay.
  function paint(input) {
    const wrap = input && input.closest && input.closest(".cx-prog");
    if (!wrap) return;
    wrap.style.setProperty("--cx-prog", ratio(input) + "%");
    const out = wrap.querySelector(".cx-prog-val");
    if (out)
      out.textContent = (wrap.__cxProgFormat || defaultFormat)(
        Number(input.value),
      );
  }

  // Gọi lại nhiều lần vô hại: đã bọc rồi thì chỉ cập nhật format và vẽ lại.
  // opts.format(value) → chuỗi hiện trong ô số bên trái.
  function attach(input, opts) {
    if (!input || !input.parentNode) return null;
    let wrap = input.closest(".cx-prog");
    if (!wrap) {
      wrap = document.createElement("div");
      wrap.className = "cx-prog";
      wrap.innerHTML =
        '<span class="cx-prog-val"></span>' +
        '<span class="cx-prog-track"><span class="cx-prog-fill"></span></span>';
      input.parentNode.insertBefore(wrap, input);
      wrap.appendChild(input);
      input.classList.add("cx-prog-input");
      input.addEventListener("input", () => paint(input));
    }
    if (opts && opts.format) wrap.__cxProgFormat = opts.format;
    paint(input);
    return wrap;
  }

  window.CXProgress = { attach, paint };
})();
