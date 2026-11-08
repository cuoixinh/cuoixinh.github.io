// Đồ nghề dùng chung cho mẫu Hình nền LED (window.CXLedKit): kho ảnh của thiệp, ngày cưới, dựng
// một cảnh có ô ảnh/khối chữ sửa được ở tab "Cảnh", điểm vẽ đường viền cho phần tử `stroke`.
// Nạp TRƯỚC mọi file mẫu. Chỉ dựng dữ liệu cảnh — vẽ là việc của slide-cuoi/engine/.

window.CXLedKit = (() => {
  // Nhịp trễ: 1 = 0.15 giây.
  const A = (k, n, o) => ({ k, d: n * 0.15, ...o });
  const pad = (n) => String(n).padStart(2, "0");
  const WEEKDAYS = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
  const MONTHS = ["Tháng Một", "Tháng Hai", "Tháng Ba", "Tháng Tư", "Tháng Năm", "Tháng Sáu", "Tháng Bảy", "Tháng Tám", "Tháng Chín", "Tháng Mười", "Tháng Mười Một", "Tháng Mười Hai"];

  // Ngày lễ của thiệp tách sẵn từng phần; null khi thiệp chưa có ngày.
  function when(w) {
    const s = w.ceremony_date;
    const d = s ? new Date(s + "T00:00:00") : null;
    if (!d || isNaN(d)) return null;
    const day = d.getDate();
    const mon = d.getMonth() + 1;
    const year = d.getFullYear();
    return {
      dd: pad(day), mm: pad(mon), yyyy: String(year), weekday: WEEKDAYS[d.getDay()], month: MONTHS[mon - 1],
      long: `${WEEKDAYS[d.getDay()]}, ngày ${day} tháng ${mon} năm ${year}`,
      num: (sep = " . ") => `${pad(day)}${sep}${pad(mon)}${sep}${year}`,
    };
  }

  let _mctx = null;
  function width(font, s) {
    _mctx ||= document.createElement("canvas").getContext("2d");
    _mctx.font = CXSlideEngine.fontStr(font);
    return _mctx.measureText(s).width;
  }

  // Kho ảnh: album quay vòng (thiếu thì lặp lại); album rỗng thì ảnh bìa, ảnh cô dâu, chú rể.
  function pool(w) {
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

  // Điểm vẽ cho phần tử `stroke` (mảng [x, y]). ring: cung elip từ góc a0 tới a1 (độ, 0 = phải,
  // -90 = đỉnh) · arch/chamfer: đường viền khép kín, cùng hình với `shape` của ảnh.
  function ring(cx, cy, rx, ry = rx, a0 = -90, a1 = 270, n = 144) {
    return Array.from({ length: n + 1 }, (_, i) => {
      const a = ((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180;
      return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry];
    });
  }
  function arch(x, y, w, h) {
    const r = w / 2;
    // Vẽ từ chân trái lên vòm rồi xuống chân phải, khép bằng cạnh đáy.
    return [[x, y + h], ...ring(x + r, y + r, r, r, 180, 360, 72), [x + w, y + h], [x, y + h]];
  }
  function chamfer(x, y, w, h, c) {
    return [[x + c, y], [x + w - c, y], [x + w, y + c], [x + w, y + h - c], [x + w - c, y + h], [x + c, y + h], [x, y + h - c], [x, y + c], [x + c, y]];
  }
  // Phần tử `stroke` với khung bao tính từ điểm (hiệu ứng draw/zoom cần khung).
  function stroke(paths, o) {
    const xs = paths.flat().map((p) => p[0]);
    const ys = paths.flat().map((p) => p[1]);
    const x = Math.min(...xs);
    const y = Math.min(...ys);
    return { type: "stroke", x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y, paths, ...o };
  }

  // Trái tim tâm (cx, cy), rộng s: hai nửa đối xứng cùng xuất phát từ mũi nhọn dưới đáy — hiệu ứng
  // "draw" vẽ hai nửa gặp nhau ở chỗ lõm trên. o: color (nét) · lw · glow · blur · fill (màu tô đặc,
  // hiện dần theo nét) · anim.
  function heart(cx, cy, s, o = {}) {
    const k = s / 32;
    const pt = (t) => [
      cx + 16 * Math.sin(t) ** 3 * k,
      cy + (-(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) - 2.5) * k,
    ];
    const half = (dir) => Array.from({ length: 73 }, (_, i) => pt(Math.PI + (dir * Math.PI * i) / 72));
    const paths = [half(-1), half(1)];
    return {
      type: "stroke", x: cx - s / 2, y: cy - s * 0.47, w: s, h: s * 0.94, paths,
      color: o.color, lw: o.lw ?? Math.max(1.6, s / 24), glow: o.glow, blur: o.blur ?? s / 4,
      fill: o.fill, fillPts: o.fill ? [...paths[0], ...paths[1].slice().reverse()] : undefined, anim: o.anim,
    };
  }
  // Trái tim làm vật ngăn giữa hai tên (`sep` của khối pair) — rộng bằng sepW × cỡ chữ.
  const heartSep = (o) => (cx, cy, s, anim) => heart(cx, cy, s, { ...o, anim: anim || o.anim });
  // Trái tim đứng riêng một dòng (khối cột), cỡ s.
  // align "left": sát mép trái cột (cột chữ canh trái).
  const heartRow = (s, o, mt, align) => ({ orn: s, lh: 1.15, mt, make: (cx, cy, _, x) => heart(align === "left" ? x + s / 2 : cx, cy, s, o) });

  // Khối chữ `fit`: thu cỡ chữ cho vừa MỘT dòng trong khổ w (tên dài không bị bẻ dòng).
  function _fitLine(b, text, w) {
    if (text.includes("\n")) return b.font;
    const s = b.caps ? text.toLocaleUpperCase("vi") : text;
    const ls = (b.ls || 0) * Math.max(0, Array.from(s).length - 1);
    const tw = width(b.font, s);
    if (tw + ls <= w) return b.font;
    let size = Math.floor((b.font.size * (w - ls)) / tw);
    while (size > 8 && width({ ...b.font, size }, s) + ls > w) size--;
    return { ...b.font, size };
  }

  // Thân chữ hoa của một phần tử chữ đã dàn (bộ vẽ đặt chữ theo baseline "middle"): đỉnh chữ hoa
  // của dòng đầu → chân chữ (baseline) của dòng cuối. Bỏ qua dấu và phần đuôi chữ (g, y).
  function _cap(el) {
    _mctx ||= document.createElement("canvas").getContext("2d");
    _mctx.font = CXSlideEngine.fontStr(el.font);
    _mctx.textBaseline = "middle";
    const m = _mctx.measureText("H");
    _mctx.textBaseline = "alphabetic";
    const n = el.lines.length;
    return { top: el.y + 0.5 * el.lh - m.actualBoundingBoxAscent, bottom: el.y + (n - 0.5) * el.lh + m.actualBoundingBoxDescent };
  }

  // Chữ nhiều dòng: giữ nguyên số dòng nhưng chia các dòng dài đều nhau (không để một chữ lẻ rơi
  // xuống dòng cuối) — tìm khổ hẹp nhất vẫn ra đúng số dòng đó rồi chèn "\n" vào chỗ ngắt.
  function _balance(b, text, w) {
    if (b.fit || text.includes("\n")) return text;
    const s = b.caps ? text.toLocaleUpperCase("vi") : text;
    const n = L_wrap(s, b, w).length;
    if (n < 2) return text;
    let lo = 0;
    let hi = w;
    for (let i = 0; i < 14; i++) {
      const mid = (lo + hi) / 2;
      if (L_wrap(s, b, mid).length > n) lo = mid;
      else hi = mid;
    }
    const words = text.trim().split(/\s+/);
    let k = 0;
    return L_wrap(s, b, hi)
      .map((l) => {
        const c = l.split(/\s+/).filter(Boolean).length;
        return words.slice(k, (k += c)).join(" ");
      })
      .join("\n");
  }
  const L_wrap = (s, b, w) => CXSlideEngine.wrap(s, b.font, w, b.ls);

  // Hai tên trên MỘT dòng, vật ngăn ở giữa; quá khổ thì thu cả cụm (kể cả vật ngăn) cho vừa.
  function _fitPair(b, two, maxW) {
    let size = b.font.size;
    const measure = () => {
      const f = { ...b.font, size };
      const k = size / b.font.size;
      const sf = typeof b.sep === "string" ? { ...(b.sepFont || b.font), size: (b.sepFont || b.font).size * k } : null;
      const sw = sf ? width(sf, b.sep) : size * (b.sepW ?? 0.56);
      const gap = size * (b.gap ?? 0.3);
      const wA = width(f, two[0]);
      const wB = width(f, two[1]);
      return { f, sf, sw, gap, wA, wB, total: wA + wB + sw + gap * 2 };
    };
    let m = measure();
    if (m.total > maxW) {
      size = Math.floor((size * maxW) / m.total);
      m = measure();
    }
    return m;
  }

  // Một cảnh đang dựng (sid = id cảnh): gom phần tử + danh sách ô ảnh/khối chữ cho tab "Cảnh".
  // · img(rect, ảnh, o, slot): ô ảnh, L.photos[slot] đè ảnh thiệp; mang `edit: slot` để bấm lên
  //   màn là mở đúng ô. `o.shape` cắt ảnh (circle · arch · chamfer).
  // · col(blocks, x, w, top, bottom, ns): cột chữ canh giữa dọc trong [top, bottom]. MỌI khối chữ
  //   mang khoá `<sid>.<ns.><vị trí trong mảng>` (tính cả ô rỗng nên khoá không xê dịch theo dữ
  //   liệu) — hai cột cùng cảnh phải khác `ns`. L.texts[khoá] đè lời mẫu, sửa thành rỗng là bỏ khối.
  //   Ngoài khối chữ/vạch của bộ dàn chữ còn hai khối: {pair: [tên, tên], font, sep, …} (hai tên một
  //   dòng; sep = chữ ngăn, kèm sepFont/sepColor/sepAnim, hoặc hàm (cx, cy, cỡ, anim) → phần tử; xoá
  //   một tên thì còn tên kia) và {orn: cỡ, make: (cx, cy, cỡ, x trái của cột) → phần tử} (hoạ tiết đứng riêng một
  //   dòng). Cột có vạch `center` thì mọi vạch ra giữa cột. Trả các phần tử vừa thêm.
  function stage(L, sid, empty) {
    const els = [];
    const photos = [];
    const texts = [];
    const say = (key, def) => {
      const own = L.texts?.[key];
      const text = typeof own === "string" ? own : String(def);
      texts.push({ key, text, def: String(def) });
      return text;
    };
    const add = (...xs) => xs.flat().forEach((x) => x && els.push(x));
    return {
      els,
      photos,
      texts,
      add,
      img(rect, ph, o = {}, slot) {
        const def = ph.file ? getImageUrl(ph.file) : "";
        const mine = slot ? L.photos?.[slot] : null;
        if (slot) photos.push({ key: slot, def, w: rect.w, h: rect.h });
        const el = { type: "image", kb: true, ...rect, src: mine?.src || def, focal: mine ? mine.focal : ph.fp, empty, edit: slot, ...o };
        els.push(el);
        return el;
      },
      col(blocks, x, w, top, bottom, ns) {
        const subs = new Map();
        const laid = [];
        blocks.forEach((b, k) => {
          if (!b) return;
          const key = `${sid}.${ns ? ns + "." : ""}${k}`;
          const hold = (font) => {
            const slot = `__slot${k}`;
            laid.push({ text: "M", font, color: "rgba(0, 0, 0, 0)", lh: b.lh ?? 1, mt: b.mt, key: slot });
            return slot;
          };
          if (b.pair) {
            const keys = [`${key}.0`, `${key}.1`];
            const two = [say(keys[0], b.pair[0]), say(keys[1], b.pair[1])];
            const on = [0, 1].filter((n) => two[n].trim());
            if (!on.length) return;
            if (on.length === 1) return laid.push({ ...b, pair: undefined, text: two[on[0]], key: keys[on[0]] });
            const show = b.caps ? two.map((s) => s.toLocaleUpperCase("vi")) : two;
            const fit = _fitPair(b, show, w);
            return subs.set(hold(fit.f), { b, fit, two: show, keys });
          }
          if (b.orn) return subs.set(hold({ family: "serif", size: b.orn }), { b });
          if (b.text == null) return laid.push(b);
          const text = say(key, b.text);
          if (text.trim()) laid.push({ ...b, text: _balance(b, text, w), key, font: b.fit ? _fitLine(b, text, w) : b.font });
        });
        const cen = laid.some((b) => b.line && b.center);
        const out = [];
        const res = L.column(laid, { x, w, top, bottom });
        res.forEach((el, i) => {
          const sub = el.key && subs.get(el.key);
          if (!sub) {
            if (cen && el.type === "line") el.x = x + (w - el.w) / 2;
            return out.push(el);
          }
          const { b, fit, two, keys } = sub;
          if (!fit) {
            // Hoạ tiết kẹp giữa hai dòng chữ: đặt đúng giữa chân chữ dòng trên và đỉnh chữ hoa dòng
            // dưới (khoảng trống quanh nó đều nhau), không theo khung dòng giữ chỗ.
            const a = res[i - 1];
            const z = res[i + 1];
            const mid = a?.type === "text" && z?.type === "text" && !subs.has(a.key) && !subs.has(z.key) ? (_cap(a).bottom + _cap(z).top) / 2 : el.y + el.h / 2;
            return out.push(...[].concat(b.make(x + w / 2, mid, b.orn, x)));
          }
          // Vật ngăn giữa hai tên: canh theo tâm thân chữ hoa của dòng tên.
          const cap = _cap({ font: fit.f, y: el.y, lh: el.lh, lines: [""] });
          const mid = (cap.top + cap.bottom) / 2;
          const x0 = b.align === "center" ? x + (w - fit.total) / 2 : b.align === "right" ? x + w - fit.total : x;
          const text = (n, tx, tw) => ({
            type: "text", x: tx, y: el.y, w: tw, tw, h: el.h, lines: [two[n]], lh: el.lh, font: fit.f, color: b.color,
            anim: b.anim, ls: 0, align: "left", shadow: b.shadow, key: keys[n],
          });
          const sx = x0 + fit.wA + fit.gap;
          const sep = fit.sf
            ? { type: "text", x: sx, y: el.y, w: fit.sw, tw: fit.sw, h: el.h, lines: [b.sep], lh: el.lh, font: fit.sf, color: b.sepColor || b.color, anim: b.sepAnim || b.anim, ls: 0, align: "left", shadow: b.shadow }
            : b.sep(sx + fit.sw / 2, mid, fit.sw, b.sepAnim);
          out.push(text(0, x0, fit.wA), ...[].concat(sep), text(1, sx + fit.sw + fit.gap, fit.wB));
        });
        add(out);
        return out;
      },
    };
  }

  // Chốt một cảnh vào danh sách (cùng dạng bộ vẽ cần).
  const push = (scenes, id, label, dur, S, extra) => scenes.push({ id, label, dur, els: S.els, photos: S.photos, texts: S.texts, ...extra });

  const names = (w) => [String(w.groom_name || "").trim() || "Chú rể", String(w.bride_name || "").trim() || "Cô dâu"];

  return { A, pad, when, width, pool, ring, arch, chamfer, stroke, heart, heartSep, heartRow, stage, push, names };
})();
