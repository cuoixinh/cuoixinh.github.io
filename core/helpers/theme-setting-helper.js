// Áp dụng theme_setting lên thiệp: font/màu chung, khối văn bản, hoạ tiết,
// thành phần. Dùng chung cho trang thiệp public, xem trước và trình soạn thiệp.

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

// ── BỘ MÀU (theme_setting.palette) ─────────────────────────────────────────
// Một bộ màu = cả bảng màu của thiệp. Áp bằng cách đổ vào token --cx-*-rgb ở
// :root — mọi mẫu trong public/themes/* đều vẽ theo bộ token đó (khai mặc định
// ở styles/_common.css) nên một lần chọn là đổi toàn thiệp, không phải rải
// selector cho từng mục.
//
// Danh mục các bộ nằm ở core/helpers/card-palette-helper.js và CHỈ trang Thiết
// lập nạp: thiệp lưu nguyên 9 màu đã chọn nên trang thiệp dựng lại được mà
// không cần danh mục.
//
// Ô màu lẻ (heading_color, body_color…) vẫn ghi đè lên trên bằng !important:
// chọn bộ trước, chỉnh tay sau.
const CX_PALETTE_KEYS = [
  "heading",
  "body",
  "accent",
  "on_accent",
  "line",
  "surface",
  "card_bg",
  "cover",
  "cover_mid",
];

const CX_PALETTE_TOKENS = {
  heading: "--cx-heading-rgb",
  body: "--cx-body-rgb",
  accent: "--cx-accent-rgb",
  on_accent: "--cx-on-accent-rgb",
  line: "--cx-line-rgb",
  surface: "--cx-surface-rgb",
  card_bg: "--cx-card-bg-rgb",
  cover: "--cx-cover-rgb",
  cover_mid: "--cx-cover-mid-rgb",
};

// Token viết dạng bộ ba "r g b" (không phải mã hex) để chỗ dùng còn chèn được
// alpha: rgb(var(--cx-accent-rgb) / 0.2). Trả "" nếu chuỗi không phải hex.
function _cxHexToRgbTriplet(hex) {
  if (typeof hex !== "string") return "";
  let h = hex.trim().replace(/^#/, "");
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return "";
  return `${parseInt(h.slice(0, 2), 16)} ${parseInt(h.slice(2, 4), 16)} ${parseInt(h.slice(4, 6), 16)}`;
}

// Trả về rule `:root { … }` cho bộ màu, hoặc "" nếu không có bộ nào hợp lệ.
// Khoá thiếu thì bỏ qua để token của mẫu vẫn giữ nguyên — bộ màu khuyết một ô
// không được phép làm hỏng cả thiệp.
function _cxPaletteRule(palette) {
  if (!palette || typeof palette !== "object") return "";
  const decls = [];
  CX_PALETTE_KEYS.forEach((k) => {
    const rgb = _cxHexToRgbTriplet(palette[k]);
    if (rgb) decls.push(`${CX_PALETTE_TOKENS[k]}: ${rgb}`);
  });
  return decls.length ? `:root { ${decls.join("; ")}; }` : "";
}

// Các class font/màu mà thiệp đang dùng → ghi đè khi có theme_setting.
// Tiêu đề = chữ lớn đậm; Nội dung = chữ đọc thường; Nhấn = icon/hoa văn/viền.
// Theme dùng class khác thì khai CX_THEME.selectors trong index.js của mình —
// KHÔNG chèn thêm class của theme mới vào bảng dưới đây.
// .cx-hd/.cx-bd/.cx-ac là lớp ngữ nghĩa của markup do helper dùng chung sinh ra
// (dòng thời gian, chuyện tình yêu) — mọi theme nên giữ chúng trong bảng của mình.
const CX_DEFAULT_SELECTORS = {
  headingFont: ".font-cormorant, .font-playfair, .font-cinzel, .font-prata",
  bodyFont: "body, .font-inter",
  headingColor: ".cx-hd, .text-charcoal, .text-stone-custom-500",
  bodyColor: ".cx-bd, .text-stone-custom-400",
  accentColor: ".cx-ac, .text-rose-pastel-300, .text-rose-pastel-200",
  // Nền thiệp: body (khung ngoài) + thẻ chính của thiệp.
  background: "body, #main-card",
};

// Bản khai của theme đang mở (public/themes/<theme>/index.js đặt window.CX_THEME).
// Hàm này luôn chạy TRONG cửa sổ của thiệp — trang Thiết lập gọi qua
// iframe.contentWindow.applyThemeSetting nên vẫn thấy đúng bản khai.
function _cxSel(key) {
  const t = window.CX_THEME;
  return (t && t.selectors && t.selectors[key]) || CX_DEFAULT_SELECTORS[key];
}

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

// ── CHỤM 2 NGÓN ĐỂ PHÓNG TO ────────────────────────────────────────────────
// Dùng chung cho khối văn bản / hoạ tiết / thành phần: đặt 2 ngón NGAY TRONG
// lòng khối rồi chụm-xoè là đổi cỡ, khỏi phải trúng nút góc. Máy tính: Ctrl +
// lăn chuột (đúng cử chỉ chụm của bàn rê).
//   onStart()  ghi lại cỡ đang có   ·  onScale(k)  k = tỉ lệ so với lúc bắt đầu
//   onEnd()    làm tròn + lưu
// Trả về hàm hỏi "đang chụm?" — thao tác KÉO 1 ngón phải tự dừng khi thấy cờ này,
// nếu không ngón thứ hai sẽ vừa phóng to vừa lôi khối đi.
function _cxWirePinch(node, onStart, onScale, onEnd) {
  const pts = new Map();
  let base = 0;
  let live = false;
  let wheelK = 1;
  let wheelTimer = null;

  const spread = () => {
    const [a, b] = Array.from(pts.values());
    return Math.hypot(a.x - b.x, a.y - b.y);
  };
  const finish = () => {
    if (!live) return;
    live = false;
    onEnd();
  };

  // Ngón ĐẦU phải chạm vào khối, ngón thứ hai bắt ở cấp document: khối nhỏ (bông
  // hoa 20% bề ngang) thì ngón kia rất dễ đặt hụt ra ngoài mép.
  const down = (e) => {
    if (e.pointerType === "mouse" || pts.size >= 2) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size < 2) return;
    base = spread() || 1;
    live = true;
    onStart();
  };
  const move = (e) => {
    const p = pts.get(e.pointerId);
    if (!p) return;
    p.x = e.clientX;
    p.y = e.clientY;
    if (!live) return;
    e.preventDefault();
    onScale(spread() / base);
  };
  const off = (e) => {
    if (!pts.delete(e.pointerId)) return;
    if (pts.size < 2) finish();
    if (!pts.size) unwatch();
  };
  const watch = () => {
    document.addEventListener("pointerdown", down, true);
    document.addEventListener("pointermove", move, true);
    document.addEventListener("pointerup", off, true);
    document.addEventListener("pointercancel", off, true);
  };
  const unwatch = () => {
    document.removeEventListener("pointerdown", down, true);
    document.removeEventListener("pointermove", move, true);
    document.removeEventListener("pointerup", off, true);
    document.removeEventListener("pointercancel", off, true);
  };

  node.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse" || pts.size) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    watch(); // gắn sau khi ngón đầu đã vào sổ → không đếm trùng chính nó
  });

  // Lăn liên tục là NHIỀU sự kiện: gộp thành một lần chỉnh, chốt khi ngừng lăn
  // 200ms để không ghi model (và báo trang cha) sau từng nấc.
  node.addEventListener(
    "wheel",
    (e) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      if (!live) {
        live = true;
        wheelK = 1;
        onStart();
      }
      wheelK = Math.max(0.05, Math.min(20, wheelK * Math.exp(-e.deltaY / 180)));
      onScale(wheelK);
      clearTimeout(wheelTimer);
      wheelTimer = setTimeout(finish, 200);
    },
    { passive: false },
  );

  return () => live;
}

