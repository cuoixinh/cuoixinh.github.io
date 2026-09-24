// Màn "Quản lý thiệp cưới": lưới thẻ thiệp của người dùng (Của tôi / Xuất bản / Nháp).
// Nguồn dữ liệu: weddingDAL.listMyWeddings() (khi đã đăng nhập — LUÔN hỏi thẳng
// server, không cache) gộp với đơn trong localStorage (khách chưa đăng nhập vẫn
// thấy nháp đã tạo trên máy này).

// Client dùng chung do core/supabase.js dựng (chính là AuthUI.supabase) — khai lại
// ở đây là trùng tên biến toàn cục, cả trang chết ngay khi nạp.
const sb = window.supabaseClient;

let currentUser = null;
let CARDS = [];
let ACTIVE_TAB = "all";
// theme (template_name) → tên hiển thị, nạp một lần qua templatesDAL.
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
  document.getElementById("keep-note").textContent = UNPAID_KEEP_TEXT;
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

// ===== NHÁP TRÊN MÁY ↔ TÀI KHOẢN =====
// Đăng nhập: danh sách CHỈ là thiệp của tài khoản (DB). Nháp chỉ nằm trên máy
// (listLocalDrafts, core/cache-util.js) không hiện, cũng không bị xoá — đăng xuất
// ra vẫn thấy. Gộp nháp lên tài khoản LUÔN phải khách XÁC NHẬN: máy có thể dùng
// chung, tự gộp là thiệp người này rơi vào tài khoản người kia. Xác nhận → lưu lên
// DB rồi xoá bản trên máy; "Không" → không hỏi lại về đúng những nháp đó (dòng
// nhắc #local-drafts-note là lối quay lại); đóng hộp thoại → lần sau hỏi lại.

// Key phải KHÔNG bắt đầu bằng "draft_" hay "orders_" — hai tiền tố đó bị quét
// như nháp/đơn ở draft-retention.js và draft-start.js.
function _declinedKey(email) {
  return buildCacheKey("declined_drafts", email);
}

let _holdLocalNote = false;
let _mergeAsking = null; // loadCards chạy chồng (đổi phiên, quay lại tab) → chỉ một hộp thoại

// Trả true khi đã đưa được ít nhất một nháp lên tài khoản (nơi gọi nạp lại danh sách).
// savedCount = số thiệp tài khoản đang giữ, để chặn trần TRƯỚC khi hỏi.
function _offerMergeLocalDrafts(savedCount) {
  if (!currentUser) return Promise.resolve(false);
  if (!_mergeAsking)
    _mergeAsking = _askMergeLocalDrafts(savedCount).finally(() => {
      _mergeAsking = null;
    });
  return _mergeAsking;
}

async function _askMergeLocalDrafts(savedCount) {
  const email = currentUser.email;
  const declined = new Set(getCache(_declinedKey(email), []));
  const asking = listLocalDrafts().filter((d) => !declined.has(d.id));
  if (!asking.length) return false;

  // Trần số thiệp (chốt thật ở Edge Function, CONFIG.maxWeddings là bản sao): không
  // đủ chỗ thì nói ngay thay vì hỏi rồi lưu được nửa chừng. Mỗi phiên trình duyệt
  // chỉ nhắc một lần — mỗi lần mở trang lại hiện một hộp thoại là quá phiền.
  const free = CONFIG.maxWeddings - savedCount;
  if (asking.length > free) {
    const flag = buildCacheKey("merge_full_warned", email);
    if (sessionStorage.getItem(flag)) return false;
    sessionStorage.setItem(flag, "1");
    showAlert(
      "Chưa đồng bộ được thiệp nháp trên thiết bị",
      `Thiết bị này có ${asking.length} thiệp nháp chưa đồng bộ vào tài khoản, nhưng tài khoản ` +
        `đã dùng ${savedCount}/${CONFIG.maxWeddings} thiệp. Xoá bớt thiệp trong danh ` +
        `sách rồi mở lại trang này để đồng bộ.`,
      "warning",
    );
    return false;
  }

  // Tên thiệp là chữ khách gõ → escape trước khi bật html. Markup viết liền một dòng:
  // thân hộp thoại để `white-space: pre-line` nên xuống dòng trong chuỗi là ra dòng trống.
  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  // Tên cặp đôi nối bằng trái tim thay cho " & " của _draftTitle; nháp chưa đủ hai
  // tên thì rơi về đúng _draftTitle (một tên, hoặc tên mẫu).
  const heart = `<span style="color:#e11d48;margin:0 4px">&#9829;</span>`;
  const coupleHTML = (d) => {
    const both = [d.groom_name, d.bride_name].filter(Boolean);
    return both.length === 2
      ? both.map(esc).join(heart)
      : esc(_draftTitle(d));
  };
  const names = asking
    .map((d) => `<li style="margin:4px 0"><b>${coupleHTML(d.data)}</b></li>`)
    .join("");
  const r = await showConfirm(
    "Thiệp nháp trên thiết bị này",
    `Thiết bị này có <b>${asking.length} thiệp nháp</b> chưa đồng bộ vào tài khoản nào:` +
      `<ul style="margin:8px 0 12px;padding:8px 12px;list-style:none;border-radius:12px;background:rgba(244,63,94,.06)">${names}</ul>` +
      `Bạn có muốn đồng bộ ${asking.length > 1 ? "các thiệp này" : "thiệp này"} vào tài khoản <b>${esc(email)}</b> không?`,
    { type: "info", icon: "file-pen", html: true, confirmText: "Đồng bộ ngay", cancelText: "Không" },
  );
  if (r === false)
    setCache(_declinedKey(email), [...declined, ...asking.map((d) => d.id)]);
  if (!r) return false;
  const toMerge = asking;

  let merged = 0;
  let imgFailed = 0;
  showLoading(true, "Đang đồng bộ thiệp vào tài khoản...");
  try {
    for (const d of toMerge) {
      imgFailed += await _uploadLocalDraft(d);
      merged++;
    }
  } catch (e) {
    // Nháp chưa lên được vẫn nằm nguyên trên máy — lần sau hỏi lại.
    if (e.code === "WEDDING_LIMIT") showAlert("Đã đủ số thiệp cho phép", e.message, "warning");
    else showToast(e.message || "Không đồng bộ được thiệp vào tài khoản", "error");
  } finally {
    showLoading(false);
  }
  if (imgFailed)
    showToast(
      `${imgFailed} ảnh chưa đồng bộ được — mở thiệp trên thiết bị này rồi bấm Lưu để thử lại`,
      "warning",
    );
  else if (merged)
    showToast("Đã đồng bộ thiệp vào tài khoản", "success");
  return merged > 0;
}

