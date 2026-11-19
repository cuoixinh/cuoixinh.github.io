// Danh mục BỘ MÀU của thiệp (tab Giao diện → "Bộ màu") — NƠI DUY NHẤT khai bộ màu, mọi
// mẫu dùng chung (mẫu không tự khai bộ riêng). Một bộ = cả bảng màu của thiệp: chữ, nền,
// vạch kẻ, màn bìa, hoạ tiết, gradient, và KHỐI TÔ (`fill` + chữ trên nó `on_fill`) đổ
// lên những khối mẫu gắn `.cx-fill` — dải ngày cưới, lịch, chân thiệp… như Thuận Vợ Thuận
// Chồng. `giftBox` (tuỳ chọn) = hộp mừng cưới mặc định khi áp bộ này.
//
// Chỉ là bản khai. Người áp là theme-setting-helper.js: nó đổ giá trị vào các
// token --cx-*-rgb ở :root, mà mọi mẫu trong public/themes/* đều vẽ theo (bảng
// token khai ở styles/_common.css). Danh sách khoá là CX_PALETTE_TOKENS trong
// file đó → nạp file này SAU nó.
//
// File này chỉ trang Thiết lập nạp (và bản xem thử mẫu nạp lúc khách mở mục đổi màu —
// cxPreviewPalettes ở core/utils.js): thiệp lưu nguyên bộ màu đã chọn trong
// theme_setting.palette nên trang thiệp dựng lại được mà không cần danh mục.
// Nhờ vậy thêm/sửa/bỏ một bộ ở đây không làm đổi màu thiệp đã xuất bản, và
// trang thiệp cũng không phải tải thêm file nào.
//
// LUẬT khi thêm bộ mới — `npm run check:palette-contrast` kiểm tự động:
//   1. TONE SÁNG. Nền thiệp (card_bg, page_bg, surface, panel) phải sáng; đây
//      là thiệp cưới, không làm bộ nền tối.
//   2. Đủ tương phản: heading/card_bg ≥ 7:1 · body/card_bg ≥ 4.5:1 ·
//      accent/card_bg ≥ 3:1 · on_accent/accent ≥ 4.5:1 · on_image/scrim ≥ 4.5:1 ·
//      on_fill/fill ≥ 4.5:1 (khối đậm chữ trắng, hoặc khối pastel chữ sẫm).
//   3. `scrim` phải TỐI và `on_image` phải SÁNG — đó là lớp giữ cho chữ đọc
//      được khi nằm trên ảnh cưới, ảnh nào cũng khác nhau.
//   4. `id` được lưu xuống DB → ĐỪNG đổi id của bộ đã phát hành.

