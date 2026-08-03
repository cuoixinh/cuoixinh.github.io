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
    if (
      child.classList &&
      (child.classList.contains("cx-custom-block") ||
        child.classList.contains("cx-decor-layer"))
    )
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
        !c.classList.contains("cx-cb-dropline") &&
        !c.classList.contains("cx-decor-layer")),
  );
}

// Danh sách MỐC thả (mịn): đi sâu vào các wrapper flex-column (tối đa 2 cấp) để có
// mốc ở mức section (gia đình, Thư mời, lễ, tiệc…) chứ không chỉ vài con cấp trên.
function _cxGatherTargets(container, out, depth) {
  for (const child of container.children) {
    if (
      child.classList &&
      (child.classList.contains("cx-custom-block") ||
        child.classList.contains("cx-cb-dropline") ||
        child.classList.contains("cx-decor-layer"))
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
  // text_overrides font/cỡ/màu. data-cx-bound: nội dung khối nằm trong model
  // (custom_blocks) nên applyTextOverrides không được ghi đè.
  body.id = b.id;
  body.setAttribute("data-cx-bound", "1");
  if (edit) {
    // Nội dung SỬA Ở PANEL (ô "Nội dung" trong bảng chỉnh chi tiết), không sửa
    // trực tiếp trên thiệp → không đặt contenteditable.
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

// Nội dung khối dưới dạng TEXT cho ô "Nội dung" ở panel: danh sách thì mỗi mục
// một dòng.
function _cxContentText(b) {
  if (Array.isArray(b.content)) return b.content.join("\n");
  return typeof b.content === "string" ? b.content : "";
}

// Panel sửa nội dung → cập nhật model + DOM tại chỗ (không _cxRender để khỏi
// dựng lại cả cây, mất trạng thái đang chọn).
function _cxSetContent(id, text) {
  const b = _cxFind(id);
  if (!b) return;
  const body = document.getElementById(id);
  const isList = b.type === "ordered" || b.type === "bullet";
  if (isList) {
    b.content = String(text == null ? "" : text).split("\n");
    if (body) {
      body.textContent = "";
      b.content.forEach((t) => {
        const li = document.createElement("li");
        li.textContent = t;
        body.appendChild(li);
      });
    }
  } else {
    b.content = String(text == null ? "" : text);
    if (body) body.textContent = b.content;
  }
  _cxReport();
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
    // Thêm/thả xong → mở luôn bảng chỉnh chi tiết (phông, cỡ, màu…) cho khối mới;
    // fresh:true để panel focus sẵn ô "Nội dung" cho gõ ngay.
    if (window.__cxPickBlockBody)
      window.__cxPickBlockBody(body, { fresh: true });
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
// Bóng mờ đi theo con trỏ = bản sao của chính khối đang kéo (giống ghost khi kéo
// mẫu từ panel). Gắn vào body nên KHÔNG kế thừa font/màu của thiệp → copy tay
// vài thuộc tính chữ từ khối gốc; nền lấy đúng nền thiệp cho khỏi lộ chữ nền.
function _cxMakeGhost(wrap, ev) {
  const g = wrap.cloneNode(true);
  g.className = "cx-cb-ghost";
  g.removeAttribute("data-cb-id");
  g.querySelectorAll(".cx-cb-tools").forEach((n) => n.remove());
  g.querySelectorAll("[id]").forEach((n) => n.removeAttribute("id"));
  g.querySelectorAll("[contenteditable]").forEach((n) =>
    n.removeAttribute("contenteditable"),
  );
  const src = wrap.querySelector(".cx-cb-body") || wrap;
  const cs = getComputedStyle(src);
  [
    "fontFamily",
    "fontSize",
    "fontWeight",
    "fontStyle",
    "lineHeight",
    "letterSpacing",
    "textAlign",
    "color",
  ].forEach((p) => {
    g.style[p] = cs[p];
  });
  const card = document.getElementById("main-card");
  g.style.background = card
    ? getComputedStyle(card).backgroundColor
    : "#ffffff";
  const r = wrap.getBoundingClientRect();
  g.style.width = r.width + "px";
  g.style.left = r.left + "px";
  g.style.top = r.top + "px";
  document.body.appendChild(g);
  return { ghost: g, offX: ev.clientX - r.left, offY: ev.clientY - r.top };
}

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
    // Bóng mờ theo con trỏ + làm mờ khối gốc để thấy rõ đang nhấc khối nào
    const wrap = handle.closest(".cx-custom-block");
    const g = wrap ? _cxMakeGhost(wrap, e) : null;
    if (wrap) wrap.classList.add("cx-cb-dragging");
    _cxDrag = {
      id,
      container,
      line,
      anchorEl: null,
      wrap,
      ghost: g && g.ghost,
      offX: g ? g.offX : 0,
      offY: g ? g.offY : 0,
    };
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
  const { line, ghost } = _cxDrag;
  if (ghost) {
    ghost.style.left = ev.clientX - _cxDrag.offX + "px";
    ghost.style.top = ev.clientY - _cxDrag.offY + "px";
  }
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
  const { id, line, anchorEl, ghost, wrap } = _cxDrag;
  line.remove();
  if (ghost) ghost.remove();
  if (wrap) wrap.classList.remove("cx-cb-dragging");
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
    ".cx-cb-dropline{position:absolute;left:0;right:0;height:3px;background:#e11d48;border-radius:2px;z-index:2147483000;pointer-events:none;display:none}" +
    // Bóng mờ khi kéo đổi vị trí + khối gốc mờ đi trong lúc kéo
    ".cx-cb-ghost{position:fixed;z-index:2147483002;pointer-events:none;opacity:.5;padding:12px 0;border-radius:8px;outline:1px dashed #e11d48;outline-offset:4px;box-shadow:0 8px 20px rgba(0,0,0,.18);transition:none}" +
    ".cx-cb-ghost ol,.cx-cb-ghost ul{display:inline-block;text-align:left;padding-left:1.5em;margin:0}" +
    ".cx-cb-ghost ol{list-style:decimal}.cx-cb-ghost ul{list-style:disc}" +
    ".cx-cb-dragging{opacity:.35}";
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

// ============================================================
// DECORATIONS — hoa / hoạ tiết thả tự do lên thiệp bằng TOẠ ĐỘ.
// Lưu ở theme_setting.decorations = [{ id, src, x, y, w, rot, behind }]:
//   x, y  % so với #main-card, tính theo TÂM ảnh → giữ đúng chỗ trên mọi khổ
//         màn hình, không lệ thuộc px của máy lúc chỉnh.
//   w     % chiều rộng thiệp (cao tự theo tỉ lệ ảnh); rot: độ;
//   behind true = nằm SAU nội dung thiệp (hoa nền), false = đè lên trên.
// Public/preview chỉ vẽ và KHÔNG bắt chuột. edit=1 thì kéo để đổi chỗ, kèm 4
// nút: xoá (trên-trái), xoay (trên-phải), phóng to (dưới-phải), đổi lớp (dưới-trái).
// ============================================================
const CX_DECOR_DEFAULT_W = 18; // % bề ngang thiệp
const CX_DECOR_MIN_W = 3;
const CX_DECOR_MAX_W = 100;

let _cxDecors = [];
let _cxDecorActiveId = null;
let _cxDecorOutsideBound = false;

function _cxDecorLayer(behind) {
  const card = document.getElementById("main-card");
  if (!card) return null;
  // Toạ độ tính theo #main-card nên nó phải là gốc định vị.
  if (getComputedStyle(card).position === "static") card.style.position = "relative";
  // …và phải TỰ TẠO stacking context, nếu không lớp z-index:-1 (hoa nền) rơi ra
  // ngữ cảnh gốc và bị chính nền trắng của thiệp che mất. isolation không đổi
  // layout, chỉ đóng khung thứ tự chồng lớp trong thiệp.
  if (getComputedStyle(card).isolation !== "isolate") card.style.isolation = "isolate";
  const id = behind ? "cx-decor-layer-back" : "cx-decor-layer";
  let layer = document.getElementById(id);
  if (!layer || layer.parentElement !== card) {
    layer = document.createElement("div");
    layer.id = id;
    layer.className = "cx-decor-layer";
    // 45: các theme dùng tới z-20 cho nội dung TRONG thiệp nên phải cao hơn,
    // nhưng vẫn thấp hơn mấy lớp phủ fixed NGOÀI thiệp (cover z-50, nút nhạc
    // z-60, lightbox z-100) — hoa không được che những thứ đó.
    // -1: nằm sau nội dung thiệp nhưng vẫn trên nền thiệp.
    layer.style.zIndex = behind ? "-1" : "45";
    card.appendChild(layer);
  }
  return layer;
}

function _cxDecorEnsureStyle() {
  if (document.getElementById("cx-decor-style")) return;
  const s = document.createElement("style");
  s.id = "cx-decor-style";
  s.textContent =
    ".cx-decor-layer{position:absolute;inset:0;overflow:hidden;pointer-events:none}" +
    ".cx-decor{position:absolute;transform-origin:center center}" +
    ".cx-decor img{display:block;width:100%;height:auto;-webkit-user-drag:none;user-select:none;pointer-events:none}" +
    ".cx-decor-edit{pointer-events:auto;cursor:grab;touch-action:none}" +
    ".cx-decor-edit.cx-decor-active{outline:1px dashed #e11d48;outline-offset:4px}" +
    // Hoa nằm SAU nội dung thì không bấm vào được (nội dung che mất) → ở chế độ
    // chỉnh, mỗi hoa "sau chữ" có thêm một bản trong suốt ở lớp trên để bắt
    // chuột và mang bộ nút; ảnh thật vẫn nằm dưới đúng như lúc khách xem.
    ".cx-decor-proxy img{visibility:hidden}" +
    ".cx-decor-h{position:absolute;width:24px;height:24px;border-radius:9999px;" +
    "background:#fff;border:1px solid #e11d48;color:#e11d48;display:none;" +
    "align-items:center;justify-content:center;padding:0;cursor:pointer;" +
    "box-shadow:0 2px 6px rgba(0,0,0,.18);touch-action:none;z-index:1}" +
    ".cx-decor-active .cx-decor-h{display:flex}" +
    ".cx-decor-del{top:-12px;left:-12px}" +
    ".cx-decor-copy{top:-12px;left:50%;margin-left:-12px}" +
    ".cx-decor-rot{top:-12px;right:-12px;cursor:grab}" +
    ".cx-decor-size{bottom:-12px;right:-12px;cursor:nwse-resize}" +
    ".cx-decor-back{bottom:-12px;left:-12px}";
  document.head.appendChild(s);
}

function _cxDecorClamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function _cxDecorFind(id) {
  return _cxDecors.find((d) => d.id === id);
}

let _cxDecorReportTimer = null;
function _cxDecorReport() {
  clearTimeout(_cxDecorReportTimer);
  _cxDecorReportTimer = setTimeout(() => {
    try {
      parent.postMessage({ type: "cx-decors-changed", decors: _cxDecors }, "*");
    } catch (e) {}
  }, 200);
}

function _cxDecorSetActive(id) {
  _cxDecorActiveId = id || null;
  document.querySelectorAll(".cx-decor").forEach((n) => {
    n.classList.toggle(
      "cx-decor-active",
      n.getAttribute("data-decor-id") === _cxDecorActiveId,
    );
  });
}

function _cxDecorBindOutside() {
  if (_cxDecorOutsideBound) return;
  _cxDecorOutsideBound = true;
  document.addEventListener("pointerdown", (e) => {
    const t = e.target;
    if (t && t.closest && t.closest(".cx-decor")) return;
    if (_cxDecorActiveId) _cxDecorSetActive(null);
  });
}

// Ghi style vị trí/kích thước từ model lên node (dùng cả lúc render lẫn lúc kéo).
function _cxDecorStyle(node, d) {
  node.style.left = d.x + "%";
  node.style.top = d.y + "%";
  node.style.width = d.w + "%";
  node.style.transform = `translate(-50%, -50%) rotate(${d.rot || 0}deg)`;
}

// Hoa "sau chữ" có 2 node: bản trong suốt bắt chuột (node) + ảnh thật ở lớp
// dưới (_cxTwin). Kéo/xoay/phóng to phải cập nhật cả hai.
function _cxDecorApply(node, d) {
  _cxDecorStyle(node, d);
  if (node._cxTwin) _cxDecorStyle(node._cxTwin, d);
}

const _CX_DECOR_ICONS = {
  del: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  rot: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 3v6h-6"/></svg>',
  size: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/></svg>',
  // Hai tấm chồng nhau = NHÂN ĐÔI (đúng nghĩa quen thuộc của icon này).
  copy: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
  // Nhiều lớp xếp chồng = ĐỔI LỚP trước/sau, không lẫn với nhân đôi.
  layers:
    '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 2 7l10 5 10-5-10-5Z"/><path d="m2 17 10 5 10-5"/><path d="m2 12 10 5 10-5"/></svg>',
};

function _cxDecorButton(cls, title, icon) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "cx-decor-h " + cls;
  b.title = title;
  b.setAttribute("aria-label", title);
  b.innerHTML = icon;
  return b;
}

function _cxDecorNode(d, edit) {
  const node = document.createElement("div");
  node.className = "cx-decor" + (edit ? " cx-decor-edit" : "");
  node.setAttribute("data-decor-id", d.id);
  if (edit && d.id === _cxDecorActiveId) node.classList.add("cx-decor-active");
  _cxDecorStyle(node, d);

  const img = document.createElement("img");
  img.src = d.src;
  img.alt = "";
  // KHÔNG dùng loading="lazy": thiệp rất dài nên hoa ở dưới sẽ chưa tải, khung
  // bọc cao 0px → không bấm/kéo được (và ở public thì hụt cả chỗ trống).
  node.appendChild(img);

  if (!edit) return node;

  const del = _cxDecorButton("cx-decor-del", "Xoá", _CX_DECOR_ICONS.del);
  del.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    _cxDecorDelete(d.id);
  });
  const copy = _cxDecorButton("cx-decor-copy", "Nhân đôi", _CX_DECOR_ICONS.copy);
  copy.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    _cxDecorDuplicate(d.id);
  });
  const back = _cxDecorButton(
    "cx-decor-back",
    d.behind ? "Đưa lên trước chữ" : "Đưa ra sau chữ",
    _CX_DECOR_ICONS.layers,
  );
  back.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    d.behind = !d.behind;
    _cxDecorRender();
    _cxDecorReport();
  });
  const rot = _cxDecorButton("cx-decor-rot", "Kéo để xoay", _CX_DECOR_ICONS.rot);
  const size = _cxDecorButton("cx-decor-size", "Kéo để phóng to", _CX_DECOR_ICONS.size);
  node.append(del, copy, back, rot, size);

  _cxDecorWireMove(node, d);
  _cxDecorWireHandle(rot, node, d, "rotate");
  _cxDecorWireHandle(size, node, d, "resize");
  return node;
}

