// Phụ đề nền trắng: mỗi dòng một ô trắng bo góc, chữ đen đậm — kiểu chữ có nền của TikTok.
window.CX_POSTER_TEMPLATES.push({
  id: "phu-de-trang",
  name: "Phụ đề nền trắng",
  desc: "Ô trắng bo góc, chữ đen",
  fonts: ["600 40px 'Be Vietnam Pro'"],
  style: { color: "#141414", bg: "#ffffff", alpha: 1, size: 1 },
  controls: ["color", "bg", "alpha", "size"],
  draw: (ctx, c) =>
    CXPosterKit.boxes(ctx, c, {
      family: "'Be Vietnam Pro'", weight: 600, fs: 36, lh: 1.5, padY: 8, padX: 20, r: 16,
      bg: CXPosterKit.rgba(c.style.bg, c.style.alpha), color: c.style.color,
    }),
});
