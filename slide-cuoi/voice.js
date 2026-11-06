// Tab "Giọng đọc" của /slide-cuoi/: tối đa 10 file ghi âm (≤ 50 MB), mỗi file một LỚP trên dòng
// thời gian của slide kiểu phần mềm dựng phim — kéo khối đổi lúc bắt đầu, kéo hai mép để cắt.
// Byte file cất IndexedDB (kho "voice"), vị trí/cắt/âm lượng cất localStorage — chỉ trên máy,
// theo mẫu + thiệp. Nạp SAU index.js (dùng chung _scDB, _scTxKey, _scCues, _scFrame…).

const _SC_VO_STORE = "voice";
const _SC_VO_META = "cx_slide_voice";
const _SC_VO_MAX = 10;
const _SC_VO_MB = 50;
const _SC_VO_DUCK = 0.3; // nhạc nền còn 30% khi có giọng (mặc định)
let _scVo = { key: null, clips: [], duck: _SC_VO_DUCK }; // clip: {id, name, dur, start, in, len, vol, mute, blob, peaks}
let _scVoSel = "";
// px mỗi giây của dòng thời gian: 0 = mặc định (vừa khung nhưng không dưới _SC_VO_PPS — slide
// vài phút ép vừa khung thì đoạn ghi âm vài giây chỉ còn một vạch), -1 = vừa khung, > 0 = đã phóng.
let _scVoPps = 0;
const _SC_VO_PPS = 10;
let _scVoT = { t: 0, total: 0, playing: false, at: 0 }; // vị trí khung báo lên (cx-slide-time)
let _scVoSendT = 0;
let _scVoSaveT = 0;
let _scVoRaf = 0;

const _scVoTotal = () => _scCues.reduce((n, c) => n + c.dur, 0) / 1000 || _scVoT.total || 0;
const _scVoFmt = (s) => {
  s = Math.max(0, Number(s) || 0);
  const m = Math.floor(s / 60);
  return `${m}:${(s - m * 60).toFixed(1).padStart(4, "0")}`;
};
const _scVoClip = (id) => _scVo.clips.find((c) => c.id === id) || null;
const _scVoNow = () => {
  const T = _scVoT;
  const t = T.playing ? T.t + (performance.now() - T.at) / 1000 : T.t;
  const total = _scVoTotal();
  return total ? Math.min(t, total) : t;
};
// Mốc bắt đầu của từng cảnh (giây) — chỗ khối giọng đọc "hút" vào khi kéo gần.
const _scVoSceneStarts = () => {
  let at = 0;
  return _scCues.map((c) => {
    const s = at;
    at += c.dur / 1000;
    return s;
  });
};

// ── Lưu / đọc ──
function _scVoMetaAll() {
  try {
    return JSON.parse(localStorage.getItem(_SC_VO_META) || "{}") || {};
  } catch (e) {
    return {};
  }
}
function _scVoSave() {
  clearTimeout(_scVoSaveT);
  const key = _scVo.key;
  const meta = {
    duck: _scVo.duck,
    clips: _scVo.clips.map((c) => ({ id: c.id, name: c.name, dur: c.dur, start: c.start, in: c.in, len: c.len, vol: c.vol, mute: c.mute })),
  };
  _scVoSaveT = setTimeout(() => {
    try {
      const all = _scVoMetaAll();
      if (meta.clips.length || meta.duck !== _SC_VO_DUCK) all[key] = meta;
      else delete all[key];
      localStorage.setItem(_SC_VO_META, JSON.stringify(all));
    } catch (e) {}
  }, 250);
}

