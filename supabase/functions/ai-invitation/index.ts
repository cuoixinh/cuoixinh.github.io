// ai-invitation — sinh nội dung thiệp cưới bằng AI (Gemini chính, Groq fallback).
//
// Bảo mật:
//   • KHÔNG bắt buộc đăng nhập. Nếu có JWT hợp lệ → rate-limit theo user/ngày
//     (bảng ai_usage). Nếu không → rate-limit theo IP/ngày (bảng ai_usage_ip),
//     hạn mức thấp hơn để chống lạm dụng.
//   • Validate + clamp input (chống prompt quá dài / lạm dụng token).
//   • Validate + clamp output trước khi trả về.
//   • API key AI chỉ nằm trong secret của Edge Function, không lộ ra client.
//   • CORS allowlist (phản chiếu origin hợp lệ).
//   • Timeout khi gọi nhà cung cấp AI.
//   • Không rò rỉ lỗi chi tiết của provider ra client.
//
// ⚠️ Deploy KÈM cờ --no-verify-jwt để khách chưa đăng nhập vẫn gọi được
//    (việc xác thực/tuỳ chọn đã xử lý bên trong hàm).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { withAxiom, type Logger } from '../_shared/axiom.ts'

// ── Cấu hình ────────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
  'https://cuoixinh.com',
  'https://www.cuoixinh.com',
  'https://cuoixinh.github.io',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://localhost:3000',
  'https://urban-train-4j44q69x76vv3jv99-5500.app.github.dev'
]

const DAILY_LIMIT      = 15      // số lần gọi AI tối đa / user đã đăng nhập / ngày
const ANON_DAILY_LIMIT = 5       // số lần gọi AI tối đa / IP (khách chưa đăng nhập) / ngày
const REQ_TIMEOUT_MS   = 25000   // timeout mỗi lần gọi provider
const MAX_STORY_LOVE_LEN = 1500  // textarea "chuyện tình" (nguyên văn, khớp maxlength client)
const MAX_INFO_LEN     = 2500    // textarea "thông tin cá nhân" (dump tự do)
const MAX_LOVE_ITEMS   = 10     // khớp core/config.js → maxLoveStoryItems (cap cứng khi áp vào thiệp)
const MAX_TIMELINE     = 10
const MAX_TEXT_LEN     = 600     // giới hạn mỗi trường text AI trả về
const MAX_OPTIMIZE_IN  = 800     // độ dài tối đa văn bản đầu vào cho nút "Tối ưu"

// Whitelist field AI được phép điền + độ dài tối đa (an toàn, chống bơm khoá lạ).
// KHÔNG có: ảnh, *_map_embed_url, music_url (AI không tự sinh được/không nên bịa).
const FIELD_SPECS: Record<string, number> = {
  groom_name: 60, bride_name: 60,
  ceremony_name: 60, ceremony_date: 20, ceremony_time: 10, ceremony_location: 200,
  vu_quy_time: 10, vu_quy_location: 200,
  groom_father: 60, groom_mother: 60, groom_address: 200,
  bride_father: 60, bride_mother: 60, bride_address: 200,
  groom_party_date: 20, groom_party_time: 10, groom_party_location: 200,
  bride_party_date: 20, bride_party_time: 10, bride_party_location: 200,
  rsvp_message: 400, footer_text: 300,
  groom_bank_name: 60, groom_bank_number: 40, groom_bank_owner: 60,
  bride_bank_name: 60, bride_bank_number: 40, bride_bank_owner: 60,
}
const VALID_TONES      = ['romantic', 'traditional', 'humorous', 'poetic', 'modern', 'luxury', 'cute', 'vintage']

const GEMINI_MODEL = 'gemini-2.5-flash'
const GROQ_MODEL   = 'llama-3.3-70b-versatile'

// ── CORS ─────────────────────────────────────────────────────────────────────
// Cho phép: origin nằm trong allowlist, hoặc bất kỳ localhost/127.0.0.1 (mọi cổng, để dev).
function isAllowedOrigin(origin: string): boolean {
  if (ALLOWED_ORIGINS.includes(origin)) return true
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
}

function corsHeaders(origin: string | null) {
  const allow = origin && isAllowedOrigin(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
}

function json(data: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
  })
}

// ── Chuẩn hoá input ──────────────────────────────────────────────────────────
function clampStr(v: unknown, max: number): string {
  return String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max)
}

// Giữ xuống dòng (giúp AI đọc info dạng gạch đầu dòng), chỉ gộp khoảng trắng ngang.
function clampText(v: unknown, max: number): string {
  return String(v ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, max)
}

