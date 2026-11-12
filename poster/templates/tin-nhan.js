// Tin nhắn: ảnh tràn khung, lời là bong bóng chat bo tròn (không đuôi) — ảnh lẻ bong bóng bên trái,
// ảnh chẵn bên phải nên cả loạt đọc như một cuộc trò chuyện. Kéo được; mặc định bên phải dừng trước
// cột nút của TikTok.
window.CX_POSTER_TEMPLATES.push({
  id: "tin-nhan",
  name: "Tin nhắn",
  desc: "Bong bóng chat qua lại",
  full: true,
  fonts: ["500 40px 'Be Vietnam Pro'"],
  style: { color: "#2E1A1E", bg: "#ffffff", alpha: 0.96, size: 1, align: "left" },
  controls: ["color", "bg", "alpha", "size"],
  draw(ctx, c) {
    const K = CXPosterKit;
    const { W, H, u } = c;
    const S = K.safe(c);
    c.photo(0, 0, W, H);
    if (!c.text) return null;
    const k = u * c.size;
    const o = { family: "'Be Vietnam Pro'", weight: 500 };
    const fs = 36 * k;
    ctx.font = K.font(o, fs);
    const padX = 30 * k;
    const padY = 22 * k;
    const lines = K.wrap(ctx, c.text, W * 0.9 - padX * 2);
    const lh = fs * 1.4;
    const bw = Math.max(...lines.map((s) => ctx.measureText(s).width)) + padX * 2;
    const bh = lines.length * lh + padY * 2;
    const def = c.i % 2 === 1 ? W * (1 - S.right) - bw / 2 : 56 * u + bw / 2;
    const cx = K.clampX(c, bw, def);
    const x = cx - bw / 2;
    const y = K.clampY(c, bh);
    const r = 34 * k;
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.22)";
    ctx.shadowBlur = 24 * u;
    ctx.shadowOffsetY = 6 * u;
    ctx.fillStyle = K.rgba(c.style.bg, c.style.alpha);
    K.rr(ctx, x, y, bw, bh, r);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = c.style.color;
    const al = K.alignOf(c, {});
    ctx.textAlign = al;
    ctx.textBaseline = "middle";
    ctx.font = K.font(o, fs);
    const tx = al === "left" ? x + padX : al === "right" ? x + bw - padX : x + bw / 2;
    lines.forEach((s, n) => ctx.fillText(s, tx, y + padY + n * lh + lh / 2 + fs * 0.04));
    return { x, y, w: bw, h: bh };
  },
});
