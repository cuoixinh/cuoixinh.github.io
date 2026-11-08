// Bảng chọn địa điểm (Leaflet/OSM) dùng CHUNG cho form trang Thiết lập và ô bản đồ trong
// khung chat XuXi (js/ai-chat-media.js, tự nạp file này + Leaflet + core/utils.js ở trang
// chủ). Bảng CHỈ để ghim toạ độ — tìm theo chữ là việc của Google ở ô "Vị trí trên bản đồ"
// ngoài form, tên hiện trên thiệp cũng sửa ở ngoài. Cần openBottomSheet/escapeHtml và Leaflet.
let _mapPickerSelected = null; // {lat, lon} điểm đang ghim
let _leafletMap = null;
let _leafletMarker = null;
let _mapPickerOpts = null; // {onApply} khi bên gọi tự lưu kết quả (khung chat), null = form

function _markerIcon() {
  return L.divIcon({
    className: "",
    html: '<span class="cx-mp-pin"><span class="cx-mp-pin-head"></span><span class="cx-mp-pin-shadow"></span></span>',
    iconSize: [32, 40],
    iconAnchor: [16, 36],
  });
}

// Ghi điểm ghim + vẽ lại chip trạng thái, toạ độ và nút áp dụng; ghim rơi lại một nhịp.
function _setPin(lat, lon) {
  _mapPickerSelected = { lat, lon };
  _mpSync();
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
      _setPin(p.lat, p.lng);
    });
  }
  _setPin(lat, lon);
}

function _mpSync() {
  const p = _mapPickerSelected;
  const hint = document.getElementById("map-picker-hint");
  if (hint) {
    const [ic, txt] = p
      ? ["circle-check", `${p.lat.toFixed(5)}, ${p.lon.toFixed(5)} · kéo ghim để chỉnh`]
      : ["pointer", "Chạm vào bản đồ để ghim vị trí"];
    hint.classList.toggle("is-set", !!p);
    hint.innerHTML = `<i data-lucide="${ic}" style="width:14px;height:14px"></i><span>${txt}</span>`;
    window.lucide?.createIcons({ root: hint });
  }
  const apply = document.getElementById("map-picker-apply");
  if (apply) apply.disabled = !p;
}

// opts.onApply(embedUrl, displayName): trả kết quả cho bên gọi thay vì ghi vào form; khi đó
// giá trị đang có lấy từ opts.embed / opts.name, và opts.query (địa chỉ gợi ý) chỉ để dời
// bản đồ tới gần chỗ đó khi mở.
function openMapPicker(side, opts = {}) {
  if (document.getElementById("map-picker-modal")) return;
  _mapPickerSelected = null;
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
        initZoom = 16; hasCoords = true;
      } else {
        currentQuery = q;
      }
    }
  } catch (e) {}
  if (_mapPickerOpts && !currentVal && opts.query) currentQuery = String(opts.query);

  const sideLabelMap = { ceremony: "Lễ thành hôn", vu_quy: "Lễ vu quy", groom_party: "Tiệc nhà trai", bride_party: "Tiệc nhà gái", groom: "Nhà trai", bride: "Nhà gái" };
  const sideLabel = sideLabelMap[side] || side;

  const sheet = openBottomSheet({
    id: 'map-picker-modal',
    title: `<span class="cx-mp-title-ic"><i data-lucide="map-pin" style="width:16px;height:16px"></i></span>Ghim vị trí<span class="cx-mp-side">${escapeHtml(sideLabel)}</span>`,
    cardClass: 'sm:max-w-5xl',
    onClose: () => {
      if (_leafletMap) { _leafletMap.remove(); _leafletMap = null; _leafletMarker = null; }
      _mapPickerSelected = null;
      _mapPickerOpts = null;
      window._closeMapPickerSheet = null;
    },
  });
  if (!sheet) return;
  window._closeMapPickerSheet = sheet.close;

  // Bố cục ở .cx-mp (_common.css): bản đồ chiếm trọn thân sheet, dải nút ở đáy.
  sheet.body.innerHTML = `
    <div class="cx-mp">
      <div class="cx-mp-map">
        <div id="map-picker-map" class="h-full w-full"></div>
        <p id="map-picker-hint" class="cx-mp-hint"></p>
      </div>
      <div class="cx-mp-act">
        <x-button variant="outline" tone="neutral" onclick="closeMapPicker()" class="flex-1">Hủy</x-button>
        <x-button id="map-picker-apply" icon="locate-fixed" onclick="applyMapPicker('${side}')" class="flex-1">Dùng vị trí này</x-button>
      </div>
    </div>
  `;
  window.lucide?.createIcons({ root: sheet.body.closest(".cx-sheet-card") });
  _mpSync();

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

    if (hasCoords) _placeMarker(initLat, initLon);
    else if (currentQuery) _centerNear(currentQuery);

    _leafletMap.on("click", (e) => _placeMarker(e.latlng.lat, e.latlng.lng));
  }, 80);
}

