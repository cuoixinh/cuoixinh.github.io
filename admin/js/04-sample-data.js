// ============= TAB "Dữ liệu mẫu": phần NỘI DUNG (chữ) =============
// 03-sample-images.js lo ẢNH; file này lo CHỮ: tên cô dâu/chú rể, gia đình,
// ngày giờ, địa điểm, lịch trình, lời ngỏ, ngân hàng, bật/tắt từng khối…
// Tất cả nằm chung data.json của theme dưới khoá "content"; trang thiệp đọc
// qua public/themes/preview-data.js và đắp lên bộ data preview mặc định
// (field nào bỏ trống thì giữ giá trị mặc định cũ).
//
// Nạp SAU 03-sample-images.js (xem loader.js): dùng siData / siMarkDirty /
// escapeHtml khai báo ở file đó — chỉ tham chiếu trong thân hàm nên lúc chạy
// mọi script đã nạp xong.

const SI_MAX_TIMELINE = 10;

const SI_TIMELINE_TYPES = [
  { value: "ceremony", label: "Lễ thành hôn" },
  { value: "party", label: "Tiệc nhà trai" },
  { value: "bride-party", label: "Tiệc nhà gái" },
];

// Mỗi field: name khớp ĐÚNG tên cột dữ liệu thiệp (xem preview-data.js) để
// preview chỉ cần Object.assign là xong.
const SI_CONTENT_GROUPS = [
  {
    title: "Cô dâu & chú rể",
    icon: "fa-heart",
    fields: [
      { name: "groom_name", label: "Tên chú rể", type: "text" },
      { name: "bride_name", label: "Tên cô dâu", type: "text" },
      { name: "groom_father", label: "Bố chú rể", type: "text" },
      { name: "groom_mother", label: "Mẹ chú rể", type: "text" },
      { name: "groom_address", label: "Địa chỉ nhà trai", type: "text", wide: true },
      { name: "bride_father", label: "Bố cô dâu", type: "text" },
      { name: "bride_mother", label: "Mẹ cô dâu", type: "text" },
      { name: "bride_address", label: "Địa chỉ nhà gái", type: "text", wide: true },
    ],
  },
  {
    title: "Lễ thành hôn",
    icon: "fa-ring",
    fields: [
      { name: "ceremony_name", label: "Tên buổi lễ", type: "text" },
      { name: "ceremony_date", label: "Ngày", type: "date", lunar: "ceremony_lunar" },
      { name: "ceremony_time", label: "Giờ", type: "time" },
      { name: "ceremony_lunar", label: "Ngày âm (tự tính theo ngày dương)", type: "text" },
      { name: "ceremony_location", label: "Địa điểm", type: "text", wide: true },
      { name: "ceremony_map_embed_url", label: "Google Maps embed URL", type: "map", wide: true },
    ],
  },
  {
    title: "Lễ vu quy",
    icon: "fa-house-chimney",
    fields: [
      { name: "vu_quy_enabled", label: "Hiện lễ vu quy", type: "switch" },
      { name: "vu_quy_time", label: "Giờ", type: "time" },
      { name: "vu_quy_location", label: "Địa điểm", type: "text", wide: true },
      { name: "vu_quy_map_embed_url", label: "Google Maps embed URL", type: "map", wide: true },
    ],
  },
  {
    title: "Tiệc nhà trai",
    icon: "fa-champagne-glasses",
    sameLoc: "groom_party", // ô tích "Trùng địa điểm ..." — xem siRenderSameLocRow
    fields: [
      { name: "groom_party_date", label: "Ngày", type: "date", lunar: "groom_party_lunar" },
      { name: "groom_party_time", label: "Giờ", type: "time" },
      { name: "groom_party_lunar", label: "Ngày âm (tự tính)", type: "text" },
      { name: "groom_party_show_location", label: "Hiện địa điểm", type: "switch" },
      { name: "groom_party_location", label: "Địa điểm", type: "text", wide: true },
      { name: "groom_party_map_embed_url", label: "Google Maps embed URL", type: "map", wide: true },
    ],
  },
  {
    title: "Tiệc nhà gái",
    icon: "fa-champagne-glasses",
    sameLoc: "bride_party",
    fields: [
      { name: "bride_party_date", label: "Ngày", type: "date", lunar: "bride_party_lunar" },
      { name: "bride_party_time", label: "Giờ", type: "time" },
      { name: "bride_party_lunar", label: "Ngày âm (tự tính)", type: "text" },
      { name: "bride_party_show_location", label: "Hiện địa điểm", type: "switch" },
      { name: "bride_party_location", label: "Địa điểm", type: "text", wide: true },
      { name: "bride_party_map_embed_url", label: "Google Maps embed URL", type: "map", wide: true },
    ],
  },
  {
    title: "Mừng cưới",
    icon: "fa-qrcode",
    fields: [
      { name: "groom_bank_name", label: "Ngân hàng chú rể", type: "text" },
      { name: "groom_bank_number", label: "Số tài khoản chú rể", type: "text" },
      { name: "groom_bank_owner", label: "Chủ tài khoản chú rể", type: "text" },
      { name: "bride_bank_name", label: "Ngân hàng cô dâu", type: "text" },
      { name: "bride_bank_number", label: "Số tài khoản cô dâu", type: "text" },
      { name: "bride_bank_owner", label: "Chủ tài khoản cô dâu", type: "text" },
    ],
  },
  {
    title: "Lời ngỏ & lời cảm ơn",
    icon: "fa-feather",
    fields: [
      { name: "story_quote", label: "Lời ngỏ / slogan", type: "textarea", wide: true },
      { name: "rsvp_enabled", label: "Bật xác nhận tham dự", type: "switch" },
      { name: "rsvp_message", label: "Lời mời xác nhận tham dự", type: "textarea", wide: true },
      { name: "footer_text", label: "Lời cảm ơn cuối thiệp", type: "textarea", wide: true },
      { name: "music_url", label: "Nhạc nền (YouTube)", type: "youtube", wide: true },
    ],
  },
  {
    title: "Hiện / ẩn khối",
    icon: "fa-eye",
    fields: [
      { name: "enable_family", label: "Gia đình", type: "switch" },
      { name: "enable_party", label: "Tiệc cưới", type: "switch" },
      { name: "enable_photos", label: "Album ảnh", type: "switch" },
      { name: "enable_timeline", label: "Lịch trình", type: "switch" },
      { name: "enable_love_story", label: "Chuyện tình yêu", type: "switch" },
      { name: "enable_music", label: "Nhạc nền", type: "switch" },
      { name: "enable_gift", label: "Mừng cưới", type: "switch" },
      { name: "enable_footer", label: "Lời cảm ơn", type: "switch" },
    ],
  },
];