// Đọc lớp giọng của bộ dữ liệu đang chiếu (chỉ đọc lại khi đổi mẫu / thiệp). Lớp nào mất byte
// (trình duyệt dọn bộ nhớ) thì bỏ.
async function _scVoLoad() {
  const key = _scTxKey();
  if (_scVo.key === key) return;
  _scVo = { key, clips: [], duck: _SC_VO_DUCK };
  _scVoSel = "";
  const meta = _scVoMetaAll()[key] || {};
  if (Number.isFinite(meta.duck)) _scVo.duck = Math.min(1, Math.max(0, meta.duck));
  const list = Array.isArray(meta.clips) ? meta.clips : [];
  if (!list.length) return;
  let recs = [];
  try {
    const prefix = key + "|";
    recs = await _scDbDo("readonly", (st) => st.getAll(IDBKeyRange.bound(prefix, prefix + "￿")), _SC_VO_STORE);
  } catch (e) {
    console.warn("Không đọc được giọng đọc đã lưu:", e);
  }
  if (_scVo.key !== key) return;
  const byId = new Map((recs || []).map((r) => [r.id, r]));
  _scVo.clips = list
    .map((m) => {
      const r = byId.get(m.id);
      if (!r?.buf?.byteLength) return null;
      return { ...m, blob: new Blob([r.buf], { type: r.type || "audio/mpeg" }), peaks: r.peaks || null };
    })
    .filter(Boolean)
    .slice(0, _SC_VO_MAX);
}

function _scVoMsg() {
  return {
    duck: _scVo.duck,
    clips: _scVo.clips.map((c) => ({ id: c.id, blob: c.blob, start: c.start, in: c.in, len: c.len, vol: c.vol, mute: c.mute })),
  };
}
function _scVoSend() {
  clearTimeout(_scVoSendT);
  _scVoSendT = setTimeout(
    () => _scFrame.contentWindow?.postMessage({ type: "cx-slide-voice", voice: _scVoMsg() }, location.origin),
    60,
  );
}
function _scVoBusy() {
  if (_scExState !== "run") return false;
  window.showToast?.("Đang xuất video, đợi xong rồi hãy chỉnh giọng đọc", "warning");
  return true;
}
const _scVoSeek = (t, pause) =>
  _scFrame.contentWindow?.postMessage({ type: "cx-slide-seek", t, pause: !!pause }, location.origin);

// ── Thêm file ──
async function _scVoDecode(buf) {
  const AC = window.AudioContext || window.webkitAudioContext;
  const ac = new AC();
  try {
    return await new Promise((res, rej) => ac.decodeAudioData(buf, res, rej)?.then?.(res, rej));
  } finally {
    ac.close?.();
  }
}
// Đỉnh sóng âm 25 mẫu/giây (0–255) để vẽ dạng sóng trên khối — tính một lần lúc thêm file.
function _scVoPeaks(b) {
  const n = Math.max(1, Math.min(8000, Math.ceil(b.duration * 25)));
  const out = new Uint8Array(n);
  const chs = [0, 1].filter((k) => k < b.numberOfChannels).map((k) => b.getChannelData(k));
  const per = chs[0].length / n;
  for (let i = 0; i < n; i++) {
    const from = Math.floor(i * per);
    const to = Math.floor((i + 1) * per);
    const step = Math.max(1, Math.floor((to - from) / 96));
    let m = 0;
    for (let j = from; j < to; j += step) for (const ch of chs) m = Math.max(m, Math.abs(ch[j]));
    out[i] = Math.min(255, Math.round(m * 255));
  }
  return out;
}
// Lớp mới đặt ở đầu cảnh đang mở ở tab Cảnh, không có thì ở chỗ đầu phát.
function _scVoStartAt() {
  const total = _scVoTotal();
  const at = _scOpen >= 0 ? _scVoSceneStarts()[_scOpen] || 0 : _scVoNow();
  return Math.max(0, Math.min(at, Math.max(0, total - 0.5)));
}

function scVoicePick() {
  if (_scVoBusy()) return;
  if (_scVo.clips.length >= _SC_VO_MAX) {
    window.showToast?.(`Đã đủ ${_SC_VO_MAX} lớp giọng đọc. Xoá bớt một lớp để thêm file khác.`, "warning");
    return;
  }
  const input = _scEl("sc-vo-file");
  input.value = "";
  input.click();
}

