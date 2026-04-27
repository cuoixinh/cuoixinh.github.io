/**
 * Cloudflare Worker - Cache proxy cho Supabase Edge Function
 *
 * Chiến lược:
 * - GET ?slug= hoặc ?id=  → cache 30 ngày (khách mời xem thiệp)
 * - GET ?list=true         → không cache (admin panel)
 * - POST / PATCH / DELETE  → pass thẳng, invalidate cache liên quan
 * - OPTIONS                → pass thẳng (CORS preflight)
 */

const SUPABASE_EDGE_URL =
  "https://lcobawmkywtxhpezndsh.supabase.co/functions/v1/wedding-admin";
const CACHE_TTL = 2592000; // 30 ngày (giây)

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const method = request.method;

    // Thêm CORS headers cho tất cả response
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type, x-admin-token",
      "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    };

    // OPTIONS preflight → trả về ngay
    if (method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }

    // Chỉ cache GET request đọc thiệp đơn lẻ (slug hoặc id)
    const slug = url.searchParams.get("slug");
    const id = url.searchParams.get("id");
    const isList = url.searchParams.get("list") === "true";
    const isCacheable = method === "GET" && (slug || id) && !isList;

    // ===== CACHE HIT =====
    if (isCacheable) {
      const cacheKey = buildCacheKey(slug, id);
      const cached = await env.WEDDING_CACHE.get(cacheKey, { type: "json" });

      if (cached) {
        return new Response(JSON.stringify(cached), {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "X-Cache": "HIT",
            "Cache-Control": `public, max-age=${CACHE_TTL}`,
          },
        });
      }
    }

    // ===== FORWARD TO SUPABASE =====
    const supabaseUrl = new URL(SUPABASE_EDGE_URL);
    // Copy tất cả query params
    url.searchParams.forEach((value, key) => {
      supabaseUrl.searchParams.set(key, value);
    });

    const supabaseRequest = new Request(supabaseUrl.toString(), {
      method,
      headers: request.headers,
      body: method !== "GET" && method !== "HEAD" ? request.body : undefined,
    });

    const supabaseResponse = await fetch(supabaseRequest);
    const responseData = await supabaseResponse.json();

    // ===== LƯU CACHE SAU KHI GET THÀNH CÔNG =====
    if (isCacheable && supabaseResponse.ok) {
      const cacheKey = buildCacheKey(slug, id);
      // Lưu cache bất đồng bộ, không block response
      ctx.waitUntil(
        env.WEDDING_CACHE.put(cacheKey, JSON.stringify(responseData), {
          expirationTtl: CACHE_TTL,
        }),
      );
    }

    // ===== INVALIDATE CACHE KHI PATCH/DELETE =====
    if ((method === "PATCH" || method === "DELETE") && supabaseResponse.ok) {
      ctx.waitUntil(invalidateCache(request, env));
    }

    return new Response(JSON.stringify(responseData), {
      status: supabaseResponse.status,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "X-Cache": "MISS",
      },
    });
  },
};

/**
 * Tạo cache key chuẩn từ slug hoặc id
 */
function buildCacheKey(slug, id) {
  if (slug) return `wedding:slug:${slug}`;
  if (id) return `wedding:id:${id}`;
  return null;
}

/**
 * Xóa cache khi wedding được cập nhật
 * PATCH body chứa id + có thể có slug mới → xóa cache theo id và slug
 */
async function invalidateCache(request, env) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");

    if (id) {
      // Xóa cache theo id
      await env.WEDDING_CACHE.delete(`wedding:id:${id}`);

      // Đọc body để lấy slug (nếu có)
      const body = await request
        .clone()
        .json()
        .catch(() => ({}));
      if (body.slug) {
        // Xóa cache theo slug mới
        await env.WEDDING_CACHE.delete(`wedding:slug:${body.slug}`);
      }

      // Note: Không xóa được slug cũ vì không biết slug cũ là gì
      // Slug cũ sẽ tự expire sau 2 ngày
    }
  } catch (e) {
    console.error("Cache invalidation error:", e);
  }
}
