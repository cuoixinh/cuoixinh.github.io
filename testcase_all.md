# Bộ testcase toàn hệ thống CuoiXinh

Bộ testcase phủ toàn hệ thống, gồm cả kiểm thử tự động (auto) lẫn kiểm thử tay (manual). Nguồn
đối chiếu là mã hiện tại trên nhánh `staging-cuoixinh.github.io` (CX_VERSION `2026.09.24-05`).
Luật nghiệp vụ lấy thẳng từ code (Edge Function, BL, helper). Code đổi thì sửa đúng dòng
testcase tương ứng.

---

## 0. Cách dùng

### 0.1 Quy ước

| Cột      | Ý nghĩa                                                                                     |
| -------- | ------------------------------------------------------------------------------------------- |
| ID       | `<nhóm>-<số>`, không đổi số đã phát hành (chèn thêm thì dùng hậu tố `a`, `b`)                |
| Loại     | **AUTO✓** = đã có script chạy được · **AUTO→** = nên tự động hoá (ghi rõ cách) · **MAN** = test tay |
| Ưu tiên  | **P0** chặn phát hành (mất tiền/mất dữ liệu/lộ dữ liệu) · **P1** tính năng chính · **P2** phụ/hiển thị |

### 0.2 Môi trường & dữ liệu test

- **Chỉ test trên STAGING** (`staging.cuoixinh.com` hoặc `npm run dev` → cổng in ra lúc khởi
  động). Mở bằng Live Server / `python -m http.server` là đang chạm **production**.
- Staging không đọc qua cache (`STAGING_USE_CACHE = false`). Testcase về cache (nhóm `WK`,
  `M-CACHE`) phải bật tạm cờ đó, hoặc test trên production với dữ liệu riêng của đội.
- Biến dùng trong các lệnh curl bên dưới:

  ```bash
  EDGE=https://gmtnoxdwoumbtdmqmisk.supabase.co/functions/v1   # staging
  ANON=<anon key staging — core/config.staging.js>
  JWT_U1=<access_token của tài khoản test U1>   # lấy từ DevTools: await CXAuth.accessToken()
  JWT_U2=<access_token của tài khoản test U2>
  ADMIN=<ADMIN_SECRET_TOKEN staging>
  ```

- Tài khoản test: **U1** (chủ thiệp chính), **U2** (người lạ), **U3** (tài khoản đã đủ 5 thiệp).
- Dữ liệu dựng sẵn:
  - `W1`: thiệp của U1, đã xuất bản, đang dùng thử
  - `W2`: thiệp của U1, đã thanh toán
  - `W3`: thiệp của U1, hết hạn dùng thử
  - `W4`: thiệp chưa có chủ (`user_id` null)
  - khách mời `G1` (có tên hiển thị + xưng hô) thuộc `W1`
- Mã giảm giá test: `TEST10` (giảm 10%), `TEST100` (giảm 100%), `TESTMIN` (đơn tối thiểu cao
  hơn giá mẫu), `TESTEXP` (hết hạn), `TESTOFF` (đã tắt), `TEST1USE` (`max_uses = 1`).
- Thiết bị tối thiểu: iPhone Safari (iOS mới nhất), Android Chrome, Desktop Chrome, Desktop
  Safari/Firefox, iPad dựng đứng (820px).

### 0.3 Tổng quan độ phủ

| Nhóm                  | Phạm vi                                                           | AUTO✓ | AUTO→ | MAN |
| --------------------- | ----------------------------------------------------------------- | ----- | ----- | --- |
| AUTO-EX               | Script kiểm đang có (`check:*`, build, promote)                    | 10    | –     | –   |
| UNIT                  | Hàm thuần: slug, ảnh, làm sạch JSONB, chữ ký, ngày                 | –     | 20    | –   |
| API-WA / API-WR       | Edge Function `wedding-admin` (thiệp + mẫu, giá, mã giảm giá, YouTube) | –  | 68    | –   |
| API-PAY / API-WH      | `payment-handler`, `payos-webhook`, mã giảm giá                   | –     | 35    | –   |
| API-GH                | `guest-handler` (khách mời, RSVP, lời chúc)                       | –     | 30    | –   |
| API-AI                | `ai-chat`, `ai-invitation`, hạn mức AI                            | –     | 16    | –   |
| API-CL                | Cron `cleanup-weddings`                                           | –     | 10    | –   |
| WK                    | Cloudflare Worker (og, cache, image, templates, webhook proxy)    | –     | 18    | –   |
| E2E                   | Luồng xuyên suốt trên trình duyệt (Playwright)                    | –     | 14    | –   |
| M-*                   | Test tay giao diện/thiết bị/nghiệp vụ                              | –     | –     | 195 (M-CARD × 9 mẫu) |
| SEC                   | Bảo mật (ánh xạ `docs/security-checklist.md` A1–A21)              | 4     | 22    | 4 (+2 kết hợp) |

---

## 1. AUTO — Script kiểm đang có (chạy được ngay)

Chạy tất cả: `npm run check:config && npm run check:palette && npm run check:palette-contrast && npm run check:draft-sync`

Kết quả chạy ngày 2026-09-24: **tất cả PASS** (draft-sync 48/48).

| ID         | Lệnh                                           | Kiểm gì                                                                                                                  | Kỳ vọng                        | Loại  | Ưu tiên |
| ---------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------ | ----- | ------- |
| AUTO-EX-01 | `npm run check:config`                         | `config.staging.js` khai lại đủ khoá của mọi block bị đè; không còn trỏ project/worker production; `vars` của 2 `wrangler*.jsonc` khớp config | In `✓`, thoát 0                | AUTO✓ | P0      |
| AUTO-EX-02 | `npm run check:palette`                        | `CX_THEME.palette` (index.js) khớp `:root` (theme.css) của từng mẫu                                                     | "Khớp hết", thoát 0            | AUTO✓ | P2      |
| AUTO-EX-03 | `npm run check:palette-contrast`               | Mọi bộ màu đạt WCAG (4.5:1 chữ, 7:1 tiêu đề, 3:1 đồ hoạ) ở cả 21 mức "Độ đậm"                                           | "N bộ đều đạt", thoát 0        | AUTO✓ | P1      |
| AUTO-EX-04 | `npm run check:draft-sync`                     | 48 ca nháp máy ↔ tài khoản ↔ DB (nhóm A–G: gộp nháp, xuất bản, xoá, thanh toán, hạn giữ nháp, ảnh chờ upload, trần 5 thiệp) | `Tổng 48 \| FAIL 0`            | AUTO✓ | P0      |
| AUTO-EX-05 | `npm run build`                                | Build 2 file CSS (`build.css`, `themes.css`) không lỗi; `git diff` sau build rỗng (đã commit bản build)                  | Build xanh, không diff         | AUTO✓ | P1      |
| AUTO-EX-06 | `node scripts/deploy-public.mjs --dist --minify --yes` | Dựng `dist/`: chặn secret (service_role, `sbp_`, JWT role ≠ anon), `REDACT` khớp, mục `INCLUDE` tồn tại           | Thoát 0; `dist/` không có `admin/`, `supabase/`, `changelogs/` | AUTO✓ | P0 |
| AUTO-EX-07 | (sau AUTO-EX-06) `grep -rniE "service_role\|sbp_[0-9a-f]{40}\|sb_secret_" dist/` | Kiểm chéo secret lọt ra bản publish                                                         | Rỗng                           | AUTO✓ | P0      |
| AUTO-EX-08 | (sau AUTO-EX-06) `grep -rn "purgeSecret" dist/core/config.js` | `purgeSecret` bị REDACT thành `null`                                                                  | Chỉ thấy `purgeSecret: null`   | AUTO✓ | P0      |
| AUTO-EX-09 | `npm run production` (trên staging, cây bẩn / chưa đổi `CX_VERSION`) | Script promote CHẶN khi cây bẩn, lệch remote, `CX_VERSION` chưa đổi; liệt kê SQL/Edge Function trong đợt | Dừng với thông báo rõ          | AUTO✓ | P0      |
| AUTO-EX-10 | Nhóm lệnh ở `docs/security-checklist.md` §D    | Không gọi `/rest/v1/`; không nội suy `src="${` chưa escape; listener `message` có kiểm nguồn; script CDN có SRI           | Cả 4 lệnh đầu ra rỗng          | AUTO✓ | P0      |

---

## 2. UNIT — Hàm thuần (đề xuất tự động hoá)

**Cách làm:** theo đúng kiểu `scripts/check-draft-sync.mjs`. Cắt nguyên văn hàm từ file nguồn
bằng `fn(file, name)`, chạy trong `node:vm`, gom vào một `scripts/check-units.mjs`. Hàm `.ts`
thì chuyển mã bằng `sucrase` như lệnh §D của checklist.

