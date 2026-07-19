// Bật/tắt hiển thị từng mục, accordion và step indicator của form nội dung.
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

// ============= ACCORDION SECTIONS =============

function toggleSection(id) {
  const body = document.getElementById(`section-${id}-body`);
  const chevron = document.getElementById(`section-${id}-chevron`);
  if (!body) return;
  const isOpen = !body.classList.contains("hidden");
  const header = body.previousElementSibling;
  if (isOpen) {
    body.classList.add("hidden");
    if (chevron) chevron.classList.remove("rotate-180");
    if (header) {
      header.classList.remove("bg-gray-50");
      header.classList.add("bg-white");
    }
  } else {
    // Love story: thêm 2 mốc mặc định nếu chưa từng có data
    if (id === "love_story" && !_loveStoryKeyExists) {
      _loveStoryItems = [
        { date: "", title: "Lần đầu gặp gỡ", content: "", image_url: null },
        { date: "", title: "Chuyến đi Quy Nhơn", content: "", image_url: null },
      ];
      _loveStoryKeyExists = true;
      _syncLoveStoryHidden();
      renderLoveStoryList();
    }
    body.classList.remove("hidden");
    if (chevron) chevron.classList.add("rotate-180");
    if (header) {
      header.classList.remove("bg-white");
      header.classList.add("bg-gray-50");
    }
  }
}

function _openSectionAndScroll(id) {
  const body = document.getElementById(`section-${id}-body`);
  if (!body) return;
  if (body.classList.contains("hidden")) toggleSection(id);
  const header = body.previousElementSibling;
  (header || body).scrollIntoView({ behavior: "smooth", block: "start" });
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

// ============= STEP INDICATOR =============

function setStep(n) {
  if (n >= 3) {
    const dot = document.getElementById("step-3-dot");
    if (dot) {
      dot.className =
        "w-6 h-6 rounded-full bg-rose-500 flex items-center justify-center";
      dot.innerHTML = '<span class="text-white text-[11px] font-bold">3</span>';
    }
    const label = document.getElementById("step-3-label");
    if (label) label.className = "text-[10px] text-rose-600 font-semibold";
    const line = document.getElementById("step-line-3");
    if (line) line.className = "flex-1 h-0.5 bg-rose-300 mx-2";
  }
  if (n >= 4) {
    const dot = document.getElementById("step-4-dot");
    if (dot) {
      dot.className =
        "w-6 h-6 rounded-full bg-rose-500 flex items-center justify-center";
      dot.innerHTML = '<span class="text-white text-[11px] font-bold">4</span>';
    }
    const label = document.getElementById("step-4-label");
    if (label) label.className = "text-[10px] text-rose-600 font-semibold";
    const line = document.getElementById("step-line-4");
    if (line) line.className = "flex-1 h-0.5 bg-rose-300 mx-2";
  }
}

