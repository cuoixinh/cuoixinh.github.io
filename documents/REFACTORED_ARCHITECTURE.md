# Kiến Trúc 3 Layer - Refactored (Updated 2024)

## Tổng Quan

Project đã được refactor theo kiến trúc 3 layer chuẩn và restructure folders để phân cấp rõ ràng:

```
┌─────────────────────────────────────────────────────────────┐
│  UI LAYER                                                    │
│  - public/themes/template1.js                               │
│  - public/account/account.js                                │
│  - customer/manage.js                                       │
│  - admin/admin.html (inline scripts)                        │
│  - index.js                                                 │
│  → Render UI, handle user events, call BL                   │
├─────────────────────────────────────────────────────────────┤
│  BUSINESS LOGIC LAYER (BL)                                  │
│  - core/bl/wedding-bl.js                                    │
│  - core/bl/image-bl.js                                      │
│  → Validation, transform data, business rules               │
├─────────────────────────────────────────────────────────────┤
│  DATA ACCESS LAYER (DAL)                                    │
│  - core/dal/wedding-dal.js                                  │
│  - core/dal/storage-dal.js                                  │
│  → Database queries, API calls only                         │
└─────────────────────────────────────────────────────────────┘
```

## Cấu Trúc Thư Mục

```
root/
├── index.html                    # Landing page (ROOT - bắt buộc)
├── index.js                      # Landing page logic
├── 404.html                      # GitHub Pages 404 handler
├── router.html                   # Clean URL router
│
├── admin/                        # 🔐 Admin pages (cần ADMIN_SECRET_TOKEN)
│   └── admin.html                # Admin dashboard với inline scripts
│
├── customer/                     # 👤 Customer management (cần UUID)
│   ├── manage.html               # Wedding management UI
│   └── manage.js                 # Wedding management logic (UI Layer)
│
├── public/                       # 🌐 Public pages (ai cũng vào được)
│   ├── themes/                   # 💒 Wedding templates
│   │   ├── template1.html        # Template HTML
│   │   ├── template1.js          # Template logic (UI Layer)
│   │   └── preview-data.js       # Preview data
│   │
│   └── account/                  # 💼 Customer account
│       ├── account.html          # Account page
│       └── account.js            # Account logic (UI Layer)
│
├── core/                         # ⚙️ Core logic (shared)
│   ├── config.js                 # Configuration centralized
│   ├── supabase.js               # Initialize all instances
│   ├── utils.js                  # Utility functions
│   ├── payment.js                # Payment logic
│   │
│   ├── dal/                      # Data Access Layer
│   │   ├── wedding-dal.js        # Wedding database queries
│   │   └── storage-dal.js        # Storage operations
│   │
│   └── bl/                       # Business Logic Layer
│       ├── wedding-bl.js         # Wedding business logic
│       └── image-bl.js           # Image processing logic
│
├── styles/                       # 🎨 CSS files
│   ├── landing.css               # Landing page styles
│   └── common.css                # Common styles
│
└── assets/                       # 📦 Static assets (không đổi)
    ├── fonts/
    ├── icons/
    ├── images/
    └── musics/
```

## Phân Quyền Truy Cập

### 1. Admin (Chỉ admin) 🔐

- **Path:** `/admin/admin.html`
- **URL:** https://cuoixinh.com/admin/admin.html
- **Yêu cầu:** `ADMIN_SECRET_TOKEN`
- **Chức năng:** Tạo/xóa/sửa TẤT CẢ thiệp, xem tất cả đơn hàng

### 2. Customer (Khách hàng đã mua) 👤

- **Path:** `/customer/manage.html?id=uuid`
- **URL:** https://cuoixinh.com/customer/manage.html?id=YOUR_UUID
- **Yêu cầu:** UUID (122-bit entropy)
- **Chức năng:** Chỉ quản lý thiệp của họ, không thấy thiệp người khác

### 3. Public (Ai cũng vào được) 🌐

- **Paths:**
  - `/` - Landing page
    - **URL:** https://cuoixinh.com
  - `/public/account/account.html` - Đăng nhập, xem đơn hàng
    - **URL:** https://cuoixinh.com/public/account/account.html
  - `/public/themes/template1.html?slug=xxx` - Xem thiệp cưới
    - **URL:** https://cuoixinh.com/public/themes/template1.html?slug=YOUR_SLUG
  - `/slug` - Clean URL (tự động redirect)
    - **URL:** https://cuoixinh.com/YOUR_SLUG

