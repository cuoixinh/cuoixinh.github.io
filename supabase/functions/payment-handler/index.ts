import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { withAxiom } from "../_shared/axiom.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PAYOS_API_BASE = "https://api-merchant.payos.vn";

async function generateSignature(data: Record<string, any>, secretKey: string): Promise<string> {
  const sortedKeys = Object.keys(data).sort();
  const sortedData: Record<string, any> = {};
  sortedKeys.forEach((key) => { sortedData[key] = data[key]; });
  
  const dataString = Object.entries(sortedData).map(([key, value]) => `${key}=${value}`).join("&");
  
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secretKey);
  const messageData = encoder.encode(dataString);
  
  const cryptoKey = await crypto.subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, messageData);
  const hashArray = Array.from(new Uint8Array(signature));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function verifyWebhookSignature(payload: Record<string, any>, receivedSignature: string, secretKey: string): Promise<boolean> {
  try {
    const { signature, ...dataToVerify } = payload;
    const expectedSignature = await generateSignature(dataToVerify, secretKey);
    return expectedSignature === receivedSignature;
  } catch (error) {
    console.error("Signature verification error:", error);
    return false;
  }
}

/**
 * Mã đơn gửi PayOS, cũng là khoá của `weddings.payment_order_id` (UNIQUE) và của
 * lượt mã giảm giá trong `promo_redemptions.order_id`.
 *
 * 9 chữ số cuối của epoch ms + 5 chữ số ngẫu nhiên = 14 chữ số (PayOS nhận
 * orderCode tới 9007199254740991 nên còn thừa xa).
 *
 * Phần ngẫu nhiên là BẮT BUỘC: chỉ dùng thời gian thì hai request trong cùng một
 * mili giây ra cùng orderCode, và khi đó request thứ hai bị `cx_promo_reserve`
 * nhận nhầm là "đơn cũ gọi lại", rồi lúc PayOS từ chối orderCode trùng nó sẽ
 * nhả mất lượt mã giảm giá của request thứ nhất.
 */
function newOrderCode(): number {
  const timePart = Date.now().toString().slice(-9);
  const randPart = String(crypto.getRandomValues(new Uint32Array(1))[0] % 100000).padStart(5, "0");
  return parseInt(timePart + randPart, 10);
}

// orderCode do bên gọi sinh và truyền vào: mã giảm giá phải giữ chỗ theo order_id
// TRƯỚC khi gọi PayOS, để PayOS lỗi thì còn biết đường nhả lượt.
async function createPaymentRequest(orderData: any, apiKey: string, clientId: string, checksumKey: string): Promise<any> {
  const orderCode = orderData.orderCode;
  const requestData = {
    orderCode,
    amount: orderData.amount,
    description: `TT Thiep Cuoi ${orderCode}`,
    returnUrl: orderData.returnUrl,
    cancelUrl: orderData.cancelUrl,
  };
  
  const signature = await generateSignature(requestData, checksumKey);
  
  const response = await fetch(`${PAYOS_API_BASE}/v2/payment-requests`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-client-id": clientId,
      "x-api-key": apiKey,
    },
    body: JSON.stringify({ ...requestData, signature }),
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.desc || `PayOS API error: ${response.status}`);
  }
  
  const result = await response.json();
  if (result.code !== "00") {
    throw new Error(result.desc || "Payment creation failed");
  }
  
  // Return both result and orderCode for saving to database
  return { ...result, orderCode };
}

function getPayOSCredentials() {
  const apiKey = Deno.env.get("PAYOS_API_KEY");
  const clientId = Deno.env.get("PAYOS_CLIENT_ID");
  const checksumKey = Deno.env.get("PAYOS_CHECKSUM_KEY");
  
  if (!apiKey || !clientId || !checksumKey) {
    throw new Error("Missing PayOS credentials. Please set PAYOS_API_KEY, PAYOS_CLIENT_ID, and PAYOS_CHECKSUM_KEY in Supabase Secrets.");
  }
  
  return { apiKey, clientId, checksumKey };
}

