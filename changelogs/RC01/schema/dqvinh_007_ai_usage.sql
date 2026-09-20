-- ============================================================
-- SCHEMA 07 — Hạn mức dùng AI (`ai_chat_usage`)
--
-- MỘT bảng đếm lượt gọi model theo NGÀY cho MỌI luồng AI, để không đốt hết free
-- tier Gemini. Tên bảng giữ theo lịch sử (ban đầu chỉ có trợ lý chat).
--
-- `subject` = "<tính năng>:<chiều đếm>":
--   tính năng — "chat" (Trợ lý XuXi) · "inv" (Tối ưu văn bản / Chuyện tình yêu /
--               Dữ liệu mẫu). Nhờ tiền tố này mà mỗi tính năng vẫn có hạn mức
--               RIÊNG dù chung bảng: lượt chat không ăn vào lượt nút "Tối ưu".
--   chiều đếm — "u:<user_id>" (đã đăng nhập) · "ip:<addr>" + "dev:<mã thiết bị>"
--               (chưa đăng nhập, đếm CẢ HAI chiều, chiều nào chạm trần cũng chặn).
--
-- Thêm luồng AI mới hay thêm chiều đếm mới chỉ là thêm một tiền tố, không thêm
-- bảng. Phép đếm dùng chung ở supabase/functions/_shared/ai-rate-limit.ts.
--
-- RLS bật, KHÔNG policy → chỉ Edge Function (service_role) ghi/đọc được. Client
-- mà đọc được thì cũng sửa được số đếm, tức là bỏ qua hạn mức.
-- ============================================================

create table if not exists public.ai_chat_usage (
  subject    text not null,
  day        date not null default current_date,
  count      integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (subject, day)
);

comment on column public.ai_chat_usage.subject is
  'Chủ thể tính hạn mức: "<chat|inv>:" + "u:<user_id>" | "ip:<địa chỉ>" | "dev:<mã thiết bị>"';

alter table public.ai_chat_usage enable row level security;

-- Bỏ hai bảng của bản cũ: `ai_usage` (khoá user_id) và `ai_usage_ip` (khoá ip)
-- đếm đúng việc mà ai_chat_usage đang làm, nhưng mỗi chiều đếm một bảng nên không
-- thêm được chiều "dev:". Không chuyển dữ liệu: count là số đếm THEO NGÀY, mất là
-- khách được thêm lượt trong hôm nay, không ảnh hưởng gì về sau.
drop table if exists public.ai_usage    cascade;
drop table if exists public.ai_usage_ip cascade;

-- Dọn hàng còn ở định dạng cũ (chưa có tiền tố tính năng) — chúng không khớp với
-- subject nào Edge Function đang đọc nên chỉ nằm chiếm chỗ.
delete from public.ai_chat_usage where subject !~ '^(chat|inv):';
