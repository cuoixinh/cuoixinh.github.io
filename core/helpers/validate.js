/**
 * Validate form: gọi validateForm(formEl) trước khi lưu. Đánh dấu ô bắt buộc
 * bằng thuộc tính `required` trên input.
 */

(function _initValidation() {
  const style = document.createElement("style");
  style.textContent = `
    .cx-req-star {
      color: #f43f5e;
      font-weight: 600;
      margin-left: 2px;
    }
    .cx-field-err-msg {
      display: none;
      font-size: 11px;
      color: #f43f5e;
      margin-top: 4px;
    }
    .cx-field-invalid .cx-field-err-msg {
      display: block;
    }
    .cx-field-invalid > input,
    .cx-field-invalid > textarea,
    .cx-field-invalid > select {
      border-color: #f43f5e !important;
      box-shadow: 0 0 0 2px rgba(244,63,94,.15) !important;
    }
  `;
  document.head.appendChild(style);

  // Trang nạp DOM động (invitation-setup) chèn script sau khi DOMContentLoaded đã
  // bắn. Hàng đợi của loader chạy sau khi mọi script đã nạp — cần vậy vì [required]
  // phần lớn nằm trong <x-input>, chỉ tồn tại sau khi x-input.js upgrade component.
  if (window.__cxOnReady) {
    window.__cxOnReady(_setup);
  } else if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", _setup);
  } else {
    _setup();
  }
})();

function _setup() {
  document.querySelectorAll("[required]").forEach((input) => {
    // flatpickr altInput có required nhưng không có name — bỏ qua
    if (!input.name) return;

    // Add * to the preceding label — CHỈ khi nhãn chưa có dấu * sẵn. Web component
    // x-* (x-input/x-date/x-textarea) tự render * khi required; nếu ở đây thêm nữa sẽ
    // thành "**" (VD label "Ngày cưới" của <x-date>).
    const label = input.previousElementSibling;
    if (label && (label.tagName === "LABEL" || label.tagName === "P")) {
      const hasStar =
        label.querySelector(".cx-req-star, .text-rose-500") ||
        label.textContent.includes("*");
      if (!hasStar) {
        const star = document.createElement("span");
        star.className = "cx-req-star";
        star.textContent = "*";
        label.appendChild(star);
      }
    }

    // Insert error message node after input
    const msg = document.createElement("p");
    msg.className = "cx-field-err-msg";
    msg.textContent = "Không được để trống";
    input.insertAdjacentElement("afterend", msg);

    // Clear error on input
    input.addEventListener("input", () => _clearError(input));
    input.addEventListener("change", () => _clearError(input));
  });
}

function _setError(input) {
  const wrap = input.parentElement;
  if (wrap) wrap.classList.add("cx-field-invalid");
}

function _clearError(input) {
  const wrap = input.parentElement;
  if (wrap) wrap.classList.remove("cx-field-invalid");
}

function _expandSection(input) {
  const formPanel = document.getElementById("form-panel");
  if (formPanel && formPanel.classList.contains("hidden")) {
    window.switchTab?.("edit");
  }

  let el = input.parentElement;
  while (el && el !== document.body) {
    if (el.classList.contains("hidden") && el.id && el.id.includes("-body")) {
      el.classList.remove("hidden");
    }
    el = el.parentElement;
  }
}

/** Kiểm tra giá trị cho từng input, kể cả flatpickr date */
function _isEmpty(input) {
  // flatpickr ẩn input gốc (display:none) — đọc qua instance
  const fp = window.flatpickrInstances && window.flatpickrInstances[input.name];
  if (fp) {
    return !fp.selectedDates || fp.selectedDates.length === 0;
  }
  return !input.value || !input.value.trim();
}

/**
 * Validate mọi ô [required] có name; mở section đang gập và cuộn tới ô sai đầu
 * tiên. Trả true nếu hợp lệ hết.
 */
function validateForm(formEl) {
  const fields = [...(formEl || document).querySelectorAll("[required]")]
    .filter(input => input.name && !input.tagName.includes('-')); // bỏ qua custom elements và flatpickr altInput

  let firstInvalid = null;

  fields.forEach((input) => {
    if (_isEmpty(input)) {
      _setError(input);
      if (!firstInvalid) firstInvalid = input;
    } else {
      _clearError(input);
    }
  });

  if (firstInvalid) {
    _expandSection(firstInvalid);
    setTimeout(() => {
      let absTop = 0;
      // Flatpickr ẩn input gốc (display:none) — traverse lên parent visible
      let scrollEl = firstInvalid;
      while (scrollEl && getComputedStyle(scrollEl).display === 'none') {
        scrollEl = scrollEl.parentElement;
      }
      let node = scrollEl || firstInvalid;
      while (node) { absTop += node.offsetTop; node = node.offsetParent; }
      const targetY = Math.max(0, absTop - 120);
      const startY  = Math.max(
        document.documentElement.scrollTop,
        document.body.scrollTop,
        window.pageYOffset || 0
      );
      const diff     = targetY - startY;
      const duration = 450;
      const t0       = performance.now();
      function step(now) {
        const p    = Math.min((now - t0) / duration, 1);
        const ease = p < 0.5 ? 2 * p * p : -1 + (4 - 2 * p) * p;
        const y    = startY + diff * ease;
        document.documentElement.scrollTop = y;
        document.body.scrollTop            = y;
        if (p < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
      firstInvalid.focus({ preventScroll: true });
    }, 100);
    return false;
  }
  return true;
}
