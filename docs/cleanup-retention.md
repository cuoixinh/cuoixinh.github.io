# Dọn dẹp tự động & khoá thiệp hết hạn

Luồng "thiệp/nháp bỏ quên thì tự xoá, thiệp hết hạn dùng thử thì khách mời không xem được".
Đọc file này trước khi sửa bất cứ thứ gì dính tới `expires_at`, hạn giữ dữ liệu, hay màn khoá
trên trang thiệp.

## 1. Vì sao có nó

- Gói Supabase free: 500 MB DB + 1 GB Storage. Thiệp bỏ quên (ảnh cưới cả chục tấm ~1 MB) ăn
  dần cho tới khi hết chỗ.
- Dùng thử 3 ngày trước đây chỉ là cái nhãn: không ai chặn nên thiệp chưa trả tiền vẫn xem
  được vĩnh viễn.

## 2. Vòng đời một thiệp

```mermaid
stateDiagram-v2
    [*] --> NhapLocal: chọn mẫu
    NhapLocal --> NhapDB: đăng nhập + lưu
    NhapLocal --> [*]: 30 ngày không mở<br/>(quét ở trình duyệt)
    NhapDB --> [*]: 30 ngày không lưu<br/>(cron xoá hẳn)
    NhapDB --> DungThu: Xuất bản<br/>expires_at = now + 3 ngày
    DungThu --> KichHoat: thanh toán<br/>expires_at = null
    DungThu --> HetHan: quá 3 ngày
    HetHan --> KichHoat: thanh toán
    HetHan --> [*]: quá hạn thêm 30 ngày<br/>(cron xoá hẳn)
    KichHoat --> [*]: chỉ khi chủ thiệp tự xoá

    note right of HetHan
        Khách mời mở link chỉ thấy màn "Thiệp đang tạm khoá".
        Chủ thiệp VẪN sửa và xuất bản được, nhưng xuất bản
        KHÔNG cấp lại hạn dùng thử.
    end note
```

| Trạng thái | Dấu hiệu trong DB                                                    | Khách mời xem được? |
| ---------- | -------------------------------------------------------------------- | ------------------- |
| Nháp       | `is_published = false`                                               | không — 403 `NOT_PUBLISHED` |
| Dùng thử   | `is_published`, `expires_at > now()`                                 | có                  |
| Hết hạn    | `is_published`, `expires_at < now()`, `payment_status <> 'completed'` | **không** — 403     |
| Kích hoạt  | `expires_at is null` hoặc `payment_status = 'completed'`              | có, vĩnh viễn       |

## 3. `expires_at` — ai được ghi, ghi lúc nào

Cột này là **trục của toàn bộ luồng**. Chỉ có ba chỗ chạm vào nó:

| Nơi                   | Khi nào                                                            | Giá trị           |
| --------------------- | ------------------------------------------------------------------ | ----------------- |
| `wedding-admin` PATCH | thiệp CHUYỂN từ chưa xuất bản → xuất bản, chưa thanh toán, và CHƯA TỪNG có hạn | `now() + 3 ngày`, hoặc hạn cũ nếu slug đang bị giữ |
| `payos-webhook`       | thanh toán thành công                                              | `null`            |
| `payment-handler`     | thanh toán 0đ (mã giảm 100%)                                       | `null`            |

⚠️ **Điều kiện "chuyển trạng thái" là bắt buộc, đừng gỡ.** Thiệp đã xuất bản thì nút chính đổi
nhãn thành "Lưu & Xuất bản" nhưng vẫn gọi `publishWedding()`, tức mọi lần lưu đều kèm
`is_published: true`. Bỏ điều kiện là hạn dùng thử tự gia hạn mỗi lần khách bấm lưu → không
thiệp nào hết hạn, không thiệp nào bị dọn, cả tính năng này thành vô nghĩa.

