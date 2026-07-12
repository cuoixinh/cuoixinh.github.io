# AI sinh nội dung thiệp — Hướng dẫn setup

Tính năng: người dùng nhập vài thông tin (tên, ngày cưới, văn phong, đôi nét chuyện tình) **và một ô "thông tin cá nhân" tự do** → AI vừa **sinh** nội dung sáng tạo vừa **trích xuất** dữ liệu vào gần hết các trường của thiệp (trừ ảnh). AI trả về JSON `{ story_quote, love_story[], timeline[], fields{} }` → xem trước → áp dụng vào form thiệp.

`fields` phủ: tên, tên/ngày/giờ/nơi lễ, Vu Quy, cha mẹ + địa chỉ hai bên, ngày/giờ/nơi tiệc nhà trai & nhà gái, lời mời RSVP, lời cảm ơn footer, và ngân hàng/STK/chủ TK hai bên. **Không** gồm: ảnh, link bản đồ nhúng, nhạc. AI chỉ trích thông tin người dùng cung cấp, không bịa.

**Tham số tuỳ chọn của input:** `region` (`""`|`bac`|`trung`|`nam` — điều chỉnh cách xưng hô & tên nghi lễ theo vùng). Số mốc chuyện tình do AI tự quyết theo ngữ nghĩa. Form còn có nút **"Chèn mẫu"** đổ sẵn khung để người dùng điền vào ô "thông tin cá nhân".

### Streaming (mặc định của UI)
AI được prompt trả về **MẢNG JSON phẳng các "block"** (không lồng) — mỗi phần tử là một object độc lập, nên có thể parse & hiển thị **từng block** khi đang stream:

```json
[
  {"type":"text","key":"story_quote","value":"..."},
  {"type":"love","date":"03/2021","title":"...","content":"..."},
  {"type":"timeline","time":"11:00","title":"Lễ thành hôn","kind":"ceremony"},
  {"type":"field","key":"groom_father","value":"Nguyễn Văn X"}
]
```

Client gửi `{ "stream": true }`. Edge Function đọc SSE của Gemini (`streamGenerateContent?alt=sse`), **tách + validate/clamp từng block ở server** rồi trả **NDJSON** — mỗi dòng một sự kiện:
- `{"block": {...}}` — một block đã sạch.
- `{"full": {...}}` — kết quả đầy đủ (khi phải fallback Groq non-stream).
- `{"meta": {"done": true, "provider": "gemini"}}` hoặc `{"meta": {"error": "..."}}` — dòng cuối.

Bảo mật vẫn nguyên (clamp/whitelist ở server). Fallback Groq chỉ chạy nếu Gemini lỗi **trước** block đầu tiên. Nếu client không gửi `stream`, dùng đường non-stream cũ trả `{ data, provider }` (UI tự fallback sang đường này khi stream lỗi).

- **AI chính:** Google Gemini `gemini-2.5-flash` (nhiều key xoay vòng)
- **Fallback:** Groq `llama-3.3-70b-versatile`
- **Chi phí:** $0 (dùng free tier của cả hai)

---

## 1. Kiến trúc & bảo mật

```
[Modal "Tạo bằng AI"]  invitation-setup/index.html + index.js
        │  aiDAL.generateInvitation()  (gắn JWT của user)
        ▼
[Edge Function ai-invitation]  supabase/functions/ai-invitation/index.ts
        │  • KHÔNG bắt buộc đăng nhập (deploy --no-verify-jwt)
        │  • có JWT hợp lệ → rate-limit 15 lượt/user/ngày (bảng ai_usage)
        │  • chưa đăng nhập  → rate-limit 5 lượt/IP/ngày   (bảng ai_usage_ip)
        │  • validate + clamp input/output
        │  • CORS allowlist, timeout 25s
        ▼
[Gemini key1 → key2 → … → Groq]   (key chỉ nằm trong secret, KHÔNG lộ ra client)
        │
        ▼  JSON hợp lệ
[applyAiResult()]  bind slogan / love_story / timeline vào form + autosave
```

**Nguyên tắc:** API key AI chỉ nằm trong Secret của Edge Function. Client không bao giờ thấy key. Khách chưa đăng nhập vẫn dùng được nhưng bị giới hạn theo IP (thấp hơn user đã đăng nhập).

