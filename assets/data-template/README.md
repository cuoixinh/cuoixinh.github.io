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
  dữ liệu mẫu nào. Còn 4 ô Google Maps embed + link nhạc phải tự nhập, và ảnh
  vẫn up tay.
- Admin **quét thư mục** khi chọn theme: ảnh đặt đúng tên như trên vẫn được nhận
  dù `data.json` thiếu; ảnh tên lạ được đưa vào album và đổi tên chuẩn khi lưu.
- Bấm **Lưu vào ổ đĩa** sẽ **ghi đè toàn bộ ảnh** trong thư mục theme: file ảnh
  nào không thuộc bộ vừa ghi đều bị xoá (file không phải ảnh giữ nguyên).
- `content` chỉ chứa field đã nhập (chuỗi rỗng bị bỏ); riêng các công tắc
  (`enable_*`, `vu_quy_enabled`, `rsvp_enabled`, `*_show_location`) luôn được ghi
  vì `false` cũng là một lựa chọn.