---

## 🔗 Quick Access URLs

### **Production (cuoixinh.com):**

| Trang　　　　　　　　　 | Clean URL ⭐                          | Full URL                                                           | Yêu cầu               |
| ----------------------- | ------------------------------------- | ------------------------------------------------------------------ | --------------------- |
| 🏠 Landing Page　　　　 | `https://cuoixinh.com/`               | `https://cuoixinh.com/index.html`                                  | Không                 |
| 🔐 Admin Dashboard　　  | `https://cuoixinh.com/admin`          | `https://cuoixinh.com/admin/admin.html`                            | ADMIN_SECRET_TOKEN    |
| 👤 Customer Management  | `https://cuoixinh.com/manage?id=UUID` | `https://cuoixinh.com/customer/manage.html?id=UUID`                | UUID từ đơn hàng      |
| 💼 Customer Account　　 | `https://cuoixinh.com/account`        | `https://cuoixinh.com/public/account/account.html`                 | Login Facebook/Google |
| 💒 Wedding Template　　 | `https://cuoixinh.com/YOUR_SLUG`      | `https://cuoixinh.com/public/themes/template1.html?slug=YOUR_SLUG` | Không                 |

### **Local Development:**

| Trang                  | Full URL                                                            |
| ---------------------- | ------------------------------------------------------------------- |
| 🏠 Landing Page        | `http://localhost:8000/index.html`                                  |
| 🔐 Admin Dashboard     | `http://localhost:8000/admin/admin.html`                            |
| 👤 Customer Management | `http://localhost:8000/customer/manage.html?id=UUID`                |
| 💼 Customer Account    | `http://localhost:8000/public/account/account.html`                 |
| 💒 Wedding Template    | `http://localhost:8000/public/themes/template1.html?slug=YOUR_SLUG` |

### **Ví Dụ Cụ Thể:**

```bash
# Landing page
https://cuoixinh.com/

# Admin (cần token) - CLEAN URL ⭐
https://cuoixinh.com/admin

# Customer quản lý thiệp - CLEAN URL ⭐ (thay UUID thật)
https://cuoixinh.com/manage?id=a1b2c3d4-e5f6-7890-abcd-ef1234567890

# Account (đăng nhập để xem đơn hàng) - CLEAN URL ⭐
https://cuoixinh.com/account

# Xem thiệp cưới - CLEAN URL ⭐ (thay slug thật)
https://cuoixinh.com/tuan-anh-va-minh-thu
```

### **Router Logic:**

Router (`router.html`) xử lý các clean URLs trên **production only** (GitHub Pages qua 404.html):

1. **Predefined routes** (ưu tiên cao):
   - `/admin` → `/admin/admin.html`
   - `/manage` hoặc `/customer` → `/customer/manage.html`
   - `/account` → `/public/account/account.html`

2. **Wedding slugs** (fallback):
   - `/anything-else` → Fetch theme từ database → `/public/themes/{theme}.html?slug=anything-else`

3. **Query params được preserve**:
   - `/manage?id=xxx` → `/customer/manage.html?id=xxx`

**Local Development:**

Clean URLs không hoạt động trên local. Dùng full URLs như bảng trên.

---

```bash
# Cài global
npm install -g http-server

# Hoặc dùng npx (không cần cài)
npx http-server
```

### **Chạy server với clean URLs:**

```bash
# Option 1: Redirect tất cả 404 về router.html
http-server -p 8000 -P http://localhost:8000/router.html

# Option 2: Dùng 404.html (giống production)
http-server -p 8000 --proxy http://localhost:8000/404.html?
```

### **Hoặc thêm vào package.json:**

```json
{
  "scripts": {
    "dev": "http-server -p 8000 -P http://localhost:8000/router.html",
    "start": "http-server -p 8000 -P http://localhost:8000/router.html"
  }
}
```

Sau đó chạy:

```bash
npm run dev
```

### **Clean URLs sẽ hoạt động:**

```bash
# Local development
http://localhost:8000/admin
http://localhost:8000/manage?id=xxx
http://localhost:8000/account
http://localhost:8000/your-wedding-slug

# Production (GitHub Pages)
https://cuoixinh.com/admin
https://cuoixinh.com/manage?id=xxx
https://cuoixinh.com/account
https://cuoixinh.com/your-wedding-slug
```

