// Bảng chọn địa điểm (Leaflet + Nominatim) dùng CHUNG cho form trang Thiết lập và ô bản đồ
// trong khung chat XuXi (js/ai-chat-media.js, tự nạp file này + Leaflet + core/utils.js
// ở trang chủ). Cần openBottomSheet/escapeHtml (core/utils.js) và Leaflet.
let _mapPickerSelected = null;
let _mapSuggestions = [];
let _leafletMap = null;
let _leafletMarker = null;
let _mapPickerOpts = null; // {onApply} khi bên gọi tự lưu kết quả (khung chat), null = form
let _mapPickerGmap = ""; // chữ lớp Google đang phủ theo (_showGmap), rỗng = đang ở OSM

function _markerIcon() {
  return L.divIcon({
    className: "",
    html: '<span class="cx-mp-pin"><span class="cx-mp-pin-head"></span><span class="cx-mp-pin-shadow"></span></span>',
    iconSize: [32, 40],
    iconAnchor: [16, 36],
  });
}

// Chip nhắc trên bản đồ: "Chạm để ghim" ↔ "Đã ghim", và cho ghim rơi lại một nhịp.
function _markPinned() {
  document.getElementById("map-picker-hint")?.classList.add("is-set");
  const pin = _leafletMarker?.getElement()?.querySelector(".cx-mp-pin");
  if (!pin) return;
  pin.classList.remove("is-drop");
  void pin.offsetWidth;
  pin.classList.add("is-drop");
}

function _placeMarker(lat, lon) {
  if (!_leafletMap) return;
  if (_leafletMarker) {
    _leafletMarker.setLatLng([lat, lon]);
  } else {
    _leafletMarker = L.marker([lat, lon], { icon: _markerIcon(), draggable: true }).addTo(_leafletMap);
    _leafletMarker.on("dragend", (e) => {
      const p = e.target.getLatLng();
      _reverseGeocode(p.lat, p.lng);
      _markPinned();
    });
  }
  _markPinned();
}

