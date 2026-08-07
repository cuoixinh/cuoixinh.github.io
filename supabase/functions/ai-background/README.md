# ai-background — sinh ảnh nền SVG bằng AI

Sinh ảnh nền vector cho web (hiện dùng ở màn mở đầu trang chủ). Trang quản trị
`/admin` → tab **Ảnh nền** gọi hàm này, xem trước rồi ghi file xuống
`assets/background/<chỗ dùng>/`.

## Chỉ quản trị gọi được

Khác `ai-invitation` (công khai, ai cũng gọi được, rate-limit theo user/IP), hàm
này nhận **prompt tự do từ client** nên **toàn bộ thân hàm chặn sau
`x-admin-token`** — so sánh với secret `ADMIN_SECRET_TOKEN` bằng
`timingSafeEqual`. Không chặn thì nó thành proxy LLM miễn phí xài key của dự án.

Vì admin không phải người dùng cuối nên hàm **không** đụng bảng `ai_usage` /
hạn mức ngày.

## Giao thức

```
POST  { prompt: string, width: number, height: number }
→ 200 { svg: string, provider: "gemini" | "groq" }
→ 401 { error: "Unauthorized" }          — thiếu/sai x-admin-token
→ 502 { error }                          — AI không trả SVG hợp lệ / SVG quá nặng
→ 503 { error }                          — cả Gemini lẫn Groq đều hỏng
```

Header bắt buộc: `x-admin-token`, `apikey`, `Authorization: Bearer <anon key>`.

`prompt` là **phần mỹ thuật**; server tự nối thêm ràng buộc kỹ thuật (khổ ảnh,
chỉ trả SVG, cấm `<script>`/`<foreignObject>`/`<image>`/URL ngoài, trần dung
lượng). Admin sửa prompt không bỏ qua được các ràng buộc đó.

## Lọc SVG hai lớp

1. **Server** — bóc đoạn `<svg>…</svg>` khỏi output, xoá `<script>`,
   `<foreignObject>`, mọi thuộc tính `on*`, chặn file > 300KB.
2. **Client** (`admin/js/06-background-ai.js`) — lọc lại đúng bộ đó trước khi ghi đĩa.

Web dùng SVG qua `background-image`, mà ngữ cảnh đó là hộp cát: script không
chạy, không tải được tài nguyên ngoài. Lọc thêm vì file vẫn nằm trong repo và
có thể bị mở trực tiếp.

## Provider

Dùng chung `_shared/ai-provider.ts` với `ai-invitation`: Gemini
`gemini-2.5-flash` (xoay vòng nhiều key) → fallback Groq
`llama-3.3-70b-versatile`. Secret cần có: `GEMINI_API_KEYS` (hoặc
`GEMINI_API_KEY`), `GROQ_API_KEY`, `ADMIN_SECRET_TOKEN`.

Timeout 60s (vẽ SVG lâu hơn sinh text), `thinkingBudget: 0`,
`maxOutputTokens: 16384`.

## Deploy

```bash
supabase functions deploy ai-background --no-verify-jwt
```

`--no-verify-jwt` là bắt buộc: trang admin xác thực bằng `x-admin-token`, không
có JWT Supabase.

> Sửa `_shared/ai-provider.ts` thì phải deploy lại **cả** `ai-invitation` lẫn
> `ai-background`.
