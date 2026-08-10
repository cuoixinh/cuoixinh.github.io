// Màn "Quản lý thiệp cưới": lưới thẻ thiệp của người dùng (Của tôi / Xuất bản / Nháp).
// Nguồn dữ liệu: API ?resource=my-weddings (khi đã đăng nhập) gộp với đơn trong
// localStorage (khách chưa đăng nhập vẫn thấy nháp đã tạo trên máy này).

// Client dùng chung do core/supabase.js dựng (chính là AuthUI.supabase) — khai lại
// ở đây là trùng tên biến toàn cục, cả trang chết ngay khi nạp.
const sb = window.supabaseClient;

let currentUser = null;
let CARDS = [];
let ACTIVE_TAB = "all";
// theme (template_name) → tên hiển thị, nạp một lần từ ?resource=public-templates.
let THEME_NAMES = {};

const POST_LOGIN_REDIRECT_KEY = "post_login_redirect";

// Trang này là đích đăng nhập chung của cả site: mở kèm ?urlRedirect=... thì lưu
// đích rồi dọn query, để redirectTo gửi cho Supabase luôn là URL gốc (đã whitelist).
(function captureLoginRedirect() {
  const params = new URLSearchParams(window.location.search);
  const urlRedirect = params.get("urlRedirect");
  if (!urlRedirect) return;

  sessionStorage.setItem(POST_LOGIN_REDIRECT_KEY, urlRedirect);
  params.delete("urlRedirect");
  const cleanQuery = params.toString();
  window.history.replaceState(
    {},
    "",
    window.location.pathname + (cleanQuery ? `?${cleanQuery}` : "") + window.location.hash,
  );
})();

// freshLogin = vừa đăng nhập (SIGNED_IN) → mang toast "Đăng nhập thành công" sang
// trang đích, nếu không toast chỉ chớp một nhịp rồi bị replace() xoá.
function _redirectAfterLogin(freshLogin) {
  if (!currentUser) return;
  const target = sessionStorage.getItem(POST_LOGIN_REDIRECT_KEY);
  if (!target) return;
  sessionStorage.removeItem(POST_LOGIN_REDIRECT_KEY);
  if (freshLogin && window.AuthUI?.armLoginToast) AuthUI.armLoginToast();
  window.location.replace(target);
}

// ===== KHỞI TẠO =====

async function initPage() {
  loadThemeNames();
  // Lấy phiên TRƯỚC rồi mới đăng ký onChange: ngược lại lần đồng bộ đầu tiên bắn
  // luôn callback và trang tải danh sách hai lần.
  currentUser = await CXAuth.getUser();
  updateAuthUI();
  await loadCards();
  _redirectAfterLogin();

  CXAuth.onChange((user, event) => {
    currentUser = user;
    updateAuthUI();
    loadCards();
    _redirectAfterLogin(event === "SIGNED_IN");
  });
}

async function logout() {
  await sb.auth.signOut();
  window.location.replace(window.location.pathname);
}

function openLoginPopup() {
  if (!window.AuthUI) return;
  AuthUI.openModal({
    title: "Đăng nhập",
    subtitle: "Đồng bộ và quản lý thiệp cưới của bạn trên mọi thiết bị",
    oauthRedirect: window.location.origin + window.location.pathname,
  });
}

function updateAuthUI() {
  const loginBtn = document.getElementById("navLoginBtn");
  const menu = document.getElementById("user-menu");

  if (!currentUser) {
    if (loginBtn) loginBtn.style.display = "";
    menu.classList.add("hidden");
    closeUserDropdown();
    return;
  }

  if (loginBtn) loginBtn.style.display = "none";
  menu.classList.remove("hidden");

  const meta = currentUser.user_metadata || {};
  const name = meta.full_name || meta.name || "Người dùng";
  document.getElementById("user-name").textContent = name;
  document.getElementById("user-email").textContent = currentUser.email || "";

  const avatar = document.getElementById("user-avatar");
  if (meta.avatar_url) {
    avatar.innerHTML = `<img src="${escAttr(meta.avatar_url)}" alt="" class="h-full w-full object-cover" />`;
  } else {
    avatar.textContent = name.trim().charAt(0).toUpperCase() || "?";
  }
}

