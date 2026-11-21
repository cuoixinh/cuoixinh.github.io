// Né bàn phím ảo cho ô đang gõ — khai bằng attribute trên khung chứa ô (gần nhất thắng):
//   data-kb="scroll" khung cuộn: bù padding đáy (vào con [data-kb-pad] nếu có) rồi cuộn tới ô
//   data-kb="lift"   lớp nền popup (fixed inset-0): nâng bằng padding đáy, hộp [data-kb-box] co lại + tự cuộn
//   data-kb="shift"  tấm neo đáy (absolute/fixed): dời `bottom` lên mép bàn phím
// data-kb-media giới hạn theo khổ màn; data-kb-room trên ô = chừa thêm chỗ dưới ô (dropdown).
(function () {
  if (window.cxKb) return;

  const TYPING_SEL =
    "textarea, [contenteditable], input:not([readonly]):not([type=checkbox]):not([type=radio]):not([type=file]):not([type=hidden])";
  const GAP = 16; // khoảng hở giữa ô và mép bàn phím

  // Trang gốc cùng origin: chỉ visualViewport của nó mới co theo bàn phím — iframe
  // (tab Khách mời) giữ nguyên khổ nên phải đo qua trang cha.
  let TOP = window;
  try {
    while (TOP.parent !== TOP && TOP.parent.document) TOP = TOP.parent;
  } catch (_) {}

  // Mép trên bàn phím (đáy vùng còn nhìn thấy) theo toạ độ của trang NÀY.
  function visibleBottom() {
    const vv = TOP.visualViewport;
    let y = vv ? vv.offsetTop + vv.height : TOP.innerHeight;
    for (let w = window; w !== TOP && w.frameElement; w = w.parent) {
      y -= w.frameElement.getBoundingClientRect().top + w.frameElement.clientTop;
    }
    return Math.min(window.innerHeight, y);
  }

  // Ô đang gõ, kể cả khi nó nằm trong iframe cùng origin (activeElement của trang cha là thẻ <iframe>).
  function typingEl() {
    let el = document.activeElement;
    try {
      while (el && el.tagName === "IFRAME") el = el.contentDocument?.activeElement;
    } catch (_) {
      return null;
    }
    return el?.matches?.(TYPING_SEL) ? el : null;
  }

  function hostOf(el) {
    for (let n = el.parentElement; n; n = n.parentElement) {
      if (!n.dataset.kb) continue;
      const media = n.dataset.kbMedia;
      if (media && !window.matchMedia(media).matches) continue;
      return n;
    }
    return null;
  }

  // Khung cuộn gần nhất của ô, dừng ở `stop`.
  function scrollerOf(el, stop) {
    for (let n = el.parentElement; n; n = n.parentElement) {
      const oy = getComputedStyle(n).overflowY;
      if ((oy === "auto" || oy === "scroll") && n.scrollHeight > n.clientHeight) return n;
      if (n === stop) break;
    }
    return null;
  }

  // Cuộn `sc` cho ô lộ trên `limit`, ưu tiên chừa thêm data-kb-room bên dưới nhưng
  // không đẩy mép trên ô lọt dưới scroll-padding-top (thanh dính đầu khung).
  function reveal(sc, el, limit) {
    const sr = sc.getBoundingClientRect();
    const er = el.getBoundingClientRect();
    const room = Number(el.dataset.kbRoom) || 0;
    const top = sr.top + (parseFloat(getComputedStyle(sc).scrollPaddingTop) || 0) + 8;
    const bottom = Math.min(limit, sr.bottom) - GAP;
    const d = Math.max(er.bottom - bottom, Math.min(er.bottom + room - bottom, er.top - top));
    if (d > 0) sc.scrollTop += d;
  }

  // Trạng thái của khung đang né: { host, mode, px (đang bù), base, lastEl, lastCov }.
  let cur = null;

  function set(s, px) {
    if (px === s.px) return;
    const h = s.host;
    if (s.mode === "shift") {
      if (!s.px) s.base = parseFloat(getComputedStyle(h).bottom) || 0;
      h.style.bottom = px ? `${s.base + px}px` : "";
    } else {
      const padEl = (s.mode === "scroll" && h.querySelector("[data-kb-pad]")) || h;
      if (!s.px) s.base = parseFloat(getComputedStyle(padEl).paddingBottom) || 0;
      padEl.style.paddingBottom = px ? `${s.base + px}px` : "";
      const box = s.mode === "lift" && h.querySelector("[data-kb-box]");
      if (box) {
        const padTop = parseFloat(getComputedStyle(h).paddingTop) || 0;
        box.style.maxHeight = px ? `${Math.max(120, h.clientHeight - padTop - s.base - px)}px` : "";
        box.style.overflowY = px ? "auto" : "";
      }
    }
    s.px = px;
  }

  const MODES = {
    scroll(s, el, kbTop) {
      const cov = Math.max(0, Math.round(s.host.getBoundingClientRect().bottom - kbTop));
      set(s, cov);
      // Chỉ cuộn khi đổi ô hoặc bàn phím cao thêm — khách tự cuộn lúc đang gõ thì để yên.
      if (!el || !cov || (el === s.lastEl && cov <= s.lastCov)) return;
      s.lastEl = el;
      s.lastCov = cov;
      reveal(s.host, el, kbTop);
    },
    // Lớp nền không đổi khung khi nâng nên phần chồng lên bàn phím đo thẳng; đã nâng thì
    // giữ tới khi bàn phím thu (đổi ô không làm popup lên xuống), chưa thì chỉ nâng khi ô bị che.
    lift(s, el, kbTop) {
      const overlap = Math.max(0, Math.round(s.host.getBoundingClientRect().bottom - kbTop));
      const covered = !!el && el.getBoundingClientRect().bottom > kbTop - GAP;
      set(s, overlap && (s.px || covered) ? overlap : 0);
      if (!el || !s.px || (el === s.lastEl && overlap <= s.lastCov)) return;
      s.lastEl = el;
      s.lastCov = overlap;
      const sc = scrollerOf(el, s.host);
      if (sc) reveal(sc, el, kbTop);
    },
    // Tấm dời theo `bottom` → so vị trí lúc CHƯA dời, không thì vừa dời xong đã thấy hết che.
    shift(s, el, kbTop) {
      const overlap = Math.max(0, Math.round(s.host.getBoundingClientRect().bottom + s.px - kbTop));
      const covered = !!el && el.getBoundingClientRect().bottom + s.px > kbTop - GAP;
      set(s, overlap && (s.px || covered) ? overlap : 0);
    },
  };

  function release() {
    if (cur) set(cur, 0);
    cur = null;
  }

  // Rời ô (bấm một nút trong popup) mà bàn phím chưa thu thì GIỮ chỗ, mode chạy với el = null:
  // hạ ngay là popup tụt xuống dưới ngón tay, cú bấm rơi vào nền mờ và đóng luôn popup.
  // Chỉ thả khi bàn phím thu, focus sang khung khác, hoặc khung bị ẩn.
  function update() {
    const el = document.activeElement;
    const host = el?.matches?.(TYPING_SEL) ? hostOf(el) : null;
    if (cur && (host ? cur.host !== host : !cur.host.getClientRects().length)) release();
    if (host && MODES[host.dataset.kb] && !cur) {
      cur = { host, mode: host.dataset.kb, px: 0, base: 0, lastEl: null, lastCov: 0 };
    }
    if (cur) {
      MODES[cur.mode](cur, host ? el : null, visibleBottom());
      if (!host && !cur.px) cur = null;
    }
    // Thứ `fixed` bám theo ô (danh sách x-combobox) nghe sự kiện này để đặt lại chỗ.
    window.dispatchEvent(new Event("cx-kb"));
  }

  function safeUpdate() {
    try {
      update();
    } catch (_) {}
  }

  document.addEventListener("focusin", safeUpdate);
  document.addEventListener("focusout", () => setTimeout(safeUpdate, 0));
  const vv = TOP.visualViewport;
  vv?.addEventListener("resize", safeUpdate);
  vv?.addEventListener("scroll", safeUpdate);
  // Nghe trên visualViewport của trang cha → iframe nạp lại phải tự gỡ, kẻo trang cha giữ hàm của trang đã chết.
  if (TOP !== window) {
    window.addEventListener("pagehide", () => {
      vv?.removeEventListener("resize", safeUpdate);
      vv?.removeEventListener("scroll", safeUpdate);
    });
  }

  window.cxKb = { TYPING_SEL, visibleBottom, typingEl, update: safeUpdate };
})();
