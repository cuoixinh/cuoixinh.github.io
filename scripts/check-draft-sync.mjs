// Kiểm thử luồng nháp trên máy ↔ tài khoản ↔ DB (npm run check:draft-sync, thêm
// --verbose để in cả ca đạt). Hàm của my-invitations, draft-start, draft-retention,
// nav-cart-count, payment chạy NGUYÊN VĂN (trích từ file); loadData/saveAll/màn thanh
// toán dính DOM nên là bản CHÉP LOGIC ở mục "Mô hình" — sửa mấy hàm đó thì sửa cả đây.
// Mỗi "thiết bị" một localStorage/IndexedDB giả, dùng chung một wedding-admin giả.
import fs from "node:fs";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
const R = fileURLToPath(new URL("..", import.meta.url));
const VERBOSE = process.argv.includes("--verbose");
// Lỗi console.error mà mã thật in ra trong ca cố ý gây lỗi (ảnh upload hỏng…) chỉ là nhiễu.
const quietConsole = { ...console, error: VERBOSE ? console.error : () => {} };
const src = (f) => fs.readFileSync(R + f, "utf8");
function fn(file, name) {
  const s = src(file);
  const i = s.search(new RegExp(`(async )?function ${name}\\(`));
  if (i < 0) throw new Error("missing " + name);
  let d = 0;
  for (let k = s.indexOf("{", s.indexOf(")", i)); k < s.length; k++) {
    if (s[k] === "{") d++;
    else if (s[k] === "}" && --d === 0) return s.slice(i, k + 1);
  }
}

// ---------------- Edge Function giả (luật lấy từ wedding-admin/index.ts) ----------------
const DB = new Map();
const IDB = new Map(); // IndexedDB ảnh chờ upload, theo thiết bị
const err = (msg, extra) => Object.assign(new Error(msg), extra);
const server = {
  net: "ok",
  get(uid, id) { // GET ?id= : phải là chủ thiệp
    if (this.net !== "ok") throw err("Failed to fetch");
    const w = DB.get(id);
    if (!w) throw err("HTTP 404", { status: 404 });
    if (!uid || uid !== w.user_id) throw err("HTTP 403", { status: 403 });
    return { ...w };
  },
  post(uid, id, limitReached) { // POST draft flow
    if (!uid) throw err("login", { code: "AUTH_REQUIRED", status: 401 });
    const pendingSlug = arguments[3] || `wedding-${id.slice(0, 8)}`;
    if (DB.has(id)) {
      if (DB.get(id).user_id !== uid) throw err("forbidden", { code: "FORBIDDEN", status: 403 });
      return; // trùng id cùng chủ → 200
    }
    if (limitReached) throw err("limit", { code: "WEDDING_LIMIT", status: 409 });
    DB.set(id, { id, user_id: uid, is_active: true, is_published: false, created_at: new Date().toISOString(), slug: pendingSlug });
  },
  patch(uid, payload) {
    if (this.net !== "ok") throw err("Failed to fetch");
    const w = DB.get(payload.id);
    if (!w) throw err("HTTP 404", { status: 404 });
    if (!uid) throw err("login", { code: "AUTH_REQUIRED", status: 401 });
    if (w.user_id !== uid) throw err("forbidden", { code: "FORBIDDEN", status: 403 });
    if (w.payment_status === "completed" && payload.theme && payload.theme !== w.theme)
      throw err("locked", { code: "THEME_LOCKED", status: 409 });
    const { _localOnly, _savedAt, id, deleted_images, ...f } = payload;
    Object.assign(w, f);
  },
  list(uid) { return [...DB.values()].filter((w) => w.user_id === uid && w.is_active).map((w) => ({ ...w })); },
};

// ---------------- Thiết bị: localStorage riêng + mã thật của repo ----------------
function makeDevice(name) {
  const store = new Map();
  const ctx = {
    console: quietConsole, Date, JSON, Map, Set, Array, Object, Promise, Error, URLSearchParams,
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
      __keys: () => [...store.keys()],
    },
    sessionStorage: (() => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) }; })(),
    document: { getElementById: (id) => (id === "wedding-form" ? {} : null) },
    location: { search: "" },
  };
  ctx.window = ctx;
  const idbRecords = new Map();
  ctx.__idb = idbRecords;
  ctx.indexedDB = { open() {
    const req = {};
    queueMicrotask(() => {
      const db = { objectStoreNames: { contains: () => true }, transaction: () => { const tx = { objectStore: () => ({
        getAll() { const r = {}; queueMicrotask(() => r.onsuccess({ target: { result: [...idbRecords.values()] } })); return r; },
        delete(k) { idbRecords.delete(k); queueMicrotask(() => tx.oncomplete && tx.oncomplete()); },
        openCursor() {
          const cr = {}; const keys = [...idbRecords.keys()]; let i = 0;
          const step = () => queueMicrotask(() => {
            const k = keys[i++];
            cr.onsuccess({ target: { result: k === undefined ? null : { value: idbRecords.get(k), delete: () => idbRecords.delete(k), continue: step } } });
          });
          step(); return cr;
        } }) }; return tx; } };
      req.onsuccess({ target: { result: db } });
    });
    return req;
  } };
  vm.createContext(ctx);
  vm.runInContext(src("core/cache-util.js").replace("Object.keys(localStorage)", "localStorage.__keys()"), ctx);
  vm.runInContext(`var CONFIG={retention:{localDraftDays:30,serverDraftDays:30},trialDays:3,maxWeddings:5};`, ctx);
  vm.runInContext(`var currentUser=null, CARDS=[], _loadSeq=0;
    var ANSWERS = [], ASKED = [], ALERTS = [];
    function showConfirm(t, m){ ASKED.push(m); return Promise.resolve(ANSWERS.length ? ANSWERS.shift() : null); }
    function showAlert(t, m){ ALERTS.push(t + ": " + m); } function showToast(m){ ALERTS.push(m); } function showLoading(){}
    function themeName(t){ return t; }
    let _mergeAsking = null, _holdLocalNote = false;
    ${fn("my-invitations/index.js", "reofferLocalDrafts")}
    ${fn("my-invitations/index.js", "_declinedKey")}
    ${fn("my-invitations/index.js", "_offerMergeLocalDrafts")}
    ${fn("my-invitations/index.js", "_askMergeLocalDrafts")}
    ${fn("my-invitations/index.js", "_uploadLocalDraft")}
    ${fn("my-invitations/index.js", "_dropOrdersEverywhere")}
    ${fn("my-invitations/index.js", "_draftTitle")}
    ${fn("my-invitations/index.js", "_cardFromDraft")}
    ${fn("my-invitations/index.js", "_showAccountCards")}
    const PENDING_IDB = "cuoixinh_pending", PENDING_STORE = "uploads";
    ${fn("my-invitations/index.js", "_openPendingIDB")}
    ${fn("my-invitations/index.js", "_readPendingRows")}
    ${fn("my-invitations/index.js", "_deletePendingRows")}
    var STORAGE = [], FAIL_UPLOAD = new Set(), _n = 0;
    var imageBL = { async uploadSingleImage(id, field, file) {
      if (FAIL_UPLOAD.has(file)) throw new Error("upload 500");
      const name = field + "-" + (++_n) + ".webp"; STORAGE.push(name); return name; } };
    ${fn("my-invitations/index.js", "_cardFromWedding")}
    function _coverUrl(){return ""} function render(){} function setState(){}
    ${fn("my-invitations/index.js", "loadCards")}
    ${fn("my-invitations/index.js", "_dropFromLocalOrders")}
    var WEDDING_ID=null, WEDDING_THEME="basic-gold", FORM={};
    function FormData(){ return { get:(k)=>FORM[k]||"" }; }
    ${fn("invitation-setup/js/05-theme-panel.js", "_syncLocalOrder")}
  `, ctx);
  const pay = src("core/payment.js");
  const a = pay.indexOf("// Save pending order immediately");
  const b = pay.indexOf("setCache(storageKey, orders);", a) + "setCache(storageKey, orders);".length;
  const c = pay.indexOf("// Lưu order pending ngay khi mở modal");
  const d = pay.indexOf("setCache(storageKey, orders);", c) + "setCache(storageKey, orders);".length + 8;
  vm.runInContext(`function getCurrentUser(){ return window.CXAuth.getUserSync(); }
    ${fn("core/payment.js", "updateOrderStatus")}
    function savePendingOrderOnPay(templateName, manage_id, name, phone, email){ ${pay.slice(a, b)} }
    function openPayModal(templateName){ ${pay.slice(c, d)} }
  `, ctx);
  ctx.location.search = "?id=__none__";
  vm.runInContext(src("core/helpers/draft-retention.js"), ctx);
  ctx.addEventListener = () => {}; ctx.document.addEventListener = () => {};
  vm.runInContext(`var CXNavbar = { count: 0, setCount(k, n){ this.count = n; } };`, ctx);
  vm.runInContext(src("core/helpers/nav-cart-count.js"), ctx);
  ctx.devName = name;
  ctx.session = null;
  login(ctx, null);
  IDB.set(ctx, new Map());
  return ctx;
}
function login(dev, user) {
  dev.session = user;
  dev.CXAuth = { getUserSync: () => user, isLoggedIn: () => !!user };
  dev.currentUser = user;
  dev.weddingDAL = {
    listMyWeddings: async () => server.list(user.id),
    createDraftWedding: async ({ manage_id, slug }) => { server.post(user?.id, manage_id, dev.__limit, slug); return { id: manage_id, slug: DB.get(manage_id).slug }; },
    updateWedding: async (payload) => server.patch(user?.id, payload),
  };
}
const K = (dev, id) => dev.buildCacheKey("draft", id);
const orders = (dev) => dev.getCache(dev.buildCacheKey("orders", dev.session?.email || "guest"), []);

