// Màn Giao diện: bộ màu thiệp, chỉnh riêng từng phần tử (Coloris) và câu
// mẫu chia sẻ.
//
// Tách từ index.js (dòng 816–1384 bản gốc). Thứ tự nạp khai báo ở loader.js.

// ============= THEME (GIAO DIỆN) PANEL =============


// Ô nào người dùng đã đặt riêng vẫn giữ nguyên (_initThemePanel ưu tiên
// _themeSetting), chỉ phần "mặc định của mẫu" được sửa cho đúng.
let _themeFrameWatched = false;

// Bảng màu GỢI Ý trong bộ chọn màu (Coloris) — mỗi mẫu tự khai
// `CX_THEME.swatches` để khách chỉnh riêng một phần tử thì thấy ngay tông của
// mẫu mình đang dùng. Đọc qua iframe xem trước (cùng origin), mà iframe nạp xong
// SAU khi tab mở nên lần đầu còn rỗng: nhớ vào cache, rồi _watchThemeFrame()
// dựng lại khi giá trị về.
let _themeSwatchCache = null;

function _themeSwatches() {
  const win = document.getElementById("theme-preview-iframe")?.contentWindow;
  const sw = win && win.CX_THEME && win.CX_THEME.swatches;
  if (sw) _themeSwatchCache = sw;
  return _themeSwatchCache;
}

