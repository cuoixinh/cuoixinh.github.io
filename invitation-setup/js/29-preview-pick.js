// Bấm lên thiệp để sửa — phía trang Thiết lập. Thiệp ở dải Xem trực tiếp / tab Xem trước
// (?pick=1, core/helpers/preview-pick.js) gửi {type:"cx-pick", action, …}; ở đây chỉ dẫn
// khách tới đúng ô / bộ chọn ảnh / công tắc mục — MỌI thay đổi vẫn đi qua form như gõ tay.
// Kèm bộ đếm "Còn N mục" dưới máy và lời gợi ý lần đầu.

// Ô file của từng cột ảnh đơn (partials/steps/01-couple.html, 09-gift.html).
const CX_PICK_FILE_INPUT = {
  cover_image_url: "cover-file-input",
  groom_image_url: "groom-file-input",
  bride_image_url: "bride-file-input",
  groom_qr_url: "groom-qr-file-input",
  bride_qr_url: "bride-qr-file-input",
  gallery_images: "gallery-file-input",
};

const CX_PICK_HINT_KEY = "cx_pick_hint_seen";

function _cxPickFlash(el) {
  el?.animate?.(
    [
      { boxShadow: "0 0 0 4px rgb(225 29 72 / 0.45)" },
      { boxShadow: "0 0 0 0 rgb(225 29 72 / 0)" },
    ],
    { duration: 1400, easing: "ease-out" },
  );
}

// Thiệp nằm ở tab Xem trước (dưới 820px) thì phải về tab Chỉnh sửa mới thấy form.
function _cxPickToForm() {
  if (_activeTab !== "edit") switchTab("edit");
}

// Bước có hai thẻ Nhà trai / Nhà gái: mở đúng thẻ của cột trước khi tìm ô.
function _cxPickSide(field, step) {
  const side = /^bride_/.test(field) ? "bride" : /^groom_/.test(field) ? "groom" : "";
  if (!side) return;
  if (step === "family") window.switchFamilyTab?.(side);
  if (step === "party") window.switchPartyTab?.(side);
}

// Ô hiện ra cho khách của một cột: <x-input>/<x-date>… bọc ô thật; cột bản đồ là ô ẩn,
// ô gõ là `<cột-gốc>_map_query`; ô ẩn khác (ngân hàng) thì lấy ô gõ cạnh nó.
function _cxPickInput(field) {
  const form = document.getElementById("wedding-form");
  if (!form) return null;
  if (/_map_embed_url$/.test(field)) {
    return document.getElementById(field.replace(/_embed_url$/, "_query"));
  }
  const el = form.querySelector(`[name="${field}"]`);
  if (!el) return null;
  if (el.type === "hidden") return el.parentElement?.querySelector("input:not([type=hidden]), textarea");
  return el.querySelector?.("input:not([type=hidden]), textarea, button") || el;
}

function _cxPickGoField(field) {
  const step = CX_PICK_FIELDS[field]?.[1];
  if (!step) return;
  _cxPickToForm();
  cxGoStep(step, { scroll: false });
  _cxPickSide(field, step);
  // Đợi một nhịp vẽ: bước vừa bỏ .hidden, đo/cuộn ngay thì ô còn khổ 0.
  requestAnimationFrame(() => {
    const input = _cxPickInput(field);
    const box = input?.closest("x-input, .x-input, label, div") || input;
    if (!input) return;
    input.scrollIntoView({ block: "center", behavior: "smooth" });
    input.focus({ preventScroll: true });
    _cxPickFlash(box);
  });
}

function _cxPickStep(step) {
  _cxPickToForm();
  cxGoStep(step);
}

// Mục đang tắt thì bật lên rồi mở bước; mục bật mà trống thì chỉ mở bước.
function _cxPickEnable(step) {
  const s = (typeof _cxSteps === "function" ? _cxSteps() : []).find((x) => x.id === step);
  if (s && typeof _cxStepOff === "function" && _cxStepOff(s)) toggleSectionVis(s.vis || step);
  _cxPickStep(step);
}