### **Lưu ý:**

- Live Server extension không hỗ trợ custom 404, nên dùng http-server
- http-server nhẹ, nhanh, và support clean URLs qua `-P` flag
- Cả local và production đều dùng cùng router logic

---

## Cấu Trúc File Chi Tiết

### 1. Data Access Layer (DAL) - `core/dal/`

#### `core/dal/wedding-dal.js`

Chỉ chứa các hàm truy vấn database:

- `getWeddingBySlug(slug)` - Lấy thiệp theo slug
- `getWeddingById(id)` - Lấy thiệp theo ID
- `updateWedding(payload)` - Cập nhật thiệp
- `createWedding(payload)` - Tạo thiệp mới
- `deleteWedding(id, token)` - Xóa thiệp
- `listWeddings(token)` - Danh sách thiệp (admin)
- `markViewed(sheetUrl, link)` - Đánh dấu đã xem
- `getGuestName(scriptUrl, slug)` - Lấy tên khách
- `getAllGuests(sheetUrl)` - Lấy danh sách khách
- `batchUpdateLinks(sheetUrl, updates)` - Cập nhật link hàng loạt

#### `core/dal/storage-dal.js`

Chỉ chứa các hàm upload/delete file:

- `uploadFile(filename, file)` - Upload file
- `deleteFile(filename)` - Xóa file
- `deleteFiles(filenames)` - Xóa nhiều file
- `getPublicUrl(filename)` - Lấy URL public

### 2. Business Logic Layer (BL) - `core/bl/`

#### `core/bl/wedding-bl.js`

Xử lý logic nghiệp vụ về thiệp cưới:

- `getWeddingBySlug(slug)` - Lấy thiệp + validate + transform
- `getWeddingById(id)` - Lấy thiệp + validate + transform
- `processWeddingData(data)` - Transform filenames → URLs
- `updateWedding(payload)` - Cập nhật + validate
- `createWedding(payload)` - Tạo mới + validate
- `validateSlug(slug)` - Validate và normalize slug
- `isActive(wedding)` - Kiểm tra thiệp còn active
- `trackView(wedding, isGroom, urlParams)` - Track lượt xem
- `getGuestName(scriptUrl, slug)` - Lấy tên khách + error handling
- `generatePersonalizedLinks(weddingId, side, encryptFn)` - Tạo link cá nhân hóa

#### `core/bl/image-bl.js`

Xử lý logic về ảnh:

- `validateImageFile(file)` - Validate file ảnh
- `resizeImage(file)` - Resize ảnh nếu cần
- `uploadSingleImage(weddingId, fieldName, file)` - Upload 1 ảnh
- `uploadMultipleImages(weddingId, files)` - Upload nhiều ảnh
- `deleteImages(filenames)` - Xóa ảnh
- `generateUUID()` - Tạo UUID cho filename

### 3. Initialization Layer - `core/supabase.js`

Khởi tạo tất cả instances:

```javascript
// Initialize Supabase client
const supabaseClient = window.supabase.createClient(
  CONFIG.supabase.url,
  CONFIG.supabase.anonKey,
);

// Initialize DAL
const weddingDAL = new WeddingDAL(CONFIG);
const storageDAL = new StorageDAL(supabaseClient, CONFIG);

// Initialize BL
const weddingBL = new WeddingBL(weddingDAL, storageDAL);
const imageBL = new ImageBL(storageDAL);

// Export to global scope
window.weddingDAL = weddingDAL;
window.storageDAL = storageDAL;
window.weddingBL = weddingBL;
window.imageBL = imageBL;
window.supabaseClient = supabaseClient;
```

### 4. UI Layer

#### `public/themes/template1.js`

- Render thiệp cưới
- Handle music, gallery, RSVP
- Gọi `weddingBL.getWeddingBySlug()`

#### `customer/manage.js`

- Form quản lý thiệp
- Upload ảnh qua `imageBL`
- Cập nhật qua `weddingBL.updateWedding()`

#### `public/account/account.js`

- OAuth login (Facebook/Google)
- Hiển thị danh sách đơn hàng
- Sửa thông tin cá nhân

#### `admin/admin.html` (inline scripts)

- CRUD tất cả thiệp
- Pagination, search
- Copy manage link

