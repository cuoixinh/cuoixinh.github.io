# CuoiXinh — Wedding Invitation Platform

Website tạo thiệp cưới online. Vanilla JS (không framework), kiến trúc 3-layer.
Ngôn ngữ làm việc: **tiếng Việt**.

> **Phạm vi file này:** tóm tắt luồng project + các ràng buộc mà làm sai là hỏng/mất
> dữ liệu. KHÔNG phải lịch sử thay đổi, không chép lại chi tiết triển khai (thứ đó
> để ở comment cạnh code). Thay đổi thường chỉ sửa câu đang sai, không thêm mục mới.

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
my-invitations/          "Quản lý thiệp cưới" — lưới thẻ thiệp của khách + menu tài khoản
invitation-setup/        Trình tạo/chỉnh thiệp — index.html (vỏ) + loader.js + partials/ + js/
public/themes/           Các theme thiệp (romantic-gold, vintage-forest, basic-gold…)
core/                    Dùng chung: dal/ · bl/ · components/ · helpers/ · x-*.js (web components)
styles/                  Nguồn `_*.css` + 2 bản build (xem mục CSS)
assets/background/       Ảnh nền WebP do tab "Ảnh nền" của admin chụp ra
supabase/functions/      Edge Functions
changelogs/              Lịch sử thay đổi DB
cloudflare-worker/       Workers proxy/cache
```

**3-layer:** UI (render + events) → **BL** (validate, transform, rules) → **DAL** (query DB, API).
Không gọi thẳng UI → DAL khi có logic nghiệp vụ.

## Quy tắc bắt buộc

### Comment

- Nói **chức năng** (khối này làm gì, dùng ở đâu, ràng buộc khi dùng). **Không viết nhật ký
  thay đổi** ("trước đây…", "sửa X thành Y") — đó là việc của git log.
- Ngắn: đầu file ≤ 5 dòng, trước hàm 1–3 dòng. Không kẻ khung `====`, không lặp lại điều
  tên hàm/biến đã nói. Bỏ JSDoc chỉ liệt kê tham số hiển nhiên.
- Ràng buộc dễ vấp (thứ tự nạp, phải gọi cleanup, purge Tailwind…) ghi **một câu** tại chỗ.

### CSS

- Mặc định dùng **Tailwind utility class**. Không còn Play CDN →
  **sửa CSS xong phải `npm run build` và commit cả file build**.
- **Hai bản build riêng, không gộp được** (cùng tên màu nhưng khác giá trị):

  | Build    | Config                      | Nguồn → Kết quả                  | Trang dùng                                                                  |
  | -------- | --------------------------- | -------------------------------- | --------------------------------------------------------------------------- |
  | Ứng dụng | `tailwind.config.js`        | `tailwind-src.css` → `build.css` | `index`, `admin/`, `invitation-setup/`, `my-invitations/`, `theme-template/` |
  | Thiệp    | `tailwind.themes.config.js` | `themes-src.css` → `themes.css`  | `public/themes/*`                                                           |

- Thêm thư mục/trang mới → **thêm vào `content`** của config tương ứng, không thì bị purge.
- **Không ghép tên class từ chuỗi** (`` `bg-${c}` ``) — purge quét văn bản thô.
- CSS thủ công để ở `styles/_*.css` **top-level, không bọc `@layer`** (bị purge). `@import`
  chỉ chạy khi nằm đầu file. `@keyframes` đặt tên có tiền tố `cx-`.
- Giá trị tuỳ chỉnh: dùng **`px`**, bội số của **4**.

### Database (Supabase)

- **MCP chỉ để ĐỌC** (project `lcobawmkywtxhpezndsh`). Dùng `list_tables`/`execute_sql` để
  biết schema thật — changelogs là lịch sử, không phải nguồn sự thật.
- **Không sửa DB qua MCP.** Mọi thay đổi schema → script SQL **idempotent** trong
  `changelogs/RCx.y/` (minor cho thay đổi thường, major cho breaking + baseline mới),
  cập nhật bảng phiên bản ở `changelogs/README.md`, người dùng tự chạy ở Dashboard.

### `invitation-setup` — trang nạp DOM động

`loader.js` fetch `partials/*.html` rồi mới chèn script trong `js/`. Hệ quả:

- Thêm file JS → đăng ký vào `SCRIPTS` **đúng thứ tự**; thêm màn → partial + thẻ mount +
  mục trong `PARTIALS`. Chỉ tham chiếu được thứ khai ở file nạp trước hoặc cùng file.
- **Không dùng `DOMContentLoaded`** — dùng `window.__cxOnReady(fn)`. File trong `core/` cần
  nhánh dự phòng: `__cxOnReady` → `readyState` → gọi thẳng.

**Form đi theo BƯỚC** (`js/20-steps.js`): mỗi group là một bước, chỉ bước đang mở bỏ
`.hidden` — ô của bước khác vẫn trong DOM nên `FormData`/autosave không đổi. Chỉ ô
`[required]` mới CHẶN "Tiếp theo". **Thêm một bước phải sửa 3 chỗ**: file trong `steps/`,
`STEP_PARTIALS` + thẻ mount, và `CX_STEPS` (`id` trùng `data-step`). `#step-nav` là cặp nút
NỔI (`fixed`) ngoài `<form>` — đưa nó vào luồng là ăn mất một dòng ở mọi bước.

**Vỏ trang** (`js/21-shell.js`): hàng logo/breadcrumb tự thu khi cuộn, phải nằm chung khối
sticky `#setup-topbar` với thanh bước và thu bằng `grid-template-rows: 1fr→0fr`. Mỗi lần
thu/mở phải khoá một nhịp, không thì scroll bị kẹp và lật qua lại vô tận. Navbar dưới có
nút "Tùy chọn" (`#nav-more`) mở popover chứa Trợ lý AI + Giao diện.

**Xem trực tiếp** (`js/22-live-preview.js`): từ **1024px** trở lên, tab Chỉnh sửa có
`#live-dock` cạnh form chạy chính thiệp đang chỉnh, và **không còn tab Xem trước** (nút ẩn,
`switchTab("preview")` tự về `edit`). Cập nhật bằng cách **tải lại iframe**, hẹn giờ từ
`_setDirty(true)` — mọi thay đổi đã đi qua đó nên đừng rải thêm listener, trừ ảnh (nằm ở
`pendingUploads`, ngoài `<form>`) phải tự gọi `cxLiveTouch()`. Thiệp dựng ở **khổ 390px như
máy thật** rồi thu bằng `--cx-scr-scale`; thứ gì nổi bên phải (`#step-nav`, `.ai-fab`) phải
tránh dock qua `--cx-dock-w`. Cuộn tới mục đang chỉnh: gửi `{type:"cx-focus", key}`
(key = `data-step`), `core/helpers/preview-focus-helper.js` trong thiệp lo phần còn lại.

### Phiên bản & cache (GitHub Pages sau Cloudflare)

GitHub Pages ép `Cache-Control: max-age=600` và không đọc `_headers`. Chống bản cũ bằng
**`CX_VERSION` trong `core/config.js`**: hai `loader.js` nối `?v=<version>` vào mọi URL
partial/script chúng nạp.

- **Deploy là đổi `CX_VERSION`**, nếu không người dùng có thể nhận bản TRỘN — partial mới
  đi với script cũ là trang vỡ, không phải chỉ trông cũ.
- `config.js` nạp ở **bước mồi** đầu `boot()`, không mang `?v=`; đừng thêm vào `SCRIPTS`
  (thành nạp hai lần). Cloudflare **phải** bypass cache `/core/config.js`.
- `CONFIG` khai bằng `const` → binding lexical toàn cục, **không phải `window.CONFIG`**.
- Thẻ `<script>`/`<link>` viết cứng trong HTML KHÔNG được đóng dấu — sửa xong phải Ctrl+F5.

### Auth

- **`core/auth.js` (`window.CXAuth`) là nguồn sự thật DUY NHẤT.** Không tự parse
  `localStorage`, không tạo supabase client riêng.
  - `isLoggedIn()`/`getUserSync()` — trả lời ngay, dùng để **vẽ UI**.
  - `await getUser()`/`accessToken()` — **bắt buộc trước mọi thao tác GHI**.
  - `onChange(cb)` — theo dõi phiên đổi.
- Trang nào GHI dữ liệu phải nạp `core/auth.js` (kể cả iframe `guests/`), thiếu là 401.
  Trang thiệp public chỉ đọc nên không cần.
- `invitation-setup` hỏi qua cờ **`IS_LOGIN`**, đổi bằng `_syncLoginState()` — đừng gán thẳng.
- `IS_PUBLISHED` là **cờ dữ liệu, không phải quyền** — chức năng cần đăng nhập xét
  `IS_PUBLISHED && IS_LOGIN`.

### Theme thiệp mới (`public/themes/*`)

- Có **`#main-card`**; container các mục là **flex-column** (để chèn khối văn bản xen giữa).
- Bind dữ liệu qua **`setText(id, value)`** (`core/utils.js`) — `el.textContent =` sẽ không
  khoá được sửa text trực tiếp.
- Luồng: `applyThemeSetting` → `renderWedding` → `applyTextOverrides` → `applyCustomBlocks`
  → `applyElements` (theme chỉ cần cung cấp `renderWedding`).
- Dùng đúng bộ class font/màu mà `theme-setting-helper.js` nhắm; khác thì bổ sung vào
  `*_SELECTORS` / `_CX_BOUND_SEL` trong file đó.
- Đăng ký `THEME_PRESETS["<tên-theme>"]` trong `theme-setting-helper.js`; font/màu riêng vào
  `theme.extend` của `tailwind.themes.config.js` rồi `npm run build:themes`.
- Nạp `core/helpers/preview-focus-helper.js`, đặt `id` cho từng section và khai vào
  `CX_FOCUS_SEL` — thiếu thì chỉ mất tính năng cuộn, thiệp vẫn chạy.
- Nên có: text thuần (không lồng icon) ở phần cho phép sửa.

### Ảnh nền (tab "Ảnh nền" ở admin)

Admin dán **mã HTML** → Run xem trong iframe → **chụp** thành WebP → ghi xuống đĩa (không có
AI ở đây). Nền là **file tĩnh trong repo**, không phải dữ liệu DB → ghi xong **phải commit &
push**. HTML chỉ là bản vẽ trung gian, chỉ giữ nháp trong `localStorage`.

- Một nền = **một BỘ** nhiều biến thể khổ màn hình; web lấy bộ mới nhất rồi mới chọn biến
  thể, nên không bao giờ lệch desktop một nền mobile một nền.
- `manifest.json` là **nơi duy nhất** web đọc được danh sách nền → mọi thao tác ghi/xoá phải
  gọi `bgSyncManifest()`. Thêm chỗ dùng nền mới: thêm một mục vào `BG_SLOTS`.
- **Bất biến: iframe thấy gì thì ảnh chụp ra đúng thế.** `bgSnapshotFrame()` chụp DOM *sau
  khi script chạy*, `bgInlineAssets()` nhúng tài nguyên thành `data:` URI, `bgSanitizeHtml()`
  chỉ chạy trên bản chụp. Không có cách biết chắc script đã xong → chờ `fonts.ready` + vài
  nhịp vẽ; mã có hiệu ứng dài thì Run cho ổn định rồi hẵng chụp.
- ⚠️ Iframe **cố ý không khai `sandbox`** → **mã trong khung chạm được trang admin (kể cả
  `ADMIN_TOKEN`)**. Chỉ dán mã do chính mình viết.
- Chụp bằng `<foreignObject>`, sai một trong ba là ra ảnh trắng: tài nguyên phải là `data:`
  URI, HTML phải chuẩn hoá qua `DOMParser` + `XMLSerializer`, file SVG phải là `data:` chứ
  không phải `blob:`. Không dựng được: **font tải từ mạng, `backdrop-filter`,
  `mix-blend-mode`**.
- Trùng tên là **ghi đè** (có hỏi lại) — khác tab "Ảnh mẫu" vốn tự đánh số.

### Nút bấm — luôn dùng `<x-button>`

Mọi nút hành động viết bằng `<x-button>` (`core/x-button.js`), **không viết `<button>` tay**.
Pill cố định; khác nhau ở `variant` (`fill` · `outline` · `soft` · `ghost` · `overlay` ·
`bare`) × `tone` (`brand` · `neutral` · `danger`) × `size` (`xs` · `sm` · `md` · `lg`), thêm
`icon-only`, `full`, `icon="fas fa-…"`, `label="…"`.

- Khi nạp, phần tử **tự thay mình bằng `<button>` thật** và bê hết attribute sang → DOM lúc
  chạy y như viết tay. Không khai `type` thì mặc định `type="button"`; nút submit phải ghi rõ.
- Trang mới phải **nạp `core/x-button.js`**, thiếu là nút không hiện.
- `variant="bare"` = chỉ thống nhất hình pill, không áp màu/khổ — dùng cho `public/themes/*`
  và các nút có CSS riêng.
- Cố ý **không** đổi những thứ chỉ trông giống nút: chấm carousel, thẻ tuỳ chọn AI, thanh
  phân đoạn, tab, hàng danh sách, thẻ điều hướng, nút nằm trong lòng control khác.

### Khác

- **Web components `x-*`:** `[name=X]` khớp `<x-input>` chứ không phải `<input>` con.
- **Trình phát nhạc:** markup ở `core/components/music-player.js`, logic ở
  `music-player-helper.js` — theme chỉ đánh dấu vai trò bằng `data-cx-music="…"`.
- **Thành phần thả lên thiệp:** danh mục `core/helpers/element-helper.js`, runtime
  `theme-setting-helper.js`, bảng chọn `05-theme-panel.js`; lưu trong
  `theme_setting.elements` nên không cần changelog DB. Ô màu dùng khoá cố định ở
  `element-color-enum.js` (nạp TRƯỚC `element-helper.js`), số ô tối đa `EL_COLOR_SLOTS` phải
  có sẵn bấy nhiêu hàng chip trong `theme-panel.html` (Coloris chỉ bọc được input đã có
  trong DOM). `pin: true` → widget ghim theo màn hình, khi đó `y` là % chiều cao KHUNG NHÌN.
- **Mẫu văn bản (preset):** danh mục + CSS ở `core/helpers/text-preset-helper.js` (nạp TRƯỚC
  `theme-setting-helper.js`), thêm mẫu chỉ sửa file đó. Lưu trong `custom_blocks` dạng
  `{type:"preset", preset, parts}`, id thật của part là `<blockId>__<key>`. Cỡ chữ viết bằng
  `em` để phóng cả cụm cân đối.
- **Sơ đồ Mermaid:** sửa sơ đồ thì đồng bộ luôn bảng roadmap + text mô tả bên dưới.

## Phân quyền

- 🔐 **Admin** — `/admin`, cần `ADMIN_SECRET_TOKEN`
- 👤 **Customer** — quản lý thiệp qua UUID/slug
- 🌐 **Public** — landing page, trang thiệp `/your-slug`
