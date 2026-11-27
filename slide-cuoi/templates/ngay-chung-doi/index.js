// Slide sân khấu "Ngày Chung Đôi" (1280×720): nền trắng tối giản, ẢNH LÀ CHÍNH — đủ 60 ô ảnh khác
// nhau (khách đổ một lần bằng "Tải nhiều ảnh"), mỗi cảnh ghép 1–6 ảnh, chữ chỉ một cụm ngắn hoặc
// không có. Cành lá nét chì tự vẽ dần, ảnh in viền trắng đổ bóng. Thiệp ít ảnh thì ảnh lặp vòng
// cho đủ khung. Chỉ KHAI cảnh (CX_SLIDE.scenes); vẽ/chạy/xuất là việc của engine + runtime.

(function () {
  const W = 1280;
  const H = 720;
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
  const GV = '"Great Vibes", cursive';
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
        [S.t("quote", "“Forever,\ntogether\nbegins\ntoday”", { font: F.quote, color: C.quote, lh: 1.05, align: "center", anim: A("lines", 12) })],
        915, 317, 494, 690,
      );
      return S.done(8, "fade");
    });

    // ── Ba ảnh lệch tầng, tiêu đề lớn góc dưới trái ──
    add("memory", "Kỷ niệm", (S) => {
      S.img(0, { x: 36, y: 0, w: 560, h: 556 }, A("fly", 0, { from: "top" }));
      S.img(1, { x: 616, y: 196, w: 316, h: 476 }, A("fly", 3, { from: "bottom" }));
      S.img(2, { x: 952, y: 18, w: 292, h: 470 }, A("fly", 5, { from: "right" }));
      S.col([S.t("title", "Our memory", caps(F.serif, C.grey, { ls: 2, anim: A("track", 8, { ls0: 24 }) }))], 44, 560, 594, 700);
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

    // ── Ba ảnh bo góc, dây hoa hồng phấn, chữ ký Happy Wedding ──
    add("happy", "Happy Wedding", (S) => {
      const r = { radius: 14 };
      S.img(0, { x: 50, y: 64, w: 316, h: 452, ...r }, A("fly", 1, { from: "left" }));
      S.img(1, { x: 420, y: 64, w: 316, h: 452, ...r }, A("fly", 3, { from: "top" }));
      S.img(2, { x: 792, y: 64, w: 438, h: 620, ...r }, A("fly", 5, { from: "right" }));
      S.vine(30, 330, -72, 260, 8);
      S.vine(760, 380, 118, 230, 10);
      S.col([S.t("script", "Happy Wedding", { font: F.scriptL, color: C.ink, lh: 1.1, align: "center", anim: A("wipe", 9, { t: 2.4 }) })], 40, 706, 560, 700);
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

    add("frames", "Bốn khung ảnh", frames(0));
    add("frames2", "Bốn khung ảnh 2", frames(1));
    add("duo", "Ảnh lớn", duo(0));
    add("duo2", "Ảnh lớn 2", duo(1));
    add("pair", "Hai khung", pair);
    add("pair2", "Hai khung 2", pair);
    add("trio", "Ba ảnh", trio(0));
    add("trio2", "Ba ảnh 2", trio(1));
    add("grid", "Lưới sáu ảnh", grid);
    add("mosaic", "Năm ảnh", mosaic);

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