// Danh tính người áp mã. Dùng để chặn một người ôm nhiều lượt cùng lúc và để
// gác mã giảm 100% (chỉ chấp nhận uid:), nên KHÔNG chỉ là thông tin tra cứu.
// Ưu tiên user_id từ JWT, khách chưa đăng nhập thì lấy email trong form.
async function resolveUserKey(req: Request, supabaseClient: any, email?: string): Promise<string | null> {
  const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (jwt && jwt !== Deno.env.get("SUPABASE_ANON_KEY")) {
    try {
      const { data } = await supabaseClient.auth.getUser(jwt);
      if (data?.user?.id) return `uid:${data.user.id}`;
    } catch (error) {
      console.error("resolveUserKey failed:", error);
    }
  }
  const clean = (email || "").trim().toLowerCase();
  return clean ? `email:${clean}` : null;
}

async function getUniqueSlug(supabaseClient: any, baseSlug: string, excludeId?: string): Promise<string> {
  let finalSlug = baseSlug;
  let suffix = 1;
  
  while (true) {
    let query = supabaseClient
      .from("weddings")
      .select("id")
      .eq("slug", finalSlug);
    
    // Exclude current record if updating
    if (excludeId) {
      query = query.neq("id", excludeId);
    }
    
    const { data: existing } = await query.maybeSingle();
    
    if (!existing) break;
    
    suffix++;
    finalSlug = `${baseSlug}-${suffix}`;
  }
  
  return finalSlug;
}

