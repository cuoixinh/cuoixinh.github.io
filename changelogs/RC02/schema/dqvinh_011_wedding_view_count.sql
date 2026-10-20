-- ============================================================
-- Số lượt xem thiệp gói Free — đủ FREE_PLAN.views thì khoá (thiệp khác không đếm)
-- Ngày: 2026-10-20
-- ------------------------------------------------------------
-- Bảng riêng chứ không phải cột của `weddings`: mỗi lượt xem là một lần UPDATE, ghi vào
-- `weddings` sẽ kích trigger cx_touch_weddings_updated_at → `updated_at` (mốc "lần lưu
-- cuối" mà cron dọn nháp và danh sách thiệp dựa vào) nhảy theo khách mời.
-- Chỉ wedding-admin (resource=view) gọi cx_wedding_view bằng service_role; luật nào
-- được tính lượt nằm ở Edge Function, hàm này chỉ tăng nguyên tử + chặn trần.
--
-- Cách chạy: dán vào Supabase → SQL Editor → Run (idempotent, chạy lại an toàn).
--            Chạy trên CẢ HAI project, TRƯỚC khi deploy wedding-admin.
-- ============================================================

create table if not exists public.wedding_stats (
  wedding_id  uuid primary key references public.weddings(id) on delete cascade,
  view_count  integer not null default 0,
  updated_at  timestamptz not null default now()
);

comment on table public.wedding_stats is
  'Số lượt mở link công khai của thiệp (wedding-admin resource=view). Xoá thiệp thì cascade';

-- Trình duyệt không bao giờ đọc thẳng bảng (xem RC01/schema/dqvinh_008_grants.sql).
alter table public.wedding_stats enable row level security;
revoke all on table public.wedding_stats from anon, authenticated;

-- Tăng 1 lượt, trừ khi đã chạm p_limit (null = không giới hạn). Điều kiện nằm TRONG
-- câu upsert nên hai lượt xem cùng lúc ở mốc trần không lọt quá trần.
-- Trả {counted, view_count}: counted = false nghĩa là đã đủ trần, không tăng.
create or replace function public.cx_wedding_view(p_wedding_id uuid, p_limit integer default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  insert into public.wedding_stats as s (wedding_id, view_count)
  values (p_wedding_id, 1)
  on conflict (wedding_id) do update
     set view_count = s.view_count + 1, updated_at = now()
   where p_limit is null or s.view_count < p_limit
  returning s.view_count into v_count;

  if found then
    return jsonb_build_object('counted', true, 'view_count', v_count);
  end if;

  select view_count into v_count from public.wedding_stats where wedding_id = p_wedding_id;
  return jsonb_build_object('counted', false, 'view_count', coalesce(v_count, 0));
end;
$$;

revoke all on function public.cx_wedding_view(uuid, integer) from public, anon, authenticated;
grant execute on function public.cx_wedding_view(uuid, integer) to service_role;
