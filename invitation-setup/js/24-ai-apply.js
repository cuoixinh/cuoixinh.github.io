// Đổ kết quả AI vào form thiệp. Tách khỏi khung chat vì chat chỉ lo hội thoại,
// còn việc bind vào control là chuyện riêng của trang thiết lập.
//
// Nạp SAU các file dựng form (cần _loveStoryItems, _timelineItems, SECTION_VIS_FIELDS,
// BANK_LIST, flatpickrInstances) và TRƯỚC js/ai-assistant.js. Cũng khai cxAiMediaSink —
// đích ghi của các ô chọn ảnh/nhạc/bản đồ/mẫu trong khung chat (js/ai-chat-media.js).

// Đổ một thiệp do AI dựng vào form đang mở. Gọi từ khung chat (js/ai-assistant.js);
// mọi giá trị đi qua _aiSetField để x-input/flatpickr/ô ngân hàng đồng bộ đúng.
function cxApplyAiCard(result) {
  if (!result) return;

  // 1) Slogan → dùng lại cơ chế của randomQuote (set value + dispatch input để autosave + x-input đồng bộ)
  if (result.story_quote) {
    const ta = document.getElementById("story-quote-textarea");
    if (ta) {
      ta.value = result.story_quote;
      ta.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }

  // 2) Chuyện tình yêu → thay CHỮ của danh sách hiện tại, ảnh giữ nguyên
  if (Array.isArray(result.love_story) && result.love_story.length) {
    applyLoveStoryText(result.love_story);
  }

  // 3) Lịch trình → thay danh sách hiện tại
  if (Array.isArray(result.timeline) && result.timeline.length) {
    _timelineItems = result.timeline.map((it) => ({
      time: it.time || "",
      title: it.title || "",
      type: it.type || "ceremony",
    }));
    _syncTimelineHidden();
    renderTimelineList();
  }

  // 4) Các field trích xuất/sinh khác (gồm ngày & giờ cưới AI trích từ Thông tin) → đổ vào form
  const f = result.fields || {};
  Object.keys(f).forEach((key) => _aiSetField(key, f[key]));

  // 4b) Nhạc + bản đồ khách chọn ở khung chat TRANG CHỦ (CXChatMedia.handoff). Ảnh thì
  // đã nằm sẵn trong IndexedDB dưới mã nháp này, _idbRestoreAll nhặt lên. Sau bước 4:
  // bản đồ cần ô địa điểm đã có chữ.
  const media = result.media || {};
  if (media.music?.url) {
    selectYouTubeSong(media.music.url, media.music.title || "");
    _scheduleAutoSave("config");
  }
  Object.entries(media.maps || {}).forEach(([side, m]) =>
    _cxSetMap(side, m?.embed, m?.name),
  );

  // 5) Bật hiển thị các section tương ứng khi có nội dung
  if ((result.love_story || []).length) _aiEnableSection("love_story");
  if ((result.timeline || []).length) _aiEnableSection("timeline");
  if (f.rsvp_message) _aiEnableSection("rsvp");
  if (f.footer_text) _aiEnableSection("footer");
  if (f.groom_father || f.groom_mother || f.bride_father || f.bride_mother)
    _aiEnableSection("family");
  if (
    f.groom_party_date ||
    f.groom_party_time ||
    f.groom_party_location ||
    f.bride_party_date ||
    f.bride_party_time ||
    f.bride_party_location
  )
    _aiEnableSection("party");
  if (
    f.groom_bank_name ||
    f.groom_bank_number ||
    f.groom_bank_owner ||
    f.bride_bank_name ||
    f.bride_bank_number ||
    f.bride_bank_owner
  )
    _aiEnableSection("gift");

  // Hidden input set bằng code không tự phát event → gọi autosave thủ công
  _scheduleAutoSave();

  showToast("Đã áp dụng nội dung AI vào thiệp", "success");
}

// Đổ 1 giá trị vào field của form (tái dùng cách xử lý như fillForm):
// x-input bọc ngoài, bank name (input+hidden riêng), date dùng flatpickr (kèm âm lịch).
function _aiSetField(name, value) {
  if (value === undefined || value === null || value === "") return;
  const form = document.getElementById("wedding-form");
  if (!form) return;

  // Ngân hàng: AI trả về MÃ ngân hàng → map sang chuỗi đầy đủ trong BANK_LIST
  // để bind đúng vào control Tên ngân hàng (input hiển thị + hidden value riêng).
  if (name === "groom_bank_name" || name === "bride_bank_name") {
    const prefix = name === "groom_bank_name" ? "groom" : "bride";
    const input = document.getElementById(`${prefix}-bank-input`);
    const hidden = document.getElementById(`${prefix}-bank-value`);
    const resolved = _resolveBankName(value);
    if (input) input.value = resolved;
    if (hidden) {
      hidden.value = resolved;
      hidden.dispatchEvent(new Event("input", { bubbles: true }));
    }
    return;
  }

  // vu_quy_enabled: hidden boolean
  if (name === "vu_quy_enabled") {
    const hidden = document.getElementById("vu_quy_enabled");
    if (hidden) {
      hidden.value = value ? "true" : "false";
      hidden.dispatchEvent(new Event("input", { bubbles: true }));
      if (typeof initCeremonySection === "function")
        initCeremonySection({ vu_quy_enabled: !!value });
    }
    return;
  }

  // Date field dùng Flatpickr → set qua instance để đồng bộ + cập nhật âm lịch
  if (window.flatpickrInstances && window.flatpickrInstances[name]) {
    try {
      window.flatpickrInstances[name].setDate(value, true);
    } catch (e) {}
    let el = form.querySelector(`[name="${name}"]`);
    if (el && el.tagName.startsWith("X-"))
      el = el.querySelector("input, textarea, select") || el;
    el?.dispatchEvent(new Event("change", { bubbles: true }));
    return;
  }

  // Field thường (kể cả <x-input>/<x-time>)
  let el = form.querySelector(`[name="${name}"]`);
  if (!el) return;
  if (el.tagName.startsWith("X-"))
    el = el.querySelector("input, textarea, select") || el;
  el.value = value;
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

// Bật hiển thị một section (set toggle = true nếu đang tắt)
function _aiEnableSection(section) {
  const field = SECTION_VIS_FIELDS[section];
  if (!field) return;
  const hidden = document.getElementById(field);
  if (!hidden) return;
  if (hidden.value !== "true") {
    hidden.value = "true";
    hidden.dispatchEvent(new Event("input", { bubbles: true }));
  }
  if (typeof _updateVisUI === "function") _updateVisUI(section, true);
  if (section === "party" && typeof _updateTimelinePartySection === "function")
    _updateTimelinePartySection();
}

// ── Ngân hàng: mã/tên viết tắt AI trả về → chuỗi đầy đủ trong BANK_LIST ───────
// AI được yêu cầu trả mã (VD "VCB", "MB", "TCB"); ở đây map về đúng tên control.
const _BANK_CODE_MAP = {
  vcb: "Vietcombank",
  ctg: "VietinBank",
  icb: "VietinBank",
  vietin: "VietinBank",
  bidv: "BIDV",
  vba: "Agribank",
  agri: "Agribank",
  agribank: "Agribank",
  mb: "MB Bank",
  mbbank: "MB Bank",
  tcb: "Techcombank",
  techcom: "Techcombank",
  acb: "ACB",
  vpb: "VPBank",
  vpbank: "VPBank",
  tpb: "TPBank",
  tpbank: "TPBank",
  stb: "Sacombank",
  sacom: "Sacombank",
  hdb: "HDBank",
  hdbank: "HDBank",
  vib: "VIB",
  shb: "SHB",
  eib: "Eximbank",
  exim: "Eximbank",
  msb: "MSB",
  ocb: "OCB",
  ssb: "SeABank",
  seab: "SeABank",
  seabank: "SeABank",
  bvb: "VietCapital Bank",
  vccb: "VietCapital Bank",
  banviet: "VietCapital Bank",
  scb: "SCB",
  vbb: "VietBank",
  vietbank: "VietBank",
  lpb: "LienVietPostBank",
  lienviet: "LienVietPostBank",
  pvcb: "PVcomBank",
  pvcombank: "PVcomBank",
  bab: "BacABank",
  bacabank: "BacABank",
  vab: "VietABank",
  vieta: "VietABank",
  ncb: "NCB",
  nvb: "NCB",
  sgb: "SaigonBank",
  sgicb: "SaigonBank",
  abb: "ABBank",
  abbank: "ABBank",
  nab: "Nam A Bank",
  namabank: "Nam A Bank",
  nama: "Nam A Bank",
  pgb: "PGBank",
  pgbank: "PGBank",
  bvbank: "BaoViet Bank",
  baoviet: "BaoViet Bank",
  gpb: "GPBank",
  gpbank: "GPBank",
  oceanbank: "OceanBank",
  ojb: "OceanBank",
  cbb: "CBBank",
  cbbank: "CBBank",
  klb: "KienLongBank",
  kienlong: "KienLongBank",
  dab: "DongA Bank",
  dongabank: "DongA Bank",
  donga: "DongA Bank",
  uob: "UOB",
  scvn: "Standard Chartered",
  standard: "Standard Chartered",
  hsbc: "HSBC",
  shbvn: "Shinhan Bank",
  shinhan: "Shinhan Bank",
  woori: "Woori Bank",
  hlb: "Hong Leong Bank",
  hongleong: "Hong Leong Bank",
  cimb: "CIMB",
  pbvn: "Public Bank",
  publicbank: "Public Bank",
};

function _normBank(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // bỏ dấu
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]/g, "");
}

