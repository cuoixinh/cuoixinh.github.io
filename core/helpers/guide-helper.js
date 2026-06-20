/**
 * showTour — simple spotlight tour
 * @param {Array<{selector:string, title:string, desc:string, onEnter?:Function}>} steps
 * @param {{ storageKey?:string }} options
 */
function showTour(steps, { storageKey } = {}) {
  if (storageKey && localStorage.getItem(storageKey)) return;

  let current  = 0;
  let prevEl   = null;

  const overlay = document.createElement("div");
  overlay.style.cssText = "position:fixed;inset:0;z-index:9000;background:rgba(45,25,41,0.6);pointer-events:all";

  const tip = document.createElement("div");
  tip.style.cssText = "position:fixed;z-index:9002;background:#fff;border-radius:14px;padding:14px 16px 12px;width:268px;box-shadow:0 8px 32px rgba(45,25,41,.18);font-family:inherit";

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
    el.style.boxShadow    = "0 0 0 3px rgba(236,130,158,0.9), 0 0 0 7px rgba(236,130,158,0.15)";
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

  function placeTip(el) {
    const r      = el.getBoundingClientRect();
    const W      = 268;
    const GAP    = 12;
    const tipH   = tip.offsetHeight || 160;

    tip.style.left = Math.max(GAP, Math.min(r.left, window.innerWidth - W - GAP)) + "px";

    const spaceBelow = window.innerHeight - r.bottom;
    const spaceAbove = r.top;
    if (spaceBelow >= tipH + GAP) {
      tip.style.top = (r.bottom + GAP) + "px";
    } else if (spaceAbove >= tipH + GAP) {
      tip.style.top = (r.top - tipH - GAP) + "px";
    } else {
      /* không đủ chỗ cả hai phía — chọn phía rộng hơn */
      tip.style.top = spaceBelow >= spaceAbove
        ? (r.bottom + GAP) + "px"
        : Math.max(GAP, r.top - tipH - GAP) + "px";
    }
  }

  function renderTip(el) {
    const isLast = current === steps.length - 1;
    const step   = steps[current];
    tip.innerHTML = `
      <div style="font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:rgba(90,58,69,.38);margin-bottom:5px">${current + 1} / ${steps.length}</div>
      <div style="font-size:14px;font-weight:600;color:#2d1929;margin-bottom:3px">${step.title}</div>
      <div style="font-size:12px;line-height:1.65;color:rgba(90,58,69,.58);margin-bottom:10px">${step.desc}</div>
      <div style="display:flex;gap:5px;margin-bottom:10px">${steps.map((_, i) =>
        `<div style="height:3px;flex:1;border-radius:2px;background:${i <= current ? "#ec829e" : "rgba(236,130,158,.2)"}"></div>`
      ).join("")}</div>
      <div style="display:flex;align-items:center;justify-content:space-between">
        <button id="t-skip" style="font-size:12px;color:rgba(90,58,69,.38);background:none;border:none;cursor:pointer;padding:0;${isLast ? "visibility:hidden" : ""}">Bỏ qua</button>
        <button id="t-next" style="font-size:12px;font-weight:600;color:#fff;background:#ec829e;border:none;cursor:pointer;padding:5px 14px;border-radius:999px;display:inline-flex;align-items:center;gap:4px">${isLast ? "Xong" : "Tiếp"} ${ARROW}</button>
      </div>`;

    tip.querySelector("#t-next").onclick = () => {
      if (current < steps.length - 1) { current++; go(); } else finish();
    };
    tip.querySelector("#t-skip").onclick = finish;
    placeTip(el);
  }

  function go() {
    if (prevEl) unhighlight(prevEl);
    const step = steps[current];
    const el = document.querySelector(step.selector);
    if (!el) return;
    el.scrollIntoView({ block: "nearest", behavior: "smooth" });
    highlight(el);
    renderTip(el);
    prevEl = el;
  }

  function finish() {
    if (prevEl) unhighlight(prevEl);
    if (storageKey) localStorage.setItem(storageKey, "1");
    overlay.remove();
    tip.remove();
  }

  overlay.onclick = finish;
  go();
}
