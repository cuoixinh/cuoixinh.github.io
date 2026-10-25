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

// ===== BÀN PHÍM ẢO =====

// iOS cuộn CẢ TRANG để ô được focus lọt khung (cả ô readonly như ô giờ) rồi không
// kéo về — app shell không cuộn nên khách kẹt ở đó. Đây là chỗ duy nhất được đụng
// cuộn của trang: trả nó về 0, không phải để đưa phần tử vào tầm nhìn.
// Chỉ ô GÕ được mới bung bàn phím; ô readonly giữ focus không phải lý do để chờ.
// Focus nằm trong iframe (tab Khách mời) thì không biết bên trong ra sao → coi như đang gõ.
function _cxIsField(el) {
  if (!el || el.readOnly || el.disabled) return false;
  const tag = el.tagName;
  return (
    tag === "IFRAME" ||
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    el.isContentEditable
  );
}

function _cxResetPageScroll() {
  if (_cxIsField(document.activeElement)) return; // phím vẫn đang bung
  const doc = document.scrollingElement || document.documentElement;
  if (window.scrollY || doc.scrollTop || document.body.scrollTop) {
    window.scrollTo(0, 0);
    doc.scrollTop = 0;
    document.body.scrollTop = 0;
  }
}

function _cxInitKeyboardReset() {
  // Chờ một nhịp: focus nhảy sang ô kế tiếp thì phím không cụp, đừng kéo trang.
  document.addEventListener("focusout", () => setTimeout(_cxResetPageScroll, 120));
  // Phím cụp xong (khung nhìn cao trở lại) — bắt cả lúc iOS cuộn bù sau focusout.
  window.visualViewport?.addEventListener("resize", _cxResetPageScroll);
  // Trang trôi mà không có bàn phím (focus ô readonly…) thì kéo về ngay.
  window.addEventListener("scroll", _cxResetPageScroll, { passive: true });
}

function _cxInitShell() {
  _cxInitTopHeight();
  _cxInitReflow();
  _cxInitKeyboardReset();
}

if (window.__cxOnReady) window.__cxOnReady(_cxInitShell);
else if (document.readyState === "loading")
  document.addEventListener("DOMContentLoaded", _cxInitShell);
else _cxInitShell();
