// Luật "thiệp quá hạn giữ" + phép xoá một thiệp, và luật dọn sổ giữ slug. Dùng CHUNG
// cho cron cleanup-weddings và tab Dọn dữ liệu của admin (wedding-admin resource=cleanup)
// — hai đường phải xét đúng một điều kiện, đổi luật chỉ sửa ở đây. Chi tiết:
// docs/cleanup-retention.md.

import { WEDDING_IMAGE_SELECT, removeWeddingStorage } from './wedding-images.ts'
import { slugHoldCutoff } from './slug-holds.ts'

// deno-lint-ignore no-explicit-any
type Db = any

export type ExpiredReason = 'unpaid' | 'draft'

export const EXPIRED_SELECT =
  `id, slug, groom_name, bride_name, is_published, payment_status, expires_at, updated_at, ` +
  WEDDING_IMAGE_SELECT

/**
 * Hai nhóm quá hạn. `ids` có thì chỉ xét trong các id đó — dùng để KIỂM LẠI danh
 * sách admin gửi lên trước khi xoá. Lỗi truy vấn trả `error`, nơi gọi phải DỪNG.
 */
export async function findExpiredWeddings(
  supabase: Db,
  days: number,
  opts: { limit: number; ids?: string[] },
) {
  const cutoff = new Date(Date.now() - days * 86400000).toISOString()

  // (1) Đã xuất bản, chưa thanh toán, quá hạn dùng thử thêm `days` ngày. Hai điều
  // kiện sau là CHỐT AN TOÀN, thiếu một cái là xoá nhầm thiệp đã kích hoạt: phải
  // còn expires_at (null = đã thanh toán) và payment_status khác 'completed'. Hỏi cả
  // `is.null` vì neq bỏ qua hàng NULL.
  let unpaidQ = supabase
    .from('weddings')
    .select(EXPIRED_SELECT)
    .eq('is_published', true)
    .or('payment_status.is.null,payment_status.neq.completed')
    .not('expires_at', 'is', null)
    .lt('expires_at', cutoff)
    .order('expires_at', { ascending: true })
    .limit(opts.limit)

  // (2) Nháp không đụng tới quá `days` ngày (updated_at do trigger đặt).
  let draftQ = supabase
    .from('weddings')
    .select(EXPIRED_SELECT)
    .eq('is_published', false)
    .lt('updated_at', cutoff)
    .order('updated_at', { ascending: true })
    .limit(opts.limit)

  if (opts.ids) {
    unpaidQ = unpaidQ.in('id', opts.ids)
    draftQ = draftQ.in('id', opts.ids)
  }

  const [u, d] = await Promise.all([unpaidQ, draftQ])
  if (u.error || d.error) {
    return {
      cutoff,
      error: `unpaid: ${u.error?.message ?? 'ok'} · draft: ${d.error?.message ?? 'ok'}`,
      victims: [] as Array<{ row: Record<string, unknown>; reason: ExpiredReason }>,
    }
  }
  const victims = [
    ...(u.data ?? []).map((row: Record<string, unknown>) => ({ row, reason: 'unpaid' as const })),
    ...(d.data ?? []).map((row: Record<string, unknown>) => ({ row, reason: 'draft' as const })),
  ]
  return { cutoff, victims, error: undefined as string | undefined }
}

/**
 * Xoá HẲN một thiệp: ảnh trước (hàng là nơi duy nhất giữ thư mục ảnh), rồi hàng
 * (guests cascade theo FK). Ném lỗi để nơi gọi ghi log kèm id.
 */
export async function deleteWeddingHard(
  supabase: Db,
  row: Record<string, unknown>,
): Promise<number> {
  const rm = await removeWeddingStorage(supabase, row)
  if (rm.error) throw new Error(`storage: ${rm.error}`)
  const { error } = await supabase.from('weddings').delete().eq('id', row.id)
  if (error) throw new Error(`${error.code ?? ''} ${error.message}`.trim())
  return rm.removed
}

/* ─────────────────────── sổ giữ slug (wedding_slug_holds) ─────────────────────── */

// Hàng sổ quá SLUG_HOLD_DAYS (_shared/slug-holds.ts) không còn tác dụng gì nên được dọn.
// Cố ý KHÔNG nhận ?days= ghi đè: hạ số ngày là xoá luôn hàng còn đang giữ, mở lại lỗ
// xoá-đi-tạo-lại.

/** Hàng sổ đã quá hạn giữ, cũ nhất trước. Lỗi truy vấn trả `error`, nơi gọi phải DỪNG. */
export async function findExpiredSlugHolds(supabase: Db, opts: { limit: number }) {
  const cutoff = slugHoldCutoff()
  const { data, error } = await supabase
    .from('wedding_slug_holds')
    .select('slug, user_id, expires_at, deleted_at')
    .lt('deleted_at', cutoff)
    .order('deleted_at', { ascending: true })
    .limit(opts.limit)
  return {
    cutoff,
    holds: (data ?? []) as Array<{ slug: string; user_id: string | null; expires_at: string; deleted_at: string }>,
    error: error ? `${error.code ?? ''} ${error.message}`.trim() : undefined,
  }
}

/**
 * Xoá hàng sổ quá hạn giữ. Điều kiện hạn nằm NGAY TRONG lệnh xoá, nên slug vừa bị xoá
 * lại (trigger đóng dấu deleted_at mới) giữa lúc quét và lúc xoá sẽ không bị đụng.
 * `slugs` có thì chỉ xét trong các slug đó (admin chọn tay); không có thì dọn hết.
 */
export async function deleteExpiredSlugHolds(supabase: Db, slugs?: string[]) {
  let q = supabase.from('wedding_slug_holds').delete().lt('deleted_at', slugHoldCutoff())
  if (slugs) q = q.in('slug', slugs)
  const { data, error } = await q.select('slug')
  if (error) return { deleted: [] as string[], error: `${error.code ?? ''} ${error.message}`.trim() }
  return { deleted: (data ?? []).map((r: { slug: string }) => r.slug), error: undefined as string | undefined }
}
