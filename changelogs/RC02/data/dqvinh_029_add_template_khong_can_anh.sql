-- ============================================================
-- Thêm mẫu thiệp: khong-can-anh (Không Cần Ảnh)
-- Ngày: 2026-11-25
-- ------------------------------------------------------------
-- Cùng khuôn với file tab "Templates" của admin sinh ra. Mẫu thiệp là dữ liệu
-- phải có GIỐNG NHAU ở cả staging lẫn production nên đi bằng changelog, không
-- ghi thẳng vào một project.
--
-- Mẫu chỉ dùng một ảnh (ảnh bìa); khách không tải ảnh thì thiệp và thẻ og:image
-- dùng tranh vẽ cô dâu chú rể có sẵn của mẫu.
--
-- Gồm cả giá bán (bảng template_pricing) — đồng giá 129.000đ như mọi mẫu (dqvinh_023).
--
-- Cách chạy: dán vào Supabase → SQL Editor → Run (idempotent, chạy lại an toàn).
--            Chạy trên CẢ HAI project: staging trước, rồi production.
--            Production chạy xong phải purge cache ở admin.
--            Code web (public/themes/khong-can-anh/) phải lên môi trường đó TRƯỚC,
--            không thì kho mẫu hiện một mẫu mở ra trang trắng.
-- ============================================================

insert into public.templates (template_id, template_name, display_name, description, thumbnail_url, preview_url, category, status, sort_order, is_active)
values
  ('khong-can-anh', 'khong-can-anh', 'Không Cần Ảnh', 'Thiệp dành cho đôi chưa có ảnh cưới: một tranh vẽ cô dâu chú rể đứng thay ảnh, đặt trong phong bì vải chấm bi xanh phấn đóng dấu sáp. Bên trong có lịch tháng cưới, vé mời dự tiệc có cuống và lì xì xanh mừng cưới. Có ảnh thì chỉ cần đúng một tấm.', null, '/public/themes/khong-can-anh/?preview=true', 'modern', 'active', 240, true)
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
  ('khong-can-anh', 129000, 129000, 'Không Cần Ảnh — 129.000đ', true)
on conflict (template_name) do update
   set
       price          = excluded.price,
       original_price = excluded.original_price,
       description    = excluded.description,
       is_active      = true,
       updated_at     = now();