// Kéo cả ảnh → đổi toạ độ tâm (%).
function _cxDecorWireMove(node, d) {
  node.addEventListener("pointerdown", (e) => {
    if (e.target.closest(".cx-decor-h")) return; // nút công cụ tự lo
    _cxDecorSetActive(d.id);
    const card = document.getElementById("main-card");
    if (!card) return;
    const r = card.getBoundingClientRect();
    const start = { x: e.clientX, y: e.clientY, dx: d.x, dy: d.y };
    e.preventDefault();
    try {
      node.setPointerCapture(e.pointerId);
    } catch (err) {}
    node.style.cursor = "grabbing";

    const move = (ev) => {
      d.x = _cxDecorClamp(start.dx + ((ev.clientX - start.x) / r.width) * 100, 0, 100);
      d.y = _cxDecorClamp(start.dy + ((ev.clientY - start.y) / r.height) * 100, 0, 100);
      _cxDecorApply(node, d);
    };
    const up = () => {
      node.removeEventListener("pointermove", move);
      node.removeEventListener("pointerup", up);
      node.removeEventListener("pointercancel", up);
      node.style.cursor = "";
      // Làm tròn 1 chữ số thập phân: đủ mịn mà JSON không phình vì số lẻ dài.
      d.x = Math.round(d.x * 10) / 10;
      d.y = Math.round(d.y * 10) / 10;
      _cxDecorReport();
    };
    node.addEventListener("pointermove", move);
    node.addEventListener("pointerup", up);
    node.addEventListener("pointercancel", up);
  });
}

