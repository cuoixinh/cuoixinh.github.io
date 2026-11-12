// Tiêu đề trên dải: cùng chữ in hoa hai màu, đặt trên một dải nền trải hết bề ngang ảnh (màu + độ mờ
// chỉnh được) — chữ nổi rõ trên mọi ảnh, kể cả ảnh nhiều chi tiết.
window.CX_POSTER_TEMPLATES.push({
  id: "tieu-de-dai",
  name: "Tiêu đề trên dải",
  desc: "Chữ in hoa trên dải nền ngang",
  hint: "Xuống dòng để tách: đoạn đầu thành dòng tiêu đề màu nhấn.",
  fonts: ["800 40px Montserrat"],
  style: { accent: "#b5541c", color: "#141414", bg: "#ffffff", alpha: 0.88, size: 1 },
  controls: ["accent", "color", "bg", "alpha", "size"],
  draw: (ctx, c) =>
    CXPosterKit.title(ctx, c, {
      family: "Montserrat", weight: 800, fsA: 96, fs: 60, lh: 1.18, gap: 6, padY: 36,
      accent: c.style.accent, color: c.style.color, band: CXPosterKit.rgba(c.style.bg, c.style.alpha),
    }),
});
