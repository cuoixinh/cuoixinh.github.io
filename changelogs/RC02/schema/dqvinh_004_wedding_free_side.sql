-- ============================================================
-- Gói Miễn phí: thiệp chỉ mở MỘT bên (nhà trai hoặc nhà gái)
-- Ngày: 2026-10-18
-- ------------------------------------------------------------
-- Khách chọn gói Miễn phí ở trang thanh toán (thay vì trả tiền) kèm bên được mở; link
-- của bên kia tự chuyển về bên đã chọn. Giới hạn của gói ở
-- supabase/functions/_shared/plans.ts → FREE_PLAN. null = chưa chọn gói (nháp, dùng
-- thử 3 ngày — đủ tính năng). Đã thanh toán thì bỏ qua cột.
--
-- Cách chạy: dán vào Supabase → SQL Editor → Run (idempotent, chạy lại an toàn).
--            Chạy trên CẢ HAI project: staging trước, rồi production, TRƯỚC khi
--            deploy wedding-admin + guest-handler (hai function đọc/ghi cột này).
-- ============================================================

alter table public.weddings add column if not exists free_side text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'weddings_free_side_check'
  ) then
    alter table public.weddings
      add constraint weddings_free_side_check check (free_side in ('groom', 'bride'));
  end if;
end $$;

comment on column public.weddings.free_side is 'Gói Miễn phí: bên được mở (groom | bride). null = chưa chọn. Bỏ qua khi payment_status = completed';
