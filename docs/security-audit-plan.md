# Security Audit & Remediation Plan

## Context

Audit read-only trên toàn bộ codebase (frontend vanilla JS, Supabase Edge Functions, Postgres RLS) để xác định lỗ hổng bảo mật trước khi mở rộng người dùng. Phát hiện gồm 1 lỗ hổng **giả mạo thanh toán qua webhook** (mất tiền thật) và nhiều lỗ hổng **IDOR/RLS** cho phép sửa/đọc dữ liệu của người khác chỉ cần biết UUID. Plan này liệt kê từng vấn đề theo mức độ nghiêm trọng và giải pháp cụ thể, để xử lý theo thứ tự ưu tiên.

---

## Mức độ CAO — cần vá ngay (tiền thật, IDOR toàn hệ thống)

### 1. PayOS webhook không xác thực chữ ký
**File:** `supabase/functions/payos-webhook/index.ts:75-91`
Chữ ký HMAC-SHA256 được tính đúng nhưng kết quả verify bị bỏ qua chủ động (`console.warn("...proceeding without verification (INSECURE)")`, câu `return 401` đã bị comment out). Bất kỳ ai POST payload giả tới endpoint này đều được xử lý như thanh toán hợp lệ — **giả mạo thanh toán, mất doanh thu thật**.

**Cần xác nhận trước:** URL webhook cấu hình bên dashboard PayOS đang trỏ tới `payos-webhook` hay `payment-handler` (handler `handleWebhook` trong `payment-handler/index.ts:339-360` đã verify đúng và an toàn). Nếu PayOS đang gọi `payos-webhook` — đây là lỗ hổng đang khai thác được ngay bây giờ.

**Giải pháp:** Bỏ comment, trả `401` khi thiếu/sai chữ ký. Nếu `payos-webhook` là bản cũ không còn dùng, xoá hẳn function (giảm bề mặt tấn công) và trỏ webhook PayOS về `payment-handler`.

### 2. Bypass thanh toán qua endpoint quản lý thiệp
**File:** `supabase/functions/wedding-admin/index.ts:229-378` (PATCH resource `weddings`)
`fields` cho phép update chỉ loại trừ `id`, `deleted_images`, `user_id`, và `is_active` (khi không phải admin) — **không có allowlist cho `payment_status`, `payment_amount`, `transaction_id`, `expires_at`**. Khách hàng (không cần token admin) có thể tự gọi PATCH với `{"payment_status": "completed"}` để mở khoá thiệp vĩnh viễn mà không cần trả tiền.

**Giải pháp:** Chuyển từ blocklist sang **allowlist** field được phép sửa bởi non-admin (tên, nội dung, theme, ảnh, guest config...). Mọi field liên quan thanh toán chỉ được ghi từ `payment-handler`/webhook nội bộ.

### 3. IDOR — sửa thiệp/khách mời của người khác chỉ cần biết UUID
- `wedding-admin` PATCH không kiểm tra ownership: chỉ auto-claim `user_id` nếu thiệp chưa có chủ (dòng 368-375), sau đó ai cầm `id` cũng PATCH được `contact`, số tài khoản ngân hàng, `slug`, `is_published`.
- `supabase/functions/guest-handler/index.ts` — **toàn bộ file không có xác thực nào** (không JWT, không token) cho list/insert/import/update/delete guest, chỉ cần biết `wedding_id`.
- UUID (`weddings.id`) lại chính là link chia sẻ công khai (`/invitation-setup/?id=<uuid>`, nút "Copy link" ở `public/account/index.js`, `core/payment.js:503`) → dễ lộ qua lịch sử trình duyệt/chat/screenshot, và ai nhặt được link là toàn quyền sửa thiệp.

**Giải pháp:** Thêm kiểm tra ownership (so `user_id` với JWT của người gọi, hoặc thêm "edit token" riêng biệt với "view slug") trong `wedding-admin` PATCH và toàn bộ `guest-handler`. Cân nhắc tách biệt UUID public (dùng để share/xem) khỏi secret dùng để sửa.

#### Kịch bản khai thác cụ thể (đã xác minh trong code): tráo QR nhận tiền mừng cưới

