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
const THEME_HEADING_COLORS = [
  "#2d2d2d",
  "#4a3f35",
  "#3b4a3f",
  "#5c4033",
  "#1f2937",
  "#7a4b52",
];
const THEME_BODY_COLORS = [
  "#78716c",
  "#57534e",
  "#6b6562",
  "#4a4a4a",
  "#5a5148",
  "#44403c",
];
const THEME_ACCENT_COLORS = [
  "#c0a062",
  "#b98a3c",
  "#7fa38a",
  "#d4a5a5",
  "#a8763e",
  "#9caf88",
];

// Các class font/màu mà theme đang dùng → ghi đè khi có theme_setting.
const HEADING_FONT_SELECTORS =
  ".font-cormorant, .font-playfair, .font-cinzel, .font-prata";
const BODY_FONT_SELECTORS = "body, .font-inter";
// Tiêu đề = chữ lớn đậm; Nội dung = chữ đọc thường; Nhấn = icon/hoa văn/viền trang trí.
const HEADING_COLOR_SELECTORS = ".text-charcoal, .text-stone-custom-500";
const BODY_COLOR_SELECTORS = ".text-stone-custom-400";
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

// Đang ở chế độ CHỈNH (iframe tab Giao diện có ?edit=1)?
function _isEditMode() {
  try {
    return new URLSearchParams(window.location.search).get("edit") === "1";
  } catch (e) {
    return false;
  }
}

// Phần tử "bound" (lấy từ dữ liệu/Thiết lập) → KHÓA sửa text trực tiếp.
// data-cx-bound do setText gắn; thêm vài container động/rsvp theo id.
const _CX_BOUND_SEL =
  "[data-cx-bound], #love-story-list, #timeline-list-render, #rsvp-custom-message";

// Áp NỘI DUNG text đã sửa (text_overrides[sel].text). Phải chạy SAU render vì đổi
// textContent (không phải CSS). Bỏ qua phần tử bound và phần tử có con (chỉ sửa
// text thuần, tránh phá cấu trúc/icon).
function applyTextOverrides(setting) {
  if (typeof setting === "string") {
    try {
      setting = JSON.parse(setting);
    } catch (e) {
      setting = null;
    }
  }
  const ov = (setting && setting.text_overrides) || {};
  // Các selector đang muốn đổi nội dung
  const wanted = [];
  for (const [sel, o] of Object.entries(ov)) {
    if (o && o.text != null) {
      const safeSel = _cxSafeSelector(sel);
      if (safeSel) wanted.push([safeSel, o.text]);
    }
  }
  // Áp: lần đầu lưu text GỐC vào data-cx-orig rồi mới ghi text mới.
  wanted.forEach(([sel, text]) => {
    let el = null;
    try {
      el = document.querySelector(sel);
    } catch (e) {}
    if (!el || el.children.length || el.closest(_CX_BOUND_SEL)) return;
    if (!el.hasAttribute("data-cx-orig"))
      el.setAttribute("data-cx-orig", el.textContent);
    el.textContent = text;
  });
  // Phục hồi phần tử TỪNG đổi nhưng nay đã bỏ override → trả lại text gốc.
  document.querySelectorAll("[data-cx-orig]").forEach((el) => {
    const still = wanted.some(([sel]) => {
      try {
        return el.matches(sel);
      } catch (e) {
        return false;
      }
    });
    if (!still) {
      el.textContent = el.getAttribute("data-cx-orig");
      el.removeAttribute("data-cx-orig");
    }
  });
}

// ============================================================
// CUSTOM BLOCKS — khối văn bản người dùng tự thêm (đoạn / danh sách / bullets),
// chèn GIỮA CÁC MỤC. Chèn append cuối DOM (không đổi nth-child của section) rồi
// định vị bằng flex `order`. Lưu ở theme_setting.custom_blocks; render cả public
// lẫn preview; ở chế độ chỉnh (edit=1) thì cho sửa/kéo/xoá.
// ============================================================
let _cxBlocks = [];

