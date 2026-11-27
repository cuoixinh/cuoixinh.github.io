// Slide sân khấu "Trăm Năm Hạnh Phúc": CHỈ CÓ ẢNH, không chữ — nền tối kiểu chiếu phim, đa số màn
// là MỘT ảnh (hiện trọn trên nền mờ của chính nó, hoặc tràn khung có lia máy), xen màn 2–3 ảnh cho
// đỡ nhàm. 60 ô ảnh (khách đổ một lần ở "Ảnh của bạn"); thiệp ít ảnh thì ảnh lặp vòng. Bố cục tính
// theo W×H nên chạy cả 16:9 (1280×720) lẫn 1:1 (1080×1080, `?ratio=1x1`).
// Chỉ KHAI cảnh (CX_SLIDE.scenes); vẽ/chạy/xuất là việc của engine + runtime.

(function () {
  const SQ = new URLSearchParams(location.search).get("ratio") === "1x1";
  const W = SQ ? 1080 : 1280;
  const H = SQ ? 1080 : 720;
  const C = {
    bg: "#0E0D0C",
    veil: "rgba(10, 9, 8, 0.5)",
    empty: "#2A2725",
    drop: "rgba(0, 0, 0, 0.55)",
  };
  const SLOTS = 60;
  const GAP = 6; // khe giữa các ảnh ghép (lộ nền tối)
  // Nhịp trễ: 1 = 0.15 giây.
  const A = (k, n, o) => ({ k, d: n * 0.15, ...o });

  window.CX_SLIDE = {
    id: "tram-nam-hanh-phuc",
    w: W,
    h: H,
    bg: C.bg,
    fade: 1,
    demo: "hen-uoc",
    fx: { sparkle: { n: 18, size: 8, alpha: 0.45, seed: 11 } },
    fonts: [],
    scenes: buildScenes,
  };

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

  // Một cảnh đang dựng. Mọi ảnh qua S.img (ô `<sid>.p<n>`, khách đổi ảnh riêng từng ô) — thêm ảnh
  // không qua đây là ô đó không đổi được. Mẫu không có chữ nên `texts` luôn rỗng.
  function _stage(sid, label, L, pool) {
    const photos = [];
    const els = [];
    const S = {
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
      // Nền: bản mờ phóng tràn khung của ảnh `of` + lớp tối phủ lên, chèn ngay TRƯỚC ảnh đó
      // (cùng ô ảnh: khách đổi ảnh là đổi cả nền).
      backdrop(of) {
        const at = els.indexOf(of);
        els.splice(
          at, 0,
          { ...of, x: 0, y: 0, w: W, h: H, fit: null, soft: true, kb: true, mat: 0, drop: null, rot: 0, anim: A("fade", 0, { t: 1 }) },
          { type: "rect", x: 0, y: 0, w: W, h: H, fill: C.veil },
        );
      },
      done(dur, tr) {
        return { id: sid, dur, label, tr, texts: [], photos, els };
      },
    };
    return S;
  }

  // ── Kiểu màn ── Mỗi kiểu nhận S (+ số thứ tự k để đổi hướng xen kẽ), trả cảnh đã dựng.
  const PAD = Math.round(Math.min(W, H) * 0.05);
  const FRAME = { x: PAD, y: PAD, w: W - PAD * 2, h: H - PAD * 2 };

  // Một ảnh hiện TRỌN giữa khung trên nền mờ của chính nó — hợp cả ảnh dọc lẫn ảnh ngang.
  // Mỗi lượt một kiểu vào (phóng, bay, mở dần, lật…).
  const ENTER = [
    () => A("zoom", 0, { s0: 1.12, t: 1.6 }),
    () => A("fly", 1, { from: "left", t: 1.4 }),
    () => A("reveal", 0, { from: "top", t: 1.4 }),
    () => A("fly", 1, { from: "bottom", s0: 0.92, t: 1.4 }),
    () => A("flip", 1, { t: 1.2 }),
    () => A("zoom", 0, { s0: 0.86, t: 1.6 }),
    () => A("fly", 1, { from: "right", t: 1.4 }),
    () => A("reveal", 0, { from: "left", t: 1.4 }),
  ];
  const single = (k, ph) => (S) => {
    const main = S.img(0, { ...FRAME, fit: "contain", kb: k % 2 ? true : "in", drop: C.drop, dropBlur: 40, dropY: 12 }, ENTER[k % ENTER.length](), ph);
    S.backdrop(main);
    return S.done(5, k % 3 === 1 ? "zoom" : "fade");
  };

  // Một ảnh tràn khung, lia máy chậm (ngang hoặc dọc) — màn "điện ảnh" xen giữa.
  const PANS = ["pan-r", "pan-u", "pan-l", "pan-d"];
  const full = (k) => (S) => {
    S.img(0, { x: 0, y: 0, w: W, h: H, kb: PANS[k % PANS.length] }, A("fade", 0, { t: 0.8 }));
    return S.done(5, k % 2 ? "slide" : "fade");
  };

  // Hai ảnh chia đôi khung, mở dần ngược chiều nhau.
  const duoSplit = (S) => {
    const w = (W - GAP) / 2;
    S.img(0, { x: 0, y: 0, w, h: H, kb: "in" }, A("reveal", 0, { from: "top", t: 1.4, drift: 60 }));
    S.img(1, { x: w + GAP, y: 0, w, h: H, kb: true }, A("reveal", 3, { from: "bottom", t: 1.4, drift: 60 }));
    return S.done(6, "split");
  };

  // Hai tấm ảnh in viền trắng nghiêng nhẹ, bay vào đặt chồng lên nền mờ.
  const duoPrints = (S) => {
    const ph = Math.round(Math.min(H * 0.72, W * 0.52));
    const pw = Math.round(ph * 0.75);
    const cy = (H - ph) / 2;
    const print = { mat: 12, matColor: "#FBF8F3", drop: C.drop, dropBlur: 36, dropY: 14, kb: false };
    const a = S.img(0, { x: W / 2 - pw - PAD * 0.4, y: cy - PAD * 0.4, w: pw, h: ph, rot: -5, ...print }, A("fly", 2, { from: "left", rot: -20 }));
    S.img(1, { x: W / 2 + PAD * 0.4, y: cy + PAD * 0.4, w: pw, h: ph, rot: 4, ...print }, A("fly", 5, { from: "right", rot: 20 }));
    S.backdrop(a);
    return S.done(6, "fade");
  };

  // Ba ảnh dọc chia đều khung, mở dần nối nhau.
  const trioCols = (S) => {
    const w = (W - GAP * 2) / 3;
    [0, 1, 2].forEach((n) =>
      S.img(n, { x: n * (w + GAP), y: 0, w, h: H, kb: n % 2 ? true : "in" }, A("reveal", n * 3, { from: n % 2 ? "bottom" : "top", t: 1.3, drift: 60 })),
    );
    return S.done(6.5, "slide-up");
  };

  // Ảnh lớn một bên + hai ảnh nhỏ xếp chồng bên kia.
  const trioMain = (k) => (S) => {
    const bw = Math.round((W - GAP) * (SQ ? 0.6 : 0.64));
    const sw = W - GAP - bw;
    const sh = (H - GAP) / 2;
    const left = k % 2 === 0;
    const bx = left ? 0 : sw + GAP;
    const sx = left ? bw + GAP : 0;
    S.img(0, { x: bx, y: 0, w: bw, h: H, kb: "in" }, A("zoom", 0, { s0: 1.15, t: 1.6 }));
    S.img(1, { x: sx, y: 0, w: sw, h: sh }, A("fly", 4, { from: left ? "right" : "left" }));
    S.img(2, { x: sx, y: sh + GAP, w: sw, h: sh }, A("fly", 6, { from: left ? "br" : "bl" }));
    return S.done(6.5, "fade");
  };

  // Nhịp màn: đa số một ảnh, cứ vài màn lại xen một màn ghép. Lặp tới khi đủ SLOTS ô ảnh.
  const RHYTHM = ["one", "full", "one", "duoSplit", "one", "full", "one", "trioCols", "one", "full", "one", "duoPrints", "one", "full", "one", "trioMain"];
  const SIZE = { one: 1, full: 1, duoSplit: 2, duoPrints: 2, trioCols: 3, trioMain: 3 };

  function buildScenes(w, L) {
    const pool = _pool(w);
    const scenes = [];
    let used = 0;
    let r = 0;
    const count = {}; // số lần mỗi kiểu đã dùng — để đổi hướng/kiểu vào xen kẽ
    while (used < SLOTS) {
      let kind = RHYTHM[r++ % RHYTHM.length];
      if (used + SIZE[kind] > SLOTS) kind = "one"; // ô cuối lẻ thì lấp bằng màn một ảnh
      const n = SIZE[kind];
      const k = (count[kind] = (count[kind] ?? -1) + 1);
      const fn =
        kind === "one" ? single(k, used === 0 ? pool.own("cover_image_url") : null)
        : kind === "full" ? full(k)
        : kind === "duoSplit" ? duoSplit
        : kind === "duoPrints" ? duoPrints
        : kind === "trioCols" ? trioCols
        : trioMain(k);
      const label = n === 1 ? `Ảnh ${used + 1}` : `Ảnh ${used + 1}–${used + n}`;
      scenes.push(fn(_stage(`s${scenes.length + 1}`, label, L, pool)));
      used += n;
    }
    // Màn cuối đứng lâu hơn một nhịp trước khi slide quay vòng về đầu.
    const last = scenes[scenes.length - 1];
    last.dur = 6;
    return scenes;
  }
})();
