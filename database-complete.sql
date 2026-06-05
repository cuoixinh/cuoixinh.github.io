-- ============================================================
-- COMPLETE DATABASE SCHEMA - CUOI XINH
-- Consolidated from all migration files
-- Last updated: 2026-06-09
-- ============================================================

-- ============================================================
-- DROP ALL TABLES (Clean slate)
-- ============================================================
DROP TABLE IF EXISTS payment_logs CASCADE;
DROP TABLE IF EXISTS order_details CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS public.template_pricing CASCADE;
DROP TABLE IF EXISTS public.templates CASCADE;
DROP TABLE IF EXISTS weddings CASCADE;

-- ============================================================
-- BẢNG WEDDINGS - Thông tin thiệp cưới
-- ============================================================

CREATE TABLE weddings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  is_active BOOLEAN DEFAULT true,
  slug TEXT UNIQUE NOT NULL,

  -- Thông tin chung
  groom_name TEXT,
  bride_name TEXT,
  story_quote TEXT,
  cover_image_url TEXT,
  gallery_images TEXT[],

  -- Lễ thành hôn (CHUNG)
  ceremony_date DATE,
  ceremony_time TEXT,
  ceremony_lunar TEXT,
  ceremony_name TEXT,
  ceremony_location TEXT,
  ceremony_map_embed_url TEXT,
  ceremony_use_embed BOOLEAN DEFAULT false,
  ceremony_display_order TEXT DEFAULT 'bride_first',

  -- Lễ vu quy (tuỳ chọn)
  vu_quy_enabled BOOLEAN DEFAULT false,
  vu_quy_time TEXT,
  vu_quy_location TEXT,
  vu_quy_map_embed_url TEXT,
  vu_quy_use_embed BOOLEAN DEFAULT false,

  -- Nhà trai
  groom_father TEXT,
  groom_mother TEXT,
  groom_address TEXT,
  groom_image_url TEXT,
  groom_google_sheet_url TEXT,
  groom_party_date DATE,
  groom_party_time TEXT,
  groom_party_lunar TEXT,
  groom_party_location TEXT,
  -- groom_party_show_location removed: location always shown
  groom_party_map_embed_url TEXT,
  groom_party_use_embed BOOLEAN DEFAULT false,
  groom_map_embed_url TEXT,
  groom_bank_name TEXT,
  groom_bank_number TEXT,
  groom_bank_owner TEXT,
  groom_qr_url TEXT,

  -- Nhà gái
  bride_father TEXT,
  bride_mother TEXT,
  bride_address TEXT,
  bride_image_url TEXT,
  bride_google_sheet_url TEXT,
  bride_party_date DATE,
  bride_party_time TEXT,
  bride_party_lunar TEXT,
  bride_party_location TEXT,
  -- bride_party_show_location removed: location always shown
  bride_party_map_embed_url TEXT,
  bride_party_use_embed BOOLEAN DEFAULT false,
  bride_map_embed_url TEXT,
  bride_bank_name TEXT,
  bride_bank_number TEXT,
  bride_bank_owner TEXT,
  bride_qr_url TEXT,

  -- Theme
  theme TEXT DEFAULT 'basic-gold',

  -- Music
  music_url TEXT,

  -- Payment fields
  payment_status TEXT DEFAULT 'pending',
  payment_order_id TEXT UNIQUE,
  transaction_id TEXT,
  payment_time TIMESTAMPTZ,
  payment_amount INTEGER,

  -- Published state (true = đã thanh toán, thiệp công khai)
  is_published BOOLEAN DEFAULT false,

  -- JSONB fields
  timeline           JSONB DEFAULT '[]'::jsonb,
  love_story         JSONB DEFAULT '[]'::jsonb,
  image_focal_points JSONB DEFAULT '{}'::jsonb,

  -- RSVP & extras
  rsvp_enabled BOOLEAN DEFAULT true,
  rsvp_message TEXT,
  footer_text  TEXT,

  -- Section visibility toggles (hiển thị/ẩn mục trên thiệp)
  enable_family     BOOLEAN DEFAULT true,
  enable_party      BOOLEAN DEFAULT true,
  enable_photos     BOOLEAN DEFAULT true,
  enable_timeline   BOOLEAN DEFAULT true,
  enable_love_story BOOLEAN DEFAULT true,
  enable_music      BOOLEAN DEFAULT true,
  enable_gift       BOOLEAN DEFAULT true,
  enable_footer     BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_weddings_slug ON weddings(slug);
