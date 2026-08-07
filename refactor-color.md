# Refactor màu — gom toàn bộ màu về một file

> Mục tiêu giai đoạn 1: **mọi giá trị màu của project chỉ khai báo ở đúng một chỗ**
> (`styles/_colors.css`), tên biến bằng **tiếng Anh, theo vai trò** (`--navbar-bg`,
> `--btn-primary-bg`…). Không đổi giao diện — đây là refactor thuần, pixel giữ nguyên.

---

## 1. Hiện trạng

Màu đang nằm rải rác ở 6 nhóm nguồn, không nhóm nào là nguồn sự thật:

| Nguồn                                | Ví dụ                                                    | Số literal |
| ------------------------------------ | -------------------------------------------------------- | ---------- |
| `styles/_common.css` (`:root`)       | `--primary`, `--text-color-primary` — 7 biến duy nhất có | ~35        |
| `styles/tailwind-src.css` (`:root`)  | `--pink`, `--mauve`, `--pink-light`, `--pink-deep`        | ~60        |
| `styles/_setup.css`, `_ai-modal.css`, `_music-player.css` | hex thô trong từng rule             | ~116       |
| `tailwind.config.js` + `tailwind.themes.config.js` | bảng `colors` hex thô                      | ~44        |
| HTML: `index.html`, `theme-template/`, partials | `style="…"`, `bg-[#fce7f3]`, `<svg fill>`    | ~230       |
| JS: `core/*.js` (style tiêm động)    | `core/payment.js`, `alert.js`, `x-speech.js`, `utils.js`  | ~200       |

Hệ quả: cùng một màu bị viết 4 kiểu khác nhau (`rgb(255 183 202)`, `#ffb7ca`,
`--pink`, `--primary`), đổi tông chủ đạo phải sửa hàng trăm chỗ.

Trùng lặp đã phát hiện:

- `--primary` (`_common.css`) === `--pink` (`tailwind-src.css`) === `rgb(255 183 202)`
- `--text-color-primary` === `--mauve` === `rgb(173 122 135)`
- `#f43f5e` (11 lần) chính là `rose-500` của Tailwind; `#ec4899` = `pink-500`;
  `#1f2937`/`#e5e7eb`/`#f3f4f6`/`#6b7280` là thang `gray-*`.

---

## 2. Kiến trúc mới

### 2.1 Một file duy nhất

```
styles/_colors.css      ← NGUỒN SỰ THẬT DUY NHẤT cho mọi màu
```

Được `@import` ở **đầu `styles/_base.css`**, mà `_base.css` lại là import đầu tiên của
**cả hai** entrypoint (`tailwind-src.css` và `themes-src.css`) → một lần khai báo, hai
bản build cùng dùng.

### 2.2 Token đặt tên theo VAI TRÒ, lưu dạng kênh RGB

**Không có tầng "palette sắc độ".** Mỗi token mang đúng một vai trò trong giao diện;
tên nói thành phần nào / bộ phận nào, không nói màu gì.

```css
:root {
  --brand-primary-rgb: 255 183 202;   /* hồng chủ đạo */
  --text-heading-rgb: 90 58 69;       /* chữ tiêu đề */
  --btn-primary-bg: rgb(var(--action-primary-rgb));
  --tooltip-bg-rgb: 17 24 39;
}
```

Dùng: `var(--btn-primary-bg)`, hoặc pha alpha tại chỗ
`rgb(var(--brand-primary-rgb) / .4)`.

Vì sao lưu kênh chứ không lưu `#hex`: Tailwind cần dạng
`rgb(var(--x) / <alpha-value>)` thì `bg-primary/50`, `text-vintage-brown/70` mới chạy —
codebase **đang dùng** các modifier đó (`music-player.js`, `vintage-forest/index.html`…),
nếu nhét `#hex` vào config thì mất alpha modifier.

### 2.3 Quy ước dùng

