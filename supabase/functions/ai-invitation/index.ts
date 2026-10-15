// ai-invitation — các tác vụ AI lẻ cho trang thiết lập và admin (Gemini, xoay vòng
// nhiều key): mode=optimize (viết lại 1 ô văn bản), mode=love_story (tách đoạn kể
// thành các mốc), mode=sample (dựng dữ liệu demo cho mẫu thiệp), mode=guests (tách
// danh sách khách dán tự do thành từng khách — chỉ ĐỌC, ghi DB vẫn là guest-handler).
// Sinh CẢ thiệp nay là việc của ai-chat — trang thiết lập không còn popup "Tạo bằng AI".
//
// Không bắt buộc đăng nhập (trừ mode=guests — chỉ chủ thiệp mới nhập khách): cách đếm hạn mức nằm ở _shared/ai-rate-limit.ts (tiền
// tố "inv:"), đây chỉ khai hai con số. Validate + clamp cả input lẫn
// output, CORS allowlist, timeout khi gọi provider, không rò lỗi chi tiết của
// provider ra client; API key chỉ nằm trong secret.

import type { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { createDbClient } from '../_shared/db-client.ts'
import { withAxiom, type Logger } from '../_shared/axiom.ts'
// Tầng gọi model + CORS dùng chung với ai-background (xem _shared/ai-provider.ts).
import {
  corsHeaders,
  errMsg,
  GEMINI_MODEL_GUESTS,
  generateWithGemini,
  json,
  type GeminiPart,
} from '../_shared/ai-provider.ts'
import { enforceRateLimit, sanitizeDevice } from '../_shared/ai-rate-limit.ts'
// Hợp đồng dữ liệu thiệp (whitelist field, nhãn văn phong, tầng validate output)
// dùng chung với ai-chat — xem _shared/card-schema.ts.
import {
  LOVE_VOICE_RULE,
  MAX_LOVE_ITEMS,
  MAX_TEXT_LEN,
  MAX_TIMELINE,
  REGION_LABEL,
  TONE_LABEL,
  cleanBlocks,
  objectToRawBlocks,
  clampStr,
  clampText,
  pickRegion,
  pickTone,
  stripCoupleNames,
  weTermFor,
} from '../_shared/card-schema.ts'

// ── Cấu hình ────────────────────────────────────────────────────────────────

const DAILY_LIMIT      = 15      // số lần gọi AI tối đa / user đã đăng nhập / ngày
const ANON_DAILY_LIMIT = 5       // số lần gọi AI tối đa / khách chưa đăng nhập / ngày
const MAX_STORY_LOVE_LEN = 1500  // textarea "chuyện tình" (nguyên văn, khớp maxlength client)
const MAX_OPTIMIZE_IN  = 800     // độ dài tối đa văn bản đầu vào cho nút "Tối ưu"
const MAX_GUESTS_IN    = 8000    // ô dán danh sách khách (khớp AI_GUEST_MAX_CHARS ở trang Khách mời)
// Trần số khách AI trả về (văn bản có thể ghi cả hai nhóm, 2 × MAX_PER_SIDE của
// guest-handler). Trần THẬT mỗi bên do guest-handler giữ lúc ghi.
const MAX_GUESTS_OUT   = 200
// Tệp đính kèm của mode=guests (ảnh đã nén ở trình duyệt, hoặc PDF): tối đa
// MAX_GUEST_FILES tệp một lượt, mỗi tệp ~4MB, tổng ~8MB (tính theo độ dài base64).
// Khớp aiMaxFiles / aiFileMaxMB / aiFilesMaxMB của CONFIG.guestImport ở client.
const GUEST_FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
const MAX_GUEST_FILES = 5
// Word/Excel/.txt: trình duyệt đọc ra chữ rồi gửi kèm trong `docs` (tính chung số tệp
// với ảnh/PDF). Trần tổng ký tự — khớp aiDocsMaxChars của client.
const MAX_GUEST_DOCS_IN = 20000
const GUEST_DOC_TYPES = ['Word', 'Excel', '.txt', 'CSV']
const MAX_GUEST_FILE_B64 = 5_600_000
const MAX_GUEST_FILES_B64 = 11_200_000
// PDF tốn token theo SỐ TRANG — một file 4MB có thể vài trăm trang, đủ đốt quota Gemini
// của mọi tính năng AI. Đếm thô được thì giới hạn tổng trang; không đếm được (PDF nén
// object stream) thì chỉ nhận file nhỏ. Khớp aiPdfMaxPages / aiPdfUnknownMaxMB ở client.
const MAX_GUEST_PDF_PAGES = 10
const MAX_GUEST_PDF_UNKNOWN_B64 = 2_800_000
// Trần body đọc vào (kiểm Content-Length TRƯỚC khi parse, kể cả khách chưa đăng nhập):
// mode=guests mang tệp nên cao, mọi mode khác chỉ là chữ ngắn.
const MAX_BODY_GUESTS = 12_000_000
const MAX_BODY_TEXT = 100_000

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

// ── CORS ─────────────────────────────────────────────────────────────────────
// Cho phép: origin nằm trong allowlist, hoặc bất kỳ localhost/127.0.0.1 (mọi cổng, để dev).
// ── Chuẩn hoá input ──────────────────────────────────────────────────────────
// ── Prompt "dữ liệu mẫu" (mode=sample) ──────────────────────────────────────
// Không có dữ liệu người dùng để trích xuất: AI phải TỰ NGHĨ RA trọn bộ một cặp đôi
// hư cấu cho thiệp DEMO. Đây là chỗ DUY NHẤT được phép sáng tác thông tin cá nhân.
function buildSamplePrompt(tone: string, region: string, hint: string): string {
  const today = new Date().toISOString().slice(0, 10)

  return `Bạn tạo DỮ LIỆU DEMO cho mẫu thiệp cưới tiếng Việt (bản xem thử của website, KHÔNG gắn với người thật nào). TỰ NGHĨ RA trọn vẹn một cặp đôi hư cấu: họ tên, cha mẹ hai bên, địa chỉ, ngày giờ lễ và tiệc, tài khoản mừng cưới, chuyện tình, lịch trình, lời ngỏ, lời mời, lời cảm ơn.
Văn phong: ${TONE_LABEL[tone]}.${region ? `\nPhong cách & địa danh vùng miền: ${REGION_LABEL[region]}.` : ''}
${hint ? `\nYêu cầu thêm (ưu tiên tuân theo): """${hint}"""\n` : ''}
QUY TẮC:
1. TỰ SÁNG TÁC mọi thông tin, xuất ĐỦ mọi key trong danh sách bên dưới, KHÔNG bỏ trống key nào.
2. Mỗi lần gọi ra một cặp đôi KHÁC HẲN: đổi họ, tên, quê quán, câu chuyện. Tránh tên quá mòn (Nguyễn Văn A, Trần Thị B).
3. Tên người: họ + đệm + tên, tự nhiên như người Việt thật, đủ dấu, Title Case. Bố cùng họ với con, mẹ họ khác. groom_name/bride_name là TÊN HIỂN THỊ — 2 CHỮ CUỐI của họ tên đầy đủ ("Đoàn Quang Vinh" → "Quang Vinh"), TUYỆT ĐỐI không chứa chữ "Thị".
4. Địa chỉ (groom_address, bride_address): số nhà + đường + phường/xã + quận/huyện + tỉnh/thành, ngăn cách bằng dấu phẩy, ghép ĐÚNG quận/huyện với tỉnh/thành có thật. Hai nhà ở hai nơi khác nhau.
5. Ngày "YYYY-MM-DD", PHẢI ở tương lai so với hôm nay (${today}), cách 2–5 tháng, rơi vào THỨ BẢY hoặc CHỦ NHẬT; ngày tiệc trước ngày lễ chính 1 ngày. Giờ "HH:MM" 24h: lễ chính 09:00–11:00, vu quy sớm hơn lễ chính, tiệc 17:00–19:00.
6. ceremony_location: nhà hàng/hội trường tiệc cưới tên nghe tự nhiên + tỉnh/thành nhà trai. vu_quy_enabled = "true", vu_quy_location là tư gia nhà gái.
7. Ngân hàng: *_bank_name trả MÃ VIẾT TẮT (VCB, TCB, MB, CTG, BIDV, ACB, VBA, STB, VPB, TPB); *_bank_number 9–12 chữ số; *_bank_owner là họ tên đầy đủ của chính người đó, IN HOA KHÔNG DẤU ("Đoàn Quang Vinh" → "DOAN QUANG VINH").
8. Chuyện tình (block "love"): 4–5 mốc, năm TĂNG DẦN, kết ở năm cưới; mỗi mốc đủ date + title + content (1–2 câu cụ thể, giàu cảm xúc).
   • ${LOVE_VOICE_RULE}
9. Lịch trình (block "timeline"): 6–8 mốc theo THỨ TỰ THỜI GIAN THỰC TẾ của đám cưới Việt Nam. PHẢI BAO GỒM cả 3 loại kind: "bride-party" (Tiệc nhà gái, chiều/tối hôm trước), "party" (Tiệc nhà trai, chiều/tối hôm trước hoặc sáng hôm sau), "ceremony" (Lễ Vu quy / Thành hôn, sáng hôm sau). Ví dụ thứ tự: 17:00 Tiệc nhà gái (bride-party) → 19:00 Tiệc nhà trai (party) → 08:00 ngày hôm sau Đón dâu (ceremony) → 09:30 Lễ thành hôn (ceremony).
10. story_quote: 1 câu 12–24 chữ, KHÔNG tên riêng/ngày tháng/địa điểm, không dấu ngoặc kép. rsvp_message & footer_text: ấm áp, chân thành, đúng văn phong.

ĐẦU RA: MỘT MẢNG JSON PHẲNG các "block", không lồng nhau, không markdown, mỗi phần tử theo đúng 1 trong 4 dạng:
- {"type":"field","key":"<tên trường>","value":"<giá trị>"}
- {"type":"love","date":"<MM/YYYY hoặc mô tả ngắn>","title":"<tiêu đề>","content":"<1-2 câu>"}
- {"type":"timeline","time":"<HH:MM>","title":"<việc>","kind":"<ceremony|party|bride-party>"}
- {"type":"text","key":"story_quote","value":"<slogan theo mục 10>"}

"key" phải xuất ĐỦ: groom_name, bride_name, ceremony_name, ceremony_date, ceremony_time, ceremony_location, vu_quy_enabled (value "true"), vu_quy_time, vu_quy_location, groom_father, groom_mother, groom_address, bride_father, bride_mother, bride_address, groom_party_date, groom_party_time, groom_party_location, bride_party_date, bride_party_time, bride_party_location, rsvp_message, footer_text, groom_bank_name, groom_bank_number, groom_bank_owner, bride_bank_name, bride_bank_number, bride_bank_owner.

THỨ TỰ XUẤT BLOCK: (1) tất cả block "field"; (2) các block "love"; (3) các block "timeline"; (4) cuối cùng block "text" story_quote.`
}

// ── Prompt cho nút "Tối ưu" (làm giàu 1 ô văn bản theo inputType) ─────────────
// Mỗi loại ô có hướng dẫn + giới hạn riêng. `multiline=false` → ép về 1 dòng.
const OPTIMIZE_SPECS: Record<string, { maxOut: number; multiline: boolean; guide: string }> = {
  slogan: {
    maxOut: 200, multiline: false,
    guide: 'Slogan / lời ngỏ của cặp đôi in trên thiệp: CHỈ 1 câu ngắn gọn (khoảng 12–24 chữ), tối đa 2 vế, giàu chất thơ và cảm xúc. TUYỆT ĐỐI KHÔNG chứa tên riêng, ngày tháng hay địa điểm — mang tính phổ quát về tình yêu/hôn nhân. KHÔNG đặt dấu ngoặc kép.',
  },
  rsvp: {
    maxOut: 400, multiline: true,
    guide: 'Lời nhắn mời khách xác nhận tham dự (RSVP): ấm áp, chân thành, trân trọng lời mời và mong khách phản hồi. Khoảng 1–2 câu.',
  },
  footer: {
    maxOut: 300, multiline: true,
    guide: 'Lời cảm ơn ở cuối thiệp (footer): trang trọng, ấm áp, cảm ơn sự hiện diện của quan khách. Khoảng 1–2 câu.',
  },
  love_story: {
    maxOut: 400, multiline: true,
    guide:
      'Nội dung MỘT mốc trong câu chuyện tình yêu: kể lại khoảnh khắc đó thật sinh động, giàu cảm xúc và cụ thể. Khoảng 1–2 câu. KHÔNG bịa chi tiết nhạy cảm (địa chỉ, tên người lạ) không có trong bản gốc. ' +
      LOVE_VOICE_RULE +
      ' Nếu bản gốc có nhắc tên cô dâu/chú rể, hãy THAY bằng đại từ tương ứng.',
  },
  timeline: {
    maxOut: 120, multiline: false,
    guide: 'Tên/mô tả MỘT sự kiện trong lịch trình ngày cưới (ví dụ "Đón khách", "Làm lễ gia tiên"): viết ngắn gọn, rõ ràng, trang trọng và mạch lạc hơn. TỐI ĐA khoảng 6–10 chữ, KHÔNG kèm giờ giấc.',
  },
  share: {
    maxOut: 500, multiline: true,
    guide: 'Tin nhắn mời khách kèm link thiệp (gửi qua Zalo/Messenger): thân mật, ấm áp, dễ thương, mời khách bấm vào xem thiệp. Khoảng 1–3 câu. TUYỆT ĐỐI GIỮ NGUYÊN VĂN mọi biến dạng ##...## (ví dụ ##Relationship##, ##link##) — KHÔNG dịch, KHÔNG đổi tên, KHÔNG xoá, KHÔNG thêm khoảng trắng bên trong; giữ đúng SỐ LƯỢNG và vị trí hợp lý (##Relationship## ở lời chào đầu, ##link## ở cuối). Nếu bản gốc thiếu ##link## thì thêm câu mời kèm ##link## ở cuối.',
  },
}

function buildOptimizePrompt(inputType: string, text: string, tone: string): string {
  const spec = OPTIMIZE_SPECS[inputType]
  return `Bạn là XuXi, trợ lý biên tập nội dung thiệp cưới tiếng Việt của Cưới Xinh. Nhiệm vụ: VIẾT LẠI đoạn dưới đây cho hay hơn — sinh động, giàu cảm xúc, mượt mà hơn — nhưng GIỮ ĐÚNG ý gốc của người dùng.

Loại nội dung: ${spec.guide}
Văn phong: ${TONE_LABEL[tone] ?? TONE_LABEL.romantic}.

QUY TẮC:
- Bám sát ý & thông tin có thật người dùng nhập; KHÔNG bịa thêm chi tiết cá nhân (tên, ngày, địa chỉ, con số) không có trong bản gốc.
- Viết tiếng Việt tự nhiên, có dấu đầy đủ.
${spec.multiline ? '' : '- Chỉ MỘT dòng, KHÔNG xuống dòng.\n'}- Trả về DUY NHẤT đoạn văn bản đã tối ưu — KHÔNG giải thích, KHÔNG markdown, KHÔNG bao ngoặc kép.

Đoạn gốc của người dùng:
"""
${text}
"""`
}

// ── Prompt "Tạo câu chuyện tình yêu" (sinh danh sách mốc từ đoạn kể tự do) ────
const LOVE_ITEM_SCHEMA = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      date: { type: 'string', description: 'Mốc thời gian ngắn, VD "Mùa xuân 2020" (có thể rỗng)' },
      title: { type: 'string', description: 'Tiêu đề ngắn cho khoảnh khắc, KHÔNG chứa tên riêng' },
      content: {
        type: 'string',
        description:
          '1-2 câu kể lại sinh động, giàu cảm xúc; xưng "chúng mình"/"chúng tôi"/"anh"/"em", KHÔNG chứa tên riêng của cô dâu/chú rể',
      },
    },
    required: ['title', 'content'],
  },
}

