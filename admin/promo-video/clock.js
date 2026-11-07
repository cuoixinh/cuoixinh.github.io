// Đồng hồ ảo cho bộ quay video quảng cáo — scripts/promo-video.mjs tiêm file này vào
// MỌI frame (trước mọi script khác) để thời gian chỉ trôi khi được gọi tick(): video
// ra đều 30/60 khung dù máy chụp mỗi khung chậm bao nhiêu. Trước start() mọi thứ chạy
// theo giờ thật (nạp trang, font, ảnh); start() dời timer/rAF/animation đang chờ sang
// giờ ảo. CSS animation/transition không theo giờ ảo của Chrome nên phải tự giữ
// currentTime qua document.getAnimations().
(function () {
  if (window.__cxClock) return;

  const N = {
    setTimeout: window.setTimeout.bind(window),
    clearTimeout: window.clearTimeout.bind(window),
    raf: window.requestAnimationFrame.bind(window),
    caf: window.cancelAnimationFrame.bind(window),
    now: performance.now.bind(performance),
    Date: window.Date,
  };

  let on = false;
  let base = 0; // performance.now() thật lúc start()
  let vnow = 0; // performance.now() ảo
  let dateBase = 0; // Date.now() - performance.now() lúc start()
  let seq = 1;
  const timers = new Map(); // id → {fn, args, delay, repeat, due, native, dueReal}
  const rafs = new Map(); // id → {cb, native}

  function call(fn, args) {
    try {
      if (typeof fn === "function") fn.apply(window, args || []);
      else (0, eval)(String(fn));
    } catch (e) {
      N.setTimeout(() => {
        throw e;
      });
    }
  }

  function schedNative(id, t) {
    t.dueReal = N.now() + t.delay;
    t.native = N.setTimeout(() => {
      if (!timers.has(id)) return;
      if (t.repeat) schedNative(id, t);
      else timers.delete(id);
      call(t.fn, t.args);
    }, t.delay);
  }

  function addTimer(fn, delay, args, repeat) {
    const id = seq++;
    const t = { fn, args, delay: Math.max(0, Number(delay) || 0), repeat };
    timers.set(id, t);
    if (on) t.due = vnow + t.delay;
    else schedNative(id, t);
    return id;
  }

  function clearTimer(id) {
    const t = timers.get(id);
    if (!t) return;
    if (t.native != null) N.clearTimeout(t.native);
    timers.delete(id);
  }

  window.setTimeout = (fn, delay, ...args) => addTimer(fn, delay, args, false);
  window.setInterval = (fn, delay, ...args) => addTimer(fn, delay, args, true);
  window.clearTimeout = clearTimer;
  window.clearInterval = clearTimer;

  window.requestAnimationFrame = (cb) => {
    const id = seq++;
    const r = { cb };
    if (!on) {
      r.native = N.raf((ts) => {
        rafs.delete(id);
        cb(ts);
      });
    }
    rafs.set(id, r);
    return id;
  };
  window.cancelAnimationFrame = (id) => {
    const r = rafs.get(id);
    if (!r) return;
    if (r.native != null) N.caf(r.native);
    rafs.delete(id);
  };

  performance.now = () => (on ? vnow : N.now());

  function VDate(...a) {
    const ms = on ? dateBase + vnow : N.Date.now();
    if (!new.target) return new N.Date(ms).toString();
    return a.length ? new N.Date(...a) : new N.Date(ms);
  }
  VDate.prototype = N.Date.prototype;
  VDate.now = () => (on ? Math.floor(dateBase + vnow) : N.Date.now());
  VDate.parse = N.Date.parse;
  VDate.UTC = N.Date.UTC;
  window.Date = VDate;

  // ── Animation (CSS animation, CSS transition, Element.animate) ──────────────
  // Mỗi animation được ghi một mốc bắt đầu theo giờ ảo rồi PAUSE, mỗi nhịp đặt lại
  // currentTime = vnow − mốc. Animation mới gặp lần đầu ở đầu nhịp là thứ sinh ra
  // trong lúc vẽ khung trước (IntersectionObserver bật class…) → tính từ nhịp trước.
  const owned = new WeakMap(); // animation → mốc bắt đầu (giờ ảo)
  let prevV = 0;

  function syncAnims(startFor) {
    let list;
    try {
      list = document.getAnimations();
    } catch (_) {
      return;
    }
    for (const a of list) {
      if (a.timeline && a.timeline !== document.timeline) continue; // scroll-driven
      let s = owned.get(a);
      if (s === undefined) {
        if (a.playState === "paused") continue; // trang tự dừng — để yên
        s = startFor == null ? vnow - (Number(a.currentTime) || 0) : startFor;
        owned.set(a, s);
      }
      if (a.playState === "finished" || a.playState === "idle") continue;
      if (a.playState === "running") a.pause();
      const local = (vnow - s) * (a.playbackRate || 1);
      const end = a.effect ? a.effect.getComputedTiming().endTime : Infinity;
      // finish() chứ không chỉ đặt currentTime: animation đang pause thì không bao
      // giờ "finished", transitionend/animationend sẽ không phát.
      if (Number.isFinite(end) && local >= end) a.finish();
      else a.currentTime = Math.max(0, local);
    }
  }

  function start() {
    if (on) return;
    const real = N.now();
    on = true;
    base = real;
    vnow = real;
    prevV = real;
    dateBase = N.Date.now() - real;
    for (const t of timers.values()) {
      if (t.native == null) continue;
      N.clearTimeout(t.native);
      t.native = null;
      t.due = vnow + Math.max(0, t.dueReal - real);
    }
    for (const r of rafs.values()) {
      if (r.native == null) continue;
      N.caf(r.native);
      r.native = null;
    }
    syncAnims(null);
  }

  // Đưa giờ ảo tới `ms` tính từ lúc start(): chạy timer tới hạn theo thứ tự, rồi một
  // lượt rAF, rồi khớp animation. Timer đẻ timer 0ms trong cùng nhịp vẫn chạy luôn.
  function tick(ms) {
    if (!on) start();
    const target = base + ms;
    syncAnims(prevV);
    for (let guard = 0; guard < 20000; guard++) {
      let bestId = 0;
      let best = null;
      for (const [id, t] of timers) {
        if (t.due > target) continue;
        if (!best || t.due < best.due || (t.due === best.due && id < bestId)) {
          best = t;
          bestId = id;
        }
      }
      if (!best) break;
      vnow = Math.max(vnow, best.due);
      if (best.repeat) best.due = vnow + Math.max(best.delay, 4);
      else timers.delete(bestId);
      call(best.fn, best.args);
    }
    vnow = Math.max(vnow, target);
    const due = [...rafs.values()];
    rafs.clear();
    for (const r of due) call(r.cb, [vnow]);
    syncAnims(null);
    prevV = vnow;
  }

  window.__cxClock = { start, tick, now: () => vnow - base };
})();
