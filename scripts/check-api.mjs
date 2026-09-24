// Kiểm thử API Edge Function trên STAGING (npm run check:api). ID ca khớp mục
// API-xx của testcase_all.md. Tự dựng dữ liệu test (slug/mã có tiền tố qa-<run>)
// rồi dọn ở cuối. KHÔNG BAO GIỜ chạy vào production: đích lấy từ
// core/config.staging.js, trùng ref production là dừng. Thông tin đăng nhập đọc
// từ biến môi trường hoặc file .env.check-api (đã gitignore) — xem --help.
import fs from "node:fs";
import nodeCrypto from "node:crypto";
import { fileURLToPath } from "node:url";

const R = fileURLToPath(new URL("..", import.meta.url));
const read = (f) => fs.readFileSync(R + f, "utf8");
const argv = process.argv.slice(2);
const flag = (n) => argv.includes(`--${n}`);
const opt = (n) => argv.find((a) => a.startsWith(`--${n}=`))?.split("=").slice(1).join("=");

const HELP = `
npm run check:api [-- tuỳ chọn]

  --verbose          in cả ca đạt
  --list             chỉ liệt kê ca, không gọi API
  --only=WA,GH       chỉ chạy nhóm (WA WR PAY WH GH AI CL)
  --with-ai          chạy cả ca gọi Gemini thật (tốn lượt AI của IP máy bạn)
  --keep             không dọn dữ liệu test (để soi tay)
  --env-file=path    file biến môi trường (mặc định .env.check-api ở gốc repo)
  --base=URL         chỉ cho phép http://localhost / 127.0.0.1 (supabase functions serve)

Biến môi trường (thiếu biến nào thì ca cần nó được SKIP, không FAIL):
  CX_TEST_U1, CX_TEST_U2, CX_TEST_U3   "email:mật khẩu" của 3 tài khoản test trên staging
                                       (tạo ở Dashboard → Authentication → Add user, có mật khẩu)
  CX_TEST_JWT_U1 … _U3                 thay cho trên: access_token lấy từ DevTools
                                       (await CXAuth.accessToken()), sống ~1 giờ
  CX_TEST_ADMIN_TOKEN                  ADMIN_SECRET_TOKEN của staging
  CX_TEST_CLEANUP_TOKEN                CLEANUP_SECRET_TOKEN của staging (thiếu thì dùng mã admin)
  CX_TEST_PAYOS_CHECKSUM               PAYOS_CHECKSUM_KEY của kênh PayOS STAGING (ca webhook có ký)

Yêu cầu: U1 và U2 gần như trống (U1 ≤ 2 thiệp đang hiện). U3 sẽ bị lấp đủ 5 thiệp.
`;
if (flag("help")) {
  console.log(HELP);
  process.exit(0);
}

// ---------------- Đích: CHỈ staging ----------------
const PROD_REF = read("core/config.js").match(/https:\/\/([a-z0-9]+)\.supabase\.co/)[1];
const STG = read("core/config.staging.js");
const STG_REF = STG.match(/const REF\s*=\s*"([a-z0-9]+)"/)[1];
const ANON = STG.match(/anonKey:\s*"([^"]+)"/)[1];
let SUPA = `https://${STG_REF}.supabase.co`;
let BASE = `${SUPA}/functions/v1`;
if (opt("base")) {
  const u = new URL(opt("base"));
  if (!["localhost", "127.0.0.1"].includes(u.hostname)) {
    console.error("✗ --base chỉ nhận localhost/127.0.0.1 — script này không chạy vào môi trường nào khác staging.");
    process.exit(1);
  }
  BASE = opt("base").replace(/\/$/, "");
  SUPA = u.origin;
}
if (STG_REF === PROD_REF || BASE.includes(PROD_REF)) {
  console.error("✗ Đích trùng project PRODUCTION — dừng.");
  process.exit(1);
}

const envFile = opt("env-file") || R + ".env.check-api";
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);
const E = process.env;
const ADMIN = E.CX_TEST_ADMIN_TOKEN || "";
const CLEANUP = E.CX_TEST_CLEANUP_TOKEN || ADMIN;
const PAYOS_KEY = E.CX_TEST_PAYOS_CHECKSUM || "";
const ONLY = opt("only")?.toUpperCase().split(",");
const VERBOSE = flag("verbose");
const RUN = Date.now().toString(36).slice(-6);
const J = JSON.stringify;

// ---------------- HTTP ----------------
async function call(fn, { method = "GET", path = "", query = {}, jwt = null, admin = false, body, origin, headers = {} } = {}) {
  const url = new URL(`${BASE}/${fn}${path}`);
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  const h = { apikey: ANON, Authorization: `Bearer ${jwt || ANON}`, ...headers };
  if (admin) h["x-admin-token"] = ADMIN;
  if (origin) h.Origin = origin;
  if (body !== undefined) h["Content-Type"] = "application/json";
  const res = await fetch(url, { method, headers: h, body: body === undefined ? undefined : typeof body === "string" ? body : J(body) });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {}
  return { status: res.status, json, text, headers: res.headers };
}
const WA = (o) => call("wedding-admin", o);
const GH = (o) => call("guest-handler", o);
const PAY = (path, o) => call("payment-handler", { path, ...o });

