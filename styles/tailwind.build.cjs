/**
 * Config RIÊNG để biên dịch styles/common.src.css → styles/common.css.
 * Chỉ phục vụ việc mở rộng @apply cho các class .btn-* — KHÔNG quét HTML và
 * KHÔNG chèn reset (runtime vẫn dùng Tailwind Play CDN cho utility trong class).
 */
module.exports = {
  content: [], // file nguồn chỉ dùng @apply, không có @tailwind utilities → khỏi quét
  theme: { extend: {} }, // .btn-* chỉ dùng palette mặc định (rose/purple) + spacing chuẩn
  corePlugins: { preflight: false }, // không thêm base reset (tránh đè style toàn trang)
};
