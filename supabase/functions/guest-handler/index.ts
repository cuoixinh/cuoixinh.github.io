import type { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { createDbClient } from '../_shared/db-client.ts'
import { withAxiom } from '../_shared/axiom.ts'
import { currentPlan, FREE_PLAN, freeSide, isFreePlan } from '../_shared/plans.ts'

// ── CORS ─────────────────────────────────────────────────────────────────────
// Allowlist origin thay cho '*' (danh sách giống ai-invitation). CORS chỉ ràng
// buộc trình duyệt — lớp bảo vệ thật là kiểm tra chủ sở hữu thiệp bên dưới.
const ALLOWED_ORIGINS = [
  'https://cuoixinh.com',
  'https://staging.cuoixinh.com',
  'https://www.cuoixinh.com',
  'https://cuoixinh.github.io',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://localhost:3000',
  'https://urban-train-4j44q69x76vv3jv99-5500.app.github.dev',
]

function isAllowedOrigin(origin: string): boolean {
  if (ALLOWED_ORIGINS.includes(origin)) return true
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
}

function buildCors(origin: string | null) {
  const allow = origin && isAllowedOrigin(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allow,
    // authorization/apikey cần được cho phép, nếu không preflight sẽ chặn JWT của user.
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-token',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Vary': 'Origin',
  }
}

// So chuỗi không phụ thuộc thời gian (giống wedding-admin / cleanup-weddings).
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length || a.length === 0) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

// Trần khách mỗi bên: đã thanh toán 100; gói Miễn phí FREE_PLAN.guests ở bên đã chọn,
// 0 ở bên kia; chưa chọn gói (nháp, dùng thử) 5. Bản sao ở CONFIG.guestImport
// (maxPerSide / maxPerSideUnpaid) — đổi phải đổi cả hai.
const MAX_PER_SIDE = 100
const MAX_PER_SIDE_UNPAID = 5
type CapRow = { payment_status?: string | null; free_side?: string | null }
function sideCap(row: CapRow, side: string): number {
  if (row.payment_status === 'completed') return MAX_PER_SIDE
  const open = freeSide(row)
  if (!open) return MAX_PER_SIDE_UNPAID
  return side === open ? FREE_PLAN.guests : 0
}
function capMessage(row: CapRow, side: string, cap: number): string {
  if (row.payment_status === 'completed') return `Đã đạt giới hạn ${cap} khách mời mỗi bên`
  const open = freeSide(row)
  if (open && side !== open)
    return `Gói Miễn phí chỉ mở thiệp ${open === 'groom' ? 'nhà trai' : 'nhà gái'}. Nâng gói để mời khách bên này.`
  if (open) return `Gói Miễn phí mời được tối đa ${cap} khách. Nâng gói để mời tới ${MAX_PER_SIDE} khách mỗi bên.`
  return `Thiệp chưa thanh toán chỉ thêm được ${cap} khách mời mỗi bên. Thanh toán để mở tới ${MAX_PER_SIDE} khách.`
}
const MAX_WISHES_PER_GUEST = 3
// Trần một lời chúc khách GỬI — trùng CX_WISH_MAX_LEN ở core/helpers/wishes-helper.js.
// Quá trần là 400, KHÔNG cắt lặng lẽ (khách tưởng gửi đủ mà mất đuôi câu).
const MAX_WISH_LEN = 300
// Lời chúc ĐÃ LƯU từ hồi trần còn 500 — đọc ra giữ nguyên, đừng cắt theo trần mới.
const MAX_WISH_STORED_LEN = 500
const MAX_WISHES_RETURNED = 200
const MAX_FIELD_LEN = 200
const MAX_REL_LEN = 100
const BATCH_SIZE = 50

function sanitizeGuest(raw: Record<string, unknown>, wedding_id: string, side: string) {
  return {
    wedding_id,
    side,
    full_name:    String(raw.full_name    ?? '').trim().slice(0, MAX_FIELD_LEN),
    display_name: String(raw.display_name ?? '').trim().slice(0, MAX_FIELD_LEN),
    relationship: String(raw.relationship ?? '').trim().slice(0, MAX_REL_LEN),
  }
}

// Khoá trùng khi nhập danh sách: cùng Họ tên + Tên trên thiệp + Xưng hô là một khách.
// Bản sao ở guestBL.planAiImport (client) — đổi phải đổi cả hai.
const guestKey = (g: { full_name?: unknown; display_name?: unknown; relationship?: unknown }) =>
  [g.full_name, g.display_name, g.relationship].map(v => String(v ?? '').trim()).join('||')

