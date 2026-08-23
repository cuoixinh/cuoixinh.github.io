// Tầng gọi model dùng chung cho các Edge Function AI (ai-chat, ai-invitation,
// wedding-admin). Chỉ có kỹ thuật gọi provider + CORS, KHÔNG chứa nghiệp vụ của
// bất kỳ tính năng nào: prompt, schema, hạn mức… nằm ở từng function.
//
// Provider DUY NHẤT là Gemini; chịu tải bằng cách xoay vòng nhiều key
// (GEMINI_API_KEYS ngăn bằng ";"). Không còn nhà cung cấp dự phòng, nên hết quota
// Gemini là mọi tính năng AI ngừng cho tới khi quota hồi — thêm key là cách duy
// nhất nới trần.
// API key chỉ đọc từ secret của Edge Function, không bao giờ trả ra client.

import type { Logger } from './axiom.ts'

export const GEMINI_MODEL = 'gemini-2.5-flash'
export const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'

export const REQ_TIMEOUT_MS = 25000 // timeout mỗi lần gọi provider

const ALLOWED_ORIGINS = [
  'https://cuoixinh.com',
  'https://www.cuoixinh.com',
  'https://cuoixinh.github.io',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://localhost:3000',
  'https://urban-train-4j44q69x76vv3jv99-5500.app.github.dev',
]

// Header mặc định cho endpoint công khai. Function nào cần thêm header riêng
// (vd ai-background cần x-admin-token) thì truyền qua tham số `extraHeaders`
// của corsHeaders — KHÔNG nới danh sách này, để endpoint công khai không bị
// nới lỏng theo.
const BASE_CORS_HEADERS = 'authorization, x-client-info, apikey, content-type'

export function isAllowedOrigin(origin: string): boolean {
  if (ALLOWED_ORIGINS.includes(origin)) return true
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
}

export function corsHeaders(origin: string | null, extraHeaders = '') {
  const allow = origin && isAllowedOrigin(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': extraHeaders
      ? `${BASE_CORS_HEADERS}, ${extraHeaders}`
      : BASE_CORS_HEADERS,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
}

export function json(data: unknown, status: number, origin: string | null, extraHeaders = '') {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(origin, extraHeaders), 'Content-Type': 'application/json' },
  })
}

// Rút gọn message lỗi cho log.
export function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

// Lỗi từ provider AI, giữ lại đủ thứ cần để chẩn đoán: mã HTTP + message gốc.
// "gemini 400" trơ trọi không phân biệt nổi key sai, hết quota hay schema hỏng.
export class ProviderError extends Error {
  constructor(
    readonly provider: string,
    readonly status: number,
    readonly detail: string,
    readonly reason = '',
  ) {
    super(`${provider} ${status}${reason ? ` [${reason}]` : ''}${detail ? `: ${detail}` : ''}`)
    this.name = 'ProviderError'
  }
}

// Trải lỗi thành field rời cho Axiom — lọc/nhóm theo provider_status dễ hơn hẳn
// so với việc grep trong một chuỗi message.
export function errFields(e: unknown): Record<string, unknown> {
  if (e instanceof ProviderError) {
    return {
      provider: e.provider,
      provider_status: e.status,
      provider_reason: e.reason || undefined,
      provider_detail: e.detail,
    }
  }
  return { error: errMsg(e) }
}

// Body lỗi của Gemini là {error:{message,status}}. Lấy message cho gọn,
// hỏng thì lấy text thô. KHÔNG bao giờ log URL (key nằm trong query string).
const MAX_DETAIL_LEN = 600

export async function readErrorDetail(res: Response): Promise<string> {
  let raw = ''
  try {
    raw = await res.text()
  } catch {
    return ''
  }
  try {
    const j = JSON.parse(raw)
    const msg = j?.error?.message ?? j?.message ?? ''
    const st = j?.error?.status ?? ''
    if (msg) return String(st ? `${st} — ${msg}` : msg).slice(0, MAX_DETAIL_LEN)
  } catch { /* không phải JSON → dùng text thô */ }
  return raw.slice(0, MAX_DETAIL_LEN)
}

export function withTimeout(ms: number) {
  const ctrl = new AbortController()
  const id = setTimeout(() => ctrl.abort(), ms)
  return { signal: ctrl.signal, clear: () => clearTimeout(id) }
}

// Đọc danh sách key Gemini để xoay vòng. Gộp ba nguồn rồi loại trùng:
// GEMINI_API_KEYS (nhiều key ngăn bằng ";") · GEMINI_API_KEY (1 key) ·
// mọi biến tên GEMINI_API_KEY_<hậu tố> (mỗi key một secret riêng).
// Dạng thứ ba để thêm/bớt MỘT key mà không phải biết các key đang có: Dashboard
// Supabase chỉ giữ digest, không đọc lại được giá trị secret cũ.
export function getGeminiKeys(): string[] {
  const keys = [
    ...(Deno.env.get('GEMINI_API_KEYS') ?? '').split(';'),
    Deno.env.get('GEMINI_API_KEY') ?? '',
    ...suffixedKeys(),
  ]
    .map((k) => k.trim())
    .filter(Boolean)
  return [...new Set(keys)] // loại trùng
}

