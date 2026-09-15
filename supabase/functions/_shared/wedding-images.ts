// Gom tên file Storage mà một hàng `weddings` đang giữ. Nguồn sự thật DUY NHẤT
// cho mọi luồng đụng tới ảnh: DELETE ở wedding-admin, cron cleanup-weddings, và
// phép kiểm `deleted_images` — thêm cột ảnh mới chỉ phải sửa ở đây.

const IMAGE_COLUMNS = [
  'cover_image_url',
  'groom_image_url',
  'bride_image_url',
  'groom_qr_url',
  'bride_qr_url',
] as const

// Bộ cột phải `select` thì hai hàm dưới mới nhìn thấy đủ ảnh.
export const WEDDING_IMAGE_SELECT =
  `${IMAGE_COLUMNS.join(', ')}, gallery_images, love_story`

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

/**
 * Tên file trong bucket, dùng cho `storage.remove()`.
 * URL đầy đủ (ảnh dán từ nơi khác) không phải file của mình → bỏ qua.
 */
export function weddingFileNames(w: Record<string, unknown>): string[] {
  return [...new Set(weddingImageRefs(w).filter((v) => !/^https?:\/\//i.test(v)))]
}