// Bộ chọn ảnh: mượn cú bấm trong thiệp (cùng origin nên trang cha cũng được kích
// hoạt) để mở hộp chọn file — gọi chậm quá vài giây là trình duyệt chặn.
function _cxPickImage(field) {
  const step = CX_PICK_FIELDS[field]?.[1];
  if (step) {
    _cxPickToForm();
    cxGoStep(step, { scroll: false });
  }
  document.getElementById(CX_PICK_FILE_INPUT[field])?.click();
}

function _cxPickFocal(msg) {
  if (msg.field === "gallery_images") return adjustGalleryFocalPoint(msg.idx, msg.src);
  adjustSingleImageFocalPoint(msg.field);
}

window.addEventListener("message", (e) => {
  if (e.origin !== location.origin) return;
  const msg = e.data;
  if (!msg || msg.type !== "cx-pick") return;
  _cxPickHintDone();
  if (msg.field && !CX_PICK_FIELDS[msg.field]) return;
  if (msg.step && !CX_PICK_STEPS[msg.step]) return;
  if (msg.action === "field") _cxPickGoField(msg.field);
  else if (msg.action === "image") _cxPickImage(msg.field);
  else if (msg.action === "focal") _cxPickFocal(msg);
  else if (msg.action === "enable") _cxPickEnable(msg.step);
  else if (msg.action === "step") _cxPickStep(msg.step);
  else if (msg.action === "guests") openGuestsPage();
});

// ── BỘ ĐẾM "CÒN N MỤC" ────────────────────────────────────────────────────────
// Bước đang bật mà chưa đủ (trạng thái của thanh bước, 20-steps.js). Bấm là mở lần
// lượt từng bước còn thiếu, tính từ bước đang mở.
function _cxPickTodo() {
  if (typeof _cxSteps !== "function") return [];
  return _cxSteps().filter((s) => {
    const st = _cxStepState(s);
    return st === "empty" || st === "partial";
  });
}

function cxPickSyncTodo() {
  const btn = document.getElementById("live-todo");
  if (!btn) return;
  const n = _cxPickTodo().length;
  btn.classList.toggle("hidden", !n);
  const label = btn.querySelector("span");
  if (label) label.textContent = `Còn ${n} mục`;
  btn.title = n ? "Mở mục còn thiếu tiếp theo" : "";
}
window.cxPickSyncTodo = cxPickSyncTodo;

function cxPickNextTodo() {
  const todo = _cxPickTodo();
  if (!todo.length) return;
  const all = _cxSteps();
  const cur = all.findIndex((s) => s.id === _cxStepId);
  const next = todo.find((s) => all.indexOf(s) > cur) || todo[0];
  _cxPickStep(next.id);
}
window.cxPickNextTodo = cxPickNextTodo;

// ── GỢI Ý LẦN ĐẦU ─────────────────────────────────────────────────────────────
// Thiệp trông y bản xem bình thường, không ai tự đoán ra là bấm được. Bấm thử một lần
// (hoặc bấm ✕) là tắt hẳn.
function _cxPickHintSeen() {
  try {
    return localStorage.getItem(CX_PICK_HINT_KEY) === "1";
  } catch (e) {
    return true;
  }
}

function _cxPickHintDone() {
  try {
    localStorage.setItem(CX_PICK_HINT_KEY, "1");
  } catch (e) {}
  document.getElementById("live-hint")?.classList.add("hidden");
}
window.cxPickHintDone = _cxPickHintDone;

// Dưới 820px không có dải xem trực tiếp: gợi ý bằng toast khi tab Xem trước nạp xong,
// mỗi phiên một lần.
function _cxPickHintToast() {
  if (_cxPickHintSeen() || window.cxLiveWide?.()) return;
  try {
    if (sessionStorage.getItem(CX_PICK_HINT_KEY)) return;
    sessionStorage.setItem(CX_PICK_HINT_KEY, "1");
  } catch (e) {}
  showToast("Mẹo: chạm vào chữ hoặc ảnh trên thiệp để sửa nhanh");
}

_onDomReady(function () {
  if (!_cxPickHintSeen()) document.getElementById("live-hint")?.classList.remove("hidden");
  document.getElementById("preview-iframe")?.addEventListener("load", _cxPickHintToast);
  cxPickSyncTodo();
});
