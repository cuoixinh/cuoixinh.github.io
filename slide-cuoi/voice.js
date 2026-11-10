// Âm thanh của slide (/slide-cuoi/): dữ liệu các TRACK giọng đọc + nạp / lưu / gửi khung, thêm file,
// thu âm. Mỗi clip trỏ tới một NGUỒN (`src` = file đã cất) — tách / nhân bản tạo clip mới cùng nguồn nên
// không nhân đôi byte. Byte cất IndexedDB (kho "voice", khoá `<bộ dữ liệu>|<src>`), track + clip cất
// localStorage — chỉ trên máy, theo mẫu + thiệp. Vẽ + thao tác dòng thời gian ở timeline.js (nạp SAU
// file này). Nạp SAU index.js (dùng chung _scDB, _scTxKey, _scCues, _scFrame…).

const _SC_VO_STORE = "voice";
const _SC_VO_META = "cx_slide_voice";
const _SC_VO_MAX = 10; // số FILE (nguồn) tối đa
const _SC_VO_CLIPS = 60; // số clip tối đa — tách / nhân bản không tốn thêm byte
const _SC_VO_TRACKS = 10;
const _SC_VO_MB = 50;
const _SC_VO_DUCK = 0.3; // nhạc nền còn 30% khi có giọng (mặc định)
// track: {id, name, mute, solo, lock, vol} · clip: {id, src, track, name, dur, start, in, len, vol, fi,
// fo, env: [{t: giây trong file, g: 0..1}]} · srcs: src → {blob, peaks} · mtr: track Nhạc nền.
const _scVoMtr = () => ({ mute: false, solo: false, lock: false, vol: 1 });
let _scVo = { key: null, clips: [], tracks: [], srcs: new Map(), duck: _SC_VO_DUCK, mtr: _scVoMtr() };
const _SC_VO_MU = "@music"; // id khối Nhạc nền trên dòng thời gian (không trùng id clip nào)
// px mỗi giây của dòng thời gian: 0 = mặc định (vừa khung nhưng không dưới _SC_VO_PPS — slide
// vài phút ép vừa khung thì đoạn ghi âm vài giây chỉ còn một vạch), -1 = vừa khung, > 0 = đã phóng.
let _scVoPps = 0;
const _SC_VO_PPS = 10;
let _scVoT = { t: 0, total: 0, playing: false, at: 0 }; // vị trí khung báo lên (cx-slide-time)
let _scVoSendT = 0;
let _scVoSaveT = 0;

const _scVoId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
const _scVoTotal = () => _scCues.reduce((n, c) => n + c.dur, 0) / 1000 || _scVoT.total || 0;
const _scVoFmt = (s) => {
  s = Math.max(0, Number(s) || 0);
  const m = Math.floor(s / 60);
  return `${m}:${(s - m * 60).toFixed(1).padStart(4, "0")}`;
};
const _scVoClip = (id) => (id === _SC_VO_MU ? _scVoMuClip() : _scVo.clips.find((c) => c.id === id) || null);
const _scVoTrack = (id) => _scVo.tracks.find((t) => t.id === id) || null;
const _scVoPeaksOf = (c) => (c.id === _SC_VO_MU ? null : _scVo.srcs.get(c.src)?.peaks || null);
// Số file đang dùng (nhiều clip chung một nguồn chỉ tính một).
const _scVoSrcCount = () => new Set(_scVo.clips.map((c) => c.src)).size;
// Có track nào đang Solo thì chỉ nghe các track Solo (kể cả track Nhạc nền).
const _scVoSoloOn = () => _scVo.mtr.solo || _scVo.tracks.some((t) => t.solo);
const _scVoHeard = (t) => !!t && !t.mute && (!_scVoSoloOn() || t.solo);
// Mức nhạc nền gửi khung (index.js _scMuMsg): mức track, 0 khi track đang tắt / bị solo che.
const _scVoMuVol = () => (_scVoHeard(_scVo.mtr) ? _scVo.mtr.vol : 0);