function _watchThemeFrame() {
  if (_themeFrameWatched) return;
  const iframe = document.getElementById("theme-preview-iframe");
  if (!iframe) return;
  _themeFrameWatched = true;
  iframe.addEventListener("load", () => {
    const before = _themeSwatchCache;
    const sw = _themeSwatches();
    // So theo GIÁ TRỊ: mỗi lần nạp lại iframe sinh một mảng mới, so theo tham
    // chiếu thì lần nạp nào cũng thành "đổi bảng màu" → dựng lại bảng chỉnh và
    // đóng mất bảng con đang mở (Hộp mừng cưới…).
    if (!sw || JSON.stringify(sw) === JSON.stringify(before)) return;
    // Coloris chỉ nhận swatches lúc khởi tạo → gọi lại để đổi bảng màu gợi ý.
    if (typeof Coloris !== "undefined") Coloris({ swatches: sw });
    _initThemePanel();
  });
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

// ── BỘ MÀU ─────────────────────────────────────────────────────────────────
// Một bộ = cả bảng màu thiệp (chữ + nền + vạch kẻ + màn bìa + hoạ tiết), lưu ở
// theme_setting.palette. Danh mục ở core/helpers/card-palette-helper.js; runtime
// áp bằng cách đổ vào token --cx-* (theme-setting-helper.js).
//
// Mục đầu để value RỖNG = "Mặc định" → xoá `palette`, thiệp về đúng màu gốc của
// mẫu (đã khai sẵn ở :root của theme.css nên không phải áp gì).
const PALETTE_DEFAULT_LABEL = "Mặc định";

function _fillPaletteCombo() {
  const el = document.getElementById("theme-palette");
  if (!el || !el.setOptions || !window.CX_PALETTES) return;
  el.setOptions([
    { value: "", label: PALETTE_DEFAULT_LABEL, swatch: _themePaletteSwatch() },
    ...window.CX_PALETTES.map((p) => ({
      value: p.id,
      label: p.name,
      swatch: window.cxPaletteSwatch(p),
    })),
  ]);
}

// Giọt màu cho mục "Mặc định" — lấy từ chính bản khai của mẫu đang mở
// (CX_THEME.palette), để khách thấy ngay mình đang rời khỏi tông nào.
function _themePaletteSwatch() {
  const p = _themeCardPalette();
  return p ? window.cxPaletteSwatch(p) : "";
}

// Bảng màu GỐC của mẫu, đọc qua iframe xem trước như cách _themeSwatches() làm.
function _themeCardPalette() {
  const win = document.getElementById("theme-preview-iframe")?.contentWindow;
  const p = win && win.CX_THEME && win.CX_THEME.palette;
  if (p) _themeCardPaletteCache = p;
  return _themeCardPaletteCache;
}

let _themeCardPaletteCache = null;

// Bộ màu đang chọn (đã lưu).
function _currentPalette() {
  const p = _themeSetting.palette;
  return p && typeof p === "object" ? p : null;
}

// Mức 50 = đúng bộ màu như danh mục khai. Không lưu `strength` khi ở mức này để
// thiệp cũ và thiệp mới chọn bộ vẫn ra cùng một JSON.
const PALETTE_STRENGTH_DEFAULT = 50;

function _paletteStrength() {
  const v = Number(_currentPalette()?.strength);
  return Number.isFinite(v)
    ? Math.max(0, Math.min(100, Math.round(v)))
    : PALETTE_STRENGTH_DEFAULT;
}

// Thanh kéo chỉ có nghĩa khi ĐANG chọn một bộ: "Mặc định" là màu gốc của mẫu,
// làm đậm nó lên là sửa mẫu chứ không phải chỉnh bộ màu.
function _syncPaletteStrength() {
  const el = document.getElementById("theme-palette-strength");
  if (!el) return;
  const on = !!_currentPalette();
  el.value = _paletteStrength();
  el.disabled = !on;
  window.CXProgress?.attach(el)?.classList.toggle("is-off", !on);
}

function _applyThemeToFrame() {
  const iframe = document.getElementById("theme-preview-iframe");
  iframe?.contentWindow?.applyThemeSetting?.(_themeSetting);
}

function onCardPaletteChange() {
  const el = document.getElementById("theme-palette");
  const id = el ? el.value : "";
  const val = id ? window.cxPaletteValue(id) : null;

  // Đổi bộ thì GIỮ độ đậm đang kéo: khách hay so vài bộ ở cùng một mức đậm.
  const strength = _paletteStrength();
  if (val) {
    if (strength !== PALETTE_STRENGTH_DEFAULT) val.strength = strength;
    _themeSetting.palette = val;
  } else {
    delete _themeSetting.palette;
  }

  _syncPaletteStrength();
  _setDirty(true, "theme");
  _applyThemeToFrame();
}

window.onCardPaletteChange = onCardPaletteChange;

// Kéo: áp ngay vào khung xem trước (rẻ — chỉ ghi lại một thẻ <style>). Đánh dấu
// "chưa lưu" để tới lúc thả tay, đừng hẹn lại bộ đếm tải lại khung ở mỗi nhịp.
function onPaletteStrengthInput() {
  const el = document.getElementById("theme-palette-strength");
  const p = _currentPalette();
  if (!el || !p) return;
  const v = Number(el.value);
  if (v === PALETTE_STRENGTH_DEFAULT) delete p.strength;
  else p.strength = v;
  _applyThemeToFrame();
}

window.onPaletteStrengthInput = onPaletteStrengthInput;

function onPaletteStrengthCommit() {
  if (_currentPalette()) _setDirty(true, "theme");
}

window.onPaletteStrengthCommit = onPaletteStrengthCommit;

function _initColorPickers() {
  // Thư viện nạp từ CDN — hỏng mạng thì chip vẫn giữ giá trị, chỉ không mở
  // được bảng chọn; phần còn lại của tab vẫn dùng bình thường.
  if (typeof Coloris === "undefined") return;

  Coloris({
    el: ".theme-color-input",
    themeMode: "light",
    theme: "large",
    alpha: false,
    format: "hex",
    focusInput: false,
    selectInput: false,
    margin: 16, // mặc định 2px, sát chip quá
    swatches: _themeSwatches() || [],
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

  // Chip màu của bảng chỉnh CHI TIẾT 1 dòng (dùng chung Coloris qua .theme-color-input).
  // Ô thứ hai chỉ dùng khi bật chuyển màu — nó là màu CUỐI của dải.
  [
    ["cx-line-color", () => onLineColorChange()],
    ["cx-line-color2", () => onLineColor2Change()],
  ].forEach(([id, fn]) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("input", fn);
    el.addEventListener("click", () => {
      _openChip = el;
      _alignPickerToChip(el);
    });
  });

  // Chip màu của bảng ĐIỀU CHỈNH THÀNH PHẦN — mỗi ô phục vụ tuỳ chọn nào là do
  // _fillElColorSlot gán (data-opt-id), nên ở đây chỉ cần nối sự kiện.
  for (let i = 0; i < EL_COLOR_SLOTS; i++) {
    const chip = document.getElementById("cx-el-color-" + i);
    if (!chip) continue;
    chip.addEventListener("input", () => onElementColorInput(i, false));
    chip.addEventListener("change", () => onElementColorInput(i, true));
    chip.addEventListener("click", () => {
      _openChip = chip;
      _alignPickerToChip(chip);
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

// Coloris dóng phải popup vào ô input, mà chip của ta chỉ 32px nên popup lệch.
// Cách chữa: dời TẠM chính ô input (position:relative) TRƯỚC khi Coloris đo, rồi
// trả về chỗ cũ trong requestAnimationFrame. Không được dời popup sau khi mở —
// Coloris đã cache toạ độ vùng màu, dời sau là kéo ra màu lệch con trỏ.
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
  _watchThemeFrame();

  if (!_themePanelReady) {
    _initColorPickers();
    _themePanelReady = true;
  }

  // <x-combobox>.value tự đồng bộ nhãn khi gán (kể cả lúc nạp thiệp / reset).
  _fillPaletteCombo();
  const pal = document.getElementById("theme-palette");
  if (pal) pal.value = _currentPalette()?.id || "";
  _syncPaletteStrength();

  // Mở tab Giao diện → về nhóm chỉnh chung, đóng bảng chỉnh 1 dòng / thêm văn
  // bản / trang trí. Phải tự bật lại nhóm chỉnh chung: closeLineEditor() thoát
  // sớm khi bảng chỉnh dòng đang đóng, nên rời tab lúc đang mở một bảng con là
  // quay lại thấy bảng trống.
  document.getElementById("theme-addtext-panel")?.classList.add("hidden");
  document.getElementById("theme-decor-panel")?.classList.add("hidden");
  document.getElementById("theme-elements-panel")?.classList.add("hidden");
  document.getElementById("theme-gift-panel")?.classList.add("hidden");
  _hideElementEditor();
  closeLineEditor();
  document.getElementById("theme-main-controls")?.classList.remove("hidden");
  _initEditHint();

  // Icon (reset) trong thanh chỉnh
  if (window.lucide) lucide.createIcons();
}

// Bỏ HẾT tuỳ chỉnh của thiệp: bộ màu, chỉnh riêng từng dòng chữ, khối văn bản,
// hoạ tiết, thành phần, hộp mừng cưới. Nạp lại iframe là cách chắc chắn nhất để gỡ mọi thứ đã
// bơm vào — không phải gỡ ngược từng loại một.
function resetThemeSetting() {
  _themeSetting = {};
  _initThemePanel();
  _setDirty(true, "theme");

  // Reload iframe để xoá hết override, quay về mặc định của theme
  _reloadThemeFrame();
}

window.resetThemeSetting = resetThemeSetting;

// ── CHỈNH CHI TIẾT TỪNG DÒNG CHỮ ───────────────────────────────────────────
// Runtime trong iframe (theme-setting-helper.js) gửi 'cx-text-pick' khi click 1
// dòng chữ → mở bảng riêng ở #theme-line-editor. Mỗi thay đổi ghi vào
// _themeSetting.text_overrides[selector] rồi áp lại vào iframe preview.

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
  if (d.type === "cx-text-pick") {
    // Đang mở bảng chọn hoạ tiết: cú bấm trên thiệp (kể cả trúng chữ) không được
    // kéo sang bảng chỉnh chữ — người dùng đang ở giữa việc thêm hoạ tiết.
    const decor = document.getElementById("theme-decor-panel");
    if (decor && !decor.classList.contains("hidden")) return;
    _openLineEditor(d);
  } else if (d.type === "cx-hide") hidePickedElement(d.selector);
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
  } else if (d.type === "cx-elements-changed") {
    // Thành phần vừa thả / kéo / phóng to / xoá → lưu, và nếu bảng điều chỉnh
    // đang mở cho chính nó thì kéo thanh trượt theo (chụm 2 ngón trên thiệp).
    _themeSetting.elements = Array.isArray(d.elements) ? d.elements : [];
    // Trình phát của theme đã chuyển thành thành phần → nhớ lại, không thì lần
    // mở sau lại dựng thêm một cái nữa dù người dùng đã xoá.
    if (d.seeded) _themeSetting.music_seeded = true;
    _setDirty(true, "theme");
    _syncElWidthFromCard();
  } else if (d.type === "cx-element-pick") {
    openElementEditor(d);
  } else if (d.type === "cx-element-close") {
    closeElementEditor();
  } else if (d.type === "cx-gift-reload") {
    // Hộp gốc của mẫu đã bị bấm mở, muốn về "Mặc định" thì chỉ còn cách dựng lại
    // thiệp từ đầu (core/helpers/gift-box-helper.js).
    _reloadThemeFrame("gift");
  } else if (d.type === "cx-text-size") {
    // Vừa chụm 2 ngón trên khối văn bản trong thiệp → cỡ chữ mới.
    _setTextSizeFromCard(d.selector, d.size);
  }
});

// Cỡ chữ chụm được ghi vào text_overrides y như khi gõ ở ô "Cỡ chữ"; bảng chỉnh
// đang mở đúng khối đó thì đồng bộ luôn ô nhập cho khỏi lệch.
function _setTextSizeFromCard(selector, size) {
  const n = parseInt(size, 10);
  if (!selector || !(n > 0)) return;
  if (!_themeSetting.text_overrides) _themeSetting.text_overrides = {};
  if (!_themeSetting.text_overrides[selector])
    _themeSetting.text_overrides[selector] = {};
  _themeSetting.text_overrides[selector].size = n;
  if (_lineSel === selector) {
    const el = document.getElementById("cx-line-size");
    if (el) el.value = n;
    _syncSampleStyle();
  }
  _setDirty(true, "theme");
  _lineIframe()?.contentWindow?.applyThemeSetting?.(_themeSetting);
}

// ─── Bỏ chọn hoạ tiết / thành phần khi bấm ra ngoài thiệp ────────────────────
// pointerdown ở trang cha không lọt vào iframe nên runtime không tự biết là mình
// đã "focus out" — phải báo sang, không thì bộ nút (xoá, xoay…) còn treo trên
// hoa/widget vừa thao tác. "all" = bỏ chọn cả thành phần; mặc định chỉ hoạ tiết,
// vì thành phần đang mở bảng điều chỉnh riêng thì phải giữ chọn.
function _blurCards(what) {
  _lineIframe()?.contentWindow?.postMessage({ type: "cx-blur", what }, "*");
}

// Bắt ở pha capture: nút trong bảng chọn có stopPropagation nên nghe ở pha nổi
// bọt sẽ hụt mất cú bấm.
function _initCardBlur() {
  document.addEventListener(
    "pointerdown",
    () => {
      if (document.getElementById("theme-panel")?.classList.contains("hidden"))
        return;
      _blurCards();
    },
    true,
  );
}

// ─── Thêm văn bản (bảng chọn mẫu riêng) ──────────────────────────────────────
// Mở như bảng chỉnh 1 dòng: chiếm chỗ nhóm chỉnh chung (ẩn phông/màu) để chỉ còn
// các mẫu khối — tránh rối khi đang kéo-thả vào thiệp.
function openAddTextPanel() {
  document.getElementById("theme-line-editor")?.classList.add("hidden");
  document.getElementById("theme-decor-panel")?.classList.add("hidden");
  document.getElementById("theme-main-controls")?.classList.add("hidden");
  document.getElementById("theme-edit-hint")?.classList.add("hidden");
  document.getElementById("theme-elements-panel")?.classList.add("hidden");
  document.getElementById("theme-gift-panel")?.classList.add("hidden");
  _hideElementEditor();
  document.getElementById("theme-addtext-panel")?.classList.remove("hidden");
  _resetCtrlScroll();
  _renderTextPresets();
  if (window.lucide) lucide.createIcons();
}
window.openAddTextPanel = openAddTextPanel;

// Ô mẫu văn bản: dựng bằng chính CX_TEXT_PRESET_BUILD mà runtime dùng, thu nhỏ
// vừa ô (dùng chung _fitElPreviews của bảng Thành phần) nên xem trước = kết quả
// thật. Dựng một lần rồi thôi, mở lại chỉ tính lại tỉ lệ.
// Bề ngang quy chiếu khi dựng: hẹp thì cụm chữ ít bị thu nhỏ lúc nhét vừa ô
// vuông → chữ xem trước to, dễ đọc. Kèm theo là chữ `preview` ngắn của mỗi mẫu.
const TPL_PREVIEW_CARD_W = 150; // px

function _renderTextPresets() {
  const box = document.getElementById("cx-addtext-palette");
  if (!box) return;
  if (box.dataset.rendered === "1") {
    _fitElPreviews(box);
    return;
  }
  // Xem trước nằm ở trang chỉnh (ngoài iframe) nên CSS mẫu phải có ở đây nữa.
  window.CX_TEXT_PRESET_ENSURE_STYLE?.(document);
  const presets = window.CX_TEXT_PRESETS || [];
  box.textContent = "";
  presets.forEach((def) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "cx-pal-item cx-pal-item-prev";
    btn.title =
      def.name + (def.desc ? " — " + def.desc : "") + " (kéo vào thiệp)";

    const prev = document.createElement("span");
    prev.className = "cx-pal-prev";
    const stage = document.createElement("span");
    stage.className = "cx-pal-stage";
    stage.style.width = TPL_PREVIEW_CARD_W + "px";
    const short = {};
    def.parts.forEach((p) => (short[p.key] = p.preview || p.def));
    stage.appendChild(window.CX_TEXT_PRESET_BUILD(def, short, null, true));
    prev.appendChild(stage);
    btn.appendChild(prev);

    // Không có nhãn tên: bố cục của mẫu đã tự nói lên nó là gì, tên/mô tả để ở
    // title (tooltip) cho ô xem trước được trọn chỗ.
    const grip = document.createElement("i");
    grip.setAttribute("data-lucide", "grip-vertical");
    grip.className = "cx-pal-grip !w-[14px] !h-[14px]";
    btn.appendChild(grip);

    btn.addEventListener("pointerdown", (e) =>
      startPaletteDrag(e, "preset:" + def.id),
    );
    box.appendChild(btn);
  });
  box.dataset.rendered = "1";
  // Panel vừa hiện xong mới đo được kích thước ô → hoãn một nhịp.
  requestAnimationFrame(() => {
    _fitElPreviews(box);
    _resetCtrlScroll();
  });
}

function closeAddTextPanel() {
  document.getElementById("theme-addtext-panel")?.classList.add("hidden");
  document.getElementById("theme-main-controls")?.classList.remove("hidden");
  _resetCtrlScroll();
  _initEditHint();
}
window.closeAddTextPanel = closeAddTextPanel;

// ─── Kéo mẫu từ bảng chọn ra thiệp (dùng chung cho Văn bản / Trang trí / Thành phần) ──
// Quy tắc: CHỈ kéo mới thêm được — bấm tại chỗ không làm gì; và phải kéo RA KHỎI
// bảng chọn rồi nhả TRÊN thiệp mới tính là thả. Còn ở trong bảng thì cử chỉ kéo
// dùng để cuộn danh sách (ô mẫu đặt touch-action:none nên trình duyệt không tự
// cuộn giúp). Mỗi bảng chỉ khai báo 3 việc riêng: over / cancel / drop.
const PAL_DRAG_MIN = 6; // px, dưới ngưỡng này coi như chưa kéo

let _palDrag = null;

function _inThemeControls(x, y) {
  const box = document.getElementById("theme-controls");
  if (!box) return false;
  const r = box.getBoundingClientRect();
  return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
}

// setPointerCapture trên nút để trang cha vẫn nhận pointermove kể cả khi con trỏ
// đã ở trên iframe; tắt luôn pointer-events của iframe vì lý do đó.
function _startPalDrag(e, hooks) {
  if (e.button != null && e.button !== 0) return; // chỉ chuột trái
  const btn = e.currentTarget;
  e.preventDefault();
  try {
    btn.setPointerCapture(e.pointerId);
  } catch (err) {}
  const iframe = _lineIframe();
  if (iframe) iframe.style.pointerEvents = "none";
  // Khoảng lệch từ con trỏ tới góc trên-trái ô mẫu → bóng mờ nằm ĐÚNG chỗ vừa
  // "nhấc" lên, con trỏ giữ nguyên điểm bấm trên ô.
  const r = btn.getBoundingClientRect();
  const scroller = btn.closest(".cx-sheet-body");
  _palDrag = {
    hooks,
    btn,
    iframe,
    x0: e.clientX,
    y0: e.clientY,
    offX: e.clientX - r.left,
    offY: e.clientY - r.top,
    scroller,
    top0: scroller ? scroller.scrollTop : 0,
    out: false, // đã ra khỏi bảng chọn ít nhất một lần
    ghost: null,
    over: false, // con trỏ đang ở trên thiệp
  };
  const move = (ev) => _palDragMove(ev);
  const up = (ev) => {
    btn.removeEventListener("pointermove", move);
    btn.removeEventListener("pointerup", up);
    btn.removeEventListener("pointercancel", up);
    _palDragEnd(ev);
  };
  btn.addEventListener("pointermove", move);
  btn.addEventListener("pointerup", up);
  btn.addEventListener("pointercancel", up);
}

function _palDragMove(ev) {
  const d = _palDrag;
  if (!d) return;
  // Chưa rời bảng: kéo dọc = cuộn danh sách, chưa dựng bóng mờ.
  if (!d.out) {
    if (_inThemeControls(ev.clientX, ev.clientY)) {
      if (d.scroller) d.scroller.scrollTop = d.top0 - (ev.clientY - d.y0);
      return;
    }
    if (Math.hypot(ev.clientX - d.x0, ev.clientY - d.y0) < PAL_DRAG_MIN) return;
    d.out = true;
    // Bóng mờ = BẢN SAO của chính ô mẫu đang kéo (mờ 50%) cho dễ nhận ra.
    d.ghost = d.btn.cloneNode(true);
    d.ghost.removeAttribute("id");
    d.ghost.classList.add("cx-drag-ghost");
    d.ghost.style.width = `${d.btn.offsetWidth}px`;
    // Đặt sẵn vị trí trước khi gắn vào DOM → hiện ngay tại con trỏ, không nhảy.
    d.ghost.style.left = `${ev.clientX - d.offX}px`;
    d.ghost.style.top = `${ev.clientY - d.offY}px`;
    document.body.appendChild(d.ghost);
  }
  // Bám con trỏ theo đúng điểm đã bấm; kẹp ngang cho khỏi lòi ra mép màn hình.
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
    d.hooks.onOver?.(iframe, ev.clientX - r.left, ev.clientY - r.top);
  } else if (d.over) {
    d.over = false;
    d.hooks.onCancel?.(iframe);
  }
}

