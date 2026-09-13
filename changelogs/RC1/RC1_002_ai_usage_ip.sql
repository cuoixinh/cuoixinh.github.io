-- ============================================================
-- CHANGELOG RC1.2  —  Thêm bảng ai_usage_ip
-- Base: RC1.1 (ai_usage)
-- Ngày: 2026-07-09
-- ------------------------------------------------------------
-- Lý do: mở tính năng "Tạo nội dung thiệp bằng AI" cho cả khách
--        CHƯA đăng nhập. Vì không có user_id, cần rate-limit theo
--        IP/ngày (hạn mức thấp hơn user đã đăng nhập) để chống lạm
--        dụng free tier Gemini/Groq.
--
-- Thay đổi:
--   + Tạo bảng public.ai_usage_ip (PK ip, day) đếm số lượt/ngày theo IP.
--   + Bật RLS, KHÔNG policy => chỉ service_role (Edge Function) ghi được.
--
-- Cách chạy: dán vào Supabase → SQL Editor → Run (idempotent, chạy lại an toàn).
-- ============================================================

create table if not exists public.ai_usage_ip (
  ip      text not null,
  day     date not null default current_date,
  count   integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (ip, day)
);

-- RLS: chỉ Edge Function (service role) mới ghi/đọc. Client không truy cập trực tiếp.
alter table public.ai_usage_ip enable row level security;
-- Không tạo policy nào cho anon/authenticated => mọi truy cập từ client bị chặn,
-- chỉ service_role (bỏ qua RLS) trong Edge Function mới thao tác được.