// Dòng nhắc "máy này còn N nháp" → hỏi lại cả những nháp đã trả lời "Không".
function reofferLocalDrafts() {
  if (!currentUser) return;
  const ids = new Set(listLocalDrafts().map((d) => d.id));
  const key = _declinedKey(currentUser.email);
  setCache(key, getCache(key, []).filter((id) => !ids.has(id)));
  sessionStorage.removeItem(buildCacheKey("merge_full_warned", currentUser.email));
  loadCards();
}

// Một nháp → tài khoản: tạo hàng DB (trần số thiệp chặn ở đây), đẩy ảnh chờ
// upload trong IndexedDB lên Storage, PATCH nội dung + tên file ảnh, rồi xoá bản
// trên máy. Trả số ảnh đẩy hỏng — chúng ở lại IndexedDB, trang Thiết lập khôi phục
// theo id thiệp và đẩy lên ở lần lưu kế tiếp. Ảnh trong IndexedDB đã nén sẵn lúc
// khách chọn (10-images.js) nên đẩy thẳng. Khuôn bản ghi IDB: invitation-setup/js/02-idb.js.
async function _uploadLocalDraft({ id, data }) {
  const { _localOnly, _savedAt, _owner, is_published, deleted_images, id: _id, slug, ...fields } = data;
  const created = await weddingDAL.createDraftWedding({
    manage_id: id,
    theme: fields.theme || "basic-gold",
    slug: slug || `wedding-${id.slice(0, 8)}`,
  });

  let rows = [];
  try {
    rows = (await _readPendingRows()).filter((r) => r.weddingId === id);
  } catch (e) {
    /* không có IDB → nháp không có ảnh chờ */
  }
  const done = []; // key IDB đã đẩy xong → xoá
  let failed = 0;
  const focal = { gallery_images: {} };
  const up = async (field, file) => {
    try {
      return await imageBL.uploadSingleImage(id, field, file);
    } catch (e) {
      console.error("merge upload:", field, e);
      failed++;
      return null;
    }
  };

  for (const r of rows.filter((r) => r.type === "single" && r.file)) {
    const name = await up(r.fieldName, r.file);
    if (!name) continue;
    fields[r.fieldName] = name;
    if (r.focalPoint) focal[r.fieldName] = r.focalPoint;
    done.push(r.key);
  }

  const gallery = Array.isArray(fields.gallery_images) ? [...fields.gallery_images] : [];
  const gRows = rows
    .filter((r) => r.type === "gallery" && r.file)
    .sort((a, b) => (a.order || 0) - (b.order || 0));
  for (let i = 0; i < gRows.length; i++) {
    const name = await up(`gallery-${i}`, gRows[i].file);
    if (!name) continue;
    gallery.push(name);
    if (gRows[i].focalPoint) focal.gallery_images[name] = gRows[i].focalPoint;
    done.push(gRows[i].key);
  }
  fields.gallery_images = gallery;

  const ls = rows.find((r) => r.type === "love_story_images");
  if (ls?.images?.length) {
    let items = [];
    try {
      items = JSON.parse(fields.love_story || "[]");
    } catch (e) {}
    const left = [];
    for (const { idx, file } of ls.images) {
      const name = items[idx] ? await up(`love_story_image_${idx}`, file) : null;
      if (name) items[idx].image_url = name;
      else if (items[idx]) left.push({ idx, file });
    }
    fields.love_story = JSON.stringify(items);
    if (!left.length) done.push(ls.key);
  }

  await weddingDAL.updateWedding({
    ...fields,
    id,
    slug: created?.slug || slug,
    image_focal_points: focal,
  });
  removeCache(buildCacheKey("draft", id));
  _dropOrdersEverywhere(id);
  await _deletePendingRows(done).catch(() => {});
  return failed;
}

