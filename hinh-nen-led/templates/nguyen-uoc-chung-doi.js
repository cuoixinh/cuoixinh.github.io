// Hình nền LED "Nguyện Ước Chung Đôi" (1280×720): màn chờ kiểu cực quang — nền xanh đêm có quầng
// sáng xanh ngọc/tím trôi chậm, bó sóng sáng mảnh chảy ngang nửa dưới; tên viết nét chữ ký.
// Bốn cảnh nối vòng (chào đón · ảnh vòm · ba ảnh tròn · lời cảm ơn), chuyển cảnh mờ chồng chậm.
// Chỉ KHAI cảnh (đăng ký vào CX_LED_TEMPLATES).

(function () {
  const K = window.CXLedKit;
  const { A } = K;
  const W = 1280;
  const H = 720;
  const C = {
    bg: "#03141B",
    text: "#EFFFFB",
    soft: "rgba(225, 248, 244, 0.74)",
    mint: "#8FF0D8",
    line: "rgba(143, 240, 216, 0.6)",
    empty: "#082029",
    glow: "rgba(120, 240, 210, 0.55)",
    shade: "rgba(2, 16, 22, 0.9)",
  };
  const SIG = '"MonolineSignature", cursive';
  const QS = '"Quicksand", "Inter", sans-serif';
  const F = {
    kicker: { family: QS, size: 22 },
    name: { family: SIG, size: 116 },
    pair: { family: SIG, size: 84 },
    body: { family: QS, size: 28 },
    date: { family: QS, size: 32 },
    title: { family: SIG, size: 104 },
    small: { family: QS, size: 22 },
  };
  const DUR = 16;
  // Trái tim nét sáng thay chữ "&" giữa hai tên.
  const HEART = { color: C.mint, glow: C.glow, lw: 2 };

  // Nền DÙNG CHUNG mọi cảnh: dải màu đêm + quầng cực quang + bó sóng + hạt sáng li ti.
  const SKY = { type: "grad", x: 0, y: 0, w: W, h: H, stops: [[0, "#03141B"], [0.6, "#062630"], [1, "#0A1C2E"]] };
  const ORBS = [
    { type: "orb", x: 300, y: 190, r: 440, color: "rgba(50, 200, 175, 0.26)", dx: 90, dy: 40 },
    { type: "orb", x: 990, y: 250, r: 480, color: "rgba(130, 105, 255, 0.22)", dx: 70, dy: 50, phase: 2.1 },
    { type: "orb", x: 640, y: 110, r: 380, color: "rgba(90, 225, 150, 0.14)", dx: 120, dy: 20, phase: 4 },
  ];
  const WAVES = { type: "waves", x: 0, y: 410, w: W, h: 280, n: 16, amp: 58, spread: 120, len: 820, speed: 26, rgb: ["110, 235, 210", "150, 170, 255", "205, 145, 255"], alpha: 0.55, lw: 1.3 };
  const MOTES = { type: "drift", shape: "dot", dir: "up", n: 40, size: 2.4, speed: 8, sway: 10, alpha: 0.6, color: "#CFFFF4", seed: 9 };

  (window.CX_LED_TEMPLATES ||= []).push({
    id: "nguyen-uoc-chung-doi",
    name: "Nguyện Ước Chung Đôi",
    desc: "Cực quang xanh đêm, sóng sáng chảy ngang",
    poster: 25,
    w: W,
    h: H,
    bg: C.bg,
    fade: 2.4,
    demo: "seaside-film",
    fonts: [`400 116px ${SIG}`, `400 28px ${QS}`],
    scenes: buildScenes,
  });

  const night = (S) => S.add(SKY, ORBS, WAVES, MOTES);
  const rule = (n, center = true, w = 110) => ({ line: true, w, color: C.line, mt: 26, center, anim: center ? A("zoom", n, { s0: 0.05 }) : A("spread", n) });
  // Viền mảnh tự vẽ quanh ảnh (cách ảnh `gap` px).
  const outline = (pts, n) => K.stroke([pts], { color: C.mint, lw: 1.4, glow: C.glow, blur: 10, anim: A("draw", n, { t: 2.6 }) });

  function buildScenes(w, L) {
    const [G, B] = K.names(w);
    const pool = K.pool(w);
    const d = K.when(w);
    const time = String(w.ceremony_time || "").trim();
    const scenes = [];
    const done = (id, label, S) => K.push(scenes, id, label, DUR, S);

    // --- Chào đón: hai tên chữ ký hiện dần như đang viết, sóng sáng chảy bên dưới ---
    {
      const S = K.stage(L, "aurora", C.empty);
      night(S);
      S.col(
        [
          { text: "Trân trọng chào đón quý khách", font: F.kicker, color: C.mint, lh: 1.2, caps: true, ls: 8, align: "center", shadow: C.shade, anim: A("fade", 1) },
          { text: G, font: F.name, fit: true, color: C.text, lh: 1.05, mt: 14, align: "center", shadow: C.glow, anim: A("wipe", 3, { t: 2.2 }) },
          K.heartRow(48, { ...HEART, anim: A("draw", 9, { t: 2 }) }, 18),
          { text: B, font: F.name, fit: true, color: C.text, lh: 1.05, mt: 14, align: "center", shadow: C.glow, anim: A("wipe", 11, { t: 2.2 }) },
          d && { text: d.num(" / "), font: F.date, color: C.text, lh: 1.2, mt: 22, ls: 6, align: "center", shadow: C.shade, anim: A("up", 18) },
        ],
        100, W - 200, 36, 500,
      );
      done("aurora", "Chào đón", S);
    }

    // --- Ảnh vòm bên phải, viền vòm tự vẽ; thông tin lễ bên trái ---
    {
      const S = K.stage(L, "arch", C.empty);
      night(S);
      const R = { x: 776, y: 64, w: 396, h: 592 };
      S.add(outline(K.arch(R.x - 16, R.y - 16, R.w + 32, R.h + 32), 4));
      S.img(R, pool.own("bride_image_url"), { shape: "arch", anim: A("up", 0, { t: 1.8 }) }, "arch");
      S.col(
        [
          { text: w.ceremony_name || "Lễ Thành Hôn", font: F.kicker, color: C.mint, lh: 1.2, caps: true, ls: 8, shadow: C.shade, anim: A("fade", 3) },
          { pair: [G, B], sep: K.heartSep(HEART), sepW: 0.42, sepAnim: A("draw", 8, { t: 2 }), font: F.pair, color: C.text, lh: 1.2, mt: 10, shadow: C.glow, anim: A("wipe", 4, { t: 2.4 }) },
          rule(10, false),
          d && { text: d.long, font: F.body, color: C.text, lh: 1.4, mt: 24, shadow: C.shade, anim: A("up", 11) },
          time && { text: `Vào lúc ${time}`, font: F.body, color: C.mint, lh: 1.4, mt: 6, shadow: C.shade, anim: A("up", 12) },
          w.ceremony_location && { text: w.ceremony_location, font: F.body, color: C.soft, lh: 1.45, mt: 14, shadow: C.shade, anim: A("up", 14) },
        ],
        108, 600, 64, H - 64,
      );
      done("arch", "Ảnh vòm", S);
    }

    // --- Ba ảnh tròn (giữa to, hai bên nhỏ) có viền tròn tự vẽ, câu ngắn ở dưới ---
    {
      const S = K.stage(L, "bubbles", C.empty);
      night(S);
      [
        [300, 330, 128, 4],
        [980, 330, 128, 6],
        [640, 290, 196, 0],
      ].forEach(([cx, cy, r, n], k) => {
        S.add(outline(K.ring(cx, cy, r + 14), n + 3));
        S.img({ x: cx - r, y: cy - r, w: r * 2, h: r * 2 }, pool.next(), { shape: "circle", anim: A("zoom", n, { s0: 0.7, t: 1.6 }) }, `bubble-${k + 1}`);
      });
      S.col(
        [{ text: w.story_quote || "Từ hôm nay, mọi bình minh đều có nhau.", font: F.date, color: C.text, lh: 1.35, align: "center", shadow: C.shade, anim: A("up", 10) }],
        120, W - 240, 540, H - 40,
      );
      done("bubbles", "Ba ảnh tròn", S);
    }

    // --- Lời cảm ơn ---
    {
      const S = K.stage(L, "thanks", C.empty);
      night(S);
      S.col(
        [
          { text: "Cảm ơn", font: F.title, color: C.text, lh: 1.1, align: "center", shadow: C.glow, anim: A("wipe", 1, { t: 2 }) },
          { text: "quý khách đã đến chung vui và gửi trao những lời chúc phúc tốt đẹp nhất", font: F.body, color: C.soft, lh: 1.5, mt: 14, align: "center", shadow: C.shade, anim: A("up", 8) },
          rule(11),
          { pair: [G, B], sep: K.heartSep({ ...HEART, lw: 1.6 }), sepW: 0.8, font: F.small, color: C.mint, lh: 1.2, mt: 24, caps: true, align: "center", shadow: C.shade, anim: A("fade", 12) },
        ],
        240, W - 480, 40, 500,
      );
      done("thanks", "Lời cảm ơn", S);
    }

    return scenes;
  }
})();
