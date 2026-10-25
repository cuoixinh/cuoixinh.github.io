// Vỏ trang thiết lập: chiều cao thanh trên, popover "Tùy chọn" ở navbar dưới và
// cơ chế FILL ĐỘNG — mục nào còn chỗ thì đứng thẳng ở navbar, hết chỗ mới lùi
// vào popover.

// ===== CHIỀU CAO THANH TRÊN =====

// --cx-top-h = chiều cao thật của khối sticky trên cùng (đã gồm lề trên). Vùng
// nội dung ở giữa trừ đúng phần này để không cuộn ra ngoài màn (xem #setup-scroll).
function _cxSyncTopHeight() {
  const bar = document.getElementById("setup-topbar");
  if (!bar) return;
  document.documentElement.style.setProperty(
    "--cx-top-h",
    `${bar.offsetHeight}px`,
  );
}

function _cxInitTopHeight() {
  const bar = document.getElementById("setup-topbar");
  if (!bar) return;
  _cxSyncTopHeight();
  // Thanh bước xuống dòng / breadcrumb dài ra khi đổi khổ màn → đo lại.
  if (window.ResizeObserver) new ResizeObserver(_cxSyncTopHeight).observe(bar);
  else window.addEventListener("resize", _cxSyncTopHeight, { passive: true });
}

// ===== FILL ĐỘNG CHO NAVBAR =====

// Thứ tự ưu tiên: đứng trước thì trụ lại navbar lâu hơn, mục cuối lùi trước.
// `pin` = ghim cứng ở navbar, không bao giờ vào popover.
const CX_NAV_ITEMS = [
  { id: "tab-config", pin: true },
  { id: "tab-guests" },
  { id: "tab-theme" },
  { id: "tab-ai" },
];

/**
 * Hàng nav còn vừa không. Các cụm trong hàng đều khai `flex-none` nên lúc chật,
 * tổng bề ngang con vượt hẳn ra ngoài — dùng đúng dấu hiệu đó. Vẫn lấy thêm
 * `scrollWidth` làm mức sàn: WebKit vẫn ép được khung flex lồng nhau co xuống
 * dưới bề ngang nội dung, khi đó rect của cụm nhỏ hơn thứ nó đang chứa nên phép
 * cộng báo "vừa" trong lúc icon cuối đã chui xuống dưới nút bên cạnh.
 */
function _cxNavFits(row) {
  let sum = 0;
  for (const el of row.children)
    sum += Math.max(el.getBoundingClientRect().width, el.scrollWidth);
  return sum <= row.clientWidth + 1;
}

function _cxNavToPop(el, pop) {
  el.setAttribute("role", "menuitem");
  pop.prepend(el); // bốc từ mục cuối nên chèn đầu mới giữ đúng thứ tự ưu tiên
}

/**
 * Xếp lại chỗ đứng cho các mục nav theo bề ngang hiện có. Tính lại TỪ ĐẦU (dồn
 * hết về navbar rồi mới bốc dần vào popover) nên gọi bao nhiêu lần cũng ra cùng
 * kết quả. Popover rỗng thì ẩn luôn nút "Tùy chọn".
 */
function cxNavReflow() {
  const row = document.getElementById("nav-row");
  const slots = document.getElementById("nav-slots");
  const pop = document.getElementById("nav-more-pop");
  const wrap = document.getElementById("nav-more-wrap");
  if (!row || !slots || !pop || !wrap) return;

  cxNavMore(false); // đang mở mà rút mục ra thì popover hoá rỗng giữa chừng

  CX_NAV_ITEMS.forEach(({ id }) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.removeAttribute("role");
    slots.appendChild(el);
  });
  wrap.classList.add("hidden");

  const movable = CX_NAV_ITEMS.filter((it) => !it.pin);
  for (let i = movable.length - 1; i >= 0 && !_cxNavFits(row); i--) {
    const el = document.getElementById(movable[i].id);
    if (!el) continue;
    _cxNavToPop(el, pop);
    // Hiện nút ngay: chính nó cũng chiếm chỗ, vòng sau phải đo cả phần đó.
    wrap.classList.remove("hidden");
  }

  // Trạng thái đang mở / dấu * chưa lưu dội lên nút "Tùy chọn" khi mục bị khuất.
  if (typeof _syncNavItemState === "function") _syncNavItemState();
}
window.cxNavReflow = cxNavReflow;

