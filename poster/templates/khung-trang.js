// Khung trắng: nền giấy, ảnh phía trên chừa lề đều ba cạnh, lời chữ có chân nằm ngoài ảnh ở phần
// giấy bên dưới (mặc định căn trái). Khối chữ cao theo lời, kéo xuống sát lề dưới; ảnh giãn lấp phần còn lại
// nên không thừa giấy trống. Lời quá dài thì chữ nhỏ dần để ảnh còn ít nhất PH_MIN chiều cao khung.
// "Nền" ở đây là màu giấy (không có độ mờ — giấy đặc).
window.CX_POSTER_TEMPLATES.push({
  id: "khung-trang",
  name: "Khung trắng",
  desc: "Ảnh viền giấy, lời bên dưới",
  full: true,
  fixedY: true,
  fonts: ["400 40px Fraunces"],
  style: { color: "#2E1A1E", bg: "#FCF8F5", alpha: 1, size: 1, align: "left" },
  controls: ["color", "bg", "size"],
  draw(ctx, c) {
    const K = CXPosterKit;
    const { W, H, u } = c;
    const PH_MIN = 0.42;
    const o = { family: "Fraunces", weight: 400 };
    const m = 56 * u;
    const gap = 44 * u;
    const tw = W - m * 2;
    const maxH = H - m * 2 - gap - H * PH_MIN;
    let fs = 52 * u * c.size;
    const min = 22 * u;
    let lines = [];
    let lh = 0;
    for (;;) {
      ctx.font = K.font(o, fs);
      lines = c.text ? K.wrap(ctx, c.text, tw) : [];
      lh = fs * 1.26;
      if (lines.length * lh <= maxH || fs <= min) break;
      fs = Math.max(min, fs * 0.92);
    }
    // Chưa có lời: chừa một dòng để còn bấm vào gõ.
    const th = Math.max(1, lines.length) * lh;
    const ty = H - m - th;
    ctx.fillStyle = c.style.bg;
    ctx.fillRect(0, 0, W, H);
    c.photo(m, m, tw, ty - gap - m);
    ctx.save();
    const al = K.alignOf(c, {});
    const tx = al === "left" ? m : al === "right" ? m + tw : m + tw / 2;
    ctx.textAlign = al;
    ctx.textBaseline = "middle";
    ctx.fillStyle = c.style.color;
    lines.forEach((s, i) => ctx.fillText(s, tx, ty + i * lh + lh / 2 + fs * 0.04));
    ctx.restore();
    return { x: m, y: ty, w: tw, h: th };
  },
});
