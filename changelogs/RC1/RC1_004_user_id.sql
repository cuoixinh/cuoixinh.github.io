-- ============================================================
-- CHANGELOG RC1.4  —  Thêm cột user_id cho bảng weddings
-- Base: RC1.3
-- Ngày: 2026-07-16
-- ------------------------------------------------------------
-- Lý do: gắn thiệp với tài khoản Supabase Auth đã tạo ra nó, để
--        trang "Đơn hàng" (public/account) liệt kê được cả thiệp
--        nháp lưu trong DB của user — kể cả khi đổi thiết bị hoặc
--        đã xoá cache trình duyệt (trước đây danh sách đơn chỉ nằm
--        ở localStorage nên không nhìn thấy các draft này).
--
-- Thay đổi:
--   + Thêm cột weddings.user_id (uuid, nullable) → auth.users(id).
--     ON DELETE SET NULL: xoá user không xoá thiệp, chỉ gỡ liên kết.
--   + Index idx_weddings_user_id để lọc theo user nhanh.
--
-- Ghi chú:
--   - Nullable vì: khách chưa đăng nhập vẫn tạo được draft (user_id
--     null), và các thiệp cũ tạo trước bản này cũng để null. Edge
--     function sẽ tự "nhận chủ" (set user_id) khi đúng chủ đăng nhập
--     và mở/sửa lại thiệp (PATCH) — xem wedding-admin/index.ts.
--   - Không đặt RLS ở đây: edge function chạy bằng service role và tự
--     lọc theo user_id sau khi xác thực JWT của user.
--
-- Cách chạy: dán vào Supabase → SQL Editor → Run (idempotent).
-- ============================================================

alter table public.weddings
  add column if not exists user_id uuid references auth.users(id) on delete set null;

create index if not exists idx_weddings_user_id on public.weddings(user_id);

comment on column public.weddings.user_id is
  'Chủ sở hữu thiệp (Supabase Auth user). Null = tạo bởi khách chưa đăng nhập';
