# Plan: Tạo thiệp cho khách (thiệp tạo hộ + Google Sheet)

Người trong allowlist tạo thiệp hộ cô dâu chú rể. Cặp đôi KHÔNG cần tài khoản: họ nhận link
thiệp `/<slug>` và một file Google Sheet để theo dõi khách mời. Khách mời, xác nhận tham dự
và lời chúc của thiệp tạo hộ nằm trong Sheet, không nằm trong bảng `guests`.

## Quyết định đã chốt

| # | Vấn đề | Chốt |
|---|---|---|
| 1 | Ai được tạo hộ | Email Google viết cứng trong backend (`_shared/creators.ts`). Đăng nhập như khách thường. Nên dùng **một tài khoản vận hành chung**, không phải Gmail cá nhân. |
| 2 | Quyền của người tạo hộ | Là chủ thiệp mãi mãi, đủ mọi quyền. Không có bàn giao chủ. |
| 3 | Giao cho cặp đôi | Chỉ đưa link thiệp + link Sheet. Cặp đôi không cần tài khoản. |
| 4 | Vòng đời thiệp | Như thiệp khách tự tạo: hạn dùng thử, xuất bản, cron dọn dẹp giữ nguyên. |
| 5 | Số thiệp | Người tạo hộ **không giới hạn** (bỏ cả trần `MAX_WEDDINGS_PER_USER` lẫn luật 1 thiệp Free/tài khoản). |
| 6 | Thanh toán | Vẫn qua màn `/checkout/`, chọn gói như thường, nhưng **không hiện QR**. Server thấy người gọi trong allowlist thì áp gói ngay, không qua PayOS/webhook. Ghi `payment_amount` = **đúng giá gói khách chọn**. |
| 7 | Apps Script | **Chỉ quản lý khách mời.** Thiệp vẫn tạo và chỉnh ở web. |
| 8 | Nơi lưu khách mời / RSVP | **Google Sheet**, không phải bảng `guests`. |
| 9 | Lời chúc | Ghi vào Sheet; thiệp đọc danh sách lời chúc **trực tiếp từ Sheet**. |
| 10 | Cache | **Không cache** (cả worker lẫn `CacheService`): đọc/ghi thẳng Apps Script. |
| 11 | Sheet không phản hồi khi khách xác nhận/gửi lời chúc | Báo khách "thử lại sau" (503) + `log.error`. Không có bảng đệm. |
| 12 | Chia sẻ Sheet | **Ai có link đều xem được.** |
| 13 | Thiệp tạo hộ bị mất hook | Báo lỗi cho khách mời + `log.error`, **không** rơi về bảng `guests`. |
| 14 | Cặp đôi sửa Sheet? | **Chỉ xem.** Thêm/sửa khách thì nhắn người tạo hộ. |
| 15 | Đồng bộ link | Menu do người tạo hộ tự bấm khi cần, không có trigger chạy ngầm. RSVP/lời chúc vẫn ghi thẳng vào Sheet lúc khách bấm. |

## Mô hình

- **Thiệp chế độ Sheet** = thiệp có một hàng trong `wedding_sheet_hooks`. Không thêm cột
  nào vào `weddings`.
- Link mời **giữ nguyên định dạng** `/<slug>?isGroom=…&name=…&relationship=…`, nên mẫu thiệp
  và helper không phải sửa phần đọc link.
- Khớp khách mời theo tên + xưng hô ghi trên link (đúng luật `findGuestByLink` hiện có).
  Apps Script khớp theo hai cột ẩn "Tên trên link" / "Xưng hô trên link" ghi lúc sinh link,
  để người tạo hộ sửa chính tả tên sau đó không làm link cũ mất khớp.

```
Khách mời bấm xác nhận
  → guest-handler (action=rsvp)
      ├─ thiệp thường      → update bảng guests (như hiện nay)
      └─ thiệp chế độ Sheet → POST web app Apps Script (chờ kết quả)
                               ├─ OK   → 200, thiệp hiện lời cảm ơn
                               └─ lỗi  → 503 "thử lại sau" + log.error
```

## 1. DB

Một changelog mới trong thư mục `RC<NN>/schema/` có số lớn nhất, idempotent, chạy trên cả
hai project.

