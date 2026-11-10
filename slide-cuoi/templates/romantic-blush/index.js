// Slide sân khấu "Mãi mãi về sau" (1280×720, hồng pastel, khối màu phẳng): năm kiểu bố cục (_LAYOUTS)
// luân phiên, hai cảnh liền nhau không trùng kiểu và đổi bên trái/phải xen kẽ; tiêu đề viết hoa chữ
// không chân, mọi khối bay từ ngoài vào, quầng sáng trôi trên ảnh + đốm sáng lấp lánh. Từ thiệp
// chỉ lấy ảnh, họ tên, ngày cưới, chuyện tình — không tên cha mẹ, không địa chỉ (khách đã ở tiệc).
// Chỉ KHAI cảnh (CX_SLIDE.scenes); vẽ/chạy/xuất là việc của engine + runtime + slide-export.js.

(function () {
  const W = 1280;
  const H = 720;
  const C = {
    paper: "#FFFDFD",
    band: "#F6DCE2",
    peach: "#FAEAE3",
    rule: "#EDC3CE",
    surface: "#F8E6EA",
    rose: "#B9788B",
    roseDeep: "#9C5A6E",
    ink: "#4A3A40",
    body: "rgba(74, 58, 64, 0.9)",
    glow: "rgba(255, 222, 232, 0.55)",
  };
  const SANS = '"Montserrat", "Segoe UI", sans-serif';
  const CORM = '"Cormorant Infant", "Times New Roman", serif';
  const SCRIPT = '"TheHamstter", cursive';
  const F = {
    kicker: { family: SANS, size: 19, weight: 500 },
    title: { family: SANS, size: 40, weight: 300 },
    quote: { family: SANS, size: 36, weight: 300 },
    script: { family: SCRIPT, size: 96 },
    names: { family: SANS, size: 52, weight: 300 },
    amp: { family: SCRIPT, size: 64 },
    date: { family: SANS, size: 24, weight: 400 },
    note: { family: SANS, size: 19, style: "italic", weight: 300 },
    body: { family: SANS, size: 22, weight: 300 },
    bodyLong: { family: SANS, size: 20, weight: 300 },
    sign: { family: CORM, size: 34, style: "italic", weight: 500 },
  };
  // Nhịp trễ hiệu ứng: 1 = 0.15 giây.
  const d = (n) => n * 0.15;

  const _day = (s) => (s ? new Date(s + "T00:00:00") : null);
  const _on = (v) => v !== false && v !== "false";
  const _WEEKDAYS = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
  const _QUOTES = [
    "Gặp được nhau đã là may mắn, đi cùng nhau là lựa chọn.",
    "Từ hôm nay, nhà là nơi có anh và em.",
    "Cảm ơn vì đã chọn nhau giữa muôn người.",
    "Mỗi ngày bên nhau đều là một ngày đẹp.",
    "Yêu là cùng nhau nhìn về một hướng.",
    "Cùng nhau đi qua thật nhiều mùa yêu thương.",
  ];
  const _ALBUM_MAX = 6;
  const _STORY_MAX = 6;

  window.CX_SLIDE = {
    id: "romantic-blush",
    w: W,
    h: H,
    bg: C.paper,
    fade: 0.9,
    // Đốm sáng lấp lánh trôi lên phủ cả slide (chỉ thấy rõ trên ảnh và mảng hồng).
    fx: { sparkle: { n: 16, size: 8, alpha: 0.6, seed: 5 } },
    // Thư mục assets/data-template/ làm dữ liệu mẫu khi chưa chọn thiệp.
    demo: "romantic-blush",
    fonts: [
      `300 40px ${SANS}`,
      `400 24px ${SANS}`,
      `500 19px ${SANS}`,
      `italic 300 19px ${SANS}`,
      `italic 500 34px ${CORM}`,
      `400 64px ${SCRIPT}`,
    ],
    scenes: buildScenes,
  };

  // Lời văn: cô dâu, chú rể nói với quan khách và cha mẹ thì xưng "con"; nói với nhau thì
  // "anh" – "em". Không chèn họ tên vào lời văn — tên chỉ đứng riêng ở cảnh mở đầu.
  function buildScenes(w, L) {
    const G = String(w.groom_name || "").trim() || "Chú rể";
    const B = String(w.bride_name || "").trim() || "Cô dâu";
    const fps = w.image_focal_points || {};

    // Kho ảnh: album quay vòng; album rỗng thì ảnh bìa.
    const album = (Array.isArray(w.gallery_images) ? w.gallery_images : []).filter(Boolean);
    let at = 0;
    const next = () => {
      if (!album.length) return { file: w.cover_image_url, fp: fps.cover_image_url };
      const file = album[at++ % album.length];
      return { file, fp: fps.gallery_images?.[file] };
    };
    const own = (file, fp) => (file ? { file, fp } : next());

    const scenes = [];
    // Bố cục: cảnh album luân phiên "duo"/"card", cảnh khác xoay vòng _MAIN; trùng kiểu với cảnh
    // ngay trước thì lấy kiểu kế tiếp. Bên ảnh đổi trái/phải mỗi cảnh. Mỗi cảnh kèm ảnh phụ (ảnh
    // kế tiếp của album) cho bố cục có hai ô ảnh.
    let prev = "";
    let km = 0;
    let ka = 0;
    const add = (sid, photo, blocks, opt = {}) => {
      const album = sid.startsWith("album");
      const pick = () => (album ? (ka++ % 2 ? "card" : "duo") : _MAIN[km++ % _MAIN.length]);
      let lay = pick();
      if (lay === prev) lay = pick();
      prev = lay;
      scenes.push(_scene(sid, photo, next(), blocks, { ...opt, lay, rev: scenes.length % 2 === 1 }, L));
    };

    // Khối dùng lại nhiều lần. Chữ bay vào một quãng ngắn từ phía cột chữ (from "in", _scene đổi
    // thành left/right theo bên ảnh) — bay từ tận mép khung là chữ vắt ngang qua ảnh.
    const fly = (n, dist = 140, t = 1.3) => ({ k: "fly", from: "in", dist, t, d: d(n) });
    // kicker nằm trong nhãn bo tròn (pill, _scene vẽ nền nhãn theo bề ngang chữ).
    const kicker = (text, n = 2) => ({ text, font: F.kicker, color: C.roseDeep, lh: 1.6, pill: true, anim: fly(n, 90) });
    const title = (text, n = 3, font = F.title) => ({ text, font, color: C.rose, lh: 1.3, mt: 24, caps: true, ls: 3, anim: fly(n, 180, 1.5) });
    const rule = (n) => ({ line: true, w: 96, color: C.rule, mt: 28, anim: { k: "spread", d: d(n) } });
    const para = (text, n, mt = 28, font = F.body) => ({ text, font, color: C.body, lh: 1.65, mt, anim: fly(n, 80) });
    // Lời nói (cô dâu, chú rể, anh – em, gửi cha mẹ, cảm ơn): hiện bằng hiệu ứng đánh chữ.
    const say = (text, n, mt = 28) => ({ text, font: F.body, color: C.body, lh: 1.65, mt, anim: { k: "type", d: d(n) } });
    const sign = (text, n) => ({ text, font: F.sign, color: C.rose, lh: 1.2, mt: 28, anim: { k: "wipe", d: d(n) } });
    const note = (text, n, mt = 8) => ({ text, font: F.note, color: C.ink, lh: 1.4, mt, anim: { k: "fade", d: d(n) } });

    // --- Mở đầu ---
    const ceremonyName = w.ceremony_name || "Lễ Thành Hôn";
    const cd = _day(w.ceremony_date);
    const date = cd
      ? `${_WEEKDAYS[cd.getDay()]}, ngày ${cd.getDate()} tháng ${cd.getMonth() + 1} năm ${cd.getFullYear()}`
      : "";
    // Hai tên lần lượt bay vào từ mép phía chữ, hơi xoay rồi đứng lại; dấu & nở ra ở giữa.
    add("open", own(w.cover_image_url, fps.cover_image_url), [
      kicker(ceremonyName),
      { text: G, font: F.names, color: C.rose, lh: 1.15, mt: 28, caps: true, ls: 4, anim: { k: "fly", from: "in", t: 1.6, rot: 4, d: d(3) } },
      { text: "&", font: F.amp, color: C.roseDeep, lh: 1, mt: 0, indent: 64, anim: { k: "zoom", s0: 2.4, d: d(8) } },
      { text: B, font: F.names, color: C.rose, lh: 1.15, mt: 0, caps: true, ls: 4, anim: { k: "fly", from: "in", t: 1.6, rot: -4, d: d(5) } },
      rule(9),
      date && { text: date, font: F.date, color: C.ink, lh: 1.4, mt: 28, anim: fly(10, 100) },
      w.ceremony_lunar && note(w.ceremony_lunar, 11),
    ], { dur: 9, label: "Mở đầu" });

    // --- Lời chú rể, lời cô dâu gửi quan khách ---
    add("groom", own(w.groom_image_url, fps.groom_image_url), [
      kicker("Lời chú rể"),
      title("Kính gửi quý vị quan khách"),
      rule(5),
      say("Hôm nay, trước sự chứng kiến của hai bên gia đình và những người thân yêu nhất, con xin được nắm tay người con thương bước sang một chặng đường mới.", 6),
      say("Con xin cảm ơn quý vị đã dành thời gian đến chung vui. Sự có mặt của mọi người là lời chúc phúc quý giá nhất mà chúng con nhận được.", 7, 16),
      sign("Chú rể", 9),
    ], { label: "Lời chú rể" });
    add("bride", own(w.bride_image_url, fps.bride_image_url), [
      kicker("Lời cô dâu"),
      title("Cảm ơn vì đã ở đây"),
      rule(5),
      say("Hôm nay, con không chỉ khoác lên mình chiếc váy cưới, mà còn mang theo lời hứa sẽ cùng người con thương vun đắp một mái ấm bình yên.", 6),
      say("Con xin cảm ơn quý vị đã đến, đã thương yêu và dõi theo hai chúng con suốt chặng đường vừa qua.", 7, 16),
      sign("Cô dâu", 9),
    ], { label: "Lời cô dâu" });

    // --- Chuyện tình: mỗi mốc một cảnh ---
    const story = _on(w.enable_love_story) && Array.isArray(w.love_story)
      ? w.love_story.filter((ev) => ev && (ev.title || ev.content)).slice(0, _STORY_MAX)
      : [];
    story.forEach((ev, k) => {
      const long = String(ev.content || "").length > 260;
      add(`story${k}`, own(ev.image_url, ev.focal_point), [
        ev.date && kicker(ev.date),
        ev.title && title(ev.title),
        rule(5),
        ev.content && para(ev.content, 6, 28, long ? F.bodyLong : F.body),
      ], { label: ev.title || ev.date || "Chuyện tình" });
    });

    // --- Hai người nói với nhau ---
    add("anh", next(), [
      kicker("Anh gửi em"),
      title("Từ hôm nay"),
      rule(5),
      say("Cảm ơn em đã tin anh và chọn anh giữa muôn người. Từ hôm nay, anh xin được che chở, nhường nhịn và thương em mỗi ngày, cả những ngày vui lẫn những ngày giông gió.", 6),
      sign("Anh", 8),
    ], { label: "Anh gửi em" });
    add("em", next(), [
      kicker("Em gửi anh"),
      title("Cùng anh về một nhà"),
      rule(5),
      say("Cảm ơn anh đã kiên nhẫn đi cùng em suốt quãng đường vừa qua. Em không hứa ngày nào cũng dễ dàng, nhưng em hứa sẽ luôn nắm tay anh, cùng anh vun đắp mái nhà nhỏ của hai đứa.", 6),
      sign("Em", 8),
    ], { label: "Em gửi anh" });

    // --- Album: ảnh + một câu ngắn ---
    for (let i = 0; i < Math.min(_ALBUM_MAX, album.length); i++) {
      const q = _QUOTES[i % _QUOTES.length];
      add(`album${i}`, next(), [{ ...title(q, 2, F.quote), caps: false, ls: 0, color: C.ink, lh: 1.45 }, rule(6)], { dur: 7, label: `Album ảnh ${i + 1}` });
    }

    // --- Gửi cha mẹ hai bên: chỉ lời cảm ơn, KHÔNG hiện tên cha mẹ ---
    add("parents", next(), [
      kicker("Gửi cha mẹ"),
      title("Công ơn sinh thành"),
      rule(5),
      say("Chúng con xin cảm ơn bố mẹ hai bên đã nuôi dưỡng, dạy dỗ và vun đắp cho chúng con có được ngày hôm nay. Chúng con xin hứa sẽ sống thật hạnh phúc để bố mẹ luôn yên lòng.", 6),
    ], { dur: 11, label: "Gửi cha mẹ" });

    // --- Lời cảm ơn (cảnh cuối) ---
    add("thanks", own(w.cover_image_url, fps.cover_image_url), [
      { text: "Thank you", font: F.script, color: C.rose, lh: 1.1, anim: { k: "wipe", d: d(3) } },
      rule(5),
      say("Sự hiện diện của quý vị hôm nay đã làm ngày vui của chúng con thêm trọn vẹn. Chúng con kính chúc quý vị luôn mạnh khoẻ, hạnh phúc và bình an.", 6),
      sign("Chú rể & Cô dâu", 8),
    ], { dur: 10, label: "Lời cảm ơn" });

    return scenes;
  }

  // Một cảnh theo bố cục opt.lay (_LAYOUTS), opt.rev = lật gương trái ↔ phải. Thời lượng (giây)
  // tự tính theo độ dài chữ khi cảnh không khai `dur`, để khách kịp đọc trên sân khấu.
  // MỌI khối chữ mang khoá `<sid>.<vị trí trong mảng khai>` (tính cả ô rỗng nên không xê dịch
  // theo dữ liệu; chữ trong cột con thêm `.<cột>.<dòng>`) — trang cha sửa chữ theo khoá đó,
  // sửa thành rỗng là bỏ khối. Thêm chữ vào cảnh mà không qua đây là chữ đó không sửa được.
  // Khối giữ `key` (engine chép sang phần tử chữ) và ảnh cảnh mang `edit: sid` — bộ phát dùng
  // hai dấu đó để bấm thẳng lên slide là mở đúng ô sửa.
  function _scene(sid, photo, strip, blocks, opt, L) {
    const texts = [];
    const apply = (b, key) => {
      if (!b) return null;
      if (b.cols) {
        const cols = b.cols
          .map((col, c) => col.map((x, j) => apply(x, `${key}.${c}.${j}`)).filter(Boolean))
          .filter((col) => col.length);
        return cols.length ? { ...b, cols } : null;
      }
      if (b.text == null) return b;
      const own = L.texts?.[key];
      const text = typeof own === "string" ? own : String(b.text);
      texts.push({ key, text, def: String(b.text) });
      return text.trim() ? { ...b, text, key } : null;
    };
    blocks = blocks.map((b, k) => apply(b, `${sid}.${k}`)).filter(Boolean);
    const rev = !!opt.rev;
    const G = _LAYOUTS[opt.lay] || _LAYOUTS.band;
    // Hướng theo bản chưa lật gương; bố cục lật (rev) thì đổi trái ↔ phải.
    const flip = (dir) => (rev ? _MIRROR[dir] || dir : dir);
    // Chữ bay vào từ phía cột chữ (G.from), chờ thêm G.delay khi phải đợi nền chữ bay vào trước;
    // bố cục chật dùng cỡ chữ đoạn nhỏ hơn; canh giữa thì mọi dòng canh giữa cột.
    blocks = blocks.map((b) => {
      let o = b.anim?.from === "in" ? { ...b, anim: { ...b.anim, from: flip(G.from) } } : b;
      if (G.delay && o.anim) o = { ...o, anim: { ...o.anim, d: (o.anim.d || 0) + G.delay } };
      if (G.compact && o.font === F.body) o = { ...o, font: F.bodyLong };
      if (G.center && o.text != null) o = { ...o, align: "center", indent: 0 };
      return o;
    });

    // Đánh chữ nối đuôi: đoạn sau chờ đoạn trước gõ xong, khối đứng sau (chữ ký)
    // chờ đoạn cuối. Thời điểm tính theo chữ ĐÃ SỬA nên đổi lời là nhịp tự giãn theo.
    let typedEnd = 0;
    blocks = blocks.map((b) => {
      if (!b.anim) return b;
      const at = typedEnd ? Math.max(b.anim.d || 0, typedEnd + 0.4) : b.anim.d || 0;
      if (b.anim.k === "type") typedEnd = at + L.typeTime(b.text, b.anim.cps);
      return { ...b, anim: { ...b.anim, d: at } };
    });

    const len = blocks.reduce((n, b) => n + (b.text ? String(b.text).length : 0), 0);
    // Có đánh chữ: giữ thêm 4 giây sau khi gõ xong để khách đọc lại và chữ ký kịp hiện.
    const dur = Math.max(opt.dur || Math.min(16, Math.max(8, 4 + len * 0.045)), typedEnd ? typedEnd + 4 : 0);
    // Phần nhìn của bố cục: G.build vẽ theo toạ độ bản chưa lật (cảnh ảnh trái / chữ phải…), mx lật
    // gương qua trục giữa khi rev. Ảnh khách tự tải ở mục "Ảnh trong slide" (L.photos, khoá = id
    // cảnh, `<id>.p1` cho ảnh phụ) đè ảnh của thiệp.
    const mx = (x, w) => (rev ? W - x - w : x);
    const slots = [];
    const pic = (key, ph, x, y, w, h, anim, more) => {
      const mine = L.photos?.[key];
      slots.push({ key, def: ph.file ? getImageUrl(ph.file) : "", w, h });
      return { type: "image", x: mx(x, w), y, w, h, src: mine?.src || getImageUrl(ph.file), focal: mine ? mine.focal : ph.fp, kb: true, empty: C.surface, edit: key, anim: _flipAnim(anim, flip), ...more };
    };
    const box = (x, y, w, h, fill, anim) => ({ type: "rect", x: mx(x, w), y, w, h, fill, anim: _flipAnim(anim, flip) });
    // Ảnh phụ viền trắng: nền trắng + ảnh, bay vào cùng nhau.
    const framed = (x, y, s, anim) => ({
      type: "group", x: mx(x, s), y, w: s, h: s, anim: _flipAnim(anim, flip),
      kids: [box(x, y, s, s, C.paper), pic(`${sid}.p1`, strip, x + 8, y + 8, s - 16, s - 16)],
    });
    const glow = (x, y, r) => ({ type: "orb", x: rev ? W - x : x, y, r, color: C.glow, dx: 60, dy: 34, pulse: 0.08 });
    const outline = (x, y, w, h, anim) => ({ type: "frame", x: mx(x, w), y, w, h, stroke: C.band, lw: 2, anim: _flipAnim(anim, flip) });
    const back = G.build({ sid, photo, strip, pic, box, framed, glow, outline });

    // Cột chữ, canh giữa theo chiều dọc. Khối có `indent` (dấu &) lùi vào; khối `pill` có nền nhãn
    // bo tròn ôm theo chữ, mở ra cùng nhịp với chữ; bố cục canh giữa thì vạch ngắn cũng canh giữa.
    const col = G.col;
    const text = L.column(blocks, { x: mx(col.x, col.w), w: col.w, top: col.top, bottom: col.bottom });
    const pills = [];
    blocks.forEach((b, k) => {
      const el = text[k];
      if (!el) return;
      if (b.indent) el.x += b.indent;
      if (G.center && el.type === "line") el.x += (col.w - el.w) / 2;
      if (b.pill) {
        if (!G.center) el.x += 24;
        const px = G.center ? el.x + (col.w - el.tw) / 2 - 24 : el.x - 24;
        pills.push({ type: "image", src: "", radius: el.h / 2, x: px, y: el.y, w: el.tw + 48, h: el.h, empty: C.band, anim: { k: "reveal", from: flip(G.from) === "left" ? "left" : "right", t: 0.9, d: el.anim?.d || 0 } });
      }
    });
    return {
      id: sid,
      dur,
      label: opt.label || "",
      texts,
      photos: slots,
      els: [{ type: "rect", x: 0, y: 0, w: W, h: H, fill: C.paper }, ...back, ...pills, ...text],
    };
  }

  // Lật hướng bay / mở của hiệu ứng theo bố cục lật gương.
  const _MIRROR = { left: "right", right: "left", tl: "tr", tr: "tl", bl: "br", br: "bl" };
  const _flipAnim = (a, flip) => (a && typeof a.from === "string" ? { ...a, from: flip(a.from) } : a);

  // Năm kiểu bố cục, toạ độ theo bản chưa lật. build() trả phần nền + ảnh (vẽ dưới chữ); col = cột
  // chữ {x, w, top, bottom}; from = phía chữ bay vào; compact = chữ đoạn nhỏ hơn (cột chật);
  // center = canh giữa. Bố cục nào có `framed` là có ô ảnh phụ `<id>.p1`.
  const _MAIN = ["split", "band", "card", "stack"];
  const _LAYOUTS = {
    // Chia đôi: ảnh tràn nửa trái mở dần ra, khung viền hồng quanh cột chữ, ảnh phụ viền trắng đè
    // lên đường chia.
    split: {
      from: "right",
      compact: true,
      col: { x: 704, w: 472, top: 80, bottom: 640 },
      build: ({ sid, photo, pic, framed, glow, outline }) => [
        pic(sid, photo, 0, 0, 560, 720, { k: "reveal", from: "left", drift: 120, t: 1.5, d: 0 }),
        glow(160, 140, 320),
        outline(624, 48, 608, 624, { k: "reveal", from: "top", t: 1.4, d: 0.4 }),
        framed(456, 456, 216, { k: "fly", from: "bottom", t: 1.5, d: 0.6 }),
      ],
    },
    // Dải dọc: dải hồng bay vào từ mép, ảnh chữ nhật đè lên mép dải, dải da đào hẹp ở mép kia kèm
    // ảnh phụ trồi lên.
    band: {
      from: "right",
      col: { x: 608, w: 512, top: 56, bottom: 664 },
      build: ({ sid, photo, strip, pic, box, glow }) => [
        box(0, 0, 400, 720, C.band, { k: "fly", from: "left", t: 1.3, d: 0 }),
        box(1184, 0, 96, 720, C.peach, { k: "fly", from: "right", t: 1.3, d: 0.15 }),
        pic(`${sid}.p1`, strip, 1184, 360, 96, 360, { k: "reveal", from: "bottom", drift: 60, t: 1.4, d: 0.7 }, { kb: "in" }),
        pic(sid, photo, 136, 64, 400, 592, { k: "fly", from: "left", rot: -5, t: 1.6, d: 0.3 }),
        glow(300, 200, 280),
      ],
    },
    // Thẻ chữ: ảnh lớn chiếm hai phần ba bên phải, thẻ trắng chứa chữ đè lên mép ảnh, mảng hồng
    // lệch xuống sau thẻ.
    card: {
      from: "left",
      compact: true,
      delay: 0.6,
      col: { x: 104, w: 504, top: 96, bottom: 624 },
      build: ({ sid, photo, pic, box, glow }) => [
        pic(sid, photo, 520, 0, 760, 720, { k: "fly", from: "right", t: 1.6, d: 0 }),
        glow(1060, 180, 340),
        box(32, 88, 600, 600, C.band, { k: "fly", from: "bl", t: 1.5, d: 0.2 }),
        box(56, 56, 600, 608, C.paper, { k: "fly", from: "left", t: 1.5, d: 0.35 }),
      ],
    },
    // Chồng ảnh: dải hồng nằm ngang bên phải, ảnh dọc cao rơi từ trên xuống, ảnh phụ vuông viền trắng
    // bay lên đè lệch góc dưới.
    stack: {
      from: "left",
      compact: true,
      col: { x: 80, w: 480, top: 64, bottom: 656 },
      build: ({ sid, photo, pic, box, framed, glow }) => [
        box(600, 128, 680, 464, C.band, { k: "fly", from: "right", t: 1.3, d: 0 }),
        pic(sid, photo, 836, 48, 360, 624, { k: "fly", from: "top", t: 1.6, d: 0.2 }),
        glow(980, 140, 300),
        framed(616, 404, 256, { k: "fly", from: "bottom", t: 1.6, d: 0.45 }),
      ],
    },
    // Bộ đôi (cảnh album): hai ảnh cao tràn hai mép bay vào ngược chiều, câu trích canh giữa trên nền
    // hồng ở giữa.
    duo: {
      from: "bottom",
      center: true,
      col: { x: 448, w: 384, top: 80, bottom: 640 },
      build: ({ sid, photo, strip, pic, box, glow }) => [
        box(400, 0, 480, 720, C.band, { k: "reveal", from: "top", t: 1.2, d: 0 }),
        pic(sid, photo, 0, 0, 400, 720, { k: "fly", from: "left", t: 1.6, d: 0.15 }),
        pic(`${sid}.p1`, strip, 880, 0, 400, 720, { k: "fly", from: "right", t: 1.6, d: 0.3 }, { kb: "in" }),
        glow(200, 120, 280),
      ],
    },
  };
})();
