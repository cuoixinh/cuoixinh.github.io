// Dòng thời gian của tab "Âm thanh" (/slide-cuoi/): làn Nhạc nền (chọn ở index.js) + tối đa 10 file ghi âm (≤ 50 MB), mỗi file một LỚP trên dòng
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
const _SC_VO_MU = "@music"; // _scVoSel khi đang chọn khối Nhạc nền (không trùng id lớp nào)
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
const _scVoClip = (id) => (id === _SC_VO_MU ? _scVoMuClip() : _scVo.clips.find((c) => c.id === id) || null);
// Khối Nhạc nền dưới dạng một lớp (cùng bộ kéo dời/cắt): chính object đoạn nhạc của index.js
// (_scMuCut), thêm id · tên · dur vô hạn (bài lặp nên mép phải không chạm đáy bài).
function _scVoMuClip() {
  const c = _scMuCut();
  const mi = c && _scMuInfo();
  if (!mi) return null;
  const total = _scVoTotal();
  if (c.full && _scVoDrag?.c !== c) c.len = Math.max(0.2, total - c.start);
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
function _scVoSave() {
  _scMuCutSave();
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
  if (typeof _scVoRec !== "undefined" && _scVoRec) _scVoRecStop();
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
// Gửi cả đoạn nhạc nền: khối nhạc kéo trên cùng dòng thời gian, đi chung đường lưu/gửi với lớp giọng.
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

// `at` = mốc (giây) đặt lớp mới — bấm thẳng vào làn "Lớp mới"; bỏ trống thì theo _scVoStartAt.
let _scVoPickAt = null;
function scVoicePick(at) {
  if (_scVoBusy() || _scVoRec) return;
  _scVoPickAt = Number.isFinite(at) ? at : null;
  if (_scVo.clips.length >= _SC_VO_MAX) {
    window.showToast?.(`Đã đủ ${_SC_VO_MAX} lớp giọng đọc. Xoá bớt một lớp để thêm file khác.`, "warning");
    return;
  }
  const input = _scEl("sc-vo-file");
  input.value = "";
  input.click();
}

// Cất byte + đỉnh sóng âm của một bản ghi (file tải lên hoặc thu thẳng) rồi đưa vào lớp:
// `replace` = id lớp đã có (thu lại — giữ chỗ bắt đầu, âm lượng), không thì thêm lớp mới ở `start`.
// Trả lớp vừa đổi, null khi không đọc được / đã đổi sang mẫu hay thiệp khác.
async function _scVoPut(key, buf, type, name, start, replace) {
  let dec;
  try {
    dec = await _scVoDecode(buf.slice(0));
  } catch (err) {
    return null;
  }
  if (_scVo.key !== key) return null;
  const old = replace ? _scVoClip(replace) : null;
  const id = old ? old.id : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const peaks = _scVoPeaks(dec);
  try {
    await _scDbDo("readwrite", (st) => st.put({ id, buf, type, peaks }, `${key}|${id}`), _SC_VO_STORE);
  } catch (err) {
    console.warn("Không lưu được giọng đọc:", err);
    window.showToast?.("Máy không cho lưu file ghi âm (bộ nhớ trình duyệt đầy hoặc đang ẩn danh), tải lại trang là mất lớp này.", "warning");
  }
  if (_scVo.key !== key) return null;
  const audio = { dur: dec.duration, in: 0, len: dec.duration, blob: new Blob([buf], { type }), peaks };
  if (old) return Object.assign(old, audio);
  const clip = { id, name, start, vol: 1, mute: false, ...audio };
  _scVo.clips.push(clip);
  return clip;
}

_scEl("sc-vo-file")?.addEventListener("change", async (e) => {
  const files = Array.from(e.target.files || []);
  e.target.value = "";
  if (!files.length) return;
  const key = _scVo.key || _scTxKey();
  const room = _SC_VO_MAX - _scVo.clips.length;
  if (files.length > room) window.showToast?.(`Chỉ thêm được ${room} file nữa (tối đa ${_SC_VO_MAX} lớp).`, "warning");
  let added = null;
  // Nhiều file một lần thì xếp nối đuôi nhau.
  let at = _scVoPickAt != null ? Math.max(0, Math.min(_scVoPickAt, Math.max(0, _scVoTotal() - 0.5))) : _scVoStartAt();
  _scVoPickAt = null;
  window.showLoading?.(true, "Đang đọc file ghi âm...");
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
      added = clip;
      at = Math.min(at + clip.dur + 0.5, Math.max(0, _scVoTotal() - 0.5));
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

// ── Thu âm thẳng vào một lớp ──
// Nút micro ở đầu mỗi lớp (thu lại lớp đó, giữ chỗ bắt đầu) và ở hàng "Lớp mới" (thu từ đầu cảnh
// đang mở / đầu phát). Đếm ngược 3 giây rồi slide chạy từ đúng mốc đó để cô dâu đọc theo chữ trên
// slide; trong lúc thu slide TẮT TIẾNG (cx-slide-quiet) cho micro khỏi thu lẫn nhạc. Bấm lại nút
// (hoặc slide chạy hết) là dừng. Bản thu đi chung đường với file tải lên (_scVoPut).
const _SC_VO_REC_MAX = 10 * 60; // giây
let _scVoRec = null; // {key, id, start, stream, rec, chunks, mime, phase: "count"|"rec", n, timer}
const _scVoQuiet = (on) => _scFrame.contentWindow?.postMessage({ type: "cx-slide-quiet", on }, location.origin);

async function scVoiceRecord(id) {
  if (_scVoRec) return _scVoRecStop();
  if (_scVoBusy()) return;
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder !== "function") {
    window.showToast?.("Trình duyệt này không thu âm được. Hãy thu bằng điện thoại rồi tải file lên.", "error");
    return;
  }
  const c = id ? _scVoClip(id) : null;
  if (!c && _scVo.clips.length >= _SC_VO_MAX) {
    window.showToast?.(`Đã đủ ${_SC_VO_MAX} lớp giọng đọc. Xoá bớt một lớp để thu thêm.`, "warning");
    return;
  }
  if (c && !(await window.showConfirm?.("Thu lại lớp này?", "Bản ghi đang có của lớp sẽ được thay bằng bản thu mới.", { confirmText: "Thu lại" }) ?? true)) return;
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
  } catch (e) {
    window.showToast?.("Chưa dùng được micro. Hãy cho phép trang này dùng micro trong cài đặt trình duyệt rồi thử lại.", "error");
    return;
  }
  const mime = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm", "audio/ogg;codecs=opus"].find((t) => MediaRecorder.isTypeSupported?.(t)) || "";
  const start = c ? c.start : _scVoStartAt();
  _scVoRec = { key: _scVo.key, id: c?.id || "", start, stream, rec: null, chunks: [], mime, phase: "count", n: 3, timer: 0 };
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
  let clip = null;
  try {
    const n = _scVo.clips.length + 1;
    clip = await _scVoPut(R.key, await blob.arrayBuffer(), type, `Thu âm ${n}`, R.start, R.id);
  } finally {
    window.showLoading?.(false);
  }
  if (!clip) {
    if (R.key === _scVo.key) window.showToast?.("Không đọc được bản thu, bạn thử thu lại nhé.", "error");
    return;
  }
  _scVoSel = clip.id;
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

async function scVoiceRemove(id) {
  if (_scVoBusy() || _scVoRec) return;
  const ok = await (window.showConfirm?.("Xoá lớp giọng đọc này?", "Bản ghi của lớp sẽ bị xoá khỏi máy, không lấy lại được.", { confirmText: "Xoá lớp", type: "error" }) ?? true);
  if (!ok) return;
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
  if (!box || _scEl("sc-tab-audio")?.classList.contains("hidden")) return;
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
  // Làn Nhạc nền dựng như một lớp giọng đọc: đầu làn icon · tên · thư viện · chọn file; khối nhạc
  // kéo dời / cắt hai mép y như khối giọng (_scVoMuClip); làn trống bấm = chọn file.
  const mi = _scVoMuClip();
  const music = `<div class="sc-vo-row is-voice is-music">
      <div class="sc-vo-head">
        <span class="sc-vo-n is-music" aria-hidden="true">${_scIco("music")}</span>
        <span class="sc-vo-name">Nhạc nền</span>
        <button type="button" class="sc-vo-mute" data-mu-lib aria-label="Chọn nhạc trong thư viện" title="Thư viện nhạc">${_scIco("list-music")}</button>
        <button type="button" class="sc-vo-mute" data-mu-add aria-label="${mi ? "Đổi" : "Chọn"} file nhạc nền" title="${mi ? "Đổi" : "Chọn"} file nhạc">${_scIco("upload")}</button>
      </div>
      ${
        mi
          ? `<div class="sc-vo-lane" data-lane>
              <div class="sc-vo-clip is-music${_scVoSel === _SC_VO_MU ? " is-sel" : ""}" data-clip="${_SC_VO_MU}" tabindex="0" role="button" aria-label="Nhạc nền: ${_scEsc(mi.name)}">
                <span class="sc-vo-cname">${_scEsc(mi.name)}</span>
                <span class="sc-vo-edge is-l" data-edge="l" aria-hidden="true"></span>
                <span class="sc-vo-edge is-r" data-edge="r" aria-hidden="true"></span>
              </div>
            </div>`
          : `<div class="sc-vo-lane is-add" data-lane data-mu-add title="Bấm để chọn file nhạc nền">
              <span class="sc-vo-note">Bấm vào làn này để chọn file nhạc, hoặc nút thư viện để chọn bài có sẵn.</span>
            </div>`
      }
    </div>`;
  // Mỗi lớp: số · tên · tắt tiếng · micro (thu lại lớp đó). Cuối cùng là hàng "Lớp mới" để thu
  // thẳng một lớp nữa (còn chỗ thì mới có). Lớp đang thu có khối đỏ chạy dài theo đầu phát.
  const R = _scVoRec;
  const recBtn = (id, label) => {
    const on = R && R.id === id;
    return `<button type="button" class="sc-vo-rec-btn${on ? " is-on" : ""}" data-vo-rec="${id}" aria-label="${on ? "Dừng thu" : label}" title="${on ? "Dừng thu" : label}">${_scIco(on ? "square" : "mic")}</button>`;
  };
  const live = (id) => (R && R.id === id ? `<div class="sc-vo-live" style="left:${(R.start * pps).toFixed(1)}px"></div>` : "");
  const rows =
    _scVo.clips
      .map(
        (c, k) => `<div class="sc-vo-row is-voice${R && R.id === c.id ? " is-rec" : ""}">
          <div class="sc-vo-head${c.mute ? " is-mute" : ""}">
            <span class="sc-vo-n">${k + 1}</span>
            <span class="sc-vo-name" title="${_scEsc(c.name)}">${_scEsc(c.name)}</span>
            <button type="button" class="sc-vo-mute" data-vo-mute="${c.id}" aria-pressed="${c.mute}" aria-label="${c.mute ? "Bật tiếng" : "Tắt tiếng"} lớp ${k + 1}" title="${c.mute ? "Bật tiếng" : "Tắt tiếng"}">${_scIco(c.mute ? "volume-x" : "volume-2")}</button>
            ${recBtn(c.id, `Thu lại lớp ${k + 1}`)}
          </div>
          <div class="sc-vo-lane" data-lane>
            <div class="sc-vo-clip${c.id === _scVoSel ? " is-sel" : ""}${c.mute ? " is-mute" : ""}" data-clip="${c.id}" tabindex="0" role="button" aria-label="Lớp ${k + 1}: ${_scEsc(c.name)}, bắt đầu ${_scVoFmt(c.start)}">
              <canvas aria-hidden="true"></canvas>
              <span class="sc-vo-cname">${_scEsc(c.name)}</span>
              <span class="sc-vo-edge is-l" data-edge="l" aria-hidden="true"></span>
              <span class="sc-vo-edge is-r" data-edge="r" aria-hidden="true"></span>
            </div>
            ${live(c.id)}
          </div>
        </div>`,
      )
      .join("") +
    (_scVo.clips.length < _SC_VO_MAX
      ? `<div class="sc-vo-row is-voice is-new${R && !R.id ? " is-rec" : ""}">
          <div class="sc-vo-head">
            <button type="button" class="sc-vo-n is-new" data-vo-add aria-label="Thêm file ghi âm ở chỗ đầu phát" title="Thêm file ghi âm">${_scIco("plus")}</button>
            <span class="sc-vo-name">Lớp mới</span>
            ${recBtn("", "Thu âm lớp mới từ đầu phát")}
          </div>
          <div class="sc-vo-lane${R ? "" : " is-add"}" data-lane ${R ? "" : 'data-vo-addlane title="Bấm để thêm file ghi âm bắt đầu từ chỗ này"'}>
            ${R && !R.id ? live("") : `<span class="sc-vo-note">Bấm vào làn này để thêm file ghi âm đúng chỗ đó, hoặc micro để thu.</span><i class="sc-vo-ghost" aria-hidden="true"></i>`}
          </div>
        </div>`
      : "");
  box.innerHTML = `<div class="sc-vo-in" style="--vo-w:${W}px">
      <div class="sc-vo-row is-ruler"><div class="sc-vo-head"></div><div class="sc-vo-lane" data-scrub>${ticks}</div></div>
      <div class="sc-vo-row is-scenes"><div class="sc-vo-head"><span class="sc-vo-name">Cảnh</span></div><div class="sc-vo-lane" data-scrub>${segs}</div></div>
      ${music}
      ${rows}
      <div class="sc-vo-ph" aria-hidden="true"><i></i></div>
    </div>`;
  window.lucide?.createIcons({ root: box });
  _scVo.clips.forEach((c) => _scVoPlace(c));
  if (mi) _scVoPlace(mi);
  _scEl("sc-vo-total").textContent = `/ ${_scVoFmt(total)}`;
  const duck = _scEl("sc-vo-duck");
  duck.value = String(Math.round(_scVo.duck * 100));
  _scRangeFill(duck);
  _scEl("sc-vo-duck-v").textContent = `${Math.round(_scVo.duck * 100)}%`;
  _scVoInspect();
  _scVoRecLabel();
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

// Bảng của lớp đang chọn: tên · âm lượng · dấu x (xoá lớp, có hỏi lại). Dời / cắt làm thẳng trên
// dòng thời gian; bấm ra chỗ trống của làn là bỏ chọn.
function _scVoInspect() {
  const box = _scEl("sc-vo-sel");
  if (!box) return;
  if (_scVoSel === _SC_VO_MU) {
    const mi = _scMuInfo();
    const c = _scVoMuClip();
    if (mi && c) return _scVoInspectMusic(box, mi, c);
    _scVoSel = "";
  }
  const c = _scVoClip(_scVoSel);
  _scToggle("sc-vo-sel", !!c);
  if (!c) {
    box.dataset.sig = "";
    return (box.innerHTML = "");
  }
  if (box.dataset.sig !== c.id) {
    box.dataset.sig = c.id;
    box.innerHTML = `
      <div class="sc-vo-sel-head">
        <span class="sc-vo-n">${_scVo.clips.indexOf(c) + 1}</span>
        <p class="sc-vo-sel-name" title="${_scEsc(c.name)}">${_scEsc(c.name)}</p>
        <output class="sc-vo-vol-v" for="sc-vo-vol"></output>
        <button type="button" class="sc-vo-x" data-vo-del aria-label="Xoá lớp này" title="Xoá lớp">${_scIco("x")}</button>
      </div>
      <input id="sc-vo-vol" type="range" class="sc-range" data-vo-vol min="0" max="100" step="1" aria-label="Âm lượng lớp" />`;
    window.lucide?.createIcons({ root: box });
  }
  const vol = box.querySelector("[data-vo-vol]");
  if (document.activeElement !== vol) vol.value = String(Math.round(c.vol * 100));
  _scRangeFill(vol);
  box.querySelector(".sc-vo-vol-v").textContent = `Âm lượng ${Math.round(c.vol * 100)}%`;
}

// Bảng của khối Nhạc nền: tên bài · quãng phát trên slide · nguồn/độ dài · ghi công · dấu x (bỏ nhạc).
function _scVoInspectMusic(box, mi, c) {
  _scToggle("sc-vo-sel", true);
  const sig = `${_SC_VO_MU}:${mi.name}:${mi.desc}`;
  if (box.dataset.sig !== sig) {
    box.dataset.sig = sig;
    box.innerHTML = `
      <div class="sc-vo-sel-head">
        <span class="sc-vo-n is-music" aria-hidden="true">${_scIco("music")}</span>
        <p class="sc-vo-sel-name" title="${_scEsc(mi.name)}">${_scEsc(mi.name)}</p>
        <output class="sc-vo-vol-v"></output>
        <button type="button" class="sc-vo-x" data-mu-clear aria-label="Bỏ nhạc nền" title="Bỏ nhạc nền">${_scIco("x")}</button>
      </div>
      <p class="sc-vo-sel-sub">${_scEsc(mi.desc)} Kéo hai mép khối để cắt ngắn, kéo thân khối để dời.</p>
      ${mi.credit ? `<p class="sc-vo-sel-sub">${_scEsc(mi.credit)}</p>` : ""}`;
    window.lucide?.createIcons({ root: box });
  }
  box.querySelector(".sc-vo-vol-v").textContent = `${_scVoFmt(c.start)} → ${_scVoFmt(c.start + c.len)}`;
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
  // Đang thu mà slide chạy tới cuối thì dừng thu.
  const total = _scVoTotal();
  if (_scVoRec?.phase === "rec" && total && _scVoT.t >= total - 0.15) _scVoRecStop();
}
function _scVoLoop() {
  if (_scVoRaf) return;
  const step = () => {
    const box = _scEl("sc-vo-tl");
    if (!box || _scEl("sc-tab-audio")?.classList.contains("hidden")) {
      _scVoRaf = 0;
      return;
    }
    const t = _scVoNow();
    const pps = _scVoPx();
    const ph = box.querySelector(".sc-vo-ph");
    if (ph) ph.style.transform = `translateX(${(t * pps).toFixed(1)}px)`;
    const now = _scEl("sc-vo-now");
    if (now) now.textContent = _scVoFmt(t);
    const R = _scVoRec;
    if (R?.phase === "rec") {
      const lv = box.querySelector(".sc-vo-live");
      if (lv) lv.style.width = `${Math.max(2, ((performance.now() - R.at) / 1000) * pps).toFixed(1)}px`;
      _scVoRecLabel();
    }
    // Đang kéo (tua / dời lớp) mà con trỏ chạm sát mép khung thì tự cuộn cả dòng thời gian
    // về phía đó, rồi áp lại thao tác ở đúng chỗ con trỏ.
    const E = _scVoEdge;
    if (E) {
      const r = box.getBoundingClientRect();
      const left = r.left + _scVoHead(box);
      const zone = 48;
      const v = E.x < left + zone ? E.x - (left + zone) : E.x > r.right - zone ? E.x - (r.right - zone) : 0;
      const before = box.scrollLeft;
      if (v) box.scrollLeft = before + Math.max(-28, Math.min(28, v * 0.45));
      if (box.scrollLeft !== before) E.run(E.x);
    } else if (_scVoT.playing || Math.abs(t - _scVoLastT) > 0.05) {
      // Đầu phát chạy (đang phát) hay vừa nhảy (tua, quay về đầu, chọn cảnh) mà ra khỏi khung
      // nhìn thì cuộn theo; đứng yên thì để khách tự cuộn xem chỗ khác.
      const x = t * pps;
      const vis = box.clientWidth - _scVoHead(box);
      if (x < box.scrollLeft || x > box.scrollLeft + vis - 24) box.scrollLeft = Math.max(0, x - vis * 0.2);
    }
    _scVoLastT = t;
    _scVoRaf = requestAnimationFrame(step);
  };
  _scVoRaf = requestAnimationFrame(step);
}

// ── Thao tác trên dòng thời gian: kéo khối / mép khối, kéo thước để tua ──
let _scVoDrag = null;
let _scVoEdge = null; // {x, run(x)} khi đang kéo — vòng vẽ dùng để tự cuộn ở mép khung
let _scVoLastT = 0;
_scEl("sc-vo-tl")?.addEventListener("pointerdown", (e) => {
  const box = e.currentTarget;
  const clipEl = e.target.closest("[data-clip]");
  if (_scVoRec) return; // đang thu: slide tự chạy, không cho dời lớp hay tua
  if (!clipEl && e.target.closest("[data-lane]") && _scVoSel) _scVoSelect("");
  if (clipEl) {
    if (e.button > 0 || _scVoBusy()) return;
    const c = _scVoClip(clipEl.dataset.clip);
    if (!c) return;
    _scVoSelect(c.id);
    e.preventDefault();
    clipEl.setPointerCapture(e.pointerId);
    const edge = e.target.closest("[data-edge]")?.dataset.edge || "";
    _scVoDrag = { c, edge, x0: e.clientX, sl0: box.scrollLeft, s0: { start: c.start, in: c.in, len: c.len }, moved: false };
    _scVoEdge = { x: e.clientX, run: _scVoDragMove };
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
  _scVoEdge = { x: e.clientX, run: (x) => go({ clientX: x }) };
  const move = (ev) => {
    _scVoEdge.x = ev.clientX;
    go(ev);
  };
  const up = () => {
    _scVoEdge = null;
    lane.removeEventListener("pointermove", move);
    lane.removeEventListener("pointerup", up);
    lane.removeEventListener("pointercancel", up);
  };
  lane.addEventListener("pointermove", move);
  lane.addEventListener("pointerup", up);
  lane.addEventListener("pointercancel", up);
});

_scEl("sc-vo-tl")?.addEventListener("pointermove", (e) => {
  // Vạch "+" chạy theo con trỏ trên làn Lớp mới: chỗ file sẽ bắt đầu nếu bấm.
  const add = !_scVoDrag && e.pointerType === "mouse" && e.target.closest("[data-vo-addlane]");
  if (add) {
    const g = add.querySelector(".sc-vo-ghost");
    if (g) g.style.left = `${Math.max(0, e.clientX - add.getBoundingClientRect().left).toFixed(1)}px`;
  }
  if (!_scVoDrag) return;
  if (_scVoEdge) _scVoEdge.x = e.clientX;
  _scVoDragMove(e.clientX);
});

// Dời / cắt lớp theo vị trí con trỏ — tính cả quãng dòng thời gian đã tự cuộn từ lúc bấm.
function _scVoDragMove(x) {
  const D = _scVoDrag;
  if (!D) return;
  const dx = x - D.x0 + (_scEl("sc-vo-tl").scrollLeft - D.sl0);
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
    // Nhạc nền (bài lặp): mép phải chặn ở hết slide; chạm hết slide là lại "chạy tới cuối".
    if (c.id === _SC_VO_MU) {
      c.len = Math.min(c.len, Math.max(MIN, total - c.start));
      c.full = c.start + c.len >= total - 0.05;
    }
  } else {
    let s = D.s0.start + dt;
    const a = _scVoSnap(s, c.id);
    const b = _scVoSnap(s + c.len, c.id) - c.len;
    s = Math.abs(a - s) <= Math.abs(b - s) ? a : b;
    c.start = Math.max(0, Math.min(s, Math.max(0, total - MIN)));
    if (c.id === _SC_VO_MU) c.full = c.start + c.len >= total - 0.05;
  }
  _scVoPlace(c);
  _scVoInspect();
  _scVoSend();
}

const _scVoEnd = () => {
  const D = _scVoDrag;
  if (!D) return;
  _scVoDrag = null;
  _scVoEdge = null;
  _scEl("sc-vo-tl")?.querySelector(".is-drag")?.classList.remove("is-drag");
  if (!D.moved) return;
  _scVoSave();
  // Khối nhạc "chạy tới cuối" kéo xong thì co / giãn lại cho vừa hết slide.
  if (D.c.id === _SC_VO_MU) {
    _scVoPlace(_scVoMuClip());
    _scVoInspect();
    _scVoSend();
  }
};
_scEl("sc-vo-tl")?.addEventListener("pointerup", _scVoEnd);
_scEl("sc-vo-tl")?.addEventListener("pointercancel", _scVoEnd);

// Phím trên khối đang chọn: ← → nhích 0,1 giây (Shift: 1 giây).
_scEl("sc-vo-tl")?.addEventListener("keydown", (e) => {
  const el = e.target.closest("[data-clip]");
  const d = { ArrowLeft: -1, ArrowRight: 1 }[e.key];
  if (!el || !d || _scVoRec) return;
  e.preventDefault();
  const c = _scVoClip(el.dataset.clip);
  if (!c) return;
  _scVoSelect(c.id);
  _scVoSet(c.id, { start: Math.max(0, Math.min(c.start + d * (e.shiftKey ? 1 : 0.1), _scVoTotal() - 0.2)) });
});

// Nút trong dòng thời gian (tắt tiếng, micro) và dấu x của bảng lớp đang chọn.
function _scVoClick(e) {
  if (e.target.closest("[data-mu-add]")) return scMusicPick();
  if (e.target.closest("[data-mu-lib]")) return scMusicLibOpen(_scEl("sc-mu-libbox").classList.contains("hidden"));
  if (e.target.closest("[data-mu-clear]")) {
    _scVoSelect("");
    return scMusicClear();
  }
  if (e.target.closest("[data-vo-add]")) return scVoicePick();
  const addLane = e.target.closest("[data-vo-addlane]");
  if (addLane) return scVoicePick((e.clientX - addLane.getBoundingClientRect().left) / _scVoPx());
  const rec = e.target.closest("[data-vo-rec]");
  if (rec) return scVoiceRecord(rec.dataset.voRec);
  const mute = e.target.closest("[data-vo-mute]");
  if (mute) {
    const c = _scVoClip(mute.dataset.voMute);
    if (c) _scVoSet(c.id, { mute: !c.mute }, true);
    return;
  }
  if (e.target.closest("[data-vo-del]") && _scVoSel) scVoiceRemove(_scVoSel);
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

_scEl("sc-vo-play")?.addEventListener("click", () => {
  if (_scVoRec) return _scVoRecStop();
  _scFrame.contentWindow?.postMessage({ type: "cx-slide-play", on: !_scVoT.playing }, location.origin);
});

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