// ---------------- Mô hình trang Thiết lập (mỗi "tab" là một object) ----------------
// newDraft = cxStartDraft/_create ở core/helpers/draft-start.js
function newDraft(dev, id, theme = "basic-gold") {
  dev.setCache(K(dev, id), { theme, is_published: false, _localOnly: true, _savedAt: Date.now(), ...(dev.session ? { _owner: dev.session.email } : {}) });
  return openTab(dev, id);
}
// loadData (13-data.js ~67–110): nháp _localOnly → đọc local; không thì hỏi DB; LỖI BẤT KỲ → nháp trắng mới.
function openTab(dev, id) {
  const d = dev.getCache(K(dev, id));
  const t = { dev, id, theme: "basic-gold", form: {}, slug: "", isLocalDraft: true, published: false };
  const fromDb = (w) => {
    const { id: _i, user_id, is_active, created_at, slug, theme, is_published, payment_status, ...form } = w;
    return Object.assign(t, { from: "db", form, slug, theme, isLocalDraft: false, published: !!is_published });
  };
  if (d?._localOnly) {
    let w = null;
    if (dev.session) { try { w = server.get(dev.session.id, id); } catch (e) {} }
    if (w) { dev.removeCache(K(dev, id)); return fromDb(w); }
    const { _localOnly, _savedAt, id: _i, slug, theme, is_published, ...form } = d;
    return Object.assign(t, { from: "local", form, slug: slug || "", theme: theme || t.theme, published: false });
  }
  try {
    const w = server.get(dev.session?.id, id);
    if (d) dev.removeCache(K(dev, id));
    return fromDb(w);
  } catch (e) {
    if (e.status !== 404) return Object.assign(t, { from: "error(" + (e.status || e.message) + ")", blocked: true });
    if (d) dev.removeCache(K(dev, id));
    const form = { gallery_images: [] };
    for (const f of ["cover_image_url", "groom_image_url", "bride_image_url", "groom_qr_url", "bride_qr_url"]) form[f] = null;
    return Object.assign(t, { from: "blank(404)", form });
  }
}
function payloadOf(t, overrides = {}) {
  return { id: t.id, slug: t.slug, theme: t.theme, ...t.form, ...overrides };
}
// _doAutoSave + _scheduleAutoSave (06-draft-save.js)
function type(t, fields) {
  if (t.blocked) return; // skeleton + hộp thoại lỗi: form không hiện
  Object.assign(t.form, fields);
  if (t.published) return; // IS_PUBLISHED → không autosave
  const { dev } = t;
  if (t.isLocalDraft) {
    const owner = dev.session?.email || dev.getCache(K(dev, t.id))?._owner;
    dev.setCache(K(dev, t.id), { ...payloadOf(t), ...(owner ? { _owner: owner } : {}), _localOnly: true, _savedAt: Date.now() });
  }
  dev.WEDDING_ID = t.id; dev.FORM = t.form; dev.WEDDING_THEME = t.theme;
  dev._syncLocalOrder();
}
// _saveAllOnce bước 4/4b (13-data.js ~713–757). sessionAtSave = kết quả _refreshLoginState.
function save(t, overrides = {}, { sessionAtSave = !!t.dev.session, limitReached = false, patchFails = false } = {}) {
  const { dev } = t;
  if (t.blocked) return { ok: false, code: "blocked" };
  const uid = sessionAtSave ? dev.session?.id : null;
  const payload = payloadOf(t, overrides);
  try {
    if (overrides.is_published && t.isLocalDraft && !uid) throw err("login", { code: "AUTH_REQUIRED" });
    if (t.isLocalDraft) { const { is_published, ...draft } = payload; dev.setCache(K(dev, t.id), { ...draft, _localOnly: true, _savedAt: Date.now() }); }
    if (!t.isLocalDraft) {
      if (patchFails) throw err("Failed to fetch");
      server.patch(dev.session?.id, payload);
      dev.removeCache(K(dev, t.id));
    } else if (uid) {
      server.post(uid, t.id, limitReached, payload.slug || `wedding-${t.id.slice(0, 8)}`);
      const generatedSlug = payload.slug || `wedding-${t.id.slice(0, 8)}`;
      const slugToSave = DB.get(t.id).slug || generatedSlug; // slug server trả về
      t.slug = slugToSave; payload.slug = slugToSave;
      if (patchFails) throw err("Failed to fetch");
      server.patch(uid, payload);
      t.isLocalDraft = false;
      dev.removeCache(K(dev, t.id));
    }
    return { ok: true };
  } catch (e) { return { ok: false, code: e.code || e.status || e.message }; }
}
// publishWedding + _publishLoggedIn (05-theme-panel.js ~2989–3063)
function publish(t, opts = {}) {
  if (!t.dev.session) return "needs-login";
  if (!t.slug || t.slug.startsWith("wedding-")) { // _resolvePublishSlug
    const g = t.form.groom_name, b = t.form.bride_name;
    if (g && b) { const full = `${g}-${b}`.toLowerCase(); t.slug = [...DB.values()].some((w) => w.slug === full) ? full + "-2" : full; }
  }
  const r = save(t, { is_published: true }, opts);
  if (!r.ok) return "error:" + r.code;
  if (t.isLocalDraft) return "not-published";
  t.published = true;
  t.dev.WEDDING_ID = t.id; t.dev.FORM = t.form; t.dev.WEDDING_THEME = t.theme;
  t.dev._syncLocalOrder({ published: true });
  return "popup-published";
}
// deleteCard (my-invitations/index.js ~793)
async function deleteCard(dev, id) {
  const c = dev.CARDS.find((x) => x.id === id);
  if (!c) return "no-card";
  if (!c.local) {
    const w = DB.get(id);
    if (!w || w.user_id !== dev.session?.id) return "api-error";
    DB.delete(id);
  }
  vm.runInContext(`_dropFromLocalOrders(${JSON.stringify(id)})`, dev);
  return "deleted";
}
function findDraftReal(dev) {
  const code = src("core/helpers/draft-start.js").replace(/\}\)\(\);\s*$/, "window.__findDraft = _findDraft; })();");
  vm.runInContext(code, dev);
  return dev.__findDraft()?.id || null;
}
// showSuccessScreen (core/payment.js ~500): còn key draft_<id> thì PATCH NGUYÊN bản đó lên DB
function paymentSuccess(dev, id) {
  DB.get(id).payment_status = "completed";
  dev.updateOrderStatus(id, "T" + Date.now(), "now");
  const dk = K(dev, id), draft = dev.getCache(dk);
  const publishOnly = () => { server.patch(dev.session?.id, { id, is_published: true }); return "published-only"; };
  try {
    let r;
    if (draft?._localOnly) {
      const { _localOnly, _savedAt, ...f } = draft;
      try { server.patch(dev.session?.id, { id, ...f, is_published: true }); r = "patched-local-draft"; }
      catch (e) { r = publishOnly() + "(sau lỗi " + e.code + ")"; }
    } else r = publishOnly();
    dev.removeCache(dk); return r;
  } catch (e) { return "toast-warning:" + (e.code || e.message); }
}
async function cards(dev) {
  await vm.runInContext("loadCards()", dev);
  return vm.runInContext("CARDS", dev).map((c) => `${c.id}:${c.published ? "PUB" : "draft"}${c.local ? "(local)" : "(db)"}`);
}
function runRetention(dev, openId = "") {
  dev.location.search = openId ? "?id=" + openId : "";
  vm.runInContext(src("core/helpers/draft-retention.js"), dev);
}

