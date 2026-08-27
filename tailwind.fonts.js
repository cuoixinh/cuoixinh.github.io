// Bảng font DÙNG CHUNG cho cả hai bản build Tailwind (tailwind.config.js và
// tailwind.themes.config.js) → mọi trang viết được `font-<tên-font>`,
// vd: font-merriweather, font-perfect-beloved, font-great-vibes.
//
// Tên khoá = tên họ font viết thường, nối bằng gạch ngang.
// Thêm font mới thì thêm ở ĐÂY (và @font-face ở styles/_fonts.css nếu tự host).
//
// Hai nhóm, khác nhau ở chỗ file font đến từ đâu:
//   · Tự host  — @font-face khai ở styles/_fonts.css, có sẵn ở mọi trang.
//   · Google   — trang phải tự khai <link> Google Fonts của font đó (hoặc khách
//     chọn font ấy ở tab Giao diện); chỉ viết class thôi thì chữ vẫn rơi về
//     font dự phòng.

module.exports = {
  // ── Tự host (styles/_fonts.css) ──────────────────────────────────────────
  "katty-diona": ["KattyDiona", "cursive"],
  "the-nautigal": ["TheNautigal", "cursive"],
  "perfect-beloved": ["PerfectBeloved", "cursive"],
  "faugllin-balseyn": ["FaugllinBalseyn", "cursive"],
  "bethan-white": ["BethanWhite", "cursive"],
  "gilla-stone": ["GillaStone", "cursive"],
  "the-hamstter": ["TheHamstter", "cursive"],
  "octet-stream": ["OctetStream", "sans-serif"],
  "moon-light": ["MoonLight", "serif"],
  "belinda-avenue": ["BelindaAvenue", "serif"],
  mallong: ["Mallong", "serif"],
  signora: ["Signora", "serif"],
  "soul-note-display": ["SoulNoteDisplay", "serif"],
  "madam-ghea": ["MadamGhea", "serif"],
  "fz-qellia": ["FzQellia", "serif"],

  // ── Google Fonts: serif / display cho tiêu đề ────────────────────────────
  "playfair-display": ["Playfair Display", "serif"],
  "cormorant-garamond": ["Cormorant Garamond", "serif"],
  "cormorant-sc": ["Cormorant SC", "serif"],
  prata: ["Prata", "serif"],
  merriweather: ["Merriweather", "serif"],
  "eb-garamond": ["EB Garamond", "serif"],
  "yeseva-one": ["Yeseva One", "serif"],
  cinzel: ["Cinzel", "serif"],
  "cinzel-decorative": ["Cinzel Decorative", "cursive"],

  // ── Google Fonts: chữ viết tay / thư pháp ────────────────────────────────
  "dancing-script": ["Dancing Script", "cursive"],
  "great-vibes": ["Great Vibes", "cursive"],
  pacifico: ["Pacifico", "cursive"],
  lobster: ["Lobster", "cursive"],
  allura: ["Allura", "cursive"],
  "alex-brush": ["Alex Brush", "cursive"],
  "pinyon-script": ["Pinyon Script", "cursive"],
  "style-script": ["Style Script", "cursive"],
  birthstone: ["Birthstone", "cursive"],
  "fleur-de-leah": ["Fleur De Leah", "cursive"],

  // ── Google Fonts: dùng được cả tiêu đề lẫn nội dung ──────────────────────
  lora: ["Lora", "serif"],
  vollkorn: ["Vollkorn", "serif"],
  "noto-serif": ["Noto Serif", "serif"],

  // ── Google Fonts: sans cho nội dung ──────────────────────────────────────
  inter: ["Inter", "sans-serif"],
  "be-vietnam-pro": ["Be Vietnam Pro", "sans-serif"],
  montserrat: ["Montserrat", "sans-serif"],
  nunito: ["Nunito", "sans-serif"],
  "nunito-sans": ["Nunito Sans", "sans-serif"],
  quicksand: ["Quicksand", "sans-serif"],
  "josefin-sans": ["Josefin Sans", "sans-serif"],
  roboto: ["Roboto", "sans-serif"],
  "open-sans": ["Open Sans", "sans-serif"],
  "source-sans-3": ["Source Sans 3", "sans-serif"],
  mulish: ["Mulish", "sans-serif"],
  "work-sans": ["Work Sans", "sans-serif"],
  manrope: ["Manrope", "sans-serif"],
  lexend: ["Lexend", "sans-serif"],

  // ── Bí danh ngắn có từ trước, giữ lại cho markup cũ ──────────────────────
  playfair: ["Playfair Display", "serif"],
  cormorant: ["Cormorant Garamond", "serif"],
  vibes: ["Great Vibes", "cursive"],
  nautigal: ["TheNautigal", "cursive"],
  katty: ["KattyDiona", "cursive"],
  octet: ["OctetStream", "sans-serif"],
  "cinzel-deco": ["Cinzel Decorative", "cursive"],
};