// Track mới đặt tên "Giọng n" với n chưa dùng; `at` = vị trí chèn (mặc định cuối).
function _scVoTrackAdd(at) {
  if (_scVo.tracks.length >= _SC_VO_TRACKS) return null;
  const used = new Set(_scVo.tracks.map((t) => t.name));
  let n = 1;
  while (used.has(`Giọng ${n}`)) n++;
  const t = { id: `t${_scVoId()}`, name: `Giọng ${n}`, mute: false, solo: false, lock: false, vol: 1 };
  _scVo.tracks.splice(at == null ? _scVo.tracks.length : at, 0, t);
  return t;
}

// Khối Nhạc nền dưới dạng một clip (cùng bộ kéo dời/cắt): chính object đoạn nhạc của index.js
// (_scMuCut), thêm id · tên · dur vô hạn (bài lặp nên mép phải không chạm đáy bài).
function _scVoMuClip() {
  const c = _scMuCut();
  const mi = c && _scMuInfo();
  if (!mi) return null;
  const total = _scVoTotal();
  if (c.full && !_scTlDragging(c)) c.len = Math.max(0.2, total - c.start);
  if (!Array.isArray(c.env)) c.env = [];
  return Object.assign(c, { id: _SC_VO_MU, name: mi.name, dur: Infinity });
}
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
const _scVoEnvCopy = (env) => (Array.isArray(env) ? env.map((p) => ({ t: p.t, g: p.g })) : []);
// Phần lưu được của clip (không có byte) — dùng cho cả localStorage lẫn lịch sử hoàn tác.
const _scVoClipMeta = (c) => ({
  id: c.id, src: c.src, track: c.track, name: c.name, dur: c.dur, start: c.start, in: c.in, len: c.len,
  vol: c.vol ?? 1, fi: c.fi || 0, fo: c.fo || 0, env: _scVoEnvCopy(c.env),
});
const _scVoMtrIsDef = (m) => !m.mute && !m.solo && !m.lock && m.vol === 1;
function _scVoSave() {
  _scMuCutSave();
  // Đọc kho hỏng (_scVoLoad) thì đừng ghi: ghi bản rỗng là mất danh sách clip của lần sau đọc được.
  if (_scVo.broken) return;
  clearTimeout(_scVoSaveT);
  const key = _scVo.key;
  const meta = {
    duck: _scVo.duck,
    tracks: _scVo.tracks.map((t) => ({ ...t })),
    mtr: { ..._scVo.mtr },
    clips: _scVo.clips.map(_scVoClipMeta),
  };
  _scVoSaveT = setTimeout(() => {
    try {
      const all = _scVoMetaAll();
      if (meta.clips.length || meta.tracks.length || meta.duck !== _SC_VO_DUCK || !_scVoMtrIsDef(meta.mtr)) all[key] = meta;
      else delete all[key];
      localStorage.setItem(_SC_VO_META, JSON.stringify(all));
    } catch (e) {}
  }, 250);
}

