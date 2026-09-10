# Triển khai: repo private → Cloudflare Pages

Luồng đưa web lên production. Đọc file này trước khi đụng tới `scripts/deploy-public.mjs`,
cấu hình Pages, hay thêm thư mục mới ở gốc repo.

## 1. Vì sao có nó

GitHub Pages phục vụ **mọi file trong repo**, không chỉ file trang web tải. Repo này chứa
mã Edge Function, SQL schema, trang admin, tài liệu nội bộ — tất cả đều tải về được qua URL
nếu để nguyên. Ngoài ra Pages chỉ build từ repo public (gói free), nên repo buộc phải mở.

Cloudflare Pages gỡ cả hai: build được từ repo **private**, và chỉ publish **thư mục
output** chứ không phải cả repo.

```
git push  →  repo PRIVATE  →  Cloudflare Pages build  →  chỉ dist/ lên CDN
                                (npm ci + tailwind +      (~400 file)
                                 deploy-public.mjs)
```

## 2. Hai ổ khoá độc lập

Rất dễ nhầm hai thứ này làm một:

| Ổ khoá                 | Chặn cái gì                                  |
| ---------------------- | -------------------------------------------- |
| Repo private           | Không ai `git clone` được                     |
| `INCLUDE` → `dist/`    | Web chỉ phục vụ những file đã khai            |

**Repo private KHÔNG giữ file khỏi web.** Nếu cấu hình Pages với output directory = `.`
(gốc repo) thì dù repo private, `changelogs/*.sql` vẫn tải được qua URL như thường. Cái
quyết định là **output directory**, không phải quyền repo. Đổi output directory sang `.` là
xoá sạch tác dụng của toàn bộ file này.

## 3. Cấu hình trên Cloudflare

Dùng **Workers Builds** (Workers & Pages → Create → Workers → Connect to Git). Cloudflare
đang gộp Pages vào Workers: Pages cũ vẫn chạy nhưng tính năng mới chỉ về Workers, nên dự án
mới đi thẳng Workers.

| Mục                          | Giá trị                                                                           |
| ---------------------------- | --------------------------------------------------------------------------------- |
| Project name                 | `cuoixinh-github-io` — **phải trùng `name` trong `wrangler.jsonc`**                |
| Build command                | `npm ci && npm run build && node scripts/deploy-public.mjs --dist --minify --yes`  |
| Deploy command               | `npx wrangler deploy`                                                              |
| Path                         | `/`                                                                                |
| Builds for non-production branches | **bỏ tick** (xem §13)                                                        |

Không có ô "Output directory" như Pages — thư mục publish khai trong `wrangler.jsonc` ở gốc
repo (`assets.directory = "./dist"`).

**`not_found_handling: "404-page"` trong `wrangler.jsonc` là bắt buộc.** Workers mặc định
trả 404 rỗng cho path không khớp file nào, mà clean URL của web dựa hết vào việc host phục
vụ `404.html` (nó chuyển sang `router.html` để tra slug). Bỏ dòng đó là **mọi link thiệp
`/<slug>` đã phát cho khách đều chết** — mà trang chủ vẫn chạy nên rất dễ tưởng là ổn.
Sau khi deploy phải thử ngay một slug thật.

Node lấy theo `.node-version` ở gốc repo (đang là `22`). Không cần biến môi trường nào: khoá
phía client nằm sẵn trong `core/config.js`, khoá phía server ở Supabase Edge Function chứ
không đi qua bước build.

`wrangler.jsonc` ở gốc **không liên quan** tới `cloudflare-worker/wrangler*.toml` — ba worker
proxy/cache đó vẫn deploy tay từ thư mục riêng.

Giới hạn gói Free giống hệt Pages: static asset request miễn phí không giới hạn, 20.000
file, 25 MiB mỗi file (đang dùng 402 file, file to nhất 1,5 MB).

## 4. Thứ tự chuyển đổi

**Đổi repo sang Private là tắt web ngay** (gói free không cho GitHub Pages build từ repo
private), nên nếu còn đang chạy GitHub Pages thì để bước đó CUỐI CÙNG. Lần chuyển này repo
đã private trước, chấp nhận web tắt trong lúc dựng.

1. **`git push`.** Cloudflare build từ `origin`, không phải từ máy bạn. Chưa push thì nó
   dựng bản cũ — triệu chứng rất khó đoán (xem §12).
