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
- **Font tự host khai TẬP TRUNG ở `styles/_fonts.css`** (vào cả hai bản build) — thêm font
  chỉ bỏ file vào `assets/fonts/` rồi thêm một khối `@font-face`, tên họ = tên file viết hoa
  đầu từ (`moon-light.woff2` → `MoonLight`). Khai thừa không tốn gì: trình duyệt chỉ tải font
  được dùng tới.
- **Tránh `:not()` và `@apply hidden`** trong CSS thủ công: cssnano gộp/tráo đối số `:not()`
  thành rule rác LUÔN KHỚP (bản build khác hẳn bản nguồn, soi `styles/build.css` mới thấy).
  Cần loại trừ thì cho JS đặt một cờ class rồi nhắm theo cờ đó.
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
`STEP_PARTIALS` + thẻ mount, và `CX_STEPS` (`id` trùng `data-step`). Mẫu thiệp bỏ hẳn
một mục thì khai `CX_THEME.skipSteps` (vd `["family"]`) — `js/25-theme-decl.js` nạp
`index.js` của mẫu trong iframe rỗng để đọc bản khai rồi phát `cx-theme-decl`, thanh bước
tự vẽ lại; **đừng dựng danh sách tên mẫu trong trang Thiết lập**. `#step-nav` là cặp nút
NỔI (`fixed`) ngoài `<form>` — đưa nó vào luồng là ăn mất một dòng ở mọi bước.

**Vỏ trang** (`js/21-shell.js`) là **app shell: trang KHÔNG cuộn**. Ba thẻ nổi cùng khổ
(`max-w-4xl`) xếp dọc màn: thanh trên `#setup-topcard` · vùng nội dung `#setup-scroll` ·
navbar `#nav-card` — vỏ ngoài của cả ba chỉ trong suốt, đừng trả nền về cho nó. Chỉ
`#setup-scroll` cuộn, chiều cao = `100dvh − --cx-top-h − --nav-h − 32px` (hai biến do
`_cxSyncTopHeight` và `_syncNavHeight` đo, 32px là `my-4` của chính thẻ — đổi lề phải đổi
cả công thức). Muốn đưa phần tử vào tầm nhìn thì
`scrollIntoView` (tự tìm khung cuộn gần nhất) — **đừng dùng `window.scrollTo` /
`documentElement.scrollTop`**, trang không cuộn nên vô tác dụng. Phần tử NGOÀI khung nội
dung (chip ở thanh bước…) thì tự đặt `scrollLeft/scrollTop` cho đúng khung: `scrollIntoView`
cuộn lây cả khung cha, đủ để đẩy thanh trên ra khỏi màn.

Navbar dưới **fill động** (`cxNavReflow`): các mục khai ở `CX_NAV_ITEMS` đứng thẳng ở
`#nav-slots` khi còn chỗ, hết chỗ mới lùi dần vào popover `#nav-more-pop` (mục cuối lùi
trước); popover rỗng thì ẩn luôn nút "Tùy chọn" (`#nav-more-wrap`). Cấu hình `pin: true` nên
không bao giờ lùi. Cùng MỘT phần tử dùng cho hai chỗ, **hình dạng do cha quyết định** (xem
`.cx-navitem`) — đừng đổi class theo vị trí ở JS. Mục khuất trong popover thì trạng thái đang
mở + dấu * dội lên `#nav-more` (`_syncNavItemState` ở `js/04-nav-tabs.js`); popover neo và
kẹp theo `#nav-card` chứ không theo bề ngang màn hình.

Từ `sm` trở lên **mọi ô trong navbar đều khổ CỐ ĐỊNH**, chỗ thừa dồn hết vào `ml-auto` của
`#nav-actions` → dãy tab sát trái, "Lưu nháp"/"Xuất bản" sát phải; cho một ô `flex-1` là cả
hàng lệch. Phép đo chỗ trống dựa vào bề ngang tối thiểu của hàng, nên nhãn phải
`whitespace-nowrap` và ô nào cũng phải có khổ khai sẵn. Ẩn/hiện một nút trong navbar là đổi
chỗ trống → gọi lại `cxNavReflow()`.

