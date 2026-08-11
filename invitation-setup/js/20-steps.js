// Luồng điền thiệp theo BƯỚC: mỗi group của form là một bước, đi tới bằng
// "Tiếp theo"/"Quay lại" hoặc bấm thẳng chip trên thanh bước ở header.
//
// Ba thứ khai báo tập trung ở CX_STEPS dưới đây — thêm/bớt bước chỉ sửa mảng đó:
//   id      trùng `data-step` của thẻ bọc group trong partials/form-panel.html
//   vis     tên mục trong SECTION_VIS_FIELDS (03-form-sections.js) nếu group tắt được
//   done()  tiêu chí "điền đủ" → quyết định chip hiện ✓ hay ⚠
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
  },
  {
    id: "ceremony",
    label: "Sự kiện",
    icon: "calendar-heart",
    done: () => _cxAll("ceremony_date", "ceremony_time", "ceremony_location"),
  },
  {
    id: "family",
    label: "Gia đình",
    icon: "users",
    vis: "family",
    done: () => _cxAll("groom_father", "groom_mother", "bride_father", "bride_mother"),
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

function _cxStepAt(i) {
  return CX_STEPS[Math.min(Math.max(i, 0), CX_STEPS.length - 1)];
}

function cxStepIndexOf(id) {
  return CX_STEPS.findIndex((s) => s.id === id);
}

/** Group tắt công tắc → không tính vào tiến độ, chip làm mờ. */
function _cxStepOff(step) {
  if (!step.vis) return false;
  const field = SECTION_VIS_FIELDS[step.vis];
  return field ? document.getElementById(field)?.value === "false" : false;
}

/** "off" (đang tắt) · "done" (đủ) · "todo" (thiếu). */
function _cxStepState(step) {
  if (_cxStepOff(step)) return "off";
  try {
    return step.done() ? "done" : "todo";
  } catch (e) {
    return "todo";
  }
}

// ===== THANH BƯỚC =====

const _CX_CHIP_BASE =
  "group flex shrink-0 items-center gap-1.5 rounded-full border py-1 pl-1 pr-2.5 text-[11px] font-medium transition-colors";
const _CX_DOT_BASE =
  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold";

function _cxChipHTML(step, i) {
  const state = _cxStepState(step);
  const active = i === _cxStepIndex;

  // Viền/nền: bước đang mở nổi hẳn lên; các bước khác phân biệt bằng màu chấm.
  const chip = active
    ? "border-rose-300 bg-rose-50 text-rose-700"
    : state === "off"
      ? "border-gray-100 bg-white text-gray-300"
      : "border-gray-200 bg-white text-gray-600 hover:border-rose-200 hover:text-rose-600";

  let dot, mark;
  if (state === "off") {
    dot = "bg-gray-100 text-gray-300";
    mark = '<i data-lucide="minus" style="width:11px;height:11px"></i>';
  } else if (state === "done") {
    dot = "bg-emerald-500 text-white";
    mark = '<i data-lucide="check" style="width:11px;height:11px"></i>';
  } else {
    dot = "bg-amber-400 text-white";
    mark = '<i data-lucide="alert-triangle" style="width:11px;height:11px"></i>';
  }

  const note =
    state === "off" ? "đang tắt" : state === "done" ? "đã điền đủ" : "chưa điền đủ";

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
    (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch],
  );
}

// Chữ ký trạng thái của lần vẽ trước. Hàm này bị gọi ở MỖI phím gõ; vẽ lại vô
// điều kiện thì mỗi ký tự lại dựng lại 10 nút + quét DOM tạo icon, và thanh cuộn
// ngang giật vì scrollIntoView. Không có gì đổi thì không vẽ.
let _cxBarSig = null;

function cxRenderStepBar() {
  const bar = document.getElementById("step-bar");
  if (!bar) return;

  const states = CX_STEPS.map(_cxStepState);
  const sig = states.join("|") + "@" + _cxStepIndex;
  if (sig === _cxBarSig) return;
  _cxBarSig = sig;

  bar.innerHTML = CX_STEPS.map(_cxChipHTML).join("");
  if (window.lucide) lucide.createIcons();

  // Kéo chip đang mở vào tầm nhìn — thanh cuộn ngang, bước 8 nằm ngoài màn hình.
  const active = bar.querySelector('[aria-selected="true"]');
  active?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
}

// ===== HIỆN/ẨN PANEL =====

