// Cloudflare Worker - PayOS Webhook Proxy v2
// Always returns success for PayOS verification, forwards real webhooks to Supabase

const SUPABASE_FUNCTION_URL =
  "https://lcobawmkywtxhpezndsh.supabase.co/functions/v1/payos-webhook";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxjb2Jhd21reXd0eGhwZXpuZHNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4OTA5ODMsImV4cCI6MjA5MTQ2Njk4M30.4BNmxnfixXdHOq0ovtaF_4wQZ9sap3IWbJNJK9H4Mg4";

/**
 * Đẩy log về Axiom, cùng dataset với các Edge Function (xem _shared/axiom.ts).
 *
 * Cần thiết vì Worker này là chốt chặn cuối của luồng thanh toán: khi nó không
 * với tới được Supabase, KHÔNG có Edge Function nào chạy nên Axiom sẽ không có
 * bất kỳ dấu vết nào nếu chỉ dựa vào console.error (log Cloudflare lưu ngắn hạn).
 *
 * Thiếu AXIOM_TOKEN/AXIOM_DATASET → no-op, không bao giờ làm hỏng luồng webhook.
 * Đặt secret: wrangler secret put AXIOM_TOKEN --config wrangler-webhook.toml
 */
function axiomLog(env, ctx, level, message, fields = {}) {
  const token = env?.AXIOM_TOKEN;
  const dataset = env?.AXIOM_DATASET;
  if (!token || !dataset) return;

  const body = JSON.stringify([
    {
      _time: new Date().toISOString(),
      level,
      source: "payos-webhook-proxy",
      message,
      ...fields,
    },
  ]);

  try {
    ctx.waitUntil(
      fetch(`https://api.axiom.co/v1/datasets/${dataset}/ingest`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body,
      }).catch((e) => console.error("Axiom ingest failed:", e)),
    );
  } catch (e) {
    console.error("Axiom log error:", e);
  }
}

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

        // Ping xác minh của PayOS (body rỗng/rất ngắn) → trả 200 ngay, không forward.
        if (!body || body.length < 20) {
          return new Response(
            JSON.stringify({
              success: true,
              message: "Webhook endpoint active",
              code: "00",
            }),
            { status: 200, headers: corsHeaders },
          );
        }

        // Webhook THẬT: forward và CHỜ kết quả, trả status thật về PayOS.
        //
        // Trước đây worker luôn trả 200 và forward ở background (ctx.waitUntil),
        // nên mọi lỗi phía Supabase đều bị nuốt: PayOS tưởng thành công và KHÔNG
        // retry → khách trả tiền mà thiệp không được mở, không ai biết.
        // Xử lý phía sau là idempotent (update theo payment_order_id) nên để
        // PayOS retry khi nhận non-2xx là an toàn.
        const forwardHeaders = {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        };

        // Forward chữ ký từ PayOS để Edge Function xác thực được
        ["x-payos-signature", "x-webhook-signature"].forEach((headerName) => {
          const headerValue = request.headers.get(headerName);
          if (headerValue) {
            forwardHeaders[headerName] = headerValue;
          }
        });

        const upstream = await fetch(SUPABASE_FUNCTION_URL, {
          method: "POST",
          headers: forwardHeaders,
          body: body,
        });

        const upstreamText = await upstream.text();

        if (!upstream.ok) {
          console.error(
            "Upstream (payos-webhook) error:",
            upstream.status,
            upstreamText.slice(0, 500),
          );
          axiomLog(env, ctx, "error", "proxy.upstream_error", {
            status: upstream.status,
            body: upstreamText.slice(0, 500),
          });
        }

        return new Response(
          upstreamText || JSON.stringify({ success: upstream.ok }),
          { status: upstream.status, headers: corsHeaders },
        );
      } catch (error) {
        console.error("Worker error:", error);
        // Trường hợp nặng nhất: không chạm được tới Supabase nên KHÔNG Edge Function
        // nào chạy → đây là nguồn log duy nhất về sự cố này.
        axiomLog(env, ctx, "error", "proxy.upstream_unreachable", {
          error: error instanceof Error ? error.message : String(error),
        });
        // Không xác nhận được đã xử lý → trả 502 để PayOS retry, KHÔNG giả vờ thành công.
        return new Response(
          JSON.stringify({ error: "Upstream unreachable" }),
          { status: 502, headers: corsHeaders },
        );
      }
    }

    return new Response("Method not allowed", {
      status: 405,
      headers: corsHeaders,
    });
  },
};
