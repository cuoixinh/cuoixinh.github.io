// Hình nền LED "Duyên Lành Trọn Kiếp" (1280×720): màn chờ kiểu Art Deco — nền xanh navy, giấy kim
// tuyến vàng rơi xoay suốt vòng, khung vát góc + tia nắng + hình thoi vẽ nét vàng tự vẽ dần; chữ
// hình học in hoa dãn rộng. Bốn cảnh nối vòng (chào đón trong khung · chân dung · ngày trong ba
// hình thoi · bốn ảnh vát góc), chuyển cảnh mở từ giữa. Chỉ KHAI cảnh (đăng ký vào CX_LED_TEMPLATES).

(function () {
  const K = window.CXLedKit;
  const { A } = K;
  const W = 1280;
  const H = 720;
  const C = {
    bg: "#070C1F",
    gold: "#D9B46A",
    champ: "#F2E3BF",
    text: "#F7F1E3",
    soft: "rgba(247, 241, 227, 0.74)",
    line: "rgba(217, 180, 106, 0.75)",
    faint: "rgba(217, 180, 106, 0.22)",
    empty: "#121A36",
    shade: "rgba(4, 7, 20, 0.9)",
  };
  const JS = '"Josefin Sans", "Inter", sans-serif';
  const F = {
    kicker: { family: JS, size: 22, weight: 300 },
    name: { family: JS, size: 76, weight: 600 },
    side: { family: JS, size: 58, weight: 600 },
    date: { family: JS, size: 28, weight: 300 },
    body: { family: JS, size: 26, weight: 300 },
    digits: { family: JS, size: 72, weight: 600 },
    label: { family: JS, size: 16, weight: 300 },
    small: { family: JS, size: 20, weight: 600 },
  };
  const DUR = 14;

  // Nền DÙNG CHUNG: dải màu navy + giấy kim tuyến rơi (giờ chung cả vòng).
  const NAVY = { type: "grad", x: 0, y: 0, w: W, h: H, stops: [[0, "#0B1430"], [1, "#050914"]] };
  const CONFETTI = { type: "drift", shape: "rect", n: 64, size: 12, speed: 46, sway: 36, alpha: 0.85, color: ["#D9B46A", "#F2E3BF", "#B8893F", "#FFFFFF"], seed: 13 };
  const GLINT = { type: "drift", shape: "diamond", n: 22, size: 9, speed: 30, sway: 20, alpha: 0.9, color: "#F2E3BF", seed: 17 };

  (window.CX_LED_TEMPLATES ||= []).push({
    id: "duyen-lanh-tron-kiep",
    name: "Duyên Lành Trọn Kiếp",
    desc: "Art Deco navy, khung vàng và kim tuyến rơi",
    poster: 8,
    w: W,
    h: H,
    bg: C.bg,
    fade: 1.6,
    tr: "split",
    demo: "red-carpet",
    fonts: [`600 76px ${JS}`, `300 22px ${JS}`],
    scenes: buildScenes,
  });

  const deco = (S) => S.add(NAVY, CONFETTI, GLINT);
  // Hình thoi đặc nhỏ (ô vuông xoay 45°).
  const gem = (cx, cy, s, n) => ({ type: "rect", x: cx - s / 2, y: cy - s / 2, w: s, h: s, fill: C.gold, rot: 45, anim: A("zoom", n, { s0: 0.1 }) });
  // Hình thoi rỗng tâm (cx, cy), nửa đường chéo r.
  const diamond = (cx, cy, r) => [[cx, cy - r], [cx + r, cy], [cx, cy + r], [cx - r, cy], [cx, cy - r]];
  // Khung đôi vát góc tự vẽ (ngoài đậm, trong mảnh).
  const frame2 = (x, y, w, h, cut, n) => [
    K.stroke([K.chamfer(x, y, w, h, cut)], { color: C.line, lw: 2, anim: A("draw", n, { t: 2.4 }) }),
    K.stroke([K.chamfer(x + 10, y + 10, w - 20, h - 20, cut - 6)], { color: C.faint, lw: 1, anim: A("draw", n + 2, { t: 2.4 }) }),
  ];
  // Tia nắng toả lên từ dưới đáy giữa màn, dài ngắn xen kẽ.
  function sunburst(n) {
    const rays = Array.from({ length: 29 }, (_, k) => {
      const a = ((196 + (148 * k) / 28) * Math.PI) / 180;
      const r0 = 120;
      const r1 = k % 2 ? 640 : 860;
      return [[640 + Math.cos(a) * r0, 780 + Math.sin(a) * r0], [640 + Math.cos(a) * r1, 780 + Math.sin(a) * r1]];
    });
    return K.stroke(rays, { color: C.faint, lw: 1.2, anim: A("draw", n, { t: 3 }) });
  }
  // Dòng hoạ tiết giữa hai tên: vạch — hình thoi — vạch.
  const divider = (n) => ({
    orn: 34,
    make: (cx, cy) => [
      { type: "rect", x: cx - 150, y: cy, w: 120, h: 1, fill: C.line, anim: A("reveal", n, { from: "right" }) },
      gem(cx, cy, 12, n),
      { type: "rect", x: cx + 30, y: cy, w: 120, h: 1, fill: C.line, anim: A("reveal", n) },
    ],
  });

  function buildScenes(w, L) {
    const [G, B] = K.names(w);
    const pool = K.pool(w);
    const d = K.when(w);
    const time = String(w.ceremony_time || "").trim();
    const scenes = [];
    const done = (id, label, S) => K.push(scenes, id, label, DUR, S);

    // --- Chào đón: tia nắng phía sau, khung đôi vát góc, hai tên in hoa ngăn bằng hình thoi ---
    {
      const S = K.stage(L, "deco", C.empty);
      deco(S);
      S.add(sunburst(0), frame2(250, 70, 780, 580, 34, 2), gem(640, 70, 16, 6), gem(640, 650, 16, 7));
      S.col(
        [
          { text: "Hân hạnh chào đón", font: F.kicker, color: C.gold, lh: 1.2, caps: true, ls: 12, align: "center", anim: A("track", 4, { ls0: 30 }) },
          { text: G, font: F.name, fit: true, color: C.champ, lh: 1.1, mt: 26, caps: true, ls: 6, align: "center", shadow: C.shade, anim: A("track", 6, { ls0: 24 }) },
          { ...divider(9), mt: 10 },
          { text: B, font: F.name, fit: true, color: C.champ, lh: 1.1, mt: 10, caps: true, ls: 6, align: "center", shadow: C.shade, anim: A("track", 10, { ls0: 24 }) },
          d && { text: d.num("  |  "), font: F.date, color: C.text, lh: 1.2, mt: 30, ls: 6, align: "center", shadow: C.shade, anim: A("up", 14) },
        ],
        300, 680, 110, 610,
      );
      done("deco", "Chào đón", S);
    }

    // --- Chân dung: ảnh vát góc bên trái trong khung đôi, thông tin lễ bên phải ---
    {
      const S = K.stage(L, "portrait", C.empty);
      deco(S);
      S.add(frame2(106, 56, 468, 608, 44, 3));
      S.img({ x: 126, y: 76, w: 428, h: 568 }, pool.own("cover_image_url"), { shape: "chamfer", cut: 30, anim: A("fade", 0, { t: 1.6 }) }, "portrait");
      S.col(
        [
          { text: w.ceremony_name || "Lễ Thành Hôn", font: F.kicker, color: C.gold, lh: 1.2, caps: true, ls: 10, shadow: C.shade, anim: A("track", 3, { ls0: 24 }) },
          { text: G, font: F.side, fit: true, color: C.champ, lh: 1.1, mt: 22, caps: true, ls: 4, shadow: C.shade, anim: A("left", 4) },
          K.heartRow(36, { color: C.gold, fill: "rgba(217, 180, 106, 0.25)", lw: 2, anim: A("draw", 6, { t: 1.4 }) }, 12, "left"),
          { text: B, font: F.side, fit: true, color: C.champ, lh: 1.1, mt: 4, caps: true, ls: 4, shadow: C.shade, anim: A("left", 7) },
          { line: true, w: 100, color: C.line, mt: 28, anim: A("spread", 9) },
          d && { text: d.long, font: F.body, color: C.text, lh: 1.45, mt: 24, shadow: C.shade, anim: A("up", 10) },
          time && { text: `Vào lúc ${time}`, font: F.body, color: C.gold, lh: 1.45, mt: 4, shadow: C.shade, anim: A("up", 11) },
          w.ceremony_location && { text: w.ceremony_location, font: F.body, color: C.soft, lh: 1.45, mt: 14, shadow: C.shade, anim: A("up", 13) },
        ],
        652, 540, 64, H - 64,
      );
      done("portrait", "Chân dung", S);
    }

    // --- Ngày cưới: ngày · tháng · năm trong ba hình thoi, viền ngang ba vạch trên + dưới ---
    {
      const S = K.stage(L, "dates", C.empty);
      deco(S);
      [0, 8, 16].forEach((dy, k) => {
        S.add(
          { type: "rect", x: 140, y: 52 + dy, w: W - 280, h: 1, fill: k ? C.faint : C.line, anim: A("spread", k) },
          { type: "rect", x: 140, y: H - 52 - dy, w: W - 280, h: 1, fill: k ? C.faint : C.line, anim: A("spread", k) },
        );
      });
      S.col([{ text: "Ngày trọng đại", font: F.kicker, color: C.gold, lh: 1.2, caps: true, ls: 12, align: "center", anim: A("track", 2, { ls0: 30 }) }], 140, W - 280, 92, 150, "top");
      [
        ["dd", "Ngày", 360],
        ["mm", "Tháng", 640],
        ["yyyy", "Năm", 920],
      ].forEach(([part, label, cx], k) => {
        S.add(K.stroke([diamond(cx, 340, 128)], { color: C.line, lw: 2, anim: A("draw", 3 + k * 2, { t: 2 }) }), K.stroke([diamond(cx, 340, 114)], { color: C.faint, lw: 1, anim: A("draw", 4 + k * 2, { t: 2 }) }));
        S.col(
          [
            { text: d ? d[part] : "--", font: { ...F.digits, size: part === "yyyy" ? 54 : 72 }, color: C.champ, lh: 1, align: "center", shadow: C.shade, anim: A("up", 5 + k * 2) },
            { text: label, font: F.label, color: C.gold, lh: 1.2, mt: 10, caps: true, ls: 8, align: "center", anim: A("fade", 6 + k * 2) },
          ],
          cx - 100, 200, 280, 400, part,
        );
      });
      S.col(
        [
          { text: [d?.weekday, time].filter(Boolean).join("  ·  "), font: F.body, color: C.text, lh: 1.3, align: "center", shadow: C.shade, anim: A("up", 11) },
          w.ceremony_lunar && { text: w.ceremony_lunar, font: F.body, color: C.soft, lh: 1.3, mt: 6, align: "center", shadow: C.shade, anim: A("up", 12) },
        ],
        140, W - 280, 494, 632, "info",
      );
      done("dates", "Ngày cưới", S);
    }

    // --- Bốn ảnh vát góc bay xuống thành hàng, câu ngắn bên dưới ---
    {
      const S = K.stage(L, "gallery", C.empty);
      deco(S);
      const PW = 260;
      const PH = 380;
      const gap = 32;
      const x0 = (W - PW * 4 - gap * 3) / 2;
      [0, 1, 2, 3].forEach((k) => {
        const x = x0 + k * (PW + gap);
        const y = k % 2 ? 96 : 76;
        S.add(K.stroke([K.chamfer(x - 10, y - 10, PW + 20, PH + 20, 30)], { color: C.line, lw: 1.4, anim: A("draw", 3 + k * 2, { t: 1.8 }) }));
        S.img({ x, y, w: PW, h: PH }, pool.next(), { shape: "chamfer", cut: 24, anim: A("fly", k * 2, { from: "top", t: 1.6 }) }, `gallery-${k + 1}`);
      });
      S.col(
        [
          { text: w.story_quote || "Duyên lành gặp gỡ, trọn kiếp bên nhau.", font: F.date, color: C.text, lh: 1.4, align: "center", shadow: C.shade, anim: A("up", 10) },
          { pair: [G, B], sep: K.heartSep({ color: C.gold, fill: C.gold, lw: 1.4 }), sepW: 0.8, font: F.small, color: C.gold, lh: 1.3, mt: 14, caps: true, align: "center", shadow: C.shade, anim: A("fade", 12) },
        ],
        140, W - 280, 500, H - 36,
      );
      done("gallery", "Bốn ảnh", S);
    }

    return scenes;
  }
})();