// Đơn (cache "orders") của một thiệp ở MỌI key — guest lẫn từng email.
function _dropOrdersEverywhere(manageId) {
  const prefix = buildCacheKey("orders") + "_";
  listCacheKeys((k) => k.startsWith(prefix)).forEach((key) => {
    const orders = getCache(key, []);
    if (!Array.isArray(orders)) return;
    const kept = orders.filter((o) => o?.manage_id !== manageId);
    if (kept.length !== orders.length) setCache(key, kept);
  });
}

function _draftTitle(d) {
  return [d.groom_name, d.bride_name].filter(Boolean).join(" & ") || themeName(d.theme);
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
    const list = await templatesDAL.list();
    if (!list.length) return;
    THEME_NAMES = Object.fromEntries(list.map((t) => [t.theme, t.name]));
    if (CARDS.length) render();
  } catch (e) {
    /* để nguyên tên rơi về */
  }
}

// local = chỉ tồn tại trên máy này (chưa có bản ghi DB) → xoá thẻ không gọi API.
// Nháp trên máy thì chưa bao giờ xuất bản được.
function _cardFromDraft({ id, data }) {
  return {
    id,
    slug: null,
    groom: data.groom_name || "",
    bride: data.bride_name || "",
    theme: data.theme || "",
    published: false,
    expiresAt: undefined,
    createdAt: data._savedAt ? new Date(data._savedAt).toISOString() : null,
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
    cover: _coverUrl(w),
  };
}

// Thumbnail của thẻ = ảnh THẬT của khách, KHÔNG BAO GIỜ rơi về ảnh mẫu của mẫu
// thiệp: thẻ này là dữ liệu thật của khách, thấy ảnh mẫu là hiểu nhầm mình đã
// đặt ảnh đó. Cột chỉ chứa tên file nên phải qua storageDAL.getPublicUrl (nó tự
// đi đường worker proxy khi có). Chưa có ảnh nào — hoặc nháp chỉ nằm trên máy,
// ảnh còn trong IndexedDB — thì thẻ hiện ô "Chưa có ảnh bìa".
function _coverUrl(w) {
  const file = w.cover_image_url || (w.gallery_images || [])[0] || "";
  return file ? storageDAL.getPublicUrl(file) : "";
}

// Đổi phiên (đăng nhập/xuất) làm loadCards chạy chồng nhau; chỉ lần gọi MỚI NHẤT
// được phép ghi CARDS, nếu không kết quả cũ về sau sẽ đè lên kết quả mới.
let _loadSeq = 0;

async function loadCards() {
  const seq = ++_loadSeq;

  if (!currentUser) {
    CARDS = listLocalDrafts()
      .map(_cardFromDraft)
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    render();
    return;
  }

  // Danh sách đã có sẵn trên màn (lần tải lại) thì giữ nguyên, chỉ lần đầu mới
  // bật khung xương — nếu không mỗi lần quay lại tab là trang chớp một nhịp.
  if (!CARDS.length) setState("loading");
  let weddings;
  try {
    weddings = await weddingDAL.listMyWeddings();
    if (seq !== _loadSeq) return;
    _holdLocalNote = true; // dòng nhắc chờ hộp gộp xong, không thì chớp lên rồi tắt
    _showAccountCards(weddings);
    // Hỏi gộp SAU khi danh sách đã hiện (và biết số thiệp đang giữ để chặn trần).
    const merged = await _offerMergeLocalDrafts(weddings.length).finally(() => {
      _holdLocalNote = false;
    });
    if (seq !== _loadSeq) return;
    if (merged) weddings = await weddingDAL.listMyWeddings();
  } catch (e) {
    if (seq !== _loadSeq) return;
    setState("error");
    return;
  }
  if (seq !== _loadSeq) return;
  _showAccountCards(weddings);
}

