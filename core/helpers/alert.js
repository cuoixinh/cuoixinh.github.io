/** Thông báo dùng chung: showToast, showLoading. Tự dựng DOM, không cần HTML tĩnh. */

// ─── Icon lucide ────────────────────────────────────────────────────────────
// Nhúng thẳng path thay vì gọi lucide.createIcons(): file này dùng chung cho cả
// landing, account, theme-template và admin — 4 trang KHÔNG nạp thư viện lucide.
// Path lấy từ lucide-static 1.28.0; thêm icon mới thì copy phần trong <svg>.
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
  "file-pen":
    '<path d="M12.5 22H18a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v9.5"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M13.378 15.626a1 1 0 1 0-3.004-3.004l-5.01 5.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506z"/>',
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
      background: rgb(var(--white-rgb));
      border-radius: 16px;
      padding: 12px 16px 12px 12px;
      box-shadow: 0 4px 20px rgb(var(--scrim-rgb)/.10), 0 1px 4px rgb(var(--scrim-rgb)/.06);
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
      color: rgb(var(--text-title-rgb));
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
  const el = document.getElementById("cx-toast");
  const iconEl = document.getElementById("cx-toast-icon");
  const text = document.getElementById("cx-toast-msg");
  if (!el || !iconEl || !text) return;

  const cfg = {
    success: {
      bg: "rgb(var(--state-success-bg-rgb))",
      color: "rgb(var(--state-success-text-rgb))",
    },
    error: {
      bg: "rgb(var(--state-error-bg-rgb))",
      color: "rgb(var(--state-error-text-rgb))",
    },
    warning: {
      bg: "rgb(var(--state-warning-bg-rgb))",
      color: "rgb(var(--state-warning-text-rgb))",
    },
    default: {
      bg: "rgb(var(--surface-control-rgb))",
      color: "rgb(var(--text-tertiary-rgb))",
    },
  };

  const c = cfg[type] || cfg.default;
  const typeIcon = _TOAST_TYPE_ICON[type] || _TOAST_TYPE_ICON.default;
  iconEl.style.background = c.bg;
  iconEl.style.color = c.color;
  _setLucideIcon(iconEl, icon || typeIcon, 18, typeIcon);
  text.innerHTML = msg;

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
      background: rgb(var(--scrim-rgb)/0.45);
      display: none; align-items: center; justify-content: center;
      padding: 20px;
    }
    #cx-alert-backdrop.visible { display: flex; }
    #cx-alert-box {
      background: rgb(var(--white-rgb)); border-radius: 20px;
      width: 100%; max-width: 400px;
      box-shadow: 0 20px 60px rgb(var(--scrim-rgb)/.18);
      overflow: hidden; font-family: inherit;
    }
    /* Tiêu đề canh TRÁI, ngăn với phần đọc bằng một vạch — cùng lối với chân thẻ
       bên dưới, để hộp thoại chia rõ ba tầng: đề mục · nội dung · chỗ bấm. */
    #cx-alert-header {
      display: flex; align-items: center; gap: 10px;
      padding: 16px 20px;
      border-bottom: 1px solid rgb(var(--border-subtle-rgb));
    }
    #cx-alert-icon {
      width: 36px; height: 36px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0; line-height: 0;
    }
    #cx-alert-title { font-size: 15px; font-weight: 700; color: rgb(var(--text-title-rgb)); flex: 1; }
    #cx-alert-body {
      padding: 18px 20px;
      font-size: 13px; color: rgb(var(--text-secondary-rgb)); line-height: 1.7;
      white-space: pre-line; max-height: 50vh; overflow-y: auto;
    }
    /* Nền riêng + vạch ngăn: tách hẳn phần đọc khỏi phần bấm. Chạy sát mép được
       là nhờ #cx-alert-box có overflow:hidden ôm lấy bo góc. */
    #cx-alert-footer {
      padding: 12px 20px; display: flex; justify-content: flex-end; gap: 8px;
      background: rgb(var(--surface-hover-rgb));
      border-top: 1px solid rgb(var(--border-subtle-rgb));
    }
    /* Chỉ còn màu + con trỏ: KHỔ do size="sm" của <x-button> quyết (h-8 px-4
       text-xs). Đặt lại padding/font-size ở đây là đè mất khổ chuẩn, hai nút trong
       hộp thoại sẽ khác mọi nút khác trong app. */
    .cx-dlg-btn {
      cursor: pointer; font-family: inherit; border: none;
      transition: background .15s ease, border-color .15s ease;
    }
    .cx-dlg-cancel { background: rgb(var(--white-rgb)); color: rgb(var(--text-secondary-rgb)); border: 1px solid rgb(var(--border-field-rgb)); }
    .cx-dlg-cancel:hover { background: rgb(var(--surface-hover-rgb)); }
    .cx-dlg-ok { background: rgb(var(--action-primary-rgb)); color: rgb(var(--white-rgb)); }
    .cx-dlg-ok:hover { background: rgb(var(--action-primary-hover-rgb)); }
    /* Ô nhập tuỳ chọn (showPrompt): nằm giữa phần đọc và chân thẻ. */
    #cx-alert-field { padding: 0 20px 18px; }
    .cx-dlg-input {
      width: 100%; height: 40px; padding: 0 14px;
      border: 1px solid rgb(var(--border-field-rgb)); border-radius: 12px;
      font-family: inherit; font-size: 14px; color: rgb(var(--text-title-rgb));
      outline: none; transition: border-color .15s ease, box-shadow .15s ease;
    }
    .cx-dlg-input:focus {
      border-color: rgb(var(--focus-ring-rgb));
      box-shadow: 0 0 0 3px rgb(var(--focus-ring-rgb)/0.18);
    }
    .cx-dlg-hint { margin-top: 8px; font-size: 12px; color: rgb(var(--text-tertiary-rgb)); word-break: break-all; }
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
      <div id="cx-alert-field" class="cx-dlg-hidden">
        <input id="cx-alert-input" class="cx-dlg-input" type="text" autocomplete="off" />
        <p id="cx-alert-hint" class="cx-dlg-hint"></p>
      </div>
      <div id="cx-alert-footer">
        <x-button variant="ghost" size="sm" type="button" id="cx-alert-cancel" class="cx-dlg-btn cx-dlg-cancel"></x-button>
        <x-button variant="ghost" size="sm" type="button" id="cx-alert-ok" class="cx-dlg-btn cx-dlg-ok"></x-button>
      </div>
    </div>`;
  document.body.appendChild(backdrop);

  // Bắt sự kiện Ở BACKDROP chứ không gắn thẳng vào hai nút: <x-button> tự thay
  // mình bằng <button> thật, và khi file này chạy lúc trang đang parse thì việc
  // thay diễn ra tận DOMContentLoaded — listener gắn trước đó nằm lại trên phần
  // tử đã bị vứt, bấm Huỷ/Xác nhận không có gì xảy ra. Backdrop thì không bị thay.
  // BỎ QUA (bấm nền, Esc) trả `null`, còn nút Huỷ trả `false` — hai việc khác
  // nhau: "tôi chọn phương án B" khác "tôi chưa quyết gì cả". Cả hai đều falsy
  // nên `if (await showConfirm(...))` cũ vẫn chạy y nguyên; nơi nào cần phân biệt
  // thì so `=== null`.
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) return _settleDialog(null);
    const btn = e.target.closest("#cx-alert-ok, #cx-alert-cancel");
    if (btn) _settleDialog(btn.id === "cx-alert-ok");
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && backdrop.classList.contains("visible"))
      _settleDialog(null);
  });

  // Enter trong ô nhập = bấm nút chính (hộp thoại không có <form> để submit).
  backdrop.querySelector("#cx-alert-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      _settleDialog(true);
    }
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
  error: {
    icon: "x",
    bg: "rgb(var(--state-error-bg-rgb))",
    color: "rgb(var(--state-error-text-rgb))",
  },
  warning: {
    icon: "triangle-alert",
    bg: "rgb(var(--state-warning-bg-rgb))",
    color: "rgb(var(--state-warning-text-rgb))",
  },
  info: {
    icon: "info",
    bg: "rgb(var(--state-info-bg-rgb))",
    color: "rgb(var(--state-info-text-rgb))",
  },
  success: {
    icon: "check",
    bg: "rgb(var(--state-success-bg-rgb))",
    color: "rgb(var(--state-success-text-rgb))",
  },
};

/**
 * Base dialog dùng chung → Promise<boolean>. confirm=true thì hiện thêm nút Huỷ
 * (2 nút), mặc định 1 nút. icon = tên icon lucide thay icon mặc định của type
 * (màu vẫn theo type).
 */
function showDialog(opts = {}) {
  // Nếu còn hộp thoại cũ chưa đóng → coi như huỷ trước khi mở cái mới.
  if (_dialogResolve) {
    const r = _dialogResolve;
    _dialogResolve = null;
    r(false);
  }

  const c = _DLG_ICONS[opts.type] || _DLG_ICONS.error;
  const icon = document.getElementById("cx-alert-icon");
  icon.style.background = c.bg;
  icon.style.color = c.color;
  _setLucideIcon(icon, opts.icon || c.icon, 20, c.icon);
  document.getElementById("cx-alert-title").textContent = opts.title || "";

  // Mặc định textContent: message thường ghép dữ liệu người dùng vào (tên thư mục,
  // mã khuyến mãi, tên mẫu…) nên đổ thẳng vào innerHTML là mở cửa XSS. Nơi nào cần
  // in đậm/xuống dòng bằng thẻ thì bật html:true và TỰ escape phần biến.
  const body = document.getElementById("cx-alert-body");
  if (opts.html) body.innerHTML = opts.message || "";
  else body.textContent = opts.message || "";

  // Ô nhập chỉ có khi opts.input — dùng qua showPrompt(), xem bên dưới.
  const field = document.getElementById("cx-alert-field");
  const input = document.getElementById("cx-alert-input");
  const hint = document.getElementById("cx-alert-hint");
  field.classList.toggle("cx-dlg-hidden", !opts.input);
  input.oninput = null;
  if (opts.input) {
    input.value = opts.input.value || "";
    input.placeholder = opts.input.placeholder || "";
    const sync = () => {
      hint.textContent = opts.input.hint ? opts.input.hint(input.value) : "";
    };
    if (opts.input.hint) input.oninput = sync;
    sync();
    hint.classList.toggle("cx-dlg-hidden", !opts.input.hint);
    setTimeout(() => input.focus(), 0); // hộp thoại vừa hiện mới focus được
  }

  const okBtn = document.getElementById("cx-alert-ok");
  const cancelBtn = document.getElementById("cx-alert-cancel");
  okBtn.textContent = opts.okText || (opts.confirm ? "Xác nhận" : "Đã hiểu");
  cancelBtn.textContent = opts.cancelText || "Huỷ";
  cancelBtn.classList.toggle("cx-dlg-hidden", !opts.confirm); // alert → ẩn nút Huỷ

  document.getElementById("cx-alert-backdrop").classList.add("visible");
  return new Promise((resolve) => {
    _dialogResolve = resolve;
  });
}

/** Alert 1 nút. message hỗ trợ xuống dòng; icon thay icon mặc định của type. */
function showAlert(title, message, type = "error", icon = null) {
  return showDialog({ title, message, type, icon });
}

/**
 * Hộp thoại có MỘT ô nhập → Promise<string|null> (null = huỷ/đóng).
 * opts: { message, value, placeholder, hint(value)→string, okText, type, icon }.
 * `hint` chạy lại mỗi lần gõ — dùng để xem trước kết quả (vd. đường dẫn thiệp).
 */
function showPrompt(title, opts = {}) {
  return showDialog({
    title,
    message: opts.message,
    type: opts.type || "info",
    icon: opts.icon,
    confirm: true,
    okText: opts.okText || "Lưu",
    cancelText: opts.cancelText,
    input: {
      value: opts.value,
      placeholder: opts.placeholder,
      hint: opts.hint,
    },
  }).then((ok) =>
    ok ? document.getElementById("cx-alert-input").value : null,
  );
}

/** Confirm 2 nút (Huỷ / Xác nhận) → Promise<boolean>. */
function showConfirm(title, message, opts = {}) {
  return showDialog({
    title,
    message,
    type: opts.type || "warning",
    icon: opts.icon,
    confirm: true,
    okText: opts.confirmText,
    cancelText: opts.cancelText,
    html: opts.html,
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
    "position:fixed;inset:0;background:rgb(var(--scrim-rgb)/0.5);z-index:99998;" +
    "display:none;align-items:center;justify-content:center;flex-direction:column;gap:12px;";

  overlay.innerHTML = `
    <div style="width:224px;height:4px;background:rgb(var(--white-rgb)/0.2);border-radius:999px;overflow:hidden">
      <div style="height:100%;width:40%;background:rgb(var(--brand-accent-rgb));border-radius:999px;animation:cxLoadingBar 1.1s ease-in-out infinite"></div>
    </div>
    <p id="cx-loading-msg" style="font-size:12px;font-weight:500;color:rgb(var(--white-rgb)/0.8);font-family:inherit">Đang xử lý...</p>
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
