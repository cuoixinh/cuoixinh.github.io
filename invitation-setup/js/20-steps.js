// Luồng điền thiệp theo BƯỚC: mỗi group của form là một bước, đi tới bằng
// "Tiếp theo"/"Quay lại" hoặc bấm thẳng chip trên thanh bước ở header.
//
// Ba thứ khai báo tập trung ở CX_STEPS dưới đây — thêm/bớt bước chỉ sửa mảng đó:
//   id      trùng `data-step` của thẻ bọc group trong partials/form-panel.html
//   vis     tên mục trong SECTION_VIS_FIELDS (03-form-sections.js) nếu group tắt được
//   done()  tiêu chí "điền đủ" → chip xanh ✓
//   some()  "đã điền được phần nào" → chip vàng ⚠; không có thì lấy theo done()
//           (bước chỉ có đủ/không, không có trạng thái dở dang). Chưa gì cả → đỏ.
//
// Ô [required] mới là thứ CHẶN được "Tiếp theo"; done() chỉ đổi icon, không chặn.

// ===== KHAI BÁO BƯỚC =====

/**
 * Giá trị một ô trong form, "" nếu không có ô đó. Phải nhắm đúng thẻ nhập thật:
 * `[name=X]` khớp cả <x-input> bọc ngoài, mà host không có .value → luôn rỗng.
 */
function _cxVal(name) {
  const el = document.querySelector(
    `#wedding-form input[name="${name}"], #wedding-form textarea[name="${name}"], #wedding-form select[name="${name}"]`,
  );
  return (el?.value || "").trim();
}

/** Mọi ô đều có giá trị. */
function _cxAll(...names) {
  return names.every((n) => _cxVal(n));
}

/** Có ít nhất một ô đã điền. */
function _cxAny(...names) {
  return names.some((n) => _cxVal(n));
}

/** Mảng JSON trong ô ẩn (timeline, love_story) có ít nhất một phần tử. */
function _cxListHas(name) {
  try {
    const arr = JSON.parse(_cxVal(name) || "[]");
    return Array.isArray(arr) && arr.length > 0;
  } catch (e) {
    return false;
  }
}

const CX_STEPS = [
  {
    id: "couple",
    label: "Cặp đôi",
    icon: "heart",
    done: () => _cxAll("groom_name", "bride_name"),
    some: () => _cxAny("groom_name", "bride_name"),
  },
  {
    id: "ceremony",
    label: "Sự kiện",
    icon: "calendar-heart",
    done: () => _cxAll("ceremony_date", "ceremony_time", "ceremony_location"),
    some: () => _cxAny("ceremony_date", "ceremony_time", "ceremony_location"),
  },
  {
    id: "family",
    label: "Gia đình",
    icon: "users",
    vis: "family",
    done: () =>
      _cxAll("groom_father", "groom_mother", "bride_father", "bride_mother"),
    some: () =>
      _cxAny("groom_father", "groom_mother", "bride_father", "bride_mother"),
  },
  {
    id: "party",
    label: "Tiệc cưới",
    icon: "utensils",
    vis: "party",
    // Nhiều đám chỉ đãi một bên → đủ khi CÓ ÍT NHẤT một bên trọn ngày/giờ/nơi.
    done: () =>
      _cxAll("groom_party_date", "groom_party_time", "groom_party_location") ||
      _cxAll("bride_party_date", "bride_party_time", "bride_party_location"),
    some: () =>
      _cxAny(
        "groom_party_date",
        "groom_party_time",
        "groom_party_location",
        "bride_party_date",
        "bride_party_time",
        "bride_party_location",
      ),
  },
  {
    id: "photos",
    label: "Ảnh cưới",
    icon: "image",
    vis: "photos",
    // Ảnh đã lưu nằm ở textarea; ảnh vừa chọn còn nằm trong pendingUploads.
    done: () =>
      !!_cxVal("gallery_images_raw") ||
      (window.pendingUploads?.galleryImages?.length || 0) > 0,
  },
  {
    id: "timeline",
    label: "Lịch trình",
    icon: "clock",
    vis: "timeline",
    done: () => _cxListHas("timeline"),
  },
  {
    id: "love_story",
    label: "Chuyện tình yêu",
    icon: "book-heart",
    vis: "love_story",
    done: () => _cxListHas("love_story"),
  },
  {
    id: "rsvp",
    label: "Xác nhận dự",
    icon: "mail-check",
    vis: "rsvp",
    done: () => !!_cxVal("rsvp_message"),
  },
  {
    id: "gift",
    label: "Hộp mừng",
    icon: "gift",
    vis: "gift",
    done: () =>
      _cxAll("groom_bank_name", "groom_bank_number", "groom_bank_owner") ||
      _cxAll("bride_bank_name", "bride_bank_number", "bride_bank_owner"),
    some: () =>
      _cxAny(
        "groom_bank_name",
        "groom_bank_number",
        "groom_bank_owner",
        "bride_bank_name",
        "bride_bank_number",
        "bride_bank_owner",
      ),
  },
  {
    id: "footer",
    label: "Lời cảm ơn",
    icon: "message-circle-heart",
    vis: "footer",
    done: () => !!_cxVal("footer_text"),
  },
];

