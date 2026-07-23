// ============================================================
// THEME-SETTING-HELPER.JS
// Áp dụng tuỳ chỉnh font + màu chữ (theme_setting) lên thiệp.
// Dùng chung cho: trang thiệp public, chế độ xem trước, trình soạn thiệp.
// ============================================================

// Danh sách font (Google Fonts) — đều hỗ trợ tiếng Việt.
// type: 'heading' (serif/display cho tiêu đề) | 'body' (sans cho nội dung) | 'both'
const THEME_FONTS = [
  // — Tiêu đề: serif / display (đều có bộ ký tự tiếng Việt) —
  { name: "Playfair Display", type: "heading" },
  { name: "Cormorant Garamond", type: "heading" },
  { name: "Cormorant SC", type: "heading" },
  { name: "Prata", type: "heading" },
  { name: "Merriweather", type: "heading" },
  { name: "EB Garamond", type: "heading" },
  { name: "Yeseva One", type: "heading" },
  // — Tiêu đề nghệ thuật: chữ viết tay / thư pháp —
  { name: "Dancing Script", type: "heading" },
  { name: "Great Vibes", type: "heading" },
  { name: "Pacifico", type: "heading" },
  { name: "Lobster", type: "heading" },
  { name: "Allura", type: "heading" },
  { name: "Alex Brush", type: "heading" },
  { name: "Pinyon Script", type: "heading" },
  { name: "Style Script", type: "heading" },
  { name: "Birthstone", type: "heading" },
  { name: "Fleur De Leah", type: "heading" },
  // — Dùng được cả tiêu đề lẫn nội dung —
  { name: "Lora", type: "both" },
  { name: "Vollkorn", type: "both" },
  { name: "Noto Serif", type: "both" },
  // — Nội dung: sans-serif dễ đọc —
  { name: "Inter", type: "body" },
  { name: "Be Vietnam Pro", type: "body" },
  { name: "Montserrat", type: "body" },
  { name: "Nunito", type: "body" },
  { name: "Nunito Sans", type: "body" },
  { name: "Quicksand", type: "body" },
  { name: "Josefin Sans", type: "body" },
  { name: "Roboto", type: "body" },
  { name: "Open Sans", type: "body" },
  { name: "Source Sans 3", type: "body" },
  { name: "Mulish", type: "body" },
  { name: "Work Sans", type: "body" },
  { name: "Manrope", type: "body" },
  { name: "Lexend", type: "body" },
];

// Font + màu GỐC của từng theme (đúng như thiết kế ban đầu).
// Dùng làm giá trị mặc định hiển thị trên thanh chỉnh và điểm khôi phục.
// Theme chưa khai báo ở đây sẽ rơi về bộ mặc định chung của trình soạn thiệp.
const THEME_PRESETS = {
  "basic-gold": {
    heading_font: "Playfair Display", // .font-playfair
    body_font: "Inter", // .font-inter
    heading_color: "#6b6562", // stone-custom-500
    body_color: "#78716c", // stone-custom-400
    accent_color: "#d4a5a5", // rose-pastel-300
    background_color: "#fffbf7", // #main-card
    // Màu gợi ý trong bảng chọn — lấy từ chính palette của theme
    // (tailwind.config.js: stone-custom, rose-pastel, cream)
    swatches: [
      "#6b6562", // stone-custom-500
      "#78716c", // stone-custom-400
      "#44403c", // stone-custom-600
      "#2d2d2d",
      "#d4a5a5", // rose-pastel-300
      "#e8b4b8", // rose-pastel-200
      "#f5d5d8", // rose-pastel-100
      "#fef0f2", // rose-pastel-50
      "#fffbf7", // cream-50
      "#fff5f0", // cream-100
      "#ffe8e0", // cream-200
      "#ffffff",
    ],
  },
};

