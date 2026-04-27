# Quản lý Giá Template

## Tổng quan

Hệ thống sử dụng bảng `template_pricing` trong database để quản lý giá các template thiệp cưới. Điều này đảm bảo:

- ✅ Bảo mật: Client không thể thay đổi giá
- ✅ Linh hoạt: Có thể thay đổi giá mà không cần deploy code
- ✅ Kiểm soát: Tất cả giá được quản lý tập trung

## Cấu trúc Database

```sql
CREATE TABLE template_pricing (
  id UUID PRIMARY KEY,
  template_name TEXT UNIQUE NOT NULL,
  price INTEGER NOT NULL,  -- Giá tính bằng VND
  is_active BOOLEAN DEFAULT true,
  description TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

## Cách thay đổi giá

### 1. Thay đổi giá template hiện có

```sql
-- Cập nhật giá template
UPDATE template_pricing
SET price = 399000
WHERE template_name = 'Classic Elegance';

-- Cập nhật nhiều template cùng lúc
UPDATE template_pricing
SET price = 399000
WHERE template_name IN ('Classic Elegance', 'Modern Minimalist');
```

### 2. Thêm template mới

```sql
INSERT INTO template_pricing (template_name, price, description)
VALUES ('Premium Wedding', 499000, 'Thiệp cưới cao cấp với hiệu ứng đặc biệt');
```

### 3. Vô hiệu hóa template (không cho phép mua)

```sql
UPDATE template_pricing
SET is_active = false
WHERE template_name = 'Old Template';
```

### 4. Kích hoạt lại template

```sql
UPDATE template_pricing
SET is_active = true
WHERE template_name = 'Old Template';
```

## Testing với giá thấp

Để test thanh toán với số tiền nhỏ (ví dụ 29đ):

### Cách 1: Tạo template test riêng

```sql
-- Thêm template test
INSERT INTO template_pricing (template_name, price, description)
VALUES ('TEST_TEMPLATE', 29, 'Template for testing')
ON CONFLICT (template_name) DO UPDATE SET price = 29;
```

Sau đó trong code frontend, tạm thời đổi `templateName` thành `'TEST_TEMPLATE'`.

### Cách 2: Tạm thời giảm giá template hiện có

```sql
-- Backup giá cũ
SELECT template_name, price FROM template_pricing WHERE template_name = 'Classic Elegance';

-- Đổi sang giá test
UPDATE template_pricing SET price = 29 WHERE template_name = 'Classic Elegance';

-- Sau khi test xong, đổi lại
UPDATE template_pricing SET price = 299000 WHERE template_name = 'Classic Elegance';
```

## Xem danh sách giá hiện tại

```sql
SELECT
  template_name,
  price,
  is_active,
  description,
  updated_at
FROM template_pricing
ORDER BY template_name;
```

## Lưu ý quan trọng

1. **Không bao giờ tin giá từ frontend**: Backend luôn lấy giá từ database
2. **Webhook validation**: PayOS webhook cũng validate giá với database
3. **RLS Policy**: Chỉ service role mới có thể thay đổi giá
4. **Giá phải > 0**: Backend sẽ reject nếu giá <= 0

## Flow thanh toán

```
Frontend                Backend                 Database
   |                       |                        |
   |-- template_name ----->|                        |
   |                       |--- SELECT price ------>|
   |                       |<------ 299000 ---------|
   |                       |                        |
   |                       |--- Create PayOS ------>|
   |<----- QR Code --------|                        |
```

## Ví dụ thực tế

### Khuyến mãi giảm giá 20%

```sql
-- Giảm 20% tất cả template
UPDATE template_pricing
SET price = ROUND(price * 0.8)
WHERE is_active = true;
```

### Tăng giá theo mùa

```sql
-- Tăng giá mùa cưới (tháng 10-12)
UPDATE template_pricing
SET price = 349000
WHERE template_name IN ('Classic Elegance', 'Modern Minimalist');
```

### Giá theo gói

```sql
-- Tạo các gói giá khác nhau
INSERT INTO template_pricing (template_name, price, description) VALUES
  ('Basic Package', 199000, 'Gói cơ bản'),
  ('Standard Package', 299000, 'Gói tiêu chuẩn'),
  ('Premium Package', 499000, 'Gói cao cấp')
ON CONFLICT (template_name) DO NOTHING;
```
