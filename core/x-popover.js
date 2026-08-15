// <x-popover> — thẻ nổi dùng chung cho TOÀN dự án (hình dạng lấy từ popover
// "Tùy chọn" ở navbar trang Thiết lập). Component chỉ lo VỎ: định vị theo nút
// mở, mũi tên, đóng khi bấm ra ngoài / Esc / chọn một mục.
//
//   <x-popover id="p" anchor="#btn" placement="top" align="center" arrow></x-popover>
//   p.setItems([{ id, icon, label, onClick, active, disabled }])  ← nạp danh sách
//   p.open() · p.close() · p.toggle(anchorEl?) · p.isOpen · sự kiện "open"/"close"
//
// Vẫn appendChild được phần tử tự dựng vào popover (navbar Thiết lập chuyển đúng
// phần tử nút vào đây) — setItems chỉ là lối tắt dựng mục cho menu thường.
// Thuộc tính: anchor (selector nút mở) · placement top|bottom · align center|start|end
// · arrow · width (px) · bound (selector khung kẹp) · offset (px) · keep-open.
// Style ở styles/_common.css (.x-pop*), nên trang dùng phải nạp bản CSS build.

(function () {
  const s = document.createElement("style");
  // CSS build chưa tới thì đừng để nội dung popover chớp ra một nhịp.
  s.textContent = "x-popover{display:none}";
  document.head.appendChild(s);
})();

const _XP_EDGE = 8; // chừa mép khung kẹp khi thẻ phải dịch vào trong
const _XP_TAIL = 20; // mũi tên không bò vào phần góc bo

const _XP_CHECK =
  '<svg class="x-pop-check" xmlns="http://www.w3.org/2000/svg" width="15" height="15" ' +
  'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" ' +
  'stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';

function _xpReady(fn) {
  if (window.__cxOnReady) window.__cxOnReady(fn);
  else if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", fn, { once: true });
  else fn();
}

class XPopover extends HTMLElement {
  connectedCallback() {
    if (this._built) return;
    this._built = true;

    this.classList.add("x-pop");
    if (this.hasAttribute("arrow")) this.classList.add("has-arrow");
    if (!this.hasAttribute("role")) this.setAttribute("role", "menu");
    const w = this.getAttribute("width");
    if (w) this.style.width = /^\d+$/.test(w) ? `${w}px` : w;

    // Chọn xong một mục thì đóng — popover che mất chính thứ vừa mở ra.
    this.addEventListener("click", (e) => {
      if (this.hasAttribute("keep-open")) return;
      if (e.target.closest("button, a, [role^='menuitem']")) this.close();
    });

    // Bấm ra ngoài: nghe ở pha CAPTURE để đóng được cả khi click bị nút bên dưới
    // nuốt mất. Bấm vào chính nút mở thì để onclick của nó tự đảo trạng thái.
    this._onDocClick = (e) => {
      if (!this.isOpen) return;
      if (this.contains(e.target)) return;
      if (this._anchorEl && this._anchorEl.contains(e.target)) return;
      this.close();
    };
    this._onKey = (e) => {
      if (e.key === "Escape") this.close();
    };
    this._onReflow = () => this.place();
    document.addEventListener("click", this._onDocClick, true);
    document.addEventListener("keydown", this._onKey);
    window.addEventListener("resize", this._onReflow, { passive: true });
    // capture: bắt cả khi cuộn trong khung con, không chỉ cuộn trang.
    window.addEventListener("scroll", this._onReflow, {
      passive: true,
      capture: true,
    });

    _xpReady(() => this._bindAnchor());
  }

  disconnectedCallback() {
    document.removeEventListener("click", this._onDocClick, true);
    document.removeEventListener("keydown", this._onKey);
    window.removeEventListener("resize", this._onReflow);
    window.removeEventListener("scroll", this._onReflow, true);
  }

  _bindAnchor() {
    const sel = this.getAttribute("anchor");
    const el = sel && document.querySelector(sel);
    if (!el) return;
    this._anchorEl = el;
    if (!el.hasAttribute("aria-haspopup")) el.setAttribute("aria-haspopup", "true");
    el.setAttribute("aria-expanded", "false");
    // Nút tự lo việc mở (onclick riêng) thì đừng gắn thêm — bấm một cái hoá ra
    // đảo trạng thái hai lần, popover không bao giờ mở.
    if (!el.hasAttribute("onclick"))
      el.addEventListener("click", () => this.toggle());
  }

