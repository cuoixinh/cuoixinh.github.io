// Lịch trình ngày cưới và Câu chuyện tình yêu (thêm/xoá/sắp xếp mốc).
//
// Tách từ index.js (dòng 3889–4239 bản gốc). Thứ tự nạp khai báo ở loader.js.

// ============= TIMELINE =============
// Mỗi item: { time, title, type }  type = "ceremony" | "party"
// Backward compat: item không có type → coi là "ceremony"

let _timelineItems = [];

// Lịch trình và chuyện tình yêu sống trong hai ô ẩn (#timeline-value,
// #love-story-value) mà CHỈ code ghi vào → không phát event nào, listener autosave ở
// 06-draft-save.js không thấy gì: chọn giờ, thêm/xoá mốc rồi F5 là mất trắng. Nên mọi
// lần đồng bộ ô ẩn cũng hẹn autosave, TRỪ lúc fillForm đang nạp (cờ _cxListFilling khai
// ở js/13-data.js, nạp trước file này): dữ liệu lúc đó vừa từ nháp/DB ra, đánh dấu sửa là
// hạ cờ _demoFilled và ghi nháp bằng chính nó.
function _listChanged() {
  if (!_cxListFilling && typeof _scheduleAutoSave === "function")
    _scheduleAutoSave("edit");
}

// Mốc chưa nhập gì (cả giờ lẫn việc đều trống) chỉ sống trong form — không ra ô ẩn
// (dữ liệu lưu + bước "đã xong") và không lên thiệp.
function _timelineFilled() {
  return _timelineItems.filter(
    (it) => String(it.time || "").trim() || String(it.title || "").trim(),
  );
}

