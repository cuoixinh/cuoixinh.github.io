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

// ===== BÀN PHÍM ẢO: MÀN ĐỨNG YÊN =====
// Bàn phím chỉ được ĐÈ lên màn, không được đẩy navbar lên hay co vùng nội dung:
// chiều cao vỏ khoá ở --cx-app-h (không đo lại khi đang gõ), navbar neo theo số
// đó (xem #bottom-nav-bar trong styles/_setup.css). Ô sắp bị bàn phím che thì tự
// cuộn khung nội dung đưa nó lên nửa trên — để trình duyệt khỏi đẩy cả trang.

const _cxTouch = !!window.matchMedia?.("(pointer: coarse)").matches;
const _CX_KB_TYPES = ["text", "search", "email", "tel", "url", "number", "password"];

// Ô gõ chữ thật sự bật bàn phím (bỏ checkbox, màu, ngày… và ô chỉ đọc).
function _cxIsTypingEl(el) {
  if (!el) return false;
  if (el.isContentEditable) return true;
  if (el.tagName === "TEXTAREA") return !el.readOnly;
  return el.tagName === "INPUT" && !el.readOnly && _CX_KB_TYPES.includes(el.type);
}

// Đổi bề ngang (xoay máy) thì đo lại kể cả lúc đang gõ; chỉ đổi chiều cao khi
// đang gõ là bàn phím bung/thu → bỏ qua.
let _cxAppW = 0;
function _cxSyncAppHeight() {
  const w = window.innerWidth;
  if (w === _cxAppW && _cxTouch && _cxIsTypingEl(document.activeElement)) return;
  _cxAppW = w;
  document.documentElement.style.setProperty(
    "--cx-app-h",
    `${window.innerHeight}px`,
  );
}

function _cxKbFocus(e) {
  const el = e.target;
  if (!_cxTouch || !_cxIsTypingEl(el)) return;
  const sc = document.getElementById("setup-scroll");
  if (!sc?.contains(el)) return;
  // Cờ .cx-kb chừa thêm khoảng trống cuối khung → ô ở cuối bước vẫn cuộn lên được.
  document.documentElement.classList.add("cx-kb");
  const r = el.getBoundingClientRect();
  // Bàn phím (kèm thanh gợi ý) chiếm ~nửa dưới màn dựng đứng.
  if (r.bottom <= window.innerHeight * 0.45) return;
  const pad = parseFloat(getComputedStyle(sc).scrollPaddingTop) || 0;
  sc.scrollTop += r.top - sc.getBoundingClientRect().top - pad - 16;
}

function _cxKbBlur() {
  // Chờ một nhịp: chuyển sang ô kế tiếp thì bàn phím vẫn còn, giữ nguyên cờ.
  setTimeout(() => {
    if (_cxIsTypingEl(document.activeElement)) return;
    document.documentElement.classList.remove("cx-kb");
  }, 0);
}

function _cxInitKeyboard() {
  _cxSyncAppHeight();
  window.addEventListener("resize", _cxSyncAppHeight, { passive: true });
  document.addEventListener("focusin", _cxKbFocus);
  document.addEventListener("focusout", _cxKbBlur);
}

function _cxInitShell() {
  _cxInitKeyboard();
  _cxInitTopHeight();
  _cxInitReflow();
}

if (window.__cxOnReady) window.__cxOnReady(_cxInitShell);
else if (document.readyState === "loading")
  document.addEventListener("DOMContentLoaded", _cxInitShell);
else _cxInitShell();
