// Bật/tắt hiển thị từng mục và chuyển tab Nhà trai/Nhà gái của form nội dung.
// Việc đi lại giữa các group nằm ở js/20-steps.js.
//
// Tách từ index.js (dòng 318–500 bản gốc). Thứ tự nạp khai báo ở loader.js.

// ============= SECTION VISIBILITY TOGGLES =============

const SECTION_VIS_FIELDS = {
  family: "enable_family",
  party: "enable_party",
  photos: "enable_photos",
  timeline: "enable_timeline",
  love_story: "enable_love_story",
  music: "enable_music",
  rsvp: "rsvp_enabled",
  gift: "enable_gift",
  footer: "enable_footer",
};

function _updateVisUI(section, enabled) {
  const btn = document.getElementById(`vis-btn-${section}`);
  const knob = document.getElementById(`vis-knob-${section}`);
  if (!btn || !knob) return;
  if (enabled) {
    btn.classList.remove("bg-gray-300");
    btn.classList.add("bg-rose-400");
    knob.classList.remove("translate-x-1");
    knob.classList.add("translate-x-6");
  } else {
    btn.classList.remove("bg-rose-400");
    btn.classList.add("bg-gray-300");
    knob.classList.remove("translate-x-6");
    knob.classList.add("translate-x-1");
  }
}

function toggleSectionVis(section, event) {
  if (event) event.stopPropagation();
  const field = SECTION_VIS_FIELDS[section];
  if (!field) return;
  const hidden = document.getElementById(field);
  if (!hidden) return;
  const newVal = hidden.value !== "true";
  hidden.value = newVal ? "true" : "false";
  // Phát "input" để autosave lưu trạng thái switch (gán .value không tự phát sự kiện)
  hidden.dispatchEvent(new Event("input", { bubbles: true }));
  _updateVisUI(section, newVal);
  // Chip của bước đổi giữa "đang tắt" và ✓/⚠, panel đổi trạng thái mờ.
  window.cxRenderSteps?.();
  if (
    section === "party" &&
    typeof _updateTimelinePartySection === "function"
  ) {
    _updateTimelinePartySection();
  }
}

function _initVisToggles(data) {
  Object.entries(SECTION_VIS_FIELDS).forEach(([section, field]) => {
    const val = data?.[field];
    // Dùng default từ hidden input nếu data không có field
    const hidden = document.getElementById(field);
    const enabled =
      val !== undefined && val !== null
        ? val === true || val === "true"
        : hidden
          ? hidden.value === "true"
          : true;
    if (hidden) hidden.value = enabled ? "true" : "false";
    _updateVisUI(section, enabled);
  });
}

function toggleInfoTooltip(id) {
  const el = document.getElementById(id);
  if (el) el.classList.toggle("hidden");
}
window.toggleInfoTooltip = toggleInfoTooltip;

// ============= MỞ MỘT GROUP =============
// Group giờ là BƯỚC (js/20-steps.js), không còn accordion gập/mở. Hai hàm dưới
// giữ nguyên tên vì nhiều nơi gọi tới (validate.js, 15-init.js, tour) — chúng chỉ
// còn là "nhảy tới bước đó".

function toggleSection(id) {
  // Chuyện tình yêu: lần đầu mở thì mồi sẵn 2 mốc cho người dùng sửa, đỡ phải
  // đối diện danh sách rỗng.
  if (id === "love_story" && typeof _loveStoryKeyExists !== "undefined" && !_loveStoryKeyExists) {
    _loveStoryItems = [
      { date: "", title: "Lần đầu gặp gỡ", content: "", image_url: null },
      { date: "", title: "Chuyến đi Quy Nhơn", content: "", image_url: null },
    ];
    _loveStoryKeyExists = true;
    _syncLoveStoryHidden();
    renderLoveStoryList();
  }
  window.cxGoStep?.(id);
}

function _openSectionAndScroll(id) {
  toggleSection(id);
}
window._openSectionAndScroll = _openSectionAndScroll;

function _switchTab(prefix, side) {
  ["groom", "bride"].forEach((s) => {
    const tab = document.getElementById(`${prefix}-tab-${s}`);
    const panel = document.getElementById(`${prefix}-panel-${s}`);
    if (!tab || !panel) return;
    if (s === side) {
      tab.classList.add(
        "bg-rose-50",
        "text-rose-600",
        "border-b-2",
        "border-rose-400",
      );
      tab.classList.remove(
        "text-gray-500",
        "hover:bg-gray-50",
        "hover:text-gray-700",
      );
      panel.classList.remove("hidden");
    } else {
      tab.classList.remove(
        "bg-rose-50",
        "text-rose-600",
        "border-b-2",
        "border-rose-400",
      );
      tab.classList.add(
        "text-gray-500",
        "hover:bg-gray-50",
        "hover:text-gray-700",
      );
      panel.classList.add("hidden");
    }
  });
}
window.switchPartyTab = (side) => _switchTab("party", side);
window.switchFamilyTab = (side) => _switchTab("family", side);
window.switchTimelineTab = (side) => _switchTab("timeline", side);


