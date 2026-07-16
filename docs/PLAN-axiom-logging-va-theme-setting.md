# Kế hoạch: Log Axiom cho backend + Tab thiết lập Theme (font/màu chữ)

> Tài liệu này mô tả 2 hạng mục độc lập được triển khai cùng lúc:
> 1. Tích hợp log tập trung với **Axiom** cho toàn bộ Edge Function (backend).
> 2. Thêm **tab "Thiết lập theme"** (font + màu chữ) trong trình soạn thiệp, lưu vào cột `theme_setting` (JSON) của bảng `weddings`.

---

## Phần 1 — Log Axiom cho backend

### Bối cảnh
Backend là 5 Supabase Edge Function (Deno, TypeScript):

| Function          | File                                          | Runtime      |
| ----------------- | --------------------------------------------- | ------------ |
| `wedding-admin`   | `supabase/functions/wedding-admin/index.ts`   | `Deno.serve` |
| `guest-handler`   | `supabase/functions/guest-handler/index.ts`   | `Deno.serve` |
| `payment-handler` | `supabase/functions/payment-handler/index.ts` | `serve()`    |
| `ai-invitation`   | `supabase/functions/ai-invitation/index.ts`   | `Deno.serve` |
| `payos-webhook`   | `supabase/functions/payos-webhook/index.ts`   | `serve()`    |

Hiện chỉ dùng `console.log` / `console.error` rời rạc → khó tổng hợp, không truy vết được theo request. FE **không** cần log.

### Giải pháp
Tạo **1 module dùng chung** `supabase/functions/_shared/axiom.ts`, cả 5 function
import `../_shared/axiom.ts`. **Bắt buộc deploy bằng Supabase CLI** — CLI đi theo
import và tự bundle `_shared/` vào từng function. (Deploy qua Dashboard sẽ lỗi
`Module not found` vì nó chỉ đóng gói đúng thư mục function; nếu buộc dùng Dashboard
thì phải copy `axiom.ts` vào từng thư mục function và import `./axiom.ts`.)
File cung cấp:

- `createLogger(source)` → object `{ info, warn, error, flush }`. Mỗi lời gọi đẩy 1 event vào buffer (không gửi ngay để tránh chặn request).
- `withAxiom(source, handler)` → bọc handler `(req) => Response`:
  - Sinh `request_id` (uuid) cho mỗi request.
  - Log `request.start` (method, path, các query quan trọng: `resource`/`action`).
  - Đo thời gian, log `request.done` kèm `status`, `duration_ms`.
  - `try/catch` toàn bộ handler: nếu ném lỗi → log `request.error` (message + stack) rồi trả 500.
  - **Flush** buffer về Axiom trước khi trả response (ưu tiên `EdgeRuntime.waitUntil` nếu có; nếu không thì `await`), đảm bảo không mất log.

Gửi log bằng **Axiom Ingest HTTP API** (không cần thư viện):
```
POST https://api.axiom.co/v1/datasets/{AXIOM_DATASET}/ingest
Authorization: Bearer {AXIOM_TOKEN}
Content-Type: application/json
Body: [{ _time, level, source, message, ...fields }]
```

Mỗi function cũng nhận `log` để ghi thêm sự kiện nghiệp vụ (ví dụ `wedding.created`, `promo.checked`, `payment.webhook`, `ai.rate_limited`). Các `console.*` cũ được giữ nguyên (vẫn xuất ra log của Supabase) và bổ sung `log.*` ở các điểm quan trọng.

### Biến môi trường (Supabase secrets)
```
AXIOM_TOKEN=xaat-...        # API token có quyền ingest
AXIOM_DATASET=cuoixinh-backend
```
Nếu **thiếu** biến này, logger tự động **no-op** (không lỗi, không gửi) để môi trường dev/local vẫn chạy bình thường.

Đặt secret:
```bash
supabase secrets set AXIOM_TOKEN=xaat-xxxx AXIOM_DATASET=cuoixinh-backend
```

### Điểm cần lưu ý
- Không log dữ liệu nhạy cảm (token thanh toán, chữ ký webhook, key AI). Chỉ log metadata (mã đơn, trạng thái, độ dài input…).
- Dùng **1 file** `_shared/axiom.ts` cho cả 5 function → deploy bằng **Supabase CLI** (`supabase functions deploy <tên>`), CLI tự kéo `_shared/` vào bundle.

### Việc cần làm
- [x] `supabase/functions/_shared/axiom.ts`
- [x] Bọc `withAxiom` cho cả 5 function + thêm vài `log.*` nghiệp vụ.

---

## Phần 2 — Tab thiết lập Theme (font + màu chữ)

### Bối cảnh
- Trình soạn thiệp: `invitation-setup/index.html` + `invitation-setup/index.js`.
- Thanh điều hướng dưới cùng (`#bottom-nav-bar`) có các nút: Chỉnh sửa/Xem trước, **Cấu hình** (`switchTab('config')`), Khách mời, Lưu nháp, Xuất bản.
- Thiệp public render qua `renderWedding(w)` trong `public/themes/<theme>/index.js`, với `w` là bản ghi wedding.
- Chế độ xem trước: `public/themes/preview-data.js` đọc `sessionStorage.preview_data` rồi gọi `renderWedding`.
- Dữ liệu load về form qua `fillForm(data)`; lưu qua `weddingBL.updateWedding(payload)` (PATCH `wedding-admin`, truyền thẳng field → chỉ cần cột tồn tại là lưu được).

