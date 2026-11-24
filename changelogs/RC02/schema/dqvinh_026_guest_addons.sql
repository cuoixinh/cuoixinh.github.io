-- ============================================================
-- Gói thêm khách mời: chủ thiệp mua thêm chỗ cho MỘT bên (nhà trai / nhà gái)
-- Ngày: 2026-11-24
-- ------------------------------------------------------------
-- Mỗi hàng là một đơn PayOS (order_id = "ORDER-<orderCode>", cùng dạng với đơn mua gói
-- nên payos-webhook tra được cả hai). Trần khách của một bên = trần theo gói + tổng
-- `guests` các đơn `completed` của bên đó (guest-handler, _shared/guest-addons.ts).
-- Số khách/gói và giá khai ở GUEST_ADDON (_shared/plans.ts); hàng chỉ chốt lại số đã bán.
-- Xoá thiệp thì xoá luôn đơn (on delete cascade).
--
-- Cách chạy: dán vào Supabase → SQL Editor → Run (idempotent, chạy lại an toàn).
--            Chạy trên CẢ HAI project, TRƯỚC khi deploy payment-handler, payos-webhook,
--            guest-handler.
-- ============================================================

create table if not exists public.guest_addons (
  id          uuid primary key default gen_random_uuid(),
  wedding_id  uuid not null references public.weddings(id) on delete cascade,
  order_id    text not null,
  side        text not null,
  packs       integer not null,
  guests      integer not null,
  amount      integer not null,
  status      text not null default 'pending',
  user_id     uuid,
  created_at  timestamptz not null default now(),
  paid_at     timestamptz,
  constraint guest_addons_order_id_key unique (order_id),
  constraint guest_addons_side_check check (side in ('groom', 'bride')),
  constraint guest_addons_packs_check check (packs > 0),
  constraint guest_addons_guests_check check (guests > 0),
  constraint guest_addons_amount_check check (amount > 0),
  constraint guest_addons_status_check check (status in ('pending', 'completed', 'failed'))
);

create index if not exists guest_addons_wedding_idx
  on public.guest_addons (wedding_id, status);

comment on table public.guest_addons is
  'Đơn mua thêm khách mời cho một bên của thiệp (payment-handler tạo, payos-webhook chốt)';

-- Trình duyệt không bao giờ đọc thẳng bảng (xem RC01/schema/dqvinh_008_grants.sql):
-- chỉ Edge Function bằng service_role.
alter table public.guest_addons enable row level security;
revoke all on table public.guest_addons from anon, authenticated;