// ── CUSTOM BLOCKS — khối văn bản người dùng tự thêm, chèn GIỮA CÁC MỤC ─────
// Append cuối DOM (không đổi nth-child của section) rồi định vị bằng flex
// `order`. Lưu ở theme_setting.custom_blocks; edit=1 thì cho sửa/kéo/xoá.
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
  // Mẫu văn bản (preset): nhiều phần chữ chỉnh riêng được trong cùng một khối.
  // parts = danh sách phần tử mang data-cx-part; rỗng ⇒ không phải preset.
  let parts = null;
  if (b.type === "preset") {
    const def = window.CX_TEXT_PRESET_GET && window.CX_TEXT_PRESET_GET(b.preset);
    if (def) {
      body = window.CX_TEXT_PRESET_BUILD(def, b.parts, b.id);
      const found = Array.from(body.querySelectorAll("[data-cx-part]"));
      parts = found.length ? found : null;
    }
  }
  if (parts) {
    // className của preset do CX_TEXT_PRESET_BUILD đặt → chỉ thêm, không ghi đè.
    body.classList.add("cx-cb-body");
  } else if (b.type === "ordered" || b.type === "bullet") {
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
  if (!parts) body.className = "cx-cb-body";
  // id ổn định (giống nhau ở edit/preview/public) → selector "#cb_xxx" dùng cho
  // text_overrides font/cỡ/màu. data-cx-bound: nội dung khối nằm trong model
  // (custom_blocks) nên applyTextOverrides không được ghi đè.
  body.id = b.id;
  body.setAttribute("data-cx-bound", "1");
  if (edit) {
    // Nội dung sửa ở ô "Nội dung" của panel, không sửa trực tiếp trên thiệp.
    // Bấm vào khối = chọn khối + mở bảng chỉnh chi tiết cho chữ trong khối;
    // khối preset thì mở đúng PHẦN vừa bấm (tiêu đề / mô tả…).
    wrap.addEventListener("pointerdown", (e) => {
      if (e.target && e.target.closest && e.target.closest(".cx-cb-tools"))
        return;
      _cxSetActive(b.id);
      let target = body;
      if (parts)
        target =
          (e.target.closest && e.target.closest("[data-cx-part]")) || parts[0];
      if (window.__cxPickBlockBody) window.__cxPickBlockBody(target);
    });
    const tools = document.createElement("div");
    tools.className = "cx-cb-tools";
    // Icon vẽ bằng SVG (glyph ⠿ / × mỗi máy một kiểu, canh giữa không đều).
    // Nút kéo dùng đúng icon grip-vertical như tay nắm ở bảng chọn mẫu.
    tools.innerHTML =
      '<x-button variant="ghost" type="button" title="Kéo để di chuyển" aria-label="Kéo để di chuyển" class="cx-cb-drag">' +
      '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/>' +
      '<circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/>' +
      "</svg></x-button>" +
      '<x-button variant="ghost" type="button" title="Xoá" aria-label="Xoá khối" class="cx-cb-del">' +
      '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>' +
      "</x-button>";
    tools.querySelector(".cx-cb-del").addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      _cxDelete(b.id);
    });
    _cxWireDrag(tools.querySelector(".cx-cb-drag"), b.id);
    wrap.appendChild(tools);
    _cxWireBlockPinch(wrap, body, b.id);
  }
  wrap.appendChild(body);
  return wrap;
}

// Chụm 2 ngón trên khối văn bản = đổi CỠ CHỮ. Cỡ chữ của khối nằm ở
// text_overrides["#<id>"] do trang cha giữ, nên vừa chụm chỉ ghi tạm inline
// (!important để thắng chính rule text_overrides đang áp) rồi báo trang cha lưu
// — applyThemeSetting gỡ bản tạm khi cỡ mới đã vào CSS.
const CX_CB_MIN_SIZE = 8;
const CX_CB_MAX_SIZE = 200;

