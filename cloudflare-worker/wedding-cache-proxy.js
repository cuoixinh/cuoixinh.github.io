var __defProp = Object.defineProperty;
var __name = (target, value) =>
  __defProp(target, "name", { value, configurable: true });

// worker.js
var CACHE_TTL = 300;
// Trang ĐẦU mục "Thiệp của khách" ở trang chủ (resource=public-showcase&offset=0) — mọi lượt
// vào trang chủ đều hỏi nó. Dữ liệu công khai, không phụ thuộc người gọi nên cache chung một
// key. Không xoá chủ động được (thanh toán/đổi đồng ý đi đường khác) → TTL quyết định độ trễ.
// Trang cuộn tiếp (offset > 0) vẫn đi thẳng Edge Function.
var SHOWCASE_TTL = 600;
var SHOWCASE_KEY = "showcase:page0";
var worker_default = {
  async fetch(request, env, ctx) {
    // Edge Function đích lấy từ [vars] của wrangler.toml, KHÔNG có mặc định:
    // viết cứng một project vào mã thì bản clone cho môi trường khác vẫn chạy
    // mà lặng lẽ đọc/ghi DB của môi trường kia. Thiếu thì 500, lộ ra ngay.
    const SUPABASE_EDGE_URL = env.SUPABASE_EDGE_URL;
    if (!SUPABASE_EDGE_URL) {
      return new Response(
        JSON.stringify({ error: "Worker chưa cấu hình SUPABASE_EDGE_URL" }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    const url = new URL(request.url);
    const method = request.method;
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type, x-admin-token",
      "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    };
    if (method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }
    const slug = url.searchParams.get("slug");
    const id = url.searchParams.get("id");
    const isList = url.searchParams.get("list") === "true";
    // CHỈ cache đường tra theo slug. Đường `?id=` yêu cầu người gọi là CHỦ THIỆP
    // (wedding-admin kiểm JWT), mà cache key không mang Authorization — cache nó
    // là biến một endpoint có phân quyền thành endpoint công khai
    // (docs/security-checklist.md A7).
    // Request mang mã quản trị nhận về BẢN ĐẦY ĐỦ (gồm dữ liệu thanh toán) —
    // cache nó là đem bản đó phát cho mọi người trong 5 phút.
    const isPrivileged = !!request.headers.get("x-admin-token");
    const isShowcaseHead =
      method === "GET" &&
      !isPrivileged &&
      url.searchParams.get("resource") === "public-showcase" &&
      url.searchParams.get("offset") === "0";
    if (isShowcaseHead) {
      const cached = await env.WEDDING_CACHE.get(SHOWCASE_KEY, { type: "json" });
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
    const isCacheable = method === "GET" && !!slug && !isList && !isPrivileged;
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

    // Clone request body for later use in cache invalidation
    let requestBody = null;
    if (method === "PATCH" && request.body) {
      const clonedRequest = request.clone();
      try {
        requestBody = await clonedRequest.json();
      } catch (e) {
        // Body might not be JSON
      }
    }

    const supabaseUrl = new URL(SUPABASE_EDGE_URL);
    url.searchParams.forEach((value, key) => {
      supabaseUrl.searchParams.set(key, value);
    });
    const supabaseRequest = new Request(supabaseUrl.toString(), {
      method,
      headers: request.headers,
      body: method !== "GET" && method !== "HEAD" ? request.body : void 0,
    });
    const supabaseResponse = await fetch(supabaseRequest);
    const responseData = await supabaseResponse.json();
    if (isCacheable && supabaseResponse.ok) {
      const cacheKey = buildCacheKey(slug, id);
      ctx.waitUntil(
        env.WEDDING_CACHE.put(cacheKey, JSON.stringify(responseData), {
          expirationTtl: CACHE_TTL,
        }),
      );
    }
    // Chỉ cache bản đúng dạng trang `{ items, next }`: lỗi hay dạng lạ mà đóng băng 10 phút là
    // mục biến mất khỏi trang chủ suốt chừng đó.
    if (
      isShowcaseHead &&
      supabaseResponse.ok &&
      Array.isArray(responseData?.items)
    ) {
      ctx.waitUntil(
        env.WEDDING_CACHE.put(SHOWCASE_KEY, JSON.stringify(responseData), {
          expirationTtl: SHOWCASE_TTL,
        }),
      );
    }
    if ((method === "PATCH" || method === "DELETE") && supabaseResponse.ok) {
      // For PATCH, id is in request body, not query params
      const weddingId =
        method === "PATCH" && requestBody?.id ? requestBody.id : id;
      ctx.waitUntil(invalidateCache(weddingId, requestBody, responseData, env));
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
function buildCacheKey(slug, id) {
  if (slug) return `wedding:slug:${slug}`;
  if (id) return `wedding:id:${id}`;
  return null;
}
__name(buildCacheKey, "buildCacheKey");
async function invalidateCache(id, requestBody, responseData, env) {
  try {
    // Try to get slug from request body, response data, or existing cache
    let slug = null;

    // Priority 1: Request body (if user is updating slug)
    if (requestBody && requestBody.slug) {
      slug = requestBody.slug;
    }

    // Priority 2: Response data
    if (!slug && responseData && responseData.slug) {
      slug = responseData.slug;
    }

    // Priority 3: Get from existing cache by ID (BEFORE deleting)
    if (!slug && id) {
      const cachedData = await env.WEDDING_CACHE.get(`wedding:id:${id}`, {
        type: "json",
      });
      if (cachedData && cachedData.slug) {
        slug = cachedData.slug;
      }
    }

    // Delete cache by slug (primary cache key used by clients)
    if (slug) {
      await env.WEDDING_CACHE.delete(`wedding:slug:${slug}`);
      console.log("Deleted cache for slug:", slug);
    } else {
      console.log("Could not determine slug for cache invalidation");
    }

    // Also delete cache by ID if exists (for robustness)
    if (id) {
      await env.WEDDING_CACHE.delete(`wedding:id:${id}`);
      console.log("Deleted cache for ID:", id);
    }
  } catch (e) {
    console.error("Cache invalidation error:", e);
  }
}
__name(invalidateCache, "invalidateCache");
export { worker_default as default };
//# sourceMappingURL=worker.js.map
