# Cloudflare Worker - Cache Proxy

## Tại sao cần?

Supabase free tier giới hạn **500k Edge Function invocations/tháng**.
Mỗi khách mời xem thiệp = 1 lần gọi API. Nếu 1 đám cưới có 300 khách, mỗi người xem 3 lần = 900 requests chỉ cho 1 đám cưới.

Cloudflare Worker cache response GET trong **5 phút** → giảm 80-90% requests xuống Supabase.

## Kiến trúc sau khi tích hợp

```
Khách mời → Cloudflare Worker (cache) → Supabase Edge Function → PostgreSQL
                    ↑
              Cache HIT: trả về ngay, không tốn quota Supabase
```

## Setup

### 1. Cài Wrangler CLI

```bash
npm install -g wrangler
wrangler login
```

### 2. Tạo KV Namespace

```bash
wrangler kv:namespace create "WEDDING_CACHE"
wrangler kv:namespace create "WEDDING_CACHE" --preview
```

Copy 2 ID trả về vào `wrangler.toml`:

```toml
id = "abc123..."
preview_id = "def456..."
```

### 3. Deploy Worker

```bash
cd cloudflare-worker
wrangler deploy
```

Sau khi deploy, Cloudflare sẽ cấp URL dạng:

```
https://wedding-cache-proxy.YOUR_SUBDOMAIN.workers.dev
```

### 4. Update WORKER_URL trong frontend

Mở file `api-config.js` ở root project, thay:

```js
const WORKER_URL = "https://wedding-cache-proxy.YOUR_SUBDOMAIN.workers.dev";
```

### 5. (Tùy chọn) Custom domain

Nếu có domain riêng (vd: `cuoixinh.com`), vào Cloudflare Dashboard → Workers → Add Route:

```
cuoixinh.com/api/* → wedding-cache-proxy
```

Rồi update `WORKER_URL = 'https://cuoixinh.com/api'`

## Cache Strategy

| Request    | Cache | TTL    | Lý do                           |
| ---------- | ----- | ------ | ------------------------------- |
| GET ?slug= | ✅    | 5 phút | Khách mời xem thiệp - đọc nhiều |
| GET ?id=   | ✅    | 5 phút | Khách hàng load form quản lý    |
| GET ?list= | ❌    | -      | Admin panel - cần data realtime |
| POST       | ❌    | -      | Tạo mới - không cache           |
| PATCH      | ❌    | -      | Cập nhật + invalidate cache     |
| DELETE     | ❌    | -      | Xóa + invalidate cache          |

## Giới hạn Cloudflare Free

| Tính năng       | Free tier |
| --------------- | --------- |
| Worker requests | 100k/ngày |
| KV reads        | 100k/ngày |
| KV writes       | 1k/ngày   |
| KV storage      | 1GB       |

Hoàn toàn đủ dùng cho scale vừa.
