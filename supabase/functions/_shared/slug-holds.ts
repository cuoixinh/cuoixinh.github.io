// Luật đặt slug khi có sổ giữ slug (bảng wedding_slug_holds, trigger ghi lúc xoá thiệp
// dùng thử chưa thanh toán). Nơi DUY NHẤT: wedding-admin (POST/PATCH/GET), payment-handler
// (tạo hàng lúc thanh toán) và việc dọn sổ (_shared/wedding-cleanup.ts) đều đọc từ đây —
// một đường đặt slug không hỏi qua file này là lại lấy được link đang giữ.

import type { Logger } from './axiom.ts'

// deno-lint-ignore no-explicit-any
type Db = any

// Số ngày giữ slug sau khi xoá: chỉ chủ cũ lấy lại được, thiệp xuất bản với slug đó kế
// thừa hạn dùng thử cũ. Quá hạn thì hàng sổ hết tác dụng và được cron dọn.
export const SLUG_HOLD_DAYS = 90

/** Mốc: hàng có deleted_at >= mốc là CÒN giữ, nhỏ hơn là hết hạn. */
export function slugHoldCutoff(): string {
  return new Date(Date.now() - SLUG_HOLD_DAYS * 86400000).toISOString()
}

export type SlugHold = { user_id: string | null; expires_at: string }

/** Bản ghi giữ còn hiệu lực, null nếu slug không bị giữ. Lỗi truy vấn thì NÉM: đây là phép kiểm. */
export async function findSlugHold(db: Db, slug: string, log: Logger): Promise<SlugHold | null> {
  const { data, error } = await db
    .from('wedding_slug_holds')
    .select('user_id, expires_at')
    .eq('slug', slug)
    .gte('deleted_at', slugHoldCutoff())
    .maybeSingle()
  if (error) {
    log.error('wedding.slug_hold_check_failed', { slug, code: error.code, message: error.message })
    throw new Error('Không kiểm tra được slug, vui lòng thử lại')
  }
  return data
}

/**
 * Slug chưa ai dùng, thêm hậu tố -2, -3… khi trùng. Trùng = đang có thiệp mang (trừ
 * `excludeId`) hoặc đang bị giữ cho người khác `ownerId`. Lỗi truy vấn thì NÉM.
 */
export async function getUniqueSlug(
  db: Db,
  baseSlug: string,
  opts: { ownerId: string | null; excludeId?: string; log: Logger },
): Promise<string> {
  let finalSlug = baseSlug
  let suffix = 1
  while (true) {
    let query = db.from('weddings').select('id').eq('slug', finalSlug)
    if (opts.excludeId) query = query.neq('id', opts.excludeId)
    const { data: existing, error } = await query.maybeSingle()
    if (error) {
      opts.log.error('wedding.slug_check_failed', { slug: finalSlug, code: error.code, message: error.message })
      throw new Error('Không kiểm tra được slug, vui lòng thử lại')
    }
    if (!existing) {
      const hold = await findSlugHold(db, finalSlug, opts.log)
      if (!hold || (opts.ownerId && hold.user_id === opts.ownerId)) return finalSlug
    }
    suffix++
    finalSlug = `${baseSlug}-${suffix}`
  }
}