// ---------------- Test cases ----------------
const U1 = { id: "u1", email: "vinh@x.com" }, U2 = { id: "u2", email: "vo@x.com" };
const NAMES = { groom_name: "An", bride_name: "Binh" };
const results = [];
async function tc(group, title, expect, body) {
  DB.clear(); server.net = "ok";
  let r;
  try { r = await body(); } catch (e) { r = { pass: false, got: "THROW " + e.stack }; }
  results.push({ group, title, expect, ...r });
}
const J = JSON.stringify;

const navCount = (dev) => (vm.runInContext("CXCartCount.sync(); CXNavbar.count", dev));
// ===== A. Nháp trên máy ↔ tài khoản =====
await tc("A", "Chưa đăng nhập làm nháp → đăng nhập → chọn 'Lưu vào tài khoản'", "Nháp lên DB của tài khoản, bản trên máy bị xoá", async () => {
  const p = makeDevice("phone"); const A = newDraft(p, "aaaaaaaa-1"); type(A, NAMES);
  login(p, U1); p.ANSWERS.push(true); const c = await cards(p);
  return { got: `thẻ=${J(c)} DB.user=${DB.get(A.id)?.user_id} tên DB=${DB.get(A.id)?.groom_name} draftKey còn=${!!p.getCache(K(p, A.id))} đơn guest=${J(p.getCache(p.buildCacheKey("orders", "guest")))}`,
    pass: J(c) === J(["aaaaaaaa-1:draft(db)"]) && DB.get(A.id).user_id === "u1" && DB.get(A.id).groom_name === "An" && !p.getCache(K(p, A.id)) };
});
await tc("A", "…sau khi đã gộp thì đăng xuất", "Không còn thấy thiệp đó (đã chuyển hẳn vào tài khoản)", async () => {
  const p = makeDevice("phone"); const A = newDraft(p, "aaaaaaaa-1"); type(A, NAMES);
  login(p, U1); p.ANSWERS.push(true); await cards(p);
  login(p, null); const c = await cards(p);
  return { got: `thẻ khi đăng xuất=${J(c)} ô đếm=${navCount(p)}`, pass: c.length === 0 && navCount(p) === 0 };
});
await tc("A", "Chọn 'Không'", "Đăng nhập: chỉ thiệp của tài khoản, nháp KHÔNG bị xoá; đăng xuất: vẫn thấy nháp", async () => {
  const p = makeDevice("pc"); const A = newDraft(p, "aaaaaaaa-1"); type(A, NAMES);
  login(p, U1); p.ANSWERS.push(false); const cIn = await cards(p); const nIn = navCount(p);
  login(p, null); const cOut = await cards(p);
  return { got: `đăng nhập=${J(cIn)} (ô đếm ${nIn}) · đăng xuất=${J(cOut)} · DB có=${DB.has(A.id)}`,
    pass: cIn.length === 0 && nIn === 0 && J(cOut) === J(["aaaaaaaa-1:draft(local)"]) && !DB.has(A.id) };
});
await tc("A", "Đã chọn 'Không' rồi mở lại Quản lý thiệp / bấm 'Tạo thiệp'", "Không hỏi lại; 'Thiệp đang viết dở' không đưa nháp đó", async () => {
  const p = makeDevice("pc"); const A = newDraft(p, "aaaaaaaa-1"); type(A, NAMES);
  login(p, U1); p.ANSWERS.push(false); await cards(p); await cards(p);
  const fIn = findDraftReal(p); login(p, null); const fOut = findDraftReal(p);
  return { got: `số lần hỏi=${p.ASKED.length}; _findDraft khi đăng nhập=${fIn}, khi đăng xuất=${fOut}`, pass: p.ASKED.length === 1 && !fIn && fOut === A.id };
});
await tc("A", "Máy dùng chung: Lan làm nháp, Hùng đăng nhập trước chọn 'Không', sau đó Lan đăng nhập chọn 'Lưu'", "Thiệp về đúng tài khoản Lan, Hùng không thấy", async () => {
  const LAN = { id: "u3", email: "lan@x.com" };
  const p = makeDevice("pc"); const A = newDraft(p, "aaaaaaaa-1"); type(A, { groom_name: "Minh", bride_name: "Lan" });
  login(p, U2); p.ANSWERS.push(false); const hung = await cards(p);
  login(p, LAN); p.ANSWERS.push(true); const lan = await cards(p);
  login(p, U2); const hung2 = await cards(p);
  return { got: `Hùng=${J(hung)} → Lan=${J(lan)} (chủ DB=${DB.get(A.id)?.user_id}) → Hùng lại=${J(hung2)}; câu hỏi: ${J(p.ASKED[0])}`,
    pass: hung.length === 0 && J(lan) === J(["aaaaaaaa-1:draft(db)"]) && DB.get(A.id).user_id === "u3" && hung2.length === 0 };
});
await tc("A", "Đóng hộp thoại (bấm ra ngoài / Esc)", "Không làm gì, lần sau hỏi lại", async () => {
  const p = makeDevice("pc"); const A = newDraft(p, "aaaaaaaa-1"); type(A, NAMES);
  login(p, U1); p.ANSWERS.push(null); const c1 = await cards(p);
  p.ANSWERS.push(true); const c2 = await cards(p);
  return { got: `lần 1=${J(c1)} lần 2=${J(c2)} số lần hỏi=${p.ASKED.length}`, pass: c1.length === 0 && J(c2) === J(["aaaaaaaa-1:draft(db)"]) && p.ASKED.length === 2 };
});
await tc("A", "Chọn 'Lưu' nhưng tài khoản đã đủ trần số thiệp", "Báo lỗi; nháp nằm nguyên trên máy, lần sau hỏi lại", async () => {
  const p = makeDevice("pc"); const A = newDraft(p, "aaaaaaaa-1"); type(A, NAMES);
  login(p, U1); p.__limit = true; p.ANSWERS.push(true); const c = await cards(p);
  p.__limit = false; p.ANSWERS.push(null); await cards(p);
  return { got: `thẻ=${J(c)} báo=${J(p.ALERTS)} draftKey còn=${!!p.getCache(K(p, A.id))} hỏi lại=${p.ASKED.length === 2}`,
    pass: c.length === 0 && p.ALERTS.length === 1 && !!p.getCache(K(p, A.id)) && p.ASKED.length === 2 };
});
await tc("A", "Nháp chưa có tên cô dâu/chú rể (vừa bấm 'Tạo thiệp')", "Không thành thẻ, không bị hỏi gộp", async () => {
  const p = makeDevice("phone"); const A = newDraft(p, "aaaaaaaa-1"); type(A, { story_quote: "x" });
  const g = await cards(p); login(p, U1); const c = await cards(p);
  return { got: `đăng xuất=${J(g)} đăng nhập=${J(c)} hỏi=${p.ASKED.length}`, pass: g.length === 0 && c.length === 0 && p.ASKED.length === 0 };
});
await tc("A", "Đang đăng nhập, làm nháp mới chỉ tự lưu (chưa bấm Lưu nháp) rồi vào Quản lý thiệp", "KHÔNG hỏi; tự lưu vào tài khoản (nháp của chính mình), không báo gì; máy khác cũng thấy", async () => {
  const p = makeDevice("phone"); login(p, U1); const A = newDraft(p, "aaaaaaaa-1"); type(A, NAMES);
  const c = await cards(p);
  const pc = makeDevice("pc"); login(pc, U1);
  return { got: `hỏi=${p.ASKED.length} báo=${J(p.ALERTS)} phone=${J(c)} pc=${J(await cards(pc))} nháp máy còn=${!!p.getCache(K(p, A.id))}`,
    pass: p.ASKED.length === 0 && p.ALERTS.length === 0 && J(c) === J(["aaaaaaaa-1:draft(db)"]) && !p.getCache(K(p, A.id)) };
});
await tc("A", "Làm nháp lúc chưa đăng nhập, rồi đăng nhập NGAY trong trang Thiết lập và gõ tiếp", "Nháp thành của tài khoản đó → tự lưu, không hỏi", async () => {
  const p = makeDevice("phone"); const A = newDraft(p, "aaaaaaaa-1"); type(A, NAMES);
  login(p, U1); type(A, { story_quote: "gõ tiếp sau đăng nhập" });
  const c = await cards(p);
  return { got: `hỏi=${p.ASKED.length} thẻ=${J(c)} story_quote DB=${DB.get(A.id)?.story_quote}`, pass: p.ASKED.length === 0 && J(c) === J(["aaaaaaaa-1:draft(db)"]) };
});
const noteCount = (dev) => (dev.session ? dev.listLocalDrafts().length : 0);
await tc("A", "Hùng bấm nhầm 'Không' với nháp trên máy → dùng dòng nhắc để lấy lại", "Có dòng nhắc 'còn 1 nháp'; bấm → hỏi lại → Lưu → thiệp vào tài khoản, dòng nhắc tắt", async () => {
  const p = makeDevice("pc"); const A = newDraft(p, "aaaaaaaa-1"); type(A, NAMES);
  login(p, U2); p.ANSWERS.push(false); await cards(p);
  const note1 = noteCount(p);
  p.ANSWERS.push(true); vm.runInContext("reofferLocalDrafts()", p); await new Promise((r) => setTimeout(r, 20));
  const c = vm.runInContext("CARDS", p).map((x) => x.id);
  return { got: `dòng nhắc trước=${note1} · số lần hỏi=${p.ASKED.length} · thẻ sau=${J(c)} · dòng nhắc sau=${noteCount(p)}`,
    pass: note1 === 1 && p.ASKED.length === 2 && J(c) === J(["aaaaaaaa-1"]) && noteCount(p) === 0 };
});
await tc("A", "Máy có 1 nháp của mình + 1 nháp vô chủ; chọn 'Không'", "Hộp chỉ liệt kê nháp vô chủ; nháp của mình vẫn tự lưu; dòng nhắc còn 1", async () => {
  const p = makeDevice("pc"); const X = newDraft(p, "bbbbbbbb-2"); type(X, { groom_name: "Minh", bride_name: "Lan" });
  login(p, U1); const A = newDraft(p, "aaaaaaaa-1"); type(A, NAMES);
  p.ANSWERS.push(false); const c = await cards(p);
  return { got: `hộp=${J(p.ASKED[0])} · thẻ=${J(c)} · dòng nhắc=${noteCount(p)}`,
    pass: /Minh & Lan/.test(p.ASKED[0]) && !/An & Binh/.test(p.ASKED[0]) && J(c) === J(["aaaaaaaa-1:draft(db)"]) && noteCount(p) === 1 };
});
await tc("A", "Tài khoản có 4 thiệp, máy có 1 nháp của mình + 1 nháp vô chủ", "Tính cả hai vào trần → báo đã dùng 4/5, không lưu gì", async () => {
  const p = makeDevice("pc");
  for (let i = 1; i <= 4; i++) DB.set("db-" + i, { id: "db-" + i, user_id: "u1", is_active: true, created_at: new Date().toISOString() });
  const X = newDraft(p, "bbbbbbbb-2"); type(X, { groom_name: "Minh", bride_name: "Lan" });
  login(p, U1); const A = newDraft(p, "aaaaaaaa-1"); type(A, NAMES);
  const c = await cards(p);
  return { got: `thẻ=${c.length} hỏi=${p.ASKED.length} báo=${J(p.ALERTS)}`, pass: c.length === 4 && p.ASKED.length === 0 && /đã dùng 4\/5/.test(p.ALERTS[0] ?? "") };
});
await tc("A", "Tự làm nháp rồi xuất bản ngay trong trang Thiết lập (đăng nhập ở popup)", "Không bị hỏi thừa ở Quản lý thiệp", async () => {
  const p = makeDevice("phone"); const A = newDraft(p, "aaaaaaaa-1"); type(A, NAMES);
  login(p, U1); publish(A); const c = await cards(p);
  return { got: `thẻ=${J(c)} số lần hỏi=${p.ASKED.length}`, pass: J(c) === J(["aaaaaaaa-1:PUB(db)"]) && p.ASKED.length === 0 };
});
await tc("A", "Hai lần nạp danh sách chạy chồng nhau (đổi phiên + quay lại tab)", "Chỉ 1 hộp thoại, không tạo trùng", async () => {
  const p = makeDevice("pc"); const A = newDraft(p, "aaaaaaaa-1"); type(A, NAMES);
  login(p, U1); p.ANSWERS.push(true);
  await Promise.all([vm.runInContext("loadCards()", p), vm.runInContext("loadCards()", p)]);
  return { got: `số lần hỏi=${p.ASKED.length} thẻ=${J(vm.runInContext("CARDS", p).map((c) => c.id))}`, pass: p.ASKED.length === 1 && vm.runInContext("CARDS", p).length === 1 };
});
await tc("A", "Nháp đã lên DB rồi gõ tiếp; mở ở máy khác", "Mỗi máy 1 thẻ nháp (db), ĐT mở ra từ DB", async () => {
  const p = makeDevice("phone"); login(p, U1); const A = newDraft(p, "aaaaaaaa-1"); type(A, NAMES);
  save(A); type(A, { story_quote: "y" });
  const pc = makeDevice("pc"); login(pc, U1);
  const cp = await cards(p), cd = await cards(pc), o = openTab(p, A.id);
  return { got: `phone=${J(cp)} pc=${J(cd)} mở ĐT từ=${o.from}`, pass: cp.length === 1 && cd.length === 1 && o.from === "db" };
});