CREATE INDEX idx_weddings_payment_order_id ON weddings(payment_order_id);
CREATE INDEX idx_weddings_transaction_id ON weddings(transaction_id);
CREATE INDEX idx_weddings_payment_status ON weddings(payment_status);
CREATE INDEX idx_weddings_is_published ON weddings(is_published);

-- Comments
COMMENT ON COLUMN weddings.is_active IS 'Bật/tắt thiệp: true=hoạt động, false=thu hồi';
COMMENT ON COLUMN weddings.slug IS 'URL slug cho thiệp cưới (unique): van-hung-thuy-hang';
COMMENT ON COLUMN weddings.groom_name IS 'Tên chú rể: Văn Hùng';
COMMENT ON COLUMN weddings.bride_name IS 'Tên cô dâu: Thùy Hằng';
COMMENT ON COLUMN weddings.story_quote IS 'Câu slogan lãng mạn phía trên carousel ảnh';
COMMENT ON COLUMN weddings.cover_image_url IS 'Ảnh dùng chung cho cover và Save The Date';
COMMENT ON COLUMN weddings.gallery_images IS 'Mảng URL ảnh carousel: [url1, url2, ...]';
COMMENT ON COLUMN weddings.image_focal_points IS 'Điểm lấy nét (%) cho từng ảnh, dùng làm object-position: {"cover_image_url":{"x":50,"y":50},...,"gallery_images":{"<filename>":{"x":50,"y":50},...}}';
COMMENT ON COLUMN weddings.ceremony_date IS 'Ngày lễ thành hôn chung (dương lịch): 2024-10-20';
COMMENT ON COLUMN weddings.ceremony_time IS 'Giờ lễ thành hôn chung: 11:30';
COMMENT ON COLUMN weddings.ceremony_lunar IS 'Âm lịch lễ thành hôn chung (trống = JS tự tính)';
COMMENT ON COLUMN weddings.ceremony_name IS 'Tên lễ thành hôn tuỳ chỉnh';
COMMENT ON COLUMN weddings.ceremony_location IS 'Địa điểm lễ thành hôn';
COMMENT ON COLUMN weddings.ceremony_map_embed_url IS 'Google Maps embed URL lễ thành hôn';
COMMENT ON COLUMN weddings.ceremony_use_embed IS 'true = dùng mã nhúng iframe thay vì map picker lễ thành hôn';
COMMENT ON COLUMN weddings.ceremony_display_order IS 'Thứ tự hiển thị: bride_first hoặc groom_first';
COMMENT ON COLUMN weddings.vu_quy_enabled IS 'true = có lễ vu quy riêng';
COMMENT ON COLUMN weddings.vu_quy_time IS 'Giờ lễ vu quy';
COMMENT ON COLUMN weddings.vu_quy_location IS 'Địa điểm lễ vu quy';
COMMENT ON COLUMN weddings.vu_quy_map_embed_url IS 'Google Maps embed URL lễ vu quy';
COMMENT ON COLUMN weddings.vu_quy_use_embed IS 'true = dùng mã nhúng iframe thay vì map picker lễ vu quy';
COMMENT ON COLUMN weddings.groom_father IS 'Tên bố chú rể: Nguyễn Minh Tuấn';
COMMENT ON COLUMN weddings.groom_mother IS 'Tên mẹ chú rể: Nguyễn Thị Lan';
COMMENT ON COLUMN weddings.groom_address IS 'Địa chỉ nhà trai';
COMMENT ON COLUMN weddings.groom_image_url IS 'URL ảnh chú rể trong block thông tin gia đình';
COMMENT ON COLUMN weddings.groom_google_sheet_url IS 'URL Google Apps Script load tên khách mời nhà trai';
COMMENT ON COLUMN weddings.groom_party_date IS 'Ngày tiệc cưới nhà trai (dương lịch): 2024-10-21';
COMMENT ON COLUMN weddings.groom_party_time IS 'Giờ tiệc cưới nhà trai: 18:00';
COMMENT ON COLUMN weddings.groom_party_lunar IS 'Âm lịch tiệc cưới nhà trai (trống = JS tự tính)';
COMMENT ON COLUMN weddings.groom_party_location IS 'Địa điểm tiệc cưới nhà trai: Tại tư gia nhà trai';
COMMENT ON COLUMN weddings.groom_party_map_embed_url IS 'URL Google Maps embed địa điểm tiệc nhà trai';
COMMENT ON COLUMN weddings.groom_party_use_embed IS 'true = dùng mã nhúng iframe thay vì map picker tiệc nhà trai';
COMMENT ON COLUMN weddings.groom_map_embed_url IS 'URL Google Maps embed (src của iframe) hoặc toàn bộ HTML iframe';
COMMENT ON COLUMN weddings.groom_bank_name IS 'Tên ngân hàng chú rể: VietinBank';
COMMENT ON COLUMN weddings.groom_bank_number IS 'Số tài khoản chú rể: 6888469268';
COMMENT ON COLUMN weddings.groom_bank_owner IS 'Tên chủ tài khoản chú rể: Nguyễn Văn Hùng';
COMMENT ON COLUMN weddings.groom_qr_url IS 'URL ảnh QR chuyển khoản chú rể';
COMMENT ON COLUMN weddings.bride_father IS 'Tên bố cô dâu: Trần Quốc Bảo';
COMMENT ON COLUMN weddings.bride_mother IS 'Tên mẹ cô dâu: Lê Thị Hương';
COMMENT ON COLUMN weddings.bride_address IS 'Địa chỉ nhà gái';
COMMENT ON COLUMN weddings.bride_image_url IS 'URL ảnh cô dâu trong block thông tin gia đình';
COMMENT ON COLUMN weddings.bride_google_sheet_url IS 'URL Google Apps Script load tên khách mời nhà gái';
COMMENT ON COLUMN weddings.bride_party_date IS 'Ngày tiệc cưới nhà gái (dương lịch)';
COMMENT ON COLUMN weddings.bride_party_time IS 'Giờ tiệc cưới nhà gái: 18:00';
COMMENT ON COLUMN weddings.bride_party_lunar IS 'Âm lịch tiệc cưới nhà gái (trống = JS tự tính)';
COMMENT ON COLUMN weddings.bride_party_location IS 'Địa điểm tiệc cưới nhà gái';
COMMENT ON COLUMN weddings.bride_party_map_embed_url IS 'URL Google Maps embed địa điểm tiệc nhà gái';
COMMENT ON COLUMN weddings.bride_party_use_embed IS 'true = dùng mã nhúng iframe thay vì map picker tiệc nhà gái';
COMMENT ON COLUMN weddings.bride_map_embed_url IS 'URL Google Maps embed (src của iframe) hoặc toàn bộ HTML iframe';
COMMENT ON COLUMN weddings.bride_bank_name IS 'Tên ngân hàng cô dâu: BIDV';
COMMENT ON COLUMN weddings.bride_bank_number IS 'Số tài khoản cô dâu: 8787867778';
COMMENT ON COLUMN weddings.bride_bank_owner IS 'Tên chủ tài khoản cô dâu: Trần Thùy Hằng';
COMMENT ON COLUMN weddings.bride_qr_url IS 'URL ảnh QR chuyển khoản cô dâu';
COMMENT ON COLUMN weddings.theme IS 'Tên folder template: basic-gold, romantic-gold, vintage-forest';
COMMENT ON COLUMN weddings.music_url IS 'URL YouTube nhạc nền cho thiệp cưới';
COMMENT ON COLUMN weddings.is_published IS 'true = đã thanh toán, thiệp công khai; false = draft chưa trả tiền';
COMMENT ON COLUMN weddings.timeline IS 'JSON array lịch trình ngày cưới: [{"time":"08:00","title":"Đón dâu"}, ...]';
COMMENT ON COLUMN weddings.love_story IS 'JSON array câu chuyện tình yêu: [{"date":"12/2019","title":"Lần đầu gặp nhau","content":"...","image_url":"..."}]';
COMMENT ON COLUMN weddings.image_focal_points IS 'Điểm lấy nét (%) cho từng ảnh, dùng làm object-position khi hiển thị ở các tỉ lệ khác nhau';
COMMENT ON COLUMN weddings.rsvp_enabled IS 'Bật/tắt tính năng xác nhận tham dự';
COMMENT ON COLUMN weddings.rsvp_message IS 'Lời nhắn RSVP tùy chỉnh';
COMMENT ON COLUMN weddings.footer_text IS 'Lời cảm ơn cuối thiệp';
COMMENT ON COLUMN weddings.payment_status IS 'Trạng thái thanh toán: pending, completed, failed';
COMMENT ON COLUMN weddings.payment_order_id IS 'PayOS order ID (unique per transaction)';
COMMENT ON COLUMN weddings.transaction_id IS 'PayOS transaction reference from bank';
COMMENT ON COLUMN weddings.payment_time IS 'Thời gian thanh toán thành công';
COMMENT ON COLUMN weddings.payment_amount IS 'Số tiền đã thanh toán (VND)';
COMMENT ON COLUMN weddings.enable_family IS 'Hiển thị mục Gia đình hai bên trên thiệp';
COMMENT ON COLUMN weddings.enable_party IS 'Hiển thị mục Tiệc cưới trên thiệp';
COMMENT ON COLUMN weddings.enable_photos IS 'Hiển thị mục Ảnh cưới trên thiệp';
COMMENT ON COLUMN weddings.enable_timeline IS 'Hiển thị mục Lịch trình ngày cưới trên thiệp';
COMMENT ON COLUMN weddings.enable_love_story IS 'Hiển thị mục Câu chuyện tình yêu trên thiệp';
COMMENT ON COLUMN weddings.enable_music IS 'Hiển thị nhạc nền trên thiệp';
COMMENT ON COLUMN weddings.enable_gift IS 'Hiển thị mục Hộp mừng cưới trên thiệp';
COMMENT ON COLUMN weddings.enable_footer IS 'Hiển thị footer trên thiệp';

