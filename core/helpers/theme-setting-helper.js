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
  { name: "Be Vietnam Pro", type: "body" },
  { name: "Montserrat", type: "body" },
  { name: "Nunito", type: "body" },
  { name: "Quicksand", type: "body" },
  { name: "Josefin Sans", type: "body" },
];

// Màu gợi ý cho picker
const THEME_HEADING_COLORS = ["#2d2d2d", "#4a3f35", "#3b4a3f", "#5c4033", "#1f2937", "#7a4b52"];
const THEME_ACCENT_COLORS = ["#c0a062", "#b98a3c", "#7fa38a", "#d4a5a5", "#a8763e", "#9caf88"];

// Các class font/màu mà theme đang dùng → ghi đè khi có theme_setting.
const HEADING_FONT_SELECTORS = ".font-cormorant, .font-playfair, .font-cinzel, .font-prata";
const BODY_FONT_SELECTORS = "body, .font-inter";
const HEADING_COLOR_SELECTORS =
  ".text-charcoal, .text-stone-custom-500, .text-stone-custom-400";
const ACCENT_COLOR_SELECTORS =
  ".text-gold-400, .text-gold-300, .text-sage-400, .text-sage-300";

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
 * @param {Object|string} setting - { heading_font, body_font, heading_color, accent_color }
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

  if (setting.accent_color) {
    rules.push(`${ACCENT_COLOR_SELECTORS} { color: ${setting.accent_color} !important; }`);
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
  window.THEME_HEADING_COLORS = THEME_HEADING_COLORS;
  window.THEME_ACCENT_COLORS = THEME_ACCENT_COLORS;
  window.applyThemeSetting = applyThemeSetting;
}
