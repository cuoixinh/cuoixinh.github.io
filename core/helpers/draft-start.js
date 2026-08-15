// Bắt đầu thiệp từ một mẫu: còn nháp dở thì HỎI (tiếp tục cái cũ / làm với mẫu
// mới), không có nháp nào thì tạo rồi vào thẳng trang thiết lập.
//
// Dùng chung cho trang chủ (js/modal.js) và navbar của bản xem thử
// (core/utils.js) — hai nơi này nạp hai bộ CSS khác hẳn nhau: trang thiệp chỉ có
// styles/themes.css, không có styles/build.css nên KHÔNG dùng được utility
// Tailwind lẫn .ai-tray. Vì vậy popup ở đây viết bằng inline style, chỉ mượn
// <x-button variant="bare"> lấy hình pill (x-button có mặt ở cả hai trang).
(function () {
  function _uuid() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
    });
  }

  // "romantic-gold" → "Romantic Gold". Nháp chỉ lưu tên theme, không lưu tên
  // hiển thị của mẫu, nên tên trong câu hỏi phải suy ra từ đây.
  function _titleOf(theme) {
    return String(theme || "")
      .split("-")
      .map(function (w) {
        return w.charAt(0).toUpperCase() + w.slice(1);
      })
      .join(" ");
  }

  // Nháp dở BẤT KỲ, không phân biệt mẫu — đổi mẫu khác mà lẳng lặng tạo nháp mới
  // là khách mất bản đang làm mà không hề biết.
  function _findDraft() {
    var prefix = buildCacheKey("draft") + "_";
    var keys = listCacheKeys(function (k) {
      return k.indexOf(prefix) === 0;
    });
    for (var i = 0; i < keys.length; i++) {
      var data = getCache(keys[i]);
      if (data) return { id: keys[i].slice(prefix.length), data: data };
    }
    return null;
  }

  function _go(id) {
    window.location.href = "/invitation-setup/?id=" + id;
  }

  function _create(theme, displayName) {
    var id = _uuid();
    setCache(buildCacheKey("draft", id), {
      theme: theme,
      is_published: false,
      _localOnly: true,
    });
    sessionStorage.setItem("draft_theme", theme);
    sessionStorage.setItem("draft_template_name", displayName || _titleOf(theme));
    sessionStorage.setItem("show_tour", "1");
    _go(id);
  }

  // chosen = khách vừa chỉ đích danh một mẫu ("Dùng ngay" ở thẻ mẫu, "Dùng mẫu
  // này" ở bản xem thử). false = vào từ nút chung như "Tạo thiệp ngay" ở hero,
  // lúc đó mẫu chỉ là mặc định do code chọn hộ → câu hỏi TUYỆT ĐỐI không được
  // nhắc tên mẫu sắp chuyển sang, vì khách có đòi chuyển đâu.
  function _askThenStart(existing, theme, displayName, chosen) {
    var oldTheme = existing.data.theme;
    var oldName = _titleOf(oldTheme);
    var newName = displayName || _titleOf(theme);
    var sameTheme = oldTheme === theme;

    var overlay = document.createElement("div");
    overlay.id = "cx-draft-conflict";
    overlay.style.cssText =
      "position:fixed;inset:0;z-index:99999;display:flex;align-items:center;" +
      "justify-content:center;padding:16px;background:rgba(0,0,0,.45)";

    overlay.innerHTML =
      '<div style="width:100%;max-width:380px;background:#fff;border-radius:16px;' +
      'padding:24px;box-shadow:0 20px 50px rgba(0,0,0,.25);font-family:inherit;' +
      'box-sizing:border-box">' +
      '<h3 style="margin:0 0 6px;font-size:16px;font-weight:600;color:#1f2937;' +
      'text-align:center">Bạn đang có thiệp chưa hoàn thành</h3>' +
      '<p style="margin:0 0 18px;font-size:13px;line-height:1.5;color:#6b7280;' +
      'text-align:center">' +
      (!chosen
        ? "Bạn có một thiệp mẫu <b style=\"color:#374151\">" +
          oldName +
          "</b> đang viết dở. Tiếp tục thiệp đó hay bắt đầu thiệp mới?"
        : sameTheme
          ? "Mẫu <b style=\"color:#374151\">" +
            oldName +
            "</b> đang làm dở. Bạn muốn tiếp tục hay làm lại từ đầu?"
          : "Bạn đang làm dở mẫu <b style=\"color:#374151\">" +
            oldName +
            "</b>. Tiếp tục mẫu đó hay chuyển sang <b style=\"color:#374151\">" +
            newName +
            "</b>?") +
      "</p>" +
      '<div style="display:flex;justify-content:flex-end;gap:8px">' +
      '<x-button variant="bare" id="cx-dc-new" style="height:36px;padding:0 16px;' +
      "font-size:11px;font-weight:500;border:1px solid #e5e7eb;background:#fff;" +
      'color:#374151">' +
      (!chosen ? "Thiệp mới" : sameTheme ? "Làm lại" : "Dùng " + newName) +
      "</x-button>" +
      '<x-button variant="bare" id="cx-dc-continue" style="height:36px;' +
      "padding:0 16px;font-size:11px;font-weight:500;border:none;color:#fff;" +
      'background:rgb(var(--action-primary-rgb,225 29 72))">' +
      (chosen ? "Tiếp tục mẫu cũ" : "Tiếp tục") +
      "</x-button>" +
      "</div></div>";

    document.body.appendChild(overlay);

    // Bấm ra ngoài = đóng, không chọn gì. Đây là ngã ba chỉ khách quyết được,
    // đừng tự chọn hộ bằng cách coi việc đóng là "tạo mới".
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) overlay.remove();
    });

    // <x-button> tự thay mình bằng <button> thật lúc nạp → bắt sự kiện ở overlay
    // thay vì gắn thẳng vào thẻ, khỏi phụ thuộc thời điểm thay thế.
    overlay.addEventListener("click", function (e) {
      var t = e.target.closest && e.target.closest("#cx-dc-continue, #cx-dc-new");
      if (!t) return;
      overlay.remove();
      if (t.id === "cx-dc-continue") {
        // Mẫu cũ: KHÔNG ghi đè draft_theme — bản nháp tự mang theme của nó.
        sessionStorage.setItem("draft_template_name", oldName);
        _go(existing.id);
      } else {
        _create(theme, displayName);
      }
    });
  }

  // theme: tên thư mục mẫu ("romantic-gold"). displayName: tên đẹp để hiện ở
  // header trang thiết lập; thiếu thì suy ra từ theme.
  // opts.chosen: khách có tự chọn mẫu này không (mặc định có). Nút chung kiểu
  // "Tạo thiệp ngay" ở hero phải truyền false — xem _askThenStart.
  window.cxStartDraft = function (theme, displayName, opts) {
    if (!theme) return;
    var chosen = !opts || opts.chosen !== false;
    var existing = _findDraft();
    if (existing) return _askThenStart(existing, theme, displayName, chosen);
    _create(theme, displayName);
  };
})();
