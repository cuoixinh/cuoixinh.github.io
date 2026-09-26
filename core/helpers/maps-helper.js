// Bảng chọn địa điểm (Leaflet + Nominatim) dùng CHUNG cho form trang Thiết lập và ô bản đồ
// trong khung chat XuXi (js/ai-chat-media.js, tự nạp file này + Leaflet + core/utils.js
// ở trang chủ). Cần openBottomSheet/escapeHtml (core/utils.js) và Leaflet.
let _mapPickerSelected = null;
let _mapSuggestions = [];
let _leafletMap = null;
let _leafletMarker = null;
let _mapPickerOpts = null; // {onApply} khi bên gọi tự lưu kết quả (khung chat), null = form

function _markerIcon() {
  return L.divIcon({
    className: "",
    html: `<svg width="28" height="36" viewBox="0 0 28 36" xmlns="http://www.w3.org/2000/svg">
      <path d="M14 0C6.268 0 0 6.268 0 14c0 9.333 14 22 14 22S28 23.333 28 14C28 6.268 21.732 0 14 0z" fill="var(--primary,rgb(var(--action-primary-rgb)))"/>
      <circle cx="14" cy="14" r="5.5" fill="white"/>
    </svg>`,
    iconSize: [28, 36],
    iconAnchor: [14, 36],
  });
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
    });
  }
}

async function _reverseGeocode(lat, lon) {
  _mapPickerSelected = { lat, lon, name: `${lat.toFixed(5)}, ${lon.toFixed(5)}` };
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=vi`,
      { headers: { "Accept-Language": "vi" } }
    );
    const data = await res.json();
    if (data.display_name) {
      _mapPickerSelected.name = data.display_name;
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
    title: `<svg class="w-4 h-4 text-color-secondary flex-shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>Chọn địa điểm — ${sideLabel}`,
    height: '80vh',
    onClose: () => {
      document.removeEventListener("click", _onClickOutsideSuggestions);
      if (_leafletMap) { _leafletMap.remove(); _leafletMap = null; _leafletMarker = null; }
      _mapPickerSelected = null;
      _mapSuggestions = [];
      _mapPickerOpts = null;
      window._closeMapPickerSheet = null;
    },
  });
  if (!sheet) return;
  window._closeMapPickerSheet = sheet.close;

  sheet.body.innerHTML = `
    <div id="map-picker-search-wrap" class="px-4 py-3 border-b border-gray-100 flex gap-2 flex-shrink-0">
      <div class="relative flex-1">
        <input id="map-picker-search" type="text" value="${currentQuery.replace(/"/g, '&quot;')}"
          placeholder="Tìm kiếm địa điểm..."
          autocomplete="off"
          class="w-full h-10 px-3 border border-gray-200 rounded-lg text-sm text-gray-800 outline-none focus:ring-2 focus:ring-rose-500/30 focus:ring-offset-1"
        />
        <div id="map-picker-suggestions" class="hidden fixed bg-white border border-gray-200 rounded-xl shadow-lg z-[99999] max-h-52 overflow-y-auto"></div>
      </div>
      <x-button variant="soft" onclick="searchMapPicker()" class="text-color-secondary flex-shrink-0">
        <svg class="w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>Tìm
      </x-button>
    </div>
    <div class="flex-1 min-h-0 relative">
      <div id="map-picker-map" style="width:100%;height:100%;"></div>
      <p class="absolute top-2 left-1/2 -translate-x-1/2 z-[999] bg-white/80 backdrop-blur-sm text-xs text-gray-500 px-3 py-1 rounded-full shadow-sm pointer-events-none whitespace-nowrap">Nhấp vào bản đồ hoặc kéo ghim để chọn vị trí</p>
    </div>
  `;
  sheet.footer.innerHTML = `
    <div class="px-4 pt-3 pb-2 border-t border-gray-100">
      <div class="flex items-center justify-between mb-1.5">
        <label class="text-sm font-medium text-gray-700">Tên hiển thị trên thiệp</label>
        <div class="flex items-center gap-1.5">
          <span class="text-xs text-gray-400">Sửa tên</span>
          <x-button variant="ghost" tone="neutral" size="xs" type="button" id="map-display-name-toggle" onclick="_toggleMapDisplayName()" class="relative flex-shrink-0 w-9">
            <span id="map-display-name-knob" class="inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform duration-200 translate-x-0.5"></span>
          </x-button>
        </div>
      </div>
      <input id="map-picker-display-name" type="text" disabled value="${currentDisplayName.replace(/"/g, '&quot;')}"
        placeholder="Chọn vị trí trên bản đồ để điền tự động..."
        class="w-full h-10 px-3 border border-gray-200 rounded-lg text-sm text-gray-800 outline-none bg-gray-50 opacity-60 cursor-not-allowed transition-all"
      />
    </div>
    <div class="px-4 pb-3 flex gap-2">
      <x-button variant="outline" tone="neutral" onclick="closeMapPicker()" class="flex-1">Hủy</x-button>
      <x-button onclick="applyMapPicker('${side}')" class="flex-1">
        <svg class="w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>Dùng vị trí này
      </x-button>
    </div>
  `;

  setTimeout(() => {
    if (typeof L === "undefined") return;
    _leafletMap = L.map("map-picker-map", { zoomControl: true }).setView([initLat, initLon], initZoom);
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
  }, 80);

  _setupMapPickerAutocomplete();
}

