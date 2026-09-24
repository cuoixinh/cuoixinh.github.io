// Kiểm thử hàm thuần (npm run check:units, thêm --verbose để in cả ca đạt). Mã
// ĐƯỢC KIỂM là mã thật: hàm/hằng cắt NGUYÊN VĂN từ file nguồn rồi chạy trong
// node:vm — file .ts bỏ kiểu bằng node:module.stripTypeScriptTypes (Node ≥ 22.13).
// ID ca khớp mục UNIT-xx của testcase_all.md. Ca gắn `known` là lỗi đã ghi nhận
// ở mục 9 của file đó: trượt thì in KNOWN, không làm script thoát mã 1.
import fs from "node:fs";
import vm from "node:vm";
import nodeCrypto from "node:crypto";
import * as nodeModule from "node:module";
import { fileURLToPath } from "node:url";

const R = fileURLToPath(new URL("..", import.meta.url));
const { stripTypeScriptTypes } = nodeModule;
if (typeof stripTypeScriptTypes !== "function") {
  console.error(`✗ check:units cần Node ≥ 22.13 (đang chạy ${process.version}) để đọc được file .ts`);
  process.exit(1);
}
const VERBOSE = process.argv.includes("--verbose");
const raw = (f) => fs.readFileSync(R + f, "utf8");
// File .ts bỏ kiểu NGUYÊN FILE trước khi cắt: kiểu trả về dạng `{ x: number }`
// cũng là ngoặc nhọn, cắt trên mã TS là nhận nhầm nó thành thân hàm.
const _stripped = new Map();
const src = (f) => {
  if (!f.endsWith(".ts")) return raw(f);
  if (!_stripped.has(f)) _stripped.set(f, ts(raw(f)));
  return _stripped.get(f);
};

// Cắt `function name(...) {...}` (kể cả `export`/`async`) theo cặp ngoặc nhọn.
function fn(file, name) {
  const s = src(file);
  const i = s.search(new RegExp(`(async )?function ${name}\\(`));
  if (i < 0) throw new Error(`${file}: không thấy function ${name}`);
  let d = 0;
  for (let k = s.indexOf("{", s.indexOf(")", i)); k < s.length; k++) {
    if (s[k] === "{") d++;
    else if (s[k] === "}" && --d === 0) return s.slice(i, k + 1);
  }
  throw new Error(`${file}: ${name} không đóng ngoặc`);
}
// Cắt `const NAME = …` tới hết câu lệnh (xuống dòng khi mọi ngoặc đã đóng).
function konst(file, name) {
  const s = src(file);
  const i = s.search(new RegExp(`const ${name} *=`));
  if (i < 0) throw new Error(`${file}: không thấy const ${name}`);
  let d = 0;
  for (let k = s.indexOf("=", i) + 1; k < s.length; k++) {
    const c = s[k];
    if ("([{".includes(c)) d++;
    else if (")]}".includes(c)) d--;
    else if (c === "\n" && d === 0) return s.slice(i, k);
  }
  return s.slice(i);
}
// Bỏ kiểu TypeScript; ExperimentalWarning của API này chỉ là nhiễu.
function ts(code) {
  const emit = process.emitWarning;
  process.emitWarning = () => {};
  try {
    return stripTypeScriptTypes(code);
  } finally {
    process.emitWarning = emit;
  }
}
// Chạy các đoạn mã trong một context mới, trả về context để lấy hàm ra dùng.
function load(parts, globals = {}) {
  const ctx = vm.createContext({ console, URL, TextEncoder, crypto: globalThis.crypto, ...globals });
  vm.runInContext(parts.join("\n"), ctx);
  return ctx;
}

// ---------------- Khung chạy ca ----------------
const results = [];
async function tc(id, title, body, opts = {}) {
  let r;
  try {
    r = await body();
  } catch (e) {
    r = { pass: false, got: "THROW " + (e.stack || e) };
  }
  results.push({ id, title, known: opts.known, ...r });
}
const J = JSON.stringify;
// Bảng đầu vào → kỳ vọng: gom mọi ca lệch vào `got` để in một lượt.
function table(f, rows) {
  const bad = rows
    .map(([input, want]) => {
      const got = f(input);
      return J(got) === J(want) ? null : `${J(input)} → ${J(got)} (cần ${J(want)})`;
    })
    .filter(Boolean);
  return { pass: bad.length === 0, got: bad.length ? bad.join("\n        ") : `${rows.length} đầu vào khớp` };
}

// ================= Nguồn =================
const WA = "supabase/functions/wedding-admin/index.ts";
const wa = load([
  (konst(WA, "ALLOWED_IMAGE_HOSTS")),
  (konst(WA, "STORAGE_NAME_RE")),
  (konst(WA, "MAX_TEXT")),
  (konst(WA, "SLUG_RE")),
  ...["isSafeImageRef", "cleanText", "cleanFocal", "cleanLoveStory", "cleanTimeline", "safeParse", "isValidSlug", "timingSafeEqual"]
    .map((n) => (fn(WA, n))),
]);