const CX_PALETTES = [
  {
    id: "do-ruou",
    name: "Đỏ rượu",
    tone: "ấm",
    heading: "#3e1f24", body: "#6e5256", accent: "#7b1e2f", accent_soft: "#e8c4c8",
    on_accent: "#ffffff", on_image: "#ffffff", on_lightbox: "#ffffff",
    card_bg: "#fbf7f5", page_bg: "#f3ece9", surface: "#f5efec", band: "#f7eeec",
    panel: "#ffffff", panel_warm: "#fdf9f6",
    cover: "#f8f3f1", cover_mid: "#efe5e2", cover_veil: "#efe5e2", lightbox_bg: "#000000",
    line: "#e6d6d4", shadow: "#3e1f24", scrim: "#000000",
    deco: "#9b3a4b", deco_soft: "#ecd2d6", deco_2: "#7b1e2f", deco_2_soft: "#e8c4c8",
    shine_from: "#7b1e2f", shine_mid: "#e8c4c8", shine_to: "#f6e8e9",
    fill: "#7b1e2f", on_fill: "#ffffff",
    giftBox: "phongbi_do_hy",
  },
  // Hồng pastel = #ffe0e5 (rgb 255 224 229): khối tô + mọi mảng hồng nhạt. Chữ nhấn/nút cần
  // đọc được trên nền sáng nên là hồng tro cùng tông, không phải hồng rực.
  {
    id: "hong-pastel",
    name: "Hồng pastel",
    tone: "ấm",
    heading: "#3e1f24", body: "#6e5256", accent: "#985a67", accent_soft: "#ffe0e5",
    on_accent: "#ffffff", on_image: "#ffffff", on_lightbox: "#ffffff",
    card_bg: "#fbf7f5", page_bg: "#f3ece9", surface: "#f5efec", band: "#f7eeec",
    panel: "#ffffff", panel_warm: "#fdf9f6",
    cover: "#f8f3f1", cover_mid: "#efe5e2", cover_veil: "#efe5e2", lightbox_bg: "#000000",
    line: "#e6d6d4", shadow: "#3e1f24", scrim: "#000000",
    deco: "#985a67", deco_soft: "#ffe0e5", deco_2: "#8a6a70", deco_2_soft: "#ffe0e5",
    shine_from: "#985a67", shine_mid: "#ffe0e5", shine_to: "#fff0f2",
    fill: "#ffe0e5", on_fill: "#3e1f24",
    giftBox: "phongbi_hong_no",
  },
  {
    id: "hong-phan",
    name: "Hồng phấn",
    tone: "ấm",
    heading: "#29191c", body: "#655054", accent: "#bd5167", accent_soft: "#f2b0bd",
    on_accent: "#ffffff", on_image: "#ffffff", on_lightbox: "#ffffff",
    card_bg: "#ffffff", page_bg: "#fcedf0", surface: "#fcedf0", band: "#f7cfd7",
    panel: "#ffffff", panel_warm: "#fdfbfc",
    cover: "#ffffff", cover_mid: "#f7cfd7", cover_veil: "#f7cfd7", lightbox_bg: "#000000",
    line: "#f1c6ce", shadow: "#29191c", scrim: "#181012",
    deco: "#bd5167", deco_soft: "#f2b0bd", deco_2: "#bd5167", deco_2_soft: "#f2b0bd",
    shine_from: "#ffffff", shine_mid: "#f8d3da", shine_to: "#ee96a7",
    fill: "#bd5167", on_fill: "#ffffff",
    giftBox: "lixi_hong_mai",
  },
  {
    id: "do-son",
    name: "Đỏ son",
    tone: "ấm",
    heading: "#29191b", body: "#6f585b", accent: "#d13d51", accent_soft: "#eeb5bc",
    on_accent: "#ffffff", on_image: "#ffffff", on_lightbox: "#ffffff",
    card_bg: "#ffffff", page_bg: "#fdeef0", surface: "#fdeef0", band: "#fae1e4",
    panel: "#ffffff", panel_warm: "#fdfbfc",
    cover: "#ffffff", cover_mid: "#fae1e4", cover_veil: "#fae1e4", lightbox_bg: "#000000",
    line: "#f1c6cc", shadow: "#29191b", scrim: "#181011",
    deco: "#d13d51", deco_soft: "#eeb5bc", deco_2: "#d13d51", deco_2_soft: "#eeb5bc",
    shine_from: "#ffffff", shine_mid: "#f5d6da", shine_to: "#e89ca6",
    fill: "#d13d51", on_fill: "#ffffff",
    giftBox: "lixi_do_hy",
  },
  {
    id: "xanh-duong",
    name: "Xanh dương",
    tone: "lạnh",
    heading: "#192129", body: "#56616e", accent: "#4377b1", accent_soft: "#bcd0e6",
    on_accent: "#ffffff", on_image: "#ffffff", on_lightbox: "#ffffff",
    card_bg: "#ffffff", page_bg: "#eef3fa", surface: "#eef3fa", band: "#e3ecf7",
    panel: "#ffffff", panel_warm: "#fbfcfd",
    cover: "#ffffff", cover_mid: "#e3ecf7", cover_veil: "#e3ecf7", lightbox_bg: "#000000",
    line: "#c9daed", shadow: "#192129", scrim: "#101418",
    deco: "#4377b1", deco_soft: "#bcd0e6", deco_2: "#4377b1", deco_2_soft: "#bcd0e6",
    shine_from: "#ffffff", shine_mid: "#dae5f1", shine_to: "#a6c0dd",
    fill: "#4377b1", on_fill: "#ffffff",
    giftBox: "hop_navy_vang",
  },
  {
    id: "blush-white",
    name: "Trắng hồng",
    tone: "ấm",
    heading: "#4a3229", body: "#7a6057", accent: "#9d686c", accent_soft: "#e6bcbe",
    on_accent: "#ffffff", on_image: "#fffaf9", on_lightbox: "#ffffff",
    card_bg: "#fffcfb", page_bg: "#fdf3f1", surface: "#fdf3f1", band: "#fbeae8",
    panel: "#ffffff", panel_warm: "#fffcfa",
    cover: "#fdf3f1", cover_mid: "#f8e2df", cover_veil: "#f8e2df", lightbox_bg: "#1b1214",
    line: "#f2dcd9", shadow: "#4a3229", scrim: "#2b1a1c",
    deco: "#c07f84", deco_soft: "#eccfd0", deco_2: "#c9928c", deco_2_soft: "#f0dbd7",
    shine_from: "#ffffff", shine_mid: "#fbe9e6", shine_to: "#e3c3bf",
    fill: "#9d686c", on_fill: "#ffffff",
    giftBox: "floral_pink",
  },
  {
    id: "champagne-cream",
    name: "Kem champagne",
    tone: "ấm",
    heading: "#3a322a", body: "#6f6559", accent: "#986f35", accent_soft: "#d9bd8a",
    on_accent: "#ffffff", on_image: "#fffdf8", on_lightbox: "#ffffff",
    card_bg: "#fffdf9", page_bg: "#faf5ec", surface: "#faf5ec", band: "#f5ecdd",
    panel: "#ffffff", panel_warm: "#fffcf4",
    cover: "#faf5ec", cover_mid: "#f0e4cf", cover_veil: "#f0e4cf", lightbox_bg: "#171410",
    line: "#e8dcc5", shadow: "#3a322a", scrim: "#241d14",
    deco: "#a5793a", deco_soft: "#e2cda2", deco_2: "#b98f52", deco_2_soft: "#ecdcbb",
    shine_from: "#a5793a", shine_mid: "#eed6a4", shine_to: "#c69b56",
    fill: "#986f35", on_fill: "#ffffff",
    giftBox: "mungcuoi_ivory",
  },
  {
    id: "peach-sun",
    name: "Đào nắng",
    tone: "ấm",
    heading: "#4d2f24", body: "#836053", accent: "#b1603f", accent_soft: "#eab79c",
    on_accent: "#ffffff", on_image: "#fffaf6", on_lightbox: "#ffffff",
    card_bg: "#fffbf7", page_bg: "#fdf1e8", surface: "#fdf1e8", band: "#fbe6d8",
    panel: "#ffffff", panel_warm: "#fffaf3",
    cover: "#fdf1e8", cover_mid: "#f7ddca", cover_veil: "#f7ddca", lightbox_bg: "#1d130e",
    line: "#f2ddcc", shadow: "#4d2f24", scrim: "#2e1b13",
    deco: "#c26a45", deco_soft: "#f0cbb4", deco_2: "#cf8259", deco_2_soft: "#f5dcc9",
    shine_from: "#ffffff", shine_mid: "#fbe5d3", shine_to: "#e0b494",
    fill: "#b1603f", on_fill: "#ffffff",
    giftBox: "phongbi_kraft",
  },
  {
    id: "latte",
    name: "Nâu sữa",
    tone: "ấm",
    heading: "#3f312a", body: "#786358", accent: "#9a6b4b", accent_soft: "#cfae94",
    on_accent: "#ffffff", on_image: "#fffcf8", on_lightbox: "#ffffff",
    card_bg: "#fffcf8", page_bg: "#f7efe6", surface: "#f7efe6", band: "#f1e5d8",
    panel: "#ffffff", panel_warm: "#fffbf5",
    cover: "#f7efe6", cover_mid: "#ebdccb", cover_veil: "#ebdccb", lightbox_bg: "#1a1512",
    line: "#e6d6c5", shadow: "#3f312a", scrim: "#281e18",
    deco: "#9a6b4b", deco_soft: "#dcc3ac", deco_2: "#ab7f5f", deco_2_soft: "#e6d2be",
    shine_from: "#ffffff", shine_mid: "#f4e6d5", shine_to: "#d3b89e",
    fill: "#9a6b4b", on_fill: "#ffffff",
    giftBox: "minimalism_brown",
  },
  {
    id: "cool-grey",
    name: "Xám lạnh",
    tone: "lạnh",
    heading: "#2c333b", body: "#5f6b76", accent: "#4d6b85", accent_soft: "#a8bccc",
    on_accent: "#ffffff", on_image: "#fbfdff", on_lightbox: "#ffffff",
    card_bg: "#fdfefe", page_bg: "#f1f4f7", surface: "#f1f4f7", band: "#e8edf2",
    panel: "#ffffff", panel_warm: "#fdfdfe",
    cover: "#f1f4f7", cover_mid: "#e0e7ee", cover_veil: "#e0e7ee", lightbox_bg: "#0f1317",
    line: "#dbe3ea", shadow: "#2c333b", scrim: "#161c22",
    deco: "#4d6b85", deco_soft: "#bcccd9", deco_2: "#63809a", deco_2_soft: "#cfdbe4",
    shine_from: "#ffffff", shine_mid: "#e9eff4", shine_to: "#b9c8d5",
    fill: "#4d6b85", on_fill: "#ffffff",
    giftBox: "hop_navy_vang",
  },
  {
    id: "seafoam",
    name: "Xanh biển nhạt",
    tone: "lạnh",
    heading: "#1f3a3d", body: "#546d70", accent: "#3d7a80", accent_soft: "#9cc4c6",
    on_accent: "#ffffff", on_image: "#f9fdfd", on_lightbox: "#ffffff",
    card_bg: "#fbfefe", page_bg: "#eef6f6", surface: "#eef6f6", band: "#e3f0f0",
    panel: "#ffffff", panel_warm: "#fbfdfd",
    cover: "#eef6f6", cover_mid: "#daebeb", cover_veil: "#daebeb", lightbox_bg: "#0c1618",
    line: "#d4e6e6", shadow: "#1f3a3d", scrim: "#122123",
    deco: "#3d7a80", deco_soft: "#b3d5d7", deco_2: "#579196", deco_2_soft: "#c8e1e2",
    shine_from: "#ffffff", shine_mid: "#e6f2f2", shine_to: "#aacfd1",
    fill: "#3d7a80", on_fill: "#ffffff",
    giftBox: "phongbi_trang_vang",
  },
  {
    id: "mint",
    name: "Bạc hà",
    tone: "lạnh",
    heading: "#223b2e", body: "#566d60", accent: "#3f7d5c", accent_soft: "#a2c9b3",
    on_accent: "#ffffff", on_image: "#f9fdfa", on_lightbox: "#ffffff",
    card_bg: "#fbfefc", page_bg: "#eff7f2", surface: "#eff7f2", band: "#e4f1e9",
    panel: "#ffffff", panel_warm: "#fbfdfc",
    cover: "#eff7f2", cover_mid: "#dcebe3", cover_veil: "#dcebe3", lightbox_bg: "#0d1712",
    line: "#d7e9de", shadow: "#223b2e", scrim: "#13231b",
    deco: "#3f7d5c", deco_soft: "#b6d8c4", deco_2: "#5a9375", deco_2_soft: "#cbe4d6",
    shine_from: "#ffffff", shine_mid: "#e8f4ed", shine_to: "#aed3bf",
    fill: "#3f7d5c", on_fill: "#ffffff",
    giftBox: "phongbi_xanh_la",
  },
  {
    id: "sage",
    name: "Sage nhạt",
    tone: "trung tính",
    heading: "#33392f", body: "#676e5f", accent: "#6e7a56", accent_soft: "#c0c9ab",
    on_accent: "#ffffff", on_image: "#fcfdfa", on_lightbox: "#ffffff",
    card_bg: "#fdfdfa", page_bg: "#f4f5ef", surface: "#f4f5ef", band: "#eceee4",
    panel: "#ffffff", panel_warm: "#fdfdfb",
    cover: "#f4f5ef", cover_mid: "#e5e8da", cover_veil: "#e5e8da", lightbox_bg: "#14160f",
    line: "#e0e4d5", shadow: "#33392f", scrim: "#1d2019",
    deco: "#7d8b62", deco_soft: "#cdd4bb", deco_2: "#8e9b76", deco_2_soft: "#dde1cf",
    shine_from: "#ffffff", shine_mid: "#eff1e7", shine_to: "#c7cfb2",
    fill: "#6e7a56", on_fill: "#ffffff",
    giftBox: "phongbi_xanh_la",
  },
  {
    id: "lavender",
    name: "Oải hương",
    tone: "trung tính",
    heading: "#3a3346", body: "#6b6379", accent: "#7a68a3", accent_soft: "#c2b6d9",
    on_accent: "#ffffff", on_image: "#fdfbff", on_lightbox: "#ffffff",
    card_bg: "#fdfcff", page_bg: "#f4f1fa", surface: "#f4f1fa", band: "#ebe6f4",
    panel: "#ffffff", panel_warm: "#fdfcfe",
    cover: "#f4f1fa", cover_mid: "#e5dff1", cover_veil: "#e5dff1", lightbox_bg: "#141019",
    line: "#e2dcef", shadow: "#3a3346", scrim: "#201a2a",
    deco: "#7a68a3", deco_soft: "#cec5e2", deco_2: "#8d7db1", deco_2_soft: "#ded7ec",
    shine_from: "#ffffff", shine_mid: "#efeaf8", shine_to: "#c6bcdd",
    fill: "#7a68a3", on_fill: "#ffffff",
    giftBox: "phongbi_trang_vang",
  },
  {
    id: "pearl",
    name: "Ngọc trai",
    tone: "trung tính",
    heading: "#38332f", body: "#6e6761", accent: "#86735a", accent_soft: "#cfc0ab",
    on_accent: "#ffffff", on_image: "#fdfcfb", on_lightbox: "#ffffff",
    card_bg: "#fdfcfa", page_bg: "#f4f1ec", surface: "#f4f1ec", band: "#ece7e0",
    panel: "#ffffff", panel_warm: "#fdfcfa",
    cover: "#f4f1ec", cover_mid: "#e5dfd5", cover_veil: "#e5dfd5", lightbox_bg: "#16140f",
    line: "#e2dbd0", shadow: "#38332f", scrim: "#211d18",
    deco: "#9a8468", deco_soft: "#d8ccba", deco_2: "#a9957c", deco_2_soft: "#e4dacb",
    shine_from: "#ffffff", shine_mid: "#f0ebe2", shine_to: "#cdc0ad",
    fill: "#86735a", on_fill: "#ffffff",
    giftBox: "phongbi_kem_sap",
  },
];

