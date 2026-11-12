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
    "x-textarea .x-ta-clear.show{display:inline-flex}" +
    // Skeleton phủ ĐÚNG hình chữ nhật của <textarea> lúc đang chờ (setLoading).
    ".x-ta-skeleton{position:absolute;z-index:5;display:flex;flex-direction:column;" +
    "gap:10px;padding:12px 14px;border-radius:8px;background:rgb(var(--white-rgb));overflow:hidden;" +
    "box-sizing:border-box;pointer-events:none}" +
    ".x-ta-skeleton span{height:11px;border-radius:6px;" +
    "background:linear-gradient(90deg,rgb(var(--skeleton-base-rgb)) 25%,rgb(var(--skeleton-shine-rgb)) 37%,rgb(var(--skeleton-base-rgb)) 63%);" +
    "background-size:400% 100%;animation:x-ta-sk 1.4s ease infinite}" +
    ".x-ta-skeleton span:nth-child(3n+1){width:92%}" +
    ".x-ta-skeleton span:nth-child(3n+2){width:78%}" +
    ".x-ta-skeleton span:nth-child(3n){width:64%}" +
    "@keyframes x-ta-sk{0%{background-position:100% 50%}100%{background-position:0 50%}}";
  document.head.appendChild(s);
})();

const _DATE_CLS =
  "w-full h-10 px-3 py-2 border border-gray-200 rounded-md text-sm text-gray-800 " +
  "bg-white outline-none transition-all focus:border-gray-400";
const _TIME_CLS =
  "w-full h-10 px-3 py-2 border border-gray-200 rounded-md text-sm text-gray-800 " +
  "bg-white outline-none transition-all placeholder:text-gray-400/50 cursor-pointer " +
  "focus:border-gray-400";
// Khớp style textarea của <x-input> để thay thế 1:1 (rounded-lg, chừa lề phải pr-9).
const _TA_CLS =
  "w-full pl-3 pr-9 py-2 border border-gray-200 rounded-lg text-sm text-gray-800 " +
  "bg-white outline-none focus:border-gray-400 " +
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

// Bảng chọn THÁNG của <x-date level="month">: năm + ‹ › ở đầu, lưới 12 tháng (style .x-mp-* ở
// styles/_common.css). SVG viết tay để không phụ thuộc lucide có mặt trên trang hay không.
const _XM_PATH = { l: '<path d="m15 18-6-6 6-6"/>', r: '<path d="m9 18 6-6-6-6"/>', d: '<path d="m6 9 6 6 6-6"/>' };
const _xmSvg = (k, cls = "") =>
  `<svg class="${cls}" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" ` +
  `stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${_XM_PATH[k]}</svg>`;
const _XM_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const _xmNow = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
const _xmName = (v) => `Tháng ${Number(v.slice(5))}, ${v.slice(0, 4)}`;
const _XM_BTN_CLS = _DATE_CLS + " flex items-center justify-between gap-2 text-left cursor-pointer";