const bl = load([src("core/bl/wedding-bl.js"), "globalThis.__BL = new WeddingBL({}, {});"], { window: undefined });
const slug = (x) => {
  try {
    return bl.__BL.validateSlug(x);
  } catch {
    return "THROW";
  }
};

// ================= UNIT-01…05: slug =================
await tc("UNIT-01", "validateSlug bỏ dấu, gộp ký tự lạ thành '-'", () =>
  table(slug, [
    ["Hoàng Lan", "hoang-lan"],
    ["Đức & Ánh!!", "duc-anh"],
    ["--a--b--", "a-b"],
    ["NGUYỄN   Văn  An", "nguyen-van-an"],
    ["Minh-Thư 2026", "minh-thu-2026"],
  ]));

await tc("UNIT-02", "validateSlug cắt ≤ 50 ký tự, ưu tiên cắt tại gạch nối", () => {
  const many = "nguyen-van-an-va-tran-thi-binh-ngay-cuoi-hai-muoi-thang-muoi";
  const long = "a".repeat(60);
  const a = slug(many), b = slug(long);
  return {
    pass: a.length <= 50 && !a.endsWith("-") && many.startsWith(a) && many[a.length] === "-" && b === "a".repeat(50),
    got: `${J(a)} (${a.length}) · ${b.length} ký tự`,
  };
});

await tc("UNIT-03", "validateSlug luỹ đẳng", () => {
  const seeds = ["Hoàng Lan", "Đỗ Thị Ánh Tuyết & Lê Quốc Việt", "  x  ", "Ngày 20/10/2026 — Hà Nội", "ẤN ĐỘ đẹp 😍 quá"];
  const bad = [];
  for (let i = 0; i < 50; i++) {
    const x = seeds[i % seeds.length] + " " + "abcđêơư".slice(0, i % 7) + i;
    const once = slug(x), twice = slug(once);
    if (once !== twice) bad.push(`${J(x)}: ${once} ≠ ${twice}`);
  }
  return { pass: !bad.length, got: bad.length ? bad.join("; ") : "50 chuỗi đều luỹ đẳng" };
});

await tc("UNIT-04", "validateSlug ném lỗi với chuỗi không có ký tự hợp lệ", () =>
  table(slug, [["", "THROW"], ["!!!", "THROW"], ["   ", "THROW"], [null, "THROW"]]));

await tc("UNIT-05", "isValidSlug (server) đúng luật", () =>
  table(wa.isValidSlug, [
    ["a", true], ["an-binh", true], ["a1-b2", true], ["a".repeat(80), true],
    ["-a", false], ["a-", false], ["An", false], ["a_b", false], ["a b", false],
    ["a".repeat(81), false], ["", false], [123, false],
  ]));

await tc("UNIT-05b", "Slug client sinh ra luôn được server chấp nhận", () => {
  const bad = ["Hoàng Lan", "x".repeat(70), "Đức & Ánh!!", "a---b", "Ờ ờ 9"]
    .map((x) => [x, slug(x)]).filter(([, s]) => !wa.isValidSlug(s));
  return { pass: !bad.length, got: bad.length ? J(bad) : "mọi slug client đều hợp lệ ở server" };
});

// ================= UNIT-06/07: ảnh =================
const PROD_URL = "https://lcobawmkywtxhpezndsh.supabase.co/storage/v1/object/public/wedding-images/cover-abc.jpg";
await tc("UNIT-06", "isSafeImageRef nhận giá trị hợp lệ", () =>
  table(wa.isSafeImageRef, [
    [null, true], [undefined, true], ["", true], ["  ", true],
    ["cover_image_url-AbC123xyz.webp", true],
    [PROD_URL, true],
    ["https://gmtnoxdwoumbtdmqmisk.supabase.co/storage/v1/object/public/wedding-images/x.jpg", true],
    ["https://wedding-image-proxy.cuoixinh-api.workers.dev/x.jpg", true],
  ]));

await tc("UNIT-07", "isSafeImageRef chặn tráo ảnh / XSS", () =>
  table(wa.isSafeImageRef, [
    [PROD_URL.replace("https", "http"), false],
    ["https://evil.com/qr.png", false],
    ["//evil.com/a.png", false],
    ['a" onerror="alert(1)', false],
    ["../x.jpg", false],
    ["a/b.jpg", false],
    [PROD_URL + '?x="y', false],
    ["javascript:alert(1)", false],
    ["data:image/png;base64,AAAA", false],
    ["x".repeat(121), false],
    [123, false],
    [{ a: 1 }, false],
  ]));

// ================= UNIT-08/09: làm sạch JSONB =================
await tc("UNIT-08", "cleanLoveStory: cắt 10 mốc, bỏ khoá lạ, cắt chữ, lọc ảnh + điểm nét", () => {
  const raw = Array.from({ length: 12 }, (_, i) => ({ date: "d" + i, title: "t", content: "c", onload: "x" }));
  raw[0] = { date: "x".repeat(200), title: "t", content: "y".repeat(5000), image_url: 'a"b', focal_point: { x: 500, y: "abc" }, evil: 1 };
  raw[1].image_url = "ok-1.jpg";
  const out = wa.cleanLoveStory(raw);
  const first = out[0];
  const ok =
    out.length === 10 &&
    J(Object.keys(first).sort()) === J(["content", "date", "focal_point", "image_url", "title"]) &&
    first.date.length === 100 && first.content.length === 2000 &&
    first.image_url === null && J(first.focal_point) === J({ x: 100, y: 50 }) &&
    out[1].image_url === "ok-1.jpg" && !("onload" in out[2]);
  return { pass: ok, got: `len=${out.length} keys=${Object.keys(first)} date=${first.date.length} content=${first.content.length} img0=${first.image_url} fp0=${J(first.focal_point)} img1=${out[1].image_url}` };
});

