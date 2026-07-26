# Security Audit & Remediation Plan

## Context

Audit toàn bộ codebase (frontend vanilla JS, Supabase Edge Functions, Postgres RLS, Cloudflare Workers) để xác định lỗ hổng bảo mật trước khi mở rộng người dùng.

Phát hiện nghiêm trọng nhất: **giả mạo thanh toán qua webhook** và **IDOR cho phép tráo mã QR nhận tiền mừng cưới** — cả hai đều có tác động tài chính trực tiếp.

Bản plan này **đã qua một vòng review lại** sau khi đọc kỹ code thật; phần "Đính chính so với bản đầu" ở cuối ghi rõ những chỗ bản đầu tiên nói sai.

## Trạng thái thi hành (2026-07-26)

**Đã sửa xong trong code** — chưa deploy, chưa commit:

| # | Việc | File chính |
|---|---|---|
| 1 | PayOS verify chữ ký ở **shadow mode** + constant-time compare | `supabase/functions/payos-webhook/index.ts` |
| 1/13 | Proxy không còn nuốt lỗi, trả status thật để PayOS retry | `cloudflare-worker/payos-webhook-proxy.js` |
| 2 | Allowlist field PATCH (chặn tự ghi `payment_status`) | `supabase/functions/wedding-admin/index.ts` |
| 3 | Bắt buộc đăng nhập + ownership check PATCH/POST | `supabase/functions/wedding-admin/index.ts` |
| 3 | Chống tráo ảnh/QR: chỉ nhận ảnh trên host hệ thống | `supabase/functions/wedding-admin/index.ts` |
| 3 | `guest-handler`: JWT + kiểm tra chủ thiệp ở cả 6 nhánh | `supabase/functions/guest-handler/index.ts`, `core/dal/guest-dal.js` |
| 3 | Client nhắc đăng nhập khi gặp `AUTH_REQUIRED`/`FORBIDDEN` | `invitation-setup/js/13-data.js`, `core/dal/wedding-dal.js` |
| 4a | Migration siết RLS | `changelogs/RC1.7/rls_hardening.sql` |
| 4b | GET public không còn trả field thanh toán | `supabase/functions/wedding-admin/index.ts` |
| 5 | Admin token chuyển sang header + constant-time | `admin/js/00-core.js`, `01-weddings.js`, `02-templates.js`, `core/dal/wedding-dal.js` |
| 6 | CORS allowlist origin (theo mẫu `ai-invitation`) | `wedding-admin`, `guest-handler` |
| 7 | Vá PostgREST filter injection | `supabase/functions/wedding-admin/index.ts` |
| 8 | Gộp `escapeHtml` dùng chung, vá `maps-helper` | `core/utils.js` + 4 file bỏ bản trùng |
| 16 | Pin version + SRI cho CDN (bỏ `@latest`) | 9 file HTML |
| 17 | `getCurrentUser()` dùng supabase.auth API | `core/payment.js`, `js/home-payment.js` |

Toàn bộ file đã qua kiểm tra cú pháp. **Chưa chạy thử end-to-end** — xem mục Kiểm chứng.

### Việc PHẢI làm thủ công (không tự động hoá được từ đây)

