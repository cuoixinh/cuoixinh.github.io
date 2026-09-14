-- ============================================================
-- SCHEMA 00 — Xoá sạch để dựng lại
--
-- ⚠️ FILE NÀY XOÁ TOÀN BỘ DỮ LIỆU NGHIỆP VỤ. Chỉ chạy trên project TRỐNG hoặc
--    khi cố ý làm lại từ đầu. Các file 01…08 đều idempotent nên nâng cấp một
--    project đang chạy thì BỎ QUA file này.
--
-- Không đụng: schema `auth` (tài khoản người dùng), `storage` (file đã tải lên),
-- `vault` (secret). Xoá bảng ở đây KHÔNG xoá ảnh dưới Storage — ảnh mồ côi phải
-- dọn riêng ở Dashboard → Storage.
--
-- Thứ tự: bảng con trước bảng cha (CASCADE lo phần còn lại).
-- ============================================================

drop table if exists public.promo_redemptions cascade;
drop table if exists public.payment_logs      cascade;
drop table if exists public.order_details     cascade;
drop table if exists public.orders            cascade;
drop table if exists public.guests            cascade;
drop table if exists public.weddings          cascade;
drop table if exists public.template_pricing  cascade;
drop table if exists public.templates         cascade;
drop table if exists public.promo_codes       cascade;
drop table if exists public.ai_usage          cascade;
drop table if exists public.ai_usage_ip       cascade;
drop table if exists public.ai_chat_usage     cascade;

-- Hàm dùng chung (trigger function bị drop theo bảng, hàm promo thì không).
drop function if exists public.cx_promo_reserve(text, uuid, text, integer, text);
drop function if exists public.cx_promo_redeem(text);
drop function if exists public.cx_promo_release(text);
drop function if exists public.cx_touch_weddings_updated_at();
drop function if exists public.update_templates_updated_at();
drop function if exists public.update_template_pricing_updated_at();

-- Lịch dọn dẹp: gỡ để khỏi trỏ vào bảng vừa xoá. Đặt lại ở manual/02.
-- Bọc trong DO vì pg_cron có thể chưa được bật trên project trống.
do $$
begin
  perform cron.unschedule('cx-cleanup-weddings');
exception when others then
  raise notice 'Chưa có lịch cx-cleanup-weddings (bỏ qua)';
end $$;
