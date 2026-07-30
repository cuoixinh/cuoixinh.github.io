/**
 * alert.js — Shared UI notification helpers
 * Provides: showToast, showLoading
 * Creates DOM elements dynamically — no static HTML required.
 */

// ─── Icon lucide ─────────────────────────────────────────────────────────────
// Nhúng thẳng path thay vì gọi lucide.createIcons(): file này dùng chung cho CẢ
// landing, account, theme-template và admin — 4 trang KHÔNG nạp thư viện lucide
// (chỉ invitation-setup + guests có). Phụ thuộc window.lucide thì 4 trang đó
// icon trống trơn. Path lấy từ lucide-static 1.28.0 nên trùng khít bộ nét với
// icon lucide trong trang. Thêm icon mới: copy phần trong <svg> của icon tương ứng.
const _LUCIDE_PATHS = {
  check: '<path d="M20 6 9 17l-5-5"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  "triangle-alert":
    '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  sparkles:
    '<path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z"/><path d="M20 2v4"/><path d="M22 4h-4"/><circle cx="4" cy="20" r="2"/>',
  "trash-2":
    '<path d="M10 11v6"/><path d="M14 11v6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  clipboard:
    '<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>',
  copy: '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  "folder-open":
    '<path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2"/>',
  hourglass:
    '<path d="M5 22h14"/><path d="M5 2h14"/><path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22"/><path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"/>',
};

// Trả về markup svg của icon lucide, hoặc null nếu chưa nhúng path tên đó.
function _lucideSvg(name, size) {
  const inner = _LUCIDE_PATHS[name];
  if (!inner) return null;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" ` +
    `viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" ` +
    `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`
  );
}

// Đặt icon lucide vào 1 ô tròn. Tên ngoài bộ nhúng sẵn → mượn thư viện lucide
// nếu trang có nạp; không có nữa thì rơi về icon dự phòng cho khỏi trống ô.
function _setLucideIcon(el, name, size, fallback) {
  const svg = _lucideSvg(name, size);
  if (svg) {
    el.innerHTML = svg;
  } else if (typeof lucide !== "undefined") {
    el.innerHTML = `<i data-lucide="${name}" style="width:${size}px;height:${size}px"></i>`;
    lucide.createIcons({ nodes: [el] });
  } else {
    el.innerHTML = _lucideSvg(fallback, size) || "";
  }
}

// ─── Toast ───────────────────────────────────────────────────────────────────

(function _initToast() {
  const style = document.createElement("style");
  style.textContent = `
    #cx-toast {
      position: fixed;
      top: var(--toast-top, 20px);
      left: 50%;
      transform: translateX(-50%) translateY(-16px);
      z-index: 2147483647; /* luôn trên mọi popup/overlay (auth modal, loading…) */
      pointer-events: none;
      opacity: 0;
      transition: opacity .2s ease, transform .2s ease;
      width: calc(100% - 32px);
      max-width: 360px;
    }
    #cx-toast.visible {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
    #cx-toast-inner {
      display: flex;
      align-items: center;
      gap: 10px;
      background: #fff;
      border-radius: 16px;
      padding: 12px 16px 12px 12px;
      box-shadow: 0 4px 20px rgba(0,0,0,.10), 0 1px 4px rgba(0,0,0,.06);
      font-family: inherit;
    }
    #cx-toast-icon {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      line-height: 0;
    }
    #cx-toast-msg {
      flex: 1;
      font-size: 13px;
      font-weight: 500;
      color: #1f2937;
      line-height: 1.45;
    }
  `;
  document.head.appendChild(style);

  const el = document.createElement("div");
  el.id = "cx-toast";
  el.innerHTML = `
    <div id="cx-toast-inner">
      <div id="cx-toast-icon"></div>
      <div id="cx-toast-msg"></div>
    </div>`;
  document.body.appendChild(el);
})();

let _toastTimer = null;

const _TOAST_TYPE_ICON = {
  success: "check",
  error: "x",
  warning: "triangle-alert",
  default: "info",
};

