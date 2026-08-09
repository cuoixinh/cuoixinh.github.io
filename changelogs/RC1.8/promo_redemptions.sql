-- ============================================================
-- CHANGELOG RC1.8  —  Mã giảm giá dùng 1 lần: bảng giữ chỗ + 3 hàm chốt mã
-- Base: RC1.7
-- Ngày: 2026-08-09
-- ------------------------------------------------------------
-- Lý do: bảng promo_codes có sẵn từ RC1.0 nhưng chưa có cách đảm bảo "mã chỉ
--   dùng 1 lần". Trừ used_count ngay lúc khách bấm Thanh toán thì mã chết oan
--   khi khách bỏ ngang; trừ lúc webhook báo thành công thì hai người cùng nhập
--   một mã đều qua được. Nên tách làm 2 nhịp GIỮ CHỖ → CHỐT:
--
--     process()      → cx_promo_reserve : used_count+1, giữ chỗ 15 phút theo order_id
--     webhook OK     → cx_promo_redeem  : chốt vĩnh viễn
--     webhook failed → cx_promo_release : trả lại lượt
--     khách bỏ ngang → hết 15' thì lần reserve kế tiếp tự dọn, trả lại lượt
--
--   Việc giành lượt nằm gọn trong MỘT câu update có điều kiện
--   (... where used_count < max_uses) nên Postgres khoá dòng, hai người cùng
--   nhập một mã thì chỉ một người giành được.
--
-- Thay đổi:
--   + Bảng promo_redemptions: nhật ký từng lần áp mã (giữ chỗ / đã chốt / đã nhả).
--   + promo_codes: thêm cột note, batch_id (gom mã sinh cùng lô ở trang admin).
--   + 3 hàm security definer: cx_promo_reserve / cx_promo_redeem / cx_promo_release.
--     Chỉ edge function (service_role) gọi được — đã revoke khỏi anon/authenticated.
--
-- Cách chạy: dán vào Supabase → SQL Editor → Run (idempotent).
-- ============================================================

-- ============ 1. Cột bổ sung cho promo_codes ============

alter table public.promo_codes
  add column if not exists note text,
  add column if not exists batch_id text;

comment on column public.promo_codes.note is 'Ghi chú của admin (chiến dịch, người nhận…)';
comment on column public.promo_codes.batch_id is 'Gom các mã sinh cùng một lô ở trang admin, để lọc/xoá theo lô';

create index if not exists idx_promo_codes_batch on public.promo_codes(batch_id);

-- ============ 2. Bảng promo_redemptions ============
-- Mỗi lần áp mã vào một đơn = một dòng. order_id là duy nhất: một đơn chỉ áp
-- được một mã, và nhờ vậy redeem/release tra đúng dòng chỉ bằng order_id.

create table if not exists public.promo_redemptions (
  id uuid primary key default gen_random_uuid(),
  code_id uuid not null references public.promo_codes(id) on delete cascade,
  code text not null,
  manage_id uuid,
  order_id text not null unique,
  base_amount integer not null,
  discount_amount integer not null,
  final_amount integer not null,
  status text not null default 'reserved' check (status in ('reserved', 'redeemed', 'released')),
  reserved_at timestamptz not null default now(),
  expires_at timestamptz not null,
  redeemed_at timestamptz
);

comment on table public.promo_redemptions is 'Nhật ký áp mã giảm giá: giữ chỗ lúc tạo đơn → chốt khi webhook báo thanh toán thành công';
comment on column public.promo_redemptions.status is 'reserved = đang giữ chỗ (còn hạn expires_at) · redeemed = đã chốt · released = đã nhả, lượt trả về promo_codes.used_count';
comment on column public.promo_redemptions.expires_at is 'Hết hạn giữ chỗ (15 phút). Quá hạn mà vẫn reserved → lần reserve kế tiếp của cùng mã sẽ tự nhả';

create index if not exists idx_promo_redemptions_code_status on public.promo_redemptions(code_id, status);
create index if not exists idx_promo_redemptions_manage on public.promo_redemptions(manage_id);

-- RLS bật nhưng CỐ Ý không có policy nào: chỉ service_role (edge function) đụng
-- tới bảng này; anon/authenticated không đọc được lịch sử dùng mã của người khác.
alter table public.promo_redemptions enable row level security;

-- ============ 3. Hàm giữ chỗ / chốt / nhả ============

