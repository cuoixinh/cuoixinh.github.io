import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { withAxiom } from '../_shared/axiom.ts'

// ── CORS ─────────────────────────────────────────────────────────────────────
// Allowlist origin thay cho '*' (danh sách giống ai-invitation). CORS chỉ ràng
// buộc trình duyệt — lớp bảo vệ thật là kiểm tra chủ sở hữu thiệp bên dưới.
const ALLOWED_ORIGINS = [
  'https://cuoixinh.com',
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

const MAX_PER_SIDE = 100
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

  function fail(message: string, status = 400) {
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const url = new URL(req.url)
  const action = url.searchParams.get('action') ?? ''

  // ── Phân quyền ────────────────────────────────────────────────────────────
  // Trước đây toàn bộ function KHÔNG có xác thực: chỉ cần biết wedding_id là
  // đọc/sửa/xoá được danh sách khách mời của bất kỳ đám cưới nào.
  // Chính sách mới: phải đăng nhập và phải là chủ thiệp (xem docs/security-audit-plan.md #3).
  const isAdmin = (req.headers.get('x-admin-token') ?? '') === Deno.env.get('ADMIN_SECRET_TOKEN')

  async function getUserId(): Promise<string | null> {
    const authHeader = req.headers.get('Authorization') || ''
    const jwt = authHeader.replace(/^Bearer\s+/i, '').trim()
    if (!jwt || jwt === Deno.env.get('SUPABASE_ANON_KEY')) return null
    try {
      const { data, error } = await supabase.auth.getUser(jwt)
      if (error) return null
      return data.user?.id ?? null
    } catch {
      return null
    }
  }

  // Trả về Response lỗi nếu người gọi không phải chủ thiệp, null nếu hợp lệ.
  async function denyIfNotOwner(wedding_id: string): Promise<Response | null> {
    if (isAdmin) return null

    const userId = await getUserId()
    if (!userId) {
      return fail('Vui lòng đăng nhập để quản lý khách mời', 401)
    }

    const { data: wedding } = await supabase
      .from('weddings')
      .select('user_id')
      .eq('id', wedding_id)
      .maybeSingle()

    if (!wedding) return fail('Thiệp không tồn tại', 404)

    // Thiệp cũ chưa có chủ: chưa claim thì chưa cho thao tác khách mời — chủ thật
    // chỉ cần mở trang chỉnh sửa thiệp một lần (đã đăng nhập) là nhận chủ, xem
    // wedding-admin PATCH.
    if (wedding.user_id !== userId) {
      log.warn('guest.forbidden', { wedding_id, userId })
      return fail('Bạn không có quyền quản lý khách mời của thiệp này', 403)
    }
    return null
  }

  // Với thao tác chỉ có guest id: suy ra wedding_id từ chính các bản ghi guest,
  // rồi kiểm tra quyền. Chặn việc sửa/xoá guest thuộc thiệp của người khác.
  async function denyIfNotOwnerOfGuests(ids: string[]): Promise<Response | null> {
    if (isAdmin) return null

    const { data: rows, error } = await supabase
      .from('guests')
      .select('wedding_id')
      .in('id', ids)

    if (error) return fail(error.message, 500)
    if (!rows || rows.length === 0) return fail('Không tìm thấy khách mời', 404)

    const weddingIds = [...new Set(rows.map(r => r.wedding_id))]
    if (weddingIds.length > 1) return fail('Yêu cầu không hợp lệ', 400)

    return await denyIfNotOwner(weddingIds[0])
  }

  // ── GET: đọc guests hoặc thông tin thiệp ─────────────────────────────────
  if (req.method === 'GET') {
    const wedding_id = url.searchParams.get('wedding_id')
    if (!wedding_id) return fail('Thiếu wedding_id')

    const denied = await denyIfNotOwner(wedding_id)
    if (denied) return denied

    // Danh sách khách
    if (action === 'list') {
      const side = url.searchParams.get('side')
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
        .select('slug, share_message_template')
        .eq('id', wedding_id)
        .single()
      if (error) return fail('Thiệp không tồn tại', 404)
      return ok(data)
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

    const denied = await denyIfNotOwnerOfGuests(ids)
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

      const denied = await denyIfNotOwnerOfGuests([id])
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

      const denied = await denyIfNotOwnerOfGuests(updates.map(u => u.id))
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

    return fail('action không hợp lệ cho PATCH')
  }

  // ── POST: thêm 1 khách hoặc import ──────────────────────────────────────
  if (req.method === 'POST') {
    const body = await req.json()
    const { wedding_id, side } = body

    if (!wedding_id || !side || !['groom', 'bride'].includes(side)) {
      return fail('Thiếu wedding_id hoặc side không hợp lệ')
    }

    const denied = await denyIfNotOwner(wedding_id)
    if (denied) return denied

    // Xác nhận wedding tồn tại
    const { data: wedding } = await supabase
      .from('weddings')
      .select('id')
      .eq('id', wedding_id)
      .maybeSingle()

    if (!wedding) return fail('Thiệp không tồn tại', 404)

    // Đếm hiện tại của bên này
    const { count: currentCount } = await supabase
      .from('guests')
      .select('id', { count: 'exact', head: true })
      .eq('wedding_id', wedding_id)
      .eq('side', side)

    const existing = currentCount ?? 0

    // ── Thêm 1 khách ──
    if (action === 'insert-one') {
      if (existing >= MAX_PER_SIDE) {
        return fail(`Đã đạt giới hạn ${MAX_PER_SIDE} khách mời mỗi bên`)
      }

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
        // Xóa các bản ghi trùng full_name + display_name, giữ bản ghi không trùng
        const importKeys = new Set(guests.map(g => `${g.full_name}||${g.display_name}`))

        const { data: existingRows } = await supabase
          .from('guests')
          .select('id, full_name, display_name')
          .eq('wedding_id', wedding_id)
          .eq('side', side)

        const idsToDelete = (existingRows ?? [])
          .filter(e => importKeys.has(`${e.full_name}||${e.display_name}`))
          .map(e => e.id)

        if (idsToDelete.length > 0) {
          await supabase.from('guests').delete().in('id', idsToDelete)
        }

        // Đếm lại sau khi xóa, kiểm tra tổng không vượt giới hạn
        const { count: afterCount } = await supabase
          .from('guests')
          .select('id', { count: 'exact', head: true })
          .eq('wedding_id', wedding_id)
          .eq('side', side)

        const remaining = (afterCount ?? 0)
        if (remaining + guests.length > MAX_PER_SIDE) {
          return fail(
            `Tổng khách bên ${side === 'groom' ? 'nhà trai' : 'nhà gái'} sẽ vượt ${MAX_PER_SIDE}. Hiện còn ${remaining} khách.`,
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
        const { data: existingRows } = await supabase
          .from('guests')
          .select('full_name, display_name')
          .eq('wedding_id', wedding_id)
          .eq('side', side)

        const existingKeys = new Set(
          (existingRows ?? []).map(g => `${g.full_name}||${g.display_name}`)
        )

        const newGuests = guests.filter(g => !existingKeys.has(`${g.full_name}||${g.display_name}`))
        const canInsert = Math.max(0, MAX_PER_SIDE - existing)
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
