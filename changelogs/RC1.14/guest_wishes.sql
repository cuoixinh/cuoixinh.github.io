-- ============================================================
-- RC1.14 — Lời chúc của khách mời
--
-- Lý do:  Khách mời cầm link cá nhân hoá gửi lời chúc ngay trên thiệp; thiệp
--         hiện danh sách lời chúc cuộn dần.
-- Thay đổi:
--   1. guests.wishes (jsonb)         — mảng lời chúc của chính khách đó,
--                                      mỗi phần tử { id, text, at }.
--   2. weddings.enable_wishes (bool) — công tắc bật/tắt mục ở trang Thiết lập.
-- Cách chạy: Supabase Dashboard → SQL Editor → dán cả file → Run. Idempotent.
-- ============================================================

alter table public.guests
  add column if not exists wishes jsonb not null default '[]'::jsonb;

comment on column public.guests.wishes is
  'Lời chúc khách gửi trên thiệp: mảng { id, text, at }';

-- Hạn mức số lời chúc mỗi khách do Edge Function guest-handler giữ
-- (MAX_WISHES_PER_GUEST), KHÔNG đặt check constraint ở DB: đổi hạn mức thì chỉ
-- sửa một chỗ, và bản ghi cũ vượt mức không làm kẹt mọi UPDATE lên hàng đó.
-- Bản chạy thử trước đó có thể đã tạo ràng buộc này — gỡ cho đồng nhất.
alter table public.guests drop constraint if exists guests_wishes_max3;

alter table public.weddings
  add column if not exists enable_wishes boolean default true;

comment on column public.weddings.enable_wishes is
  'Hiển thị mục Lời chúc (khách mời gửi lời chúc) trên thiệp';