function _cxSafeQ(sel) {
  const safe = _cxSafeSelector(sel);
  if (!safe) return null;
  try {
    return document.querySelector(safe);
  } catch (e) {
    return null;
  }
}

// Container chứa các "mục" của thiệp = con của #main-card có nhiều section nhất.
function _cxSectionsContainer() {
  const card = document.getElementById("main-card");
  if (!card) return null;
  let best = null,
    bestN = -1;
  for (const child of card.children) {
    if (child.classList && child.classList.contains("cx-custom-block"))
      continue;
    const n = child.querySelectorAll(
      "[id^='section-'],[id^='couple-'],[id^='invite-'],[id^='ceremony'],[id^='party']",
    ).length;
    if (n > bestN) {
      bestN = n;
      best = child;
    }
  }
  return best || card;
}

function _cxRealSections(container) {
  return Array.from(container.children).filter(
    (c) =>
      !c.classList ||
      (!c.classList.contains("cx-custom-block") &&
        !c.classList.contains("cx-cb-dropline")),
  );
}

// Danh sách MỐC thả (mịn): đi sâu vào các wrapper flex-column (tối đa 2 cấp) để có
// mốc ở mức section (gia đình, Thư mời, lễ, tiệc…) chứ không chỉ vài con cấp trên.
function _cxGatherTargets(container, out, depth) {
  for (const child of container.children) {
    if (
      child.classList &&
      (child.classList.contains("cx-custom-block") ||
        child.classList.contains("cx-cb-dropline"))
    )
      continue;
    const cs = getComputedStyle(child);
    if (cs.display === "none") continue;
    const isColFlex =
      cs.display.indexOf("flex") !== -1 && cs.flexDirection === "column";
    // Wrapper flex-col → đi sâu (không lấy chính wrapper làm mốc); còn lại → mốc.
    if (isColFlex && child.children.length && depth < 2)
      _cxGatherTargets(child, out, depth + 1);
    else out.push(child);
  }
}
function _cxDropTargets() {
  const root = _cxSectionsContainer();
  if (!root) return [];
  const out = [];
  _cxGatherTargets(root, out, 0);
  return out;
}

// Selector NEO ổn định cho 1 section (bỏ qua custom-block khi đếm nth-child).
function _cxAnchorSelector(el) {
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
    let idx = 0;
    for (const sib of parent.children) {
      if (
        sib.classList &&
        (sib.classList.contains("cx-custom-block") ||
          sib.classList.contains("cx-cb-dropline"))
      )
        continue;
      idx++;
      if (sib === node) break;
    }
    parts.unshift(node.tagName.toLowerCase() + ":nth-child(" + idx + ")");
    node = parent;
  }
  parts.unshift("body");
  return parts.join(" > ");
}

// Khối đang chọn: hiện viền nét đứt + 2 nút (kéo giữa-trên, xoá phải-trên).
// Bấm ra ngoài thì ẩn, bấm lại vào khối thì hiện lại. Giữ theo id để _cxRender()
// dựng lại DOM vẫn còn trạng thái.
let _cxActiveId = null;
let _cxOutsideBound = false;

function _cxSetActive(id) {
  _cxActiveId = id || null;
  document.querySelectorAll(".cx-custom-block").forEach((n) => {
    n.classList.toggle(
      "cx-cb-active",
      n.getAttribute("data-cb-id") === _cxActiveId,
    );
  });
}

function _cxBindOutsideClick() {
  if (_cxOutsideBound) return;
  _cxOutsideBound = true;
  document.addEventListener("pointerdown", (e) => {
    const t = e.target;
    if (t && t.closest && t.closest(".cx-custom-block")) return;
    if (_cxActiveId) _cxSetActive(null);
  });
}

