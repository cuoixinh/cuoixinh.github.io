-- ============================================================
-- RC1.7 — Siết Row Level Security (RLS)
-- ============================================================
--
-- LÝ DO
-- Anon key nằm công khai trong core/config.js (bắt buộc, vì client cần nó).
-- Các policy cũ dùng `USING (true)` nên bất kỳ ai cũng có thể gọi thẳng
-- PostgREST bằng anon key và đọc/sửa dữ liệu, bỏ qua toàn bộ Edge Function:
--
--   curl 'https://<project>.supabase.co/rest/v1/weddings?select=*' -H 'apikey: <anon>'
--
-- → lộ toàn bộ thiệp (kể cả draft chưa thanh toán): số tài khoản ngân hàng,
--   payment_order_id, transaction_id; enumerate được toàn bộ khách mời mọi đám.
--   Bảng payment_logs thậm chí chưa bật RLS.
--
-- THAY ĐỔI
-- Khoá các bảng nghiệp vụ về "chỉ service_role truy cập được". Đây là thay đổi
-- AN TOÀN vì đã kiểm tra: không có đoạn code client nào truy vấn trực tiếp các
-- bảng này — toàn bộ đi qua Edge Function (dùng service_role, vốn bỏ qua RLS).
-- Client chỉ đọc trực tiếp `templates` và `template_pricing` (catalog công khai)
-- nên hai bảng đó KHÔNG bị đụng tới.
--
-- Sau migration này, tầng phân quyền thật nằm ở Edge Function (ownership check
-- theo user_id — xem docs/security-audit-plan.md #3); RLS là lớp phòng thủ chiều
-- sâu chặn đường đi tắt qua PostgREST.
--
-- CÁCH CHẠY
-- Supabase Dashboard → SQL Editor → dán toàn bộ file này → Run. Idempotent.
--
-- CÁCH HOÀN TÁC (nếu phát hiện luồng nào đó cần đọc anon)
-- Tạo lại policy tương ứng, ví dụ:
--   create policy "Public read" on public.weddings for select using (true);
-- ============================================================


-- ============================================================
-- weddings — chỉ service_role
-- ============================================================
alter table public.weddings enable row level security;

-- Policy cũ cho đọc công khai toàn bộ bảng (kể cả thiệp chưa xuất bản).
drop policy if exists "Public read" on public.weddings;
drop policy if exists "Public read weddings" on public.weddings;


-- ============================================================
-- guests — chỉ service_role
-- ============================================================
alter table public.guests enable row level security;

-- Cho đọc toàn bộ danh sách khách mời của mọi đám cưới.
drop policy if exists "Public read guests" on public.guests;

-- WITH CHECK cũ không giới hạn cột: cho sửa cả full_name/link/side chứ không chỉ
-- các field RSVP như tên policy mô tả.
drop policy if exists "Guest self-update RSVP fields" on public.guests;

-- Chỉ cần biết wedding_id là thêm/xoá được khách mời.
drop policy if exists "Insert guests for existing wedding" on public.guests;
drop policy if exists "Delete guests for existing wedding" on public.guests;


-- ============================================================
-- payment_logs — trước đây CHƯA bật RLS (mở hoàn toàn)
-- ============================================================
alter table public.payment_logs enable row level security;

-- Không tạo policy nào: chỉ service_role (Edge Function) ghi/đọc được.


-- ============================================================
-- orders / order_details — siết INSERT
-- ============================================================
-- INSERT cũ dùng WITH CHECK (true) → ai cũng chèn bản ghi tuỳ ý (spam).
alter table public.orders enable row level security;

drop policy if exists "User insert orders" on public.orders;
create policy "User insert own orders" on public.orders
  for insert with check (auth.uid() = user_id);

alter table public.order_details enable row level security;

drop policy if exists "User insert order details" on public.order_details;
create policy "User insert own order details" on public.order_details
  for insert with check (
    order_id in (select id from public.orders where auth.uid() = user_id)
  );


-- ============================================================
-- Kiểm chứng sau khi chạy
-- ============================================================
-- 1) Liệt kê policy còn lại trên các bảng nghiệp vụ (kỳ vọng: weddings/guests/
--    payment_logs không còn policy nào; orders/order_details chỉ còn policy theo auth.uid()):
--
--    select tablename, policyname, cmd
--    from pg_policies
--    where schemaname = 'public'
--      and tablename in ('weddings','guests','payment_logs','orders','order_details')
--    order by tablename, policyname;
--
-- 2) Xác nhận RLS đã bật trên cả 5 bảng:
--
--    select relname, relrowsecurity
--    from pg_class
--    where relname in ('weddings','guests','payment_logs','orders','order_details');
--
-- 3) Từ terminal, dùng anon key gọi thẳng PostgREST → phải KHÔNG trả dữ liệu:
--
--    curl 'https://<project>.supabase.co/rest/v1/weddings?select=*' -H 'apikey: <anon-key>'
--
-- 4) Hồi quy quan trọng nhất: mở một trang thiệp công khai (/your-slug) và trang
--    quản lý khách mời → vẫn phải hoạt động bình thường (đi qua Edge Function).


-- ============================================================
-- Chẩn đoán kèm theo: quy mô thiệp chưa có chủ
-- ============================================================
-- Liên quan tới việc bắt buộc đăng nhập mới sửa thiệp (docs/security-audit-plan.md #3).
-- Thiệp có user_id IS NULL là thiệp "vô chủ": người đăng nhập đầu tiên mở link sửa
-- sẽ nhận làm chủ. Chạy query dưới đây để biết còn bao nhiêu thiệp như vậy, từ đó
-- quyết định mốc hạn chót chuyển chúng sang chỉ-đọc.
--
--    select
--      count(*) filter (where user_id is null)                          as vo_chu,
--      count(*) filter (where user_id is null and is_published)         as vo_chu_da_xuat_ban,
--      count(*) filter (where user_id is null and payment_status = 'completed') as vo_chu_da_thanh_toan,
--      count(*)                                                          as tong
--    from public.weddings;
