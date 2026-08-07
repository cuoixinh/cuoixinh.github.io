// ai-background — sinh ảnh nền SVG cho web bằng AI (Gemini chính, Groq fallback).
//
// CHỈ DÀNH CHO QUẢN TRỊ: toàn bộ thân hàm chặn sau x-admin-token. Khác
// ai-invitation (công khai, rate-limit theo user/IP) vì ở đây client gửi PROMPT
// TỰ DO — không chặn thì thành proxy LLM miễn phí xài key của dự án.
//
// Vào:  { prompt, width, height }
// Ra:   { svg, provider }
//
// SVG trả về được trang admin lọc thêm lần nữa rồi mới ghi xuống đĩa; web dùng
// nó qua background-image nên script trong SVG không chạy.
//
// ⚠️ Deploy KÈM cờ --no-verify-jwt: trang admin xác thực bằng x-admin-token,
// không có JWT Supabase.

import { withAxiom } from '../_shared/axiom.ts'
import { corsHeaders, generateWithFallback, json } from '../_shared/ai-provider.ts'

// Header riêng của endpoint này — không nới CORS của endpoint công khai.
const EXTRA_CORS_HEADERS = 'x-admin-token'

const MAX_PROMPT_LEN = 4000 // prompt admin gõ tay
const MIN_SIZE = 320
const MAX_SIZE = 4096
const MAX_SVG_BYTES = 300 * 1024 // khớp ngưỡng cảnh báo bên trang admin
const GEN_TIMEOUT_MS = 60000 // vẽ SVG lâu hơn sinh text, nới hơn mặc định 25s

// Ảnh nền là hình trang trí thuần tuý → tắt hẳn thinking cho nhanh, để
// maxOutputTokens rộng vì SVG dài.
const GEN_CFG_SVG = {
  temperature: 1.0,
  maxOutputTokens: 16384,
  thinkingConfig: { thinkingBudget: 0 },
}

const GROQ_SYS_SVG =
  'Bạn là hoạ sĩ đồ hoạ vector. Chỉ trả về DUY NHẤT một tài liệu SVG hợp lệ, ' +
  'bắt đầu bằng <svg và kết thúc bằng </svg>. KHÔNG markdown, KHÔNG giải thích, ' +
  'KHÔNG dùng <script>, <foreignObject>, <image>, hay tham chiếu tới file bên ngoài.'

// So sánh chuỗi không phụ thuộc thời gian, tránh rò rỉ token qua timing attack.
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length || a.length === 0) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

function clampInt(v: unknown, min: number, max: number, dflt: number): number {
  const n = Math.round(Number(v))
  if (!Number.isFinite(n)) return dflt
  return Math.min(max, Math.max(min, n))
}

/**
 * Bóc phần SVG ra khỏi output của model rồi loại các nút nguy hiểm.
 * Trả null nếu không tìm thấy SVG hợp lệ.
 *
 * Đây là lớp chặn THỨ NHẤT; trang admin lọc lại lần nữa trước khi ghi đĩa.
 */
function extractSvg(raw: string): string | null {
  // Model hay bọc trong ```svg … ``` hoặc kèm lời dẫn.
  const start = raw.indexOf('<svg')
  const end = raw.lastIndexOf('</svg>')
  if (start < 0 || end < 0 || end <= start) return null

  let svg = raw.slice(start, end + '</svg>'.length)

  // Bỏ nút chạy được hoặc kéo tài nguyên ngoài. Dùng background-image thì script
  // không chạy, nhưng file còn nằm trong repo và có thể bị mở trực tiếp.
  svg = svg
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '')
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son\w+\s*=\s*'[^']*'/gi, '')

  if (!/^<svg[\s>]/i.test(svg)) return null
  return svg.trim()
}

Deno.serve(withAxiom('ai-background', async (req, log) => {
  const origin = req.headers.get('origin')

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(origin, EXTRA_CORS_HEADERS) })
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405, origin, EXTRA_CORS_HEADERS)
  }

  // ── Chặn quản trị: làm TRƯỚC mọi thứ khác, kể cả đọc body ──────────────────
  const token = req.headers.get('x-admin-token')
  if (!timingSafeEqual(token ?? '', Deno.env.get('ADMIN_SECRET_TOKEN') ?? '')) {
    log.warn('ai.background_unauthorized', { origin })
    return json({ error: 'Unauthorized' }, 401, origin, EXTRA_CORS_HEADERS)
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Body không hợp lệ' }, 400, origin, EXTRA_CORS_HEADERS)
  }

  const prompt = String(body.prompt ?? '').trim().slice(0, MAX_PROMPT_LEN)
  if (prompt.length < 20) {
    return json({ error: 'Prompt quá ngắn' }, 400, origin, EXTRA_CORS_HEADERS)
  }
  const width = clampInt(body.width, MIN_SIZE, MAX_SIZE, 1920)
  const height = clampInt(body.height, MIN_SIZE, MAX_SIZE, 1080)

  // Ràng buộc kỹ thuật do server áp, admin chỉ điều khiển phần nội dung mỹ thuật.
  const fullPrompt =
    `${prompt}\n\n` +
    `--- RÀNG BUỘC KỸ THUẬT (bắt buộc) ---\n` +
    `- Trả về DUY NHẤT một tài liệu SVG, không markdown, không lời dẫn.\n` +
    `- Thẻ gốc: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" ` +
    `width="${width}" height="${height}" preserveAspectRatio="xMidYMid slice">\n` +
    `- Chỉ dùng hình khối vector (path, circle, ellipse, rect, polygon, linearGradient, ` +
    `radialGradient, filter). TUYỆT ĐỐI KHÔNG dùng <script>, <foreignObject>, <image>, ` +
    `<use href> trỏ ra ngoài, @import, hay bất kỳ URL bên ngoài nào.\n` +
    `- Không nhúng font ngoài; cần chữ thì dùng font-family chung chung ` +
    `(serif/sans-serif) hoặc vẽ thành path.\n` +
    `- Hoạ tiết phải phủ kín toàn khung, không chừa viền trắng.\n` +
    `- Giữ file dưới ${Math.floor(MAX_SVG_BYTES / 1024)}KB: ưu tiên ít hình lớn, ` +
    `dùng <g> + transform để lặp thay vì chép tay hàng trăm node.`

  const out = await generateWithFallback(
    fullPrompt,
    { gemini: GEN_CFG_SVG, groq: { system: GROQ_SYS_SVG }, timeoutMs: GEN_TIMEOUT_MS },
    log,
    'background',
  )
  if (!out) {
    return json({ error: 'Không tạo được ảnh nền, vui lòng thử lại' }, 503, origin, EXTRA_CORS_HEADERS)
  }

  const svg = extractSvg(out.raw)
  if (!svg) {
    log.warn('ai.background_no_svg', { provider: out.provider, len: out.raw.length })
    return json({ error: 'AI không trả về SVG hợp lệ, thử sửa prompt rồi tạo lại' }, 502, origin, EXTRA_CORS_HEADERS)
  }

  const bytes = new TextEncoder().encode(svg).length
  if (bytes > MAX_SVG_BYTES) {
    return json(
      { error: `SVG nặng ${Math.round(bytes / 1024)}KB, vượt ngưỡng ${Math.floor(MAX_SVG_BYTES / 1024)}KB — hãy yêu cầu hoạ tiết đơn giản hơn` },
      502,
      origin,
      EXTRA_CORS_HEADERS,
    )
  }

  log.info('ai.background_ok', { provider: out.provider, width, height, bytes })
  return json({ svg, provider: out.provider }, 200, origin, EXTRA_CORS_HEADERS)
}))
