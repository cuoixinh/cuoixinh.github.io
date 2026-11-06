// Bộ phát chung của mọi mẫu slide (slide-cuoi/templates/<mẫu>/): dựng dự án bằng
// CXSlideEngine.build từ CX_SLIDE của mẫu, vẽ lên canvas theo đồng hồ riêng (tạm dừng = dừng
// đồng hồ), quay vòng, thanh điều khiển tự ẩn, nhạc nền + giọng đọc khách chọn, và XUẤT VIDEO
// (CXSlideExport) khi trang cha yêu cầu. ?embed=1 thì đợi trang /slide-cuoi/ gửi dữ liệu qua
// postMessage, mở thẳng thì dùng dữ liệu mẫu. Nạp CUỐI trang, sau index.js của mẫu.

(function () {
  const D = window.CX_SLIDE;
  if (!D || !window.CXSlideEngine) return;

  const E = window.CXSlideEngine;
  const W = D.w;
  const H = D.h;
  const EMBED = new URLSearchParams(location.search).get("embed") === "1" && window.parent !== window;
  const root = document.documentElement;
  const stage = document.getElementById("sl-stage");
  const backdrop = document.getElementById("sl-backdrop");
  const post = (msg) => EMBED && parent.postMessage(msg, location.origin);

  // ── Sân khấu: canvas đúng tỉ lệ mẫu, vừa khít cửa sổ, nét theo mật độ điểm ảnh ──
  root.classList.add("sl-root");
  const canvas = document.createElement("canvas");
  canvas.id = "sl-canvas";
  stage.appendChild(canvas);
  const ctx = canvas.getContext("2d", { alpha: false });
  function fit() {
    const s = Math.max(0.01, Math.min(innerWidth / W, innerHeight / H));
    stage.style.width = `${W * s}px`;
    stage.style.height = `${H * s}px`;
    // Trần 4K: màn hình to hơn cũng không vẽ nặng hơn mức xuất video.
    const px = Math.min(W * s * (devicePixelRatio || 1), 3840);
    canvas.width = Math.round(px);
    canvas.height = Math.round((px * H) / W);
    draw();
  }
  addEventListener("resize", fit);

  // ── Thanh điều khiển ──
  const ui = document.createElement("div");
  ui.id = "sl-ui";
  ui.innerHTML = `
    <div class="sl-segs"></div>
    <div class="sl-ctrl">
      <x-button variant="bare" icon-only class="sl-btn" data-sl="prev" aria-label="Cảnh trước" title="Cảnh trước (←)"><i data-lucide="skip-back"></i></x-button>
      <x-button variant="bare" icon-only class="sl-btn" data-sl="play" aria-label="Phát / tạm dừng" title="Phát / tạm dừng (phím cách)"><span class="sl-i-pause"><i data-lucide="pause"></i></span><span class="sl-i-play"><i data-lucide="play"></i></span></x-button>
      <x-button variant="bare" icon-only class="sl-btn" data-sl="next" aria-label="Cảnh sau" title="Cảnh sau (→)"><i data-lucide="skip-forward"></i></x-button>
      <x-button variant="bare" icon-only class="sl-btn sl-music" data-sl="music" aria-label="Bật / tắt nhạc" title="Bật / tắt nhạc (M)"><span class="sl-i-on"><i data-lucide="volume-2"></i></span><span class="sl-i-off"><i data-lucide="volume-x"></i></span></x-button>
      <x-button variant="bare" icon-only class="sl-btn sl-full" data-sl="full" aria-label="Toàn màn hình" title="Toàn màn hình (F)"><span class="sl-i-on"><i data-lucide="minimize"></i></span><span class="sl-i-off"><i data-lucide="maximize"></i></span></x-button>
    </div>`;
  document.body.appendChild(ui);
  window.lucide?.createIcons({ root: ui });
  // Chip gợi ý sửa ngay trên slide — chỉ hiện trong khung xem của trang /slide-cuoi/ (CSS theo
  // cờ .sl-can-edit), không bao giờ ở màn trình chiếu.
  const hint = document.createElement("div");
  hint.id = "sl-hint";
  hint.innerHTML = '<i data-lucide="mouse-pointer-click"></i><span>Bấm vào chữ hoặc ảnh để sửa</span>';
  document.body.appendChild(hint);
  window.lucide?.createIcons({ root: hint });

  // Uỷ quyền qua #sl-ui: <x-button> tự thay mình bằng <button> nên gắn thẳng là mất listener.
  ui.addEventListener("click", (e) => {
    const b = e.target.closest("[data-sl]");
    if (!b) return;
    e.stopPropagation();
    act(b.dataset.sl);
  });

  function act(k) {
    wake();
    if (k === "prev") show(idx - 1);
    else if (k === "next") show(idx + 1);
    else if (k === "play") playing ? pause() : play();
    else if (k === "music") Music.toggle();
    else if (k === "full") full();
  }

  // Hiện thanh khi có thao tác, đang chạy thì tự ẩn sau một nhịp.
  let wakeT = 0;
  function wake() {
    root.classList.add("sl-ui-on");
    clearTimeout(wakeT);
    wakeT = setTimeout(() => root.classList.remove("sl-ui-on"), 2600);
  }
  addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse") return;
    wake();
    pointer = toDesign(e);
  });
  document.documentElement.addEventListener("pointerleave", () => (pointer = null));
  // Chạm vào sân khấu: thanh đang ẩn thì hiện, đang hiện thì ẩn.
  addEventListener("pointerup", (e) => {
    if (ui.contains(e.target)) return;
    const h = canEdit() && P ? hit(toDesign(e)) : null;
    if (h) {
      wake();
      edit(h);
      return;
    }
    if (root.classList.contains("sl-ui-on")) {
      clearTimeout(wakeT);
      root.classList.remove("sl-ui-on");
    } else wake();
  });
  addEventListener("keydown", (e) => {
    // Esc chỉ phải tự lo khi trang cha phủ kín bằng CSS; toàn màn thật thì trình duyệt thoát.
    if (e.key === "Escape" && pseudoFull) return full();
    const k = { " ": "play", k: "play", ArrowRight: "next", PageDown: "next", ArrowLeft: "prev", PageUp: "prev", m: "music", f: "full" }[e.key];
    // Phím cách trên chính một nút đã thành cú bấm nút đó — đừng xử lý hai lần.
    if (!k || (e.key === " " && e.target.closest?.("button"))) return;
    e.preventDefault();
    act(k);
  });

  function sync() {
    root.classList.toggle("sl-paused", !playing);
    root.classList.toggle("sl-has-music", Music.has() || Voice.has());
    root.classList.toggle("sl-music-on", Music.isOn());
    root.classList.toggle("sl-can-full", CAN_FS || EMBED);
    root.classList.toggle("sl-is-full", !!fsEl() || pseudoFull);
    root.classList.toggle("sl-can-edit", canEdit());
  }

  // ── Đồng hồ + vẽ ──
  let P = null; // dự án đang chiếu (CXSlideEngine.build)
  let t = 0; // giây, đếm từ đầu slide
  let playing = true;
  let idx = -1;
  let last = 0;
  // Nhảy cảnh: khung cũ chụp lại rồi mờ dần đè lên cảnh mới (thay cho lớp cảnh-trước của engine).
  let snap = null;
  let snapAt = 0;
  let jumpIdx = -1;

  function local() {
    const tt = ((t % P.total) + P.total) % P.total;
    const i = E.indexAt(P, tt);
    return { i, lt: tt - P.starts[i] };
  }

  function draw() {
    if (!P) return;
    const { i, lt } = local();
    if (i !== jumpIdx) jumpIdx = -1;
    E.frame(ctx, P, t, { loop: true, noFade: i === jumpIdx });
    if (snap) {
      const p = (performance.now() - snapAt) / (P.fade * 1000);
      if (p >= 1) snap = null;
      else {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = 1 - p;
        ctx.drawImage(snap, 0, 0, canvas.width, canvas.height);
        ctx.globalAlpha = 1;
      }
    }
    drawEdit();
    if (i !== idx) {
      idx = i;
      bar();
      report();
    }
    const fill = ui.querySelector(".sl-segs")?.children[i]?.firstElementChild;
    if (fill) fill.style.transform = `scaleX(${Math.min(1, lt / P.scenes[i].dur)})`;
  }

  let sentAt = 0;
  function tick(now) {
    if (playing && P && !exporting) t += Math.min(0.25, (now - last) / 1000);
    last = now;
    draw();
    if (P) {
      const tt = ((t % P.total) + P.total) % P.total;
      Voice.tick(tt, playing && !exporting && Music.wanted());
      // Vị trí đang phát cho dòng thời gian của trang cha (~10 lần/giây).
      if (EMBED && now - sentAt > 100) {
        sentAt = now;
        post({ type: "cx-slide-time", t: tt, total: P.total, playing });
      }
    }
    requestAnimationFrame(tick);
  }

  // Tua tới giây `at` của slide (dòng thời gian ở trang cha).
  function seek(at, stop) {
    if (!P) return;
    if (stop) pause();
    t = Math.min(Math.max(0, Number(at) || 0), P.total - 0.01);
    snap = null;
    idx = -1;
    draw();
  }
  requestAnimationFrame((now) => {
    last = now;
    tick(now);
  });

  // Mốc trong cảnh i mà mọi chữ đã hiện đủ (cả đoạn đánh chữ) — đứng ở đó khi dừng để sửa chữ.
  const settled = (i) => P.starts[i] + Math.max(0, P.scenes[i].dur - 0.05);

  function show(i, rest) {
    if (!P) return;
    const n = P.scenes.length;
    i = ((i % n) + n) % n;
    snap = document.createElement("canvas");
    snap.width = canvas.width;
    snap.height = canvas.height;
    snap.getContext("2d").drawImage(canvas, 0, 0);
    snapAt = performance.now();
    jumpIdx = i;
    t = rest ? settled(i) : P.starts[i];
    idx = -1; // để draw() báo cảnh mới
    draw();
  }

  function pause() {
    if (!playing) return;
    playing = false;
    Music.pause();
    sync();
    report();
  }

  function play() {
    if (playing) return;
    playing = true;
    Music.play();
    sync();
    report();
  }

  function bar() {
    const segs = ui.querySelector(".sl-segs");
    if (segs.childElementCount !== P.scenes.length) segs.innerHTML = P.scenes.map(() => "<i><b></b></i>").join("");
    Array.from(segs.children).forEach((n, k) => {
      n.classList.toggle("is-done", k < idx);
      n.firstElementChild.style.transform = "";
    });
  }

  // Trang cha vẽ "thứ tự trình chiếu" từ đây: danh sách cảnh mỗi lần dựng lại, và cảnh đang
  // chiếu mỗi lần đổi cảnh / tạm dừng.
  function report(all) {
    if (!P) return;
    const msg = { type: "cx-slide-state", index: idx, playing };
    if (all) {
      msg.scenes = P.scenes.map((s, k) => ({
        id: s.id,
        label: s.label || `Cảnh ${k + 1}`,
        dur: Math.round(s.dur * 1000),
        // Khung thời lượng cho thanh kéo ở trang cha (ms): mặc định của mẫu, ngắn nhất, dài nhất.
        base: Math.round(s.base * 1000),
        min: Math.round(s.min * 1000),
        max: Math.round(s.max * 1000),
        texts: s.texts || [],
        // Ô ảnh của cảnh: mẫu khai `photos` (nhiều ô) hoặc `photo` (một ô).
        photos: s.photos || (s.photo ? [s.photo] : []),
      }));
      // Có nhạc nền không ("file" = có, ghép được vào video xuất).
      msg.music = Music.has() ? "file" : "";
    }
    post(msg);
  }

  // ── Sửa ngay trên slide ──
  // Chỉ trong khung xem của trang /slide-cuoi/ (EMBED), không khi trình chiếu toàn màn hay đang
  // xuất video: rê chuột lên chữ/ảnh của cảnh đang chiếu thì vẽ khung nét đứt + nhãn, bấm
  // (hoặc chạm) thì dừng ở cảnh đó với chữ đã hiện đủ và báo trang cha mở đúng ô sửa
  // (cx-slide-edit). Khung vẽ thẳng lên canvas xem trước, KHÔNG qua engine nên video xuất ra
  // không dính. Vùng sửa lấy từ phần tử chữ có `key` và ảnh có `edit` (mẫu khai).
  const EDIT_RGB = "225, 29, 72"; // hồng nhấn của trang Cưới Xinh (iframe không nạp bảng màu app)
  const EDIT_LABEL = { text: "Sửa chữ", photo: "Đổi ảnh" };
  // Kích thước khung/nhãn khai theo PIXEL MÀN HÌNH rồi nhân `u` (đơn vị mẫu / 1px CSS) lúc vẽ:
  // khung xem nhỏ cỡ nào nhãn cũng đọc được, nét viền cũng đều.
  const EDIT_PAD = 6;
  const unit = () => W / (canvas.getBoundingClientRect().width || W);
  let pointer = null; // vị trí chuột theo toạ độ mẫu; null = chuột ngoài khung
  let hover = null;
  let hintUntil = 0; // tới mốc này thì viền mọi vùng sửa được nhấp nháy (lần nạp đầu)
  let hinted = false;
  let picked = null; // vùng vừa bấm, sáng đậm thêm một nhịp

  function canEdit() {
    return EMBED && !fsEl() && !pseudoFull && !exporting;
  }

  function toDesign(e) {
    const r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  }

  // Vùng sửa được của cảnh đang chiếu — bỏ phần tử chưa tới lượt hiện.
  function editables() {
    const { i, lt } = local();
    const out = [];
    const walk = (el) => {
      if (el.anim && lt < (el.anim.d || 0)) return;
      if (el.kids) return el.kids.forEach(walk);
      if (el.type === "text" && el.key) out.push({ kind: "text", key: el.key, ...E.bounds(el) });
      else if (el.type === "image" && el.edit) out.push({ kind: "photo", key: el.edit, x: el.x, y: el.y, w: el.w, h: el.h });
    };
    P.scenes[i].els.forEach(walk);
    return out;
  }

  // Chữ ưu tiên hơn ảnh (chữ nhỏ, dễ trượt); trong cùng loại lấy vùng nhỏ nhất chứa điểm.
  function hit(pt) {
    if (!pt) return null;
    const p = EDIT_PAD * unit();
    const inside = (r) => pt.x >= r.x - p && pt.x <= r.x + r.w + p && pt.y >= r.y - p && pt.y <= r.y + r.h + p;
    const all = editables().filter(inside);
    const pick = (kind) =>
      all.filter((r) => r.kind === kind).sort((a, b) => a.w * a.h - b.w * b.h)[0] || null;
    return pick("text") || pick("photo");
  }

  function edit(h) {
    const i = local().i;
    show(i, true);
    pause();
    picked = { ...h, at: performance.now() };
    post({ type: "cx-slide-edit", index: i, kind: h.kind, key: h.key });
  }

  function _box(r, alpha, label, solid) {
    const u = unit();
    const pad = EDIT_PAD * u;
    const x = r.x - pad;
    const y = r.y - pad;
    const w = r.w + pad * 2;
    const h = r.h + pad * 2;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, 6 * u);
    else ctx.rect(x, y, w, h);
    ctx.fillStyle = `rgba(${EDIT_RGB}, ${solid ? 0.14 : 0.06})`;
    ctx.fill();
    ctx.setLineDash(solid ? [] : [6 * u, 4 * u]);
    ctx.lineWidth = 1.5 * u;
    ctx.strokeStyle = `rgba(${EDIT_RGB}, 0.9)`;
    ctx.stroke();
    if (label) {
      const text = `✎  ${EDIT_LABEL[r.kind]}`;
      ctx.setLineDash([]);
      ctx.font = `600 ${13 * u}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
      const tw = ctx.measureText(text).width;
      const pw = tw + 20 * u;
      const ph = 24 * u;
      const gap = 4 * u;
      // Nhãn đứng trên khung; sát mép trên thì xuống dưới, tràn phải thì dồn vào.
      const lx = Math.min(Math.max(gap, x), W - pw - gap);
      const ly = y - ph - gap >= gap ? y - ph - gap : Math.min(H - ph - gap, y + h + gap);
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(lx, ly, pw, ph, ph / 2);
      else ctx.rect(lx, ly, pw, ph);
      ctx.fillStyle = `rgb(${EDIT_RGB})`;
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.textBaseline = "middle";
      ctx.textAlign = "left";
      ctx.fillText(text, lx + 10 * u, ly + ph / 2 + u);
    }
    ctx.restore();
  }

  function drawEdit() {
    const on = canEdit() && P;
    hover = on ? hit(pointer) : null;
    canvas.style.cursor = hover ? "pointer" : "";
    if (!on) return;
    const now = performance.now();
    const k = canvas.width / W;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    if (now < hintUntil && !hover) {
      const a = 0.35 + 0.35 * Math.sin(((now % 1300) / 1300) * Math.PI * 2);
      editables().forEach((r) => _box(r, a, false, false));
    }
    if (picked && now - picked.at < 900) _box(picked, 1 - (now - picked.at) / 900, false, true);
    if (hover) _box(hover, 1, true, false);
  }

  // ── Giọng đọc: đoạn ghi âm khách tải lên ở tab Giọng đọc của trang cha. Mỗi đoạn đặt ở một mốc
  // của slide (start, giây), cắt đầu `in` + dài `len`, âm lượng `vol` (0..1), tắt `mute`; phát
  // KHỚP đồng hồ slide (lệch quá 0,35 giây thì tua lại) và nhạc nền hạ còn `duck` khi có giọng.
  // Bật/tắt tiếng dùng chung cờ của nhạc (nút loa, cú chạm đầu tiên).
  const Voice = (() => {
    let clips = [];
    const els = new Map(); // id → {url, el}
    let duck = 1;
    let level = 1;
    let quiet = false; // trang cha đang thu âm: im cả giọng lẫn nhạc cho micro khỏi thu lẫn
    const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
    const unit = (v) => Math.min(1, Math.max(0, n(v)));
    function set(list, d) {
      const keep = new Set();
      clips = (Array.isArray(list) ? list : [])
        .filter((v) => v?.id && v.blob instanceof Blob)
        .map((v) => {
          const id = String(v.id);
          keep.add(id);
          if (!els.has(id)) {
            const url = URL.createObjectURL(v.blob);
            const el = new Audio(url);
            el.preload = "auto";
            els.set(id, { url, el });
          }
          return { id, blob: v.blob, start: Math.max(0, n(v.start)), in: Math.max(0, n(v.in)), len: Math.max(0, n(v.len)), vol: unit(v.vol ?? 1), mute: !!v.mute };
        });
      els.forEach((x, id) => {
        if (keep.has(id)) return;
        x.el.pause();
        URL.revokeObjectURL(x.url);
        els.delete(id);
      });
      duck = d == null ? 1 : unit(d);
    }
    // tt = giây trong slide; run = đang phát và đang bật tiếng.
    function tick(tt, run) {
      let any = false;
      clips.forEach((c) => {
        const x = els.get(c.id);
        if (!x) return;
        if (run && !quiet && !c.mute && tt >= c.start && tt < c.start + c.len) {
          any = true;
          const want = c.in + (tt - c.start);
          if (!x.el.seeking && Math.abs(x.el.currentTime - want) > 0.35) {
            try {
              x.el.currentTime = want;
            } catch (e) {}
          }
          x.el.volume = c.vol;
          if (x.el.paused) x.el.play().catch(() => {});
        } else if (!x.el.paused) x.el.pause();
      });
      // Nhạc hạ / lên dần trong khoảng nửa giây.
      const target = quiet ? 0 : any ? duck : 1;
      level += (target - level) * 0.12;
      if (Math.abs(target - level) < 0.01) level = target;
      Music.level(level);
    }
    return {
      set,
      tick,
      quiet: (on) => (quiet = !!on),
      has: () => clips.some((c) => !c.mute),
      duck: () => duck,
      exportList: () => clips.map((c) => ({ blob: c.blob, start: c.start, in: c.in, len: c.len, vol: c.vol, mute: c.mute })),
    };
  })();

  // ── Nhạc nền: CHỈ nhạc khách chọn ở tab Nhạc (file từ máy hoặc bài thư viện) — không lấy nhạc
  // của thiệp (thường là YouTube, không ghép được vào video). Trình duyệt chặn tự phát tiếng nên
  // nhạc chỉ bật ở cú chạm/phím đầu tiên trong khung.
  const Music = (() => {
    let audio = null;
    let fileUrl = "";
    let fileBlob = null; // file nhạc khách tải lên (trang cha gửi Blob) — bộ xuất đọc thẳng
    let loaded = null; // khoá nguồn đang nạp: nạp lại đúng nguồn đó thì giữ nguyên, nhạc không chạy lại từ đầu
    let want = false;
    let touched = false;
    let vol = 1; // mức nhạc hiện tại (Voice hạ xuống khi có giọng đọc)

    function reset() {
      audio?.pause();
      if (fileBlob && fileUrl) URL.revokeObjectURL(fileUrl);
      audio = fileBlob = null;
      fileUrl = "";
    }

    // url: file nhạc thư viện; file = {id, blob} nhạc khách tải lên (thắng url). Rỗng = không nhạc.
    function load(url, file) {
      url = String(url || "").trim();
      const key = file?.blob ? `file:${file.id}` : url;
      if (key === loaded) return sync();
      loaded = key;
      reset();
      if (file?.blob) {
        fileBlob = file.blob;
        fileUrl = URL.createObjectURL(file.blob);
      } else if (url) fileUrl = url;
      if (fileUrl) {
        audio = new Audio(fileUrl);
        audio.loop = true;
        audio.preload = "auto";
        audio.volume = vol;
      }
      if (want) play();
      sync();
    }

    function play() {
      if (!want || !playing || exporting) return;
      audio?.play().catch(() => {});
    }

    function pause() {
      audio?.pause();
    }

    // Cú chạm đầu tiên (trừ chính nút nhạc — nút đó tự quyết) là lúc bật tiếng.
    function first(e) {
      if (touched || (!audio && !Voice.has())) return;
      if (e.target?.closest?.('[data-sl="music"]')) return;
      touched = true;
      want = true;
      play();
      sync();
    }
    addEventListener("pointerdown", first, true);
    addEventListener("keydown", first, true);

    return {
      load,
      play,
      pause,
      has: () => !!audio,
      isOn: () => (!!audio || Voice.has()) && want,
      wanted: () => want,
      // Bấm phát từ trang cha (dòng thời gian Giọng đọc) cũng là lúc bật tiếng.
      enable() {
        touched = true;
        want = true;
        play();
        sync();
      },
      level(v) {
        if (Math.abs(v - vol) < 0.005) return;
        vol = v;
        if (audio) audio.volume = vol;
      },
      // Nguồn cho bộ xuất: Blob nếu là file tải lên (CSP chặn fetch URL blob:), không thì URL.
      exportSrc: () => fileBlob || fileUrl,
      toggle() {
        touched = true;
        want = !want;
        want ? play() : pause();
        sync();
      },
    };
  })();

  // ── Toàn màn hình ──
  // Trong khung của trang /slide-cuoi/ thì nhờ trang cha phóng cả iframe (cú bấm ở đây
  // cũng kích hoạt trang cha); iPhone không có Fullscreen API → trang cha phủ kín bằng CSS.
  const fsEl = () => document.fullscreenElement || document.webkitFullscreenElement;
  const CAN_FS =
    !!(root.requestFullscreen || root.webkitRequestFullscreen) &&
    !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);
  let pseudoFull = false;

  function full() {
    if (EMBED) {
      post({ type: "cx-slide-full" });
      return;
    }
    if (!CAN_FS) return;
    if (fsEl()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    else {
      const r = (root.requestFullscreen || root.webkitRequestFullscreen).call(root);
      r?.catch?.(() => {});
    }
  }
  document.addEventListener("fullscreenchange", sync);
  document.addEventListener("webkitfullscreenchange", sync);

  // ── Xuất video ──
  // Trang cha gửi {type:"cx-slide-export", height: 1080|2160|"demo"}; tiến độ báo ngược bằng cx-slide-export-state
  // (run · done kèm Blob · error · cancel). Lúc xuất đồng hồ xem trước đứng, nhạc tắt.
  let exporting = null;

  async function exportVideo(height) {
    if (exporting || !P || !window.CXSlideExport) return;
    exporting = new AbortController();
    sync();
    const wasPlaying = playing;
    Music.pause();
    post({ type: "cx-slide-export-state", state: "run", p: 0 });
    // Lý do video thiếu tiếng: "codec" (máy không mã hoá được tiếng) · "decode" (không đọc được
    // file nhạc / giọng) · "music" (có giọng nhưng không đọc được file nhạc) · "voice" (có đoạn
    // giọng đọc hỏng bị bỏ) · "" (đủ tiếng, hoặc slide không có tiếng nào).
    let mute = "";
    try {
      const blob = await CXSlideExport.run(P, {
        height,
        audioUrl: Music.exportSrc(),
        voices: Voice.exportList(),
        duck: Voice.duck(),
        signal: exporting.signal,
        onProgress: (p) => post({ type: "cx-slide-export-state", state: "run", p }),
        onAudio: (a) => {
          if (!a.ok) mute = a.reason;
          else if (a.lost) mute = "voice";
          else if (Music.exportSrc() && !a.music) mute = "music";
        },
      });
      post({ type: "cx-slide-export-state", state: "done", blob, mute });
      if (!EMBED) _download(blob, height === "demo" ? "slide-cuoi-xem-thu.mp4" : `slide-cuoi-${height}p.mp4`);
    } catch (e) {
      post({
        type: "cx-slide-export-state",
        state: e.code === "ABORTED" ? "cancel" : "error",
        code: e.code || "",
        message: String(e.message || e),
      });
    } finally {
      exporting = null;
      sync();
      if (wasPlaying) Music.play();
    }
  }

  function _download(blob, name) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 60000);
  }

  // Khổ nào máy mã hoá được — trang cha khoá lựa chọn 4K khi máy không làm nổi.
  async function caps() {
    const X = window.CXSlideExport;
    const ok = X?.supported() ? await Promise.all([X.pickCodec(1080), X.pickCodec(2160), X.pickCodec("demo")]) : [];
    const audio = X?.audioCodec ? await X.audioCodec().catch(() => "") : "";
    post({ type: "cx-slide-caps", h1080: !!ok[0], h2160: !!ok[1], demo: !!ok[2], audio });
  }

  // ── Dữ liệu ──
  let gen = 0;

  let cur = null; // thiệp đang chiếu
  // Nhạc khách chọn ở tab Nhạc của trang cha: {id, blob} (file từ máy) · {url} (thư viện) ·
  // null = không có nhạc.
  let musicPick = null;
  function setMusic(m) {
    musicPick = m?.blob instanceof Blob && m.id ? { id: String(m.id), blob: m.blob } : m?.url ? { url: String(m.url) } : null;
  }
  function applyMusic() {
    if (musicPick?.blob) Music.load("", musicPick);
    else if (musicPick?.url) Music.load(musicPick.url);
    else Music.load("");
  }
  let texts = {}; // chữ người dùng sửa ở trang cha, theo khoá khối của mẫu
  let timing = {}; // thời lượng khách kéo ở trang cha: {scale, scenes: {id cảnh: giây}}

  // Đổi thời lượng: đặt lại mốc các cảnh, đứng nguyên ở cảnh đang chiếu (đang dừng thì ở trạng
  // thái chữ đã hiện đủ, đang chạy thì giữ vị trí trong cảnh).
  function setTiming(m) {
    timing = m && typeof m === "object" ? m : {};
    if (!P || exporting) return;
    const { i, lt } = local();
    E.retime(P, timing);
    t = playing ? P.starts[i] + Math.min(lt, P.scenes[i].dur - 0.05) : settled(i);
    idx = -1;
    draw();
    report(true);
  }
  let photos = {}; // id cảnh → {src: blob URL, focal} của ảnh khách tải lên ở trang cha
  const photoUrls = new Map(); // id ảnh (trang cha đặt) → blob URL, để khỏi tạo lại mỗi lần gửi

  // m = {id cảnh: {id, blob, focal}}. Blob qua postMessage là bản sao mới mỗi lần nên nhận ảnh theo
  // `id`; URL của ảnh không còn dùng thì nhả.
  function setPhotos(m) {
    const next = {};
    const keep = new Set();
    Object.entries(m && typeof m === "object" ? m : {}).forEach(([k, v]) => {
      if (!v?.id || !(v.blob instanceof Blob)) return;
      if (!photoUrls.has(v.id)) photoUrls.set(v.id, URL.createObjectURL(v.blob));
      const f = v.focal;
      const focal = Number.isFinite(f?.x) && Number.isFinite(f?.y) ? { x: f.x, y: f.y } : null;
      next[k] = { src: photoUrls.get(v.id), focal };
      keep.add(v.id);
    });
    photoUrls.forEach((url, id) => {
      if (keep.has(id)) return;
      URL.revokeObjectURL(url);
      photoUrls.delete(id);
    });
    photos = next;
  }

  // keep = cảnh nên đứng lại sau khi dựng (sửa chữ thì ở nguyên cảnh đang sửa, không chạy lại).
  async function load(w, keep) {
    const my = ++gen;
    cur = w || {};
    const proj = await E.build(D, cur, texts, photos, timing);
    if (my !== gen) return;
    P = proj;
    const k = Number.isInteger(keep) && keep >= 0 && keep < P.scenes.length ? keep : -1;
    t = k < 0 ? 0 : playing ? P.starts[k] : settled(k);
    idx = -1;
    snap = null;
    const bg = w.cover_image_url || (w.gallery_images || [])[0];
    backdrop.style.backgroundImage = bg ? `url(${JSON.stringify(getImageUrl(bg))})` : "";
    applyMusic();
    fit();
    report(true);
    sync();
    if (EMBED && !hinted) {
      hinted = true;
      hintUntil = performance.now() + 2600;
    }
  }

  async function demo() {
    const my = ++gen;
    // preview-data.js đọc ảnh/chữ mẫu theo tên mẫu THIỆP lấy từ URL — trang slide không
    // nằm dưới /public/themes/ nên khai thẳng tên đó (CX_SLIDE.demo).
    if (D.demo) window.currentThemeName = () => D.demo;
    const w = typeof cxPreviewWedding === "function" ? await cxPreviewWedding() : { is_active: true };
    if (my === gen) load(w);
  }

  addEventListener("message", (e) => {
    if (e.source !== window.parent || e.origin !== location.origin) return;
    const m = e.data || {};
    if (m.type === "cx-slide-data") {
      texts = m.texts && typeof m.texts === "object" ? m.texts : {};
      timing = m.timing && typeof m.timing === "object" ? m.timing : {};
      Voice.set(m.voice?.clips, m.voice?.duck);
      setPhotos(m.photos);
      setMusic(m.music);
      m.wedding ? load(m.wedding) : demo();
    } else if (m.type === "cx-slide-texts" && cur) {
      texts = m.texts && typeof m.texts === "object" ? m.texts : {};
      if (!exporting) load(cur, Number.isInteger(m.index) ? m.index : idx);
    } else if (m.type === "cx-slide-music") {
      if (exporting) return;
      setMusic(m.music);
      if (cur) {
        applyMusic();
        report(true);
      }
    } else if (m.type === "cx-slide-photos" && cur) {
      if (exporting) return;
      setPhotos(m.photos);
      load(cur, Number.isInteger(m.index) ? m.index : idx);
    } else if (m.type === "cx-slide-voice") {
      if (exporting) return;
      Voice.set(m.voice?.clips, m.voice?.duck);
      sync();
    } else if (m.type === "cx-slide-quiet") {
      Voice.quiet(m.on);
    } else if (m.type === "cx-slide-seek") {
      if (!exporting) seek(m.t, !!m.pause);
    } else if (m.type === "cx-slide-play") {
      if (exporting || !P) return;
      if (m.on) {
        Music.enable();
        play();
      } else pause();
    } else if (m.type === "cx-slide-timing") {
      setTiming(m.timing);
    } else if (m.type === "cx-slide-go" && Number.isInteger(m.index)) {
      show(m.index, !!m.pause);
      if (m.pause) pause();
    }
    else if (m.type === "cx-slide-export" && (m.height === 1080 || m.height === 2160 || m.height === "demo")) exportVideo(m.height);
    else if (m.type === "cx-slide-export-cancel") exporting?.abort();
    else if (m.type === "cx-slide-full-state") {
      pseudoFull = !!m.on;
      sync();
    }
  });

  fit();
  sync();
  if (EMBED) {
    post({ type: "cx-slide-ready" });
    caps();
  } else demo();
})();