// Màu gợi ý cho picker
const THEME_HEADING_COLORS = ["#2d2d2d", "#4a3f35", "#3b4a3f", "#5c4033", "#1f2937", "#7a4b52"];
const THEME_BODY_COLORS = ["#78716c", "#57534e", "#6b6562", "#4a4a4a", "#5a5148", "#44403c"];
const THEME_ACCENT_COLORS = ["#c0a062", "#b98a3c", "#7fa38a", "#d4a5a5", "#a8763e", "#9caf88"];

// Các class font/màu mà theme đang dùng → ghi đè khi có theme_setting.
const HEADING_FONT_SELECTORS = ".font-cormorant, .font-playfair, .font-cinzel, .font-prata";
const BODY_FONT_SELECTORS = "body, .font-inter";
// Tiêu đề = chữ lớn đậm; Nội dung = chữ đọc thường; Nhấn = icon/hoa văn/viền trang trí.
const HEADING_COLOR_SELECTORS =
  ".text-charcoal, .text-stone-custom-500";
const BODY_COLOR_SELECTORS =
  ".text-stone-custom-400";
const ACCENT_COLOR_SELECTORS =
  ".text-gold-400, .text-gold-300, .text-sage-400, .text-sage-300, .text-rose-pastel-300, .text-rose-pastel-200";
// Nền thiệp: body (khung ngoài) + thẻ chính của thiệp.
const BACKGROUND_COLOR_SELECTORS = "body, #main-card";

let _loadedFonts = new Set();

