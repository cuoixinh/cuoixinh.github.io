// Màn Giao diện: bộ màu thiệp, chỉnh riêng từng phần tử (Coloris) và câu
// mẫu chia sẻ.
//
// Tách từ index.js (dòng 816–1384 bản gốc). Thứ tự nạp khai báo ở loader.js.
//
// Mọi thay đổi ở đây chỉ nằm trong `_themeSetting` (biến toàn cục, ngoài <form>)
// nên KHÔNG có listener nào của form bắt được: sửa xong phải gọi
// `_scheduleAutoSave("theme")`, đừng gọi `_setDirty` trần — dấu * thì lên mà bản
// nháp không đổi, F5 là mất thay đổi (hoặc tệ hơn: "Đặt lại" không có tác dụng
// còn thứ vừa xoá thì sống lại).

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
    // Nạp lại giữa lúc đang kéo thì pointerup của thiệp không bao giờ tới nữa.
    _setCtrlAway(false);
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
// làm đậm nó lên là sửa mẫu chứ không phải chỉnh bộ màu → giấu cả hàng đi.
function _syncPaletteStrength() {
  const el = document.getElementById("theme-palette-strength");
  if (!el) return;
  const on = !!_currentPalette();
  el.value = _paletteStrength();
  el.disabled = !on;
  window.CXProgress?.attach(el)?.classList.toggle("is-off", !on);
  document
    .getElementById("theme-palette-strength-row")
    ?.classList.toggle("hidden", !on);
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
  _scheduleAutoSave("theme");
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
  if (_currentPalette()) _scheduleAutoSave("theme");
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
  _setCtrlAway(false);

  if (!_themePanelReady) {
    _initColorPickers();
    _themePanelReady = true;
  }

  // <x-combobox>.value tự đồng bộ nhãn khi gán (kể cả lúc nạp thiệp / reset).
  _fillPaletteCombo();
  const pal = document.getElementById("theme-palette");
  if (pal) pal.value = _currentPalette()?.id || "";
  _syncPaletteStrength();

  // Mở tab Giao diện → về nhóm chỉnh chung: rời tab lúc đang mở một bảng con mà
  // không dọn thì quay lại thấy bảng trống (closeLineEditor() thoát sớm khi bảng
  // chỉnh dòng đang đóng).
  _showMainControls();
  cxSyncThemeAddCards();

  // Icon (reset) trong thanh chỉnh
  if (window.lucide) lucide.createIcons();
}

// Ba tab chức năng chỉ có nghĩa khi mục tương ứng đang BẬT ở tab Thiết lập: tắt
// mục rồi mà vẫn chọn được hộp quà / dạng lời chúc thì chọn xong chẳng thấy gì
// đổi trên thiệp. Tab vẫn BẤM ĐƯỢC (khoá hẳn thì người dùng không biết vì sao
// mờ, nhất là trên di động vốn không có hover). Hai cách báo lý do:
//   khai `warn` + `body` → bảng mở ra như thường, phần chọn bị khoá và hiện một
//     dòng nhắc ngay trong bảng (xem _syncPanelGate)
//   không khai        → không mở bảng, chỉ hiện toast (xem _addCardBlocked)
// Công tắc nằm ở ô ẩn của form, js/03-form-sections.js gọi lại hàm đồng bộ mỗi
// lần gạt.
const ADD_CARD_GATES = {
  elements: {
    card: "add-card-elements",
    field: "enable_music",
    label: "Nhạc nền",
    warn: "gate-warn-elements",
    body: "cx-elements-palette",
  },
  gift: {
    card: "add-card-gift",
    field: "enable_gift",
    label: "Hộp mừng cưới",
    warn: "gate-warn-gift",
    body: "cx-gift-palette",
  },
  wishes: { card: "add-card-wishes", field: "enable_wishes", label: "Lời chúc" },
};

// Không có ô ẩn (mẫu bỏ hẳn mục đó) thì coi như đang bật — thà cho bấm còn hơn
// chặn nhầm một thẻ vẫn dùng được.
function _addCardOn(key) {
  const hidden = document.getElementById(ADD_CARD_GATES[key]?.field);
  return !hidden || hidden.value === "true";
}

// Đặt ở CUỐI hàm mở bảng của loại "khoá tại chỗ": hiện dòng nhắc + khoá phần
// chọn khi mục đang tắt. Khoá bằng pointer-events để ô mẫu không bấm/kéo được
// mà vẫn đọc được nội dung bên trong.
function _syncPanelGate(key) {
  const g = ADD_CARD_GATES[key];
  const on = _addCardOn(key);
  document.getElementById(g.warn)?.classList.toggle("hidden", on);
  const body = document.getElementById(g.body);
  if (!body) return;
  body.classList.toggle("opacity-40", !on);
  body.classList.toggle("pointer-events-none", !on);
  body.setAttribute("aria-disabled", String(!on));
}

// Đặt ở ĐẦU mỗi hàm mở bảng: mục đang tắt thì nói lý do rồi dừng.
function _addCardBlocked(key) {
  if (_addCardOn(key)) return false;
  showToast(
    `Mục “${ADD_CARD_GATES[key].label}” đang tắt — bật lại ở tab Thiết lập để dùng`,
    "warning",
  );
  return true;
}

function cxSyncThemeAddCards() {
  Object.keys(ADD_CARD_GATES).forEach((key) => {
    // Gạt công tắc lúc bảng đang mở → khoá/mở ngay phần chọn, khỏi chờ mở lại.
    if (ADD_CARD_GATES[key].warn) _syncPanelGate(key);
    const card = document.getElementById(ADD_CARD_GATES[key].card);
    if (!card) return;
    const on = _addCardOn(key);
    // Nhớ lời mách gốc ngay lượt đầu, không thì bật lại là mất hẳn.
    if (card.dataset.tip === undefined) card.dataset.tip = card.title || "";
    // Bảng nào tự nói lý do ở bên trong (`warn`) thì đừng tô mờ nút tab nữa —
    // mờ mà vẫn bấm được chỉ làm người dùng tưởng hỏng.
    card.classList.toggle("is-off", !on && !ADD_CARD_GATES[key].warn);
    card.title = on
      ? card.dataset.tip
      : `Mục “${ADD_CARD_GATES[key].label}” đang tắt — bật ở tab Thiết lập trước đã`;
  });
}
window.cxSyncThemeAddCards = cxSyncThemeAddCards;

// Bỏ HẾT tuỳ chỉnh của thiệp: bộ màu, chỉnh riêng từng dòng chữ, khối văn bản,
// hoạ tiết, thành phần, hộp mừng cưới. Nạp lại iframe là cách chắc chắn nhất để gỡ mọi thứ đã
// bơm vào — không phải gỡ ngược từng loại một.
function resetThemeSetting() {
  _themeSetting = {};
  _initThemePanel();
  _scheduleAutoSave("theme");

  // Reload iframe để xoá hết override, quay về mặc định của theme
  _reloadThemeFrame();
}

window.resetThemeSetting = resetThemeSetting;

// Mức RỘNG NHẤT trong ba mức đặt lại (nút ghim đầu dải tab, nhãn "Đặt lại"):
//   Đặt lại  → cả thiệp        ← đây
//   Mặc định → đúng bảng đang mở (CTRL_VIEWS[].reset)
//   Mặc định → đúng phần tử đang chỉnh (bảng chi tiết: chỉnh chữ, điều chỉnh)
// Hỏi lại trước khi gọi: nó xoá thứ của MỌI bảng một lượt (kể cả khối chữ và hoạ
// tiết đã đặt tay), mà lại bấm được từ bất kỳ bảng nào nên dễ chạm nhầm.
async function cxResetAllTheme() {
  const ok = await showConfirm(
    "Đặt lại toàn bộ thiệp?",
    "Bộ màu, chữ đã chỉnh riêng, khối văn bản, hoạ tiết, thẻ nhạc, hộp mừng cưới và " +
      "cách hiện lời chúc đều trở lại như mẫu gốc. Nội dung thiệp (tên, ngày, ảnh…) " +
      "không đổi.",
    { confirmText: "Đặt lại" },
  );
  if (!ok) return;
  resetThemeSetting();
  showToast("Đã đặt lại toàn bộ thiệp", "success");
}
window.cxResetAllTheme = cxResetAllTheme;

// Nút "Mặc định" ở ĐẦU BẢNG chỉ lo đúng bảng đang mở — mỗi bảng sở hữu một khoá
// trong `theme_setting`, xoá khoá đó là về mặc định của mẫu. Thứ cần nạp lại khung
// xem trước (khối chữ, hoạ tiết, thành phần) đi qua _resetThemePart; bộ màu áp
// được ngay, còn hộp quà / lời chúc đã có đường postMessage riêng.
// Nạp lại KHÔNG đóng bảng đang mở: _watchThemeFrame chỉ dựng lại bảng chỉnh khi
// bảng màu gốc của mẫu đổi.
function _resetThemePart(key, toast) {
  delete _themeSetting[key];
  if (key === "custom_blocks") _pruneBlockOverrides();
  _scheduleAutoSave("theme");
  _reloadThemeFrame();
  showToast(toast, "success");
}

function resetCardPalette() {
  delete _themeSetting.palette;
  const el = document.getElementById("theme-palette");
  if (el) el.value = "";
  _syncPaletteStrength();
  _scheduleAutoSave("theme");
  _applyThemeToFrame();
  showToast("Đã trả bộ màu về mặc định của mẫu", "success");
}
window.resetCardPalette = resetCardPalette;