**Xem trực tiếp** (`js/22-live-preview.js`): từ **820px** trở lên (iPad dựng đứng cũng có),
`#live-dock` là **dải cố định sát mép phải, NGOÀI vùng ứng dụng** — `<body>` chừa
`--cx-rail-w` nên thứ trong luồng tự hẹp lại, còn thứ `fixed` (navbar, `#step-nav`, các panel
toàn màn, `.ai-fab`) phải tự khai `right: var(--cx-rail-w)`, thiếu là tràn đè lên thiệp. Phần
dựng dải — và cả app shell ở trên — **khoá trong cờ `.cx-setup`** trên `<html>` của riêng
trang này: `build.css` dùng chung cho mọi trang, thiếu cờ là landing với my-invitations cũng
bị chừa lề phải và cấm cuộn. Dải CHỈ đi cùng tab Chỉnh sửa: tab khác đặt cờ `.cx-rail-off` (`_syncRail`) ép `--cx-rail-w` về 0
để panel chiếm trọn màn. Từ ngưỡng này cũng **không còn tab Xem trước** (nút ẩn,
`switchTab("preview")` tự về `edit`). Cập nhật bằng cách **tải lại iframe**, hẹn giờ từ
`_setDirty(true)` — mọi thay đổi đã đi qua đó nên đừng rải thêm listener, trừ ảnh (nằm ở
`pendingUploads`, ngoài `<form>`) phải tự gọi `cxLiveTouch()`. Thiệp dựng ở **khổ 390px như
máy thật** rồi thu bằng `--cx-scr-scale`. Cuộn tới mục đang chỉnh: gửi `{type:"cx-focus", key}`
(key = `data-step`), `core/helpers/preview-focus-helper.js` trong thiệp lo phần còn lại.

**Khung điện thoại `.cx-phone`** dùng ở HAI chỗ: dải xem trực tiếp và tab Xem trước
(`#cx-preview-stage`, mọi khổ màn — kể cả đang xem trên điện thoại thật). Vì hai khung cùng
nằm trong DOM, `--cx-ph-w`/`--cx-scr-scale` đặt **trên từng `.cx-phone`**, đừng đẩy lên
`:root`. Bề rộng dải là thuần CSS; còn tab Xem trước phải đo bằng JS (`cxPreviewFit`) theo
**ô nội dung** của khung chứa — `clientWidth/Height` tính cả padding, lấy thẳng là máy dính
sát mép. Máy có trần `CX_PHONE_MAX_W`: quá đó ô màn rộng hơn 390px, tức thiệp bị phóng to
hơn máy thật. Panel đang ẩn thì khổ bằng 0 nên `switchTab("preview")` phải gọi lại
`cxPreviewFit()` **sau khi** bỏ `.hidden`.

### Phiên bản & cache (GitHub Pages sau Cloudflare)

GitHub Pages ép `Cache-Control: max-age=600` và không đọc `_headers`. Chống bản cũ bằng
**`CX_VERSION` trong `core/config.js`**: hai `loader.js` nối `?v=<version>` vào mọi URL
partial/script chúng nạp.

- **Deploy là đổi `CX_VERSION`**, nếu không người dùng có thể nhận bản TRỘN — partial mới
  đi với script cũ là trang vỡ, không phải chỉ trông cũ.
- `config.js` nạp ở **bước mồi** đầu `boot()`, không mang `?v=`; đừng thêm vào `SCRIPTS`
  (thành nạp hai lần). Cloudflare **phải** bypass cache `/core/config.js`.
- `CONFIG` khai bằng `const` → binding lexical toàn cục, **không phải `window.CONFIG`**.
- `<link rel=stylesheet>` cùng origin được `config.js` nạp lại kèm `?v=` (bản có dấu tải
  xong mới gỡ thẻ cũ) → đổi `CX_VERSION` là CSS cũng đi theo. Riêng `<script>` viết cứng
  trong HTML thì không cứu được (đã chạy trước rồi) — sửa xong phải Ctrl+F5.

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

**Một mẫu = ĐÚNG 3 file trong `public/themes/<tên>/` + một hàng `templates` trong DB.**
Không sửa file dùng chung nào khác — chèn tên theme vào helper là làm hỏng quy ước này.

**Bắt đầu bằng cách chép `public/themes/base-theme/`** — mẫu nền có ĐỦ mọi mục, không bán
(không có hàng `templates`), mỗi mục là một khối gỡ rời được. Chức năng MỚI của sản phẩm
(bình luận, sổ lưu bút…) thêm vào mẫu nền + helper dùng chung; mẫu đã phát hành không phải
sửa gì vì không phải thiệp nào cũng cần. Tên thư mục **không được bắt đầu bằng `_`**:
GitHub Pages chạy Jekyll nên đường dẫn kiểu đó không được publish.

