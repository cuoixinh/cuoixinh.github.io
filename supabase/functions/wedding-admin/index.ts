import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { withAxiom } from '../_shared/axiom.ts'

// ── CORS ────────────────────────────────────────────────────────────────────
// Allowlist origin thay cho '*'. Chỉ là vệ sinh — CORS ràng buộc trình duyệt,
// curl/script bỏ qua; lớp bảo vệ thật là kiểm tra quyền theo user_id ở PATCH/POST.
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

function buildCorsHeaders(origin: string | null) {
  const allow = origin && isAllowedOrigin(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-token',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Vary': 'Origin',
  }
}

// So sánh chuỗi không phụ thuộc thời gian, tránh rò rỉ token qua timing attack.
// Trả false ngay khi độ dài khác nhau (độ dài không phải bí mật cần bảo vệ).
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length || a.length === 0) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

// Escape ký tự đặc biệt của cú pháp filter PostgREST trước khi ghép vào .or(...).
// Không phải SQL injection, nhưng dấu phẩy/ngoặc trong từ khoá tìm kiếm có thể
// chèn thêm điều kiện lạ vào biểu thức filter.
function escapePostgrestPattern(value: string): string {
  return value.replace(/[,()*\\]/g, '')
}

// ── Bảo mật: field khách được phép tự sửa ───────────────────────────────────
// ALLOWLIST (không phải blocklist): field nào không có tên ở đây sẽ bị loại khỏi
// payload của người dùng thường. Quan trọng nhất là các cột thanh toán
// (payment_status, payment_amount, transaction_id, payment_time,
// payment_order_id, expires_at) — chỉ payment-handler / payos-webhook được ghi.
const CUSTOMER_EDITABLE_FIELDS = new Set([
  'slug', 'is_published',
  // Thông tin chung
  'groom_name', 'bride_name', 'story_quote', 'cover_image_url', 'gallery_images',
  // Lễ thành hôn
  'ceremony_date', 'ceremony_time', 'ceremony_lunar', 'ceremony_name',
  'ceremony_location', 'ceremony_map_embed_url', 'ceremony_use_embed',
  'ceremony_display_order',
  // Lễ vu quy
  'vu_quy_enabled', 'vu_quy_time', 'vu_quy_location', 'vu_quy_map_embed_url',
  'vu_quy_use_embed',
  // Nhà trai
  'groom_father', 'groom_mother', 'groom_address', 'groom_image_url',
  'groom_party_date', 'groom_party_time', 'groom_party_lunar',
  'groom_party_location', 'groom_party_map_embed_url', 'groom_party_use_embed',
  'groom_map_embed_url', 'groom_bank_name', 'groom_bank_number',
  'groom_bank_owner', 'groom_qr_url',
  // Nhà gái
  'bride_father', 'bride_mother', 'bride_address', 'bride_image_url',
  'bride_party_date', 'bride_party_time', 'bride_party_lunar',
  'bride_party_location', 'bride_party_map_embed_url', 'bride_party_use_embed',
  'bride_map_embed_url', 'bride_bank_name', 'bride_bank_number',
  'bride_bank_owner', 'bride_qr_url',
  // Theme & nhạc
  'theme', 'theme_setting', 'music_url',
  // JSONB
  'timeline', 'love_story', 'image_focal_points',
  // RSVP & extras
  'rsvp_enabled', 'rsvp_message', 'footer_text', 'share_message_template',
  // Toggle hiển thị mục
  'enable_family', 'enable_party', 'enable_photos', 'enable_timeline',
  'enable_love_story', 'enable_music', 'enable_gift', 'enable_footer',
])

// ── Bảo mật: chống tráo ảnh (đặc biệt QR mừng cưới) ─────────────────────────
// QR mừng cưới render thẳng qua <img src>; nhận URL tuỳ ý thì kẻ tấn công đổi
// sang QR của nó và khách mời chuyển tiền nhầm. Chỉ chấp nhận tên file trong
// storage của hệ thống hoặc URL thuộc host của hệ thống.
const ALLOWED_IMAGE_HOSTS = new Set([
  'lcobawmkywtxhpezndsh.supabase.co',
  'wedding-image-proxy.cuoixinh-api.workers.dev',
])

const IMAGE_FIELDS = [
  'cover_image_url', 'groom_image_url', 'bride_image_url',
  'groom_qr_url', 'bride_qr_url',
]