function _cxBuildBlockNode(b, edit) {
  const wrap = document.createElement("div");
  wrap.className = "cx-custom-block";
  wrap.setAttribute("data-cb-id", b.id);
  if (edit) wrap.classList.add("cx-cb-edit");
  if (edit && b.id === _cxActiveId) wrap.classList.add("cx-cb-active");
  let body;
  if (b.type === "ordered" || b.type === "bullet") {
    body = document.createElement(b.type === "ordered" ? "ol" : "ul");
    const items =
      Array.isArray(b.content) && b.content.length ? b.content : ["Mục 1"];
    items.forEach((t) => {
      const li = document.createElement("li");
      li.textContent = t;
      body.appendChild(li);
    });
  } else {
    body = document.createElement("p");
    body.textContent = typeof b.content === "string" ? b.content : "Văn bản";
  }
  body.className = "cx-cb-body";
  // id ổn định (giống nhau ở edit/preview/public) → selector "#cb_xxx" dùng cho
  // text_overrides font/cỡ/màu. data-cx-bound: nội dung khối do model quản (sửa
  // trực tiếp trên thiệp) nên khoá mục "Nội dung" ở bảng chỉnh chi tiết và không
  // để applyTextOverrides ghi đè.
  body.id = b.id;
  body.setAttribute("data-cx-bound", "1");
  if (edit) {
    body.setAttribute("contenteditable", "true");
    body.addEventListener("input", () => _cxOnEdit(b.id));
    // Bấm vào khối → chọn khối + mở luôn bảng chỉnh chi tiết cho chữ trong khối
    // (bấm vào 2 nút công cụ thì bỏ qua, chúng tự xử lý).
    wrap.addEventListener("pointerdown", (e) => {
      if (e.target && e.target.closest && e.target.closest(".cx-cb-tools"))
        return;
      _cxSetActive(b.id);
      if (window.__cxPickBlockBody) window.__cxPickBlockBody(body);
    });
    const tools = document.createElement("div");
    tools.className = "cx-cb-tools";
    // Icon vẽ bằng SVG (glyph ⠿ / × mỗi máy một kiểu, canh giữa không đều).
    // Nút kéo dùng đúng icon grip-vertical như tay nắm ở bảng chọn mẫu.
    tools.innerHTML =
      '<button type="button" class="cx-cb-drag" title="Kéo để di chuyển" aria-label="Kéo để di chuyển">' +
      '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/>' +
      '<circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/>' +
      "</svg></button>" +
      '<button type="button" class="cx-cb-del" title="Xoá" aria-label="Xoá khối">' +
      '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>' +
      "</button>";
    tools.querySelector(".cx-cb-del").addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      _cxDelete(b.id);
    });
    _cxWireDrag(tools.querySelector(".cx-cb-drag"), b.id);
    wrap.appendChild(tools);
  }
  wrap.appendChild(body);
  return wrap;
}

function _cxRender() {
  const container = _cxSectionsContainer();
  if (!container) return;
  const card = document.getElementById("main-card") || container;
  _cxEnsureStyle();
  // Xoá block cũ + trả lại order đã set lần trước (đánh dấu data-cx-ord).
  card.querySelectorAll(".cx-custom-block").forEach((n) => n.remove());
  card.querySelectorAll("[data-cx-ord]").forEach((el) => {
    el.style.order = "";
    el.removeAttribute("data-cx-ord");
  });
  const edit = _isEditMode();
  if (edit) _cxBindOutsideClick();

  // Chèn từng block vào PARENT của mốc (afterAnchor). Append cuối parent → không
  // đổi nth-child của các con thật trong parent đó (giữ text-override/ẩn ổn định).
  const byParent = new Map();
  _cxBlocks.forEach((b) => {
    const anchorEl = b.afterAnchor ? _cxSafeQ(b.afterAnchor) : null;
    const parent = (anchorEl && anchorEl.parentElement) || container;
    const node = _cxBuildBlockNode(b, edit);
    node._cxAnchorEl = anchorEl;
    parent.appendChild(node);
    if (!byParent.has(parent)) byParent.set(parent, []);
    byParent.get(parent).push(node);
  });

  // Gán flex order trong từng parent (chỉ parent là flex-column) để khối nằm đúng chỗ.
  byParent.forEach((nodes, parent) => {
    const cs = getComputedStyle(parent);
    if (!(cs.display.indexOf("flex") !== -1 && cs.flexDirection === "column"))
      return;
    const reals = Array.from(parent.children).filter(
      (c) => !c.classList.contains("cx-custom-block"),
    );
    reals.forEach((s, i) => {
      s.style.order = String(i * 100);
      s.setAttribute("data-cx-ord", "1");
    });
    const sub = {};
    nodes.forEach((node) => {
      const a = node._cxAnchorEl;
      let base = -50; // đầu parent
      if (a) {
        const idx = reals.indexOf(a);
        base = idx >= 0 ? idx * 100 + 50 : reals.length * 100;
      }
      sub[base] = (sub[base] || 0) + 1;
      node.style.order = String(base + sub[base]);
      node.setAttribute("data-cx-ord", "1");
    });
  });
}

