# Database — Cưới Xinh

Toàn bộ script dựng và nâng cấp database Supabase. Chạy bằng **Dashboard → SQL Editor**,
không cần CLI.

Mỗi dòng phiên bản là một thư mục `RC<số>/`. **Thay đổi mới luôn ghi vào RC có số LỚN
NHẤT.** Mở một RC mới tức là chốt baseline: mọi RC nhỏ hơn đóng băng, không sửa file nào
trong đó nữa.

Trong mỗi dòng phiên bản có ba nhóm, chạy theo đúng thứ tự này:

| Thư mục          | Nội dung                                                     | Chạy khi nào                                  |
| ---------------- | ------------------------------------------------------------ | --------------------------------------------- |
| `RC<số>/schema/` | Bảng, cột, index, trigger, hàm, RLS, grant                   | Dựng mới **và** mỗi lần nâng cấp (idempotent) |
| `RC<số>/data/`   | Dữ liệu danh mục: mẫu thiệp, giá, mã giảm giá                | Sau `schema/`                                 |
| `RC<số>/manual/` | Việc phải làm bằng Dashboard, hoặc SQL phải sửa theo project | Một lần cho mỗi project                       |

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

Rồi chạy tiếp từng RC lớn hơn, theo thứ tự số, mỗi RC cùng thứ tự `schema/` → `data/` →
`manual/`.

## Nâng cấp một project đang chạy

Chỉ chạy những file **mới** trong RC lớn nhất mà project đó chưa chạy (staging trước, rồi
production). Không chạy lại các baseline cũ, và **không bao giờ chạy
`dqvinh_000_reset.sql` trên production** — nó xoá sạch dữ liệu khách thật.
`npm run sql:merge` gộp `schema/` + `data/` của RC mới nhất, tức đúng phần chênh.

## Thêm thay đổi mới

Từ khi phát hành, production có dữ liệu thật nên mỗi thay đổi là **một file mới** trong
`RC<lớn nhất>/<nhóm>/dqvinh_<số kế tiếp>_<tên>.sql` — không sửa ngược file cũ, kể cả trong
RC đang mở khi file đó đã chạy trên production. File vẫn phải **idempotent** (`add column if not
exists`, `drop policy if exists` trước khi tạo lại…) để chạy lỡ hai lần không hỏng.

Thay đổi phải giữ dữ liệu sẵn có: thêm cột thì kèm default/backfill, đừng drop-tạo lại
bảng; đổi tên hay xoá cột là breaking — Edge Function bản cũ vẫn đọc tên cũ cho tới lúc
deploy xong, nên thêm cột mới trước, bỏ cột cũ ở một đợt sau.

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
