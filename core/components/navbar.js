// Navbar dùng chung cho các trang công khai (trang chủ, Mẫu thiệp…). Khai MỘT
// mảng mục rồi dựng ra HAI thanh cùng lúc: thanh trên (từ md) và thanh tab dưới
// (mobile) — nên hai thanh không bao giờ lệch nhau.
//
//   CXNavbar.mount({ active: "home", width: "6xl", items: [...], actions: [...] })
//
// Mục: { id, label, icon, href | onClick, count, only: "top"|"tab" }
//   href → thẻ <a>, không có href → <button> (dùng onClick).
//   count → kèm ô số đếm (ẩn sẵn); only → chỉ hiện ở một trong hai thanh.
// Hành động bên phải thanh trên: { label, onClick, id, icon, class, variant };
// cần thứ khác nút (menu tài khoản…) thì truyền `actionsHTML` — HTML thô, chèn
// sau các nút.
//
// Mỗi phần tử dựng ra mang data-nav="<id>" (và data-nav-count / data-nav-label)
// để trang tự nhắm bằng querySelectorAll — ĐỪNG ghép tên class từ chuỗi, Tailwind
// purge quét văn bản thô nên class ghép động sẽ bị cắt mất.
// Style ở styles/_common.css (.cx-navbar/.cx-navcard/.cx-navlink/.cx-tabbar…).

const CXNavbar = (function () {
  // Icon lucide, nhúng thẳng: các trang công khai không nạp thư viện icon.
  const ICONS = {
    home: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
    layers:
      '<path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>',
    cart: '<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>',
    heart:
      '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
    user: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="10" r="3"/><path d="M7 20.7a8 8 0 0 1 10 0"/>',
    star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
    list: '<path d="M10 6h11"/><path d="M10 12h11"/><path d="M10 18h11"/><path d="M4 6h1v4"/><path d="M4 10h2"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/>',
    sparkles:
      '<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>',
  };

  // Viết trọn tên class (không ghép chuỗi) để Tailwind purge quét được.
  const WIDTH = { "4xl": "max-w-4xl", "6xl": "max-w-6xl", "7xl": "max-w-7xl" };

  function svg(name, size) {
    const d = ICONS[name];
    if (!d) return "";
    return (
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" ` +
      `fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" ` +
      `stroke-linejoin="round" aria-hidden="true">${d}</svg>`
    );
  }

  // mode: "top" = thanh trên (desktop) · "tab" = thanh dưới (mobile)
  function itemHTML(it, active, mode) {
    if (it.only && it.only !== mode) return "";
    const isTab = mode === "tab";
    const cls = (isTab ? "cx-tab" : "cx-navlink") + (it.id === active ? " is-on" : "");
    const tag = it.href ? "a" : "button";
    const link = it.href ? `href="${it.href}"` : 'type="button"';
    const click = it.onClick ? ` onclick="${it.onClick}"` : "";
    const badge = it.count
      ? `<span class="${isTab ? "cx-tab-count" : "cx-navcount"} hidden" data-nav-count="${it.id}">0</span>`
      : "";
    return (
      `<${tag} class="${cls}" data-nav="${it.id}" ${link}${click}>` +
      svg(it.icon, isTab ? 20 : 15) +
      `<span data-nav-label="${it.id}">${it.label}</span>${badge}</${tag}>`
    );
  }

  function actionHTML(a) {
    const attrs = [
      `size="${a.size || "md"}"`,
      a.variant ? `variant="${a.variant}"` : "",
      a.id ? `id="${a.id}"` : "",
      a.class ? `class="${a.class}"` : "",
      a.style ? `style="${a.style}"` : "",
      a.onClick ? `onclick="${a.onClick}"` : "",
    ].filter(Boolean);
    return `<x-button ${attrs.join(" ")}>${a.icon ? svg(a.icon, 14) : ""}${a.label}</x-button>`;
  }

  /**
   * Chèn hai thanh vào đầu/cuối <body>. Gọi sau khi DOM sẵn sàng; js/nav-autohide.js
   * tìm #main-nav nên phải chạy SAU lời gọi này (nó cũng tự đợi DOM ready).
   */
  function mount(cfg) {
    const items = cfg.items || [];
    const width = WIDTH[cfg.width] || WIDTH["7xl"];

    const top =
      `<nav id="main-nav" class="cx-navbar hidden md:block">` +
      `<div class="${width} mx-auto px-4 sm:px-6 lg:px-8">` +
      `<div class="cx-navcard">` +
      `<a href="/" class="shrink-0" aria-label="Cưới Xinh">` +
      `<img src="/assets/icons/logo.png" alt="Cưới Xinh" class="h-10 w-auto" /></a>` +
      `<nav class="cx-navlinks">${items.map((i) => itemHTML(i, cfg.active, "top")).join("")}</nav>` +
      `<div class="cx-navactions">${(cfg.actions || []).map(actionHTML).join("")}` +
      `${cfg.actionsHTML || ""}</div>` +
      `</div></div></nav>`;

    const bar =
      `<nav class="cx-tabbar md:hidden"><div class="cx-tabbar-card">` +
      items.map((i) => itemHTML(i, cfg.active, "tab")).join("") +
      `</div></nav>`;

    document.body.insertAdjacentHTML("afterbegin", top);
    document.body.insertAdjacentHTML("beforeend", bar);
  }

  /** Đổi mục đang mở ở CẢ HAI thanh. */
  function setActive(id) {
    document.querySelectorAll("[data-nav]").forEach((el) => {
      el.classList.toggle("is-on", el.dataset.nav === id);
    });
  }

  /** Số đếm của một mục (vd. số mẫu đã thích); 0 thì ẩn ô đếm. */
  function setCount(id, n) {
    document.querySelectorAll(`[data-nav-count="${id}"]`).forEach((el) => {
      el.textContent = n;
      el.classList.toggle("hidden", !n);
    });
  }

  /** Đổi nhãn một mục ở cả hai thanh (vd. "Tài khoản" ↔ "Thiệp của tôi"). */
  function setLabel(id, text) {
    document.querySelectorAll(`[data-nav-label="${id}"]`).forEach((el) => {
      el.textContent = text;
    });
  }

  return { ICONS, mount, setActive, setCount, setLabel };
})();

window.CXNavbar = CXNavbar;
