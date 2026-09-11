-- ============================================================
-- CHANGELOG RC1.11  —  Bỏ cột templates.features
-- Base: RC1.10
-- Ngày: 2026-08-20
-- ------------------------------------------------------------
-- Lý do: cột này chỉ được ghi ở form "Thêm Template" của admin rồi đẩy
--        nguyên vẹn qua Edge Function / Cloudflare Worker ra client — KHÔNG
--        trang nào đọc tới. Mọi mẫu thiệp đều có đủ gallery/map/qrcode/rsvp/
--        countdown/music nên đánh dấu "tính năng" theo mẫu là vô nghĩa.
--
-- Thay đổi:
--   − Xoá cột templates.features (text[]).
--
-- ⚠️ XOÁ DỮ LIỆU, không hoàn tác được. Chạy SAU khi đã deploy bản
--    wedding-admin + cloudflare-worker không còn tham chiếu tới cột này.
--
-- Cách chạy: dán vào Supabase → SQL Editor → Run (idempotent, chạy lại an toàn).
-- ============================================================

alter table public.templates
  drop column if exists features;
