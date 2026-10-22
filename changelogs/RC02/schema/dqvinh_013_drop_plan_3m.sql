-- ============================================================
-- Gỡ hẳn gói '3m' khỏi dữ liệu: gói trả phí chỉ còn '6m' (Premium) và 'lifetime'
-- Ngày: 2026-10-21
-- ------------------------------------------------------------
-- Thiệp đang giữ '3m' chuyển sang '6m' và GIỮ NGUYÊN plan_expires_at — khách vẫn dùng
-- đúng thời hạn đã mua, chỉ là mã gói đổi để Edge Function không phải biết '3m'.
-- Đơn PayOS còn treo pending_plan = '3m' cũng đổi sang '6m' (giữ pending_amount):
-- để null là webhook coi như đơn mua trọn đời.
--
-- Cách chạy: dán vào Supabase → SQL Editor → Run (idempotent, chạy lại an toàn).
--            Chạy trên CẢ HAI project, TRƯỚC khi deploy Edge Function.
-- ============================================================

update public.weddings set plan = '6m' where plan = '3m';
update public.weddings set pending_plan = '6m' where pending_plan = '3m';

alter table public.weddings drop constraint if exists weddings_plan_check;
alter table public.weddings
  add constraint weddings_plan_check
  check (plan is null or plan in ('6m', 'lifetime'));

alter table public.weddings drop constraint if exists weddings_pending_plan_check;
alter table public.weddings
  add constraint weddings_pending_plan_check
  check (pending_plan is null or pending_plan in ('6m', 'lifetime'));

comment on column public.weddings.plan is 'Gói đã thanh toán: 6m | lifetime. Null + payment_status completed = mua trước khi có gói = vĩnh viễn';
