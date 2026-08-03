// x-undo — cụm nút Hoàn tác/Làm lại DÙNG CHUNG, gắn được cho mọi <textarea>/<input>.
//
// TỰ QUẢN LÝ lịch sử (không dùng execCommand): mỗi lần gõ gộp thành 1 mốc
// (debounce ~350ms), undo/redo khôi phục snapshot {value, vị trí con trỏ} nên
// biết chính xác độ sâu để bật/tắt 2 nút. Chặn luôn Ctrl/Cmd+Z và
// Ctrl/Cmd+Shift+Z / Ctrl+Y ngay trên ô → chỉ còn MỘT hệ undo duy nhất.
//
//   attachUndoRedo(textareaEl);                    // → thanh navbar đáy
//   attachUndoRedo(el, { mount, className, max }); // tuỳ biến vị trí/độ sâu
//
// Gán .value bằng code mà muốn ghi vào lịch sử thì nhớ phát sự kiện 'input'.
// mount mặc định là el.parentElement (đang static thì tự set relative).
// Bố cục: bọc textarea trong khung .x-ta-frame (flex cột) mang viền giả; thanh
// .x-ta-toolbar là hàng flex CUỐI trong khung [Tối ưu · Mic · Hoàn tác · Làm lại].
(function (global) {
  // Tiêm CSS 1 lần (component tự đủ style, nơi dùng không phải khai báo lại).
  if (!document.getElementById("x-ta-toolbar-style")) {
    const s = document.createElement("style");
    s.id = "x-ta-toolbar-style";
    s.textContent =
      // Khung bọc: viền giả thay cho viền của textarea; focus-within → hiện ring.
      ".x-ta-frame{display:flex;flex-direction:column;border:1px solid #e5e7eb;" +
      "border-radius:8px;background:#fff;overflow:hidden;" +
      "transition:border-color .15s ease,box-shadow .15s ease}" +
      ".x-ta-frame:focus-within{border-color:#fb7185;box-shadow:0 0 0 3px rgba(251,113,133,.18)}" +
      // Textarea trong khung: bỏ viền/nền/ring/bo góc/resize riêng (khung lo hết).
      ".x-ta-frame>textarea{flex:1 1 auto;border:none!important;border-radius:0!important;" +
      "background:transparent!important;box-shadow:none!important;outline:none!important;" +
      "resize:none!important}" +
      // Thanh công cụ: hàng flex cuối khung, kéo hết bề ngang, các nút căn phải.
      ".x-ta-toolbar{display:flex;align-items:center;justify-content:flex-end;gap:6px;" +
      "padding:4px 8px;background:#fff}" +
      ".x-ta-toolbar-btn{display:inline-flex;align-items:center;justify-content:center;" +
      "width:20px;height:20px;padding:0;border:none;border-radius:4px;" +
      "color:#9ca3af;background:transparent;cursor:pointer;" +
      "transition:color .12s ease,background .12s ease}" +
      ".x-ta-toolbar-btn:hover:not(:disabled){color:#e11d48;background:#fff1f2}" +
      ".x-ta-toolbar-btn:disabled{opacity:.4;cursor:default}" +
      ".x-ta-toolbar-btn svg{width:14px;height:14px}" +
      // Nút "Tối ưu" (AI) khi đang gọi: khoá + icon quay.
      ".x-ta-toolbar-btn[data-loading='1']{pointer-events:none;opacity:.5}" +
      ".x-ta-toolbar-btn[data-loading='1'] svg{animation:x-ta-toolbar-spin .9s linear infinite}" +
      "@keyframes x-ta-toolbar-spin{to{transform:rotate(360deg)}}";
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
  const MIC_SVG =
    `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" ` +
    `stroke-width="2" stroke-linecap="round" stroke-linejoin="round">` +
    `<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>` +
    `<path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>`;
  // pencil-sparkles (lucide) — nút "Tối ưu bằng AI".
  const PENCIL_SVG =
    `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" ` +
    `stroke-width="2" stroke-linecap="round" stroke-linejoin="round">` +
    `<path d="M10 3H8"/><path d="m15.007 5.008 3.987 3.986"/><path d="M20 15v4"/>` +
    `<path d="M21.174 6.813a2.82 2.82 0 0 0-3.986-3.987L3.842 16.175a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/>` +
    `<path d="M22 17h-4"/><path d="M4 5v4"/><path d="M6 7H2"/><path d="M9 2v2"/></svg>`;

  function _btn(title, svg) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "x-ta-toolbar-btn";
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
    // Bọc textarea trong 1 khung: khung mang viền giả, textarea bỏ viền → thanh cuộn
    // nằm đúng trong textarea, thanh công cụ là hàng flex dưới đáy (không overlay).
    const frame = document.createElement("div");
    frame.className = "x-ta-frame";
    mount.insertBefore(frame, target);
    frame.appendChild(target);

    const box = document.createElement("div");
    box.className = "x-ta-toolbar" + (opts.className ? " " + opts.className : "");

    // Nút micro (opt-in): chỉ hiện khi truyền opts.speech VÀ trình duyệt hỗ trợ.
    // Bấm → mở hộp thoại "Nói để nhập" (x-speech.js), nói xong tự chèn vào ô này.
    let micBtn = null;
    if (opts.speech && global.speechSupported && global.speechSupported()) {
      micBtn = _btn("Nói để nhập", MIC_SVG);
      micBtn.addEventListener("click", () => {
        global.openSpeechDialog &&
          global.openSpeechDialog({
            target,
            questions: opts.speech.questions || [],
            lang: opts.speech.lang || "vi-VN",
            title: opts.speech.title,
          });
      });
    }

    // Nút "Tối ưu bằng AI" (opt-in): chỉ hiện khi truyền opts.optimize (hàm).
    // Bấm → gọi hàm với (target, chính nút) để nơi dùng tự xử lý gọi AI + loading.
    let optBtn = null;
    if (typeof opts.optimize === "function") {
      optBtn = _btn(opts.optimizeTitle || "Tối ưu bằng AI", PENCIL_SVG);
      optBtn.addEventListener("click", () => opts.optimize(target, optBtn));
    }

    const undoBtn = _btn(opts.undoTitle || "Hoàn tác", UNDO_SVG);
    const redoBtn = _btn(opts.redoTitle || "Làm lại", REDO_SVG);
    const parts = [];
    if (optBtn) parts.push(optBtn);
    if (micBtn) parts.push(micBtn);
    parts.push(undoBtn, redoBtn);
    box.append(...parts);
    frame.appendChild(box); // thanh công cụ = hàng cuối trong khung, dưới textarea

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
        // Gỡ khung: trả textarea về vị trí cũ rồi xoá khung.
        if (frame.parentNode) {
          frame.parentNode.insertBefore(target, frame);
          frame.remove();
        }
        delete target._xUndo;
      },
    };
    target._xUndo = api;
    return api;
  }

  global.attachUndoRedo = attachUndoRedo;
})(window);