function _syncTimelineHidden() {
  const hidden = document.getElementById("timeline-value");
  if (hidden) hidden.value = JSON.stringify(_timelineFilled());
  _listChanged();
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
        aria-label="Giờ"
        readonly
        class="w-24 flex-shrink-0 h-10 px-2 border border-gray-200 rounded-xl text-sm text-gray-800 bg-white outline-none cursor-pointer text-center hover:border-gray-300 focus:border-gray-400"
        onclick="openTimePicker(this, this.value, v => { _timelineItems[${idx}].time=v; this.value=v; _syncTimelineHidden(); })"
      />
      <input
        type="text"
        value="${escapeHtml(item.title || "")}"
        placeholder="Mô tả sự kiện"
        aria-label="Mô tả sự kiện"
        class="flex-1 min-w-0 h-10 px-3 border border-gray-200 rounded-xl text-sm text-gray-800 bg-white outline-none focus:border-gray-400"
        oninput="_timelineItems[${idx}].title=this.value;_syncTimelineHidden();"
      />
      <x-button variant="soft" tone="danger" size="sm" icon-only type="button" onclick="removeTimelineItem(${idx})" title="Xóa" class="flex-shrink-0">
        <i data-lucide="trash-2" class="w-4 h-4"></i>
      </x-button>
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
  _listChanged();
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
  const count = document.getElementById("love-count");
  if (count) count.textContent = `${_loveStoryItems.length}/${MAX_LOVE_STORY_ITEMS} mốc, xếp từ cũ đến mới`;
  document.getElementById("love-sort-btn")?.classList.toggle("hidden", _loveStoryItems.length < 2);
  _loveStoryItems.forEach((item, idx) => {
    const preview = _loveStoryImagePreview(idx);
    const _lsFp = item.focal_point;
    const lsFpStyle = _lsFp
      ? ` style="object-position:${_lsFp.x}% ${_lsFp.y}%"`
      : "";
    // Một mốc = nút số trên sợi chỉ thời gian + thẻ nhập (.cx-ls-* ở styles/_setup.css).
    // Thứ tự ô Thời gian → Tên mốc phải giữ: addLoveStoryItem() focus theo vị trí.
    const div = document.createElement("div");
    div.className = "cx-ls-item";
    div.innerHTML = `
      <span class="cx-ls-node" aria-hidden="true">${idx + 1}</span>
      <div class="cx-ls-card">
        <div class="cx-ls-card-head">
          <p id="ls-label-${idx}" class="cx-ls-name${item.title ? "" : " is-blank"}">${escapeHtml(item.title) || "Chưa đặt tên mốc"}</p>
          <x-button variant="ghost" tone="danger" size="sm" icon-only type="button" onclick="removeLoveStoryItem(${idx})"
            aria-label="Xóa mốc ${idx + 1}" title="Xóa mốc">
            <i data-lucide="trash-2" style="width: 16px; height: 16px"></i>
          </x-button>
        </div>
        <div class="cx-ls-body">
          <div class="cx-ls-fields">
            <div class="cx-ls-row">
              <div class="cx-ls-date">
                <label for="ls-date-${idx}" class="cx-ls-lbl">Thời gian</label>
                <i data-lucide="calendar-heart" class="cx-ls-date-ico" aria-hidden="true" style="width: 14px; height: 14px"></i>
                <input type="text" id="ls-date-${idx}" value="${escapeHtml(item.date || "")}" placeholder="Xuân 2020"
                  title="Thời gian của mốc" class="cx-ls-input"
                  oninput="_loveStoryItems[${idx}].date=this.value;_syncLoveStoryHidden();" />
              </div>
              <div class="min-w-0 flex-1">
                <label for="ls-title-${idx}" class="cx-ls-lbl">Tên mốc</label>
                <input type="text" id="ls-title-${idx}" value="${escapeHtml(item.title || "")}" placeholder="Lần đầu gặp nhau"
                  class="cx-ls-input"
                  oninput="_loveStoryItems[${idx}].title=this.value;_syncLoveStoryHidden();const lb=document.getElementById('ls-label-${idx}');if(lb){lb.textContent=this.value||'Chưa đặt tên mốc';lb.classList.toggle('is-blank',!this.value);}" />
              </div>
            </div>
            <div>
              <label for="ls-content-${idx}" class="cx-ls-lbl">Kể lại khoảnh khắc</label>
              <x-textarea bare id="ls-content-${idx}" data-ls-content="${idx}"
                input-class="cx-ls-input cx-ls-area"
                placeholder="Hôm đó thế nào, hai bạn đã ở đâu, ai nói gì..."></x-textarea>
            </div>
          </div>
          <div class="cx-ls-photo">
            <input type="file" id="ls-img-input-${idx}" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" class="hidden"
              onchange="handleLoveStoryImage(${idx}, this)" />
            ${
              preview
                ? `
            <div class="cx-ls-thumb">
              <img src="${cxImgSrc(preview)}" alt="Ảnh mốc ${idx + 1}" class="h-full w-full object-cover"${lsFpStyle} />
              <x-button variant="overlay" size="xs" icon-only type="button" onclick="adjustLoveStoryFocalPoint(${idx})"
                aria-label="Chỉnh điểm lấy nét" title="Chỉnh điểm lấy nét" class="absolute bottom-1 right-1">
                <i data-lucide="focus" class="w-3 h-3"></i>
              </x-button>
              <x-button variant="overlay" tone="danger" size="xs" icon-only type="button" onclick="removeLoveStoryImage(${idx})"
                aria-label="Gỡ ảnh" title="Gỡ ảnh" class="absolute right-1 top-1">
                <i data-lucide="x" class="w-3 h-3"></i>
              </x-button>
            </div>`
                : `
            <x-button variant="bare" class="cx-add-tile cx-ls-thumb" aria-label="Thêm ảnh cho mốc ${idx + 1}"
              onclick="document.getElementById('ls-img-input-${idx}').click()">
              <i data-lucide="image-plus"></i><span>Thêm ảnh</span>
            </x-button>
            <p class="cx-ls-photo-hint">Ảnh không bắt buộc</p>`
            }
          </div>
        </div>
      </div>
    `;
    list.appendChild(div);
  });
  if (typeof lucide !== "undefined") lucide.createIcons();
  // Nạp value + gắn cụm AI (Tối ưu/Mic/Undo/Redo) cho các <x-textarea> vừa dựng.
  if (typeof _wireLoveStoryTextareas === "function") _wireLoveStoryTextareas(list);
}

