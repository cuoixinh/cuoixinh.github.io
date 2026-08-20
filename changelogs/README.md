# Database Changelogs — Cưới Xinh

Thư mục này lưu **lịch sử thay đổi database** theo từng phiên bản. Mỗi lần nâng cấp DB → tạo một thư mục `RCx.y` mới chứa script + mô tả thay đổi.

## Quy ước

- **`RC1.0`** — _baseline_: toàn bộ schema đầy đủ (`database-complete.sql`). Đây là điểm khởi đầu, chạy file này là dựng lại DB từ đầu (có `DROP TABLE` → **chỉ dùng cho DB trống / môi trường mới**).
- **`RC1.1`, `RC1.2`, …** — _incremental changelog_: mỗi thư mục chỉ chứa **phần thay đổi so với bản trước** (thêm bảng, thêm cột, sửa index…). Script phải **idempotent** (dùng `if not exists`, `add column if not exists`…) để chạy lại không lỗi.

### Đánh số

- Tăng **minor** (`1.1 → 1.2`) cho thay đổi thường: thêm bảng/cột, sửa dữ liệu.
- Tăng **major** (`1.x → 2.0`) khi có breaking change lớn → nên kèm một `database-complete.sql` mới làm baseline.

## Cách áp dụng lên Supabase

Làm trên **Supabase Dashboard → SQL Editor** (không cần CLI):

1. DB mới toanh → chạy baseline `RC1.0/database-complete.sql`.
2. DB đang chạy → chạy **lần lượt** các changelog **sau phiên bản hiện tại**. Ví dụ đang ở RC1.0, muốn lên RC1.2 thì chạy `RC1.1/*` rồi `RC1.2/*`.

> Mỗi changelog viết idempotent nên chạy lại không gây hại, nhưng vẫn nên chạy đúng thứ tự.

## Lịch sử phiên bản

| Phiên bản | Ngày       | Thay đổi                                                                                                                                | File                          |
| --------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| **RC1.0** | 2026-06-28 | Baseline: weddings, guests, templates, template_pricing, orders, order_details, payment_logs                                            | `RC1.0/database-complete.sql` |
| **RC1.1** | 2026-07-09 | Thêm bảng `ai_usage` (rate-limit tính năng AI sinh nội dung thiệp)                                                                      | `RC1.1/ai_usage.sql`          |
| **RC1.2** | 2026-07-09 | Thêm bảng `ai_usage_ip` (rate-limit theo IP cho khách chưa đăng nhập dùng AI)                                                           | `RC1.2/ai_usage_ip.sql`       |
| **RC1.3** | 2026-07-16 | Thêm cột `weddings.theme_setting` (jsonb) lưu tuỳ chỉnh font + màu chữ cho tab Giao diện                                                | `RC1.3/theme_setting.sql`     |
| **RC1.4** | 2026-07-16 | Thêm cột `weddings.user_id` (→ auth.users) gắn thiệp với tài khoản, để trang Đơn hàng liệt kê cả draft trong DB                         | `RC1.4/user_id.sql`           |
| **RC1.5** | 2026-07-17 | Thêm cột `weddings.expires_at` (timestamptz) — hạn dùng thử 3 ngày khi xuất bản; thanh toán thành công → gán null (kích hoạt vĩnh viễn) | `RC1.5/expires_at.sql`        |
| **RC1.6** | 2026-07-18 | Thêm cột `weddings.share_message_template` (text) — câu mẫu chia sẻ (mail merge `##Danh xưng##`, `##link##`) cấu hình ở tab Cấu hình              | `RC1.6/share_message_template.sql` |
| **RC1.7** | 2026-07-26 | Siết RLS: bỏ policy `USING (true)` trên `weddings`/`guests`, bật RLS cho `payment_logs`, siết INSERT `orders`/`order_details` theo `auth.uid()` | `RC1.7/rls_hardening.sql`     |
| **RC1.8** | 2026-08-09 | Hạn mức lượt dùng mã giảm giá: bảng `promo_redemptions` (giữ chỗ 15' → chốt khi thanh toán xong), cột `promo_codes.note`/`batch_id`, hàm `cx_promo_reserve`/`redeem`/`release` | `RC1.8/promo_redemptions.sql` |
| **RC1.9** | 2026-08-19 | Thêm cột `weddings.groom_phone` / `weddings.bride_phone` (text) — số điện thoại liên hệ nhập ở bước "Thông tin cặp đôi"                                    | `RC1.9/contact_phone.sql`     |
| **RC1.10** | 2026-08-19 | Dọn dẹp tự động: cột `weddings.updated_at` + trigger, index quét, bật `pg_cron`/`pg_net` và lịch gọi Edge Function `cleanup-weddings` mỗi ngày | `RC1.10/cleanup_retention.sql` |
| **RC1.11** | 2026-08-20 | Bỏ cột `templates.features` (text[]) — không trang nào đọc tới, mọi mẫu thiệp đều có đủ tính năng | `RC1.11/drop_template_features.sql` |

## Khi thêm phiên bản mới

1. Tạo thư mục `changelogs/RCx.y/`.
2. Viết script SQL idempotent cho phần thay đổi, kèm header mô tả (lý do, thay đổi, cách chạy) — xem `RC1.1/ai_usage.sql` làm mẫu.
3. Thêm một dòng vào bảng **Lịch sử phiên bản** ở trên.
4. (Tùy chọn) Nếu là major, cập nhật/ tạo lại `database-complete.sql` baseline mới.
