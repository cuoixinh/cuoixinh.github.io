-- ============================================================
-- Sắp xếp lại thứ tự hiển thị mẫu thiệp
-- Ngày: 2026-11-15
-- ------------------------------------------------------------
-- Sinh tự động từ tab "Templates" của admin. Mẫu thiệp là dữ liệu phải có
-- GIỐNG NHAU ở cả staging lẫn production nên đi bằng changelog, không ghi
-- thẳng vào một project.
--
-- Thứ tự mới (sort_order = 10, 20, 30…):
--    1. thuan-vo-thuan-chong
--    2. romantic-blush
--    3. basic-gold
--    4. romantic-gold
--    5. vintage-forest
--    6. moody-cinematic
--    7. noir-elegance
--    8. luminous-pastel
--    9. opulent-contrast
--   10. ribbon-love
--   11. serene-parchment
--   12. pearl-bow
--   13. hong-duyen
--   14. hen-uoc
--   15. crimson-script
--   16. seaside-film
--   17. red-carpet
--   18. som-hom-co-nhau
--   19. tinh-tham-nghia-trong
--   20. messenger-iphone
--
-- Mẫu không có trong danh sách này (chỉ có ở một môi trường) giữ nguyên
-- sort_order cũ; mẫu đã đúng số thì không bị đụng tới.
--
-- Cách chạy: dán vào Supabase → SQL Editor → Run (idempotent, chạy lại an toàn).
--            Chạy trên CẢ HAI project: staging trước, rồi production.
-- ============================================================

update public.templates as t
   set sort_order = v.sort_order,
       updated_at = now()
  from (values
       ('thuan-vo-thuan-chong', 10),
       ('romantic-blush', 20),
       ('basic-gold', 30),
       ('romantic-gold', 40),
       ('vintage-forest', 50),
       ('moody-cinematic', 60),
       ('noir-elegance', 70),
       ('luminous-pastel', 80),
       ('opulent-contrast', 90),
       ('ribbon-love', 100),
       ('serene-parchment', 110),
       ('pearl-bow', 120),
       ('hong-duyen', 130),
       ('hen-uoc', 140),
       ('crimson-script', 150),
       ('seaside-film', 160),
       ('red-carpet', 170),
       ('som-hom-co-nhau', 180),
       ('tinh-tham-nghia-trong', 190),
       ('messenger-iphone', 200)
       ) as v(template_id, sort_order)
 where t.template_id = v.template_id
   and t.sort_order is distinct from v.sort_order;