// Đọc track + clip của bộ dữ liệu đang chiếu (chỉ đọc lại khi đổi mẫu / thiệp). Clip nào mất byte
// (trình duyệt dọn bộ nhớ) thì bỏ. Dữ liệu cũ (mỗi file một lớp, chưa có track) đọc thành mỗi clip
// một track, giữ đúng chỗ + tắt tiếng như trước. Byte không còn clip nào trỏ tới thì dọn ở đây —
// trong phiên vẫn giữ để hoàn tác lại được.
async function _scVoLoad() {
  const key = _scTxKey();
  if (_scVo.key === key) return;
  if (typeof _scVoRec !== "undefined" && _scVoRec) _scVoRecStop();
  _scVo = { key, clips: [], tracks: [], srcs: new Map(), duck: _SC_VO_DUCK, mtr: _scVoMtr() };
  if (typeof _scTlReset === "function") _scTlReset();
  const meta = _scVoMetaAll()[key] || {};
  if (Number.isFinite(meta.duck)) _scVo.duck = Math.min(1, Math.max(0, meta.duck));
  if (meta.mtr && typeof meta.mtr === "object") {
    const m = meta.mtr;
    Object.assign(_scVo.mtr, { mute: !!m.mute, solo: !!m.solo, lock: !!m.lock, vol: Number.isFinite(m.vol) ? Math.min(1, Math.max(0, m.vol)) : 1 });
  }
  const list = Array.isArray(meta.clips) ? meta.clips : [];
  let recs = [];
  try {
    const prefix = key + "|";
    recs = await _scDbDo("readonly", (st) => st.getAll(IDBKeyRange.bound(prefix, prefix + "￿")), _SC_VO_STORE);
  } catch (e) {
    console.warn("Không đọc được giọng đọc đã lưu:", e);
    if (_scVo.key === key) _scVo.broken = list.length > 0; // đừng dọn nhầm byte, đừng ghi đè danh sách
    return;
  }
  if (_scVo.key !== key) return;
  (recs || []).forEach((r) => {
    if (r?.buf?.byteLength) _scVo.srcs.set(r.id, { blob: new Blob([r.buf], { type: r.type || "audio/mpeg" }), peaks: r.peaks || null });
  });
  _scVo.tracks = (Array.isArray(meta.tracks) ? meta.tracks : [])
    .filter((t) => t?.id)
    .slice(0, _SC_VO_TRACKS)
    .map((t) => ({ id: String(t.id), name: String(t.name || "Giọng"), mute: !!t.mute, solo: !!t.solo, lock: !!t.lock, vol: Number.isFinite(t.vol) ? Math.min(1, Math.max(0, t.vol)) : 1 }));
  _scVo.clips = list
    .map((m) => {
      const src = String(m.src || m.id || "");
      if (!_scVo.srcs.has(src)) return null;
      const c = _scVoClipMeta({ ...m, src });
      c.env = c.env.filter((p) => Number.isFinite(p.t) && Number.isFinite(p.g));
      if (!_scVoTrack(c.track)) {
        // Bản cũ: mỗi clip một track, tắt tiếng chuyển từ clip sang track.
        const t = _scVoTrackAdd();
        if (!t) return null;
        if (m.mute) t.mute = true;
        c.track = t.id;
      }
      return c;
    })
    .filter(Boolean)
    .slice(0, _SC_VO_CLIPS);
  const used = new Set(_scVo.clips.map((c) => c.src));
  [..._scVo.srcs.keys()]
    .filter((id) => !used.has(id))
    .forEach((id) => {
      _scVo.srcs.delete(id);
      _scDbDo("readwrite", (st) => st.delete(`${key}|${id}`), _SC_VO_STORE).catch(() => {});
    });
}