// ===== B. Xuất bản =====
await tc("B", "Nháp vãng lai → Xuất bản → đăng nhập ở popup", "2 máy cùng 1 thẻ PUB(db), nháp local bị xoá", async () => {
  const p = makeDevice("phone"); const A = newDraft(p, "aaaaaaaa-1"); type(A, NAMES);
  const r0 = publish(A); login(p, U1); const r = publish(A);
  const pc = makeDevice("pc"); login(pc, U1);
  const cp = await cards(p), cd = await cards(pc);
  return { got: `${r0}→${r}; phone=${J(cp)} pc=${J(cd)} draftKey=${!!p.getCache(K(p, A.id))}`, pass: J(cp) === J(["aaaaaaaa-1:PUB(db)"]) && J(cd) === J(cp) && !p.getCache(K(p, A.id)) };
});
await tc("B", "Mất phiên giữa lúc xuất bản (bấm lúc còn phiên, _saveAllOnce hỏi lại thì mất)", "Không được báo thành công khi DB chưa có", async () => {
  const p = makeDevice("phone"); login(p, U1); const A = newDraft(p, "aaaaaaaa-1"); type(A, NAMES);
  const r = publish(A, { sessionAtSave: false });
  const pc = makeDevice("pc"); login(pc, U1);
  return { got: `${r}; DB có=${DB.has(A.id)} phone=${J(await cards(p))} pc=${J(await cards(pc))}`, pass: r !== "popup-published" };
});
await tc("B", "Xuất bản bị chặn vì đủ trần số thiệp → mở lại trang", "Vẫn là nháp: IS_PUBLISHED=false, tự lưu còn chạy", async () => {
  const p = makeDevice("phone"); login(p, U1); const A = newDraft(p, "aaaaaaaa-1"); type(A, NAMES);
  const r = publish(A, { limitReached: true }); const o = openTab(p, A.id);
  return { got: `${r}; mở lại từ=${o.from} IS_PUBLISHED=${o.published}`, pass: !o.published };
});
await tc("B", "Xuất bản: POST tạo hàng xong nhưng PATCH lỗi mạng", "Mở lại vẫn là nháp, tự lưu còn chạy", async () => {
  const p = makeDevice("phone"); login(p, U1); const A = newDraft(p, "aaaaaaaa-1"); type(A, NAMES);
  const r = publish(A, { patchFails: true }); const o = openTab(p, A.id);
  const pc = makeDevice("pc"); login(pc, U1); const cd = await cards(pc);
  const w = DB.get(A.id);
  return { got: `${r}; ĐT mở lại IS_PUBLISHED=${o.published}; pc=${J(cd)} (tên trên DB="${w?.groom_name || ""}")`, pass: !o.published, note: "máy khác vẫn thấy 1 thẻ nháp chưa có tên cho tới lần lưu kế tiếp — POST chỉ mang theme/slug" };
});
await tc("B", "Bấm Xuất bản hai lần liền", "Chỉ 1 lượt ghi (saveAll gộp lượt trùng key)", async () => {
  const s = src("invitation-setup/js/13-data.js");
  const ok = /if \(_saveLast && _saveLast\.key === key\) return _saveLast\.promise;/.test(s) && /_publishBusy/.test(src("invitation-setup/js/05-theme-panel.js"));
  return { got: ok ? "có _saveLast + _publishBusy" : "thiếu chốt", pass: ok, note: "đọc code" };
});
await tc("B", "Hai tab cùng một nháp local: tab 1 xuất bản, tab 2 vẫn mở và gõ tiếp", "Tab 2 không được che/ghi đè thiệp đã xuất bản", async () => {
  const p = makeDevice("pc"); login(p, U1); const T1 = newDraft(p, "aaaaaaaa-1"); type(T1, NAMES);
  const T2 = openTab(p, T1.id);
  publish(T1); const slugPub = DB.get(T1.id).slug;
  type(T2, { story_quote: "tab2" });                  // tab 2 vẫn nghĩ là nháp local
  const reopen = openTab(p, T1.id).from;
  const r = save(T2);                                  // bấm Lưu nháp ở tab 2
  const w = DB.get(T1.id);
  return { got: `mở lại từ=${reopen}; tab2 lưu=${r.ok}; slug ${slugPub} → ${w.slug}; is_published=${w.is_published}`, pass: reopen === "db" && w.slug === slugPub };
});