const VALID_REGIONS = ['bac', 'trung', 'nam']

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

  const tone = VALID_TONES.includes(String(raw.tone)) ? String(raw.tone) : 'romantic'

  // Chuyện tình: text nguyên văn (giữ xuống dòng để AI đọc mạch kể). Backward-compat:
  // nếu client cũ còn gửi mảng "bullets" thì gộp lại thành text.
  const rawStory = raw.story_love != null
    ? raw.story_love
    : (Array.isArray(raw.bullets) ? (raw.bullets as unknown[]).join('\n') : '')
  const story_love = clampText(rawStory, MAX_STORY_LOVE_LEN)

  const region = VALID_REGIONS.includes(String(raw.region)) ? String(raw.region) : ''

  return { tone, story_love, info, region }
}

// ── Prompt ───────────────────────────────────────────────────────────────────
const TONE_LABEL: Record<string, string> = {
  romantic: 'lãng mạn, sâu lắng, giàu cảm xúc',
  traditional: 'truyền thống, trang trọng, ấm áp',
  humorous: 'nhẹ nhàng, dí dỏm, tươi vui',
  poetic: 'thơ mộng, bay bổng, giàu hình ảnh và nhịp điệu',
  modern: 'hiện đại, tối giản, tinh tế, câu chữ ngắn gọn',
  luxury: 'sang trọng, lịch lãm, đẳng cấp, trau chuốt',
  cute: 'dễ thương, đáng yêu, trẻ trung, tinh nghịch',
  vintage: 'cổ điển, hoài niệm, nhẹ nhàng hoài cổ',
}

const REGION_LABEL: Record<string, string> = {
  bac: 'miền Bắc (dùng "Lễ Thành Hôn"/"Lễ Vu Quy", cách xưng hô và văn phong kiểu Bắc)',
  trung: 'miền Trung (văn phong, cách xưng hô kiểu Trung)',
  nam: 'miền Nam (dùng "Lễ Tân Hôn"/"Lễ Vu Quy", cách xưng hô và văn phong kiểu Nam)',
}

