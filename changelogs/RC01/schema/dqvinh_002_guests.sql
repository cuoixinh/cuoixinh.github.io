-- ============================================================
-- SCHEMA 02 — Bảng `guests` (khách mời)
--
-- Mỗi hàng là một khách của một thiệp, kèm link cá nhân hoá, kết quả RSVP và
-- lời chúc họ gửi. Xoá thiệp là xoá theo (cascade).
--
-- RLS bật, KHÔNG policy: khách mời gửi RSVP/lời chúc qua Edge Function
-- `guest-handler` chứ không ghi thẳng bảng. Mở policy ở đây là cho phép bất kỳ
-- ai liệt kê toàn bộ khách mời của mọi đám chỉ bằng anon key.
-- ============================================================

create table if not exists public.guests (
  id           uuid primary key default gen_random_uuid(),
  wedding_id   uuid not null references public.weddings(id) on delete cascade,
  side         text not null check (side in ('groom', 'bride')),
  full_name    text not null check (char_length(full_name) between 1 and 200),
  display_name text check (display_name is null or char_length(display_name) <= 200),
  relationship text check (relationship is null or char_length(relationship) <= 100),
  link         text check (link is null or char_length(link) <= 2048),
  viewed       boolean default false,
  viewed_at    timestamptz,
  confirmed    text check (confirmed is null or confirmed in ('Có tham dự', 'Không tham dự')),
  message      text check (message is null or char_length(message) <= 1000),
  confirmed_at timestamptz,
  wishes       jsonb not null default '[]'::jsonb,
  created_at   timestamptz default now()
);

alter table public.guests
  add column if not exists wishes jsonb not null default '[]'::jsonb;

-- Hạn mức lời chúc mỗi khách do Edge Function `guest-handler` giữ
-- (MAX_WISHES_PER_GUEST), CỐ Ý không đặt check constraint: đổi hạn mức thì chỉ
-- sửa một chỗ, và hàng cũ vượt mức không làm kẹt mọi UPDATE lên hàng đó.
alter table public.guests drop constraint if exists guests_wishes_max3;

comment on table  public.guests              is 'Khách mời của từng thiệp (nhập tay hoặc từ Excel)';
comment on column public.guests.side         is 'Bên mời: groom (nhà trai) | bride (nhà gái)';
comment on column public.guests.display_name is 'Tên hiển thị trên thiệp (vd: Anh Minh)';
comment on column public.guests.relationship is 'Xưng hô/quan hệ, đi kèm tên trong link cá nhân hoá';
comment on column public.guests.link         is 'Link thiệp riêng đã tạo cho khách này';
comment on column public.guests.viewed       is 'Khách đã mở thiệp chưa';
comment on column public.guests.confirmed    is 'Kết quả RSVP: Có tham dự | Không tham dự';
comment on column public.guests.message      is 'Lời nhắn gửi kèm lúc xác nhận RSVP';
comment on column public.guests.wishes       is 'Lời chúc khách gửi trên thiệp: mảng { id, text, at }';

comment on table public.guests is
  'Danh sách khách mời, nhập từ file Excel';
comment on column public.guests.wedding_id is
  'FK đến weddings.id';
comment on column public.guests.full_name is
  'Họ và tên đầy đủ';
comment on column public.guests.viewed_at is
  'Thời gian khách xem thiệp lần đầu';
comment on column public.guests.confirmed_at is
  'Thời gian khách xác nhận tham dự';
create index if not exists idx_guests_wedding_id on public.guests(wedding_id, side);


-- ============ RLS ============

alter table public.guests enable row level security;

-- Policy của bản cũ: cho đọc toàn bộ khách mời, và chỉ cần biết wedding_id là
-- thêm/sửa/xoá được.
drop policy if exists "Public read guests"                on public.guests;
drop policy if exists "Guest self-update RSVP fields"     on public.guests;
drop policy if exists "Insert guests for existing wedding" on public.guests;
drop policy if exists "Delete guests for existing wedding" on public.guests;