// Khối văn bản bị xoá thì phần chỉnh riêng của nó (text_overrides["#cb_…"], kể cả
// part của mẫu văn bản: "#cb_…__<key>") thành mồ côi — không còn thẻ nào mang id
// đó, nhưng vẫn đi theo thiệp mãi mãi và phình dần theo mỗi lượt thêm–xoá.
// `keep` là danh sách khối CÒN LẠI; bỏ trống = xoá sạch (nút "Mặc định").
function _pruneBlockOverrides(keep) {
  const ov = _themeSetting.text_overrides;
  if (!ov || typeof ov !== "object") return;
  const ids = new Set((keep || []).map((b) => b && b.id).filter(Boolean));
  Object.keys(ov).forEach((sel) => {
    const m = /^#(cb_[^\s.>+~:[]*)/.exec(sel);
    if (m && !ids.has(m[1].split("__")[0])) delete ov[sel];
  });
  if (!Object.keys(ov).length) delete _themeSetting.text_overrides;
}

function resetCustomBlocks() {
  _resetThemePart("custom_blocks", "Đã xoá các khối văn bản đã thêm");
}
window.resetCustomBlocks = resetCustomBlocks;

function resetDecorations() {
  _resetThemePart("decorations", "Đã xoá hoạ tiết đã thả");
}
window.resetDecorations = resetDecorations;

// Xoá cả `music_seeded`: cờ đó nhớ "trình phát sẵn có của mẫu đã được chuyển
// thành thành phần rồi", giữ lại thì thiệp về mặc định mà vẫn không còn nút nhạc
// gốc (xem _cxElSeedThemeMusic ở core/helpers/theme-setting-helper.js).
function resetElements() {
  delete _themeSetting.music_seeded;
  _resetThemePart("elements", "Đã xoá thẻ nhạc đã thả");
}
window.resetElements = resetElements;

// Hai bảng này áp thẳng bằng postMessage; id rỗng ĐÃ là "mặc định của mẫu" nên
// dùng lại đúng đường người dùng bấm ô "Mặc định" trong bảng.
function resetGiftBox() {
  pickGiftBox(null);
  showToast("Đã trả hộp mừng cưới về mặc định của mẫu", "success");
}
window.resetGiftBox = resetGiftBox;

function resetWishMode() {
  pickWishMode(null);
  showToast("Đã trả cách hiện lời chúc về mặc định", "success");
}
window.resetWishMode = resetWishMode;

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

// Tạm dọn thanh chỉnh khỏi tầm nhìn trong lúc kéo. Gọi cả khi khung xem trước nạp
// lại và khi dựng lại bảng: nạp lại giữa lúc kéo thì pointerup không bao giờ tới,
// đây là chốt chặn để thanh chỉnh không kẹt ở trạng thái ẩn.
function _setCtrlAway(on) {
  document
    .getElementById("theme-controls")
    ?.classList.toggle("cx-ctrl-away", on);
}

// Nhận tín hiệu click text từ iframe tab Giao diện (đúng nguồn mới nhận).
window.addEventListener("message", (ev) => {
  const d = ev.data;
  if (!d) return;
  const iframe = document.getElementById("theme-preview-iframe");
  if (!iframe || ev.source !== iframe.contentWindow) return;
  if (d.type === "cx-text-pick") {
    _openLineEditor(d);
  } else if (d.type === "cx-hide") hidePickedElement(d.selector);
  // Khối văn bản đang chỉnh vừa bị xoá trong thiệp → đóng bảng chỉnh chi tiết
  else if (d.type === "cx-line-close") closeLineEditor();
  else if (d.type === "cx-blocks-changed") {
    // Runtime báo danh sách khối văn bản đã đổi → ghi vào theme_setting rồi hẹn
    // lưu nháp.
    _themeSetting.custom_blocks = Array.isArray(d.blocks) ? d.blocks : [];
    _pruneBlockOverrides(_themeSetting.custom_blocks);
    _scheduleAutoSave("theme");
  } else if (d.type === "cx-decors-changed") {
    // Hoạ tiết vừa thêm / kéo / xoay / xoá trong thiệp → lưu toạ độ mới.
    _themeSetting.decorations = Array.isArray(d.decors) ? d.decors : [];
    _scheduleAutoSave("theme");
  } else if (d.type === "cx-elements-changed") {
    // Thành phần vừa thả / kéo / phóng to / xoá → lưu, và nếu bảng điều chỉnh
    // đang mở cho chính nó thì kéo thanh trượt theo (chụm 2 ngón trên thiệp).
    _themeSetting.elements = Array.isArray(d.elements) ? d.elements : [];
    // Trình phát của theme đã chuyển thành thành phần → nhớ lại, không thì lần
    // mở sau lại dựng thêm một cái nữa dù người dùng đã xoá.
    if (d.seeded) _themeSetting.music_seeded = true;
    _scheduleAutoSave("theme");
    _syncElWidthFromCard();
    _syncElTiles();
  } else if (d.type === "cx-element-pick") {
    // Vừa BẤM ô mẫu (không kéo) → bỏ qua đúng tin này, giữ nguyên bảng chọn để
    // bấm thử mẫu khác. Kéo thả thì vẫn nhảy thẳng sang phần điều chỉnh.
    if (_elTapPending) {
      _elTapPending = false;
      clearTimeout(_elTapTimer);
    } else {
      openElementEditor(d);
    }
  } else if (d.type === "cx-element-close") {
    closeElementEditor();
  } else if (d.type === "cx-drag-busy") {
    // Đang kéo hoạ tiết/thành phần/khối văn bản trên thiệp → thanh chỉnh lui đi
    // cho thấy chỗ đang thả (chỉ có tác dụng ở mobile, xem .cx-ctrl-away).
    _setCtrlAway(!!d.on);
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
  _scheduleAutoSave("theme");
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
  document.getElementById("theme-wish-panel")?.classList.add("hidden");
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
    _fitElPreviews(box, true);
    return;
  }
  // Xem trước nằm ở trang chỉnh (ngoài iframe) nên CSS mẫu phải có ở đây nữa.
  window.CX_TEXT_PRESET_ENSURE_STYLE?.(document);
  const presets = window.CX_TEXT_PRESETS || [];
  box.textContent = "";
  presets.forEach((def) => {
    const prev = document.createElement("span");
    prev.className = "cx-pal-prev";
    const stage = document.createElement("span");
    stage.className = "cx-pal-stage";
    stage.style.width = TPL_PREVIEW_CARD_W + "px";
    const short = {};
    def.parts.forEach((p) => (short[p.key] = p.preview || p.def));
    stage.appendChild(window.CX_TEXT_PRESET_BUILD(def, short, null, true));
    prev.appendChild(stage);

    box.appendChild(
      _pickRow({
        name: def.name,
        desc: def.desc,
        lead: prev,
        title:
          def.name + (def.desc ? " — " + def.desc : "") + " (kéo vào thiệp)",
        onDrag: (e) => startPaletteDrag(e, "preset:" + def.id),
      }),
    );
  });
  box.dataset.rendered = "1";
  // Panel vừa hiện xong mới đo được kích thước ô → hoãn một nhịp.
  requestAnimationFrame(() => {
    _fitElPreviews(box, true);
    _resetCtrlScroll();
  });
}


// ─── Kéo mẫu từ bảng chọn ra thiệp (dùng chung cho Văn bản / Trang trí / Thành phần) ──
// Quy tắc: phải kéo RA KHỎI bảng chọn rồi nhả TRÊN thiệp mới tính là thả. Còn ở
// trong bảng thì cử chỉ kéo dùng để cuộn danh sách (ô mẫu đặt touch-action:none
// nên trình duyệt không tự cuộn giúp). Bấm tại chỗ mặc định KHÔNG làm gì — bảng
// nào muốn nhận cú bấm thì khai `onTap` (Thẻ nhạc dùng để đổi mẫu tại chỗ).
// Mỗi bảng chỉ khai báo việc riêng: over / cancel / drop / tap.
const PAL_DRAG_MIN = 6; // px, dưới ngưỡng này coi như chưa kéo
const PAL_HOLD_MS = 280; // giữ yên bấy lâu là nhấc ô mẫu lên, khỏi phải lôi ra khỏi bảng

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
  const fromGrip = !!e.target?.closest?.(".cx-pick-grip");
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
    holdT: 0, // hẹn giờ của cú GIỮ
  };
  // Hai đường nhấc ô mẫu mà KHÔNG phải lôi ra khỏi bảng: giữ yên một nhịp, hoặc
  // bắt đầu kéo ngay từ tay nắm. Bảng chọn vốn cao có 1/4 màn nên bắt người dùng
  // kéo vượt qua mép bảng mới nhấc được là gần như chỉ cuộn được danh sách.
  if (fromGrip) _palLift(e.clientX, e.clientY);
  else
    _palDrag.holdT = setTimeout(() => {
      const d = _palDrag;
      if (d) _palLift(d.xLast ?? d.x0, d.yLast ?? d.y0);
    }, PAL_HOLD_MS);
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

// Nhấc ô mẫu lên: dọn thanh chỉnh đi cho thấy chỗ đang thả rồi dựng bóng mờ.
// An toàn khi ẩn thanh chỉnh vì _inThemeControls chỉ được hỏi lúc CHƯA nhấc,
// còn lúc thả thì _palDragEnd xét theo rect của IFRAME — ở mobile thanh chỉnh
// nổi absolute nên iframe vốn đã cao trọn khung, ẩn nó rect không đổi.
function _palLift(x, y) {
  const d = _palDrag;
  if (!d || d.out) return;
  d.out = true;
  _setCtrlAway(true);
  // Bóng mờ = BẢN SAO của chính ô mẫu đang kéo (mờ 50%) cho dễ nhận ra.
  d.ghost = d.btn.cloneNode(true);
  d.ghost.removeAttribute("id");
  d.ghost.classList.add("cx-drag-ghost");
  d.ghost.style.width = `${d.btn.offsetWidth}px`;
  // Đặt sẵn vị trí trước khi gắn vào DOM → hiện ngay tại con trỏ, không nhảy.
  d.ghost.style.left = `${x - d.offX}px`;
  d.ghost.style.top = `${y - d.offY}px`;
  document.body.appendChild(d.ghost);
}

