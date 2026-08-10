// Separate webhook endpoint without authentication
// This is needed because PayOS webhook doesn't send Authorization header

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { withAxiom } from "../_shared/axiom.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
};

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function verifyWebhookSignature(payload: Record<string, any>, receivedSignature: string, secretKey: string): Promise<boolean> {
  try {
    // Sort keys alphabetically
    const sortedKeys = Object.keys(payload).sort();
    const sortedData: Record<string, any> = {};
    sortedKeys.forEach((key) => { sortedData[key] = payload[key]; });
    
    // Create string: key1=value1&key2=value2&...
    const dataString = Object.entries(sortedData).map(([key, value]) => `${key}=${value}`).join("&");
    
    console.log("Signature verification data string:", dataString);
    
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secretKey);
    const messageData = encoder.encode(dataString);
    
    const cryptoKey = await crypto.subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const signatureBuffer = await crypto.subtle.sign("HMAC", cryptoKey, messageData);
    const hashArray = Array.from(new Uint8Array(signatureBuffer));
    const expectedSignature = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    
    console.log("Expected signature:", expectedSignature);
    console.log("Received signature:", receivedSignature);
    
    return timingSafeEqual(expectedSignature, receivedSignature);
  } catch (error) {
    console.error("Signature verification error:", error);
    return false;
  }
}

