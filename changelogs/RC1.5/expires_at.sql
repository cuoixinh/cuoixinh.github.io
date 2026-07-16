-- ============================================================
-- CHANGELOG RC1.5  —  Thêm cột expires_at cho bảng weddings
-- Base: RC1.4
-- Ngày: 2026-07-17
-- ------------------------------------------------------------
-- Lý do: hạn dùng thử của thiệp. Luồng nghiệp vụ:
--   + Khi XUẤT BẢN (is_published = true): đặt expires_at = now + 3 ngày
--     → thiệp lên công khai nhưng ở chế độ DÙNG THỬ 3 ngày.
--   + Khi THANH TOÁN THÀNH CÔNG (payos-webhook): gán expires_at = null
--     → kích hoạt vĩnh viễn, thiệp mở mãi (đúng lời hứa "không hết hạn").
--   Nhờ vậy trang Đơn hàng phân biệt được: đã xuất bản + còn expires_at =
--   "Chưa thanh toán"; expires_at null = "Hoàn thành".
--
-- Thay đổi:
--   + Thêm cột weddings.expires_at (timestamptz, nullable).
--     Null = đã thanh toán / kích hoạt vĩnh viễn (hoặc chưa xuất bản).
--   + Index idx_weddings_expires_at để quét thiệp hết hạn nhanh.
--
-- Cách chạy: dán vào Supabase → SQL Editor → Run (idempotent).
-- ============================================================

alter table public.weddings
  add column if not exists expires_at timestamptz;

create index if not exists idx_weddings_expires_at on public.weddings(expires_at);

comment on column public.weddings.expires_at is
  'Hạn dùng thử của thiệp đã xuất bản (ngày xuất bản + 3 ngày). Null = đã thanh toán / kích hoạt vĩnh viễn / chưa xuất bản';
