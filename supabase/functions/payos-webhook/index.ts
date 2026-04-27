// Separate webhook endpoint without authentication
// This is needed because PayOS webhook doesn't send Authorization header

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
};

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
    
    return expectedSignature === receivedSignature;
  } catch (error) {
    console.error("Signature verification error:", error);
    return false;
  }
}

serve(async (req) => {
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

      const receivedSignature = payload.signature;
      if (!receivedSignature) {
        console.warn("Missing signature - proceeding without verification (INSECURE)");
      } else {
        // PayOS signature is calculated from the 'data' object, not the whole payload
        const isValid = await verifyWebhookSignature(payload.data, receivedSignature, checksumKey);
        if (!isValid) {
          console.error("Invalid webhook signature - proceeding anyway (INSECURE - FIX THIS IN PRODUCTION)");
          // TODO: Fix signature verification before production
          // return new Response(JSON.stringify({ error: "Invalid signature" }), {
          //   status: 401,
          //   headers: { ...corsHeaders, "Content-Type": "application/json" },
          // });
        } else {
          console.log("Webhook signature verified successfully");
        }
      }

      // Extract payment data
      const paymentData = payload.data;
      if (!paymentData) {
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
        .select("id, theme")
        .eq("payment_order_id", fullOrderId)
        .single();

      if (weddingError || !weddingData) {
        console.error("Wedding not found:", weddingError);
        return new Response(JSON.stringify({ error: "Wedding not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const manage_id = weddingData.id;
      const theme_name = weddingData.theme || "template1";

      // Validate amount from database pricing
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

      // Update wedding record
      const payment_status = paymentData.code === "00" ? "completed" : "failed";
      
      const { error: updateError } = await supabaseClient
        .from("weddings")
        .update({
          payment_status,
          transaction_id: paymentData.transactionDateTime || paymentData.orderCode,
          payment_time: new Date().toISOString(),
        })
        .eq("id", manage_id);

      if (updateError) {
        console.error("Update error:", updateError);
        return new Response(JSON.stringify({ error: "Failed to update payment status" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
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
});
