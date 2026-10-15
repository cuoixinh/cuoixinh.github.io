-- ============================================================
-- Mã giảm giá theo % tính trên GIÁ GỐC (giá gạch ngang), không phải giá đang bán
-- Ngày: 2026-10-15
-- ------------------------------------------------------------
-- Thêm tham số p_discount_base: số tiền làm nền cho mã giảm theo %. payment-handler
-- truyền giá gốc của gói (template_pricing.original_price × hệ số gói); đơn nâng gói
-- không có giá gốc → để null = tính trên p_base_amount như trước. Mức giảm vẫn kẹp
-- trong [0, p_base_amount] (không bao giờ âm tiền), đơn tối thiểu vẫn so với số
-- tiền phải trả (p_base_amount).
--
-- Tham số mới có DEFAULT nên Edge Function bản cũ (gọi 5 tham số) vẫn chạy. Bỏ hẳn
-- bản 5 tham số trước khi tạo: để cả hai thì PostgREST không chọn được hàm nào.
--
-- Cách chạy: dán vào Supabase → SQL Editor → Run (idempotent, chạy lại an toàn).
--            Chạy trên CẢ HAI project: staging trước, rồi production, TRƯỚC khi
--            deploy payment-handler.
-- ============================================================

drop function if exists public.cx_promo_reserve(text, uuid, text, integer, text);

create or replace function public.cx_promo_reserve(
  p_code text,
  p_manage_id uuid,
  p_order_id text,
  p_base_amount integer,
  p_user_key text default null,
  p_discount_base integer default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
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

  -- CHỐNG ĐỐT LƯỢT: mỗi danh tính chỉ được giữ MỘT lượt đang chờ. Không có danh
  -- tính thì không có gì để đếm → không cho dùng mã.
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

  -- code là unique nhưng phân biệt hoa/thường: ưu tiên mã còn bật.
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

  -- Giảm theo % tính trên GIÁ GỐC (p_discount_base) nếu có, rồi trừ vào số phải trả.
  v_discount := case v_claimed.discount_type
    when 'percent' then round(greatest(coalesce(p_discount_base, p_base_amount), p_base_amount)
                              * v_claimed.discount_value / 100.0)
    else v_claimed.discount_value
  end;
  v_discount := least(greatest(v_discount, 0), p_base_amount);

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
$function$;

-- Chỉ Edge Function (service_role) được gọi — giữ đúng quyền của bản cũ.
revoke all on function public.cx_promo_reserve(text, uuid, text, integer, text, integer) from public, anon, authenticated;
grant execute on function public.cx_promo_reserve(text, uuid, text, integer, text, integer) to service_role;