async function _reverseGeocode(lat, lon) {
  const picked = { lat, lon, name: `${lat.toFixed(5)}, ${lon.toFixed(5)}` };
  _mapPickerSelected = picked;
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=vi`,
      { headers: { "Accept-Language": "vi" } }
    );
    const data = await res.json();
    // Khách đã chọn chỗ khác (hoặc đóng sheet) trong lúc chờ → bỏ kết quả cũ.
    if (_mapPickerSelected !== picked) return;
    if (data.display_name) {
      picked.name = data.display_name;
      const input = document.getElementById("map-picker-search");
      if (input) input.value = data.display_name;
      _syncDisplayName(data.display_name);
    }
  } catch (e) {}
}

function _syncDisplayName(name) {
  const dn = document.getElementById("map-picker-display-name");
  if (dn && dn.disabled) dn.value = name;
}

// opts.onApply(embedUrl, displayName): trả kết quả cho bên gọi thay vì ghi vào form; khi đó
// giá trị đang có lấy từ opts.embed / opts.name, và opts.query (địa chỉ gợi ý) được tìm
// sẵn để ghim nằm đúng chỗ ngay khi mở.
function openMapPicker(side, opts = {}) {
  if (document.getElementById("map-picker-modal")) return;
  _mapPickerSelected = null;
  _mapSuggestions = [];
  _mapPickerGmap = "";
  _leafletMap = null;
  _leafletMarker = null;
  _mapPickerOpts = typeof opts.onApply === "function" ? opts : null;

  const hiddenInput = _mapPickerOpts ? null : document.getElementById(`${side}_map_embed_url`);
  const currentVal = _mapPickerOpts ? String(opts.embed || "") : hiddenInput ? hiddenInput.value.trim() : "";

  let currentQuery = "";
  let initLat = 16, initLon = 106, initZoom = 6, hasCoords = false;
  try {
    const qMatch = currentVal.match(/[?&]q=([^&]+)/);
    if (qMatch) {
      const q = decodeURIComponent(qMatch[1]);
      const latLon = q.match(/^(-?\d+\.?\d*),(-?\d+\.?\d*)$/);
      if (latLon) {
        initLat = parseFloat(latLon[1]); initLon = parseFloat(latLon[2]);
        initZoom = 15; hasCoords = true;
      } else {
        currentQuery = q;
      }
    }
  } catch (e) {}
  const autoSearch = !!_mapPickerOpts && !currentVal && !!opts.query;
  if (autoSearch) currentQuery = String(opts.query);

  const currentDisplayName = _mapPickerOpts
    ? String(opts.name || currentQuery)
    : document.getElementById(`${side}-map-address`)?.textContent?.trim() || currentQuery;

  const sideLabelMap = { ceremony: "Lễ thành hôn", vu_quy: "Lễ vu quy", groom_party: "Tiệc nhà trai", bride_party: "Tiệc nhà gái", groom: "Nhà trai", bride: "Nhà gái" };
  const sideLabel = sideLabelMap[side] || side;

  const sheet = openBottomSheet({
    id: 'map-picker-modal',
    title: `<span class="cx-mp-title-ic"><i data-lucide="map-pin" style="width:16px;height:16px"></i></span>Chọn địa điểm<span class="cx-mp-side">${escapeHtml(sideLabel)}</span>`,
    cardClass: 'sm:max-w-5xl',
    onClose: () => {
      document.removeEventListener("click", _onClickOutsideSuggestions);
      if (_leafletMap) { _leafletMap.remove(); _leafletMap = null; _leafletMarker = null; }
      _mapPickerSelected = null;
      _mapSuggestions = [];
      _mapPickerGmap = "";
      _mapPickerOpts = null;
      window._closeMapPickerSheet = null;
    },
  });
  if (!sheet) return;
  window._closeMapPickerSheet = sheet.close;

  // Bố cục ở .cx-mp (_common.css): mobile xếp dọc ô gõ · bản đồ · nút; từ sm là hai
  // cột, bản đồ chiếm trọn cột phải. Hai ô gõ luôn đứng ĐẦU: ô nằm dưới mép bàn phím
  // là iOS trượt cả khung nhìn lên (JS không chặn được), kéo theo UI phía sau.
  // Gợi ý địa điểm là `absolute` trong ô tìm, không `fixed`: vuốt-để-đóng đặt
  // transform lên thẻ sheet, thẻ `fixed` bên trong sẽ lệch khỏi ô.
  sheet.body.innerHTML = `
    <div class="cx-mp">
      <div class="cx-mp-ctrl">
        <div id="map-picker-search-wrap" class="relative z-10">
          <i data-lucide="search" class="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" style="width:16px;height:16px"></i>
          <input id="map-picker-search" type="text" enterkeyhint="search" value="${escapeHtml(currentQuery || (hasCoords ? currentDisplayName : ""))}"
            placeholder="Tìm nhà hàng, trung tâm tiệc, địa chỉ…"
            autocomplete="off" aria-label="Tìm địa điểm"
            class="cx-mp-search"
          />
          <button type="button" class="cx-mp-clear" aria-label="Xoá" onclick="_clearMapInput('map-picker-search')"><i data-lucide="x" style="width:14px;height:14px"></i></button>
          <x-button size="sm" variant="soft" onclick="searchMapPicker()" class="absolute right-1.5 top-1/2 -translate-y-1/2">Tìm</x-button>
          <div id="map-picker-suggestions" class="cx-mp-sugs hidden" role="listbox"></div>
        </div>

        <div>
          <div class="mb-2 flex items-center justify-between gap-3">
            <label for="map-picker-display-name" class="text-sm font-semibold text-gray-800">Tên hiện trên thiệp</label>
            <div class="flex items-center gap-2">
              <span class="text-xs text-gray-500">Sửa tên</span>
              <x-switch key="map-name" label="Sửa tên" onclick="_toggleMapDisplayName()"></x-switch>
            </div>
          </div>
          <div class="relative">
            <input id="map-picker-display-name" type="text" disabled value="${escapeHtml(currentDisplayName)}"
              placeholder="Ghim một vị trí để tự điền tên"
              class="cx-mp-name"
            />
            <button type="button" class="cx-mp-clear" aria-label="Xoá" onclick="_clearMapInput('map-picker-display-name')"><i data-lucide="x" style="width:14px;height:14px"></i></button>
          </div>
          <p id="map-picker-name-note" class="mt-1.5 text-xs text-gray-400">Tự lấy theo vị trí đã ghim.</p>
        </div>
      </div>

      <div class="cx-mp-map">
        <div id="map-picker-map" class="h-full w-full"></div>
        <div id="map-picker-gmap" class="cx-mp-gmap" hidden>
          <iframe title="Bản đồ Google" referrerpolicy="no-referrer-when-downgrade"></iframe>
          <div class="cx-mp-gmap-card">
            <div class="cx-mp-gmap-txt">
              <p class="cx-mp-gmap-title"><i data-lucide="eye" style="width:16px;height:16px"></i><span>Bản đồ này sẽ hiện trên thiệp</span></p>
              <p class="cx-mp-gmap-sub">Bản đồ Google chỉ để xem trước, chạm vào không đổi được vị trí. Chưa đúng chỗ thì tự ghim lại nhé.</p>
            </div>
            <x-button size="sm" icon="hand" class="cx-mp-gmap-pin" onclick="_pinOnOsm()"><span class="cx-mp-gmap-short">Tự ghim</span><span class="cx-mp-gmap-wide">Tự ghim trên bản đồ</span></x-button>
          </div>
        </div>
        <p id="map-picker-hint" class="cx-mp-hint${hasCoords ? " is-set" : ""}">
          <span class="cx-mp-hint-idle"><i data-lucide="pointer" style="width:14px;height:14px"></i>Chạm vào bản đồ để ghim</span>
          <span class="cx-mp-hint-set"><i data-lucide="circle-check" style="width:14px;height:14px"></i>Đã ghim · kéo để chỉnh</span>
        </p>
      </div>

      <div class="cx-mp-act">
        <x-button variant="outline" tone="neutral" onclick="closeMapPicker()" class="flex-1">Hủy</x-button>
        <x-button icon="check" onclick="applyMapPicker('${side}')" class="flex-1">Dùng vị trí này</x-button>
      </div>
    </div>
  `;
  window.lucide?.createIcons({ root: sheet.body.closest(".cx-sheet-card") });

  _syncMapNameSwitch(false);

  setTimeout(() => {
    const mapEl = document.getElementById("map-picker-map");
    // Sheet có thể đã đóng trong 80ms chờ này.
    if (typeof L === "undefined" || !mapEl) return;
    _leafletMap = L.map(mapEl, { zoomControl: true }).setView([initLat, initLon], initZoom);
    // Khung bản đồ đổi khổ (khung nhìn co theo bàn phím ở webview Zalo/Facebook…)
    // mà Leaflet không biết thì phần mới lộ ra là ô xám.
    if (window.ResizeObserver) {
      const ro = new ResizeObserver(() => _leafletMap?.invalidateSize());
      ro.observe(mapEl);
      _leafletMap.on("unload", () => ro.disconnect());
    }
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap",
      maxZoom: 19,
    }).addTo(_leafletMap);

    if (hasCoords) {
      _placeMarker(initLat, initLon);
      _mapPickerSelected = { lat: initLat, lon: initLon, name: currentDisplayName };
    }

    _leafletMap.on("click", (e) => {
      _placeMarker(e.latlng.lat, e.latlng.lng);
      _reverseGeocode(e.latlng.lat, e.latlng.lng);
    });
    if (autoSearch) searchMapPicker();
    else if (currentQuery) {
      _showGmap(currentQuery);
      _locateSavedQuery(currentQuery);
    }
  }, 80);

  _setupMapPickerAutocomplete();
}

// Bản đồ đã lưu dạng CHỮ (gõ rồi dùng luôn, hoặc XuXi điền): tra để mở sẵn đúng chỗ
// và cắm ghim. Chỉ để NHÌN — không đặt _mapPickerSelected, không đổi ô tìm/tên, nên
// "Dùng vị trí này" mà không chỉnh gì thì link nhúng giữ nguyên chuỗi cũ.
async function _locateSavedQuery(q) {
  const map = _leafletMap;
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&accept-language=vi`,
      { headers: { "Accept-Language": "vi" } }
    );
    const r = (await res.json())[0];
    // Sheet đã đóng/mở lại, hoặc khách đã tự ghim/tìm trong lúc chờ → bỏ.
    if (!r || map !== _leafletMap || _mapPickerSelected || _leafletMarker) return;
    const lat = parseFloat(r.lat), lon = parseFloat(r.lon);
    map.setView([lat, lon], 16);
    _placeMarker(lat, lon);
  } catch (e) {}
}