function _cxWireBlockPinch(wrap, body, id) {
  let base = 16;
  _cxWirePinch(
    wrap,
    () => {
      base = parseFloat(getComputedStyle(body).fontSize) || 16;
    },
    (k) => {
      const px = Math.round(
        _cxDecorClamp(base * k, CX_CB_MIN_SIZE, CX_CB_MAX_SIZE),
      );
      body.style.setProperty("font-size", px + "px", "important");
      body.setAttribute("data-cx-pinch", "1");
    },
    () => {
      const px = parseInt(body.style.fontSize, 10);
      if (!(px > 0)) return;
      try {
        parent.postMessage(
          { type: "cx-text-size", selector: "#" + id, size: px },
          "*",
        );
      } catch (e) {}
    },
  );
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
  // Khối preset: id là "<blockId>__<part>" → tách ra để ghi đúng phần.
  const seg = String(id == null ? "" : id).split("__");
  const b = _cxFind(seg[0]);
  if (!b) return;
  if (b.type === "preset" && seg[1]) {
    b.parts = Object.assign({}, b.parts);
    b.parts[seg[1]] = String(text == null ? "" : text);
    const part = document.getElementById(id);
    if (part) part.textContent = b.parts[seg[1]];
    _cxReport();
    return;
  }
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

// Nhãn cho ô "Nội dung" của bảng chỉnh khi đang sửa một PHẦN của khối preset
// ("Tiêu đề", "Mô tả"…). Rỗng = khối thường, panel dùng nhãn mặc định.
function _cxPartLabel(el) {
  const key = el && el.getAttribute && el.getAttribute("data-cx-part");
  if (!key) return "";
  const b = _cxFind(String(el.id || "").split("__")[0]);
  const def =
    b && window.CX_TEXT_PRESET_GET && window.CX_TEXT_PRESET_GET(b.preset);
  const p = def && def.parts.find((x) => x.key === key);
  return (p && p.label) || "";
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

// type = "paragraph" | "ordered" | "bullet" | "preset:<id mẫu>"
function _cxAddAt(type, anchorEl) {
  const id =
    "cb_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const anchor = anchorEl ? _cxAnchorSelector(anchorEl) : null;
  const preset = /^preset:(.+)$/.exec(String(type == null ? "" : type));
  if (preset) {
    const def =
      window.CX_TEXT_PRESET_GET && window.CX_TEXT_PRESET_GET(preset[1]);
    if (!def) return;
    const parts = {};
    def.parts.forEach((p) => (parts[p.key] = p.def));
    _cxBlocks.push({ id, type: "preset", preset: def.id, parts, afterAnchor: anchor });
  } else {
    const t = type === "ordered" || type === "bullet" ? type : "paragraph";
    const content = t === "paragraph" ? "Văn bản mới" : ["Mục 1", "Mục 2"];
    _cxBlocks.push({ id, type: t, content, afterAnchor: anchor });
  }
  _cxActiveId = id; // khối vừa thêm → hiện sẵn viền + nút
  _cxRender();
  _cxReport();
  // Preset: mở bảng chỉnh cho PHẦN ĐẦU (tiêu đề) để gõ đè ngay.
  const wrap = document.querySelector(
    '.cx-custom-block[data-cb-id="' + id + '"]',
  );
  const body =
    wrap &&
    (wrap.querySelector("[data-cx-part]") || wrap.querySelector(".cx-cb-body"));
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
// Bóng mờ theo con trỏ là bản sao khối đang kéo; nó gắn vào body nên phải copy
// tay font/màu/nền từ khối gốc.
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
  // Style của các mẫu văn bản khai báo ở text-preset-helper.js.
  if (window.CX_TEXT_PRESET_ENSURE_STYLE)
    window.CX_TEXT_PRESET_ENSURE_STYLE(document);
  if (document.getElementById("cx-cb-style")) return;
  const s = document.createElement("style");
  s.id = "cx-cb-style";
  s.textContent =
    ".cx-custom-block{position:relative;width:100%}" +
    ".cx-cb-body{outline:none}" +
    ".cx-custom-block ol,.cx-custom-block ul{display:inline-block;text-align:left;padding-left:1.5em;margin:0}" +
    ".cx-custom-block ol{list-style:decimal}.cx-custom-block ul{list-style:disc}" +
    // Viền nét đứt + 2 nút chỉ hiện khi khối đang được chọn. outline không chiếm
    // chỗ nên không đẩy layout; chỉ chế độ chỉnh mới chừa đệm cho nút kéo.
    // pan-y: giữ cuộn trang bằng 1 ngón, nhưng nhường cử chỉ 2 ngón cho JS
    // (chụm để đổi cỡ chữ) thay vì để trình duyệt zoom cả trang.
    ".cx-cb-edit{padding:12px 0;touch-action:pan-y}" +
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

// ── DECORATIONS — hoa / hoạ tiết thả tự do lên thiệp bằng toạ độ ───────────
// theme_setting.decorations = [{ id, src, x, y, w, rot, behind }]
//   x, y  % so với #main-card, tính theo TÂM ảnh
//   w     % chiều rộng thiệp (cao tự theo tỉ lệ); rot: độ
//   behind  true = nằm sau nội dung thiệp
// Public/preview chỉ vẽ và không bắt chuột; edit=1 thì kéo được, kèm 4 nút
// (xoá, xoay, phóng to, đổi lớp).
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
    // 45: cao hơn nội dung trong thiệp (z-20) nhưng thấp hơn các lớp phủ fixed
    // ngoài thiệp (cover z-50, nhạc z-60, lightbox z-100).
    // -1: sau nội dung thiệp nhưng vẫn trên nền thiệp.
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
    // overflow:clip — xem chú thích ở .cx-el-layer (bộ nút nằm ngoài khung lớp).
    ".cx-decor-layer{position:absolute;inset:0;overflow:hidden;overflow:clip;" +
    "pointer-events:none}" +
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
    // Tâm nút nằm ĐÚNG trên đường kẻ đứt: nửa nút (12px) + outline-offset (4px).
    ".cx-decor-del{top:-16px;left:-16px}" +
    ".cx-decor-copy{top:-16px;left:50%;margin-left:-12px}" +
    ".cx-decor-rot{top:-16px;right:-16px;cursor:grab}" +
    ".cx-decor-size{bottom:-16px;right:-16px;cursor:nwse-resize}" +
    ".cx-decor-back{bottom:-16px;left:-16px}";
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
  _cxNoFocus(b);
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

  // Chụm 2 ngón ngay trên ảnh = phóng to, khỏi phải trúng nút góc.
  let pinchW = d.w;
  const pinching = _cxWirePinch(
    node,
    () => {
      _cxDecorSetActive(d.id);
      pinchW = d.w;
    },
    (k) => {
      d.w = _cxDecorClamp(pinchW * k, CX_DECOR_MIN_W, CX_DECOR_MAX_W);
      _cxDecorApply(node, d);
    },
    () => {
      d.w = Math.round(d.w * 10) / 10;
      _cxDecorReport();
    },
  );

  _cxDecorWireMove(node, d, pinching);
  _cxDecorWireHandle(rot, node, d, "rotate");
  _cxDecorWireHandle(size, node, d, "resize");
  return node;
}

// Kéo cả ảnh → đổi toạ độ tâm (%). Ngón thứ hai chạm vào = đang chụm để phóng
// to, dừng kéo (không thì ảnh vừa to ra vừa chạy theo ngón).
function _cxDecorWireMove(node, d, pinching) {
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
      if (ev.pointerId !== e.pointerId) return;
      if (pinching && pinching()) return;
      d.x = _cxDecorClamp(start.dx + ((ev.clientX - start.x) / r.width) * 100, 0, 100);
      d.y = _cxDecorClamp(start.dy + ((ev.clientY - start.y) / r.height) * 100, 0, 100);
      _cxDecorApply(node, d);
    };
    const up = (ev) => {
      if (ev.pointerId !== e.pointerId) return;
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
 * Nhân đôi hoạ tiết: bản sao lệch chéo một đoạn tính theo cỡ bông (18% bề ngang
 * của nó, tối thiểu 12px) rồi đổi ra % của từng trục.
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

// Thêm mà không kéo (bấm ô mẫu ở bảng chọn) thì đặt ở ĐẦU KHUNG ĐANG XEM, cách
// mép trên 36px. x/y là TÂM khối nên phải cộng nửa chiều cao — chiều cao chỉ
// biết sau khi dựng, do đó đo rồi đặt lại y.
const CX_ADD_TOP_GAP = 36;

function _cxPlaceAtViewTop(item, node, style, report) {
  const card = document.getElementById("main-card");
  if (!card || !node || !item) return;
  // Thiệp còn ẩn (màn bìa chưa mở) thì đo ra 0 — chia cho 0 sẽ kẹp y thành 100%,
  // tức là đẩy khối xuống tận đáy. Người gọi phải đợi thiệp có kích thước.
  if (!card.getBoundingClientRect().height) return;
  const apply = () => {
    const r = card.getBoundingClientRect();
    const y =
      ((CX_ADD_TOP_GAP + node.offsetHeight / 2 - r.top) / r.height) * 100;
    item.y = Math.round(_cxDecorClamp(y, 0, 100) * 10) / 10;
    style(node, item);
  };
  apply();

  // Hoạ tiết là một tấm ảnh: chưa tải xong thì khối còn cao 0, đo lại khi ảnh về.
  // Chỉ nghe khi vừa đo ra 0 — khối có sẵn chiều cao (trình phát nhạc, ảnh bìa
  // tải sau) mà nghe thì lát nữa ảnh về nó lại tự nhảy chỗ theo màn hình mới.
  if (node.offsetHeight > 0) return;
  node.querySelectorAll("img").forEach((img) => {
    if (img.complete) return;
    img.addEventListener(
      "load",
      () => {
        apply();
        report();
      },
      { once: true },
    );
  });
}

/**
 * Thêm 1 hoạ tiết. Toạ độ nhận từ trang cha là px theo viewport iframe, đổi sang
 * % của #main-card; không truyền (bấm ô mẫu) → đặt ở đầu khung đang xem.
 */
function _cxDecorAdd(src, clientX, clientY) {
  const card = document.getElementById("main-card");
  if (!card || !src) return;
  const r = card.getBoundingClientRect();
  const atPoint = clientX != null && clientY != null;
  const x = atPoint
    ? _cxDecorClamp(((clientX - r.left) / r.width) * 100, 0, 100)
    : 50;
  const y = atPoint
    ? _cxDecorClamp(((clientY - r.top) / r.height) * 100, 0, 100)
    : 0; // tạm; _cxPlaceAtViewTop đặt lại sau khi đo được chiều cao

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
  if (!atPoint) {
    const item = _cxDecors[_cxDecors.length - 1];
    _cxPlaceAtViewTop(
      item,
      document.querySelector('.cx-decor[data-decor-id="' + id + '"]'),
      _cxDecorStyle,
      _cxDecorReport,
    );
  }
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

// ── ELEMENTS — "thành phần" thả tự do lên thiệp (hiện có: Trình phát nhạc) ──
// Danh mục + markup từng mẫu ở core/helpers/element-helper.js.
// theme_setting.elements = [{ id, element, variant, x, y, w, opts }]
//   x, y  % so với #main-card, tính theo TÂM widget
//   w     % bề ngang thiệp
//   opts  tuỳ chọn riêng của thành phần (ảnh bìa, màu…) — danh mục khai báo ở
//         element-helper.js, áp bằng def.apply()
// Khác hoạ tiết: trang công khai widget PHẢI bấm được (phát, tua, kéo xem tóm
// tắt); ngược lại chế độ chỉnh khoá hết tương tác bên trong để kéo được widget.
let _cxElements = [];
let _cxElActiveId = null;
let _cxElOutsideBound = false;
let _cxElResizeBound = false;
let _cxMusicSeeded = false; // đã chuyển trình phát của theme thành thành phần chưa
let _cxElCardWatch = null; // ResizeObserver đợi thiệp hiện ra (xem _cxElWatchCardSize)
let _cxElPendingPlace = null; // id thành phần chờ đặt chỗ khi thiệp có kích thước
let _cxElSeedBox = null; // số đo px của trình phát theme, dùng một lần khi dựng

function _cxElDef(t) {
  return (window.CX_ELEMENTS || {})[t && t.element];
}

function _cxElVariant(t) {
  const def = _cxElDef(t);
  if (!def) return null;
  return def.variants.find((v) => v.id === t.variant) || def.variants[0];
}

// Công cụ cần nhạc nền mà thiệp chưa có link → không vẽ trình phát câm.
function _cxElReady(t) {
  const def = _cxElDef(t);
  return !def || def.needs !== "music" || !!window.__cxMusicOn;
}

function _cxElPinned(t) {
  return !!(_cxElDef(t) || {}).pin;
}

// Chiều cao khung nhìn dùng để quy đổi toạ độ của thành phần GHIM.
// Lúc CHỈNH, thanh chỉnh ở đáy cao thấp khác nhau theo từng bảng nên iframe xem
// trước co giãn mỗi lần bấm chọn — bám theo chiều cao thật thì widget nhảy chỗ
// ngay lúc mở bảng. Vì vậy chốt một mốc và dùng lại; chỉ lấy mốc mới khi bề
// NGANG đổi (xoay máy, kéo rộng cột chỉnh) vì bảng chỉnh không làm đổi bề ngang.
// Trang thiệp thật luôn dùng số thật.
let _cxVhRef = 0;
let _cxVhRefW = 0;

function _cxViewH() {
  const doc = document.documentElement;
  const vh = doc.clientHeight || 0;
  if (!_isEditMode()) return vh;
  const vw = doc.clientWidth || 0;
  if (!_cxVhRef || vw !== _cxVhRefW) {
    _cxVhRef = vh;
    _cxVhRefW = vw;
  }
  return _cxVhRef;
}

// Widget GHIM nằm ở lớp riêng gắn thẳng vào <body>, không nằm trong #main-card:
// thiệp có `overflow:hidden` (và theme có thể đặt transform ở tổ tiên) nên để
// trong đó thì `position:fixed` bị cắt hoặc neo sai chỗ.
function _cxElPinLayer() {
  let layer = document.getElementById("cx-el-pin-layer");
  if (!layer || layer.parentElement !== document.body) {
    layer = document.createElement("div");
    layer.id = "cx-el-pin-layer";
    layer.className = "cx-el-pin-layer";
    document.body.appendChild(layer);
  }
  return layer;
}

function _cxElLayer() {
  const card = document.getElementById("main-card");
  if (!card) return null;
  if (getComputedStyle(card).position === "static")
    card.style.position = "relative";
  if (getComputedStyle(card).isolation !== "isolate")
    card.style.isolation = "isolate";
  let layer = document.getElementById("cx-el-layer");
  if (!layer || layer.parentElement !== card) {
    layer = document.createElement("div");
    layer.id = "cx-el-layer";
    layer.className = "cx-el-layer";
    // 46: ngay trên lớp hoa (45) — thành phần là thứ bấm được nên không để hoa đè.
    layer.style.zIndex = "46";
    card.appendChild(layer);
  }
  return layer;
}

function _cxElEnsureStyle() {
  if (document.getElementById("cx-el-style")) return;
  const s = document.createElement("style");
  s.id = "cx-el-style";
  s.textContent =
    // `overflow:clip` (có `hidden` đứng trước làm dự phòng) chứ KHÔNG chỉ `hidden`:
    // hidden vẫn là vùng cuộn được, mà bộ nút .cx-el-h nằm ngoài khung lớp — bấm
    // vào là trình duyệt cuộn lớp để kéo nút vào tầm nhìn, widget bị xê lên.
    ".cx-el-layer{position:absolute;inset:0;overflow:hidden;overflow:clip;" +
    "pointer-events:none}" +
    // Lớp cho widget GHIM: phủ khung nhìn, trong suốt với chuột. z-index 60 =
    // đúng nấc thanh nhạc sẵn có của theme vẫn dùng.
    ".cx-el-pin-layer{position:fixed;inset:0;overflow:hidden;overflow:clip;" +
    "pointer-events:none;z-index:60}" +
    ".cx-el{position:absolute;transform:translate(-50%,-50%);pointer-events:auto}" +
    // Widget TỰ CAO LÊN khi dùng (thanh nhạc vuốt xuống mở khối tóm tắt) phải neo
    // CẠNH TRÊN: neo tâm thì mỗi lần mở là nửa phần cao thêm đội ngược lên trên,
    // thanh nhảy chỗ ngay dưới ngón tay. Neo cạnh trên → y là mép trên, phần mở
    // ra chỉ xuôi xuống dưới. Gắn ở _cxElNode theo việc widget có khối mở rộng
    // hay không, không theo tên mẫu.
    ".cx-el.cx-el-top{transform:translate(-50%,0)}" +
    // Chế độ chỉnh: cả widget là một mảng để kéo, ruột không bấm được.
    ".cx-el-edit{cursor:grab;touch-action:none}" +
    ".cx-el-edit>*{pointer-events:none}" +
    ".cx-el-edit.cx-el-active{outline:1px dashed #e11d48;outline-offset:6px}" +
    // Nháy 2 nhịp khi vừa chọn từ bảng — widget ghim không cuộn nên đây là dấu
    // hiệu duy nhất cho biết "cái vừa chọn là cái này".
    // drop-shadow (không phải box-shadow) để quầng sáng ôm đúng hình widget:
    // thanh nhạc bo tròn, nút tròn… đều không phải hình chữ nhật.
    ".cx-el-flash{animation:cx-el-flash .5s ease-out 2}" +
    "@keyframes cx-el-flash{from{filter:drop-shadow(0 0 2px rgba(225,29,72,.95))}" +
    "to{filter:drop-shadow(0 0 14px rgba(225,29,72,0))}}" +
    // Chưa có nhạc nền (chỉ gặp lúc chỉnh): vẫn là widget thật, chỉ khác nền
    // mặc định trắng mờ — người dùng chọn màu nền rồi thì nhường (.cx-tint-bg).
    ".cx-el-empty:not(.cx-tint-bg){--cx-mw-bg:rgba(255,255,255,.4)}" +
    ".cx-el-empty:not(.cx-tint-bg) .cx-mp-bar{background-image:none;" +
    "background-color:rgba(255,255,255,.4)}" +
    // Bộ nút giống hoạ tiết cho quen tay
    ".cx-el-h{position:absolute;width:24px;height:24px;border-radius:9999px;" +
    "background:#fff;border:1px solid #e11d48;color:#e11d48;display:none;" +
    "align-items:center;justify-content:center;padding:0;cursor:pointer;" +
    "box-shadow:0 2px 6px rgba(0,0,0,.18);touch-action:none;z-index:1;pointer-events:auto}" +
    ".cx-el-active .cx-el-h{display:flex}" +
    // Tâm nút nằm ĐÚNG trên đường kẻ đứt: nửa nút (12px) + outline-offset (6px).
    ".cx-el-del{top:-18px;left:-18px}" +
    ".cx-el-skin{top:-18px;left:50%;margin-left:-12px}" +
    ".cx-el-size{bottom:-18px;right:-18px;cursor:nwse-resize}";
  document.head.appendChild(s);
}

// Vị trí + bề ngang + CỠ CHỮ. Cỡ chữ tính từ bề ngang thật của widget (hệ số
// `fs` của từng mẫu) vì ruột widget viết bằng `em` — nhờ vậy kéo to nhỏ là phóng
// cả widget theo tỉ lệ, không phải widget to mà chữ vẫn bé như cũ.
function _cxElStyle(node, t) {
  const v = _cxElVariant(t);
  const card = document.getElementById("main-card");
  const r = card ? card.getBoundingClientRect() : null;
  const cw = r ? r.width : 0;

  if (_cxElPinned(t) && cw) {
    // Lớp ghim phủ cả khung nhìn nên % ở đây sẽ ăn theo khung nhìn — phải quy ra
    // px để bề ngang và trục X vẫn bám theo khổ THIỆP; trục Y mới theo khung nhìn.
    node.style.left = r.left + (cw * t.x) / 100 + "px";
    node.style.top = (_cxViewH() * t.y) / 100 + "px";
    node.style.width = (cw * t.w) / 100 + "px";
  } else {
    node.style.left = t.x + "%";
    node.style.top = t.y + "%";
    node.style.width = t.w + "%";
  }
  if (cw && v && v.fs) {
    node.style.fontSize =
      Math.max(7, Math.round(((cw * t.w) / 100) * v.fs * 10) / 10) + "px";
  }
}

let _cxElReportTimer = null;
function _cxElReport() {
  clearTimeout(_cxElReportTimer);
  _cxElReportTimer = setTimeout(() => {
    try {
      parent.postMessage(
        {
          type: "cx-elements-changed",
          elements: _cxElements,
          seeded: _cxMusicSeeded,
        },
        "*",
      );
    } catch (e) {}
  }, 200);
}

// Chọn widget nào thì bảng bên trái mở đúng phần điều chỉnh của nó (giống khối
// văn bản); bỏ chọn thì đóng bảng.
function _cxElSetActive(id) {
  _cxElActiveId = id || null;
  document.querySelectorAll(".cx-el").forEach((n) => {
    n.classList.toggle(
      "cx-el-active",
      n.getAttribute("data-el-id") === _cxElActiveId,
    );
  });
  _cxElRaiseActive();
  _cxElSendPick();
}

// Chrome của trình chỉnh (đường thả, bóng kéo, nút xoá…) chạy ở thang 2^31 và
// phải luôn nằm trên widget → bỏ qua khi tìm z-index lớn nhất.
const CX_Z_CHROME = 1000000;

// z-index lớn nhất đang có trong trang + 1.
function _cxTopZ() {
  let max = 0;
  document.querySelectorAll("*").forEach((n) => {
    const z = parseInt(getComputedStyle(n).zIndex, 10);
    if (!isNaN(z) && z > max && z < CX_Z_CHROME) max = z;
  });
  return max + 1;
}

// Widget đang chọn phải đè lên mọi thứ, kể cả widget thêm sau. Phải nâng CẢ LỚP
// chứa nó: mỗi lớp là một stacking context riêng nên z-index của widget không
// vượt ra ngoài lớp được. Xoá hết giá trị cũ trước khi đo, nếu không mỗi lần
// chọn lại cộng dồn một nấc.
function _cxElRaiseActive() {
  document.querySelectorAll(".cx-el").forEach((n) => (n.style.zIndex = ""));
  const layer = document.getElementById("cx-el-layer");
  const pin = document.getElementById("cx-el-pin-layer");
  if (layer) layer.style.zIndex = "46";
  if (pin) pin.style.zIndex = "";
  if (!_cxElActiveId) return;

  const node = document.querySelector(
    '.cx-el[data-el-id="' + _cxElActiveId + '"]',
  );
  if (!node) return;
  const z = _cxTopZ();
  node.style.zIndex = z;
  if (node.parentElement) node.parentElement.style.zIndex = z;
}

// Đưa widget vừa chọn ở bảng vào tầm nhìn rồi nháy viền cho mắt bắt được nó.
// Widget ghim nổi theo màn hình nên không cuộn đi đâu — thiếu nháy viền thì thao
// tác "chọn xong" trông như không có gì xảy ra.
function _cxElFocus(id) {
  const t = _cxElFind(id);
  if (!t) return;
  const node = document.querySelector('.cx-el[data-el-id="' + id + '"]');
  if (!node) return;

  if (!_cxElPinned(t)) {
    const r = node.getBoundingClientRect();
    const vh = _cxViewH() || window.innerHeight;
    // Đang thấy trọn thì để yên cho khỏi giật màn hình.
    if (r.top < 0 || r.bottom > vh)
      node.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  node.classList.remove("cx-el-flash");
  void node.offsetWidth; // ép chạy lại animation khi chọn liên tiếp
  node.classList.add("cx-el-flash");
  clearTimeout(_cxElFlashTimer);
  _cxElFlashTimer = setTimeout(
    () => node.classList.remove("cx-el-flash"),
    1000,
  );
}
let _cxElFlashTimer = null;

function _cxElSendPick() {
  if (typeof window === "undefined" || window.top === window) return;
  const t = _cxElActiveId && _cxElFind(_cxElActiveId);
  // Dò màu TRƯỚC và tách khỏi postMessage: nó đọc DOM của widget nên có thể vấp,
  // mà vấp trong lời gọi postMessage là mất luôn tin "đã chọn" → bảng không mở.
  const msg = t
    ? {
        type: "cx-element-pick",
        id: t.id,
        element: t.element,
        variant: t.variant,
        w: t.w,
        opts: t.opts || {},
        base: _cxElBaseColors(t),
      }
    : { type: "cx-element-close" };
  try {
    parent.postMessage(msg, "*");
  } catch (e) {}
}

// Trang cha hỏi lại "đang chọn cái nào" khi bảng điều chỉnh không mở sau lúc thả
// (tin nhắn pick bị nhỡ). Chưa chọn gì thì chọn luôn thành phần cùng loại.
function _cxElRepick(elementId) {
  if (!_cxElActiveId && elementId) {
    const t = _cxElements.find((x) => x.element === elementId);
    if (t) {
      _cxElSetActive(t.id); // đã gửi pick bên trong
      return;
    }
  }
  _cxElSendPick();
}

// Màu ĐANG hiện của widget trên thiệp (mỗi theme một bộ màu) — bảng lấy làm giá
// trị khởi điểm cho ô màu người dùng chưa chỉnh, thay vì `def` cứng.
function _cxElBaseColors(t) {
  const def = _cxElDef(t);
  const body = document.querySelector('.cx-el[data-el-id="' + t.id + '"]')
    ?._cxBody;
  if (!def || !body) return {};
  // Chỉ dò ô màu mà MẪU đang dùng — mẫu khác có thể không có bề mặt để đo.
  const only = (_cxElVariant(t) || {}).colors;
  const out = {};
  (def.options || []).forEach((o) => {
    if (o.type !== "color" || typeof o.from !== "function") return;
    if (only && !only.includes(o.id)) return;
    // Một ô dò hụt chỉ mất giá trị khởi điểm của ô đó, không được kéo đổ cả
    // luồng "chọn xong → mở bảng điều chỉnh".
    let v = null;
    try {
      v = o.from(body);
    } catch (e) {}
    if (v) out[o.id] = v;
  });
  return out;
}

function _cxElBindOutside() {
  if (_cxElOutsideBound) return;
  _cxElOutsideBound = true;
  document.addEventListener("pointerdown", (e) => {
    const t = e.target;
    if (t && t.closest && t.closest(".cx-el")) return;
    if (_cxElActiveId) _cxElSetActive(null);
  });
}

function _cxElButton(cls, title, icon) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "cx-el-h " + cls;
  b.title = title;
  b.setAttribute("aria-label", title);
  b.innerHTML = icon;
  _cxNoFocus(b);
  return b;
}

// Nút công cụ không nhận focus: nó nằm ngoài khung lớp phủ nên trình duyệt cũ
// (chưa có overflow:clip) sẽ cuộn lớp để kéo nó vào tầm nhìn, làm khối xê chỗ.
// preventDefault ở pointerdown chỉ chặn focus, `click` vẫn bắn bình thường.
function _cxNoFocus(btn) {
  btn.addEventListener("pointerdown", (e) => e.preventDefault());
}

function _cxElBody(t) {
  const def = _cxElDef(t);
  const v = _cxElVariant(t);
  if (!def || !v) return null;
  const body = def.build(v.id);
  if (def.apply) def.apply(body, t.opts || {});
  // Chưa có nhạc nền: vẫn dựng widget thật để thấy trước đúng bố cục, chỉ đổi
  // chữ thành lời nhắc và (nếu chưa chọn màu nền) để nền trắng mờ.
  if (!_cxElReady(t)) _cxElMarkEmpty(body);
  return body;
}

function _cxElMarkEmpty(body) {
  body.classList.add("cx-el-empty");
  body.querySelectorAll('[data-cx-music="title"]').forEach((el) => {
    el.textContent = "Chưa có nhạc nền";
  });
  body.querySelectorAll('[data-cx-music="artist"]').forEach((el) => {
    el.textContent = "Chọn bài ở tab Thiết lập";
  });
}

function _cxElNode(t, edit) {
  const node = document.createElement("div");
  node.className = "cx-el" + (edit ? " cx-el-edit" : "");
  node.setAttribute("data-el-id", t.id);
  if (edit && t.id === _cxElActiveId) node.classList.add("cx-el-active");
  _cxElStyle(node, t);

  const body = _cxElBody(t);
  if (!body) return null;
  node.appendChild(body);
  node._cxBody = body;

  // Có khối mở rộng (thanh nhạc kéo xuống) → neo cạnh trên thay vì tâm. Dò theo
  // MARKUP chứ không theo id mẫu: mẫu nào sau này có khối mở rộng cũng tự đúng.
  if (body.querySelector('[data-cx-music="panel"]')) {
    node.classList.add("cx-el-top");
  }

  if (!edit) return node;

  const del = _cxElButton("cx-el-del", "Xoá", _CX_DECOR_ICONS.del);
  del.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    _cxElDelete(t.id);
  });
  // Đổi mẫu ngay trên thiệp: bấm là xoay vòng qua các mẫu của thành phần. Bảng
  // Công cụ bên trái vẫn chọn thẳng được từng mẫu.
  const def = _cxElDef(t);
  const skin = _cxElButton(
    "cx-el-skin",
    "Đổi mẫu (" + (_cxElVariant(t) || {}).name + ")",
    _CX_DECOR_ICONS.rot,
  );
  skin.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    const list = def.variants;
    const i = list.findIndex((v) => v.id === t.variant);
    _cxElSet(t.id, { variant: list[(i + 1) % list.length].id });
  });
  const size = _cxElButton(
    "cx-el-size",
    "Kéo để phóng to",
    _CX_DECOR_ICONS.size,
  );
  node.append(del, skin, size);

  // Chụm 2 ngón ngay trong lòng widget = phóng to, khỏi phải trúng nút góc.
  let pinchW = t.w;
  const pinching = _cxWirePinch(
    node,
    () => {
      _cxElSetActive(t.id);
      pinchW = t.w;
    },
    (k) => {
      const v = _cxElVariant(t) || {};
      t.w = _cxDecorClamp(pinchW * k, v.minW || 8, v.maxW || 100);
      _cxElStyle(node, t); // đổi cả cỡ chữ bên trong theo bề ngang mới
    },
    () => {
      t.w = Math.round(t.w * 10) / 10;
      _cxElReport();
    },
  );

  _cxElWireMove(node, t, pinching);
  _cxElWireResize(size, node, t);
  return node;
}

