// Navbar dùng chung cho các trang công khai (trang chủ, Mẫu thiệp…). Khai MỘT
// mảng mục rồi dựng ra HAI thanh cùng lúc: thanh trên (từ md) và thanh tab dưới
// (mobile) — nên hai thanh không bao giờ lệch nhau.
//
//   CXNavbar.mount({ active: "home", items: [...], actions: [...] })
//
// Thanh trên GIỐNG HỆT nhau ở mọi trang (khổ max-w-6xl, không tự ẩn khi cuộn):
// logo đứng riêng bên trái, thẻ navbar chỉ mang dãy mục; ở đầu trang thẻ trong
// suốt, cuộn xuống mới có nền và logo thu lại (cờ .is-top trên #main-nav).
// tabbar: false → chỉ dựng thanh trên. Dùng cho luồng MỘT CHIỀU (thanh toán):
// dải đáy ở đó dành cho nút hành động, để thêm tab là mời khách rời luồng.
//
// Mục: { id, label, icon, href | onClick, count, only: "top"|"tab", login, loginLabel }
//   href → thẻ <a>, không có href → <button> (dùng onClick).
//   count → kèm ô số đếm (ẩn sẵn); only → chỉ hiện ở một trong hai thanh.
//   login: true → chỉ hiện khi đã đăng nhập; loginLabel → nhãn thay cho `label`
//   khi đã đăng nhập. Lúc mount hỏi CXAuth (bản sync) nên trang phải nạp
//   core/auth.js TRƯỚC navbar — thiếu thì vẽ như chưa đăng nhập rồi mới tráo (nháy).
//   pin: true → không bao giờ bị gom vào nút "…".
// Thanh nào không đủ chỗ (nhãn tab phải xuống dòng, dãy mục thanh trên tràn) thì
// mục thừa lùi dần vào popover của nút "…" cuối thanh (mục cuối lùi trước, mục
// đang mở và mục pin thì không) — CÙNG phần tử, dáng hàng menu do popover quyết định.
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
    users:
      '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
    more: '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
    list: '<path d="M10 6h11"/><path d="M10 12h11"/><path d="M10 18h11"/><path d="M4 6h1v4"/><path d="M4 10h2"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/>',
  };

  // Tên có ở bảng icon riêng (core/helpers/icon.js, vd logo "xuxi") thì lấy ở đó;
  // trang nào dùng tên như vậy phải nạp file icon, thiếu là ô icon trống.
  function svg(name, size) {
    const own = window.cxIcon?.(name, size);
    if (own) return own;
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
    const cls =
      (isTab ? "cx-tab" : "cx-navlink") +
      (it.id === active ? " is-on" : "") +
      (it.login && !_on0 ? " cx-nav-off" : "");
    const tag = it.href ? "a" : "button";
    const link = it.href ? `href="${it.href}"` : 'type="button"';
    const click = it.onClick ? ` onclick="${it.onClick}"` : "";
    // Mục đổi nhãn theo phiên (loginLabel) giữ cả hai nhãn để syncLoginItems tráo.
    const loginLabel = it.loginLabel
      ? ` data-nav-label-out="${it.label}" data-nav-label-in="${it.loginLabel}"`
      : "";
    const badge = it.count
      ? `<span class="${isTab ? "cx-tab-count" : "cx-navcount"} hidden" data-nav-count="${it.id}">0</span>`
      : "";
    return (
      `<${tag} class="${cls}" data-nav="${it.id}"${it.login ? " data-nav-login" : ""}` +
      `${it.pin ? " data-nav-pin" : ""} ${link}${click}>` +
      svg(it.icon, isTab ? 20 : 15) +
      `<span data-nav-label="${it.id}"${loginLabel}>` +
      `${_on0 && it.loginLabel ? it.loginLabel : it.label}</span>${badge}</${tag}>`
    );
  }

  // Nút "…" cuối thanh — ẩn sẵn, _reflow chỉ bật khi có mục phải gom vào.
  function moreHTML(mode) {
    const isTab = mode === "tab";
    return (
      `<button type="button" class="${isTab ? "cx-tab" : "cx-navlink"} cx-nav-off" data-nav-more ` +
      `aria-haspopup="menu" aria-expanded="false">${svg("more", isTab ? 20 : 15)}` +
      `<span data-nav-label="more">Thêm</span></button>`
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
   * Chèn hai thanh vào đầu/cuối <body>. Gọi sau khi DOM sẵn sàng.
   */
  // Phiên lúc mount (bản sync của CXAuth) — vẽ đúng ngay lần đầu.
  let _on0 = false;

  function mount(cfg) {
    const items = cfg.items || [];
    _on0 = !!window.CXAuth?.isLoggedIn?.();

    const top =
      `<nav id="main-nav" class="cx-navbar${_atTop() ? " is-top" : ""} hidden md:block">` +
      `<div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 cx-navrow">` +
      `<a href="/" class="cx-logo cx-navbrand shrink-0" aria-label="Cưới Xinh">` +
      `<x-logo size="32"></x-logo></a>` +
      `<div class="cx-navcard">` +
      `<nav class="cx-navlinks">${items.map((i) => itemHTML(i, cfg.active, "top")).join("")}` +
      `${moreHTML("top")}</nav>` +
      `<div class="cx-navactions">${(cfg.actions || []).map(actionHTML).join("")}` +
      `${cfg.actionsHTML || ""}</div>` +
      `</div></div></nav>`;

    document.body.insertAdjacentHTML("afterbegin", top);
    _bindFlatTop(document.getElementById("main-nav"));
    if (items.some((i) => i.login || i.loginLabel)) _bindLoginItems();
    _bindMore(document.querySelector("#main-nav .cx-navlinks"), "top");

    if (cfg.tabbar !== false) {
      const bar =
        `<nav class="cx-tabbar md:hidden"><div class="cx-tabbar-card">` +
        items.map((i) => itemHTML(i, cfg.active, "tab")).join("") +
        moreHTML("tab") +
        `</div></nav>`;
      document.body.insertAdjacentHTML("beforeend", bar);
      _bindMore(document.body.lastElementChild.firstElementChild, "tab");
    }
    _queueReflow();
    document.fonts?.ready.then(_queueReflow); // font về muộn là bề ngang nhãn đổi
  }

  // ===== Gom mục thừa vào "…" =====
  // Popover để ở <body>: x-popover là position:fixed, mà thanh tab có transform.
  const _bars = [];

  // Tab vừa khi nhãn (một dòng) không bị cắt "…"; mục đang ẩn coi như vừa.
  function _tabFits(el) {
    const s = el.offsetWidth && el.querySelector("[data-nav-label]");
    return !s || s.scrollWidth <= s.clientWidth;
  }

  function _bindMore(box, mode) {
    if (!box) return;
    const more = box.querySelector("[data-nav-more]");
    const pop = document.createElement("x-popover");
    pop.className = "cx-navmore-pop";
    pop.setAttribute("placement", mode === "tab" ? "top" : "bottom");
    pop.setAttribute("align", "end");
    document.body.appendChild(pop);
    more.addEventListener("click", () => pop.toggle?.(more));
    _bars.push({
      box,
      more,
      pop,
      items: [...box.children].filter((el) => el !== more),
      fits:
        mode === "tab"
          ? () => [...box.children].every(_tabFits)
          : () => box.scrollWidth <= box.clientWidth,
    });
    if ("ResizeObserver" in window) new ResizeObserver(_queueReflow).observe(box);
  }

  // Trả hết mục về thanh rồi lùi từng mục (từ cuối) vào popover tới khi vừa.
  function _reflow(bar) {
    const { box, more, pop, items, fits } = bar;
    if (!box.offsetWidth) return; // thanh đang ẩn ở khổ màn này
    items.forEach((el) => box.insertBefore(el, more));
    more.classList.add("cx-nav-off");
    if (!fits()) {
      more.classList.remove("cx-nav-off");
      const movable = items.filter(
        (el) =>
          !el.classList.contains("is-on") &&
          !el.classList.contains("cx-nav-off") &&
          !el.hasAttribute("data-nav-pin"),
      );
      for (let i = movable.length - 1; i >= 0; i--) {
        pop.insertBefore(movable[i], pop.firstChild); // chèn đầu → giữ thứ tự gốc
        if (fits()) break;
      }
    }
    if (more.classList.contains("cx-nav-off")) pop.close?.();
    else pop.place?.();
  }

  let _reflowRaf = 0;
  function _queueReflow() {
    if (_reflowRaf) return;
    _reflowRaf = requestAnimationFrame(() => {
      _reflowRaf = 0;
      _bars.forEach(_reflow);
    });
  }

  // Gần đầu trang → cờ .is-top, viết sẵn vào markup lúc mount. Transition chỉ bật
  // (cờ .is-anim) từ lần cuộn đầu tiên: bật sẵn thì lúc chuyển trang logo "bay" vào.
  const FLAT_TOP_PX = 16;
  const _atTop = () => window.scrollY <= FLAT_TOP_PX;
  function _bindFlatTop(nav) {
    let ticking = false;
    const sync = () => {
      ticking = false;
      nav.classList.add("is-anim");
      nav.classList.toggle("is-top", _atTop());
    };
    window.addEventListener(
      "scroll",
      () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(sync);
      },
      { passive: true },
    );
  }

  // Mục `login: true` hiện/ẩn theo phiên, mục có `loginLabel` đổi nhãn theo phiên.
  // Chạy khi DOM xong (lúc đó mọi script đồng bộ, kể cả core/auth.js, đã chạy) rồi
  // bám onChange cho đăng nhập/xuất sau.
  function syncLoginItems() {
    const on = !!window.CXAuth?.isLoggedIn?.();
    document.querySelectorAll("[data-nav-login]").forEach((el) => {
      el.classList.toggle("cx-nav-off", !on);
    });
    document.querySelectorAll("[data-nav-label-in]").forEach((el) => {
      el.textContent = on ? el.dataset.navLabelIn : el.dataset.navLabelOut;
    });
    _queueReflow();
  }

  let _loginBound = false;
  function _bindLoginItems() {
    if (_loginBound) return;
    _loginBound = true;
    const start = () => {
      syncLoginItems();
      window.CXAuth?.onChange?.(syncLoginItems);
    };
    if (document.readyState === "loading")
      document.addEventListener("DOMContentLoaded", start, { once: true });
    else start();
  }

  /** Đổi mục đang mở ở CẢ HAI thanh. */
  function setActive(id) {
    document.querySelectorAll("[data-nav]").forEach((el) => {
      el.classList.toggle("is-on", el.dataset.nav === id);
    });
    _queueReflow(); // mục vừa thành "đang mở" mà nằm trong "…" thì phải ra lại thanh
  }

  /** Số đếm của một mục (vd. số mẫu đã thích); 0 thì ẩn ô đếm. */
  function setCount(id, n) {
    document.querySelectorAll(`[data-nav-count="${id}"]`).forEach((el) => {
      el.textContent = n;
      el.classList.toggle("hidden", !n);
    });
    _queueReflow();
  }

  /** Đổi nhãn một mục ở cả hai thanh (vd. "Tài khoản" ↔ "Thiệp của tôi"). */
  function setLabel(id, text) {
    document.querySelectorAll(`[data-nav-label="${id}"]`).forEach((el) => {
      el.textContent = text;
    });
    _queueReflow();
  }

  return { ICONS, mount, setActive, setCount, setLabel, syncLoginItems };
})();

window.CXNavbar = CXNavbar;