// ===== C. Mở thiệp đã có trên DB =====
await tc("C", "Mở thiệp của mình khi đang đăng nhập", "Nạp từ DB", async () => {
  const p = makeDevice("phone"); login(p, U1); const A = newDraft(p, "aaaaaaaa-1"); type(A, NAMES); publish(A);
  const o = openTab(p, A.id); return { got: o.from, pass: o.from === "db" };
});
for (const [label, prep] of [
  ["đã hết phiên (đăng xuất/token hỏng)", (p) => login(p, null)],
  ["mạng chập/Edge Function 5xx", () => { server.net = "down"; }],
]) {
  await tc("C", `Mở thiệp ĐÃ XUẤT BẢN khi ${label}, gõ 1 chữ, sau đó đăng nhập và lưu`, "Không được mở form trắng như nháp mới; dữ liệu + slug trên DB giữ nguyên", async () => {
    const p = makeDevice("phone"); login(p, U1); const A = newDraft(p, "aaaaaaaa-1");
    type(A, { ...NAMES, cover_image_url: "cover.webp", gallery_images: ["g1.webp", "g2.webp"] }); publish(A);
    const before = { ...DB.get(A.id) };
    prep(p);
    const T = openTab(p, A.id);
    type(T, { groom_name: "An", bride_name: "Binh" });
    server.net = "ok"; login(p, U1);
    const shadow = openTab(p, A.id).from;
    const T2 = openTab(p, A.id); const r = T2.published ? (T2.form.story_quote = "sửa", save(T2).ok ? "saved" : "err") : publish(T2);
    const w = DB.get(A.id);
    return { got: `lần mở=${T.from}; mở lại khi đã đăng nhập=${shadow}; lưu=${r}; slug ${before.slug}→${w.slug}; gallery ${J(before.gallery_images)}→${J(w.gallery_images)}; cover "${before.cover_image_url}"→"${w.cover_image_url || ""}"`,
      pass: !T.from.startsWith("blank") && w.slug === before.slug && w.cover_image_url === before.cover_image_url };
  });
}
await tc("C", "Tài khoản B trên cùng máy bấm 'Tạo thiệp' → hộp 'đang viết dở' trỏ vào thiệp của A", "Không đề nghị mở thiệp của tài khoản khác", async () => {
  const p = makeDevice("pc"); login(p, U1); const A = newDraft(p, "aaaaaaaa-1"); type(A, NAMES); publish(A); save(openTab(p, A.id)); // A sửa & lưu lại lần nữa
  login(p, U2);
  const offered = findDraftReal(p); const T = offered && openTab(p, offered);
  const r = T && (type(T, { groom_name: "Khoa" }), save(T));
  return { got: `_findDraft=${offered}; mở=${T?.from}; lưu=${J(r)}`, pass: !offered };
});
await tc("C", "Thiệp đã xuất bản rồi, sau đó bấm 'Tạo thiệp' ở trang chủ", "Không hỏi 'Thiệp đang viết dở' cho thiệp đã xuất bản", async () => {
  const p = makeDevice("phone"); login(p, U1); const A = newDraft(p, "aaaaaaaa-1"); type(A, NAMES); publish(A);
  const T = openTab(p, A.id); T.form.story_quote = "sửa"; save(T); // Lưu & Xuất bản lần 2
  return { got: `_findDraft=${findDraftReal(p)}`, pass: !findDraftReal(p) };
});

