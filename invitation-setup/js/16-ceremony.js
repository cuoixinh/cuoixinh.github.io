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
      btn.classList.remove("bg-rose-400", "bg-rose-500");
      btn.classList.add("bg-gray-300");
      knob.classList.remove("translate-x-6");
      knob.classList.add("translate-x-1");
    }
  }
  if (fields) fields.classList.toggle("hidden", !newVal);
  // Nguồn của tiệc nhà gái đổi theo vu quy → vẽ lại nhãn, đang trùng thì chép lại.
  const brideSame = document.querySelector('x-check[key="bride-party-same"]');
  if (brideSame) togglePartySameLoc("bride", null, brideSame.checked);
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

// Nơi tiệc `side` lấy theo khi "Trùng địa điểm": nhà trai theo lễ thành hôn; nhà gái
// theo vu quy khi đang bật, không thì lễ thành hôn.
function _partySource(side) {
  const vuQuy =
    side === "bride" &&
    document.getElementById("vu_quy_enabled")?.value === "true";
  const src = vuQuy ? "vu_quy" : "ceremony";
  return {
    label: vuQuy ? "lễ vu quy" : "lễ thành hôn",
    loc: document.querySelector(`input[name="${src}_location"]`),
    map: document.getElementById(`${src}_map_embed_url`),
    addr: document.getElementById(`${src}-map-address`),
  };
}

// event: người dùng bấm ô trên form — bỏ tích lúc đó là "tiệc ở nơi khác" nên xoá địa
// điểm + bản đồ vừa chép để nhập nơi mới. Gọi bằng code (nạp form, khung chat) thì
// chỉ khoá/mở khoá, không đụng giá trị.
function togglePartySameLoc(side, event, force) {
  if (event) event.stopPropagation();
  // <x-check> sở hữu trạng thái + hiển thị (box/icon/viền); ở đây chỉ đọc/ghi .checked
  const check = document.querySelector(`x-check[key="${side}-party-same"]`);
  if (!check) return;
  const newActive = force !== undefined ? force : check.checked;
  check.checked = newActive;
  const source = _partySource(side);
  const labelEl = check.querySelector("button > span:last-child");
  if (labelEl) labelEl.textContent = "Trùng địa điểm " + source.label;

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
    const { loc: srcLoc, map: srcMap, addr: srcAddr } = source;

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
    window._syncMapFrame?.(`${side}_party`);
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
    if (event) {
      window.clearMapAddress?.(`${side}_party`);
      if (locationInput) {
        locationInput.value = "";
        locationInput.dispatchEvent(new Event("input", { bubbles: true }));
        locationInput.focus({ preventScroll: true });
      }
    }
  }
}

// Tiệc đang "trùng" với lễ: ô địa điểm trống (nháp mới), hoặc địa điểm + bản đồ đúng
// bằng của nơi nguồn. Ô tích không có cột riêng trong DB nên nạp lại là suy từ đây.
function _partyIsSame(side) {
  const loc = document.querySelector(`input[name="${side}_party_location"]`);
  const map = document.getElementById(`${side}_party_map_embed_url`);
  const v = (loc?.value || "").trim();
  if (!v) return true;
  const src = _partySource(side);
  return (
    v === (src.loc?.value || "").trim() &&
    (map?.value || "") === (src.map?.value || "")
  );
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
    btn.classList.toggle("bg-rose-500", false);
    btn.classList.toggle("bg-gray-300", !vuQuyEnabled);
  }
  if (knob) {
    knob.classList.toggle("translate-x-6", vuQuyEnabled);
    knob.classList.toggle("translate-x-1", !vuQuyEnabled);
  }
  if (fields) fields.classList.toggle("hidden", !vuQuyEnabled);

  ["groom", "bride"].forEach((side) =>
    togglePartySameLoc(side, null, _partyIsSame(side)),
  );
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