function _palDragMove(ev) {
  const d = _palDrag;
  if (!d) return;
  d.xLast = ev.clientX;
  d.yLast = ev.clientY;
  // Chưa nhấc: kéo dọc = cuộn danh sách, ra khỏi bảng mới tính là nhấc.
  if (!d.out) {
    if (Math.hypot(ev.clientX - d.x0, ev.clientY - d.y0) > PAL_DRAG_MIN)
      clearTimeout(d.holdT); // nhúc nhích rồi thì không còn là cú GIỮ nữa
    if (_inThemeControls(ev.clientX, ev.clientY)) {
      if (d.scroller) d.scroller.scrollTop = d.top0 - (ev.clientY - d.y0);
      return;
    }
    if (Math.hypot(ev.clientX - d.x0, ev.clientY - d.y0) < PAL_DRAG_MIN) return;
    _palLift(ev.clientX, ev.clientY);
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
    const p = _framePoint(iframe, r, ev);
    d.hooks.onOver?.(iframe, p.x, p.y);
  } else if (d.over) {
    d.over = false;
    d.hooks.onCancel?.(iframe);
  }
}

function _palDragEnd(ev) {
  const d = _palDrag;
  _palDrag = null;
  _setCtrlAway(false);
  if (!d) return;
  clearTimeout(d.holdT);
  d.ghost?.remove();
  if (d.iframe) d.iframe.style.pointerEvents = ""; // khôi phục tương tác iframe
  const iframe = d.iframe || _lineIframe();
  // Nhả tay trong bảng chọn (bấm tại chỗ, hoặc kéo rồi quay lại) → chỉ dọn dấu
  // vết. Chỉ nhả TRÊN thiệp mới tính là thả. Riêng cú BẤM (chưa từng rời ô mẫu
  // quá ngưỡng) thì gọi onTap nếu bảng có khai — kéo để cuộn danh sách đi qua
  // đúng nhánh này nên phải đo lại quãng đường, không thể chỉ xét !d.out.
  if (!d.out || !d.over || !iframe) {
    const x = ev && ev.clientX != null ? ev.clientX : d.x0;
    const y = ev && ev.clientY != null ? ev.clientY : d.y0;
    if (!d.out && Math.hypot(x - d.x0, y - d.y0) < PAL_DRAG_MIN)
      d.hooks.onTap?.();
    d.hooks.onCancel?.(iframe);
    return;
  }
  const r = iframe.getBoundingClientRect();
  const p = _framePoint(iframe, r, ev);
  d.hooks.onDrop(iframe, p.x, p.y);
}

// Điểm trên màn → toạ độ px BÊN TRONG thiệp. Iframe dựng ở khổ 390px rồi thu
// bằng transform cho vừa khung điện thoại, nên rect là khổ đã thu: lấy thẳng
// hiệu toạ độ là hoạ tiết rơi lệch đúng bằng tỉ lệ thu.
function _framePoint(iframe, r, ev) {
  const k = iframe.offsetWidth ? r.width / iframe.offsetWidth : 1;
  return {
    x: (ev.clientX - r.left) / (k || 1),
    y: (ev.clientY - r.top) / (k || 1),
  };
}

// Mẫu văn bản: lúc rê trên thiệp runtime vẽ vạch chèn theo toạ độ Y.
function startPaletteDrag(e, type) {
  _startPalDrag(e, {
    onOver: (iframe, x, y) =>
      iframe.contentWindow?.postMessage({ type: "cx-drag-over", y }, "*"),
    onCancel: (iframe) =>
      iframe?.contentWindow?.postMessage({ type: "cx-drag-cancel" }, "*"),
    onDrop: (iframe, x, y) => {
      // KHÔNG đóng bảng: runtime chọn khối vừa thả thì bảng chỉnh chữ tự chiếm
      // chỗ (nó ẩn sẵn bảng này), còn nhỡ tin pick thì người dùng vẫn đứng ở
      // bảng Văn bản để thả tiếp — rơi về nhóm chỉnh chung là mất chỗ đang làm.
      _scheduleAutoSave("theme");
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
  document.getElementById("theme-wish-panel")?.classList.add("hidden");
  _hideElementEditor();
  document.getElementById("theme-decor-panel")?.classList.remove("hidden");
  _resetCtrlScroll();
  _renderDecorPalette();
  if (window.lucide) lucide.createIcons();
}
window.openDecorPanel = openDecorPanel;


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
  _scheduleAutoSave("theme");
  _lineIframe()?.contentWindow?.postMessage({ type: "cx-add-decor", src, x, y }, "*");
}

// ─── Thành phần: bảng chọn thành phần thả lên thiệp ─────────────────────────
// Danh mục lấy từ window.CX_ELEMENTS (core/helpers/element-helper.js) nên thêm
// thành phần mới không phải sửa gì ở đây. Kéo ô mẫu ra khỏi bảng rồi thả lên
// thiệp → đặt đúng chỗ thả, xong đóng bảng và chuyển sang phần điều chỉnh. Bấm ô
// mẫu → dùng luôn mẫu đó (đổi mẫu tại chỗ nếu thiệp đã có) nhưng Ở LẠI bảng chọn,
// vì bấm là để so mẫu — muốn chỉnh thì bấm vào chính widget trên thiệp.

function openElementsPanel() {
  document.getElementById("theme-line-editor")?.classList.add("hidden");
  document.getElementById("theme-addtext-panel")?.classList.add("hidden");
  document.getElementById("theme-decor-panel")?.classList.add("hidden");
  document.getElementById("theme-gift-panel")?.classList.add("hidden");
  document.getElementById("theme-wish-panel")?.classList.add("hidden");
  _hideElementEditor();
  document.getElementById("theme-main-controls")?.classList.add("hidden");
  document.getElementById("theme-edit-hint")?.classList.add("hidden");
  document.getElementById("theme-elements-panel")?.classList.remove("hidden");
  _resetCtrlScroll();
  _renderElementsPalette();
  _syncPanelGate("elements");
  if (window.lucide) lucide.createIcons();
}
window.openElementsPanel = openElementsPanel;


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
// uniform = mọi ô dùng CHUNG một hệ số (hệ số nhỏ nhất của nhóm). Cần cho bảng
// Văn bản: các mẫu dựng ở cùng bề ngang quy chiếu nên chung hệ số là chung bề
// ngang sau khi thu → chữ của mọi ô thẳng một lề trái, và cỡ chữ giữa các mẫu
// so sánh được với nhau. Để mỗi ô tự thu thì mẫu cao bị thu nhiều hơn, nhìn
// như bị thụt vào.
function _fitElPreviews(root, uniform) {
  const boxes = [];
  (root || document).querySelectorAll(".cx-pal-prev").forEach((box) => {
    const stage = box.firstElementChild;
    if (!stage) return;
    const bw = box.clientWidth;
    const bh = box.clientHeight;
    const sw = stage.offsetWidth;
    const sh = stage.offsetHeight;
    if (!bw || !bh || !sw || !sh) return;
    boxes.push({
      stage,
      k: Math.min(bw / sw, bh / sh, EL_PREVIEW_MAX_SCALE) * EL_PREVIEW_PAD,
    });
  });
  if (!boxes.length) return;
  const min = uniform ? Math.min(...boxes.map((b) => b.k)) : 0;
  boxes.forEach((b) => {
    const k = uniform ? min : b.k;
    b.stage.style.transform = `translate(-50%, -50%) scale(${k})`;
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
      if (!panel.classList.contains("hidden"))
        _fitElPreviews(panel, id === "theme-addtext-panel");
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
    _syncElTiles();
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
      box.appendChild(
        _pickRow({
          id: def.id + ":" + v.id,
          name: v.name,
          desc: v.desc,
          lead: _elPreview(def, v),
          title:
            def.name +
            " · " +
            v.name +
            (v.desc ? " — " + v.desc : "") +
            " (bấm để dùng, hoặc kéo vào thiệp để đặt đúng chỗ)",
          onDrag: (e) => startElementDrag(e, def.id, v.id),
        }),
      );
    });
  });
  box.dataset.rendered = "1";
  _fitElPreviews(box);
  _syncElTiles();
}

// Tô sáng ô mẫu ĐANG đặt trên thiệp. Đọc _themeSetting.elements (bản đồng bộ từ
// khung xem trước qua 'cx-elements-change') nên không phải hỏi lại iframe; gọi
// lại mỗi lần danh sách đổi vì bấm ô mẫu là đổi mẫu tại chỗ mà vẫn ở lại bảng.
function _syncElTiles() {
  const box = document.getElementById("cx-elements-palette");
  if (!box) return;
  const on = new Set(
    (_themeSetting.elements || [])
      .filter((t) => t && t.element)
      .map((t) => t.element + ":" + t.variant),
  );
  box
    .querySelectorAll("[data-pick-id]")
    .forEach((b) => b.classList.toggle("is-on", on.has(b.dataset.pickId)));
}

// Kéo ô mẫu đang dùng vào giữa tầm nhìn. Tự tính scrollTop chứ không
// scrollIntoView: bảng chỉnh là thẻ NỔI, scrollIntoView cuộn lây cả khung nội
// dung phía sau và đẩy thanh trên ra khỏi màn.
function _focusElTile() {
  const body = document.getElementById("cx-ctrl-scroll");
  const row = document.querySelector("#cx-elements-palette .cx-pick-row.is-on");
  if (!body || !row) return;
  const rb = body.getBoundingClientRect();
  const rr = row.getBoundingClientRect();
  body.scrollTop = Math.max(
    0,
    body.scrollTop + rr.top - rb.top - (rb.height - rr.height) / 2,
  );
  requestAnimationFrame(() => _updateSheetFade(body));
}