2. Dựng project theo §3, chờ build + deploy xong.
3. **Xoá bản ghi DNS cũ của apex.** Cloudflare từ chối gắn custom domain khi tên đó đã có
   bản ghi (*"already has externally managed DNS records"*). Zone → DNS → Records, xoá đúng
   các bản ghi `A`/`AAAA`/`CNAME` có Name = `cuoixinh.com` (dải GitHub Pages
   `185.199.10x.153`).
   **GIỮ NGUYÊN `MX` và `TXT`** — zone này chạy Cloudflare Email Routing
   (`route1..3.mx.cloudflare.net` + SPF); xoá là mất email của domain, mà Cloudflare không
   hỏi lại.
4. Worker → Settings → Domains & Routes → thêm `cuoixinh.com`. Zone cùng tài khoản nên nó
   tự tạo bản ghi và cấp SSL, không phải chờ propagation. Muốn `www` chạy thì làm y hệt
   (xoá bản ghi cũ rồi thêm domain thứ hai), hoặc đặt Redirect Rule về apex.
5. Kiểm trên `cuoixinh.com` theo thứ tự này — mỗi mục bắt một lỗi khác nhau:
   trang chủ · **một slug thiệp thật** (kiểm `not_found_handling`) · trang Thiết lập lưu
   nháp được (CORS + Edge Function) · `/admin` phải ra **404** · Ctrl+F5 xem CSS/ảnh đủ.

**Đừng test trên `<project>.workers.dev`.** Origin đó không nằm trong `ALLOWED_ORIGINS` của
`wedding-admin`/`guest-handler` nên mọi lệnh gọi API bị CORS chặn: trang chủ hiện ra bình
thường còn thiệp và trang Thiết lập thì hỏng, rất dễ tưởng nhầm là lỗi deploy. Muốn dùng
workers.dev để test thì phải thêm origin đó vào hai Edge Function rồi
`npm run deploy:functions`.

## 5. Bản publish gồm gì

Nguồn sự thật là `INCLUDE` trong `scripts/deploy-public.mjs`. Danh sách **CHO PHÉP** — thứ gì
không khai thì không ra web.

| Ra web                                                                  | Ở lại repo                                             |
| ----------------------------------------------------------------------- | ------------------------------------------------------ |
| `index/404/router.html`, `CNAME`, `robots.txt`                           | `admin/` — **chỉ chạy local**                          |
| `checkout/` `theme-template/` `my-invitations/` `invitation-setup/`      | `supabase/functions/` — mã Edge Function               |
| `core/` `js/` `public/`                                                  | `changelogs/` — SQL schema                             |
| `assets/` (trừ `assets/temp_img/`)                                       | `cloudflare-worker/`, `scripts/`, `docs/`, `documents/` |
| `styles/build.css`, `styles/themes.css`                                  | `CLAUDE.md`, `encrypt.md`, `package*.json`, `tailwind*.js` |
|                                                                          | `styles/_*.css`, `styles/*-src.css`                    |

**Thêm thư mục hoặc trang mới ở gốc repo thì phải khai vào `INCLUDE`**, nếu không production
thiếu file. Thư mục đã khai thì file mới bên trong tự theo, không phải làm gì.

Script tự cảnh báo khi một thẻ `<a>`/`<script>` trong HTML trỏ tới file có trong repo mà
không nằm trong bản publish — đó chính là dấu hiệu quên khai.

## 6. Trang admin

`admin/` **không ra web**, kể cả `router.html` cũng không còn khai route `admin`. Sau khi
chuyển, `cuoixinh.com/admin` là 404 thật.

Chạy local như cũ: mở `http://localhost:8000/admin/index.html`. Edge Function đã cho phép
mọi cổng localhost trong `isAllowedOrigin()` nên không phải sửa CORS.

Kéo theo: `CONFIG.cloudflare.purgeSecret` chỉ `admin/js/02-templates.js` dùng, nên nó bị
`REDACT` thay bằng `null` trong bản publish. Bản trong repo giữ giá trị thật để admin local
vẫn purge được. **Chức năng nào của trang public cần một giá trị đang nằm trong `REDACT` thì
phải gỡ mục đó ra**, không thì lỗi chỉ hiện trên production.

## 7. Rút gọn mã (`--minify`)

| Loại | Xử lý                                                   | Kết quả          |
| ---- | ------------------------------------------------------- | ---------------- |
| JS   | terser bỏ comment + khoảng trắng                        | 1,4 MB → 800 KB  |
| HTML | gỡ comment (`stripHtmlComments`)                        | −120 KB          |
| CSS  | Tailwind đã minify sẵn ở `npm run build`                | —                |

