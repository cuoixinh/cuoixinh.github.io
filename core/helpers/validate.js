/**
 * validate.js — Form validation helper
 * Usage: call validateForm(formEl) before saving; returns true if valid.
 * Mark required fields with the `required` attribute on the input.
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

  document.addEventListener("DOMContentLoaded", _setup);
})();

function _setup() {
  document.querySelectorAll("[required]").forEach((input) => {
    // flatpickr altInput có required nhưng không có name — bỏ qua
    if (!input.name) return;

    // Add * to the preceding label
    const label = input.previousElementSibling;
    if (label && (label.tagName === "LABEL" || label.tagName === "P")) {
      const star = document.createElement("span");
      star.className = "cx-req-star";
      star.textContent = "*";
      label.appendChild(star);
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

/** Mở accordion section chứa input nếu đang đóng */
function _expandSection(input) {
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
 * Validates all [required] inputs that have a name attribute.
 * Opens collapsed sections and scrolls to first invalid field.
 * @param {HTMLElement} formEl
 * @returns {boolean} true if all valid
 */
function validateForm(formEl) {
  const fields = [...(formEl || document).querySelectorAll("[required]")]
    .filter(input => input.name); // bỏ qua flatpickr altInput (không có name)

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
      firstInvalid.scrollIntoView({ behavior: "smooth", block: "center" });
      firstInvalid.focus();
    }, 150); // chờ section mở animation xong
    return false;
  }
  return true;
}
