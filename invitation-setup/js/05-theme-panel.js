// Màn Giao diện: phông chữ, bảng màu (Coloris) và câu mẫu chia sẻ.
//
// Tách từ index.js (dòng 816–1384 bản gốc). Thứ tự nạp khai báo ở loader.js.

// ============= THEME (GIAO DIỆN) PANEL =============

// Giá trị mặc định hiển thị trên control khi thiệp chưa cấu hình riêng
const THEME_DEFAULTS = {
  heading_font: "Playfair Display",
  body_font: "Be Vietnam Pro",
  heading_color: "#2d2d2d",
  body_color: "#78716c",
  accent_color: "#c0a062",
  background_color: "#ffffff",
};

// Mặc định = font/màu GỐC của chính theme đang dùng (THEME_PRESETS trong
// theme-setting-helper.js). Theme chưa khai báo thì rơi về THEME_DEFAULTS.
function _themeDefaults() {
  const preset = window.THEME_PRESETS && window.THEME_PRESETS[WEDDING_THEME];
  return { ...THEME_DEFAULTS, ...(preset || {}) };
}

let _themePanelReady = false;

// Đổ danh sách font vào <x-combobox> (preview đúng font từng dòng, tự lật lên).
function _fillFontCombo(el, types) {
  if (!el || !el.setOptions || !window.THEME_FONTS) return;
  const items = window.THEME_FONTS.filter(
    (f) => types.includes(f.type) || f.type === "both",
  ).map((f) => ({ value: f.name, label: f.name }));
  el.setOptions(items);
  // Nạp trước các font để mỗi dòng preview hiện đúng kiểu chữ (không rơi về fallback).
  if (window.loadThemeFont)
    items.forEach((it) => window.loadThemeFont(it.value));
}

// 4 ô màu của thanh chỉnh: id phần tử ↔ khoá trong theme_setting
const THEME_COLOR_FIELDS = [
  { id: "theme-heading-color", key: "heading_color" },
  { id: "theme-body-color", key: "body_color" },
  { id: "theme-accent-color", key: "accent_color" },
  { id: "theme-background-color", key: "background_color" },
];

// Giá trị nằm ở input.value; ô màu tròn là .clr-field bọc ngoài, Coloris tô
// nó bằng inline style `color`. Set thẳng cả hai để khỏi phải bắn event
// (bắn event sẽ chạy qua handler và đánh dấu "chưa lưu" oan).
function _chipValue(id, val) {
  const el = document.getElementById(id);
  if (!el) return "";
  if (val !== undefined) {
    el.value = val;
    const field = el.parentNode;
    if (field && field.classList.contains("clr-field")) {
      field.style.color = val;
    }
  }
  return el.value || "";
}

function _initColorPickers() {
  // Thư viện nạp từ CDN — hỏng mạng thì chip vẫn giữ giá trị, chỉ không mở
  // được bảng chọn; phần còn lại của tab vẫn dùng bình thường.
  if (typeof Coloris === "undefined") return;

  const preset = window.THEME_PRESETS && window.THEME_PRESETS[WEDDING_THEME];
  Coloris({
    el: ".theme-color-input",
    themeMode: "light",
    theme: "large",
    alpha: false,
    format: "hex",
    focusInput: false,
    selectInput: false,
    margin: 16, // mặc định 2px, sát chip quá
    swatches: (preset && preset.swatches) || [],
  });

  // Fork @melloware/coloris không có option closeButton → tự chèn nút "Xong"
  // vào cuối bảng chọn (Coloris.close() đóng picker; màu đã áp live nên chỉ
  // cần đóng). Chèn 1 lần; picker #clr-picker do Coloris dựng sẵn khi init.
  const picker = document.getElementById("clr-picker");

  // Không cho bàn phím ảo bật lên khi chạm ô hex trong picker (mobile).
  // inputmode="none" ẩn bàn phím ảo nhưng vẫn gõ được bằng bàn phím cứng.
  const hexInput = document.getElementById("clr-color-value");
  if (hexInput) hexInput.setAttribute("inputmode", "none");

  if (picker && !picker.querySelector(".cx-clr-done")) {
    const done = document.createElement("button");
    done.type = "button";
    done.className = "cx-clr-done";
    done.textContent = "Xong";
    done.addEventListener("click", () => window.Coloris?.close());
    picker.appendChild(done);
  }

  THEME_COLOR_FIELDS.forEach(({ id }) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("input", () => onThemeSettingChange());
    el.addEventListener("click", () => {
      _openChip = el;
      _alignPickerToChip(el);
    });
  });

  // Chip màu của bảng chỉnh CHI TIẾT 1 dòng (dùng chung Coloris qua .theme-color-input)
  const lineColor = document.getElementById("cx-line-color");
  if (lineColor) {
    lineColor.addEventListener("input", () => onLineColorChange());
    lineColor.addEventListener("click", () => {
      _openChip = lineColor;
      _alignPickerToChip(lineColor);
    });
  }

  // Xoay máy / đổi kích thước khi đang mở → mở lại để Coloris tính lại vị trí
  // VÀ đo lại vùng màu (không dời popup bằng tay, xem _alignPickerToChip).
  window.addEventListener("resize", () => {
    const picker = document.getElementById("clr-picker");
    if (picker?.classList.contains("clr-open") && _openChip?.isConnected) {
      _openChip.click();
    }
  });
}

let _openChip = null;

// Coloris chống tràn ngang bằng cách DÓNG PHẢI popup vào ô input — công thức đó
// giả định input rộng cỡ popup, còn chip của ta chỉ 32px nên popup lệch hẳn.
//
// KHÔNG được dời popup sau khi Coloris mở: ngay trong handler click, nó đo và
// CACHE toạ độ vùng màu theo vị trí vừa đặt (colorAreaDims). Dời popup sau đó
// làm toạ độ cache lệch đúng bằng khoảng dời → kéo trong vùng màu ra màu không
// khớp con trỏ.
//
// Cách làm: dời TẠM chính ô input (position:relative) TRƯỚC khi Coloris đo —
// handler này gắn thẳng trên input nên chạy ở pha target, sớm hơn handler uỷ
// quyền trên document của Coloris — để tự Coloris đặt popup vào giữa chip rồi
// cache đúng. Trả ô input về chỗ cũ trong requestAnimationFrame (chạy trước khi
// vẽ) nên không thấy nhảy hình.
function _alignPickerToChip(chipEl) {
  const picker = document.getElementById("clr-picker");
  if (!picker || !chipEl) return;

  // Popup đang ẩn thì offsetWidth = 0 → mượn class clr-open để đo rồi trả lại.
  const wasOpen = picker.classList.contains("clr-open");
  if (!wasOpen) picker.classList.add("clr-open");
  const w = picker.offsetWidth;
  if (!wasOpen) picker.classList.remove("clr-open");
  if (!w) return;

  const chip = chipEl.getBoundingClientRect();
  const vw = document.documentElement.clientWidth;
  const gap = 8;
  const left = Math.max(
    gap,
    Math.min(chip.left + chip.width / 2 - w / 2, vw - w - gap),
  );
  const dx = Math.round(left - chip.left);
  if (!dx) return;

  const pos = chipEl.style.position;
  const l = chipEl.style.left;
  chipEl.style.position = "relative";
  chipEl.style.left = `${dx}px`;
  requestAnimationFrame(() => {
    chipEl.style.position = pos;
    chipEl.style.left = l;
  });
}

