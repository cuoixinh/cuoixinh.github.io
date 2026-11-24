// resource=support-pay — trang /admin-support: khách chuyển khoản thẳng / trả tiền mặt cho nhân
// viên, nhân viên (SUPPORT_EMAILS, kiểm ở index.ts) xác nhận "đã nhận tiền" để thiệp lên gói.
// Không qua PayOS nên KHÔNG có đối soát tự động: mọi lượt ghi payment_logs kèm email nhân viên.
// Giá, gói được nâng và hạn gói tính bằng đúng luật của payment-handler + payos-webhook (_shared/plans.ts).
// PATCH: bật/tắt showcase_consent (hiện thiệp ở trang chủ) khi khách xin đổi.
// POST kind=guest_addon: thu tiền tay gói thêm khách (bảng guest_addons, confirmed_by = nhân viên).

import type { Logger } from '../_shared/axiom.ts'
import { addonBuyableSides, currentPlan, GUEST_ADDON, isPlanId, planExpiry, quotePlans } from '../_shared/plans.ts'
import { extraGuests } from '../_shared/guest-addons.ts'
import { isAccountEmail, isAdminMade } from './accounts.ts'

// deno-lint-ignore no-explicit-any
type Db = any

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,99}$/
// id sai dạng mà đưa thẳng vào .eq() là Postgres ném 22P02 → thành 500 + log lỗi giả.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const WEDDING_COLS =
  'id, slug, user_id, theme, groom_name, bride_name, is_published, payment_status, payment_amount, ' +
  'plan, plan_expires_at, pending_plan, pending_amount, free_side, expires_at, transaction_id, payment_time, ' +
  'showcase_consent, is_active'

