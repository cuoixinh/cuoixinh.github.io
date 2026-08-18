/**
 * showTour — spotlight tour đơn giản.
 * steps: [{ selector, title, desc }] — chuyển bước bằng nút "Tiếp" trong tip.
 * options: { storageKey?, onDone?(completed), dismissOnTargetClick? }
 *   dismissOnTargetClick: click vào phần tử spotlight thì đóng tour, KHÔNG chặn
 *     hành động gốc (vd bấm "Thử ngay" trong thẻ AI vẫn mở bảng AI).
 */
function showTour(steps, { storageKey, onDone, dismissOnTargetClick } = {}) {
  if (storageKey && getCache(storageKey)) return;

  let current  = 0;
  let prevEl   = null;
  let targetClick = null; /* { el, fn } — listener capture trên phần tử spotlight */

  const overlay = document.createElement("div");
  overlay.style.cssText = "position:fixed;inset:0;z-index:9000;background:rgb(var(--scrim-plum-rgb)/0.6);pointer-events:all";

  const tip = document.createElement("div");
  tip.style.cssText = "position:fixed;z-index:9002;background:rgb(var(--white-rgb));border-radius:14px;padding:14px 16px 12px;width:268px;box-shadow:0 8px 32px rgb(var(--scrim-plum-rgb)/.18);font-family:inherit";

  const ARROW = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>`;

  document.body.append(overlay, tip);

  function highlight(el) {
    /* fixed/sticky parents create their own stacking context — raise them instead */
    let p = el.parentElement;
    while (p && p !== document.body) {
      const pos = getComputedStyle(p).position;
      if (pos === "fixed" || pos === "sticky") {
        el._tourAncestor  = p;
        el._tourAncestorZ = p.style.zIndex;
        p.style.zIndex    = "9001";
        break;
      }
      p = p.parentElement;
    }
    el.style.position     = "relative";
    el.style.zIndex       = el._tourAncestor ? "2" : "9001";
    el.style.boxShadow    = "0 0 0 3px rgb(var(--brand-accent-rgb)/0.9), 0 0 0 7px rgb(var(--brand-accent-rgb)/0.15)";
    el.style.borderRadius = "12px";
  }

  function unhighlight(el) {
    if (el._tourAncestor) {
      el._tourAncestor.style.zIndex = el._tourAncestorZ || "";
      el._tourAncestor  = null;
      el._tourAncestorZ = null;
    }
    el.style.position     = "";
    el.style.zIndex       = "";
    el.style.boxShadow    = "";
    el.style.borderRadius = "";
  }

  /* Đặt tip cạnh phần tử theo hướng còn đủ chỗ (dưới → trên → phải → trái),
     rồi LUÔN kẹp trong viewport để không bao giờ bị khuất mép — kể cả khi phần
     tử cao hơn màn hình. */
  function placeTip(el) {
    const r    = el.getBoundingClientRect();
    const GAP  = 12;
    const M    = 12; /* lề an toàn với mép màn */
    const vw   = window.innerWidth;
    const vh   = window.innerHeight;
    const tipW = tip.offsetWidth  || 268;
    const tipH = tip.offsetHeight || 160;

    const spaceBelow = vh - r.bottom;
    const spaceAbove = r.top;
    const spaceRight = vw - r.right;
    const spaceLeft  = r.left;

    let top, left;
    if (spaceBelow >= tipH + GAP) {
      top = r.bottom + GAP;                 left = r.left;                     /* dưới */
    } else if (spaceAbove >= tipH + GAP) {
      top = r.top - tipH - GAP;             left = r.left;                     /* trên */
    } else if (spaceRight >= tipW + GAP) {
      left = r.right + GAP;                 top = r.top + r.height / 2 - tipH / 2; /* phải */
    } else if (spaceLeft >= tipW + GAP) {
      left = r.left - tipW - GAP;           top = r.top + r.height / 2 - tipH / 2; /* trái */
    } else {
      /* không đủ chỗ phía nào — chọn phía dọc rộng hơn */
      top  = spaceBelow >= spaceAbove ? r.bottom + GAP : r.top - tipH - GAP;
      left = r.left;
    }

    tip.style.left = Math.max(M, Math.min(left, vw - tipW - M)) + "px";
    tip.style.top  = Math.max(M, Math.min(top,  vh - tipH - M)) + "px";
  }

  function renderTip(el) {
    const isLast = current === steps.length - 1;
    const multi  = steps.length > 1; /* một bước thì bỏ "1 / 1" + vạch tiến trình */
    const step   = steps[current];
    tip.innerHTML = `
      ${multi ? `<div style="font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:rgb(var(--text-heading-rgb)/.38);margin-bottom:5px">${current + 1} / ${steps.length}</div>` : ""}
      <div style="font-size:14px;font-weight:600;color:rgb(var(--scrim-plum-rgb));margin-bottom:3px">${step.title}</div>
      <div style="font-size:12px;line-height:1.65;color:rgb(var(--text-heading-rgb)/.58);margin-bottom:10px">${step.desc}</div>
      ${multi ? `<div style="display:flex;gap:5px;margin-bottom:10px">${steps.map((_, i) =>
        `<div style="height:3px;flex:1;border-radius:2px;background:${i <= current ? "rgb(var(--brand-accent-rgb))" : "rgb(var(--brand-accent-rgb)/.2)"}"></div>`
      ).join("")}</div>` : ""}
      <div style="display:flex;align-items:center;justify-content:space-between">
        <x-button variant="bare" id="t-skip" style="font-size:12px;color:rgb(var(--text-heading-rgb)/.38);background:none;border:none;cursor:pointer;padding:0;${isLast ? "visibility:hidden" : ""}">Bỏ qua</x-button>
        <x-button variant="bare" id="t-next" style="font-size:12px;font-weight:600;color:rgb(var(--white-rgb));background:rgb(var(--brand-accent-rgb));border:none;cursor:pointer;padding:5px 14px;border-radius:999px;display:inline-flex;align-items:center;gap:4px">${isLast ? "Xong" : "Tiếp"} ${ARROW}</x-button>
      </div>`;

    tip.querySelector("#t-next").onclick = advance;
    tip.querySelector("#t-skip").onclick = () => finish(false);
    placeTip(el);
  }

  /* Sang bước kế; bước cuối → hoàn tất. */
  function advance() {
    if (current < steps.length - 1) { current++; go(); }
    else finish(true);
  }

  function clearTargetClick() {
    if (targetClick) {
      targetClick.el.removeEventListener("click", targetClick.fn, true);
      targetClick = null;
    }
  }

  function go() {
    if (prevEl) unhighlight(prevEl);
    clearTargetClick();
    const step = steps[current];
    const el = document.querySelector(step.selector);
    if (!el) return;
    el.scrollIntoView({ block: "nearest", behavior: "smooth" });
    highlight(el);
    renderTip(el);
    prevEl = el;
    if (dismissOnTargetClick) {
      /* Capture phase: bắt được click cả khi nút con gọi stopPropagation
         (vd nút "Thử ngay" trong thẻ AI). Đóng tour rồi để hành động gốc chạy. */
      const fn = () => finish(true);
      el.addEventListener("click", fn, true);
      targetClick = { el, fn };
    }
  }

  function finish(completed) {
    clearTargetClick();
    if (prevEl) unhighlight(prevEl);
    if (storageKey) setCache(storageKey, true);
    overlay.remove();
    tip.remove();
    if (typeof onDone === "function") onDone(!!completed);
  }

  /* Click ra ngoài overlay KHÔNG đóng tour — chỉ chặn xuyên click xuống trang. */
  overlay.onclick = (e) => { e.preventDefault(); e.stopPropagation(); };
  go();
}
