// Kéo-để-tải-lại cho khung cuộn giữa (#setup-scroll) và các panel cuộn khác.
//
// Trang là app shell: <html>/<body> có overflow:clip nên pull-to-refresh sẵn có
// của trình duyệt không bao giờ kích hoạt — cử chỉ vuốt xuống ở đỉnh danh sách
// không còn tải lại trang. File này dựng lại đúng cử chỉ đó trên chính khung
// cuộn, chỉ chạy với thiết bị cảm ứng.

const CX_PTR_TRIGGER = 64; // kéo quá ngần này (px) thì nhả tay là tải lại
const CX_PTR_MAX = 88; // kéo tối đa, phần dư bị giảm dần cho có lực cản
const CX_PTR_SEL = "#setup-scroll, #config-scroll, #guests-scroll";

let _ptrEl = null; // khung cuộn đang kéo
let _ptrY0 = 0;
let _ptrDist = 0;
let _ptrArmed = false; // đã bắt đầu ở đỉnh khung cuộn chưa

/** Vòng chỉ báo treo dưới thanh trên, chỉ hiện trong lúc kéo. */
function _ptrIndicator() {
  let el = document.getElementById("cx-ptr");
  if (!el) {
    el = document.createElement("div");
    el.id = "cx-ptr";
    el.className = "cx-ptr";
    el.innerHTML = '<i data-lucide="refresh-cw"></i>';
    document.body.appendChild(el);
    window.lucide?.createIcons?.({ nameAttr: "data-lucide" });
  }
  return el;
}

function _ptrRender(d) {
  const el = _ptrIndicator();
  const p = Math.min(d / CX_PTR_TRIGGER, 1);
  el.style.transform = `translate(-50%, ${Math.min(d, CX_PTR_MAX)}px)`;
  el.style.opacity = String(p);
  el.classList.toggle("is-ready", d >= CX_PTR_TRIGGER);
  if (_ptrEl) _ptrEl.style.transform = `translateY(${Math.min(d, CX_PTR_MAX)}px)`;
}

function _ptrReset(animate) {
  const el = _ptrIndicator();
  el.style.opacity = "0";
  el.style.transform = "translate(-50%, 0)";
  el.classList.remove("is-ready");
  if (_ptrEl) {
    _ptrEl.style.transition = animate ? "transform 0.2s ease" : "";
    _ptrEl.style.transform = "";
    if (animate) setTimeout(() => _ptrEl && (_ptrEl.style.transition = ""), 220);
  }
  _ptrEl = null;
  _ptrDist = 0;
  _ptrArmed = false;
}

function _ptrStart(e) {
  if (e.touches.length !== 1) return;
  const sc = e.target.closest?.(CX_PTR_SEL);
  // Chỉ bắt khi khung đã ở đỉnh — giữa danh sách thì đó là cử chỉ cuộn bình thường.
  if (!sc || sc.scrollTop > 0) return;
  _ptrEl = sc;
  _ptrY0 = e.touches[0].clientY;
  _ptrArmed = true;
  _ptrDist = 0;
}

function _ptrMove(e) {
  if (!_ptrArmed || !_ptrEl) return;
  const dy = e.touches[0].clientY - _ptrY0;
  // Vuốt lên hoặc khung đã rời đỉnh → trả lại cho hành vi cuộn bình thường.
  if (dy <= 0 || _ptrEl.scrollTop > 0) {
    if (_ptrDist) _ptrReset(true);
    _ptrArmed = false;
    return;
  }
  e.preventDefault(); // giữ khung đứng yên, tay đang kéo chứ không cuộn
  // Quá ngưỡng thì mỗi px kéo thêm chỉ nhích được một phần — cảm giác có lực cản.
  _ptrDist = dy <= CX_PTR_TRIGGER ? dy : CX_PTR_TRIGGER + (dy - CX_PTR_TRIGGER) * 0.35;
  _ptrRender(_ptrDist);
}

function _ptrEnd() {
  if (!_ptrArmed || !_ptrEl) return;
  const fire = _ptrDist >= CX_PTR_TRIGGER;
  _ptrReset(true);
  if (!fire) return;
  // Còn thay đổi chưa lưu thì hỏi trước — tải lại là mất trắng phần đang sửa.
  if (typeof _isDirty !== "undefined" && _isDirty) {
    if (!confirm("Có thay đổi chưa lưu. Tải lại trang và bỏ phần đang sửa?")) return;
  }
  window.location.reload();
}

function _initPullRefresh() {
  if (!("ontouchstart" in window)) return;
  document.addEventListener("touchstart", _ptrStart, { passive: true });
  document.addEventListener("touchmove", _ptrMove, { passive: false });
  document.addEventListener("touchend", _ptrEnd, { passive: true });
  document.addEventListener("touchcancel", () => _ptrReset(true), { passive: true });
}

window.__cxOnReady(_initPullRefresh);
