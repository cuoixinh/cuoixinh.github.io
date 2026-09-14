-- ============================================================
-- SCHEMA 06 — `promo_codes` + `promo_redemptions` (mã giảm giá)
--
-- LUẬT NGHIỆP VỤ
--   • Một ĐƠN chỉ áp được MỘT mã (order_id unique trong promo_redemptions).
--   • Một tài khoản dùng được nhiều mã, dùng lại cùng một mã cho thiệp khác cũng
--     được — không giới hạn TỔNG số lần. Nhưng tại một thời điểm chỉ giữ được
--     MỘT lượt đang chờ (chống đốt lượt, xem cx_promo_reserve).
--   • ÁP MÃ LÀ TRỪ LƯỢT NGAY và KHÔNG HOÀN LẠI. Mã 10 lượt, áp 1 lần còn 9;
--     khách bỏ ngang không trả tiền thì vẫn là 9. Cố ý vậy để không ai spam áp
--     mã nhằm khoá lượt của người khác rồi thả ra.
--   • Giữ chỗ có hạn 5 phút — đúng bằng thời gian client chờ quét QR
--     (CONFIG.polling.timeout). Quá hạn thì bản ghi coi như bỏ; muốn trả tiếp
--     phải áp mã lại và lần đó TRỪ THÊM một lượt.
--
--     process()    → cx_promo_reserve : used_count+1 (vĩnh viễn), ghi nhật ký
--     webhook OK   → cx_promo_redeem  : đánh dấu đã chốt (không xét hạn — tiền đã vào)
--     lỗi hệ thống → cx_promo_release : trả lượt, CHỈ khi không tạo nổi đơn
--
--   Việc giành lượt nằm gọn trong MỘT câu update có điều kiện
--   (… where used_count < max_uses) nên Postgres khoá dòng: mã 10 lượt thì
--   người thứ 11 bị chặn kể cả khi cả 11 bấm cùng lúc.
--
-- RLS bật, KHÔNG policy trên cả hai bảng: đọc được danh sách mã phát riêng là
-- dùng được hết chúng.
-- ============================================================

create table if not exists public.promo_codes (
  id               uuid primary key default gen_random_uuid(),
  code             text unique not null,
  discount_type    text not null check (discount_type in ('percent', 'fixed')),
  discount_value   integer not null,
  min_order_amount integer default 0,
  max_uses         integer,
  used_count       integer default 0,
  expires_at       timestamptz,
  show_on_banner   boolean default false,
  is_active        boolean default true,
  note             text,
  batch_id         text,
  created_at       timestamptz default now()
);

alter table public.promo_codes
  add column if not exists note text,
  add column if not exists batch_id text;

comment on column public.promo_codes.code           is 'Mã giảm giá, viết hoa: CUOIXINH2026';
comment on column public.promo_codes.discount_type  is 'percent = giảm %, fixed = giảm số tiền cố định (VND)';
comment on column public.promo_codes.discount_value is '20 = giảm 20% hoặc 20000 = giảm 20.000đ';
comment on column public.promo_codes.min_order_amount is 'Giá trị đơn tối thiểu mới dùng được mã';
comment on column public.promo_codes.max_uses       is 'Số lượt tối đa. Null = không giới hạn';
comment on column public.promo_codes.show_on_banner is 'Hiện mã này trên banner trang chủ';
comment on column public.promo_codes.note           is 'Ghi chú của admin (chiến dịch, người nhận…)';
comment on column public.promo_codes.batch_id       is 'Gom các mã sinh cùng một lô ở trang admin, để lọc/xoá theo lô';

create index if not exists idx_promo_codes_code   on public.promo_codes(code);
create index if not exists idx_promo_codes_active on public.promo_codes(is_active);
create index if not exists idx_promo_codes_batch  on public.promo_codes(batch_id);


-- ============================================================
-- Nhật ký áp mã. Mỗi lần áp mã vào một đơn = một dòng. `order_id` duy nhất nên
-- redeem/release tra đúng dòng chỉ bằng order_id.

create table if not exists public.promo_redemptions (
  id              uuid primary key default gen_random_uuid(),
  code_id         uuid not null references public.promo_codes(id) on delete cascade,
  code            text not null,
  manage_id       uuid,
  user_key        text,
  order_id        text not null unique,
  base_amount     integer not null,
  discount_amount integer not null,
  final_amount    integer not null,
  status          text not null default 'reserved' check (status in ('reserved', 'redeemed', 'released')),
  reserved_at     timestamptz not null default now(),
  expires_at      timestamptz not null,
  redeemed_at     timestamptz
);

alter table public.promo_redemptions
  add column if not exists user_key text;

