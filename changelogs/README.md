# Database Changelogs — Cưới Xinh

Thư mục này lưu **lịch sử thay đổi database** theo từng phiên bản. Mỗi lần nâng cấp DB → thêm một file `RC<major>_<số thứ tự 3 chữ số>_<tên>.sql`.

Số ba chữ số là để **sort chữ cái ra đúng thứ tự chạy** — `RC1.9`/`RC1.10` sort chữ thì RC1.10 nhảy lên trước RC1.2, còn `RC1_009`/`RC1_010` thì không. Số đó khớp phần sau dấu chấm của tên phiên bản: RC1.10 ↔ `RC1_010_`.

## Quy ước

- **`RC1_000`** (= RC1.0) — _baseline_: toàn bộ schema đầy đủ. Đây là điểm khởi đầu, chạy file này là dựng lại DB từ đầu (có `DROP TABLE` → **chỉ dùng cho DB trống / môi trường mới**).
- **`RC1_001`, `RC1_002`, …** — _incremental changelog_: mỗi file chỉ chứa **phần thay đổi so với bản trước** (thêm bảng, thêm cột, sửa index…). Script phải **idempotent** (dùng `if not exists`, `add column if not exists`…) để chạy lại không lỗi.

### Đánh số

- Tăng **minor** (`1.1 → 1.2`) cho thay đổi thường: thêm bảng/cột, sửa dữ liệu.
- Tăng **major** (`1.x → 2.0`) khi có breaking change lớn → nên kèm một `database-complete.sql` mới làm baseline.

## Cách áp dụng lên Supabase

Làm trên **Supabase Dashboard → SQL Editor** (không cần CLI):

1. DB mới toanh → gộp cả bộ thành một file rồi dán một lượt:

   ```bash
   npm run sql:merge -- RC1 --ref=<project-ref>   # → changelogs/RC1.final.sql (không commit)
   ```

   `--ref` đổi mọi chỗ nhắc ref project production sang project đích. **Bắt buộc khi dựng
   môi trường khác production**: `RC1_010` có `cron.schedule` gọi thẳng URL đó, quên là cron
   của môi trường mới đi xoá dữ liệu THẬT.

2. DB đang chạy → chạy **lần lượt** các file **sau phiên bản hiện tại**. Ví dụ đang ở RC1.0,
   muốn lên RC1.2 thì chạy `RC1_001_*` rồi `RC1_002_*`.

> Mỗi changelog viết idempotent nên chạy lại không gây hại, nhưng vẫn nên chạy đúng thứ tự.

## Lịch sử phiên bản