| File         | Vai trò                                                                   |
| ------------ | ------------------------------------------------------------------------- |
| `index.html` | Markup + thứ tự nạp script (`index.js` rồi `theme-boot.js` ở CUỐI)        |
| `index.js`   | **Chỉ khai báo**: `window.CX_THEME` + `renderWedding` + phần đặc thù       |
| `theme.css`  | Bảng màu `--cx-*` + CSS riêng. **CSS thuần**, nạp sau `styles/themes.css`  |

- **`window.CX_THEME`** là bản khai — nguồn sự thật duy nhất về mẫu:
  `swatches` (màu gợi ý trong bộ chọn màu), `reveal`, `focus` (id mục, chỉ khai cái khác
  mặc định), `suggest` (selector mục mà bảng đề xuất mẫu khác bung ra ở bản xem thử —
  mặc định `#section-gift`), `skipSteps` (bước mà trang Thiết lập KHÔNG hiện vì mẫu không
  vẽ mục đó — id trùng `CX_STEPS`), `onOpen`.
  Trang Thiết lập đọc `swatches` và `palette` **qua iframe xem trước** của tab Giao diện.
- **`CX_THEME.palette`** khai đúng những giá trị `:root` của `theme.css` dưới dạng hex —
  bản khai máy đọc được để trang Thiết lập hiện mục "Mặc định". Hai nơi lệch nhau thì
  bảng chọn hiện sai màu mà trang vẫn chạy, rất khó thấy → **`npm run check:palette`**
  đối chiếu, `-- --write` sinh lại. Sửa màu mẫu thì sửa `theme.css` rồi chạy lệnh này.
- `index.js` **bọc trong IIFE**, chỉ lộ `CX_THEME` + `renderWedding`: `const` cấp cao nhất của
  script cổ điển là biến toàn cục. Không tự chạy gì — `core/helpers/theme-boot.js` (nạp SAU)
  lo nạp dữ liệu, mở thiệp, hiệu ứng cuộn, viewport iOS; nó cũng cấp `cxEnabled`/`cxToggle`.
- **MỌI màu đi qua bộ token `--cx-*-rgb`** (mặc định ở `styles/_common.css`, mẫu ghi đè
  trong `theme.css`). Chữ: `heading` · `body` · `accent` · `accent-soft` · `on-accent` ·
  `on-image` · `on-lightbox`. Nền: `card-bg` · `page-bg` · `surface` · `band` · `panel` ·
  `panel-warm` · `cover` · `cover-mid` · `cover-veil` · `lightbox-bg`. Đường/bóng: `line` · `shadow` ·
  `scrim`. Trang trí: `deco` · `deco-soft` · `deco-2` · `deco-2-soft` ·
  `shine-from/mid/to`. Markup dùng lớp ngữ nghĩa tương ứng (`.cx-h` `.cx-t` `.cx-a`
  `.cx-a-soft` `.cx-border` `.cx-bg-line/surface/band/panel` `.cx-on-image` `.cx-lightbox`…).
  **Hard-code một mã màu = chỗ đó nằm ngoài bộ màu**, khách đổi tông sẽ thấy một mảng lạc
  lõng. Ngoại lệ: `mask-image` giữ `#000` (chỉ dùng kênh alpha) và `--cx-qr-bg-rgb` (máy
  quét cần nền sáng).
- Trong `_common.css`, **`.cx-a` phải đứng SAU `.cx-h`/`.cx-t`**: mẫu gắn cả `cx-h cx-a`
  lên một thẻ (tiêu đề tô màu nhấn), cùng độ đặc hiệu nên rule dưới thắng. `theme.css`
  của mẫu **chỉ khai `font-family`** cho `.cx-h`/`.cx-t`, khai thêm `color` là đè mất.
- **Helper không được nhắc token của một theme cụ thể.**
- Có **`#main-card`**; container các mục là **flex-column** (để chèn khối văn bản xen giữa).
- Bind dữ liệu qua **`setText(id, value)`** (`core/utils.js`) — `el.textContent =` sẽ không
  khoá được sửa text trực tiếp.
