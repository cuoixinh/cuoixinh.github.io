# Luồng Hệ Thống - Web Thiệp Cưới Online

## Tổng Quan

```
Landing Page (index.html)
    ↓ Chọn mẫu → Thanh toán
Payment Modal (payment.js)
    ↓ Tạo đơn hàng → POST Edge Function
manage-by-customer.html?id={uuid}
    ↓ Khách nhập thông tin → PATCH Edge Function
index.html?id={uuid}&isGroom=true/false
    ↓ Khách mời xem thiệp
```

---

## 1. Luồng Landing Page → Thanh Toán

```
index.html (landing)
  ├─ Hiển thị danh sách template (Classic, Modern) qua renderTemplateCards()
  ├─ Iframe preview tự động scroll (lazy load, pause khi user scroll)
  ├─ Nút "Xem Demo" → openPreview() → mở modal iframe
  └─ Nút "Chọn mẫu này" → openPayment() → PaymentModal.open(name, theme)

PaymentModal (payment.js)
  ├─ Khi mở: lưu order "pending" vào localStorage ngay lập tức
  ├─ Step 1: Form xác nhận đơn hàng
  │   ├─ Tên (bắt buộc), SĐT (bắt buộc), Email (tùy chọn)
  │   └─ Nếu đã đăng nhập → auto-fill tên, SĐT, email từ Supabase session
  ├─ Nút "Thanh toán ngay" → PaymentModal.process()
  │   ├─ Validate: tên + SĐT bắt buộc
  │   ├─ Tạo UUID (manage_id) ở client
  │   ├─ Tạo slug: toSlug(name) + "-" + phone (bỏ dấu tiếng Việt)
  │   ├─ POST /wedding-admin → {id: manage_id, slug, contact: phone, theme}
  │   │   └─ Backend tự xử lý slug trùng (append -2, -3...)
  │   └─ Đọc slug thật từ response
  ├─ Step 2: Processing spinner (fake delay 1.5s)
  └─ Step 3: Thành công
      ├─ Update order pending → completed trong localStorage
      │   (key: orders_{email} nếu đăng nhập, hoặc orders_{email_nhập} hoặc guestOrders)
      └─ Hiển thị link: /manage-by-customer.html?id={manage_id}
```

---

## 2. Luồng Đăng Nhập / Tài Khoản

```
account.html
  ├─ Chưa đăng nhập → Hiển thị nút Facebook / Google
  │   └─ supabaseClient.auth.signInWithOAuth()
  │       └─ Redirect OAuth → callback → onAuthStateChange()
  ├─ Đã đăng nhập → Hiển thị thông tin user
  │   ├─ Tab "Đơn hàng": Danh sách orders từ localStorage
  │   │   └─ Click đơn → Modal chi tiết (trạng thái, link quản lý)
  │   └─ Tab "Hồ sơ": Sửa tên, email, SĐT
  └─ Khi đăng nhập: mergeGuestOrders() → gộp guestOrders vào orders_{email}
```

---

## 3. Luồng Admin Tạo Thiệp Thủ Công

```
admin.html
  ├─ Popup nhập ADMIN_SECRET_TOKEN → lưu sessionStorage
  ├─ GET /wedding-admin?list=true&token=xxx → Danh sách thiệp
  ├─ Tìm kiếm theo slug / tên cô dâu / chú rể
  ├─ Tạo mới: POST /wedding-admin?token=xxx → {slug, contact}
  │   └─ Nhận id → Hiển thị link manage-by-customer.html?id=xxx
  ├─ Sửa slug: PATCH {id, slug, token}
  ├─ Toggle is_active: PATCH {id, is_active, token}
  └─ Xóa: DELETE /wedding-admin?id=xxx&token=xxx
      └─ Xóa DB record + tất cả ảnh trong Storage
```

---

## 4. Luồng Khách Hàng Nhập Thông Tin

```
manage-by-customer.html?id={uuid}
  ├─ Skeleton loader hiển thị trong khi fetch
  ├─ GET /wedding-admin?id={uuid} → Load data vào form
  │
  ├─ Form sections:
  │   ├─ Link thiệp (nhà trai / nhà gái) với nút Copy
  │   ├─ Thông tin chung: tên cô dâu, chú rể, quote, ảnh bìa, gallery (max 7)
  │   ├─ Lễ thành hôn: ngày, giờ → tự tính âm lịch
  │   ├─ Nhà trai: bố mẹ, địa chỉ, ảnh, Google Sheet URL, tiệc, bank, QR
  │   └─ Nhà gái: (tương tự nhà trai)
  │
  ├─ Upload ảnh:
  │   ├─ Chọn file → resize (max 1MB, 1920x1920) → lưu pendingUploads
  │   └─ Khi Save: uploadAllPendingImages() → Supabase Storage
  │
  ├─ Auto-fill:
  │   ├─ Ngày tiệc = ngày lễ - 1 ngày
  │   ├─ Giờ tiệc = 17:00
  │   └─ Địa chỉ tiệc = địa chỉ nhà
  │
  └─ Nút Lưu → saveAll()
      ├─ Upload ảnh pending → nhận filenames
      ├─ PATCH /wedding-admin {id, ...fields, deleted_images[]}
      └─ Toast thông báo thành công
```