// Tay nắm xoay / phóng to. Cả hai tính theo VECTOR từ tâm ảnh tới con trỏ nên
// không phụ thuộc góc đang xoay.
function _cxDecorWireHandle(btn, node, d, mode) {
  btn.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    e.stopPropagation();
    _cxDecorSetActive(d.id);
    const box = node.getBoundingClientRect();
    const cx = box.left + box.width / 2;
    const cy = box.top + box.height / 2;
    const startDist = Math.hypot(e.clientX - cx, e.clientY - cy) || 1;
    const startAngle = (Math.atan2(e.clientY - cy, e.clientX - cx) * 180) / Math.PI;
    const startW = d.w;
    const startRot = d.rot || 0;
    try {
      btn.setPointerCapture(e.pointerId);
    } catch (err) {}

    const move = (ev) => {
      if (mode === "resize") {
        const dist = Math.hypot(ev.clientX - cx, ev.clientY - cy);
        d.w = _cxDecorClamp(
          startW * (dist / startDist),
          CX_DECOR_MIN_W,
          CX_DECOR_MAX_W,
        );
      } else {
        const ang = (Math.atan2(ev.clientY - cy, ev.clientX - cx) * 180) / Math.PI;
        let next = Math.round(startRot + (ang - startAngle));
        // Giữ phím Shift → nhảy từng 15° cho dễ canh thẳng.
        if (ev.shiftKey) next = Math.round(next / 15) * 15;
        d.rot = ((next % 360) + 360) % 360;
      }
      _cxDecorApply(node, d);
    };
    const up = () => {
      btn.removeEventListener("pointermove", move);
      btn.removeEventListener("pointerup", up);
      btn.removeEventListener("pointercancel", up);
      // Làm tròn khi thả: số lẻ 12 chữ số thập phân chỉ tổ phình JSON.
      d.w = Math.round(d.w * 10) / 10;
      d.x = Math.round(d.x * 10) / 10;
      d.y = Math.round(d.y * 10) / 10;
      _cxDecorReport();
    };
    btn.addEventListener("pointermove", move);
    btn.addEventListener("pointerup", up);
    btn.addEventListener("pointercancel", up);
  });
}