- Luồng: `applyThemeSetting` → `renderWedding` → `applyTextOverrides` → `applyCustomBlocks`
  → `applyElements` (theme chỉ cần cung cấp `renderWedding`).
- Chữ trang trí (chữ ký, chữ lồng) nên dùng **font tự host** khai ở `styles/_fonts.css`.
  Font là nét nhận dạng của mẫu nên KHÔNG có control nào đổi font toàn thiệp — khách muốn
  khác thì bấm thẳng vào dòng chữ đó trên thiệp mà chỉnh riêng.
- Muốn dùng **utility Tailwind mới** (font/màu chưa có) thì mới phải đụng
  `tailwind.themes.config.js` + `styles/_colors.css` — cách tránh: viết CSS thuần trong
  `theme.css`.
- Nên có: text thuần (không lồng icon) ở phần cho phép sửa.

**Thứ tự tải ảnh — mọi thẻ `<img>` phải khai rõ.** Ảnh thiệp chỉ nhận src SAU khi API trả dữ
liệu, nên trình duyệt không thấy chúng lúc quét HTML và không đoán được tấm nào quan trọng:
không khai thì ảnh dưới đáy trang tranh băng thông với ảnh đang hiện trên màn. Quy ước:

| Ảnh                                     | Khai                    |
| --------------------------------------- | ----------------------- |
| Ảnh của màn ĐẦU TIÊN khách thấy         | `fetchpriority="high"`  |
| Ảnh trong `#main-card` của theme CÓ bìa | (không gì) — **KHÔNG lazy** |
| Mọi ảnh còn lại                         | `loading="lazy"`        |

- "Màn đầu tiên" tuỳ mẫu: theme có bìa thì là `#cover-bg-img`, theme không bìa (`#main-card`
  không `display:none`) thì là `#main-photo`. Chỉ MỘT tấm được `high`.
- Ảnh trong `#main-card` của theme có bìa **không được lazy**: `#main-card` là `display:none`
  nên ảnh lazy chưa tải gì cả, bấm mở bìa mới bắt đầu tải → trống ảnh đúng lúc thiệp mở ra.
  Ảnh eager vẫn tải bình thường dù cha `display:none`, đó là điều mình cần.
- Ảnh lightbox (`#lb-img`) để yên: nó chỉ nhận src khi khách bấm.
- **Không bao giờ để `src=""`.** Chuỗi rỗng phân giải thành URL TRANG HIỆN TẠI → trình duyệt
  tải file HTML về, hiểu không nổi, vẽ icon vỡ kèm `alt` trong suốt lúc chờ dữ liệu. Đặt sẵn
  ảnh 1x1 trong suốt (`data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7`)
  làm src ban đầu. `<iframe src="">` của bản đồ thì để yên — nó có `#map-placeholder` lo phần
  chờ.
- **`renderCover`/`renderHero` phải gọi TRƯỚC `setupMusic`** trong `renderWedding`:
  `setupMusic` kéo YouTube iframe API (script bên thứ ba) về ngay khi chạy, để nó đi trước là
  ảnh màn đầu xếp hàng sau.

Quy ước này nhắm vào MỘT thứ: bớt số request tranh nhau ở cửa sổ tới hạn. Thứ chỉ đổi *thứ
tự* mà không bớt request (`preconnect`, `decoding`) đã thử rồi bỏ — chưa đo được lợi ích, mà
`preconnect` còn dễ phản tác dụng vì socket nhàn rỗi bị đóng trước lúc dùng. Muốn thêm lại
thì đo waterfall trước.

`base-theme` đã dựng sẵn đúng bộ này — chép nó thì khỏi phải nhớ.

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
`icon-only`, `full`, `icon="<tên icon lucide>"`, `label="…"`.

- Khi nạp, phần tử **tự thay mình bằng `<button>` thật** và bê hết attribute sang → DOM lúc
  chạy y như viết tay. Không khai `type` thì mặc định `type="button"`; nút submit phải ghi rõ.
- Trang mới phải **nạp `core/x-button.js`**, thiếu là nút không hiện.
- `variant="bare"` = chỉ thống nhất hình pill, không áp màu/khổ — dùng cho `public/themes/*`
  và các nút có CSS riêng.
- Cố ý **không** đổi những thứ chỉ trông giống nút: chấm carousel, thẻ tuỳ chọn AI, thanh
  phân đoạn, tab, hàng danh sách, thẻ điều hướng, nút nằm trong lòng control khác.

