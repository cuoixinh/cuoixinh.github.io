// Hình nền LED "Bách Niên Giai Lão" (1280×720): màn chờ tông hổ phách — nền nâu đen có quầng ấm
// thở nhẹ, bụi vàng bay lên; ảnh cắt tròn, quanh ảnh là vòng sóng vàng lan ra liên tục; chữ serif
// nghiêng. Bốn cảnh nối vòng (vầng sáng · đôi uyên ương · lời mời an toạ · chuỗi ảnh vòng cung),
// chuyển cảnh đẩy lên. Chỉ KHAI cảnh (đăng ký vào CX_LED_TEMPLATES).

(function () {
  const K = window.CXLedKit;
  const { A } = K;
  const W = 1280;
  const H = 720;
  const C = {
    bg: "#0D0805",
    gold: "#E7C27A",
    text: "#FFF6E6",
    soft: "rgba(255, 246, 230, 0.74)",
    line: "rgba(231, 194, 122, 0.62)",
    empty: "#1C130C",
    glow: "rgba(231, 170, 90, 0.55)",
    shade: "rgba(8, 5, 3, 0.88)",
  };
  const GOLD = "231, 194, 122";
  const NS = '"Noto Serif Display", "Playfair Display", serif';
  const F = {
    kicker: { family: NS, size: 22, weight: 300 },
    pair: { family: NS, size: 64, style: "italic" },
    name: { family: NS, size: 54, style: "italic" },
    title: { family: NS, size: 66, style: "italic" },
    body: { family: NS, size: 28, weight: 300 },
    date: { family: NS, size: 30, weight: 300 },
    quote: { family: NS, size: 34, style: "italic" },
  };
  const DUR = 15;
  // Trái tim nét vàng thay chữ "&" giữa hai tên.
  const HEART = { color: C.gold, glow: C.glow, lw: 2.2 };

  // Nền DÙNG CHUNG: quầng ấm giữa màn + bụi vàng bay lên (giờ chung cả vòng).
  const WARM = { type: "orb", x: 640, y: 340, r: 640, color: "rgba(150, 82, 28, 0.32)", dx: 30, dy: 16, pulse: 0.08 };
  const DUST = { type: "drift", shape: "dot", dir: "up", n: 70, size: 3.4, speed: 14, sway: 22, alpha: 0.7, color: ["#E7C27A", "#F7E2B5", "#C9974E"], seed: 21 };

  (window.CX_LED_TEMPLATES ||= []).push({
    id: "bach-nien-giai-lao",
    name: "Bách Niên Giai Lão",
    desc: "Ảnh tròn giữa vòng sóng vàng, tông hổ phách",
    poster: 8,
    w: W,
    h: H,
    bg: C.bg,
    fade: 1.8,
    tr: "slide-up",
    demo: "opulent-contrast",
    fonts: [`italic 400 64px ${NS}`, `300 28px ${NS}`],
    scenes: buildScenes,
  });

  const warm = (S) => S.add(WARM, DUST);
  // Ảnh tròn tâm (cx, cy) bán kính r: vòng sóng lan + hai viền tròn tự vẽ.
  function halo(S, cx, cy, r, ph, slot, n, o = {}) {
    S.add(
      { type: "rings", x: cx, y: cy, r0: r + 8, r1: r + (o.reach ?? 380), n: o.rings ?? 4, period: o.period ?? 7, rgb: GOLD, alpha: o.alpha ?? 0.55, lw: 1.6 },
      K.stroke([K.ring(cx, cy, r + 10)], { color: C.gold, lw: 2, glow: C.glow, blur: 14, anim: A("draw", n + 2, { t: 2.2 }) }),
      o.inner !== false && K.stroke([K.ring(cx, cy, r + 22, r + 22, 90, 450)], { color: C.line, lw: 1, anim: A("draw", n + 4, { t: 2.6 }) }),
    );
    S.img({ x: cx - r, y: cy - r, w: r * 2, h: r * 2 }, ph, { shape: "circle", anim: A("zoom", n, { s0: 0.82, t: 1.6 }) }, slot);
  }

  function buildScenes(w, L) {
    const [G, B] = K.names(w);
    const pool = K.pool(w);
    const d = K.when(w);
    const time = String(w.ceremony_time || "").trim();
    const scenes = [];
    const done = (id, label, S) => K.push(scenes, id, label, DUR, S);

    // --- Vầng sáng: một ảnh tròn giữa màn, tên + ngày bên dưới ---
    {
      const S = K.stage(L, "halo", C.empty);
      warm(S);
      halo(S, 640, 280, 176, pool.own("cover_image_url"), "halo", 0, { reach: 520 });
      S.col(
        [
          { pair: [G, B], sep: K.heartSep(HEART), sepW: 0.5, sepAnim: A("draw", 7, { t: 1.8 }), font: F.pair, color: C.text, lh: 1.15, align: "center", shadow: C.shade, anim: A("up", 6) },
          d && { text: d.num(" · "), font: F.date, color: C.gold, lh: 1.2, mt: 12, ls: 6, align: "center", shadow: C.shade, anim: A("track", 9, { ls0: 20 }) },
        ],
        100, W - 200, 506, H - 30,
      );
      done("halo", "Vầng sáng", S);
    }

    // --- Đôi uyên ương: ảnh chú rể + cô dâu hai bên, dấu & lớn ở giữa ---
    {
      const S = K.stage(L, "duo", C.empty);
      warm(S);
      halo(S, 360, 290, 156, pool.own("groom_image_url"), "duo-groom", 0, { reach: 300, rings: 3, inner: false });
      halo(S, 920, 290, 156, pool.own("bride_image_url"), "duo-bride", 2, { reach: 300, rings: 3, inner: false });
      S.add(K.heart(640, 290, 84, { ...HEART, lw: 3, fill: "rgba(231, 194, 122, 0.18)", anim: A("draw", 6, { t: 2 }) }));
      [
        ["g", G, "Chú rể", 140],
        ["b", B, "Cô dâu", 700],
      ].forEach(([ns, name, role, x], k) =>
        S.col(
          [
            { text: name, font: F.name, fit: true, color: C.text, lh: 1.15, align: "center", shadow: C.shade, anim: A("up", 7 + k * 2) },
            { text: role, font: F.kicker, color: C.gold, lh: 1.2, mt: 6, caps: true, ls: 8, align: "center", anim: A("fade", 8 + k * 2) },
          ],
          x, 440, 486, H - 40, ns,
        ),
      );
      done("duo", "Đôi uyên ương", S);
    }

    // --- Lời mời an toạ: vòng sóng rộng toả từ giữa phía sau chữ ---
    {
      const S = K.stage(L, "invite", C.empty);
      warm(S);
      S.add({ type: "rings", x: 640, y: 360, r0: 40, r1: 720, n: 5, period: 9, rgb: GOLD, alpha: 0.32, lw: 1.2 });
      S.col(
        [
          { text: "Trân trọng kính mời", font: F.kicker, color: C.gold, lh: 1.2, caps: true, ls: 10, align: "center", anim: A("track", 1, { ls0: 26 }) },
          { text: "Quý khách an toạ", font: F.title, color: C.text, lh: 1.15, mt: 16, align: "center", shadow: C.glow, anim: A("up", 3) },
          { line: true, w: 120, color: C.line, mt: 28, center: true, anim: A("zoom", 6, { s0: 0.05 }) },
          { text: "Buổi lễ sắp bắt đầu, xin mời quý khách cùng hướng về sân khấu, chứng kiến khoảnh khắc trọng đại của chúng tôi.", font: F.body, color: C.soft, lh: 1.55, mt: 28, align: "center", shadow: C.shade, anim: A("up", 7) },
          time && { text: `Hôn lễ cử hành lúc ${time}`, font: F.date, color: C.gold, lh: 1.3, mt: 26, align: "center", shadow: C.shade, anim: A("up", 9) },
        ],
        220, W - 440, 64, H - 64,
      );
      done("invite", "Mời an toạ", S);
    }

    // --- Chuỗi năm ảnh tròn xếp theo vòng cung, câu ngắn bên dưới ---
    {
      const S = K.stage(L, "orbit", C.empty);
      warm(S);
      [
        [196, 316],
        [418, 258],
        [640, 238],
        [862, 258],
        [1084, 316],
      ].forEach(([cx, cy], k) => {
        S.add(K.stroke([K.ring(cx, cy, 104)], { color: C.line, lw: 1.4, anim: A("draw", 2 + k, { t: 1.8 }) }));
        S.img({ x: cx - 94, y: cy - 94, w: 188, h: 188 }, pool.next(), { shape: "circle", kb: "in", anim: A("fly", k, { from: "bottom", t: 1.6 }) }, `orbit-${k + 1}`);
      });
      S.col(
        [
          { text: w.story_quote || "Một đời bên nhau, trăm năm chung một lối.", font: F.quote, color: C.text, lh: 1.35, align: "center", shadow: C.shade, anim: A("up", 8) },
          { pair: [G, B], sep: K.heartSep({ ...HEART, lw: 1.4 }), sepW: 0.8, font: F.kicker, color: C.gold, lh: 1.2, mt: 16, caps: true, align: "center", anim: A("fade", 10) },
        ],
        140, W - 280, 470, H - 40,
      );
      done("orbit", "Chuỗi ảnh", S);
    }

    return scenes;
  }
})();
