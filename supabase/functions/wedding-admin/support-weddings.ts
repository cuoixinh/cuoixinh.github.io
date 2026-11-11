// resource=support-weddings — tab "Thiệp" của /admin-support: số liệu phân tích khách (thiệp theo
// trạng thái/gói, lượt xem, doanh thu, mẫu, theo tháng) + danh sách thiệp gọn để lọc ở client.
// Chỉ GET. Quyền (SUPPORT_EMAILS) kiểm ở index.ts. Phân loại trạng thái dùng đúng luật của
// _shared/plans.ts (currentPlan / isFreePlan / isPlanExpired) — đừng tự viết lại ở client.

import type { Logger } from '../_shared/axiom.ts'
import { currentPlan, FREE_PLAN, isFreePlan, isPlanExpired } from '../_shared/plans.ts'

// deno-lint-ignore no-explicit-any
type Db = any

const COLS =
  'id, slug, user_id, theme, groom_name, bride_name, is_published, is_active, payment_status, payment_amount, ' +
  'payment_time, plan, plan_expires_at, free_side, expires_at, created_at, wedding_stats(view_count)'
const PAGE = 1000
const MAX_ROWS = 50000 // trần an toàn khi đọc dồn; chạm trần thì báo `truncated`

// Nhóm trạng thái — khoá này client dùng để lọc + đặt nhãn.
export type Status =
  | 'lifetime' // đã thanh toán gói vĩnh viễn
  | '6m' // đã thanh toán gói 6 tháng, còn hạn
  | '6m_expired' // gói 6 tháng đã hết hạn (bị khoá với khách mời)
  | 'free' // gói Miễn phí còn hạn
  | 'free_expired'
  | 'trial' // đã xuất bản, chưa thanh toán, chưa chọn gói, còn hạn dùng thử
  | 'trial_expired'
  | 'draft' // chưa xuất bản, chưa thanh toán

// deno-lint-ignore no-explicit-any
function statusOf(w: any, now: number): Status {
  const plan = currentPlan(w)
  if (plan === 'lifetime') return 'lifetime'
  if (plan === '6m') return isPlanExpired(w, now) ? '6m_expired' : '6m'
  const over = !!w.expires_at && new Date(w.expires_at).getTime() < now
  if (isFreePlan(w)) return over ? 'free_expired' : 'free'
  if (w.is_published) return over ? 'trial_expired' : 'trial'
  return 'draft'
}

const monthOf = (t: string | null) => (t ? t.slice(0, 7) : null)
// n tháng liền nhau (YYYY-MM, UTC) kết thúc ở tháng hiện tại.
function lastMonths(now: number, n: number): string[] {
  const d = new Date(now)
  const out: string[] = []
  for (let i = n - 1; i >= 0; i--) {
    const m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - i, 1))
    out.push(m.toISOString().slice(0, 7))
  }
  return out
}