## Cách Sử Dụng

### Load Scripts Đúng Thứ Tự

#### Trong `index.html` (root):

```html
<script src="core/config.js"></script>
<script src="index.js"></script>
<script src="core/payment.js"></script>
```

#### Trong `admin/admin.html`:

```html
<script src="../core/config.js"></script>
<!-- Inline scripts -->
```

#### Trong `customer/manage.html`:

```html
<!-- Config -->
<script src="../core/config.js"></script>

<!-- Supabase SDK -->
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>

<!-- DAL Layer -->
<script src="../core/dal/wedding-dal.js"></script>
<script src="../core/dal/storage-dal.js"></script>

<!-- BL Layer -->
<script src="../core/bl/wedding-bl.js"></script>
<script src="../core/bl/image-bl.js"></script>

<!-- Initialize -->
<script src="../core/supabase.js"></script>

<!-- UI Layer -->
<script src="manage.js"></script>
```

#### Trong `public/themes/template1.html`:

```html
<script src="preview-data.js"></script>
<script src="../../core/config.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="../../core/dal/wedding-dal.js"></script>
<script src="../../core/dal/storage-dal.js"></script>
<script src="../../core/bl/wedding-bl.js"></script>
<script src="../../core/bl/image-bl.js"></script>
<script src="../../core/supabase.js"></script>
<script src="../../core/utils.js"></script>
<script src="template1.js"></script>
```

#### Trong `public/account/account.html`:

```html
<script src="../../core/config.js"></script>
<script src="account.js"></script>
<script src="../../core/payment.js"></script>
```

### Ví Dụ Sử Dụng Trong UI Layer

#### Lấy và hiển thị thiệp cưới:

```javascript
// OLD WAY (trước refactor)
async function fetchWedding() {
  const slug = getSlug();
  const res = await fetch(`${API_BASE}?slug=${slug}`, {...});
  const data = await res.json();
  return data;
}

// NEW WAY (sau refactor)
async function loadWedding() {
  try {
    const slug = getSlugFromUrl(); // from utils.js
    const wedding = await weddingBL.getWeddingBySlug(slug);

    if (!weddingBL.isActive(wedding)) {
      showExpired("Thiệp cưới đã hết hạn");
      return;
    }

    renderWedding(wedding);
  } catch (error) {
    showExpired(error.message);
  }
}
```

#### Upload ảnh:

```javascript
// OLD WAY
async function uploadImage(file) {
  const resized = await resizeImage(file);
  const filename = generateUUID() + ".jpg";
  const { data, error } = await supabase.storage
    .from("wedding-images")
    .upload(filename, resized);
  return filename;
}

// NEW WAY
async function handleImageUpload(event, fieldName) {
  const file = event.target.files[0];

  try {
    showLoading(true, "Đang xử lý ảnh...");

    const filename = await imageBL.uploadSingleImage(
      WEDDING_ID,
      fieldName,
      file,
    );

    // Update UI
    updateImagePreview(fieldName, filename);
    showToast("✅ Upload thành công");
  } catch (error) {
    showToast("❌ " + error.message);
  } finally {
    showLoading(false);
  }
}
```

#### Cập nhật thiệp:

```javascript
// OLD WAY
async function saveWedding(data) {
  const res = await fetch(EDGE_URL, {
    method: "PATCH",
    headers: {...},
    body: JSON.stringify(data)
  });
  return await res.json();
}

// NEW WAY
async function saveWedding(formData) {
  try {
    showLoading(true, "Đang lưu...");

    const payload = {
      id: WEDDING_ID,
      ...formData
    };

    await weddingBL.updateWedding(payload);

    showToast("✅ Đã lưu thành công");
  } catch (error) {
    showToast("❌ " + error.message);
  } finally {
    showLoading(false);
  }
}
```

#### Tạo link cá nhân hóa:

```javascript
// OLD WAY
async function generateLinks(side) {
  const wedding = await fetchWedding();
  const sheetUrl = side === "groom" ? wedding.groom_google_sheet_url : ...;
  const guests = await fetchAllGuests(sheetUrl);
  // ... complex logic
}

// NEW WAY
async function generateLinks(side) {
  try {
    showLoading(true, "Đang tạo link...");

    const result = await weddingBL.generatePersonalizedLinks(
      WEDDING_ID,
      side,
      encryptData // encryption function from utils
    );

    if (result.success) {
      showToast(`✅ Đã tạo ${result.count} link`);
    } else {
      showToast(`⚠️ ${result.message}`);
    }
  } catch (error) {
    showToast("❌ " + error.message);
  } finally {
    showLoading(false);
  }
}
```