| Phiên bản | Ngày       | Thay đổi                                                                                                                                | File                          |
| --------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| **RC1.0** | 2026-06-28 | Baseline: weddings, guests, templates, template_pricing, orders, order_details, payment_logs                                            | `RC1_000_database-complete.sql` |
| **RC1.1** | 2026-07-09 | Thêm bảng `ai_usage` (rate-limit tính năng AI sinh nội dung thiệp)                                                                      | `RC1_001_ai_usage.sql`          |
| **RC1.2** | 2026-07-09 | Thêm bảng `ai_usage_ip` (rate-limit theo IP cho khách chưa đăng nhập dùng AI)                                                           | `RC1_002_ai_usage_ip.sql`       |
| **RC1.3** | 2026-07-16 | Thêm cột `weddings.theme_setting` (jsonb) lưu tuỳ chỉnh font + màu chữ cho tab Giao diện                                                | `RC1_003_theme_setting.sql`     |
| **RC1.4** | 2026-07-16 | Thêm cột `weddings.user_id` (→ auth.users) gắn thiệp với tài khoản, để trang Đơn hàng liệt kê cả draft trong DB                         | `RC1_004_user_id.sql`           |
| **RC1.5** | 2026-07-17 | Thêm cột `weddings.expires_at` (timestamptz) — hạn dùng thử 3 ngày khi xuất bản; thanh toán thành công → gán null (kích hoạt vĩnh viễn) | `RC1_005_expires_at.sql`        |
| **RC1.6** | 2026-07-18 | Thêm cột `weddings.share_message_template` (text) — câu mẫu chia sẻ (mail merge `##Danh xưng##`, `##link##`) cấu hình ở tab Cấu hình              | `RC1_006_share_message_template.sql` |
| **RC1.7** | 2026-07-26 | Siết RLS: bỏ policy `USING (true)` trên `weddings`/`guests`, bật RLS cho `payment_logs`, siết INSERT `orders`/`order_details` theo `auth.uid()` | `RC1_007_rls_hardening.sql`     |
| **RC1.8** | 2026-08-09 | Hạn mức lượt dùng mã giảm giá: bảng `promo_redemptions` (giữ chỗ 15' → chốt khi thanh toán xong), cột `promo_codes.note`/`batch_id`, hàm `cx_promo_reserve`/`redeem`/`release` | `RC1_008_promo_redemptions.sql` |
| **RC1.9** | 2026-08-19 | Thêm cột `weddings.groom_phone` / `weddings.bride_phone` (text) — số điện thoại liên hệ nhập ở bước "Thông tin cặp đôi"                                    | `RC1_009_contact_phone.sql`     |
| **RC1.10** | 2026-08-19 | Dọn dẹp tự động: cột `weddings.updated_at` + trigger, index quét, bật `pg_cron`/`pg_net` và lịch gọi Edge Function `cleanup-weddings` mỗi ngày | `RC1_010_cleanup_retention.sql` |
| **RC1.11** | 2026-08-20 | Bỏ cột `templates.features` (text[]) — không trang nào đọc tới, mọi mẫu thiệp đều có đủ tính năng | `RC1_011_drop_template_features.sql` |
| **RC1.12** | 2026-08-23 | Bỏ cột `templates.tags` (text[]) — admin không có ô nhập nên mẫu mới luôn null, lưới mẫu đã thôi lọc/tìm theo tag | `RC1_012_drop_template_tags.sql` |
| **RC1.13** | 2026-08-23 | Thêm bảng `ai_chat_usage` (hạn mức riêng cho "Trợ lý AI" ở trang chủ, khoá theo `u:<user_id>` hoặc `ip:<địa chỉ>`) | `RC1_013_ai_chat_usage.sql` |
| **RC1.14** | 2026-09-07 | Lời chúc khách mời: cột `guests.wishes` (jsonb) + cột `weddings.enable_wishes` bật/tắt mục (hạn mức 3 lời chúc/khách do Edge Function giữ) | `RC1_014_guest_wishes.sql` |
| **RC1.15** | 2026-09-10 | Khoá kho ảnh `wedding-images`: gỡ policy cũ, chỉ `authenticated` được `select`/`insert` — chặn liệt kê toàn bộ file bằng anon key (không đụng đường `/object/public/` nên thiệp vẫn hiện ảnh). **Làm bằng Dashboard, không chạy được ở SQL Editor** — file chỉ chứa hướng dẫn + truy vấn kiểm tra | `RC1_015_storage_list_policy.sql` |
| **RC1.16** | 2026-09-11 | Thu quyền đọc thẳng bảng của `anon`/`authenticated` qua PostgREST trên `promo_codes`, `promo_redemptions`, `templates`, `template_pricing` — mã giảm giá phát riêng đang đọc được bằng anon key. Worker `templates-cache` chuyển sang gọi Edge Function `?resource=public-templates`. **Deploy worker TRƯỚC khi chạy SQL** | `RC1_016_revoke_anon_postgrest.sql` |

## Khi thêm phiên bản mới

1. Tạo file `changelogs/RC<major>_<số kế tiếp, 3 chữ số>_<tên>.sql`.
2. Viết script SQL idempotent cho phần thay đổi, kèm header mô tả (lý do, thay đổi, cách chạy) — xem `RC1_001_ai_usage.sql` làm mẫu.
3. Thêm một dòng vào bảng **Lịch sử phiên bản** ở trên.
4. (Tùy chọn) Nếu là major, cập nhật/ tạo lại `database-complete.sql` baseline mới.