function _resolveBankName(codeOrName) {
  const raw = String(codeOrName || "").trim();
  if (!raw) return raw;
  const list = typeof BANK_LIST !== "undefined" ? BANK_LIST : [];
  if (!list.length) return raw;

  const key = _normBank(raw);
  const short = _BANK_CODE_MAP[key];
  const target = short ? _normBank(short) : key;

  // 1) khớp CHÍNH XÁC phần short name (trước " - ") của mỗi entry
  for (const entry of list) {
    if (_normBank(entry.split(" - ")[0]) === target) return entry;
  }
  // 2) khớp lỏng theo short name (chỉ khi target đủ dài, tránh nhầm)
  if (target.length >= 3) {
    for (const entry of list) {
      const sn = _normBank(entry.split(" - ")[0]);
      if (sn.includes(target) || target.includes(sn)) return entry;
    }
    // 3) khớp trong toàn bộ chuỗi đầy đủ
    for (const entry of list) {
      if (_normBank(entry).includes(target)) return entry;
    }
  }
  return raw; // không tìm được → giữ nguyên (control vẫn cho nhập tự do)
}

window.cxApplyAiCard = cxApplyAiCard;

// ── Thiệp bàn giao từ khung chat ở TRANG CHỦ ────────────────────────────────
// Object vài KB nên đi qua localStorage chứ không qua URL. Bên ghi: js/ai-assistant.js.
// Đọc MỘT LẦN rồi xoá — còn nằm lại thì lần mở thiệp sau bị đổ đè nội dung của
// cuộc chat cũ.
//
// Lấy ra lúc trang sẵn sàng nhưng ĐỔ VÀO thì để _showContent() gọi: loadData()
// chạy sau đó và fillForm() ghi đè cả form, đổ sớm là mất trắng nội dung AI.
const CX_CHAT_CARD_KEY = buildCacheKey("chat_card");

