# Database — Cưới Xinh

Toàn bộ script dựng và nâng cấp database Supabase. Chạy bằng **Dashboard → SQL Editor**,
không cần CLI.

Mỗi dòng phiên bản là một thư mục `RC<số>/` — hiện tại là `RC01/`. Breaking change lớn thì
mở `RC02/` mới, baseline cũ nằm lại nguyên vẹn để tra.

Trong mỗi dòng phiên bản có ba nhóm, chạy theo đúng thứ tự này:

| Thư mục         | Nội dung                                                     | Chạy khi nào                                  |
| --------------- | ------------------------------------------------------------ | --------------------------------------------- |
| `RC01/schema/` | Bảng, cột, index, trigger, hàm, RLS, grant                    | Dựng mới **và** mỗi lần nâng cấp (idempotent) |
| `RC01/data/`   | Dữ liệu danh mục: mẫu thiệp, giá, mã giảm giá                 | Sau `schema/`                                 |
| `RC01/manual/` | Việc phải làm bằng Dashboard, hoặc SQL phải sửa theo project | Một lần cho mỗi project                       |

## Dựng một project từ đầu

```
RC01/schema/dqvinh_000_reset.sql          ⚠️ XOÁ SẠCH dữ liệu — bỏ qua nếu đang nâng cấp
RC01/schema/dqvinh_001_weddings.sql
RC01/schema/dqvinh_002_guests.sql
RC01/schema/dqvinh_003_orders.sql
RC01/schema/dqvinh_004_payment_logs.sql
RC01/schema/dqvinh_005_templates.sql
RC01/schema/dqvinh_006_promo.sql
RC01/schema/dqvinh_007_ai_usage.sql
RC01/schema/dqvinh_008_grants.sql         ← phải chạy CUỐI nhóm schema
RC01/data/dqvinh_001_templates.sql
RC01/data/dqvinh_002_template_pricing.sql ← sau 001, vì nó đọc bảng templates
RC01/data/dqvinh_003_promo_codes.sql      (tuỳ chọn)
RC01/manual/dqvinh_001_storage_policies.sql  ← làm bằng Dashboard
RC01/manual/dqvinh_002_cron_cleanup.sql      ← sửa <PROJECT_REF> trước khi chạy
```

Dán từng file, Run, xong file này mới sang file sau. Mọi file trong `schema/` và `data/`
đều **idempotent** — chạy lại chỉ đồng bộ chứ không nhân đôi hay lỗi.

Sau khi xong, kiểm bằng mục C ở cuối `RC01/schema/dqvinh_008_grants.sql`: gọi thẳng PostgREST bằng anon
key phải không ra dữ liệu, còn trang chủ và thiệp công khai vẫn chạy.

## Nâng cấp một project đang chạy

Chạy lại nhóm `schema/` **trừ `dqvinh_000_reset.sql`**. Các file dùng `create table if not exists`,
`add column if not exists`, `create or replace` nên chỉ bổ sung phần còn thiếu, không đụng
dữ liệu sẵn có.

## Thêm thay đổi mới

Sửa thẳng file trong `schema/` cho khớp trạng thái mong muốn, và giữ nguyên tính idempotent
— thêm cột thì `add column if not exists`, đổi policy thì `drop policy if exists` trước khi
tạo lại. Nhờ vậy cùng một file vừa dựng được project trống vừa nâng cấp được project cũ,
không phải nuôi hai nhánh script.

Thay đổi lớn hoặc cần lần ngược lý do về sau thì viết thêm một ghi chú trong file, ngay
cạnh đoạn SQL — đừng quay lại lối mỗi thay đổi một file rời.

## Hai môi trường

Mọi thay đổi phải chạy trên **cả hai** project (`staging` trước, rồi production) — xem
`docs/staging-environment.md`. Ba thứ khác nhau giữa hai bên, đừng chép qua lại:

- `ADMIN_SECRET_TOKEN` và Vault secret `cleanup_token`
- `<PROJECT_REF>` trong `RC01/manual/dqvinh_002_cron_cleanup.sql`
- Kênh PayOS

## Mẫu thiệp

`RC01/data/dqvinh_001_templates.sql` là **ảnh chụp** danh mục để dựng project trống cho nhanh. Về sau
thêm/sửa/xoá mẫu thì dùng tab "Templates" của admin: nó sinh một file `.sql` riêng cho từng
thao tác, chạy trên cả hai project. Đừng sửa tay file này rồi chạy lại trên project đang
chạy — nó sẽ ghi đè `sort_order` và mô tả của mọi mẫu.
