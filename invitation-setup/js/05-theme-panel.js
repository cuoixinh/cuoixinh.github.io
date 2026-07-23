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
    // Coloris định vị xong trong chính handler click của nó → chờ hết frame
    // rồi mới căn lại, nếu không sẽ bị nó ghi đè.
    ["click", "focus"].forEach((evt) =>
      el.addEventListener(evt, () => {
        _openChip = el;
        requestAnimationFrame(() => _clampPickerToChip(el));
      }),
    );
  });

  // Chip màu của bảng chỉnh CHI TIẾT 1 dòng (dùng chung Coloris qua .theme-color-input)
  const lineColor = document.getElementById("cx-line-color");
  if (lineColor) {
    lineColor.addEventListener("input", () => onLineColorChange());
    ["click", "focus"].forEach((evt) =>
      lineColor.addEventListener(evt, () => {
        _openChip = lineColor;
        requestAnimationFrame(() => _clampPickerToChip(lineColor));
      }),
    );
  }

  // Xoay máy / đổi kích thước khi đang mở thì căn lại
  window.addEventListener("resize", () => {
    const picker = document.getElementById("clr-picker");
    if (picker && picker.classList.contains("clr-open")) {
      _clampPickerToChip(_openChip);
    }
  });
}

let _openChip = null;

// Coloris chống tràn ngang bằng cách DÓNG PHẢI popup vào ô input — công thức
// đó giả định input rộng cỡ popup. Chip của ta chỉ 32px nên popup bị đẩy văng
// ra ngoài mép trái. Tự căn: lấy tâm chip làm gốc rồi kẹp trong màn hình.
// Chiều dọc để nguyên cho Coloris tự lật lên, phần đó nó tính đúng.
function _clampPickerToChip(chipEl) {
  const picker = document.getElementById("clr-picker");
  if (!picker || !chipEl) return;
  const chip = chipEl.getBoundingClientRect();
  const w = picker.offsetWidth;
  const vw = document.documentElement.clientWidth;
  const gap = 8;
  const left = Math.max(
    gap,
    Math.min(chip.left + chip.width / 2 - w / 2, vw - w - gap),
  );
  picker.style.left = `${left}px`;
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

  // Mở tab Giao diện → về nhóm chỉnh chung, đóng bảng chỉnh 1 dòng (nếu đang mở)
  closeLineEditor();
  _initEditHint();

  // Icon (reset) trong thanh chỉnh
  if (window.lucide) lucide.createIcons();
}

function onThemeSettingChange() {
  const hf = document.getElementById("theme-heading-font");
  const bf = document.getElementById("theme-body-font");

  // Giữ lại ghi đè từng dòng (text_overrides) — nếu không sẽ bị xoá khi dựng lại object.
  const overrides = _themeSetting.text_overrides;

  _themeSetting = {
    heading_font: hf ? hf.value : "",
    body_font: bf ? bf.value : "",
  };
  THEME_COLOR_FIELDS.forEach(({ id, key }) => {
    _themeSetting[key] = _chipValue(id);
  });
  if (overrides && Object.keys(overrides).length)
    _themeSetting.text_overrides = overrides;

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

// Nhận tín hiệu click text từ iframe tab Giao diện (đúng nguồn mới nhận).
window.addEventListener("message", (ev) => {
  const d = ev.data;
  if (!d || d.type !== "cx-text-pick") return;
  const iframe = document.getElementById("theme-preview-iframe");
  if (iframe && ev.source === iframe.contentWindow) _openLineEditor(d);
});

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
  document.getElementById("theme-edit-hint")?.classList.add("hidden");
  document.getElementById("theme-line-editor")?.classList.remove("hidden");

  // Đổi giữa nhóm control CHỮ và ẢNH
  document
    .getElementById("cx-le-text")
    ?.classList.toggle("hidden", _lineIsImage);
  document
    .getElementById("cx-le-image")
    ?.classList.toggle("hidden", !_lineIsImage);

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
}

