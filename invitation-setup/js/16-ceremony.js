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
  // Màu + vị trí núm do .cx-switch đọc từ aria-checked.
  document.getElementById("vis-btn-vu-quy")?.setAttribute("aria-checked", String(newVal));
  if (fields) fields.classList.toggle("hidden", !newVal);
  // Nguồn "trùng địa điểm" của tiệc nhà gái đổi theo lễ vu quy.
  _syncPartySameLabel();
  _syncPartyIfSame();
  _updateTimelineVuQuySection();
}

// Ô tick "Chỉ hiển thị QR của thiệp tương ứng" (bước Hộp mừng cưới) — giá trị
// thật ở hidden #gift_own_side; phát "input" để autosave + xem trực tiếp bắt được.
function toggleGiftOwnSide(event) {
  const hidden = document.getElementById("gift_own_side");
  if (!hidden) return;
  hidden.value = String(!!event?.target?.checked);
  hidden.dispatchEvent(new Event("input", { bubbles: true }));
}

function initGiftOwnSide(data) {
  const on = data?.gift_own_side === true || data?.gift_own_side === "true";
  const hidden = document.getElementById("gift_own_side");
  if (hidden) hidden.value = String(on);
  const check = document.querySelector('x-check[key="gift-own-side"]');
  if (check) check.checked = on;
}

// Khi địa điểm nguồn (ceremony/vu_quy) thay đổi, re-sync tất cả party đang bật "Trùng địa điểm"
function _syncPartyIfSame() {
  ["groom", "bride"].forEach((side) => {
    const check = document.querySelector(`x-check[key="${side}-party-same"]`);
    if (check?.checked) togglePartySameLoc(side, null, true);
  });
}

// Nơi tiệc "trùng" lấy theo: nhà trai → lễ cưới; nhà gái → lễ vu quy nếu bật, không thì lễ cưới.
function _partySameSource(side) {
  const vuQuy = document.getElementById("vu_quy_enabled")?.value === "true";
  return side === "bride" && vuQuy ? "vu_quy" : "ceremony";
}

// Nhãn ô tick của nhà gái phải gọi đúng tên nguồn đang dùng (đổi theo công tắc vu quy).
function _syncPartySameLabel() {
  const label = document.querySelector('x-check[key="bride-party-same"] button > span:last-child');
  if (!label) return;
  label.textContent = _partySameSource("bride") === "vu_quy"
    ? "Trùng địa điểm lễ vu quy"
    : "Trùng địa điểm lễ thành hôn";
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
  // force !== undefined: được gọi từ init/sync, dùng giá trị force
  // force === undefined: được gọi từ user click, lúc này check.checked ĐÃ được x-check đảo ngược rồi
  const newActive = force !== undefined ? force : check.checked;
  check.checked = newActive;

  const locationInput = document.querySelector(
    `input[name="${side}_party_location"]`,
  );
  const mapEmbedInput = document.getElementById(`${side}_party_map_embed_url`);
  const queryInput = document.getElementById(`${side}_party_map_query`);
  // Nút "Bản đồ" là suffix-button của ô vị trí; nút "x" nằm ở cả hai ô — khoá hết khi "trùng".
  const queryXInput = queryInput?.closest("x-input");
  const mapBtn = queryXInput?.querySelector("button:not(.x-clear)");
  const clearBtns = [locationInput, queryInput]
    .map((el) => el?.closest("x-input")?.querySelector(".x-clear"))
    .filter(Boolean);
  const LOCK = ["!bg-gray-100", "!text-gray-400", "cursor-not-allowed"];
  const lock = (on) => {
    [locationInput, queryInput].forEach((el) => {
      if (!el) return;
      el.readOnly = on;
      LOCK.forEach((c) => el.classList.toggle(c, on));
    });
    if (mapBtn) {
      mapBtn.disabled = on;
      mapBtn.classList.toggle("opacity-40", on);
      mapBtn.classList.toggle("cursor-not-allowed", on);
    }
    // Inline style đè class 'hidden' mà x-input tự bật/tắt theo giá trị
    clearBtns.forEach((b) => { b.style.display = on ? "none" : ""; });
  };

  if (newActive) {
    const src = _partySameSource(side);
    const srcLoc = document.querySelector(`input[name="${src}_location"]`);
    const srcMap = document.getElementById(`${src}_map_embed_url`);

    if (locationInput) {
      locationInput.value = srcLoc?.value || "";
      // Phát input để autosave lưu giá trị vừa bind (form nghe "input")
      locationInput.dispatchEvent(new Event("input", { bubbles: true }));
      locationInput.closest("x-input")?.syncClearBtn?.();
    }
    if (mapEmbedInput) mapEmbedInput.value = srcMap?.value || "";
    window.cxRefreshMapField?.(`${side}_party`);
    lock(true);
  } else {
    // Khách tự bỏ tick → xoá nơi đã chép: để nguyên thì nơi tiệc vẫn bằng nơi lễ,
    // lần nạp sau initCeremonySection lại suy ra "trùng" và tick lại.
    if (force === undefined && locationInput) {
      locationInput.value = "";
      locationInput.dispatchEvent(new Event("input", { bubbles: true }));
      if (mapEmbedInput) mapEmbedInput.value = "";
      window.cxRefreshMapField?.(`${side}_party`);
    }
    lock(false);
  }
}

