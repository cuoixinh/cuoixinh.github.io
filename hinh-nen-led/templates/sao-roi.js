// Hình nền LED "Sao Rơi" (1280×720): ĐÚNG MỘT cảnh chạy vòng — nền đen dải ngân hà, sao sáng trôi
// chậm + sao băng; tên hai người nối bằng trái tim tự vẽ, ngày cưới bên dưới. Cùng kiểu cảnh "Tên và
// ngày cưới" của Hẹn Ước Trăm Năm. Chữ mờ dần cuối cảnh (anim.out) rồi hiện lại, bầu trời chạy liền
// qua chỗ nối vòng. Chỉ KHAI cảnh (đăng ký vào CX_LED_TEMPLATES).

(function () {
  const K = window.CXLedKit;
  const W = 1280;
  const H = 720;
  const C = {
    void: "#000000",
    ivory: "#F7F2E8",
    soft: "rgba(247, 242, 232, 0.74)",
    champ: "#E8CD97",
    gold: "#C9A35E",
    // Bóng tối sau chữ: chữ đứng trên mây sáng của dải ngân hà vẫn rõ khi nhìn từ cuối hội trường.
    shade: "rgba(0, 0, 0, 0.9)",
  };
  const PF = '"Playfair Display", "Times New Roman", serif';
  const CO = '"Cormorant Infant", "Times New Roman", serif';
  const F = {
    kicker: { family: CO, size: 26, weight: 500 },
    name: { family: PF, size: 92 },
    digits: { family: PF, size: 40 },
    note: { family: CO, size: 26, style: "italic" },
  };
  const GLOW = "rgba(232, 205, 151, 0.65)";
  const DUR = 20;
  // Giây mờ dần cuối cảnh của mọi khối chữ / nét vẽ.
  const OUT = 1.8;
  const A = (k, n, o) => K.A(k, n, { out: OUT, ...o });

  // Bầu trời giống Hẹn Ước Trăm Năm: dải ngân hà chéo lên phải, mây sáng nhỏ rải đều, sao sáng trôi
  // chậm sang trái, sao băng ~6 giây một vệt.
  const SKY = { type: "sky", seed: 7, band: { x: 640, y: 360, angle: -26, width: 120 }, bulge: false, n: 170, dust: 2800, drift: 16, meteors: 6 };

  (window.CX_LED_TEMPLATES ||= []).push({
    id: "sao-roi",
    name: "Sao Rơi",
    desc: "Một cảnh dải ngân hà, sao băng nối vòng",
    poster: 10,
    w: W,
    h: H,
    bg: C.void,
    fade: 2.2,
    demo: "romantic-blush",
    fonts: [`400 92px ${PF}`, `400 40px ${PF}`, `500 26px ${CO}`, `italic 400 26px ${CO}`],
    scenes: buildScenes,
  });

  function buildScenes(w, L) {
    const [G, B] = K.names(w);
    const d = K.when(w);
    const scenes = [];
    const S = K.stage(L, "stars", "#0B0B0E");
    S.add(SKY);
    S.col(
      [
        { text: w.ceremony_name || "Lễ Thành Hôn", font: F.kicker, color: C.champ, lh: 1.2, caps: true, ls: 8, align: "center", shadow: C.shade, anim: A("track", 2, { ls0: 24 }) },
        { text: G, font: F.name, fit: true, color: C.ivory, lh: 1.05, mt: 20, align: "center", shadow: C.shade, anim: A("letters", 4) },
        { orn: 60, lh: 1.3, mt: 4, make: (cx, cy) => K.heart(cx, cy, 60, { color: C.champ, glow: GLOW, anim: A("draw", 9, { t: 2.6 }) }) },
        { text: B, font: F.name, fit: true, color: C.ivory, lh: 1.05, mt: 4, align: "center", shadow: C.shade, anim: A("letters", 12) },
        { line: true, w: 120, color: C.gold, mt: 28, center: true, anim: A("zoom", 17, { s0: 0.05 }) },
        d && { text: d.num(" . "), font: F.digits, color: C.champ, lh: 1.2, mt: 28, ls: 6, align: "center", shadow: C.shade, anim: A("track", 18) },
        w.ceremony_lunar && { text: w.ceremony_lunar, font: F.note, color: C.soft, lh: 1.3, mt: 12, align: "center", shadow: C.shade, anim: A("fade", 21) },
      ],
      120, W - 240, 64, H - 64,
    );
    K.push(scenes, "stars", "Sao rơi", DUR, S);
    return scenes;
  }
})();
