// Hình nền LED "Hẹn Ước Trăm Năm" (1280×720): màn chờ chiếu LẶP lên LED sân khấu trong lúc khách
// tới — nền đen có dải ngân hà chạy chéo, sao sáng trôi chậm + sao băng; bốn cảnh nối vòng (chào đón trên
// ảnh bìa · tên + trái tim tự vẽ · lời mời an toạ · ba ảnh album). Giữa hai tên là trái tim vẽ
// bằng nét vàng, không dùng chữ "&". Chỉ KHAI cảnh (đăng ký vào CX_LED_TEMPLATES).

(function () {
  const W = 1280;
  const H = 720;
  const C = {
    void: "#000000",
    ivory: "#F7F2E8",
    soft: "rgba(247, 242, 232, 0.74)",
    champ: "#E8CD97",
    gold: "#C9A35E",
    line: "rgba(201, 163, 94, 0.5)",
    lineSoft: "rgba(201, 163, 94, 0.22)",
    empty: "#0B0B0E",
    // Bóng tối sau chữ: chữ đứng trên mây sáng của dải ngân hà vẫn rõ khi nhìn từ cuối hội trường.
    shade: "rgba(0, 0, 0, 0.9)",
  };
  const PF = '"Playfair Display", "Times New Roman", serif';
  const CO = '"Cormorant Infant", "Times New Roman", serif';
  const SC = '"TheHamstter", cursive';
  const F = {
    welcome: { family: SC, size: 132 },
    sub: { family: CO, size: 34, style: "italic" },
    kicker: { family: CO, size: 26, weight: 500 },
    names: { family: PF, size: 60 },
    name: { family: PF, size: 92 },
    date: { family: CO, size: 32, weight: 500 },
    digits: { family: PF, size: 40 },
    note: { family: CO, size: 26, style: "italic" },
    title: { family: PF, size: 50 },
    body: { family: CO, size: 30 },
    quote: { family: PF, size: 34, style: "italic" },
    sign: { family: PF, size: 30, style: "italic" },
  };
  // Nhịp trễ: 1 = 0.15 giây.
  const A = (k, n, o) => ({ k, d: n * 0.15, ...o });
  const GLOW = "rgba(232, 205, 151, 0.65)";
  const DUR = 16;

  // Một bầu trời DÙNG CHUNG cho mọi cảnh nền đêm (cùng một object → bộ vẽ dựng lớp tĩnh một lần,
  // lúc chuyển cảnh hai lớp trùng khít). Dải chạy chéo lên phải.
  const BAND = { x: 640, y: 360, angle: -26, width: 120 };
  // Dải ngân hà có mây sáng nhỏ rải đều dọc dải, KHÔNG có cụm sáng to ở lõi (bulge: false); sao
  // sáng trôi chậm sang trái (tầng gần trôi gấp đôi), sao băng ~6 giây một vệt.
  const SKY = { type: "sky", seed: 7, band: BAND, bulge: false, n: 170, dust: 2800, drift: 16, meteors: 6 };

  (window.CX_LED_TEMPLATES ||= []).push({
    id: "hen-uoc-tram-nam",
    name: "Hẹn Ước Trăm Năm",
    desc: "Nền đen dải ngân hà, bốn cảnh nối vòng",
    // Giây lấy làm ảnh tĩnh khi tải ảnh: cảnh tên + trái tim, nét đã vẽ xong.
    poster: 28,
    w: W,
    h: H,
    bg: C.void,
    // Chuyển cảnh chậm, êm — màn chờ chạy cả tiếng đồng hồ, không cần nhịp gấp.
    fade: 2.2,
    // Bộ dữ liệu mẫu (assets/data-template/<tên>/) khi chưa chọn thiệp.
    demo: "romantic-blush",
    fonts: [`400 92px ${PF}`, `400 60px ${PF}`, `italic 400 34px ${PF}`, `400 30px ${CO}`, `500 26px ${CO}`, `italic 400 34px ${CO}`, `500 32px ${CO}`, `400 132px ${SC}`],
    scenes: buildScenes,
  });

  const _day = (s) => (s ? new Date(s + "T00:00:00") : null);
  const _pad = (n) => String(n).padStart(2, "0");
  const _WEEKDAYS = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
  let _mctx = null;
  const _width = (font, s) => {
    _mctx ||= document.createElement("canvas").getContext("2d");
    _mctx.font = CXSlideEngine.fontStr(font);
    return _mctx.measureText(s).width;
  };

  // Kho ảnh: album quay vòng (thiếu thì lặp lại); album rỗng thì ảnh bìa, ảnh cô dâu, chú rể.
  function _pool(w) {
    const fps = w.image_focal_points || {};
    const one = (field) => (w[field] ? { file: w[field], fp: fps[field] } : null);
    let all = (Array.isArray(w.gallery_images) ? w.gallery_images : [])
      .filter(Boolean)
      .map((file) => ({ file, fp: fps.gallery_images?.[file] }));
    if (!all.length) all = [one("cover_image_url"), one("bride_image_url"), one("groom_image_url")].filter(Boolean);
    let at = 0;
    const next = () => (all.length ? all[at++ % all.length] : { file: "", fp: null });
    return { next, own: (field) => one(field) || next() };
  }

  // Trái tim nét mảnh, tâm (cx, cy), rộng s: đường cong trái tim cổ điển tách hai nửa cùng xuất
  // phát từ mũi nhọn dưới đáy — hiệu ứng "draw" vẽ hai nửa đối xứng gặp nhau ở chỗ lõm trên.
  function _heart(cx, cy, s, o = {}) {
    const k = s / 32;
    const pt = (t) => [
      cx + 16 * Math.sin(t) ** 3 * k,
      cy + (-(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) - 2.5) * k,
    ];
    const half = (dir) => Array.from({ length: 73 }, (_, i) => pt(Math.PI + (dir * Math.PI * i) / 72));
    return {
      type: "stroke", x: cx - s / 2, y: cy - s * 0.47, w: s, h: s * 0.94,
      paths: [half(-1), half(1)], color: C.champ, lw: o.lw ?? Math.max(1.6, s / 24), glow: GLOW, blur: s / 4, anim: o.anim,
    };
  }

  // Hai tên trên MỘT dòng, trái tim ở giữa; quá khổ thì thu cỡ chữ cho vừa.
  function _fitPair(b, maxW) {
    let size = b.font.size;
    const measure = () => {
      const f = { ...b.font, size };
      const hs = size * 0.56;
      const gap = size * 0.3;
      const wG = _width(f, b.pair[0]);
      const wB = _width(f, b.pair[1]);
      return { f, hs, gap, wG, wB, total: wG + wB + hs + gap * 2 };
    };
    let m = measure();
    if (m.total > maxW) {
      size = Math.floor((size * maxW) / m.total);
      m = measure();
    }
    return m;
  }

  // Một cảnh đang dựng (sid = id cảnh): gom phần tử, cột chữ canh giữa dọc trong [top, bottom].
  // Sửa được cả ảnh lẫn chữ ở tab "Cảnh" của trang, cùng quy ước với mẫu Slide cưới:
  // · img(…, slot): ô ảnh, L.photos[slot] đè ảnh thiệp; khai vào `photos` của cảnh {key, def, w, h}
  //   và mang `edit: slot` để bấm thẳng lên ảnh trên màn là mở đúng ô.
  // · MỌI khối chữ mang khoá `<sid>.<vị trí trong mảng khai>` (tính cả ô rỗng nên không xê dịch theo
  //   dữ liệu; hai tên của khối pair thêm `.0`/`.1`), L.texts[khoá] đè lời mẫu, sửa thành rỗng là bỏ
  //   khối; khai vào `texts` của cảnh {key, text, def}. Phần tử chữ giữ `key` để bấm lên là sửa.
  function _stage(L, sid) {
    const els = [];
    const photos = [];
    const texts = [];
    const say = (key, def) => {
      const own = L.texts?.[key];
      const text = typeof own === "string" ? own : String(def);
      texts.push({ key, text, def: String(def) });
      return text;
    };
    return {
      els,
      photos,
      texts,
      add: (...xs) => xs.forEach((x) => x && els.push(x)),
      img(rect, ph, o = {}, slot) {
        const def = ph.file ? getImageUrl(ph.file) : "";
        const mine = slot ? L.photos?.[slot] : null;
        if (slot) photos.push({ key: slot, def, w: rect.w, h: rect.h });
        els.push({ type: "image", kb: true, ...rect, src: mine?.src || def, focal: mine ? mine.focal : ph.fp, empty: C.empty, edit: slot, ...o });
      },
      // Ngoài khối chữ/vạch của bộ dàn chữ, cột nhận thêm hai khối: {pair: [tên, tên], font, …}
      // (hai tên + trái tim một dòng; xoá một tên thì còn tên kia, không tim) và {heart: cỡ} (trái
      // tim đứng riêng). Hai khối này giữ chỗ bằng một dòng chữ trong suốt, dàn xong thì thay bằng
      // phần tử thật đúng toạ độ đó. Cột có vạch `center` thì mọi vạch ra giữa cột.
      col(blocks, x, w, top, bottom) {
        const subs = new Map();
        const laid = [];
        blocks.forEach((b, k) => {
          if (!b) return;
          const key = `${sid}.${k}`;
          if (b.pair) {
            const two = [say(`${key}.0`, b.pair[0]), say(`${key}.1`, b.pair[1])];
            const keys = [`${key}.0`, `${key}.1`];
            const on = [0, 1].filter((n) => two[n].trim());
            if (!on.length) return;
            if (on.length === 1) return laid.push({ ...b, pair: undefined, text: two[on[0]], key: keys[on[0]] });
            const slot = `__slot${k}`;
            const fit = _fitPair({ ...b, pair: two }, w);
            subs.set(slot, { b, fit, two, keys });
            return laid.push({ text: "M", font: fit.f, color: "rgba(0, 0, 0, 0)", lh: b.lh ?? 1, mt: b.mt, key: slot });
          }
          if (b.heart) {
            const slot = `__slot${k}`;
            subs.set(slot, { b });
            return laid.push({ text: "M", font: { family: PF, size: b.heart }, color: "rgba(0, 0, 0, 0)", lh: b.lh ?? 1, mt: b.mt, key: slot });
          }
          if (b.text == null) return laid.push(b);
          const text = say(key, b.text);
          if (text.trim()) laid.push({ ...b, text, key });
        });
        const cen = laid.some((b) => b.line && b.center);
        L.column(laid, { x, w, top, bottom }).forEach((el) => {
          const sub = el.key && subs.get(el.key);
          if (!sub) {
            if (cen && el.type === "line") el.x = x + (w - el.w) / 2;
            return els.push(el);
          }
          const { b, fit, two, keys } = sub;
          const mid = el.y + el.h / 2;
          if (!fit) return els.push(_heart(x + w / 2, mid, b.heart, { anim: b.anim }));
          const x0 = b.align === "center" ? x + (w - fit.total) / 2 : x;
          const text = (n, tx, tw) => ({
            type: "text", x: tx, y: el.y, w: tw, tw, h: el.h, lines: [two[n]], lh: el.lh, font: fit.f, color: b.color,
            anim: b.anim, ls: 0, align: "left", shadow: b.shadow, key: keys[n],
          });
          els.push(
            text(0, x0, fit.wG),
            _heart(x0 + fit.wG + fit.gap + fit.hs / 2, mid, fit.hs, { anim: b.heartAnim }),
            text(1, x0 + fit.wG + fit.gap * 2 + fit.hs, fit.wB),
          );
        });
      },
    };
  }

  // Nền chung các cảnh đêm: chỉ bầu trời sao dùng chung.
  function _night(S) {
    S.add(SKY);
  }

  const rule = (n, center = true, w = 120) => ({ line: true, w, color: C.gold, mt: 28, center, anim: center ? A("zoom", n, { s0: 0.05 }) : A("spread", n) });

  function buildScenes(w, L) {
    const G = String(w.groom_name || "").trim() || "Chú rể";
    const B = String(w.bride_name || "").trim() || "Cô dâu";
    const pool = _pool(w);
    const cd = _day(w.ceremony_date);
    const dateLong = cd ? `${_WEEKDAYS[cd.getDay()]}, ngày ${cd.getDate()} tháng ${cd.getMonth() + 1} năm ${cd.getFullYear()}` : "";
    const dateNum = cd ? `${_pad(cd.getDate())} . ${_pad(cd.getMonth() + 1)} . ${cd.getFullYear()}` : "";
    const time = String(w.ceremony_time || "").trim();
    const scenes = [];
    const done = (id, label, S) => scenes.push({ id, label, dur: DUR, els: S.els, photos: S.photos, texts: S.texts });

    // --- Chào đón: ảnh bìa phủ kín, chìm dần vào đen ở nửa dưới, vài sao sáng trên phần tối ---
    {
      const S = _stage(L, "welcome");
      S.img({ x: 0, y: 0, w: W, h: H }, pool.own("cover_image_url"), { kb: "in", anim: A("fade", 0, { t: 2 }) }, "welcome");
      S.add(
        { type: "rect", x: 0, y: 0, w: W, h: H, fill: "rgba(0, 0, 0, 0.42)" },
        { type: "grad", x: 0, y: 0, w: W, h: H, stops: [[0, "rgba(0, 0, 0, 0.1)"], [0.5, "rgba(0, 0, 0, 0.55)"], [1, "rgba(0, 0, 0, 0.95)"]] },
        { type: "sky", seed: 11, base: false, x: 0, y: 380, w: W, h: H - 380, n: 60, drift: 16, alpha: 0.8 },
      );
      S.col(
        [
          { text: "Welcome", font: F.welcome, color: C.champ, lh: 1.05, align: "center", shadow: GLOW, anim: A("wipe", 2, { t: 2.2 }) },
          { text: "đến với lễ cưới của", font: F.sub, color: C.soft, lh: 1.2, align: "center", anim: A("fade", 9) },
          { pair: [G, B], font: F.names, color: C.ivory, lh: 1.15, mt: 24, align: "center", shadow: C.shade, anim: A("up", 11), heartAnim: A("draw", 12) },
          rule(15),
          dateLong && { text: dateLong, font: F.date, color: C.champ, lh: 1.3, mt: 24, align: "center", anim: A("up", 16) },
        ],
        120, W - 240, 80, H - 72,
      );
      done("welcome", "Chào đón", S);
    }

    // --- Tên + ngày cưới giữa dải ngân hà; trái tim tự vẽ nối hai tên ---
    {
      const S = _stage(L, "names");
      _night(S);
      S.col(
        [
          { text: w.ceremony_name || "Lễ Thành Hôn", font: F.kicker, color: C.champ, lh: 1.2, caps: true, ls: 8, align: "center", shadow: C.shade, anim: A("track", 2, { ls0: 24 }) },
          { text: G, font: F.name, color: C.ivory, lh: 1.05, mt: 20, align: "center", shadow: C.shade, anim: A("letters", 4) },
          { heart: 60, lh: 1.3, mt: 4, anim: A("draw", 9, { t: 2.6 }) },
          { text: B, font: F.name, color: C.ivory, lh: 1.05, mt: 4, align: "center", shadow: C.shade, anim: A("letters", 12) },
          rule(17),
          dateNum && { text: dateNum, font: F.digits, color: C.champ, lh: 1.2, mt: 28, ls: 6, align: "center", shadow: C.shade, anim: A("track", 18) },
          w.ceremony_lunar && { text: w.ceremony_lunar, font: F.note, color: C.soft, lh: 1.3, mt: 12, align: "center", shadow: C.shade, anim: A("fade", 21) },
        ],
        120, W - 240, 64, H - 64,
      );
      done("names", "Tên và ngày cưới", S);
    }

    // --- Lời mời an toạ: ảnh dọc bên trái, lời bên phải ---
    {
      const S = _stage(L, "seat");
      _night(S);
      S.add({ type: "frame", x: 72, y: 48, w: 432, h: 600, stroke: C.line, anim: A("fade", 4, { t: 2 }) });
      S.img({ x: 96, y: 72, w: 432, h: 600 }, pool.own("bride_image_url"), { anim: A("left", 0, { t: 2 }) }, "seat");
      S.col(
        [
          { text: "Trân trọng chào đón", font: F.kicker, color: C.champ, lh: 1.2, caps: true, ls: 6, shadow: C.shade, anim: A("fade", 3) },
          { text: "Cảm ơn quý vị đã đến chung vui", font: F.title, color: C.ivory, lh: 1.18, mt: 16, shadow: C.shade, anim: A("up", 4) },
          rule(6, false, 96),
          { text: "Mời quý vị an toạ. Hôn lễ sẽ sớm bắt đầu, xin được cùng quý vị chờ đón khoảnh khắc thiêng liêng này.", font: F.body, color: C.soft, lh: 1.5, mt: 28, shadow: C.shade, anim: A("up", 7) },
          time && { text: `Hôn lễ cử hành lúc ${time}`, font: F.date, color: C.champ, lh: 1.3, mt: 24, shadow: C.shade, anim: A("up", 9) },
          { pair: [G, B], font: F.sign, color: C.ivory, lh: 1.2, mt: 32, shadow: C.shade, anim: A("fade", 11), heartAnim: A("draw", 12, { t: 1.8 }) },
        ],
        616, 584, 64, H - 64,
      );
      done("seat", "Lời mời an toạ", S);
    }

    // --- Ba ảnh album + một câu ---
    {
      const S = _stage(L, "album");
      _night(S);
      const PW = 320;
      const PH = 420;
      const gap = 40;
      const x0 = (W - PW * 3 - gap * 2) / 2;
      [0, 1, 2].forEach((k) => {
        const x = x0 + k * (PW + gap);
        const y = k === 1 ? 64 : 92;
        S.add({ type: "frame", x: x - 10, y: y - 10, w: PW + 20, h: PH + 20, stroke: C.lineSoft, anim: A("fade", 3 + k * 2, { t: 1.6 }) });
        S.img({ x, y, w: PW, h: PH }, pool.next(), { anim: A("fly", k * 2, { from: "bottom", t: 1.8 }) }, `album-${k + 1}`);
      });
      S.col(
        [{ text: w.story_quote || "Cảm ơn vì đã chọn nhau giữa muôn người.", font: F.quote, color: C.ivory, lh: 1.3, align: "center", shadow: C.shade, anim: A("up", 9) }],
        100, W - 200, 556, H - 36,
      );
      done("album", "Album ảnh", S);
    }

    return scenes;
  }
})();