// ── Sanitize cho ghi đè theo từng dòng (text_overrides) ─────────────────────
// text_overrides được render trên CẢ trang public nên phải làm sạch trước khi
// nhét vào CSS. Selector do runtime chỉnh-tay tự sinh (chỉ #id, tag, :nth-child).
function _cxSafeSelector(sel) {
  if (typeof sel !== "string" || !sel || sel.length > 400) return "";
  return /^[#.\w\s>:()[\]="'-]+$/.test(sel) ? sel : "";
}
function _cxSafeFont(f) {
  return typeof f === "string" ? f.replace(/['"\\<>{}]/g, "").trim() : "";
}
function _cxSafeColor(c) {
  return (
    typeof c === "string" &&
    /^(#[0-9a-fA-F]{3,8}|rgba?\([\d.,\s%]+\))$/.test(c.trim())
  );
}
function _cxSafeNum(n) {
  const v = Number(n);
  return Number.isFinite(v) && v > 0 && v < 1000;
}

// Nạp 1 Google Font (nếu chưa nạp)
function _loadGoogleFont(fontName) {
  if (!fontName || _loadedFonts.has(fontName)) return;
  _loadedFonts.add(fontName);
  const family = fontName.trim().replace(/\s+/g, "+");
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${family}:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&display=swap`;
  document.head.appendChild(link);
}

/**
 * Áp dụng theme_setting lên trang hiện tại.
 * @param {Object|string} setting - { heading_font, body_font, heading_color, body_color, accent_color, background_color }
 */
function applyThemeSetting(setting) {
  if (typeof setting === "string") {
    try {
      setting = JSON.parse(setting);
    } catch (e) {
      setting = null;
    }
  }
  if (!setting || typeof setting !== "object") return;

  const rules = [];

  if (setting.heading_font) {
    _loadGoogleFont(setting.heading_font);
    rules.push(
      `${HEADING_FONT_SELECTORS} { font-family: '${setting.heading_font}', serif !important; }`,
    );
  }

  if (setting.body_font) {
    _loadGoogleFont(setting.body_font);
    rules.push(
      `${BODY_FONT_SELECTORS} { font-family: '${setting.body_font}', sans-serif !important; }`,
    );
  }

  if (setting.heading_color) {
    rules.push(`${HEADING_COLOR_SELECTORS} { color: ${setting.heading_color} !important; }`);
  }

  if (setting.body_color) {
    rules.push(`${BODY_COLOR_SELECTORS} { color: ${setting.body_color} !important; }`);
  }

  if (setting.accent_color) {
    rules.push(`${ACCENT_COLOR_SELECTORS} { color: ${setting.accent_color} !important; }`);
  }

  if (setting.background_color) {
    rules.push(
      `${BACKGROUND_COLOR_SELECTORS} { background-color: ${setting.background_color} !important; }`,
    );
  }

  // ── Ghi đè chi tiết TỪNG DÒNG chữ (tính năng nâng cao) ────────────────────
  // setting.text_overrides = { "<selector>": { font, size, color, weight, italic, align } }
  // Selector là đường dẫn dài (nth-child) → độ ưu tiên cao hơn rule class chung
  // ở trên nên thắng. Vẫn dùng !important để chắc ăn với style inline của theme.
  if (setting.text_overrides && typeof setting.text_overrides === "object") {
    for (const [sel, o] of Object.entries(setting.text_overrides)) {
      const safeSel = _cxSafeSelector(sel);
      if (!safeSel || !o || typeof o !== "object") continue;
      const decls = [];
      if (o.font) {
        const f = _cxSafeFont(o.font);
        if (f) {
          _loadGoogleFont(f);
          decls.push(`font-family: '${f}', serif !important`);
        }
      }
      if (_cxSafeNum(o.size)) decls.push(`font-size: ${Number(o.size)}px !important`);
      if (_cxSafeColor(o.color)) decls.push(`color: ${o.color.trim()} !important`);
      if (_cxSafeNum(o.weight)) decls.push(`font-weight: ${Number(o.weight)} !important`);
      if (o.italic) decls.push(`font-style: italic !important`);
      if (o.underline) decls.push(`text-decoration: underline !important`);
      if (o.align && /^(left|center|right|justify)$/.test(o.align))
        decls.push(`text-align: ${o.align} !important`);
      // Kích thước ảnh (khung ảnh). Gỡ max-width/height để ảnh phóng to vượt cỡ gốc được.
      const hasSize = _cxSafeNum(o.width) || _cxSafeNum(o.height);
      if (_cxSafeNum(o.width)) decls.push(`width: ${Number(o.width)}px !important`);
      if (_cxSafeNum(o.height)) decls.push(`height: ${Number(o.height)}px !important`);
      if (hasSize)
        decls.push(`max-width: none !important`, `max-height: none !important`);
      if (decls.length) rules.push(`${safeSel} { ${decls.join("; ")} }`);
    }
  }

  let styleEl = document.getElementById("theme-setting-override");
  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = "theme-setting-override";
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = rules.join("\n");
}

// Export ra global (các theme dùng qua <script>, không có module system)
if (typeof window !== "undefined") {
  window.THEME_FONTS = THEME_FONTS;
  window.loadThemeFont = _loadGoogleFont; // để bảng chọn nạp trước font cho preview
  window.THEME_PRESETS = THEME_PRESETS;
  window.THEME_HEADING_COLORS = THEME_HEADING_COLORS;
  window.THEME_BODY_COLORS = THEME_BODY_COLORS;
  window.THEME_ACCENT_COLORS = THEME_ACCENT_COLORS;
  window.applyThemeSetting = applyThemeSetting;
}

// ============================================================
// EDIT RUNTIME — chỉnh chi tiết từng dòng chữ.
// CHỈ chạy bên trong iframe preview của tab Giao diện: ?preview=true&edit=1.
// Rê chuột → highlight vùng có chữ; click → gửi selector + style hiện tại về
// trang cha (postMessage) để mở bảng chỉnh riêng. Trang cha (không có edit=1)
// và tab Xem trước (không có edit=1) sẽ KHÔNG kích hoạt runtime này.
// ============================================================
(function _cxTextEditRuntime() {
  if (typeof window === "undefined" || window.top === window) return; // phải ở trong iframe
  let params;
  try {
    params = new URLSearchParams(window.location.search);
  } catch (e) {
    return;
  }
  if (params.get("edit") !== "1" || params.get("preview") !== "true") return;

  let hovered = null;
  let picked = null;
  let tip = null;

  // Phần tử "chỉnh được": có text-node trực tiếp, không nằm trong control tương tác.
  function _isEditable(el) {
    if (!el || el.nodeType !== 1) return false;
    if (
      el.closest(
        "a, button, input, textarea, select, iframe, [contenteditable], .cx-no-edit",
      )
    )
      return false;
    for (const n of el.childNodes) {
      if (n.nodeType === 3 && n.nodeValue.trim()) return true;
    }
    return false;
  }

  // Từ target (có thể là inline con) đi lên tối đa vài bậc tìm phần tử có text.
  function _resolveTextEl(target) {
    let el = target;
    for (let i = 0; el && i < 4; i++, el = el.parentElement) {
      if (_isEditable(el)) return el;
    }
    return null;
  }

  // Với ảnh: đổi kích thước ở KHUNG bao sát ảnh (ảnh thường w-full/h-full trong khung
  // nên chỉnh thẳng <img> sẽ không thấy). Đi lên qua các lớp bọc CÙNG kích thước ảnh
  // tới khung ngoài cùng — chính nó quyết định kích thước hiển thị.
  function _imgResizeTarget(img) {
    let el = img;
    const ir = img.getBoundingClientRect();
    let parent = el.parentElement;
    while (parent && el.id !== "main-card" && el !== document.body) {
      const pr = parent.getBoundingClientRect();
      const tight =
        Math.abs(pr.width - ir.width) < 3 && Math.abs(pr.height - ir.height) < 3;
      if (!tight) break;
      el = parent;
      parent = parent.parentElement;
    }
    return el;
  }

  // Phân giải phần tử đang trỏ: ảnh (chỉnh kích thước) hay chữ (chỉnh phông…).
  function _resolveTarget(target) {
    const img = target && target.closest ? target.closest("img") : null;
    if (img && !img.closest("a, button, .cx-no-edit"))
      return { el: _imgResizeTarget(img), isImage: true };
    const el = _resolveTextEl(target);
    return el ? { el, isImage: false } : null;
  }

  // Gửi thông tin ẢNH (selector + kích thước + tỉ lệ hiện tại) về trang cha.
  function _sendImgPick(el, selector) {
    const r = el.getBoundingClientRect();
    const w = Math.round(r.width);
    const h = Math.round(r.height);
    parent.postMessage(
      {
        type: "cx-text-pick",
        isImage: true,
        selector: selector || _selector(el),
        sample: "ảnh",
        width: w,
        height: h,
        ratio: h ? w / h : 1,
      },
      "*",
    );
  }

  // Selector ỔN ĐỊNH: đi lên tới tổ tiên gần nhất có id "sạch" (hoặc body), ghép
  // :nth-child. Cùng data → cùng DOM nên khớp giữa preview và trang public.
  function _selector(el) {
    const parts = [];
    let node = el;
    while (
      node &&
      node.nodeType === 1 &&
      node !== document.body &&
      node !== document.documentElement
    ) {
      if (node.id && /^[A-Za-z][\w-]*$/.test(node.id)) {
        parts.unshift("#" + node.id);
        return parts.join(" > ");
      }
      const parent = node.parentElement;
      if (!parent) break;
      const idx = Array.prototype.indexOf.call(parent.children, node) + 1;
      parts.unshift(node.tagName.toLowerCase() + ":nth-child(" + idx + ")");
      node = parent;
    }
    parts.unshift("body");
    return parts.join(" > ");
  }

  function _rgbToHex(rgb) {
    const m = (rgb || "").match(/\d+/g);
    if (!m || m.length < 3) return "#000000";
    return (
      "#" +
      m
        .slice(0, 3)
        .map((x) => (+x).toString(16).padStart(2, "0"))
        .join("")
    );
  }

  function _positionTip(e) {
    if (!tip) return;
    tip.style.left = e.clientX + 14 + "px";
    tip.style.top = e.clientY + "px";
  }

  function _onMove(e) {
    const res = _resolveTarget(e.target);
    const el = res && res.el;
    if (el === hovered) {
      if (el) _positionTip(e);
      return;
    }
    if (hovered) hovered.classList.remove("cx-edit-hover");
    hovered = el;
    if (hovered) {
      hovered.classList.add("cx-edit-hover");
      if (tip) {
        tip.textContent = res.isImage ? "Nhấp để chỉnh kích thước" : "Nhấp để chỉnh";
        tip.style.opacity = "1";
      }
      _positionTip(e);
    } else if (tip) {
      tip.style.opacity = "0";
    }
  }

  function _onLeave() {
    if (hovered) hovered.classList.remove("cx-edit-hover");
    hovered = null;
    if (tip) tip.style.opacity = "0";
  }

  // Gửi thông tin dòng (selector + style hiện tại) về trang cha để mở/cập nhật bảng chỉnh.
  function _sendPick(el, selector) {
    const cs = getComputedStyle(el);
    parent.postMessage(
      {
        type: "cx-text-pick",
        selector,
        sample: (el.textContent || "").trim().slice(0, 48),
        computed: {
          fontFamily: cs.fontFamily,
          fontSize: Math.round(parseFloat(cs.fontSize)) || 16,
          color: _rgbToHex(cs.color),
          fontWeight: cs.fontWeight,
          fontStyle: cs.fontStyle,
          textDecoration: cs.textDecorationLine,
          textAlign: cs.textAlign,
        },
      },
      "*",
    );
  }

  function _onClick(e) {
    const res = _resolveTarget(e.target);
    if (!res) return;
    e.preventDefault();
    e.stopPropagation();
    if (picked) picked.classList.remove("cx-edit-picked");
    picked = res.el;
    res.el.classList.add("cx-edit-picked");
    const sel = _selector(res.el);
    if (res.isImage) _sendImgPick(res.el, sel);
    else _sendPick(res.el, sel);
  }

  function _init() {
    const style = document.createElement("style");
    // outline-offset ÂM: vẽ viền VÀO TRONG element để không bị ancestor có
    // overflow (vd couple-names nằm trong .overflow-x-auto) cắt mất một cạnh.
    style.textContent =
      ".cx-edit-hover{outline:2px dashed rgba(244,63,94,.7)!important;outline-offset:-2px!important;cursor:pointer!important}" +
      ".cx-edit-picked{outline:2px solid #e11d48!important;outline-offset:-2px!important}" +
      "#cx-edit-tip{position:fixed;z-index:2147483000;pointer-events:none;background:#e11d48;color:#fff;" +
      "font:600 11px/1.4 system-ui,-apple-system,sans-serif;padding:3px 8px;border-radius:6px;white-space:nowrap;" +
      "transform:translateY(-50%);box-shadow:0 2px 8px rgba(0,0,0,.25);opacity:0;transition:opacity .1s}";
    document.head.appendChild(style);

    tip = document.createElement("div");
    tip.id = "cx-edit-tip";
    tip.textContent = "Nhấp để chỉnh";
    document.body.appendChild(tip);

    // Delegation trên document → bắt được cả phần tử render động sau này.
    document.addEventListener("mousemove", _onMove, true);
    document.addEventListener("mouseleave", _onLeave, true);
    document.addEventListener("click", _onClick, true);

    window.addEventListener("message", (ev) => {
      const d = ev.data;
      if (!d) return;
      // Trang cha yêu cầu bỏ chọn (đóng bảng chỉnh) → xoá viền đang chọn.
      if (d.type === "cx-clear-pick" && picked) {
        picked.classList.remove("cx-edit-picked");
        picked = null;
        return;
      }
      // Trang cha vừa xoá override 1 dòng → tính lại style mặc định của dòng đó,
      // gửi về để cập nhật bảng chỉnh (vẫn giữ dòng đang chọn, không đóng bảng).
      if (d.type === "cx-recompute" && d.selector) {
        let el = null;
        try {
          el = document.querySelector(d.selector);
        } catch (e) {}
        if (!el) return;
        if (picked !== el) {
          if (picked) picked.classList.remove("cx-edit-picked");
          picked = el;
          el.classList.add("cx-edit-picked");
        }
        if (d.isImage) _sendImgPick(el, d.selector);
        else _sendPick(el, d.selector);
      }
    });
  }

  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", _init);
  else _init();
})();