function _showAccountCards(weddings) {
  // Đã đăng nhập: CHỈ thiệp của tài khoản (DB là nguồn sự thật duy nhất). Đơn
  // local đã rời nháp mà DB không còn (xoá ở máy khác, cron dọn) thì dọn luôn —
  // ô đếm navbar đọc chúng.
  const dbIds = new Set(weddings.map((w) => w.id));
  const ordersKey = buildCacheKey("orders", currentUser.email);
  const orders = getCache(ordersKey, []);
  if (Array.isArray(orders)) {
    const kept = orders.filter((o) => o?.status === "draft" || dbIds.has(o?.manage_id));
    if (kept.length !== orders.length) setCache(ordersKey, kept);
  }
  CARDS = weddings.map(_cardFromWedding).sort(
    (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0),
  );
  render();
}

// ===== TRẦN SỐ THIỆP MỖI TÀI KHOẢN =====

// Chỉ đếm thẻ CÓ bản ghi DB: nháp còn nằm trên máy chưa tốn gì của hệ thống nên
// không tính vào trần (khớp cách Edge Function đếm).
function savedCount() {
  return CARDS.filter((c) => !c.local).length;
}

// Bọc quanh cxStartDefaultDraft để chặn SỚM: hết chỗ mà vẫn cho đi tiếp thì khách
// điền xong cả thiệp mới bị từ chối lúc lưu. Chốt thật nằm ở Edge Function
// (_shared/wedding-limits.ts) — CONFIG.maxWeddings ở đây chỉ là bản sao để vẽ UI.
function newInvitation() {
  const max = CONFIG.maxWeddings;
  if (currentUser && savedCount() >= max) {
    showAlert(
      "Đã đủ số thiệp cho phép",
      `Mỗi tài khoản chỉ giữ tối đa ${max} thiệp (tính cả nháp đã lưu). Hãy xoá ` +
        `bớt thiệp cũ trong danh sách rồi tạo thiệp mới.`,
      "warning",
    );
    return;
  }
  cxStartDefaultDraft();
}

// Nút "Tải lại": danh sách vốn đã luôn lấy tươi, nút này chỉ để hỏi lại ngay
// mà không phải tải lại trang.
async function refreshCards() {
  const btn = document.getElementById("btn-refresh");
  btn?.classList.add("animate-spin");
  try {
    await loadCards();
  } finally {
    btn?.classList.remove("animate-spin");
  }
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

// Số ngày còn lại, LÀM TRÒN LÊN (còn vài giờ vẫn là "còn 1 ngày"). Kẹp trên bằng
// CONFIG.trialDays: đồng hồ máy khách chạy chậm hơn máy chủ là hiệu số vượt quá
// hạn dùng thử, hiện "còn 4 ngày" trong khi hạn chỉ có 3.
function daysLeft(c) {
  if (!c.expiresAt) return 0;
  const d = Math.ceil((new Date(c.expiresAt) - Date.now()) / DAY_MS);
  return Math.max(0, Math.min(CONFIG.trialDays, d));
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

  // Số thiệp đã giữ / trần — chỉ có nghĩa khi đã đăng nhập (khách vãng lai chỉ
  // thấy nháp trên máy, vốn không tính vào trần).
  const note = document.getElementById("count-note");
  note.textContent = ` · ${savedCount()}/${CONFIG.maxWeddings} thiệp`;
  note.classList.toggle("hidden", !currentUser);

  // Nháp chỉ nằm trên máy mà tài khoản này chưa nhận (đã bấm "Không", hoặc đang
  // chờ hộp hỏi gộp thì chưa hiện để khỏi chớp).
  const n = currentUser && !_holdLocalNote ? listLocalDrafts().length : 0;
  const localNote = document.getElementById("local-drafts-note");
  localNote.classList.toggle("hidden", !n);
  localNote.classList.toggle("flex", !!n);
  document.getElementById("local-drafts-text").textContent =
    `Thiết bị này còn ${n} thiệp nháp chưa đồng bộ vào tài khoản (chỉ nằm trên trình duyệt này).`;

  // Chỉ số nhớ sẵn theo CARDS: các hàm onclick trên thẻ nhắm vào CARDS[i], không
  // phải vị trí trong danh sách đã lọc.
  const grid = document.getElementById("cards-grid");
  const list = [];
  CARDS.forEach((c, i) => {
    if (matchTab(c, ACTIVE_TAB)) list.push(cardHTML(c, i));
  });
  grid.innerHTML = list.join("");
  window.lucide?.createIcons({ root: grid });
  paintLocalThumbs(); // ảnh nháp nằm trong IDB → gán sau, không chặn lần vẽ này

  if (list.length) setState("grid");
  else if (!currentUser && !CARDS.length) setState("guest");
  else setState("empty", counts);
}

// Năm khối loại trừ nhau: lưới thẻ · khung xương · rỗng · chưa đăng nhập · lỗi tải.
// Mỗi lúc chỉ được MỘT nút "Tạo thiệp mới": khối rỗng đã có nút riêng nên nút ở
// đầu trang phải ẩn đi (khối "chưa đăng nhập" chỉ có nút Đăng nhập nên giữ).
// Lúc đang tải, CẢ MÀN là khung xương: nút đầu trang, dòng nhắc hạn và thanh
// tab đều nhường chỗ cho bản khung xương của chính chúng rồi cùng lật một lượt
// khi dữ liệu về — lật lẻ tẻ thì trang giật mấy nhịp liền.
function setState(state, counts) {
  const loading = state === "loading";
  const pair = (realId, skelId, hideReal) => {
    document.getElementById(realId)?.classList.toggle("hidden", hideReal);
    document.getElementById(skelId)?.classList.toggle("hidden", !loading);
  };

  pair("btn-new-top", "btn-new-top-sk", loading || state === "empty");
  pair("keep-note", "keep-note-sk", loading);
  pair("tabs", "tabs-sk", loading);

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
  "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[8px] font-semibold shadow-sm sm:px-2";

// ===== THUMBNAIL CỦA NHÁP TRÊN MÁY =====
// Nháp chưa đăng nhập chưa đẩy ảnh lên Storage: ảnh còn nằm trong IndexedDB của
// trình chỉnh sửa (`cuoixinh_pending`, `weddingId` = ?id= = manage_id của thẻ).
// Đọc THẲNG ở đây.
// Ghi đúng một chỗ: _deletePendingRows, sau khi gộp nháp đã đẩy ảnh lên xong.
const PENDING_IDB = "cuoixinh_pending";
const PENDING_STORE = "uploads";

// id thẻ → objectURL đang gán. Giữ lại để thu hồi trước khi tạo cái mới; bỏ qua
// là mỗi lần render lại rò thêm một blob.
const _thumbBlobUrls = new Map();

// Mở bản ĐANG CÓ (không truyền version): trang này không sở hữu schema đó, nâng
// cấp nhầm là hỏng nháp của trình chỉnh sửa.
function _openPendingIDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(PENDING_IDB);
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
    req.onblocked = () => reject(new Error("blocked"));
  });
}