// Công tắc <x-switch key="map-name"> dựng sẵn ở trạng thái BẬT → đồng bộ lại theo ô tên.
function _syncMapNameSwitch(on) {
  const btn = document.getElementById("vis-btn-map-name");
  const knob = document.getElementById("vis-knob-map-name");
  if (!btn || !knob) return;
  btn.setAttribute("aria-checked", String(on));
  btn.classList.toggle("bg-rose-400", on);
  btn.classList.toggle("bg-gray-300", !on);
  knob.classList.toggle("translate-x-6", on);
  knob.classList.toggle("translate-x-1", !on);
}

function _toggleMapDisplayName() {
  const input = document.getElementById("map-picker-display-name");
  if (!input) return;
  const willEnable = input.disabled;
  input.disabled = !willEnable;
  _syncMapNameSwitch(willEnable);
  const note = document.getElementById("map-picker-name-note");
  if (note) note.textContent = willEnable ? "Khách sẽ thấy đúng dòng này trên thiệp." : "Tự lấy theo vị trí đã ghim.";
  if (willEnable) input.focus();
}

// Nút "x" trong ô: bắn `input` để ô tìm dọn luôn gợi ý cũ. Ẩn/hiện do CSS
// (.cx-mp-clear ở _common.css) theo :placeholder-shown / :disabled.
function _clearMapInput(id) {
  const input = document.getElementById(id);
  if (!input || input.disabled) return;
  input.value = "";
  input.focus();
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function _setupMapPickerAutocomplete() {
  const input = document.getElementById("map-picker-search");
  if (!input) return;
  let debounceTimer = null;
  input.addEventListener("input", () => {
    _mapPickerSelected = null;
    clearTimeout(debounceTimer);
    const q = input.value.trim();
    if (q.length < 2) { _clearMapSuggestions(); return; }
    // Nominatim chặn khi gọi dồn (~1 lượt/giây) → chờ khách ngừng gõ 2s mới hỏi gợi ý.
    debounceTimer = setTimeout(() => _fetchMapSuggestions(q), 2000);
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); clearTimeout(debounceTimer); _clearMapSuggestions(); searchMapPicker(); }
    if (e.key === "Escape") _clearMapSuggestions();
  });
  document.addEventListener("click", _onClickOutsideSuggestions);
}

