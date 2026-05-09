# Hướng dẫn Purge Cache cho Templates

## 1. Setup Environment Variable

Thêm biến môi trường `PURGE_SECRET` vào Cloudflare Worker:

```bash
# Tạo secret key (chạy trong terminal)
openssl rand -base64 32

# Hoặc dùng password generator
```

Sau đó thêm vào Cloudflare Worker:

1. Vào Cloudflare Dashboard
2. Workers & Pages → templates-cache
3. Settings → Variables
4. Add variable:
   - Name: `PURGE_SECRET`
   - Value: `<secret-key-của-bạn>`
   - Type: Encrypted

## 2. Cách Purge Cache

### Từ Terminal/Postman:

```bash
curl -X POST https://templates-cache.cuoixinh-api.workers.dev/purge \
  -H "X-Purge-Secret: <your-secret-key>" \
  -H "Content-Type: application/json"
```

### Từ JavaScript (Admin Panel):

```javascript
async function purgeTemplatesCache() {
  const response = await fetch(
    "https://templates-cache.cuoixinh-api.workers.dev/purge",
    {
      method: "POST",
      headers: {
        "X-Purge-Secret": "YOUR_SECRET_KEY",
        "Content-Type": "application/json",
      },
    },
  );

  const result = await response.json();
  console.log(result);
  // { success: true, message: "Cache purged successfully", deleted: true }
}
```

## 3. Khi nào cần Purge Cache?

- Thêm/xóa/sửa template trong database
- Thay đổi giá template
- Thay đổi thông tin template (tên, mô tả, thumbnail...)
- Sau khi chạy `database-complete.sql`

## 4. Tích hợp vào Admin Panel

Thêm button "Xóa Cache" trong admin panel để admin có thể purge cache dễ dàng.

```html
<button onclick="purgeCache()">
  <i class="fas fa-sync"></i> Xóa Cache Templates
</button>
```

## 5. Security

- **KHÔNG** commit `PURGE_SECRET` vào Git
- **KHÔNG** để secret trong frontend code
- Chỉ admin mới có quyền purge cache
- Secret phải đủ mạnh (32+ ký tự random)