await tc("UNIT-08b", "cleanLoveStory nhận chuỗi JSON, từ chối dữ liệu không phải mảng", () => {
  const a = wa.cleanLoveStory(J([{ title: "x" }]));
  const b = wa.cleanLoveStory("không phải json");
  const c = wa.cleanLoveStory({ a: 1 });
  return { pass: a?.length === 1 && a[0].title === "x" && b === null && c === null, got: `${J(a)} · ${J(b)} · ${J(c)}` };
});

await tc("UNIT-09", "cleanTimeline: type lạ → ceremony, cắt time, JSON hỏng → null", () => {
  const out = wa.cleanTimeline([
    { time: "08:00-09:00-10:00-11:00", title: "Lễ", type: "<script>" },
    { time: "18:00", title: "Tiệc", type: "party" },
    { time: "19:00", title: "Tiệc nhà gái", type: "bride-party", x: 1 },
  ]);
  const ok = out[0].type === "ceremony" && out[0].time.length === 20 && out[1].type === "party" &&
    out[2].type === "bride-party" && !("x" in out[2]) && wa.cleanTimeline("{hỏng") === null;
  return { pass: ok, got: J(out) };
});

// ================= UNIT-10: chữ ký PayOS =================
const PW = "supabase/functions/payos-webhook/index.ts";
const pw = load([(fn(PW, "timingSafeEqual")), (fn(PW, "payosValue")), (fn(PW, "verifyWebhookSignature"))]);
// Tự tính chữ ký theo tài liệu PayOS (KHÔNG dùng mã được kiểm): sắp khoá a→z,
// null/undefined → rỗng, nối key=value bằng '&', HMAC-SHA256 hex.
function payosSign(data, key) {
  const str = Object.keys(data).sort()
    .map((k) => `${k}=${data[k] === null || data[k] === undefined ? "" : data[k]}`).join("&");
  return nodeCrypto.createHmac("sha256", key).update(str).digest("hex");
}
const KEY = "checksum-key-test";
const DATA = {
  orderCode: 123456789012345, amount: 250000, description: "CX thanh toan", accountNumber: "0123456789",
  reference: "FT26092400001", transactionDateTime: "2026-09-24 10:00:00", currency: "VND",
  paymentLinkId: "abc123", code: "00", desc: "success", counterAccountBankId: null,
  counterAccountBankName: "", counterAccountName: null, counterAccountNumber: null,
  virtualAccountName: "", virtualAccountNumber: "",
};
await tc("UNIT-10", "verifyWebhookSignature khớp chữ ký chuẩn PayOS (có trường null)", async () => {
  const sig = payosSign(DATA, KEY);
  const ok = await pw.verifyWebhookSignature(DATA, sig, KEY);
  return { pass: ok === true, got: `verify=${ok}` };
});
await tc("UNIT-10b", "verifyWebhookSignature từ chối khi sửa số tiền / sai khoá / chữ ký rỗng", async () => {
  const sig = payosSign(DATA, KEY);
  const a = await pw.verifyWebhookSignature({ ...DATA, amount: 1000 }, sig, KEY);
  const b = await pw.verifyWebhookSignature(DATA, sig, "khoa-khac");
  const c = await pw.verifyWebhookSignature(DATA, "", KEY);
  const oldBug = nodeCrypto.createHmac("sha256", KEY)
    .update(Object.keys(DATA).sort().map((k) => `${k}=${DATA[k]}`).join("&")).digest("hex");
  const d = await pw.verifyWebhookSignature(DATA, oldBug, KEY);
  return { pass: !a && !b && !c && !d, got: `sửa tiền=${a} sai khoá=${b} rỗng=${c} kiểu-cũ-'null'=${d}` };
});

// ================= UNIT-11: mã đơn =================
const PH = "supabase/functions/payment-handler/index.ts";
const ph = load([(fn(PH, "newOrderCode"))]);
await tc("UNIT-11", "newOrderCode: ≤ 14 chữ số, số nguyên an toàn, phần ngẫu nhiên tách được hai đơn cùng mili-giây", () => {
  let bad = "";
  const codes = Array.from({ length: 1000 }, () => ph.newOrderCode());
  for (const c of codes) {
    if (!Number.isSafeInteger(c) || c <= 0 || String(c).length > 14) bad ||= `mã lỗi ${c}`;
  }
  // 1000 lần gọi dồn trong vài mili-giây: phần ngẫu nhiên có 100.000 giá trị nên
  // kỳ vọng trùng ~ vài mã; thực tế hai đơn hiếm khi cùng mili-giây.
  const distinct = new Set(codes).size;
  return { pass: !bad && distinct >= 990, got: bad || `${distinct}/1000 mã khác nhau khi gọi dồn` };
});