function _palDragEnd(ev) {
  const d = _palDrag;
  _palDrag = null;
  if (!d) return;
  d.ghost?.remove();
  if (d.iframe) d.iframe.style.pointerEvents = ""; // khôi phục tương tác iframe
  const iframe = d.iframe || _lineIframe();
  // Nhả tay trong bảng chọn (bấm tại chỗ, hoặc kéo rồi quay lại) → KHÔNG thêm gì,
  // chỉ dọn dấu vết. Chỉ nhả TRÊN thiệp mới tính là thả.
  if (!d.out || !d.over || !iframe) {
    d.hooks.onCancel?.(iframe);
    return;
  }
  const r = iframe.getBoundingClientRect();
  d.hooks.onDrop(iframe, ev.clientX - r.left, ev.clientY - r.top);
}

// Mẫu văn bản: lúc rê trên thiệp runtime vẽ vạch chèn theo toạ độ Y.
function startPaletteDrag(e, type) {
  _startPalDrag(e, {
    onOver: (iframe, x, y) =>
      iframe.contentWindow?.postMessage({ type: "cx-drag-over", y }, "*"),
    onCancel: (iframe) =>
      iframe?.contentWindow?.postMessage({ type: "cx-drag-cancel" }, "*"),
    onDrop: (iframe, x, y) => {
      closeAddTextPanel();
      _setDirty(true, "theme");
      iframe.contentWindow?.postMessage(
        { type: "cx-drop", blockType: type, y },
        "*",
      );
    },
  });
}
window.startPaletteDrag = startPaletteDrag;

// ─── Trang trí: bảng chọn hoa (nạp từ kho ảnh mẫu) ──────────────────────────
// Danh sách lấy ở /assets/flowers/manifest.json — file do tab "Ảnh mẫu" bên
// /admin ghi ra; trang tĩnh không list được thư mục qua HTTP.
const DECOR_MANIFEST_URL = "/assets/flowers/manifest.json";
let _decorItems = null; // cache trong phiên; null = chưa nạp

function openDecorPanel() {
  document.getElementById("theme-line-editor")?.classList.add("hidden");
  document.getElementById("theme-addtext-panel")?.classList.add("hidden");
  document.getElementById("theme-main-controls")?.classList.add("hidden");
  document.getElementById("theme-edit-hint")?.classList.add("hidden");
  document.getElementById("theme-elements-panel")?.classList.add("hidden");
  document.getElementById("theme-gift-panel")?.classList.add("hidden");
  _hideElementEditor();
  document.getElementById("theme-decor-panel")?.classList.remove("hidden");
  _resetCtrlScroll();
  _renderDecorPalette();
  if (window.lucide) lucide.createIcons();
}
window.openDecorPanel = openDecorPanel;

function closeDecorPanel() {
  document.getElementById("theme-decor-panel")?.classList.add("hidden");
  document.getElementById("theme-main-controls")?.classList.remove("hidden");
  _resetCtrlScroll();
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
    btn.title = "Kéo vào thiệp để thêm";
    btn.className = "cx-pal-item cx-pal-item-img";
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

// Kéo hoa TỪ bảng chọn THẢ vào thiệp — thả ở đâu đặt ở đó (lưu theo toạ độ %).
function startDecorDrag(e, src) {
  _startPalDrag(e, {
    onDrop: (iframe, x, y) => _addDecor(src, x, y),
  });
}
window.startDecorDrag = startDecorDrag;

// Hoạ tiết không có bảng cấp 3 (chỉnh ngay trên thiệp bằng bộ nút của nó) → thả
// xong Ở LẠI bảng chọn để thêm tiếp; rời bảng bằng nút quay lại.
function _addDecor(src, x, y) {
  _setDirty(true, "theme");
  _lineIframe()?.contentWindow?.postMessage({ type: "cx-add-decor", src, x, y }, "*");
}

// ─── Thành phần: bảng chọn thành phần thả lên thiệp ─────────────────────────
// Danh mục lấy từ window.CX_ELEMENTS (core/helpers/element-helper.js) nên thêm
// thành phần mới không phải sửa gì ở đây. Kéo ô mẫu ra khỏi bảng rồi thả lên
// thiệp → đặt đúng chỗ thả (bấm tại chỗ không thêm gì). Thả xong đóng bảng luôn.

function openElementsPanel() {
  document.getElementById("theme-line-editor")?.classList.add("hidden");
  document.getElementById("theme-addtext-panel")?.classList.add("hidden");
  document.getElementById("theme-decor-panel")?.classList.add("hidden");
  document.getElementById("theme-gift-panel")?.classList.add("hidden");
  _hideElementEditor();
  document.getElementById("theme-main-controls")?.classList.add("hidden");
  document.getElementById("theme-edit-hint")?.classList.add("hidden");
  document.getElementById("theme-elements-panel")?.classList.remove("hidden");
  _resetCtrlScroll();
  _renderElementsPalette();
  if (window.lucide) lucide.createIcons();
}
window.openElementsPanel = openElementsPanel;

function closeElementsPanel() {
  document.getElementById("theme-elements-panel")?.classList.add("hidden");
  document.getElementById("theme-main-controls")?.classList.remove("hidden");
  _resetCtrlScroll();
  _initEditHint();
}
window.closeElementsPanel = closeElementsPanel;

// ─── Xem trước thành phần: dựng widget thật rồi thu nhỏ vừa ô ───────────────
// Ô mẫu gọi thẳng def.build(variant) — cùng hàm runtime dùng để đặt lên thiệp.
// Dựng ở bề ngang thiệp thật (~400px) rồi mới thu nhỏ cả cụm, để tỉ lệ bên trong
// (cỡ chữ so với nút, với ảnh bìa) đúng như lúc widget nằm trên thiệp.
const EL_PREVIEW_CARD_W = 400;
const EL_PREVIEW_MAX_SCALE = 1.15; // mẫu nhỏ (nút tròn) được phóng cho vừa ô
const EL_PREVIEW_PAD = 0.9; // chừa mép, đừng để widget dính viền ô

// Widget thật có <button> bên trong; ô mẫu cũng là <button> nên phải hạ chúng
// xuống <span> (nút lồng nút thì trình đọc màn hình đọc sai), đồng thời gỡ
// data-cx-music để không helper nào bám vào bản xem trước.
function _inertPreview(node) {
  node.querySelectorAll("button").forEach((b) => {
    const s = document.createElement("span");
    s.className = b.className;
    s.innerHTML = b.innerHTML;
    b.replaceWith(s);
  });
  node
    .querySelectorAll("[data-cx-music]")
    .forEach((el) => el.removeAttribute("data-cx-music"));
  node.removeAttribute("data-cx-music");
  return node;
}

function _elPreview(def, v, opts) {
  const box = document.createElement("span");
  box.className = "cx-pal-prev";
  const stage = document.createElement("span");
  stage.className = "cx-pal-stage";
  // Bề ngang widget = % bề ngang thiệp, đúng như lúc thả thật.
  const w = (EL_PREVIEW_CARD_W * v.w) / 100;
  stage.style.width = w + "px";
  const built = def.build(v.id);
  // Áp tuỳ chọn TRƯỚC khi vô hiệu hoá: applyArt tìm ô ảnh qua data-cx-music.
  if (opts && def.apply) def.apply(built, opts);
  const node = _inertPreview(built);
  // Cỡ chữ phải đặt trên CHÍNH widget (.cx-tw có font-size riêng, đặt ở thẻ bọc
  // sẽ bị đè) — cùng công thức với _cxElStyle của runtime.
  if (v.fs) node.style.fontSize = Math.round(w * v.fs * 10) / 10 + "px";
  stage.appendChild(node);
  box.appendChild(stage);
  return box;
}

// Đo xong mới scale: lúc dựng, ô còn nằm trong panel đang ẩn nên chưa có kích
// thước. Gọi lại mỗi lần mở bảng.
function _fitElPreviews(root) {
  (root || document).querySelectorAll(".cx-pal-prev").forEach((box) => {
    const stage = box.firstElementChild;
    if (!stage) return;
    const bw = box.clientWidth;
    const bh = box.clientHeight;
    const sw = stage.offsetWidth;
    const sh = stage.offsetHeight;
    if (!bw || !bh || !sw || !sh) return;
    const k =
      Math.min(bw / sw, bh / sh, EL_PREVIEW_MAX_SCALE) * EL_PREVIEW_PAD;
    stage.style.transform = `translate(-50%, -50%) scale(${k})`;
  });
}

// Cột chỉnh kéo đổi rộng được (#theme-resize) → ô mẫu rộng hẹp theo, hệ số
// scale cũ thành sai. Theo dõi kích thước bảng để tính lại.
function _initElPreviewResize() {
  if (typeof ResizeObserver === "undefined") return;
  ["theme-elements-panel", "theme-addtext-panel"].forEach((id) => {
    const panel = document.getElementById(id);
    if (!panel) return;
    new ResizeObserver(() => {
      if (!panel.classList.contains("hidden")) _fitElPreviews(panel);
    }).observe(panel);
  });
}

// Ô mẫu: MỖI MẪU một ô (không phải mỗi thành phần một ô) — chọn mẫu nào thì thả
// thẳng mẫu đó, khỏi thả xong mới đi đổi.
function _renderElementsPalette() {
  const box = document.getElementById("cx-elements-palette");
  if (!box) return;
  if (box.dataset.rendered === "1") {
    _fitElPreviews(box);
    return;
  }
  const reg = window.CX_ELEMENTS || {};
  const defs = Object.values(reg);
  box.textContent = "";
  defs.forEach((def) => {
    // Một thành phần thì khỏi cần nhãn nhóm; nhiều thành phần mới phải ghi rõ ô nào
    // thuộc thành phần nào.
    if (defs.length > 1) {
      const lb = document.createElement("p");
      lb.className = "cx-pal-group";
      lb.textContent = def.name;
      box.appendChild(lb);
    }
    def.variants.forEach((v) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "cx-pal-item cx-pal-item-prev";
      btn.title =
        def.name +
        " · " +
        v.name +
        (v.desc ? " — " + v.desc : "") +
        " (kéo vào thiệp để thêm)";
      btn.appendChild(_elPreview(def, v));
      const cap = document.createElement("span");
      cap.className = "cx-pal-txt";
      cap.textContent = v.name;
      btn.appendChild(cap);
      const grip = document.createElement("i");
      grip.setAttribute("data-lucide", "grip-vertical");
      grip.className = "cx-pal-grip !w-[14px] !h-[14px]";
      btn.appendChild(grip);
      btn.addEventListener("pointerdown", (e) => startElementDrag(e, def.id, v.id));
      box.appendChild(btn);
    });
  });
  box.dataset.rendered = "1";
  _fitElPreviews(box);
}

