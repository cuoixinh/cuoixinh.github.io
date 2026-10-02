// resource=cleanup — tab "Dọn dữ liệu" của admin: thiệp quá hạn và sổ giữ slug hết hạn
// (khi cron hỏng), ảnh rác trong bucket, tham chiếu ảnh hỏng, báo cáo bảng tiền mồ côi.
// GET = quét (không ghi gì), POST = xoá/sửa. POST luôn QUÉT LẠI ở server rồi chỉ đụng
// phần giao với danh sách client gửi — giữa lúc xem và lúc bấm, khách có thể vừa lưu.
// Mọi truy vấn phục vụ phép kiểm hỏng là DỪNG: coi tham chiếu rỗng là xoá cả bucket.

import type { Logger } from '../_shared/axiom.ts'
import {
  IMAGE_COLUMNS,
  WEDDING_IMAGE_SELECT,
  folderOf,
  listFolder,
  removePaths,
  storagePathFromRef,
  weddingFileNames,
  type StorageFile,
} from '../_shared/wedding-images.ts'
import {
  findExpiredWeddings,
  deleteWeddingHard,
  findExpiredSlugHolds,
  deleteExpiredSlugHolds,
} from '../_shared/wedding-cleanup.ts'
import { slugHoldCutoff, SLUG_HOLD_DAYS } from '../_shared/slug-holds.ts'

// deno-lint-ignore no-explicit-any
type Db = any
type Row = Record<string, unknown>

const DEFAULT_DAYS = Number(Deno.env.get('RETENTION_DAYS') ?? '30')
const DEFAULT_GRACE_H = 48
// Trần mỗi lượt POST xoá thiệp — client tự chia lô, để request không chạm giới hạn thời gian.
const MAX_DELETE_WEDDINGS = 30
// Trần mỗi lượt POST xoá hàng sổ giữ slug — danh sách slug đi vào URL của PostgREST.
const MAX_DELETE_SLUG_HOLDS = 100
const LIST_CONCURRENCY = 8

class ScanError extends Error {}

export async function handleCleanup(
  req: Request,
  url: URL,
  supabase: Db,
  log: Logger,
  corsHeaders: Record<string, string>,
): Promise<Response> {
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  const kind = url.searchParams.get('kind') || ''
  const method = req.method
  const body: Row = method === 'POST' ? await req.json().catch(() => ({})) : {}

  try {
    if (kind === 'weddings') {
      const days = Number(body.days ?? url.searchParams.get('days') ?? DEFAULT_DAYS)
      if (!Number.isFinite(days) || days < 1) return json({ error: 'days không hợp lệ' }, 400)
      return method === 'POST'
        ? json(await deleteExpired(supabase, log, days, body.ids))
        : json(await scanExpired(supabase, log, days))
    }

    if (kind === 'slug-holds') {
      return method === 'POST'
        ? json(await deleteSlugHolds(supabase, log, body.slugs))
        : json(await scanSlugHolds(supabase, log))
    }

    if (kind === 'images') {
      const graceH = Number(body.grace_h ?? url.searchParams.get('grace_h') ?? DEFAULT_GRACE_H)
      if (!Number.isFinite(graceH) || graceH < 1) return json({ error: 'grace_h phải ≥ 1 giờ' }, 400)
      const scan = await scanImages(supabase, log, graceH)
      if (method !== 'POST') return json(scan)
      return json(await deleteImages(supabase, log, scan, body.names))
    }

    if (kind === 'broken') {
      const scan = await scanBroken(supabase, log)
      if (method !== 'POST') return json({ items: scan.items })
      return json(await fixBroken(supabase, log, scan.items, body.ids))
    }

    if (kind === 'tables' && method === 'GET') {
      return json(await scanTables(supabase, log))
    }

    return json({ error: 'kind không hợp lệ' }, 400)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    // ScanError đã log tại chỗ, kèm tên truy vấn hỏng.
    if (!(e instanceof ScanError)) log.error('cleanup.admin_failed', { kind, method, message })
    return json({ error: message }, 500)
  }
}

/* ─────────────────────── sổ giữ slug hết hạn ─────────────────────── */
// Luật + phép xoá ở _shared/wedding-cleanup.ts, đúng hàm cron cleanup-weddings gọi.

