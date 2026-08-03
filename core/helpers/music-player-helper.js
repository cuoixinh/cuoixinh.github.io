// ============================================================
// MUSIC-PLAYER-HELPER.JS - Trình phát nhạc nền: phần LOGIC dùng chung
// ============================================================
//
// Mỗi theme có UI trình phát khác nhau (nút tròn góc màn hình, thẻ kiểu app
// nghe nhạc, thanh mỏng…), nhưng việc phải làm thì giống hệt: đổi icon
// phát/dừng, hiện tên bài, chạy thanh tiến trình, tua. File này giữ toàn bộ
// phần đó; theme CHỈ cung cấp HTML.
//
// Nguồn phát nhạc là core/helpers/youtube-helper.js (sự kiện `cx:music-state`
// + getMusicInfo/getMusicPosition/seekMusic) → nạp file này SAU youtube-helper.
// Ẩn/hiện cả trình phát vẫn do setupMusic() trong render-helper.js lo.
//
// ── Cách một theme khai báo UI ─────────────────────────────────────────────
// Đánh dấu từng phần bằng data-cx-music, tất cả đều KHÔNG bắt buộc trừ "root":
//
//   data-cx-music="root"      Thẻ bọc ngoài. Được gắn/gỡ class .is-playing.
//                             Không có thì helper lấy tạm #music-toggle
//                             (id mà setupMusic dùng để ẩn/hiện).
//   data-cx-music="toggle"    Nút phát/tạm dừng.
//   data-cx-music="icon"      Thẻ icon bên trong nút phát (đổi play ↔ pause).
//   data-cx-music="title"     Tên bài. Dài quá khung thì tự chạy (marquee) nếu
//                             có class .cx-mp-title.
//   data-cx-music="artist"    Nghệ sĩ / kênh.
//   data-cx-music="progress"  Vùng tiến trình (bấm vào để tua). Có thể là một
//                             dải mỏng riêng, hoặc đặt thẳng lên thẻ trình phát
//                             để cả thanh là tiến trình — cú bấm rơi vào nút
//                             bên trong tự được bỏ qua.
//   data-cx-music="fill"      Phần đã phát; helper chỉ đặt `width` theo %.
//   data-cx-music="time"      Thời gian đang phát, dạng m:ss.
//   data-cx-music="duration"  Tổng thời lượng, dạng m:ss.
//   data-cx-music="back"      Lùi (mặc định 10 giây).
//   data-cx-music="forward"   Tới (mặc định 10 giây).
//   data-cx-music="thumb"     <img> ảnh bìa bài hát (thumbnail YouTube). Đặt bao
//                             nhiêu thẻ cũng được, helper cập nhật hết; chưa có
//                             ảnh thì thẻ ở trạng thái `hidden`.
//   data-cx-music="handle"    Tay nắm: vuốt lên thì thu gọn, vuốt xuống thì mở
//                             rộng. Có thẻ này là bật tính năng thu gọn.
//   data-cx-music="panel"     Khối mở rộng (tóm tắt thiệp…) — hiện khi kéo XUỐNG
//                             ở tay nắm. Helper chỉ bật/tắt class `is-expanded`
//                             trên thẻ root, còn hình hài (cao bao nhiêu, hiện ra
//                             kiểu gì) là CSS của theme. Không có thẻ này thì tay
//                             nắm giữ nguyên hành vi cũ (chỉ thu gọn/mở lại).
//   data-cx-music="bubble"    Bong bóng nổi hiện khi đã thu gọn: kéo thả đi được
//                             khắp màn hình, thả tay thì tự bay về bám lề gần
//                             nhất; chạm (không kéo) = mở lại thanh. Thanh nhạc
//                             thì luôn đứng yên ở trên, không kéo được.
//   data-cx-music="expand"    Nút mở lại thanh, cho theme muốn tách riêng nút đó
//                             ra khỏi bong bóng.
//
// Tuỳ chỉnh đặt trên thẻ root:
//
//   data-cx-play-icon   Class icon lúc đang dừng   (vd "fas fa-play")
//   data-cx-pause-icon  Class icon lúc đang phát   (vd "fas fa-pause")
//                       Hai cái này được GHÉP vào class theme đặt sẵn trên thẻ
//                       icon, nên cỡ chữ / canh chỉnh cứ viết thẳng ở thẻ đó —
//                       mỗi chỗ đặt icon để một cỡ khác nhau được.
//   data-cx-seek        Số giây cho nút lùi/tới    (mặc định 10)
//   data-cx-empty-title Chữ hiện khi chưa có tên bài (mặc định "Nhạc nền")
//   data-cx-reveal-on-scroll
//                       Có thuộc tính này thì trình phát chỉ hiện khi đã cuộn
//                       quá N px (giá trị của thuộc tính, mặc định 64); ở đầu
//                       trang thì mờ đi. Không đặt → luôn hiện.
//                       Mỗi lần cuộn xuống làm lộ trình phát cũng là một lần thử
//                       phát tiếp — trừ khi người dùng đã chủ động bấm dừng.
//
// Viết class icon vào HTML (không phải chuỗi trong JS) là cố ý: purge của
// Tailwind quét văn bản thô nên class trong thuộc tính HTML thì thấy, còn class
// ghép trong JS của helper thì không (xem CLAUDE.md).

