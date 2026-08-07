// x-speech — hộp thoại "Nói để nhập" (speech-to-text) DÙNG CHUNG.
//   window.openSpeechDialog({ target, questions, lang, title }) mở popup: câu hỏi
//     gợi ý, ô hiện chữ nhận dạng dần (chữ chốt đậm, chữ tạm nhạt), vòng tròn
//     micro phình theo âm lượng. Bấm "Dừng" → chèn nội dung vào `target` (nối
//     vào cuối) rồi phát 'input' để autosave / x-undo tự đồng bộ.
//   window.speechSupported() → có hỗ trợ SpeechRecognition hay không.
// Âm lượng dùng getUserMedia + AnalyserNode; bị từ chối thì vẫn chạy nhận dạng,
// vòng tròn chuyển sang nhịp "thở" mặc định.
(function (global) {
  const Rec = global.SpeechRecognition || global.webkitSpeechRecognition;

  function speechSupported() {
    return !!Rec;
  }

  // ── CSS (tiêm 1 lần) ────────────────────────────────────────────────────────
  if (!document.getElementById("x-speech-style")) {
    const s = document.createElement("style");
    s.id = "x-speech-style";
    s.textContent = [
      ".xsp-overlay{position:fixed;inset:0;z-index:100000;display:flex;align-items:center;",
      "justify-content:center;padding:16px;background:rgb(var(--scrim-slate-rgb)/.45);",
      "backdrop-filter:blur(4px);animation:xsp-fade .2s ease-out}",
      "@keyframes xsp-fade{from{opacity:0}to{opacity:1}}",
      ".xsp-card{width:100%;max-width:420px;max-height:90vh;display:flex;flex-direction:column;",
      "background:rgb(var(--white-rgb));border-radius:20px;box-shadow:0 24px 60px rgb(var(--scrim-slate-rgb)/.3);",
      "overflow:hidden;animation:xsp-pop .25s cubic-bezier(.2,.8,.2,1)}",
      "@keyframes xsp-pop{from{opacity:0;transform:translateY(12px) scale(.98)}to{opacity:1;transform:none}}",
      ".xsp-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:16px 16px 12px}",
      ".xsp-title{font-size:16px;font-weight:700;color:rgb(var(--text-title-rgb))}",
      ".xsp-close{width:28px;height:28px;border:none;background:rgb(var(--surface-control-rgb));color:rgb(var(--text-tertiary-rgb));",
      "border-radius:8px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0}",
      ".xsp-close:hover{background:rgb(var(--border-field-rgb));color:rgb(var(--surface-inverse-rgb))}",
      ".xsp-close svg{width:16px;height:16px}",
      ".xsp-body{padding:0 16px 16px;overflow-y:auto}",
      ".xsp-q{margin-bottom:12px}",
      ".xsp-q-label{font-size:12px;font-weight:600;color:rgb(var(--action-primary-hover-rgb));margin-bottom:8px}",
      ".xsp-q-list{display:flex;flex-direction:column;gap:4px}",
      ".xsp-q-item{font-size:12px;color:rgb(var(--text-tertiary-rgb));line-height:1.5;padding-left:16px;position:relative}",
      ".xsp-q-item::before{content:'•';position:absolute;left:4px;color:rgb(var(--timeline-dot-rgb))}",
      ".xsp-transcript{min-height:120px;max-height:240px;overflow-y:auto;border:1px solid rgb(var(--border-field-rgb));",
      "border-radius:12px;padding:12px;font-size:12px;line-height:1.5;color:rgb(var(--text-strong-rgb));background:rgb(var(--surface-readonly-rgb));white-space:pre-wrap;word-break:break-word}",
      ".xsp-interim{color:rgb(var(--text-idle-rgb))}",
      ".xsp-placeholder{color:rgb(var(--text-placeholder-rgb))}",
      ".xsp-foot{display:flex;align-items:center;gap:12px;padding:12px 16px 16px;border-top:1px solid rgb(var(--surface-control-rgb))}",
      ".xsp-mic-wrap{position:relative;width:48px;height:48px;flex-shrink:0;display:inline-flex;align-items:center;justify-content:center}",
      ".xsp-mic-pulse{position:absolute;inset:0;border-radius:9999px;background:linear-gradient(135deg,rgb(var(--ai-soft-from-rgb)),rgb(var(--ai-soft-to-rgb)));",
      "opacity:.25;transform:scale(1);transition:transform .08s ease-out,opacity .08s ease-out}",
      ".xsp-mic-wrap.idle .xsp-mic-pulse{animation:xsp-idle 1.6s ease-in-out infinite}",
      "@keyframes xsp-idle{0%,100%{transform:scale(1);opacity:.2}50%{transform:scale(1.25);opacity:.4}}",
      ".xsp-mic{position:relative;width:40px;height:40px;border-radius:9999px;",
      "background:linear-gradient(135deg,rgb(var(--ai-soft-from-rgb)),rgb(var(--ai-soft-to-rgb)));color:rgb(var(--white-rgb));display:inline-flex;",
      "align-items:center;justify-content:center;box-shadow:0 8px 20px rgb(var(--ai-glow-rgb)/.35)}",
      ".xsp-mic svg{width:20px;height:20px}",
      ".xsp-status{flex:1;min-width:0;font-size:12px;color:rgb(var(--text-tertiary-rgb));white-space:nowrap;",
      "overflow:hidden;text-overflow:ellipsis}",
      ".xsp-actions{flex-shrink:0;display:inline-flex;align-items:center;gap:8px}",
      ".xsp-pause{box-sizing:border-box;height:40px;padding:0 16px;border:1px solid rgb(var(--border-field-rgb));border-radius:12px;",
      "background:rgb(var(--white-rgb));color:rgb(var(--text-strong-rgb));font-size:12px;font-weight:600;cursor:pointer;",
      "display:inline-flex;align-items:center;gap:8px}",
      ".xsp-pause:hover{background:rgb(var(--surface-control-rgb))}",
      ".xsp-pause svg{width:16px;height:16px}",
      ".xsp-apply{box-sizing:border-box;height:40px;padding:0 16px;border:1px solid transparent;border-radius:12px;",
      "background:rgb(var(--surface-inverse-rgb));color:rgb(var(--white-rgb));font-size:12px;font-weight:600;cursor:pointer;",
      "display:inline-flex;align-items:center;gap:8px}",
      ".xsp-apply:hover{background:rgb(var(--scrim-rgb))}",
      ".xsp-apply svg{width:16px;height:16px}",
      ".xsp-mic-wrap.paused .xsp-mic{filter:grayscale(.4);opacity:.85}",
      // ── Mobile: thu nhỏ hàng nút thao tác ──────────────────────────────────
      "@media (max-width:480px){",
      ".xsp-foot{gap:8px;padding:8px 12px 12px}",
      ".xsp-mic-wrap{width:40px;height:40px}",
      ".xsp-mic{width:32px;height:32px}",
      ".xsp-mic svg{width:16px;height:16px}",
      ".xsp-actions{gap:8px}",
      ".xsp-pause{height:32px;padding:0 12px;border-radius:8px;gap:4px}",
      ".xsp-apply{height:32px;padding:0 12px;border-radius:8px;gap:4px}",
      ".xsp-pause svg,.xsp-apply svg{width:14px;height:14px}",
      "}",
    ].join("");
    document.head.appendChild(s);
  }

  const MIC_SVG =
    `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" ` +
    `stroke-width="2" stroke-linecap="round" stroke-linejoin="round">` +
    `<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>` +
    `<path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>`;
  const STOP_SVG =
    `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" stroke="none">` +
    `<rect x="6" y="6" width="12" height="12" rx="2"/></svg>`;
  const PLAY_SVG =
    `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" stroke="none">` +
    `<path d="M8 5v14l11-7z"/></svg>`;
  const CHECK_SVG =
    `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" ` +
    `stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`;
  const X_SVG =
    `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" ` +
    `stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">` +
    `<path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`;

  function _esc(s) {
    return String(s).replace(/[&<>"]/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
    );
  }

  function openSpeechDialog(opts = {}) {
    const {
      target,
      questions = [],
      lang = "vi-VN",
      title = "Nói để nhập nội dung",
    } = opts;

    if (!speechSupported()) {
      const msg = "⚠️ Trình duyệt không hỗ trợ nhập bằng giọng nói (hãy dùng Chrome/Edge).";
      if (typeof global.showToast === "function") global.showToast(msg, "warning");
      else alert(msg);
      return null;
    }

    // ── Dựng DOM ──────────────────────────────────────────────────────────────
    const overlay = document.createElement("div");
    overlay.className = "xsp-overlay";
    const qHtml = questions.length
      ? `<div class="xsp-q">
           <p class="xsp-q-label">Gợi ý — bạn có thể trả lời:</p>
           <div class="xsp-q-list">${questions
             .map((q) => `<div class="xsp-q-item">${_esc(q)}</div>`)
             .join("")}</div>
         </div>`
      : "";
    overlay.innerHTML = `
      <div class="xsp-card" role="dialog" aria-modal="true" aria-label="${_esc(title)}">
        <div class="xsp-head">
          <span class="xsp-title">${_esc(title)}</span>
          <button type="button" class="xsp-close" aria-label="Đóng">${X_SVG}</button>
        </div>
        <div class="xsp-body">
          ${qHtml}
          <div class="xsp-transcript" aria-live="polite"><span class="xsp-final"></span><span class="xsp-interim"></span><span class="xsp-placeholder">Đang lắng nghe… bạn nói đi nhé</span></div>
        </div>
        <div class="xsp-foot">
          <div class="xsp-mic-wrap"><div class="xsp-mic-pulse"></div><div class="xsp-mic">${MIC_SVG}</div></div>
          <span class="xsp-status">Đang lắng nghe…</span>
          <div class="xsp-actions">
            <button type="button" class="xsp-pause">${STOP_SVG}<span class="xsp-pause-label">Dừng</span></button>
            <button type="button" class="xsp-apply">${CHECK_SVG} Áp dụng</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    const card = overlay.querySelector(".xsp-card");
    const finalEl = overlay.querySelector(".xsp-final");
    const interimEl = overlay.querySelector(".xsp-interim");
    const placeholderEl = overlay.querySelector(".xsp-placeholder");
    const transcriptEl = overlay.querySelector(".xsp-transcript");
    const micWrap = overlay.querySelector(".xsp-mic-wrap");
    const pulse = overlay.querySelector(".xsp-mic-pulse");
    const statusEl = overlay.querySelector(".xsp-status");
    const pauseBtn = overlay.querySelector(".xsp-pause");
    const applyBtn = overlay.querySelector(".xsp-apply");
    const closeBtn = overlay.querySelector(".xsp-close");

    // ── Trạng thái ──────────────────────────────────────────────────────────
    let finalText = "";
    let lastInterim = ""; // phần đang nói dở (chưa chốt) — vẫn phải chèn khi Áp dụng
    let stopping = false;
    let paused = false; // tạm dừng thu âm (nút Dừng ⇄ Tiếp tục)
    let audioCtx = null,
      analyser = null,
      micStream = null,
      rafId = 0,
      dataArr = null;

    const renderTranscript = (interim) => {
      const has = finalText || interim;
      placeholderEl.style.display = has ? "none" : "";
      finalEl.textContent = finalText;
      interimEl.textContent = interim || "";
      transcriptEl.scrollTop = transcriptEl.scrollHeight;
    };

    // ── Đo âm lượng → phình/thu vòng tròn ──────────────────────────────────────
    async function startMeter() {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const AC = global.AudioContext || global.webkitAudioContext;
      audioCtx = new AC();
      const src = audioCtx.createMediaStreamSource(micStream);
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      src.connect(analyser);
      dataArr = new Uint8Array(analyser.fftSize);
      const loop = () => {
        if (paused) {
          // Tạm dừng → vòng tròn về cỡ gốc, vẫn giữ vòng lặp để tiếp tục mượt.
          pulse.style.transform = "scale(1)";
          pulse.style.opacity = "0.15";
          rafId = requestAnimationFrame(loop);
          return;
        }
        analyser.getByteTimeDomainData(dataArr);
        let sum = 0;
        for (let i = 0; i < dataArr.length; i++) {
          const v = (dataArr[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / dataArr.length); // 0..~1
        const scale = 1 + Math.min(rms * 6, 1.6); // to lên khi có tiếng
        pulse.style.transform = `scale(${scale})`;
        pulse.style.opacity = String(Math.min(0.18 + rms * 3, 0.6));
        rafId = requestAnimationFrame(loop);
      };
      loop();
    }

    // ── Nhận dạng giọng nói ─────────────────────────────────────────────────
    const rec = new Rec();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interim += r[0].transcript;
      }
      lastInterim = interim;
      renderTranscript(interim);
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        statusEl.textContent = "Không có quyền dùng micro.";
        stopping = true;
      }
      // 'no-speech' / 'aborted' → để onend tự khởi động lại.
    };
    rec.onend = () => {
      // Chrome tự dừng sau khoảng lặng dù continuous=true → khởi động lại nếu chưa
      // đóng và không đang tạm dừng.
      if (!stopping && !paused) {
        try {
          rec.start();
        } catch {}
      }
    };

    // ── Kết thúc: dọn dẹp + (tuỳ chọn) chèn vào target ─────────────────────────
    function cleanup() {
      stopping = true;
      try {
        rec.onend = null;
        rec.stop();
      } catch {}
      if (rafId) cancelAnimationFrame(rafId);
      try {
        micStream && micStream.getTracks().forEach((t) => t.stop());
      } catch {}
      try {
        audioCtx && audioCtx.close();
      } catch {}
      document.removeEventListener("keydown", onKey, true);
      overlay.remove();
    }

    function commitAndClose() {
      // Gộp cả phần đang nói dở (interim) — bấm Áp dụng lúc đang nói vẫn phải chèn
      // trọn câu, không rớt mấy chữ cuối chưa kịp chốt.
      const text = (finalText + " " + lastInterim).replace(/\s+/g, " ").trim();
      cleanup();
      if (text && target) {
        const cur = target.value || "";
        target.value = cur ? cur.replace(/\s*$/, "") + "\n" + text : text;
        target.dispatchEvent(new Event("input", { bubbles: true }));
        try {
          const host = target.closest && target.closest("x-input, x-textarea");
          host && host.syncClearBtn && host.syncClearBtn();
        } catch {}
        const end = target.value.length;
        try {
          target.focus();
          target.setSelectionRange(end, end);
        } catch {}
      }
    }

    // Dừng ⇄ Tiếp tục: tạm dừng/khởi động lại thu âm (KHÔNG chèn, KHÔNG đóng).
    function togglePause() {
      paused = !paused;
      if (paused) {
        try { rec.stop(); } catch {}
        pauseBtn.innerHTML = PLAY_SVG + `<span class="xsp-pause-label">Tiếp tục</span>`;
        statusEl.textContent = "Đã tạm dừng";
        micWrap.classList.add("paused");
      } else {
        try { rec.start(); } catch {}
        pauseBtn.innerHTML = STOP_SVG + `<span class="xsp-pause-label">Dừng</span>`;
        statusEl.textContent = "Đang lắng nghe…";
        micWrap.classList.remove("paused");
      }
    }

    const onKey = (ev) => {
      if (ev.key === "Escape") {
        ev.preventDefault();
        cleanup();
      }
    };

    pauseBtn.addEventListener("click", togglePause);
    applyBtn.addEventListener("click", commitAndClose); // chèn nội dung rồi đóng
    closeBtn.addEventListener("click", cleanup); // đóng KHÔNG chèn
    overlay.addEventListener("mousedown", (ev) => {
      if (ev.target === overlay) cleanup(); // bấm nền tối = huỷ
    });
    card.addEventListener("mousedown", (ev) => ev.stopPropagation());
    document.addEventListener("keydown", onKey, true);

    // ── Bắt đầu ─────────────────────────────────────────────────────────────
    (async () => {
      let meterOk = false;
      try {
        await startMeter();
        meterOk = true;
      } catch {
        micWrap.classList.add("idle"); // không đo được → nhịp "thở" mặc định
      }
      try {
        rec.start();
      } catch {
        if (!meterOk) {
          statusEl.textContent = "Không truy cập được micro.";
        }
      }
    })();

    return { close: cleanup, commit: commitAndClose };
  }

  global.openSpeechDialog = openSpeechDialog;
  global.speechSupported = speechSupported;
})(window);