**Comment HTML phải gỡ bằng bộ quét tuần tự, không được dùng regex trần.** Repo này có cả
`<!--` nằm trong `<script>` lẫn comment chứa chữ `<style>` (xem `theme-template/index.html`).
Cách "che khối script/style trước rồi regex-strip comment" **nuốt nhầm** thẻ `<link>` thật
nằm sau comment đó — đã thử và thấy tận mắt. Hàm hiện tại đi từ trái sang, ở mỗi bước xét
xem `<!--` hay khối raw-text đến trước, nên không vấp. Sửa hàm này thì kiểm lại bằng bất
biến "chỉ được mất comment + khoảng trắng", đừng kiểm bằng cách dựng lại kết quả.

Comment JS **nằm trong thẻ `<script>` của file HTML thì vẫn lên web** — chỉ file `.js` rời
mới đi qua terser. `router.html` và `404.html` là hai chỗ có nhiều nhất.

**Mangle: bật trong hàm, CẤM ở top-level.** Cấu hình là `compress: { toplevel: false }` +
`mangle: { toplevel: false }` — biến cục bộ thành `e, t, i`, còn tên top-level giữ nguyên.

Hai cờ `toplevel` đó không được bật, vì các file ở đây là classic script chia sẻ biến toàn
cục (`CONFIG`, `CX_THEME`, `renderWedding`, `__cxOnReady`, `cxNavReflow`…) mà terser chỉ
nhìn được MỘT file mỗi lần. Ba mối nối nó không thể thấy:

- Handler viết thẳng trong HTML (`onclick="_applyThemeChange(…)"`) và `new Function` dựng từ
  attribute ở `core/x-controls.js`.
- Gọi xuyên iframe: trang Thiết lập gọi `applyThemeSetting`/`setShareTemplate` trên window
  của trang thiệp (`05-theme-panel.js`, `13-data.js`).
- `25-theme-decl.js` nạp `public/themes/<mẫu>/index.js` trong iframe rỗng để đọc `CX_THEME`.

Bật toplevel là đổi tên ở một file trong khi chỗ dùng giữ tên cũ, hoặc xoá hàm vì tưởng
không ai gọi — cả hai chỉ lộ lúc chạy trên production, build vẫn báo thành công.

**Muốn tên hàm cũng thành `a, b, c`** (kiểu bundle của các trang lớn) thì không có cờ nào
làm được: phải thêm bước GỘP script của từng trang vào một file trước rồi mới mangle
toplevel, kèm danh sách `reserved` sinh tự động cho ba mối nối trên. Mọi trang hiện đều kết
thúc bằng thẻ script local nên gộp được mà không đảo thứ tự với thư viện CDN. Đây là việc
riêng, chưa làm.

Dùng `terser` (JS thuần) chứ không phải esbuild: esbuild tải binary theo nền tảng, mà
`package-lock.json` sinh trên Windows dễ làm `npm ci` trên máy build Linux vấp.

Hệ quả cần biết: F12 trên production sẽ ra code không có chú thích. Muốn đọc bản đầy đủ thì
đọc trong repo. Tên hàm vẫn nguyên nên stack trace vẫn chỉ đúng chỗ.

## 8. Chạy tay trên máy

```bash
node scripts/deploy-public.mjs --dist --minify   # dựng đúng bản sẽ lên web, xem ở dist/
npm run deploy:public                            # copy sang một repo khác (xem mục 11)
```

| Cờ           | Tác dụng                                                        |
| ------------ | --------------------------------------------------------------- |
| `--dist`     | Xuất ra `<repo>/dist`. Tự bật `--yes`, không ghi file cấu hình   |
| `--minify`   | Rút gọn JS                                                       |
| `--dry-run`  | Chỉ in kế hoạch, không ghi                                       |
| `--build`    | Chạy `npm run build` trước                                       |
| `--yes`      | Bỏ câu hỏi xác nhận                                              |
| `--target=…` | Đổi thư mục đích của chế độ copy                                 |

`dist/` đã nằm trong `.gitignore`.

## 9. Các chốt an toàn

**CHẶN build** (exit 1, không có gì được publish):

- Quét thấy secret trong bản sắp ghi: `service_role`, `sbp_…`, token GitHub, private key,
  `sk-…`, `AIza…`, PayOS checksum key, Cloudflare account id, và **JWT có `role` khác
  `anon`** (giải mã payload để kiểm, nên anon key không bị báo nhầm).
- `REDACT` không tìm thấy đoạn cần che — nghĩa là file nguồn đã đổi. Thà hỏng còn hơn im
  lặng đẩy secret lên.
- `INCLUDE` trỏ vào file/thư mục không tồn tại.
- Không có TTY mà thiếu `--yes` — nếu không, câu hỏi y/N tự trả lời rỗng và Pages sẽ publish
  một thư mục trống.