export async function handleSupportWeddings(
  req: Request,
  db: Db,
  log: Logger,
  corsHeaders: Record<string, string>,
  staffEmail: string,
): Promise<Response> {
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405)

  // Đọc dồn theo trang: một lần select bị PostgREST cắt ở 1000 hàng. Xếp thêm theo id để ranh giới
  // trang ổn định (created_at trùng nhau là lặp/sót hàng).
  // deno-lint-ignore no-explicit-any
  const rows: any[] = []
  let truncated = false
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db.from('weddings').select(COLS).order('created_at', { ascending: false }).order('id').range(from, from + PAGE - 1)
    if (error) {
      log.error('support_weddings.read_failed', { from, code: error.code, message: error.message })
      return json({ error: 'Không đọc được danh sách thiệp' }, 500)
    }
    rows.push(...(data ?? []))
    if (!data || data.length < PAGE) break
    if (rows.length >= MAX_ROWS) {
      truncated = true
      break
    }
  }

  // Email chủ thiệp: chỉ để hiện + tìm. Đọc hỏng thì danh sách vẫn đủ, chỉ thiếu cột này.
  const emails = new Map<string, string>()
  try {
    for (let page = 1; page <= 50; page++) {
      const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 })
      if (error) throw error
      const users = data?.users ?? []
      for (const u of users) if (u.email) emails.set(u.id, u.email)
      if (users.length < 1000) break
    }
  } catch (e) {
    log.error('support_weddings.users_failed', { message: (e as Error)?.message })
  }

  const now = Date.now()
  const counts: Record<Status, number> = { lifetime: 0, '6m': 0, '6m_expired': 0, free: 0, free_expired: 0, trial: 0, trial_expired: 0, draft: 0 }
  const views: Record<Status, number> = { ...counts }
  const owners = new Set<string>()
  const paidOwners = new Set<string>()
  const byOwner = new Map<string, number>()
  const themes = new Map<string, { total: number; paid: number; revenue: number }>()
  const months = new Map<string, { created: number; paid: number; revenue: number }>()
  let revenue = 0
  let hidden = 0
  let nearViewCap = 0

  const list = rows.map((w) => {
    const st = statusOf(w, now)
    const s = Array.isArray(w.wedding_stats) ? w.wedding_stats[0] : w.wedding_stats
    const v = Number(s?.view_count) || 0
    const paid = st === 'lifetime' || st === '6m' || st === '6m_expired'
    const amount = paid ? Number(w.payment_amount) || 0 : 0
    counts[st]++
    views[st] += v
    if (w.is_active === false) hidden++
    if (!paid && w.is_published && v >= FREE_PLAN.views * 0.8) nearViewCap++
    if (w.user_id) {
      owners.add(w.user_id)
      byOwner.set(w.user_id, (byOwner.get(w.user_id) ?? 0) + 1)
      if (paid) paidOwners.add(w.user_id)
    }
    revenue += amount
    const th = w.theme || '(không rõ)'
    const t = themes.get(th) ?? { total: 0, paid: 0, revenue: 0 }
    t.total++
    if (paid) t.paid++
    t.revenue += amount
    themes.set(th, t)
    const mc = monthOf(w.created_at)
    if (mc) {
      const m = months.get(mc) ?? { created: 0, paid: 0, revenue: 0 }
      m.created++
      months.set(mc, m)
    }
    const mp = paid ? monthOf(w.payment_time || w.created_at) : null
    if (mp) {
      const m = months.get(mp) ?? { created: 0, paid: 0, revenue: 0 }
      m.paid++
      m.revenue += amount
      months.set(mp, m)
    }
    return {
      id: w.id,
      slug: w.slug,
      couple: [w.groom_name, w.bride_name].filter(Boolean).join(' & '),
      theme: w.theme,
      status: st,
      free_side: st === 'free' || st === 'free_expired' ? w.free_side : null,
      published: !!w.is_published,
      hidden: w.is_active === false,
      views: v,
      amount,
      owner: w.user_id ? emails.get(w.user_id) ?? null : null,
      created_at: w.created_at,
      paid_at: paid ? w.payment_time : null,
      // Hạn đang áp: gói 6 tháng → plan_expires_at; Free/dùng thử → expires_at.
      expires_at: paid ? w.plan_expires_at ?? null : w.expires_at ?? null,
    }
  })

  const paidCount = counts.lifetime + counts['6m'] + counts['6m_expired']
  const publishedUnpaid = counts.free + counts.free_expired + counts.trial + counts.trial_expired
  log.info('support_weddings.read', { rows: rows.length, by: staffEmail })

  return json({
    generated_at: new Date(now).toISOString(),
    truncated,
    view_cap: FREE_PLAN.views,
    summary: {
      total: rows.length,
      counts,
      views,
      total_views: Object.values(views).reduce((a, b) => a + b, 0),
      paid: paidCount,
      published_unpaid: publishedUnpaid,
      revenue,
      hidden,
      near_view_cap: nearViewCap,
      owners: owners.size,
      paid_owners: paidOwners.size,
      multi_owners: [...byOwner.values()].filter((n) => n > 1).length,
      // Tỉ lệ chuyển đổi: trên số thiệp đã từng xuất bản (đã trả + đang/đã dùng thử/Free).
      conversion: paidCount + publishedUnpaid ? paidCount / (paidCount + publishedUnpaid) : 0,
    },
    themes: [...themes].map(([theme, t]) => ({ theme, ...t })).sort((a, b) => b.total - a.total),
    months: lastMonths(now, 12).map((month) => ({ month, ...(months.get(month) ?? { created: 0, paid: 0, revenue: 0 }) })),
    weddings: list,
  })
}