comment on table  public.promo_redemptions            is 'Nhật ký áp mã giảm giá: mỗi dòng là một lần áp mã vào một đơn';
comment on column public.promo_redemptions.status     is 'reserved = đã trừ lượt, đang chờ trả tiền · redeemed = đã thanh toán · released = huỷ do lỗi hệ thống, lượt đã trả về promo_codes.used_count';
comment on column public.promo_redemptions.expires_at is 'Hạn giữ chỗ 5 phút. Quá hạn mà chưa trả tiền thì bản ghi coi như bỏ — lượt KHÔNG hoàn lại';
comment on column public.promo_redemptions.user_key   is 'Ai đã dùng mã: uid:<user_id> khi đã đăng nhập, email:<email> cho khách vãng lai. Dùng để chặn một người giữ nhiều lượt cùng lúc';

create index if not exists idx_promo_redemptions_code_status on public.promo_redemptions(code_id, status);
create index if not exists idx_promo_redemptions_manage      on public.promo_redemptions(manage_id);
-- drop trước: bản đầu chỉ đánh index (user_key), mà `if not exists` không nâng
-- cấp định nghĩa cũ khi chạy lại.
drop index if exists idx_promo_redemptions_user;
create index if not exists idx_promo_redemptions_user on public.promo_redemptions(user_key, status);


-- ============ RLS ============

alter table public.promo_codes       enable row level security;
alter table public.promo_redemptions enable row level security;

drop policy if exists "Public read active promo" on public.promo_codes;


-- ============ Hàm giữ chỗ / chốt / nhả ============


-- Bản RC1.8 đầu tiên có hàm dọn giữ-chỗ-quá-hạn để hoàn lượt. Luật đã đổi:
-- lượt không bao giờ hoàn, nên gỡ hẳn hàm này.
drop function if exists public.cx_promo_expire_stale(uuid);

-- Giành một lượt dùng mã cho đơn p_order_id. Lượt bị trừ NGAY và không hoàn lại
-- (trừ khi payment-handler gọi cx_promo_release vì không tạo nổi đơn).
-- p_user_key: 'uid:<user_id>' / 'email:<email>' / null — chỉ để tra cứu.
-- Trả jsonb: {ok:true, code, discount_amount, final_amount} hoặc {ok:false, reason, message}.
drop function if exists public.cx_promo_reserve(text, uuid, text, integer);

