// Build local cho trang chủ (index.html) — thay thế Tailwind Play CDN.
// Nội dung theme.extend giữ nguyên từ js/tailwind-config.js (bản chạy qua CDN cũ).
// content chỉ quét đúng những file index.html thực sự nạp, để không lẫn class
// của các trang khác (invitation-setup, admin, public/themes... vẫn dùng CDN).
module.exports = {
  content: [
    "./index.html",
    "./js/**/*.js",
    "./core/config.js",
    "./core/helpers/alert.js",
    "./core/auth-ui.js",
    "./core/payment.js",
  ],
  theme: {
    extend: {
      fontFamily: {
        playfair: ["Playfair Display", "serif"],
        vibes: ["Great Vibes", "cursive"],
        cormorant: ["Cormorant Garamond", "serif"],
        inter: ["Inter", "sans-serif"],
        allura: ["Allura", "cursive"],
      },
      colors: {
        "rose-pastel": {
          50: "#fffbf7",
          100: "#fef1f7",
          200: "#fce7f3",
          300: "#fbcfe8",
        },
        cream: { 50: "#fffbf7", 100: "#fff5f0", 200: "#ffe8e0" },
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
          "0%": { boxShadow: "0 0 0 0 rgba(34,197,94,.55)" },
          "70%": { boxShadow: "0 0 0 7px rgba(34,197,94,0)" },
          "100%": { boxShadow: "0 0 0 0 rgba(34,197,94,0)" },
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
            boxShadow: "0 8px 26px rgba(219,39,119,.42)",
          },
          "50%": {
            boxShadow:
              "0 12px 34px rgba(219,39,119,.62), 0 0 22px 2px rgba(244,63,94,.32)",
          },
          "100%": {
            backgroundPosition: "-200% 0",
            boxShadow: "0 8px 26px rgba(219,39,119,.42)",
          },
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
      },
    },
  },
  plugins: [],
};
