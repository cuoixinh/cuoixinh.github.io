-- ============================================================
-- Tiệc báo hỷ: công tắc bật/tắt lễ thành hôn
-- Ngày: 2026-11-11
-- ------------------------------------------------------------
-- false = đám chỉ đãi tiệc (báo hỷ), không có lễ: thiệp lấy ngày/giờ/nơi tiệc của
-- bên đang xem thay cho lễ (normalize ở core/helpers/wedding-helper.js → cxPartyOnly).
-- Mặc định true = có lễ như cũ, nên thiệp đã có không phải backfill.
--
-- Cách chạy: dán vào Supabase → SQL Editor → Run (idempotent, chạy lại an toàn).
--            Chạy trên CẢ HAI project: staging trước, rồi production, TRƯỚC khi
--            deploy wedding-admin (whitelist ghi cột này).
-- ============================================================

alter table public.weddings add column if not exists enable_ceremony boolean default true;

comment on column public.weddings.enable_ceremony is 'false = tiệc báo hỷ: không có lễ thành hôn, thiệp chỉ hiện ngày tiệc';