function _onClickOutsideSuggestions(e) {
  const wrap = document.getElementById("map-picker-search-wrap");
  if (wrap && !wrap.contains(e.target)) _clearMapSuggestions();
}

async function _fetchMapSuggestions(q) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=6&addressdetails=0&accept-language=vi`,
      { headers: { "Accept-Language": "vi" } }
    );
    const data = await res.json();
    // Ô tìm đã đổi trong lúc chờ → kết quả này không còn khớp.
    if (document.getElementById("map-picker-search")?.value.trim() !== q) return;
    _mapSuggestions = data;
    _renderMapSuggestions(data, q);
  } catch (e) {
    _renderMapSuggestions(null, q);
  }
}

// `results` null = lỗi mạng; mảng rỗng = không có chỗ nào khớp.
function _renderMapSuggestions(results, q) {
  const dropdown = document.getElementById("map-picker-suggestions");
  if (!dropdown) return;
  dropdown.classList.remove("hidden");
  if (!results || !results.length) {
    dropdown.innerHTML = `<p class="px-4 py-3 text-sm text-gray-500">${
      results ? `Không thấy “${escapeHtml(q)}”. Thử thêm tên đường hoặc quận.` : "Không tải được gợi ý. Kiểm tra mạng rồi thử lại."
    }</p>`;
    return;
  }
  dropdown.innerHTML = results.map((r, i) => {
    const [head, ...rest] = String(r.display_name).split(",");
    return `
    <button type="button" role="option" onclick="_selectMapSuggestion(${i})" class="cx-mp-sug">
      <i data-lucide="map-pin" class="mt-0.5 flex-shrink-0 text-rose-400" style="width:16px;height:16px"></i>
      <span class="min-w-0">
        <span class="block truncate text-sm font-medium text-gray-800">${escapeHtml(head.trim())}</span>
        ${rest.length ? `<span class="block truncate text-xs text-gray-500">${escapeHtml(rest.join(",").trim())}</span>` : ""}
      </span>
    </button>`;
  }).join("");
  window.lucide?.createIcons({ root: dropdown });
}

function _selectMapSuggestion(index) {
  const s = _mapSuggestions[index];
  if (!s) return;
  const input = document.getElementById("map-picker-search");
  if (input) input.value = s.display_name;
  _syncDisplayName(s.display_name);
  _mapPickerSelected = { lat: parseFloat(s.lat), lon: parseFloat(s.lon), name: s.display_name };
  _clearMapSuggestions();
  _showGmap(s.display_name);
  if (_leafletMap) {
    _leafletMap.setView([s.lat, s.lon], 15);
    _placeMarker(parseFloat(s.lat), parseFloat(s.lon));
  }
}

function _clearMapSuggestions() {
  const dropdown = document.getElementById("map-picker-suggestions");
  if (dropdown) { dropdown.innerHTML = ""; dropdown.classList.add("hidden"); }
}

// Tìm theo chữ khách gõ: lớp Google phủ lên theo ĐÚNG chữ đó (Google tìm tốt hơn OSM, và
// đó là thứ thiệp sẽ hiện), còn OSM phía dưới dời tới kết quả của Nominatim để khách gỡ
// lớp phủ ra ghim tay thì đã ở gần đúng chỗ.
async function searchMapPicker() {
  const input = document.getElementById("map-picker-search");
  if (!input) return;
  const q = input.value.trim();
  if (!q) return;
  _showGmap(q);
  _syncDisplayName(q);
  if (!_leafletMap) return;
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&accept-language=vi`,
      { headers: { "Accept-Language": "vi" } }
    );
    const results = await res.json();
    if (results.length) {
      const r = results[0];
      const lat = parseFloat(r.lat), lon = parseFloat(r.lon);
      _leafletMap.setView([lat, lon], 15);
      _placeMarker(lat, lon);
      _mapPickerSelected = { lat, lon, name: q };
    }
  } catch (e) {}
}