const SI_CONTENT_FIELDS = SI_CONTENT_GROUPS.flatMap((g) => g.fields);
const SI_CONTENT_FIELD_BY_NAME = Object.fromEntries(
  SI_CONTENT_FIELDS.map((f) => [f.name, f]),
);

// Công tắc mặc định BẬT (khớp bộ preview đang hardcode ở preview-data.js).
const SI_CONTENT_DEFAULT_ON = SI_CONTENT_FIELDS.filter(
  (f) => f.type === "switch",
).map((f) => f.name);

// ============= State =============

function siContentDefaults() {
  const content = { timeline: [] };
  SI_CONTENT_DEFAULT_ON.forEach((name) => (content[name] = true));
  return content;
}

// data.json → state (đủ khoá, đúng kiểu). Field vắng mặt giữ giá trị mặc định.
function siNormalizeContent(raw) {
  const content = siContentDefaults();
  if (!raw || typeof raw !== "object") return content;

  SI_CONTENT_FIELDS.forEach((f) => {
    if (!(f.name in raw)) return;
    const v = raw[f.name];
    content[f.name] =
      f.type === "switch" ? v === true || v === "true" : String(v ?? "");
  });

  if (Array.isArray(raw.timeline)) {
    content.timeline = raw.timeline
      .slice(0, SI_MAX_TIMELINE)
      .map((i) => siNormalizeTimelineItem(i));
  }
  return content;
}

function siNormalizeTimelineItem(item) {
  const type = SI_TIMELINE_TYPES.some((t) => t.value === item?.type)
    ? item.type
    : "ceremony";
  return {
    time: String(item?.time || ""),
    title: String(item?.title || ""),
    type,
  };
}

// state → data.json: bỏ chữ rỗng cho gọn file (preview tự dùng mặc định), giữ
// nguyên mọi công tắc vì false cũng là một lựa chọn có ý nghĩa.
function siCollectContent() {
  const out = {};
  if (!siData?.content) return out;

  SI_CONTENT_FIELDS.forEach((f) => {
    const v = siData.content[f.name];
    if (f.type === "switch") {
      out[f.name] = v === true;
    } else if (String(v ?? "").trim()) {
      out[f.name] = String(v).trim();
    }
  });

  const timeline = (siData.content.timeline || [])
    .filter((i) => i.time?.trim() && i.title?.trim())
    .map((i) => ({ time: i.time.trim(), title: i.title.trim(), type: i.type }));
  if (timeline.length) out.timeline = timeline;

  return out;
}

// ============= Render form nội dung =============

// ============= "Trùng địa điểm" cho tiệc nhà trai / nhà gái =============
// Cùng luật với trang thiết lập thiệp (invitation-setup/js/16-ceremony.js):
// tiệc nhà TRAI lấy theo Lễ thành hôn; tiệc nhà GÁI lấy theo Lễ vu quy nếu vu
// quy đang bật, không thì cũng Lễ thành hôn.
//
// Không lưu ô tích vào data.json — cũng như bên thiết lập thiệp, nó chỉ là lối
// nhập nhanh; thứ ghi ra file luôn là địa điểm + link bản đồ đã giải ra. Mở lại
// thì suy ngược: ô "Địa điểm" của tiệc còn trống nghĩa là đang trùng.

const SI_PARTY_SIDES = ["groom_party", "bride_party"];
const SI_SOURCE_LABEL = { ceremony: "Lễ thành hôn", vu_quy: "Lễ vu quy" };

// src giữ chính object content đã suy ra, để biết khi nào cần suy lại (đổi
// theme, khôi phục bản nháp → content là object mới).
let siSameLoc = { src: null, groom_party: false, bride_party: false };

function siEnsureSameLoc() {
  const content = siData?.content;
  if (!content || siSameLoc.src === content) return;
  siSameLoc = {
    src: content,
    groom_party: !String(content.groom_party_location || "").trim(),
    bride_party: !String(content.bride_party_location || "").trim(),
  };
}

