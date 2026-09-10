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

Workers & Pages → Create → Pages → Connect to Git → chọn repo private.

| Mục               | Giá trị                                                            |
| ----------------- | ------------------------------------------------------------------ |
| Framework preset  | None                                                                |
| Build command     | `npm ci && npm run build && node scripts/deploy-public.mjs --dist --minify --yes` |
| Output directory  | `dist`                                                              |
| Production branch | `cuoixinh.github.io`                                                |

Node lấy theo `.node-version` ở gốc repo (đang là `22`).

Không cần biến môi trường nào: mọi khoá phía client nằm sẵn trong `core/config.js`, còn khoá
phía server ở Supabase Edge Function chứ không đi qua bước build.

## 4. Thứ tự chuyển đổi (không được đảo)

1. Dựng project Pages, deploy thử, **test kỹ trên `<project>.pages.dev`** — lúc này
   `cuoixinh.com` vẫn chạy GitHub Pages, chưa đụng gì.
2. Pages project → Custom domains → thêm `cuoixinh.com`. Zone đã ở Cloudflare nên DNS tự đổi,
   không phải chờ propagation.
3. Xác nhận web chạy đúng ở domain thật.
4. **Rồi mới** đổi repo sang Private trên GitHub, và tắt GitHub Pages
   (Settings → Pages → Source: None).

Đảo bước 4 lên trước là web chết ngay: gói free không cho GitHub Pages build từ repo private.

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

**Cố ý không bật `mangle`.** Các file ở đây là classic script chia sẻ biến toàn cục
(`CONFIG`, `CX_THEME`, `renderWedding`, `__cxOnReady`, `cxNavReflow`…): file này khai, file
kia gọi. Trình rút gọn chỉ nhìn được một file mỗi lần nên đổi tên là gãy ở file khác, mà lỗi
chỉ lộ lúc chạy trên production. Đừng thêm `mangle` để lấy thêm vài KB.

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
| Build fail ở `npm ci`                        | `package-lock.json` lệch `package.json` — commit cả hai                     |
| Build fail, log có "✖ Phát hiện thứ giống secret" | Đúng như tên gọi. Gỡ giá trị đó ra, hoặc thêm vào `REDACT`             |
| Build xanh nhưng web trắng / thiếu file      | Thư mục mới chưa khai vào `INCLUDE`                                        |
| Web vẫn là bản cũ                            | Chưa đổi `CX_VERSION`; hoặc Cache Rule `/core/config.js` bị xoá             |
| CSS sai bố cục sau deploy                    | Quên `npm run build` — nhưng CI luôn chạy nên chỉ xảy ra ở chế độ copy      |
| Trang lỗi JS chỉ trên production             | Xem có ai bật `mangle` trong `minifyAll()` không (mục 7)                    |
| Publish ra thư mục trống                     | Build command thiếu `--dist`/`--yes`                                       |

**Rollback:** Pages → Deployments → chọn bản cũ → Rollback. Không cần revert commit.

## 13. Việc tuỳ chọn sau khi chuyển xong

- **Tắt preview deployment** (Settings → Builds → Preview branches → None). Mỗi branch khác
  production sinh một `*.pages.dev` mà ai có link đều mở được — repo private nhưng preview
  thì không.
- **Redirect `<project>.pages.dev` về `cuoixinh.com`** bằng Redirect Rule; domain đó không
  xoá được.
- **Đổi `purgeSecret`.** Nó từng nằm trong `core/config.js` công khai trên GitHub Pages nên
  coi như đã lộ. Đổi ở Cloudflare + `core/config.js`; từ nay `REDACT` giữ nó khỏi bản publish.
- **Thêm `_headers`.** Pages đọc file này, GitHub Pages thì không — đây là cách gỡ hẳn ràng
  buộc `max-age=600`. Nhớ khai `_headers` vào `INCLUDE`, và **kiểm tra Jekyll không còn cản**
  (tên bắt đầu bằng `_` chỉ là vấn đề của GitHub Pages, Cloudflare Pages không chạy Jekyll).
