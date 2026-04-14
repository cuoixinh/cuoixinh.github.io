-- Xóa bảng cũ (nếu có)
drop table if exists weddings cascade;

-- Tạo bảng mới
create table weddings (
  id uuid default gen_random_uuid() primary key,
  is_active boolean default true,
  slug text unique not null,
  
  -- Thông tin chung
  groom_name text,
  bride_name text,
  story_quote text,
  cover_image_url text,
  gallery_images text[],
  
  -- Lễ thành hôn (CHUNG)
  ceremony_date date,
  ceremony_time text,
  ceremony_lunar text,
  
  -- Nhà trai
  groom_father text,
  groom_mother text,
  groom_address text,
  groom_image_url text,
  groom_google_sheet_url text,
  groom_party_date date,
  groom_party_time text,
  groom_party_lunar text,
  groom_party_location text,
  groom_map_embed_url text,
  groom_map_link text,
  groom_bank_name text,
  groom_bank_number text,
  groom_bank_owner text,
  groom_qr_url text,
  
  -- Nhà gái
  bride_father text,
  bride_mother text,
  bride_address text,
  bride_image_url text,
  bride_google_sheet_url text,
  bride_party_date date,
  bride_party_time text,
  bride_party_lunar text,
  bride_party_location text,
  bride_map_embed_url text,
  bride_map_link text,
  bride_bank_name text,
  bride_bank_number text,
  bride_bank_owner text,
  bride_qr_url text,
  
  created_at timestamptz default now()
);

-- Index cho slug để tăng tốc độ query
create index idx_weddings_slug on weddings(slug);

-- Comments cho từng cột
comment on column weddings.is_active is 'Bật/tắt thiệp: true=hoạt động, false=thu hồi';
comment on column weddings.slug is 'URL slug cho thiệp cưới (unique): van-hung-thuy-hang';

-- Thông tin chung
comment on column weddings.groom_name is 'Tên chú rể: Văn Hùng';
comment on column weddings.bride_name is 'Tên cô dâu: Thùy Hằng';
comment on column weddings.story_quote is 'Câu quote lãng mạn phía trên carousel ảnh';
comment on column weddings.cover_image_url is 'Ảnh dùng chung cho cover và Save The Date';
comment on column weddings.gallery_images is 'Mảng URL ảnh carousel: [url1, url2, ...]';

-- Lễ thành hôn (CHUNG)
comment on column weddings.ceremony_date is 'Ngày lễ thành hôn chung (dương lịch): 2024-10-20';
comment on column weddings.ceremony_time is 'Giờ lễ thành hôn chung: 11:30';
comment on column weddings.ceremony_lunar is 'Âm lịch lễ thành hôn chung (trống = JS tự tính)';

-- Nhà trai
comment on column weddings.groom_father is 'Tên bố chú rể: Nguyễn Minh Tuấn';
comment on column weddings.groom_mother is 'Tên mẹ chú rể: Nguyễn Thị Lan';
comment on column weddings.groom_address is 'Địa chỉ nhà trai';
comment on column weddings.groom_image_url is 'URL ảnh chú rể trong block thông tin gia đình';
comment on column weddings.groom_google_sheet_url is 'URL Google Apps Script load tên khách mời nhà trai';
comment on column weddings.groom_party_date is 'Ngày tiệc cưới nhà trai (dương lịch): 2024-10-21';
comment on column weddings.groom_party_time is 'Giờ tiệc cưới nhà trai: 18:00';
comment on column weddings.groom_party_lunar is 'Âm lịch tiệc cưới nhà trai (trống = JS tự tính)';
comment on column weddings.groom_party_location is 'Địa điểm tiệc cưới nhà trai: Tại tư gia nhà trai';
comment on column weddings.groom_map_embed_url is 'URL Google Maps embed cho iframe preview bản đồ nhà trai';
comment on column weddings.groom_map_link is 'URL Google Maps điều hướng khi bấm Mở Maps nhà trai';
comment on column weddings.groom_bank_name is 'Tên ngân hàng chú rể: VietinBank';
comment on column weddings.groom_bank_number is 'Số tài khoản chú rể: 6888469268';
comment on column weddings.groom_bank_owner is 'Tên chủ tài khoản chú rể: Nguyễn Văn Hùng';
comment on column weddings.groom_qr_url is 'URL ảnh QR chuyển khoản chú rể';

-- Nhà gái
comment on column weddings.bride_father is 'Tên bố cô dâu: Trần Quốc Bảo';
comment on column weddings.bride_mother is 'Tên mẹ cô dâu: Lê Thị Hương';
comment on column weddings.bride_address is 'Địa chỉ nhà gái';
comment on column weddings.bride_image_url is 'URL ảnh cô dâu trong block thông tin gia đình';
comment on column weddings.bride_google_sheet_url is 'URL Google Apps Script load tên khách mời nhà gái';
comment on column weddings.bride_party_date is 'Ngày tiệc cưới nhà gái (dương lịch)';
comment on column weddings.bride_party_time is 'Giờ tiệc cưới nhà gái: 18:00';
comment on column weddings.bride_party_lunar is 'Âm lịch tiệc cưới nhà gái (trống = JS tự tính)';
comment on column weddings.bride_party_location is 'Địa điểm tiệc cưới nhà gái';
comment on column weddings.bride_map_embed_url is 'URL Google Maps embed cho iframe preview bản đồ nhà gái';
comment on column weddings.bride_map_link is 'URL Google Maps điều hướng khi bấm Mở Maps nhà gái';
comment on column weddings.bride_bank_name is 'Tên ngân hàng cô dâu: BIDV';
comment on column weddings.bride_bank_number is 'Số tài khoản cô dâu: 8787867778';
comment on column weddings.bride_bank_owner is 'Tên chủ tài khoản cô dâu: Trần Thùy Hằng';
comment on column weddings.bride_qr_url is 'URL ảnh QR chuyển khoản cô dâu';

-- Row Level Security
alter table weddings enable row level security;

-- Policy: Cho phép đọc công khai
create policy "Public read" on weddings for select using (true);
