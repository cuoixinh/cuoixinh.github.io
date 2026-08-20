// cleanup-weddings — dọn thiệp chưa thanh toán / nháp bỏ quên đã quá hạn giữ.
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

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { withAxiom } from '../_shared/axiom.ts'

// Số ngày giữ. Phải khớp CONFIG.retention ở core/config.js — hai nơi, đổi một bên
// là web nói một đằng hệ thống làm một nẻo.
const RETENTION_DAYS = Number(Deno.env.get('RETENTION_DAYS') ?? '30')

// Trần cho MỖI NHÓM (chưa thanh toán / nháp) trong một lần chạy: net.http_post chờ
// tối đa 30s, mỗi thiệp là 2 lượt gọi (storage + delete). Còn dư thì hôm sau dọn
// tiếp, không việc gì phải vét sạch trong một lượt.
const MAX_PER_RUN = 100

const BUCKET = 'wedding-images'

// Đúng bộ cột ảnh mà DELETE ở wedding-admin dọn — thêm cột ảnh mới thì sửa cả hai.
const IMAGE_COLUMNS = [
  'cover_image_url',
  'groom_image_url',
  'bride_image_url',
  'groom_qr_url',
  'bride_qr_url',
]

const SELECT_COLUMNS =
  `id, slug, groom_name, bride_name, is_published, payment_status, expires_at, updated_at, gallery_images, ` +
  IMAGE_COLUMNS.join(', ')

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length || a.length === 0) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

// URL đầy đủ (ảnh dán từ nơi khác) không phải file của mình → không xoá.
function fileNames(w: Record<string, unknown>): string[] {
  const all = [
    ...IMAGE_COLUMNS.map((c) => w[c]),
    ...((w.gallery_images as string[] | null) ?? []),
  ]
  return all.filter(
    (v): v is string => typeof v === 'string' && v !== '' && !/^https?:\/\//i.test(v),
  )
}

Deno.serve(withAxiom('cleanup-weddings', async (req, log) => {
  const token = req.headers.get('x-admin-token')
  if (!timingSafeEqual(token ?? '', Deno.env.get('ADMIN_SECRET_TOKEN') ?? '')) {
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

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const cutoff = new Date(Date.now() - days * 86400000).toISOString()

  // (1) Đã xuất bản nhưng chưa thanh toán, quá hạn dùng thử thêm `days` ngày nữa.
  // Hai điều kiện sau là CHỐT AN TOÀN, thiếu một cái là xoá nhầm thiệp đã kích
  // hoạt vĩnh viễn: phải còn expires_at (null = đã thanh toán) và payment_status
  // khác 'completed'. Phải hỏi cả `is.null` vì neq bỏ qua hàng NULL.
  const { data: unpaid, error: unpaidErr } = await supabase
    .from('weddings')
    .select(SELECT_COLUMNS)
    .eq('is_published', true)
    .or('payment_status.is.null,payment_status.neq.completed')
    .not('expires_at', 'is', null)
    .lt('expires_at', cutoff)
    .limit(MAX_PER_RUN)

  // (2) Nháp không đụng tới quá `days` ngày. updated_at do trigger ở RC1.10 đặt.
  const { data: drafts, error: draftErr } = await supabase
    .from('weddings')
    .select(SELECT_COLUMNS)
    .eq('is_published', false)
    .lt('updated_at', cutoff)
    .limit(MAX_PER_RUN)

  if (unpaidErr || draftErr) {
    log.error('cleanup.query_failed', {
      unpaid: unpaidErr?.message,
      draft: draftErr?.message,
    })
    return new Response(JSON.stringify({ error: unpaidErr ?? draftErr }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const victims = [
    ...(unpaid ?? []).map((w) => ({ row: w, reason: 'unpaid' as const })),
    ...(drafts ?? []).map((w) => ({ row: w, reason: 'draft' as const })),
  ]

  log.info('cleanup.run', {
    days,
    dry_run: dryRun,
    unpaid: unpaid?.length ?? 0,
    drafts: drafts?.length ?? 0,
  })

  if (dryRun) {
    return new Response(
      JSON.stringify({
        dry_run: true,
        days,
        cutoff,
        count: victims.length,
        items: victims.map(({ row, reason }) => ({
          id: row.id,
          slug: row.slug,
          name: [row.groom_name, row.bride_name].filter(Boolean).join(' & '),
          reason,
          expires_at: row.expires_at,
          updated_at: row.updated_at,
          files: fileNames(row).length,
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
    const files = fileNames(row)
    try {
      // Xoá ảnh TRƯỚC: hàng DB là nơi duy nhất còn giữ tên file, mất nó trước là
      // ảnh nằm lại trong bucket vĩnh viễn mà không ai biết đường tìm.
      if (files.length) {
        const { error } = await supabase.storage.from(BUCKET).remove(files)
        if (error) throw new Error(`storage: ${error.message}`)
        filesRemoved += files.length
      }

      // guests cascade theo FK, không cần xoá tay.
      const { error } = await supabase.from('weddings').delete().eq('id', row.id)
      if (error) throw new Error(error.message)

      if (reason === 'unpaid') deletedUnpaid++
      else deletedDraft++
      log.info('cleanup.deleted', { id: row.id, slug: row.slug, reason, files: files.length })
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      errors.push({ id: String(row.id), error: message })
      log.error('cleanup.failed', { id: row.id, reason, error: message })
    }
  }

  return new Response(
    JSON.stringify({
      days,
      cutoff,
      deleted_unpaid: deletedUnpaid,
      deleted_draft: deletedDraft,
      files_removed: filesRemoved,
      errors,
    }),
    { headers: { 'Content-Type': 'application/json' } },
  )
}))