_scEl("sc-vo-file")?.addEventListener("change", async (e) => {
  const files = Array.from(e.target.files || []);
  e.target.value = "";
  if (!files.length) return;
  const key = _scVo.key || _scTxKey();
  const room = _SC_VO_MAX - _scVo.clips.length;
  if (files.length > room) window.showToast?.(`Chỉ thêm được ${room} file nữa (tối đa ${_SC_VO_MAX} lớp).`, "warning");
  let added = null;
  let at = _scVoStartAt(); // nhiều file một lần thì xếp nối đuôi nhau
  window.showLoading?.(true, "Đang đọc file ghi âm...");
  try {
    for (const f of files.slice(0, Math.max(0, room))) {
      if (f.size > _SC_VO_MB * 1024 * 1024) {
        window.showToast?.(`"${f.name}" nặng hơn ${_SC_VO_MB} MB, bạn nén lại hoặc cắt ngắn rồi chọn lại nhé.`, "error");
        continue;
      }
      let buf;
      let dec;
      try {
        buf = await f.arrayBuffer();
        dec = await _scVoDecode(buf.slice(0));
      } catch (err) {
        window.showToast?.(`Không đọc được "${f.name}". Hãy dùng file MP3, M4A hoặc WAV.`, "error");
        continue;
      }
      if (_scVo.key !== key) return;
      const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
      const peaks = _scVoPeaks(dec);
      const type = f.type || "audio/mpeg";
      try {
        await _scDbDo("readwrite", (st) => st.put({ id, buf, type, peaks }, `${key}|${id}`), _SC_VO_STORE);
      } catch (err) {
        console.warn("Không lưu được giọng đọc:", err);
        window.showToast?.("Máy không cho lưu file ghi âm (bộ nhớ trình duyệt đầy hoặc đang ẩn danh), tải lại trang là mất lớp này.", "warning");
      }
      if (_scVo.key !== key) return;
      added = {
        id,
        name: f.name.replace(/\.[^.]+$/, "") || "Giọng đọc",
        dur: dec.duration,
        start: at,
        in: 0,
        len: dec.duration,
        vol: 1,
        mute: false,
        blob: new Blob([buf], { type }),
        peaks,
      };
      _scVo.clips.push(added);
      at = Math.min(at + dec.duration + 0.5, Math.max(0, _scVoTotal() - 0.5));
    }
  } finally {
    window.showLoading?.(false);
  }
  if (!added) return;
  _scVoSel = added.id;
  _scVoSave();
  _scVoSend();
  _scVoRender();
});

async function scVoiceRemove(id) {
  if (_scVoBusy()) return;
  const key = _scVo.key;
  try {
    await _scDbDo("readwrite", (st) => st.delete(`${key}|${id}`), _SC_VO_STORE);
  } catch (e) {}
  if (_scVo.key !== key) return;
  _scVo.clips = _scVo.clips.filter((c) => c.id !== id);
  if (_scVoSel === id) _scVoSel = "";
  _scVoSave();
  _scVoSend();
  _scVoRender();
}

// Đổi một lớp rồi lưu + gửi khung; full = vẽ lại cả dòng thời gian (bật/tắt tiếng đổi hình lớp).
function _scVoSet(id, patch, full) {
  const c = _scVoClip(id);
  if (!c || _scVoBusy()) return;
  Object.assign(c, patch);
  _scVoSave();
  _scVoSend();
  if (full) _scVoRender();
  else {
    _scVoPlace(c);
    _scVoInspect();
  }
}

// ── Dòng thời gian ──
const _SC_VO_STEPS = [0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300];
const _scVoFit = (box, total) => (total > 0 ? Math.max(0.5, (box.clientWidth - _scVoHead(box) - 24) / total) : 8);
const _scVoHead = (box) => parseFloat(getComputedStyle(box).getPropertyValue("--vo-head")) || 96;
function _scVoPx() {
  const fit = _scVoFit(_scEl("sc-vo-tl"), _scVoTotal());
  return _scVoPps > 0 ? _scVoPps : _scVoPps < 0 ? fit : Math.max(fit, _SC_VO_PPS);
}