// Gửi khung: mức + tắt tiếng đã tính theo track (tắt / solo / âm lượng track).
function _scVoMsg() {
  return {
    duck: _scVo.duck,
    clips: _scVo.clips.map((c) => {
      const t = _scVoTrack(c.track);
      return {
        id: c.id, blob: _scVo.srcs.get(c.src)?.blob, start: c.start, in: c.in, len: c.len,
        vol: Math.min(1, (c.vol ?? 1) * (t?.vol ?? 1)), fi: c.fi || 0, fo: c.fo || 0, env: c.env || [], mute: !_scVoHeard(t),
      };
    }),
  };
}
// Gửi cả đoạn nhạc nền: khối nhạc kéo trên cùng dòng thời gian, đi chung đường lưu/gửi với giọng đọc.
function _scVoSend() {
  clearTimeout(_scVoSendT);
  _scVoSendT = setTimeout(() => {
    _scFrame.contentWindow?.postMessage({ type: "cx-slide-voice", voice: _scVoMsg() }, location.origin);
    const cut = _scMuMsg()?.cut;
    if (cut) _scFrame.contentWindow?.postMessage({ type: "cx-slide-music-cut", cut }, location.origin);
  }, 60);
}
function _scVoBusy() {
  if (_scExState !== "run") return false;
  window.showToast?.("Đang xuất video, đợi xong rồi hãy chỉnh âm thanh", "warning");
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
// Clip mới đặt ở đầu cảnh đang mở ở tab Cảnh, không có thì ở chỗ đầu phát.
function _scVoStartAt() {
  const total = _scVoTotal();
  const at = _scOpen >= 0 ? _scVoSceneStarts()[_scOpen] || 0 : _scVoNow();
  return Math.max(0, Math.min(at, Math.max(0, total - 0.5)));
}
// Còn chỗ cho thêm n file / clip không (báo lý do khi hết).
function _scVoRoom(n = 1) {
  if (_scVoSrcCount() + n > _SC_VO_MAX) {
    window.showToast?.(`Đã đủ ${_SC_VO_MAX} file âm thanh. Xoá bớt clip để thêm file khác.`, "warning");
    return false;
  }
  if (_scVo.clips.length + n > _SC_VO_CLIPS) {
    window.showToast?.(`Dòng thời gian đã có ${_SC_VO_CLIPS} clip, xoá bớt rồi thêm tiếp nhé.`, "warning");
    return false;
  }
  return true;
}

// Chọn file: `at` = mốc (giây) đặt clip (bấm thẳng vào làn) — bỏ trống thì theo _scVoStartAt; `track`
// = id track nhận file (bỏ trống = track mới).
let _scVoPickAt = null;
let _scVoPickTrack = "";
function scVoicePick(at, track) {
  if (_scVoBusy() || _scVoRec) return;
  _scVoPickAt = Number.isFinite(at) ? at : null;
  _scVoPickTrack = track && _scVoTrack(track) ? track : "";
  if (!_scVoRoom()) return;
  const input = _scEl("sc-vo-file");
  input.value = "";
  input.click();
}

// Cất byte + đỉnh sóng âm của một bản ghi (file tải lên hoặc thu thẳng) thành một NGUỒN rồi dựng clip:
// `replace` = id clip đã có (thay file — giữ chỗ bắt đầu, âm lượng), không thì clip mới ở `start`
// (CHƯA có track — _scTlPlaceNew xếp sau). Trả clip, null khi không đọc được / đã đổi mẫu hay thiệp.
async function _scVoPut(key, buf, type, name, start, replace) {
  let dec;
  try {
    dec = await _scVoDecode(buf.slice(0));
  } catch (err) {
    return null;
  }
  if (_scVo.key !== key) return null;
  const src = _scVoId();
  const peaks = _scVoPeaks(dec);
  try {
    await _scDbDo("readwrite", (st) => st.put({ id: src, buf, type, peaks }, `${key}|${src}`), _SC_VO_STORE);
  } catch (err) {
    console.warn("Không lưu được giọng đọc:", err);
    window.showToast?.("Máy không cho lưu file ghi âm (bộ nhớ trình duyệt đầy hoặc đang ẩn danh), tải lại trang là mất clip này.", "warning");
  }
  if (_scVo.key !== key) return null;
  _scVo.srcs.set(src, { blob: new Blob([buf], { type }), peaks });
  const audio = { src, dur: dec.duration, in: 0, len: dec.duration, env: [] };
  const old = replace ? _scVoClip(replace) : null;
  if (old) return Object.assign(old, audio);
  const clip = { id: _scVoId(), name, start, track: "", vol: 1, fi: 0, fo: 0, ...audio };
  _scVo.clips.push(clip);
  return clip;
}

_scEl("sc-vo-file")?.addEventListener("change", async (e) => {
  const files = Array.from(e.target.files || []);
  e.target.value = "";
  const rep = _scVoReplace;
  _scVoReplace = "";
  if (!files.length) return;
  const key = _scVo.key || _scTxKey();
  if (rep) return _scVoReplaceFile(key, rep, files[0]);
  const room = Math.min(_SC_VO_MAX - _scVoSrcCount(), _SC_VO_CLIPS - _scVo.clips.length);
  if (files.length > room) window.showToast?.(`Chỉ thêm được ${room} file nữa.`, "warning");
  let at = _scVoPickAt != null ? Math.max(0, Math.min(_scVoPickAt, Math.max(0, _scVoTotal() - 0.5))) : _scVoStartAt();
  const want = _scVoPickTrack;
  _scVoPickAt = null;
  _scVoPickTrack = "";
  const added = [];
  window.showLoading?.(true, "Đang đọc file âm thanh...");
  _scTlBegin();
  try {
    for (const f of files.slice(0, Math.max(0, room))) {
      if (f.size > _SC_VO_MB * 1024 * 1024) {
        window.showToast?.(`"${f.name}" nặng hơn ${_SC_VO_MB} MB, bạn nén lại hoặc cắt ngắn rồi chọn lại nhé.`, "error");
        continue;
      }
      const name = f.name.replace(/\.[^.]+$/, "") || "Giọng đọc";
      const clip = await _scVoPut(key, await f.arrayBuffer(), f.type || "audio/mpeg", name, at);
      if (_scVo.key !== key) return;
      if (!clip) {
        window.showToast?.(`Không đọc được "${f.name}". Hãy dùng file MP3, M4A hoặc WAV.`, "error");
        continue;
      }
      added.push(clip);
      // Nhiều file một lần thì xếp nối đuôi nhau trên cùng một track.
      at += clip.len;
    }
    if (added.length) _scTlPlaceNew(added, want);
  } finally {
    window.showLoading?.(false);
    _scTlEnd("Thêm âm thanh");
  }
  if (!added.length) return;
  _scTlSelectOnly(added.map((c) => c.id));
  _scVoSave();
  _scVoSend();
  _scVoRender();
});

// Thay file của một clip đã có: giữ chỗ bắt đầu + âm lượng, tên theo file mới.
async function _scVoReplaceFile(key, id, f) {
  if (f.size > _SC_VO_MB * 1024 * 1024) {
    window.showToast?.(`"${f.name}" nặng hơn ${_SC_VO_MB} MB, bạn nén lại hoặc cắt ngắn rồi chọn lại nhé.`, "error");
    return;
  }
  const old = _scVoClip(id);
  if (!old) return;
  window.showLoading?.(true, "Đang đọc file âm thanh...");
  _scTlBegin();
  let clip = null;
  try {
    clip = await _scVoPut(key, await f.arrayBuffer(), f.type || "audio/mpeg", old.name, old.start, id);
    if (clip) {
      clip.name = f.name.replace(/\.[^.]+$/, "") || clip.name;
      _scTlFit(clip);
    }
  } finally {
    window.showLoading?.(false);
    _scTlEnd("Thay file");
  }
  if (_scVo.key !== key) return;
  if (!clip) {
    window.showToast?.(`Không đọc được "${f.name}". Hãy dùng file MP3, M4A hoặc WAV.`, "error");
    return;
  }
  _scTlSelectOnly([clip.id]);
  _scVoSave();
  _scVoSend();
  _scVoRender();
}

// ── Thu âm ──
// Nút micro ở đầu mỗi track (thu một clip mới trên track đó, từ đầu phát), ở hàng "Track mới" (thu
// vào track mới) và "Thu lại" trên thanh của clip (thay clip đó, giữ chỗ bắt đầu). Đếm ngược 3 giây
// rồi slide chạy từ đúng mốc đó để cô dâu đọc theo chữ trên slide; trong lúc thu slide TẮT TIẾNG
// (cx-slide-quiet) cho micro khỏi thu lẫn nhạc. Bấm lại nút (hoặc slide chạy hết) là dừng. Bản thu
// đi chung đường với file tải lên (_scVoPut).
const _SC_VO_REC_MAX = 10 * 60; // giây
let _scVoRec = null; // {key, id, track, start, stream, rec, chunks, mime, phase: "count"|"rec", n, timer}
const _scVoQuiet = (on) => _scFrame.contentWindow?.postMessage({ type: "cx-slide-quiet", on }, location.origin);

// `id` = clip thu lại; `track` = track nhận clip mới ("" = track mới).
async function scVoiceRecord(id, track) {
  if (_scVoRec) return _scVoRecStop();
  if (_scVoBusy()) return;
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder !== "function") {
    window.showToast?.("Trình duyệt này không thu âm được. Hãy thu bằng điện thoại rồi tải file lên.", "error");
    return;
  }
  const c = id ? _scVoClip(id) : null;
  if (!_scVoRoom()) return;
  const tk = c ? _scVoTrack(c.track) : track ? _scVoTrack(track) : null;
  if (tk?.lock) return window.showToast?.("Track đang khoá, mở khoá rồi hãy thu.", "warning");
  if (c && !(await window.showConfirm?.("Thu lại clip này?", "Bản ghi đang có của clip sẽ được thay bằng bản thu mới (Ctrl+Z để lấy lại).", { confirmText: "Thu lại" }) ?? true)) return;
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
  } catch (e) {
    window.showToast?.("Chưa dùng được micro. Hãy cho phép trang này dùng micro trong cài đặt trình duyệt rồi thử lại.", "error");
    return;
  }
  const mime = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm", "audio/ogg;codecs=opus"].find((t) => MediaRecorder.isTypeSupported?.(t)) || "";
  const start = c ? c.start : tk ? Math.max(0, Math.min(_scVoNow(), Math.max(0, _scVoTotal() - 0.5))) : _scVoStartAt();
  _scVoRec = { key: _scVo.key, id: c?.id || "", track: c ? c.track : tk?.id || "", start, stream, rec: null, chunks: [], mime, phase: "count", n: 3, timer: 0 };
  _scVoQuiet(true);
  _scVoSeek(start, true);
  _scVoT = { ..._scVoT, t: start, playing: false, at: performance.now() };
  _scVoRender();
  const tick = () => {
    const R = _scVoRec;
    if (!R || R.phase !== "count") return;
    if (R.n > 0) {
      _scVoRecLabel();
      R.n--;
      R.timer = setTimeout(tick, 1000);
      return;
    }
    _scVoRecBegin();
  };
  tick();
}