serve(withAxiom("payos-webhook", async (req, log) => {
  // Handle OPTIONS for CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Handle GET for PayOS verification
  if (req.method === "GET") {
    return new Response(JSON.stringify({ 
      message: "PayOS Webhook endpoint is active",
      status: "ok" 
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Handle POST for actual webhook
  if (req.method === "POST") {
    try {
      const payload = await req.json();
      console.log("=== FULL WEBHOOK PAYLOAD ===");
      console.log(JSON.stringify(payload, null, 2));
      console.log("=== END PAYLOAD ===");

      // Verify signature
      const checksumKey = Deno.env.get("PAYOS_CHECKSUM_KEY");
      if (!checksumKey) {
        throw new Error("Missing PAYOS_CHECKSUM_KEY");
      }

      // ── Xác thực chữ ký webhook — triển khai 2 pha ────────────────────────
      // Xem docs/security-audit-plan.md #1.
      // Pha 1 (hiện tại): SHADOW MODE — tính chữ ký, ghi log
      //   `payos.signature_check` trên Axiom, vẫn xử lý đơn như cũ.
      // Pha 2: khi log xác nhận matched=true trên giao dịch thật → đặt biến môi
      //   trường PAYOS_ENFORCE_SIGNATURE=true để trả 401. Không cần sửa code.
      const enforceSignature = Deno.env.get("PAYOS_ENFORCE_SIGNATURE") === "true";
      const receivedSignature = payload.signature;

      // PayOS signature is calculated from the 'data' object, not the whole payload
      const signatureValid = receivedSignature
        ? await verifyWebhookSignature(payload.data, receivedSignature, checksumKey)
        : false;

      log.info("payos.signature_check", {
        orderCode: payload?.data?.orderCode ?? null,
        hasSignature: Boolean(receivedSignature),
        matched: signatureValid,
        enforcing: enforceSignature,
      });

      if (!signatureValid) {
        if (enforceSignature) {
          log.error("payos.signature_rejected", {
            orderCode: payload?.data?.orderCode ?? null,
            hasSignature: Boolean(receivedSignature),
          });
          return new Response(JSON.stringify({ error: "Invalid signature" }), {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        console.warn(
          "PayOS signature MISMATCH — shadow mode, vẫn xử lý đơn. " +
          "Kiểm tra log payos.signature_check trước khi bật PAYOS_ENFORCE_SIGNATURE=true.",
        );
      } else {
        console.log("Webhook signature verified successfully");
      }

      // Extract payment data
      const paymentData = payload.data;
      if (!paymentData) {
        log.error("payos.missing_payment_data", {});
        return new Response(JSON.stringify({ error: "Missing payment data" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Initialize Supabase client with service role key
      const supabaseClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      );

      // Get wedding record by order_id
      // PayOS sends orderCode as number, but we store it as "ORDER-{orderCode}"
      const orderCodeFromPayOS = paymentData.orderCode;
      const fullOrderId = `ORDER-${orderCodeFromPayOS}`;
      
      console.log("Looking for order:", fullOrderId);
      
      const { data: weddingData, error: weddingError } = await supabaseClient
        .from("weddings")
        .select("id, theme, payment_amount")
        .eq("payment_order_id", fullOrderId)
        .single();

      if (weddingError || !weddingData) {
        console.error("Wedding not found:", weddingError);
        // Khách đã trả tiền nhưng không tìm ra thiệp tương ứng → tiền vào mà thiệp
        // không mở. Phải cảnh báo được, không để lẫn trong console.
        log.error("payos.wedding_not_found", {
          orderCode: orderCodeFromPayOS,
          payment_order_id: fullOrderId,
          error: weddingError?.message,
        });
        return new Response(JSON.stringify({ error: "Wedding not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const manage_id = weddingData.id;
      const theme_name = weddingData.theme || "template1";

      // Số tiền kỳ vọng là payment_amount đã chốt lúc tạo đơn — đã trừ mã giảm
      // giá và do chính payment-handler ghi nên vẫn tin được (không phải số
      // client gửi lên). Đơn cũ chưa có payment_amount → rơi về giá niêm yết.
      let expectedAmount: number | null = weddingData.payment_amount ?? null;

      if (expectedAmount === null) {
        const { data: pricingData, error: pricingError } = await supabaseClient
          .from("template_pricing")
          .select("price")
          .eq("template_name", theme_name)
          .eq("is_active", true)
          .single();

        if (pricingError || !pricingData) {
          console.error("Pricing validation error:", pricingError);
          log.error("payos.pricing_not_found", {
            orderCode: orderCodeFromPayOS,
            manage_id,
            theme: theme_name,
            error: pricingError?.message,
          });
          return new Response(JSON.stringify({ error: "Invalid template pricing" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        expectedAmount = pricingData.price;
      }

      if (paymentData.amount !== expectedAmount) {
        console.error("Amount mismatch. Expected:", expectedAmount, "Got:", paymentData.amount);
        // Vừa là dấu hiệu cấu hình giá sai, vừa là dấu hiệu có người thử giả mạo
        // webhook với số tiền tự đặt → cần thấy được trên Axiom.
        log.error("payos.amount_mismatch", {
          orderCode: orderCodeFromPayOS,
          manage_id,
          expected: expectedAmount,
          received: paymentData.amount,
        });
        return new Response(JSON.stringify({ error: "Amount mismatch" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Update wedding record
      const payment_status = paymentData.code === "00" ? "completed" : "failed";

      const updateFields: Record<string, unknown> = {
        payment_status,
        transaction_id: paymentData.transactionDateTime || paymentData.orderCode,
        payment_time: new Date().toISOString(),
      };
      // Thanh toán thành công → gỡ hạn dùng thử: mở thiệp vĩnh viễn (không hết hạn).
      if (payment_status === "completed") {
        updateFields.expires_at = null;
      }

      const { error: updateError } = await supabaseClient
        .from("weddings")
        .update(updateFields)
        .eq("id", manage_id);

      if (updateError) {
        console.error("Update error:", updateError);
        log.error("payos.update_failed", {
          manage_id,
          error: updateError.message,
          code: updateError.code,
          details: updateError.details,
        });
        return new Response(JSON.stringify({ error: "Failed to update payment status" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Đánh dấu mã giảm giá đã dùng xong (xem changelogs/RC1.8). Thanh toán
      // THẤT BẠI thì KHÔNG trả lượt: lượt đã trừ lúc áp mã và không hoàn lại.
      // Tiền đã vào rồi nên lỗi ở đây CHỈ ghi log, không được trả lỗi cho PayOS.
      if (payment_status === "completed") {
        const { data: promoResult, error: promoError } = await supabaseClient
          .rpc("cx_promo_redeem", { p_order_id: fullOrderId });
        if (promoError || promoResult?.ok === false) {
          log.error("promo.redeem_failed", {
            order_id: fullOrderId,
            manage_id,
            error: promoError?.message,
            result: promoResult,
          });
        }
      }

      // Log webhook event
      await supabaseClient.from("payment_logs").insert({
        order_id: paymentData.orderCode,
        manage_id,
        event_type: "webhook_received",
        payload: paymentData,
      });

      console.log("Payment updated successfully:", manage_id, payment_status);

      return new Response(JSON.stringify({ 
        success: true,
        message: "Webhook processed successfully" 
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } catch (error) {
      console.error("Webhook error:", error);
      return new Response(JSON.stringify({ 
        error: error.message || "Internal server error" 
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  // Method not allowed
  return new Response(JSON.stringify({ error: "Method not allowed" }), {
    status: 405,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}));
