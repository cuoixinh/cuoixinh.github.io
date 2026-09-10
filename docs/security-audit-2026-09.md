# Rà soát dữ liệu lộ ra web — 2026-09-10

Rà trên **bản `dist/` thật sự được publish** và trên **API production**, không rà repo:
hai thứ đó khác nhau, và thứ ra web mới là thứ đáng lo.

Mục đích của file này là để lần rà sau có mốc so sánh. Cách đo đều ghi kèm để chạy lại được.

## Kết quả tóm tắt

| # | Phát hiện | Mức | Trạng thái |
|---|-----------|-----|------------|
| 1 | Liệt kê được toàn bộ bucket `wedding-images` bằng anon key | 🔴 | vá ở RC1.15 |
| 2 | Tên file mang `wedding_id` → tra tiếp được hồ sơ thiệp qua `?id=` | 🔴 | vá (đổi cách đặt tên + siết `?id=`) |
| 3 | `CONFIG.security.encryptionKey` công khai, giá trị yếu | 🟡 | ghi rõ là không phải bảo mật; KHÔNG đổi giá trị |
| 4 | `wishes-list` đọc công khai theo slug | 🟡 | theo thiết kế, giữ nguyên |
| 5 | Anon có **DELETE/UPDATE** trên toàn bộ kho ảnh (policy `APPLIED TO: public`) | 🔴 | vá ở RC1.15 |

## 1 + 2 — chuỗi rò rỉ kho ảnh

Với `anonKey` (nằm công khai trong `core/config.js`, đúng thiết kế Supabase):

```bash
curl -s -X POST -H "apikey: <ANON>" -H "Authorization: Bearer <ANON>" \
  -H "Content-Type: application/json" -d '{"prefix":"","limit":1000}' \
  https://<project>.supabase.co/storage/v1/object/list/wedding-images
```

Đo được **54 file · 68.3 MB · 15 thiệp**. Tên file khi đó có dạng
`<wedding_id>-<trường>-<timestamp>-<random>.<ext>`, trong đó có cả `*_qr_url-*` là **ảnh mã QR
tài khoản ngân hàng**. Bucket để public nên biết tên là tải được.

Nguy hiểm nằm ở mắt xích thứ hai: lấy `wedding_id` từ tên file rồi gọi
`GET /functions/v1/wedding-admin?id=<uuid>` → **HTTP 200, 73 trường dữ liệu**. Tức là
**không cần đoán slug** — mọi phương án phòng thủ dựa trên "slug khó đoán" hay rate limit
đều bị đi vòng qua.

Thời điểm phát hiện, 15 thiệp trong kho đều là dữ liệu thử của chủ dự án, chưa có khách thật.

**Đã vá:**
1. `changelogs/RC1.15/storage_list_policy.sql` — gỡ mọi policy cũ của bucket, chỉ cấp
   `select`/`insert` cho `authenticated`. Phải làm bằng **Dashboard → Storage → Policies**:
   `storage.objects` thuộc sở hữu của `supabase_storage_admin` nên SQL Editor (vai `postgres`)
   không tạo/xoá policy được, mà `set role supabase_storage_admin` cũng bị chặn.
2. `core/bl/image-bl.js` — tên file mới không còn `wedding_id`, chỉ còn `<trường>-<24 ký tự
   ngẫu nhiên>`. Ảnh cũ giữ nguyên tên, không migrate (không link nào chết).
3. `invitation-setup/js/12-uploads.js` — chưa đăng nhập thì không upload.
4. `wedding-admin` — tra theo `?id=` phải là chủ thiệp; `core/dal/wedding-dal.js` gửi token
   người dùng thay vì anon key trần.

## 3 — `encryptionKey`

`"dqvinh"`, nằm nguyên trong bundle. Dùng AES che `name`/`relationship` trên link khách mời.
**Không phải một lớp bảo vệ** và đừng tính nó là một. Cổng thật ở `guest-handler`, khớp một
hàng `guests` theo slug + tên + xưng hô.

Cố ý **không đổi giá trị**: đổi là mọi link đã phát cho khách mời giải mã hỏng.

## Những chỗ đo thấy đang đúng

| Hạng mục | Cách đo | Kết quả |
|---|---|---|
| RLS `weddings`, `guests` | `GET /rest/v1/<bảng>` bằng anon key | HTTP 200, **0 dòng** |
| `payments`, `profiles`, `users` | như trên | 404 — không lộ ra PostgREST |
| `templates` | như trên | 9 dòng — cố ý công khai (catalog mẫu) |
| Quyền admin | đọc mã | `x-admin-token` + `timingSafeEqual` (chống cả timing attack) |
| Field khách được sửa | đọc mã | allowlist; cột thanh toán chỉ webhook ghi |
| `purgeSecret` | đọc `dist/core/config.js` | đã bị `REDACT` thành `null` |
| Quản lý khách mời | đọc mã | bắt buộc đăng nhập (401/403) |

## Anon có ghi/xoá được không — CÓ

Ban đầu chưa đo được bằng thực nghiệm (thử ghi lên storage production bị môi trường chặn),
nhưng bảng Policies trên Dashboard đã trả lời dứt khoát. Bucket có 4 policy tên
`Full Permission 1xruccx_0..3`, phủ **SELECT + INSERT + UPDATE + DELETE**, `APPLIED TO: public`.

**`public` trong Postgres là MỌI role, gồm cả `anon`** — đây là chỗ dễ đọc nhầm nhất, vì trên
giao diện nó trông như "ảnh để công khai cho người xem". Hệ quả thật: ai cầm anon key cũng
**xoá sạch được ảnh cưới của khách** (dữ liệu không khôi phục được, chủ thiệp không hay biết
cho tới lúc mở thiệp thấy trống) hoặc **ghi đè ảnh** bằng nội dung bất kỳ.

Nghĩa là mức độ nặng hơn phần rò rỉ đọc ở trên: rò rỉ thì mất riêng tư, còn cái này mất dữ
liệu vĩnh viễn. Đã xử lý ở RC1.15 — bốn policy đó bị xoá, thay bằng đúng `select`/`insert`
cho `authenticated`, không cấp `update`/`delete` cho ai.

Kiểm lại bằng thực nghiệm sau khi sửa:

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST \
  -H "apikey: <ANON>" -H "Authorization: Bearer <ANON>" -H "Content-Type: text/plain" \
  --data "probe" https://<project>.supabase.co/storage/v1/object/wedding-images/__probe.txt
```

Sau RC1.15 phải ra **4xx**. Ra 200 là policy chưa áp đúng — và nhớ xoá file rác đó đi.

## Lần rà sau nên bắt đầu từ đâu

- Chạy lại đúng các lệnh ở trên, so với bảng kết quả.
- Mỗi khi thêm bucket mới hoặc Edge Function mới, hỏi hai câu: *anon liệt kê được không* và
  *có định danh nào tra ngược ra hồ sơ không*.
- Nguyên tắc rút ra từ lần này: **đừng coi UUID là bí mật.** Nó rò ra khỏi những chỗ không ai
  ngờ (ở đây là tên file trong kho ảnh). Quyền phải kiểm ở server theo người đăng nhập.
