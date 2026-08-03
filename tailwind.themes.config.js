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
      fontFamily: {
        // Basic Gold + Vintage Forest
        playfair: ["Playfair Display", "serif"],
        vibes: ["Great Vibes", "cursive"],
        cinzel: ["Cinzel", "serif"],
        nautigal: ["TheNautigal", "cursive"],
        katty: ["KattyDiona", "cursive"],
        octet: ["OctetStream", "sans-serif"],
        // Romantic Gold
        allura: ["Allura", "cursive"],
        "cinzel-deco": ["Cinzel Decorative", "cursive"],
        // Common
        cormorant: ["Cormorant Garamond", "serif"],
        inter: ["Inter", "sans-serif"],
      },
      colors: {
        // Basic Gold
        cream: {
          50: "#fffbf7",
          100: "#fff5f0",
          200: "#ffe8e0",
        },
        "rose-pastel": {
          50: "#fef0f2",
          100: "#f5d5d8",
          200: "#e8b4b8",
          300: "#d4a5a5",
        },
        "stone-custom": {
          400: "#78716c",
          500: "#6b6562",
          600: "#44403c",
        },
        // Romantic Gold
        sage: {
          50: "#f6f7f6",
          100: "#e8ebe8",
          200: "#d1d8d1",
          300: "#b4bfb4",
          400: "#8a9a8a",
        },
        gold: {
          100: "#f5f0e8",
          200: "#e8dcc8",
          300: "#c9b896",
          400: "#a89968",
        },
        charcoal: "#2d3436",
        // Vintage Forest
        vintage: {
          cream: "#faf8f3",
          beige: "#f5f1e8",
          brown: "#8b7355",
          dark: "#4a3f35",
          green: "#3d4f3d",
        },
        // Design token dùng chung (styles/_common.css) — thay 6 utility viết tay
        // trong common.css cũ.
        primary: "var(--primary)",
        "primary-subtle": "var(--primary-subtle)",
        "color-primary": "var(--text-color-primary)",
        "color-secondary": "var(--text-color-secondary)",
      },
      borderColor: {
        primary: "var(--primary-border)",
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
