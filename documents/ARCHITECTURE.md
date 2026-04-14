# Kiến Trúc Project - Web Thiệp Cưới Online

## Tổng Quan Hệ Thống

```
┌─────────────────────────────────────────────────────────────┐
│                      GITHUB PAGES (Free)                     │
│                                                              │
│   admin.html          manage-by-customer.html   index.html  │
│   (Tạo thiệp)         (Khách nhập thông tin)    (Xem thiệp) │
└──────────┬───────────────────┬──────────────────────┬───────┘
           │                   │                      │
           │ POST+token        │ GET/PATCH+id          │ GET+id
           ▼                   ▼                      ▼
┌─────────────────────────────────────────────────────────────┐
│              SUPABASE EDGE FUNCTION (Free)                   │
│                   wedding-admin                              │
│                                                              │
│  POST  → Kiểm tra ADMIN_SECRET_TOKEN → INSERT               │
│  PATCH → Kiểm tra id tồn tại → UPDATE                       │
│  GET   → Public → SELECT                                     │
└──────────────────────────┬──────────────────────────────────┘
                           │ service_role_key
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              SUPABASE POSTGRESQL (Free 500MB)                │
│                    Bảng: weddings                            │
│                                                              │
│  id, slug, is_active, contact                               │
│  groom_name, bride_name, story_quote, cover_image_url        │
│  gallery_images[]                                            │
│  ceremony_* (lễ thành hôn CHUNG: date, time, lunar)         │
│  groom_* (father, mother, address, image, google_sheet,     │
│           party, map, bank, qr)                              │
│  bride_* (father, mother, address, image, google_sheet,     │
│           party, map, bank, qr)                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Sơ Đồ Luồng

### Luồng 1: Admin Tạo Thiệp Mới

```mermaid
flowchart TD
    A[Bạn mở admin.html] --> B[Popup nhập ADMIN_SECRET_TOKEN]
    B --> C{Token đúng?}
    C -->|Sai| D[Từ chối]
    C -->|Đúng| E[Nhập email/SĐT khách hàng]
    E --> F[Nhấn Thêm mới]
    F --> G[POST /wedding-admin?token=xxx]
    G --> H[Edge Function kiểm tra token]
    H --> I[INSERT vào DB với contact + is_active=true + slug=uuid]
    I --> J[Trả về id]
    J --> K[Hiển thị link manage-by-customer.html?id=xxx]
    K --> L[Copy link gửi cho khách hàng]
```

### Luồng 2: Khách Hàng Nhập Thông Tin

```mermaid
flowchart TD
    A[Khách nhận link manage-by-customer.html?id=xxx] --> B[Mở trang]
    B --> C[GET /wedding-admin?id=xxx]
    C --> D[Load data hiện tại vào form]
    D --> E[Khách nhập thông tin: tên, ngày, ảnh URL, QR, bản đồ...]
    E --> F[Nhấn Lưu]
    F --> G[PATCH /wedding-admin với id + fields]
    G --> H[Edge Function kiểm tra id tồn tại]
    H --> I{id hợp lệ?}
    I -->|Không| J[404 Not Found]
    I -->|Có| K[UPDATE DB - không cho đổi is_active và contact]
    K --> L[Hiển thị 2 link thiệp]
    L --> M[Link nhà trai: index.html?id=xxx&isGroom=true]
    L --> N[Link nhà gái: index.html?id=xxx&isGroom=false]
```

### Luồng 3: Khách Mời Xem Thiệp

```mermaid
flowchart TD
    A[Khách mời nhận link index.html?id=xxx&isGroom=true&name=ENCRYPTED&relationship=ENCRYPTED] --> B[Mở trang]
    B --> C{Có tham số name & relationship?}
    C -->|Có| D[Giải mã bằng AES key dqvinh]
    C -->|Không| E[Dùng tên mặc định]
    D --> F[Hiển thị: Kính mời quan hệ tên...]
    E --> F
    F --> G[Cover thiệp hiện ra]
    G --> H[Khách nhấn Mở Thiệp]
    H --> I[GET /wedding-admin?id=xxx]
    I --> J{is_active?}
    J -->|false| K[Hiện trang Thiệp hết hạn]
    J -->|true| L[Render toàn bộ nội dung thiệp]
    L --> M[Hiển thị thông tin theo isGroom=true/false]
    M --> N{Có google_sheet_url?}
    N -->|Có| O[POST markViewed đến Google Apps Script]
    N -->|Không| P[Bỏ qua tracking]