async function scanSlugHolds(supabase: Db, log: Logger) {
  const { cutoff, holds, error } = await findExpiredSlugHolds(supabase, { limit: 500 })
  if (error) {
    log.error('cleanup.admin_query_failed', { kind: 'slug-holds', error })
    throw new ScanError(error)
  }
  // Số hàng còn đang giữ — chỉ để hiển thị, hỏng thì null.
  const { count, error: countErr } = await supabase
    .from('wedding_slug_holds')
    .select('slug', { count: 'exact', head: true })
    .gte('deleted_at', slugHoldCutoff())
  if (countErr) log.warn('cleanup.admin_slug_hold_count_failed', { code: countErr.code, message: countErr.message })
  log.info('cleanup.admin_scan', { kind: 'slug-holds', count: holds.length })
  return { hold_days: SLUG_HOLD_DAYS, cutoff, active: countErr ? null : count, items: holds }
}

async function deleteSlugHolds(supabase: Db, log: Logger, rawSlugs: unknown) {
  const slugs = Array.isArray(rawSlugs) ? [...new Set(rawSlugs.map(String))] : []
  if (!slugs.length) return { deleted: [], skipped: [] }
  if (slugs.length > MAX_DELETE_SLUG_HOLDS) {
    throw new Error(`Tối đa ${MAX_DELETE_SLUG_HOLDS} hàng mỗi lượt`)
  }
  const { deleted, error } = await deleteExpiredSlugHolds(supabase, slugs)
  if (error) {
    log.error('cleanup.admin_slug_holds_failed', { error })
    throw new ScanError(error)
  }
  log.info('cleanup.admin_slug_holds_deleted', { count: deleted.length })
  const gone = new Set(deleted)
  return { deleted, skipped: slugs.filter((s) => !gone.has(s)) }
}

/* ─────────────────────────── thiệp quá hạn ─────────────────────────── */

async function scanExpired(supabase: Db, log: Logger, days: number) {
  const { cutoff, victims, error } = await findExpiredWeddings(supabase, days, { limit: 500 })
  if (error) {
    log.error('cleanup.admin_query_failed', { kind: 'weddings', error })
    throw new ScanError(error)
  }
  const ids = victims.map((v) => String(v.row.id))
  const guests = await countGuests(supabase, log, ids)
  log.info('cleanup.admin_scan', { kind: 'weddings', days, count: victims.length })
  return {
    days,
    cutoff,
    items: victims.map(({ row, reason }) => ({
      id: row.id,
      slug: row.slug,
      name: [row.groom_name, row.bride_name].filter(Boolean).join(' & '),
      reason,
      payment_status: row.payment_status,
      expires_at: row.expires_at,
      updated_at: row.updated_at,
      files: weddingFileNames(row).length,
      guests: guests?.get(String(row.id)) ?? null,
    })),
  }
}

// Chỉ để hiển thị: hỏng thì trả null (bảng hiện "?"), không chặn việc quét.
async function countGuests(supabase: Db, log: Logger, ids: string[]) {
  if (!ids.length) return new Map<string, number>()
  const { data, error } = await supabase
    .from('guests')
    .select('wedding_id')
    .in('wedding_id', ids)
    .limit(20000)
  if (error) {
    log.warn('cleanup.admin_guest_count_failed', { code: error.code, message: error.message })
    return null
  }
  const out = new Map<string, number>()
  for (const g of data ?? []) out.set(g.wedding_id, (out.get(g.wedding_id) ?? 0) + 1)
  return out
}

async function deleteExpired(supabase: Db, log: Logger, days: number, rawIds: unknown) {
  const ids = Array.isArray(rawIds) ? [...new Set(rawIds.map(String))] : []
  if (!ids.length) return { deleted: [], skipped: [], errors: [] }
  if (ids.length > MAX_DELETE_WEDDINGS) {
    throw new Error(`Tối đa ${MAX_DELETE_WEDDINGS} thiệp mỗi lượt`)
  }
  // Kiểm lại ĐÚNG luật quá hạn — id client gửi mà không còn khớp (vừa thanh toán,
  // vừa lưu) thì bỏ qua chứ không xoá.
  const { victims, error } = await findExpiredWeddings(supabase, days, { limit: ids.length, ids })
  if (error) {
    log.error('cleanup.admin_query_failed', { kind: 'weddings', error })
    throw new ScanError(error)
  }
  const deleted: string[] = []
  const errors: Array<{ id: string; error: string }> = []
  let files = 0
  for (const { row, reason } of victims) {
    try {
      files += await deleteWeddingHard(supabase, row)
      deleted.push(String(row.id))
      log.info('cleanup.admin_deleted', { id: row.id, slug: row.slug, reason })
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      errors.push({ id: String(row.id), error: message })
      log.error('cleanup.admin_delete_failed', { id: row.id, reason, error: message })
    }
  }
  const matched = new Set(victims.map((v) => String(v.row.id)))
  return { deleted, files, skipped: ids.filter((id) => !matched.has(id)), errors }
}

