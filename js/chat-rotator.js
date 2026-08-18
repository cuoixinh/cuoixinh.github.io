// Widget hỗ trợ: chỉ một bong bóng Messenger + nút X. Bấm X là tắt HẲN và nhớ
// lựa chọn đó (không có ghim ở mép phải để mở lại) — xoá cache thì lần sau lại hiện.
(function initSupportBubble() {
  var widget = document.getElementById("chatWidget");
  if (!widget) return;

  // Lần trước đã tắt → gỡ ngay, đừng để chớp lên một nhịp rồi mới biến mất.
  var CHAT_HIDDEN_KEY = buildCacheKey("chat_hidden");
  if (getCache(CHAT_HIDDEN_KEY)) {
    widget.remove();
    return;
  }

  // Bắt sự kiện ở DOCUMENT chứ không gắn thẳng vào #supportClose: <x-button>
  // TỰ THAY THẾ mình bằng <button> thật lúc DOMContentLoaded, mà file này chạy
  // ngay khi parse tới — gắn vào thẻ cũ thì listener biến mất cùng thẻ đó.
  document.addEventListener("click", function (e) {
    var btn = e.target.closest && e.target.closest("#supportClose");
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    widget.remove();
    setCache(CHAT_HIDDEN_KEY, true);
  });

  // Mới vào chưa hiện; cuộn quá nửa màn mới thả bong bóng ra.
  widget.classList.add("is-away");
  function _revealChat() {
    if ((window.scrollY || 0) < window.innerHeight * 0.5) return;
    widget.classList.remove("is-away");
    window.removeEventListener("scroll", _revealChat);
  }
  window.addEventListener("scroll", _revealChat, { passive: true });
  _revealChat();
})();

// Kéo thả bong bóng hỗ trợ: thả tay ra là tự bám vào lề trái/phải gần nhất
// (kiểu AssistiveTouch của iPhone). Vị trí đứng lại được nhớ theo tỉ lệ chiều
// cao màn hình nên đổi khổ màn / xoay ngang vẫn nằm đúng chỗ tương đối.
(function initSupportBubbleDrag() {
  var widget = document.getElementById("chatWidget");
  if (!widget) return;

  // Lề bám đọc thẳng từ CSS lúc widget còn nguyên vị trí gốc (đã tính cả
  // safe-area của máy có tai thỏ) → sửa lề trong markup là JS đi theo, và bong
  // bóng sau khi kéo bám lại ĐÚNG chỗ ban đầu. Lề 24px là mức sát nhất mà vòng
  // sóng (scale 1.9 của 52px → tràn ~24px mỗi bên) và nút X (tràn 4px) không bị
  // cắt mất.
  var EDGE = parseFloat(getComputedStyle(widget).right) || 24;
  var POS_KEY = buildCacheKey("chat_pos");
  var pos = getCache(POS_KEY); // { side: "left"|"right", yRatio: 0..1 }

  // Chuyển sang toạ độ left/top do JS quản; các class right/bottom của Tailwind
  // bị vô hiệu bằng inline style (chỉ đặt MỘT lần, lúc áp vị trí đầu tiên).
  var owned = false;
  function _own() {
    if (owned) return;
    owned = true;
    widget.style.right = "auto";
    widget.style.bottom = "auto";
  }

  // Khung nhìn của thứ position:fixed KHÔNG tính thanh cuộn, nên phải đo bằng
  // documentElement.clientWidth — dùng window.innerWidth thì trên desktop bong
  // bóng bị đẩy lệch thêm đúng bề ngang thanh cuộn so với lề CSS.
  function _vw() {
    return document.documentElement.clientWidth || window.innerWidth;
  }
  function _vh() {
    return document.documentElement.clientHeight || window.innerHeight;
  }

  function _size() {
    var r = widget.getBoundingClientRect();
    return { w: r.width, h: r.height, x: r.left, y: r.top };
  }

  function _clampY(y, h) {
    return Math.min(Math.max(y, EDGE), Math.max(EDGE, _vh() - h - EDGE));
  }

  // Đặt bong bóng về lề theo trạng thái đã lưu (hoặc đang có).
  function _applyPos(animate) {
    if (!pos) return;
    _own();
    var s = _size();
    var x = pos.side === "left" ? EDGE : _vw() - s.w - EDGE;
    var y = _clampY(pos.yRatio * _vh() - s.h / 2, s.h);
    widget.style.transition = animate
      ? "left .28s cubic-bezier(.22,1,.36,1), top .28s cubic-bezier(.22,1,.36,1), opacity .25s ease, transform .25s ease"
      : "";
    widget.style.left = x + "px";
    widget.style.top = y + "px";
    if (animate) {
      setTimeout(function () {
        widget.style.transition = "";
      }, 300);
    }
  }

  _applyPos(false);
  window.addEventListener("resize", function () {
    _applyPos(false);
  });

  var drag = null; // { dx, dy, w, h, moved }

  widget.addEventListener("pointerdown", function (e) {
    if (e.button !== undefined && e.button !== 0) return;
    // Nút X vẫn là nút bấm bình thường, không kéo theo.
    if (e.target.closest && e.target.closest("#supportClose")) return;
    var s = _size();
    _own();
    widget.style.transition = "";
    widget.style.left = s.x + "px";
    widget.style.top = s.y + "px";
    drag = { dx: e.clientX - s.x, dy: e.clientY - s.y, w: s.w, h: s.h, x0: e.clientX, y0: e.clientY, moved: 0 };
    widget.setPointerCapture(e.pointerId);
  });

  widget.addEventListener("pointermove", function (e) {
    if (!drag) return;
    var x = e.clientX - drag.dx;
    var y = e.clientY - drag.dy;
    drag.moved = Math.max(drag.moved, Math.abs(e.clientX - drag.x0) + Math.abs(e.clientY - drag.y0));
    widget.style.left = Math.min(Math.max(x, 0), _vw() - drag.w) + "px";
    widget.style.top = _clampY(y, drag.h) + "px";
  });

  function _end(e) {
    if (!drag) return;
    var moved = drag.moved;
    var s = _size();
    drag = null;
    try {
      widget.releasePointerCapture(e.pointerId);
    } catch (err) {}
    // Nửa màn nào gần hơn thì bám lề bên đó.
    pos = {
      side: s.x + s.w / 2 < _vw() / 2 ? "left" : "right",
      yRatio: (s.y + s.h / 2) / _vh(),
    };
    setCache(POS_KEY, pos);
    _applyPos(true);
    // Kéo thật sự thì nuốt cú click kế tiếp, không mở Messenger ngoài ý muốn.
    if (moved > 6) {
      widget.addEventListener(
        "click",
        function (ev) {
          ev.preventDefault();
          ev.stopPropagation();
        },
        { capture: true, once: true },
      );
    }
  }

  widget.addEventListener("pointerup", _end);
  widget.addEventListener("pointercancel", _end);
})();