```

### Luồng 4: Admin Tạo Link Cá Nhân Hóa (Tính năng mới)

```mermaid
flowchart TD
    A[Admin mở manage-by-customer.html?id=xxx] --> B[Nhấn nút Tự động tạo link nhà trai/gái]
    B --> C[Lấy groom/bride_google_sheet_url]
    C --> D{URL hợp lệ?}
    D -->|Không| E[Hiển thị lỗi: Vui lòng cấu hình URL]
    D -->|Có| F[GET all guests từ Google Apps Script]
    F --> G[Với mỗi khách: Lấy tên hiển thị + quan hệ]
    G --> H[Mã hóa AES với key dqvinh]
    H --> I[Tạo link: domain/index.html?id=xxx&isGroom=true/false&name=ENC&relationship=ENC]
    I --> J[Batch update vào Google Sheet cột D]
    J --> K[Hiển thị: Đã tạo link cho N khách mời]
```

---

## Cấu Trúc Thư Mục

```
WebCuoi/
├── index.html                          # Thiệp cưới (trang khách xem)
├── script.js                           # Logic JS: carousel, lightbox, calendar, RSVP...
├── style.css                           # Custom CSS (font, animation, shimmer...)
├── supabase.js                         # Fetch data từ Supabase & render vào thiệp
├── admin.html                          # Trang tạo thiệp mới (chỉ bạn dùng)
├── manage-by-customer.html             # Trang khách hàng nhập thông tin thiệp
├── manage-customer.js                  # Logic form quản lý: upload ảnh, bank select, auto-fill, lunar date
├── database-schema.sql                 # Schema database Supabase
├── README.md                           # Hướng dẫn sử dụng
├── documents/
│   ├── ARCHITECTURE.md                 # File này - kiến trúc hệ thống
│   ├── GOOGLE_APPS_SCRIPT_SETUP.md     # Hướng dẫn setup Google Apps Script
│   └── TAI_LIEU_TU_DONG_TAO_LINK.md    # Tài liệu tính năng tạo link cá nhân hóa
├── .kiro/
│   └── specs/
│       └── auto-generate-guest-links/
│           └── requirements.md         # Requirements tính năng tạo link
├── assets/
│   ├── fonts/
│   │   ├── TheNautigal-Regular.ttf     # Font chữ viết tay tên cặp đôi
│   │   ├── katty-diona.woff2           # Font "Wedding Invitation" trên cover
│   │   └── Fz_Qellia_Fix.ttf           # Font bổ sung
│   ├── icons/
│   │   └── bin.png                     # Icon xóa ảnh
│   ├── images/                         # Ảnh mẫu, QR, icon...
│   └── musics/                         # Nhạc nền
└── supabase/
    └── functions/
        └── wedding-admin/
            └── index.ts                # Edge Function: tạo/đọc/cập nhật thiệp + xóa ảnh Storage
```

---

## Chi Tiết Các File

### `index.html`

Thiệp cưới chính. Gồm 6 block:

1. **Cover** — Ảnh nền + tên khách + nút mở thiệp
2. **Save The Date** — Ảnh cặp đôi + quote
3. **Thông tin gia đình** — Nhà trai + nhà gái (ảnh + tên bố mẹ + địa chỉ)
4. **Thư mời + Tiệc cưới** — Ngày giờ + lịch mini + xác nhận tham dự + gallery
5. **Hộp mừng cưới** — QR chuyển khoản
6. **Bản đồ** — Google Maps thumbnail + điều hướng

### `script.js`

- Carousel ảnh (3D effect, swipe, lightbox, pinch zoom)
- Mini calendar (tự tính âm lịch fallback)
- RSVP buttons (animation idle pulse + pop)
- Scroll reveal animations
- iOS viewport height fix
- Save QR (Web Share API)

### `supabase.js`

- Fetch data từ Edge Function theo `id` trên URL
- Render data vào các element có `id` tương ứng
- Load tên khách từ Google Apps Script
- Hiện trang expired nếu `is_active = false`

### `admin.html`

- Nhập mã quản trị qua popup (lưu sessionStorage)
- POST tạo bản ghi mới → nhận id → hiển thị link manage

### `manage-customer.js`

**Chức năng chính**:
- Quản lý form nhập liệu với validation
- Upload ảnh lên Supabase Storage (resize trước khi upload)
- Xóa ảnh khỏi Storage khi user xóa/thay thế
- Bank searchable select với 43 ngân hàng VN
- Auto-fill thông tin (ngày tiệc, giờ, địa chỉ)
- Tự động tính ngày âm lịch từ dương lịch
- Flatpickr date picker với locale tiếng Việt
- Skeleton loading khi trang load
- Pending uploads tracking (chỉ upload khi save)
- Gallery management (max 7 ảnh)

**Kiến trúc**:
```javascript
// Configuration
MANAGE_EDGE_URL, MANAGE_SUPABASE_URL, STORAGE_BASE_URL

