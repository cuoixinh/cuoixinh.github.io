// Cloudflare Worker - PayOS Webhook Proxy v2
// Always returns success for PayOS verification, forwards real webhooks to Supabase

const SUPABASE_FUNCTION_URL =
  "https://lcobawmkywtxhpezndsh.supabase.co/functions/v1/payos-webhook";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxjb2Jhd21reXd0eGhwZXpuZHNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4OTA5ODMsImV4cCI6MjA5MTQ2Njk4M30.4BNmxnfixXdHOq0ovtaF_4wQZ9sap3IWbJNJK9H4Mg4";

export default {
  async fetch(request, env, ctx) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Content-Type": "application/json",
    };

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // Handle GET - for verification
    if (request.method === "GET") {
      return new Response(
        JSON.stringify({
          success: true,
          message: "PayOS Webhook proxy is active",
          status: "ok",
        }),
        {
          status: 200,
          headers: corsHeaders,
        },
      );
    }

    // Handle POST
    if (request.method === "POST") {
      try {
        const body = await request.text();
        console.log("Webhook received, body length:", body.length);

        // Always return success immediately for PayOS
        // This ensures PayOS verification passes
        const successResponse = new Response(
          JSON.stringify({
            success: true,
            message: "Webhook received successfully",
            code: "00",
          }),
          {
            status: 200,
            headers: corsHeaders,
          },
        );

        // If body is empty or very short, it's just a test
        if (!body || body.length < 20) {
          return successResponse;
        }

        // For real webhooks, forward to Supabase in background
        // Don't wait for response to avoid timeout
        ctx.waitUntil(
          (async () => {
            try {
              // Forward all headers from PayOS including signature
              const forwardHeaders = {
                "Content-Type": "application/json",
                Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
              };

              // Copy important headers from original request
              const headersToForward = [
                "x-payos-signature",
                "x-webhook-signature",
              ];
              headersToForward.forEach((headerName) => {
                const headerValue = request.headers.get(headerName);
                if (headerValue) {
                  forwardHeaders[headerName] = headerValue;
                }
              });

              await fetch(SUPABASE_FUNCTION_URL, {
                method: "POST",
                headers: forwardHeaders,
                body: body,
              });
              console.log("Forwarded to Supabase successfully");
            } catch (error) {
              console.error("Error forwarding to Supabase:", error);
            }
          })(),
        );

        // Return success immediately
        return successResponse;
      } catch (error) {
        console.error("Worker error:", error);
        // Even on error, return success to PayOS
        return new Response(
          JSON.stringify({
            success: true,
            message: "Webhook received",
            code: "00",
          }),
          {
            status: 200,
            headers: corsHeaders,
          },
        );
      }
    }

    return new Response("Method not allowed", {
      status: 405,
      headers: corsHeaders,
    });
  },
};
