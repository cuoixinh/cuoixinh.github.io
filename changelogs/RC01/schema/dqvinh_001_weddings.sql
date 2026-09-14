-- ============================================================
-- SCHEMA 01 — Bảng `weddings` (thiệp cưới)
--
-- Bảng trung tâm: mỗi hàng là một tấm thiệp. Client KHÔNG đọc thẳng bảng này —
-- RLS bật mà không có policy nào, nên qua PostgREST bằng anon/authenticated là
-- 0 hàng. Mọi truy cập đi qua Edge Function `wedding-admin` (service_role, bỏ
-- qua RLS) và chính nó kiểm quyền theo `user_id`.
--
-- Idempotent: chạy lại trên project đã có bảng thì chỉ bổ sung phần thiếu.
-- ============================================================

create table if not exists public.weddings (
  id       uuid primary key default gen_random_uuid(),
  user_id  uuid references auth.users(id) on delete set null,
  is_active boolean default true,
  slug     text unique not null,

  -- Thông tin chung
  groom_name      text,
  bride_name      text,
  groom_phone     text,
  bride_phone     text,
  story_quote     text,
  cover_image_url text,
  gallery_images  text[],

  -- Lễ thành hôn (chung)
  ceremony_date           date,
  ceremony_time           text,
  ceremony_lunar          text,
  ceremony_name           text,
  ceremony_location       text,
  ceremony_map_embed_url  text,
  ceremony_use_embed      boolean default false,
  ceremony_display_order  text default 'bride_first',

  -- Lễ vu quy (tuỳ chọn)
  vu_quy_enabled        boolean default false,
  vu_quy_time           text,
  vu_quy_location       text,
  vu_quy_map_embed_url  text,
  vu_quy_use_embed      boolean default false,

  -- Nhà trai
  groom_father              text,
  groom_mother              text,
  groom_address             text,
  groom_image_url           text,
  groom_party_date          date,
  groom_party_time          text,
  groom_party_lunar         text,
  groom_party_location      text,
  groom_party_map_embed_url text,
  groom_party_use_embed     boolean default false,
  groom_map_embed_url       text,
  groom_bank_name           text,
  groom_bank_number         text,
  groom_bank_owner          text,
  groom_qr_url              text,

  -- Nhà gái
  bride_father              text,
  bride_mother              text,
  bride_address             text,
  bride_image_url           text,
  bride_party_date          date,
  bride_party_time          text,
  bride_party_lunar         text,
  bride_party_location      text,
  bride_party_map_embed_url text,
  bride_party_use_embed     boolean default false,
  bride_map_embed_url       text,
  bride_bank_name           text,
  bride_bank_number         text,
  bride_bank_owner          text,
  bride_qr_url              text,

  -- Mẫu thiệp & nhạc
  theme         text default 'basic-gold',
  theme_setting jsonb,
  music_url     text,

  -- Thanh toán
  payment_status   text default 'pending',
  payment_order_id text unique,
  transaction_id   text,
  payment_time     timestamptz,
  payment_amount   integer,

  -- Trạng thái phát hành
  is_published boolean default false,
  expires_at   timestamptz,

  -- Khối nội dung (jsonb)
  timeline           jsonb default '[]'::jsonb,
  love_story         jsonb default '[]'::jsonb,
  image_focal_points jsonb default '{}'::jsonb,

  -- RSVP & chia sẻ
  rsvp_enabled           boolean default true,
  rsvp_message           text,
  share_message_template text,
  footer_text            text,

  -- Bật/tắt từng mục trên thiệp
  enable_family     boolean default true,
  enable_party      boolean default true,
  enable_photos     boolean default true,
  enable_timeline   boolean default true,
  enable_love_story boolean default true,
  enable_music      boolean default true,
  enable_gift       boolean default true,
  enable_footer     boolean default true,
  enable_wishes     boolean default true,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Nâng cấp project đã có bảng từ bản cũ hơn.
alter table public.weddings
  add column if not exists user_id uuid references auth.users(id) on delete set null,
  add column if not exists groom_phone text,
  add column if not exists bride_phone text,
  add column if not exists theme_setting jsonb,
  add column if not exists expires_at timestamptz,
  add column if not exists share_message_template text,
  add column if not exists enable_wishes boolean default true,
  add column if not exists updated_at timestamptz;

-- Hàng cũ chưa có `updated_at` thì lấy tạm ngày tạo. Phải backfill TRƯỚC khi đặt
-- default: từ PG11, `add column … default now()` điền now() cho mọi hàng cũ →
-- nháp bỏ quên hai năm bỗng thành "vừa sửa hôm nay" và thoát khỏi lượt dọn dẹp.
update public.weddings set updated_at = coalesce(created_at, now()) where updated_at is null;
alter table public.weddings alter column updated_at set default now();


-- ============ Chú thích cột ============

comment on column public.weddings.user_id      is 'Chủ thiệp (Supabase Auth). Null = tạo bởi khách chưa đăng nhập';
comment on column public.weddings.is_active    is 'Bật/tắt thiệp: false = đã thu hồi, không hiện trong danh sách của khách';
comment on column public.weddings.slug         is 'Đường dẫn công khai của thiệp (duy nhất): van-hung-thuy-hang';
comment on column public.weddings.groom_phone  is 'Số điện thoại liên hệ của chú rể (bước "Thông tin cặp đôi")';
comment on column public.weddings.bride_phone  is 'Số điện thoại liên hệ của cô dâu (bước "Thông tin cặp đôi")';
comment on column public.weddings.story_quote  is 'Câu dẫn phía trên carousel ảnh';
comment on column public.weddings.cover_image_url is 'Ảnh dùng chung cho bìa và Save The Date';
comment on column public.weddings.gallery_images  is 'Mảng tên file ảnh carousel';
comment on column public.weddings.image_focal_points is 'Điểm lấy nét (%) của từng ảnh, đổ vào object-position: {"cover_image_url":{"x":50,"y":50}, "gallery_images":{"<file>":{…}}}';
comment on column public.weddings.ceremony_lunar is 'Âm lịch lễ thành hôn (để trống thì JS tự tính)';
comment on column public.weddings.ceremony_display_order is 'Thứ tự hiển thị hai họ: bride_first | groom_first';
comment on column public.weddings.ceremony_use_embed is 'true = dùng mã nhúng iframe thay cho map picker';
comment on column public.weddings.vu_quy_enabled is 'true = có lễ vu quy riêng';
comment on column public.weddings.theme         is 'Tên thư mục mẫu trong public/themes/';
comment on column public.weddings.theme_setting is 'Tuỳ chỉnh giao diện của thiệp (bộ màu, phần tử thả thêm, hộp mừng cưới, mẫu văn bản). Null = giữ nguyên mẫu';
comment on column public.weddings.music_url     is 'Link YouTube nhạc nền';
comment on column public.weddings.payment_status  is 'pending | completed | failed';
comment on column public.weddings.payment_order_id is 'Mã đơn PayOS (duy nhất cho mỗi giao dịch)';
comment on column public.weddings.transaction_id   is 'Mã giao dịch ngân hàng do PayOS trả về';
comment on column public.weddings.is_published is 'true = thiệp đã xuất bản, khách mời mở được';
comment on column public.weddings.expires_at   is 'Hạn dùng thử của thiệp đã xuất bản. Null = đã kích hoạt vĩnh viễn hoặc chưa xuất bản';
comment on column public.weddings.updated_at   is 'Lần ghi gần nhất (trigger tự đặt). Nháp quá hạn không đụng tới sẽ bị dọn tự động';
comment on column public.weddings.timeline     is 'Lịch trình ngày cưới: [{"time":"08:00","title":"Đón dâu","description":"…"}]';
comment on column public.weddings.love_story   is 'Câu chuyện tình yêu: [{"date":"12/2019","title":"…","content":"…","image_url":"…"}]';
comment on column public.weddings.share_message_template is 'Câu mẫu chia sẻ (mail merge ##Danh xưng##, ##link##). Null = dùng câu mặc định';
comment on column public.weddings.enable_wishes is 'Hiện mục Lời chúc (khách mời gửi lời chúc trên thiệp)';

comment on column public.weddings.groom_name is
  'Tên chú rể: Văn Hùng';
comment on column public.weddings.bride_name is
  'Tên cô dâu: Thùy Hằng';
comment on column public.weddings.ceremony_date is
  'Ngày lễ thành hôn chung (dương lịch): 2024-10-20';
comment on column public.weddings.ceremony_time is
  'Giờ lễ thành hôn chung: 11:30';
comment on column public.weddings.ceremony_name is
  'Tên lễ thành hôn tuỳ chỉnh';
comment on column public.weddings.ceremony_location is
  'Địa điểm lễ thành hôn';
comment on column public.weddings.ceremony_map_embed_url is
  'Google Maps embed URL lễ thành hôn';
comment on column public.weddings.vu_quy_time is
  'Giờ lễ vu quy';
comment on column public.weddings.vu_quy_location is
  'Địa điểm lễ vu quy';
comment on column public.weddings.vu_quy_map_embed_url is
  'Google Maps embed URL lễ vu quy';
comment on column public.weddings.vu_quy_use_embed is
  'true = dùng mã nhúng iframe thay vì map picker lễ vu quy';
comment on column public.weddings.groom_father is
  'Tên bố chú rể: Nguyễn Minh Tuấn';
comment on column public.weddings.groom_mother is
  'Tên mẹ chú rể: Nguyễn Thị Lan';
comment on column public.weddings.groom_address is
  'Địa chỉ nhà trai';
comment on column public.weddings.groom_image_url is
  'URL ảnh chú rể trong block thông tin gia đình';
comment on column public.weddings.groom_party_date is
  'Ngày tiệc cưới nhà trai (dương lịch): 2024-10-21';
comment on column public.weddings.groom_party_time is
  'Giờ tiệc cưới nhà trai: 18:00';
comment on column public.weddings.groom_party_lunar is
  'Âm lịch tiệc cưới nhà trai (trống = JS tự tính)';
comment on column public.weddings.groom_party_location is
  'Địa điểm tiệc cưới nhà trai: Tại tư gia nhà trai';
comment on column public.weddings.groom_party_map_embed_url is
  'URL Google Maps embed địa điểm tiệc nhà trai';
comment on column public.weddings.groom_party_use_embed is
  'true = dùng mã nhúng iframe thay vì map picker tiệc nhà trai';
comment on column public.weddings.groom_map_embed_url is
  'URL Google Maps embed (src của iframe) hoặc toàn bộ HTML iframe';
comment on column public.weddings.groom_bank_name is
  'Tên ngân hàng chú rể: VietinBank';
comment on column public.weddings.groom_bank_number is
  'Số tài khoản chú rể: 6888469268';
comment on column public.weddings.groom_bank_owner is
  'Tên chủ tài khoản chú rể: Nguyễn Văn Hùng';
comment on column public.weddings.groom_qr_url is
  'URL ảnh QR chuyển khoản chú rể';
comment on column public.weddings.bride_father is
  'Tên bố cô dâu: Trần Quốc Bảo';
comment on column public.weddings.bride_mother is
  'Tên mẹ cô dâu: Lê Thị Hương';
comment on column public.weddings.bride_address is
  'Địa chỉ nhà gái';
comment on column public.weddings.bride_image_url is
  'URL ảnh cô dâu trong block thông tin gia đình';
comment on column public.weddings.bride_party_date is
  'Ngày tiệc cưới nhà gái (dương lịch)';
comment on column public.weddings.bride_party_time is
  'Giờ tiệc cưới nhà gái: 18:00';
comment on column public.weddings.bride_party_lunar is
  'Âm lịch tiệc cưới nhà gái (trống = JS tự tính)';
comment on column public.weddings.bride_party_location is
  'Địa điểm tiệc cưới nhà gái';
comment on column public.weddings.bride_party_map_embed_url is
  'URL Google Maps embed địa điểm tiệc nhà gái';
comment on column public.weddings.bride_party_use_embed is
  'true = dùng mã nhúng iframe thay vì map picker tiệc nhà gái';
comment on column public.weddings.bride_map_embed_url is
  'URL Google Maps embed (src của iframe) hoặc toàn bộ HTML iframe';
comment on column public.weddings.bride_bank_name is
  'Tên ngân hàng cô dâu: BIDV';
comment on column public.weddings.bride_bank_number is
  'Số tài khoản cô dâu: 8787867778';
comment on column public.weddings.bride_bank_owner is
  'Tên chủ tài khoản cô dâu: Trần Thùy Hằng';
comment on column public.weddings.bride_qr_url is
  'URL ảnh QR chuyển khoản cô dâu';
comment on column public.weddings.rsvp_enabled is
  'Bật/tắt tính năng xác nhận tham dự';
comment on column public.weddings.rsvp_message is
  'Lời nhắn RSVP tùy chỉnh';
comment on column public.weddings.footer_text is
  'Lời cảm ơn cuối thiệp';
comment on column public.weddings.payment_time is
  'Thời gian thanh toán thành công';
comment on column public.weddings.payment_amount is
  'Số tiền đã thanh toán (VND)';
comment on column public.weddings.enable_family is
  'Hiển thị mục Gia đình hai bên trên thiệp';
comment on column public.weddings.enable_party is
  'Hiển thị mục Tiệc cưới trên thiệp';
comment on column public.weddings.enable_photos is
  'Hiển thị mục Ảnh cưới trên thiệp';
comment on column public.weddings.enable_timeline is
  'Hiển thị mục Lịch trình ngày cưới trên thiệp';
comment on column public.weddings.enable_love_story is
  'Hiển thị mục Câu chuyện tình yêu trên thiệp';
comment on column public.weddings.enable_music is
  'Hiển thị nhạc nền trên thiệp';
comment on column public.weddings.enable_gift is
  'Hiển thị mục Hộp mừng cưới trên thiệp';
comment on column public.weddings.enable_footer is
  'Hiển thị footer trên thiệp';

-- ============ Index ============

create index if not exists idx_weddings_slug             on public.weddings(slug);
create index if not exists idx_weddings_user_id          on public.weddings(user_id);
create index if not exists idx_weddings_payment_order_id on public.weddings(payment_order_id);
create index if not exists idx_weddings_transaction_id   on public.weddings(transaction_id);
create index if not exists idx_weddings_payment_status   on public.weddings(payment_status);
create index if not exists idx_weddings_is_published     on public.weddings(is_published);
create index if not exists idx_weddings_expires_at       on public.weddings(expires_at);

-- Hai index phục vụ cron dọn dẹp. Partial nên rất nhỏ: chỉ chứa đúng nhóm hàng
-- có khả năng bị dọn.
create index if not exists idx_weddings_cleanup_unpaid
  on public.weddings(expires_at)
  where is_published and payment_status is distinct from 'completed';

create index if not exists idx_weddings_cleanup_draft
  on public.weddings(updated_at)
  where not is_published;


-- ============ Trigger đóng dấu updated_at ============

create or replace function public.cx_touch_weddings_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists cx_touch_weddings_updated_at on public.weddings;
create trigger cx_touch_weddings_updated_at
  before update on public.weddings
  for each row
  execute function public.cx_touch_weddings_updated_at();


-- ============ RLS ============
-- Bật, KHÔNG policy: mọi truy cập của anon/authenticated qua PostgREST trả 0
-- hàng. Thêm một policy `using (true)` ở đây là mở lại đường đọc toàn bộ thiệp
-- bằng anon key — kể cả số tài khoản ngân hàng và thiệp chưa xuất bản.

alter table public.weddings enable row level security;

drop policy if exists "Public read"          on public.weddings;
drop policy if exists "Public read weddings" on public.weddings;
