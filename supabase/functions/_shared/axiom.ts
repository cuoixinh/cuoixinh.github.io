// _shared/axiom.ts — Logger tập trung, đẩy log về Axiom cho các Edge Function.
//   Deno.serve(withAxiom('wedding-admin', async (req, log) => {
//     log.info('wedding.created', { id }); return new Response(...)
//   }))
// Thiếu AXIOM_TOKEN / AXIOM_DATASET → logger no-op nên local/dev vẫn chạy.
// ⚠️ KHÔNG log dữ liệu nhạy cảm (token thanh toán, chữ ký webhook, key AI).

const AXIOM_TOKEN = Deno.env.get('AXIOM_TOKEN') ?? ''
const AXIOM_DATASET = Deno.env.get('AXIOM_DATASET') ?? ''
const AXIOM_URL = `https://api.axiom.co/v1/datasets/${AXIOM_DATASET}/ingest`
const ENABLED = Boolean(AXIOM_TOKEN && AXIOM_DATASET)

type Fields = Record<string, unknown>

export interface Logger {
  info: (message: string, fields?: Fields) => void
  warn: (message: string, fields?: Fields) => void
  error: (message: string, fields?: Fields) => void
  flush: () => Promise<void>
}

interface AxiomEvent {
  _time: string
  level: 'info' | 'warn' | 'error'
  source: string
  message: string
  [key: string]: unknown
}

function createLogger(source: string, base: Fields = {}): Logger {
  const buffer: AxiomEvent[] = []

  const push = (level: 'info' | 'warn' | 'error', message: string, fields?: Fields) => {
    // Vẫn in ra console để có trong log của Supabase
    const line = `[${level}] ${source}: ${message}`
    if (level === 'error') console.error(line, fields ?? '')
    else if (level === 'warn') console.warn(line, fields ?? '')
    else console.log(line, fields ?? '')

    if (!ENABLED) return
    buffer.push({
      _time: new Date().toISOString(),
      level,
      source,
      message,
      ...base,
      ...(fields ?? {}),
    })
  }

  return {
    info: (m, f) => push('info', m, f),
    warn: (m, f) => push('warn', m, f),
    error: (m, f) => push('error', m, f),
    async flush() {
      if (!ENABLED || buffer.length === 0) return
      const events = buffer.splice(0, buffer.length)
      try {
        await fetch(AXIOM_URL, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${AXIOM_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(events),
        })
      } catch (err) {
        // Không để lỗi logging làm hỏng request
        console.error('Axiom ingest failed:', err instanceof Error ? err.message : String(err))
      }
    },
  }
}

// Gọi flush qua EdgeRuntime.waitUntil nếu có (không chặn response),
// nếu không thì await trực tiếp để chắc chắn không mất log.
function scheduleFlush(log: Logger): Promise<void> | void {
  const runtime = (globalThis as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } })
    .EdgeRuntime
  if (runtime?.waitUntil) {
    runtime.waitUntil(log.flush())
    return
  }
  return log.flush()
}

type Handler = (req: Request, log: Logger) => Promise<Response> | Response

/**
 * Bọc handler của Edge Function: tự log start/done/error + đo thời gian, rồi flush.
 */
export function withAxiom(source: string, handler: Handler): (req: Request) => Promise<Response> {
  return async (req: Request): Promise<Response> => {
    const requestId = crypto.randomUUID()
    const url = new URL(req.url)
    const started = Date.now()

    const log = createLogger(source, {
      request_id: requestId,
      method: req.method,
      path: url.pathname,
    })

    // Preflight không cần log ồn ào
    if (req.method === 'OPTIONS') {
      return handler(req, log)
    }

    log.info('request.start', {
      resource: url.searchParams.get('resource') ?? undefined,
      action: url.searchParams.get('action') ?? undefined,
    })

    try {
      const res = await handler(req, log)
      const done: Fields = {
        status: res.status,
        duration_ms: Date.now() - started,
      }
      if (res.status >= 400) {
        // Response lỗi (kể cả khi handler chỉ `return` chứ không `throw`): đọc kèm
        // body để lộ chi tiết (hầu hết nhánh đã trả {error:...}). Body chỉ là thông
        // báo lỗi nên an toàn để log; cắt bớt tránh payload quá dài.
        let body: string | undefined
        try { body = (await res.clone().text()).slice(0, 2000) } catch { /* không đọc được body */ }
        // 5xx = lỗi server → error; 4xx = client sai (thiếu field, 401/404) → warn cho đỡ nhiễu.
        if (res.status >= 500) log.error('request.failed', { ...done, body })
        else log.warn('request.failed', { ...done, body })
      } else {
        log.info('request.done', done)
      }
      await scheduleFlush(log)
      return res
    } catch (err) {
      log.error('request.error', {
        duration_ms: Date.now() - started,
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      })
      await scheduleFlush(log)
      return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  }
}

export { createLogger }