// ---------------- Tài khoản ----------------
const U = {};
async function login(key) {
  const n = key.slice(1);
  const jwt = E[`CX_TEST_JWT_U${n}`];
  if (jwt) {
    const sub = JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString()).sub;
    return { jwt, id: sub };
  }
  const spec = E[`CX_TEST_U${n}`];
  if (!spec) return null;
  const i = spec.indexOf(":");
  const res = await fetch(`${SUPA}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: J({ email: spec.slice(0, i), password: spec.slice(i + 1) }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.access_token) throw new Error(`Đăng nhập ${key} hỏng: ${res.status} ${J(j).slice(0, 200)}`);
  return { jwt: j.access_token, id: j.user.id };
}
const auth = (who) => (who === "admin" ? { admin: true } : who === "anon" ? {} : { jwt: U[who].jwt });

// ---------------- Khung chạy ca ----------------
const CASES = [];
const tc = (id, title, needs, body, opts = {}) => CASES.push({ id, title, needs, body, ...opts });
function checker() {
  const bad = [], notes = [];
  return {
    eq(label, got, want) {
      const ok = J(got) === J(want);
      (ok ? notes : bad).push(`${label}=${J(got)}${ok ? "" : ` (cần ${J(want)})`}`);
      return ok;
    },
    ok(label, cond, detail = "") {
      (cond ? notes : bad).push(`${label}${detail ? " " + detail : ""}${cond ? "" : " ✗"}`);
      return cond;
    },
    done: () => ({ pass: bad.length === 0, got: (bad.length ? bad : notes).join(" · ") }),
  };
}

// ---------------- Dữ liệu test + dọn dẹp ----------------
const created = new Map(); // wedding id → chủ ("u1"…, "admin")
const batches = new Set(); // promo batch_id
let seq = 0;
const qaSlug = () => `qa-${RUN}-${++seq}`;
const S = {}; // trạng thái dùng chung giữa các ca
let THEME, THEME_ALT, PRICE;

async function newWedding(owner = "u1", fields = {}) {
  const id = nodeCrypto.randomUUID();
  const r = await WA({ method: "POST", ...auth(owner), body: { manage_id: id, theme: THEME } });
  if (r.status !== 200) throw new Error(`Tạo thiệp (${owner}) hỏng: ${r.status} ${r.text.slice(0, 200)}`);
  created.set(id, owner);
  const slug = qaSlug();
  const p = await WA({ method: "PATCH", ...auth(owner), body: { id, slug, groom_name: "QA An", bride_name: "QA Bình", enable_wishes: true, ...fields } });
  if (p.status !== 200) throw new Error(`Sửa thiệp mới (${owner}) hỏng: ${p.status} ${p.text.slice(0, 200)}`);
  return { id, slug };
}
// Thiệp không còn cần thì ẩn đi để không ăn vào trần 5 thiệp của tài khoản test.
const retire = (w, owner = "u1") => WA({ method: "PATCH", ...auth(owner), body: { id: w.id, is_active: false } });
const adminPatch = (id, fields) => WA({ method: "PATCH", admin: true, body: { id, ...fields } });
const adminGet = async (id) => (await WA({ admin: true, query: { id } })).json;
async function activeCount(who) {
  const r = await WA({ ...auth(who), query: { resource: "my-weddings" } });
  if (r.status !== 200) throw new Error(`my-weddings (${who}) hỏng: ${r.status}`);
  return r.json.length;
}
async function fillToLimit(who) {
  let n = await activeCount(who);
  while (n < 5) {
    await newWedding(who);
    n++;
  }
}
async function newPromo(fields) {
  const r = await WA({ method: "POST", admin: true, query: { resource: "promo-codes" }, body: fields });
  if (r.status !== 200) throw new Error(`Tạo mã hỏng: ${r.status} ${r.text.slice(0, 200)}`);
  batches.add(r.json.batch_id);
  return r.json;
}
const payBody = (manage_id, extra = {}) => ({ manage_id, customer_name: "QA Tester", customer_email: "qa@example.com", template_name: THEME, theme: THEME, ...extra });
const orderStatus = async (order_id) => (await PAY("/check-payment-status", { query: { order_id } })).json;

// Chữ ký webhook theo tài liệu PayOS: sắp khoá a→z, null → rỗng, HMAC-SHA256 hex.
function payosSign(data, key) {
  const s = Object.keys(data).sort().map((k) => `${k}=${data[k] === null || data[k] === undefined ? "" : data[k]}`).join("&");
  return nodeCrypto.createHmac("sha256", key).update(s).digest("hex");
}
function webhookBody(orderId, amount, code = "00", key = PAYOS_KEY) {
  const data = {
    orderCode: Number(String(orderId).replace(/^ORDER-/, "")), amount, description: "QA", accountNumber: "0000000000",
    reference: `QA${RUN}${Date.now()}`, transactionDateTime: "2026-09-24 10:00:00", currency: "VND",
    paymentLinkId: "qa", code, desc: code === "00" ? "success" : "failed", counterAccountBankId: "",
    counterAccountBankName: "", counterAccountName: "", counterAccountNumber: "", virtualAccountName: "", virtualAccountNumber: "",
  };
  return { code, desc: data.desc, success: code === "00", data, signature: key ? payosSign(data, key) : undefined };
}
const WH = (body) => call("payos-webhook", { method: "POST", body });

// ================= WA — wedding-admin: thiệp =================
const FORBIDDEN = ["user_id", "expires_at", "payment_status", "payment_order_id", "transaction_id", "payment_time", "payment_amount", "contact"];

tc("API-WA-01", "CORS preflight origin hợp lệ", [], async () => {
  const r = await WA({ method: "OPTIONS", origin: "https://staging.cuoixinh.com" });
  const c = checker();
  c.eq("ACAO", r.headers.get("access-control-allow-origin"), "https://staging.cuoixinh.com");
  c.ok("Vary Origin", /origin/i.test(r.headers.get("vary") || ""));
  return c.done();
});
tc("API-WA-02", "CORS origin lạ không được phản chiếu", [], async () => {
  const r = await WA({ method: "OPTIONS", origin: "https://evil.com" });
  const c = checker();
  c.eq("ACAO", r.headers.get("access-control-allow-origin"), "https://cuoixinh.com");
  return c.done();
});
tc("API-WA-03", "CORS localhost mọi cổng", [], async () => {
  const r = await WA({ method: "OPTIONS", origin: "http://localhost:8123" });
  const c = checker();
  c.eq("ACAO", r.headers.get("access-control-allow-origin"), "http://localhost:8123");
  return c.done();
});
tc("API-WA-04", "Tạo thiệp khi chưa đăng nhập → 401", [], async () => {
  const r = await WA({ method: "POST", body: { manage_id: nodeCrypto.randomUUID() } });
  const c = checker();
  c.eq("status", r.status, 401);
  c.eq("code", r.json?.code, "AUTH_REQUIRED");
  return c.done();
});
tc("API-WA-05", "Tạo nháp (draft flow)", ["u1"], async () => {
  const id = nodeCrypto.randomUUID();
  const r = await WA({ method: "POST", ...auth("u1"), body: { manage_id: id, theme: THEME } });
  if (r.status === 200) created.set(id, "u1");
  const c = checker();
  c.eq("status", r.status, 200);
  c.eq("id", r.json?.id, id);
  c.ok("slug wedding-<8 ký tự id>", String(r.json?.slug).startsWith(`wedding-${id.slice(0, 8)}`), r.json?.slug);
  const g = await WA({ ...auth("u1"), query: { id } });
  c.eq("chủ đọc lại theo id", g.status, 200);
  S.W1 = { id, slug: r.json?.slug };
  const p = await WA({ method: "PATCH", ...auth("u1"), body: { id, slug: qaSlug(), groom_name: "QA An", bride_name: "QA Bình" } });
  c.eq("đặt slug qa", p.status, 200);
  S.W1.slug = (await WA({ ...auth("u1"), query: { id } })).json?.slug;
  return c.done();
});
tc("API-WA-06", "POST thiếu slug lẫn manage_id → 400", ["u1"], async () => {
  const r = await WA({ method: "POST", ...auth("u1"), body: {} });
  return { pass: r.status === 400, got: `${r.status} ${r.text.slice(0, 80)}` };
});
tc("API-WA-07", "POST slug sai định dạng → 400 INVALID_SLUG", ["u1"], async () => {
  const r = await WA({ method: "POST", ...auth("u1"), body: { slug: "An Binh" } });
  const c = checker();
  c.eq("status", r.status, 400);
  c.eq("code", r.json?.code, "INVALID_SLUG");
  return c.done();
});
tc("API-WA-08", "POST slug trùng → tự thêm hậu tố", ["u1", "W1"], async () => {
  const id = nodeCrypto.randomUUID();
  const r = await WA({ method: "POST", ...auth("u1"), body: { slug: S.W1.slug, manage_id: id } });
  if (r.status === 200) created.set(id, "u1");
  const c = checker();
  c.eq("status", r.status, 200);
  c.ok("slug có hậu tố", r.json?.slug?.startsWith(S.W1.slug + "-"), r.json?.slug);
  if (r.status === 200) await retire({ id });
  return c.done();
});
tc("API-WA-09", "Trần 5 thiệp → 409 WEDDING_LIMIT", ["u3"], async () => {
  await fillToLimit("u3");
  const id = nodeCrypto.randomUUID();
  const r = await WA({ method: "POST", ...auth("u3"), body: { manage_id: id } });
  if (r.status === 200) created.set(id, "u3");
  const c = checker();
  c.eq("status", r.status, 409);
  c.eq("code", r.json?.code, "WEDDING_LIMIT");
  c.eq("limit", r.json?.limit, 5);
  return c.done();
});
tc("API-WA-10", "Thiệp is_active=false không tính vào trần", ["u3"], async () => {
  await fillToLimit("u3");
  const mine = (await WA({ ...auth("u3"), query: { resource: "my-weddings" } })).json;
  const victim = mine.find((w) => created.has(w.id)) || mine[0];
  await WA({ method: "PATCH", ...auth("u3"), body: { id: victim.id, is_active: false } });
  const id = nodeCrypto.randomUUID();
  const r = await WA({ method: "POST", ...auth("u3"), body: { manage_id: id } });
  if (r.status === 200) created.set(id, "u3");
  return { pass: r.status === 200, got: `ẩn ${victim.id.slice(0, 8)} rồi tạo mới → ${r.status}` };
});
tc("API-WA-11", "POST lặp lại cùng id, cùng chủ → 200, không tạo trùng", ["u1", "W1"], async () => {
  const r = await WA({ method: "POST", ...auth("u1"), body: { manage_id: S.W1.id, theme: THEME } });
  const c = checker();
  c.eq("status", r.status, 200);
  c.eq("id", r.json?.id, S.W1.id);
  return c.done();
});
tc("API-WA-12", "POST trùng id của người khác → 403", ["u2", "W1"], async () => {
  const r = await WA({ method: "POST", ...auth("u2"), body: { manage_id: S.W1.id } });
  return { pass: r.status === 403 && r.json?.code === "FORBIDDEN", got: `${r.status} ${r.json?.code}` };
});
tc("API-WA-13", "Admin tạo thiệp không cần JWT, không dính trần", ["admin"], async () => {
  const id = nodeCrypto.randomUUID();
  const r = await WA({ method: "POST", admin: true, body: { manage_id: id, theme: THEME } });
  if (r.status === 200) created.set(id, "admin");
  return { pass: r.status === 200, got: `${r.status}` };
});
tc("API-WA-14", "GET ?slug công khai không lộ cột thanh toán / chủ", ["W1"], async () => {
  const r = await WA({ query: { slug: S.W1.slug } });
  const leaked = FORBIDDEN.filter((k) => r.json && k in r.json);
  const c = checker();
  c.eq("status", r.status, 200);
  c.eq("cột lộ", leaked, []);
  return c.done();
});
tc("API-WA-15", "Slug không tồn tại → 404 NOT_FOUND", [], async () => {
  const r = await WA({ query: { slug: `khong-co-that-${RUN}` } });
  return { pass: r.status === 404 && r.json?.code === "NOT_FOUND", got: `${r.status} ${r.json?.code}` };
});
tc("API-WA-16", "GET ?id khi chưa đăng nhập → 403", ["W1"], async () => {
  const r = await WA({ query: { id: S.W1.id } });
  return { pass: r.status === 403, got: `${r.status}` };
});
tc("API-WA-17", "GET ?id bởi người lạ → 403", ["u2", "W1"], async () => {
  const r = await WA({ ...auth("u2"), query: { id: S.W1.id } });
  return { pass: r.status === 403, got: `${r.status}` };
});
tc("API-WA-18", "Chủ GET ?id → 200 kèm cờ trạng thái, không user_id", ["u1", "W1"], async () => {
  const r = await WA({ ...auth("u1"), query: { id: S.W1.id } });
  const c = checker();
  c.eq("status", r.status, 200);
  c.eq("trial_locked", r.json?.trial_locked, false);
  c.eq("theme_locked", r.json?.theme_locked, false);
  c.eq("cột lộ", FORBIDDEN.filter((k) => r.json && k in r.json), []);
  return c.done();
});
tc("API-WA-19", "GET không slug/id → 400", [], async () => {
  const r = await WA({});
  return { pass: r.status === 400, got: `${r.status}` };
});
tc("API-WA-20", "Thiệp hết hạn dùng thử — khách mời → 403 TRIAL_EXPIRED, chỉ lộ tên + mẫu", ["u1", "admin"], async () => {
  const w = await newWedding("u1", { ceremony_location: "Địa chỉ bí mật QA" });
  S.W3 = w;
  await WA({ method: "PATCH", ...auth("u1"), body: { id: w.id, is_published: true } });
  await adminPatch(w.id, { expires_at: new Date(Date.now() - 86400e3).toISOString() });
  await retire(w);
  const r = await WA({ query: { slug: w.slug } });
  const c = checker();
  c.eq("status", r.status, 403);
  c.eq("code", r.json?.code, "TRIAL_EXPIRED");
  c.eq("khoá trả về", Object.keys(r.json || {}).sort(), ["bride_name", "code", "error", "groom_name", "theme"]);
  return c.done();
});
tc("API-WA-21", "Thiệp hết hạn — chủ mở trình chỉnh → 200 trial_locked", ["u1", "W3"], async () => {
  const r = await WA({ ...auth("u1"), query: { id: S.W3.id } });
  const c = checker();
  c.eq("status", r.status, 200);
  c.eq("trial_locked", r.json?.trial_locked, true);
  return c.done();
});
tc("API-WA-22", "Thiệp đã thanh toán → theme_locked", ["u1", "admin"], async () => {
  const w = await newWedding("u1");
  S.W2 = w;
  await adminPatch(w.id, { payment_status: "completed", expires_at: null });
  const r = await WA({ ...auth("u1"), query: { id: w.id } });
  const c = checker();
  c.eq("theme_locked", r.json?.theme_locked, true);
  c.eq("trial_locked", r.json?.trial_locked, false);
  return c.done();
});
tc("API-WA-23", "PATCH chưa đăng nhập → 401", ["W1"], async () => {
  const r = await WA({ method: "PATCH", body: { id: S.W1.id, groom_name: "X" } });
  return { pass: r.status === 401 && r.json?.code === "AUTH_REQUIRED", got: `${r.status}` };
});
tc("API-WA-24", "PATCH thiệp người khác → 403, dữ liệu không đổi", ["u1", "u2", "W1"], async () => {
  const r = await WA({ method: "PATCH", ...auth("u2"), body: { id: S.W1.id, groom_name: "HACK" } });
  const g = await WA({ ...auth("u1"), query: { id: S.W1.id } });
  const c = checker();
  c.eq("status", r.status, 403);
  c.eq("groom_name", g.json?.groom_name, "QA An");
  return c.done();
});
tc("API-WA-25", "PATCH cột ngoài allowlist bị bỏ qua", ["u1", "u2", "W1"], async () => {
  const r = await WA({ method: "PATCH", ...auth("u1"), body: { id: S.W1.id, payment_status: "completed", expires_at: null, user_id: U.u2.id, payment_amount: 0, transaction_id: "QA" } });
  const c = checker();
  c.eq("status", r.status, 200);
  c.eq("U1 vẫn là chủ", (await WA({ ...auth("u1"), query: { id: S.W1.id } })).status, 200);
  c.eq("U2 không thành chủ", (await WA({ ...auth("u2"), query: { id: S.W1.id } })).status, 403);
  if (ADMIN) {
    const row = await adminGet(S.W1.id);
    c.ok("payment_status không đổi", row?.payment_status !== "completed", J(row?.payment_status));
    c.ok("transaction_id không đổi", row?.transaction_id !== "QA");
  }
  return c.done();
});
const imgReject = (id, field, value, msg) =>
  tc(id, `${msg} → 400`, ["u1", "W1"], async () => {
    const r = await WA({ method: "PATCH", ...auth("u1"), body: { id: S.W1.id, [field]: value } });
    return { pass: r.status === 400, got: `${r.status} ${r.json?.error ?? ""}` };
  });
imgReject("API-WA-26", "groom_qr_url", "https://evil.com/qr.png", "Tráo QR bằng URL ngoài hệ thống");
imgReject("API-WA-27", "cover_image_url", 'a" onerror="alert(1)', "XSS qua tên file ảnh");
imgReject("API-WA-28", "gallery_images", ["ok.jpg", "javascript:alert(1)"], "Album chứa URL xấu");
imgReject("API-WA-29", "gallery_images", Array.from({ length: 11 }, (_, i) => `g${i}.jpg`), "Album > 10 ảnh");
imgReject("API-WA-30", "love_story", Array.from({ length: 11 }, () => ({ title: "x" })), "Love story > 10 mốc");
tc("API-WA-31", "Love story được làm sạch trước khi lưu", ["u1", "W1"], async () => {
  const r = await WA({ method: "PATCH", ...auth("u1"), body: { id: S.W1.id, love_story: [{ title: "t", content: "y".repeat(5000), image_url: 'x"y', onload: "z" }] } });
  const ls = (await WA({ ...auth("u1"), query: { id: S.W1.id } })).json?.love_story?.[0] || {};
  const c = checker();
  c.eq("status", r.status, 200);
  c.ok("không còn khoá lạ", !("onload" in ls));
  c.eq("content", (ls.content || "").length, 2000);
  c.eq("image_url", ls.image_url, null);
  return c.done();
});
imgReject("API-WA-32", "love_story", "không phải json", "Love story sai kiểu");
tc("API-WA-33", "Timeline: type lạ → ceremony", ["u1", "W1"], async () => {
  await WA({ method: "PATCH", ...auth("u1"), body: { id: S.W1.id, timeline: [{ time: "08:00", title: "Lễ", type: "<script>" }] } });
  const t = (await WA({ ...auth("u1"), query: { id: S.W1.id } })).json?.timeline?.[0];
  return { pass: t?.type === "ceremony", got: J(t) };
});
tc("API-WA-34", "Điểm lấy nét bị ép về số", ["u1", "W1"], async () => {
  await WA({ method: "PATCH", ...auth("u1"), body: { id: S.W1.id, image_focal_points: { cover_image_url: { x: "50;background:url(x)", y: -9 } } } });
  const fp = (await WA({ ...auth("u1"), query: { id: S.W1.id } })).json?.image_focal_points?.cover_image_url;
  return { pass: J(fp) === J({ x: 50, y: 0 }), got: J(fp) };
});
imgReject("API-WA-35", "slug", "Abc", "Slug sai khi sửa");
tc("API-WA-36", "Slug trùng khi sửa → 409", ["u1", "W1", "W3"], async () => {
  const r = await WA({ method: "PATCH", ...auth("u1"), body: { id: S.W1.id, slug: S.W3.slug } });
  return { pass: r.status === 409, got: `${r.status}` };
});
tc("API-WA-37", "Xuất bản lần đầu → expires_at ≈ now + 3 ngày", ["u1", "admin"], async () => {
  const w = await newWedding("u1");
  S.Wpub = w;
  await WA({ method: "PATCH", ...auth("u1"), body: { id: w.id, is_published: true } });
  const e = new Date((await adminGet(w.id))?.expires_at).getTime();
  S.WpubExp = e;
  const diff = Math.abs(e - (Date.now() + 3 * 86400e3));
  return { pass: diff < 10 * 60e3, got: `lệch ${Math.round(diff / 1000)} giây so với now+3 ngày` };
});
tc("API-WA-38", "Lưu lại thiệp đã xuất bản không gia hạn dùng thử", ["u1", "admin", "Wpub"], async () => {
  await new Promise((r) => setTimeout(r, 2000));
  await WA({ method: "PATCH", ...auth("u1"), body: { id: S.Wpub.id, is_published: true, groom_name: "QA An 2" } });
  const e = new Date((await adminGet(S.Wpub.id))?.expires_at).getTime();
  await retire(S.Wpub);
  return { pass: e === S.WpubExp, got: `trước ${new Date(S.WpubExp).toISOString()} · sau ${new Date(e).toISOString()}` };
});
tc("API-WA-39", "Xuất bản thiệp đã thanh toán giữ expires_at = null", ["u1", "admin", "W2"], async () => {
  await adminPatch(S.W2.id, { is_published: false });
  await WA({ method: "PATCH", ...auth("u1"), body: { id: S.W2.id, is_published: true } });
  const row = await adminGet(S.W2.id);
  return { pass: row?.expires_at === null, got: `expires_at=${row?.expires_at}` };
});
tc("API-WA-40", "Đổi mẫu sau khi thanh toán → 409 THEME_LOCKED", ["u1", "W2"], async () => {
  const r = await WA({ method: "PATCH", ...auth("u1"), body: { id: S.W2.id, theme: THEME_ALT } });
  return { pass: r.status === 409 && r.json?.code === "THEME_LOCKED", got: `${r.status} ${r.json?.code}` };
});
tc("API-WA-41", "Gửi lại đúng mẫu cũ sau thanh toán → 200", ["u1", "W2"], async () => {
  const r = await WA({ method: "PATCH", ...auth("u1"), body: { id: S.W2.id, theme: THEME, groom_name: "QA Y" } });
  await retire(S.W2);
  return { pass: r.status === 200, got: `${r.status}` };
});
tc("API-WA-42", "Người đăng nhập đầu tiên nhận chủ thiệp vô chủ", ["u1", "admin"], async () => {
  const w = await newWedding("admin");
  const r = await WA({ method: "PATCH", ...auth("u1"), body: { id: w.id, groom_name: "QA Claim" } });
  const g = await WA({ ...auth("u1"), query: { id: w.id } });
  created.set(w.id, "u1");
  await retire(w);
  return { pass: r.status === 200 && g.status === 200, got: `PATCH ${r.status} · GET chủ ${g.status}` };
});
tc("API-WA-45", "my-weddings chỉ trả thiệp của mình, đang hiện", ["u1", "u2", "W1"], async () => {
  const r = await WA({ ...auth("u1"), query: { resource: "my-weddings" } });
  const r2 = await WA({ ...auth("u2"), query: { resource: "my-weddings" } });
  const c = checker();
  c.eq("status", r.status, 200);
  c.ok("có W1", r.json?.some((w) => w.id === S.W1.id));
  c.ok("không có thiệp đã ẩn (W3)", !r.json?.some((w) => w.id === S.W3?.id));
  c.ok("U2 không thấy W1", !r2.json?.some((w) => w.id === S.W1.id));
  return c.done();
});
tc("API-WA-46", "my-weddings chưa đăng nhập → 401", [], async () => {
  const r = await WA({ query: { resource: "my-weddings" } });
  return { pass: r.status === 401, got: `${r.status}` };
});
tc("API-WA-47", "Xoá thiệp: chưa đăng nhập 401, người lạ 403", ["u2", "W1"], async () => {
  const a = await WA({ method: "DELETE", query: { id: S.W1.id } });
  const b = await WA({ method: "DELETE", ...auth("u2"), query: { id: S.W1.id } });
  return { pass: a.status === 401 && b.status === 403, got: `${a.status} · ${b.status}` };
});
tc("API-WA-48", "Thiệp vô chủ chỉ admin xoá được", ["u1", "admin"], async () => {
  const w = await newWedding("admin");
  const r = await WA({ method: "DELETE", ...auth("u1"), query: { id: w.id } });
  return { pass: r.status === 403, got: `${r.status}` };
});
tc("API-WA-49", "Chủ xoá thiệp → mất hàng + khách mời", ["u1"], async () => {
  const w = await newWedding("u1");
  await GH({ method: "POST", ...auth("u1"), query: { action: "insert-one" }, body: { wedding_id: w.id, side: "groom", guest: { full_name: "QA Khách" } } });
  const r = await WA({ method: "DELETE", ...auth("u1"), query: { id: w.id } });
  if (r.status === 200) created.delete(w.id);
  const g = await WA({ query: { slug: w.slug } });
  const gl = await GH({ ...auth("u1"), query: { action: "list", wedding_id: w.id } });
  const c = checker();
  c.eq("xoá", r.status, 200);
  c.eq("GET slug sau xoá", g.status, 404);
  c.eq("danh sách khách sau xoá", gl.status, 404);
  return c.done();
});
tc("API-WA-50", "Danh sách admin cần token", ["admin"], async () => {
  const a = await WA({ admin: true, query: { list: "true", page: "1", limit: "5" } });
  const b = await WA({ query: { list: "true" } });
  const c = checker();
  c.eq("có token", a.status, 200);
  c.ok("có pagination", typeof a.json?.pagination?.total === "number");
  c.eq("không token", b.status, 401);
  return c.done();
});
tc("API-WA-51", "Tìm kiếm admin có ký tự filter không làm hỏng truy vấn", ["admin"], async () => {
  const r = await WA({ admin: true, query: { list: "true", search: "a,b)(or.slug.eq.x" } });
  return { pass: r.status === 200, got: `${r.status}` };
});
tc("API-WA-52", "Method lạ → 405", [], async () => {
  const r = await WA({ method: "PUT", body: {} });
  return { pass: r.status === 405, got: `${r.status}` };
});

// ================= WR — wedding-admin: tài nguyên khác =================
tc("API-WR-01", "public-templates: mẫu đang bán + giá", [], async () => {
  const r = await WA({ query: { resource: "public-templates" } });
  const c = checker();
  c.eq("status", r.status, 200);
  c.ok("có mẫu", Array.isArray(r.json) && r.json.length > 0, `${r.json?.length} mẫu`);
  c.ok("có khoá price", r.json?.every((t) => "price" in t && "theme" in t));
  c.ok("ít nhất 1 mẫu có giá", r.json?.some((t) => t.price != null));
  return c.done();
});
tc("API-WR-03", "Quản lý templates cần admin", [], async () => {
  const q = { resource: "templates" };
  const st = [
    (await WA({ query: q })).status,
    (await WA({ method: "POST", query: q, body: {} })).status,
    (await WA({ method: "PATCH", query: q, body: { id: "x" } })).status,
    (await WA({ method: "DELETE", query: { ...q, id: "x" } })).status,
  ];
  return { pass: st.every((s) => s === 401), got: J(st) };
});
tc("API-WR-04", "Tìm nhạc YouTube", [], async () => {
  const a = await WA({ query: { resource: "youtube-search", q: "a" } });
  const b = await WA({ query: { resource: "youtube-search", q: "nhac dam cuoi" } });
  const c = checker();
  c.eq("q 1 ký tự", a.status, 400);
  c.eq("q hợp lệ", b.status, 200);
  c.ok("≤ 8 kết quả có id/url", Array.isArray(b.json) && b.json.length <= 8 && b.json.every((v) => v.id && v.url));
  return c.done();
});
tc("API-WR-09", "Sinh mã hàng loạt", ["admin"], async () => {
  const r = await newPromo({ count: 5, prefix: `qa${RUN}`, discount_type: "percent", discount_value: 10 });
  const pre = `QA${RUN.toUpperCase()}`;
  const c = checker();
  c.eq("số mã", r.codes.length, 5);
  c.ok("đúng tiền tố", r.codes.every((x) => x.code.startsWith(pre)));
  c.ok("không ký tự dễ nhầm", r.codes.every((x) => !/[01OIL]/.test(x.code.slice(pre.length))));
  c.ok("cùng batch", r.codes.every((x) => x.batch_id === r.batch_id));
  S.P10 = r.codes[0].code;
  return c.done();
});
tc("API-WR-05", "Kiểm mã hợp lệ (gõ chữ thường)", ["P10"], async () => {
  const r = await WA({ query: { resource: "promo", code: S.P10.toLowerCase() } });
  const c = checker();
  c.eq("valid", r.json?.valid, true);
  c.eq("code", r.json?.code, S.P10);
  return c.done();
});
tc("API-WR-06", "Không dò được mã bằng ký tự đại diện / tiền tố", ["P10"], async () => {
  const vals = [];
  for (const code of ["%", "T_ST", `${S.P10.slice(0, 4)}%`, S.P10.slice(0, -1)]) {
    vals.push((await WA({ query: { resource: "promo", code } })).json?.valid);
  }
  return { pass: vals.every((v) => v === false), got: J(vals) };
});
tc("API-WR-07", "Mã hết hạn / đã tắt → valid false", ["admin"], async () => {
  const exp = await newPromo({ mode: "single", code: `QA${RUN}EXP`, discount_type: "fixed", discount_value: 1000, expires_at: "2020-01-01T00:00:00Z" });
  const off = await newPromo({ mode: "single", code: `QA${RUN}OFF`, discount_type: "fixed", discount_value: 1000 });
  await WA({ method: "PATCH", admin: true, query: { resource: "promo-codes" }, body: { id: off.codes[0].id, is_active: false } });
  S.PEXP = exp.codes[0].code;
  S.POFF = off.codes[0].code;
  const a = (await WA({ query: { resource: "promo", code: S.PEXP } })).json;
  const b = (await WA({ query: { resource: "promo", code: S.POFF } })).json;
  return { pass: a?.valid === false && b?.valid === false, got: `hết hạn: ${a?.error} · tắt: ${b?.error}` };
});
tc("API-WR-08", "Mã có đơn tối thiểu cao hơn giá mẫu → valid false", ["admin"], async () => {
  const m = await newPromo({ mode: "single", code: `QA${RUN}MIN`, discount_type: "fixed", discount_value: 1000, min_order_amount: 999999999 });
  S.PMIN = m.codes[0].code;
  const r = (await WA({ query: { resource: "promo", code: S.PMIN, theme: THEME } })).json;
  return { pass: r?.valid === false && /tối thiểu/.test(r?.error || ""), got: J(r) };
});
tc("API-WR-10", "Sinh mã: giá trị sai → 400", ["admin"], async () => {
  const q = { resource: "promo-codes" };
  const st = [];
  for (const body of [{ discount_type: "x", discount_value: 10 }, { discount_type: "percent", discount_value: 150 }, { discount_type: "fixed", discount_value: 0 }]) {
    st.push((await WA({ method: "POST", admin: true, query: q, body })).status);
  }
  return { pass: st.every((s) => s === 400), got: J(st) };
});
tc("API-WR-11", "Mã tự gõ trùng → 400", ["admin", "P10"], async () => {
  const r = await WA({ method: "POST", admin: true, query: { resource: "promo-codes" }, body: { mode: "single", code: S.P10, discount_type: "percent", discount_value: 5 } });
  return { pass: r.status === 400 && /tồn tại/.test(r.json?.error || ""), got: `${r.status} ${r.json?.error}` };
});
tc("API-WR-12", "Giới hạn số lượng (200) và độ dài (12)", ["admin"], async () => {
  const r = await newPromo({ count: 500, length: 30, prefix: `qx${RUN}`, discount_type: "fixed", discount_value: 1000 });
  const pre = `QX${RUN.toUpperCase()}`;
  return { pass: r.codes.length === 200 && r.codes.every((x) => x.code.length === pre.length + 12), got: `${r.codes.length} mã, dài ${r.codes[0]?.code.length}` };
});
tc("API-WR-13", "Sửa mã không đổi được used_count / code", ["admin", "P10"], async () => {
  const list = (await WA({ admin: true, query: { resource: "promo-codes", q: S.P10 } })).json;
  const id = list.find((x) => x.code === S.P10).id;
  const r = await WA({ method: "PATCH", admin: true, query: { resource: "promo-codes" }, body: { id, used_count: 99, code: "HACK", note: "qa" } });
  const c = checker();
  c.eq("used_count", r.json?.used_count, 0);
  c.eq("code", r.json?.code, S.P10);
  return c.done();
});
tc("API-WR-16", "AI điền mẫu: rỗng → 400 (không gọi AI)", ["admin"], async () => {
  const r = await WA({ method: "POST", admin: true, query: { resource: "template-ai" }, body: {} });
  return { pass: r.status === 400, got: `${r.status}` };
});

// ================= PAY — payment-handler =================
tc("API-PAY-01", "Tạo đơn khi chưa đăng nhập → 401", [], async () => {
  const r = await PAY("/create-payment", { method: "POST", body: payBody(nodeCrypto.randomUUID()) });
  return { pass: r.status === 401 && r.json?.code === "AUTH_REQUIRED", got: `${r.status}` };
});
tc("API-PAY-02", "Thanh toán thiệp người khác → 403", ["u1", "u2"], async () => {
  S.Wpay = await newWedding("u1");
  const r = await PAY("/create-payment", { method: "POST", ...auth("u2"), body: payBody(S.Wpay.id) });
  return { pass: r.status === 403 && r.json?.code === "FORBIDDEN", got: `${r.status}` };
});
tc("API-PAY-03", "Thiếu customer_name → 400 kèm tên trường", ["u1", "Wpay"], async () => {
  const r = await PAY("/create-payment", { method: "POST", ...auth("u1"), body: payBody(S.Wpay.id, { customer_name: "" }) });
  return { pass: r.status === 400 && r.json?.missing?.includes("customer_name"), got: `${r.status} ${J(r.json?.missing)}` };
});
tc("API-PAY-06", "Mẫu không có giá (base-theme) → 400", ["u1", "Wpay"], async () => {
  const r = await PAY("/create-payment", { method: "POST", ...auth("u1"), body: payBody(S.Wpay.id, { theme: "base-theme" }) });
  return { pass: r.status === 400, got: `${r.status} ${r.json?.error ?? ""}` };
});
tc("API-PAY-05", "Không SĐT vẫn tạo được; giá lấy từ DB, bỏ qua amount client", ["u1", "Wpay"], async () => {
  const r = await PAY("/create-payment", { method: "POST", ...auth("u1"), body: payBody(S.Wpay.id, { amount: 1000, price: 1 }) });
  S.O1 = r.json?.order_id;
  const c = checker();
  c.eq("status", r.status, 200);
  c.eq("pricing.final_price", r.json?.pricing?.final_price, PRICE);
  c.eq("payment_info.amount", r.json?.payment_info?.amount, PRICE);
  c.ok("có order_id", /^ORDER-\d+$/.test(S.O1 || ""), S.O1);
  return c.done();
});
tc("API-PAY-07", "Đơn thanh toán không đổi slug thiệp đã có", ["u1", "Wpay", "O1"], async () => {
  const g = await WA({ ...auth("u1"), query: { id: S.Wpay.id } });
  return { pass: g.json?.slug === S.Wpay.slug, got: `${g.json?.slug} (cần ${S.Wpay.slug})` };
});
tc("API-PAY-08", "manage_id mới: tạo thiệp qua đơn, người mua là chủ, slug từ tên", ["u1"], async () => {
  const id = nodeCrypto.randomUUID();
  const r = await PAY("/create-payment", { method: "POST", ...auth("u1"), body: payBody(id, { customer_name: "Nguyễn Văn QA" }) });
  if (r.status === 200) created.set(id, "u1");
  const g = await WA({ ...auth("u1"), query: { id } });
  if (r.status === 200) await retire({ id });
  const c = checker();
  c.eq("status", r.status, 200);
  c.eq("chủ đọc được", g.status, 200);
  c.ok("slug bỏ dấu", /^nguyen-van-qa/.test(g.json?.slug || ""), g.json?.slug);
  return c.done();
});
tc("API-PAY-09", "Trần 5 thiệp qua đường thanh toán → 409", ["u3"], async () => {
  await fillToLimit("u3");
  const r = await PAY("/create-payment", { method: "POST", ...auth("u3"), body: payBody(nodeCrypto.randomUUID()) });
  return { pass: r.status === 409 && r.json?.code === "WEDDING_LIMIT", got: `${r.status} ${r.json?.code}` };
});
tc("API-PAY-10", "Đủ 5 thiệp vẫn trả tiền được cho thiệp đang có", ["u3"], async () => {
  await fillToLimit("u3");
  const mine = (await WA({ ...auth("u3"), query: { resource: "my-weddings" } })).json;
  S.W_U3 = mine[0];
  const r = await PAY("/create-payment", { method: "POST", ...auth("u3"), body: payBody(mine[0].id) });
  return { pass: r.status === 200, got: `${r.status} ${r.json?.error ?? ""}` };
});
tc("API-PAY-14", "Mã sai / hết hạn / tắt / dưới tối thiểu → 400, không trừ lượt", ["u1", "Wpay", "PEXP", "POFF", "PMIN"], async () => {
  const out = [];
  for (const code of [`KHONGCO${RUN}`, S.PEXP, S.POFF, S.PMIN]) {
    const r = await PAY("/create-payment", { method: "POST", ...auth("u1"), body: payBody(S.Wpay.id, { promo_code: code }) });
    out.push(`${code}:${r.status}`);
  }
  const used = (await WA({ admin: true, query: { resource: "promo-codes", q: `QA${RUN}` } })).json
    .filter((x) => [S.PEXP, S.POFF, S.PMIN].includes(x.code)).map((x) => x.used_count);
  return { pass: out.every((s) => s.endsWith(":400")) && used.every((n) => n === 0), got: `${out.join(" ")} · used_count=${J(used)}` };
});
tc("API-PAY-17", "Mã giảm 100% → hoàn tất ngay, không QR", ["u1", "admin"], async () => {
  const p = await newPromo({ count: 2, prefix: `qf${RUN}`, discount_type: "percent", discount_value: 100 });
  S.P100 = p.codes[0];
  S.P100batch = p.batch_id;
  const w = await newWedding("u1");
  S.Wfree = w;
  const r = await PAY("/create-payment", { method: "POST", ...auth("u1"), body: payBody(w.id, { promo_code: S.P100.code }) });
  S.Ofree = r.json?.order_id;
  const row = await adminGet(w.id);
  await retire(w);
  const c = checker();
  c.eq("status", r.status, 200);
  c.eq("free", r.json?.free, true);
  c.ok("không có qr_code", !r.json?.qr_code);
  c.eq("payment_status", row?.payment_status, "completed");
  c.eq("payment_amount", row?.payment_amount, 0);
  c.eq("expires_at", row?.expires_at, null);
  c.ok("transaction_id PROMO-", String(row?.transaction_id).startsWith("PROMO-"));
  return c.done();
});
tc("API-WR-14", "Không xoá được mã đã có đơn chốt", ["admin", "P100"], async () => {
  const r = await WA({ method: "DELETE", admin: true, query: { resource: "promo-codes", id: S.P100.id } });
  return { pass: r.status === 409, got: `${r.status}` };
});
tc("API-WR-15", "Xoá cả lô, giữ mã đã dùng", ["admin", "P100"], async () => {
  const r = await WA({ method: "DELETE", admin: true, query: { resource: "promo-codes", batch_id: S.P100batch } });
  return { pass: r.status === 200 && r.json?.deleted === 1 && r.json?.kept === 1, got: `${r.status} ${J(r.json)}` };
});
tc("API-PAY-11", "Mã 10% → số tiền = giá − 10%, giữ lượt", ["u1", "admin"], async () => {
  const p = await newPromo({ mode: "single", code: `QA${RUN}P10`, discount_type: "percent", discount_value: 10 });
  S.Wpromo = await newWedding("u1");
  const r = await PAY("/create-payment", { method: "POST", ...auth("u1"), body: payBody(S.Wpromo.id, { promo_code: p.codes[0].code }) });
  S.O2 = r.json?.order_id;
  S.O2amount = r.json?.pricing?.final_price;
  await retire(S.Wpromo);
  const want = PRICE - Math.round(PRICE * 10 / 100);
  const c = checker();
  c.eq("status", r.status, 200);
  c.eq("pricing.final_price", r.json?.pricing?.final_price, want);
  c.eq("payment_info.amount", r.json?.payment_info?.amount, want);
  return c.done();
});
tc("API-PAY-13", "Đơn có mã thứ hai trong 5 phút → 400 đơn đang chờ", ["u1", "O2", "P10"], async () => {
  const r = await PAY("/create-payment", { method: "POST", ...auth("u1"), body: payBody(S.Wpay.id, { promo_code: S.P10 }) });
  return { pass: r.status === 400 && /chờ thanh toán/.test(r.text), got: `${r.status} ${r.json?.error ?? ""}` };
});
tc("API-PAY-15", "Tranh lượt cuối: đúng 1 đơn được giảm", ["u2", "u3", "admin"], async () => {
  const p = await newPromo({ mode: "single", code: `QA${RUN}ONE`, discount_type: "fixed", discount_value: 1000, max_uses: 1 });
  const w2 = await newWedding("u2");
  await fillToLimit("u3");
  const w3 = (await WA({ ...auth("u3"), query: { resource: "my-weddings" } })).json[0];
  const [a, b] = await Promise.all([
    PAY("/create-payment", { method: "POST", ...auth("u2"), body: payBody(w2.id, { promo_code: p.codes[0].code }) }),
    PAY("/create-payment", { method: "POST", ...auth("u3"), body: payBody(w3.id, { promo_code: p.codes[0].code }) }),
  ]);
  const wins = [a, b].filter((r) => r.status === 200).length;
  return { pass: wins === 1, got: `u2=${a.status} u3=${b.status}` };
});
tc("API-PAY-19", "Kiểm trạng thái đơn: chờ / hoàn tất", ["O1", "Ofree"], async () => {
  const a = await orderStatus(S.O1);
  const b = await orderStatus(S.Ofree);
  const c = checker();
  c.eq("đơn thường", a?.status, "pending");
  c.eq("đơn 100%", b?.status, "completed");
  c.ok("có manage_id + slug", !!(b?.manage_id && b?.slug));
  return c.done();
});
tc("API-PAY-20", "Kiểm trạng thái đơn không tồn tại / thiếu tham số", [], async () => {
  const a = await PAY("/check-payment-status", { query: { order_id: "ORDER-0" } });
  const b = await PAY("/check-payment-status");
  return { pass: a.status === 404 && b.status === 400, got: `${a.status} · ${b.status}` };
});
tc("API-PAY-22", "Đường lạ → 404", [], async () => {
  const r = await PAY("/abc", { method: "POST", body: {} });
  return { pass: r.status === 404, got: `${r.status}` };
});

// ================= WH — payos-webhook =================
tc("API-WH-01", "Health check", [], async () => {
  const r = await call("payos-webhook");
  return { pass: r.status === 200 && r.json?.status === "ok", got: `${r.status}` };
});
tc("API-WH-02", "Webhook không chữ ký → 401, đơn vẫn chờ", ["O1"], async () => {
  const body = webhookBody(S.O1, PRICE, "00", "");
  delete body.signature;
  const r = await WH(body);
  const st = await orderStatus(S.O1);
  return { pass: r.status === 401 && st?.status === "pending", got: `${r.status} · đơn=${st?.status}` };
});
tc("API-WH-03", "Chữ ký giả → 401", ["O1"], async () => {
  const body = webhookBody(S.O1, PRICE, "00", "");
  body.signature = "0".repeat(64);
  const r = await WH(body);
  return { pass: r.status === 401, got: `${r.status}` };
});
tc("API-WH-05", "Ký đúng nhưng lệch số tiền → 400", ["payos", "O1"], async () => {
  const r = await WH(webhookBody(S.O1, PRICE - 1000));
  const st = await orderStatus(S.O1);
  return { pass: r.status === 400 && st?.status === "pending", got: `${r.status} · đơn=${st?.status}` };
});
tc("API-WH-04", "Ký đúng, đúng số tiền → đơn hoàn tất", ["payos", "O1"], async () => {
  const r = await WH(webhookBody(S.O1, PRICE));
  const st = await orderStatus(S.O1);
  return { pass: r.status === 200 && st?.status === "completed", got: `${r.status} · đơn=${st?.status}` };
});
tc("API-WH-09", "Webhook lặp lại → vẫn 200, vẫn hoàn tất", ["payos", "O1"], async () => {
  const r = await WH(webhookBody(S.O1, PRICE));
  const st = await orderStatus(S.O1);
  return { pass: r.status === 200 && st?.status === "completed", got: `${r.status} · đơn=${st?.status}` };
});
tc("API-WH-10", "Webhook 'thất bại' đến sau thành công không hạ trạng thái", ["payos", "O1"], async () => {
  const r = await WH(webhookBody(S.O1, PRICE, "01"));
  const st = await orderStatus(S.O1);
  return { pass: st?.status === "completed", got: `${r.status} · đơn=${st?.status}` };
}, { known: "NV-01" });
tc("API-WH-06", "Đơn có mã: số kỳ vọng là số SAU giảm", ["payos", "O2"], async () => {
  const a = await WH(webhookBody(S.O2, PRICE));
  const b = await WH(webhookBody(S.O2, S.O2amount));
  const st = await orderStatus(S.O2);
  return { pass: a.status === 400 && b.status === 200 && st?.status === "completed", got: `giá niêm yết=${a.status} · giá sau giảm=${b.status} · đơn=${st?.status}` };
});
tc("API-WH-07", "orderCode không có trong DB → 404", ["payos"], async () => {
  const r = await WH(webhookBody("ORDER-1", 1000));
  return { pass: r.status === 404, got: `${r.status}` };
});
tc("API-WH-13", "Webhook cũ trong payment-handler từ chối payload giả", [], async () => {
  const r = await PAY("/webhook", { method: "POST", body: { code: "00", data: { orderCode: 1, amount: 1 }, signature: "x" } });
  return { pass: r.status === 401, got: `${r.status}` };
});

// ================= GH — guest-handler =================
const gl = (who, wedding_id, side) => GH({ ...auth(who), query: { action: "list", wedding_id, ...(side ? { side } : {}) } });
const gImport = (wedding_id, side, guests, overwrite = false) =>
  GH({ method: "POST", ...auth("u1"), query: { action: "import" }, body: { wedding_id, side, guests, overwrite } });
const names = (p, n, from = 1) => Array.from({ length: n }, (_, i) => ({ full_name: `${p}${from + i}`, display_name: "", relationship: "" }));

tc("API-GH-00", "Chuẩn bị: 2 thiệp của U1 cho nhóm khách mời", ["u1"], async () => {
  S.G1 = await newWedding("u1");
  S.G2 = await newWedding("u1");
  return { pass: true, got: `${S.G1.slug} · ${S.G2.slug}` };
});
tc("API-GH-01", "Danh sách khách: chưa đăng nhập 401 / người lạ 403", ["u2", "G1"], async () => {
  const a = await gl("anon", S.G1.id), b = await gl("u2", S.G1.id);
  return { pass: a.status === 401 && b.status === 403, got: `${a.status} · ${b.status}` };
});
tc("API-GH-03", "Thiệp vô chủ chưa claim → 403", ["u1", "admin"], async () => {
  const w = await newWedding("admin");
  const r = await gl("u1", w.id);
  return { pass: r.status === 403, got: `${r.status}` };
});
tc("API-GH-06", "Thêm 1 khách", ["u1", "G1"], async () => {
  const r = await GH({ method: "POST", ...auth("u1"), query: { action: "insert-one" }, body: { wedding_id: S.G1.id, side: "groom", guest: { full_name: "QA Một" } } });
  S.guestG1 = r.json?.id;
  return { pass: r.status === 201, got: `${r.status}` };
});
tc("API-GH-04", "Chủ đọc danh sách theo bên", ["u1", "G1"], async () => {
  const r = await gl("u1", S.G1.id, "groom");
  return { pass: r.status === 200 && r.json.every((g) => g.side === "groom"), got: `${r.status} · ${r.json?.length} khách` };
});
tc("API-GH-05", "Thông tin thiệp cho trang khách", ["u1", "G1"], async () => {
  const r = await GH({ ...auth("u1"), query: { action: "wedding", wedding_id: S.G1.id } });
  return { pass: r.status === 200 && r.json?.slug === S.G1.slug, got: `${r.status} ${r.json?.slug}` };
});
tc("API-GH-07", "Thiếu tên / side sai → 400", ["u1", "G1"], async () => {
  const a = await GH({ method: "POST", ...auth("u1"), query: { action: "insert-one" }, body: { wedding_id: S.G1.id, side: "groom", guest: { full_name: "" } } });
  const b = await GH({ method: "POST", ...auth("u1"), query: { action: "insert-one" }, body: { wedding_id: S.G1.id, side: "x", guest: { full_name: "A" } } });
  return { pass: a.status === 400 && b.status === 400, got: `${a.status} · ${b.status}` };
});
tc("API-GH-08", "Trần 100 khách mỗi bên", ["u1", "G1"], async () => {
  const cur = (await gl("u1", S.G1.id, "groom")).json.length;
  await gImport(S.G1.id, "groom", names("Trần ", 100 - cur));
  const r = await GH({ method: "POST", ...auth("u1"), query: { action: "insert-one" }, body: { wedding_id: S.G1.id, side: "groom", guest: { full_name: "Thứ 101" } } });
  return { pass: r.status === 400 && /giới hạn/.test(r.json?.error || ""), got: `${r.status} ${r.json?.error}` };
});
tc("API-GH-12", "Import ghi đè vượt trần → 409, không chèn gì", ["u1", "G1"], async () => {
  const r = await gImport(S.G1.id, "groom", names("Mới ", 1), true);
  const n = (await gl("u1", S.G1.id, "groom")).json.length;
  return { pass: r.status === 409 && n === 100, got: `${r.status} · còn ${n} khách` };
});
tc("API-GH-09", "Import không ghi đè, có trùng", ["u1", "G1"], async () => {
  await gImport(S.G1.id, "bride", names("B", 10));
  const r = await gImport(S.G1.id, "bride", [...names("B", 3), ...names("C", 7)]);
  return { pass: r.json?.inserted === 7 && r.json?.skipped === 3, got: J(r.json) };
});
tc("API-GH-10", "Import vượt trần (không ghi đè) → cắt bớt", ["u1", "G1"], async () => {
  await gImport(S.G1.id, "bride", names("D", 78));
  const r = await gImport(S.G1.id, "bride", names("E", 10));
  return { pass: r.json?.inserted === 5 && r.json?.capped === true, got: J(r.json) };
});
tc("API-GH-11", "Import ghi đè: xoá bản trùng rồi chèn", ["u1", "G2"], async () => {
  await gImport(S.G2.id, "groom", names("F", 5));
  const r = await gImport(S.G2.id, "groom", [...names("F", 3), ...names("H", 2)], true);
  const n = (await gl("u1", S.G2.id, "groom")).json.length;
  return { pass: r.json?.inserted === 5 && n === 7, got: `${J(r.json)} · tổng ${n}` };
});
tc("API-GH-13", "Import > 100 dòng / mảng rỗng → 400", ["u1", "G2"], async () => {
  const a = await gImport(S.G2.id, "bride", names("X", 101));
  const b = await gImport(S.G2.id, "bride", []);
  return { pass: a.status === 400 && b.status === 400, got: `${a.status} · ${b.status}` };
});
tc("API-GH-14", "Cắt độ dài tên / xưng hô", ["u1", "G2"], async () => {
  const r = await GH({ method: "POST", ...auth("u1"), query: { action: "insert-one" }, body: { wedding_id: S.G2.id, side: "bride", guest: { full_name: "N".repeat(500), relationship: "R".repeat(300) } } });
  return { pass: r.json?.full_name?.length === 200 && r.json?.relationship?.length === 100, got: `${r.json?.full_name?.length}/${r.json?.relationship?.length}` };
});
tc("API-GH-15", "Sửa khách của thiệp khác → 403", ["u2", "guestG1"], async () => {
  const r = await GH({ method: "PATCH", ...auth("u2"), query: { action: "update-guest" }, body: { id: S.guestG1, full_name: "HACK" } });
  return { pass: r.status === 403, got: `${r.status}` };
});
tc("API-GH-16", "Cập nhật link hàng loạt: 4 ca sai → 400", ["u1", "guestG1", "G2"], async () => {
  const other = (await gl("u1", S.G2.id)).json[0].id;
  const q = { action: "update-links-batch" };
  const st = [];
  for (const updates of [
    Array.from({ length: 201 }, () => ({ id: S.guestG1, link: "x" })),
    [{ id: "khong-phai-uuid", link: "x" }],
    [{ id: S.guestG1, link: "x".repeat(2049) }],
    [{ id: S.guestG1, link: "x" }, { id: other, link: "y" }],
  ]) st.push((await GH({ method: "PATCH", ...auth("u1"), query: q, body: { updates } })).status);
  return { pass: st.every((s) => s === 400), got: J(st) };
});
tc("API-GH-17", "Xoá khách: >200 id / id sai / người lạ / chủ", ["u1", "u2", "G2"], async () => {
  const id = (await gl("u1", S.G2.id)).json.find((g) => g.full_name === "H2").id;
  const del = (who, ids) => GH({ method: "DELETE", ...auth(who), body: { ids } });
  const st = [
    (await del("u1", Array.from({ length: 201 }, () => id))).status,
    (await del("u1", ["abc"])).status,
    (await del("u2", [id])).status,
    (await del("u1", [id])).status,
  ];
  return { pass: J(st) === J([400, 400, 403, 200]), got: J(st) };
});
tc("API-GH-18", "RSVP khớp khách", ["u1", "G2"], async () => {
  await GH({ method: "POST", ...auth("u1"), query: { action: "insert-one" }, body: { wedding_id: S.G2.id, side: "bride", guest: { full_name: "Nguyễn Thị Lan QA", display_name: "Chị Lan QA", relationship: "Chị" } } });
  const r = await GH({ method: "POST", query: { action: "rsvp" }, body: { slug: S.G2.slug, name: "Chị Lan QA", relationship: "Chị", attending: true, message: "Sẽ đến" } });
  const g = (await gl("u1", S.G2.id)).json.find((x) => x.display_name === "Chị Lan QA");
  const c = checker();
  c.eq("matched", r.json?.matched, true);
  c.eq("confirmed", g?.confirmed, "Có tham dự");
  c.eq("message", g?.message, "Sẽ đến");
  return c.done();
});
tc("API-GH-19", "RSVP không khớp → 200 matched false", ["G2"], async () => {
  const r = await GH({ method: "POST", query: { action: "rsvp" }, body: { slug: S.G2.slug, name: "Người Lạ QA", attending: true } });
  return { pass: r.status === 200 && r.json?.matched === false, got: `${r.status} ${J(r.json)}` };
});
tc("API-GH-20", "RSVP không tham dự, không lời nhắn → giữ lời nhắn cũ", ["u1", "G2"], async () => {
  await GH({ method: "POST", query: { action: "rsvp" }, body: { slug: S.G2.slug, name: "Chị Lan QA", relationship: "Chị", attending: false } });
  const g = (await gl("u1", S.G2.id)).json.find((x) => x.display_name === "Chị Lan QA");
  return { pass: g?.confirmed === "Không tham dự" && g?.message === "Sẽ đến", got: `${g?.confirmed} · ${g?.message}` };
});
tc("API-GH-21", "RSVP không phân biệt hoa thường / khoảng trắng", ["G2"], async () => {
  const r = await GH({ method: "POST", query: { action: "rsvp" }, body: { slug: S.G2.slug, name: "  chị lan qa ", relationship: "chị", attending: true } });
  return { pass: r.json?.matched === true, got: J(r.json) };
});
tc("API-GH-22", "Trùng tên, khác xưng hô → cập nhật đúng người", ["u1", "G2"], async () => {
  for (const rel of ["Cô", "Em"]) {
    await GH({ method: "POST", ...auth("u1"), query: { action: "insert-one" }, body: { wedding_id: S.G2.id, side: "bride", guest: { full_name: "Lan QA2", relationship: rel } } });
  }
  await GH({ method: "POST", query: { action: "rsvp" }, body: { slug: S.G2.slug, name: "Lan QA2", relationship: "Em", attending: true } });
  const rows = (await gl("u1", S.G2.id)).json.filter((x) => x.full_name === "Lan QA2");
  const em = rows.find((x) => x.relationship === "Em"), co = rows.find((x) => x.relationship === "Cô");
  return { pass: em?.confirmed === "Có tham dự" && !co?.confirmed, got: `Em=${em?.confirmed} · Cô=${co?.confirmed}` };
});
const wish = (slug, name, relationship, text) => GH({ method: "POST", query: { action: "wish" }, body: { slug, name, relationship, text } });
tc("API-GH-23", "Gửi lời chúc hợp lệ → 201, còn 2 lượt", ["G2"], async () => {
  const r = await wish(S.G2.slug, "Chị Lan QA", "Chị", "Chúc mừng QA 1");
  return { pass: r.status === 201 && r.json?.remaining === 2, got: `${r.status} ${J(r.json?.remaining)}` };
});
tc("API-GH-24", "Người không có trong danh sách → 403", ["G2"], async () => {
  const r = await wish(S.G2.slug, "Người Lạ QA", "", "spam");
  return { pass: r.status === 403, got: `${r.status}` };
});
tc("API-GH-25", "Lời chúc thứ 4 → 409", ["G2"], async () => {
  await wish(S.G2.slug, "Chị Lan QA", "Chị", "Chúc mừng QA 2");
  await wish(S.G2.slug, "Chị Lan QA", "Chị", "Chúc mừng QA 3");
  const r = await wish(S.G2.slug, "Chị Lan QA", "Chị", "Chúc mừng QA 4");
  return { pass: r.status === 409, got: `${r.status}` };
});
tc("API-GH-26", "Lời chúc rỗng → 400; quá dài → cắt 500", ["G2"], async () => {
  const a = await wish(S.G2.slug, "Lan QA2", "Cô", "");
  const b = await wish(S.G2.slug, "Lan QA2", "Cô", "x".repeat(800));
  return { pass: a.status === 400 && b.json?.wish?.text?.length === 500, got: `${a.status} · ${b.json?.wish?.text?.length}` };
});
tc("API-GH-28", "Danh sách lời chúc công khai chỉ có trường cần thiết", ["G2"], async () => {
  const r = await GH({ query: { action: "wishes-list", slug: S.G2.slug } });
  const keys = [...new Set((r.json || []).flatMap(Object.keys))].sort();
  const sorted = (r.json || []).every((w, i, a) => i === 0 || (a[i - 1].at || "") >= (w.at || ""));
  return { pass: r.status === 200 && J(keys) === J(["at", "id", "name", "relationship", "text"]) && sorted, got: `${r.status} khoá=${J(keys)} mới nhất trước=${sorted}` };
});
tc("API-GH-29", "Chủ xoá lời chúc; người lạ không xoá được", ["u1", "u2", "G2"], async () => {
  const g = (await gl("u1", S.G2.id)).json.find((x) => x.display_name === "Chị Lan QA");
  const wid = g?.wishes?.[0]?.id;
  const a = await GH({ method: "PATCH", ...auth("u2"), query: { action: "delete-wish" }, body: { guest_id: g.id, wish_id: wid } });
  const b = await GH({ method: "PATCH", ...auth("u1"), query: { action: "delete-wish" }, body: { guest_id: g.id, wish_id: wid } });
  return { pass: a.status === 403 && b.status === 200 && b.json?.wishes?.length === 2, got: `${a.status} · ${b.status} còn ${b.json?.wishes?.length}` };
});
tc("API-GH-27", "Thiệp tắt lời chúc → 403", ["u1", "G2"], async () => {
  await WA({ method: "PATCH", ...auth("u1"), body: { id: S.G2.id, enable_wishes: false } });
  const r = await wish(S.G2.slug, "Lan QA2", "Em", "x");
  await retire(S.G1);
  await retire(S.G2);
  return { pass: r.status === 403, got: `${r.status}` };
});

// ================= AI =================
tc("API-AI-01", "GET → 405", [], async () => {
  const a = await call("ai-invitation"), b = await call("ai-chat");
  return { pass: a.status === 405 && b.status === 405, got: `${a.status} · ${b.status}` };
});
tc("API-AI-02", "Body hỏng / thiếu mode → 400 (không tốn lượt)", [], async () => {
  const a = await call("ai-invitation", { method: "POST", body: "abc" });
  const b = await call("ai-invitation", { method: "POST", body: {} });
  return { pass: a.status === 400 && b.status === 400, got: `${a.status} · ${b.status}` };
});
tc("API-AI-13", "Chat rỗng → 400 (không tốn lượt)", [], async () => {
  const r = await call("ai-chat", { method: "POST", body: { messages: [] } });
  return { pass: r.status === 400, got: `${r.status}` };
});
tc("API-AI-03", "Tối ưu văn bản", ["ai", "u1"], async () => {
  const r = await call("ai-invitation", { method: "POST", jwt: U.u1.jwt, body: { mode: "optimize", inputType: "slogan", text: "Chúng mình cưới rồi" } });
  return { pass: r.status === 200, got: `${r.status} ${r.text.slice(0, 80)}` };
});
tc("API-AI-05", "Tạo chuyện tình yêu", ["ai", "u1"], async () => {
  const r = await call("ai-invitation", { method: "POST", jwt: U.u1.jwt, body: { mode: "love_story", text: "Gặp nhau năm 2020 ở Đà Lạt, yêu nhau 3 năm rồi cầu hôn ở biển." } });
  return { pass: r.status === 200, got: `${r.status} ${r.text.slice(0, 80)}` };
});
tc("API-AI-11", "Khách ẩn danh đổi x-forwarded-for + device vẫn bị chặn ở lượt 6", ["ai"], async () => {
  const st = [];
  for (let i = 0; i < 6; i++) {
    const r = await call("ai-invitation", {
      method: "POST",
      headers: { "x-forwarded-for": `10.9.${i}.${i}` },
      body: { mode: "optimize", inputType: "slogan", text: "thử", device: `qa-dev-${RUN}-${i}xxxx` },
    });
    st.push(r.status);
    if (r.status === 429) break;
  }
  return { pass: st.includes(429), got: `${J(st)} (IP thật của máy chạy test đã tốn lượt ẩn danh hôm nay)` };
});

// ================= CL — cleanup-weddings (LUÔN dry_run) =================
const CL = (query, token) => call("cleanup-weddings", { method: "POST", query: { ...query, dry_run: "1" }, headers: token ? { "x-admin-token": token } : {} });
tc("API-CL-01", "Không có token → 401", [], async () => {
  const r = await CL({});
  return { pass: r.status === 401, got: `${r.status}` };
});
tc("API-CL-03", "days sai → 400", ["cleanup"], async () => {
  const a = await CL({ days: "0" }, CLEANUP), b = await CL({ days: "abc" }, CLEANUP);
  return { pass: a.status === 400 && b.status === 400, got: `${a.status} · ${b.status}` };
});
tc("API-CL-04", "Dry run chỉ liệt kê, lọc đúng thiệp", ["cleanup", "admin"], async () => {
  const mk = async (fields) => {
    const w = await newWedding("admin");
    await adminPatch(w.id, { is_published: true });
    await adminPatch(w.id, fields);
    return w;
  };
  const old = new Date(Date.now() - 40 * 86400e3).toISOString();
  const A = await mk({ expires_at: old });                                   // CL-05: phải có
  const B = await mk({ expires_at: old, payment_status: "completed" });      // CL-06: không được có
  const C = await mk({ expires_at: new Date(Date.now() - 10 * 86400e3).toISOString() }); // CL-07
  const r = await CL({}, CLEANUP);
  const ids = new Set((r.json?.items || []).map((x) => x.id));
  const still = await adminGet(A.id);
  const c = checker();
  c.eq("status", r.status, 200);
  c.eq("dry_run", r.json?.dry_run, true);
  c.ok("CL-05 thiệp quá hạn chưa trả tiền có trong danh sách", ids.has(A.id) || r.json?.count >= 100, r.json?.count >= 100 ? "(danh sách chạm trần 100, không kết luận được)" : "");
  c.ok("CL-06 thiệp đã trả tiền KHÔNG có", !ids.has(B.id));
  c.ok("CL-07 thiệp mới hết hạn 10 ngày KHÔNG có", !ids.has(C.id));
  c.ok("dry run không xoá gì", !!still?.id);
  return c.done();
});

// ---------------- Chạy ----------------
const group = (id) => id.split("-")[1];
const selected = CASES.filter((c) => !ONLY || ONLY.includes(group(c.id)));
if (flag("list")) {
  for (const c of selected) console.log(`${c.id.padEnd(11)} [${c.needs.join(",") || "-"}] ${c.title}${c.known ? `  (${c.known})` : ""}`);
  console.log(`\n${selected.length} ca`);
  process.exit(0);
}

console.log(`Đích: ${BASE} (staging) · run ${RUN}`);
for (const k of ["u1", "u2", "u3"]) {
  try {
    U[k] = await login(k);
  } catch (e) {
    console.error(`✗ ${e.message}`);
  }
}
const have = {
  u1: !!U.u1, u2: !!U.u2, u3: !!U.u3, admin: !!ADMIN, payos: !!PAYOS_KEY, cleanup: !!CLEANUP, ai: flag("with-ai"),
};
console.log("Có: " + Object.entries(have).map(([k, v]) => `${k}${v ? "✓" : "✗"}`).join(" "));

// Mẫu dùng để test: mẫu đầu tiên có giá + một mẫu khác để thử khoá đổi mẫu.
const tpl = await WA({ query: { resource: "public-templates" } });
if (tpl.status !== 200) {
  console.error(`✗ Không đọc được danh mục mẫu (${tpl.status}) — kiểm mạng tới ${BASE}`);
  process.exit(1);
}
const priced = tpl.json.filter((t) => t.price != null);
THEME = priced[0]?.theme;
PRICE = priced[0]?.price;
THEME_ALT = tpl.json.find((t) => t.theme !== THEME)?.theme;
if (!THEME) {
  console.error("✗ Không có mẫu nào có giá trên staging — nhóm PAY/WH sẽ hỏng.");
}
if (U.u1) {
  const n = await activeCount("u1");
  if (n > 2) console.warn(`! U1 đang có ${n} thiệp hiện — test tạo thêm có thể chạm trần 5.`);
}

const results = [];
for (const c of selected) {
  const miss = c.needs.filter((n) => (n in have ? !have[n] : S[n] === undefined));
  if (miss.length) {
    results.push({ ...c, status: "SKIP", got: `thiếu ${miss.join(", ")}` });
    continue;
  }
  let r;
  try {
    r = await c.body();
  } catch (e) {
    r = { pass: false, got: "THROW " + (e.message || e) };
  }
  results.push({ ...c, status: r.pass ? "PASS" : c.known ? "KNOWN" : "FAIL", got: r.got });
}

// ---------------- Dọn ----------------
if (!flag("keep")) {
  let ok = 0, bad = 0;
  for (const [id, owner] of created) {
    const r = ADMIN ? await WA({ method: "DELETE", admin: true, query: { id } }) : owner !== "admin" && U[owner] ? await WA({ method: "DELETE", ...auth(owner), query: { id } }) : { status: 0 };
    r.status === 200 ? ok++ : bad++;
  }
  for (const b of batches) {
    await WA({ method: "DELETE", admin: true, query: { resource: "promo-codes", batch_id: b } });
    const left = (await WA({ admin: true, query: { resource: "promo-codes", batch_id: b } })).json || [];
    for (const x of left) await WA({ method: "PATCH", admin: true, query: { resource: "promo-codes" }, body: { id: x.id, is_active: false } });
  }
  console.log(`Dọn: xoá ${ok} thiệp${bad ? `, ${bad} thiệp không xoá được (slug qa-${RUN}-*)` : ""} · ${batches.size} lô mã (mã đã dùng chỉ tắt)`);
}

// ---------------- In kết quả ----------------
const count = (s) => results.filter((r) => r.status === s).length;
for (const r of results) {
  if (r.status === "PASS" && !VERBOSE) continue;
  console.log(`${r.status.padEnd(5)} ${r.id}. ${r.title}${r.known && r.status === "KNOWN" ? `  [${r.known}]` : ""}\n        ${r.got}`);
}
console.log(`\nTổng ${results.length} | PASS ${count("PASS")} | KNOWN ${count("KNOWN")} | SKIP ${count("SKIP")} | FAIL ${count("FAIL")}`);
process.exit(count("FAIL") ? 1 : 0);
