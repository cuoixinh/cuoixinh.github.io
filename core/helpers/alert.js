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

function showToast(msg, type = "default") {
  const el    = document.getElementById("cx-toast");
  const icon  = document.getElementById("cx-toast-icon");
  const text  = document.getElementById("cx-toast-msg");
  if (!el || !icon || !text) return;

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
  icon.style.background = c.bg;
  icon.style.color      = c.color;
  icon.textContent      = c.symbol;
  text.innerHTML        = msg.replace(/^[✅❌⚠️📋🗑️]\s*/, ""); // strip leading emoji

  el.classList.add("visible");

  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove("visible"), 3200);
}

// ─── Alert dialog ────────────────────────────────────────────────────────────

(function _initAlert() {
  const style = document.createElement("style");
  style.textContent = `
    #cx-alert-backdrop {
      position: fixed; inset: 0; z-index: 999999;
      background: rgba(0,0,0,0.45);
      display: none; align-items: center; justify-content: center;
      padding: 20px;
    }
    #cx-alert-backdrop.visible { display: flex; }
    #cx-alert-box {
      background: #fff;
      border-radius: 20px;
      width: 100%; max-width: 400px;
      box-shadow: 0 20px 60px rgba(0,0,0,.18);
      overflow: hidden;
      font-family: inherit;
    }
    #cx-alert-header {
      display: flex; align-items: center; gap: 10px;
      padding: 18px 20px 14px;
      border-bottom: 1px solid #f3f4f6;
    }
    #cx-alert-icon {
      width: 36px; height: 36px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0; font-size: 17px; font-weight: 700;
    }
    #cx-alert-title {
      font-size: 15px; font-weight: 700; color: #1f2937; flex: 1;
    }
    #cx-alert-body {
      padding: 14px 20px 18px;
      font-size: 13px; color: #4b5563; line-height: 1.7;
      white-space: pre-line;
      max-height: 50vh; overflow-y: auto;
    }
    #cx-alert-footer {
      padding: 0 20px 18px;
      display: flex; justify-content: flex-end;
    }
    #cx-alert-close {
      background: #f43f5e; color: #fff;
      border: none; cursor: pointer;
      padding: 9px 24px; border-radius: 999px;
      font-size: 13px; font-weight: 600; font-family: inherit;
    }
    #cx-alert-close:hover { background: #e11d48; }
  `;
  document.head.appendChild(style);

  const backdrop = document.createElement("div");
  backdrop.id = "cx-alert-backdrop";
  backdrop.innerHTML = `
    <div id="cx-alert-box">
      <div id="cx-alert-header">
        <div id="cx-alert-icon"></div>
        <div id="cx-alert-title"></div>
      </div>
      <div id="cx-alert-body"></div>
      <div id="cx-alert-footer">
        <button id="cx-alert-close">Đã hiểu</button>
      </div>
    </div>`;
  document.body.appendChild(backdrop);

  document.getElementById("cx-alert-close").addEventListener("click", _closeAlert);
  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) _closeAlert(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") _closeAlert(); });
})();

function _closeAlert() {
  document.getElementById("cx-alert-backdrop").classList.remove("visible");
}

/**
 * @param {string} title
 * @param {string} message  — supports \n for line breaks
 * @param {"error"|"warning"|"info"} type
 */
function showAlert(title, message, type = "error") {
  const cfg = {
    error:   { symbol: "✕", bg: "#fee2e2", color: "#dc2626" },
    warning: { symbol: "!",  bg: "#fef3c7", color: "#d97706" },
    info:    { symbol: "i",  bg: "#eff6ff", color: "#2563eb" },
  };
  const c = cfg[type] || cfg.error;

  document.getElementById("cx-alert-icon").style.background = c.bg;
  document.getElementById("cx-alert-icon").style.color      = c.color;
  document.getElementById("cx-alert-icon").textContent      = c.symbol;
  document.getElementById("cx-alert-title").textContent     = title;
  document.getElementById("cx-alert-body").textContent      = message;
  document.getElementById("cx-alert-backdrop").classList.add("visible");
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
