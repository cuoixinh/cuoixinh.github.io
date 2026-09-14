-- ============================================================
-- RC1.17 — Giá bán cho TẤT CẢ mẫu thiệp (109.000đ, gốc 139.000đ)
--
-- LÝ DO
--   Giá CHỈ đến từ `template_pricing`: `TemplatesDAL._normalize` trả
--   `price: null` khi mẫu không có hàng giá, và `openPayment()`
--   (js/home-payment.js) chặn lại bằng thông báo "Mẫu này chưa có giá bán".
--   Mẫu thiếu hàng ở bảng này là mẫu bày ra mà KHÔNG mua được.
--
--   Bảng giá mới có hàng cho vài mẫu baseline, các mẫu thêm sau đều trống.
--   File này phủ MỌI hàng đang có trong `templates`.
--
-- ⚠ FILE NÀY ĐỔI GIÁ THẬT
--   Mẫu nào đang bán 159.000đ (gốc 199.000đ) sẽ xuống 109.000đ (gốc 139.000đ).
--
-- SAU KHI CHẠY
--   Purge cache worker templates-cache (nút ở tab Templates của admin), nếu
--   không bảng giá cũ còn sống tối đa 7 ngày ở edge. Staging không có worker
--   nên không cần.
--
-- Cách chạy: dán vào Supabase → SQL Editor → Run (idempotent, chạy lại an toàn).
--            Chạy trên CẢ HAI project: staging trước, rồi production.
-- ============================================================

-- Tên và mô tả lấy thẳng từ `templates` nên không phải liệt kê mẫu bằng tay:
-- thêm mẫu rồi chạy lại file này là mẫu mới có giá luôn. Khớp theo
-- `template_name` (khoá của bảng giá), KHÔNG phải `template_id`.
--
-- Lấy cả mẫu đang tắt (`is_active = false`): thiếu giá là không bán được, nên
-- thà ghi thừa một hàng còn hơn bật mẫu lên mới phát hiện tắc ở nút mua.
with gia as (
  -- Khai giá đúng MỘT chỗ; phần "109.000đ" trong mô tả suy ra từ đây.
  select 109000::int as price, 139000::int as original_price
)
insert into public.template_pricing (template_name, price, original_price, description, is_active)
select
  t.template_name,
  g.price,
  g.original_price,
  -- to_char với dấu ',' viết cứng rồi đổi sang '.' — dùng 'G' là ăn theo
  -- lc_numeric của server, mỗi project một kiểu.
  t.display_name || ' — ' || replace(to_char(g.price, 'FM999,999,999'), ',', '.') || 'đ',
  true
from public.templates t
cross join gia g
on conflict (template_name) do update
   set
       price          = excluded.price,
       original_price = excluded.original_price,
       description    = excluded.description,
       is_active      = true,
       updated_at     = now();


-- ------------------------------------------------------------
-- KIỂM TRA — mỗi mẫu phải có đúng một hàng giá.
-- Cột `price` null ở kết quả = mẫu đó không mua được (đừng bỏ qua).
-- ------------------------------------------------------------
-- select t.template_name, t.display_name, t.is_active, p.price, p.original_price, p.description
--   from public.templates t
--   left join public.template_pricing p on p.template_name = t.template_name
--  order by t.sort_order, t.template_name;
