// Hình nền LED "Đồng Lòng Son Sắt" (1280×720): màn chờ kiểu sân khấu hoà nhạc — nền đen, sáu luồng
// đèn rọi từ trần lắc qua lại, bụi sáng bay lên trong luồng đèn; chữ không chân đậm in hoa.
// Năm cảnh nối vòng (chào đón · ảnh dưới đèn · ngày cưới số lớn · ba ảnh dọc · mời an toạ),
// chuyển cảnh kiểu lao xuyên (zoom). Chỉ KHAI cảnh (đăng ký vào CX_LED_TEMPLATES).

(function () {
  const K = window.CXLedKit;
  const { A } = K;
  const W = 1280;
  const H = 720;
  const C = {
    bg: "#05040A",
    white: "#FFFFFF",
    soft: "rgba(255, 255, 255, 0.72)",
    lilac: "#DCC2FF",
    line: "rgba(220, 194, 255, 0.7)",
    empty: "#0E0C16",
    glow: "rgba(190, 150, 255, 0.55)",
    shade: "rgba(0, 0, 0, 0.85)",
  };
  const MS = '"Montserrat", "Inter", sans-serif';
  const F = {
    kicker: { family: MS, size: 22, weight: 500 },
    hero: { family: MS, size: 104, weight: 800 },
    date: { family: MS, size: 30, weight: 300 },
    pair: { family: MS, size: 64, weight: 800 },
    digits: { family: MS, size: 168, weight: 800 },
    label: { family: MS, size: 18, weight: 500 },
    body: { family: MS, size: 28, weight: 300 },
    title: { family: MS, size: 54, weight: 800 },
    small: { family: MS, size: 26, weight: 800 },
  };
  const DUR = 14;
  // Trái tim nét sáng thay chữ "&" giữa hai tên.
  const HEART = { color: C.lilac, glow: C.glow, lw: 2.4 };

  // Đèn + bụi sáng DÙNG CHUNG mọi cảnh (cùng object, giờ chung cả vòng) → chuyển cảnh không thấy hai bộ đèn.
  const BEAMS = { type: "beams", n: 6, rgb: ["255, 238, 220", "206, 176, 255"], alpha: 0.24, spread: 18, sway: 12, lean: 26, period: 11, len: 920, seed: 4 };
  const DUST = { type: "drift", shape: "dot", dir: "up", n: 54, size: 3, speed: 16, sway: 18, alpha: 0.5, color: "#FFFFFF", seed: 5 };
  const HAZE = { type: "grad", x: 0, y: 380, w: W, h: H - 380, stops: [[0, "rgba(170, 140, 255, 0)"], [1, "rgba(170, 140, 255, 0.14)"]] };

  (window.CX_LED_TEMPLATES ||= []).push({
    id: "dong-long-son-sat",
    name: "Đồng Lòng Son Sắt",
    desc: "Đèn sân khấu quét trên nền đen, năm cảnh",
    poster: 9,
    w: W,
    h: H,
    bg: C.bg,
    fade: 1.4,
    tr: "zoom",
    demo: "moody-cinematic",
    fonts: [`800 104px ${MS}`, `300 28px ${MS}`, `500 22px ${MS}`],
    scenes: buildScenes,
  });

  const lights = (S) => S.add(HAZE, BEAMS, DUST);
  const rule = (n, center = true, w = 140) => ({ line: true, w, color: C.line, mt: 30, center, anim: center ? A("zoom", n, { s0: 0.05 }) : A("spread", n) });

  function buildScenes(w, L) {
    const [G, B] = K.names(w);
    const pool = K.pool(w);
    const d = K.when(w);
    const time = String(w.ceremony_time || "").trim();
    const scenes = [];
    const done = (id, label, S) => K.push(scenes, id, label, DUR, S);

    // --- Chào đón: hai tên in hoa rất to giữa các luồng đèn ---
    {
      const S = K.stage(L, "welcome", C.empty);
      lights(S);
      S.col(
        [
          { text: "Chào mừng đến với lễ cưới", font: F.kicker, color: C.lilac, lh: 1.2, caps: true, ls: 10, align: "center", anim: A("track", 1, { ls0: 30 }) },
          { text: G, font: F.hero, fit: true, color: C.white, lh: 1.02, mt: 22, caps: true, align: "center", shadow: C.glow, anim: A("letters", 4, { step: 0.05 }) },
          K.heartRow(44, { ...HEART, anim: A("draw", 9, { t: 1.8 }) }, 10),
          { text: B, font: F.hero, fit: true, color: C.white, lh: 1.02, mt: 4, caps: true, align: "center", shadow: C.glow, anim: A("letters", 11, { step: 0.05 }) },
          rule(17),
          d && { text: d.num(" · "), font: F.date, color: C.white, lh: 1.2, mt: 28, ls: 8, align: "center", anim: A("track", 18, { ls0: 20 }) },
        ],
        100, W - 200, 56, H - 56,
      );
      done("welcome", "Chào đón", S);
    }

    // --- Ảnh dưới đèn: ảnh bìa phủ kín, tối dần sang trái, chữ đứng bên trái ---
    {
      const S = K.stage(L, "spot", C.empty);
      S.img({ x: 0, y: 0, w: W, h: H }, pool.own("cover_image_url"), { kb: "in", anim: A("fade", 0, { t: 1.6 }) }, "spot");
      S.add(
        { type: "rect", x: 0, y: 0, w: W, h: H, fill: "rgba(5, 4, 10, 0.3)" },
        { type: "grad", dir: "right", x: 0, y: 0, w: W, h: H, stops: [[0, "rgba(5, 4, 10, 0.92)"], [0.55, "rgba(5, 4, 10, 0.35)"], [1, "rgba(5, 4, 10, 0)"]] },
      );
      lights(S);
      S.col(
        [
          { text: w.ceremony_name || "Lễ Thành Hôn", font: F.kicker, color: C.lilac, lh: 1.2, caps: true, ls: 8, shadow: C.shade, anim: A("left", 3) },
          { pair: [G, B], sep: K.heartSep(HEART), sepW: 0.5, sepAnim: A("draw", 5, { t: 1.8 }), font: F.pair, color: C.white, lh: 1.1, mt: 18, caps: true, shadow: C.shade, anim: A("left", 4) },
          rule(7, false, 120),
          d && { text: d.long, font: F.body, color: C.white, lh: 1.3, mt: 26, shadow: C.shade, anim: A("up", 8) },
          w.ceremony_location && { text: w.ceremony_location, font: F.body, color: C.soft, lh: 1.4, mt: 10, shadow: C.shade, anim: A("up", 10) },
        ],
        96, 700, 64, H - 64,
      );
      done("spot", "Ảnh dưới đèn", S);
    }

    // --- Ngày cưới: ba khối số rất lớn (ngày · tháng · năm), vạch dọc ngăn cách ---
    {
      const S = K.stage(L, "date", C.empty);
      lights(S);
      S.col(
        [{ text: "Ngày chung đôi", font: F.kicker, color: C.lilac, lh: 1.2, caps: true, ls: 12, align: "center", anim: A("track", 1, { ls0: 30 }) }],
        100, W - 200, 64, 150, "top",
      );
      const cols = [["dd", "Ngày", 260], ["mm", "Tháng", 260], ["yyyy", "Năm", 440]];
      let x = (W - 960 - 80) / 2;
      cols.forEach(([part, label, cw], k) => {
        if (k) S.add({ type: "rect", x: x - 20, y: 222, w: 1, h: 220, fill: C.line, anim: A("reveal", 6 + k * 2, { from: "top" }) });
        S.col(
          [
            { text: d ? d[part] : "--", font: F.digits, color: C.white, lh: 1, align: "center", shadow: C.glow, anim: A("reveal", 3 + k * 2, { from: "bottom", drift: 40 }) },
            { text: label, font: F.label, color: C.lilac, lh: 1.2, mt: 14, caps: true, ls: 10, align: "center", anim: A("fade", 5 + k * 2) },
          ],
          x, cw, 200, 470, part,
        );
        x += cw + 40;
      });
      S.col(
        [
          { text: [d?.weekday, time && `${time}`].filter(Boolean).join("  ·  "), font: F.body, color: C.white, lh: 1.3, align: "center", anim: A("up", 11) },
          w.ceremony_lunar && { text: w.ceremony_lunar, font: F.body, color: C.soft, lh: 1.3, mt: 8, align: "center", anim: A("up", 13) },
        ],
        100, W - 200, 500, H - 56, "info",
      );
      done("date", "Ngày cưới", S);
    }

    // --- Ba ảnh dọc kín màn, mở dần từ trên xuống, câu ngắn ở đáy ---
    {
      const S = K.stage(L, "trio", C.empty);
      const PW = 418;
      [0, 431, 862].forEach((x, k) => S.img({ x, y: 0, w: PW, h: H }, pool.next(), { anim: A("reveal", k * 2, { from: "top", t: 1.6 }) }, `trio-${k + 1}`));
      S.add({ type: "grad", x: 0, y: 300, w: W, h: H - 300, stops: [[0, "rgba(5, 4, 10, 0)"], [0.6, "rgba(5, 4, 10, 0.72)"], [1, "rgba(5, 4, 10, 0.96)"]] });
      lights(S);
      S.col(
        [
          { text: w.story_quote || "Chọn nhau giữa muôn người, và chọn mãi về sau.", font: F.body, color: C.white, lh: 1.35, align: "center", shadow: C.shade, anim: A("up", 7) },
          { pair: [G, B], sep: K.heartSep({ ...HEART, lw: 1.6 }), sepW: 0.7, font: F.small, color: C.lilac, lh: 1.2, mt: 16, caps: true, align: "center", shadow: C.shade, anim: A("fade", 9) },
        ],
        140, W - 280, 540, H - 40,
      );
      done("trio", "Ba ảnh dọc", S);
    }

    // --- Mời an toạ ---
    {
      const S = K.stage(L, "seat", C.empty);
      lights(S);
      S.col(
        [
          { text: "Mời quý khách an toạ", font: F.title, color: C.white, lh: 1.15, caps: true, ls: 4, align: "center", shadow: C.glow, anim: A("track", 1, { ls0: 26 }) },
          rule(5),
          { text: "Hôn lễ sắp bắt đầu. Cảm ơn quý khách đã dành thời gian đến chung vui cùng gia đình chúng tôi.", font: F.body, color: C.soft, lh: 1.5, mt: 30, align: "center", anim: A("up", 6) },
          time && { text: `Hôn lễ cử hành lúc ${time}`, font: F.kicker, color: C.lilac, lh: 1.3, mt: 30, caps: true, ls: 8, align: "center", anim: A("fade", 9) },
        ],
        220, W - 440, 72, H - 72,
      );
      done("seat", "Mời an toạ", S);
    }

    return scenes;
  }
})();