// ===== TRẠNG THÁI =====

let _cxStepIndex = 0;
// id của bước đang mở — cần để tìm lại đúng bước khi DANH SÁCH bước đổi (mẫu
// mới bỏ/khôi phục một bước), vì lúc đó chỉ số cũ trỏ sang bước khác.
let _cxStepId = null;

/**
 * Các bước THỰC SỰ hiện ra. Mẫu thiệp có thể bỏ hẳn một mục (vd Noir Elegance
 * không có phần Gia đình) bằng CX_THEME.skipSteps trong index.js của nó —
 * js/25-theme-decl.js đọc bản khai đó và phát "cx-theme-decl" để vẽ lại.
 * Chưa đọc xong thì hiện đủ bước, không bỏ oan bước nào.
 */
function _cxSteps() {
  const skip = window.cxThemeDecl?.().skipSteps;
  if (!Array.isArray(skip) || !skip.length) return CX_STEPS;
  return CX_STEPS.filter((s) => !skip.includes(s.id));
}

function _cxStepAt(i) {
  const steps = _cxSteps();
  return steps[Math.min(Math.max(i, 0), steps.length - 1)];
}

function cxStepIndexOf(id) {
  return _cxSteps().findIndex((s) => s.id === id);
}

/** Group tắt công tắc → không tính vào tiến độ, chip làm mờ. */
function _cxStepOff(step) {
  if (!step.vis) return false;
  const field = SECTION_VIS_FIELDS[step.vis];
  return field ? document.getElementById(field)?.value === "false" : false;
}

/** "off" (đang tắt) · "done" xanh · "partial" vàng · "empty" đỏ. */
function _cxStepState(step) {
  if (_cxStepOff(step)) return "off";
  try {
    if (step.done()) return "done";
    return (step.some || step.done)() ? "partial" : "empty";
  } catch (e) {
    return "empty";
  }
}

// ===== THANH BƯỚC =====

const _CX_CHIP_BASE =
  "group flex shrink-0 items-center gap-1.5 rounded-full border py-1 pl-2.5 pr-2.5 text-[11px] font-medium transition-colors";
const _CX_DOT_BASE = "flex shrink-0 items-center justify-center";