// ── <x-date> → <input type="date"> (flatpickr init ở index.js như cũ) ───────
//   bare         không tự vẽ <label> (nơi dùng đã có nhãn riêng)
//   input-class  thay class mặc định của ô input
//   level="month" chọn THÁNG (giá trị YYYY-MM) bằng bảng tự dựng trong <x-popover> (trang phải nạp
//                core/x-popover.js) — nhánh riêng, không qua flatpickr, không đổi gì chế độ ngày.
//                Thêm: value · min · max (YYYY-MM, "now" = tháng hiện tại) · align (start|center|end).
//                Đọc/ghi qua el.value; chọn tháng phát sự kiện "change" trên chính <x-date>;
//                input-class lúc này là class của NÚT mở; id giữ ở <x-date>, name ở ô hidden.
class XDate extends HTMLElement {
  connectedCallback() {
    if (this.getAttribute("level") === "month") return this._monthBuild();
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
    if (!bare && icon && window.lucide) lucide.createIcons({ root: this });
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

  // ── level="month" ── (dựng một lần; gỡ ra gắn lại không dựng lại để giữ giá trị)
  _monthBuild() {
    if (this._xm) return;
    const name = this.getAttribute("name") || "";
    const label = this.getAttribute("label") || "";
    const bare = this.hasAttribute("bare");
    const btnId = `${this.id || name || "x-month"}-btn`;
    this.innerHTML =
      (bare ? "" : _labelHtml(btnId, this.getAttribute("icon") || "calendar", label, this.hasAttribute("required"))) +
      `<button type="button" id="${btnId}" class="${this.getAttribute("input-class") || _XM_BTN_CLS}" aria-haspopup="dialog" aria-expanded="false">` +
      `<span class="x-mp-label"></span>${_xmSvg("d", "x-mp-caret")}</button>` +
      `<input type="hidden"${name ? ` name="${name}"` : ""} />` +
      `<x-popover placement="bottom" align="${this.getAttribute("align") || "start"}" arrow width="296" keep-open role="dialog" aria-label="${label || "Chọn tháng"}"></x-popover>`;
    if (!bare && window.lucide) lucide.createIcons({ root: this });
    const btn = this.querySelector("button");
    const pop = this.querySelector("x-popover");
    this._xm = { btn, pop, input: this.querySelector("input"), year: 0 };
    // `value` chỉ gắn lên thẻ chế độ tháng — <x-date> chế độ ngày giữ nguyên như cũ (không có thuộc tính này).
    Object.defineProperty(this, "value", {
      configurable: true,
      get: () => this._xm.value,
      set: (v) => this._monthSet(v),
    });
    this._monthSet(this.getAttribute("value") || _xmNow());
    btn.addEventListener("click", () => {
      if (pop.isOpen) return pop.close();
      this._xm.year = Number(this.value.slice(0, 4));
      this._monthFill();
      pop.open(btn);
      pop.querySelector(".is-on, [data-month]:not([disabled])")?.focus();
    });
    pop.addEventListener("click", (e) => {
      const y = e.target.closest("[data-year]");
      if (y && !y.disabled) {
        this._xm.year += Number(y.dataset.year);
        return this._monthFill();
      }
      const m = e.target.closest("[data-month]");
      if (!m || m.disabled) return;
      pop.close();
      btn.focus();
      if (m.dataset.month === this.value) return;
      this._monthSet(m.dataset.month);
      this.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }

  _monthBound(attr) {
    const v = this.getAttribute(attr);
    return v === "now" ? _xmNow() : _XM_RE.test(v || "") ? v : "";
  }

  _monthSet(v) {
    if (!_XM_RE.test(v || "")) return;
    const max = this._monthBound("max");
    const min = this._monthBound("min");
    if (max && v > max) v = max;
    if (min && v < min) v = min;
    this._xm.value = v;
    this._xm.input.value = v;
    this._xm.btn.querySelector(".x-mp-label").textContent = _xmName(v);
  }

  _monthFill() {
    const { pop, year } = this._xm;
    const max = this._monthBound("max");
    const min = this._monthBound("min");
    const now = _xmNow();
    const out = (k) => (max && k > max) || (min && k < min);
    const cells = Array.from({ length: 12 }, (_, i) => {
      const k = `${year}-${String(i + 1).padStart(2, "0")}`;
      const cls = ["x-mp-m", k === this.value ? "is-on" : "", k === now ? "is-now" : ""].filter(Boolean).join(" ");
      return `<button type="button" class="${cls}" data-month="${k}"${out(k) ? " disabled" : ""} aria-pressed="${k === this.value}" aria-label="Tháng ${i + 1} năm ${year}">Tháng ${i + 1}</button>`;
    }).join("");
    const prevOff = min && `${year - 1}-12` < min;
    const nextOff = max && `${year + 1}-01` > max;
    const today = now !== this.value && !out(now) ? `<button type="button" class="x-mp-today" data-month="${now}">Về tháng này</button>` : "";
    pop.innerHTML =
      `<div class="x-mp-head">` +
      `<button type="button" class="x-mp-nav" data-year="-1" aria-label="Năm trước"${prevOff ? " disabled" : ""}>${_xmSvg("l")}</button>` +
      `<span class="x-mp-year">${year}</span>` +
      `<button type="button" class="x-mp-nav" data-year="1" aria-label="Năm sau"${nextOff ? " disabled" : ""}>${_xmSvg("r")}</button>` +
      `</div><div class="x-mp-grid">${cells}</div>${today}`;
    if (pop.isOpen) pop.place();
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
    if (icon && window.lucide) lucide.createIcons({ root: this });
  }
}

// ── <x-switch> → <button class="cx-switch"> (id vis-btn-{key}) + núm (id vis-knob-{key}) ──
// Trạng thái bật/tắt vẫn do hidden input enable_* + _updateVisUI/_initVisToggles quản lý; nơi gọi
// CHỈ đặt aria-checked — màu (tắt xám, bật màu nhấn) và vị trí núm là việc của .cx-switch
// (styles/_common.css), đừng gắn class màu ở JS.
class XSwitch extends HTMLElement {
  connectedCallback() {
    const key = this.getAttribute("key") || "";
    // Handler chuyển hẳn sang <button> con: để lại trên thẻ ngoài là một cú bấm chạy
    // hai lần (nút con rồi nổi bọt lên đây) → bật xong tắt ngay. Giữ ở _onclick vì
    // thẻ bị gắn lại thì callback này chạy lần nữa mà attribute đã gỡ.
    if (this.hasAttribute("onclick")) {
      this._onclick = this.getAttribute("onclick");
      this.removeAttribute("onclick");
    }
    const onclick = this._onclick || "";
    const label = this.getAttribute("label") || "";
    // Mặc định hiển thị trạng thái bật; _updateVisUI/_initVisToggles sẽ đồng bộ ngay khi load.
    this.innerHTML = `
      <button type="button" id="vis-btn-${key}" role="switch" aria-checked="true"
        ${label ? `aria-label="${label}"` : ""} ${onclick ? `onclick="${onclick}"` : ""}
        class="cx-switch"><span id="vis-knob-${key}" class="cx-switch-knob"></span></button>`;
  }
}

// ── <x-check> → checkbox tuỳ biến (hướng B: component sở hữu trạng thái + phát "change") ──
// id inner giữ nguyên {key}-btn/{key}-box/{key}-icon để code cũ (nếu có) vẫn tra được.
class XCheck extends HTMLElement {
  connectedCallback() {
    // Tránh khởi tạo lại nếu đã được build
    if (this._built) return;
    this._built = true;

    const key = this.getAttribute("key") || "";
    const label = this.getAttribute("label") || "";
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
    
    // `onchange` để NGUYÊN trên thẻ: trình duyệt tự chạy nó khi thẻ phát "change"
    // (handler inline — CSP cho qua bằng 'unsafe-inline'). Đừng dựng lại bằng
    // new Function/eval: CSP ở _headers không có 'unsafe-eval' nên trên web thật nó
    // ném EvalError — tick vẫn lật mà handler không chạy, local thì vẫn đúng.
    const btn = this.querySelector("button");
    if (btn) {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.checked = !this.checked;
        this.dispatchEvent(new Event("change", { bubbles: true }));
      });
    }
  }

  get checked() {
    const btn = this.querySelector("button");
    return btn?.dataset.active === "true";
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

    if (!bare && icon && window.lucide) lucide.createIcons({ root: this });

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

  // Phủ skeleton lên ô trong lúc chờ (gọi AI, bốc câu mẫu…): el.setLoading(true/false).
  setLoading(on) {
    setTextareaLoading(this.querySelector("textarea"), on);
  }
}

// Phủ/gỡ skeleton cho MỘT <textarea> bất kỳ (kể cả ô viết tay, không bọc x-textarea).
// Dùng offset* so với gốc định vị nên chỉ che ô nhập, không đè nhãn/nút phía trên.
function setTextareaLoading(ta, on) {
  if (!ta) return;
  if (!on) {
    ta._xTaSkeleton?.remove();
    ta._xTaSkeleton = null;
    return;
  }
  if (ta._xTaSkeleton) return;
  const host = ta.closest(".x-ta-wrap") || ta.parentElement;
  if (!host) return;
  if (getComputedStyle(host).position === "static") host.style.position = "relative";
  const sk = document.createElement("div");
  sk.className = "x-ta-skeleton";
  // Số thanh skeleton = số dòng nhìn thấy (cao ô / line-height), thay vì đọc rows.
  const lh = parseFloat(getComputedStyle(ta).lineHeight) || 20;
  const rows = Math.max(3, Math.min(7, Math.floor((ta.clientHeight || lh * 4) / lh)));
  sk.innerHTML = "<span></span>".repeat(rows);
  sk.style.top = ta.offsetTop + "px";
  sk.style.left = ta.offsetLeft + "px";
  sk.style.width = ta.offsetWidth + "px";
  sk.style.height = ta.offsetHeight + "px";
  host.appendChild(sk);
  ta._xTaSkeleton = sk;
}
window.setTextareaLoading = setTextareaLoading;

customElements.define("x-date", XDate);
customElements.define("x-time", XTime);
customElements.define("x-textarea", XTextarea);
customElements.define("x-switch", XSwitch);
customElements.define("x-check", XCheck);
