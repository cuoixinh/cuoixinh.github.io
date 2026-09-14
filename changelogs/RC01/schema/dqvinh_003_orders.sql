-- ============================================================
-- SCHEMA 03 — `orders` + `order_details` (đơn đặt thiệp)
--
-- Hai bảng này KHÁC với luồng thanh toán PayOS đang chạy (dữ liệu thanh toán
-- nằm ngay trên `weddings`: payment_status, payment_order_id…). Đây là luồng
-- "đặt làm thiệp", giữ lại cho các đơn cũ.
--
-- Đây cũng là hai bảng DUY NHẤT còn policy cho người dùng thật: đọc/ghi đơn của
-- chính mình theo `auth.uid()`.
-- ============================================================

create table if not exists public.orders (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete set null,
  guest_email text,
  status      text default 'pending',
  theme       text not null,
  slug        text,
  note        text,
  total_price integer default 0,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

comment on column public.orders.user_id     is 'Tài khoản đặt đơn (null = đặt khi chưa đăng nhập)';
comment on column public.orders.guest_email is 'Email khách khi chưa đăng nhập';
comment on column public.orders.status      is 'pending | processing | completed | cancelled';
comment on column public.orders.theme       is 'Mẫu thiệp khách chọn';
comment on column public.orders.slug        is 'Đường dẫn thiệp sau khi dựng xong';
comment on column public.orders.total_price is 'Giá trị đơn (VND)';

create index if not exists idx_orders_user_id     on public.orders(user_id);
create index if not exists idx_orders_guest_email on public.orders(guest_email);
create index if not exists idx_orders_status      on public.orders(status);


create table if not exists public.order_details (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references public.orders(id) on delete cascade,
  groom_name    text,
  bride_name    text,
  ceremony_date date,
  ceremony_time text,
  contact_name  text,
  contact_phone text,
  contact_email text,
  extra_note    text,
  created_at    timestamptz default now()
);

comment on column public.order_details.extra_note is 'Yêu cầu thêm của khách';

comment on column public.order_details.order_id is
  'FK đến bảng orders';
comment on column public.order_details.groom_name is
  'Tên chú rể KH cung cấp';
comment on column public.order_details.bride_name is
  'Tên cô dâu KH cung cấp';
comment on column public.order_details.ceremony_date is
  'Ngày cưới KH cung cấp';
comment on column public.order_details.contact_name is
  'Tên người liên hệ';
comment on column public.order_details.contact_phone is
  'SĐT liên hệ';
comment on column public.order_details.contact_email is
  'Email liên hệ';

-- ============ RLS ============
-- INSERT của bản cũ dùng `with check (true)` → ai cũng chèn bản ghi tuỳ ý
-- (spam). Giờ buộc đơn phải thuộc về chính người đang đăng nhập.

alter table public.orders enable row level security;

drop policy if exists "User insert orders" on public.orders;
drop policy if exists "User read own orders" on public.orders;

create policy "User read own orders" on public.orders
  for select using (auth.uid() = user_id);

create policy "User insert own orders" on public.orders
  for insert with check (auth.uid() = user_id);


alter table public.order_details enable row level security;

drop policy if exists "User insert order details" on public.order_details;
drop policy if exists "User read own order details" on public.order_details;

create policy "User read own order details" on public.order_details
  for select using (
    order_id in (select id from public.orders where auth.uid() = user_id)
  );

create policy "User insert own order details" on public.order_details
  for insert with check (
    order_id in (select id from public.orders where auth.uid() = user_id)
  );
