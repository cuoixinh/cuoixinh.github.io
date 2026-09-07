-- ============================================================
-- RC1.14 — Lời chúc của khách mời
--
-- Lý do:  Khách mời cầm link cá nhân hoá gửi lời chúc ngay trên thiệp; thiệp
--         hiện danh sách lời chúc cuộn dần.
-- Thay đổi:
--   1. guests.wishes (jsonb)         — mảng tối đa 3 lời chúc của chính khách đó,
--                                      mỗi phần tử { id, text, at }.
--   2. weddings.enable_wishes (bool) — công tắc bật/tắt mục ở trang Thiết lập.
-- Cách chạy: Supabase Dashboard → SQL Editor → dán cả file → Run. Idempotent.
-- ============================================================

alter table public.guests
  add column if not exists wishes jsonb not null default '[]'::jsonb;

comment on column public.guests.wishes is
  'Lời chúc khách gửi trên thiệp: mảng { id, text, at }, tối đa 3 phần tử';

-- Ràng buộc số lượng đặt luôn ở DB: Edge Function là nơi duy nhất ghi cột này,
-- nhưng một lỗi ở đó không được phép làm phình vô hạn một hàng jsonb.
-- NOT VALID: chỉ soi hàng ghi mới, không quét lại toàn bảng khi chạy changelog.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'guests_wishes_max3'
  ) then
    alter table public.guests
      add constraint guests_wishes_max3
      check (jsonb_typeof(wishes) = 'array' and jsonb_array_length(wishes) <= 3)
      not valid;
  end if;
end $$;

alter table public.weddings
  add column if not exists enable_wishes boolean default true;

comment on column public.weddings.enable_wishes is
  'Hiển thị mục Lời chúc (khách mời gửi lời chúc) trên thiệp';
