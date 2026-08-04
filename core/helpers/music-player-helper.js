// Trình phát nhạc nền — phần LOGIC dùng chung; theme CHỈ cung cấp HTML.
// Nguồn phát là core/helpers/youtube-helper.js (sự kiện `cx:music-state`) → nạp
// file này SAU youtube-helper. Ẩn/hiện cả trình phát do setupMusic() lo.
//
// Theme đánh dấu vai trò bằng data-cx-music, chỉ "root" là bắt buộc:
//   root · toggle · icon · title · artist · fill · time · duration · back ·
//   forward · thumb (<img> ảnh bìa) · expand
//   progress  vùng bấm để tua; có thể là chính cả thẻ trình phát
//   handle    tay nắm: chạm để đi một nấc
//   swipe     vùng nhận vuốt dọc đổi nấc (nên là cả thanh); thiếu thì chỉ vuốt
//             được trên handle. Vùng này phải touch-action:none.
//   panel     khối mở rộng (tóm tắt thiệp) — helper bật class .is-expanded
//   bubble    bong bóng nổi khi đã thu gọn; có nó mới bật được nấc thu gọn
//
// Tuỳ chỉnh trên thẻ root: data-cx-play-icon / data-cx-pause-icon (class icon,
// ghép vào class theme đặt sẵn — viết trong HTML để purge thấy), data-cx-seek
// (giây, mặc định 10), data-cx-empty-title, data-cx-reveal-on-scroll (chỉ hiện
// sau khi cuộn quá N px, mặc định 64).

/** Gắn logic vào trình phát đã có trong DOM. Bỏ trống `root` thì tự dò. */
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
  // Bỏ class thuộc bộ icon (fa-play/fa-pause…) markup đặt sẵn, không thì mỗi lần
  // đổi trạng thái sẽ ghép chồng cả hai glyph.
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

  // Ba nấc trên một trục dọc:
  //   bong bóng ←(vuốt lên)— thanh —(vuốt xuống)→ thanh + khối mở rộng
  // Không có bong bóng lẫn nút mở lại thì bỏ hẳn nấc thu gọn.
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
      // Widget đã chọn ảnh riêng (ảnh cặp đôi / chỉ nốt nhạc) → đừng đổ ảnh bài hát.
      if (el.hasAttribute("data-cx-art-lock")) return;
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

  // Bấm vào thanh tiến trình để tua. Vùng "progress" có thể là cả thẻ trình phát
  // → bỏ qua cú bấm rơi vào nút bên trong.
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

  // Cử chỉ đổi nấc: vuốt dọc trên vùng "swipe" (thường là CẢ thanh cho dễ trúng,
  // không có thì lùi về đúng tay nắm), chạm tay nắm thì nhảy nấc ngược lại.
  // Vùng vuốt phải khoá touch-action, không thì trình duyệt cuộn trang và cướp
  // mất cử chỉ (xem .cx-mp-swipe trong styles/_music-player.css).
  const swipeEl = $("swipe") || handleEl;
  if (swipeEl) {
    const SWIPE_MIN = 16; // px — đủ để phân biệt vuốt với chạm

    let startX = 0;
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

    // Vuốt xong trình duyệt vẫn bắn click → nuốt đúng cú đó ở nấc capture của
    // root, không thì vuốt trên thanh tiến trình hoá ra tua, vuốt trên nút hoá
    // ra bật/tắt nhạc. Đăng ký lúc THẢ TAY: gỡ bằng setTimeout(0) nên đăng ký
    // sớm hơn (lúc đang giữ) là bị gỡ trước khi click kịp bắn.
    function _swallowClick() {
      const fn = (ev) => {
        ev.stopPropagation();
        ev.preventDefault();
      };
      root.addEventListener("click", fn, { capture: true, once: true });
      setTimeout(
        () => root.removeEventListener("click", fn, { capture: true }),
        0,
      );
    }

    // Theo dõi tiếp trên window: con trỏ dễ ra khỏi vùng vuốt giữa chừng và
    // chuột không có implicit pointer capture như cảm ứng.
    const _onMove = (e) => {
      if (startY === null) return;
      const dy = e.clientY - startY;
      const dx = e.clientX - startX;
      // Chỉ nhận vuốt DỌC: kéo ngang trên thanh tiến trình không được đổi nấc.
      if (Math.abs(dy) < SWIPE_MIN || Math.abs(dy) <= Math.abs(dx)) return;
      startY = null;
      swiped = true;
      _step(dy > 0);
    };
    const _endSwipe = () => {
      startY = null;
      window.removeEventListener("pointermove", _onMove);
      window.removeEventListener("pointerup", _endSwipe);
      window.removeEventListener("pointercancel", _endSwipe);
      if (swiped) {
        swiped = false;
        _swallowClick();
      }
    };

    swipeEl.addEventListener("pointerdown", function (e) {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      startX = e.clientX;
      startY = e.clientY;
      swiped = false;
      window.addEventListener("pointermove", _onMove);
      window.addEventListener("pointerup", _endSwipe);
      window.addEventListener("pointercancel", _endSwipe);
    });
  }

  // Chạm tay nắm (không vuốt) = đi nấc ngược lại nấc hiện tại.
  if (handleEl) {
    handleEl.addEventListener("click", function () {
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

  // Bong bóng nổi khi đã thu gọn: kéo thả được, thả tay thì bay về bám lề gần
  // nhất, chạm = phát/tạm dừng. Vị trí ghi vào style.left/top nên thẻ phải
  // `position: fixed` và không có tổ tiên nào mang `transform`.
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
