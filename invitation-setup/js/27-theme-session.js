// Phiên chỉnh tab Giao diện: vào tab là mở phiên, chỉ "Hoàn tất" (hoặc "Lưu lại"
// khi được hỏi) mới tính là áp dụng; rời tab mà còn thay đổi thì hỏi Lưu lại / Huỷ,
// Huỷ là trả `_themeSetting` về bản đã áp dụng gần nhất. Dưới md phiên giấu navbar
// (cờ .cx-theme-mode) nên lối ra là "Hoàn tất" hoặc nút Back — phiên đẩy sẵn một
// mốc lịch sử để Back quay về tab trước thay vì rời trang.

let _tsOpen = false;
// Bản đã áp dụng (JSON khoá xếp thứ tự), chụp ở cú chạm ĐẦU TIÊN vào tab chứ không
// lúc mở: khung thiệp vừa nạp còn tự báo về vài thứ (thẻ nhạc gốc của mẫu thành
// thành phần…) — chụp sớm thì chưa làm gì đã bị hỏi. null = chưa chạm gì.
let _tsBase = null;
let _tsSnap = null; // cờ chưa lưu lúc chụp, để Huỷ trả luôn dấu * về như cũ
let _tsReturn = "edit";
let _tsHist = false; // mốc lịch sử của phiên còn nằm trên đỉnh?
let _tsPending = null; // tab chờ mở sau khi lùi xong mốc lịch sử
let _tsPendTimer = 0;

const TS_RETURN_TABS = ["edit", "preview", "config", "guests"];

function _tsStable(v) {
  if (Array.isArray(v)) return `[${v.map(_tsStable).join(",")}]`;
  if (v && typeof v === "object")
    return `{${Object.keys(v)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${_tsStable(v[k])}`)
      .join(",")}}`;
  return JSON.stringify(v) ?? "null";
}

function _tsTouch() {
  if (!_tsOpen || _tsBase !== null) return;
  _tsBase = _tsStable(_themeSetting);
  _tsSnap = {
    theme: _dirtyTabs.has("theme"),
    dirty: _isDirty,
    demo: _demoFilled,
  };
}

function _tsChanged() {
  return _tsOpen && _tsBase !== null && _tsStable(_themeSetting) !== _tsBase;
}

function _tsPush() {
  const u = new URL(location.href);
  u.searchParams.set("tab", "theme");
  history.pushState(null, "", u);
  _tsHist = true;
}

// switchTab() gọi khi mở tab Giao diện (trước khi nó ghi ?tab= vào URL).
function _cxThemeEnter() {
  if (_tsOpen) return;
  _tsOpen = true;
  _tsBase = null;
  _tsReturn = TS_RETURN_TABS.includes(_activeTab) ? _activeTab : "edit";
  document.documentElement.classList.add("cx-theme-mode");
  _tsPush();
}

// Lưu thiệp thành công (_setDirty(false)) = đã chốt đúng thứ đang thấy.
function _cxThemeSaved() {
  _tsBase = null;
}

// Đóng phiên. true = còn phải lùi mốc lịch sử trước, tab `tab` sẽ mở sau popstate.
function _tsClose(tab) {
  _tsOpen = false;
  _tsBase = null;
  document.documentElement.classList.remove("cx-theme-mode");
  if (!_tsHist) return false;
  _tsHist = false;
  _tsPending = tab;
  history.back();
  // Trình duyệt bỏ qua back() (mốc đã mất) thì vẫn phải mở tab.
  _tsPendTimer = setTimeout(_tsRunPending, 500);
  return true;
}

function _tsRunPending() {
  clearTimeout(_tsPendTimer);
  const tab = _tsPending;
  _tsPending = null;
  if (tab) switchTab(tab);
}

function _tsRevert() {
  _themeSetting = JSON.parse(_tsBase);
  if (!_tsSnap.theme) {
    _dirtyTabs.delete("theme");
    if (!_dirtyTabs.size && !_tsSnap.dirty) {
      _setDirty(false);
      _demoFilled = _tsSnap.demo;
    } else _updateDirtyMarks();
  }
  // Nháp chỉ nằm trong máy đã ghi bản vừa chỉnh → ghi lại bản cũ ngay.
  if (!IS_PUBLISHED) {
    clearTimeout(_autoSaveTimer);
    _doAutoSave();
  }
}

// fromBack: người dùng bấm Back (mốc lịch sử đã bị lấy) — bỏ qua hộp thoại thì
// đẩy lại mốc để lần Back sau vẫn hỏi.
async function _tsAsk(tab, fromBack) {
  const r = await showConfirm(
    "Lưu thay đổi giao diện?",
    "Giao diện chỉnh sửa đang có thay đổi. Bạn có muốn lưu lại thay đổi?",
    { confirmText: "Lưu lại", cancelText: "Huỷ" },
  );
  if (r === null) {
    if (fromBack && _tsOpen) _tsPush();
    return;
  }
  if (r) showToast("Đã lưu thay đổi giao diện", "success");
  else {
    _tsRevert();
    showToast("Đã huỷ thay đổi giao diện", "info");
  }
  if (!_tsClose(tab)) switchTab(tab);
}

// Đầu switchTab()/openGuestsPage(): true = đã chặn (đang hỏi, hoặc chờ lùi lịch sử).
function _cxThemeGuard(tab) {
  if (!_tsOpen || tab === "theme") return false;
  if (_tsChanged()) {
    _tsAsk(tab);
    return true;
  }
  return _tsClose(tab);
}

// Nút "Hoàn tất" ở đầu mọi bảng theo tab.
function cxThemeFinish() {
  if (_tsChanged()) showToast("Đã áp dụng thay đổi giao diện", "success");
  _tsBase = null;
  if (!_tsClose(_tsReturn)) switchTab(_tsReturn);
}
window.cxThemeFinish = cxThemeFinish;

window.addEventListener("popstate", () => {
  if (_tsPending) return _tsRunPending();
  if (!_tsOpen || !_tsHist) return;
  _tsHist = false;
  if (_tsChanged()) _tsAsk(_tsReturn, true);
  else {
    _tsClose(_tsReturn);
    switchTab(_tsReturn);
  }
});

// Gõ URL khác / đóng thẻ: trình duyệt chỉ cho hiện hộp thoại mặc định của nó.
window.addEventListener("beforeunload", (e) => {
  if (!_tsChanged()) return;
  e.preventDefault();
  e.returnValue = "";
});

// "Chạm" = nhấn/gõ trong tab, kể cả trong khung thiệp (cùng origin nên gắn thẳng
// được vào document của nó; mỗi lần khung nạp lại là document mới).
(function _tsWatchTouch() {
  const opts = { capture: true, passive: true };
  const on = (root) => {
    root?.addEventListener("pointerdown", _tsTouch, opts);
    root?.addEventListener("keydown", _tsTouch, opts);
  };
  on(document.getElementById("theme-panel"));
  const frame = document.getElementById("theme-preview-iframe");
  frame?.addEventListener("load", () => {
    try {
      on(frame.contentDocument);
    } catch (e) {}
  });
})();
