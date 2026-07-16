# CuoiXinh — Wedding Invitation Platform

Website tạo thiệp cưới online. Vanilla JS (không framework), kiến trúc 3-layer (DAL / BL / UI).
Ngôn ngữ làm việc: **tiếng Việt**.

## Tech stack

- **Frontend:** Vanilla JavaScript, HTML5, **Tailwind CSS** (không build step, chạy trực tiếp file tĩnh)
- **Backend:** Supabase (Postgres + Storage + Edge Functions, Deno/TypeScript)
- **Payment:** PayOS
- **Hosting:** GitHub Pages · **CDN/Proxy:** Cloudflare Workers

## Chạy local

Dùng bất kỳ static server nào (không có bước build):

```bash
python -m http.server 8000     # hoặc Live Server (VS Code), npx http-server -p 8000
```

Truy cập `http://localhost:8000` — local dùng **full URL** (vd `/admin/index.html`); production dùng **clean URL** qua `router.html` (vd `cuoixinh.com/admin`).

## Cấu trúc chính

```
index.html / index.js        Landing page
router.html, 404.html        Clean URL routing (production, GitHub Pages)
admin/                       Trang admin (cần ADMIN_SECRET_TOKEN)
invitation-setup/            Trình tạo/chỉnh thiệp của khách (tab: nội dung, giao diện, khách mời…)
public/themes/               Các theme thiệp cưới (romantic-gold, vintage-forest, basic-gold…)
core/                        Logic dùng chung (3-layer)
  ├─ config.js, supabase.js, utils.js, payment.js, auth-ui.js
  ├─ dal/                    Data Access Layer  — query DB / gọi API (wedding, guest, storage, ai)
  ├─ bl/                     Business Logic     — validate, transform, business rules
  ├─ components/, helpers/   UI components & helpers
  └─ x-*.js                  Web components tuỳ biến (x-input, x-controls, x-speech, x-undo)
styles/                      CSS (common.css, landing.css)
supabase/functions/          Edge Functions: ai-invitation, guest-handler, payment-handler,
                             payos-webhook, wedding-admin, _shared
changelogs/                  Lịch sử thay đổi DB (xem mục Database)
cloudflare-worker/           Workers proxy/cache
```

## Kiến trúc 3-layer

UI (render + events) → **BL** (validate, transform, business rules) → **DAL** (query DB, gọi API).
Không gọi thẳng từ UI xuống DAL bỏ qua BL khi có logic nghiệp vụ. Đặt code đúng tầng.

## Quy tắc bắt buộc

### CSS
- **Luôn dùng Tailwind CSS** làm mặc định — style bằng utility class, hạn chế viết CSS thủ công. Config: `public/themes/tailwind.config.js`.
- Khi buộc phải viết CSS/giá trị tuỳ chỉnh (arbitrary value, file `.css`): dùng **`px`** (không dùng `rem`) và **bội số của 4** (4, 8, 12, 16, 24…).

### Database (Supabase)
- Mọi thay đổi schema → viết script SQL vào `changelogs/RCx.y/` (thư mục mới), **idempotent** (`if not exists`, `add column if not exists`…).
- Tăng **minor** (1.1→1.2) cho thay đổi thường; **major** (1.x→2.0) cho breaking change (kèm baseline `database-complete.sql` mới).
- Sau khi thêm script, cập nhật bảng **Lịch sử phiên bản** trong `changelogs/README.md`.
- Áp dụng qua Supabase Dashboard → SQL Editor (không cần CLI).

### Sơ đồ & tài liệu
- Khi sửa sơ đồ Mermaid, phải **đồng bộ ngay** bảng roadmap và phần text mô tả bên dưới trong cùng lần sửa.

### Web components (`x-*`)
- `[name=X]` trong querySelector khớp **`<x-input>`** chứ không phải `<input>` con — cẩn thận khi set/get value (fillForm, autosave restore).

### Auth
- Không tự parse `localStorage` thủ công để lấy user — token supabase-js v2 có thể là `base64-...` và sẽ vỡ. Dùng API của supabase client.

## Phân quyền

- 🔐 **Admin** — `/admin`, cần `ADMIN_SECRET_TOKEN`
- 👤 **Customer** — quản lý thiệp qua UUID/slug
- 🌐 **Public** — landing page, trang thiệp `/your-slug`, ai cũng xem được