- Hàm `public.cx_user_id_by_email(p_email text) returns uuid`:
  - `security definer`, `set search_path = ''`, đọc `auth.users`.
  - `revoke execute` khỏi `public`, `anon`, `authenticated`; chỉ `grant` cho `service_role`.
  - Dùng để đổi email trong token Google sang user id.
- Bảng `public.wedding_sheet_hooks`:

```sql
create table if not exists public.wedding_sheet_hooks (
  wedding_id     uuid primary key references public.weddings(id) on delete cascade,
  url            text not null check (url like 'https://script.google.com/macros/s/%'),
  secret         text not null,
  spreadsheet_id text not null,
  created_by     uuid not null,
  created_at     timestamptz not null default now()
);
alter table public.wedding_sheet_hooks enable row level security;
revoke all on table public.wedding_sheet_hooks from anon, authenticated;
```

Ràng buộc `url` chặn trỏ hook sang địa chỉ khác (Edge Function thành công cụ gọi URL tuỳ ý).
`spreadsheet_id` gửi kèm payload để script khỏi tra Script Properties mỗi request.

## 2. Edge Function

### File dùng chung mới (`supabase/functions/_shared/`)

| File | Việc |
|---|---|
| `creators.ts` | `CREATOR_EMAILS` (viết thường) + `isCreator(user)`: chỉ `true` khi `app_metadata.provider === 'google'`, email đã xác minh và nằm trong danh sách. Đăng nhập OTP cùng email không tính. |
| `google-id-token.ts` | Verify token từ `ScriptApp.getIdentityToken()` bằng JWKS của Google: `iss`, `exp`, `email_verified`, `aud` ∈ `GOOGLE_SCRIPT_AUDIENCES`. |
| `invite-link.ts` | Mã hoá kiểu CryptoJS (`Salted__` + EVP_BytesToKey MD5 + AES-CBC), port chiều ngược của `worker/index.js`. Kết quả phải giống hệt `_guestLink` ở `invitation-setup/guests/index.js`. |
| `payment-apply.ts` | Đoạn "áp gói khi đã trả tiền" tách ra từ `payos-webhook` (`plan`, `expires_at = null`, `plan_expires_at`, trả lại `pending_theme`, cộng dồn khi nâng gói, khoá theo trạng thái). Webhook và đường người tạo hộ cùng gọi để hai đường không lệch. |

### Sửa function

**`_shared/wedding-limits.ts`**
- `checkWeddingLimit` và `hasOtherFreeWedding` nhận cờ `creator`, bỏ qua khi bật.
- Truyền cờ ở **cả hai** đường tạo hàng `weddings`: POST `wedding-admin` và upsert `payment-handler`.

**`wedding-admin`**
- `GET ?resource=me` → `{ creator: boolean }`. UI chỉ dùng để vẽ; quyền thật kiểm ở server.

**`payment-handler`**
- `quote` trả thêm `creator: true` cho người tạo hộ.
- `create-payment` của người tạo hộ:
  - Tính giá đúng như báo giá (`fetchActivePricing` + hệ số ở `_shared/plans.ts`).
  - Không gọi PayOS; gọi `payment-apply.ts` với `payment_status = 'completed'`,
    `transaction_id = 'creator'`, `payment_amount` = giá gói.
  - Ghi `payment_logs` với `event_type = 'creator_activated'` kèm `amount`, `plan`, user id.
  - Không áp mã giảm giá.
  - Trả `{ completed: true }`.
- Người ngoài allowlist đi PayOS như cũ.

**`payos-webhook`**
- Chỉ chuyển sang gọi `payment-apply.ts`, hành vi không đổi.

**`guest-handler`**
- `getAuthUser()` nhận thêm header `x-google-id-token`. **Chỉ mở cho email trong allowlist**;
  verify xong thì đổi email → user id qua `cx_user_id_by_email`, rồi đi qua các phép kiểm chủ
  thiệp sẵn có.
- Action mới (chủ thiệp):
  - `sheet-hook` (POST/DELETE): đăng ký/gỡ `url`, `secret`, `spreadsheet_id`.
  - `sheet-links` (POST): nhận `[{ row, name, relationship, side }]`, trả `[{ row, link }]`.
    Không ghi DB.