// type quyết định màu + icon mặc định. icon (tuỳ chọn): tên icon lucide (vd "copy")
// để đổi riêng icon mà vẫn giữ màu của type — tên có sẵn xem _LUCIDE_PATHS.
function showToast(msg, type = "default", icon = null) {
  const el    = document.getElementById("cx-toast");
  const iconEl = document.getElementById("cx-toast-icon");
  const text  = document.getElementById("cx-toast-msg");
  if (!el || !iconEl || !text) return;

  const cfg = {
    success: { bg: "#dcfce7", color: "#15803d" },
    error:   { bg: "#fee2e2", color: "#dc2626" },
    warning: { bg: "#fef3c7", color: "#d97706" },
    default: { bg: "#f3f4f6", color: "#6b7280" },
  };

  const c        = cfg[type] || cfg.default;
  const typeIcon = _TOAST_TYPE_ICON[type] || _TOAST_TYPE_ICON.default;
  iconEl.style.background = c.bg;
  iconEl.style.color      = c.color;
  _setLucideIcon(iconEl, icon || typeIcon, 18, typeIcon);
  text.innerHTML        = msg;

  el.classList.add("visible");

  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove("visible"), 3200);
}

// ─── Dialog (alert 1 nút / confirm 2 nút) ────────────────────────────────────
// Một base dialog dùng chung: showDialog(opts) → Promise<boolean> (true = nút chính,
// false = huỷ/đóng). showAlert & showConfirm chỉ là wrapper mỏng cho 2 kiểu phổ biến.

(function _initDialog() {
  const style = document.createElement("style");
  style.textContent = `
    #cx-alert-backdrop {
      position: fixed; inset: 0; z-index: 1000000;
      background: rgba(0,0,0,0.45);
      display: none; align-items: center; justify-content: center;
      padding: 20px;
    }
    #cx-alert-backdrop.visible { display: flex; }
    #cx-alert-box {
      background: #fff; border-radius: 20px;
      width: 100%; max-width: 400px;
      box-shadow: 0 20px 60px rgba(0,0,0,.18);
      overflow: hidden; font-family: inherit;
    }
    #cx-alert-header {
      display: flex; align-items: center; gap: 10px;
      padding: 18px 20px 14px;
    }
    #cx-alert-icon {
      width: 36px; height: 36px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0; line-height: 0;
    }
    #cx-alert-title { font-size: 15px; font-weight: 700; color: #1f2937; flex: 1; }
    #cx-alert-body {
      padding: 0 20px 18px;
      font-size: 13px; color: #4b5563; line-height: 1.7;
      white-space: pre-line; max-height: 50vh; overflow-y: auto;
    }
    #cx-alert-footer { padding: 0 20px 18px; display: flex; gap: 10px; }
    .cx-dlg-btn {
      flex: 1; cursor: pointer; padding: 10px 16px; border-radius: 999px;
      font-size: 13px; font-weight: 600; font-family: inherit; border: none;
      transition: background .15s ease, border-color .15s ease;
    }
    .cx-dlg-cancel { background: #fff; color: #4b5563; border: 1px solid #e5e7eb; }
    .cx-dlg-cancel:hover { background: #f9fafb; }
    .cx-dlg-ok { background: #f43f5e; color: #fff; }
    .cx-dlg-ok:hover { background: #e11d48; }
    .cx-dlg-hidden { display: none !important; }
  `;
  document.head.appendChild(style);

  const backdrop = document.createElement("div");
  backdrop.id = "cx-alert-backdrop";
  backdrop.innerHTML = `
    <div id="cx-alert-box" role="dialog" aria-modal="true">
      <div id="cx-alert-header">
        <div id="cx-alert-icon"></div>
        <div id="cx-alert-title"></div>
      </div>
      <div id="cx-alert-body"></div>
      <div id="cx-alert-footer">
        <button type="button" id="cx-alert-cancel" class="cx-dlg-btn cx-dlg-cancel"></button>
        <button type="button" id="cx-alert-ok" class="cx-dlg-btn cx-dlg-ok"></button>
      </div>
    </div>`;
  document.body.appendChild(backdrop);

  document.getElementById("cx-alert-ok").addEventListener("click", () => _settleDialog(true));
  document.getElementById("cx-alert-cancel").addEventListener("click", () => _settleDialog(false));
  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) _settleDialog(false); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && backdrop.classList.contains("visible")) _settleDialog(false);
  });
})();

let _dialogResolve = null;

function _settleDialog(val) {
  document.getElementById("cx-alert-backdrop")?.classList.remove("visible");
  const r = _dialogResolve;
  _dialogResolve = null;
  if (r) r(val);
}

const _DLG_ICONS = {
  error:   { icon: "x",              bg: "#fee2e2", color: "#dc2626" },
  warning: { icon: "triangle-alert", bg: "#fef3c7", color: "#d97706" },
  info:    { icon: "info",           bg: "#eff6ff", color: "#2563eb" },
  success: { icon: "check",          bg: "#dcfce7", color: "#15803d" },
};