// Kéo thành phần TỪ bảng chọn THẢ vào thiệp — y hệt hoạ tiết, thả ở đâu đặt ở đó.
// Bấm ô mẫu (không kéo) cũng ăn: gọi cùng đường nhưng KHÔNG kèm toạ độ, runtime
// hiểu là "dùng mẫu này" — thiệp đã có thì đổi mẫu và giữ nguyên chỗ đứng, chưa
// có thì đặt vào đầu khung đang xem (xem _cxElAdd ở theme-setting-helper.js).
// Khác kéo thả ở chỗ bảng chọn ĐỨNG YÊN sau cú bấm, để bấm tiếp mẫu khác mà so.
function startElementDrag(e, elementId, variantId) {
  _startPalDrag(e, {
    onDrop: (iframe, x, y) => _addElement(elementId, variantId, x, y),
    onTap: () => _addElement(elementId, variantId),
  });
}
window.startElementDrag = startElementDrag;

// Không đánh dấu chưa-lưu ở đây: thả trúng thành phần thiệp ĐÃ có thì runtime chỉ
// chọn nó lên chứ không sửa gì. Có thay đổi thật thì runtime tự gửi
// 'cx-elements-changed' và dấu * bật lên theo.
//
// KHÔNG toạ độ = bấm ô mẫu: áp mẫu rồi Ở LẠI bảng chọn để bấm thử mẫu khác. Runtime
// vẫn gửi 'cx-element-pick' như thường (nó không biết mình tới từ đâu) nên chặn
// đúng MỘT tin đó ở trang cha, xem _elTapPending.
let _elTapPending = false; // đang chờ nuốt tin pick của cú bấm ô mẫu
let _elTapTimer = null;

function _addElement(elementId, variantId, x, y) {
  const tap = x == null || y == null;
  if (tap) {
    _elTapPending = true;
    clearTimeout(_elTapTimer);
    // Chốt chặn: nhỡ tin pick không tới thì cờ phải tự rơi, không thì cú bấm vào
    // widget trên thiệp sau đó lại bị nuốt mất.
    _elTapTimer = setTimeout(() => (_elTapPending = false), 800);
  }
  // Thả xong runtime gửi 'cx-element-pick' → bảng điều chỉnh tự chiếm chỗ (nó
  // ẩn sẵn bảng Thẻ nhạc). KHÔNG tự đóng bảng ở đây: nhỡ tin pick thì vẫn còn
  // đứng ở bảng Thẻ nhạc chứ không rơi về nhóm chỉnh chung.
  _lineIframe()?.contentWindow?.postMessage(
    { type: "cx-add-element", element: elementId, variant: variantId, x, y },
    "*",
  );
  if (tap) return;
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
  document.getElementById("theme-wish-panel")?.classList.add("hidden");
  document.getElementById("theme-gift-panel")?.classList.remove("hidden");
  _resetCtrlScroll();
  _renderGiftPalette();
  _syncPanelGate("gift");
  if (window.lucide) lucide.createIcons();
}
window.openGiftPanel = openGiftPanel;


// `id` chính là giá trị lưu: rỗng = mặc định của mẫu, "none" = bỏ hộp.
const GIFT_FIXED = [
  {
    id: "",
    name: "Mặc định",
    // `own: true` = icon riêng của sản phẩm (core/helpers/icon.js, thẻ data-icon);
    // còn lại là tên lucide. Lẫn hai nguồn là thẻ <i> nằm im, không ai báo lỗi.
    icon: "xuxi",
    own: true,
    tone: "cx-add-ico-amber",
    desc: "Giữ nguyên như mẫu thiệp",
  },
  {
    id: "none",
    name: "Không hộp",
    icon: "qr-code",
    tone: "cx-add-ico-blue",
    desc: "Hiện thẳng mã QR, không che",
  },
];

// Ô hình bên trái của một hàng chọn: chip tròn màu, cùng bộ .cx-add-ico với cụm
// thẻ "Thêm vào thiệp" ngoài bảng chính.
function _pickIco(o) {
  const attr = o.own ? "data-icon" : "data-lucide";
  return `<span class="cx-add-ico ${o.tone}"><i ${attr}="${o.icon}"></i></span>`;
}

function _giftBoxId() {
  const v = _themeSetting.gift_box;
  return typeof v === "string" ? v : "";
}

// Hàng chọn dùng chung cho hai bảng "Hộp mừng cưới" và "Lời chúc": một cột, thẻ
// nằm ngang — ô hình bên trái (icon tròn có màu, hoặc ảnh mẫu) · tên · mô tả ·
// dấu tích ở ô đang chọn. Ô vuông 1/4 như bảng hoạ tiết quá chật cho phần mô tả,
// mà cột chỉnh kéo hẹp là chữ bị cắt; một cột thì khổ màn nào cũng vừa.
// `lead` = HTML của ô hình bên trái.
function _pickRow(o) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "cx-pick-row" + (o.onDrag ? " is-drag" : "");
  if (o.id != null) btn.dataset.pickId = o.id;
  btn.title = o.title || (o.desc ? o.name + " — " + o.desc : o.name);
  btn.innerHTML =
    '<span class="cx-pick-body">' +
    `<span class="cx-pick-name">${o.name}</span>` +
    (o.desc ? `<span class="cx-pick-desc">${o.desc}</span>` : "") +
    "</span>" +
    (o.onDrag
      ? '<i data-lucide="grip-vertical" class="cx-pick-grip !w-[14px] !h-[14px]"></i>'
      : '<span class="cx-pick-tick"><i data-lucide="check"></i></span>');
  // Ô hình bên trái: chuỗi HTML (chip icon) hoặc phần tử đã dựng (bản xem trước).
  if (typeof o.lead === "string") btn.insertAdjacentHTML("afterbegin", o.lead);
  else if (o.lead) btn.prepend(o.lead);

  if (o.onDrag) btn.addEventListener("pointerdown", o.onDrag);
  if (o.onPick) btn.addEventListener("click", () => o.onPick(o.id));
  return btn;
}

function _renderGiftPalette() {
  const grid = document.getElementById("cx-gift-palette");
  if (!grid) return;
  if (grid.dataset.rendered !== "1") {
    grid.textContent = "";
    GIFT_FIXED.forEach((o) =>
      grid.appendChild(
        _pickRow({
          id: o.id,
          name: o.name,
          desc: o.desc,
          lead: _pickIco(o),
          onPick: pickGiftBox,
        }),
      ),
    );
    (window.CX_GIFT_BOXES || []).forEach((b) => {
      // Ảnh hộp nền trong suốt → ô ca-rô để thấy đúng phần rỗng của ảnh.
      const lead =
        '<span class="cx-pick-thumb">' +
        `<img src="${b.src}" alt="${b.name}" loading="lazy" />` +
        "</span>";
      grid.appendChild(
        _pickRow({
          id: b.id,
          name: b.name,
          desc: b.desc,
          lead,
          onPick: pickGiftBox,
        }),
      );
    });
    grid.dataset.rendered = "1";
  }
  _syncGiftTiles();
}

function _syncGiftTiles() {
  const cur = _giftBoxId();
  document
    .querySelectorAll("#cx-gift-palette [data-pick-id]")
    .forEach((b) => b.classList.toggle("is-on", (b.dataset.pickId || "") === cur));
}

function pickGiftBox(id) {
  if (id) _themeSetting.gift_box = id;
  else delete _themeSetting.gift_box;
  _syncGiftTiles();
  _scheduleAutoSave("theme");

  // Áp thẳng vào khung xem trước rồi cuộn tới mục — KHÔNG nạp lại: nạp lại là
  // bảng chọn đóng mất (xem _watchThemeFrame) mà khách còn đang so mẫu. Lưu dữ
  // liệu trước, phòng khi runtime xin nạp lại bằng 'cx-gift-reload'.
  _savePreviewData();
  const win = _lineIframe()?.contentWindow;
  win?.postMessage({ type: "cx-gift-box", value: id || "" }, "*");
  win?.postMessage({ type: "cx-focus", key: "gift" }, "*");
}
window.pickGiftBox = pickGiftBox;

// ─── Lời chúc: chọn cách hiện lời chúc của khách mời ────────────────────────
// Lưu ở _themeSetting.wishes_mode (rỗng = Livestream, dạng mặc định xưa nay);
// runtime + danh mục thật nằm ở CX_WISH_MODES trong core/helpers/wishes-helper.js
// — thêm dạng mới thì khai bên đó rồi thêm một dòng vào WISH_MODES dưới đây.
// Áp thẳng vào khung xem trước bằng postMessage như hộp mừng cưới, không nạp lại.

function openWishPanel() {
  if (_addCardBlocked("wishes")) return;
  document.getElementById("theme-line-editor")?.classList.add("hidden");
  document.getElementById("theme-addtext-panel")?.classList.add("hidden");
  document.getElementById("theme-decor-panel")?.classList.add("hidden");
  document.getElementById("theme-elements-panel")?.classList.add("hidden");
  document.getElementById("theme-gift-panel")?.classList.add("hidden");
  _hideElementEditor();
  document.getElementById("theme-main-controls")?.classList.add("hidden");
  document.getElementById("theme-edit-hint")?.classList.add("hidden");
  document.getElementById("theme-wish-panel")?.classList.remove("hidden");
  _resetCtrlScroll();
  _renderWishPalette();
  if (window.lucide) lucide.createIcons();
}
window.openWishPanel = openWishPanel;


