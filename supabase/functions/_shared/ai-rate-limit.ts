// Hạn mức dùng AI theo NGÀY, dùng chung cho MỌI luồng AI (ai-chat, ai-invitation).
// Một bảng duy nhất `ai_chat_usage`; mỗi tính năng vẫn có số đếm RIÊNG nhờ tiền tố
// tính năng trong `subject` — sửa cách đếm thì sửa đúng một chỗ.
//
// Khách chưa đăng nhập bị đếm trên HAI chiều cùng lúc (IP + mã thiết bị), chiều
// nào chạm trần cũng chặn: muốn thêm lượt phải đổi CẢ hai. Lớp này chỉ cản người
// dùng thường đổi VPN/wifi, KHÔNG cản được script — xem docs/PLAN-ai-chat-abuse.md
// (race check-rồi-upsert cũng còn nguyên ở đó).

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { json } from './ai-provider.ts'

// Bảng đếm DUY NHẤT cho mọi luồng AI (tên giữ theo lịch sử) — xem
// changelogs/RC01/schema/dqvinh_007_ai_usage.sql.
const USAGE_TABLE = 'ai_chat_usage'

// Tiền tố tính năng, đứng đầu `subject`. Nhờ nó mà một bảng vẫn giữ được hạn mức
// riêng: lượt chat không ăn vào lượt của nút "Tối ưu" và ngược lại. Thêm luồng AI
// mới thì thêm một giá trị ở đây, KHÔNG thêm bảng.
export type AiFeature = 'chat' | 'inv'

export function clientIp(req: Request): string {
  // Cloudflare/Supabase đặt cf-connecting-ip từ kết nối THẬT, client không giả
  // được. Với x-forwarded-for phải lấy phần tử CUỐI (do proxy của mình nối vào);
  // lấy phần tử ĐẦU là lấy đúng giá trị client tự gửi → bypass rate limit sạch sẽ
  // (docs/security-checklist.md A10).
  const cf = req.headers.get('cf-connecting-ip')
  if (cf) return cf.trim()
  const fwd = req.headers.get('x-forwarded-for') ?? ''
  const parts = fwd.split(',').map((p) => p.trim()).filter(Boolean)
  if (parts.length) return parts[parts.length - 1]
  return req.headers.get('x-real-ip') || 'unknown'
}

// Mã thiết bị do client sinh và giữ trong localStorage (core/helpers/device-id.js).
// KHÔNG phải danh tính: client giả được, nên một mình nó không chặn được ai —
// giá trị của nó là buộc kẻ bypass phải đổi thêm một chiều nữa ngoài IP.
export function sanitizeDevice(v: unknown): string {
  const s = typeof v === 'string' ? v.trim().toLowerCase() : ''
  return /^[a-z0-9-]{8,64}$/.test(s) ? s : ''
}

export interface RateLimitOpts {
  feature: AiFeature
  user: { id: string } | null
  device: string
  limit: number     // hạn mức của tài khoản ĐÃ đăng nhập
  anonLimit: number // hạn mức của khách chưa đăng nhập
  origin: string | null
}

// Trả null nếu còn lượt (và đã ghi nhận lượt này); trả Response 429 nếu đã hết.
export async function enforceRateLimit(
  req: Request,
  admin: SupabaseClient,
  o: RateLimitOpts,
): Promise<Response | null> {
  const f = o.feature
  const subjects = o.user
    ? [`${f}:u:${o.user.id}`]
    : [`${f}:ip:${clientIp(req)}`, ...(o.device ? [`${f}:dev:${o.device}`] : [])]
  const limit = o.user ? o.limit : o.anonLimit
  const today = new Date().toISOString().slice(0, 10)

  const { data } = await admin
    .from(USAGE_TABLE)
    .select('subject, count')
    .in('subject', subjects)
    .eq('day', today)

  const counts = new Map<string, number>(
    ((data ?? []) as Array<{ subject: string; count: number }>)
      .map((r) => [r.subject, r.count ?? 0]),
  )

  if (subjects.some((s) => (counts.get(s) ?? 0) >= limit)) {
    return json(
      {
        error: o.user
          ? `Bạn đã dùng hết ${limit} lượt AI hôm nay rồi. Bạn quay lại vào ngày mai nhé.`
          : `Bạn đã dùng hết ${limit} lượt AI hôm nay rồi. Vui lòng đăng nhập để tiếp tục sử dụng.`,
        // Cờ cho client biết dựng chữ "đăng nhập" bấm được. Hạn mức của tài khoản
        // KHÔNG nói ra ở đây — đó là con số chỉ người đã đăng nhập mới cần biết.
        ...(o.user ? {} : { login: true }),
      },
      429,
      o.origin,
    )
  }

  await admin
    .from(USAGE_TABLE)
    .upsert(
      subjects.map((s) => ({ subject: s, day: today, count: (counts.get(s) ?? 0) + 1 })),
      { onConflict: 'subject,day' },
    )

  return null
}