function _scVoRender() {
  const box = _scEl("sc-vo-tl");
  if (!box || _scEl("sc-tab-voice")?.classList.contains("hidden")) return;
  const total = _scVoTotal();
  const pps = _scVoPx();
  const W = Math.max(box.clientWidth - _scVoHead(box), Math.ceil(total * pps) + 24);
  const step = _SC_VO_STEPS.find((s) => s * pps >= 64) || 600;
  let ticks = "";
  for (let s = 0; s <= total + 1e-6; s += step)
    ticks += `<span class="sc-vo-tick" style="left:${(s * pps).toFixed(1)}px">${_scVoFmt(s).replace(/\.0$/, "")}</span>`;
  const starts = _scVoSceneStarts();
  const segs = _scCues
    .map(
      (c, i) =>
        `<span class="sc-vo-seg${i % 2 ? " is-alt" : ""}" style="left:${(starts[i] * pps).toFixed(1)}px;width:${((c.dur / 1000) * pps).toFixed(1)}px" title="${_scEsc(c.label)}">${_scEsc(c.label)}</span>`,
    )
    .join("");
  const music = _scMusic || (_scMu.pick ? "file" : _scCardMusic);
  const mus = music
    ? `<span class="sc-vo-mbar" style="width:${(total * pps).toFixed(1)}px">${music === "yt" ? "Nhạc YouTube" : "Nhạc nền"}</span>`
    : `<span class="sc-vo-note">Chưa có nhạc nền</span>`;
  const rows = _scVo.clips.length
    ? _scVo.clips
        .map(
          (c, k) => `<div class="sc-vo-row is-voice">
            <div class="sc-vo-head${c.mute ? " is-mute" : ""}">
              <span class="sc-vo-n">${k + 1}</span>
              <span class="sc-vo-name" title="${_scEsc(c.name)}">${_scEsc(c.name)}</span>
              <button type="button" class="sc-vo-mute" data-vo-mute="${c.id}" aria-pressed="${c.mute}" aria-label="${c.mute ? "Bật tiếng" : "Tắt tiếng"} lớp ${k + 1}" title="${c.mute ? "Bật tiếng" : "Tắt tiếng"}">${_scIco(c.mute ? "volume-x" : "volume-2")}</button>
            </div>
            <div class="sc-vo-lane">
              <div class="sc-vo-clip${c.id === _scVoSel ? " is-sel" : ""}${c.mute ? " is-mute" : ""}" data-clip="${c.id}" tabindex="0" role="button" aria-label="Lớp ${k + 1}: ${_scEsc(c.name)}, bắt đầu ${_scVoFmt(c.start)}">
                <canvas aria-hidden="true"></canvas>
                <span class="sc-vo-cname">${_scEsc(c.name)}</span>
                <span class="sc-vo-edge is-l" data-edge="l" aria-hidden="true"></span>
                <span class="sc-vo-edge is-r" data-edge="r" aria-hidden="true"></span>
              </div>
            </div>
          </div>`,
        )
        .join("")
    : `<div class="sc-vo-row is-voice"><div class="sc-vo-head"><span class="sc-vo-n">1</span><span class="sc-vo-name">Giọng đọc</span></div>
        <div class="sc-vo-lane"><span class="sc-vo-note">Chưa có file ghi âm. Bấm "Thêm file ghi âm" bên dưới.</span></div></div>`;
  box.innerHTML = `<div class="sc-vo-in" style="--vo-w:${W}px">
      <div class="sc-vo-row is-ruler"><div class="sc-vo-head"></div><div class="sc-vo-lane" data-scrub>${ticks}</div></div>
      <div class="sc-vo-row is-scenes"><div class="sc-vo-head"><span class="sc-vo-name">Cảnh</span></div><div class="sc-vo-lane" data-scrub>${segs}</div></div>
      <div class="sc-vo-row is-music"><div class="sc-vo-head"><span class="sc-vo-name">Nhạc</span></div><div class="sc-vo-lane">${mus}</div></div>
      ${rows}
      <div class="sc-vo-ph" aria-hidden="true"><i></i></div>
    </div>`;
  window.lucide?.createIcons({ root: box });
  _scVo.clips.forEach((c) => _scVoPlace(c));
  _scEl("sc-vo-total").textContent = `/ ${_scVoFmt(total)}`;
  const full = _scVo.clips.length >= _SC_VO_MAX;
  _scEl("sc-vo-up").disabled = full;
  _scEl("sc-vo-up-d").textContent = full
    ? `Đã đủ ${_SC_VO_MAX} lớp. Xoá bớt một lớp để thêm file khác.`
    : `MP3, M4A hoặc WAV, mỗi file tối đa ${_SC_VO_MB} MB. Còn thêm được ${_SC_VO_MAX - _scVo.clips.length} lớp.`;
  const duck = _scEl("sc-vo-duck");
  duck.value = String(Math.round(_scVo.duck * 100));
  _scRangeFill(duck);
  _scEl("sc-vo-duck-v").textContent = `${Math.round(_scVo.duck * 100)}%`;
  _scVoInspect();
  _scVoLoop();
}