function buildPrompt(inp: CardInput): string {
  const storyLoveText = inp.story_love || '(không có)'

  return `Bạn là trợ lý tạo thiệp cưới tiếng Việt. Bạn làm HAI việc:
(A) TRÍCH XUẤT thông tin có thật từ dữ liệu người dùng nhập vào các trường tương ứng.
(B) SÁNG TẠO một số đoạn văn (slogan, chuyện tình, lịch trình, lời mời, lời cảm ơn).

TỰ XÁC ĐỊNH từ khối THÔNG TIN CÁ NHÂN bên dưới: ai là chú rể, ai là cô dâu (họ tên đầy đủ), ngày cưới và giờ cưới. Nếu người dùng không ghi rõ mục nào thì bỏ qua mục đó, KHÔNG bịa.
Văn phong: ${TONE_LABEL[inp.tone]}.${inp.region ? `\nPhong cách vùng miền: ${REGION_LABEL[inp.region]}.` : ''}

Chuyện tình người dùng kể (NGUYÊN VĂN người dùng nhập, có thể viết TỰ DO/liền mạch, không theo gạch đầu dòng — bạn tự đọc hiểu & tách mốc theo mục 7):
"""
${storyLoveText}
"""

THÔNG TIN CÁ NHÂN người dùng cung cấp (tự do, có thể gồm giờ giấc, địa điểm, cha mẹ hai bên, số tài khoản...):
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
7. Chuyện tình yêu (block "love") — ĐÂY LÀ PHẦN QUAN TRỌNG, đọc kỹ:
   • BẮT BUỘC TẠO khi: phần "Chuyện tình người dùng kể" CÓ nội dung. Khi đó bạn PHẢI xuất các block "love" RIÊNG BIỆT — TUYỆT ĐỐI KHÔNG được bỏ qua, KHÔNG được thay thế bằng cách nhét chuyện tình vào story_quote/rsvp_message. Người dùng có kể chuyện tình mà bạn không xuất block love là SAI NGHIÊM TRỌNG.
   • CHỈ KHÔNG tạo khi: người dùng KHÔNG kể gì — khi đó bỏ qua hoàn toàn, không tự bịa.
   • SỐ MỐC: = số SỰ KIỆN/khoảnh khắc bạn TỰ nhận diện theo NGỮ NGHĨA (KHÔNG phải số dòng văn bản). Luôn kẹp tối đa ${MAX_LOVE_ITEMS} mốc.
   • TÁCH Ý: người dùng có thể viết TỰ DO (một đoạn liền mạch, gộp nhiều ý trong một câu, hoặc mỗi ý một dòng) — hãy đọc hiểu rồi TỰ TÁCH/GỘP thành các mốc theo dòng thời gian: một câu chứa nhiều sự kiện thì TÁCH ra nhiều mốc; nhiều câu tả cùng một khoảnh khắc thì GỘP làm một. Giữ ĐÚNG ý & đúng thứ tự, KHÔNG bỏ sót sự kiện nào, KHÔNG thêm sự kiện mới.
   • NỘI DUNG MỖI MỐC: mỗi block love BẮT BUỘC đủ "date" + "title" + "content". Người dùng thường chỉ nêu ý ngắn/năm → bạn PHẢI TỰ LÀM GIÀU: viết "content" 1-2 câu tự nhiên, giàu cảm xúc, cụ thể hoá khoảnh khắc (từ chính ý đó + tên + văn phong; KHÔNG lặp lại suông title, KHÔNG bịa chi tiết nhạy cảm như địa chỉ/tên người lạ). KHÔNG xuất mốc thiếu content.
8. Tên hiển thị trên thiệp — Từ HỌ TÊN ĐẦY ĐỦ chú rể & cô dâu bạn xác định được trong THÔNG TIN, LUÔN tạo ĐỦ 2 block field "groom_name" và "bride_name", rút gọn còn 2 CHỮ để in trên thiệp, KHÔNG dùng nguyên họ tên. Mặc định lấy 2 CHỮ CUỐI (ví dụ "Đoàn Quang Vinh" → "Quang Vinh"; "Trần Thị Bích Ngọc" → "Bích Ngọc"). TUYỆT ĐỐI KHÔNG để chữ đệm "Thị" xuất hiện (thiệp cưới Việt Nam không bao giờ in chữ "Thị"): nếu 2 chữ cuối chứa "Thị" (ví dụ "Nguyễn Thị Anh" → 2 chữ cuối là "Thị Anh"), hãy BỎ "Thị" rồi lấy thêm chữ liền trước cho đủ 2 chữ (→ "Nguyễn Anh"). Nếu họ tên gốc chỉ có 1 chữ thì giữ nguyên. Dùng CHÍNH tên rút gọn này mỗi khi nhắc tới cô dâu/chú rể trong các đoạn SÁNG TẠO ở mục 6.
9. Địa điểm tổ chức lễ khi người dùng KHÔNG ghi rõ — NGOẠI LỆ được suy ra thay vì bỏ trống: ceremony_location (nơi lễ chính / tiệc cưới) mặc định lấy TRÙNG groom_address (địa chỉ nhà trai); vu_quy_location (CHỈ khi vu_quy_enabled=true) mặc định lấy TRÙNG bride_address (địa chỉ nhà gái). Chỉ suy ra khi ĐÃ có địa chỉ nhà tương ứng; không có thì bỏ trống, KHÔNG bịa nơi khác. Riêng địa điểm tiệc nhà trai/nhà gái (groom_party_location, bride_party_location): KHÔNG tự suy — chỉ điền khi người dùng có nói rõ.
10. Lễ Vu Quy (chỉ khi vu_quy_enabled = true): nếu người dùng KHÔNG ghi rõ giờ Vu Quy, hãy tự suy ra — mặc định ngày Vu Quy TRÙNG ngày lễ chính (Thành Hôn/Tân Hôn). Với vu_quy_time: nếu người dùng có cung cấp CẢ địa chỉ nhà trai (groom_address) lẫn nhà gái (bride_address), hãy ƯỚC LƯỢNG thời gian di chuyển bằng Ô TÔ giữa hai địa chỉ, rồi đặt vu_quy_time SỚM hơn giờ lễ chính một khoảng đủ để đoàn nhà trai sang nhà gái làm lễ Vu Quy rồi ĐƯA DÂU quay về kịp giờ lễ chính (khoảng ≈ 2× thời gian di chuyển một chiều [tính cả lượt đi và lượt về] + ~30–45 phút làm lễ, làm tròn về mốc 5/10 phút hợp lý). Nếu KHÔNG đủ dữ liệu địa chỉ để ước lượng, đặt vu_quy_time TRÙNG giờ lễ chính.
11. Slogan (story_quote) — LỜI NGỎ của chú rể dành cho cô dâu (hoặc lời chung của cặp đôi). Viết theo ĐÚNG "công thức" các câu mẫu sẵn của app:
   • CHỈ 1 câu, ngắn gọn súc tích (khoảng 12–24 chữ), tối đa 2 vế; giàu chất thơ, chân thành, ấm áp.
   • TUYỆT ĐỐI KHÔNG chứa TÊN RIÊNG (không nhắc tên cô dâu/chú rể), KHÔNG ngày tháng, KHÔNG địa điểm hay bất kỳ thông tin cá nhân nào — slogan mang tính PHỔ QUÁT về tình yêu/hôn nhân, KHÔNG liên quan tới danh tính cụ thể.
   • Chủ đề xoay quanh: sự đồng hành ("cùng nhau nhìn về một hướng"), lòng biết ơn ("cảm ơn em đã đến bên đời"), khởi đầu một hành trình mới, hai trái tim chung một nhịp, hạnh phúc bình dị mỗi ngày.
   • Xưng hô nhẹ nhàng "anh/em" hoặc không xưng; bám đúng văn phong đã chọn. KHÔNG đặt dấu ngoặc kép trong nội dung slogan.
   Ví dụ đúng phong cách (KHÔNG sao chép nguyên văn, hãy sáng tạo câu mới): "Cảm ơn em đã đến bên đời nhau, cùng nhau viết nên câu chuyện của riêng mình."; "Tình yêu không phải là nhìn nhau, mà là cùng nhau nhìn về một hướng."; "Hạnh phúc là có một người để yêu, một nơi để về và một lý do để tin."
12. CHUẨN HOÁ VIẾT HOA cho TÊN RIÊNG và ĐỊA CHỈ — LUÔN format lại dù người dùng nhập kiểu gì (viết thường, viết hoa hết, thiếu dấu phẩy...), GIỮ NGUYÊN dấu tiếng Việt người dùng nhập, KHÔNG bịa thêm/bớt thông tin:
   • TÊN RIÊNG người (groom_name, bride_name, groom_father, groom_mother, bride_father, bride_mother) và TÊN buổi lễ (ceremony_name): viết HOA CHỮ CÁI ĐẦU mỗi từ (kiểu "Title Case"). Ví dụ: "nguyễn văn an" → "Nguyễn Văn An"; "TRẦN THỊ bình" → "Trần Thị Bình".
   • ĐỊA CHỈ (ceremony_location, vu_quy_location, groom_address, bride_address, groom_party_location, bride_party_location): viết HOA CHỮ CÁI ĐẦU mỗi từ, và NGĂN CÁCH các thành phần (số nhà/đường, phường/xã, quận/huyện, tỉnh/thành) bằng DẤU PHẨY nếu người dùng chưa ngăn cách. Ví dụ: "12 lê lợi p bến nghé q1 tphcm" → "12 Lê Lợi, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh". Giữ nguyên viết tắt phổ biến đúng chuẩn (TP., Q., P., KP., TT.) — chỉ chuẩn hoá viết hoa, KHÔNG đổi nghĩa/không bịa thêm địa danh không có.
   • NGOẠI LỆ: KHÔNG áp dụng Title Case cho chủ tài khoản ngân hàng (*_bank_owner) — mục này theo mục 3 (IN HOA KHÔNG DẤU). Tên rút gọn hiển thị (mục 8) vẫn theo mục 8 rồi mới Title Case.

ĐẦU RA BẮT BUỘC: MỘT MẢNG JSON PHẲNG các "block", KHÔNG lồng nhau, KHÔNG markdown. Mỗi phần tử là một object độc lập theo đúng 1 trong 4 dạng:
- {"type":"text","key":"story_quote","value":"<slogan — lời chú rể dành cho cô dâu, 1 câu ngắn, KHÔNG chứa tên riêng; theo mục 11>"}
- {"type":"love","date":"<MM/YYYY hoặc mô tả ngắn>","title":"<tiêu đề mốc>","content":"<BẮT BUỘC: kể ngắn 1-2 câu về khoảnh khắc/kỷ niệm đó, giàu cảm xúc>"}   // chỉ tạo khi có căn cứ (xem mục 7); tối đa ${MAX_LOVE_ITEMS} block; MỖI block PHẢI có cả title lẫn content
- {"type":"timeline","time":"<HH:MM>","title":"<việc>","kind":"<ceremony|party>"}                    // tối đa ${MAX_TIMELINE} block; kind="ceremony" cho nghi lễ, "party" cho tiệc
- {"type":"field","key":"<tên trường>","value":"<giá trị>"}   // chỉ tạo block khi CÓ dữ liệu thật (trừ ngoại lệ mục 8, 9); không có thì BỎ QUA, đừng tạo block rỗng

Danh sách "key" hợp lệ cho block "field": groom_name, bride_name, ceremony_name, ceremony_date, ceremony_time, ceremony_location, vu_quy_enabled (value "true"/"false"), vu_quy_time, vu_quy_location, groom_father, groom_mother, groom_address, bride_father, bride_mother, bride_address, groom_party_date, groom_party_time, groom_party_location, bride_party_date, bride_party_time, bride_party_location, rsvp_message, footer_text, groom_bank_name, groom_bank_number, groom_bank_owner, bride_bank_name, bride_bank_number, bride_bank_owner.

THỨ TỰ XUẤT BLOCK (QUAN TRỌNG — phải theo ĐÚNG thứ tự này để khớp giao diện hiển thị, xuất dần từng block một): (1) TẤT CẢ các block "field" trước; (2) rồi CÁC BLOCK LOVE (bắt buộc có nếu người dùng kể chuyện tình — xem mục 7); (3) rồi các block "timeline"; (4) CUỐI CÙNG là block "text" story_quote. Trả về DUY NHẤT một mảng JSON theo đúng thứ tự trên.`
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
    guide: 'Nội dung MỘT mốc trong câu chuyện tình yêu: kể lại khoảnh khắc đó thật sinh động, giàu cảm xúc và cụ thể. Khoảng 1–2 câu. KHÔNG bịa chi tiết nhạy cảm (địa chỉ, tên người lạ) không có trong bản gốc.',
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
      title: { type: 'string', description: 'Tiêu đề ngắn cho khoảnh khắc' },
      content: { type: 'string', description: '1-2 câu kể lại sinh động, giàu cảm xúc' },
    },
    required: ['title', 'content'],
  },
}