async function _deletePendingRows(keys) {
  if (!keys.length) return;
  const db = await _openPendingIDB();
  if (!db.objectStoreNames.contains(PENDING_STORE)) return;
  await new Promise((res, rej) => {
    const tx = db.transaction(PENDING_STORE, "readwrite");
    const store = tx.objectStore(PENDING_STORE);
    keys.forEach((k) => store.delete(k));
    tx.oncomplete = res;
    tx.onerror = (e) => rej(e.target.error);
  });
}

async function _readPendingRows() {
  const db = await _openPendingIDB();
  if (!db.objectStoreNames.contains(PENDING_STORE)) return [];
  return new Promise((res, rej) => {
    const req = db
      .transaction(PENDING_STORE, "readonly")
      .objectStore(PENDING_STORE)
      .getAll();
    req.onsuccess = (e) => res(e.target.result || []);
    req.onerror = (e) => rej(e.target.error);
  });
}

// Ảnh bìa trước, không có thì tấm carousel đầu tiên — cùng thứ tự ưu tiên với
// thiệp đã lưu trên hệ thống (_coverUrl).
function _pendingCoverFile(rows) {
  const cover = rows.find(
    (r) => r.type === "single" && r.fieldName === "cover_image_url" && r.file,
  );
  if (cover) return cover.file;
  const gallery = rows
    .filter((r) => r.type === "gallery" && r.file)
    .sort((a, b) => (a.order || 0) - (b.order || 0));
  return gallery[0]?.file || null;
}

async function paintLocalThumbs() {
  const ids = new Set(CARDS.filter((c) => c.local).map((c) => c.id));
  if (!ids.size) return;

  let rows;
  try {
    rows = await _readPendingRows();
  } catch (e) {
    return; // không có IDB / bị chặn → thẻ giữ ảnh mẫu
  }

  ids.forEach((id) => {
    const img = document.querySelector(`img[data-thumb="${CSS.escape(id)}"]`);
    if (!img) return; // thẻ đang bị tab lọc ẩn đi
    const file = _pendingCoverFile(rows.filter((r) => r.weddingId === id));
    if (!file) return;

    const old = _thumbBlobUrls.get(id);
    if (old) URL.revokeObjectURL(old);
    const url = URL.createObjectURL(file);
    _thumbBlobUrls.set(id, url);

    // Thẻ đang hiện ô "Chưa có ảnh bìa" (chưa có src, hoặc ảnh cũ hỏng) → mở lại.
    img.style.display = "";
    img.src = url;
  });
}

