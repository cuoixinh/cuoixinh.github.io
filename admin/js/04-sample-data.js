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
      { name: "ceremony_map_embed_url", label: "Google Maps embed URL", type: "textarea", wide: true },
    ],
  },
  {
    title: "Lễ vu quy",
    icon: "fa-house-chimney",
    fields: [
      { name: "vu_quy_enabled", label: "Hiện lễ vu quy", type: "switch" },
      { name: "vu_quy_time", label: "Giờ", type: "time" },
      { name: "vu_quy_location", label: "Địa điểm", type: "text", wide: true },
      { name: "vu_quy_map_embed_url", label: "Google Maps embed URL", type: "textarea", wide: true },
    ],
  },
  {
    title: "Tiệc nhà trai",
    icon: "fa-champagne-glasses",
    fields: [
      { name: "groom_party_date", label: "Ngày", type: "date", lunar: "groom_party_lunar" },
      { name: "groom_party_time", label: "Giờ", type: "time" },
      { name: "groom_party_lunar", label: "Ngày âm (tự tính)", type: "text" },
      { name: "groom_party_show_location", label: "Hiện địa điểm", type: "switch" },
      { name: "groom_party_location", label: "Địa điểm", type: "text", wide: true },
      { name: "groom_party_map_embed_url", label: "Google Maps embed URL", type: "textarea", wide: true },
    ],
  },
  {
    title: "Tiệc nhà gái",
    icon: "fa-champagne-glasses",
    fields: [
      { name: "bride_party_date", label: "Ngày", type: "date", lunar: "bride_party_lunar" },
      { name: "bride_party_time", label: "Giờ", type: "time" },
      { name: "bride_party_lunar", label: "Ngày âm (tự tính)", type: "text" },
      { name: "bride_party_show_location", label: "Hiện địa điểm", type: "switch" },
      { name: "bride_party_location", label: "Địa điểm", type: "text", wide: true },
      { name: "bride_party_map_embed_url", label: "Google Maps embed URL", type: "textarea", wide: true },
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
      { name: "music_url", label: "Nhạc nền (YouTube URL)", type: "text", wide: true },
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

function siRenderContentForm() {
  const host = document.getElementById("si-content-fields");
  if (!host || !siData?.content) return;
  // Ghi nhớ nhóm nào đang mở để render lại (sau khi AI điền) không bị đóng hết.
  const opened = new Set(
    [...host.querySelectorAll("details[open]")].map((d) => d.dataset.group),
  );
  host.innerHTML = SI_CONTENT_GROUPS.map((g, i) =>
    siRenderContentGroup(g, opened.size ? opened.has(g.title) : i === 0),
  ).join("");
}

function siRenderContentGroup(group, open) {
  const switches = group.fields.filter((f) => f.type === "switch");
  const others = group.fields.filter((f) => f.type !== "switch");
  const body =
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

  if (field.type === "textarea") {
    return `
      <div class="${wrapClass}">
        ${label}
        <textarea rows="2" data-si-content="${field.name}"
          oninput="siSetContent('${field.name}', this.value)"
          class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:border-rose-300">${escapeHtml(value)}</textarea>
      </div>`;
  }

  // Ngày có ô âm lịch đi kèm → tính lại ngay khi đổi ngày dương.
  const onInput = field.lunar
    ? `siSetContentDate('${field.name}', this.value, '${field.lunar}')`
    : `siSetContent('${field.name}', this.value)`;

  return `
    <div class="${wrapClass}">
      ${label}
      <input type="${field.type}" value="${escapeHtml(value)}" data-si-content="${field.name}"
        oninput="${onInput}" class="${inputClass}" />
    </div>`;
}

function siSetContent(name, value) {
  if (!siData?.content) return;
  siData.content[name] = value;
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
    showToast(`⚠️ Tối đa ${SI_MAX_TIMELINE} mốc lịch trình`);
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
    showToast("⚠️ Hãy chọn theme trước");
    return;
  }
  if (typeof aiDAL === "undefined") {
    showToast("❌ Chưa nạp được AiDAL");
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
    showToast(
      applied
        ? `✨ AI đã điền ${applied} mục — kiểm tra rồi bấm "Lưu vào ổ đĩa"`
        : "⚠️ AI chưa trả về nội dung dùng được, thử lại nhé",
    );
  } catch (e) {
    console.error(e);
    // Bản Edge Function cũ chưa biết mode "sample" → rơi vào nhánh sinh thiệp
    // và đòi thông tin cô dâu/chú rể. Nói thẳng ra để khỏi mò.
    const msg = e?.message || "Không sinh được dữ liệu";
    showToast(
      /thông tin cô dâu|chú rể/i.test(msg)
        ? "❌ Edge Function ai-invitation chưa có chế độ dữ liệu mẫu — cần deploy lại"
        : "❌ " + msg,
    );
  } finally {
    btn.disabled = false;
    showLoading(false);
  }
}