// Kéo thành phần TỪ bảng chọn THẢ vào thiệp — y hệt hoạ tiết, thả ở đâu đặt ở đó.
function startElementDrag(e, elementId, variantId) {
  _startPalDrag(e, {
    onDrop: (iframe, x, y) => _addElement(elementId, variantId, x, y),
  });
}
window.startElementDrag = startElementDrag;

// Không đánh dấu chưa-lưu ở đây: thả trúng thành phần thiệp ĐÃ có thì runtime chỉ
// chọn nó lên chứ không sửa gì. Có thay đổi thật thì runtime tự gửi
// 'cx-elements-changed' và dấu * bật lên theo.
function _addElement(elementId, variantId, x, y) {
  closeElementsPanel();
  // Thả xong runtime gửi 'cx-element-pick' → bảng tự chuyển sang phần điều chỉnh.
  _lineIframe()?.contentWindow?.postMessage(
    { type: "cx-add-element", element: elementId, variant: variantId, x, y },
    "*",
  );
  // Nhỡ tin pick thì người dùng phải bấm lại vào widget mới chỉnh được — hỏi lại
  // một nhịp cho chắc (runtime đã chọn sẵn thì chỉ việc gửi lại trạng thái).
  setTimeout(() => {
    const box = document.getElementById("theme-element-editor");
    if (!box || !box.classList.contains("hidden")) return;
    _lineIframe()?.contentWindow?.postMessage(
      { type: "cx-element-repick", element: elementId },
      "*",
    );
  }, 150);
}

// ─── Hộp mừng cưới: chọn kiểu che phần mã QR ────────────────────────────────
// Một lưới gồm hai ô cố định — "Mặc định" (không lưu gì, mẫu tự lo phần này) và
// "Không hộp" — rồi tới từng mẫu hộp trong window.CX_GIFT_BOXES
// (core/helpers/gift-box-helper.js) nên thêm mẫu không phải sửa file này.
// Lưu ở _themeSetting.gift_box, áp thẳng vào khung xem trước bằng postMessage
// như hoạ tiết/thành phần — bảng chọn nhờ vậy đứng yên để còn so mẫu này mẫu kia.

function openGiftPanel() {
  document.getElementById("theme-line-editor")?.classList.add("hidden");
  document.getElementById("theme-addtext-panel")?.classList.add("hidden");
  document.getElementById("theme-decor-panel")?.classList.add("hidden");
  document.getElementById("theme-elements-panel")?.classList.add("hidden");
  _hideElementEditor();
  document.getElementById("theme-main-controls")?.classList.add("hidden");
  document.getElementById("theme-edit-hint")?.classList.add("hidden");
  document.getElementById("theme-gift-panel")?.classList.remove("hidden");
  _resetCtrlScroll();
  _renderGiftPalette();
  if (window.lucide) lucide.createIcons();
}
window.openGiftPanel = openGiftPanel;

function closeGiftPanel() {
  document.getElementById("theme-gift-panel")?.classList.add("hidden");
  document.getElementById("theme-main-controls")?.classList.remove("hidden");
  _resetCtrlScroll();
  _initEditHint();
}
window.closeGiftPanel = closeGiftPanel;

// `id` chính là giá trị lưu: rỗng = mặc định của mẫu, "none" = bỏ hộp.
const GIFT_FIXED = [
  {
    id: "",
    name: "Mặc định",
    icon: "sparkles",
    desc: "Giữ nguyên như mẫu thiệp",
  },
  {
    id: "none",
    name: "Không hộp",
    icon: "qr-code",
    desc: "Hiện thẳng mã QR, không che",
  },
];

function _giftBoxId() {
  const v = _themeSetting.gift_box;
  return typeof v === "string" ? v : "";
}

// Ô nào cũng gồm khung xem trước co giãn + MỘT dòng tên (nhãn cắt ngắn, không
// xuống dòng) — nhờ vậy ô ảnh và ô icon luôn vuông và cao bằng nhau, kể cả khi
// cột chỉnh bị kéo hẹp. `fill` = phần tử đặt vào khung xem trước.
function _giftTile(id, name, title, fill) {
  const btn = document.createElement("button");
  btn.type = "button";
  // cx-pal-item-pick: ô này BẤM để chọn chứ không kéo như hoạ tiết/thành phần.
  btn.className = "cx-pal-item cx-pal-item-prev cx-pal-item-pick";
  btn.dataset.giftId = id;
  btn.title = title;

  const prev = document.createElement("span");
  prev.className = "cx-pal-prev cx-gift-prev";
  prev.appendChild(fill);
  const cap = document.createElement("span");
  cap.className = "cx-pal-txt";
  cap.textContent = name;
  btn.append(prev, cap);

  btn.addEventListener("click", () => pickGiftBox(id));
  return btn;
}

function _renderGiftPalette() {
  const grid = document.getElementById("cx-gift-palette");
  if (!grid) return;
  if (grid.dataset.rendered !== "1") {
    grid.textContent = "";
    GIFT_FIXED.forEach((o) => {
      const i = document.createElement("i");
      i.setAttribute("data-lucide", o.icon);
      grid.appendChild(_giftTile(o.id, o.name, o.name + " — " + o.desc, i));
    });
    (window.CX_GIFT_BOXES || []).forEach((b) => {
      const img = document.createElement("img");
      img.src = b.src;
      img.alt = b.name;
      img.loading = "lazy";
      const btn = _giftTile(
        b.id,
        b.name,
        b.name + (b.desc ? " — " + b.desc : ""),
        img,
      );
      // Nền ca-rô cho thấy phần trong suốt của ảnh hộp — chỉ ở khung xem trước,
      // để dòng tên bên dưới vẫn nằm trên nền trắng.
      btn.querySelector(".cx-gift-prev")?.classList.add("cx-gift-prev-img");
      grid.appendChild(btn);
    });
    grid.dataset.rendered = "1";
  }
  _syncGiftTiles();
}

function _syncGiftTiles() {
  const cur = _giftBoxId();
  document
    .querySelectorAll("#cx-gift-palette .cx-pal-item")
    .forEach((b) => b.classList.toggle("is-on", (b.dataset.giftId || "") === cur));
}

