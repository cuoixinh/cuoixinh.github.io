/**
 * Tooltip dùng chung, nền đen, có arrow, tự chọn vị trí.
 * Thêm `data-tooltip="Nội dung"` vào phần tử bất kỳ; vị trí ưu tiên qua
 * `data-tooltip-pos="top|bottom|left|right"` (mặc định "top").
 * Một singleton dùng lại cho mọi phần tử; tự lật phía khi thiếu chỗ và kẹp trong
 * khung nhìn.
 */
(function () {
  if (window.__cxTooltipReady) return;
  window.__cxTooltipReady = true;

  const GAP = 8; // khoảng cách target ↔ tooltip (px)
  const EDGE = 8; // lề an toàn với mép màn hình (px)
  const ARROW = 6; // nửa cạnh arrow (px)

  const style = document.createElement("style");
  style.textContent = `
    #cx-tip {
      position: fixed; z-index: 2147483646; top: 0; left: 0;
      max-width: 240px; padding: 8px 12px;
      background: #111827; color: #fff;
      font-size: 12px; line-height: 1.5; font-weight: 500; font-family: inherit;
      border-radius: 8px; box-shadow: 0 4px 16px rgba(0,0,0,.24);
      pointer-events: none; opacity: 0; transform: translateY(2px);
      transition: opacity .12s ease, transform .12s ease;
      white-space: normal; word-break: break-word;
    }
    #cx-tip.visible { opacity: 1; transform: translateY(0); }
    #cx-tip::after {
      content: ""; position: absolute;
      border: ${ARROW}px solid transparent;
    }
    /* Arrow theo phía đặt tooltip (data-place trên #cx-tip) */
    #cx-tip[data-place="top"]::after    { top: 100%; left: var(--arrow-x, 50%); transform: translateX(-50%); border-top-color: #111827; }
    #cx-tip[data-place="bottom"]::after { bottom: 100%; left: var(--arrow-x, 50%); transform: translateX(-50%); border-bottom-color: #111827; }
    #cx-tip[data-place="left"]::after   { left: 100%; top: var(--arrow-y, 50%); transform: translateY(-50%); border-left-color: #111827; }
    #cx-tip[data-place="right"]::after  { right: 100%; top: var(--arrow-y, 50%); transform: translateY(-50%); border-right-color: #111827; }
    @media (prefers-reduced-motion: reduce) { #cx-tip { transition: none; } }
  `;
  document.head.appendChild(style);

  const tip = document.createElement("div");
  tip.id = "cx-tip";
  tip.setAttribute("role", "tooltip");
  document.body.appendChild(tip);

  let currentTarget = null;

  function place(target) {
    const r = target.getBoundingClientRect();
    const pref = target.getAttribute("data-tooltip-pos") || "top";
    const tw = tip.offsetWidth;
    const th = tip.offsetHeight;
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;

    // Chỗ trống mỗi phía → quyết định có đủ để đặt không.
    const fit = {
      top: r.top >= th + GAP + EDGE,
      bottom: vh - r.bottom >= th + GAP + EDGE,
      left: r.left >= tw + GAP + EDGE,
      right: vw - r.right >= tw + GAP + EDGE,
    };
    // Thứ tự lật: ưu tiên phía yêu cầu, rồi phía đối diện, rồi còn lại.
    const opposite = { top: "bottom", bottom: "top", left: "right", right: "left" };
    const order = [pref, opposite[pref], "top", "bottom", "right", "left"];
    let place = order.find((p) => fit[p]) || pref;

    let left, top;
    if (place === "top" || place === "bottom") {
      left = r.left + r.width / 2 - tw / 2;
      left = Math.max(EDGE, Math.min(left, vw - tw - EDGE));
      top = place === "top" ? r.top - th - GAP : r.bottom + GAP;
      // Arrow bám tâm target theo trục ngang (tính theo toạ độ trong tooltip).
      const arrowX = r.left + r.width / 2 - left;
      tip.style.setProperty("--arrow-x", Math.max(ARROW * 2, Math.min(arrowX, tw - ARROW * 2)) + "px");
    } else {
      top = r.top + r.height / 2 - th / 2;
      top = Math.max(EDGE, Math.min(top, vh - th - EDGE));
      left = place === "left" ? r.left - tw - GAP : r.right + GAP;
      const arrowY = r.top + r.height / 2 - top;
      tip.style.setProperty("--arrow-y", Math.max(ARROW * 2, Math.min(arrowY, th - ARROW * 2)) + "px");
    }

    tip.setAttribute("data-place", place);
    tip.style.left = Math.round(left) + "px";
    tip.style.top = Math.round(top) + "px";
  }

  function show(target) {
    const text = target.getAttribute("data-tooltip");
    if (!text) return;
    currentTarget = target;
    tip.textContent = text;
    // Reset arrow offset trước khi đo lại.
    tip.style.removeProperty("--arrow-x");
    tip.style.removeProperty("--arrow-y");
    place(target); // đo & đặt (tip đã có kích thước vì luôn nằm trong DOM)
    tip.classList.add("visible");
  }

  function hide() {
    currentTarget = null;
    tip.classList.remove("visible");
  }

  // Ủy quyền sự kiện — phần tử thêm/bớt động vẫn hoạt động.
  document.addEventListener("mouseover", (e) => {
    const t = e.target.closest?.("[data-tooltip]");
    if (t && t !== currentTarget) show(t);
  });
  document.addEventListener("mouseout", (e) => {
    const t = e.target.closest?.("[data-tooltip]");
    if (t && t === currentTarget && !t.contains(e.relatedTarget)) hide();
  });
  document.addEventListener("focusin", (e) => {
    const t = e.target.closest?.("[data-tooltip]");
    if (t) show(t);
  });
  document.addEventListener("focusout", () => hide());
  // Cuộn/đổi kích thước khi đang hiện → ẩn để tránh lệch vị trí.
  window.addEventListener("scroll", () => currentTarget && hide(), true);
  window.addEventListener("resize", () => currentTarget && hide());

  window.CxTooltip = { hide };
})();