**CẢNH BÁO** (vẫn chạy tiếp):

- `CX_VERSION` trùng lần deploy trước (chỉ ở chế độ copy — CI không nhớ được lần trước).
- `build.css`/`themes.css` cũ hơn nguồn.
- HTML trỏ tới file không nằm trong bản publish.
- Đường dẫn có segment bắt đầu bằng `_`.

## 10. Sau mỗi lần deploy

**Đổi `CX_VERSION` trong `core/config.js`.** Không đổi thì người dùng có thể nhận bản trộn —
partial mới đi với script cũ là trang vỡ, không phải chỉ trông cũ. Xem mục "Phiên bản &
cache" trong `CLAUDE.md`.

Cache Rule bypass `/core/config.js` nằm ở zone Cloudflare, không phải ở origin — giữ nguyên,
đừng xoá khi dọn dẹp. Mất nó là `CX_VERSION` mất tác dụng.

## 11. Chế độ copy (đường lùi)

Bỏ `--dist` thì script copy sang một thư mục repo khác trên máy để tự commit & push — cách
làm cũ, khi web còn chạy bằng một repo public riêng. Đường dẫn đích nhớ trong
`deploy-public.config.json` (gitignored).

Thư mục đích được đồng bộ **kiểu gương**: file thừa bị xoá, thư mục rỗng bị dọn. Trừ
`TARGET_KEEP` (`.git`, `.github`, `.gitignore`, `LICENSE`, `README.md`, `.nojekyll`).

Giữ chế độ này để còn đường quay lại GitHub Pages nếu Cloudflare có sự cố kéo dài.

## 12. Xử lý sự cố

| Hiện tượng                                   | Nguyên nhân thường gặp                                                    |
| -------------------------------------------- | -------------------------------------------------------------------------- |
| Log hỏi "Thư mục repo public:" rồi Success mà không có `dist/` | **Chưa push** — Cloudflare đang chạy bản script cũ chưa có `--dist` |
| `Asset too large … node_modules/workerd 146 MiB` | **Chưa push `wrangler.jsonc`** — wrangler tự tạo config với `directory: "."` rồi gom cả repo |
| Build fail ở `npm ci`                        | `package-lock.json` lệch `package.json` — commit cả hai                     |
| Build fail, log có "✖ Phát hiện thứ giống secret" | Đúng như tên gọi. Gỡ giá trị đó ra, hoặc thêm vào `REDACT`             |
| Build xanh nhưng web trắng / thiếu file      | Thư mục mới chưa khai vào `INCLUDE`                                        |
| Trang chủ chạy nhưng **mọi link `/<slug>` ra 404** | Thiếu `not_found_handling: "404-page"` trong `wrangler.jsonc` (§3)    |
| Deploy xanh nhưng web không đổi              | `name` trong `wrangler.jsonc` lệch tên project → đẩy sang worker khác       |
| Web vẫn là bản cũ                            | Chưa đổi `CX_VERSION`; hoặc Cache Rule `/core/config.js` bị xoá             |
| CSS sai bố cục sau deploy                    | Quên `npm run build` — nhưng CI luôn chạy nên chỉ xảy ra ở chế độ copy      |
| Trang lỗi JS chỉ trên production             | Xem có ai bật cờ `toplevel` trong `minifyAll()` không (mục 7)               |
| Publish ra thư mục trống                     | Build command thiếu `--dist`/`--yes`                                       |

**Rollback:** Pages → Deployments → chọn bản cũ → Rollback. Không cần revert commit.

## 13. Việc tuỳ chọn sau khi chuyển xong

- **Tắt build cho branch không phải production** (bỏ tick "Builds for non-production
  branches"). Mỗi branch khác sinh một bản preview có URL công khai — repo private nhưng
  preview thì không.
- **Tắt `<project>.workers.dev`** sau khi custom domain chạy ổn: thêm `"workers_dev": false`
  vào `wrangler.jsonc`. Đừng tắt sớm — còn cần nó để test ở §4 bước 1.
- **Đổi `purgeSecret`.** Nó từng nằm trong `core/config.js` công khai trên GitHub Pages nên
  coi như đã lộ. Đổi ở Cloudflare + `core/config.js`; từ nay `REDACT` giữ nó khỏi bản publish.
- **Thêm `_headers`.** Pages đọc file này, GitHub Pages thì không — đây là cách gỡ hẳn ràng
  buộc `max-age=600`. Nhớ khai `_headers` vào `INCLUDE`, và **kiểm tra Jekyll không còn cản**
  (tên bắt đầu bằng `_` chỉ là vấn đề của GitHub Pages, Cloudflare Pages không chạy Jekyll).
