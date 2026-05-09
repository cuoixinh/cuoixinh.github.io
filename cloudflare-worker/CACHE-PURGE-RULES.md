# Cloudflare Workers Cache Purge Rules

## Tóm Tắt Quan Trọng

**NGUYÊN TẮC VÀNG:** Cache key dùng để **LƯU** phải GIỐNG HỆT cache key dùng để **XÓA**!

Nếu không match chính xác → `cache.delete()` trả về `false` → `deletedCount = 0` → Cache không bị xóa.

---

## Cache Key Matching Rules

Cloudflare Cache API so sánh cache keys dựa trên:

1. **URL** (phải giống chính xác từng ký tự)
2. **HTTP Method** (GET, POST, PUT, DELETE, etc.)
3. **Headers** (nếu Request object có copy headers)

Nếu **BẤT KỲ** thứ gì khác nhau → Cache key KHÔNG match → Xóa thất bại.

---

## Vấn Đề Thường Gặp

### ❌ Lỗi #1: Copy Request Object Khi Tạo Cache Key

**Code SAI:**

```javascript
// Khi lưu cache
const cacheKey = new Request(request.url, request); // ← Copy toàn bộ request
await cache.put(cacheKey, response.clone());

// Khi xóa cache
const deleteKey = new Request(baseUrl, purgeRequest); // ← Copy purge request
await cache.delete(deleteKey);
```

**Tại sao SAI?**

- `new Request(url, request)` copy **method, headers, body** từ request object
- Request lưu cache: GET với headers của browser
- Request xóa cache: POST với headers khác
- → **KHÔNG MATCH** → Xóa thất bại

**Kết quả:**

```json
{
  "deletedCount": 0 // ← Cache không bị xóa
}
```

---

### ✅ Giải Pháp: Chỉ Dùng URL

**Code ĐÚNG:**

```javascript
// Khi lưu cache
const cacheKey = new Request(request.url); // ← CHỈ dùng URL
await cache.put(cacheKey, response.clone());

// Khi xóa cache
const deleteKey = new Request(baseUrl); // ← CHỈ dùng URL
await cache.delete(deleteKey);
```

**Tại sao ĐÚNG?**

- `new Request(url)` tạo Request với:
  - URL: từ tham số
  - Method: `GET` (default)
  - Headers: rỗng (default)
- Cả lưu và xóa đều dùng cùng cách → **MATCH** → Xóa thành công

**Kết quả:**

```json
{
  "deletedCount": 1 // ← Cache đã bị xóa
}
```

---

## So Sánh Chi Tiết

### Ví Dụ: Cache Key Không Match

**Lưu cache (GET request từ browser):**

```javascript
const cacheKey = new Request(request.url, request);
// Tạo ra:
{
  url: "https://api.example.com/",
  method: "GET",
  headers: {
    "accept": "*/*",
    "user-agent": "Mozilla/5.0...",
    "referer": "https://example.com",
    // ... 10+ headers khác
  }
}
```

**Xóa cache (POST request từ purge endpoint):**

```javascript
const deleteKey = new Request(baseUrl, purgeRequest);
// Tạo ra:
{
  url: "https://api.example.com",  // ← Thiếu trailing slash!
  method: "POST",  // ← Khác method!
  headers: {
    "x-purge-secret": "...",
    "content-type": "application/json",
    // ... headers khác
  }
}
```

**Kết quả so sánh:**

| Thuộc tính | Cache Gốc       | Delete Key    | Match? |
| ---------- | --------------- | ------------- | ------ |
| URL        | `...com/`       | `...com`      | ❌     |
| Method     | `GET`           | `POST`        | ❌     |
| Headers    | Browser headers | Purge headers |        |

→ **KHÔNG MATCH** → `cache.delete()` trả về `false`

---

### Ví Dụ: Cache Key Match Thành Công

**Lưu cache:**

```javascript
const cacheKey = new Request(request.url);
// Tạo ra:
{
  url: "https://api.example.com/",
  method: "GET",  // default
  headers: {}  // empty
}
```

**Xóa cache:**

```javascript
const deleteKey = new Request(baseUrl + "/");
// Tạo ra:
{
  url: "https://api.example.com/",
  method: "GET",  // default
  headers: {}  // empty
}
```

**Kết quả so sánh:**

| Thuộc tính | Cache Gốc | Delete Key | Match? |
| ---------- | --------- | ---------- | ------ |
| URL        | `...com/` | `...com/`  | ✅     |
| Method     | `GET`     | `GET`      | ✅     |
| Headers    | `{}`      | `{}`       | ✅     |

→ **MATCH** → `cache.delete()` trả về `true`

