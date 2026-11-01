/** Cloudflare Worker — proxy ảnh Supabase Storage, cache 30 ngày. */

const CACHE_TTL = 2592000; // 30 ngày (giây)

export default {
  async fetch(request, env, ctx) {
    // Bucket đích lấy từ [vars] của wrangler-image.toml, KHÔNG có mặc định:
    // viết cứng một project vào mã thì bản clone cho môi trường khác vẫn chạy
    // mà lặng lẽ phục vụ ảnh của môi trường kia. Thiếu thì 500, lộ ra ngay.
    const STORAGE_BASE_URL = env.STORAGE_BASE_URL;
    if (!STORAGE_BASE_URL) {
      return new Response("Worker chưa cấu hình STORAGE_BASE_URL", { status: 500 });
    }

    const url = new URL(request.url);

    // Đường dẫn trong bucket: /w/<storage_key>/<tên> (hoặc /<tên> phẳng của dữ liệu cũ).
    const filename = decodeURIComponent(url.pathname.slice(1)); // bỏ dấu / đầu

    // ALLOWLIST, khớp STORAGE_PATH_RE ở supabase/functions/_shared/wedding-images.ts.
    // Nối thẳng pathname vào URL storage thì `%2e%2e%2f` đi ra khỏi thư mục bucket.
    if (!/^(?:w\/[0-9a-f]{32}\/)?(?!\.{1,2}$)[A-Za-z0-9._-]{1,120}$/.test(filename)) {
      return new Response("Invalid filename", { status: 400 });
    }

    // Khoá cache chỉ theo URL — header của trình duyệt (no-cache khi bật DevTools…) không được tách bản.
    const cache = caches.default;
    const cacheKey = new Request(url.toString(), { method: "GET" });
    const hit = await cache.match(cacheKey);

    if (hit) {
      const res = new Response(hit.body, hit);
      res.headers.set("X-Cache", "HIT");
      return res;
    }

    const upstream = await fetch(`${STORAGE_BASE_URL}/${filename}`);

    if (!upstream.ok) {
      return upstream; // Trả về lỗi từ Supabase
    }

    // Chỉ chép header của file: phản hồi Supabase mang Set-Cookie (__cf_bm) mà Cache API
    // từ chối lưu, và cache-control 1 giờ viết thường — trộn vào là ra hai giá trị.
    const headers = new Headers({ "Cache-Control": `public, max-age=${CACHE_TTL}` });
    for (const h of ["content-type", "content-length", "etag", "last-modified"]) {
      const v = upstream.headers.get(h);
      if (v) headers.set(h, v);
    }
    const clean = new Response(upstream.body, { status: 200, headers });

    ctx.waitUntil(cache.put(cacheKey, clean.clone()));

    const res = new Response(clean.body, clean);
    res.headers.set("X-Cache", "MISS");
    return res;
  },
};
