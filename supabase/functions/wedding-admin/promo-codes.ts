// resource=promo-codes — danh mục mã giảm giá: sinh hàng loạt / tạo mã tự đặt / sửa / xoá.
// Người gọi: nhân viên /admin-support (SUPPORT_EMAILS) — quyền kiểm ở index.ts TRƯỚC khi vào đây,
// `actor` là email nhân viên để ghi vết. Việc TIÊU mã nằm ở payment-handler (cx_promo_reserve), ở đây
// chỉ quản lý danh mục.

import type { Logger } from '../_shared/axiom.ts'

// deno-lint-ignore no-explicit-any
type Db = any

// Bỏ 0/O/1/I/L để đọc-chép tay không nhầm.
const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'
const CODE_RE = /^[A-Z0-9-]{3,40}$/
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const BATCH_RE = /^B[0-9A-Z]{1,20}$/

const randomPart = (len: number) => {
  const bytes = crypto.getRandomValues(new Uint8Array(len))
  return Array.from(bytes, b => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('')
}

// Ngày hết hạn: rỗng = không hết hạn; sai dạng → undefined (báo 400).
function parseExpiry(v: unknown): string | null | undefined {
  if (v === null || v === undefined || v === '') return null
  const t = new Date(String(v))
  return Number.isNaN(t.getTime()) ? undefined : t.toISOString()
}
// Số lượt: rỗng / null = không giới hạn.
function parseMaxUses(v: unknown): number | null | undefined {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isInteger(n) && n >= 1 ? n : undefined
}

export async function handlePromoCodes(
  req: Request,
  url: URL,
  supabase: Db,
  log: Logger,
  corsHeaders: Record<string, string>,
  actor: string,
): Promise<Response> {
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  const method = req.method

  // GET ?view=report&month=YYYY-MM — báo cáo mã đã dùng trong tháng (căn cứ trả hoa hồng người giới thiệu)
  if (method === 'GET' && url.searchParams.get('view') === 'report') return promoReport(url, supabase, log, json)

  // GET - danh sách mã, mỗi mã kèm toàn bộ lần áp mã còn hiệu lực
  if (method === 'GET') {
    const q = url.searchParams.get('q')?.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '')
    const batchId = url.searchParams.get('batch_id')?.trim()

    let query = supabase.from('promo_codes').select('*').order('created_at', { ascending: false }).limit(500)
    if (q) query = query.ilike('code', `%${q}%`)
    if (batchId && BATCH_RE.test(batchId)) query = query.eq('batch_id', batchId)

    const { data, error } = await query
    if (error) {
      log.error('promo.list_failed', { code: error.code, message: error.message })
      return json({ error: 'Không tải được danh sách mã' }, 500)
    }

    // Kèm các lần áp mã (để thấy mã đã đi vào đơn nào).
    const ids = (data ?? []).map((c: { id: string }) => c.id)
    let redemptions: Record<string, unknown>[] = []
    if (ids.length) {
      const { data: rd, error: rdErr } = await supabase
        .from('promo_redemptions')
        .select('code_id, order_id, manage_id, user_key, status, final_amount, discount_amount, redeemed_at, reserved_at, expires_at')
        .in('code_id', ids)
        .in('status', ['reserved', 'redeemed'])
        .order('reserved_at', { ascending: false })
      // Bảng vẫn hiện được danh sách mã, chỉ thiếu phần lượt đã dùng — im lặng ở đây là người xem
      // tưởng mã chưa ai dùng.
      if (rdErr) log.error('promo.redemptions_read_failed', { code: rdErr.code, message: rdErr.message })
      redemptions = rd ?? []
    }

    const byCode: Record<string, unknown[]> = {}
    for (const r of redemptions) (byCode[r.code_id as string] ||= []).push(r)
    // deno-lint-ignore no-explicit-any
    return json((data ?? []).map((c: any) => ({ ...c, redemptions: byCode[c.id] ?? [] })))
  }

  // POST - sinh mã. mode='generate' (hàng loạt, phần đuôi ngẫu nhiên) hoặc mode='single' (tự gõ mã đẹp).
  if (method === 'POST') {
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') return json({ error: 'Dữ liệu không hợp lệ' }, 400)
    const { mode = 'generate', prefix = '', count = 1, length = 6, code: manualCode, discount_type, discount_value, min_order_amount = 0, note = null } = body

    if (!['percent', 'fixed'].includes(discount_type)) return json({ error: 'discount_type phải là percent hoặc fixed' }, 400)
    const value = Number(discount_value)
    if (!Number.isFinite(value) || value <= 0 || (discount_type === 'percent' && value > 100)) {
      return json({ error: 'Giá trị giảm không hợp lệ' }, 400)
    }
    const expires_at = parseExpiry(body.expires_at)
    if (expires_at === undefined) return json({ error: 'Hạn dùng không hợp lệ' }, 400)
    const max_uses = parseMaxUses(body.max_uses)
    if (max_uses === undefined) return json({ error: 'Số lượt phải là số nguyên từ 1' }, 400)

    const batch_id = `B${Date.now().toString(36).toUpperCase()}`
    const common = {
      discount_type,
      discount_value: Math.round(value),
      expires_at,
      min_order_amount: Math.max(0, Math.round(Number(min_order_amount) || 0)),
      max_uses,
      note: note ? String(note).slice(0, 200) : null,
      batch_id,
      is_active: true,
      used_count: 0,
    }

    if (mode === 'single') {
      const code = String(manualCode || '').trim().toUpperCase()
      if (!CODE_RE.test(code)) return json({ error: 'Mã chỉ gồm chữ không dấu, số, dấu -, dài 3–40 ký tự' }, 400)
      const { data, error } = await supabase.from('promo_codes').insert([{ ...common, code }]).select().single()
      if (error) {
        if (error.code === '23505') return json({ error: `Mã ${code} đã tồn tại` }, 400)
        log.error('promo.insert_failed', { code: error.code, message: error.message, by: actor })
        return json({ error: 'Không tạo được mã' }, 500)
      }
      log.info('promo.generated', { batch_id, count: 1, discount_type, discount_value: common.discount_value, by: actor })
      return json({ batch_id, codes: [data] })
    }

    const total = Math.min(Math.max(1, Number(count) || 1), 200)
    const len = Math.min(Math.max(4, Number(length) || 6), 12)
    const cleanPrefix = String(prefix || '').trim().toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 20)

    // Sinh dư rồi khử trùng tại chỗ; mã đụng hàng trong DB (unique) thì thử lại cả lô còn thiếu, tối đa 5 vòng.
    const created: Record<string, unknown>[] = []
    const seen = new Set<string>()
    for (let round = 0; round < 5 && created.length < total; round++) {
      const need = total - created.length
      const batch: Record<string, unknown>[] = []
      while (batch.length < need) {
        const code = cleanPrefix + randomPart(len)
        if (seen.has(code)) continue
        seen.add(code)
        batch.push({ ...common, code })
      }
      const { data, error } = await supabase.from('promo_codes').insert(batch).select()
      if (!error) {
        created.push(...(data ?? []))
        continue
      }
      if (error.code !== '23505') {
        log.error('promo.insert_failed', { batch_id, code: error.code, message: error.message, by: actor })
        return json({ error: 'Không sinh được mã' }, 500)
      }
      // Đụng mã: chèn lại từng cái, bỏ qua cái trùng.
      for (const row of batch) {
        const { data: one, error: oneErr } = await supabase.from('promo_codes').insert([row]).select().single()
        if (!oneErr && one) created.push(one)
        else if (oneErr && oneErr.code !== '23505') log.error('promo.insert_failed', { batch_id, code: oneErr.code, message: oneErr.message, by: actor })
      }
    }

    if (!created.length) {
      log.error('promo.generate_empty', { batch_id, by: actor })
      return json({ error: 'Không sinh được mã nào, thử lại' }, 500)
    }
    log.info('promo.generated', { batch_id, count: created.length, discount_type, discount_value: common.discount_value, by: actor })
    return json({ batch_id, codes: created })
  }

  // PATCH - chỉ các trường quản lý được: bật/tắt, số lượt, hạn dùng, ghi chú. Mã, giá trị giảm và
  // used_count (sổ sách của cx_promo_*) không sửa ở đây.
  if (method === 'PATCH') {
    const body = await req.json().catch(() => null)
    const id = body?.id
    if (typeof id !== 'string' || !UUID_RE.test(id)) return json({ error: 'Missing id' }, 400)

    const patch: Record<string, unknown> = {}
    if ('is_active' in body) patch.is_active = !!body.is_active
    if ('note' in body) patch.note = body.note ? String(body.note).slice(0, 200) : null
    if ('expires_at' in body) {
      const v = parseExpiry(body.expires_at)
      if (v === undefined) return json({ error: 'Hạn dùng không hợp lệ' }, 400)
      patch.expires_at = v
    }
    if ('max_uses' in body) {
      const v = parseMaxUses(body.max_uses)
      if (v === undefined) return json({ error: 'Số lượt phải là số nguyên từ 1' }, 400)
      patch.max_uses = v
    }
    if (!Object.keys(patch).length) return json({ error: 'Không có gì để sửa' }, 400)

    const { data, error } = await supabase.from('promo_codes').update(patch).eq('id', id).select().maybeSingle()
    if (error) {
      log.error('promo.update_failed', { promo_id: id, code: error.code, message: error.message, by: actor })
      return json({ error: 'Không sửa được mã' }, 500)
    }
    if (!data) return json({ error: 'Không tìm thấy mã' }, 404)
    log.info('promo.updated', { promo_id: id, promo_code: data.code, fields: Object.keys(patch), by: actor })
    return json(data)
  }

  // DELETE - xoá mã chưa ai dùng. Mã đã có đơn chốt thì chỉ được TẮT, để giữ vết đơn hàng
  // (promo_redemptions tham chiếu tới).
  if (method === 'DELETE') {
    const id = url.searchParams.get('id')
    const batchId = url.searchParams.get('batch_id')
    if (id ? !UUID_RE.test(id) : !batchId || !BATCH_RE.test(batchId)) return json({ error: 'Missing id' }, 400)

    let target = supabase.from('promo_codes').select('id')
    target = id ? target.eq('id', id) : target.eq('batch_id', batchId!)
    const { data: codes, error: codesErr } = await target
    if (codesErr) {
      log.error('promo.lookup_failed', { code: codesErr.code, message: codesErr.message })
      return json({ error: 'Không tìm được mã' }, 500)
    }
    const codeIds = (codes ?? []).map((c: { id: string }) => c.id)
    if (!codeIds.length) return json({ error: 'Không tìm thấy mã' }, 404)

    const { data: used, error: usedErr } = await supabase
      .from('promo_redemptions')
      .select('code_id')
      .in('code_id', codeIds)
      .eq('status', 'redeemed')
    // Đây là chốt duy nhất giữ lại mã ĐÃ dùng cho đơn hàng. Truy vấn hỏng mà vẫn chạy tiếp thì danh
    // sách "đã dùng" rỗng → xoá sạch, không lùi được.
    if (usedErr) {
      log.error('promo.used_lookup_failed', { code: usedErr.code, message: usedErr.message })
      return json({ error: 'Không kiểm tra được mã đã dùng, chưa xoá gì cả' }, 500)
    }

    const usedIds = new Set((used ?? []).map((r: { code_id: string }) => r.code_id))
    const deletable = codeIds.filter((cid: string) => !usedIds.has(cid))
    if (!deletable.length) return json({ error: 'Mã đã được dùng cho đơn hàng, chỉ có thể tắt chứ không xoá' }, 409)

    const { error } = await supabase.from('promo_codes').delete().in('id', deletable)
    if (error) {
      log.error('promo.delete_failed', { code: error.code, message: error.message, by: actor })
      return json({ error: 'Không xoá được mã' }, 500)
    }
    log.info('promo.deleted', { promo_id: id, batch_id: batchId, deleted: deletable.length, by: actor })
    return json({ success: true, deleted: deletable.length, kept: codeIds.length - deletable.length })
  }

  return json({ error: 'Method not allowed' }, 405)
}