---

## 2. Lấy API key (miễn phí)

### Gemini (chính)
1. Vào https://aistudio.google.com/apikey
2. Đăng nhập Google → **Create API key** → copy.
3. Lặp lại với nhiều tài khoản Google để có **nhiều key xoay vòng** (tăng hạn mức).

> Free tier Gemini 2.5 Flash: ~15 req/phút, ~1.500 req/ngày **mỗi key**.

### Groq (fallback)
1. Vào https://console.groq.com/keys
2. Đăng nhập → **Create API Key** → copy.

---

## 3. Tạo bảng rate-limit `ai_usage`

Mở **Supabase → SQL Editor**, chạy **cả hai** file (idempotent, chạy lại an toàn):
- [`changelogs/RC1.1/ai_usage.sql`](../../../changelogs/RC1.1/ai_usage.sql) — rate-limit theo user.
- [`changelogs/RC1.2/ai_usage_ip.sql`](../../../changelogs/RC1.2/ai_usage_ip.sql) — rate-limit theo IP (khách chưa đăng nhập).

Nội dung `ai_usage`:

```sql
create table if not exists public.ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day     date not null default current_date,
  count   integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);
alter table public.ai_usage enable row level security;
-- Không tạo policy => client bị chặn, chỉ Edge Function (service_role) ghi được.
```

---

## 4. Set Secrets

**Nhiều key Gemini phân tách bằng dấu chấm phẩy `;`** (không có khoảng trắng thừa cũng được, code tự trim):

```bash
supabase secrets set GEMINI_API_KEYS="AIza_key1;AIza_key2;AIza_key3"
supabase secrets set GROQ_API_KEY="gsk_xxxxxxxx"
```

- `GEMINI_API_KEYS` — danh sách key Gemini, ngăn cách bằng `;`. Thêm key mới lúc nào cũng được, chỉ cần chạy lại lệnh trên.
- `GEMINI_API_KEY` — (tùy chọn) nếu chỉ có 1 key, có thể set biến này thay cho `GEMINI_API_KEYS`. Code gộp cả hai.
- `GROQ_API_KEY` — key fallback.

> `SUPABASE_URL` và `SUPABASE_SERVICE_ROLE_KEY` là biến hệ thống, Supabase tự cung cấp — **không cần set**.

Xem lại secrets đã set:
```bash
supabase secrets list
```

---

## 5. Deploy Edge Function

```bash
supabase functions deploy ai-invitation --no-verify-jwt
```

> ⚠️ **Bắt buộc cờ `--no-verify-jwt`** để khách CHƯA đăng nhập vẫn gọi được.
> Việc xác thực là tuỳ chọn và đã xử lý bên trong hàm (có JWT → giới hạn theo
> user; không có → giới hạn theo IP). Client vẫn gửi kèm `apikey` (anon key).

Function sẽ có tại:
```
https://lcobawmkywtxhpezndsh.supabase.co/functions/v1/ai-invitation
```
(đã khai báo sẵn ở `core/config.js` → `CONFIG.supabase.aiInvitationUrl`).

---

## 6. Kiểm thử

### a) Test nhanh bằng curl (cần access token của user đã đăng nhập)
Lấy token: mở app đã đăng nhập → DevTools Console:
```js
(await AuthUI.supabase.auth.getSession()).data.session.access_token
```

```bash
curl -X POST https://lcobawmkywtxhpezndsh.supabase.co/functions/v1/ai-invitation \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "tone": "romantic",
    "region": "bac",
    "story_love": "Gặp nhau năm 2021 ở Đà Lạt; chuyến đi Quy Nhơn; cầu hôn dịp sinh nhật.",
    "info": "Chú rể: Nguyễn Văn A. Cô dâu: Trần Thị B.\nNgày cưới: 20/12/2026. Giờ cưới: 11:00.\nLễ Thành Hôn tại Nhà thờ Chính Tòa.\nTiệc nhà trai 18:00 20/12 tại TT Tiệc cưới ABC, 12 Lê Lợi.\nBố mẹ chú rể: Nguyễn Văn X - Trần Thị Y.\nSTK chú rể: Vietcombank 0123456789."
  }'
```
Kết quả mong đợi: `{ "data": { "story_quote": "...", "love_story": [...], "timeline": [...], "fields": { "ceremony_time": "11:00", "groom_father": "Nguyễn Văn X", "groom_bank_number": "0123456789", ... } }, "provider": "gemini" }`.