function _cxChipHTML(step, i) {
  const state = _cxStepState(step);
  const active = i === _cxStepIndex;

  // Viền/nền: bước đang mở nổi hẳn lên; các bước khác phân biệt bằng màu chấm.
  const chip = active
    ? "border-rose-300 bg-rose-50 text-color-secondary"
    : state === "off"
      ? "border-gray-100 bg-white text-gray-300"
      : "border-gray-200 bg-white text-gray-600 hover:border-rose-200 hover:text-rose-600";

  // Ba mức: đỏ chưa điền gì · vàng điền dở · xanh đủ (xám là group đang tắt).
  const DOT = {
    off: ["text-gray-300", "minus"],
    empty: ["text-red-500", "alert-circle"],
    partial: ["text-amber-500", "alert-triangle"],
    done: ["text-emerald-500", "circle-check"],
  };
  const [dot, icon] = DOT[state] || DOT.empty;
  const mark = `<i data-lucide="${icon}" style="width:13px;height:13px"></i>`;

  const NOTE = {
    off: "đang tắt",
    empty: "chưa điền",
    partial: "điền còn thiếu",
    done: "đã điền đủ",
  };
  const note = NOTE[state] || NOTE.empty;

  return (
    `<button type="button" role="tab" data-step-chip="${step.id}"` +
    ` aria-selected="${active}" title="${_cxEsc(step.label)} — ${note}"` +
    ` onclick="cxGoStep('${step.id}')" class="${_CX_CHIP_BASE} ${chip}">` +
    `<span class="${_CX_DOT_BASE} ${dot}">${mark}</span>` +
    `<span class="whitespace-nowrap">${_cxEsc(step.label)}</span>` +
    `</button>`
  );
}

function _cxEsc(s) {
  return String(s ?? "").replace(
    /[&<>"']/g,
    (ch) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        ch
      ],
  );
}

// Chữ ký trạng thái của lần vẽ trước. Hàm này bị gọi ở MỖI phím gõ; vẽ lại vô
// điều kiện thì mỗi ký tự lại dựng lại 10 nút + quét DOM tạo icon, và thanh cuộn
// ngang giật vì scrollIntoView. Không có gì đổi thì không vẽ.
let _cxBarSig = null;

function cxRenderStepBar() {
  const bar = document.getElementById("step-bar");
  if (!bar) return;

  const steps = _cxSteps();
  const states = steps.map(_cxStepState);
  const sig = states.join("|") + "@" + _cxStepIndex;
  if (sig === _cxBarSig) {
    // Không vẽ lại chip, nhưng vẫn phải chấm lại vệt mờ + hai nút cuộn: lần vẽ
    // đầu chạy lúc thanh chưa có bề ngang thật nên chúng bị khoá oan.
    _cxSyncBarFade();
    return;
  }
  _cxBarSig = sig;

  bar.innerHTML = steps.map(_cxChipHTML).join("");
  if (window.lucide) lucide.createIcons();

  // Kéo chip đang mở vào giữa thanh — thanh cuộn NGANG, bước 8 nằm ngoài màn.
  // Tự đặt scrollLeft chứ không scrollIntoView: hàm kia còn cuộn DỌC mọi khung
  // cha (kể cả khung nhìn) khi thấy chip chưa lọt hẳn, đủ để đẩy cả thanh trên
  // ra khỏi màn.
  const active = bar.querySelector('[aria-selected="true"]');
  if (active) {
    const br = bar.getBoundingClientRect();
    const ar = active.getBoundingClientRect();
    bar.scrollTo({
      left: bar.scrollLeft + (ar.left - br.left) - (br.width - ar.width) / 2,
      behavior: "smooth",
    });
  }

  _cxSyncBarFade();
}

// Vệt trắng mờ hai mép thanh bước (xem .cx-stepbar-wrap): chỉ hiện ở phía còn
// cuộn được. Sai số 1px vì scrollLeft là số thực khi màn hình có tỉ lệ lẻ.
function _cxSyncBarFade() {
  const bar = document.getElementById("step-bar");
  const wrap = bar?.parentElement;
  if (!wrap) return;
  const max = bar.scrollWidth - bar.clientWidth;
  const atStart = bar.scrollLeft <= 1;
  const atEnd = bar.scrollLeft >= max - 1;
  wrap.classList.toggle("at-start", atStart);
  wrap.classList.toggle("at-end", atEnd);
  // Hai nút kẹp hai đầu chỉ CUỘN thanh — mờ đi khi phía đó không còn gì để lộ.
  const p = document.getElementById("stepbar-prev");
  if (p) p.disabled = atStart;
  const n = document.getElementById("stepbar-next");
  if (n) n.disabled = atEnd;
}