// Lớp Google Maps nhúng theo TÊN phủ trên bản đồ OSM, như khung bản đồ ở khung chat XuXi.
// Còn lớp này thì "Dùng vị trí này" nhúng theo tên; gỡ đi để ghim tay trên OSM mới nhúng
// theo toạ độ. `q` rỗng = gỡ lớp phủ.
function _showGmap(q) {
  _mapPickerGmap = String(q || "").trim();
  const wrap = document.getElementById("map-picker-gmap");
  if (!wrap) return;
  wrap.hidden = !_mapPickerGmap;
  const frame = wrap.querySelector("iframe");
  const url = _mapPickerGmap ? cxMapEmbed(_mapPickerGmap) : "";
  if (url && frame.getAttribute("src") !== url) frame.src = url;
}

function _pinOnOsm() {
  _showGmap("");
  _leafletMap?.invalidateSize();
}

// Link nhúng Google Maps — chỗ DUY NHẤT dựng link này. `q`: chuỗi địa chỉ hoặc {lat, lon}.
function cxMapEmbed(q) {
  const v = q && typeof q === "object"
    ? `${q.lat},${q.lon}`
    : encodeURIComponent(String(q || "").trim());
  return `https://maps.google.com/maps?q=${v}&output=embed&hl=vi`;
}