// Image Management
pendingUploads = { singleImages: {}, galleryImages: [] }
deletedImages = { singleImages: [], galleryImages: [] }

// Functions
- uploadSingleImage() → filename
- uploadAllPendingImages() → {uploadedFilenames, errors}
- renderSingleImageUpload(), renderGalleryGrid()
- removeImage(), removeGalleryImage()

// Save Flow
saveAll() → upload images → update DB → update UI → clear pending
```

### `manage-by-customer.html`

**Giao diện form quản lý**:
- Skeleton loader khi trang load
- Form đầy đủ tất cả trường trong DB
- Flatpickr date picker với locale tiếng Việt
- Bank searchable select dropdown
- Image upload với preview (cover, groom, bride, QR, gallery)
- Auto-fill hints và lunar date display
- 2 link thiệp (nhà trai/gái) với nút copy
- Toast notifications và loading overlay
- Responsive design với Tailwind CSS

**Sections**:
1. Header với nút Lưu
2. Link thiệp (nhà trai/gái)
3. Thông tin chung (tên, quote, cover, gallery)
4. Lễ thành hôn (ngày, giờ, âm lịch)
5. Nhà trai (bố mẹ, địa chỉ, ảnh, Google Sheet, map, tiệc, bank, QR)
6. Nhà gái (bố mẹ, địa chỉ, ảnh, Google Sheet, map, tiệc, bank, QR)

### `supabase/functions/wedding-admin/index.ts`

**Edge Function endpoints**:
- POST: cần ADMIN_SECRET_TOKEN, tạo bản ghi mới
- PATCH: chỉ cần id, cập nhật thông tin + xóa ảnh cũ khỏi Storage
- GET: public, lấy thông tin theo id

**Xử lý Storage**:
- Nhận `deleted_images` array từ client
- Validate filename thuộc wedding hiện tại
- Xóa file khỏi Storage bucket `wedding-images`
- Trả về kết quả thành công/thất bại

---

## Bảo Mật

| Thao tác               | Ai được phép     | Cơ chế                                    |
| ---------------------- | ---------------- | ----------------------------------------- |
| Tạo thiệp (POST)       | Chỉ admin        | ADMIN_SECRET_TOKEN trong Supabase Secrets |
| Cập nhật thiệp (PATCH) | Khách hàng có id | UUID v4 (122 bit entropy, khó đoán)       |
| Đọc thiệp (GET)        | Public           | Không cần auth                            |
| Tắt thiệp              | Chỉ admin        | Supabase Dashboard → is_active = false    |
| Xóa thiệp              | Chỉ admin        | Supabase Dashboard                        |

---

## Supabase Config

| Thông tin          | Giá trị                                    |
| ------------------ | ------------------------------------------ |
| Project URL        | `https://lcobawmkywtxhpezndsh.supabase.co` |
| Edge Function      | `/functions/v1/wedding-admin`              |
| Anon Key           | JWT token (dùng cho Authorization header)  |
| ADMIN_SECRET_TOKEN | Lưu trong Supabase Secrets                 |

---

## Công Nghệ & Chi Phí

| Thành phần       | Công nghệ                    | Giới hạn free  | Chi phí |
| ---------------- | ---------------------------- | -------------- | ------- |
| Frontend         | HTML + Tailwind + Vanilla JS | Không giới hạn | $0      |
| Hosting          | GitHub Pages                 | Không giới hạn | $0      |
| Database         | Supabase PostgreSQL          | 500MB          | $0      |
| Storage          | Supabase Storage             | 1GB            | $0      |
| Backend          | Supabase Edge Functions      | 500k req/tháng | $0      |
| Guest Tracking   | Google Apps Script           | Không giới hạn | $0      |
| Date Picker      | Flatpickr                    | Open source    | $0      |
| Encryption       | CryptoJS                     | Open source    | $0      |
| Fonts            | Google Fonts + Local         | Không giới hạn | $0      |
| **Tổng**         |                              |                | **$0**  |