// Ảnh 1x1 trong suốt cho thẻ chưa có ảnh: src="" phân giải thành URL trang hiện
// tại → trình duyệt tải HTML về rồi vẽ icon vỡ.
const BLANK_PX =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

// Ảnh khách hỏng/đã bị dọn → ẩn hẳn để lộ ô "Chưa có ảnh bìa" nằm dưới. KHÔNG
// thay bằng ảnh mẫu của theme: thẻ chỉ được hiện dữ liệu thật của khách.
function thumbFallback(img) {
  img.style.display = "none";
}

function cardHTML(c, i) {
  const state = cardState(c);
  const title =
    [c.groom, c.bride].filter(Boolean).join(" & ") || themeName(c.theme);
  const days = daysLeft(c);

  const statusBadge = c.published
    ? `<span class="${BADGE} bg-emerald-500 text-white"><i data-lucide="clipboard-check" style="width:12px;height:12px"></i>Đã xuất bản</span>`
    : `<span class="${BADGE} bg-gray-100 text-gray-600" title="${escAttr(draftKeepText(c))}"><i data-lucide="pen-tool" style="width:12px;height:12px"></i>Nháp</span>`;

  let leftBadges = "";
  if (state === "trial" || state === "expired" || state === "published") {
    leftBadges = `<span class="${BADGE} bg-amber-500 text-white" title="${escAttr(UNPAID_KEEP_TEXT)}"><i data-lucide="credit-card" style="width:12px;height:12px"></i>Chưa kích hoạt</span>`;
    if (state === "trial") {
      leftBadges += `<span class="${BADGE} bg-sky-500 text-white"><i data-lucide="clock" style="width:12px;height:12px"></i><span class="sm:hidden">Còn ${days} ngày</span><span class="hidden sm:inline">Dùng thử · còn ${days} ngày</span></span>`;
    } else if (state === "expired") {
      leftBadges += `<span class="${BADGE} bg-red-500 text-white"><i data-lucide="clock" style="width:12px;height:12px"></i>Hết hạn</span>`;
    }
  } else if (state === "active") {
    leftBadges = `<span class="${BADGE} bg-emerald-500 text-white"><i data-lucide="circle-check" style="width:12px;height:12px"></i>Đã kích hoạt</span>`;
  }

  const note = noteHTML(c, state, days, i);
  const slugRow = c.slug ? slugRowHTML(c, i) : "";

  return `
    <div class="group flex min-h-[200px] overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm transition-shadow hover:shadow-md">
      <!-- Cột trái = 2/5 bề ngang thẻ, ảnh bìa CHIẾM TRỌN cột (không lề, không
           khung tỉ lệ) nên sát mép trái/trên/dưới của thẻ; ảnh dọc bị cắt bớt là
           đúng ý, object-top giữ phần đầu ảnh. Ô "Chưa có ảnh bìa" nằm dưới ảnh,
           lộ ra khi thẻ chưa có ảnh hoặc ảnh hỏng. -->
      <div class="relative w-2/5 shrink-0 cursor-pointer overflow-hidden bg-gray-100" onclick="openEditor(${i})">
        <div class="absolute inset-0 flex flex-col items-center justify-center gap-1 px-2 text-center text-gray-400">
          <i data-lucide="image-off" style="width:20px;height:20px"></i>
          <span class="text-[10px] leading-tight">Chưa có ảnh bìa</span>
        </div>
        <img data-thumb="${escAttr(c.id)}" src="${escAttr(c.cover || BLANK_PX)}" alt="${escAttr(title)}"
             loading="lazy" onerror="thumbFallback(this)"
             ${c.cover ? "" : 'style="display:none"'}
             class="absolute inset-0 h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.04]" />
      </div>

      <!-- Viền dọc mép trái = ranh giới ảnh ↔ phần chữ (giống .tt-cardbody của
           thẻ mẫu thiệp, chỉ xoay ngang vì thẻ này chia cột). -->
      <div class="flex min-w-0 flex-1 flex-col border-l border-[rgb(var(--brand-primary-rgb)/0.22)] p-3 sm:p-4">
        <!-- Nhãn chuyển hẳn sang cột phải: cột trái chỉ còn 2/5 bề ngang, không
             đủ chỗ cho một nhãn nguyên dòng. Xếp ngang, hết chỗ thì xuống dòng. -->
        <div class="mb-1.5 flex flex-wrap items-center gap-1">${statusBadge}${leftBadges}</div>

        <h3 class="cursor-pointer truncate text-[13px] font-bold text-gray-900 hover:opacity-80 sm:text-[15px]" onclick="openEditor(${i})">${esc(title)}</h3>

        <p class="mt-1 flex items-center gap-1.5 text-[10px] text-gray-500">
          <i data-lucide="palette" class="text-gray-400" style="width:12px;height:12px"></i>
          <span class="truncate">${esc(themeName(c.theme))}</span>
          <span class="text-gray-300">·</span>
          <span class="shrink-0">${formatDate(c.createdAt)}</span>
        </p>

        <!-- Nêm co giãn: phần dư đẩy khối ghi chú + đường dẫn + hàng nút xuống đáy
             thẻ, để tiêu đề luôn nằm sát phần đầu. -->
        <div class="mt-3 flex-1"></div>

        ${note}
        ${slugRow}

        <div class="mt-2 flex flex-wrap items-center justify-around gap-y-1 border-t border-gray-100 pt-1.5">
          ${actionsHTML(c, i, state)}
        </div>
      </div>
    </div>`;
}

