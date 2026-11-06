// Slide sân khấu "Mãi mãi về sau" (1280×720, tông be của romantic-blush): mỗi cảnh một bên
// ảnh, một bên chữ, xen kẽ trái/phải. Từ thiệp chỉ lấy ảnh, họ tên, ngày cưới, cha mẹ,
// chuyện tình — lời văn là của mẫu. Chỉ KHAI cảnh dưới dạng dữ liệu (CX_SLIDE.scenes); vẽ là
// việc của slide-cuoi/engine/slide-engine.js, chạy/xuất là runtime + slide-export.js.

(function () {
  const C = {
    paper: "#FDFAF4",
    surface: "#F7F1E7",
    heading: "#4A3B2E",
    body: "rgba(74, 59, 46, 0.88)",
    accent: "#82664B",
    gold: "#B8956A",
    line: "rgba(107, 86, 68, 0.55)",
  };
  const PLAY = '"Playfair Display", "Times New Roman", serif';
  const CORM = '"Cormorant Infant", "Times New Roman", serif';
  const SCRIPT = '"TheHamstter", cursive';
  const F = {
    kicker: { family: CORM, size: 30, style: "italic", weight: 500 },
    title: { family: PLAY, size: 56 },
    quote: { family: PLAY, size: 48, style: "italic" },
    script: { family: SCRIPT, size: 96 },
    names: { family: PLAY, size: 80 },
    amp: { family: SCRIPT, size: 64 },
    date: { family: CORM, size: 32 },
    note: { family: CORM, size: 24, style: "italic" },
    body: { family: CORM, size: 28 },
    bodyLong: { family: CORM, size: 26 },
    sign: { family: CORM, size: 34, style: "italic", weight: 500 },
    fam: { family: CORM, size: 24 },
    famRole: { family: CORM, size: 24, style: "italic" },
  };
  // Nhịp trễ hiệu ứng: 1 = 0.15 giây.
  const d = (n) => n * 0.15;

  const _day = (s) => (s ? new Date(s + "T00:00:00") : null);
  const _on = (v) => v !== false && v !== "false";
  const _parent = (title, name) => {
    const bare = String(name || "").trim().replace(/^(ông|bà)\s+/i, "");
    return bare ? `${title} ${bare}` : "";
  };
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
    w: 1280,
    h: 720,
    bg: C.paper,
    fade: 0.9,
    // Thư mục assets/data-template/ làm dữ liệu mẫu khi chưa chọn thiệp.
    demo: "romantic-blush",
    fonts: [
      `400 56px ${PLAY}`,
      `italic 400 48px ${PLAY}`,
      `400 28px ${CORM}`,
      `italic 400 24px ${CORM}`,
      `italic 500 30px ${CORM}`,
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
    const add = (sid, photo, blocks, opt = {}) => scenes.push(_scene(scenes.length, sid, photo, blocks, opt, L));

    // Khối dùng lại nhiều lần.
    const kicker = (text, n = 2) => ({ text, font: F.kicker, color: C.accent, lh: 1.2, anim: { k: "fade", d: d(n) } });
    const title = (text, n = 3, font = F.title) => ({ text, font, color: C.heading, lh: 1.16, mt: 16, anim: { k: "up", d: d(n) } });
    const rule = (n) => ({ line: true, w: 96, color: C.gold, mt: 28, anim: { k: "spread", d: d(n) } });
    const para = (text, n, mt = 28, font = F.body) => ({ text, font, color: C.body, lh: 1.5, mt, anim: { k: "up", d: d(n) } });
    // Lời nói (cô dâu, chú rể, anh – em, gửi cha mẹ, cảm ơn): hiện bằng hiệu ứng đánh chữ.
    const say = (text, n, mt = 28) => ({ text, font: F.body, color: C.body, lh: 1.5, mt, anim: { k: "type", d: d(n) } });
    const sign = (text, n) => ({ text, font: F.sign, color: C.accent, lh: 1.2, mt: 28, anim: { k: "wipe", d: d(n) } });
    const note = (text, n, mt = 8) => ({ text, font: F.note, color: C.heading, lh: 1.4, mt, anim: { k: "fade", d: d(n) } });

    // --- Mở đầu ---
    const ceremonyName = w.ceremony_name || "Lễ Thành Hôn";
    const cd = _day(w.ceremony_date);
    const date = cd
      ? `${_WEEKDAYS[cd.getDay()]}, ngày ${cd.getDate()} tháng ${cd.getMonth() + 1} năm ${cd.getFullYear()}`
      : "";
    add("open", own(w.cover_image_url, fps.cover_image_url), [
      kicker(ceremonyName),
      { text: G, font: F.names, color: C.heading, lh: 1.04, mt: 20, anim: { k: "up", d: d(3) } },
      { text: "&", font: F.amp, color: C.gold, lh: 1, mt: 4, indent: 64, anim: { k: "fade", d: d(4) } },
      { text: B, font: F.names, color: C.heading, lh: 1.04, mt: 4, anim: { k: "up", d: d(5) } },
      rule(6),
      date && { text: date, font: F.date, color: C.heading, lh: 1.3, mt: 28, anim: { k: "up", d: d(7) } },
      w.ceremony_lunar && note(w.ceremony_lunar, 8),
      w.ceremony_location && note(w.ceremony_location, 9),
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
      add(`album${i}`, next(), [title(q, 2, F.quote), rule(6)], { dur: 7, label: `Album ảnh ${i + 1}` });
    }

    // --- Gửi cha mẹ hai bên (có tên cha mẹ mới hiện) ---
    const fam = (role, father, mother) => {
      const names = [_parent("Ông", father), _parent("Bà", mother)].filter(Boolean);
      return names.length
        ? [{ text: role, font: F.famRole, color: C.accent, lh: 1.4 }, ...names.map((n) => ({ text: n, font: F.fam, color: C.heading, lh: 1.4, mt: 4 }))]
        : null;
    };
    const cols = [fam("Nhà trai", w.groom_father, w.groom_mother), fam("Nhà gái", w.bride_father, w.bride_mother)].filter(Boolean);
    if (cols.length) {
      add("parents", next(), [
        kicker("Gửi cha mẹ"),
        title("Công ơn sinh thành"),
        rule(5),
        say("Chúng con xin cảm ơn bố mẹ hai bên đã nuôi dưỡng, dạy dỗ và vun đắp cho chúng con có được ngày hôm nay. Chúng con xin hứa sẽ sống thật hạnh phúc để bố mẹ luôn yên lòng.", 6),
        { cols, gap: 32, mt: 32, anim: { k: "up", d: d(8) } },
      ], { dur: 11, label: "Gửi cha mẹ" });
    }

    // --- Lời cảm ơn (cảnh cuối) ---
    add("thanks", own(w.cover_image_url, fps.cover_image_url), [
      { text: "Thank you", font: F.script, color: C.accent, lh: 1.1, anim: { k: "wipe", d: d(2) } },
      rule(5),
      say("Sự hiện diện của quý vị hôm nay đã làm ngày vui của chúng con thêm trọn vẹn. Chúng con kính chúc quý vị luôn mạnh khoẻ, hạnh phúc và bình an.", 6),
      sign("Chú rể & Cô dâu", 8),
    ], { dur: 10, label: "Lời cảm ơn" });

    return scenes;
  }

  // Một cảnh: ảnh một bên (cảnh chẵn bên trái, lẻ bên phải), chữ bên kia. Thời lượng (giây)
  // tự tính theo độ dài chữ khi cảnh không khai `dur`, để khách kịp đọc trên sân khấu.
  // MỌI khối chữ mang khoá `<sid>.<vị trí trong mảng khai>` (tính cả ô rỗng nên không xê dịch
  // theo dữ liệu; chữ trong cột con thêm `.<cột>.<dòng>`) — trang cha sửa chữ theo khoá đó,
  // sửa thành rỗng là bỏ khối. Thêm chữ vào cảnh mà không qua đây là chữ đó không sửa được.
  function _scene(i, sid, photo, blocks, opt, L) {
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
      return text.trim() ? { ...b, text } : null;
    };
    blocks = blocks.map((b, k) => apply(b, `${sid}.${k}`)).filter(Boolean);

    // Đánh chữ nối đuôi: đoạn sau chờ đoạn trước gõ xong, khối đứng sau (chữ ký, tên cha mẹ)
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
    const rev = i % 2 === 1;
    const PW = 520;

    // Bên ảnh: khối màu nhấn lệch góc · ảnh · khung nét mảnh lệch đè lên — trượt vào cùng nhau.
    // Ảnh khách tự tải lên ở mục "Ảnh trong slide" (L.photos, khoá = id cảnh) đè ảnh của thiệp.
    const px = rev ? 1280 - PW : 0;
    const def = photo.file ? getImageUrl(photo.file) : "";
    const mine = L.photos?.[sid];
    const src = mine?.src || getImageUrl(photo.file);
    const fp = mine ? mine.focal : photo.fp;
    const photoEls = rev
      ? [
          { type: "rect", x: 1280 - 320, y: 360, w: 320, h: 360, fill: C.accent },
          { type: "image", x: px, y: 48, w: PW - 48, h: 624, src, focal: fp, kb: true, empty: C.surface },
          { type: "frame", x: px - 28, y: 24, w: PW - 76 + 28, h: 620, stroke: C.line },
        ]
      : [
          { type: "rect", x: 0, y: 0, w: 320, h: 360, fill: C.accent },
          { type: "image", x: 48, y: 48, w: PW - 48, h: 624, src, focal: fp, kb: true, empty: C.surface },
          { type: "frame", x: 76, y: 76, w: PW - 76 + 28, h: 620, stroke: C.line },
        ];
    const group = { type: "group", x: px, y: 0, w: PW, h: 720, kids: photoEls, anim: { k: rev ? "right" : "left", d: 0 } };

    // Bên chữ: cột rộng 592, canh giữa theo chiều dọc. Khối có `indent` (dấu &) lùi vào.
    const tx = rev ? 72 : PW + 96;
    const text = L.column(blocks, { x: tx, w: 592, top: 56, bottom: 720 - 56 });
    blocks.forEach((b, k) => b.indent && text[k] && (text[k].x += b.indent));
    return { dur, label: opt.label || "", texts, photo: { key: sid, def, w: PW - 48, h: 624 }, els: [group, ...text] };
  }
})();
