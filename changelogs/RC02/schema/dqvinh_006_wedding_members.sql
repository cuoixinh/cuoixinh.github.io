-- ============================================================
-- Thành viên thiệp: chủ thiệp mời thêm 1 người (vd cô dâu) cùng quản lý khách mời
-- Ngày: 2026-10-18
-- ------------------------------------------------------------
-- Mời bằng email, không gửi thư: người được mời đăng nhập bằng đúng email đó (đã xác
-- minh) là thấy thiệp ở trang Khách mời. Quyền CHỈ là quản lý khách mời của `side`
-- (groom | bride | null = cả hai bên) — kiểm ở guest-handler (authorize). Không áp cho
-- thiệp gói Miễn phí. Mỗi thiệp tối đa 1 thành viên (unique wedding_id).
-- user_id / joined_at điền ở lần đầu người đó mở thiệp (để chủ thiệp thấy "Đã tham gia").
--
-- Cách chạy: dán vào Supabase → SQL Editor → Run (idempotent, chạy lại an toàn).
--            Chạy trên CẢ HAI project, TRƯỚC khi deploy guest-handler.
-- ============================================================

create table if not exists public.wedding_members (
  id          uuid primary key default gen_random_uuid(),
  wedding_id  uuid not null references public.weddings(id) on delete cascade,
  email       text not null,
  side        text,
  user_id     uuid,
  invited_by  uuid,
  created_at  timestamptz not null default now(),
  joined_at   timestamptz,
  constraint wedding_members_side_check check (side is null or side in ('groom', 'bride')),
  constraint wedding_members_email_lower check (email = lower(email))
);

create unique index if not exists wedding_members_one_per_wedding
  on public.wedding_members (wedding_id);

create index if not exists wedding_members_email_idx
  on public.wedding_members (email);

comment on table public.wedding_members is
  'Người được chủ thiệp mời cùng quản lý khách mời (guest-handler). side null = cả hai bên';

-- Trình duyệt không bao giờ đọc thẳng bảng (xem RC01/schema/dqvinh_008_grants.sql):
-- chỉ Edge Function bằng service_role.
alter table public.wedding_members enable row level security;
revoke all on table public.wedding_members from anon, authenticated;