// `id` chính là giá trị lưu — rỗng = Livestream (không lưu gì cả).
const WISH_MODES = [
  {
    id: "",
    name: "Livestream",
    icon: "radio",
    // Lớp màu lấy nguyên của cụm thẻ "Thêm vào thiệp" — icon trong bảng con phải
    // cùng ngôn ngữ với icon ngoài đó, không có bộ màu riêng.
    tone: "cx-add-ico-violet",
    desc: "Lời chúc trôi lên ở góc màn hình, luôn thấy",
  },
  {
    id: "comment",
    name: "Bình luận",
    icon: "message-square",
    tone: "cx-add-ico-blue",
    desc: "Một mục ngay trên hộp mừng cưới, liệt kê hết và tự cuộn",
  },
  {
    id: "paged",
    name: "Phân trang",
    icon: "book-open",
    tone: "cx-add-ico-amber",
    desc: "Cũng ở chỗ đó nhưng mỗi lần vài lời, khách tự bấm sang trang",
  },
];

// Dạng nào cũng phải có mặt trong WISH_MODES mới chọn được — giá trị lạ (mẫu cũ,
// dữ liệu chép tay) rơi về Livestream.
function _wishModeId() {
  const v = String(_themeSetting.wishes_mode || "");
  return WISH_MODES.some((m) => m.id === v) ? v : "";
}

function _renderWishPalette() {
  const grid = document.getElementById("cx-wish-palette");
  if (!grid) return;
  if (grid.dataset.rendered !== "1") {
    grid.textContent = "";
    WISH_MODES.forEach((o) =>
      grid.appendChild(
        _pickRow({
          id: o.id,
          name: o.name,
          desc: o.desc,
          lead: _pickIco(o),
          onPick: pickWishMode,
        }),
      ),
    );
    grid.dataset.rendered = "1";
  }
  _syncWishTiles();
}

function _syncWishTiles() {
  const cur = _wishModeId();
  document
    .querySelectorAll("#cx-wish-palette [data-pick-id]")
    .forEach((b) => b.classList.toggle("is-on", (b.dataset.pickId || "") === cur));
}

function pickWishMode(id) {
  if (id) _themeSetting.wishes_mode = id;
  else delete _themeSetting.wishes_mode;
  _syncWishTiles();
  _scheduleAutoSave("theme");

  _savePreviewData();
  const win = _lineIframe()?.contentWindow;
  win?.postMessage({ type: "cx-wish-mode", value: id || "" }, "*");
  // Dạng dựng mục riêng trong thân thiệp thì cuộn tới mục đó; Livestream ghim
  // đáy khung nhìn nên chỉ cần cuộn qua màn mở đầu là dải hiện ra (CX_WISH_SHOW_AT).
  win?.postMessage({ type: "cx-focus", key: id ? "wishes" : "gift" }, "*");
}
window.pickWishMode = pickWishMode;

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
  iframe.src = _previewIframeSrc("&edit=1&shell=0");
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
  _rememberCtrlFrom();
  _elSel = msg.id;
  _elDefCur = def;
  _elOpts = Object.assign({}, msg.opts);
  _elBase = Object.assign({}, msg.base);

  document.getElementById("theme-line-editor")?.classList.add("hidden");
  document.getElementById("theme-addtext-panel")?.classList.add("hidden");
  document.getElementById("theme-decor-panel")?.classList.add("hidden");
  document.getElementById("theme-elements-panel")?.classList.add("hidden");
  document.getElementById("theme-gift-panel")?.classList.add("hidden");
  document.getElementById("theme-wish-panel")?.classList.add("hidden");
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

// Nút ← của bảng "Điều chỉnh": THÀNH PHẦN nào cũng thuộc bảng "Thẻ nhạc" nên
// luôn lùi về đó, kể cả khi vào bằng cú bấm thẳng vào widget trên thiệp — ô mẫu
// đang dùng được tô sáng và kéo vào tầm nhìn. Khác với cú BỎ CHỌN widget
// (cx-element-close): ở đó người dùng bấm ra chỗ trống nên về nhóm chỉnh chung
// mới đúng ý.
function backFromElementEditor() {
  const box = document.getElementById("theme-element-editor");
  if (!box || box.classList.contains("hidden")) return;
  _ctrlBack(closeElementEditor, "elements", _focusElTile);
}
window.backFromElementEditor = backFromElementEditor;

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
  _scheduleAutoSave("theme");
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

// Bọc ô kích thước thành thanh kéo mảnh. Chỉ chạy một lần; partial đã nằm
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

// "Mặc định" của bảng Điều chỉnh: trả widget về đúng lúc vừa thả ra — tuỳ chọn
// riêng, khổ và CẢ CHỖ ĐỨNG. Runtime lo hết (chỗ đứng mặc định phải đo mới biết)
// rồi báo lại 'cx-element-pick' → bảng tự vẽ lại control theo giá trị gốc.
function resetElementOptions() {
  _elOpts = {};
  _renderElOptions();
  _elSend({ type: "cx-element-reset" });
}
window.resetElementOptions = resetElementOptions;

function _lineIframe() {
  return document.getElementById("theme-preview-iframe");
}

