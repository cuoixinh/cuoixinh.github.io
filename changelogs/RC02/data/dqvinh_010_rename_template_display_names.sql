-- ============================================================
-- Đổi TÊN HIỂN THỊ của 16 mẫu thiệp sang tên tiếng Việt
-- Ngày: 2026-10-11
-- ------------------------------------------------------------
-- Chỉ đổi templates.display_name. Tên thư mục (template_id / template_name =
-- weddings.theme, khoá của template_pricing) GIỮ NGUYÊN nên thiệp khách, giá và
-- đơn hàng không bị ảnh hưởng.
--
-- Cách chạy: dán vào Supabase → SQL Editor → Run (idempotent, chạy lại an toàn).
--            Chạy trên CẢ HAI project: staging trước, rồi production.
--            Production đọc danh mục qua worker → chạy xong nhớ purge cache ở admin.
-- ============================================================

update public.templates t
   set display_name = v.display_name
  from (values
  ('basic-gold', 'Trọn Đời Bên Nhau'),
  ('crimson-script', 'Thương Mến Gửi Trao'),
  ('hen-uoc', 'Hẹn Ước Trăm Năm'),
  ('hong-duyen', 'Duyên Định Ba Sinh'),
  ('luminous-pastel', 'Mộng Đẹp Thành Đôi'),
  ('moody-cinematic', 'Chuyện Hai Chúng Mình'),
  ('noir-elegance', 'Vẹn Tròn Ý Nguyện'),
  ('opulent-contrast', 'Thanh Xuân Có Nhau'),
  ('pearl-bow', 'Bách Niên Giai Lão'),
  ('red-carpet', 'Nắm Tay Đi Về'),
  ('ribbon-love', 'Gắn Kết Yêu Thương'),
  ('romantic-blush', 'Mãi Mãi Về Sau'),
  ('romantic-gold', 'Ngày Chung Đôi'),
  ('seaside-film', 'Từng Khoảnh Khắc'),
  ('serene-parchment', 'Se Tơ Kết Tóc'),
  ('vintage-forest', 'Dịu Dàng Bên Em')
  ) as v(template_name, display_name)
 where t.template_name = v.template_name
   and t.display_name is distinct from v.display_name;

-- Kiểm tra:
-- select template_name, display_name from public.templates order by sort_order;
