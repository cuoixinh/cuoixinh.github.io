-- ============================================================
-- SCHEMA 04 — Bảng `payment_logs` (nhật ký thanh toán)
--
-- Ghi lại mọi sự kiện của một giao dịch: lúc tạo đơn, webhook PayOS gửi về,
-- kết quả cuối. Dùng để đối soát khi tiền vào mà thiệp chưa mở.
--
-- RLS bật, KHÔNG policy: payload chứa nguyên văn dữ liệu PayOS trả về.
-- ============================================================

create table if not exists public.payment_logs (
  id         uuid primary key default gen_random_uuid(),
  order_id   text not null,
  manage_id  uuid,
  event_type text not null,
  payload    jsonb,
  created_at timestamptz default now()
);

comment on table  public.payment_logs            is 'Nhật ký sự kiện thanh toán, dùng để đối soát';
comment on column public.payment_logs.order_id   is 'Mã đơn PayOS';
comment on column public.payment_logs.manage_id  is 'Thiệp tương ứng (weddings.id)';
comment on column public.payment_logs.event_type is 'created | webhook_received | completed | failed';
comment on column public.payment_logs.payload    is 'Nguyên văn payload từ PayOS hoặc sự kiện nội bộ';

comment on table public.payment_logs is
  'Audit trail for all payment events';
create index if not exists idx_payment_logs_order_id   on public.payment_logs(order_id);
create index if not exists idx_payment_logs_manage_id  on public.payment_logs(manage_id);
create index if not exists idx_payment_logs_created_at on public.payment_logs(created_at desc);

alter table public.payment_logs enable row level security;