function _openLineEditor(msg) {
  _rememberCtrlFrom();
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
  document.getElementById("theme-wish-panel")?.classList.add("hidden");
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

  // Bấm từ một dòng chữ sang một tấm ảnh: bảng vẫn là theme-line-editor nên
  // class không đổi, MutationObserver của _initCtrlHeadSync không bắn — phải tự
  // gọi, không thì tiêu đề đứng nguyên "Chỉnh chữ".
  _syncCtrlHead();

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

// Nút ← của bảng chỉnh chữ/ảnh. Khác bảng "Điều chỉnh": dòng chữ KHÔNG thuộc
// bảng cấp 1 nào (phần lớn là chữ sẵn có của mẫu, bấm thẳng trên thiệp mà vào)
// nên không khai `ownKey` — lùi về đúng bảng đang mở lúc vào (thả mẫu văn bản
// xong thì đó là "Văn bản"), không có thì đứng lại ở nhóm chỉnh chung.
function backFromLineEditor() {
  const box = document.getElementById("theme-line-editor");
  if (!box || box.classList.contains("hidden")) return;
  _ctrlBack(closeLineEditor);
}
window.backFromLineEditor = backFromLineEditor;

function _lineOverride() {
  if (!_themeSetting.text_overrides) _themeSetting.text_overrides = {};
  if (!_themeSetting.text_overrides[_lineSel])
    _themeSetting.text_overrides[_lineSel] = {};
  return _themeSetting.text_overrides[_lineSel];
}

// Sau mỗi thay đổi 1 dòng: hẹn lưu nháp + áp lại vào iframe preview
// (style qua applyThemeSetting, nội dung/ẩn qua applyThemeSetting + applyTextOverrides).
function _applyLine() {
  _scheduleAutoSave("theme");
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
// nằm chung một vùng cuộn nên cao bằng nhau. CHỈ CÓ HAI MỨC: mức thấp 160px cho
// đỡ che thiệp, và mức cao = nửa màn hình. Vuốt/chạm tay nắm là nhảy hẳn sang mức
// kia, buông tay giữa chừng thì trượt về mức gần nhất — không dừng lưng chừng.
// Chỉ chạy ở mobile — từ md+ cả cột chỉnh đã tự cuộn nên CSS tắt tay nắm.
// Đổi SHEET_MIN thì sửa luôn giá trị dự phòng của --cx-sheet-h ở styles/_setup.css.
const SHEET_MIN = 160; // px — mức thấp, cũng là chiều cao mặc định
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

// Mỗi màn của bảng chỉnh khai MỘT dòng ở đây: `panel` là khối nội dung (bỏ
// trống = nhóm chỉnh chung), `title` là tên màn — DÙNG CHUNG cho tiêu đề giữa
// đầu bảng lẫn nhãn nút ở dải tab, viết HÀM khi tên đổi theo thứ đang chỉnh
// (bảng "line" nhận cả chữ lẫn ảnh), `tip` là lời mách của nút đó, `back` là hàm
// cho nút ✓ Áp dụng bên phải (màn con: chỉnh chữ, điều chỉnh thành phần — không có
// tab vì chỉ mở được bằng cú bấm vào thiệp), `reset` là hàm cho nút trái — nút đó
// CHỈ trả về mặc định phần thuộc bảng này (nhãn mặc định "Mặc định", đổi bằng
// `resetTxt`); đặt lại CẢ thiệp là nút ghim "Đặt lại" ở đầu dải tab
// (cxResetAllTheme) — ba mức, ba phạm vi, đừng trộn nhãn giữa chúng.
// Xét từ TRÊN XUỐNG, màn nào không ẩn thì thắng; dòng cuối là màn mặc định.
// Thêm bảng mới → thêm một dòng ở đây + một key vào CTRL_TABS, không đụng markup
// (dải tab do _renderCtrlTabs dựng) lẫn các hàm mở/đóng bảng.
const CTRL_VIEWS = [
  {
    key: "element",
    panel: "theme-element-editor",
    title: "Điều chỉnh",
    back: "backFromElementEditor",
    reset: "resetElementOptions",
  },
  {
    key: "line",
    panel: "theme-line-editor",
    title: () => (_lineIsImage ? "Chỉnh ảnh" : "Chỉnh chữ"),
    back: "backFromLineEditor",
    reset: "clearLineOverride",
  },
  {
    key: "gift",
    panel: "theme-gift-panel",
    title: "Hộp mừng cưới",
    tip: "Chọn hộp quà che phần mã QR mừng cưới",
    open: "openGiftPanel",
    reset: "resetGiftBox",
  },
  {
    key: "wishes",
    panel: "theme-wish-panel",
    title: "Lời chúc",
    tip: "Chọn cách hiện lời chúc của khách mời",
    open: "openWishPanel",
    reset: "resetWishMode",
  },
  {
    key: "elements",
    panel: "theme-elements-panel",
    title: "Thẻ nhạc",
    tip: "Thả thẻ nhạc lên thiệp",
    open: "openElementsPanel",
    reset: "resetElements",
  },
  {
    key: "decor",
    panel: "theme-decor-panel",
    title: "Trang trí",
    tip: "Thả hoa, hoạ tiết trang trí lên thiệp",
    open: "openDecorPanel",
    reset: "resetDecorations",
  },
  {
    key: "addtext",
    panel: "theme-addtext-panel",
    title: "Văn bản",
    tip: "Thêm khối văn bản vào thiệp",
    open: "openAddTextPanel",
    reset: "resetCustomBlocks",
  },
  {
    key: "main",
    title: "Thiệp cưới",
    tip: "Đổi bộ màu của cả thiệp",
    reset: "resetCardPalette",
  },
];

// Các bảng con mở/đóng bằng cách gạt class .hidden — gom một chỗ để nhóm chỉnh
// chung dọn sạch được mà không phải kể tên từng bảng ở nhiều nơi.
const CTRL_TAB_PANELS = CTRL_VIEWS.filter((v) => v.open).map((v) => v.panel);

// Thứ tự nút ở dải tab dưới (màn con `element`/`line` không có tab: chỉ mở được
// bằng cú bấm vào thiệp). Nhãn + lời mách lấy từ CTRL_VIEWS nên chỉ khai MỘT chỗ.
const CTRL_TABS = ["main", "addtext", "decor", "elements", "gift", "wishes"];

// Màn cấp 2 vào được từ nhiều đường: bấm thẳng vào thiệp, hoặc vừa thả một thứ
// từ bảng cấp 1 ra (thả mẫu văn bản xong là nhảy luôn sang Chỉnh chữ). Ghi lại
// bảng cấp 1 đang mở lúc đó để nút ← lùi về đúng chỗ vào.
let _ctrlFrom = null;

// Chỉ nhớ bảng CÓ TAB: đang ở màn cấp 2 rồi bấm sang thứ khác trên thiệp thì
// giữ nguyên chỗ vào cũ. "main" coi như không đến từ bảng nào.
function _rememberCtrlFrom() {
  const key = _curCtrlView().key;
  if (CTRL_TABS.includes(key)) _ctrlFrom = key === "main" ? null : key;
}

// Nút ← của màn cấp 2: đóng như thường (dọn trạng thái, bật lại nhóm chỉnh
// chung) rồi mở lại bảng cấp 1 cần về. `ownKey` là bảng SỞ HỮU màn đó — khai
// thì nó thắng chỗ vào đã ghi, vì thứ đang chỉnh luôn nằm trong bảng ấy. Mở lại
// có thể bị từ chối (mục đã tắt ở tab Thiết lập); lúc đó nhóm chỉnh chung vừa
// bật vẫn đứng đó, không có gì phải dọn.
function _ctrlBack(closeFn, ownKey, focus) {
  const key = ownKey || _ctrlFrom;
  _ctrlFrom = null;
  closeFn();
  const view = CTRL_VIEWS.find((v) => v.key === key);
  if (!view || typeof window[view.open] !== "function") return;
  window[view.open]();
  // Đợi một khung hình: _syncCtrlHead chạy bằng MutationObserver, nó mới là chỗ
  // bỏ ẩn dải tab (và bung bảng nếu đang thu gọn) — đo trước đó thì vùng cuộn
  // còn cao hơn thực tế nên ô mẫu dừng lệch khỏi giữa.
  if (focus) requestAnimationFrame(focus);
}

function _ctrlTitle(view) {
  return typeof view.title === "function" ? view.title() : view.title;
}

// Dựng dải tab từ CTRL_VIEWS. Ba tab có công tắc ở tab Thiết lập mượn luôn id
// khai ở ADD_CARD_GATES để cxSyncThemeAddCards() tìm được mà làm mờ.
function _renderCtrlTabs() {
  const track = document.getElementById("cx-ctrl-tabs-track");
  if (!track) return;
  track.textContent = "";
  CTRL_TABS.forEach((key) => {
    const view = CTRL_VIEWS.find((v) => v.key === key);
    if (!view) return;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "cx-ctab";
    btn.setAttribute("role", "tab");
    btn.dataset.ctab = key;
    if (ADD_CARD_GATES[key]) btn.id = ADD_CARD_GATES[key].card;
    btn.title = view.tip || _ctrlTitle(view);
    btn.textContent = _ctrlTitle(view);
    btn.addEventListener("click", () => cxCtrlTab(key));
    track.appendChild(btn);
  });
  // Nút vừa dựng lại → tô mờ theo công tắc ở tab Thiết lập ngay, không chờ lần
  // mở tab Giao diện kế tiếp.
  cxSyncThemeAddCards();
  _syncCtrlHead();
}

let _lastCtrlHead = null;
let _ctrlView = CTRL_VIEWS[CTRL_VIEWS.length - 1];

function _curCtrlView() {
  return (
    CTRL_VIEWS.find(
      (v) =>
        v.panel && !document.getElementById(v.panel)?.classList.contains("hidden"),
    ) || CTRL_VIEWS[CTRL_VIEWS.length - 1]
  );
}

// Đổ đầu bảng + tô tab theo màn đang mở.
function _syncCtrlHead() {
  const view = _curCtrlView();
  // Đổi sang bảng khác trong lúc bảng đang thu gọn thì bung ra.
  if (_lastCtrlHead !== null && _lastCtrlHead !== view.key) _cxSheetShow?.();
  _lastCtrlHead = view.key;
  _ctrlView = view;

  const title = document.getElementById("cx-ch-title");
  if (title) title.textContent = _ctrlTitle(view);

  // Hàng nút đầu bảng chỉ giữ chỗ khi nó CÓ VIỆC: nút ✓ Áp dụng (màn chi tiết) hoặc
  // nút đặt lại của riêng bảng. Bảng nào khai cả hai đều không có thì ẩn hàng đi,
  // đỡ ăn chiều cao của thiệp. Suy từ CTRL_VIEWS nên bảng mới khai nút nào là tự đúng.
  const bare = !view.back && !view.reset;
  document.getElementById("cx-ctrl-actions")?.classList.toggle("hidden", bare);
  document.getElementById("cx-ctrl-handle")?.classList.toggle("is-bare", bare);

  // Nút đặt lại có HAI hình, cùng một việc (cxCtrlReset), chọn theo hạng màn:
  //   màn chi tiết (khai `back` — mở bằng cú bấm vào chính phần tử trên thiệp):
  //     cặp icon bên PHẢI, ↺ rồi ✓, ô trái bỏ trống;
  //   bảng theo tab: chữ "Mặc định" bên TRÁI, ô phải bỏ trống.
  const detail = !!view.back;
  // Hàng đầu bảng đổi cách xếp ở màn chi tiết từ md — xem .cx-ch-detail.
  document.getElementById("cx-ctrl-actions")?.classList.toggle("cx-ch-detail", detail);
  const reset = document.getElementById("cx-ch-reset");
  if (reset) {
    reset.classList.toggle("hidden", !view.reset || detail);
    const txt = document.getElementById("cx-ch-reset-txt");
    if (txt) txt.textContent = view.resetTxt || "Mặc định";
  }
  document
    .getElementById("cx-ch-restore")
    ?.classList.toggle("hidden", !view.reset || !detail);
  document.getElementById("cx-ch-done")?.classList.toggle("hidden", !detail);

  // Màn con (chỉnh chữ/ảnh, điều chỉnh thành phần) không ứng với tab nào → cất
  // dải tab đi, nhường chỗ cho nội dung; nút ← ở đầu bảng là đường ra. Bỏ ẩn
  // TRƯỚC vòng tô dưới đây, không thì dải còn display:none nên đo ra khổ 0 và
  // _scrollTabIntoView kéo trượt lung tung.
  document
    .getElementById("cx-ctrl-tabs")
    ?.classList.toggle("hidden", !CTRL_TABS.includes(view.key));

  document.querySelectorAll("#cx-ctrl-tabs .cx-ctab").forEach((btn) => {
    const on = btn.dataset.ctab === view.key;
    btn.setAttribute("aria-selected", on ? "true" : "false");
    btn.classList.toggle("is-on", on);
    if (on) _scrollTabIntoView(btn);
  });
  if (window.lucide) lucide.createIcons();
}

// Kéo tab đang mở vào tầm nhìn khi nó nằm khuất — chỉ trượt vừa đủ tới mép
// gần nhất, KHÔNG canh giữa. Dải tab nằm NGOÀI vùng cuộn nội dung → tự đặt
// scrollLeft cho đúng dải; scrollIntoView sẽ cuộn lây cả khung cha (xem ghi
// chú ở CLAUDE.md). Đo bằng getBoundingClientRect chứ KHÔNG dùng offsetLeft:
// dải tab không phải offsetParent (ở md+ cột chỉnh là static, mốc rơi vào
// #theme-panel) nên offsetLeft mang theo cả khoảng cách từ mép trái màn.
function _scrollTabIntoView(btn) {
  const track = document.getElementById("cx-ctrl-tabs-track");
  if (!track) return;
  const t = track.getBoundingClientRect();
  const b = btn.getBoundingClientRect();
  const pad = 12; // chừa một chút để tab không dính sát mép mờ
  let d = 0;
  if (b.left < t.left + pad) d = b.left - t.left - pad;
  else if (b.right > t.right - pad) d = b.right - t.right + pad;
  if (!d) return;
  const left = Math.max(0, track.scrollLeft + d);
  const smooth =
    !track.classList.contains("is-dragging") &&
    !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  if (smooth && track.scrollTo) track.scrollTo({ left, behavior: "smooth" });
  else track.scrollLeft = left;
}

// Kéo dải tab bằng CHUỘT để trượt (di động đã có cuộn quán tính sẵn của trình
// duyệt nên để yên). Nhả tay thì trượt tiếp theo đà rồi tắt dần, và cú kéo dài
// hơn TAB_DRAG_SLOP không được tính thành cú bấm — thả tay đúng trên một tab mà
// nó đổi bảng thì người dùng chỉ định cuộn lại thấy mình lạc sang bảng khác.
const TAB_DRAG_SLOP = 6; // px
const TAB_GLIDE_FRICTION = 0.92; // đà còn lại sau mỗi khung hình
const TAB_GLIDE_MIN_V = 0.05; // px/ms — chậm hơn mức này thì dừng hẳn

function _initCtrlTabsDrag() {
  const track = document.getElementById("cx-ctrl-tabs-track");
  if (!track) return;
  let down = false; // đang giữ chuột?
  let moved = false; // đã kéo quá ngưỡng?
  let x0 = 0; // toạ độ lúc bấm xuống
  let left0 = 0; // scrollLeft lúc bấm xuống
  let vx = 0; // vận tốc (px/ms) để tính đà
  let tPrev = 0;
  let xPrev = 0;
  let glide = 0; // id requestAnimationFrame của pha trượt theo đà

  const stopGlide = () => {
    if (glide) cancelAnimationFrame(glide);
    glide = 0;
  };

  track.addEventListener("pointerdown", (e) => {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    stopGlide();
    down = true;
    moved = false;
    x0 = xPrev = e.clientX;
    left0 = track.scrollLeft;
    vx = 0;
    tPrev = e.timeStamp;
    track.classList.add("is-dragging");
  });

  track.addEventListener("pointermove", (e) => {
    if (!down) return;
    const dx = e.clientX - x0;
    if (!moved && Math.abs(dx) > TAB_DRAG_SLOP) {
      moved = true;
      track.setPointerCapture?.(e.pointerId);
    }
    if (!moved) return;
    track.scrollLeft = left0 - dx;
    const dt = e.timeStamp - tPrev;
    if (dt > 0) vx = (e.clientX - xPrev) / dt;
    tPrev = e.timeStamp;
    xPrev = e.clientX;
    e.preventDefault();
  });

  const end = (e) => {
    if (!down) return;
    down = false;
    track.releasePointerCapture?.(e.pointerId);
    if (!moved) {
      track.classList.remove("is-dragging");
      return;
    }
    // Trượt tiếp theo đà: mỗi khung hình đi được quãng của vận tốc hiện tại rồi
    // hãm dần, chạm mép thì dừng luôn.
    let v = vx;
    let tLast = performance.now();
    const step = (now) => {
      const dt = now - tLast;
      tLast = now;
      v *= Math.pow(TAB_GLIDE_FRICTION, dt / 16.67);
      const before = track.scrollLeft;
      track.scrollLeft = before - v * dt;
      if (Math.abs(v) < TAB_GLIDE_MIN_V || track.scrollLeft === before) {
        stopGlide();
        track.classList.remove("is-dragging");
        return;
      }
      glide = requestAnimationFrame(step);
    };
    glide = requestAnimationFrame(step);
  };
  track.addEventListener("pointerup", end);
  track.addEventListener("pointercancel", end);

  // Vừa kéo xong: nuốt cú click nảy ra từ chính cử chỉ kéo đó.
  track.addEventListener(
    "click",
    (e) => {
      if (!moved) return;
      moved = false;
      e.stopPropagation();
      e.preventDefault();
    },
    true,
  );

  // Lăn chuột dọc trên dải (chuột thường không có trục ngang) → trượt ngang.
  track.addEventListener(
    "wheel",
    (e) => {
      if (e.deltaY === 0 || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      stopGlide();
      track.scrollLeft += e.deltaY;
      e.preventDefault();
    },
    { passive: false },
  );
}

// Nút trái/phải của đầu bảng: việc cụ thể do màn đang mở khai ở CTRL_VIEWS.
// Nút phải là ✓ "Áp dụng" — nhãn nói theo cách người dùng đọc, còn thực chất mọi
// thay đổi ĐÃ áp thẳng lên thiệp và đánh dấu cần lưu ngay lúc chỉnh, nên nút chỉ
// đóng màn và lùi về bảng cấp 1. Không đổi gì thì bấm ✓ cũng y như đóng — đừng
// chuyển sang kiểu "gom thay đổi rồi mới áp khi bấm", cả bảng chỉnh dựa vào việc
// xem trước đổi theo từng thao tác.
function cxCtrlBack() {
  if (_ctrlView.back) window[_ctrlView.back]?.();
}
window.cxCtrlBack = cxCtrlBack;

function cxCtrlReset() {
  if (_ctrlView.reset) window[_ctrlView.reset]?.();
}
window.cxCtrlReset = cxCtrlReset;

// Bấm tab: mở bảng tương ứng ngay tại chỗ. Bấm lại tab đang mở thì thôi, để cú
// bấm nhỡ không dựng lại danh sách mẫu (mất chỗ đang cuộn tới).
function cxCtrlTab(key) {
  const view = CTRL_VIEWS.find((v) => v.key === key);
  if (!view || _curCtrlView().key === key) return;
  if (view.open) window[view.open]?.();
  else _showMainControls();
}
window.cxCtrlTab = cxCtrlTab;

// Về nhóm chỉnh chung: dọn mọi bảng con đang mở (kể cả màn chỉnh chữ / điều
// chỉnh thành phần vốn không có tab).
function _showMainControls() {
  CTRL_TAB_PANELS.forEach((id) =>
    document.getElementById(id)?.classList.add("hidden"),
  );
  _hideElementEditor();
  closeLineEditor();
  document.getElementById("theme-main-controls")?.classList.remove("hidden");
  _resetCtrlScroll();
  _initEditHint();
}

// Bảng được ẩn/hiện ở cả chục chỗ trong file này → theo dõi thuộc tính class
// thay vì gọi tay ở từng chỗ (sót một nhánh là mất luôn nút Quay lại).
function _initCtrlHeadSync() {
  if (typeof MutationObserver === "undefined") return;
  const obs = new MutationObserver(_syncCtrlHead);
  CTRL_VIEWS.forEach((v) => {
    const el = v.panel && document.getElementById(v.panel);
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

let _cxSheetShow = null;

function _initSheet(bodyId, handleId) {
  const body = document.getElementById(bodyId);
  const handle = document.getElementById(handleId);
  if (!body || !handle) return;

  // Giữ chiều cao đã chọn ở biến riêng: lúc bảng đang ẩn thì clientHeight = 0,
  // đọc lại từ DOM sẽ tự xoá mất mức người dùng vừa kéo.
  let cur = SHEET_MIN;
  // BA mức, đều là chiều cao THẬT của vùng cuộn (panel nằm trong luồng nên hạ
  // chiều cao là thiệp nở ra ngay): 0 = thu gọn chỉ còn đầu bảng · SHEET_MIN ·
  // mức cao. Thu gọn thêm class để dải tab cùng biến mất, nếu không nó vẫn chiếm
  // một hàng dù bảng đã cụp.
  const ctrl = document.getElementById("theme-controls");
  const setH = (px, max) => {
    cur = Math.round(
      Math.min(Math.max(px, 0), max == null ? _sheetMax(body) : max),
    );
    body.style.setProperty("--cx-sheet-h", cur + "px");
    ctrl?.classList.toggle("cx-ctrl-collapsed", cur === 0);
    _updateSheetFade(body);
  };
  setH(SHEET_MIN);

  // Bấm một dòng chữ trên thiệp trong lúc bảng đang thu gọn thì phải bung ra,
  // không thì trông như cú bấm chẳng làm gì cả (_syncCtrlHead gọi).
  _cxSheetShow = () => {
    if (cur === 0) setH(SHEET_MIN);
  };

  const grip = handle.querySelector(".cx-sheet-grip");
  let drag = null;
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
    body.classList.add("is-dragging");
  });
  handle.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const dy = e.clientY - drag.y0;
    if (!drag.moved && Math.abs(dy) < SHEET_DRAG_MIN) return;
    drag.moved = true;
    setH(drag.h0 - dy, drag.max); // kéo lên (dy âm) = cao lên; setH tự kẹp hai đầu
  });
  const end = () => {
    if (!drag) return;
    body.classList.remove("is-dragging");
    const max = drag.max;
    if (!drag.moved) {
      // Chạm không vuốt: đang thu gọn thì bung về mức thấp, còn lại nhảy sang
      // mức kia (thấp ↔ cao). Thu gọn hẳn thì phải vuốt.
      if (drag.h0 === 0) setH(SHEET_MIN, max);
      else setH(drag.h0 >= max - 4 ? SHEET_MIN : max, max);
    } else {
      // Vuốt rồi thì bám về mức gần chỗ buông tay nhất — không dừng lưng chừng.
      const stops = [0, SHEET_MIN, max];
      setH(
        stops.reduce((a, b) => (Math.abs(b - cur) < Math.abs(a - cur) ? b : a)),
        max,
      );
    }
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
  _renderCtrlTabs();
  _initCtrlTabsDrag();
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
  if (document.getElementById("ps-style")) return;
  // Cố ý KHÔNG nạp Google Fonts: popup dùng đúng font của trang (Inter) để chữ
  // chúc mừng đọc được ngay, không phải chờ font chữ nghệ thuật tải xong.
  const s = document.createElement("style");
  s.id = "ps-style";
  s.textContent = `
    #publish-success-modal{position:fixed;inset:0;z-index:300;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(58,26,34,.55);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px)}
    #publish-success-modal button,#publish-success-modal a{cursor:pointer}
    #publish-success-modal :focus-visible{outline:2px solid #e11d48;outline-offset:2px}
    /* 92dvh sau 92vh: trên di động vh tính lúc thanh công cụ ẨN nên có thể cao hơn phần nhìn thấy. */
    .ps-card{width:100%;max-width:400px;max-height:92vh;max-height:92dvh;overflow-y:auto;background:#fff;border-radius:20px;border-top:3px solid #fb7185;box-shadow:0 24px 64px -16px rgba(74,44,53,.45);animation:ps-in .4s cubic-bezier(.22,.9,.3,1) both}
    @keyframes ps-in{from{opacity:0;transform:translateY(16px) scale(.98)}to{opacity:1;transform:none}}
    /* Đầu thẻ MỘT hàng (dấu tích · tiêu đề + tên đôi · nút đóng): xếp dọc tốn gần 200px. */
    .ps-head{display:flex;align-items:center;gap:12px;padding:16px 12px 0 16px}
    .ps-badge{flex-shrink:0;width:40px;height:40px;border-radius:999px;display:flex;align-items:center;justify-content:center;color:#fff;background:linear-gradient(135deg,rgb(var(--state-success-accent-rgb)),rgb(var(--state-success-text-rgb)));box-shadow:0 8px 18px -8px rgb(var(--state-success-accent-rgb) / .65);animation:ps-pop .45s .08s cubic-bezier(.22,1.3,.45,1) both}
    @keyframes ps-pop{from{opacity:0;transform:scale(.6)}to{opacity:1;transform:none}}
    .ps-head-text{flex:1;min-width:0}
    .ps-congrats{font-size:16px;font-weight:700;line-height:1.3;color:#4a2c35;margin:0}
    .ps-couple{display:flex;align-items:center;gap:6px;margin-top:2px;font-size:13px;font-weight:600;color:#9b7d86;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .ps-couple svg{flex-shrink:0}
    .ps-x{flex-shrink:0;align-self:flex-start;width:32px;height:32px;display:inline-flex;align-items:center;justify-content:center;border-radius:999px;color:#b39aa1;background:transparent;transition:color .15s ease,background .15s ease}
    .ps-x:hover{color:#4a2c35;background:#f5ece8}
    .ps-body{padding:14px 16px 16px}
    /* Mỗi link một dòng: tên + URL xếp chồng bên trái, 2 nút icon bên phải. */
    .ps-link{display:flex;align-items:center;gap:10px;border:1px solid #f1e6ea;border-radius:12px;padding:8px 8px 8px 12px}
    .ps-link+.ps-link{margin-top:6px}
    .ps-link-text{flex:1;min-width:0}
    .ps-link-label{font-size:14px;font-weight:600;line-height:1.25;color:#4a2c35}
    /* 1 dòng + cắt đuôi: link nhà trai dài hơn; link đủ vẫn nằm ở nút Sao chép. */
    .ps-url{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;line-height:1.3;color:#9b7d86;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .ps-acts{display:flex;gap:6px;flex-shrink:0}
    .ps-soft{width:34px;height:34px;border-radius:10px;display:inline-flex;align-items:center;justify-content:center;border:1px solid #ffd9e1;color:#e11d48;background:#fff;transition:background .15s ease,border-color .15s ease}
    .ps-soft:hover{background:#fff1f4;border-color:#ffc4d2}
    .ps-soft i{width:16px;height:16px}
    .ps-guests{width:100%;height:40px;margin-top:8px;border-radius:12px;display:inline-flex;align-items:center;justify-content:center;gap:8px;font-size:14px;font-weight:600;color:#e11d48;background:#fff5f7;border:1px solid #ffe0e8;transition:background .15s ease}
    .ps-guests:hover{background:#ffecf1}
    .ps-guests i{width:16px;height:16px}
    .ps-keep{font-size:12px;line-height:1.45;color:#7d5a64;margin:12px 0 0;padding:8px 10px;border-radius:10px;background:#faf6f7}
    .ps-keep b{color:#b8425f;font-weight:600}
    .ps-warn{color:#9a3412;background:#fff7ed;border:1px solid #fed7aa}
    .ps-warn b{color:#9a3412}
    /* Hàng nút cuối: phụ (Để sau / Hoàn tất) bên trái, chính bên phải. */
    .ps-foot{display:flex;gap:8px;margin-top:10px}
    .ps-primary{flex:1.6;height:44px;border-radius:12px;display:inline-flex;align-items:center;justify-content:center;gap:6px;font-size:14px;font-weight:600;color:#fff;background:#e11d48;border:none;white-space:nowrap;transition:background .15s ease}
    .ps-primary:hover{background:#c81742}
    .ps-primary i{width:16px;height:16px}
    .ps-done{flex:1;height:44px;border-radius:12px;display:inline-flex;align-items:center;justify-content:center;font-size:14px;font-weight:600;color:#7d5a64;background:#f7f0e8;border:1px solid #f0e4d4;white-space:nowrap;transition:background .15s ease,color .15s ease}
    .ps-done:hover{background:#f1e7db;color:#4a2c35}
    /* Màn cực thấp (xoay ngang): bỏ dòng URL, Sao chép vẫn chép đủ link. */
    @media (max-height:520px){
      #publish-success-modal{padding:8px}
      .ps-card{max-height:96dvh}
      .ps-url{display:none}
    }
    @media (prefers-reduced-motion:reduce){.ps-card,.ps-badge{animation:none}}`;
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

  // Có đủ tên → dòng "Chú rể ♥ Cô dâu" dưới tiêu đề; thiếu thì bỏ.
  const coupleHtml =
    groom && bride
      ? `<div class="ps-couple">${esc(groom)} ${HEART("#fb7185", 11)} ${esc(bride)}</div>`
      : "";

  const linkRow = (label, url) => `
    <div class="ps-link">
      <div class="ps-link-text">
        <div class="ps-link-label">${label}</div>
        <div class="ps-url">${url.replace(/^https?:\/\//, "")}</div>
      </div>
      <div class="ps-acts">
        <x-button variant="bare" type="button" class="ps-soft" data-ps-open="${url}" title="Xem thử" aria-label="Xem thử ${label}"><i data-lucide="eye"></i></x-button>
        <x-button variant="bare" type="button" class="ps-soft" data-ps-copy="${url}" title="Sao chép" aria-label="Sao chép ${label}"><i data-lucide="copy"></i></x-button>
      </div>
    </div>`;

  const linksHtml = familyOn
    ? linkRow("Thiệp nhà gái", generalUrl) + linkRow("Thiệp nhà trai", groomUrl)
    : linkRow("Link thiệp cưới", generalUrl);

  // Đã thanh toán (IS_THEME_LOCKED) → không mời thanh toán nữa, nút chính là Khách mời.
  // Chưa thanh toán → nút chính là "Thanh toán ngay", "Để sau" chỉ đóng popup.
  const paid = IS_THEME_LOCKED;
  // Thiệp hết hạn dùng thử: xuất bản lại KHÔNG mở khoá (edge function vẫn chặn link
  // công khai) → nói thẳng ở đây, không thì chủ thiệp thấy link chết mà không hiểu vì sao.
  const keepHtml = paid
    ? ""
    : IS_TRIAL_LOCKED
      ? `<p class="ps-keep ps-warn">Thiệp đã <b>hết hạn dùng thử</b>: khách mời mở link chỉ thấy màn tạm khoá.
         Thanh toán để mở lại — để quá ${CONFIG.retention.unpaidDays} ngày thiệp sẽ tự động xoá.</p>`
      : `<p class="ps-keep">Thanh toán để giữ thiệp lâu dài — thiệp chưa thanh toán <b>tự động xoá sau ${CONFIG.retention.unpaidDays} ngày</b> kể từ khi hết hạn dùng thử.</p>`;

  const guestsBtn = `<x-button variant="bare" type="button" class="${paid ? "ps-primary" : "ps-guests"}" data-ps-guests><i data-lucide="users"></i>Quản lý khách mời</x-button>`;
  const footHtml = paid
    ? `<div class="ps-foot">
         <x-button variant="bare" type="button" class="ps-done" data-ps-close>Hoàn tất</x-button>
         ${guestsBtn}
       </div>`
    : `${guestsBtn}
       ${keepHtml}
       <div class="ps-foot">
         <x-button variant="bare" type="button" class="ps-done" data-ps-close>Để sau</x-button>
         <x-button variant="bare" type="button" class="ps-primary" data-ps-pay><i data-lucide="credit-card"></i>Thanh toán ngay</x-button>
       </div>`;

  const modal = document.createElement("div");
  modal.id = "publish-success-modal";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-labelledby", "ps-title");
  modal.innerHTML = `
    <div class="ps-card">
      <div class="ps-head">
        <div class="ps-badge" aria-hidden="true"><i data-lucide="check" style="width:22px;height:22px"></i></div>
        <div class="ps-head-text">
          <h2 class="ps-congrats" id="ps-title">Thiệp đã sẵn sàng!</h2>
          ${coupleHtml}
        </div>
        <x-button variant="bare" type="button" data-ps-close class="ps-x" aria-label="Đóng"><i data-lucide="x" style="width:18px;height:18px"></i></x-button>
      </div>
      <div class="ps-body">
        ${linksHtml}
        ${footHtml}
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
    // chạm ra ngoài mà mất là phải mò lại. Chỉ ✕ và "Hoàn tất"/"Để sau" mới đóng.
    if (e.target.closest("[data-ps-close]")) return close();
    if (e.target.closest("[data-ps-pay]")) {
      close();
      openPaymentForDraft();
      return;
    }
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