// ── Khớp khách theo link cá nhân hoá ─────────────────────────────────────────
// CỔNG CHẶN THẬT của mọi thao tác công khai (rsvp, gửi lời chúc): tham số
// name/relationship trên link mã hoá bằng khoá nằm trong bundle client nên ai
// cũng tự tạo được cặp "giải mã hợp lệ" — chỉ việc có mặt trong bảng guests của
// đúng thiệp mới chứng minh người gọi là khách được mời.
// Link mang tên hiển thị (rơi về full_name khi khách không có tên hiển thị) nên
// phải so cả hai cột; ưu tiên hàng khớp cả xưng hô — trùng tên trong một thiệp
// là chuyện thường, xưng hô mới tách được hai người.
async function findGuestByLink(
  supabase: ReturnType<typeof createClient>,
  wedding_id: string,
  name: string,
  relationship: string,
  columns = 'id, full_name, display_name, relationship',
) {
  const { data: rows, error } = await supabase
    .from('guests')
    .select(columns)
    .eq('wedding_id', wedding_id)
    .order('created_at', { ascending: true })

  if (error) return { error: error.message, guest: null }

  const norm = (v: unknown) => String(v ?? '').trim().toLowerCase()
  const sameName = (g: Record<string, unknown>) =>
    norm(g.display_name) === norm(name) || norm(g.full_name) === norm(name)

  const list = (rows ?? []) as Record<string, unknown>[]
  const guest =
    list.find(g => sameName(g) && norm(g.relationship) === norm(relationship)) ??
    list.find(sameName) ??
    null

  return { error: null, guest }
}

// Lời chúc đã lưu → mảng sạch. Hàng cũ có cột null hoặc dữ liệu hỏng thì coi
// như chưa có lời chúc nào, đừng để một hàng lỗi chặn khách gửi.
function readWishes(raw: unknown): { id: string; text: string; at: string }[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter(w => w && typeof w === 'object' && typeof (w as { text?: unknown }).text === 'string')
    .map(w => {
      const o = w as Record<string, unknown>
      return {
        id: String(o.id ?? crypto.randomUUID()),
        text: String(o.text).slice(0, MAX_WISH_STORED_LEN),
        at: String(o.at ?? ''),
      }
    })
}