// Kéo cả widget → đổi toạ độ tâm (%). Giống hệt hoạ tiết: ngón thứ hai chạm vào
// là đang chụm để phóng to nên phải dừng kéo.
function _cxElWireMove(node, t, pinching) {
  node.addEventListener("pointerdown", (e) => {
    if (e.target.closest(".cx-el-h")) return;
    _cxElSetActive(t.id);
    const card = document.getElementById("main-card");
    if (!card) return;
    const r = card.getBoundingClientRect();
    // Widget ghim: trục Y đo theo KHUNG NHÌN chứ không theo chiều cao thiệp.
    const hRef = _cxElPinned(t) ? _cxViewH() || r.height : r.height;
    const start = { x: e.clientX, y: e.clientY, dx: t.x, dy: t.y };
    e.preventDefault();
    try {
      node.setPointerCapture(e.pointerId);
    } catch (err) {}
    node.style.cursor = "grabbing";

    const move = (ev) => {
      if (ev.pointerId !== e.pointerId) return;
      if (pinching && pinching()) return;
      t.x = _cxDecorClamp(
        start.dx + ((ev.clientX - start.x) / r.width) * 100,
        0,
        100,
      );
      t.y = _cxDecorClamp(
        start.dy + ((ev.clientY - start.y) / hRef) * 100,
        0,
        100,
      );
      _cxElStyle(node, t);
    };
    const up = (ev) => {
      if (ev.pointerId !== e.pointerId) return;
      node.removeEventListener("pointermove", move);
      node.removeEventListener("pointerup", up);
      node.removeEventListener("pointercancel", up);
      node.style.cursor = "";
      t.x = Math.round(t.x * 10) / 10;
      t.y = Math.round(t.y * 10) / 10;
      _cxElReport();
    };
    node.addEventListener("pointermove", move);
    node.addEventListener("pointerup", up);
    node.addEventListener("pointercancel", up);
  });
}

