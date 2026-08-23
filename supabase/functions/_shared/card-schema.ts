// Hợp đồng DỮ LIỆU của một tấm thiệp do AI sinh ra — dùng chung cho ai-invitation
// (bảng "Tạo bằng AI" ở trang thiết lập) và ai-chat (trợ lý ở trang chủ).
//
// Chứa: whitelist field + độ dài, nhãn văn phong/vùng miền, luật xưng hô cho
// chuyện tình, và toàn bộ tầng validate/clamp output. Prompt của từng tính năng
// vẫn nằm ở function của nó — ở đây chỉ có thứ mà HAI bên phải hiểu giống nhau,
// nếu không client sẽ nhận hai dạng dữ liệu khác nhau cho cùng một cái form.

export const MAX_LOVE_ITEMS = 10 // khớp core/config.js → maxLoveStoryItems
export const MAX_TIMELINE = 10
export const MAX_TEXT_LEN = 600 // giới hạn mỗi trường text AI trả về

// Whitelist field AI được phép điền + độ dài tối đa (chống bơm khoá lạ vào form).
// KHÔNG có: ảnh, *_map_embed_url, music_url (AI không tự sinh được/không nên bịa).
export const FIELD_SPECS: Record<string, number> = {
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

// Danh sách khoá cho prompt (kèm vu_quy_enabled — cờ boolean, không nằm trong
// FIELD_SPECS vì nó không phải chuỗi có độ dài).
export const FIELD_KEYS_TEXT = [...Object.keys(FIELD_SPECS), 'vu_quy_enabled'].join(', ')

export const VALID_TONES = [
  'romantic', 'traditional', 'humorous', 'poetic', 'modern', 'luxury', 'cute', 'vintage',
]
export const VALID_REGIONS = ['bac', 'trung', 'nam']
export const VALID_TIMELINE_KIND = new Set(['ceremony', 'party', 'bride-party'])

export const TONE_LABEL: Record<string, string> = {
  romantic: 'lãng mạn, sâu lắng, giàu cảm xúc',
  traditional: 'truyền thống, trang trọng, ấm áp',
  humorous: 'nhẹ nhàng, dí dỏm, tươi vui',
  poetic: 'thơ mộng, bay bổng, giàu hình ảnh và nhịp điệu',
  modern: 'hiện đại, tối giản, tinh tế, câu chữ ngắn gọn',
  luxury: 'sang trọng, lịch lãm, đẳng cấp, trau chuốt',
  cute: 'dễ thương, đáng yêu, trẻ trung, tinh nghịch',
  vintage: 'cổ điển, hoài niệm, nhẹ nhàng hoài cổ',
}

export const REGION_LABEL: Record<string, string> = {
  bac: 'miền Bắc (dùng "Lễ Thành Hôn"/"Lễ Vu Quy", cách xưng hô và văn phong kiểu Bắc)',
  trung: 'miền Trung (văn phong, cách xưng hô kiểu Trung)',
  nam: 'miền Nam (dùng "Lễ Tân Hôn"/"Lễ Vu Quy", cách xưng hô và văn phong kiểu Nam)',
}

// Xưng hô trong "Câu chuyện tình yêu" — dùng CHUNG cho mọi nhánh sinh chuyện
// tình (thiệp thật, tối ưu từng mốc, dữ liệu mẫu, trợ lý chat). Chuyện tình là
// lời CHÍNH cặp đôi tự kể; gọi tên riêng nghe như người ngoài kể chuyện về họ.
export const LOVE_VOICE_RULE =
  'XƯNG HÔ (BẮT BUỘC): viết ở NGÔI THỨ NHẤT số nhiều — "chúng mình", "chúng tôi", "hai đứa", "tụi mình" (chọn ngôi hợp văn phong: trang trọng dùng "chúng tôi", gần gũi dùng "chúng mình"/"hai đứa"); khi nói riêng về một người thì dùng "anh"/"em". TUYỆT ĐỐI KHÔNG gọi cô dâu/chú rể bằng TÊN RIÊNG trong "title" lẫn "content", kể cả tên đã rút gọn. Viết "Chúng mình gặp nhau lần đầu…" chứ KHÔNG viết "Quang Vinh và Hải Yến gặp nhau…".'

// ── Chuẩn hoá chuỗi ─────────────────────────────────────────────────────────

export function clampStr(v: unknown, max: number): string {
  return String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max)
}

// Giữ xuống dòng (giúp AI đọc dữ liệu dạng gạch đầu dòng), chỉ gộp khoảng trắng ngang.
export function clampText(v: unknown, max: number): string {
  return String(v ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, max)
}

export function pickTone(v: unknown): string {
  return VALID_TONES.includes(String(v)) ? String(v) : 'romantic'
}

export function pickRegion(v: unknown): string {
  return VALID_REGIONS.includes(String(v)) ? String(v) : ''
}

// ── Validate + clamp output ─────────────────────────────────────────────────