// Bản đồ đang lưu dạng CHỮ: dời khung tới gần chỗ đó cho khách đỡ phải kéo từ toàn quốc.
// KHÔNG cắm ghim — kết quả của OSM có thể lệch với Google, ghim là việc khách tự chạm.
async function _centerNear(q) {
  const map = _leafletMap;
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&accept-language=vi`,
      { headers: { "Accept-Language": "vi" } }
    );
    const r = (await res.json())[0];
    // Sheet đã đóng/mở lại, hoặc khách đã tự ghim trong lúc chờ → bỏ.
    if (!r || map !== _leafletMap || _leafletMarker) return;
    map.setView([parseFloat(r.lat), parseFloat(r.lon)], 16);
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
// lẫn khung chat XuXi: link nhúng, ô vị trí + khung xem, và tên vào ô `*_location`. Chỉ nhận link
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
  _updateMapDisplay(side, embed);
  // Tiệc đang bật "cùng địa điểm" thì đồng bộ lại theo nơi vừa đổi (16-ceremony.js).
  window._onLocationSourceChanged?.(side);
}

// Ô "Vị trí trên bản đồ" (`${side}_map_query`, không có name nên không vào FormData):
// chuỗi toạ độ "lat, lon" / link Google Maps có toạ độ → nhúng theo toạ độ, còn lại nhúng
// theo chữ. Chỉ đổi bản đồ — tên hiện trên thiệp là ô `${side}_location` riêng.
function _cxParseMapQuery(text) {
  const t = String(text || "").trim();
  const m = t.match(/^(-?\d{1,3}(?:\.\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:\.\d+)?)$/) ||
            t.match(/[@=](-?\d{1,3}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)/);
  if (m) {
    const lat = parseFloat(m[1]), lon = parseFloat(m[2]);
    if (Math.abs(lat) <= 90 && Math.abs(lon) <= 180) return { lat, lon };
  }
  return t;
}

function cxMapFromQuery(side, text) {
  const hidden = document.getElementById(`${side}_map_embed_url`);
  if (!hidden) return;
  if (!String(text || "").trim()) { clearMapAddress(side); return; }
  const embed = cxMapEmbed(_cxParseMapQuery(text));
  if (embed !== hidden.value) {
    hidden.value = embed;
    hidden.dispatchEvent(new Event("input", { bubbles: true }));
  }
  _updateMapDisplay(side, embed);
  window._onLocationSourceChanged?.(side);
}

// Chuỗi hiện lại trong ô vị trí từ link nhúng đã lưu (toạ độ viết "lat, lon").
function _queryFromEmbed(embed) {
  try {
    const m = String(embed || "").match(/[?&]q=([^&]+)/);
    if (!m) return "";
    const q = decodeURIComponent(m[1].replace(/\+/g, " "));
    return q.replace(/^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/, "$1, $2");
  } catch (e) {
    return "";
  }
}

// Luôn nhúng theo TOẠ ĐỘ đã ghim. Tên không đổi: form giữ ô `*_location` (cxApplyMap bỏ qua
// tên rỗng), khung chat nhận lại đúng tên nó truyền vào.
function applyMapPicker(side) {
  const p = _mapPickerSelected;
  if (!p) return;
  const embedUrl = cxMapEmbed({ lat: +p.lat.toFixed(6), lon: +p.lon.toFixed(6) });
  const name = _mapPickerOpts ? String(_mapPickerOpts.name || _mapPickerOpts.query || "") : "";
  // Lấy callback TRƯỚC khi đóng — đóng là xoá opts. Không có thì ghi thẳng vào form.
  const done = _mapPickerOpts ? _mapPickerOpts.onApply : (e, n) => cxApplyMap(side, e, n);
  closeMapPicker();
  done(embedUrl, name);
}

function closeMapPicker() {
  if (typeof window._closeMapPickerSheet === 'function') window._closeMapPickerSheet();
}

// Đồng bộ ô vị trí + khung xem bản đồ theo link nhúng (rỗng = ẩn khung, xoá ô).
function _updateMapDisplay(side, embedUrl) {
  const display = document.getElementById(`${side}-map-display`);
  const q = document.getElementById(`${side}_map_query`);
  if (q && document.activeElement !== q) {
    q.value = embedUrl ? _queryFromEmbed(embedUrl) : "";
    q.closest("x-input")?.syncClearBtn?.();
  }
  if (!display) return;
  display.classList.toggle("hidden", !embedUrl);
  _syncMapFrame(side, embedUrl || "");
}

// Vẽ lại ô vị trí + khung bản đồ theo ô ẩn đang giữ (16-ceremony.js gọi khi chép "trùng địa điểm").
function cxRefreshMapField(side) {
  _updateMapDisplay(side, document.getElementById(`${side}_map_embed_url`)?.value || "");
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
    if (val) _updateMapDisplay(side, val);
  });
}

// Bảng "Hướng dẫn lấy tọa độ" (nút dưới ô Vị trí trên bản đồ của form Thiết lập): cách chép
// toạ độ trên Google Maps, hai tab Điện thoại / Máy tính, mở sẵn tab theo loại màn hình.
const _CX_COORD_STEPS = {
  phone: [
    "Mở ứng dụng <b>Google Maps</b>, tìm tới đúng chỗ tổ chức.",
    "<b>Chạm và giữ</b> vào vị trí đó đến khi hiện ghim đỏ.",
    "Android: tọa độ hiện ngay ở ô tìm kiếm phía trên. iPhone: vuốt thẻ thông tin ở dưới lên, tọa độ nằm trong thẻ.",
    "Chạm vào dãy số để sao chép, rồi dán vào ô <b>Vị trí trên bản đồ</b>.",
  ],
  desktop: [
    'Mở <a href="https://www.google.com/maps" target="_blank" rel="noopener">google.com/maps</a>, tìm tới đúng chỗ tổ chức.',
    "<b>Nhấp chuột phải</b> vào vị trí đó.",
    "Dòng đầu tiên trong menu là tọa độ, nhấp vào là đã sao chép.",
    "Dán (<b>Ctrl+V</b>) vào ô <b>Vị trí trên bản đồ</b>.",
  ],
};

function openCoordGuide() {
  const sheet = openBottomSheet({
    id: "coord-guide-modal",
    title: `<span class="cx-mp-title-ic"><i data-lucide="locate-fixed" style="width:16px;height:16px"></i></span>Lấy tọa độ trên Google Maps`,
    height: "80",
    cardClass: "cx-sheet-fit sm:max-w-md",
    onClose: () => { window._closeCoordGuide = null; },
  });
  if (!sheet) return;
  window._closeCoordGuide = sheet.close;
  const touch = window.matchMedia?.("(pointer: coarse)").matches;
  sheet.body.innerHTML = `
    <div class="cx-cg">
      <div class="cx-seg" style="--n:2;--i:${touch ? 0 : 1}" role="tablist" aria-label="Thiết bị">
        <button type="button" role="tab" class="cx-seg-btn" data-tab="phone"><i data-lucide="smartphone" style="width:14px;height:14px"></i>Điện thoại</button>
        <button type="button" role="tab" class="cx-seg-btn" data-tab="desktop"><i data-lucide="monitor" style="width:14px;height:14px"></i>Máy tính</button>
      </div>
      <ol class="cx-cg-steps"></ol>
      <div class="cx-cg-tip">
        <p>Tọa độ là hai số cách nhau dấu phẩy, ví dụ <b>10.7798, 106.6990</b>.</p>
        <p>Link chia sẻ rút gọn (<b>maps.app.goo.gl/…</b>) không dùng được, hãy chép dãy số.</p>
      </div>
    </div>
    <div class="cx-mp-act">
      <x-button onclick="window._closeCoordGuide?.()" class="flex-1">Đã hiểu</x-button>
    </div>`;

  const seg = sheet.body.querySelector(".cx-seg");
  const list = sheet.body.querySelector(".cx-cg-steps");
  const show = (tab) => {
    const btns = [...seg.querySelectorAll(".cx-seg-btn")];
    btns.forEach((b, i) => {
      const on = b.dataset.tab === tab;
      b.classList.toggle("is-on", on);
      b.setAttribute("aria-selected", String(on));
      if (on) seg.style.setProperty("--i", i);
    });
    list.innerHTML = _CX_COORD_STEPS[tab].map((t) => `<li>${t}</li>`).join("");
  };
  seg.addEventListener("click", (e) => {
    const b = e.target.closest(".cx-seg-btn");
    if (b) show(b.dataset.tab);
  });
  show(touch ? "phone" : "desktop");
  window.lucide?.createIcons({ root: sheet.body.closest(".cx-sheet-card") });
}

window.openCoordGuide = openCoordGuide;
window.openMapPicker = openMapPicker;
window.applyMapPicker = applyMapPicker;
window.cxMapEmbed = cxMapEmbed;
window.cxApplyMap = cxApplyMap;
window.cxMapFromQuery = cxMapFromQuery;
window.cxRefreshMapField = cxRefreshMapField;
window.closeMapPicker = closeMapPicker;
window.clearMapAddress = clearMapAddress;
window.initMapDisplays = initMapDisplays;
