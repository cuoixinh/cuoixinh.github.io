// Mốc "đám cưới đã diễn ra" — nguồn sự thật DUY NHẤT phía server (guest-handler, wedding-admin).
// Mốc = hết ngày (giờ VN) của ngày muộn nhất trong WEDDING_DATE_COLUMNS. Qua mốc là chốt CÙNG
// LÚC: khách hết gửi lời chúc/RSVP, chủ thiệp hết sửa thiệp + khách mời (trừ admin), mọi gói.
// Bản sao cho giao diện: cxWeddingEnded ở core/bl/wedding-bl.js — đổi luật phải đổi cả hai.

export const WEDDING_DATE_COLUMNS = ['ceremony_date', 'vu_quy_date', 'groom_party_date', 'bride_party_date'] as const
export const WEDDING_DATE_SELECT = WEDDING_DATE_COLUMNS.join(', ')

// Trần ngày cưới khi đặt/dời — không có trần thì đặt năm 2099 là sửa thiệp mãi. Bản sao ở
// CONFIG.maxWeddingMonthsAhead (bảng chọn ngày làm mờ ngày quá trần), đổi phải đổi cả hai.
export const MAX_DATE_AHEAD_MONTHS = 6

export const WEDDING_ENDED = 'WEDDING_ENDED'

const DAY_MS = 24 * 60 * 60 * 1000
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})/

type DateRow = Partial<Record<(typeof WEDDING_DATE_COLUMNS)[number], unknown>>

/** Hết ngày `YYYY-MM-DD` theo giờ Việt Nam (UTC+7), ms; ngày hỏng → null. */
function endOfDayVN(v: unknown): number | null {
  const m = DATE_RE.exec(String(v ?? ''))
  if (!m) return null
  const t = Date.UTC(+m[1], +m[2] - 1, +m[3] + 1) - 7 * 60 * 60 * 1000
  return Number.isFinite(t) ? t : null
}

/** Mốc kết thúc (ms); thiệp không có ngày nào → null = không bao giờ khoá. */
export function weddingEndAt(row: DateRow): number | null {
  let end: number | null = null
  for (const k of WEDDING_DATE_COLUMNS) {
    const t = endOfDayVN(row[k])
    if (t != null && (end == null || t > end)) end = t
  }
  return end
}

/** Khách mời hết được gửi lời chúc / xác nhận tham dự. */
export function isWeddingEnded(row: DateRow, now = Date.now()): boolean {
  const end = weddingEndAt(row)
  return end != null && now >= end
}

/**
 * Chủ thiệp (và thành viên) hết được sửa thiệp + khách mời. Chỉ xét thiệp ĐÃ XUẤT BẢN:
 * nháp mang ngày cũ (gõ nhầm năm, bản thử) vẫn phải sửa lại được.
 */
export function isOwnerLocked(row: DateRow & { is_published?: unknown }, now = Date.now()): boolean {
  return row.is_published === true && isWeddingEnded(row, now)
}

/**
 * Cột ngày nào bị ĐẶT MỚI xa quá MAX_DATE_AHEAD_MONTHS; null = hợp lệ. Chỉ xét giá trị
 * khác bản đang lưu: thiệp cũ đã mang ngày xa vẫn lưu được các thay đổi khác.
 */
export function dateTooFar(fields: DateRow, existing: DateRow, now = new Date()): string | null {
  const limit = new Date(now)
  limit.setUTCMonth(limit.getUTCMonth() + MAX_DATE_AHEAD_MONTHS)
  for (const k of WEDDING_DATE_COLUMNS) {
    const v = fields[k]
    if (v == null || v === '' || String(v) === String(existing[k] ?? '')) continue
    const t = endOfDayVN(v)
    if (t != null && t - DAY_MS > limit.getTime()) return k
  }
  return null
}