/**
 * Gắn logic vào một trình phát nhạc đã có sẵn trong DOM.
 * @param {HTMLElement} [root] - Thẻ bọc; bỏ trống thì tự dò trong document.
 * @returns {boolean} true nếu gắn được
 */
function setupMusicPlayer(root) {
  root =
    root ||
    document.querySelector('[data-cx-music="root"]') ||
    document.getElementById("music-toggle");
  if (!root || root.dataset.cxMusicReady === "1") return false;
  root.dataset.cxMusicReady = "1";

  const $ = (role) => root.querySelector('[data-cx-music="' + role + '"]');
  // Vai trò có thể xuất hiện NHIỀU chỗ (icon phát/dừng và ảnh bìa vừa nằm trên
  // thanh vừa nằm trong bong bóng, nút phát cũng vậy) → luôn lấy hết.
  const $$ = (role) => root.querySelectorAll('[data-cx-music="' + role + '"]');

  const iconEls = $$("icon");
  const titleEl = $("title");
  const artistEl = $("artist");
  const progEl = $("progress");
  const panelEl = $("panel");
  const fillEl = $("fill");
  const timeEl = $("time");
  const durEl = $("duration");
  const thumbEls = $$("thumb");
  const handleEl = $("handle");

  const playIcon = root.dataset.cxPlayIcon || "";
  const pauseIcon = root.dataset.cxPauseIcon || "";
  // Class theme đặt sẵn trên thẻ icon là phần CỦA THEME (cỡ chữ, canh chỉnh,
  // position…) — nhớ lại để mỗi lần đổi play↔pause còn ghép vào, chứ ghi đè cả
  // className thì theme không đặt được gì lên thẻ này.
  const iconBase = new Map();
  // Bỏ đi các class thuộc BỘ ICON (fa-play / fa-pause…) nếu markup có đặt sẵn:
  // markup được dựng sẵn một icon mặc định để lúc CHƯA gắn logic (ô xem trước
  // trong panel "Thành phần", widget ở chế độ chỉnh) nút phát không rỗng trơ.
  // Không lọc thì mỗi lần đổi trạng thái sẽ ghép chồng cả fa-play lẫn fa-pause.
  const iconSet = new Set(
    ((root.dataset.cxPlayIcon || "") + " " + (root.dataset.cxPauseIcon || ""))
      .split(/\s+/)
      .filter(Boolean),
  );
  iconEls.forEach((el) =>
    iconBase.set(
      el,
      el.className
        .split(/\s+/)
        .filter((c) => c && !iconSet.has(c))
        .join(" "),
    ),
  );
  const seekStep = Number(root.dataset.cxSeek) || 10;
  const emptyTitle = root.dataset.cxEmptyTitle || "Nhạc nền";

  let tickTimer = null;

  // Do khối "chỉ hiện khi đã cuộn" gán (nếu theme bật). Xem _setCollapsed.
  let _setBarHidden = null;

  // Ba trạng thái, đi lên đi xuống theo một trục dọc:
  //   bong bóng  ←(vuốt lên)—  thanh  —(vuốt xuống)→  thanh + khối mở rộng
  // is-collapsed = đang ở bong bóng; is-expanded = đang mở khối tóm tắt.
  // Hai cờ không bao giờ cùng bật (thu về bong bóng thì đóng khối luôn).
  //
  // Không có bong bóng (và cũng không có nút mở lại riêng) thì BỎ hẳn nấc thu
  // gọn: thu lại mà không còn gì để bấm là nhốt luôn người dùng, không mở ra
  // được nữa. Trình phát do công cụ ở tab Giao diện dựng nằm đúng vào ca này —
  // nó đã thả được ở bất kỳ đâu nên không cần bong bóng.
  const canCollapse = !!($("bubble") || $("expand"));

  function _isCollapsed() {
    return root.classList.contains("is-collapsed");
  }

  function _isExpanded() {
    return root.classList.contains("is-expanded");
  }

  function _setExpanded(v) {
    if (!panelEl) return;
    v = !!v;
    root.classList.toggle("is-expanded", v);
    if (handleEl) handleEl.setAttribute("aria-expanded", v ? "true" : "false");
  }

  function _setCollapsed(v) {
    if (v && !canCollapse) return;
    root.classList.toggle("is-collapsed", !!v);
    // Thu về bong bóng thì khối mở rộng cũng phải đóng, không thì lần mở lại
    // thanh sau đó bung nguyên cả khối ra giữa màn hình.
    if (v) _setExpanded(false);
    // Mở lại bằng tay lúc đang ở đầu trang thì luật "chỉ hiện khi đã cuộn" phải
    // nhường: không thì thanh vẫn nấp trên mép màn mà bong bóng đã biến mất —
    // người dùng mất sạch đường vào trình phát.
    if (!v && _setBarHidden) _setBarHidden(false);
  }

  function _fmt(sec) {
    if (!Number.isFinite(sec) || sec < 0) sec = 0;
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return m + ":" + (s < 10 ? "0" : "") + s;
  }

  function _pos() {
    return window.getMusicPosition
      ? window.getMusicPosition()
      : { current: 0, duration: 0 };
  }

  // Tên bài dài hơn khung → cho chạy qua chạy lại thay vì cắt cụt.
  // CSS (.cx-mp-title.is-scroll) đọc --cx-mp-shift để biết phải dịch bao nhiêu.
  function _applyMarquee() {
    if (!titleEl || !titleEl.parentElement) return;
    const over = titleEl.scrollWidth - titleEl.parentElement.clientWidth;
    if (over > 4) {
      titleEl.style.setProperty("--cx-mp-shift", -(over + 8) + "px");
      titleEl.classList.add("is-scroll");
    } else {
      titleEl.classList.remove("is-scroll");
      titleEl.style.removeProperty("--cx-mp-shift");
    }
  }

  // YouTube trả metadata trễ vài nhịp → hàm này bị gọi lại nhiều lần, chỉ vẽ
  // khi thật sự có thay đổi.
  function _renderInfo(info) {
    const title = (info && info.title) || emptyTitle;
    if (titleEl && titleEl.textContent !== title) {
      titleEl.textContent = title;
      titleEl.classList.remove("is-scroll");
      requestAnimationFrame(_applyMarquee);
    }
    if (artistEl) {
      const artist = (info && info.author) || "";
      if (artistEl.textContent !== artist) artistEl.textContent = artist;
    }
    const thumb = (info && info.thumbnail) || "";
    thumbEls.forEach((el) => {
      if (!thumb || el.getAttribute("src") === thumb) return;
      el.onerror = () => {
        el.hidden = true;
      };
      el.src = thumb;
      el.hidden = false;
    });
  }

  function _renderProgress(pos) {
    if (fillEl && pos.duration > 0) {
      fillEl.style.width =
        Math.min(100, (pos.current / pos.duration) * 100) + "%";
    }
    if (timeEl) timeEl.textContent = _fmt(pos.current);
    if (durEl) durEl.textContent = _fmt(pos.duration);
  }

  function _tick() {
    _renderProgress(_pos());
    if (window.getMusicInfo) _renderInfo(window.getMusicInfo());
  }

  // Tua tương đối; vẽ thanh ngay cho phản hồi tức thì, không đợi nhịp tick sau.
  function _seekBy(delta) {
    const pos = _pos();
    if (!pos.duration || !window.seekMusic) return;
    const target = Math.min(pos.duration, Math.max(0, pos.current + delta));
    window.seekMusic(target);
    _renderProgress({ current: target, duration: pos.duration });
  }

  function _onState(e) {
    const info = (e && e.detail) || {};
    root.classList.toggle("is-playing", !!info.playing);
    if (playIcon && pauseIcon) {
      const state = info.playing ? pauseIcon : playIcon;
      iconEls.forEach((el) => {
        const cls = (iconBase.get(el) + " " + state).trim();
        if (el.className !== cls) el.className = cls;
      });
    }
    _renderInfo(info);

    clearInterval(tickTimer);
    tickTimer = null;
    if (info.playing) tickTimer = setInterval(_tick, 500);
  }

  window.addEventListener("cx:music-state", _onState);
  window.addEventListener("resize", _applyMarquee);

  $$("toggle").forEach((el) =>
    el.addEventListener("click", function () {
      if (window.toggleYouTubeMusic) window.toggleYouTubeMusic();
    }),
  );

  $$("back").forEach((el) =>
    el.addEventListener("click", () => _seekBy(-seekStep)),
  );
  $$("forward").forEach((el) =>
    el.addEventListener("click", () => _seekBy(seekStep)),
  );

  // Nút mở lại thanh (thường nằm trên bong bóng). stopPropagation để cú bấm
  // không rơi tiếp xuống bong bóng và bật/tắt nhạc luôn.
  $$("expand").forEach((el) =>
    el.addEventListener("click", function (e) {
      e.stopPropagation();
      _setCollapsed(false);
    }),
  );

  // Bấm vào thanh tiến trình để tua tới đúng chỗ.
  // Vùng "progress" có thể chính là cả thẻ trình phát (theme tô sáng phần đã
  // phát lên nền thay vì kẻ một dải riêng) → phải bỏ qua cú bấm rơi vào nút
  // bên trong, không thì bấm Phát cũng bị tua.
  if (progEl) {
    progEl.addEventListener("click", function (e) {
      // Đang thu gọn: chạm vào dải mỏng còn ló ra là mở lại, không tua.
      if (_isCollapsed()) {
        _setCollapsed(false);
        return;
      }
      if (e.target.closest("button, a, input, select, textarea")) return;
      const pos = _pos();
      if (!pos.duration || !window.seekMusic) return;
      const rect = progEl.getBoundingClientRect();
      const ratio = Math.min(
        1,
        Math.max(0, (e.clientX - rect.left) / rect.width),
      );
      window.seekMusic(ratio * pos.duration);
      _renderProgress({
        current: ratio * pos.duration,
        duration: pos.duration,
      });
    });
  }

  // Tay nắm: vuốt lên đi xuống một nấc, vuốt xuống đi lên một nấc, chạm thì
  // nhảy nấc theo hướng còn lại.
  // Cử chỉ CHỈ bắt trên tay nắm (kèm touch-action:none trong CSS) — bắt trên cả
  // thanh thì mọi cú vuốt để cuộn trang lỡ chạm vào thanh đều làm nó thu gọn.
  if (handleEl) {
    const SWIPE_MIN = 16; // px — đủ để phân biệt vuốt với chạm

    let startY = null;
    let swiped = false;

    // Vuốt lên: đang mở khối thì đóng khối trước, hết khối mới thu về bong bóng.
    // Vuốt xuống: đang ở bong bóng thì trả thanh về trước, rồi mới mở khối.
    // Đi từng nấc như vậy để không bao giờ nhảy thẳng từ bong bóng ra cả khối.
    function _step(down) {
      if (down) {
        if (_isCollapsed()) _setCollapsed(false);
        else _setExpanded(true);
      } else {
        if (_isExpanded()) _setExpanded(false);
        else _setCollapsed(true);
      }
    }

    // Cử chỉ BẮT ĐẦU ở tay nắm nhưng theo dõi tiếp trên window: tay nắm chỉ cao
    // 16px nên vừa nhấc tay đi một chút là con trỏ đã ra khỏi nó. Chuột không có
    // implicit pointer capture như cảm ứng → nghe ngay trên tay nắm thì bản mobile
    // chạy mà bản chuột (xem trước ở invitation-setup) thì không nhận cú vuốt nào.
    const _onMove = (e) => {
      if (startY === null) return;
      const dy = e.clientY - startY;
      if (Math.abs(dy) < SWIPE_MIN) return;
      startY = null;
      swiped = true;
      _step(dy > 0);
    };
    const _endSwipe = () => {
      startY = null;
      window.removeEventListener("pointermove", _onMove);
      window.removeEventListener("pointerup", _endSwipe);
      window.removeEventListener("pointercancel", _endSwipe);
    };

    handleEl.addEventListener("pointerdown", function (e) {
      startY = e.clientY;
      swiped = false;
      window.addEventListener("pointermove", _onMove);
      window.addEventListener("pointerup", _endSwipe);
      window.addEventListener("pointercancel", _endSwipe);
    });

    // Vuốt xong trình duyệt vẫn bắn click → bỏ qua đúng một lần.
    // Chạm = đi nấc NGƯỢC với trạng thái đang ở: đang thu gọn hoặc đang mở khối
    // thì về thanh, đang ở thanh thì mở khối (theme không có khối thì thu gọn,
    // giữ nguyên hành vi cũ).
    handleEl.addEventListener("click", function () {
      if (swiped) {
        swiped = false;
        return;
      }
      if (_isCollapsed()) _setCollapsed(false);
      else if (_isExpanded()) _setExpanded(false);
      else if (panelEl) _setExpanded(true);
      else _setCollapsed(true);
    });

    if (panelEl) {
      handleEl.setAttribute("aria-expanded", "false");

      // Cuộn trang / chạm ra ngoài trong lúc đang mở → đóng khối lại. Khối nằm
      // đè lên đầu thiệp nên để nó mở mãi là chắn mất nội dung.
      window.addEventListener(
        "scroll",
        () => {
          if (_isExpanded()) _setExpanded(false);
        },
        { passive: true },
      );
      document.addEventListener("pointerdown", function (e) {
        if (_isExpanded() && !root.contains(e.target)) _setExpanded(false);
      });
    }
  }

  // Bong bóng nổi (hiện khi đã thu gọn): kéo thả đi được, thả tay thì tự bay về
  // bám lề gần nhất — cùng lối với bong bóng trợ lý AI ở invitation-setup
  // (ai-modal.js) và AssistiveTouch của iPhone. Chạm (không kéo) = phát/tạm dừng.
  //
  // Vị trí ghi thẳng vào style.left/top nên thẻ bong bóng phải `position: fixed`
  // và KHÔNG có tổ tiên nào mang `transform` — transform tạo containing block
  // mới, fixed sẽ tính theo thẻ đó chứ không theo màn hình.
  const bubbleEl = $("bubble");
  if (bubbleEl) {
    const EDGE = 8; // px chừa ra ở mép màn hình
    const DRAG_MIN = 6; // px — quá ngưỡng này mới tính là kéo, dưới là chạm
    const SNAP = "0.22s cubic-bezier(0.32, 0.72, 0, 1)";

    let startX = 0;
    let startY = 0;
    let baseLeft = 0;
    let baseTop = 0;
    let dragging = false;
    let dragged = false;

    function _place(left, top, animate) {
      bubbleEl.style.transition = animate
        ? "left " + SNAP + ", top " + SNAP
        : "";
      bubbleEl.style.left = left + "px";
      bubbleEl.style.top = top + "px";
      // Neo phải/dưới theme đặt sẵn phải bỏ, không thì chọi với left/top.
      bubbleEl.style.right = "auto";
      bubbleEl.style.bottom = "auto";
      if (!animate) return;
      // Bỏ transition sau khi bay xong, để lần kéo sau vẫn bám tay tức thì.
      const clear = () => {
        bubbleEl.style.transition = "";
        bubbleEl.removeEventListener("transitionend", clear);
      };
      bubbleEl.addEventListener("transitionend", clear);
    }

    // Bám lề TRÁI hay PHẢI tuỳ tâm bong bóng đang ở nửa nào; giữ nguyên chiều dọc
    // (chỉ kẹp lại cho khỏi lọt ra ngoài màn).
    function _snapToEdge(animate) {
      const r = bubbleEl.getBoundingClientRect();
      const vw = document.documentElement.clientWidth;
      const vh = document.documentElement.clientHeight;
      const left = r.left + r.width / 2 < vw / 2 ? EDGE : vw - r.width - EDGE;
      const top = Math.max(EDGE, Math.min(r.top, vh - r.height - EDGE));
      _place(left, top, animate);
    }

    bubbleEl.addEventListener("pointerdown", function (e) {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      const r = bubbleEl.getBoundingClientRect();
      startX = e.clientX;
      startY = e.clientY;
      baseLeft = r.left;
      baseTop = r.top;
      dragging = true;
      dragged = false;
      // CỐ Ý không setPointerCapture ở đây: bắt con trỏ ngay từ pointerdown làm
      // sự kiện click bị đổi target/nuốt mất → chạm thường không phát nhạc được.
      // Chỉ bắt khi đã thật sự vượt ngưỡng kéo (xem pointermove).
    });

    bubbleEl.addEventListener("pointermove", function (e) {
      if (!dragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (!dragged && Math.abs(dx) < DRAG_MIN && Math.abs(dy) < DRAG_MIN)
        return;
      if (!dragged) {
        dragged = true;
        try {
          bubbleEl.setPointerCapture(e.pointerId);
        } catch (err) {}
      }
      const vw = document.documentElement.clientWidth;
      const vh = document.documentElement.clientHeight;
      const w = bubbleEl.offsetWidth;
      const h = bubbleEl.offsetHeight;
      _place(
        Math.max(EDGE, Math.min(baseLeft + dx, vw - w - EDGE)),
        Math.max(EDGE, Math.min(baseTop + dy, vh - h - EDGE)),
        false,
      );
    });

    const _endDrag = (e) => {
      if (!dragging) return;
      dragging = false;
      if (!dragged) return;
      try {
        bubbleEl.releasePointerCapture(e.pointerId);
      } catch (err) {}
      _snapToEdge(true);
      // Thả tay xong trình duyệt vẫn bắn click → nuốt đúng cú đó, không thì vừa
      // kéo xong là nhạc bị bật/tắt theo.
      const swallow = (ev) => {
        ev.stopPropagation();
        ev.preventDefault();
      };
      bubbleEl.addEventListener("click", swallow, {
        capture: true,
        once: true,
      });
      setTimeout(
        () => bubbleEl.removeEventListener("click", swallow, { capture: true }),
        0,
      );
    };
    bubbleEl.addEventListener("pointerup", _endDrag);
    bubbleEl.addEventListener("pointercancel", _endDrag);

    // Chạm (không kéo) = mở lại thanh.
    bubbleEl.addEventListener("click", function () {
      _setCollapsed(false);
    });

    // Xoay ngang máy / đổi cỡ cửa sổ → bám lại lề cho khỏi lọt ra ngoài.
    window.addEventListener("resize", function () {
      if (bubbleEl.style.left) _snapToEdge(false);
    });
  }

  // Chỉ hiện khi đã cuộn xuống (tuỳ chọn). Không đụng tới `display` vì đó là
  // phần setupMusic() quản (bật/tắt nhạc nền) — ở đây chỉ mờ/hiện bằng class.
  if (root.dataset.cxRevealOnScroll !== undefined) {
    const threshold = Number(root.dataset.cxRevealOnScroll) || 64;
    root.classList.add("cx-mp-reveal");

    let raf = 0;
    let hidden = null;

    // Đổi trạng thái ẩn/hiện KÈM cập nhật `hidden` — phải đi qua đây, gán thẳng
    // class thì lần cuộn sau `nowHidden === hidden` sẽ thoát sớm và kẹt luôn.
    _setBarHidden = (v) => {
      hidden = v;
      root.classList.toggle("is-hidden", v);
    };

    const _syncReveal = () => {
      raf = 0;
      const nowHidden = (window.scrollY || 0) < threshold;
      if (nowHidden === hidden) return;
      _setBarHidden(nowHidden);
      // Vừa cuộn xuống làm lộ trình phát → phát tiếp luôn. resumeMusicIfAllowed
      // tự bỏ qua nếu người dùng đã chủ động bấm dừng trước đó.
      if (!nowHidden && window.resumeMusicIfAllowed) {
        window.resumeMusicIfAllowed();
      }
    };
    window.addEventListener(
      "scroll",
      () => {
        if (!raf) raf = requestAnimationFrame(_syncReveal);
      },
      { passive: true },
    );
    _syncReveal();
  }

  // Vẽ trạng thái ban đầu (player có thể đã sẵn sàng trước khi helper gắn vào)
  _onState({ detail: window.getMusicInfo ? window.getMusicInfo() : {} });
  return true;
}

// Tự gắn khi DOM có sẵn. Theme nào dựng markup trình phát muộn hơn thì gọi tay
// setupMusicPlayer(el) — hàm có cờ chống gắn hai lần.
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => setupMusicPlayer());
} else {
  setupMusicPlayer();
}

window.setupMusicPlayer = setupMusicPlayer;
