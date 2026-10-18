// Màn "Khách mời": liệt kê thiệp ĐÃ XUẤT BẢN của tài khoản (weddingDAL.listMyWeddings,
// luôn hỏi thẳng server) để chọn một thiệp rồi sang trang quản lý khách mời sẵn có
// (invitation-setup/guests/?id=…&from=list — `from=list` cho nút quay lại về đây).
// Chỉ có MỘT thiệp đã xuất bản thì chuyển thẳng sang trang quản lý của thiệp đó.
// Nháp không có ở đây: quản lý khách mời cần thiệp đã xuất bản (link gửi khách).

let _glUser = null;
// Đổi phiên làm loadList chạy chồng nhau; chỉ lần gọi MỚI NHẤT được vẽ.
let _glSeq = 0;

function _glEsc(s) {
  return String(s ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
}

// Năm khối loại trừ nhau: khung xương · danh sách · chưa đăng nhập · rỗng · lỗi.
// `count` = số thiệp đã xuất bản (chỉ khi có danh sách).
function _glState(state, count) {
  ["loading", "guest", "empty", "error"].forEach((s) =>
    document.getElementById(`state-${s}`)?.classList.toggle("hidden", s !== state),
  );
  document.getElementById("list").classList.toggle("hidden", state !== "list");
  // Ba bước hướng dẫn chỉ đi kèm khối "chưa đăng nhập" / "chưa có thiệp".
  document
    .getElementById("gl-steps")
    ?.classList.toggle("hidden", state !== "guest" && state !== "empty");
  document.getElementById("gl-count").textContent =
    state === "list" ? `${count} thiệp` : "";
  // Nút tải lại chỉ có nghĩa khi đã đăng nhập.
  document
    .getElementById("btn-refresh")
    ?.classList.toggle("hidden", !_glUser || state === "loading");
}

// Ảnh bìa = ảnh THẬT của khách (như thẻ ở my-invitations), không rơi về ảnh mẫu.
function _glCover(w) {
  const file = w.cover_image_url || (w.gallery_images || [])[0] || "";
  return file ? storageDAL.getPublicUrl(file) : "";
}

const _ico = (name, size) =>
  `<i data-lucide="${name}"${size ? ` style="width:${size}px;height:${size}px"` : ""}></i>`;

// Nhãn + dòng gợi ý theo đúng bộ của "Thiệp của tôi" (tagHTML/hintHTML ở
// my-invitations/index.js) — sửa chữ/tông ở bên đó thì sửa cả ở đây. Nhãn chỉ nói
// trạng thái + gói, ngày hết hạn xuống dòng gợi ý để nhãn không tràn ở khổ điện thoại.
// Hết hạn thì khách mời không mở được thiệp nhưng chủ thiệp vẫn quản lý danh sách.
const _GL_PLAN_WARN_DAYS = 14;
const _glDays = (iso) => Math.ceil((new Date(iso) - Date.now()) / 86400000);
const _glDate = (iso) =>
  new Date(iso).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });

function _glStateOf(w) {
  if (w.plan_expires_at) return _glDays(w.plan_expires_at) > 0 ? "plan" : "planExpired";
  if (!w.expires_at) return "active";
  if (w.free_side) return _glDays(w.expires_at) > 0 ? "free" : "expired";
  return _glDays(w.expires_at) > 0 ? "trial" : "expired";
}

function _glTag(w) {
  const state = _glStateOf(w);
  const planName = { "3m": "3 tháng", "6m": "6 tháng" }[w.plan] || "";
  const soon = state === "plan" && _glDays(w.plan_expires_at) <= _GL_PLAN_WARN_DAYS;
  const T = {
    trial: ["trial", "clock", `Dùng thử · còn ${Math.min(_glDays(w.expires_at || 0), CONFIG.trialDays)} ngày`],
    expired: ["due", "clock-alert", w.free_side ? "Hết hạn gói Miễn phí" : "Hết hạn dùng thử"],
    free: ["trial", "gift", `Miễn phí · còn ${Math.min(_glDays(w.expires_at || 0), CONFIG.freePlanDays)} ngày`],
    active: ["live", "badge-check", "Đã thanh toán · Vĩnh viễn"],
    plan: [soon ? "trial" : "live", "badge-check", `Đã thanh toán · ${planName}`],
    planExpired: ["due", "clock-alert", `Hết hạn gói ${planName}`],
  }[state];
  return `<span class="mi-tag mi-tag--${T[0]}">${_ico(T[1])}${T[2]}</span>`;
}

function _glHint(w) {
  const state = _glStateOf(w);
  let H = null;
  if (state === "expired" || state === "planExpired")
    H = ["warn", "triangle-alert", "Khách tạm không mở được thiệp, danh sách vẫn quản lý bình thường"];
  else if (state === "plan") {
    const left = _glDays(w.plan_expires_at);
    H = left <= _GL_PLAN_WARN_DAYS
      ? ["warn", "triangle-alert", `Còn ${left} ngày (đến ${_glDate(w.plan_expires_at)})`]
      : ["", "calendar-check", `Khách mời xem được đến hết ngày ${_glDate(w.plan_expires_at)}`];
  }
  if (!H) return "";
  return `<p class="mi-hint${H[0] ? ` mi-hint--${H[0]}` : ""}">${_ico(H[1])}<span>${H[2]}</span></p>`;
}