function _scVoRecBegin() {
  const R = _scVoRec;
  let rec;
  try {
    rec = new MediaRecorder(R.stream, R.mime ? { mimeType: R.mime } : undefined);
  } catch (e) {
    window.showToast?.("Không bắt đầu thu được. Bạn thử lại hoặc tải file ghi âm lên nhé.", "error");
    return _scVoRecEnd();
  }
  R.rec = rec;
  R.phase = "rec";
  rec.ondataavailable = (e) => e.data?.size && R.chunks.push(e.data);
  rec.onstop = () => _scVoRecDone(R);
  rec.start(250);
  R.at = performance.now();
  // Slide chạy từ đúng mốc bắt đầu cùng lúc với micro.
  _scVoSeek(R.start, false);
  _scFrame.contentWindow?.postMessage({ type: "cx-slide-play", on: true }, location.origin);
  R.timer = setTimeout(() => _scVoRecStop(), _SC_VO_REC_MAX * 1000);
  _scVoRender();
}

function _scVoRecStop() {
  const R = _scVoRec;
  if (!R) return;
  clearTimeout(R.timer);
  if (R.phase === "rec" && R.rec?.state === "recording") R.rec.stop();
  else _scVoRecEnd();
}

// Trả micro, bật lại tiếng slide, dừng slide.
function _scVoRecEnd() {
  const R = _scVoRec;
  if (!R) return;
  clearTimeout(R.timer);
  R.stream.getTracks().forEach((t) => t.stop());
  _scVoRec = null;
  _scVoQuiet(false);
  _scFrame.contentWindow?.postMessage({ type: "cx-slide-play", on: false }, location.origin);
  _scVoRender();
}

