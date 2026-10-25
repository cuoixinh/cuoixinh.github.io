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
// nhìn gốc) nên trang VẪN cuộn được bằng mã: focus một ô (ô giờ, ô địa điểm…) là
// iOS đẩy cả trang lên mà khách không kéo lại được. Trang này không bao giờ cuộn
// → thấy lệch là trả ngay về 0; bàn phím ĐÈ lên giao diện chứ không đẩy nó, ô
// đang gõ tự né bằng `data-kb` (core/helpers/kb-avoid.js). Ba đường lệch phải gác:
// cuộn của khung nhìn gốc, cuộn của các khung cha #setup-scroll (sự kiện không
// nổi lên window → nghe ở pha capture), và độ dịch của visualViewport mà iOS hay
// để kẹt sau khi bàn phím thu (lúc đó scrollY vẫn là 0).
function _cxPinPage() {
  const vv = window.visualViewport;
  // Tính cả ô trong iframe cùng origin (popup tab Khách mời) — activeElement ở đây chỉ là thẻ <iframe>.
  const typing = () => !!window.cxKb?.typingEl();
  const reset = () => {
    const se = document.scrollingElement;
    // Đang gõ thì để iOS giữ con trỏ trong tầm nhìn; thu bàn phím rồi mới kéo về.
    const vvShifted = vv && (vv.offsetTop || vv.offsetLeft) && !typing();
    if (window.scrollX || window.scrollY || se?.scrollTop || vvShifted) window.scrollTo(0, 0);
    if (document.body.scrollTop) document.body.scrollTop = 0;
  };
  window.addEventListener("scroll", reset, { passive: true });
  document.addEventListener(
    "scroll",
    (e) => {
      const el = e.target;
      if (el.nodeType === 1 && el.scrollTop && el.contains(document.getElementById("setup-scroll")) && el.id !== "setup-scroll") {
        el.scrollTop = 0;
      }
    },
    { capture: true, passive: true },
  );
  // iOS cuộn bù SAU khi bàn phím thu lại → chờ vài nhịp rồi mới trả.
  document.addEventListener("focusout", () => {
    setTimeout(reset, 60);
    setTimeout(reset, 400);
  });
  vv?.addEventListener("resize", reset);
  vv?.addEventListener("scroll", reset);
}

function _cxInitShell() {
  _cxInitTopHeight();
  _cxInitReflow();
  _cxPinPage();
}

if (window.__cxOnReady) window.__cxOnReady(_cxInitShell);
else if (document.readyState === "loading")
  document.addEventListener("DOMContentLoaded", _cxInitShell);
else _cxInitShell();
