// ai-invitation — sinh nội dung thiệp cưới bằng AI (Gemini, xoay vòng nhiều key).
//
// Không bắt buộc đăng nhập: có JWT hợp lệ → rate-limit theo user/ngày (bảng
// ai_usage), không có → theo IP/ngày (ai_usage_ip, hạn mức thấp hơn). Validate +
// clamp cả input lẫn output, CORS allowlist, timeout khi gọi provider, không rò
// lỗi chi tiết của provider ra client; API key chỉ nằm trong secret.
//
// ⚠️ Deploy KÈM cờ --no-verify-jwt để khách chưa đăng nhập vẫn gọi được.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { withAxiom, type Logger } from '../_shared/axiom.ts'
// Tầng gọi model + CORS dùng chung với ai-background (xem _shared/ai-provider.ts).
import {
  GEMINI_BASE,
  GEMINI_MODEL,
  ProviderError,
  REQ_TIMEOUT_MS,
  corsHeaders,
  errFields,
  errMsg,
  generateWithGemini,
  getGeminiKeys,
  json,
  readErrorDetail,
  withTimeout,
} from '../_shared/ai-provider.ts'
// Hợp đồng dữ liệu thiệp (whitelist field, nhãn văn phong, tầng validate output)
// dùng chung với ai-chat — xem _shared/card-schema.ts.
import {
  LOVE_VOICE_RULE,
  MAX_LOVE_ITEMS,
  MAX_TEXT_LEN,
  MAX_TIMELINE,
  REGION_LABEL,
  TONE_LABEL,
  cleanBlock,
  cleanBlocks,
  objectToRawBlocks,
  clampStr,
  clampText,
  pickRegion,
  pickTone,
  scrubLoveBlock,
  stripCoupleNames,
  weTermFor,
} from '../_shared/card-schema.ts'

// ── Cấu hình ────────────────────────────────────────────────────────────────

const DAILY_LIMIT      = 15      // số lần gọi AI tối đa / user đã đăng nhập / ngày
const ANON_DAILY_LIMIT = 5       // số lần gọi AI tối đa / IP (khách chưa đăng nhập) / ngày
const MAX_STORY_LOVE_LEN = 1500  // textarea "chuyện tình" (nguyên văn, khớp maxlength client)
const MAX_INFO_LEN     = 2500    // textarea "thông tin cá nhân" (dump tự do)
const MAX_OPTIMIZE_IN  = 800     // độ dài tối đa văn bản đầu vào cho nút "Tối ưu"

// ── CORS ─────────────────────────────────────────────────────────────────────
// Cho phép: origin nằm trong allowlist, hoặc bất kỳ localhost/127.0.0.1 (mọi cổng, để dev).
// ── Chuẩn hoá input ──────────────────────────────────────────────────────────
interface CardInput {
  tone: string
  story_love: string  // chuyện tình nguyên văn người dùng nhập (text liền mạch)
  info: string        // dump thông tin tự do — GỒM tên cô dâu/chú rể, ngày & giờ cưới (AI tự trích)
  region: string      // '' | 'bac' | 'trung' | 'nam'
}

function sanitizeInput(raw: Record<string, unknown>): CardInput | null {
  // Tên/ngày/giờ cưới nay nằm trong `info` để AI tự trích xuất → `info` là bắt buộc.
  const info = clampText(raw.info, MAX_INFO_LEN)
  if (!info) return null

  const tone = pickTone(raw.tone)

  // Chuyện tình: text nguyên văn (giữ xuống dòng để AI đọc mạch kể). Backward-compat:
  // nếu client cũ còn gửi mảng "bullets" thì gộp lại thành text.
  const rawStory = raw.story_love != null
    ? raw.story_love
    : (Array.isArray(raw.bullets) ? (raw.bullets as unknown[]).join('\n') : '')
  const story_love = clampText(rawStory, MAX_STORY_LOVE_LEN)

  const region = pickRegion(raw.region)

  return { tone, story_love, info, region }
}

