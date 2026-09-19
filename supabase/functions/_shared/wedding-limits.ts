// Trần số thiệp mỗi tài khoản. Nguồn sự thật DUY NHẤT phía server: CẢ HAI đường
// tạo hàng `weddings` (POST ở wedding-admin, upsert ở payment-handler) phải hỏi
// qua đây — sót một chỗ là còn nguyên một đường tạo thiệp không giới hạn.
// Mục đích: chặn một tài khoản dựng hàng loạt thiệp rác làm phình Storage.
// Client giữ bản sao ở CONFIG.maxWeddings để chặn sớm và hiện "x/5" — đổi số ở
// đây phải đổi cả bên đó.

export const MAX_WEDDINGS_PER_USER = 5

export const WEDDING_LIMIT_MESSAGE =
  `Mỗi tài khoản chỉ giữ tối đa ${MAX_WEDDINGS_PER_USER} thiệp. ` +
  `Hãy xoá bớt thiệp cũ ở trang "Quản lý thiệp cưới" rồi thử lại.`

/**
 * Tài khoản này còn chỗ cho một thiệp MỚI không. Chỉ đếm thiệp còn hiện trong
 * danh sách (is_active) cho khớp con số khách nhìn thấy ở "Quản lý thiệp cưới".
 * `excludeId` bỏ qua chính hàng sắp ghi: ghi hỏng giữa chừng rồi lưu lại thì nó
 * vẫn là một thiệp, không phải hai.
 * Lỗi truy vấn KHÔNG tự thành "hết chỗ" — bên gọi tự quyết (trả 500).
 */
export async function checkWeddingLimit(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  userId: string,
  excludeId?: string | null,
): Promise<{ reached: boolean; count: number; error: string | null }> {
  let query = supabase
    .from('weddings')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_active', true)

  if (excludeId) query = query.neq('id', excludeId)

  const { count, error } = await query
  if (error) return { reached: false, count: 0, error: error.message }

  const n = count ?? 0
  return { reached: n >= MAX_WEDDINGS_PER_USER, count: n, error: null }
}