async function handleLoveStoryImage(idx, input) {
  const file = input.files[0];
  if (!file) return;
  if (!_checkImageType(file)) return; // khai ở 10-images.js (nạp trước file này)
  input.value = "";
  const picked = await CXImagePick.focalCrop(file, _loveStoryItems[idx]?.focal_point);
  if (!picked) return;
  const { focal, cropped } = picked;
  showLoading(true, "Đang xử lý ảnh...");
  try {
    const processed = await prepareImage(cropped || file);
    _loveStoryPendingImages[idx] = processed;
    _loveStoryItems[idx].focal_point = focal;
    _syncLoveStoryHidden();
    _idbSaveLoveStoryImages();
  } catch (e) {
    showToast(e?.message ? `Lỗi xử lý ảnh: ${e.message}` : "Lỗi xử lý ảnh", "error");
  } finally {
    showLoading(false);
  }
  renderLoveStoryList();
  _imagesChanged();
}

async function adjustLoveStoryFocalPoint(idx) {
  const source = _loveStoryPendingImages[idx]
    ? URL.createObjectURL(_loveStoryPendingImages[idx])
    : _loveStoryItems[idx]?.image_url
      ? getImageUrl(_loveStoryItems[idx].image_url)
      : null;
  if (!source) return;
  const picked = await CXImagePick.focalCrop(source, _loveStoryItems[idx]?.focal_point);
  if (!picked) return;
  const { focal, cropped } = picked;
  // Đã cắt → ảnh cắt thành ảnh chờ upload, y như khi chọn ảnh mới cho mốc này.
  if (cropped) {
    showLoading(true, "Đang xử lý ảnh...");
    try {
      _loveStoryPendingImages[idx] = await prepareImage(cropped);
      _idbSaveLoveStoryImages();
    } catch (e) {
      showToast("Lỗi xử lý ảnh", "error");
      return;
    } finally {
      showLoading(false);
    }
  }
  _loveStoryItems[idx].focal_point = focal;
  _syncLoveStoryHidden();
  renderLoveStoryList();
  _imagesChanged();
  showToast("Đã cập nhật điểm lấy nét", "success");
}

// Bỏ ảnh mốc chuyện tình thì xếp hàng xoá như mọi ảnh khác. URL ngoài hệ thống
// server tự bỏ qua (chỉ xoá file thuộc thư mục của thiệp).
function _queueLoveStoryImageDelete(idx) {
  const url = _loveStoryItems[idx]?.image_url;
  if (url) deletedImages.singleImages.push(url);
}

// AI chỉ thay CHỮ của chuyện tình yêu, không bao giờ đụng ảnh. Mọi luồng AI ghi
// đè danh sách (viết chuyện tình, viết cả thiệp…) phải đi qua đây.
// Ảnh bám theo VỊ TRÍ mốc. Bản AI ngắn hơn danh sách đang có thì mốc dôi ra vẫn
// được giữ dưới dạng mốc TRỐNG để ảnh không mất — xoá mốc là việc của khách.
// Mốc dôi ra mà không có ảnh thì bỏ, giữ lại chỉ tổ thành hàng rỗng vô nghĩa.
function applyLoveStoryText(newItems) {
  const texts = (newItems || []).slice(0, MAX_LOVE_STORY_ITEMS);
  const merged = [];
  const pending = {};
  const total = Math.max(texts.length, _loveStoryItems.length);

  for (let i = 0; i < total && merged.length < MAX_LOVE_STORY_ITEMS; i++) {
    const old = _loveStoryItems[i];
    const t = texts[i];
    const file = _loveStoryPendingImages[i];
    if (!t && !old?.image_url && !file) continue;

    if (file) pending[merged.length] = file; // bỏ mốc rỗng ở giữa → phải khớp key mới
    merged.push({
      date: t?.date || "",
      title: t?.title || "",
      content: t?.content || "",
      image_url: old?.image_url ?? null,
      focal_point: old?.focal_point ?? null,
    });
  }

  _loveStoryItems.length = 0;
  _loveStoryItems.push(...merged);
  Object.keys(_loveStoryPendingImages).forEach(
    (k) => delete _loveStoryPendingImages[k],
  );
  Object.assign(_loveStoryPendingImages, pending);
  _loveStoryKeyExists = true;
  _syncLoveStoryHidden();
  renderLoveStoryList();
  _idbSaveLoveStoryImages();
}

