-- ============================================================
-- RC1.16 — Thu quyền đọc thẳng bảng của role `anon` (PostgREST)
--
-- ⚠ THỨ TỰ BẮT BUỘC: deploy worker templates-cache TRƯỚC, chạy file này SAU.
--    Worker bản cũ gọi thẳng /rest/v1/templates bằng anon key; chạy SQL trước
--    khi deploy là lưới chọn mẫu ở trang chủ trắng cho tới lúc worker lên.
--        cd cloudflare-worker
--        wrangler secret put EDGE_URL --config wrangler-templates.toml
--        wrangler deploy --config wrangler-templates.toml
--
-- LÝ DO
--   `anonKey` nằm công khai trong core/config.js (đúng thiết kế của Supabase),
--   nên MỌI quyền cấp cho role `anon` là quyền của bất kỳ ai mở F12. Đo ngày
--   2026-09-11 bằng chính anon key đó:
--
--     GET /rest/v1/promo_codes?select=*   → HTTP 200, 6 hàng
--
--   Trong đó 5 mã `show_on_banner = false` — mã phát riêng cho từng khách,
--   giảm 20%, mỗi mã 3 lượt. Đọc được danh sách là dùng được hết. Không trang
--   nào của web đọc bảng này: client chỉ hỏi TỪNG mã một qua Edge Function
--   (`wedding-admin?resource=promo&code=...`), nên quyền đọc kia thừa hoàn toàn.
--
--     GET /rest/v1/templates          → HTTP 200, danh mục mẫu
--     GET /rest/v1/template_pricing   → HTTP 200, bảng giá
--
--   Hai bảng này không chứa gì nhạy cảm (đằng nào cũng hiện ở trang chủ), nhưng
--   là đường đọc DB duy nhất còn lại không đi qua Edge Function. Bịt nốt để chỉ
--   còn MỘT chốt kiểm.
--
-- KHÔNG ảnh hưởng gì khác:
--   • Edge Function dùng service_role → bỏ qua RLS và không đụng grant của anon.
--   • weddings / guests / payment_logs / ai_usage… đã trả 0 hàng cho anon từ
--     RC1.7, file này không đổi gì ở đó.
--   • Đăng nhập (GoTrue, /auth/v1/) không liên quan tới grant trên schema public.
-- ============================================================


-- ── A. Hiện trạng trước khi sửa ─────────────────────────────────────────────
select table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee in ('anon', 'authenticated')
  and table_name in ('promo_codes', 'promo_redemptions', 'templates', 'template_pricing')
order by table_name, grantee, privilege_type;


-- ── B. Thu quyền ────────────────────────────────────────────────────────────
-- Thu cả `authenticated`: không trang nào gọi PostgREST bằng token người dùng
-- (mọi DAL ở core/dal/ đều trỏ tới Edge Function), nên để lại chỉ là bề mặt thừa.

revoke all on table public.promo_codes       from anon, authenticated;
revoke all on table public.promo_redemptions from anon, authenticated;
revoke all on table public.templates         from anon, authenticated;
revoke all on table public.template_pricing  from anon, authenticated;

-- Chặn quyền tự mọc lại khi sau này có ai chạy `grant ... to anon` theo mặc định.
alter default privileges in schema public revoke all on tables from anon;

-- Lớp phòng thủ thứ hai: có RLS thì dù lỡ cấp lại grant, không policy = 0 hàng.
alter table public.promo_codes       enable row level security;
alter table public.promo_redemptions enable row level security;
alter table public.templates         enable row level security;
alter table public.template_pricing  enable row level security;

-- Gỡ mọi policy đang mở cho anon/public trên 4 bảng này. `public` trong Postgres
-- nghĩa là MỌI role, kể cả anon — đây là chỗ hay đọc nhầm ở giao diện Policies.
do $$
declare p record;
begin
  for p in
    select policyname, tablename
    from pg_policies
    where schemaname = 'public'
      and tablename in ('promo_codes','promo_redemptions','templates','template_pricing')
      and (roles::text[] && array['anon','public'])
  loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
    raise notice 'đã gỡ policy % trên %', p.policyname, p.tablename;
  end loop;
end $$;


-- ── C. Kiểm lại ─────────────────────────────────────────────────────────────
-- Truy vấn ở mục A phải trả về 0 dòng.
--
-- Và từ máy (thay <ANON_KEY>) — cả 4 lệnh phải trả về [] hoặc lỗi quyền,
-- KHÔNG được ra dữ liệu:
--
--   for t in promo_codes promo_redemptions templates template_pricing; do
--     curl -s "https://lcobawmkywtxhpezndsh.supabase.co/rest/v1/$t?select=*&limit=2" \
--       -H "apikey: <ANON_KEY>" -H "Authorization: Bearer <ANON_KEY>"; echo; done
--
-- Còn những đường HỢP LỆ vẫn phải chạy (kiểm bằng trình duyệt):
--   • Trang chủ hiện đủ lưới mẫu thiệp + giá   → worker templates-cache
--   • Nhập mã giảm giá ở màn thanh toán        → wedding-admin?resource=promo
--   • Tab Mã giảm giá trong /admin              → wedding-admin?resource=promo-codes
