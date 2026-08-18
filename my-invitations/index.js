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
    window.location.pathname +
      (cleanQuery ? `?${cleanQuery}` : "") +
      window.location.hash,
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
  // Chuyển hướng TRƯỚC khi tải danh sách: trang này chỉ là chặng trung chuyển khi
  // có urlRedirect, tải thêm một vòng API rồi rời đi là phí.
  _redirectAfterLogin();
  await loadCards();

  CXAuth.onChange((user, event) => {
    currentUser = user;
    updateAuthUI();
    _redirectAfterLogin(event === "SIGNED_IN");
    loadCards();
  });
}

async function logout() {
  await sb.auth.signOut();
  window.location.replace(window.location.pathname);
}

// Trang này có sẵn form hồ sơ và hàm logout riêng → nối vào menu tài khoản chung.
window.CXAccount?.configure({ onProfile: openProfileModal, onLogout: logout });

function openLoginPopup() {
  if (!window.AuthUI) return;
  AuthUI.openModal({
    title: "Đăng nhập",
    subtitle: "Đồng bộ và quản lý thiệp cưới của bạn trên mọi thiết bị",
    oauthRedirect: window.location.origin + window.location.pathname,
  });
}

// Mục "Tài khoản" ở navbar giữ nguyên nhãn ở mọi trạng thái phiên (giống các
// trang khác); trạng thái phiên thể hiện ở NỘI DUNG menu, nạp lúc mở.
function updateAuthUI() {
  window.CXAccount?.close(); // phiên đổi → menu tài khoản đang mở không còn đúng
}

// ===== DỮ LIỆU =====

function _ordersKey() {
  return buildCacheKey("orders", currentUser ? currentUser.email : "guest");
}

const GUEST_ORDERS_KEY = buildCacheKey("orders", "guest");

// Đơn tạo lúc chưa đăng nhập nằm ở key "guest"; đăng nhập xong phải DỌN sang key
// theo email, nếu không thiệp vừa làm biến mất khỏi danh sách như bị mất.
// Gộp theo manage_id, bản ở key email thắng (đã đồng bộ xa hơn).
function _absorbGuestOrders() {
  if (!currentUser) return;
  const guest = getCache(GUEST_ORDERS_KEY, []);
  if (!Array.isArray(guest) || !guest.length) return;

  const key = _ordersKey();
  const mine = getCache(key, []);
  const mineIds = new Set(mine.map((o) => o.manage_id).filter(Boolean));
  const added = guest.filter((o) => o.manage_id && !mineIds.has(o.manage_id));
  setCache(key, mine.concat(added));
  removeCache(GUEST_ORDERS_KEY);
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
    const res = await fetch(
      CONFIG.supabase.edgeUrl + "?resource=public-templates",
      {
        headers: { Authorization: "Bearer " + CONFIG.supabase.anonKey },
      },
    );
    if (!res.ok) return;
    const list = await res.json();
    if (!Array.isArray(list)) return;
    THEME_NAMES = Object.fromEntries(list.map((t) => [t.theme, t.name]));
    if (CARDS.length) render();
  } catch (e) {
    /* để nguyên tên rơi về */
  }
}