/* ─────────────────────────── quét bucket ─────────────────────────── */

// Mọi hàng weddings (theo lô 1000). Hỏng giữa chừng là DỪNG.
async function loadAllWeddings(supabase: Db, log: Logger, columns: string): Promise<Row[]> {
  const out: Row[] = []
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('weddings')
      .select(columns)
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) {
      log.error('cleanup.admin_query_failed', { table: 'weddings', code: error.code, message: error.message })
      throw new ScanError('Không đọc được bảng weddings: ' + error.message)
    }
    out.push(...(data ?? []))
    if (!data || data.length < PAGE) return out
  }
}

// Toàn bộ file trong bucket, đi hết cây thư mục (mỗi thiệp một thư mục con của w/).
async function walkBucket(supabase: Db, log: Logger): Promise<StorageFile[]> {
  const files: StorageFile[] = []
  let queue = ['']
  while (queue.length) {
    const next: string[] = []
    for (let i = 0; i < queue.length; i += LIST_CONCURRENCY) {
      const results = await Promise.all(
        queue.slice(i, i + LIST_CONCURRENCY).map((dir) => listFolder(supabase, dir)),
      )
      for (const r of results) {
        if (r.error) {
          log.error('cleanup.admin_storage_list_failed', { message: r.error })
          throw new ScanError('Không liệt kê được bucket: ' + r.error)
        }
        files.push(...r.files)
        next.push(...r.folders)
      }
    }
    queue = next
  }
  return files
}

// Đường dẫn mà bảng templates trỏ vào bucket (ảnh bìa mẫu) — tính là "đang dùng" cho chắc.
async function templateRefs(supabase: Db, log: Logger): Promise<Set<string>> {
  const { data, error } = await supabase.from('templates').select('thumbnail_url, preview_url')
  if (error) {
    log.error('cleanup.admin_query_failed', { table: 'templates', code: error.code, message: error.message })
    throw new ScanError('Không đọc được bảng templates: ' + error.message)
  }
  const out = new Set<string>()
  for (const t of data ?? []) {
    for (const v of [t.thumbnail_url, t.preview_url]) {
      const p = storagePathFromRef(v)
      if (p) out.add(p)
    }
  }
  return out
}

type ImageKind = 'orphan_folder' | 'unused' | 'legacy'

interface ImageScan {
  grace_h: number
  scanned: number
  too_new: number
  total_size: number
  items: Array<StorageFile & { kind: ImageKind; slug?: string }>
}

// Ảnh rác = file không hàng nào trỏ tới và cũ hơn `graceH` giờ (file mới upload mà
// khách chưa kịp lưu thiệp cũng không có hàng nào trỏ tới). Ba loại:
//   orphan_folder — thư mục w/<key>/ của thiệp đã không còn;
//   unused        — trong thư mục của thiệp còn sống nhưng hàng không trỏ tới (ảnh bị thay);
//   legacy        — file phẳng / thư mục lạ ngoài w/, không ai trỏ tới.
async function scanImages(supabase: Db, log: Logger, graceH: number): Promise<ImageScan> {
  const [weddings, tpl, files] = await Promise.all([
    loadAllWeddings(supabase, log, `id, slug, ${WEDDING_IMAGE_SELECT}`),
    templateRefs(supabase, log),
    walkBucket(supabase, log),
  ])

  const used = new Set(tpl)
  const byFolder = new Map<string, Row>()
  for (const w of weddings) {
    for (const p of weddingFileNames(w)) used.add(p)
    const folder = folderOf(w.storage_key)
    if (folder) byFolder.set(folder, w)
  }

  const limit = Date.now() - graceH * 3600000
  const items: ImageScan['items'] = []
  let tooNew = 0
  let totalSize = 0
  for (const f of files) {
    if (used.has(f.name)) continue
    const t = f.created_at ? Date.parse(f.created_at) : NaN
    // Không đọc được ngày tạo thì coi như MỚI — không xoá thứ không biết tuổi.
    if (!(t < limit)) {
      tooNew++
      continue
    }
    const m = /^(w\/[0-9a-f]{32}\/)/.exec(f.name)
    const owner = m ? byFolder.get(m[1]) : undefined
    const kind: ImageKind = m ? (owner ? 'unused' : 'orphan_folder') : 'legacy'
    items.push({ ...f, kind, slug: owner ? String(owner.slug) : undefined })
    totalSize += f.size
  }
  log.info('cleanup.admin_scan', { kind: 'images', scanned: files.length, junk: items.length, too_new: tooNew })
  return { grace_h: graceH, scanned: files.length, too_new: tooNew, total_size: totalSize, items }
}

