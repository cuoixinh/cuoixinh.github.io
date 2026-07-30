# assets/data-template

Dữ liệu **demo riêng cho từng theme** — dùng làm bản xem thử (`?preview=true`)
khi khách chưa nhập gì. Mỗi theme một thư mục trùng tên với thư mục trong
`public/themes/`, ví dụ `romantic-gold/`.

- **Ghi**: trang admin → màn **Dữ liệu mẫu** (`/admin#sample-images`), lưu thẳng
  xuống thư mục này qua File System Access API (Chrome/Edge desktop, localhost).
  Xem `admin/js/03-sample-images.js` (ảnh) và `admin/js/04-sample-data.js` (chữ).
- **Đọc**: `public/themes/preview-data.js` fetch `<theme>/data.json` rồi đắp lên
  bộ data preview mặc định — field nào không có thì giữ nguyên giá trị mặc định.

Mỗi thư mục theme gồm `data.json` + các file ảnh đi kèm:

```
romantic-gold/
├─ data.json
├─ cover.jpg          groom.jpg  bride.jpg
├─ groom-qr.png       bride-qr.png
├─ gallery-01.jpg …   gallery-10.jpg
└─ love-story-01.jpg … love-story-10.jpg
```

`data.json`:

```jsonc
{
  "cover_image_url": "cover.jpg",        // tên file, KHÔNG phải đường dẫn
  "groom_image_url": "groom.jpg",
  "bride_image_url": "bride.jpg",
  "groom_qr_url": "groom-qr.png",
  "bride_qr_url": "bride-qr.png",
  "gallery_images": ["gallery-01.jpg", "gallery-02.jpg"],
  "image_focal_points": {
    "cover_image_url": { "x": 50, "y": 40 },
    "gallery_images": { "gallery-01.jpg": { "x": 50, "y": 50 } }
  },
  "love_story": [
    { "date": "2019", "title": "…", "content": "…",
      "image_url": "love-story-01.jpg", "focal_point": { "x": 50, "y": 50 } }
  ],
  "content": {                            // phần CHỮ, khoá trùng tên cột thiệp
    "groom_name": "…", "bride_name": "…",
    "ceremony_date": "2026-12-12",        // YYYY-MM-DD
    "ceremony_time": "10:00",             // HH:MM
    "ceremony_lunar": "Tức ngày 19 tháng 9 năm …",
    "timeline": [{ "time": "17:00", "title": "…", "type": "party" }],
    "vu_quy_enabled": true, "enable_music": false
  },
  "updated_at": "2026-07-26T…"
}
```

Quy ước quan trọng:

- Nút **Sinh dữ liệu bằng AI** gọi Edge Function `ai-invitation` với
  `mode: "sample"` — server tự nghĩ ra cả cặp đôi hư cấu (tên, cha mẹ, địa chỉ,
  ngày giờ, ngân hàng, chuyện tình, lịch trình, lời ngỏ). Client không giữ sẵn
  dữ liệu mẫu nào. Còn link nhạc phải tự nhập và ảnh vẫn up tay.
- 4 ô **Google Maps embed URL** có nút **Chọn trên bản đồ** (dùng chung
  `openMapPicker()` với trang thiết lập thiệp — cần Leaflet ở `admin/index.html`)
  và hiện sẵn địa chỉ đã gõ ở ô "Địa điểm" cùng khối để chép / mở thẳng Google
  Maps đã điền từ khoá. Dán cả thẻ `<iframe>` cũng được, phần `src` tự tách.
- Hai khối tiệc có ô tích **"Trùng địa điểm …"**, cùng luật với
  `invitation-setup/js/16-ceremony.js`: tiệc nhà **trai** theo Lễ thành hôn,
  tiệc nhà **gái** theo Lễ vu quy nếu vu quy bật, không thì cũng Lễ thành hôn.
  Đang tích thì ô địa điểm + link bản đồ bị khoá và tự chép từ nguồn (kể cả khi
  gõ dở hoặc vừa chọn trên bản đồ). Ô tích **không** được ghi vào `data.json` —
  file luôn chứa giá trị đã giải ra; mở lại thì suy ngược: địa điểm tiệc còn
  trống nghĩa là đang trùng.