create or replace function public.cx_promo_reserve(
  p_code text,
  p_manage_id uuid,
  p_order_id text,
  p_base_amount integer,
  p_user_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code public.promo_codes%rowtype;
  v_code_id uuid;
  v_claimed public.promo_codes%rowtype;
  v_discount integer;
  v_existing public.promo_redemptions%rowtype;
begin
  -- Cùng một đơn gọi lại (client thử lại request) → trả kết quả cũ, KHÔNG trừ
  -- thêm lượt. Đây là chống gọi trùng, không phải chống bỏ ngang rồi làm lại:
  -- làm lại đơn mới thì order_id mới và tốn thêm một lượt, đúng như luật.
  select * into v_existing from public.promo_redemptions
   where order_id = p_order_id and status in ('reserved', 'redeemed');
  if found then
    return jsonb_build_object(
      'ok', true, 'code', v_existing.code,
      'discount_amount', v_existing.discount_amount,
      'final_amount', v_existing.final_amount
    );
  end if;

  -- CHỐNG ĐỐT LƯỢT: create-payment gọi được bằng anon key (công khai trong
  -- core/config.js) nên nếu không chặn, một script vài dòng đốt sạch lượt của
  -- mã trong vài giây — mà luật là lượt không hoàn lại. Mỗi danh tính chỉ được
  -- giữ MỘT lượt đang chờ: kẻ phá hoại đốt tối đa 1 lượt/5 phút/email, khách
  -- thật không vướng vì họ chỉ mở một đơn tại một thời điểm.
  --
  -- Không có danh tính thì không có gì để đếm → không cho dùng mã. Nếu bỏ qua
  -- ca này, chỉ cần để trống ô email là vô hiệu hoá toàn bộ lớp chặn bên dưới.
  if p_user_key is null then
    return jsonb_build_object('ok', false, 'reason', 'need_identity',
      'message', 'Vui lòng nhập email hoặc đăng nhập để dùng mã giảm giá');
  end if;

  select * into v_existing from public.promo_redemptions
   where user_key = p_user_key
     and status = 'reserved'
     and expires_at > now()
   limit 1;
  if found then
    return jsonb_build_object('ok', false, 'reason', 'pending_order',
      'message', 'Bạn đang có một đơn chờ thanh toán. Hoàn tất đơn đó hoặc đợi 5 phút rồi thử lại');
  end if;

  -- code là unique nhưng phân biệt hoa/thường, nên về lý thuyết có cả 'abc' lẫn
  -- 'ABC': ưu tiên mã còn bật để khách gõ thường vẫn trúng mã đang chạy.
  select * into v_code from public.promo_codes
   where upper(code) = upper(btrim(p_code))
   order by (is_active is true) desc, created_at desc
   limit 1;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found', 'message', 'Mã không hợp lệ');
  end if;

  v_code_id := v_code.id;

  -- Giành lượt: điều kiện nằm TRONG câu update để hai request song song không
  -- cùng qua được (Postgres khoá dòng khi update).
  update public.promo_codes
     set used_count = coalesce(used_count, 0) + 1
   where id = v_code_id
     and is_active = true
     and (expires_at is null or expires_at > now())
     and (max_uses is null or coalesce(used_count, 0) < max_uses)
     and p_base_amount >= coalesce(min_order_amount, 0)
  returning * into v_claimed;

  if not found then
    -- Đọc lại để báo đúng lý do cho người dùng.
    select * into v_code from public.promo_codes where id = v_code_id;
    if v_code.is_active is not true then
      return jsonb_build_object('ok', false, 'reason', 'inactive', 'message', 'Mã đã bị vô hiệu hoá');
    elsif v_code.expires_at is not null and v_code.expires_at <= now() then
      return jsonb_build_object('ok', false, 'reason', 'expired', 'message', 'Mã đã hết hạn');
    elsif p_base_amount < coalesce(v_code.min_order_amount, 0) then
      return jsonb_build_object('ok', false, 'reason', 'min_order',
        'message', 'Đơn tối thiểu ' || coalesce(v_code.min_order_amount, 0) || 'đ mới dùng được mã này');
    else
      return jsonb_build_object('ok', false, 'reason', 'used_up', 'message', 'Mã đã hết lượt sử dụng');
    end if;
  end if;

  v_discount := case v_claimed.discount_type
    when 'percent' then round(p_base_amount * v_claimed.discount_value / 100.0)
    else v_claimed.discount_value
  end;
  v_discount := least(greatest(v_discount, 0), p_base_amount);

  -- on conflict: đơn cũ cùng order_id đã bị nhả (released) thì ghi đè bằng lượt
  -- vừa giành, không để unique(order_id) làm hỏng cả giao dịch.
  insert into public.promo_redemptions
    (code_id, code, manage_id, user_key, order_id, base_amount, discount_amount, final_amount, expires_at)
  values
    (v_claimed.id, v_claimed.code, p_manage_id, p_user_key, p_order_id, p_base_amount,
     v_discount, p_base_amount - v_discount, now() + interval '5 minutes')
  on conflict (order_id) do update set
    code_id = excluded.code_id,
    code = excluded.code,
    manage_id = excluded.manage_id,
    user_key = excluded.user_key,
    base_amount = excluded.base_amount,
    discount_amount = excluded.discount_amount,
    final_amount = excluded.final_amount,
    status = 'reserved',
    reserved_at = now(),
    expires_at = excluded.expires_at,
    redeemed_at = null;

  return jsonb_build_object(
    'ok', true, 'code', v_claimed.code,
    'discount_amount', v_discount,
    'final_amount', p_base_amount - v_discount
  );
end;
$$;

-- Đánh dấu đã thanh toán. CỐ Ý không xét expires_at: tiền vào sau phút thứ 5 thì
-- vẫn phải ghi nhận, lượt vốn đã bị trừ từ lúc áp mã rồi.
-- Idempotent: PayOS gửi lặp webhook thì lần sau vẫn trả ok.
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

  -- Đã released (đơn bị huỷ vì lỗi hệ thống) mà tiền vẫn vào: giữ nguyên trạng
  -- thái nhưng báo về để edge function ghi log — đây là ca cần người xem lại.
  return jsonb_build_object('ok', v_row.status = 'redeemed', 'status', v_row.status, 'code', v_row.code);
end;
$$;

-- Trả lại lượt. CHỈ dùng khi không tạo nổi đơn (PayOS từ chối, ghi DB hỏng) —
-- lúc đó khách còn chưa thấy mã QR nên không thể coi là "đã dùng mã". Khách bỏ
-- ngang sau khi đã có QR thì KHÔNG gọi hàm này: lượt mất luôn.
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
revoke all on function public.cx_promo_reserve(text, uuid, text, integer, text) from public, anon, authenticated;
revoke all on function public.cx_promo_redeem(text) from public, anon, authenticated;
revoke all on function public.cx_promo_release(text) from public, anon, authenticated;

grant execute on function public.cx_promo_reserve(text, uuid, text, integer, text) to service_role;
grant execute on function public.cx_promo_redeem(text) to service_role;
grant execute on function public.cx_promo_release(text) to service_role;
