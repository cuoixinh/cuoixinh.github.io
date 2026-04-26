# Thiệp Cưới Online

Nền tảng tạo thiệp cưới trực tuyến hiện đại, miễn phí và dễ sử dụng.

## Cấu trúc URL

### 1. Trang chủ (Landing Page)

```
domain.com/
```

- Trang giới thiệu dịch vụ
- Hiển thị mẫu thiệp và tính năng
- Thông tin liên hệ

### 2. Trang thiệp cưới

```
domain.com/slug
domain.com/slug?isGroom=true
domain.com/template1.html?slug=slug&isGroom=true
```

- Hiển thị thiệp cưới cho khách mời
- Nếu slug không tồn tại → redirect về trang chủ
- Hỗ trợ cả clean URL (`/slug`) và query param (`?slug=`)

### 3. Trang quản lý (cho khách hàng)

```
domain.com/manage-by-customer.html?id=uuid
```

- Trang quản lý thông tin thiệp cưới
- Sử dụng UUID để bảo mật (không dùng slug)
- Chỉ người có link mới truy cập được

### 4. Trang admin

```
domain.com/admin.html
```

- Quản lý tất cả thiệp cưới
- Tạo mới, sửa, xóa thiệp
- Yêu cầu mã admin token

## Routing Logic

### GitHub Pages (Production)

1. User truy cập `domain.com/slug`
2. GitHub Pages không tìm thấy file → trả về `404.html`
3. `404.html` lưu path vào sessionStorage và redirect về `template1.html`
4. `template1.html` đọc slug từ sessionStorage
5. Gọi API kiểm tra slug có tồn tại không
6. Nếu tồn tại → hiển thị thiệp
7. Nếu không tồn tại → redirect về `/` (landing page)

### Local Development (Live Server)

- Sử dụng query param: `http://localhost:5500/template1.html?slug=slug`
- Clean URL không hoạt động trên local

## Tính năng chính

- ✅ Responsive design (mobile-first)
- ✅ Quản lý khách mời qua Google Sheets
- ✅ Link cá nhân hóa với mã hóa AES
- ✅ Xác nhận tham dự trực tuyến
- ✅ QR code mừng cưới
- ✅ Bản đồ Google Maps
- ✅ Gallery ảnh với carousel
- ✅ Tự động tính ngày âm lịch
- ✅ Hỗ trợ 2 bên (nhà trai & nhà gái)

## Tech Stack

- Frontend: HTML, TailwindCSS, Vanilla JavaScript
- Backend: Supabase (Database + Storage + Edge Functions)
- Hosting: GitHub Pages (100% miễn phí)
- Integration: Google Sheets API

## Cài đặt

1. Clone repository
2. Cấu hình Supabase credentials trong các file JS
3. Deploy lên GitHub Pages
4. Cấu hình Google Apps Script (xem `documents/GOOGLE_APPS_SCRIPT_SETUP.md`)

## Tài liệu

- [Kiến trúc hệ thống](documents/ARCHITECTURE.md)
- [Hướng dẫn Google Apps Script](documents/GOOGLE_APPS_SCRIPT_SETUP.md)
- [Tự động tạo link khách mời](documents/TAI_LIEU_TU_DONG_TAO_LINK.md)

## License

MIT License