function _openTextEditor(msg, c, ov) {
  _lineComputed = c;
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
  _setSampleColor(""); // "ảnh" dùng màu mặc định
}

function closeLineEditor() {
  document.getElementById("theme-line-editor")?.classList.add("hidden");
  document.getElementById("theme-main-controls")?.classList.remove("hidden");
  _initEditHint();
  _lineIframe()?.contentWindow?.postMessage({ type: "cx-clear-pick" }, "*");
  _lineSel = null;
}
window.closeLineEditor = closeLineEditor;

function _lineOverride() {
  if (!_themeSetting.text_overrides) _themeSetting.text_overrides = {};
  if (!_themeSetting.text_overrides[_lineSel])
    _themeSetting.text_overrides[_lineSel] = {};
  return _themeSetting.text_overrides[_lineSel];
}

// Sau mỗi thay đổi 1 dòng: đánh dấu chưa lưu + áp lại vào iframe preview.
function _applyLine() {
  _setDirty(true, "theme");
  _lineIframe()?.contentWindow?.applyThemeSetting?.(_themeSetting);
}

function onLineFontChange() {
  if (!_lineSel) return;
  const v = document.getElementById("cx-line-font")?.value || "";
  const o = _lineOverride();
  if (v) o.font = v;
  else delete o.font;
  _applyLine();
}
window.onLineFontChange = onLineFontChange;

function onLineSizeChange() {
  if (!_lineSel) return;
  const v = parseInt(document.getElementById("cx-line-size")?.value, 10);
  const o = _lineOverride();
  if (v > 0) o.size = v;
  else delete o.size;
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
  _setSampleColor(v); // chữ mẫu đổi màu theo live
  _applyLine();
}
window.onLineColorChange = onLineColorChange;

// Tô chữ mẫu "Đang chỉnh: ..." bằng màu đang chọn ("" → trả về màu mặc định).
function _setSampleColor(color) {
  const s = document.getElementById("cx-le-sample");
  if (s) s.style.color = color || "";
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
  let dismissed = false;
  try {
    dismissed = localStorage.getItem("cx_theme_edit_hint") === "1";
  } catch (e) {}
  hint.classList.toggle("hidden", dismissed || lineOpen);
}

function dismissEditHint() {
  document.getElementById("theme-edit-hint")?.classList.add("hidden");
  try {
    localStorage.setItem("cx_theme_edit_hint", "1");
  } catch (e) {}
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
  try {
    const saved = localStorage.getItem("cx_theme_ctrl_w");
    if (saved) controls.style.setProperty("--theme-ctrl-w", saved);
  } catch (e) {}

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
    try {
      localStorage.setItem(
        "cx_theme_ctrl_w",
        controls.style.getPropertyValue("--theme-ctrl-w"),
      );
    } catch (err) {}
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
    try {
      localStorage.removeItem("cx_theme_ctrl_w");
    } catch (e) {}
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

  if (!getCurrentUser()) {
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

// Ghi/cập nhật một đơn vào localStorage để trang tài khoản hiển thị thiệp.
// - Đã đăng nhập → key `orders_<email>`; khách → `guestOrders` (đăng nhập sau sẽ tự gộp).
// - published=true → status "pending" (đã xuất bản, dùng thử, CHƯA thanh toán);
//   ngược lại là "draft" (bản nháp). Chỉ khi thanh toán xong (đồng bộ từ DB) mới
//   thành "completed" — xem _mergeWeddings ở trang tài khoản.
// Trùng manage_id thì cập nhật, chưa có thì thêm. Không tạo đơn rỗng, không hạ cấp completed.
function _syncLocalOrder({ published = false } = {}) {
  const user = getCurrentUser();
  const key = user?.email ? "orders_" + user.email : "guestOrders";

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

  let orders = [];
  try {
    orders = JSON.parse(localStorage.getItem(key) || "[]");
  } catch (e) {}

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

  try {
    localStorage.setItem(key, JSON.stringify(orders));
  } catch (e) {}
}