| Nơi dùng                   | Viết thế nào                                  |
| -------------------------- | --------------------------------------------- |
| CSS thường                 | `color: var(--text-heading);`                 |
| CSS cần alpha              | `rgb(var(--pink-400-rgb) / 0.4)`              |
| Tailwind config            | `"rgb(var(--pink-400-rgb) / <alpha-value>)"`  |
| Class arbitrary trong HTML | `bg-[var(--card-bg)]`, `text-[color:var(--text-heading)]` |
| Arbitrary + alpha          | `bg-[rgb(var(--pink-400-rgb)/0.25)]` (không có dấu cách) |
| `style=""` inline / JS     | `style="color:var(--text-heading)"`           |

### 2.4 Quy ước đặt tên (tiếng Anh, theo chức năng)

```
--<thành-phần>-<bộ-phận>[-<trạng-thái>]
   btn-primary-bg-hover   tooltip-bg          music-widget-accent
   text-heading           timeline-dot        setup-input-border-focus
   state-error-text       chat-typing-dot     landing-cta-btn-from
```

Cấm đặt tên theo sắc độ (`--rose-400`, `--gray-100`). Cùng một giá trị mà hai nơi
dùng cho hai việc khác nhau thì tách thành hai token — để sửa "nút xoá" không kéo
theo "viền ô nhập sai".

Các nhóm trong file:

1. `Thương hiệu` — hồng chủ đạo và biến thể trạng thái
2. `Chữ` — heading / body / label / caption / title / placeholder…
3. `Nền & viền`
4. `Trạng thái` — success / error / warning / info / invalid
5. `Nút & điều khiển`
6. `Lớp phủ & đổ bóng`
7. `Thành phần` — nút, AI, trình phát nhạc, tooltip, trình chỉnh thiệp, bộ chọn
   ngày, xem trước thiệp, landing, chat, dòng thời gian, shimmer, màn bìa…
8. `Token dùng thẳng` — bản `rgb()` sẵn cho chỗ không cần alpha
9. `Thương hiệu bên thứ ba` — Facebook / Messenger / Zalo / WhatsApp / Google
10. `Bảng màu riêng của từng theme thiệp`

**Ngoại lệ có chủ ý:** nhóm 10 (`--card-gold-300-rgb`, `--card-vintage-brown-rgb`,
`--app-rose-pastel-100-rgb`) giữ tên theo thang màu, vì chính nó là **tên class
Tailwind** dùng trong markup thiệp (`bg-gold-300`, `text-vintage-brown/70`). Đổi tên
biến ở đây sẽ lệch với tên class mà người viết theme đang dùng. Đây cũng là bảng màu
**nhận dạng riêng của từng theme**, không phải màu hệ thống.

---

## 3. Phạm vi

### 3.1 Làm (giai đoạn 1)

- [x] `styles/_colors.css` — khai báo toàn bộ token
- [x] `styles/_base.css` — `@import "./_colors.css"` ở dòng đầu
- [x] `styles/_common.css` — bỏ block `:root` cũ, thay literal → token
- [x] `styles/tailwind-src.css` — bỏ `--pink/--mauve/--pink-light/--pink-deep`, thay literal
- [x] `styles/_setup.css`, `styles/_ai-modal.css`, `styles/_music-player.css`
- [x] `tailwind.config.js` + `tailwind.themes.config.js` — `colors` trỏ về token
- [x] `index.html`, `theme-template/index.html`
- [x] `invitation-setup/partials/*.html`, `invitation-setup/js/*`, `invitation-setup/loader.js`
- [x] `admin/*`, `public/account/*`
- [x] `core/*.js` — style tiêm động (`payment.js`, `alert.js`, `x-speech.js`, `x-undo.js`,
      `x-controls.js`, `utils.js`, `auth-ui.js`, `tooltip.js`, `guide-helper.js`,
      `share-social.js`, `qr-mobile-helper.js`, `render-helper.js`…)
- [x] `js/*.js` (landing page sections)
- [x] `public/themes/*` — literal trong markup thiệp

### 3.2 KHÔNG làm (cố ý, có lý do)