function buildLoveStoryPrompt(text: string, tone: string): string {
  return `Bạn là trợ lý viết "Câu chuyện tình yêu" cho thiệp cưới tiếng Việt. Người dùng kể TỰ DO câu chuyện của họ (một đoạn liền mạch, có thể gộp nhiều ý trong một câu, hoặc mỗi ý một dòng). Nhiệm vụ: đọc hiểu rồi TÁCH thành các MỐC theo dòng thời gian, mỗi mốc là một object {date, title, content}.

Văn phong: ${TONE_LABEL[tone] ?? TONE_LABEL.romantic}.

QUY TẮC:
- SỐ MỐC = số sự kiện/khoảnh khắc bạn TỰ nhận diện theo NGỮ NGHĨA (KHÔNG phải số dòng). Tối đa ${MAX_LOVE_ITEMS} mốc.
- TÁCH/GỘP: một câu chứa nhiều sự kiện thì tách thành nhiều mốc; nhiều câu tả cùng một khoảnh khắc thì gộp làm một. Giữ ĐÚNG ý & đúng thứ tự thời gian, KHÔNG bỏ sót sự kiện nào, KHÔNG bịa sự kiện mới.
- "date": mốc thời gian ngắn (VD "Mùa xuân 2020", "03/2021", "Hè 2022") nếu suy ra được từ lời kể; không rõ thì để "".
- "title": tiêu đề ngắn gọn cho khoảnh khắc (VD "Lần đầu gặp gỡ", "Ngày cầu hôn").
- "content": BẮT BUỘC 1-2 câu kể lại sinh động, giàu cảm xúc, cụ thể hoá khoảnh khắc đó. KHÔNG lặp lại suông title, KHÔNG bịa chi tiết nhạy cảm (địa chỉ, tên người lạ) không có trong lời kể.
- Tiếng Việt tự nhiên, có dấu đầy đủ.

ĐẦU RA BẮT BUỘC: DUY NHẤT một MẢNG JSON các object {date, title, content} theo thứ tự thời gian, KHÔNG markdown, KHÔNG object bọc ngoài.

Câu chuyện người dùng kể:
"""
${text}
"""`
}

