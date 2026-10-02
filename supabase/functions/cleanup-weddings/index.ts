// cleanup-weddings — dọn thiệp chưa thanh toán / nháp bỏ quên đã quá hạn giữ, và hàng
// sổ giữ slug (wedding_slug_holds) đã quá SLUG_HOLD_DAYS.
// Gọi mỗi ngày một lần bởi pg_cron + pg_net (xem changelogs/RC1.10). Không có UI
// nào gọi vào đây; quyền dựa hoàn toàn vào header x-admin-token nên function phải
// deploy với Verify JWT = OFF (giống payos-webhook).
//
// ⚠️ Xoá là xoá HẲN, không cứu lại được: mất luôn ảnh trong Storage, khách mời và
// lời chúc (guests cascade theo FK). Soi trước bằng ?dry_run=1.
//
// Biến môi trường: ADMIN_SECRET_TOKEN (dùng chung với wedding-admin) ·
// RETENTION_DAYS (tuỳ chọn, mặc định 30) · SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.
// Tham số query: ?dry_run=1 (chỉ liệt kê) · ?days=N (ghi đè hạn, để thử tay).

import { createDbClient } from '../_shared/db-client.ts'
import { withAxiom } from '../_shared/axiom.ts'
import { weddingFileNames } from '../_shared/wedding-images.ts'
import {
  findExpiredWeddings,
  deleteWeddingHard,
  findExpiredSlugHolds,
  deleteExpiredSlugHolds,
} from '../_shared/wedding-cleanup.ts'

// Số ngày giữ. Phải khớp CONFIG.retention ở core/config.js — hai nơi, đổi một bên
// là web nói một đằng hệ thống làm một nẻo.
const RETENTION_DAYS = Number(Deno.env.get('RETENTION_DAYS') ?? '30')

// Trần cho MỖI NHÓM (chưa thanh toán / nháp) trong một lần chạy: net.http_post chờ
// tối đa 30s, mỗi thiệp là vài lượt gọi (liệt kê thư mục + xoá ảnh + xoá hàng). Còn
// dư thì hôm sau dọn tiếp, không việc gì phải vét sạch trong một lượt.
const MAX_PER_RUN = 100

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length || a.length === 0) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

Deno.serve(withAxiom('cleanup-weddings', async (req, log) => {
  // Token RIÊNG cho việc dọn dẹp. Dùng chung ADMIN_SECRET_TOKEN thì một mã lộ ra
  // là vừa mất toàn quyền DB vừa mất nút xoá hàng loạt; tách ra để xoay vòng độc
  // lập. Chưa đặt CLEANUP_SECRET_TOKEN thì vẫn lùi về mã admin (không gãy cron
  // đang chạy) — đặt xong nhớ cập nhật Vault `cleanup_token`.
  const token = req.headers.get('x-admin-token')
  const expected = Deno.env.get('CLEANUP_SECRET_TOKEN') || Deno.env.get('ADMIN_SECRET_TOKEN') || ''
  if (!timingSafeEqual(token ?? '', expected)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const url = new URL(req.url)
  const dryRun = url.searchParams.get('dry_run') === '1'
  const days = Number(url.searchParams.get('days') || RETENTION_DAYS)
  if (!Number.isFinite(days) || days < 1) {
    return new Response(JSON.stringify({ error: 'days không hợp lệ' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const supabase = createDbClient(log)

  const { cutoff, victims, error: queryError } = await findExpiredWeddings(supabase, days, {
    limit: MAX_PER_RUN,
  })

  if (queryError) {
    log.error('cleanup.query_failed', { error: queryError })
    return new Response(JSON.stringify({ error: queryError }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const unpaidCount = victims.filter((v) => v.reason === 'unpaid').length
  log.info('cleanup.run', {
    days,
    dry_run: dryRun,
    unpaid: unpaidCount,
    drafts: victims.length - unpaidCount,
  })

  if (dryRun) {
    // Chỉ để xem: hỏng thì báo trong response, không chặn phần thiệp.
    const holds = await findExpiredSlugHolds(supabase, { limit: MAX_PER_RUN })
    if (holds.error) log.error('cleanup.slug_holds_query_failed', { error: holds.error })
    return new Response(
      JSON.stringify({
        dry_run: true,
        days,
        cutoff,
        slug_holds: holds.error
          ? { error: holds.error }
          : { cutoff: holds.cutoff, count: holds.holds.length, items: holds.holds },
        count: victims.length,
        items: victims.map(({ row, reason }) => ({
          id: row.id,
          slug: row.slug,
          name: [row.groom_name, row.bride_name].filter(Boolean).join(' & '),
          reason,
          expires_at: row.expires_at,
          updated_at: row.updated_at,
          files: weddingFileNames(row).length,
        })),
      }),
      { headers: { 'Content-Type': 'application/json' } },
    )
  }

  let deletedUnpaid = 0
  let deletedDraft = 0
  let filesRemoved = 0
  const errors: Array<{ id: string; error: string }> = []

  for (const { row, reason } of victims) {
    try {
      const files = await deleteWeddingHard(supabase, row)
      filesRemoved += files
      if (reason === 'unpaid') deletedUnpaid++
      else deletedDraft++
      log.info('cleanup.deleted', { id: row.id, slug: row.slug, reason, files })
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      errors.push({ id: String(row.id), error: message })
      log.error('cleanup.failed', { id: row.id, reason, error: message })
    }
  }

  // Sổ giữ slug: chạy SAU phần thiệp (thiệp vừa xoá ghi hàng mới, deleted_at = hôm nay,
  // không dính). Hỏng thì ghi log rồi thôi — để sót hàng hết hạn chỉ tốn chỗ, không
  // chặn ai, mai cron dọn tiếp.
  const holds = await deleteExpiredSlugHolds(supabase)
  if (holds.error) log.error('cleanup.slug_holds_failed', { error: holds.error })
  else log.info('cleanup.slug_holds_deleted', { count: holds.deleted.length })

  return new Response(
    JSON.stringify({
      days,
      cutoff,
      slug_holds_deleted: holds.deleted.length,
      slug_holds_error: holds.error ?? null,
      deleted_unpaid: deletedUnpaid,
      deleted_draft: deletedDraft,
      files_removed: filesRemoved,
      errors,
    }),
    { headers: { 'Content-Type': 'application/json' } },
  )
}))