## URL Mapping

### Trước Migration:

```
https://cuoixinh.com/admin.html
https://cuoixinh.com/manage.html?id=xxx
https://cuoixinh.com/account.html
https://cuoixinh.com/themes/template1.html?slug=xxx
```

### Sau Migration:

```
https://cuoixinh.com/admin/admin.html
https://cuoixinh.com/customer/manage.html?id=xxx
https://cuoixinh.com/public/account/account.html
https://cuoixinh.com/public/themes/template1.html?slug=xxx
```

### Clean URLs (qua router.html):

```
https://cuoixinh.com/slug-name
  ↓ (404.html catches)
  ↓ (router.html processes)
  ↓
https://cuoixinh.com/public/themes/template1.html?slug=slug-name
```

## 🔗 Danh Sách URL Truy Cập

### **Production URLs:**

1. **Landing Page (Trang chủ):**
   - `https://cuoixinh.com/`
   - `https://cuoixinh.com/index.html`

2. **Admin Dashboard:**
   - `https://cuoixinh.com/admin/admin.html`
   - Cần nhập `ADMIN_SECRET_TOKEN` để truy cập

3. **Customer Management:**
   - `https://cuoixinh.com/customer/manage.html?id=YOUR_UUID`
   - Thay `YOUR_UUID` bằng UUID thực tế từ đơn hàng

4. **Customer Account:**
   - `https://cuoixinh.com/public/account/account.html`
   - Đăng nhập bằng Facebook/Google để xem đơn hàng

5. **Wedding Template (Full URL):**
   - `https://cuoixinh.com/public/themes/template1.html?slug=YOUR_SLUG`
   - Thay `YOUR_SLUG` bằng slug thiệp cưới

6. **Wedding Template (Clean URL):**
   - `https://cuoixinh.com/YOUR_SLUG`
   - Tự động redirect qua router.html

### **Local Development URLs:**

1. **Landing Page:**
   - `http://localhost:8000/`
   - `http://127.0.0.1:8000/index.html`

2. **Admin Dashboard:**
   - `http://localhost:8000/admin/admin.html`

3. **Customer Management:**
   - `http://localhost:8000/customer/manage.html?id=YOUR_UUID`

4. **Customer Account:**
   - `http://localhost:8000/public/account/account.html`

5. **Wedding Template:**
   - `http://localhost:8000/public/themes/template1.html?slug=YOUR_SLUG`

### **Ví Dụ Cụ Thể:**

```
# Admin
https://cuoixinh.com/admin/admin.html

# Customer quản lý thiệp (UUID giả định)
https://cuoixinh.com/customer/manage.html?id=a1b2c3d4-e5f6-7890-abcd-ef1234567890

# Xem thiệp cưới (slug giả định)
https://cuoixinh.com/public/themes/template1.html?slug=tuan-anh-va-minh-thu
https://cuoixinh.com/tuan-anh-va-minh-thu (clean URL)

# Account
https://cuoixinh.com/public/account/account.html
```

## Lợi Ích

### 1. Separation of Concerns

- DAL chỉ lo database
- BL chỉ lo logic nghiệp vụ
- UI chỉ lo render và events

### 2. Phân Cấp Rõ Ràng

- Admin pages riêng folder
- Customer pages riêng folder
- Public pages riêng folder
- Core logic được share

### 3. Dễ Test