function cxPaletteById(id) {
  return CX_PALETTES.find((p) => p.id === id) || null;
}

// Bộ màu đem lưu: id + tên + đúng những khoá mà runtime biết áp. Không bê theo
// `tone` (chỉ để xếp nhóm trong dropdown) hay thứ gì khác trong danh mục.
function cxPaletteValue(id) {
  const p = cxPaletteById(id);
  if (!p) return null;
  const out = { id: p.id, name: p.name };
  (window.CX_PALETTE_KEYS || []).forEach((k) => {
    if (p[k]) out[k] = p[k];
  });
  if (p.giftBox) out.giftBox = p.giftBox;
  return out;
}

// Màu của giọt màu trên dropdown. Lấy `band` — dải nền xen kẽ là mảng nền ĂN
// MÀU rõ nhất của bộ (card_bg gần như trắng ở mọi bộ nên không phân biệt nổi).
// Một màu thôi: giọt màu chỉ để nhận ra TÔNG, còn xem thật thì đã có khung xem
// trước ngay bên cạnh.
function cxPaletteSwatch(p) {
  return (p && (p.band || p.surface || p.card_bg)) || "";
}

if (typeof window !== "undefined") {
  window.CX_PALETTES = CX_PALETTES;
  window.cxPaletteById = cxPaletteById;
  window.cxPaletteValue = cxPaletteValue;
  window.cxPaletteSwatch = cxPaletteSwatch;
}
