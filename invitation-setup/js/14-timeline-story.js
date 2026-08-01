// Lịch trình ngày cưới và Câu chuyện tình yêu (thêm/xoá/sắp xếp mốc).
//
// Tách từ index.js (dòng 3889–4239 bản gốc). Thứ tự nạp khai báo ở loader.js.

// ============= TIMELINE =============
// Mỗi item: { time, title, type }  type = "ceremony" | "party"
// Backward compat: item không có type → coi là "ceremony"

let _timelineItems = [];

function _syncTimelineHidden() {
  const hidden = document.getElementById("timeline-value");
  if (hidden) hidden.value = JSON.stringify(_timelineItems);
}

function _ensureTimelineDefault(type) {
  const has = _timelineItems.some((i) => (i.type || "ceremony") === type);
  if (!has) {
    _timelineItems.push({ time: "", title: "", type });
    _syncTimelineHidden();
    renderTimelineList();
  }
}

function _renderTimelineRows(listEl, type, colorClass) {
  listEl.innerHTML = "";
  _timelineItems.forEach((item, idx) => {
    if ((item.type || "ceremony") !== type) return;
    const div = document.createElement("div");
    div.className = `flex items-center gap-2 ${colorClass} rounded-2xl p-3 border`;
    div.innerHTML = `
      <input
        type="text"
        value="${escapeHtml(item.time || "")}"
        placeholder="Chọn giờ"
        readonly
        class="w-24 flex-shrink-0 h-10 px-2 border border-gray-200 rounded-xl text-sm text-gray-800 bg-white outline-none cursor-pointer text-center hover:border-rose-300 focus:border-rose-400 focus:ring-2 focus:ring-rose-400/20"
        onclick="openTimePicker(this, this.value, v => { _timelineItems[${idx}].time=v; this.value=v; _syncTimelineHidden(); })"
      />
      <input
        type="text"
        value="${escapeHtml(item.title || "")}"
        placeholder="Mô tả sự kiện"
        class="flex-1 min-w-0 h-10 px-3 border border-gray-200 rounded-xl text-sm text-gray-800 bg-white outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-400/20"
        oninput="_timelineItems[${idx}].title=this.value;_syncTimelineHidden();"
      />
      <button type="button" onclick="optimizeTimelineTitle(${idx}, this)"
        class="btn-ai-icon" title="Tối ưu bằng AI">
        <i data-lucide="pencil-sparkles" class="w-4 h-4"></i>
      </button>
      <button type="button" onclick="removeTimelineItem(${idx})"
        class="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-red-100 hover:bg-red-200 text-red-500 rounded-lg transition-colors" title="Xóa">
        <i data-lucide="trash-2" class="w-4 h-4"></i>
      </button>
    `;
    listEl.appendChild(div);
  });
}

function renderTimelineList() {
  const cList = document.getElementById("timeline-list");
  if (cList)
    _renderTimelineRows(cList, "ceremony", "bg-cyan-50 border-cyan-100");
  const pList = document.getElementById("timeline-party-list");
  if (pList)
    _renderTimelineRows(pList, "party", "bg-amber-50 border-amber-100");
  const bpList = document.getElementById("timeline-bride-party-list");
  if (bpList)
    _renderTimelineRows(bpList, "bride-party", "bg-amber-50 border-amber-100");
  if (typeof lucide !== "undefined") lucide.createIcons();
}

// escapeHtml() dùng chung từ core/utils.js (loader nạp trước các file js/).
// Bản cũ khai báo ở đây ghi đè bản chung bằng phiên bản thiếu escape dấu nháy đơn.

