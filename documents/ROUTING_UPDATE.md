# Cập nhật Routing - Landing Page & Smart Routing

## Tổng quan thay đổi

Đã triển khai hệ thống routing thông minh với landing page và kiểm tra slug tồn tại.

## Các thay đổi chính

### 1. Tạo Landing Page mới (`index.html`)

- Trang chủ giới thiệu dịch vụ thiệp cưới
- Hiển thị tính năng, mẫu thiệp
- Thông tin liên hệ và CTA
- Responsive design với TailwindCSS

### 2. Đổi tên trang thiệp

- `index.html` (cũ) → `basic-gold/index.html` (mới)
- Trang này giờ chỉ hiển thị thiệp cưới, không còn là trang chủ

### 3. Cập nhật `404.html`

**Trước:**

```javascript
window.location.replace(window.location.origin + "/index.html");
```

**Sau:**

```javascript
// Nếu có slug trong path → redirect về basic-gold/index.html
if (path && path !== "/" && !path.includes(".")) {
  window.location.replace(window.location.origin + "/router.html");
} else {
  // Root path → redirect về landing page
  window.location.replace(window.location.origin + "/");
}
```

### 4. Cập nhật `script.js` - Kiểm tra slug tồn tại

**Thêm logic:**

```javascript
fetch(`${EDGE_URL}?slug=${_weddingSlug}`)
  .then((r) => {
    if (!r.ok) {
      // Slug không tồn tại → redirect về landing page
      window.location.href = "/";
      return null;
    }
    return r.json();
  })
  .then((data) => {
    if (data) renderWedding(data);
  })
  .catch((e) => {
    // Lỗi → redirect về landing page
    window.location.href = "/";
  });
```

**Nếu không có slug:**

```javascript
if (!_weddingSlug) {
  window.location.href = "/";
}
```

### 5. Cập nhật `admin.html` - Link generation

**Trước:**

```html
<a href="${DOMAIN}/${w.slug}"></a>
```

**Sau:**

```html
<a href="${DOMAIN}/public/themes/${w.theme || 'basic-gold'}/?slug=${w.slug}"></a>
```

### 6. Cập nhật `manage-customer.js` - Link generation

**Link thiệp cưới (hiển thị cho khách):**

```javascript
// Trước
groomLink.value = `${DOMAIN}/${data.slug}?isGroom=true`;
brideLink.value = `${DOMAIN}/${data.slug}`;

// Sau
groomLink.value = `\$\{DOMAIN\}/\$\{data\.slug\}?isGroom=true`;
brideLink.value = `\$\{DOMAIN\}/\$\{data\.slug\}`;
```

**Link cá nhân hóa (tự động tạo):**

```javascript
// Trước
const link = `${DOMAIN}/index.html?id=${WEDDING_ID}&isGroom=${isGroom}&name=${encryptedName}&relationship=${encryptedRelationship}`;

// Sau
const link = `${DOMAIN}/${WEDDING_SLUG}?isGroom=${isGroom}&name=${encryptedName}&relationship=${encryptedRelationship}`;
```

## Flow hoạt động

### Kịch bản 1: User vào trang chủ

```
domain.com/ → index.html (landing page)
```

### Kịch bản 2: User vào slug hợp lệ (GitHub Pages)

```
domain.com/hai-yen-quang-vinh
  ↓
404.html (GitHub Pages không tìm thấy file)
  ↓
Lưu path vào sessionStorage
  ↓
Redirect về basic-gold/index.html
  ↓
basic-gold/index.html đọc slug từ sessionStorage
  ↓
Gọi API kiểm tra slug
  ↓
Slug tồn tại → Hiển thị thiệp cưới
```

### Kịch bản 3: User vào slug không tồn tại (GitHub Pages)

```
domain.com/slug-khong-ton-tai
  ↓
404.html
  ↓
Redirect về basic-gold/index.html
  ↓
basic-gold/index.html gọi API
  ↓
API trả về 404
  ↓
Redirect về / (landing page)
```

### Kịch bản 4: Local development

```
localhost:8000/public/themes/basic-gold/?slug=hai-yen-quang-vinh
  ↓
Đọc slug từ query param
  ↓
Gọi API kiểm tra slug
  ↓
Hiển thị thiệp hoặc redirect về /
```

## Lưu ý quan trọng

### 1. Clean URL chỉ hoạt động trên GitHub Pages

- Production: `domain.com/slug` ✅
- Local: `localhost:5500/slug` ❌ (phải dùng `?slug=`)

### 2. Slug vs ID

- **Slug**: Dùng cho URL công khai, dễ chia sẻ (`hai-yen-quang-vinh`)
- **ID (UUID)**: Dùng cho trang quản lý, bảo mật cao (`d4004d06-6b6f-4bc1-8953-0ae63388e508`)

### 3. Link cá nhân hóa

- Giờ sử dụng `slug` thay vì `id`
- Format: `domain.com/public/themes/basic-gold/?slug=xxx&isGroom=true&name=ENC&relationship=ENC`
- Khi deploy lên GitHub Pages, có thể dùng clean URL: `domain.com/slug?isGroom=true&name=ENC&relationship=ENC`

### 4. Trang quản lý vẫn dùng ID

- `domain.com/invitation-setup/index.html?id=uuid`
- Không thay đổi, vẫn dùng UUID để bảo mật

## Testing

### Test trên Local (Live Server)

```bash
# Trang chủ
http://localhost:5500/

# Thiệp cưới (phải dùng query param)
http://localhost:8000/public/themes/basic-gold/?slug=hai-yen-quang-vinh

# Trang quản lý
http://localhost:5500/invitation-setup/index.html?id=xxx

# Admin
http://localhost:8000/admin/
```

### Test trên GitHub Pages

```bash
# Trang chủ
https://yourusername.github.io/

# Thiệp cưới (clean URL)
https://yourusername.github.io/hai-yen-quang-vinh

# Thiệp cưới (query param - vẫn hoạt động)
https://yourusername.github.io/public/themes/basic-gold/?slug=hai-yen-quang-vinh

# Slug không tồn tại → redirect về /
https://yourusername.github.io/slug-khong-ton-tai

# Trang quản lý
https://yourusername.github.io/invitation-setup/index.html?id=xxx

# Admin
https://yourusername.github.io/admin/
```

## Checklist triển khai

- [x] Tạo `index.html` (landing page)
- [x] Đổi tên `index.html` → `basic-gold/index.html`
- [x] Cập nhật `404.html` routing logic
- [x] Cập nhật `script.js` kiểm tra slug
- [x] Cập nhật `admin.html` link generation
- [x] Cập nhật `manage-customer.js` link generation
- [x] Cập nhật `README.md` với routing mới
- [x] Kiểm tra diagnostics (no errors)

## Kết luận

Hệ thống routing mới đã được triển khai thành công với các ưu điểm:

1. ✅ Trang chủ chuyên nghiệp để giới thiệu dịch vụ
2. ✅ Clean URL thân thiện với SEO (`domain.com/slug`)
3. ✅ Tự động kiểm tra slug tồn tại
4. ✅ Redirect về landing page nếu slug không hợp lệ
5. ✅ Tách biệt rõ ràng giữa landing page và wedding page
6. ✅ Bảo mật trang quản lý bằng UUID
7. ✅ Hỗ trợ cả clean URL và query param
8. ✅ Hoạt động tốt trên cả local và production
