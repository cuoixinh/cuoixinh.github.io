// Danh mục BỘ MÀU của thiệp (tab Giao diện → "Bộ màu"). Một bộ = cả bảng màu
// của thiệp, không phải một màu lẻ.
//
// Chỉ là bản khai. Người áp là theme-setting-helper.js: nó đổ giá trị đã chọn
// vào các token --cx-*-rgb ở :root, mà mọi mẫu trong public/themes/* đều vẽ
// theo (bảng token khai ở styles/_common.css) → đổi bộ màu là đổi cả thiệp.
// Danh sách khoá màu nằm ở CX_PALETTE_KEYS trong theme-setting-helper.js (file
// đó trang thiệp cũng nạp) → nạp file này SAU nó.
//
// File này CHỈ trang Thiết lập nạp: thiệp lưu nguyên bộ màu đã chọn trong
// theme_setting.palette nên trang thiệp không cần danh mục để dựng lại. Nhờ vậy
// sửa/bỏ một bộ ở đây cũng không làm đổi màu những thiệp đã xuất bản.
//
// Thêm bộ mới = thêm một phần tử vào CX_PALETTES, đủ 9 khoá của CX_PALETTE_KEYS.
// `id` là thứ được lưu xuống DB nên ĐỪNG đổi id của bộ đã phát hành.

const CX_PALETTES = [
  {
    id: "sage-gold",
    name: "Sage & Vàng đồng",
    heading: "#2d3436",
    body: "#8a9a8a",
    accent: "#a89968",
    on_accent: "#ffffff",
    line: "#d1d8d1",
    surface: "#f6f7f6",
    card_bg: "#ffffff",
    cover: "#f6f7f6",
    cover_mid: "#e8ebe8",
  },
  {
    id: "champagne",
    name: "Kem & Champagne",
    heading: "#3a322a",
    body: "#857b6f",
    accent: "#b08d57",
    on_accent: "#ffffff",
    line: "#e0d5c5",
    surface: "#faf6f0",
    card_bg: "#fdfbf7",
    cover: "#faf6f0",
    cover_mid: "#f4eee5",
  },
  {
    id: "blush-espresso",
    name: "Hồng phấn & Espresso",
    heading: "#4a3229",
    body: "#8a6f64",
    accent: "#c98a8e",
    on_accent: "#ffffff",
    line: "#f0d5d3",
    surface: "#faeae7",
    card_bg: "#fdf8f5",
    cover: "#faeae7",
    cover_mid: "#f5dedb",
  },
  {
    id: "pearl-ivory",
    name: "Ngọc trai & Kem hồng",
    heading: "#5f5654",
    body: "#938a88",
    accent: "#c9b48f",
    on_accent: "#ffffff",
    line: "#e9dbd9",
    surface: "#f3ebe9",
    card_bg: "#f9f3f1",
    cover: "#f3ebe9",
    cover_mid: "#ecdedc",
  },
  {
    id: "rose-cream",
    name: "Hồng pastel & Kem",
    heading: "#6b6562",
    body: "#78716c",
    accent: "#d4a5a5",
    on_accent: "#ffffff",
    line: "#f5d5d8",
    surface: "#fffbf7",
    card_bg: "#ffffff",
    cover: "#fffbf7",
    cover_mid: "#f5ebe0",
  },
  {
    id: "forest",
    name: "Xanh rêu & Kem",
    heading: "#24352c",
    body: "#6f7f70",
    accent: "#9caf88",
    on_accent: "#ffffff",
    line: "#d7dfd2",
    surface: "#f4f7f1",
    card_bg: "#fdfdfb",
    cover: "#f4f7f1",
    cover_mid: "#e6ece1",
  },
  {
    id: "emerald-gold",
    name: "Ngọc lục bảo & Vàng",
    heading: "#12352c",
    body: "#5f7b70",
    accent: "#b08d57",
    on_accent: "#ffffff",
    line: "#cfdcd5",
    surface: "#f1f6f3",
    card_bg: "#fcfdfc",
    cover: "#f1f6f3",
    cover_mid: "#e2ece6",
  },
  {
    id: "terracotta",
    name: "Đất nung & Be ấm",
    heading: "#4a352c",
    body: "#927a6c",
    accent: "#c0714f",
    on_accent: "#ffffff",
    line: "#ecd9cc",
    surface: "#faf1ea",
    card_bg: "#fffaf6",
    cover: "#faf1ea",
    cover_mid: "#f2e2d5",
  },
  {
    id: "burgundy",
    name: "Rượu vang & Kem",
    heading: "#3d1f24",
    body: "#8a6a6e",
    accent: "#8c2f39",
    on_accent: "#ffffff",
    line: "#ead6d8",
    surface: "#faf2f2",
    card_bg: "#fffaf9",
    cover: "#faf2f2",
    cover_mid: "#f2e2e3",
  },
  {
    id: "lavender",
    name: "Oải hương & Xám tro",
    heading: "#3f3a4a",
    body: "#837d93",
    accent: "#9b8bbd",
    on_accent: "#ffffff",
    line: "#ded8ea",
    surface: "#f5f2fa",
    card_bg: "#fdfcff",
    cover: "#f5f2fa",
    cover_mid: "#e9e3f3",
  },
  {
    id: "midnight",
    name: "Xanh than & Khói",
    heading: "#1e252e",
    body: "#6a7380",
    accent: "#2a3d58",
    on_accent: "#ffffff",
    line: "#dbdfe6",
    surface: "#f2f4f7",
    card_bg: "#ffffff",
    cover: "#f2f4f7",
    cover_mid: "#e4e8ee",
  },
  {
    id: "mono-ink",
    name: "Mực & Trắng ngà",
    heading: "#1a1a1a",
    body: "#6e6e6e",
    accent: "#8a8a8a",
    on_accent: "#ffffff",
    line: "#dcdcdc",
    surface: "#f5f4f2",
    card_bg: "#ffffff",
    cover: "#f5f4f2",
    cover_mid: "#eae8e4",
  },
];

function cxPaletteById(id) {
  return CX_PALETTES.find((p) => p.id === id) || null;
}

// Bộ màu đem lưu: chỉ id + đúng 9 khoá màu, không bê theo thứ khác trong danh mục.
function cxPaletteValue(id) {
  const p = cxPaletteById(id);
  if (!p) return null;
  const out = { id: p.id, name: p.name };
  (window.CX_PALETTE_KEYS || []).forEach((k) => (out[k] = p[k]));
  return out;
}

// Bốn màu hiện trên chấm gợi ý của dropdown — đủ để nhận ra bộ mà không rối.
function cxPaletteDots(p) {
  return p ? [p.heading, p.accent, p.line, p.surface] : [];
}

if (typeof window !== "undefined") {
  window.CX_PALETTES = CX_PALETTES;
  window.cxPaletteById = cxPaletteById;
  window.cxPaletteValue = cxPaletteValue;
  window.cxPaletteDots = cxPaletteDots;
}
