// Luật "thiệp quá hạn giữ" + phép xoá một thiệp. Dùng CHUNG cho cron cleanup-weddings
// và tab Dọn dữ liệu của admin (wedding-admin resource=cleanup) — hai đường phải xét
// đúng một điều kiện, đổi luật chỉ sửa ở đây. Chi tiết: docs/cleanup-retention.md.

import { WEDDING_IMAGE_SELECT, removeWeddingStorage } from './wedding-images.ts'

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
