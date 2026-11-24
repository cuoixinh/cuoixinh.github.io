// Số chỗ khách mời đã MUA THÊM của một thiệp (bảng guest_addons, đơn đã trả xong).
// guest-handler cộng vào trần theo gói; đọc hỏng thì bên gọi phải DỪNG (fail-closed):
// coi như 0 là khách vừa trả tiền mà không thêm được khách.
import type { Logger } from './axiom.ts'

export type ExtraGuests = { groom: number; bride: number }

// deno-lint-ignore no-explicit-any
export async function extraGuests(db: any, weddingId: string, log: Logger): Promise<ExtraGuests | null> {
  const { data, error } = await db
    .from('guest_addons')
    .select('side, guests')
    .eq('wedding_id', weddingId)
    .eq('status', 'completed')
  if (error) {
    log.error('guest_addon.read_failed', { wedding_id: weddingId, code: error.code, message: error.message })
    return null
  }
  const out: ExtraGuests = { groom: 0, bride: 0 }
  for (const r of data ?? []) {
    if (r.side === 'groom' || r.side === 'bride') out[r.side as 'groom' | 'bride'] += Number(r.guests) || 0
  }
  return out
}
