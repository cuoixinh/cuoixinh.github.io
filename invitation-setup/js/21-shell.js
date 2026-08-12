// Vỏ trang thiết lập: popover "Tùy chọn" ở navbar dưới và cơ chế FILL ĐỘNG —
// mục nào còn chỗ thì đứng thẳng ở navbar, hết chỗ mới lùi vào popover.

// ===== FILL ĐỘNG CHO NAVBAR =====

// Thứ tự ưu tiên: đứng trước thì trụ lại navbar lâu hơn, mục cuối lùi trước.
// `pin` = ghim cứng ở navbar, không bao giờ vào popover.
const CX_NAV_ITEMS = [
  { id: "tab-config", pin: true },
  { id: "tab-guests" },
  { id: "tab-theme" },
  { id: "nav-ai-btn" },
];

/**
 * Hàng nav còn vừa không. Các cụm trong hàng đều KHÔNG co dưới bề ngang nội dung
 * (nhãn `whitespace-nowrap` + min-width ở styles/_setup.css) nên lúc chật, tổng
 * bề ngang con vượt hẳn ra ngoài — dùng đúng dấu hiệu đó, không đo scrollWidth.
 */
function _cxNavFits(row) {
  let sum = 0;
  for (const el of row.children) sum += el.getBoundingClientRect().width;
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
  _cxInitMore();
  _cxInitReflow();
}

if (window.__cxOnReady) window.__cxOnReady(_cxInitShell);
else if (document.readyState === "loading")
  document.addEventListener("DOMContentLoaded", _cxInitShell);
else _cxInitShell();
