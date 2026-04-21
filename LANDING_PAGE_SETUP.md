# Hướng dẫn Setup Landing Page

## Tổng quan

Landing page mới đã được triển khai với các tính năng:

- ✅ Hero section với gradient đẹp mắt
- ✅ Template gallery với 3 mẫu thiệp (1 active, 2 coming soon)
- ✅ Modal preview với iframe để xem demo thiệp cưới
- ✅ Features grid với 8 tính năng nổi bật
- ✅ "How It Works" section với 3 bước đơn giản
- ✅ Contact/CTA section
- ✅ Smooth scrolling và scroll animations
- ✅ Responsive design hoàn hảo

## Files đã tạo/cập nhật

1. **index.html** - Landing page chính (đã cập nhật)
2. **landing-styles.css** - CSS tùy chỉnh cho landing page
3. **landing-script.js** - JavaScript cho modal, animations, smooth scroll

## Cách test Landing Page

### 1. Mở Landing Page

Mở file `index.html` trong browser hoặc dùng Live Server:

```bash
# Nếu dùng Live Server extension trong VS Code
# Click chuột phải vào index.html > Open with Live Server
```

### 2. Test các tính năng

- **Hero CTA**: Click "Xem Mẫu Thiệp" → Scroll smooth xuống Template Gallery
- **Template Cards**: Hover vào card → Thấy overlay với button "Xem Demo"
- **Modal Preview**: Click "Xem Demo" trên Classic Elegance → Modal mở với iframe
- **Scroll Animations**: Scroll xuống → Các cards animate vào màn hình
- **Contact**: Click "Chọn mẫu này" → Scroll smooth đến Contact section

### 3. Tạo Demo Data (Quan trọng!)

Để modal preview hoạt động, bạn cần tạo một wedding với slug "demo" trong database:

#### Option 1: Dùng Admin Panel

1. Mở `admin.html`
2. Tab "Tạo mới"
3. Nhập slug: `demo`
4. Điền thông tin cơ bản (tên chú rể, cô dâu, ảnh)
5. Click "Tạo thiệp cưới"

#### Option 2: Dùng SQL trực tiếp

```sql
INSERT INTO weddings (
  slug,
  is_active,
  groom_name,
  bride_name,
  cover_image_url,
  gallery_images,
  ceremony_date,
  ceremony_time
) VALUES (
  'demo',
  true,
  'Văn Hùng',
  'Thùy Hằng',
  'assets/images/ZIN_3506.jpg',
  ARRAY[
    'assets/images/ZIN_3506.jpg',
    'assets/images/ZIN_3519.jpg',
    'assets/images/ZIN_3525.jpg',
    'assets/images/ZIN_3630.jpg'
  ],
  '2024-12-25',
  '11:30'
);
```

### 4. Test Modal Preview

Sau khi tạo demo data:

1. Mở `index.html`
2. Click "Xem Demo" trên Classic Elegance card
3. Modal sẽ mở và load `/wedding.html?slug=demo` trong iframe
4. Bạn sẽ thấy thiệp cưới demo đầy đủ
5. Click "Chọn mẫu này" → Scroll đến Contact section
6. Click "Đóng" hoặc ESC hoặc click backdrop → Modal đóng

## Tính năng đã triển khai

### 1. Modal Preview System

- Load wedding template trong iframe
- Timeout 10 giây nếu không load được
- Error handling với UI thân thiện
- Close bằng: backdrop click, close button, ESC key
- Disable body scroll khi modal mở

### 2. Smooth Scrolling

- Hero CTA → Template Gallery
- "Chọn mẫu này" → Contact Section
- Tất cả anchor links (#)
- Highlight pulse effect khi scroll đến contact

### 3. Scroll Animations

- Sử dụng IntersectionObserver API
- Animate khi element vào viewport (10% visible)
- Auto unobserve sau khi animate (performance)
- Fallback cho browser không support

### 4. Template Data Model

```javascript
const templates = [
  {
    id: "classic",
    name: "Classic Elegance",
    status: "active",
    previewUrl: "/wedding.html?slug=demo",
    features: ["gallery", "map", "qrcode", "rsvp"],
  },
  // ... more templates
];
```

### 5. SessionStorage Persistence

- Lưu template đã chọn vào sessionStorage
- Key: `selectedTemplate`
- Có thể dùng để pre-fill form hoặc highlight template

## Responsive Breakpoints

- **Mobile**: < 640px (1 column)
- **Tablet**: 640px - 1024px (2 columns)
- **Desktop**: > 1024px (3-4 columns)

## Browser Support

- Chrome 58+
- Firefox 55+
- Safari 11+
- Edge 79+

Fallbacks:

- IntersectionObserver → Show all elements immediately
- Smooth scroll → Instant scroll
- SessionStorage → Continue without persistence

## Customization

### Thêm template mới

Edit `landing-script.js`:

```javascript
const templates = [
  // ... existing templates
  {
    id: "new-template",
    name: "New Template Name",
    description: "Mô tả template",
    thumbnail: "assets/images/new-template.jpg",
    previewUrl: "/wedding.html?slug=new-demo",
    features: ["gallery", "map", "qrcode"],
    status: "active", // hoặc 'coming-soon'
    category: "modern",
  },
];
```

### Thay đổi màu sắc

Edit `landing-styles.css` hoặc Tailwind config trong `index.html`:

```javascript
colors: {
  cream: {
    50: "#fffbf7",
    100: "#fff5f0",
    200: "#ffe8e0",
  },
  "rose-pastel": {
    100: "#f5d5d8",
    200: "#e8b4b8",
    300: "#d4a5a5",
  },
}
```

### Thay đổi thông tin liên hệ

Edit `index.html` trong Contact section:

```html
<a href="mailto:your-email@example.com" class="cta-button primary">
  <i class="fas fa-envelope mr-2"></i>
  Liên hệ qua Email
</a>
<a href="tel:+84987654321" class="cta-button secondary">
  <i class="fas fa-phone mr-2"></i>
  Gọi điện thoại
</a>
```

## Performance Tips

1. **Lazy Loading**: Images đã có `loading="lazy"`
2. **Iframe**: Chỉ load khi modal mở
3. **Animations**: Sử dụng GPU acceleration (transform, opacity)
4. **Observer**: Auto unobserve sau khi animate

## Troubleshooting

### Modal không mở

- Check console log: "Template not available for preview"
- Đảm bảo template status là 'active'
- Đảm bảo previewUrl không null

### Iframe không load

- Check slug "demo" có tồn tại trong database
- Check URL: `/wedding.html?slug=demo`
- Check console log: Timeout sau 10 giây
- Xem error message trong modal

### Animations không hoạt động

- Check browser support IntersectionObserver
- Mở console xem warning
- Fallback sẽ show tất cả elements ngay lập tức

### Smooth scroll không mượt

- Check browser support smooth scroll
- Fallback sẽ dùng instant scroll
- Vẫn functional, chỉ không smooth

## Next Steps

1. ✅ Tạo demo data với slug "demo"
2. ✅ Test tất cả tính năng
3. ⏳ Thêm placeholder images cho coming soon templates
4. ⏳ Optimize images (compress)
5. ⏳ Test trên mobile devices
6. ⏳ Deploy lên GitHub Pages

## Notes

- Landing page hoàn toàn độc lập với wedding.html
- Routing system không thay đổi
- Backward compatible với existing links
- Không cần build process (vanilla JS + TailwindCSS CDN)
