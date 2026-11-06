// Bộ vẽ slide bằng canvas — dùng CHUNG cho xem trước (runtime) và xuất video (slide-export.js),
// nên video ra y hệt bản xem. Mẫu khai cảnh dưới dạng DỮ LIỆU (khối màu, ảnh, chữ, vạch…
// kèm hiệu ứng); frame() vẽ khung tại thời điểm t, thuần theo t, không trạng thái ẩn.
// Toạ độ theo khổ thiết kế W×H của mẫu; canvas to bao nhiêu thì tự phóng theo.

window.CXSlideEngine = (() => {
  const _ease = (p) => 1 - Math.pow(1 - p, 3);
  const _easeIO = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
  const _clamp = (p) => (p < 0 ? 0 : p > 1 ? 1 : p);

  // Thời lượng mặc định (giây) của từng kiểu hiệu ứng.
  const _ANIM_T = { fade: 1.4, up: 1.4, left: 1.6, right: 1.6, spread: 1.2, wipe: 1.8 };
  // Hiệu ứng "type" (đánh chữ): số ký tự mỗi giây mặc định, thời lượng = số ký tự / tốc độ.
  const TYPE_CPS = 24;
  const typeTime = (text, cps) => Array.from(String(text || "")).length / (cps || TYPE_CPS);

  const fontStr = (f) => `${f.style || "normal"} ${f.weight || 400} ${f.size}px ${f.family}`;

  // Font phải tải XONG trước khi đo/vẽ chữ: canvas không tự đợi font như trang web, thiếu là
  // đo bằng font dự phòng rồi chữ tràn khung. Kèm chữ có dấu để kéo về đúng bộ tiếng Việt.
  async function loadFonts(list) {
    if (!document.fonts?.load) return;
    const sample = "AaĂăÂâĐđÊêÔôƠơƯư Ấấ Ữữ Ọọ 0123 &";
    await Promise.all((list || []).map((f) => document.fonts.load(f, sample).catch(() => null)));
  }

  // crossOrigin bắt buộc: thiếu là canvas bị "nhiễm" (tainted) và VideoFrame từ chối xuất video.
  // Ảnh giữ lại theo src: sửa chữ là dựng lại cả dự án, không tải lại ảnh.
  const _imgs = new Map();
  function loadImage(src) {
    if (!_imgs.has(src)) _imgs.set(src, _loadImage(src));
    return _imgs.get(src);
  }
  // Lượt crossOrigin hỏng thì tải lại bằng URL khác: bản ảnh đã nằm trong cache trình duyệt
  // từ một lượt KHÔNG CORS (thẻ <img> thường, hoặc worker ảnh bản cũ chưa trả
  // Access-Control-Allow-Origin — cache 30 ngày) bị dùng lại và trình duyệt chặn.
  function _loadImage(src) {
    return _fetchImage(src).then((img) => {
      if (img || !/^https?:/i.test(src || "")) return img;
      if (new URL(src, location.href).origin === location.origin) return img;
      return _fetchImage(src + (src.includes("?") ? "&" : "?") + "cx-cors=1");
    });
  }
  function _fetchImage(src) {
    return new Promise((resolve) => {
      if (!src) return resolve(null);
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.decoding = "async";
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  // ── Dàn chữ ──
  let _mctx = null;
  const _measure = () => (_mctx ||= document.createElement("canvas").getContext("2d"));

  function wrap(text, font, maxW) {
    const ctx = _measure();
    ctx.font = fontStr(font);
    const out = [];
    String(text ?? "")
      .split(/\n/)
      .forEach((para) => {
        let line = "";
        para.split(/\s+/).filter(Boolean).forEach((word) => {
          const next = line ? line + " " + word : word;
          if (line && ctx.measureText(next).width > maxW) {
            out.push(line);
            line = word;
          } else line = next;
        });
        out.push(line);
      });
    return out;
  }

  // Xếp một cột khối (chữ / vạch / nhiều cột con) từ trên xuống, canh giữa theo chiều dọc
  // trong [top, bottom]. Khối: {text, font, color, lh, mt, anim} · {line, w, color, mt, anim}
  // · {cols: [[khối…], …], gap, mt, anim}. Trả mảng phần tử để vẽ. Khối chữ có `key` thì
  // phần tử chữ giữ lại key đó (bộ phát dùng để bấm lên slide là sửa đúng dòng).
  function column(blocks, { x, w, top, bottom }) {
    const laid = _lay(blocks, x, w);
    const y0 = top + Math.max(0, (bottom - top - laid.h) / 2);
    laid.els.forEach((el) => _shift(el, y0));
    return laid.els;
  }

  function _lay(blocks, x, w) {
    const els = [];
    let y = 0;
    blocks.filter(Boolean).forEach((b, i) => {
      if (i || b.mtFirst) y += b.mt || 0;
      if (b.line) {
        els.push({ type: "line", x, y, w: b.w || 96, color: b.color, anim: b.anim });
        y += 1;
      } else if (b.cols) {
        const gap = b.gap ?? 32;
        const cw = (w - gap * (b.cols.length - 1)) / b.cols.length;
        let h = 0;
        const kids = [];
        b.cols.forEach((col, k) => {
          const sub = _lay(col, x + k * (cw + gap), cw);
          sub.els.forEach((el) => _shift(el, y));
          kids.push(...sub.els);
          h = Math.max(h, sub.h);
        });
        els.push({ type: "group", x, y, w, h, kids, anim: b.anim });
        y += h;
      } else {
        const lines = wrap(b.text, b.font, w);
        const lh = b.font.size * (b.lh || 1.3);
        // tw = bề ngang thật của dòng dài nhất (vùng bấm để sửa); key = khoá chữ của mẫu.
        const ctx = _measure();
        ctx.font = fontStr(b.font);
        const tw = Math.min(w, Math.max(0, ...lines.map((l) => ctx.measureText(l).width)));
        els.push({ type: "text", x, y, w, tw, h: lines.length * lh, lines, lh, font: b.font, color: b.color, anim: b.anim, key: b.key });
        y += lines.length * lh;
      }
    });
    return { els, h: y };
  }

  function _shift(el, dy) {
    el.y += dy;
    if (el.kids) el.kids.forEach((k) => _shift(k, dy));
  }

  // ── Dựng dự án ──
  // tpl = CX_SLIDE của mẫu; tpl.scenes(w, api) trả [{dur (giây), label, els, texts, photo}].
  // texts = {khoá: chữ} người dùng sửa ở trang cha, mẫu tự áp vào khối cùng khoá; photos =
  // {id cảnh: {src: blob URL, focal}} ảnh khách tải lên, đè ảnh thiệp của cảnh đó. Cảnh khai
  // photo = {key, def, w, h}: id cảnh, ảnh mặc định, khổ khung ảnh (cho bảng lấy nét).
  async function build(tpl, wedding, texts, photos) {
    await loadFonts(tpl.fonts);
    const scenes = tpl.scenes(wedding, { column, wrap, typeTime, texts: texts || {}, photos: photos || {} }) || [];
    const srcs = new Set();
    const walk = (el) => {
      if (el.type === "image" && el.src) srcs.add(el.src);
      el.kids?.forEach(walk);
    };
    scenes.forEach((s) => s.els.forEach(walk));
    const images = new Map();
    await Promise.all(
      [...srcs].map(async (src) => images.set(src, await loadImage(src))),
    );
    const starts = [];
    let total = 0;
    scenes.forEach((s) => {
      starts.push(total);
      total += s.dur;
    });
    return { W: tpl.w, H: tpl.h, bg: tpl.bg || "#000", fade: tpl.fade ?? 0.9, scenes, starts, total, images };
  }

  function indexAt(P, t) {
    let i = 0;
    while (i + 1 < P.starts.length && P.starts[i + 1] <= t) i++;
    return i;
  }

  // ── Vẽ ──
  // Cảnh mới hiện dần đè lên cảnh trước trong `fade` giây đầu (cảnh trước đứng ở trạng thái
  // cuối). o.loop: cảnh đầu đè lên cảnh cuối (xem trước quay vòng); o.noFade: bỏ lớp cảnh
  // trước (nhảy cảnh — runtime tự làm mờ khung cũ).
  function frame(ctx, P, t, o = {}) {
    const n = P.scenes.length;
    const k = ctx.canvas.width / P.W;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.globalAlpha = 1;
    ctx.fillStyle = P.bg;
    ctx.fillRect(0, 0, P.W, P.H);
    if (!n) return;
    t = o.loop ? ((t % P.total) + P.total) % P.total : Math.max(0, Math.min(t, P.total - 1e-6));
    const i = indexAt(P, t);
    const local = t - P.starts[i];
    if (n > 1 && local < P.fade && !o.noFade && (i > 0 || o.loop)) {
      const j = (i - 1 + n) % n;
      _scene(ctx, P, j, P.scenes[j].dur + local, 1);
      _scene(ctx, P, i, local, _ease(local / P.fade));
    } else _scene(ctx, P, i, local, 1);
  }

  function _scene(ctx, P, i, lt, alpha) {
    const s = P.scenes[i];
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = s.bg || P.bg;
    ctx.fillRect(0, 0, P.W, P.H);
    s.els.forEach((el) => _el(ctx, P, el, lt, s.dur));
    ctx.restore();
  }

  function _el(ctx, P, el, lt, dur) {
    const a = el.anim;
    let p = 1;
    if (a?.k === "type" && el.type === "text") {
      if (lt < (a.d || 0)) return;
      return _typed(ctx, el, lt - (a.d || 0), a.cps || TYPE_CPS);
    }
    if (a) {
      const T = a.t ?? _ANIM_T[a.k] ?? 1.4;
      p = _clamp((lt - (a.d || 0)) / T);
      if (p <= 0) return;
      p = a.k === "wipe" ? _easeIO(p) : _ease(p);
    }
    ctx.save();
    if (a && a.k !== "wipe") ctx.globalAlpha *= p;
    if (a?.k === "up") ctx.translate(0, (1 - p) * 24);
    else if (a?.k === "left") ctx.translate(-(1 - p) * 48, 0);
    else if (a?.k === "right") ctx.translate((1 - p) * 48, 0);
    else if (a?.k === "spread") {
      ctx.translate(el.x, 0);
      ctx.scale(Math.max(p, 0.001), 1);
      ctx.translate(-el.x, 0);
    } else if (a?.k === "wipe") {
      // Lề rộng cho nét nghiêng / chữ viết tay vượt khỏi khung đo.
      const padX = 24;
      const padY = (el.font?.size || 40) * 0.6;
      ctx.beginPath();
      ctx.rect(el.x - padX, el.y - padY, (el.w + padX * 2) * p, (el.h || 0) + padY * 2);
      ctx.clip();
    }
    _draw(ctx, P, el, lt, dur);
    ctx.restore();
  }

  function _draw(ctx, P, el, lt, dur) {
    switch (el.type) {
      case "rect":
        ctx.fillStyle = el.fill;
        ctx.fillRect(el.x, el.y, el.w, el.h);
        break;
      case "frame":
        ctx.strokeStyle = el.stroke;
        ctx.lineWidth = el.lw || 1;
        ctx.strokeRect(el.x + 0.5, el.y + 0.5, el.w - 1, el.h - 1);
        break;
      case "line":
        ctx.fillStyle = el.color;
        ctx.fillRect(el.x, el.y, el.w, 1);
        break;
      case "image":
        _image(ctx, P.images.get(el.src), el, lt, dur);
        break;
      case "text":
        ctx.font = fontStr(el.font);
        ctx.fillStyle = el.color;
        ctx.textBaseline = "middle";
        ctx.textAlign = "left";
        el.lines.forEach((line, k) => ctx.fillText(line, el.x, el.y + (k + 0.5) * el.lh));
        break;
      case "group":
        el.kids.forEach((kid) => _el(ctx, P, kid, lt, dur));
        break;
    }
  }

  // Đánh chữ: hiện dần từng ký tự theo dòng đã ngắt sẵn (chữ không nhảy dòng giữa chừng),
  // con trỏ mảnh đứng sau ký tự cuối, nhấp nháy thêm một nhịp rồi tắt khi gõ xong.
  function _typed(ctx, el, at, cps) {
    const lines = el._chars || (el._chars = el.lines.map((l) => Array.from(l)));
    const total = lines.reduce((n, l) => n + l.length, 0);
    let left = Math.floor(at * cps);
    ctx.save();
    ctx.font = fontStr(el.font);
    ctx.fillStyle = el.color;
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    let cx = el.x;
    let cy = el.y + 0.5 * el.lh;
    for (let k = 0; k < lines.length && left > 0; k++) {
      const part = lines[k].slice(0, left).join("");
      left -= lines[k].length;
      cy = el.y + (k + 0.5) * el.lh;
      ctx.fillText(part, el.x, cy);
      cx = el.x + ctx.measureText(part).width;
    }
    const done = at - total / cps;
    if (done < 0 || (done < 1.2 && Math.floor(done * 2.5) % 2 === 0)) {
      const h = el.font.size * 0.9;
      ctx.fillRect(cx + 3, cy - h / 2, 2, h);
    }
    ctx.restore();
  }

  // Ảnh phủ kín khung theo điểm lấy nét (như object-fit: cover + object-position); el.kb thì
  // thu từ 1.1 về 1 suốt cảnh (Ken Burns), giữ điểm lấy nét đứng yên.
  function _image(ctx, img, el, lt, dur) {
    if (!img || !img.naturalWidth) {
      ctx.fillStyle = el.empty || "#eee";
      ctx.fillRect(el.x, el.y, el.w, el.h);
      return;
    }
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    const fx = (el.focal?.x ?? 50) / 100;
    const fy = (el.focal?.y ?? 50) / 100;
    const box = el.w / el.h;
    let cw = iw;
    let ch = ih;
    if (iw / ih > box) cw = ih * box;
    else ch = iw / box;
    let cx = (iw - cw) * fx;
    let cy = (ih - ch) * fy;
    if (el.kb) {
      const z = 1.1 - 0.1 * _clamp(lt / dur);
      const zw = cw / z;
      const zh = ch / z;
      cx += (cw - zw) * fx;
      cy += (ch - zh) * fy;
      cw = zw;
      ch = zh;
    }
    ctx.drawImage(img, cx, cy, cw, ch, el.x, el.y, el.w, el.h);
  }

  return { build, frame, indexAt, column, wrap, fontStr, typeTime };
})();