// `from` cho nút quay lại của trang quản lý: "list" về màn này, "tab" lùi lịch sử
// (màn này đã bị thay bằng location.replace nên lùi là về trang trước nó).
const _glGuestsHref = (w, from) =>
  `/invitation-setup/guests/?id=${encodeURIComponent(w.id)}&from=${from}`;

// Thẻ cùng khung với "Quản lý thiệp": ảnh + chữ ở trên, chân thẻ là "Xem thiệp"
// (mở thiệp thật ở tab mới) + nút chính "Quản lý khách mời".
// Ảnh, tên và nút chính cùng một đích nên ảnh bỏ khỏi thứ tự Tab (tabindex=-1).
function _glCardHTML(w) {
  const names = [w.groom_name, w.bride_name].filter(Boolean).join(" & ") || "Thiệp cưới";
  const cover = _glCover(w);
  const href = _glGuestsHref(w, "list");
  const url = w.slug ? `${location.origin}/${w.slug}` : "";
  // Gói Miễn phí chỉ mở một bên → Xem/Sao chép đi thẳng bên đó (cxPickSide only).
  const only = w.free_side ? ` data-only="${_glEsc(w.free_side)}"` : "";
  const created = w.created_at ? new Date(w.created_at).toLocaleDateString("vi-VN") : "";
  return `
    <article class="mi-card">
      <div class="mi-card-top">
        <a class="mi-thumb" href="${href}" tabindex="-1" aria-hidden="true">
          <span class="mi-thumb-empty">${_ico("image-off")}<span>Chưa có ảnh bìa</span></span>
          ${cover ? `<img src="${_glEsc(cover)}" alt="" loading="lazy" onerror="this.remove()" />` : ""}
        </a>
        <div class="mi-info">
          ${_glTag(w)}
          <h2 class="mi-title" title="${_glEsc(names)}"><a href="${href}">${_glEsc(names)}</a></h2>
          ${created ? `<p class="mi-meta">${_ico("calendar")}<span>Tạo ngày ${created}</span></p>` : ""}
          ${_glHint(w)}
          <div class="mi-gap"></div>
          ${url ? `
          <div class="mi-slug">
            <span class="mi-slug-text">/${_glEsc(w.slug)}</span>
            <x-button variant="bare" icon-only class="mi-slug-copy" data-copy="${_glEsc(url)}"${only}
              title="Sao chép liên kết thiệp" aria-label="Sao chép liên kết thiệp">${_ico("copy", 16)}</x-button>
          </div>` : ""}
        </div>
      </div>
      <div class="mi-card-foot">
        ${url ? `
        <x-button variant="bare" class="mi-btn mi-btn--soft" data-view="${_glEsc(url)}"${only}
          aria-haspopup="menu">${_ico("eye", 16)}Xem thiệp</x-button>` : ""}
        <a class="mi-btn mi-btn--primary inline-flex items-center justify-center rounded-full" href="${href}">
          ${_ico("users", 16)}Quản lý khách mời</a>
      </div>
    </article>`;
}

// Xem / sao chép link trên thẻ (uỷ quyền một lần cho cả lưới): hỏi Nhà trai /
// Nhà gái trước vì mỗi nhà một link (cxPickSide).
document.addEventListener("click", (e) => {
  const view = e.target.closest("[data-view]");
  if (view) {
    cxPickSide(view, (side) => window.open(cxSideUrl(view.dataset.view, side), "_blank", "noopener"), { only: view.dataset.only });
    return;
  }
  const btn = e.target.closest("[data-copy]");
  if (!btn) return;
  cxPickSide(btn, (side) => {
    const who = side === "groom" ? "nhà trai" : "nhà gái";
    navigator.clipboard
      .writeText(cxSideUrl(btn.dataset.copy, side))
      .then(() => window.showToast?.(`Đã sao chép liên kết thiệp ${who}`, "success"))
      .catch(() => window.showToast?.("Không sao chép được liên kết", "error"));
  }, { only: btn.dataset.only });
});

async function loadList() {
  const seq = ++_glSeq;
  if (!_glUser) {
    _glState("guest");
    return;
  }
  _glState("loading");
  let weddings;
  try {
    weddings = await weddingDAL.listMyWeddings();
  } catch (e) {
    if (seq === _glSeq) _glState("error");
    return;
  }
  if (seq !== _glSeq) return;

  const published = weddings
    .filter((w) => w.is_published)
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  if (!published.length) {
    _glState("empty");
    return;
  }
  // Chỉ một thiệp thì không có gì để chọn: vào thẳng trang quản lý khách mời.
  // replace để Back không quay về màn này rồi lại bị đẩy đi.
  if (published.length === 1) {
    location.replace(_glGuestsHref(published[0], "tab"));
    return;
  }
  const list = document.getElementById("list");
  list.innerHTML = published.map(_glCardHTML).join("");
  window.lucide?.createIcons({ root: list });
  _glState("list", published.length);
}

function openLoginPopup() {
  if (!window.AuthUI) return;
  AuthUI.openModal({
    title: "Đăng nhập",
    subtitle: "Đăng nhập để quản lý danh sách khách mời của thiệp",
    oauthRedirect: window.location.origin + window.location.pathname,
  });
}

(async function initGuestList() {
  _glUser = await CXAuth.getUser();
  await loadList();
  // Lấy phiên TRƯỚC rồi mới nghe onChange, không thì lần đồng bộ đầu tải hai lần.
  CXAuth.onChange((user) => {
    _glUser = user;
    loadList();
  });
})();