function _cxRenderPanels() {
  const cur = _cxStepAt(_cxStepIndex);
  document.querySelectorAll("#wedding-form [data-step]").forEach((el) => {
    el.classList.toggle("hidden", el.dataset.step !== cur.id);
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
  const first = _cxStepIndex === 0;
  const last = _cxStepIndex === CX_STEPS.length - 1;

  // Giữ CHỖ của nút lùi ở bước đầu (invisible chứ không hidden), nếu không dải
  // chip nhảy ngang mỗi lần rời bước 1.
  const prev = document.getElementById("step-prev");
  if (prev) {
    prev.classList.toggle("invisible", first);
    prev.disabled = first;
  }

  const label = document.getElementById("step-next-label");
  // Bước cuối đổi hẳn ý nghĩa (rời form sang xem trước) nên chữ hiện ở mọi khổ
  // màn; các bước giữa chỉ hiện chữ từ sm trở lên để nhường chỗ cho chip.
  if (label) {
    label.textContent = last ? "Xem trước" : "Tiếp theo";
    label.classList.toggle("hidden", !last);
    label.classList.toggle("sm:inline", !last);
  }

  // Tiến độ tổng chuyển thành tooltip: chip đã nói đủ vị trí lẫn trạng thái, để
  // thêm một dòng chữ nữa chỉ tốn chiều cao thanh.
  const next = document.getElementById("step-next");
  if (next) {
    const todo = CX_STEPS.filter((s) => _cxStepState(s) === "todo").length;
    next.title =
      `Bước ${_cxStepIndex + 1}/${CX_STEPS.length}` +
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
  // Bấm chip/nút giữa lúc còn dở một cú vuốt → gỡ hết transform tạm trước đã.
  if (typeof _cxSwReset === "function") _cxSwReset();
  _cxStepIndex = i;
  cxRenderSteps();
  // Cuộn tới ĐẦU FORM chứ không tới #step-bar: thanh bước là sticky, đưa chính nó
  // vào tầm nhìn thì trình duyệt tính theo chỗ nó đang dính, cuộn hụt. Form có
  // scroll-mt-28 nên phần đầu bước không nằm dưới header + thanh bước.
  if (opts.scroll !== false) {
    document
      .getElementById("wedding-form")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
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
      showToast("Vui lòng điền các ô bắt buộc trước khi sang bước sau", "error");
      return;
    }
  }

  if (_cxStepIndex >= CX_STEPS.length - 1) {
    switchTab("preview");
    return;
  }
  cxGoStep(_cxStepIndex + 1);
}
window.cxStepNext = cxStepNext;

// ===== VUỐT ĐỔI BƯỚC =====
//
// Kéo 1:1 theo ngón tay: bước hiện tại trượt theo, bước kế được nhấc lên đè
// (.cx-step-float) và bám ngay sát mép — thả ra mới chốt hoặc bật về.
// Chỉ nhận cảm ứng/bút; chuột dùng nút hoặc chip.

const _CX_SW = {
  LOCK: 12, // px ngang tối thiểu mới coi là vuốt, dưới mức này còn có thể là chạm
  RATIO: 1.2, // ngang phải trội hơn dọc bấy nhiêu lần, không thì nhường cuộn dọc
  COMMIT: 0.28, // kéo quá 28% bề ngang là đổi bước
  VELO: 0.45, // hoặc hất nhanh hơn 0.45 px/ms (kéo ngắn nhưng dứt khoát)
  DRAG: 0.32, // hệ số ghì khi không có bước kế (đầu/cuối) — kéo nặng tay hẳn
  MS: 280, // phải khớp .cx-step-anim trong styles/_setup.css
};

let _cxSw = null;

function _cxStack() {
  return document.getElementById("step-stack");
}

function _cxPanelAt(i) {
  const s = CX_STEPS[i];
  return s
    ? document.querySelector(`#wedding-form [data-step="${s.id}"]`)
    : null;
}

/** Dọn mọi dấu vết của một lần vuốt, đưa DOM về đúng thứ cxRenderSteps dựng ra. */
function _cxSwReset() {
  const stack = _cxStack();
  if (stack) {
    stack.classList.remove("is-sliding", "cx-step-anim-h");
    stack.style.height = "";
  }
  document.querySelectorAll("#step-stack > [data-step]").forEach((el) => {
    el.classList.remove("cx-step-float", "cx-step-anim");
    el.style.transform = "";
    el.style.opacity = "";
  });
  _cxSw = null;
}

/** Nhấc bước kế lên đè và đặt nó nằm sát mép theo hướng đang kéo. */
function _cxSwStage(next) {
  const el = _cxPanelAt(next);
  if (!el) return null;
  el.classList.remove("hidden");
  el.classList.add("cx-step-float");
  return el;
}

function _cxSwDown(e) {
  if (e.pointerType === "mouse" || !e.isPrimary) return;
  // Vùng tự nuốt cử chỉ ngang: ô nhiều dòng (chọn chữ), bản đồ, dải cuộn ngang.
  if (
    e.target.closest?.(
      "textarea, select, [contenteditable], input[type='range'], .leaflet-container, .overflow-x-auto, [data-no-swipe]",
    )
  )
    return;
  const stack = _cxStack();
  if (!stack || _cxSw) return;
  _cxSw = {
    id: e.pointerId,
    x0: e.clientX,
    y0: e.clientY,
    t0: e.timeStamp,
    dx: 0,
    locked: false,
    dead: false,
    dir: 0,
    cur: null,
    nb: null,
    w: stack.offsetWidth || 1,
  };
}

function _cxSwMove(e) {
  const s = _cxSw;
  if (!s || e.pointerId !== s.id || s.dead) return;
  const dx = e.clientX - s.x0;
  const dy = e.clientY - s.y0;

  if (!s.locked) {
    if (Math.abs(dx) < _CX_SW.LOCK) return;
    // Đã rõ là cuộn dọc → bỏ hẳn lượt này, đừng tranh với trình duyệt.
    if (Math.abs(dx) < Math.abs(dy) * _CX_SW.RATIO) {
      s.dead = true;
      return;
    }
    const stack = _cxStack();
    s.locked = true;
    s.dir = dx < 0 ? 1 : -1; // kéo sang trái = đi tới bước sau
    s.cur = _cxPanelAt(_cxStepIndex);
    s.nb = _cxSwStage(_cxStepIndex + s.dir);
    s.w = stack.offsetWidth || s.w;
    stack.classList.add("is-sliding");
    // Giành hẳn chuỗi sự kiện: ô nhập bên dưới không còn kéo con trỏ chữ theo.
    try {
      stack.setPointerCapture(e.pointerId);
    } catch (_) {}
  }

  // Đổi ý giữa chừng (kéo qua rồi kéo ngược lại) → dựng bước kế của hướng mới.
  const dir = dx < 0 ? 1 : -1;
  if (dx !== 0 && dir !== s.dir) {
    if (s.nb) {
      s.nb.classList.add("hidden");
      s.nb.classList.remove("cx-step-float");
      s.nb.style.transform = "";
    }
    s.dir = dir;
    s.nb = _cxSwStage(_cxStepIndex + dir);
  }

  // Không có bước kế (đang ở đầu/cuối) → vẫn nhúc nhích nhưng ghì lại.
  s.dx = s.nb ? dx : dx * _CX_SW.DRAG;
  if (s.cur) s.cur.style.transform = `translate3d(${s.dx}px,0,0)`;
  if (s.nb)
    s.nb.style.transform = `translate3d(${s.dx + s.dir * s.w}px,0,0)`;
}

function _cxSwUp(e) {
  const s = _cxSw;
  if (!s || e.pointerId !== s.id) return;
  if (!s.locked || s.dead) return void (_cxSw = null);

  const stack = _cxStack();
  const velo = Math.abs(s.dx) / Math.max(e.timeStamp - s.t0, 1);
  const commit =
    !!s.nb && (Math.abs(s.dx) > s.w * _CX_SW.COMMIT || velo > _CX_SW.VELO);
  const target = commit ? -s.dir * s.w : 0;
  const dir = s.dir;
  const { cur, nb } = s;

  // Chiều cao hai bước khác nhau → chạy cả height, nếu không phần dưới form
  // nhảy một nhịp đúng lúc đổi.
  if (commit && nb) {
    stack.style.height = stack.offsetHeight + "px";
    void stack.offsetHeight; // chốt giá trị đầu trước khi bật transition
    stack.classList.add("cx-step-anim-h");
    stack.style.height = nb.offsetHeight + "px";
  }

  cur?.classList.add("cx-step-anim");
  nb?.classList.add("cx-step-anim");
  if (cur) cur.style.transform = `translate3d(${target}px,0,0)`;
  if (nb) nb.style.transform = `translate3d(${target + dir * s.w}px,0,0)`;

  _cxSw = null;
  // Chốt bước đang đứng NGAY BÂY GIỜ: người dùng có thể bấm chip khác trong lúc
  // hiệu ứng còn chạy, khi đó lượt vuốt này phải tự bỏ chứ không cộng dồn.
  const from = _cxStepIndex;
  setTimeout(() => {
    if (commit && _cxStepIndex === from) {
      _cxStepIndex = Math.min(Math.max(from + dir, 0), CX_STEPS.length - 1);
    }
    _cxSwReset();
    // Vẽ lại (không cuộn): _cxRenderPanels tự trả .hidden về đúng bước.
    cxRenderSteps();
  }, _CX_SW.MS);
}

function _cxInitSwipe() {
  const stack = _cxStack();
  if (!stack) return;
  stack.addEventListener("pointerdown", _cxSwDown, { passive: true });
  stack.addEventListener("pointermove", _cxSwMove, { passive: true });
  stack.addEventListener("pointerup", _cxSwUp);
  stack.addEventListener("pointercancel", (e) => {
    if (_cxSw?.id === e.pointerId) _cxSwUp(e);
  });
}

// ===== KHỞI TẠO =====

function _cxInitSteps() {
  if (!document.getElementById("step-bar")) return;

  // Gõ ở bất kỳ ô nào cũng có thể làm một bước từ ⚠ sang ✓ → chấm lại trạng thái.
  // Nghe ở form (nổi bọt) nên ô thêm sau (mốc lịch trình, ảnh…) cũng được tính.
  const form = document.getElementById("wedding-form");
  form?.addEventListener("input", cxRefreshStepStatus);
  form?.addEventListener("change", cxRefreshStepStatus);

  cxGoStep(0, { scroll: false });
  _cxInitSwipe();
}

if (window.__cxOnReady) window.__cxOnReady(_cxInitSteps);
else if (document.readyState === "loading")
  document.addEventListener("DOMContentLoaded", _cxInitSteps);
else _cxInitSteps();