// Đặt khối theo start/len (px) và vẽ dạng sóng của đoạn đang dùng.
function _scVoPlace(c) {
  const el = _scEl("sc-vo-tl")?.querySelector(`[data-clip="${CSS.escape(c.id)}"]`);
  if (!el) return;
  const pps = _scVoPx();
  const w = Math.max(6, c.len * pps);
  el.style.left = `${(c.start * pps).toFixed(1)}px`;
  el.style.width = `${w.toFixed(1)}px`;
  // Khối hẹp: bỏ tay nắm hai mép để cả khối là chỗ kéo dời.
  el.classList.toggle("is-narrow", w < 40);
  el.setAttribute("aria-label", `${c.name}, bắt đầu ${_scVoFmt(c.start)}, dài ${_scVoFmt(c.len)}`);
  const cv = el.querySelector("canvas");
  const P = c.peaks;
  if (!cv || !P?.length) return;
  const dpr = Math.min(2, devicePixelRatio || 1);
  const cw = Math.min(4096, Math.round(w * dpr));
  const ch = Math.round(28 * dpr);
  cv.width = cw;
  cv.height = ch;
  const x = cv.getContext("2d");
  x.clearRect(0, 0, cw, ch);
  x.fillStyle = "rgba(255,255,255,0.85)";
  const bar = Math.max(1, Math.round(dpr * 1.5));
  for (let i = 0; i < cw; i += bar + 1) {
    const t = c.in + (i / cw) * c.len;
    const a = P[Math.min(P.length - 1, Math.floor((t / c.dur) * P.length))] / 255;
    const h = Math.max(1, a * ch);
    x.fillRect(i, (ch - h) / 2, bar, h);
  }
}