// Phóng to: chỉ đổi bề ngang (không xoay — widget có chữ, nghiêng là không đọc
// được). Kẹp trong khoảng min/max của TỪNG MẪU: nút tròn 34% đã là to, còn
// thanh ngang dưới 45% thì chữ và ba nút chen nhau.
function _cxElWireResize(btn, node, t) {
  btn.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    e.stopPropagation();
    _cxElSetActive(t.id);
    const v = _cxElVariant(t) || {};
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
      _cxElStyle(node, t);
    };
    const up = () => {
      btn.removeEventListener("pointermove", move);
      btn.removeEventListener("pointerup", up);
      btn.removeEventListener("pointercancel", up);
      t.w = Math.round(t.w * 10) / 10;
      _cxElReport();
    };
    btn.addEventListener("pointermove", move);
    btn.addEventListener("pointerup", up);
    btn.addEventListener("pointercancel", up);
  });
}

function _cxElRender() {
  if (!document.getElementById("main-card")) return;
  _cxElEnsureStyle();
  const edit = _isEditMode();
  if (edit) _cxElBindOutside();

  const layer = _cxElLayer();
  if (!layer) return;
  layer.innerHTML = "";
  const pinLayer = _cxElPinLayer();
  pinLayer.innerHTML = "";

  // Trình phát SẴN CÓ của theme nhường chỗ khi thiệp đã có thành phần nhạc —
  // và nhường LUÔN sau khi nó đã được dựng thành thành phần (_cxMusicSeeded),
  // nếu không thì xoá thành phần đi nó lại mọc về, thành ra xoá không được.
  const themePlayer = document.getElementById("music-toggle");
  if (themePlayer) {
    const off = _cxMusicSeeded || _cxElements.some((t) => t.element === "music");
    if (off) {
      themePlayer.dataset.cxElHidden = "1";
      themePlayer.style.display = "none";
    } else if (themePlayer.dataset.cxElHidden) {
      delete themePlayer.dataset.cxElHidden;
      themePlayer.style.display = window.__cxMusicOn ? "flex" : "none";
    }
  }

  _cxElements.forEach((t) => {
    // Chưa có nhạc → trang công khai không vẽ gì; lúc chỉnh vẫn vẽ ô nhắc.
    if (!edit && !_cxElReady(t)) return;
    const node = _cxElNode(t, edit);
    if (!node) return;
    (_cxElPinned(t) ? pinLayer : layer).appendChild(node);
    // Gắn logic trình phát SAU khi đã vào DOM (helper đo khung để chạy chữ).
    // Chế độ chỉnh thì không gắn: ruột widget đã bị khoá chuột, gắn vào chỉ tổ
    // bật nhạc ngoài ý muốn khi bấm chọn.
    if (edit || !_cxElReady(t)) return;
    if (window.replayMusicSummary) window.replayMusicSummary(node._cxBody);
    if (window.setupMusicPlayer) window.setupMusicPlayer(node._cxBody);
  });

  _cxElWatchCardSize();
  _cxElRaiseActive(); // dựng lại node là mất z-index inline → đặt lại

  // Đổi khổ màn hình → bề ngang thiệp đổi → phải tính lại cỡ chữ theo px.
  if (!_cxElResizeBound) {
    _cxElResizeBound = true;
    let raf = 0;
    window.addEventListener("resize", () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        document.querySelectorAll(".cx-el").forEach((n) => {
          const t = _cxElements.find(
            (x) => x.id === n.getAttribute("data-el-id"),
          );
          if (t) _cxElStyle(n, t);
        });
      });
    });
  }
}