function pickGiftBox(id) {
  if (id) _themeSetting.gift_box = id;
  else delete _themeSetting.gift_box;
  _syncGiftTiles();
  _setDirty(true, "theme");

  // Áp thẳng vào khung xem trước rồi cuộn tới mục — KHÔNG nạp lại: nạp lại là
  // bảng chọn đóng mất (xem _watchThemeFrame) mà khách còn đang so mẫu. Lưu dữ
  // liệu trước, phòng khi runtime xin nạp lại bằng 'cx-gift-reload'.
  _savePreviewData();
  const win = _lineIframe()?.contentWindow;
  win?.postMessage({ type: "cx-gift-box", value: id || "" }, "*");
  win?.postMessage({ type: "cx-focus", key: "gift" }, "*");
}
window.pickGiftBox = pickGiftBox;

// Nạp lại khung xem trước rồi cuộn tới mục vừa đổi. Đợi thêm một nhịp vẽ: lúc
// 'load' bắn, thiệp vẫn đang dựng nội dung nên chưa có gì để cuộn tới.
function _reloadThemeFrame(focusKey) {
  const iframe = document.getElementById("theme-preview-iframe");
  if (!iframe || !iframe.src) return;
  _savePreviewData();
  if (focusKey)
    iframe.addEventListener("load", function once() {
      iframe.removeEventListener("load", once);
      requestAnimationFrame(() =>
        iframe.contentWindow?.postMessage(
          { type: "cx-focus", key: focusKey },
          "*",
        ),
      );
    });
  // Dựng lại src thay vì gán lại src cũ: đổi mẫu thiệp xong cũng đi qua đây
  // (resetThemeSetting), lúc đó URL cũ vẫn trỏ vào mẫu trước.
  iframe.src = _previewIframeSrc("&edit=1");
}

// ─── Điều chỉnh THÀNH PHẦN đang chọn ────────────────────────────────────────
// Runtime gửi 'cx-element-pick' khi vừa thả hoặc bấm vào thành phần trên thiệp
// (giống 'cx-text-pick' của chữ). Mẫu và kích thước là phần chung cho mọi thành
// phần; các tuỳ chọn riêng dựng từ CX_ELEMENTS[…].options — ô màu dùng các hàng
// có sẵn trong HTML vì Coloris chỉ bọc được input đã nằm trong DOM. Mỗi mẫu chỉ
// hiện những ô màu nó khai báo trong `colors` (core/helpers/element-color-enum.js).
const EL_COLOR_SLOTS = 4;

let _elSel = null; // id thành phần đang chỉnh
let _elDefCur = null; // khai báo của nó trong CX_ELEMENTS
let _elVarCur = null; // mẫu đang chọn — quyết định hiện ô màu nào
let _elOpts = {}; // opts hiện hành (bản sao để vẽ control)
let _elBase = {}; // màu thật của widget trên thiệp (ô nào chưa chỉnh thì lấy đây)

function openElementEditor(msg) {
  const def = (window.CX_ELEMENTS || {})[msg.element];
  if (!def) return;
  _elSel = msg.id;
  _elDefCur = def;
  _elOpts = Object.assign({}, msg.opts);
  _elBase = Object.assign({}, msg.base);

  document.getElementById("theme-line-editor")?.classList.add("hidden");
  document.getElementById("theme-addtext-panel")?.classList.add("hidden");
  document.getElementById("theme-decor-panel")?.classList.add("hidden");
  document.getElementById("theme-elements-panel")?.classList.add("hidden");
  document.getElementById("theme-gift-panel")?.classList.add("hidden");
  document.getElementById("theme-main-controls")?.classList.add("hidden");
  document.getElementById("theme-edit-hint")?.classList.add("hidden");
  document.getElementById("theme-element-editor")?.classList.remove("hidden");
  _resetCtrlScroll();

  const name = document.getElementById("cx-el-name");
  if (name) name.textContent = def.name;

  _elVarCur = _elVariantOf(msg.variant);
  _syncElWidth(msg.w, _elVarCur);
  _renderElOptions();
  if (window.lucide) lucide.createIcons();
}

function closeElementEditor() {
  const box = document.getElementById("theme-element-editor");
  if (!box || box.classList.contains("hidden")) return;
  _hideElementEditor();
  document.getElementById("theme-main-controls")?.classList.remove("hidden");
  _resetCtrlScroll();
  _initEditHint();
}
window.closeElementEditor = closeElementEditor;

// Bảng khác sắp chiếm chỗ → chỉ cất đi, KHÔNG bật lại nhóm chỉnh chung.
// Đóng bảng thì bỏ chọn luôn widget trong thiệp, nếu không bộ nút (xoá, đổi mẫu…)
// còn treo trên nó.
function _hideElementEditor() {
  _blurCards("all");
  document.getElementById("theme-element-editor")?.classList.add("hidden");
  _elSel = null;
  _elDefCur = null;
  _elVarCur = null;
}

function _elVariantOf(id) {
  const list = (_elDefCur && _elDefCur.variants) || [];
  return list.find((v) => v.id === id) || list[0] || {};
}

function _elSend(msg) {
  if (!_elSel) return;
  _setDirty(true, "theme");
  _lineIframe()?.contentWindow?.postMessage(
    Object.assign({ id: _elSel }, msg),
    "*",
  );
}

function _syncElWidthFromCard() {
  if (!_elSel || document.activeElement?.id === "cx-el-width") return;
  const t = (_themeSetting.elements || []).find((x) => x.id === _elSel);
  if (t) _syncElWidth(t.w, _elVariantOf(t.variant));
}

// Bọc ô kích thước thành thanh viên thuốc. Chỉ chạy một lần; partial đã nằm
// trong DOM trước khi các script này được chèn nên không cần chờ thêm.
function _initElWidthSlider() {
  const el = document.getElementById("cx-el-width");
  if (el) window.CXProgress?.attach(el);
}

// min/max đổi theo mẫu đang chọn nên phải vẽ lại thanh sau khi gán.
function _syncElWidth(w, variant) {
  const el = document.getElementById("cx-el-width");
  if (!el) return;
  el.min = variant.minW || 8;
  el.max = variant.maxW || 100;
  el.value = Math.round(w);
  window.CXProgress?.paint(el);
}

function onElementWidthInput() {
  const el = document.getElementById("cx-el-width");
  if (!el) return;
  _elSend({ type: "cx-element-size", w: Number(el.value) });
}
window.onElementWidthInput = onElementWidthInput;

function onElementWidthCommit() {
  const el = document.getElementById("cx-el-width");
  if (!el) return;
  _elSend({ type: "cx-element-size", w: Number(el.value), done: true });
}
window.onElementWidthCommit = onElementWidthCommit;

// Tuỳ chọn riêng: 'choice' dựng động, 'color' đổ vào các hàng chip có sẵn.
// Ô màu lọc theo `colors` của mẫu đang chọn — nút tròn không có nền/chữ nên chỉ
// còn 2 ô. Mẫu không khai báo `colors` thì hiện hết.
function _renderElOptions() {
  const box = document.getElementById("cx-el-options");
  if (!box) return;
  box.textContent = "";
  const list = (_elDefCur && _elDefCur.options) || [];
  const only = _elVarCur && _elVarCur.colors;
  let slot = 0;

  list.forEach((o) => {
    if (o.type === "color") {
      if (slot >= EL_COLOR_SLOTS || (only && !only.includes(o.id))) return;
      _fillElColorSlot(slot++, o);
      return;
    }
    if (o.type !== "choice") return;
    const row = document.createElement("div");
    row.className = "cx-le-row";
    const label = document.createElement("label");
    label.className = "cx-le-label";
    label.textContent = o.label;
    const seg = document.createElement("div");
    seg.className = "cx-le-seg cx-le-seg-text";
    const cur = _elOpts[o.id] || o.def;
    o.items.forEach((it) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = it.id === cur ? "active" : "";
      b.textContent = it.name;
      b.addEventListener("click", () => {
        _elOpts[o.id] = it.id;
        _renderElOptions();
        _elSend({
          type: "cx-element-opts",
          opts: { [o.id]: it.id },
          done: true,
        });
      });
      seg.appendChild(b);
    });
    row.append(label, seg);
    box.appendChild(row);
  });

  // Ô màu thừa (mẫu này không dùng tới) thì ẩn đi; không màu nào thì ẩn cả hàng
  // cho khỏi hở khoảng trống.
  for (let i = slot; i < EL_COLOR_SLOTS; i++)
    document.getElementById("cx-el-color-row-" + i)?.classList.add("hidden");
  document.getElementById("cx-el-colors")?.classList.toggle("hidden", !slot);
}

function _fillElColorSlot(i, o) {
  const row = document.getElementById("cx-el-color-row-" + i);
  const label = document.getElementById("cx-el-color-label-" + i);
  if (!row) return;
  row.classList.remove("hidden");
  row.dataset.optId = o.id;
  if (label) label.textContent = o.label;
  _chipValueRaw(
    "cx-el-color-" + i,
    _elOpts[o.id] || _elBase[o.id] || o.def || "#ffffff",
  );
}

// Coloris bắn 'input' liên tục khi kéo trong bảng màu → áp live, chỉ chốt lưu khi
// đóng bảng (change).
function onElementColorInput(i, done) {
  const row = document.getElementById("cx-el-color-row-" + i);
  const input = document.getElementById("cx-el-color-" + i);
  if (!row || !input || !row.dataset.optId) return;
  _elOpts[row.dataset.optId] = input.value;
  _elSend({
    type: "cx-element-opts",
    opts: { [row.dataset.optId]: input.value },
    done: !!done,
  });
}

