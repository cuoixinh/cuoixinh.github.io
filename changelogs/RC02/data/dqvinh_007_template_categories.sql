-- ============================================================
-- Bộ danh mục mẫu thiệp mới
-- Ngày: 2026-10-11
-- ------------------------------------------------------------
-- Chỉ còn 5 danh mục: traditional (Truyền thống) · modern (Hiện đại) · vintage ·
-- cinematic (Điện ảnh) · historical (Cổ trang). Bỏ luxury / minimal / romantic.
-- Cùng bộ với <select> ở admin, VALID_CATEGORIES (wedding-admin) và CAT_META
-- (theme-template/index.html).
--
-- Cách chạy: dán vào Supabase → SQL Editor → Run (idempotent, chạy lại an toàn).
--            Chạy trên CẢ HAI project: staging trước, rồi production.
-- ============================================================

update public.templates as t
   set category = m.category,
       updated_at = now()
  from (values
    ('hong-duyen',       'traditional'),
    ('hen-uoc',          'traditional'),
    ('pearl-bow',        'traditional'),
    ('basic-gold',       'modern'),
    ('romantic-gold',    'modern'),
    ('romantic-blush',   'modern'),
    ('luminous-pastel',  'modern'),
    ('ribbon-love',      'modern'),
    ('crimson-script',   'modern'),
    ('vintage-forest',   'vintage'),
    ('serene-parchment', 'vintage'),
    ('moody-cinematic',  'cinematic'),
    ('noir-elegance',    'cinematic'),
    ('opulent-contrast', 'cinematic')
  ) as m(template_id, category)
 where t.template_id = m.template_id
   and t.category is distinct from m.category;

-- Lưới an toàn: mẫu nào không có trong bảng trên mà còn mang danh mục đã bỏ (hoặc
-- trống) thì về Hiện đại, để không mẫu nào rơi khỏi bộ lọc.
update public.templates
   set category = 'modern',
       updated_at = now()
 where category is null
    or category not in ('traditional', 'modern', 'vintage', 'cinematic', 'historical');

comment on column public.templates.category is
  'traditional | modern | vintage | cinematic | historical';

-- Kiểm tra sau khi chạy:
-- select template_id, display_name, category from public.templates order by sort_order;
