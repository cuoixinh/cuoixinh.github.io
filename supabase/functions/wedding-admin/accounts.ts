// resource=accounts — trang /admin-support: nhân viên (SUPPORT_EMAILS, kiểm ở index.ts) tạo
// tài khoản Cưới Xinh (tên đăng nhập + mật khẩu) cho khách không tự đăng nhập Google/email được. Supabase Auth không có
// username nên tên đăng nhập là phần trước @ của email giả `<tên>@ACCOUNT_DOMAIN`.
// ACCOUNT_DOMAIN phải trùng CXAuth.ACCOUNT_DOMAIN (core/auth.js) — lệch là khách không vào được.

import type { Logger } from '../_shared/axiom.ts'

// deno-lint-ignore no-explicit-any
type Db = any

// Tên miền con KHÔNG nhận thư (không MX, không catch-all): mã OTP gửi tới đây phải rơi mất.
export const ACCOUNT_DOMAIN = 'account.cuoixinh.com'
const USERNAME_RE = /^[a-z0-9](?:[a-z0-9._-]{1,30}[a-z0-9])$/
// Bỏ 0/o/1/i/l để khách đọc-chép tay không nhầm.
const PASS_ALPHABET = '23456789abcdefghjkmnpqrstuvwxyz'
const PASS_LEN = 8

function randomPassword(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(PASS_LEN))
  return Array.from(bytes, b => PASS_ALPHABET[b % PASS_ALPHABET.length]).join('')
}

const emailOf = (username: string) => `${username}@${ACCOUNT_DOMAIN}`
const isAccountEmail = (email: unknown) =>
  typeof email === 'string' && email.toLowerCase().endsWith('@' + ACCOUNT_DOMAIN)

// Chỉ tài khoản do nhân viên tạo mới mang cờ này (app_metadata chỉ service_role ghi được).
// Hàng cùng tên miền mà thiếu cờ là ai đó tự gọi /auth/v1/signup giữ chỗ trước.
const isAdminMade = (u: Record<string, any>) => u?.app_metadata?.cx_account === true

// Quét hết user rồi lọc theo tên miền — Admin API không lọc được theo email.
async function listAccountUsers(db: Db): Promise<Record<string, any>[]> {
  const out: Record<string, any>[] = []
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw error
    const users = data?.users ?? []
    for (const u of users) if (isAccountEmail(u.email)) out.push(u)
    if (users.length < 1000) break
  }
  return out
}