function resetElementOptions() {
  _elOpts = {};
  _renderElOptions();
  _elSend({ type: "cx-element-opts", opts: {}, replace: true, done: true });
}
window.resetElementOptions = resetElementOptions;

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
  document.getElementById("theme-elements-panel")?.classList.add("hidden");
  document.getElementById("theme-gift-panel")?.classList.add("hidden");
  _hideElementEditor();
  document.getElementById("theme-line-editor")?.classList.remove("hidden");
  _resetCtrlScroll();

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
        : msg.blockLabel || "Nội dung";
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

  // Màu — ưu tiên override, không có thì lấy màu ĐANG hiện (kể cả khi màu đó do
  // mẫu đổ gradient: runtime đã quy về chặng đầu của dải, xem computed.gradFrom).
  const grad =
    ov.gradient || (c.gradFrom && c.gradTo ? { from: c.gradFrom, to: c.gradTo } : null);
  const color = (grad && grad.from) || ov.color || c.color || "#000000";
  _chipValueRaw("cx-line-color", color);
  _syncGradientUI(!!grad, grad && grad.to);

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
  const box = document.getElementById("theme-line-editor");
  // Bảng đang đóng sẵn thì thôi: runtime báo "thôi chỉnh dòng" cả khi người dùng
  // đang mở bảng khác (chọn mẫu, điều chỉnh thành phần) — bật lại nhóm chỉnh
  // chung lúc đó là đá người dùng ra khỏi bảng họ đang dùng.
  if (!box || box.classList.contains("hidden")) return;
  box.classList.add("hidden");
  document.getElementById("theme-main-controls")?.classList.remove("hidden");
  _resetCtrlScroll();
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
  // Đang bật chuyển màu: ô 1 là màu ĐẦU của dải. Dải có thể mới chỉ do CSS của
  // mẫu vẽ ra (chưa có trong model) → chốt luôn thành override, không thì màu
  // vừa chọn lại giết mất gradient.
  if (v && _lineGradientOn()) o.gradient = { from: v, to: _lineGradientTo(o) };
  _syncSampleStyle(); // chữ mẫu đổi theo live
  _applyLine();
}
window.onLineColorChange = onLineColorChange;

// ── Chuyển màu (gradient) cho một dòng chữ ─────────────────────────────────
// text_overrides[sel].gradient = { from, to }; có nó thì chữ đổ màu, bỏ đi thì
// về lại màu đặc của ô 1. Ô 2 chỉ hiện khi đang bật.
const LINE_GRADIENT_TO = "#f59e0b"; // màu cuối gợi ý khi bật lần đầu

// Trạng thái BẬT lấy từ nút, không lấy từ model: dải màu có thể đang do CSS của
// mẫu vẽ ra chứ chưa nằm trong text_overrides.
function _lineGradientOn() {
  return !!document
    .getElementById("cx-line-gradient")
    ?.classList.contains("active");
}

function _lineGradientTo(o) {
  return (
    document.getElementById("cx-line-color2")?.value ||
    (o && o.gradient && o.gradient.to) ||
    LINE_GRADIENT_TO
  );
}

function _syncGradientUI(on, to) {
  _setToggle("cx-line-gradient", on);
  document
    .getElementById("cx-line-color2-wrap")
    ?.classList.toggle("hidden", !on);
  if (on) _chipValueRaw("cx-line-color2", to || LINE_GRADIENT_TO);
}

function toggleLineGradient() {
  if (!_lineSel) return;
  const o = _lineOverride();
  const on = document
    .getElementById("cx-line-gradient")
    ?.classList.contains("active");
  const chip = (id) => document.getElementById(id)?.value || "";
  if (on) {
    delete o.gradient;
    // Mẫu có sẵn chữ đổ màu trong CSS của nó → phải ghi một màu ĐẶC mới huỷ được.
    o.color = chip("cx-line-color") || o.color || "#111827";
  } else {
    o.gradient = {
      from: chip("cx-line-color") || _lineComputed.color || "#111827",
      to: chip("cx-line-color2") || LINE_GRADIENT_TO,
    };
  }
  _syncGradientUI(!on, o.gradient && o.gradient.to);
  _syncSampleStyle();
  _applyLine();
}
window.toggleLineGradient = toggleLineGradient;

function onLineColor2Change() {
  if (!_lineSel || !_lineGradientOn()) return;
  const o = _lineOverride();
  o.gradient = {
    from:
      document.getElementById("cx-line-color")?.value ||
      (o.gradient && o.gradient.from) ||
      _lineComputed.color ||
      "#111827",
    to: _lineGradientTo(o),
  };
  _syncSampleStyle();
  _applyLine();
}
window.onLineColor2Change = onLineColor2Change;

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
  // Chuyển màu: tô nền rồi xén theo hình chữ, giống hệt cách áp lên thiệp.
  const to = has("cx-line-gradient")
    ? document.getElementById("cx-line-color2")?.value || ""
    : "";
  s.style.backgroundImage = to
    ? `linear-gradient(90deg, ${color || "#111827"}, ${to})`
    : "";
  s.style.webkitBackgroundClip = to ? "text" : "";
  s.style.backgroundClip = to ? "text" : "";
  s.style.webkitTextFillColor = to ? "transparent" : "";
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
// Ghi --theme-ctrl-w (px) lên #theme-controls; styles/_setup.css chỉ đọc biến này trong
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

// ─── Vùng cuộn cao thấp có tay nắm (bọc CẢ bảng chỉnh giao diện) ───────────
// Mọi bảng (chung, chỉnh chữ, thêm văn bản, trang trí, thành phần, điều chỉnh)
// nằm chung một vùng cuộn nên cao bằng nhau. CHỈ CÓ HAI MỨC: mức thấp 200px cho
// đỡ che thiệp, và mức cao = nửa màn hình. Vuốt/chạm tay nắm là nhảy hẳn sang mức
// kia, buông tay giữa chừng thì trượt về mức gần nhất — không dừng lưng chừng.
// Chỉ chạy ở mobile — từ md+ cả cột chỉnh đã tự cuộn nên CSS tắt tay nắm.
// Đổi SHEET_MIN thì sửa luôn giá trị dự phòng của --cx-sheet-h ở styles/_setup.css.
const SHEET_MIN = 200; // px — mức thấp, cũng là chiều cao mặc định
const SHEET_MAX_VH = 0.5; // mức cao = 50% chiều cao màn hình
const SHEET_DRAG_MIN = 6; // px, dưới ngưỡng này tính là chạm

// Mức cao thật sự: nội dung ngắn hơn nửa màn thì lấy đúng chiều cao nội dung,
// đừng chừa khoảng trắng thừa. scrollHeight ≥ clientHeight nên khi nội dung đã
// vừa khung, nó bằng luôn chiều cao hiện tại → mức cao trùng mức thấp, hết vuốt.
function _sheetMax(body) {
  const vh = Math.round(window.innerHeight * SHEET_MAX_VH);
  const content = body ? body.scrollHeight : vh;
  return Math.max(SHEET_MIN, Math.min(vh, content));
}

// Dải trắng mờ chỉ hiện khi còn nội dung chưa thấy.
function _updateSheetFade(body) {
  const fade = body.parentElement?.querySelector(".cx-sheet-fade");
  if (!fade) return;
  const rest = body.scrollHeight - body.clientHeight - body.scrollTop;
  fade.classList.toggle("is-end", rest <= 4);
}

// Hàng nút của mỗi bảng nằm ở khối đầu bảng (#cx-ctrl-actions), ngoài vùng cuộn.
// Bảng nào đang mở thì hiện hàng nút của bảng đó: [id bảng, id hàng nút], xét từ
// trên xuống, không bảng nào mở thì rơi về hàng nút của nhóm chỉnh chung.
// Thêm bảng mới → thêm một dòng ở đây, khỏi đụng vào các hàm mở/đóng bảng.
const CTRL_HEADS = [
  ["theme-element-editor", "cx-head-element-editor"],
  ["theme-gift-panel", "cx-head-gift"],
  ["theme-elements-panel", "cx-head-elements"],
  ["theme-decor-panel", "cx-head-decor"],
  ["theme-addtext-panel", "cx-head-addtext"],
  ["theme-line-editor", "cx-head-line"],
];

function _syncCtrlHead() {
  const open = CTRL_HEADS.find(
    ([panelId]) =>
      !document.getElementById(panelId)?.classList.contains("hidden"),
  );
  const active = open ? open[1] : "cx-head-main";
  CTRL_HEADS.forEach(([, headId]) =>
    document.getElementById(headId)?.classList.toggle("hidden", headId !== active),
  );
  document
    .getElementById("cx-head-main")
    ?.classList.toggle("hidden", active !== "cx-head-main");
  if (window.lucide) lucide.createIcons();
}

// Bảng được ẩn/hiện ở cả chục chỗ trong file này → theo dõi thuộc tính class
// thay vì gọi tay ở từng chỗ (sót một nhánh là mất luôn nút Quay lại).
function _initCtrlHeadSync() {
  if (typeof MutationObserver === "undefined") return;
  const obs = new MutationObserver(_syncCtrlHead);
  CTRL_HEADS.forEach(([panelId]) => {
    const el = document.getElementById(panelId);
    if (el) obs.observe(el, { attributes: true, attributeFilter: ["class"] });
  });
  _syncCtrlHead();
}

// Đổi bảng thì cuộn về đầu + tính lại dải mờ — bảng mới cao bằng bảng cũ nên
// giữ nguyên scrollTop sẽ mở ra ở lưng chừng nội dung.
function _resetCtrlScroll() {
  const body = document.getElementById("cx-ctrl-scroll");
  if (!body) return;
  body.scrollTop = 0;
  requestAnimationFrame(() => _updateSheetFade(body));
}