function addTimelineItem(type = "ceremony") {
  const max = CONFIG.maxLoveStoryItems || 10;
  if (
    _timelineItems.filter((i) => (i.type || "ceremony") === type).length >= max
  ) {
    showToast(`Tối đa ${max} mốc`, "warning");
    return;
  }
  _timelineItems.push({ time: "", title: "", type });
  _syncTimelineHidden();
  renderTimelineList();
  const listId =
    type === "bride-party"
      ? "timeline-bride-party-list"
      : type === "party"
        ? "timeline-party-list"
        : "timeline-list";
  const list = document.getElementById(listId);
  if (list) {
    const inputs = list.querySelectorAll("input[type=text]");
    if (inputs.length >= 2) inputs[inputs.length - 2]?.focus();
  }
}

function removeTimelineItem(idx) {
  _timelineItems.splice(idx, 1);
  _syncTimelineHidden();
  renderTimelineList();
}

function _updateTimelinePartySection() {
  const enabled = document.getElementById("enable_party")?.value === "true";
  ["timeline-party-sub", "timeline-bride-party-sub"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.style.display = enabled ? "" : "none";
  });
  if (enabled) {
    _updateTimelinePartyDateBadge();
    _updateTimelineBridePartyDateBadge();
  }
}

function _updateTimelinePartyDateBadge() {
  const badge = document.getElementById("timeline-party-date-badge");
  const text = document.getElementById("timeline-party-date-text");
  const btn = document.getElementById("btn-add-party");
  const noDate = document.getElementById("timeline-party-no-date");
  if (!badge || !text) return;
  const val =
    document.querySelector('input[name="groom_party_date"]')?.value || "";
  if (!val) {
    badge.classList.add("hidden");
    if (btn) btn.style.display = "none";
    if (noDate) noDate.classList.remove("hidden");
    return;
  }
  const d = new Date(val + "T00:00:00");
  text.textContent = `${WEEKDAYS_VI[d.getDay()]}, ${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  badge.classList.remove("hidden");
  if (btn) btn.style.display = "";
  if (noDate) noDate.classList.add("hidden");
  _ensureTimelineDefault("party");
  if (typeof lucide !== "undefined") lucide.createIcons();
}

function _updateTimelineBridePartyDateBadge() {
  const badge = document.getElementById("timeline-bride-party-date-badge");
  const text = document.getElementById("timeline-bride-party-date-text");
  const btn = document.getElementById("btn-add-bride-party");
  const noDate = document.getElementById("timeline-bride-party-no-date");
  if (!badge || !text) return;
  const val =
    document.querySelector('input[name="bride_party_date"]')?.value || "";
  if (!val) {
    badge.classList.add("hidden");
    if (btn) btn.style.display = "none";
    if (noDate) noDate.classList.remove("hidden");
    return;
  }
  const d = new Date(val + "T00:00:00");
  text.textContent = `${WEEKDAYS_VI[d.getDay()]}, ${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  badge.classList.remove("hidden");
  if (btn) btn.style.display = "";
  if (noDate) noDate.classList.add("hidden");
  _ensureTimelineDefault("bride-party");
  if (typeof lucide !== "undefined") lucide.createIcons();
}

// ============= LOVE STORY =============

const MAX_LOVE_STORY_ITEMS = CONFIG.maxLoveStoryItems || 10;

let _loveStoryItems = [];
let _loveStoryKeyExists = false; // true = đã có data (kể cả []), false = chưa từng set
const _loveStoryPendingImages = {}; // { idx: File }

function _syncLoveStoryHidden() {
  const hidden = document.getElementById("love-story-value");
  if (hidden) hidden.value = JSON.stringify(_loveStoryItems);
}

function _loveStoryImagePreview(idx) {
  const item = _loveStoryItems[idx];
  const pending = _loveStoryPendingImages[idx];
  if (pending) return URL.createObjectURL(pending);
  if (item?.image_url) return getImageUrl(item.image_url);
  return null;
}

function renderLoveStoryList() {
  const list = document.getElementById("love-story-list");
  if (!list) return;
  list.innerHTML = "";
  _loveStoryItems.forEach((item, idx) => {
    const preview = _loveStoryImagePreview(idx);
    const _lsFp = item.focal_point;
    const lsFpStyle = _lsFp
      ? ` style="object-position:${_lsFp.x}% ${_lsFp.y}%"`
      : "";
    const div = document.createElement("div");
    div.className =
      "bg-rose-50 rounded-2xl p-3 border border-rose-100 space-y-2";
    div.innerHTML = `
      <div class="flex items-center justify-between mb-1">
        <span id="ls-label-${idx}" class="text-xs font-medium text-rose-400">${escapeHtml(item.title) || `Mốc ${idx + 1}`}</span>
        <button type="button" onclick="removeLoveStoryItem(${idx})"
          class="flex items-center gap-1 text-xs text-gray-400 hover:text-red-400 transition-colors">
          <i data-lucide="x" class="w-3.5 h-3.5"></i> Xóa
        </button>
      </div>
      <input type="text" value="${escapeHtml(item.date || "")}" placeholder="Ví dụ: Mùa xuân năm 2020"
        class="w-full h-10 px-3 py-2 border border-gray-200 rounded-md text-sm text-gray-800 bg-white outline-none transition-all placeholder:text-gray-400/50 focus:ring-2 focus:ring-rose-500/30 focus:ring-offset-2"
        oninput="_loveStoryItems[${idx}].date=this.value;_syncLoveStoryHidden();" />
      <input type="text" value="${escapeHtml(item.title || "")}" placeholder="Ví dụ: Lần đầu gặp gỡ"
        class="w-full h-10 px-3 py-2 border border-gray-200 rounded-md text-sm text-gray-800 bg-white outline-none transition-all placeholder:text-gray-400/50 focus:ring-2 focus:ring-rose-500/30 focus:ring-offset-2"
        oninput="_loveStoryItems[${idx}].title=this.value;_syncLoveStoryHidden();const lb=document.getElementById('ls-label-${idx}');if(lb)lb.textContent=this.value||'Mốc ${idx + 1}';" />
      <x-textarea bare data-ls-content="${idx}"
        input-class="w-full px-3 py-2 border border-gray-200 rounded-md text-sm text-gray-800 bg-white outline-none transition-all placeholder:text-gray-400/50 focus:ring-2 focus:ring-rose-500/30 focus:ring-offset-2 resize-none"
        placeholder="Kể ngắn về khoảnh khắc này..."></x-textarea>
      <div class="flex items-center flex-wrap gap-2">
        <input type="file" id="ls-img-input-${idx}" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" class="hidden"
          onchange="handleLoveStoryImage(${idx}, this)" />
        ${
          preview
            ? `
        <div class="relative w-16 h-16 rounded-xl overflow-hidden border border-rose-200 flex-shrink-0">
          <img src="${preview}" class="w-full h-full object-cover"${lsFpStyle} />
          <button type="button" onclick="adjustLoveStoryFocalPoint(${idx})"
            title="Chỉnh điểm lấy nét" class="absolute bottom-0.5 right-0.5 w-5 h-5 bg-black/50 rounded-full flex items-center justify-center text-white hover:bg-black/70 transition-colors">
            <i data-lucide="focus" class="w-3 h-3"></i>
          </button>
          <button type="button" onclick="removeLoveStoryImage(${idx})"
            class="absolute top-0.5 right-0.5 w-5 h-5 bg-black/50 rounded-full flex items-center justify-center text-white hover:bg-red-500 transition-colors">
            <i data-lucide="x" class="w-3 h-3"></i>
          </button>
        </div>`
            : `
        <button type="button" onclick="document.getElementById('ls-img-input-${idx}').click()"
          class="flex items-center gap-1.5 h-8 px-3 rounded-xl border border-dashed border-rose-300 text-xs text-rose-400 hover:border-rose-400 hover:text-rose-500 transition-colors">
          <i data-lucide="image-plus" class="w-3.5 h-3.5"></i> Thêm ảnh
        </button>`
        }
      </div>
    `;
    list.appendChild(div);
  });
  if (typeof lucide !== "undefined") lucide.createIcons();
  // Nạp value + gắn cụm AI (Tối ưu/Mic/Undo/Redo) cho các <x-textarea> vừa dựng.
  if (typeof _wireLoveStoryTextareas === "function") _wireLoveStoryTextareas(list);
}

// Wraps openFocalPointPicker as a Promise. Resolves with {x,y} on confirm, null on cancel.
function _openFocalPickerAsync(source, currentFocal) {
  return new Promise((resolve) => {
    let done = false;
    function finish(val) {
      if (done) return;
      done = true;
      resolve(val);
    }
    openFocalPointPicker(source, currentFocal || { x: 50, y: 50 }, (focal) =>
      finish(focal),
    );
    const origClose = window._closeFocalSheet;
    window._closeFocalSheet = (...args) => {
      setTimeout(() => finish(null), 0);
      if (origClose) origClose(...args);
    };
  });
}

async function handleLoveStoryImage(idx, input) {
  const file = input.files[0];
  if (!file) return;
  if (!_checkImageType(file)) return; // khai ở 10-images.js (nạp trước file này)
  input.value = "";
  const focal = await _openFocalPickerAsync(
    file,
    _loveStoryItems[idx]?.focal_point,
  );
  if (!focal) return;
  showLoading(true, "Đang xử lý ảnh...");
  try {
    const processed = await prepareImage(file);
    _loveStoryPendingImages[idx] = processed;
    _loveStoryItems[idx].focal_point = focal;
    _syncLoveStoryHidden();
    _idbSaveLoveStoryImages();
  } catch (e) {
    showToast("Lỗi xử lý ảnh", "error");
  } finally {
    showLoading(false);
  }
  renderLoveStoryList();
}

async function adjustLoveStoryFocalPoint(idx) {
  const source = _loveStoryPendingImages[idx]
    ? URL.createObjectURL(_loveStoryPendingImages[idx])
    : _loveStoryItems[idx]?.image_url
      ? getImageUrl(_loveStoryItems[idx].image_url)
      : null;
  if (!source) return;
  const focal = await _openFocalPickerAsync(
    source,
    _loveStoryItems[idx]?.focal_point,
  );
  if (!focal) return;
  _loveStoryItems[idx].focal_point = focal;
  _syncLoveStoryHidden();
  renderLoveStoryList();
  showToast("Đã cập nhật điểm lấy nét", "success");
}

function removeLoveStoryImage(idx) {
  delete _loveStoryPendingImages[idx];
  _loveStoryItems[idx].image_url = null;
  _loveStoryItems[idx].focal_point = null;
  _syncLoveStoryHidden();
  _idbSaveLoveStoryImages();
  renderLoveStoryList();
}

function addLoveStoryItem() {
  if (_loveStoryItems.length >= MAX_LOVE_STORY_ITEMS) {
    showToast(`Tối đa ${MAX_LOVE_STORY_ITEMS} mốc`, "warning");
    return;
  }
  _loveStoryItems.push({ date: "", title: "", content: "", image_url: null });
  _syncLoveStoryHidden();
  renderLoveStoryList();
  const list = document.getElementById("love-story-list");
  if (list) {
    const inputs = list.querySelectorAll("input[type=text]");
    if (inputs.length) inputs[inputs.length - 2]?.focus();
  }
}

function removeLoveStoryItem(idx) {
  delete _loveStoryPendingImages[idx];
  _loveStoryItems.splice(idx, 1);
  // Re-key pending images after splice
  const reKeyed = {};
  Object.entries(_loveStoryPendingImages).forEach(([k, v]) => {
    const n = parseInt(k);
    if (n > idx) reKeyed[n - 1] = v;
    else if (n < idx) reKeyed[n] = v;
  });
  Object.keys(_loveStoryPendingImages).forEach(
    (k) => delete _loveStoryPendingImages[k],
  );
  Object.assign(_loveStoryPendingImages, reKeyed);
  _syncLoveStoryHidden();
  _idbSaveLoveStoryImages();
  renderLoveStoryList();
}