// Theme mở bằng màn bìa (basic-gold) để #main-card `display:none` cho tới khi
// khách bấm mở → lúc render thiệp còn đo ra 0, cỡ chữ (tính theo bề ngang thật)
// và toạ độ đều sai. `resize` của window không bắt được lần hiện ra này, phải
// theo dõi chính thẻ thiệp rồi tính lại một lượt.
function _cxElWatchCardSize() {
  const card = document.getElementById("main-card");
  if (!card || _cxElCardWatch || typeof ResizeObserver === "undefined") return;
  if (card.getBoundingClientRect().height) return;

  _cxElCardWatch = new ResizeObserver(() => {
    if (!card.getBoundingClientRect().height) return;
    _cxElCardWatch.disconnect();
    _cxElCardWatch = null;
    document.querySelectorAll(".cx-el").forEach((n) => {
      const t = _cxElFind(n.getAttribute("data-el-id"));
      if (t) _cxElStyle(n, t);
    });
    const pending = _cxElPendingPlace && _cxElFind(_cxElPendingPlace);
    _cxElPendingPlace = null;
    if (pending) _cxElAdoptThemeBox(pending);
  });
  _cxElCardWatch.observe(card);
}

function _cxElFind(id) {
  return _cxElements.find((t) => t.id === id);
}

function _cxElDelete(id) {
  _cxElements = _cxElements.filter((t) => t.id !== id);
  _cxElRender();
  if (_cxElActiveId === id) _cxElSetActive(null);
  _cxElReport();
}

// Đổi mẫu / bề ngang / tuỳ chọn riêng từ bảng bên trái. Đổi mẫu thì trả bề ngang
// về mặc định của mẫu mới — thanh ngang 88% mà giữ nguyên khi sang nút tròn thì
// ra một nút to bằng nửa thiệp.
function _cxElSet(id, patch) {
  const t = _cxElFind(id);
  if (!t || !patch) return;
  if (patch.variant && patch.variant !== t.variant) {
    const def = _cxElDef(t);
    const v = def && def.variants.find((x) => x.id === patch.variant);
    if (v) {
      t.variant = v.id;
      t.w = v.w;
    }
  }
  _cxElActiveId = t.id;
  _cxElRender();
  _cxElFocus(t.id);
  _cxElSendPick(); // bảng lấy lại giá trị thật (đổi mẫu là bề ngang cũng đổi)
  _cxElReport();
}

// Thanh trượt kích thước / ô màu ở bảng: sửa TẠI CHỖ, không dựng lại widget —
// dựng lại giữa chừng là ngắt nhạc đang phát, và cũng không báo pick ngược lại
// (bảng đang giữ con trỏ trên control). `done` = nhả tay → chốt & lưu.
function _cxElResize(id, w, done) {
  const t = _cxElFind(id);
  if (!t) return;
  const v = _cxElVariant(t) || {};
  t.w = _cxDecorClamp(Number(w) || t.w, v.minW || 8, v.maxW || 100);
  const node = document.querySelector('.cx-el[data-el-id="' + t.id + '"]');
  if (node) _cxElStyle(node, t);
  if (!done) return;
  t.w = Math.round(t.w * 10) / 10;
  _cxElReport();
}

function _cxElSetOpts(id, opts, replace, done) {
  const t = _cxElFind(id);
  if (!t) return;
  t.opts = replace ? opts || {} : Object.assign({}, t.opts, opts);
  const def = _cxElDef(t);
  const node = document.querySelector('.cx-el[data-el-id="' + t.id + '"]');
  if (node && node._cxBody && def && def.apply) def.apply(node._cxBody, t.opts);
  // Bấm "Mặc định" = gỡ hết màu người dùng đặt → báo lại màu gốc để ô chọn màu
  // mở đúng màu widget vừa trở về.
  if (replace) _cxElSendPick();
  if (done) _cxElReport();
}

/**
 * Thả một thành phần. Toạ độ nhận từ trang cha là px theo viewport iframe, đổi
 * sang % của #main-card; không truyền (bấm ô mẫu) → đặt ở đầu khung đang xem.
 * Thành phần `single` đã có sẵn thì chỉ dời tới chỗ đó, không thêm cái thứ hai.
 */
