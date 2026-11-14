-- ============================================================
-- Sắp xếp lại thứ tự hiển thị mẫu thiệp
-- Ngày: 2026-11-14
-- ------------------------------------------------------------
-- Sinh tự động từ tab "Templates" của admin. Mẫu thiệp là dữ liệu phải có
-- GIỐNG NHAU ở cả staging lẫn production nên đi bằng changelog, không ghi
-- thẳng vào một project.
--
-- Thứ tự mới (sort_order = 10, 20, 30…):
--    1. thuan-vo-thuan-chong
--    2. ribbon-love
--    3. romantic-blush
--    4. basic-gold
--    5. romantic-gold
--    6. vintage-forest
--    7. moody-cinematic
--    8. noir-elegance
--    9. luminous-pastel
--   10. opulent-contrast
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
--   21. dong-hanh-tram-nam
--   22. chung-mot-giai-dieu
--   23. anh-sang-doi-ta
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
       ('ribbon-love', 20),
       ('romantic-blush', 30),
       ('basic-gold', 40),
       ('romantic-gold', 50),
       ('vintage-forest', 60),
       ('moody-cinematic', 70),
       ('noir-elegance', 80),
       ('luminous-pastel', 90),
       ('opulent-contrast', 100),
       ('serene-parchment', 110),
       ('pearl-bow', 120),
       ('hong-duyen', 130),
       ('hen-uoc', 140),
       ('crimson-script', 150),
       ('seaside-film', 160),
       ('red-carpet', 170),
       ('som-hom-co-nhau', 180),
       ('tinh-tham-nghia-trong', 190),
       ('messenger-iphone', 200),
       ('dong-hanh-tram-nam', 210),
       ('chung-mot-giai-dieu', 220),
       ('anh-sang-doi-ta', 230)
       ) as v(template_id, sort_order)
 where t.template_id = v.template_id
   and t.sort_order is distinct from v.sort_order;
