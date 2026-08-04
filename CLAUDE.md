# CuoiXinh — Wedding Invitation Platform

Website tạo thiệp cưới online. Vanilla JS (không framework), kiến trúc 3-layer.
Ngôn ngữ làm việc: **tiếng Việt**.

> **Phạm vi file này:** bản tóm tắt luồng project, KHÔNG phải lịch sử thay đổi.
> Chỉ bổ sung khi có **nghiệp vụ mới** hoặc **quy tắc quan trọng** (thứ mà làm sai
> là hỏng/mất dữ liệu). Chi tiết triển khai → comment cạnh code. Thay đổi thường
> chỉ sửa lại câu đang sai, không thêm mục mới.

**Stack:** Vanilla JS + Tailwind (build CLI) · Supabase (Postgres/Storage/Edge Functions) ·
PayOS · GitHub Pages + Cloudflare Workers.

## Chạy local

```bash
npm install
npm run build                  # build 2 file CSS
python -m http.server 8000     # hoặc Live Server / npx http-server
```

Sửa CSS thì `npm run watch:css` (ứng dụng) hoặc `npm run watch:themes` (thiệp).
Local dùng full URL (`/admin/index.html`); production dùng clean URL qua `router.html`.

## Cấu trúc

```
index.html               Landing page
router.html, 404.html    Clean URL routing (production)
admin/                   Trang admin (cần ADMIN_SECRET_TOKEN)
invitation-setup/        Trình tạo/chỉnh thiệp — index.html (vỏ) + loader.js + partials/ + js/
public/themes/           Các theme thiệp (romantic-gold, vintage-forest, basic-gold…)
core/                    Dùng chung: dal/ · bl/ · components/ · helpers/ · x-*.js (web components)
styles/                  Nguồn `_*.css` + 2 bản build (xem mục CSS)
supabase/functions/      Edge Functions
changelogs/              Lịch sử thay đổi DB
cloudflare-worker/       Workers proxy/cache
```

**3-layer:** UI (render + events) → **BL** (validate, transform, rules) → **DAL** (query DB, API).
Không gọi thẳng UI → DAL khi có logic nghiệp vụ.

## Quy tắc bắt buộc

### Comment

- Comment nói **chức năng**: khối này làm gì, dùng ở đâu, ràng buộc khi dùng.
  **Không viết nhật ký thay đổi** ("trước đây…", "đã bỏ…", "sửa X thành Y") — đó là việc của git log.
- Ngắn: đầu file ≤ 5 dòng, trước hàm 1–3 dòng. Không kẻ khung `====`, không lặp lại điều tên hàm/biến đã nói.
- Bỏ JSDoc chỉ liệt kê lại tham số hiển nhiên; chỉ giữ khi kiểu/shape thật sự khó đoán.
- Ràng buộc dễ vấp (thứ tự nạp, phải gọi cleanup, purge Tailwind…) ghi **một câu** ngay tại chỗ, không viết thành đoạn văn.

### CSS

- Mặc định dùng **Tailwind utility class**, hạn chế CSS thủ công. Không còn Play CDN →
  **sửa CSS xong phải `npm run build` và commit cả file build**.
- **Hai bản build riêng, không gộp được** (cùng tên màu nhưng khác giá trị):

  | Build    | Config                      | Nguồn → Kết quả                  | Trang dùng                                                                   |
  | -------- | --------------------------- | -------------------------------- | ---------------------------------------------------------------------------- |
  | Ứng dụng | `tailwind.config.js`        | `tailwind-src.css` → `build.css` | `index`, `admin/`, `invitation-setup/`, `public/account/`, `theme-template/` |
  | Thiệp    | `tailwind.themes.config.js` | `themes-src.css` → `themes.css`  | `public/themes/*`                                                            |

- Thêm thư mục/trang mới → **thêm vào `content`** của config tương ứng, không thì bị purge.
- **Không ghép tên class từ chuỗi** (`` `bg-${c}` ``) — purge quét văn bản thô. Viết trọn tên class.
- CSS thủ công để ở `styles/_*.css` **top-level, không bọc `@layer`** (bị purge).
  `@import` chỉ chạy khi nằm đầu file. Đặt tên `@keyframes` có tiền tố `cx-`.
- Giá trị tuỳ chỉnh: dùng **`px`**, bội số của **4**.

### Database (Supabase)

- **Supabase MCP chỉ để ĐỌC** (project `lcobawmkywtxhpezndsh`). Dùng `list_tables`/`execute_sql`
  để biết schema thật — changelogs là lịch sử, không phải nguồn sự thật.
- **Không sửa DB qua MCP.** Mọi thay đổi schema → script SQL **idempotent** trong
  `changelogs/RCx.y/` (minor cho thay đổi thường, major cho breaking + baseline mới),
  cập nhật bảng phiên bản ở `changelogs/README.md`, người dùng tự chạy ở Dashboard.

### `invitation-setup` — trang nạp DOM động

`loader.js` fetch `partials/*.html` rồi mới chèn script trong `js/`. Hệ quả:

- Thêm file JS → đăng ký vào `SCRIPTS` trong `loader.js` **đúng thứ tự**;
  thêm màn → partial + thẻ mount ở `index.html` + mục trong `PARTIALS`.
- **Không dùng `DOMContentLoaded`** — dùng `window.__cxOnReady(fn)`.
  File trong `core/` cần nhánh dự phòng: `__cxOnReady` → `readyState` → gọi thẳng.
- Chỉ tham chiếu được thứ khai báo ở file nạp trước hoặc cùng file.

