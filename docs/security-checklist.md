# Checklist bảo mật — trạng thái từng hạng mục

**Mục đích:** lần rà sau (người hay AI) đọc file này TRƯỚC, để khỏi dò lại những chỗ đã
kiểm. Mỗi dòng ghi **chốt nằm ở đâu**, nên xác minh lại một hạng mục là một lệnh grep chứ
không phải đọc cả repo.

**Cách dùng:**

- Dòng `[x]` = đã kiểm, đang đúng → **đừng rà lại** trừ khi file ghi ở cuối dòng có thay đổi
  trong git log kể từ ngày rà.
- Dòng `[ ]` = đang hở. Đây là việc phải LÀM, không phải việc phải đi TÌM.
- Vá xong một dòng → đổi `[ ]` thành `[x]`, ghi chốt mới + ngày, **giữ nguyên dòng đó**. Xoá
  đi là lần sau có người dò lại từ đầu.
- Thêm tính năng mới → chạy phần "Bất biến" (mục C), đó mới là thứ sinh ra lỗ hổng mới.

**Các đợt rà trước:** [security-audit-plan.md](security-audit-plan.md) (2026-07, vòng vá lớn
đầu tiên) · [security-audit-2026-09.md](security-audit-2026-09.md) (2026-09-10, rà bản `dist/`
và API production bằng curl — có sẵn lệnh đo, chạy lại được).

---

## ⚠️ Trạng thái: đã vá trong MÃ NGUỒN, CHƯA deploy

Đợt vá 2026-09-16 sửa A1–A21. **Mã trên máy đã sạch nhưng production vẫn đang chạy bản
cũ** cho tới khi làm xong mục F. Đừng đọc bảng `[x]` bên dưới thành "production đã an toàn".

---

## A. Kết quả đợt rà 2026-09-15 và vá 2026-09-16

### 🔴 Nhóm chặn phát hành

- [x] **A1. Webhook PayOS bỏ qua chữ ký → thanh toán giả được.**
      Trước: `PAYOS_ENFORCE_SIGNATURE` không bật thì chữ ký sai VẪN xử lý đơn → tự POST một
      đơn "đã trả tiền" là có thiệp miễn phí vĩnh viễn.
      **Đã vá** `supabase/functions/payos-webhook/index.ts`, ba việc:
      1. `payosValue()` — chuẩn hoá giá trị đúng quy ước PayOS (`null`/`undefined` → chuỗi
         RỖNG, mảng → `JSON.stringify`). Bản cũ nối thẳng `${value}` nên ra `"null"`, chữ ký
         LUÔN lệch — đó là lý do phải để shadow mode mãi.
      2. Bỏ hẳn shadow mode. Chữ ký không khớp → `confirmWithPayOS()` hỏi thẳng
         `GET /v2/payment-requests/{orderCode}`; chỉ `status === "PAID"` mới đi tiếp.
      3. Không lớp nào qua → 401, không đụng DB.
      Hai lớp này fail-closed với kẻ giả mạo mà không rủi ro chặn nhầm giao dịch thật nếu
      quy ước ký của PayOS lại đổi. Biến `PAYOS_ENFORCE_SIGNATURE` **không còn được đọc**.
      Theo dõi `payos.signature_mismatch` trên Axiom: còn nổ nghĩa là lớp 1 vẫn lệch.

- [x] **A2. `create-payment` không kiểm quyền với `manage_id`.**
      Trước: `upsert` theo id client gửi lên, không cần đăng nhập → lấy `id` từ `?slug=` công
      khai rồi ghi đè slug/theme/trạng thái thanh toán thiệp người khác.
      **Đã vá** `supabase/functions/payment-handler/index.ts`: thêm `resolveAuthUserId()`,
      bắt buộc JWT (401 `AUTH_REQUIRED`), đối chiếu `weddings.user_id` (403 `FORBIDDEN`),
      thiệp vô chủ thì người thanh toán nhận làm chủ, và `existingSlug` giữ nguyên slug cũ
      thay vì đặt lại theo `customer_name`. Hai `upsert` đều ghi `user_id: buyerId`.