---

## 5. Luồng Khách Mời Xem Thiệp

```
domain.com/{slug}  (hoặc /themes/template1.html?slug={slug})
  │
  ├─ Clean URL → 404.html → router.html?slug={slug}
  │   └─ GET /wedding-admin?slug={slug} → đọc field `theme`
  │       └─ redirect /themes/{theme}.html?slug={slug}
  │
  ├─ themes/template1.html (hoặc template2.html) load
  │   ├─ Đọc slug từ URL params
  │   ├─ Có tham số name & relationship?
  │   │   ├─ Có → Giải mã AES (key: "dqvinh") → Hiển thị lời chào cá nhân
  │   │   └─ Không → Dùng tên mặc định
  │   └─ Cover thiệp hiện ra → Khách nhấn "Mở Thiệp"
  │
  ├─ GET /wedding-admin?slug={slug} (hoặc ?id={uuid})
  │   ├─ is_active = false → Hiển thị trang "Thiệp hết hạn"
  │   └─ is_active = true → Render toàn bộ nội dung
  │
  ├─ Render theo isGroom=true/false:
  │   ├─ Thông tin gia đình (bố mẹ, địa chỉ)
  │   ├─ Ngày giờ tiệc cưới + âm lịch
  │   ├─ Gallery ảnh (carousel 3D, lightbox, pinch zoom)
  │   ├─ QR chuyển khoản mừng cưới
  │   └─ Bản đồ Google Maps
  │
  └─ Có groom/bride_google_sheet_url + link cá nhân hóa?
      ├─ Có → POST markViewed {action, link: window.location.href} (no-cors)
      └─ Không → Bỏ qua tracking
```

---

## 6. Luồng Tạo Link Cá Nhân Hóa (Auto-Generate)

```
manage-by-customer.html → Nút "Tự động tạo link nhà trai/gái"
  │
  ├─ GET /wedding-admin?id={uuid} → Lấy groom/bride_google_sheet_url
  ├─ Validate URL (phải chứa script.google.com)
  ├─ GET all guests từ Google Apps Script
  │
  ├─ Với mỗi khách (có relationship, chưa có link):
  │   ├─ Mã hóa AES: tên hiển thị + quan hệ (key: "dqvinh")
  │   └─ Tạo link: {domain}/index.html?id={uuid}&isGroom=true/false&name=ENC&relationship=ENC
  │
  └─ Batch update links → Google Sheet cột D
      └─ Toast: "Đã tạo link cho N khách mời"
```

---

## 7. Edge Function - Routing Logic

```
POST   /wedding-admin                → Tạo bản ghi mới (cần ADMIN_SECRET_TOKEN)
GET    /wedding-admin?id={uuid}      → Lấy thông tin thiệp (public)
GET    /wedding-admin?list=true&token → Danh sách tất cả (admin only)
PATCH  /wedding-admin                → Cập nhật thiệp + xóa ảnh cũ
DELETE /wedding-admin?id=xxx&token   → Xóa thiệp + ảnh (admin only)
```

---

## 8. Routing URL (GitHub Pages)

```
domain.com/                          → Landing page (index.html)
domain.com/{slug}                    → Thiệp cưới (clean URL)
  └─ GitHub Pages 404 → 404.html
      └─ Lưu path vào sessionStorage → redirect về router.html?slug={slug}
          └─ router.html gọi GET /wedding-admin?slug={slug}
              ├─ Không tìm thấy → redirect về /
              └─ Tìm thấy → đọc field `theme` (vd: "template1", "template2")
                  └─ redirect về /themes/{theme}.html?slug={slug}

domain.com/themes/template1.html?slug={slug}  → Thiệp mẫu Classic
domain.com/themes/template2.html?slug={slug}  → Thiệp mẫu Modern
domain.com/manage-by-customer.html?id={uuid}  → Trang quản lý khách hàng
domain.com/admin.html                          → Trang admin
domain.com/account.html                        → Tài khoản / đơn hàng
```

---

## 9. Bảo Mật

| Thao tác               | Ai được phép     | Cơ chế                                |
| ---------------------- | ---------------- | ------------------------------------- |
| Tạo thiệp (POST)       | Admin            | ADMIN_SECRET_TOKEN (Supabase Secrets) |
| Cập nhật thiệp (PATCH) | Khách hàng có id | UUID v4 (122-bit entropy)             |
| Đọc thiệp (GET)        | Public           | Không cần auth                        |
| Xóa / toggle active    | Admin            | ADMIN_SECRET_TOKEN                    |
| Xóa ảnh Storage        | Edge Function    | Validate filename thuộc đúng wedding  |

---

## 10. Tech Stack

| Thành phần     | Công nghệ                      | Chi phí |
| -------------- | ------------------------------ | ------- |
| Frontend       | HTML + Tailwind + Vanilla JS   | $0      |
| Hosting        | GitHub Pages                   | $0      |
| Database       | Supabase PostgreSQL            | $0      |
| Storage        | Supabase Storage               | $0      |
| Backend        | Supabase Edge Functions (Deno) | $0      |
| Auth           | Supabase Auth (OAuth)          | $0      |
| Guest Tracking | Google Apps Script             | $0      |
| Encryption     | CryptoJS (AES)                 | $0      |