// ── Prompt ───────────────────────────────────────────────────────────────────
function buildPrompt(inp: CardInput): string {
  const storyLoveText = inp.story_love || '(không có)'

  return `Bạn là trợ lý tạo thiệp cưới tiếng Việt, làm HAI việc: (A) TRÍCH XUẤT thông tin có thật từ dữ liệu người dùng nhập vào đúng trường; (B) SÁNG TẠO slogan, chuyện tình, lịch trình, lời mời, lời cảm ơn.

Tự xác định từ khối THÔNG TIN bên dưới: ai là chú rể, ai là cô dâu (họ tên đầy đủ), ngày & giờ cưới. Mục nào người dùng không ghi rõ thì bỏ qua, KHÔNG bịa.
Văn phong: ${TONE_LABEL[inp.tone]}.${inp.region ? `\nPhong cách vùng miền: ${REGION_LABEL[inp.region]}.` : ''}

CHUYỆN TÌNH người dùng kể (nguyên văn, có thể viết tự do/liền mạch — tự đọc hiểu & tách mốc theo mục 7):
"""
${storyLoveText}
"""

THÔNG TIN CÁ NHÂN người dùng cung cấp (tự do: giờ giấc, địa điểm, cha mẹ hai bên, số tài khoản...):
"""
${inp.info || '(không có)'}
"""

QUY TẮC BẮT BUỘC:
1. Chỉ điền vào "fields" những gì NGƯỜI DÙNG THỰC SỰ cung cấp ở trên (ngoại lệ: tên hiển thị ở mục 8 và địa điểm lễ ở mục 9). TUYỆT ĐỐI KHÔNG bịa: số tài khoản, tên ngân hàng, địa chỉ nhà, tên cha mẹ, giờ giấc. Không có thì BỎ QUA field đó.
2. Ngày (các field *_date) định dạng "YYYY-MM-DD". Giờ (các field *_time) định dạng 24h "HH:MM". PHẢI trích ngày & giờ cưới từ THÔNG TIN thành field ceremony_date (YYYY-MM-DD) và ceremony_time (HH:MM) — người dùng có thể ghi kiểu "20/12/2025", "ngày 20 tháng 12 năm 2025", "11h", "11 giờ"… hãy chuẩn hoá đúng định dạng. Không ghi rõ thì bỏ qua, KHÔNG bịa.
3. Tên chủ tài khoản (*_bank_owner): nếu người dùng không ghi rõ, suy từ tên người sở hữu tài khoản, viết IN HOA KHÔNG DẤU (ví dụ "Nguyễn Văn A" → "NGUYEN VAN A").
4. Tên ngân hàng (groom_bank_name, bride_bank_name): TRẢ VỀ MÃ VIẾT TẮT tiếng Anh không dấu, KHÔNG trả tên đầy đủ tiếng Việt. Ví dụ: Vietcombank→"VCB", Techcombank→"TCB", MB Bank→"MB", VietinBank→"CTG", BIDV→"BIDV", ACB→"ACB", Agribank→"VBA", Sacombank→"STB", VPBank→"VPB", TPBank→"TPB". Nếu không chắc mã chuẩn, trả tên viết tắt phổ biến (ví dụ "Techcombank").
5. vu_quy_enabled = true chỉ khi người dùng có nhắc tới lễ Vu Quy/nhà gái, ngược lại false.
6. Các đoạn SÁNG TẠO (story_quote, love_story, timeline, rsvp_message, footer_text): viết tiếng Việt tự nhiên, đúng văn phong, chân thành, không bịa thông tin cá nhân nhạy cảm.
7. Chuyện tình yêu (block "love") — PHẦN QUAN TRỌNG NHẤT:
   • Phần "Chuyện tình người dùng kể" CÓ nội dung → BẮT BUỘC xuất các block "love" riêng biệt. Nhét chuyện tình vào story_quote/rsvp_message thay vì xuất block love là SAI NGHIÊM TRỌNG. Người dùng không kể gì thì bỏ qua hoàn toàn, KHÔNG tự bịa.
   • SỐ MỐC = số SỰ KIỆN bạn tự nhận diện theo NGỮ NGHĨA (không phải số dòng), tối đa ${MAX_LOVE_ITEMS}. Người dùng viết tự do → tự TÁCH/GỘP theo dòng thời gian: một câu nhiều sự kiện thì tách, nhiều câu tả một khoảnh khắc thì gộp. Giữ đúng ý & thứ tự, KHÔNG bỏ sót, KHÔNG thêm sự kiện mới.
   • Mỗi block đủ "date" + "title" + "content". Người dùng thường chỉ nêu ý ngắn → PHẢI LÀM GIÀU "content" thành 1-2 câu tự nhiên, giàu cảm xúc (KHÔNG lặp suông title, KHÔNG bịa địa chỉ/tên người lạ). KHÔNG xuất mốc thiếu content.
   • ${LOVE_VOICE_RULE}
8. Tên hiển thị — LUÔN tạo đủ 2 block "groom_name" và "bride_name", rút gọn họ tên đầy đủ còn 2 CHỮ CUỐI ("Đoàn Quang Vinh" → "Quang Vinh"). TUYỆT ĐỐI không để chữ "Thị" lọt vào: nếu 2 chữ cuối chứa "Thị" ("Nguyễn Thị Anh"), bỏ "Thị" rồi lấy thêm chữ liền trước ("Nguyễn Anh"). Tên gốc chỉ 1 chữ thì giữ nguyên. Dùng chính tên rút gọn này khi nhắc tới cặp đôi ở các đoạn sáng tạo mục 6 — TRỪ block "love" (mục 7 cấm dùng tên).
9. Địa điểm khi người dùng KHÔNG ghi rõ (ngoại lệ được suy ra): ceremony_location lấy trùng groom_address; vu_quy_location (chỉ khi vu_quy_enabled=true) lấy trùng bride_address. Chỉ suy khi đã có địa chỉ nhà tương ứng, không có thì bỏ trống. Riêng groom_party_location/bride_party_location KHÔNG tự suy.
10. Giờ Vu Quy (chỉ khi vu_quy_enabled=true, người dùng không ghi rõ): ngày Vu Quy trùng ngày lễ chính. Nếu có CẢ groom_address lẫn bride_address, ước lượng thời gian đi ô tô giữa hai nhà rồi đặt vu_quy_time sớm hơn giờ lễ chính ≈ 2× thời gian một chiều (đi + đưa dâu về) + 30–45 phút làm lễ, làm tròn mốc 5/10 phút. Thiếu dữ liệu thì đặt trùng giờ lễ chính.
11. Slogan (story_quote) — lời ngỏ của cặp đôi: CHỈ 1 câu 12–24 chữ, tối đa 2 vế, giàu chất thơ, chân thành; xưng "anh/em" hoặc không xưng, KHÔNG dấu ngoặc kép. TUYỆT ĐỐI KHÔNG chứa tên riêng, ngày tháng, địa điểm — nội dung PHỔ QUÁT về tình yêu/hôn nhân (đồng hành, biết ơn, khởi đầu hành trình mới). Sáng tạo câu MỚI, KHÔNG chép mẫu kiểu "Tình yêu không phải là nhìn nhau, mà là cùng nhau nhìn về một hướng."
12. CHUẨN HOÁ VIẾT HOA — luôn format lại dù người dùng nhập kiểu gì, giữ nguyên dấu tiếng Việt, KHÔNG thêm/bớt thông tin:
   • Tên người (groom_name, bride_name, *_father, *_mother) và ceremony_name: Title Case. VD "nguyễn văn an" → "Nguyễn Văn An".
   • Địa chỉ (ceremony_location, vu_quy_location, *_address, *_party_location): Title Case + ngăn cách các thành phần bằng DẤU PHẨY. VD "12 lê lợi p bến nghé q1 tphcm" → "12 Lê Lợi, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh". Giữ viết tắt chuẩn (TP., Q., P., KP., TT.), KHÔNG bịa địa danh.
   • NGOẠI LỆ: *_bank_owner theo mục 3 (IN HOA KHÔNG DẤU).

ĐẦU RA: MỘT MẢNG JSON PHẲNG các "block", không lồng nhau, không markdown, mỗi phần tử theo đúng 1 trong 4 dạng:
- {"type":"field","key":"<tên trường>","value":"<giá trị>"}   // chỉ khi CÓ dữ liệu thật (trừ ngoại lệ mục 8, 9); không có thì bỏ qua, đừng tạo block rỗng
- {"type":"love","date":"<MM/YYYY hoặc mô tả ngắn>","title":"<tiêu đề>","content":"<1-2 câu, BẮT BUỘC có>"}   // tối đa ${MAX_LOVE_ITEMS}
- {"type":"timeline","time":"<HH:MM>","title":"<việc>","kind":"<ceremony|party|bride-party>"}   // tối đa ${MAX_TIMELINE}; ceremony = nghi lễ, party = tiệc nhà trai, bride-party = tiệc nhà gái
- {"type":"text","key":"story_quote","value":"<slogan theo mục 11>"}

"key" hợp lệ cho block "field": groom_name, bride_name, ceremony_name, ceremony_date, ceremony_time, ceremony_location, vu_quy_enabled (value "true"/"false"), vu_quy_time, vu_quy_location, groom_father, groom_mother, groom_address, bride_father, bride_mother, bride_address, groom_party_date, groom_party_time, groom_party_location, bride_party_date, bride_party_time, bride_party_location, rsvp_message, footer_text, groom_bank_name, groom_bank_number, groom_bank_owner, bride_bank_name, bride_bank_number, bride_bank_owner.

THỨ TỰ XUẤT BLOCK (bắt buộc đúng thứ tự, xuất dần từng block để giao diện hiện kịp): (1) tất cả block "field"; (2) các block "love"; (3) các block "timeline"; (4) cuối cùng block "text" story_quote.`
}

