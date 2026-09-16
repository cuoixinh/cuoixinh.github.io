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

    // Lấy filename từ path: /abc123.jpg
    const filename = decodeURIComponent(url.pathname.slice(1)); // bỏ dấu / đầu

    // ALLOWLIST ký tự, khớp tên do core/bl/image-bl.js sinh ra. Nối thẳng
    // pathname vào URL storage thì `%2e%2e%2f` đi ra khỏi thư mục bucket.
    if (!/^[A-Za-z0-9._-]{1,120}$/.test(filename)) {
      return new Response("Invalid filename", { status: 400 });
    }

    // Check cache trước
    const cache = caches.default;
    let response = await cache.match(request);

    if (response) {
      // Cache HIT
      return new Response(response.body, {
        headers: {
          ...Object.fromEntries(response.headers),
          "X-Cache": "HIT",
          "Cache-Control": `public, max-age=${CACHE_TTL}`,
        },
      });
    }

    // Cache MISS → fetch từ Supabase Storage
    const storageUrl = `${STORAGE_BASE_URL}/${filename}`;
    response = await fetch(storageUrl);

    if (!response.ok) {
      return response; // Trả về lỗi từ Supabase
    }

    // Clone response để cache
    const responseToCache = response.clone();

    // Tạo response mới với cache headers
    const cachedResponse = new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: {
        ...Object.fromEntries(response.headers),
        "X-Cache": "MISS",
        "Cache-Control": `public, max-age=${CACHE_TTL}`,
        "CDN-Cache-Control": `public, max-age=${CACHE_TTL}`,
      },
    });

    // Lưu vào cache bất đồng bộ
    ctx.waitUntil(cache.put(request, responseToCache));

    return cachedResponse;
  },
};
