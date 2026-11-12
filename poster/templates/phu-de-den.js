// Phụ đề nền đen mờ: ô đen trong suốt một phần, chữ trắng — đọc rõ trên ảnh sáng.
window.CX_POSTER_TEMPLATES.push({
  id: "phu-de-den",
  name: "Phụ đề nền đen",
  desc: "Ô đen mờ, chữ trắng",
  fonts: ["600 40px 'Be Vietnam Pro'"],
  style: { color: "#ffffff", bg: "#0c0c0c", alpha: 0.72, size: 1 },
  controls: ["color", "bg", "alpha", "size"],
  draw: (ctx, c) =>
    CXPosterKit.boxes(ctx, c, {
      family: "'Be Vietnam Pro'", weight: 600, fs: 36, lh: 1.5, padY: 8, padX: 20, r: 16,
      bg: CXPosterKit.rgba(c.style.bg, c.style.alpha), color: c.style.color,
    }),
});
