// Tầng gọi model dùng chung cho các Edge Function AI (ai-invitation, ai-background).
// Chỉ có kỹ thuật gọi provider + CORS, KHÔNG chứa nghiệp vụ của bất kỳ tính năng nào:
// prompt, schema, hạn mức… nằm ở từng function.
//
// Gemini là provider chính (xoay vòng nhiều key), Groq là fallback.
// API key chỉ đọc từ secret của Edge Function, không bao giờ trả ra client.

import type { Logger } from './axiom.ts'

export const GEMINI_MODEL = 'gemini-2.5-flash'
export const GROQ_MODEL = 'llama-3.3-70b-versatile'
export const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'
export const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'

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

export function withTimeout(ms: number) {
  const ctrl = new AbortController()
  const id = setTimeout(() => ctrl.abort(), ms)
  return { signal: ctrl.signal, clear: () => clearTimeout(id) }
}

// Đọc danh sách key Gemini để xoay vòng.
// Hỗ trợ cả GEMINI_API_KEYS (nhiều key, phân tách bằng dấu chấm phẩy ";") lẫn GEMINI_API_KEY (1 key).
export function getGeminiKeys(): string[] {
  const multi = Deno.env.get('GEMINI_API_KEYS') ?? ''
  const single = Deno.env.get('GEMINI_API_KEY') ?? ''
  const keys = [...multi.split(';'), single]
    .map((k) => k.trim())
    .filter(Boolean)
  return [...new Set(keys)] // loại trùng
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
    if (!res.ok) throw new Error(`gemini ${res.status}`)
    const data = await res.json()
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
    if (!text) throw new Error('gemini empty')
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
): Promise<string> {
  const n = keys.length
  const start = Math.floor(Math.random() * n)
  let lastErr: unknown = null
  for (let i = 0; i < n; i++) {
    const key = keys[(start + i) % n]
    try {
      return await callGemini(prompt, key, genConfig, timeoutMs)
    } catch (e) {
      lastErr = e
      console.error(`Gemini key #${(start + i) % n} failed:`, errMsg(e))
    }
  }
  throw lastErr ?? new Error('gemini all keys failed')
}

// Gọi Groq (fallback) — system tuỳ tác vụ; jsonMode bật response_format json_object.
export async function callGroq(
  prompt: string,
  apiKey: string,
  opts: { system: string; jsonMode?: boolean; timeoutMs?: number },
): Promise<string> {
  const t = withTimeout(opts.timeoutMs ?? REQ_TIMEOUT_MS)
  try {
    const payload: Record<string, unknown> = {
      model: GROQ_MODEL,
      temperature: 0.9,
      messages: [
        { role: 'system', content: opts.system },
        { role: 'user', content: prompt },
      ],
    }
    if (opts.jsonMode) payload.response_format = { type: 'json_object' }
    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      signal: t.signal,
      body: JSON.stringify(payload),
    })
    if (!res.ok) throw new Error(`groq ${res.status}`)
    const data = await res.json()
    const text = data?.choices?.[0]?.message?.content
    if (!text) throw new Error('groq empty')
    return text
  } finally {
    t.clear()
  }
}

// HÀM CHUNG cho MỌI tác vụ non-stream: Gemini (xoay vòng key) → fallback Groq.
// Trả { raw, provider } hoặc null nếu cả hai provider đều hỏng.
export async function generateWithFallback(
  prompt: string,
  cfg: {
    gemini: Record<string, unknown>
    groq: { system: string; jsonMode?: boolean }
    timeoutMs?: number
  },
  log: Logger,
  tag: string,
): Promise<{ raw: string; provider: string } | null> {
  const keys = getGeminiKeys()
  if (keys.length) {
    try {
      return {
        raw: await callGeminiRotating(prompt, keys, cfg.gemini, cfg.timeoutMs),
        provider: 'gemini',
      }
    } catch (e) {
      log.warn(`ai.${tag}_gemini_failed`, { error: errMsg(e) })
    }
  }
  const groqKey = Deno.env.get('GROQ_API_KEY')
  if (groqKey) {
    try {
      return {
        raw: await callGroq(prompt, groqKey, { ...cfg.groq, timeoutMs: cfg.timeoutMs }),
        provider: 'groq',
      }
    } catch (e) {
      log.warn(`ai.${tag}_groq_failed`, { error: errMsg(e) })
    }
  }
  return null
}