// Bảng của lớp đang chọn: lúc bắt đầu (nhích ±0,1 giây / đặt tại đầu phát) · âm lượng · đoạn
// dùng của file · nghe thử · tắt tiếng · xoá.
function _scVoInspect() {
  const box = _scEl("sc-vo-sel");
  if (!box) return;
  const c = _scVoClip(_scVoSel);
  _scToggle("sc-vo-sel", !!c);
  if (!c) return (box.innerHTML = "");
  const k = _scVo.clips.indexOf(c);
  const cut = c.in > 0.05 || c.in + c.len < c.dur - 0.05;
  const sig = `${c.id}|${c.mute}|${cut}`;
  if (box.dataset.sig !== sig) {
    box.dataset.sig = sig;
    box.innerHTML = `
      <div class="sc-vo-sel-head">
        <span class="sc-vo-n">${k + 1}</span>
        <p class="sc-vo-sel-name" title="${_scEsc(c.name)}">${_scEsc(c.name)}</p>
        <button type="button" class="sc-vo-x" data-vo-close aria-label="Bỏ chọn lớp" title="Bỏ chọn">${_scIco("x")}</button>
      </div>
      <div class="sc-vo-field">
        <span class="sc-vo-lab">Bắt đầu lúc</span>
        <div class="sc-vo-step">
          <button type="button" data-vo-nudge="-0.1" aria-label="Sớm hơn 0,1 giây">${_scIco("minus")}</button>
          <output class="sc-vo-start"></output>
          <button type="button" data-vo-nudge="0.1" aria-label="Muộn hơn 0,1 giây">${_scIco("plus")}</button>
        </div>
        <button type="button" class="sc-ph-act" data-vo-here>${_scIco("map-pin")}Đặt tại đầu phát</button>
      </div>
      <div class="sc-vo-field is-vol">
        <label class="sc-vo-lab" for="sc-vo-vol">Âm lượng</label>
        <output class="sc-vo-vol-v" for="sc-vo-vol"></output>
        <input id="sc-vo-vol" type="range" class="sc-range" data-vo-vol min="0" max="100" step="1" />
      </div>
      <p class="sc-vo-cut"></p>
      <div class="sc-vo-acts">
        <button type="button" class="sc-ph-act" data-vo-listen>${_scIco("play")}Nghe thử</button>
        ${cut ? `<button type="button" class="sc-ph-act" data-vo-uncut>${_scIco("unfold-horizontal")}Bỏ cắt</button>` : ""}
        <button type="button" class="sc-ph-act" data-vo-mute="${c.id}">${_scIco(c.mute ? "volume-2" : "volume-x")}${c.mute ? "Bật tiếng" : "Tắt tiếng"}</button>
        <button type="button" class="sc-ph-act is-danger" data-vo-del>${_scIco("trash-2")}Xoá lớp</button>
      </div>`;
    window.lucide?.createIcons({ root: box });
  }
  box.querySelector(".sc-vo-start").textContent = _scVoFmt(c.start);
  const vol = box.querySelector("[data-vo-vol]");
  if (document.activeElement !== vol) vol.value = String(Math.round(c.vol * 100));
  _scRangeFill(vol);
  box.querySelector(".sc-vo-vol-v").textContent = `${Math.round(c.vol * 100)}%`;
  box.querySelector(".sc-vo-cut").textContent =
    `Dùng đoạn ${_scVoFmt(c.in)} – ${_scVoFmt(c.in + c.len)} của file (file dài ${_scVoFmt(c.dur)}).`;
}

function _scVoSelect(id) {
  _scVoSel = id;
  _scEl("sc-vo-tl")
    ?.querySelectorAll("[data-clip]")
    .forEach((el) => el.classList.toggle("is-sel", el.dataset.clip === id));
  _scVoInspect();
}

// Hút về mốc gần (đầu cảnh, đầu phát, mép lớp khác) trong vòng 8px.
function _scVoSnap(t, self) {
  const pps = _scVoPx();
  const marks = [0, _scVoTotal(), _scVoNow(), ..._scVoSceneStarts()];
  _scVo.clips.forEach((c) => c.id !== self && marks.push(c.start, c.start + c.len));
  let best = t;
  let gap = 8 / pps;
  marks.forEach((m) => {
    if (Math.abs(m - t) < gap) {
      gap = Math.abs(m - t);
      best = m;
    }
  });
  return best;
}

// ── Đầu phát ──
function _scVoTime(m) {
  _scVoT = { t: Number(m.t) || 0, total: Number(m.total) || 0, playing: !!m.playing, at: performance.now() };
  _scEl("sc-vo-bar")?.classList.toggle("is-playing", _scVoT.playing);
}
function _scVoLoop() {
  if (_scVoRaf) return;
  const step = () => {
    const box = _scEl("sc-vo-tl");
    if (!box || _scEl("sc-tab-voice")?.classList.contains("hidden")) {
      _scVoRaf = 0;
      return;
    }
    const t = _scVoNow();
    const pps = _scVoPx();
    const ph = box.querySelector(".sc-vo-ph");
    if (ph) ph.style.transform = `translateX(${(t * pps).toFixed(1)}px)`;
    const now = _scEl("sc-vo-now");
    if (now) now.textContent = _scVoFmt(t);
    // Đang phát mà đầu phát ra khỏi khung nhìn thì cuộn theo.
    if (_scVoT.playing && !_scVoDrag) {
      const x = t * pps;
      const vis = box.clientWidth - _scVoHead(box);
      if (x < box.scrollLeft || x > box.scrollLeft + vis - 24) box.scrollLeft = Math.max(0, x - vis * 0.2);
    }
    _scVoRaf = requestAnimationFrame(step);
  };
  _scVoRaf = requestAnimationFrame(step);
}