function buildLoveStoryPrompt(text: string, tone: string): string {
  return `Bạn viết "Câu chuyện tình yêu" cho thiệp cưới tiếng Việt. Người dùng kể TỰ DO (đoạn liền mạch, có thể gộp nhiều ý trong một câu) — hãy đọc hiểu rồi TÁCH thành các MỐC theo dòng thời gian, mỗi mốc là một object {date, title, content}.

Văn phong: ${TONE_LABEL[tone] ?? TONE_LABEL.romantic}.

QUY TẮC:
- SỐ MỐC = số sự kiện bạn tự nhận diện theo NGỮ NGHĨA (không phải số dòng), tối đa ${MAX_LOVE_ITEMS}. Một câu nhiều sự kiện thì tách, nhiều câu tả một khoảnh khắc thì gộp. Giữ đúng ý & thứ tự thời gian, KHÔNG bỏ sót, KHÔNG bịa sự kiện mới.
- "date": mốc thời gian ngắn ("Mùa xuân 2020", "03/2021") nếu suy ra được, không rõ thì để "".
- "title": tiêu đề ngắn ("Lần đầu gặp gỡ", "Ngày cầu hôn").
- "content": BẮT BUỘC 1-2 câu kể sinh động, giàu cảm xúc; KHÔNG lặp suông title, KHÔNG bịa chi tiết không có trong lời kể (địa chỉ, tên người lạ).
- ${LOVE_VOICE_RULE}
- Tiếng Việt tự nhiên, đủ dấu.

ĐẦU RA: DUY NHẤT một MẢNG JSON các object {date, title, content} theo thứ tự thời gian, không markdown, không object bọc ngoài.

Câu chuyện người dùng kể:
"""
${text}
"""`
}

