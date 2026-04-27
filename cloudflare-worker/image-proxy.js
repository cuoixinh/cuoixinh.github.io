/**
 * Cloudflare Worker - Image Proxy cho Supabase Storage
 *
 * Cache ảnh 30 ngày, giảm bandwidth Supabase Storage
 */

const STORAGE_BASE_URL =
  "https://lcobawmkywtxhpezndsh.supabase.co/storage/v1/object/public/wedding-images";
const CACHE_TTL = 2592000; // 30 ngày (giây)

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Lấy filename từ path: /abc123.jpg
    const filename = url.pathname.slice(1); // bỏ dấu / đầu

    if (!filename) {
      return new Response("Missing filename", { status: 400 });
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
