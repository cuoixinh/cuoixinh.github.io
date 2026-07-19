// ============================================================
// THEME-SETTING-HELPER.JS
// Áp dụng tuỳ chỉnh font + màu chữ (theme_setting) lên thiệp.
// Dùng chung cho: trang thiệp public, chế độ xem trước, trình soạn thiệp.
// ============================================================

// Danh sách font (Google Fonts) — đều hỗ trợ tiếng Việt.
// type: 'heading' (serif/display cho tiêu đề) | 'body' (sans cho nội dung) | 'both'
const THEME_FONTS = [
  { name: "Playfair Display", type: "heading" },
  { name: "Cormorant Garamond", type: "heading" },
  { name: "Lora", type: "both" },
  { name: "Prata", type: "heading" },
  { name: "Dancing Script", type: "heading" },
  { name: "Inter", type: "body" },
  { name: "Be Vietnam Pro", type: "body" },
  { name: "Montserrat", type: "body" },
  { name: "Nunito", type: "body" },
  { name: "Quicksand", type: "body" },
  { name: "Josefin Sans", type: "body" },
];

// Font + màu GỐC của từng theme (đúng như thiết kế ban đầu).
// Dùng làm giá trị mặc định hiển thị trên thanh chỉnh và điểm khôi phục.
// Theme chưa khai báo ở đây sẽ rơi về bộ mặc định chung của trình soạn thiệp.
const THEME_PRESETS = {
  "basic-gold": {
    heading_font: "Playfair Display", // .font-playfair
    body_font: "Inter", // .font-inter
    heading_color: "#6b6562", // stone-custom-500
    body_color: "#78716c", // stone-custom-400
    accent_color: "#d4a5a5", // rose-pastel-300
    background_color: "#fffbf7", // #main-card
    // Màu gợi ý trong bảng chọn — lấy từ chính palette của theme
    // (tailwind.config.js: stone-custom, rose-pastel, cream)
    swatches: [
      "#6b6562", // stone-custom-500
      "#78716c", // stone-custom-400
      "#44403c", // stone-custom-600
      "#2d2d2d",
      "#d4a5a5", // rose-pastel-300
      "#e8b4b8", // rose-pastel-200
      "#f5d5d8", // rose-pastel-100
      "#fef0f2", // rose-pastel-50
      "#fffbf7", // cream-50
      "#fff5f0", // cream-100
      "#ffe8e0", // cream-200
      "#ffffff",
    ],
  },
};

// Màu gợi ý cho picker
const THEME_HEADING_COLORS = ["#2d2d2d", "#4a3f35", "#3b4a3f", "#5c4033", "#1f2937", "#7a4b52"];
const THEME_BODY_COLORS = ["#78716c", "#57534e", "#6b6562", "#4a4a4a", "#5a5148", "#44403c"];
const THEME_ACCENT_COLORS = ["#c0a062", "#b98a3c", "#7fa38a", "#d4a5a5", "#a8763e", "#9caf88"];

// Các class font/màu mà theme đang dùng → ghi đè khi có theme_setting.
const HEADING_FONT_SELECTORS = ".font-cormorant, .font-playfair, .font-cinzel, .font-prata";
const BODY_FONT_SELECTORS = "body, .font-inter";
// Tiêu đề = chữ lớn đậm; Nội dung = chữ đọc thường; Nhấn = icon/hoa văn/viền trang trí.
const HEADING_COLOR_SELECTORS =
  ".text-charcoal, .text-stone-custom-500";
const BODY_COLOR_SELECTORS =
  ".text-stone-custom-400";
const ACCENT_COLOR_SELECTORS =
  ".text-gold-400, .text-gold-300, .text-sage-400, .text-sage-300, .text-rose-pastel-300, .text-rose-pastel-200";
// Nền thiệp: body (khung ngoài) + thẻ chính của thiệp.
const BACKGROUND_COLOR_SELECTORS = "body, #main-card";

let _loadedFonts = new Set();

// Nạp 1 Google Font (nếu chưa nạp)
function _loadGoogleFont(fontName) {
  if (!fontName || _loadedFonts.has(fontName)) return;
  _loadedFonts.add(fontName);
  const family = fontName.trim().replace(/\s+/g, "+");
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${family}:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&display=swap`;
  document.head.appendChild(link);
}

/**
 * Áp dụng theme_setting lên trang hiện tại.
 * @param {Object|string} setting - { heading_font, body_font, heading_color, body_color, accent_color, background_color }
 */
function applyThemeSetting(setting) {
  if (typeof setting === "string") {
    try {
      setting = JSON.parse(setting);
    } catch (e) {
      setting = null;
    }
  }
  if (!setting || typeof setting !== "object") return;

  const rules = [];

  if (setting.heading_font) {
    _loadGoogleFont(setting.heading_font);
    rules.push(
      `${HEADING_FONT_SELECTORS} { font-family: '${setting.heading_font}', serif !important; }`,
    );
  }

  if (setting.body_font) {
    _loadGoogleFont(setting.body_font);
    rules.push(
      `${BODY_FONT_SELECTORS} { font-family: '${setting.body_font}', sans-serif !important; }`,
    );
  }

  if (setting.heading_color) {
    rules.push(`${HEADING_COLOR_SELECTORS} { color: ${setting.heading_color} !important; }`);
  }

  if (setting.body_color) {
    rules.push(`${BODY_COLOR_SELECTORS} { color: ${setting.body_color} !important; }`);
  }

  if (setting.accent_color) {
    rules.push(`${ACCENT_COLOR_SELECTORS} { color: ${setting.accent_color} !important; }`);
  }

  if (setting.background_color) {
    rules.push(
      `${BACKGROUND_COLOR_SELECTORS} { background-color: ${setting.background_color} !important; }`,
    );
  }

  let styleEl = document.getElementById("theme-setting-override");
  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = "theme-setting-override";
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = rules.join("\n");
}

// Export ra global (các theme dùng qua <script>, không có module system)
if (typeof window !== "undefined") {
  window.THEME_FONTS = THEME_FONTS;
  window.THEME_PRESETS = THEME_PRESETS;
  window.THEME_HEADING_COLORS = THEME_HEADING_COLORS;
  window.THEME_BODY_COLORS = THEME_BODY_COLORS;
  window.THEME_ACCENT_COLORS = THEME_ACCENT_COLORS;
  window.applyThemeSetting = applyThemeSetting;
}
