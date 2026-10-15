-- ============================================================
-- Gói thời hạn của thiệp: 3 tháng · 6 tháng · vĩnh viễn
-- Ngày: 2026-10-15
-- ------------------------------------------------------------
-- Giá vẫn chỉ có MỘT cột: template_pricing.price = giá gói 3 tháng. Giá gói khác
-- suy ra bằng hệ số ở supabase/functions/_shared/plans.ts, không lưu ở DB.
--
-- Thiệp đã thanh toán trước khi có gói: plan = null, plan_expires_at = null →
-- coi là VĨNH VIỄN, không cần backfill. Hạn dùng thử (expires_at) giữ nguyên.
--
-- Cách chạy: dán vào Supabase → SQL Editor → Run (idempotent, chạy lại an toàn).
--            Chạy trên CẢ HAI project: staging trước, rồi production, TRƯỚC khi
--            deploy Edge Function.
-- ============================================================

alter table public.weddings add column if not exists plan            text;
alter table public.weddings add column if not exists plan_expires_at timestamptz;
alter table public.weddings add column if not exists pending_plan    text;
alter table public.weddings add column if not exists pending_amount  integer;

comment on column public.weddings.plan            is 'Gói đã thanh toán: 3m | 6m | lifetime. Null + payment_status completed = mua trước khi có gói = vĩnh viễn';
comment on column public.weddings.plan_expires_at is 'Hết hạn gói đã thanh toán. Null = vĩnh viễn. Quá hạn thì khoá với khách mời, quá thêm RETENTION_DAYS thì cron xoá';
comment on column public.weddings.pending_plan    is 'Gói của đơn PayOS đang chờ (payment_order_id). Webhook áp xong thì xoá về null';
comment on column public.weddings.pending_amount  is 'Số tiền của đơn đang chờ (đã trừ mã giảm giá) — webhook đối chiếu với số PayOS báo';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'weddings_plan_check') then
    alter table public.weddings
      add constraint weddings_plan_check
      check (plan is null or plan in ('3m', '6m', 'lifetime'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'weddings_pending_plan_check') then
    alter table public.weddings
      add constraint weddings_pending_plan_check
      check (pending_plan is null or pending_plan in ('3m', '6m', 'lifetime'));
  end if;
end $$;

-- Câu quét "hết hạn gói" của cleanup-weddings.
create index if not exists idx_weddings_plan_expires_at
  on public.weddings(plan_expires_at)
  where plan_expires_at is not null;
