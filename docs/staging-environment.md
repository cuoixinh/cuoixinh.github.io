# Môi trường staging

Bản sao đầy đủ của production tại **`staging.cuoixinh.com`** — web + DB + Edge Function +
thanh toán — để thử trước khi đẩy ra khách.

Đọc cùng `deploy-cloudflare-pages.md`: file đó nói về đường ra production, file này nói về
những chỗ hai môi trường KHÁC nhau.

## 1. Vì sao có nó

`cuoixinh.com` từng là môi trường duy nhất. Loại lỗi đắt nhất không nằm trong một tầng mà ở
CHỖ GIÁP giữa các tầng — đổi quyền DB xong web chưa push, hay Edge Function đã lên mà
`config.js` còn cũ. Những lỗi đó chỉ lộ khi cả ba chạy cùng nhau, tức là chỉ lộ trên
production, trên đầu khách thật.

## 2. Bản đồ

```
staging.cuoixinh.com                      cuoixinh.com
  │ Cloudflare Access chắn trước            │
  ├─ Worker "cuoixinh-staging"              ├─ Worker "cuoixinh-github-io"
  │    branch staging-cuoixinh.github.io    │    branch cuoixinh.github.io
  │    wrangler.staging.jsonc               │    wrangler.jsonc
  │                                         │
  └─ Supabase <staging-ref>                 └─ Supabase lcobawmkywtxhpezndsh
       KHÔNG qua worker cache                    + 4 worker proxy/cache
       │                                         │
  payos-webhook-proxy-staging               payos-webhook-proxy
       │                                         │
       └──── PayOS kênh 2 ─────────── kênh 1 ────┘
```

**Staging cố ý không có worker cache.** Mọi DAL đã sẵn nhánh lùi khi thiếu URL worker
(`wedding-dal` dùng `workerUrl || edgeUrl`, `storage-dal` dùng `imageProxy || storageUrl`,
`templates-dal` gọi `_viaEdge`), nên chỉ cần để `cloudflare.*` = `null`. Đổi lại staging
không phải đi purge cache mỗi lần sửa — đúng thứ cần khi đang thử.

## 3. Web trỏ vào đâu

**Không có `if` nào về môi trường trong mã.** Hai file, build chọn:

| File | Nội dung |
| --- | --- |
| `core/config.js` | Toàn bộ cấu hình, giá trị **production** |
| `core/config.staging.js` | **Chỉ** những khoá khác production |

Bản staging dựng bằng cách nối file thứ hai vào cuối file thứ nhất:

```bash
node scripts/deploy-public.mjs --dist --minify --env=staging --yes
```

Lúc chạy vẫn đúng **một** file `core/config.js` — 13 trang HTML và hai loader nạp nó bằng
thẻ `<script>` viết cứng, nên cách này không bắt chỗ nào phải sửa, và mẫu thiệp mới chép từ
`base-theme` tự đúng.

Vì là "chỉ khai cái khác đi" nên ngưỡng ảnh, retention, hạn mức import… **không bị nhân đôi**:
sửa ở `config.js` là cả hai môi trường theo. Thêm môi trường nữa thì thêm
`core/config.<tên>.js` và khai vào `EXCLUDE` của `scripts/deploy-public.mjs`.

Chạy local thì luôn là production (file gốc) — đúng mong muốn, vì `admin/` chỉ chạy local mà
nó quản trị hàng thật. Muốn thử giao diện với dữ liệu staging thì mở thẳng
`staging.cuoixinh.com`.

## 4. Chỗ hai môi trường khác nhau

|                         | production             | staging                                                     |
| -------------------------| ------------------------| -------------------------------------------------------------|
| Supabase project        | `lcobawmkywtxhpezndsh` | riêng                                                       |
| `ADMIN_SECRET_TOKEN`    | riêng                  | **phải khác**                                               |
| Axiom dataset           | riêng                  | **nên khác**, để log thử không lẫn log thật                 |
| PayOS                   | kênh 1                 | **kênh 2**, bộ khoá riêng                                   |
| Worker cache            | 3 worker               | không dùng                                                  |
| cron `cleanup-weddings` | có                     | **có** — dựng y hệt (URL + Vault của chính project staging) |

## 5. Deploy

**Edge Function** — cùng một mã nguồn, hai project. Sửa xong phải deploy **cả hai**, không
thì hai môi trường chạy hai bản khác nhau mà không có gì báo:

```bash
npm run deploy:functions:staging     # staging
npm run deploy:functions             # production
npm run deploy:functions:all         # cả hai, staging trước
npm run deploy:functions:staging -- ai-chat wedding-admin   # chỉ vài function
```

**Web** — push branch `staging-cuoixinh.github.io`, Workers Builds tự build. Cấu hình dự án staging giống
production, chỉ khác:

| Mục | Giá trị |
| --- | --- |
| Project name | `cuoixinh-staging` |
| Production branch | `staging-cuoixinh.github.io` |
| Build command | `npm ci && npm run build && node scripts/deploy-public.mjs --dist --minify --env=staging --yes` |
| Deploy command | `npx wrangler deploy -c wrangler.staging.jsonc` |

`--env=staging` ở Build command là chỗ DUY NHẤT phân biệt hai môi trường. Thiếu nó thì
staging build ra bản production và trỏ thẳng vào DB thật — nhìn bề ngoài không có gì khác,
nên kiểm mục 8.2 ngay sau lần deploy đầu.

**Worker webhook PayOS** — `payos-webhook-proxy.js` dùng chung cho hai worker, đích lấy từ
biến môi trường và **mặc định là production**. Nên thêm staging KHÔNG cần deploy lại bản
production:

