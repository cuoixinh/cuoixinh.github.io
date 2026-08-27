// Build Tailwind cho TRANG THIỆP public/themes/* (npm run build:themes).
// Nguồn: styles/themes-src.css → styles/themes.css
// Tách khỏi tailwind.config.js vì `rose-pastel` ở đây là tông hồng khói (#d4a5a5)
// — trùng tên nhưng khác giá trị với bảng hồng phấn của trang ứng dụng.
module.exports = {
  content: [
    "./public/themes/**/*.{html,js}",
    // Theme render qua helper dùng chung (loadWeddingData, applyThemeSetting,
    // applyCustomBlocks…) — các file này sinh markup kèm class nên phải quét,
    // nếu không class chỉ xuất hiện trong JS sẽ bị purge.
    "./core/**/*.js",
  ],
  theme: {
    extend: {
      // Bảng font dùng chung — thêm/sửa font ở tailwind.fonts.js, đừng khai lẻ ở đây.
      fontFamily: require("./tailwind.fonts.js"),
      // Mọi giá trị màu lấy từ styles/_colors.css (mục "PALETTE THIỆP").
      // Dạng `rgb(var(--token-rgb) / <alpha-value>)` để giữ modifier alpha
      // (text-vintage-brown/70, to-sage-50/90…).
      colors: {
        // Basic Gold
        cream: {
          50: "rgb(var(--card-cream-50-rgb) / <alpha-value>)",
          100: "rgb(var(--card-cream-100-rgb) / <alpha-value>)",
          200: "rgb(var(--card-cream-200-rgb) / <alpha-value>)",
        },
        "rose-pastel": {
          50: "rgb(var(--card-blush-50-rgb) / <alpha-value>)",
          100: "rgb(var(--card-blush-100-rgb) / <alpha-value>)",
          200: "rgb(var(--card-blush-200-rgb) / <alpha-value>)",
          300: "rgb(var(--card-blush-300-rgb) / <alpha-value>)",
        },
        "stone-custom": {
          400: "rgb(var(--card-stone-400-rgb) / <alpha-value>)",
          500: "rgb(var(--card-stone-500-rgb) / <alpha-value>)",
          600: "rgb(var(--card-stone-600-rgb) / <alpha-value>)",
        },
        // Romantic Gold
        sage: {
          50: "rgb(var(--card-sage-50-rgb) / <alpha-value>)",
          100: "rgb(var(--card-sage-100-rgb) / <alpha-value>)",
          200: "rgb(var(--card-sage-200-rgb) / <alpha-value>)",
          300: "rgb(var(--card-sage-300-rgb) / <alpha-value>)",
          400: "rgb(var(--card-sage-400-rgb) / <alpha-value>)",
        },
        gold: {
          100: "rgb(var(--card-gold-100-rgb) / <alpha-value>)",
          200: "rgb(var(--card-gold-200-rgb) / <alpha-value>)",
          300: "rgb(var(--card-gold-300-rgb) / <alpha-value>)",
          400: "rgb(var(--card-gold-400-rgb) / <alpha-value>)",
        },
        charcoal: "rgb(var(--card-charcoal-rgb) / <alpha-value>)",
        // Vintage Forest
        vintage: {
          cream: "rgb(var(--card-vintage-cream-rgb) / <alpha-value>)",
          beige: "rgb(var(--card-vintage-beige-rgb) / <alpha-value>)",
          brown: "rgb(var(--card-vintage-brown-rgb) / <alpha-value>)",
          dark: "rgb(var(--card-vintage-dark-rgb) / <alpha-value>)",
          green: "rgb(var(--card-vintage-green-rgb) / <alpha-value>)",
        },
        // Design token dùng chung (styles/_colors.css)
        primary: "rgb(var(--brand-primary-rgb) / <alpha-value>)",
        "primary-subtle": "rgb(var(--surface-brand-subtle-rgb) / <alpha-value>)",
        "color-primary": "rgb(var(--text-body-rgb) / <alpha-value>)",
        "color-secondary": "rgb(var(--focus-ring-rgb) / <alpha-value>)",
      },
      borderColor: {
        primary: "rgb(var(--brand-primary-rgb))",
      },
      // showToast() trong core/utils.js (dùng chung, chạy cả trên trang thiệp)
      // gắn class animate-fade-in. Config CDN cũ của theme không khai báo nên
      // toast ở trang thiệp không có hiệu ứng — khai báo lại cho khớp.
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-in": "fadeIn 0.3s ease-out",
      },
    },
  },
  plugins: [],
};