// Báo cáo tháng: mọi lượt áp mã ĐÃ THANH TOÁN (status redeemed) có redeemed_at trong tháng, tính theo
// giờ Việt Nam (UTC+7) — tháng là kỳ trả hoa hồng nên ranh giới phải khớp lịch của mình, không phải UTC.
// Lượt giữ chỗ bỏ ngang / đã huỷ không tính. Kèm thiệp (slug, tên) để đối chiếu từng đơn.
const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/
const VN_OFFSET_MS = 7 * 3600 * 1000

async function promoReport(
  url: URL,
  supabase: Db,
  log: Logger,
  json: (body: unknown, status?: number) => Response,
): Promise<Response> {
  const month = url.searchParams.get('month') ?? ''
  const m = MONTH_RE.exec(month)
  if (!m) return json({ error: 'Tháng không hợp lệ (YYYY-MM)' }, 400)
  const y = Number(m[1])
  const mo = Number(m[2])
  const from = new Date(Date.UTC(y, mo - 1, 1) - VN_OFFSET_MS).toISOString()
  const to = new Date(Date.UTC(y, mo, 1) - VN_OFFSET_MS).toISOString()

  // deno-lint-ignore no-explicit-any
  const rows: any[] = []
  for (let off = 0; ; off += 1000) {
    const { data, error } = await supabase
      .from('promo_redemptions')
      .select('order_id, code_id, code, manage_id, base_amount, discount_amount, final_amount, redeemed_at, promo_codes(note, discount_type, discount_value)')
      .eq('status', 'redeemed')
      .gte('redeemed_at', from)
      .lt('redeemed_at', to)
      .order('redeemed_at', { ascending: true })
      .order('order_id')
      .range(off, off + 999)
    // Đây là căn cứ trả tiền: đọc hỏng giữa chừng mà trả về phần đã đọc là báo thiếu đơn → dừng hẳn.
    if (error) {
      log.error('promo.report_failed', { month, code: error.code, message: error.message })
      return json({ error: 'Không đọc được lượt dùng mã' }, 500)
    }
    rows.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }

  // Thiệp của từng đơn: chỉ để hiện tên/slug, đọc hỏng thì vẫn trả báo cáo (thiếu cột thiệp) kèm log.
  const ids = [...new Set(rows.map((r) => r.manage_id).filter((id) => typeof id === 'string' && UUID_RE.test(id)))]
  const weddings = new Map<string, { slug: string | null; couple: string }>()
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await supabase.from('weddings').select('id, slug, groom_name, bride_name').in('id', ids.slice(i, i + 200))
    if (error) {
      log.error('promo.report_weddings_failed', { month, code: error.code, message: error.message })
      break
    }
    for (const w of data ?? []) weddings.set(w.id, { slug: w.slug, couple: [w.groom_name, w.bride_name].filter(Boolean).join(' & ') })
  }

  return json({
    month,
    from,
    to,
    orders: rows.map((r) => {
      const c = Array.isArray(r.promo_codes) ? r.promo_codes[0] : r.promo_codes
      const w = r.manage_id ? weddings.get(r.manage_id) : null
      return {
        order_id: r.order_id,
        code_id: r.code_id,
        code: r.code,
        note: c?.note ?? null,
        discount_type: c?.discount_type ?? null,
        discount_value: c?.discount_value ?? null,
        base_amount: r.base_amount,
        discount_amount: r.discount_amount,
        final_amount: r.final_amount,
        redeemed_at: r.redeemed_at,
        slug: w?.slug ?? null,
        couple: w?.couple ?? null,
      }
    }),
  })
}