// Các secret GEMINI_API_KEY_<hậu tố>. Quét bằng toObject để hậu tố đặt tự do;
// runtime nào chặn toObject thì lui về dò GEMINI_API_KEY_1..10.
function suffixedKeys(): string[] {
  try {
    const env = Deno.env.toObject()
    return Object.keys(env)
      .filter((k) => k.startsWith('GEMINI_API_KEY_'))
      .sort()
      .map((k) => env[k] ?? '')
  } catch {
    return Array.from({ length: 10 }, (_, i) => Deno.env.get(`GEMINI_API_KEY_${i + 1}`) ?? '')
  }
}

// Gọi Gemini generateContent với generationConfig tuỳ tác vụ.
export async function callGemini(
  prompt: string,
  apiKey: string,
  genConfig: Record<string, unknown>,
  timeoutMs = REQ_TIMEOUT_MS,
): Promise<string> {
  const t = withTimeout(timeoutMs)
  try {
    const res = await fetch(`${GEMINI_BASE}/${GEMINI_MODEL}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: t.signal,
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: genConfig,
      }),
    })
    if (!res.ok) throw new ProviderError('gemini', res.status, await readErrorDetail(res))
    const data = await res.json()
    const cand = data?.candidates?.[0]
    // Nối MỌI part: một candidate có thể mang nhiều part, bỏ sót là mất nội dung.
    const text = (cand?.content?.parts ?? [])
      .map((p: { text?: string }) => p?.text ?? '')
      .join('')
    if (!text) {
      // finishReason là thứ nói thẳng vì sao rỗng: MAX_TOKENS (chạm trần), SAFETY,
      // RECITATION… Thiếu nó thì chỉ biết "empty" và phải ngồi đoán.
      const reason = String(cand?.finishReason ?? 'NO_CANDIDATE')
      const block = data?.promptFeedback?.blockReason
      throw new ProviderError(
        'gemini',
        200,
        block ? `promptFeedback.blockReason=${block}` : 'không có phần text nào',
        reason,
      )
    }
    return text
  } finally {
    t.clear()
  }
}

// Thử lần lượt từng key Gemini; lỗi/hết quota (429) thì xoay sang key kế tiếp.
// Bắt đầu từ vị trí ngẫu nhiên để rải tải giữa các key.
export async function callGeminiRotating(
  prompt: string,
  keys: string[],
  genConfig: Record<string, unknown>,
  timeoutMs = REQ_TIMEOUT_MS,
  log?: Logger,
  tag = 'ai',
): Promise<string> {
  const n = keys.length
  const start = Math.floor(Math.random() * n)
  let lastErr: unknown = null
  for (let i = 0; i < n; i++) {
    const idx = (start + i) % n
    try {
      return await callGemini(prompt, keys[idx], genConfig, timeoutMs)
    } catch (e) {
      lastErr = e
      // key_index chứ KHÔNG phải key: đủ để biết một key hỏng hay cả bộ hỏng.
      const fields = { key_index: idx, keys_total: n, attempt: i + 1, ...errFields(e) }
      if (log) log.warn(`${tag}.gemini_key_failed`, fields)
      else console.error(`Gemini key #${idx} failed:`, errMsg(e))
    }
  }
  throw lastErr ?? new ProviderError('gemini', 0, `cả ${n} key đều hỏng`)
}

// HÀM CHUNG cho MỌI tác vụ non-stream: gọi Gemini, xoay vòng hết các key.
// Trả { raw, provider } hoặc null — khi null thì đã có sẵn MỘT sự kiện
// `ai.<tag>_failed` kèm mã lỗi + message thật của Gemini.
export async function generateWithGemini(
  prompt: string,
  cfg: {
    gemini: Record<string, unknown>
    timeoutMs?: number
  },
  log: Logger,
  tag: string,
): Promise<{ raw: string; provider: string } | null> {
  const keys = getGeminiKeys()
  if (!keys.length) {
    log.error(`ai.${tag}_failed`, { gemini_keys: 0, reason: 'chưa đặt GEMINI_API_KEYS' })
    return null
  }

  try {
    return {
      raw: await callGeminiRotating(prompt, keys, cfg.gemini, cfg.timeoutMs, log, `ai.${tag}`),
      provider: 'gemini',
    }
  } catch (e) {
    // errFields trải mã + message của Gemini thành field rời: dòng tổng kết mà
    // không mang lỗi thì soi log xong vẫn phải ngồi đoán.
    log.error(`ai.${tag}_failed`, { gemini_keys: keys.length, ...errFields(e) })
    return null
  }
}
