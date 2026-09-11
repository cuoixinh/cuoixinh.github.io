-- ============================================================
-- CHANGELOG RC1.12  —  Bỏ cột templates.tags
-- Base: RC1.11
-- Ngày: 2026-08-23
-- ------------------------------------------------------------
-- Lý do: form "Thêm/Sửa mẫu" của admin không có ô nhập tag và payload không
--        gửi cột này → mọi mẫu thêm sau baseline đều có tags = null. Chỉ ba
--        hàng seed của RC1.0 còn dữ liệu, không đủ để lọc hay tìm kiếm; nhãn
--        "Hot" của /theme-template (tìm tag `hot`) chưa từng khớp hàng nào.
--
-- Thay đổi:
--   − Xoá cột templates.tags (text[]).
--
-- ⚠️ XOÁ DỮ LIỆU, không hoàn tác được. Chạy SAU khi đã deploy bản
--    /theme-template không còn đọc `tags` (Edge Function và Cloudflare Worker
--    vốn không trả cột này ra client).
--
-- Cách chạy: dán vào Supabase → SQL Editor → Run (idempotent, chạy lại an toàn).
-- ============================================================

alter table public.templates
  drop column if exists tags;
