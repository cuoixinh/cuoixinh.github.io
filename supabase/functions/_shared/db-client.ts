// _shared/db-client.ts — Supabase client cho Edge Function: MỌI chỗ tạo client đi qua đây.
// Bọc fetch để thử lại ĐÚNG MỘT LẦN khi PostgREST trả PGRST303 "JWT issued at future":
// bug đồng hồ đệm của PostgREST (postgrest#5159) làm request đầu sau lúc nhàn rỗi bị
// từ chối dù khoá đúng. PostgREST chặn ở bước kiểm JWT, câu lệnh chưa chạy → thử lại
// an toàn cả với lệnh ghi.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import type { Logger } from './axiom.ts'

const IAT_RETRY_DELAY_MS = 1000

export function createDbClient(log: Logger, key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '') {
  return createClient(Deno.env.get('SUPABASE_URL') ?? '', key, {
    global: { fetch: iatRetryFetch(log) },
  })
}

function iatRetryFetch(log: Logger): typeof fetch {
  return async (input, init) => {
    const res = await fetch(input, init)
    if (res.ok) return res
    // Chỉ gửi lại được khi thân request là chuỗi (PostgREST); stream/FormData đã bị đọc hết.
    const body = init?.body
    const replayable = typeof input === 'string' || input instanceof URL
    if (!replayable || (body != null && typeof body !== 'string')) return res

    const err = await res.clone().json().catch(() => null)
    if (err?.code !== 'PGRST303' || !/issued at future/i.test(String(err?.message ?? ''))) return res

    log.warn('db.jwt_iat_future_retry', {
      method: init?.method ?? 'GET',
      path: new URL(String(input)).pathname,
    })
    await new Promise((r) => setTimeout(r, IAT_RETRY_DELAY_MS))
    return fetch(input, init)
  }
}