// Nhân viên dán cả link (cuoixinh.com/<slug>?g=…) hoặc chỉ slug.
function slugFrom(input: unknown): string {
  let s = String(input ?? '').trim()
  try {
    if (/^https?:\/\//i.test(s)) s = new URL(s).pathname
  } catch { /* để nguyên, SLUG_RE loại */ }
  return s.replace(/^\/+|\/+$/g, '').split('/').pop()!.toLowerCase()
}

async function loadWedding(db: Db, col: 'slug' | 'id', value: string) {
  return await db.from('weddings').select(WEDDING_COLS).eq(col, value).maybeSingle()
}

// Gói thêm khách của thiệp cho màn Thanh toán hộ: bên còn bán + số đã mua + vài đơn gần nhất.
// deno-lint-ignore no-explicit-any
async function loadAddons(db: Db, w: any, log: Logger) {
  const id = String(w.id)
  const extra = await extraGuests(db, id, log)
  if (!extra) return null
  const { data, error } = await db
    .from('guest_addons')
    .select('side, packs, guests, amount, status, created_at, paid_at, confirmed_by')
    .eq('wedding_id', id)
    .order('created_at', { ascending: false })
    .limit(20)
  if (error) {
    log.error('support_pay.addons_failed', { manage_id: id, code: error.code, message: error.message })
    return null
  }
  return {
    guests: GUEST_ADDON.guests,
    price: GUEST_ADDON.price,
    max_packs: GUEST_ADDON.maxPacks,
    sides: addonBuyableSides(w),
    extra,
    orders: data ?? [],
  }
}

// POST kind=guest_addon — nhân viên đã thu tiền gói thêm khách. `request_id` do trang sinh mỗi
// lần mở form: bấm lặp / mạng gửi lại thì trùng order_id (UNIQUE) → không cộng chỗ hai lần.
async function confirmAddon(db: Db, body: Record<string, unknown>, log: Logger, staffEmail: string, json: (b: unknown, s?: number) => Response) {
  const id = String(body.id ?? '')
  const side = body.side
  const packs = Number(body.packs)
  const amount = Number(body.amount)
  const reqId = String(body.request_id ?? '')
  const note = String(body.note ?? '').trim().slice(0, 300)
  if (!UUID_RE.test(id) || !UUID_RE.test(reqId)) return json({ error: 'Thiếu thiệp hoặc mã yêu cầu' }, 400)
  if (side !== 'groom' && side !== 'bride') return json({ error: 'Chọn nhà trai hoặc nhà gái' }, 400)
  if (!Number.isInteger(packs) || packs < 1 || packs > GUEST_ADDON.maxPacks) {
    return json({ error: `Số gói từ 1 tới ${GUEST_ADDON.maxPacks}` }, 400)
  }
  if (!Number.isInteger(amount) || amount < 0 || amount > 100_000_000) return json({ error: 'Số tiền đã nhận không hợp lệ' }, 400)

  const { data: w, error } = await loadWedding(db, 'id', id)
  if (error) {
    log.error('support_pay.lookup_failed', { manage_id: id, code: error.code, message: error.message })
    return json({ error: 'Không tra được thiệp' }, 500)
  }
  if (!w) return json({ error: 'Không tìm thấy thiệp' }, 404)
  if (!addonBuyableSides(w).includes(side)) {
    return json({ error: 'Bên này chưa mua thêm khách được (thiệp chưa có gói, hết hạn, hoặc gói Free khoá bên này)' }, 409)
  }

  const orderId = `STAFF-ADDON-${reqId}`
  const guests = packs * GUEST_ADDON.guests
  const now = new Date().toISOString()
  const { error: insErr } = await db.from('guest_addons').insert({
    wedding_id: id,
    order_id: orderId,
    side,
    packs,
    guests,
    amount,
    status: 'completed',
    paid_at: now,
    confirmed_by: staffEmail,
  })
  if (insErr?.code === '23505') return json({ ok: true, duplicate: true })
  if (insErr) {
    log.error('support_pay.addon_insert_failed', { manage_id: id, order_id: orderId, code: insErr.code, message: insErr.message })
    return json({ error: 'Không ghi được đơn mua thêm khách' }, 500)
  }

  // Đã cộng chỗ rồi → sổ hỏng chỉ ghi log, không trả lỗi (bấm lại là tạo đơn mới).
  const { error: logErr } = await db.from('payment_logs').insert({
    order_id: orderId,
    manage_id: id,
    event_type: 'completed',
    payload: { kind: 'guest_addon', by: staffEmail, manual: true, side, packs, guests, amount, quoted: packs * GUEST_ADDON.price, note },
  })
  if (logErr) log.error('support_pay.log_failed', { manage_id: id, order_id: orderId, code: logErr.code, message: logErr.message })

  log.info('support_pay.addon_confirmed', { manage_id: id, slug: w.slug, side, guests, amount, by: staffEmail })
  return json({ ok: true, order_id: orderId, side, guests })
}

async function loadPricing(db: Db, theme: string) {
  return await db
    .from('template_pricing')
    .select('price, original_price')
    .eq('template_name', theme)
    .eq('is_active', true)
    .maybeSingle()
}

export async function handleSupportPay(
  req: Request,
  url: URL,
  db: Db,
  log: Logger,
  corsHeaders: Record<string, string>,
  staffEmail: string,
): Promise<Response> {
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  // GET ?slug= — thông tin thiệp + báo giá các gói để nhân viên biết thu bao nhiêu.
  if (req.method === 'GET') {
    const slug = slugFrom(url.searchParams.get('slug'))
    if (!SLUG_RE.test(slug)) return json({ error: 'Link hoặc slug không hợp lệ' }, 400)
    const { data: w, error } = await loadWedding(db, 'slug', slug)
    if (error) {
      log.error('support_pay.lookup_failed', { slug, code: error.code, message: error.message })
      return json({ error: 'Không tra được thiệp' }, 500)
    }
    if (!w) return json({ error: 'Không có thiệp nào ở link này' }, 404)

    let owner: string | null = null
    // Chủ thiệp là tài khoản Cưới Xinh do nhân viên tạo → trang hiện nút "Đăng nhập thay"
    // (server vẫn kiểm lại ở accounts.ts, cờ này chỉ để vẽ nút).
    let ownerAccountId: string | null = null
    if (w.user_id) {
      const { data: u, error: uErr } = await db.auth.admin.getUserById(w.user_id)
      if (uErr) log.warn('support_pay.owner_lookup_failed', { slug, message: uErr.message })
      owner = u?.user?.email ?? null
      if (u?.user && isAccountEmail(u.user.email) && isAdminMade(u.user)) ownerAccountId = u.user.id
    }

    const from = currentPlan(w)
    const { data: pricing, error: pErr } = await loadPricing(db, w.theme || 'template1')
    if (pErr) {
      log.error('support_pay.pricing_failed', { slug, theme: w.theme, code: pErr.code, message: pErr.message })
      return json({ error: 'Không tải được bảng giá' }, 500)
    }
    // Hỏng phần này (đã log.error) thì vẫn trả thiệp để thanh toán gói không bị chặn theo;
    // trang ẩn form mua thêm và báo lỗi tải.
    const guestAddon = await loadAddons(db, w, log)
    return json({
      guest_addon: guestAddon,
      guest_addon_error: !guestAddon,
      id: w.id,
      slug: w.slug,
      theme: w.theme,
      couple: [w.groom_name, w.bride_name].filter(Boolean).join(' & '),
      owner,
      owner_account_id: ownerAccountId,
      is_published: !!w.is_published,
      payment_status: w.payment_status ?? null,
      current_plan: from,
      plan_expires_at: from ? w.plan_expires_at : null,
      // Đơn PayOS đang treo: khách trả đơn đó SAU khi nhân viên xác nhận thì tiền vào mà
      // webhook không khớp payment_order_id nữa — nhân viên phải biết để hỏi lại khách.
      pending_payos: !!w.pending_plan,
      showcase_consent: !!w.showcase_consent,
      plans: pricing && pricing.price > 0
        ? quotePlans(pricing.price, pricing.original_price, from, w.plan_expires_at)
        : [],
    })
  }

  // POST { id, plan, amount, note, showcase_consent } — chốt "đã nhận tiền". showcase_consent
  // chỉ ghi khi mua lần đầu, cùng luật màn thanh toán (nâng gói giữ lựa chọn cũ).
  if (req.method === 'POST') {
    const body = await req.json().catch(() => ({}))
    if (body.kind === 'guest_addon') return await confirmAddon(db, body, log, staffEmail, json)
    const id = String(body.id ?? '')
    const plan = body.plan
    const amount = Number(body.amount)
    const note = String(body.note ?? '').trim().slice(0, 300)
    if (!id) return json({ error: 'Thiếu thiệp' }, 400)
    if (!isPlanId(plan)) return json({ error: 'Chọn gói Premium hoặc Forever' }, 400)
    // Số tiền THỰC NHẬN (có thể đã giảm tay) — chỉ để ghi sổ, không quyết định gói.
    if (!Number.isInteger(amount) || amount < 0 || amount > 100_000_000) {
      return json({ error: 'Số tiền đã nhận không hợp lệ' }, 400)
    }

    const { data: w, error } = await loadWedding(db, 'id', id)
    if (error) {
      log.error('support_pay.lookup_failed', { manage_id: id, code: error.code, message: error.message })
      return json({ error: 'Không tra được thiệp' }, 500)
    }
    if (!w) return json({ error: 'Không tìm thấy thiệp' }, 404)

    // Gói được phép: cùng luật màn thanh toán (chỉ NÂNG, không mua lại gói đang có).
    const from = currentPlan(w)
    const { data: pricing, error: pErr } = await loadPricing(db, w.theme || 'template1')
    if (pErr) {
      log.error('support_pay.pricing_failed', { manage_id: id, theme: w.theme, code: pErr.code, message: pErr.message })
      return json({ error: 'Không tải được bảng giá' }, 500)
    }
    if (!pricing || !(pricing.price > 0)) return json({ error: 'Mẫu này chưa có giá' }, 409)
    const quote = quotePlans(pricing.price, pricing.original_price, from, w.plan_expires_at).find(q => q.id === plan)
    if (!quote?.available) {
      return json({
        error: quote?.reason === 'too_late'
          ? 'Gói này đã quá hạn để nâng, chọn Forever'
          : 'Thiệp đang ở gói này hoặc gói cao hơn',
      }, 409)
    }

    const now = new Date().toISOString()
    const orderId = `STAFF-${Date.now()}`
    // Cùng bộ trường webhook ghi khi đơn PayOS hoàn tất. Nâng gói thì cộng dồn số đã trả.
    const fields: Record<string, unknown> = {
      payment_status: 'completed',
      payment_order_id: orderId,
      transaction_id: `STAFF:${staffEmail}`,
      payment_time: now,
      payment_amount: from ? (w.payment_amount ?? 0) + amount : amount,
      plan,
      plan_expires_at: planExpiry(from, w.plan_expires_at, plan),
      pending_plan: null,
      pending_amount: null,
      pending_theme: null,
      expires_at: null,
    }
    if (!from) fields.showcase_consent = body.showcase_consent === true
    // Khoá theo trạng thái vừa đọc: hai nhân viên bấm cùng lúc (hoặc webhook PayOS chen
    // vào giữa) thì lượt sau không khớp, không áp gói hai lần.
    let q = db.from('weddings').update(fields).eq('id', id)
    q = from
      ? q.eq('payment_status', 'completed').eq('plan', w.plan)
      : q.or('payment_status.is.null,payment_status.neq.completed')
    const { data: updated, error: upErr } = await q.select('id')
    if (upErr) {
      log.error('support_pay.update_failed', { manage_id: id, code: upErr.code, message: upErr.message })
      return json({ error: 'Không ghi được trạng thái thanh toán' }, 500)
    }
    if (!updated?.length) return json({ error: 'Thiệp vừa đổi trạng thái, tải lại rồi thử lại' }, 409)

    // Thiệp đã lên gói rồi → sổ hỏng chỉ ghi log, không trả lỗi (bấm lại là áp lần hai).
    const { error: logErr } = await db.from('payment_logs').insert({
      order_id: orderId,
      manage_id: id,
      event_type: 'completed',
      payload: {
        by: staffEmail,
        manual: true,
        amount,
        quoted: quote.amount,
        plan,
        upgrade_from: from,
        theme: w.theme,
        note,
        showcase_consent: fields.showcase_consent ?? null,
      },
    })
    if (logErr) log.error('support_pay.log_failed', { manage_id: id, order_id: orderId, code: logErr.code, message: logErr.message })

    log.info('support_pay.confirmed', { manage_id: id, slug: w.slug, plan, amount, by: staffEmail })
    return json({ ok: true, order_id: orderId, plan, plan_expires_at: fields.plan_expires_at })
  }

  // PATCH { id, showcase_consent } — bật/tắt hiện thiệp ở trang chủ theo yêu cầu của
  // khách (đã thanh toán thì khách không tự đổi được nữa). Ghi log kèm email nhân viên.
  if (req.method === 'PATCH') {
    const body = await req.json().catch(() => ({}))
    const id = String(body.id ?? '')
    if (!UUID_RE.test(id) || typeof body.showcase_consent !== 'boolean') {
      return json({ error: 'Thiếu thiệp hoặc giá trị' }, 400)
    }
    const { data: updated, error: upErr } = await db
      .from('weddings').update({ showcase_consent: body.showcase_consent }).eq('id', id).select('id, slug')
    if (upErr) {
      log.error('support_pay.showcase_update_failed', { manage_id: id, code: upErr.code, message: upErr.message })
      return json({ error: 'Không ghi được' }, 500)
    }
    if (!updated?.length) return json({ error: 'Không tìm thấy thiệp' }, 404)
    log.info('support_pay.showcase_set', { manage_id: id, slug: updated[0].slug, value: body.showcase_consent, by: staffEmail })
    return json({ ok: true, showcase_consent: body.showcase_consent })
  }

  return json({ error: 'Method not allowed' }, 405)
}