function removeLoveStoryImage(idx) {
  delete _loveStoryPendingImages[idx];
  _queueLoveStoryImageDelete(idx);
  _loveStoryItems[idx].image_url = null;
  _loveStoryItems[idx].focal_point = null;
  _syncLoveStoryHidden();
  _idbSaveLoveStoryImages();
  renderLoveStoryList();
  _imagesChanged();
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
  _queueLoveStoryImageDelete(idx);
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


// Xếp lại mốc theo `order` (order[vị trí mới] = vị trí cũ). Ảnh chờ upload bám
// theo vị trí nên phải đánh lại khoá cùng lúc, giống removeLoveStoryItem().
function _reorderLoveStory(order) {
  const items = order.map((from) => _loveStoryItems[from]);
  const pending = {};
  order.forEach((from, to) => {
    if (_loveStoryPendingImages[from]) pending[to] = _loveStoryPendingImages[from];
  });
  _loveStoryItems.splice(0, _loveStoryItems.length, ...items);
  Object.keys(_loveStoryPendingImages).forEach(
    (k) => delete _loveStoryPendingImages[k],
  );
  Object.assign(_loveStoryPendingImages, pending);
  _syncLoveStoryHidden();
  _idbSaveLoveStoryImages();
  renderLoveStoryList();
  if (Object.keys(pending).length) _imagesChanged();
}

// Popup "Sắp xếp các mốc": mỗi mốc chỉ còn một dòng Thời gian + Tên mốc trên sợi chỉ,
// kéo tay nắm hoặc bấm mũi tên để đổi chỗ; chỉ "Lưu thứ tự" mới ghi vào danh sách.
// Số trên sợi chỉ là VỊ TRÍ (đánh lại sau mỗi lần đổi), không đi theo mốc. Style .cx-lsort-*.
function openLoveStorySort(trigger) {
  if (_loveStoryItems.length < 2 || document.getElementById("cx-lsort")) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const ico = (name, size = 16) =>
    `<i data-lucide="${name}" style="width:${size}px;height:${size}px"></i>`;
  const rows = _loveStoryItems
    .map((it, i) => {
      const date = String(it.date || "").trim();
      const title = String(it.title || "").trim();
      return `
      <li class="cx-lsort-row" data-from="${i}">
        <span class="cx-lsort-node" aria-hidden="true">${i + 1}</span>
        <div class="cx-lsort-card">
          <div class="cx-lsort-txt">
            <p class="cx-lsort-date${date ? "" : " is-blank"}">${escapeHtml(date) || "Chưa có thời gian"}</p>
            <p class="cx-lsort-name${title ? "" : " is-blank"}">${escapeHtml(title) || "Chưa đặt tên mốc"}</p>
          </div>
          <div class="cx-lsort-step">
            <x-button variant="bare" data-act="up" aria-label="Đưa lên" title="Đưa lên">${ico("chevron-up")}</x-button>
            <x-button variant="bare" data-act="down" aria-label="Đưa xuống" title="Đưa xuống">${ico("chevron-down")}</x-button>
          </div>
          <x-button variant="bare" class="cx-lsort-grip" data-act="grip"
            aria-label="Kéo để đổi chỗ — hoặc dùng phím mũi tên lên/xuống">${ico("grip-vertical", 18)}</x-button>
        </div>
      </li>`;
    })
    .join("");

  const root = document.createElement("div");
  root.id = "cx-lsort";
  root.className = "cx-lsort";
  root.innerHTML = `
    <section class="cx-lsort-box" role="dialog" aria-modal="true" aria-labelledby="cx-lsort-title">
      <span class="cx-lsort-grab" aria-hidden="true"></span>
      <header class="cx-lsort-head">
        <div class="min-w-0 flex-1">
          <h2 id="cx-lsort-title" class="cx-lsort-title">Sắp xếp các mốc</h2>
          <p class="cx-lsort-sub">Kéo ${ico("grip-vertical", 13)} hoặc bấm mũi tên để đổi chỗ</p>
        </div>
        <x-button variant="ghost" tone="neutral" icon-only data-act="close" aria-label="Đóng" title="Đóng">${ico("x", 18)}</x-button>
      </header>
      <div class="cx-lsort-body">
        <ol class="cx-lsort-list">${rows}</ol>
      </div>
      <footer class="cx-lsort-foot">
        <x-button variant="ghost" tone="neutral" data-act="close">Huỷ</x-button>
        <x-button data-act="save">${ico("check")} Lưu thứ tự</x-button>
      </footer>
      <p class="sr-only" role="status" aria-live="polite"></p>
    </section>`;
  document.body.appendChild(root);
  window.lucide?.createIcons({ root });

  const body = root.querySelector(".cx-lsort-body");
  const list = root.querySelector(".cx-lsort-list");
  const live = root.querySelector("[role=status]");
  const order = () => [...list.children].map((r) => Number(r.dataset.from));
  const nameOf = (row) => row.querySelector(".cx-lsort-name").textContent;

  // Số vị trí + mũi tên đầu/cuối; số nào đổi thì nảy nhẹ (.is-tick).
  const renumber = () => {
    const all = [...list.children];
    all.forEach((row, k) => {
      const node = row.querySelector(".cx-lsort-node");
      if (node.textContent !== String(k + 1)) {
        node.textContent = k + 1;
        node.classList.remove("is-tick");
        void node.offsetWidth;
        node.classList.add("is-tick");
      }
      row.classList.toggle("is-moved", Number(row.dataset.from) !== k);
      row.querySelector("[data-act=up]").disabled = k === 0;
      row.querySelector("[data-act=down]").disabled = k === all.length - 1;
    });
  };

  // FLIP: đổi DOM xong cho các dòng khác trượt từ chỗ cũ về chỗ mới. offsetTop không
  // tính transform nên đo được cả lúc dòng còn đang trượt dở.
  const move = (mutate, skip) => {
    const all = [...list.children];
    const before = new Map(all.map((r) => [r, r.offsetTop]));
    mutate();
    renumber();
    if (reduce) return;
    all.forEach((r) => {
      const d = before.get(r) - r.offsetTop;
      if (r === skip || !d) return;
      r.style.transition = "none";
      r.style.transform = `translateY(${d}px)`;
      void r.offsetHeight;
      r.style.transition = "";
      r.style.transform = "";
    });
  };

  const announce = (row) => {
    live.textContent = `${nameOf(row)}: vị trí ${[...list.children].indexOf(row) + 1}`;
  };

  const step = (row, dir) => {
    const target = dir < 0 ? row.previousElementSibling : row.nextElementSibling;
    if (!target) return;
    move(() => list.insertBefore(row, dir < 0 ? target : target.nextElementSibling));
    announce(row);
  };

  // ── Kéo thả bằng pointer (chuột + cảm ứng). Cảm ứng chỉ bắt ở tay nắm để vuốt
  // trong danh sách vẫn cuộn được; chuột thì nắm cả thẻ.
  let drag = null;
  // Tâm đo theo THẺ chứ không theo dòng: dòng cuối không có đệm đáy nên hai cách đo
  // lệch nhau. Quyết định chỗ thả theo vị trí ngón tay thật (raw), chỉ hình thẻ mới bị
  // kẹp trong danh sách — kẹp cả phép so thì tâm thẻ không bao giờ vượt được tâm
  // dòng đầu/cuối, kéo lên đầu hay xuống cuối bị mắc.
  const cardH = (r) => r.querySelector(".cx-lsort-card").offsetHeight;
  const place = () => {
    const { row } = drag;
    const h = cardH(row);
    const raw = drag.y - list.getBoundingClientRect().top - drag.grab;
    const top = Math.max(0, Math.min(list.offsetHeight - h, raw));
    const mid = raw + h / 2;
    let before = null;
    for (const r of list.children) {
      if (r !== row && r.offsetTop + cardH(r) / 2 > mid) {
        before = r;
        break;
      }
    }
    if (before !== row.nextElementSibling && before !== row)
      move(() => list.insertBefore(row, before), row);
    row.style.transform = `translateY(${top - row.offsetTop}px)`;
  };
  // Gần mép trên/dưới khung cuộn thì tự cuộn theo (10 mốc có thể dài hơn màn).
  const tick = () => {
    if (!drag) return;
    const b = body.getBoundingClientRect();
    const edge = 56;
    if (drag.y < b.top + edge) body.scrollTop -= Math.ceil((b.top + edge - drag.y) / 6);
    else if (drag.y > b.bottom - edge) body.scrollTop += Math.ceil((drag.y - b.bottom + edge) / 6);
    place();
    drag.raf = requestAnimationFrame(tick);
  };
  const endDrag = () => {
    if (!drag) return;
    const { row, raf } = drag;
    cancelAnimationFrame(raf);
    drag = null;
    row.classList.remove("is-drag");
    root.classList.remove("is-dragging");
    row.style.transform = "";
    announce(row);
  };
  list.addEventListener("pointerdown", (e) => {
    const row = e.target.closest(".cx-lsort-row");
    if (!row || drag || e.button > 0) return;
    const onGrip = !!e.target.closest("[data-act=grip]");
    if (!onGrip && (e.pointerType !== "mouse" || e.target.closest("button"))) return;
    e.preventDefault();
    drag = {
      row,
      y: e.clientY,
      grab: e.clientY - list.getBoundingClientRect().top - row.offsetTop,
    };
    list.setPointerCapture(e.pointerId);
    row.classList.add("is-drag");
    root.classList.add("is-dragging");
    drag.raf = requestAnimationFrame(tick);
  });
  list.addEventListener("pointermove", (e) => {
    if (drag) drag.y = e.clientY;
  });
  list.addEventListener("pointerup", endDrag);
  list.addEventListener("pointercancel", endDrag);
  list.addEventListener("lostpointercapture", endDrag);

  const close = () => {
    endDrag();
    document.removeEventListener("keydown", onKey, true);
    root.classList.add("is-out");
    setTimeout(() => root.remove(), reduce ? 0 : 180);
    trigger?.focus?.();
  };
  const save = () => {
    const o = order();
    const changed = o.some((from, to) => from !== to);
    close();
    if (!changed) return;
    _reorderLoveStory(o);
    showToast("Đã lưu thứ tự mốc", "success");
  };
  const onKey = (e) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      close();
      return;
    }
    const grip = e.target.closest?.("[data-act=grip]");
    if (grip && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
      e.preventDefault();
      step(grip.closest(".cx-lsort-row"), e.key === "ArrowUp" ? -1 : 1);
      grip.focus();
      grip.scrollIntoView({ block: "nearest" });
    }
  };
  document.addEventListener("keydown", onKey, true);

  root.addEventListener("click", (e) => {
    if (e.target === root) return close();
    const btn = e.target.closest("[data-act]");
    if (!btn) return;
    const act = btn.dataset.act;
    if (act === "close") close();
    else if (act === "save") save();
    else if (act === "up" || act === "down") {
      const row = btn.closest(".cx-lsort-row");
      step(row, act === "up" ? -1 : 1);
      // Mũi tên vừa bấm bị khoá (đã lên đầu/xuống cuối) thì chuyển focus sang mũi tên kia.
      (btn.disabled ? row.querySelector(`[data-act=${act === "up" ? "down" : "up"}]`) : btn).focus();
    }
  });

  renumber();
  list.querySelector("[data-act=grip]")?.focus({ preventScroll: true });
}