function _cxDecorRender() {
  if (!document.getElementById("main-card")) return;
  _cxDecorEnsureStyle();
  const edit = _isEditMode();
  if (edit) _cxDecorBindOutside();

  const front = _cxDecorLayer(false);
  const back = _cxDecorLayer(true);
  if (!front || !back) return;
  front.innerHTML = "";
  back.innerHTML = "";

  // Layer luôn trong suốt với chuột; chỉ TỪNG ảnh ở chế độ chỉnh mới bắt chuột
  // (class cx-decor-edit) — trang công khai không được để hoa chắn nút bấm.
  _cxDecors.forEach((d) => {
    if (!edit || !d.behind) {
      (d.behind ? back : front).appendChild(_cxDecorNode(d, edit));
      return;
    }
    // Hoa "sau chữ" lúc CHỈNH: ảnh thật vẫn ở lớp sau (thấy đúng như khách
    // xem), nhưng bộ điều khiển là một bản trong suốt ở lớp trước — nếu không
    // thì nội dung thiệp che mất, bấm chọn lại không được nữa.
    const visual = _cxDecorNode(d, false);
    back.appendChild(visual);
    const ctrl = _cxDecorNode(d, true);
    ctrl.classList.add("cx-decor-proxy");
    ctrl._cxTwin = visual;
    front.appendChild(ctrl);
  });
}

/**
 * Nhân đôi: bản sao lệch CHÉO một đoạn nhỏ để nhìn ra ngay là có 2 bông, nhưng
 * vẫn đủ gần chỗ cũ.
 *
 * Đoạn lệch tính bằng PX thật rồi đổi ngược ra % của từng trục: thiệp cao gấp
 * nhiều lần bề ngang nên nếu cộng thẳng cùng một số % cho cả hai trục thì dọc
 * nhảy cả trăm px trong khi ngang chỉ nhích vài chục — nhìn như bị rơi xuống
 * chứ không phải bản sao. Lấy theo cỡ bông hoa (18% bề ngang của nó, tối thiểu
 * 12px) để hoa to lệch nhiều, icon nhỏ lệch ít.
 */
function _cxDecorDuplicate(id) {
  const src = _cxDecorFind(id);
  if (!src) return;

  const card = document.getElementById("main-card");
  const r = card && card.getBoundingClientRect();
  let dx = 2;
  let dy = 2;
  if (r && r.width && r.height) {
    const stepPx = Math.max(12, (src.w / 100) * r.width * 0.18);
    dx = (stepPx / r.width) * 100;
    dy = (stepPx / r.height) * 100;
  }
  // Sát mép phải/đáy thì lệch ngược lại cho khỏi bị kẹp mất phần lệch.
  const nx = src.x + dx > 97 ? src.x - dx : src.x + dx;
  const ny = src.y + dy > 97 ? src.y - dy : src.y + dy;

  const copy = {
    ...src,
    id: "dc_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    x: Math.round(_cxDecorClamp(nx, 0, 100) * 10) / 10,
    y: Math.round(_cxDecorClamp(ny, 0, 100) * 10) / 10,
  };
  _cxDecors.push(copy);
  _cxDecorActiveId = copy.id; // bản mới thành cái đang chọn để kéo đi luôn
  _cxDecorRender();
  _cxDecorReport();
}

function _cxDecorDelete(id) {
  _cxDecors = _cxDecors.filter((d) => d.id !== id);
  if (_cxDecorActiveId === id) _cxDecorActiveId = null;
  _cxDecorRender();
  _cxDecorReport();
}

/**
 * Thêm 1 hoạ tiết. Toạ độ nhận từ trang cha là PX theo viewport iframe (điểm
 * thả), đổi sang % của #main-card ở đây; không truyền → đặt giữa thiệp.
 */
function _cxDecorAdd(src, clientX, clientY) {
  const card = document.getElementById("main-card");
  if (!card || !src) return;
  const r = card.getBoundingClientRect();
  const x =
    clientX == null ? 50 : _cxDecorClamp(((clientX - r.left) / r.width) * 100, 0, 100);
  const y =
    clientY == null ? 50 : _cxDecorClamp(((clientY - r.top) / r.height) * 100, 0, 100);

  const id = "dc_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  _cxDecors.push({
    id,
    src,
    x: Math.round(x * 10) / 10,
    y: Math.round(y * 10) / 10,
    w: CX_DECOR_DEFAULT_W,
    rot: 0,
    behind: false,
  });
  _cxDecorActiveId = id; // vừa thả → hiện sẵn viền + nút
  _cxDecorRender();
  _cxDecorReport();
}

