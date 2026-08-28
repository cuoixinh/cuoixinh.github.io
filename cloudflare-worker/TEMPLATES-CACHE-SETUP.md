# Templates Cache Setup

Worker này gom danh sách templates + pricing từ Supabase thành một response JSON và cache lại.

## Deploy Worker

```bash
cd cloudflare-worker

# Deploy worker
wrangler deploy --config wrangler-templates.toml

# Set Supabase credentials
wrangler secret put SUPABASE_URL --config wrangler-templates.toml
# Nhập: https://lcobawmkywtxhpezndsh.supabase.co

wrangler secret put SUPABASE_ANON_KEY --config wrangler-templates.toml
# Nhập: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxjb2Jhd21reXd0eGhwZXpuZHNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4OTA5ODMsImV4cCI6MjA5MTQ2Njk4M30.4BNmxnfixXdHOq0ovtaF_4wQZ9sap3IWbJNJK9H4Mg4
```

## Worker URL

Sau khi deploy: `https://templates-cache.cuoixinh-api.workers.dev/`

## Test

```bash
curl https://templates-cache.cuoixinh-api.workers.dev/
```

Response:

```json
[
  {
    "id": "classic",
    "name": "Classic Elegance",
    "description": "Thiết kế sang trọng, cổ điển với màu pastel nhẹ nhàng",
    "thumbnail": "assets/images/ZIN_3506.jpg",
    "previewUrl": "public/themes/template1.html?preview=true",
    "theme": "template1",
    "status": "active",
    "category": "traditional",
    "price": 299000,
    "originalPrice": 499000
  }
]
```

## Cache Duration

Hai TTL khác nhau, cố ý (hằng số `EDGE_TTL` / `CLIENT_TTL` trong `templates-cache.js`):

| Tầng | TTL | Xoá được từ xa? |
| --- | --- | --- |
| Bản lưu ở edge (Cache API) | 7 ngày (604800s) | Có — `POST /purge` |
| Bản trả về trình duyệt khách | 5 phút (300s) | **Không** |

Cache trên máy khách không có cách nào xoá từ xa, nên `CLIENT_TTL` chính là **độ
trễ tối đa để một thay đổi template lan tới mọi khách**. Đổi giá hay thêm mẫu thì
chờ 5 phút là xong, không cần bấm gì; nút "Xóa cache" ở admin chỉ rút ngắn phần
edge. Muốn thấy ngay trên máy mình thì Ctrl+F5.

Hai giới hạn của `POST /purge` cần biết trước khi nghi nó hỏng:

- Cache API **riêng từng colo** → chỉ xoá ở colo nhận request purge, khách ở colo
  khác vẫn ăn bản cũ tới khi hết `EDGE_TTL`.
- Trên deployment `*.workers.dev`, Cache API không lưu gì cả → `deletedCount`
  luôn là `0`. Muốn lớp cache edge chạy thật thì phải trỏ worker qua custom
  domain của một zone Cloudflare.

## Frontend Integration

URL worker khai ở `core/config.js` (`CONFIG.cloudflare.templatesCache`), nơi dùng:

- `js/templates-data.js` — mục "Mẫu thiệp" ở trang chủ, hỏng thì tự đổi sang
  Edge Function `public-templates`.
- `core/utils.js` — bảng gợi ý mẫu khác ở trang thiệp xem thử.

Đặt `USE_CACHE = false` trong `core/config.js` khi test local → `templatesCache`
thành `null`, cả hai chỗ gọi thẳng Edge Function.

## Database Tables

Worker fetch từ 2 bảng:

1. `templates` - Thông tin mẫu thiệp
2. `template_pricing` - Giá và khuyến mãi

Merge dữ liệu theo `template_name` field.
