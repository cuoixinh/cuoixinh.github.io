// Nhật ký nhạc nền ngay trên màn hình — chỉ nạp khi URL có ?cxdebug=music (xem đầu
// youtube-helper.js). Ghi mọi lệnh gửi player + trạng thái + cú chạm/vuốt, có nút
// Copy để dán kết quả. Không đụng gì tới luồng phát nhạc.
(function () {
  const t0 = Date.now();
  const lines = [];
  const box = document.createElement("div");
  box.setAttribute("data-cx-music-debug", "");
  box.style.cssText =
    "position:fixed;top:0;left:0;right:0;z-index:2147483646;max-height:30vh;display:flex;flex-direction:column;background:rgb(0 0 0 / 0.85);color:#9f9;font:11px/1.35 ui-monospace,monospace";
  box.innerHTML =
    '<div style="display:flex;gap:8px;padding:4px 8px;background:#000">' +
    '<button type="button" data-act="copy" style="padding:4px 10px;border-radius:999px;border:0;background:#b4536a;color:#fff;font:12px sans-serif">Copy log</button>' +
    '<button type="button" data-act="hide" style="padding:4px 10px;border-radius:999px;border:1px solid #666;background:none;color:#ccc;font:12px sans-serif">Thu gọn</button>' +
    "</div>" +
    '<pre style="margin:0;padding:4px 8px;overflow:auto;white-space:pre-wrap"></pre>';
  const pre = box.querySelector("pre");

  function log(s) {
    const line = `${((Date.now() - t0) / 1000).toFixed(2)}s ${s}`;
    lines.push(line);
    pre.textContent += line + "\n";
    pre.scrollTop = pre.scrollHeight;
  }

  async function copy() {
    const text = lines.join("\n");
    try {
      await navigator.clipboard.writeText(text);
      log("(đã copy log)");
    } catch (e) {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      ta.setSelectionRange(0, text.length);
      let ok = false;
      try {
        ok = document.execCommand("copy");
      } catch (e2) {}
      ta.remove();
      log(ok ? "(đã copy log)" : "(không copy được — chụp màn hình giúp nhé)");
    }
  }

  box.addEventListener("click", (e) => {
    const act = e.target.closest("[data-act]")?.dataset.act;
    if (act === "copy") copy();
    if (act === "hide") pre.hidden = !pre.hidden;
  });
  const mount = () => document.body.appendChild(box);
  if (document.body) mount();
  else document.addEventListener("DOMContentLoaded", mount);

  /* global CX_VERSION, youtubePlayer, isYouTubePlaying */
  const ver = typeof CX_VERSION !== "undefined" ? CX_VERSION : "?";
  const fresh = typeof _playMusic === "function" ? "mới" : "CŨ (máy đang giữ bản cũ)";
  log(`CX_VERSION=${ver} · youtube-helper ${fresh}`);
  log(navigator.userAgent);

  // Bọc các lệnh gửi player để ghi lại — đợi youtube-helper tạo player xong.
  const ST = { "-1": "UNSTARTED", 0: "ENDED", 1: "PLAYING", 2: "PAUSED", 3: "BUFFERING", 5: "CUED" };
  const hook = setInterval(() => {
    if (typeof youtubePlayer === "undefined" || !youtubePlayer || !youtubePlayer.playVideo) return;
    clearInterval(hook);
    ["playVideo", "pauseVideo", "mute", "unMute", "seekTo"].forEach((fn) => {
      const orig = youtubePlayer[fn].bind(youtubePlayer);
      youtubePlayer[fn] = (...a) => {
        log(`→ ${fn}(${a.join(",")})`);
        return orig(...a);
      };
    });
    youtubePlayer.addEventListener("onReady", () => log("onReady"));
    youtubePlayer.addEventListener("onStateChange", (e) => {
      let muted = "?";
      try {
        muted = youtubePlayer.isMuted();
      } catch (err) {}
      log(`state ${ST[e.data] || e.data} muted=${muted}`);
    });
    youtubePlayer.addEventListener("onError", (e) => log(`onError ${e.data}`));
    youtubePlayer.addEventListener("onAutoplayBlocked", () => log("onAutoplayBlocked"));
    const host = document.getElementById("youtube-music-player")?.parentElement;
    const r = host?.getBoundingClientRect();
    log(`player: ${r ? `${Math.round(r.width)}×${Math.round(r.height)} @${Math.round(r.left)},${Math.round(r.top)}` : "?"} · màn ${innerWidth}×${innerHeight}`);
  }, 50);

  // Thao tác của khách (bỏ qua chạm vào chính bảng log).
  let moved = false;
  const mine = (e) => e.target.closest?.("[data-cx-music-debug]");
  const what = (el) => el.id ? `#${el.id}` : el.classList?.contains("open-btn") ? ".open-btn" : el.tagName;
  document.addEventListener("touchend", (e) => { if (!mine(e)) log(`chạm (touchend) ${what(e.target)}`); }, { capture: true, passive: true });
  document.addEventListener("click", (e) => { if (!mine(e)) log(`click ${what(e.target)}`); }, { capture: true });
  document.addEventListener("touchmove", (e) => {
    if (moved || mine(e)) return;
    moved = true;
    log("vuốt lần đầu");
  }, { capture: true, passive: true });
  document.addEventListener("visibilitychange", () => log(`visibility ${document.visibilityState}`));
  window.addEventListener("blur", () => log("window blur"));
  window.addEventListener("focus", () => log("window focus"));
  window.addEventListener("resize", () => log(`resize ${innerWidth}×${innerHeight}`));
})();
