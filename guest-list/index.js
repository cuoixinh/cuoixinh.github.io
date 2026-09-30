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
function _glState(state) {
  ["loading", "guest", "empty", "error"].forEach((s) =>
    document.getElementById(`state-${s}`)?.classList.toggle("hidden", s !== state),
  );
  document.getElementById("list").classList.toggle("hidden", state !== "list");
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

// Hạn dùng thử: expires_at null = đã kích hoạt; hết hạn thì khách mời không mở
// được thiệp nhưng chủ thiệp vẫn quản lý danh sách được — chỉ báo, không chặn.
function _glBadge(w) {
  if (!w.expires_at) return "";
  const days = Math.ceil((new Date(w.expires_at) - Date.now()) / 86400000);
  return days > 0
    ? `<span class="gl-badge gl-badge-trial">Dùng thử · còn ${Math.min(days, CONFIG.trialDays)} ngày</span>`
    : `<span class="gl-badge gl-badge-expired">Hết hạn dùng thử</span>`;
}

function _glCardHTML(w) {
  const names = [w.groom_name, w.bride_name].filter(Boolean).join(" & ") || "Thiệp cưới";
  const cover = _glCover(w);
  // Ô ảnh luôn mang sẵn icon dự phòng; ảnh (nếu có) đè lên trên, tải hỏng thì tự gỡ.
  const thumb =
    `<div class="gl-thumb"><i data-lucide="image" style="width:20px;height:20px"></i>` +
    (cover
      ? `<img src="${_glEsc(cover)}" alt="" loading="lazy" onerror="this.remove()" />`
      : "") +
    `</div>`;
  const href = `/invitation-setup/guests/?id=${encodeURIComponent(w.id)}&from=list`;
  return (
    `<a class="gl-card gl-card-link" href="${href}">` +
    thumb +
    `<div class="min-w-0 flex-1">` +
    `<p class="gl-names">${_glEsc(names)}</p>` +
    (w.slug ? `<p class="gl-slug">${_glEsc(location.host)}/${_glEsc(w.slug)}</p>` : "") +
    _glBadge(w) +
    `</div>` +
    `<span class="gl-go"><i data-lucide="users" style="width:16px;height:16px"></i>` +
    `<i data-lucide="chevron-right" style="width:16px;height:16px"></i></span>` +
    `</a>`
  );
}

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
  _glState("list");
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
