// ============================================================================
// Custom form controls — bọc trình bày, LUÔN render đúng <input>/DOM & id như cũ
// để mọi logic binding hiện có (FormData, fillForm, flatpickr, timepicker,
// toggleSectionVis, togglePartySameLoc…) chạy nguyên vẹn.
// Nạp file này TRƯỚC index.js (custom element upgrade đồng bộ lúc parse).
// ============================================================================
(function () {
  const s = document.createElement("style");
  // x-date/x-time là field khối (thay <div> trong grid) → block.
  // x-switch/x-check nằm inline trong flex row → contents để không thêm hộp bao.
  s.textContent = "x-date,x-time{display:block}x-switch,x-check{display:contents}";
  document.head.appendChild(s);
})();

const _DATE_CLS =
  "w-full h-10 px-3 py-2 border border-gray-200 rounded-md text-sm text-gray-800 " +
  "bg-white outline-none transition-all focus:ring-2 focus:ring-rose-500/30 focus:ring-offset-2";
const _TIME_CLS =
  "w-full h-10 px-3 py-2 border border-gray-200 rounded-md text-sm text-gray-800 " +
  "bg-white outline-none transition-all placeholder:text-gray-400/50 cursor-pointer " +
  "focus:ring-2 focus:ring-rose-500/30 focus:ring-offset-2";

function _labelHtml(inputId, icon, label) {
  return `<label for="${inputId}" class="block text-sm text-gray-700 mb-2 flex items-center gap-2">
      ${icon ? `<i data-lucide="${icon}" class="text-color-secondary"></i>` : ""}${label}
    </label>`;
}

// ── <x-date> → <input type="date"> (flatpickr được init bởi index.js như cũ) ──
class XDate extends HTMLElement {
  connectedCallback() {
    const name = this.getAttribute("name") || "";
    const label = this.getAttribute("label") || "";
    const icon = this.getAttribute("icon") || "calendar";
    const required = this.hasAttribute("required") ? "required" : "";
    const ownId = this.getAttribute("id");
    if (ownId) this.removeAttribute("id");
    const inputId = ownId || name;
    this.innerHTML =
      _labelHtml(inputId, icon, label) +
      `<input type="date" name="${name}" id="${inputId}" ${required} class="${_DATE_CLS}" />`;
    if (icon && window.lucide) lucide.createIcons({ nodes: [this] });
  }
}

// ── <x-time> → <input data-timepicker readonly> (openTimePicker gắn bởi index.js) ──
class XTime extends HTMLElement {
  connectedCallback() {
    const name = this.getAttribute("name") || "";
    const label = this.getAttribute("label") || "";
    const icon = this.getAttribute("icon") || "clock";
    const placeholder = this.getAttribute("placeholder") || "Chọn giờ...";
    const ownId = this.getAttribute("id");
    if (ownId) this.removeAttribute("id");
    const inputId = ownId || name;
    this.innerHTML =
      _labelHtml(inputId, icon, label) +
      `<input type="text" name="${name}" id="${inputId}" data-timepicker readonly
         placeholder="${placeholder}" class="${_TIME_CLS}" />`;
    if (icon && window.lucide) lucide.createIcons({ nodes: [this] });
  }
}

// ── <x-switch> → button+knob với id vis-btn-{key}/vis-knob-{key} (logic vis giữ nguyên) ──
// Trạng thái bật/tắt vẫn do hidden input enable_* + _updateVisUI/_initVisToggles quản lý.
class XSwitch extends HTMLElement {
  connectedCallback() {
    const key = this.getAttribute("key") || "";
    const onclick = this.getAttribute("onclick") || "";
    // Mặc định hiển thị trạng thái bật; _updateVisUI/_initVisToggles sẽ đồng bộ ngay khi load.
    this.innerHTML = `
      <button type="button" id="vis-btn-${key}" ${onclick ? `onclick="${onclick}"` : ""}
        class="relative flex-shrink-0 inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 bg-rose-500">
        <span id="vis-knob-${key}"
          class="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 translate-x-6"></span>
      </button>`;
  }
}

// ── <x-check> → checkbox tuỳ biến (hướng B: component sở hữu trạng thái + phát "change") ──
// id inner giữ nguyên {key}-btn/{key}-box/{key}-icon để code cũ (nếu có) vẫn tra được.
class XCheck extends HTMLElement {
  connectedCallback() {
    const key = this.getAttribute("key") || "";
    const label = this.getAttribute("label") || "";
    const onchange = this.getAttribute("onchange") || "";
    const checked = this.hasAttribute("checked");
    this.innerHTML = `
      <button type="button" id="${key}-btn" data-active="${checked}"
        class="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border ${checked ? "border-rose-200 bg-rose-50/70" : "border-gray-100 bg-gray-50/60"} cursor-pointer transition-all text-left hover:border-rose-200 hover:bg-rose-50/40">
        <span id="${key}-box"
          class="flex-shrink-0 w-5 h-5 rounded-md border-2 ${checked ? "border-rose-500 bg-rose-500" : "border-gray-400 bg-white"} flex items-center justify-center transition-all">
          <svg id="${key}-icon" class="w-3 h-3 text-white ${checked ? "" : "hidden"}"
            xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </span>
        <span class="text-sm font-medium text-gray-700">${label}</span>
      </button>`;
    // Chạy handler onchange thủ công cho ổn định (không phụ thuộc trình duyệt tự wire attribute
    // content event-handler trên custom element). Gỡ attribute để tránh bị fire trùng.
    this.removeAttribute("onchange");
    this._onchange = onchange ? new Function("event", onchange) : null;
    this.querySelector("button").addEventListener("click", (e) => {
      this.checked = !this.checked;
      if (this._onchange) this._onchange.call(this, e);
      this.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }

  get checked() {
    return this.querySelector("button")?.dataset.active === "true";
  }
  set checked(v) {
    const btn = this.querySelector("button");
    if (!btn) return;
    const box = this.querySelector('[id$="-box"]');
    const icon = this.querySelector("svg");
    btn.dataset.active = String(!!v);
    btn.classList.toggle("border-rose-200", !!v);
    btn.classList.toggle("bg-rose-50/70", !!v);
    btn.classList.toggle("border-gray-100", !v);
    btn.classList.toggle("bg-gray-50/60", !v);
    if (box) {
      box.classList.toggle("border-rose-500", !!v);
      box.classList.toggle("bg-rose-500", !!v);
      box.classList.toggle("border-gray-400", !v);
      box.classList.toggle("bg-white", !v);
    }
    if (icon) icon.classList.toggle("hidden", !v);
  }
}

customElements.define("x-date", XDate);
customElements.define("x-time", XTime);
customElements.define("x-switch", XSwitch);
customElements.define("x-check", XCheck);
