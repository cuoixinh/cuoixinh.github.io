// Slide sân khấu "Mẫu 04" (tram-nam-hanh-phuc): CHỈ CÓ ẢNH, không chữ — mọi ảnh PHỦ KÍN ô của nó, chỉ có
// hiệu ứng vào + Ken Burns/lia máy + chuyển cảnh; nền trắng cùng tông Mẫu 01. Khung ngang 16:9 (1280×720): ảnh cưới đa số dọc
// nên mỗi màn ghép 2–3 ảnh lấp kín khung, thỉnh thoảng một ảnh tràn khung lia dọc. Khung vuông 1:1
// (1080×1080, `?ratio=1x1`) và dọc 9:16 (1080×1920, `?ratio=9x16`): đa số một ảnh một khung, xen màn
// 2–3 ảnh. 60 ô ảnh, thiệp ít ảnh thì lặp vòng. Chỉ KHAI cảnh; vẽ/chạy/xuất là việc của engine + runtime.

(function () {
  const RT = new URLSearchParams(location.search).get("ratio");
  const SQ = RT === "1x1";
  const TALL = RT === "9x16";
  const W = SQ || TALL ? 1080 : 1280;
  const H = TALL ? 1920 : SQ ? 1080 : 720;
  const C = { bg: "#FFFFFF", empty: "#EEECEA" };
  const SLOTS = 60;
  const GAP = 6; // khe giữa các ảnh ghép (lộ nền trắng)
  // Nhịp trễ: 1 = 0.15 giây.
  const A = (k, n, o) => ({ k, d: n * 0.15, ...o });

  window.CX_SLIDE = {
    id: "tram-nam-hanh-phuc",
    w: W,
    h: H,
    bg: C.bg,
    fade: 1,
    demo: "hen-uoc",
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

  // Một cảnh đang dựng. Ô ảnh khoá theo SỐ THỨ TỰ ảnh trên cả slide (`p<n>`, 1…60), không theo
  // cảnh — hai tỉ lệ chia cảnh khác nhau mà ảnh thứ n vẫn là ảnh thứ n, đổi tỉ lệ không lạc ảnh.
  // Mẫu không có chữ nên `texts` luôn rỗng.
  function _stage(sid, label, L, pool, slot) {
    const photos = [];
    const els = [];
    const S = {
      img(rect, anim, ph) {
        const key = `p${slot.n++}`;
        const src0 = ph || pool.next();
        const def = src0.file ? getImageUrl(src0.file) : "";
        const mine = L.photos?.[key];
        photos.push({ key, def, w: rect.w, h: rect.h });
        els.push({
          type: "image", kb: "in", ...rect, src: mine?.src || def, focal: mine ? mine.focal : src0.fp,
          empty: C.empty, edit: key, anim,
        });
      },
      done(dur, tr) {
        return { id: sid, dur, label, tr, texts: [], photos, els };
      },
    };
    return S;
  }

  // ── Kiểu màn ── Mỗi kiểu nhận S và k (lần thứ mấy kiểu đó xuất hiện) để đổi hướng xen kẽ.
  // Kiểu vào của một ảnh phủ kín ô: phóng từ gần, mở dần từ một mép (nội dung trôi theo), lật.
  const ENTER = [
    () => A("zoom", 0, { s0: 1.18, t: 1.8, keep: true }),
    () => A("reveal", 0, { from: "left", t: 1.4, drift: 120 }),
    () => A("reveal", 0, { from: "bottom", t: 1.4, drift: 120 }),
    () => A("zoom", 0, { s0: 0.82, t: 1.6 }),
    () => A("reveal", 0, { from: "right", t: 1.4, drift: 120 }),
    () => A("flip", 0, { t: 1.2 }),
    () => A("reveal", 0, { from: "top", t: 1.4, drift: 120 }),
  ];
  // Chuyển động trong lúc đứng: phóng vào, lùi ra, lia bốn hướng.
  const MOVE = ["in", "pan-u", true, "pan-r", "pan-d", "in", "pan-l", true];
  const TR = ["fade", "zoom", "slide", "fade", "split", "slide-up"];
  const FULL = { x: 0, y: 0, w: W, h: H };

  // Một ảnh phủ kín cả khung.
  const single = (k, ph) => (S) => {
    S.img({ ...FULL, kb: MOVE[k % MOVE.length] }, ENTER[k % ENTER.length](), ph);
    return S.done(5, TR[k % TR.length]);
  };

  // Hai ảnh: chia đôi (cột; khung dọc thì hàng), hoặc chia lệch 60/40 đổi bên xen kẽ. Hai ô mở ngược chiều nhau.
  const duo = (k, wide) => (S) => {
    const f = wide ? (k % 2 ? 0.4 : 0.6) : 0.5;
    if (TALL) {
      const a = Math.round((H - GAP) * f);
      S.img({ x: 0, y: 0, w: W, h: a, kb: "in" }, A("reveal", 0, { from: "left", t: 1.4, drift: 80 }));
      S.img({ x: 0, y: a + GAP, w: W, h: H - a - GAP, kb: true }, A("reveal", 3, { from: "right", t: 1.4, drift: 80 }));
      return S.done(5.5, k % 2 ? "slide-up" : "fade");
    }
    const a = Math.round((W - GAP) * f);
    S.img({ x: 0, y: 0, w: a, h: H, kb: "in" }, A("reveal", 0, { from: "top", t: 1.4, drift: 80 }));
    S.img({ x: a + GAP, y: 0, w: W - a - GAP, h: H, kb: true }, A("reveal", 3, { from: "bottom", t: 1.4, drift: 80 }));
    return S.done(5.5, k % 2 ? "split" : "fade");
  };

  // Ba cột: đều nhau, hoặc cột giữa to (0.3 / 0.4 / 0.3). Mở dần nối nhau, chiều đan xen.
  const trioCols = (k, mid) => (S) => {
    const ws = mid ? [0.3, 0.4, 0.3] : [1 / 3, 1 / 3, 1 / 3];
    const free = W - GAP * 2;
    let x = 0;
    ws.forEach((f, n) => {
      const w = n === 2 ? W - x : Math.round(free * f);
      const from = (n + k) % 2 ? "bottom" : "top";
      S.img({ x, y: 0, w, h: H, kb: n % 2 ? true : "in" }, A("reveal", n * 3, { from, t: 1.3, drift: 60 }));
      x += w + GAP;
    });
    return S.done(6, k % 2 ? "slide-up" : "slide");
  };

  // Ảnh lớn một bên + hai ảnh xếp chồng bên kia (đổi bên xen kẽ); khung dọc: ảnh lớn trên/dưới +
  // hai ảnh dọc kề nhau.
  const trioMain = (k) => (S) => {
    if (TALL) {
      const bh = Math.round((H - GAP) * 0.56);
      const sh = H - GAP - bh;
      const sw = (W - GAP) / 2;
      const top = k % 2 === 0;
      const by = top ? 0 : sh + GAP;
      const sy = top ? bh + GAP : 0;
      S.img({ x: 0, y: by, w: W, h: bh, kb: "in" }, A("zoom", 0, { s0: 1.15, t: 1.6, keep: true }));
      S.img({ x: 0, y: sy, w: sw, h: sh }, A("reveal", 4, { from: top ? "bottom" : "top", t: 1.3, drift: 60 }));
      S.img({ x: sw + GAP, y: sy, w: sw, h: sh }, A("reveal", 6, { from: top ? "bottom" : "top", t: 1.3, drift: 60 }));
      return S.done(6, "fade");
    }
    const bw = Math.round((W - GAP) * (SQ ? 0.6 : 0.62));
    const sw = W - GAP - bw;
    const sh = (H - GAP) / 2;
    const left = k % 2 === 0;
    const bx = left ? 0 : sw + GAP;
    const sx = left ? bw + GAP : 0;
    S.img({ x: bx, y: 0, w: bw, h: H, kb: "in" }, A("zoom", 0, { s0: 1.15, t: 1.6, keep: true }));
    S.img({ x: sx, y: 0, w: sw, h: sh }, A("reveal", 4, { from: left ? "right" : "left", t: 1.3, drift: 60 }));
    S.img({ x: sx, y: sh + GAP, w: sw, h: sh }, A("reveal", 6, { from: left ? "right" : "left", t: 1.3, drift: 60 }));
    return S.done(6, "fade");
  };

  // Nhịp màn theo khổ khung: ngang thì đa số ghép 2–3 ảnh (ảnh dọc lấp kín khung ngang), thỉnh
  // thoảng một ảnh tràn khung; vuông thì đa số một ảnh một khung, xen màn 2–3 ảnh.
  const RHYTHM = TALL
    ? ["one", "one", "one", "trioMain", "one", "one", "duo", "one", "one", "one", "trioMain", "one", "one", "duoWide"]
    : SQ
    ? ["one", "one", "one", "duo", "one", "one", "trioMain", "one", "one", "one", "duo", "one", "one", "trioMain"]
    : ["trioCols", "duo", "trioMain", "one", "duoWide", "trioMid", "duo", "trioMain", "trioCols", "one", "duoWide", "trioMid"];
  const SIZE = { one: 1, duo: 2, duoWide: 2, trioCols: 3, trioMid: 3, trioMain: 3 };
  const MAKE = {
    one: (k, ph) => single(k, ph),
    duo: (k) => duo(k, false),
    duoWide: (k) => duo(k, true),
    trioCols: (k) => trioCols(k, false),
    trioMid: (k) => trioCols(k, true),
    trioMain: (k) => trioMain(k),
  };

  function buildScenes(w, L) {
    const pool = _pool(w);
    const slot = { n: 1 };
    const scenes = [];
    const count = {}; // số lần mỗi kiểu đã dùng — để đổi hướng/kiểu vào xen kẽ
    let r = 0;
    while (slot.n <= SLOTS) {
      let kind = RHYTHM[r++ % RHYTHM.length];
      if (slot.n - 1 + SIZE[kind] > SLOTS) kind = "one"; // ô cuối lẻ thì lấp bằng màn một ảnh
      const n = SIZE[kind];
      const k = (count[kind] = (count[kind] ?? -1) + 1);
      const first = slot.n;
      const label = n === 1 ? `Ảnh ${first}` : `Ảnh ${first}–${first + n - 1}`;
      // Id cảnh theo khổ: hai tỉ lệ chia cảnh khác nhau nên thời lượng/thứ tự khách chỉnh không lẫn.
      const sid = `${TALL ? "t" : SQ ? "q" : "w"}${scenes.length + 1}`;
      // Ảnh bìa mở màn khi màn đầu là một ảnh (gọi own() ở chỗ khác là ăn mất một ảnh album).
      const fn = MAKE[kind](k, first === 1 && kind === "one" ? pool.own("cover_image_url") : null);
      scenes.push(fn(_stage(sid, label, L, pool, slot)));
    }
    scenes[scenes.length - 1].dur = 6; // màn cuối đứng thêm một nhịp trước khi quay vòng
    return scenes;
  }
})();