// ===== D. Quản lý thiệp =====
await tc("D", "Xoá thiệp ở máy tính; điện thoại từng xuất bản thiệp đó", "ĐT không còn thẻ", async () => {
  const p = makeDevice("phone"); login(p, U1); const A = newDraft(p, "aaaaaaaa-1"); type(A, NAMES); publish(A);
  const pc = makeDevice("pc"); login(pc, U1); await cards(pc); await deleteCard(pc, A.id);
  return { got: `phone=${J(await cards(p))} pc=${J(await cards(pc))}`, pass: (await cards(p)).length === 0 };
});
await tc("D", "Cron cleanup-weddings xoá thiệp xuất bản hết hạn dùng thử", "ĐT không còn thẻ ma", async () => {
  const p = makeDevice("phone"); login(p, U1); const A = newDraft(p, "aaaaaaaa-1"); type(A, NAMES); publish(A);
  DB.delete(A.id); return { got: J(await cards(p)), pass: (await cards(p)).length === 0 };
});
await tc("D", "Thiệp bị tắt is_active=false (không còn trong my-weddings)", "ĐT không hiện thẻ", async () => {
  const p = makeDevice("phone"); login(p, U1); const A = newDraft(p, "aaaaaaaa-1"); type(A, NAMES); publish(A);
  DB.get(A.id).is_active = false; return { got: J(await cards(p)), pass: (await cards(p)).length === 0 };
});
await tc("D", "Xoá thẻ nháp LOCAL rồi bấm 'Tạo thiệp'", "Nháp đã xoá không quay lại", async () => {
  const p = makeDevice("phone"); const A = newDraft(p, "aaaaaaaa-1"); type(A, NAMES); await cards(p); await deleteCard(p, A.id);
  const f = findDraftReal(p);
  if (f) type(openTab(p, f), { story_quote: "tiếp" });
  return { got: `_findDraft=${f}; thẻ sau khi 'Tiếp tục'=${J(await cards(p))}`, pass: !f };
});
await tc("D", "Xoá thiệp DB (đã sửa ít nhất 1 lần) rồi bấm 'Tạo thiệp' → 'Tiếp tục'", "Không hồi sinh id đã xoá", async () => {
  const p = makeDevice("phone"); login(p, U1); const A = newDraft(p, "aaaaaaaa-1"); type(A, NAMES); save(A); type(A, { story_quote: "x" });
  await cards(p); await deleteCard(p, A.id);
  const f = findDraftReal(p); const T = f && openTab(p, f); if (T) { type(T, NAMES); save(T); }
  return { got: `_findDraft=${f}; mở=${T?.from}; DB có lại=${DB.has(A.id)}`, pass: !f };
});
await tc("D", "Khách vãng lai có 2 đơn trùng manage_id trong cache", "Không hiện 2 thẻ trùng", async () => {
  const p = makeDevice("phone"); const A = newDraft(p, "aaaaaaaa-1"); type(A, NAMES);
  const k = p.buildCacheKey("orders", "guest"); const o = p.getCache(k); p.setCache(k, [o[0], { ...o[0], status: "pending" }]);
  return { got: J(await cards(p)), pass: (await cards(p)).length === 1 };
});

