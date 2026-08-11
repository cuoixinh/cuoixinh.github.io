// Vỏ trang thiết lập: hàng logo tự thu khi cuộn xuống, và ngăn kéo hành động phụ
// ở navbar dưới (vuốt lên / bấm tay nắm để mở).
//
// Chiều cao navbar do _syncNavHeight() (13-data.js) đo qua ResizeObserver, nên mở
// ngăn kéo là --nav-h tự lớn theo — cặp nút #step-nav và thẻ AI tự dịch lên.

// ===== HÀNG LOGO TỰ THU =====

const _CX_TUCK = {
  MIN_Y: 72, // dưới mức này luôn hiện — đầu trang không việc gì phải giấu
  DELTA: 6, // rung vài px do đà cuộn thì bỏ qua, không đảo trạng thái
  ROOM: 64, // phải còn ngần này chỗ cuộn phía dưới mới cho thu (xem _cxSetTucked)
  SETTLE: 320, // > transition của .cx-topbar-row
};

let _cxLastY = 0;
let _cxTucked = false;
let _cxTuckLock = false;

function _cxSetTucked(on) {
  if (on === _cxTucked) return;
  _cxTucked = on;
  document.getElementById("setup-header")?.classList.toggle("is-tucked", on);
  // Thu/mở làm tài liệu ngắn/dài đi 48px → trình duyệt tự kẹp lại scrollY, và cú
  // kẹp đó lại bắn một sự kiện scroll NGƯỢC CHIỀU, đủ để lật ngược trạng thái →
  // lặp vô tận. Khoá một nhịp rồi lấy lại mốc sau khi layout đã ổn định.
  _cxTuckLock = true;
  setTimeout(() => {
    _cxLastY = window.scrollY;
    _cxTuckLock = false;
  }, _CX_TUCK.SETTLE);
}

function _cxOnScroll() {
  if (_cxTuckLock) return;
  const y = window.scrollY;
  const dy = y - _cxLastY;
  if (Math.abs(dy) < _CX_TUCK.DELTA) return;
  _cxLastY = y;
  if (dy < 0 || y <= _CX_TUCK.MIN_Y) return void _cxSetTucked(false);
  // Sát đáy trang thì thôi: thu lại là tài liệu ngắn hơn phần đã cuộn, trình
  // duyệt kéo ngược về và người dùng thấy trang tự giật.
  const room = document.documentElement.scrollHeight - window.innerHeight - y;
  _cxSetTucked(room > _CX_TUCK.ROOM);
}

function _cxInitTuck() {
  if (!document.getElementById("setup-header")) return;
  _cxLastY = window.scrollY;
  window.addEventListener("scroll", _cxOnScroll, { passive: true });
}

// ===== NGĂN KÉO NAVBAR =====

// Vuốt dọc quá ngần này (px) trên tay nắm/navbar mới tính là mở/đóng.
const _CX_DRAWER_SWIPE = 24;

let _cxDrawerOpen = false;

function _cxDrawerEl() {
  return document.getElementById("nav-extra");
}

/**
 * Mở/đóng ngăn kéo. Chiều cao lúc mở phải ĐO rồi ghi inline: nội dung hàng này
 * có thể đổi (thêm hành động, chữ xuống dòng) nên hằng số trong CSS sẽ sai.
 */
function cxNavExtra(open) {
  const el = _cxDrawerEl();
  if (!el || open === _cxDrawerOpen) return;
  _cxDrawerOpen = open;
  el.classList.toggle("is-open", open);
  el.style.height = open ? el.scrollHeight + "px" : "";
  const grip = document.getElementById("nav-grip");
  if (grip) {
    grip.setAttribute("aria-expanded", String(open));
    grip.setAttribute(
      "aria-label",
      open ? "Thu gọn hành động" : "Mở thêm hành động",
    );
  }
}
window.cxNavExtraOpen = () => cxNavExtra(true);

function _cxInitDrawer() {
  const bar = document.getElementById("bottom-nav-bar");
  const grip = document.getElementById("nav-grip");
  if (!bar || !grip || !_cxDrawerEl()) return;

  // Vuốt dọc ở BẤT KỲ đâu trên navbar: mép trên vốn hẹp, bắt mỗi tay nắm thì
  // khó trúng. Chỉ nhận cảm ứng/bút — kéo chuột dọc trên navbar là thao tác
  // bình thường của desktop.
  let y0 = null;
  let swiped = false;

  bar.addEventListener(
    "pointerdown",
    (e) => {
      y0 = e.pointerType === "mouse" ? null : e.clientY;
      swiped = false;
    },
    { passive: true },
  );
  bar.addEventListener(
    "pointerup",
    (e) => {
      if (y0 === null) return;
      const dy = e.clientY - y0;
      y0 = null;
      if (Math.abs(dy) < _CX_DRAWER_SWIPE) return;
      swiped = true;
      cxNavExtra(dy < 0); // kéo lên mở, kéo xuống đóng
    },
    { passive: true },
  );
  bar.addEventListener("pointercancel", () => {
    y0 = null;
  });

  // Trình duyệt vẫn bắn `click` sau chuỗi chạm, kể cả khi ngón đã trượt xa. Nuốt
  // ở pha CAPTURE trên cả navbar: không thì cú vuốt bắt đầu trên tay nắm sẽ tự
  // lật ngược trạng thái, còn cú vuốt bắt đầu trên một nút trong ngăn kéo sẽ bấm
  // nhầm chính nút đó (mở popup AI, mở bảng chọn mẫu…).
  bar.addEventListener(
    "click",
    (e) => {
      if (!swiped) return;
      swiped = false;
      e.stopPropagation();
      e.preventDefault();
    },
    true,
  );

  grip.addEventListener("click", () => cxNavExtra(!_cxDrawerOpen));

  // Nội dung hàng đổi (đổi mẫu thiệp → nhãn dài ra) khi đang mở → đo lại.
  if (window.ResizeObserver) {
    new ResizeObserver(() => {
      const el = _cxDrawerEl();
      if (_cxDrawerOpen && el) el.style.height = el.scrollHeight + "px";
    }).observe(_cxDrawerEl().firstElementChild);
  }
}

function _cxInitShell() {
  _cxInitTuck();
  _cxInitDrawer();
}

if (window.__cxOnReady) window.__cxOnReady(_cxInitShell);
else if (document.readyState === "loading")
  document.addEventListener("DOMContentLoaded", _cxInitShell);
else _cxInitShell();