// ================= UNIT-12/13: hạn mức AI =================
const RL = "supabase/functions/_shared/ai-rate-limit.ts";
const rl = load([(fn(RL, "clientIp")), (fn(RL, "sanitizeDevice"))]);
const req = (h) => ({ headers: new Headers(h) });
await tc("UNIT-12", "clientIp ưu tiên cf-connecting-ip, rồi phần tử CUỐI của x-forwarded-for", () =>
  table((h) => rl.clientIp(req(h)), [
    [{ "cf-connecting-ip": "9.9.9.9", "x-forwarded-for": "1.1.1.1" }, "9.9.9.9"],
    [{ "x-forwarded-for": "1.1.1.1, 2.2.2.2" }, "2.2.2.2"],
    [{ "x-forwarded-for": "gia-mao, 3.3.3.3 " }, "3.3.3.3"],
    [{ "x-real-ip": "4.4.4.4" }, "4.4.4.4"],
    [{}, "unknown"],
  ]));
await tc("UNIT-13", "sanitizeDevice chỉ nhận 8–64 ký tự [a-z0-9-]", () =>
  table(rl.sanitizeDevice, [
    ["ABC-12345678", "abc-12345678"], ["  abcdefgh  ", "abcdefgh"],
    ["abc", ""], ["a".repeat(65), ""], ["abcd efgh", ""], ["abcdefgh;drop", ""], [null, ""], [123456789, ""],
  ]));

// ================= UNIT-14: trạng thái thẻ ở Quản lý thiệp =================
const MY = "my-invitations/index.js";
const my = load([konst(MY, "DAY_MS"), fn(MY, "cardState"), fn(MY, "daysLeft")], { CONFIG: { trialDays: 3 } });
await tc("UNIT-14", "cardState / daysLeft", () => {
  const h = (n) => new Date(Date.now() + n * 3600e3).toISOString();
  const rows = [
    [{ published: false }, "draft"],
    [{ published: true }, "published"],
    [{ published: true, expiresAt: null }, "active"],
    [{ published: true, expiresAt: h(5) }, "trial"],
    [{ published: true, expiresAt: h(-1) }, "expired"],
  ];
  const t = table(my.cardState, rows);
  const d5h = my.daysLeft({ expiresAt: h(5) });
  const dSkew = my.daysLeft({ expiresAt: h(24 * 4 + 1) }); // đồng hồ máy khách chậm
  const ok = t.pass && d5h === 1 && dSkew === 3 && my.daysLeft({ expiresAt: null }) === 0;
  return { pass: ok, got: `${t.got} · còn 5 giờ=${d5h} ngày · lệch đồng hồ=${dSkew} ngày` };
});

