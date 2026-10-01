// Màn "Khách mời": liệt kê thiệp ĐÃ XUẤT BẢN của tài khoản (weddingDAL.listMyWeddings,
// luôn hỏi thẳng server) để chọn một thiệp rồi sang trang quản lý khách mời sẵn có
// (invitation-setup/guests/?id=…&from=list — `from=list` cho nút quay lại về đây).
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

// Nhãn hạn dùng thử (dùng lại .mi-tag của my-invitations). expires_at null = đã
// kích hoạt; hết hạn thì khách mời không mở được thiệp nhưng chủ thiệp vẫn quản
// lý danh sách được — chỉ báo, không chặn.
function _glTag(w) {
  if (!w.expires_at)
    return `<span class="mi-tag mi-tag--live">${_ico("badge-check")}Đã kích hoạt</span>`;
  const days = Math.ceil((new Date(w.expires_at) - Date.now()) / 86400000);
  return days > 0
    ? `<span class="mi-tag mi-tag--trial">${_ico("clock")}Dùng thử · còn ${Math.min(days, CONFIG.trialDays)} ngày</span>`
    : `<span class="mi-tag mi-tag--due">${_ico("clock-alert")}Hết hạn dùng thử</span>`;
}

function _glHint(w) {
  if (!w.expires_at || new Date(w.expires_at) > Date.now()) return "";
  return `<p class="mi-hint mi-hint--warn">${_ico("info")}<span>Khách tạm không mở được thiệp, danh sách vẫn quản lý bình thường.</span></p>`;
}

// Thẻ cùng khung với "Quản lý thiệp": ảnh + chữ ở trên, chân thẻ là "Xem thiệp"
// (mở thiệp thật ở tab mới) + nút chính "Quản lý khách mời".
// Ảnh, tên và nút chính cùng một đích nên ảnh bỏ khỏi thứ tự Tab (tabindex=-1).
function _glCardHTML(w) {
  const names = [w.groom_name, w.bride_name].filter(Boolean).join(" & ") || "Thiệp cưới";
  const cover = _glCover(w);
  const href = `/invitation-setup/guests/?id=${encodeURIComponent(w.id)}&from=list`;
  const url = w.slug ? `${location.origin}/${w.slug}` : "";
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
            <x-button variant="bare" icon-only class="mi-slug-copy" data-copy="${_glEsc(url)}"
              title="Sao chép liên kết thiệp" aria-label="Sao chép liên kết thiệp">${_ico("copy", 16)}</x-button>
          </div>` : ""}
        </div>
      </div>
      <div class="mi-card-foot">
        ${url ? `
        <a class="mi-btn mi-btn--soft inline-flex items-center justify-center rounded-full" href="${_glEsc(url)}"
          target="_blank" rel="noopener">${_ico("eye", 16)}Xem thiệp</a>` : ""}
        <a class="mi-btn mi-btn--primary inline-flex items-center justify-center rounded-full" href="${href}">
          ${_ico("users", 16)}Quản lý khách mời</a>
      </div>
    </article>`;
}

// Nút sao chép liên kết trên thẻ (uỷ quyền một lần cho cả lưới).
document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-copy]");
  if (!btn) return;
  navigator.clipboard
    .writeText(btn.dataset.copy)
    .then(() => window.showToast?.("Đã sao chép liên kết thiệp", "success"));
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