// Đọc lại nội dung từ DOM về model
function _cxReadContent(wrap, type) {
  if (type === "ordered" || type === "bullet")
    return Array.from(wrap.querySelectorAll("li")).map((li) => li.textContent);
  const body = wrap.querySelector(".cx-cb-body");
  return body ? body.textContent : "";
}

function _cxFind(id) {
  return _cxBlocks.find((b) => b.id === id);
}

let _cxReportTimer = null;
function _cxReport() {
  clearTimeout(_cxReportTimer);
  _cxReportTimer = setTimeout(() => {
    try {
      parent.postMessage({ type: "cx-blocks-changed", blocks: _cxBlocks }, "*");
    } catch (e) {}
  }, 200);
}

function _cxOnEdit(id) {
  const b = _cxFind(id);
  const wrap = document.querySelector(
    '.cx-custom-block[data-cb-id="' + id + '"]',
  );
  if (!b || !wrap) return;
  b.content = _cxReadContent(wrap, b.type);
  _cxReport();
}

function _cxDelete(id) {
  _cxBlocks = _cxBlocks.filter((b) => b.id !== id);
  if (_cxActiveId === id) _cxActiveId = null;
  _cxRender();
  _cxReport();
  // Bảng chỉnh chi tiết có thể đang trỏ vào khối vừa xoá → bảo trang cha đóng.
  try {
    if (window.top !== window)
      parent.postMessage({ type: "cx-line-close" }, "*");
  } catch (e) {}
}

function _cxAddAt(type, anchorEl) {
  const t = type === "ordered" || type === "bullet" ? type : "paragraph";
  const id =
    "cb_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const content = t === "paragraph" ? "Văn bản mới" : ["Mục 1", "Mục 2"];
  _cxBlocks.push({
    id,
    type: t,
    content,
    afterAnchor: anchorEl ? _cxAnchorSelector(anchorEl) : null,
  });
  _cxActiveId = id; // khối vừa thêm → hiện sẵn viền + nút
  _cxRender();
  _cxReport();
  const body = document.querySelector(
    '.cx-custom-block[data-cb-id="' + id + '"] .cx-cb-body',
  );
  if (body) {
    body.scrollIntoView({ behavior: "smooth", block: "center" });
    body.focus();
    // Thêm/thả xong → mở luôn bảng chỉnh chi tiết (phông, cỡ, màu…) cho khối mới
    if (window.__cxPickBlockBody) window.__cxPickBlockBody(body);
  }
}

// Thêm ở cuối (bấm mẫu, không kéo)
function _cxAdd(type) {
  const targets = _cxDropTargets();
  _cxAddAt(type, targets[targets.length - 1] || null);
}

// ── Kéo mẫu TỪ palette (trang cha) vào thiệp ───────────────────────────────
// Trang cha (giữ pointer-capture) gửi toạ độ y (theo viewport iframe) khi rê trên
// iframe → hiện vạch chèn; thả → thêm khối tại đó.
let _cxExtAnchor = undefined;