1. **Deploy Edge Functions**: `wedding-admin`, `guest-handler`, `payos-webhook` (Supabase CLI chưa cài trên máy này).
2. **Deploy Cloudflare Worker** `payos-webhook-proxy` (Wrangler chưa cài).
3. **Chạy migration** `changelogs/RC1.7/rls_hardening.sql` qua Supabase Dashboard → SQL Editor.
4. **Chạy query đếm thiệp vô chủ** (ở cuối file migration) để quyết định mốc hạn chót cho thiệp `user_id IS NULL`.
5. **Theo dõi log Axiom** `payos.signature_check` sau 1–2 giao dịch thật → nếu `matched: true` thì đặt biến môi trường `PAYOS_ENFORCE_SIGNATURE=true` để bật chặn (không cần sửa code).
6. **Supabase Storage bucket policy**: giới hạn MIME type + kích thước (#9) — chỉ làm được trên Dashboard.
7. **Cloudflare Rate Limiting Rules** cho `guest-handler`/`wedding-admin` (#12, #14) — cấu hình trên Dashboard.
8. **Cấu hình Axiom cho Worker** — nên có, thiếu thì worker vẫn chạy, chỉ không đẩy log.
   ⚠️ Secret của Cloudflare **tách biệt hoàn toàn** với secret của Supabase: `AXIOM_TOKEN`
   đã đặt trong Supabase (cho `_shared/axiom.ts`) không dùng lại được ở Worker.
   - Tên dataset không phải bí mật → khai trong `[vars]` của `wrangler-webhook.toml`
   - Token → `wrangler secret put AXIOM_TOKEN --config wrangler-webhook.toml`

### Quan sát (observability) sau đợt vá

Sự kiện Axiom cần theo dõi:

| Log | Ý nghĩa |
|---|---|
| `payos.signature_check` | **Mốc quyết định** bật `PAYOS_ENFORCE_SIGNATURE` — chờ `matched: true` trên giao dịch thật |
| `payos.wedding_not_found` | Khách trả tiền nhưng không tìm ra thiệp → tiền vào mà thiệp không mở |
| `payos.amount_mismatch` | Sai cấu hình giá, **hoặc** có người thử giả mạo webhook với số tiền tự đặt |
| `payos.pricing_not_found` / `payos.update_failed` | Lỗi mở khoá thiệp sau thanh toán |
| `proxy.upstream_error` / `proxy.upstream_unreachable` | Worker không đẩy được webhook vào Supabase (nguồn log duy nhất cho case này) |
| `wedding.patch_forbidden` / `guest.forbidden` | Có người thử sửa thiệp/khách mời của người khác |
| `wedding.patch_image_rejected` | Có người thử tráo ảnh/QR sang host ngoài |
| `wedding.claimed` | Thiệp vô chủ được nhận — soi xem có ai claim bất thường không |

### Quyết định thay đổi trong lúc thi hành

- **Không tạo bảng rate-limit trong DB** như dự tính ban đầu (#11, #12). Sau khi bắt buộc đăng nhập, vector spam tạo draft và thao tác khách mời đã giảm mạnh; Cloudflare Rate Limiting Rules là lựa chọn rẻ và nhanh hơn cho phần còn lại. Tránh thêm bảng chưa dùng tới.
- **`admin/js/03-sample-images.js` giữ bản `escapeHtml` cục bộ** (đã bổ sung escape `'`) vì `admin/index.html` không nạp `core/utils.js`.
- **CORS áp bằng cách tính header theo từng request ở đầu handler**, không phải sửa ~40 chỗ trả response — giảm rủi ro sót.

---

## Quyết định đã chốt

| Vấn đề | Quyết định |
|---|---|
| Mô hình quyền sửa thiệp (#3) | **Bắt buộc đăng nhập mới sửa được thiệp.** Xem chiến lược migration ở #3 — đây là thay đổi sản phẩm, không chỉ là vá kỹ thuật. |
| Bật verify chữ ký PayOS (#1) | **Shadow mode trước** (log-only), xác nhận thuật toán đúng trên giao dịch thật rồi mới hard-fail. |

---

## Nhóm A — Mức CAO, vá trước

### 1. PayOS webhook không xác thực chữ ký

**File:** `supabase/functions/payos-webhook/index.ts`

Chữ ký HMAC-SHA256 được tính đúng nhưng kết quả verify bị bỏ qua chủ động, kèm ghi chú `"FIX THIS IN PRODUCTION"` và câu `return 401` đã comment out. Bất kỳ ai POST payload giả đều được xử lý như thanh toán hợp lệ.

**Đường đi thật của webhook (đã xác minh):** PayOS → `cloudflare-worker/payos-webhook-proxy.js` → Edge Function `payos-webhook`. Tức là lỗ hổng này **đang sống**, không phải code chết.

**Hai rủi ro khiến không được hard-fail ngay:**

1. **Có hai thuật toán ký khác nhau trong repo, một cái sai.**
   - `payos-webhook`: HMAC trên `payload.data` → khớp spec PayOS.
   - `payment-handler/index.ts:29-38`: HMAC trên *toàn bộ payload* trừ `signature` → object lồng `data` serialize thành `[object Object]` → **luôn sai**. Handler này thực chất từ chối cả webhook thật; nó "an toàn" theo nghĩa vô dụng.
   - Việc dev cũ tắt verify ở `payos-webhook` gợi ý nó **từng fail trên thực tế** → phải chứng minh thuật toán đúng trước khi tin.

2. **Proxy nuốt lỗi.** `payos-webhook-proxy.js` luôn trả `200` cho PayOS bất kể kết quả thật. Nếu verify sai → khách trả tiền, thiệp không mở, **PayOS không retry, không ai được báo**.

**Giải pháp — 3 bước, theo thứ tự:**

1. **Shadow mode:** tính chữ ký, `log.info('payos.signature_check', { matched: true/false })` qua Axiom, **vẫn xử lý đơn như cũ**. Deploy, chờ 1–2 giao dịch thật.
2. **Sửa proxy** để lỗi không bị nuốt: forward status thật của Edge Function về PayOS (hoặc ít nhất log.error + cảnh báo khi Edge trả non-2xx), để PayOS retry đúng cơ chế.
3. **Hard-fail:** khi log xác nhận `matched: true` trên giao dịch thật → trả `401` cho chữ ký thiếu/sai. Dùng constant-time compare.

> Trạng thái hiện tại: file đã được sửa sang **hard-fail + constant-time compare**. Cần **hạ xuống shadow mode** trước khi deploy, giữ lại phần constant-time.

Ngoài ra: `payment-handler`'s `verifyWebhookSignature` cần sửa cho đúng spec (dùng `payload.data`) hoặc xoá hẳn handler webhook trùng lặp này để tránh nhầm lẫn về sau.

### 2. Bypass thanh toán qua PATCH `wedding-admin`

**File:** `supabase/functions/wedding-admin/index.ts:229-378`

`const { id, deleted_images, ...fields } = body` rồi chỉ `delete fields.is_active` (non-admin) và `delete fields.user_id`. **`payment_status`, `payment_amount`, `transaction_id`, `expires_at` đi thẳng vào `update()`** → client tự PATCH `{"payment_status":"completed"}` là mở khoá thiệp vĩnh viễn, không cần trả tiền.

**Giải pháp:** đổi blocklist → **allowlist**. Khai báo `CUSTOMER_EDITABLE_FIELDS` (nội dung thiệp: tên, ngày, địa điểm, theme, ảnh, timeline, love_story, contact, guest config, slug, is_published…). Mọi field ngoài danh sách bị loại bỏ với non-admin. Field thanh toán chỉ được ghi từ `payment-handler`/webhook.

### 3. IDOR — ai có UUID là toàn quyền sửa thiệp

- PATCH **không kiểm tra ownership**; chỉ auto-claim `user_id` khi thiệp chưa có chủ (`index.ts:372-375`).
- `guest-handler/index.ts` — **toàn bộ file không có xác thực nào** cho list/insert/import/update/delete, chỉ cần biết `wedding_id`.
- UUID vừa là link chia sẻ vừa là chìa khoá sửa → lộ qua lịch sử trình duyệt, chat, ảnh chụp màn hình.

#### Kịch bản khai thác đã xác minh: tráo QR nhận tiền mừng cưới

QR mừng cưới **không sinh động từ số tài khoản** — nó là **ảnh do chủ thiệp upload**, lưu ở `groom_qr_url`/`bride_qr_url`, render thẳng qua `<img src>` (`core/helpers/render-helper.js:157,165`). `getImageUrl()` (`core/utils.js:70-85`) nhận **mọi chuỗi bắt đầu bằng `http`** và trả nguyên văn — không kiểm tra domain.

```
PATCH .../wedding-admin  { id: "<uuid-nạn-nhân>", groom_qr_url: "https://attacker.com/fake-qr.png" }
```

→ Mọi khách mời mở thiệp từ lúc đó quét phải QR của kẻ tấn công, tiền mừng cưới chảy thẳng vào tài khoản nó. Chủ thiệp không được cảnh báo gì.

#### Giải pháp: bắt buộc đăng nhập mới sửa (đã chốt)

Hạ tầng đã sẵn: `core/dal/wedding-dal.js:18-32` (`_authHeaders()`) **đã đính JWT** của user khi đã đăng nhập; `getUserId()` phía Edge Function đã có. Việc cần làm:

**a) Edge Function `wedding-admin`:**
- `PATCH`: yêu cầu `getUserId()` trả về non-null **và** khớp `existing.user_id` → nếu không, `403`. Admin token vẫn bypass.
- `POST` (tạo mới): yêu cầu đăng nhập → `user_id` luôn được set, không còn sinh thiệp vô chủ.
- `GET ?id=` (nạp vào trình sửa): cũng cần ownership — xem #4b.

**b) Xử lý thiệp cũ `user_id = NULL` (quan trọng nhất):**
Không thể khoá cứng ngay, sẽ giết luôn thiệp của khách hàng hiện hữu. Chiến lược grandfather:
- Thiệp `user_id IS NULL` → **user đăng nhập đầu tiên mở link sửa sẽ nhận làm chủ** (giữ hành vi claim hiện có, nhưng bắt buộc phải đăng nhập mới claim được).
- Ghi log Axiom mọi lần claim (`wedding.claimed`, kèm `wedding_id`, `user_id`, IP) để soi bất thường.
- **Rủi ro còn lại phải chấp nhận:** trong cửa sổ trước khi chủ thật đăng nhập claim, kẻ có UUID rò rỉ vẫn có thể claim trước. Giảm thiểu bằng: đặt **hạn chót** (vd 30 ngày) — sau đó thiệp chưa claim chuyển sang chỉ-đọc, cần admin hỗ trợ. Cần chạy một query đếm xem hiện có bao nhiêu thiệp `user_id IS NULL` để lượng hoá quy mô trước khi chọn mốc.

**c) Client:**
- `invitation-setup` phải gate sau đăng nhập (dùng `core/auth-ui.js` sẵn có — đã hỗ trợ OTP email + OAuth).
- Thông báo rõ cho người dùng: "đăng nhập để chỉnh sửa thiệp" thay vì lỗi 403 trần trụi.

**d) `guest-handler`:** cùng nguyên tắc — mọi thao tác ghi phải kèm JWT và kiểm tra người gọi sở hữu `wedding_id` đó.

**e) Vẫn giữ công khai:** trang thiệp `/slug` cho khách mời xem **không** yêu cầu đăng nhập. Chỉ luồng *sửa* mới cần.

