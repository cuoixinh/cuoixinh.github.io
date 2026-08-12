// Custom form controls — bọc trình bày, LUÔN render đúng <input>/DOM & id như cũ
// để mọi logic binding hiện có (FormData, fillForm, flatpickr, timepicker…) chạy
// nguyên vẹn. Nạp file này TRƯỚC index.js (custom element upgrade lúc parse).
(function () {
  const s = document.createElement("style");
  // x-date/x-time/x-textarea là field khối (thay <div> trong grid) → block.
  // x-switch/x-check nằm inline trong flex row → contents để không thêm hộp bao.
  s.textContent =
    "x-date,x-time,x-textarea{display:block}" +
    "x-switch,x-check{display:contents}" +
    // Nút "x" xoá nhanh trong x-textarea (chỉ hiện khi có nội dung, giống <x-input>).
    "x-textarea .x-ta-wrap{position:relative}" +
    "x-textarea .x-ta-clear{position:absolute;top:.5rem;right:.5rem;display:none;" +
    "align-items:center;justify-content:center;width:1.5rem;height:1.5rem;border-radius:.375rem;" +
    "color:rgb(var(--text-idle-rgb));background:transparent;transition:color .15s ease,background .15s ease}" +
    "x-textarea .x-ta-clear:hover{color:rgb(var(--text-secondary-rgb));background:rgb(var(--surface-control-rgb))}" +
    "x-textarea .x-ta-clear.show{display:inline-flex}";
  document.head.appendChild(s);
})();

const _DATE_CLS =
  "w-full h-10 px-3 py-2 border border-gray-200 rounded-md text-sm text-gray-800 " +
  "bg-white outline-none transition-all focus:ring-2 focus:ring-rose-500/30 focus:ring-offset-2";
const _TIME_CLS =
  "w-full h-10 px-3 py-2 border border-gray-200 rounded-md text-sm text-gray-800 " +
  "bg-white outline-none transition-all placeholder:text-gray-400/50 cursor-pointer " +
  "focus:ring-2 focus:ring-rose-500/30 focus:ring-offset-2";
// Khớp style textarea của <x-input> để thay thế 1:1 (rounded-lg, chừa lề phải pr-9).
const _TA_CLS =
  "w-full pl-3 pr-9 py-2 border border-gray-200 rounded-lg text-sm text-gray-800 " +
  "bg-white outline-none focus:ring-2 focus:ring-rose-500/30 " +
  "placeholder:text-gray-400/50 transition-all resize-none";
// SVG dấu "x" cho nút xoá của x-textarea (đặt tên riêng, tránh đụng _X_SVG ở x-input.js).
const _X_TA_CLEAR_SVG =
  `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" ` +
  `fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" ` +
  `stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`;

function _labelHtml(inputId, icon, label, required) {
  return `<label for="${inputId}" class="block text-sm text-gray-700 mb-2 flex items-center gap-2">
      ${icon ? `<i data-lucide="${icon}" class="text-color-secondary"></i>` : ""}<span>${label}${required ? ` <span class="text-rose-500">*</span>` : ""}</span>
    </label>`;
}

