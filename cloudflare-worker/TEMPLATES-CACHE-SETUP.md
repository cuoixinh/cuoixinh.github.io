# Templates Cache Setup

Worker này cache danh sách templates + pricing từ Supabase, cache 7 ngày vì ít khi có mẫu mới.

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

- **7 ngày** (604800 seconds)
- Khi có mẫu mới hoặc thay đổi giá, purge cache:
  1. Vào Cloudflare Dashboard
  2. Workers & Pages → templates-cache
  3. Purge Cache

## Frontend Integration

File `landing-script.js` đã được cấu hình:

```javascript
const TEMPLATES_API_URL = "https://templates-cache.cuoixinh-api.workers.dev/";
```

## Database Tables

Worker fetch từ 2 bảng:

1. `templates` - Thông tin mẫu thiệp
2. `template_pricing` - Giá và khuyến mãi

Merge dữ liệu theo `template_name` field.
