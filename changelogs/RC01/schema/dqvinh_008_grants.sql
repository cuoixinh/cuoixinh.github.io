-- ============================================================
-- SCHEMA 08 — Thu quyền của `anon` / `authenticated` (chạy CUỐI)
--
-- LÝ DO
--   `anonKey` nằm công khai trong core/config.js (đúng thiết kế của Supabase),
--   nên MỌI quyền cấp cho role `anon` là quyền của bất kỳ ai mở F12. RLS chặn
--   theo HÀNG, còn grant là quyền ở mức BẢNG — phải khoá cả hai.
--
--   Thu cả `authenticated`: không trang nào gọi PostgREST bằng token người dùng
--   (mọi DAL ở core/dal/ đều trỏ tới Edge Function), nên để lại chỉ là bề mặt
--   thừa.
--
--   Sau file này, đường vào dữ liệu chỉ còn ĐÚNG hai lối không phải SQL:
--   /auth/v1/ (đăng nhập) và Storage (xem manual/01).
--
-- Chạy CUỐI CÙNG trong nhóm schema: nó gỡ cả policy nên phải đứng sau mọi file
-- tạo bảng.
-- ============================================================

-- ── A. Hiện trạng trước khi sửa ─────────────────────────────────────────────
select table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee in ('anon', 'authenticated')
order by table_name, grantee, privilege_type;


-- ── B. Thu quyền ────────────────────────────────────────────────────────────

revoke all on table public.weddings          from anon, authenticated;
revoke all on table public.guests            from anon, authenticated;
revoke all on table public.payment_logs      from anon, authenticated;
revoke all on table public.promo_codes       from anon, authenticated;
revoke all on table public.promo_redemptions from anon, authenticated;
revoke all on table public.templates         from anon, authenticated;
revoke all on table public.template_pricing  from anon, authenticated;
revoke all on table public.ai_usage          from anon, authenticated;
revoke all on table public.ai_usage_ip       from anon, authenticated;
revoke all on table public.ai_chat_usage     from anon, authenticated;

-- `orders` / `order_details` GIỮ quyền: đây là hai bảng duy nhất người dùng thật
-- đọc/ghi trực tiếp, và policy theo auth.uid() đã giới hạn về đơn của chính họ.

-- Chặn quyền tự mọc lại khi sau này có ai chạy `grant … to anon` theo mặc định.
alter default privileges in schema public revoke all on tables from anon;

-- Lớp phòng thủ thứ hai: gỡ mọi policy còn mở cho anon/public trên các bảng
-- nghiệp vụ. `public` trong Postgres nghĩa là MỌI role, kể cả anon — đây là chỗ
-- hay đọc nhầm ở giao diện Policies.
do $$
declare p record;
begin
  for p in
    select policyname, tablename
    from pg_policies
    where schemaname = 'public'
      and tablename in ('weddings','guests','payment_logs','promo_codes',
                        'promo_redemptions','templates','template_pricing',
                        'ai_usage','ai_usage_ip','ai_chat_usage')
      and (roles::text[] && array['anon','public'])
  loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
    raise notice 'đã gỡ policy % trên %', p.policyname, p.tablename;
  end loop;
end $$;


-- ── C. Kiểm lại ─────────────────────────────────────────────────────────────
-- 1) Chạy lại truy vấn ở mục A → phải 0 dòng (trừ orders/order_details).
--
-- 2) RLS phải bật trên mọi bảng nghiệp vụ:
--
--    select relname, relrowsecurity from pg_class
--    where relnamespace = 'public'::regnamespace and relkind = 'r'
--    order by relname;
--
-- 3) Từ máy, gọi thẳng PostgREST bằng anon key → phải KHÔNG ra dữ liệu:
--
--    for t in weddings guests promo_codes templates template_pricing; do
--      curl -s "https://<ref>.supabase.co/rest/v1/$t?select=*&limit=2" \
--        -H "apikey: <ANON_KEY>" -H "Authorization: Bearer <ANON_KEY>"; echo; done
--
-- 4) Hồi quy — những đường HỢP LỆ vẫn phải chạy (kiểm bằng trình duyệt):
--    • Trang chủ hiện đủ lưới mẫu thiệp + giá   → worker templates-cache
--    • Mở một thiệp công khai /<slug>            → wedding-admin?slug=
--    • Nhập mã giảm giá ở màn thanh toán        → wedding-admin?resource=promo
