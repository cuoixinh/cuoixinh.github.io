-- ============================================================
-- Khách đồng ý cho thiệp hiện ở mục "Thiệp của khách" trang chủ
-- Ngày: 2026-11-08
-- ------------------------------------------------------------
-- Khách chọn ở màn thanh toán (ô tích sẵn, tự bỏ được), payment-handler ghi khi
-- thiệp CHƯA thanh toán; sau đó chỉ nhân viên admin-support đổi được (khách xin gỡ).
-- Thiệp đã thanh toán trước đây giữ false — họ chưa từng đồng ý.
--
-- Cách chạy: dán vào Supabase → SQL Editor → Run (idempotent, chạy lại an toàn).
--            Chạy trên CẢ HAI project: staging trước, rồi production, TRƯỚC khi
--            deploy payment-handler + wedding-admin (cả hai đọc/ghi cột này).
-- ============================================================

alter table public.weddings
  add column if not exists showcase_consent boolean not null default false;

comment on column public.weddings.showcase_consent is
  'Khách đồng ý hiện thiệp ở mục "Thiệp của khách" trang chủ. Chốt lúc thanh toán, sau đó chỉ admin-support đổi.';
