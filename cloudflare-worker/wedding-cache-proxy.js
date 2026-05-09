var __defProp = Object.defineProperty;
var __name = (target, value) =>
  __defProp(target, "name", { value, configurable: true });

// worker.js
var SUPABASE_EDGE_URL =
  "https://lcobawmkywtxhpezndsh.supabase.co/functions/v1/wedding-admin";
var CACHE_TTL = 300;
var worker_default = {
  async fetch(request, env, ctx) {
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
    const isCacheable = method === "GET" && (slug || id) && !isList;
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
    if ((method === "PATCH" || method === "DELETE") && supabaseResponse.ok) {
      ctx.waitUntil(invalidateCache(id, requestBody, responseData, env));
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
    // Delete cache by ID
    if (id) {
      await env.WEDDING_CACHE.delete(`wedding:id:${id}`);
      console.log("Deleted cache for ID:", id);
    }

    // Try to get slug from request body or response data
    let slug = null;
    if (requestBody && requestBody.slug) {
      slug = requestBody.slug;
    } else if (responseData && responseData.slug) {
      slug = responseData.slug;
    }

    // Delete cache by slug
    if (slug) {
      await env.WEDDING_CACHE.delete(`wedding:slug:${slug}`);
      console.log("Deleted cache for slug:", slug);
    }
  } catch (e) {
    console.error("Cache invalidation error:", e);
  }
}
__name(invalidateCache, "invalidateCache");
export { worker_default as default };
//# sourceMappingURL=worker.js.map
