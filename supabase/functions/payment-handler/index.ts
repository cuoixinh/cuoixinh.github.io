import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createDbClient } from "../_shared/db-client.ts";
import { withAxiom, type Logger } from "../_shared/axiom.ts";
import {
  checkWeddingLimit,
  MAX_WEDDINGS_PER_USER,
  WEDDING_LIMIT_MESSAGE,
} from "../_shared/wedding-limits.ts";
import { getUniqueSlug } from "../_shared/slug-holds.ts";
import {
  currentPlan,
  isPlanId,
  planExpiry,
  PLANS,
  quotePlans,
  type PlanId,
} from "../_shared/plans.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PAYOS_API_BASE = "https://api-merchant.payos.vn";

// Miền được phép làm gốc cho returnUrl/cancelUrl của đơn PayOS. Giữ khớp với
// ALLOWED_ORIGINS ở wedding-admin / guest-handler / _shared/ai-provider.ts.
const ALLOWED_BASE_URLS = [
  "https://cuoixinh.com",
  "https://www.cuoixinh.com",
  "https://staging.cuoixinh.com",
];

function allowedBaseUrl(origin: string | null): string {
  if (!origin) return ALLOWED_BASE_URLS[0];
  if (ALLOWED_BASE_URLS.includes(origin)) return origin;
  // Trang admin chỉ chạy local, vẫn cần tạo đơn thử.
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return origin;
  return ALLOWED_BASE_URLS[0];
}

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
    // PayOS chặn description quá 25 ký tự, orderCode đã chiếm 14 → tiền tố tối đa
    // 11 ký tự. "TT Thiep " (9) + 14 = 23. Đổi tiền tố phải đếm lại, KHÔNG cắt
    // chuỗi: description là nội dung chuyển khoản, mất số là mất căn cứ đối soát.
    description: `TT Thiep ${orderCode}`,
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
// user_id từ JWT, hoặc null nếu chưa đăng nhập / chỉ gửi anon key.
// Khác `resolveUserKey`: hàm này KHÔNG lùi về email, vì nó dùng để xét QUYỀN.
async function resolveAuthUserId(req: Request, supabaseClient: any): Promise<string | null> {
  const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!jwt || jwt === Deno.env.get("SUPABASE_ANON_KEY")) return null;
  try {
    const { data, error } = await supabaseClient.auth.getUser(jwt);
    if (error) return null;
    return data?.user?.id ?? null;
  } catch {
    return null;
  }
}

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