// ── Prompt "Nhập khách bằng AI" (mode=guests) ──────────────────────────────
// Xưng hô gợi ý — bản sao GUEST_RELATIONS ở invitation-setup/guests/index.js, đổi
// một bên thì đổi cả bên kia (AI vẫn được trả xưng hô ngoài danh sách).
const GUEST_RELATIONS = [
  'Bạn', 'Anh', 'Chị', 'Em', 'Anh chị', 'Vợ chồng', 'Cô', 'Chú', 'Bác', 'Dì', 'Cậu',
  'Mợ', 'Thím', 'Ông', 'Bà', 'Thầy', 'Cô giáo', 'Đồng nghiệp', 'Sếp', 'Họ hàng', 'Gia đình',
]

const GUEST_ITEM_SCHEMA = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      full_name: { type: 'string', description: 'Tên người/nhóm như người dùng ghi, đã bỏ xưng hô đứng đầu' },
      display_name: { type: 'string', description: 'Cách gọi trên thiệp nếu khác full_name, không thì ""' },
      relationship: { type: 'string', description: 'Xưng hô dùng để mời khách' },
      side: { type: 'string', enum: ['groom', 'bride', 'unknown'] },
    },
    required: ['full_name', 'relationship', 'side'],
  },
}

// fromFile = danh sách nằm trong tệp đính kèm (ảnh/PDF) gửi cùng lượt; khi đó `text`
// (có thể rỗng) là phần người dùng gõ thêm — khách bổ sung hoặc lời dặn cách đọc.
type GuestDoc = { name: string; type: string; text: string }