// Câu nhắc hạn dọn dẹp tự động — số ngày lấy ở CONFIG.retention, không viết cứng.
// Dùng cho tooltip của nhãn lẫn dải ghim ở đầu trang, nên chỉ là TEXT thuần
// (nhét vào title="" được).
const UNPAID_KEEP_TEXT = `Thiệp chưa thanh toán sẽ tự động xoá sau ${CONFIG.retention.unpaidDays} ngày kể từ khi hết hạn dùng thử.`;

// Nháp trên máy (chưa có bản ghi DB) và nháp đã lưu trên hệ thống có hạn riêng.
function draftKeepText(c) {
  return c.local
    ? `Bản nháp này chỉ nằm trên trình duyệt của thiết bị này và sẽ tự động xoá sau ${CONFIG.retention.localDraftDays} ngày. Đăng nhập để lưu lên hệ thống.`
    : `Thiệp nháp chưa xuất bản sẽ tự động xoá sau ${CONFIG.retention.serverDraftDays} ngày kể từ lần lưu gần nhất.`;
}

// Hiện ở MỌI khổ màn: đây là chỗ duy nhất nói rõ thiệp còn mấy ngày dùng thử /
// đã hết hạn / bao giờ bị dọn — ẩn trên mobile là khách không biết vì sao thiệp
// sắp đóng. Mỗi Ý là MỘT khối riêng: khối trạng thái (việc cần làm bây giờ) và
// khối hạn dọn dẹp (dữ liệu sẽ mất khi nào) — gộp một dòng thì không ai đọc hết.
function _noteBox(tone, icon, inner) {
  const T = {
    sky: ["bg-sky-50 text-sky-800", "text-sky-500"],
    red: ["bg-red-50 text-red-700", "text-red-500"],
    gray: ["bg-gray-50 text-gray-600", "text-gray-400"],
  }[tone];
  return `<div class="flex gap-2 rounded-lg ${T[0]} p-2.5 text-[10px] leading-relaxed">
      <i data-lucide="${icon}" class="mt-0.5 ${T[1]}" style="width:12px;height:12px"></i>
      <span>${inner}</span>
    </div>`;
}

