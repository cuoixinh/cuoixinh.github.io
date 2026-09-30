// Ảnh của thiệp trong bucket `wedding-images`. Nguồn sự thật DUY NHẤT cho mọi luồng
// đụng tới ảnh: PATCH/DELETE ở wedding-admin, cron cleanup-weddings, tab Dọn dữ liệu.
// Mỗi thiệp một thư mục `w/<storage_key>/`; file phẳng ở gốc bucket là dữ liệu cũ.
// Thêm cột ảnh mới chỉ phải sửa IMAGE_COLUMNS ở đây.

// deno-lint-ignore no-explicit-any
type Db = any

export const BUCKET = 'wedding-images'

export const IMAGE_COLUMNS = [
  'cover_image_url',
  'groom_image_url',
  'bride_image_url',
  'groom_qr_url',
  'bride_qr_url',
] as const

// Bộ cột phải `select` thì các hàm dưới mới nhìn thấy đủ ảnh + thư mục của thiệp.
export const WEDDING_IMAGE_SELECT =
  `storage_key, ${IMAGE_COLUMNS.join(', ')}, gallery_images, love_story`

// Host được phép xuất hiện trong URL ảnh đầy đủ. Cùng mã chạy cho CẢ HAI project nên
// phải liệt kê host của cả hai.
export const STORAGE_HOSTS = new Set([
  'lcobawmkywtxhpezndsh.supabase.co',                     // production
  'gmtnoxdwoumbtdmqmisk.supabase.co',                     // staging
  'wedding-image-proxy.cuoixinh-api.workers.dev',         // proxy production
  'wedding-image-proxy-staging.cuoixinh-api.workers.dev', // proxy staging
])

// Đường dẫn trong bucket: `w/<storage_key>/<tên>` hoặc tên phẳng (dữ liệu cũ). Là
// ALLOWLIST ký tự — giá trị này nội suy vào `src="…"` của thiệp công khai. Tên file
// không được là `.`/`..` (đi ra khỏi thư mục). Khớp image-proxy và worker og.
export const STORAGE_PATH_RE = /^(?:w\/[0-9a-f]{32}\/)?(?!\.{1,2}$)[A-Za-z0-9._-]{1,120}$/

const STORAGE_KEY_RE = /^[0-9a-f]{32}$/
const PUBLIC_PREFIX = `/storage/v1/object/public/${BUCKET}/`

export function folderOf(storageKey: unknown): string | null {
  return typeof storageKey === 'string' && STORAGE_KEY_RE.test(storageKey)
    ? `w/${storageKey}/`
    : null
}

/**
 * Giá trị ảnh (tên file hoặc URL đầy đủ trên host của mình) → đường dẫn trong bucket.
 * URL ngoài hệ thống hoặc giá trị bẩn → null.
 */
export function storagePathFromRef(ref: unknown): string | null {
  if (typeof ref !== 'string') return null
  const v = ref.trim()
  if (!v) return null
  if (!v.includes(':') && !v.startsWith('//')) return STORAGE_PATH_RE.test(v) ? v : null
  try {
    const u = new URL(v)
    if (u.protocol !== 'https:' || !STORAGE_HOSTS.has(u.hostname)) return null
    let path: string
    if (u.hostname.endsWith('.supabase.co')) {
      if (!u.pathname.startsWith(PUBLIC_PREFIX)) return null
      path = u.pathname.slice(PUBLIC_PREFIX.length)
    } else {
      path = u.pathname.slice(1)
    }
    path = decodeURIComponent(path)
    return STORAGE_PATH_RE.test(path) ? path : null
  } catch {
    return null
  }
}

// love_story là jsonb, nhưng client cũ từng ghi vào dạng chuỗi JSON.
function loveStoryImages(value: unknown): unknown[] {
  let arr: unknown = value
  if (typeof arr === 'string') {
    try {
      arr = JSON.parse(arr)
    } catch {
      return []
    }
  }
  if (!Array.isArray(arr)) return []
  return arr.map((it) =>
    it && typeof it === 'object' ? (it as Record<string, unknown>).image_url : null
  )
}

/** Mọi giá trị ảnh thô của hàng — gồm cả URL đầy đủ. */
export function weddingImageRefs(w: Record<string, unknown>): string[] {
  const all = [
    ...IMAGE_COLUMNS.map((c) => w[c]),
    ...((w.gallery_images as string[] | null) ?? []),
    ...loveStoryImages(w.love_story),
  ]
  return all.filter((v): v is string => typeof v === 'string' && v !== '')
}

/** Đường dẫn trong bucket mà hàng đang tham chiếu (URL đầy đủ của mình cũng tính). */
export function weddingFileNames(w: Record<string, unknown>): string[] {
  const out = new Set<string>()
  for (const ref of weddingImageRefs(w)) {
    const p = storagePathFromRef(ref)
    if (p) out.add(p)
  }
  return [...out]
}

export interface StorageFile {
  name: string // đường dẫn đầy đủ trong bucket
  size: number
  created_at: string | null
}

/**
 * Liệt kê file trong một thư mục (không đệ quy). `prefix` rỗng = gốc bucket.
 * Trả thêm tên các thư mục con. Lỗi thì trả `error`, nơi gọi phải DỪNG.
 */
export async function listFolder(
  supabase: Db,
  prefix: string,
): Promise<{ files: StorageFile[]; folders: string[]; error?: string }> {
  const files: StorageFile[] = []
  const folders: string[] = []
  const dir = prefix.replace(/\/$/, '')
  const PAGE = 1000
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase.storage.from(BUCKET).list(dir, {
      limit: PAGE,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    })
    if (error) return { files, folders, error: error.message }
    for (const it of data ?? []) {
      const full = dir ? `${dir}/${it.name}` : it.name
      // Thư mục con: Storage trả id null. File giữ chỗ `.emptyFolderPlaceholder` bỏ qua.
      if (it.id == null) folders.push(full)
      else if (it.name !== '.emptyFolderPlaceholder') {
        files.push({
          name: full,
          size: Number(it.metadata?.size ?? 0),
          created_at: it.created_at ?? null,
        })
      }
    }
    if (!data || data.length < PAGE) break
  }
  return { files, folders }
}

/** Xoá theo lô 100 đường dẫn. Lỗi ở lô nào thì dừng ngay, trả số đã xoá. */
export async function removePaths(
  supabase: Db,
  paths: string[],
): Promise<{ removed: number; error?: string }> {
  let removed = 0
  for (let i = 0; i < paths.length; i += 100) {
    const batch = paths.slice(i, i + 100)
    const { error } = await supabase.storage.from(BUCKET).remove(batch)
    if (error) return { removed, error: error.message }
    removed += batch.length
  }
  return { removed }
}

/**
 * Xoá MỌI ảnh của thiệp: cả thư mục (kể cả ảnh đã bị thay/lưu hỏng mà hàng không
 * còn trỏ tới) + file phẳng cũ hàng còn tham chiếu. Gọi TRƯỚC khi xoá hàng: hàng là
 * nơi duy nhất giữ `storage_key`.
 */
export async function removeWeddingStorage(
  supabase: Db,
  w: Record<string, unknown>,
): Promise<{ removed: number; error?: string }> {
  const paths = new Set(weddingFileNames(w).filter((p) => !p.includes('/')))
  const folder = folderOf(w.storage_key)
  if (folder) {
    const { files, error } = await listFolder(supabase, folder)
    if (error) return { removed: 0, error }
    for (const f of files) paths.add(f.name)
  }
  return removePaths(supabase, [...paths])
}
