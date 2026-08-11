// Vỏ trang thiết lập: hàng logo/breadcrumb tự thu khi cuộn xuống, và popover
// "Tùy chọn" ở navbar dưới (Trợ lý AI + Giao diện).

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

// ===== POPOVER "THÊM" =====

// Chừa mép màn hình khi thẻ phải dịch vào trong.
const _CX_POP_EDGE = 8;

/**
 * Đặt thẻ giữa tâm nút ⋯ rồi kẹp trong #nav-card (thẻ nền của navbar — hẹp hơn
 * màn hình), mũi tên vẫn chỉ đúng nút. Phải đo lại mỗi lần mở: navbar co giãn
 * theo bề ngang, và dưới sm nhãn "Tùy chọn" ẩn đi làm nút hẹp lại.
 */
function _cxPlacePop(pop, btn) {
  if (!btn) return;
  const w = pop.offsetWidth;
  const b = btn.getBoundingClientRect();
  const center = b.left + b.width / 2; // toạ độ MÀN HÌNH
  // `left` của thẻ tính trong lòng #nav-card (gốc toạ độ của nó), nên phải trừ
  // đi mép trái thẻ nền — navbar không còn bám mép trái màn hình nữa.
  const host = pop.offsetParent || document.getElementById("nav-card");
  const hr = host?.getBoundingClientRect();
  const x0 = hr?.left || 0;
  const hw = hr?.width || window.innerWidth;
  const left = Math.min(
    Math.max(center - x0 - w / 2, _CX_POP_EDGE),
    hw - w - _CX_POP_EDGE,
  );
  pop.style.left = left + "px";
  // Mũi tên: px tính từ mép trái thẻ, chừa chỗ cho góc bo.
  const tail = Math.min(Math.max(center - x0 - left, 20), w - 20);
  pop.style.setProperty("--cx-pop-tail", tail + "px");
}

/** Mở/đóng popover; không truyền gì là đảo trạng thái (dùng cho onclick). */
function cxNavMore(open) {
  const pop = document.getElementById("nav-more-pop");
  const btn = document.getElementById("nav-more");
  if (!pop) return;
  const next = open === undefined ? pop.classList.contains("hidden") : open;
  pop.classList.toggle("hidden", !next);
  btn?.setAttribute("aria-expanded", String(next));
  if (next) _cxPlacePop(pop, btn);
}
window.cxNavMore = cxNavMore;

function _cxInitMore() {
  const pop = document.getElementById("nav-more-pop");
  const btn = document.getElementById("nav-more");
  if (!pop || !btn) return;

  // Chọn xong một mục thì đóng — popover che mất chính panel vừa mở.
  pop.addEventListener("click", (e) => {
    if (e.target.closest("button")) cxNavMore(false);
  });

  // Bấm ra ngoài / Esc. Nghe ở pha CAPTURE để đóng được cả khi click bị nút bên
  // dưới nuốt mất.
  document.addEventListener(
    "click",
    (e) => {
      if (pop.classList.contains("hidden")) return;
      if (e.target.closest("#nav-more-pop, #nav-more")) return;
      cxNavMore(false);
    },
    true,
  );
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") cxNavMore(false);
  });

  window.addEventListener(
    "resize",
    () => {
      if (!pop.classList.contains("hidden")) _cxPlacePop(pop, btn);
    },
    { passive: true },
  );
}

function _cxInitShell() {
  _cxInitTuck();
  _cxInitMore();
}

if (window.__cxOnReady) window.__cxOnReady(_cxInitShell);
else if (document.readyState === "loading")
  document.addEventListener("DOMContentLoaded", _cxInitShell);
else _cxInitShell();
