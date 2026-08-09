// <x-button> — nút dùng chung cho TOÀN dự án (trang ứng dụng lẫn trang thiệp).
// Hình dạng cố định: pill (rounded-full); khác nhau ở variant (độ đậm) + tone (màu).
//
//   <x-button variant="fill|outline|dashed|soft|ghost|overlay|bare" tone="brand|neutral|danger"
//             size="xs|sm|md|lg" icon="fas fa-plus" icon-only full>Nhãn</x-button>
//
// Khi nạp, phần tử TỰ THAY THẾ mình bằng <button> thật (mọi attribute còn lại —
// id, onclick, data-*, disabled… — chuyển sang nút đó). Nghĩa là DOM lúc chạy y
// hệt như viết <button> tay: getElementById, closest("button"), parentElement,
// selector CSS con đều không đổi. <x-button> chỉ là cách VIẾT cho thống nhất.
//
// Ràng buộc: thẻ trong HTML tĩnh được dựng ở DOMContentLoaded (lúc parse xong
// mới có phần con); thẻ do JS sinh qua innerHTML dựng ngay khi chèn.

;(function () {
  const s = document.createElement("style");
  // Nút chưa dựng thì ẩn — tránh chớp một nhịp chữ trần chưa có kiểu.
  s.textContent = "x-button{visibility:hidden}";
  document.head.appendChild(s);
})();

// Class viết trọn tên (không ghép chuỗi) để Tailwind purge quét được.
const _XB_BASE =
  "inline-flex items-center justify-center rounded-full font-semibold " +
  "whitespace-nowrap select-none transition-all active:scale-[0.97] " +
  "disabled:opacity-50 disabled:pointer-events-none";

const _XB_SIZE = {
  xs: "h-7 px-3 text-[11px] gap-1",
  sm: "h-8 px-4 text-xs gap-1.5",
  md: "h-10 px-5 text-sm gap-2",
  lg: "h-12 px-7 text-[15px] gap-2",
};

const _XB_SIZE_ICON = {
  xs: "h-7 w-7 text-[11px]",
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-12 w-12 text-[15px]",
};

// "bare" = chỉ thống nhất HÌNH pill, không áp màu lẫn khổ. Dùng cho trang thiệp
// public: mỗi theme có bảng màu riêng (vàng đồng, xanh rừng…) nên màu/kích cỡ
// vẫn do class của theme quyết định.
const _XB_BARE = "inline-flex items-center justify-center rounded-full transition-all active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none";

const _XB_LOOK = {
  "fill/brand": "bg-rose-500 text-white shadow-sm hover:bg-rose-600",
  "fill/neutral": "bg-gray-700 text-white shadow-sm hover:bg-gray-800",
  "fill/danger": "bg-red-500 text-white shadow-sm hover:bg-red-600",
  "outline/brand": "border border-rose-200 bg-white text-rose-600 hover:bg-rose-50",
  "outline/neutral": "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50",
  "outline/danger": "border border-red-200 bg-white text-red-600 hover:bg-red-50",
  // Viền nét đứt = "thêm mới" (thêm ảnh, thêm mốc) — chỗ trống chờ được điền.
  "dashed/brand": "border border-dashed border-rose-300 bg-transparent text-rose-400 hover:border-rose-400 hover:text-rose-500",
  "dashed/neutral": "border border-dashed border-gray-300 bg-transparent text-gray-400 hover:border-gray-400 hover:text-gray-600",
  "dashed/danger": "border border-dashed border-red-300 bg-transparent text-red-400 hover:border-red-400 hover:text-red-500",
  "soft/brand": "bg-rose-50 text-rose-600 hover:bg-rose-100",
  "soft/neutral": "bg-gray-100 text-gray-700 hover:bg-gray-200",
  "soft/danger": "bg-red-50 text-red-600 hover:bg-red-100",
  "ghost/brand": "text-rose-600 hover:bg-rose-50",
  "ghost/neutral": "text-gray-500 hover:bg-gray-100 hover:text-gray-700",
  "ghost/danger": "text-red-500 hover:bg-red-50",
  // Nút nổi trên ảnh (xoá ảnh, điều hướng carousel) — tone bỏ qua trừ danger.
  "overlay/brand": "bg-black/50 text-white backdrop-blur-sm hover:bg-black/70",
  "overlay/neutral": "bg-black/50 text-white backdrop-blur-sm hover:bg-black/70",
  "overlay/danger": "bg-red-500/85 text-white backdrop-blur-sm hover:bg-red-500",
};

// Attribute do component tiêu thụ, không chuyển sang <button>.
const _XB_OWN = ["variant", "tone", "size", "icon", "icon-only", "full", "label", "class"];

class XButton extends HTMLElement {
  connectedCallback() {
    if (this._done) return;
    // Thẻ tĩnh trong HTML: connectedCallback chạy ngay khi parser đọc thẻ MỞ,
    // lúc đó phần con chưa có → đợi parse xong mới dựng.
    if (document.readyState === "loading" && !this.hasAttribute("label")) {
      document.addEventListener("DOMContentLoaded", () => this._build(), { once: true });
      return;
    }
    this._build();
  }

  _build() {
    if (this._done || !this.isConnected) return;
    this._done = true;

    const variant = this.getAttribute("variant") || "fill";
    const tone = this.getAttribute("tone") || "brand";
    const size = this.getAttribute("size") || "md";
    const iconOnly = this.hasAttribute("icon-only");
    const icon = this.getAttribute("icon") || "";
    const label = this.getAttribute("label");

    const btn = document.createElement("button");
    for (const a of Array.from(this.attributes)) {
      if (!_XB_OWN.includes(a.name)) btn.setAttribute(a.name, a.value);
    }
    if (!btn.hasAttribute("type")) btn.type = "button";

    const bare = variant === "bare";
    btn.className = [
      bare ? _XB_BARE : _XB_BASE,
      // bare không có size mặc định — chỉ khi được chỉ định rõ.
      bare && !this.hasAttribute("size")
        ? ""
        : (iconOnly ? _XB_SIZE_ICON[size] : _XB_SIZE[size]) ||
          (iconOnly ? _XB_SIZE_ICON.md : _XB_SIZE.md),
      bare ? "" : _XB_LOOK[variant + "/" + tone] || _XB_LOOK["fill/brand"],
      this.hasAttribute("full") ? "w-full" : "",
      // Class người dùng đặt thêm (layout: absolute, flex-1, hidden… hoặc hook JS).
      this.getAttribute("class") || "",
    ]
      .filter(Boolean)
      .join(" ");

    if (icon) btn.insertAdjacentHTML("beforeend", `<i class="${icon}"></i>`);
    if (label != null) btn.appendChild(document.createTextNode(label));
    else while (this.firstChild) btn.appendChild(this.firstChild);

    this.replaceWith(btn);
  }
}

customElements.define("x-button", XButton);
