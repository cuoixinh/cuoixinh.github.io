-- ============================================================
-- CHANGELOG RC1.10  —  Dọn dẹp tự động thiệp/nháp quá hạn
-- Base: RC1.9
-- Ngày: 2026-08-19
-- ------------------------------------------------------------
-- Lý do: web đã hứa với khách (thẻ ở "Quản lý thiệp cưới", tooltip "Lưu nháp",
--   popup sau khi xuất bản) là thiệp chưa thanh toán và nháp bỏ quên sẽ tự động
--   xoá sau 30 ngày, nhưng DB chưa có việc dọn dẹp nào → Storage 1GB và DB 500MB
--   của gói free cứ phình mãi.
--
-- Luật nghiệp vụ (khớp CONFIG.retention ở core/config.js — đổi một bên phải đổi
-- cả hai):
--   + Thiệp CHƯA THANH TOÁN: xoá khi expires_at < now() - 30 ngày, tức 30 ngày
--     kể từ lúc HẾT HẠN DÙNG THỬ (dùng thử 3 ngày kể từ khi xuất bản).
--   + NHÁP (is_published = false): xoá khi updated_at < now() - 30 ngày.
--   + KHÔNG BAO GIỜ đụng thiệp đã thanh toán (expires_at null hoặc
--     payment_status = 'completed') — đó là thiệp kích hoạt vĩnh viễn.
--   + Xoá là xoá HẲN, một pha, không cứu lại được: mất luôn ảnh trong Storage,
--     danh sách khách mời (cascade theo FK) và lời chúc.
--   Việc quét/xoá do Edge Function `cleanup-weddings` làm (phải gọi qua HTTP vì
--   xoá hàng trong storage.objects bằng SQL KHÔNG xoá file thật dưới S3).
--
-- Thay đổi:
--   + Cột weddings.updated_at + trigger tự đóng dấu mỗi lần UPDATE (nháp đếm hạn
--     theo cột này; trước đây bảng chỉ có created_at).
--   + 2 partial index phục vụ hai câu quét ở trên.
--   + Bật pg_cron + pg_net, đặt lịch chạy 03:00 giờ VN mỗi ngày.
--
-- Cách chạy: dán vào Supabase → SQL Editor → Run (idempotent).
--
-- ⚠️ HAI VIỆC PHẢI LÀM TAY MỘT LẦN (không commit giá trị thật vào repo public):
--
--   1) Cất ADMIN_SECRET_TOKEN vào Vault để cron gửi kèm header x-admin-token:
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
--   2) Deploy Edge Function `cleanup-weddings` với **Verify JWT = OFF**
--      (giống payos-webhook) — quyền dựa hoàn toàn vào x-admin-token.
--
--   Gỡ lịch:  select cron.unschedule('cx-cleanup-weddings');
--   Xem log:  select * from cron.job_run_details order by start_time desc limit 5;
--             select status_code, content from net._http_response order by created desc limit 5;
-- ============================================================

-- ============ 1. weddings.updated_at ============
-- Mốc "lần lưu gần nhất" của nháp, hàng cũ lấy tạm theo created_at.

-- Thêm cột KHÔNG kèm default rồi mới đặt default sau: từ PG11, `add column …
-- default now()` điền luôn now() cho MỌI hàng cũ, backfill phía dưới sẽ không còn
-- hàng nào null để mà chạy → nháp bỏ quên 2 năm bỗng thành "vừa sửa hôm nay".
alter table public.weddings
  add column if not exists updated_at timestamptz;

-- ⚠️ Sau bước này, nháp cũ đếm hạn theo NGÀY TẠO. Nháp tạo quá 30 ngày trước là
-- đủ điều kiện bị dọn NGAY lần cron chạy đầu tiên → chạy ?dry_run=1 xem danh
-- sách trước khi để lịch chạy thật.
update public.weddings
  set updated_at = coalesce(created_at, now())
  where updated_at is null;

alter table public.weddings
  alter column updated_at set default now();

comment on column public.weddings.updated_at is
  'Lần ghi gần nhất (trigger tự đặt). Nháp quá 30 ngày không đụng tới sẽ bị dọn tự động';

create or replace function public.cx_touch_weddings_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists cx_touch_weddings_updated_at on public.weddings;
create trigger cx_touch_weddings_updated_at
  before update on public.weddings
  for each row
  execute function public.cx_touch_weddings_updated_at();

-- ============ 2. Index cho hai câu quét ============
-- Partial nên rất nhỏ: chỉ chứa đúng nhóm hàng có khả năng bị dọn.

create index if not exists idx_weddings_cleanup_unpaid
  on public.weddings(expires_at)
  where is_published and payment_status is distinct from 'completed';

create index if not exists idx_weddings_cleanup_draft
  on public.weddings(updated_at)
  where not is_published;

-- ============ 3. Extension cho lịch chạy ============
-- Lỗi quyền ở bước này thì bật tay: Dashboard → Database → Extensions → pg_cron,
-- pg_net rồi chạy lại file.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ============ 4. Lịch chạy hằng ngày ============
-- 20:00 UTC = 03:00 giờ VN — giờ chết, không đụng lúc khách đang sửa thiệp.
-- cron.schedule ghi đè job trùng tên nên chạy lại file này không tạo job thứ hai.
-- Chỉ TỐN 1 lượt Edge Function mỗi ngày (~30/tháng trên hạn mức 500k).

select cron.schedule(
  'cx-cleanup-weddings',
  '0 20 * * *',
  $job$
  select net.http_post(
    url := 'https://lcobawmkywtxhpezndsh.supabase.co/functions/v1/cleanup-weddings',
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
