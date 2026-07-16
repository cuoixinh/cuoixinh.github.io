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

async function createPaymentRequest(orderData: any, apiKey: string, clientId: string, checksumKey: string): Promise<any> {
  const orderCode = parseInt(Date.now().toString().slice(-9));
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
  try {
    const body = await req.json();
    const { manage_id, customer_name, customer_phone, customer_email, template_name, theme } = body;

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

    const paymentAmount = pricingData.price;

    // Validate amount is positive
    if (paymentAmount <= 0) {
      return new Response(JSON.stringify({ error: "Invalid price configuration" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payosCredentials = getPayOSCredentials();
    const baseUrl = req.headers.get("origin") || "https://yourdomain.com";

    const paymentResponse = await createPaymentRequest(
      {
        amount: paymentAmount,
        returnUrl: `${baseUrl}/payment-success`,
        cancelUrl: `${baseUrl}/payment-cancel`,
      },
      payosCredentials.apiKey,
      payosCredentials.clientId,
      payosCredentials.checksumKey,
    );

    // Use orderCode from PayOS response (this is what PayOS will send in webhook)
    const payosOrderCode = paymentResponse.orderCode;
    const fullOrderId = `ORDER-${payosOrderCode}`;

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
      payload: { customer_name, customer_phone, customer_email, template_name, amount: paymentAmount },
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
      pricing: {
        price: pricingData.price,
        original_price: pricingData.original_price,
        template_name: pricingData.template_name,
      },
      checkout_url: paymentResponse.data.checkoutUrl,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Create payment error:", error);
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
    const { data: weddingData, error: fetchError } = await supabaseClient
      .from("weddings")
      .select("id")
      .eq("payment_order_id", `ORDER-${paymentData.orderCode}`)
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

    // SECURITY: Validate amount from database pricing based on theme
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

    if (paymentData.amount !== pricingData.price) {
      console.error("Amount mismatch. Expected:", pricingData.price, "Got:", paymentData.amount);
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