// Ô <input> thật của trường `name` — [name=X] khớp <x-input> bọc ngoài trước.
function _mapFieldInput(name) {
  let el = document.querySelector(`[name="${name}"]`);
  if (el && el.tagName === "X-INPUT") el = el.querySelector("input, textarea") || el;
  return el;
}

// Ghi bản đồ của một địa điểm vào form Thiết lập — chỗ DUY NHẤT, cho cả bảng chọn ở form
// lẫn khung chat XuXi: link nhúng, ô hiển thị, và tên vào ô `*_location`. Chỉ nhận link
// Google Maps vì nó thành src của iframe trên thiệp.
function cxApplyMap(side, embed, name) {
  if (!/^https:\/\/maps\.google\.com\/maps\?/.test(String(embed || ""))) return;
  const hidden = document.getElementById(`${side}_map_embed_url`);
  if (!hidden) return;
  hidden.value = embed;
  hidden.dispatchEvent(new Event("input", { bubbles: true }));
  const loc = _mapFieldInput(`${side}_location`);
  if (name && loc) {
    loc.value = name;
    // Phát "input" để x-input đồng bộ nút xoá và autosave (form nghe input) lưu địa chỉ → F5 khôi phục đúng
    loc.dispatchEvent(new Event("input", { bubbles: true }));
  }
  _updateMapDisplay(side, embed, name || String(loc?.value || "").trim());
  // Tiệc đang bật "cùng địa điểm" thì đồng bộ lại theo nơi vừa đổi (16-ceremony.js).
  window._onLocationSourceChanged?.(side);
}

// Ô địa điểm của form tự ghim bản đồ theo CHỮ khách gõ, như khung chat XuXi: bản đồ đang
// trống hoặc cũng là bản theo chữ thì ghim lại theo chữ mới; đã ghim toạ độ ở bảng chọn
// thì giữ toạ độ, chỉ đổi tên hiện.
function cxAutoPinMap(side, addr) {
  const hidden = document.getElementById(`${side}_map_embed_url`);
  const name = String(addr || "").trim();
  if (!hidden || !name) return;
  const byCoords = /[?&]q=-?\d+(\.\d+)?,-?\d+(\.\d+)?(&|$)/.test(hidden.value);
  const embed = byCoords ? hidden.value : cxMapEmbed(name);
  if (embed !== hidden.value) {
    hidden.value = embed;
    hidden.dispatchEvent(new Event("input", { bubbles: true }));
  }
  _updateMapDisplay(side, embed, name);
  window._onLocationSourceChanged?.(side);
}

function applyMapPicker(side) {
  const searchInput = document.getElementById("map-picker-search");
  const displayNameInput = document.getElementById("map-picker-display-name");
  const displayName = (displayNameInput ? displayNameInput.value.trim() : "") ||
                      (_mapPickerSelected ? _mapPickerSelected.name : "") ||
                      (searchInput ? searchInput.value.trim() : "");
  const q = searchInput ? searchInput.value.trim() : "";
  const picked = !!(q || _mapPickerSelected || _mapPickerGmap);
  // Đang phủ Google → nhúng đúng cái khách đang nhìn (theo tên); không thì theo ghim OSM.
  const embedUrl = cxMapEmbed(_mapPickerGmap || _mapPickerSelected || q);
  // Lấy callback TRƯỚC khi đóng — đóng là xoá opts. Không có thì ghi thẳng vào form.
  const done = _mapPickerOpts ? _mapPickerOpts.onApply : (e, n) => cxApplyMap(side, e, n);
  closeMapPicker();
  if (picked) done(embedUrl, displayName);
}

