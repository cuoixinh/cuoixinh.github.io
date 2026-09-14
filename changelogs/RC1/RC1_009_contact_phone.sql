-- ============================================================
-- CHANGELOG RC1.9  —  Thêm cột số điện thoại liên hệ cho bảng weddings
-- Base: RC1.8
-- Ngày: 2026-08-19
-- ------------------------------------------------------------
-- Lý do: bước "Thông tin cặp đôi" trong trình tạo thiệp cho phép nhập
--        số điện thoại liên hệ của chú rể / cô dâu. Hiện mới chỉ LƯU,
--        chưa mẫu thiệp nào hiển thị ra.
--
-- Thay đổi:
--   + Thêm cột weddings.groom_phone (text, nullable).
--   + Thêm cột weddings.bride_phone (text, nullable).
--
-- Cách chạy: dán vào Supabase → SQL Editor → Run (idempotent, chạy lại an toàn).
-- ============================================================

alter table public.weddings
  add column if not exists groom_phone text,
  add column if not exists bride_phone text;

comment on column public.weddings.groom_phone is
  'Số điện thoại liên hệ của chú rể (nhập ở bước Thông tin cặp đôi).';

comment on column public.weddings.bride_phone is
  'Số điện thoại liên hệ của cô dâu (nhập ở bước Thông tin cặp đôi).';
