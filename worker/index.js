/**
 * Worker của site chính (Workers Assets) — CHỈ làm một việc: trả thẻ preview
 * (og:*) cho link thiệp `/<slug>` để Messenger/Zalo/Facebook hiện được ảnh bìa
 * và tên khách. Crawler KHÔNG chạy JS nên trang thiệp không tự khai meta được.
 *
 * Path khớp file tĩnh không vào đây (asset router phục vụ trước); chỉ path lạ
 * mới rơi tới — đúng chỗ 404.html đang lo chuyển hướng, nên <script> trong trang
 * trả về là BẢN SAO của 404.html: người thật vẫn đi y hệt đường cũ.
 *
 * Không truy vấn DB: dữ liệu lấy qua Edge Function wedding-admin (?slug=).
 * Biến khai ở [vars] của wrangler.jsonc / wrangler.staging.jsonc.
 */

const DEFAULT_DESC =
  "Trân trọng kính mời Quý Khách đến dự và chung vui cùng gia đình chúng tôi.";

// Path có route riêng trong router.html — không phải slug thiệp.
const ROUTE_PATHS = new Set(["manage", "account", "customer"]);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Chỉ dựng thẻ cho GET/HEAD của một clean URL: đúng một đoạn, không dấu chấm.
    const seg = url.pathname.replace(/^\/+|\/+$/g, "");
    const isSlugPath =
      (request.method === "GET" || request.method === "HEAD") &&
      seg &&
      !seg.includes("/") &&
      !seg.includes(".") &&
      !ROUTE_PATHS.has(seg);

    if (!isSlugPath) return env.ASSETS.fetch(request);

    // Hỏi asset router TRƯỚC: `/invitation-setup/`, `/checkout/`… cũng là một
    // đoạn không dấu chấm. Bình thường chúng không rơi tới worker (asset khớp
    // thì Cloudflare phục vụ thẳng), nhưng đừng sống nhờ thứ tự đó — trả nhầm
    // trang thiệp cho `/my-invitations/` là hỏng hẳn một trang.
    const asset = await env.ASSETS.fetch(request);
    if (asset.status !== 404) return asset;

    const wedding = await fetchWedding(env, seg);
    // Không tra được (slug sai, thiệp nháp, Edge Function lỗi) → giữ nguyên hành
    // vi cũ: 404 kèm trang chuyển hướng, không bịa thẻ preview.
    const guest = wedding ? await decryptGuestName(env, url) : "";

    return new Response(page(env, wedding, guest, url), {
      status: wedding ? 200 : 404,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        // Mỗi khách một URL riêng nên cache được; 5 phút đủ để crawler hỏi lại
        // vài lượt mà không đánh thẳng vào Edge Function.
        "Cache-Control": wedding ? "public, max-age=300" : "no-store",
      },
    });
  },
};

/* ─────────────────────────────── dữ liệu ─────────────────────────────── */

async function fetchWedding(env, slug) {
  try {
    const r = await fetch(`${env.EDGE_URL}?slug=${encodeURIComponent(slug)}`, {
      headers: { Authorization: `Bearer ${env.ANON_KEY}` },
    });
    const data = await r.json().catch(() => null);
    if (!data) return null;
    // Hết hạn dùng thử vẫn trả kèm tên cô dâu chú rể — đủ dựng thẻ, và link vẫn
    // mở được (màn khoá nằm trong trang thiệp).
    if (!r.ok && data.code !== "TRIAL_EXPIRED") return null;
    if (data.is_published === false) return null;
    return data;
  } catch (_) {
    return null;
  }
}