let _cxPendingAiCard = null;

window.__cxOnReady(() => {
  const card = getCache(CX_CHAT_CARD_KEY);
  removeCache(CX_CHAT_CARD_KEY);
  if (card && typeof card === "object") _cxPendingAiCard = card;
});

// Đổ thiệp AI đang chờ (nếu có) vào form. Trả về true khi thực sự có đổ —
// 13-data.js dựa vào đó để không coi form là dữ liệu mẫu nữa.
// Nội dung AI KHÔNG tự lên DB: autosave giữ nó trong nháp trên máy (đã đăng nhập thì
// là cache F5 có `_owner`), khách tự bấm "Lưu nháp"/"Xuất bản" mới lên tài khoản.
window.__cxApplyPendingAiCard = function () {
  const card = _cxPendingAiCard;
  _cxPendingAiCard = null;
  if (!card) return false;
  cxApplyAiCard(card);
  return true;
};

// ── Ô chọn trong khung chat XuXi (js/ai-chat-media.js) ─────────────────────
// Đổ THẲNG vào thiệp đang mở, mỗi thao tác đi đúng đường của control tương ứng trên
// form (bảng lấy nét, cắt QR, selectYouTubeSong, ô bản đồ, _applyThemeChange) nên kết
// quả y như khách tự làm ở form. Ảnh vẫn chỉ lên Storage lúc Lưu, như mọi ảnh khác.

const _CX_MAP_SIDES = ["ceremony", "vu_quy", "groom_party", "bride_party"];
const _CX_IMAGE_FIELDS = [
  "cover_image_url",
  "groom_image_url",
  "bride_image_url",
  "groom_qr_url",
  "bride_qr_url",
];