- [x] **A3. Stored XSS trên trang thiệp (dữ liệu vào thuộc tính HTML không escape).**
      **Đã vá cả hai đầu:**
      - *Client:* thêm `cxImgSrc()` và `cxFocal()` ở `core/utils.js` — `cxImgSrc` chặn scheme
        lạ rồi `escapeHtml`, `cxFocal` ép toạ độ về số. Thay vào **9/9 theme**,
        `core/helpers/render-helper.js`, và ba file của trang Thiết lập
        (`10-images.js`, `14-timeline-story.js`, `18-theme-picker.js`).
      - *Server:* `isSafeImageRef` đổi sang ALLOWLIST `^[A-Za-z0-9._-]{1,120}$` (bản cũ chỉ
        chặn `:` `//` `..` `/` `\` nên `a" onerror="…` lọt); thêm `cleanLoveStory()`,
        `cleanTimeline()`, `cleanFocal()` làm sạch JSONB trong `wedding-admin` PATCH;
        `image_focal_points` ép về số.
      - `ALLOWED_IMAGE_HOSTS` bổ sung host staging — thiếu nó thì bộ lọc mới loại sạch ảnh
        trên staging.

- [x] **A4. `*_map_embed_url` → `iframe.src` / `a.href` không kiểm host.**
      **Đã vá** `extractMapEmbedUrl` (`core/utils.js`): parse bằng `new URL`, bắt buộc
      `https:` và host thuộc `CX_MAP_HOSTS` (google.com / www / maps), không hợp lệ trả `""`.
      `renderMap` coi `""` là "chưa có bản đồ" nên `javascript:` và iframe lạ không vào được.

### 🟠 Cao

- [x] **A5. Dò mã giảm giá bằng ký tự đại diện.**
      **Đã vá** `wedding-admin`: `.ilike()` → `.eq(code.toUpperCase())` kèm allowlist
      `^[A-Za-z0-9-]{1,40}$`. Mọi mã trong DB đều viết hoa (cả `mode=single` lẫn
      `randomPart`) nên gõ thường vẫn nhận.

- [x] **A6. Đổi `theme` sau khi đã thanh toán.**
      **Đã vá** `wedding-admin` PATCH: đã thanh toán thì chỉ đổi sang mẫu có
      `template_pricing.price ≤ payment_amount`, đắt hơn → 402 `THEME_UPGRADE_REQUIRED`.
      Khách vẫn đổi mẫu thoải mái trong tầm tiền đã trả.
      *Muốn mở hẳn ("trả tiền một lần, đổi mẫu tuỳ ý") thì xoá khối đó — nhớ đổi dòng này.*

### 🟡 Trung bình

- [x] **A7. Worker cache phá vỡ kiểm chủ sở hữu.**
      **Đã vá** `cloudflare-worker/wedding-cache-proxy.js`: `isCacheable` bỏ `id` (chỉ còn
      `slug`), và thêm `isPrivileged` — request mang `x-admin-token` nhận bản `SELECT *` nên
      tuyệt đối không được cache.

- [x] **A8. postMessage không kiểm origin.**
      **Đã vá** ba listener: `core/utils.js:~1006` giờ đòi `e.source` đúng
      `iframe.cx-pshell-view` **và** url phải bắt đầu bằng `/`; hai listener ở
      `core/helpers/theme-setting-helper.js` thêm `ev.source !== window.parent`.

- [x] **A9. Không có header bảo mật nào.**
      **Đã thêm** file `_headers` ở gốc repo + khai vào `INCLUDE` của
      `scripts/deploy-public.mjs`: CSP, `X-Frame-Options`, `nosniff`, `Referrer-Policy`,
      `Permissions-Policy`, HSTS.
      ⚠️ CSP còn `'unsafe-inline'` cho `script-src` vì mã hiện tại còn `onclick` trong markup
      và `<script>` nội tuyến (`router.html`, `404.html`, `x-button`…). Nó vẫn chặn nạp
      script từ miền lạ / gửi dữ liệu ra miền lạ / nhúng iframe lạ, nhưng **chưa chặn được
      XSS nội tuyến** — gỡ hết inline rồi đổi sang nonce mới là chặn thật.
      ⚠️ Cloudflare TỰ chèn beacon Web Analytics (`static.cloudflareinsights.com`) vào mọi
      phản hồi HTML dù mã nguồn không có — hai miền `static.cloudflareinsights.com` và
      `cloudflareinsights.com` phải nằm trong `script-src`/`connect-src`, thiếu là mọi trang
      báo lỗi CSP ở Console. Thêm dịch vụ nào của Cloudflare cũng kiểm lại điểm này.

- [x] **A10. Rate limit AI bypass bằng header.**
      **Đã vá** `clientIp()` ở cả `ai-invitation` và `ai-chat`: ưu tiên `cf-connecting-ip`,
      với `x-forwarded-for` lấy phần tử **CUỐI** (do proxy của mình nối vào) thay vì phần tử
      đầu (giá trị client tự gửi).
      *(Race check-rồi-upsert vẫn còn — trần bị vượt chút ít khi gọi song song, chấp nhận được.)*

- [x] **A11. Slug không validate ở server.**
      **Đã vá**: `isValidSlug()` (`^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$`) áp ở cả POST và
      PATCH của `wedding-admin` → 400 `INVALID_SLUG`. `router.html` encode `slug`, và lọc
      `theme` theo `^[a-z0-9][a-z0-9-]*$` trước khi ghép vào đường dẫn.

- [x] **A12a. `guest-handler` so token bằng `===`.**
      **Đã vá**: thêm `timingSafeEqual` cùng dạng với `wedding-admin`/`cleanup-weddings`.
- [x] **A12b. `wishes-list` trả `full_name`.** → **Theo thiết kế, giữ nguyên.** Chỉ trả về
      khách CÓ lời chúc, và đúng cái tên vẫn chạy trên dải lời chúc của thiệp — tức thông tin
      này vốn đã công khai. Đổi sang chỉ `display_name` làm mọi khách nhập bằng Excel (chỉ có
      `full_name`) hiện thành "Khách mời". Khớp audit 2026-09-10 #4.
- [ ] **A12c. `rsvp`/`wish` không rate limit.** Chưa vá — chặn ở tầng Cloudflare, xem mục E.

- [x] **A13. `returnUrl`/`cancelUrl` lấy từ header `origin`.**
      **Đã vá**: `allowedBaseUrl()` trong `payment-handler` — allowlist ba miền của hệ thống,
      cộng localhost cho trang admin; Origin lạ rơi về `https://cuoixinh.com`.

- [x] **A14. SRI thiếu ở một nửa script bên thứ ba.**
      **Đã vá**: tính `sha384` thật rồi thêm `integrity` + `crossorigin` cho `crypto-js`,
      `cropperjs`, `xlsx`, `xlsx-js-style`, `coloris`, `leaflet` trên **14 file HTML**. Đo
      lại bằng lệnh ở mục D — hiện ra rỗng.

### ⚪ Siết thêm

- [x] **A15.** `cloudflare-worker/image-proxy.js`: `decodeURIComponent` rồi ép allowlist
      `^[A-Za-z0-9._-]{1,120}$`, sai → 400. Chặn `%2e%2e%2f` đi ra khỏi thư mục bucket.
- [ ] **A16.** Bucket `wedding-images` chưa giới hạn MIME/kích thước ở phía Supabase → mục E.
- [x] **A17.** `core/bl/image-bl.js`: thêm `safeExt()` (đuôi suy từ **kiểu MIME**, không từ
      `file.name` do client đặt) và `safeField()`. Tên file sinh ra giờ khớp đúng allowlist mà
      `isSafeImageRef` và `image-proxy` cùng dùng.
- [x] **A18.** `Math.random` → `cxUUID()` (`crypto.randomUUID` → `getRandomValues` → mới lùi
      về Math.random) ở `core/utils.js`, dùng lại ở `core/bl/image-bl.js` và
      `invitation-setup/js/10-images.js`. `core/helpers/draft-start.js` — nơi sinh **id quản
      lý thiệp** — tự dựng bản riêng vì nạp ở trang không chắc có `core/utils.js`.
- [x] **A19. `payment_logs` lưu email/SĐT thô.** → **Chấp nhận.** Đây là sổ sách đối soát đơn
      hàng, cần đọc được; bảng chỉ `service_role` chạm tới (`anon`/`authenticated` không có
      quyền — `dqvinh_008_grants.sql`). Che đi là mất khả năng tra cứu mà không bớt rủi ro.
- [x] **A20.** `cleanup-weddings` đọc `CLEANUP_SECRET_TOKEN`, **lùi về** `ADMIN_SECRET_TOKEN`
      nếu chưa đặt (không gãy cron đang chạy). Đặt token riêng → mục E.
- [x] **A21. CORS cho phép mọi cổng localhost ở production.** → **Cố ý, giữ nguyên.** Trang
      `admin/` chỉ chạy local nhưng CÓ trỏ vào production (dải chọn môi trường,
      `localStorage.admin_env`) nên production buộc phải nhận Origin localhost. Không phải
      lỗ hổng tự nó: mọi nhánh admin vẫn đòi `x-admin-token`, và website khác không đặt được
      Origin thành localhost.
- [x] **Phụ.** `payos-webhook` bỏ `console.log` dump cả payload (mang chữ ký) và bỏ in chữ ký
      kỳ vọng/nhận được ra log.

---

## B. ĐÃ ĐÓNG từ trước — đừng dò lại

Rà bằng cách đọc mã ngày **2026-09-15**, trừ dòng ghi rõ nguồn khác.

### Phân quyền & truy cập dữ liệu

- [x] Trình duyệt **không** gọi thẳng PostgREST — `grep -rn "/rest/v1/"` ra **rỗng**.
- [x] `anon`/`authenticated` không còn quyền trên bảng nào —
      `changelogs/RC01/schema/dqvinh_008_grants.sql`; đo bằng curl ở audit 2026-09-10.
- [x] PATCH thiệp: bắt buộc đăng nhập + `user_id` khớp — `wedding-admin/index.ts`, khối
      "Phân quyền sửa thiệp".
- [x] DELETE thiệp: chủ thiệp hoặc admin; thiệp vô chủ chỉ admin xoá được.
- [x] GET `?id=` phải là chủ thiệp; `?slug=` là đường công khai DUY NHẤT.
- [x] Allowlist field khách được sửa — `CUSTOMER_EDITABLE_FIELDS`.
- [x] GET công khai không trả field thanh toán (`expires_at`/`payment_status` lấy để XÉT rồi
      `delete` khỏi response).
- [x] Quản lý khách mời: JWT + kiểm chủ thiệp ở mọi nhánh — `denyIfNotOwner` /
      `denyIfNotOwnerOfGuests`.
- [x] `deleted_images` chỉ xoá được ảnh THUỘC thiệp đó, đối chiếu qua
      `_shared/wedding-images.ts`.
- [x] Admin token so bằng `timingSafeEqual`, chỉ đọc từ header (không còn `?token=`) — cả ba
      function (`guest-handler` bổ sung ở A12a).
- [x] `admin/` không lọt vào bản publish — chốt là `assets.directory = "./dist"`.
- [x] `CONFIG.cloudflare.purgeSecret` bị REDACT thành `null` trong `dist/core/config.js`.
- [x] Không có file secret nào bị commit.

### Kho ảnh (Storage)

- [x] Tên file **không** chứa `wedding_id` — `core/bl/image-bl.js`. Audit 2026-09-10 #2.
- [x] Policy `storage.objects`: chỉ `insert` + `select` bó theo `owner_id` cho
      `authenticated`; không cấp `delete`/`update` cho ai —
      `changelogs/RC01/manual/dqvinh_001_storage_policies.sql`. Giữ `select` là BẮT BUỘC
      (`insert … returning`), đừng "dọn" nó đi.
- [x] Client không có hàm xoá file — `core/dal/storage-dal.js` cố ý không có `deleteFile`.
- [x] Upload dùng `upsert: false` → không ghi đè file người khác.
- [x] Chưa đăng nhập thì không upload — `invitation-setup/js/12-uploads.js`.

### Thanh toán

- [x] Giá lấy từ bảng `template_pricing` trong DB, KHÔNG từ client.
- [x] Webhook đối chiếu số tiền với `payment_amount` do backend ghi.
- [x] Mã giảm 100% (đơn 0đ) bắt buộc `uid:` từ JWT, không nhận email gõ tay.
- [x] `used_count` và `code` không sửa tay được qua PATCH admin.
- [x] Mã đã có đơn chốt thì chỉ TẮT được, không xoá.

### XSS đã chặn đúng từ trước

- [x] Lời chúc khách mời (tên + nội dung) đi qua `escapeHtml` —
      `core/helpers/wishes-helper.js`.
- [x] `setText()` dùng `textContent`, không phải `innerHTML` — `core/utils.js`.
- [x] Khối văn bản / preset / thành phần trong `theme_setting` dựng bằng `createElement` +
      `textContent` — `core/helpers/theme-setting-helper.js`.
- [x] Vị trí/kích thước thành phần gán qua CSSOM (`node.style.left = …`).
- [x] Gradient chữ tuỳ chỉnh đi qua `_cxSafeColor()` trước khi vào chuỗi style.
- [x] `extractMapEmbedUrl` giải mã HTML entity bằng `textarea.innerHTML` — đúng, đó là ngữ
      cảnh RCDATA nên script không chạy.
- [x] `05-theme-panel.js` kiểm `ev.source !== iframe.contentWindow`; `gift-box-helper.js` và
      `preview-focus-helper.js` kiểm `ev.source !== window.parent`.

### Khác

- [x] Rate limit AI theo user/ngày và IP/ngày có tồn tại (cách lấy IP vá ở A10).
- [x] API key Gemini chỉ đọc từ secret, không bao giờ log URL.
- [x] Axiom rút gọn `id` còn 8 ký tự trong log.
- [x] Version CDN đã pin hết, không còn `@latest` (SRI bổ sung ở A14).
- [x] Giới hạn số lượng: 10 ảnh album / 10 mốc lịch trình / 10 mốc chuyện tình; 100 khách mỗi
      bên, 3 lời chúc mỗi khách.
- [x] `?id=` không còn được coi là bí mật — nguyên tắc rút ra ở audit 2026-09-10.

---

## C. Bất biến — kiểm mỗi khi viết code mới

Đây là những luật mà VI PHẠM là sinh ra đúng các lỗ hổng ở mục A. Thêm tính năng thì chạy qua
danh sách này, đừng chờ đợt rà sau.

- [ ] **Ghép chuỗi vào `innerHTML`** → giá trị từ DB/người dùng phải qua `escapeHtml()`,
      **kể cả trong `src=""`, `style=""`, `href=""`**. Ảnh dùng `cxImgSrc()`, điểm lấy nét
      dùng `cxFocal()` (cả hai ở `core/utils.js`). Đây là chỗ đã thủng 4 lần (A3).
- [ ] **Gán `el.src` / `el.href` / `iframe.src`** từ dữ liệu người dùng → allowlist host.
      `javascript:` là XSS, `https://` lạ là phishing (A4).
- [ ] **Worker/Edge Function dùng chung mã cho hai môi trường** → đích (URL Supabase, khoá)
      phải lấy từ biến môi trường và **không được có giá trị mặc định**. Mặc định trỏ vào một
      môi trường cụ thể thì bản kia quên khai `[vars]` sẽ im lặng ghi nhầm DB — với
      `payos-webhook-proxy` là webhook tiền của kênh này rơi vào project kia, không gì báo.
      Thiếu cấu hình thì phải hỏng TO (500 + log), đừng lùi về mặc định.
- [ ] **Thêm `addEventListener("message")`** → kiểm `ev.source` NGAY dòng đầu, trước khi đọc
      `ev.data` (A8).
- [ ] **Thêm endpoint Edge Function nhận `id`/`manage_id`** → kiểm JWT + `user_id`. `id` là
      ĐỊNH DANH, không phải quyền (A2).
- [ ] **Thêm cột `weddings` khách sửa được** → khai vào `CUSTOMER_EDITABLE_FIELDS`; nếu là
      cột ảnh thì khai thêm ở `_shared/wedding-images.ts` (thiếu là file nằm lại bucket vĩnh
      viễn) và ở `IMAGE_FIELDS` (thiếu là tráo được QR ngân hàng).
- [ ] **Thêm cột JSONB khách sửa được** → viết hàm `clean*()` cùng kiểu `cleanLoveStory`.
      Kiểm ĐỘ DÀI mảng là không đủ (A3).
- [ ] **Thêm tham số người dùng vào truy vấn Supabase** → `.eq()` chứ không `.ilike()`; buộc
      dùng `ilike` thì escape `%` và `_` (A5).
- [ ] **Thêm cache (Worker/KV)** → key phải gồm MỌI thứ ảnh hưởng tới quyền xem. Response chỉ
      chủ sở hữu đọc được thì **không cache** (A7).
- [ ] **Thêm script từ CDN** → pin version + `integrity` + `crossorigin` (A14).
- [ ] **Thêm host/miền mới** → khai vào `ALLOWED_ORIGINS` của **ba** function
      (`_shared/ai-provider.ts`, `wedding-admin`, `guest-handler`), `ALLOWED_BASE_URLS` của
      `payment-handler`, `ALLOWED_IMAGE_HOSTS` của `wedding-admin`, và `connect-src` của CSP
      trong `_headers`.
- [ ] **Sửa Edge Function** → deploy CẢ HAI project (`npm run deploy:functions:all`).
- [ ] **Thêm file/thư mục ở gốc repo** → khai vào `INCLUDE` của `scripts/deploy-public.mjs`,
      không thì không ra web mà chẳng có gì báo.

---

## D. Lệnh dò nhanh

Chạy lại được, dùng để kiểm một LỚP thay vì đọc từng file. Tính tới 2026-09-16 cả bốn lệnh
đầu đều ra rỗng.

```bash
# Có ai gọi thẳng PostgREST từ trình duyệt không
grep -rn "/rest/v1/" --include=*.js core/ js/ invitation-setup/ my-invitations/ checkout/ public/ admin/

# Nội suy vào thuộc tính HTML mà không escape (nguồn của A3)
grep -rn 'src="\${\|style="\${\|href="\${' --include=*.js core/ public/themes/ js/ invitation-setup/ my-invitations/ \
  | grep -v 'cxImgSrc\|cxFocal\|escapeHtml\|esc(\|escAttr\|_escHtml'

# Listener postMessage thiếu kiểm nguồn (nguồn của A8)
grep -rn -A3 'addEventListener("message"' --include=*.js core/ js/ invitation-setup/ public/

# Script bên thứ ba thiếu SRI (nguồn của A14)
for f in $(git ls-files '*.html' | grep -v dist/); do
  grep -o '<script[^>]*src="https://[^"]*"[^>]*>' "$f" | grep -v cuoixinh.com | grep -v integrity | sed "s|^|$f  |"
done

# Cú pháp toàn bộ Edge Function (không cần cài Deno)
node -e "const{transform}=require('sucrase'),fs=require('fs');for(const f of process.argv.slice(1)){try{transform(fs.readFileSync(f,'utf8'),{transforms:['typescript'],filePath:f})}catch(e){console.log('LỖI',f,e.message.split('\n')[0])}}" supabase/functions/*/index.ts supabase/functions/_shared/*.ts

# Secret lọt vào bản publish (script deploy tự chặn, đây là kiểm chéo)
grep -rniE "service_role|sbp_[0-9a-f]{40}|sb_secret_" dist/ | head
```

Đo trên **API production** (không phải repo): xem các lệnh curl trong
[security-audit-2026-09.md](security-audit-2026-09.md).

---

## E. Chỉ làm được ngoài repo (Dashboard)

- [ ] **A16.** Bucket `wedding-images`: đặt `allowed_mime_types` (jpeg/png/webp/gif/avif) và
      `file_size_limit`. Client đã chặn nhưng gọi API trực tiếp thì bỏ qua được.
- [ ] **A12c.** Cloudflare Rate Limiting Rules cho `guest-handler` (`action=rsvp|wish`),
      endpoint `?resource=promo`, và `wedding-admin`.
- [ ] **A20.** Đặt `CLEANUP_SECRET_TOKEN` (khác `ADMIN_SECRET_TOKEN`) ở cả hai project, rồi
      cập nhật Vault `cleanup_token` mà pg_cron dùng. Chưa đặt thì vẫn chạy bằng mã admin.
- [ ] Job `cx-cleanup-weddings` đã schedule trên **cả hai** project:
      `select * from cron.job where jobname = 'cx-cleanup-weddings';`
- [ ] Bảng Storage → Policies đúng như `dqvinh_001_storage_policies.sql` mô tả. Đọc kỹ cột
      **APPLIED TO**: `public` trong Postgres nghĩa là MỌI role, gồm cả `anon` — chỗ này từng
      bị đọc nhầm một lần, xem audit 2026-09-10.
- [x] ~~`PAYOS_ENFORCE_SIGNATURE`~~ — **không còn dùng.** A1 bỏ hẳn cờ này; xoá khỏi secret
      của cả hai project cho gọn (để lại cũng vô hại, mã không đọc tới).

---

## F. Việc phải làm để bản vá có hiệu lực

Mã đã sạch nhưng **production vẫn chạy bản cũ**. Thứ tự bắt buộc: SQL → Edge Function → web,
làm trọn trên staging trước rồi lặp lại y hệt trên production.

- [ ] **1. Edge Function, CẢ HAI project.** `npm run deploy:functions:all`
      Đợt này đụng: `payos-webhook`, `payment-handler`, `wedding-admin`, `guest-handler`,
      `cleanup-weddings`, `ai-invitation`, `ai-chat`. (Không có thay đổi SQL.)
- [ ] **2. Cloudflare Worker** (deploy tay từ `cloudflare-worker/`):
      `wedding-cache-proxy` và `image-proxy`.
- [ ] **3. Web.** `CX_VERSION` đã bump sang `2026.09.16-1` → `npm run production`.
- [ ] **4. Kiểm sau deploy:**
      - Thanh toán thật một đơn trên staging → thiệp mở khoá; xem Axiom có
        `payos.signature_mismatch` không (có = lớp 1 vẫn lệch, lúc đó đang sống nhờ lớp 2).
      - Thử POST webhook giả (orderCode thật, chữ ký sai) → phải ăn **401**.
      - Lưu thiệp có ảnh + mốc chuyện tình + bản đồ → không mất dữ liệu, ảnh vẫn hiện.
      - Mở thiệp công khai bằng trình duyệt ẩn danh → chạy bình thường, Console không báo CSP
        chặn nhầm thứ gì.
      - `curl -sI https://cuoixinh.com | grep -i "content-security\|x-frame"` → phải thấy
        header. Không thấy = Workers Assets không đọc `_headers`, khi đó phải chuyển sang đặt
        header bằng Transform Rules trên Cloudflare.