-- Row Level Security
ALTER TABLE weddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read" ON weddings FOR SELECT USING (true);


-- ============================================================
-- BẢNG ORDERS - Đơn hàng của khách hàng
-- ============================================================

CREATE TABLE orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  guest_email TEXT,
  status TEXT DEFAULT 'pending',
  theme TEXT NOT NULL,
  slug TEXT,
  note TEXT,
  total_price INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON COLUMN orders.user_id IS 'ID user Supabase Auth (null nếu đặt hàng chưa đăng nhập)';
COMMENT ON COLUMN orders.guest_email IS 'Email khách khi chưa đăng nhập';
COMMENT ON COLUMN orders.status IS 'pending=chờ xử lý, processing=đang làm, completed=hoàn thành, cancelled=đã hủy';
COMMENT ON COLUMN orders.theme IS 'Template KH chọn: wedding1, wedding2,...';
COMMENT ON COLUMN orders.slug IS 'Slug thiệp sau khi admin tạo xong';
COMMENT ON COLUMN orders.total_price IS 'Giá tiền đơn hàng (VND)';

-- Indexes
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_guest_email ON orders(guest_email);
CREATE INDEX idx_orders_status ON orders(status);

-- RLS
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User read own orders" ON orders
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "User insert orders" ON orders
  FOR INSERT WITH CHECK (true);