function _cxElAdd(elementId, clientX, clientY, variantId) {
  const def = (window.CX_ELEMENTS || {})[elementId];
  const card = document.getElementById("main-card");
  if (!def || !card) return;
  const variant =
    def.variants.find((v) => v.id === variantId) || def.variants[0];
  const r = card.getBoundingClientRect();
  const atPoint = clientX != null && clientY != null;
  // BẤM ô mẫu mà thiệp đã có thành phần này: các mẫu là MỘT NHÓM, thiệp chỉ giữ
  // một cái — nên bấm mẫu KHÁC là đổi sang mẫu đó và giữ nguyên chỗ đứng, bấm
  // đúng mẫu đang dùng thì chỉ chọn nó lên để chỉnh.
  // KÉO THẢ thì vẫn đặt lại đúng chỗ vừa thả (nhánh `exist` bên dưới).
  const cur = def.single && _cxElements.find((t) => t.element === elementId);
  if (cur && !atPoint) {
    if (variantId && cur.variant !== variant.id)
      _cxElSet(cur.id, { variant: variant.id });
    else {
      _cxElSetActive(cur.id);
      _cxElFocus(cur.id);
    }
    return;
  }

  const x = atPoint
    ? _cxDecorClamp(((clientX - r.left) / r.width) * 100, 0, 100)
    : 50;
  // Widget ghim: trục Y là % KHUNG NHÌN (nó nổi theo màn hình, không theo thiệp).
  const vh = _cxViewH() || r.height;
  const y = !atPoint
    ? 0 // tạm; _cxElPlaceNow đặt lại sau khi đo được chiều cao widget
    : def.pin
      ? _cxDecorClamp((clientY / vh) * 100, 0, 100)
      : _cxDecorClamp(((clientY - r.top) / r.height) * 100, 0, 100);

  const exist = def.single && _cxElements.find((t) => t.element === elementId);
  if (exist) {
    exist.x = Math.round(x * 10) / 10;
    exist.y = Math.round(y * 10) / 10;
    // Thả ô mẫu KHÁC lên thành phần đã có = đổi mẫu; bề ngang lấy lại theo mẫu mới
    // vì mỗi mẫu một khoảng min/max riêng (thanh ngang 88% vs nút tròn 16%).
    if (variantId && exist.variant !== variant.id) {
      exist.variant = variant.id;
      exist.w = variant.w;
    }
    _cxElActiveId = exist.id;
  } else {
    const v = variant;
    const id =
      "el_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    _cxElements.push({
      id,
      element: elementId,
      variant: v.id,
      x: Math.round(x * 10) / 10,
      y: Math.round(y * 10) / 10,
      w: v.w,
      opts: {},
    });
    _cxElActiveId = id;
  }
  _cxElRender();
  _cxElSendPick(); // thả xong → bảng chuyển sang phần điều chỉnh của nó
  if (!atPoint) {
    const item = _cxElements.find((t) => t.id === _cxElActiveId);
    if (item) _cxElPlaceNow(item);
  }
  _cxElFocus(_cxElActiveId); // thả/bấm xong → thấy ngay thành phần vừa đặt
  _cxElReport();
}

// Render từ theme_setting (public + preview + edit).
function applyElements(setting) {
  if (!document.getElementById("main-card")) return;
  if (typeof setting === "string") {
    try {
      setting = JSON.parse(setting);
    } catch (e) {
      setting = null;
    }
  }
  _cxMusicSeeded = !!(setting && setting.music_seeded);

  const arr = setting && Array.isArray(setting.elements) ? setting.elements : [];
  const reg = window.CX_ELEMENTS || {};
  _cxElements = arr
    .filter((t) => t && reg[t.element])
    .map((t) => {
      const def = reg[t.element];
      const v = def.variants.find((x) => x.id === t.variant) || def.variants[0];
      return {
        id: t.id || "el_" + Math.random().toString(36).slice(2, 8),
        element: t.element,
        variant: v.id,
        x: _cxDecorClamp(Number(t.x) || 0, 0, 100),
        y: _cxDecorClamp(Number(t.y) || 0, 0, 100),
        w: _cxDecorClamp(Number(t.w) || v.w, v.minW, v.maxW),
        opts: t.opts && typeof t.opts === "object" ? t.opts : {},
      };
    });
  const seeded = _cxElSeedThemeMusic();
  _cxElRender();
  if (seeded) _cxElPlaceSeeded(seeded);
}

// Trình phát sẵn có của theme KHÔNG phải thứ đặc biệt: lần đầu mở trình chỉnh
// thì chuyển nó thành một mục trong `elements`, từ đó kéo / phóng to / đổi mẫu /
// đổi màu / xoá y hệt widget kéo từ bảng ra (và trang thiệp cũng vẽ bằng đúng
// một đường). `music_seeded` giữ lời hứa "xoá là mất": đã dựng một lần thì thôi.
function _cxElSeedThemeMusic() {
  if (!_isEditMode() || _cxMusicSeeded) return null;
  const def = (window.CX_ELEMENTS || {}).music;
  const player = document.getElementById("music-toggle");
  if (!def || !player || !document.getElementById("main-card")) return null;
  if (_cxElements.some((t) => t.element === "music")) return null;

  // Mẫu gần với trình phát của theme nhất: theme nào dùng thanh ngang thì lấy
  // thanh, còn lại (nút tròn góc màn) lấy nút tròn.
  const wantBar = !!player.querySelector(".cx-mp-bar");
  const v =
    def.variants.find((x) => x.id === (wantBar ? "bar" : "mini")) ||
    def.variants[0];
  _cxMusicSeeded = true;
  const t = {
    id: "el_music_" + Math.random().toString(36).slice(2, 8),
    element: "music",
    variant: v.id,
    x: 50,
    y: 0, // cùng w: đặt lại theo số đo bản gốc, xem _cxElAdoptThemeBox
    w: v.w,
    opts: {},
  };
  // Giữ ngoài object: mọi thứ trong _cxElements đều được gửi lên trang cha để lưu.
  _cxElSeedBox = _cxElMeasureThemePlayer(player);
  _cxElements.push(t);
  return t;
}

// Số đo THẬT của trình phát theme (px): bề ngang và tâm dọc. Phải đo ngay lúc
// này vì render xong là nó bị ẩn đi. Thẻ neo theo khung nhìn nên đo được kể cả
// khi thiệp còn chưa hiện; đang bị `display:none` (thiệp chưa có nhạc) thì mở
// tạm ra để lấy kích thước.
function _cxElMeasureThemePlayer(player) {
  const bar = player.querySelector(".cx-mp-bar") || player;
  const prev = player.style.display;
  if (getComputedStyle(player).display === "none") player.style.display = "flex";
  const r = bar.getBoundingClientRect();
  player.style.display = prev;
  return r.width && r.height
    ? { w: r.width, cx: r.left + r.width / 2, cy: r.top + r.height / 2 }
    : null;
}

// Đặt vào đầu thiệp đúng chỗ trình phát của theme vẫn đứng — phải đợi render
// xong mới đo được chiều cao widget.
function _cxElPlaceSeeded(t) {
  const card = document.getElementById("main-card");
  if (!card) return;
  // Thiệp chưa hiện thì hoãn, _cxElWatchCardSize() sẽ đặt hộ.
  if (!card.getBoundingClientRect().height) {
    _cxElPendingPlace = t.id;
    return;
  }
  _cxElAdoptThemeBox(t);
}

// Dựng đúng DÁNG bản gốc: bề ngang quy ra % khổ thiệp, tâm dọc quy ra % khung
// nhìn — không thì widget hẹp hơn hẳn thanh gốc (mẫu mặc định chỉ 88%).
// Không đo được thì rơi về chỗ mặc định như thành phần thả bằng tay.
function _cxElAdoptThemeBox(t) {
  const box = _cxElSeedBox;
  _cxElSeedBox = null;
  const node = document.querySelector('.cx-el[data-el-id="' + t.id + '"]');
  const card = document.getElementById("main-card");
  const r = card ? card.getBoundingClientRect() : null;
  const vh = _cxViewH();
  if (!node || !box || !r || !r.width || !vh) return _cxElPlaceNow(t);

  const v = _cxElVariant(t) || {};
  const pc = (n) => Math.round(_cxDecorClamp(n, 0, 100) * 10) / 10;
  t.w =
    Math.round(
      _cxDecorClamp((box.w / r.width) * 100, v.minW || 8, v.maxW || 100) * 10,
    ) / 10;
  // Thanh gốc neo theo khung nhìn, khung xem trước lại rộng hơn thiệp → kẹp vào
  // trong khổ thiệp (nút tròn góc phải vì thế bám mép phải thiệp, không dạt ra).
  t.x = pc(((box.cx - r.left) / r.width) * 100);
  t.y = pc((box.cy / vh) * 100);
  _cxElStyle(node, t);
}

// Đặt vào đầu khung đang xem. Widget ghim đo theo KHUNG NHÌN (nó nổi trên màn
// hình), thành phần thường đo theo thiệp như hoạ tiết.
function _cxElPlaceNow(t) {
  const node = document.querySelector('.cx-el[data-el-id="' + t.id + '"]');
  if (!node) return;
  if (!_cxElPinned(t)) {
    _cxPlaceAtViewTop(t, node, _cxElStyle, _cxElReport);
    return;
  }
  const vh = _cxViewH();
  if (!vh) return;
  const y = ((CX_ADD_TOP_GAP + node.offsetHeight / 2) / vh) * 100;
  t.y = Math.round(_cxDecorClamp(y, 0, 100) * 10) / 10;
  _cxElStyle(node, t);
}