export type CleanBlock =
  | { type: 'text'; key: string; value: string }
  | { type: 'field'; key: string; value: string | boolean }
  | { type: 'love'; date: string; title: string; content: string }
  | { type: 'timeline'; time: string; title: string; kind: string }

// Validate + clamp MỘT block thô từ model → block sạch, hoặc null nếu bỏ.
export function cleanBlock(raw: any): CleanBlock | null {
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
    // Chỉ cần có title là giữ lại. KHÔNG loại mốc chỉ vì thiếu content — thà hiện
    // mốc với tiêu đề còn hơn mất trắng cả chuyện tình. Mốc rỗng hoàn toàn mới bỏ.
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

// ── Lưới chặn tên riêng trong chuyện tình ───────────────────────────────────
// Prompt đã cấm gọi tên (LOVE_VOICE_RULE) nhưng model vẫn có thể lỡ → chặn thêm ở
// output: đổi tên đã biết thành đại từ. Chỉ động vào block "love"; lời mời / lời
// cảm ơn vẫn được nhắc tên.
const NAME_CHAR = '[\\p{L}\\p{M}\\d]'

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Viết hoa lại nếu chỗ thay nằm đầu câu.
function replaceWithPronoun(text: string, pattern: string, pronoun: string): string {
  const re = new RegExp(`(?<!${NAME_CHAR})(?:${pattern})(?!${NAME_CHAR})`, 'giu')
  return text.replace(re, (_m: string, ...args: unknown[]) => {
    const offset = args[args.length - 2] as number
    const whole = args[args.length - 1] as string
    const before = whole.slice(0, offset).replace(/\s+$/, '')
    const atStart = before === '' || /[.!?…:;"“”(]$/.test(before)
    return atStart ? pronoun.charAt(0).toUpperCase() + pronoun.slice(1) : pronoun
  })
}

export function stripCoupleNames(
  text: string,
  groom: string,
  bride: string,
  weTerm: string,
): string {
  if (!text) return text
  let out = text
  const g = groom.trim()
  const b = bride.trim()

  // "A và B" (hai chiều, kể cả nối bằng & hoặc dấu phẩy) → "chúng mình".
  if (g && b) {
    const join = '\\s*(?:và|&|,)\\s*'
    out = replaceWithPronoun(out, `${escapeRe(g)}${join}${escapeRe(b)}`, weTerm)
    out = replaceWithPronoun(out, `${escapeRe(b)}${join}${escapeRe(g)}`, weTerm)
  }
  if (g) out = replaceWithPronoun(out, escapeRe(g), 'anh')
  if (b) out = replaceWithPronoun(out, escapeRe(b), 'em')
  return out
}

// Văn phong trang trọng thì "chúng tôi", còn lại "chúng mình".
export function weTermFor(tone: string): string {
  return tone === 'traditional' || tone === 'luxury' ? 'chúng tôi' : 'chúng mình'
}

export function scrubLoveBlock(
  b: CleanBlock,
  names: { groom: string; bride: string },
  weTerm: string,
): CleanBlock {
  if (b.type !== 'love' || (!names.groom && !names.bride)) return b
  return {
    ...b,
    title: stripCoupleNames(b.title, names.groom, names.bride, weTerm),
    content: stripCoupleNames(b.content, names.groom, names.bride, weTerm),
  }
}

// Gom danh sách block sạch → cấu trúc client dùng { story_quote, love_story, timeline, fields }
export function assembleBlocks(blocks: CleanBlock[]): Record<string, unknown> {
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

// Object dạng {story_quote, love_story, timeline, fields} → mảng block thô, để
// tái dùng cleanBlock/assembleBlocks. Dùng cho ai-chat (model trả thẳng object
// thay vì mảng block) và cho đường non-stream của ai-invitation.
export function objectToRawBlocks(obj: Record<string, any>): any[] {
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

// Danh sách block thô → thiệp sạch. Biết tên cô dâu/chú rể (chính model vừa trả)
// nên gỡ luôn tên lọt vào chuyện tình.
export function cleanBlocks(rawBlocks: any[], tone: string): Record<string, unknown> {
  const blocks = rawBlocks.map(cleanBlock).filter(Boolean) as CleanBlock[]
  const fields = blocks.filter((b) => b.type === 'field') as Extract<
    CleanBlock,
    { type: 'field' }
  >[]
  const names = {
    groom: String(fields.find((f) => f.key === 'groom_name')?.value ?? ''),
    bride: String(fields.find((f) => f.key === 'bride_name')?.value ?? ''),
  }
  const weTerm = weTermFor(tone)
  return assembleBlocks(blocks.map((b) => scrubLoveBlock(b, names, weTerm)))
}

// Object thô từ model → thiệp sạch. Đường vào của ai-chat.
export function cleanCardObject(obj: Record<string, any>, tone: string): Record<string, unknown> {
  return cleanBlocks(objectToRawBlocks(obj), tone)
}
