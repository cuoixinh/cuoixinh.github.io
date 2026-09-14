-- ============================================================
-- DATA 01 — Danh mục mẫu thiệp (bảng `templates`)
--
-- Mỗi mẫu = 3 file trong public/themes/<template_name>/ + MỘT hàng ở đây.
-- Thiếu hàng là mẫu không hiện ở trang chủ dù file đã lên web.
--
-- Về sau KHÔNG sửa file này bằng tay: tab "Templates" của admin sinh một file
-- .sql riêng cho mỗi lần thêm/sửa/xoá mẫu, chạy trên cả hai project. File này
-- chỉ là ảnh chụp danh mục để dựng một project TRỐNG cho nhanh.
--
-- `sort_order` cách nhau 10 để chèn mẫu mới vào giữa mà không phải đánh số lại.
-- Idempotent: khớp theo `template_id`, chạy lại chỉ đồng bộ chứ không nhân đôi.
-- ============================================================

insert into public.templates
  (template_id, template_name, display_name, description, preview_url, status, category, sort_order, is_active)
values
  ('basic-gold', 'basic-gold', 'Classic Gold',
   'Trắng tinh tế, vàng gold sang trọng — phong cách cổ điển bất hủ',
   '/public/themes/basic-gold/?preview=true', 'active', 'traditional', 10, true),
  ('romantic-gold', 'romantic-gold', 'Romantic Gold',
   'Xanh sage & vàng gold, lãng mạn và tinh tế',
   '/public/themes/romantic-gold/?preview=true', 'active', 'modern', 20, true),
  ('vintage-forest', 'vintage-forest', 'Vintage Forest',
   'Kem vintage, nâu gỗ, xanh rừng — ấm áp và gần gũi',
   '/public/themes/vintage-forest/?preview=true', 'active', 'vintage', 30, true),
  ('moody-cinematic', 'moody-cinematic', 'Moody Cinematic',
   'Sắc xám trầm, xanh than sâu lắng, tạo không khí điện ảnh đầy bí ẩn và quyến rũ.',
   '/public/themes/moody-cinematic/?preview=true', 'active', 'modern', 40, true),
  ('noir-elegance', 'noir-elegance', 'Noir Elegance',
   'Tông trắng chủ đạo hòa quyện cùng những gam sáng thanh lịch, tạo nên không gian điện ảnh hiện đại, tinh tế, đẳng cấp và đầy mê hoặc.',
   '/public/themes/noir-elegance/?preview=true', 'active', 'modern', 50, true),
  ('romantic-blush', 'romantic-blush', 'Romantic Blush',
   'Hồng phấn lãng mạn hòa quyện cùng kem trắng và nâu espresso, tạo không gian sang trọng, nữ tính và ấm áp.',
   '/public/themes/romantic-blush/?preview=true', 'active', 'modern', 60, true),
  ('luminous-pastel', 'luminous-pastel', 'Luminous Pastel',
   'Trắng kem thanh nhã kết hợp cùng skin tone sáng ấm, hồng đào tự nhiên và những sắc pastel dịu dàng như hồng phấn, be nude và xanh xám nhẹ, tạo nên tổng thể lãng mạn, mềm mại, trong trẻo và tinh tế, mang đậm cảm giác wedding editorial nhẹ nhàng, sang trọng.',
   '/public/themes/luminous-pastel/?preview=true', 'active', 'modern', 70, true),
  ('opulent-contrast', 'opulent-contrast', 'Opulent Contrast',
   'Sự hòa quyện giữa các gam màu tối giản và tương phản mạnh mẽ, tạo nên vẻ đẹp sang trọng, tinh tế và đầy cuốn hút.',
   '/public/themes/opulent-contrast/?preview=true', 'active', 'luxury', 80, true),
  ('serene-parchment', 'serene-parchment', 'Serene Parchment',
   'Sắc kem ấm áp hòa quyện cùng nâu trầm và tông be tự nhiên, mang đến cảm giác thư tay hoài niệm, thân mật và chân thành.',
   '/public/themes/serene-parchment/?preview=true', 'active', 'vintage', 90, true)
on conflict (template_id) do update
   set
       template_name = excluded.template_name,
       display_name  = excluded.display_name,
       description   = excluded.description,
       preview_url   = excluded.preview_url,
       status        = excluded.status,
       category      = excluded.category,
       sort_order    = excluded.sort_order,
       is_active     = excluded.is_active,
       updated_at    = now();
