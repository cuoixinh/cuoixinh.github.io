// Bấm lên thiệp để sửa — chỉ chạy ở bản xem của trang Thiết lập (?pick=1), do
// preview-focus-helper.js nạp. Chữ: setText báo về __cxPickTrace lúc dựng, so với các
// khoá vừa đọc qua Proxy để gắn data-cx-field. Ảnh: dò lúc bấm theo src. Mục đang tắt
// hiện bóng mờ (cxToggle). Bấm → thẻ nhỏ → postMessage {type:"cx-pick"} cho trang cha
// (invitation-setup/js/29-preview-pick.js). Danh mục cột ở pick-fields.js.
(function () {
  const norm = (v) => String(v ?? "").replace(/\s+/g, " ").trim();

  // Cột gốc có thể nằm dưới tên khác sau cxVuQuyAsCeremony/cxPartyOnly (wedding-helper.js).
  const ALIAS = {
    ceremony_date: ["vu_quy_date", "groom_party_date", "bride_party_date"],
    ceremony_time: ["vu_quy_time", "groom_party_time", "bride_party_time"],
    ceremony_location: ["vu_quy_location", "groom_party_location", "bride_party_location"],
    ceremony_map_embed_url: ["vu_quy_map_embed_url", "groom_party_map_embed_url", "bride_party_map_embed_url"],
  };

  let orig = null; // dữ liệu TRƯỚC khi biến đổi — nguồn của tên cột
  let tracing = false;
  let reads = []; // khoá đọc qua Proxy kể từ lần setText trước

  function srcField(key, value) {
    if (!orig) return null;
    const v = norm(value);
    // Cột chưa điền thì vắng hẳn trong dữ liệu xem trước — vẫn nhận nếu nằm trong danh mục.
    if ((key in orig || CX_PICK_FIELDS[key]) && norm(orig[key]) === v) return key;
    for (const k of ALIAS[key] || []) if (norm(orig[k]) === v && v) return k;
    return null;
  }

  // Lần setText, theo thứ tự tin cậy: (1) khoá đọc NGAY TRƯỚC đó cùng giá trị (kể cả
  // rỗng → chữ giữ chỗ); (2) chữ dựng từ đúng MỘT cột vừa đọc (ngày đã định dạng, "Ông "
  // + tên bố, chữ cái đầu); (3) dò cả bộ, chỉ nhận khi đúng MỘT cột trùng giá trị.
  function trace(el, value) {
    if (!tracing || !el) return;
    const v = norm(value);
    let field = null;
    for (let i = reads.length - 1; i >= 0 && !field; i--) {
      if (norm(reads[i].value) === v) field = srcField(reads[i].key, value);
    }
    if (!field && v) {
      const keys = [...new Set(reads.filter((r) => CX_PICK_FIELDS[r.key]).map((r) => r.key))];
      const r = keys.length === 1 && reads.find((x) => x.key === keys[0]);
      if (r && norm(r.value) && !CX_PICK_IMAGES.includes(r.key)) field = srcField(r.key, r.value);
    }
    if (!field && v) {
      const hit = Object.keys(CX_PICK_FIELDS).filter(
        (k) => !CX_PICK_IMAGES.includes(k) && norm(orig[k]) === v,
      );
      if (hit.length === 1) field = hit[0];
    }
    reads = [];
    if (!field || !CX_PICK_FIELDS[field]) return;
    el.setAttribute("data-cx-field", field);
    el.classList.toggle("cx-pick-empty", !v);
  }

  // Gán src cho ảnh (setAttr/setImageWithRing): cột ảnh vừa đọc → data-cx-img. Cần cho
  // ô ảnh CHƯA chọn — src là ảnh giữ chỗ nên dò theo URL lúc bấm không ra cột nào.
  function traceImg(el) {
    if (!tracing || !el) return;
    const r = [...reads].reverse().find((x) => CX_PICK_IMAGES.includes(x.key));
    reads = [];
    if (r) el.setAttribute("data-cx-img", r.key);
  }

  function wrap(w, original) {
    orig = original || w;
    tracing = true;
    reads = [];
    _patchToggle();
    _ensureUi();
    return new Proxy(w, {
      get(t, k, r) {
        const val = Reflect.get(t, k, r);
        if (tracing && typeof k === "string" && (val == null || typeof val !== "object")) {
          reads.push({ key: k, value: val });
          if (reads.length > 24) reads.shift();
        }
        return val;
      },
    });
  }

  // Hết lượt dựng: các bước sau (text_overrides, khối tự thêm) không phải dữ liệu form.
  function done() {
    tracing = false;
    reads = [];
  }

  // ── MỤC BÓNG MỜ ─────────────────────────────────────────────────────────────
  // Mục của một bước bị tắt/trống (cxToggle(..., false)) vẫn hiện, mờ, kèm nhãn "+ Thêm"
  // vẽ bằng ::after — không chèn phần tử con kẻo lệch :nth-child của text_overrides.
  // Chỉ khung MỤC (ứng viên đầu của CX_FOCUS_SEL / CX_THEME.focus), không phải khối con
  // như #mini-calendar — mẫu ẩn khối con vì thiếu dữ liệu thì cứ ẩn.
  function _stepOfId(id) {
    const sel = "#" + id;
    const own = window.CX_THEME?.focus || {};
    for (const step of Object.keys(CX_PICK_STEPS)) {
      const base = typeof CX_FOCUS_SEL !== "undefined" ? CX_FOCUS_SEL[step] || [] : [];
      if (base[0] === sel || (own[step] || [])[0] === sel) return step;
    }
    return null;
  }

  let _patched = false;
  function _patchToggle() {
    if (_patched || typeof window.cxToggle !== "function") return;
    _patched = true;
    const base = window.cxToggle;
    window.cxToggle = function (id, show) {
      base(id, show);
      const el = document.getElementById(id);
      const step = el && _stepOfId(id);
      if (!step) return;
      el.classList.toggle("cx-pick-ghost", !show);
      if (show) return el.removeAttribute("data-cx-ghost");
      el.classList.remove("hidden");
      if (el.style.display === "none") el.style.display = "";
      el.setAttribute("data-cx-ghost", step);
      el.setAttribute("data-cx-ghost-label", "+ Thêm " + CX_PICK_STEPS[step].toLowerCase());
    };
  }

  // ── DÒ ĐÍCH KHI BẤM ─────────────────────────────────────────────────────────
  function _abs(u) {
    try {
      return new URL(u, location.href).href.split("#")[0];
    } catch (e) {
      return "";
    }
  }

  function _imgSrcOf(el) {
    if (el.tagName === "IMG") return el.currentSrc || el.src || "";
    const bg = getComputedStyle(el).backgroundImage || "";
    const m = bg.match(/url\(["']?(.*?)["']?\)/);
    return m ? m[1] : "";
  }

  // Ảnh ứng với một cột: so URL đầy đủ (bản xem nhận sẵn URL / blob của trang cha).
  function _imageField(src) {
    const s = _abs(src);
    if (!s || !orig) return null;
    for (const f of CX_PICK_IMAGES) if (orig[f] && _abs(orig[f]) === s) return { field: f };
    const g = Array.isArray(orig.gallery_images) ? orig.gallery_images : [];
    const i = g.findIndex((u) => _abs(u) === s);
    return i >= 0 ? { field: "gallery_images", idx: i, src: s } : null;
  }

  // Khối phủ (lớp màu, chữ trang trí) thường nằm đè lên ảnh: dò mọi lớp dưới điểm bấm.
  function _imageAt(x, y) {
    for (const el of document.elementsFromPoint(x, y)) {
      if (el.closest(".cx-pick-pop")) continue;
      const tagged = el.getAttribute("data-cx-img");
      if (tagged) return { field: tagged };
      const src = _imgSrcOf(el);
      if (!src) continue;
      const hit = _imageField(src);
      if (hit) return hit;
    }
    return null;
  }

  function _stepAt(el) {
    let best = null;
    let depth = -1;
    for (const step of Object.keys(CX_PICK_STEPS)) {
      const list = typeof _cxFocusList === "function" ? _cxFocusList(step) : [];
      for (const sel of list) {
        let box = null;
        try {
          box = el.closest(sel);
        } catch (e) {}
        if (!box) continue;
        let d = 0;
        for (let n = box; n; n = n.parentElement) d++;
        if (d > depth) {
          depth = d;
          best = step;
        }
      }
    }
    return best;
  }

  const INTERACTIVE = "button, a, input, select, textarea, label, [role=button], iframe, audio, video";
  const GUEST = "[data-cx-say], [data-cx-invite], [data-cx-guest-only], [id*='guest']";

  function _target(el, x, y) {
    const ghost = el.closest("[data-cx-ghost]");
    if (ghost) return { kind: "ghost", step: ghost.getAttribute("data-cx-ghost") };
    const bound = el.closest("[data-cx-field]");
    if (bound) return { kind: "field", field: bound.getAttribute("data-cx-field"), el: bound };
    if (el.closest(GUEST)) return { kind: "guest", el: el.closest(GUEST) };
    const img = _imageAt(x, y);
    if (img) return { kind: "image", ...img };
    if (el.closest(INTERACTIVE)) return null;
    const step = _stepAt(el);
    return step ? { kind: "step", step } : null;
  }

  // ── GIAO DIỆN ───────────────────────────────────────────────────────────────
  // Màu cố định, không theo bộ màu thiệp: đây là khung chỉnh của trang Thiết lập.
  const CSS = `
[data-cx-field],[data-cx-ghost]{cursor:pointer}
.cx-pick-hover{outline:2px solid rgba(225,29,72,.85)!important;outline-offset:2px;border-radius:2px}
.cx-pick-empty{outline:1px dashed rgba(225,29,72,.7);outline-offset:2px}
.cx-pick-ghost{position:relative;opacity:.55;filter:grayscale(1);min-height:96px;outline:2px dashed rgba(225,29,72,.6);outline-offset:-8px}
.cx-pick-ghost::after{content:attr(data-cx-ghost-label);position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:5;padding:8px 16px;border-radius:999px;background:#e11d48;color:#fff;font:600 14px/1.2 system-ui,sans-serif;white-space:nowrap;filter:grayscale(0)}
.cx-pick-pop{position:fixed;z-index:2147483000;max-width:280px;padding:12px;border-radius:12px;background:#111827;color:#fff;font:14px/1.4 system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.3)}
.cx-pick-pop p{margin:0 0 8px;color:#e5e7eb}
.cx-pick-pop b{color:#fff}
.cx-pick-pop .cx-pick-acts{display:flex;flex-wrap:wrap;gap:8px}
.cx-pick-pop button{appearance:none;border:0;border-radius:999px;padding:8px 14px;background:#e11d48;color:#fff;font:600 13px/1 system-ui,sans-serif;cursor:pointer}
.cx-pick-pop button.is-sub{background:#374151}
.cx-pick-tip{position:fixed;z-index:2147483000;pointer-events:none;padding:4px 8px;border-radius:6px;background:#111827;color:#fff;font:12px/1.3 system-ui,sans-serif;white-space:nowrap;opacity:0;transition:opacity .12s}
`;

  let pop = null;
  let tip = null;
  let hovered = null;

  function _ensureUi() {
    if (document.getElementById("cx-pick-css")) return;
    const st = document.createElement("style");
    st.id = "cx-pick-css";
    st.textContent = CSS;
    document.head.appendChild(st);
    const on = () => {
      document.addEventListener("click", _onClick, true);
      document.addEventListener("mouseover", _onHover, true);
      document.addEventListener("mouseout", _onOut, true);
      document.addEventListener("keydown", (e) => e.key === "Escape" && _closePop(), true);
      window.addEventListener("scroll", _onScroll, { passive: true, capture: true });
    };
    if (document.body) on();
    else document.addEventListener("DOMContentLoaded", on, { once: true });
  }

  function _label(t) {
    if (t.kind === "field" || t.kind === "image") {
      const [name, step] = CX_PICK_FIELDS[t.field] || [];
      return name ? `${name} · ${CX_PICK_STEPS[step] || ""}` : "";
    }
    if (t.kind === "ghost") return `${CX_PICK_STEPS[t.step]} · chưa hiện trên thiệp`;
    if (t.kind === "step") return `Mục ${CX_PICK_STEPS[t.step]}`;
    if (t.kind === "guest") return "Tên khách mời";
    return "";
  }

  // Chỉ máy có chuột: chạm trên điện thoại cũng sinh mouseover, nhãn sẽ đè lên thẻ nổi.
  const CAN_HOVER = window.matchMedia?.("(hover: hover)").matches !== false;

  function _onHover(e) {
    if (!CAN_HOVER || e.target.closest?.(".cx-pick-pop")) return;
    const t = _target(e.target, e.clientX, e.clientY);
    const el = t?.el || (t?.kind === "ghost" ? e.target.closest("[data-cx-ghost]") : null);
    if (hovered !== el) {
      hovered?.classList.remove("cx-pick-hover");
      hovered = el;
      el?.classList.add("cx-pick-hover");
    }
    if (!tip) {
      tip = document.createElement("div");
      tip.className = "cx-pick-tip";
      document.body.appendChild(tip);
    }
    const text = t ? _label(t) : "";
    tip.textContent = text;
    tip.style.opacity = text ? "1" : "0";
    tip.style.left = Math.min(e.clientX + 12, window.innerWidth - tip.offsetWidth - 8) + "px";
    tip.style.top = Math.max(e.clientY - 32, 8) + "px";
  }

  function _onOut(e) {
    if (e.relatedTarget) return;
    hovered?.classList.remove("cx-pick-hover");
    hovered = null;
    if (tip) tip.style.opacity = "0";
  }

  function _send(msg) {
    _closePop();
    window.parent.postMessage({ type: "cx-pick", ...msg }, location.origin);
  }

  function _closePop() {
    pop?.remove();
    pop = null;
  }

  // Cuộn thật mới đóng thẻ: sự kiện cuộn của chính cú bấm (trình duyệt kéo phần tử vào
  // tầm nhìn) tới trễ một nhịp, đóng ngay là thẻ vừa mở đã biến mất.
  let popY = 0;
  function _onScroll() {
    if (pop && Math.abs(window.scrollY - popY) > 40) _closePop();
  }

  function _isPlaceholder(v) {
    return !v || /^data:/.test(String(v));
  }

  // Nút của thẻ theo loại đích: [chữ, tin gửi trang cha, phụ?].
  function _actions(t) {
    if (t.kind === "field") return [["Sửa", { action: "field", field: t.field }]];
    if (t.kind === "ghost") return [["Thêm " + CX_PICK_STEPS[t.step].toLowerCase(), { action: "enable", step: t.step }]];
    if (t.kind === "step") return [["Sửa mục này", { action: "step", step: t.step }]];
    if (t.kind === "guest") return [["Mở danh sách khách", { action: "guests" }]];
    if (t.field === "gallery_images") {
      const has = !_isPlaceholder(t.src);
      return [
        ...(has ? [["Chỉnh khung", { action: "focal", field: t.field, idx: t.idx, src: t.src }]] : []),
        ["Thêm ảnh", { action: "image", field: t.field }, has],
      ];
    }
    const has = !_isPlaceholder(orig?.[t.field]);
    return [
      [has ? "Đổi ảnh" : "Chọn ảnh", { action: "image", field: t.field }],
      ...(has ? [["Chỉnh khung", { action: "focal", field: t.field }, true]] : []),
    ];
  }

  function _openPop(t, x, y) {
    _closePop();
    pop = document.createElement("div");
    pop.className = "cx-pick-pop";
    const p = document.createElement("p");
    if (t.kind === "guest") {
      p.textContent = "Tên khách mời tự đổi theo link mời của từng khách.";
    } else {
      const b = document.createElement("b");
      b.textContent = _label(t);
      p.appendChild(b);
    }
    const acts = document.createElement("div");
    acts.className = "cx-pick-acts";
    _actions(t).forEach(([text, msg, sub]) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = text;
      if (sub) btn.classList.add("is-sub");
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        _send(msg);
      });
      acts.appendChild(btn);
    });
    pop.append(p, acts);
    document.body.appendChild(pop);
    popY = window.scrollY;
    const w = pop.offsetWidth;
    const h = pop.offsetHeight;
    pop.style.left = Math.max(8, Math.min(x - w / 2, window.innerWidth - w - 8)) + "px";
    pop.style.top = (y + h + 16 > window.innerHeight ? Math.max(8, y - h - 12) : y + 12) + "px";
  }

  function _onClick(e) {
    if (e.target.closest?.(".cx-pick-pop")) return;
    const t = _target(e.target, e.clientX, e.clientY);
    if (!t) return _closePop();
    e.preventDefault();
    e.stopPropagation();
    _openPop(t, e.clientX, e.clientY);
  }

  // Bảng đếm cho scripts/check-inline-map.mjs: cột → số chỗ trên thiệp (chữ + ảnh).
  function scan() {
    const out = {};
    const add = (f) => (out[f] = (out[f] || 0) + 1);
    document.querySelectorAll("[data-cx-field]").forEach((el) => add(el.getAttribute("data-cx-field")));
    document.querySelectorAll("body *").forEach((el) => {
      const tagged = el.getAttribute("data-cx-img");
      if (tagged) return add(tagged);
      const src = _imgSrcOf(el);
      const hit = src && _imageField(src);
      if (hit) add(hit.field);
    });
    return out;
  }

  window.__cxPickTrace = trace;
  window.__cxPickTraceImg = traceImg;
  window.CXPick = { wrap, done, scan };
})();