function _toggleMapDisplayName() {
  const input = document.getElementById("map-picker-display-name");
  const btn = document.getElementById("map-display-name-toggle");
  const knob = document.getElementById("map-display-name-knob");
  if (!input || !btn || !knob) return;
  const willEnable = input.disabled;
  input.disabled = !willEnable;
  if (willEnable) {
    btn.classList.replace("bg-gray-300", "bg-rose-400");
    knob.classList.replace("translate-x-0.5", "translate-x-[18px]");
    input.classList.remove("opacity-60", "cursor-not-allowed", "bg-gray-50");
    input.classList.add("focus:ring-2", "focus:ring-rose-500/30");
    input.focus();
  } else {
    btn.classList.replace("bg-rose-400", "bg-gray-300");
    knob.classList.replace("translate-x-[18px]", "translate-x-0.5");
    input.classList.add("opacity-60", "cursor-not-allowed", "bg-gray-50");
  }
}

function _positionMapSuggestions() {
  const input = document.getElementById("map-picker-search");
  const dropdown = document.getElementById("map-picker-suggestions");
  if (!input || !dropdown) return;
  const rect = input.getBoundingClientRect();
  dropdown.style.top = `${rect.bottom + 4}px`;
  dropdown.style.left = `${rect.left}px`;
  dropdown.style.width = `${rect.width}px`;
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
    debounceTimer = setTimeout(() => _fetchMapSuggestions(q), 350);
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); _clearMapSuggestions(); searchMapPicker(); }
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
    _mapSuggestions = data;
    _renderMapSuggestions(data);
  } catch (e) { _clearMapSuggestions(); }
}

function _renderMapSuggestions(results) {
  const dropdown = document.getElementById("map-picker-suggestions");
  if (!dropdown) return;
  if (!results.length) { dropdown.innerHTML = ""; dropdown.classList.add("hidden"); return; }
  _positionMapSuggestions();
  dropdown.classList.remove("hidden");
  dropdown.innerHTML = results.map((r, i) => `
    <button type="button" onclick="_selectMapSuggestion(${i})"
      class="w-full text-left px-3 py-2.5 text-sm text-gray-700 hover:bg-rose-50 flex items-start gap-2 border-b border-gray-100 last:border-0 transition-colors">
      <svg class="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-rose-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>
      </svg>
      <span class="line-clamp-2">${escapeHtml(r.display_name)}</span>
    </button>`).join("");
}

function _selectMapSuggestion(index) {
  const s = _mapSuggestions[index];
  if (!s) return;
  const input = document.getElementById("map-picker-search");
  if (input) input.value = s.display_name;
  _syncDisplayName(s.display_name);
  _mapPickerSelected = { lat: parseFloat(s.lat), lon: parseFloat(s.lon), name: s.display_name };
  _clearMapSuggestions();
  if (_leafletMap) {
    _leafletMap.setView([s.lat, s.lon], 15);
    _placeMarker(parseFloat(s.lat), parseFloat(s.lon));
  }
}

function _clearMapSuggestions() {
  const dropdown = document.getElementById("map-picker-suggestions");
  if (dropdown) { dropdown.innerHTML = ""; dropdown.classList.add("hidden"); }
}

async function searchMapPicker() {
  const input = document.getElementById("map-picker-search");
  if (!input || !_leafletMap) return;
  const q = input.value.trim();
  if (!q) return;
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
      _mapPickerSelected = { lat, lon, name: r.display_name };
      input.value = r.display_name;
      _syncDisplayName(r.display_name);
    }
  } catch (e) {}
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

function applyMapPicker(side) {
  const searchInput = document.getElementById("map-picker-search");
  const displayNameInput = document.getElementById("map-picker-display-name");
  const displayName = (displayNameInput ? displayNameInput.value.trim() : "") ||
                      (_mapPickerSelected ? _mapPickerSelected.name : "") ||
                      (searchInput ? searchInput.value.trim() : "");
  const q = searchInput ? searchInput.value.trim() : "";
  const picked = !!(q || _mapPickerSelected);
  const embedUrl = cxMapEmbed(_mapPickerSelected || q);
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
window.closeMapPicker = closeMapPicker;
window._selectMapSuggestion = _selectMapSuggestion;
window._toggleMapDisplayName = _toggleMapDisplayName;
window.clearMapAddress = clearMapAddress;
window.initMapDisplays = initMapDisplays;
