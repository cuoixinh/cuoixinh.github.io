# 💒 CuoiXinh - Wedding Invitation Platform

Website tạo thiệp cưới online với kiến trúc 3-layer (DAL/BL/UI).

## 🚀 Quick Start

### **Local Development:**

Dùng bất kỳ static server nào:

```bash
# Live Server (VS Code extension)
# Right-click index.html → Open with Live Server

# Python
python -m http.server 8000

# Node http-server
npx http-server -p 8000

# PHP
php -S localhost:8000
```

Truy cập: `http://localhost:8000`

### **URLs:**

**Local (dùng full URLs):**

- `http://localhost:8000/` - Landing page
- `http://localhost:8000/admin/admin.html` - Admin dashboard
- `http://localhost:8000/customer/manage.html?id=xxx` - Customer management
- `http://localhost:8000/public/account/account.html` - Account page
- `http://localhost:8000/public/themes/template1.html?slug=xxx` - Wedding template

**Production (clean URLs):**

- `https://cuoixinh.com/` - Landing page
- `https://cuoixinh.com/admin` - Admin dashboard
- `https://cuoixinh.com/manage?id=xxx` - Customer management
- `https://cuoixinh.com/account` - Account page
- `https://cuoixinh.com/your-wedding-slug` - Wedding template

## 📂 Cấu Trúc Project

```
root/
├── index.html                    # Landing page
├── index.js                      # Landing page logic
├── router.html                   # Clean URL router (production only)
├── 404.html                      # GitHub Pages 404 handler
│
├── admin/                        # 🔐 Admin pages (cần ADMIN_SECRET_TOKEN)
│   └── admin.html
│
├── customer/                     # 👤 Customer management (cần UUID)
│   ├── manage.html
│   └── manage.js
│
├── public/                       # 🌐 Public pages
│   ├── themes/                   # Wedding templates
│   │   ├── template1.html
│   │   ├── template1.js
│   │   └── preview-data.js
│   └── account/                  # Customer account
│       ├── account.html
│       └── account.js
│
├── core/                         # ⚙️ Core logic (3-layer architecture)
│   ├── config.js
│   ├── supabase.js
│   ├── utils.js
│   ├── payment.js
│   ├── dal/                      # Data Access Layer
│   │   ├── wedding-dal.js
│   │   └── storage-dal.js
│   └── bl/                       # Business Logic Layer
│       ├── wedding-bl.js
│       └── image-bl.js
│
├── styles/                       # Nguồn + kết quả build Tailwind (npm run build)
│   ├── _base.css                 # partial: @tailwind base
│   ├── _common.css               # partial: dùng chung cả 2 build
│   ├── _setup.css                # partial: invitation-setup
│   ├── _ai-modal.css             # partial: modal AI
│   ├── tailwind-src.css          # → build.css   (trang ứng dụng)
│   ├── themes-src.css            # → themes.css  (trang thiệp)
│   ├── build.css                 # build sẵn — commit vào repo
│   └── themes.css                # build sẵn — commit vào repo
│
└── assets/                       # Static assets
    ├── fonts/
    ├── icons/
    ├── images/
    └── musics/
```

## 🏗️ Kiến Trúc

### **3-Layer Architecture:**

```
┌─────────────────────────────────────────┐
│  UI LAYER                                │
│  - Render UI, handle events              │
├─────────────────────────────────────────┤
│  BUSINESS LOGIC LAYER (BL)              │
│  - Validation, transform, business rules │
├─────────────────────────────────────────┤
│  DATA ACCESS LAYER (DAL)                │
│  - Database queries, API calls           │
└─────────────────────────────────────────┘
```

### **Phân Quyền:**

- 🔐 **Admin:** `/admin/admin.html` - Cần ADMIN_SECRET_TOKEN
- 👤 **Customer:** `/customer/manage.html?id=uuid` - Cần UUID
- 🌐 **Public:** `/`, `/account`, `/your-slug` - Ai cũng truy cập được

## 📚 Documentation

Chi tiết kiến trúc và hướng dẫn: [`documents/REFACTORED_ARCHITECTURE.md`](documents/REFACTORED_ARCHITECTURE.md)

## 🛠️ Tech Stack

- **Frontend:** Vanilla JavaScript, HTML5, CSS3
- **Backend:** Supabase (Database + Storage + Edge Functions)
- **Payment:** PayOS
- **Hosting:** GitHub Pages
- **CDN:** Cloudflare Workers

## 📝 License

ISC
