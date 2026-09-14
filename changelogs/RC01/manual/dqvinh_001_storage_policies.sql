-- ============================================================
-- MANUAL 01 — Khoá kho ảnh `wedding-images`
--
-- ⚠ KHÔNG CHẠY ĐƯỢC BẰNG SQL EDITOR. Phải làm bằng giao diện Dashboard (mục B).
--   Phần SQL ở đây chỉ để XEM và KIỂM TRA lại.
--
--   Lý do: `storage.objects` thuộc sở hữu của `supabase_storage_admin`, còn SQL
--   Editor chạy dưới vai `postgres`. alter table / create policy / drop policy
--   đều đòi QUYỀN SỞ HỮU BẢNG nên gặp:
--       ERROR: 42501: must be owner of table objects
--   Đường vòng `set role supabase_storage_admin` cũng bị chặn:
--       ERROR: 42501: permission denied to set role
--   (Đã thử cả hai — không phải lỗi cú pháp, đừng thử lại.)
--
-- LÝ DO PHẢI KHOÁ
--   Với `anonKey` (công khai trong core/config.js), bất kỳ ai cũng gọi được
--       POST /storage/v1/object/list/wedding-images
--   và nhận TOÀN BỘ danh sách file. Bucket để public nên danh sách đó vừa cho
--   tải mọi ảnh, vừa lộ định danh để tra tiếp hồ sơ thiệp qua Edge Function.
--
--   KHÔNG ảnh hưởng người xem thiệp: ảnh hiển thị qua
--   /storage/v1/object/public/wedding-images/<file>, đường `public` KHÔNG đi qua
--   RLS. Khách mời không đăng nhập vẫn xem thiệp bình thường.
-- ============================================================


-- ── A. Xem hiện trạng (chạy được ở SQL Editor) ──────────────────────────────
-- pg_policies là view đọc, không cần quyền sở hữu.

select policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'storage' and tablename = 'objects'
order by policyname;


-- ── B. Việc phải làm, bằng giao diện ────────────────────────────────────────
--
--   Dashboard → Storage → tạo bucket `wedding-images`, để **Public** → tab Policies
--
--   1. XOÁ HẾT policy đang có trên bucket này — đặc biệt policy có role `anon`,
--      hoặc role để trống (trống = áp cho TẤT CẢ, kể cả anon).
--
--   2. New policy → "For full customization" → tạo ĐÚNG hai cái:
--
--      ┌ cx_wedding_images_select_auth
--      │   Allowed operation : SELECT
--      │   Target roles      : authenticated
--      │   USING expression  : bucket_id = 'wedding-images'
--      └ (để chủ thiệp còn liệt kê/đọc qua API có xác thực)
--
--      ┌ cx_wedding_images_insert_auth
--      │   Allowed operation : INSERT
--      │   Target roles      : authenticated
--      │   WITH CHECK        : bucket_id = 'wedding-images'
--      └ (để trang Thiết lập upload ảnh SAU KHI đăng nhập)
--
--   3. KHÔNG tạo policy UPDATE hay DELETE cho bất kỳ role nào.
--      Xoá ảnh là việc của Edge Function bằng service_role — nó bỏ qua RLS nên
--      không cần policy, và nó kiểm ảnh có thuộc đúng thiệp không trước khi xoá.
--      Cấp quyền ở đây là cho trình duyệt xoá bừa ảnh của thiệp khác.
--
--   4. Kiểm bucket vẫn để Public (thiệp cần đường /object/public/ để hiện ảnh).


-- ── C. Kiểm lại sau khi sửa ─────────────────────────────────────────────────
-- Chạy lại truy vấn ở mục A: phải còn ĐÚNG hai dòng cx_* với roles =
-- {authenticated}, không còn dòng nào có `anon` hay roles rỗng.
--
-- Và từ máy (thay <ref> và <ANON_KEY>), lệnh này phải KHÔNG trả về danh sách file:
--
--   curl -s -X POST \
--     -H "apikey: <ANON_KEY>" -H "Authorization: Bearer <ANON_KEY>" \
--     -H "Content-Type: application/json" -d '{"prefix":"","limit":10}' \
--     https://<ref>.supabase.co/storage/v1/object/list/wedding-images
--
-- Còn ảnh trong thiệp thật vẫn phải hiện bình thường — mất ảnh là đã lỡ bỏ tính
-- Public của bucket, không phải do policy.