```bash
cd cloudflare-worker
wrangler deploy --config wrangler-webhook-staging.toml
```

## 6. Changelog DB

`changelogs/` là nguồn sự thật chung. Dựng một project từ đầu = chạy `RC1.0` → `RC1.16` theo
đúng thứ tự. Gộp sẵn thành một file để dán một lượt:

```bash
npm run sql:merge -- RC1 --ref=<project-ref>   # → changelogs/RC1.final.sql (không commit)
```

`--ref` đổi mọi chỗ nhắc ref production sang project đích — **bắt buộc khi chạy cho staging**,
vì `RC1.10` có `cron.schedule` gọi URL đó, quên là cron staging đi xoá dữ liệu THẬT. Thứ tự
nối là sort tự nhiên nên `RC1.10` đứng sau `RC1.9`.

Hai chỗ vẫn phải làm tay:

- **Vault secret `cleanup_token`** (RC1.10) — cron đọc nó để gửi `x-admin-token`. Đặt bằng
  `ADMIN_SECRET_TOKEN` của CHÍNH project đó; hai môi trường token khác nhau nên hai Vault
  cũng khác. Hệ quả staging chạy cron y như thật: thiệp test chưa thanh toán bị xoá sau
  3 + 30 ngày, nháp bỏ quên sau 30 ngày.
- **`RC1.15`** không chạy được bằng SQL Editor (storage.objects thuộc
  `supabase_storage_admin`) — làm bằng Dashboard theo mục B của chính file đó.

Xong changelog thì DB mới chỉ có **3 mẫu baseline** — `templates` và `template_pricing` là
dữ liệu danh mục, không nằm trong changelog. Phải chép từ production sang, mà RC1.16 đã thu
quyền đọc của `anon` nên không lấy được từ ngoài bằng anon key.

Chạy `scripts/gen-template-seed.sql` (hai câu, chạy từng câu) trên **SQL Editor của
production**: mỗi câu trả về MỘT ô text là câu `insert … on conflict do update` hoàn chỉnh.
Copy ô đó, dán sang SQL Editor của project đích, Run.

Câu sinh tự đọc danh sách cột từ `information_schema` nên thêm/bớt cột về sau không phải
sửa file, và `do update` khiến chạy lại chỉ đồng bộ chứ không nhân đôi hàng.

## 7. Thứ tự khi một thay đổi đụng nhiều tầng

Đây là lý do tồn tại của cả môi trường này. Sai thứ tự là khách gặp lỗi thật:

1. Chạy changelog SQL trên **staging**
2. Deploy Edge Function lên staging
3. Push branch `staging-cuoixinh.github.io`, đợi build, test
4. Lặp lại **y hệt thứ tự đó** trên production

Nhớ nâng `CX_VERSION` như mọi lần deploy.

## 8. Kiểm sau khi dựng

1. Mở staging ở cửa sổ ẩn danh → phải gặp màn đăng nhập Cloudflare Access.
2. DevTools → Network, lọc `lcobawmkywtxhpezndsh` → phải **0 request**.
3. `curl` PostgREST staging bằng anon key staging: `promo_codes`, `promo_redemptions`,
   `templates`, `template_pricing` phải trả `42501 permission denied` (chứng tỏ RC1.16 đã chạy).
4. `POST /storage/v1/object/list/wedding-images` bằng anon key staging → **0 mục**.
5. Luồng đầy đủ: tạo thiệp → tải ảnh → lưu nháp → đăng xuất → mở lại link quản lý → đăng
   nhập → xuất bản → mở `/<slug>` (phải 200, đây là chỗ `not_found_handling` hay hỏng) →
   gửi lời chúc.
6. Một giao dịch nhỏ qua kênh PayOS 2 → đơn phải sang `completed` trên staging.

## 9. Cạm bẫy

- **Khai nhầm webhook kênh CHÍNH sang worker staging** là cách duy nhất còn lại để làm hỏng
  luồng tiền. Thao tác trong PayOS phải soi kỹ đang đứng ở kênh nào, xong test một đơn
  production.
- **`ALLOWED_ORIGINS` có BA bản sao** (`_shared/ai-provider.ts`, `wedding-admin/index.ts`,
  `guest-handler/index.ts`). Thêm miền mà sót một chỗ thì lỗi hiện ra dưới dạng CORS ở đúng
  một tính năng — rất dễ tưởng là lỗi khác.
- **Kênh PayOS 2 vẫn là tiền thật.** Tạo trên staging một mã giảm 100% để test luồng xuất
  bản; `payment-handler` có sẵn nhánh bỏ qua PayOS khi số tiền về 0 (đòi đăng nhập).
- **Chatbot AI trên staging đọc danh mục mẫu của PRODUCTION.** `ai-chat` lấy giá qua
  `TEMPLATES_CACHE_URL`, mà biến đó không đặt thì rơi về worker production
  (`ai-chat/index.ts`, chỗ khai hằng số). Hai bên seed cùng 9 mẫu nên hiện tại không lệch
  gì, nhưng nếu bạn thử ĐỔI GIÁ hay thêm mẫu trên staging thì chatbot staging vẫn đọc giá
  cũ của production — đây là điểm mù duy nhất còn lại giữa hai môi trường. Lúc nào cần thử
  tới phần đó thì dựng thêm một worker `templates-cache` cho staging rồi trỏ biến này vào nó.
- **Staging trôi khỏi production.** Schema staging đi trước nên dễ quên chạy lại bên
  production. Bảng ở `changelogs/README.md` là chỗ đánh dấu.
