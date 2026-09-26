import { createDbClient } from '../_shared/db-client.ts'
import { withAxiom } from '../_shared/axiom.ts'
// Tầng gọi model dùng chung (Gemini, xoay vòng key) cho resource=template-ai.
import { generateWithGemini } from '../_shared/ai-provider.ts'
import {
  WEDDING_IMAGE_SELECT,
  weddingFileNames,
  weddingImageRefs,
} from '../_shared/wedding-images.ts'
import {
  checkWeddingLimit,
  MAX_WEDDINGS_PER_USER,
  WEDDING_LIMIT_MESSAGE,
} from '../_shared/wedding-limits.ts'

// ── CORS ────────────────────────────────────────────────────────────────────
// Allowlist origin thay cho '*'. Chỉ là vệ sinh — CORS ràng buộc trình duyệt,
// curl/script bỏ qua; lớp bảo vệ thật là kiểm tra quyền theo user_id ở PATCH/POST.
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
  // is_active = false là thao tác "xoá thiệp" ở trang Quản lý thiệp (ẩn khỏi
  // danh sách, dữ liệu/ảnh vẫn còn). Quyền đã chặn ở trên theo user_id.
  'slug', 'is_published', 'is_active',
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
  'enable_wishes',
])

// ── Bảo mật: chống tráo ảnh (đặc biệt QR mừng cưới) ─────────────────────────
// QR mừng cưới render thẳng qua <img src>; nhận URL tuỳ ý thì kẻ tấn công đổi
// sang QR của nó và khách mời chuyển tiền nhầm. Chỉ chấp nhận tên file trong
// storage của hệ thống hoặc URL thuộc host của hệ thống.
// Cùng một mã chạy cho CẢ HAI project nên phải liệt kê host của cả hai — thiếu
// host staging thì trên staging mọi URL ảnh đầy đủ đều bị coi là tráo ảnh.
const ALLOWED_IMAGE_HOSTS = new Set([
  'lcobawmkywtxhpezndsh.supabase.co',                    // production
  'gmtnoxdwoumbtdmqmisk.supabase.co',                    // staging
  'wedding-image-proxy.cuoixinh-api.workers.dev',        // proxy production
  'wedding-image-proxy-staging.cuoixinh-api.workers.dev', // proxy staging
])

const IMAGE_FIELDS = [
  'cover_image_url', 'groom_image_url', 'bride_image_url',
  'groom_qr_url', 'bride_qr_url',
]

// Tên file trong storage: do core/bl/image-bl.js sinh ra dạng
// `<trường>-<24 ký tự ngẫu nhiên>.<ext>`. Đây là ALLOWLIST ký tự, KHÔNG phải
// danh sách cấm — bản cũ chỉ chặn `:` `//` `..` `/` `\` nên chuỗi như
// `a" onerror="…` lọt qua, rồi theme nội suy vào `src="…"` thành stored XSS
// (xem docs/security-checklist.md A3).
const STORAGE_NAME_RE = /^[A-Za-z0-9._-]{1,120}$/

