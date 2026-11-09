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
  // track (chữ dãn rộng rồi khép lại) · letters (từng ký tự trồi lên) · lines (từng dòng) ·
  // draw (nét `stroke` tự vẽ dần theo đường).
  const _ANIM_T = { fade: 1.4, up: 1.4, left: 1.6, right: 1.6, spread: 1.2, wipe: 1.8, fly: 1.5, zoom: 1.8, flip: 1.2, reveal: 1.4, track: 2.2, draw: 2.4 };
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
      // out = quãng mờ dần cuối cảnh dài nhất (anim.out) — cảnh phải đủ dài cho cả hiệu ứng vào lẫn ra.
      s.out = Math.max(0, ...s.els.map(_outOf));
      s.min = Math.min(s.base, Math.max(3, fade + 1, Math.ceil((Math.max(0, ...s.els.map(_end)) + s.out + 1) * 2) / 2));
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
  // timing.off = [id cảnh] khách đã xoá: P.all giữ đủ cảnh của mẫu, P.scenes chỉ còn cảnh được chiếu
  // (xoá hết thì giữ nguyên bộ — slide không bao giờ rỗng).
  const SCENE_MAX = 30;
  function retime(P, timing) {
    if (!P.all) P.all = P.scenes;
    const off = new Set(Array.isArray(timing?.off) ? timing.off.map(String) : []);
    const on = P.all.filter((s) => !off.has(s.id));
    P.scenes = on.length ? on : P.all;
    const k = Number(timing?.scale) > 0 ? Number(timing.scale) : 1;
    const own = (timing && typeof timing.scenes === "object" && timing.scenes) || {};
    P.starts = [];
    P.total = 0;
    P.scenes.forEach((s) => {
      const want = Number(own[s.id]) > 0 ? Number(own[s.id]) : s.base * k;
      s.dur = Math.min(s.max, Math.max(s.min, want));
      // still = giây (trong cảnh) muộn nhất mà mọi thứ còn hiện đủ — chỗ đứng khi dừng để sửa/chụp ảnh.
      s.still = Math.max(0, s.dur - s.out - 0.05);
      P.starts.push(P.total);
      P.total += s.dur;
    });
    return P;
  }

  const _outOf = (el) => Math.max(el.anim?.out || 0, ...(el.kids || []).map(_outOf));
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
    // Cảnh khai `nofx` (nhiều chữ cần đọc) thì bỏ lớp đốm sáng phủ slide.
    // Chạy vòng: đốm sáng tuần hoàn đúng theo cả vòng, chỗ nối vòng không giật.
    if (P.fx?.sparkle && !P.scenes[i].nofx) _sparkle(ctx, { x: 0, y: 0, w: P.W, h: P.H, ...P.fx.sparkle }, t, o.loop ? P.total : 0);
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
    // Mốc đầu cảnh đang vẽ: phần tử cần giờ chung của cả vòng (bầu trời `sky`) cộng với lt.
    P._t0 = P.starts[i];
    ctx.save();
    // Đang chuyển cảnh (trượt/phóng): cắt theo khung của chính cảnh, không thì phần tử to hơn
    // khung (quầng sáng, vòng sóng) tràn sang màn rồi biến mất đột ngột lúc chuyển xong.
    if (pre) {
      pre(ctx);
      ctx.beginPath();
      ctx.rect(0, 0, P.W, P.H);
      ctx.clip();
    }
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
    // anim.out (giây): mờ dần trong quãng cuối cảnh — mẫu một cảnh chạy vòng thì chữ tan đi rồi mới
    // hiện lại từ đầu, không biến mất đột ngột ở chỗ nối vòng.
    if (a?.out && dur) ctx.globalAlpha *= _ease(_clamp((dur - lt) / a.out));
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
        if (k === "wipe" || k === "reveal" || k === "draw") p = _easeIO(raw);
        else if (a.back) p = raw >= 1 ? 1 : _back(raw, a.back);
        else if (k === "fly" || k === "flip") p = _glide(raw);
        else p = _ease(raw);
        if (k === "fly" || k === "flip") ctx.globalAlpha *= _clamp(raw * 4);
        else if (k === "zoom") ctx.globalAlpha *= a.keep ? 1 : _clamp(raw * 2.5);
        else if (k !== "wipe" && k !== "reveal" && k !== "draw") ctx.globalAlpha *= p;
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
      _draw(ctx, P, el, lt, dur, lsAdd, a?.k === "draw" ? p : 1);
    }
    ctx.restore();
  }

  function _draw(ctx, P, el, lt, dur, lsAdd, prog) {
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
      case "orb":
        _orb(ctx, el, lt, dur);
        break;
      case "stroke":
        _stroke(ctx, el, prog ?? 1);
        break;
      case "sky":
        _sky(ctx, P, el, lt, dur);
        break;
      case "beams":
        _beams(ctx, P, el, lt, dur);
        break;
      case "waves":
        _waves(ctx, P, el, lt, dur);
        break;
      case "drift":
        _drift(ctx, P, el, lt, dur);
        break;
      case "rings":
        _rings(ctx, P, el, lt, dur);
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
    // shadowBlur tính theo điểm ảnh canvas, không ăn theo phép phóng → nhân tỉ lệ cho bản 4K
    // ra đúng như bản xem.
    if (el.shadow) {
      ctx.shadowColor = el.shadow;
      ctx.shadowBlur = el.font.size * 0.5 * ctx.getTransform().a;
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
  // el.shape cắt ảnh theo hình: "circle" (elip nội tiếp khung) · "arch" (vòm, đỉnh bán nguyệt) ·
  // "chamfer" (vát bốn góc `cut` px); el.radius = bo góc.
  function _image(ctx, img, el, lt, dur) {
    if (!el.shape && !el.radius) return _imageRect(ctx, img, el, lt, dur);
    ctx.save();
    _shapePath(ctx, el);
    ctx.clip();
    _imageRect(ctx, img, el, lt, dur);
    ctx.restore();
  }
  function _shapePath(ctx, el) {
    const { x, y, w, h } = el;
    ctx.beginPath();
    if (el.shape === "circle") ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
    else if (el.shape === "arch") {
      const r = Math.min(w / 2, h);
      ctx.moveTo(x, y + h);
      ctx.lineTo(x, y + r);
      ctx.arc(x + w / 2, y + r, w / 2, Math.PI, 0);
      ctx.lineTo(x + w, y + h);
      ctx.closePath();
    } else if (el.shape === "chamfer") {
      const c = Math.min(el.cut ?? 24, w / 2, h / 2);
      ctx.moveTo(x + c, y);
      ctx.lineTo(x + w - c, y);
      ctx.lineTo(x + w, y + c);
      ctx.lineTo(x + w, y + h - c);
      ctx.lineTo(x + w - c, y + h);
      ctx.lineTo(x + c, y + h);
      ctx.lineTo(x, y + h - c);
      ctx.lineTo(x, y + c);
      ctx.closePath();
    } else if (el.radius && ctx.roundRect) ctx.roundRect(x, y, w, h, el.radius);
    else ctx.rect(x, y, w, h);
  }
  function _imageRect(ctx, img, el, lt, dur) {
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

  // Quầng sáng mềm (tâm x, y, bán kính r, màu color) trôi chậm theo vòng elip dx/dy (px), thở nhẹ
  // theo `pulse`. Chu kỳ mặc định = thời lượng cảnh nên cuối cảnh quầng về đúng chỗ cũ — cảnh kế
  // dùng cùng quầng thì lúc chuyển cảnh không thấy hai quầng.
  function _orb(ctx, el, t, dur) {
    const a = (t / (el.period || dur || 18)) * Math.PI * 2 + (el.phase || 0);
    const x = el.x + Math.cos(a) * (el.dx ?? 60);
    const y = el.y + Math.sin(a) * (el.dy ?? 30);
    const r = el.r * (1 + (el.pulse ?? 0.06) * Math.sin(a * 2));
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, el.color);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
    ctx.restore();
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
  // period > 0: làm tròn mọi nhịp (trôi, lắc, nhấp nháy) cho khớp đúng chu kỳ đó.
  function _sparkle(ctx, el, t, period) {
    const lap = (f, span) => (period ? (span * Math.max(1, Math.round((f * period) / span))) / period : f);
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
      const speed = lap(6 + r(2) * 22, el.h);
      const ph = r(3) * Math.PI * 2;
      const y = el.y + ((((r(4) * el.h - t * speed) % el.h) + el.h) % el.h);
      const x = el.x + r(5) * el.w + Math.sin(t * lap(0.6, Math.PI * 2) + ph) * 14;
      const tw = 0.2 + 0.8 * (0.5 + 0.5 * Math.sin(t * lap(1.2 + r(6) * 2.4, Math.PI * 2) + ph));
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

  // Nét vẽ: paths = [[[x, y], …], …] (toạ độ mẫu), color, lw, glow (màu quầng sáng quanh nét).
  // p < 1 (hiệu ứng "draw") thì mỗi đường mới vẽ tới p độ dài của nó, đầu bút có đốm sáng.
  function _stroke(ctx, el, p) {
    const lens = (el._len ||= el.paths.map((pts) => pts.slice(1).reduce((n, q, i) => n + Math.hypot(q[0] - pts[i][0], q[1] - pts[i][1]), 0)));
    ctx.save();
    ctx.strokeStyle = el.color;
    ctx.lineWidth = el.lw || 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (el.glow) {
      ctx.shadowColor = el.glow;
      ctx.shadowBlur = (el.blur ?? 12) * ctx.getTransform().a;
    }
    // fill + fillPts (một đa giác khép kín): tô đặc bên trong, hiện dần theo tiến độ nét vẽ.
    if (el.fill && el.fillPts) {
      const a = ctx.globalAlpha;
      ctx.globalAlpha = a * p * p;
      ctx.fillStyle = el.fill;
      ctx.beginPath();
      el.fillPts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = a;
    }
    const heads = [];
    el.paths.forEach((pts, k) => {
      let left = lens[k] * p;
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length && left > 0; i++) {
        const [x0, y0] = pts[i - 1];
        const seg = Math.hypot(pts[i][0] - x0, pts[i][1] - y0);
        const f = seg > left ? left / seg : 1;
        const x = x0 + (pts[i][0] - x0) * f;
        const y = y0 + (pts[i][1] - y0) * f;
        ctx.lineTo(x, y);
        left -= seg;
        if (left <= 0) heads.push([x, y]);
      }
      ctx.stroke();
    });
    if (p < 1) {
      ctx.shadowBlur = 0;
      const r = (el.lw || 2) * 5;
      heads.forEach(([x, y]) => ctx.drawImage(_glow(), x - r, y - r, r * 2, r * 2));
    }
    ctx.restore();
  }

  // Bầu trời đêm có dải ngân hà, phủ khung {x, y, w, h} (mặc định cả slide). Lớp TĨNH (nền, mây
  // sáng dọc dải, vệt bụi tối, sao li ti) vẽ một lần ra canvas riêng theo cỡ canvas đang vẽ; mỗi
  // khung chỉ vẽ thêm `n` sao sáng lấp lánh. Nhịp lấp lánh làm tròn theo thời lượng cảnh nên các
  // cảnh dùng chung một bầu trời thì lúc chuyển cảnh nền đứng yên. base: false = chỉ lớp sao sáng.
  // band = {x, y, angle (độ), width, core (0–1 dọc dải: chỗ sáng nhất)}; tint = {warm, cool, rose}.
  const _skies = new Map();
  function _skyLayer(P, el, k) {
    const key = `${k}|${JSON.stringify([el.seed, el.x, el.y, el.w, el.h, el.bg, el.dust, el.band, el.tint, el.nebula, el.bulge])}`;
    if (_skies.has(key)) return _skies.get(key);
    const X = el.x || 0;
    const Y = el.y || 0;
    const w = el.w || P.W;
    const h = el.h || P.H;
    const cv = document.createElement("canvas");
    cv.width = Math.max(1, Math.round(w * k));
    cv.height = Math.max(1, Math.round(h * k));
    const c = cv.getContext("2d");
    c.scale(k, k);
    c.fillStyle = el.bg || "#000";
    c.fillRect(0, 0, w, h);
    const seed = (el.seed || 1) * 7919;
    let n = 0;
    const r = () => _rnd(seed + n++ * 1.618);
    const gauss = () => Math.sqrt(-2 * Math.log(Math.max(1e-6, r()))) * Math.cos(2 * Math.PI * r());
    const B = { x: X + w / 2, y: Y + h / 2, angle: -24, width: 110, core: 0.6, ...el.band };
    const ux = Math.cos((B.angle * Math.PI) / 180);
    const uy = Math.sin((B.angle * Math.PI) / 180);
    const span = Math.hypot(w, h) * 1.2;
    const uc = (B.core - 0.5) * span;
    const at = (u, v) => [B.x - X + ux * u - uy * v, B.y - Y + uy * u + ux * v];
    const T = { warm: "236, 216, 184", cool: "122, 144, 206", rose: "206, 142, 172", ...el.tint };
    const blob = (x, y, rad, rgb, a) => {
      const g = c.createRadialGradient(x, y, 0, x, y, rad);
      g.addColorStop(0, `rgba(${rgb}, ${a})`);
      g.addColorStop(1, `rgba(${rgb}, 0)`);
      c.fillStyle = g;
      c.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    };
    const W0 = B.width;
    // Mây sáng dọc dải: lõi ấm, rìa lạnh, điểm hồng; càng gần lõi càng sáng. nebula: false = bỏ
    // mây + vệt bụi, dải chỉ còn là sao dồn dày · bulge: false = bỏ cụm sáng to ở lõi, mây sáng
    // đều dọc dải (chỉ còn các mảng nhỏ).
    const neb = el.nebula !== false;
    const bulge = el.bulge !== false;
    c.globalCompositeOperation = "lighter";
    for (let i = 0; neb && i < 120; i++) {
      const u = (r() - 0.5) * span;
      const v = gauss() * W0 * 0.55;
      const lit = bulge ? 0.45 + 0.55 * Math.exp(-(((u - uc) / (span * 0.2)) ** 2)) : 0.6;
      const pick = r();
      const rgb = Math.abs(v) < W0 * 0.4 && pick < 0.7 ? T.warm : pick < 0.85 ? T.cool : T.rose;
      const [x, y] = at(u, v);
      blob(x, y, W0 * (0.5 + r() * 1.1), rgb, (0.03 + r() * 0.035) * lit);
    }
    for (let i = 0; neb && bulge && i < 22; i++) {
      const [x, y] = at(uc + gauss() * span * 0.06, gauss() * W0 * 0.3);
      blob(x, y, W0 * (0.5 + r() * 0.8), T.warm, 0.045 + r() * 0.04);
    }
    // Sao li ti: phần lớn dồn theo dải, phần còn lại rải khắp trời.
    const tiny = (cnt, inBand) => {
      for (let i = 0; i < cnt; i++) {
        const [x, y] = inBand ? at((r() - 0.5) * span, gauss() * W0 * 0.7) : [r() * w, r() * h];
        const rad = 0.25 + r() ** 3 * 0.85;
        const tone = r();
        const rgb = tone < 0.7 ? "255, 255, 255" : tone < 0.86 ? "255, 236, 212" : "206, 220, 255";
        c.fillStyle = `rgba(${rgb}, ${0.25 + r() * 0.65})`;
        c.beginPath();
        c.arc(x, y, rad, 0, Math.PI * 2);
        c.fill();
      }
    };
    c.globalCompositeOperation = "source-over";
    const dust = el.dust ?? 2600;
    tiny(Math.round(dust * 0.62), true);
    tiny(Math.round(dust * 0.3), false);
    // Vệt bụi tối uốn lượn dọc giữa dải (che bớt mây + sao phía sau).
    const s1 = r() * 6;
    const s2 = r() * 6;
    for (let i = 0; neb && i < 170; i++) {
      const u = (r() - 0.5) * span;
      if (r() < 0.3) continue;
      const v = W0 * (0.12 * Math.sin(u / 170 + s1) + 0.07 * Math.sin(u / 61 + s2)) + gauss() * W0 * 0.06;
      const [x, y] = at(u, v);
      blob(x, y, W0 * (0.08 + r() * 0.22), "0, 0, 0", 0.5);
    }
    tiny(Math.round(dust * 0.08), false);
    if (_skies.size >= 4) _skies.delete(_skies.keys().next().value);
    _skies.set(key, cv);
    return cv;
  }
  // Lớp động tính theo giờ CHUNG của cả vòng (mốc cảnh + t, lấy dư theo P.total) chứ không theo
  // giờ trong cảnh: sao trôi + sao băng chạy liền qua mọi cảnh, cảnh trước và cảnh sau lúc chuyển
  // cảnh vẽ trùng khít, chỗ nối vòng cũng vậy. Mọi chuyển động tròn đúng số vòng trong P.total.
  // drift = số px/giây sao sáng trôi sang trái (tầng gần trôi gấp đôi) · meteors = số giây trung
  // bình giữa hai sao băng (0 = không có).
  function _sky(ctx, P, el, t, dur) {
    const X = el.x || 0;
    const Y = el.y || 0;
    const w = el.w || P.W;
    const h = el.h || P.H;
    if (el.base !== false) ctx.drawImage(_skyLayer(P, el, ctx.canvas.width / P.W), X, Y, w, h);
    const T = P.total || el.period || dur || 16;
    const gt = ((((P._t0 || 0) + t) % T) + T) % T;
    const seed = (el.seed || 1) * 104729;
    const dot = _glow();
    const base = ctx.globalAlpha;
    ctx.save();
    ctx.beginPath();
    ctx.rect(X, Y, w, h);
    ctx.clip();
    // Sao sáng: rải đều, trôi ngang rồi quay vòng ngoài mép (lề m nên không thấy lúc nhảy).
    const m = 40;
    const lapW = w + m * 2;
    const laps = Math.max(1, Math.round(((el.drift ?? 18) * T) / lapW));
    for (let k = 0; k < (el.n ?? 160); k++) {
      const q = (n) => _rnd(seed + k * 31 + n);
      const near = q(10) > 0.7;
      const dx = (gt / T) * lapW * laps * (near ? 2 : 1);
      const x = X - m + ((((q(2) * lapW - dx) % lapW) + lapW) % lapW);
      const y = Y + q(3) * h;
      const s = (0.9 + q(4) ** 3 * 2.6) * (near ? 1.2 : 1);
      const cyc = Math.max(1, Math.round((0.15 + q(5) * 0.5) * T));
      const tw = 1 - (0.25 + q(6) * 0.4) * (0.5 + 0.5 * Math.sin((gt / T) * cyc * Math.PI * 2 + q(7) * 6.283));
      ctx.globalAlpha = base * (0.5 + 0.5 * q(8)) * tw;
      const R = s * 2.6;
      ctx.drawImage(dot, x - R, y - R, R * 2, R * 2);
      // Vài sao sáng nhất có tia mảnh hai trục.
      if (q(9) > 0.95) {
        const L = s * 7 * tw;
        const th = s * 0.5;
        ctx.drawImage(dot, x - L, y - th / 2, L * 2, th);
        ctx.drawImage(dot, x - th / 2, y - L, th, L * 2);
      }
    }
    // Sao băng: chia vòng thành từng ô thời gian, mỗi ô một vệt ở thời điểm + chỗ + hướng ngẫu
    // nhiên (theo seed). Vệt thuôn nhọn về đuôi, đầu có đốm sáng, lao nhanh rồi chậm dần và tắt.
    const gap = el.meteors ?? 0;
    const cnt = gap > 0 ? Math.max(1, Math.round(T / gap)) : 0;
    for (let k = 0; k < cnt; k++) {
      const q = (n) => _rnd(seed + 7 + k * 53 + n);
      const life = 0.9 + q(1) * 0.6;
      const slot = T / cnt;
      const at = gt - (k * slot + q(2) * Math.max(0, slot - life));
      if (at < 0 || at > life) continue;
      const p = at / life;
      const ang = ((q(3) < 0.5 ? 150 : 30) + (q(4) - 0.5) * 30) * (Math.PI / 180);
      const vx = Math.cos(ang);
      const vy = Math.sin(ang);
      const travel = 260 + q(5) * 220;
      const go = 1 - Math.pow(1 - p, 2);
      const hx = X + w * (0.12 + q(6) * 0.76) + vx * travel * go;
      const hy = Y + h * (0.05 + q(7) * 0.4) + vy * travel * go;
      const tail = (120 + q(8) * 160) * Math.min(1, p * 4) * (1 - p * 0.5);
      const a = Math.min(1, p * 6) * (1 - p) ** 1.5;
      const tx = hx - vx * tail;
      const ty = hy - vy * tail;
      const g = ctx.createLinearGradient(tx, ty, hx, hy);
      g.addColorStop(0, "rgba(255, 255, 255, 0)");
      g.addColorStop(1, `rgba(255, 246, 228, ${0.9 * a})`);
      const wd = 1.6;
      ctx.globalAlpha = base;
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(hx - vy * wd, hy + vx * wd);
      ctx.lineTo(hx + vy * wd, hy - vx * wd);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = base * a;
      ctx.drawImage(dot, hx - 7, hy - 7, 14, 14);
    }
    ctx.restore();
    ctx.globalAlpha = base;
  }

  // ── Chuyển động nền chạy suốt vòng (beams · waves · drift · rings) ──
  // Cùng nguyên tắc với `sky`: tính theo giờ CHUNG của cả vòng, mọi nhịp làm tròn thành số vòng
  // nguyên trong P.total → cảnh trước/sau lúc chuyển cảnh vẽ trùng khít, chỗ nối vòng không giật.
  // Màu khai dạng "r, g, b" (rgb) để tự pha độ trong. Khung {x, y, w, h} mặc định cả slide.
  function _clock(P, el, t, dur) {
    const T = P.total || el.period || dur || 16;
    return [T, ((((P._t0 || 0) + t) % T) + T) % T];
  }
  const _laps = (T, sec) => Math.max(1, Math.round(T / Math.max(0.1, sec)));
  const _wave = (T, gt, sec, ph) => Math.sin((2 * Math.PI * _laps(T, sec) * gt) / T + (ph || 0));
  const _area = (P, el) => [el.x || 0, el.y || 0, el.w || P.W, el.h || P.H];

  // Đèn sân khấu: n luồng sáng hình nón rọi từ mép trên (from: "bottom" = từ dưới lên), chụm dần
  // về giữa theo `lean` (độ) và lắc qua lại `sway` độ mỗi `period` giây. spread = độ mở của nón ·
  // len = độ dài luồng · rgb = một màu hoặc mảng màu xoay vòng · alpha · flare = cỡ đốm chói ở gốc.
  function _beams(ctx, P, el, t, dur) {
    const [T, gt] = _clock(P, el, t, dur);
    const [X, Y, w, h] = _area(P, el);
    const n = el.n ?? 5;
    const up = el.from === "bottom";
    const len = el.len ?? h * 1.3;
    const half = ((el.spread ?? 14) * Math.PI) / 360;
    const rgbs = [].concat(el.rgb || "255, 255, 255");
    const seed = (el.seed || 1) * 7717;
    const base = ctx.globalAlpha;
    ctx.save();
    ctx.beginPath();
    ctx.rect(X, Y, w, h);
    ctx.clip();
    ctx.globalCompositeOperation = "lighter";
    for (let k = 0; k < n; k++) {
      const q = (m) => _rnd(seed + k * 13 + m);
      const ox = X + (w * (k + 0.5)) / n;
      const oy = up ? Y + h + 8 : Y - 8;
      const lean = (el.lean ?? 22) * (0.5 - (k + 0.5) / n) * 2;
      const sway = (el.sway ?? 14) * _wave(T, gt, (el.period ?? 10) * (0.7 + q(1) * 0.6), q(2) * 6.283);
      const a = (((up ? -90 + lean : 90 - lean) + sway) * Math.PI) / 180;
      const ux = Math.cos(a);
      const uy = Math.sin(a);
      const ex = ox + ux * len;
      const ey = oy + uy * len;
      const rgb = rgbs[k % rgbs.length];
      const A0 = (el.alpha ?? 0.25) * (0.8 + 0.2 * _wave(T, gt, 5 + q(3) * 4, q(4) * 6.283));
      const g = ctx.createLinearGradient(ox, oy, ex, ey);
      g.addColorStop(0, `rgba(${rgb}, 1)`);
      g.addColorStop(0.5, `rgba(${rgb}, 0.35)`);
      g.addColorStop(1, `rgba(${rgb}, 0)`);
      ctx.fillStyle = g;
      // Ba lớp nón lồng nhau (rộng → hẹp) cho rìa luồng sáng mềm, lõi sáng hơn.
      [[1, 0.35], [0.6, 0.35], [0.25, 0.5]].forEach(([f, k2]) => {
        const r0 = (el.w0 ?? 6) * f;
        const r1 = len * Math.tan(half * f);
        ctx.globalAlpha = base * A0 * k2;
        ctx.beginPath();
        ctx.moveTo(ox - uy * r0, oy + ux * r0);
        ctx.lineTo(ex - uy * r1, ey + ux * r1);
        ctx.lineTo(ex + uy * r1, ey - ux * r1);
        ctx.lineTo(ox + uy * r0, oy - ux * r0);
        ctx.closePath();
        ctx.fill();
      });
      const R = el.flare ?? 46;
      if (R) {
        ctx.globalAlpha = base * Math.min(1, A0 * 2.4);
        ctx.drawImage(_glow(), ox - R, oy - R, R * 2, R * 2);
      }
    }
    ctx.restore();
    ctx.globalAlpha = base;
  }

  // Dải sóng sáng: n đường mảnh chạy song song qua giữa khung, uốn theo hai sóng sin chồng nhau và
  // trôi ngang liên tục. len = bước sóng (px) · amp = biên độ · spread = độ xoè của bó đường ·
  // speed = px/giây · rgb = một màu, hoặc mảng màu đổ dần từ trái sang phải · alpha · lw.
  function _waves(ctx, P, el, t, dur) {
    const [T, gt] = _clock(P, el, t, dur);
    const [X, Y, w, h] = _area(P, el);
    const n = el.n ?? 12;
    const len = el.len ?? 760;
    const amp = el.amp ?? h * 0.22;
    const spread = el.spread ?? h * 0.35;
    const speed = el.speed ?? 24;
    const p1 = (2 * Math.PI * _laps(T, len / speed) * gt) / T;
    const p2 = (2 * Math.PI * _laps(T, (len * 0.6) / (speed * 0.7)) * gt) / T;
    const rgbs = [].concat(el.rgb || "255, 255, 255");
    const g = ctx.createLinearGradient(X, 0, X + w, 0);
    rgbs.forEach((c, i) => g.addColorStop(rgbs.length > 1 ? i / (rgbs.length - 1) : 0, `rgba(${c}, 1)`));
    const base = ctx.globalAlpha;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = g;
    ctx.lineWidth = el.lw ?? 1.4;
    ctx.lineJoin = "round";
    const step = 10;
    for (let k = 0; k < n; k++) {
      const f = n > 1 ? k / (n - 1) : 0.5;
      ctx.globalAlpha = base * (el.alpha ?? 0.5) * (0.25 + 0.75 * Math.sin(Math.PI * f));
      ctx.beginPath();
      for (let x = 0; x <= w + step; x += step) {
        const env = 0.35 + 0.65 * Math.sin(Math.PI * Math.min(1, x / w));
        const s1 = Math.sin((2 * Math.PI * x) / len + p1 + f * (el.twist ?? 1.6));
        const s2 = Math.sin((2 * Math.PI * x) / (len * 0.6) - p2 + f * 2.3);
        const fan = (f - 0.5) * spread * (0.55 + 0.45 * Math.sin((2 * Math.PI * x) / (len * 1.7) + p1));
        const y = Y + h / 2 + fan + amp * env * (0.62 * s1 + 0.38 * s2);
        if (x) ctx.lineTo(X + x, y);
        else ctx.moveTo(X, y);
      }
      ctx.stroke();
    }
    ctx.restore();
    ctx.globalAlpha = base;
  }

  // Hạt rơi (dir: "up" = bay lên): n hạt, vừa rơi vừa lắc ngang `sway` px, xoay và lật (co bề
  // ngang) cho có chiều sâu. shape: "rect" (giấy confetti) · "diamond" · "petal" · "dot" ·
  // color = một màu hoặc mảng màu · size (px) · speed (px/giây) · alpha.
  function _drift(ctx, P, el, t, dur) {
    const [T, gt] = _clock(P, el, t, dur);
    const [X, Y, w, h] = _area(P, el);
    const n = el.n ?? 60;
    const size = el.size ?? 10;
    const m = size * 3;
    const span = h + m * 2;
    const cols = [].concat(el.color || "#fff");
    const up = el.dir === "up";
    const shape = el.shape || "rect";
    const seed = (el.seed || 1) * 3571;
    const base = ctx.globalAlpha;
    ctx.save();
    ctx.beginPath();
    ctx.rect(X, Y, w, h);
    ctx.clip();
    for (let k = 0; k < n; k++) {
      const q = (i) => _rnd(seed + k * 29 + i);
      const s = size * (0.5 + q(1) * 0.9);
      const laps = _laps(T, span / ((el.speed ?? 50) * (0.6 + q(2) * 0.8)));
      const prog = (q(3) + (laps * gt) / T) % 1;
      const y = up ? Y + h + m - prog * span : Y - m + prog * span;
      const x = X + q(4) * w + (el.sway ?? 30) * _wave(T, gt, 3 + q(5) * 4, q(6) * 6.283);
      const rot = (q(8) < 0.5 ? 1 : -1) * ((2 * Math.PI * _laps(T, 4 + q(7) * 6) * gt) / T) + q(9) * 6.283;
      const flip = _wave(T, gt, 1.5 + q(10) * 2.5, q(11) * 6.283);
      ctx.globalAlpha = base * (el.alpha ?? 0.85) * (0.55 + 0.45 * q(12));
      ctx.fillStyle = cols[k % cols.length];
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      if (shape !== "dot") ctx.scale(Math.abs(flip) < 0.06 ? 0.06 : flip, 1);
      ctx.beginPath();
      if (shape === "dot") ctx.arc(0, 0, s / 2, 0, Math.PI * 2);
      else if (shape === "petal") ctx.ellipse(0, 0, s / 2, s * 0.28, 0, 0, Math.PI * 2);
      else if (shape === "diamond") {
        ctx.moveTo(0, -s / 2);
        ctx.lineTo(s * 0.32, 0);
        ctx.lineTo(0, s / 2);
        ctx.lineTo(-s * 0.32, 0);
        ctx.closePath();
      } else ctx.rect(-s / 2, -s * 0.22, s, s * 0.44);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
    ctx.globalAlpha = base;
  }

  // Vòng sóng lan: n vòng tròn mảnh nối đuôi nhau nở từ bán kính r0 tới r1 quanh tâm (x, y) rồi tan,
  // mỗi vòng đi hết một lượt trong `period` giây. rgb · alpha · lw.
  function _rings(ctx, P, el, t, dur) {
    const [T, gt] = _clock(P, el, t, dur);
    const n = el.n ?? 3;
    const cyc = _laps(T, el.period ?? 6);
    const r0 = el.r0 ?? 0;
    const r1 = el.r1 ?? 400;
    const base = ctx.globalAlpha;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = `rgba(${el.rgb || "255, 255, 255"}, 1)`;
    ctx.lineWidth = el.lw ?? 1.5;
    for (let k = 0; k < n; k++) {
      const p = ((gt / T) * cyc + k / n) % 1;
      ctx.globalAlpha = base * (el.alpha ?? 0.5) * Math.min(1, p * 6) * (1 - p) ** 1.6;
      ctx.beginPath();
      ctx.arc(el.x, el.y, r0 + (r1 - r0) * _ease(p), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
    ctx.globalAlpha = base;
  }

  return { build, retime, frame, indexAt, column, wrap, fontStr, typeTime, bounds };
})();