// Giá trị hiện tại của một ô form; [name=X] khớp <x-input> bọc ngoài trước.
function _aiFieldValue(name) {
  let el = document.querySelector(`#wedding-form [name="${name}"]`);
  if (el && el.tagName.startsWith("X-"))
    el = el.querySelector("input, textarea, select") || el;
  return String(el?.value || "").trim();
}

// Ghim bản đồ cho một địa điểm — phần cuối của applyMapPicker (core/helpers/maps-helper.js),
// không đụng ô địa chỉ. Chỉ nhận link nhúng Google Maps: giá trị này thành src của iframe.
function _cxSetMap(side, embed, name) {
  if (!_CX_MAP_SIDES.includes(side)) return;
  if (!/^https:\/\/maps\.google\.com\/maps\?/.test(String(embed || ""))) return;
  const hidden = document.getElementById(`${side}_map_embed_url`);
  if (!hidden) return;
  hidden.value = embed;
  hidden.dispatchEvent(new Event("input", { bubbles: true }));
  _updateMapDisplay(side, embed, name || _aiFieldValue(`${side}_location`));
  window._onLocationSourceChanged?.(side);
}

const _cxFileUrls = new WeakMap(); // File chờ upload → objectURL để hiện ảnh nhỏ
function _cxFileUrl(file) {
  if (!_cxFileUrls.has(file)) _cxFileUrls.set(file, URL.createObjectURL(file));
  return _cxFileUrls.get(file);
}

const _cxMediaChanged = () => window.dispatchEvent(new CustomEvent("cx-media-change"));

window.cxAiMediaSink = {
  async state() {
    const img = (f) => {
      const pending = pendingUploads.singleImages[f];
      if (pending) return _cxFileUrl(pending);
      const saved = document.querySelector(`input[name="${f}"]`)?.value;
      return saved ? getImageUrl(saved) : "";
    };
    const saved = _gallerySavedFilenames();
    const gallery = [
      ...saved.map((name, index) => ({ url: getImageUrl(name), index })),
      ...pendingUploads.galleryImages.map((file, j) => ({
        url: _cxFileUrl(file),
        index: saved.length + j,
      })),
    ];
    const vuQuy = _aiFieldValue("vu_quy_enabled") === "true";
    const places = {};
    const maps = {};
    _CX_MAP_SIDES.forEach((s) => {
      const loc = _aiFieldValue(`${s}_location`);
      if (loc && (s !== "vu_quy" || vuQuy)) places[s] = loc;
      const embed = document.getElementById(`${s}_map_embed_url`)?.value;
      if (embed) maps[s] = { embed, name: loc };
    });
    const musicUrl = document.getElementById("music-url-input")?.value || "";
    return {
      theme: WEDDING_THEME
        ? {
            theme: WEDDING_THEME,
            name:
              document.getElementById("header-theme-name")?.textContent.trim() ||
              WEDDING_THEME,
          }
        : null,
      themeLocked: !!IS_THEME_LOCKED,
      images: Object.fromEntries(_CX_IMAGE_FIELDS.map((f) => [f, img(f)])),
      gallery,
      music: musicUrl
        ? {
            url: musicUrl,
            title: document.getElementById("music-selected-name")?.textContent.trim() || "",
          }
        : null,
      maps,
      places,
      hasBank: !!(_aiFieldValue("groom_bank_number") || _aiFieldValue("bride_bank_number")),
    };
  },

  // Đi qua đúng hàm của ô chọn ảnh trên form (bảng lấy nét / cắt QR, nén, IndexedDB);
  // xong thì _imagesChanged phát cx-media-change.
  setImage(field, file) {
    return handleImageUpload({ target: { files: [file], value: "" } }, field);
  },

  addGallery(files) {
    return handleGalleryUpload({ target: { files, value: "" } });
  },

  removeGallery(item) {
    const saved = _gallerySavedFilenames().length;
    if (item.index < saved) removeExistingGalleryImage(item.index);
    else removeGalleryImage(item.index - saved);
  },

  async setMusic(url, title) {
    await selectYouTubeSong(url, title);
    _scheduleAutoSave("config");
    _cxMediaChanged();
  },

  setMap(side, embed, name) {
    _cxSetMap(side, embed, name);
    _scheduleAutoSave();
    _cxMediaChanged();
  },

  async setTheme(theme, name) {
    await _applyThemeChange(theme, name);
    _cxMediaChanged();
  },
};