function _initThemePanel() {
  const s = _themeSetting || {};
  const d = _themeDefaults();

  // Đổ màu vào chip TRƯỚC khi khởi tạo Coloris: lúc bọc .clr-field, Coloris
  // lấy luôn input.value làm màu hiển thị của ô tròn.
  THEME_COLOR_FIELDS.forEach(({ id, key }) => {
    _chipValue(id, s[key] || d[key]);
  });

  if (!_themePanelReady) {
    _fillFontCombo(document.getElementById("theme-heading-font"), ["heading"]);
    _fillFontCombo(document.getElementById("theme-body-font"), ["body"]);
    _initColorPickers();
    _themePanelReady = true;
  }

  // <x-combobox>.value tự đồng bộ nhãn khi gán (kể cả lúc nạp thiệp / reset).
  const hf = document.getElementById("theme-heading-font");
  const bf = document.getElementById("theme-body-font");
  if (hf) hf.value = s.heading_font || d.heading_font;
  if (bf) bf.value = s.body_font || d.body_font;

  // Mở tab Giao diện → về nhóm chỉnh chung, đóng bảng chỉnh 1 dòng / thêm văn
  // bản / trang trí
  document.getElementById("theme-addtext-panel")?.classList.add("hidden");
  document.getElementById("theme-decor-panel")?.classList.add("hidden");
  closeLineEditor();
  _initEditHint();

  // Icon (reset) trong thanh chỉnh
  if (window.lucide) lucide.createIcons();
}

function onThemeSettingChange() {
  const hf = document.getElementById("theme-heading-font");
  const bf = document.getElementById("theme-body-font");

  // Giữ lại ghi đè từng dòng + khối văn bản + hoạ tiết — nếu không sẽ bị xoá
  // khi dựng lại object.
  const overrides = _themeSetting.text_overrides;
  const blocks = _themeSetting.custom_blocks;
  const decors = _themeSetting.decorations;

  _themeSetting = {
    heading_font: hf ? hf.value : "",
    body_font: bf ? bf.value : "",
  };
  THEME_COLOR_FIELDS.forEach(({ id, key }) => {
    _themeSetting[key] = _chipValue(id);
  });
  if (overrides && Object.keys(overrides).length)
    _themeSetting.text_overrides = overrides;
  if (Array.isArray(blocks) && blocks.length)
    _themeSetting.custom_blocks = blocks;
  if (Array.isArray(decors) && decors.length)
    _themeSetting.decorations = decors;

  _setDirty(true, "theme");

  // Áp dụng ngay vào iframe preview trong tab giao diện
  const iframe = document.getElementById("theme-preview-iframe");
  if (iframe?.contentWindow?.applyThemeSetting) {
    iframe.contentWindow.applyThemeSetting(_themeSetting);
  }
}

function resetThemeSetting() {
  _themeSetting = {};
  _initThemePanel();
  _setDirty(true, "theme");

  const iframe = document.getElementById("theme-preview-iframe");
  if (iframe && iframe.src) {
    // Reload iframe để xoá hết override, quay về mặc định của theme
    _savePreviewData();
    iframe.src = iframe.src;
  }
}

window.onThemeSettingChange = onThemeSettingChange;
window.resetThemeSetting = resetThemeSetting;

// ═══════════════════════════════════════════════════════════════════════════
// CHỈNH CHI TIẾT TỪNG DÒNG CHỮ (advanced)
// Runtime trong iframe (theme-setting-helper.js) gửi 'cx-text-pick' khi click 1
// dòng chữ → mở bảng chỉnh riêng ở #theme-line-editor. Mỗi thay đổi cập nhật
// _themeSetting.text_overrides[selector] rồi áp lại vào iframe preview.
// ═══════════════════════════════════════════════════════════════════════════

let _lineSel = null; // selector dòng/ảnh đang chỉnh
let _lineFontReady = false; // đã nạp options font cho combobox chưa
let _lineIsImage = false; // dòng đang chỉnh là ẢNH?
let _imgRatio = 1; // tỉ lệ rộng/cao dùng khi "giữ tỉ lệ"
let _lineComputed = {}; // style computed của dòng lúc mở (fallback cho chữ mẫu)
let _lineBound = false; // text bound từ Thiết lập? → khoá sửa nội dung
let _lineTextOnly = true; // phần tử chỉ chứa text thuần? → mới cho sửa nội dung
let _lineBlockId = null; // đang chỉnh KHỐI văn bản tự thêm? (id khối) → nội dung
let _lineBlockList = false; // khối đó là danh sách? → mỗi dòng 1 mục

// Nhận tín hiệu click text từ iframe tab Giao diện (đúng nguồn mới nhận).
window.addEventListener("message", (ev) => {
  const d = ev.data;
  if (!d) return;
  const iframe = document.getElementById("theme-preview-iframe");
  if (!iframe || ev.source !== iframe.contentWindow) return;
  if (d.type === "cx-text-pick") _openLineEditor(d);
  else if (d.type === "cx-hide") hidePickedElement(d.selector);
  // Khối văn bản đang chỉnh vừa bị xoá trong thiệp → đóng bảng chỉnh chi tiết
  else if (d.type === "cx-line-close") closeLineEditor();
  else if (d.type === "cx-blocks-changed") {
    // Runtime báo danh sách khối văn bản đã đổi → lưu vào theme_setting + đánh dấu chưa lưu.
    _themeSetting.custom_blocks = Array.isArray(d.blocks) ? d.blocks : [];
    _setDirty(true, "theme");
  } else if (d.type === "cx-decors-changed") {
    // Hoạ tiết vừa thêm / kéo / xoay / xoá trong thiệp → lưu toạ độ mới.
    _themeSetting.decorations = Array.isArray(d.decors) ? d.decors : [];
    _setDirty(true, "theme");
  }
});

// ─── Thêm văn bản (bảng chọn mẫu riêng) ──────────────────────────────────────
// Mở như bảng chỉnh 1 dòng: chiếm chỗ nhóm chỉnh chung (ẩn phông/màu) để chỉ còn
// các mẫu khối — tránh rối khi đang kéo-thả vào thiệp.
function openAddTextPanel() {
  document.getElementById("theme-line-editor")?.classList.add("hidden");
  document.getElementById("theme-decor-panel")?.classList.add("hidden");
  document.getElementById("theme-main-controls")?.classList.add("hidden");
  document.getElementById("theme-edit-hint")?.classList.add("hidden");
  document.getElementById("theme-addtext-panel")?.classList.remove("hidden");
  if (window.lucide) lucide.createIcons();
}
window.openAddTextPanel = openAddTextPanel;

function closeAddTextPanel() {
  document.getElementById("theme-addtext-panel")?.classList.add("hidden");
  document.getElementById("theme-main-controls")?.classList.remove("hidden");
  _initEditHint();
}
window.closeAddTextPanel = closeAddTextPanel;

function addTextBlock(type) {
  closeAddTextPanel();
  _setDirty(true, "theme");
  _lineIframe()?.contentWindow?.postMessage(
    { type: "cx-add-block", blockType: type },
    "*",
  );
}
window.addTextBlock = addTextBlock;

// Kéo mẫu TỪ palette THẢ vào thiệp. setPointerCapture trên nút → parent vẫn nhận
// pointermove kể cả khi con trỏ ở trên iframe; gửi toạ độ (theo viewport iframe)
// cho runtime hiện vạch chèn; thả trên iframe → runtime thêm khối tại đó. Bấm mà
// không kéo (di chuyển < 6px) → thêm ở cuối như cũ.
let _paletteDrag = null;
function startPaletteDrag(e, type) {
  if (e.button != null && e.button !== 0) return; // chỉ chuột trái
  const btn = e.currentTarget;
  e.preventDefault();
  try {
    btn.setPointerCapture(e.pointerId);
  } catch (err) {}
  // Tắt pointer-events iframe → con trỏ rê qua iframe parent VẪN nhận pointermove.
  const iframe = _lineIframe();
  if (iframe) iframe.style.pointerEvents = "none";
  // Khoảng lệch từ con trỏ tới góc trên-trái thẻ mẫu → ghost nằm ĐÚNG chỗ vừa
  // "nhấc" lên, con trỏ giữ nguyên điểm bấm trên thẻ.
  const r = btn.getBoundingClientRect();
  _paletteDrag = {
    type,
    btn,
    iframe,
    x0: e.clientX,
    y0: e.clientY,
    offX: e.clientX - r.left,
    offY: e.clientY - r.top,
    moved: false,
    ghost: null,
    over: false,
  };
  const move = (ev) => _paletteDragMove(ev);
  const up = (ev) => {
    btn.removeEventListener("pointermove", move);
    btn.removeEventListener("pointerup", up);
    btn.removeEventListener("pointercancel", up);
    _paletteDragEnd(ev);
  };
  btn.addEventListener("pointermove", move);
  btn.addEventListener("pointerup", up);
  btn.addEventListener("pointercancel", up);
}
window.startPaletteDrag = startPaletteDrag;

