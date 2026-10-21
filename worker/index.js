/**
 * Worker của site chính (Workers Assets) — lo link thiệp `/<slug>`: trả thẳng
 * trang mẫu của thiệp TẠI URL đó (rewrite, xem route-html.mjs) kèm thẻ preview
 * og:* cho Messenger/Zalo/Facebook (crawler KHÔNG chạy JS nên trang không tự khai).
 *
 * Path khớp file tĩnh không vào đây (asset router phục vụ trước) — trừ trang mẫu
 * /public/themes/* (run_worker_first ở wrangler*.jsonc): bản xem thử mẫu cũng cần
 * thẻ og:* khi gửi link. Không dựng được trang mẫu thì lùi về trang chuyển hướng —
 * BẢN SAO của 404.html → router.html.
 *
 * Không truy vấn DB: dữ liệu lấy qua Edge Function wedding-admin (?slug=).
 * Biến khai ở [vars] của wrangler.jsonc / wrangler.staging.jsonc.
 */

import {
  DEFAULT_THEME,
  LOCK_CODES,
  REWRITE_ATTRS,
  THEME_NAME,
  rewriteAttr,
  routeHead,
  desktopWide,
  slugSegment,
  themeDir,
} from "./route-html.mjs";

const DEFAULT_DESC =
  "Trân trọng kính mời Quý Khách đến dự và chung vui cùng gia đình chúng tôi.";

// Câu mẫu chia sẻ khi chủ thiệp để trống — bản sao SHARE_MESSAGE_DEFAULT ở
// core/constant.js (worker không nạp file đó), đổi câu thì đổi cả hai.
const DEFAULT_SHARE_TPL =
  "Trân trọng kính mời ##Relationship## đến dự lễ cưới của chúng mình. Sự hiện diện của ##Relationship## là niềm vui lớn của gia đình. Thiệp mời: ##link##";

// Đường phục vụ lại ảnh bìa cho og:image — KHÔNG trỏ og:image thẳng vào bucket.
// Hai thứ ở bucket làm Facebook bỏ ô ảnh trong khi Zalo và trình duyệt vẫn hiện
// bình thường (rất dễ tưởng đã xong): file còn nguyên EXIF của máy chụp, và
// header "X-Robots-Tag: none" mà Storage gắn lên mọi file public.
const OG_IMG_PREFIX = "/__og/";

// Đường dẫn Storage hợp lệ (khớp STORAGE_PATH_RE ở _shared/wedding-images.ts) — chặn
// path traversal và biến worker thành proxy mở.
const OG_IMG_NAME = /^(?:w\/[0-9a-f]{32}\/)?(?!\.{1,2}$)[A-Za-z0-9._-]{1,120}$/;

// Ảnh đủ nhẹ thì lúc upload KHÔNG bị nén lại (xem core/helpers/image-helper.js)
// nên lên bucket còn nguyên EXIF/APP13 của máy chụp — ảnh chụp bằng iPhone hay
// dính — và Facebook bỏ luôn ô ảnh với loại file đó, trong khi trình duyệt lẫn
// Zalo vẫn hiện bình thường. Cho ảnh đi qua bộ chuyển đổi của Cloudflare là ra
// JPEG sạch metadata. Ảnh DỌC hiện tốt trên Messenger nên "scale-down" giữ
// nguyên tỉ lệ, chỉ thu lại ảnh quá to.
const OG_IMG_BOX = { width: 1200, height: 1200, fit: "scale-down" };

