-- ============================================================
-- Lễ vu quy có ngày riêng (+ ngày âm tự tính như các mốc khác)
-- Ngày: 2026-10-31
-- ------------------------------------------------------------
-- null = cùng ngày lễ thành hôn: thiệp nhà gái lấy ceremony_date/ceremony_lunar
-- (normalize ở core/helpers/wedding-helper.js), nên thiệp cũ không phải backfill.
--
-- Cách chạy: dán vào Supabase → SQL Editor → Run (idempotent, chạy lại an toàn).
--            Chạy trên CẢ HAI project: staging trước, rồi production, TRƯỚC khi
--            deploy wedding-admin (whitelist ghi hai cột này).
-- ============================================================

alter table public.weddings add column if not exists vu_quy_date date;
alter table public.weddings add column if not exists vu_quy_lunar text;

comment on column public.weddings.vu_quy_date is 'Ngày lễ vu quy. null = cùng ngày lễ thành hôn (ceremony_date)';
comment on column public.weddings.vu_quy_lunar is 'Ngày âm của vu_quy_date (trang Thiết lập tự tính). null = lấy ceremony_lunar';
