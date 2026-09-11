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

  // Staging CỐ Ý không dùng worker cache: mọi DAL đã có nhánh lùi khi thiếu URL
  // (wedding-dal `workerUrl || edgeUrl`, storage-dal `imageProxy || storageUrl`,
  // templates-dal `_viaEdge`). Không cache là đúng thứ cần khi test — sửa xong
  // thấy ngay, khỏi đi purge. `purgeSecret` null vì không có gì để purge.
  CONFIG.cloudflare = {
    imageProxy: null,
    templatesCache: null,
    cacheProxy: null,
    purgeSecret: null,
  };
})();
