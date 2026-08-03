// <x-combobox> — dropdown chọn 1 giá trị, thay cho <select> gốc: nút bấm mở danh
// sách tuỳ biến, TỰ LẬT LÊN khi thiếu chỗ bên dưới, render được mỗi dòng bằng
// đúng font của nó.
//   el.setOptions([{ value, label }])  nạp danh sách
//   el.value                           đọc / gán (tự cập nhật nhãn + mục chọn)
//   bắn sự kiện "change" (bubbles) khi người dùng chọn → dùng được onchange=""
// Thuộc tính: preview-font (render mỗi dòng bằng font = value), placeholder.

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

    // Định vị bằng position:FIXED để popup THOÁT khỏi mọi vùng cuộn (overflow)
    // của panel — absolute sẽ bị bảng chỉnh (max-h + overflow-y-auto) cắt mất.
    this._position();

    const active = this._list.querySelector('.x-cb-opt[data-active="1"]');
    if (active) active.scrollIntoView({ block: "nearest" });

    // Đóng khi bấm ra ngoài / Esc — hoãn 1 nhịp để không dính chính cú click mở.
    // Bám lại vị trí khi cuộn/đổi kích thước (list fixed nên phải theo nút bấm).
    this._onDoc = (e) => {
      if (!this.contains(e.target)) this._close();
    };
    this._onKey = (e) => {
      if (e.key === "Escape") this._close();
    };
    this._onReflow = (e) => {
      // Bỏ qua khi cuộn CHÍNH danh sách (internal scroll): _position() reset
      // max-height khiến scrollTop nhảy về 0 → không cuộn được bên trong list.
      if (e && e.type === "scroll" && this._list.contains(e.target)) return;
      this._position();
    };
    setTimeout(() => {
      document.addEventListener("click", this._onDoc);
      document.addEventListener("keydown", this._onKey);
      window.addEventListener("scroll", this._onReflow, true);
      window.addEventListener("resize", this._onReflow);
    }, 0);
  }

  // Đặt danh sách (position:fixed) bám mép nút bấm; tự lật lên nếu thiếu chỗ dưới.
  _position() {
    const list = this._list;
    const r = this._btn.getBoundingClientRect();
    const gap = 4;
    list.style.position = "fixed";
    list.style.margin = "0";
    list.style.right = "auto";
    list.style.left = r.left + "px";
    list.style.width = r.width + "px";
    list.style.maxHeight = "none";
    const listH = list.scrollHeight;
    const spaceBelow = window.innerHeight - r.bottom;
    const spaceAbove = r.top;
    const up = spaceBelow < listH + gap + 8 && spaceAbove > spaceBelow;
    const avail = (up ? spaceAbove : spaceBelow) - gap - 8;
    const maxH = Math.max(96, Math.min(240, avail));
    list.style.maxHeight = maxH + "px";
    list.style.top = up
      ? Math.max(8, r.top - Math.min(listH, maxH) - gap) + "px"
      : r.bottom + gap + "px";
  }

  _close() {
    if (!this._isOpen) return;
    this._list.classList.add("hidden");
    this._chev.classList.remove("rotate-180");
    this._isOpen = false;
    document.removeEventListener("click", this._onDoc);
    document.removeEventListener("keydown", this._onKey);
    window.removeEventListener("scroll", this._onReflow, true);
    window.removeEventListener("resize", this._onReflow);
  }
}

customElements.define("x-combobox", XCombobox);