// ── <x-date> → <input type="date"> (flatpickr init ở index.js như cũ) ───────
//   bare         không tự vẽ <label> (nơi dùng đã có nhãn riêng)
//   input-class  thay class mặc định của ô input
class XDate extends HTMLElement {
  connectedCallback() {
    const name = this.getAttribute("name") || "";
    const label = this.getAttribute("label") || "";
    const icon = this.getAttribute("icon") || "calendar";
    const required = this.hasAttribute("required") ? "required" : "";
    const bare = this.hasAttribute("bare");
    const inputClass = this.getAttribute("input-class") || _DATE_CLS;
    const ownId = this.getAttribute("id");
    if (ownId) this.removeAttribute("id");
    const inputId = ownId || name;
    this.innerHTML =
      (bare ? "" : _labelHtml(inputId, icon, label, !!required)) +
      `<input type="date" name="${name}" id="${inputId}" ${required} class="${inputClass}" />`;
    if (!bare && icon && window.lucide) lucide.createIcons({ nodes: [this] });
    // Nếu được gắn SAU khi trang đã init xong (VD dựng động trong modal), tự khởi
    // tạo flatpickr bằng cấu hình CHUNG để mọi control ngày đồng nhất.
    if (
      window._weddingDateReady &&
      typeof window.createWeddingDatepicker === "function"
    ) {
      const inp = this.querySelector("input");
      if (inp && !inp._flatpickr) window.createWeddingDatepicker(inp);
    }
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
      _labelHtml(inputId, icon, label, this.hasAttribute("required")) +
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
        class="relative flex-shrink-0 inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 bg-rose-400">
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

// ── <x-textarea> → <textarea> + nút "x" xoá nhanh ──────────────────────────
//   label / icon / required   nhãn kèm dấu * đỏ; bỏ qua nếu có `bare`
//   bare / input-class        như <x-date>
//   height                    chiều cao ô (CSS height, mặc định 130px ≈ 6 dòng)
//   no-clear                  không hiện nút xoá
//   maxlength / placeholder / name / id và mọi data-* → chuyển thẳng xuống <textarea>
class XTextarea extends HTMLElement {
  connectedCallback() {
    const name = this.getAttribute("name") || "";
    const label = this.getAttribute("label") || "";
    const icon = this.getAttribute("icon") || "";
    const placeholder = this.getAttribute("placeholder") || "";
    // Chiều cao ô = 6 lần line-height của chữ (đơn vị lh tự bám line-height mỗi ô).
    const height = this.getAttribute("height") || "130px";
    const maxlength = this.getAttribute("maxlength");
    const required = this.hasAttribute("required");
    const bare = this.hasAttribute("bare");
    const noClear = this.hasAttribute("no-clear");
    const inputClass = this.getAttribute("input-class") || _TA_CLS;
    const ownId = this.getAttribute("id");
    if (ownId) this.removeAttribute("id");
    const inputId = ownId || name;
    const dataAttrs = Array.from(this.attributes)
      .filter((a) => a.name.startsWith("data-"))
      .map((a) => `${a.name}="${a.value}"`)
      .join(" ");

    // Nhãn theo đúng style của <x-input> (mb-1.5, gap-1.5, icon w-3.5) để đồng nhất
    // với các ô nhập text khác trong form.
    const labelHtml = label
      ? `<label for="${inputId}" class="block text-sm text-gray-700 mb-1.5 flex items-center gap-1.5">
           ${icon ? `<i data-lucide="${icon}" class="w-3.5 h-3.5 text-color-secondary flex-shrink-0"></i>` : ""}
           <span>${label}${required ? ` <span class="text-rose-500">*</span>` : ""}</span>
         </label>`
      : "";

    this.innerHTML =
      (bare ? "" : labelHtml) +
      `<div class="x-ta-wrap">
         <textarea name="${name}" id="${inputId}" style="height:${height}"
           ${maxlength ? `maxlength="${maxlength}"` : ""} ${required ? "required" : ""} ${dataAttrs}
           placeholder="${placeholder}" class="${inputClass}"></textarea>
         ${noClear ? "" : `<button type="button" class="x-ta-clear" aria-label="Xoá nội dung">${_X_TA_CLEAR_SVG}</button>`}
       </div>`;

    if (!bare && icon && window.lucide) lucide.createIcons({ nodes: [this] });

    const ta = this.querySelector("textarea");
    const clearBtn = this.querySelector(".x-ta-clear");
    if (clearBtn) {
      // Chừa lề phải cho nút "x" (đặt inline để thắng mọi input-class, VD .ai-inp).
      ta.style.paddingRight = "2.25rem";
      const sync = () => clearBtn.classList.toggle("show", !!ta.value);
      ta.addEventListener("input", sync);
      ta.addEventListener("change", sync);
      clearBtn.addEventListener("click", () => {
        ta.value = "";
        ta.focus();
        ta.dispatchEvent(new Event("input", { bubbles: true }));
      });
      sync();
      // Cho phép nơi dùng đồng bộ nút xoá sau khi gán value bằng code.
      this.syncClearBtn = sync;
    }
  }
}

customElements.define("x-date", XDate);
customElements.define("x-time", XTime);
customElements.define("x-textarea", XTextarea);
customElements.define("x-switch", XSwitch);
customElements.define("x-check", XCheck);