function siPartySource(side) {
  return side === "bride_party" && siData?.content?.vu_quy_enabled
    ? "vu_quy"
    : "ceremony";
}

// Ô nào đang bị khoá vì trùng địa điểm (không cho gõ / không cho chọn bản đồ).
function siIsFieldLocked(name) {
  const m = name.match(/^(groom_party|bride_party)_(location|map_embed_url)$/);
  return !!m && siSameLoc[m[1]] === true;
}

function siRenderSameLocRow(side) {
  const on = siSameLoc[side] === true;
  return `
    <label class="flex items-center gap-2 mb-3 text-sm text-gray-600 cursor-pointer">
      <input type="checkbox" ${on ? "checked" : ""}
        onchange="siTogglePartySameLoc('${side}', this.checked)"
        class="w-4 h-4 accent-rose-400 cursor-pointer" />
      Trùng địa điểm ${escapeHtml(SI_SOURCE_LABEL[siPartySource(side)])}
    </label>`;
}

// Chép địa điểm + link bản đồ từ nguồn sang tiệc đang bật "trùng".
// dom=true: đẩy luôn xuống ô đang hiển thị (dùng khi người dùng đang GÕ ở ô
// nguồn — render lại cả form giữa chừng sẽ mất con trỏ).
function siSyncSameLoc(side, dom) {
  if (siSameLoc[side] !== true || !siData?.content) return;
  const src = siPartySource(side);
  ["location", "map_embed_url"].forEach((suffix) => {
    const name = `${side}_${suffix}`;
    siData.content[name] = siData.content[`${src}_${suffix}`] || "";
    if (dom) {
      const el = document.querySelector(`[data-si-content="${name}"]`);
      if (el) el.value = siData.content[name];
    }
  });
  if (dom) siSyncMapAddress(side);
}

function siSyncAllSameLoc(dom) {
  SI_PARTY_SIDES.forEach((side) => siSyncSameLoc(side, dom));
}

function siTogglePartySameLoc(side, checked) {
  siEnsureSameLoc();
  siSameLoc[side] = checked;
  // Bật thì kéo địa điểm nguồn về ngay; tắt thì giữ nguyên giá trị đang có để
  // sửa tiếp (giống bên thiết lập thiệp, tắt chỉ là mở khoá).
  siSyncSameLoc(side, false);
  siRenderContentForm();
  siMarkDirty(true);
}

function siRenderContentForm() {
  const host = document.getElementById("si-content-fields");
  if (!host || !siData?.content) return;
  siEnsureSameLoc();
  siSyncAllSameLoc(false);
  // Ghi nhớ nhóm nào đang mở để render lại (sau khi AI điền) không bị đóng hết.
  const opened = new Set(
    [...host.querySelectorAll("details[open]")].map((d) => d.dataset.group),
  );
  host.innerHTML = SI_CONTENT_GROUPS.map((g, i) =>
    siRenderContentGroup(g, opened.size ? opened.has(g.title) : i === 0),
  ).join("");
  // Bài nhạc mới nạp từ data.json chỉ có URL → xin tên bài rồi vá vào tag.
  siYtEnsureTitle();
}

function siRenderContentGroup(group, open) {
  const switches = group.fields.filter((f) => f.type === "switch");
  const others = group.fields.filter((f) => f.type !== "switch");
  const body =
    (group.sameLoc ? siRenderSameLocRow(group.sameLoc) : "") +
    (switches.length
      ? `<div class="flex flex-wrap gap-x-6 gap-y-2 mb-3">${switches.map(siRenderContentField).join("")}</div>`
      : "") +
    (others.length
      ? `<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">${others.map(siRenderContentField).join("")}</div>`
      : "");

  return `
    <details class="border border-gray-200 rounded-xl" data-group="${escapeHtml(group.title)}" ${open ? "open" : ""}>
      <summary class="px-4 py-3 text-sm font-semibold text-gray-700 cursor-pointer select-none flex items-center gap-2">
        <i class="fas ${group.icon} text-rose-300"></i> ${escapeHtml(group.title)}
      </summary>
      <div class="px-4 pb-4">${body}</div>
    </details>`;
}

function siRenderContentField(field) {
  const value = siData.content[field.name];
  const inputClass =
    "w-full h-10 px-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-rose-300";

  if (field.type === "switch") {
    return `
      <label class="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
        <input type="checkbox" ${value ? "checked" : ""}
          onchange="siSetContent('${field.name}', this.checked)"
          class="w-4 h-4 accent-rose-400 cursor-pointer" />
        ${escapeHtml(field.label)}
      </label>`;
  }

  const wrapClass = field.wide ? "sm:col-span-2" : "";
  const label = `<label class="block text-xs text-gray-500 mb-1">${escapeHtml(field.label)}</label>`;

  if (field.type === "map") return siRenderMapField(field, value, wrapClass);

  if (field.type === "youtube")
    return siRenderYouTubeField(field, value, wrapClass);

  if (field.type === "textarea") {
    return `
      <div class="${wrapClass}">
        ${label}
        <textarea rows="2" name="${field.name}" data-si-content="${field.name}"
          oninput="siSetContent('${field.name}', this.value)"
          class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:border-rose-300">${escapeHtml(value)}</textarea>
      </div>`;
  }

  // Ngày có ô âm lịch đi kèm → tính lại ngay khi đổi ngày dương.
  const onInput = field.lunar
    ? `siSetContentDate('${field.name}', this.value, '${field.lunar}')`
    : `siSetContent('${field.name}', this.value)`;

  // Đang "trùng địa điểm" thì ô địa điểm của tiệc chỉ để xem — giá trị do ô
  // nguồn quyết định, gõ vào đây sẽ bị ghi đè ngay lần đồng bộ sau.
  const locked = siIsFieldLocked(field.name);

  // name= để applyMapPicker() (maps-helper.js) tìm được ô "…_location" mà điền
  // tên địa điểm vừa chọn — nó nhắm [name="…"], không phải data-si-content.
  return `
    <div class="${wrapClass}">
      ${label}
      <input type="${field.type}" value="${escapeHtml(value)}" name="${field.name}" data-si-content="${field.name}"
        ${locked ? "readonly" : `oninput="${onInput}"`}
        class="${inputClass}${locked ? " bg-gray-100 text-gray-400 cursor-not-allowed" : ""}" />
    </div>`;
}

