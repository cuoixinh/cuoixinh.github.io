-- ============================================================
-- CHANGELOG RC1.1  —  Thêm bảng ai_usage
-- Base: RC1.0 (database-complete.sql)
-- Ngày: 2026-07-09
-- ------------------------------------------------------------
-- Lý do: tính năng "Tạo nội dung thiệp bằng AI" (Edge Function
--        ai-invitation) cần rate-limit số lượt gọi AI theo
--        user/ngày để chống lạm dụng free tier Gemini/Groq.
--
-- Thay đổi:
--   + Tạo bảng public.ai_usage (PK user_id, day) đếm số lượt/ngày.
--   + Bật RLS, KHÔNG policy => chỉ service_role (Edge Function) ghi được.
--
-- Cách chạy: dán vào Supabase → SQL Editor → Run (idempotent, chạy lại an toàn).
-- ============================================================

create table if not exists public.ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day     date not null default current_date,
  count   integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);

-- RLS: chỉ Edge Function (service role) mới ghi/đọc. Client không truy cập trực tiếp.
alter table public.ai_usage enable row level security;
-- Không tạo policy nào cho anon/authenticated => mọi truy cập từ client bị chặn,
-- chỉ service_role (bỏ qua RLS) trong Edge Function mới thao tác được.