/**
 * Base dialog dùng chung → Promise<boolean>.
 * @param {{title?:string, message?:string, type?:"error"|"warning"|"info"|"success",
 *          icon?:string, confirm?:boolean, okText?:string, cancelText?:string}} opts
 *   confirm=true → hiện thêm nút Huỷ (2 nút); mặc định chỉ 1 nút (alert).
 *   icon → tên icon lucide thay cho icon mặc định của type, MÀU vẫn theo type.
 */
function showDialog(opts = {}) {
  // Nếu còn hộp thoại cũ chưa đóng → coi như huỷ trước khi mở cái mới.
  if (_dialogResolve) { const r = _dialogResolve; _dialogResolve = null; r(false); }

  const c = _DLG_ICONS[opts.type] || _DLG_ICONS.error;
  const icon = document.getElementById("cx-alert-icon");
  icon.style.background = c.bg;
  icon.style.color = c.color;
  _setLucideIcon(icon, opts.icon || c.icon, 20, c.icon);
  document.getElementById("cx-alert-title").textContent = opts.title || "";
  document.getElementById("cx-alert-body").textContent = opts.message || "";

  const okBtn = document.getElementById("cx-alert-ok");
  const cancelBtn = document.getElementById("cx-alert-cancel");
  okBtn.textContent = opts.okText || (opts.confirm ? "Xác nhận" : "Đã hiểu");
  cancelBtn.textContent = opts.cancelText || "Huỷ";
  cancelBtn.classList.toggle("cx-dlg-hidden", !opts.confirm); // alert → ẩn nút Huỷ

  document.getElementById("cx-alert-backdrop").classList.add("visible");
  return new Promise((resolve) => { _dialogResolve = resolve; });
}

/**
 * Alert 1 nút (giữ nguyên chữ ký cũ).
 * @param {string} title
 * @param {string} message — hỗ trợ \n
 * @param {"error"|"warning"|"info"|"success"} [type]
 * @param {string} [icon] — tên icon lucide thay icon mặc định của type (màu giữ theo type)
 */
function showAlert(title, message, type = "error", icon = null) {
  return showDialog({ title, message, type, icon });
}

/**
 * Confirm 2 nút (Huỷ / Xác nhận) → Promise<boolean>.
 * @param {string} title
 * @param {string} message — hỗ trợ \n
 * @param {{type?:"warning"|"error"|"info"|"success", icon?:string,
 *          confirmText?:string, cancelText?:string}} [opts]
 */
function showConfirm(title, message, opts = {}) {
  return showDialog({
    title,
    message,
    type: opts.type || "warning",
    icon: opts.icon,
    confirm: true,
    okText: opts.confirmText,
    cancelText: opts.cancelText,
  });
}

// ─── Loading overlay ─────────────────────────────────────────────────────────

(function _initLoading() {
  const style = document.createElement("style");
  style.textContent = `
    @keyframes cxLoadingBar {
      0%   { transform: translateX(-100%); }
      100% { transform: translateX(300%); }
    }
  `;
  document.head.appendChild(style);

  const overlay = document.createElement("div");
  overlay.id = "cx-loading";
  overlay.style.cssText =
    "position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:99998;" +
    "display:none;align-items:center;justify-content:center;flex-direction:column;gap:12px;";

  overlay.innerHTML = `
    <div style="width:224px;height:4px;background:rgba(255,255,255,0.2);border-radius:999px;overflow:hidden">
      <div style="height:100%;width:40%;background:#ec829e;border-radius:999px;animation:cxLoadingBar 1.1s ease-in-out infinite"></div>
    </div>
    <p id="cx-loading-msg" style="font-size:12px;font-weight:500;color:rgba(255,255,255,0.8);font-family:inherit">Đang xử lý...</p>
  `;
  document.body.appendChild(overlay);
})();

function showLoading(show, message) {
  const overlay = document.getElementById("cx-loading");
  if (!overlay) return;

  if (show) {
    if (message) {
      const msg = document.getElementById("cx-loading-msg");
      if (msg) msg.textContent = message;
    }
    overlay.style.display = "flex";
  } else {
    overlay.style.display = "none";
    const msg = document.getElementById("cx-loading-msg");
    if (msg) msg.textContent = "Đang xử lý...";
  }
}