// ============= Ô Google Maps: địa chỉ sẵn + picker bản đồ =============
// Ngoài ô dán link nhúng, hiện luôn địa chỉ đã gõ ở ô "Địa điểm" cùng khối để
// chép nhanh / mở thẳng Google Maps đã điền sẵn ô tìm kiếm (còn mỗi việc
// Share → Embed a map → dán ngược lại). Nút "Chọn trên bản đồ" dùng lại
// openMapPicker() của core/helpers/maps-helper.js — đúng picker của trang
// thiết lập thiệp, nên id ô URL phải là "<side>_map_embed_url" và khối địa chỉ
// phải mang id "<side>-map-display" / "<side>-map-address" cho nó ghi vào.

const SI_MAP_NO_ADDRESS = "Chưa có địa chỉ — nhập ở ô “Địa điểm” phía trên";

function siMapSide(name) {
  return name.replace(/_map_embed_url$/, "");
}

function siRenderMapField(field, value, wrapClass) {
  const side = siMapSide(field.name);
  const addr = String(siData.content[`${side}_location`] || "").trim();
  const chipBtn =
    "shrink-0 h-6 px-2 rounded-md text-xs text-gray-500 hover:text-rose-500 hover:bg-white transition-colors";

  // Trùng địa điểm → link nhúng do ô nguồn quyết định: khoá ô, ẩn nút chọn bản
  // đồ, thay bằng dòng nhắc để biết vì sao không sửa được.
  const locked = siIsFieldLocked(field.name);
  const action = locked
    ? `<span class="shrink-0 text-xs text-gray-400 italic">Theo ${escapeHtml(SI_SOURCE_LABEL[siPartySource(side)])}</span>`
    : `<button type="button" onclick="siOpenMapPicker('${side}')"
          class="shrink-0 text-xs text-rose-500 hover:text-rose-600 flex items-center gap-1">
          <i class="fas fa-map-location-dot"></i> Chọn trên bản đồ
        </button>`;

  return `
    <div class="${wrapClass}">
      <div class="flex items-center justify-between gap-2 mb-1">
        <label class="text-xs text-gray-500">${escapeHtml(field.label)}</label>
        ${action}
      </div>
      <div id="${side}-map-display" class="flex items-center gap-2 mb-2 px-3 py-2 bg-rose-50 border border-rose-100 rounded-lg">
        <i class="fas fa-location-dot text-rose-300 text-xs shrink-0"></i>
        <span id="${side}-map-address"
          class="flex-1 min-w-0 truncate text-xs ${addr ? "text-gray-600" : "text-gray-400 italic"}"
          >${escapeHtml(addr || SI_MAP_NO_ADDRESS)}</span>
        <button type="button" onclick="siCopyMapAddress('${side}')" title="Sao chép địa chỉ" class="${chipBtn}">
          <i class="fas fa-copy"></i> Chép
        </button>
        <button type="button" onclick="siOpenMapsSearch('${side}')" title="Mở Google Maps với địa chỉ này" class="${chipBtn}">
          <i class="fas fa-up-right-from-square"></i> Mở Maps
        </button>
      </div>
      <textarea rows="2" id="${field.name}" name="${field.name}" data-si-content="${field.name}"
        placeholder="Dán link nhúng — dán cả thẻ &lt;iframe&gt; cũng được, tự tách"
        ${locked ? "readonly" : `oninput="siSetContent('${field.name}', this.value)" onchange="siSetMapEmbed('${field.name}', this)"`}
        class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:border-rose-300${locked ? " bg-gray-100 text-gray-400 cursor-not-allowed" : ""}">${escapeHtml(value)}</textarea>
    </div>`;
}

// Đồng bộ dòng địa chỉ gợi ý theo ô "Địa điểm" đang gõ.
function siSyncMapAddress(side) {
  const el = document.getElementById(`${side}-map-address`);
  if (!el || !siData?.content) return;
  const addr = String(siData.content[`${side}_location`] || "").trim();
  el.textContent = addr || SI_MAP_NO_ADDRESS;
  el.classList.toggle("text-gray-600", !!addr);
  el.classList.toggle("text-gray-400", !addr);
  el.classList.toggle("italic", !addr);
}

