// <x-combobox> — dropdown chọn 1 giá trị, thay cho <select> gốc: nút bấm mở danh
// sách tuỳ biến, TỰ LẬT LÊN khi thiếu chỗ bên dưới, render được mỗi dòng bằng
// đúng font của nó.
//   el.setOptions([{ value, label, swatch }])  nạp danh sách
//   el.value                           đọc / gán (tự cập nhật nhãn + mục chọn)
//   bắn sự kiện "change" (bubbles) khi người dùng chọn → dùng được onchange=""
// Thuộc tính: preview-font (render mỗi dòng bằng font = value), preview-swatch
// (hiện một giọt màu lấy từ `swatch` của từng mục — mã hex), placeholder.

(function () {
  const s = document.createElement("style");
  s.textContent =
    "x-combobox{display:block}" +
    // Giọt màu của preview-swatch: một hình nhỏ đứng trước nhãn, không chiếm
    // chỗ của chữ.
    ".x-cb-sw{display:inline-flex;flex:none;align-items:center;vertical-align:middle}";
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
  "x-cb-opt flex w-full items-center gap-2 text-left px-2 py-2 rounded-lg text-sm " +
  "text-gray-700 cursor-pointer hover:bg-rose-50";

// Giọt màu của một mục (preview-swatch): MỘT hình, tô đúng màu mà mục đó khai.
// Nét viền suy ra từ chính màu tô (tối đi 45%) chứ không phải màu thứ hai — nền
// thiệp toàn tông sáng, không có nét thì giọt màu chìm hẳn vào nền trắng của
// dropdown. Markup SVG là chuỗi TĨNH, màu đi qua setAttribute — danh sách có thể
// đến từ dữ liệu, đừng mở đường cho markup lạ.
const _XCB_DROP =
  '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" ' +
  'stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 ' +
  '6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"></path></svg>';

function _xcbHex(c) {
  const m = /^#([0-9a-fA-F]{6})$/.exec(String(c || "").trim());
  return m ? m[1] : "";
}

function _xcbShade(hex, t) {
  const n = parseInt(hex, 16);
  return (
    "#" +
    [(n >> 16) & 255, (n >> 8) & 255, n & 255]
      .map((v) => Math.round(v * (1 - t)).toString(16).padStart(2, "0"))
      .join("")
  );
}

function _xcbSwatch(color) {
  const hex = _xcbHex(color);
  if (!hex) return null;
  const wrap = document.createElement("span");
  wrap.className = "x-cb-sw";
  wrap.innerHTML = _XCB_DROP;
  const svg = wrap.firstChild;
  svg.setAttribute("fill", "#" + hex);
  svg.setAttribute("stroke", _xcbShade(hex, 0.45));
  return wrap;
}

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
    this._previewSwatch = this.hasAttribute("preview-swatch");
    this._placeholder = this.getAttribute("placeholder") || "Chọn...";
    this._options = [];
    this._isOpen = false;

    this.innerHTML =
      '<div class="relative">' +
      `<button type="button" class="${_XCB_BTN_CLS}" aria-haspopup="listbox">` +
      '<span class="x-cb-cur flex items-center gap-2 min-w-0">' +
      '<span class="x-cb-label truncate"></span></span>' +
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
      const sw = this._previewSwatch ? _xcbSwatch(it.swatch) : null;
      if (sw) o.appendChild(sw);
      const txt = document.createElement("span");
      txt.className = "truncate";
      txt.textContent = it.label;
      o.appendChild(txt);
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

    // Giọt màu của mục đang chọn, hiện ngay trên nút bấm.
    const cur = this.querySelector(".x-cb-cur");
    if (cur) {
      cur.querySelector(".x-cb-sw")?.remove();
      const sw = this._previewSwatch ? _xcbSwatch(opt?.swatch) : null;
      if (sw) cur.insertBefore(sw, this._label);
    }

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