```javascript
// Test BL mà không cần database thật
const mockDAL = {
  getWeddingBySlug: async () => ({ slug: "test", is_active: true }),
};
const mockStorage = {
  getPublicUrl: (f) => `https://cdn.com/${f}`,
};
const bl = new WeddingBL(mockDAL, mockStorage);
```

### 4. Dễ Maintain

- Thay đổi database? Chỉ sửa DAL
- Thay đổi validation? Chỉ sửa BL
- Thay đổi UI? Không ảnh hưởng DAL/BL
- Thay đổi folder structure? Chỉ update paths

### 5. Reusable

- Dùng lại `weddingBL` ở nhiều page
- Dùng lại `imageBL` cho mọi upload
- Không duplicate code

### 6. Security

- Admin pages yêu cầu token
- Customer pages yêu cầu UUID
- Public pages accessible to all
- Clear separation of access levels

## Migration History

### Phase 1: 3-Layer Architecture (Completed)

- ✅ Tách DAL, BL, UI
- ✅ Centralize config
- ✅ Initialize instances in supabase.js

### Phase 2: Folder Restructure (Completed)

- ✅ Core files → `core/`
- ✅ Admin → `admin/`
- ✅ Customer → `customer/`
- ✅ Public → `public/`
- ✅ Styles → `styles/`
- ✅ Update all paths

## Notes

- Tất cả instances được export vào `window` scope để dùng global
- Config được centralize trong `core/config.js`
- Utils functions (setText, setAttr, etc.) trong `core/utils.js`
- Payment logic trong `core/payment.js`
- Lunar calendar functions trong `customer/manage.js`
- Asset paths sử dụng relative paths (`../`, `../../`)
- GitHub Pages compatible (giữ `.html` extensions)

## Testing Checklist

- [x] Landing page works (index.html)
- [x] Admin dashboard works (admin/admin.html)
- [x] Customer management works (customer/manage.html)
- [x] Account page works (public/account/account.html)
- [x] Wedding templates work (public/themes/template1.html)
- [x] YouTube music feature works (customer/manage.html + template1.html)
- [ ] Payment flow works (cần test thủ công)
- [x] Router redirects correctly
- [x] 404 handler works

## Recent Updates

### YouTube Music Feature (2024)

**Implemented:** YouTube link input instead of music file upload to save storage costs.

**Changes:**

1. **customer/manage.html:**
   - Added YouTube link input field with default music placeholder
   - Added YouTube preview player (iframe embed)
   - Removed music file upload functionality
   - Hidden input stores YouTube URL in `music_url` field
   - Placeholder shows default music URL

2. **customer/manage.js:**
   - Added `extractYouTubeVideoId()` - Extract video ID from various YouTube URL formats
   - Added `previewYouTubeMusic()` - Show YouTube embed preview (uses default music if input is empty)
   - Added `removeYouTubeMusic()` - Clear YouTube selection
   - Added `renderExistingYouTubeMusic()` - Load saved YouTube URL
   - Updated `fillForm()` to call `renderExistingYouTubeMusic()` when `music_url` contains YouTube link
   - Updated `saveAll()` to save YouTube URL directly (no upload needed)
   - Removed `pendingUploads.musicFile` and music upload logic

3. **public/themes/template1.js:**
   - Added `loadYouTubeAPI()` - Load YouTube IFrame API
   - Added `extractYouTubeVideoId()` - Extract video ID from URL
   - Added `initYouTubeMusic()` - Initialize hidden YouTube player for background music
   - Updated `renderWedding()` to call `initYouTubeMusic()` when `music_url` exists
   - YouTube player auto-plays at 30% volume and loops

4. **core/config.js:**
   - Added `defaultMusic.youtubeUrl` - Default music URL for preview
   - Default: "https://www.youtube.com/watch?v=06-XXOTP3Gc" (Beautiful In White)

**Benefits:**

- ✅ No storage cost (unlimited music via YouTube)
- ✅ No file size limits
- ✅ Users can choose any song on YouTube
- ✅ Auto-loop and volume control
- ✅ Preview before saving
- ✅ Default music provided if user doesn't specify

**Default Music:**

- Song: Beautiful In White
- URL: https://www.youtube.com/watch?v=06-XXOTP3Gc&list=RD06-XXOTP3Gc&start_radio=1
- Users can leave input empty to use default, or paste their own YouTube link

**Supported YouTube URL formats:**

- `https://www.youtube.com/watch?v=VIDEO_ID`
- `https://youtu.be/VIDEO_ID`
- `https://www.youtube.com/embed/VIDEO_ID`
- `https://www.youtube.com/v/VIDEO_ID`

## Documentation

- `documents/ARCHITECTURE.md` - Kiến trúc ban đầu
- `documents/REFACTORED_ARCHITECTURE.md` - Kiến trúc sau refactor (file này)
- `documents/MIGRATION_SUMMARY.md` - Chi tiết migration
- `documents/MIGRATION_COMPLETED.md` - Checklist migration
- `README.md` - Overview và setup guide