// Cho phép: null/'' (xoá ảnh), tên file trong storage, hoặc URL https trên host
// của hệ thống. Chặn mọi thứ còn lại — kể cả dấu nháy, khoảng trắng, dấu <>.
function isSafeImageRef(value: unknown): boolean {
  if (value === null || value === undefined) return true
  if (typeof value !== 'string') return false
  const v = value.trim()
  if (v === '') return true

  if (v.includes(':') || v.startsWith('//')) {
    try {
      const u = new URL(v)
      if (u.protocol !== 'https:' || !ALLOWED_IMAGE_HOSTS.has(u.hostname)) return false
      // Phần tên file trong URL cũng phải sạch: URL hợp lệ vẫn mang được
      // `?x="onerror=` ở query/fragment.
      return !/["'<>\\\s]/.test(v)
    } catch {
      return false
    }
  }
  return STORAGE_NAME_RE.test(v)
}

// ── Bảo mật: làm sạch mảng JSONB khách gửi lên ──────────────────────────────
// `love_story` / `timeline` trước đây chỉ bị kiểm ĐỘ DÀI; nội dung phần tử đi
// thẳng vào DB rồi ra trang thiệp công khai. Giữ đúng các khoá đã biết, cắt độ
// dài, và bắt `image_url`/`focal_point` theo cùng luật với cột ảnh.
const MAX_TEXT = 2000

function cleanText(v: unknown, max = MAX_TEXT): string {
  return typeof v === 'string' ? v.slice(0, max) : ''
}

function cleanFocal(v: unknown): { x: number; y: number } | null {
  if (!v || typeof v !== 'object') return null
  const o = v as Record<string, unknown>
  const num = (n: unknown) => {
    const x = Number(n)
    return Number.isFinite(x) ? Math.min(100, Math.max(0, x)) : 50
  }
  return { x: num(o.x), y: num(o.y) }
}

// Trả về mảng đã làm sạch, hoặc null nếu đầu vào không phải mảng dùng được.
function cleanLoveStory(raw: unknown): Record<string, unknown>[] | null {
  const arr = typeof raw === 'string' ? safeParse(raw) : raw
  if (!Array.isArray(arr)) return null
  return arr.slice(0, 10).map((it) => {
    const o = (it && typeof it === 'object' ? it : {}) as Record<string, unknown>
    const img = typeof o.image_url === 'string' ? o.image_url.trim() : ''
    return {
      date: cleanText(o.date, 100),
      title: cleanText(o.title, 300),
      content: cleanText(o.content),
      image_url: img && isSafeImageRef(img) ? img : null,
      focal_point: cleanFocal(o.focal_point),
    }
  })
}

function cleanTimeline(raw: unknown): Record<string, unknown>[] | null {
  const arr = typeof raw === 'string' ? safeParse(raw) : raw
  if (!Array.isArray(arr)) return null
  const TYPES = ['ceremony', 'party', 'bride-party']
  return arr.slice(0, 10).map((it) => {
    const o = (it && typeof it === 'object' ? it : {}) as Record<string, unknown>
    const type = cleanText(o.type, 20)
    return {
      time: cleanText(o.time, 20),
      title: cleanText(o.title, 300),
      type: TYPES.includes(type) ? type : 'ceremony',
    }
  })
}

function safeParse(s: string): unknown {
  try { return JSON.parse(s) } catch { return null }
}

// Luật đặt slug — bản SERVER. core/bl/wedding-bl.js có bản client cùng luật,
// nhưng client bỏ qua được nên phép kiểm thật phải nằm ở đây.
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/

function isValidSlug(v: unknown): boolean {
  return typeof v === 'string' && SLUG_RE.test(v)
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

  const supabase = createDbClient(log)

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
          .maybeSingle()

        if (error) {
          log.error('template.query_failed', { code: error.code, message: error.message })
          return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
        }

        if (!data) {
          return new Response(JSON.stringify({ error: 'Không tìm thấy mẫu', code: 'NOT_FOUND' }), {
            status: 404, headers: corsHeaders
          })
        }
 
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


  // ============= ĐIỀN MẪU THIỆP BẰNG AI (admin) =============
  // Điền TRỌN form "Thêm Template": phần chữ (template_name, display_name,
  // description, category) do AI viết, phần cơ học (sort_order, status,
  // is_active) do server tính — không có lý do gì bắt model đoán. KHÔNG sinh
  // file theme. Prompt kèm 5 mẫu mới nhất trong DB làm ví dụ để AI bắt đúng
  // giọng văn + độ dài đang dùng.
  if (resource === 'template-ai') {
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: corsHeaders
      })
    }
    if (method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405, headers: corsHeaders
      })
    }

    const body = await req.json().catch(() => ({}))
    const clamp = (v: unknown, max: number) =>
      String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max)

    const themeName = clamp(body.template_name, 60)   // tên thư mục theme, có thể rỗng
    const hint      = clamp(body.description, 500)    // ý tưởng thô admin gõ vào
    if (!themeName && !hint) {
      return new Response(JSON.stringify({ error: 'Cần tên mẫu hoặc mô tả để AI có gì mà dựa vào' }), {
        status: 400, headers: corsHeaders
      })
    }

    // Một lượt đọc cho cả ví dụ lẫn phần tính toán: 5 mẫu mới nhất làm ví dụ,
    // toàn bộ template_name để tránh đặt trùng, sort_order lớn nhất để xếp cuối.
    const [exRes, allRes] = await Promise.all([
      supabase
        .from('templates')
        .select('template_name, display_name, description, category')
        .order('created_at', { ascending: false })
        .limit(5),
      supabase.from('templates').select('template_name, sort_order'),
    ])

    const taken = new Set((allRes.data ?? []).map(t => t.template_name))
    const nextSortOrder =
      Math.max(0, ...(allRes.data ?? []).map(t => Number(t.sort_order) || 0)) + 1

    const examples = (exRes.data ?? [])
      .map((t, i) => [
        `Ví dụ ${i + 1}:`,
        `- template_name: ${t.template_name}`,
        `- display_name: ${t.display_name}`,
        `- description: ${t.description ?? ''}`,
        `- category: ${t.category ?? ''}`,
      ].join('\n'))
      .join('\n\n') || '(chưa có mẫu nào trong hệ thống)'

    // Chỉ nhờ AI đặt template_name khi admin CHƯA gõ: tên đó là tên thư mục
    // public/themes/<tên>/ có thật trên đĩa, model không được phép đổi.
    const needName = !themeName

    const prompt = [
      'Bạn đang đặt tên và viết mô tả cho một MẪU THIỆP CƯỚI online của nền tảng Cưới Xinh (tiếng Việt).',
      '',
      'Dưới đây là các mẫu đang bán, hãy học đúng giọng văn, độ dài và cách đặt tên của chúng:',
      '',
      examples,
      '',
      'Mẫu mới cần đặt tên:',
      `- template_name (tên thư mục): ${themeName || '(chưa có — bạn hãy đề xuất)'}`,
      `- Ý tưởng / mô tả thô của admin: ${hint || '(không có, hãy suy từ template_name)'}`,
      '',
      'Yêu cầu:',
      '- display_name: 2–4 từ, viết hoa đầu từ, gợi phong cách & tông màu. Không trùng các ví dụ trên.',
      ...(needName
        ? ['- template_name: LUÔN LUÔN là chính display_name viết thường toàn bộ, bỏ dấu tiếng Việt, các từ nối với nhau bằng dấu GẠCH NGANG "-" (không phải gạch dưới "_"). Ví dụ display_name "Midnight Sage" → template_name "midnight-sage"; "Vintage Forest" → "vintage-forest". Chỉ gồm chữ thường a–z, số và gạch ngang; không khoảng trắng, không viết hoa, không bắt đầu bằng số hay gạch ngang.']
        : []),
      '- description: MỘT câu tiếng Việt 10–25 từ, tả tông màu + cảm xúc, không liệt kê tính năng (gallery, RSVP, QR…), không kết câu bằng dấu chấm than.',
      '- category: chọn đúng MỘT trong: traditional, modern, luxury, minimal, vintage.',
      '',
      // display_name đứng TRƯỚC template_name: model sinh JSON theo đúng thứ tự
      // khoá được nêu, mà template_name là bản kebab-case của display_name —
      // đảo lại thì nó phải bịa slug trước khi có tên để rút gọn.
      'Chỉ trả về JSON thuần, không kèm giải thích, đúng dạng:',
      needName
        ? '{"display_name":"...","template_name":"...","description":"...","category":"..."}'
        : '{"display_name":"...","description":"...","category":"..."}',
    ].join('\n')

    const out = await generateWithGemini(
      prompt,
      { gemini: { temperature: 1.0, responseMimeType: 'application/json' } },
      log,
      'template_meta',
    )
    if (!out) {
      return new Response(JSON.stringify({ error: 'AI đang bận, thử lại sau ít phút' }), {
        status: 503, headers: corsHeaders
      })
    }

    // Model đôi khi bọc JSON trong ```json … ``` dù đã yêu cầu JSON thuần.
    let parsed: Record<string, unknown>
    try {
      const raw = out.raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '')
      parsed = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1))
    } catch {
      log.warn('ai.template_meta_parse_failed', { provider: out.provider })
      return new Response(JSON.stringify({ error: 'AI trả về dữ liệu không đọc được, thử lại' }), {
        status: 502, headers: corsHeaders
      })
    }

    const VALID_CATEGORIES = ['traditional', 'modern', 'luxury', 'minimal', 'vintage']
    const category = clamp(parsed.category, 20).toLowerCase()
    const displayName = clamp(parsed.display_name, 60)

    // "Tên hiển thị viết thường, nối bằng gạch ngang" — quy ước này ép ở ĐÂY chứ
    // không chỉ nhờ prompt: model vẫn trả về chữ hoa/khoảng trắng/dấu tiếng Việt
    // như thường. NFD tách dấu ra thành ký tự tổ hợp rồi xoá, riêng đ/Đ không có
    // dạng tổ hợp nên phải thay tay.
    // Mọi thứ không phải a–z/0–9 (khoảng trắng, gạch dưới, &, dấu câu) đều thành
    // MỘT dấu gạch ngang — repo không có tên thư mục nào dùng "_".
    const kebab = (s: string) =>
      s.normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[đĐ]/g, 'd')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40)
        .replace(/-+$/, '')

    // template_name đi thẳng vào cột UNIQUE template_id → phải sạch và không
    // trùng, nếu không lệnh lưu sẽ 500 sau khi admin đã điền xong cả form.
    // Model không theo quy ước thì rút thẳng từ display_name.
    let suggestedName = ''
    if (needName) {
      const base = kebab(clamp(parsed.template_name, 40)) || kebab(displayName)
      if (/^[a-z][a-z0-9-]*$/.test(base)) {
        suggestedName = base
        for (let i = 2; taken.has(suggestedName); i++) suggestedName = `${base}-${i}`
      }
    }

    return new Response(JSON.stringify({
      template_name: suggestedName,       // rỗng = giữ nguyên ô admin đang gõ
      display_name: displayName,
      description: clamp(parsed.description, 300),
      category: VALID_CATEGORIES.includes(category) ? category : 'traditional',
      // Phần cơ học, client chỉ áp khi đang THÊM mẫu mới.
      sort_order: nextSortOrder,
      status: 'active',
      is_active: true,
      provider: out.provider,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
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
        const { data: rd, error: rdErr } = await supabase
          .from('promo_redemptions')
          .select('code_id, order_id, manage_id, user_key, status, final_amount, discount_amount, redeemed_at, reserved_at, expires_at')
          .in('code_id', ids)
          .in('status', ['reserved', 'redeemed'])
          .order('reserved_at', { ascending: false })
        // Bảng admin vẫn hiện được danh sách mã, chỉ thiếu phần lượt đã dùng —
        // im lặng ở đây là admin tưởng mã chưa ai dùng.
        if (rdErr) log.warn('promo.redemptions_read_failed', { code: rdErr.code, message: rdErr.message })
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
      const { data: codes, error: codesErr } = await target
      if (codesErr) {
        log.error('promo.lookup_failed', { code: codesErr.code, message: codesErr.message })
        return new Response(JSON.stringify({ error: codesErr.message }), { status: 500, headers: corsHeaders })
      }
      const codeIds = (codes ?? []).map(c => c.id)
      if (!codeIds.length) {
        return new Response(JSON.stringify({ error: 'Không tìm thấy mã' }), { status: 404, headers: corsHeaders })
      }

      const { data: used, error: usedErr } = await supabase
        .from('promo_redemptions')
        .select('code_id')
        .in('code_id', codeIds)
        .eq('status', 'redeemed')

      // Đây là chốt duy nhất giữ lại mã ĐÃ dùng cho đơn hàng. Truy vấn hỏng mà
      // vẫn chạy tiếp thì danh sách "đã dùng" rỗng → xoá sạch, không lùi được.
      if (usedErr) {
        log.error('promo.used_lookup_failed', { code: usedErr.code, message: usedErr.message })
        return new Response(JSON.stringify({ error: 'Không kiểm tra được mã đã dùng, chưa xoá gì cả' }), { status: 500, headers: corsHeaders })
      }

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

    if (slug && !isValidSlug(slug)) {
      return new Response(JSON.stringify({
        error: 'Tên đường dẫn chỉ gồm chữ thường, số và dấu gạch ngang',
        code: 'INVALID_SLUG',
      }), { status: 400, headers: corsHeaders })
    }

    // Auto-generate slug từ manage_id nếu không có slug
    const baseSlug = slug || `wedding-${(resolvedId || '').slice(0, 8).toLowerCase()}`
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

    // Trần số thiệp/tài khoản. Đây là chốt THẬT: con số phía client ai cũng sửa
    // được, mà mỗi thiệp còn kéo theo ảnh nằm lại trong Storage. Chỉ đếm thiệp còn
    // hiện trong danh sách (is_active) cho khớp con số khách nhìn thấy ở trang
    // "Quản lý thiệp cưới"; bỏ qua chính hàng sắp ghi để lần lưu lại sau khi POST
    // hỏng giữa chừng không bị tính thành một thiệp nữa. Admin không dính trần.
    if (creatorId && !isAdmin) {
      const limit = await checkWeddingLimit(supabase, creatorId, resolvedId)
      if (limit.error) {
        log.error('wedding.count_failed', { error: limit.error })
        return new Response(JSON.stringify({ error: limit.error }), {
          status: 500, headers: corsHeaders
        })
      }
      if (limit.reached) {
        log.info('wedding.limit_reached', { user_id: creatorId, count: limit.count })
        // 409 chứ không 403: client đã dùng 403 cho "thiệp không phải của bạn" và
        // hiện một câu báo lỗi khác hẳn.
        return new Response(JSON.stringify({
          error: WEDDING_LIMIT_MESSAGE,
          code: 'WEDDING_LIMIT',
          limit: MAX_WEDDINGS_PER_USER,
        }), { status: 409, headers: corsHeaders })
      }
    }

    const { data, error } = await supabase
      .from('weddings')
      .insert(insertPayload)
      .select('id, slug')
      .single()

    // Trùng id = client tạo lại hàng nó đã tạo (PATCH sau POST hỏng, bấm hai lần,
    // hai tab — cờ "nháp local" ở invitation-setup không hỏi DB). Cùng chủ thì coi
    // như tạo xong để lượt lưu đi tiếp; bắt SAU insert chứ không kiểm trước, vì hai
    // POST đồng thời vẫn lọt qua phép kiểm trước.
    if (error?.code === '23505' && resolvedId && error.message?.includes('weddings_pkey')) {
      const { data: dup, error: dupErr } = await supabase
        .from('weddings')
        .select('id, slug, user_id')
        .eq('id', resolvedId)
        .maybeSingle()

      if (dupErr || !dup) {
        log.error('wedding.create_dup_fetch_failed', {
          id: resolvedId, code: dupErr?.code, message: dupErr?.message,
        })
        return new Response(JSON.stringify({ error: 'Không lưu được thiệp, vui lòng thử lại' }), {
          status: 500, headers: corsHeaders
        })
      }

      // user_id null = thiệp cũ chưa có chủ, PATCH ngay sau sẽ nhận chủ.
      if (!isAdmin && dup.user_id && dup.user_id !== creatorId) {
        log.warn('wedding.create_dup_forbidden', { id: resolvedId, user_id: creatorId })
        return new Response(JSON.stringify({
          error: 'Bạn không có quyền chỉnh sửa thiệp này',
          code: 'FORBIDDEN',
        }), { status: 403, headers: corsHeaders })
      }

      log.warn('wedding.create_duplicate', { id: dup.id, slug: dup.slug })
      return new Response(JSON.stringify({ id: dup.id, slug: dup.slug }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (error) {
      log.error('wedding.create_failed', { id: resolvedId, code: error.code, message: error.message })
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
      .select(`${WEDDING_IMAGE_SELECT}, user_id, slug, theme, payment_status, payment_amount, is_published`)
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

    // Validate deleted_images: chỉ cho phép xóa ảnh thuộc về wedding này.
    // Đối chiếu theo TÊN FILE nên cột lưu URL đầy đủ về storage của hệ thống vẫn
    // khớp được (isSafeImageRef cho phép dạng đó).
    if (deleted_images && deleted_images.length > 0) {
      const extractedFilenames = weddingImageRefs(existing).map((f) =>
        f.startsWith('http') ? f.split('/').pop()! : f
      )

      const validDeletedImages = deleted_images.filter(filename =>
        extractedFilenames.includes(filename)
      )

      if (validDeletedImages.length > 0) {
        console.log('Deleting images from storage:', validDeletedImages)
        const { error: deleteError } = await supabase.storage
          .from('wedding-images')
          .remove(validDeletedImages)
        
        if (deleteError) {
          // Cố ý không chặn request, nhưng ảnh nằm lại bucket vĩnh viễn nếu hàng
          // DB đã bỏ tham chiếu — không còn luồng nào tìm ra chúng nữa.
          log.error('wedding.image_delete_failed', { id, files: validDeletedImages.length, message: deleteError.message })
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

    // Slug phải hợp lệ. Bản client (core/bl/wedding-bl.js validateSlug) bỏ qua
    // được nên phép kiểm thật nằm ở đây — slug đi vào URL công khai và vào lệnh
    // gọi Edge Function của router.html.
    if (fields.slug !== undefined && !isValidSlug(fields.slug)) {
      return new Response(JSON.stringify({
        error: 'Tên đường dẫn chỉ gồm chữ thường, số và dấu gạch ngang',
        code: 'INVALID_SLUG',
      }), { status: 400, headers: corsHeaders })
    }

    // ---- Làm sạch + giới hạn các mảng ----
    // Nội dung hai mảng JSONB này ra thẳng trang thiệp công khai, nên không chỉ
    // kiểm ĐỘ DÀI: giữ đúng khoá đã biết, cắt độ dài chuỗi, lọc ảnh/điểm lấy nét.
    const MAX_ITEMS = 10

    if (fields.gallery_images !== undefined) {
      const arr = Array.isArray(fields.gallery_images) ? fields.gallery_images : []
      if (arr.length > MAX_ITEMS) {
        return new Response(JSON.stringify({ error: `Tối đa ${MAX_ITEMS} ảnh trong album` }), {
          status: 400, headers: corsHeaders
        })
      }
    }

    if (fields.love_story !== undefined) {
      const raw = typeof fields.love_story === 'string' ? safeParse(fields.love_story) : fields.love_story
      if (Array.isArray(raw) && raw.length > MAX_ITEMS) {
        return new Response(JSON.stringify({ error: `Tối đa ${MAX_ITEMS} mốc trong câu chuyện tình yêu` }), {
          status: 400, headers: corsHeaders
        })
      }
      const cleaned = cleanLoveStory(fields.love_story)
      if (cleaned === null) {
        return new Response(JSON.stringify({ error: 'Dữ liệu câu chuyện tình yêu không hợp lệ' }), {
          status: 400, headers: corsHeaders
        })
      }
      fields.love_story = cleaned
    }

    if (fields.timeline !== undefined) {
      const raw = typeof fields.timeline === 'string' ? safeParse(fields.timeline) : fields.timeline
      if (Array.isArray(raw) && raw.length > MAX_ITEMS) {
        return new Response(JSON.stringify({ error: `Tối đa ${MAX_ITEMS} mốc trong lịch trình` }), {
          status: 400, headers: corsHeaders
        })
      }
      const cleaned = cleanTimeline(fields.timeline)
      if (cleaned === null) {
        return new Response(JSON.stringify({ error: 'Dữ liệu lịch trình không hợp lệ' }), {
          status: 400, headers: corsHeaders
        })
      }
      fields.timeline = cleaned
    }

    // Điểm lấy nét của ảnh đơn/album: ép về số, chặn chèn chuỗi vào thuộc tính style.
    if (fields.image_focal_points !== undefined) {
      const raw = typeof fields.image_focal_points === 'string'
        ? safeParse(fields.image_focal_points)
        : fields.image_focal_points
      const out: Record<string, unknown> = {}
      if (raw && typeof raw === 'object') {
        for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
          if (k === 'gallery_images' && v && typeof v === 'object') {
            const g: Record<string, unknown> = {}
            for (const [gk, gv] of Object.entries(v as Record<string, unknown>)) {
              if (isSafeImageRef(gk)) g[gk] = cleanFocal(gv)
            }
            out[k] = g
          } else {
            out[k] = cleanFocal(v)
          }
        }
      }
      fields.image_focal_points = out
    }

    // ── Thanh toán xong là CHỐT mẫu ─────────────────────────────────────────
    // Giá tính theo `theme` lúc TẠO ĐƠN nên mỗi thiệp mua đúng một mẫu. Chặn MỌI
    // lượt đổi, kể cả sang mẫu rẻ hơn hoặc bằng giá: cho đổi ngang giá thì hôm nay
    // ngang giá, mai sửa bảng giá là thành đường lách; còn mẫu rẻ hơn thì đẻ ra
    // câu hỏi hoàn tiền mà không có luồng nào trả lời.
    // So với `existing.theme` chứ không chỉ xét `!== undefined`: client gửi nguyên
    // form mỗi lần lưu nên `theme` gần như luôn có mặt, xét hớ là khoá luôn cả
    // những lần lưu không đụng gì tới mẫu.
    if (
      !isAdmin &&
      fields.theme !== undefined &&
      fields.theme !== existing.theme &&
      existing.payment_status === 'completed'
    ) {
      log.warn('wedding.theme_change_blocked', {
        id, from: existing.theme, to: fields.theme,
      })
      return new Response(JSON.stringify({
        error: 'Thiệp đã thanh toán nên không đổi được mẫu nữa.',
        code: 'THEME_LOCKED',
      }), { status: 409, headers: corsHeaders })
    }

    // ── Xuất bản rồi là CHỐT slug ────────────────────────────────────────────
    // Link thiệp (/slug) đã có thể nằm trong tin nhắn gửi khách mời, đổi là link chết.
    // So với `existing.slug`: client gửi slug hiện tại ở MỌI lần lưu.
    if (
      !isAdmin &&
      fields.slug !== undefined &&
      fields.slug !== existing.slug &&
      existing.is_published
    ) {
      log.warn('wedding.slug_change_blocked', { id, from: existing.slug, to: fields.slug })
      return new Response(JSON.stringify({
        error: 'Thiệp đã xuất bản nên không đổi được đường dẫn nữa.',
        code: 'SLUG_LOCKED',
      }), { status: 409, headers: corsHeaders })
    }

    // Check slug trùng nếu có đổi slug (loại trừ chính nó)
    if (fields.slug) {
      const { data: slugExisting, error: slugErr } = await supabase
        .from('weddings')
        .select('id')
        .eq('slug', fields.slug)
        .neq('id', id)
        .maybeSingle()

      // Hỏng mà bỏ qua thì phép kiểm trùng coi như không có: lượt lưu tiếp theo
      // đâm vào ràng buộc UNIQUE và khách nhận một lỗi DB khó hiểu.
      if (slugErr) {
        log.error('wedding.slug_check_failed', { id, code: slugErr.code, message: slugErr.message })
        return new Response(JSON.stringify({ error: 'Không kiểm tra được slug, vui lòng thử lại' }), { status: 500, headers: corsHeaders })
      }

      if (slugExisting) {
        return new Response(JSON.stringify({ error: 'Tên slug đã được người khác sử dụng. Vui lòng chọn tên khác' }), {
          status: 409, headers: corsHeaders
        })
      }
    }


    // Xuất bản = lên DÙNG THỬ 3 ngày: đặt expires_at = now + 3 ngày. Thanh toán
    // thành công (payos-webhook) mới gán expires_at = null → mở vĩnh viễn. Hai guard:
    //   + thiệp đã thanh toán rồi thì KHÔNG reset về dùng thử khi publish/lưu lại;
    //   + chỉ đặt ở lần CHUYỂN chưa xuất bản → xuất bản. Thiệp đã xuất bản thì nút
    //     chính đổi nhãn thành "Lưu & Xuất bản" nhưng vẫn gọi publishWedding() nên
    //     lần lưu nào cũng kèm is_published: true — không chặn thì mỗi lần bấm lưu
    //     là hạn dùng thử lùi thêm 3 ngày (dùng thử vô hạn) và mốc dọn dẹp
    //     "expires_at + 30 ngày" của cleanup-weddings không bao giờ tới.
    if (
      fields.is_published === true &&
      existing.is_published !== true &&
      existing.payment_status !== 'completed'
    ) {
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
      // Lỗi ở truy vấn GIÁ cũng phải thành 500: trả 200 kèm `price: null` thì
      // trang chỉ hiện "Liên hệ" chứ không báo gì, mà worker templates-cache
      // lưu luôn phản hồi què đó ở edge tới 7 ngày.
      if (tRes.error || pRes.error) {
        const failed = tRes.error ? 'templates' : 'template_pricing'
        const err = tRes.error ?? pRes.error
        log.error('templates.public_query_failed', { table: failed, code: err.code, message: err.message })
        return new Response(JSON.stringify({ error: err }), { status: 500, headers: corsHeaders })
      }
      const pricingMap = Object.fromEntries((pRes.data ?? []).map(p => [p.template_name, p]))
      const combined = (tRes.data ?? []).map(t => ({
        id: t.template_id,
        name: t.display_name,
        theme: t.template_name,
        description: t.description,
        thumbnailUrl: t.thumbnail_url,
        previewUrl: t.preview_url,
        status: t.status,
        category: t.category,
        // Không có hàng `template_pricing` thì trả null, KHÔNG bịa giá dự phòng:
        // web hiện "Liên hệ" (templates-dal.js), còn một con số cứng ở đây là
        // khách mua theo giá không có trong DB.
        price: pricingMap[t.template_name]?.price ?? null,
        originalPrice: pricingMap[t.template_name]?.original_price ?? null,
      }))

      // Có mẫu mà KHÔNG mẫu nào có giá: hoặc bảng giá trống, hoặc `template_name`
      // hai bảng lệch nhau. Không phải lỗi truy vấn nên không có gì ném ra, mà hậu
      // quả thì nặng — cả trang chỉ còn "Liên hệ", và worker cache lại 7 ngày.
      const priced = (tRes.data ?? []).filter((t: { template_name: string }) => pricingMap[t.template_name]?.price != null).length
      if (combined.length > 0 && priced === 0) {
        log.warn('templates.pricing_missing', { templates: combined.length, pricing_rows: pRes.data?.length ?? 0 })
      }

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

      // KHÔNG dùng `ilike` với chuỗi người dùng: `%` và `_` là ký tự đại diện nên
      // dò nhị phân theo tiền tố là ra mã thật, mà response còn trả về mã đầy đủ
      // (xem docs/security-checklist.md A5). Mã sinh ra luôn viết HOA nên so
      // bằng `eq` trên bản viết hoa là đủ, không mất tính "gõ thường cũng nhận".
      if (!/^[A-Za-z0-9-]{1,40}$/.test(code)) {
        return new Response(JSON.stringify({ valid: false, error: 'Mã không hợp lệ hoặc đã hết hạn' }), {
          status: 200, headers: corsHeaders,
        })
      }

      const { data, error } = await supabase
        .from('promo_codes')
        .select('code, discount_type, discount_value, expires_at, min_order_amount, max_uses, used_count')
        .eq('code', code.toUpperCase())
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
        const { data: pricing, error: pricingErr } = await supabase
          .from('template_pricing')
          .select('price')
          .eq('template_name', themeParam)
          .eq('is_active', true)
          .maybeSingle()
        // Không chặn: đây chỉ là báo sớm, payment-handler vẫn kiểm lại lúc tạo
        // đơn. Nhưng hỏng thì phải kêu, không thì mã "hợp lệ" ở đây rồi bị từ
        // chối ở màn thanh toán mà không ai hiểu vì sao.
        if (pricingErr) {
          log.warn('promo.min_order_check_failed', { theme: themeParam, code: pricingErr.code, message: pricingErr.message })
        }
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

      // cover_image_url + gallery_images chỉ là TÊN FILE (vài chục byte/hàng) —
      // trang "Quản lý thiệp cưới" dựng thumbnail bằng ảnh thật của khách, thiếu
      // hai cột này là mọi thiệp cùng mẫu trông giống hệt nhau.
      const { data, error } = await supabase
        .from('weddings')
        .select('id, slug, groom_name, bride_name, theme, is_published, created_at, expires_at, cover_image_url, gallery_images')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      if (error) {
        log.error('wedding.my_list_failed', { user_id: userId, code: error.code, message: error.message })
        return new Response(JSON.stringify({ error }), { status: 500, headers: corsHeaders })
      }

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
    // payment_amount, expires_at). Lọc ngay tại truy vấn để dữ liệu nhạy cảm không
    // bao giờ rời khỏi DB. user_id lấy về CHỈ để xét quyền ở dưới rồi xoá khỏi
    // response, y như expires_at/payment_status.
    const PUBLIC_WEDDING_COLUMNS = ['id', 'is_active', 'created_at', ...CUSTOMER_EDITABLE_FIELDS].join(', ')

    // expires_at + payment_status chỉ lấy để XÉT khoá ngay dưới đây, bị gỡ khỏi
    // response trước khi trả về — không để dữ liệu thanh toán rời khỏi DB.
    let query = supabase
      .from('weddings')
      .select(isAdmin ? '*' : `${PUBLIC_WEDDING_COLUMNS}, expires_at, payment_status, user_id`)

    if (slug) {
      query = query.eq('slug', slug)
    } else if (id) {
      query = query.eq('id', id)
    }

    // maybeSingle: không có hàng là chuyện BÌNH THƯỜNG (slug gõ sai, thiệp nháp đã
    // bị cron dọn, bot quét đường dẫn lạ — 404.html đẩy mọi path lạ vào đây dưới
    // dạng ?slug=). Dùng .single() thì trường hợp đó lẫn với lỗi DB thật vì cả hai
    // cùng ra 404 kèm PGRST116, không lần được nguyên nhân.
    const { data, error } = await query.maybeSingle()

    if (error) {
      log.error('wedding.query_failed', { code: error.code, message: error.message })
      return new Response(JSON.stringify({ error: error.message, code: 'QUERY_FAILED' }), {
        status: 500, headers: corsHeaders
      })
    }

    if (!data) {
      log.warn('wedding.not_found', { by: slug ? 'slug' : 'id' })
      return new Response(JSON.stringify({ error: 'Không tìm thấy thiệp', code: 'NOT_FOUND' }), {
        status: 404, headers: corsHeaders
      })
    }

    // ── Tra theo id thì phải là CHỦ THIỆP ────────────────────────────────────
    // Trước đây đường này mở cho mọi người vì coi UUID là bí mật ("chỉ chủ thiệp
    // có"). Giả định đó đã sai: tên file trong bucket wedding-images từng mang
    // wedding_id, mà ai cũng liệt kê được bucket bằng anon key — xem
    // changelogs/RC1.15. Từ nay id chỉ là ĐỊNH DANH, không phải quyền; đường tra
    // công khai duy nhất là ?slug=.
    if (!isAdmin) {
      if (id) {
        const uid = await getUserId()
        if (!uid || uid !== data.user_id) {
          log.warn('wedding.id_forbidden', { authed: !!uid })
          return new Response(JSON.stringify({
            error: 'Bạn không có quyền xem thiệp này',
            code: 'FORBIDDEN',
          }), { status: 403, headers: corsHeaders })
        }
      }
      delete data.user_id
    }

    // ── Hết hạn dùng thử = KHOÁ với khách mời ────────────────────────────────
    // Chặn ở đây chứ không ở client: link thiệp là công khai, ẩn bằng JS thì ai
    // xem source cũng lấy được dữ liệu. Chỉ chặn đường tra theo SLUG (đường công
    // khai); tra theo id — đã xác thực là chủ thiệp ở trên — vẫn mở để trình chỉnh
    // sửa nạp được thiệp: khách vẫn sửa và xuất bản bình thường, chỉ là xuất bản
    // xong vẫn khoá cho tới khi thanh toán (thanh toán xong expires_at = null).
    if (!isAdmin) {
      const trialOver = !!data.expires_at && new Date(data.expires_at).getTime() < Date.now()
      const locked = data.is_published && trialOver && data.payment_status !== 'completed'
      const themeLocked = data.payment_status === 'completed'
      delete data.expires_at
      delete data.payment_status

      if (locked && slug) {
        log.info('wedding.trial_locked', { slug })
        return new Response(JSON.stringify({
          error: 'Thiệp đã hết hạn dùng thử',
          code: 'TRIAL_EXPIRED',
          groom_name: data.groom_name,
          bride_name: data.bride_name,
          theme: data.theme,
        }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      // Đường tra theo id (chủ thiệp đang mở trình chỉnh sửa): không chặn, nhưng
      // nói cho biết thiệp đang khoá với khách mời. Đây là TRẠNG THÁI, không phải
      // dữ liệu thanh toán — thiếu nó chủ thiệp bấm xuất bản xong vẫn tưởng thiệp
      // đang mở.
      data.trial_locked = locked

      // Mẫu đã chốt vì thiệp đã thanh toán. Là TRẠNG THÁI suy ra từ payment_status,
      // không phải dữ liệu thanh toán — trình chỉnh sửa cần nó để không mời khách
      // bấm vào một thao tác chắc chắn bị PATCH từ chối.
      data.theme_locked = themeLocked
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  // DELETE → Xoá thiệp VĨNH VIỄN: hàng weddings + ảnh trong Storage + khách mời
  // và lời chúc (guests cascade theo FK). Không có đường lùi.
  // Admin xoá thiệp bất kỳ; người dùng thường chỉ xoá thiệp mình đứng tên.
  if (method === 'DELETE') {
    const id = url.searchParams.get('id')
    if (!id) {
      return new Response(JSON.stringify({ error: 'Missing id' }), {
        status: 400, headers: corsHeaders
      })
    }

    const { data: wedding, error: fetchError } = await supabase
      .from('weddings')
      .select(`${WEDDING_IMAGE_SELECT}, user_id`)
      .eq('id', id)
      .single()

    if (fetchError || !wedding) {
      return new Response(JSON.stringify({ error: 'Wedding not found' }), {
        status: 404, headers: corsHeaders
      })
    }

    // Thiệp chưa có chủ (user_id NULL) thì KHÔNG ai ngoài admin xoá được: `id` nằm
    // ngay trong link chia sẻ nên cho claim-rồi-xoá là đưa nút huỷ cho người lạ.
    if (!isAdmin) {
      const userId = await getUserId()
      if (!userId) {
        return new Response(JSON.stringify({
          error: 'Vui lòng đăng nhập để xoá thiệp',
          code: 'AUTH_REQUIRED',
        }), { status: 401, headers: corsHeaders })
      }
      if (wedding.user_id !== userId) {
        log.warn('wedding.delete_forbidden', { id, userId })
        return new Response(JSON.stringify({
          error: 'Bạn không có quyền xoá thiệp này',
          code: 'FORBIDDEN',
        }), { status: 403, headers: corsHeaders })
      }
    }

    // Xoá ảnh TRƯỚC: hàng DB là nơi duy nhất còn giữ tên file, mất nó trước là
    // ảnh nằm lại trong bucket vĩnh viễn mà không ai biết đường tìm.
    const imageFiles = weddingFileNames(wedding)
    if (imageFiles.length > 0) {
      const { error: rmError } = await supabase.storage
        .from('wedding-images')
        .remove(imageFiles)
      if (rmError) {
        log.error('wedding.delete_images_failed', { id, error: rmError.message })
        return new Response(JSON.stringify({
          error: 'Không xoá được ảnh của thiệp, vui lòng thử lại',
        }), { status: 500, headers: corsHeaders })
      }
    }

    const { error } = await supabase.from('weddings').delete().eq('id', id)

    if (error) return new Response(JSON.stringify({ error }), { status: 500, headers: corsHeaders })

    log.info('wedding.deleted', { id, by: isAdmin ? 'admin' : 'owner', files: imageFiles.length })
    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405, headers: corsHeaders
  })
}))
