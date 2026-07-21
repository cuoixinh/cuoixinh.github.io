// <x-combobox> — dropdown chọn 1 giá trị, thay cho <select> gốc.
//
// Vì sao có: <select> gốc trên di động bung bàn phím/khó style, và không
// preview được nội dung từng lựa chọn (vd font). Component này là nút bấm mở
// danh sách tuỳ biến, TỰ LẬT LÊN khi thiếu chỗ bên dưới, và có thể render mỗi
// dòng bằng đúng font của nó (thuộc tính `preview-font`).
//
// API:
//   el.setOptions([{ value, label }])  – nạp danh sách
//   el.value = "x"                      – gán (tự cập nhật nhãn + mục đang chọn)
//   el.value                            – đọc giá trị hiện tại
//   bắn sự kiện "change" (bubbles) khi người dùng chọn → dùng được onchange="".
//
// Thuộc tính: preview-font (render mỗi dòng + nhãn bằng font = value),
//             placeholder (chữ mờ khi chưa chọn).

(function () {
  const s = document.createElement("style");
  s.textContent = "x-combobox{display:block}";
  document.head.appendChild(s);
})();

const _XCB_BTN_CLS =
  "x-cb-btn w-full h-8 px-2 flex items-center justify-between gap-2 rounded-lg " +
  "border border-gray-300 bg-white text-[12px] text-gray-700 cursor-pointer " +
  "focus:outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-100";

const _XCB_LIST_CLS =
  "x-cb-list hidden absolute left-0 right-0 z-50 top-full my-1 p-1 bg-white " +
  "border border-gray-200 rounded-xl shadow-lg overflow-y-auto overscroll-contain";

const _XCB_OPT_CLS =
  "x-cb-opt block w-full text-left px-2 py-2 rounded-lg text-sm text-gray-700 " +
  "truncate cursor-pointer hover:bg-rose-50";

const _XCB_CHEV =
  '<svg class="x-cb-chev w-4 h-4 shrink-0 text-gray-400 transition-transform" ' +
  'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<polyline points="6 9 12 15 18 9"></polyline></svg>';

class XCombobox extends HTMLElement {
  connectedCallback() {
    if (this._built) return;
    this._built = true;

    this._value = this.getAttribute("value") || "";
    this._previewFont = this.hasAttribute("preview-font");
    this._placeholder = this.getAttribute("placeholder") || "Chọn...";
    this._options = [];
    this._isOpen = false;

    this.innerHTML =
      '<div class="relative">' +
      `<button type="button" class="${_XCB_BTN_CLS}" aria-haspopup="listbox">` +
      '<span class="x-cb-label truncate"></span>' +
      _XCB_CHEV +
      "</button>" +
      `<div class="${_XCB_LIST_CLS}" role="listbox"></div>` +
      "</div>";

    this._btn = this.querySelector(".x-cb-btn");
    this._label = this.querySelector(".x-cb-label");
    this._chev = this.querySelector(".x-cb-chev");
    this._list = this.querySelector(".x-cb-list");

    this._btn.addEventListener("click", () => this._toggle());
    this._syncLabel();
  }

  // ── Public API ────────────────────────────────────────────────────────────
  setOptions(items) {
    this._options = Array.isArray(items) ? items : [];
    this._renderList();
    this._syncLabel();
  }

  get value() {
    return this._value;
  }
  set value(v) {
    this._value = v == null ? "" : String(v);
    this._syncLabel();
  }

  // ── Internal ──────────────────────────────────────────────────────────────
  _renderList() {
    if (!this._list) return;
    this._list.innerHTML = "";
    this._options.forEach((it) => {
      const o = document.createElement("button");
      o.type = "button";
      o.className = _XCB_OPT_CLS;
      o.setAttribute("role", "option");
      o.dataset.value = it.value;
      o.textContent = it.label;
      if (this._previewFont) o.style.fontFamily = `'${it.value}', sans-serif`;
      o.addEventListener("click", () => this._pick(it.value));
      this._list.appendChild(o);
    });
  }

  _pick(v) {
    this.value = v; // set → _syncLabel
    this._close();
    this._btn.focus();
    this.dispatchEvent(new Event("change", { bubbles: true }));
  }

  _syncLabel() {
    if (!this._label) return;
    const opt = this._options.find((o) => o.value === this._value);
    const hasVal = !!this._value;
    this._label.textContent = opt ? opt.label : hasVal ? this._value : this._placeholder;
    this._label.style.fontFamily =
      this._previewFont && hasVal ? `'${this._value}', sans-serif` : "";
    this._label.classList.toggle("text-gray-400", !hasVal);

    if (this._list) {
      this._list.querySelectorAll(".x-cb-opt").forEach((o) => {
        const on = o.dataset.value === this._value;
        o.dataset.active = on ? "1" : "";
        o.classList.toggle("bg-rose-100", on);
        o.classList.toggle("text-rose-800", on);
      });
    }
  }

  _toggle() {
    this._isOpen ? this._close() : this._open();
  }

  _open() {
    this._list.classList.remove("hidden");
    this._chev.classList.add("rotate-180");
    this._isOpen = true;

    // Tự lật: thiếu chỗ dưới & phía trên rộng hơn → bung lên; kẹp max-height.
    const r = this._btn.getBoundingClientRect();
    const listH = this._list.offsetHeight;
    const spaceBelow = window.innerHeight - r.bottom;
    const spaceAbove = r.top;
    const up = spaceBelow < listH + 8 && spaceAbove > spaceBelow;
    this._list.classList.toggle("bottom-full", up);
    this._list.classList.toggle("top-full", !up);
    const avail = (up ? spaceAbove : spaceBelow) - 12;
    this._list.style.maxHeight = Math.max(96, Math.min(240, avail)) + "px";

    const active = this._list.querySelector('.x-cb-opt[data-active="1"]');
    if (active) active.scrollIntoView({ block: "nearest" });

    // Đóng khi bấm ra ngoài / Esc — hoãn 1 nhịp để không dính chính cú click mở.
    this._onDoc = (e) => {
      if (!this.contains(e.target)) this._close();
    };
    this._onKey = (e) => {
      if (e.key === "Escape") this._close();
    };
    setTimeout(() => {
      document.addEventListener("click", this._onDoc);
      document.addEventListener("keydown", this._onKey);
    }, 0);
  }

  _close() {
    if (!this._isOpen) return;
    this._list.classList.add("hidden");
    this._chev.classList.remove("rotate-180");
    this._isOpen = false;
    document.removeEventListener("click", this._onDoc);
    document.removeEventListener("keydown", this._onKey);
  }
}

customElements.define("x-combobox", XCombobox);
