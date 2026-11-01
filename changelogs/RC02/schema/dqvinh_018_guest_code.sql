-- ============================================================
-- Mã khách mời ngắn cho link riêng: /<slug>?g=<code> thay cho name=/relationship= mã hoá
-- Ngày: 2026-11-01
-- ------------------------------------------------------------
-- 8 ký tự [0-9A-Za-z] ngẫu nhiên (~47 bit), duy nhất TRONG một thiệp. Mã là chìa khoá
-- của link chứ không phải id: lộ thì sinh mã mới là link cũ chết, còn id thì không đổi được.
-- Chỉ hàng MỚI có mã (DEFAULT); hàng cũ để NULL, KHÔNG backfill — link dạng cũ đã gửi cho
-- khách nên giữ nguyên dữ liệu, trang Khách mời thấy khách không mã thì dựng link dạng cũ.
-- guest-handler giữ cả hai nhánh (mã / tên + xưng hô).
--
-- Cách chạy: dán vào Supabase → SQL Editor → Run (idempotent, chạy lại an toàn).
--            Chạy trên CẢ HAI project, TRƯỚC khi deploy guest-handler.
-- ============================================================

-- Lấy byte từ gen_random_uuid() (lõi Postgres, khỏi cần pgcrypto). UUID v4 cố định 4 bit
-- version ở byte 6 và 2 bit variant ở byte 8 — bỏ hai byte đó, còn lại ngẫu nhiên đủ 8 bit.
-- plpgsql chứ không `language sql`: bản sql có thể bị planner gộp gen_random_uuid() thành
-- MỘT lần cho cả câu lệnh → một lô import nhiều hàng nhận cùng mã, đụng unique index.
create or replace function public.cx_guest_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  b bytea := uuid_send(gen_random_uuid());
  alphabet constant text := '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  v text := '';
  i int;
begin
  foreach i in array array[0, 1, 2, 3, 4, 5, 7, 9] loop
    v := v || substr(alphabet, get_byte(b, i) % 62 + 1, 1);
  end loop;
  return v;
end;
$$;

revoke all on function public.cx_guest_code() from public, anon, authenticated;
grant execute on function public.cx_guest_code() to service_role;

-- Thêm cột KHÔNG kèm default rồi mới đặt default: `add column ... default f()` với hàm
-- volatile sẽ điền giá trị cho mọi hàng đang có.
alter table public.guests add column if not exists code text;
alter table public.guests alter column code set default public.cx_guest_code();

-- NULL không đụng nhau trong unique index nên hàng cũ không mã vẫn hợp lệ.
create unique index if not exists guests_wedding_code_key on public.guests (wedding_id, code);

comment on column public.guests.code is
  'Mã link riêng của khách (?g=), duy nhất trong thiệp — guest-handler view/rsvp/wish/guest';