function _initSheet(bodyId, handleId) {
  const body = document.getElementById(bodyId);
  const handle = document.getElementById(handleId);
  if (!body || !handle) return;

  // Giữ chiều cao đã chọn ở biến riêng: lúc bảng đang ẩn thì clientHeight = 0,
  // đọc lại từ DOM sẽ tự xoá mất mức người dùng vừa kéo.
  let cur = SHEET_MIN;
  const setH = (px, max) => {
    cur = Math.round(
      Math.min(Math.max(px, SHEET_MIN), max == null ? _sheetMax(body) : max),
    );
    body.style.setProperty("--cx-sheet-h", cur + "px");
    _updateSheetFade(body);
  };
  setH(cur);

  let drag = null;
  const grip = handle.querySelector(".cx-sheet-grip");
  handle.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    // Nút trong khối đầu bảng (Quay lại, Khôi phục…) không phải chỗ để kéo.
    if (e.target.closest && e.target.closest("button")) return;
    // md+ ẩn vạch kéo = không cho kéo (cả cột chỉnh đã tự cuộn).
    if (grip && getComputedStyle(grip).display === "none") return;
    e.preventDefault();
    try {
      handle.setPointerCapture(e.pointerId);
    } catch (err) {}
    // Chốt mức cao NGAY LÚC BẮT ĐẦU: đang kéo thì scrollHeight đổi theo chiều
    // cao khung, tính lại giữa chừng sẽ ra trần nhảy nhót.
    drag = { y0: e.clientY, h0: cur, max: _sheetMax(body), moved: false };
    body.classList.add("is-dragging"); // tắt hiệu ứng trượt, bám tay tức thì
  });
  handle.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const dy = e.clientY - drag.y0;
    if (!drag.moved && Math.abs(dy) < SHEET_DRAG_MIN) return;
    drag.moved = true;
    setH(drag.h0 - dy, drag.max); // kéo lên (dy âm) = cao lên
  });
  const end = () => {
    if (!drag) return;
    body.classList.remove("is-dragging");
    // Luôn về đúng MỘT TRONG HAI mức. Vuốt: trượt về mức gần chỗ buông tay hơn.
    // Chạm không vuốt: nhảy sang mức còn lại.
    const max = drag.max;
    if (drag.moved) setH(cur > (SHEET_MIN + max) / 2 ? max : SHEET_MIN, max);
    else setH(drag.h0 >= max - 4 ? SHEET_MIN : max, max);
    drag = null;
  };
  handle.addEventListener("pointerup", end);
  handle.addEventListener("pointercancel", end);

  body.addEventListener("scroll", () => _updateSheetFade(body), {
    passive: true,
  });
  // Nội dung/khung đổi cỡ (dựng xong ô mẫu, đổi bảng, xoay máy) → tính lại dải mờ.
  if (typeof ResizeObserver !== "undefined")
    new ResizeObserver(() => _updateSheetFade(body)).observe(body);
  // Xoay máy → sàn/trần đổi, kẹp lại mức đang chọn.
  window.addEventListener("resize", () => setH(cur));
}

function _initThemePanelObservers() {
  _initElWidthSlider();
  _initThemeResize();
  _initElPreviewResize();
  _initSheet("cx-ctrl-scroll", "cx-ctrl-handle");
  _initCtrlHeadSync();
  _initCardBlur();
}

if (window.__cxOnReady) window.__cxOnReady(_initThemePanelObservers);
else _initThemePanelObservers();

// Tên có dấu → slug thuần a-z0-9 và dấu "-". Luật đặt slug nằm ở
// weddingBL.validateSlug(); gọi thẳng vào đó để slug đem đi kiểm trùng luôn
// trùng khít slug thực sự được lưu — lệch nhau là ăn 409 lúc PATCH.
// Khác validateSlug ở chỗ không ném lỗi: chuỗi không còn ký tự dùng được → "".
function _toSlug(str) {
  try {
    return weddingBL.validateSlug(str);
  } catch (e) {
    return "";
  }
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

  // Phải nhắm `input[name=...]`: `[name=...]` khớp <x-input> (host giữ nguyên
  // attribute name) — host không có .value → tên rỗng → rơi về slug wedding-xxxx.
  const groomName = (
    document.querySelector('input[name="groom_name"]')?.value || ""
  ).trim();
  const brideName = (
    document.querySelector('input[name="bride_name"]')?.value || ""
  ).trim();
  if (!groomName || !brideName) return WEDDING_SLUG;

  const groomSlug = _toSlug(groomName);
  const brideSlug = _toSlug(brideName);

  // Lần 1: họ và tên đầy đủ
  const fullSlug = _toSlug(`${groomSlug}-${brideSlug}`);
  if (!fullSlug) return WEDDING_SLUG;
  if (await _isSlugAvailable(fullSlug)) return fullSlug;

  // Trùng → thêm hậu tố số. Hai ràng buộc khi chọn biến thể, sai là slug đem đi
  // kiểm trùng khác slug thực sự lưu → PATCH ăn 409:
  // - Không dùng ký tự lạ ("&", "_"): validateSlug gộp chúng thành "-" nên
  //   "a-&-b" rút gọn lại đúng "a-b" đang trùng.
  // - Chừa chỗ cho hậu tố (dài nhất là "-99") trong trần độ dài, không thì tên
  //   dài bị cắt mất đuôi và mọi biến thể rút về cùng một chuỗi.
  const stem = _toSlug(fullSlug.slice(0, SLUG_MAX_LENGTH - 3));
  for (let i = 2; i <= 5; i++) {
    const numbered = `${stem}-${i}`;
    if (await _isSlugAvailable(numbered)) return numbered;
  }

  // Cuối cùng: random số 2 chữ số
  const rand = Math.floor(Math.random() * 90) + 10; // 10–99
  return `${stem}-${rand}`;
}

function _updateSlugPreview() {
  const input = document.getElementById("slug-input");
  const preview = document.getElementById("slug-preview");
  const row = document.getElementById("slug-preview-row");
  if (!input || !preview) return;
  // Xem trước phải là slug ĐÃ chuẩn hoá, đúng thứ sẽ lưu — không thì người dùng
  // thấy "/Hoàng Lan" nhưng nhận về "/hoang-lan".
  const val = _toSlug(input.value);
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
      showToast("Đã sao chép link thiệp!", "success");
    })
    .catch(() => {
      showToast("Không thể sao chép, hãy copy thủ công", "error");
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
    showToast("Vui lòng điền đủ thông tin bắt buộc trước khi xuất bản", "warning");
    return;
  }

  // Đọc lại phiên ngay tại đây: hàm này còn được gọi lại từ onAuth của popup đăng
  // nhập bên dưới, đọc cờ cũ là mở popup lần nữa thành vòng lặp. Hỏi supabase
  // (await) để token hết hạn không bị tính nhầm là còn đăng nhập.
  await _refreshLoginState();
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
      window.location.href = `/my-invitations/?urlRedirect=${encodeURIComponent(returnUrl.toString())}`;
    }
    return;
  }
  _setActiveTab("publish");
  showLoading(true, "Đang chuẩn bị...");
  // Nạp font/CSS của popup mừng NGAY từ đây, không đợi lúc mở popup: tới lúc lưu
  // xong (upload ảnh + ghi DB) thì font đã về, popup hiện ra là chữ đúng ngay.
  // Hàm idempotent nên gọi sớm không tạo thêm thẻ nào.
  _ensurePublishPopupAssets();
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