// Render từ theme_setting (public + preview + edit).
function applyDecorations(setting) {
  if (!document.getElementById("main-card")) return;
  if (typeof setting === "string") {
    try {
      setting = JSON.parse(setting);
    } catch (e) {
      setting = null;
    }
  }
  const arr =
    setting && Array.isArray(setting.decorations) ? setting.decorations : [];
  _cxDecors = arr
    .filter((d) => d && typeof d.src === "string")
    .map((d) => ({
      id: d.id || "dc_" + Math.random().toString(36).slice(2, 8),
      src: d.src,
      x: _cxDecorClamp(Number(d.x) || 0, 0, 100),
      y: _cxDecorClamp(Number(d.y) || 0, 0, 100),
      w: _cxDecorClamp(Number(d.w) || CX_DECOR_DEFAULT_W, CX_DECOR_MIN_W, CX_DECOR_MAX_W),
      rot: Number(d.rot) || 0,
      behind: !!d.behind,
    }));
  _cxDecorRender();
}

// ============================================================
// TOOLS — "công cụ" thả tự do lên thiệp (trước mắt: Trình phát nhạc).
// Danh mục công cụ + markup từng mẫu nằm ở core/helpers/tools-helper.js.
// Lưu ở theme_setting.tools = [{ id, tool, variant, x, y, w, visible }]:
//   x, y  % so với #main-card, tính theo TÂM widget — giống hoạ tiết, nên giữ
//         đúng chỗ trên mọi khổ màn hình.
//   w     % bề ngang thiệp; visible=false = tạm ẩn (vẫn giữ chỗ để bật lại).
//
// Khác hoạ tiết ở đúng hai chỗ:
//   · Trang công khai widget PHẢI bấm được (phát, tua, kéo xem tóm tắt) nên nó
//     luôn bắt chuột, không như hoa chỉ để ngắm.
//   · Ngược lại, ở chế độ chỉnh thì KHOÁ hết tương tác bên trong — không thì kéo
//     widget đi lại hoá ra bấm nút phát.
// ============================================================
let _cxTools = [];
let _cxToolActiveId = null;
let _cxToolOutsideBound = false;
let _cxToolResizeBound = false;

function _cxToolDef(t) {
  return (window.CX_TOOLS || {})[t && t.tool];
}

function _cxToolVariant(t) {
  const def = _cxToolDef(t);
  if (!def) return null;
  return def.variants.find((v) => v.id === t.variant) || def.variants[0];
}

// Công cụ cần nhạc nền mà thiệp chưa có link → không vẽ trình phát câm.
function _cxToolReady(t) {
  const def = _cxToolDef(t);
  return !def || def.needs !== "music" || !!window.__cxMusicOn;
}

function _cxToolLayer() {
  const card = document.getElementById("main-card");
  if (!card) return null;
  if (getComputedStyle(card).position === "static")
    card.style.position = "relative";
  if (getComputedStyle(card).isolation !== "isolate")
    card.style.isolation = "isolate";
  let layer = document.getElementById("cx-tool-layer");
  if (!layer || layer.parentElement !== card) {
    layer = document.createElement("div");
    layer.id = "cx-tool-layer";
    layer.className = "cx-tool-layer";
    // 46: ngay trên lớp hoa (45) — công cụ là thứ bấm được nên không để hoa đè.
    layer.style.zIndex = "46";
    card.appendChild(layer);
  }
  return layer;
}

function _cxToolEnsureStyle() {
  if (document.getElementById("cx-tool-style")) return;
  const s = document.createElement("style");
  s.id = "cx-tool-style";
  s.textContent =
    ".cx-tool-layer{position:absolute;inset:0;overflow:hidden;pointer-events:none}" +
    ".cx-tool{position:absolute;transform:translate(-50%,-50%);pointer-events:auto}" +
    // Chế độ chỉnh: cả widget là một mảng để kéo, ruột không bấm được.
    ".cx-tool-edit{cursor:grab;touch-action:none}" +
    ".cx-tool-edit>*{pointer-events:none}" +
    ".cx-tool-edit.cx-tool-active{outline:1px dashed #e11d48;outline-offset:6px}" +
    // Đang tắt hiển thị: chỉ thấy mờ ở chế độ chỉnh để còn bật lại / dời chỗ.
    ".cx-tool-off{opacity:.4}" +
    ".cx-tool-badge{position:absolute;left:50%;top:-2.2em;transform:translateX(-50%);" +
    "display:none;padding:2px 8px;border-radius:9999px;background:#111;color:#fff;" +
    "font:500 11px/1.6 system-ui,sans-serif;white-space:nowrap;pointer-events:none}" +
    ".cx-tool-off .cx-tool-badge{display:block}" +
    // Ô nhắc khi chưa có nhạc nền (chỉ hiện lúc chỉnh)
    ".cx-tool-hint{display:flex;align-items:center;gap:8px;padding:10px 12px;" +
    "border:1px dashed #e11d48;border-radius:12px;background:rgba(255,255,255,.9);" +
    "color:#9f1239;font:500 12px/1.4 system-ui,sans-serif;text-align:left}" +
    // Bộ nút giống hoạ tiết cho quen tay
    ".cx-tool-h{position:absolute;width:24px;height:24px;border-radius:9999px;" +
    "background:#fff;border:1px solid #e11d48;color:#e11d48;display:none;" +
    "align-items:center;justify-content:center;padding:0;cursor:pointer;" +
    "box-shadow:0 2px 6px rgba(0,0,0,.18);touch-action:none;z-index:1;pointer-events:auto}" +
    ".cx-tool-active .cx-tool-h{display:flex}" +
    ".cx-tool-del{top:-12px;left:-12px}" +
    ".cx-tool-skin{top:-12px;left:50%;margin-left:-12px}" +
    ".cx-tool-eye{bottom:-12px;left:-12px}" +
    ".cx-tool-size{bottom:-12px;right:-12px;cursor:nwse-resize}";
  document.head.appendChild(s);
}

