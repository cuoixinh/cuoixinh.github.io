-- ============================================================
-- Thêm 2 mẫu thiệp: messenger-iphone (iPhone Messenger) · dong-hanh-tram-nam (Đồng Hành Trăm Năm)
-- Ngày: 2026-10-26
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
values
  ('messenger-iphone', 'messenger-iphone', 'iPhone Messenger', 'Thiệp mở ra như màn khoá điện thoại có thông báo từ cô dâu chú rể, cuộn xuống là một cuộc trò chuyện: ảnh, thẻ sự kiện, vị trí, quà mừng đều là tin nhắn hiện lần lượt.', null, '/public/themes/messenger-iphone/?preview=true', 'modern', 'active', 190, true),
  ('dong-hanh-tram-nam', 'dong-hanh-tram-nam', 'Đồng Hành Trăm Năm', 'Đám cưới là một chuyến tàu: bảng giờ tàu lật số tới ngày cưới, vé giấy có lỗ bấm, lịch trình là các ga dừng và vé quà mừng xé cuống lộ mã QR.', null, '/public/themes/dong-hanh-tram-nam/?preview=true', 'modern', 'active', 200, true)
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
  ('messenger-iphone', 109000, 139000, 'iPhone Messenger — 109.000đ', true),
  ('dong-hanh-tram-nam', 109000, 139000, 'Đồng Hành Trăm Năm — 109.000đ', true)
on conflict (template_name) do update
   set
       price          = excluded.price,
       original_price = excluded.original_price,
       description    = excluded.description,
       is_active      = true,
       updated_at     = now();
