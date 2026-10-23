-- ============================================================
-- Thiệp mua gói 3 tháng (đã chuyển mã sang '6m' ở schema/dqvinh_013) → cộng thêm 3 tháng
-- Ngày: 2026-10-22
-- ------------------------------------------------------------
-- Gói 3 tháng và Premium cùng một giá (hệ số 1 ở _shared/plans.ts), nên khách đã trả
-- tiền gói 3 tháng được nhận đủ thời hạn Premium 6 tháng — nhãn "Premium" trên trang
-- Quản lý thiệp cũng khớp ngày hết hạn.
-- Nhận ra hàng cũ bằng thời hạn: gói 3 tháng hết hạn ~92 ngày sau payment_time, Premium
-- ~183 ngày. Idempotent: cộng xong là hạn ~6 tháng, chạy lại không còn khớp mốc 4 tháng.
--
-- Cách chạy: dán vào Supabase → SQL Editor → Run. Chạy SAU schema/dqvinh_013, trên
--            CẢ HAI project. Xem trước bằng câu select ở cuối file.
-- ============================================================

update public.weddings
   set plan_expires_at = plan_expires_at + interval '3 months'
 where plan = '6m'
   and payment_status = 'completed'
   and payment_time is not null
   and plan_expires_at < payment_time + interval '4 months';

-- Xem trước / kiểm sau khi chạy:
-- select slug, payment_time, plan_expires_at,
--        round(extract(epoch from (plan_expires_at - payment_time)) / 86400) as so_ngay
--   from public.weddings where plan = '6m' order by payment_time desc;