function noteHTML(c, state, days, i) {
  const boxes = [];
  if (state === "trial") {
    // "Thanh toán" mở thẳng bảng thanh toán như nút "Kích hoạt thiệp" ở hàng nút
    // dưới — câu này là chỗ khách đọc thấy hạn, đừng bắt họ đi tìm nút.
    boxes.push(
      _noteBox(
        "sky",
        "clock",
        `Còn ${days} ngày dùng thử -
        <button type="button" onclick="activateCard(${i})"
          class="font-semibold underline underline-offset-2 hover:text-sky-900">Thanh toán</button>
        để giữ thiệp mở.`,
      ),
    );
  } else if (state === "expired" || state === "published") {
    // Động từ trong câu là LỐI VÀO thanh toán, không phải chữ suông — bấm vào mở
    // đúng bảng như nút "Kích hoạt thiệp" ở hàng nút dưới.
    const act = (label) =>
      `<button type="button" onclick="activateCard(${i})"
        class="font-semibold underline underline-offset-2 hover:text-red-900">${label}</button>`;
    boxes.push(
      _noteBox(
        "red",
        "triangle-alert",
        state === "expired"
          ? `Hết hạn dùng thử — ${act("kích hoạt")} để mở lại cho khách mời.`
          : `Thiệp chưa kích hoạt — ${act("thanh toán")} để mở vĩnh viễn.`,
      ),
    );
  } else if (state === "draft") {
    boxes.push(
      _noteBox(
        "gray",
        "pen-tool",
        "Bản nháp — xuất bản để chia sẻ với khách mời.",
      ),
    );
  }
  if (!boxes.length) return "";
  return `<div class="mt-3 space-y-1.5">${boxes.join("")}</div>`;
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
  return `<div class="mt-1.5 flex items-center gap-0.5 rounded-lg bg-gray-50 px-2 py-1 sm:px-2.5">
      <span class="min-w-0 flex-1 truncate font-mono text-[10px] text-gray-600">/${esc(c.slug)}</span>
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

// `icon` = tên icon lucide.
function _actionBtn(icon, title, onclick, extra = "") {
  return (
    `<x-button variant="ghost" tone="neutral" size="xs" icon-only onclick="${onclick}"` +
    ` title="${escAttr(title)}" aria-label="${escAttr(title)}" class="${ACTION} ${extra}">` +
    `<i data-lucide="${icon}" style="width:13px;height:13px"></i>` +
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
    out.push(_actionBtn("eye", "Xem thiệp", `viewCard(${i}, this)`));
  }
  out.push(_actionBtn("pencil", "Chỉnh sửa", `openEditor(${i})`));
  if (c.published && c.slug && !needsActivate) {
    out.push(_actionBtn("share-2", "Chia sẻ", `shareCard(${i}, this)`));
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
      `<i data-lucide="trash-2" class="text-[11px]" style="width:16px;height:16px"></i></x-button>`,
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

// Mọi nút đụng tới link thiệp (xem · chia sẻ · sao chép) mở popover chọn nhà:
// link nhà trai là link chung kèm ?isGroom=true (thiệp ưu tiên lễ/tiệc nhà trai).
// Một popover dùng chung cho mọi thẻ, neo theo nút vừa bấm.
function _pickSide(btn, onPick) {
  let pop = document.getElementById("side-link-pop");
  if (!pop) {
    pop = document.createElement("x-popover");
    pop.id = "side-link-pop";
    pop.setAttribute("placement", "bottom");
    pop.setAttribute("align", "end");
    pop.setAttribute("arrow", "");
    document.body.appendChild(pop);
  }
  const ico = (name) =>
    `<i data-lucide="${name}" style="width:16px;height:16px"></i>`;
  pop.setItems([
    { icon: ico("house"), label: "Nhà trai", onClick: () => onPick("groom") },
    { icon: ico("heart"), label: "Nhà gái", onClick: () => onPick("bride") },
  ]);
  window.lucide?.createIcons({ root: pop });
  pop.toggle(btn);
}

function _sideUrl(c, side) {
  return side === "groom" ? `${publicUrl(c)}?isGroom=true` : publicUrl(c);
}

const _SIDE_NAME = { groom: "nhà trai", bride: "nhà gái" };

function viewCard(i, btn) {
  const c = CARDS[i];
  if (!c?.slug) return;
  _pickSide(btn, (side) => window.open(_sideUrl(c, side), "_blank"));
}

function shareCard(i, btn) {
  const c = CARDS[i];
  if (!c?.slug) return;
  _pickSide(btn, async (side) => {
    const url = _sideUrl(c, side);
    const title =
      [c.groom, c.bride].filter(Boolean).join(" & ") || "Thiệp cưới";
    if (navigator.share) {
      try {
        await navigator.share({ title: `Thiệp cưới ${title}`, url });
        return;
      } catch (e) {
        if (e.name === "AbortError") return; // người dùng đóng bảng chia sẻ
      }
    }
    if (await _copyText(url))
      showToast(`Đã sao chép link thiệp ${_SIDE_NAME[side]}`, "success");
  });
}

function copyLink(i, btn) {
  const c = CARDS[i];
  if (!c?.slug) return;
  _pickSide(btn, async (side) => {
    if (!(await _copyText(_sideUrl(c, side)))) return;
    btn.innerHTML = ICON_CHECK;
    setTimeout(() => (btn.innerHTML = ICON_COPY), 2000);
    showToast(`Đã sao chép link thiệp ${_SIDE_NAME[side]}`, "success");
  });
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
    `Thiệp “${title}” sẽ bị xoá vĩnh viễn: ảnh, danh sách khách mời và lời chúc ` +
      `đều mất, không khôi phục lại được.`,
    { confirmText: "Xoá vĩnh viễn" },
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
    await weddingBL.deleteWedding(c.id);
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
  window.cxDropLocalDraft?.(manageId);
  _dropOrdersEverywhere(manageId);
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
      `Thiệp xuất bản được dùng thử ${CONFIG.trialDays} ngày; kích hoạt (thanh toán) để khách mời xem vĩnh viễn.\n` +
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
  // Danh sách không cache nên chỉ cần hỏi lại mỗi lần người dùng quay về tab
  // này — vừa sửa/thanh toán thiệp ở tab khác là thấy ngay bản mới.
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) loadCards();
  });

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