// Ném lỗi khi không lấy được danh sách — người gọi phải phân biệt "không có thiệp"
// với "hỏng mạng", nuốt lỗi thành [] là báo sai cho người dùng là mất thiệp.
async function fetchMyWeddings() {
  const token = await CXAuth.accessToken();
  if (!token) throw new Error("Phiên đăng nhập đã hết hạn");

  const res = await fetch(CONFIG.supabase.edgeUrl + "?resource=my-weddings", {
    headers: {
      apikey: CONFIG.supabase.anonKey,
      Authorization: "Bearer " + token,
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

// Đơn trong localStorage không có expires_at → expiresAt = undefined nghĩa là
// "không rõ hạn dùng thử", thẻ chỉ hiện trạng thái chứ không đếm ngày.
// local = chỉ tồn tại trên máy này (chưa có bản ghi DB) → xoá thẻ không gọi API.
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
    local: true,
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
    local: false,
  };
}

// Đổi phiên (đăng nhập/xuất) làm loadCards chạy chồng nhau; chỉ lần gọi MỚI NHẤT
// được phép ghi CARDS, nếu không kết quả cũ về sau sẽ đè lên kết quả mới.
let _loadSeq = 0;

async function loadCards() {
  const seq = ++_loadSeq;
  _absorbGuestOrders();
  const local = getCache(_ordersKey(), []).filter((o) => o.manage_id);

  if (!currentUser) {
    CARDS = local.map(_cardFromOrder);
    render();
    return;
  }

  setState("loading");
  let weddings;
  try {
    weddings = await fetchMyWeddings();
  } catch (e) {
    if (seq !== _loadSeq) return;
    setState("error");
    return;
  }
  if (seq !== _loadSeq) return;

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

// Màu chữ do .cx-segtab (styles/_common.css) lo — ở đây chỉ còn nền + bóng của
// ô đang chọn và cờ .is-on.
const TAB_ACTIVE = ["bg-rose-pastel-100", "is-on"];
const TAB_IDLE = [];

function render() {
  // Trang này là nơi DUY NHẤT biết danh sách thiệp trên DB → ghi lại id để ô đếm
  // "Đã chọn" ở navbar các trang khác hiện đúng số mà không phải gọi API.
  window.CXCartCount?.remember(CARDS.map((c) => c.id));

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

  // Chỉ số nhớ sẵn theo CARDS: các hàm onclick trên thẻ nhắm vào CARDS[i], không
  // phải vị trí trong danh sách đã lọc.
  const grid = document.getElementById("cards-grid");
  const list = [];
  CARDS.forEach((c, i) => {
    if (matchTab(c, ACTIVE_TAB)) list.push(cardHTML(c, i));
  });
  grid.innerHTML = list.join("");

  if (list.length) setState("grid");
  else if (!currentUser && !CARDS.length) setState("guest");
  else setState("empty", counts);
}

// Năm khối loại trừ nhau: lưới thẻ · khung xương · rỗng · chưa đăng nhập · lỗi tải.
// Mỗi lúc chỉ được MỘT nút "Tạo thiệp mới": khối rỗng đã có nút riêng nên nút ở
// đầu trang phải ẩn đi (khối "chưa đăng nhập" chỉ có nút Đăng nhập nên giữ).
function setState(state, counts) {
  document
    .getElementById("btn-new-top")
    ?.classList.toggle("hidden", state === "empty");

  document
    .getElementById("cards-grid")
    .classList.toggle("hidden", state !== "grid");
  document
    .getElementById("state-loading")
    .classList.toggle("hidden", state !== "loading");
  document
    .getElementById("state-empty")
    .classList.toggle("hidden", state !== "empty");
  document
    .getElementById("state-guest")
    .classList.toggle("hidden", state !== "guest");
  document
    .getElementById("state-error")
    .classList.toggle("hidden", state !== "error");

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

const BADGE =
  "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold shadow-sm sm:px-2 sm:text-[10px]";

function cardHTML(c, i) {
  const state = cardState(c);
  const title =
    [c.groom, c.bride].filter(Boolean).join(" & ") || themeName(c.theme);
  const days = daysLeft(c);

  const statusBadge = c.published
    ? `<span class="${BADGE} bg-emerald-500 text-white"><i data-icon="check" class="text-[9px]"></i>Đã xuất bản</span>`
    : `<span class="${BADGE} bg-white/90 text-gray-600"><i data-icon="pen-tool" class="text-[9px]"></i>Nháp</span>`;

  let leftBadges = "";
  if (state === "trial" || state === "expired" || state === "published") {
    leftBadges = `<span class="${BADGE} bg-amber-500 text-white"><i data-icon="credit-card" class="text-[9px]"></i>Chưa kích hoạt</span>`;
    if (state === "trial") {
      leftBadges += `<span class="${BADGE} bg-sky-500 text-white"><i data-icon="clock" class="text-[9px]"></i><span class="sm:hidden">Còn ${days} ngày</span><span class="hidden sm:inline">Dùng thử · còn ${days} ngày</span></span>`;
    } else if (state === "expired") {
      leftBadges += `<span class="${BADGE} bg-red-500 text-white"><i data-icon="clock" class="text-[9px]"></i><span class="sm:hidden">Hết hạn</span><span class="hidden sm:inline">Hết hạn dùng thử</span></span>`;
    }
  } else if (state === "active") {
    leftBadges = `<span class="${BADGE} bg-emerald-500 text-white"><i data-icon="circle-check" class="text-[9px]"></i>Đã kích hoạt</span>`;
  }

  const note = noteHTML(state, days, i);
  const slugRow = c.slug ? slugRowHTML(c, i) : "";

  return `
    <div class="group flex flex-col overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm transition-shadow hover:shadow-md">
      <div class="relative h-24 cursor-pointer overflow-hidden bg-gray-50 sm:h-28" onclick="openEditor(${i})">
        <img src="/assets/images/templates/${escAttr(c.theme)}.jpg" alt="${escAttr(title)}"
             loading="lazy" onerror="this.style.display='none'"
             class="h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-105" />
        <!-- Hai cụm: trái = kích hoạt / hạn dùng thử, phải = trạng thái thiệp
             (Nháp · Đã xuất bản). Mobile đã là 1 thẻ/hàng nên ảnh đủ rộng, hai
             cụm không còn đè lên nhau như hồi lưới 2 cột. -->
        <div class="absolute left-1.5 top-1.5 flex flex-col items-start gap-1 sm:left-2 sm:top-2">${leftBadges}</div>
        <div class="absolute right-1.5 top-1.5 sm:right-2 sm:top-2">${statusBadge}</div>
      </div>

      <div class="flex flex-1 flex-col p-3 sm:p-4">
        <h3 class="cursor-pointer truncate text-[13px] font-bold text-gray-900 hover:opacity-80 sm:text-[15px]" onclick="openEditor(${i})">${esc(title)}</h3>

        <p class="mt-1 flex items-center gap-1.5 text-[11px] text-gray-500 sm:text-[12px]">
          <i data-icon="palette" class="text-[10px] text-gray-400"></i>
          <span class="truncate">${esc(themeName(c.theme))}</span>
          <span class="text-gray-300">·</span>
          <span class="shrink-0">${formatDate(c.createdAt)}</span>
        </p>

        ${note}
        ${slugRow}
        <!-- Nêm co giãn: giữ tối thiểu 12px, phần dư đẩy hàng nút xuống đáy thẻ để
             các thẻ cùng hàng thẳng chân nhau. -->
        <div class="mt-3 flex-1"></div>

        <div class="flex items-center justify-around border-t border-gray-100 pt-1.5">
          ${actionsHTML(c, i, state)}
        </div>
      </div>
    </div>`;
}

// Hiện ở MỌI khổ màn: đây là chỗ duy nhất nói rõ thiệp còn mấy ngày dùng thử /
// đã hết hạn — ẩn trên mobile là khách không biết vì sao thiệp sắp đóng.
function noteHTML(state, days, i) {
  if (state === "trial") {
    // "Thanh toán ngay" mở thẳng bảng thanh toán như nút "Kích hoạt thiệp" ở
    // hàng nút dưới — câu này là chỗ khách đọc thấy hạn, đừng bắt họ đi tìm nút.
    return `<div class="mt-3 flex gap-2 rounded-lg bg-sky-50 p-2.5 text-[11px] leading-relaxed text-sky-800">
      <i data-icon="clock" class="mt-0.5 text-[11px] text-sky-500"></i>
      <span>Còn ${days} ngày dùng thử -
        <button type="button" onclick="activateCard(${i})"
          class="font-semibold underline underline-offset-2 hover:text-sky-900">Thanh toán</button>
        để giữ thiệp mở.</span>
    </div>`;
  }
  if (state === "expired") {
    return `<div class="mt-3 flex gap-2 rounded-lg bg-red-50 p-2.5 text-[11px] leading-relaxed text-red-700">
      <i data-icon="triangle-alert" class="mt-0.5 text-[11px] text-red-500"></i>
      <span>Hết hạn dùng thử — kích hoạt để mở lại cho khách mời.</span>
    </div>`;
  }
  if (state === "draft") {
    return `<div class="mt-3 flex gap-2 rounded-lg bg-gray-50 p-2.5 text-[11px] leading-relaxed text-gray-600">
      <i data-icon="pen-tool" class="mt-0.5 text-[11px] text-gray-400"></i>
      <span>Bản nháp — xuất bản để chia sẻ với khách mời.</span>
    </div>`;
  }
  return "";
}

// Icon lucide nhúng thẳng (trang dùng Font Awesome cho phần còn lại, nhưng bộ nút
// này theo lucide như các trang khác). copyLink() đổi qua lại hai icon nên phải
// thay CẢ NỘI DUNG nút, không đổi được bằng class như icon font.
const ICON_COPY =
  '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>';
const ICON_SETTINGS =
  '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>';
const ICON_CHECK =
  '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';

// Hiện ở mọi khổ màn hình: đổi đường dẫn và sao chép link là hai việc chính của
// thiệp đã xuất bản, ẩn trên mobile là mất hẳn lối vào.
function slugRowHTML(c, i) {
  return `<div class="mt-3 flex items-center gap-0.5 rounded-lg bg-gray-50 px-2 py-1 sm:px-2.5">
      <span class="min-w-0 flex-1 truncate font-mono text-[11px] text-gray-600">/${esc(c.slug)}</span>
      <x-button variant="ghost" tone="neutral" size="xs" icon-only onclick="openSlugModal(${i})" aria-label="Đổi đường dẫn">${ICON_SETTINGS}</x-button>
      <x-button variant="ghost" tone="neutral" size="xs" icon-only onclick="copyLink(${i}, this)" aria-label="Sao chép liên kết">${ICON_COPY}</x-button>
    </div>`;
}

// Hàng nút cuối thẻ: toàn nút icon-only cỡ bằng nhau, `justify-around` của thẻ
// rải đều — thẻ 2 nút hay 4 nút đều cân, không nút nào giãn hay bị bóp.
// Bề ngang thẻ hẹp nhất chỉ ~132px (2 cột, máy 360px) mà riêng "Chỉnh sửa" kèm
// chữ đã 93px, nên hàng này KHÔNG kèm được nhãn: 4 nút có chữ cần ~272px, tràn
// ở mọi khổ 3–4 cột. Tên hành động nằm ở title/aria-label.
// `shrink-0` là bắt buộc: mặc định flex cho co, thiếu nó nút Xoá bị bóp còn 11px.
const ACTION = "shrink-0";

// `icon` = tên icon lucide (core/helpers/icon.js).
function _actionBtn(icon, title, onclick, extra = "") {
  return (
    `<x-button variant="ghost" tone="neutral" size="xs" icon-only onclick="${onclick}"` +
    ` title="${escAttr(title)}" aria-label="${escAttr(title)}" class="${ACTION} ${extra}">` +
    cxIcon(icon, 13) +
    `</x-button>`
  );
}

// Tối đa 4 nút. "Chỉnh sửa" LUÔN có mặt (trước đây thiệp đã xuất bản chỉ vào sửa
// được bằng cách bấm ảnh/tên — không ai đoán ra); khi cần "Kích hoạt" thì bỏ
// "Chia sẻ", link vẫn sao chép được ở hàng đường dẫn ngay trên.
function actionsHTML(c, i, state) {
  const needsActivate =
    state === "trial" || state === "expired" || state === "published";
  const out = [];
  if (c.published && c.slug) {
    out.push(_actionBtn("eye", "Xem thiệp", `viewCard(${i})`));
  }
  out.push(_actionBtn("pencil", "Chỉnh sửa", `openEditor(${i})`));
  if (c.published && c.slug && !needsActivate) {
    out.push(_actionBtn("share-2", "Chia sẻ", `shareCard(${i})`));
  }
  if (needsActivate) {
    // Kích hoạt là việc cần chú ý nhất trên thẻ → tô cam. Dùng "!" vì class màu của
    // ghost/neutral cùng độ ưu tiên, không có "!" thì thứ tự trong file CSS quyết định.
    out.push(
      _actionBtn(
        "credit-card",
        "Kích hoạt thiệp",
        `activateCard(${i})`,
        "!text-amber-600 hover:!bg-amber-50 hover:!text-amber-700",
      ),
    );
  }
  out.push(
    `<x-button variant="ghost" tone="danger" size="xs" icon-only onclick="deleteCard(${i})"` +
      ` title="Xoá thiệp" aria-label="Xoá thiệp" class="${ACTION}">` +
      `<i data-icon="trash-2" class="text-[11px]"></i></x-button>`,
  );
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
  if (await _copyText(url)) showToast("Đã sao chép liên kết thiệp", "success");
}

async function copyLink(i, btn) {
  const c = CARDS[i];
  if (!c?.slug) return;
  if (!(await _copyText(publicUrl(c)))) return;
  btn.innerHTML = ICON_CHECK;
  setTimeout(() => (btn.innerHTML = ICON_COPY), 2000);
  showToast("Đã sao chép liên kết thiệp", "success");
}

// clipboard ném lỗi khi trang không phải HTTPS hoặc người dùng chặn quyền — không
// bắt thì nút bấm im lặng, người dùng tưởng đã copy được.
async function _copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (e) {
    showAlert("Không sao chép được", `Hãy sao chép thủ công:\n${text}`, "info");
    return false;
  }
}

// Sang TRANG thanh toán (/checkout/) chứ không mở hộp thoại: khách tải lại
// trang, bấm lùi hay mở lại link vẫn ra đúng đơn.
function activateCard(i) {
  const c = CARDS[i];
  if (!c) return;
  window.location.href = cxCheckoutUrl({
    id: c.id,
    theme: c.theme || "basic-gold",
    name: themeName(c.theme),
  });
}

// Xoá = ẩn thiệp (is_active = false) — API my-weddings chỉ trả thiệp is_active,
// nên bản ghi biến khỏi danh sách nhưng dữ liệu/ảnh vẫn còn để khôi phục được.
async function deleteCard(i) {
  const c = CARDS[i];
  if (!c) return;
  const title =
    [c.groom, c.bride].filter(Boolean).join(" & ") || themeName(c.theme);
  const ok = await showConfirm(
    "Xoá thiệp?",
    `Thiệp “${title}” sẽ biến mất khỏi danh sách và khách mời không mở được nữa.`,
    { confirmText: "Xoá thiệp" },
  );
  if (!ok) return;

  // Thẻ chưa có bản ghi DB (đơn nháp trên máy) thì không có gì để gọi API — gọi
  // vào chỉ nhận 401/404 rồi báo lỗi oan.
  if (c.local) {
    CARDS = CARDS.filter((x) => x !== c);
    _dropFromLocalOrders(c.id);
    render();
    showToast("Đã xoá thiệp", "success");
    return;
  }

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

// Đổi đường dẫn thiệp: dùng THẲNG hộp thoại base (showPrompt ở
// core/helpers/alert.js) thay vì modal riêng — cùng khung, cùng nút với mọi hộp
// thoại khác trong app. `hint` chạy lại mỗi lần gõ để xem trước link.
function openSlugModal(i) {
  const c = CARDS[i];
  if (!c) return;

  showPrompt("Đổi đường dẫn thiệp", {
    message: "Khách mời sẽ mở thiệp bằng đường dẫn này.",
    value: c.slug || "",
    placeholder: "vd: lan-anh",
    okText: "Lưu",
    hint: (v) => `${window.location.origin}/${_normalizeSlug(v) || "..."}`,
  }).then((raw) => {
    if (raw === null) return; // huỷ / đóng
    _saveSlug(c, raw);
  });
}

// Preview phải là đường dẫn ĐÃ chuẩn hoá y như lúc lưu ("Lan Anh" → "lan-anh"),
// không thì người dùng thấy một link mà nhận về một link khác.
function _normalizeSlug(raw) {
  try {
    return weddingBL.validateSlug(raw);
  } catch (e) {
    return "";
  }
}

async function _saveSlug(c, raw) {
  const normalized = _normalizeSlug(raw);
  if (!normalized) {
    showToast("Đường dẫn phải có ít nhất một chữ cái hoặc chữ số", "error");
    return;
  }
  if (normalized === c.slug) return;

  showLoading(true, "Đang lưu đường dẫn...");
  try {
    // weddingBL.updateWedding tự chuẩn hoá slug; gửi bản đã chuẩn hoá để thẻ hiện
    // đúng thứ đã lưu mà không phải tải lại danh sách.
    await weddingBL.updateWedding({ id: c.id, slug: normalized });
    c.slug = normalized;
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
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        ch
      ],
  );
}

const escAttr = esc;

function formatDate(dateStr) {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (isNaN(d)) return "-"; // đơn cũ trong localStorage có thể thiếu/hỏng trường date
  // Dạng số ngắn (10/8/2026) — thẻ đã chật, "10 tháng 8, 2026" chiếm gần cả dòng.
  return d.toLocaleDateString("vi-VN");
}

// ===== GẮN SỰ KIỆN =====

function bindEvents() {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      ACTIVE_TAB = btn.dataset.tab;
      render();
    });
  });

  document
    .getElementById("profile-form")
    .addEventListener("submit", _submitProfile);
  // Bấm ra ngoài để đóng modal
  ["profile-modal"].forEach((id) => {
    document.getElementById(id).addEventListener("click", function (e) {
      if (e.target === this) _closeModal(id);
    });
  });

  // Esc: đóng modal đang mở, không có modal nào thì đóng menu tài khoản.
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const open = ["profile-modal"].find(
      (id) => !document.getElementById(id).classList.contains("hidden"),
    );
    if (open) _closeModal(open);
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