/** Cuộn thanh bước sang trái/phải một khoảng gần bằng bề ngang đang thấy. */
function cxStepBarScroll(dir) {
  const bar = document.getElementById("step-bar");
  if (!bar) return;
  bar.scrollBy({ left: dir * bar.clientWidth * 0.7, behavior: "smooth" });
}
window.cxStepBarScroll = cxStepBarScroll;

// ===== HIỆN/ẨN PANEL =====

function _cxRenderPanels() {
  const cur = _cxStepAt(_cxStepIndex);
  // Block HIỆN đầu tiên mang thêm .is-first (nó nằm sát mép trên thẻ nội dung
  // nên không kẻ vạch trên). Đánh dấu ở đây chứ không viết `:not(.hidden)`
  // trong CSS: cssnano gộp các `:not()` thành selector luôn khớp.
  let seen = false;
  document.querySelectorAll("#wedding-form [data-step]").forEach((el) => {
    const on = el.dataset.step === cur.id;
    el.classList.toggle("hidden", !on);
    el.classList.toggle("is-first", on && !seen);
    if (on) seen = true;
  });

  // Group đang tắt: vẫn vào được để bật lại, nhưng phần nhập làm mờ và khoá.
  const body = document.getElementById(`section-${cur.id}-body`);
  if (body) {
    const off = _cxStepOff(cur);
    body.classList.toggle("opacity-40", off);
    body.classList.toggle("pointer-events-none", off);
    body.setAttribute("aria-disabled", String(off));
  }
}

function _cxRenderNav() {
  const steps = _cxSteps();
  const first = _cxStepIndex === 0;
  const last = _cxStepIndex === steps.length - 1;

  // Bước đầu không có gì để lùi → VÔ HIỆU chứ không giấu: cụm giữ nguyên bề
  // ngang nên nút "Tiếp" không nhảy chỗ khi qua bước 2.
  const prev = document.getElementById("step-prev");
  if (prev) prev.disabled = first;

  // Hai nút kẹp thanh bước chỉ cuộn thanh — trạng thái của chúng do
  // _cxSyncBarFade() đặt theo vị trí cuộn, không theo bước đang mở.

  // Bước cuối dẫn đi đâu là tuỳ khổ màn: desktop đã thấy thiệp trong khung điện
  // thoại rồi nên đưa thẳng sang Cấu hình (xem cxStepNext).
  const label = document.getElementById("step-next-label");
  if (label)
    label.textContent = last
      ? window.cxLiveWide?.()
        ? "Cấu hình"
        : "Xem trước"
      : "Tiếp";

  const count = document.getElementById("step-count");
  if (count) count.textContent = `${_cxStepIndex + 1}/${steps.length}`;

  // Tiến độ tổng chuyển thành tooltip: chip đã nói đủ vị trí lẫn trạng thái, để
  // thêm một dòng chữ nữa chỉ tốn chiều cao thanh.
  const next = document.getElementById("step-next");
  if (next) {
    const todo = steps.filter((s) =>
      ["empty", "partial"].includes(_cxStepState(s)),
    ).length;
    next.title =
      `Bước ${_cxStepIndex + 1}/${steps.length}` +
      (todo ? ` · còn ${todo} mục chưa đủ` : " · đã điền đủ");
  }
}

/** Vẽ lại toàn bộ: chip + panel + thanh điều hướng. */
function cxRenderSteps() {
  cxRenderStepBar();
  _cxRenderPanels();
  _cxRenderNav();
}
window.cxRenderSteps = cxRenderSteps;

/** Chỉ cập nhật icon ✓/⚠ + gợi ý — gọi khi người dùng gõ, không cuộn panel. */
function cxRefreshStepStatus() {
  cxRenderStepBar();
  _cxRenderNav();
}
window.cxRefreshStepStatus = cxRefreshStepStatus;

// ===== ĐIỀU HƯỚNG =====