// Vị trí + bề ngang + CỠ CHỮ. Cỡ chữ tính từ bề ngang thật của widget (hệ số
// `fs` của từng mẫu) vì ruột widget viết bằng `em` — nhờ vậy kéo to nhỏ là phóng
// cả widget theo tỉ lệ, không phải widget to mà chữ vẫn bé như cũ.
function _cxToolStyle(node, t) {
  const v = _cxToolVariant(t);
  node.style.left = t.x + "%";
  node.style.top = t.y + "%";
  node.style.width = t.w + "%";
  const card = document.getElementById("main-card");
  const cw = card ? card.getBoundingClientRect().width : 0;
  if (cw && v && v.fs) {
    node.style.fontSize =
      Math.max(7, Math.round(((cw * t.w) / 100) * v.fs * 10) / 10) + "px";
  }
}

let _cxToolReportTimer = null;
function _cxToolReport() {
  clearTimeout(_cxToolReportTimer);
  _cxToolReportTimer = setTimeout(() => {
    try {
      parent.postMessage({ type: "cx-tools-changed", tools: _cxTools }, "*");
    } catch (e) {}
  }, 200);
}

function _cxToolSetActive(id) {
  _cxToolActiveId = id || null;
  document.querySelectorAll(".cx-tool").forEach((n) => {
    n.classList.toggle(
      "cx-tool-active",
      n.getAttribute("data-tool-id") === _cxToolActiveId,
    );
  });
}

function _cxToolBindOutside() {
  if (_cxToolOutsideBound) return;
  _cxToolOutsideBound = true;
  document.addEventListener("pointerdown", (e) => {
    const t = e.target;
    if (t && t.closest && t.closest(".cx-tool")) return;
    if (_cxToolActiveId) _cxToolSetActive(null);
  });
}

const _CX_TOOL_ICONS = {
  skin: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>',
  eye: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>',
  eyeOff:
    '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.6 6.1A9.9 9.9 0 0 1 12 6c6.4 0 10 7 10 7a15 15 0 0 1-3 3.7M6.6 6.6A15 15 0 0 0 2 13s3.6 7 10 7a9.6 9.6 0 0 0 4.6-1.1"/><path d="M2 2l20 20"/></svg>',
};

function _cxToolButton(cls, title, icon) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "cx-tool-h " + cls;
  b.title = title;
  b.setAttribute("aria-label", title);
  b.innerHTML = icon;
  return b;
}

function _cxToolBody(t) {
  const def = _cxToolDef(t);
  const v = _cxToolVariant(t);
  if (!def || !v) return null;
  if (!_cxToolReady(t)) {
    const hint = document.createElement("div");
    hint.className = "cx-tool-hint";
    hint.innerHTML =
      def.icon + "<span>Chưa có nhạc nền — chọn bài ở tab Thiết lập</span>";
    return hint;
  }
  return def.build(v.id);
}

function _cxToolNode(t, edit) {
  const node = document.createElement("div");
  node.className = "cx-tool" + (edit ? " cx-tool-edit" : "");
  node.setAttribute("data-tool-id", t.id);
  if (edit && t.id === _cxToolActiveId) node.classList.add("cx-tool-active");
  if (edit && !t.visible) node.classList.add("cx-tool-off");
  _cxToolStyle(node, t);

  const body = _cxToolBody(t);
  if (!body) return null;
  node.appendChild(body);
  node._cxBody = body;

  if (!edit) return node;

  const badge = document.createElement("span");
  badge.className = "cx-tool-badge";
  badge.textContent = "Đang ẩn";
  node.appendChild(badge);

  const del = _cxToolButton("cx-tool-del", "Xoá", _CX_DECOR_ICONS.del);
  del.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    _cxToolDelete(t.id);
  });
  // Đổi mẫu ngay trên thiệp: bấm là xoay vòng qua các mẫu của công cụ. Bảng
  // Công cụ bên trái vẫn chọn thẳng được từng mẫu.
  const def = _cxToolDef(t);
  const skin = _cxToolButton(
    "cx-tool-skin",
    "Đổi mẫu (" + (_cxToolVariant(t) || {}).name + ")",
    _CX_TOOL_ICONS.skin,
  );
  skin.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    const list = def.variants;
    const i = list.findIndex((v) => v.id === t.variant);
    _cxToolSet(t.id, { variant: list[(i + 1) % list.length].id });
  });
  const eye = _cxToolButton(
    "cx-tool-eye",
    t.visible ? "Ẩn trên thiệp" : "Hiện lại",
    t.visible ? _CX_TOOL_ICONS.eye : _CX_TOOL_ICONS.eyeOff,
  );
  eye.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    _cxToolSet(t.id, { visible: !t.visible });
  });
  const size = _cxToolButton(
    "cx-tool-size",
    "Kéo để phóng to",
    _CX_DECOR_ICONS.size,
  );
  node.append(del, skin, eye, size);

  _cxToolWireMove(node, t);
  _cxToolWireResize(size, node, t);
  return node;
}