### b) Test trên UI
1. Mở màn thiết lập thiệp (`invitation-setup`), đăng nhập.
2. Bấm banner **"✨ Tạo bằng AI"** ở đầu form.
3. Nhập thông tin → **Tạo nội dung** → xem preview → **Áp dụng vào thiệp**.
4. Kiểm tra slogan, mục "Chuyện tình yêu", "Lịch trình" đã được điền và **tự lưu nháp**.

---

## 7. Tùy chỉnh

Sửa trong `supabase/functions/ai-invitation/index.ts` (nhớ deploy lại sau khi đổi):

| Hằng số | Mặc định | Ý nghĩa |
|---|---|---|
| `DAILY_LIMIT` | 15 | Số lượt AI mỗi user (đã đăng nhập) mỗi ngày |
| `ANON_DAILY_LIMIT` | 5 | Số lượt AI mỗi IP (chưa đăng nhập) mỗi ngày |
| `REQ_TIMEOUT_MS` | 25000 | Timeout mỗi lần gọi provider (ms) |
| `MAX_LOVE_ITEMS` | 8 | Số mốc chuyện tình tối đa |
| `MAX_TIMELINE` | 10 | Số mốc lịch trình tối đa |
| `MAX_INFO_LEN` | 2500 | Độ dài tối đa ô "thông tin cá nhân" |
| `FIELD_SPECS` | (whitelist) | Danh sách field AI được điền + độ dài mỗi field. Thêm/bớt field ở đây, `RESPONSE_SCHEMA.fields` và prompt |
| `GEMINI_MODEL` | gemini-2.5-flash | Model Gemini |
| `GROQ_MODEL` | llama-3.3-70b-versatile | Model Groq |
| `ALLOWED_ORIGINS` | (danh sách) | CORS — thêm domain nếu deploy nơi khác |

Sửa văn phong / cấu trúc nội dung: hàm `buildPrompt()` và `RESPONSE_SCHEMA`.

> ⚠️ `timeline[].type` phải khớp app: `ceremony` / `party` / `bride-party`. Đừng đổi sang giá trị khác nếu không sửa cả phần render bên `invitation-setup/index.js`.

---

## 8. Xử lý sự cố

| Triệu chứng | Nguyên nhân / cách xử lý |
|---|---|
| `401` khi gọi function | Quên deploy `--no-verify-jwt` (gateway chặn trước khi vào hàm) → deploy lại kèm cờ đó |
| `429 Bạn đã dùng hết ... lượt` | Chạm `DAILY_LIMIT` (user) hoặc `ANON_DAILY_LIMIT` (IP). Đăng nhập để thêm lượt, đợi hôm sau, hoặc tăng hằng số |
| `503 Dịch vụ AI đang bận` | Tất cả key Gemini lỗi/hết quota **và** Groq cũng lỗi. Kiểm tra key, thêm key Gemini mới |
| `502 AI trả về không hợp lệ` | Model trả JSON hỏng — thử lại; hiếm gặp vì Gemini dùng responseSchema |
| Nội dung không đổi sau khi Áp dụng | Kiểm tra Console lỗi JS; đảm bảo `ai-dal.js` được nạp trong `index.html` |
| Xem log server | `supabase functions logs ai-invitation` |

---

## 9. Danh sách file liên quan

- `supabase/functions/ai-invitation/index.ts` — Edge Function
- `changelogs/RC1.1/ai_usage.sql` — bảng rate-limit theo user (changelog RC1.1)
- `changelogs/RC1.2/ai_usage_ip.sql` — bảng rate-limit theo IP (changelog RC1.2)
- `core/dal/ai-dal.js` — client gọi function (gắn JWT)
- `core/config.js` — `CONFIG.supabase.aiInvitationUrl`
- `invitation-setup/index.html` — banner + `#ai-modal` + nạp `ai-dal.js`
- `invitation-setup/index.js` — `openAiModal / submitAiGenerate / _renderAiPreview / applyAiResult`