// Đặt vạch chèn ở ĐÁY mốc bằng toạ độ VIEWPORT (position:fixed) → không lệch do
// padding/offsetParent, không bị #main-card overflow cắt. Gắn vào body.
function _cxPlaceLine(line, anchorEl) {
  const container = _cxSectionsContainer();
  const cr = container.getBoundingClientRect();
  line.style.position = "fixed";
  line.style.left = cr.left + "px";
  line.style.width = cr.width + "px";
  line.style.right = "auto";
  line.style.top =
    (anchorEl ? anchorEl.getBoundingClientRect().bottom : cr.top) + "px";
  line.style.display = "block";
}
function _cxExtLine() {
  let line = document.getElementById("cx-ext-dropline");
  if (!line) {
    line = document.createElement("div");
    line.id = "cx-ext-dropline";
    line.className = "cx-cb-dropline";
  }
  if (line.parentNode !== document.body) document.body.appendChild(line);
  return line;
}
function _cxDragOver(y) {
  const line = _cxExtLine();
  if (!line) return;
  let anchorEl = null;
  for (const s of _cxDropTargets()) {
    const r = s.getBoundingClientRect();
    if (y > r.top + r.height / 2) anchorEl = s;
  }
  _cxExtAnchor = anchorEl;
  _cxPlaceLine(line, anchorEl);
}
function _cxDragCancel() {
  const line = document.getElementById("cx-ext-dropline");
  if (line) line.remove();
  _cxExtAnchor = undefined;
}
function _cxDropAt(type, y) {
  if (typeof y === "number") _cxDragOver(y); // chốt anchor đúng vị trí thả
  const anchorEl = _cxExtAnchor;
  _cxDragCancel();
  _cxAddAt(type, anchorEl);
}

// ── Kéo-thả đổi vị trí (giữa các mục) ──────────────────────────────────────
let _cxDrag = null;
function _cxWireDrag(handle, id) {
  handle.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    e.stopPropagation();
    const container = _cxSectionsContainer();
    if (!container) return;
    // setPointerCapture → mọi pointermove/up dồn về handle, không rớt khi rê ra ngoài.
    try {
      handle.setPointerCapture(e.pointerId);
    } catch (err) {}
    document.body.style.userSelect = "none";
    handle.style.cursor = "grabbing";
    const line = document.createElement("div");
    line.className = "cx-cb-dropline";
    document.body.appendChild(line);
    _cxDrag = { id, container, line, anchorEl: null };
    const move = (ev) => _cxDragMove(ev);
    const up = () => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", up);
      handle.removeEventListener("pointercancel", up);
      document.body.style.userSelect = "";
      handle.style.cursor = "";
      _cxDragEnd();
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", up);
    handle.addEventListener("pointercancel", up);
    _cxDragMove(e);
  });
}

function _cxDragMove(ev) {
  if (!_cxDrag) return;
  const { line } = _cxDrag;
  let anchorEl = null;
  for (const s of _cxDropTargets()) {
    const r = s.getBoundingClientRect();
    if (ev.clientY > r.top + r.height / 2) anchorEl = s;
  }
  _cxDrag.anchorEl = anchorEl;
  _cxPlaceLine(line, anchorEl);
}

function _cxDragEnd() {
  if (!_cxDrag) return;
  const { id, line, anchorEl } = _cxDrag;
  line.remove();
  _cxDrag = null;
  const b = _cxFind(id);
  if (!b) return;
  b.afterAnchor = anchorEl ? _cxAnchorSelector(anchorEl) : null;
  _cxRender();
  _cxReport();
  // Kéo xong → mở bảng chỉnh chi tiết cho khối vừa đặt (như lúc mới thêm)
  const body = document.getElementById(id);
  if (body && window.__cxPickBlockBody) window.__cxPickBlockBody(body);
}

