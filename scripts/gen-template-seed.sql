-- Sinh câu INSERT cho `templates` + `template_pricing` để chép sang project khác.
--
-- Hai bảng này là DỮ LIỆU DANH MỤC, không nằm trong changelog (changelog chỉ dựng
-- schema + 3 mẫu baseline), nên dựng môi trường mới phải chép tay. RC1.16 đã thu
-- quyền đọc của `anon` nên không lấy được từ ngoài bằng anon key — phải chạy ở đây.
--
-- Cách dùng: chạy TỪNG câu ở SQL Editor của project NGUỒN (production), copy ô kết
-- quả (một ô text dài), dán sang SQL Editor của project ĐÍCH rồi Run.
--
-- Câu sinh tự đọc danh sách cột từ information_schema nên thêm/bớt cột về sau không
-- phải sửa file này. Giá trị đổ ra dạng literal chuỗi; Postgres tự ép kiểu theo cột.

-- ── 1. templates ────────────────────────────────────────────────────────────
select
  'insert into public.templates ('
  || (select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
        from information_schema.columns
       where table_schema = 'public' and table_name = 'templates' and column_name <> 'id')
  || ') values' || E'\n'
  || string_agg(row_txt, ',' || E'\n' order by ord)
  || E'\non conflict (template_id) do update set '
  || (select string_agg(quote_ident(column_name) || ' = excluded.' || quote_ident(column_name),
                        ', ' order by ordinal_position)
        from information_schema.columns
       where table_schema = 'public' and table_name = 'templates'
         and column_name not in ('id', 'template_id', 'created_at'))
  || ';' as seed_sql
from (
  select
    t.sort_order as ord,
    '  (' || (
      select string_agg(
               case when to_jsonb(t) ->> c.column_name is null
                    then 'null' else quote_literal(to_jsonb(t) ->> c.column_name) end,
               ', ' order by c.ordinal_position)
        from information_schema.columns c
       where c.table_schema = 'public' and c.table_name = 'templates' and c.column_name <> 'id'
    ) || ')' as row_txt
  from public.templates t
) s;

-- ── 2. template_pricing ─────────────────────────────────────────────────────
select
  'insert into public.template_pricing ('
  || (select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
        from information_schema.columns
       where table_schema = 'public' and table_name = 'template_pricing' and column_name <> 'id')
  || ') values' || E'\n'
  || string_agg(row_txt, ',' || E'\n' order by ord)
  || E'\non conflict (template_name) do update set '
  || (select string_agg(quote_ident(column_name) || ' = excluded.' || quote_ident(column_name),
                        ', ' order by ordinal_position)
        from information_schema.columns
       where table_schema = 'public' and table_name = 'template_pricing'
         and column_name not in ('id', 'template_name', 'created_at'))
  || ';' as seed_sql
from (
  select
    p.template_name as ord,
    '  (' || (
      select string_agg(
               case when to_jsonb(p) ->> c.column_name is null
                    then 'null' else quote_literal(to_jsonb(p) ->> c.column_name) end,
               ', ' order by c.ordinal_position)
        from information_schema.columns c
       where c.table_schema = 'public' and c.table_name = 'template_pricing' and c.column_name <> 'id'
    ) || ')' as row_txt
  from public.template_pricing p
) s;
