// Cloudflare Worker: gom danh sách templates + pricing từ Supabase thành MỘT
// response JSON, có cache ở edge và endpoint POST /purge cho admin.
//
// HAI TTL KHÁC NHAU, cố ý (xem withClientCache): bản lưu ở edge sống lâu vì
// admin purge được, còn bản trả về trình duyệt phải ngắn — cache trên máy khách
// không có cách nào xoá từ xa, TTL dài là thay đổi template không tới được
// khách đã ghé trang cho tới khi hết hạn.

// Bản lưu ở edge: dài, vì purge được. Bản trả về browser: ngắn, vì không.
const EDGE_TTL = 604800; // 7 ngày
const CLIENT_TTL = 300; // 5 phút — cũng là độ trễ tối đa khi đổi template

// Đóng lại response cho phía khách với TTL ngắn. Phải gọi ở CẢ hai nhánh (cache
// hit lẫn miss): bản nằm trong cache mang sẵn TTL dài, trả thẳng ra là browser
// giữ lại 7 ngày đúng như cũ.
function withClientCache(response, corsHeaders) {
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", `public, max-age=${CLIENT_TTL}`);
  headers.delete("CDN-Cache-Control");
  headers.delete("Cloudflare-CDN-Cache-Control");
  for (const [k, v] of Object.entries(corsHeaders)) headers.set(k, v);
  return new Response(response.body, { status: response.status, headers });
}

export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-Purge-Secret",
    };

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);

    // Purge cache endpoint
    if (request.method === "POST" && url.pathname === "/purge") {
      return handlePurge(request, env, corsHeaders);
    }

    // Only allow GET requests for templates
    if (request.method !== "GET") {
      return new Response("Method not allowed", {
        status: 405,
        headers: corsHeaders,
      });
    }

    try {
      // Check cache first
      const cache = caches.default;
      // Use simple URL-based cache key (no request headers/method)
      const cacheKey = new Request(request.url);
      let response = await cache.match(cacheKey);

      if (response) {
        console.log("Cache hit for templates with pricing");
        return withClientCache(response, corsHeaders);
      }

      console.log("Cache miss, fetching from Supabase");

      // Fetch from Supabase
      const supabaseUrl = env.SUPABASE_URL;
      const supabaseKey = env.SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseKey) {
        throw new Error("Missing Supabase credentials");
      }

      const headers = {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      };

      // Fetch templates và pricing song song — cache miss trước đây gọi tuần
      // tự nên mất gần gấp đôi thời gian, càng dễ dính lỗi/timeout tạm thời
      // từ Supabase giữa hai lệnh gọi.
      const [templatesResponse, pricingResponse] = await Promise.all([
        fetch(
          `${supabaseUrl}/rest/v1/templates?is_active=eq.true&order=sort_order.asc&select=*`,
          { headers },
        ),
        fetch(
          `${supabaseUrl}/rest/v1/template_pricing?is_active=eq.true&select=template_name,price,original_price,description`,
          { headers },
        ),
      ]);

      if (!templatesResponse.ok) {
        throw new Error(`Templates fetch error: ${templatesResponse.status}`);
      }
      if (!pricingResponse.ok) {
        throw new Error(`Pricing fetch error: ${pricingResponse.status}`);
      }

      const templates = await templatesResponse.json();
      const pricing = await pricingResponse.json();

      // Merge pricing into templates
      const templatesWithPricing = templates.map((template) => {
        const templatePricing = pricing.find(
          (p) => p.template_name === template.template_name,
        );
        return {
          id: template.template_id,
          name: template.display_name,
          description: template.description,
          thumbnail: template.thumbnail_url,
          previewUrl: template.preview_url,
          theme: template.template_name,
          status: template.status,
          category: template.category,
          price: templatePricing?.price || null,
          originalPrice: templatePricing?.original_price || null,
        };
      });

      // Bản dành cho edge — TTL của Cache API lấy từ chính header này.
      response = new Response(JSON.stringify(templatesWithPricing), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Cache-Control": `public, max-age=${EDGE_TTL}`,
          "CDN-Cache-Control": `public, max-age=${EDGE_TTL}`,
          "Cloudflare-CDN-Cache-Control": `public, max-age=${EDGE_TTL}`,
        },
      });

      await cache.put(cacheKey, response.clone());

      return withClientCache(response, corsHeaders);
    } catch (error) {
      console.error("Templates cache error:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  },
};

// Xoá bản lưu ở edge. Hai giới hạn cố hữu, admin phải biết để không truy nhầm:
// Cache API là RIÊNG TỪNG COLO nên chỉ xoá được ở colo nhận request này, và nó
// hoàn toàn không chạm tới cache trên trình duyệt khách (chỗ đó chờ CLIENT_TTL).
// Trên deployment *.workers.dev thì Cache API còn không lưu gì, deletedCount sẽ
// luôn là 0 — đó là bình thường, không phải lỗi.
async function handlePurge(request, env, corsHeaders) {
  try {
    // Verify secret
    const purgeSecret = request.headers.get("X-Purge-Secret");
    if (!purgeSecret || purgeSecret !== env.PURGE_SECRET) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Purge cache - delete all possible cache keys
    const cache = caches.default;
    const url = new URL(request.url);
    const baseUrl = url.origin;

    // Delete cache for base URL and with trailing slash
    // IMPORTANT: Don't pass 'request' as second parameter - it copies POST method/headers
    // We need GET requests to match the original cached requests
    const keysToDelete = [
      new Request(baseUrl), // GET request without trailing slash
      new Request(baseUrl + "/"), // GET request with trailing slash
    ];

    let deletedCount = 0;
    const keysAttempted = [];

    for (const key of keysToDelete) {
      keysAttempted.push(key.url);
      const deleted = await cache.delete(key);
      if (deleted) {
        deletedCount++;
        console.log("Successfully deleted cache for:", key.url);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Cache purged successfully",
        deletedCount,
        keysAttempted,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}