  /** Dựng danh sách mục. Thay sạch nội dung cũ. */
  setItems(items) {
    this.innerHTML = "";
    (items || []).forEach((it) => {
      if (it.sep) {
        const hr = document.createElement("div");
        hr.className = "x-pop-sep";
        this.appendChild(hr);
        return;
      }
      const b = document.createElement("button");
      b.type = "button";
      b.className = "x-pop-item" + (it.active ? " is-active" : "");
      b.setAttribute("role", it.role || "menuitem");
      if (it.id) b.id = it.id;
      if (it.active) b.setAttribute("aria-current", "true");
      if (it.disabled) b.disabled = true;
      if (it.icon)
        b.insertAdjacentHTML(
          "beforeend",
          `<span class="x-pop-ico">${it.icon}</span>`,
        );
      b.insertAdjacentHTML("beforeend", `<span>${it.label ?? ""}</span>`);
      if (it.active) b.insertAdjacentHTML("beforeend", _XP_CHECK);
      if (it.onClick) b.addEventListener("click", it.onClick);
      this.appendChild(b);
    });
    if (this.isOpen) this.place();
    return this;
  }

  get isOpen() {
    return this.classList.contains("is-open");
  }

  open(anchorEl) {
    if (anchorEl) this._anchorEl = anchorEl;
    if (!this._anchorEl) this._bindAnchor();
    this.classList.add("is-open");
    this._anchorEl?.setAttribute("aria-expanded", "true");
    this.place(); // phải hiện trước mới đo được khổ thẻ
    this.dispatchEvent(new CustomEvent("open", { bubbles: true }));
  }

  close() {
    if (!this.isOpen) return;
    this.classList.remove("is-open");
    this._anchorEl?.setAttribute("aria-expanded", "false");
    this.dispatchEvent(new CustomEvent("close", { bubbles: true }));
  }

  toggle(anchorEl) {
    this.isOpen ? this.close() : this.open(anchorEl);
  }

  /**
   * Đặt thẻ theo tâm nút mở rồi kẹp trong `bound`, mũi tên vẫn chỉ đúng nút.
   * Thiếu chỗ ở phía đang chọn thì tự lật sang phía kia. Đo lại mỗi lần mở vì
   * nút có thể đổi chỗ/đổi khổ theo bề ngang màn hình.
   */
  place() {
    const a = this._anchorEl;
    if (!a || !this.isOpen) return;
    const r = a.getBoundingClientRect();
    const w = this.offsetWidth;
    const h = this.offsetHeight;
    const off = Number(this.getAttribute("offset")) || 12;
    const b = this._bounds();

    let side = this.getAttribute("placement") === "top" ? "top" : "bottom";
    const below = b.bottom - r.bottom;
    const above = r.top - b.top;
    if (side === "bottom" && below < h + off && above > below) side = "top";
    else if (side === "top" && above < h + off && below > above) side = "bottom";

    const align = this.getAttribute("align") || "center";
    const center = r.left + r.width / 2;
    const raw =
      align === "start" ? r.left : align === "end" ? r.right - w : center - w / 2;
    const left = Math.min(
      Math.max(raw, b.left + _XP_EDGE),
      Math.max(b.right - w - _XP_EDGE, b.left + _XP_EDGE),
    );

    this.style.left = `${Math.round(left)}px`;
    this.style.top = `${Math.round(side === "top" ? r.top - h - off : r.bottom + off)}px`;
    this.classList.toggle("is-top", side === "top");
    this.classList.toggle("is-bottom", side === "bottom");
    // Mũi tên: px tính từ mép trái thẻ.
    const tail = Math.min(Math.max(center - left, _XP_TAIL), Math.max(w - _XP_TAIL, _XP_TAIL));
    this.style.setProperty("--x-pop-tail", `${Math.round(tail)}px`);
  }

  /** Khung được phép chiếm: `bound` giao với khung nhìn, mặc định cả khung nhìn. */
  _bounds() {
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;
    const host = this.getAttribute("bound")
      ? document.querySelector(this.getAttribute("bound"))
      : null;
    if (!host) return { left: 0, top: 0, right: vw, bottom: vh };
    const r = host.getBoundingClientRect();
    return {
      left: Math.max(r.left, 0),
      top: Math.max(r.top, 0),
      right: Math.min(r.right, vw),
      bottom: Math.min(r.bottom, vh),
    };
  }
}

customElements.define("x-popover", XPopover);
