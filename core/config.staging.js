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

  // Cờ cache RIÊNG của staging, cố ý ĐỘC LẬP với `USE_CACHE` của production: đây là
  // nơi sửa giá và danh mục mẫu liên tục, đi qua cache thì mỗi lần đổi lại phải nhớ
  // bấm purge, mà quên là ngồi soi một bản dữ liệu cũ tưởng mình sửa hỏng.
  // Đổi thành true khi cần diễn lại đúng đường đi của production (gồm cả bước purge).
  const STAGING_USE_CACHE = false;

  // Bộ worker cache RIÊNG của staging (cloudflare-worker/wrangler-*-staging.toml),
  // trỏ về project staging — dùng nhầm URL của production là staging phục vụ dữ
  // liệu thật. Giữ nguyên URL ở đây dù đang tắt: bật lại chỉ là đổi một chữ.
  CONFIG.cloudflare = {
    imageProxy: STAGING_USE_CACHE
      ? "https://wedding-image-proxy-staging.cuoixinh-api.workers.dev"
      : null,
    templatesCache: STAGING_USE_CACHE
      ? "https://templates-cache-staging.cuoixinh-api.workers.dev"
      : null,
    cacheProxy: STAGING_USE_CACHE
      ? "https://wedding-cache-proxy-staging.cuoixinh-api.workers.dev"
      : null,
    // Phải khớp secret PURGE_SECRET đã đặt cho templates-cache-staging.
    purgeSecret: "SK7RnpzJ8e5/KJkzjYCLtNADB59h52LcgYILc1md1dA=",
  };
})();
