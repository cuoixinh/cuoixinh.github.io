-- ============================================================
-- Hộp mừng cưới: chỉ hiện QR của bên đang xem
-- Ngày: 2026-11-09
-- ------------------------------------------------------------
-- true = thiệp nhà trai (?isGroom=true) chỉ hiện QR nhà trai, thiệp nhà gái chỉ
-- hiện QR nhà gái (render-helper.js → renderQRCodes). Mặc định false = hiện cả hai
-- như cũ, nên thiệp đã có không phải backfill.
--
-- Cách chạy: dán vào Supabase → SQL Editor → Run (idempotent, chạy lại an toàn).
--            Chạy trên CẢ HAI project: staging trước, rồi production, TRƯỚC khi
--            deploy wedding-admin (whitelist ghi cột này).
-- ============================================================

alter table public.weddings add column if not exists gift_own_side boolean default false;

comment on column public.weddings.gift_own_side is 'true = mỗi bên chỉ hiện QR mừng cưới của bên mình (thiệp nhà trai/nhà gái)';