export async function handleAccounts(
  req: Request,
  db: Db,
  log: Logger,
  corsHeaders: Record<string, string>,
  staffEmail: string,
): Promise<Response> {
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  // GET — danh sách tài khoản kèm số thiệp mỗi người đang giữ.
  if (req.method === 'GET') {
    let users: Record<string, any>[]
    try {
      users = await listAccountUsers(db)
    } catch (e) {
      log.error('account.list_failed', { message: (e as Error).message })
      return json({ error: 'Không đọc được danh sách tài khoản' }, 500)
    }
    const counts: Record<string, number> = {}
    const ids = users.map(u => u.id)
    if (ids.length) {
      const { data, error } = await db.from('weddings').select('user_id').in('user_id', ids)
      if (error) {
        log.error('account.weddings_count_failed', { code: error.code, message: error.message })
        return json({ error: 'Không đếm được số thiệp' }, 500)
      }
      for (const r of data ?? []) counts[r.user_id] = (counts[r.user_id] ?? 0) + 1
    }
    return json(users
      .map(u => ({
        id: u.id,
        username: String(u.email).split('@')[0],
        full_name: u.user_metadata?.full_name ?? '',
        admin_made: isAdminMade(u),
        created_by: u.app_metadata?.created_by ?? null,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at ?? null,
        weddings: counts[u.id] ?? 0,
      }))
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))))
  }

  const body = await req.json().catch(() => ({}))
  const password = typeof body.password === 'string' && body.password.trim()
    ? body.password.trim()
    : randomPassword()

  // POST — tạo tài khoản. Trả lại mật khẩu đúng MỘT lần để admin đưa cho khách.
  if (req.method === 'POST') {
    const username = String(body.username ?? '').trim().toLowerCase()
    const fullName = String(body.full_name ?? '').trim().slice(0, 80)
    if (!USERNAME_RE.test(username)) {
      return json({ error: 'Tên đăng nhập 3–32 ký tự: chữ thường không dấu, số, dấu . _ -' }, 400)
    }

    const attrs = {
      email: emailOf(username),
      password,
      email_confirm: true,
      user_metadata: fullName ? { full_name: fullName } : {},
      app_metadata: { cx_account: true, created_by: staffEmail },
    }
    let { data, error } = await db.auth.admin.createUser(attrs)

    // Trùng tên: hàng giữ chỗ do người ngoài tự đăng ký (không cờ, chưa xác nhận) thì gỡ
    // rồi tạo lại; tài khoản thật đã có thì báo trùng, không đụng vào.
    // Xét theo code, không theo status: weak_password cũng là 422.
    if (error && (error.code === 'email_exists' || error.code === 'user_already_exists')) {
      let existing: Record<string, any> | undefined
      try {
        existing = (await listAccountUsers(db)).find(u => u.email === attrs.email)
      } catch (e) {
        log.error('account.list_failed', { message: (e as Error).message })
        return json({ error: 'Không kiểm tra được tên trùng' }, 500)
      }
      if (!existing || isAdminMade(existing) || existing.email_confirmed_at) {
        return json({ error: 'Tên đăng nhập đã có người dùng' }, 409)
      }
      const del = await db.auth.admin.deleteUser(existing.id)
      if (del.error) {
        log.error('account.squatter_delete_failed', { user_id: existing.id, message: del.error.message })
        return json({ error: 'Không gỡ được tài khoản giữ chỗ' }, 500)
      }
      log.warn('account.squatter_removed', { user_id: existing.id })
      ;({ data, error } = await db.auth.admin.createUser(attrs))
    }

    if (error) {
      // Mật khẩu không qua luật mật khẩu của project là lỗi người nhập, không phải 5xx.
      if (error.code === 'weak_password') return json({ error: 'Mật khẩu chưa đủ mạnh theo cài đặt Supabase' }, 400)
      log.error('account.create_failed', { code: error.code, message: error.message })
      return json({ error: 'Không tạo được tài khoản: ' + error.message }, 500)
    }
    log.info('account.created', { user_id: data.user.id, by: staffEmail })
    return json({ id: data.user.id, username, password })
  }

  // PATCH — đặt lại mật khẩu (khách quên). Chỉ nhận tài khoản do nhân viên tạo.
  if (req.method === 'PATCH') {
    const id = String(body.id ?? '')
    const { data: got, error: getErr } = await db.auth.admin.getUserById(id)
    if (getErr || !got?.user) return json({ error: 'Không tìm thấy tài khoản' }, 404)
    if (!isAccountEmail(got.user.email) || !isAdminMade(got.user)) {
      return json({ error: 'Chỉ đặt lại được tài khoản Cưới Xinh do nhân viên tạo' }, 403)
    }
    const { error } = await db.auth.admin.updateUserById(id, { password })
    if (error) {
      if (error.code === 'weak_password') return json({ error: 'Mật khẩu chưa đủ mạnh theo cài đặt Supabase' }, 400)
      log.error('account.reset_failed', { user_id: id, code: error.code, message: error.message })
      return json({ error: 'Không đặt lại được mật khẩu' }, 500)
    }
    log.info('account.password_reset', { user_id: id, by: staffEmail })
    return json({ id, username: String(got.user.email).split('@')[0], password })
  }

  return json({ error: 'Method not allowed' }, 405)
}