// Kéo cả widget → đổi toạ độ tâm (%). Giống hệt hoạ tiết.
function _cxToolWireMove(node, t) {
  node.addEventListener("pointerdown", (e) => {
    if (e.target.closest(".cx-tool-h")) return;
    _cxToolSetActive(t.id);
    const card = document.getElementById("main-card");
    if (!card) return;
    const r = card.getBoundingClientRect();
    const start = { x: e.clientX, y: e.clientY, dx: t.x, dy: t.y };
    e.preventDefault();
    try {
      node.setPointerCapture(e.pointerId);
    } catch (err) {}
    node.style.cursor = "grabbing";

    const move = (ev) => {
      t.x = _cxDecorClamp(
        start.dx + ((ev.clientX - start.x) / r.width) * 100,
        0,
        100,
      );
      t.y = _cxDecorClamp(
        start.dy + ((ev.clientY - start.y) / r.height) * 100,
        0,
        100,
      );
      _cxToolStyle(node, t);
    };
    const up = () => {
      node.removeEventListener("pointermove", move);
      node.removeEventListener("pointerup", up);
      node.removeEventListener("pointercancel", up);
      node.style.cursor = "";
      t.x = Math.round(t.x * 10) / 10;
      t.y = Math.round(t.y * 10) / 10;
      _cxToolReport();
    };
    node.addEventListener("pointermove", move);
    node.addEventListener("pointerup", up);
    node.addEventListener("pointercancel", up);
  });
}

// Phóng to: chỉ đổi bề ngang (không xoay — widget có chữ, nghiêng là không đọc
// được). Kẹp trong khoảng min/max của TỪNG MẪU: nút tròn 34% đã là to, còn
// thanh ngang dưới 45% thì chữ và ba nút chen nhau.
function _cxToolWireResize(btn, node, t) {
  btn.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    e.stopPropagation();
    _cxToolSetActive(t.id);
    const v = _cxToolVariant(t) || {};
    const box = node.getBoundingClientRect();
    const cx = box.left + box.width / 2;
    const cy = box.top + box.height / 2;
    const startDist = Math.hypot(e.clientX - cx, e.clientY - cy) || 1;
    const startW = t.w;
    try {
      btn.setPointerCapture(e.pointerId);
    } catch (err) {}

    const move = (ev) => {
      const dist = Math.hypot(ev.clientX - cx, ev.clientY - cy);
      t.w = _cxDecorClamp(
        startW * (dist / startDist),
        v.minW || 8,
        v.maxW || 100,
      );
      _cxToolStyle(node, t);
    };
    const up = () => {
      btn.removeEventListener("pointermove", move);
      btn.removeEventListener("pointerup", up);
      btn.removeEventListener("pointercancel", up);
      t.w = Math.round(t.w * 10) / 10;
      _cxToolReport();
    };
    btn.addEventListener("pointermove", move);
    btn.addEventListener("pointerup", up);
    btn.addEventListener("pointercancel", up);
  });
}

function _cxToolRender() {
  if (!document.getElementById("main-card")) return;
  _cxToolEnsureStyle();
  const edit = _isEditMode();
  if (edit) _cxToolBindOutside();

  const layer = _cxToolLayer();
  if (!layer) return;
  layer.innerHTML = "";

  // Có công cụ nhạc thì trình phát SẴN CÓ của theme phải nhường chỗ, không thì
  // thiệp có hai trình phát cùng lúc. Gỡ công cụ đi thì trả lại như cũ.
  const themePlayer = document.getElementById("music-toggle");
  if (themePlayer) {
    if (_cxTools.some((t) => t.tool === "music")) {
      themePlayer.dataset.cxToolHidden = "1";
      themePlayer.style.display = "none";
    } else if (themePlayer.dataset.cxToolHidden) {
      delete themePlayer.dataset.cxToolHidden;
      themePlayer.style.display = window.__cxMusicOn ? "flex" : "none";
    }
  }

  _cxTools.forEach((t) => {
    // Tắt hiển thị / chưa có nhạc → trang công khai không vẽ gì; lúc chỉnh vẫn
    // vẽ (mờ đi) để còn bật lại hoặc dời chỗ.
    if (!edit && (!t.visible || !_cxToolReady(t))) return;
    const node = _cxToolNode(t, edit);
    if (!node) return;
    layer.appendChild(node);
    // Gắn logic trình phát SAU khi đã vào DOM (helper đo khung để chạy chữ).
    // Chế độ chỉnh thì không gắn: ruột widget đã bị khoá chuột, gắn vào chỉ tổ
    // bật nhạc ngoài ý muốn khi bấm chọn.
    if (edit || !_cxToolReady(t)) return;
    if (window.replayMusicSummary) window.replayMusicSummary(node._cxBody);
    if (window.setupMusicPlayer) window.setupMusicPlayer(node._cxBody);
  });

  // Đổi khổ màn hình → bề ngang thiệp đổi → phải tính lại cỡ chữ theo px.
  if (!_cxToolResizeBound) {
    _cxToolResizeBound = true;
    let raf = 0;
    window.addEventListener("resize", () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        document.querySelectorAll(".cx-tool").forEach((n) => {
          const t = _cxTools.find(
            (x) => x.id === n.getAttribute("data-tool-id"),
          );
          if (t) _cxToolStyle(n, t);
        });
      });
    });
  }
}

function _cxToolFind(id) {
  return _cxTools.find((t) => t.id === id);
}

function _cxToolDelete(id) {
  _cxTools = _cxTools.filter((t) => t.id !== id);
  if (_cxToolActiveId === id) _cxToolActiveId = null;
  _cxToolRender();
  _cxToolReport();
}

// Đổi mẫu / bật tắt hiển thị. Đổi mẫu thì trả bề ngang về mặc định của mẫu mới:
// thanh ngang 88% mà giữ nguyên khi sang nút tròn thì ra một nút to bằng nửa thiệp.
function _cxToolSet(id, patch) {
  const t = _cxToolFind(id);
  if (!t || !patch) return;
  if (patch.variant && patch.variant !== t.variant) {
    const def = _cxToolDef(t);
    const v = def && def.variants.find((x) => x.id === patch.variant);
    if (v) {
      t.variant = v.id;
      t.w = v.w;
    }
  }
  if (typeof patch.visible === "boolean") t.visible = patch.visible;
  _cxToolActiveId = t.id;
  _cxToolRender();
  _cxToolReport();
}