function imageUrl(env, filename) {
  if (!filename) return "";
  if (/^https?:\/\//i.test(filename)) return filename;
  if (/^(blob:|data:)/i.test(filename)) return "";
  return `${env.STORAGE_URL}/${String(filename).replace(/^\/+/, "")}`;
}

/* ─────────────────────────────── nội dung thẻ ─────────────────────────── */

function couple(w) {
  return [w?.groom_name, w?.bride_name]
    .filter(Boolean)
    .map((s) => String(s).trim().toUpperCase())
    .join(" & ");
}

function ogTitle(w, guest) {
  const pair = couple(w);
  const head = guest ? `Kính mời ${guest} cùng gia đình` : "Thiệp mời cưới";
  return pair ? `${head} | ${pair}` : head;
}

/** Mô tả = "Câu mẫu chia sẻ" của chủ thiệp, bỏ biến ##link## và URL trần. */
function ogDesc(w, guest) {
  const tpl = String(w?.share_message_template || "").trim();
  if (!tpl) return DEFAULT_DESC;
  const text = tpl
    .replace(/##\s*danh\s*x[ưu]ng\s*##/giu, guest || "Quý Khách")
    .replace(/##\s*link\s*##/gi, "")
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  return text || DEFAULT_DESC;
}

/* ─────────────────────────── giải mã tên khách ────────────────────────── */
// Link khách mời mang `name=` mã hoá bằng CryptoJS.AES (định dạng OpenSSL:
// "Salted__" + salt + ciphertext, khoá dẫn xuất bằng EVP_BytesToKey/MD5).
// KHÔNG phải bảo mật — khoá nằm sẵn trong bundle client; ở đây chỉ để lấy đúng
// chữ hiển thị trên thẻ.

async function decryptGuestName(env, url) {
  const raw = url.searchParams.get("name");
  if (!raw || !env.ENCRYPTION_KEY) return "";
  try {
    const blob = base64ToBytes(decodeURIComponent(raw));
    // 8 byte "Salted__" + 8 byte salt + ít nhất một khối 16 byte
    if (blob.length < 32) return "";
    const salt = blob.slice(8, 16);
    const body = blob.slice(16);
    const { key, iv } = evpBytesToKey(env.ENCRYPTION_KEY, salt);
    const ck = await crypto.subtle.importKey("raw", key, "AES-CBC", false, [
      "decrypt",
    ]);
    const out = await crypto.subtle.decrypt({ name: "AES-CBC", iv }, ck, body);
    return new TextDecoder().decode(out).trim().slice(0, 80);
  } catch (_) {
    return "";
  }
}

function base64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** OpenSSL EVP_BytesToKey (MD5, 1 vòng) → 32 byte key + 16 byte IV. */
function evpBytesToKey(passphrase, salt) {
  const pass = new TextEncoder().encode(passphrase);
  const bytes = [];
  let prev = new Uint8Array(0);
  while (bytes.length < 48) {
    const input = new Uint8Array(prev.length + pass.length + salt.length);
    input.set(prev, 0);
    input.set(pass, prev.length);
    input.set(salt, prev.length + pass.length);
    prev = md5(input);
    bytes.push(...prev);
  }
  return {
    key: new Uint8Array(bytes.slice(0, 32)),
    iv: new Uint8Array(bytes.slice(32, 48)),
  };
}

/** MD5 — WebCrypto không có, mà định dạng của CryptoJS thì cần. */
function md5(input) {
  const S = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5,
    9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11,
    16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10,
    15, 21,
  ];
  const K = [];
  for (let i = 0; i < 64; i++)
    K[i] = (Math.abs(Math.sin(i + 1)) * 4294967296) | 0;

  const len = input.length;
  const buf = new Uint8Array((((len + 8) >> 6) + 1) * 64);
  buf.set(input);
  buf[len] = 0x80;
  const view = new DataView(buf.buffer);
  view.setUint32(buf.length - 8, (len << 3) >>> 0, true);
  view.setUint32(buf.length - 4, Math.floor(len / 536870912), true);

  let a0 = 0x67452301,
    b0 = 0xefcdab89,
    c0 = 0x98badcfe,
    d0 = 0x10325476;
  const rotl = (x, c) => (x << c) | (x >>> (32 - c));

  for (let off = 0; off < buf.length; off += 64) {
    const M = [];
    for (let i = 0; i < 16; i++) M[i] = view.getUint32(off + i * 4, true);
    let A = a0,
      B = b0,
      C = c0,
      D = d0;
    for (let i = 0; i < 64; i++) {
      let F, g;
      if (i < 16) {
        F = (B & C) | (~B & D);
        g = i;
      } else if (i < 32) {
        F = (D & B) | (~D & C);
        g = (5 * i + 1) % 16;
      } else if (i < 48) {
        F = B ^ C ^ D;
        g = (3 * i + 5) % 16;
      } else {
        F = C ^ (B | ~D);
        g = (7 * i) % 16;
      }
      F = (F + A + K[i] + M[g]) | 0;
      A = D;
      D = C;
      C = B;
      B = (B + rotl(F, S[i])) | 0;
    }
    a0 = (a0 + A) | 0;
    b0 = (b0 + B) | 0;
    c0 = (c0 + C) | 0;
    d0 = (d0 + D) | 0;
  }

  const out = new Uint8Array(16);
  const ov = new DataView(out.buffer);
  ov.setUint32(0, a0 >>> 0, true);
  ov.setUint32(4, b0 >>> 0, true);
  ov.setUint32(8, c0 >>> 0, true);
  ov.setUint32(12, d0 >>> 0, true);
  return out;
}

/* ─────────────────────────────── trang trả về ─────────────────────────── */

const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function page(env, w, guest, url) {
  const title = w ? ogTitle(w, guest) : "Cưới Xinh";
  const desc = w ? ogDesc(w, guest) : "";
  const img = w ? imageUrl(env, w.cover_image_url) : "";

  const imgMeta = img
    ? `
    <meta property="og:image" content="${esc(img)}" />
    <meta property="og:image:alt" content="${esc(title)}" />
    <meta name="twitter:image" content="${esc(img)}" />`
    : "";

  const meta = w
    ? `
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Cưới Xinh" />
    <meta property="og:locale" content="vi_VN" />
    <meta property="og:url" content="${esc(url.href)}" />
    <meta property="og:title" content="${esc(title)}" />
    <meta property="og:description" content="${esc(desc)}" />
    <meta name="description" content="${esc(desc)}" />
    <meta name="twitter:card" content="${img ? "summary_large_image" : "summary"}" />
    <meta name="twitter:title" content="${esc(title)}" />
    <meta name="twitter:description" content="${esc(desc)}" />${imgMeta}
    <meta name="robots" content="noindex" />`
    : "";

  // <script> dưới đây PHẢI khớp 404.html: đó là đường chuyển hướng thật của mọi
  // link thiệp, sửa một bên mà quên bên kia là hai lối vào chạy khác nhau.
  return `<!doctype html>
<html lang="vi">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${esc(title)}</title>${meta}
    <script>
      const path = window.location.pathname;
      if (path && path !== "/" && !path.includes(".")) {
        const slug = path.split("/").filter((p) => p).pop();
        sessionStorage.setItem("redirect", path);
        sessionStorage.setItem("search", window.location.search);
        window.location.replace(
          window.location.origin +
            "/router.html?slug=" +
            slug +
            (window.location.search
              ? "&search=" + encodeURIComponent(window.location.search)
              : ""),
        );
      } else {
        window.location.replace(window.location.origin + "/");
      }
    <\/script>
  </head>
  <body>
    <p>Đang mở thiệp…</p>
  </body>
</html>`;
}