async function deleteImages(supabase: Db, log: Logger, scan: ImageScan, rawNames: unknown) {
  const wanted = new Set(Array.isArray(rawNames) ? rawNames.map(String) : [])
  const paths = scan.items.filter((it) => wanted.has(it.name)).map((it) => it.name)
  const rm = await removePaths(supabase, paths)
  if (rm.error) {
    log.error('cleanup.images_failed', { removed: rm.removed, total: paths.length, message: rm.error })
    throw new ScanError(`Đã xoá ${rm.removed}/${paths.length} ảnh rồi lỗi: ${rm.error}`)
  }
  log.info('cleanup.images_removed', { removed: rm.removed })
  return { removed: rm.removed, skipped: wanted.size - paths.length }
}

/* ─────────────────────── tham chiếu ảnh hỏng ─────────────────────── */

interface BrokenItem {
  id: string
  slug: string
  name: string
  refs: Array<{ field: string; ref: string }>
}

// Hàng trỏ tới file KHÔNG còn trong bucket (ảnh vỡ trên thiệp). URL ngoài hệ thống
// không xét — không biết được nó còn hay mất.
async function scanBroken(supabase: Db, log: Logger) {
  const [weddings, files] = await Promise.all([
    loadAllWeddings(supabase, log, `id, slug, groom_name, bride_name, ${WEDDING_IMAGE_SELECT}`),
    walkBucket(supabase, log),
  ])
  const exists = new Set(files.map((f) => f.name))
  const missing = (v: unknown) => {
    const p = storagePathFromRef(v)
    return !!p && !exists.has(p)
  }

  const items: BrokenItem[] = []
  for (const w of weddings) {
    const refs: BrokenItem['refs'] = []
    for (const c of IMAGE_COLUMNS) if (missing(w[c])) refs.push({ field: c, ref: String(w[c]) })
    for (const g of (w.gallery_images as unknown[] | null) ?? []) {
      if (missing(g)) refs.push({ field: 'gallery_images', ref: String(g) })
    }
    const story = parseStory(w.love_story)
    story.forEach((it, i) => {
      if (missing(it?.image_url)) refs.push({ field: `love_story[${i}]`, ref: String(it.image_url) })
    })
    if (refs.length) {
      items.push({
        id: String(w.id),
        slug: String(w.slug),
        name: [w.groom_name, w.bride_name].filter(Boolean).join(' & '),
        refs,
      })
    }
  }
  log.info('cleanup.admin_scan', { kind: 'broken', weddings: weddings.length, broken: items.length })
  return { items }
}

function parseStory(v: unknown): Row[] {
  let arr = v
  if (typeof arr === 'string') {
    try {
      arr = JSON.parse(arr)
    } catch {
      return []
    }
  }
  return Array.isArray(arr) ? arr.map((it) => (it && typeof it === 'object' ? it : {})) : []
}

// Trong các đường dẫn cho trước, cái nào THẬT SỰ không có trong bucket — liệt kê lại
// đúng thư mục chứa chúng, ngay lúc này.
async function confirmMissing(supabase: Db, log: Logger, paths: string[]): Promise<Set<string>> {
  const byDir = new Map<string, string[]>()
  for (const p of paths) {
    const dir = p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : ''
    byDir.set(dir, [...(byDir.get(dir) ?? []), p])
  }
  const out = new Set<string>()
  for (const [dir, list] of byDir) {
    const r = await listFolder(supabase, dir)
    if (r.error) {
      log.error('cleanup.admin_storage_list_failed', { dir, message: r.error })
      throw new ScanError('Không liệt kê được bucket: ' + r.error)
    }
    const have = new Set(r.files.map((f) => f.name))
    for (const p of list) if (!have.has(p)) out.add(p)
  }
  return out
}