#### Lớp phòng thủ độc lập (làm kể cả khi đã có ownership check)

Validate server-side: `groom_qr_url`/`bride_qr_url` và mọi field ảnh chỉ nhận **filename trần** hoặc URL thuộc domain storage của hệ thống; từ chối URL ngoài. Kể cả ownership check sau này có sơ hở, ảnh vẫn không thể trỏ ra ngoài. Cân nhắc thêm email cảnh báo chủ thiệp khi QR/thông tin ngân hàng đổi.

### 4. Rò rỉ dữ liệu qua đường đọc

**a) RLS hở (`changelogs/RC1.0/database-complete.sql`):**
- `weddings` (209-211): `"Public read" USING (true)` → **mọi thiệp kể cả draft chưa trả tiền đọc được bằng anon key**, lộ số tài khoản, `payment_order_id`, `transaction_id`.
- `guests` (254-276): `"Public read guests" USING (true)` → enumerate toàn bộ khách mời mọi đám. Policy update dùng `USING (true)` không giới hạn cột → sửa được `full_name/link/side` chứ không chỉ RSVP.
- `payment_logs` (362-380): **chưa bật RLS, không policy nào**.

Anon key nằm công khai trong `core/config.js`, nên `curl https://<project>.supabase.co/rest/v1/weddings?select=*` là khai thác được thật.

