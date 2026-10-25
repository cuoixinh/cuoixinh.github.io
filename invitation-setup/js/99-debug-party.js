// TẠM — log dò lỗi "bỏ tick Trùng địa điểm mà ô tiệc vẫn khoá" trên điện thoại.
// loader.js chỉ nạp file này khi `CONFIG.debugLog` bật; khung log nổi đầu màn,
// nút Copy để gửi đi. Không dùng alert(): hộp alert cướp focus.
(function () {
  if (typeof CONFIG === "undefined" || !CONFIG.debugLog) return;

  const t0 = performance.now();
  const lines = [];
  let box = null;

  const desc = (el) => {
    if (!el || el === document || el === window) return String(el && el.nodeName || el);
    if (el === document.body) return "body";
    const n = el.getAttribute?.("name");
    const k = el.closest?.("x-check")?.getAttribute("key");
    return (
      el.tagName.toLowerCase() +
      (el.id ? "#" + el.id : "") +
      (n ? `[name=${n}]` : "") +
      (k ? `{x-check ${k}}` : "")
    );
  };

  // 3 khung gọi gần nhất (bỏ chính hàm log) — đủ biết ai vừa đổi trạng thái.
  const caller = () =>
    (new Error().stack || "")
      .split("\n")
      .slice(3, 6)
      .map((l) => l.trim().replace(/^at /, "").replace(/\(?https?:\/\/[^/]+/g, "").replace(/\?v=[^:]*/g, ""))
      .join(" ← ");

  function log(msg) {
    const line = `${((performance.now() - t0) / 1000).toFixed(2)}s ${msg}`;
    lines.push(line);
    if (lines.length > 400) lines.shift();
    if (box) {
      box.textContent = lines.slice(-60).join("\n");
      box.scrollTop = box.scrollHeight;
    }
  }

  function inputState(side) {
    const i = document.querySelector(`input[name="${side}_party_location"]`);
    const c = document.querySelector(`x-check[key="${side}-party-same"]`);
    if (!i) return `${side}: (không thấy input)`;
    return (
      `${side}: checked=${c?.checked} ro=${i.readOnly} dis=${i.disabled} ` +
      `lockCls=${i.classList.contains("!bg-gray-100")} focus=${document.activeElement === i} ` +
      `val="${i.value.slice(0, 20)}"`
    );
  }

  function mountPanel() {
    const wrap = document.createElement("div");
    wrap.id = "cx-dbg";
    wrap.style.cssText =
      "position:fixed;left:8px;right:8px;top:8px;z-index:2147483647;background:rgba(0,0,0,.7);" +
      "color:#7CFC9A;font:10px/1.3 ui-monospace,monospace;border-radius:8px;padding:4px 6px;pointer-events:none;";
    wrap.innerHTML =
      '<div style="display:flex;gap:6px;margin-bottom:4px">' +
      '<b style="flex:1;color:#fff">debug · ' + CONFIG.env + ' · v=' + (typeof CX_VERSION !== "undefined" ? CX_VERSION : "?") + '</b>' +
      '<button data-a="state" style="padding:4px 8px">State</button>' +
      '<button data-a="copy" style="padding:4px 8px">Copy</button>' +
      '<button data-a="clear" style="padding:4px 8px">Clear</button>' +
      '<button data-a="min" style="padding:4px 8px">_</button></div>' +
      '<pre style="margin:0;max-height:22vh;overflow:auto;white-space:pre-wrap"></pre>';
    document.body.appendChild(wrap);
    box = wrap.querySelector("pre");
    // Chạm XUYÊN khung log (không che ô đang dò), chỉ các nút là bấm được.
    wrap.querySelectorAll("button").forEach((b) => (b.style.pointerEvents = "auto"));
    // Bấm nút log KHÔNG được lấy focus của ô đang dò.
    wrap.addEventListener("mousedown", (e) => e.preventDefault());
    wrap.addEventListener("touchstart", (e) => {
      if (e.target.closest("button")) e.preventDefault();
      const a = e.target.closest("button")?.dataset.a;
      if (a === "state") ["groom", "bride"].forEach((s) => log("STATE " + inputState(s) + " | active=" + desc(document.activeElement)));
      if (a === "clear") { lines.length = 0; box.textContent = ""; }
      if (a === "min") box.style.display = box.style.display === "none" ? "" : "none";
      if (a === "copy") {
        const text = navigator.userAgent + "\n" + lines.join("\n");
        (navigator.clipboard?.writeText(text) || Promise.reject())
          .then(() => log("— đã copy " + lines.length + " dòng —"))
          .catch(() => {
            // Không có clipboard (http qua IP LAN) → bôi đen sẵn cho khách tự copy.
            box.style.maxHeight = "70vh";
            box.textContent = text;
            const r = document.createRange();
            r.selectNodeContents(box);
            getSelection().removeAllRanges();
            getSelection().addRange(r);
          });
      }
    }, { passive: false });
    log("UA " + navigator.userAgent);
  }

  function hookSide(side) {
    const i = document.querySelector(`input[name="${side}_party_location"]`);
    const c = document.querySelector(`x-check[key="${side}-party-same"]`);
    if (!i || i._cxDbg) return !!i;
    i._cxDbg = true;

    // Ai đặt readOnly — kèm chỗ gọi.
    const proto = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "readOnly");
    Object.defineProperty(i, "readOnly", {
      configurable: true,
      get() { return proto.get.call(this); },
      set(v) {
        log(`SET ${side}.readOnly=${v} ← ${caller()}`);
        proto.set.call(this, v);
      },
    });

    new MutationObserver((ms) =>
      ms.forEach((m) => log(`MUT ${side} input @${m.attributeName} → ro=${i.readOnly} lockCls=${i.classList.contains("!bg-gray-100")}`)),
    ).observe(i, { attributes: true, attributeFilter: ["readonly", "disabled", "class"] });

    ["touchstart", "touchend", "pointerdown", "mousedown", "click", "focus", "blur", "beforeinput", "input", "keydown"].forEach((ev) =>
      i.addEventListener(ev, (e) =>
        log(`EV ${side} input ${ev}${e.key ? " key=" + e.key : ""}${e.inputType ? " " + e.inputType : ""} ro=${i.readOnly} defaultPrevented=${e.defaultPrevented}`),
      { capture: true }),
    );

    const btn = c?.querySelector("button");
    ["touchstart", "touchend", "click"].forEach((ev) =>
      btn?.addEventListener(ev, () => log(`EV ${side} x-check ${ev} checked(before)=${c.checked} active=${desc(document.activeElement)}`), { capture: true }),
    );
    if (btn) {
      new MutationObserver(() => log(`MUT ${side} x-check data-active=${btn.dataset.active}`)).observe(btn, {
        attributes: true,
        attributeFilter: ["data-active"],
      });
    }
    log("hooked " + inputState(side));
    return true;
  }

  function hookToggle() {
    const orig = window.togglePartySameLoc;
    if (typeof orig !== "function" || orig._cxDbg) return;
    const wrapped = function (side, event, force) {
      log(`CALL togglePartySameLoc(${side}, ev=${event?.type || null}, force=${force}) ← ${caller()}`);
      const r = orig.apply(this, arguments);
      log(`  → ${inputState(side)}`);
      return r;
    };
    wrapped._cxDbg = true;
    window.togglePartySameLoc = wrapped;
  }

  function start() {
    mountPanel();
    hookToggle();
    let n = 0;
    const iv = setInterval(() => {
      const ok = ["groom", "bride"].map(hookSide).every(Boolean);
      if (ok || ++n > 100) clearInterval(iv);
    }, 200);

    // Nghe ở cấp document: phần tử bị dựng lại sau lúc gắn hook vẫn ra log.
    ["touchstart", "touchend", "click"].forEach((ev) =>
      document.addEventListener(ev, (e) => {
        if (e.target.closest?.("#cx-dbg")) return;
        const c = e.target.closest?.("x-check");
        const extra = c ? ` checked=${c.checked} key=${c.getAttribute("key")}` : "";
        log(`DOC ${ev} ${desc(e.target)}${extra} active=${desc(document.activeElement)}`);
      }, true),
    );
    // Hook theo phần tử chạy lại định kỳ — ô bị dựng lại thì gắn lại.
    setInterval(() => {
      ["groom", "bride"].forEach(hookSide);
      if (!window.togglePartySameLoc?._cxDbg) { log("re-hook togglePartySameLoc"); hookToggle(); }
    }, 1000);
    document.addEventListener("focusin", (e) => log("focusin " + desc(e.target)), true);
    document.addEventListener("focusout", (e) => log("focusout " + desc(e.target) + " → " + desc(e.relatedTarget)), true);
    window.visualViewport?.addEventListener("resize", () =>
      log(`vv resize h=${Math.round(visualViewport.height)} top=${Math.round(visualViewport.offsetTop)} inner=${innerHeight}`),
    );
    window.addEventListener("error", (e) => log("ERROR " + e.message + " @" + (e.filename || "").split("/").pop() + ":" + e.lineno));
    window.addEventListener("unhandledrejection", (e) => log("REJECT " + (e.reason?.message || e.reason)));
  }

  if (window.__cxOnReady) window.__cxOnReady(start);
  else if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