## Thư Viện & Dependencies

| Thư viện       | Version | Mục đích                           | CDN                                                  |
| -------------- | ------- | ---------------------------------- | ---------------------------------------------------- |
| Tailwind CSS   | 3.x     | Styling framework                  | `https://cdn.tailwindcss.com`                        |
| Supabase JS    | 2.x     | Database & Storage client          | `https://cdn.jsdelivr.net/npm/@supabase/supabase-js` |
| Flatpickr      | 4.x     | Date picker với locale VI          | `https://cdn.jsdelivr.net/npm/flatpickr`             |
| CryptoJS       | 4.1.1   | AES encryption (tính năng planned) | `https://cdnjs.cloudflare.com/ajax/libs/crypto-js`   |
| Font Awesome   | 6.4.0   | Icons                              | `https://cdnjs.cloudflare.com/ajax/libs/font-awesome`|
| Google Fonts   | -       | Playfair, Great Vibes, Inter, etc. | `https://fonts.googleapis.com`                       |

---

## Tính Năng Đã Tích Hợp

### ✅ Google Sheets Integration
- Tích hợp Google Apps Script API để tracking khách mời
- Cấu trúc: Họ tên | Tên hiển thị | Quan hệ | Link thiệp | Đã xem | Xác nhận | Lời chúc | Thời gian
- Riêng biệt cho nhà trai (groom_google_sheet_url) và nhà gái (bride_google_sheet_url)
- API endpoints: getGuest, markViewed, confirm

### ✅ Supabase Storage Integration
- Upload ảnh trực tiếp lên Supabase Storage bucket `wedding-images`
- Database chỉ lưu filename (vd: `abc123.jpg`), không lưu full URL
- Frontend build URL: `STORAGE_BASE_URL + filename`
- Hỗ trợ: cover, groom/bride images, QR codes, gallery (max 7 ảnh)
- Auto-resize ảnh trước khi upload (max 1MB, 1920x1920px)
- Xóa ảnh cũ khỏi Storage khi user xóa/thay thế

### ✅ Auto-fill & Smart Defaults
- Ngày tiệc tự động = ngày lễ - 1 ngày (nếu trống)
- Giờ tiệc tự động = 17:00 (nếu trống)
- Địa chỉ tiệc tự động = địa chỉ nhà (nếu trống)
- Tự động tính ngày âm lịch từ dương lịch

### ✅ Bank Searchable Select
- Dropdown tìm kiếm 43 ngân hàng Việt Nam
- Filter theo tên, hỗ trợ keyboard navigation
- Tích hợp sẵn trong form nhà trai và nhà gái

### ✅ Skeleton Loading
- Hiển thị skeleton loader khi trang load
- Khớp với layout thực tế của form
- Shimmer animation effect

## Tính Năng Đang Lên Kế Hoạch

### 🔄 Auto-Generate Personalized Guest Links (Spec đã hoàn thành)
**Trạng thái**: Requirements đã xong, chờ triển khai

**Mô tả**: Tự động tạo link thiệp cá nhân hóa cho từng khách mời với mã hóa thông tin

**Tính năng chính**:
- 2 nút "Tự động tạo link" riêng biệt cho nhà trai và nhà gái
- Fetch danh sách khách từ Google Sheets
- Mã hóa tên + quan hệ bằng AES (key: "dqvinh")
- Tạo link: `domain/index.html?id=xxx&isGroom=true/false&name=ENCRYPTED&relationship=ENCRYPTED`
- Batch update link vào Google Sheets (cột D)
- Hiển thị lời chào cá nhân hóa: "Kính mời [quan hệ] [tên] tới dự lễ thành hôn..."

**Công nghệ**:
- CryptoJS (AES encryption + Base64 encoding)
- Google Apps Script batch update endpoint
- URL-safe encrypted parameters

**Tài liệu**: 
- Requirements: `.kiro/specs/auto-generate-guest-links/requirements.md`
- Chi tiết: `documents/TAI_LIEU_TU_DONG_TAO_LINK.md`

## Mở Rộng Tương Lai

- [ ] Thêm nhạc nền động từ DB
- [ ] Dashboard thống kê lượt xem thiệp
- [ ] Gửi email/SMS thông báo cho khách mời
- [ ] Multi-language support (EN/VI)
- [ ] Template themes (cho phép chọn theme khác nhau)
