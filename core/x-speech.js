// ============================================================================
// x-speech — hộp thoại "Nói để nhập" (speech-to-text) DÙNG CHUNG.
//
// window.openSpeechDialog({ target, questions, lang, title }) mở popup:
//   • Trên cùng: danh sách câu hỏi gợi ý để người dùng nói (trả lời).
//   • Giữa: 1 thẻ div nhìn giống textarea, hiện chữ nhận dạng dần khi nói
//     (chữ chốt màu đậm, chữ tạm màu nhạt).
//   • Dưới: vòng tròn micro PHÌNH TO theo âm lượng (im lặng thì nhỏ lại) + nút Dừng.
//   • Bấm "Dừng" → tắt thu âm, đóng popup, CHÈN nội dung vừa nói vào `target`
//     (nối vào cuối) rồi phát 'input' để autosave / x-undo / nút xoá tự đồng bộ.
//
// window.speechSupported() → có hỗ trợ SpeechRecognition hay không.
//
// Nhận dạng: SpeechRecognition (Chrome/Edge/Safari). Âm lượng: getUserMedia +
// AnalyserNode (nếu bị từ chối vẫn chạy nhận dạng, vòng tròn dùng nhịp "thở" mặc định).
// ============================================================================
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
      "justify-content:center;padding:16px;background:rgba(15,23,42,.45);",
      "backdrop-filter:blur(4px);animation:xsp-fade .2s ease-out}",
      "@keyframes xsp-fade{from{opacity:0}to{opacity:1}}",
      ".xsp-card{width:100%;max-width:420px;max-height:90vh;display:flex;flex-direction:column;",
      "background:#fff;border-radius:20px;box-shadow:0 24px 60px rgba(15,23,42,.3);",
      "overflow:hidden;animation:xsp-pop .25s cubic-bezier(.2,.8,.2,1)}",
      "@keyframes xsp-pop{from{opacity:0;transform:translateY(12px) scale(.98)}to{opacity:1;transform:none}}",
      ".xsp-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:16px 16px 12px}",
      ".xsp-title{font-size:16px;font-weight:700;color:#1f2937}",
      ".xsp-close{width:28px;height:28px;border:none;background:#f3f4f6;color:#6b7280;",
      "border-radius:8px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0}",
      ".xsp-close:hover{background:#e5e7eb;color:#111827}",
      ".xsp-close svg{width:16px;height:16px}",
      ".xsp-body{padding:0 16px 16px;overflow-y:auto}",
      ".xsp-q{margin-bottom:12px}",
      ".xsp-q-label{font-size:12px;font-weight:600;color:#e11d48;margin-bottom:8px}",
      ".xsp-q-list{display:flex;flex-direction:column;gap:4px}",
      ".xsp-q-item{font-size:12px;color:#6b7280;line-height:1.5;padding-left:16px;position:relative}",
      ".xsp-q-item::before{content:'•';position:absolute;left:4px;color:#fda4af}",
      ".xsp-transcript{min-height:120px;max-height:240px;overflow-y:auto;border:1px solid #e5e7eb;",
      "border-radius:12px;padding:12px;font-size:16px;line-height:1.5;color:#374151;background:#fafafa;white-space:pre-wrap;word-break:break-word}",
      ".xsp-interim{color:#9ca3af}",
      ".xsp-placeholder{color:#b6bcc6}",
      ".xsp-foot{display:flex;align-items:center;gap:12px;padding:12px 16px 16px;border-top:1px solid #f3f4f6}",
      ".xsp-mic-wrap{position:relative;width:48px;height:48px;flex-shrink:0;display:inline-flex;align-items:center;justify-content:center}",
      ".xsp-mic-pulse{position:absolute;inset:0;border-radius:9999px;background:linear-gradient(135deg,#cbb9f5,#81b1ff);",
      "opacity:.25;transform:scale(1);transition:transform .08s ease-out,opacity .08s ease-out}",
      ".xsp-mic-wrap.idle .xsp-mic-pulse{animation:xsp-idle 1.6s ease-in-out infinite}",
      "@keyframes xsp-idle{0%,100%{transform:scale(1);opacity:.2}50%{transform:scale(1.25);opacity:.4}}",
      ".xsp-mic{position:relative;width:40px;height:40px;border-radius:9999px;",
      "background:linear-gradient(135deg,#cbb9f5,#81b1ff);color:#fff;display:inline-flex;",
      "align-items:center;justify-content:center;box-shadow:0 8px 20px rgba(99,102,241,.35)}",
      ".xsp-mic svg{width:20px;height:20px}",
      ".xsp-status{flex:1;min-width:0;font-size:12px;color:#6b7280}",
      ".xsp-stop{flex-shrink:0;height:40px;padding:0 16px;border:none;border-radius:12px;",
      "background:#111827;color:#fff;font-size:12px;font-weight:600;cursor:pointer;",
      "display:inline-flex;align-items:center;gap:8px}",
      ".xsp-stop:hover{background:#000}",
      ".xsp-stop svg{width:16px;height:16px}",
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
          <div class="xsp-transcript" aria-live="polite">
            <span class="xsp-final"></span><span class="xsp-interim"></span><span class="xsp-placeholder">Bắt đầu nói, chữ sẽ hiện dần ở đây…</span>
          </div>
        </div>
        <div class="xsp-foot">
          <div class="xsp-mic-wrap"><div class="xsp-mic-pulse"></div><div class="xsp-mic">${MIC_SVG}</div></div>
          <span class="xsp-status">Đang lắng nghe…</span>
          <button type="button" class="xsp-stop">${STOP_SVG} Dừng &amp; chèn</button>
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
    const stopBtn = overlay.querySelector(".xsp-stop");
    const closeBtn = overlay.querySelector(".xsp-close");

    // ── Trạng thái ──────────────────────────────────────────────────────────
    let finalText = "";
    let stopping = false;
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
      // Chrome tự dừng sau khoảng lặng dù continuous=true → khởi động lại nếu chưa Dừng.
      if (!stopping) {
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
      const text = finalText.trim();
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

    const onKey = (ev) => {
      if (ev.key === "Escape") {
        ev.preventDefault();
        cleanup();
      }
    };

    stopBtn.addEventListener("click", commitAndClose);
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