// ── Prompt "dữ liệu mẫu" (mode=sample) ──────────────────────────────────────
// Khác buildPrompt: không có dữ liệu người dùng để trích xuất, AI phải TỰ NGHĨ RA
// trọn bộ một cặp đôi hư cấu cho thiệp DEMO. Đây là chỗ DUY NHẤT được phép sáng
// tác thông tin cá nhân.
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
    guide: 'Tin nhắn mời khách kèm link thiệp (gửi qua Zalo/Messenger): thân mật, ấm áp, dễ thương, mời khách bấm vào xem thiệp. Khoảng 1–3 câu. TUYỆT ĐỐI GIỮ NGUYÊN VĂN mọi biến dạng ##...## (ví dụ ##Danh xưng##, ##link##) — KHÔNG dịch, KHÔNG đổi tên, KHÔNG xoá, KHÔNG thêm khoảng trắng bên trong; giữ đúng SỐ LƯỢNG và vị trí hợp lý (##Danh xưng## ở lời chào đầu, ##link## ở cuối). Nếu bản gốc thiếu ##link## thì thêm câu mời kèm ##link## ở cuối.',
  },
}

function buildOptimizePrompt(inputType: string, text: string, tone: string): string {
  const spec = OPTIMIZE_SPECS[inputType]
  return `Bạn là trợ lý biên tập nội dung thiệp cưới tiếng Việt. Nhiệm vụ: VIẾT LẠI đoạn dưới đây cho hay hơn — sinh động, giàu cảm xúc, mượt mà hơn — nhưng GIỮ ĐÚNG ý gốc của người dùng.

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
const GEN_CFG_INVITATION = {
  temperature: 0.9,
  responseMimeType: 'application/json',
  responseSchema: RESPONSE_SCHEMA,
  thinkingConfig: THINK_LOW,
  // Nới trần token: tránh JSON bị cắt ngang khiến block cuối (slogan) bị mất.
  maxOutputTokens: 65536,
}
// Dữ liệu mẫu (admin): thuần sáng tác, không phải trích xuất → tắt thinking.
const GEN_CFG_SAMPLE = { ...GEN_CFG_INVITATION, thinkingConfig: THINK_OFF }
const GEN_CFG_TEXT = { temperature: 0.9, maxOutputTokens: 2048, thinkingConfig: THINK_OFF }
const GEN_CFG_LOVE = {
  temperature: 0.9,
  responseMimeType: 'application/json',
  responseSchema: LOVE_ITEM_SCHEMA,
  thinkingConfig: THINK_OFF,
  maxOutputTokens: 16384,
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

// Scanner tách các object top-level của một mảng JSON đang chảy dần (cho streaming).
// Trả về các object HOÀN CHỈNH mới xuất hiện kể từ vị trí `state.pos`.
interface ScanState { pos: number; started: boolean }
function extractCompleteBlocks(buf: string, state: ScanState): any[] {
  const out: any[] = []
  let i = state.pos
  const n = buf.length

  // Bỏ qua tới dấu '[' đầu tiên
  if (!state.started) {
    while (i < n && buf[i] !== '[') i++
    if (i >= n) { state.pos = i; return out }
    i++ // qua '['
    state.started = true
  }

  while (i < n) {
    // Bỏ khoảng trắng và dấu ',' giữa các object
    while (i < n && (buf[i] === ',' || buf[i] === ' ' || buf[i] === '\n' || buf[i] === '\r' || buf[i] === '\t')) i++
    if (i >= n) break
    if (buf[i] === ']') { i++; break } // hết mảng
    if (buf[i] !== '{') { i++; continue }

    // Tìm '}' đóng của object này (bỏ qua { } trong chuỗi)
    let depth = 0, j = i, inStr = false, esc = false, closed = -1
    for (; j < n; j++) {
      const c = buf[j]
      if (inStr) {
        if (esc) esc = false
        else if (c === '\\') esc = true
        else if (c === '"') inStr = false
      } else {
        if (c === '"') inStr = true
        else if (c === '{') depth++
        else if (c === '}') { depth--; if (depth === 0) { closed = j; break } }
      }
    }
    if (closed === -1) break // object chưa hoàn chỉnh → chờ thêm dữ liệu
    const objStr = buf.slice(i, closed + 1)
    try { out.push(JSON.parse(objStr)) } catch { /* bỏ block hỏng */ }
    i = closed + 1
  }
  state.pos = i
  return out
}

// ── Rate limit ───────────────────────────────────────────────────────────────
async function checkAndBumpUsage(
  admin: ReturnType<typeof createClient>,
  userId: string,
): Promise<boolean> {
  const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD

  const { data } = await admin
    .from('ai_usage')
    .select('count')
    .eq('user_id', userId)
    .eq('day', today)
    .maybeSingle()

  const current = (data?.count as number) ?? 0
  if (current >= DAILY_LIMIT) return false

  await admin
    .from('ai_usage')
    .upsert({ user_id: userId, day: today, count: current + 1 }, { onConflict: 'user_id,day' })

  return true
}

// Rate-limit cho khách chưa đăng nhập: đếm theo IP/ngày (bảng ai_usage_ip).
async function checkAndBumpUsageIp(
  admin: ReturnType<typeof createClient>,
  ip: string,
): Promise<boolean> {
  const today = new Date().toISOString().slice(0, 10)

  const { data } = await admin
    .from('ai_usage_ip')
    .select('count')
    .eq('ip', ip)
    .eq('day', today)
    .maybeSingle()

  const current = (data?.count as number) ?? 0
  if (current >= ANON_DAILY_LIMIT) return false

  await admin
    .from('ai_usage_ip')
    .upsert({ ip, day: today, count: current + 1 }, { onConflict: 'ip,day' })

  return true
}

// Lấy IP thật của client (Supabase đặt sau proxy → đọc x-forwarded-for).
function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for') ?? ''
  const first = fwd.split(',')[0].trim()
  return first || req.headers.get('x-real-ip') || 'unknown'
}

// HÀM CHUNG: bump + kiểm hạn mức (theo user nếu đăng nhập, ngược lại theo IP).
// Trả null nếu còn lượt; trả Response 429 nếu đã hết (để handler return luôn).
async function enforceRateLimit(
  req: Request,
  admin: ReturnType<typeof createClient>,
  user: { id: string } | null,
  origin: string | null,
): Promise<Response | null> {
  const allowed = user
    ? await checkAndBumpUsage(admin, user.id)
    : await checkAndBumpUsageIp(admin, clientIp(req))
  if (allowed) return null
  const limit = user ? DAILY_LIMIT : ANON_DAILY_LIMIT
  return json(
    { error: `Bạn đã dùng hết ${limit} lượt AI hôm nay. Vui lòng thử lại vào ngày mai${user ? '' : ' hoặc đăng nhập để có thêm lượt'}.` },
    429,
    origin,
  )
}

// ── Streaming (block-by-block) ───────────────────────────────────────────────
async function callGeminiStreamRaw(prompt: string, apiKey: string, signal: AbortSignal): Promise<Response> {
  const res = await fetch(
    `${GEMINI_BASE}/${GEMINI_MODEL}:streamGenerateContent?alt=sse&key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: GEN_CFG_INVITATION,
      }),
    },
  )
  if (!res.ok) throw new ProviderError('gemini', res.status, await readErrorDetail(res))
  if (!res.body) throw new ProviderError('gemini', res.status, 'stream không có body')
  return res
}