function cxGoStep(id, opts = {}) {
  const i = typeof id === "number" ? id : cxStepIndexOf(id);
  if (i < 0) return;
  _cxStepIndex = i;
  _cxStepId = _cxStepAt(i)?.id || null;
  cxRenderSteps();
  // Đổi bước là xem từ đầu bước: đưa CHÍNH khung nội dung về đỉnh. Không dùng
  // scrollIntoView trên form — nó cuộn thêm mọi khung cha, mà thanh trên nằm
  // ngoài khung nội dung nên sẽ bị đẩy khuất.
  if (opts.scroll !== false) {
    document
      .getElementById("setup-scroll")
      ?.scrollTo({ top: 0, behavior: "smooth" });
  }
  // Bản xem trực tiếp bám theo bước — không tải lại, chỉ cuộn tới mục tương ứng.
  window.cxLiveFocus?.();
}
window.cxGoStep = cxGoStep;

function cxStepPrev() {
  if (_cxStepIndex > 0) cxGoStep(_cxStepIndex - 1);
}
window.cxStepPrev = cxStepPrev;

/**
 * Sang bước sau. Chỉ CHẶN khi thiếu ô [required] của chính bước đang mở (tên cô
 * dâu/chú rể, ngày cưới); các tiêu chí còn lại chỉ hiện ⚠ trên chip, không chặn.
 */
function cxStepNext() {
  const cur = _cxStepAt(_cxStepIndex);
  const panel = document.querySelector(`#wedding-form [data-step="${cur.id}"]`);

  if (panel && !_cxStepOff(cur) && typeof validateForm === "function") {
    if (!validateForm(panel)) {
      showToast(
        "Vui lòng điền các ô bắt buộc trước khi sang bước sau",
        "error",
      );
      return;
    }
  }

  if (_cxStepIndex >= _cxSteps().length - 1) {
    // Desktop không còn tab Xem trước (thiệp nằm sẵn cạnh form) → điền xong thì
    // việc tiếp theo là Cấu hình. URL mang ?tab=config nên tải lại vẫn đúng chỗ.
    switchTab(window.cxLiveWide?.() ? "config" : "preview");
    return;
  }
  cxGoStep(_cxStepIndex + 1);
}
window.cxStepNext = cxStepNext;

// ===== KHỞI TẠO =====

function _cxInitSteps() {
  const bar = document.getElementById("step-bar");
  if (!bar) return;

  bar.addEventListener("scroll", _cxSyncBarFade, { passive: true });
  window.addEventListener("resize", _cxSyncBarFade, { passive: true });
  // Chip nạp xong / thanh trên đổi bề ngang (dải xem trực tiếp bật tắt) đều đổi
  // chuyện "còn cuộn được hay không" mà không phát scroll → phải tự theo dõi.
  if (window.ResizeObserver) new ResizeObserver(_cxSyncBarFade).observe(bar);

  // Gõ ở bất kỳ ô nào cũng có thể làm một bước từ ⚠ sang ✓ → chấm lại trạng thái.
  // Nghe ở form (nổi bọt) nên ô thêm sau (mốc lịch trình, ảnh…) cũng được tính.
  const form = document.getElementById("wedding-form");
  form?.addEventListener("input", cxRefreshStepStatus);
  form?.addEventListener("change", cxRefreshStepStatus);

  // Bản khai của mẫu về sau khi thanh bước đã dựng → vẽ lại. Bước đang mở nằm
  // trong nhóm bị bỏ (hoặc chỉ số rơi ra ngoài mảng mới) thì lùi về bước đầu.
  document.addEventListener("cx-theme-decl", () => {
    // Bám theo ID chứ không theo chỉ số: bỏ một bước là mọi bước sau đó tụt một
    // ô. Bước đang mở vừa bị bỏ thì quay về bước đầu.
    const i = _cxStepId ? cxStepIndexOf(_cxStepId) : -1;
    _cxStepIndex = i < 0 ? 0 : i;
    _cxBarSig = null; // ép vẽ lại: danh sách bước đổi mà trạng thái có thể không
    cxRenderSteps();
  });

  cxGoStep(0, { scroll: false });
}

if (window.__cxOnReady) window.__cxOnReady(_cxInitSteps);
else if (document.readyState === "loading")
  document.addEventListener("DOMContentLoaded", _cxInitSteps);
else _cxInitSteps();