-- ============================================================
-- BẢNG ORDER_DETAILS - Chi tiết nội dung thiệp KH cung cấp
-- ============================================================
CREATE TABLE order_details (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
  groom_name TEXT,
  bride_name TEXT,
  ceremony_date DATE,
  ceremony_time TEXT,
  contact_name TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  extra_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON COLUMN order_details.order_id IS 'FK đến bảng orders';
COMMENT ON COLUMN order_details.groom_name IS 'Tên chú rể KH cung cấp';
COMMENT ON COLUMN order_details.bride_name IS 'Tên cô dâu KH cung cấp';
COMMENT ON COLUMN order_details.ceremony_date IS 'Ngày cưới KH cung cấp';
COMMENT ON COLUMN order_details.contact_name IS 'Tên người liên hệ';
COMMENT ON COLUMN order_details.contact_phone IS 'SĐT liên hệ';
COMMENT ON COLUMN order_details.contact_email IS 'Email liên hệ';
COMMENT ON COLUMN order_details.extra_note IS 'Yêu cầu thêm của KH';

-- RLS
ALTER TABLE order_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User read own order details" ON order_details
  FOR SELECT USING (
    order_id IN (
      SELECT id FROM orders WHERE auth.uid() = user_id
    )
  );

CREATE POLICY "User insert order details" ON order_details
  FOR INSERT WITH CHECK (true);


-- ============================================================
-- BẢNG PAYMENT_LOGS - Audit trail cho payment events
-- ============================================================

CREATE TABLE payment_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id TEXT NOT NULL,
  manage_id UUID,
  event_type TEXT NOT NULL,
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_payment_logs_order_id ON payment_logs(order_id);
CREATE INDEX idx_payment_logs_manage_id ON payment_logs(manage_id);
CREATE INDEX idx_payment_logs_created_at ON payment_logs(created_at DESC);

-- Comments
COMMENT ON TABLE payment_logs IS 'Audit trail for all payment events';
COMMENT ON COLUMN payment_logs.event_type IS 'Type of payment event: created, webhook_received, completed, failed';
COMMENT ON COLUMN payment_logs.payload IS 'Full payload data from PayOS or internal events';


-- ============================================================
-- BẢNG TEMPLATES - Danh sách mẫu thiệp cưới
-- ============================================================

CREATE TABLE public.templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id TEXT UNIQUE NOT NULL,
  template_name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  preview_url TEXT,
  features TEXT[],
  tags TEXT[],
  status TEXT DEFAULT 'active',
  category TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Comments
COMMENT ON TABLE public.templates IS 'Danh sách mẫu thiệp cưới';
COMMENT ON COLUMN public.templates.template_id IS 'ID duy nhất cho template (dùng trong code): classic, modern';
COMMENT ON COLUMN public.templates.template_name IS 'Tên file template (theme): template1, template2';
COMMENT ON COLUMN public.templates.display_name IS 'Tên hiển thị: Classic Elegance';
COMMENT ON COLUMN public.templates.description IS 'Mô tả ngắn về template';
COMMENT ON COLUMN public.templates.thumbnail_url IS 'URL ảnh thumbnail';
COMMENT ON COLUMN public.templates.preview_url IS 'URL preview template';
COMMENT ON COLUMN public.templates.features IS 'Mảng tính năng: gallery, map, qrcode, rsvp, countdown, music';
COMMENT ON COLUMN public.templates.tags IS 'Tags tìm kiếm: cổ điển, lãng mạn, vintage...';
COMMENT ON COLUMN public.templates.status IS 'Trạng thái: active, coming_soon, inactive';
COMMENT ON COLUMN public.templates.category IS 'Danh mục: traditional, modern, luxury, minimal';
COMMENT ON COLUMN public.templates.sort_order IS 'Thứ tự hiển thị (số nhỏ lên trước)';

-- Indexes
CREATE INDEX idx_templates_template_id ON public.templates(template_id);
CREATE INDEX idx_templates_template_name ON public.templates(template_name);
CREATE INDEX idx_templates_status ON public.templates(status);
CREATE INDEX idx_templates_active ON public.templates(is_active);
CREATE INDEX idx_templates_sort_order ON public.templates(sort_order);

-- RLS
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active templates"
  ON public.templates
  FOR SELECT
  USING (is_active = true);

CREATE POLICY "Service role can manage templates"
  ON public.templates
  FOR ALL
  USING (auth.role() = 'service_role');

-- Insert / update all templates
INSERT INTO public.templates (template_id, template_name, display_name, description, preview_url, features, status, category, sort_order, tags)
VALUES
  (
    'basic-gold',
    'basic-gold',
    'Classic Gold',
    'Trắng tinh tế, vàng gold sang trọng — phong cách cổ điển bất hủ',
    '/public/themes/basic-gold/?preview=true',
    ARRAY['gallery', 'map', 'qrcode', 'rsvp', 'countdown', 'music'],
    'active', 'traditional', 1,
    ARRAY['cổ điển', 'sang trọng']
  ),
  (
    'romantic-gold',
    'romantic-gold',
    'Romantic Gold',
    'Xanh sage & vàng gold, lãng mạn và tinh tế',
    '/public/themes/romantic-gold/?preview=true',
    ARRAY['gallery', 'map', 'qrcode', 'rsvp', 'music'],
    'active', 'modern', 2,
    ARRAY['lãng mạn', 'hiện đại']
  ),
  (
    'vintage-forest',
    'vintage-forest',
    'Vintage Forest',
    'Kem vintage, nâu gỗ, xanh rừng — ấm áp và gần gũi',
    '/public/themes/vintage-forest/?preview=true',
    ARRAY['gallery', 'map', 'qrcode', 'rsvp', 'music'],
    'active', 'vintage', 3,
    ARRAY['vintage', 'thiên nhiên']
  )
ON CONFLICT (template_id) DO UPDATE SET
  template_name = EXCLUDED.template_name,
  display_name  = EXCLUDED.display_name,
  description   = EXCLUDED.description,
  preview_url   = EXCLUDED.preview_url,
  features      = EXCLUDED.features,
  status        = EXCLUDED.status,
  category      = EXCLUDED.category,
  sort_order    = EXCLUDED.sort_order,
  tags          = EXCLUDED.tags,
  updated_at    = NOW();

-- Trigger function for updated_at
CREATE OR REPLACE FUNCTION update_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_templates_updated_at ON public.templates;
CREATE TRIGGER update_templates_updated_at
  BEFORE UPDATE ON public.templates
  FOR EACH ROW
  EXECUTE FUNCTION update_templates_updated_at();


-- ============================================================
-- BẢNG TEMPLATE_PRICING - Giá của từng template
-- ============================================================

CREATE TABLE public.template_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name TEXT UNIQUE NOT NULL,
  price INTEGER NOT NULL,
  original_price INTEGER,
  is_active BOOLEAN DEFAULT true,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Comments
COMMENT ON COLUMN public.template_pricing.original_price IS 'Giá gốc trước khuyến mãi (VND). NULL = không có khuyến mãi';
COMMENT ON COLUMN public.template_pricing.price IS 'Giá sau khuyến mãi (VND). Đây là giá thực tế khách phải trả';

-- Indexes
CREATE INDEX idx_template_pricing_name ON public.template_pricing(template_name);
CREATE INDEX idx_template_pricing_active ON public.template_pricing(is_active);

-- RLS
ALTER TABLE public.template_pricing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active pricing"
  ON public.template_pricing
  FOR SELECT
  USING (is_active = true);

CREATE POLICY "Service role can manage pricing"
  ON public.template_pricing
  FOR ALL
  USING (auth.role() = 'service_role');

-- Insert / update pricing for all templates
INSERT INTO public.template_pricing (template_name, price, original_price, description) VALUES
  ('basic-gold',      159000, 199000, 'Classic Gold — 159.000đ'),
  ('romantic-gold',   159000, 199000, 'Romantic Gold — 159.000đ'),
  ('vintage-forest',  159000, 199000, 'Vintage Forest — 159.000đ')
ON CONFLICT (template_name) DO UPDATE SET
  price          = EXCLUDED.price,
  original_price = EXCLUDED.original_price,
  description    = EXCLUDED.description,
  updated_at     = NOW();

-- Trigger function for updated_at
CREATE OR REPLACE FUNCTION update_template_pricing_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_template_pricing_updated_at ON public.template_pricing;
CREATE TRIGGER update_template_pricing_updated_at
  BEFORE UPDATE ON public.template_pricing
  FOR EACH ROW
  EXECUTE FUNCTION update_template_pricing_updated_at();


-- ============================================================
-- BẢNG PROMO_CODES - Mã giảm giá
-- ============================================================

DROP TABLE IF EXISTS promo_codes CASCADE;

CREATE TABLE promo_codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percent', 'fixed')),
  discount_value INTEGER NOT NULL,
  min_order_amount INTEGER DEFAULT 0,
  max_uses INTEGER,
  used_count INTEGER DEFAULT 0,
  expires_at TIMESTAMPTZ,
  show_on_banner BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON COLUMN promo_codes.code IS 'Mã giảm giá, viết hoa: CUOIXINH2026';
COMMENT ON COLUMN promo_codes.discount_type IS 'percent = giảm %, fixed = giảm số tiền cố định (VND)';
COMMENT ON COLUMN promo_codes.discount_value IS '20 = giảm 20% hoặc 20000 = giảm 20.000đ';
COMMENT ON COLUMN promo_codes.max_uses IS 'Số lần dùng tối đa, null = không giới hạn';
COMMENT ON COLUMN promo_codes.show_on_banner IS 'Hiển thị mã này trên banner landing page';

CREATE INDEX idx_promo_codes_code ON promo_codes(code);
CREATE INDEX idx_promo_codes_active ON promo_codes(is_active);

-- RLS
ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read active promo" ON promo_codes
  FOR SELECT USING (is_active = true);

-- Mã mặc định
INSERT INTO promo_codes (code, discount_type, discount_value, show_on_banner, is_active)
VALUES ('CUOIXINH', 'fixed', 20000, true, true);


-- ============================================================
-- END OF SCHEMA
-- ============================================================