function _cxEnsureStyle() {
  if (document.getElementById("cx-cb-style")) return;
  const s = document.createElement("style");
  s.id = "cx-cb-style";
  s.textContent =
    ".cx-custom-block{position:relative;width:100%}" +
    ".cx-cb-body{outline:none}" +
    ".cx-custom-block ol,.cx-custom-block ul{display:inline-block;text-align:left;padding-left:1.5em;margin:0}" +
    ".cx-custom-block ol{list-style:decimal}.cx-custom-block ul{list-style:disc}" +
    // Viền nét đứt + 2 nút CHỈ hiện khi khối đang được chọn (bấm ra ngoài là ẩn).
    // outline-offset dương để viền ôm ngoài, không chạm chữ; outline không chiếm
    // chỗ nên không đẩy layout của thiệp.
    // Chỉ ở chế độ chỉnh mới chừa khoảng đệm, để nút kéo (giữa-trên) không sát
    // chữ. Trang public giữ nguyên khoảng cách gốc của thiệp.
    ".cx-cb-edit{padding:12px 0}" +
    ".cx-cb-active{outline:1px dashed #e11d48;outline-offset:4px}" +
    ".cx-cb-tools{position:absolute;inset:0;pointer-events:none;z-index:6;display:none}" +
    ".cx-cb-active>.cx-cb-tools{display:block}" +
    // Nút tròn 22px, kiểu giống nút X "ẩn thành phần" (#cx-del-btn).
    // Selector 2 class để không bị rule chung (.cx-cb-tools button) đè mất.
    ".cx-cb-tools button{pointer-events:auto;position:absolute;top:-15px;width:22px;height:22px;border-radius:9999px;box-shadow:0 2px 6px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center;padding:0;line-height:0;cursor:pointer;transition:background .15s}" +
    ".cx-cb-tools svg{display:block}" +
    // Kéo: giữa-trên, nền trắng + 6 chấm xám như tay nắm trong bảng chọn mẫu
    ".cx-cb-tools .cx-cb-drag{left:50%;transform:translateX(-50%);background:#fff;color:#6b7280;border:1px solid #e5e7eb;cursor:grab;touch-action:none}" +
    ".cx-cb-tools .cx-cb-drag:active{cursor:grabbing}" +
    // Xoá: phải-trên, nền đen chữ trắng
    ".cx-cb-tools .cx-cb-del{right:-8px;background:#000;color:#fff;border:0}" +
    ".cx-cb-tools .cx-cb-del:hover{background:#be123c}" +
    ".cx-cb-dropline{position:absolute;left:0;right:0;height:3px;background:#e11d48;border-radius:2px;z-index:2147483000;pointer-events:none;display:none}";
  document.head.appendChild(s);
}

// Render từ theme_setting (public + preview + edit). Nạp model rồi vẽ.
function applyCustomBlocks(setting) {
  if (!document.getElementById("main-card")) return;
  if (typeof setting === "string") {
    try {
      setting = JSON.parse(setting);
    } catch (e) {
      setting = null;
    }
  }
  const arr =
    setting && Array.isArray(setting.custom_blocks)
      ? setting.custom_blocks
      : [];
  _cxBlocks = arr.map((b) => ({ ...b }));
  _cxRender();
}

