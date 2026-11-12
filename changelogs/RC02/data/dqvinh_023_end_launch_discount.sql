-- ============================================================
-- Kết thúc giá ưu đãi ra mắt: giá bán lên bằng giá gốc
-- Ngày: 2026-11-12
-- ------------------------------------------------------------
-- Web chỉ hiện giá gạch ngang khi original_price > price, nên bằng nhau là hết giảm giá.
-- Đi kèm: assets/data/pricing.json đã sửa cùng đợt. Production chạy xong phải purge ở admin.
--
-- Cách chạy: dán vào Supabase → SQL Editor → Run (idempotent, chạy lại an toàn).
--            Chạy trên CẢ HAI project: staging trước, rồi production.
-- ============================================================

update public.template_pricing
   set price      = original_price,
       updated_at = now()
 where original_price > price;
