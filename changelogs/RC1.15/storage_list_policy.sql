-- ============================================================
-- RC1.15 — Khoá kho ảnh: chặn liệt kê và ghi bằng anon key
--
-- ⚠ FILE NÀY KHÔNG CHẠY ĐƯỢC BẰNG SQL EDITOR. Phải làm bằng giao diện Dashboard
--   (hướng dẫn ở mục B). Phần SQL bên dưới chỉ để KIỂM TRA lại kết quả.
--
--   Lý do: storage.objects thuộc sở hữu của `supabase_storage_admin`, còn SQL
--   Editor chạy dưới vai `postgres`. Trong Postgres thì alter table / create
--   policy / drop policy đều đòi QUYỀN SỞ HỮU BẢNG, nên gặp:
--       ERROR: 42501: must be owner of table objects
--   Và project này cũng chặn luôn đường vòng `set role supabase_storage_admin`:
--       ERROR: 42501: permission denied to set role
--   (Đã thử cả hai ngày 2026-09-10 — đừng thử lại, không phải lỗi cú pháp.)
--
-- Lý do phải khoá: với `anonKey` (nằm công khai trong core/config.js — đúng thiết
--   kế của Supabase), bất kỳ ai cũng gọi được
--       POST /storage/v1/object/list/wedding-images
--   và nhận về TOÀN BỘ danh sách file. Tên file khi đó có dạng
--   `<wedding_id>-<trường>-<timestamp>-<random>.<ext>`, nên danh sách vừa cho tải
--   mọi ảnh (bucket public), vừa lộ wedding_id để tra tiếp hồ sơ thiệp qua Edge
--   Function. Đo ngày 2026-09-10: 54 file / 68.3 MB / 15 thiệp.
--
-- KHÔNG ảnh hưởng người xem thiệp: ảnh hiển thị qua
-- /storage/v1/object/public/wedding-images/<file>, đường `public` KHÔNG đi qua
-- RLS. Khách mời không đăng nhập vẫn xem thiệp bình thường.
-- ============================================================


-- ── A. Xem hiện trạng (chạy được ở SQL Editor) ──────────────────────────────
-- pg_policies là view đọc, không cần quyền sở hữu. Chạy TRƯỚC để biết đang có
-- những policy nào, và chạy LẠI sau khi sửa để đối chiếu.

select policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'storage' and tablename = 'objects'
order by policyname;


-- ── B. Việc phải làm, bằng giao diện ────────────────────────────────────────
--
--   Dashboard → Storage → bucket `wedding-images` → tab Policies
--
--   1. XOÁ HẾT policy đang có trên bucket này — đặc biệt mọi policy có role
--      `anon`, hoặc role để trống (trống = áp cho TẤT CẢ, kể cả anon).
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
--      Xoá ảnh là việc của Edge Function bằng service_role — service_role bỏ qua
--      RLS nên không cần policy; wedding-admin kiểm `deleted_images` phải thuộc
--      đúng thiệp, cleanup-weddings lấy tên file từ hàng DB. Không cấp quyền thì
--      trình duyệt không xoá bừa được.
--
--   4. Kiểm tra bucket vẫn để Public (thiệp cần đường /object/public/ để hiện ảnh).


-- ── C. Kiểm lại sau khi sửa ─────────────────────────────────────────────────
-- Chạy lại truy vấn ở mục A: phải còn ĐÚNG hai dòng cx_* với roles = {authenticated},
-- không còn dòng nào có `anon` hay roles rỗng.
--
-- Và từ máy (thay <ANON_KEY>), lệnh này phải KHÔNG còn trả về danh sách file:
--
--   curl -s -X POST \
--     -H "apikey: <ANON_KEY>" -H "Authorization: Bearer <ANON_KEY>" \
--     -H "Content-Type: application/json" -d '{"prefix":"","limit":10}' \
--     https://lcobawmkywtxhpezndsh.supabase.co/storage/v1/object/list/wedding-images
--
-- Còn ảnh trong thiệp thật thì vẫn phải hiện bình thường — nếu mất ảnh là đã lỡ
-- xoá mất tính Public của bucket, không phải do policy.
