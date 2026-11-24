-- ============================================================
-- Gói thêm khách mua KÈM đơn gói thiệp ở màn thanh toán
-- Ngày: 2026-11-24
-- ------------------------------------------------------------
-- Một đơn PayOS (weddings.payment_order_id) trả cả gói lẫn khách mua thêm. Mỗi bên một hàng
-- guest_addons (order_id = "<mã đơn gói>-groom|bride"), `plan_order_id` = mã đơn gói để
-- payos-webhook chốt các hàng đó cùng lúc với gói. Null = đơn mua thêm riêng.
-- Chạy SAU dqvinh_027_guest_addons_staff.sql.
--
-- Cách chạy: dán vào Supabase → SQL Editor → Run (idempotent, chạy lại an toàn).
--            Chạy trên CẢ HAI project, TRƯỚC khi deploy payment-handler, payos-webhook.
-- ============================================================

alter table public.guest_addons add column if not exists plan_order_id text;

create index if not exists guest_addons_plan_order_idx
  on public.guest_addons (plan_order_id)
  where plan_order_id is not null;

comment on column public.guest_addons.plan_order_id is
  'Mã đơn gói thiệp (weddings.payment_order_id) khi mua kèm ở màn thanh toán; null = đơn riêng';