// Trả Response NDJSON: mỗi dòng {block} là 1 block SẠCH (đã validate/clamp server-side);
// kết thúc bằng {meta:{done,provider}} hoặc {meta:{error}}. Chưa emit được block
// nào thì thử lại MỘT lượt non-stream.
function buildStreamResponse(
  prompt: string,
  geminiKeys: string[],
  origin: string | null,
  tone: string,
  log: Logger,
): Response {
  const enc = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (o: unknown) => controller.enqueue(enc.encode(JSON.stringify(o) + '\n'))
      let emitted = 0
      let provider = ''
      const scan: ScanState = { pos: 0, started: false }
      let acc = ''
      // finishReason (MAX_TOKENS, SAFETY…) chỉ có trong gói SSE — bắt lại để biết
      // vì sao mảng block đứt giữa chừng.
      let finishReason = ''
      // Tên cặp đôi nhặt dần từ các block "field" để lọc tên khỏi chuyện tình.
      const names = { groom: '', bride: '' }
      const weTerm = weTermFor(tone)

      const startIdx = geminiKeys.length ? Math.floor(Math.random() * geminiKeys.length) : 0
      for (let k = 0; k < geminiKeys.length; k++) {
        const key = geminiKeys[(startIdx + k) % geminiKeys.length]
        const t = withTimeout(REQ_TIMEOUT_MS)
        try {
          const res = await callGeminiStreamRaw(prompt, key, t.signal)
          provider = 'gemini'
          const reader = res.body!.getReader()
          const dec = new TextDecoder()
          let sse = ''
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            sse += dec.decode(value, { stream: true })
            let nl: number
            while ((nl = sse.indexOf('\n')) !== -1) {
              const line = sse.slice(0, nl).trim()
              sse = sse.slice(nl + 1)
              if (!line.startsWith('data:')) continue
              const payload = line.slice(5).trim()
              if (!payload || payload === '[DONE]') continue
              try {
                const j = JSON.parse(payload)
                const cand = j?.candidates?.[0]
                if (cand?.finishReason) finishReason = String(cand.finishReason)
                const chunk = (cand?.content?.parts ?? [])
                  .map((p: { text?: string }) => p?.text ?? '')
                  .join('')
                if (chunk) {
                  acc += chunk
                  for (const raw of extractCompleteBlocks(acc, scan)) {
                    const cb = cleanBlock(raw)
                    if (!cb) continue
                    // Prompt bắt xuất block "field" TRƯỚC block "love" nên tới
                    // lúc lọc chuyện tình là đã biết tên cặp đôi.
                    if (cb.type === 'field' && cb.key === 'groom_name') names.groom = String(cb.value)
                    if (cb.type === 'field' && cb.key === 'bride_name') names.bride = String(cb.value)
                    send({ block: scrubLoveBlock(cb, names, weTerm) })
                    emitted++
                  }
                }
              } catch { /* sse json chưa đủ, bỏ qua */ }
            }
          }
          t.clear()
          break // đã stream xong với key này
        } catch (e) {
          t.clear()
          log.warn('invitation.gemini_stream_failed', {
            key_index: (startIdx + k) % geminiKeys.length,
            keys_total: geminiKeys.length,
            blocks_so_far: emitted,
            finish_reason: finishReason || undefined,
            ...errFields(e),
          })
          if (emitted > 0) break // đã emit dở → không xoay key/không fallback
        }
      }

      // CHƯA emit được block nào → thử lại một lượt non-stream (xoay vòng key).
      // Stream đứt sớm thường là trục trặc nhất thời, gọi lại là qua.
      if (emitted === 0) {
        const res = await generateWithGemini(prompt, { gemini: GEN_CFG_INVITATION }, log, 'invitation')
        if (res) {
          try {
            send({ full: parseAndClamp(res.raw, tone) })
            provider = res.provider
            emitted = 1
          } catch (e) {
            log.warn('invitation.retry_parse_failed', errFields(e))
          }
        }
      }

      if (emitted === 0) {
        log.error('invitation.stream_failed', {
          chars: acc.length,
          finish_reason: finishReason || undefined,
          keys_total: geminiKeys.length,
        })
        send({ meta: { error: 'Dịch vụ AI đang bận, vui lòng thử lại sau ít phút.' } })
      } else {
        log.info('invitation.stream_done', {
          provider,
          blocks: emitted,
          chars: acc.length,
          finish_reason: finishReason || undefined,
        })
        send({ meta: { done: true, provider } })
      }

      await log.flush()
      controller.close()
    },
  })

  return new Response(stream, {
    status: 200,
    headers: {
      ...corsHeaders(origin),
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-cache',
    },
  })
}

