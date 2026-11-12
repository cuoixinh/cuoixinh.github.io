-- ============================================================
-- Đồng giá mới, bỏ giá ưu đãi ra mắt: mọi mẫu 129.000đ (gói 6 tháng)
-- Ngày: 2026-11-12
-- ------------------------------------------------------------
-- price = original_price = 129000 → không còn giá gạch ngang (web chỉ gạch khi original_price > price).
-- Gói Forever = giá này × hệ số ở supabase/functions/_shared/plans.ts (1.3 → 168.000đ) — deploy
-- Edge Function cùng đợt. Đi kèm: assets/data/pricing.json. Production chạy xong phải purge ở admin.
--
-- Cách chạy: dán vào Supabase → SQL Editor → Run (idempotent, chạy lại an toàn).
--            Chạy trên CẢ HAI project: staging trước, rồi production.
-- ============================================================

update public.template_pricing
   set price          = 129000,
       original_price = 129000,
       updated_at     = now()
 where price is distinct from 129000
    or original_price is distinct from 129000;