⚠️ **Hạn dính theo thiệp VÀ theo slug, đừng gỡ.** Thiệp đã từng có hạn thì gỡ xuất bản rồi xuất
bản lại vẫn giữ hạn cũ. Thiệp dùng thử chưa thanh toán bị xoá (bởi chủ, cron hay admin) thì
trigger `cx_hold_deleted_wedding_slug` ghi slug + hạn vào `wedding_slug_holds`: trong
`SLUG_HOLD_DAYS` (90) ngày chỉ chủ cũ lấy lại được slug đó, và thiệp nào xuất bản với slug đó cũng kế thừa hạn cũ.
Thiếu một trong hai là xoá/gỡ rồi xuất bản lại thành dùng thử vô hạn trên cùng link. Luật
slug (hằng `SLUG_HOLD_DAYS`, `findSlugHold`, `getUniqueSlug`) chỉ nằm ở `_shared/slug-holds.ts`;
mọi đường đặt slug phải hỏi qua đó — `wedding-admin` (POST/PATCH) và `payment-handler` (tạo
hàng lúc thanh toán). Link công khai của slug đang giữ trả 409 `SLUG_HELD` để ô kiểm slug ở
trang Thiết lập không coi là còn trống. POST tạo
thiệp của người dùng thường luôn là nháp, vì nó không đặt hạn.

`expires_at` **không bao giờ** rời khỏi DB cho người dùng thường: `wedding-admin` chỉ lấy nó để
xét khoá rồi `delete` khỏi response.

## 4. Ba hạn giữ dữ liệu

Số ngày khai ở `CONFIG.retention` (`core/config.js`) — nguồn sự thật cho MỌI câu chữ hiển thị.

| Loại               | Mốc đếm                             | Ai dọn                                                    |
| ------------------ | ----------------------------------- | --------------------------------------------------------- |
| `unpaidDays`       | `expires_at` (hết hạn dùng thử)     | Edge Function `cleanup-weddings`                          |
| `serverDraftDays`  | `weddings.updated_at` (lần lưu cuối) | Edge Function `cleanup-weddings`                          |
| `localDraftDays`   | `_savedAt` trong localStorage        | `core/helpers/draft-retention.js` (chạy ở trình duyệt)    |

⚠️ Back-end giữ **bản sao** số ngày ở biến môi trường `RETENTION_DAYS` của function
`cleanup-weddings` (mặc định 30). Đổi `CONFIG.retention` mà quên đổi biến này là web nói một
đằng hệ thống làm một nẻo.

## 5. Các mảnh và file

| Mảnh               | File                                                                                                   | Việc                                                                                 |
| --------------------| --------------------------------------------------------------------------------------------------------| --------------------------------------------------------------------------------------|
| Schema + lịch      | `changelogs/RC01/schema/dqvinh_001_weddings.sql` + `changelogs/RC01/manual/dqvinh_002_cron_cleanup.sql`          | cột `updated_at` + trigger, 2 partial index, bật `pg_cron`/`pg_net`, `cron.schedule` |
| Quét & xoá         | `supabase/functions/cleanup-weddings/index.ts`                                                         | 2 câu quét, xoá ảnh Storage rồi xoá hàng                                             |
| Khoá thiệp         | `supabase/functions/wedding-admin/index.ts` (GET một thiệp)                                            | slug + hết hạn → 403 `TRIAL_EXPIRED`; theo id → kèm cờ `trial_locked`                |
| Lộ mã lỗi          | `core/dal/wedding-dal.js` → `getWeddingBySlug`                                                         | đọc body lỗi, gắn `err.code`                                                         |
| Màn khoá           | `core/helpers/wedding-helper.js` → `showLockedInvitation`                                              | overlay phủ kín trang thiệp                                                          |
| Dọn nháp máy khách | `core/helpers/draft-retention.js`                                                                      | quét localStorage lúc nạp trang                                                      |
| Câu chữ cho khách  | `my-invitations/index.js`, `invitation-setup/js/05-theme-panel.js`, `13-data.js`, `18-theme-picker.js` | nhãn, tooltip, toast, popup xuất bản                                                 |

## 6. Server: `cleanup-weddings`

Không UI nào gọi vào. `pg_cron` gọi qua `pg_net` mỗi ngày **03:00 giờ VN** (`0 20 * * *` UTC),
kèm header `x-admin-token` lấy từ Vault (secret tên `cleanup_token`). Function deploy với
**Verify JWT = OFF** — quyền dựa hoàn toàn vào token đó.

Ba câu quét:

```
(1) unpaid: is_published AND payment_status <> 'completed'
            AND expires_at IS NOT NULL AND expires_at < now() - RETENTION_DAYS
(2) draft:  NOT is_published AND updated_at < now() - RETENTION_DAYS
(3) sổ giữ slug: wedding_slug_holds.deleted_at < now() - SLUG_HOLD_DAYS (90)
```

