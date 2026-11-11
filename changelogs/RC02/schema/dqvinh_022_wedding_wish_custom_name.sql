-- ============================================================
-- Lời chúc: cho phép khách mời tự viết tên hiển thị
-- Ngày: 2026-11-11
-- ------------------------------------------------------------
-- true = ô gửi lời chúc trên thiệp có thêm ô "Ký tên" (điền sẵn tên chủ thiệp đặt
-- cho khách); tên khách gõ lưu theo TỪNG lời chúc ở khoá `name` trong phần tử của
-- guests.wishes (jsonb, không cần cột mới). Mặc định false = lời chúc đứng tên khách
-- như cũ, nên thiệp đã có không phải backfill.
--
-- Cách chạy: dán vào Supabase → SQL Editor → Run (idempotent, chạy lại an toàn).
--            Chạy trên CẢ HAI project: staging trước, rồi production, TRƯỚC khi
--            deploy wedding-admin — GET ?slug= select theo whitelist có cột này,
--            deploy trước là mọi thiệp lỗi "column does not exist".
-- ============================================================

alter table public.weddings add column if not exists wish_custom_name boolean default false;

comment on column public.weddings.wish_custom_name is 'true = khách mời tự viết tên hiển thị khi gửi lời chúc (lưu ở guests.wishes[].name)';