// Bỏ chọn theo lệnh của trang cha. what="all" mới bỏ chọn cả thành phần (kéo
// theo đóng bảng điều chỉnh của nó), mặc định chỉ bỏ chọn hoạ tiết.
function _cxBlurCards(what) {
  if (_cxDecorActiveId) _cxDecorSetActive(null);
  if (what === "all" && _cxElActiveId) _cxElSetActive(null);
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
    // Thành phần: thả từ bảng chọn, và đổi mẫu / kích thước / tuỳ chọn / xoá từ
    // bảng điều chỉnh
    else if (d.type === "cx-add-element")
      _cxElAdd(d.element, d.x, d.y, d.variant);
    else if (d.type === "cx-element-repick") _cxElRepick(d.element);
    else if (d.type === "cx-element-set") _cxElSet(d.id, d.patch);
    else if (d.type === "cx-element-size") _cxElResize(d.id, d.w, d.done);
    else if (d.type === "cx-element-opts")
      _cxElSetOpts(d.id, d.opts, d.replace, d.done);
    else if (d.type === "cx-element-del") _cxElDelete(d.id);
    // Trang cha bấm ra ngoài iframe → bỏ chọn cho bộ nút trên hoa/widget tắt đi
    else if (d.type === "cx-blur") _cxBlurCards(d.what);
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

/** Áp dụng theme_setting (font + màu chung) lên trang hiện tại. */
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

  // Bộ màu đứng ĐẦU: nó chỉ đổi token, còn các rule dưới đây đổi thẳng
  // color/background-color kèm !important nên luôn thắng — chọn bộ trước, chỉnh
  // tay từng ô sau.
  const paletteRule = _cxPaletteRule(setting.palette);
  if (paletteRule) rules.push(paletteRule);

  if (setting.heading_font) {
    _loadGoogleFont(setting.heading_font);
    rules.push(
      `${_cxSel("headingFont")} { font-family: '${setting.heading_font}', serif !important; }`,
    );
  }

  if (setting.body_font) {
    _loadGoogleFont(setting.body_font);
    rules.push(
      `${_cxSel("bodyFont")} { font-family: '${setting.body_font}', sans-serif !important; }`,
    );
  }

  if (setting.heading_color) {
    rules.push(
      `${_cxSel("headingColor")} { color: ${setting.heading_color} !important; }`,
    );
  }

  if (setting.body_color) {
    rules.push(
      `${_cxSel("bodyColor")} { color: ${setting.body_color} !important; }`,
    );
  }

  if (setting.accent_color) {
    rules.push(
      `${_cxSel("accentColor")} { color: ${setting.accent_color} !important; }`,
    );
  }

  if (setting.background_color) {
    rules.push(
      `${_cxSel("background")} { background-color: ${setting.background_color} !important; }`,
    );
  }

  // ── Ghi đè chi tiết TỪNG DÒNG chữ ─────────────────────────────────────────
  // setting.text_overrides = { "<selector>": { font, size, color, weight, italic, align } }
  // Selector nth-child nên ưu tiên cao hơn rule class chung ở trên.
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
      // -webkit-text-fill-color đi kèm: chữ gradient (mẫu văn bản) tô bằng thuộc
      // tính đó, chỉ đặt `color` thì màu người dùng chọn không ăn thua.
      if (_cxSafeColor(o.color))
        decls.push(
          `color: ${o.color.trim()} !important`,
          `-webkit-text-fill-color: ${o.color.trim()} !important`,
        );
      if (_cxSafeNum(o.weight))
        decls.push(`font-weight: ${Number(o.weight)} !important`);
      // Chuyển màu: tô nền gradient rồi xén theo hình chữ. Phải đứng SAU `color`
      // để thắng nó. inline-block cho khung nền ôm sát chữ — để block thì dải
      // màu trải hết bề ngang, chữ ngắn chỉ ăn được một đoạn giữa dải.
      const g = o.gradient;
      if (g && _cxSafeColor(g.from) && _cxSafeColor(g.to)) {
        decls.push(
          `background-image: linear-gradient(90deg, ${g.from.trim()}, ${g.to.trim()}) !important`,
          `-webkit-background-clip: text !important`,
          `background-clip: text !important`,
          `-webkit-text-fill-color: transparent !important`,
          `color: transparent !important`,
          `display: inline-block !important`,
        );
      }
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

  // Cỡ chữ ghi tạm lúc chụm 2 ngón (inline !important) nay đã nằm trong
  // text_overrides → gỡ đi, không thì nó đè mọi lần chỉnh cỡ sau ở bảng.
  document.querySelectorAll("[data-cx-pinch]").forEach((el) => {
    el.style.removeProperty("font-size");
    el.removeAttribute("data-cx-pinch");
  });
}

// Export ra global (các theme dùng qua <script>, không có module system)
if (typeof window !== "undefined") {
  window.THEME_FONTS = THEME_FONTS;
  window.CX_PALETTE_KEYS = CX_PALETTE_KEYS;
  window.CX_PALETTE_TOKENS = CX_PALETTE_TOKENS;
  window.loadThemeFont = _loadGoogleFont; // để bảng chọn nạp trước font cho preview
  window.THEME_HEADING_COLORS = THEME_HEADING_COLORS;
  window.THEME_BODY_COLORS = THEME_BODY_COLORS;
  window.THEME_ACCENT_COLORS = THEME_ACCENT_COLORS;
  window.applyThemeSetting = applyThemeSetting;
  window.applyTextOverrides = applyTextOverrides;
  window.applyCustomBlocks = applyCustomBlocks;
  window.applyDecorations = applyDecorations;
  window.applyElements = applyElements;
}

// ── EDIT RUNTIME — chỉnh chi tiết từng dòng chữ ────────────────────────────
// CHỈ chạy trong iframe preview của tab Giao diện (?preview=true&edit=1): rê
// chuột thì highlight vùng có chữ, click thì gửi selector + style hiện tại về
// trang cha (postMessage) để mở bảng chỉnh riêng.
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
    // không để runtime chung bắt hover/click vào nó. .cx-decor / .cx-el: hoạ tiết
    // và thành phần có bộ nút riêng, không phải chữ của thiệp để chỉnh.
    if (
      el.closest(
        "a, button, input, textarea, select, iframe, [contenteditable], .cx-no-edit, .cx-custom-block, .cx-decor, .cx-el",
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
    // Hoạ tiết / thành phần / khối văn bản có luồng chọn riêng — ảnh bên trong
    // chúng (cánh hoa, ảnh bìa bài hát…) không phải ảnh của thiệp để chỉnh cỡ.
    if (
      img &&
      !img.closest(
        "a, button, .cx-no-edit, .cx-decor, .cx-el, .cx-custom-block",
      )
    )
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

  // Chữ đang ĐỔ MÀU (background-clip:text + chữ trong suốt): computed color là
  // trong suốt nên báo lên bảng chỉnh sẽ thành đen. Lấy 2 chặng màu của dải để
  // bảng mở đúng trạng thái. Trả null nếu không phải chữ đổ màu.
  function _textGradient(cs) {
    const clip = cs.webkitBackgroundClip || cs.backgroundClip;
    if (clip !== "text") return null;
    const fill = cs.webkitTextFillColor || cs.color || "";
    if (!/rgba\([^)]*,\s*0\s*\)/.test(fill)) return null;
    const stops = (cs.backgroundImage || "").match(/rgba?\([^)]*\)/g);
    if (!stops || stops.length < 2) return null;
    return {
      from: _rgbToHex(stops[0]),
      to: _rgbToHex(stops[stops.length - 1]),
    };
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
    const grad = _textGradient(cs);
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
            // Chữ đổ màu thì màu hiệu lực là chặng ĐẦU của dải, không phải
            // cs.color (đang trong suốt → ra đen).
            color: (grad && grad.from) || _rgbToHex(cs.color),
            gradFrom: grad ? grad.from : "",
            gradTo: grad ? grad.to : "",
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

  // Bỏ chọn dòng đang chỉnh và bảo trang cha đóng bảng chỉnh chi tiết. Khối văn
  // bản tự thêm không đặt `picked` (viền do chính khối lo) nên vẫn phải báo.
  function _clearPick() {
    if (picked) picked.classList.remove("cx-edit-picked");
    picked = null;
    _hideDelBtn();
    try {
      parent.postMessage({ type: "cx-line-close" }, "*");
    } catch (e) {}
  }

  function _onClick(e) {
    if (delBtn && e.target.closest("#cx-del-btn")) return; // để nút X tự xử lý
    const res = _resolveTarget(e.target);
    if (!res) {
      // Bấm ra chỗ trống trên thiệp = thôi chỉnh dòng vừa chọn. Thứ có luồng
      // chọn riêng (khối văn bản, hoạ tiết, thành phần) tự lo bảng của nó.
      if (!e.target.closest(".cx-custom-block, .cx-decor, .cx-el")) _clearPick();
      return;
    }
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
  // + nút do chính khối lo nên bỏ picked/nút X; luôn gửi bound:false +
  // textOnly:true kèm blockId để trang cha ghi vào model thay vì text_overrides.
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
          blockLabel: _cxPartLabel(el),
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