// Tên tệp/sheet nằm trong prompt: một dòng, bỏ ngoặc kép để không phá khối trích.
const guestFileName = (v: unknown) =>
  String(v ?? '').replace(/[\r\n"“”]+/g, ' ').trim().slice(0, 120) || 'không tên'

// files: số ảnh/PDF gửi kèm (đánh số 1..files, mỗi tệp có dòng "Tệp N: …" đứng trước);
// docs: chữ trích từ Word/Excel/.txt, đánh số tiếp theo, mỗi tệp một khối có rào.
function buildGuestsPrompt(text: string, files = 0, docs: GuestDoc[] = []): string {
  const attached = files > 0 || docs.length > 0
  const intro = attached
    ? `Bạn là XuXi, trợ lý của Cưới Xinh. Người dùng gửi danh sách khách mời đám cưới trong MỘT HOẶC NHIỀU TỆP (ảnh chụp giấy viết tay, ảnh màn hình Zalo, PDF, Word, Excel…). Mỗi tệp được đánh số và ghi tên: ảnh/PDF gửi kèm, có dòng "Tệp N: …" đứng ngay trước; Word/Excel/.txt đã đổi sang chữ, nằm giữa dòng "=== Tệp N … ===" và "=== Hết tệp N ===" ở cuối lời nhắn này. Đọc kỹ MỌI chữ trong từng tệp, kể cả chữ viết tay, giữ đúng dấu tiếng Việt; chữ nào không đọc chắc thì ghi đúng như nhìn thấy, KHÔNG đoán thành tên khác. Nhiều tệp là các phần của CÙNG một danh sách: đọc lần lượt theo số tệp, gộp lại; một người xuất hiện ở nhiều tệp (ảnh chụp chồng lên nhau) chỉ xuất MỘT lần. Tên tệp hoặc tên sheet có thể cho biết nhóm (VD "khach-nha-gai.xlsx", sheet "Nhà gái:") — dùng nó như tiêu đề nhóm ở mục 6. Nội dung Excel: mỗi hàng một dòng, các ô ngăn bằng " | ", hàng đầu thường là tiêu đề cột chứ không phải khách. Rồi TÁCH thành từng khách mời — mỗi khách là MỘT lời mời (một người, một cặp vợ chồng, hoặc một gia đình).`
    : `Bạn là XuXi, trợ lý của Cưới Xinh. Người dùng DÁN một danh sách khách mời đám cưới (chép từ Zalo, ghi chú điện thoại, Excel, viết tay…). Hãy TÁCH thành từng khách mời — mỗi khách là MỘT lời mời (một người, một cặp vợ chồng, hoặc một gia đình).`
  const docBlock = docs.length
    ? `

Nội dung trích từ tệp:
${docs.map((d, i) => {
  const no = files + i + 1
  return `=== Tệp ${no}: "${d.name}" (${d.type}) ===\n${d.text}\n=== Hết tệp ${no} ===`
}).join('\n\n')}`
    : ''
  const userText = !attached
    ? `

Danh sách người dùng dán:
"""
${text}
"""`
    : text
      ? `

Người dùng gõ thêm kèm tệp — có thể là khách BỔ SUNG (xuất ra như khách trong tệp, xếp SAU khách trong tệp) hoặc LỜI DẶN cách đọc tệp (VD "tệp 2 là nhà gái", "bỏ qua cột cuối") — làm theo lời dặn nhưng vẫn giữ đúng các QUY TẮC trên:
"""
${text}
"""`
      : ''
  return `${intro}

QUY TẮC:
1. Chỉ lấy người có trong văn bản. KHÔNG bịa thêm người, KHÔNG thêm họ/tên đệm người dùng không ghi.
2. Dòng tiêu đề nhóm (VD "Nhà trai:", "Bạn đại học:") và dòng ghi chú chung KHÔNG xuất thành khách — nhưng tiêu đề nhóm vẫn dùng để xác định "side" (mục 6). Trong một dòng khách, bỏ phần không phải tên: số thứ tự, số điện thoại, địa chỉ, số người đi kèm, tiền mừng, ghi chú trong ngoặc.
3. "relationship" là XƯNG HÔ dùng để mời. Ưu tiên một giá trị trong: ${GUEST_RELATIONS.join(', ')}. Văn bản ghi rõ cách gọi khác (VD "Ông bà", "Anh Hai") thì giữ nguyên (tối đa 3 chữ). Không suy ra được thì dùng "Bạn".
4. "full_name": tên như người dùng ghi, ĐÃ BỎ xưng hô đứng đầu, viết hoa chữ cái đầu mỗi từ, đủ dấu. VD "anh Tuấn" → full_name "Tuấn", relationship "Anh".
5. "display_name": cách gọi trên thiệp, CHỈ điền khi khác full_name — VD "Gia đình chú Ba" → full_name "Ba", relationship "Chú", display_name "Ba và gia đình"; "vợ chồng Nam - Hoa" → full_name "Nam - Hoa", relationship "Vợ chồng", display_name "". KHÔNG lặp xưng hô trong display_name. Còn lại để "".
6. "side": "groom" nếu khách nằm dưới tiêu đề/nhãn kiểu "Nhà trai", "Bên chú rể", "Khách của chồng"; "bride" nếu "Nhà gái", "Bên cô dâu", "Khách của vợ"; văn bản không chia nhóm hoặc không rõ thì "unknown".
7. XƯNG HÔ GHÉP đứng liền nhau rồi tới tên riêng (VD "anh chị", "cô chú", "ông bà", "bác") là MỘT cặp, chung MỘT thiệp — KHÔNG tách dù sau đó có hai tên. VD "anh chị Huyền Sang" → MỘT khách: full_name "Huyền Sang", relationship "Anh chị"; "cô chú Lan - Hùng" → full_name "Lan - Hùng", relationship "Cô chú".
   Ngược lại, nhiều người cách nhau bằng dấu phẩy, mỗi người một xưng hô riêng (VD "anh Tuấn, chị Hà") thì tách thành nhiều khách.
8. Giữ đúng thứ tự xuất hiện. Tối đa ${MAX_GUESTS_OUT} khách.

ĐẦU RA: DUY NHẤT một MẢNG JSON các object {full_name, display_name, relationship, side}, không markdown. Không tìm thấy khách nào thì trả [].${userText}${docBlock}`
}

// Schema ép cấu trúc cho Gemini: MẢNG các phần tử theo anyOf (mỗi block một dạng
// riêng). Nhờ anyOf, block "love" BẮT BUỘC có title + content.
const BLOCK_TEXT = {
  type: 'object',
  properties: {
    type: { type: 'string', enum: ['text'] },
    key: { type: 'string' },
    value: { type: 'string' },
  },
  required: ['type', 'key', 'value'],
}
const BLOCK_LOVE = {
  type: 'object',
  properties: {
    type: { type: 'string', enum: ['love'] },
    date: { type: 'string', description: 'MM/YYYY hoặc mô tả ngắn' },
    title: { type: 'string', description: 'Tiêu đề mốc, KHÔNG chứa tên riêng' },
    content: {
      type: 'string',
      description:
        'BẮT BUỘC: 1-2 câu kể/làm giàu về mốc, không được rỗng; xưng "chúng mình"/"chúng tôi"/"anh"/"em", KHÔNG chứa tên riêng của cô dâu/chú rể',
    },
  },
  required: ['type', 'title', 'content'],
}
const BLOCK_TIMELINE = {
  type: 'object',
  properties: {
    type: { type: 'string', enum: ['timeline'] },
    time: { type: 'string' },
    title: { type: 'string' },
    kind: { type: 'string' },
  },
  required: ['type', 'title'],
}
const BLOCK_FIELD = {
  type: 'object',
  properties: {
    type: { type: 'string', enum: ['field'] },
    key: { type: 'string' },
    value: { type: 'string' },
  },
  required: ['type', 'key', 'value'],
}
const RESPONSE_SCHEMA = {
  type: 'array',
  items: { anyOf: [BLOCK_TEXT, BLOCK_LOVE, BLOCK_TIMELINE, BLOCK_FIELD] },
}

// ── Cấu hình gọi provider (gom 1 chỗ cho dễ chỉnh) ───────────────────────────

// Ngân sách "suy nghĩ" của Gemini 2.5 Flash — model bật thinking mặc định và hay
// tiêu vài nghìn token trước khi trả lời, đó là phần chờ lâu nhất. Output ở đây đã
// bị ép theo responseSchema nên gần như không cần suy luận:
//   • 0   → tắt hẳn (viết lại 1 ô, tách mốc chuyện tình, bịa dữ liệu demo)
//   • 512 → chừa một ít cho luồng sinh thiệp thật (suy tên rút gọn, ước giờ vu quy)
const THINK_OFF = { thinkingBudget: 0 }
const THINK_LOW = { thinkingBudget: 512 }

// generationConfig của Gemini theo từng tác vụ.
const GEN_CFG_BLOCKS = {
  temperature: 0.9,
  responseMimeType: 'application/json',
  responseSchema: RESPONSE_SCHEMA,
  thinkingConfig: THINK_LOW,
  // Nới trần token: tránh JSON bị cắt ngang khiến block cuối (slogan) bị mất.
  maxOutputTokens: 65536,
}
// Dữ liệu mẫu (admin): thuần sáng tác, không phải trích xuất → tắt thinking.
const GEN_CFG_SAMPLE = { ...GEN_CFG_BLOCKS, thinkingConfig: THINK_OFF }
const GEN_CFG_TEXT = { temperature: 0.9, maxOutputTokens: 2048, thinkingConfig: THINK_OFF }
const GEN_CFG_LOVE = {
  temperature: 0.9,
  responseMimeType: 'application/json',
  responseSchema: LOVE_ITEM_SCHEMA,
  thinkingConfig: THINK_OFF,
  maxOutputTokens: 16384,
}

// Trích xuất thuần (không sáng tác) → nhiệt độ thấp, tắt thinking. Danh sách dài
// thì output cũng dài nên nới trần token + thời gian chờ.
const GEN_CFG_GUESTS = {
  temperature: 0.2,
  responseMimeType: 'application/json',
  responseSchema: GUEST_ITEM_SCHEMA,
  thinkingConfig: THINK_OFF,
  maxOutputTokens: 32768,
}
const GUESTS_TIMEOUT_MS = 45000

type ParsedGuest = { full_name: string; display_name: string; relationship: string; side: string }

// Parse + clamp danh sách khách (độ dài cột khớp sanitizeGuest của guest-handler).
// Trả null khi JSON hỏng hẳn — khác guests [] (AI đọc xong mà không thấy khách nào).
// truncated = có khách bị cắt vì vượt MAX_GUESTS_OUT, để trang báo cho người dùng.
function cleanGuestItems(rawText: string): { guests: ParsedGuest[]; truncated: boolean } | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(rawText)
  } catch {
    const m = rawText.match(/\[[\s\S]*\]/)
    if (!m) return null
    try { parsed = JSON.parse(m[0]) } catch { return null }
  }
  const arr: any[] = Array.isArray(parsed)
    ? parsed
    : (Array.isArray((parsed as any)?.guests) ? (parsed as any).guests : [])
  const out: ParsedGuest[] = []
  let truncated = false
  for (const it of arr) {
    const full_name = clampStr(it?.full_name, 200)
    if (!full_name) continue
    if (out.length >= MAX_GUESTS_OUT) { truncated = true; break }
    let display_name = clampStr(it?.display_name, 200)
    if (display_name === full_name) display_name = ''
    const side = it?.side === 'groom' || it?.side === 'bride' ? it.side : ''
    out.push({ full_name, display_name, relationship: clampStr(it?.relationship, 100) || 'Bạn', side })
  }
  return { guests: out, truncated }
}