### Database
Thêm cột JSON `theme_setting` vào bảng `weddings`. Theo quy ước repo, thay đổi DB
được ghi thành changelog có phiên bản: **`changelogs/RC1.3/theme_setting.sql`**
(idempotent, `add column if not exists`) và cập nhật bảng lịch sử trong
`changelogs/README.md`. Áp dụng bằng cách dán vào Supabase → SQL Editor → Run.

### Schema `theme_setting`
```jsonc
{
  "heading_font": "Playfair Display",   // font tiêu đề (serif/display)
  "body_font":    "Be Vietnam Pro",     // font nội dung
  "heading_color": "#2d2d2d",           // màu tiêu đề
  "accent_color":  "#c0a062"            // màu nhấn (ngày tháng, số, đường kẻ)
}
```
Field rỗng/không có → giữ nguyên mặc định của theme. Danh sách font là **whitelist** các Google Font có hỗ trợ tiếng Việt (Playfair Display, Cormorant Garamond, Lora, Be Vietnam Pro, Montserrat, Nunito, Quicksand, Dancing Script…).

### Áp dụng theme (render)
Tạo helper dùng chung `core/helpers/theme-setting-helper.js`:
- `THEME_FONTS` — danh sách font (tên + loại heading/body).
- `applyThemeSetting(setting)`:
  - Nạp Google Font đã chọn (thêm `<link>` css2).
  - Chèn `<style id="theme-setting-override">` ghi đè:
    - **Font body**: `body` + `.font-inter` → `body_font`.
    - **Font heading**: `.font-cormorant, .font-playfair, .font-cinzel` → `heading_font` (giữ nguyên font script trang trí như allura/nautigal).
    - **Màu heading**: `.text-charcoal, .text-stone-custom-500, .text-stone-custom-400` → `heading_color`.
    - **Màu nhấn**: `.text-gold-400, .text-gold-300, .text-sage-400, .text-sage-300` → `accent_color`.
  - Chỉ ghi rule cho field có giá trị.

Gọi `applyThemeSetting(w.theme_setting)` ở **2 điểm** (bao trùm mọi theme, không phải sửa từng `renderWedding`):
1. `core/helpers/wedding-helper.js` → trong `loadWeddingData`, ngay trước `renderCallback(wedding)` (thiệp thật).
2. `public/themes/preview-data.js` → nhánh live preview, trước `renderWedding(data)`.

Include `theme-setting-helper.js` trong 3 theme (`romantic-gold`, `vintage-forest`, `basic-gold`) và trong trình soạn thiệp.

### Tab UI trong trình soạn thiệp
- **Nút nav mới** ngay cạnh nút "Cấu hình", `onclick="switchTab('theme')"`, biểu tượng là **chữ "A"** (để người dùng hiểu là font chữ). Nhãn: "Giao diện".
- **Panel mới** `#theme-panel` (giống bố cục `#config-panel`): 
  - Chọn **Font tiêu đề** và **Font nội dung** (dropdown, có preview tên font).
  - Chọn **Màu tiêu đề** và **Màu nhấn** (color input + vài swatch gợi ý).
  - Nút **"Khôi phục mặc định"**.
- `switchTab('theme')`: ẩn form/preview/config, hiện `#theme-panel`, gọi `_initThemePanel()`.
- `_setActiveTab` xử lý trạng thái active cho nút mới.

### Logic JS
- Biến toàn cục `_themeSetting = {}`.
- `fillForm`: đọc `data.theme_setting` (parse nếu là string) → `_themeSetting`.
- Đổi control → cập nhật `_themeSetting`, đánh dấu dirty, áp dụng **trực tiếp** vào iframe preview nếu đang mở (`iframe.contentWindow.applyThemeSetting(...)`).
- `_savePreviewData()`: thêm `data.theme_setting = _themeSetting` để khi mở tab Xem trước, iframe reload đọc đúng.
- Khi lưu (`saveDraft`/`publishWedding`): thêm `theme_setting` vào payload PATCH → lưu DB.
- `wedding-admin` POST: thêm `theme_setting` vào whitelist insert (để tạo mới cũng nhận được — tuy nhiên luồng chính vẫn set qua PATCH).

### Việc cần làm
- [x] Changelog DB `changelogs/RC1.3/theme_setting.sql` + cập nhật `changelogs/README.md` (áp dụng thủ công trên Supabase).
- [x] `core/helpers/theme-setting-helper.js`.
- [x] Hook vào `wedding-helper.js` + `preview-data.js`.
- [x] Include helper trong 3 theme + trình soạn.
- [x] Nút nav + `#theme-panel` trong `invitation-setup/index.html`.
- [x] Logic `switchTab('theme')`, `_initThemePanel`, load/save trong `invitation-setup/index.js`.
- [x] `wedding-admin` POST nhận `theme_setting`.

---

## Thứ tự triển khai
1. Phần 1 (Axiom) — độc lập, ít rủi ro.
2. Phần 2 — helper render → hook → UI → logic → backend field.
3. Kiểm thử: mở trình soạn, đổi font/màu, xem preview đổi ngay; lưu nháp; reload; kiểm tra log Axiom khi gọi API.
