-- ============================================================
-- CHANGELOG RC1.6  —  Thêm cột share_message_template cho bảng weddings
-- Base: RC1.5
-- Ngày: 2026-07-18
-- ------------------------------------------------------------
-- Lý do: tab "Cấu hình" cho phép người dùng soạn sẵn câu mẫu để
--        gửi kèm khi chia sẻ thiệp cho khách (Messenger, Zalo…).
--        Dùng mẫu trộn (mail merge) với các biến:
--          ##Danh xưng##  → tên hiển thị của khách
--          ##link##       → link thiệp riêng của khách
--        Khi bấm chia sẻ, hệ thống thay biến bằng thông tin thật
--        của từng khách rồi đổ vào lời nhắn.
--
-- Thay đổi:
--   + Thêm cột weddings.share_message_template (text, nullable).
--     Null / rỗng => dùng câu mặc định của hệ thống.
--
-- Cách chạy: dán vào Supabase → SQL Editor → Run (idempotent, chạy lại an toàn).
-- ============================================================

alter table public.weddings
  add column if not exists share_message_template text;

comment on column public.weddings.share_message_template is
  'Câu mẫu chia sẻ thiệp (mail merge). Biến: ##Danh xưng##, ##link##. Null => dùng câu mặc định.';
