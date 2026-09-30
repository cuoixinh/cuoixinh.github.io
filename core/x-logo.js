// <x-logo size="40" light></x-logo> — logo Cưới Xinh: biểu tượng + "Cưới Xinh" +
// dòng "-SINCE 2026-". Chữ là HTML thật nên nét ở mọi cỡ.
// size = chiều cao biểu tượng (px); chữ và khoảng cách tỉ lệ theo. Bỏ `size` thì
// cỡ lấy từ biến CSS --xl-size (mặc định 40px) — dùng khi cần đổi cỡ theo media query.
// light = chữ trắng (đặt trên nền tối). Bọc link thì để thẻ <a> ở ngoài.

;(function () {
  const s = document.createElement("style");
  s.textContent =
    "x-logo{display:inline-flex;align-items:center;gap:calc(var(--xl-size,40px)*.2);" +
    "line-height:1;white-space:nowrap;vertical-align:middle}" +
    "x-logo .xl-ico{display:block;height:var(--xl-size,40px);width:auto;flex-shrink:0}" +
    "x-logo .xl-txt{display:flex;flex-direction:column;align-items:center}" +
    "x-logo .xl-name{font-size:calc(var(--xl-size,40px)*.5);font-weight:700;" +
    "letter-spacing:-.01em;color:rgb(var(--text-body-rgb))}" +
    // letter-spacing để lại khoảng giãn sau ký tự cuối → margin âm bù cho chữ canh giữa.
    "x-logo .xl-since{margin-top:calc(var(--xl-size,40px)*.1);font-size:calc(var(--xl-size,40px)*.15);" +
    "font-weight:600;letter-spacing:.2em;margin-right:-.2em;color:rgb(var(--text-tertiary-rgb))}" +
    "x-logo[light] .xl-name,x-logo[light] .xl-since{color:rgb(var(--white-rgb))}";
  document.head.appendChild(s);
})();

class XLogo extends HTMLElement {
  static get observedAttributes() {
    return ["size"];
  }

  connectedCallback() {
    if (this._built) return;
    this._built = true;
    this.setAttribute("role", "img");
    this.setAttribute("aria-label", "Cưới Xinh");
    this.innerHTML =
      '<img class="xl-ico" src="/assets/icons/logo.png" alt="" aria-hidden="true" />' +
      '<span class="xl-txt" aria-hidden="true"><span class="xl-name">Cưới Xinh</span>' +
      '<span class="xl-since">-SINCE 2026-</span></span>';
    this._applySize();
  }

  attributeChangedCallback() {
    this._applySize();
  }

  _applySize() {
    const n = parseFloat(this.getAttribute("size"));
    if (n > 0) this.style.setProperty("--xl-size", `${n}px`);
    else this.style.removeProperty("--xl-size");
  }
}

if (!customElements.get("x-logo")) customElements.define("x-logo", XLogo);
