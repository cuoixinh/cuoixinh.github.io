// Hình nền LED "Hẹn Ước Trăm Năm" (1280×720): màn chờ chiếu LẶP lên LED sân khấu trong lúc khách
// tới — nền đêm tím than, quầng sáng vàng/hồng trôi chậm, đốm lấp lánh; bốn cảnh nối vòng (chào
// đón trên ảnh bìa · tên + ngày cưới · lời mời an toạ · ba ảnh album). Chữ sáng trên nền tối vì
// LED trong hội trường tối, nền trắng sẽ chói. Chỉ KHAI cảnh (đăng ký vào CX_LED_TEMPLATES).

(function () {
  const W = 1280;
  const H = 720;
  const C = {
    night: "#150E1D",
    deep: "#0E0915",
    ivory: "#FBF4E8",
    soft: "rgba(251, 244, 232, 0.76)",
    champ: "#EBD3A0",
    gold: "#C9A35E",
    line: "rgba(201, 163, 94, 0.55)",
    lineSoft: "rgba(201, 163, 94, 0.24)",
    empty: "#2A1F33",
    veil: "rgba(16, 10, 22, 0.5)",
  };
  const PF = '"Playfair Display", "Times New Roman", serif';
  const CO = '"Cormorant Infant", "Times New Roman", serif';
  const SC = '"TheHamstter", cursive';
  const F = {
    welcome: { family: SC, size: 132 },
    amp: { family: SC, size: 84 },
    sub: { family: CO, size: 34, style: "italic" },
    kicker: { family: CO, size: 32, style: "italic", weight: 500 },
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
  const GLOW = "rgba(235, 211, 160, 0.55)";
  const DUR = 16;

  (window.CX_LED_TEMPLATES ||= []).push({
    id: "hen-uoc-tram-nam",
    name: "Hẹn Ước Trăm Năm",
    desc: "Nền đêm ánh vàng, bốn cảnh nối vòng",
    // Giây lấy làm ảnh tĩnh khi tải ảnh: cảnh tên + ngày cưới, chữ đã hiện hết.
    poster: 28,
    w: W,
    h: H,
    bg: C.deep,
    // Chuyển cảnh chậm, êm — màn chờ chạy cả tiếng đồng hồ, không cần nhịp gấp.
    fade: 2.2,
    // Bộ dữ liệu mẫu (assets/data-template/<tên>/) khi chưa chọn thiệp.
    demo: "romantic-blush",
    fx: { sparkle: { n: 44, size: 8, alpha: 0.7, seed: 5 } },
    fonts: [`400 60px ${PF}`, `italic 400 34px ${PF}`, `400 30px ${CO}`, `italic 400 34px ${CO}`, `italic 500 32px ${CO}`, `400 84px ${SC}`],
    scenes: buildScenes,
  });

  const _day = (s) => (s ? new Date(s + "T00:00:00") : null);
  const _pad = (n) => String(n).padStart(2, "0");
  const _WEEKDAYS = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];

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

  // Một cảnh đang dựng: gom phần tử, cột chữ canh giữa dọc trong [top, bottom].
  function _stage(L) {
    const els = [];
    return {
      els,
      add: (...xs) => xs.forEach((x) => x && els.push(x)),
      img(rect, ph, o = {}) {
        els.push({ type: "image", kb: true, ...rect, src: ph.file ? getImageUrl(ph.file) : "", focal: ph.fp, empty: C.empty, ...o });
      },
      // Cột có vạch `center` thì mọi vạch ra giữa cột (bộ dàn chữ đặt vạch sát mép trái).
      col(blocks, x, w, top, bottom) {
        const cen = blocks.some((b) => b?.line && b.center);
        L.column(blocks.filter(Boolean), { x, w, top, bottom }).forEach((el) => {
          if (cen && el.type === "line") el.x = x + (w - el.w) / 2;
          els.push(el);
        });
      },
    };
  }

  // Nền chung mọi cảnh: dải tối + ba quầng sáng trôi. Cùng vị trí ở mọi cảnh và chu kỳ = thời
  // lượng cảnh nên lúc chuyển cảnh nền đứng yên, chỉ lớp nội dung đổi.
  function _night(S) {
    S.add(
      { type: "grad", x: 0, y: 0, w: W, h: H, stops: [[0, C.night], [1, C.deep]] },
      { type: "orb", x: 220, y: 150, r: 460, color: "rgba(201, 163, 94, 0.30)", dx: 90, dy: 40 },
      { type: "orb", x: 1080, y: 580, r: 520, color: "rgba(214, 118, 150, 0.24)", dx: 70, dy: 50, phase: 2 },
      { type: "orb", x: 660, y: 380, r: 360, color: "rgba(120, 82, 170, 0.18)", dx: 120, dy: 30, phase: 4 },
    );
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
    const done = (id, label, S) => scenes.push({ id, label, dur: DUR, els: S.els });

    // --- Chào đón: ảnh bìa phủ kín, phủ màn tối, chữ giữa ---
    {
      const S = _stage(L);
      S.img({ x: 0, y: 0, w: W, h: H }, pool.own("cover_image_url"), { kb: "in", anim: A("fade", 0, { t: 2 }) });
      S.add(
        { type: "rect", x: 0, y: 0, w: W, h: H, fill: C.veil },
        { type: "grad", x: 0, y: 0, w: W, h: H, stops: [[0, "rgba(14, 9, 21, 0.15)"], [0.55, "rgba(14, 9, 21, 0.55)"], [1, "rgba(14, 9, 21, 0.92)"]] },
        { type: "orb", x: 640, y: 300, r: 420, color: "rgba(201, 163, 94, 0.16)", dx: 60, dy: 20 },
      );
      S.col(
        [
          { text: "Welcome", font: F.welcome, color: C.champ, lh: 1.05, align: "center", shadow: GLOW, anim: A("wipe", 2, { t: 2.2 }) },
          { text: "đến với lễ cưới của", font: F.sub, color: C.soft, lh: 1.2, align: "center", anim: A("fade", 9) },
          { text: `${G} & ${B}`, font: F.names, color: C.ivory, lh: 1.15, mt: 24, align: "center", anim: A("up", 11) },
          rule(13),
          dateLong && { text: dateLong, font: F.date, color: C.champ, lh: 1.3, mt: 24, align: "center", anim: A("up", 14) },
        ],
        160, W - 320, 80, H - 72,
      );
      done("welcome", "Chào đón", S);
    }

    // --- Tên + ngày cưới trên nền đêm, khung đôi ---
    {
      const S = _stage(L);
      _night(S);
      S.add(
        { type: "frame", x: 40, y: 40, w: W - 80, h: H - 80, stroke: C.line, anim: A("fade", 0, { t: 2 }) },
        { type: "frame", x: 54, y: 54, w: W - 108, h: H - 108, stroke: C.lineSoft, anim: A("fade", 2, { t: 2 }) },
      );
      S.col(
        [
          { text: w.ceremony_name || "Lễ Thành Hôn", font: F.kicker, color: C.champ, lh: 1.2, align: "center", anim: A("fade", 2) },
          { text: G, font: F.name, color: C.ivory, lh: 1.05, mt: 16, align: "center", anim: A("letters", 4) },
          { text: "&", font: F.amp, color: C.gold, lh: 0.9, align: "center", shadow: GLOW, anim: A("fade", 9) },
          { text: B, font: F.name, color: C.ivory, lh: 1.05, align: "center", anim: A("letters", 10) },
          rule(15),
          dateNum && { text: dateNum, font: F.digits, color: C.champ, lh: 1.2, mt: 28, ls: 6, align: "center", anim: A("track", 16) },
          w.ceremony_lunar && { text: w.ceremony_lunar, font: F.note, color: C.soft, lh: 1.3, mt: 12, align: "center", anim: A("fade", 19) },
        ],
        120, W - 240, 72, H - 72,
      );
      done("names", "Tên và ngày cưới", S);
    }

    // --- Lời mời an toạ: ảnh dọc bên trái, lời bên phải ---
    {
      const S = _stage(L);
      _night(S);
      S.add({ type: "frame", x: 72, y: 48, w: 432, h: 600, stroke: C.line, anim: A("fade", 4, { t: 2 }) });
      S.img({ x: 96, y: 72, w: 432, h: 600 }, pool.own("bride_image_url"), { anim: A("left", 0, { t: 2 }) });
      S.col(
        [
          { text: "Trân trọng chào đón", font: F.kicker, color: C.champ, lh: 1.2, anim: A("fade", 3) },
          { text: "Cảm ơn quý vị đã đến chung vui", font: F.title, color: C.ivory, lh: 1.18, mt: 12, anim: A("up", 4) },
          rule(6, false, 96),
          { text: "Mời quý vị an toạ. Hôn lễ sẽ sớm bắt đầu, xin được cùng quý vị chờ đón khoảnh khắc thiêng liêng này.", font: F.body, color: C.soft, lh: 1.5, mt: 28, anim: A("up", 7) },
          time && { text: `Hôn lễ cử hành lúc ${time}`, font: F.date, color: C.champ, lh: 1.3, mt: 24, anim: A("up", 9) },
          { text: `${G} & ${B}`, font: F.sign, color: C.ivory, lh: 1.2, mt: 32, anim: A("wipe", 11) },
        ],
        616, 584, 64, H - 64,
      );
      done("seat", "Lời mời an toạ", S);
    }

    // --- Ba ảnh album + một câu ---
    {
      const S = _stage(L);
      _night(S);
      const PW = 320;
      const PH = 420;
      const gap = 40;
      const x0 = (W - PW * 3 - gap * 2) / 2;
      [0, 1, 2].forEach((k) => {
        const x = x0 + k * (PW + gap);
        const y = k === 1 ? 64 : 92;
        S.add({ type: "frame", x: x - 10, y: y - 10, w: PW + 20, h: PH + 20, stroke: C.lineSoft, anim: A("fade", 3 + k * 2, { t: 1.6 }) });
        S.img({ x, y, w: PW, h: PH }, pool.next(), { anim: A("fly", k * 2, { from: "bottom", t: 1.8 }) });
      });
      S.col(
        [{ text: w.story_quote || "Cảm ơn vì đã chọn nhau giữa muôn người.", font: F.quote, color: C.ivory, lh: 1.3, align: "center", anim: A("up", 9) }],
        100, W - 200, 556, H - 36,
      );
      done("album", "Album ảnh", S);
    }

    return scenes;
  }
})();