function _cxInitReflow() {
  const card = document.getElementById("nav-card");
  if (!card) return;
  cxNavReflow();

  // Font muộn làm nhãn rộng ra → đo lại, nếu không navbar chật mà tưởng còn chỗ.
  document.fonts?.ready.then(cxNavReflow);

  // Bề ngang thẻ đổi cả khi bật/tắt dải xem trực tiếp chứ không riêng lúc xoay
  // màn → theo dõi chính thẻ. Chỉ chạy khi bề ngang thật sự khác: reflow không
  // đụng tới kích thước thẻ nên không có vòng lặp, nhưng chốt cho chắc.
  let lastW = -1;
  const onResize = () => {
    const w = Math.round(card.getBoundingClientRect().width);
    if (w === lastW) return;
    lastW = w;
    cxNavReflow();
  };
  if (window.ResizeObserver) new ResizeObserver(onResize).observe(card);
  else window.addEventListener("resize", onResize, { passive: true });
}

// ===== POPOVER "TÙY CHỌN" =====

/**
 * Mở/đóng popover; không truyền gì là đảo trạng thái (dùng cho onclick).
 * Thẻ là <x-popover> (core/x-popover.js) — nó tự lo định vị theo nút ⋯, mũi
 * tên, đóng khi bấm ra ngoài / Esc / chọn một mục.
 */
function cxNavMore(open) {
  const pop = document.getElementById("nav-more-pop");
  if (!pop?.toggle) return;
  if (open === undefined) pop.toggle();
  else if (open) pop.open();
  else pop.close();
}
window.cxNavMore = cxNavMore;

// ===== GHIM TRANG Ở GỐC =====

// `overflow: clip` trên <html> bị trình duyệt hiểu thành `hidden` (luật của khung
// nhìn gốc) nên trang VẪN cuộn được bằng mã: focus một ô gần đáy (ô giờ, ô tìm
// bản đồ…) là iOS đẩy cả trang lên mà khách không kéo lại được. Trang này không
// bao giờ cuộn → thấy lệch là trả ngay về 0; bàn phím ĐÈ lên giao diện chứ
// không đẩy nó (Android lo bằng `interactive-widget` ở thẻ viewport).
function _cxPinPage() {
  const reset = () => {
    if (window.scrollX || window.scrollY) window.scrollTo(0, 0);
    const se = document.scrollingElement;
    if (se && se.scrollTop) se.scrollTop = 0;
    if (document.body.scrollTop) document.body.scrollTop = 0;
  };
  window.addEventListener("scroll", reset, { passive: true });
  // iOS cuộn bù SAU khi bàn phím thu lại → chờ một nhịp rồi mới trả.
  document.addEventListener("focusout", () => setTimeout(reset, 60));
  window.visualViewport?.addEventListener("resize", reset);
}

// ===== Ô ĐANG GÕ TRÁNH BÀN PHÍM =====

// Bàn phím đè lên vỏ trang (navbar, thanh bước đứng yên); riêng ô đang gõ trong
// #setup-scroll mà nằm dưới mép bàn phím thì CUỘN KHUNG NỘI DUNG tới nó. Phần
// khung bị che bù bằng padding đáy .cx-setup-body, không thì ô cuối form không
// cuộn lên nổi. Popup đáy có cơ chế riêng (_liftSheetOverKeyboard ở core/utils.js).
const CX_TYPING_SEL =
  "textarea, [contenteditable], input:not([readonly]):not([type=checkbox]):not([type=radio]):not([type=file]):not([type=hidden])";

function _cxKeyboardAvoid() {
  const vv = window.visualViewport;
  const sc = document.getElementById("setup-scroll");
  const body = sc?.querySelector(".cx-setup-body");
  if (!vv || !sc || !body) return;

  let pad = 0;
  let lastEl = null;
  let lastCovered = 0;
  const setPad = (px) => {
    if (px === pad) return;
    pad = px;
    body.style.paddingBottom = px ? `${px}px` : "";
  };

  const update = () => {
    const el = document.activeElement;
    if (!el || !sc.contains(el) || !el.matches(CX_TYPING_SEL)) {
      lastEl = null;
      lastCovered = 0;
      return setPad(0);
    }
    const kbTop = vv.offsetTop + vv.height;
    const covered = Math.max(0, Math.round(sc.getBoundingClientRect().bottom - kbTop));
    setPad(covered);
    // Chỉ cuộn khi đổi ô hoặc bàn phím cao thêm — khách tự cuộn lúc đang gõ thì để yên.
    if (!covered || (el === lastEl && covered <= lastCovered)) return;
    lastEl = el;
    lastCovered = covered;
    const over = el.getBoundingClientRect().bottom - (kbTop - 16);
    if (over > 0) sc.scrollTop += over;
  };

  sc.addEventListener("focusin", update);
  sc.addEventListener("focusout", () => setTimeout(update, 0));
  vv.addEventListener("resize", update);
}

function _cxInitShell() {
  _cxInitTopHeight();
  _cxInitReflow();
  _cxPinPage();
  _cxKeyboardAvoid();
}

if (window.__cxOnReady) window.__cxOnReady(_cxInitShell);
else if (document.readyState === "loading")
  document.addEventListener("DOMContentLoaded", _cxInitShell);
else _cxInitShell();