function siMapAddress(side) {
  return String(siData?.content?.[`${side}_location`] || "").trim();
}

function siCopyMapAddress(side) {
  const addr = siMapAddress(side);
  if (!addr) {
    showToast("Chưa nhập địa điểm để sao chép", "warning");
    return;
  }
  navigator.clipboard
    .writeText(addr)
    .then(() => showToast("Đã chép địa chỉ — dán vào ô tìm kiếm của Google Maps", "success"))
    .catch(() => showToast("Trình duyệt chặn sao chép, hãy bôi đen rồi copy tay", "error"));
}

function siOpenMapsSearch(side) {
  const addr = siMapAddress(side);
  const url = addr
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`
    : "https://www.google.com/maps";
  window.open(url, "_blank", "noopener");
}

function siOpenMapPicker(side) {
  if (siIsFieldLocked(`${side}_map_embed_url`)) {
    showToast(`Đang trùng địa điểm ${SI_SOURCE_LABEL[siPartySource(side)]} — bỏ tích để chọn riêng`, "warning");
    return;
  }
  if (typeof openMapPicker !== "function" || typeof L === "undefined") {
    showToast("Chưa nạp được bản đồ — thử tải lại trang", "error");
    return;
  }
  openMapPicker(side);
}

// Dán nguyên thẻ <iframe> của Google Maps → tự lấy phần src.
function siSetMapEmbed(name, el) {
  const raw = el.value.trim();
  if (raw.includes("<iframe") && raw.includes("src=")) {
    const m = raw.match(/src=["']([^"']+)["']/);
    if (m) {
      el.value = m[1];
      showToast("Đã tách link nhúng từ iframe", "success");
    }
  }
  siSetContent(name, el.value);
}

// maps-helper.js gọi hook này sau khi áp vị trí. Nó ghi thẳng .value của ô URL
// (không bắn sự kiện input) nên phải tự kéo giá trị từ DOM về state, nếu không
// bấm "Lưu vào ổ đĩa" sẽ ghi ra link cũ.
window._onLocationSourceChanged = function (side) {
  if (!siData?.content) return;
  [`${side}_map_embed_url`, `${side}_location`].forEach((name) => {
    if (!SI_CONTENT_FIELD_BY_NAME[name]) return;
    const el = document.querySelector(`[data-si-content="${name}"]`);
    if (el) siData.content[name] = el.value;
  });
  siSyncMapAddress(side);
  // Chọn bản đồ cho lễ thành hôn / vu quy → tiệc đang "trùng" phải theo luôn.
  if (side === "ceremony" || side === "vu_quy") siSyncAllSameLoc(true);
  siMarkDirty(true);
};

function siSetContent(name, value) {
  if (!siData?.content) return;
  siData.content[name] = value;
  // Địa điểm đổi → cập nhật luôn dòng địa chỉ gợi ý dưới ô Google Maps.
  if (name.endsWith("_location")) siSyncMapAddress(name.replace(/_location$/, ""));

  // Gõ ở ô nguồn (lễ thành hôn / vu quy) → đẩy ngay sang tiệc đang "trùng".
  // dom=true vì người dùng đang gõ dở, render lại cả form là mất con trỏ.
  if (/^(ceremony|vu_quy)_(location|map_embed_url)$/.test(name)) {
    siSyncAllSameLoc(true);
  }

  // Bật/tắt vu quy đổi luôn NGUỒN của tiệc nhà gái → phải vẽ lại (nhãn ô tích
  // đổi theo, và địa điểm phải kéo từ nguồn mới).
  if (name === "vu_quy_enabled") {
    siSyncAllSameLoc(false);
    siRenderContentForm();
  }

  siMarkDirty();
}

function siSetContentDate(name, value, lunarName) {
  if (!siData?.content) return;
  siData.content[name] = value;

  // formatLunarDate() nạp từ invitation-setup/js/09-lunar.js (thuần tính toán).
  if (lunarName && typeof formatLunarDate === "function") {
    const lunar = value ? `Tức ngày ${formatLunarDate(value)}` : "";
    siData.content[lunarName] = lunar;
    const el = document.querySelector(`[data-si-content="${lunarName}"]`);
    if (el) el.value = lunar;
  }
  siMarkDirty();
}

// ============= Ô nhạc nền YouTube =============
// Cùng luồng với trang thiết lập thiệp (invitation-setup/js/11-youtube.js): gõ
// CHỮ = tìm bài qua Edge Function `youtube-search`, dán ĐƯỜNG DẪN = chọn luôn,
// bỏ trống ô thì hiện gợi ý. Bấm 1 kết quả là ghi đè bài đang chọn.
//
// Khác một điểm: form này vẽ lại bằng innerHTML (đổi theme, bật/tắt vu quy,
// AI điền…) nên KHÔNG giữ state trong DOM — bài đang chọn là
// siData.content.music_url, tên bài cache ở siYtTitles để vẽ lại tag mà không
// phải hỏi oEmbed lần nữa. Preview dùng iframe nhúng thẳng (không cần
// YouTube IFrame API như bên thiết lập thiệp vì ở đây chỉ nghe thử).

const SI_YT_FIELD = "music_url";
const siYtTitles = {}; // url → tên bài (lấy từ kết quả tìm kiếm hoặc oEmbed)
let siYtSuggestCache = null; // HTML danh sách gợi ý, chỉ tải một lần
let siYtTimer = null;

function siYtVideoId(url) {
  const m = String(url || "").match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/)([\w-]{6,})/,
  );
  return m ? m[1] : null;
}

function siYtPreviewHtml(videoId) {
  return `
    <div class="aspect-video bg-black rounded-lg overflow-hidden">
      <iframe src="https://www.youtube.com/embed/${encodeURIComponent(videoId)}"
        title="Nghe thử nhạc nền" loading="lazy" allowfullscreen
        allow="accelerometer; encrypted-media; picture-in-picture"
        class="w-full h-full border-0"></iframe>
    </div>`;
}

function siRenderYouTubeField(field, value, wrapClass) {
  const url = String(value || "").trim();
  const videoId = siYtVideoId(url);
  const name = siYtTitles[url] || url;

  return `
    <div class="${wrapClass}">
      <label class="block text-xs text-gray-500 mb-1">${escapeHtml(field.label)}</label>
      <!-- KHÔNG gắn data-si-content: ô này chứa TÊN bài (ô tìm kiếm), giá trị
           thật nằm ở siData.content.music_url -->
      <input type="text" id="si-yt-input"
        value="${escapeHtml(videoId ? name : "")}"
        placeholder="Nhập tên bài hát hoặc dán đường dẫn YouTube..."
        oninput="siYtOnInput(this.value)" onfocus="siYtOnFocus(this.value)"
        class="w-full h-10 px-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-rose-300" />

      <div id="si-yt-tag" class="mt-2${videoId ? "" : " hidden"}">
        <span class="inline-flex items-center gap-1.5 max-w-full px-2.5 py-1 rounded-full bg-rose-50 text-rose-600 border border-rose-100 text-xs">
          <i class="fas fa-music shrink-0"></i>
          <span id="si-yt-name" class="truncate">${escapeHtml(name)}</span>
          <button type="button" onclick="siYtClear()" title="Gỡ bài hát"
            class="shrink-0 hover:text-rose-800">
            <i class="fas fa-xmark"></i>
          </button>
        </span>
      </div>

      <p id="si-yt-error" class="hidden mt-1 text-xs text-red-500">
        Đường dẫn YouTube không hợp lệ.
      </p>

      <div id="si-yt-results" class="mt-2 space-y-1 max-h-64 overflow-y-auto"></div>

      <div id="si-yt-preview" class="mt-2${videoId ? "" : " hidden"}">
        ${videoId ? siYtPreviewHtml(videoId) : ""}
      </div>
    </div>`;
}

// Vẽ lại RIÊNG ô nhạc theo state (khỏi render cả form — mất con trỏ ở ô khác).
function siYtSyncField() {
  const url = String(siData?.content?.[SI_YT_FIELD] || "").trim();
  const videoId = siYtVideoId(url);
  const name = siYtTitles[url] || url;

  const results = document.getElementById("si-yt-results");
  if (results) results.innerHTML = "";
  document.getElementById("si-yt-error")?.classList.add("hidden");

  const input = document.getElementById("si-yt-input");
  if (input) input.value = videoId ? name : "";

  const nameEl = document.getElementById("si-yt-name");
  if (nameEl) nameEl.textContent = name;
  document.getElementById("si-yt-tag")?.classList.toggle("hidden", !videoId);

  const preview = document.getElementById("si-yt-preview");
  if (preview) {
    preview.innerHTML = videoId ? siYtPreviewHtml(videoId) : "";
    preview.classList.toggle("hidden", !videoId);
  }
}

async function siYtFetchItems(q) {
  const res = await fetch(
    `${CONFIG.supabase.edgeUrl}?resource=youtube-search&q=${encodeURIComponent(q)}`,
    { headers: { Authorization: `Bearer ${CONFIG.supabase.anonKey}` } },
  );
  const items = await res.json();
  return Array.isArray(items) ? items : [];
}

function siYtItemsHtml(items) {
  return items
    .map(
      (item) => `
      <button type="button" onclick="siYtPick(this)"
        data-yt-url="${escapeHtml(item.url)}" data-yt-title="${escapeHtml(item.title)}"
        class="w-full flex gap-3 p-2 rounded-lg hover:bg-rose-50 text-left transition-colors">
        <img src="${escapeHtml(item.thumbnail)}" alt="" loading="lazy"
          class="w-20 h-12 rounded object-cover shrink-0 bg-gray-100" />
        <div class="min-w-0 flex-1">
          <p class="text-xs font-medium text-gray-800 line-clamp-2 leading-snug">${escapeHtml(item.title)}</p>
          <p class="text-[10px] text-gray-400 mt-1">${escapeHtml(item.channel)}${item.duration ? " · " + escapeHtml(item.duration) : ""}</p>
        </div>
      </button>`,
    )
    .join("");
}

async function siYtSearch(q) {
  const results = document.getElementById("si-yt-results");
  if (!results) return;
  results.innerHTML =
    '<p class="text-xs text-gray-400 py-3 text-center">Đang tìm...</p>';
  try {
    const items = await siYtFetchItems(q);
    results.innerHTML = items.length
      ? siYtItemsHtml(items)
      : '<p class="text-xs text-gray-400 py-3 text-center">Không tìm thấy kết quả.</p>';
  } catch {
    results.innerHTML =
      '<p class="text-xs text-red-400 py-3 text-center">Lỗi tìm kiếm, thử lại nhé.</p>';
  }
}

async function siYtSuggest() {
  const results = document.getElementById("si-yt-results");
  if (!results) return;

  if (siYtSuggestCache !== null) {
    results.innerHTML = siYtSuggestCache;
    return;
  }

  results.innerHTML =
    '<p class="text-xs text-gray-400 py-3 text-center">Đang tải gợi ý...</p>';
  try {
    const items = await siYtFetchItems("nhạc đám cưới");
    siYtSuggestCache = items.length
      ? '<p class="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-1 pb-1">Gợi ý</p>' +
        siYtItemsHtml(items)
      : "";
  } catch {
    siYtSuggestCache = "";
  }
  results.innerHTML = siYtSuggestCache;
}

function siYtOnFocus(val) {
  if (!String(val).trim()) siYtSuggest();
}

// Ô này là ô TÌM KIẾM: gõ/xoá ở đây không đụng tới bài đã chọn (tag + preview).
// Chỉ dán một đường dẫn hợp lệ hoặc bấm kết quả mới là "chọn bài".
function siYtOnInput(val) {
  clearTimeout(siYtTimer);
  siYtTimer = setTimeout(() => siYtHandleInput(String(val).trim()), 500);
}

function siYtHandleInput(val) {
  const results = document.getElementById("si-yt-results");
  const error = document.getElementById("si-yt-error");

  if (!val) {
    error?.classList.add("hidden");
    siYtSuggest();
    return;
  }

  if (val.includes("youtube.com") || val.includes("youtu.be")) {
    if (results) results.innerHTML = "";
    if (!siYtVideoId(val)) {
      error?.classList.remove("hidden");
      return;
    }
    error?.classList.add("hidden");
    siYtSelect(val, "");
    return;
  }

  error?.classList.add("hidden");
  siYtSearch(val);
}

function siYtPick(btn) {
  siYtSelect(btn.dataset.ytUrl, btn.dataset.ytTitle || "");
}

function siYtSelect(url, title) {
  if (!siData?.content || !siYtVideoId(url)) return;
  siData.content[SI_YT_FIELD] = url;
  if (title) siYtTitles[url] = title;
  siYtSyncField();
  siMarkDirty(true);
  siYtEnsureTitle(); // chưa biết tên bài (dán link) → hỏi oEmbed rồi vá vào tag
}

function siYtClear() {
  if (!siData?.content) return;
  siData.content[SI_YT_FIELD] = "";
  siYtSyncField();
  siMarkDirty(true);
  siYtSuggest();
}

// Chỉ có URL (dán link / nạp từ data.json) → lấy tên bài qua oEmbed công khai.
async function siYtEnsureTitle() {
  const url = String(siData?.content?.[SI_YT_FIELD] || "").trim();
  if (!url || !siYtVideoId(url) || siYtTitles[url]) return;

  let title = "";
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
    );
    if (res.ok) title = (await res.json())?.title || "";
  } catch {}
  if (!title) return;

  siYtTitles[url] = title;
  // Trong lúc chờ, người dùng có thể đã đổi/gỡ bài — chỉ vá khi vẫn là bài này.
  if (String(siData?.content?.[SI_YT_FIELD] || "").trim() !== url) return;
  const nameEl = document.getElementById("si-yt-name");
  if (nameEl) nameEl.textContent = title;
  const input = document.getElementById("si-yt-input");
  if (input && input.value.trim() === url) input.value = title;
}

// ============= Lịch trình =============

function siRenderTimeline() {
  const list = document.getElementById("si-timeline-list");
  if (!list || !siData?.content) return;

  const items = siData.content.timeline || [];
  list.innerHTML = items
    .map(
      (item, idx) => `
      <div class="flex flex-col sm:flex-row gap-2 sm:items-center">
        <input type="time" value="${escapeHtml(item.time)}"
          oninput="siSetTimelineField(${idx}, 'time', this.value)"
          class="w-full sm:w-32 h-10 px-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-rose-300" />
        <input type="text" value="${escapeHtml(item.title)}" placeholder="Ví dụ: Đón khách, chụp ảnh lưu niệm"
          oninput="siSetTimelineField(${idx}, 'title', this.value)"
          class="flex-1 h-10 px-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-rose-300" />
        <select onchange="siSetTimelineField(${idx}, 'type', this.value)"
          class="w-full sm:w-44 h-10 px-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-rose-300">
          ${SI_TIMELINE_TYPES.map(
            (t) =>
              `<option value="${t.value}" ${t.value === item.type ? "selected" : ""}>${t.label}</option>`,
          ).join("")}
        </select>
        <button type="button" onclick="siRemoveTimelineItem(${idx})"
          class="shrink-0 h-10 px-3 text-xs text-gray-400 hover:text-red-400 transition-colors">
          <i class="fas fa-trash"></i>
        </button>
      </div>`,
    )
    .join("");

  const count = document.getElementById("si-timeline-count");
  if (count) count.textContent = `${items.length}/${SI_MAX_TIMELINE}`;
}

function siAddTimelineItem() {
  if (!siData?.content) return;
  if ((siData.content.timeline || []).length >= SI_MAX_TIMELINE) {
    showToast(`Tối đa ${SI_MAX_TIMELINE} mốc lịch trình`, "warning");
    return;
  }
  siData.content.timeline.push({ time: "", title: "", type: "ceremony" });
  siRenderTimeline();
  siMarkDirty(true);
}

function siRemoveTimelineItem(idx) {
  siData.content.timeline.splice(idx, 1);
  siRenderTimeline();
  siMarkDirty(true);
}

function siSetTimelineField(idx, key, value) {
  const item = siData?.content?.timeline?.[idx];
  if (!item) return;
  item[key] = value;
  siMarkDirty();
}

// ============= Nhờ AI sinh dữ liệu mẫu =============
// Toàn bộ dữ liệu do AI nghĩ ra: Edge Function ai-invitation có chế độ riêng
// `mode: "sample"` (xem supabase/functions/ai-invitation/index.ts) tự dựng cả
// cặp đôi hư cấu — tên, cha mẹ, địa chỉ, ngày giờ lễ/tiệc, ngân hàng, chuyện
// tình, lịch trình, lời ngỏ. Client không giữ kho tên/địa danh nào; mỗi lần
// bấm là một cặp khác, không phải xào lại dữ liệu demo cũ.
//
// Ảnh thì AI không sinh được — phần đó vẫn up tay (03-sample-images.js).
// Lưu ý hạn mức: trang admin không đăng nhập nên tính theo IP (5 lượt/ngày).


function siApplyAiResult(res) {
  let applied = 0;

  const fields = res?.fields && typeof res.fields === "object" ? res.fields : {};
  Object.entries(fields).forEach(([name, value]) => {
    const spec = SI_CONTENT_FIELD_BY_NAME[name];
    if (!spec) return; // khoá lạ / field ảnh → bỏ qua
    siData.content[name] =
      spec.type === "switch"
        ? value === true || value === "true"
        : String(value ?? "").trim();
    applied++;

    // Có ngày dương thì tính luôn ngày âm đi kèm.
    if (spec.lunar && siData.content[name] && typeof formatLunarDate === "function") {
      siData.content[spec.lunar] = `Tức ngày ${formatLunarDate(siData.content[name])}`;
    }
  });

  if (res?.story_quote) {
    siData.content.story_quote = String(res.story_quote).trim();
    applied++;
  }

  // AI trả về địa điểm riêng cho từng tiệc → suy lại ô tích "trùng địa điểm"
  // thay vì giữ trạng thái cũ rồi ghi đè mất dữ liệu AI vừa sinh.
  siSameLoc.src = null;

  if (Array.isArray(res?.timeline) && res.timeline.length) {
    siData.content.timeline = res.timeline
      .slice(0, SI_MAX_TIMELINE)
      .map(siNormalizeTimelineItem);
    applied += siData.content.timeline.length;
  }

  // Chuyện tình: AI chỉ sinh CHỮ — giữ nguyên ảnh đang có theo đúng thứ tự mốc.
  if (Array.isArray(res?.love_story) && res.love_story.length) {
    const old = siData.loveStory;
    const next = res.love_story.slice(0, SI_MAX_LOVE_STORY).map((item, i) => ({
      date: String(item?.date || ""),
      title: String(item?.title || ""),
      content: String(item?.content || ""),
      blob: old[i]?.blob || null,
      focal: old[i]?.focal || { x: 50, y: 50 },
      previewUrl: old[i]?.previewUrl || null,
    }));
    // Mốc dư ra bị cắt → thu hồi blob URL của chúng cho khỏi rò rỉ.
    old.slice(next.length).forEach((i) => i.previewUrl && URL.revokeObjectURL(i.previewUrl));
    siData.loveStory = next;
    applied += next.length;
  }

  return applied;
}

async function siGenerateSampleDataWithAI() {
  if (!siCurrentTheme || !siData) {
    showToast("Hãy chọn theme trước", "warning");
    return;
  }
  if (typeof aiDAL === "undefined") {
    showToast("Chưa nạp được AiDAL", "error");
    return;
  }

  const btn = document.getElementById("si-ai-generate-btn");
  btn.disabled = true;
  showLoading(true, "AI đang soạn dữ liệu mẫu...");
  try {
    const res = await aiDAL.generateSampleData({
      tone: document.getElementById("si-ai-tone")?.value || "romantic",
      region: document.getElementById("si-ai-region")?.value || "",
      hint: document.getElementById("si-ai-hint")?.value.trim() || "",
    });

    const applied = siApplyAiResult(res);
    siRenderAll();
    siMarkDirty(true);
    if (applied) {
      showToast(
        `AI đã điền ${applied} mục — kiểm tra rồi bấm "Lưu vào ổ đĩa"`,
        "default",
        "sparkles",
      );
    } else {
      showToast("AI chưa trả về nội dung dùng được, thử lại nhé", "warning");
    }
  } catch (e) {
    console.error(e);
    // Bản Edge Function cũ chưa biết mode "sample" → rơi vào nhánh sinh thiệp
    // và đòi thông tin cô dâu/chú rể. Nói thẳng ra để khỏi mò.
    const msg = e?.message || "Không sinh được dữ liệu";
    showToast(
      /thông tin cô dâu|chú rể/i.test(msg)
        ? "Edge Function ai-invitation chưa có chế độ dữ liệu mẫu — cần deploy lại"
        : msg,
      "error",
    );
  } finally {
    btn.disabled = false;
    showLoading(false);
  }
}