// ===== E. Thanh toán =====
await tc("E", "2 thiệp CÙNG mẫu: A đang chờ thanh toán, rồi thanh toán cho B", "Đơn A vẫn là A", async () => {
  const p = makeDevice("phone"); const A = newDraft(p, "aaaaaaaa-1"), B = newDraft(p, "bbbbbbbb-2");
  type(A, NAMES); type(B, { groom_name: "Cuong", bride_name: "Dung" });
  p.savePendingOrderOnPay("Basic Gold", A.id, "An", "09", ""); p.savePendingOrderOnPay("Basic Gold", B.id, "Cuong", "09", "");
  const ids = orders(p).map((o) => o.manage_id);
  return { got: `manage_id=${J(ids)} thẻ=${J(await cards(p))}`, pass: ids.includes(A.id) && new Set(ids).size === ids.length };
});
await tc("E", "Thanh toán B thành công khi đơn A (pending) đứng trước", "Chỉ B thành completed", async () => {
  const p = makeDevice("phone"); login(p, U1); const A = newDraft(p, "aaaaaaaa-1"), B = newDraft(p, "bbbbbbbb-2");
  type(A, NAMES); publish(A); type(B, NAMES); publish(B);
  p.updateOrderStatus(B.id, "T1", "now");
  const os = orders(p).map((o) => `${o.manage_id.slice(0, 1)}:${o.status}`);
  return { got: J(os), pass: J(os) === J(["a:pending", "b:completed"]) };
});
await tc("E", "Mở hộp thanh toán (chưa trả) — đơn không manage_id", "Không thành thẻ, không chặn đơn thật", async () => {
  const p = makeDevice("phone"); login(p, U1); p.openPayModal("Basic Gold");
  return { got: `orders=${J(orders(p).map((o) => o.manage_id ?? null))} thẻ=${J(await cards(p))}`, pass: (await cards(p)).length === 0, note: "đơn rác vẫn nằm lại trong cache" };
});
await tc("E", "Thanh toán trên ĐT sau khi đã sửa thiệp tiếp trên máy tính", "Không đè bản mới trên DB bằng bản nháp cũ trên ĐT", async () => {
  const p = makeDevice("phone"); login(p, U1); const A = newDraft(p, "aaaaaaaa-1"); type(A, NAMES); publish(A);
  const T = openTab(p, A.id); T.form.story_quote = "bản ĐT"; save(T);        // key draft_ cũ nằm lại trên ĐT
  const pc = makeDevice("pc"); login(pc, U1); const P = openTab(pc, A.id); P.form.story_quote = "bản MÁY TÍNH"; save(P);
  const r = paymentSuccess(p, A.id);
  return { got: `${r}; story_quote trên DB = "${DB.get(A.id).story_quote}"`, pass: DB.get(A.id).story_quote === "bản MÁY TÍNH" };
});
await tc("E", "Thanh toán sau khi đổi mẫu ở máy khác (bản nháp ĐT còn mẫu cũ)", "Thiệp vẫn được xuất bản, lỗi không bị nuốt", async () => {
  const p = makeDevice("phone"); login(p, U1); const A = newDraft(p, "aaaaaaaa-1"); type(A, NAMES); save(A);
  const T = openTab(p, A.id); T.form.story_quote = "x"; save(T);            // key draft_ mẫu basic-gold
  const pc = makeDevice("pc"); login(pc, U1); const P = openTab(pc, A.id); P.theme = "romantic-gold"; save(P);
  DB.get(A.id).is_published = false;
  const r = paymentSuccess(p, A.id);
  return { got: `${r}; is_published=${DB.get(A.id).is_published}`, pass: !r.startsWith("silent-fail") };
});

// ===== F. Dọn nháp bỏ quên =====
const OLD = Date.now() - 40 * 86400000;
await tc("F", "Nháp local > 30 ngày", "Xoá nháp + đơn nháp", async () => {
  const p = makeDevice("phone"); const A = newDraft(p, "aaaaaaaa-1"); type(A, NAMES);
  p.setCache(K(p, A.id), { ...p.getCache(K(p, A.id)), _savedAt: OLD }); runRetention(p);
  return { got: `draft=${!!p.getCache(K(p, A.id))} thẻ=${J(await cards(p))}`, pass: !p.getCache(K(p, A.id)) && (await cards(p)).length === 0 };
});
await tc("F", "Nháp cũ nhưng đang mở (?id=)", "Không đụng", async () => {
  const p = makeDevice("phone"); const A = newDraft(p, "aaaaaaaa-1"); type(A, NAMES);
  p.setCache(K(p, A.id), { ...p.getCache(K(p, A.id)), _savedAt: OLD }); runRetention(p, A.id);
  return { got: `draft còn=${!!p.getCache(K(p, A.id))}`, pass: !!p.getCache(K(p, A.id)) };
});
await tc("F", "Nháp local cũ có ảnh chờ upload trong IndexedDB", "Ảnh của nháp đó bị dọn, ảnh nháp khác giữ nguyên", async () => {
  const p = makeDevice("phone"); const A = newDraft(p, "aaaaaaaa-1"); type(A, NAMES);
  p.__idb.set("a_g_1", { key: "a_g_1", weddingId: A.id }); p.__idb.set("b_g_1", { key: "b_g_1", weddingId: "bbbbbbbb-2" });
  p.setCache(K(p, A.id), { ...p.getCache(K(p, A.id)), _savedAt: OLD }); runRetention(p);
  await new Promise((r) => setTimeout(r, 10));
  const left = [...p.__idb.keys()];
  return { got: `IDB còn=${J(left)}`, pass: J(left) === J(["b_g_1"]) };
});
await tc("D", "Xoá thẻ nháp local có ảnh chờ upload", "Ảnh IndexedDB của nháp đó bị dọn", async () => {
  const p = makeDevice("phone"); const A = newDraft(p, "aaaaaaaa-1"); type(A, NAMES);
  p.__idb.set("a_g_1", { key: "a_g_1", weddingId: A.id });
  await cards(p); await deleteCard(p, A.id); await new Promise((r) => setTimeout(r, 10));
  return { got: `IDB còn=${J([...p.__idb.keys()])}`, pass: p.__idb.size === 0 };
});
await tc("F", "Thẻ ma 'đã xuất bản' (từ nhóm B/D) có được dọn theo thời gian không", "Có", async () => {
  const p = makeDevice("phone"); login(p, U1); const A = newDraft(p, "aaaaaaaa-1"); type(A, NAMES); publish(A, { sessionAtSave: false });
  p.setCache(K(p, A.id), { ...p.getCache(K(p, A.id)), _savedAt: OLD }); runRetention(p);
  return { got: `draft=${!!p.getCache(K(p, A.id))} thẻ=${J(await cards(p))}`, pass: (await cards(p)).length === 0 };
});