Deno.serve(withAxiom('guest-handler', async (req, log) => {
  // Header CORS theo Origin của chính request này. ok()/fail() định nghĩa trong
  // handler để đóng gói giá trị này, tránh dùng biến chung giữa các request.
  const CORS = buildCors(req.headers.get('Origin'))

  function ok(data: unknown, status = 200) {
    return new Response(JSON.stringify(data), {
      status,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  // 4xx là lỗi của phía gọi (thiếu trường, sai quyền) — chuyện thường, không log.
  // 5xx thì luôn là DB/hệ thống hỏng: log để Axiom thấy, vì mọi đường ghi khách
  // mời đều thoát qua đây và không chỗ nào tự log.
  function fail(message: string, status = 400) {
    if (status >= 500) log.error('guest.db_failed', { action, message })
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const supabase = createDbClient(log)

  const url = new URL(req.url)
  const action = url.searchParams.get('action') ?? ''

  // ── Phân quyền ────────────────────────────────────────────────────────────
  // Phải đăng nhập VÀ phải là chủ thiệp mới đọc/sửa được danh sách khách mời
  // (xem docs/security-audit-plan.md #3).
  const isAdmin = timingSafeEqual(
    req.headers.get('x-admin-token') ?? '',
    Deno.env.get('ADMIN_SECRET_TOKEN') ?? '',
  )

  // Người gọi (token Supabase). email chỉ có khi ĐÃ XÁC MINH — khớp thành viên theo email
  // chưa xác minh là ai đăng ký trước bằng email cô dâu cũng vào được. Nhớ trong request.
  let _authUser: { id: string; email: string | null } | null | undefined
  async function getAuthUser(): Promise<{ id: string; email: string | null } | null> {
    if (_authUser !== undefined) return _authUser
    _authUser = null
    const authHeader = req.headers.get('Authorization') || ''
    const jwt = authHeader.replace(/^Bearer\s+/i, '').trim()
    if (!jwt || jwt === Deno.env.get('SUPABASE_ANON_KEY')) return null
    try {
      const { data, error } = await supabase.auth.getUser(jwt)
      const u = data?.user
      if (error || !u) return null
      _authUser = { id: u.id, email: u.email && u.email_confirmed_at ? u.email.toLowerCase() : null }
    } catch {
      _authUser = null
    }
    return _authUser
  }

  type Access = {
    role: 'admin' | 'owner' | 'member'
    side: 'groom' | 'bride' | null // thành viên chỉ quản lý bên này; null = cả hai
    wedding: { user_id: string | null; payment_status: string | null; free_side: string | null; is_active: boolean | null } | null
  }

  // Ai được quản lý khách mời của thiệp: admin, chủ thiệp (weddings.user_id), hoặc thành
  // viên (wedding_members, khớp email đã xác minh) — thành viên không áp cho gói Miễn phí.
  // Trả Response lỗi hoặc quyền của người gọi. Đọc hỏng là DỪNG, không đoán quyền.
  async function authorize(wedding_id: string): Promise<Response | Access> {
    const user = isAdmin ? null : await getAuthUser()
    if (!isAdmin && !user) return fail('Vui lòng đăng nhập để quản lý khách mời', 401)

    const { data: wedding, error } = await supabase
      .from('weddings')
      .select('user_id, payment_status, free_side, is_active')
      .eq('id', wedding_id)
      .maybeSingle()
    if (error) {
      log.error('guest.auth_wedding_failed', { wedding_id, code: error.code, message: error.message })
      return fail('Không đọc được thiệp, vui lòng thử lại', 500)
    }
    if (!wedding) return fail('Thiệp không tồn tại', 404)
    if (isAdmin) return { role: 'admin', side: null, wedding }

    // Thiệp cũ chưa có chủ: chưa claim thì chưa cho thao tác khách mời — chủ thật
    // chỉ cần mở trang chỉnh sửa thiệp một lần (đã đăng nhập) là nhận chủ, xem
    // wedding-admin PATCH.
    if (wedding.user_id === user!.id) return { role: 'owner', side: null, wedding }

    // Chủ thiệp đã xoá thiệp (is_active = false, chờ cron xoá hẳn) thì thành viên mất quyền ngay.
    if (user!.email && !isFreePlan(wedding) && wedding.is_active !== false) {
      const { data: m, error: mErr } = await supabase
        .from('wedding_members')
        .select('id, side, user_id')
        .eq('wedding_id', wedding_id)
        .eq('email', user!.email)
        .maybeSingle()
      if (mErr) {
        log.error('guest.member_lookup_failed', { wedding_id, code: mErr.code, message: mErr.message })
        return fail('Không kiểm được quyền, vui lòng thử lại', 500)
      }
      if (m) {
        if (!m.user_id) {
          // Lần đầu vào: đánh dấu đã tham gia. Hỏng không chặn quyền, chỉ chủ thiệp
          // thấy nhầm "Chờ đăng nhập" — vẫn log để biết.
          const { error: jErr } = await supabase
            .from('wedding_members')
            .update({ user_id: user!.id, joined_at: new Date().toISOString() })
            .eq('id', m.id)
          if (jErr) log.error('guest.member_join_failed', { wedding_id, code: jErr.code, message: jErr.message })
        }
        return { role: 'member', side: m.side === 'groom' || m.side === 'bride' ? m.side : null, wedding }
      }
    }

    log.warn('guest.forbidden', { wedding_id, userId: user!.id })
    return fail('Bạn không có quyền quản lý khách mời của thiệp này', 403)
  }

  const SIDE_NAME: Record<string, string> = { groom: 'nhà trai', bride: 'nhà gái' }
  // Thành viên giới hạn một bên mà đụng sang bên kia → 403.
  function denySide(a: Access, side: unknown): Response | null {
    if (!a.side || side === a.side) return null
    return fail(`Bạn chỉ quản lý được khách ${SIDE_NAME[a.side]} của thiệp này`, 403)
  }

  // Với thao tác chỉ có guest id: suy ra wedding_id + bên từ chính các bản ghi guest,
  // rồi kiểm tra quyền. Chặn sửa/xoá guest thuộc thiệp (hoặc bên) của người khác.
  async function denyIfNotAllowedGuests(ids: string[]): Promise<Response | null> {
    if (isAdmin) return null

    const { data: rows, error } = await supabase
      .from('guests')
      .select('wedding_id, side')
      .in('id', ids)

    if (error) return fail(error.message, 500)
    if (!rows || rows.length === 0) return fail('Không tìm thấy khách mời', 404)

    const weddingIds = [...new Set(rows.map(r => r.wedding_id))]
    if (weddingIds.length > 1) return fail('Yêu cầu không hợp lệ', 400)

    const a = await authorize(weddingIds[0])
    if (a instanceof Response) return a
    for (const r of rows) {
      const d = denySide(a, r.side)
      if (d) return d
    }
    return null
  }

  // ── GET công khai: danh sách lời chúc của một thiệp ──────────────────────
  // Ai mở link thiệp cũng đọc được (bảng lời chúc vốn để mọi khách cùng xem),
  // nên KHÔNG qua authorize. Chỉ trả tên hiển thị + xưng hô + nội dung —
  // không có full_name, link, hay trạng thái xác nhận tham dự.
  if (req.method === 'GET' && action === 'wishes-list') {
    const slug = String(url.searchParams.get('slug') ?? '').trim()
    if (!slug) return fail('Thiếu slug')

    const { data: wedding } = await supabase
      .from('weddings')
      .select('id')
      .eq('slug', slug)
      .maybeSingle()

    if (!wedding) return fail('Thiệp không tồn tại', 404)

    const { data: rows, error } = await supabase
      .from('guests')
      .select('display_name, full_name, relationship, wishes')
      .eq('wedding_id', wedding.id)

    if (error) return fail(error.message, 500)

    // Chỉ trả về khách CÓ lời chúc, và đúng cái tên vẫn hiện trên dải lời chúc
    // của thiệp — tức thông tin này vốn đã công khai theo thiết kế, không phải rò rỉ.
    const items: { id: string; name: string; relationship: string; text: string; at: string }[] = []
    for (const g of rows ?? []) {
      const name = String(g.display_name || g.full_name || '').trim()
      for (const w of readWishes(g.wishes)) {
        items.push({ id: w.id, name, relationship: String(g.relationship ?? ''), text: w.text, at: w.at })
      }
    }

    // Mới nhất trước. Lời chúc cũ chưa có `at` xuống cuối thay vì làm hỏng thứ tự.
    items.sort((a, b) => (b.at || '').localeCompare(a.at || ''))

    return ok(items.slice(0, MAX_WISHES_RETURNED))
  }

  // ── GET: thiệp người khác mời mình cùng quản lý khách (trang Khách mời) ──
  // Cùng dạng hàng với my-weddings của wedding-admin (gói suy ra, không trả dữ liệu
  // thanh toán) + member_side. Bỏ thiệp đã ẩn, gói Miễn phí, và thiệp của chính mình.
  if (req.method === 'GET' && action === 'shared') {
    const user = await getAuthUser()
    if (!user) return fail('Vui lòng đăng nhập', 401)
    if (!user.email) return ok([])

    const { data: ms, error: mErr } = await supabase
      .from('wedding_members')
      .select('wedding_id, side')
      .eq('email', user.email)
    if (mErr) return fail(mErr.message, 500)
    if (!ms?.length) return ok([])

    const { data: ws, error: wErr } = await supabase
      .from('weddings')
      .select('id, slug, groom_name, bride_name, theme, is_published, is_active, created_at, expires_at, payment_status, plan, plan_expires_at, cover_image_url, gallery_images, free_side, user_id')
      .in('id', ms.map(m => m.wedding_id))
    if (wErr) return fail(wErr.message, 500)

    const sideOf = new Map(ms.map(m => [m.wedding_id, m.side]))
    const rows = (ws ?? [])
      .filter(w => w.is_active !== false && w.user_id !== user.id && !isFreePlan(w))
      .map(({ payment_status, plan, plan_expires_at, free_side: _fs, user_id: _u, is_active: _a, ...w }) => {
        const cur = currentPlan({ payment_status, plan })
        return { ...w, plan: cur, plan_expires_at: cur ? plan_expires_at : null, free_side: null, shared: true, member_side: sideOf.get(w.id) ?? null }
      })
    return ok(rows)
  }

  // ── GET: đọc guests hoặc thông tin thiệp ─────────────────────────────────
  if (req.method === 'GET') {
    const wedding_id = url.searchParams.get('wedding_id')
    if (!wedding_id) return fail('Thiếu wedding_id')

    const access = await authorize(wedding_id)
    if (access instanceof Response) return access

    // Danh sách khách — thành viên một bên chỉ nhận bên đó.
    if (action === 'list') {
      const asked = url.searchParams.get('side')
      const denied = asked ? denySide(access, asked) : null
      if (denied) return denied
      const side = asked || access.side
      let query = supabase.from('guests').select('*').eq('wedding_id', wedding_id)
      if (side) query = query.eq('side', side)
      const { data, error } = await query.order('created_at', { ascending: true })
      if (error) return fail(error.message, 500)
      return ok(data ?? [])
    }

    // Thông tin thiệp cần thiết cho trang quản lý khách
    if (action === 'wedding') {
      const { data, error } = await supabase
        .from('weddings')
        .select('slug, share_message_template, payment_status, free_side')
        .eq('id', wedding_id)
        .single()
      if (error) return fail('Thiệp không tồn tại', 404)
      // Trả trần đã suy ra, không trả payment_status (dữ liệu thanh toán).
      const { payment_status, free_side, ...rest } = data
      const row = { payment_status, free_side }
      return ok({
        ...rest,
        max_per_side: Math.max(sideCap(row, 'groom'), sideCap(row, 'bride')),
        side_caps: { groom: sideCap(row, 'groom'), bride: sideCap(row, 'bride') },
        free_side: freeSide(row),
        is_free: isFreePlan(row),
        // Trang Khách mời: owner thấy nút Thành viên; member chỉ thấy bên member_side.
        role: access.role,
        member_side: access.side,
      })
    }

    // Thành viên của thiệp — chỉ chủ thiệp xem.
    if (action === 'members') {
      if (access.role === 'member') return fail('Chỉ chủ thiệp quản lý thành viên', 403)
      const { data, error } = await supabase
        .from('wedding_members')
        .select('email, side, user_id, created_at')
        .eq('wedding_id', wedding_id)
        .maybeSingle()
      if (error) return fail(error.message, 500)
      return ok({
        member: data
          ? { email: data.email, side: data.side, joined: !!data.user_id, created_at: data.created_at }
          : null,
      })
    }

    return fail('action không hợp lệ cho GET')
  }

  // ── DELETE: xóa guests theo danh sách IDs ────────────────────────────────
  if (req.method === 'DELETE') {
    const body = await req.json()
    const ids: string[] = body.ids ?? []
    if (!Array.isArray(ids) || ids.length === 0) return fail('Thiếu ids')
    if (ids.length > 200) return fail('Quá nhiều IDs trong một request')

    // Validate định dạng UUID để tránh injection
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!ids.every(id => uuidRe.test(id))) return fail('ID không hợp lệ')

    const denied = await denyIfNotAllowedGuests(ids)
    if (denied) return denied

    const { error } = await supabase.from('guests').delete().in('id', ids)
    if (error) return fail(error.message, 500)
    return ok({ deleted: ids.length })
  }

  // ── PATCH: cập nhật guest hoặc links ────────────────────────────────────
  if (req.method === 'PATCH') {
    const body = await req.json()

    // Cập nhật thông tin khách (Sửa từ UI)
    if (action === 'update-guest') {
      const { id, full_name, display_name, relationship } = body
      if (!id) return fail('Thiếu id')

      const full = String(full_name ?? '').trim().slice(0, MAX_FIELD_LEN)
      if (!full) return fail('Họ và tên không được để trống')

      const denied = await denyIfNotAllowedGuests([id])
      if (denied) return denied

      const { error } = await supabase.from('guests').update({
        full_name: full,
        display_name: String(display_name ?? '').trim().slice(0, MAX_FIELD_LEN),
        relationship: String(relationship ?? '').trim().slice(0, MAX_REL_LEN),
      }).eq('id', id)

      if (error) return fail(error.message, 500)
      return ok({ success: true })
    }

    // Cập nhật link hàng loạt (sau import / thêm khách)
    if (action === 'update-links-batch') {
      const updates: { id: string; link: string }[] = body.updates ?? []
      if (!Array.isArray(updates) || updates.length === 0) return fail('Thiếu updates')
      if (updates.length > 200) return fail('Quá nhiều bản ghi trong một lần cập nhật')

      const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      for (const u of updates) {
        if (!uuidRe.test(u.id)) return fail(`ID không hợp lệ: ${u.id}`)
        if (!u.link || u.link.length > 2048) return fail('Link không hợp lệ')
      }

      const denied = await denyIfNotAllowedGuests(updates.map(u => u.id))
      if (denied) return denied

      // Upsert link cho từng guest trong batch
      const promises = updates.map(u =>
        supabase.from('guests').update({ link: u.link }).eq('id', u.id)
      )
      const results = await Promise.all(promises)
      const firstErr = results.find(r => r.error)
      if (firstErr?.error) return fail(firstErr.error.message, 500)

      return ok({ updated: updates.length })
    }

    // Chủ thiệp xoá một lời chúc khỏi hàng guests (khách gửi rồi không tự xoá được)
    if (action === 'delete-wish') {
      const { guest_id, wish_id } = body
      if (!guest_id || !wish_id) return fail('Thiếu guest_id hoặc wish_id')

      const denied = await denyIfNotAllowedGuests([guest_id])
      if (denied) return denied

      const { data: row, error: readErr } = await supabase
        .from('guests')
        .select('wishes')
        .eq('id', guest_id)
        .maybeSingle()

      if (readErr) return fail(readErr.message, 500)
      if (!row) return fail('Không tìm thấy khách mời', 404)

      const kept = readWishes(row.wishes).filter(w => w.id !== String(wish_id))

      const { error } = await supabase.from('guests').update({ wishes: kept }).eq('id', guest_id)
      if (error) return fail(error.message, 500)
      return ok({ wishes: kept })
    }

    return fail('action không hợp lệ cho PATCH')
  }

  // ── POST công khai: khách mời gửi lời chúc ───────────────────────────────
  // KHÔNG cần đăng nhập, nhưng KHÔNG mở cho người lạ: phải khớp một hàng guests
  // có sẵn của đúng thiệp (xem findGuestByLink) — không khớp là 403, khác với
  // rsvp vốn trả 200 { matched:false } cho êm. Mỗi khách tối đa
  // MAX_WISHES_PER_GUEST lời chúc; gửi rồi không sửa/xoá được (chỉ chủ thiệp xoá).
  if (req.method === 'POST' && action === 'wish') {
    const body = await req.json()
    const slug = String(body.slug ?? '').trim()
    const name = String(body.name ?? '').trim().slice(0, MAX_FIELD_LEN)
    const relationship = String(body.relationship ?? '').trim().slice(0, MAX_REL_LEN)
    const text = String(body.text ?? '').trim()

    if (!slug || !name) return fail('Thiếu thông tin khách mời')
    if (!text) return fail('Lời chúc không được để trống')
    if (text.length > MAX_WISH_LEN) return fail(`Lời chúc tối đa ${MAX_WISH_LEN} ký tự`)

    const { data: wedding, error: wErr } = await supabase
      .from('weddings')
      .select('id, enable_wishes')
      .eq('slug', slug)
      .maybeSingle()

    if (wErr) {
      log.error('guest.wish_wedding_failed', { slug, code: wErr.code, message: wErr.message })
      return fail('Không đọc được thiệp, vui lòng thử lại', 500)
    }
    if (!wedding) return fail('Thiệp không tồn tại', 404)
    if (wedding.enable_wishes === false) return fail('Thiệp này đang tắt phần lời chúc', 403)

    const { error: listErr, guest } = await findGuestByLink(
      supabase, wedding.id, name, relationship,
      'id, full_name, display_name, relationship, wishes'
    )
    if (listErr) return fail(listErr, 500)

    if (!guest) {
      log.warn('guest.wish.denied', { slug })
      return fail('Chỉ khách mời có thiệp riêng mới gửi được lời chúc', 403)
    }

    const wishes = readWishes(guest.wishes)
    if (wishes.length >= MAX_WISHES_PER_GUEST) {
      return fail(`Bạn đã gửi tối đa ${MAX_WISHES_PER_GUEST} lời chúc rồi`, 409)
    }

    const wish = { id: crypto.randomUUID(), text, at: new Date().toISOString() }
    const { error: upErr } = await supabase
      .from('guests')
      .update({ wishes: [...wishes, wish] })
      .eq('id', guest.id)

    if (upErr) return fail(upErr.message, 500)

    log.info('guest.wish', { slug })
    return ok({
      wish: {
        ...wish,
        name: String(guest.display_name || guest.full_name || '').trim(),
        relationship: String(guest.relationship ?? ''),
      },
      remaining: MAX_WISHES_PER_GUEST - wishes.length - 1,
    }, 201)
  }

  // ── POST công khai: khách mở thiệp bằng link cá nhân hoá → đánh dấu Đã xem ──
  // Cùng cổng khớp khách như rsvp; chỉ ghi lần mở ĐẦU (viewed_at giữ mốc đó). Trả
  // kèm trạng thái xác nhận để thiệp giấu sẵn hai nút khi khách đã trả lời rồi.
  if (req.method === 'POST' && action === 'view') {
    const body = await req.json()
    const slug = String(body.slug ?? '').trim()
    const name = String(body.name ?? '').trim().slice(0, MAX_FIELD_LEN)
    const relationship = String(body.relationship ?? '').trim().slice(0, MAX_REL_LEN)

    if (!slug || !name) return fail('Thiếu thông tin khách mời')

    const { data: wedding, error: wErr } = await supabase
      .from('weddings')
      .select('id')
      .eq('slug', slug)
      .maybeSingle()

    if (wErr) return fail(wErr.message, 500)
    if (!wedding) return fail('Thiệp không tồn tại', 404)

    const { error: listErr, guest } = await findGuestByLink(
      supabase, wedding.id, name, relationship,
      'id, full_name, display_name, relationship, viewed, confirmed'
    )
    if (listErr) return fail(listErr, 500)

    if (!guest) {
      log.warn('guest.view.nomatch', { slug })
      return ok({ matched: false })
    }

    if (!guest.viewed) {
      const { error: upErr } = await supabase
        .from('guests')
        .update({ viewed: true, viewed_at: new Date().toISOString() })
        .eq('id', guest.id)
      if (upErr) return fail(upErr.message, 500)
    }

    return ok({ matched: true, confirmed: guest.confirmed ?? null })
  }

  // ── POST công khai: khách mời tự xác nhận tham dự ────────────────────────
  // KHÔNG cần đăng nhập — người gọi là khách cầm link cá nhân hoá. Chỉ CẬP NHẬT
  // cột xác nhận của một hàng guests CÓ SẴN, khớp theo slug thiệp + tên hiển thị
  // + xưng hô ghi trên link; không tạo, không xoá, không trả danh sách khách ra
  // ngoài (chỉ trả matched true/false).
  if (req.method === 'POST' && action === 'rsvp') {
    const body = await req.json()
    const slug = String(body.slug ?? '').trim()
    const name = String(body.name ?? '').trim().slice(0, MAX_FIELD_LEN)
    const relationship = String(body.relationship ?? '').trim().slice(0, MAX_REL_LEN)
    const attending = body.attending === true || body.attending === 'true'
    const message = String(body.message ?? '').trim().slice(0, 1000)

    if (!slug || !name) return fail('Thiếu thông tin khách mời')

    const { data: wedding, error: wErr } = await supabase
      .from('weddings')
      .select('id')
      .eq('slug', slug)
      .maybeSingle()

    if (wErr) return fail(wErr.message, 500)
    if (!wedding) return fail('Thiệp không tồn tại', 404)

    const { error: listErr, guest } = await findGuestByLink(
      supabase, wedding.id, name, relationship,
      'id, full_name, display_name, relationship, viewed'
    )
    if (listErr) return fail(listErr, 500)

    // Không khớp khách nào (chủ thiệp đã xoá/đổi tên sau khi gửi link): không
    // phải lỗi của khách → vẫn 200 để thiệp hiện lời cảm ơn, chỉ báo matched.
    if (!guest) {
      log.warn('guest.rsvp.nomatch', { slug })
      return ok({ matched: false })
    }

    const patch: Record<string, unknown> = {
      confirmed: attending ? 'Có tham dự' : 'Không tham dự',
      confirmed_at: new Date().toISOString(),
    }
    if (message) patch.message = message
    // Trả lời được tức là đã mở thiệp — lỡ lượt ghi "view" hỏng thì bù ở đây.
    if (!guest.viewed) {
      patch.viewed = true
      patch.viewed_at = patch.confirmed_at
    }

    const { error: upErr } = await supabase.from('guests').update(patch).eq('id', guest.id)
    if (upErr) return fail(upErr.message, 500)

    log.info('guest.rsvp', { slug, attending })
    return ok({ matched: true })
  }

  // ── POST: chủ thiệp mời / gỡ thành viên (tối đa 1 người, xem dqvinh_006) ──
  if (req.method === 'POST' && (action === 'member-add' || action === 'member-remove')) {
    const body = await req.json()
    const wedding_id = String(body.wedding_id ?? '')
    if (!wedding_id) return fail('Thiếu wedding_id')

    const access = await authorize(wedding_id)
    if (access instanceof Response) return access
    if (access.role === 'member') return fail('Chỉ chủ thiệp quản lý thành viên', 403)

    if (action === 'member-remove') {
      const { error } = await supabase.from('wedding_members').delete().eq('wedding_id', wedding_id)
      if (error) return fail(error.message, 500)
      return ok({ removed: true })
    }

    if (access.wedding && isFreePlan(access.wedding)) {
      return fail('Gói Miễn phí không thêm được thành viên. Nâng gói để mời người cùng quản lý khách mời.', 403)
    }
    const email = String(body.email ?? '').trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return fail('Email không hợp lệ')
    const me = isAdmin ? null : await getAuthUser()
    if (me?.email && me.email === email) return fail('Đây là email của chính bạn — hãy nhập email của người cùng quản lý')
    const side = body.side === 'groom' || body.side === 'bride' ? body.side : null

    const { data, error } = await supabase
      .from('wedding_members')
      .insert({ wedding_id, email, side, invited_by: me?.id ?? null })
      .select('email, side, user_id, created_at')
      .single()
    if (error?.code === '23505') return fail('Thiệp đã có thành viên. Gỡ người hiện tại trước khi mời người khác.', 409)
    if (error) return fail(error.message, 500)
    log.info('guest.member_added', { wedding_id, side })
    return ok({ member: { email: data.email, side: data.side, joined: !!data.user_id, created_at: data.created_at } }, 201)
  }

  // ── POST: thêm 1 khách hoặc import ──────────────────────────────────────
  if (req.method === 'POST') {
    const body = await req.json()
    const { wedding_id, side } = body

    if (!wedding_id || !side || !['groom', 'bride'].includes(side)) {
      return fail('Thiếu wedding_id hoặc side không hợp lệ')
    }

    const access = await authorize(wedding_id)
    if (access instanceof Response) return access
    const sideDenied = denySide(access, side)
    if (sideDenied) return sideDenied

    // Xác nhận wedding tồn tại + lấy trạng thái thanh toán để chọn trần. Đọc hỏng là
    // dừng: đoán sai trần là mở rộng giới hạn cho thiệp chưa thanh toán.
    const { data: wedding, error: wErr } = await supabase
      .from('weddings')
      .select('id, payment_status, free_side')
      .eq('id', wedding_id)
      .maybeSingle()

    if (wErr) return fail('Không đọc được thiệp, vui lòng thử lại', 500)
    if (!wedding) return fail('Thiệp không tồn tại', 404)

    const cap = sideCap(wedding, side)
    const capMsg = capMessage(wedding, side, cap)

    // Đếm hiện tại của bên này
    const { count: currentCount, error: countErr } = await supabase
      .from('guests')
      .select('id', { count: 'exact', head: true })
      .eq('wedding_id', wedding_id)
      .eq('side', side)

    // Đếm hỏng mà vẫn chạy tiếp thì `existing = 0` → trần mỗi bên coi như
    // không tồn tại. Dừng lại, đừng đoán.
    if (countErr) return fail('Không đếm được danh sách khách, vui lòng thử lại', 500)

    const existing = currentCount ?? 0

    // ── Thêm 1 khách ──
    if (action === 'insert-one') {
      if (existing >= cap) return fail(capMsg)

      const g = sanitizeGuest(body.guest ?? {}, wedding_id, side)
      if (!g.full_name) return fail('Họ và tên không được để trống')

      const { data, error } = await supabase.from('guests').insert(g).select().single()
      if (error) return fail(error.message, 500)
      return ok(data, 201)
    }

    // ── Import hàng loạt ──
    if (action === 'import') {
      const raw: Record<string, unknown>[] = body.guests ?? []
      const overwrite: boolean = body.overwrite ?? false

      if (!Array.isArray(raw) || raw.length === 0) return fail('Không có dữ liệu')
      if (raw.length > MAX_PER_SIDE) return fail(`File vượt quá ${MAX_PER_SIDE} dòng`)

      const guests = raw
        .map(g => sanitizeGuest(g, wedding_id, side))
        .filter(g => g.full_name)

      if (guests.length === 0) return fail('Không có dữ liệu hợp lệ')

      if (overwrite) {
        // Xóa các bản ghi trùng (guestKey), giữ bản ghi không trùng
        const importKeys = new Set(guests.map(guestKey))

        const { data: existingRows, error: exErr } = await supabase
          .from('guests')
          .select('id, full_name, display_name, relationship')
          .eq('wedding_id', wedding_id)
          .eq('side', side)

        // Đọc hỏng → danh sách trùng rỗng → không xoá gì mà vẫn chèn tiếp, nên
        // "ghi đè" lại đẻ ra bản trùng.
        if (exErr) return fail(exErr.message, 500)

        const idsToDelete = (existingRows ?? [])
          .filter(e => importKeys.has(guestKey(e)))
          .map(e => e.id)

        if (idsToDelete.length > 0) {
          const { error: delErr } = await supabase.from('guests').delete().in('id', idsToDelete)
          // Bỏ qua lỗi ở đây là import "ghi đè" hoá ra thêm trùng: bản cũ còn
          // nguyên mà bản mới vẫn chèn vào.
          if (delErr) return fail(delErr.message, 500)
        }

        // Đếm lại sau khi xóa, kiểm tra tổng không vượt giới hạn
        const { count: afterCount, error: afterErr } = await supabase
          .from('guests')
          .select('id', { count: 'exact', head: true })
          .eq('wedding_id', wedding_id)
          .eq('side', side)

        // Như trên: hỏng mà coi như 0 là mở đường nhập quá trần.
        if (afterErr) return fail('Không đếm được danh sách khách, vui lòng thử lại', 500)

        const remaining = (afterCount ?? 0)
        if (remaining + guests.length > cap) {
          return fail(
            cap === MAX_PER_SIDE
              ? `Tổng khách bên ${side === 'groom' ? 'nhà trai' : 'nhà gái'} sẽ vượt ${cap}. Hiện còn ${remaining} khách.`
              : `${capMsg} Hiện đang có ${remaining} khách.`,
            409
          )
        }

        // Batch insert
        for (let i = 0; i < guests.length; i += BATCH_SIZE) {
          const { error } = await supabase.from('guests').insert(guests.slice(i, i + BATCH_SIZE))
          if (error) return fail(error.message, 500)
        }

        return ok({ inserted: guests.length, skipped: 0 })
      } else {
        // Bỏ qua trùng lặp
        const { data: existingRows, error: exErr } = await supabase
          .from('guests')
          .select('full_name, display_name, relationship')
          .eq('wedding_id', wedding_id)
          .eq('side', side)

        // Đọc hỏng → không thấy ai trùng → chèn lại toàn bộ danh sách.
        if (exErr) return fail(exErr.message, 500)

        const existingKeys = new Set((existingRows ?? []).map(guestKey))

        const newGuests = guests.filter(g => !existingKeys.has(guestKey(g)))
        const canInsert = Math.max(0, cap - existing)
        const toInsert = newGuests.slice(0, canInsert)

        if (toInsert.length > 0) {
          for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
            const { error } = await supabase.from('guests').insert(toInsert.slice(i, i + BATCH_SIZE))
            if (error) return fail(error.message, 500)
          }
        }

        return ok({
          inserted: toInsert.length,
          skipped: guests.length - toInsert.length,
          capped: newGuests.length > toInsert.length,
        })
      }
    }

    return fail('action không hợp lệ cho POST')
  }

  return fail('Method not allowed', 405)
}))