function _paletteDragMove(ev) {
  const d = _paletteDrag;
  if (!d) return;
  if (!d.moved) {
    if (Math.hypot(ev.clientX - d.x0, ev.clientY - d.y0) < 6) return;
    d.moved = true;
    // Bóng mờ = BẢN SAO của chính mẫu đang kéo (mờ 50%) cho dễ nhận ra
    d.ghost = d.btn.cloneNode(true);
    d.ghost.removeAttribute("id");
    d.ghost.classList.add("cx-drag-ghost");
    d.ghost.style.width = `${d.btn.offsetWidth}px`;
    // Đặt sẵn vị trí trước khi gắn vào DOM → hiện ngay tại con trỏ, không nhảy
    d.ghost.style.left = `${ev.clientX - d.offX}px`;
    d.ghost.style.top = `${ev.clientY - d.offY}px`;
    document.body.appendChild(d.ghost);
  }
  // Bám con trỏ theo đúng điểm đã bấm; kẹp ngang cho khỏi lòi ra mép màn hình
  const gw = d.ghost.offsetWidth || d.btn.offsetWidth;
  const vw = document.documentElement.clientWidth;
  d.ghost.style.left =
    Math.max(8, Math.min(ev.clientX - d.offX, vw - gw - 8)) + "px";
  d.ghost.style.top = ev.clientY - d.offY + "px";
  const iframe = _lineIframe();
  const r = iframe && iframe.getBoundingClientRect();
  const inside =
    r &&
    ev.clientX >= r.left &&
    ev.clientX <= r.right &&
    ev.clientY >= r.top &&
    ev.clientY <= r.bottom;
  if (inside) {
    d.over = true;
    iframe.contentWindow?.postMessage(
      { type: "cx-drag-over", y: ev.clientY - r.top },
      "*",
    );
  } else if (d.over) {
    d.over = false;
    iframe?.contentWindow?.postMessage({ type: "cx-drag-cancel" }, "*");
  }
}

function _paletteDragEnd(ev) {
  const d = _paletteDrag;
  _paletteDrag = null;
  if (!d) return;
  d.ghost?.remove();
  if (d.iframe) d.iframe.style.pointerEvents = ""; // khôi phục tương tác iframe
  const iframe = d.iframe || _lineIframe();
  if (!d.moved) {
    addTextBlock(d.type); // chỉ bấm → thêm ở cuối
  } else if (d.over && iframe) {
    const r = iframe.getBoundingClientRect();
    closeAddTextPanel();
    _setDirty(true, "theme");
    iframe.contentWindow?.postMessage(
      { type: "cx-drop", blockType: d.type, y: ev.clientY - r.top },
      "*",
    );
  } else {
    iframe?.contentWindow?.postMessage({ type: "cx-drag-cancel" }, "*");
  }
}

// ─── Trang trí: bảng chọn hoa (nạp từ kho ảnh mẫu) ───────────────────────────
// Danh sách lấy ở /assets/flowers/manifest.json — file do tab "Ảnh mẫu" bên
// /admin ghi ra mỗi lần lưu. Trang tĩnh không list được thư mục qua HTTP nên
// manifest là nguồn duy nhất.
const DECOR_MANIFEST_URL = "/assets/flowers/manifest.json";
let _decorItems = null; // cache trong phiên; null = chưa nạp

function openDecorPanel() {
  document.getElementById("theme-line-editor")?.classList.add("hidden");
  document.getElementById("theme-addtext-panel")?.classList.add("hidden");
  document.getElementById("theme-main-controls")?.classList.add("hidden");
  document.getElementById("theme-edit-hint")?.classList.add("hidden");
  document.getElementById("theme-decor-panel")?.classList.remove("hidden");
  _renderDecorPalette();
  if (window.lucide) lucide.createIcons();
}
window.openDecorPanel = openDecorPanel;

function closeDecorPanel() {
  document.getElementById("theme-decor-panel")?.classList.add("hidden");
  document.getElementById("theme-main-controls")?.classList.remove("hidden");
  _initEditHint();
}
window.closeDecorPanel = closeDecorPanel;

function _decorEmpty(msg) {
  const el = document.getElementById("cx-decor-empty");
  if (!el) return;
  el.textContent = msg || "";
  el.classList.toggle("hidden", !msg);
}

