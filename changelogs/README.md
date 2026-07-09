# Database Changelogs — Cưới Xinh

Thư mục này lưu **lịch sử thay đổi database** theo từng phiên bản. Mỗi lần nâng cấp DB → tạo một thư mục `RCx.y` mới chứa script + mô tả thay đổi.

## Quy ước

- **`RC1.0`** — *baseline*: toàn bộ schema đầy đủ (`database-complete.sql`). Đây là điểm khởi đầu, chạy file này là dựng lại DB từ đầu (có `DROP TABLE` → **chỉ dùng cho DB trống / môi trường mới**).
- **`RC1.1`, `RC1.2`, …** — *incremental changelog*: mỗi thư mục chỉ chứa **phần thay đổi so với bản trước** (thêm bảng, thêm cột, sửa index…). Script phải **idempotent** (dùng `if not exists`, `add column if not exists`…) để chạy lại không lỗi.

### Đánh số
- Tăng **minor** (`1.1 → 1.2`) cho thay đổi thường: thêm bảng/cột, sửa dữ liệu.
- Tăng **major** (`1.x → 2.0`) khi có breaking change lớn → nên kèm một `database-complete.sql` mới làm baseline.

## Cách áp dụng lên Supabase

Làm trên **Supabase Dashboard → SQL Editor** (không cần CLI):
1. DB mới toanh → chạy baseline `RC1.0/database-complete.sql`.
2. DB đang chạy → chạy **lần lượt** các changelog **sau phiên bản hiện tại**. Ví dụ đang ở RC1.0, muốn lên RC1.2 thì chạy `RC1.1/*` rồi `RC1.2/*`.

> Mỗi changelog viết idempotent nên chạy lại không gây hại, nhưng vẫn nên chạy đúng thứ tự.

## Lịch sử phiên bản

| Phiên bản | Ngày | Thay đổi | File |
|---|---|---|---|
| **RC1.0** | 2026-06-28 | Baseline: weddings, guests, templates, template_pricing, orders, order_details, payment_logs | `RC1.0/database-complete.sql` |
| **RC1.1** | 2026-07-09 | Thêm bảng `ai_usage` (rate-limit tính năng AI sinh nội dung thiệp) | `RC1.1/ai_usage.sql` |
| **RC1.2** | 2026-07-09 | Thêm bảng `ai_usage_ip` (rate-limit theo IP cho khách chưa đăng nhập dùng AI) | `RC1.2/ai_usage_ip.sql` |

## Khi thêm phiên bản mới

1. Tạo thư mục `changelogs/RCx.y/`.
2. Viết script SQL idempotent cho phần thay đổi, kèm header mô tả (lý do, thay đổi, cách chạy) — xem `RC1.1/ai_usage.sql` làm mẫu.
3. Thêm một dòng vào bảng **Lịch sử phiên bản** ở trên.
4. (Tùy chọn) Nếu là major, cập nhật/ tạo lại `database-complete.sql` baseline mới.