// Schema ép cấu trúc cho Gemini: MẢNG các phần tử theo anyOf (mỗi block 1 dạng riêng).
// Nhờ anyOf, block "love" BẮT BUỘC có title + content (structured output không thể bỏ
// qua content nữa). Wire format vẫn là [{...},{...}] nên scanner streaming đọc từng
// object hoạt động như cũ.
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
    title: { type: 'string', description: 'Tiêu đề mốc' },
    content: { type: 'string', description: 'BẮT BUỘC: 1-2 câu kể/làm giàu về mốc, không được rỗng' },
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
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'

// generationConfig của Gemini theo từng tác vụ.
const GEN_CFG_INVITATION = {
  temperature: 0.9,
  responseMimeType: 'application/json',
  responseSchema: RESPONSE_SCHEMA,
  // Nới trần token: tránh JSON bị cắt ngang khiến block cuối (slogan) bị mất.
  maxOutputTokens: 65536,
}
const GEN_CFG_TEXT = { temperature: 0.9, maxOutputTokens: 2048 }
const GEN_CFG_LOVE = {
  temperature: 0.9,
  responseMimeType: 'application/json',
  responseSchema: LOVE_ITEM_SCHEMA,
  maxOutputTokens: 16384,
}

// System message của Groq (fallback) theo từng tác vụ.
const GROQ_SYS_INVITATION =
  'Bạn trả về DUY NHẤT một object JSON hợp lệ, không markdown, gồm các khoá: story_quote (string), love_story (mảng {date,title,content}), timeline (mảng {time,title,type}), fields (object các trường thông tin thiệp; chỉ điền field người dùng cung cấp, không có thì ""). Tuân thủ mọi quy tắc trong phần hướng dẫn của người dùng.'
const GROQ_SYS_TEXT =
  'Bạn là trợ lý biên tập tiếng Việt. Chỉ trả về DUY NHẤT đoạn văn bản đã tối ưu, KHÔNG giải thích, KHÔNG markdown, KHÔNG bao ngoặc kép.'
const GROQ_SYS_LOVE =
  'Bạn trả về DUY NHẤT một object JSON hợp lệ dạng {"items":[{"date":"","title":"","content":""}, ...]}, không markdown. Tuân thủ mọi quy tắc trong phần hướng dẫn của người dùng.'

// Rút gọn message lỗi cho log. (Kiểu log dùng chung `Logger` từ _shared/axiom.ts.)
function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