async function _renderDecorPalette() {
  const grid = document.getElementById("cx-decor-palette");
  if (!grid || grid.dataset.rendered === "1") return;

  if (!_decorItems) {
    try {
      const res = await fetch(DECOR_MANIFEST_URL, { cache: "no-cache" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const json = await res.json();
      _decorItems = (json.images || [])
        .filter((i) => i && (i.url || i.file))
        .map((i) => ({
          url: i.url || `/assets/flowers/${i.file}`,
          name: i.file || "",
        }));
    } catch (e) {
      console.warn("Không nạp được danh sách hoạ tiết:", e);
      _decorEmpty("Chưa tải được danh sách hoạ tiết. Thử tải lại trang.");
      return;
    }
  }

  if (!_decorItems.length) {
    _decorEmpty("Chưa có hoạ tiết nào — thêm ảnh ở trang quản trị, mục Ảnh mẫu.");
    return;
  }

  _decorEmpty("");
  grid.textContent = "";
  _decorItems.forEach((item) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.title = "Kéo vào thiệp hoặc bấm để thêm";
    btn.className = "cx-decor-item";
    const img = document.createElement("img");
    img.src = item.url;
    img.alt = item.name;
    img.loading = "lazy";
    btn.appendChild(img);
    // Gắn listener (không dùng onpointerdown="" trong HTML): đường dẫn ảnh có
    // thể chứa ký tự làm vỡ attribute.
    btn.addEventListener("pointerdown", (e) => startDecorDrag(e, item.url));
    grid.appendChild(btn);
  });
  grid.dataset.rendered = "1";
}

// Kéo hoa TỪ bảng chọn THẢ vào thiệp — cùng cách với mẫu văn bản: giữ
// pointer-capture ở nút, tắt pointer-events của iframe để parent vẫn nhận
// pointermove, thả trong iframe thì gửi TOẠ ĐỘ điểm thả cho runtime.
let _decorDrag = null;
function startDecorDrag(e, src) {
  if (e.button != null && e.button !== 0) return;
  const btn = e.currentTarget;
  e.preventDefault();
  try {
    btn.setPointerCapture(e.pointerId);
  } catch (err) {}
  const iframe = _lineIframe();
  if (iframe) iframe.style.pointerEvents = "none";
  const r = btn.getBoundingClientRect();
  _decorDrag = {
    src,
    btn,
    iframe,
    x0: e.clientX,
    y0: e.clientY,
    offX: e.clientX - r.left,
    offY: e.clientY - r.top,
    moved: false,
    ghost: null,
  };
  const move = (ev) => _decorDragMove(ev);
  const up = (ev) => {
    btn.removeEventListener("pointermove", move);
    btn.removeEventListener("pointerup", up);
    btn.removeEventListener("pointercancel", up);
    _decorDragEnd(ev);
  };
  btn.addEventListener("pointermove", move);
  btn.addEventListener("pointerup", up);
  btn.addEventListener("pointercancel", up);
}
window.startDecorDrag = startDecorDrag;

function _decorDragMove(ev) {
  const d = _decorDrag;
  if (!d) return;
  if (!d.moved) {
    if (Math.hypot(ev.clientX - d.x0, ev.clientY - d.y0) < 6) return;
    d.moved = true;
    d.ghost = d.btn.cloneNode(true);
    d.ghost.removeAttribute("id");
    d.ghost.classList.add("cx-drag-ghost");
    d.ghost.style.width = `${d.btn.offsetWidth}px`;
    d.ghost.style.left = `${ev.clientX - d.offX}px`;
    d.ghost.style.top = `${ev.clientY - d.offY}px`;
    document.body.appendChild(d.ghost);
  }
  const gw = d.ghost.offsetWidth || d.btn.offsetWidth;
  const vw = document.documentElement.clientWidth;
  d.ghost.style.left =
    Math.max(8, Math.min(ev.clientX - d.offX, vw - gw - 8)) + "px";
  d.ghost.style.top = ev.clientY - d.offY + "px";
}

function _decorDragEnd(ev) {
  const d = _decorDrag;
  _decorDrag = null;
  if (!d) return;
  d.ghost?.remove();
  if (d.iframe) d.iframe.style.pointerEvents = "";
  const iframe = d.iframe || _lineIframe();
  if (!iframe) return;

  const r = iframe.getBoundingClientRect();
  const inside =
    d.moved &&
    ev.clientX >= r.left &&
    ev.clientX <= r.right &&
    ev.clientY >= r.top &&
    ev.clientY <= r.bottom;

  // Bấm (không kéo) → thả vào giữa thiệp; kéo ra ngoài iframe → bỏ qua.
  if (!d.moved) {
    _addDecor(d.src, null, null);
  } else if (inside) {
    _addDecor(d.src, ev.clientX - r.left, ev.clientY - r.top);
  }
}

function _addDecor(src, x, y) {
  closeDecorPanel();
  _setDirty(true, "theme");
  _lineIframe()?.contentWindow?.postMessage({ type: "cx-add-decor", src, x, y }, "*");
}

function _lineIframe() {
  return document.getElementById("theme-preview-iframe");
}

function _openLineEditor(msg) {
  _lineSel = msg.selector;
  _lineIsImage = !!msg.isImage;
  const ov =
    (_themeSetting.text_overrides && _themeSetting.text_overrides[_lineSel]) ||
    {};

  document.getElementById("theme-main-controls")?.classList.add("hidden");
  document.getElementById("theme-addtext-panel")?.classList.add("hidden");
  document.getElementById("theme-decor-panel")?.classList.add("hidden");
  document.getElementById("theme-edit-hint")?.classList.add("hidden");
  document.getElementById("theme-line-editor")?.classList.remove("hidden");

  // Đổi giữa nhóm control CHỮ và ẢNH
  document
    .getElementById("cx-le-text")
    ?.classList.toggle("hidden", _lineIsImage);
  document
    .getElementById("cx-le-image")
    ?.classList.toggle("hidden", !_lineIsImage);

  // Mặc định hiện dòng nhắc; _openTextEditor sẽ ẩn nếu có ô sửa Nội dung
  document.getElementById("cx-le-sample-row")?.classList.remove("hidden");
  const sample = document.getElementById("cx-le-sample");
  if (sample)
    sample.textContent = _lineIsImage
      ? "ảnh"
      : msg.sample
        ? `“${msg.sample}”`
        : "dòng này";

  if (_lineIsImage) _openImgEditor(msg, ov);
  else _openTextEditor(msg, msg.computed || {}, ov);

  if (window.lucide) lucide.createIcons();

  // Bảng chỉnh vừa mở → iframe co lại; đợi layout ổn định rồi báo runtime cuộn dòng
  // đang chỉnh vào giữa vùng preview còn thấy (nếu nó bị bảng che / ra ngoài).
  const sel = _lineSel;
  setTimeout(() => {
    _lineIframe()?.contentWindow?.postMessage(
      { type: "cx-scroll", selector: sel },
      "*",
    );
  }, 120);
}

function _openTextEditor(msg, c, ov) {
  _lineComputed = c;
  _lineBound = !!msg.bound;
  _lineTextOnly = msg.textOnly !== false;
  // Khối văn bản tự thêm: nội dung nằm trong custom_blocks, sửa ở ô "Nội dung"
  // dưới đây rồi gửi về runtime (không đi qua text_overrides).
  _lineBlockId = msg.blockId || null;
  _lineBlockList = !!msg.blockList;

  // Nội dung: chỉ hiện khi là text thuần (không có con) và KHÔNG bound; ngược lại
  // ẩn hẳn mục (không note/tooltip).
  const box = document.getElementById("cx-le-content");
  const ta = document.getElementById("cx-line-text");
  const canEditText = _lineTextOnly && !_lineBound;
  box?.classList.toggle("hidden", !canEditText);
  // Có ô sửa Nội dung rồi thì bỏ dòng "Nội dung đang chọn" cho popup gọn
  document
    .getElementById("cx-le-sample-row")
    ?.classList.toggle("hidden", canEditText);
  if (canEditText && ta) {
    ta.value = _lineBlockId
      ? msg.text || ""
      : (ov.text != null ? ov.text : msg.text) || "";
    // Danh sách: mỗi dòng là 1 mục → ô cao hơn + nhắc trong nhãn/placeholder
    ta.rows = _lineBlockList ? 4 : 2;
    ta.placeholder = _lineBlockList ? "Mỗi dòng một mục…" : "Nhập nội dung…";
    const label = box?.querySelector("label");
    if (label)
      label.textContent = _lineBlockList
        ? "Nội dung (mỗi dòng một mục)"
        : "Nội dung";
    // Khối vừa thêm → focus + chọn sẵn chữ mẫu để gõ đè lên ngay
    if (msg.fresh) {
      ta.focus();
      ta.select();
    }
  }

  // Font — nạp options 1 lần (đủ cả heading + body cho từng dòng)
  const fontEl = document.getElementById("cx-line-font");
  if (fontEl && !_lineFontReady) {
    _fillFontCombo(fontEl, ["heading", "body"]);
    _lineFontReady = true;
  }
  // Ưu tiên override; nếu chưa có, dò font THẬT của dòng (khớp danh sách THEME_FONTS)
  // để combobox hiện đúng phông đang dùng thay vì "Mặc định".
  if (fontEl) fontEl.value = ov.font || _matchThemeFont(c.fontFamily) || "";

  // Cỡ chữ — override nếu có, không thì lấy computed
  const sizeEl = document.getElementById("cx-line-size");
  if (sizeEl) sizeEl.value = ov.size || c.fontSize || 16;

  // Màu
  const color = ov.color || c.color || "#000000";
  _chipValueRaw("cx-line-color", color);

  // Đậm / nghiêng / gạch chân / căn lề
  _setToggle(
    "cx-line-bold",
    ov.weight ? Number(ov.weight) >= 600 : Number(c.fontWeight) >= 600,
  );
  _setToggle(
    "cx-line-underline",
    ov.underline != null
      ? !!ov.underline
      : (c.textDecoration || "").includes("underline"),
  );
  _setToggle(
    "cx-line-italic",
    ov.italic != null ? !!ov.italic : c.fontStyle === "italic",
  );
  _setAlignButtons(ov.align || "");
  _syncSampleStyle();
}

function _openImgEditor(msg, ov) {
  const w = ov.width || msg.width || 0;
  const h = ov.height || msg.height || 0;
  _imgRatio =
    ov.width && ov.height
      ? ov.width / ov.height
      : msg.ratio || (w && h ? w / h : 1);
  const wEl = document.getElementById("cx-img-w");
  const hEl = document.getElementById("cx-img-h");
  if (wEl) wEl.value = w || "";
  if (hEl) hEl.value = h || "";
  const keep = document.getElementById("cx-img-ratio");
  if (keep) keep.checked = true;
  _syncSampleStyle(); // "ảnh" → trả chữ mẫu về mặc định
}

function closeLineEditor() {
  document.getElementById("theme-line-editor")?.classList.add("hidden");
  document.getElementById("theme-main-controls")?.classList.remove("hidden");
  _initEditHint();
  _lineIframe()?.contentWindow?.postMessage({ type: "cx-clear-pick" }, "*");
  _lineSel = null;
  _lineBlockId = null;
  _lineBlockList = false;
}
window.closeLineEditor = closeLineEditor;

function _lineOverride() {
  if (!_themeSetting.text_overrides) _themeSetting.text_overrides = {};
  if (!_themeSetting.text_overrides[_lineSel])
    _themeSetting.text_overrides[_lineSel] = {};
  return _themeSetting.text_overrides[_lineSel];
}

// Sau mỗi thay đổi 1 dòng: đánh dấu chưa lưu + áp lại vào iframe preview
// (style qua applyThemeSetting, nội dung/ẩn qua applyThemeSetting + applyTextOverrides).
function _applyLine() {
  _setDirty(true, "theme");
  const cw = _lineIframe()?.contentWindow;
  cw?.applyThemeSetting?.(_themeSetting);
  cw?.applyTextOverrides?.(_themeSetting);
}

function onLineFontChange() {
  if (!_lineSel) return;
  const v = document.getElementById("cx-line-font")?.value || "";
  const o = _lineOverride();
  if (v) o.font = v;
  else delete o.font;
  _syncSampleStyle();
  _applyLine();
}
window.onLineFontChange = onLineFontChange;

function onLineSizeChange() {
  if (!_lineSel) return;
  const v = parseInt(document.getElementById("cx-line-size")?.value, 10);
  const o = _lineOverride();
  if (v > 0) o.size = v;
  else delete o.size;
  _syncSampleStyle();
  _applyLine();
}
window.onLineSizeChange = onLineSizeChange;

function stepLineSize(delta) {
  const el = document.getElementById("cx-line-size");
  if (!el) return;
  const cur = parseInt(el.value, 10) || 16;
  el.value = Math.max(8, Math.min(200, cur + delta));
  onLineSizeChange();
}
window.stepLineSize = stepLineSize;

function onLineColorChange() {
  if (!_lineSel) return;
  const v = document.getElementById("cx-line-color")?.value || "";
  const o = _lineOverride();
  if (v) o.color = v;
  else delete o.color;
  _syncSampleStyle(); // chữ mẫu đổi theo live
  _applyLine();
}
window.onLineColorChange = onLineColorChange;

// Chữ mẫu "Đang chỉnh: ..." hiển thị bằng ĐÚNG font/cỡ/màu/đậm/nghiêng/gạch chân
// đang chọn (preview trực tiếp). Đọc từ chính các control (đã nạp giá trị hiệu lực),
// fallback về computed cho font ngoài danh sách. Cỡ chữ kẹp 48px để không phá bố cục.
function _syncSampleStyle() {
  const s = document.getElementById("cx-le-sample");
  if (!s) return;
  if (_lineIsImage) {
    s.removeAttribute("style"); // "ảnh" → về mặc định
    return;
  }
  const font = document.getElementById("cx-line-font")?.value || "";
  const size =
    parseInt(document.getElementById("cx-line-size")?.value, 10) || 0;
  const color = document.getElementById("cx-line-color")?.value || "";
  const has = (id) => document.getElementById(id)?.classList.contains("active");

  s.style.fontFamily = font ? `'${font}'` : _lineComputed.fontFamily || "";
  s.style.fontSize = Math.min(size || _lineComputed.fontSize || 16, 48) + "px";
  s.style.color = color || _lineComputed.color || "";
  s.style.fontWeight = has("cx-line-bold") ? "700" : "";
  s.style.fontStyle = has("cx-line-italic") ? "italic" : "";
  s.style.textDecoration = has("cx-line-underline") ? "underline" : "";
  if (font && window.loadThemeFont) window.loadThemeFont(font);
}

function toggleLineStyle(kind) {
  if (!_lineSel) return;
  const o = _lineOverride();
  if (kind === "bold") {
    const on = !document
      .getElementById("cx-line-bold")
      ?.classList.contains("active");
    _setToggle("cx-line-bold", on);
    if (on) o.weight = "700";
    else delete o.weight;
  } else if (kind === "underline") {
    const on = !document
      .getElementById("cx-line-underline")
      ?.classList.contains("active");
    _setToggle("cx-line-underline", on);
    if (on) o.underline = true;
    else delete o.underline;
  } else {
    const on = !document
      .getElementById("cx-line-italic")
      ?.classList.contains("active");
    _setToggle("cx-line-italic", on);
    if (on) o.italic = true;
    else delete o.italic;
  }
  _syncSampleStyle();
  _applyLine();
}
window.toggleLineStyle = toggleLineStyle;

function setLineAlign(a) {
  if (!_lineSel) return;
  const o = _lineOverride();
  if (o.align === a) {
    delete o.align; // bấm lại nút đang chọn → bỏ căn riêng
    a = "";
  } else {
    o.align = a;
  }
  _setAlignButtons(a);
  _applyLine();
}
window.setLineAlign = setLineAlign;

function clearLineOverride() {
  if (!_lineSel) return;
  if (_themeSetting.text_overrides)
    delete _themeSetting.text_overrides[_lineSel];
  _applyLine(); // xoá override + áp lại vào preview
  // GIỮ NGUYÊN màn đang sửa: xin iframe tính lại giá trị mặc định của dòng/ảnh để
  // cập nhật control (font/cỡ/màu… hoặc rộng/cao) về đúng mặc định.
  _lineIframe()?.contentWindow?.postMessage(
    { type: "cx-recompute", selector: _lineSel, isImage: _lineIsImage },
    "*",
  );
}
window.clearLineOverride = clearLineOverride;

// ─── Ẩn thành phần (nút X trên phần tử, do runtime gửi 'cx-hide') ─────────────
function hidePickedElement(selector) {
  const sel = selector || _lineSel;
  if (!sel) return;
  if (!_themeSetting.text_overrides) _themeSetting.text_overrides = {};
  if (!_themeSetting.text_overrides[sel])
    _themeSetting.text_overrides[sel] = {};
  _themeSetting.text_overrides[sel].hidden = true;
  _applyLine();
  // Phần tử đã biến mất hẳn → đóng bảng chỉnh + bỏ chọn (ẩn nút X).
  closeLineEditor();
}

// ─── Sửa NỘI DUNG text gốc (chỉ text thuần, không bound) ─────────────────────
function onLineTextChange() {
  if (!_lineSel || _lineBound || !_lineTextOnly) return;
  const v = document.getElementById("cx-line-text")?.value ?? "";
  // Khối văn bản tự thêm: nội dung là của khối (custom_blocks) → nhờ runtime ghi
  // vào model + vẽ lại; nó tự báo 'cx-blocks-changed' để lưu và đánh dấu chưa lưu.
  if (_lineBlockId) {
    _lineIframe()?.contentWindow?.postMessage(
      { type: "cx-block-text", id: _lineBlockId, text: v },
      "*",
    );
    return;
  }
  const o = _lineOverride();
  if (v.trim() === "")
    delete o.text; // rỗng → trả về nội dung gốc (applyTextOverrides phục hồi)
  else o.text = v;
  _applyLine();
}
window.onLineTextChange = onLineTextChange;

// ─── Chỉnh KÍCH THƯỚC ẢNH ────────────────────────────────────────────────────
function onImgSizeChange(which) {
  if (!_lineSel) return;
  const wEl = document.getElementById("cx-img-w");
  const hEl = document.getElementById("cx-img-h");
  const keep = document.getElementById("cx-img-ratio")?.checked;
  let w = parseInt(wEl?.value, 10);
  let h = parseInt(hEl?.value, 10);
  // Giữ tỉ lệ: đổi chiều nào thì chiều kia tính theo _imgRatio.
  if (keep && _imgRatio) {
    if (which === "w" && w > 0) {
      h = Math.round(w / _imgRatio);
      if (hEl) hEl.value = h;
    } else if (which === "h" && h > 0) {
      w = Math.round(h * _imgRatio);
      if (wEl) wEl.value = w;
    }
  }
  const o = _lineOverride();
  if (w > 0) o.width = w;
  else delete o.width;
  if (h > 0) o.height = h;
  else delete o.height;
  _applyLine();
}
window.onImgSizeChange = onImgSizeChange;

function stepImgSize(which, delta) {
  const el = document.getElementById(which === "w" ? "cx-img-w" : "cx-img-h");
  if (!el) return;
  const cur = parseInt(el.value, 10) || 0;
  el.value = Math.max(8, Math.min(2000, cur + delta * 10)); // bước 10px cho ảnh
  onImgSizeChange(which);
}
window.stepImgSize = stepImgSize;

function onImgRatioToggle() {
  // Bật "giữ tỉ lệ" → chốt tỉ lệ theo kích thước hiện tại.
  const w = parseInt(document.getElementById("cx-img-w")?.value, 10);
  const h = parseInt(document.getElementById("cx-img-h")?.value, 10);
  if (document.getElementById("cx-img-ratio")?.checked && w > 0 && h > 0)
    _imgRatio = w / h;
}
window.onImgRatioToggle = onImgRatioToggle;

// Set giá trị chip màu (input + ô tròn .clr-field do Coloris bọc) không bắn event.
function _chipValueRaw(id, val) {
  const el = document.getElementById(id);
  if (!el) return;
  el.value = val;
  const field = el.parentNode;
  if (field && field.classList.contains("clr-field")) field.style.color = val;
}

function _setToggle(id, on) {
  document.getElementById(id)?.classList.toggle("active", !!on);
}

// Lấy font đầu tiên trong computed font-family (vd "'Playfair Display', serif")
// và khớp (không phân biệt hoa/thường) với danh sách THEME_FONTS. Không khớp → ""
// (combobox chỉ chứa font trong danh sách; font trang trí ngoài danh sách để "Mặc định").
function _matchThemeFont(css) {
  if (!css) return "";
  const first = css
    .split(",")[0]
    .trim()
    .replace(/^['"]|['"]$/g, "");
  const names = (window.THEME_FONTS || []).map((f) => f.name);
  return names.find((n) => n.toLowerCase() === first.toLowerCase()) || "";
}

function _setAlignButtons(a) {
  document.querySelectorAll("#cx-line-align button").forEach((b) => {
    b.classList.toggle("active", b.dataset.align === a);
  });
}

// ─── Banner gợi ý "nhấp chữ để chỉnh" (nhớ đã đóng qua localStorage) ──────────
function _initEditHint() {
  const hint = document.getElementById("theme-edit-hint");
  if (!hint) return;
  const lineOpen = !document
    .getElementById("theme-line-editor")
    ?.classList.contains("hidden");
  const addOpen = !document
    .getElementById("theme-addtext-panel")
    ?.classList.contains("hidden");
  const dismissed = getCache(buildCacheKey("theme_edit_hint"));
  hint.classList.toggle("hidden", dismissed || lineOpen || addOpen);
}

function dismissEditHint() {
  document.getElementById("theme-edit-hint")?.classList.add("hidden");
  setCache(buildCacheKey("theme_edit_hint"), true);
}
window.dismissEditHint = dismissEditHint;

// ─── Kéo đổi rộng cột chỉnh (chỉ desktop) ─────────────────────────────────────
// Ghi --theme-ctrl-w (px) lên #theme-controls; setup.css chỉ đọc biến này trong
// media query >=768px nên KHÔNG đụng tới thanh dưới ở mobile. min/max kẹp ở CSS.
const _THEME_CTRL_MIN = 340;
const _THEME_CTRL_MAX = 560;

function _initThemeResize() {
  const handle = document.getElementById("theme-resize");
  const controls = document.getElementById("theme-controls");
  const panel = document.getElementById("theme-panel");
  const iframe = document.getElementById("theme-preview-iframe");
  if (!handle || !controls || !panel) return;

  // Khôi phục độ rộng đã lưu (nếu có)
  const saved = getCache(buildCacheKey("theme_ctrl_w"));
  if (saved) controls.style.setProperty("--theme-ctrl-w", saved);

  let dragging = false;

  const apply = (clientX) => {
    // Mép phải cột = mép phải panel trừ 16px đệm (p-4). Rộng = mép phải − chuột.
    const right = panel.getBoundingClientRect().right - 16;
    let w = right - clientX;
    w = Math.max(_THEME_CTRL_MIN, Math.min(_THEME_CTRL_MAX, w));
    controls.style.setProperty("--theme-ctrl-w", w + "px");
  };

  const stop = (e) => {
    if (!dragging) return;
    dragging = false;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    if (iframe) iframe.style.pointerEvents = "";
    try {
      handle.releasePointerCapture(e.pointerId);
    } catch (err) {}
    setCache(
      buildCacheKey("theme_ctrl_w"),
      controls.style.getPropertyValue("--theme-ctrl-w"),
    );
  };

  handle.addEventListener("pointerdown", (e) => {
    if (!window.matchMedia("(min-width: 768px)").matches) return;
    dragging = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    // Chặn iframe nuốt con trỏ khi kéo qua vùng preview
    if (iframe) iframe.style.pointerEvents = "none";
    handle.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  handle.addEventListener("pointermove", (e) => {
    if (dragging) apply(e.clientX);
  });
  handle.addEventListener("pointerup", stop);
  handle.addEventListener("pointercancel", stop);

  // Nhấp đúp thanh kéo → trả về mặc định 1/4
  handle.addEventListener("dblclick", () => {
    controls.style.removeProperty("--theme-ctrl-w");
    removeCache(buildCacheKey("theme_ctrl_w"));
  });
}

if (window.__cxOnReady) window.__cxOnReady(_initThemeResize);
else _initThemeResize();

function _toSlug(str) {
  return (str || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

async function _isSlugAvailable(slug) {
  try {
    const res = await fetch(
      `${CONFIG.supabase.edgeUrl}?slug=${encodeURIComponent(slug)}`,
      { headers: { Authorization: `Bearer ${CONFIG.supabase.anonKey}` } },
    );
    if (!res.ok) return true; // 404 = chưa có ai dùng
    const data = await res.json();
    // Nếu kết quả trả về là wedding này → coi như available
    return !data || data.id === WEDDING_ID;
  } catch {
    return true;
  }
}

async function _resolvePublishSlug() {
  // Nếu user đã nhập slug thủ công trong Cấu hình → giữ nguyên
  if (WEDDING_SLUG && !WEDDING_SLUG.startsWith("wedding-")) return WEDDING_SLUG;

  const groomName = (
    document.querySelector('[name="groom_name"]')?.value || ""
  ).trim();
  const brideName = (
    document.querySelector('[name="bride_name"]')?.value || ""
  ).trim();
  if (!groomName || !brideName) return WEDDING_SLUG;

  const groomSlug = _toSlug(groomName);
  const brideSlug = _toSlug(brideName);

  // Lần 1: họ và tên đầy đủ
  const fullSlug = `${groomSlug}-${brideSlug}`;
  if (await _isSlugAvailable(fullSlug)) return fullSlug;

  // Lần 2: thêm "&" ở giữa
  const andSlug = `${groomSlug}-&-${brideSlug}`;
  if (await _isSlugAvailable(andSlug)) return andSlug;

  // Lần 3: random số 2 chữ số
  const rand = Math.floor(Math.random() * 90) + 10; // 10–99
  return `${fullSlug}-${rand}`;
}

function _updateSlugPreview() {
  const input = document.getElementById("slug-input");
  const preview = document.getElementById("slug-preview");
  const row = document.getElementById("slug-preview-row");
  if (!input || !preview) return;
  const val = input.value.trim();
  if (val) {
    preview.textContent = `${window.location.origin}/${val}`;
    if (row) row.style.display = "flex";
  } else {
    if (row) row.style.display = "none";
  }
}

function copyInviteLink() {
  const preview = document.getElementById("slug-preview");
  if (!preview?.textContent) return;
  navigator.clipboard
    .writeText(preview.textContent)
    .then(() => {
      showToast("✅ Đã sao chép link thiệp!");
    })
    .catch(() => {
      showToast("❌ Không thể sao chép, hãy copy thủ công");
    });
}

// Chèn biến trộn (##Danh xưng##, ##link##) vào ô câu mẫu chia sẻ tại vị trí con trỏ
function insertShareVar(token) {
  const el = document.getElementById("share-message-template");
  if (!el) return;
  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? el.value.length;
  el.value = el.value.slice(0, start) + token + el.value.slice(end);
  const pos = start + token.length;
  el.focus();
  el.setSelectionRange(pos, pos);
  _scheduleAutoSave("config");
}

// ─── Câu mẫu chia sẻ có sẵn (10 câu trong core/constant.js) ───────────────────

let _shareTplIndex = -1; // mẫu đang chọn — để "Đổi mẫu" không lặp lại câu vừa rồi

function _pickShareTemplate() {
  const list = window.SHARE_MESSAGE_TEMPLATES || [];
  if (!list.length) return "";
  let i = Math.floor(Math.random() * list.length);
  if (list.length > 1 && i === _shareTplIndex) i = (i + 1) % list.length;
  _shareTplIndex = i;
  return list[i];
}

// Chèn 1 câu mẫu ngẫu nhiên (set trực tiếp .value → không kích hoạt oninput nên nút "Đổi mẫu" vẫn hiện)
function _fillShareTemplate() {
  const el = document.getElementById("share-message-template");
  if (!el) return;
  el.value = _pickShareTemplate();
  document.getElementById("share-template-refresh")?.classList.remove("hidden");
  el.closest("x-input, x-textarea")?.syncClearBtn?.();
  _scheduleAutoSave("config");
}

function insertShareTemplate() {
  _fillShareTemplate();
} // nút "Chèn mẫu"
function refreshShareTemplate() {
  _fillShareTemplate();
} // nút "Đổi mẫu khác"

// Gõ tay vào ô câu mẫu → ẩn nút "Đổi mẫu" (nút này chỉ dành cho luồng Chèn mẫu)
function onShareTemplateInput() {
  document.getElementById("share-template-refresh")?.classList.add("hidden");
  _scheduleAutoSave("config");
}

async function saveDraft() {
  _setActiveTab("draft");
  const ok = await saveAll({}, "Đang lưu...");
  if (ok) _setActiveTab("edit");
}

async function publishWedding() {
  // Validate form TRƯỚC khi yêu cầu đăng nhập — tránh bắt user đăng nhập rồi mới báo thiếu thông tin
  const form = document.getElementById("wedding-form");
  if (!validateForm(form)) {
    showToast("⚠️ Vui lòng điền đủ thông tin bắt buộc trước khi xuất bản");
    return;
  }
  if (!_validateFutureDates()) return;

  // Đọc lại phiên ngay tại đây: hàm này còn được gọi lại từ onAuth của popup đăng
  // nhập bên dưới, đọc cờ cũ là mở popup lần nữa thành vòng lặp.
  _syncLoginState();
  if (!IS_LOGIN) {
    // Chưa đăng nhập → hiện popup đăng nhập/tạo tài khoản ngay tại chỗ (không rời trang).
    // OAuth vẫn redirect: đính pendingPublish=1 để tự xuất bản khi quay lại.
    if (window.AuthUI) {
      const oauthRedirect = new URL(window.location.href);
      oauthRedirect.searchParams.set("pendingPublish", "1");
      AuthUI.openModal({
        title: "Sẵn sàng gửi thiệp đi chưa?",
        subtitle: "Đăng nhập để kích hoạt và chia sẻ thiệp cưới của bạn",
        oauthRedirect: oauthRedirect.toString(),
        onAuth: () => publishWedding(),
      });
    } else {
      const returnUrl = new URL(window.location.href);
      returnUrl.searchParams.set("pendingPublish", "1");
      window.location.href = `/public/account/?urlRedirect=${encodeURIComponent(returnUrl.toString())}`;
    }
    return;
  }
  _setActiveTab("publish");
  showLoading(true, "Đang chuẩn bị...");
  WEDDING_SLUG = await _resolvePublishSlug();
  // Cập nhật input slug trong panel cấu hình nếu đang mở
  const slugInput = document.getElementById("slug-input");
  if (slugInput) {
    slugInput.value = WEDDING_SLUG;
    _updateSlugPreview();
  }
  const ok = await saveAll({ is_published: true }, "Đang xuất bản...");
  if (!ok) return;

  IS_PUBLISHED = true;
  _syncAdvancedSection();
  _syncLocalOrder({ published: true }); // để thiệp hiện trong mục "Đơn hàng" của trang tài khoản

  _setActiveTab("edit");
  showPublishSuccessPopup();
}

// Popup mừng "Thiệp đã sẵn sàng" — mang tinh thần thiệp cưới (script Great Vibes +
// serif Playfair + đường viền vàng đính hình trái tim), cá nhân hoá bằng TÊN cô dâu/
// chú rể. Không dùng bố cục "bước 1-2-3" khô khan. Tự dựng DOM + style riêng (scoped).
function _ensurePublishPopupAssets() {
  if (!document.getElementById("ps-fonts")) {
    const l = document.createElement("link");
    l.id = "ps-fonts";
    l.rel = "stylesheet";
    l.href =
      "https://fonts.googleapis.com/css2?family=Great+Vibes&family=Playfair+Display:wght@600;700&display=swap";
    document.head.appendChild(l);
  }
  if (document.getElementById("ps-style")) return;
  const s = document.createElement("style");
  s.id = "ps-style";
  s.textContent = `
    #publish-success-modal{position:fixed;inset:0;z-index:300;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(61,24,34,.5);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px)}
    #publish-success-modal button,#publish-success-modal a{cursor:pointer}
    .ps-card{width:100%;max-width:384px;max-height:92vh;overflow-y:auto;background:#fffaf8;border-radius:28px;box-shadow:0 26px 64px -14px rgba(159,48,74,.4);animation:ps-in .5s cubic-bezier(.22,.9,.3,1) both}
    @keyframes ps-in{from{opacity:0;transform:translateY(18px) scale(.97)}to{opacity:1;transform:none}}
    .ps-head{position:relative;text-align:center;padding:32px 28px 20px;background:radial-gradient(120% 88% at 50% -8%,#ffe6ee 0%,#fff4f0 52%,#fffaf8 100%)}
    .ps-x{position:absolute;top:14px;right:14px;width:30px;height:30px;display:inline-flex;align-items:center;justify-content:center;border-radius:999px;color:#cc9aa6;background:rgba(255,255,255,.55);transition:.15s}
    .ps-x:hover{color:#a34a60;background:#fff}
    .ps-orn{display:flex;align-items:center;justify-content:center;gap:9px;margin-bottom:2px}
    .ps-orn i{display:block;height:1px;width:46px}
    .ps-orn i:first-child{background:linear-gradient(90deg,transparent,#d8b878)}
    .ps-orn i:last-child{background:linear-gradient(90deg,#d8b878,transparent)}
    .ps-congrats{font-family:'Great Vibes',cursive;font-size:2.7rem;line-height:1;color:#e0708a;margin:6px 0 6px}
    .ps-title{font-family:'Playfair Display',serif;font-size:1.16rem;font-weight:600;color:#7d4f5a;letter-spacing:.2px}
    .ps-couple{font-family:'Playfair Display',serif;font-size:.98rem;color:#ad7a87;margin-top:9px;display:inline-flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:center}
    .ps-sub{font-size:12.5px;color:#b98f9b;margin-top:8px}
    .ps-body{padding:4px 24px 22px}
    .ps-eyebrow{font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#cf9fac;margin:18px 4px 10px}
    .ps-link{border:1px solid #ffdbe4;background:#fff;border-radius:18px;padding:13px 14px 12px}
    .ps-link+.ps-link{margin-top:10px}
    .ps-link-label{font-size:13px;font-weight:600;color:#7d4f5a}
    .ps-link-sub{font-size:11px;color:#bb909c;margin-top:1px}
    .ps-url{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11.5px;color:#a9808d;word-break:break-all;margin-top:8px}
    .ps-acts{display:flex;gap:8px;margin-top:11px}
    .ps-soft{flex:1;height:38px;border-radius:11px;display:inline-flex;align-items:center;justify-content:center;gap:6px;font-size:12.5px;font-weight:600;border:1px solid #ffd0dc;color:#e11d48;background:#fff5f7;transition:.15s}
    .ps-soft:hover{background:#ffe4ea}
    .ps-soft i{width:14px;height:14px}
    .ps-primary{width:100%;height:50px;border-radius:15px;display:inline-flex;align-items:center;justify-content:center;gap:8px;font-size:14px;font-weight:700;color:#fff;background:linear-gradient(135deg,#fb7185,#e11d48);box-shadow:0 12px 26px -10px rgba(225,29,72,.55);transition:.15s;border:none}
    .ps-primary:hover{filter:brightness(1.05);box-shadow:0 14px 30px -10px rgba(225,29,72,.65)}
    .ps-primary i{width:16px;height:16px}
    .ps-note{font-size:12.5px;line-height:1.6;color:#a97e8b;text-align:center;margin-top:14px;padding:0 6px}
    .ps-note b{color:#7d4f5a;font-weight:600}
    .ps-done{display:block;width:100%;margin-top:16px;padding:11px;font-size:13px;font-weight:600;color:#bb909c;background:none;border:none}
    .ps-done:hover{color:#7d4f5a}
    @media (prefers-reduced-motion:reduce){.ps-card{animation:none}}`;
  document.head.appendChild(s);
}

function showPublishSuccessPopup() {
  const slug =
    WEDDING_SLUG || (WEDDING_ID ? `wedding-${WEDDING_ID.slice(0, 8)}` : "");
  if (!slug) return;
  const generalUrl = `${DOMAIN}/${slug}`;
  const groomUrl = `${generalUrl}?isGroom=true`;
  const familyOn = document.getElementById("enable_family")?.value === "true";

  const form = document.getElementById("wedding-form");
  const fd = form ? new FormData(form) : null;
  const groom = (fd?.get("groom_name") || "").toString().trim();
  const bride = (fd?.get("bride_name") || "").toString().trim();
  const esc = (s) =>
    String(s).replace(
      /[&<>"]/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
    );

  _ensurePublishPopupAssets();
  document.getElementById("publish-success-modal")?.remove();

  const HEART = (fill, size) =>
    `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="${fill}"><path d="M12 21s-6.7-4.3-9.4-7C.9 12.3.5 10.5 1 8.9A4.5 4.5 0 0 1 8.5 6.9l.5.5.5-.5a4.5 4.5 0 0 1 7.5 2c.5 1.6.1 3.4-1.6 5.1C18.7 16.7 12 21 12 21z"/></svg>`;

  // Có đủ tên → hàng "Chú rể ♥ Cô dâu"; thiếu → câu dẫn nhẹ nhàng.
  const coupleHtml =
    groom && bride
      ? `<div class="ps-couple">${esc(groom)} ${HEART("#fb7185", 13)} ${esc(bride)}</div>`
      : `<p class="ps-sub">Giờ bạn có thể trao thiệp đến những người thương yêu</p>`;

  const linkRow = (label, sub, url) => `
    <div class="ps-link">
      <div class="ps-link-label">${label}</div>
      <div class="ps-link-sub">${sub}</div>
      <div class="ps-url">${url}</div>
      <div class="ps-acts">
        <button type="button" class="ps-soft" data-ps-open="${url}"><i data-lucide="eye"></i>Xem thử</button>
        <button type="button" class="ps-soft" data-ps-copy="${url}"><i data-lucide="copy"></i>Sao chép</button>
      </div>
    </div>`;

  const linksHtml = familyOn
    ? linkRow("Thiệp nhà gái", "Ưu tiên lễ · tiệc nhà gái", generalUrl) +
      linkRow("Thiệp nhà trai", "Ưu tiên lễ · tiệc nhà trai", groomUrl)
    : linkRow("Link thiệp cưới", "Gửi cho tất cả khách mời", generalUrl);

  const modal = document.createElement("div");
  modal.id = "publish-success-modal";
  modal.innerHTML = `
    <div class="ps-card">
      <div class="ps-head">
        <button type="button" data-ps-close class="ps-x"><i data-lucide="x" style="width:18px;height:18px"></i></button>
        <div class="ps-orn"><i></i>${HEART("#c9a86a", 15)}<i></i></div>
        <div class="ps-congrats">Chúc mừng</div>
        <div class="ps-title">Thiệp cưới đã sẵn sàng</div>
        ${coupleHtml}
      </div>
      <div class="ps-body">
        <div class="ps-eyebrow">Chia sẻ thiệp</div>
        ${linksHtml}

        <div class="ps-eyebrow">Khách mời &amp; lời chúc</div>
        <button type="button" class="ps-primary" data-ps-guests><i data-lucide="users"></i>Quản lý khách mời<i data-lucide="arrow-right"></i></button>
        <p class="ps-note">Gửi link cho <b>người thân, bạn bè</b> để họ chung vui và <b>gửi lời chúc</b> đến hai bạn.</p>

        <button type="button" class="ps-done" data-ps-close>Hoàn tất</button>
      </div>
    </div>`;

  const close = () => {
    document.removeEventListener("keydown", onKey, true);
    modal.remove();
  };
  const onKey = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  };

  modal.addEventListener("click", (e) => {
    if (e.target === modal) return close(); // bấm nền tối = đóng
    if (e.target.closest("[data-ps-close]")) return close();
    if (e.target.closest("[data-ps-guests]")) {
      close();
      switchTab("guests");
      return;
    }
    const openBtn = e.target.closest("[data-ps-open]");
    if (openBtn) {
      window.open(openBtn.getAttribute("data-ps-open"), "_blank");
      return;
    }
    const copyBtn = e.target.closest("[data-ps-copy]");
    if (copyBtn) {
      navigator.clipboard
        .writeText(copyBtn.getAttribute("data-ps-copy"))
        .then(() => showToast("✅ Đã sao chép link thiệp!"))
        .catch(() => showToast("❌ Không thể sao chép, hãy copy thủ công"));
    }
  });

  document.body.appendChild(modal);
  document.addEventListener("keydown", onKey, true);
  if (window.lucide) lucide.createIcons();
}

// Ghi/cập nhật một đơn vào cache để trang tài khoản hiển thị thiệp.
// - Đã đăng nhập → key theo email; khách → key "guest" (đăng nhập sau sẽ tự gộp).
// - published=true → status "pending" (đã xuất bản, dùng thử, CHƯA thanh toán);
//   ngược lại là "draft" (bản nháp). Chỉ khi thanh toán xong (đồng bộ từ DB) mới
//   thành "completed" — xem _mergeWeddings ở trang tài khoản.
// Trùng manage_id thì cập nhật, chưa có thì thêm. Không tạo đơn rỗng, không hạ cấp completed.
function _syncLocalOrder({ published = false } = {}) {
  const user = getCurrentUser();
  const key = buildCacheKey("orders", user?.email || "guest");

  const form = document.getElementById("wedding-form");
  const fd = form ? new FormData(form) : null;
  const groomName = (fd?.get("groom_name") || "").toString().trim();
  const brideName = (fd?.get("bride_name") || "").toString().trim();

  // Bản nháp chưa có tên cô dâu/chú rể → chưa tạo đơn (tránh đơn trống lúc mới mở form).
  if (!published && !groomName && !brideName) return;

  const templateName =
    sessionStorage.getItem("draft_template_name") ||
    (WEDDING_THEME || "")
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ") ||
    "Thiệp Cưới";

  const orders = getCache(key, []);

  const idx = orders.findIndex((o) => o.manage_id === WEDDING_ID);
  const base = idx >= 0 ? orders[idx] : {};
  // Đã thanh toán (completed) thì giữ nguyên. Xuất bản = "pending" (chưa thanh toán),
  // không lùi về draft khi auto-save bản nháp.
  const status =
    base.status === "completed" ? "completed" : published ? "pending" : "draft";
  const order = {
    ...base,
    id: base.id || "CX" + Date.now().toString().slice(-6),
    date: base.date || new Date().toISOString(),
    manage_id: WEDDING_ID,
    theme: WEDDING_THEME,
    templateName,
    groomName,
    brideName,
    status,
  };

  if (idx >= 0) orders[idx] = order;
  else orders.push(order);

  setCache(key, orders);
}