// ── Thao tác trên dòng thời gian: kéo khối / mép khối, kéo thước để tua ──
let _scVoDrag = null;
_scEl("sc-vo-tl")?.addEventListener("pointerdown", (e) => {
  const box = e.currentTarget;
  const clipEl = e.target.closest("[data-clip]");
  if (clipEl) {
    if (e.button > 0 || _scVoBusy()) return;
    const c = _scVoClip(clipEl.dataset.clip);
    if (!c) return;
    _scVoSelect(c.id);
    e.preventDefault();
    clipEl.setPointerCapture(e.pointerId);
    const edge = e.target.closest("[data-edge]")?.dataset.edge || "";
    _scVoDrag = { c, edge, x0: e.clientX, s0: { start: c.start, in: c.in, len: c.len }, moved: false };
    clipEl.classList.add("is-drag");
    return;
  }
  const lane = e.target.closest("[data-scrub]");
  if (!lane || e.button > 0) return;
  e.preventDefault();
  const at = (ev) => Math.max(0, Math.min(_scVoTotal(), (ev.clientX - lane.getBoundingClientRect().left) / _scVoPx()));
  const go = (ev) => {
    const t = at(ev);
    _scVoT = { ..._scVoT, t, playing: false, at: performance.now() };
    _scVoSeek(t, true);
  };
  go(e);
  lane.setPointerCapture(e.pointerId);
  const move = (ev) => go(ev);
  const up = () => {
    lane.removeEventListener("pointermove", move);
    lane.removeEventListener("pointerup", up);
    lane.removeEventListener("pointercancel", up);
  };
  lane.addEventListener("pointermove", move);
  lane.addEventListener("pointerup", up);
  lane.addEventListener("pointercancel", up);
  void box;
});

_scEl("sc-vo-tl")?.addEventListener("pointermove", (e) => {
  const D = _scVoDrag;
  if (!D) return;
  const dx = e.clientX - D.x0;
  if (Math.abs(dx) > 2) D.moved = true;
  if (!D.moved) return;
  const c = D.c;
  const dt = dx / _scVoPx();
  const total = _scVoTotal();
  const MIN = 0.2;
  if (D.edge === "l") {
    // Mép trái: lùi/tiến điểm vào của file, mép phải đứng yên.
    let s = _scVoSnap(D.s0.start + dt, c.id);
    let d = s - D.s0.start;
    d = Math.max(d, -D.s0.in, -D.s0.start);
    d = Math.min(d, D.s0.len - MIN);
    Object.assign(c, { start: D.s0.start + d, in: D.s0.in + d, len: D.s0.len - d });
  } else if (D.edge === "r") {
    const end = _scVoSnap(D.s0.start + D.s0.len + dt, c.id);
    c.len = Math.max(MIN, Math.min(end - D.s0.start, c.dur - c.in));
  } else {
    let s = D.s0.start + dt;
    const a = _scVoSnap(s, c.id);
    const b = _scVoSnap(s + c.len, c.id) - c.len;
    s = Math.abs(a - s) <= Math.abs(b - s) ? a : b;
    c.start = Math.max(0, Math.min(s, Math.max(0, total - MIN)));
  }
  _scVoPlace(c);
  _scVoInspect();
  _scVoSend();
});

const _scVoEnd = () => {
  const D = _scVoDrag;
  if (!D) return;
  _scVoDrag = null;
  _scEl("sc-vo-tl")?.querySelector(".is-drag")?.classList.remove("is-drag");
  if (D.moved) _scVoSave();
};
_scEl("sc-vo-tl")?.addEventListener("pointerup", _scVoEnd);
_scEl("sc-vo-tl")?.addEventListener("pointercancel", _scVoEnd);