serve(withAxiom("payment-handler", async (req, log) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname;
    log.info("payment.route", { path });
    
    const supabaseClient = createDbClient(log, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

    if (req.method === "POST" && path.endsWith("/create-payment")) {
      return await handleCreatePayment(req, supabaseClient, log);
    } else if (req.method === "POST" && path.endsWith("/quote")) {
      return await handleQuote(req, supabaseClient, log);
    } else if (req.method === "GET" && path.endsWith("/check-payment-status")) {
      return await handleCheckPaymentStatus(req, supabaseClient, log);
    } else {
      // Webhook PayOS KHÔNG còn ở đây — chỉ một đường là Edge Function payos-webhook
      // (qua cloudflare-worker/payos-webhook-proxy.js). Đường cũ chốt đơn mà không
      // biết gói/nâng gói nên đã gỡ (docs/security-checklist.md A30).
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

const JSON_HEADERS = { ...corsHeaders, "Content-Type": "application/json" };

async function fetchActivePricing(supabaseClient: any, theme: string) {
  return await supabaseClient
    .from("template_pricing")
    .select("price, original_price, template_name")
    .eq("template_name", theme)
    .eq("is_active", true)
    .maybeSingle();
}

// Báo giá ba gói cho màn thanh toán. Có manage_id của thiệp ĐÃ thanh toán mà người
// gọi là chủ → báo giá NÂNG gói (phần chênh) theo mẫu đang lưu; còn lại là mua mới.
async function handleQuote(req: Request, supabaseClient: any, log: Logger) {
  const body = await req.json().catch(() => ({}));
  let theme: string = body.theme || "template1";
  let from: PlanId | null = null;
  let curExpires: string | null = null;

  const buyerId = body.manage_id ? await resolveAuthUserId(req, supabaseClient) : null;
  if (body.manage_id && buyerId) {
    const { data: row, error } = await supabaseClient
      .from("weddings")
      .select("user_id, theme, payment_status, plan, plan_expires_at")
      .eq("id", body.manage_id)
      .maybeSingle();
    if (error) {
      log.error("payment.quote_wedding_failed", { manage_id: body.manage_id, code: error.code, message: error.message });
      return new Response(JSON.stringify({ error: "Không tải được thông tin thiệp" }), { status: 500, headers: JSON_HEADERS });
    }
    if (row && row.user_id === buyerId) {
      from = currentPlan(row);
      if (from) {
        theme = row.theme || theme;
        curExpires = row.plan_expires_at;
      }
    }
  }

  const { data: pricing, error: pricingError } = await fetchActivePricing(supabaseClient, theme);
  if (pricingError) {
    log.error("payment.quote_pricing_failed", { theme, code: pricingError.code, message: pricingError.message });
    return new Response(JSON.stringify({ error: "Không tải được bảng giá" }), { status: 500, headers: JSON_HEADERS });
  }
  if (!pricing || !(pricing.price > 0)) {
    return new Response(JSON.stringify({ error: "Mẫu chưa có giá", code: "NO_PRICING" }), { status: 404, headers: JSON_HEADERS });
  }

  return new Response(JSON.stringify({
    theme,
    current_plan: from,
    plan_expires_at: from ? curExpires : null,
    plans: quotePlans(pricing.price, pricing.original_price, from, curExpires),
  }), { status: 200, headers: JSON_HEADERS });
}

async function handleCreatePayment(req: Request, supabaseClient: any, log: Logger) {
  // Đơn đang giữ lượt mã giảm giá. Khai ngoài try để catch cuối cùng nhả được
  // lượt: hỏng ở bất kỳ bước nào sau khi trừ lượt thì khách còn chưa nhìn thấy
  // mã QR, không thể tính là đã dùng mã. (Bỏ ngang SAU khi có QR thì mất lượt —
  // ca đó không đi qua đây.)
  let reservedOrderId: string | null = null;
  // Slug thiệp đang có (nếu thiệp đã tồn tại). Đơn thanh toán KHÔNG được đặt lại
  // slug của thiệp đã có: link đã phát cho khách mời sẽ chết.
  let existingSlug: string | null = null;
  const releasePromo = async () => {
    if (!reservedOrderId) return;
    const { error } = await supabaseClient.rpc("cx_promo_release", { p_order_id: reservedOrderId });
    if (error) log.error("payment.promo_release_failed", { order_id: reservedOrderId, message: error.message });
    reservedOrderId = null;
  };

  try {
    const body = await req.json();
    const { manage_id, customer_name, customer_phone, customer_email, template_name, theme, promo_code, plan } = body;

    // Client cũ (chưa có bước chọn gói) không gửi plan: đừng đoán thay khách — đoán
    // 3 tháng là khách tưởng mua trọn đời, đoán vĩnh viễn là QR khác số đang hiện.
    if (!isPlanId(plan)) {
      log.warn("payment.plan_missing", { plan });
      return new Response(JSON.stringify({
        error: "Vui lòng tải lại trang và chọn gói thiệp",
        code: "PLAN_REQUIRED",
      }), { status: 400, headers: JSON_HEADERS });
    }
    // Thiệp đã thanh toán → đơn này là NÂNG gói (đặt ở phép kiểm quyền bên dưới).
    let upgrade: { from: PlanId; theme: string; planExpiresAt: string | null; paidAmount: number } | null = null;

    // customer_phone KHÔNG bắt buộc: màn thanh toán lấy người mua thẳng từ tài
    // khoản đang đăng nhập, mà cả hai đường đăng nhập (OTP email, Google) đều
    // không có số điện thoại → bắt buộc là chặn đúng mọi đơn. Số này chỉ ghi vào
    // payload của payment_logs, PayOS không dùng tới.
    // ── Quyền với `manage_id` ────────────────────────────────────────────────
    // BẮT BUỘC: hàm này `upsert` thẳng vào `weddings` theo id client gửi lên. Bỏ
    // phép kiểm này là ai cũng lấy được `id` từ `GET ?slug=` công khai rồi ghi đè
    // slug/theme/trạng thái thanh toán của thiệp người khác
    // (xem docs/security-checklist.md A2).
    const buyerId = await resolveAuthUserId(req, supabaseClient);
    if (!buyerId) {
      return new Response(JSON.stringify({
        error: "Vui lòng đăng nhập để thanh toán",
        code: "AUTH_REQUIRED",
      }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (manage_id) {
      const { data: owned, error: ownedError } = await supabaseClient
        .from("weddings")
        .select("user_id, slug, theme, payment_status, payment_amount, plan, plan_expires_at")
        .eq("id", manage_id)
        .maybeSingle();

      // Phép kiểm quyền hỏng là DỪNG: coi như "chưa có hàng" thì upsert bên dưới
      // gán user_id người gọi đè lên thiệp của người khác.
      if (ownedError) {
        log.error("payment.owner_check_failed", {
          manage_id, code: ownedError.code, message: ownedError.message,
        });
        return new Response(JSON.stringify({ error: "Không kiểm tra được thiệp, vui lòng thử lại" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Thiệp đã có chủ mà không phải người đang gọi → chặn. Thiệp chưa có chủ
      // (nháp cũ) thì người thanh toán nhận làm chủ luôn.
      if (owned && owned.user_id && owned.user_id !== buyerId) {
        log.warn("payment.manage_id_forbidden", { manage_id, buyerId });
        return new Response(JSON.stringify({
          error: "Bạn không có quyền thanh toán cho thiệp này",
          code: "FORBIDDEN",
        }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      existingSlug = owned?.slug ?? null;

      const from = owned ? currentPlan(owned) : null;
      if (from) {
        upgrade = {
          from,
          theme: owned.theme || "template1",
          planExpiresAt: owned.plan_expires_at ?? null,
          paidAmount: owned.payment_amount ?? 0,
        };
      }

      // Trần số thiệp/tài khoản. Hàm này `upsert` nên một manage_id CHƯA có hàng
      // DB chính là một đường TẠO thiệp nữa, đi vòng qua chốt ở wedding-admin —
      // thiếu chỗ này thì cứ vào thẳng màn thanh toán là tạo được thiệp mới.
      // Thiệp đã tồn tại thì trả tiền bình thường: trần chặn việc tạo thêm, không
      // chặn thanh toán cho thiệp đang có.
      if (!owned) {
        const limit = await checkWeddingLimit(supabaseClient, buyerId);
        if (limit.error) {
          log.error("payment.count_failed", { error: limit.error });
          return new Response(JSON.stringify({ error: limit.error }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (limit.reached) {
          log.warn("payment.wedding_limit", { buyerId, count: limit.count });
          return new Response(JSON.stringify({
            error: WEDDING_LIMIT_MESSAGE,
            code: "WEDDING_LIMIT",
            limit: MAX_WEDDINGS_PER_USER,
          }), {
            status: 409,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    const missing = { manage_id, customer_name, template_name };
    const missingKeys = Object.keys(missing).filter((k) => !missing[k as keyof typeof missing]);

    if (missingKeys.length) {
      // Log ĐÍCH DANH field thiếu: câu 400 chung chung không cho biết client hỏng ở đâu.
      log.warn("payment.missing_fields", { missing: missingKeys, has_phone: !!customer_phone });
      return new Response(JSON.stringify({
        error: `Thiếu thông tin bắt buộc: ${missingKeys.join(", ")}`,
        missing: missingKeys,
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // SECURITY: Get price from database based on theme, not from client
    // Nâng gói thì tính theo mẫu ĐANG LƯU (đã khoá từ lúc thanh toán), không theo
    // theme client gửi — gửi mẫu rẻ hơn là trả phần chênh ít hơn.
    const theme_name = upgrade ? upgrade.theme : (theme || "template1");
    const { data: pricingData, error: pricingError } = await fetchActivePricing(supabaseClient, theme_name);

    if (pricingError || !pricingData) {
      // Hai ca khác hẳn nhau nên phải phân biệt được trên Axiom: truy vấn hỏng,
      // hay mẫu thật sự không có hàng giá đang bật.
      log.error("payment.pricing_lookup_failed", {
        theme: theme_name,
        found: !!pricingData,
        code: pricingError?.code,
        message: pricingError?.message,
      });
      return new Response(JSON.stringify({ error: `Template '${theme_name}' not found or inactive` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate amount is positive
    if (!(pricingData.price > 0)) {
      return new Response(JSON.stringify({ error: "Invalid price configuration" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Số tiền của lượt này: giá gói khi mua mới, phần chênh khi nâng gói — cùng một
    // phép tính với màn báo giá (quotePlans), kể cả luật gói nào được nâng.
    const quote = quotePlans(
      pricingData.price,
      pricingData.original_price,
      upgrade?.from ?? null,
      upgrade?.planExpiresAt,
    ).find((q) => q.id === plan)!;
    if (!quote.available) {
      log.warn("payment.plan_unavailable", { manage_id, plan, from: upgrade?.from, reason: quote.reason });
      return new Response(JSON.stringify({
        error: quote.reason === "too_late"
          ? "Gói này đã quá hạn để nâng, vui lòng chọn gói Vĩnh viễn"
          : "Thiệp đang ở gói này hoặc gói cao hơn",
        code: "PLAN_UNAVAILABLE",
      }), { status: 409, headers: JSON_HEADERS });
    }
    const basePrice = quote.amount;
    // Trường gói ghi khi đơn HOÀN TẤT (đơn 0đ ghi ngay, đơn PayOS do webhook ghi).
    const planDoneFields = () => ({
      plan,
      plan_expires_at: planExpiry(upgrade?.from ?? null, upgrade?.planExpiresAt, plan),
      pending_plan: null,
      pending_amount: null,
      pending_theme: null,
      expires_at: null,
    });

    // Sinh mã đơn TRƯỚC khi gọi PayOS: giữ chỗ mã giảm giá gắn theo order_id này.
    const payosOrderCode = newOrderCode();
    const fullOrderId = `ORDER-${payosOrderCode}`;

    // Trừ ngay một lượt của mã giảm giá (cx_promo_reserve — xem changelogs/RC1.8).
    // Lượt KHÔNG hoàn lại nếu khách bỏ ngang; chỉ nhả khi đơn tạo không thành.
    let discountAmount = 0;
    let appliedPromoCode: string | null = null;
    // Áp mã = BỎ mọi ưu đãi khác (ưu đãi ra mắt): đơn tính lại từ GIÁ GỐC của gói
    // rồi mới trừ mã — cả % lẫn đơn tối thiểu đều xét trên giá gốc. Đơn nâng gói
    // không có giá gốc → giữ số phải trả.
    const promoBase = promo_code ? (quote.original_price ?? basePrice) : basePrice;
    let userKey: string | null = null;
    if (promo_code) {
      userKey = await resolveUserKey(req, supabaseClient, customer_email);
      const { data: reserve, error: reserveError } = await supabaseClient.rpc("cx_promo_reserve", {
        p_code: promo_code,
        p_manage_id: manage_id,
        p_order_id: fullOrderId,
        p_base_amount: promoBase,
        p_user_key: userKey,
      });

      if (reserveError) {
        log.error("payment.promo_reserve_failed", { order_id: fullOrderId, promo_code, message: reserveError.message });
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

    const paymentAmount = Math.max(0, promoBase - discountAmount);

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
    
    // Thiệp đã có slug thì GIỮ NGUYÊN — khách có thể đã chia sẻ link rồi. Slug mới đi
    // qua luật chung (_shared/slug-holds.ts): tránh cả slug đang bị giữ cho người khác,
    // không thì trả tiền là chiếm được link của thiệp dùng thử đã xoá.
    const baseSlug = removeVietnameseAccents(customer_name);
    const finalSlug = existingSlug ||
      (await getUniqueSlug(supabaseClient, baseSlug, { ownerId: buyerId, excludeId: manage_id, log }));

    const pricingPayload = {
      price: quote.amount,
      original_price: quote.original_price,
      template_name: pricingData.template_name,
      plan,
      upgrade_from: upgrade?.from ?? null,
      discount_amount: discountAmount,
      final_price: paymentAmount,
    };

    // ── Mã giảm 100%: không có gì để thu ──
    // PayOS không tạo được đơn 0đ nên bỏ qua hẳn cổng thanh toán, tự đánh dấu
    // hoàn tất và gỡ hạn dùng thử (expires_at = null) đúng như webhook vẫn làm.
    // Áp mã là BỎ ưu đãi ra mắt; mã nhỏ hơn ưu đãi đó thì khách trả ĐẮT hơn không
    // dùng mã → từ chối và nhả lượt, đừng thu tiền nhiều hơn giá đang bán.
    if (appliedPromoCode && promoBase > basePrice && paymentAmount >= basePrice) {
      await releasePromo();
      return new Response(JSON.stringify({
        error: `Mã này ít ưu đãi hơn giá đang giảm (${basePrice.toLocaleString("vi-VN")}đ) nên không áp dụng`,
        promo_error: "no_benefit",
      }), { status: 400, headers: JSON_HEADERS });
    }

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

      // Nâng gói: hàng đã có, chỉ đổi gói + mốc giao dịch (slug/mẫu đã chốt).
      const { error: freeError } = upgrade
        ? await supabaseClient
          .from("weddings")
          .update({
            ...planDoneFields(),
            payment_order_id: fullOrderId,
            payment_time: freePaidAt,
            transaction_id: freeTransactionId,
          })
          .eq("id", manage_id)
        : await supabaseClient
          .from("weddings")
          .upsert({
            id: manage_id,
            user_id: buyerId,
            slug: finalSlug,
            payment_status: "completed",
            payment_order_id: fullOrderId,
            payment_amount: 0,
            payment_time: freePaidAt,
            transaction_id: freeTransactionId,
            ...planDoneFields(),
            theme: theme || "template1",
          }, { onConflict: "id", ignoreDuplicates: false });

      if (freeError) {
        log.error("payment.free_upsert_failed", { order_id: fullOrderId, manage_id, message: freeError.message });
        throw new Error("Failed to save payment information");
      }

      const { error: redeemError } = await supabaseClient.rpc("cx_promo_redeem", { p_order_id: fullOrderId });
      if (redeemError) log.error("payment.promo_redeem_failed", { order_id: fullOrderId, free: true, message: redeemError.message });
      // Đã chốt xong → catch bên dưới không được nhả lượt này nữa.
      reservedOrderId = null;

      await supabaseClient.from("payment_logs").insert({
        order_id: fullOrderId,
        manage_id,
        event_type: "completed",
        payload: { customer_name, customer_phone, customer_email, template_name, amount: 0, promo_code: appliedPromoCode, plan, upgrade_from: upgrade?.from ?? null },
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
    // returnUrl/cancelUrl đi vào đơn PayOS nên không nhận Origin tuỳ ý — chỉ các
    // miền của hệ thống (khớp ALLOWED_ORIGINS của các function khác).
    const baseUrl = allowedBaseUrl(req.headers.get("origin"));

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

    // Nâng gói KHÔNG được đụng payment_status/payment_amount: thiệp đang là
    // "completed", hạ về "pending" là mở khoá đổi mẫu, và đơn bỏ ngang thì thiệp hết
    // hạn gói không bao giờ bị khoá nữa (luật khoá gói chỉ xét hàng "completed").
    const { error: upsertError } = upgrade
      ? await supabaseClient
        .from("weddings")
        .update({
          payment_order_id: fullOrderId,
          pending_plan: plan,
          pending_amount: paymentAmount,
          pending_theme: theme_name,
        })
        .eq("id", manage_id)
      : await supabaseClient
        .from("weddings")
        .upsert({
          id: manage_id,
          user_id: buyerId,
          slug: finalSlug,
          payment_status: "pending",
          payment_order_id: fullOrderId,
          payment_amount: paymentAmount,
          pending_plan: plan,
          pending_amount: paymentAmount,
          // Mẫu ĐÃ BÁO GIÁ cho đơn này: thiệp chưa trả tiền vẫn đổi mẫu được, nên
          // webhook đặt lại theme theo cột này — trả giá mẫu nào nhận mẫu đó (A29).
          pending_theme: theme_name,
          theme: theme || "template1",
        }, {
          onConflict: "id",
          ignoreDuplicates: false
        });

    if (upsertError) {
      log.error("payment.upsert_failed", { order_id: fullOrderId, manage_id, message: upsertError.message });
      throw new Error("Failed to save payment information");
    }

    await supabaseClient.from("payment_logs").insert({
      order_id: fullOrderId,
      manage_id,
      event_type: "created",
      payload: { customer_name, customer_phone, customer_email, template_name, amount: paymentAmount, promo_code: appliedPromoCode, plan, upgrade_from: upgrade?.from ?? null },
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
    log.error("payment.create_failed", { message: error.message });
    await releasePromo();
    return new Response(JSON.stringify({ error: error.message || "Failed to create payment" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

async function handleCheckPaymentStatus(req: Request, supabaseClient: any, log: Logger) {
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
      .select("id, slug, payment_status, pending_plan, transaction_id, payment_time")
      .eq("payment_order_id", order_id)
      .single();

    if (error || !data) {
      return new Response(JSON.stringify({ status: "not_found", error: "Payment not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Đơn còn treo pending_plan là CHƯA trả xong — kể cả đơn nâng gói của thiệp đã
    // "completed" từ trước (không xét thì màn QR báo xong ngay khi chưa trả).
    const response: any = { status: data.pending_plan ? "pending" : (data.payment_status || "pending") };
    if (response.status === "completed") {
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
    log.error("payment.status_check_failed", { message: error.message });
    return new Response(JSON.stringify({ error: error.message || "Failed to check payment status" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}