// ── Nhánh "Tối ưu" (làm giàu 1 ô văn bản) ────────────────────────────────────
// Dùng chung xác thực/rate-limit/CORS với luồng sinh thiệp. Nhận { inputType, text,
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

  const limited = await enforceRateLimit(req, admin, user, origin)
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

  const limited = await enforceRateLimit(req, admin, user, origin)
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
  const limited = await enforceRateLimit(req, admin, user, origin)
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

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

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

  const input = sanitizeInput(body)
  if (!input) return json({ error: 'Vui lòng nhập thông tin cô dâu, chú rể' }, 400, origin)

  // 3) Rate limit (hàm chung: theo user nếu đăng nhập, ngược lại theo IP).
  const limited = await enforceRateLimit(req, admin, user, origin)
  if (limited) return limited

  const prompt = buildPrompt(input)

  // 3.5) Streaming: client gửi { stream: true } và có key Gemini → trả NDJSON từng block.
  if (body.stream === true && getGeminiKeys().length) {
    return buildStreamResponse(prompt, getGeminiKeys(), origin, input.tone, log)
  }

  // 4) Gọi AI non-stream qua hàm chung (Gemini, xoay vòng key).
  const res = await generateWithGemini(
    prompt,
    { gemini: GEN_CFG_INVITATION },
    log,
    'generate',
  )
  if (!res) {
    log.error('ai.all_providers_failed', {
      gemini_keys: getGeminiKeys().length,

    })
    return json({ error: 'Dịch vụ AI đang bận, vui lòng thử lại sau ít phút.' }, 503, origin)
  }

  // 5) Chuẩn hoá + clamp output
  let result: Record<string, unknown>
  try {
    result = parseAndClamp(res.raw, input.tone)
  } catch (e) {
    log.error('ai.parse_failed', {
      error: errMsg(e),
      raw_snippet: String(res.raw).slice(0, 500),
    })
    return json({ error: 'AI trả về không hợp lệ, vui lòng thử lại.' }, 502, origin)
  }

  if (!result.story_quote && (result.love_story as unknown[]).length === 0) {
    return json({ error: 'AI chưa tạo được nội dung, vui lòng thử lại.' }, 502, origin)
  }

  log.info('ai.generated', { provider: res.provider, anon: !user })
  return json({ data: result, provider: res.provider }, 200, origin)
}))
