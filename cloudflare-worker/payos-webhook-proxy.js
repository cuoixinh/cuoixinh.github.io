// Cloudflare Worker - PayOS Webhook Proxy
// Nhận webhook PayOS rồi forward sang Edge Function payos-webhook.
//
// MỘT file, deploy thành HAI worker (xem wrangler-webhook.toml và
// wrangler-webhook-staging.toml): mỗi kênh thanh toán của PayOS khai webhook
// riêng, nên staging có instance riêng thay vì định tuyến trong code.
//
// Đích BẮT BUỘC lấy từ [vars] của toml, KHÔNG có giá trị mặc định: một worker
// thiếu cấu hình mà vẫn chạy được là nó bắn webhook của kênh mình vào DB của
// môi trường KHÁC, im lặng, không có gì báo — hỏng nặng nhất trong luồng tiền.
// Thiếu thì trả 500, PayOS retry, và sai sót lộ ra ngay lúc khai URL.

/**
 * Đẩy log về Axiom, cùng dataset với các Edge Function (xem _shared/axiom.ts).
 * Worker này là chốt chặn cuối của luồng thanh toán: nó không với tới được
 * Supabase thì không Edge Function nào chạy, Axiom sẽ không có dấu vết nào.
 * Thiếu AXIOM_TOKEN/AXIOM_DATASET → no-op.
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

/**
 * Payload MẪU mà PayOS bắn ra lúc xác minh Webhook URL — nhận ra bằng orderCode 123.
 * Không phải đơn thật nên KHÔNG được forward: xuống tới Edge Function là 404.
 */
function isVerifyPing(body) {
  try {
    return JSON.parse(body)?.data?.orderCode === 123;
  } catch {
    return false;
  }
}

export default {
  async fetch(request, env, ctx) {
    const SUPABASE_FUNCTION_URL = env.SUPABASE_FUNCTION_URL;
    // Không bắt buộc: payos-webhook deploy với --no-verify-jwt nên gateway không
    // đòi JWT (xem NO_VERIFY trong scripts/deploy-functions.sh).
    const SUPABASE_ANON_KEY = env.SUPABASE_ANON_KEY || "";

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

    // Thiếu đích thì DỪNG, kể cả với ping xác minh: để PayOS khai được URL của
    // một worker chưa cấu hình là mời sự cố về sau. 500 → PayOS retry, và Axiom
    // ghi lại vì đây là lỗi không nhìn thấy được từ đâu khác.
    if (!SUPABASE_FUNCTION_URL) {
      axiomLog(env, ctx, "error", "proxy.missing_config", {
        hint: "Khai SUPABASE_FUNCTION_URL trong [vars] của wrangler-webhook*.toml",
      });
      return new Response(
        JSON.stringify({ error: "Worker chưa cấu hình SUPABASE_FUNCTION_URL" }),
        { status: 500, headers: corsHeaders },
      );
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

        // Ping xác minh lúc khai Webhook URL trong PayOS. PayOS đòi 2XX, không thì
        // từ chối lưu URL. Đã gặp HAI dạng:
        //   - body rỗng/rất ngắn
        //   - payload MẪU đầy đủ, `data.orderCode` luôn là 123
        // Dạng thứ hai lọt xuống Edge Function thì nó tra `ORDER-123` không thấy và
        // trả 404 → PayOS báo "Webhook url không hoạt động, mã lỗi 404".
        // Nhận diện an toàn: orderCode thật do payment-handler sinh luôn 13-14 chữ số
        // (9 số cuối epoch ms + 5 số ngẫu nhiên), không bao giờ là 123.
        if (!body || body.length < 20 || isVerifyPing(body)) {
          return new Response(
            JSON.stringify({
              success: true,
              message: "Webhook endpoint active",
              code: "00",
            }),
            { status: 200, headers: corsHeaders },
          );
        }

        // Webhook THẬT: forward và CHỜ kết quả, trả status thật về PayOS. Xử lý
        // phía sau là idempotent (update theo payment_order_id) nên để PayOS
        // retry khi nhận non-2xx là an toàn.
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
