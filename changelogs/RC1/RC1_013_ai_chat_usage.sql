-- ============================================================
-- CHANGELOG RC1.13  —  Thêm bảng ai_chat_usage
-- Base: RC1.12 (drop_template_tags)
-- Ngày: 2026-08-23
-- ------------------------------------------------------------
-- Lý do: mở "Trợ lý AI" (chatbot tư vấn) ở trang chủ. Một cuộc trò
--        chuyện tiêu nhiều lượt gọi model hơn hẳn tính năng sinh nội
--        dung thiệp, nên chat có hạn mức RIÊNG thay vì ăn chung
--        ai_usage / ai_usage_ip.
--
-- Thay đổi:
--   + Tạo bảng public.ai_chat_usage (PK subject, day) đếm số lượt/ngày.
--     `subject` gộp cả hai kiểu người dùng: "u:<auth.users.id>" khi đã
--     đăng nhập, "ip:<địa chỉ>" khi chưa → một bảng, một truy vấn.
--   + Bật RLS, KHÔNG policy => chỉ service_role (Edge Function) ghi được.
--
-- Cách chạy: dán vào Supabase → SQL Editor → Run (idempotent, chạy lại an toàn).
-- ============================================================

create table if not exists public.ai_chat_usage (
  subject    text not null,
  day        date not null default current_date,
  count      integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (subject, day)
);

comment on column public.ai_chat_usage.subject is
  'Chủ thể tính hạn mức: "u:<user_id>" nếu đã đăng nhập, "ip:<địa chỉ>" nếu chưa';

-- RLS: chỉ Edge Function (service role) mới ghi/đọc. Client không truy cập trực tiếp.
alter table public.ai_chat_usage enable row level security;
-- Không tạo policy nào cho anon/authenticated => mọi truy cập từ client bị chặn,
-- chỉ service_role (bỏ qua RLS) trong Edge Function mới thao tác được.