function initCeremonySection(data) {
  // Default: vu quy enabled unless explicitly saved as false
  const vuQuyEnabled =
    data?.vu_quy_enabled !== false && data?.vu_quy_enabled !== "false";
  const hidden = document.getElementById("vu_quy_enabled");
  const fields = document.getElementById("vu-quy-fields");
  if (hidden) hidden.value = vuQuyEnabled ? "true" : "false";
  document.getElementById("vis-btn-vu-quy")?.setAttribute("aria-checked", String(vuQuyEnabled));
  if (fields) fields.classList.toggle("hidden", !vuQuyEnabled);
  _syncPartySameLabel();
  _updateTimelineVuQuySection();

  // Ô "Trùng địa điểm" không có cột DB: suy lại từ dữ liệu — tiệc chưa có nơi riêng
  // hoặc nơi tiệc bằng đúng nơi nguồn thì coi là đang trùng.
  ["groom", "bride"].forEach((side) => {
    const val = (n) => document.querySelector(`input[name="${n}"]`)?.value?.trim() || "";
    const own = val(`${side}_party_location`);
    const src = val(`${_partySameSource(side)}_location`);
    togglePartySameLoc(side, null, !own || own === src);
  });
  _syncPartyOnly();
}

// ============= TIỆC BÁO HỶ (enable_ceremony = false) =============
// Không có lễ → thiệp lấy tiệc thay lễ (cxPartyOnly ở core/helpers/wedding-helper.js),
// nên tiệc phải luôn bật: tắt lễ thì bật tiệc, tắt tiệc lúc đang báo hỷ thì bật lại lễ.

function _isPartyOnly() {
  return document.getElementById("enable_ceremony")?.value === "false";
}

function _onPartyOnlyToggle(section) {
  const partyOn = document.getElementById("enable_party")?.value === "true";
  if (_isPartyOnly() && !partyOn) {
    if (section === "ceremony") {
      toggleSectionVis("party");
    } else {
      toggleSectionVis("ceremony");
      showToast("Thiệp cần có lễ hoặc tiệc — đã bật lại lễ cưới", "warning");
      return;
    }
  }
  if (section === "ceremony" && _isPartyOnly()) {
    showToast("Tiệc báo hỷ: điền ngày, giờ, nơi đãi tiệc ở bước Tiệc cưới");
  }
  _syncPartyOnly();
}

// Tiệc không còn "trùng địa điểm lễ", lịch trình bỏ nhóm lễ.
function _syncPartyOnly() {
  const off = _isPartyOnly();
  ["groom", "bride"].forEach((side) => {
    const check = document.querySelector(`x-check[key="${side}-party-same"]`);
    if (!check) return;
    if (off && check.checked) togglePartySameLoc(side, null, false);
    check.parentElement?.classList.toggle("hidden", off);
  });
  document.getElementById("timeline-ceremony-sub")?.classList.toggle("hidden", off);
  _updateTimelineVuQuySection();
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
window.toggleGiftOwnSide = toggleGiftOwnSide;
window.togglePartySameLoc = togglePartySameLoc;

window.switchTab = switchTab;
window.saveDraft = saveDraft;
window.publishWedding = publishWedding;
// YouTube functions removed - now auto-preview on input