// Trang mẫu: /public/themes/<mẫu>/ (index.html thì asset router tự chuyển về dạng này).
const THEMES_PREFIX = "/public/themes/";
const THEME_PAGE = /^\/public\/themes\/([a-z0-9][a-z0-9-]*)\/(?:index\.html)?$/;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith(OG_IMG_PREFIX)) return ogImage(env, url);

    // Trang mẫu tới đây nhờ run_worker_first; mọi file khác trong nhóm đó (ảnh…)
    // trả thẳng như asset router.
    if (url.pathname.startsWith(THEMES_PREFIX)) {
      const res = await env.ASSETS.fetch(request);
      const theme = THEME_PAGE.exec(url.pathname)?.[1];
      if (!theme || (request.method !== "GET" && request.method !== "HEAD")) return res;
      try {
        return (await templatePage(env, url, theme, res)) || res;
      } catch (_) {
        return res;
      }
    }

    // Chỉ GET/HEAD của một clean URL (luật ở slugSegment) mới là link thiệp.
    const seg = slugSegment(url.pathname);
    const isSlugPath = (request.method === "GET" || request.method === "HEAD") && seg;

    if (!isSlugPath) return notFoundPage(env, request, await env.ASSETS.fetch(request));

    // Hỏi asset router TRƯỚC: `/invitation-setup/`, `/checkout/`… cũng là một
    // đoạn không dấu chấm. Bình thường chúng không rơi tới worker (asset khớp
    // thì Cloudflare phục vụ thẳng), nhưng đừng sống nhờ thứ tự đó — trả nhầm
    // trang thiệp cho `/my-invitations/` là hỏng hẳn một trang.
    const asset = await env.ASSETS.fetch(request);
    if (asset.status !== 404) return asset;

    const wedding = await fetchWedding(env, seg);
    // Không tra được (slug sai, thiệp nháp, Edge Function lỗi) → 404 kèm trang
    // chuyển hướng, không bịa thẻ preview.
    const guest = wedding ? await decryptGuestParam(env, url, "name") : "";
    const rel = wedding ? await decryptGuestParam(env, url, "relationship") : "";

    if (wedding) {
      try {
        const res = await themePage(env, url, seg, wedding, guest, rel);
        if (res) return res;
      } catch (_) {
        /* lùi về trang chuyển hướng bên dưới */
      }
    }

    return new Response(await page(env, wedding, guest, url, rel), {
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

/**
 * Asset trả 404 (not_found_handling "none" trả rỗng) → phục vụ 404.html như host tĩnh.
 * `/404` chứ không `/404.html`: asset router chuyển hướng bản có đuôi.
 */
async function notFoundPage(env, request, res) {
  if (res.status !== 404) return res;
  const page = await env.ASSETS.fetch(new Request(new URL("/404", request.url)));
  if (page.status !== 200) return res;
  return new Response(page.body, {
    status: 404,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

/* ─────────────────────────────── dữ liệu ─────────────────────────────── */

async function fetchWedding(env, slug) {
  try {
    const r = await fetch(`${env.EDGE_URL}?slug=${encodeURIComponent(slug)}`, {
      headers: { Authorization: `Bearer ${env.ANON_KEY}` },
    });
    const data = await r.json().catch(() => null);
    if (!data) return null;
    // Hết hạn dùng thử / hết hạn gói / hết lượt xem vẫn trả kèm tên cô dâu chú rể — đủ
    // dựng thẻ, và link vẫn mở được (màn khoá nằm trong trang thiệp).
    if (!r.ok && !LOCK_CODES.includes(data.code)) return null;
    if (data.is_published === false) return null;
    return data;
  } catch (_) {
    return null;
  }
}

/** Ảnh cho thẻ: bìa trước, không có thì tấm đầu của album, rồi ảnh chú rể. */
function coverRef(w) {
  const gallery = Array.isArray(w?.gallery_images) ? w.gallery_images : [];
  return (
    w?.cover_image_url ||
    gallery.find((v) => typeof v === "string" && v) ||
    w?.groom_image_url ||
    ""
  );
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

/** Mô tả = "Câu mẫu chia sẻ" của chủ thiệp (trống thì câu mặc định), bỏ biến ##link## và URL trần. */
function ogDesc(w, guest, rel) {
  const tpl = String(w?.share_message_template || "").trim() || DEFAULT_SHARE_TPL;
  const text = tpl
    .replace(/##\s*relationship\s*##/gi, rel || "Quý Khách")
    .replace(/##\s*danh\s*x[ưu]ng\s*##/giu, guest || "Quý Khách") // câu mẫu cũ
    .replace(/##\s*link\s*##/gi, "")
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  return text || DEFAULT_DESC;
}

/** Phát lại ảnh bìa: mã hoá lại cho sạch, không mang X-Robots-Tag của Storage. */
async function ogImage(env, url) {
  const name = decodeURIComponent(url.pathname.slice(OG_IMG_PREFIX.length));
  if (!OG_IMG_NAME.test(name)) return new Response("", { status: 404 });
  const origin = `${env.STORAGE_URL}/${name}`;
  let src = await fetch(origin, {
    cf: {
      image: { ...OG_IMG_BOX, format: "jpeg", quality: 85 },
      cacheEverything: true,
      cacheTtl: 86400,
    },
  });
  // Zone chưa bật Transformations thì Cloudflare trả lỗi chứ không trả ảnh —
  // lùi về file gốc để thẻ vẫn có ảnh.
  if (!src.ok || !/^image\//.test(src.headers.get("Content-Type") || ""))
    src = await fetch(origin, { cf: { cacheEverything: true, cacheTtl: 86400 } });
  if (!src.ok || !src.body) return new Response("", { status: 404 });
  const headers = new Headers({
    "Content-Type": src.headers.get("Content-Type") || "image/jpeg",
    // Tên file có mã ngẫu nhiên, đổi ảnh là đổi tên → cache thoải mái.
    "Cache-Control": "public, max-age=31536000, immutable",
  });
  const len = src.headers.get("Content-Length");
  if (len) headers.set("Content-Length", len);
  return new Response(src.body, { status: 200, headers });
}

/* ────────────────────────── khổ ảnh cho og:image ──────────────────────── */
// Facebook/Messenger dựng thẻ NGAY lúc scrape, lúc đó nó chưa tải xong ảnh: thiếu
// og:image:width/height là thẻ hiện ra không có ảnh (Zalo tự tải nên vẫn hiện).
// Đọc vài KB đầu là đủ biết khổ, không phải kéo cả tấm ảnh.

async function imageMeta(res) {
  try {
    // 64KB chứ không phải vài KB: ảnh máy cơ/điện thoại có khối EXIF cả chục KB
    // nằm trước marker khổ ảnh của JPEG, đọc thiếu là mất luôn width/height.
    const head = await readHead(res, 65536);
    return head ? parseImageSize(head) : null;
  } catch (_) {
    return null;
  }
}

/** n byte đầu của một Response (hoặc URL) — đọc vài chunk rồi bỏ ngang. */
async function readHead(r, n) {
  if (typeof r === "string")
    r = await fetch(r, { headers: { Range: `bytes=0-${n - 1}` } });
  if (!r.ok || !r.body) return null;
  const reader = r.body.getReader();
  const parts = [];
  let len = 0;
  while (len < n) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value);
    len += value.length;
  }
  reader.cancel().catch(() => {});
  const out = new Uint8Array(len);
  let off = 0;
  for (const part of parts) {
    out.set(part, off);
    off += part.length;
  }
  return out;
}

/** Khổ + mime từ header của webp / png / jpeg. Không nhận ra thì trả null. */
function parseImageSize(b) {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const tag = (o, s) => String.fromCharCode(...b.slice(o, o + s.length)) === s;

  if (tag(0, "RIFF") && tag(8, "WEBP")) {
    const type = "image/webp";
    if (tag(12, "VP8X"))
      return {
        type,
        width: (b[24] | (b[25] << 8) | (b[26] << 16)) + 1,
        height: (b[27] | (b[28] << 8) | (b[29] << 16)) + 1,
      };
    if (tag(12, "VP8L")) {
      const bits = b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24);
      return {
        type,
        width: (bits & 0x3fff) + 1,
        height: ((bits >>> 14) & 0x3fff) + 1,
      };
    }
    if (tag(12, "VP8 "))
      return {
        type,
        width: v.getUint16(26, true) & 0x3fff,
        height: v.getUint16(28, true) & 0x3fff,
      };
    return { type, width: 0, height: 0 };
  }

  if (b[0] === 0x89 && tag(1, "PNG"))
    return {
      type: "image/png",
      width: v.getUint32(16),
      height: v.getUint32(20),
    };

  if (b[0] === 0xff && b[1] === 0xd8) {
    let o = 2;
    while (o + 9 < b.length) {
      if (b[o] !== 0xff) {
        o++;
        continue;
      }
      const m = b[o + 1];
      // SOF0–SOF15 mang khổ ảnh; DHT/DRI/SOS… thì nhảy qua theo độ dài khối.
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc)
        return {
          type: "image/jpeg",
          width: v.getUint16(o + 7),
          height: v.getUint16(o + 5),
        };
      if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) o += 2;
      else o += 2 + v.getUint16(o + 2);
    }
  }
  return null;
}

/* ─────────────────────────── giải mã tên khách ────────────────────────── */
// Link khách mời mang `name=`/`relationship=` mã hoá bằng CryptoJS.AES (định dạng OpenSSL:
// "Salted__" + salt + ciphertext, khoá dẫn xuất bằng EVP_BytesToKey/MD5).
// KHÔNG phải bảo mật — khoá nằm sẵn trong bundle client; ở đây chỉ để lấy đúng
// chữ hiển thị trên thẻ.

async function decryptGuestParam(env, url, key) {
  const raw = url.searchParams.get(key);
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

/**
 * Trang mẫu của thiệp phục vụ thẳng tại `/<slug>`; null khi không dựng được (mẫu
 * lạ, asset thiếu) để nơi gọi lùi về trang chuyển hướng.
 */
async function themePage(env, url, slug, w, guest, rel) {
  const theme = String(w.theme || DEFAULT_THEME);
  if (!THEME_NAME.test(theme)) return null;
  const dir = themeDir(theme);
  // Đo ảnh og (một lượt fetch) chạy song song lấy HTML — để tuần tự là người thật
  // cũng phải chờ phần chỉ crawler cần.
  const [tpl, og] = await Promise.all([
    env.ASSETS.fetch(new Request(new URL(dir, url.origin))),
    ogMeta(env, w, guest, url, rel),
  ]);
  if (tpl.status !== 200) return null;

  const rw = new HTMLRewriter();
  for (const attr of REWRITE_ATTRS) {
    rw.on(`[${attr}]`, {
      element(el) {
        // Chỉ ghi khi đổi: ghi lại nguyên giá trị có `&amp;` (URL Google Fonts…) dễ bị mã hoá hai lần.
        const v = el.getAttribute(attr);
        const out = rewriteAttr(attr, v, dir);
        if (out !== v) el.setAttribute(attr, out);
      },
    });
  }
  rw.on("title", { element: (el) => el.setInnerContent(og.title) });
  rw.on("head", {
    element: (el) => el.append(og.meta + routeHead(slug, theme, desktopWide(w)), { html: true }),
  });

  return new Response(rw.transform(tpl).body, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // Phản hồi mang HTML của MẪU: chủ thiệp đổi mẫu thì bản cache cũ chỉ được
      // sống ngắn, không thì khách mở ra mẫu cũ chạy với dữ liệu mới.
      "Cache-Control": "public, max-age=60",
    },
  });
}

const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** Thẻ og:* (+ tiêu đề) của một thiệp; không có thiệp thì rỗng. */
async function ogMeta(env, w, guest, url, rel) {
  const title = w ? ogTitle(w, guest) : "Cưới Xinh";
  const desc = w ? ogDesc(w, guest, rel) : "";
  const src = w ? imageUrl(env, coverRef(w)) : "";
  // Ảnh nằm trong bucket của mình thì phát qua /__og/ (xem OG_IMG_PREFIX); URL
  // ngoài — khách dán link ảnh sẵn có — giữ nguyên, không biến worker thành proxy.
  const mine = src.startsWith(`${env.STORAGE_URL}/`);
  const img = mine
    ? `${url.origin}${OG_IMG_PREFIX}${src.slice(env.STORAGE_URL.length + 1)}`
    : src;
  // Đo trên ĐÚNG luồng byte crawler sẽ tải (gọi thẳng hàm phát ảnh), nên khổ khai
  // ra luôn khớp dù zone đã bật Transformations hay còn lùi về file gốc.
  const dim = mine
    ? await imageMeta(await ogImage(env, new URL(img)))
    : src
      ? await imageMeta(src)
      : null;

  const meta = w ? ogTags({ title, desc, img, dim, url, noindex: true }) : "";
  return { title, meta };
}

/** Bộ thẻ og:* + twitter:* — dùng chung cho thiệp thật và bản xem thử mẫu. */
function ogTags({ title, desc, img, dim, url, noindex }) {
  // secure_url + type + khổ: Messenger cần đủ bộ mới vẽ ảnh ngay lượt scrape đầu.
  const size =
    dim && dim.width && dim.height
      ? `
    <meta property="og:image:width" content="${dim.width}" />
    <meta property="og:image:height" content="${dim.height}" />`
      : "";
  const imgMeta = img
    ? `
    <meta property="og:image" content="${esc(img)}" />
    <meta property="og:image:secure_url" content="${esc(img)}" />${
      dim?.type ? `
    <meta property="og:image:type" content="${dim.type}" />` : ""
    }${size}
    <meta property="og:image:alt" content="${esc(title)}" />
    <meta name="twitter:image" content="${esc(img)}" />`
    : "";

  return `
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Cưới Xinh" />
    <meta property="og:locale" content="vi_VN" />
    <meta property="og:url" content="${esc(url.href)}" />
    <meta property="og:title" content="${esc(title)}" />
    <meta property="og:description" content="${esc(desc)}" />
    <meta name="description" content="${esc(desc)}" />
    <meta name="twitter:card" content="${img ? "summary_large_image" : "summary"}" />
    <meta name="twitter:title" content="${esc(title)}" />
    <meta name="twitter:description" content="${esc(desc)}" />${imgMeta}${
      noindex ? `
    <meta name="robots" content="noindex" />` : ""
    }`;
}

/**
 * Bản xem thử mẫu (?preview=true): thẻ dựng y như link thiệp thật — tiêu đề, câu
 * mời mặc định, ảnh bìa — từ bộ dữ liệu mẫu của chính mẫu đó
 * (assets/data-template/<mẫu>/data.json, cũng là thứ trang hiển thị). Mẫu chưa có
 * bộ dữ liệu thì lấy ảnh chụp mẫu. Link ?slug= cũ (thiệp thật) giữ nguyên.
 * null = không có gì để chèn, nơi gọi trả nguyên trang.
 */
async function templatePage(env, url, theme, res) {
  if (url.searchParams.get("preview") !== "true" || url.searchParams.has("slug")) return null;
  if (res.status !== 200 || !/text\/html/.test(res.headers.get("Content-Type") || "")) return null;

  const base = `/assets/data-template/${theme}/`;
  const sample = await env.ASSETS.fetch(new Request(new URL(`${base}data.json`, url.origin)))
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);
  const c = (sample && sample.content) || {};
  const w = {
    groom_name: c.groom_name,
    bride_name: c.bride_name,
    share_message_template: c.share_message_template,
  };

  // Ảnh: bìa mẫu → tấm đầu album mẫu → ảnh chụp cả mẫu (assets/images/templates).
  const pick = [sample?.cover_image_url, sample?.gallery_images?.[0]].find(
    (v) => typeof v === "string" && /^[A-Za-z0-9._-]+$/.test(v),
  );
  let path = pick ? base + pick : `/assets/images/templates/${theme}.jpg`;
  let imgRes = await env.ASSETS.fetch(new Request(new URL(path, url.origin)));
  if (!imgRes.ok && pick) {
    path = `/assets/images/templates/${theme}.jpg`;
    imgRes = await env.ASSETS.fetch(new Request(new URL(path, url.origin)));
  }
  const img = imgRes.ok ? url.origin + path : "";
  const dim = imgRes.ok ? await imageMeta(imgRes) : null;

  const title = ogTitle(w, "");
  const meta = ogTags({ title, desc: ogDesc(w, "", ""), img, dim, url, noindex: false });

  const rw = new HTMLRewriter()
    .on("title", { element: (el) => el.setInnerContent(title) })
    .on("head", { element: (el) => el.append(meta, { html: true }) });
  const headers = new Headers(res.headers);
  // Cache ngắn: sửa bộ dữ liệu mẫu ở admin thì thẻ đổi theo sau vài phút.
  headers.set("Cache-Control", "public, max-age=300");
  headers.delete("Content-Length");
  return new Response(rw.transform(res).body, { status: 200, headers });
}

async function page(env, w, guest, url, rel) {
  const { title, meta } = await ogMeta(env, w, guest, url, rel);

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