// ===== G. Gộp: đồng bộ ảnh ngầm + trần số thiệp =====
async function localDraftWithImages(p, id) {
  const A = newDraft(p, id); type(A, { ...NAMES, love_story: JSON.stringify([{ title: "Gặp nhau" }, { title: "Cầu hôn" }]) });
  const put = (k, v) => p.__idb.set(k, { key: k, weddingId: id, ...v });
  put(id + "_s_cover", { type: "single", fieldName: "cover_image_url", file: "FILE_COVER", focalPoint: { x: 30, y: 40 } });
  put(id + "_g_1", { type: "gallery", file: "FILE_G1", order: 1, focalPoint: { x: 10, y: 10 } });
  put(id + "_g_2", { type: "gallery", file: "FILE_G2", order: 2 });
  put(id + "_lsImg", { type: "love_story_images", images: [{ idx: 1, file: "FILE_LS1" }] });
  put("khac_g_1", { type: "gallery", weddingId: "bbbbbbbb-2", file: "FILE_OTHER", order: 1 });
  return A;
}
await tc("G", "Gộp nháp có ảnh (bìa, 2 ảnh album, ảnh chuyện tình) — không mở trang Thiết lập", "Ảnh lên Storage, DB có đủ tên file + điểm lấy nét; IndexedDB của nháp được dọn, nháp khác giữ nguyên", async () => {
  const p = makeDevice("phone"); const A = await localDraftWithImages(p, "aaaaaaaa-1");
  login(p, U1); p.ANSWERS.push(true); const c = await cards(p);
  const w = DB.get(A.id);
  return { got: `thẻ=${J(c)} cover=${w.cover_image_url} gallery=${J(w.gallery_images)} love_story[1].image_url=${JSON.parse(w.love_story)[1].image_url} focal=${J(w.image_focal_points)} IDB còn=${J([...p.__idb.keys()])} báo=${J(p.ALERTS)}`,
    pass: w.cover_image_url?.startsWith("cover_image_url-") && w.gallery_images.length === 2 && JSON.parse(w.love_story)[1].image_url && w.image_focal_points.cover_image_url?.x === 30 && Object.keys(w.image_focal_points.gallery_images).length === 1 && J([...p.__idb.keys()]) === J(["khac_g_1"]) && !p.getCache(K(p, A.id)) };
});
await tc("G", "Gộp nháp có ảnh nhưng 1 ảnh album upload lỗi", "Thiệp vẫn lên tài khoản với ảnh đã lên; ảnh lỗi ở lại IndexedDB để trang Thiết lập đẩy lại; có cảnh báo", async () => {
  const p = makeDevice("phone"); const A = await localDraftWithImages(p, "aaaaaaaa-1");
  p.FAIL_UPLOAD.add("FILE_G2");
  login(p, U1); p.ANSWERS.push(true); await cards(p);
  const w = DB.get(A.id);
  return { got: `gallery DB=${J(w.gallery_images)} IDB còn=${J([...p.__idb.keys()])} báo=${J(p.ALERTS)}`,
    pass: w.gallery_images.length === 1 && [...p.__idb.keys()].includes(A.id + "_g_2") && !p.__idb.has(A.id + "_g_1") && p.ALERTS.some((m) => /ảnh chưa đồng bộ/.test(m)) };
});
await tc("G", "Tài khoản đang có 4 thiệp, máy có 2 nháp chưa lưu", "Không hỏi gộp; báo đã dùng 4/5; không lưu nửa chừng; cùng phiên không nhắc lại", async () => {
  const p = makeDevice("pc");
  for (let i = 1; i <= 4; i++) DB.set("db-" + i, { id: "db-" + i, user_id: "u1", is_active: true, created_at: new Date().toISOString() });
  const A = newDraft(p, "aaaaaaaa-1"); type(A, NAMES); const B = newDraft(p, "bbbbbbbb-2"); type(B, { groom_name: "C", bride_name: "D" });
  login(p, U1); const c1 = await cards(p); await cards(p);
  return { got: `thẻ=${c1.length} hỏi=${p.ASKED.length} báo=${J(p.ALERTS)} DB có nháp=${DB.has(A.id) || DB.has(B.id)}`,
    pass: p.ASKED.length === 0 && p.ALERTS.length === 1 && /đã dùng 4\/5 thiệp/.test(p.ALERTS[0] ?? "") && !DB.has(A.id) && !DB.has(B.id) };
});
await tc("G", "Tài khoản đang có 4 thiệp, máy có 1 nháp", "Được hỏi, lưu được → đủ 5/5", async () => {
  const p = makeDevice("pc");
  for (let i = 1; i <= 4; i++) DB.set("db-" + i, { id: "db-" + i, user_id: "u1", is_active: true, created_at: new Date().toISOString() });
  const A = newDraft(p, "aaaaaaaa-1"); type(A, NAMES);
  login(p, U1); p.ANSWERS.push(true); const c = await cards(p);
  return { got: `thẻ=${c.length} hỏi=${p.ASKED.length}`, pass: c.length === 5 && p.ASKED.length === 1 };
});
await tc("G", "Tài khoản đã đủ 5 thiệp, máy có 1 nháp", "Không hỏi; báo hết chỗ; nháp nằm nguyên trên máy", async () => {
  const p = makeDevice("pc");
  for (let i = 1; i <= 5; i++) DB.set("db-" + i, { id: "db-" + i, user_id: "u1", is_active: true, created_at: new Date().toISOString() });
  const A = newDraft(p, "aaaaaaaa-1"); type(A, NAMES);
  login(p, U1); const c = await cards(p);
  return { got: `thẻ=${c.length} hỏi=${p.ASKED.length} báo=${J(p.ALERTS)} nháp còn=${!!p.getCache(K(p, A.id))}`, pass: c.length === 5 && p.ASKED.length === 0 && p.ALERTS.length === 1 && !!p.getCache(K(p, A.id)) };
});

// ---------------- In kết quả ----------------
let n = 0, fail = 0;
for (const r of results) {
  n++; if (!r.pass) fail++;
  const tag = r.pass ? (r.warn ? "WARN" : "PASS") : "FAIL";
  const head = `${tag}  ${r.group}${n}. ${r.title}${r.note ? "  [" + r.note + "]" : ""}`;
  if (r.pass && !VERBOSE) console.log(head);
  else console.log(`${head}\n      mong đợi: ${r.expect}\n      thực tế : ${r.got}\n`);
}
console.log(`\nTổng ${n} | FAIL ${fail}`);
process.exit(fail ? 1 : 0);
