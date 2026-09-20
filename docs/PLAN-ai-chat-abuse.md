# Chống lạm dụng hai Edge Function AI (ai-chat, ai-invitation)

Hạn mức hiện tại — khách chưa đăng nhập **5 lượt/ngày** ở cả hai; đã đăng nhập **30**
(chat) và **15** (ai-invitation), hai con số khác nhau vì một cuộc trò chuyện tiêu nhiều
lượt hơn hẳn. Hằng số khai trong từng function, phép đếm dùng CHUNG ở
`supabase/functions/_shared/ai-rate-limit.ts` — một bảng `ai_chat_usage`, hạn mức của
hai tính năng tách nhau bằng tiền tố `chat:`/`inv:` trong `subject`.

Tài liệu này ghi **lỗ hổng còn lại ở nhánh chưa đăng nhập** và thứ tự vá. Vá tới đâu thì
đánh dấu tới đó, và cập nhật mục A10 ở `security-checklist.md`.

## Mối đe doạ

Mỗi lượt chat là một lần gọi Gemini (tới 8192 token out, lượt dựng thiệp ~45s). Khách
chưa đăng nhập không có danh tính nào để bám, nên kẻ lạm dụng chỉ cần đổi **chiều đếm**
là có lượt mới:

| Cách bypass | Lớp đang chặn | Còn hở? |
| --- | --- | --- |
| Đổi VPN / chuyển 4G ↔ wifi | mã thiết bị `dev:` (localStorage) | ✅ chặn được |
| Xoá localStorage / ẩn danh | IP (`cf-connecting-ip`) | ✅ chặn được |
| Đổi CẢ hai (VPN + ẩn danh) | — | ❌ còn hở, nhưng thủ công nên chậm |
| Gọi thẳng bằng `curl`, random `device`, chạy qua pool proxy | — | ❌ **hở thật**, tự động hoá được |
| Bắn N request **song song** từ đúng một IP | — | ❌ **hở nặng nhất**, xem mục 2 |

Header `Origin` KHÔNG chặn được gì (curl tự đặt), anon key có sẵn trong bundle, và
`cf-connecting-ip` chỉ đúng IP chứ không nói IP đó có phải người thật.

Thiệt hại: đốt quota Gemini của cả hệ thống → **mọi tính năng AI ngừng chạy** cho tới khi
quota hồi (chỉ có một provider, xem `_shared/ai-provider.ts`).

## Thứ tự vá

### 1. Đếm hai chiều cho khách vãng lai — ✅ đã làm

`ip:<addr>` và `dev:<mã>` cùng đếm, chiều nào chạm trần cũng chặn. Chặn được người dùng
bình thường bật VPN, KHÔNG chặn được script. Áp cho CẢ hai function.

### 2. Đếm nguyên tử — ❗ quan trọng nhất

`enforceRateLimit` đang `select count` → so sánh → `upsert count + 1`. Bắn 100 request
**song song** từ một IP thì cả 100 cùng đọc `count = 0`, cùng qua cửa, và bảng cuối cùng
ghi `count = 1`. Tức trần 5 lượt thực chất là 5 × số request bắn song song được, lặp lại
mãi, **không cần VPN hay proxy gì cả**. Mọi hạn mức khác trong hệ thống — kể cả trần toàn
cục ở mục 5 — đều thi hành bằng đúng đoạn code này, nên vá nó trước tất cả.

Cách vá: một hàm Postgres
`insert … on conflict (subject, day) do update set count = ai_*_usage.count + 1 returning count`,
chặn khi giá trị trả về vượt trần. Sửa đúng một chỗ trong `_shared/ai-rate-limit.ts`, không
đụng client. Sau khi vá, muốn thêm 5 lượt phải có thêm một IP sạch — chi phí của kẻ tấn
công chuyển từ "vô hạn miễn phí" sang tuyến tính theo số proxy.

### 3. `mode: "sample"` chưa kiểm `x-admin-token`

Nhánh này ghi chú là dành cho admin nhưng chỉ đi qua rate limit, ai gọi cũng được — mà nó
**không cần input** (`{"mode":"sample"}` là đủ) và chạy `GEN_CFG_SAMPLE` với
`maxOutputTokens: 65536`, đắt gấp ~8 lần một lượt chat. Đây là đường đốt quota rẻ nhất
hiện nay. Vá: bắt buộc `x-admin-token` như `wedding-admin`.

### 4. Cloudflare Turnstile cho nhánh chưa đăng nhập

Đây là lớp duy nhất phân biệt được "trình duyệt thật" với script. Miễn phí, chạy ẩn
(không bắt khách bấm gì trong đa số trường hợp).

- Client: nạp widget `turnstile` ở chế độ invisible khi khách MỞ bảng chat (đừng nạp
  sẵn ở mọi trang — đó là một script bên thứ ba), lấy token.
- `ai-chat` nhận `turnstile` trong body ở **lượt đầu của phiên**, verify với
  `https://challenges.cloudflare.com/turnstile/v0/siteverify` (secret `TURNSTILE_SECRET`,
  đặt riêng cho staging và production), rồi phát một **phiếu** JWT ký HMAC: payload
  `{ sub: sha256(ip + device), exp: +24h }`.
- Các lượt sau gửi lại phiếu; không có phiếu hợp lệ → 401, không gọi model.
- Vẫn giữ nguyên phép đếm ở bước 1: phiếu chỉ chứng minh "có người thật ở đầu kia",
  không cấp thêm lượt.
- Việc kèm theo: thêm `turnstile` vào body allowlist, thêm miền
  `challenges.cloudflare.com` vào CSP (`script-src`, `frame-src`, `connect-src`) — thiếu
  là widget chết im ở Console.

### 5. Trần ngân sách TOÀN CỤC cho nhánh anon

Hạn mức cá nhân không chặn được botnet nhiều IP. Thêm một hàng đếm chung
(`subject = 'global:anon'`, cùng bảng): quá `ANON_GLOBAL_DAILY` (đề xuất
1500–2000 lượt/ngày) thì nhánh chưa đăng nhập trả 429 "vui lòng đăng nhập", khách đã
đăng nhập không bị ảnh hưởng. Đây là cái chốt giữ cho quota Gemini không bao giờ cạn sạch
vì chat.

### 6. Cảnh báo sớm

Đã có `log.info('chat.answered', { anon })` lên Axiom. Thêm một monitor: số lượt anon/giờ
vượt ngưỡng, hoặc số subject anon mới/giờ tăng đột biến → báo. Bị lạm dụng mà biết sau
một ngày thì quota đã cháy rồi.

### 7. Siết chi phí mỗi lượt của khách vãng lai (tuỳ chọn)

Nhánh anon chủ yếu để tư vấn, không cần dựng trọn thiệp: có thể hạ `maxOutputTokens` và
`MAX_TURNS` cho anon, và chỉ mở lượt dựng thiệp (`type: "card"`) cho tài khoản đã đăng
nhập. Vừa giảm thiệt hại khi bị lạm dụng, vừa là lý do tự nhiên để khách đăng nhập.

## Những cách đã cân nhắc và BỎ

- **Fingerprint trình duyệt (canvas/font…)**: chống được ít hơn Turnstile, lại là dữ liệu
  cá nhân — không đáng đánh đổi.
- **Chặn theo dải /24 hoặc theo ASN**: mạng di động Việt Nam dùng CGNAT, rất nhiều khách
  thật chung một IP ra ngoài → chặn nhầm người thật.
- **Proof-of-work ở client**: làm chậm kẻ tấn công vài giây, nhưng cũng làm nóng máy khách
  thật; Turnstile rẻ hơn về mọi mặt.
