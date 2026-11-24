-- ============================================================
-- Gói thêm khách: cho nhân viên xác nhận thu tiền tay ở /admin-support (Thanh toán hộ)
-- Ngày: 2026-11-24
-- ------------------------------------------------------------
-- Đơn nhân viên xác nhận ghi `amount` = số THỰC NHẬN, có thể giảm tay tới 0đ (tặng khách)
-- → nới ràng buộc amount > 0 thành >= 0. `confirmed_by` = email nhân viên (null = đơn PayOS).
-- Chạy SAU dqvinh_026_guest_addons.sql.
--
-- Cách chạy: dán vào Supabase → SQL Editor → Run (idempotent, chạy lại an toàn).
--            Chạy trên CẢ HAI project, TRƯỚC khi deploy wedding-admin.
-- ============================================================

alter table public.guest_addons drop constraint if exists guest_addons_amount_check;
alter table public.guest_addons add constraint guest_addons_amount_check check (amount >= 0);

alter table public.guest_addons add column if not exists confirmed_by text;

comment on column public.guest_addons.confirmed_by is
  'Email nhân viên xác nhận thu tiền tay ở /admin-support; null = đơn qua PayOS';