/**
 * Thả một công cụ. Toạ độ nhận từ trang cha là PX theo viewport iframe (điểm
 * thả), đổi sang % của #main-card ở đây; không truyền → đặt giữa thiệp.
 * Công cụ `single` đã có sẵn thì KHÔNG thêm cái thứ hai, chỉ dời tới chỗ vừa thả.
 */
function _cxToolAdd(toolId, clientX, clientY) {
  const def = (window.CX_TOOLS || {})[toolId];
  const card = document.getElementById("main-card");
  if (!def || !card) return;
  const r = card.getBoundingClientRect();
  const x =
    clientX == null
      ? 50
      : _cxDecorClamp(((clientX - r.left) / r.width) * 100, 0, 100);
  const y =
    clientY == null
      ? 50
      : _cxDecorClamp(((clientY - r.top) / r.height) * 100, 0, 100);

  const exist = def.single && _cxTools.find((t) => t.tool === toolId);
  if (exist) {
    exist.x = Math.round(x * 10) / 10;
    exist.y = Math.round(y * 10) / 10;
    exist.visible = true; // thả lại = muốn thấy nó
    _cxToolActiveId = exist.id;
  } else {
    const v = def.variants[0];
    const id =
      "tl_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    _cxTools.push({
      id,
      tool: toolId,
      variant: v.id,
      x: Math.round(x * 10) / 10,
      y: Math.round(y * 10) / 10,
      w: v.w,
      visible: true,
    });
    _cxToolActiveId = id;
  }
  _cxToolRender();
  _cxToolReport();
}

// Render từ theme_setting (public + preview + edit).
function applyTools(setting) {
  if (!document.getElementById("main-card")) return;
  if (typeof setting === "string") {
    try {
      setting = JSON.parse(setting);
    } catch (e) {
      setting = null;
    }
  }
  const arr = setting && Array.isArray(setting.tools) ? setting.tools : [];
  const reg = window.CX_TOOLS || {};
  _cxTools = arr
    .filter((t) => t && reg[t.tool])
    .map((t) => {
      const def = reg[t.tool];
      const v = def.variants.find((x) => x.id === t.variant) || def.variants[0];
      return {
        id: t.id || "tl_" + Math.random().toString(36).slice(2, 8),
        tool: t.tool,
        variant: v.id,
        x: _cxDecorClamp(Number(t.x) || 0, 0, 100),
        y: _cxDecorClamp(Number(t.y) || 0, 0, 100),
        w: _cxDecorClamp(Number(t.w) || v.w, v.minW, v.maxW),
        visible: t.visible !== false,
      };
    });
  _cxToolRender();
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
    // Ô "Nội dung" ở panel vừa đổi → ghi vào model khối
    else if (d.type === "cx-block-text") _cxSetContent(d.id, d.text);
    // Hoạ tiết: thả từ bảng chọn của panel (x,y = px theo viewport iframe)
    else if (d.type === "cx-add-decor") _cxDecorAdd(d.src, d.x, d.y);
    // Công cụ: thả từ bảng chọn, và đổi mẫu / ẩn hiện từ bảng
    else if (d.type === "cx-add-tool") _cxToolAdd(d.tool, d.x, d.y);
    else if (d.type === "cx-tool-set") _cxToolSet(d.id, d.patch);
    else if (d.type === "cx-tool-del") _cxToolDelete(d.id);
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
  window.applyDecorations = applyDecorations;
  window.applyTools = applyTools;
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
    // .cx-custom-block: khối tự thêm có luồng chọn riêng (__cxPickBlockBody) nên
    // không để runtime chung bắt hover/click vào nó. .cx-decor: hoạ tiết có bộ
    // nút riêng (kéo/xoay/phóng to/xoá), không phải chữ để chỉnh.
    if (
      el.closest(
        "a, button, input, textarea, select, iframe, [contenteditable], .cx-no-edit, .cx-custom-block, .cx-decor",
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

  // Gửi thông tin dòng (selector + style hiện tại) về trang cha để mở/cập nhật
  // bảng chỉnh. `extra` để khối văn bản tự thêm ghi đè vài field (xem
  // __cxPickBlockBody).
  function _sendPick(el, selector, extra) {
    const cs = getComputedStyle(el);
    const txt = (el.textContent || "").trim();
    parent.postMessage(
      Object.assign(
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
        extra || {},
      ),
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

  // Custom-block gọi hàm này để mở bảng chỉnh chi tiết cho chữ trong khối. Viền
  // + nút của khối do chính nó lo (.cx-cb-active) nên bỏ picked/nút X để khỏi
  // chồng 2 lớp viền. Nội dung khối sửa ở ô "Nội dung" của panel → luôn gửi
  // bound:false + textOnly:true (danh sách có <li> con vẫn cho sửa) kèm blockId
  // để trang cha ghi vào model thay vì text_overrides.
  window.__cxPickBlockBody = function (el, more) {
    if (!el) return;
    if (picked) picked.classList.remove("cx-edit-picked");
    picked = null;
    _hideDelBtn();
    const isList = el.tagName === "OL" || el.tagName === "UL";
    const text = isList
      ? Array.from(el.querySelectorAll("li"))
          .map((li) => li.textContent)
          .join("\n")
      : el.textContent || "";
    _sendPick(
      el,
      _selector(el),
      Object.assign(
        {
          bound: false,
          textOnly: true,
          text: text.slice(0, 2000),
          blockId: el.id || null,
          blockList: isList,
        },
        more || {},
      ),
    );
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
        // Khối văn bản tự thêm → đi lại đúng luồng riêng của nó (giữ ô "Nội
        // dung", không bật viền/nút X của runtime chung).
        if (el.closest(".cx-custom-block")) {
          window.__cxPickBlockBody(el);
          return;
        }
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
