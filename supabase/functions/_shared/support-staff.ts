// Nhân viên hỗ trợ được vào /admin-support (tạo tài khoản Cưới Xinh cho khách). Chỉ tính khi
// phiên hiện tại đăng nhập bằng GOOGLE (amr = oauth) và email Google nằm trong danh sách:
// đăng nhập mã OTP / mật khẩu cùng email đó không được coi là nhân viên.

// Email Google viết THƯỜNG. Thêm/bớt người là sửa ở đây rồi deploy wedding-admin cả hai project.
export const SUPPORT_EMAILS: string[] = [
  'vectovinh@gmail.com', 'vectovinh14@gmail.com'
]

function sessionMethods(jwt: string): string[] {
  try {
    const b64 = jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const payload = JSON.parse(atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4)))
    return Array.isArray(payload.amr) ? payload.amr.map((a: { method?: string }) => a?.method ?? '') : []
  } catch {
    return []
  }
}

// `user` phải lấy từ auth.getUser(jwt) (đã xác thực chữ ký) — ở đây chỉ đọc thêm claim amr.
// Trả email Google của nhân viên, hoặc null.
// deno-lint-ignore no-explicit-any
export function supportStaffEmail(user: any, jwt: string): string | null {
  if (!user || !sessionMethods(jwt).includes('oauth')) return null
  // deno-lint-ignore no-explicit-any
  const google = (user.identities ?? []).find((i: any) => i?.provider === 'google')
  const email = String(google?.identity_data?.email ?? '').toLowerCase()
  if (!email || google?.identity_data?.email_verified === false) return null
  return SUPPORT_EMAILS.includes(email) ? email : null
}