// Cho phép: null/'' (xoá ảnh), tên file tương đối trong storage, hoặc URL https
// trên host của hệ thống. Chặn: http(s) ra ngoài, //host, data:, blob:, javascript:.
function isSafeImageRef(value: unknown): boolean {
  if (value === null || value === undefined) return true
  if (typeof value !== 'string') return false
  const v = value.trim()
  if (v === '') return true

  if (v.includes(':') || v.startsWith('//')) {
    try {
      const u = new URL(v)
      return u.protocol === 'https:' && ALLOWED_IMAGE_HOSTS.has(u.hostname)
    } catch {
      return false
    }
  }
  // Đường dẫn tương đối: chặn path traversal
  return !v.includes('..') && !v.startsWith('/') && !v.includes('\\')
}

Deno.serve(withAxiom('wedding-admin', async (req, log) => {
  // Header CORS tính theo Origin của chính request này; mọi chỗ trả response bên
  // dưới dùng biến cục bộ này.
  const corsHeaders = buildCorsHeaders(req.headers.get('Origin'))

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const url = new URL(req.url)
  // Token CHỈ đọc từ header. Trước đây còn chấp nhận ?token= trong query string,
  // khiến mã quản trị lọt vào access log Supabase/Cloudflare, lịch sử trình duyệt
  // và header Referer.
  const token = req.headers.get('x-admin-token')
  const isAdmin = timingSafeEqual(token ?? '', Deno.env.get('ADMIN_SECRET_TOKEN') ?? '')
  const method = req.method
  const resource = url.searchParams.get('resource') || 'weddings' // 'weddings' or 'templates'

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Lấy user_id từ JWT của người dùng (header Authorization: Bearer <access_token>).
  // Client vẫn gửi apikey = anon key để qua gateway; nếu Authorization chỉ là anon key
  // (khách chưa đăng nhập) thì getUser sẽ null → trả null.
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

  // Helper function to get unique slug
  async function getUniqueSlug(baseSlug: string, excludeId?: string): Promise<string> {
    let finalSlug = baseSlug;
    let suffix = 1;
    
    while (true) {
      let query = supabase
        .from('weddings')
        .select('id')
        .eq('slug', finalSlug);
      
      // Exclude current record if updating
      if (excludeId) {
        query = query.neq('id', excludeId);
      }
      
      const { data: existing } = await query.maybeSingle();
      
      if (!existing) break;
      
      suffix++;
      finalSlug = `${baseSlug}-${suffix}`;
    }
    
    return finalSlug;
  }

  // ============= TEMPLATES MANAGEMENT =============
  if (resource === 'templates') {
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: corsHeaders
      })
    }

    // GET - List all templates or get single template by id
    if (method === 'GET') {
      const id = url.searchParams.get('id')
      
      // Get single template by id
      if (id) {
        const { data, error } = await supabase
          .from('templates')
          .select('*')
          .eq('id', id)
          .single()

        if (error) return new Response(JSON.stringify({ error }), { status: 404, headers: corsHeaders })
 
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      
      // List all templates
      const { data, error } = await supabase
        .from('templates')
        .select('*')
        .order('sort_order', { ascending: true })

      if (error) return new Response(JSON.stringify({ error }), { status: 500, headers: corsHeaders })

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // POST - Create new template
    if (method === 'POST') {
      const body = await req.json()
      
      const { data, error } = await supabase
        .from('templates')
        .insert([body])
        .select()
        .single()

      if (error) return new Response(JSON.stringify({ error }), { status: 500, headers: corsHeaders })

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // PATCH - Update template
    if (method === 'PATCH') {
      const body = await req.json()
      const { id, ...fields } = body

      if (!id) {
        return new Response(JSON.stringify({ error: 'Missing id' }), {
          status: 400, headers: corsHeaders
        })
      }

      const { data, error } = await supabase
        .from('templates')
        .update(fields)
        .eq('id', id)
        .select()
        .single()

      if (error) return new Response(JSON.stringify({ error }), { status: 500, headers: corsHeaders })

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // DELETE - Delete template
    if (method === 'DELETE') {
      const id = url.searchParams.get('id')
      
      if (!id) {
        return new Response(JSON.stringify({ error: 'Missing id' }), {
          status: 400, headers: corsHeaders
        })
      }

      const { error } = await supabase
        .from('templates')
        .delete()
        .eq('id', id)

      if (error) return new Response(JSON.stringify({ error }), { status: 500, headers: corsHeaders })

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
  }

  // ============= MÃ GIẢM GIÁ (admin) =============
  // Sinh mã hàng loạt / sửa / xoá. Việc TIÊU mã nằm ở payment-handler
  // (cx_promo_reserve) — ở đây chỉ quản lý danh mục.
  if (resource === 'promo-codes') {
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: corsHeaders
      })
    }

    // Bỏ 0/O/1/I/L để đọc-chép tay không nhầm.
    const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'
    const randomPart = (len: number) => {
      const bytes = crypto.getRandomValues(new Uint8Array(len))
      return Array.from(bytes, b => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('')
    }

    // GET - danh sách mã, mỗi mã kèm toàn bộ lần áp mã còn hiệu lực
    if (method === 'GET') {
      const q = url.searchParams.get('q')?.trim()
      const batchId = url.searchParams.get('batch_id')?.trim()

      let query = supabase
        .from('promo_codes')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500)

      if (q) query = query.ilike('code', `%${q}%`)
      if (batchId) query = query.eq('batch_id', batchId)

      const { data, error } = await query
      if (error) return new Response(JSON.stringify({ error }), { status: 500, headers: corsHeaders })

      // Kèm các lần áp mã (để admin thấy mã đã đi vào đơn nào).
      const ids = (data ?? []).map(c => c.id)
      let redemptions: Record<string, unknown>[] = []
      if (ids.length) {
        const { data: rd } = await supabase
          .from('promo_redemptions')
          .select('code_id, order_id, manage_id, user_key, status, final_amount, discount_amount, redeemed_at, reserved_at, expires_at')
          .in('code_id', ids)
          .in('status', ['reserved', 'redeemed'])
          .order('reserved_at', { ascending: false })
        redemptions = rd ?? []
      }

      const byCode: Record<string, unknown[]> = {}
      for (const r of redemptions) {
        const key = r.code_id as string
        ;(byCode[key] ||= []).push(r)
      }

      return new Response(JSON.stringify((data ?? []).map(c => ({ ...c, redemptions: byCode[c.id] ?? [] }))), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // POST - sinh mã. mode='generate' (hàng loạt, phần đuôi ngẫu nhiên) hoặc
    // mode='single' (tự gõ mã đẹp).
    if (method === 'POST') {
      const body = await req.json()
      const {
        mode = 'generate',
        prefix = '',
        count = 1,
        length = 6,
        code: manualCode,
        discount_type,
        discount_value,
        expires_at = null,
        min_order_amount = 0,
        max_uses = 1,
        note = null,
      } = body

      if (!['percent', 'fixed'].includes(discount_type)) {
        return new Response(JSON.stringify({ error: 'discount_type phải là percent hoặc fixed' }), {
          status: 400, headers: corsHeaders
        })
      }
      const value = Number(discount_value)
      if (!Number.isFinite(value) || value <= 0 || (discount_type === 'percent' && value > 100)) {
        return new Response(JSON.stringify({ error: 'Giá trị giảm không hợp lệ' }), {
          status: 400, headers: corsHeaders
        })
      }

      const batch_id = `B${Date.now().toString(36).toUpperCase()}`
      const common = {
        discount_type,
        discount_value: Math.round(value),
        expires_at: expires_at || null,
        min_order_amount: Math.max(0, Number(min_order_amount) || 0),
        // null = không giới hạn lượt dùng
        max_uses: max_uses === null || max_uses === '' ? null : Math.max(1, Number(max_uses) || 1),
        note: note || null,
        batch_id,
        is_active: true,
        used_count: 0,
      }

      if (mode === 'single') {
        const code = String(manualCode || '').trim().toUpperCase()
        if (!code) return new Response(JSON.stringify({ error: 'Thiếu mã' }), { status: 400, headers: corsHeaders })

        const { data, error } = await supabase
          .from('promo_codes')
          .insert([{ ...common, code }])
          .select()
          .single()

        if (error) {
          const msg = error.code === '23505' ? `Mã ${code} đã tồn tại` : error.message
          return new Response(JSON.stringify({ error: msg }), { status: 400, headers: corsHeaders })
        }
        return new Response(JSON.stringify({ batch_id, codes: [data] }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const total = Math.min(Math.max(1, Number(count) || 1), 200)
      const len = Math.min(Math.max(4, Number(length) || 6), 12)
      const cleanPrefix = String(prefix || '').trim().toUpperCase().replace(/[^A-Z0-9-]/g, '')

      // Sinh dư rồi khử trùng tại chỗ; mã đụng hàng trong DB (unique) thì thử
      // lại cả lô còn thiếu, tối đa 5 vòng.
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
          return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
        }
        // Đụng mã: chèn lại từng cái, bỏ qua cái trùng.
        for (const row of batch) {
          const { data: one, error: oneErr } = await supabase.from('promo_codes').insert([row]).select().single()
          if (!oneErr && one) created.push(one)
        }
      }

      if (!created.length) {
        return new Response(JSON.stringify({ error: 'Không sinh được mã nào, thử lại' }), {
          status: 500, headers: corsHeaders
        })
      }

      log.info('promo.generated', { batch_id, count: created.length, discount_type, discount_value: common.discount_value })

      return new Response(JSON.stringify({ batch_id, codes: created }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // PATCH - sửa mã (thường chỉ bật/tắt is_active)
    if (method === 'PATCH') {
      const { id, ...fields } = await req.json()
      if (!id) return new Response(JSON.stringify({ error: 'Missing id' }), { status: 400, headers: corsHeaders })

      // used_count là sổ sách của cx_promo_* — không cho sửa tay.
      delete fields.used_count
      delete fields.code

      const { data, error } = await supabase
        .from('promo_codes')
        .update(fields)
        .eq('id', id)
        .select()
        .single()

      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // DELETE - xoá mã chưa ai dùng. Mã đã có đơn chốt thì chỉ được TẮT, để giữ
    // vết đơn hàng (promo_redemptions tham chiếu tới).
    if (method === 'DELETE') {
      const id = url.searchParams.get('id')
      const batchId = url.searchParams.get('batch_id')
      if (!id && !batchId) {
        return new Response(JSON.stringify({ error: 'Missing id' }), { status: 400, headers: corsHeaders })
      }

      let target = supabase.from('promo_codes').select('id')
      target = id ? target.eq('id', id) : target.eq('batch_id', batchId!)
      const { data: codes } = await target
      const codeIds = (codes ?? []).map(c => c.id)
      if (!codeIds.length) {
        return new Response(JSON.stringify({ error: 'Không tìm thấy mã' }), { status: 404, headers: corsHeaders })
      }

      const { data: used } = await supabase
        .from('promo_redemptions')
        .select('code_id')
        .in('code_id', codeIds)
        .eq('status', 'redeemed')

      const usedIds = new Set((used ?? []).map(r => r.code_id))
      const deletable = codeIds.filter(cid => !usedIds.has(cid))

      if (!deletable.length) {
        return new Response(JSON.stringify({ error: 'Mã đã được dùng cho đơn hàng, chỉ có thể tắt chứ không xoá' }), {
          status: 409, headers: corsHeaders
        })
      }

      const { error } = await supabase.from('promo_codes').delete().in('id', deletable)
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })

      return new Response(JSON.stringify({ success: true, deleted: deletable.length, kept: codeIds.length - deletable.length }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
  }

  // ============= WEDDINGS MANAGEMENT =============

  // POST → Tạo bản ghi mới (public - KH tự tạo sau khi thanh toán hoặc tạo draft)
  if (method === 'POST') {
    const body = await req.json()
    const { slug, id: clientId, contact, manage_id, theme, theme_setting, is_published, ...extraFields } = body

    // manage_id là alias của id (từ draft flow)
    const resolvedId = clientId || manage_id

    // Slug là bắt buộc trừ khi là draft flow (manage_id không có slug)
    if (!slug && !manage_id) {
      return new Response(JSON.stringify({ error: 'Missing slug' }), {
        status: 400, headers: corsHeaders
      })
    }

    // Auto-generate slug từ manage_id nếu không có slug
    const baseSlug = slug || `wedding-${(resolvedId || '').slice(0, 8)}`
    const finalSlug = await getUniqueSlug(baseSlug);

    const insertPayload: Record<string, unknown> = {
      slug: finalSlug,
      is_active: true,
    }

    if (resolvedId)    insertPayload.id          = resolvedId
    if (contact)       insertPayload.contact      = contact
    if (theme)         insertPayload.theme        = theme
    if (theme_setting) insertPayload.theme_setting = theme_setting
    if (typeof is_published === 'boolean') insertPayload.is_published = is_published

    // Bắt buộc đăng nhập mới tạo được thiệp trong DB, để mọi thiệp luôn có chủ và
    // ownership check ở PATCH có căn cứ. Khớp với client: chưa đăng nhập thì thiệp
    // chỉ nằm ở localStorage (xem invitation-setup/js/13-data.js), chưa ghi DB.
    const creatorId = await getUserId()
    if (!creatorId && !isAdmin) {
      return new Response(JSON.stringify({
        error: 'Vui lòng đăng nhập để lưu thiệp',
        code: 'AUTH_REQUIRED',
      }), { status: 401, headers: corsHeaders })
    }
    if (creatorId) insertPayload.user_id = creatorId

    const { data, error } = await supabase
      .from('weddings')
      .insert(insertPayload)
      .select('id, slug')
      .single()

    if (error) {
      log.error('wedding.create_failed', { error: error.message })
      return new Response(JSON.stringify({ error }), { status: 500, headers: corsHeaders })
    }

    log.info('wedding.created', { id: data.id, slug: data.slug })

    return new Response(JSON.stringify({ id: data.id, slug: data.slug }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  // PATCH → Cập nhật thiệp (khách dùng id, admin dùng id + token)
  if (method === 'PATCH') {
    const body = await req.json()
    const { id, deleted_images, ...fields } = body

    if (!id) {
      return new Response(JSON.stringify({ error: 'Missing id' }), {
        status: 400, headers: corsHeaders
      })
    }

    // Kiểm tra id tồn tại và lấy data hiện tại
    const { data: existing, error: fetchError } = await supabase
      .from('weddings')
      .select('cover_image_url, groom_image_url, bride_image_url, groom_qr_url, bride_qr_url, gallery_images, user_id, payment_status')
      .eq('id', id)
      .single()

    if (fetchError || !existing) {
      // Phân biệt "không tìm thấy thật" với lỗi query (VD thiếu cột user_id) — log rõ.
      log.error('wedding.patch_fetch_failed', {
        id,
        error: fetchError?.message,
        code: fetchError?.code,
        details: fetchError?.details,
      })
      return new Response(JSON.stringify({ error: 'Wedding not found' }), {
        status: 404, headers: corsHeaders
      })
    }

    // ── Phân quyền sửa thiệp ─────────────────────────────────────────────────
    // BẮT BUỘC ĐĂNG NHẬP mới sửa được (xem docs/security-audit-plan.md #3) — UUID
    // nằm ngay trong link chia sẻ nên không thể coi là chứng thư.
    // Thiệp cũ chưa có chủ (user_id NULL): người đăng nhập ĐẦU TIÊN mở link sẽ
    // nhận làm chủ (claim bên dưới).
    // Đặt TRƯỚC khối xoá ảnh: xoá ảnh cũng là thao tác ghi.
    const editorId = isAdmin ? null : await getUserId()
    if (!isAdmin) {
      if (!editorId) {
        return new Response(JSON.stringify({
          error: 'Vui lòng đăng nhập để chỉnh sửa thiệp',
          code: 'AUTH_REQUIRED',
        }), { status: 401, headers: corsHeaders })
      }
      if (existing.user_id && existing.user_id !== editorId) {
        log.warn('wedding.patch_forbidden', { id, editorId })
        return new Response(JSON.stringify({
          error: 'Bạn không có quyền chỉnh sửa thiệp này',
          code: 'FORBIDDEN',
        }), { status: 403, headers: corsHeaders })
      }
    }

    // Validate deleted_images: chỉ cho phép xóa ảnh thuộc về wedding này
    if (deleted_images && deleted_images.length > 0) {
      // Collect all valid filenames from this wedding
      const validFilenames = [
        existing.cover_image_url,
        existing.groom_image_url,
        existing.bride_image_url,
        existing.groom_qr_url,
        existing.bride_qr_url,
        ...(existing.gallery_images || [])
      ].filter(Boolean) // Remove null/undefined

      // Extract filenames from URLs (in case they are full URLs)
      const extractedFilenames = validFilenames.map(f => {
        if (f.startsWith('http')) {
          return f.split('/').pop(); // Extract filename from URL
        }
        return f; // Already a filename
      });

      // Filter deleted_images to only include valid filenames
      const validDeletedImages = deleted_images.filter(filename => 
        extractedFilenames.includes(filename)
      )

      if (validDeletedImages.length > 0) {
        console.log('Deleting images from storage:', validDeletedImages)
        const { error: deleteError } = await supabase.storage
          .from('wedding-images')
          .remove(validDeletedImages)
        
        if (deleteError) {
          console.error('Error deleting images:', deleteError)
          // Continue anyway, don't fail the whole request
        }
      } else {
        console.log('No valid images to delete')
      }
    }

    // Khách chỉ được sửa các field trong allowlist. Field ngoài danh sách bị loại
    // bỏ (không báo lỗi để không phá client cũ), nhưng có log để phát hiện sớm khi
    // thêm cột mới mà quên cập nhật allowlist.
    if (!isAdmin) {
      const rejected = Object.keys(fields).filter(k => !CUSTOMER_EDITABLE_FIELDS.has(k))
      for (const key of rejected) delete fields[key]
      if (rejected.length > 0) {
        log.warn('wedding.patch_fields_rejected', { id, fields: rejected })
      }
    }

    // Chống tráo ảnh/QR: mọi field ảnh phải trỏ vào storage của hệ thống.
    // Áp dụng cho cả admin — sample image cũng nằm trong storage này.
    for (const field of IMAGE_FIELDS) {
      if (fields[field] !== undefined && !isSafeImageRef(fields[field])) {
        log.warn('wedding.patch_image_rejected', { id, field, value: String(fields[field]).slice(0, 200) })
        return new Response(JSON.stringify({ error: `Ảnh không hợp lệ ở trường ${field}` }), {
          status: 400, headers: corsHeaders
        })
      }
    }
    if (fields.gallery_images !== undefined && Array.isArray(fields.gallery_images)) {
      if (!fields.gallery_images.every(isSafeImageRef)) {
        log.warn('wedding.patch_image_rejected', { id, field: 'gallery_images' })
        return new Response(JSON.stringify({ error: 'Ảnh không hợp lệ trong album' }), {
          status: 400, headers: corsHeaders
        })
      }
    }

    // Check slug trùng nếu có đổi slug (loại trừ chính nó)
    if (fields.slug) {
      const { data: slugExisting } = await supabase
        .from('weddings')
        .select('id')
        .eq('slug', fields.slug)
        .neq('id', id)
        .maybeSingle()

      if (slugExisting) {
        return new Response(JSON.stringify({ error: 'Tên slug đã được người khác sử dụng. Vui lòng chọn tên khác' }), {
          status: 409, headers: corsHeaders
        })
      }
    }

    // ---- Validate array limits ----
    const MAX_GALLERY   = 10
    const MAX_TIMELINE  = 10
    const MAX_LOVE_STORY = 10

    if (fields.gallery_images !== undefined) {
      const arr = Array.isArray(fields.gallery_images) ? fields.gallery_images : []
      if (arr.length > MAX_GALLERY) {
        return new Response(JSON.stringify({ error: `Tối đa ${MAX_GALLERY} ảnh trong album` }), {
          status: 400, headers: corsHeaders
        })
      }
    }

    if (fields.timeline !== undefined) {
      let arr: unknown[]
      try {
        arr = typeof fields.timeline === 'string' ? JSON.parse(fields.timeline) : fields.timeline
      } catch { arr = [] }
      if (Array.isArray(arr) && arr.length > MAX_TIMELINE) {
        return new Response(JSON.stringify({ error: `Tối đa ${MAX_TIMELINE} mốc trong lịch trình` }), {
          status: 400, headers: corsHeaders
        })
      }
    }

    if (fields.love_story !== undefined) {
      let arr: unknown[]
      try {
        arr = typeof fields.love_story === 'string' ? JSON.parse(fields.love_story) : fields.love_story
      } catch { arr = [] }
      if (Array.isArray(arr) && arr.length > MAX_LOVE_STORY) {
        return new Response(JSON.stringify({ error: `Tối đa ${MAX_LOVE_STORY} mốc trong câu chuyện tình yêu` }), {
          status: 400, headers: corsHeaders
        })
      }
    }
    // ---- End validate ----

    // Xuất bản = lên DÙNG THỬ 3 ngày: đặt expires_at = now + 3 ngày. Thanh toán
    // thành công (payos-webhook) mới gán expires_at = null → mở vĩnh viễn. Guard:
    // thiệp đã thanh toán rồi thì KHÔNG reset về dùng thử khi publish/lưu lại.
    if (fields.is_published === true && existing.payment_status !== 'completed') {
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 3)
      fields.expires_at = expiresAt.toISOString()
    }

    // Thiệp chưa có chủ + người sửa đã đăng nhập → nhận làm chủ (claim), đường
    // grandfather cho thiệp tạo trước khi bắt buộc đăng nhập. Thiệp đã có chủ thì
    // bỏ qua user_id client gửi lên. Ghi log mọi lần claim để soi bất thường.
    delete fields.user_id
    if (!existing.user_id && editorId) {
      fields.user_id = editorId
      log.info('wedding.claimed', { id, userId: editorId })
    }

    const { error } = await supabase
      .from('weddings').update(fields).eq('id', id)

    if (error) {
      log.error('wedding.update_failed', {
        id,
        error: error.message,
        code: error.code,
        details: error.details,
        fields: Object.keys(fields),
      })
      return new Response(JSON.stringify({ error }), { status: 500, headers: corsHeaders })
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  // GET → Lấy thông tin thiệp theo slug hoặc id (public, không cần token)
  // hoặc list tất cả (admin only, có phân trang)
  if (method === 'GET') {
    const slug = url.searchParams.get('slug')
    const id = url.searchParams.get('id')
    const list = url.searchParams.get('list')

    // ── Public: danh sách templates + pricing (không cần admin token) ──
    if (resource === 'public-templates') {
      const [tRes, pRes] = await Promise.all([
        supabase.from('templates').select('*').eq('is_active', true).order('sort_order', { ascending: true }),
        supabase.from('template_pricing').select('*').eq('is_active', true),
      ])
      if (tRes.error) return new Response(JSON.stringify({ error: tRes.error }), { status: 500, headers: corsHeaders })
      const pricingMap = Object.fromEntries((pRes.data ?? []).map(p => [p.template_name, p]))
      const combined = (tRes.data ?? []).map(t => ({
        id: t.template_id,
        name: t.display_name,
        theme: t.template_name,
        description: t.description,
        thumbnailUrl: t.thumbnail_url,
        previewUrl: t.preview_url,
        features: t.features || [],
        status: t.status,
        category: t.category,
        price: pricingMap[t.template_name]?.price ?? 159000,
        originalPrice: pricingMap[t.template_name]?.original_price ?? 199000,
      }))
      return new Response(JSON.stringify(combined), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── Public: tìm kiếm nhạc YouTube qua InnerTube ──
    if (resource === 'youtube-search') {
      const q = url.searchParams.get('q')?.trim()
      if (!q || q.length < 2) return new Response(JSON.stringify({ error: 'Thiếu từ khóa' }), { status: 400, headers: corsHeaders })

      const ytRes = await fetch('https://www.youtube.com/youtubei/v1/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context: { client: { clientName: 'WEB', clientVersion: '2.20231121.08.00', hl: 'vi', gl: 'VN' } },
          query: q,
        }),
      })

      if (!ytRes.ok) return new Response(JSON.stringify({ error: 'Lỗi kết nối YouTube' }), { status: 502, headers: corsHeaders })

      const raw = await ytRes.json()
      const contents = raw?.contents
        ?.twoColumnSearchResultsRenderer
        ?.primaryContents
        ?.sectionListRenderer
        ?.contents
        ?.flatMap((c: Record<string, unknown>) => (c?.itemSectionRenderer as Record<string, unknown>)?.contents as Record<string, unknown>[] ?? [])
        ?? []

      const results = contents
        .filter((c: Record<string, unknown>) => c?.videoRenderer)
        .slice(0, 8)
        .map((c: Record<string, unknown>) => {
          const v = c.videoRenderer as Record<string, unknown>
          const thumbs = (v?.thumbnail as Record<string, unknown[]>)?.thumbnails ?? []
          return {
            id: v.videoId,
            title: ((v?.title as Record<string, unknown[]>)?.runs as Record<string, unknown>[])?.[0]?.text ?? '',
            channel: ((v?.ownerText as Record<string, unknown[]>)?.runs as Record<string, unknown>[])?.[0]?.text ?? '',
            duration: (v?.lengthText as Record<string, unknown>)?.simpleText ?? '',
            thumbnail: (thumbs[thumbs.length - 1] as Record<string, unknown>)?.url ?? '',
            url: `https://www.youtube.com/watch?v=${v.videoId}`,
          }
        })

      return new Response(JSON.stringify(results), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── Public: kiểm tra mã khuyến mãi ──
    // CHỈ để xem trước trên màn hình — không giữ lượt. Lượt thật do
    // payment-handler giành qua cx_promo_reserve lúc khách bấm Thanh toán.
    if (resource === 'promo') {
      const code = url.searchParams.get('code')?.trim()
      if (!code) return new Response(JSON.stringify({ error: 'Thiếu code' }), { status: 400, headers: corsHeaders })

      const { data, error } = await supabase
        .from('promo_codes')
        .select('code, discount_type, discount_value, expires_at, min_order_amount, max_uses, used_count')
        .ilike('code', code)
        .eq('is_active', true)
        .maybeSingle()

      if (error || !data) {
        return new Response(JSON.stringify({ valid: false, error: 'Mã không hợp lệ hoặc đã hết hạn' }), {
          status: 200, headers: corsHeaders,
        })
      }

      const expired = data.expires_at ? new Date(data.expires_at) < new Date() : false
      if (expired) {
        return new Response(JSON.stringify({ valid: false, error: 'Mã đã hết hạn' }), {
          status: 200, headers: corsHeaders,
        })
      }

      if (data.max_uses != null && (data.used_count ?? 0) >= data.max_uses) {
        return new Response(JSON.stringify({ valid: false, error: 'Mã đã hết lượt sử dụng' }), {
          status: 200, headers: corsHeaders,
        })
      }

      // Có theme thì đối chiếu luôn đơn tối thiểu để báo sớm, khỏi để khách bấm
      // Thanh toán rồi mới bị từ chối.
      const themeParam = url.searchParams.get('theme')?.trim()
      const minOrder = data.min_order_amount ?? 0
      if (themeParam && minOrder > 0) {
        const { data: pricing } = await supabase
          .from('template_pricing')
          .select('price')
          .eq('template_name', themeParam)
          .eq('is_active', true)
          .maybeSingle()
        if (pricing && pricing.price < minOrder) {
          return new Response(JSON.stringify({
            valid: false,
            error: `Đơn tối thiểu ${minOrder.toLocaleString('vi-VN')}đ mới dùng được mã này`,
          }), { status: 200, headers: corsHeaders })
        }
      }

      return new Response(JSON.stringify({
        valid: true,
        code: data.code,
        discount_type: data.discount_type,
        discount_value: data.discount_value,
        min_order_amount: minOrder,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    
    // ── Của tôi: danh sách thiệp của user đang đăng nhập (cho trang Đơn hàng) ──
    if (resource === 'my-weddings') {
      const userId = await getUserId()
      if (!userId) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: corsHeaders
        })
      }

      const { data, error } = await supabase
        .from('weddings')
        .select('id, slug, groom_name, bride_name, theme, is_published, created_at, expires_at')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      if (error) return new Response(JSON.stringify({ error }), { status: 500, headers: corsHeaders })

      return new Response(JSON.stringify(data ?? []), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // List all weddings with pagination (admin only)
    if (list === 'true') {
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: corsHeaders
        })
      }

      const page = parseInt(url.searchParams.get('page') || '1')
      const limit = parseInt(url.searchParams.get('limit') || '10')
      const search = url.searchParams.get('search')?.trim() || ''
      const offset = (page - 1) * limit

      // Build base query with search filter
      let baseQuery = supabase
        .from('weddings')
        .select('id, slug, groom_name, bride_name, is_active, created_at, payment_order_id', { count: 'exact' })
      
      if (search) {
        const s = escapePostgrestPattern(search)
        if (s) {
          baseQuery = baseQuery.or(`slug.ilike.%${s}%,groom_name.ilike.%${s}%,bride_name.ilike.%${s}%`)
        }
      }

      // Apply ordering and pagination
      baseQuery = baseQuery
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      const { data, error, count } = await baseQuery

      if (error) return new Response(JSON.stringify({ error }), { status: 500, headers: corsHeaders })

      return new Response(JSON.stringify({
        data,
        pagination: {
          page,
          limit,
          total: count,
          totalPages: Math.ceil((count || 0) / limit)
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Get single wedding by slug or id
    if (!slug && !id) {
      return new Response(JSON.stringify({ error: 'Missing slug or id' }), {
        status: 400, headers: corsHeaders
      })
    }

    // Chỉ admin mới nhận đủ field. Người dùng thường (kể cả chủ thiệp) nhận
    // allowlist các field cần để render/chỉnh thiệp — KHÔNG kèm dữ liệu thanh toán
    // (payment_status, payment_order_id, transaction_id, payment_time,
    // payment_amount, expires_at) và user_id. Lọc ngay tại truy vấn để dữ liệu nhạy
    // cảm không bao giờ rời khỏi DB.
    const PUBLIC_WEDDING_COLUMNS = ['id', 'is_active', 'created_at', ...CUSTOMER_EDITABLE_FIELDS].join(', ')

    let query = supabase.from('weddings').select(isAdmin ? '*' : PUBLIC_WEDDING_COLUMNS)

    if (slug) {
      query = query.eq('slug', slug)
    } else if (id) {
      query = query.eq('id', id)
    }

    const { data, error } = await query.single()

    if (error) return new Response(JSON.stringify({ error }), { status: 404, headers: corsHeaders })

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  // DELETE → Xóa thiệp (chỉ admin)
  if (method === 'DELETE') {
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: corsHeaders
      })
    }

    const id = url.searchParams.get('id')
    if (!id) {
      return new Response(JSON.stringify({ error: 'Missing id' }), {
        status: 400, headers: corsHeaders
      })
    }

    // Get wedding data to delete images
    const { data: wedding, error: fetchError } = await supabase
      .from('weddings')
      .select('cover_image_url, groom_image_url, bride_image_url, groom_qr_url, bride_qr_url, gallery_images')
      .eq('id', id)
      .single()

    if (fetchError || !wedding) {
      return new Response(JSON.stringify({ error: 'Wedding not found' }), {
        status: 404, headers: corsHeaders
      })
    }

    // Collect all image filenames
    const imageFiles = [
      wedding.cover_image_url,
      wedding.groom_image_url,
      wedding.bride_image_url,
      wedding.groom_qr_url,
      wedding.bride_qr_url,
      ...(wedding.gallery_images || [])
    ].filter(Boolean)

    // Delete images from storage
    if (imageFiles.length > 0) {
      await supabase.storage.from('wedding-images').remove(imageFiles)
    }

    // Delete wedding record
    const { error } = await supabase.from('weddings').delete().eq('id', id)

    if (error) return new Response(JSON.stringify({ error }), { status: 500, headers: corsHeaders })

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405, headers: corsHeaders
  })
}))
