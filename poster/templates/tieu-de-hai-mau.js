// Tiêu đề hai màu: chữ in hoa thật đậm, dòng đầu màu nhấn (cam đất) to hơn, phần sau màu đậm, trên
// một ô nền bo góc ôm vừa khối chữ (màu + độ mờ chỉnh được). Hợp ảnh đầu loạt (ảnh bìa bài đăng).
window.CX_POSTER_TEMPLATES.push({
  id: "tieu-de-hai-mau",
  name: "Tiêu đề hai màu",
  desc: "Chữ in hoa trên ô nền bo góc",
  hint: "Xuống dòng để tách: đoạn đầu thành dòng tiêu đề màu nhấn.",
  fonts: ["800 40px Montserrat"],
  style: { accent: "#b5541c", color: "#141414", bg: "#ffffff", alpha: 0.9, size: 1 },
  controls: ["accent", "color", "bg", "alpha", "size"],
  draw: (ctx, c) =>
    CXPosterKit.title(ctx, c, {
      family: "Montserrat", weight: 800, fsA: 92, fs: 58, lh: 1.16, gap: 6, padX: 44, padY: 32, r: 32, maxW: 0.82,
      accent: c.style.accent, color: c.style.color, box: CXPosterKit.rgba(c.style.bg, c.style.alpha),
    }),
});
