# Phân Tích Đối Thủ & Kế Hoạch Cải Tiến

> Nguồn: crawl trực tiếp motdoi.com.vn/tao-thiep — 2026-06-04

---

## 1. Tổng Quan Đối Thủ: Một Đời (motdoi.com.vn)

| Hạng mục | Một Đời | CuoiXinh (hiện tại) |
|---|---|---|
| Số templates | 9 | 3 (basic-gold, romantic-gold, vintage-forest) |
| Giá | 119.000đ/mẫu, trả 1 lần | Tương tự |
| Free trial | ✅ Tạo nháp miễn phí, xem trước khi mua | ❌ Phải trả tiền rồi mới điền |
| Promo code | ✅ Code "100THIEP" | ❌ Chưa có |
| Link cá nhân hóa | ✅ | ✅ |
| RSVP | ✅ | ✅ |
| Social proof trên template | ✅ "40 cặp đã dùng" | ❌ |
| Đổi template sau mua | ✅ | ❌ |

---

## 2. Phân Tích UX Flow — Trang Tạo Thiệp

### Một Đời — 5 bước rõ ràng:

```
① Chọn template  →  ② Điền thông tin  →  ③ Xem trước & test  →  ④ Lên kế hoạch  →  ⑤ Thanh toán
```

**Điểm mấu chốt:** Khách hàng **điền toàn bộ thông tin TRƯỚC** khi trả tiền.
- Tăng chuyển đổi vì người dùng đã đầu tư thời gian vào sản phẩm.
- Giảm lo lắng "trả tiền mà không biết kết quả thế nào".
- Tạo sunk cost effect — đã điền xong thì tiếc nếu không mua.

### CuoiXinh hiện tại — Flow gây friction:

```
① Browse landing  →  ② Chọn template  →  ③ Điền tên + SĐT  →  ④ Trả tiền  →  ⑤ Nhận link  →  ⑥ Điền chi tiết
```

**Vấn đề:** Khách trả tiền khi chỉ thấy demo chung, chưa thấy thiệp với dữ liệu thật của mình.

---

## 3. Tính Năng Cần Học Theo (Ưu tiên cao → thấp)

### 🔴 P0 — Ảnh hưởng trực tiếp tỷ lệ chuyển đổi

#### 3.1 Free Draft — Điền trước, trả sau

**Mô tả:** Khách hàng tạo tài khoản / điền thông tin thiệp hoàn chỉnh trước khi thanh toán. Sau khi trả tiền → thiệp được kích hoạt và có thể chia sẻ.

**Flow mới:**
```
Chọn template → Điền thông tin (free, có slug nhưng ẩn) → Xem preview với dữ liệu thật → Thanh toán → Chia sẻ được
```

**DB cần:** Thêm `is_published BOOLEAN DEFAULT false` vào `weddings`.
- `is_published = false` → Thiệp ở trạng thái draft, chỉ chủ sở hữu xem được qua link có token
- `is_published = true` → Thiệp công khai, khách mời truy cập được qua slug

**Logic thay đổi:**
- `is_active` hiện tại = admin bật/tắt thiệp
- `is_published` mới = khách hàng đã trả tiền chưa
- `router.html` chỉ serve thiệp khi `is_active = true AND is_published = true`

---

#### 3.2 Promo Code

**Mô tả:** Nhập mã giảm giá trong payment modal.

**DB cần:** Thêm bảng `promo_codes`.

**Fields:**
```sql
code TEXT UNIQUE         -- "CUOI2026"
discount_type TEXT       -- "percent" | "fixed"
discount_value INTEGER   -- 20 (%) hoặc 50000 (VND)
max_uses INTEGER         -- null = không giới hạn
used_count INTEGER       -- đếm số lần dùng
expires_at TIMESTAMPTZ   -- null = không hết hạn
is_active BOOLEAN
```

---

### 🟡 P1 — UX / Trust signals

#### 3.3 Step Indicator trong Flow

**Mô tả:** Thanh hiển thị tiến trình khi khách điền thông tin thiệp.

```
[① Chọn mẫu] → [② Thông tin] → [③ Xem trước] → [④ Thanh toán]
```

- Không cần DB thay đổi.
- Implement trong `invitation-setup/index.html`.

---

#### 3.4 Preview với dữ liệu thật trước khi trả tiền

**Mô tả:** Nút "Xem trước thiệp" trong bước 3 mở template với dữ liệu thật của khách (không phải demo data).

- Dùng `?preview=true` mode đã có sẵn trong templates.
- Truyền data qua `sessionStorage` hoặc URL params (tạm thời, trước khi có draft flow).
- Không cần DB thay đổi.

---

#### 3.5 Descriptive Template Names & Mô Tả

**Mô tả:** Mỗi template cần có tên gợi cảm xúc, mô tả style, và tag phong cách.

| Template | Tên hiển thị | Mô tả | Tags |
|---|---|---|---|
| basic-gold | Classic Gold | Trắng tinh tế, vàng gold sang trọng | #cổ-điển #sang-trọng |
| romantic-gold | Romantic Gold | Xanh sage & gold, lãng mạn tinh tế | #lãng-mạn #hiện-đại |
| vintage-forest | Vintage Forest | Kem vintage, nâu gỗ, xanh rừng | #vintage #thiên-nhiên |

**DB cần:** Cập nhật bảng `templates` với `template_name`, `description`, `tags TEXT[]`.

---

### 🟢 P2 — Nice to have

#### 3.6 Promo Banner trên Landing Page

**Mô tả:** Banner hiển thị mã giảm giá hiện tại (như "100THIEP").
- Lấy từ bảng `promo_codes` có `show_on_banner = true`.