### Auth

- **`core/auth.js` (`window.CXAuth`) là nguồn sự thật DUY NHẤT** cho trạng thái đăng nhập.
  Không tự parse `localStorage`, không tạo supabase client riêng.
  - `isLoggedIn()`/`getUserSync()` — trả lời ngay, dùng để **vẽ UI**.
  - `await getUser()`/`accessToken()` — **bắt buộc trước mọi thao tác GHI** (tự refresh token).
  - `onChange(cb)` — theo dõi phiên đổi.
- Trang nào GHI dữ liệu phải nạp `core/auth.js` (kể cả iframe `invitation-setup/guests/`),
  thiếu là 401. Trang thiệp public chỉ đọc nên không cần.
- `invitation-setup` hỏi trạng thái qua cờ **`IS_LOGIN`** (`01-state.js`), đổi cờ qua
  `_syncLoginState()`/`_refreshLoginState()` — **đừng gán thẳng**.
- `IS_PUBLISHED` là **cờ dữ liệu, không phải quyền** — chức năng cần đăng nhập phải xét
  `IS_PUBLISHED && IS_LOGIN`.

### Theme thiệp mới (`public/themes/*`)

Bắt buộc để chạy đúng với tab Giao diện:

- Có **`#main-card`**; container các mục là **flex-column** (để chèn khối văn bản giữa các mục).
- Bind dữ liệu qua **`setText(id, value)`** (`core/utils.js`) — tự khoá sửa text trực tiếp.
  Bind `el.textContent =` sẽ không bị khoá.
- Đi đúng luồng: `applyThemeSetting` → `renderWedding` → `applyTextOverrides` →
  `applyCustomBlocks` → `applyElements` (theme chỉ cần cung cấp `renderWedding`).
- Dùng đúng bộ class font/màu mà `theme-setting-helper.js` nhắm; class/id khác → bổ sung vào
  các hằng `*_SELECTORS` / `_CX_BOUND_SEL` trong file đó.
- Đăng ký `THEME_PRESETS["<tên-theme>"]` (font/màu gốc + `swatches`) trong
  `theme-setting-helper.js`, và font/màu riêng vào `theme.extend` của `tailwind.themes.config.js`
  (rồi `npm run build:themes`).
- Nên có: `id` cho từng section, text thuần (không lồng icon) cho phần cho phép sửa.

### Khác

- **Web components `x-*`:** `[name=X]` khớp `<x-input>` chứ không phải `<input>` con.
- **Trình phát nhạc:** markup dùng chung ở `core/components/music-player.js`, logic ở
  `music-player-helper.js` — theme chỉ đánh dấu vai trò bằng `data-cx-music="…"`,
  **không viết lại logic trong theme**.
- **Thành phần thả lên thiệp:** danh mục ở `core/helpers/element-helper.js`, runtime ở
  `theme-setting-helper.js`, bảng chọn ở `05-theme-panel.js`. Lưu trong
  `theme_setting.elements` (cùng blob JSON với `custom_blocks`) → không cần changelog DB.
  Tuỳ chọn riêng của mỗi thành phần khai báo bằng `options` + `apply()` trong danh mục
  (bảng điều chỉnh tự dựng control). Ô màu dùng bộ khoá cố định ở
  `core/helpers/element-color-enum.js` (nạp TRƯỚC `element-helper.js`); mỗi **mẫu**
  liệt kê trong `variants[].colors` những ô nó dùng. Số ô tối đa = `EL_COLOR_SLOTS`
  (`05-theme-panel.js`) và phải có sẵn bấy nhiêu hàng chip trong `theme-panel.html` —
  Coloris chỉ bọc được input đã nằm trong DOM. Ô màu nên có `from(node)` đọc màu đang
  hiện của widget để chip mở đúng màu người dùng đang thấy.
  Khai báo `pin: true` thì widget **ghim theo màn hình** (nổi ở lớp `#cx-el-pin-layer`
  gắn vào `<body>`, không cuộn theo thiệp) — khi đó `y` đã lưu là % chiều cao KHUNG NHÌN
  chứ không phải % chiều cao thiệp; `x` vẫn là % bề ngang thiệp.
  Trình phát **sẵn có của theme** (`#music-toggle`) không phải ngoại lệ: lần đầu mở
  trình chỉnh nó được dựng thành một mục trong `elements` (cờ `theme_setting.music_seeded`
  để xoá rồi thì đừng dựng lại), từ đó mọi hành xử giống hệt thành phần tự thêm.
- **Mẫu văn bản (preset) ở tab Văn bản:** danh mục + CSS của từng mẫu ở
  `core/helpers/text-preset-helper.js` (nạp TRƯỚC `theme-setting-helper.js`), thêm mẫu mới
  chỉ sửa file đó — bảng chọn tự dựng. Lưu trong `custom_blocks` dạng
  `{type:"preset", preset, parts}`; mỗi part là một phần chữ chỉnh riêng được, id thật là
  `<blockId>__<key>` nên `text_overrides` nhắm được từng phần. Cỡ chữ trong CSS mẫu viết
  bằng `em` để chụm 2 ngón phóng cả cụm cân đối.
- **Sơ đồ Mermaid:** sửa sơ đồ thì đồng bộ luôn bảng roadmap + text mô tả bên dưới.

## Phân quyền

- 🔐 **Admin** — `/admin`, cần `ADMIN_SECRET_TOKEN`
- 👤 **Customer** — quản lý thiệp qua UUID/slug
- 🌐 **Public** — landing page, trang thiệp `/your-slug`
