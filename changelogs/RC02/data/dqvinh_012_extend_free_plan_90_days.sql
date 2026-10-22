-- ============================================================
-- Gói Free đổi hạn 30 → 90 ngày: nới hạn các thiệp đã chọn Free theo luật cũ
-- Ngày: 2026-10-20
-- ------------------------------------------------------------
-- Thiệp chọn Free trước đợt này có expires_at = lúc chọn + 30 ngày; cộng thêm 60 ngày
-- cho bằng khách chọn sau (lúc chọn + 90 ngày, FREE_PLAN.days ở _shared/plans.ts).
--
-- Idempotent nhờ mốc 2026-12-01: gói Free có từ 2026-10-18 nên mọi hàng theo luật cũ
-- hết hạn trong khoảng 2026-11-17 → (ngày deploy + 30), còn hàng đã nới hoặc chọn theo
-- luật mới đều hết hạn sau 2027-01. Vì vậy PHẢI chạy trước 2026-11-01 — muộn hơn thì
-- hàng luật cũ có thể vượt mốc, sửa mốc trước khi chạy.
--
-- Cách chạy: dán vào Supabase → SQL Editor → Run. Chạy trên CẢ HAI project, SAU khi
--            deploy wedding-admin bản FREE_PLAN.days = 90.
-- ============================================================

update public.weddings
   set expires_at = expires_at + interval '60 days'
 where free_side is not null
   and payment_status is distinct from 'completed'
   and expires_at is not null
   and expires_at < timestamptz '2026-12-01 00:00:00+07';