// ── Gọi provider ─────────────────────────────────────────────────────────────
function withTimeout(ms: number) {
  const ctrl = new AbortController()
  const id = setTimeout(() => ctrl.abort(), ms)
  return { signal: ctrl.signal, clear: () => clearTimeout(id) }
}

// Đọc danh sách key Gemini để xoay vòng.
// Hỗ trợ cả GEMINI_API_KEYS (nhiều key, phân tách bằng dấu chấm phẩy ";") lẫn GEMINI_API_KEY (1 key).
function getGeminiKeys(): string[] {
  const multi = Deno.env.get('GEMINI_API_KEYS') ?? ''
  const single = Deno.env.get('GEMINI_API_KEY') ?? ''
  const keys = [...multi.split(';'), single]
    .map((k) => k.trim())
    .filter(Boolean)
  return [...new Set(keys)] // loại trùng
}

// Gọi Gemini generateContent với generationConfig tuỳ tác vụ (GEN_CFG_*).
async function callGemini(prompt: string, apiKey: string, genConfig: Record<string, unknown>): Promise<string> {
  const t = withTimeout(REQ_TIMEOUT_MS)
  try {
    const res = await fetch(`${GEMINI_BASE}/${GEMINI_MODEL}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: t.signal,
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: genConfig,
      }),
    })
    if (!res.ok) throw new Error(`gemini ${res.status}`)
    const data = await res.json()
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
    if (!text) throw new Error('gemini empty')
    return text
  } finally {
    t.clear()
  }
}

// Thử lần lượt từng key Gemini; lỗi/hết quota (429) thì xoay sang key kế tiếp.
// Bắt đầu từ vị trí ngẫu nhiên để rải tải giữa các key.
async function callGeminiRotating(prompt: string, keys: string[], genConfig: Record<string, unknown>): Promise<string> {
  const n = keys.length
  const start = Math.floor(Math.random() * n)
  let lastErr: unknown = null
  for (let i = 0; i < n; i++) {
    const key = keys[(start + i) % n]
    try {
      return await callGemini(prompt, key, genConfig)
    } catch (e) {
      lastErr = e
      console.error(`Gemini key #${(start + i) % n} failed:`, errMsg(e))
    }
  }
  throw lastErr ?? new Error('gemini all keys failed')
}

// Gọi Groq (fallback) — system tuỳ tác vụ (GROQ_SYS_*); jsonMode bật response_format json_object.
async function callGroq(prompt: string, apiKey: string, opts: { system: string; jsonMode?: boolean }): Promise<string> {
  const t = withTimeout(REQ_TIMEOUT_MS)
  try {
    const payload: Record<string, unknown> = {
      model: GROQ_MODEL,
      temperature: 0.9,
      messages: [
        { role: 'system', content: opts.system },
        { role: 'user', content: prompt },
      ],
    }
    if (opts.jsonMode) payload.response_format = { type: 'json_object' }
    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      signal: t.signal,
      body: JSON.stringify(payload),
    })
    if (!res.ok) throw new Error(`groq ${res.status}`)
    const data = await res.json()
    const text = data?.choices?.[0]?.message?.content
    if (!text) throw new Error('groq empty')
    return text
  } finally {
    t.clear()
  }
}