Đây là hệ quả **trực tiếp và nghiêm trọng nhất** của lỗ hổng IDOR ở trên, đáng nêu riêng vì tác động tài chính rõ ràng — đúng kiểu lừa đảo "tráo mã QR mừng cưới" đã từng xảy ra thực tế ở Việt Nam:

- QR mừng cưới **không được sinh động từ số tài khoản** (không qua VietQR API) — nó chỉ là **ảnh do chủ thiệp tự upload**, lưu trong 2 field `groom_qr_url`/`bride_qr_url` của bảng `weddings` (`invitation-setup/js/10-images.js:132-133`), sau đó hiển thị thẳng qua `<img src>`: `core/helpers/render-helper.js:157,165` → `setAttr("groom-qr-img", "src", getImageUrl(wedding.groom_qr_url))`.
- `getImageUrl()` (`core/utils.js:70-85`) nhận **bất kỳ chuỗi nào bắt đầu bằng `http`** và trả nguyên văn làm `src` — không kiểm tra domain có phải storage của chính hệ thống hay không.
- Vì `wedding-admin` PATCH không allowlist field và không kiểm tra ownership (mục #2, #3), một attacker chỉ cần biết `id` của thiệp (chính là UUID trong link share/quản lý) là gọi được:
  ```
  PATCH .../wedding-admin  { id: "<uuid-thiệp-nạn-nhân>", groom_qr_url: "https://attacker.com/fake-qr.png" }
  ```
  → **mọi khách mời mở link thiệp từ thời điểm đó** sẽ thấy mã QR của hacker thay vì QR thật của cô dâu/chú rể, quét và chuyển tiền mừng cưới thẳng vào tài khoản kẻ tấn công — chủ thiệp không hề nhận được cảnh báo gì cho tới khi có người thắc mắc.
- Rủi ro áp dụng tương tự cho mọi field ảnh khác (`cover_image_url`, `groom_image_url`, `bride_image_url`, `gallery_images`) vì cùng đi qua `getImageUrl()` không kiểm tra domain, nhưng QR là nghiêm trọng nhất vì gắn trực tiếp với tiền.

**Giải pháp (ngoài việc vá #2/#3):**
1. Vá ownership check + allowlist field ở `wedding-admin` PATCH sẽ chặn đứng vector chính này.
2. Bổ sung thêm lớp phòng thủ độc lập: validate `groom_qr_url`/`bride_qr_url` (và các field ảnh khác) ở server-side chỉ chấp nhận URL thuộc domain Storage của chính hệ thống (`*.supabase.co/storage/...` hoặc domain Cloudflare image-proxy riêng), từ chối mọi URL ngoài — kể cả khi ownership check sau này có sơ hở khác, field ảnh vẫn không thể trỏ ra ngoài.
3. Cân nhắc thêm cảnh báo/notification (email) cho chủ thiệp mỗi khi `groom_qr_url`/`bride_qr_url`/thông tin ngân hàng bị thay đổi, để phát hiện sớm nếu vẫn có sơ hở lọt qua.

### 4. RLS thiếu/hở trên các bảng chính
**File:** `changelogs/RC1.0/database-complete.sql`
- `weddings` (dòng 209-211): `"Public read" USING (true)` — không lọc `is_published`/`is_active` → **toàn bộ thiệp kể cả draft chưa trả tiền đọc được công khai qua anon key**, lộ số tài khoản ngân hàng, `payment_order_id`, `transaction_id`.
- `guests` (dòng 254-276): `"Public read guests" USING (true)` → enumerate toàn bộ khách mời mọi wedding qua REST API trực tiếp. Policy `"Guest self-update RSVP fields"` (268-270) dùng `USING (true)` không giới hạn cột → có thể sửa `full_name/link/side` thay vì chỉ RSVP như comment mô tả.
- `payment_logs` (dòng 362-380): **RLS chưa được bật, không có policy nào** — bảng log thanh toán mở hoàn toàn.

**Giải pháp:** Viết migration mới trong `changelogs/RC1.x/` (idempotent):
- `weddings`: SELECT policy public chỉ trả field an toàn (ẩn bank info/transaction_id khỏi anon) hoặc lọc `is_published = true`.
- `guests`: SELECT giới hạn theo `wedding_id` được truyền đúng ngữ cảnh (không enumerate toàn bảng); UPDATE policy giới hạn cột bằng `WITH CHECK` chỉ cho phép field RSVP.
- `payment_logs`: `ENABLE ROW LEVEL SECURITY` + policy chỉ cho owner/service_role đọc.
- Cập nhật bảng **Lịch sử phiên bản** trong `changelogs/README.md` theo quy ước dự án.

---

## Mức độ TRUNG BÌNH

### 5. Admin token gửi qua URL query string
**Files:** `admin/js/01-weddings.js`, `admin/js/02-templates.js`, `core/dal/wedding-dal.js`
Token gửi trong query string ở mọi request → lộ vào access log Supabase/Cloudflare, browser history, Referer header. Xác thực server (`wedding-admin/index.ts:16-17`) chỉ so `token === env` bằng `===` thường, không rate-limit/lockout → có thể brute-force.

**Giải pháp:** Chuyển token sang HTTP header (`Authorization: Bearer`). Thêm rate-limit/backoff cho endpoint admin. Cân nhắc constant-time compare.

### 6. CORS wildcard trên toàn bộ Edge Functions
**Files:** `payos-webhook`, `payment-handler`, `wedding-admin`, `guest-handler` (đều set `Access-Control-Allow-Origin: '*'`)
Không kèm credentials nên chưa phải lỗ hổng leak cổ điển, nhưng kết hợp với auth yếu ở mục 3/5 khiến site bất kỳ gọi được API từ browser người dùng khác. `ai-invitation` đã làm đúng chuẩn (allowlist origin phản chiếu).

**Giải pháp:** Áp dụng allowlist origin (theo mẫu `ai-invitation`) cho các function còn lại.

### 7. Thiếu Content-Security-Policy
Không có `<meta http-equiv="Content-Security-Policy">` ở bất kỳ trang HTML nào, `cloudflare-worker/` cũng không set CSP/`X-Content-Type-Options`. Hiện escape XSS ở tầng render đã khá tốt (xem mục 9) nhưng thiếu lớp phòng thủ chiều sâu.

**Giải pháp:** Thêm CSP header qua Cloudflare Worker (script-src tự host + domain cần thiết, object-src 'none', frame-ancestors phù hợp) áp dụng cho toàn site.

### 8. PostgREST filter injection ở tìm kiếm admin
**File:** `supabase/functions/wedding-admin/index.ts:552`
`baseQuery.or(\`slug.ilike.%${search}%,...\`)` nối chuỗi trực tiếp vào cú pháp filter PostgREST — `search` chứa dấu phẩy/ngoặc có thể thêm điều kiện lạ. Chỉ admin gọi được nên rủi ro thấp nhưng nên vá theo chuẩn.

**Giải pháp:** Escape ký tự đặc biệt (`,`, `(`, `)`, `%`, `*`) trong `search` trước khi build filter string, hoặc dùng `.filter()` với tham số riêng thay vì string interpolation.

### 9. Escape HTML không nhất quán, trùng lặp code
- `escapeHtml()` (`core/helpers/render-helper.js:264-271`) thiếu escape dấu `'`; `_esc()` (`invitation-setup/guests/index.js:361-367`) escape đủ — hai hàm làm cùng việc, định nghĩa riêng lẻ.
- `core/helpers/maps-helper.js:242` chèn `display_name` (gợi ý địa chỉ từ Nominatim/OSM) thẳng vào `innerHTML` không escape; dòng 429/433 tự viết escape tay chỉ xử lý `&`/`"`, thiếu `<`/`>`/`'`.
- Trang thiệp công khai (nơi rủi ro cao nhất) đã escape nhất quán qua `escapeHtml`/`textContent` — rủi ro XSS thực tế ở đây thấp, nhưng nợ kỹ thuật đáng dọn trước khi thêm tính năng mới (vd guest book công khai).

**Giải pháp:** Gộp về một hàm `escapeHtml()` dùng chung đặt trong `core/utils.js`, escape đủ 5 ký tự (`&<>"'`), thay thế mọi bản sao cục bộ. Áp dụng cho `maps-helper.js`.

### 10. Upload ảnh chỉ validate ở client
**File:** `core/bl/image-bl.js:20-33`, `core/dal/storage-dal.js:19-32`
`validateImageFile()` chỉ chạy client-side, chấp nhận `image/svg+xml`. Nếu bỏ qua UI và gọi thẳng Supabase Storage REST API bằng token hợp lệ, có thể upload SVG/HTML chứa script rồi share link ra ngoài (dù `resizeImage()` rasterize ảnh qua canvas trước khi upload nên luồng UI bình thường đã an toàn).

**Giải pháp:** Cấu hình allow-list MIME type ở Supabase Storage bucket policy (ngoài phạm vi code) hoặc kiểm tra lại MIME server-side trong Edge Function nếu có luồng upload qua đó.

---

## DDoS / Spam / Lạm dụng tài nguyên (Resource-exhaustion DoS)

Hạ tầng dùng Cloudflare (Workers/CDN) trước GitHub Pages nên **DDoS tầng mạng (L3/L4)** đã được Cloudflare tự động chặn — không cần làm gì thêm miễn DNS các domain đang **proxy qua Cloudflare (orange cloud)**, không phải "DNS only". Rủi ro thực sự nằm ở **tầng ứng dụng (L7)**: dự án chạy trên Supabase Edge Functions + API AI trả phí theo lượt gọi, nên spam request không cần làm sập site — chỉ cần request đủ nhiều để **đội chi phí (financial DoS)** hoặc làm bloat database.

### 11. Tạo thiệp draft không giới hạn — spam ghi DB
**File:** `supabase/functions/wedding-admin/index.ts:176-212` (POST tạo `weddings`)
Endpoint public, không cần đăng nhập, không token, **không rate-limit** — "KH tự tạo sau khi thanh toán hoặc tạo draft". Một script đơn giản có thể gọi lặp vô hạn để tạo hàng loạt bản ghi `weddings` rác → phình database, tốn quota Supabase, làm nhiễu dashboard admin.

**Giải pháp:** Rate-limit theo IP (theo mẫu `ai-invitation/index.ts:705-738`, dùng `x-forwarded-for` + bảng đếm/ngày), hoặc yêu cầu Cloudflare Turnstile token trước khi tạo draft.

### 12. `guest-handler` không xác thực + không rate-limit theo IP
**File:** `supabase/functions/guest-handler/index.ts`
Đã có giới hạn hợp lý về **dung lượng mỗi request** (`MAX_PER_SIDE=100`, `MAX_FIELD_LEN=200`, tối đa 200 id/lần — dòng 10-12, 84, 121, 190) nhưng **không giới hạn số lần gọi theo thời gian**. Vì không cần xác thực (đã nêu ở mục 3), kẻ tấn công có thể lặp vô hạn chu trình import/xoá trên cùng một `wedding_id` để dội request liên tục vào Supabase — tốn compute quota, có thể trigger giới hạn/billing cao hơn dự kiến hoặc làm chậm dịch vụ cho người dùng thật.

**Giải pháp:** Thêm rate-limit theo IP hoặc theo `wedding_id` (vd tối đa N request/phút) tại tầng Edge Function hoặc qua Cloudflare Rate Limiting Rules (dashboard, áp cho path `*guest-handler*`).

### 13. `payos-webhook-proxy.js` — bộ chuyển tiếp mở, không kiểm tra gì trước khi forward
**File:** `cloudflare-worker/payos-webhook-proxy.js:60-90`
Worker này nhận **bất kỳ POST nào dài ≥ 20 ký tự** và forward thẳng vào Supabase Edge Function `payos-webhook` ở background (`ctx.waitUntil`), luôn trả `200 success` cho phía gọi bất kể kết quả thật — thiết kế này vốn để PayOS luôn thấy webhook "thành công", nhưng đồng thời biến worker thành **một điểm khuếch đại (amplifier) miễn phí**: ai cũng có thể spam POST tới URL Cloudflare Worker công khai này để dội request vào Supabase, và vì `payos-webhook` phía sau đang **bỏ qua xác thực chữ ký** (mục #1), mỗi request giả này còn có nguy cơ bị xử lý như một sự kiện thanh toán thật.

**Giải pháp:** Vá mục #1 trước (bật lại verify signature) để chặn phần lớn hệ quả; đồng thời thêm rate-limit tại chính worker này (dùng Cloudflare KV hoặc Durable Object đếm request/IP) trước khi `ctx.waitUntil(fetch(...))`.

### 14. `wedding-cache-proxy.js` — PATCH/DELETE không qua cache, không rate-limit
**File:** `cloudflare-worker/wedding-cache-proxy.js`
Chỉ GET theo `slug`/`id` được cache (giảm tải tốt cho traffic đọc bình thường). Nhưng PATCH/DELETE luôn forward trực tiếp tới Supabase, không có giới hạn tần suất — kết hợp với lỗ hổng IDOR/allowlist ở mục #2, #3, một script spam PATCH liên tục vào cùng `id` vừa tốn compute vừa tăng khả năng khai thác race-condition trên các lỗ hổng đó.

**Giải pháp:** Thêm rate-limit cho method PATCH/DELETE tại worker (theo IP), độc lập với cache GET.

### 15. Không có CAPTCHA/Turnstile ở bất kỳ form public nào
Grep toàn repo không thấy Cloudflare Turnstile/reCAPTCHA được tích hợp ở bất kỳ đâu — kể cả nơi rủi ro cao nhất (tạo thiệp draft, `ai-invitation`). Đây là lớp phòng thủ đơn giản, chi phí thấp (Turnstile miễn phí, tích hợp nhanh) để chặn phần lớn spam tự động mà không ảnh hưởng người dùng thật.

**Giải pháp:** Thêm Cloudflare Turnstile ở form tạo thiệp (`invitation-setup`) và trước khi gọi `ai-invitation` lần đầu trong phiên; verify token ở phía Edge Function trước khi xử lý.

---

## Chuỗi cung ứng (Supply-chain) & mã nguồn bên thứ ba

### 16. Script CDN không có SRI, một số không pin version
**Files:** hầu hết mọi trang HTML (`index.html`, `admin/index.html`, `invitation-setup/index.html`, `public/themes/*/index.html`, `public/account/index.html`, `theme-template/index.html`)
Toàn bộ site — kể cả trang admin và trang xử lý thanh toán/thiệp — nạp thư viện trực tiếp từ CDN công cộng (`cdn.tailwindcss.com`, `cdn.jsdelivr.net`, `cdnjs.cloudflare.com`, `unpkg.com`): Supabase JS SDK, Font Awesome, crypto-js, xlsx, lucide, leaflet, flatpickr, coloris, cropperjs. **Không một thẻ `<script>`/`<link>` nào có thuộc tính `integrity` (SRI)**. Đáng chú ý nhất:
- `@supabase/supabase-js@2` — chỉ pin major version, tự động nhận mọi bản patch/minor mới mà không kiểm soát.
- `lucide@latest` (`invitation-setup/index.html:58`, `invitation-setup/guests/index.html:12`) — luôn lấy bản **mới nhất tuyệt đối**, không pin gì cả.

Nếu CDN bị compromise hoặc một bản phát hành của gói npm bị chèn mã độc (kiểu tấn công chuỗi cung ứng đã từng xảy ra thực tế với nhiều gói npm phổ biến), mã độc sẽ chạy trên **mọi trang của toàn bộ website**, kể cả nơi xử lý phiên đăng nhập Supabase và luồng thanh toán.

**Giải pháp:** Pin version cụ thể tới patch (vd `@supabase/supabase-js@2.45.4`, không dùng `@latest`); thêm `integrity="sha384-..."` + `crossorigin="anonymous"` cho các script/link từ CDN, đặc biệt là `supabase-js`. Cân nhắc tự host các thư viện ổn định (không cần cập nhật thường xuyên) trong repo thay vì phụ thuộc runtime vào CDN ngoài.

### 17. Tự parse localStorage để lấy session — vi phạm quy tắc Auth của dự án
**File:** `core/payment.js:712-725` (`getCurrentUser()`)
```js
const sessionKey = keys.find(k => k.startsWith("sb-") && k.endsWith("-auth-token"));
const session = JSON.parse(localStorage.getItem(sessionKey));
```
Đây chính xác là điều CLAUDE.md đã cảnh báo ở mục Auth: token supabase-js v2 có thể ở định dạng `base64-...` và JSON.parse trực tiếp sẽ vỡ (throw, bị bắt bởi `catch` nên fail-safe về `null`, nhưng nghĩa là `getCurrentUser()` có thể âm thầm coi người dùng đã đăng nhập là **chưa đăng nhập** trong một số phiên bản trình duyệt/định dạng token — không phải lỗ hổng cấp quyền, nhưng là lỗi tin cậy dữ liệu, và là chỗ duy nhất trong codebase phá vỡ quy ước đã đặt ra).

**Giải pháp:** Dùng `supabase.auth.getUser()` / `getSession()` (API chính thức) thay vì tự đọc `localStorage`, đúng theo quy tắc đã ghi trong `CLAUDE.md`.

**Việc đã kiểm tra và OK (không cần hành động):** không có file `.env`/secret nào được commit vào git (`git ls-files` sạch), `npm audit` không phát hiện lỗ hổng dependency nào, module logging `_shared/axiom.ts` có comment nhắc rõ không log dữ liệu nhạy cảm và tuân thủ đúng trong code hiện tại.

---

## Mức độ THẤP

- `core/config.js:31` — `purgeSecret` Cloudflare hardcode trong bundle client. Nên chuyển việc purge cache qua Edge Function/Worker có xác thực riêng thay vì để secret trong client bundle.
- HMAC signature compare bằng `===` thay vì constant-time (`payos-webhook`, `payment-handler`) — rủi ro timing attack thấp qua mạng nhưng nên dùng `crypto.timingSafeEqual` tương đương cho chuẩn mực.
- `orders`/`order_details` INSERT `WITH CHECK (true)` cho phép spam bản ghi tuỳ ý — nên giới hạn theo `auth.uid() = user_id`.
- Rate limit IP cho `ai-invitation` dựa vào `x-forwarded-for` (có thể spoof/luân chuyển) — chấp nhận được ở quy mô hiện tại.

---

## Thứ tự xử lý đề xuất

1. **Ngay lập tức:** xác nhận endpoint webhook PayOS thực tế đang dùng (#1), vá allowlist field PATCH (#2), thêm ownership check (#3) — mục #3 bao gồm cả kịch bản tráo QR mừng cưới, ưu tiên cao nhất vì tác động tài chính trực tiếp tới khách hàng. Việc vá #1 cũng giảm phần lớn rủi ro của #13.
2. **Trong tuần:** migration RLS cho `weddings`/`guests`/`payment_logs` (#4), CORS allowlist (#6), admin token qua header (#5), rate-limit tạo draft wedding (#11) và `guest-handler` (#12).
3. **Kế tiếp:** CSP header (#7), gộp escape helper (#9), vá filter injection (#8), rate-limit các Cloudflare Worker proxy (#13, #14), thêm Turnstile (#15).
4. **Khi có thời gian:** dọn secret client-side (#11 mục Thấp), constant-time compare, giới hạn INSERT `orders`, pin version + thêm SRI cho script CDN (#16), sửa `getCurrentUser()` dùng API chính thức (#17).

## Kiểm chứng sau khi vá

- Gọi thử `payos-webhook` với payload không có/sai chữ ký → phải nhận `401`.
- Gọi PATCH `wedding-admin` với `payment_status` từ một UUID không phải admin → phải bị từ chối hoặc field bị loại bỏ âm thầm.
- Dùng anon key gọi trực tiếp Supabase REST (`select * from guests`) không kèm điều kiện → không được trả về toàn bộ bảng.
- Kiểm tra `payment_logs` bằng anon key → phải bị từ chối truy cập.
- Test lại luồng thanh toán thật (staging) end-to-end sau khi sửa webhook, đảm bảo không phá luồng hợp lệ.
- Viết script gọi lặp (vd 100 request/phút) tới POST tạo draft wedding và tới `guest-handler` → phải bị chặn/hạn chế sau ngưỡng đặt ra, không phải toàn bộ đều `200`.
- Kiểm tra domain Cloudflare Worker (`payos-webhook-proxy`, `wedding-cache-proxy`, `image-proxy`) đang **proxy (orange cloud)** chứ không phải "DNS only" trong Cloudflare dashboard.
- Thử PATCH `groom_qr_url`/`bride_qr_url` của một thiệp bất kỳ (không phải chủ) thành URL ảnh ngoài (`https://example.com/test.png`) → phải bị từ chối; mở lại trang thiệp đó, ảnh QR hiển thị **không được đổi**.