async function _scVoRecDone(R) {
  _scVoRecEnd();
  const type = R.mime || R.chunks[0]?.type || "audio/webm";
  const blob = new Blob(R.chunks, { type });
  if (blob.size < 1000 || R.key !== _scVo.key) return;
  window.showLoading?.(true, "Đang lưu bản thu...");
  _scTlBegin();
  let clip = null;
  try {
    clip = await _scVoPut(R.key, await blob.arrayBuffer(), type, `Thu âm ${_scVo.clips.length + 1}`, R.start, R.id);
    if (clip && R.id) _scTlFit(clip);
    else if (clip) _scTlPlaceNew([clip], R.track);
  } finally {
    window.showLoading?.(false);
    _scTlEnd(R.id ? "Thu lại" : "Thu âm");
  }
  if (!clip) {
    if (R.key === _scVo.key) window.showToast?.("Không đọc được bản thu, bạn thử thu lại nhé.", "error");
    return;
  }
  _scTlSelectOnly([clip.id]);
  _scVoSave();
  _scVoSend();
  _scVoRender();
}

function _scVoRecLabel() {
  const el = _scEl("sc-vo-rec");
  const R = _scVoRec;
  _scEl("sc-vo-bar")?.classList.toggle("is-rec", !!R);
  if (!el) return;
  el.classList.toggle("hidden", !R);
  if (!R) return;
  el.textContent =
    R.phase === "count" ? `Bắt đầu thu sau ${R.n} giây` : `Đang thu ${_scVoFmt((performance.now() - R.at) / 1000)}. Bấm nút dừng để kết thúc.`;
}

// "Thay thế" trên thanh của clip: chọn file mới cho đúng clip đó (_scVoReplaceFile).
let _scVoReplace = "";
function scVoiceReplace(id) {
  if (_scVoBusy() || _scVoRec) return;
  _scVoReplace = id;
  const input = _scEl("sc-vo-file");
  input.value = "";
  input.click();
}
