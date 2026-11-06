// Slide sân khấu "Mãi Bên Nhau" (1280×720): bố cục tạp chí — nền hồng xám, mảng nâu be đặt
// lệch sau ảnh, tiêu đề tiếng Anh viết hoa dãn rộng, dải chữ dọc sát mép. Mỗi cảnh nhiều ảnh
// bay từ ngoài khung vào; thiệp ít ảnh thì ảnh lặp vòng cho đủ mọi khung. Chỉ KHAI cảnh
// (CX_SLIDE.scenes); vẽ/chạy/xuất là việc của engine + runtime dùng chung.

(function () {
  const W = 1280;
  const H = 720;
  const C = {
    paper: "#EFE7E6",
    blush: "#E8DEDD",
    taupe: "#C3B4AB",
    ink: "#5B4843",
    body: "#6F5D57",
    mute: "#BDAEA7",
    line: "#6B524C",
    white: "#FFFFFF",
    empty: "#DCD1CD",
    shade: "rgba(60, 42, 38, 0.45)",
  };
  const PF = '"Playfair Display", "Times New Roman", serif';
  const NS = '"Noto Serif", "Times New Roman", serif';
  const F = {
    hero: { family: PF, size: 88 },
    title: { family: PF, size: 64 },
    titleS: { family: PF, size: 52 },
    rail: { family: PF, size: 16 },
    railL: { family: PF, size: 20 },
    role: { family: PF, size: 22, style: "italic" },
    poem: { family: NS, size: 20, weight: 300 },
    story: { family: NS, size: 18, weight: 300 },
    storyS: { family: NS, size: 15, weight: 300 },
    head: { family: NS, size: 24, weight: 400 },
    small: { family: NS, size: 14, weight: 300 },
    smallL: { family: NS, size: 17, weight: 300 },
    name: { family: NS, size: 26, weight: 400 },
    // Lời cô dâu (gõ máy chữ, dài thì tự chia trang).
    speech: { family: NS, size: 22, weight: 300 },
  };
  // Nhịp trễ: 1 = 0.15 giây.
  const A = (k, n, o) => ({ k, d: n * 0.15, ...o });
  // Kiểu chữ: tiêu đề viết hoa dãn ~0.14em · chữ thơ dãn nhẹ, dòng thoáng.
  const T = (font, color, o) => ({ font, color, lh: 1.15, caps: true, ls: Math.round(font.size * 0.14), ...o });
  const P = (font, color, o) => ({ font, color, lh: 2, ls: 1, ...o });

  window.CX_SLIDE = {
    id: "mai-ben-nhau",
    w: W,
    h: H,
    bg: C.paper,
    fade: 1.1,
    demo: "ribbon-love",
    // Đốm sáng trôi lấp lánh phủ suốt slide.
    fx: { sparkle: { n: 26, size: 9, alpha: 0.75, seed: 3 } },
    fonts: [`400 64px ${PF}`, `italic 400 22px ${PF}`, `300 20px ${NS}`, `400 24px ${NS}`],
    scenes: buildScenes,
  };

  const _day = (s) => (s ? new Date(s + "T00:00:00") : null);
  const _on = (v) => v !== false && v !== "false";
  const _pad = (n) => String(n).padStart(2, "0");
  const _STORY_MAX = 4;

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

  // Một cảnh đang dựng. Mọi chữ qua S.t (khoá `<sid>.<tên>`, sửa ở "Chữ trong slide", sửa thành
  // rỗng là bỏ khối), mọi ảnh qua S.img (ô `<sid>.p<n>`, khách đổi ảnh riêng từng ô) — thêm chữ
  // hay ảnh không qua đây là chỗ đó không sửa được.
  function _stage(sid, label, L, pool) {
    const texts = [];
    const seen = new Set();
    const photos = [];
    const els = [];
    let len = 0;
    const S = {
      t(name, def, style) {
        return S.tk(`${sid}.${name}`, def, style);
      },
      // Như t nhưng khoá đặt sẵn — dùng chung một khoá cho nhiều cảnh (lời cô dâu dài chia trang).
      tk(key, def, style) {
        const own = L.texts?.[key];
        const text = typeof own === "string" ? own : String(def ?? "");
        if (!seen.has(key)) {
          seen.add(key);
          texts.push({ key, text, def: String(def ?? "") });
          len += text.length;
        }
        return text.trim() ? { ...style, text, key } : null;
      },
      img(n, rect, anim, ph) {
        const key = `${sid}.p${n}`;
        const src0 = ph || pool.next();
        const def = src0.file ? getImageUrl(src0.file) : "";
        const mine = L.photos?.[key];
        photos.push({ key, def, w: rect.w, h: rect.h });
        els.push({
          type: "image", kb: true, ...rect, src: mine?.src || def, focal: mine ? mine.focal : src0.fp,
          empty: C.empty, edit: key, anim,
        });
      },
      add(...xs) {
        xs.forEach((x) => x && els.push(x));
      },
      rect(x, y, w, h, fill, anim) {
        els.push({ type: "rect", x, y, w, h, fill, anim });
      },
      // Vạch dọc mảnh; anim null = đứng yên, bỏ trống = mở dần từ trên.
      vline(x, y, h, anim) {
        els.push({ type: "rect", x, y, w: 1.5, h, fill: C.line, anim: anim === undefined ? A("reveal", 4, { from: "top", t: 1.2 }) : anim || undefined });
      },
      grad(x, y, w, h, from, to, anim) {
        els.push({ type: "grad", x, y, w, h, stops: [[0, from], [1, to]], anim: anim || A("fade", 4) });
      },
      // Cột chữ trong khung x/w, canh giữa dọc trong [top, bottom] (bottom bỏ trống = neo đỉnh).
      col(blocks, x, w, top, bottom = top) {
        els.push(...L.column(blocks.filter(Boolean), { x, w, top, bottom }));
      },
      // Chữ dọc (xoay 90°), tâm tại (cx, cy).
      rail(block, cx, cy) {
        if (!block) return;
        const [el] = L.column([{ ...block, align: undefined }], { x: 0, w: 4000, top: 0, bottom: 0 });
        if (!el) return;
        Object.assign(el, { x: cx - el.tw / 2, w: el.tw, y: cy - el.h / 2, rot: 90 });
        els.push(el);
      },
      done(opt = {}) {
        const dur = Math.max(opt.dur || 8, Math.min(14, 5 + len * 0.022));
        return { id: sid, dur, label, tr: opt.tr, nofx: opt.nofx, bg: opt.bg, texts, photos, els };
      },
    };
    return S;
  }

  function buildScenes(w, L) {
    const G = String(w.groom_name || "").trim() || "Chú rể";
    const B = String(w.bride_name || "").trim() || "Cô dâu";
    const pool = _pool(w);
    const cd = _day(w.ceremony_date);
    const date = cd ? `${_pad(cd.getDate())}.${_pad(cd.getMonth() + 1)}.${cd.getFullYear()}` : "";
    const scenes = [];
    const add = (sid, label, fn) => {
      const S = _stage(sid, label, L, pool);
      scenes.push(S.done(fn(S)));
    };
    const shadow = { shadow: C.shade };

    // ── Mở đầu: ghép 5 ảnh, ảnh giữa phóng xuống, bốn ảnh bay từ bốn góc vào ──
    add("open", "Mở đầu", (S) => {
      S.img(2, { x: 380, y: 0, w: 520, h: 720, kb: "in" }, A("zoom", 0, { s0: 1.6, t: 2.2 }), pool.own("cover_image_url"));
      S.img(1, { x: 0, y: 244, w: 372, h: 476 }, A("fly", 2, { from: "left" }));
      S.img(0, { x: 0, y: 0, w: 372, h: 236 }, A("fly", 3, { from: "tl" }));
      S.img(3, { x: 908, y: 0, w: 372, h: 496 }, A("fly", 4, { from: "right" }));
      S.img(4, { x: 908, y: 504, w: 372, h: 216 }, A("fly", 5, { from: "br" }));
      S.grad(380, 0, 520, 220, "rgba(60,42,38,0.35)", "rgba(60,42,38,0)", A("fade", 7));
      S.grad(380, 360, 520, 360, "rgba(60,42,38,0)", "rgba(60,42,38,0.6)", A("fade", 7));
      S.rail(S.t("rail1", w.ceremony_name || "Lễ Thành Hôn", T(F.rail, C.white, { ls: 6, ...shadow, anim: A("reveal", 9, { from: "top" }) })), 420, 170);
      S.vline(419, 290, 96, A("reveal", 11, { from: "top" }));
      if (date) S.rail(S.t("rail2", date, T(F.rail, C.white, { ls: 6, ...shadow, anim: A("reveal", 10, { from: "top" }) })), 860, 170);
      S.vline(859, 290, 96, A("reveal", 12, { from: "top" }));
      S.col([S.t("names", `${G} & ${B}`, P(F.name, C.white, { align: "center", ls: 3, lh: 1.3, ...shadow, anim: A("letters", 14) }))], 380, 520, 452);
      S.col([S.t("title", "Wedding", T(F.hero, C.white, { align: "center", ls: 14, ...shadow, anim: A("track", 9, { ls0: 70, t: 2.6 }) }))], 300, 680, 500);
      S.col(
        [S.t("lines", "Vì thương nhau, hai ta chọn nắm tay đi hết đời này.\nVì có yêu thương, ngày bình thường cũng hoá kỷ niệm.\nCảm ơn những lời chúc phúc đã đưa chúng con đến hôm nay.", P(F.small, C.white, { align: "center", lh: 1.75, ls: 0.5, ...shadow, anim: A("lines", 20) }))],
        380, 520, 618,
      );
      return { dur: 10 };
    });

    // ── Đôi uyên ương: ảnh tràn khung lùi dần về, chữ dọc hai mép ──
    add("couple", "Đôi uyên ương", (S) => {
      S.img(0, { x: 0, y: 0, w: W, h: H, kb: "in" }, A("zoom", 0, { s0: 1.35, t: 2.6, keep: true }));
      S.grad(0, 360, W, 360, "rgba(60,42,38,0)", "rgba(60,42,38,0.55)", A("fade", 3));
      const rb = (n) => T(F.railL, C.white, { ls: 6, ...shadow, anim: A("reveal", n, { from: "top" }) });
      const bride = S.t("rail1", "My bride", rb(6));
      const groom = S.t("rail2", "My groom", rb(10));
      S.rail(bride, 96, 170);
      S.vline(95, 270, 180, A("reveal", 8, { from: "top", t: 1.4 }));
      S.rail(groom, 96, 560);
      S.rail(bride && { ...bride, anim: A("reveal", 7, { from: "top" }) }, 1184, 150);
      S.vline(1183, 260, 200, A("reveal", 9, { from: "top", t: 1.4 }));
      S.rail(groom && { ...groom, anim: A("reveal", 11, { from: "top" }) }, 1184, 580);
      S.col([S.t("title", "Our wedding", T(F.hero, C.white, { align: "center", ls: 14, ...shadow, anim: A("track", 6, { ls0: 80, t: 2.6 }) }))], 140, 1000, 410);
      S.col(
        [
          date && S.t("date", date, P(F.smallL, C.white, { align: "center", ls: 6, lh: 1.6, ...shadow, anim: A("letters", 14, { step: 0.06 }) })),
          S.t("lines", "Một đời, một lần thương, một người để cùng đi đến cuối con đường.\nTừ hôm nay, tay trong tay, hai ta cùng vun đắp một mái nhà.", P(F.small, C.white, { align: "center", lh: 1.8, mt: 12, ...shadow, anim: A("lines", 18) })),
        ],
        240, 800, 528,
      );
      return { dur: 9, tr: "zoom" };
    });

    // ── Lời cô dâu (~1 phút, ngay sau Mở đầu + Đôi uyên ương): gửi quan khách · bố mẹ · anh, viết
    // để cô dâu đọc thu âm ở tab Giọng. Xưng "con" với quan khách, bố mẹ; "em" với chồng; không
    // chèn tên ai. Chữ gõ như máy chữ ở nhịp nói (~15 ký tự/giây); phần dài quá khung tự CHIA
    // TRANG thành nhiều cảnh nối tiếp (ngắt ở cuối câu), mọi trang chung một khoá chữ.
    const SAY = [
      {
        id: "guests",
        title: "Dear guests",
        sub: "Gửi quý vị quan khách",
        text: "Kính thưa quý vị quan khách, con xin chân thành cảm ơn mọi người đã dành thời gian quý báu đến chung vui cùng gia đình hai bên trong ngày trọng đại hôm nay. Sự có mặt của quý vị là món quà ý nghĩa nhất, là lời chúc phúc mà chúng con sẽ luôn trân trọng trên chặng đường mới.",
      },
      {
        id: "family",
        title: "To my parents",
        sub: "Gửi bố mẹ hai bên",
        text: "Con xin gửi lời cảm ơn đến bố mẹ, những người đã sinh thành, nuôi nấng và dạy dỗ con nên người. Hôm nay con đi lấy chồng, con biết bố mẹ vừa mừng vừa có chút chạnh lòng. Con hứa sẽ sống thật hạnh phúc và mãi là đứa con ngoan của bố mẹ. Con cũng xin cảm ơn bố mẹ chồng đã đón nhận con như con gái trong nhà.",
      },
      {
        id: "husband",
        title: "To my husband",
        sub: "Gửi anh, chồng của em",
        text: "Còn anh, người em thương nhất, cảm ơn anh đã đến bên em, đã kiên nhẫn đi cùng em qua những ngày vui lẫn những lúc giận hờn. Cảm ơn anh đã luôn lắng nghe, nhường nhịn và che chở cho em, kể cả những khi em bướng bỉnh nhất. Em không hứa mọi ngày sau này đều dễ dàng, nhưng em hứa sẽ luôn nắm chặt tay anh, cùng anh đi qua mọi vui buồn của cuộc sống. Mình sẽ cùng nhau vun đắp một mái nhà nhỏ, nơi có tiếng cười, có bữa cơm chờ nhau mỗi tối và có những đứa trẻ đáng yêu sau này. Khi anh mệt, em sẽ ở đây. Khi em yếu lòng, mong anh vẫn dịu dàng như ngày hôm nay. Từ hôm nay, mình là một nhà. Em yêu anh, anh nhé.",
      },
    ];
    const SAY_CPS = 15;
    const SAY_FONT = F.speech;
    const SAY_X = 664;
    const SAY_W = 548;
    const SAY_LINES = 9; // số dòng tối đa của đoạn lời mỗi trang
    // Câu → trang: dồn câu vào trang tới khi quá SAY_LINES dòng; câu dài hơn một trang thì cắt theo từ.
    const paginate = (text) => {
      const fit = (t) => L.wrap(t, SAY_FONT, SAY_W).length <= SAY_LINES;
      const pages = [];
      let cur = "";
      const push = (piece, sep) => {
        const next = cur ? cur + sep + piece : piece;
        if (fit(next)) return (cur = next);
        if (cur) pages.push(cur);
        cur = "";
        if (fit(piece)) return (cur = piece);
        piece.split(/\s+/).forEach((w) => {
          const nx = cur ? cur + " " + w : w;
          if (cur && !fit(nx)) {
            pages.push(cur);
            cur = w;
          } else cur = nx;
        });
      };
      String(text)
        .split(/\n+/)
        .forEach((para, pi) => {
          (para.match(/[^.!?…]+[.!?…]*\s*/g) || []).forEach((sent, si) => {
            const t = sent.trim();
            if (t) push(t, pi > 0 && si === 0 ? "\n" : " ");
          });
        });
      if (cur) pages.push(cur);
      return pages;
    };
    const parts = SAY.map((p) => {
      const key = `${p.id}.say`;
      const own = L.texts?.[key];
      return { ...p, key, full: typeof own === "string" ? own : p.text };
    }).filter((p) => p.full.trim());
    parts.forEach((p, k) => {
      const pages = paginate(p.full);
      pages.forEach((page, n) => {
        const sid = n ? `${p.id}-${n + 1}` : p.id;
        const label = `Cô dâu ${p.sub.charAt(0).toLowerCase()}${p.sub.slice(1)}${pages.length > 1 ? ` (${n + 1}/${pages.length})` : ""}`;
        const first = k === 0 && n === 0;
        add(sid, label, (S) => {
          // Khung chung cho mọi trang: dải chữ dọc "Lời cô dâu" · ảnh cô dâu trên mảng nâu · cột chữ.
          S.rect(0, 0, 104, 720, C.blush);
          S.rect(104, 432, 272, 288, C.taupe, first ? A("reveal", 0, { from: "bottom", t: 1 }) : null);
          const rail = S.tk("say.rail", "Lời cô dâu", T(F.rail, C.ink, { ls: 8, anim: first ? A("reveal", 4, { from: "top" }) : null }));
          S.rail(rail, 52, 250);
          S.vline(51, 400, 240, first ? A("reveal", 7, { from: "top", t: 1.2 }) : null);
          S.img(0, { x: 136, y: 56, w: 480, h: 608 }, first ? A("fly", 1, { from: "left" }) : null, k === 0 && n === 0 ? pool.own("bride_image_url") : null);
          const head = n === 0;
          const title = S.tk(`${p.id}.title`, p.title, T(F.titleS, C.ink, { ls: 7, anim: head ? A("track", 2, { ls0: 30 }) : null }));
          const sub = S.tk(`${p.id}.sub`, p.sub, { font: F.role, color: C.body, lh: 1.4, mt: 10, anim: head ? A("fade", 5) : null });
          const full = S.tk(p.key, p.text, P(SAY_FONT, C.body, { lh: 1.9, ls: 0, mt: 28 }));
          const at = head ? 1.4 : 0.6;
          const body = full && { ...full, text: page, anim: { k: "type", d: at, cps: SAY_CPS } };
          S.col([title, sub, body], SAY_X, SAY_W, 64);
          // Vạch tiến độ ba phần: phần đang nói dài + đậm.
          parts.forEach((_, j) =>
            S.rect(SAY_X + j * 60 + (j > k ? 48 : 0), 656, j === k ? 96 : 48, 2, j === k ? C.ink : C.mute),
          );
          return { dur: at + Array.from(page).length / SAY_CPS + 2.5, tr: first ? "split" : "fade", nofx: true };
        });
      });
    });

    // ── Chú rể: chữ trái, ảnh vuông phải đè mảng nâu ──
    add("groom", "Chú rể", (S) => {
      S.rect(476, 264, 804, 456, C.taupe, A("reveal", 0, { from: "bottom", t: 1.2 }));
      S.img(0, { x: 672, y: 84, w: 482, h: 482 }, A("fly", 3, { from: "right", s0: 0.85 }), pool.own("groom_image_url"));
      S.col(
        [
          S.t("title", "My groom", T(F.title, C.ink, { ls: 9, anim: A("track", 5, { ls0: 40 }) })),
          S.t("en", "Of all the roads I have walked,\nthe one that led to you is my favourite.", P(F.small, C.body, { lh: 1.8, mt: 16, anim: A("lines", 9) })),
          S.t("poem", "Gặp em là điều may mắn nhất\nanh từng có trong đời.\nTừ hôm nay, anh xin được\nche chở, nhường nhịn và thương em\nqua mọi mùa mưa nắng.", P(F.poem, C.ink, { lh: 2.2, ls: 2, mt: 28, anim: A("lines", 13) })),
        ],
        44, 420, 60,
      );
      S.add({ type: "line", x: 36, y: 652, w: 440, color: C.line, anim: A("spread", 18) });
      return { dur: 10, tr: "slide" };
    });

    // ── Bộ cảnh album (đủ bộ dù thiệp ít ảnh — ảnh lặp vòng) ──
    const albums = [
      // Khối nâu trên, ảnh lớn dưới, hai ảnh dọc phải.
      (S) => {
        S.rect(0, 0, 166, 720, C.blush);
        S.vline(68, 0, 500, A("reveal", 3, { from: "top", t: 1.4 }));
        S.rail(S.t("rail", "Wedding", T(F.rail, C.ink, { ls: 8, anim: A("reveal", 7, { from: "top" }) })), 69, 610);
        S.rect(166, 0, 846, 270, C.taupe, A("reveal", 0, { from: "left", t: 1.2 }));
        S.img(0, { x: 166, y: 270, w: 816, h: 450 }, A("fly", 2, { from: "bottom", s0: 0.9 }));
        S.img(1, { x: 1012, y: 0, w: 268, h: 396 }, A("fly", 4, { from: "right" }));
        S.img(2, { x: 1012, y: 404, w: 268, h: 186 }, A("fly", 6, { from: "br" }));
        S.col([S.t("title", "My love", T(F.title, C.white, { ls: 10, anim: A("track", 4, { ls0: 50 }) }))], 202, 760, 26);
        S.col([S.t("lines", "Gió hôm nay ngọt ngào đến lạ,\nnắng hôm nay cũng dịu dàng hơn.\nXin nhận lời chúc phúc của mọi người\nđể cùng nhau đi tới bạc đầu.", P(F.small, C.white, { lh: 2.1, ls: 1, anim: A("lines", 8) }))], 204, 760, 112);
        return { dur: 8, tr: "slide" };
      },
      // Ảnh ngang lớn mở dần, ENDLESS LOVE góc dưới trái, vạch + chữ ký chân phải.
      (S) => {
        S.rect(0, 476, 260, 244, C.taupe, A("reveal", 0, { from: "left", t: 1 }));
        S.img(0, { x: 210, y: 0, w: 898, h: 668 }, A("reveal", 1, { from: "left", t: 1.8, drift: 160 }));
        S.rect(1108, 0, 172, 268, C.taupe, A("reveal", 5, { from: "top", t: 1 }));
        S.col([S.t("lines", "Điều chắc chắn\nlà em\nNgười duy nhất\nlà em", P(F.small, C.white, { align: "right", lh: 2.2, ls: 2, anim: A("lines", 8) }))], 1112, 148, 30, 240);
        S.col([S.t("title", "Endless\nlove", T(F.title, C.white, { ls: 10, lh: 1.2, ...shadow, anim: A("track", 7, { ls0: 40 }) }))], 66, 600, 488);
        S.add({ type: "line", x: 412, y: 698, w: 284, color: C.line, anim: A("spread", 11) });
        S.col([S.t("sign", "Forever and ever", T(F.railL, C.ink, { ls: 7, lh: 1, anim: A("letters", 12, { step: 0.05 }) }))], 712, 560, 688);
        return { dur: 8, tr: "zoom" };
      },
      // Ảnh dọc + ảnh ngang trên dải nâu, WITH YOU canh phải.
      (S) => {
        S.rect(66, 462, 1188, 232, C.taupe, A("reveal", 0, { from: "right", t: 1.2 }));
        S.img(0, { x: 108, y: 64, w: 462, h: 614 }, A("fly", 2, { from: "bottom" }));
        S.img(1, { x: 586, y: 64, w: 624, h: 466 }, A("fly", 4, { from: "top" }));
        S.col([S.t("title", "With you", T(F.title, C.white, { align: "right", ls: 9, anim: A("track", 8, { ls0: 40 }) }))], 586, 624, 534);
        S.col([S.t("lines", "Through every season, side by side,\nwe will always find our way home.", P(F.small, C.white, { align: "right", lh: 1.7, anim: A("lines", 12) }))], 586, 624, 616);
        return { dur: 8, tr: "split" };
      },
      // Ba ảnh: hai ảnh cao bay vào, ảnh nhỏ phải, MY LOVE dưới ảnh nhỏ.
      (S) => {
        S.img(0, { x: 30, y: 64, w: 444, h: 592 }, A("fly", 1, { from: "left" }));
        S.img(1, { x: 484, y: 64, w: 444, h: 592 }, A("fly", 4, { from: "bottom" }));
        S.img(2, { x: 938, y: 64, w: 312, h: 346 }, A("fly", 6, { from: "right" }));
        S.col([S.t("title", "My love", T(F.titleS, C.ink, { align: "center", ls: 7, anim: A("track", 9, { ls0: 30 }) }))], 920, 348, 446);
        S.col([S.t("lines", "Ta đợi nhau qua bao mùa nắng\nđể hỏi một câu thật khẽ:\nmình về chung một nhà, em nhé?", P(F.small, C.body, { align: "center", lh: 1.9, anim: A("lines", 12) }))], 920, 348, 526);
        return { dur: 8, tr: "slide" };
      },
      // Ảnh dọc lớn + ảnh dọc nhỏ, thơ phải, WITH YOU trên dải nâu.
      (S) => {
        S.rect(66, 462, 1188, 232, C.taupe, A("reveal", 0, { from: "left", t: 1.2 }));
        S.img(0, { x: 140, y: 66, w: 456, h: 608 }, A("fly", 1, { from: "left" }));
        S.img(1, { x: 604, y: 66, w: 244, h: 438 }, A("fly", 4, { from: "top" }));
        S.col([S.t("poem", "Ngày xưa, người trước mặt\nlà người trong lòng.\nMai sau, người trong lòng\nlà người kề bên.\nTay nhỏ nắm tay to,\ncùng nhau đi hết đời.", P(F.story, C.ink, { lh: 2.3, ls: 1.5, anim: A("lines", 7) }))], 880, 380, 80, 420);
        S.col([S.t("title", "With you", T(F.title, C.white, { align: "right", ls: 9, anim: A("track", 10, { ls0: 40 }) }))], 760, 480, 524);
        S.col([S.t("lines", "I love you more than yesterday,\nand a little less than tomorrow.", P(F.small, C.white, { align: "right", lh: 1.7, anim: A("lines", 14) }))], 760, 480, 608);
        return { dur: 8, tr: "slide-up" };
      },
      // Hai ảnh cao kề nhau, OUR WEDDING vắt ngang giữa, chữ dọc mép trái.
      (S) => {
        S.rect(0, 640, 454, 80, C.taupe, A("reveal", 0, { from: "left", t: 1 }));
        S.vline(68, 26, 420, A("reveal", 2, { from: "top", t: 1.4 }));
        S.rail(S.t("rail", "Wedding", T(F.rail, C.ink, { ls: 8, anim: A("reveal", 6, { from: "top" }) })), 69, 540);
        S.img(0, { x: 220, y: 26, w: 500, h: 666 }, A("fly", 1, { from: "left" }));
        S.img(1, { x: 726, y: 26, w: 500, h: 666 }, A("fly", 3, { from: "right" }));
        S.col([S.t("title", "Our wedding", T(F.hero, C.white, { align: "center", ls: 14, ...shadow, anim: A("track", 8, { ls0: 70, t: 2.4 }) }))], 220, 1006, 312);
        return { dur: 8, tr: "zoom" };
      },
      // Ảnh dọc + ảnh ngang tràn mép phải, OUR WEDDING chân ảnh.
      (S) => {
        S.vline(96, 70, 320, A("reveal", 2, { from: "top", t: 1.2 }));
        S.rail(S.t("rail", "Wedding", T(F.rail, C.ink, { ls: 8, anim: A("reveal", 6, { from: "top" }) })), 97, 466);
        S.rect(0, 558, 318, 162, C.taupe, A("reveal", 0, { from: "bottom", t: 1 }));
        S.img(0, { x: 206, y: 98, w: 398, h: 532 }, A("fly", 1, { from: "bl" }));
        S.img(1, { x: 612, y: 98, w: 668, h: 532 }, A("fly", 3, { from: "tr" }));
        S.col([S.t("title", "Our wedding", T(F.hero, C.white, { align: "center", ls: 14, ...shadow, anim: A("track", 8, { ls0: 70, t: 2.4 }) }))], 240, 1000, 530);
        return { dur: 8, tr: "split" };
      },
    ];

    // ── Chuyện tình: mỗi mốc một cảnh, hai bố cục xen kẽ ──
    const story = _on(w.enable_love_story) && Array.isArray(w.love_story)
      ? w.love_story.filter((ev) => ev && (ev.title || ev.content)).slice(0, _STORY_MAX)
      : [];
    const storyCol = (S, ev, x, wid, titleColor) => {
      const long = String(ev.content || "").length > 260;
      S.col(
        [
          S.t("title", "With you", T(F.titleS, titleColor, { ls: 7, anim: A("track", 4, { ls0: 30 }) })),
          ev.date && S.t("date", ev.date, P(F.small, C.body, { ls: 3, lh: 1.4, mt: 18, anim: A("fade", 7) })),
          ev.title && S.t("head", ev.title, P(F.head, C.ink, { lh: 1.4, mt: 10, anim: A("up", 8) })),
          ev.content && S.t("text", ev.content, P(long ? F.storyS : F.story, C.body, { lh: 1.9, mt: 18, anim: A("lines", 10, { step: 0.14 }) })),
        ],
        x, wid, 70, 650,
      );
    };
    const storyScene = (ev, k) => (S) => {
      const ph = ev.image_url ? { file: ev.image_url, fp: ev.focal_point } : null;
      if (k % 2 === 0) {
        S.rect(0, 360, 476, 360, C.taupe, A("reveal", 0, { from: "bottom", t: 1.1 }));
        S.img(0, { x: 130, y: 86, w: 692, h: 520 }, A("fly", 2, { from: "left" }), ph);
        S.col([S.t("deco", "Happy days", T(F.titleS, C.white, { ls: 8, alpha: 0.9, ...shadow, anim: A("track", 8, { ls0: 30 }) }))], 130, 700, 590);
        storyCol(S, ev, 868, 380, C.mute);
      } else {
        S.rect(0, 400, 300, 320, C.taupe, A("reveal", 0, { from: "left", t: 1.1 }));
        S.img(0, { x: 102, y: 0, w: 652, h: 644 }, A("fly", 2, { from: "top", s0: 1.15 }), ph);
        S.col([S.t("deco", "Endless\nlove", T(F.title, C.white, { ls: 10, lh: 1.1, ...shadow, anim: A("track", 8, { ls0: 40 }) }))], 270, 480, 500);
        storyCol(S, ev, 812, 420, C.ink);
      }
      return { dur: 9, tr: k % 2 ? "zoom" : "slide" };
    };

    // ── Hai bên: MY BRIDE / MY GROOM, thơ ở giữa trên nền xẻ đôi ──
    const pair = (S) => {
      S.rect(0, 426, W, 294, C.taupe, A("reveal", 0, { from: "bottom", t: 1.1 }));
      S.img(0, { x: 60, y: 164, w: 400, h: 400 }, A("fly", 2, { from: "left" }), pool.own("bride_image_url"));
      S.img(1, { x: 820, y: 164, w: 400, h: 400 }, A("fly", 4, { from: "right" }), pool.own("groom_image_url"));
      S.col([S.t("bride", "My bride", T({ family: PF, size: 44 }, C.white, { align: "center", ls: 6, ...shadow, anim: A("track", 8, { ls0: 30 }) }))], 60, 400, 494);
      S.col([S.t("groom", "My groom", T({ family: PF, size: 44 }, C.white, { align: "center", ls: 6, ...shadow, anim: A("track", 10, { ls0: 30 }) }))], 820, 400, 494);
      S.col([S.t("poem", "Lần đầu gặp, đã thấy rung động\nGặp lại rồi, đã thấy thương\nNăm tháng đưa hai trái tim lại gần\nthành một nửa vẹn tròn của nhau", P(F.story, C.ink, { align: "center", lh: 2.2, ls: 1.5, anim: A("lines", 9) }))], 470, 340, 200, 420);
      S.col([S.t("en", "At first sight my heart was moved,\nat second sight it was yours.", P(F.small, C.white, { align: "center", lh: 1.8, anim: A("lines", 14) }))], 470, 340, 448);
      return { dur: 10, tr: "slide-up" };
    };

    // Thứ tự: album xen chuyện tình, cảnh hai bên đứng trước album cuối.
    let a = 0;
    const album = () => {
      const i = a++;
      add(`album${i}`, `Album ${i + 1}`, albums[i]);
    };
    album();
    album();
    story.forEach((ev, k) => {
      add(`story${k}`, ev.title || ev.date || `Chuyện tình ${k + 1}`, storyScene(ev, k));
      if (a < albums.length - 2) album();
    });
    while (a < albums.length - 1) album();
    add("pair", "Hai bên", pair);
    album();

    // ── Trái tim: mười ảnh bay từ mọi hướng vào xếp thành hình trái tim, tên hai bạn ở hai bên ──
    add("heart", "Trái tim", (S) => {
      S.add({ type: "grad", x: 0, y: 0, w: W, h: H, stops: [[0, "#F3ECEA"], [1, "#E9DEDB"]] });
      S.add({ type: "sparkle", x: 0, y: 0, w: W, h: H, n: 90, size: 13, alpha: 0.95, seed: 7 });
      const fr = S.t("rail", "Forever and ever", T(F.rail, C.ink, { ls: 6, anim: A("reveal", 2, { from: "top" }) }));
      S.rail(fr, 76, 160);
      S.rail(fr && { ...fr, anim: A("reveal", 3, { from: "top" }) }, 1204, 560);
      const cells = [
        { x: 480, y: 168, w: 320, h: 320 },
        { x: 296, y: 168, w: 176, h: 176 },
        { x: 352, y: 32, w: 240, h: 128 },
        { x: 688, y: 32, w: 240, h: 128 },
        { x: 808, y: 168, w: 176, h: 176 },
        { x: 808, y: 352, w: 128, h: 136 },
        { x: 644, y: 496, w: 156, h: 96 },
        { x: 584, y: 600, w: 112, h: 96 },
        { x: 480, y: 496, w: 156, h: 96 },
        { x: 344, y: 352, w: 128, h: 136 },
      ];
      cells.forEach((c, k) => {
        if (!k) return S.img(0, c, A("fly", 1, { from: "top" }), pool.own("cover_image_url"));
        const ang = (Math.atan2(c.y + c.h / 2 - 360, c.x + c.w / 2 - 640) * 180) / Math.PI;
        S.img(k, c, A("fly", 3 + k * 1.3, { from: ang, s0: 0.6, t: 1.3 }));
      });
      const side = (n, role, name, x) =>
        S.col(
          [
            S.t(`${n}r`, role, { font: F.role, color: C.body, lh: 1.3, align: "center", anim: A("fade", 17) }),
            S.t(n, name, P(F.head, C.ink, { align: "center", lh: 1.3, mt: 4, ls: 2, anim: A("letters", 18) })),
          ],
          x, 176, 496, 592,
        );
      side("groom", "Groom", G, 296);
      side("bride", "Bride", B, 808);
      return { dur: 12, tr: "zoom" };
    });

    // ── Lời cảm ơn: ảnh tràn khung, THANK YOU dãn rồi khép ──
    add("thanks", "Lời cảm ơn", (S) => {
      S.img(0, { x: 0, y: 0, w: W, h: H, kb: true }, A("zoom", 0, { s0: 1.3, t: 2.6, keep: true }), pool.own("cover_image_url"));
      S.grad(0, 300, W, 420, "rgba(60,42,38,0)", "rgba(60,42,38,0.6)", A("fade", 2));
      const rail = S.t("rail", "Forever and ever", T(F.rail, C.white, { ls: 6, ...shadow, anim: A("reveal", 6, { from: "top" }) }));
      S.rail(rail, 96, 200);
      S.vline(95, 330, 200, A("reveal", 8, { from: "top" }));
      S.rail(rail && { ...rail, anim: A("reveal", 7, { from: "top" }) }, 1184, 520);
      S.vline(1183, 190, 200, A("reveal", 9, { from: "top" }));
      S.col([S.t("title", "Thank you", T(F.hero, C.white, { align: "center", ls: 14, ...shadow, anim: A("track", 5, { ls0: 80, t: 2.6 }) }))], 140, 1000, 392);
      S.col(
        [
          S.t("lines", "Sự hiện diện của quý vị đã làm ngày vui của chúng con thêm trọn vẹn.\nKính chúc quý vị luôn mạnh khoẻ, hạnh phúc và bình an.", P(F.small, C.white, { align: "center", lh: 1.9, ...shadow, anim: A("lines", 12) })),
          S.t("names", `${G} & ${B}`, P(F.name, C.white, { align: "center", lh: 1.3, ls: 3, mt: 20, ...shadow, anim: A("letters", 18) })),
        ],
        240, 800, 512,
      );
      return { dur: 10, tr: "zoom" };
    });

    return scenes;
  }
})();
