-- ============================================================
-- Thêm mẫu thiệp: thuan-vo-thuan-chong (Thuận Vợ Thuận Chồng)
-- Ngày: 2026-11-14
-- ------------------------------------------------------------
-- Cùng khuôn với file tab "Templates" của admin sinh ra. Mẫu thiệp là dữ liệu
-- phải có GIỐNG NHAU ở cả staging lẫn production nên đi bằng changelog, không
-- ghi thẳng vào một project.
--
-- Gồm cả giá bán (bảng template_pricing) — đồng giá 129.000đ như mọi mẫu (dqvinh_023).
--
-- Cách chạy: dán vào Supabase → SQL Editor → Run (idempotent, chạy lại an toàn).
--            Chạy trên CẢ HAI project: staging trước, rồi production.
--            Production chạy xong phải purge cache ở admin.
-- ============================================================

insert into public.templates (template_id, template_name, display_name, description, thumbnail_url, preview_url, category, status, sort_order, is_active)
values
  ('thuan-vo-thuan-chong', 'thuan-vo-thuan-chong', 'Thuận Vợ Thuận Chồng', 'Thiệp mở ra từ một phong bì đỏ rượu đóng dấu son chữ lồng tên đôi: bên trong là ảnh cưới xếp lớp trước sau, lịch tháng cưới đánh dấu trái tim, vé mời dự tiệc có cuống và album ảnh to nhỏ xếp khít.', null, '/public/themes/thuan-vo-thuan-chong/?preview=true', 'modern', 'active', 230, true)
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
values
  ('thuan-vo-thuan-chong', 129000, 129000, 'Thuận Vợ Thuận Chồng — 129.000đ', true)
on conflict (template_name) do update
   set
       price          = excluded.price,
       original_price = excluded.original_price,
       description    = excluded.description,
       is_active      = true,
       updated_at     = now();
