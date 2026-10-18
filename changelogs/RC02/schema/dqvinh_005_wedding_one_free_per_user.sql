-- ============================================================
-- Gói Miễn phí: mỗi tài khoản tối đa 1 thiệp — chốt ở DB
-- Ngày: 2026-10-18
-- ------------------------------------------------------------
-- wedding-admin đã kiểm bằng hasOtherFreeWedding (_shared/wedding-limits.ts), nhưng đó là
-- đọc-rồi-ghi: hai lượt chọn Miễn phí gần như cùng lúc cho hai thiệp vẫn lọt cả hai. Index
-- này chặn lượt ghi thứ hai (23505 → wedding-admin trả 409 FREE_LIMIT). Điều kiện phải
-- khớp phép đếm ở hasOtherFreeWedding: có free_side, chưa thanh toán, kể cả thiệp đã ẩn.
--
-- Cách chạy: dán vào Supabase → SQL Editor → Run (idempotent, chạy lại an toàn).
--            Chạy trên CẢ HAI project, SAU dqvinh_004. Đang có tài khoản giữ 2 thiệp
--            Miễn phí thì script DỪNG và liệt kê user_id — xử lý tay rồi chạy lại.
-- ============================================================

do $$
declare
  dup text;
begin
  select string_agg(user_id::text, ', ')
    into dup
    from (
      select user_id
        from public.weddings
       where user_id is not null
         and free_side is not null
         and payment_status is distinct from 'completed'
       group by user_id
      having count(*) > 1
    ) d;
  if dup is not null then
    raise exception 'Các tài khoản đang có hơn 1 thiệp gói Miễn phí: %', dup;
  end if;
end $$;

create unique index if not exists weddings_one_free_per_user
  on public.weddings (user_id)
  where free_side is not null and payment_status is distinct from 'completed';
