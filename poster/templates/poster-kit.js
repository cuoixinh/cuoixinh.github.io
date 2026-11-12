// Đồ nghề vẽ của mẫu "Ảnh TikTok" (window.CXPosterKit) + danh mục window.CX_POSTER_TEMPLATES.
// Mẫu khai `style` mặc định {color, bg, accent, alpha, size, align (căn dòng)} + `controls` (dòng hiện trong thẻ "Chữ":
// "accent" · "color" · "bg" · "alpha" · "size"), tuỳ chọn `hint` (câu nhắc cách gõ, hiện ở placeholder
// của ô lời); trang trộn phần khách đổi vào c.style rồi gọi draw(ctx, c).
// Mẫu `full` tự vẽ cả khung (ảnh qua c.photo), `fixedY` = chữ nằm ô cố định, không kéo. draw PHẢI
// trả khung bao chữ (trang dùng để kéo/bấm). Số đo viết theo khổ 1080 nhân c.u. Nạp TRƯỚC mọi mẫu.

window.CX_POSTER_TEMPLATES = window.CX_POSTER_TEMPLATES || [];

window.CXPosterKit = (() => {
  // Vùng giao diện TikTok đè lên ảnh (phần của khổ ảnh): thanh tab trên, tên tài khoản + nhạc dưới,
  // cột nút bên phải. Ảnh dọc 9:16 phủ kín màn nên bị che nhiều; khổ thấp hơn có viền đen trên dưới
  // nên chỉ còn cột nút đè lên. Chỗ đặt chữ MẶC ĐỊNH của mẫu nên nằm ngoài các vùng này (khách vẫn kéo
  // được ra sát mép).
  const safe = (c) => (c.H / c.W > 1.7 ? { top: 0.1, bottom: 0.2, right: 0.15 } : { top: 0.06, bottom: 0.08, right: 0.15 });
  const font = (o, px) => `${o.style || "normal"} ${o.weight || 400} ${px}px ${o.family}`;

  // "#rrggbb" + độ đậm 0–1 → chuỗi rgba cho canvas.
  function rgba(hex, a = 1) {
    let h = String(hex || "#000000").replace("#", "");
    if (h.length === 3) h = h.replace(/./g, (x) => x + x);
    const n = parseInt(h, 16) || 0;
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }

  // Ngắt dòng theo bề ngang, giữ xuống dòng tay; từ dài hơn cả dòng thì cắt theo ký tự.
  function wrap(ctx, text, maxW) {
    const out = [];
    String(text ?? "")
      .split(/\n/)
      .forEach((para) => {
        let line = "";
        para.split(/\s+/).filter(Boolean).forEach((word) => {
          const next = line ? `${line} ${word}` : word;
          if (ctx.measureText(next).width <= maxW) return (line = next);
          if (line) out.push(line);
          line = word;
          while (ctx.measureText(line).width > maxW && line.length > 1) {
            let k = line.length - 1;
            while (k > 1 && ctx.measureText(line.slice(0, k)).width > maxW) k--;
            out.push(line.slice(0, k));
            line = line.slice(k);
          }
        });
        if (line) out.push(line);
      });
    return out;
  }

  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, Math.min(r, h / 2, w / 2));
    else ctx.rect(x, y, w, h);
  }

  // Tâm ngang của khối rộng w: c.cx (khách đã kéo) hoặc def, kẹp cho khối không lọt ra ngoài ảnh —
  // kéo được sát mép (lề an toàn TikTok chỉ dùng cho chỗ đặt mặc định của mẫu).
  function clampX(c, w, def) {
    return Math.min(Math.max(c.cx ?? def, w / 2), c.W - w / 2);
  }
  // Mép trên của khối cao h (pad = phần nền thừa trên/dưới chữ) có tâm ở c.cy, kẹp trong ảnh.
  function clampY(c, h, pad = 0) {
    return Math.min(Math.max(c.cy - h / 2, pad), c.H - pad - h);
  }

  // Căn dòng chữ trong khối: o.align hoặc c.style.align (khách chọn ở thẻ "Chữ") — left/center/right.
  const alignOf = (c, o) => o.align || c.style?.align || "center";

  // Chữ phụ đề kiểu TikTok: mỗi dòng một ô nền bo góc, các ô liền nhau thành một khối; căn dòng thì
  // các ô dồn theo mép trái/phải của khối.
  // o: family · weight · fs (khổ 1080, nhân c.size) · lh · maxW (phần bề ngang ảnh) · padX · padY · r
  // · bg · color.
  function boxes(ctx, c, o) {
    const k = c.u * c.size;
    const fs = o.fs * k;
    ctx.font = font(o, fs);
    const lines = wrap(ctx, c.text, c.W * (o.maxW || 0.86));
    if (!lines.length) return null;
    const lh = fs * (o.lh || 1.4);
    const padX = (o.padX ?? 20) * k;
    const padY = (o.padY ?? 0) * k;
    const r = (o.r ?? 14) * k;
    const top = clampY(c, lines.length * lh, padY);
    const ws = lines.map((s) => ctx.measureText(s).width + padX * 2);
    const w = Math.max(...ws);
    const cx = clampX(c, w, c.W / 2);
    const al = alignOf(c, o);
    const lx = (i) => (al === "left" ? cx - w / 2 : al === "right" ? cx + w / 2 - ws[i] : cx - ws[i] / 2);
    ctx.save();
    ctx.fillStyle = o.bg;
    lines.forEach((s, i) => {
      const y0 = top + i * lh - (i === 0 ? padY : 0);
      const y1 = top + (i + 1) * lh + (i === lines.length - 1 ? padY : 0);
      // Chờm 1px sang ô kế để hai ô liền không hở vạch sáng.
      rr(ctx, lx(i), y0 - (i ? 1 : 0), ws[i], y1 - y0 + (i ? 1 : 0), r);
      ctx.fill();
    });
    ctx.fillStyle = o.color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    lines.forEach((s, i) => ctx.fillText(s, lx(i) + ws[i] / 2, top + i * lh + lh / 2 + fs * 0.04));
    ctx.restore();
    return { x: cx - w / 2, y: top - padY, w, h: lines.length * lh + padY * 2 };
  }

  // Chữ trong một ô cố định: thu nhỏ dần tới o.min (khổ 1080) cho lọt ô; căn dòng theo alignOf,
  // dọc theo o.valign (0 trên – 0.5 giữa – 1 dưới). Lời trống thì trả cả ô.
  function textIn(ctx, c, o, box) {
    if (!c.text) return { x: box.x, y: box.y, w: box.w, h: box.h };
    const min = (o.min || 22) * c.u;
    let fs = o.fs * c.u * c.size;
    let lines;
    let lh;
    for (;;) {
      ctx.font = font(o, fs);
      lines = wrap(ctx, c.text, box.w);
      lh = fs * (o.lh || 1.4);
      if (lines.length * lh <= box.h || fs <= min) break;
      fs = Math.max(min, fs * 0.92);
    }
    const h = lines.length * lh;
    const top = box.y + Math.max(0, box.h - h) * (o.valign ?? 0.5);
    const al = alignOf(c, o);
    const tx = al === "left" ? box.x : al === "right" ? box.x + box.w : box.x + box.w / 2;
    ctx.save();
    ctx.textAlign = al;
    ctx.textBaseline = "middle";
    ctx.fillStyle = o.color;
    lines.forEach((s, i) => ctx.fillText(s, tx, top + i * lh + lh / 2 + fs * 0.04));
    ctx.restore();
    return { x: box.x, y: top, w: box.w, h };
  }

  // Tiêu đề chữ in hoa hai màu: đoạn trước lần xuống dòng ĐẦU là dòng nhấn (màu o.accent, cỡ o.fsA),
  // phần còn lại màu o.color (cỡ o.fs); không xuống dòng thì cả lời là một màu. Kéo được (c.cx/c.cy).
  // o thêm: box (màu ô nền bo góc ôm khối chữ) + padX + r · band (màu dải nền trải hết bề ngang) ·
  // padY (đệm trên dưới của nền) · gap (khe giữa dòng nhấn và phần sau) — số đo khổ 1080. Mẫu nào
  // cũng phải có nền (box hoặc band): chữ trần trên ảnh không đọc nổi trên ảnh rối.
  function title(ctx, c, o) {
    const up = (s) => s.toLocaleUpperCase("vi");
    const paras = String(c.text || "").split(/\n/);
    const head = paras.length > 1 ? up(paras[0].trim()) : "";
    const body = up((paras.length > 1 ? paras.slice(1) : paras).join("\n").trim());
    const k = c.u * c.size;
    const maxW = c.W * (o.maxW || 0.86);
    const fsA = (o.fsA || o.fs) * k;
    const fs = o.fs * k;
    const rows = [];
    ctx.font = font(o, fsA);
    if (head) wrap(ctx, head, maxW).forEach((s) => rows.push({ s, fs: fsA, color: o.accent, w: ctx.measureText(s).width }));
    ctx.font = font(o, fs);
    const gap = head && body ? (o.gap ?? 8) * k : 0;
    wrap(ctx, body, maxW).forEach((s, i) => rows.push({ s, fs, color: o.color, w: ctx.measureText(s).width, gap: i === 0 ? gap : 0 }));
    if (!rows.length) return null;
    const lh = o.lh || 1.18;
    const h = rows.reduce((n, r) => n + r.fs * lh + (r.gap || 0), 0);
    const w = Math.max(...rows.map((r) => r.w));
    const padY = (o.padY || 0) * k;
    const padX = o.box ? (o.padX ?? 40) * k : 0;
    const top = clampY(c, h, padY);
    const cx = clampX(c, w + padX * 2, c.W / 2);
    ctx.save();
    if (o.box) {
      ctx.fillStyle = o.box;
      rr(ctx, cx - w / 2 - padX, top - padY, w + padX * 2, h + padY * 2, (o.r ?? 28) * k);
      ctx.fill();
    }
    if (o.band) {
      ctx.fillStyle = o.band;
      ctx.fillRect(0, top - padY, c.W, h + padY * 2);
    }
    const al = alignOf(c, o);
    const tx = al === "left" ? cx - w / 2 : al === "right" ? cx + w / 2 : cx;
    ctx.textAlign = al;
    ctx.textBaseline = "middle";
    let y = top;
    rows.forEach((r) => {
      y += r.gap || 0;
      const my = y + (r.fs * lh) / 2 + r.fs * 0.04;
      ctx.font = font(o, r.fs);
      ctx.fillStyle = r.color;
      ctx.fillText(r.s, tx, my);
      y += r.fs * lh;
    });
    ctx.restore();
    return { x: cx - w / 2 - padX, y: top - padY, w: w + padX * 2, h: h + padY * 2 };
  }

  return { safe, font, rgba, wrap, rr, clampX, clampY, alignOf, boxes, textIn, title };
})();
