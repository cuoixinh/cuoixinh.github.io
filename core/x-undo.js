// ============================================================================
// x-undo — cụm nút Hoàn tác/Làm lại DÙNG CHUNG, gắn được cho mọi <textarea>/<input>.
//
// Cơ chế: TỰ QUẢN LÝ lịch sử (không dùng execCommand native). Mỗi lần gõ được gộp
// thành 1 mốc (debounce ~350ms); undo/redo khôi phục snapshot {value, vị trí con trỏ}.
// Nhờ tự giữ stack nên biết CHÍNH XÁC độ sâu → bật/tắt (disabled) 2 nút đúng 100%.
// Đồng thời CHẶN Ctrl/Cmd+Z (undo) và Ctrl/Cmd+Shift+Z / Ctrl+Y (redo) NGAY TRÊN ô
// → chỉ còn MỘT hệ undo duy nhất, phím tắt và nút bấm luôn khớp nhau.
//
// Lưu ý khi dùng:
//  • Gán .value bằng code mà muốn được ghi vào lịch sử → nhớ phát sự kiện 'input'
//    (target.dispatchEvent(new Event('input',{bubbles:true}))) sau khi gán.
//  • Phím tắt chỉ chặn khi con trỏ đang Ở TRONG ô đó (listener gắn trên chính ô).
//
// Cách dùng:
//    attachUndoRedo(textareaEl);                       // gắn vào ô, nút góc dưới-phải
//    attachUndoRedo(el, { mount, className, max });     // tuỳ biến vị trí/gắn/độ sâu
//
// mount mặc định là el.parentElement và cần position:relative để nút định vị đúng.
// (Với <x-textarea>, .x-ta-wrap đã là position:relative sẵn.)
// ============================================================================
(function (global) {
  // Tiêm CSS 1 lần (component tự đủ style, nơi dùng không phải khai báo lại).
  if (!document.getElementById("x-undo-style")) {
    const s = document.createElement("style");
    s.id = "x-undo-style";
    s.textContent =
      ".x-undo{position:absolute;right:4px;bottom:8px;display:inline-flex;gap:8px;" +
      "padding:2px 4px;border-radius:8px;background:rgba(255,255,255,.92);" +
      "backdrop-filter:blur(2px);z-index:2}" +
      ".x-undo-btn{display:inline-flex;align-items:center;justify-content:center;" +
      "width:16px;height:16px;padding:0;border:none;border-radius:4px;" +
      "color:#9ca3af;background:transparent;cursor:pointer;" +
      "transition:color .12s ease,background .12s ease}" +
      ".x-undo-btn:hover:not(:disabled){color:#e11d48;background:#fff1f2}" +
      ".x-undo-btn:disabled{opacity:.4;cursor:default}" +
      ".x-undo-btn svg{width:14px;height:14px}";
    document.head.appendChild(s);
  }

  const UNDO_SVG =
    `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" ` +
    `stroke-width="2" stroke-linecap="round" stroke-linejoin="round">` +
    `<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5 5.5 5.5 0 0 1-5.5 5.5H11"/></svg>`;
  const REDO_SVG =
    `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" ` +
    `stroke-width="2" stroke-linecap="round" stroke-linejoin="round">` +
    `<path d="m15 14 5-5-5-5"/><path d="M20 9H9.5A5.5 5.5 0 0 0 4 14.5 5.5 5.5 0 0 0 9.5 20H13"/></svg>`;

  function _btn(title, svg) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "x-undo-btn";
    b.title = title;
    b.setAttribute("aria-label", title);
    b.innerHTML = svg;
    // Giữ focus Ở Ô NHẬP khi bấm nút (không để nút cướp focus của textarea).
    const keepFocus = (e) => e.preventDefault();
    b.addEventListener("mousedown", keepFocus);
    b.addEventListener("pointerdown", keepFocus);
    return b;
  }

  function attachUndoRedo(target, opts = {}) {
    if (!target || target._xUndo) return target ? target._xUndo : null;
    const mount = opts.mount || target.parentElement;
    if (!mount) return null;

    const box = document.createElement("div");
    box.className = "x-undo" + (opts.className ? " " + opts.className : "");
    const undoBtn = _btn(opts.undoTitle || "Hoàn tác", UNDO_SVG);
    const redoBtn = _btn(opts.redoTitle || "Làm lại", REDO_SVG);
    box.append(undoBtn, redoBtn);
    mount.appendChild(box);

    // ── Lịch sử tự quản lý ──────────────────────────────────────────────────
    const MAX = opts.max || 200;
    const snap = () => ({
      value: target.value,
      s: target.selectionStart,
      e: target.selectionEnd,
    });
    const history = [snap()]; // luôn có mốc gốc = trạng thái lúc gắn
    let idx = 0;
    let coalesce = null;
    let applying = false; // đang khôi phục → không ghi lịch sử (bỏ qua 'input' do mình phát)

    const refresh = () => {
      undoBtn.disabled = idx <= 0;
      redoBtn.disabled = idx >= history.length - 1;
    };

    const pushState = () => {
      coalesce = null;
      if (target.value === history[idx].value) return; // không đổi → khỏi lưu
      history.splice(idx + 1); // gõ tiếp sau khi undo → bỏ nhánh "redo" cũ
      history.push(snap());
      if (history.length > MAX) history.shift();
      idx = history.length - 1;
      refresh();
    };

    const commitPending = () => {
      if (coalesce) clearTimeout(coalesce);
      coalesce = null;
      if (target.value !== history[idx].value) pushState();
    };

    const restore = (st) => {
      applying = true;
      target.value = st.value;
      try { target.setSelectionRange(st.s, st.e); } catch {}
      // Phát 'input' để autosave + nút "x" xoá của x-textarea… tự đồng bộ.
      target.dispatchEvent(new Event("input", { bubbles: true }));
      applying = false;
      target.focus();
    };

    const undo = () => {
      commitPending();
      if (idx > 0) {
        idx--;
        restore(history[idx]);
        refresh();
      }
    };
    const redo = () => {
      commitPending();
      if (idx < history.length - 1) {
        idx++;
        restore(history[idx]);
        refresh();
      }
    };

    const onInput = () => {
      if (applying) return; // do chính undo/redo phát ra
      if (coalesce) clearTimeout(coalesce);
      coalesce = setTimeout(pushState, 350); // gộp các lần gõ liên tiếp thành 1 mốc
    };

    // Ctrl/Cmd+Z = undo; Ctrl/Cmd+Shift+Z hoặc Ctrl+Y = redo. Chặn native để chỉ
    // còn một hệ undo (của mình). Gắn trên chính ô nên chỉ tác dụng khi ô đang focus.
    const onKey = (ev) => {
      if (!(ev.ctrlKey || ev.metaKey) || ev.altKey) return;
      const k = (ev.key || "").toLowerCase();
      if (k === "z" && !ev.shiftKey) {
        ev.preventDefault();
        undo();
      } else if ((k === "z" && ev.shiftKey) || k === "y") {
        ev.preventDefault();
        redo();
      }
    };

    target.addEventListener("input", onInput);
    target.addEventListener("keydown", onKey);
    undoBtn.addEventListener("click", undo);
    redoBtn.addEventListener("click", redo);

    refresh();

    const api = {
      box,
      undoBtn,
      redoBtn,
      undo,
      redo,
      // Gọi sau khi gán target.value bằng code (không qua 'input') để chốt 1 mốc mới.
      commit: commitPending,
      destroy() {
        if (coalesce) clearTimeout(coalesce);
        target.removeEventListener("input", onInput);
        target.removeEventListener("keydown", onKey);
        box.remove();
        delete target._xUndo;
      },
    };
    target._xUndo = api;
    return api;
  }

  global.attachUndoRedo = attachUndoRedo;
})(window);
