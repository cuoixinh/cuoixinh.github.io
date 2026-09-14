-- ============================================================
-- SCHEMA 07 — Hạn mức dùng AI (`ai_usage`, `ai_usage_ip`, `ai_chat_usage`)
--
-- Ba bảng đếm lượt gọi model theo NGÀY để không đốt hết free tier Gemini/Groq.
-- Tách ba vì ba nhóm người dùng / hai tính năng khác nhau:
--
--   ai_usage      — sinh nội dung thiệp, khách ĐÃ đăng nhập (khoá: user_id)
--   ai_usage_ip   — sinh nội dung thiệp, khách CHƯA đăng nhập (khoá: IP, hạn thấp hơn)
--   ai_chat_usage — "Trợ lý AI" ở trang chủ; một cuộc trò chuyện tốn nhiều lượt
--                   hơn hẳn nên có hạn mức riêng, không ăn chung hai bảng trên
--
-- Cả ba: RLS bật, KHÔNG policy → chỉ Edge Function (service_role) ghi/đọc được.
-- Client mà đọc được thì cũng sửa được số đếm, tức là bỏ qua hạn mức.
-- ============================================================

create table if not exists public.ai_usage (
  user_id    uuid not null references auth.users(id) on delete cascade,
  day        date not null default current_date,
  count      integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);

create table if not exists public.ai_usage_ip (
  ip         text not null,
  day        date not null default current_date,
  count      integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (ip, day)
);

create table if not exists public.ai_chat_usage (
  subject    text not null,
  day        date not null default current_date,
  count      integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (subject, day)
);

comment on column public.ai_chat_usage.subject is
  'Chủ thể tính hạn mức: "u:<user_id>" nếu đã đăng nhập, "ip:<địa chỉ>" nếu chưa';

alter table public.ai_usage      enable row level security;
alter table public.ai_usage_ip   enable row level security;
alter table public.ai_chat_usage enable row level security;
