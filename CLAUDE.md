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
  ├─ index.html              Vỏ trang: head, skeleton, các thẻ mount rỗng
  ├─ loader.js               Nạp partials/*.html rồi mới chèn script trong js/
  ├─ partials/               Từng "màn" tách riêng (form-panel, config-panel, theme-panel…)
  └─ js/                     Logic UI tách theo tính năng, nạp theo thứ tự khai báo ở loader.js
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
- **Luôn dùng Tailwind CSS** làm mặc định — style bằng utility class, hạn chế viết CSS thủ công. Config runtime: `public/themes/tailwind.config.js` (Tailwind Play CDN, không build).
- Khi buộc phải viết CSS/giá trị tuỳ chỉnh (arbitrary value, file `.css`): dùng **`px`** (không dùng `rem`) và **bội số của 4** (4, 8, 12, 16, 24…).
- **`styles/common.css` chỉnh TRỰC TIẾP** (không có build step) — chứa `.btn-*`, biến CSS (`--primary`…), `@font-face`, keyframes, scrollbar, tinh chỉnh iOS. Viết CSS thuần (không `@apply`, vì CDN không xử lý `@apply` trong file `.css` nạp qua `<link>`). Utility trong `class=` của HTML vẫn do Tailwind Play CDN lo lúc chạy.

### Database (Supabase)
- **Supabase MCP chỉ để ĐỌC** (`.mcp.json`, read-only, project `lcobawmkywtxhpezndsh`). Dùng `list_tables` / `execute_sql` để biết cấu trúc bảng thật khi thi công, thay vì suy ra schema từ `changelogs/` — changelogs là lịch sử thay đổi, không phải nguồn sự thật về trạng thái hiện tại.
- **TUYỆT ĐỐI không sửa DB qua MCP.** Mọi thay đổi schema/dữ liệu vẫn phải đi đường changelog → người dùng tự chạy ở Dashboard. Không đề xuất bỏ cờ `--read-only`.
- Mọi thay đổi schema → viết script SQL vào `changelogs/RCx.y/` (thư mục mới), **idempotent** (`if not exists`, `add column if not exists`…).
- Tăng **minor** (1.1→1.2) cho thay đổi thường; **major** (1.x→2.0) cho breaking change (kèm baseline `database-complete.sql` mới).
- Sau khi thêm script, cập nhật bảng **Lịch sử phiên bản** trong `changelogs/README.md`.
- Áp dụng qua Supabase Dashboard → SQL Editor (không cần CLI).

### Sơ đồ & tài liệu
- Khi sửa sơ đồ Mermaid, phải **đồng bộ ngay** bảng roadmap và phần text mô tả bên dưới trong cùng lần sửa.

### Web components (`x-*`)
- `[name=X]` trong querySelector khớp **`<x-input>`** chứ không phải `<input>` con — cẩn thận khi set/get value (fillForm, autosave restore).

### `invitation-setup` — trang nạp DOM động
Trang này KHÔNG đặt panel và script trong HTML tĩnh: `loader.js` fetch `partials/*.html`, chèn vào các thẻ mount, rồi mới chèn script trong `js/`. Hệ quả:
- Thêm file JS mới → phải đăng ký vào mảng `SCRIPTS` trong `loader.js`, **đúng thứ tự**. Thêm màn mới → thêm partial + thẻ mount trong `index.html` + mục trong `PARTIALS`.
- **Không dùng `DOMContentLoaded`** trong các file này — lúc script chạy thì nó đã bắn xong. Dùng `window.__cxOnReady(fn)` (loader cung cấp), nó chạy sau khi TOÀN BỘ script đã nạp.
- Function declaration chỉ hoist **trong cùng một file**. Lệnh top-level (vd `window.foo = foo`) chỉ được tham chiếu thứ khai báo ở file nạp **trước hoặc cùng file** — nếu không sẽ `ReferenceError`.
- File dùng chung trong `core/` mà bind vào DOM của trang này cần giữ nhánh dự phòng: `__cxOnReady` → `readyState` → gọi thẳng, để các trang khác không đổi hành vi.

### Theme thiệp mới (`public/themes/*`)
Để một theme mới chạy đúng với tính năng **chỉnh giao diện** (font/màu chung, sửa/ẩn text từng phần, thêm khối văn bản) trong tab Giao diện:

**Bắt buộc:**
- **Có `#main-card`** — khung thiệp, dùng cho `background_color` và làm gốc cho runtime chỉnh + custom blocks. Không có thì các tính năng ẩn/sửa/thêm khối không chạy.
- **Container các "mục" là flex-column** (`display:flex; flex-direction:column`) — để khối văn bản thêm mới chèn được GIỮA các mục (định vị bằng `flex order`, append cuối DOM để không đổi `nth-child`). Không phải flex-col → khối rơi xuống cuối.
- **Bind dữ liệu qua `setText(id, value)`** (`core/utils.js`) — helper tự gắn `data-cx-bound` để KHÓA sửa text trực tiếp (text từ Thiết lập chỉ sửa trong Thiết lập). Bind thẳng `el.textContent =` sẽ KHÔNG bị khóa → user sửa được và ghi đè giá trị Thiết lập.
- **Đi qua luồng render chuẩn**: `applyThemeSetting` (trước render) → `renderWedding` → `applyTextOverrides` → `applyCustomBlocks`. Dùng `loadWeddingData` (public, `core/helpers/wedding-helper.js`) và `preview-data.js` (preview) như các theme hiện có — theme chỉ cần cung cấp `renderWedding`.
- **Dùng đúng bộ class font/màu** mà `theme-setting-helper.js` nhắm (các hằng `HEADING_FONT_SELECTORS`, `BODY_*`, `*_COLOR_SELECTORS`, `BACKGROUND_COLOR_SELECTORS`). Class khác → phải **bổ sung vào các hằng đó**.

**Nên có (ổn định hơn):**
- Section có `id` (`#section-...`) → neo custom block + selector text-override bền, nhất là khi cấu trúc nhà trai/nhà gái khác nhau.
- Id chuẩn cho list động: `#timeline-list-render`, `#love-story-list`, `#rsvp-custom-message` (đã nằm trong `_CX_BOUND_SEL` để khóa). Id khác → thêm vào `_CX_BOUND_SEL`.
- Text muốn cho sửa nội dung nên là **text thuần** (không lồng icon/thẻ con) — có con thì mục "Nội dung" tự ẩn.

**Khi thêm theme mới, cập nhật trong `theme-setting-helper.js`:**
- `THEME_PRESETS["<tên-theme>"]` — font/màu GỐC + `swatches` (dùng cho "Khôi phục mặc định" và bảng chọn màu).
- Mở rộng các hằng `*_SELECTORS` nếu theme dùng class khác; `_CX_BOUND_SEL` nếu id list động khác.

(Không cần đụng `edit=1`/runtime — loader của `invitation-setup` tự thêm; theme không biết vẫn chạy.)

### Auth
- Không tự parse `localStorage` thủ công để lấy user — token supabase-js v2 có thể là `base64-...` và sẽ vỡ. Dùng API của supabase client.
- `IS_PUBLISHED` (invitation-setup) là **cờ dữ liệu, không phải quyền**: `getWeddingById` đọc bằng anon key nên người đã đăng xuất vẫn nhận `is_published: true`, và bản nháp trong cache cũng giữ cờ đó. Nút/chức năng nào thực chất cần đăng nhập (nhãn "Lưu & Xuất bản", ẩn "Lưu nháp", panel khách mời) phải hỏi `isPublishedForUi()` (`01-state.js`).

## Phân quyền

- 🔐 **Admin** — `/admin`, cần `ADMIN_SECRET_TOKEN`
- 👤 **Customer** — quản lý thiệp qua UUID/slug
- 🌐 **Public** — landing page, trang thiệp `/your-slug`, ai cũng xem được
