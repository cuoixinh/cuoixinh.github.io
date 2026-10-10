-- ============================================================
-- Thêm mẫu thiệp crimson-script
-- Ngày: 2026-10-10
-- ------------------------------------------------------------
-- Cùng khuôn với file tab "Templates" của admin sinh ra. Mẫu thiệp là dữ liệu
-- phải có GIỐNG NHAU ở cả staging lẫn production nên đi bằng changelog, không
-- ghi thẳng vào một project.
--
-- Gồm cả giá bán (bảng template_pricing).
--
-- Cách chạy: dán vào Supabase → SQL Editor → Run (idempotent, chạy lại an toàn).
--            Chạy trên CẢ HAI project: staging trước, rồi production.
-- ============================================================

insert into public.templates (template_id, template_name, display_name, description, thumbnail_url, preview_url, category, status, sort_order, is_active)
values ('crimson-script', 'crimson-script', 'Crimson Script', 'Trang dài nền trắng, tiêu đề serif đỏ in hoa cùng chữ ký tay, ảnh xếp lệch trái phải — tinh tế, lãng mạn kiểu tạp chí.', null, '/public/themes/crimson-script/?preview=true', 'modern', 'active', 140, true)
on conflict (template_id) do update
   set
       template_name = excluded.template_name,
       display_name = excluded.display_name,
       description = excluded.description,
       thumbnail_url = excluded.thumbnail_url,
       preview_url = excluded.preview_url,
       category = excluded.category,
       status = excluded.status,
       sort_order = excluded.sort_order,
       is_active = excluded.is_active,
       updated_at = now();

-- Giá bán (bảng riêng, khớp theo template_name)
insert into public.template_pricing (template_name, price, original_price, description, is_active)
values ('crimson-script', 109000, 139000, 'Crimson Script — 109.000đ', true)
on conflict (template_name) do update
   set
       price          = excluded.price,
       original_price = excluded.original_price,
       description    = excluded.description,
       is_active      = true,
       updated_at     = now();