### Khác

- **Icon — thư viện lucide nạp từ CDN** (`unpkg.com/lucide@1.26.0`, pin + `integrity`; mọi
  trang có icon đều phải khai thẻ script này). Viết `<i data-lucide="tên"></i>`, tên lấy
  nguyên của lucide nên **không phải khai báo trước** — sai tên thì thẻ `<i>` nằm nguyên,
  kèm cảnh báo ở console. **lucide KHÔNG tự quét lại**: mọi chỗ chèn markup động phải gọi
  `window.lucide?.createIcons({ root: <thẻ vừa chèn> })` ngay tại chỗ, thiếu là mất icon.
  Cỡ icon: `svg.lucide` trong `build.css` ép `1em` (ăn theo `font-size` của cha, đó là cách
  `invitation-setup` dùng); muốn cỡ CỐ ĐỊNH thì phải là **inline style**
  (`style="width:16px;height:16px"`) — thuộc tính `width`/`height` thua quy tắc CSS kia.
  Hình lucide KHÔNG có (glyph ghép tay…) thì bỏ vào `CX_ICONS` ở
  `core/helpers/icon.js` rồi dùng `<i data-icon="tên">` — file này KHÔNG tự có ở mọi
  trang, trang mới dùng tới phải tự nạp (thẻ `<script>`, hoặc `SCRIPTS` ở loader).
- **Web components `x-*`:** `[name=X]` khớp `<x-input>` chứ không phải `<input>` con.
- **Thẻ nổi — luôn dùng `<x-popover>`** (`core/x-popover.js`, style `.x-pop*` ở
  `styles/_common.css`): tự neo theo nút mở (`anchor`), tự lật khi thiếu chỗ, kẹp trong
  `bound`, `arrow` để có mũi tên; đóng khi bấm ra ngoài / Esc / chọn một mục. Nạp danh
  sách bằng `setItems()`, hoặc appendChild phần tử thật (navbar Thiết lập làm vậy). Thẻ
  là `position: fixed` → cha có `transform/filter` sẽ kéo nó lệch. Nút mở đã có `onclick`
  riêng thì component KHÔNG gắn thêm click.
- **Dải segmented `.cx-seg`** (`styles/_common.css`): con trượt chạy theo hai biến `--n`
  (số nút) và `--i` (nút đang chọn), nút đang chọn thêm `.is-on` — JS chỉ đặt bấy nhiêu.
  Dùng cho vùng miền ở popup AI và các tab Nhà trai/Nhà gái.
- **Trình phát nhạc:** markup ở `core/components/music-player.js`, logic ở
  `music-player-helper.js` — theme chỉ đánh dấu vai trò bằng `data-cx-music="…"`.
- **Thành phần thả lên thiệp:** danh mục `core/helpers/element-helper.js`, runtime
  `theme-setting-helper.js`, bảng chọn `05-theme-panel.js`; lưu trong
  `theme_setting.elements` nên không cần changelog DB. Ô màu dùng khoá cố định ở
  `element-color-enum.js` (nạp TRƯỚC `element-helper.js`), số ô tối đa `EL_COLOR_SLOTS` phải
  có sẵn bấy nhiêu hàng chip trong `theme-panel.html` (Coloris chỉ bọc được input đã có
  trong DOM). `pin: true` → widget ghim theo màn hình, khi đó `y` là % chiều cao KHUNG NHÌN.
- **Chỉnh giao diện có ĐÚNG hai mức, không có mức ở giữa:** bộ màu (đổi cả thiệp) và
  chỉnh riêng một phần tử (bấm vào chính nó trên thiệp). Cố ý KHÔNG có control "font/màu
  tiêu đề–nội dung–nhấn–nền" cho toàn thiệp: nó chồng `!important` lên mọi thứ, và
  `background_color` ép nền trang lẫn thân thiệp về cùng một màu nên giết luôn bộ màu.
- **Bộ màu thiệp (`theme_setting.palette`):** danh mục ở `core/helpers/card-palette-helper.js`
  (**chỉ trang Thiết lập nạp** — thiệp lưu sẵn màu nên không cần danh mục), áp ở
  `applyThemeSetting` bằng cách đổ vào `:root { --cx-*-rgb }`, bảng chọn ở
  `05-theme-panel.js`. Lưu trong `theme_setting` nên **không cần changelog DB**. Thêm bộ
  mới phải qua **`npm run check:palette-contrast`** (nền sáng + đủ tương phản chữ/nền);
  `id` đã phát hành thì đừng đổi. Nút nhạc dùng bảng `--music-*` riêng nên
  `_cxPaletteRule` suy thêm bảng đó từ bộ màu — chỉ khi CÓ bộ, để thiệp không chọn bộ giữ
  nguyên hình thức cũ.