Câu (3) chạy SAU phần thiệp và hỏng thì chỉ ghi log (`cleanup.slug_holds_failed`), không làm
hỏng lượt dọn thiệp: sót hàng hết hạn chỉ tốn chỗ, không chặn ai. `?days=` KHÔNG áp cho câu
này — hạ số ngày giữ là xoá luôn hàng đang giữ, mở lại lỗ xoá-đi-tạo-lại. `?dry_run=1` trả
thêm khoá `slug_holds` liệt kê hàng sẽ dọn.

Chốt an toàn: `expires_at IS NULL` hoặc `payment_status = 'completed'` thì **không bao giờ** bị
đụng — đó là thiệp đã kích hoạt vĩnh viễn. Câu (1) dùng `.or('payment_status.is.null,...neq...')`
vì `neq` của PostgREST bỏ sót hàng NULL.

Mỗi nạn nhân (nhóm 1, 2): xoá cả thư mục ảnh `w/<storage_key>/` (+ file phẳng cũ hàng còn trỏ tới) → `delete
from weddings` (guests cascade theo FK). **Xoá ảnh trước**, vì hàng DB là nơi duy nhất giữ
`storage_key`. Luật quét + phép xoá nằm ở `_shared/wedding-cleanup.ts`, dùng chung với tab "Dọn dữ
liệu" của admin — cron hỏng thì dọn tay ở đó, cùng đúng một điều kiện. Luật + phép xoá sổ giữ
slug (`findExpiredSlugHolds` / `deleteExpiredSlugHolds`, hằng `SLUG_HOLD_DAYS`) cũng ở file đó;
mục "Sổ giữ slug hết hạn" của tab admin gọi đúng hai hàm này.

- `?dry_run=1` — chỉ liệt kê, không xoá. Dùng trước mọi thay đổi.
- `?days=N` — ghi đè hạn của nhóm (1), (2), để thử tay.
- Trần **100 hàng mỗi nhóm thiệp mỗi lần chạy** (`MAX_PER_RUN`), còn dư hôm sau dọn tiếp. Nhóm
  (3) xoá hết trong một lệnh (hàng sổ rất nhỏ, không đụng Storage).
- Log Axiom: `cleanup.run` · `cleanup.deleted` · `cleanup.failed` · `cleanup.slug_holds_deleted` ·
  `cleanup.slug_holds_failed`.

## 7. Khoá thiệp hết hạn

Chặn ở **API**, không phải ở client: link thiệp là công khai, giấu bằng JS thì ai xem source
cũng lấy được dữ liệu.

- **Tra theo `slug`** (đường công khai) + hết hạn → `403 {code:'TRIAL_EXPIRED', groom_name,
  bride_name, theme}`. Không trả một byte dữ liệu thiệp nào.
- **Tra theo `id`** (UUID quản lý, chỉ chủ thiệp có) → không chặn, để trình chỉnh sửa nạp được;
  kèm cờ `trial_locked` để báo cho chủ thiệp biết.
- Trang thiệp: `loadWeddingData` bắt `code === 'TRIAL_EXPIRED'` → `showLockedInvitation()` thay
  vì đá về trang chủ. Overlay viết bằng inline style + biến `--cx-*` (trang thiệp không có
  Tailwind) nên chạy trên mọi theme.
- Trình chỉnh sửa: cờ `IS_TRIAL_LOCKED` (`01-state.js`) đổi popup "Chúc mừng" sau khi xuất bản
  sang khối cảnh báo cam, vì xuất bản lại KHÔNG mở khoá.
- **Xem trước không bị ảnh hưởng**: preview chạy `?preview=true` không có slug → không gọi API.

## 8. Client: dọn nháp trong localStorage

Server không với tới localStorage nên phải quét ở trình duyệt. `draft-retention.js` chạy ngay
khi nạp (landing, `my-invitations`, `invitation-setup`), sau `cache-util.js` và `config.js`:

- Xoá `cuoixinh_draft_<id>` có `_savedAt` quá hạn, gỡ luôn hàng `status: "draft"` tương ứng
  trong cache `orders` để không còn thẻ ma ở "Quản lý thiệp cưới".
- **Nháp chưa có `_savedAt` thì đóng dấu, KHÔNG xoá** — nếu không, bản nháp của khách cũ bay mất
  ngay lần deploy đầu tiên.
