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
  ('basic-gold', 'Trọn đời bên nhau'),
  ('crimson-script', 'Thương mến gửi trao'),
  ('hen-uoc', 'Hẹn ước trăm năm'),
  ('hong-duyen', 'Duyên định ba sinh'),
  ('luminous-pastel', 'Mộng đẹp thành đôi'),
  ('moody-cinematic', 'Chuyện hai chúng mình'),
  ('noir-elegance', 'Vẹn tròn ý nguyện'),
  ('opulent-contrast', 'Thanh xuân có nhau'),
  ('pearl-bow', 'Bách niên giai lão'),
  ('red-carpet', 'Nắm tay đi về'),
  ('ribbon-love', 'Gắn kết yêu thương'),
  ('romantic-blush', 'Mãi mãi về sau'),
  ('romantic-gold', 'Ngày đôi ta'),
  ('seaside-film', 'Từng khoảnh khắc'),
  ('serene-parchment', 'Se tơ kết tóc'),
  ('vintage-forest', 'Dịu dàng bên em')
  ) as v(template_name, display_name)
 where t.template_name = v.template_name
   and t.display_name is distinct from v.display_name;

-- Kiểm tra:
-- select template_name, display_name from public.templates order by sort_order;
