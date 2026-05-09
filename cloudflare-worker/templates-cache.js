// Cloudflare Worker to cache templates with pricing from Supabase
// Cache for 7 days since new templates are rarely added

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
      const cacheKey = new Request(request.url, request);
      let response = await cache.match(cacheKey);

      if (response) {
        console.log("Cache hit for templates with pricing");
        return response;
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

      // Fetch templates
      const templatesResponse = await fetch(
        `${supabaseUrl}/rest/v1/templates?is_active=eq.true&order=sort_order.asc&select=*`,
        { headers },
      );

      if (!templatesResponse.ok) {
        throw new Error(`Templates fetch error: ${templatesResponse.status}`);
      }

      const templates = await templatesResponse.json();

      // Fetch pricing
      const pricingResponse = await fetch(
        `${supabaseUrl}/rest/v1/template_pricing?is_active=eq.true&select=template_name,price,original_price,description`,
        { headers },
      );

      if (!pricingResponse.ok) {
        throw new Error(`Pricing fetch error: ${pricingResponse.status}`);
      }

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
          features: template.features || [],
          status: template.status,
          category: template.category,
          price: templatePricing?.price || null,
          originalPrice: templatePricing?.original_price || null,
        };
      });

      // Create response with cache headers
      response = new Response(JSON.stringify(templatesWithPricing), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=604800", // 7 days
          "CDN-Cache-Control": "public, max-age=604800",
          "Cloudflare-CDN-Cache-Control": "public, max-age=604800",
        },
      });

      // Store in cache
      await cache.put(cacheKey, response.clone());

      return response;
    } catch (error) {
      console.error("Templates cache error:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  },
};

// Handle cache purge
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
    const keysToDelete = [
      new Request(baseUrl, request),
      new Request(baseUrl + "/", request),
    ];

    let deletedCount = 0;
    for (const key of keysToDelete) {
      const deleted = await cache.delete(key);
      if (deleted) deletedCount++;
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Cache purged successfully",
        deletedCount,
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
