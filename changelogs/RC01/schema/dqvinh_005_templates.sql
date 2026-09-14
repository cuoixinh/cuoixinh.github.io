-- ============================================================
-- SCHEMA 05 — `templates` + `template_pricing` (danh mục mẫu thiệp & giá)
--
-- Danh mục hàng đang bán. Nội dung hai bảng nằm ở `data/dqvinh_001_templates.sql` và
-- `data/dqvinh_002_template_pricing.sql` — file này chỉ dựng cấu trúc.
--
-- Giá ở BẢNG RIÊNG, khớp theo `template_name` (không phải `template_id`): mẫu
-- đổi tên thư mục thì hàng giá cũ nằm lại dưới tên cũ, phải sửa tay.
--
-- RLS bật, KHÔNG policy. Hai bảng này không có gì bí mật (đằng nào cũng hiện ở
-- trang chủ) nhưng vẫn khoá để chỉ còn MỘT chốt kiểm: Edge Function
-- `?resource=public-templates`, worker templates-cache cache lại phản hồi đó.
-- ============================================================

create table if not exists public.templates (
  id            uuid primary key default gen_random_uuid(),
  template_id   text unique not null,
  template_name text not null,
  display_name  text not null,
  description   text,
  thumbnail_url text,
  preview_url   text,
  status        text default 'active',
  category      text,
  sort_order    integer default 0,
  is_active     boolean default true,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- Bản cũ có `features` và `tags` (text[]): không trang nào đọc tới, mọi mẫu đều
-- đủ tính năng, và form admin chưa bao giờ có ô nhập tag.
alter table public.templates
  drop column if exists features,
  drop column if exists tags;

comment on table  public.templates               is 'Danh mục mẫu thiệp đang bán';
comment on column public.templates.template_id   is 'Khoá ổn định của mẫu, dùng trong changelog do admin sinh';
comment on column public.templates.template_name is 'Tên thư mục trong public/themes/ — cũng là khoá nối sang template_pricing';
comment on column public.templates.display_name  is 'Tên hiển thị cho khách: Classic Gold';
comment on column public.templates.preview_url   is 'Đường dẫn xem thử mẫu';
comment on column public.templates.status        is 'active | coming_soon | inactive';
comment on column public.templates.category      is 'traditional | modern | luxury | minimal | vintage';
comment on column public.templates.sort_order    is 'Thứ tự hiện ở trang chủ (số nhỏ lên trước)';

comment on table public.templates is
  'Danh sách mẫu thiệp cưới';
comment on column public.templates.description is
  'Mô tả ngắn về template';
comment on column public.templates.thumbnail_url is
  'URL ảnh thumbnail';
create index if not exists idx_templates_template_id   on public.templates(template_id);
create index if not exists idx_templates_template_name on public.templates(template_name);
create index if not exists idx_templates_status        on public.templates(status);
create index if not exists idx_templates_active        on public.templates(is_active);
create index if not exists idx_templates_sort_order    on public.templates(sort_order);

create or replace function public.update_templates_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists update_templates_updated_at on public.templates;
create trigger update_templates_updated_at
  before update on public.templates
  for each row
  execute function public.update_templates_updated_at();


-- ============================================================

create table if not exists public.template_pricing (
  id             uuid primary key default gen_random_uuid(),
  template_name  text unique not null,
  price          integer not null,
  original_price integer,
  is_active      boolean default true,
  description    text,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

comment on table  public.template_pricing                is 'Giá bán của từng mẫu, khớp theo templates.template_name';
comment on column public.template_pricing.price          is 'Giá khách trả (VND)';
comment on column public.template_pricing.original_price is 'Giá gốc gạch ngang. Null = không khuyến mãi';

create index if not exists idx_template_pricing_name   on public.template_pricing(template_name);
create index if not exists idx_template_pricing_active on public.template_pricing(is_active);

create or replace function public.update_template_pricing_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists update_template_pricing_updated_at on public.template_pricing;
create trigger update_template_pricing_updated_at
  before update on public.template_pricing
  for each row
  execute function public.update_template_pricing_updated_at();


-- ============ RLS ============
-- Policy của bản cũ mở cho `public` (trong Postgres nghĩa là MỌI role, kể cả
-- anon) — chỗ này hay đọc nhầm ở giao diện Policies.

alter table public.templates        enable row level security;
alter table public.template_pricing enable row level security;

drop policy if exists "Anyone can read active templates" on public.templates;
drop policy if exists "Service role can manage templates" on public.templates;
drop policy if exists "Anyone can read active pricing"   on public.template_pricing;
drop policy if exists "Service role can manage pricing"  on public.template_pricing;