// HÀM CHUNG cho MỌI tác vụ non-stream: Gemini (xoay vòng key) → fallback Groq.
// Trả { raw, provider } hoặc null nếu cả hai provider đều hỏng.
async function generateWithFallback(
  prompt: string,
  cfg: { gemini: Record<string, unknown>; groq: { system: string; jsonMode?: boolean } },
  log: Logger,
  tag: string,
): Promise<{ raw: string; provider: string } | null> {
  const keys = getGeminiKeys()
  if (keys.length) {
    try {
      return { raw: await callGeminiRotating(prompt, keys, cfg.gemini), provider: 'gemini' }
    } catch (e) {
      log.warn(`ai.${tag}_gemini_failed`, { error: errMsg(e) })
    }
  }
  const groqKey = Deno.env.get('GROQ_API_KEY')
  if (groqKey) {
    try {
      return { raw: await callGroq(prompt, groqKey, cfg.groq), provider: 'groq' }
    } catch (e) {
      log.warn(`ai.${tag}_groq_failed`, { error: errMsg(e) })
    }
  }
  return null
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
const VALID_TIMELINE_KIND = new Set(['ceremony', 'party', 'bride-party'])

type CleanBlock =
  | { type: 'text'; key: string; value: string }
  | { type: 'field'; key: string; value: string | boolean }
  | { type: 'love'; date: string; title: string; content: string }
  | { type: 'timeline'; time: string; title: string; kind: string }

// Validate + clamp MỘT block thô từ model → block sạch, hoặc null nếu bỏ.
function cleanBlock(raw: any): CleanBlock | null {
  if (!raw || typeof raw !== 'object') return null
  const type = String(raw.type ?? '')

  if (type === 'text') {
    // Hiện chỉ dùng story_quote ở dạng text
    if (String(raw.key ?? '') !== 'story_quote') return null
    const value = clampStr(raw.value, MAX_TEXT_LEN)
    return value ? { type: 'text', key: 'story_quote', value } : null
  }

  if (type === 'love') {
    const date = clampStr(raw.date, 40)
    const title = clampStr(raw.title, 120)
    const content = clampStr(raw.content, MAX_TEXT_LEN)
    // Chỉ cần có title là giữ lại (một mốc hợp lệ). Prompt (mục 7) đã ép AI viết
    // content; nhưng KHÔNG loại mốc chỉ vì lỡ thiếu content — thà hiện mốc với
    // tiêu đề còn hơn mất trắng cả chuyện tình. Mốc rỗng hoàn toàn (không title,
    // không content) mới bỏ.
    return title || content ? { type: 'love', date, title, content } : null
  }

  if (type === 'timeline') {
    const title = clampStr(raw.title, 120)
    if (!title) return null
    const kind = String(raw.kind ?? '')
    return {
      type: 'timeline',
      time: clampStr(raw.time, 20),
      title,
      kind: VALID_TIMELINE_KIND.has(kind) ? kind : 'ceremony',
    }
  }

  if (type === 'field') {
    const key = String(raw.key ?? '')
    if (key === 'vu_quy_enabled') {
      const v = raw.value
      if (v === true || v === 'true') return { type: 'field', key, value: true }
      if (v === false || v === 'false') return { type: 'field', key, value: false }
      return null
    }
    const max = FIELD_SPECS[key]
    if (!max) return null // ngoài whitelist → bỏ
    let v = clampStr(raw.value, max)
    if (!v) return null
    if (key.endsWith('_date') && !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null
    if (key.endsWith('_time')) {
      const m = v.match(/^(\d{1,2}):(\d{2})$/)
      if (!m) return null
      v = `${m[1].padStart(2, '0')}:${m[2]}`
    }
    return { type: 'field', key, value: v }
  }

  return null
}

// Gom danh sách block sạch → cấu trúc cũ { story_quote, love_story, timeline, fields }
function assembleBlocks(blocks: CleanBlock[]): Record<string, unknown> {
  let story_quote = ''
  const love_story: Array<{ date: string; title: string; content: string }> = []
  const timeline: Array<{ time: string; title: string; type: string }> = []
  const fields: Record<string, string | boolean> = {}

  for (const b of blocks) {
    if (b.type === 'text') story_quote = b.value
    else if (b.type === 'love' && love_story.length < MAX_LOVE_ITEMS)
      love_story.push({ date: b.date, title: b.title, content: b.content })
    else if (b.type === 'timeline' && timeline.length < MAX_TIMELINE)
      timeline.push({ time: b.time, title: b.title, type: b.kind })
    else if (b.type === 'field') fields[b.key] = b.value
  }
  return { story_quote, love_story, timeline, fields }
}

// Gom object dạng cũ {story_quote, love_story, timeline, fields} (Groq trả về do
// response_format=json_object) → mảng block thô để tái dùng cleanBlock/assembleBlocks.
function objectToRawBlocks(obj: Record<string, any>): any[] {
  const raw: any[] = []
  if (obj.story_quote) raw.push({ type: 'text', key: 'story_quote', value: obj.story_quote })
  for (const it of Array.isArray(obj.love_story) ? obj.love_story : [])
    raw.push({ type: 'love', date: it?.date, title: it?.title, content: it?.content })
  for (const it of Array.isArray(obj.timeline) ? obj.timeline : [])
    raw.push({ type: 'timeline', time: it?.time, title: it?.title, kind: it?.kind ?? it?.type })
  const f = obj.fields && typeof obj.fields === 'object' ? obj.fields : {}
  for (const [key, value] of Object.entries(f)) raw.push({ type: 'field', key, value })
  return raw
}

// Parse toàn bộ text (đường non-stream): chấp nhận CẢ mảng block (Gemini) LẪN
// object {story_quote, love_story, timeline, fields} (Groq) → clean từng block → gom.
function parseAndClamp(rawText: string): Record<string, unknown> {
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
  const blocks = rawBlocks.map(cleanBlock).filter(Boolean) as CleanBlock[]
  return assembleBlocks(blocks)
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

// Chuẩn hoá tone: chỉ nhận trong VALID_TONES, mặc định 'romantic'.
function pickTone(v: unknown): string {
  return VALID_TONES.includes(String(v)) ? String(v) : 'romantic'
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
  if (!res.ok || !res.body) throw new Error(`gemini stream ${res.status}`)
  return res
}

// Trả Response NDJSON: mỗi dòng {block} là 1 block SẠCH (đã validate/clamp server-side);
// kết thúc bằng {meta:{done,provider}} hoặc {meta:{error}}. Fallback Groq nếu chưa emit block nào.
function buildStreamResponse(
  prompt: string,
  geminiKeys: string[],
  groqKey: string | undefined,
  origin: string | null,
): Response {
  const enc = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (o: unknown) => controller.enqueue(enc.encode(JSON.stringify(o) + '\n'))
      let emitted = 0
      let provider = ''
      const scan: ScanState = { pos: 0, started: false }
      let acc = ''

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
                const chunk = j?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
                if (chunk) {
                  acc += chunk
                  for (const raw of extractCompleteBlocks(acc, scan)) {
                    const cb = cleanBlock(raw)
                    if (cb) { send({ block: cb }); emitted++ }
                  }
                }
              } catch { /* sse json chưa đủ, bỏ qua */ }
            }
          }
          t.clear()
          // [ai-debug] TẠM: xem NGUYÊN VĂN model trả về để soi block love/content.
          // Gỡ sau khi chẩn đoán xong.
          console.error('[ai-debug] gemini stream done. emitted=', emitted,
            'loveInRaw=', (acc.match(/"type"\s*:\s*"love"/g) || []).length,
            'contentInRaw=', (acc.match(/"content"\s*:/g) || []).length)
          console.error('[ai-debug] RAW acc (đầu 3500):', acc.slice(0, 3500))
          break // đã stream xong với key này
        } catch (e) {
          t.clear()
          console.error('gemini stream failed:', e instanceof Error ? e.message : e)
          if (emitted > 0) break // đã emit dở → không xoay key/không fallback
        }
      }

      // Fallback Groq (non-stream) chỉ khi CHƯA emit được block nào
      if (emitted === 0 && groqKey) {
        try {
          const text = await callGroq(prompt, groqKey, { system: GROQ_SYS_INVITATION, jsonMode: true })
          const result = parseAndClamp(text)
          send({ full: result })
          provider = 'groq'
          emitted = 1
        } catch (e) {
          console.error('groq fallback failed:', e instanceof Error ? e.message : e)
        }
      }

      if (emitted === 0) send({ meta: { error: 'Dịch vụ AI đang bận, vui lòng thử lại sau ít phút.' } })
      else send({ meta: { done: true, provider } })
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

  const res = await generateWithFallback(
    buildOptimizePrompt(inputType, text, pickTone(body.tone)),
    { gemini: GEN_CFG_TEXT, groq: { system: GROQ_SYS_TEXT } },
    log,
    'optimize',
  )
  if (!res) return json({ error: 'Dịch vụ AI đang bận, vui lòng thử lại sau ít phút.' }, 503, origin)

  let out = cleanOptimizeOut(res.raw, spec.maxOut)
  if (!spec.multiline) out = out.replace(/\s*\n+\s*/g, ' ').trim()
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

  const res = await generateWithFallback(
    buildLoveStoryPrompt(text, pickTone(body.tone)),
    { gemini: GEN_CFG_LOVE, groq: { system: GROQ_SYS_LOVE, jsonMode: true } },
    log,
    'love',
  )
  if (!res) return json({ error: 'Dịch vụ AI đang bận, vui lòng thử lại sau ít phút.' }, 503, origin)

  const items = cleanLoveItems(res.raw)
  if (!items.length) return json({ error: 'AI chưa tạo được mốc nào, vui lòng thử lại.' }, 502, origin)

  log.info('ai.love_generated', { count: items.length, provider: res.provider, anon: !user })
  return json({ items, provider: res.provider }, 200, origin)
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

  const input = sanitizeInput(body)
  if (!input) return json({ error: 'Vui lòng nhập thông tin cô dâu, chú rể' }, 400, origin)

  // 3) Rate limit (hàm chung: theo user nếu đăng nhập, ngược lại theo IP).
  const limited = await enforceRateLimit(req, admin, user, origin)
  if (limited) return limited

  const prompt = buildPrompt(input)

  // 3.5) Streaming: client gửi { stream: true } và có key Gemini → trả NDJSON từng block.
  if (body.stream === true && getGeminiKeys().length) {
    return buildStreamResponse(prompt, getGeminiKeys(), Deno.env.get('GROQ_API_KEY'), origin)
  }

  // 4) Gọi AI non-stream qua hàm chung (Gemini → Groq fallback).
  const res = await generateWithFallback(
    prompt,
    { gemini: GEN_CFG_INVITATION, groq: { system: GROQ_SYS_INVITATION, jsonMode: true } },
    log,
    'generate',
  )
  if (!res) {
    log.error('ai.all_providers_failed', {
      gemini_keys: getGeminiKeys().length,
      has_groq: Boolean(Deno.env.get('GROQ_API_KEY')),
    })
    return json({ error: 'Dịch vụ AI đang bận, vui lòng thử lại sau ít phút.' }, 503, origin)
  }

  // 5) Chuẩn hoá + clamp output
  let result: Record<string, unknown>
  try {
    result = parseAndClamp(res.raw)
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
