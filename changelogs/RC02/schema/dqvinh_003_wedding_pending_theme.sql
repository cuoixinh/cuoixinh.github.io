-- ============================================================
-- Mẫu thiệp của đơn đang chờ thanh toán (chặn "tạo đơn mẫu rẻ, đổi mẫu đắt rồi trả")
-- Ngày: 2026-10-16
-- ------------------------------------------------------------
-- Đơn PayOS chốt số tiền theo mẫu LÚC TẠO ĐƠN, nhưng thiệp chưa thanh toán vẫn được
-- đổi mẫu. payment-handler ghi mẫu của đơn vào pending_theme; payos-webhook trả xong
-- thì đặt lại theme = pending_theme → khách nhận đúng mẫu đã trả tiền. Xem
-- docs/security-checklist.md A29.
--
-- Cách chạy: dán vào Supabase → SQL Editor → Run (idempotent, chạy lại an toàn).
--            Chạy trên CẢ HAI project: staging trước, rồi production, TRƯỚC khi
--            deploy payment-handler + payos-webhook (hai function đọc/ghi cột này).
-- ============================================================

alter table public.weddings add column if not exists pending_theme text;

comment on column public.weddings.pending_theme is 'Mẫu thiệp của đơn PayOS đang chờ (payment_order_id) — webhook trả xong thì đặt theme = cột này rồi xoá về null';