-- Nhả các lượt giữ chỗ đã quá hạn của MỘT mã. Gọi ngay trước khi giành lượt mới
-- nên không cần cron dọn định kỳ.
create or replace function public.cx_promo_expire_stale(p_code_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_freed integer;
begin
  with expired as (
    update public.promo_redemptions
       set status = 'released'
     where code_id = p_code_id
       and status = 'reserved'
       and expires_at < now()
    returning 1
  )
  select count(*) into v_freed from expired;

  if v_freed > 0 then
    update public.promo_codes
       set used_count = greatest(0, coalesce(used_count, 0) - v_freed)
     where id = p_code_id;
  end if;
end;
$$;

-- Giành một lượt dùng mã cho đơn p_order_id.
-- Trả jsonb: {ok:true, code, discount_amount, final_amount} hoặc {ok:false, reason, message}.
create or replace function public.cx_promo_reserve(
  p_code text,
  p_manage_id uuid,
  p_order_id text,
  p_base_amount integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code public.promo_codes%rowtype;
  v_claimed public.promo_codes%rowtype;
  v_discount integer;
  v_existing public.promo_redemptions%rowtype;
begin
  -- Đơn đã áp mã rồi (client gọi lại) → trả lại đúng kết quả cũ, không giành thêm lượt.
  select * into v_existing from public.promo_redemptions
   where order_id = p_order_id and status in ('reserved', 'redeemed');
  if found then
    return jsonb_build_object(
      'ok', true, 'code', v_existing.code,
      'discount_amount', v_existing.discount_amount,
      'final_amount', v_existing.final_amount
    );
  end if;

  select * into v_code from public.promo_codes where upper(code) = upper(btrim(p_code));
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found', 'message', 'Mã không hợp lệ');
  end if;

  perform public.cx_promo_expire_stale(v_code.id);

  -- Giành lượt: điều kiện nằm TRONG câu update để hai request song song không
  -- cùng qua được (Postgres khoá dòng khi update).
  update public.promo_codes
     set used_count = coalesce(used_count, 0) + 1
   where id = v_code.id
     and is_active = true
     and (expires_at is null or expires_at > now())
     and (max_uses is null or coalesce(used_count, 0) < max_uses)
     and p_base_amount >= coalesce(min_order_amount, 0)
  returning * into v_claimed;

  if not found then
    -- Đọc lại để báo đúng lý do cho người dùng.
    select * into v_code from public.promo_codes where id = v_code.id;
    if v_code.is_active is not true then
      return jsonb_build_object('ok', false, 'reason', 'inactive', 'message', 'Mã đã bị vô hiệu hoá');
    elsif v_code.expires_at is not null and v_code.expires_at <= now() then
      return jsonb_build_object('ok', false, 'reason', 'expired', 'message', 'Mã đã hết hạn');
    elsif p_base_amount < coalesce(v_code.min_order_amount, 0) then
      return jsonb_build_object('ok', false, 'reason', 'min_order',
        'message', 'Đơn tối thiểu ' || coalesce(v_code.min_order_amount, 0) || 'đ mới dùng được mã này');
    else
      return jsonb_build_object('ok', false, 'reason', 'used_up', 'message', 'Mã đã được sử dụng');
    end if;
  end if;

  v_discount := case v_claimed.discount_type
    when 'percent' then round(p_base_amount * v_claimed.discount_value / 100.0)
    else v_claimed.discount_value
  end;
  v_discount := least(greatest(v_discount, 0), p_base_amount);

  insert into public.promo_redemptions
    (code_id, code, manage_id, order_id, base_amount, discount_amount, final_amount, expires_at)
  values
    (v_claimed.id, v_claimed.code, p_manage_id, p_order_id, p_base_amount,
     v_discount, p_base_amount - v_discount, now() + interval '15 minutes');

  return jsonb_build_object(
    'ok', true, 'code', v_claimed.code,
    'discount_amount', v_discount,
    'final_amount', p_base_amount - v_discount
  );
end;
$$;

-- Chốt lượt đã giữ. Idempotent: PayOS gửi lặp webhook thì lần sau vẫn trả ok.
create or replace function public.cx_promo_redeem(p_order_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.promo_redemptions%rowtype;
begin
  update public.promo_redemptions
     set status = 'redeemed', redeemed_at = now()
   where order_id = p_order_id and status = 'reserved'
  returning * into v_row;

  if found then
    return jsonb_build_object('ok', true, 'code', v_row.code);
  end if;

  select * into v_row from public.promo_redemptions where order_id = p_order_id;
  if not found then
    return jsonb_build_object('ok', true, 'note', 'no_promo');
  end if;

  -- Đã released (giữ chỗ quá hạn) mà tiền vẫn vào: giữ nguyên trạng thái nhưng
  -- báo về để edge function ghi log — đây là ca cần người xem lại.
  return jsonb_build_object('ok', v_row.status = 'redeemed', 'status', v_row.status, 'code', v_row.code);
end;
$$;

-- Nhả lượt đang giữ, trả lại used_count. Idempotent.
create or replace function public.cx_promo_release(p_order_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.promo_redemptions%rowtype;
begin
  update public.promo_redemptions
     set status = 'released'
   where order_id = p_order_id and status = 'reserved'
  returning * into v_row;

  if not found then
    return jsonb_build_object('ok', true, 'note', 'nothing_to_release');
  end if;

  update public.promo_codes
     set used_count = greatest(0, coalesce(used_count, 0) - 1)
   where id = v_row.code_id;

  return jsonb_build_object('ok', true, 'code', v_row.code);
end;
$$;

-- Chỉ edge function (service_role) được gọi. Client dùng anon key phải đi qua
-- payment-handler, không tự giành lượt được.
revoke all on function public.cx_promo_expire_stale(uuid) from public, anon, authenticated;
revoke all on function public.cx_promo_reserve(text, uuid, text, integer) from public, anon, authenticated;
revoke all on function public.cx_promo_redeem(text) from public, anon, authenticated;
revoke all on function public.cx_promo_release(text) from public, anon, authenticated;

grant execute on function public.cx_promo_expire_stale(uuid) to service_role;
grant execute on function public.cx_promo_reserve(text, uuid, text, integer) to service_role;
grant execute on function public.cx_promo_redeem(text) to service_role;
grant execute on function public.cx_promo_release(text) to service_role;