// ===== DỮ LIỆU =====

function _ordersKey() {
  return buildCacheKey("orders", currentUser ? currentUser.email : "guest");
}

function _titleFromTheme(theme) {
  return (
    (theme || "")
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ") || "Thiệp cưới"
  );
}

function themeName(theme) {
  return THEME_NAMES[theme] || _titleFromTheme(theme);
}

// Tên hiển thị của mẫu ("Truyền thống 01"…) — thiếu thì thẻ rơi về tên slug hoá hoa.
async function loadThemeNames() {
  try {
    const res = await fetch(CONFIG.supabase.edgeUrl + "?resource=public-templates", {
      headers: { Authorization: "Bearer " + CONFIG.supabase.anonKey },
    });
    if (!res.ok) return;
    const list = await res.json();
    if (!Array.isArray(list)) return;
    THEME_NAMES = Object.fromEntries(list.map((t) => [t.theme, t.name]));
    if (CARDS.length) render();
  } catch (e) {
    /* để nguyên tên rơi về */
  }
}

async function fetchMyWeddings() {
  if (!currentUser) return [];
  const token = await CXAuth.accessToken();
  if (!token) return [];
  try {
    const res = await fetch(CONFIG.supabase.edgeUrl + "?resource=my-weddings", {
      headers: {
        apikey: CONFIG.supabase.anonKey,
        Authorization: "Bearer " + token,
      },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (e) {
    return [];
  }
}

// Đơn trong localStorage không có expires_at → expiresAt = undefined nghĩa là
// "không rõ hạn dùng thử", thẻ chỉ hiện trạng thái chứ không đếm ngày.
function _cardFromOrder(o) {
  return {
    id: o.manage_id,
    slug: null,
    groom: o.groomName || "",
    bride: o.brideName || "",
    theme: o.theme || "",
    published: o.status !== "draft",
    expiresAt: o.status === "completed" ? null : undefined,
    createdAt: o.date,
  };
}

function _cardFromWedding(w) {
  return {
    id: w.id,
    slug: w.slug || null,
    groom: w.groom_name || "",
    bride: w.bride_name || "",
    theme: w.theme || "",
    published: !!w.is_published,
    expiresAt: w.expires_at || null,
    createdAt: w.created_at,
  };
}

async function loadCards() {
  const local = getCache(_ordersKey(), []).filter((o) => o.manage_id);

  if (!currentUser) {
    CARDS = local.map(_cardFromOrder);
    render();
    return;
  }

  setState("loading");
  const weddings = await fetchMyWeddings();
  // DB là nguồn sự thật; đơn local chỉ bù những thiệp chưa kịp đồng bộ.
  const byId = new Map(weddings.map((w) => [w.id, _cardFromWedding(w)]));
  local.forEach((o) => {
    if (!byId.has(o.manage_id)) byId.set(o.manage_id, _cardFromOrder(o));
  });
  CARDS = Array.from(byId.values()).sort(
    (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0),
  );
  render();
}

// ===== TRẠNG THÁI THẺ =====

const DAY_MS = 86400000;

/** draft · trial · expired · active (đã kích hoạt) · published (không rõ hạn). */
function cardState(c) {
  if (!c.published) return "draft";
  if (c.expiresAt === undefined) return "published";
  if (!c.expiresAt) return "active";
  return daysLeft(c) > 0 ? "trial" : "expired";
}

function daysLeft(c) {
  if (!c.expiresAt) return 0;
  return Math.ceil((new Date(c.expiresAt) - Date.now()) / DAY_MS);
}

function matchTab(c, tab) {
  if (tab === "published") return c.published;
  if (tab === "draft") return !c.published;
  return true;
}

// ===== RENDER =====

const TAB_ACTIVE = ["bg-white", "text-gray-900", "shadow-sm"];
const TAB_IDLE = ["text-gray-500", "hover:text-gray-800"];

function render() {
  // Đếm theo TOÀN bộ thẻ (không theo tab đang chọn) để con số không nhảy khi đổi tab.
  const counts = {
    all: CARDS.length,
    published: CARDS.filter((c) => c.published).length,
    draft: CARDS.filter((c) => !c.published).length,
  };

  document.querySelectorAll(".tab-btn").forEach((btn) => {
    const tab = btn.dataset.tab;
    const on = tab === ACTIVE_TAB;
    btn.classList.remove(...TAB_ACTIVE, ...TAB_IDLE);
    btn.classList.add(...(on ? TAB_ACTIVE : TAB_IDLE));
    const badge = btn.querySelector("[data-count]");
    badge.textContent = counts[tab];
    badge.classList.toggle("hidden", !counts[tab]);
  });

  const list = CARDS.filter((c) => matchTab(c, ACTIVE_TAB));
  const grid = document.getElementById("cards-grid");
  grid.innerHTML = list.map((c) => cardHTML(c, CARDS.indexOf(c))).join("");

  if (list.length) setState("grid");
  else if (!currentUser && !CARDS.length) setState("guest");
  else setState("empty", counts);
}

// Bốn khối loại trừ nhau: lưới thẻ · khung xương · rỗng · chưa đăng nhập.
function setState(state, counts) {
  document.getElementById("cards-grid").classList.toggle("hidden", state !== "grid");
  document.getElementById("state-loading").classList.toggle("hidden", state !== "loading");
  document.getElementById("state-empty").classList.toggle("hidden", state !== "empty");
  document.getElementById("state-guest").classList.toggle("hidden", state !== "guest");

  if (state !== "empty") return;
  // Rỗng vì lọc theo tab thì nói rõ, tránh hiểu nhầm là chưa có thiệp nào.
  const filtered = counts && counts.all > 0;
  document.getElementById("empty-title").textContent = filtered
    ? ACTIVE_TAB === "draft"
      ? "Không có thiệp nháp"
      : "Chưa xuất bản thiệp nào"
    : "Chưa có thiệp nào";
  document.getElementById("empty-desc").textContent = filtered
    ? "Đổi sang tab “Của tôi” để xem tất cả thiệp."
    : "Chọn một mẫu thiệp rồi bắt đầu điền thông tin — chỉ mất vài phút.";
}

const BADGE = "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold shadow-sm";

function cardHTML(c, i) {
  const state = cardState(c);
  const title = [c.groom, c.bride].filter(Boolean).join(" & ") || themeName(c.theme);
  const days = daysLeft(c);

  const statusBadge = c.published
    ? `<span class="${BADGE} bg-emerald-500 text-white"><i class="fas fa-check text-[10px]"></i>Đã xuất bản</span>`
    : `<span class="${BADGE} bg-white/90 text-gray-600"><i class="fas fa-pen-nib text-[10px]"></i>Nháp</span>`;

  let leftBadges = "";
  if (state === "trial" || state === "expired" || state === "published") {
    leftBadges =
      `<span class="${BADGE} bg-amber-500 text-white"><i class="fas fa-credit-card text-[10px]"></i>Chưa kích hoạt</span>`;
    if (state === "trial") {
      leftBadges += `<span class="${BADGE} bg-sky-500 text-white"><i class="fas fa-clock text-[10px]"></i>Dùng thử · còn ${days} ngày</span>`;
    } else if (state === "expired") {
      leftBadges += `<span class="${BADGE} bg-red-500 text-white"><i class="fas fa-clock text-[10px]"></i>Hết hạn dùng thử</span>`;
    }
  } else if (state === "active") {
    leftBadges = `<span class="${BADGE} bg-emerald-500 text-white"><i class="fas fa-circle-check text-[10px]"></i>Đã kích hoạt</span>`;
  }

  const note = noteHTML(state, days);
  const slugRow = c.slug ? slugRowHTML(c, i) : "";

  return `
    <div class="group flex flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition-shadow hover:shadow-md">
      <div class="relative h-40 cursor-pointer overflow-hidden bg-gray-50" onclick="openEditor(${i})">
        <img src="/assets/images/templates/${escAttr(c.theme)}.jpg" alt="${escAttr(title)}"
             loading="lazy" onerror="this.style.display='none'"
             class="h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-105" />
        <div class="absolute left-3 top-3 flex flex-col items-start gap-1.5">${leftBadges}</div>
        <div class="absolute right-3 top-3">${statusBadge}</div>
      </div>

      <div class="flex flex-1 flex-col p-5">
        <h3 class="cursor-pointer text-lg font-bold text-gray-900 hover:opacity-80" onclick="openEditor(${i})">${esc(title)}</h3>

        <div class="mt-2.5 space-y-1.5 text-sm text-gray-500">
          <p class="flex items-center gap-2"><i class="far fa-calendar w-4 text-xs text-gray-400"></i>Tạo ${formatDate(c.createdAt)}</p>
          <p class="flex items-center gap-2"><i class="fas fa-palette w-4 text-xs text-gray-400"></i>${esc(themeName(c.theme))}</p>
        </div>

        ${note}
        ${slugRow}

        <div class="mt-4 flex items-center justify-around border-t border-gray-100 pt-2">
          ${actionsHTML(c, i, state)}
        </div>
      </div>
    </div>`;
}

function noteHTML(state, days) {
  if (state === "trial") {
    return `<div class="mt-4 flex gap-2.5 rounded-xl bg-sky-50 p-3 text-xs leading-relaxed text-sky-800">
      <i class="fas fa-clock mt-0.5 text-sky-500"></i>
      <span>Còn ${days} ngày dùng thử. Thanh toán để khách mời vẫn xem được sau khi hết hạn.</span>
    </div>`;
  }
  if (state === "expired") {
    return `<div class="mt-4 flex gap-2.5 rounded-xl bg-red-50 p-3 text-xs leading-relaxed text-red-700">
      <i class="fas fa-triangle-exclamation mt-0.5 text-red-500"></i>
      <span>Đã hết hạn dùng thử, khách mời không mở được thiệp. Kích hoạt để mở lại vĩnh viễn.</span>
    </div>`;
  }
  if (state === "draft") {
    return `<div class="mt-4 flex gap-2.5 rounded-xl bg-gray-50 p-3 text-xs leading-relaxed text-gray-600">
      <i class="fas fa-pen-nib mt-0.5 text-gray-400"></i>
      <span>Thiệp đang là bản nháp. Xuất bản trong trình chỉnh sửa để chia sẻ với khách mời.</span>
    </div>`;
  }
  return "";
}

function slugRowHTML(c, i) {
  return `<div class="mt-4 flex items-center gap-1 rounded-xl bg-gray-50 px-3 py-2">
      <span class="flex-1 truncate font-mono text-xs text-gray-600">/${esc(c.slug)}</span>
      <x-button variant="ghost" tone="neutral" size="sm" icon-only onclick="openSlugModal(${i})" aria-label="Đổi đường dẫn">
        <i class="fas fa-gear text-xs"></i>
      </x-button>
      <x-button variant="ghost" tone="neutral" size="sm" icon-only onclick="copyLink(${i}, this)" aria-label="Sao chép liên kết">
        <i class="fas fa-copy text-xs"></i>
      </x-button>
    </div>`;
}

const ACTION = "flex-1";

function actionsHTML(c, i, state) {
  const out = [];
  if (c.published && c.slug) {
    out.push(`<x-button variant="ghost" tone="neutral" size="sm" icon="fas fa-eye" onclick="viewCard(${i})" class="${ACTION}">Xem</x-button>`);
    out.push(`<x-button variant="ghost" tone="neutral" size="sm" icon="fas fa-share-nodes" onclick="shareCard(${i})" class="${ACTION}">Chia sẻ</x-button>`);
  } else {
    out.push(`<x-button variant="ghost" tone="neutral" size="sm" icon="fas fa-pen" onclick="openEditor(${i})" class="${ACTION}">Chỉnh sửa</x-button>`);
  }
  if (state === "trial" || state === "expired" || state === "published") {
    // Kích hoạt là việc cần chú ý nhất trên thẻ → tô cam. Dùng "!" vì class màu của
    // ghost/neutral cùng độ ưu tiên, không có "!" thì thứ tự trong file CSS quyết định.
    out.push(`<x-button variant="ghost" tone="neutral" size="sm" icon="fas fa-credit-card" onclick="activateCard(${i})" class="${ACTION} !text-amber-600 hover:!bg-amber-50 hover:!text-amber-700">Kích hoạt</x-button>`);
  }
  out.push(`<x-button variant="ghost" tone="danger" size="sm" icon-only onclick="deleteCard(${i})" aria-label="Xoá thiệp"><i class="fas fa-trash text-xs"></i></x-button>`);
  return out.join("");
}

// ===== HÀNH ĐỘNG TRÊN THẺ =====

function publicUrl(c) {
  return `${window.location.origin}/${c.slug}`;
}

function openEditor(i) {
  const c = CARDS[i];
  if (!c) return;
  window.location.href = `/invitation-setup/?id=${c.id}`;
}

function viewCard(i) {
  const c = CARDS[i];
  if (c?.slug) window.open(publicUrl(c), "_blank");
}

async function shareCard(i) {
  const c = CARDS[i];
  if (!c?.slug) return;
  const url = publicUrl(c);
  const title = [c.groom, c.bride].filter(Boolean).join(" & ") || "Thiệp cưới";
  if (navigator.share) {
    try {
      await navigator.share({ title: `Thiệp cưới ${title}`, url });
      return;
    } catch (e) {
      if (e.name === "AbortError") return; // người dùng đóng bảng chia sẻ
    }
  }
  await navigator.clipboard.writeText(url);
  showToast("Đã sao chép liên kết thiệp", "success");
}

async function copyLink(i, btn) {
  const c = CARDS[i];
  if (!c?.slug) return;
  await navigator.clipboard.writeText(publicUrl(c));
  const icon = btn.querySelector("i");
  icon.className = "fas fa-check text-xs";
  setTimeout(() => (icon.className = "fas fa-copy text-xs"), 2000);
  showToast("Đã sao chép liên kết thiệp", "success");
}

function activateCard(i) {
  const c = CARDS[i];
  if (!c || !window.PaymentModal) return;
  PaymentModal.open(themeName(c.theme), c.theme || "basic-gold", {}, c.id);
}

// Xoá = ẩn thiệp (is_active = false) — API my-weddings chỉ trả thiệp is_active,
// nên bản ghi biến khỏi danh sách nhưng dữ liệu/ảnh vẫn còn để khôi phục được.
async function deleteCard(i) {
  const c = CARDS[i];
  if (!c) return;
  const title = [c.groom, c.bride].filter(Boolean).join(" & ") || themeName(c.theme);
  const ok = await showConfirm(
    "Xoá thiệp?",
    `Thiệp “${title}” sẽ biến mất khỏi danh sách và khách mời không mở được nữa.`,
    { confirmText: "Xoá thiệp" },
  );
  if (!ok) return;

  showLoading(true, "Đang xoá thiệp...");
  try {
    await weddingBL.updateWedding({ id: c.id, is_active: false });
    CARDS = CARDS.filter((x) => x !== c);
    _dropFromLocalOrders(c.id);
    render();
    showToast("Đã xoá thiệp", "success");
  } catch (e) {
    showToast(e.message || "Không xoá được thiệp", "error");
  } finally {
    showLoading(false);
  }
}

function _dropFromLocalOrders(manageId) {
  const key = _ordersKey();
  const orders = getCache(key, []);
  setCache(
    key,
    orders.filter((o) => o.manage_id !== manageId),
  );
}

// ===== MODAL: đổi đường dẫn =====

let _slugCardIndex = null;

function openSlugModal(i) {
  const c = CARDS[i];
  if (!c) return;
  _slugCardIndex = i;
  _setInputValue("slug-input", c.slug || "");
  _syncSlugPreview();
  _openModal("slug-modal");
}

function closeSlugModal() {
  _slugCardIndex = null;
  _closeModal("slug-modal");
}

function _syncSlugPreview() {
  const val = document.getElementById("slug-input").value.trim();
  document.getElementById("slug-preview").textContent =
    `${window.location.origin}/${val || "..."}`;
}

async function _submitSlug(e) {
  e.preventDefault();
  const c = CARDS[_slugCardIndex];
  if (!c) return;

  const raw = document.getElementById("slug-input").value.trim();
  if (!raw) {
    showToast("Vui lòng nhập đường dẫn", "error");
    return;
  }

  showLoading(true, "Đang lưu đường dẫn...");
  try {
    // weddingBL.updateWedding tự chuẩn hoá slug; đọc lại để thẻ hiện đúng bản đã lưu.
    const normalized = weddingBL.validateSlug(raw);
    await weddingBL.updateWedding({ id: c.id, slug: normalized });
    c.slug = normalized;
    closeSlugModal();
    render();
    showToast("Đã đổi đường dẫn thiệp", "success");
  } catch (e2) {
    showToast(e2.message || "Không đổi được đường dẫn", "error");
  } finally {
    showLoading(false);
  }
}

// ===== MODAL: thông tin cá nhân =====

function openProfileModal() {
  closeUserDropdown();
  if (!currentUser) return;
  const meta = currentUser.user_metadata || {};
  _setInputValue("profile-name", meta.full_name || meta.name || "");
  _setInputValue("profile-email-input", currentUser.email || "");
  _setInputValue("profile-phone", meta.phone || "");
  _openModal("profile-modal");
}

function closeProfileModal() {
  _closeModal("profile-modal");
}

async function _submitProfile(e) {
  e.preventDefault();
  if (!currentUser) {
    showToast("Vui lòng đăng nhập", "error");
    return;
  }
  const { error } = await sb.auth.updateUser({
    data: {
      full_name: document.getElementById("profile-name").value,
      phone: document.getElementById("profile-phone").value,
    },
  });
  if (error) {
    showToast("Lỗi cập nhật: " + error.message, "error");
    return;
  }
  currentUser = await CXAuth.getUser();
  updateAuthUI();
  closeProfileModal();
  showToast("Đã lưu thông tin cá nhân", "success");
}

function showHelp() {
  showAlert(
    "Quản lý thiệp cưới",
    "Mỗi thẻ là một tấm thiệp. Bấm vào ảnh hoặc tên để mở trình chỉnh sửa.\n" +
      "Thiệp xuất bản được dùng thử 3 ngày; kích hoạt (thanh toán) để khách mời xem vĩnh viễn.\n" +
      "Nút bánh răng cạnh đường dẫn dùng để đổi link chia sẻ.",
    "info",
  );
}

// ===== TIỆN ÍCH =====

function _openModal(id) {
  const m = document.getElementById(id);
  m.classList.remove("hidden");
  m.classList.add("flex");
}

function _closeModal(id) {
  const m = document.getElementById(id);
  m.classList.add("hidden");
  m.classList.remove("flex");
}

// Gán value cho input bên trong <x-input> rồi báo cho x-input tự bật/tắt nút xoá nhanh.
function _setInputValue(id, value) {
  const el = document.getElementById(id);
  if (!el) return;
  el.value = value;
  const host = el.closest("x-input");
  if (host && typeof host.syncClearBtn === "function") host.syncClearBtn();
}

function esc(s) {
  return String(s ?? "").replace(
    /[&<>"']/g,
    (ch) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch],
  );
}

const escAttr = esc;

function formatDate(dateStr) {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("vi-VN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function toggleUserDropdown() {
  document.getElementById("user-dropdown").classList.toggle("hidden");
}

function closeUserDropdown() {
  document.getElementById("user-dropdown")?.classList.add("hidden");
}

// ===== GẮN SỰ KIỆN =====

function bindEvents() {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      ACTIVE_TAB = btn.dataset.tab;
      render();
    });
  });

  document.getElementById("user-menu-btn").addEventListener("click", (e) => {
    e.stopPropagation();
    toggleUserDropdown();
  });
  document.addEventListener("click", closeUserDropdown);

  document.getElementById("profile-form").addEventListener("submit", _submitProfile);
  document.getElementById("slug-form").addEventListener("submit", _submitSlug);
  document.getElementById("slug-input").addEventListener("input", _syncSlugPreview);

  // Bấm ra ngoài để đóng modal
  ["profile-modal", "slug-modal"].forEach((id) => {
    document.getElementById(id).addEventListener("click", function (e) {
      if (e.target === this) _closeModal(id);
    });
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    bindEvents();
    initPage();
  });
} else {
  bindEvents();
  initPage();
}
