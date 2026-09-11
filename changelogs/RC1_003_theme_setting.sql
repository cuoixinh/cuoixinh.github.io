-- ============================================================
-- CHANGELOG RC1.3  —  Thêm cột theme_setting cho bảng weddings
-- Base: RC1.2
-- Ngày: 2026-07-16
-- ------------------------------------------------------------
-- Lý do: tab "Giao diện" trong trình soạn thiệp cho phép người
--        dùng tuỳ chỉnh font + màu chữ của thiệp. Các giá trị
--        này lưu chung trong 1 cột JSON của bảng weddings.
--
-- Thay đổi:
--   + Thêm cột weddings.theme_setting (jsonb, nullable).
--
-- Schema JSON (mọi field tuỳ chọn; rỗng => dùng mặc định của theme):
--   {
--     "heading_font":  "Playfair Display",  -- font tiêu đề
--     "body_font":     "Be Vietnam Pro",    -- font nội dung
--     "heading_color": "#2d2d2d",           -- màu tiêu đề
--     "accent_color":  "#c0a062"            -- màu nhấn (ngày, số, chi tiết)
--   }
--
-- Cách chạy: dán vào Supabase → SQL Editor → Run (idempotent, chạy lại an toàn).
-- ============================================================

alter table public.weddings
  add column if not exists theme_setting jsonb;

comment on column public.weddings.theme_setting is
  'Tuỳ chỉnh giao diện thiệp (font + màu chữ). JSON: heading_font, body_font, heading_color, accent_color. Null => dùng mặc định của theme.';
