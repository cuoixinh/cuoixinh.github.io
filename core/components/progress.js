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

  // Ô bấm của input phải TRÙNG KHÍT thanh track nhìn thấy. Nhãn số nằm bên
  // trái đẩy track thụt vào ~60px; input trùm cả viên thuốc thì chỗ ngón tay
  // đặt và giá trị nhận được lệch nhau tới 16 điểm — đó là cảm giác "phải chạm
  // đúng điểm". Đo bằng JS chứ không viết số cứng: nhãn số rộng hẹp theo nội
  // dung và theo lớp utility của từng chỗ dùng.
  function layout(input) {
    const wrap = input && input.closest && input.closest(".cx-prog");
    const track = wrap && wrap.querySelector(".cx-prog-track");
    if (!track || !wrap.clientWidth) return;
    const lead = track.offsetLeft;
    wrap.style.setProperty("--cx-prog-lead", lead + "px");
    wrap.style.setProperty(
      "--cx-prog-tail",
      Math.max(0, wrap.clientWidth - lead - track.offsetWidth) + "px",
    );
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

  // Giá trị ứng với một điểm trên màn: quy đổi theo THANH TRACK nhìn thấy rồi
  // bắt về đúng nấc `step`.
  function valueAt(input, clientX) {
    const wrap = input.closest(".cx-prog");
    const track = wrap && wrap.querySelector(".cx-prog-track");
    if (!track) return null;
    const r = track.getBoundingClientRect();
    if (!r.width) return null;
    const min = Number(input.min || 0);
    const max = Number(input.max ?? 100);
    const step = Number(input.step) > 0 ? Number(input.step) : 1;
    const t = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    const v = min + t * (max - min);
    return Math.min(max, Math.max(min, Math.round(v / step) * step));
  }

  // TỰ cầm cú kéo thay vì trông vào hành vi sẵn có của <input type=range>.
  // Lý do: ngón tay thật không đi ngang tuyệt đối, luôn rung lên xuống; hễ nó
  // lệch ra khỏi ô cao 40px của input là trình duyệt bỏ luôn cú kéo — chạm thì
  // ăn mà kéo thì thanh đứng im. setPointerCapture giữ mọi cú di chuyển về đúng
  // input, kéo ra giữa màn hình vẫn bám.
  //
  // Bàn phím (mũi tên) vẫn để native lo: nó tự bắn input/change như thường.
  function bindDrag(input) {
    let on = false;
    const apply = (e) => {
      const v = valueAt(input, e.clientX);
      if (v == null || String(v) === input.value) return;
      input.value = String(v);
      paint(input);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    };
    input.addEventListener("pointerdown", (e) => {
      if (e.button != null && e.button !== 0) return;
      on = true;
      // Chặn hành vi kéo sẵn có để hai bên không cùng đặt giá trị; focus phải
      // gọi tay vì preventDefault lấy mất.
      e.preventDefault();
      input.focus({ preventScroll: true }); // preventScroll: đừng giật khung cuộn
      try {
        input.setPointerCapture(e.pointerId);
      } catch (err) {
        /* trình duyệt không cho bắt thì vẫn chạy được nhờ listener bên dưới */
      }
      apply(e);
    });
    input.addEventListener("pointermove", (e) => {
      if (on) apply(e);
    });
    const end = (e) => {
      if (!on) return;
      on = false;
      try {
        input.releasePointerCapture(e.pointerId);
      } catch (err) {
        /* đã nhả rồi */
      }
      input.dispatchEvent(new Event("change", { bubbles: true }));
    };
    input.addEventListener("pointerup", end);
    input.addEventListener("pointercancel", end);
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
      bindDrag(input);
      // Khổ đổi mà không resize cửa sổ (mở panel, đổi nhãn số) → tự đo lại.
      if (window.ResizeObserver)
        new ResizeObserver(() => layout(input)).observe(wrap);
    }
    if (opts && opts.format) wrap.__cxProgFormat = opts.format;
    paint(input);
    layout(input);
    return wrap;
  }

  window.CXProgress = { attach, paint };
})();
