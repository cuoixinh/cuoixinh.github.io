// Gói thời hạn của thiệp — nguồn sự thật DUY NHẤT về số tháng, hệ số giá và luật
// nâng gói. Giá gốc là template_pricing.price (= gói 3 tháng); payment-handler báo
// giá + tạo đơn, payos-webhook áp hạn, wedding-admin khoá thiệp đều hỏi qua đây.
// Client không giữ bản sao: màn thanh toán xin báo giá qua payment-handler/quote.

export type PlanId = '3m' | '6m' | 'lifetime'

export const PLANS: Record<PlanId, { months: number | null; factor: number; rank: number; label: string }> = {
  '3m': { months: 3, factor: 1, rank: 0, label: '3 tháng' },
  '6m': { months: 6, factor: 1.3, rank: 1, label: '6 tháng' },
  lifetime: { months: null, factor: 1.5, rank: 2, label: 'Vĩnh viễn' },
}

export const PLAN_IDS = Object.keys(PLANS) as PlanId[]

export function isPlanId(v: unknown): v is PlanId {
  return typeof v === 'string' && v in PLANS
}

// Làm tròn tới nghìn đồng: giá lẻ nhân hệ số ra số lẻ trăm đồng.
export function planPrice(base: number, plan: PlanId): number {
  return Math.round((base * PLANS[plan].factor) / 1000) * 1000
}

type PlanRow = { payment_status?: string | null; plan?: string | null; plan_expires_at?: string | null }

/** Gói đang giữ. Chưa thanh toán → null; đã thanh toán mà chưa có cột plan → vĩnh viễn. */
export function currentPlan(row: PlanRow): PlanId | null {
  if (row.payment_status !== 'completed') return null
  return isPlanId(row.plan) ? row.plan : 'lifetime'
}

export function isPlanExpired(row: PlanRow, now = Date.now()): boolean {
  return row.payment_status === 'completed' &&
    !!row.plan_expires_at &&
    new Date(row.plan_expires_at).getTime() < now
}

function addMonths(d: Date, n: number): Date {
  const r = new Date(d)
  r.setUTCMonth(r.getUTCMonth() + n)
  return r
}

/**
 * Hạn mới sau khi trả xong đơn gói `to`. Mua mới: tính từ bây giờ. Nâng từ gói có
 * hạn: tính từ ngày BẮT ĐẦU gói cũ (hạn cũ + phần tháng chênh), vì khách chỉ trả
 * phần chênh giá chứ không mua lại từ đầu.
 */
export function planExpiry(from: PlanId | null, curExpires: string | null | undefined, to: PlanId, now = new Date()): string | null {
  const months = PLANS[to].months
  if (months == null) return null
  const fromMonths = from ? PLANS[from].months : null
  if (fromMonths != null && curExpires) {
    return addMonths(new Date(curExpires), months - fromMonths).toISOString()
  }
  return addMonths(now, months).toISOString()
}

export type PlanQuote = {
  id: PlanId
  label: string
  months: number | null
  price: number
  original_price: number | null
  /** Số phải trả cho lượt này: giá gói khi mua mới, phần chênh khi nâng gói. */
  amount: number
  /** Thiệp mở tới khi nào nếu trả gói này bây giờ (null = vĩnh viễn) — màn thanh toán hiện ra. */
  expires_at: string | null
  available: boolean
  reason?: 'current' | 'lower' | 'too_late'
}

/**
 * Báo giá cả ba gói cho một thiệp. `from` = gói đang giữ (null = mua mới). Chỉ được
 * NÂNG lên gói cao hơn; nâng lên gói có hạn mà hạn mới vẫn ở quá khứ thì chặn
 * (trả tiền xong thiệp vẫn khoá) — khi đó chỉ còn gói vĩnh viễn.
 */
export function quotePlans(
  base: number,
  original: number | null,
  from: PlanId | null,
  curExpires: string | null | undefined,
  now = new Date(),
): PlanQuote[] {
  return PLAN_IDS.map((id) => {
    const p = PLANS[id]
    const price = planPrice(base, id)
    const original_price = original && original > base ? planPrice(original, id) : null
    const q: PlanQuote = {
      id, label: p.label, months: p.months, price, original_price, amount: price,
      expires_at: planExpiry(null, null, id, now), available: true,
    }
    if (!from) return q
    q.original_price = null
    q.amount = price - planPrice(base, from)
    if (id === from) return { ...q, expires_at: curExpires ?? null, available: false, reason: 'current' }
    q.expires_at = planExpiry(from, curExpires, id, now)
    if (p.rank < PLANS[from].rank) return { ...q, available: false, reason: 'lower' }
    if (q.expires_at && new Date(q.expires_at).getTime() <= now.getTime()) return { ...q, available: false, reason: 'too_late' }
    return q
  })
}