- Admin **quét thư mục** khi chọn theme: ảnh đặt đúng tên như trên vẫn được nhận
  dù `data.json` thiếu; ảnh tên lạ được đưa vào album và đổi tên chuẩn khi lưu.
- Bấm **Lưu vào ổ đĩa** sẽ **ghi đè toàn bộ ảnh** trong thư mục theme: file ảnh
  nào không thuộc bộ vừa ghi đều bị xoá (file không phải ảnh giữ nguyên). Ảnh
  đọc lên từ chính thư mục này, chưa sửa và vẫn giữ nguyên tên thì **không ghi
  lại** — bộ ảnh mẫu cỡ vài chục MB, lưu lại tất mỗi lần vừa lâu vừa dễ đứt.
- **Nén ảnh khi lưu** (`siCompressAllForSave()`): mỗi lần lưu, mọi ảnh được soi
  lại theo đúng ngưỡng của ảnh khách tự upload (`core/bl/image-bl.js`: ≤ 1920px
  mỗi chiều, ≤ 1MB). Ảnh đã thoả thì **bỏ qua**, không mã hoá lại; ảnh chưa thoả
  thì nén rồi **ghi đè** luôn file trên đĩa. Nhờ vậy ảnh chép tay vào thư mục
  (ảnh gốc máy ảnh 5-10MB) không còn làm thiệp mẫu nặng hơn thiệp thật. Ngoại lệ:
  GIF/AVIF/BMP giữ nguyên (`ImageBL.canRecompress()` — qua canvas là mất
  animation / đổi định dạng), và JPEG đã tối ưu sẵn mà nén lại còn nặng hơn thì
  cũng giữ bản gốc.
- `data.json` được ghi **2 lần** mỗi lần lưu: ngay đầu (phần chữ + tham chiếu
  ảnh cũ, để chữ an toàn không phải chờ vài chục MB ảnh) và cuối cùng (chốt tên
  ảnh chuẩn). Ảnh ghi lỗi giữa chừng thì bước xoá ảnh cũ **không** chạy và
  thông báo lỗi nêu rõ tên file chết.
- **Lưu dở dang tự ghi tiếp**: `saveSampleImages()` đặt cờ `si_resume_save`
  (localStorage) trước khi động vào đĩa và xoá ở `finally`. Trang chết giữa
  chừng thì `finally` không chạy → cờ ở lại, lần chọn theme sau
  `siResumeSaveIfInterrupted()` tự ghi tiếp. Ảnh nào đã đúng trên đĩa được
  `siIsUnchanged()` bỏ qua (so tên+cỡ, không khớp thì so từng byte với file
  thật) nên mỗi vòng chỉ ghi phần còn thiếu. Tối đa `SI_MAX_RESUME` = 5 vòng
  rồi nhường lại cho người dùng, tránh lặp vô tận.
- ⚠️ **Live Server**: nó theo dõi cả workspace nên mỗi ảnh ghi ra là reload
  trang, cắt ngang vòng lưu — mà KHÔNG có thông báo lỗi nào (trang chết trước
  khi tới `catch`). `.vscode/settings.json` đã thêm `assets/data-template/**`
  vào `liveServer.settings.ignoreFiles` — sửa file này xong phải **tắt/bật lại
  Live Server** mới ăn. Dứt điểm hơn: tắt Live Server, chạy server không có
  watcher **trên đúng cổng 5500** để giữ nguyên origin (quyền thư mục + bản nháp
  lưu theo origin trong IndexedDB, đổi cổng là mất):

  ```bash
  python3 -m http.server 5500 --bind 127.0.0.1
  ```
- `content` chỉ chứa field đã nhập (chuỗi rỗng bị bỏ); riêng các công tắc
  (`enable_*`, `vu_quy_enabled`, `rsvp_enabled`, `*_show_location`) luôn được ghi
  vì `false` cũng là một lựa chọn.
