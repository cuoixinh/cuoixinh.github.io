import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createDbClient } from "../_shared/db-client.ts";
import { withAxiom, type Logger } from "../_shared/axiom.ts";
import {
  checkWeddingLimit,
  MAX_WEDDINGS_PER_USER,
  WEDDING_LIMIT_MESSAGE,
  hasOtherFreeWedding,
} from "../_shared/wedding-limits.ts";
import { getUniqueSlug } from "../_shared/slug-holds.ts";
import {
  addonBuyableSides,
  currentPlan,
  GUEST_ADDON,
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
    } else if (req.method === "POST" && path.endsWith("/create-guest-addon")) {
      return await handleCreateGuestAddon(req, supabaseClient, log);
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
  // Thẻ "Miễn phí" ở màn thanh toán: chỉ với thiệp của chính người gọi, chưa thanh
  // toán. used = tài khoản đã có thiệp Miễn phí khác (thẻ hiện nhưng khoá), current =
  // thiệp này đang ở gói Miễn phí. Kiểm hỏng thì khoá thẻ (fail-closed).
  let free: { available: boolean; reason?: "used" | "current" } | null = null;

  const buyerId = body.manage_id ? await resolveAuthUserId(req, supabaseClient) : null;
  if (body.manage_id && buyerId) {
    const { data: row, error } = await supabaseClient
      .from("weddings")
      .select("user_id, theme, payment_status, plan, plan_expires_at, free_side")
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
      } else if (row.free_side) {
        free = { available: false, reason: "current" };
      } else {
        const other = await hasOtherFreeWedding(supabaseClient, buyerId, body.manage_id);
        if (other.error) {
          log.error("payment.quote_free_check_failed", { manage_id: body.manage_id, message: other.error });
          free = { available: false, reason: "used" };
        } else {
          free = other.exists ? { available: false, reason: "used" } : { available: true };
        }
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
    free,
    // Khối "Thêm khách mời" của màn thanh toán (mua kèm đơn gói, cộng vào cùng mã QR).
    guest_addon: { guests: GUEST_ADDON.guests, price: GUEST_ADDON.price, max_packs: GUEST_ADDON.maxPacks },
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
    // Ô "cho hiện thiệp ở trang chủ" của màn thanh toán. Chỉ ghi khi mua lần đầu (nhánh
    // nâng gói không đụng) — đã thanh toán thì chỉ admin-support đổi. Client cũ không gửi = false.
    const showcaseConsent = body.showcase_consent === true;
    // Khách mua thêm kèm đơn gói ({groom, bride} = số gói mỗi bên). Giá cố định, KHÔNG áp
    // mã giảm giá; cộng vào cùng đơn PayOS, payos-webhook chốt theo plan_order_id.
    const addonPacks = parseAddonPacks(body.guest_addons);
    if (!addonPacks) {
      return new Response(JSON.stringify({
        error: `Số gói thêm khách mỗi bên từ 0 tới ${GUEST_ADDON.maxPacks}`,
      }), { status: 400, headers: JSON_HEADERS });
    }
    const addonAmount = (addonPacks.groom + addonPacks.bride) * GUEST_ADDON.price;

    // Client cũ (chưa có bước chọn gói) không gửi plan: đừng đoán thay khách — đoán
    // sai gói là QR khác số đang hiện.
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
    ).find((q) => q.id === plan);
    if (!quote || !quote.available) {
      log.warn("payment.plan_unavailable", { manage_id, plan, from: upgrade?.from, reason: quote?.reason });
      return new Response(JSON.stringify({
        error: !quote
          ? "Gói không hợp lệ, vui lòng chọn gói Premium hoặc Forever"
          : quote.reason === "too_late"
            ? "Gói này đã quá hạn để nâng, vui lòng chọn gói Forever"
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

    // Phần của GÓI (sau mã) tách khỏi phần khách mua thêm: mọi luật về mã giảm giá chỉ xét
    // phần gói; đơn còn khách mua thêm thì luôn có tiền để thu → luôn qua PayOS.
    const planPay = Math.max(0, promoBase - discountAmount);
    const paymentAmount = planPay + addonAmount;

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
      guest_addons: addonAmount ? { ...addonPacks, guests_per_pack: GUEST_ADDON.guests, amount: addonAmount } : null,
      final_price: paymentAmount,
    };

    // ── Mã giảm 100%: không có gì để thu ──
    // PayOS không tạo được đơn 0đ nên bỏ qua hẳn cổng thanh toán, tự đánh dấu
    // hoàn tất và gỡ hạn dùng thử (expires_at = null) đúng như webhook vẫn làm.
    // Áp mã là BỎ ưu đãi ra mắt; mã nhỏ hơn ưu đãi đó thì khách trả ĐẮT hơn không
    // dùng mã → từ chối và nhả lượt, đừng thu tiền nhiều hơn giá đang bán.
    if (appliedPromoCode && promoBase > basePrice && planPay >= basePrice) {
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
            showcase_consent: showcaseConsent,
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
          // payment_amount = tiền GÓI; khách mua thêm chỉ nằm ở guest_addons.amount.
          // pending_amount = tổng cả đơn PayOS (webhook đối chiếu số tiền theo cột này).
          payment_amount: planPay,
          showcase_consent: showcaseConsent,
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

    // Hàng khách mua thêm ghi SAU hàng weddings (khoá ngoại) và trước khi trả QR: hỏng thì
    // rơi xuống catch, khách không thấy mã nên không trả được đơn thiếu phần khách.
    const addonRows = (["groom", "bride"] as const)
      .filter((side) => addonPacks[side] > 0)
      .map((side) => ({
        wedding_id: manage_id,
        order_id: `${fullOrderId}-${side}`,
        plan_order_id: fullOrderId,
        side,
        packs: addonPacks[side],
        guests: addonPacks[side] * GUEST_ADDON.guests,
        amount: addonPacks[side] * GUEST_ADDON.price,
        user_id: buyerId,
      }));
    if (addonRows.length) {
      const { error: addonErr } = await supabaseClient.from("guest_addons").insert(addonRows);
      if (addonErr) {
        log.error("payment.addon_insert_failed", { order_id: fullOrderId, manage_id, code: addonErr.code, message: addonErr.message });
        throw new Error("Failed to save payment information");
      }
    }

    await supabaseClient.from("payment_logs").insert({
      order_id: fullOrderId,
      manage_id,
      event_type: "created",
      payload: { customer_name, customer_phone, customer_email, template_name, amount: paymentAmount, promo_code: appliedPromoCode, plan, upgrade_from: upgrade?.from ?? null, guest_addons: addonAmount ? addonPacks : null },
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

// {groom, bride} số gói thêm khách mua kèm đơn gói; thiếu = 0. Sai kiểu / ngoài khoảng → null.
function parseAddonPacks(v: unknown): { groom: number; bride: number } | null {
  if (v == null) return { groom: 0, bride: 0 };
  if (typeof v !== "object" || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  const out = { groom: 0, bride: 0 };
  for (const side of ["groom", "bride"] as const) {
    const n = o[side] == null ? 0 : Number(o[side]);
    if (!Number.isInteger(n) || n < 0 || n > GUEST_ADDON.maxPacks) return null;
    out[side] = n;
  }
  return out;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Trần đơn mua thêm khách còn treo của một thiệp trong một khung thời gian.
const ADDON_PENDING_MAX = 5;
const ADDON_PENDING_WINDOW_MS = 30 * 60 * 1000;

// Đơn mua thêm khách mời cho MỘT bên (bảng guest_addons). Giá = số gói × GUEST_ADDON.price,
// không nhận mã giảm giá, không đụng hàng weddings — payos-webhook chốt đơn theo order_id.
async function handleCreateGuestAddon(req: Request, supabaseClient: any, log: Logger) {
  const body = await req.json().catch(() => ({}));
  const manage_id = typeof body.manage_id === "string" ? body.manage_id : "";
  const side = body.side;
  const packs = Number(body.packs);
  if (!UUID_RE.test(manage_id) || (side !== "groom" && side !== "bride")) {
    return new Response(JSON.stringify({ error: "Thiếu thiệp hoặc bên mua thêm không hợp lệ" }), { status: 400, headers: JSON_HEADERS });
  }
  if (!Number.isInteger(packs) || packs < 1 || packs > GUEST_ADDON.maxPacks) {
    return new Response(JSON.stringify({ error: `Mỗi lần mua từ 1 tới ${GUEST_ADDON.maxPacks} gói` }), { status: 400, headers: JSON_HEADERS });
  }

  const buyerId = await resolveAuthUserId(req, supabaseClient);
  if (!buyerId) {
    return new Response(JSON.stringify({ error: "Vui lòng đăng nhập để thanh toán", code: "AUTH_REQUIRED" }), { status: 401, headers: JSON_HEADERS });
  }

  const { data: w, error: wErr } = await supabaseClient
    .from("weddings")
    .select("id, user_id, payment_status, free_side, plan, plan_expires_at, expires_at, is_active")
    .eq("id", manage_id)
    .maybeSingle();
  if (wErr) {
    log.error("guest_addon.wedding_read_failed", { manage_id, code: wErr.code, message: wErr.message });
    return new Response(JSON.stringify({ error: "Không kiểm tra được thiệp, vui lòng thử lại" }), { status: 500, headers: JSON_HEADERS });
  }
  if (!w) return new Response(JSON.stringify({ error: "Thiệp không tồn tại" }), { status: 404, headers: JSON_HEADERS });
  if (w.user_id !== buyerId) {
    log.warn("guest_addon.forbidden", { manage_id, buyerId });
    return new Response(JSON.stringify({ error: "Chỉ chủ thiệp mua thêm khách được", code: "FORBIDDEN" }), { status: 403, headers: JSON_HEADERS });
  }
  const buyable = addonBuyableSides(w);
  if (!buyable.includes(side)) {
    const reason = buyable.length
      ? "Gói Free chỉ mua thêm khách cho bên đã mở thiệp"
      : "Thiệp chưa có gói hoặc đã hết hạn, chưa mua thêm khách được";
    return new Response(JSON.stringify({ error: reason, code: "ADDON_UNAVAILABLE" }), { status: 409, headers: JSON_HEADERS });
  }

  // Mỗi lần bấm là một đơn PayOS + một hàng `pending` (đơn bỏ ngang không bao giờ chốt) →
  // chặn bấm dồn. Đếm hỏng là dừng, đừng mở cửa tạo đơn vô hạn.
  const since = new Date(Date.now() - ADDON_PENDING_WINDOW_MS).toISOString();
  const { count: pendingCount, error: pendErr } = await supabaseClient
    .from("guest_addons")
    .select("id", { count: "exact", head: true })
    .eq("wedding_id", manage_id)
    .eq("status", "pending")
    .gte("created_at", since);
  if (pendErr) {
    log.error("guest_addon.pending_count_failed", { manage_id, code: pendErr.code, message: pendErr.message });
    return new Response(JSON.stringify({ error: "Không kiểm tra được đơn, vui lòng thử lại" }), { status: 500, headers: JSON_HEADERS });
  }
  if ((pendingCount ?? 0) >= ADDON_PENDING_MAX) {
    log.warn("guest_addon.too_many_pending", { manage_id, pending: pendingCount });
    return new Response(JSON.stringify({ error: "Bạn vừa tạo nhiều mã thanh toán, vui lòng đợi ít phút rồi thử lại", code: "TOO_MANY" }), { status: 429, headers: JSON_HEADERS });
  }

  const amount = packs * GUEST_ADDON.price;
  const guests = packs * GUEST_ADDON.guests;
  const orderCode = newOrderCode();
  const orderId = `ORDER-${orderCode}`;

  // Ghi đơn TRƯỚC khi gọi PayOS: webhook tới sớm vẫn tìm ra đơn.
  const { data: row, error: insErr } = await supabaseClient
    .from("guest_addons")
    .insert({ wedding_id: manage_id, order_id: orderId, side, packs, guests, amount, user_id: buyerId })
    .select("id")
    .single();
  if (insErr) {
    log.error("guest_addon.insert_failed", { order_id: orderId, manage_id, code: insErr.code, message: insErr.message });
    return new Response(JSON.stringify({ error: "Không tạo được đơn, vui lòng thử lại" }), { status: 500, headers: JSON_HEADERS });
  }

  let paymentResponse: any;
  try {
    const creds = getPayOSCredentials();
    const baseUrl = allowedBaseUrl(req.headers.get("origin"));
    paymentResponse = await createPaymentRequest(
      { orderCode, amount, returnUrl: `${baseUrl}/payment-success`, cancelUrl: `${baseUrl}/payment-cancel` },
      creds.apiKey, creds.clientId, creds.checksumKey,
    );
  } catch (error) {
    log.error("guest_addon.payos_failed", { order_id: orderId, manage_id, message: error instanceof Error ? error.message : String(error) });
    const { error: failErr } = await supabaseClient.from("guest_addons").update({ status: "failed" }).eq("id", row.id);
    if (failErr) log.error("guest_addon.mark_failed_failed", { order_id: orderId, code: failErr.code, message: failErr.message });
    return new Response(JSON.stringify({ error: "Không tạo được mã thanh toán, vui lòng thử lại" }), { status: 502, headers: JSON_HEADERS });
  }

  const { error: logErr } = await supabaseClient.from("payment_logs").insert({
    order_id: orderId,
    manage_id,
    event_type: "created",
    payload: { kind: "guest_addon", side, packs, guests, amount },
  });
  if (logErr) log.error("guest_addon.log_failed", { order_id: orderId, code: logErr.code, message: logErr.message });

  return new Response(JSON.stringify({
    success: true,
    order_id: orderId,
    qr_code: paymentResponse.data.qrCode,
    payment_info: {
      bank_name: "PayOS",
      account_number: paymentResponse.data.accountNumber,
      account_name: paymentResponse.data.accountName,
      amount: paymentResponse.data.amount,
      content: paymentResponse.data.description,
    },
    addon: { side, packs, guests, amount },
    checkout_url: paymentResponse.data.checkoutUrl,
  }), { status: 200, headers: JSON_HEADERS });
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

    // Không phải đơn gói thiệp → có thể là đơn mua thêm khách (guest_addons).
    if (error || !data) {
      const { data: addon, error: addonErr } = await supabaseClient
        .from("guest_addons")
        .select("status")
        .eq("order_id", order_id)
        .maybeSingle();
      if (addonErr) {
        log.error("guest_addon.status_read_failed", { order_id, code: addonErr.code, message: addonErr.message });
        return new Response(JSON.stringify({ error: "Không kiểm tra được đơn" }), { status: 500, headers: JSON_HEADERS });
      }
      if (addon) {
        // Chỉ trạng thái: ai có order_id cũng hỏi được đường này (không cần đăng nhập).
        return new Response(JSON.stringify({ status: addon.status, kind: "guest_addon" }), { status: 200, headers: JSON_HEADERS });
      }
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
