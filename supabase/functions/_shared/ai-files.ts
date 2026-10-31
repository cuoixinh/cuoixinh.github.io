// Tệp người dùng đính kèm gửi model đọc — dùng chung cho ai-invitation (mode=guests) và
// ai-chat. Body mang `files:[{mime, data base64, name}]` (ảnh đã nén ở trình duyệt, PDF)
// + `docs:[{name, type, text}]` (chữ trích từ Word/Excel/.txt). Bản sao luật ở
// CONFIG.aiFiles (core/config.js) — đổi một bên phải đổi cả bên kia.

import type { GeminiPart } from './ai-provider.ts'

export const AI_FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
const DOC_TYPES = ['Word', 'Excel', '.txt', 'CSV']
// Tối đa MAX_FILES tệp một lượt (tính chung files + docs), mỗi tệp ~4MB, tổng ~8MB
// (tính theo độ dài base64).
export const MAX_FILES = 5
const MAX_FILE_B64 = 5_600_000
const MAX_FILES_B64 = 11_200_000
// Tổng ký tự chữ trích từ docs.
export const MAX_DOCS_CHARS = 20000
// PDF tốn token theo SỐ TRANG — một file 4MB có thể vài trăm trang, đủ đốt quota Gemini
// của mọi tính năng AI. Đếm thô được thì giới hạn tổng trang; không đếm được (PDF nén
// object stream) thì chỉ nhận file nhỏ.
const MAX_PDF_PAGES = 10
const MAX_PDF_UNKNOWN_B64 = 2_800_000
// Trần body đọc vào khi request có thể mang tệp (kiểm Content-Length TRƯỚC khi parse).
export const MAX_BODY_FILES = 12_000_000

export type AiFile = { mime: string; data: string; name: string }
export type AiDoc = { name: string; type: string; text: string }

// Nhận diện tệp theo vài byte đầu — không tin trường mime client gửi.
function fileMagicOk(mime: string, b64: string): boolean {
  if (mime === 'image/jpeg') return b64.startsWith('/9j/')
  if (mime === 'image/png') return b64.startsWith('iVBORw0KGgo')
  if (mime === 'application/pdf') return b64.startsWith('JVBERi0')
  if (mime === 'image/webp') {
    try { return atob(b64.slice(0, 16)).slice(8, 12) === 'WEBP' } catch { return false }
  }
  return false
}

// Số trang PDF đếm thô (không giải nén) từ đối tượng /Type /Page. 0 = không đếm được.
function pdfPageCount(b64: string): number {
  try {
    return (atob(b64).match(/\/Type\s*\/Page(?![A-Za-z])/g) ?? []).length
  } catch {
    return 0
  }
}

// Tên tệp/sheet nằm trong prompt: một dòng, bỏ ngoặc kép để không phá khối trích.
export const aiFileName = (v: unknown) =>
  String(v ?? '').replace(/[\r\n"“”]+/g, ' ').trim().slice(0, 120) || 'không tên'

// Kiểm `body.files` + `body.docs`. Sai thì trả { error } (câu 400 cho người dùng).
export function readAttachments(
  body: Record<string, unknown>,
): { files: AiFile[]; docs: AiDoc[] } | { error: string } {
  if ((body.files !== undefined && !Array.isArray(body.files)) || (body.docs !== undefined && !Array.isArray(body.docs))) {
    return { error: 'Danh sách tệp không hợp lệ' }
  }
  const rawFiles = (body.files ?? []) as { mime?: unknown; data?: unknown; name?: unknown }[]
  const rawDocs = (body.docs ?? []) as { name?: unknown; type?: unknown; text?: unknown }[]
  if (rawFiles.length + rawDocs.length > MAX_FILES) return { error: `Mỗi lượt tối đa ${MAX_FILES} tệp` }

  const docs: AiDoc[] = []
  let docChars = 0
  for (const d of rawDocs) {
    const t = String(d?.text ?? '').trim()
    if (!t) return { error: 'Có tệp không có chữ nào' }
    docChars += t.length
    if (docChars > MAX_DOCS_CHARS) {
      return { error: `Nội dung các tệp Word/Excel/.txt dài quá ${MAX_DOCS_CHARS} ký tự, hãy chia làm nhiều lần` }
    }
    const type = String(d?.type ?? '')
    docs.push({ name: aiFileName(d?.name), type: DOC_TYPES.includes(type) ? type : 'Văn bản', text: t })
  }

  const files: AiFile[] = []
  let total = 0
  let pages = 0
  for (const f of rawFiles) {
    const mime = String(f?.mime ?? '')
    const data = String(f?.data ?? '')
    if (!AI_FILE_TYPES.includes(mime)) return { error: 'Chỉ đọc được ảnh (JPG, PNG, WebP) hoặc PDF' }
    total += data.length
    if (!data || data.length > MAX_FILE_B64 || !/^[A-Za-z0-9+/]+={0,2}$/.test(data)) {
      return { error: 'Có tệp quá lớn hoặc hỏng, mỗi tệp phải nhỏ hơn 4MB' }
    }
    if (total > MAX_FILES_B64) return { error: 'Tổng dung lượng tệp vượt 8MB, hãy bớt tệp rồi thử lại' }
    if (!fileMagicOk(mime, data)) return { error: 'Có tệp không đúng định dạng ảnh/PDF' }
    if (mime === 'application/pdf') {
      const n = pdfPageCount(data)
      if (!n && data.length > MAX_PDF_UNKNOWN_B64) {
        return { error: 'Không đếm được số trang của PDF lớn này, hãy xuất lại PDF hoặc chụp ảnh nội dung' }
      }
      pages += n || 1
      if (pages > MAX_PDF_PAGES) return { error: `PDF tối đa ${MAX_PDF_PAGES} trang mỗi lượt, hãy tách bớt trang` }
    }
    files.push({ mime, data, name: aiFileName(f?.name) })
  }
  return { files, docs }
}

// Ảnh/PDF → part cho model, mỗi tệp một dòng "Tệp N: …" đứng trước (đánh số 1..n).
export function fileParts(files: AiFile[]): GeminiPart[] {
  return files.flatMap((f, i) => [
    { text: `Tệp ${i + 1}: "${f.name}" (${f.mime === 'application/pdf' ? 'PDF' : 'Ảnh'})` },
    { inlineData: { mimeType: f.mime, data: f.data } },
  ])
}

// Chữ trích từ docs, đánh số TIẾP sau `from` tệp ảnh/PDF, mỗi tệp một khối có rào.
export function docsBlock(docs: AiDoc[], from: number): string {
  return docs.map((d, i) => {
    const no = from + i + 1
    return `=== Tệp ${no}: "${d.name}" (${d.type}) ===\n${d.text}\n=== Hết tệp ${no} ===`
  }).join('\n\n')
}