// Gỡ tham chiếu hỏng: cột ảnh đơn → null, rút khỏi album (kèm điểm lấy nét), mốc
// chuyện tình giữ nguyên chỉ bỏ ảnh. Đọc lại hàng và liệt kê lại thư mục SAU đó:
// file khách vừa upload + lưu trong lúc quét phải được thấy là còn. Ghi hàng là
// trigger đóng dấu lại updated_at (mốc dọn nháp tính lại từ hôm nay).
async function fixBroken(supabase: Db, log: Logger, items: BrokenItem[], rawIds: unknown) {
  const wanted = new Set(Array.isArray(rawIds) ? rawIds.map(String) : [])
  const targets = items.filter((it) => wanted.has(it.id))

  const fixed: string[] = []
  const errors: Array<{ id: string; error: string }> = []
  for (const t of targets) {
    const { data: w, error: readErr } = await supabase
      .from('weddings')
      .select(`id, ${WEDDING_IMAGE_SELECT}, image_focal_points`)
      .eq('id', t.id)
      .maybeSingle()
    if (readErr || !w) {
      const message = readErr?.message ?? 'không còn hàng'
      errors.push({ id: t.id, error: message })
      log.error('cleanup.broken_read_failed', { id: t.id, message })
      continue
    }

    const gone = await confirmMissing(supabase, log, weddingFileNames(w))
    const missing = (v: unknown) => {
      const p = storagePathFromRef(v)
      return !!p && gone.has(p)
    }

    const patch: Row = {}
    for (const c of IMAGE_COLUMNS) if (missing(w[c])) patch[c] = null
    const gallery = (w.gallery_images as string[] | null) ?? []
    const keep = gallery.filter((g) => !missing(g))
    if (keep.length !== gallery.length) {
      patch.gallery_images = keep
      const focal = w.image_focal_points as Row | null
      const gf = focal?.gallery_images as Row | undefined
      if (focal && gf) {
        const nextGf: Row = {}
        for (const k of Object.keys(gf)) if (keep.includes(k)) nextGf[k] = gf[k]
        patch.image_focal_points = { ...focal, gallery_images: nextGf }
      }
    }
    const story = parseStory(w.love_story)
    if (story.some((it) => missing(it.image_url))) {
      patch.love_story = story.map((it) => (missing(it.image_url) ? { ...it, image_url: null } : it))
    }
    if (!Object.keys(patch).length) continue

    const { error } = await supabase.from('weddings').update(patch).eq('id', t.id)
    if (error) {
      errors.push({ id: t.id, error: error.message })
      log.error('cleanup.broken_fix_failed', { id: t.id, code: error.code, message: error.message })
      continue
    }
    fixed.push(t.id)
    log.info('cleanup.broken_fixed', { id: t.id, slug: t.slug, fields: Object.keys(patch) })
  }
  return { fixed, errors }
}

/* ─────────────────────── bảng tiền (chỉ báo cáo) ─────────────────────── */

// Lịch sử tiền bạc CỐ Ý không cascade theo thiệp (docs/cleanup-retention.md §10) —
// ở đây chỉ đếm để biết, không có đường xoá.
async function scanTables(supabase: Db, log: Logger) {
  const weddings = await loadAllWeddings(supabase, log, 'id, slug')
  const ids = new Set(weddings.map((w) => String(w.id)))
  const slugs = new Set(weddings.map((w) => String(w.slug)))

  const all = async (table: string, columns: string): Promise<Row[]> => {
    const out: Row[] = []
    const PAGE = 1000
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from(table)
        .select(columns)
        .order('id', { ascending: true })
        .range(from, from + PAGE - 1)
      if (error) {
        log.error('cleanup.admin_query_failed', { table, code: error.code, message: error.message })
        throw new ScanError(`Không đọc được bảng ${table}: ${error.message}`)
      }
      out.push(...(data ?? []))
      if (!data || data.length < PAGE) return out
    }
  }

  const [logs, redemptions, orders] = await Promise.all([
    all('payment_logs', 'id, manage_id, order_id, event_type, created_at'),
    all('promo_redemptions', 'id, manage_id, order_id, code, status, expires_at'),
    all('orders', 'id, slug, status, created_at'),
  ])

  const now = Date.now()
  const orphanLogs = logs.filter((r) => r.manage_id && !ids.has(String(r.manage_id)))
  const orphanRed = redemptions.filter((r) => r.manage_id && !ids.has(String(r.manage_id)))
  const staleReserved = redemptions.filter(
    (r) => r.status === 'reserved' && r.expires_at && Date.parse(String(r.expires_at)) < now,
  )
  const orphanOrders = orders.filter((r) => r.slug && !slugs.has(String(r.slug)))
  const sample = (rows: Row[]) => rows.slice(0, 20)

  return {
    weddings: weddings.length,
    payment_logs: { total: logs.length, orphan: orphanLogs.length, sample: sample(orphanLogs) },
    promo_redemptions: {
      total: redemptions.length,
      orphan: orphanRed.length,
      stale_reserved: staleReserved.length,
      sample: sample(orphanRed),
    },
    orders: { total: orders.length, orphan: orphanOrders.length, sample: sample(orphanOrders) },
  }
}