- Action công khai ở chế độ Sheet:

| Action | Thiệp thường | Chế độ Sheet |
|---|---|---|
| `rsvp` | Update `guests` | Gửi lên Sheet, **chờ** (timeout ~10s). Lỗi → 503 "Chưa gửi được xác nhận, vui lòng thử lại sau" + `log.error('sheet.rsvp_failed')`. |
| `wish` | Ghi `guests.wishes` | Gửi lên Sheet, chờ. Apps Script giữ trần 3 lời chúc/khách. Lỗi → 503 + `log.error('sheet.wish_failed')`. |
| `view` | Đánh dấu Đã xem | Đẩy nền (`EdgeRuntime.waitUntil`), trả `confirmed: null`. Lỗi → `log.error`. |
| `wishes-list` | Đọc `guests.wishes` | Hỏi thẳng Sheet, trả đúng các trường như hiện nay. Lỗi → danh sách rỗng + `log.error('sheet.wishes_list_failed')`. |

- Thiệp có chủ là người tạo hộ mà **không có hook**: `rsvp`/`wish` trả 503 + `log.error('sheet.hook_missing')`,
  không rơi về bảng `guests`.
- Web app Apps Script trả 302 sang `script.googleusercontent.com`: fetch phải đi theo
  redirect, 302 không phải lỗi.
- Không log `secret`, token Google hay tên khách mời.

### Secret mới (đặt riêng cho từng project)

| Secret | Giá trị |
|---|---|
| `ENCRYPTION_KEY` | Trùng `CONFIG.security.encryptionKey` của môi trường đó |
| `SITE_ORIGIN` | `https://cuoixinh.com` / `https://staging.cuoixinh.com` |
| `GOOGLE_SCRIPT_AUDIENCES` | `aud` trong token của dự án Apps Script (lấy bằng hàm in token ở script) |

## 3. Web

- **`checkout/` + `core/payment.js`**: `quote.creator` → ẩn khung QR, nút đổi thành
  "Kích hoạt"; nhận `completed: true` thì sang thẳng màn thành công.
- **`my-invitations/`** và `_create` của `draft-start.js`: bỏ trần số thiệp khi `me.creator`.
- **Trang Khách mời** của thiệp chế độ Sheet: hiện "Thiệp này quản lý khách mời bằng Google
  Sheet", ẩn "Chia sẻ quyền quản lý".
- **Thiệp (helper dùng chung):**
  - `view` chỉ gửi **một lần mỗi máy** (cờ `localStorage` theo slug + tên, bọc try/catch).
  - Lời chúc chỉ tải khi khách **cuộn tới mục Lời chúc** (kiểm `wishes-helper.js` đang tải lúc nào).
  - RSVP / gửi lời chúc nhận 503 thì **hiện lỗi**, không hiện lời cảm ơn.

## 4. Apps Script (`apps-script/`, không khai vào `INCLUDE`)

- Một dự án độc lập dưới tài khoản người tạo hộ, deploy web app **một lần**:
  *Execute as: Me*, *Who has access: Anyone*.
- `appsscript.json` khai scope `openid`, `email`, Sheets, Drive.
- Sheet điều khiển, menu do người tạo hộ tự bấm:
  - **Tạo Sheet cho thiệp**: nhập `wedding_id` → chép Sheet mẫu → mở quyền xem cho ai có
    link → sinh secret → gọi `sheet-hook`.
  - **Tạo link mời** (trong Sheet của thiệp): gọi `sheet-links` cho dòng chưa có link hoặc
    vừa sửa; ghi Link + hai cột ẩn "Tên trên link" / "Xưng hô trên link".
  - **Gỡ kết nối**: hỏi xác nhận rồi gọi `sheet-hook` DELETE.
  - **In aud của token**: dùng một lần để lấy giá trị cho `GOOGLE_SCRIPT_AUDIENCES`.
- `doPost` xử lý `rsvp`, `view`, `wish`, `wishes-list`:
  - So `secret` với secret của thiệp; sai thì bỏ.
  - Mở file theo `spreadsheet_id`, ghi trong `LockService`.
  - Không khớp dòng nào → ghi vào tab "Không khớp" và trả `matched: false`.