serve(withAxiom("payment-handler", async (req, log) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname;
    log.info("payment.route", { path });
    
    // For webhook endpoint, we don't need Supabase client with auth
    // PayOS webhook doesn't send Authorization header
    const isWebhook = path.endsWith("/webhook");
    
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      isWebhook ? Deno.env.get("SUPABASE_ANON_KEY") ?? "" : Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    if (req.method === "POST" && path.endsWith("/create-payment")) {
      return await handleCreatePayment(req, supabaseClient);
    } else if (req.method === "GET" && path.endsWith("/check-payment-status")) {
      return await handleCheckPaymentStatus(req, supabaseClient);
    } else if (path.endsWith("/webhook")) {
      // Support both GET (for PayOS verification) and POST (for actual webhook)
      if (req.method === "GET") {
        return new Response(JSON.stringify({ message: "Webhook endpoint is active" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } else if (req.method === "POST") {
        return await handleWebhook(req, supabaseClient);
      }
    } else {
      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (error) {
    log.error("payment.error", { error: error.message });
    return new Response(JSON.stringify({ error: error.message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}));

async function handleCreatePayment(req: Request, supabaseClient: any) {
  // Đơn đang giữ lượt mã giảm giá. Khai ngoài try để catch cuối cùng nhả được
  // lượt: hỏng ở bất kỳ bước nào sau khi trừ lượt thì khách còn chưa nhìn thấy
  // mã QR, không thể tính là đã dùng mã. (Bỏ ngang SAU khi có QR thì mất lượt —
  // ca đó không đi qua đây.)
  let reservedOrderId: string | null = null;
  const releasePromo = async () => {
    if (!reservedOrderId) return;
    const { error } = await supabaseClient.rpc("cx_promo_release", { p_order_id: reservedOrderId });
    if (error) console.error("Promo release failed:", reservedOrderId, error);
    reservedOrderId = null;
  };

  try {
    const body = await req.json();
    const { manage_id, customer_name, customer_phone, customer_email, template_name, theme, promo_code } = body;

    if (!manage_id || !customer_name || !customer_phone || !template_name) {
      return new Response(JSON.stringify({ error: "Missing required fields: manage_id, customer_name, customer_phone, template_name" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // SECURITY: Get price from database based on theme, not from client
    const theme_name = theme || "template1";
    const { data: pricingData, error: pricingError } = await supabaseClient
      .from("template_pricing")
      .select("price, original_price, template_name")
      .eq("template_name", theme_name)
      .eq("is_active", true)
      .single();

    if (pricingError || !pricingData) {
      console.error("Pricing lookup error:", pricingError);
      return new Response(JSON.stringify({ error: `Template '${theme_name}' not found or inactive` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const basePrice = pricingData.price;

    // Validate amount is positive
    if (basePrice <= 0) {
      return new Response(JSON.stringify({ error: "Invalid price configuration" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Sinh mã đơn TRƯỚC khi gọi PayOS: giữ chỗ mã giảm giá gắn theo order_id này.
    const payosOrderCode = newOrderCode();
    const fullOrderId = `ORDER-${payosOrderCode}`;

    // Trừ ngay một lượt của mã giảm giá (cx_promo_reserve — xem changelogs/RC1.8).
    // Lượt KHÔNG hoàn lại nếu khách bỏ ngang; chỉ nhả khi đơn tạo không thành.
    let discountAmount = 0;
    let appliedPromoCode: string | null = null;
    let userKey: string | null = null;
    if (promo_code) {
      userKey = await resolveUserKey(req, supabaseClient, customer_email);
      const { data: reserve, error: reserveError } = await supabaseClient.rpc("cx_promo_reserve", {
        p_code: promo_code,
        p_manage_id: manage_id,
        p_order_id: fullOrderId,
        p_base_amount: basePrice,
        p_user_key: userKey,
      });

      if (reserveError) {
        console.error("Promo reserve error:", reserveError);
        return new Response(JSON.stringify({ error: "Không kiểm tra được mã giảm giá, vui lòng thử lại" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!reserve?.ok) {
        return new Response(JSON.stringify({
          error: reserve?.message || "Mã giảm giá không dùng được",
          promo_error: reserve?.reason || "invalid",
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      discountAmount = reserve.discount_amount ?? 0;
      appliedPromoCode = reserve.code ?? promo_code;
      reservedOrderId = fullOrderId;
    }

    const paymentAmount = Math.max(0, basePrice - discountAmount);

    // Generate slug from customer name (remove Vietnamese accents) and ensure it's unique
    const removeVietnameseAccents = (str: string): string => {
      return str
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D')
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();
    };
    
    const baseSlug = removeVietnameseAccents(customer_name);
    const finalSlug = await getUniqueSlug(supabaseClient, baseSlug, manage_id);

    const pricingPayload = {
      price: pricingData.price,
      original_price: pricingData.original_price,
      template_name: pricingData.template_name,
      discount_amount: discountAmount,
      final_price: paymentAmount,
    };

    // ── Mã giảm 100%: không có gì để thu ──
    // PayOS không tạo được đơn 0đ nên bỏ qua hẳn cổng thanh toán, tự đánh dấu
    // hoàn tất và gỡ hạn dùng thử (expires_at = null) đúng như webhook vẫn làm.
    if (paymentAmount <= 0) {
      // Nhánh này cấp thẳng sản phẩm mà không qua thanh toán, nên phải biết CHẮC
      // ai nhận: email gõ tay thì bịa được, chỉ user_id từ JWT mới tin được.
      if (!userKey?.startsWith("uid:")) {
        await releasePromo();
        return new Response(JSON.stringify({
          error: "Vui lòng đăng nhập để dùng mã miễn phí này",
          promo_error: "login_required",
        }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Một mốc thời gian duy nhất cho cả bản ghi DB lẫn response, không thì
      // client lưu một giờ, DB một giờ khác.
      const freeTransactionId = `PROMO-${appliedPromoCode}-${payosOrderCode}`;
      const freePaidAt = new Date().toISOString();

      const { error: freeError } = await supabaseClient
        .from("weddings")
        .upsert({
          id: manage_id,
          slug: finalSlug,
          payment_status: "completed",
          payment_order_id: fullOrderId,
          payment_amount: 0,
          payment_time: freePaidAt,
          transaction_id: freeTransactionId,
          expires_at: null,
          theme: theme || "template1",
        }, { onConflict: "id", ignoreDuplicates: false });

      if (freeError) {
        console.error("Failed to save free wedding:", freeError);
        throw new Error("Failed to save payment information");
      }

      const { error: redeemError } = await supabaseClient.rpc("cx_promo_redeem", { p_order_id: fullOrderId });
      if (redeemError) console.error("Promo redeem failed (free order):", redeemError);
      // Đã chốt xong → catch bên dưới không được nhả lượt này nữa.
      reservedOrderId = null;

      await supabaseClient.from("payment_logs").insert({
        order_id: fullOrderId,
        manage_id,
        event_type: "completed",
        payload: { customer_name, customer_phone, customer_email, template_name, amount: 0, promo_code: appliedPromoCode },
      });

      return new Response(JSON.stringify({
        success: true,
        free: true,
        order_id: fullOrderId,
        manage_id,
        slug: finalSlug,
        transaction_id: freeTransactionId,
        payment_time: freePaidAt,
        promo_code: appliedPromoCode,
        pricing: pricingPayload,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payosCredentials = getPayOSCredentials();
    const baseUrl = req.headers.get("origin") || "https://yourdomain.com";

    // Lỗi từ đây trở đi (PayOS từ chối, ghi DB hỏng…) đều rơi xuống catch cuối
    // hàm và nhả lượt mã đã giữ.
    const paymentResponse = await createPaymentRequest(
      {
        orderCode: payosOrderCode,
        amount: paymentAmount,
        returnUrl: `${baseUrl}/payment-success`,
        cancelUrl: `${baseUrl}/payment-cancel`,
      },
      payosCredentials.apiKey,
      payosCredentials.clientId,
      payosCredentials.checksumKey,
    );

    // Upsert wedding record with payment info (insert if not exists, update if exists)
    const { error: upsertError } = await supabaseClient
      .from("weddings")
      .upsert({
        id: manage_id,
        slug: finalSlug,
        payment_status: "pending",
        payment_order_id: fullOrderId,
        payment_amount: paymentAmount,
        theme: theme || "template1",
      }, {
        onConflict: "id",
        ignoreDuplicates: false
      });

    if (upsertError) {
      console.error("Failed to save wedding with payment info:", upsertError);
      throw new Error("Failed to save payment information");
    }

    await supabaseClient.from("payment_logs").insert({
      order_id: fullOrderId,
      manage_id,
      event_type: "created",
      payload: { customer_name, customer_phone, customer_email, template_name, amount: paymentAmount, promo_code: appliedPromoCode },
    });

    return new Response(JSON.stringify({
      success: true,
      order_id: fullOrderId,
      qr_code: paymentResponse.data.qrCode,
      payment_info: {
        bank_name: "PayOS",
        account_number: paymentResponse.data.accountNumber,
        account_name: paymentResponse.data.accountName,
        amount: paymentResponse.data.amount,
        content: paymentResponse.data.description,
      },
      pricing: pricingPayload,
      promo_code: appliedPromoCode,
      checkout_url: paymentResponse.data.checkoutUrl,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Create payment error:", error);
    await releasePromo();
    return new Response(JSON.stringify({ error: error.message || "Failed to create payment" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

async function handleCheckPaymentStatus(req: Request, supabaseClient: any) {
  try {
    const url = new URL(req.url);
    const order_id = url.searchParams.get("order_id");

    if (!order_id) {
      return new Response(JSON.stringify({ error: "Missing order_id parameter" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data, error } = await supabaseClient
      .from("weddings")
      .select("id, slug, payment_status, transaction_id, payment_time")
      .eq("payment_order_id", order_id)
      .single();

    if (error || !data) {
      return new Response(JSON.stringify({ status: "not_found", error: "Payment not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const response: any = { status: data.payment_status || "pending" };
    if (data.payment_status === "completed") {
      response.manage_id = data.id;
      response.slug = data.slug;
      response.transaction_id = data.transaction_id;
      response.payment_time = data.payment_time;
    }

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Check payment status error:", error);
    return new Response(JSON.stringify({ error: error.message || "Failed to check payment status" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

async function handleWebhook(req: Request, supabaseClient: any) {
  try {
    const payload = await req.json();
    const { checksumKey } = getPayOSCredentials();
    const receivedSignature = payload.signature;

    if (!receivedSignature) {
      console.error("Missing signature in webhook");
      return new Response(JSON.stringify({ error: "Missing signature" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isValid = await verifyWebhookSignature(payload, receivedSignature, checksumKey);
    if (!isValid) {
      console.error("Invalid webhook signature");
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (payload.code !== "00") {
      console.log("Payment not successful:", payload.code, payload.desc);
      return new Response(JSON.stringify({ success: true, message: "Payment not successful" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const paymentData = payload.data;
    
    // Get manage_id from database using orderCode
    const fullOrderId = `ORDER-${paymentData.orderCode}`;
    const { data: weddingData, error: fetchError } = await supabaseClient
      .from("weddings")
      .select("id, theme, payment_amount")
      .eq("payment_order_id", fullOrderId)
      .single();

    if (fetchError || !weddingData) {
      console.error("Could not find wedding record for order:", paymentData.orderCode);
      return new Response(JSON.stringify({ error: "Wedding record not found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const manage_id = weddingData.id;
    const theme_name = weddingData.theme || "template1";

    // SECURITY: số tiền kỳ vọng là payment_amount đã chốt lúc tạo đơn (đã trừ mã
    // giảm giá) — do chính backend ghi nên vẫn tin được. Đơn cũ chưa có
    // payment_amount thì rơi về giá niêm yết của theme.
    let expectedAmount = weddingData.payment_amount;
    if (expectedAmount == null) {
      const { data: pricingData, error: pricingError } = await supabaseClient
        .from("template_pricing")
        .select("price")
        .eq("template_name", theme_name)
        .eq("is_active", true)
        .single();

      if (pricingError || !pricingData) {
        console.error("Pricing validation error:", pricingError);
        return new Response(JSON.stringify({ error: "Invalid template pricing" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      expectedAmount = pricingData.price;
    }

    if (paymentData.amount !== expectedAmount) {
      console.error("Amount mismatch. Expected:", expectedAmount, "Got:", paymentData.amount);
      return new Response(JSON.stringify({ error: "Amount mismatch" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: existingPayment } = await supabaseClient
      .from("weddings")
      .select("transaction_id")
      .eq("transaction_id", paymentData.reference)
      .single();

    if (existingPayment) {
      console.log("Duplicate transaction, already processed");
      return new Response(JSON.stringify({ success: true, message: "Already processed" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: updateError } = await supabaseClient
      .from("weddings")
      .update({
        payment_status: "completed",
        transaction_id: paymentData.reference,
        payment_time: new Date(paymentData.transactionDateTime).toISOString(),
        payment_amount: paymentData.amount,
      })
      .eq("id", manage_id);

    if (updateError) {
      console.error("Failed to update payment status:", updateError);
      throw new Error("Database update failed");
    }

    // Tiền đã vào → chốt lượt mã giảm giá đang giữ chỗ. Lỗi thì chỉ ghi log,
    // không được chặn webhook.
    const { error: redeemError } = await supabaseClient.rpc("cx_promo_redeem", { p_order_id: fullOrderId });
    if (redeemError) console.error("Promo redeem failed:", fullOrderId, redeemError);

    await supabaseClient.from("payment_logs").insert({
      order_id: paymentData.orderCode.toString(),
      manage_id,
      event_type: "webhook_received",
      payload: paymentData,
    });

    await supabaseClient.from("payment_logs").insert({
      order_id: paymentData.orderCode.toString(),
      manage_id,
      event_type: "completed",
      payload: { transaction_id: paymentData.reference, amount: paymentData.amount },
    });

    console.log("Payment webhook processed successfully:", manage_id);
    return new Response(JSON.stringify({ success: true, message: "Webhook processed" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Webhook error:", error);
    try {
      await supabaseClient.from("payment_logs").insert({
        order_id: "unknown",
        event_type: "failed",
        payload: { error: error.message },
      });
    } catch (logError) {
      console.error("Failed to log error:", logError);
    }
    return new Response(JSON.stringify({ error: error.message || "Webhook processing failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}
