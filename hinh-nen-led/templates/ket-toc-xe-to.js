// Hình nền LED "Kết Tóc Xe Tơ" (1280×720): màn chờ dàn trang kiểu tạp chí — nền than đậm, một màu
// nhấn đỏ son, chữ serif cao + nhãn không chân in hoa, đường kẻ mảnh; ảnh mở dần từ mép rồi phóng
// chậm (Ken Burns). Bốn cảnh nối vòng (trang bìa · ảnh chính có dải than · ảnh ghép · ngày cưới số
// lớn), chuyển cảnh trượt ngang. Chỉ KHAI cảnh (đăng ký vào CX_LED_TEMPLATES).

(function () {
  const K = window.CXLedKit;
  const { A } = K;
  const W = 1280;
  const H = 720;
  const C = {
    bg: "#141110",
    cream: "#F3EAD9",
    muted: "rgba(243, 234, 217, 0.62)",
    red: "#E04A33",
    hair: "rgba(243, 234, 217, 0.3)",
    empty: "#221D1B",
    shade: "rgba(10, 8, 7, 0.85)",
  };
  const PR = '"Prata", "Playfair Display", serif';
  const IN = '"Inter", sans-serif';
  const F = {
    label: { family: IN, size: 18, weight: 500 },
    name: { family: PR, size: 92 },
    bandName: { family: PR, size: 62 },
    day: { family: PR, size: 340 },
    month: { family: PR, size: 48 },
    quote: { family: PR, size: 32 },
    body: { family: IN, size: 24, weight: 300 },
    meta: { family: IN, size: 22, weight: 500 },
  };
  const DUR = 14;

  (window.CX_LED_TEMPLATES ||= []).push({
    id: "ket-toc-xe-to",
    name: "Kết Tóc Xe Tơ",
    desc: "Dàn trang tạp chí, nền than và đỏ son",
    poster: 8,
    w: W,
    h: H,
    bg: C.bg,
    fade: 1.2,
    tr: "slide",
    demo: "noir-elegance",
    fonts: [`400 92px ${PR}`, `500 18px ${IN}`, `300 24px ${IN}`],
    scenes: buildScenes,
  });

  // Đường kẻ ngang mảnh mở dần từ trái.
  const hair = (x, y, w, n, color = C.hair) => ({ type: "rect", x, y, w, h: 1, fill: color, anim: A("reveal", n, { t: 1.2 }) });

  function buildScenes(w, L) {
    const [G, B] = K.names(w);
    const pool = K.pool(w);
    const d = K.when(w);
    const time = String(w.ceremony_time || "").trim();
    const scenes = [];
    const done = (id, label, S) => K.push(scenes, id, label, DUR, S);

    // --- Trang bìa: ảnh nửa trái, tên xếp chồng bên phải giữa hai đường kẻ ---
    {
      const S = K.stage(L, "cover", C.empty);
      S.img({ x: 0, y: 0, w: 620, h: H }, pool.own("cover_image_url"), { kb: "in", anim: A("reveal", 0, { from: "left", drift: 40, t: 1.6 }) }, "cover");
      S.add(
        { type: "rect", x: 676, y: 64, w: 12, h: 12, fill: C.red, anim: A("zoom", 4, { s0: 0.1 }) },
        hair(676, 108, 540, 5),
        hair(676, 590, 540, 7),
      );
      S.col([{ text: "Ấn bản đặc biệt · Ngày cưới", font: F.label, color: C.muted, caps: true, ls: 6, lh: 1.2, anim: A("fade", 4) }], 706, 510, 56, 84, "head");
      S.col(
        [
          { text: G, font: F.name, fit: true, color: C.cream, lh: 1.08, anim: A("reveal", 5, { from: "bottom", drift: 30 }) },
          K.heartRow(52, { color: C.red, fill: C.red, lw: 2, anim: A("draw", 8, { t: 1.4 }) }, 10, "left"),
          { text: B, font: F.name, fit: true, color: C.cream, lh: 1.08, mt: 4, anim: A("reveal", 9, { from: "bottom", drift: 30 }) },
        ],
        676, 560, 120, 580,
      );
      S.col([d && { text: d.num("."), font: F.meta, color: C.cream, ls: 6, lh: 1.2, anim: A("up", 12) }], 676, 270, 610, 660, "date");
      S.col([time && { text: time, font: F.meta, color: C.red, ls: 4, lh: 1.2, align: "right", anim: A("up", 13) }], 946, 270, 610, 660, "time");
      done("cover", "Trang bìa", S);
    }

    // --- Ảnh chính phủ kín, dải than mờ viền đỏ son buông từ trên xuống mang tên + ngày ---
    {
      const S = K.stage(L, "feature", C.empty);
      S.img({ x: 0, y: 0, w: W, h: H }, pool.next(), { kb: true, anim: A("fade", 0, { t: 1.2 }) }, "feature");
      S.add(
        { type: "rect", x: 88, y: 0, w: 500, h: H, fill: "rgba(20, 17, 16, 0.86)", anim: A("reveal", 2, { from: "top", t: 1.4 }) },
        { type: "rect", x: 88, y: 0, w: 4, h: H, fill: C.red, anim: A("reveal", 4, { from: "top", t: 1.6 }) },
      );
      S.col(
        [
          { text: w.ceremony_name || "Lễ Thành Hôn", font: F.label, color: C.red, caps: true, ls: 6, lh: 1.2, anim: A("fade", 9) },
          { text: G, font: F.bandName, fit: true, color: C.cream, lh: 1.1, mt: 28, anim: A("up", 10) },
          K.heartRow(38, { color: C.red, fill: C.red, lw: 2, anim: A("draw", 11, { t: 1.2 }) }, 10, "left"),
          { text: B, font: F.bandName, fit: true, color: C.cream, lh: 1.1, mt: 2, anim: A("up", 12) },
          { line: true, w: 64, color: C.hair, mt: 30, anim: A("spread", 14) },
          d && { text: d.long, font: F.body, fit: true, color: C.cream, lh: 1.45, mt: 24, anim: A("up", 15) },
          time && { text: `Lúc ${time}`, font: F.meta, color: C.red, lh: 1.3, mt: 8, anim: A("up", 16) },
        ],
        132, 412, 64, H - 64,
      );
      done("feature", "Ảnh chính", S);
    }

    // --- Ảnh ghép: một ảnh lớn bên trái, hai ảnh chồng bên phải, câu trích trên ảnh lớn ---
    {
      const S = K.stage(L, "mosaic", C.empty);
      S.img({ x: 0, y: 0, w: 772, h: H }, pool.next(), { kb: "in", anim: A("reveal", 0, { from: "left", drift: 30 }) }, "mosaic-1");
      S.img({ x: 780, y: 0, w: 500, h: 356 }, pool.next(), { anim: A("reveal", 3, { from: "top", drift: 20 }) }, "mosaic-2");
      S.img({ x: 780, y: 364, w: 500, h: 356 }, pool.next(), { anim: A("reveal", 5, { from: "bottom", drift: 20 }) }, "mosaic-3");
      S.add({ type: "grad", x: 0, y: 340, w: 772, h: H - 340, stops: [[0, "rgba(20, 17, 16, 0)"], [1, "rgba(20, 17, 16, 0.92)"]] });
      S.col(
        [
          { text: w.story_quote || "Đi cùng nhau, đường dài mấy cũng thành gần.", font: F.quote, color: C.cream, lh: 1.35, shadow: C.shade, anim: A("lines", 8) },
          { pair: [G, B], sep: K.heartSep({ color: C.red, fill: C.red, lw: 1.4 }), sepW: 0.8, font: F.label, color: C.red, caps: true, lh: 1.2, mt: 18, anim: A("fade", 11) },
        ],
        56, 640, 500, H - 44,
      );
      done("mosaic", "Ảnh ghép", S);
    }

    // --- Ngày cưới: số ngày đỏ son rất lớn, thông tin bên cạnh, dải ảnh dọc mép phải ---
    {
      const S = K.stage(L, "date", C.empty);
      S.img({ x: 1010, y: 0, w: 270, h: H }, pool.next(), { kb: true, anim: A("reveal", 0, { from: "right", drift: 30 }) }, "date");
      // lh rộng: `reveal` cắt theo khung dòng kể cả khi đã hiện xong, chữ số Prata nhô quá khung thấp.
      S.col([{ text: d ? d.dd : "--", font: F.day, color: C.red, lh: 1.3, align: "center", anim: A("reveal", 2, { from: "bottom", drift: 50, t: 1.6 }) }], 56, 460, 40, H - 40, "day");
      S.add({ type: "rect", x: 556, y: 150, w: 1, h: 420, fill: C.hair, anim: A("reveal", 5, { from: "top" }) });
      S.col(
        [
          { text: "Ngày cưới", font: F.label, color: C.muted, caps: true, ls: 6, lh: 1.2, anim: A("fade", 5) },
          d && { text: d.month, font: F.month, fit: true, color: C.cream, lh: 1.15, mt: 18, anim: A("left", 6) },
          d && { text: d.yyyy, font: F.month, color: C.muted, lh: 1.15, anim: A("left", 7) },
          { line: true, w: 64, color: C.red, mt: 26, anim: A("spread", 9) },
          d && { text: d.weekday, font: F.meta, color: C.cream, lh: 1.4, mt: 24, anim: A("up", 10) },
          time && { text: `Hôn lễ lúc ${time}`, font: F.meta, color: C.red, lh: 1.4, mt: 4, anim: A("up", 11) },
          w.ceremony_lunar && { text: w.ceremony_lunar, font: F.body, fit: true, color: C.muted, lh: 1.4, mt: 4, anim: A("up", 12) },
          w.ceremony_location && { text: w.ceremony_location, font: F.body, color: C.muted, lh: 1.45, mt: 18, anim: A("up", 13) },
        ],
        592, 392, 64, H - 64,
      );
      done("date", "Ngày cưới", S);
    }

    return scenes;
  }
})();
