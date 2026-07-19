// Mục Lễ cưới / Tiệc cưới.
//
// Tách từ index.js (dòng 4635–4815 bản gốc). Thứ tự nạp khai báo ở loader.js.

// ============= CEREMONY SECTION =============

function toggleVuQuy(event) {
  if (event) event.stopPropagation();
  const hidden = document.getElementById("vu_quy_enabled");
  const fields = document.getElementById("vu-quy-fields");
  if (!hidden) return;
  const newVal = hidden.value !== "true";
  hidden.value = newVal ? "true" : "false";
  // Phát "input" để autosave lưu trạng thái (gán .value không tự phát sự kiện)
  hidden.dispatchEvent(new Event("input", { bubbles: true }));
  const btn = document.getElementById("vis-btn-vu-quy");
  const knob = document.getElementById("vis-knob-vu-quy");
  if (btn && knob) {
    if (newVal) {
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
  if (fields) fields.classList.toggle("hidden", !newVal);
}

// Khi địa điểm nguồn (ceremony/vu_quy) thay đổi, re-sync tất cả party đang bật "Trùng địa điểm"
function _syncPartyIfSame() {
  ["groom", "bride"].forEach((side) => {
    const btn = document.getElementById(`${side}-party-same-btn`);
    if (btn?.dataset.active === "true") togglePartySameLoc(side, null, true);
  });
}

// Callback được maps-helper.js gọi sau applyMapPicker / clearMapAddress
window._onLocationSourceChanged = (src) => {
  if (src === "ceremony" || src === "vu_quy") _syncPartyIfSame();
};

function togglePartySameLoc(side, event, force) {
  if (event) event.stopPropagation();
  // <x-check> sở hữu trạng thái + hiển thị (box/icon/viền); ở đây chỉ đọc/ghi .checked
  const check = document.querySelector(`x-check[key="${side}-party-same"]`);
  if (!check) return;
  const newActive = force !== undefined ? force : check.checked;
  check.checked = newActive;

  const locationInput = document.querySelector(
    `input[name="${side}_party_location"]`,
  );
  const mapEmbedInput = document.getElementById(`${side}_party_map_embed_url`);
  const mapDisplay = document.getElementById(`${side}_party-map-display`);
  const mapAddress = document.getElementById(`${side}_party-map-address`);
  // Nút "Bản đồ" là suffix-button bên trong <x-input> (không có id riêng) → lấy qua x-input
  const partyXInput = document.querySelector(
    `x-input[name="${side}_party_location"]`,
  );
  const mapBtn =
    (partyXInput && partyXInput.querySelector("button:not(.x-clear)")) ||
    document.getElementById(`${side}-party-map-btn`);
  // Nút X xoá của x-input và nút X trên tag bản đồ — phải khoá luôn khi "trùng địa điểm"
  const xClearBtn = partyXInput && partyXInput.querySelector(".x-clear");
  const tagClearBtn = mapDisplay && mapDisplay.querySelector("button");

  if (newActive) {
    // Resolve source: groom → ceremony; bride → vu_quy if enabled, else ceremony
    let srcLocName = "ceremony_location";
    let srcMapId = "ceremony_map_embed_url";
    let srcAddrId = "ceremony-map-address";
    if (side === "bride") {
      const vuQuyEnabled =
        document.getElementById("vu_quy_enabled")?.value === "true";
      if (vuQuyEnabled) {
        srcLocName = "vu_quy_location";
        srcMapId = "vu_quy_map_embed_url";
        srcAddrId = "vu_quy-map-address";
      }
    }
    const srcLoc = document.querySelector(`input[name="${srcLocName}"]`);
    const srcMap = document.getElementById(srcMapId);
    const srcAddr = document.getElementById(srcAddrId);

    if (locationInput) {
      locationInput.value = srcLoc?.value || "";
      locationInput.readOnly = true;
      // Dùng ! (important) để đè bg-white/text mặc định của x-input → nhìn rõ trạng thái khoá
      locationInput.classList.add(
        "!bg-gray-100",
        "!text-gray-400",
        "cursor-not-allowed",
      );
      // Phát input để autosave lưu giá trị vừa bind (form nghe "input")
      locationInput.dispatchEvent(new Event("input", { bubbles: true }));
    }
    if (mapEmbedInput && srcMap) mapEmbedInput.value = srcMap.value || "";
    if (mapDisplay && mapAddress && srcAddr?.textContent?.trim()) {
      mapAddress.textContent = srcAddr.textContent;
      mapDisplay.classList.remove("hidden");
      mapDisplay.classList.add("flex");
    }
    if (mapBtn) {
      mapBtn.disabled = true;
      mapBtn.classList.add("opacity-40", "cursor-not-allowed");
    }
    // Ẩn nút xoá (inline style đè class 'hidden' mà x-input tự bật/tắt theo giá trị)
    if (xClearBtn) xClearBtn.style.display = "none";
    if (tagClearBtn) tagClearBtn.style.display = "none";
  } else {
    if (locationInput) {
      locationInput.readOnly = false;
      locationInput.classList.remove(
        "!bg-gray-100",
        "!text-gray-400",
        "cursor-not-allowed",
      );
    }
    if (mapBtn) {
      mapBtn.disabled = false;
      mapBtn.classList.remove("opacity-40", "cursor-not-allowed");
    }
    // Trả lại nút xoá (bỏ inline style để x-input tự quản lý hiển thị theo giá trị)
    if (xClearBtn) xClearBtn.style.display = "";
    if (tagClearBtn) tagClearBtn.style.display = "";
  }
}

function initCeremonySection(data) {
  // Default: vu quy enabled unless explicitly saved as false
  const vuQuyEnabled =
    data?.vu_quy_enabled !== false && data?.vu_quy_enabled !== "false";
  const hidden = document.getElementById("vu_quy_enabled");
  const btn = document.getElementById("vis-btn-vu-quy");
  const knob = document.getElementById("vis-knob-vu-quy");
  const fields = document.getElementById("vu-quy-fields");
  if (hidden) hidden.value = vuQuyEnabled ? "true" : "false";
  if (btn) {
    btn.classList.toggle("bg-rose-400", vuQuyEnabled);
    btn.classList.toggle("bg-gray-300", !vuQuyEnabled);
  }
  if (knob) {
    knob.classList.toggle("translate-x-6", vuQuyEnabled);
    knob.classList.toggle("translate-x-1", !vuQuyEnabled);
  }
  if (fields) fields.classList.toggle("hidden", !vuQuyEnabled);

  // Default "same as ceremony" checked if party_location is empty (new draft)
  ["groom", "bride"].forEach((side) => {
    const partyLoc = document.querySelector(
      `input[name="${side}_party_location"]`,
    );
    const hasOwnLocation = partyLoc?.value?.trim();
    togglePartySameLoc(side, null, !hasOwnLocation);
  });
}

window.applySlug = applySlug;
window.copyInviteLink = copyInviteLink;
window.switchGuestsTab = switchGuestsTab;
window.generateQuickLink = generateQuickLink;
window.shareViaMessenger = shareViaMessenger;
window.copyMessengerLink = copyMessengerLink;
window.addTimelineItem = addTimelineItem;
window.removeTimelineItem = removeTimelineItem;
window.addLoveStoryItem = addLoveStoryItem;
window.removeLoveStoryItem = removeLoveStoryItem;
window.handleLoveStoryImage = handleLoveStoryImage;
window.removeLoveStoryImage = removeLoveStoryImage;
window.adjustLoveStoryFocalPoint = adjustLoveStoryFocalPoint;
// window.openThemePicker: đặt trong 18-theme-picker.js, cạnh nơi khai báo hàm —
// file này nạp trước nên tham chiếu ở đây sẽ là ReferenceError.
window.toggleSectionVis = toggleSectionVis;
window.toggleVuQuy = toggleVuQuy;
window.togglePartySameLoc = togglePartySameLoc;

window.switchTab = switchTab;
window.saveDraft = saveDraft;
window.publishWedding = publishWedding;
// YouTube functions removed - now auto-preview on input

