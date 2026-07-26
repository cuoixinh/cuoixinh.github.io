// Ghim widget hỗ trợ vào mép phải — hoạt động ở mọi kích thước màn hình.
// Trên mobile, bắt đầu cuộn sẽ tự thu gọn; trên desktop chỉ thu gọn khi
// người dùng chủ động bấm (nút X hoặc chính pin tab). Pin tab luôn hiển
// thị sau khi đã kích hoạt (không tự ẩn) — chỉ đảo chiều mũi tên theo
// trạng thái đóng/mở. Tap hoặc vuốt từ ghim ra (sang trái) để mở lại widget.
// Kéo ghim lên/xuống để đổi vị trí — widget hỗ trợ khi mở sẽ bám theo vị
// trí này. Vị trí + trạng thái đóng/mở dùng chung 1 key localStorage,
// giữ nguyên sau khi F5.
(function initChatPinOnScroll() {
  var widget = document.getElementById("chatWidget");
  var pinTab = document.getElementById("chatPinTab");
  var pinIcon = document.getElementById("chatPinIcon");
  if (!widget || !pinTab) return;

  var SWIPE_OUT_DISTANCE = 24; // px vuốt sang trái đủ để coi là "kéo ra"
  var DRAG_MODE_THRESHOLD = 6; // px di chuyển tối thiểu để phân biệt kéo dọc/ngang
  var STORAGE_KEY = buildCacheKey("chat_pin_bottom");
  var PIN_DEFAULT_BOTTOM = 80; // vị trí mặc định khi chưa có cache (khớp class ban đầu)
  var WIDGET_DEFAULT_BOTTOM = 18;
  var PIN_WIDGET_OFFSET = PIN_DEFAULT_BOTTOM - WIDGET_DEFAULT_BOTTOM;

  var collapsed = false;
  var pinBottom = PIN_DEFAULT_BOTTOM;
  var dragState = null;
  var gestureHandled = false;

  function isMobile() {
    return window.matchMedia("(max-width: 767px)").matches;
  }

  function setArrow(dir) {
    if (!pinIcon) return;
    pinIcon.classList.toggle("fa-chevron-left", dir === "left");
    pinIcon.classList.toggle("fa-chevron-right", dir === "right");
  }

  function showPinTab() {
    pinTab.classList.remove("hidden");
    pinTab.classList.add("flex");
  }

  function clampBottom(v) {
    var minB = 16;
    var maxB = Math.max(minB, window.innerHeight - 64 - 80); // chừa navbar + chiều cao ghim
    return Math.min(Math.max(v, minB), maxB);
  }

  // Dùng chung 1 key cho cả vị trí (b) lẫn trạng thái đóng/mở (c).
  function loadSavedState() {
    var parsed = getCache(STORAGE_KEY);
    if (!parsed || typeof parsed !== "object") return null;
    return {
      bottom: typeof parsed.b === "number" ? parsed.b : null,
      collapsed: !!parsed.c,
    };
  }

  function saveState() {
    setCache(STORAGE_KEY, { b: pinBottom, c: collapsed });
  }

  // Widget hỗ trợ (thẻ + nút Messenger) luôn bám theo vị trí ghim,
  // giữ nguyên khoảng cách mặc định giữa hai phần tử.
  function applyPinPosition() {
    pinTab.style.bottom =
      "calc(" + pinBottom + "px + env(safe-area-inset-bottom, 0px))";
    var widgetBottom = Math.max(pinBottom - PIN_WIDGET_OFFSET, 8);
    widget.style.bottom =
      "calc(" + widgetBottom + "px + env(safe-area-inset-bottom, 0px))";
  }

  function initPosition() {
    var saved = loadSavedState();
    pinBottom = clampBottom(
      saved && saved.bottom !== null ? saved.bottom : PIN_DEFAULT_BOTTOM,
    );
    applyPinPosition();
    // Khôi phục đúng trạng thái đã ẩn từ lần trước, không đợi cuộn mới ẩn.
    if (saved && saved.collapsed) collapse();
  }

  // Thu gọn/mở lại hoạt động như nhau ở mọi kích thước màn hình.
  function collapse() {
    collapsed = true;
    widget.classList.add("chat-widget-collapsed");
    showPinTab();
    setArrow("left"); // mũi tên trái = đang thu gọn, tap để mở
    saveState();
  }

  function expand() {
    collapsed = false;
    widget.classList.remove("chat-widget-collapsed");
    showPinTab();
    setArrow("right"); // mũi tên phải = đang mở, tap để thu gọn
    saveState();
  }

  // Tự thu gọn khi cuộn: chỉ áp dụng cho mobile. Ở desktop, widget vẫn
  // hiện bình thường khi cuộn — chỉ ẩn khi người dùng chủ động bấm (nút X
  // hoặc chính pin tab).
  window.addEventListener(
    "scroll",
    function () {
      if (isMobile() && !collapsed) collapse();
    },
    { passive: true },
  );

  // Kéo ghim: dùng Pointer Events để gộp chung touch/mouse/pen.
  // Ưu tiên hướng di chuyển đầu tiên (dọc = kéo đổi vị trí, ngang = vuốt mở).
  pinTab.addEventListener("pointerdown", function (e) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    dragState = {
      startY: e.clientY,
      startX: e.clientX,
      startBottom: pinBottom,
      mode: null,
    };
    gestureHandled = false;
    try {
      pinTab.setPointerCapture(e.pointerId);
    } catch (err) {}
  });

  pinTab.addEventListener(
    "pointermove",
    function (e) {
      if (!dragState) return;
      var dy = dragState.startY - e.clientY; // kéo lên = dương
      var dx = e.clientX - dragState.startX;

      if (!dragState.mode) {
        if (
          Math.abs(dy) > DRAG_MODE_THRESHOLD ||
          Math.abs(dx) > DRAG_MODE_THRESHOLD
        ) {
          dragState.mode =
            Math.abs(dy) >= Math.abs(dx) ? "vertical" : "horizontal";
        } else {
          return;
        }
      }

      if (dragState.mode === "vertical") {
        gestureHandled = true;
        pinBottom = clampBottom(dragState.startBottom + dy);
        applyPinPosition();
        e.preventDefault();
      } else if (dragState.mode === "horizontal") {
        if (collapsed && dx < -SWIPE_OUT_DISTANCE) {
          gestureHandled = true;
          expand();
        }
      }
    },
    { passive: false },
  );

  function finishDrag() {
    if (dragState && dragState.mode === "vertical") {
      saveState();
    }
    dragState = null;
  }

  pinTab.addEventListener("pointerup", finishDrag);
  pinTab.addEventListener("pointercancel", finishDrag);

  pinTab.addEventListener("click", function (e) {
    e.preventDefault();
    if (gestureHandled) {
      gestureHandled = false;
      return;
    }
    if (collapsed) expand();
    else collapse();
  });

  window.addEventListener("resize", function () {
    pinBottom = clampBottom(pinBottom);
    applyPinPosition();
  });

  initPosition();

  // Cho nút X (đóng thẻ Messenger) tái dùng logic thu gọn trên mobile,
  // để pin tab vẫn mở lại được sau khi đóng.
  window.__cxChatCollapse = collapse;
})();
