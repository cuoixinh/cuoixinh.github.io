/**
 * Khác biệt của môi trường STAGING. Chỉ khai những khoá KHÁC production —
 * ngưỡng ảnh, retention, hạn mức import… dùng chung `core/config.js`, sửa một
 * lần là cả hai môi trường theo.
 *
 * KHÔNG nạp bằng thẻ <script>. Build nối file này vào CUỐI `core/config.js`:
 *     node scripts/deploy-public.mjs --dist --minify --env=staging --yes
 * Nhờ vậy lúc chạy vẫn đúng MỘT file `core/config.js` — 13 trang HTML và hai
 * loader không phải khai thêm gì, mẫu thiệp mới chép từ base-theme tự đúng — và
 * trong mã không có chỗ nào rẽ nhánh theo môi trường.
 *
 * Bọc IIFE vì script cổ điển: `const` cấp cao nhất là biến TOÀN CỤC, để trần là
 * mỗi trang staging mọc thêm mấy tên lạ.
 */
(function _cxStagingOverride() {
  const REF = "gmtnoxdwoumbtdmqmisk";
  const BASE = `https://${REF}.supabase.co`;
  const fn = (name) => `${BASE}/functions/v1/${name}`;

  CONFIG.env = "staging";

  CONFIG.supabase = {
    url: BASE,
    anonKey:
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdtdG5veGR3b3VtYnRkbXFtaXNrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkxMjI3MDQsImV4cCI6MjEwNDY5ODcwNH0.2KoGkOvdjgsnAQ3He1DHjJUi8AV8ETv2D-SclITZxEM",
    edgeUrl: fn("wedding-admin"),
    paymentUrl: fn("payment-handler"),
    guestHandlerUrl: fn("guest-handler"),
    aiChatUrl: fn("ai-chat"),
    aiInvitationUrl: fn("ai-invitation"),
    storageUrl: `${BASE}/storage/v1/object/public/wedding-images`,
  };

  // Bộ worker cache RIÊNG của staging (cloudflare-worker/wrangler-*-staging.toml).
  // Dựng đủ để staging chạy đúng đường đi của production — kể cả bước phải bấm
  // purge ở admin sau khi sửa giá hay danh mục mẫu, vốn là chỗ dễ quên nhất.
  // Bốn worker này trỏ về project staging; dùng nhầm URL của production là
  // staging phục vụ dữ liệu thật. Đi qua `USE_CACHE` cũng y như production: viết
  // cứng URL thì tắt cờ chỉ tắt được production, staging vẫn trả từ cache.
  CONFIG.cloudflare = {
    imageProxy: USE_CACHE
      ? "https://wedding-image-proxy-staging.cuoixinh-api.workers.dev"
      : null,
    templatesCache: USE_CACHE
      ? "https://templates-cache-staging.cuoixinh-api.workers.dev"
      : null,
    cacheProxy: USE_CACHE
      ? "https://wedding-cache-proxy-staging.cuoixinh-api.workers.dev"
      : null,
    // Phải khớp secret PURGE_SECRET đã đặt cho templates-cache-staging.
    purgeSecret: "SK7RnpzJ8e5/KJkzjYCLtNADB59h52LcgYILc1md1dA=",
  };
})();