- Cột Sheet: Họ tên · Tên hiển thị · Xưng hô · Bên · Link · Đã xem · Xác nhận · Số người ·
  Lời nhắn · Lời chúc · Thời điểm (+ 2 cột ẩn).

## 5. Thứ tự triển khai

Làm trọn trên **staging** trước, rồi lặp lại y hệt trên production.

1. Chạy SQL.
2. Đặt 3 secret mới.
3. Deploy `wedding-admin`, `payment-handler`, `payos-webhook`, `guest-handler`
   (`npm run deploy:functions:staging -- <tên>`).
4. Web: `checkout`, `my-invitations`, `draft-start`, trang Khách mời, helper thiệp.
5. Apps Script: deploy web app, lấy `aud`, tạo Sheet mẫu.
6. Production: lặp lại 1–5, đổi `CX_VERSION`.
7. Cập nhật `docs/security-checklist.md` (allowlist, thanh toán bỏ qua PayOS, đường token
   Google, hook) và thêm mục ngắn vào `CLAUDE.md`.

## 6. Kiểm thử

- [ ] Tài khoản ngoài allowlist: `create-payment` vẫn ra QR; gửi token Google của mình → 401.
- [ ] Đăng nhập OTP bằng email trùng allowlist → không được coi là người tạo hộ.
- [ ] Người tạo hộ gọi `sheet-hook` / `sheet-links` vào thiệp của người khác → 403.
- [ ] `url` hook ngoài `script.google.com` → DB từ chối.
- [ ] Kích hoạt hai lần liền → chỉ áp gói một lần, `payment_amount` đúng giá gói.
- [ ] Người tạo hộ tạo quá 3 thiệp và nhiều thiệp Free → không bị chặn.
- [ ] Link do server dựng mở thiệp đúng tên + xưng hô, giống link trang Khách mời dựng.
- [ ] Khách xác nhận / gửi lời chúc → Sheet cập nhật ngay; lời chúc hiện trên thiệp.
- [ ] Tắt web app → khách thấy lỗi "thử lại sau", Axiom có log; thiệp vẫn mở, mục lời chúc rỗng.
- [ ] Gỡ hook rồi khách xác nhận → báo lỗi, Axiom có `sheet.hook_missing`.
- [ ] Tên không có trong Sheet → tab "Không khớp" có dòng mới.
- [ ] Sửa tên trong Sheet sau khi gửi link → link cũ vẫn khớp.
- [ ] Thiệp tạo hộ không kích hoạt → cron xoá đúng hạn như thiệp thường.
- [ ] Bắn vài chục request cùng lúc vào web app để xem giới hạn thật.

## Rủi ro đã biết

- **Quota Apps Script tính theo TÀI KHOẢN, không theo file.** Mọi Sheet của một người tạo hộ
  dùng chung khoảng 30 lượt chạy cùng lúc (số nhớ từ tài liệu Google, cần đo lại). Vượt mức
  thì lượt dư bị từ chối ngay, không treo: thiệp vẫn mở, lời chúc rỗng, RSVP báo thử lại.
  Mỗi lượt chạy ~1 giây nên sức chịu thực tế khoảng 30 lượt/giây.
- **Không cache** nên mỗi lượt cuộn tới mục lời chúc là một lượt chạy Apps Script, thiệp chờ
  lời chúc ~1–3 giây. Ai cố gọi dồn `wishes-list` có thể kéo RSVP của các thiệp khác cùng tài
  khoản lỗi theo.
- **Tài khoản người tạo hộ là điểm hỏng duy nhất**: bị khoá / mất quyền là mọi thiệp của
  người đó ngừng nhận xác nhận. Vì vậy nên dùng tài khoản vận hành chung.
- **Sheet chia theo link** nên ai cầm link Sheet đều thấy họ tên, SĐT và link mời riêng của
  mọi khách mời.
- Khi đông: chuyển tài khoản vận hành sang Workspace hoặc chia thiệp cho nhiều tài khoản —
  hook lưu theo từng thiệp nên không phải sửa code.
