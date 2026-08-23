// Đổ kết quả AI vào form thiệp. Tách khỏi khung chat vì chat chỉ lo hội thoại,
// còn việc bind vào control là chuyện riêng của trang thiết lập.
//
// Nạp SAU các file dựng form (cần _loveStoryItems, _timelineItems, SECTION_VIS_FIELDS,
// BANK_LIST, flatpickrInstances) và TRƯỚC js/ai-assistant.js.

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

  // 2) Chuyện tình yêu → thay danh sách hiện tại
  if (Array.isArray(result.love_story) && result.love_story.length) {
    _loveStoryItems = result.love_story.map((it) => ({
      date: it.date || "",
      title: it.title || "",
      content: it.content || "",
      image_url: null,
    }));
    _loveStoryKeyExists = true;
    _syncLoveStoryHidden();
    renderLoveStoryList();
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