function closeMapPicker() {
  if (typeof window._closeMapPickerSheet === 'function') window._closeMapPickerSheet();
}

function _updateMapDisplay(side, embedUrl, displayName) {
  const display = document.getElementById(`${side}-map-display`);
  const addressEl = document.getElementById(`${side}-map-address`);
  if (!display || !addressEl) return;
  if (!embedUrl) {
    display.classList.add("hidden"); display.classList.remove("flex");
    addressEl.textContent = "";
    _syncMapFrame(side, "");
    return;
  }
  let name = displayName;
  if (!name) {
    try {
      const m = embedUrl.match(/[?&]q=([^&]+)/);
      if (m) name = decodeURIComponent(m[1].replace(/\+/g, " "));
    } catch (e) {}
  }
  addressEl.textContent = name || embedUrl;
  display.classList.remove("hidden"); display.classList.add("flex");
  _syncMapFrame(side, embedUrl);
}

// Khung xem bản đồ ngay dưới dòng địa điểm đã ghim của form Thiết lập: dựng lần đầu
// cần tới, ẩn/hiện cùng dòng đó. `embed` bỏ trống thì đọc ô ẩn `${side}_map_embed_url`
// (16-ceremony.js gọi vậy khi tiệc "trùng địa điểm" chép bản đồ của lễ sang).
function _syncMapFrame(side, embed) {
  const display = document.getElementById(`${side}-map-display`);
  if (!display) return;
  const url = embed ?? (document.getElementById(`${side}_map_embed_url`)?.value || "");
  const show = !!url && !display.classList.contains("hidden");
  let frame = document.getElementById(`${side}-map-frame`);
  if (!frame && !show) return;
  if (!frame) {
    frame = document.createElement("iframe");
    frame.id = `${side}-map-frame`;
    frame.className = "mt-2 block h-40 w-full rounded-lg border border-gray-100";
    frame.loading = "lazy";
    frame.referrerPolicy = "no-referrer-when-downgrade";
    frame.title = "Bản đồ";
    display.insertAdjacentElement("afterend", frame);
  }
  frame.classList.toggle("hidden", !show);
  if (show && frame.getAttribute("src") !== url) frame.src = url;
}

function clearMapAddress(side) {
  const hidden = document.getElementById(`${side}_map_embed_url`);
  if (hidden) hidden.value = "";
  _updateMapDisplay(side, "");
  window._onLocationSourceChanged?.(side);
}

function initMapDisplays(data) {
  ["ceremony", "vu_quy", "groom_party", "bride_party"].forEach((side) => {
    const val = data && data[`${side}_map_embed_url`];
    // Dùng địa chỉ đã lưu (..._location) làm tên hiển thị, tránh tag hiện tọa độ (q=lat,lon) sau F5
    const displayName = data && data[`${side}_location`];
    if (val) _updateMapDisplay(side, val, displayName);
  });
}

window.openMapPicker = openMapPicker;
window.searchMapPicker = searchMapPicker;
window.applyMapPicker = applyMapPicker;
window.cxMapEmbed = cxMapEmbed;
window.cxApplyMap = cxApplyMap;
window.cxAutoPinMap = cxAutoPinMap;
window.closeMapPicker = closeMapPicker;
window._selectMapSuggestion = _selectMapSuggestion;
window._toggleMapDisplayName = _toggleMapDisplayName;
window._clearMapInput = _clearMapInput;
window._pinOnOsm = _pinOnOsm;
window.clearMapAddress = clearMapAddress;
window.initMapDisplays = initMapDisplays;