// Phím trên khối đang chọn: ← → nhích 0,1 giây (Shift: 1 giây).
_scEl("sc-vo-tl")?.addEventListener("keydown", (e) => {
  const el = e.target.closest("[data-clip]");
  const d = { ArrowLeft: -1, ArrowRight: 1 }[e.key];
  if (!el || !d) return;
  e.preventDefault();
  const c = _scVoClip(el.dataset.clip);
  if (!c) return;
  _scVoSelect(c.id);
  _scVoSet(c.id, { start: Math.max(0, Math.min(c.start + d * (e.shiftKey ? 1 : 0.1), _scVoTotal() - 0.2)) });
});

// Nút trong dòng thời gian (tắt tiếng lớp) và trong bảng lớp đang chọn.
function _scVoClick(e) {
  const mute = e.target.closest("[data-vo-mute]");
  if (mute) {
    const c = _scVoClip(mute.dataset.voMute);
    if (c) _scVoSet(c.id, { mute: !c.mute }, true);
    return;
  }
  const c = _scVoClip(_scVoSel);
  if (!c) return;
  if (e.target.closest("[data-vo-close]")) _scVoSelect("");
  else if (e.target.closest("[data-vo-nudge]")) {
    const d = Number(e.target.closest("[data-vo-nudge]").dataset.voNudge);
    _scVoSet(c.id, { start: Math.max(0, Math.min(c.start + d, _scVoTotal() - 0.2)) });
  } else if (e.target.closest("[data-vo-here]")) _scVoSet(c.id, { start: Math.min(_scVoNow(), Math.max(0, _scVoTotal() - 0.2)) });
  else if (e.target.closest("[data-vo-uncut]")) _scVoSet(c.id, { start: Math.max(0, c.start - c.in), in: 0, len: c.dur }, true);
  else if (e.target.closest("[data-vo-listen]")) {
    _scVoSeek(c.start, false);
    _scFrame.contentWindow?.postMessage({ type: "cx-slide-play", on: true }, location.origin);
  } else if (e.target.closest("[data-vo-del]")) scVoiceRemove(c.id);
}
_scEl("sc-vo-tl")?.addEventListener("click", _scVoClick);
_scEl("sc-vo-sel")?.addEventListener("click", _scVoClick);
_scEl("sc-vo-sel")?.addEventListener("input", (e) => {
  const r = e.target.closest("[data-vo-vol]");
  const c = _scVoClip(_scVoSel);
  if (!r || !c) return;
  _scVoSet(c.id, { vol: Number(r.value) / 100 });
});

_scEl("sc-vo-duck")?.addEventListener("input", (e) => {
  if (_scVoBusy()) return;
  _scVo.duck = Number(e.target.value) / 100;
  _scRangeFill(e.target);
  _scEl("sc-vo-duck-v").textContent = `${e.target.value}%`;
  _scVoSave();
  _scVoSend();
});

_scEl("sc-vo-play")?.addEventListener("click", () =>
  _scFrame.contentWindow?.postMessage({ type: "cx-slide-play", on: !_scVoT.playing }, location.origin),
);

// Phóng to / thu nhỏ quanh đầu phát; "vừa khung" về 0.
function scVoiceZoom(k) {
  const box = _scEl("sc-vo-tl");
  if (!box) return;
  const total = _scVoTotal();
  const fit = _scVoFit(box, total);
  const cur = _scVoPx();
  _scVoPps = k === 0 ? -1 : Math.min(240, Math.max(fit, cur * k));
  const t = _scVoNow();
  _scVoRender();
  box.scrollLeft = Math.max(0, t * _scVoPx() - (box.clientWidth - _scVoHead(box)) / 2);
}

// Gọi từ index.js: danh sách cảnh / thời lượng đổi, hay vừa mở tab.
function _scVoOnCues() {
  if (!_scVoDrag) _scVoRender();
}
addEventListener("resize", () => {
  clearTimeout(_scVoRender._t);
  _scVoRender._t = setTimeout(_scVoRender, 150);
});