---

## Best Practices

### 1. Đơn Giản Hóa Cache Key

**Khuyến nghị:** Chỉ dùng URL làm cache key, không copy request object.

```javascript
// ✅ ĐÚNG - Đơn giản, dễ match
const cacheKey = new Request(url);

// ❌ SAI - Phức tạp, khó match
const cacheKey = new Request(url, request);
```

### 2. Xử Lý Trailing Slash

URL với và không có trailing slash là **KHÁC NHAU**:

```javascript
"https://api.example.com"; // ← Khác
"https://api.example.com/"; // ← Khác
```

**Giải pháp:** Thử xóa cả 2 variants:

```javascript
const keysToDelete = [
  new Request(baseUrl), // Không có /
  new Request(baseUrl + "/"), // Có /
];

for (const key of keysToDelete) {
  await cache.delete(key);
}
```

### 3. Log Để Debug

Luôn log ra để biết cache có bị xóa không:

```javascript
const deleted = await cache.delete(key);
if (deleted) {
  console.log("✅ Deleted cache for:", key.url);
} else {
  console.log("❌ Cache not found for:", key.url);
}
```

### 4. Return Thông Tin Chi Tiết

Trả về `keysAttempted` để debug:

```javascript
return new Response(
  JSON.stringify({
    success: true,
    deletedCount,
    keysAttempted: keysToDelete.map((k) => k.url),
  }),
);
```

---

## Template Code Đúng

### Lưu Cache

```javascript
async fetch(request, env) {
  const cache = caches.default;

  // ✅ Chỉ dùng URL
  const cacheKey = new Request(request.url);

  let response = await cache.match(cacheKey);

  if (!response) {
    // Fetch from origin
    response = await fetchFromOrigin();

    // Store in cache
    await cache.put(cacheKey, response.clone());
  }

  return response;
}
```

### Xóa Cache

```javascript
async function handlePurge(request, env) {
  const cache = caches.default;
  const url = new URL(request.url);
  const baseUrl = url.origin;

  // ✅ Thử xóa cả 2 variants (với và không có /)
  const keysToDelete = [new Request(baseUrl), new Request(baseUrl + "/")];

  let deletedCount = 0;
  const keysAttempted = [];

  for (const key of keysToDelete) {
    keysAttempted.push(key.url);
    const deleted = await cache.delete(key);

    if (deleted) {
      deletedCount++;
      console.log("✅ Deleted:", key.url);
    } else {
      console.log("❌ Not found:", key.url);
    }
  }

  return new Response(
    JSON.stringify({
      success: true,
      deletedCount,
      keysAttempted,
    }),
  );
}
```

---

## Troubleshooting

### Vấn đề: `deletedCount` luôn là 0

**Nguyên nhân có thể:**

1. ❌ Cache key lưu và xóa không giống nhau
2. ❌ URL không chính xác (thiếu/thừa trailing slash)
3. ❌ Copy request object khi tạo cache key
4. ❌ Method khác nhau (GET vs POST)
5. ❌ Headers khác nhau

**Cách debug:**

```javascript
// Log cache key khi lưu
console.log("Saving cache with key:", cacheKey.url, cacheKey.method);

// Log cache key khi xóa
console.log("Deleting cache with key:", deleteKey.url, deleteKey.method);

// So sánh 2 logs để tìm khác biệt
```

### Vấn đề: Cache vẫn tồn tại sau khi purge

**Kiểm tra:**

1. Verify `deletedCount > 0` trong response
2. Hard refresh browser (Ctrl+Shift+R) để bypass browser cache
3. Check Cloudflare Dashboard → Caching → Configuration
4. Thử "Purge Everything" nếu cần (xóa toàn bộ cache)

---

## Tài Liệu Tham Khảo

- [Cloudflare Workers Cache API](https://developers.cloudflare.com/workers/runtime-apis/cache/)
- [Request Constructor](https://developer.mozilla.org/en-US/docs/Web/API/Request/Request)
- [Cache.delete()](https://developer.mozilla.org/en-US/docs/Web/API/Cache/delete)

---

## Checklist Khi Implement Cache Purge

- [ ] Cache key chỉ dùng URL (không copy request object)
- [ ] Thử xóa cả URL với và không có trailing slash
- [ ] Log ra để debug (`console.log`)
- [ ] Return `deletedCount` và `keysAttempted` trong response
- [ ] Test purge sau khi deploy
- [ ] Verify `deletedCount > 0`
- [ ] Verify data mới được fetch sau purge

---

**Nhớ:** Cache key phải **GIỐNG HỆT** khi lưu và khi xóa! 🔑
❌ |
