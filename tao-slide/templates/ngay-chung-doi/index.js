// Slide sân khấu "Mẫu 01" (ngay-chung-doi): nền trắng tối giản, ẢNH LÀ CHÍNH — 20 cảnh, 60 ô ảnh, chữ chỉ
// một cụm ngắn hoặc không có; cành lá nét chì tự vẽ dần, ảnh in viền trắng đổ bóng. Ba tỉ lệ:
// 16:9 (1280×720, mặc định), vuông 1:1 (1080×1080, `?ratio=1x1`) và dọc 9:16 (1080×1920, `?ratio=9x16`)
// — cảnh mỗi tỉ lệ giữ ĐÚNG khoá chữ + số ô ảnh của cảnh 16:9 cùng id, ảnh/chữ khách sửa dùng chung.
// Chỉ KHAI cảnh (CX_SLIDE.scenes); vẽ/chạy/xuất là việc của engine + runtime.

(function () {
  const RT = new URLSearchParams(location.search).get("ratio");
  const SQ = RT === "1x1";
  const TALL = RT === "9x16";
  const W = SQ || TALL ? 1080 : 1280;
  const H = TALL ? 1920 : SQ ? 1080 : 720;
  const C = {
    paper: "#FFFFFF",
    cream: "#FBF6EE",
    brown: "#6B4B33",
    ink: "#2E2B29",
    grey: "#5F5C5A",
    quote: "#A6A29E",
    white: "#FFFFFF",
    empty: "#EEECEA",
    sketch: "#ABA39A",
    vine: "#A9B49B",
    petal: "#F7CFD8",
    petalLine: "#E39AAE",
    drop: "rgba(40, 32, 28, 0.22)",
    shade: "rgba(30, 24, 20, 0.45)",
  };
  const CG = '"Cormorant Garamond", "Times New Roman", serif';
  const PF = '"Playfair Display", "Times New Roman", serif';
  const GV = '"Pinyon Script", cursive';
  // Khung dọc xem trên điện thoại là chính nên chữ to hơn một bậc.
  const K = TALL ? 1.3 : 1;
  const F = {
    title: { family: CG, size: 66, weight: 300 },
    titleS: { family: CG, size: 40, weight: 400 },
    serif: { family: PF, size: 62 },
    serifS: { family: PF, size: 64 },
    italic: { family: PF, size: 22, style: "italic" },
    quote: { family: CG, size: 40, weight: 300 },
    quoteL: { family: CG, size: 50, weight: 300 },
    script: { family: GV, size: 66 },
    scriptL: { family: GV, size: 88 },
    small: { family: CG, size: 22, weight: 400 },
  };
  Object.values(F).forEach((f) => (f.size = Math.round(f.size * K)));
  // Nhịp trễ: 1 = 0.15 giây.
  const A = (k, n, o) => ({ k, d: n * 0.15, ...o });
  const caps = (font, color, o) => ({ font, color, lh: 1.15, caps: true, ls: 4, ...o });

  window.CX_SLIDE = {
    id: "ngay-chung-doi",
    w: W,
    h: H,
    bg: C.paper,
    fade: 1,
    demo: "anh-sang-doi-ta",
    fonts: [`300 66px ${CG}`, `400 40px ${CG}`, `400 62px ${PF}`, `italic 400 22px ${PF}`, `400 66px ${GV}`],
    scenes: buildScenes,
  };

  const _day = (s) => (s ? new Date(s + "T00:00:00") : null);
  const _pad = (n) => String(n).padStart(2, "0");

  // Kho ảnh: album của thiệp quay vòng (thiếu ảnh thì lặp lại); album rỗng thì lấy ảnh bìa,
  // ảnh cô dâu/chú rể, ảnh chuyện tình.
  function _pool(w) {
    const fps = w.image_focal_points || {};
    const one = (field) => (w[field] ? { file: w[field], fp: fps[field] } : null);
    let all = (Array.isArray(w.gallery_images) ? w.gallery_images : [])
      .filter(Boolean)
      .map((file) => ({ file, fp: fps.gallery_images?.[file] }));
    if (!all.length) {
      const story = (Array.isArray(w.love_story) ? w.love_story : [])
        .filter((ev) => ev?.image_url)
        .map((ev) => ({ file: ev.image_url, fp: ev.focal_point }));
      all = [one("cover_image_url"), one("bride_image_url"), one("groom_image_url"), ...story].filter(Boolean);
    }
    let at = 0;
    const next = () => (all.length ? all[at++ % all.length] : { file: "", fp: null });
    return { next, own: (field) => one(field) || next() };
  }

  // ── Nét trang trí (toạ độ mẫu, vẽ bằng phần tử "stroke") ──
  const _rad = (deg) => (deg * Math.PI) / 180;
  // Lá hình hạt: gốc (x, y), hướng ang, dài len, rộng wid → đường viền khép kín + gân giữa.
  function _leaf(x, y, ang, len, wid) {
    const ux = Math.cos(_rad(ang));
    const uy = Math.sin(_rad(ang));
    const side = (sg) =>
      Array.from({ length: 11 }, (_, i) => {
        const u = i / 10;
        const off = Math.sin(Math.PI * u) * wid * sg;
        return [x + ux * len * u - uy * off, y + uy * len * u + ux * off];
      });
    const out = [...side(1), ...side(-1).reverse()];
    return [out, [[x, y], [x + ux * len * 0.8, y + uy * len * 0.8]]];
  }
  // Cành lá: thân cong từ (x, y) theo góc ang, dài len; lá so le hai bên, nhỏ dần về ngọn.
  function _sprig(x, y, ang, len, o = {}) {
    const ux = Math.cos(_rad(ang));
    const uy = Math.sin(_rad(ang));
    const bend = (o.bend ?? 0.12) * len;
    const at = (t) => {
      const off = Math.sin(t * Math.PI) * bend;
      return [x + ux * len * t - uy * off, y + uy * len * t + ux * off];
    };
    const paths = [Array.from({ length: 25 }, (_, i) => at(i / 24))];
    const n = o.leaves ?? 9;
    const marks = [];
    for (let i = 0; i < n; i++) {
      const t = 0.12 + (0.84 * i) / Math.max(1, n - 1);
      const [px, py] = at(t);
      const [qx, qy] = at(Math.min(1, t + 0.02));
      const dir = (Math.atan2(qy - py, qx - px) * 180) / Math.PI;
      const sg = i % 2 ? 1 : -1;
      const size = len * (o.leaf ?? 0.17) * (1 - 0.45 * t);
      paths.push(..._leaf(px, py, dir + sg * 42, size, size * 0.3));
      marks.push([px, py]);
    }
    return { paths, marks, tip: at(1) };
  }
  // Bông hoa năm cánh (viền + tô), tâm (cx, cy), bán kính r, xoay rot (độ).
  function _flower(cx, cy, r, rot = 0) {
    const pts = Array.from({ length: 61 }, (_, i) => {
      const a = (i / 60) * Math.PI * 2;
      const rr = r * (0.38 + 0.62 * Math.pow(Math.abs(Math.cos(2.5 * a)), 0.7));
      return [cx + Math.cos(a + _rad(rot)) * rr, cy + Math.sin(a + _rad(rot)) * rr];
    });
    const dot = Array.from({ length: 9 }, (_, i) => {
      const a = (i / 8) * Math.PI * 2;
      return [cx + Math.cos(a) * r * 0.16, cy + Math.sin(a) * r * 0.16];
    });
    return { pts, dot };
  }

  // Một cảnh đang dựng. Mọi chữ qua S.t (khoá `<sid>.<tên>`, sửa ở "Chữ trong slide", sửa thành
  // rỗng là bỏ khối), mọi ảnh qua S.img (ô `<sid>.p<n>`, khách đổi ảnh riêng từng ô) — thêm chữ
  // hay ảnh không qua đây là chỗ đó không sửa được.
  function _stage(sid, label, L, pool) {
    const texts = [];
    const seen = new Set();
    const photos = [];
    const els = [];
    const S = {
      t(name, def, style) {
        const key = `${sid}.${name}`;
        const own = L.texts?.[key];
        const text = typeof own === "string" ? own : String(def ?? "");
        if (!seen.has(key)) {
          seen.add(key);
          texts.push({ key, text, def: String(def ?? "") });
        }
        return text.trim() ? { ...style, text, key } : null;
      },
      // rect còn nhận thuộc tính ảnh của engine: radius, mat, drop, alpha, kb.
      img(n, rect, anim, ph) {
        const key = `${sid}.p${n}`;
        const src0 = ph || pool.next();
        const def = src0.file ? getImageUrl(src0.file) : "";
        const mine = L.photos?.[key];
        photos.push({ key, def, w: rect.w, h: rect.h });
        const el = {
          type: "image", kb: "in", ...rect, src: mine?.src || def, focal: mine ? mine.focal : src0.fp,
          empty: C.empty, edit: key, anim,
        };
        els.push(el);
        return el;
      },
      // Bản mờ phóng to của ảnh `of` làm nền phía sau (cùng ô ảnh: khách đổi ảnh là đổi cả hai).
      echo(of, rect, anim) {
        els.splice(els.indexOf(of), 0, { ...of, kb: true, mat: 0, drop: null, ...rect, anim });
      },
      rect(x, y, w, h, fill, anim) {
        els.push({ type: "rect", x, y, w, h, fill, anim });
      },
      grad(x, y, w, h, from, to, anim) {
        els.push({ type: "grad", x, y, w, h, stops: [[0, from], [1, to]], anim: anim || A("fade", 4) });
      },
      col(blocks, x, w, top, bottom = top) {
        els.push(...L.column(blocks.filter(Boolean), { x, w, top, bottom }));
      },
      // Chữ vắt qua mép ảnh `box`: phần nằm trên ảnh đổi sang màu `inside`.
      knock(block, x, w, top, box, inside) {
        if (!block) return;
        L.column([block], { x, w, top, bottom: top }).forEach((el) => {
          els.push({ ...el, clip: { ...box, out: true } }, { ...el, color: inside, shadow: C.shade, clip: box });
        });
      },
      // Cành lá nét chì vẽ dần (gốc x, y; góc ang; dài len).
      sprig(x, y, ang, len, d, o) {
        const sp = _sprig(x, y, ang, len, o);
        els.push({ type: "stroke", paths: sp.paths, color: o?.color || C.sketch, lw: o?.lw || 1.4, anim: A("draw", d, { t: 2.8 }) });
        return sp;
      },
      // Dây hoa hồng phấn: cành xanh nhạt, hoa nở dọc thân và ở ngọn.
      vine(x, y, ang, len, d, at = [0.22, 0.48, 0.74, 1]) {
        const sp = S.sprig(x, y, ang, len, d, { color: C.vine, leaves: 7, leaf: 0.15, lw: 1.2 });
        at.forEach((t, k) => {
          const i = Math.round(t * (sp.marks.length - 1));
          const [fx, fy] = t >= 1 ? sp.tip : sp.marks[i];
          const r = t >= 1 ? 22 : 14 + (k % 2) * 4;
          const f = _flower(fx, fy, r, k * 23);
          els.push({ type: "stroke", paths: [f.pts, f.dot], fillPts: f.pts, fill: C.petal, color: C.petalLine, lw: 1, anim: A("draw", d + 6 + k * 2, { t: 1.6 }) });
        });
      },
      done(dur = 7, tr) {
        return { id: sid, dur, label, tr, texts, photos, els };
      },
    };
    return S;
  }

  function buildScenes(w, L) {
    const G = String(w.groom_name || "").trim() || "Chú rể";
    const B = String(w.bride_name || "").trim() || "Cô dâu";
    const pool = _pool(w);
    const cd = _day(w.ceremony_date);
    const date = cd ? `${_pad(cd.getDate())} . ${_pad(cd.getMonth() + 1)} . ${cd.getFullYear()}` : "";
    // Cảnh đăng ký theo id rồi dựng theo ORDER ở cuối — ô ảnh lấy từ kho theo đúng thứ tự chiếu.
    const lay = new Map();
    const add = (sid, label, fn) => lay.set(sid, [label, fn]);
    const print = { mat: 8, drop: C.drop };

    // ── Mở đầu: mảng kem trái, ảnh lớn, tiêu đề mảnh viết hoa, ảnh ngang nhỏ dưới ──
    add("open", "Mở đầu", (S) => {
      S.rect(0, 0, 640, H, C.cream, A("reveal", 0, { from: "left", t: 1.2 }));
      S.img(0, { x: 0, y: 72, w: 700, h: 576 }, A("fly", 2, { from: "left" }), pool.own("cover_image_url"));
      S.col(
        [
          S.t("title", "To new\nbeginnings", caps(F.title, C.brown, { ls: 3, anim: A("track", 7, { ls0: 30 }) })),
          S.t("sub", "My Love Story", { font: F.italic, color: C.ink, lh: 1.4, mt: 22, anim: A("fade", 12) }),
          date && S.t("date", date, { font: F.small, color: C.grey, lh: 1.4, ls: 3, mt: 6, anim: A("fade", 14) }),
        ],
        756, 500, 120,
      );
      S.img(1, { x: 758, y: 432, w: 452, h: 244 }, A("fly", 5, { from: "right" }));
      return S.done(8, "fade");
    });

    // Bố cục chỉ có ảnh, dùng hai lượt (lượt hai `flip` đổi hướng bay / lật trái phải) cho đủ 60 ô.
    // ── Bốn khung dọc thẳng hàng, cành lá phác chì ở hai góc trên ──
    const frames = (flip) => (S) => {
      S.sprig(-6, 96, -24, 300, 0, { leaf: 0.2 });
      S.sprig(36, -6, 62, 200, 2, { leaves: 7, leaf: 0.2 });
      S.sprig(1286, 96, 204, 300, 1, { leaf: 0.2 });
      S.sprig(1244, -6, 118, 200, 3, { leaves: 7, leaf: 0.2 });
      [0, 1, 2, 3].forEach((k) =>
        S.img(k, { x: 28 + k * 314, y: 92, w: 284, h: 572 }, A("fly", 2 + k * 2, { from: (k % 2) ^ flip ? "top" : "bottom" })),
      );
      return S.done(7, "slide");
    };

    // ── Ảnh dọc tràn mép trái, chữ ký giữa, hai ảnh so le, câu trích nhạt ──
    add("married", "Hạnh phúc", (S) => {
      S.img(0, { x: 0, y: 0, w: 482, h: H }, A("reveal", 0, { from: "left", t: 1.6, drift: 120 }));
      S.col([S.t("script", "We are happily\nmarried", { font: F.script, color: C.ink, lh: 1.05, align: "center", anim: A("wipe", 8, { t: 2.2 }) })], 510, 400, 86, 260);
      S.img(1, { x: 556, y: 300, w: 316, h: 368 }, A("fly", 3, { from: "bottom" }));
      S.img(2, { x: 915, y: 92, w: 317, h: 372 }, A("fly", 5, { from: "top" }));
      S.col(
        [S.t("quote", "“Our forever\nbegins\ntoday”", { font: F.quote, color: C.quote, lh: 1.05, align: "center", anim: A("lines", 12) })],
        915, 317, 494, 690,
      );
      return S.done(8, "fade");
    });

    // ── Ba ảnh lệch tầng, tiêu đề lớn góc dưới trái ──
    add("memory", "Kỷ niệm", (S) => {
      S.img(0, { x: 36, y: 0, w: 560, h: 556 }, A("fly", 0, { from: "top" }));
      S.img(1, { x: 616, y: 196, w: 316, h: 476 }, A("fly", 3, { from: "bottom" }));
      S.img(2, { x: 952, y: 18, w: 292, h: 470 }, A("fly", 5, { from: "right" }));
      S.col([S.t("title", "Our memories", caps(F.serif, C.grey, { ls: 2, anim: A("track", 8, { ls0: 24 }) }))], 44, 560, 594, 700);
      return S.done(7, "slide");
    });

    // ── Ảnh lớn + hai ảnh xếp chồng một bên, không chữ ──
    const duo = (flip) => (S) => {
      const big = flip ? 350 : 0;
      const side = flip ? 0 : 940;
      S.img(0, { x: big, y: 0, w: 930, h: H }, A("reveal", 0, { from: flip ? "right" : "left", t: 1.6, drift: 140 }));
      S.img(1, { x: side, y: 0, w: 340, h: 355 }, A("fly", 4, { from: flip ? "left" : "right" }));
      S.img(2, { x: side, y: 365, w: 340, h: 355 }, A("fly", 6, { from: flip ? "bl" : "br" }));
      return S.done(7, "split");
    };

    // ── Ba ảnh bo góc, dây hoa hồng phấn, chữ ký Just Married ──
    add("happy", "Just Married", (S) => {
      const r = { radius: 14 };
      S.img(0, { x: 50, y: 64, w: 316, h: 452, ...r }, A("fly", 1, { from: "left" }));
      S.img(1, { x: 420, y: 64, w: 316, h: 452, ...r }, A("fly", 3, { from: "top" }));
      S.img(2, { x: 792, y: 64, w: 438, h: 620, ...r }, A("fly", 5, { from: "right" }));
      S.vine(30, 330, -72, 260, 8);
      S.vine(760, 380, 118, 230, 10);
      S.col([S.t("script", "Just Married", { font: F.scriptL, color: C.ink, lh: 1.1, align: "center", anim: A("wipe", 9, { t: 2.4 }) })], 40, 706, 560, 700);
      return S.done(8, "fade");
    });

    // ── Ảnh dọc trái; phải là bản mờ của ảnh in viền trắng, chữ dãn rộng dưới ──
    add("story", "A Love Story", (S) => {
      S.img(0, { x: 0, y: 0, w: 736, h: H }, A("zoom", 0, { s0: 1.25, t: 2.2, keep: true }));
      S.rect(736, 0, 10, H, C.paper);
      const inset = S.img(1, { x: 780, y: 92, w: 462, h: 450, ...print }, A("fly", 5, { from: "right" }));
      S.echo(inset, { x: 746, y: 0, w: 534, h: H, alpha: 0.3 }, A("fade", 2));
      S.col([S.t("title", "A love story", caps(F.titleS, C.grey, { ls: 8, align: "center", anim: A("track", 10, { ls0: 30 }) }))], 746, 534, 596, 680);
      return S.done(7, "slide-up");
    });

    // ── Hai ảnh dọc bo góc giữa hai mảng kem, không chữ ──
    const pair = (S) => {
      S.rect(0, 0, 418, H, C.cream, A("reveal", 0, { from: "top", t: 1.2 }));
      S.rect(988, 0, 292, H, C.cream, A("reveal", 0, { from: "bottom", t: 1.2 }));
      S.img(0, { x: 160, y: 76, w: 428, h: 568, radius: 10 }, A("fly", 3, { from: "left" }));
      S.img(1, { x: 692, y: 76, w: 428, h: 568, radius: 10 }, A("fly", 5, { from: "right" }));
      return S.done(7, "fade");
    };

    // ── Ảnh ngang lớn, tiêu đề vắt qua mép ảnh (phần trên ảnh thành chữ trắng) ──
    add("begin", "The Beginning", (S) => {
      const box = { x: 0, y: 36, w: 948, h: 648 };
      S.img(0, box, A("reveal", 0, { from: "left", t: 1.6, drift: 120 }));
      S.knock(S.t("title", "The\nbeginning", caps(F.serifS, C.ink, { ls: 1, lh: 1.2, anim: A("fade", 10) })), 840, 430, 196, box, C.white);
      S.col([S.t("sub", "My Love Story", { font: F.italic, color: C.ink, lh: 1.4, anim: A("fade", 14) })], 972, 280, 380);
      return S.done(7, "slide");
    });

    // ── Ảnh trái, câu trích giữa, ảnh in viền trắng đè lên ảnh phải ──
    add("forever", "Forever & together", (S) => {
      S.img(0, { x: 0, y: 0, w: 608, h: H }, A("reveal", 0, { from: "top", t: 1.6 }));
      S.img(1, { x: 930, y: 0, w: 350, h: H }, A("reveal", 2, { from: "bottom", t: 1.6 }));
      S.col([S.t("quote", "“Forever\n&\ntogether”", { font: F.quoteL, color: C.quote, lh: 1.05, align: "center", anim: A("lines", 6) })], 608, 322, 40, 280);
      S.img(2, { x: 634, y: 306, w: 388, h: 362, ...print, mat: 6 }, A("fly", 8, { from: "bottom" }));
      return S.done(8, "fade");
    });

    // ── Ba ảnh dọc chia đều cả khung, không chữ ──
    const trio = (flip) => (S) => {
      [0, 1, 2].forEach((k) =>
        S.img(k, { x: k * 430, y: 0, w: 420, h: H }, A("reveal", (flip ? 2 - k : k) * 3, { from: (k % 2) ^ flip ? "bottom" : "top", t: 1.4, drift: 80 })),
      );
      return S.done(7, "split");
    };

    // ── Lưới sáu ảnh ba cột hai hàng tràn khung, không chữ ──
    const grid = (S) => {
      [0, 1, 2, 3, 4, 5].forEach((k) => {
        const c = k % 3;
        const r = Math.floor(k / 3);
        S.img(k, { x: c * 430, y: r * 365, w: 420, h: 355 }, A("fly", 1 + k * 1.5, { from: r ? "bottom" : "top", s0: 0.9 }));
      });
      return S.done(8, "zoom");
    };

    // ── Năm ảnh: ảnh dọc lớn giữa, hai ảnh xếp chồng mỗi bên, không chữ ──
    const mosaic = (S) => {
      S.img(0, { x: 310, y: 0, w: 660, h: H }, A("zoom", 0, { s0: 1.2, t: 2.2 }));
      S.img(1, { x: 0, y: 0, w: 300, h: 355 }, A("fly", 4, { from: "left" }));
      S.img(2, { x: 0, y: 365, w: 300, h: 355 }, A("fly", 6, { from: "bl" }));
      S.img(3, { x: 980, y: 0, w: 300, h: 355 }, A("fly", 5, { from: "right" }));
      S.img(4, { x: 980, y: 365, w: 300, h: 355 }, A("fly", 7, { from: "br" }));
      return S.done(8, "fade");
    };

    // ── Ba ảnh, ảnh giữa nhô cao, chữ ký dưới; cành lá phác chì hai góc ──
    add("mine", "You are mine", (S) => {
      S.sprig(-6, 40, 30, 230, 0);
      S.sprig(1286, 40, 150, 230, 1);
      S.sprig(1100, -6, 100, 150, 2, { leaves: 6 });
      S.img(0, { x: 63, y: 114, w: 364, h: 549 }, A("fly", 2, { from: "left" }));
      S.img(1, { x: 458, y: 26, w: 364, h: 549 }, A("fly", 4, { from: "top" }));
      S.img(2, { x: 853, y: 114, w: 364, h: 549 }, A("fly", 6, { from: "right" }));
      S.col([S.t("script", "You are mine", { font: F.script, color: C.ink, lh: 1.1, align: "center", anim: A("wipe", 10, { t: 2 }) })], 440, 400, 588, 712);
      return S.done(7, "fade");
    });

    // ── Hai ảnh trên, tiêu đề vắt từ chân ảnh xuống nền trắng ──
    add("forever2", "Our Forever", (S) => {
      const box = { x: 28, y: 0, w: 716, h: 588 };
      S.img(0, box, A("fly", 0, { from: "left" }));
      S.img(1, { x: 762, y: 0, w: 490, h: 588 }, A("fly", 3, { from: "right" }));
      S.knock(S.t("title", "Our\nforever", caps(F.serifS, C.ink, { ls: 1, lh: 1.25, anim: A("fade", 9) })), 66, 600, 500, box, C.white);
      return S.done(7, "slide-up");
    });

    // ── Lời cảm ơn: ảnh tràn khung, hai ảnh in viền trắng bên trái, chữ ký góc phải ──
    add("thanks", "Lời cảm ơn", (S) => {
      S.img(0, { x: 0, y: 0, w: W, h: H, kb: true }, A("zoom", 0, { s0: 1.2, t: 2.4, keep: true }), pool.own("cover_image_url"));
      S.grad(0, 420, W, 300, "rgba(30,24,20,0)", "rgba(30,24,20,0.42)", A("fade", 3));
      S.img(1, { x: 40, y: 44, w: 300, h: 292, ...print, mat: 6 }, A("fly", 4, { from: "left" }));
      S.img(2, { x: 40, y: 380, w: 300, h: 296, ...print, mat: 6 }, A("fly", 6, { from: "bl" }));
      S.col(
        [
          S.t("script", "Thank you", { font: F.scriptL, color: C.white, lh: 1.1, align: "right", shadow: C.shade, anim: A("wipe", 9, { t: 2.2 }) }),
          S.t("names", `${G} & ${B}`, caps(F.small, C.white, { ls: 4, lh: 1.4, mt: 4, align: "right", shadow: C.shade, anim: A("fade", 14) })),
        ],
        640, 590, 560, 690,
      );
      return S.done(8, "zoom");
    });

    // ── Bố cục vuông 1080×1080: mỗi cảnh cùng khoá chữ, cùng số ô ảnh và cùng nhịp hiệu ứng với bản
    // 16:9 ở trên, chỉ khác chỗ đặt. Cảnh nào thêm ô/chữ ở bản 16:9 thì phải thêm cả ở đây.
    const SQ_LAY = {
      open: (S) => {
        S.rect(0, 0, 560, H, C.cream, A("reveal", 0, { from: "left", t: 1.2 }));
        S.img(0, { x: 0, y: 80, w: 660, h: 560 }, A("fly", 2, { from: "left" }), pool.own("cover_image_url"));
        S.col(
          [
            S.t("title", "To new\nbeginnings", caps(F.title, C.brown, { ls: 3, anim: A("track", 7, { ls0: 30 }) })),
            S.t("sub", "My Love Story", { font: F.italic, color: C.ink, lh: 1.4, mt: 22, anim: A("fade", 12) }),
            date && S.t("date", date, { font: F.small, color: C.grey, lh: 1.4, ls: 3, mt: 6, anim: A("fade", 14) }),
          ],
          64, 500, 700,
        );
        S.img(1, { x: 700, y: 360, w: 330, h: 620 }, A("fly", 5, { from: "right" }));
        return S.done(8, "fade");
      },
      frames: (flip) => (S) => {
        S.sprig(-6, 96, -24, 300, 0, { leaf: 0.2 });
        S.sprig(36, -6, 62, 200, 2, { leaves: 7, leaf: 0.2 });
        S.sprig(W + 6, 96, 204, 300, 1, { leaf: 0.2 });
        S.sprig(W - 36, -6, 118, 200, 3, { leaves: 7, leaf: 0.2 });
        [0, 1, 2, 3].forEach((k) =>
          S.img(k, { x: 80 + (k % 2) * 470, y: 110 + Math.floor(k / 2) * 470, w: 450, h: 450 }, A("fly", 2 + k * 2, { from: (k % 2) ^ flip ? "top" : "bottom" })),
        );
        return S.done(7, "slide");
      },
      married: (S) => {
        S.img(0, { x: 0, y: 0, w: 470, h: H }, A("reveal", 0, { from: "left", t: 1.6, drift: 120 }));
        S.col([S.t("script", "We are happily\nmarried", { font: F.script, color: C.ink, lh: 1.05, align: "center", anim: A("wipe", 8, { t: 2.2 }) })], 500, 560, 70, 260);
        S.img(1, { x: 510, y: 300, w: 530, h: 380 }, A("fly", 3, { from: "right" }));
        S.img(2, { x: 510, y: 710, w: 260, h: 330 }, A("fly", 5, { from: "bottom" }));
        S.col(
          [S.t("quote", "“Our forever\nbegins\ntoday”", { font: F.quote, color: C.quote, lh: 1.05, align: "center", anim: A("lines", 12) })],
          790, 250, 710, 1040,
        );
        return S.done(8, "fade");
      },
      memory: (S) => {
        S.img(0, { x: 40, y: 0, w: 620, h: 820 }, A("fly", 0, { from: "top" }));
        S.img(1, { x: 680, y: 60, w: 360, h: 480 }, A("fly", 3, { from: "right" }));
        S.img(2, { x: 680, y: 560, w: 360, h: 480 }, A("fly", 5, { from: "bottom" }));
        S.col([S.t("title", "Our memories", caps(F.serif, C.grey, { ls: 2, anim: A("track", 8, { ls0: 24 }) }))], 44, 620, 850, 1000);
        return S.done(7, "slide");
      },
      duo: (flip) => (S) => {
        const big = flip ? 380 : 0;
        const side = flip ? 0 : 710;
        S.img(0, { x: 0, y: big, w: W, h: 700 }, A("reveal", 0, { from: flip ? "bottom" : "top", t: 1.6, drift: 140 }));
        S.img(1, { x: 0, y: side, w: 535, h: 370 }, A("fly", 4, { from: flip ? "tl" : "bl" }));
        S.img(2, { x: 545, y: side, w: 535, h: 370 }, A("fly", 6, { from: flip ? "tr" : "br" }));
        return S.done(7, "split");
      },
      happy: (S) => {
        const r = { radius: 14 };
        S.img(0, { x: 60, y: 60, w: 440, h: 400, ...r }, A("fly", 1, { from: "left" }));
        S.img(1, { x: 60, y: 490, w: 440, h: 400, ...r }, A("fly", 3, { from: "bottom" }));
        S.img(2, { x: 530, y: 60, w: 490, h: 830, ...r }, A("fly", 5, { from: "right" }));
        S.vine(40, 440, -80, 300, 8);
        S.vine(520, 860, 110, 230, 10);
        S.col([S.t("script", "Just Married", { font: F.scriptL, color: C.ink, lh: 1.1, align: "center", anim: A("wipe", 9, { t: 2.4 }) })], 40, 1000, 910, 1060);
        return S.done(8, "fade");
      },
      story: (S) => {
        S.img(0, { x: 0, y: 0, w: 540, h: H }, A("zoom", 0, { s0: 1.25, t: 2.2, keep: true }));
        S.rect(540, 0, 10, H, C.paper);
        const inset = S.img(1, { x: 590, y: 110, w: 440, h: 560, ...print }, A("fly", 5, { from: "right" }));
        S.echo(inset, { x: 550, y: 0, w: 530, h: H, alpha: 0.3 }, A("fade", 2));
        S.col([S.t("title", "A love story", caps(F.titleS, C.grey, { ls: 8, align: "center", anim: A("track", 10, { ls0: 30 }) }))], 550, 530, 760, 900);
        return S.done(7, "slide-up");
      },
      pair: (S) => {
        S.rect(0, 0, 340, H, C.cream, A("reveal", 0, { from: "top", t: 1.2 }));
        S.rect(740, 0, 340, H, C.cream, A("reveal", 0, { from: "bottom", t: 1.2 }));
        S.img(0, { x: 90, y: 120, w: 430, h: 840, radius: 10 }, A("fly", 3, { from: "left" }));
        S.img(1, { x: 560, y: 120, w: 430, h: 840, radius: 10 }, A("fly", 5, { from: "right" }));
        return S.done(7, "fade");
      },
      begin: (S) => {
        const box = { x: 0, y: 0, w: W, h: 800 };
        S.img(0, box, A("reveal", 0, { from: "left", t: 1.6, drift: 120 }));
        S.knock(S.t("title", "The\nbeginning", caps(F.serifS, C.ink, { ls: 1, lh: 1.2, anim: A("fade", 10) })), 64, 640, 720, box, C.white);
        S.col([S.t("sub", "My Love Story", { font: F.italic, color: C.ink, lh: 1.4, anim: A("fade", 14) })], 66, 400, 910);
        return S.done(7, "slide");
      },
      forever: (S) => {
        S.img(0, { x: 0, y: 0, w: 540, h: H }, A("reveal", 0, { from: "top", t: 1.6 }));
        S.img(1, { x: 560, y: 560, w: 520, h: 520 }, A("reveal", 2, { from: "bottom", t: 1.6 }));
        S.col([S.t("quote", "“Forever\n&\ntogether”", { font: F.quoteL, color: C.quote, lh: 1.05, align: "center", anim: A("lines", 6) })], 560, 520, 40, 300);
        S.img(2, { x: 610, y: 330, w: 420, h: 380, ...print, mat: 6 }, A("fly", 8, { from: "bottom" }));
        return S.done(8, "fade");
      },
      trio: (flip) => (S) => {
        [0, 1, 2].forEach((k) =>
          S.img(k, { x: k * 365, y: 0, w: 350, h: H }, A("reveal", (flip ? 2 - k : k) * 3, { from: (k % 2) ^ flip ? "bottom" : "top", t: 1.4, drift: 80 })),
        );
        return S.done(7, "split");
      },
      grid: (S) => {
        [0, 1, 2, 3, 4, 5].forEach((k) => {
          const r = Math.floor(k / 3);
          S.img(k, { x: (k % 3) * 365, y: r * 545, w: 350, h: 535 }, A("fly", 1 + k * 1.5, { from: r ? "bottom" : "top", s0: 0.9 }));
        });
        return S.done(8, "zoom");
      },
      mosaic: (S) => {
        S.img(0, { x: 270, y: 0, w: 540, h: H }, A("zoom", 0, { s0: 1.2, t: 2.2 }));
        S.img(1, { x: 0, y: 0, w: 260, h: 535 }, A("fly", 4, { from: "left" }));
        S.img(2, { x: 0, y: 545, w: 260, h: 535 }, A("fly", 6, { from: "bl" }));
        S.img(3, { x: 820, y: 0, w: 260, h: 535 }, A("fly", 5, { from: "right" }));
        S.img(4, { x: 820, y: 545, w: 260, h: 535 }, A("fly", 7, { from: "br" }));
        return S.done(8, "fade");
      },
      mine: (S) => {
        S.sprig(-6, 40, 30, 230, 0);
        S.sprig(W + 6, 40, 150, 230, 1);
        S.sprig(900, -6, 100, 150, 2, { leaves: 6 });
        S.img(0, { x: 50, y: 200, w: 310, h: 680 }, A("fly", 2, { from: "left" }));
        S.img(1, { x: 385, y: 90, w: 310, h: 680 }, A("fly", 4, { from: "top" }));
        S.img(2, { x: 720, y: 200, w: 310, h: 680 }, A("fly", 6, { from: "right" }));
        S.col([S.t("script", "You are mine", { font: F.script, color: C.ink, lh: 1.1, align: "center", anim: A("wipe", 10, { t: 2 }) })], 340, 400, 800, 950);
        return S.done(7, "fade");
      },
      forever2: (S) => {
        const box = { x: 40, y: 0, w: 620, h: 860 };
        S.img(0, box, A("fly", 0, { from: "left" }));
        S.img(1, { x: 680, y: 0, w: 360, h: 860 }, A("fly", 3, { from: "right" }));
        S.knock(S.t("title", "Our\nforever", caps(F.serifS, C.ink, { ls: 1, lh: 1.25, anim: A("fade", 9) })), 80, 600, 780, box, C.white);
        return S.done(7, "slide-up");
      },
      thanks: (S) => {
        S.img(0, { x: 0, y: 0, w: W, h: H, kb: true }, A("zoom", 0, { s0: 1.2, t: 2.4, keep: true }), pool.own("cover_image_url"));
        S.grad(0, 620, W, 460, "rgba(30,24,20,0)", "rgba(30,24,20,0.42)", A("fade", 3));
        S.img(1, { x: 50, y: 60, w: 300, h: 300, ...print, mat: 6 }, A("fly", 4, { from: "left" }));
        S.img(2, { x: 50, y: 400, w: 300, h: 300, ...print, mat: 6 }, A("fly", 6, { from: "bl" }));
        S.col(
          [
            S.t("script", "Thank you", { font: F.scriptL, color: C.white, lh: 1.1, align: "right", shadow: C.shade, anim: A("wipe", 9, { t: 2.2 }) }),
            S.t("names", `${G} & ${B}`, caps(F.small, C.white, { ls: 4, lh: 1.4, mt: 4, align: "right", shadow: C.shade, anim: A("fade", 14) })),
          ],
          400, 630, 870, 1030,
        );
        return S.done(8, "zoom");
      },
    };
    // ── Bố cục dọc 1080×1920: cùng quy ước với bản vuông (cùng khoá chữ, cùng số ô ảnh). ──
    const TALL_LAY = {
      open: (S) => {
        S.rect(0, 0, 700, H, C.cream, A("reveal", 0, { from: "top", t: 1.2 }));
        S.img(0, { x: 0, y: 140, w: 880, h: 1000 }, A("fly", 2, { from: "left" }), pool.own("cover_image_url"));
        S.col(
          [
            S.t("title", "To new\nbeginnings", caps(F.title, C.brown, { ls: 3, anim: A("track", 7, { ls0: 30 }) })),
            S.t("sub", "My Love Story", { font: F.italic, color: C.ink, lh: 1.4, mt: 22, anim: A("fade", 12) }),
            date && S.t("date", date, { font: F.small, color: C.grey, lh: 1.4, ls: 3, mt: 6, anim: A("fade", 14) }),
          ],
          80, 640, 1210,
        );
        S.img(1, { x: 400, y: 1540, w: 620, h: 320 }, A("fly", 5, { from: "right" }));
        return S.done(8, "fade");
      },
      frames: (flip) => (S) => {
        S.sprig(-6, 96, -24, 300, 0, { leaf: 0.2 });
        S.sprig(36, -6, 62, 200, 2, { leaves: 7, leaf: 0.2 });
        S.sprig(W + 6, H - 96, 156, 300, 1, { leaf: 0.2 });
        S.sprig(W - 36, H + 6, 242, 200, 3, { leaves: 7, leaf: 0.2 });
        [0, 1, 2, 3].forEach((k) =>
          S.img(k, { x: 70 + (k % 2) * 490, y: 160 + Math.floor(k / 2) * 820, w: 450, h: 780 }, A("fly", 2 + k * 2, { from: (k % 2) ^ flip ? "top" : "bottom" })),
        );
        return S.done(7, "slide");
      },
      married: (S) => {
        S.img(0, { x: 0, y: 0, w: W, h: 900 }, A("reveal", 0, { from: "top", t: 1.6, drift: 120 }));
        S.col([S.t("script", "We are happily\nmarried", { font: F.script, color: C.ink, lh: 1.05, align: "center", anim: A("wipe", 8, { t: 2.2 }) })], 60, 960, 940, 1190);
        S.img(1, { x: 60, y: 1230, w: 470, h: 640 }, A("fly", 3, { from: "left" }));
        S.img(2, { x: 560, y: 1230, w: 460, h: 440 }, A("fly", 5, { from: "right" }));
        S.col(
          [S.t("quote", "“Our forever\nbegins\ntoday”", { font: F.quote, color: C.quote, lh: 1.05, align: "center", anim: A("lines", 12) })],
          560, 460, 1690, 1890,
        );
        return S.done(8, "fade");
      },
      memory: (S) => {
        S.img(0, { x: 40, y: 0, w: 1000, h: 900 }, A("fly", 0, { from: "top" }));
        S.img(1, { x: 40, y: 930, w: 490, h: 680 }, A("fly", 3, { from: "left" }));
        S.img(2, { x: 550, y: 1010, w: 490, h: 680 }, A("fly", 5, { from: "right" }));
        S.col([S.t("title", "Our memories", caps(F.serif, C.grey, { ls: 2, anim: A("track", 8, { ls0: 24 }) }))], 44, 1000, 1720, 1880);
        return S.done(7, "slide");
      },
      duo: (flip) => (S) => {
        const big = flip ? 720 : 0;
        const side = flip ? 0 : 1210;
        S.img(0, { x: 0, y: big, w: W, h: 1200 }, A("reveal", 0, { from: flip ? "bottom" : "top", t: 1.6, drift: 140 }));
        S.img(1, { x: 0, y: side, w: 535, h: 710 }, A("fly", 4, { from: flip ? "tl" : "bl" }));
        S.img(2, { x: 545, y: side, w: 535, h: 710 }, A("fly", 6, { from: flip ? "tr" : "br" }));
        return S.done(7, "split");
      },
      happy: (S) => {
        const r = { radius: 14 };
        S.img(0, { x: 60, y: 80, w: 470, h: 620, ...r }, A("fly", 1, { from: "left" }));
        S.img(1, { x: 550, y: 80, w: 470, h: 620, ...r }, A("fly", 3, { from: "top" }));
        S.img(2, { x: 60, y: 730, w: 960, h: 900, ...r }, A("fly", 5, { from: "bottom" }));
        S.vine(36, 1700, -70, 320, 8);
        S.vine(1044, 760, 112, 260, 10);
        S.col([S.t("script", "Just Married", { font: F.scriptL, color: C.ink, lh: 1.1, align: "center", anim: A("wipe", 9, { t: 2.4 }) })], 40, 1000, 1660, 1880);
        return S.done(8, "fade");
      },
      story: (S) => {
        S.img(0, { x: 0, y: 0, w: W, h: 1060 }, A("zoom", 0, { s0: 1.25, t: 2.2, keep: true }));
        S.rect(0, 1060, W, 10, C.paper);
        const inset = S.img(1, { x: 160, y: 1140, w: 760, h: 560, ...print }, A("fly", 5, { from: "bottom" }));
        S.echo(inset, { x: 0, y: 1070, w: W, h: 850, alpha: 0.3 }, A("fade", 2));
        S.col([S.t("title", "A love story", caps(F.titleS, C.grey, { ls: 8, align: "center", anim: A("track", 10, { ls0: 30 }) }))], 0, W, 1750, 1870);
        return S.done(7, "slide-up");
      },
      pair: (S) => {
        S.rect(0, 0, W, 700, C.cream, A("reveal", 0, { from: "left", t: 1.2 }));
        S.rect(0, 1220, W, 700, C.cream, A("reveal", 0, { from: "right", t: 1.2 }));
        S.img(0, { x: 60, y: 100, w: 700, h: 860, radius: 10 }, A("fly", 3, { from: "left" }));
        S.img(1, { x: 320, y: 960, w: 700, h: 860, radius: 10 }, A("fly", 5, { from: "right" }));
        return S.done(7, "fade");
      },
      begin: (S) => {
        const box = { x: 0, y: 0, w: W, h: 1460 };
        S.img(0, box, A("reveal", 0, { from: "top", t: 1.6, drift: 120 }));
        S.knock(S.t("title", "The\nbeginning", caps(F.serifS, C.ink, { ls: 1, lh: 1.2, anim: A("fade", 10) })), 64, 900, 1370, box, C.white);
        S.col([S.t("sub", "My Love Story", { font: F.italic, color: C.ink, lh: 1.4, anim: A("fade", 14) })], 66, 600, 1600);
        S.sprig(W + 6, H - 40, 196, 340, 12, { leaf: 0.2 });
        return S.done(7, "slide");
      },
      forever: (S) => {
        S.img(0, { x: 0, y: 0, w: W, h: 900 }, A("reveal", 0, { from: "top", t: 1.6 }));
        S.img(1, { x: 540, y: 940, w: 540, h: 980 }, A("reveal", 2, { from: "bottom", t: 1.6 }));
        S.col([S.t("quote", "“Forever\n&\ntogether”", { font: F.quoteL, color: C.quote, lh: 1.05, align: "center", anim: A("lines", 6) })], 0, 540, 940, 1360);
        S.img(2, { x: 120, y: 1390, w: 520, h: 460, ...print, mat: 6 }, A("fly", 8, { from: "bottom" }));
        return S.done(8, "fade");
      },
      trio: (flip) => (S) => {
        [0, 1, 2].forEach((k) =>
          S.img(k, { x: 0, y: k * 643, w: W, h: 634 }, A("reveal", (flip ? 2 - k : k) * 3, { from: (k % 2) ^ flip ? "right" : "left", t: 1.4, drift: 80 })),
        );
        return S.done(7, "split");
      },
      grid: (S) => {
        [0, 1, 2, 3, 4, 5].forEach((k) => {
          const r = Math.floor(k / 2);
          S.img(k, { x: (k % 2) * 545, y: r * 645, w: 535, h: 630 }, A("fly", 1 + k * 1.5, { from: k % 2 ? "right" : "left", s0: 0.9 }));
        });
        return S.done(8, "zoom");
      },
      mosaic: (S) => {
        S.img(0, { x: 0, y: 465, w: W, h: 990 }, A("zoom", 0, { s0: 1.2, t: 2.2 }));
        S.img(1, { x: 0, y: 0, w: 535, h: 455 }, A("fly", 4, { from: "tl" }));
        S.img(2, { x: 0, y: 1465, w: 535, h: 455 }, A("fly", 6, { from: "bl" }));
        S.img(3, { x: 545, y: 0, w: 535, h: 455 }, A("fly", 5, { from: "tr" }));
        S.img(4, { x: 545, y: 1465, w: 535, h: 455 }, A("fly", 7, { from: "br" }));
        return S.done(8, "fade");
      },
      mine: (S) => {
        S.sprig(-6, 40, 30, 260, 0);
        S.sprig(W + 6, 40, 150, 260, 1);
        S.img(0, { x: 60, y: 1040, w: 470, h: 620 }, A("fly", 2, { from: "left" }));
        S.img(1, { x: 190, y: 110, w: 700, h: 900 }, A("fly", 4, { from: "top" }));
        S.img(2, { x: 550, y: 1040, w: 470, h: 620 }, A("fly", 6, { from: "right" }));
        S.col([S.t("script", "You are mine", { font: F.scriptL, color: C.ink, lh: 1.1, align: "center", anim: A("wipe", 10, { t: 2 }) })], 40, 1000, 1690, 1890);
        return S.done(7, "fade");
      },
      forever2: (S) => {
        const box = { x: 40, y: 0, w: 1000, h: 1180 };
        S.img(0, box, A("fly", 0, { from: "top" }));
        S.img(1, { x: 580, y: 1210, w: 460, h: 660 }, A("fly", 3, { from: "right" }));
        S.knock(S.t("title", "Our\nforever", caps(F.serifS, C.ink, { ls: 1, lh: 1.25, anim: A("fade", 9) })), 80, 480, 1090, box, C.white);
        S.sprig(-6, H - 60, -30, 320, 11, { leaf: 0.2 });
        return S.done(7, "slide-up");
      },
      thanks: (S) => {
        S.img(0, { x: 0, y: 0, w: W, h: H, kb: true }, A("zoom", 0, { s0: 1.2, t: 2.4, keep: true }), pool.own("cover_image_url"));
        S.grad(0, 1240, W, 680, "rgba(30,24,20,0)", "rgba(30,24,20,0.45)", A("fade", 3));
        S.img(1, { x: 60, y: 80, w: 360, h: 360, ...print, mat: 6 }, A("fly", 4, { from: "left" }));
        S.img(2, { x: 60, y: 480, w: 360, h: 360, ...print, mat: 6 }, A("fly", 6, { from: "bl" }));
        S.col(
          [
            S.t("script", "Thank you", { font: F.scriptL, color: C.white, lh: 1.1, align: "right", shadow: C.shade, anim: A("wipe", 9, { t: 2.2 }) }),
            S.t("names", `${G} & ${B}`, caps(F.small, C.white, { ls: 4, lh: 1.4, mt: 4, align: "right", shadow: C.shade, anim: A("fade", 14) })),
          ],
          240, 780, 1640, 1840,
        );
        return S.done(8, "zoom");
      },
    };
    // Cảnh có chữ đã đăng ký bản 16:9 ở trên — khung khác thì thay hàm dựng, giữ nguyên nhãn.
    const ALT = TALL ? TALL_LAY : SQ ? SQ_LAY : null;
    if (ALT) {
      ["open", "married", "memory", "happy", "story", "begin", "forever", "mine", "forever2", "thanks"].forEach((sid) =>
        add(sid, lay.get(sid)[0], ALT[sid]),
      );
    }
    const pick = (sid, fn16) => (ALT ? ALT[sid] : fn16);

    add("frames", "Bốn khung ảnh", pick("frames", frames)(0));
    add("frames2", "Bốn khung ảnh 2", pick("frames", frames)(1));
    add("duo", "Ảnh lớn", pick("duo", duo)(0));
    add("duo2", "Ảnh lớn 2", pick("duo", duo)(1));
    add("pair", "Hai khung", pick("pair", pair));
    add("pair2", "Hai khung 2", pick("pair", pair));
    add("trio", "Ba ảnh", pick("trio", trio)(0));
    add("trio2", "Ba ảnh 2", pick("trio", trio)(1));
    add("grid", "Lưới sáu ảnh", pick("grid", grid));
    add("mosaic", "Năm ảnh", pick("mosaic", mosaic));

    // 20 cảnh, 60 ô ảnh; cảnh có chữ xen giữa các cảnh chỉ có ảnh.
    const ORDER = [
      "open", "frames", "married", "memory", "duo", "happy", "grid", "story", "pair", "begin",
      "mosaic", "forever", "trio", "frames2", "mine", "duo2", "trio2", "forever2", "pair2", "thanks",
    ];
    return ORDER.map((sid) => {
      const [label, fn] = lay.get(sid);
      return fn(_stage(sid, label, L, pool));
    });
  }
})();
