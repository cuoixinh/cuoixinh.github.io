/** Cấu hình tập trung: API key, URL, ngưỡng ảnh… */

// Set false khi test localhost để bypass Cloudflare cache → hit Supabase trực tiếp
const USE_CACHE = false;

// ĐỔI GIÁ TRỊ NÀY MỖI LẦN DEPLOY. Hai loader (admin, invitation-setup) nối
// `?v=<version>` vào mọi URL partial/script chúng nạp, nên đổi số ở đây là ép
// trình duyệt lẫn CDN lấy bản mới của TOÀN BỘ nhóm đó cùng lúc — quan trọng vì
// partial và script phải khớp bộ với nhau, lệch phiên bản là trang vỡ.
// Bản thân file này KHÔNG mang `?v=` (nó là mỏ neo, phải đọc được version từ
// nó trước đã) → trên Cloudflare phải có Cache Rule bypass `/core/config.js`,
// nếu không đổi số ở đây cũng vô nghĩa.
const CX_VERSION = "2026.08.11-2";

const CONFIG = {
  version: CX_VERSION,

  // Supabase
  supabase: {
    url: "https://lcobawmkywtxhpezndsh.supabase.co",
    anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxjb2Jhd21reXd0eGhwZXpuZHNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4OTA5ODMsImV4cCI6MjA5MTQ2Njk4M30.4BNmxnfixXdHOq0ovtaF_4wQZ9sap3IWbJNJK9H4Mg4",
    edgeUrl:
      "https://lcobawmkywtxhpezndsh.supabase.co/functions/v1/wedding-admin",
    paymentUrl:
      "https://lcobawmkywtxhpezndsh.supabase.co/functions/v1/payment-handler",
    guestHandlerUrl:
      "https://lcobawmkywtxhpezndsh.supabase.co/functions/v1/guest-handler",
    aiInvitationUrl:
      "https://lcobawmkywtxhpezndsh.supabase.co/functions/v1/ai-invitation",
    storageUrl:
      "https://lcobawmkywtxhpezndsh.supabase.co/storage/v1/object/public/wedding-images",
  },

  // Cloudflare Workers (null khi USE_CACHE = false)
  cloudflare: {
    imageProxy:     USE_CACHE ? "https://wedding-image-proxy.cuoixinh-api.workers.dev" : null,
    templatesCache: USE_CACHE ? "https://templates-cache.cuoixinh-api.workers.dev" : null,
    cacheProxy:     USE_CACHE ? "https://wedding-cache-proxy.cuoixinh-api.workers.dev" : null,
    purgeSecret: "9JMoLdvCWhD2W0CGJpsiq+7n/xESNgq6m91bm70cDkg=",
  },

  // Encryption & Security
  security: {
    encryptionKey: "dqvinh",
  },

  // Polling & Timeouts
  polling: {
    interval: 30000, // 30 seconds
    timeout: 300000, // 5 minutes
  },

  // Ngưỡng nén ảnh phía client (core/helpers/image-helper.js).
  // Cả web nén ĐÚNG MỘT LẦN, ngay lúc ảnh vào state (người dùng chọn ảnh / bind
  // ảnh từ đĩa); lúc lưu KHÔNG nén lại. Ảnh đã đạt ngưỡng thì giữ nguyên bản gốc.
  image: {
    // Chặn đầu vào trước khi decode — ảnh nặng hơn mức này bị từ chối luôn để
    // không treo trình duyệt. Áp cho MỌI luồng.
    maxInputMB: 50,

    // Định dạng được NHẬN (whitelist, không dùng `image/*`) — mặc định cho ảnh
    // khách. SVG loại (file chủ động, chứa được script); HEIC/HEIF loại (canvas
    // không decode, nhiều trình duyệt desktop không hiển thị); BMP/TIFF loại
    // (nặng vô lý). GIF/AVIF nhận nhưng canRecompress() không nén.
    // Luồng nào cần nới thì khai `allowedTypes` riêng.
    allowedTypes: [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
      "image/gif",
      "image/avif",
    ],

    // Ảnh khách tự upload (invitation-setup). Siết chặt nhất: ảnh đi qua băng
    // thông Supabase và được tải lại mỗi lần khách mời mở thiệp.
    customer: {
      maxWidth: 1920,
      maxHeight: 1920,
      maxSizeMB: 1,
      quality: 0.85,
    },

    // Ảnh mẫu của theme (admin → tab "Dữ liệu mẫu"). Ghi thẳng vào repo, admin
    // tự kiểm soát nên cho nặng hơn khách để giữ chất lượng. Chỉ ghi đè phần
    // khác `customer`; khung ảnh vẫn 1920px.
    sampleData: {
      maxSizeMB: 1.5,
      // Khớp SI_IMAGE_EXT_RE trong admin/js/03-sample-images.js (có thêm BMP).
      allowedTypes: [
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/webp",
        "image/gif",
        "image/avif",
        "image/bmp",
      ],
    },

    // Kho ảnh dùng chung (admin → tab "Ảnh mẫu"). Mọi danh mục (icon hoa, khung
    // viền, ảnh landing) đều dùng ngưỡng này. Danh mục nào cần siết chặt hơn thì
    // khai maxPx/maxSizeMB riêng tại AX_PRESETS trong admin/js/05-asset-images.js.
    assets: {
      maxPx: 1920,
      maxSizeMB: 1,
      // Kho ảnh CÓ SVG thật (icon hoa, khung viền) — khớp AX_IMAGE_EXT_RE trong
      // admin/js/05-asset-images.js. Chỉ admin mới up được vào đây nên chấp nhận
      // được; ảnh khách vẫn dùng whitelist mặc định ở trên.
      allowedTypes: [
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/webp",
        "image/gif",
        "image/avif",
        "image/bmp",
        "image/svg+xml",
      ],
    },
  },

  // Love Story
  maxLoveStoryItems: 10,

  // Guest Import Limits
  guestImport: {
    maxFileSizeMB: 5,
    maxRows: 100,
    maxFieldLength: 200,
    batchSize: 50,
  },

  // Default Music
  defaultMusic: {
    youtubeUrl:
      "https://www.youtube.com/watch?v=06-XXOTP3Gc&list=RD06-XXOTP3Gc&start_radio=1",
  },
};