| ID      | Hàm (file)                                                   | Đầu vào → Kỳ vọng                                                                                                                                            | Loại  | Ưu tiên |
| ------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----- | ------- |
| UNIT-01 | `validateSlug` (`core/bl/wedding-bl.js`)                     | `"Hoàng Lan"` → `hoang-lan`; `"Đức & Ánh!!"` → `duc-anh`; `"--a--b--"` → `a-b`                                                                               | AUTO→ | P1      |
| UNIT-02 | `validateSlug`                                               | Chuỗi 80 ký tự nhiều từ → ≤ 50 ký tự, cắt tại gạch nối; một từ dài 60 ký tự → cắt cứng 50                                                                    | AUTO→ | P2      |
| UNIT-03 | `validateSlug`                                               | Luỹ đẳng: `validateSlug(validateSlug(x)) === validateSlug(x)` với 50 chuỗi ngẫu nhiên có dấu                                                                 | AUTO→ | P1      |
| UNIT-04 | `validateSlug`                                               | `""`, `"!!!"`, `"   "` → ném lỗi                                                                                                                              | AUTO→ | P1      |
| UNIT-05 | `isValidSlug` (wedding-admin)                                | Hợp lệ: `a`, `an-binh`, `a1-b2`. Không hợp lệ: `-a`, `a-`, `An`, `a_b`, `a b`, chuỗi 81 ký tự                                                                 | AUTO→ | P0      |
| UNIT-06 | `isSafeImageRef` (wedding-admin)                             | Nhận: `null`, `""`, `cover-abc123.webp`, `https://gmtnoxdwoumbtdmqmisk.supabase.co/storage/v1/object/public/wedding-images/x.jpg`                            | AUTO→ | P0      |
| UNIT-07 | `isSafeImageRef`                                             | Chặn: `http://…` (không https), host lạ, `//evil.com/a.png`, `a" onerror="x`, `../x.jpg`, URL hợp lệ kèm `?x="`, số/đối tượng                                | AUTO→ | P0      |
| UNIT-08 | `cleanLoveStory`                                             | 12 phần tử → còn 10; khoá lạ bị bỏ; `content` > 2000 ký tự bị cắt; `image_url` xấu → `null`; `focal_point {x:500,y:"a"}` → `{x:100,y:50}`                    | AUTO→ | P0      |
| UNIT-09 | `cleanTimeline`                                              | `type` lạ → `ceremony`; `time` > 20 ký tự bị cắt; đầu vào chuỗi JSON hỏng → `null`                                                                            | AUTO→ | P1      |
| UNIT-10 | `payosValue` + `verifyWebhookSignature` (payos-webhook)      | Chữ ký tự tính theo quy ước PayOS (null → rỗng, mảng → JSON khoá đã sắp) khớp; đổi 1 ký tự amount → lệch                                                     | AUTO→ | P0      |
| UNIT-11 | `newOrderCode` (payment-handler)                             | 10.000 lần gọi liên tiếp: đủ 14 chữ số, ≤ `Number.MAX_SAFE_INTEGER`, không trùng                                                                             | AUTO→ | P1      |
| UNIT-12 | `clientIp` (`_shared/ai-rate-limit.ts`)                      | Có `cf-connecting-ip` → lấy nó; chỉ có `x-forwarded-for: 1.1.1.1, 2.2.2.2` → `2.2.2.2` (phần tử CUỐI)                                                        | AUTO→ | P0      |
| UNIT-13 | `sanitizeDevice`                                             | `"ABC-12345678"` → thường hoá; < 8 hoặc > 64 ký tự, có ký tự lạ → `""`                                                                                       | AUTO→ | P1      |
| UNIT-14 | `cardState` + `daysLeft` (`my-invitations/index.js`)         | Chưa xuất bản → `draft`; `expiresAt` null → `active`; còn 5 giờ → `trial`, `daysLeft = 1`; đồng hồ máy chậm → kẹp ≤ `CONFIG.trialDays`                      | AUTO→ | P1      |
| UNIT-15 | `cxPaletteAtStrength` (theme-setting-helper)                 | Mức 50 trả về NGUYÊN object (so bằng `===`); mức 0/100 không ra kênh ngoài 0–255                                                                            | AUTO→ | P1      |
| UNIT-16 | Chuyển âm lịch (`invitation-setup/js/09-lunar.js`)           | Đối chiếu 20 ngày mốc (Tết, tháng nhuận 2023/2025) với lịch vạn niên                                                                                         | AUTO→ | P1      |
| UNIT-17 | `safeExt` (`core/bl/image-bl.js`)                            | Đuôi suy từ MIME: `image/webp` → `webp`; MIME lạ → `jpg`; tên file mang `.php` không ảnh hưởng                                                                | AUTO→ | P1      |
| UNIT-18 | `escapeHtml` / `cxImgSrc` / `cxFocal` (`core/utils.js`)      | `<script>`, `"`, `'`, `` ` `` được escape; `cxFocal` ép số, chặn chuỗi CSS                                                                                   | AUTO→ | P0      |
| UNIT-19 | `weddingImageRefs` / `weddingFileNames` (`_shared/wedding-images.ts`) | Liệt kê đủ ảnh ở mọi cột `*_url`, `gallery_images`, `love_story[].image_url`; bỏ URL ngoài bucket                                                    | AUTO→ | P0      |
| UNIT-20 | Dò mã màu cứng trong theme                                   | `grep -nE "#[0-9a-fA-F]{3,6}\b" public/themes/*/theme.css` ngoài `:root`/`mask-image` → rỗng                                                                 | AUTO→ | P2      |

---

## 3. API — Edge Function (đề xuất tự động hoá)

**Cách làm:** mỗi dòng là một request tới staging, so status + khoá JSON. Viết thành
`scripts/check-api.mjs` (Node 22 có sẵn `fetch`). Script tự dựng dữ liệu, chạy rồi dọn bằng
`DELETE` với `x-admin-token`. Header chung: `apikey: $ANON`, `Authorization: Bearer <JWT hoặc $ANON>`.

### 3.1 `wedding-admin` — thiệp (API-WA)

| ID        | Kịch bản                                   | Request                                                                                       | Kỳ vọng                                                                                   | Ưu tiên |
| --------- | ------------------------------------------ | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------- |
| API-WA-01 | CORS preflight, origin hợp lệ              | `OPTIONS` với `Origin: https://staging.cuoixinh.com`                                          | 200, `Access-Control-Allow-Origin` = đúng origin, có `Vary: Origin`                      | P2      |
| API-WA-02 | CORS origin lạ                             | `OPTIONS` với `Origin: https://evil.com`                                                      | ACAO = `https://cuoixinh.com` (không phản chiếu origin lạ)                               | P1      |
| API-WA-03 | CORS localhost mọi cổng                    | `Origin: http://localhost:8123`                                                               | Phản chiếu đúng origin (cố ý — A21)                                                       | P2      |
| API-WA-04 | Tạo thiệp khi chưa đăng nhập               | `POST` `{manage_id:<uuid>}`, Bearer = ANON                                                    | 401 `AUTH_REQUIRED`                                                                        | P0      |
| API-WA-05 | Tạo nháp (draft flow)                      | `POST` `{manage_id:<uuid>, theme:"basic-gold"}`, JWT_U1                                        | 200 `{id, slug:"wedding-<8 ký tự đầu id>"}`, hàng có `user_id = U1`, `is_active = true`  | P0      |
| API-WA-06 | Thiếu cả slug lẫn manage_id                | `POST {}`                                                                                     | 400 `Missing slug`                                                                         | P1      |
| API-WA-07 | Slug sai định dạng khi tạo                 | `POST {slug:"An Binh"}`                                                                       | 400 `INVALID_SLUG`                                                                         | P1      |
| API-WA-08 | Slug trùng khi tạo                         | `POST {slug:<slug đã có>, manage_id:<uuid mới>}`                                              | 200, slug trả về có hậu tố `-2`, `-3`…                                                     | P1      |
| API-WA-09 | Trần 5 thiệp                               | U3 (đang có 5 thiệp `is_active`) `POST` thiệp mới                                             | 409 `WEDDING_LIMIT`, `limit:5`, không có hàng mới                                          | P0      |
| API-WA-10 | Thiệp `is_active=false` không tính vào trần | U3 tắt 1 thiệp (`PATCH is_active:false`) rồi `POST` thiệp mới                                 | 200                                                                                         | P1      |
| API-WA-11 | POST lặp lại cùng id, cùng chủ             | Gửi lại đúng request API-WA-05                                                               | 200 `{id, slug}` cũ (không 500, không tạo trùng)                                           | P0      |
| API-WA-12 | POST trùng id của người khác               | U2 `POST {manage_id:<id của W1>}`                                                             | 403 `FORBIDDEN`                                                                            | P0      |
| API-WA-13 | Admin tạo thiệp không cần JWT, không dính trần | `POST` với `x-admin-token`                                                                | 200                                                                                         | P2      |
| API-WA-14 | Đọc thiệp theo slug (công khai)            | `GET ?slug=<W1>` với ANON                                                                     | 200. Có trường render. KHÔNG có `user_id`, `expires_at`, `payment_status`, `payment_*`, `transaction_id` | P0 |
| API-WA-15 | Slug không tồn tại                         | `GET ?slug=khong-co-that`                                                                     | 404 `NOT_FOUND` (không 500)                                                                | P1      |
| API-WA-16 | Đọc theo id khi chưa đăng nhập             | `GET ?id=<W1>` với ANON                                                                       | 403 `FORBIDDEN`                                                                            | P0      |
| API-WA-17 | Đọc theo id bởi người lạ                   | `GET ?id=<W1>` với JWT_U2                                                                     | 403 `FORBIDDEN`                                                                            | P0      |
| API-WA-18 | Chủ đọc theo id                            | `GET ?id=<W1>` với JWT_U1                                                                     | 200, có `trial_locked:false`, `theme_locked:false`, không có `user_id`                    | P0      |
| API-WA-19 | Thiếu slug và id                           | `GET` không tham số                                                                           | 400                                                                                         | P2      |
| API-WA-20 | Thiệp hết hạn dùng thử — khách mời         | `GET ?slug=<W3>`                                                                              | 403 `TRIAL_EXPIRED`, chỉ kèm `groom_name`, `bride_name`, `theme`                          | P0      |
| API-WA-21 | Thiệp hết hạn — chủ mở trình chỉnh         | `GET ?id=<W3>` JWT_U1                                                                         | 200, `trial_locked:true`                                                                   | P0      |
| API-WA-22 | Thiệp đã thanh toán                        | `GET ?id=<W2>` JWT_U1                                                                         | `theme_locked:true`, `trial_locked:false`                                                  | P1      |
| API-WA-23 | Sửa thiệp khi chưa đăng nhập               | `PATCH {id:W1, groom_name:"X"}` ANON                                                          | 401 `AUTH_REQUIRED`                                                                        | P0      |
| API-WA-24 | Sửa thiệp người khác                       | `PATCH {id:W1,…}` JWT_U2                                                                      | 403 `FORBIDDEN`, dữ liệu không đổi                                                         | P0      |
| API-WA-25 | Sửa trường ngoài allowlist                 | `PATCH {id:W1, payment_status:"completed", expires_at:null, user_id:<U2>, payment_amount:0}`  | 200 nhưng DB KHÔNG đổi các cột đó (log `wedding.patch_fields_rejected`)                   | P0      |
| API-WA-26 | Tráo QR bằng URL ngoài hệ thống            | `PATCH {id:W1, groom_qr_url:"https://evil.com/qr.png"}`                                       | 400 `Ảnh không hợp lệ ở trường groom_qr_url`                                              | P0      |
| API-WA-27 | XSS qua tên file ảnh                       | `PATCH {id:W1, cover_image_url:"a\" onerror=\"alert(1)"}`                                     | 400                                                                                         | P0      |
| API-WA-28 | Album chứa URL xấu                         | `PATCH {gallery_images:["ok.jpg","javascript:alert(1)"]}`                                     | 400 `Ảnh không hợp lệ trong album`                                                         | P0      |
| API-WA-29 | Album > 10 ảnh                             | 11 tên file hợp lệ                                                                            | 400 `Tối đa 10 ảnh trong album`                                                            | P1      |
| API-WA-30 | Love story > 10 mốc                        | 11 phần tử                                                                                    | 400                                                                                         | P1      |
| API-WA-31 | Love story làm sạch                        | Phần tử có khoá lạ `onload`, `image_url:"x\"y"`, `content` 5000 ký tự                          | 200; đọc lại: khoá lạ mất, `image_url:null`, `content` 2000 ký tự                          | P0      |
| API-WA-32 | Love story sai kiểu                        | `love_story:"không phải json"`                                                                | 400 `Dữ liệu câu chuyện tình yêu không hợp lệ`                                             | P1      |
| API-WA-33 | Timeline làm sạch                          | `type:"<script>"`                                                                             | 200, đọc lại `type:"ceremony"`                                                             | P1      |
| API-WA-34 | Điểm lấy nét                               | `image_focal_points:{cover_image_url:{x:"50;background:url(x)",y:-9}}`                        | Lưu `{x:50,y:0}`                                                                            | P1      |
| API-WA-35 | Slug sai khi sửa                           | `PATCH {slug:"Abc"}`                                                                          | 400 `INVALID_SLUG`                                                                         | P0      |
| API-WA-36 | Slug trùng khi sửa                         | `PATCH {id:W1, slug:<slug của W2>}`                                                           | 409                                                                                         | P1      |
| API-WA-37 | Xuất bản lần đầu                           | Nháp `is_published:false` → `PATCH is_published:true`                                        | DB `expires_at ≈ now + 3 ngày`                                                             | P0      |
| API-WA-38 | Lưu lại thiệp đã xuất bản                  | `PATCH is_published:true` lần 2 (sau 1 phút)                                                 | `expires_at` KHÔNG đổi (không tự gia hạn dùng thử)                                         | P0      |
| API-WA-39 | Xuất bản thiệp đã thanh toán               | W2 `PATCH is_published:true` sau khi đã `false`                                               | `expires_at` giữ `null`                                                                     | P0      |
| API-WA-40 | Đổi mẫu sau khi thanh toán                 | W2 `PATCH theme:"romantic-gold"` (khác mẫu cũ)                                                | 409 `THEME_LOCKED`                                                                          | P0      |
| API-WA-41 | Gửi lại đúng mẫu cũ sau thanh toán         | W2 `PATCH theme:<mẫu hiện tại>, groom_name:"Y"`                                               | 200 (không khoá oan)                                                                        | P0      |
| API-WA-42 | Nhận chủ thiệp chưa có chủ                 | W4 `PATCH {id:W4, groom_name:"Z"}` JWT_U1                                                     | 200, DB `user_id = U1`, log `wedding.claimed`                                               | P1      |
| API-WA-43 | Xoá ảnh không thuộc thiệp                  | `PATCH {id:W1, deleted_images:["<file của W2>"]}`                                             | File của W2 vẫn còn trong bucket                                                           | P0      |
| API-WA-44 | Xoá ảnh thuộc thiệp                        | `deleted_images:["<file của W1>"]`                                                            | File bị xoá khỏi bucket                                                                     | P1      |
| API-WA-45 | Danh sách thiệp của tôi                    | `GET ?resource=my-weddings` JWT_U1                                                            | Chỉ thiệp của U1 có `is_active=true`, mới nhất trước, có `cover_image_url`, `expires_at`   | P0      |
| API-WA-46 | my-weddings chưa đăng nhập                 | ANON                                                                                          | 401                                                                                         | P1      |
| API-WA-47 | Xoá thiệp — người lạ / chưa đăng nhập      | `DELETE ?id=W1` với ANON rồi với JWT_U2                                                       | 401 rồi 403                                                                                 | P0      |
| API-WA-48 | Xoá thiệp chưa có chủ                      | `DELETE ?id=W4` JWT_U1                                                                        | 403 (chỉ admin xoá được)                                                                    | P0      |
| API-WA-49 | Chủ xoá thiệp                              | `DELETE ?id=W1` JWT_U1                                                                        | 200. Hàng mất, ảnh trong bucket mất, khách mời/lời chúc mất theo (cascade)                  | P0      |
| API-WA-50 | Danh sách admin                            | `GET ?list=true&page=1&limit=10&search=an` có/không `x-admin-token`                           | Có token: 200 kèm `pagination`. Không token: 401                                            | P1      |
| API-WA-51 | Tìm kiếm admin có ký tự filter             | `search=a,b)(or.slug.eq.x`                                                                    | 200, không lỗi 500, không chèn thêm điều kiện                                              | P1      |
| API-WA-52 | Method lạ                                  | `PUT`                                                                                         | 405                                                                                         | P2      |

### 3.2 `wedding-admin` — tài nguyên khác (API-WR)

| ID        | Kịch bản                                          | Request                                                                     | Kỳ vọng                                                                                                  | Ưu tiên |
| --------- | ------------------------------------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------- |
| API-WR-01 | Danh mục mẫu công khai                            | `GET ?resource=public-templates`                                            | 200, chỉ mẫu `is_active`, theo `sort_order`, mỗi mẫu có `price`/`originalPrice` (hoặc `null` nếu thiếu hàng giá) | P0 |
| API-WR-02 | Mẫu thiếu hàng giá                                | Tắt hàng `template_pricing` của 1 mẫu                                       | Mẫu đó `price:null` (không bịa giá); các mẫu khác vẫn có giá                                            | P0      |
| API-WR-03 | Quản lý templates cần admin                       | `GET/POST/PATCH/DELETE ?resource=templates` không token                     | 401                                                                                                       | P0      |
| API-WR-04 | Tìm nhạc YouTube                                  | `GET ?resource=youtube-search&q=a` rồi `q=tinh ca`                          | `q` 1 ký tự: 400. `q` hợp lệ: ≤ 8 kết quả có `id,title,url,thumbnail`                                    | P2      |
| API-WR-05 | Kiểm mã giảm giá hợp lệ                           | `GET ?resource=promo&code=test10`                                           | `valid:true`, `code:"TEST10"` (nhận chữ thường)                                                          | P1      |
| API-WR-06 | Mã có ký tự đại diện                              | `code=TES%25`, `code=T_ST10`                                                | `valid:false` (không dò tiền tố được — A5)                                                               | P0      |
| API-WR-07 | Mã hết hạn / hết lượt / đã tắt                    | `TESTEXP`, `TEST1USE` (đã dùng), `TESTOFF`                                  | `valid:false` với câu báo tương ứng; mã tắt báo như mã không tồn tại                                     | P1      |
| API-WR-08 | Mã có đơn tối thiểu                               | `code=TESTMIN&theme=<mẫu rẻ>`                                               | `valid:false`, `Đơn tối thiểu …`                                                                          | P1      |
| API-WR-09 | Sinh mã hàng loạt                                 | `POST ?resource=promo-codes` `{count:5, prefix:"qa", discount_type:"percent", discount_value:10}` | 5 mã, tiền tố `QA`, không có 0/O/1/I/L, chung `batch_id`                                | P1      |
| API-WR-10 | Sinh mã: giá trị sai                              | `discount_type:"x"`; `percent` 150; `discount_value:0`                      | 400                                                                                                       | P1      |
| API-WR-11 | Mã đơn tự gõ trùng                                | `mode:"single", code:"TEST10"`                                              | 400 `Mã TEST10 đã tồn tại`                                                                               | P2      |
| API-WR-12 | Giới hạn số lượng / độ dài                        | `count:500, length:30`                                                      | Chỉ sinh 200 mã, dài 12                                                                                   | P2      |
| API-WR-13 | Sửa mã không đổi được `used_count` / `code`       | `PATCH {id, used_count:0, code:"HACK", is_active:false}`                    | Chỉ `is_active` đổi                                                                                       | P1      |
| API-WR-14 | Xoá mã đã có đơn chốt                             | `DELETE ?id=<mã đã redeemed>`                                               | 409, mã còn nguyên                                                                                        | P0      |
| API-WR-15 | Xoá cả lô, một phần đã dùng                       | `DELETE ?batch_id=…`                                                        | 200 `{deleted:n, kept:m}`                                                                                 | P1      |
| API-WR-16 | AI điền mẫu (admin)                               | `POST ?resource=template-ai` rỗng; rồi có `template_name`                   | Rỗng: 400. Có: 200 với `display_name`, `description` ≤ 300, `category` hợp lệ, `sort_order` kế tiếp      | P2      |

### 3.3 `payment-handler` — tạo đơn (API-PAY)

Endpoint: `$EDGE/payment-handler/create-payment` (POST) · `/check-payment-status?order_id=` (GET).

| ID         | Kịch bản                                   | Request                                                                               | Kỳ vọng                                                                                                      | Ưu tiên |
| ---------- | ------------------------------------------ | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------- |
| API-PAY-01 | Chưa đăng nhập                             | ANON                                                                                  | 401 `AUTH_REQUIRED`                                                                                          | P0      |
| API-PAY-02 | Thanh toán thiệp người khác                | JWT_U2, `manage_id:W1`                                                                | 403 `FORBIDDEN`, không có hàng/đơn nào đổi (A2)                                                              | P0      |
| API-PAY-03 | Thiếu trường bắt buộc                      | Bỏ `customer_name`                                                                    | 400, `missing:["customer_name"]`                                                                             | P1      |
| API-PAY-04 | Không có số điện thoại vẫn tạo được        | Bỏ `customer_phone`                                                                   | 200 (SĐT không bắt buộc)                                                                                     | P1      |
| API-PAY-05 | Giá lấy từ DB, không từ client             | Gửi kèm `amount:1000`, `price:1`                                                      | `amount` trả về = giá `template_pricing` của theme                                                          | P0      |
| API-PAY-06 | Mẫu không có hàng giá                      | `theme:"base-theme"`                                                                  | 400, không gọi PayOS                                                                                         | P0      |
| API-PAY-07 | Giữ nguyên slug thiệp đã có                | W1 (slug `an-binh`) tạo đơn với `customer_name:"Nguyen Van C"`                        | Slug W1 vẫn `an-binh`                                                                                        | P0      |
| API-PAY-08 | manage_id mới (tạo thiệp qua đơn)          | `manage_id:<uuid mới>`                                                                | Tạo hàng mới, `user_id = người mua`, slug sinh từ tên (bỏ dấu, không trùng)                                 | P1      |
| API-PAY-09 | Trần 5 thiệp qua đường thanh toán          | U3, `manage_id:<uuid mới>`                                                            | 409 `WEDDING_LIMIT`                                                                                          | P0      |
| API-PAY-10 | Thiệp đã có, tài khoản đủ 5 thiệp          | U3 trả tiền cho 1 thiệp đang có                                                       | 200 (trần chỉ chặn tạo mới)                                                                                  | P0      |
| API-PAY-11 | Mã 10%                                     | `promo_code:"TEST10"`                                                                 | `amount = giá − round(giá×10%)`; `promo_redemptions` có 1 hàng `reserved`, hết hạn sau 5 phút                | P0      |
| API-PAY-12 | Gọi lại đúng đơn (retry)                   | Gửi lại cùng request (cùng order)                                                     | Không trừ thêm lượt                                                                                          | P1      |
| API-PAY-13 | Hai đơn liên tiếp cùng tài khoản có mã     | Tạo đơn 2 trong vòng 5 phút                                                           | 400 `pending_order` ("đang có một đơn chờ thanh toán")                                                     | P1      |
| API-PAY-14 | Mã sai / hết hạn / đã tắt / hết lượt / dưới đơn tối thiểu | Lần lượt từng mã                                                       | 400 với `reason` tương ứng; `used_count` KHÔNG tăng                                                          | P0      |
| API-PAY-15 | Tranh lượt cuối                            | `TEST1USE` còn 1 lượt, 5 request song song từ 5 tài khoản                             | Đúng 1 request được giảm giá, `used_count = 1`                                                               | P0      |
| API-PAY-16 | PayOS lỗi sau khi giữ lượt                 | Tạm đặt sai `PAYOS_API_KEY` trên staging                                               | 500, lượt được nhả (`released`), `used_count` về như cũ                                                      | P0      |
| API-PAY-17 | Mã 100% khi đã đăng nhập                   | `TEST100`, JWT_U1                                                                     | 200 không có QR; DB: `payment_status:completed`, `payment_amount:0`, `expires_at:null`, `transaction_id` bắt đầu `PROMO-`; mã `redeemed` | P0 |
| API-PAY-18 | Mã 100% không có user thật                 | (ca biên, nếu client gửi email thay JWT)                                              | 401 `promo_error:"login_required"`, lượt nhả                                                                 | P0      |
| API-PAY-19 | Kiểm trạng thái đơn                        | `check-payment-status?order_id=ORDER-…` trước / sau webhook                           | `pending` → `completed` kèm `manage_id`, `slug`, `transaction_id`, `payment_time`                           | P0      |
| API-PAY-20 | Kiểm trạng thái đơn không tồn tại / thiếu tham số | `order_id=ORDER-0`; không có `order_id`                                        | 404 `not_found`; 400                                                                                          | P2      |
| API-PAY-21 | returnUrl / cancelUrl                      | `Origin: https://evil.com`                                                            | URL trả về PayOS dùng miền hệ thống, không dùng evil.com (A13)                                              | P0      |
| API-PAY-22 | Đường lạ                                   | `POST /payment-handler/abc`                                                           | 404                                                                                                           | P2      |

### 3.4 `payos-webhook` + webhook proxy (API-WH)

Tự ký payload test bằng `PAYOS_CHECKSUM_KEY` của kênh **staging** (xem UNIT-10).

| ID        | Kịch bản                                          | Request                                                                               | Kỳ vọng                                                                                               | Ưu tiên |
| --------- | ------------------------------------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------- |
| API-WH-01 | Health check                                      | `GET`                                                                                 | 200 `status:"ok"`                                                                                     | P2      |
| API-WH-02 | Không có chữ ký, đơn chưa trả                     | `POST {data:{orderCode:<đơn pending>, amount:…}}`                                     | 401 `Invalid signature`, DB không đổi (A1)                                                           | P0      |
| API-WH-03 | Chữ ký giả                                        | `signature:"00…"`                                                                     | 401, log `payos.webhook_rejected`                                                                     | P0      |
| API-WH-04 | Chữ ký đúng, số tiền đúng                         | Payload ký chuẩn, `code:"00"`                                                         | 200. DB `completed`, `expires_at:null`, mã giảm giá `redeemed`, có hàng `payment_logs`                | P0      |
| API-WH-05 | Chữ ký đúng, số tiền lệch                         | `amount` = giá − 1000                                                                 | 400 `Amount mismatch`, DB không đổi                                                                    | P0      |
| API-WH-06 | Đơn có mã giảm giá                                | Kỳ vọng số tiền = `payment_amount` đã chốt (sau giảm), không phải giá niêm yết        | 200 khi gửi số sau giảm; 400 khi gửi giá niêm yết                                                     | P0      |
| API-WH-07 | orderCode không có trong DB                       | Ký chuẩn, `orderCode` lạ                                                              | 404, log `payos.wedding_not_found`                                                                    | P1      |
| API-WH-08 | Chữ ký lệch nhưng PayOS xác nhận PAID             | Payload thật, đổi thứ tự/giá trị làm chữ ký lệch, đơn đã PAID thật trên PayOS         | 200 `verifiedBy:payos_api`, log `payos.signature_mismatch`                                            | P0      |
| API-WH-09 | **Webhook lặp lại** (PayOS retry)                 | Gửi lại API-WH-04 hai lần                                                             | 200 cả hai lần; `payment_status` vẫn `completed`, không lỗi mã giảm giá (xem §9 NV-01)               | P0      |
| API-WH-10 | **Webhook "thất bại" đến sau webhook thành công** | Ký chuẩn, cùng orderCode, `code` ≠ `00`                                               | `payment_status` KHÔNG bị hạ về `failed` (xem §9 NV-01)                                              | P0      |
| API-WH-11 | Proxy Cloudflare thiếu biến đích                  | Deploy worker thử thiếu `SUPABASE_FUNCTION_URL`                                       | 500, không forward sang project khác                                                                  | P0      |
| API-WH-12 | Proxy chuyển tiếp                                 | POST qua `wrangler-webhook-staging` → Edge Function staging                           | Nhận đúng status của Edge Function; log Axiom có dấu vết                                              | P1      |
| API-WH-13 | Webhook cũ trong `payment-handler`                | `POST $EDGE/payment-handler/webhook` payload giả                                      | 401, không đổi DB (đường cũ vẫn mở — xem §9 NV-03)                                                    | P0      |

### 3.5 `guest-handler` — khách mời, RSVP, lời chúc (API-GH)

| ID        | Kịch bản                                     | Request                                                                                       | Kỳ vọng                                                                                     | Ưu tiên |
| --------- | -------------------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ------- |
| API-GH-01 | Danh sách khách — chưa đăng nhập             | `GET ?action=list&wedding_id=W1` ANON                                                         | 401                                                                                         | P0      |
| API-GH-02 | Danh sách khách — người lạ                   | JWT_U2                                                                                        | 403                                                                                         | P0      |
| API-GH-03 | Danh sách khách — thiệp chưa có chủ          | W4, JWT_U1                                                                                    | 403 (phải claim qua trang chỉnh sửa trước)                                                  | P1      |
| API-GH-04 | Chủ đọc danh sách theo bên                   | `&side=groom`                                                                                 | 200, chỉ nhà trai, theo `created_at` tăng dần                                               | P1      |
| API-GH-05 | Thông tin thiệp cho trang khách              | `?action=wedding`                                                                             | `slug`, `share_message_template`                                                            | P2      |
| API-GH-06 | Thêm 1 khách                                 | `POST ?action=insert-one {wedding_id, side:"groom", guest:{full_name:"A"}}`                   | 201                                                                                          | P1      |
| API-GH-07 | Thêm khách thiếu tên / side sai              | `full_name:""`; `side:"x"`                                                                    | 400                                                                                          | P1      |
| API-GH-08 | Trần 100 khách/bên                           | Bên đã có 100 khách, thêm 1                                                                   | 400 `Đã đạt giới hạn 100 khách`                                                             | P0      |
| API-GH-09 | Import không ghi đè, có trùng                | 10 dòng, 3 dòng trùng `full_name + display_name`                                              | `inserted:7, skipped:3`                                                                     | P1      |
| API-GH-10 | Import vượt trần (không ghi đè)              | Đang có 95, import 10 dòng mới                                                                | `inserted:5, capped:true`                                                                   | P0      |
| API-GH-11 | Import ghi đè                                | `overwrite:true`, 3 dòng trùng + 2 mới                                                        | Bản trùng cũ bị xoá, chèn 5; tổng tăng 2                                                    | P1      |
| API-GH-12 | Import ghi đè vượt trần                      | Tổng sau ghi đè > 100                                                                         | 409, KHÔNG chèn gì                                                                           | P0      |
| API-GH-13 | Import > 100 dòng / mảng rỗng                | 101 dòng; `[]`                                                                                 | 400                                                                                          | P1      |
| API-GH-14 | Import cắt độ dài                            | `full_name` 500 ký tự, `relationship` 300 ký tự                                               | Lưu 200 / 100 ký tự                                                                          | P2      |
| API-GH-15 | Sửa khách của thiệp khác                     | U2 `PATCH ?action=update-guest {id:<khách của W1>}`                                           | 403                                                                                          | P0      |
| API-GH-16 | Cập nhật link hàng loạt                      | 201 bản ghi; id không phải UUID; link > 2048 ký tự; id thuộc 2 thiệp khác nhau                | 400 ở cả bốn ca                                                                              | P1      |
| API-GH-17 | Xoá khách                                    | `DELETE {ids:[…]}` hợp lệ; > 200 id; id sai định dạng; id của thiệp khác                     | 200 `{deleted}`; 400; 400; 403                                                               | P0      |
| API-GH-18 | RSVP khớp khách                              | `POST ?action=rsvp {slug, name:<display_name G1>, relationship, attending:true, message}`     | 200 `matched:true`; DB `confirmed:"Có tham dự"`, có `confirmed_at`                           | P0      |
| API-GH-19 | RSVP không khớp                              | Tên lạ                                                                                         | 200 `matched:false`, không tạo khách mới                                                    | P1      |
| API-GH-20 | RSVP không tham dự / không lời nhắn          | `attending:false`, không `message`                                                            | `confirmed:"Không tham dự"`, `message` cũ giữ nguyên                                         | P2      |
| API-GH-21 | RSVP khớp không phân biệt hoa thường, khoảng trắng | `name:"  nguyễn văn a "`                                                                | `matched:true`                                                                               | P2      |
| API-GH-22 | Trùng tên, khác xưng hô                      | 2 khách tên "Lan": "Cô" và "Em"; RSVP với `relationship:"Em"`                                 | Cập nhật đúng hàng "Em"                                                                     | P1      |
| API-GH-23 | Gửi lời chúc hợp lệ                          | `POST ?action=wish {slug, name, relationship, text}`                                          | 201, `remaining:2`                                                                           | P0      |
| API-GH-24 | Lời chúc từ người không có tên trong danh sách | Tên lạ                                                                                       | 403 `Chỉ khách mời có thiệp riêng…`                                                          | P0      |
| API-GH-25 | Lời chúc thứ 4                               | Gửi 4 lần cùng khách                                                                          | Lần 4: 409                                                                                   | P1      |
| API-GH-26 | Lời chúc rỗng / quá dài                      | `text:""`; `text` 800 ký tự                                                                    | 400; lưu 500 ký tự                                                                           | P1      |
| API-GH-27 | Thiệp tắt lời chúc                           | `enable_wishes:false`                                                                          | 403                                                                                          | P1      |
| API-GH-28 | Danh sách lời chúc công khai                 | `GET ?action=wishes-list&slug=`                                                               | Chỉ có `id, name, relationship, text, at`; mới nhất trước; ≤ 200; KHÔNG có `link`, `confirmed`, `full_name` riêng | P0 |
| API-GH-29 | Chủ xoá lời chúc                             | `PATCH ?action=delete-wish {guest_id, wish_id}` bởi chủ; bởi U2                               | 200 trả `wishes` còn lại; 403                                                                | P1      |
| API-GH-30 | Hàng `wishes` hỏng                           | Đặt `wishes` = `"abc"` trong DB, rồi khách gửi lời chúc                                       | 201 (dữ liệu hỏng coi như rỗng, không chặn khách)                                           | P2      |

### 3.6 AI — `ai-invitation`, `ai-chat` (API-AI)

| ID        | Kịch bản                                    | Request                                                                   | Kỳ vọng                                                                                       | Ưu tiên |
| --------- | ------------------------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ------- |
| API-AI-01 | Method sai                                  | `GET ai-invitation`                                                       | 405                                                                                           | P2      |
| API-AI-02 | Body không phải JSON / thiếu mode           | `"abc"`; `{}`                                                              | 400                                                                                           | P1      |
| API-AI-03 | Tối ưu văn bản                              | `{mode:"optimize", inputType:"slogan", text:"…"}`                          | 200, văn bản mới                                                                              | P1      |
| API-AI-04 | Tối ưu văn bản quá dài                      | `text` > 800 ký tự                                                        | Bị cắt hoặc 400, không 500                                                                    | P2      |
| API-AI-05 | Tạo chuyện tình yêu                         | `{mode:"love_story", story:"…"}` (≤ 1500 ký tự)                            | Danh sách mốc hợp lệ (date/title/content)                                                     | P1      |
| API-AI-06 | Dữ liệu mẫu (admin)                         | `{mode:"sample"}`                                                         | 200 có `fields`; parse hỏng → 502                                                             | P2      |
| API-AI-07 | Hạn mức khách ẩn danh — ai-invitation       | 6 lần/ngày cùng IP + device                                               | Lần 6: 429 kèm `login:true`                                                                   | P0      |
| API-AI-08 | Hạn mức tài khoản — ai-invitation           | 16 lần/ngày JWT_U1                                                        | Lần 16: 429, không có `login`                                                                 | P1      |
| API-AI-09 | Hạn mức tài khoản — ai-chat                 | 31 lượt/ngày                                                              | Lượt 31: 429                                                                                  | P1      |
| API-AI-10 | Đếm riêng từng tính năng                    | Dùng hết 5 lượt chat ẩn danh rồi gọi optimize                             | Optimize vẫn chạy (bộ đếm `chat:` và `inv:` tách nhau)                                        | P1      |
| API-AI-11 | Giả `x-forwarded-for` để lách               | Đổi phần tử ĐẦU của `x-forwarded-for` mỗi lần                             | Vẫn bị chặn ở lần 6 (A10)                                                                     | P0      |
| API-AI-12 | Đổi device id nhưng giữ IP                  | Mỗi lần một `device` khác                                                 | Vẫn chặn theo IP                                                                              | P1      |
| API-AI-13 | Chat rỗng / tin quá dài                     | `messages:[]`; tin 1000 ký tự                                             | 400; tin bị cắt còn 800                                                                       | P1      |
| API-AI-14 | Chat stream                                 | `stream:true`                                                             | NDJSON trả dần; lỗi Gemini giữa chừng → câu báo thân thiện, log `chat.stream_failed`          | P1      |
| API-AI-15 | Xoay vòng key Gemini                        | Staging đặt 2 key, key 1 hết quota (429)                                  | Tự chuyển key 2; key 1 nghỉ 1 giờ                                                             | P1      |
| API-AI-16 | Hết mọi key                                 | Mọi key lỗi                                                               | 503 `Dịch vụ AI đang bận…`                                                                    | P1      |

### 3.7 Cron `cleanup-weddings` (API-CL)

| ID        | Kịch bản                                  | Request / dữ liệu                                                                       | Kỳ vọng                                                                   | Ưu tiên |
| --------- | ----------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ------- |
| API-CL-01 | Không có token                            | `POST` không `x-admin-token`                                                            | 401                                                                       | P0      |
| API-CL-02 | Token dọn dẹp riêng                       | Có đặt `CLEANUP_SECRET_TOKEN`: gọi bằng `ADMIN_SECRET_TOKEN`                            | 401 (không còn lùi về mã admin)                                           | P1      |
| API-CL-03 | `days` sai                                | `?days=0`, `?days=abc`                                                                  | 400                                                                       | P2      |
| API-CL-04 | Dry run                                   | `?dry_run=1`                                                                            | Liệt kê ứng viên, KHÔNG xoá                                               | P0      |
| API-CL-05 | Xoá thiệp chưa thanh toán quá hạn         | Thiệp `is_published`, chưa trả tiền, `expires_at` < now − 30 ngày                       | Bị xoá cả hàng lẫn ảnh; đếm `deleted_unpaid`                              | P0      |
| API-CL-06 | Không xoá thiệp đã trả tiền               | `payment_status:completed` hoặc `expires_at:null`, cũ bao nhiêu cũng được               | Còn nguyên                                                                | P0      |
| API-CL-07 | Không xoá thiệp mới hết hạn               | `expires_at` = now − 10 ngày                                                            | Còn nguyên                                                                | P0      |
| API-CL-08 | Xoá nháp bỏ quên                          | `is_published:false`, `updated_at` < now − 30 ngày                                      | Bị xoá; đếm `deleted_draft`                                               | P0      |
| API-CL-09 | Nháp vừa sửa                              | Nháp cũ nhưng mới `PATCH` (trigger đổi `updated_at`)                                    | Không bị xoá                                                              | P0      |
| API-CL-10 | Xoá ảnh lỗi                               | Ảnh không xoá được                                                                      | Giữ nguyên hàng (không mất dấu ảnh), log `cleanup.failed`                 | P1      |

---

## 4. WK — Cloudflare Worker (đề xuất tự động hoá bằng curl)

| ID    | Worker                   | Kịch bản                                                                                     | Kỳ vọng                                                                                                   | Ưu tiên |
| ----- | ------------------------ | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------- |
| WK-01 | og (`worker/index.js`)   | `curl -A "facebookexternalhit/1.1" https://<site>/<slug W1>`                                  | HTML có `og:title` (tên cô dâu chú rể), `og:image` trỏ `/__og/…`, `Cache-Control: public, max-age=300`   | P0      |
| WK-02 | og                       | Slug không tồn tại                                                                            | HTML chuyển hướng như `404.html`, `Cache-Control: no-store`, không lộ lỗi                                | P1      |
| WK-03 | og                       | Thiệp hết hạn dùng thử; thiệp nháp (`is_published=false`)                                     | Hết hạn: vẫn có thẻ với tên cặp đôi (màn khoá nằm trong trang thiệp). Nháp: không có thẻ riêng, như slug lạ | P1      |
| WK-04 | og                       | `/__og/../../x`, `/__og/a"b.jpg`                                                              | 404                                                                                                       | P0      |
| WK-05 | og                       | `/__og/<ảnh bìa hợp lệ>`                                                                      | 200 ảnh đã mã hoá lại (không còn EXIF), `immutable` 1 năm                                                | P1      |
| WK-06 | og                       | Path file tĩnh (`/index.html`, `/core/config.js`)                                             | Asset router trả thẳng, worker không can thiệp                                                            | P1      |
| WK-07 | og                       | Người thật mở `/<slug>`                                                                       | Chuyển tới trang thiệp đúng mẫu + `?slug=`                                                                | P0      |
| WK-08 | wedding-cache-proxy      | `GET ?slug=` hai lần                                                                          | Lần 2 hit cache (header/thời gian), TTL 300s                                                              | P1      |
| WK-09 | wedding-cache-proxy      | `GET ?id=`, `?list=true`, request có JWT/admin token                                          | KHÔNG cache (A7)                                                                                          | P0      |
| WK-10 | wedding-cache-proxy      | `PATCH` thiệp thành công rồi `GET ?slug=`                                                     | Thấy dữ liệu mới ngay (cache bị xoá)                                                                      | P0      |
| WK-11 | wedding-cache-proxy      | Worker staging và production                                                                  | KV namespace KHÁC nhau (xem `wrangler-staging.toml`)                                                      | P0      |
| WK-12 | image-proxy              | `/<tên file hợp lệ>`                                                                          | 200, cache 30 ngày                                                                                        | P1      |
| WK-13 | image-proxy              | `/%2e%2e%2fsecret`, `/a%22b.jpg`                                                              | 400 `Invalid filename` (A15)                                                                              | P0      |
| WK-14 | image-proxy              | Thiếu `STORAGE_BASE_URL`                                                                      | 500, không trỏ bucket khác                                                                                | P0      |
| WK-15 | templates-cache          | GET danh mục                                                                                  | Edge 7 ngày; trình duyệt `max-age=300` ở cả nhánh hit lẫn miss                                            | P1      |
| WK-16 | templates-cache          | `POST /purge` sai / đúng `X-Purge-Secret`                                                     | 401 / 200 và lần GET sau là bản mới                                                                       | P0      |
| WK-17 | deploy-workers           | `npm run deploy:workers:staging -- --dry-run`                                                 | Build 4 worker không lỗi                                                                                  | P1      |
| WK-18 | Header bảo mật (`_headers`) | `curl -I https://<site>/`                                                                  | Có CSP, `X-Frame-Options`/`frame-ancestors`, `Referrer-Policy`, `X-Content-Type-Options` (A9)            | P1      |

---

## 5. E2E — Luồng xuyên suốt (đề xuất Playwright)

Chạy trên staging (có Cloudflare Access thì dùng service token) hoặc `npm run dev`. Chromium có
sẵn ở `/opt/pw-browsers`. Mỗi luồng chụp ảnh màn cuối để so sánh.

| ID     | Luồng                                                                                                                              | Kỳ vọng chính                                                                     | Ưu tiên |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ------- |
| E2E-01 | Trang chủ tải → danh mục mẫu hiện, có giá → bấm "Xem trước" 1 mẫu                                                                    | Không lỗi console; bản xem thử mở đúng mẫu                                       | P0      |
| E2E-02 | Khách vãng lai: chọn mẫu → Thiết lập → điền bước "Cặp đôi" → tải lại trang                                                           | Dữ liệu còn (localStorage); thẻ nháp local ở Quản lý thiệp                      | P0      |
| E2E-03 | Đăng nhập OTP (hộp thư test) → nháp local được hỏi gộp → "Lưu vào tài khoản"                                                        | Thẻ chuyển `(db)`, bản local bị xoá                                              | P0      |
| E2E-04 | Đi hết 10 bước bằng "Tiếp theo", bỏ trống ô `[required]`                                                                            | Bị chặn đúng ở ô bắt buộc, ô đó được tô lỗi và cuộn tới                          | P1      |
| E2E-05 | Tải ảnh bìa + 3 ảnh album → Lưu nháp                                                                                                | Ảnh lên bucket (tên không chứa wedding_id), hiện ở bản xem trực tiếp            | P0      |
| E2E-06 | Xuất bản → popup "Kiểm tra thông tin" → Xuất bản                                                                                    | Thiệp mở được qua `/<slug>`, thẻ ở Quản lý thiệp "Còn 3 ngày dùng thử"          | P0      |
| E2E-07 | Thanh toán bằng `TEST100`                                                                                                           | Màn thành công, thẻ chuyển "đã kích hoạt", mẫu bị khoá trong Thiết lập           | P0      |
| E2E-08 | Tab Khách mời: thêm 2 khách, tạo link, mở link khách → RSVP → gửi lời chúc                                                           | Trang khách thấy trạng thái + lời chúc                                           | P0      |
| E2E-09 | Tab Giao diện: chọn bộ màu, kéo "Độ đậm", đổi hộp mừng cưới, đổi dạng lời chúc → Lưu                                                | Thiệp public phản ánh đúng; tải lại Thiết lập giữ lựa chọn                       | P1      |
| E2E-10 | Đổi slug ở Quản lý thiệp                                                                                                            | Link mới chạy, link cũ về 404                                                    | P1      |
| E2E-11 | Xoá thiệp ở Quản lý thiệp                                                                                                            | Thẻ mất; `/<slug>` báo không tìm thấy                                            | P0      |
| E2E-12 | Tài khoản U3 (5 thiệp) bấm "Tạo thiệp"                                                                                             | Bị chặn sớm ở client, câu báo "tối đa 5 thiệp"                                   | P1      |
| E2E-13 | Mở mọi mẫu trong `public/themes/*` ở chế độ xem thử (không `?slug=`)                                                                | Không lỗi console; không ảnh vỡ; không `src=""`                                  | P0      |
| E2E-14 | Chạy lại E2E-01, E2E-06, E2E-13 ở khổ 390×844 (mobile) và 1440×900 (desktop)                                                        | Không tràn ngang, không có nút bị che                                            | P1      |

---

## 6. MANUAL — Test tay theo module

### 6.1 Trang chủ (M-LP)

| ID      | Kịch bản                                          | Bước                                                                    | Kỳ vọng                                                                                   | Ưu tiên |
| ------- | ------------------------------------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------- |
| M-LP-01 | Màn mở đầu                                        | Mở `/` trên mobile + desktop                                            | Ảnh nền đúng bộ mới nhất trong `manifest.json`, đúng biến thể khổ màn, đúng điểm nhìn      | P1      |
| M-LP-02 | Khung điện thoại đảo ảnh mẫu                      | Chờ 10 giây                                                             | Ảnh chuyển mờ dần; dưới mốc ẩn cột thì không tải ảnh                                       | P2      |
| M-LP-03 | Dải "Mẫu thiệp"                                   | Vuốt ngang, bấm thẻ                                                     | Cuộn mượt, mép mờ đúng phía; vuốt không mở nhầm thẻ; bấm mở xem trước                      | P1      |
| M-LP-04 | Giá trên thẻ mẫu                                  | So với bảng `template_pricing`                                          | Đúng giá + giá gốc gạch; mẫu thiếu giá hiện "Liên hệ", nút mua bị khoá                    | P0      |
| M-LP-05 | Các mục Lợi ích / Tính năng / 4 bước / Đánh giá   | Cuộn hết trang                                                          | Màu thẻ đúng token, hiện dần khi cuộn tới, không nhảy bố cục                               | P2      |
| M-LP-06 | Navbar                                            | Chưa đăng nhập → đăng nhập                                              | Nút "Đăng nhập" đổi thành chip avatar + tên; ô đếm "Đã chọn" đúng số                      | P1      |
| M-LP-07 | Chặn zoom                                         | Chụm 2 ngón trên iPhone Safari                                          | Không zoom (có `no-zoom.js`)                                                               | P2      |
| M-LP-08 | Trợ lý XuXi ở trang chủ                           | Mở bong bóng, hỏi giá, hỏi mẫu phù hợp                                  | Trả lời theo danh mục thật, gợi ý đúng tên mẫu                                             | P1      |
| M-LP-09 | Chính sách, liên kết chân trang                   | Bấm từng link                                                           | Không có link chết                                                                         | P2      |
| M-LP-10 | SEO                                               | Xem `sitemap.xml`, `robots.txt`                                         | Có URL từng mẫu đang bán, không có `?slug=`                                               | P2      |

### 6.2 Đăng nhập (M-AUTH)

| ID        | Kịch bản                                  | Bước                                                                  | Kỳ vọng                                                                        | Ưu tiên |
| --------- | ----------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ------- |
| M-AUTH-01 | OTP email                                 | Nhập email → nhận mã → nhập đúng                                      | Đăng nhập, popup đóng, UI mọi trang đổi theo (`onChange`)                     | P0      |
| M-AUTH-02 | OTP sai / hết hạn / gửi lại               | Nhập sai 3 lần; chờ hết hạn; bấm gửi lại                              | Báo lỗi rõ, không khoá màn, gửi lại được                                       | P1      |
| M-AUTH-03 | Google                                    | Bấm "Google" → chọn tài khoản                                         | Quay về đúng trang đang đứng (redirect sau đăng nhập)                          | P0      |
| M-AUTH-04 | Email mẫu gửi OTP                         | Xem thư trên Gmail/Outlook, mobile/desktop                            | Hiển thị đúng `core/email-template.html`, mã dễ đọc                           | P2      |
| M-AUTH-05 | Đăng xuất                                 | Menu tài khoản → Đăng xuất                                            | Mọi tab cùng đổi trạng thái; nháp đã gộp không còn hiện khi đăng xuất          | P1      |
| M-AUTH-06 | Hết phiên giữa chừng                      | Xoá token trong DevTools rồi bấm Lưu                                  | Hỏi đăng nhập lại, dữ liệu form không mất                                      | P0      |
| M-AUTH-07 | Hồ sơ                                     | Quản lý thiệp → Hồ sơ → đổi tên                                       | Lưu được, chip avatar đổi tên                                                  | P2      |
| M-AUTH-08 | Đăng nhập trong iframe khách mời          | Mở tab Khách mời khi phiên hết hạn                                    | Không 401 im lặng; có lời nhắc đăng nhập                                       | P1      |

### 6.3 Mẫu thiệp & bắt đầu thiệp (M-TPL)

| ID       | Kịch bản                                   | Bước                                                                   | Kỳ vọng                                                                                     | Ưu tiên |
| -------- | ------------------------------------------ | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ------- |
| M-TPL-01 | Trang `/theme-template`                    | Mở, lọc theo danh mục, bấm yêu thích                                   | Lưới thẻ giống dải ở trang chủ (cùng component), lọc đúng                                   | P1      |
| M-TPL-02 | Xem thử mẫu trên desktop                   | Mở xem thử                                                             | Có khung điện thoại + chrome giả lập (quay lại · tên · menu), QR mở trên mobile góc màn     | P1      |
| M-TPL-03 | Xem thử mẫu trên mobile                    | Mở từ điện thoại                                                       | Thiệp chiếm trọn màn, có nút "Dùng mẫu này"                                                 | P1      |
| M-TPL-04 | Dùng mẫu khi chưa có nháp                  | Bấm "Dùng mẫu này"                                                     | Tạo nháp mới, vào thẳng Thiết lập với mẫu đó                                                | P0      |
| M-TPL-05 | Dùng mẫu khi đang có nháp dở               | Có nháp dở → bấm dùng mẫu khác                                         | Hỏi "Tiếp tục thiệp cũ / Làm với mẫu mới"; chọn nào đi đúng đường đó                        | P0      |
| M-TPL-06 | Nháp dở là thiệp đã xuất bản               | Bấm "Tạo thiệp"                                                        | Không đưa thiệp đã xuất bản vào hộp "đang viết dở"                                          | P1      |
| M-TPL-07 | Bảng đề xuất mẫu khác                      | Cuộn tới mục Hộp mừng trong bản xem thử                                | Bảng đề xuất bung đúng tại selector `suggest` của mẫu                                       | P2      |

### 6.4 Trang Thiết lập — vỏ trang & điều hướng (M-SHELL)

| ID         | Kịch bản                                 | Bước                                                               | Kỳ vọng                                                                                               | Ưu tiên |
| ---------- | ---------------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- | ------- |
| M-SHELL-01 | App shell không cuộn trang               | Cuộn ở mọi tab, mọi khổ màn                                        | Chỉ `#setup-scroll` cuộn; thanh trên + navbar đứng yên; không có thanh cuộn thứ hai                  | P1      |
| M-SHELL-02 | Navbar co giãn                           | Kéo hẹp cửa sổ từ 1440 xuống 360px                                 | Mục cuối lùi dần vào "Tùy chọn"; popover rỗng thì nút "Tùy chọn" ẩn; mục `pin` không bao giờ lùi     | P1      |
| M-SHELL-03 | Trạng thái mục khuất                     | Mở một tab đang nằm trong popover                                  | Nút "Tùy chọn" hiện trạng thái đang mở + dấu `*` khi có thay đổi                                     | P2      |
| M-SHELL-04 | Nút bước nổi                             | Qua lại các bước                                                   | "Quay lại/Tiếp theo" nổi, không ăn dòng nội dung; không đè thiệp ở dải xem trực tiếp                 | P1      |
| M-SHELL-05 | Thanh bước                               | Bấm chip bước ở xa                                                 | Nhảy đúng bước; chip tự cuộn vào tầm nhìn mà thanh trên KHÔNG bị đẩy ra khỏi màn                     | P1      |
| M-SHELL-06 | Mẫu bỏ bước (`skipSteps`)                | Chọn mẫu có `skipSteps:["family"]`                                 | Bước "Gia đình" biến mất khỏi thanh bước và popup kiểm tra                                           | P1      |
| M-SHELL-07 | Kéo để tải lại                           | Vuốt xuống ở đỉnh danh sách (mobile)                               | Hiện vòng tải lại; tải lại không mất dữ liệu chưa lưu (hoặc có hỏi)                                  | P2      |
| M-SHELL-08 | Gợi ý Trợ lý XuXi                        | Vào trang lần đầu                                                  | Sau 2 giây hiện gợi ý một lần; lần sau không hiện (`ai_hint_seen`)                                   | P2      |
| M-SHELL-09 | Đổi `CX_VERSION`                         | Deploy bản mới khi đang mở trang                                   | Tải lại nhận đủ partial + script + CSS mới (không bị trộn phiên bản)                                 | P0      |

### 6.5 Trang Thiết lập — nhập liệu từng bước (M-SET)

| ID       | Bước         | Kịch bản                                                                                            | Kỳ vọng                                                                                   | Ưu tiên |
| -------- | ------------ | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------- |
| M-SET-01 | Cặp đôi      | Nhập tên có dấu, emoji, 200 ký tự                                                                   | Hiện đúng trên xem trước; ô bắt buộc chặn "Tiếp theo" khi trống                          | P0      |
| M-SET-02 | Cặp đôi      | Nói để nhập (x-speech)                                                                              | Xin quyền micro; chữ tạm nhạt, chữ chốt đậm; "Dừng" chèn vào ô                           | P2      |
| M-SET-03 | Cặp đôi      | Hoàn tác / Làm lại trên ô văn bản                                                                   | Undo/redo đúng từng cụm gõ, giữ vị trí con trỏ                                            | P2      |
| M-SET-04 | Sự kiện      | Chọn ngày/giờ lễ bằng flatpickr                                                                     | Ngày âm tự điền đúng (so lịch vạn niên, có tháng nhuận)                                   | P0      |
| M-SET-05 | Sự kiện      | Bật "Lễ vu quy", nhập giờ + địa điểm                                                                | Mục hiện trên thiệp; tắt thì ẩn                                                           | P1      |
| M-SET-06 | Sự kiện      | Dán link Google Maps (dạng rút gọn, dạng embed, dạng iframe)                                         | Tách đúng link nhúng; link host lạ bị từ chối; bản đồ hiện ở thiệp                       | P0      |
| M-SET-07 | Sự kiện      | Đổi thứ tự hiển thị lễ/tiệc                                                                         | Thiệp theo đúng thứ tự                                                                    | P2      |
| M-SET-08 | Gia đình     | Dải Nhà trai/Nhà gái (`.cx-seg`)                                                                     | Con trượt chạy đúng; dữ liệu 2 bên không lẫn                                              | P1      |
| M-SET-09 | Tiệc cưới    | Tiệc nhà trai/nhà gái riêng ngày giờ địa điểm                                                        | Hiện đúng ở thiệp, ngày âm đúng                                                           | P1      |
| M-SET-10 | Ảnh cưới     | Tải ảnh bìa JPG 12MB, PNG, HEIC, WebP, GIF, AVIF, file 60MB, file .pdf                               | Ảnh được nén ≤ 1MB, cạnh ≤ 1920px; HEIC/PDF báo không hỗ trợ; > 50MB báo "File quá lớn"   | P0      |
| M-SET-11 | Ảnh cưới     | Album 10 ảnh rồi thêm ảnh 11                                                                         | Chặn ở 10                                                                                 | P1      |
| M-SET-12 | Ảnh cưới     | Đặt điểm nhìn (focal) cho ảnh bìa + ảnh album                                                        | Thiệp cắt ảnh theo đúng điểm nhìn                                                         | P1      |
| M-SET-13 | Ảnh cưới     | Xoá ảnh, đổi ảnh, rồi Lưu                                                                           | Ảnh cũ bị xoá khỏi bucket (qua `deleted_images`)                                          | P1      |
| M-SET-14 | Ảnh cưới     | Tải ảnh khi CHƯA đăng nhập                                                                          | Ảnh giữ trong IndexedDB; không gọi upload; đăng nhập + lưu lần đầu mới đẩy lên           | P0      |
| M-SET-15 | Ảnh cưới     | Ảnh nặng không nén được                                                                             | Cảnh báo "không nén được — nên đổi sang JPG"                                              | P2      |
| M-SET-16 | Lịch trình   | Thêm 10 mốc, thêm mốc 11, xoá, đổi thứ tự                                                           | Chặn ở 10; thứ tự lưu đúng                                                                | P1      |
| M-SET-17 | Chuyện tình  | Thêm mốc có ảnh; dùng "Tạo bằng AI" từ đoạn kể 1500 ký tự                                           | Mốc AI đổ vào form; ảnh mốc lưu đúng                                                      | P1      |
| M-SET-18 | Xác nhận dự  | Bật/tắt RSVP, sửa lời nhắn, bật/tắt lời chúc (`enable_wishes`)                                      | Thiệp ẩn/hiện đúng mục                                                                    | P1      |
| M-SET-19 | Hộp mừng     | Chọn ngân hàng bằng ô tìm kiếm, nhập STK, chủ TK, tải QR                                            | Tìm được theo tên viết tắt / không dấu; QR hiện ở thiệp                                  | P0      |
| M-SET-20 | Lời cảm ơn   | Sửa lời cảm ơn, dùng "Tối ưu" AI                                                                    | Văn bản mới thay vào; Hoàn tác đưa về bản cũ                                              | P2      |
| M-SET-21 | Nhạc         | Tìm YouTube, nghe thử, chọn; dán link YouTube; tải file nhạc                                       | Thiệp phát đúng bài; link sai định dạng báo lỗi                                           | P1      |
| M-SET-22 | Tắt mục      | Tắt từng `enable_*` (family, party, photos, timeline, love_story, music, gift, footer)              | Mục đó biến khỏi thiệp, dữ liệu vẫn giữ                                                   | P1      |
| M-SET-23 | Nhập Excel dữ liệu thiệp | Nhập file mẫu, map cột, xem trước                                                        | Đúng dữ liệu vào đúng ô                                                                   | P2      |
| M-SET-24 | Trợ lý XuXi dựng thiệp | Chat cung cấp thông tin → "Áp dụng vào thiệp"                                               | Các ô được điền, bước được bật đúng; thiếu trường thì hỏi tiếp                            | P1      |
| M-SET-25 | Đổi mẫu thiệp | Popup đổi mẫu khi chưa thanh toán; sau khi thanh toán                                               | Chưa trả tiền: đổi được, dữ liệu giữ nguyên. Đã trả: nút khoá, có giải thích (không mời bấm rồi báo lỗi) | P0 |

### 6.6 Tab Giao diện (M-THEME)

| ID         | Kịch bản                                         | Bước                                                                           | Kỳ vọng                                                                                          | Ưu tiên |
| ---------- | ------------------------------------------------ | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ | ------- |
| M-THEME-01 | Bộ màu                                           | Chọn từng bộ trong 10 bộ, rồi "Mặc định"                                       | Cả thiệp đổi tông (chữ, nền, viền, bìa, hoạ tiết); "Mặc định" về đúng `palette` của mẫu         | P1      |
| M-THEME-02 | Độ đậm                                           | Kéo 0 → 100                                                                    | 50 = đúng bộ gốc; kéo lên đậm, kéo xuống nhạt; nền thiệp cũng đổi; chữ luôn đọc được             | P1      |
| M-THEME-03 | Không lưu `strength` ở mức 50                    | Kéo về 50 rồi lưu, soi payload                                                 | `theme_setting.palette` không có `strength`                                                      | P2      |
| M-THEME-04 | Chỉnh một dòng chữ                               | Bấm vào một dòng trên thiệp → đổi font/cỡ/màu                                  | Chỉ dòng đó đổi; lưu vào `text_overrides`; tải lại vẫn giữ                                       | P1      |
| M-THEME-05 | Thêm khối văn bản (preset)                       | Kéo mẫu văn bản ra thiệp, thả giữa hai mục                                     | Vạch chèn đúng vị trí; cụm chữ phóng cân đối; sửa từng phần được                                 | P1      |
| M-THEME-06 | Hoạ tiết trang trí                               | Kéo hoa lên thiệp, xoay, phóng, xoá                                            | Thả đúng chỗ con trỏ (kể cả khi thiệp đang thu nhỏ); thanh chỉnh chỉ mờ chứ không dịch lúc kéo   | P1      |
| M-THEME-07 | Thành phần (widget)                              | Thả đồng hồ đếm ngược/lịch; bật `pin`                                          | Widget ghim theo màn khi cuộn; ô màu dùng đúng chip                                              | P2      |
| M-THEME-08 | Bấm ra ngoài thiệp                               | Chọn hoạ tiết rồi bấm vùng trống                                               | Bỏ chọn, bộ nút xoá/xoay biến mất                                                                | P2      |
| M-THEME-09 | Hộp mừng cưới                                    | Đổi Mặc định → "Không hộp" → từng mẫu hộp → lại Mặc định                       | Áp ngay không tải lại (trừ lượt về Mặc định sau khi hộp gốc đã mở → khung tự nạp lại)            | P1      |
| M-THEME-10 | Dạng lời chúc                                    | `live` / `comment` / `paged`                                                   | Xem trước đổi ngay; `comment`/`paged` nằm ngay TRÊN hộp mừng cưới                                | P1      |
| M-THEME-11 | Kiểu trình phát nhạc                             | Mở từng mẫu                                                                    | Đúng dạng khai trong `CX_THEME.music`; `basic-gold` là thanh ngang trên cùng                     | P2      |
| M-THEME-12 | Đặt lại                                          | "Đặt lại" (mức rộng nhất)                                                      | Hỏi lại trước; xoá bộ màu + chỉnh chữ + khối + hoạ tiết                                          | P1      |
| M-THEME-13 | Khoá mục nâng cao                                | Mục đang tắt (ví dụ Hộp mừng tắt) → mở bảng chỉnh tương ứng                    | Nói lý do rồi dừng, không mở bảng rỗng                                                           | P2      |
| M-THEME-14 | Tab Giao diện trên mobile                        | < 768px                                                                        | Khung máy fit chiều cao, thanh chỉnh ở dưới; kéo thanh cao lên thì máy lùn lại mà thiệp không tràn viền | P1 |
| M-THEME-15 | Cột chỉnh kéo đổi rộng (desktop)                 | Kéo `#theme-resize`                                                            | Ô mẫu co giãn theo, không vỡ lưới                                                                | P2      |

### 6.7 Xem trực tiếp & khung điện thoại (M-PREV)

| ID        | Kịch bản                                 | Bước                                                                    | Kỳ vọng                                                                                   | Ưu tiên |
| --------- | ---------------------------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------- |
| M-PREV-01 | Dải xem trực tiếp ≥ 820px                | Gõ vào một ô                                                            | Dải phải tải lại sau một nhịp; thiệp dựng khổ 390px rồi thu nhỏ                           | P1      |
| M-PREV-02 | Cuộn tới mục đang chỉnh                  | Chuyển bước Tiệc cưới                                                   | Xem trước tự cuộn tới mục tiệc                                                            | P2      |
| M-PREV-03 | Đổi ảnh                                  | Tải ảnh mới (nằm ngoài form)                                            | Xem trước cập nhật (qua `cxLiveTouch`)                                                   | P1      |
| M-PREV-04 | Dải chỉ đi cùng tab Chỉnh sửa            | Sang tab Giao diện / Khách mời                                          | Dải biến mất, panel chiếm trọn màn; về Chỉnh sửa thì dải hiện lại                        | P1      |
| M-PREV-05 | Không có tab Xem trước ≥ 820px           | iPad dựng đứng                                                          | Nút Xem trước ẩn; gọi tab preview tự về Chỉnh sửa                                         | P2      |
| M-PREV-06 | Tab Xem trước < 820px                    | Điện thoại                                                              | Máy giữ đúng tỉ lệ, không méo, không dính sát mép                                        | P1      |
| M-PREV-07 | Trang khác không bị chừa lề phải         | Mở trang chủ, Quản lý thiệp                                             | Không bị chừa lề phải, vẫn cuộn được (cờ `.cx-setup` chỉ ở trang Thiết lập)               | P0      |
| M-PREV-08 | Thành phần `fixed` không đè thiệp        | Ở ≥ 820px mở popup, AI fab, `#step-nav`                                  | Tất cả nằm trong vùng ứng dụng, chừa `--cx-rail-w`                                       | P1      |

### 6.8 Lưu nháp, xuất bản, đồng bộ (M-SAVE)

Nhiều ca ở đây đã có mô hình tự động trong `check:draft-sync` (AUTO-EX-04). Bên dưới là phần
phải kiểm trên trình duyệt thật.

| ID        | Kịch bản                                          | Bước                                                                 | Kỳ vọng                                                                                     | Ưu tiên |
| --------- | ------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ------- |
| M-SAVE-01 | Tự lưu                                            | Gõ rồi đóng tab, mở lại                                              | Dữ liệu còn                                                                                 | P0      |
| M-SAVE-02 | "Lưu nháp" khi đã đăng nhập                       | Bấm Lưu nháp                                                         | Toast thành công; `my-weddings` có thiệp; dấu `*` "chưa lưu" biến mất                       | P0      |
| M-SAVE-03 | "Lưu nháp" khi chưa đăng nhập                     | Bấm Lưu nháp                                                         | Mời đăng nhập; đăng nhập xong lượt lưu chạy tiếp, không mất dữ liệu                         | P0      |
| M-SAVE-04 | Xuất bản lần đầu                                  | Bấm Xuất bản                                                         | Popup kiểm tra (Bắt buộc / Tùy chọn + vòng tiến độ); bấm mục nào nhảy đúng bước đó          | P1      |
| M-SAVE-05 | Xuất bản thiếu mục tuỳ chọn                       | Bỏ trống Chuyện tình                                                 | Nút đổi thành "Vẫn xuất bản", không chặn                                                    | P2      |
| M-SAVE-06 | Nút sau khi đã xuất bản                           | Mở lại thiệp đã xuất bản                                             | Nhãn "Lưu & Xuất bản"; lưu nhiều lần KHÔNG gia hạn dùng thử                                 | P0      |
| M-SAVE-07 | Mất mạng khi lưu                                  | DevTools Offline → Lưu                                               | Báo lỗi; bật mạng lưu lại thành công; không tạo thiệp trùng                                 | P0      |
| M-SAVE-08 | Hai tab cùng một thiệp                            | Sửa ở tab 1, lưu; sửa ở tab 2, lưu                                   | Không mất trắng dữ liệu; hành vi khớp ca B6 của draft-sync                                  | P1      |
| M-SAVE-09 | Mở thiệp của người khác bằng `?id=`               | U2 mở `invitation-setup/?id=<W1>`                                    | Báo không có quyền, KHÔNG mở form trắng rồi lưu đè                                          | P0      |
| M-SAVE-10 | Thiệp hết hạn dùng thử                            | Mở W3 trong Thiết lập                                                | Vẫn sửa, lưu, xuất bản được; có dòng báo "đang khoá với khách mời, hãy thanh toán"          | P0      |
| M-SAVE-11 | Nháp local cũ > 30 ngày                           | Đặt `_savedAt` lùi 31 ngày, mở trang bất kỳ có `draft-retention.js`  | Nháp + ảnh IDB của nó bị dọn; nháp đang mở (`?id=`) thì không                               | P1      |

### 6.9 Quản lý thiệp cưới (M-MY)

| ID      | Kịch bản                                  | Bước                                                                     | Kỳ vọng                                                                                              | Ưu tiên |
| ------- | ----------------------------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- | ------- |
| M-MY-01 | Lưới thẻ                                  | U1 có nháp + dùng thử + đã kích hoạt + hết hạn                           | Mỗi thẻ đúng trạng thái, thumbnail là ảnh thật của khách (không phải ảnh mẫu)                        | P0      |
| M-MY-02 | Tab lọc                                   | Tất cả / Đã xuất bản / Nháp                                              | Đếm và lọc đúng                                                                                       | P1      |
| M-MY-03 | Ghi chú dùng thử                          | Thẻ còn 5 giờ                                                            | "Còn 1 ngày dùng thử — Thanh toán"                                                                   | P1      |
| M-MY-04 | Thẻ hết hạn                               | W3                                                                       | "Hết hạn dùng thử — kích hoạt để mở lại"; bấm "kích hoạt" mở thanh toán đúng thiệp                   | P0      |
| M-MY-05 | Ghi chú hạn giữ nháp                      | Thẻ nháp                                                                 | Có dòng "nháp giữ N ngày" đúng `CONFIG.retention`                                                    | P2      |
| M-MY-06 | Xem / Chia sẻ / Chép link                 | Bấm từng nút; mẫu có 2 bên → chọn Nhà trai / Nhà gái                     | Link đúng `/<slug>` (kèm bên nếu có); chép vào clipboard; popup chia sẻ đủ mạng xã hội              | P1      |
| M-MY-07 | Đổi slug                                  | Nhập có dấu, chữ hoa, trùng, rỗng                                        | Tự chuẩn hoá; trùng báo "đã được người khác sử dụng"; rỗng không cho lưu                             | P1      |
| M-MY-08 | Xoá thiệp                                 | Xoá thẻ DB; xoá thẻ nháp local                                           | Hỏi lại; DB: xoá vĩnh viễn; local: xoá kèm ảnh chờ trong IDB                                         | P0      |
| M-MY-09 | Gộp nháp local khi đăng nhập              | Có nháp local → đăng nhập → Lưu / Không / đóng hộp                       | Khớp ca A1–A6 của draft-sync; có dòng nhắc để lấy lại nháp đã bấm "Không"                           | P0      |
| M-MY-10 | Chạm trần khi gộp                         | U1 có 4 thiệp + 2 nháp local                                             | Hỏi trước theo số chỗ còn lại; nháp thừa không mất                                                   | P0      |
| M-MY-11 | Tạo thiệp mới                             | Nút "Tạo thiệp"                                                          | Đủ 5 thiệp thì chặn ngay kèm hướng dẫn xoá bớt                                                       | P1      |
| M-MY-12 | Trạng thái rỗng / lỗi mạng                | Tài khoản mới; mất mạng                                                  | Màn rỗng có nút tạo thiệp; lỗi mạng có nút thử lại                                                   | P2      |

### 6.10 Thanh toán (M-PAY)

Dùng kênh PayOS **staging** (tiền thật nhưng về kênh test), hoặc mã `TEST100` khi không cần QR.

| ID       | Kịch bản                                   | Bước                                                                     | Kỳ vọng                                                                                            | Ưu tiên |
| -------- | ------------------------------------------ | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- | ------- |
| M-PAY-01 | Mở `/checkout/`                            | Từ thẻ thiệp bấm Thanh toán                                              | Giá tra lại theo `theme` (tham số `price` trên URL chỉ là bản nháp), người mua lấy từ tài khoản    | P0      |
| M-PAY-02 | Sửa `price` trên URL                       | Đổi `price=1000`                                                         | Màn vẫn hiện giá DB; QR vẫn đúng giá DB                                                            | P0      |
| M-PAY-03 | Mẫu thiếu giá                              | Theme không có hàng giá                                                  | Hiện "Liên hệ", nút thanh toán khoá                                                                | P0      |
| M-PAY-04 | Áp mã giảm giá                             | `test10` → Áp dụng                                                       | Dòng giảm giá + tổng mới đúng; mã lỗi hiện câu báo cụ thể                                          | P1      |
| M-PAY-05 | Quét QR thật                               | Chuyển khoản đúng số                                                     | Trong ~3s sau khi PayOS báo, màn thành công; thẻ ở Quản lý thiệp chuyển "đã kích hoạt"             | P0      |
| M-PAY-06 | Hết giờ chờ                                | Không trả, đợi 5 phút                                                    | Màn hết giờ, có nút thử lại / huỷ                                                                  | P1      |
| M-PAY-07 | Huỷ trên PayOS                             | Bấm huỷ ở trang PayOS                                                    | Quay về đúng miền hệ thống; đơn không thành công                                                   | P1      |
| M-PAY-08 | Chuyển sai số tiền                         | Chuyển thiếu 1.000đ                                                      | Thiệp KHÔNG được kích hoạt; log `amount_mismatch`                                                  | P0      |
| M-PAY-09 | Thanh toán 100%                            | `TEST100`                                                                | Không hiện QR, thành công ngay                                                                     | P0      |
| M-PAY-10 | Đóng tab giữa chừng rồi mở lại             | Sau khi quét QR                                                          | Trạng thái đồng bộ đúng khi mở lại Quản lý thiệp                                                   | P1      |
| M-PAY-11 | Hai thiệp cùng mẫu                         | Đơn A đang chờ, thanh toán B                                             | Thành công gán đúng B (khớp ca E1–E2 draft-sync)                                                   | P0      |
| M-PAY-12 | Thanh toán từ trang chủ (`home-payment.js`) | Mua ngay từ thẻ mẫu                                                     | Cùng luật giá; cần đăng nhập                                                                        | P1      |
| M-PAY-13 | Thanh toán xong → kiểm thiệp               | Mở `/<slug>` sau khi trả                                                 | Thiệp mở vĩnh viễn (không có ngày hết hạn)                                                         | P0      |

### 6.11 Khách mời (M-GST) — `invitation-setup/guests/`

| ID       | Kịch bản                                  | Bước                                                                     | Kỳ vọng                                                                                   | Ưu tiên |
| -------- | ----------------------------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- | ------- |
| M-GST-01 | Truy cập tab                              | Thiệp chưa xuất bản / chưa đăng nhập                                     | Tab khoá (cần `IS_PUBLISHED && IS_LOGIN`), có giải thích                                  | P1      |
| M-GST-02 | Thêm khách                                | Thêm Nhà trai + Nhà gái                                                  | Link cá nhân hoá được tạo ngay                                                            | P0      |
| M-GST-03 | Tải file mẫu Excel → nhập                 | File 100 dòng; 101 dòng; file 6MB; file không phải Excel                 | 100 dòng ok; còn lại báo lỗi rõ                                                           | P1      |
| M-GST-04 | Map cột                                   | File cột lộn xộn, có dòng tên trống                                      | Xem trước đúng; dòng trống bị bỏ                                                          | P1      |
| M-GST-05 | Nhập trùng: bỏ qua / ghi đè               | Nhập lại cùng file                                                       | Báo số chèn / bỏ qua đúng                                                                 | P1      |
| M-GST-06 | Xuất danh sách                            | Xuất Excel từng bên                                                      | File mở được, có cột trạng thái xác nhận + lời nhắn + link                                | P2      |
| M-GST-07 | Tạo lại link                              | Đổi slug thiệp → "Tạo lại link"                                          | Mọi link mới theo slug mới                                                                | P1      |
| M-GST-08 | Chia sẻ link khách                        | Menu dòng → Chia sẻ / Chép                                               | Tin nhắn theo `share_message_template`, có tên khách                                      | P1      |
| M-GST-09 | Sửa / xoá khách                           | Menu dòng                                                                | Sửa tên ok; xoá hỏi lại                                                                   | P1      |
| M-GST-10 | Xem + xoá lời chúc                        | Khách có 3 lời chúc                                                      | Modal liệt kê theo thời gian; xoá 1 lời chúc biến khỏi thiệp                              | P1      |
| M-GST-11 | Phân trang                                | 100 khách                                                                | Chuyển trang đúng, skeleton khi tải                                                       | P2      |

### 6.12 Trang thiệp công khai (M-CARD) — chạy cho TỪNG mẫu

Làm cho cả 9 mẫu đang bán: `basic-gold`, `luminous-pastel`, `moody-cinematic`, `noir-elegance`,
`opulent-contrast`, `romantic-blush`, `romantic-gold`, `serene-parchment`, `vintage-forest`. Làm
thêm `base-theme` khi sửa helper dùng chung.

| ID        | Kịch bản                                   | Bước                                                                        | Kỳ vọng                                                                                              | Ưu tiên |
| --------- | ------------------------------------------ | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------- |
| M-CARD-01 | Mở bằng clean URL                          | `/<slug>`                                                                   | Chuyển về đúng mẫu + `?slug=`; không nháy trang 404                                                  | P0      |
| M-CARD-02 | Màn bìa → mở thiệp                         | Bấm mở                                                                      | Hiệu ứng `reveal` đúng; ảnh trong thiệp đã tải sẵn (không trống ảnh lúc mở)                          | P0      |
| M-CARD-03 | Dữ liệu đầy đủ                             | So từng mục với dữ liệu nhập                                                | Tên, ngày dương/âm, giờ, địa điểm, bố mẹ, album, lịch trình, chuyện tình, lời cảm ơn đúng            | P0      |
| M-CARD-04 | Dữ liệu tối thiểu                          | Thiệp chỉ có mục bắt buộc                                                   | Mục trống ẩn gọn, không có khung rỗng / "undefined" / `null`                                         | P0      |
| M-CARD-05 | Ảnh vỡ / chờ dữ liệu                       | Mạng Slow 3G                                                                | Không có icon ảnh vỡ; không `src=""`; ảnh màn đầu tải trước (`fetchpriority=high`)                   | P1      |
| M-CARD-06 | Bản đồ                                     | Bấm bản đồ / chỉ đường                                                      | Iframe hiện đúng chỗ; nút mở Google Maps đúng toạ độ                                                 | P1      |
| M-CARD-07 | Lịch                                       | Bấm "Thêm vào lịch"                                                         | Sự kiện đúng ngày giờ (Google/Apple Calendar)                                                        | P2      |
| M-CARD-08 | Album + lightbox                           | Bấm ảnh, vuốt, Esc                                                          | Mở lightbox, vuốt qua lại, đóng được; màu nền theo token `lightbox-bg`                              | P1      |
| M-CARD-09 | Nhạc                                       | Lần chạm đầu tiên; tắt/bật                                                  | Phát sau tương tác (chính sách autoplay); nút đúng dạng của mẫu                                     | P1      |
| M-CARD-10 | Hộp mừng cưới                              | Mở hộp, xem QR 2 bên, chép STK                                              | QR đúng ảnh đã tải; chép STK được; "Không hộp" thì QR hiện thẳng                                    | P0      |
| M-CARD-11 | Link khách cá nhân                         | Mở link của G1                                                              | Lời mời đúng tên + xưng hô                                                                           | P0      |
| M-CARD-12 | Link khách bị sửa tay                      | Sửa tham số mã hoá                                                          | Không vỡ trang; RSVP/lời chúc bị server từ chối                                                      | P1      |
| M-CARD-13 | Bộ màu tuỳ chỉnh                           | Thiệp có `palette` + `strength`                                             | Toàn bộ màu theo bộ, không có mảng lạc tông (mã màu cứng)                                           | P1      |
| M-CARD-14 | Chỉnh riêng chữ / khối / hoạ tiết / widget | Thiệp đã chỉnh ở tab Giao diện                                              | Hiện y như bản xem trước; hoạ tiết đúng vị trí ở mọi khổ màn                                        | P1      |
| M-CARD-15 | noindex                                    | Xem nguồn trang có `?slug=`                                                 | Có `<meta name="robots" content="noindex">`; bản mẫu (không `?slug=`) thì KHÔNG                      | P0      |
| M-CARD-16 | QR mở trên mobile (desktop)                | Mở thiệp trên desktop                                                       | Thẻ QR nổi góc màn, thu gọn được                                                                    | P2      |
| M-CARD-17 | Khổ màn "một màn" ổn định                  | Android Chrome: vuốt ẩn/hiện thanh URL                                      | Bìa/hero không phình co (khoá `--vh`)                                                               | P1      |
| M-CARD-18 | Chặn zoom                                  | Chụm 2 ngón trên iOS                                                        | Không zoom                                                                                           | P2      |
| M-CARD-19 | Thiệp hết hạn dùng thử                     | Mở `/<slug W3>`                                                             | Màn "Thiệp đang tạm khoá" có tên cặp đôi, KHÔNG lộ địa chỉ/QR/ảnh                                   | P0      |
| M-CARD-20 | Thiệp không tồn tại / đã bị cron xoá       | `/khong-co-that`                                                            | Trang báo không tìm thấy thân thiện                                                                  | P1      |

### 6.13 RSVP & lời chúc trên thiệp (M-WISH)

| ID        | Kịch bản                                 | Bước                                                                   | Kỳ vọng                                                                                              | Ưu tiên |
| --------- | ---------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------- |
| M-WISH-01 | RSVP từ link khách                       | Chọn tham dự + lời nhắn                                                | Cảm ơn; tab Khách mời thấy "Có tham dự"                                                              | P0      |
| M-WISH-02 | RSVP từ link chung (không tên)           | Mở `/<slug>` trần                                                      | Không có form RSVP hoặc có hướng dẫn phù hợp                                                         | P1      |
| M-WISH-03 | Dải lời chúc `live`                      | Mở bìa, cuộn quá mốc                                                   | Dải chỉ hiện SAU khi mở bìa và cuộn quá `CX_WISH_SHOW_AT`; chạy từ dưới lên, nghỉ rồi chiếu lại      | P1      |
| M-WISH-04 | Ô "Gửi lời chúc"                         | Bấm → gõ 5 dòng                                                        | Thành ô gõ tại chỗ, cao tối đa `CX_WISH_INPUT_ROWS` dòng, không cắt ngang chữ                        | P1      |
| M-WISH-05 | Gửi lời chúc (khách mời)                 | Gửi 3 lời chúc, thử lần 4                                              | 3 lần ok, hiện ngay; lần 4 báo đã đủ                                                                 | P0      |
| M-WISH-06 | Gửi lời chúc (người lạ)                  | Mở link trần, gửi                                                      | Báo "Chỉ khách mời có thiệp riêng…"                                                                  | P0      |
| M-WISH-07 | Dạng `comment`                           | Cuộn tới mục                                                           | Mục nằm ngay trên hộp mừng, khung cuộn tự bò; các chỉnh chữ (`:nth-child`) ở mục sau không lệch     | P1      |
| M-WISH-08 | Dạng `paged`                             | Bấm trang                                                              | Mỗi trang đúng `CX_WISH_PAGE_SIZE` lời chúc                                                          | P2      |
| M-WISH-09 | Màu dải theo mẫu                         | Mẫu nền tối (`noir-elegance`, `moody-cinematic`)                        | Bong bóng, chữ, nút đọc rõ (theo `CX_THEME.wishes`)                                                  | P1      |
| M-WISH-10 | XSS lời chúc                             | Gửi `<img src=x onerror=alert(1)>`                                     | Hiện thành chữ thường, không chạy script                                                             | P0      |
| M-WISH-11 | Tắt lời chúc                             | `enable_wishes=false`                                                  | Không có dải / mục lời chúc                                                                           | P1      |

### 6.14 Chia sẻ & thẻ xem trước (M-SHARE)

| ID         | Kịch bản                         | Bước                                                            | Kỳ vọng                                                                              | Ưu tiên |
| ---------- | -------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------- |
| M-SHARE-01 | Facebook Messenger               | Dán `/<slug>` (dùng Sharing Debugger để làm mới)                 | Có ảnh bìa + tên cặp đôi; ảnh chụp bằng điện thoại (có EXIF) vẫn hiện               | P0      |
| M-SHARE-02 | Zalo                             | Gửi link trong chat                                             | Có thẻ xem trước đúng ảnh + tiêu đề                                                 | P0      |
| M-SHARE-03 | Popup chia sẻ                    | `ShareSocial.open`                                              | Đủ nút mạng xã hội; có lời nhắn thì đính kèm, không thì chỉ link                     | P2      |
| M-SHARE-04 | Web Share API (mobile)           | Bấm chia sẻ trên iOS/Android                                    | Mở bảng chia sẻ hệ thống                                                             | P2      |

### 6.15 Trang quản trị (M-ADM) — chỉ chạy `localhost`

| ID       | Tab                    | Kịch bản                                                                              | Kỳ vọng                                                                                              | Ưu tiên |
| -------- | ---------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------- |
| M-ADM-01 | Chung                  | Nhập sai / đúng `ADMIN_SECRET_TOKEN`; đổi dải môi trường staging ↔ production         | Sai: không vào được. Đổi môi trường: tải lại trang, token cất theo `admin_token:<env>`, header ghi rõ môi trường | P0 |
| M-ADM-02 | Thiệp                  | Tìm, phân trang, mở, xoá                                                              | Đúng dữ liệu; xoá hỏi lại, xoá cả ảnh                                                                | P1      |
| M-ADM-03 | Templates              | Thêm / Sửa / Xoá                                                                      | Sinh file changelog `.sql` (không ghi thẳng DB); chạy file trên cả 2 project cho kết quả giống nhau  | P0      |
| M-ADM-04 | Templates — AI điền    | Gõ tên thư mục → AI điền                                                              | Điền `display_name`, `description`, `category`, `sort_order`                                         | P2      |
| M-ADM-05 | Ảnh mẫu                | Tải ảnh mẫu                                                                           | Tự đánh số khi trùng tên; ảnh ≤ 1.5MB                                                                | P2      |
| M-ADM-06 | Dữ liệu mẫu            | Sinh dữ liệu mẫu bằng AI → áp vào mẫu                                                 | Bản xem thử mẫu hiện dữ liệu mới                                                                    | P2      |
| M-ADM-07 | Ảnh tài nguyên         | Tải SVG, PNG                                                                          | Theo `AX_PRESETS`; SVG giữ nguyên                                                                    | P2      |
| M-ADM-08 | Ảnh nền                | Chọn ảnh, đặt điểm nhìn cho từng biến thể, ghi                                        | `manifest.json` cập nhật (có `focal`); trùng tên hỏi ghi đè; trang chủ lấy bộ mới nhất              | P1      |
| M-ADM-09 | Ảnh nền — xoá          | Xoá một bộ                                                                            | `manifest.json` đồng bộ, trang chủ không trỏ file đã xoá                                            | P1      |
| M-ADM-10 | Mã giảm giá            | Sinh lô, lọc theo lô, tắt, xoá lô có mã đã dùng                                       | Hiện lượt đã dùng + đơn; mã đã dùng chỉ tắt được                                                     | P1      |
| M-ADM-11 | Font                   | Thêm font `.woff2`                                                                    | Hiện trong danh sách font ở tab Giao diện, tên họ đúng quy ước                                      | P2      |
| M-ADM-12 | Purge cache            | Đổi giá mẫu trên production → Purge                                                   | Trang chủ thấy giá mới ≤ 5 phút                                                                      | P0      |
| M-ADM-13 | Không ra web           | Mở `https://cuoixinh.com/admin/`                                                       | 404 (admin không nằm trong `dist/`)                                                                  | P0      |

### 6.16 Cache, phiên bản, môi trường, deploy (M-OPS)

| ID       | Kịch bản                                          | Bước                                                                             | Kỳ vọng                                                                             | Ưu tiên |
| -------- | ------------------------------------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ------- |
| M-OPS-01 | `npm run dev` là staging                          | Mở cổng in ra, xem `CONFIG.env`                                                  | `staging`; `-- --env=production` thì `production`                                   | P0      |
| M-OPS-02 | Clean URL ở dev                                   | `http://localhost:<cổng>/<slug staging>`                                         | Trả `404.html` rồi chuyển hướng giống production                                    | P1      |
| M-OPS-03 | `/core/config.js` không bị cache                  | `curl -I https://cuoixinh.com/core/config.js`                                    | `cf-cache-status: BYPASS/DYNAMIC`                                                  | P0      |
| M-OPS-04 | Thứ tự triển khai                                 | Thay đổi có SQL + Edge Function + web                                            | Làm trọn trên staging (SQL → function → web) rồi lặp y hệt trên production          | P0      |
| M-OPS-05 | Deploy Edge Function cả hai project               | `npm run deploy:functions:all -- <tên>`                                          | Hai project cùng phiên bản; function `--no-verify-jwt` đúng danh sách               | P0      |
| M-OPS-06 | Deploy worker                                     | `npm run deploy:workers:staging -- templates`                                    | `[vars]` trong `.toml` đúng môi trường; secret không bị ghi đè                      | P1      |
| M-OPS-07 | Changelog SQL idempotent                          | Chạy cùng file 2 lần trên staging                                                | Lần 2 không lỗi, không nhân đôi dữ liệu                                             | P0      |
| M-OPS-08 | Cron cleanup đang chạy                            | Xem `cron.job_run_details` (qua MCP đọc)                                         | Chạy hằng ngày, không lỗi                                                           | P1      |
| M-OPS-09 | Axiom                                             | Gây lỗi 5xx có chủ đích trên staging                                             | Có sự kiện `miền.việc_thất_bại` kèm id; không chứa token/chữ ký/key                 | P1      |
| M-OPS-10 | Trang mới / thư mục gốc mới                       | Kiểm `INCLUDE` (deploy) + `content` (Tailwind)                                   | Ra web đủ file; class không bị purge                                                | P1      |

### 6.17 Thiết bị, trình duyệt, hiệu năng, trợ năng (M-DEV)

| ID       | Kịch bản                                  | Bước                                                                          | Kỳ vọng                                                                             | Ưu tiên |
| -------- | ----------------------------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ------- |
| M-DEV-01 | Ma trận trình duyệt                       | Chạy smoke (§8) trên iOS Safari, Android Chrome, Chrome, Safari, Firefox desktop | Không lỗi chặn; bố cục đúng                                                         | P0      |
| M-DEV-02 | Trình duyệt trong app                     | Mở link thiệp từ Zalo, Messenger, Facebook in-app                             | Thiệp mở, nhạc phát sau chạm, RSVP gửi được                                         | P0      |
| M-DEV-03 | Khổ màn biên                              | 320px, 390px, 440px (16 Pro Max), 768px, 820px, 1024px, 1440px, 1920px         | Không tràn ngang, không có chữ bị cắt                                               | P1      |
| M-DEV-04 | Xoay ngang điện thoại                     | Thiệp + Thiết lập                                                             | Dùng được, không kẹt khung                                                          | P2      |
| M-DEV-05 | Dark mode hệ điều hành                    | Bật dark mode                                                                 | Thiệp vẫn đúng bộ màu của nó (không bị trình duyệt tự đảo màu)                      | P2      |
| M-DEV-06 | Hiệu năng thiệp                           | Lighthouse mobile trên 3 mẫu                                                  | LCP < 2.5s với 4G; ảnh màn đầu tải trước YouTube API                                | P1      |
| M-DEV-07 | Trợ năng                                  | Tab bàn phím qua popup/nút; screen reader đọc nút icon                        | Thấy focus; nút icon-only có `aria-label`; Esc đóng popover                         | P2      |
| M-DEV-08 | Icon lucide                               | Mọi màn có markup chèn động                                                   | Không còn thẻ `<i data-lucide>` chưa vẽ; không cảnh báo tên icon sai ở console      | P2      |

---

## 7. SEC — Bảo mật (ánh xạ `docs/security-checklist.md`)

Phần lớn các ca đã có dòng API tương ứng ở trên. Bảng này là mục lục để chạy lại cả lớp mỗi đợt rà.

| ID     | Hạng mục checklist                      | Testcase                                               | Loại  | Ưu tiên |
| ------ | --------------------------------------- | ------------------------------------------------------ | ----- | ------- |
| SEC-01 | A1 Webhook giả                          | API-WH-02, 03, 05, 13                                  | AUTO→ | P0      |
| SEC-02 | A2 Quyền `manage_id` khi tạo đơn        | API-PAY-02                                             | AUTO→ | P0      |
| SEC-03 | A3 Stored XSS                           | API-WA-27, 28, 31, M-WISH-10; AUTO-EX-10 (grep)        | AUTO→ | P0      |
| SEC-04 | A4 Host bản đồ                          | `PATCH ceremony_map_embed_url:"javascript:alert(1)"` và `https://evil.com` → thiệp không nhúng/không mở link | AUTO→ + MAN | P0 |
| SEC-05 | A5 Dò mã giảm giá                       | API-WR-06                                              | AUTO→ | P0      |
| SEC-06 | A6 Đổi mẫu sau thanh toán               | API-WA-40, 41                                          | AUTO→ | P0      |
| SEC-07 | A7 Cache phá quyền                      | WK-09                                                  | AUTO→ | P0      |
| SEC-08 | A8 postMessage                          | Trang lạ nhúng thiệp vào iframe và gửi `{type:"cx-focus"}` / lệnh theme → bị bỏ qua; AUTO-EX-10 | AUTO✓ + MAN | P0 |
| SEC-09 | A9 Header bảo mật                       | WK-18                                                  | AUTO→ | P1      |
| SEC-10 | A10 Lách hạn mức AI                     | API-AI-11                                              | AUTO→ | P0      |
| SEC-11 | A11 Slug server                         | API-WA-07, 35                                          | AUTO→ | P0      |
| SEC-12 | A12a So token                           | Đọc mã: `guest-handler` dùng `timingSafeEqual`         | AUTO✓ (grep) | P1 |
| SEC-13 | A12c RSVP/lời chúc chưa có rate limit   | Script bắn 500 request RSVP/phút → ghi nhận (đang mở, chặn ở Cloudflare — mục E) | MAN | P1 |
| SEC-14 | A13 returnUrl                           | API-PAY-21                                             | AUTO→ | P0      |
| SEC-15 | A14 SRI                                 | AUTO-EX-10 (lệnh thứ 4)                                | AUTO✓ | P1      |
| SEC-16 | A15 Path traversal image-proxy          | WK-13                                                  | AUTO→ | P0      |
| SEC-17 | A16 Bucket chưa giới hạn MIME/kích thước | Upload thẳng file `.html` 20MB lên Storage bằng JWT → ghi nhận (mục E, chưa vá) | MAN | P1 |
| SEC-18 | A17 Đuôi file theo MIME                 | UNIT-17                                                | AUTO→ | P1      |
| SEC-19 | A20 Token cleanup riêng                 | API-CL-01, 02                                          | AUTO→ | P1      |
| SEC-20 | PostgREST bị khoá                       | `curl $SUPABASE/rest/v1/weddings?select=*` với ANON và JWT_U1 → mảng rỗng / 401, không có dữ liệu | AUTO→ | P0 |
| SEC-21 | Liệt kê bucket                          | `POST /storage/v1/object/list/wedding-images` bằng ANON → bị chặn; bằng JWT_U1 → chỉ thấy file của mình | AUTO→ | P0 |
| SEC-22 | Xoá/ghi đè ảnh người khác qua Storage   | JWT_U2 `DELETE`/`upsert` file của U1                    | AUTO→ | P0      |
| SEC-23 | Tên file ảnh không lộ wedding_id        | Tải ảnh, so tên file với id thiệp                        | MAN   | P0      |
| SEC-24 | Dữ liệu thanh toán không rời DB         | API-WA-14, 18 (không có `payment_*`, `expires_at`)       | AUTO→ | P0      |
| SEC-25 | Secret ra web                           | AUTO-EX-06, 07, 08                                     | AUTO✓ | P0      |
| SEC-26 | Admin/SQL/function không ra web         | M-ADM-13; `curl https://cuoixinh.com/supabase/functions/wedding-admin/index.ts` → 404 | AUTO→ | P0 |
| SEC-27 | Log không chứa dữ liệu nhạy cảm         | Soi Axiom sau API-WH-04, API-PAY-11                     | MAN   | P1      |
| SEC-28 | Link khách giả mạo                      | Tự mã hoá tên bằng khoá trong bundle → RSVP/wish vẫn phải khớp bảng `guests` (API-GH-19, 24) | AUTO→ | P0 |
| SEC-29 | Bắt buộc HTTPS / HSTS                   | `curl -I http://cuoixinh.com`                           | AUTO→ | P2      |
| SEC-30 | Claim thiệp vô chủ                      | API-WA-42 + API-WA-48 (claim được nhưng không xoá được) | AUTO→ | P1      |

---

## 8. Bộ smoke trước mỗi lần `npm run production` (~30 phút)

Chạy trên staging sau khi deploy đủ SQL → Edge Function → web. Tất cả phải đạt.

1. **AUTO:** AUTO-EX-01 → AUTO-EX-10 (cả 4 lệnh `check:*`, build, deploy-public, grep bảo mật).
2. **API tối thiểu:**
   - API-WA-04, 14, 16, 20, 24, 25, 26, 38, 40, 45, 49
   - API-PAY-02, 05, 17
   - API-WH-02, 04
   - API-GH-01, 18, 24
   - API-CL-04
3. **Tay:**
   - E2E-01 → E2E-08 (làm tay nếu chưa có Playwright)
   - M-CARD-01, 02, 10, 15, 19 trên 2 mẫu bất kỳ + mẫu vừa sửa
   - M-PAY-05 (1 giao dịch thật kênh staging)
   - M-SHARE-01
   - M-DEV-02 (Zalo in-app)
4. **Sau khi promote:**
   - M-OPS-03
   - M-ADM-12 (purge nếu đổi dữ liệu mẫu/giá)
   - WK-01 trên production
   - Mở 1 thiệp thật đã thanh toán

---

## 9. Nghi vấn phát hiện khi soạn testcase (cần xác nhận)

Các điểm dưới đây đọc từ mã, **chưa chạy thử** để khẳng định. Mỗi mục có testcase để kiểm.

| ID    | Nơi                                        | Nghi vấn                                                                                                                                                                                                                                                         | Testcase kiểm           | Mức độ nếu đúng |
| ----- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | --------------- |
| NV-01 | `supabase/functions/payos-webhook/index.ts` | Không có chốt chống xử lý lặp (khác `payment-handler` đã kiểm `transaction_id`). PayOS gửi lại thì `payment_time` bị ghi đè. Tệ hơn, `payment_status` tính thẳng từ `paymentData.code` nên một webhook hợp lệ báo `code ≠ "00"` đến SAU có thể hạ thiệp đã trả tiền về `failed`. `expires_at` giữ `null` nên thiệp vẫn mở, nhưng `theme_locked` mất và trạng thái đơn sai. | API-WH-09, API-WH-10    | Cao             |
| NV-02 | `payos-webhook`                            | `transaction_id` lưu `transactionDateTime` (thời điểm) thay vì mã giao dịch `reference`, nên khó đối soát với sao kê PayOS.                                                                                                                                          | API-WH-04 (soi cột)     | Trung bình      |
| NV-03 | `payment-handler` `/webhook`               | Đường webhook cũ vẫn mở. Nó ký trên cả payload (không phải `payload.data`) và nối `${value}` (lỗi `null` → `"null"` mà A1 đã sửa ở `payos-webhook`). Hiện có lẽ vô hại vì chữ ký luôn lệch → 401, nhưng nên gỡ để khỏi còn hai đường nhận tiền.                    | API-WH-13               | Thấp–Trung bình |
| NV-04 | `payment-handler` `/check-payment-status`  | Không cần đăng nhập, trả `manage_id` + `slug` theo `order_id`. `orderCode` gồm 9 chữ số thời gian + 5 chữ số ngẫu nhiên nên khó dò. `id` cũng không còn là quyền, nên đây chỉ là rò định danh.                                                                    | API-PAY-19, 20          | Thấp            |
| NV-05 | Slug client ↔ server                       | Client cắt slug ở 50 ký tự (`SLUG_MAX_LENGTH`), server chấp nhận tới 80. Không lỗi, nhưng slug do `payment-handler` tự sinh từ tên dài có thể vượt 50 rồi bị client cắt khi lưu lại, làm đổi link.                                                                  | API-PAY-08 với tên > 50 ký tự, rồi lưu lại ở Thiết lập | Trung bình |
| NV-06 | `guest-handler` RSVP/lời chúc              | Chưa rate limit (A12c đang mở). Người có link khách có thể spam RSVP làm đổi trạng thái liên tục.                                                                                                                                                                   | SEC-13                  | Trung bình      |
| NV-07 | Storage bucket                             | Chưa giới hạn MIME/kích thước phía Supabase (A16 đang mở). Client nén ảnh, nhưng gọi thẳng API Storage thì vượt được.                                                                                                                                               | SEC-17                  | Trung bình      |

---

## 10. Việc nên làm tiếp để tăng phần AUTO

1. `scripts/check-units.mjs`: gom UNIT-01 → UNIT-20 theo mẫu `check-draft-sync.mjs`. Không cần
   mạng, chạy được trong CI.
2. `scripts/check-api.mjs --env=staging`: chạy §3 và §4, tự dựng rồi dọn dữ liệu. Cần 3 tài
   khoản test + token admin staging đặt qua biến môi trường, không commit.
3. Playwright cho §5, dùng Chromium có sẵn. Cloudflare Access của staging cần service token,
   hoặc chạy qua `npm run dev`.
4. Gắn `check:units` + `check:draft-sync` + `check:config` vào `scripts/promote-production.sh`
   để promote tự chặn khi đỏ.