| Bỏ qua                                                            | Lý do                                                                                |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `THEME_PRESETS`, `swatches` trong `core/helpers/theme-setting-helper.js` | Là **dữ liệu người dùng chọn**, ghi thẳng xuống DB (`theme_setting`). Biến CSS không serialize được. |
| `_elBase` / `LINE_GRADIENT_*` / màu mặc định trong `invitation-setup/js/05-theme-panel.js` | Cùng lý do — giá trị mặc định lưu vào `theme_setting.elements`.        |
| `core/helpers/element-color-enum.js`, `text-preset-helper.js` (màu mặc định của mẫu) | Cùng lý do.                                                          |
| `core/email-template.html`                                        | Email client không hỗ trợ CSS custom property → bắt buộc hex thô.                     |
| Tham số thư viện: `colorDark`/`colorLight` của QRCode, `<meta name="theme-color">` | Nhận literal, không nhận `var()`.                              |
| `styles/build.css`, `styles/themes.css`                           | File build, sinh lại bằng `npm run build`.                                            |
| `router.html`                                                     | Trang chuyển hướng độc lập, KHÔNG nạp `build.css` → `var()` không resolve được.        |
| `#000` trong `mask-image` (`styles/_common.css`)                  | Là mốc độ sáng của mask, không phải màu giao diện.                                     |
| SVG placeholder trong `core/utils.js` (`createPlaceholderSVG`)    | Nhúng dạng `data:image/svg+xml` → biến CSS của trang không áp vào được.                |

---

## 4. Rủi ro & cách chặn

| Rủi ro                                                                 | Cách chặn                                                                          |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Tailwind purge ăn mất class arbitrary mới (`bg-[var(--x)]`)             | Viết trọn tên class, không ghép chuỗi — đúng quy tắc sẵn có trong `CLAUDE.md`.      |
| `bg-primary/50` mất alpha khi color là `var()` đặc                      | Dùng dạng kênh + `<alpha-value>` (mục 2.2).                                          |
| Arbitrary value có dấu cách bị Tailwind cắt                             | Viết `rgb(var(--x)/0.4)` **không dấu cách** trong class.                            |
| `@import` không chạy nếu không nằm đầu file                             | `_colors.css` import ở dòng đầu `_base.css`.                                        |
| Thiệp public không nạp `build.css`                                      | Token nằm trong `_colors.css` → `_base.css` → có mặt ở **cả** `themes.css`.         |
| Đổi nhầm giá trị khi thay hàng loạt                                    | Đối chiếu `styles/build.css` trước/sau: chỉ được khác ở chỗ hex → `var()`.          |

---

## 5. Các bước thực hiện

1. Tạo `styles/_colors.css`, import vào `_base.css`.
2. Chuyển 5 file CSS trong `styles/` sang token (bỏ hết `:root` rải rác).
3. Chuyển 2 file `tailwind*.config.js`.
4. Quét HTML/JS theo thư mục: `index.html` → `js/` → `core/` → `invitation-setup/` →
   `admin/` → `public/account/` → `theme-template/` → `public/themes/`.
5. `npm run build` (bắt buộc — không còn Play CDN), commit cả `build.css` + `themes.css`.
6. Kiểm tra còn sót: lệnh dưới phải chỉ còn các mục ở §3.2.

```bash
grep -rnoiE '#[0-9a-f]{3,8}\b|rgba?\([0-9]' \
  --include=*.css --include=*.html --include=*.js . \
  | grep -v node_modules | grep -v 'styles/build.css' \
  | grep -v 'styles/themes.css' | grep -v 'styles/_colors.css'
```

---

## 6. Giai đoạn sau (ngoài phạm vi lần này)

- Gom token trùng nghĩa (`--pink-400` vs `rose-pastel` của app) về một thang duy nhất.
- Đưa các palette `swatches`/preset về đọc từ cùng bảng token qua `getComputedStyle`
  để panel chọn màu và CSS không lệch nhau.
- Chế độ tối: chỉ cần override tầng 2 trong `@media (prefers-color-scheme: dark)`.
