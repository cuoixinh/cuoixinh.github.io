-- ============================================================
-- MANUAL 02 — Lịch dọn dẹp tự động (pg_cron → Edge Function cleanup-weddings)
--
-- ⚠ PHẢI SỬA TAY TRƯỚC KHI CHẠY: thay <PROJECT_REF> bằng ref của ĐÚNG project
--   đang mở. Để nguyên ref của môi trường khác là cron project này đi xoá dữ
--   liệu của môi trường kia. Đây là lý do file nằm ở `manual/` chứ không phải
--   `schema/`.
--
-- LUẬT NGHIỆP VỤ (khớp `CONFIG.retention` ở core/config.js và `RETENTION_DAYS`
-- của Edge Function — ba nơi, đổi phải đổi cả ba):
--   • Thiệp CHƯA THANH TOÁN: xoá khi expires_at < now() - 30 ngày, tức 30 ngày
--     kể từ lúc HẾT HẠN DÙNG THỬ.
--   • NHÁP (is_published = false): xoá khi updated_at < now() - 30 ngày.
--   • KHÔNG BAO GIỜ đụng thiệp đã thanh toán (expires_at null hoặc
--     payment_status = 'completed').
--   • Xoá là XOÁ HẲN, một pha, không cứu lại được: mất luôn ảnh trong Storage,
--     khách mời (cascade) và lời chúc.
--
-- Việc quét/xoá do Edge Function làm chứ không phải SQL: xoá hàng trong
-- storage.objects bằng SQL KHÔNG xoá file thật dưới S3.
--
-- Index phục vụ hai câu quét nằm ở schema/dqvinh_001_weddings.sql.
-- ============================================================


-- ── A. Hai việc phải làm một lần, TRƯỚC khi đặt lịch ────────────────────────
--
--   1) Cất ADMIN_SECRET_TOKEN của CHÍNH project này vào Vault — cron đọc nó để
--      gửi kèm header x-admin-token. Hai môi trường token khác nhau nên hai
--      Vault cũng khác:
--
--        select vault.create_secret(
--          '<ADMIN_SECRET_TOKEN>', 'cleanup_token',
--          'Token gọi Edge Function cleanup-weddings từ cron');
--
--      Đổi token về sau:
--        select vault.update_secret(
--          (select id from vault.secrets where name = 'cleanup_token'),
--          '<TOKEN_MOI>');
--
--   2) Deploy Edge Function `cleanup-weddings` với Verify JWT = OFF (giống
--      payos-webhook) — quyền dựa hoàn toàn vào x-admin-token.
--      Dùng `npm run deploy:functions:all`, cờ đã khai sẵn trong script.


-- ── B. Bật extension ────────────────────────────────────────────────────────
-- Lỗi quyền ở bước này thì bật tay: Dashboard → Database → Extensions →
-- pg_cron, pg_net rồi chạy lại.

create extension if not exists pg_cron;
create extension if not exists pg_net;


-- ── C. Đặt lịch ─────────────────────────────────────────────────────────────
-- 20:00 UTC = 03:00 giờ VN — giờ chết, không đụng lúc khách đang sửa thiệp.
-- cron.schedule ghi đè job trùng tên nên chạy lại không tạo job thứ hai.
-- Chỉ tốn 1 lượt Edge Function mỗi ngày (~30/tháng trên hạn mức 500k).
--
-- ⚠ THAY <PROJECT_REF> Ở DÒNG `url :=` BÊN DƯỚI.

select cron.schedule(
  'cx-cleanup-weddings',
  '0 20 * * *',
  $job$
  select net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/cleanup-weddings',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-admin-token', (
        select decrypted_secret from vault.decrypted_secrets where name = 'cleanup_token'
      )
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $job$
);


-- ── D. Kiểm & vận hành ──────────────────────────────────────────────────────
--
--   Chạy thử KHÔNG xoá gì (xem trước danh sách sẽ bị dọn):
--     gọi Edge Function với ?dry_run=1 — làm việc này TRƯỚC lần chạy thật đầu
--     tiên trên một project vừa nhập dữ liệu cũ, vì nháp cũ đếm hạn theo ngày
--     tạo nên có thể đủ điều kiện bị dọn ngay.
--
--   Xem lịch:   select * from cron.job where jobname = 'cx-cleanup-weddings';
--   Xem log:    select * from cron.job_run_details order by start_time desc limit 5;
--               select status_code, content from net._http_response order by created desc limit 5;
--   Gỡ lịch:    select cron.unschedule('cx-cleanup-weddings');
