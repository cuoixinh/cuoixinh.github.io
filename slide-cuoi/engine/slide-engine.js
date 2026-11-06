// Bộ vẽ slide bằng canvas — dùng CHUNG cho xem trước (runtime) và xuất video (slide-export.js),
// nên video ra y hệt bản xem. Mẫu khai cảnh dưới dạng DỮ LIỆU (khối màu, ảnh, chữ, vạch…
// kèm hiệu ứng); frame() vẽ khung tại thời điểm t, thuần theo t, không trạng thái ẩn.
// Toạ độ theo khổ thiết kế W×H của mẫu; canvas to bao nhiêu thì tự phóng theo.

window.CXSlideEngine = (() => {
  const _ease = (p) => 1 - Math.pow(1 - p, 3);
  const _easeIO = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
  const _clamp = (p) => (p < 0 ? 0 : p > 1 ? 1 : p);
  // Lao nhanh rồi phanh êm đến đúng đích (bay vào) · _back: vượt quá đích rồi lùi về — chỉ dùng
  // khi mẫu khai `back` (nảy), mặc định không nảy.
  const _glide = (p) => 1 - Math.pow(1 - p, 5);
  const _back = (p, s = 1.3) => 1 + (s + 1) * Math.pow(p - 1, 3) + s * Math.pow(p - 1, 2);

  // Thời lượng mặc định (giây) của từng kiểu hiệu ứng. Nhóm sau dành cho mẫu cần chuyển động
  // mạnh: fly (bay từ ngoài khung vào) · zoom · flip (lật thẻ) · reveal (mở dần từ một mép) ·
  // track (chữ dãn rộng rồi khép lại) · letters (từng ký tự trồi lên) · lines (từng dòng).
  const _ANIM_T = { fade: 1.4, up: 1.4, left: 1.6, right: 1.6, spread: 1.2, wipe: 1.8, fly: 1.5, zoom: 1.8, flip: 1.2, reveal: 1.4, track: 2.2 };
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

  // Bề ngang một dòng, cộng khoảng dãn chữ `ls` (px) giữa các ký tự.
  const _mw = (ctx, s, ls) => ctx.measureText(s).width + (ls ? ls * (Array.from(s).length - 1) : 0);

  function wrap(text, font, maxW, ls) {
    const ctx = _measure();
    ctx.font = fontStr(font);
    const out = [];
    String(text ?? "")
      .split(/\n/)
      .forEach((para) => {
        let line = "";
        para.split(/\s+/).filter(Boolean).forEach((word) => {
          const next = line ? line + " " + word : word;
          if (line && _mw(ctx, next, ls) > maxW) {
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
        // caps: viết hoa (cả chữ khách sửa) · ls: dãn chữ · align: left/center/right trong khổ w
        // · shadow: màu bóng mờ sau chữ (chữ trắng đặt trên ảnh).
        const raw = b.caps ? String(b.text ?? "").toLocaleUpperCase("vi") : b.text;
        const lines = wrap(raw, b.font, w, b.ls);
        const lh = b.font.size * (b.lh || 1.3);
        // tw = bề ngang thật của dòng dài nhất (vùng bấm để sửa); key = khoá chữ của mẫu.
        const ctx = _measure();
        ctx.font = fontStr(b.font);
        const tw = Math.min(w, Math.max(0, ...lines.map((l) => _mw(ctx, l, b.ls))));
        els.push({
          type: "text", x, y, w, tw, h: lines.length * lh, lines, lh, font: b.font, color: b.color, anim: b.anim, key: b.key,
          ls: b.ls || 0, align: b.align, shadow: b.shadow, alpha: b.alpha,
        });
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
  // tpl = CX_SLIDE của mẫu; tpl.scenes(w, api) trả [{id, dur (giây), label, els, texts, photo}]
  // (id = mã cảnh ổn định, khoá thời lượng khách chỉnh; thiếu thì lấy vị trí).
  // texts = {khoá: chữ} người dùng sửa ở trang cha, mẫu tự áp vào khối cùng khoá; photos =
  // {id cảnh: {src: blob URL, focal}} ảnh khách tải lên, đè ảnh thiệp của cảnh đó. Cảnh khai
  // photo = {key, def, w, h}: id cảnh, ảnh mặc định, khổ khung ảnh (cho bảng lấy nét).
  async function build(tpl, wedding, texts, photos, timing) {
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
    _shrink(scenes, images, tpl.w);
    const fade = tpl.fade ?? 0.9;
    scenes.forEach((s, k) => {
      s.id = String(s.id ?? k);
      s.base = s.dur;
      s.min = Math.min(s.base, Math.max(3, fade + 1, Math.ceil((Math.max(0, ...s.els.map(_end)) + 1) * 2) / 2));
      s.max = Math.max(SCENE_MAX, s.base);
    });
    const P = { W: tpl.w, H: tpl.h, bg: tpl.bg || "#000", fade, tr: tpl.tr, fx: tpl.fx, scenes, images };
    return retime(P, timing);
  }

  // ── Thời lượng ──
  // Mỗi cảnh: base = thời lượng mẫu tính · min = lúc mọi hiệu ứng chạy xong + 1 giây (ngắn hơn là
  // chữ chưa hiện hết đã sang cảnh) · max = SCENE_MAX. timing = {scale, scenes: {id cảnh: giây}}
  // do khách kéo ở trang cha: cảnh có số riêng dùng số đó, còn lại base × scale; luôn kẹp
  // trong [min, max]. Đổi timing chỉ cần retime — không dựng lại dự án.
  const SCENE_MAX = 30;
  function retime(P, timing) {
    const k = Number(timing?.scale) > 0 ? Number(timing.scale) : 1;
    const own = (timing && typeof timing.scenes === "object" && timing.scenes) || {};
    P.starts = [];
    P.total = 0;
    P.scenes.forEach((s) => {
      const want = Number(own[s.id]) > 0 ? Number(own[s.id]) : s.base * k;
      s.dur = Math.min(s.max, Math.max(s.min, want));
      P.starts.push(P.total);
      P.total += s.dur;
    });
    return P;
  }

  // Giây (tính từ đầu cảnh) mà hiệu ứng của phần tử — và mọi phần tử con — chạy xong.
  function _end(el) {
    const a = el.anim;
    let e = 0;
    if (a) {
      const d = a.d || 0;
      const n = el.lines ? el.lines.reduce((c, l) => c + Array.from(l).length, 0) : 0;
      if (a.k === "type" && el.lines) e = d + n / (a.cps || TYPE_CPS) + 1.2;
      else if (a.k === "letters" && el.lines) e = d + n * (a.step ?? 0.045) + (a.t ?? 0.9);
      else if (a.k === "lines" && el.lines) e = d + (el.lines.length - 1) * (a.step ?? 0.22) + (a.t ?? 1.1);
      else e = d + (a.t ?? _ANIM_T[a.k] ?? 1.4);
    }
    (el.kids || []).forEach((kid) => (e = Math.max(e, _end(kid))));
    return e;
  }

  // Ảnh gốc to hơn nhiều so với khung (ảnh 2000×2600 trong ô 176×176) thì thu MỘT lần về đúng cỡ
  // khung cần ở khổ 4K (+12% cho Ken Burns) — vẽ lại ảnh to từng khung hình là phần nặng nhất.
  // Bản thu nhỏ là canvas riêng của dự án; ảnh gốc trong bộ nhớ đệm loadImage giữ nguyên.
  function _shrink(scenes, images, W) {
    const need = new Map();
    const walk = (el) => {
      el.kids?.forEach(walk);
      const img = el.type === "image" && images.get(el.src);
      if (!img?.naturalWidth || !el.w || !el.h) return;
      const iw = img.naturalWidth;
      const ih = img.naturalHeight;
      const cw = iw / ih > el.w / el.h ? ih * (el.w / el.h) : iw;
      const k = ((el.w / cw) * (3840 / W) * 1.12) * Math.max(1, el.anim?.s0 || 1);
      need.set(el.src, Math.max(need.get(el.src) || 0, k));
    };
    scenes.forEach((s) => s.els.forEach(walk));
    need.forEach((k, src) => {
      const img = images.get(src);
      if (k >= 0.8) return;
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(img.naturalWidth * k));
      c.height = Math.max(1, Math.round(img.naturalHeight * k));
      const x = c.getContext("2d");
      x.imageSmoothingQuality = "high";
      x.drawImage(img, 0, 0, c.width, c.height);
      c.naturalWidth = c.width;
      c.naturalHeight = c.height;
      images.set(src, c);
    });
  }

  function indexAt(P, t) {
    let i = 0;
    while (i + 1 < P.starts.length && P.starts[i + 1] <= t) i++;
    return i;
  }

  // ── Vẽ ──
  // Cảnh mới vào đè lên cảnh trước trong `fade` giây đầu (cảnh trước đứng ở trạng thái cuối),
  // theo kiểu chuyển cảnh `tr` của cảnh mới (hoặc của mẫu): fade · slide/slide-up (đẩy cảnh cũ
  // ra) · zoom (lao xuyên qua) · split (mở từ giữa ra hai bên). o.loop: cảnh đầu đè lên cảnh cuối
  // (xem trước quay vòng); o.noFade: bỏ lớp cảnh trước (nhảy cảnh — runtime tự làm mờ khung cũ).
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
      _cross(ctx, P, j, i, local, local / P.fade);
    } else _scene(ctx, P, i, local, 1);
    if (P.fx?.sparkle) _sparkle(ctx, { x: 0, y: 0, w: P.W, h: P.H, ...P.fx.sparkle }, t);
  }

  function _cross(ctx, P, j, i, local, p) {
    const W = P.W;
    const H = P.H;
    const prevT = P.scenes[j].dur + local;
    const tr = P.scenes[i].tr || P.tr || "fade";
    const e = _easeIO(p);
    if (tr === "slide" || tr === "slide-up") {
      const up = tr === "slide-up";
      _scene(ctx, P, j, prevT, 1, (c) => c.translate(up ? 0 : -W * e, up ? -H * e : 0));
      _scene(ctx, P, i, local, 1, (c) => c.translate(up ? 0 : W * (1 - e), up ? H * (1 - e) : 0));
    } else if (tr === "zoom") {
      _scene(ctx, P, j, prevT, 1, (c) => _scaleAt(c, 1 + 0.35 * e, W / 2, H / 2));
      _scene(ctx, P, i, local, _ease(p), (c) => _scaleAt(c, 1.25 - 0.25 * _ease(p), W / 2, H / 2));
    } else if (tr === "split") {
      _scene(ctx, P, j, prevT, 1);
      _scene(ctx, P, i, local, 1, (c) => {
        c.beginPath();
        c.rect((W / 2) * (1 - e), 0, W * e, H);
        c.clip();
      });
    } else {
      _scene(ctx, P, j, prevT, 1);
      _scene(ctx, P, i, local, _ease(p));
    }
  }

  const _scaleAt = (ctx, s, cx, cy) => {
    ctx.translate(cx, cy);
    ctx.scale(s, s);
    ctx.translate(-cx, -cy);
  };

  function _scene(ctx, P, i, lt, alpha, pre) {
    const s = P.scenes[i];
    ctx.save();
    pre?.(ctx);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = s.bg || P.bg;
    ctx.fillRect(0, 0, P.W, P.H);
    s.els.forEach((el) => _el(ctx, P, el, lt, s.dur));
    ctx.restore();
  }

  // Khung của phần tử theo toạ độ mẫu, CHƯA xoay (chữ: đúng phần có chữ, theo align).
  function _box(el) {
    if (el.type === "text") {
      const w = el.tw ?? el.w;
      return { x: _ax(el, w), y: el.y, w, h: el.h };
    }
    return { x: el.x || 0, y: el.y || 0, w: el.w || 0, h: el.h || 1 };
  }
  // Khung thẳng trục SAU khi xoay (chỉ xoay 90°/-90° mới đổi khổ) — vùng bấm để sửa của runtime.
  function bounds(el) {
    const b = _box(el);
    const r = Math.abs((((el.rot || 0) % 180) + 180) % 180);
    if (r !== 90) return b;
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2;
    return { x: cx - b.h / 2, y: cy - b.w / 2, w: b.h, h: b.w };
  }
  const _ax = (el, w) => (el.align === "center" ? el.x + (el.w - w) / 2 : el.align === "right" ? el.x + el.w - w : el.x);

  // Hướng bay: tên mép (left · right · top · bottom · tl · tr · bl · br) hoặc góc độ.
  const _DIRS = { left: [-1, 0], right: [1, 0], top: [0, -1], bottom: [0, 1], tl: [-1, -1], tr: [1, -1], bl: [-1, 1], br: [1, 1] };
  function _dir(from) {
    if (typeof from === "number") return [Math.cos((from * Math.PI) / 180), Math.sin((from * Math.PI) / 180)];
    const v = _DIRS[from] || _DIRS.left;
    const len = Math.hypot(v[0], v[1]);
    return [v[0] / len, v[1] / len];
  }
  // Quãng phải lùi theo (ux, uy) để khung b nằm trọn ngoài khung hình.
  function _off(b, ux, uy, W, H) {
    const tx = ux > 0 ? (W - b.x) / ux : ux < 0 ? (b.x + b.w) / -ux : Infinity;
    const ty = uy > 0 ? (H - b.y) / uy : uy < 0 ? (b.y + b.h) / -uy : Infinity;
    return Math.min(tx, ty);
  }

  function _el(ctx, P, el, lt, dur) {
    const a = el.anim;
    const at = lt - (a?.d || 0);
    if (a && at <= 0) return;
    ctx.save();
    if (el.alpha != null) ctx.globalAlpha *= el.alpha;
    if (el.rot) {
      const b = _box(el);
      ctx.translate(b.x + b.w / 2, b.y + b.h / 2);
      ctx.rotate((el.rot * Math.PI) / 180);
      ctx.translate(-(b.x + b.w / 2), -(b.y + b.h / 2));
    }
    if (a?.k === "type" && el.type === "text") _typed(ctx, el, at, a.cps || TYPE_CPS);
    else if ((a?.k === "letters" || a?.k === "lines") && el.type === "text") _stagger(ctx, el, at, a);
    else {
      let p = 1;
      let lsAdd = 0;
      if (a) {
        const T = a.t ?? _ANIM_T[a.k] ?? 1.4;
        const raw = _clamp(at / T);
        const k = a.k;
        if (k === "wipe" || k === "reveal") p = _easeIO(raw);
        else if (a.back) p = raw >= 1 ? 1 : _back(raw, a.back);
        else if (k === "fly" || k === "flip") p = _glide(raw);
        else p = _ease(raw);
        if (k === "fly" || k === "flip") ctx.globalAlpha *= _clamp(raw * 4);
        else if (k === "zoom") ctx.globalAlpha *= a.keep ? 1 : _clamp(raw * 2.5);
        else if (k !== "wipe" && k !== "reveal") ctx.globalAlpha *= p;
        const b = _box(el);
        const cx = b.x + b.w / 2;
        const cy = b.y + b.h / 2;
        if (k === "up") ctx.translate(0, (1 - p) * 24);
        else if (k === "left") ctx.translate(-(1 - p) * 48, 0);
        else if (k === "right") ctx.translate((1 - p) * 48, 0);
        else if (k === "spread") {
          ctx.translate(el.x, 0);
          ctx.scale(Math.max(p, 0.001), 1);
          ctx.translate(-el.x, 0);
        } else if (k === "wipe") {
          // Lề rộng cho nét nghiêng / chữ viết tay vượt khỏi khung đo.
          const padX = 24;
          const padY = (el.font?.size || 40) * 0.6;
          ctx.beginPath();
          ctx.rect(el.x - padX, el.y - padY, (el.w + padX * 2) * p, (el.h || 0) + padY * 2);
          ctx.clip();
        } else if (k === "fly") {
          const [ux, uy] = _dir(a.from);
          const far = (a.dist ?? _off(b, ux, uy, P.W, P.H) + 80) * (1 - p);
          ctx.translate(ux * far, uy * far);
          const s0 = a.s0 ?? 1;
          if (a.rot || s0 !== 1) {
            ctx.translate(cx, cy);
            ctx.rotate(((a.rot || 0) * (1 - p) * Math.PI) / 180);
            ctx.scale(s0 + (1 - s0) * p, s0 + (1 - s0) * p);
            ctx.translate(-cx, -cy);
          }
        } else if (k === "zoom") _scaleAt(ctx, (a.s0 ?? 1.3) + (1 - (a.s0 ?? 1.3)) * p, cx, cy);
        else if (k === "flip") {
          ctx.translate(cx, 0);
          ctx.scale(Math.max(Math.abs(p), 0.001), 1);
          ctx.translate(-cx, 0);
        } else if (k === "reveal") {
          // Mở dần từ mép `from`; nội dung trôi theo một đoạn `drift` cho có đà.
          const f = a.from || "left";
          ctx.beginPath();
          if (f === "right") ctx.rect(b.x + b.w * (1 - p), b.y, b.w * p, b.h);
          else if (f === "top") ctx.rect(b.x, b.y, b.w, b.h * p);
          else if (f === "bottom") ctx.rect(b.x, b.y + b.h * (1 - p), b.w, b.h * p);
          else ctx.rect(b.x, b.y, b.w * p, b.h);
          ctx.clip();
          const dr = (a.drift ?? 0) * (1 - p);
          ctx.translate(f === "left" ? -dr : f === "right" ? dr : 0, f === "top" ? -dr : f === "bottom" ? dr : 0);
        } else if (k === "track") lsAdd = (a.ls0 ?? 32) * (1 - p);
      }
      _draw(ctx, P, el, lt, dur, lsAdd);
    }
    ctx.restore();
  }

  function _draw(ctx, P, el, lt, dur, lsAdd) {
    switch (el.type) {
      case "rect":
        ctx.fillStyle = el.fill;
        ctx.fillRect(el.x, el.y, el.w, el.h);
        break;
      case "grad": {
        // Dải màu chuyển: stops = [[0..1, màu], …], dir "down" (mặc định) hoặc "right".
        const g =
          el.dir === "right"
            ? ctx.createLinearGradient(el.x, 0, el.x + el.w, 0)
            : ctx.createLinearGradient(0, el.y, 0, el.y + el.h);
        el.stops.forEach(([o, c]) => g.addColorStop(o, c));
        ctx.fillStyle = g;
        ctx.fillRect(el.x, el.y, el.w, el.h);
        break;
      }
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
      case "sparkle":
        _sparkle(ctx, el, lt);
        break;
      case "text":
        _text(ctx, el, (el.ls || 0) + (lsAdd || 0));
        break;
      case "group":
        el.kids.forEach((kid) => _el(ctx, P, kid, lt, dur));
        break;
    }
  }

  // Chữ dãn (ls ≠ 0) vẽ từng ký tự, ngắt theo cụm ký tự hiển thị (chữ có dấu gõ kiểu tổ hợp
  // không bị tách dấu khỏi chữ). Bề ngang từng ký tự đo một lần rồi giữ trên phần tử.
  const _seg = typeof Intl !== "undefined" && Intl.Segmenter ? new Intl.Segmenter("vi", { granularity: "grapheme" }) : null;
  const _graph = (s) => (_seg ? Array.from(_seg.segment(String(s).normalize("NFC")), (x) => x.segment) : Array.from(String(s).normalize("NFC")));
  function _glyphs(ctx, el) {
    if (el._g) return el._g;
    ctx.font = fontStr(el.font);
    el._g = el.lines.map((l) => {
      const ch = _graph(l);
      return { ch, cw: ch.map((c) => ctx.measureText(c).width) };
    });
    return el._g;
  }
  const _gw = (g, ls) => g.cw.reduce((n, w) => n + w, 0) + ls * Math.max(0, g.ch.length - 1);

  function _textStyle(ctx, el) {
    ctx.font = fontStr(el.font);
    ctx.fillStyle = el.color;
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    if (el.shadow) {
      ctx.shadowColor = el.shadow;
      ctx.shadowBlur = el.font.size * 0.5;
    }
  }

  function _text(ctx, el, ls) {
    _textStyle(ctx, el);
    if (!ls) {
      el.lines.forEach((line, k) => {
        const x = el.align ? _ax(el, ctx.measureText(line).width) : el.x;
        ctx.fillText(line, x, el.y + (k + 0.5) * el.lh);
      });
      return;
    }
    _glyphs(ctx, el).forEach((g, k) => {
      let x = _ax(el, _gw(g, ls));
      const y = el.y + (k + 0.5) * el.lh;
      g.ch.forEach((c, j) => {
        ctx.fillText(c, x, y);
        x += g.cw[j] + ls;
      });
    });
  }

  // letters: từng ký tự trồi lên nối đuôi nhau (a.step giây/ký tự) · lines: từng dòng một.
  function _stagger(ctx, el, at, a) {
    _textStyle(ctx, el);
    const T = a.t ?? (a.k === "letters" ? 0.9 : 1.1);
    const step = a.step ?? (a.k === "letters" ? 0.045 : 0.22);
    const dy = a.dy ?? (a.k === "letters" ? 0.5 * el.font.size : 22);
    const base = ctx.globalAlpha;
    const ls = el.ls || 0;
    let n = 0;
    _glyphs(ctx, el).forEach((g, k) => {
      const y = el.y + (k + 0.5) * el.lh;
      let x = _ax(el, ls ? _gw(g, ls) : ctx.measureText(el.lines[k]).width);
      if (a.k === "lines") {
        const p = _clamp((at - k * step) / T);
        if (p <= 0) return;
        const q = _ease(p);
        ctx.globalAlpha = base * q;
        if (!ls) return ctx.fillText(el.lines[k], x, y + (1 - q) * dy);
        g.ch.forEach((c, j) => {
          ctx.fillText(c, x, y + (1 - q) * dy);
          x += g.cw[j] + ls;
        });
        return;
      }
      g.ch.forEach((c, j) => {
        const p = _clamp((at - n++ * step) / T);
        if (p > 0) {
          const q = _ease(p);
          ctx.globalAlpha = base * _clamp(p * 2);
          ctx.fillText(c, x, y + (1 - q) * dy);
        }
        x += g.cw[j] + ls;
      });
    });
    ctx.globalAlpha = base;
  }

  // Đánh chữ: hiện dần từng ký tự theo dòng đã ngắt sẵn (chữ không nhảy dòng giữa chừng),
  // con trỏ mảnh đứng sau ký tự cuối, nhấp nháy thêm một nhịp rồi tắt khi gõ xong.
  function _typed(ctx, el, at, cps) {
    const lines = el._chars || (el._chars = el.lines.map((l) => Array.from(l)));
    const total = lines.reduce((n, l) => n + l.length, 0);
    let left = Math.floor(at * cps);
    _textStyle(ctx, el);
    let cx = el.x;
    let cy = el.y + 0.5 * el.lh;
    for (let k = 0; k < lines.length && left > 0; k++) {
      const part = lines[k].slice(0, left).join("");
      left -= lines[k].length;
      cy = el.y + (k + 0.5) * el.lh;
      // Canh giữa/phải: ký tự đứng sẵn đúng chỗ của cả dòng, không trôi theo lúc gõ.
      const x0 = el.align ? _ax(el, ctx.measureText(el.lines[k]).width) : el.x;
      ctx.fillText(part, x0, cy);
      cx = x0 + ctx.measureText(part).width;
    }
    const done = at - total / cps;
    if (done < 0 || (done < 1.2 && Math.floor(done * 2.5) % 2 === 0)) {
      const h = el.font.size * 0.9;
      ctx.fillRect(cx + 3, cy - h / 2, 2, h);
    }
  }

  // Ảnh phủ kín khung theo điểm lấy nét (như object-fit: cover + object-position). el.kb: Ken
  // Burns suốt cảnh, giữ điểm lấy nét đứng yên — true thu từ 1.1 về 1, "in" phóng từ 1 lên 1.12.
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
      const q = _clamp(lt / dur);
      const z = el.kb === "in" ? 1 + 0.12 * q : 1.1 - 0.1 * q;
      const zw = cw / z;
      const zh = ch / z;
      cx += (cw - zw) * fx;
      cy += (ch - zh) * fy;
      cw = zw;
      ch = zh;
    }
    ctx.drawImage(img, cx, cy, cw, ch, el.x, el.y, el.w, el.h);
  }

  // Đốm sáng lấp lánh trôi lên trong khung {x, y, w, h}: n đốm, size (px), alpha, seed; thuần
  // theo t nên xuất video ra y hệt. Một phần đốm có thêm tia sao bốn cánh.
  let _dot = null;
  function _glow() {
    if (_dot) return _dot;
    _dot = document.createElement("canvas");
    _dot.width = _dot.height = 64;
    const c = _dot.getContext("2d");
    const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.22, "rgba(255,255,255,0.75)");
    g.addColorStop(0.5, "rgba(255,255,255,0.18)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    c.fillStyle = g;
    c.fillRect(0, 0, 64, 64);
    return _dot;
  }
  const _rnd = (n) => {
    const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
    return s - Math.floor(s);
  };
  function _sparkle(ctx, el, t) {
    const dot = _glow();
    const n = el.n || 30;
    const seed = (el.seed || 1) * 1000;
    const size = el.size || 10;
    const base = ctx.globalAlpha * (el.alpha ?? 0.8);
    ctx.save();
    ctx.fillStyle = el.color || "#fff";
    for (let k = 0; k < n; k++) {
      const r = (m) => _rnd(seed + k * 17 + m);
      const s = size * (0.35 + r(1) * 1.3);
      const speed = 6 + r(2) * 22;
      const ph = r(3) * Math.PI * 2;
      const y = el.y + ((((r(4) * el.h - t * speed) % el.h) + el.h) % el.h);
      const x = el.x + r(5) * el.w + Math.sin(t * 0.6 + ph) * 14;
      const tw = 0.2 + 0.8 * (0.5 + 0.5 * Math.sin(t * (1.2 + r(6) * 2.4) + ph));
      ctx.globalAlpha = base * tw;
      ctx.drawImage(dot, x - s, y - s, s * 2, s * 2);
      if (r(7) > 0.8) {
        const L = s * 2.4 * tw;
        ctx.fillRect(x - L, y - 0.6, L * 2, 1.2);
        ctx.fillRect(x - 0.6, y - L, 1.2, L * 2);
      }
    }
    ctx.restore();
  }

  return { build, retime, frame, indexAt, column, wrap, fontStr, typeTime, bounds };
})();
