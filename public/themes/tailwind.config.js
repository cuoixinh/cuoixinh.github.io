tailwind.config = {
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
      },
    },
  },
};
