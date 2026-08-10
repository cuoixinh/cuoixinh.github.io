// Build Tailwind cho CÁC TRANG ỨNG DỤNG (npm run build:css):
//   index.html · admin/ · my-invitations/ · invitation-setup/ (+ guests/) ·
//   theme-template/
// Nguồn: styles/tailwind-src.css → styles/build.css
//
// Trang thiệp public/themes/* dùng build RIÊNG (tailwind.themes.config.js →
// styles/themes.css) vì `rose-pastel` ở đó là hồng khói (#d4a5a5), còn ở đây là
// hồng phấn (#fbcfe8) — cùng tên class, khác giá trị nên không gộp chung được.
module.exports = {
  content: [
    "./index.html",
    "./404.html",
    "./router.html",
    "./js/**/*.js",
    "./core/**/*.js",
    "./admin/**/*.{html,js}",
    "./my-invitations/**/*.{html,js}",
    // invitation-setup nạp partials/*.html động qua loader.js → phải quét cả
    // thư mục partials, nếu không class trong đó bị purge mất.
    "./invitation-setup/**/*.{html,js}",
    "./theme-template/**/*.{html,js}",
  ],
  theme: {
    extend: {
      fontFamily: {
        playfair: ["Playfair Display", "serif"],
        vibes: ["Great Vibes", "cursive"],
        cormorant: ["Cormorant Garamond", "serif"],
        // Trình phát nhạc dùng chung (core/components/music-player.js) mượn
        // font của basic-gold cho khối tóm tắt — khai ở đây để bản xem trước
        // trong panel "Thành phần" không rơi về font mặc định.
        cinzel: ["Cinzel", "serif"],
        inter: ["Inter", "sans-serif"],
        allura: ["Allura", "cursive"],
      },
      // Mọi giá trị màu lấy từ styles/_colors.css. Dạng
      // `rgb(var(--token-rgb) / <alpha-value>)` để modifier alpha (bg-primary/50)
      // vẫn chạy — nhét thẳng var() đặc là mất tính năng đó.
      colors: {
        "rose-pastel": {
          50: "rgb(var(--card-cream-50-rgb) / <alpha-value>)",
          100: "rgb(var(--surface-section-rgb) / <alpha-value>)",
          200: "rgb(var(--surface-blossom-rgb) / <alpha-value>)",
          300: "rgb(var(--surface-blossom-strong-rgb) / <alpha-value>)",
        },
        cream: {
          50: "rgb(var(--card-cream-50-rgb) / <alpha-value>)",
          100: "rgb(var(--card-cream-100-rgb) / <alpha-value>)",
          200: "rgb(var(--card-cream-200-rgb) / <alpha-value>)",
        },
        // invitation-setup (config inline cũ)
        "pink-light": "rgb(var(--brand-primary-hover-rgb) / <alpha-value>)",
        "pink-light-hover": "rgb(var(--brand-primary-active-rgb) / <alpha-value>)",
        // Design token dùng chung
        primary: "rgb(var(--brand-primary-rgb) / <alpha-value>)",
        "primary-subtle": "rgb(var(--surface-brand-subtle-rgb) / <alpha-value>)",
        "color-primary": "rgb(var(--text-body-rgb) / <alpha-value>)",
        "color-secondary": "rgb(var(--focus-ring-rgb) / <alpha-value>)",
      },
      // .border-primary đọc token viền riêng (hiện trùng giá trị --primary
      // nhưng là token riêng) → giữ đúng bằng cách extend riêng borderColor.
      borderColor: {
        primary: "rgb(var(--brand-primary-rgb))",
      },
      keyframes: {
        bubbleIn: {
          to: { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        bubblePulse: {
          "0%": { transform: "scale(1)", opacity: ".55" },
          "100%": { transform: "scale(1.9)", opacity: "0" },
        },
        dotPulse: {
          "0%": { boxShadow: "0 0 0 0 rgb(var(--chat-online-dot-rgb) / .55)" },
          "70%": { boxShadow: "0 0 0 7px rgb(var(--chat-online-dot-rgb) / 0)" },
          "100%": { boxShadow: "0 0 0 0 rgb(var(--chat-online-dot-rgb) / 0)" },
        },
        typing: {
          "0%,60%,100%": { transform: "translateY(0)", opacity: ".5" },
          "30%": { transform: "translateY(-4px)", opacity: "1" },
        },
        msgIn: {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        ctaFlow: {
          "0%": {
            backgroundPosition: "100% 0",
            boxShadow: "0 8px 26px rgb(var(--cta-accent-rgb) / .42)",
          },
          "50%": {
            boxShadow:
              "0 12px 34px rgb(var(--cta-accent-rgb) / .62), 0 0 22px 2px rgb(var(--action-primary-rgb) / .32)",
          },
          "100%": {
            backgroundPosition: "-200% 0",
            boxShadow: "0 8px 26px rgb(var(--cta-accent-rgb) / .42)",
          },
        },
        // invitation-setup (config inline cũ)
        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        ctaShine: {
          "0%": { transform: "translateX(-120%) skewX(-18deg)" },
          "55%,100%": { transform: "translateX(320%) skewX(-18deg)" },
        },
      },
      animation: {
        bubbleIn: "bubbleIn .5s ease-out forwards",
        "bubbleIn-1": "bubbleIn .5s ease-out .15s forwards",
        "bubbleIn-2": "bubbleIn .5s ease-out .3s forwards",
        bubblePulse: "bubblePulse 2.4s ease-out infinite",
        dotPulse: "dotPulse 2s ease-out infinite",
        typing: "typing 1s ease-in-out infinite",
        msgIn: "msgIn .35s ease-out",
        ctaFlow: "ctaFlow 4s ease-in-out infinite",
        ctaShine: "ctaShine 3.4s ease-in-out infinite",
        // invitation-setup (config inline cũ)
        "fade-in": "fadeIn 0.3s ease-out",
      },
    },
  },
  plugins: [],
};