**DB cần:** Thêm `show_on_banner BOOLEAN DEFAULT false` vào `promo_codes`.

---

#### 3.7 Template Category Filter

**Mô tả:** Lọc templates theo phong cách (cổ điển / hiện đại / vintage).
- Bảng `templates` đã có `category` column.
- Chỉ cần implement UI filter.

---

## 4. DB Schema Changes Cần Thiết

### 4.1 Bảng `weddings` — Thêm `is_published`

```sql
ALTER TABLE weddings ADD COLUMN is_published BOOLEAN DEFAULT false;
COMMENT ON COLUMN weddings.is_published IS 'true = đã thanh toán, thiệp công khai; false = draft';
CREATE INDEX idx_weddings_is_published ON weddings(is_published);
```

**Migration cho data cũ:**
```sql
-- Các wedding đã thanh toán thành công → published
UPDATE weddings SET is_published = true WHERE payment_status = 'completed';
```

---

### 4.2 Bảng `promo_codes` — Tạo mới

```sql
CREATE TABLE promo_codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percent', 'fixed')),
  discount_value INTEGER NOT NULL,
  max_uses INTEGER,
  used_count INTEGER DEFAULT 0,
  min_order_amount INTEGER DEFAULT 0,
  expires_at TIMESTAMPTZ,
  show_on_banner BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON COLUMN promo_codes.code IS 'Mã giảm giá, viết hoa: CUOI2026';
COMMENT ON COLUMN promo_codes.discount_type IS 'percent = giảm %, fixed = giảm số tiền cố định';
COMMENT ON COLUMN promo_codes.discount_value IS 'Giá trị giảm: 20 (%) hoặc 50000 (VND)';
COMMENT ON COLUMN promo_codes.max_uses IS 'Số lần dùng tối đa, null = không giới hạn';
COMMENT ON COLUMN promo_codes.show_on_banner IS 'Hiển thị mã này trên banner landing page';

CREATE INDEX idx_promo_codes_code ON promo_codes(code);
CREATE INDEX idx_promo_codes_active ON promo_codes(is_active);

-- RLS
ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read active promo" ON promo_codes
  FOR SELECT USING (is_active = true);

-- Insert mã mặc định
INSERT INTO promo_codes (code, discount_type, discount_value, show_on_banner, is_active)
VALUES ('CUOIXINH', 'fixed', 20000, true, true);
```

---

### 4.3 Bảng `templates` — Cập nhật data

```sql
-- Cập nhật template_name và preview_url sang đường dẫn mới
UPDATE public.templates SET
  template_name = 'basic-gold',
  preview_url = '/public/themes/basic-gold/?preview=true',
  display_name = 'Classic Gold',
  description = 'Trắng tinh tế, vàng gold sang trọng — phong cách cổ điển bất hủ',
  category = 'traditional'
WHERE template_id = 'classic';

-- Thêm romantic-gold và vintage-forest nếu chưa có
INSERT INTO public.templates (template_id, template_name, display_name, description, preview_url, features, status, category, sort_order)
VALUES
  ('romantic-gold', 'romantic-gold', 'Romantic Gold', 'Xanh sage & vàng gold, lãng mạn và tinh tế',
   '/public/themes/romantic-gold/?preview=true',
   ARRAY['gallery', 'map', 'qrcode', 'rsvp', 'music'], 'active', 'modern', 2),
  ('vintage-forest', 'vintage-forest', 'Vintage Forest', 'Kem vintage, nâu gỗ, xanh rừng — ấm áp và gần gũi',
   '/public/themes/vintage-forest/?preview=true',
   ARRAY['gallery', 'map', 'qrcode', 'rsvp', 'music'], 'active', 'vintage', 3)
ON CONFLICT (template_id) DO UPDATE SET
  template_name = EXCLUDED.template_name,
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  preview_url = EXCLUDED.preview_url,
  features = EXCLUDED.features,
  category = EXCLUDED.category,
  sort_order = EXCLUDED.sort_order,
  updated_at = NOW();

-- Thêm column tags nếu muốn filter UI
ALTER TABLE public.templates ADD COLUMN IF NOT EXISTS tags TEXT[];
UPDATE public.templates SET tags = ARRAY['cổ điển', 'sang trọng'] WHERE template_id = 'classic';
UPDATE public.templates SET tags = ARRAY['lãng mạn', 'hiện đại'] WHERE template_id = 'romantic-gold';
UPDATE public.templates SET tags = ARRAY['vintage', 'thiên nhiên'] WHERE template_id = 'vintage-forest';
```

---

## 5. Lộ Trình Triển Khai

```
Phase 1 (ngay bây giờ):
  ✅ Đổi tên templates → basic-gold, romantic-gold, vintage-forest
  ✅ Cập nhật DB templates table
  ⬜ Thêm is_published vào weddings
  ⬜ Tạo bảng promo_codes

Phase 2 (tuần tới):
  ⬜ Promo code trong payment modal
  ⬜ Template preview với data thật (sessionStorage)
  ⬜ Step indicator trong invitation-setup

Phase 3 (sau):
  ⬜ Free draft flow (điền trước, trả sau)
  ⬜ Promo banner trên landing page
  ⬜ Template category filter
```

---

## 6. Insight Quan Trọng Nhất

> **Motdoi thành công vì họ để người dùng "đầu tư" vào sản phẩm trước khi trả tiền.**
> Khi khách đã dành 30 phút điền tên, upload ảnh, chọn nhạc — họ gần như chắc chắn sẽ mua.
> CuoiXinh đang để khách trả tiền "mù", đây là điểm friction lớn nhất cần giải quyết.