// Parse + clamp danh sách mốc chuyện tình (chấp nhận mảng thẳng hoặc {items|love_story:[...]}).
function cleanLoveItems(rawText: string): Array<{ date: string; title: string; content: string }> {
  let parsed: unknown
  try {
    parsed = JSON.parse(rawText)
  } catch {
    const m = rawText.match(/\[[\s\S]*\]/) || rawText.match(/\{[\s\S]*\}/)
    if (!m) return []
    try { parsed = JSON.parse(m[0]) } catch { return [] }
  }
  const arr: any[] = Array.isArray(parsed)
    ? parsed
    : (Array.isArray((parsed as any)?.items) ? (parsed as any).items
      : Array.isArray((parsed as any)?.love_story) ? (parsed as any).love_story : [])
  const out: Array<{ date: string; title: string; content: string }> = []
  for (const it of arr) {
    if (out.length >= MAX_LOVE_ITEMS) break
    const date = clampStr(it?.date, 40)
    const title = clampStr(it?.title, 120)
    const content = clampStr(it?.content, MAX_TEXT_LEN)
    if (title || content) out.push({ date, title, content })
  }
  return out
}

// Làm sạch text tối ưu: bỏ hàng rào code, ngoặc kép bao ngoài, gộp khoảng trắng, clamp.
function cleanOptimizeOut(raw: string, max: number): string {
  let s = String(raw ?? '')
    .replace(/^\s*```[a-zA-Z]*\s*/, '')
    .replace(/\s*```\s*$/, '')
    .trim()
  s = s.replace(/^["'“”«»]+/, '').replace(/["'“”«»]+$/, '').trim()
  s = s.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
  return s.slice(0, max)
}

// ── Chuẩn hoá output (theo block) ────────────────────────────────────────────
// Parse toàn bộ text (đường non-stream): chấp nhận CẢ mảng block (Gemini) LẪN
// object {story_quote, love_story, timeline, fields} → clean từng block.
function parseAndClamp(rawText: string, tone = 'romantic'): Record<string, unknown> {
  let parsed: unknown
  try {
    parsed = JSON.parse(rawText)
  } catch {
    // Cứu vãn: bắt mảng [...] hoặc object {...} lọt trong text thừa (markdown…).
    const m = rawText.match(/\[[\s\S]*\]/) || rawText.match(/\{[\s\S]*\}/)
    if (!m) throw new Error('parse fail')
    parsed = JSON.parse(m[0])
  }
  const rawBlocks = Array.isArray(parsed)
    ? (parsed as any[])
    : objectToRawBlocks(parsed as Record<string, any>)
  return cleanBlocks(rawBlocks, tone)
}

// ── Rate limit ───────────────────────────────────────────────────────────────
// Phép đếm ở _shared/ai-rate-limit.ts (dùng chung với ai-chat); ở đây chỉ ghép
// hạn mức của function này với mã thiết bị lấy từ body.
function enforceAiLimit(
  req: Request,
  admin: ReturnType<typeof createClient>,
  user: { id: string } | null,
  body: Record<string, unknown>,
  origin: string | null,
  log: Logger,
  cost = 1,
): Promise<Response | null> {
  return enforceRateLimit(req, admin, {
    feature: 'inv',
    user,
    device: sanitizeDevice(body.device),
    limit: DAILY_LIMIT,
    anonLimit: ANON_DAILY_LIMIT,
    origin,
    log,
    cost,
  })
}

// ── Nhánh "Tối ưu" (làm giàu 1 ô văn bản) ────────────────────────────────────
// Dùng chung xác thực/rate-limit/CORS với hai nhánh kia. Nhận { inputType, text,
// tone? } → trả { text }. inputType quyết định prompt (xem OPTIMIZE_SPECS).
async function handleOptimize(
  req: Request,
  admin: ReturnType<typeof createClient>,
  user: { id: string } | null,
  origin: string | null,
  body: Record<string, unknown>,
  log: Logger,
): Promise<Response> {
  const inputType = String(body.inputType ?? '')
  const spec = OPTIMIZE_SPECS[inputType]
  if (!spec) return json({ error: 'Loại nội dung không hợp lệ' }, 400, origin)

  const text = clampText(body.text, MAX_OPTIMIZE_IN)
  if (!text) return json({ error: 'Chưa có nội dung để tối ưu' }, 400, origin)

  const limited = await enforceAiLimit(req, admin, user, body, origin, log)
  if (limited) return limited

  const res = await generateWithGemini(
    buildOptimizePrompt(inputType, text, pickTone(body.tone)),
    { gemini: GEN_CFG_TEXT },
    log,
    'optimize',
  )
  if (!res) return json({ error: 'Dịch vụ AI đang bận, vui lòng thử lại sau ít phút.' }, 503, origin)

  let out = cleanOptimizeOut(res.raw, spec.maxOut)
  if (!spec.multiline) out = out.replace(/\s*\n+\s*/g, ' ').trim()
  // Mốc chuyện tình: giữ đúng giọng cặp đôi tự kể, không để lọt tên riêng.
  if (inputType === 'love_story') {
    out = stripCoupleNames(
      out,
      clampText(body.groom_name, 60),
      clampText(body.bride_name, 60),
      weTermFor(pickTone(body.tone)),
    )
  }
  if (!out) return json({ error: 'AI chưa tối ưu được, vui lòng thử lại.' }, 502, origin)

  log.info('ai.optimized', { inputType, provider: res.provider, anon: !user })
  return json({ text: out, provider: res.provider }, 200, origin)
}

// ── Nhánh "Tạo câu chuyện tình yêu" (sinh danh sách mốc) ─────────────────────
// Dùng chung xác thực/rate-limit/CORS. Nhận { text, tone? } → trả { items:[{date,title,content}] }.
async function handleLoveStory(
  req: Request,
  admin: ReturnType<typeof createClient>,
  user: { id: string } | null,
  origin: string | null,
  body: Record<string, unknown>,
  log: Logger,
): Promise<Response> {
  const text = clampText(body.text, MAX_STORY_LOVE_LEN)
  if (!text) return json({ error: 'Hãy kể câu chuyện tình yêu trước' }, 400, origin)

  const limited = await enforceAiLimit(req, admin, user, body, origin, log)
  if (limited) return limited

  const tone = pickTone(body.tone)
  const res = await generateWithGemini(
    buildLoveStoryPrompt(text, tone),
    { gemini: GEN_CFG_LOVE },
    log,
    'love',
  )
  if (!res) return json({ error: 'Dịch vụ AI đang bận, vui lòng thử lại sau ít phút.' }, 503, origin)

  // Client gửi kèm tên đang điền trên form → lọc nốt tên lọt vào mốc.
  const names = {
    groom: clampText(body.groom_name, 60),
    bride: clampText(body.bride_name, 60),
  }
  const weTerm = weTermFor(tone)
  const items = cleanLoveItems(res.raw).map((it) => ({
    ...it,
    title: stripCoupleNames(it.title, names.groom, names.bride, weTerm),
    content: stripCoupleNames(it.content, names.groom, names.bride, weTerm),
  }))
  if (!items.length) return json({ error: 'AI chưa tạo được mốc nào, vui lòng thử lại.' }, 502, origin)

  log.info('ai.love_generated', { count: items.length, provider: res.provider, anon: !user })
  return json({ items, provider: res.provider }, 200, origin)
}

// ── Nhánh "Nhập khách bằng AI" (mode=guests) ────────────────────────────────
// Nhận { text } và/hoặc { files:[{mime, data base64, name}] } (ảnh/PDF) + { docs:[{name,
// type, text}] } (chữ trích từ Word/Excel/.txt) — tổng ≤ 5 tệp, chữ thành phần gõ thêm → trả
// { guests:[{full_name, display_name, relationship, side}], truncated } —
// side là nhóm ghi trong văn bản ("" = không chia nhóm); trang chỉ nhập khách khớp
// tab đang mở hoặc không rõ nhóm. BẮT BUỘC đăng nhập vì chỉ chủ thiệp
// mới ghi được khách; danh sách khách là dữ liệu cá nhân nên không log tên.
async function handleGuests(
  req: Request,
  admin: ReturnType<typeof createClient>,
  user: { id: string } | null,
  origin: string | null,
  body: Record<string, unknown>,
  log: Logger,
): Promise<Response> {
  if (!user) return json({ error: 'Đăng nhập để nhập khách bằng AI', login: true }, 401, origin)

  // Chữ (tuỳ chọn khi có tệp) + tối đa MAX_GUEST_FILES tệp ảnh/PDF cho model tự đọc.
  if ((body.files !== undefined && !Array.isArray(body.files)) || (body.docs !== undefined && !Array.isArray(body.docs))) {
    return json({ error: 'Danh sách tệp không hợp lệ' }, 400, origin)
  }
  const files = (body.files ?? []) as { mime?: unknown; data?: unknown; name?: unknown }[]
  const rawDocs = (body.docs ?? []) as { name?: unknown; type?: unknown; text?: unknown }[]
  if (files.length + rawDocs.length > MAX_GUEST_FILES) {
    return json({ error: `Mỗi lượt tối đa ${MAX_GUEST_FILES} tệp` }, 400, origin)
  }
  const raw = String(body.text ?? '')
  if (raw.length > MAX_GUESTS_IN) {
    return json({ error: `Danh sách dài quá ${MAX_GUESTS_IN} ký tự, hãy chia làm nhiều lần` }, 400, origin)
  }
  const text = clampText(raw, MAX_GUESTS_IN)
  const docs: GuestDoc[] = []
  let docChars = 0
  for (const d of rawDocs) {
    const t = String(d?.text ?? '').trim()
    if (!t) return json({ error: 'Có tệp không có chữ nào' }, 400, origin)
    docChars += t.length
    if (docChars > MAX_GUEST_DOCS_IN) {
      return json({ error: `Nội dung các tệp Word/Excel/.txt dài quá ${MAX_GUEST_DOCS_IN} ký tự, hãy chia làm nhiều lần` }, 400, origin)
    }
    const type = String(d?.type ?? '')
    docs.push({ name: guestFileName(d?.name), type: GUEST_DOC_TYPES.includes(type) ? type : 'Văn bản', text: t })
  }
  let parts: GeminiPart[] | null = null
  if (files.length) {
    parts = []
    let total = 0
    let pages = 0
    for (const f of files) {
      const mime = String(f?.mime ?? '')
      const data = String(f?.data ?? '')
      if (!GUEST_FILE_TYPES.includes(mime)) {
        return json({ error: 'Chỉ đọc được ảnh (JPG, PNG, WebP) hoặc PDF' }, 400, origin)
      }
      total += data.length
      if (!data || data.length > MAX_GUEST_FILE_B64 || !/^[A-Za-z0-9+/]+={0,2}$/.test(data)) {
        return json({ error: 'Có tệp quá lớn hoặc hỏng, mỗi tệp phải nhỏ hơn 4MB' }, 400, origin)
      }
      if (total > MAX_GUEST_FILES_B64) {
        return json({ error: 'Tổng dung lượng tệp vượt 8MB, hãy bớt tệp rồi thử lại' }, 400, origin)
      }
      if (!fileMagicOk(mime, data)) {
        return json({ error: 'Có tệp không đúng định dạng ảnh/PDF' }, 400, origin)
      }
      if (mime === 'application/pdf') {
        const n = pdfPageCount(data)
        if (!n && data.length > MAX_GUEST_PDF_UNKNOWN_B64) {
          return json({ error: 'Không đếm được số trang của PDF lớn này, hãy xuất lại PDF hoặc chụp ảnh danh sách' }, 400, origin)
        }
        pages += n || 1
        if (pages > MAX_GUEST_PDF_PAGES) {
          return json({ error: `PDF tối đa ${MAX_GUEST_PDF_PAGES} trang mỗi lượt, hãy tách bớt trang` }, 400, origin)
        }
      }
      parts.push({ text: `Tệp ${parts.length / 2 + 1}: "${guestFileName(f?.name)}" (${mime === 'application/pdf' ? 'PDF' : 'Ảnh'})` })
      parts.push({ inlineData: { mimeType: mime, data } })
    }
    parts.push({ text: buildGuestsPrompt(text, files.length, docs) })
  } else if (!text && !docs.length) {
    return json({ error: 'Hãy dán danh sách khách mời trước' }, 400, origin)
  }

  // Mỗi tệp tính một lượt AI (tệp tốn token hơn chữ nhiều); chỉ chữ = 1 lượt.
  const limited = await enforceAiLimit(req, admin, user, body, origin, log, Math.max(1, files.length))
  if (limited) return limited

  const res = await generateWithGemini(
    parts ?? buildGuestsPrompt(text, 0, docs),
    { gemini: GEN_CFG_GUESTS, timeoutMs: GUESTS_TIMEOUT_MS, model: GEMINI_MODEL_GUESTS },
    log,
    'guests',
  )
  if (!res) return json({ error: 'Dịch vụ AI đang bận, vui lòng thử lại sau ít phút.' }, 503, origin)

  const parsed = cleanGuestItems(res.raw)
  if (!parsed) {
    log.error('ai.guests_parse_failed', { raw_len: String(res.raw).length })
    return json({ error: 'XuXi chưa đọc được danh sách, thử lại nhé.' }, 502, origin)
  }

  log.info('ai.guests_parsed', {
    count: parsed.guests.length, truncated: parsed.truncated, in_len: text.length,
    files: files.length || undefined, docs: docs.length || undefined, provider: res.provider, model: GEMINI_MODEL_GUESTS,
  })
  return json({ ...parsed, provider: res.provider }, 200, origin)
}

// ── Nhánh "Dữ liệu mẫu" (mode=sample) ───────────────────────────────────────
// Nhận { tone?, region?, hint? } → trả { data: {story_quote, love_story, timeline,
// fields} } y hệt nhánh sinh thiệp nên client dùng chung code áp kết quả. Vẫn đi
// qua xác thực / rate-limit / CORS / clamp output như mọi nhánh khác.
async function handleSampleData(
  req: Request,
  admin: ReturnType<typeof createClient>,
  user: { id: string } | null,
  origin: string | null,
  body: Record<string, unknown>,
  log: Logger,
): Promise<Response> {
  const limited = await enforceAiLimit(req, admin, user, body, origin, log)
  if (limited) return limited

  const tone = pickTone(body.tone)
  const region = pickRegion(body.region)
  const prompt = buildSamplePrompt(tone, region, clampText(body.hint, 500))

  const res = await generateWithGemini(
    prompt,
    { gemini: GEN_CFG_SAMPLE },
    log,
    'sample',
  )
  if (!res) return json({ error: 'Dịch vụ AI đang bận, vui lòng thử lại sau ít phút.' }, 503, origin)

  let result: Record<string, unknown>
  try {
    result = parseAndClamp(res.raw, tone)
  } catch (e) {
    log.error('ai.sample_parse_failed', {
      error: errMsg(e),
      raw_snippet: String(res.raw).slice(0, 500),
    })
    return json({ error: 'AI trả về không hợp lệ, vui lòng thử lại.' }, 502, origin)
  }

  const fieldCount = Object.keys(result.fields as Record<string, unknown>).length
  if (!fieldCount) {
    return json({ error: 'AI chưa tạo được dữ liệu mẫu, vui lòng thử lại.' }, 502, origin)
  }

  log.info('ai.sample_generated', { fields: fieldCount, provider: res.provider, anon: !user })
  return json({ data: result, provider: res.provider }, 200, origin)
}

// ── Handler ──────────────────────────────────────────────────────────────────
Deno.serve(withAxiom('ai-invitation', async (req, log) => {
  const origin = req.headers.get('origin')

  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(origin) })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, origin)

  // Chặn body khổng lồ TRƯỚC khi đọc/xác thực — ai cũng gọi được function này.
  const bodyLen = Number(req.headers.get('content-length') ?? 0)
  if (bodyLen > MAX_BODY_GUESTS) {
    log.warn('ai.body_too_large', { bytes: bodyLen })
    return json({ error: 'Dữ liệu gửi lên quá lớn' }, 413, origin)
  }

  const admin = createDbClient(log)

  // 1) Xác thực (TUỲ CHỌN). Có JWT user hợp lệ → luồng đăng nhập; nếu không
  //    (khách vãng lai hoặc chỉ gửi anon key) → luồng ẩn danh theo IP.
  const authHeader = req.headers.get('Authorization') ?? ''
  const token = authHeader.replace(/^Bearer\s+/i, '')
  let user: { id: string } | null = null
  if (token) {
    const { data: userData } = await admin.auth.getUser(token)
    user = userData?.user ?? null // anon key sẽ không trả về user → coi như ẩn danh
  }

  // 2) Đọc + validate input
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Dữ liệu không hợp lệ' }, 400, origin)
  }

  // Chỉ mode=guests được mang tệp; mode khác mà body lớn là bất thường.
  if (body.mode !== 'guests' && bodyLen > MAX_BODY_TEXT) {
    log.warn('ai.body_too_large', { bytes: bodyLen, mode: String(body.mode ?? '') })
    return json({ error: 'Dữ liệu gửi lên quá lớn' }, 413, origin)
  }

  // 2.5) Nhánh "Tối ưu": làm giàu 1 ô văn bản (shape input khác, xử lý riêng).
  if (body.mode === 'optimize') {
    return await handleOptimize(req, admin, user, origin, body, log)
  }

  // 2.6) Nhánh "Tạo câu chuyện tình yêu": sinh danh sách mốc từ đoạn kể tự do.
  if (body.mode === 'love_story') {
    return await handleLoveStory(req, admin, user, origin, body, log)
  }

  // 2.7) Nhánh "Dữ liệu mẫu" (admin): AI tự dựng cả bộ, không cần input.
  if (body.mode === 'sample') {
    return await handleSampleData(req, admin, user, origin, body, log)
  }

  // 2.8) Nhánh "Nhập khách bằng AI": tách danh sách dán tự do thành từng khách.
  if (body.mode === 'guests') {
    return await handleGuests(req, admin, user, origin, body, log)
  }

  return json({ error: 'Thiếu mode hợp lệ (optimize | love_story | sample | guests)' }, 400, origin)
}))
