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

  function _esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  // params: ý định mang sang trang thiết lập (vd {tab:"theme"}), gắn vào URL chứ
  // KHÔNG để sessionStorage — cờ ghi sẵn rồi khách huỷ ở hộp thoại là nó nằm lại,
  // lần vào trang thiết lập sau (đường nào cũng được) tự bật bảng AI không rõ lý
  // do. Đi theo URL thì không điều hướng = không có gì được ghi.
  function _go(id, params) {
    var q = new URLSearchParams({ id: id });
    if (params) {
      Object.keys(params).forEach(function (k) {
        if (params[k] != null && params[k] !== "") q.set(k, params[k]);
      });
    }
    window.location.href = "/invitation-setup/?" + q.toString();
  }

  function _create(theme, displayName, params, id) {
    id = id || _uuid();
    setCache(buildCacheKey("draft", id), {
      theme: theme,
      is_published: false,
      _localOnly: true,
      // Mốc dọn nháp bỏ quên (core/helpers/draft-retention.js).
      _savedAt: Date.now(),
    });
    sessionStorage.setItem("draft_theme", theme);
    sessionStorage.setItem("draft_template_name", displayName || _titleOf(theme));
    _go(id, params);
    return id;
  }

  // chosen = khách vừa chỉ đích danh một mẫu ("Dùng ngay" ở thẻ mẫu, "Dùng mẫu
  // này" ở bản xem thử). false = vào từ nút chung như "Tạo thiệp ngay" ở hero,
  // lúc đó mẫu chỉ là mặc định do code chọn hộ → câu hỏi TUYỆT ĐỐI không được
  // nhắc tên mẫu sắp chuyển sang, vì khách có đòi chuyển đâu.
  //
  // Hỏi bằng base dialog dùng chung (showConfirm ở core/helpers/alert.js) chứ
  // không tự dựng popup: nó đã lo tiêu đề canh trái + vạch ngăn + chân thẻ có
  // nền, và tự vẽ bằng biến --cx nên chạy được cả ở trang thiệp (chỉ có
  // themes.css). Trang nào gọi cxStartDraft cũng phải nạp alert.js.
  function _askThenStart(existing, theme, displayName, chosen, params) {
    var oldTheme = existing.data.theme;
    var oldName = _titleOf(oldTheme);
    var newName = displayName || _titleOf(theme);
    var sameTheme = oldTheme === theme;

    // Tên mẫu in đậm → phải bật html:true ở showConfirm, nên tên phải tự escape:
    // nó lấy từ danh sách mẫu / bản nháp, không phải hằng số trong code.
    var oldB = "<b>" + _esc(oldName) + "</b>";
    var newB = "<b>" + _esc(newName) + "</b>";

    var message = !chosen
      ? "Bạn có một thiệp mẫu " + oldB + " đang viết dở."
      : sameTheme
        ? "Mẫu " + oldB + " đang được chỉnh dở."
        : "Bạn đang làm dở mẫu " + oldB + ".";
    // MỘT xuống dòng thôi: #cx-alert-body để `white-space: pre-line`, "\n\n" sẽ ra
    // hẳn một dòng trống giữa hai câu.
    message +=
      "\nTiếp tục thiệp đó, hay bắt đầu " +
      (chosen && !sameTheme ? "với mẫu " + newB : "một thiệp mới") +
      "?";

    showConfirm("Thiệp đang viết dở", message, {
      type: "info",
      icon: "file-pen",
      html: true,
      confirmText: "Tiếp tục",
      cancelText: chosen && !sameTheme ? "Dùng " + newName : "Thiệp mới",
    }).then(function (r) {
      // null = bấm ra ngoài / Esc → đóng suông, không đi đâu cả. Đây là ngã ba chỉ
      // khách quyết được, đừng coi việc đóng là đã chọn "thiệp mới".
      if (r === null) return;
      if (r) {
        // Mẫu cũ: KHÔNG ghi đè draft_theme — bản nháp tự mang theme của nó.
        sessionStorage.setItem("draft_template_name", oldName);
        return _go(existing.id, params);
      }
      _create(theme, displayName, params);
    });
  }

  // theme: tên thư mục mẫu ("romantic-gold"). displayName: tên đẹp để hiện ở
  // header trang thiết lập; thiếu thì suy ra từ theme.
  // opts.chosen: khách có tự chọn mẫu này không (mặc định có). Nút chung kiểu
  // "Tạo thiệp ngay" ở hero phải truyền false — xem _askThenStart.
  // opts.params: query gắn thêm vào URL trang thiết lập, vd { tab: "theme" }.
  // opts.id: đi vào ĐÚNG nháp mang mã này (khung chat AI gắn cuộc trò chuyện với
  //   một nháp cố định). Có mã là không hỏi "thiệp đang viết dở" nữa — khách đã
  //   chỉ đích danh thiệp nào rồi; nháp đã tồn tại thì đi thẳng vào, TUYỆT ĐỐI
  //   không tạo đè lên (đè là mất nội dung của lần vào trước).
  // Trả về mã nháp sẽ mở, hoặc undefined khi còn phải hỏi khách.
  window.cxStartDraft = function (theme, displayName, opts) {
    if (!theme) return;
    var o = opts || {};
    var chosen = o.chosen !== false;

    if (o.id) {
      var kept = getCache(buildCacheKey("draft", o.id));
      if (!kept) return _create(theme, displayName, o.params, o.id);
      // Nháp cũ tự mang theme của nó → không ghi đè draft_theme.
      sessionStorage.setItem(
        "draft_template_name",
        _titleOf(kept.theme || theme),
      );
      _go(o.id, o.params);
      return o.id;
    }

    var existing = _findDraft();
    if (existing)
      return _askThenStart(existing, theme, displayName, chosen, o.params);
    return _create(theme, displayName, o.params);
  };

  // Sinh mã nháp để bên gọi giữ trước (khung chat AI cần nhớ mã qua nhiều lần bấm).
  window.cxNewDraftId = _uuid;

  // Nút CHUNG kiểu "Tạo thiệp ngay" / "Tạo thiệp mới": khách chưa chỉ mẫu nào nên
  // lấy mẫu đang bật đầu tiên rồi đi tiếp bằng cxStartDraft với chosen=false.
  // Trang nào đã có sẵn danh sách mẫu (trang chủ) thì gọi thẳng cxStartDraft,
  // khỏi hỏi lại server.
  // Danh sách mẫu đi qua Edge Function `public-templates` — không gọi thẳng
  // REST của Supabase. Hàng đầu tiên đã là mẫu có sort_order nhỏ nhất.
  window.cxStartDefaultDraft = function (params, opts) {
    return fetch(CONFIG.supabase.edgeUrl + "?resource=public-templates", {
      headers: { Authorization: "Bearer " + CONFIG.supabase.anonKey },
    })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (rows) {
        var t = rows && rows[0];
        if (!t) throw new Error("Chưa có mẫu thiệp nào");
        window.cxStartDraft(t.theme, t.name, {
          chosen: false,
          params: params,
          id: opts && opts.id,
        });
      })
      .catch(function (e) {
        if (window.showToast) showToast(e.message || "Không tạo được thiệp", "error");
        else window.location.href = "/theme-template/";
      });
  };
})();