- **`palette.strength` (thanh "Độ đậm", 0–100):** mức **50 = đúng bộ đã khai** và
  `cxPaletteAtStrength()` trả về NGUYÊN object — đó là lý do thiệp cũ giữ y màu, nên đừng
  lưu `strength` khi đang ở 50. Kéo lên thì màu sáng rời xa trắng còn màu tối lún về đen;
  kéo xuống thì mọi màu cùng pha về trắng (kéo màu tối ngược trục đen sẽ đội trần 255 ở
  kênh mạnh nhất → lệch tông). **Nhóm nền (`CX_PALETTE_BG`) đi đường riêng:** nền thiệp
  cưới toàn tông rất nhạt, có ô đúng `#ffffff`, nhân khoảng cách tới trắng của chính nó thì
  chúng đứng yên — nên nhóm này được CỘNG thêm một đoạn theo hướng tông của bộ
  (`_cxTintVector`), cộng chứ không nhân nên chênh lệch giữa các lớp nền giữ nguyên. Chữ
  sáng nằm trên nền tối (`on_accent`/`on_image`/`on_lightbox`) cũng gần trắng nhưng CỐ Ý
  đứng ngoài nhóm đó — nhuộm chúng đậm lên là ăn mất tương phản. Nhạt quá thì chữ mất
  tương phản nên có **chốt WCAG** chỉ biết làm ĐẬM THÊM (`CX_PALETTE_GUARD`) — vì vậy mức
  50 trở lên chốt không đụng gì.
  `check:palette-contrast` cắt thẳng đoạn `[strength-math]` trong `theme-setting-helper.js`
  ra quét cả 21 mức: đổi phép tính thì đừng đổi tên hai dòng mốc đó.
- **Mẫu văn bản (preset):** danh mục + CSS ở `core/helpers/text-preset-helper.js` (nạp TRƯỚC
  `theme-setting-helper.js`), thêm mẫu chỉ sửa file đó. Lưu trong `custom_blocks` dạng
  `{type:"preset", preset, parts}`, id thật của part là `<blockId>__<key>`. Cỡ chữ viết bằng
  `em` để phóng cả cụm cân đối.
- **Khối cao "một màn" — luôn qua `--vh`, đừng dùng `dvh`/`svh` trần.**
  `core/helpers/vh-lock.js` (tự chạy khi nạp) khoá chiều cao một màn thành px: Chrome di
  động ẩn thanh URL bằng cách RESIZE webview nên với trang web đó là đổi khổ cửa sổ thật,
  `dvh`/`svh` đều tính lại theo và khối phình dần lúc vuốt. Viết
  `min-height: calc(var(--vh, 1vh) * 100)` rồi `calc(var(--vh, 1svh) * 100)` — thêm một
  dòng `100svh` trần sau đó là đè mất `--vh`. Trang mới cần thì tự thêm thẻ script (thiệp
  và trang chủ đã có); thiếu thì lùi về `1svh`, đúng khổ nhưng kém ổn định.
- **Sơ đồ Mermaid:** sửa sơ đồ thì đồng bộ luôn bảng roadmap + text mô tả bên dưới.
- **Dọn dẹp tự động (XOÁ HẲN dữ liệu):** thiệp chưa thanh toán và nháp bỏ quên bị cron xoá
  vĩnh viễn, thiệp hết hạn dùng thử bị khoá với khách mời. Số ngày ở `CONFIG.retention` **và**
  biến `RETENTION_DAYS` của Edge Function — hai nơi, đổi phải đổi cả hai. Đụng tới `expires_at`,
  hạn giữ dữ liệu hay màn khoá thì đọc `docs/cleanup-retention.md` trước.

## Phân quyền

- 🔐 **Admin** — `/admin`, cần `ADMIN_SECRET_TOKEN`
- 👤 **Customer** — quản lý thiệp qua UUID/slug
- 🌐 **Public** — landing page, trang thiệp `/your-slug`