// ================= UNIT-15: độ đậm bộ màu =================
const TSH = "core/helpers/theme-setting-helper.js";
const helper = src(TSH);
const KEYS = [...helper.match(/const CX_PALETTE_TOKENS = \{([\s\S]*?)\n\};/)[1].matchAll(/(\w+):\s*"--/g)].map((m) => m[1]);
const math = helper.slice(helper.indexOf("const CX_STRENGTH_K = {"), helper.indexOf("// [/strength-math]"));
const pal = load([`const CX_PALETTE_KEYS = ${J(KEYS)};`, math]);
const PSRC = src("core/helpers/card-palette-helper.js");
const PALETTES = new Function(PSRC.slice(PSRC.indexOf("const CX_PALETTES = ["), PSRC.indexOf("\n];", PSRC.indexOf("const CX_PALETTES = [")) + 3) + " return CX_PALETTES;")();
await tc("UNIT-15", "cxPaletteAtStrength: mức 50 trả NGUYÊN object, mọi mức ra hex hợp lệ", () => {
  const bad = [];
  for (const p of PALETTES) {
    const colors = p.colors || p;
    if (pal.cxPaletteAtStrength(colors, 50) !== colors) bad.push(`${p.id}: mức 50 không trả nguyên object`);
    for (let s = 0; s <= 100; s += 5) {
      const out = pal.cxPaletteAtStrength(colors, s);
      for (const [k, v] of Object.entries(out || {})) {
        if (typeof v === "string" && v.startsWith("#") && !/^#[0-9a-f]{6}$/i.test(v)) bad.push(`${p.id}@${s}.${k}=${v}`);
      }
    }
  }
  return { pass: !bad.length, got: bad.length ? bad.slice(0, 5).join("; ") : `${PALETTES.length} bộ × 21 mức đều hợp lệ` };
});

// ================= UNIT-16: âm lịch =================
const LN = "invitation-setup/js/09-lunar.js";
const lunarSrc = src(LN);
const lunar = load([lunarSrc.slice(lunarSrc.indexOf("function jdFromDate"))]);
const L = (d, m, y) => {
  const r = lunar.convertSolar2Lunar(d, m, y, 7);
  return `${r.day}/${r.month}${r.leap ? "n" : ""}/${r.year}`;
};
await tc("UNIT-16", "convertSolar2Lunar khớp lịch vạn niên (Tết, Trung thu, tháng nhuận)", () =>
  table(([d, m, y]) => L(d, m, y), [
    [[22, 1, 2023], "1/1/2023"],   // Tết Quý Mão
    [[21, 1, 2023], "30/12/2022"], // Giao thừa
    [[22, 3, 2023], "1/2n/2023"],  // 1 tháng 2 nhuận Quý Mão
    [[20, 4, 2023], "1/3/2023"],
    [[10, 2, 2024], "1/1/2024"],   // Tết Giáp Thìn
    [[17, 9, 2024], "15/8/2024"],  // Trung thu 2024
    [[29, 1, 2025], "1/1/2025"],   // Tết Ất Tỵ
    [[25, 7, 2025], "1/6n/2025"],  // 1 tháng 6 nhuận Ất Tỵ
    [[17, 2, 2026], "1/1/2026"],   // Tết Bính Ngọ
    [[23, 5, 2020], "1/4n/2020"],  // 1 tháng 4 nhuận Canh Tý
  ]));
await tc("UNIT-16b", "getCanChi", () =>
  table(lunar.getCanChi, [[2024, "Giáp Thìn"], [2025, "Ất Tỵ"], [2026, "Bính Ngọ"], [2020, "Canh Tý"], [2023, "Quý Mão"]]));
await tc("UNIT-16c", "formatLunarDate ghi rõ 'nhuận' cho ngày thuộc tháng nhuận", () => {
  const s = lunar.formatLunarDate("2025-07-25");
  return { pass: /nhuận/.test(s), got: J(s) };
}, { known: "NV-11" });
await tc("UNIT-16d", "formatLunarDate đúng ngày khi máy khách ở múi giờ âm (Việt kiều ở Mỹ)", () => {
  const old = process.env.TZ;
  process.env.TZ = "America/Los_Angeles";
  try {
    const s = lunar.formatLunarDate("2024-02-10");
    return { pass: s.startsWith("1 tháng 1 "), got: J(s) + " (cần 1 tháng 1 năm Giáp Thìn)" };
  } finally {
    process.env.TZ = old ?? "";
    if (old === undefined) delete process.env.TZ;
  }
}, { known: "NV-12" });

// ================= UNIT-17: đuôi file =================
const ib = load([src("core/bl/image-bl.js")], { window: undefined });
const ImageBL = vm.runInContext("ImageBL", ib);
await tc("UNIT-17", "safeExt: đuôi theo MIME, tên file không ghi đè được MIME đã biết", () =>
  table((f) => ImageBL.safeExt(f), [
    [{ type: "image/webp", name: "a.php" }, "webp"],
    [{ type: "image/jpeg", name: "x.html" }, "jpg"],
    [{ type: "image/png", name: "noext" }, "png"],
    [{ type: "", name: "anh.HEIC" }, "heic"],     // MIME lạ: lấy đuôi tên (đã bị UNIT-28 chặn trước đó)
    [{ type: "", name: "x.a<b" }, "jpg"],
    [{ type: "", name: "x.toolongext" }, "jpg"],
    [null, "jpg"],
  ]));

// ================= UNIT-18: escape / src / focal =================
const ut = load([fn("core/utils.js", "escapeHtml"), fn("core/utils.js", "getImageUrl"), fn("core/utils.js", "cxImgSrc"),
  fn("core/utils.js", "cxFocal"), fn("core/utils.js", "createPlaceholderSVG"), fn("core/utils.js", "cxUUID"),
  konst("core/utils.js", "_LOCAL_ONLY_IMAGE_RE"), fn("core/utils.js", "_dropLocalOnlyImageRefs")],
  { STORAGE_BASE_URL: "https://s.example/wedding-images" });
await tc("UNIT-18", "escapeHtml / cxImgSrc / cxFocal chặn chèn HTML, scheme lạ, CSS", () => {
  const e = ut.escapeHtml(`<script>"'&`);
  const s1 = ut.cxImgSrc('x" onerror="alert(1)');
  const s2 = ut.cxImgSrc("javascript:alert(1)"); // tên file thường → bị gắn tiền tố kho ảnh, vô hại
  const s3 = ut.cxImgSrc("data:text/html,<b>");
  const f = ut.cxFocal({ x: "50;background:url(x)", y: -9 });
  const ok = e === "&lt;script&gt;&quot;&#39;&amp;" && !s1.includes('"') && s2.startsWith("https://s.example/") &&
    ut.cxImgSrc("JavaScript:alert(1)//http").startsWith("https://s.example/") &&
    s3.startsWith("data:image/svg") && f === "50% 0%" && ut.escapeHtml(null) === "";
  return { pass: ok, got: `${e} · ${s1.slice(0, 50)} · js→${s2.slice(0, 14)} · data:text→${s3.slice(0, 14)} · ${f}` };
});
await tc("UNIT-18b", "_dropLocalOnlyImageRefs gỡ blob:/data: trước khi lưu, giữ dạng chuỗi/mảng", () => {
  const p = {
    cover_image_url: "blob:https://x/1", groom_image_url: "ok.jpg",
    gallery_images: ["a.jpg", "data:image/png;base64,AA"],
    love_story: J([{ image_url: "blob:x" }, { image_url: "b.jpg" }]),
    timeline: [{ image_url: "data:image/png;base64,AA" }],
  };
  ut.console = { warn() {} };
  vm.runInContext("console = { warn() {}, log() {} }", ut);
  ut._dropLocalOnlyImageRefs(p);
  const ls = JSON.parse(p.love_story);
  const ok = p.cover_image_url === null && p.groom_image_url === "ok.jpg" && J(p.gallery_images) === J(["a.jpg"]) &&
    ls[0].image_url === null && ls[1].image_url === "b.jpg" && Array.isArray(p.timeline) && p.timeline[0].image_url === null;
  return { pass: ok, got: J(p) };
});

// ================= UNIT-19: ảnh của một thiệp =================
const WI = "supabase/functions/_shared/wedding-images.ts";
const wi = load([src(WI).replace(/^export /gm, "")]);
await tc("UNIT-19", "weddingImageRefs / weddingFileNames gom đủ ảnh, bỏ URL ngoài, khử trùng", () => {
  const w = {
    cover_image_url: "c.jpg", groom_image_url: "https://x.com/g.jpg", bride_image_url: "",
    groom_qr_url: "q.jpg", bride_qr_url: null, gallery_images: ["g1.jpg", "c.jpg"],
    love_story: J([{ image_url: "l1.jpg" }, { image_url: null }, null]),
  };
  const refs = wi.weddingImageRefs(w), names = wi.weddingFileNames(w);
  const ok = J(refs) === J(["c.jpg", "https://x.com/g.jpg", "q.jpg", "g1.jpg", "c.jpg", "l1.jpg"]) &&
    J(names) === J(["c.jpg", "q.jpg", "g1.jpg", "l1.jpg"]) &&
    J(wi.weddingImageRefs({ love_story: "{hỏng" })) === "[]";
  return { pass: ok, got: `refs=${J(refs)} names=${J(names)}` };
});

// ================= UNIT-20: mã màu cứng trong theme.css =================
await tc("UNIT-20", "theme.css không có mã màu cứng ngoài :root (trừ mask-image, --cx-qr-bg-rgb)", () => {
  const bad = [];
  for (const t of fs.readdirSync(R + "public/themes")) {
    const f = `public/themes/${t}/theme.css`;
    if (!fs.existsSync(R + f)) continue;
    const css = src(f).replace(/\/\*[\s\S]*?\*\//g, "").replace(/:root\s*\{[\s\S]*?\}/g, "");
    // Xét theo TỪNG KHAI BÁO (giá trị gradient hay trải nhiều dòng).
    for (const [, prop, val] of css.matchAll(/([-\w]+)\s*:\s*([^;{}]+);/g)) {
      if (/mask/.test(prop) || prop === "--cx-qr-bg-rgb") continue;
      if (/#[0-9a-f]{3,8}\b|rgba?\(\s*\d/i.test(val)) bad.push(`${t}: ${prop}: ${val.trim().replace(/\s+/g, " ").slice(0, 50)}`);
    }
  }
  return { pass: !bad.length, got: bad.length ? bad.join(" | ") : "không có" };
}, { known: "NV-13" });

// ================= UNIT-21: YouTube =================
const yt = load([fn("core/helpers/youtube-helper.js", "extractYouTubeVideoId")]);
await tc("UNIT-21", "extractYouTubeVideoId", () =>
  table(yt.extractYouTubeVideoId, [
    ["https://www.youtube.com/watch?v=06-XXOTP3Gc&list=RD06", "06-XXOTP3Gc"],
    ["https://youtu.be/06-XXOTP3Gc?t=3", "06-XXOTP3Gc"],
    ["https://www.youtube.com/embed/06-XXOTP3Gc", "06-XXOTP3Gc"],
    ["https://www.youtube.com/v/06-XXOTP3Gc", "06-XXOTP3Gc"],
    ["https://vimeo.com/123", null],
  ]));

// ================= UNIT-22: mã hoá link khách =================
// CryptoJS nạp từ CDN nên ở đây dùng bản TƯƠNG THÍCH định dạng OpenSSL "Salted__"
// (EVP_BytesToKey-MD5 + AES-256-CBC) — kiểm phần bọc URL/Unicode/rỗng của hai hàm.
function evpKey(pass, salt) {
  let d = Buffer.alloc(0), prev = Buffer.alloc(0);
  while (d.length < 48) {
    prev = nodeCrypto.createHash("md5").update(Buffer.concat([prev, Buffer.from(pass), salt])).digest();
    d = Buffer.concat([d, prev]);
  }
  return { key: d.subarray(0, 32), iv: d.subarray(32, 48) };
}
const CryptoJS = {
  AES: {
    encrypt(text, pass) {
      const salt = nodeCrypto.randomBytes(8), { key, iv } = evpKey(pass, salt);
      const c = nodeCrypto.createCipheriv("aes-256-cbc", key, iv);
      const out = Buffer.concat([Buffer.from("Salted__"), salt, c.update(text, "utf8"), c.final()]);
      return { toString: () => out.toString("base64") };
    },
    decrypt(b64, pass) {
      const buf = Buffer.from(b64, "base64");
      if (buf.subarray(0, 8).toString() !== "Salted__") throw new Error("bad");
      const { key, iv } = evpKey(pass, buf.subarray(8, 16));
      const d = nodeCrypto.createDecipheriv("aes-256-cbc", key, iv);
      const out = Buffer.concat([d.update(buf.subarray(16)), d.final()]);
      return { toString: () => out.toString("utf8") };
    },
  },
  enc: { Utf8: "utf8" },
};
const enc = load([fn("invitation-setup/js/06-draft-save.js", "encryptData"), fn("invitation-setup/js/06-draft-save.js", "decryptData")],
  { CryptoJS, ENCRYPTION_KEY: "test-key", console: { error() {}, log() {} } });
await tc("UNIT-22", "encryptData → decryptData ra đúng chuỗi gốc; đầu vào rác không làm vỡ trang", () => {
  const samples = ["Nguyễn Văn Ánh", "Cô Ba & chồng", "a=b?c#d", "😍 Bạn thân", " "];
  const bad = samples.filter((x) => enc.decryptData(enc.encryptData(x)) !== x);
  const junk = enc.decryptData("%%%khong-hop-le");
  const ok = !bad.length && enc.encryptData("") === "" && enc.decryptData("") === "" && junk === "" &&
    samples.every((x) => !/[+/=]/.test(enc.encryptData(x)));
  return { pass: ok, got: `lệch=${J(bad)} rác=${J(junk)}` };
});

// ================= UNIT-23: AI viết lại chuyện tình giữ ảnh =================
await tc("UNIT-23", "applyLoveStoryText giữ ảnh theo vị trí, bỏ mốc trống không ảnh", () => {
  const ctx = load([
    "let _loveStoryItems = []; let _loveStoryPendingImages = {}; let _loveStoryKeyExists = false;",
    "function _syncLoveStoryHidden(){} function renderLoveStoryList(){} function _idbSaveLoveStoryImages(){}",
    konst("invitation-setup/js/14-timeline-story.js", "MAX_LOVE_STORY_ITEMS"),
    fn("invitation-setup/js/14-timeline-story.js", "applyLoveStoryText"),
    "globalThis.__get = () => ({ items: _loveStoryItems, pending: _loveStoryPendingImages });",
  ], { CONFIG: { maxLoveStoryItems: 10 } });
  vm.runInContext(`
    _loveStoryItems.push({title:"m1"}, {title:"m2", image_url:"a.jpg", focal_point:{x:1,y:2}}, {title:"m3"}, {title:"m4", image_url:"b.jpg"});
    _loveStoryPendingImages[2] = "FILE3";`, ctx);
  ctx.applyLoveStoryText([{ title: "AI1", content: "x" }, { title: "AI2" }]);
  const { items, pending } = ctx.__get();
  const got = items.map((i) => `${i.title || "∅"}:${i.image_url || "-"}`).join(" ");
  const ok = got === "AI1:- AI2:a.jpg ∅:- ∅:b.jpg" && J(items[1].focal_point) === J({ x: 1, y: 2 }) && pending[2] === "FILE3";
  return { pass: ok, got: `${got} · chờ upload=${J(pending)}` };
});

// ================= UNIT-24: dữ liệu mẫu không chép thông tin cá nhân =================
await tc("UNIT-24", "_isBlankWedding + _fetchDemoFill: chỉ chép danh sách trắng", async () => {
  const DS = "invitation-setup/js/13-data.js";
  const demo = {
    content: {
      groom_name: "Demo", bride_father: "Ông A", groom_address: "HN", ceremony_date: "2026-01-01",
      ceremony_location: "X", groom_bank_number: "123", cover_image_url: "c.jpg", gallery_images: ["g.jpg"],
      story_quote: "Câu mở", footer_text: "Cảm ơn", rsvp_message: "Hãy đến", enable_gift: true,
      timeline: [{ time: "08:00", title: "Đón dâu", type: "ceremony", secret: "x" }],
    },
    love_story: [{ title: "chuyện demo", image_url: "l.jpg" }],
  };
  const fetch = async () => ({ ok: true, json: async () => demo });
  const ctx = load([konst(DS, "DEMO_FILL_FIELDS"), konst(DS, "_BLANK_IGNORE"), fn(DS, "_isBlankWedding"), fn(DS, "_fetchDemoFill")],
    { fetch, AbortController, setTimeout, clearTimeout });
  const fill = await ctx._fetchDemoFill("basic-gold");
  const PERSONAL = ["groom_name", "bride_father", "groom_address", "ceremony_date", "ceremony_location", "groom_bank_number", "cover_image_url", "gallery_images", "love_story"];
  const leaked = PERSONAL.filter((k) => fill && k in fill);
  const blank = [
    [{ id: "x", theme: "t", enable_gift: "true", rsvp_enabled: false, gallery_images: [] }, true],
    [{ id: "x", groom_name: "An" }, false],
    [{ id: "x", timeline: [{ time: "1" }] }, false],
  ].filter(([d, want]) => ctx._isBlankWedding(d) !== want);
  const ok = !leaked.length && fill.story_quote === "Câu mở" && J(Object.keys(fill.timeline[0]).sort()) === J(["time", "title", "type"]) && !blank.length;
  return { pass: ok, got: `lọt=${J(leaked)} khoá chép=${J(Object.keys(fill || {}))} blank-lệch=${J(blank)}` };
});

// ================= UNIT-25: giá trị chỉnh giao diện =================
const safe = load(["_cxSafeSelector", "_cxSafeFont", "_cxSafeColor", "_cxSafeNum"].map((n) => fn(TSH, n)));
await tc("UNIT-25", "_cxSafe* không cho thoát khỏi rule CSS / chuỗi font", () => {
  const sel = [
    ["#section-gift > p:nth-child(2)", "#section-gift > p:nth-child(2)"],
    ["p}</style><script>", ""], ["a{color:red}", ""], ["x".repeat(401), ""], [42, ""],
  ].filter(([i, w]) => safe._cxSafeSelector(i) !== w);
  const font = safe._cxSafeFont(`Arial'; } body { x:"y" <`);
  const col = [["#fff", true], ["rgba(0, 0, 0, .5)", true], ["red;background:url(x)", false], ["url(x)", false], ["#12345678", true]]
    .filter(([i, w]) => safe._cxSafeColor(i) !== w);
  const num = [[16, true], ["12", true], [0, false], [1000, false], ["NaN", false], [-1, false]].filter(([i, w]) => safe._cxSafeNum(i) !== w);
  const ok = !sel.length && !/['"\\<>{}]/.test(font) && !col.length && !num.length;
  return { pass: ok, got: `selector lệch=${J(sel)} font=${J(font)} màu lệch=${J(col)} số lệch=${J(num)}` };
});

// ================= UNIT-26/27: đã có trong check:draft-sync =================
await tc("UNIT-26/27", "nav-cart-count + draft-retention", () =>
  ({ pass: true, got: "chạy nguyên văn trong npm run check:draft-sync (nhóm A: ô đếm; nhóm F: hạn giữ nháp)" }));

// ================= UNIT-28: định dạng ảnh =================
const ih = load([src("core/helpers/image-helper.js")], {
  window: {}, CONFIG: { image: { allowedTypes: ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif", "image/avif"], customer: {} } },
  document: {}, Image: function () {}, URL,
});
await tc("UNIT-28", "Whitelist định dạng ảnh của khách (CONFIG.image.allowedTypes)", () => {
  const H = ih.window.ImageHelper;
  return table((type) => H.isAllowedType({ type }), [
    ["image/jpeg", true], ["image/png", true], ["image/webp", true], ["image/gif", true], ["image/avif", true],
    ["image/svg+xml", false], ["image/heic", false], ["application/pdf", false], ["", false], ["text/html", false],
  ]);
});

// ================= UNIT-30: UUID =================
await tc("UNIT-30", "cxUUID: đúng dạng v4, không trùng", () => {
  const re = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  const ids = Array.from({ length: 2000 }, () => ut.cxUUID());
  const noRandomUUID = load([fn("core/utils.js", "cxUUID")], { crypto: { getRandomValues: (a) => nodeCrypto.getRandomValues(a) } });
  const fb = noRandomUUID.cxUUID();
  return { pass: ids.every((x) => re.test(x)) && new Set(ids).size === 2000 && re.test(fb), got: `mẫu=${ids[0]} · nhánh getRandomValues=${fb}` };
});

// ================= UNIT-31: so token quản trị =================
await tc("UNIT-31", "timingSafeEqual của 3 function dùng mã quản trị từ chối chuỗi rỗng", () => {
  const bad = [];
  for (const f of ["wedding-admin", "guest-handler", "cleanup-weddings"]) {
    const c = load([(fn(`supabase/functions/${f}/index.ts`, "timingSafeEqual"))]);
    if (c.timingSafeEqual("", "") !== false) bad.push(`${f}: '' = '' được chấp nhận`);
    if (c.timingSafeEqual("abc", "abc") !== true || c.timingSafeEqual("abc", "abd") !== false) bad.push(`${f}: so sai`);
  }
  return { pass: !bad.length, got: bad.length ? bad.join("; ") : "cả 3 đều đúng" };
});

// ---------------- In kết quả ----------------
let fail = 0, known = 0;
for (const r of results) {
  const status = r.pass ? "PASS " : r.known ? "KNOWN" : "FAIL ";
  if (!r.pass && r.known) known++;
  else if (!r.pass) fail++;
  if (!r.pass || VERBOSE) {
    console.log(`${status} ${r.id}. ${r.title}${r.known && !r.pass ? `  [${r.known}]` : ""}`);
    if (!r.pass || VERBOSE) console.log(`        ${r.got}`);
  }
}
console.log(`\nTổng ${results.length} | PASS ${results.length - fail - known} | KNOWN ${known} | FAIL ${fail}`);
process.exit(fail ? 1 : 0);