// Popup mừng "Thiệp đã sẵn sàng", cá nhân hoá bằng tên cô dâu/chú rể. Tự dựng
// DOM + style riêng (scoped, nạp lần đầu qua _ensurePublishPopupAssets).
function _ensurePublishPopupAssets() {
  if (!document.getElementById("ps-fonts")) {
    const l = document.createElement("link");
    l.id = "ps-fonts";
    l.rel = "stylesheet";
    // display=block (không phải swap): Italianno có thân chữ nhỏ hơn hẳn font
    // cursive dự phòng, swap sẽ vẽ bằng font hệ thống rồi tráo, nhìn như chữ tự
    // thu nhỏ lại.
    l.href =
      "https://fonts.googleapis.com/css2?family=Italianno&family=Playfair+Display:wght@600;700&display=block";
    document.head.appendChild(l);
  }
  if (document.getElementById("ps-style")) return;
  const s = document.createElement("style");
  s.id = "ps-style";
  s.textContent = `
    #publish-success-modal{position:fixed;inset:0;z-index:300;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(58,26,34,.55);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px)}
    #publish-success-modal button,#publish-success-modal a{cursor:pointer}
    #publish-success-modal :focus-visible{outline:2px solid #e11d48;outline-offset:2px}
    /* 92dvh chứ không chỉ 92vh: trên iOS/Android, vh tính theo viewport lúc thanh
       công cụ trình duyệt ĐANG ẨN, nên 92vh vẫn có thể cao hơn phần nhìn thấy thật
       và popup bị cắt. Trình duyệt cũ không hiểu dvh sẽ bỏ qua dòng sau, còn 92vh. */
    .ps-card{width:100%;max-width:384px;max-height:92vh;max-height:92dvh;overflow-y:auto;background:#fffdfa;border-radius:28px;box-shadow:0 24px 64px -16px rgba(74,44,53,.45);animation:ps-in .5s cubic-bezier(.22,.9,.3,1) both}
    @keyframes ps-in{from{opacity:0;transform:translateY(16px) scale(.98)}to{opacity:1;transform:none}}
    .ps-head{position:relative;text-align:center;padding:32px 28px 0px}
    .ps-x{position:absolute;top:12px;right:12px;width:32px;height:32px;display:inline-flex;align-items:center;justify-content:center;border-radius:999px;color:#b39aa1;background:transparent;transition:color .15s ease,background .15s ease}
    .ps-x:hover{color:#4a2c35;background:#f5ece8}
    /* Kẻ nhũ + hình thoi: mô-típ ấn loát trên thiệp in — điểm nhấn DUY NHẤT của popup */
    .ps-orn{display:flex;align-items:center;justify-content:center;gap:12px}
    .ps-orn i{display:block;height:1px;width:48px;transform-origin:center;animation:ps-rule .6s .08s cubic-bezier(.22,.9,.3,1) both}
    .ps-orn i:first-child{background:linear-gradient(90deg,transparent,#c2a15a)}
    .ps-orn i:last-child{background:linear-gradient(90deg,#c2a15a,transparent)}
    .ps-orn b{width:8px;height:8px;border-radius:1px;background:#c2a15a;transform:rotate(45deg)}
    @keyframes ps-rule{from{opacity:0;transform:scaleX(0)}to{opacity:1;transform:none}}
    /* line-height rộng: Italianno có nét bay cao + đuôi chữ dài, bó sát là dấu "ú/ừ"
       đè lên kẻ nhũ và chữ "g" trong "mừng" chạm dòng dưới */
    .ps-congrats{font-family:'Italianno',cursive;font-size:64px;line-height:1.25;color:#b8425f;margin:4px 0 0;animation:ps-rise .5s .16s cubic-bezier(.22,.9,.3,1) both}
    @keyframes ps-rise{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
    .ps-title{font-size:12px;font-weight:600;letter-spacing:3px;text-transform:uppercase;color:#9b7d86}
    .ps-couple{font-family:'Playfair Display',serif;font-size:16px;color:#4a2c35;margin-top:8px;display:inline-flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:center}
    .ps-sub{font-size:12px;color:#9b7d86;margin:8px 0 0}
    .ps-body{padding:0 24px 20px}
    .ps-eyebrow{display:flex;align-items:center;gap:8px;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#c2a15a;margin:16px 4px 8px}
    .ps-eyebrow::after{content:"";flex:1;height:1px;background:linear-gradient(90deg,#ecdfc4,transparent)}
    .ps-link{border:1px solid #f0e4d4;background:#fffaf4;border-radius:16px;padding:12px}
    .ps-link+.ps-link{margin-top:8px}
    .ps-link-top{display:flex;align-items:center;gap:12px}
    .ps-link-text{flex:1;min-width:0}
    .ps-link-label{font-size:16px;font-weight:600;line-height:1.2;color:#4a2c35}
    .ps-link-sub{font-size:12px;line-height:1.3;color:#9b7d86;margin-top:2px}
    /* 1 dòng + cắt đuôi: link nhà trai có thêm ?isGroom=true nên xuống 2 dòng,
       làm hai thẻ lệch nhau và cao thêm. Link đầy đủ vẫn nằm ở nút Sao chép. */
    .ps-url{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;line-height:1.3;color:#9b7d86;margin-top:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .ps-acts{display:flex;gap:8px;flex-shrink:0}
    .ps-soft{width:36px;height:36px;border-radius:12px;display:inline-flex;align-items:center;justify-content:center;border:1px solid #ffd9e1;color:#e11d48;background:#fff;transition:background .15s ease,border-color .15s ease}
    .ps-soft:hover{background:#fff1f4;border-color:#ffc4d2}
    .ps-soft i{width:16px;height:16px}
    /* margin-top thay cho eyebrow đã bỏ: nút này mở sang việc KHÁC (khách mời),
       dính sát thẻ link cuối thì đọc như vẫn thuộc mục "Chia sẻ thiệp". */
    .ps-primary{width:100%;height:48px;margin-top:20px;border-radius:16px;display:inline-flex;align-items:center;justify-content:center;gap:8px;font-size:16px;font-weight:600;color:#fff;background:#e11d48;border:none;transition:background .15s ease}
    .ps-primary:hover{background:#c81742}
    .ps-primary i{width:16px;height:16px}
    .ps-note{font-size:12px;line-height:1.5;color:#9b7d86;text-align:center;margin:8px 0 0;padding:0 8px}
    .ps-note b{color:#4a2c35;font-weight:600}
    .ps-keep{font-size:12px;line-height:1.5;color:#9b7d86;text-align:center;margin:6px 0 0;padding:0 8px}
    .ps-keep b{color:#b8425f;font-weight:600}
    .ps-warn{color:#9a3412;background:#fff7ed;border:1px solid #fed7aa;border-radius:12px;padding:10px 12px}
    /* Nền ngà nhạt + viền mảnh (cùng bộ với thẻ link) thay vì chữ trơn: vẫn nhẹ hơn
       hẳn nút hồng phía trên, nhưng nhìn ra là NÚT chứ không phải dòng chữ phụ. */
    .ps-done{display:flex;align-items:center;justify-content:center;width:100%;height:40px;margin-top:8px;border-radius:12px;font-size:12px;font-weight:600;color:#7d5a64;background:#f7f0e8;border:1px solid #f0e4d4;transition:background .15s ease,color .15s ease}
    .ps-done:hover{background:#f1e7db;color:#4a2c35}
    /* Màn thấp (iPhone SE… và mọi máy khi thanh công cụ trình duyệt đang hiện):
       bóp tiếp phần trang trí để KHÔNG phải cuộn — bỏ dòng chú thích, hạ cỡ chữ
       "Chúc mừng" và lề trên. Máy cao vẫn giữ nguyên thiết kế đầy đủ. */
    @media (max-height:640px){
      .ps-head{padding-top:20px}
      .ps-congrats{font-size:52px}
      .ps-note{display:none}
      .ps-eyebrow{margin-top:12px}
    }
    /* Cực thấp (máy nhỏ xoay ngang, cửa sổ tí hon): bỏ nốt dòng link hiển thị và
       nới popup gần kín màn. Nút Sao chép vẫn chép đủ link nên không mất chức năng. */
    @media (max-height:520px){
      #publish-success-modal{padding:8px}
      .ps-card{max-height:96dvh}
      .ps-url{display:none}
    }
    @media (prefers-reduced-motion:reduce){.ps-card,.ps-congrats,.ps-orn i{animation:none}}`;
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

  // Nhãn + 2 nút CÙNG một hàng (nút chỉ còn icon, có title/aria-label): xếp dọc
  // nhãn → mô tả → link → 2 nút full-width tốn ~170px mỗi thẻ, hai thẻ là popup
  // vượt màn hình điện thoại. Gói lại còn ~80px mà không bỏ mục nào.
  const linkRow = (label, sub, url) => `
    <div class="ps-link">
      <div class="ps-link-top">
        <div class="ps-link-text">
          <div class="ps-link-label">${label}</div>
          <div class="ps-link-sub">${sub}</div>
        </div>
        <div class="ps-acts">
          <x-button variant="bare" type="button" class="ps-soft" data-ps-open="${url}" title="Xem thử" aria-label="Xem thử ${label}"><i data-lucide="eye"></i></x-button>
          <x-button variant="bare" type="button" class="ps-soft" data-ps-copy="${url}" title="Sao chép" aria-label="Sao chép ${label}"><i data-lucide="copy"></i></x-button>
        </div>
      </div>
      <div class="ps-url">${url}</div>
    </div>`;

  const linksHtml = familyOn
    ? linkRow("Thiệp nhà gái", "Ưu tiên lễ · tiệc nhà gái", generalUrl) +
      linkRow("Thiệp nhà trai", "Ưu tiên lễ · tiệc nhà trai", groomUrl)
    : linkRow("Link thiệp cưới", "Gửi cho tất cả khách mời", generalUrl);

  // Thiệp hết hạn dùng thử: xuất bản lại KHÔNG mở khoá (hạn giữ nguyên, edge
  // function vẫn chặn link công khai) → phải nói thẳng ở đây, không thì chủ thiệp
  // vừa bấm xuất bản xong lại thấy link chết mà không hiểu vì sao.
  const keepHtml = IS_TRIAL_LOCKED
    ? `<p class="ps-keep ps-warn">Thiệp đã <b>hết hạn dùng thử</b>: khách mời mở link chỉ thấy màn tạm khoá.
       Kích hoạt để mở lại — để quá ${CONFIG.retention.unpaidDays} ngày thiệp sẽ tự động xoá.</p>`
    : `<p class="ps-keep">Thiệp chưa thanh toán sẽ <b>tự động xoá sau ${CONFIG.retention.unpaidDays} ngày</b> kể từ khi hết hạn dùng thử.</p>`;

  const modal = document.createElement("div");
  modal.id = "publish-success-modal";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-labelledby", "ps-title");
  modal.innerHTML = `
    <div class="ps-card">
      <div class="ps-head">
        <x-button variant="bare" type="button" data-ps-close class="ps-x" aria-label="Đóng"><i data-lucide="x" style="width:18px;height:18px"></i></x-button>
        <div class="ps-orn" aria-hidden="true"><i></i><b></b><i></i></div>
        <div class="ps-congrats">Chúc mừng</div>
        <div class="ps-title" id="ps-title">Thiệp cưới đã sẵn sàng</div>
        ${coupleHtml}
      </div>
      <div class="ps-body">
        <div class="ps-eyebrow">Chia sẻ thiệp</div>
        ${linksHtml}

        <x-button variant="bare" type="button" class="ps-primary" data-ps-guests><i data-lucide="users"></i>Quản lý khách mời<i data-lucide="arrow-right"></i></x-button>
        <p class="ps-note">Gửi link để mọi người chung vui và <b>gửi lời chúc</b>.</p>
        <!-- Hạn dọn dẹp lấy ở CONFIG.retention. Để riêng một dòng (không gộp vào
             .ps-note) vì .ps-note bị ẩn trên màn thấp, còn câu này phải luôn đọc được. -->
        ${keepHtml}

        <x-button variant="bare" type="button" class="ps-done" data-ps-close>Hoàn tất</x-button>
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
    // Bấm nền tối KHÔNG đóng: đây là màn duy nhất đưa link thiệp cho khách, lỡ
    // chạm ra ngoài mà mất là phải mò lại. Chỉ nút ✕ và "Hoàn tất" mới đóng.
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
        .then(() => showToast("Đã sao chép link thiệp!", "success"))
        .catch(() => showToast("Không thể sao chép, hãy copy thủ công", "error"));
    }
  });

  document.body.appendChild(modal);
  document.addEventListener("keydown", onKey, true);
  if (window.lucide) lucide.createIcons();
}

// Ghi/cập nhật một đơn vào cache để trang tài khoản hiển thị thiệp.
// - Đã đăng nhập → key theo email; khách → key "guest" (đăng nhập sau tự gộp).
// - published=true → status "pending" (đã xuất bản, chưa thanh toán), ngược lại
//   "draft"; "completed" chỉ đến từ DB khi đã thanh toán.
// Trùng manage_id thì cập nhật, không tạo đơn rỗng, không hạ cấp completed.
function _syncLocalOrder({ published = false } = {}) {
  const user = window.CXAuth?.getUserSync();
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
    // Mốc để core/helpers/draft-retention.js biết đơn nháp này bỏ quên bao lâu rồi.
    updatedAt: new Date().toISOString(),
  };

  if (idx >= 0) orders[idx] = order;
  else orders.push(order);

  setCache(key, orders);
}
