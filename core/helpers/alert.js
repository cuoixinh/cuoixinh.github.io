/**
 * alert.js — Shared UI notification helpers
 * Provides: showToast, showLoading
 * Creates DOM elements dynamically — no static HTML required.
 */

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
      font-size: 15px;
      font-weight: 700;
      line-height: 1;
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

// icon (tuỳ chọn): tên icon lucide (vd "copy") → hiện thay cho ký hiệu mặc định của type.
function showToast(msg, type = "default", icon = null) {
  const el    = document.getElementById("cx-toast");
  const iconEl = document.getElementById("cx-toast-icon");
  const text  = document.getElementById("cx-toast-msg");
  if (!el || !iconEl || !text) return;

  const cfg = {
    success: { symbol: "✓", bg: "#dcfce7", color: "#15803d" },
    error:   { symbol: "✕", bg: "#fee2e2", color: "#dc2626" },
    warning: { symbol: "!",  bg: "#fef3c7", color: "#d97706" },
    default: { symbol: "·",  bg: "#f3f4f6", color: "#6b7280" },
  };

  // auto-detect type from emoji prefix if no explicit type given
  if (type === "default") {
    if (msg.startsWith("✅"))      type = "success";
    else if (msg.startsWith("❌")) type = "error";
    else if (msg.startsWith("⚠️")) type = "warning";
  }

  const c = cfg[type] || cfg.default;
  iconEl.style.background = c.bg;
  iconEl.style.color      = c.color;
  if (icon && typeof lucide !== "undefined") {
    iconEl.innerHTML = `<i data-lucide="${icon}" style="width:16px;height:16px"></i>`;
    lucide.createIcons();
  } else {
    iconEl.innerHTML = "";
    iconEl.textContent = c.symbol;
  }
  text.innerHTML        = msg.replace(/^[✅❌⚠️📋🗑️]\s*/, ""); // strip leading emoji

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
      flex-shrink: 0; font-size: 17px; font-weight: 700;
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
  error:   { symbol: "✕", bg: "#fee2e2", color: "#dc2626" },
  warning: { symbol: "!", bg: "#fef3c7", color: "#d97706" },
  info:    { symbol: "i", bg: "#eff6ff", color: "#2563eb" },
  success: { symbol: "✓", bg: "#dcfce7", color: "#15803d" },
};

/**
 * Base dialog dùng chung → Promise<boolean>.
 * @param {{title?:string, message?:string, type?:"error"|"warning"|"info"|"success",
 *          confirm?:boolean, okText?:string, cancelText?:string}} opts
 *   confirm=true → hiện thêm nút Huỷ (2 nút); mặc định chỉ 1 nút (alert).
 */
function showDialog(opts = {}) {
  // Nếu còn hộp thoại cũ chưa đóng → coi như huỷ trước khi mở cái mới.
  if (_dialogResolve) { const r = _dialogResolve; _dialogResolve = null; r(false); }

  const c = _DLG_ICONS[opts.type] || _DLG_ICONS.error;
  const icon = document.getElementById("cx-alert-icon");
  icon.style.background = c.bg;
  icon.style.color = c.color;
  icon.textContent = c.symbol;
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
 * @param {"error"|"warning"|"info"} type
 */
function showAlert(title, message, type = "error") {
  return showDialog({ title, message, type });
}

/**
 * Confirm 2 nút (Huỷ / Xác nhận) → Promise<boolean>.
 * @param {string} title
 * @param {string} message — hỗ trợ \n
 * @param {{type?:"warning"|"error"|"info", confirmText?:string, cancelText?:string}} [opts]
 */
function showConfirm(title, message, opts = {}) {
  return showDialog({
    title,
    message,
    type: opts.type || "warning",
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