> **Tin tốt:** grep xác nhận client **không** truy vấn thẳng `weddings`/`guests` — toàn bộ đi qua Edge Function (service_role, bypass RLS). Nên **siết RLS không làm vỡ app**. Đổi lại, RLS ở đây là phòng thủ chiều sâu chống truy cập anon key trực tiếp, **không** phải authz chính của sản phẩm — authz thật nằm ở #2/#3.

**b) GET trả `select('*')` cho bất kỳ ai** (`wedding-admin/index.ts:584`) — đây mới là đường rò **đang sống**, vì client đi qua đúng path này. Thiệp lấy theo slug trả về cả `transaction_id`, `payment_order_id`, `payment_status`, `user_id`, `expires_at`.

**Giải pháp:**
- Viết migration idempotent trong `changelogs/RC1.x/`: `weddings` lọc `is_published`/ẩn field nhạy cảm; `guests` giới hạn theo `wedding_id` + `WITH CHECK` giới hạn cột RSVP; `payment_logs` bật RLS chỉ service_role; `orders`/`order_details` siết INSERT về `auth.uid() = user_id`.
- Tạo sẵn bảng đếm cho rate-limit (#11, #12) **trong cùng migration này**.
- GET public: trả **allowlist field** cần cho việc render thiệp; field thanh toán/nội bộ chỉ trả cho admin hoặc chủ sở hữu.
- Cập nhật bảng **Lịch sử phiên bản** trong `changelogs/README.md`.

---

## Nhóm B — Mức TRUNG BÌNH

### 5. Admin token trong query string
**Files:** `admin/js/01-weddings.js`, `admin/js/02-templates.js`, `core/dal/wedding-dal.js:159,177`
Token đi trong URL → lộ vào access log Supabase/Cloudflare, browser history, `Referer`. Server so sánh `token === env` không constant-time, không rate-limit → brute-force được.

**Giải pháp:** chuyển sang header `x-admin-token` — **Edge Function đã hỗ trợ sẵn** (`index.ts:16`) và Cloudflare worker đã forward header, nên chỉ cần sửa phía client. Thêm constant-time compare + rate-limit/backoff.

### 6. CORS wildcard
`payos-webhook`, `payment-handler`, `wedding-admin`, `guest-handler` đều `Access-Control-Allow-Origin: '*'`. `ai-invitation` đã làm đúng (allowlist origin) — dùng làm mẫu.

> **Đừng kỳ vọng sai:** CORS chỉ ràng buộc trình duyệt, `curl`/script bỏ qua hoàn toàn. Với `guest-handler` (không auth) CORS **không** bảo vệ được gì — fix thật là #3. Với `payos-webhook` (server-to-server, không có `Origin`) thì allowlist là vô nghĩa. Làm mục này vì vệ sinh, không phải vì nó chặn được tấn công.

### 7. PostgREST filter injection ở tìm kiếm admin
`wedding-admin/index.ts:552` — `baseQuery.or(\`slug.ilike.%${search}%,...\`)` nối chuỗi thẳng vào cú pháp filter. Chỉ admin gọi được nên rủi ro thấp.
**Giải pháp:** escape `,` `(` `)` `%` `*` trong `search`, hoặc tách thành `.filter()` có tham số.

### 8. Escape HTML trùng lặp, không nhất quán
- `escapeHtml()` (`core/helpers/render-helper.js:264-271`) thiếu escape `'`; `_esc()` (`invitation-setup/guests/index.js:361-367`) escape đủ — hai bản làm cùng việc.
- `core/helpers/maps-helper.js:242` chèn `display_name` (từ Nominatim/OSM) vào `innerHTML` **không escape**; dòng 429/433 escape tay chỉ `&`/`"`.
- Trang thiệp công khai (nơi rủi ro cao nhất) **đã escape nhất quán** — rủi ro thực tế thấp, đây là dọn nợ kỹ thuật trước khi thêm tính năng mới (vd guest book).

**Giải pháp:** gộp một `escapeHtml()` trong `core/utils.js` (đủ 5 ký tự `&<>"'`), thay mọi bản sao, áp cho `maps-helper.js`.

### 9. Upload ảnh chỉ validate client-side
`core/bl/image-bl.js:20-33` chỉ chạy ở client, chấp nhận `image/svg+xml`. Gọi thẳng Storage REST API bỏ qua UI thì upload được SVG/HTML chứa script. (`resizeImage()` rasterize qua canvas nên luồng UI thường vẫn an toàn.)
**Giải pháp:** cấu hình allow-list MIME + giới hạn size ở **Supabase Storage bucket policy** (dashboard, ngoài repo).

### 10. Thiếu Content-Security-Policy

**Đính chính cơ chế:** các Cloudflare Worker hiện có **không phục vụ HTML** (chỉ proxy ảnh/API/cache) — HTML do GitHub Pages trả. Nên không thể set CSP qua Worker như bản plan đầu viết. Cách đúng: **Cloudflare Transform Rules → Response Headers** (dashboard, domain đã proxy qua Cloudflare), hoặc `<meta http-equiv>` từng trang.

**Kỳ vọng thực tế:** Tailwind Play CDN cần `unsafe-eval`, inline `<script>` nằm khắp nơi cần `unsafe-inline` → CSP **sẽ không chặn được XSS inline**. Giá trị chỉ ở mức hạn chế domain nạp script/ảnh, cho tới khi bỏ Tailwind CDN và gom inline script. Ưu tiên thấp, đừng coi là lá chắn XSS.

---

## Nhóm C — DDoS / Spam / Lạm dụng tài nguyên

DDoS tầng mạng (L3/L4) đã được Cloudflare lo, miễn domain đang **proxy (orange cloud)**. Rủi ro thật ở **tầng ứng dụng**: spam không cần làm sập site, chỉ cần đội chi phí Supabase/AI hoặc phình DB.

### 11. Tạo thiệp draft không giới hạn
`wedding-admin/index.ts:176-212` — POST public, không token, **không rate-limit**. Script đơn giản tạo được vô hạn bản ghi rác.
**Giải pháp:** sau khi áp #3 (bắt buộc đăng nhập để tạo) thì rủi ro giảm mạnh — còn lại thêm rate-limit theo `user_id`/IP (mẫu: `ai-invitation/index.ts:705-738`).

### 12. `guest-handler` không rate-limit
Đã giới hạn **dung lượng mỗi request** (`MAX_PER_SIDE=100`, `MAX_FIELD_LEN=200`, ≤200 id/lần) nhưng **không giới hạn tần suất**. Lặp vô hạn chu trình import/xoá là dội được request vào Supabase.
**Giải pháp:** rate-limit theo IP/`wedding_id`. **Cloudflare Rate Limiting Rules (dashboard)** là lớp chặn rẻ và nhanh hơn đếm trong DB — nên làm trước.

### 13. `payos-webhook-proxy.js` — chuyển tiếp mở
Nhận **mọi POST ≥ 20 ký tự** và forward vào Supabase ở background, luôn trả `200`. Vừa là điểm khuếch đại spam miễn phí, vừa **nuốt lỗi** khiến PayOS không retry (xem #1).
**Giải pháp:** gộp với bước 2 của #1 — trả status thật + rate-limit theo IP (Cloudflare KV/Durable Object) trước khi forward.

### 14. `wedding-cache-proxy.js` — PATCH/DELETE không giới hạn
Chỉ GET được cache; PATCH/DELETE forward thẳng, không giới hạn tần suất.
**Giải pháp:** rate-limit riêng cho PATCH/DELETE theo IP.

### 15. Không có CAPTCHA/Turnstile
Không tích hợp ở bất kỳ form public nào.
**Giải pháp:** cân nhắc Turnstile cho `ai-invitation` (tốn phí LLM). Sau khi #3 bắt buộc đăng nhập, nhu cầu CAPTCHA ở luồng tạo thiệp giảm đáng kể — **đánh giá lại sau #3 rồi mới quyết**.

---

## Nhóm D — Chuỗi cung ứng

### 16. Script CDN không SRI, một số không pin version
Mọi trang — kể cả admin và luồng thanh toán — nạp lib từ `cdn.jsdelivr.net`, `cdnjs.cloudflare.com`, `unpkg.com`, `cdn.tailwindcss.com`. **Không thẻ nào có `integrity`.** Nặng nhất: `lucide@latest` (`invitation-setup/index.html:58`, `guests/index.html:12`) luôn lấy bản mới nhất tuyệt đối; `@supabase/supabase-js@2` chỉ pin major.

CDN hoặc gói npm bị chèn mã độc → chạy trên **mọi trang**, gồm cả nơi giữ session Supabase và luồng thanh toán.

**Giải pháp (có giới hạn thực tế):**
- **Pin version chính xác cho tất cả** — đặc biệt bỏ `@latest`.
- **Thêm SRI** cho lib tĩnh: `supabase-js`, `crypto-js`, `xlsx`, `cropperjs`, `leaflet`, `flatpickr`, `coloris`.
- **Không áp được SRI:** Google Fonts CSS (nội dung đổi theo user-agent) và `cdn.tailwindcss.com` (script JIT) — chấp nhận ngoại lệ, hoặc tự host về repo.

### 17. Tự parse localStorage lấy session
`core/payment.js:712-725` tự tìm key `sb-*-auth-token` rồi `JSON.parse` — đúng thứ `CLAUDE.md` đã cấm (token v2 có thể là `base64-...` → parse vỡ, `catch` nuốt lỗi → user đã đăng nhập bị coi là chưa).
**Giải pháp:** dùng `supabase.auth.getUser()`/`getSession()`.

---

## Nhóm E — Mức THẤP

- `core/config.js:31` — `purgeSecret` Cloudflare hardcode trong bundle client. Chuyển purge qua Edge Function/Worker có xác thực riêng.
- Rate-limit IP của `ai-invitation` dựa `x-forwarded-for` (spoof/luân chuyển được) — chấp nhận được ở quy mô hiện tại.

**Đã kiểm tra, không cần hành động:** không có `.env`/secret nào bị commit (`git ls-files` sạch); `npm audit` 0 lỗ hổng; `_shared/axiom.ts` không log dữ liệu nhạy cảm; service_role key chỉ nằm server-side, client chỉ dùng anon key.

---

## Thứ tự thi hành

**Đợt 1 — chặn chảy máu (không phá gì):**
1. Allowlist field PATCH (#2)
2. Validate domain field ảnh/QR (#3, lớp phòng thủ độc lập)
3. PayOS shadow mode + sửa proxy nuốt lỗi (#1 bước 1-2)

> Riêng 3 việc này đã chặn được **tráo QR** và **bypass thanh toán** mà không đụng tới UX.

**Đợt 2 — đổi mô hình quyền (cần thông báo người dùng):**
4. Đếm số thiệp `user_id IS NULL` để lượng hoá tác động
5. Bắt buộc đăng nhập cho PATCH/POST + `guest-handler` (#3a, #3d)
6. Gate `invitation-setup` sau đăng nhập (#3c)
7. Grandfather thiệp cũ + log claim (#3b)

**Đợt 3 — siết đường đọc:**
8. Migration RLS + bảng rate-limit (#4a)
9. Allowlist field cho GET public (#4b)
10. PayOS hard-fail sau khi log xác nhận (#1 bước 3)

**Đợt 4 — vệ sinh:**
11. Admin token qua header + constant-time (#5)
12. Rate-limit Cloudflare Rules (#12, #13, #14), gộp escapeHtml (#8), filter injection (#7), CORS (#6)
13. Pin version + SRI (#16), `getCurrentUser()` (#17), bucket MIME policy (#9), purgeSecret (Nhóm E)
14. Đánh giá lại nhu cầu Turnstile (#15) và CSP (#10)

---

## Kiểm chứng

- **Webhook:** shadow mode → đọc log Axiom `payos.signature_check` sau giao dịch thật, xác nhận `matched: true` trước khi hard-fail. Sau hard-fail: POST payload sai chữ ký → `401`; giao dịch thật vẫn mở khoá thiệp bình thường.
- **Bypass thanh toán:** PATCH `{"payment_status":"completed"}` bằng tài khoản thường → field bị loại, DB không đổi.
- **Tráo QR:** PATCH `groom_qr_url` thành `https://example.com/x.png` → bị từ chối; mở lại trang thiệp, QR **không đổi**.
- **IDOR:** đăng nhập tài khoản A, PATCH thiệp của B → `403`. Thiệp `user_id NULL` → user đăng nhập đầu tiên claim được, user thứ hai bị `403`.
- **Sửa thiệp không đăng nhập** → bị chặn kèm thông báo rõ ràng, **không** phải lỗi 403 trần.
- **Xem thiệp công khai** (`/slug`, không đăng nhập) → vẫn hoạt động bình thường. Đây là bài test hồi quy quan trọng nhất của Đợt 2.
- **Rò rỉ đọc:** `curl` REST bằng anon key `?select=*` trên `weddings`/`guests`/`payment_logs` → bị từ chối/không trả toàn bảng. GET thiệp public → không còn `transaction_id`/`payment_order_id`/`user_id`.
- **Spam:** script 100 req/phút vào tạo draft và `guest-handler` → bị chặn sau ngưỡng.
- **Hạ tầng:** xác nhận domain Worker đang **proxy (orange cloud)**, không phải "DNS only".

---

## Đính chính so với bản plan đầu

Ghi lại để không lặp lại nhận định sai:

1. **PayOS:** bản đầu nói "chỉ cần bỏ comment, trả 401". Sai — bỏ qua rủi ro thuật toán ký có thể lệch, cộng với proxy nuốt lỗi → có thể mất đơn thật âm thầm. Đã đổi sang shadow mode.
2. **`payment-handler` "an toàn":** sai. Thuật toán ký của nó HMAC trên toàn payload → luôn từ chối cả webhook thật.
3. **CSP qua Cloudflare Worker:** sai cơ chế — Worker không phục vụ HTML. Phải dùng Transform Rules, và giá trị thực tế thấp vì Tailwind CDN + inline script.
4. **CORS:** bản đầu ngụ ý đây là biện pháp bảo vệ. Thực tế chỉ ràng buộc trình duyệt; với endpoint không auth thì vô dụng.
5. **Thiếu sót:** không phát hiện GET `select('*')` trả field thanh toán ra public — đây mới là đường rò đang sống, vì client đi qua Edge Function chứ không đọc bảng trực tiếp.
6. **RLS:** bản đầu ngụ ý RLS là fix chính. Thực tế client không truy vấn bảng trực tiếp → RLS là phòng thủ chiều sâu; authz thật nằm ở Edge Function.
7. **SRI:** không áp được cho Google Fonts và Tailwind CDN — cần ghi rõ ngoại lệ.
8. **Đánh số trùng:** `#11` từng dùng cho cả "spam draft" lẫn "purgeSecret". Đã đánh số lại.