- **Bỏ qua id đang mở** (`?id=` trên URL).
- Gọi tay để thử: `cxSweepLocalDrafts()` trong console.

Mốc `_savedAt` do `saveLocalDraft()` (`01-state.js`) và `draft-start.js` đặt. `core/payment.js`
phải strip nó trước khi PATCH lên DB (cùng chỗ strip `_localOnly`).

## 9. Vận hành

```sql
-- Lịch còn sống không
select jobid, jobname, schedule, active from cron.job;

-- Lần chạy gần nhất (job_run_details KHÔNG có cột jobname, phải join)
select j.jobname, d.status, d.start_time, d.return_message
from cron.job_run_details d join cron.job j on j.jobid = d.jobid
order by d.start_time desc limit 5;

-- Function trả về gì
select status_code, content from net._http_response order by created desc limit 5;

-- Dừng gấp (có hiệu lực ngay, không cần deploy)
select cron.unschedule('cx-cleanup-weddings');

-- Cứu một thiệp sắp bị xoá / mở khoá tạm 3 ngày
update weddings set expires_at = now() + interval '3 days' where id = '<id>';

-- Chạy tay (bỏ ?dry_run=1 là xoá thật)
select net.http_post(
  url := 'https://lcobawmkywtxhpezndsh.supabase.co/functions/v1/cleanup-weddings?dry_run=1',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'x-admin-token', (select decrypted_secret from vault.decrypted_secrets where name = 'cleanup_token')
  ),
  body := '{}'::jsonb, timeout_milliseconds := 30000);
```

Deploy lại function: `npm run deploy:functions` (script tự truyền `--no-verify-jwt` cho
`cleanup-weddings`, `guest-handler`, `payos-webhook`).

Đổi token:
`select vault.update_secret((select id from vault.secrets where name='cleanup_token'), '<token mới>');`
— phải khớp biến `ADMIN_SECRET_TOKEN` của Edge Function.

| Triệu chứng                            | Nguyên nhân thường gặp                                              |
| -------------------------------------- | -------------------------------------------------------------------- |
| `status_code = 401`                    | Token Vault khác `ADMIN_SECRET_TOKEN`, hoặc deploy thiếu `--no-verify-jwt` |
| `status_code = 404`                    | Function chưa deploy                                                 |
| `cron.job_run_details` rỗng            | Chưa tới giờ chạy, hoặc lịch đã bị unschedule                        |
| Thiệp hết hạn vẫn xem được vài phút    | Cache Cloudflare (TTL 300s) còn giữ bản 200 cũ                       |
| Nháp cũ không bao giờ bị dọn           | Trigger `cx_touch_weddings_updated_at` bị drop, hoặc `updated_at` bị luồng khác ghi đè |

## 10. Cạm bẫy khi sửa

- **Xoá là xoá hẳn, một pha, không hoàn tác được** — mất luôn ảnh, khách mời, lời chúc. Luôn
  `dry_run` trước khi đổi bất cứ điều kiện quét nào.
- **`RETENTION_DAYS` và `CONFIG.retention` là hai nơi** — đổi phải đổi cả hai.
- **Thêm cột ảnh mới** cho thiệp thì phải thêm vào `IMAGE_COLUMNS` ở `_shared/wedding-images.ts`
  — nơi duy nhất; quên là tab "Dọn dữ liệu" coi ảnh đang dùng ở cột đó là rác.
- **Ảnh mồ côi** (ảnh bị thay, lưu hỏng, thư mục của thiệp đã xoá, file phẳng cũ) không có cron
  nào dọn — dọn tay ở tab "Dọn dữ liệu" của admin. Chỉ file cũ hơn 48h mới tính là rác: ảnh vừa
  upload mà khách chưa kịp lưu thiệp cũng chưa có hàng nào trỏ tới.
- **Bảng tiền không cascade**: `orders` / `payment_logs` / `promo_redemptions` tham chiếu
  `manage_id` mà không có FK, xoá thiệp không xoá chúng — cố ý, để giữ lịch sử tiền bạc.
- **`add column ... default now()` không để lại hàng NULL** (PG11+ điền luôn cho hàng cũ).
  Backfill phải thêm cột trước, `update` sau, rồi mới `set default` — xem `changelogs/RC01/schema/dqvinh_001_weddings.sql`.