// Trong iframe chỉnh (edit=1): nhận lệnh "thêm khối" từ trang cha.
if (typeof window !== "undefined" && window.top !== window) {
  window.addEventListener("message", (ev) => {
    const d = ev.data;
    if (!d || !_isEditMode()) return;
    if (d.type === "cx-add-block") _cxAdd(d.blockType);
    else if (d.type === "cx-drag-over") _cxDragOver(d.y);
    else if (d.type === "cx-drop") _cxDropAt(d.blockType, d.y);
    else if (d.type === "cx-drag-cancel") _cxDragCancel();
  });
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
    rules.push(
      `${HEADING_COLOR_SELECTORS} { color: ${setting.heading_color} !important; }`,
    );
  }

  if (setting.body_color) {
    rules.push(
      `${BODY_COLOR_SELECTORS} { color: ${setting.body_color} !important; }`,
    );
  }

  if (setting.accent_color) {
    rules.push(
      `${ACCENT_COLOR_SELECTORS} { color: ${setting.accent_color} !important; }`,
    );
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
      // Ẩn thành phần = xoá khỏi hiển thị HẲN (cả lúc chỉnh lẫn public). Không khôi
      // phục riêng — muốn hiện lại phải "Khôi phục mặc định" ở bảng chỉnh chung.
      if (o.hidden) {
        rules.push(`${safeSel} { display: none !important; }`);
      }
      const decls = [];
      if (o.font) {
        const f = _cxSafeFont(o.font);
        if (f) {
          _loadGoogleFont(f);
          decls.push(`font-family: '${f}', serif !important`);
        }
      }
      if (_cxSafeNum(o.size))
        decls.push(`font-size: ${Number(o.size)}px !important`);
      if (_cxSafeColor(o.color))
        decls.push(`color: ${o.color.trim()} !important`);
      if (_cxSafeNum(o.weight))
        decls.push(`font-weight: ${Number(o.weight)} !important`);
      if (o.italic) decls.push(`font-style: italic !important`);
      if (o.underline) decls.push(`text-decoration: underline !important`);
      if (o.align && /^(left|center|right|justify)$/.test(o.align))
        decls.push(`text-align: ${o.align} !important`);
      // Kích thước ảnh (khung ảnh). Gỡ max-width/height để ảnh phóng to vượt cỡ gốc được.
      const hasSize = _cxSafeNum(o.width) || _cxSafeNum(o.height);
      if (_cxSafeNum(o.width))
        decls.push(`width: ${Number(o.width)}px !important`);
      if (_cxSafeNum(o.height))
        decls.push(`height: ${Number(o.height)}px !important`);
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
  window.applyTextOverrides = applyTextOverrides;
  window.applyCustomBlocks = applyCustomBlocks;
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
  let delBtn = null;

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
        Math.abs(pr.width - ir.width) < 3 &&
        Math.abs(pr.height - ir.height) < 3;
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
        tip.textContent = res.isImage
          ? "Nhấp để chỉnh kích thước"
          : "Nhấp để chỉnh";
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

  // Phần tử bound (lấy từ Thiết lập) → khoá sửa text trực tiếp.
  function _isBound(el) {
    return !!el.closest(
      "[data-cx-bound], #love-story-list, #timeline-list-render, #rsvp-custom-message",
    );
  }

  // Gửi thông tin dòng (selector + style hiện tại) về trang cha để mở/cập nhật bảng chỉnh.
  function _sendPick(el, selector) {
    const cs = getComputedStyle(el);
    const txt = (el.textContent || "").trim();
    parent.postMessage(
      {
        type: "cx-text-pick",
        selector,
        sample: txt.slice(0, 48),
        bound: _isBound(el),
        textOnly: el.children.length === 0,
        text: txt.slice(0, 2000),
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

  // Nút X "ẩn thành phần" nổi ở góc trên-phải phần tử đang chọn. Bấm → báo trang
  // cha ẩn (xoá khỏi thiệp). Chỉ 1 nút, bám theo phần tử picked.
  function _ensureDelBtn() {
    if (delBtn) return delBtn;
    delBtn = document.createElement("button");
    delBtn.id = "cx-del-btn";
    delBtn.type = "button";
    delBtn.setAttribute("aria-label", "Ẩn thành phần");
    delBtn.innerHTML =
      '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
    delBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (picked)
        parent.postMessage(
          { type: "cx-hide", selector: _selector(picked) },
          "*",
        );
    });
    document.body.appendChild(delBtn);
    return delBtn;
  }

  function _positionDelBtn() {
    if (!picked || !delBtn || delBtn.style.display === "none") return;
    const r = picked.getBoundingClientRect();
    delBtn.style.left = r.right - 12 + "px";
    delBtn.style.top = r.top - 12 + "px";
  }

  function _showDelBtn() {
    _ensureDelBtn();
    delBtn.style.display = "flex";
    _positionDelBtn();
  }

  function _hideDelBtn() {
    if (delBtn) delBtn.style.display = "none";
  }

  function _onClick(e) {
    if (delBtn && e.target.closest("#cx-del-btn")) return; // để nút X tự xử lý
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
    _showDelBtn();
  }

  // Khối văn bản tự thêm là contenteditable nên _isEditable() bỏ qua (không bắt
  // hover/click như chữ thường). Custom-block gọi hàm này để mở bảng chỉnh chi
  // tiết cho chữ trong khối; viền + nút của khối do chính nó lo (.cx-cb-active)
  // nên ở đây bỏ picked/nút X để khỏi chồng 2 lớp viền.
  window.__cxPickBlockBody = function (el) {
    if (!el) return;
    if (picked) picked.classList.remove("cx-edit-picked");
    picked = null;
    _hideDelBtn();
    _sendPick(el, _selector(el));
  };

  function _init() {
    const style = document.createElement("style");
    // outline-offset ÂM: vẽ viền VÀO TRONG element để không bị ancestor có
    // overflow (vd couple-names nằm trong .overflow-x-auto) cắt mất một cạnh.
    style.textContent =
      // Rê chuột: nét đứt XÁM 1px. Đang chọn: nét đứt MÀU 1px (đồng nhất với
      // khối văn bản .cx-cb-active).
      ".cx-edit-hover{outline:1px dashed #9ca3af!important;outline-offset:-2px!important;cursor:pointer!important}" +
      ".cx-edit-picked{outline:1px dashed #e11d48!important;outline-offset:-2px!important}" +
      "#cx-edit-tip{position:fixed;z-index:2147483000;pointer-events:none;background:#e11d48;color:#fff;" +
      "font:600 11px/1.4 system-ui,-apple-system,sans-serif;padding:3px 8px;border-radius:6px;white-space:nowrap;" +
      "transform:translateY(-50%);box-shadow:0 2px 8px rgba(0,0,0,.25);opacity:0;transition:opacity .1s}" +
      "#cx-del-btn{position:fixed;z-index:2147483001;width:22px;height:22px;padding:0;border-radius:9999px;" +
      "background:#000;color:#fff;border:0px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3);display:none;" +
      "align-items:center;justify-content:center;cursor:pointer}" +
      "#cx-del-btn:hover{background:#be123c}";
    document.head.appendChild(style);

    tip = document.createElement("div");
    tip.id = "cx-edit-tip";
    tip.textContent = "Nhấp để chỉnh";
    document.body.appendChild(tip);

    // Delegation trên document → bắt được cả phần tử render động sau này.
    document.addEventListener("mousemove", _onMove, true);
    document.addEventListener("mouseleave", _onLeave, true);
    document.addEventListener("click", _onClick, true);
    // Nút X bám phần tử picked khi cuộn/đổi kích thước.
    document.addEventListener("scroll", _positionDelBtn, true);
    window.addEventListener("resize", _positionDelBtn);

    window.addEventListener("message", (ev) => {
      const d = ev.data;
      if (!d) return;
      // Trang cha yêu cầu bỏ chọn (đóng bảng chỉnh) → xoá viền đang chọn.
      if (d.type === "cx-clear-pick" && picked) {
        picked.classList.remove("cx-edit-picked");
        picked = null;
        _hideDelBtn();
        return;
      }
      // Trang cha vừa mở bảng chỉnh (iframe co lại) → nếu dòng/ảnh đang chỉnh nằm
      // ngoài vùng nhìn thấy thì cuộn MƯỢT đưa nó vào giữa preview còn thấy.
      if (d.type === "cx-scroll" && d.selector) {
        let el = null;
        try {
          el = document.querySelector(d.selector);
        } catch (e) {}
        if (el) {
          const r = el.getBoundingClientRect();
          const vh =
            window.innerHeight || document.documentElement.clientHeight;
          const m = 40; // đệm mép để không bị sát viền/bị che
          if (r.top < m || r.bottom > vh - m) {
            el.scrollIntoView({
              behavior: "smooth",
              block: "center",
              inline: "nearest",
            });
          }
        }
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
        _showDelBtn();
      }
    });
  }

  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", _init);
  else _init();
})();
