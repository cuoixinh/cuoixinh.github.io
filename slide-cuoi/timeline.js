// Dòng thời gian kiểu bàn dựng phim của /slide-cuoi/: vẽ thước · track Cảnh · track Nhạc nền · các
// track giọng đọc và mọi thao tác trên đó — chọn nhiều, kéo dời / đổi track, cắt mép, tách, nhân bản,
// sao chép, xoá kéo theo, fade, đường âm lượng, tắt / solo / khoá / âm lượng track, đổi thứ tự +
// thời lượng + chuyển cảnh — kèm lịch sử hoàn tác. Dữ liệu ở voice.js (_scVo), cảnh + thời gian ở
// index.js. Nạp SAU voice.js. Mọi thao tác đổi dữ liệu bọc trong _scTlBegin/_scTlEnd (hoặc _scTlDo).

const _SC_TL_MIN = 0.2; // clip / cảnh ngắn nhất (giây)
const _SC_TL_HIST = 100;
let _scTlSel = new Set(); // id clip đang chọn (khối Nhạc nền là _SC_VO_MU)
let _scTlScene = -1; // cảnh đang chọn trên track Cảnh
let _scTlSnap = true;
let _scTlCb = null; // bộ nhớ sao chép: [{meta, dt, dtrk}]
let _scTlD = null; // thao tác kéo đang chạy (xem _scTlMove)
let _scTlTap = null; // lượt bấm không kéo: {kind: "clip"|"scene", id|i, x} — click mở thanh tuỳ chọn
let _scTlPin = null; // thẻ nổi đang neo trên dòng thời gian: {pop, sel, off} để bám lại sau khi vẽ
let _scTlRaf = 0;
let _scTlLastT = 0;
let _scTlKfTap = null; // lần chạm trước lên một điểm âm lượng {c, p, at} — chạm lần hai liền sau = xoá

const _scTlBox = () => _scEl("sc-vo-tl");
// Dòng thời gian đo theo bề ngang khung: chỉ vẽ khi đang hiện (dock đáy, hoặc tab Âm thanh đang mở).
const _scVoShown = (box) => !!box && box.getClientRects().length > 0;
const _scTlDragging = (c) => !!_scTlD?.ids?.includes(c.id);
const _scTlTrackOfClip = (c) => (c.id === _SC_VO_MU ? _scVo.mtr : _scVoTrack(c.track));
const _scTlLocked = (id) => !!_scTlTrackOfClip(_scVoClip(id) || {})?.lock;
const _scTlIdx = (tid) => _scVo.tracks.findIndex((t) => t.id === tid);
const _scTlSec = (s) => `${(Math.round(s * 10) / 10).toLocaleString("vi-VN")} giây`;
function _scTlToast(msg, type = "success") {
  window.showToast?.(msg, type);
}

// ── Lịch sử hoàn tác ──
// Mỗi bước giữ trạng thái TRƯỚC và SAU của các miền: vo (track + clip + mức giảm nhạc) · mu (bài
// nhạc + đoạn cắt) · tm (thời gian cảnh) · tx (chữ sửa) · ph (ảnh từng ô: id + điểm lấy nét). Hoàn
// tác chỉ trả lại miền bước đó đã đổi; tm/tx/ph trả từng khoá, không đè cả cụm. Byte ảnh / file nhạc
// cũ nằm ở _scPhBank / _scMuBank (index.js) để còn trả lại được sau khi đã xoá khỏi IndexedDB.
const _SC_TL_DOMS = ["vo", "mu", "tm", "tx", "ph"];
const _scTlH = { undo: [], redo: [], cur: null };
function _scTlState() {
  const mu = _scMu.pick ? _scMuCut() : null;
  const ph = {};
  Object.keys(_scPh.map)
    .sort()
    .forEach((k) => (ph[k] = { id: _scPh.map[k].id, focal: _scPh.map[k].focal || null }));
  return {
    vo: JSON.stringify({ clips: _scVo.clips.map(_scVoClipMeta), tracks: _scVo.tracks, mtr: _scVo.mtr, duck: _scVo.duck }),
    mu: mu ? JSON.stringify({ pid: _scMuPid(_scMu.pick), start: mu.start, in: mu.in, len: mu.len, full: mu.full, fi: mu.fi, fo: mu.fo, env: mu.env || [] }) : "",
    tm: JSON.stringify(_scTiming()),
    tx: JSON.stringify(_scTexts()),
    ph: JSON.stringify(ph),
  };
}
// Bước MỞ DÀI: gõ chữ (từ phím đầu tới lúc rời ô), kéo thanh (từ nấc đầu tới lúc thả) gom thành một
// bước. Bước khác bắt đầu, hay bấm hoàn tác / làm lại, thì đóng bước đang mở trước.
let _scTlHold = "";
function _scTlHoldOpen(label) {
  if (_scTlHold === label && _scTlH.cur) return;
  _scTlHoldClose();
  _scTlBegin();
  _scTlHold = label;
}
function _scTlHoldClose() {
  if (!_scTlHold) return;
  const label = _scTlHold;
  _scTlHold = "";
  _scTlEnd(label);
}
// Dữ liệu tự nạp xong giữa chừng một bước đang mở (bài thư viện về trễ) không phải thao tác của
// người dùng: dời mốc TRƯỚC của bước đó theo, để hoàn tác không gỡ luôn nó.
function _scTlRebase(dom) {
  if (_scTlH.cur) _scTlH.cur.before[dom] = _scTlState()[dom];
}
function _scTlBegin() {
  if (_scTlHold) _scTlHoldClose();
  if (!_scTlH.cur) _scTlH.cur = { before: _scTlState(), depth: 0 };
  _scTlH.cur.depth++;
}
function _scTlEnd(label) {
  const H = _scTlH;
  if (!H.cur || --H.cur.depth > 0) return;
  const before = H.cur.before;
  H.cur = null;
  const after = _scTlState();
  if (_SC_TL_DOMS.every((d) => before[d] === after[d])) return;
  H.undo.push({ before, after, label: label || "", key: _scVo.key });
  if (H.undo.length > _SC_TL_HIST) H.undo.shift();
  H.redo = [];
  _scTlHistUi();
}
function _scTlDo(label, fn) {
  _scTlBegin();
  try {
    return fn();
  } finally {
    _scTlEnd(label);
  }
}
function _scTlReset() {
  _scTlHold = "";
  _scTlH.undo = [];
  _scTlH.redo = [];
  _scTlH.cur = null;
  _scTlSel = new Set();
  _scTlScene = -1;
  _scTlHistUi();
}
function _scTlHistUi() {
  const u = _scTlH.undo[_scTlH.undo.length - 1];
  const r = _scTlH.redo[_scTlH.redo.length - 1];
  const bu = _scEl("sc-tl-undo");
  const br = _scEl("sc-tl-redo");
  if (bu) {
    bu.disabled = !u;
    bu.title = u ? `Hoàn tác: ${u.label} (Ctrl+Z)` : "Hoàn tác (Ctrl+Z)";
  }
  if (br) {
    br.disabled = !r;
    br.title = r ? `Làm lại: ${r.label} (Ctrl+Shift+Z)` : "Làm lại (Ctrl+Shift+Z)";
  }
}
// Trả các khoá thời gian cảnh mà bước này đổi (từ `from` sang `to`) vào bản hiện tại.
function _scTlTimingMerge(cur, from, to) {
  new Set([...Object.keys(from), ...Object.keys(to)]).forEach((k) => {
    if (JSON.stringify(from[k]) === JSON.stringify(to[k])) return;
    if (k === "scenes") {
      const a = from.scenes || {};
      const b = to.scenes || {};
      const out = { ...(cur.scenes || {}) };
      new Set([...Object.keys(a), ...Object.keys(b)]).forEach((id) => {
        if (a[id] === b[id]) return;
        if (b[id] == null) delete out[id];
        else out[id] = b[id];
      });
      cur.scenes = out;
    } else if (to[k] == null) delete cur[k];
    else cur[k] = JSON.parse(JSON.stringify(to[k]));
  });
  return cur;
}
// Chữ / ảnh: trả đúng các khoá bước này đổi (from → to) vào bản hiện tại.
function _scTlKeyMerge(cur, from, to) {
  new Set([...Object.keys(from), ...Object.keys(to)]).forEach((k) => {
    if (JSON.stringify(from[k]) === JSON.stringify(to[k])) return;
    if (to[k] == null) delete cur[k];
    else cur[k] = JSON.parse(JSON.stringify(to[k]));
  });
  return cur;
}
function _scTlApply(to, from) {
  if (to.vo !== from.vo) {
    const v = JSON.parse(to.vo);
    _scVo.clips = v.clips.filter((c) => _scVo.srcs.has(c.src));
    _scVo.tracks = v.tracks;
    _scVo.mtr = v.mtr;
    if (Number.isFinite(v.duck)) _scVo.duck = v.duck;
    _scTlSel = new Set([..._scTlSel].filter((id) => id === _SC_VO_MU || _scVo.clips.some((c) => c.id === id)));
  }
  if (to.mu !== from.mu) _scMuApply(to.mu ? JSON.parse(to.mu) : null);
  if (to.tm !== from.tm) _scTimingSave(_scTlTimingMerge(_scTiming(), JSON.parse(from.tm), JSON.parse(to.tm)));
  if (to.tx !== from.tx) _scTextsApply(_scTlKeyMerge(_scTexts(), JSON.parse(from.tx), JSON.parse(to.tx)));
  if (to.ph !== from.ph) {
    const cur = {};
    Object.entries(_scPh.map).forEach(([k, p]) => (cur[k] = { id: p.id, focal: p.focal || null }));
    _scPhApply(_scTlKeyMerge(cur, JSON.parse(from.ph), JSON.parse(to.ph)));
  }
  _scVoSave();
  _scVoSend();
  _scVoRender();
}
function scTlUndo() {
  _scTlHoldClose();
  if (_scVoBusy() || _scTlD || _scTlH.cur) return;
  const e = _scTlH.undo.pop();
  if (!e) return;
  if (e.key !== _scVo.key) return _scTlReset();
  _scTlApply(e.before, e.after);
  _scTlH.redo.push(e);
  _scTlHistUi();
  _scTlToast(`Đã hoàn tác: ${e.label}`, "info");
}
function scTlRedo() {
  _scTlHoldClose();
  if (_scVoBusy() || _scTlD || _scTlH.cur) return;
  const e = _scTlH.redo.pop();
  if (!e) return;
  if (e.key !== _scVo.key) return _scTlReset();
  _scTlApply(e.after, e.before);
  _scTlH.undo.push(e);
  _scTlHistUi();
  _scTlToast(`Đã làm lại: ${e.label}`, "info");
}

// ── Hình học trên track ──
// Clip của track `tid` theo thứ tự thời gian, bỏ các id trong `skip`.
const _scTlOn = (tid, skip) =>
  _scVo.clips.filter((c) => c.track === tid && !skip?.has(c.id)).sort((a, b) => a.start - b.start);
// [s, s + len] có trống trên track không (hai clip chạm mép không tính là chồng).
const _scTlFree = (tid, s, len, skip) =>
  !_scTlOn(tid, skip).some((c) => s < c.start + c.len - 1e-3 && s + len > c.start + 1e-3);
// Chỗ bắt đầu gần `s` nhất mà clip dài `len` nằm vừa trên track; null nếu không còn chỗ trong slide.
function _scTlGap(tid, s, len, skip) {
  const max = Math.max(0, _scVoTotal() - _SC_TL_MIN);
  let best = null;
  const fit = (a, b) => {
    if (b - a < len - 1e-3) return;
    const x = Math.min(Math.max(s, a), b - len);
    if (x > max + 1e-6) return;
    if (best == null || Math.abs(x - s) < Math.abs(best - s)) best = x;
  };
  let prev = 0;
  _scTlOn(tid, skip).forEach((c) => {
    fit(prev, c.start);
    prev = Math.max(prev, c.start + c.len);
  });
  fit(prev, Infinity);
  return best;
}
// Xếp clip mới (đã có start) lên track `want` nếu vừa, không thì track mới (hết chỗ thì track còn
// trống nhất). Clip đè lên clip khác thì dời tới chỗ trống gần nhất.
function _scTlPlaceNew(clips, want) {
  const fits = (t) => clips.every((c) => _scTlFree(t.id, c.start, c.len, new Set(clips.map((x) => x.id))));
  const w = want ? _scVoTrack(want) : null;
  if (w && !w.lock) {
    // Track được chỉ định: đặt lên đó, chỗ bận thì tìm chỗ trống gần nhất (hết chỗ mới sang track mới).
    clips.forEach((c) => (c.track = w.id));
    return _scTlSettle(clips);
  }
  const t = _scVoTrackAdd() || _scVo.tracks.find((x) => !x.lock && fits(x)) || _scVo.tracks.find((x) => !x.lock) || _scVo.tracks[0];
  if (!t) return;
  clips.forEach((c) => (c.track = t.id));
  _scTlSettle(clips);
}
// Clip vừa đổi độ dài (thay file / thu lại) không được đè lên clip kế sau trên cùng track.
function _scTlFit(c) {
  const next = _scTlOn(c.track, new Set([c.id])).find((o) => o.start >= c.start - 1e-3);
  if (next && c.start + c.len > next.start) c.len = Math.max(_SC_TL_MIN, next.start - c.start);
}
// Bỏ các track trống trong `ids` (track tạo tạm khi kéo clip xuống hàng "Track mới").
function _scTlDropEmpty(ids) {
  _scVo.tracks = _scVo.tracks.filter((t) => !ids.includes(t.id) || _scVo.clips.some((c) => c.track === t.id));
}

// ── Chọn ──
function _scTlSelectOnly(ids) {
  _scTlSel = new Set(ids);
  _scTlScene = -1;
  _scTlMark();
}
function _scTlMark() {
  const box = _scTlBox();
  if (!box) return;
  box.querySelectorAll("[data-clip]").forEach((el) => {
    el.classList.toggle("is-sel", _scTlSel.has(el.dataset.clip));
    const c = _scVoClip(el.dataset.clip);
    if (c) _scVoPlace(c);
  });
  box.querySelectorAll("[data-scene]").forEach((el) => el.classList.toggle("is-sel", Number(el.dataset.scene) === _scTlScene));
  if (!_scTlSel.size) _scEl("sc-vo-act")?.close?.();
  if (_scTlScene < 0) _scEl("sc-vo-scene")?.close?.();
}
function _scTlSelectAll() {
  const ids = _scVo.clips.map((c) => c.id);
  if (_scVoMuClip()) ids.push(_SC_VO_MU);
  _scTlSelectOnly(ids);
}

// ── Vẽ ──
const _SC_VO_STEPS = [0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300];
const _scVoHead = (box) => parseFloat(getComputedStyle(box).getPropertyValue("--vo-head")) || 96;
const _scVoFit = (box, total) => (total > 0 ? Math.max(0.5, (box.clientWidth - _scVoHead(box) - 24) / total) : 8);
// Mức phóng mặc định không dưới _SC_VO_PPS — khung hẹp (điện thoại) thì gấp đôi cho clip vài giây
// còn đọc được tên; vuốt ngang để xem phần còn lại.
function _scVoPx() {
  const box = _scTlBox();
  const fit = _scVoFit(box, _scVoTotal());
  const min = box && box.clientWidth < 600 ? _SC_VO_PPS * 2.4 : _SC_VO_PPS;
  return _scVoPps > 0 ? _scVoPps : _scVoPps < 0 ? fit : Math.max(fit, min);
}
const _SC_TL_TR = {
  fade: ["Mờ dần", "blend"],
  slide: ["Trượt ngang", "move-horizontal"],
  "slide-up": ["Trượt lên", "move-vertical"],
  zoom: ["Phóng xuyên", "zoom-in"],
  split: ["Mở từ giữa", "columns-2"],
  cut: ["Cắt thẳng", "scissors"],
};
// Đầu track = MỘT ô: biểu tượng của track (♪ / số / sóng âm) kèm dấu + nhỏ ở góc — vừa là nhãn track
// vừa là lối thêm. Bấm mở thanh #sc-vo-act ở chế độ track (hàng Thêm + việc của track, _scVoActOpenTrack);
// hàng Track mới chưa có track nên mở thẳng popover Thêm. Đang thu vào track đó thì ô thành nút dừng.
// Tên + trạng thái nằm ở tooltip; có trạng thái (tắt tiếng, solo, khoá, âm lượng ≠ 100%) thì chấm cam.
const _scTlVolPct = (t) => Math.round((Number.isFinite(t?.vol) ? t.vol : 1) * 100);
function _scTlBadge({ id, icon, cls = "", recOn, st = "", name, add }) {
  if (recOn)
    return `<button type="button" class="sc-tl-badge is-rec" data-trk-rec="${id}" aria-label="Dừng thu" title="Dừng thu"><span class="sc-vo-n">${_scIco("square")}</span></button>`;
  const tip = `${name}${st ? ` · ${st}` : ""} — ${add ? "bấm để thêm âm thanh" : "bấm để thêm âm thanh, chỉnh track"}`;
  return `<button type="button" class="sc-tl-badge${st ? " has-st" : ""}" ${add ? `data-trk-add="${id}"` : `data-trk-menu="${id}"`} aria-haspopup="true" aria-label="${_scEsc(tip)}" title="${_scEsc(tip)}">
      <span class="sc-vo-n${cls}">${icon}</span><span class="sc-tl-plus" aria-hidden="true">${_scIco("plus")}</span>
    </button>`;
}
// Màn rộng (CSS .sc-tl-wide, ≥1024px): cạnh ô biểu tượng trải thêm tên track + hàng nút nhanh
// (Tắt tiếng · Solo · Khoá … Tải lên · Ghi âm / Thư viện). Màn hẹp CSS ẩn khối này, chỉ còn ô biểu tượng.
const _scTlQ = (q, id, icon, tip, on) =>
  `<button type="button" class="sc-tl-q${on ? " is-on" : ""} is-${q}" data-trk-q="${q}" data-id="${_scEsc(id)}"${on != null ? ` aria-pressed="${!!on}"` : ""} aria-label="${tip}" title="${tip}">${_scIco(icon)}</button>`;
function _scTlWide(id, name, vol, btns) {
  // Track có thật: dòng trên là thanh kéo âm lượng (tên nằm ở tooltip ô biểu tượng, đổi tên vẫn ở thanh
  // #sc-vo-act); hàng Track mới chưa có âm lượng nên giữ nhãn.
  const top = id
    ? `<label class="sc-tl-wvol" title="Âm lượng ${_scEsc(name)}">
        <input type="range" class="sc-vo-act-volr" data-trk-vol="${_scEsc(id)}" min="0" max="100" step="5" value="${vol}" style="--p: ${vol}%" aria-label="Âm lượng ${_scEsc(name)}" />
        <output>${vol}%</output>
      </label>`
    : `<button type="button" class="sc-tl-wname" data-trk-add="" title="Thêm âm thanh">${_scEsc(name)}</button>`;
  return `<div class="sc-tl-wide">${top}<div class="sc-tl-qrow">${btns}</div></div>`;
}
function _scTlHead(t, k, music) {
  const id = music ? "music" : t.id;
  const R = _scVoRec;
  const vol = _scTlVolPct(t);
  const st = [t.mute && "Tắt tiếng", t.solo && "Solo", t.lock && "Khoá", vol !== 100 && `${vol}%`].filter(Boolean).join(" · ");
  const name = music ? "Nhạc nền" : t.name;
  const btns =
    _scTlQ("mute", id, t.mute ? "volume-x" : "volume-2", t.mute ? "Bật tiếng" : "Tắt tiếng", !!t.mute) +
    _scTlQ("solo", id, "headphones", "Solo", !!t.solo) +
    _scTlQ("lock", id, t.lock ? "lock" : "lock-open", t.lock ? "Mở khoá" : "Khoá", !!t.lock) +
    `<i class="sc-tl-qsp"></i>` +
    _scTlQ("file", id, "upload", music ? "Tải nhạc lên" : "Tải âm thanh lên") +
    (music ? _scTlQ("lib", id, "list-music", "Thư viện nhạc") : _scTlQ("rec", id, "mic", "Ghi âm vào track này"));
  return `<div class="sc-vo-head${_scVoHeard(t) ? "" : " is-mute"}">${_scTlBadge({
    id,
    icon: music ? _scIco("music") : String(k + 1),
    cls: music ? " is-music" : "",
    recOn: !!R && !R.id && R.track === id,
    st,
    name,
  })}${_scTlWide(id, name, vol, btns)}</div>`;
}
const _scTlClipHTML = (c, extra = "", label = "") => `<div class="sc-vo-clip${extra}${_scTlSel.has(c.id) ? " is-sel" : ""}" data-clip="${_scEsc(c.id)}" tabindex="0" role="button" aria-label="${_scEsc(label || c.name)}">
    ${c.id === _SC_VO_MU ? "" : `<canvas aria-hidden="true"></canvas>`}
    <span class="sc-vo-cname">${_scEsc(c.name)}</span>
    <i class="sc-vo-fade is-in" aria-hidden="true"></i><i class="sc-vo-fade is-out" aria-hidden="true"></i>
    <svg class="sc-tl-env" aria-hidden="true"></svg>
    <span class="sc-tl-fh is-in" data-fh="fi" title="Kéo để to dần" aria-hidden="true"></span>
    <span class="sc-tl-fh is-out" data-fh="fo" title="Kéo để nhỏ dần" aria-hidden="true"></span>
    <span class="sc-vo-edge is-l" data-edge="l" aria-hidden="true"></span>
    <span class="sc-vo-edge is-r" data-edge="r" aria-hidden="true"></span>
  </div>`;

function _scVoRender() {
  const box = _scTlBox();
  if (!_scVoShown(box)) {
    _scEl("sc-vo-act")?.close?.();
    _scEl("sc-vo-scene")?.close?.();
    return;
  }
  if (_scTlScene >= _scCues.length) _scTlScene = -1;
  const pinned = _scTlPin && _scTlPin.pop.isOpen ? _scTlPin : null;
  const total = _scVoTotal();
  const pps = _scVoPx();
  const W = Math.max(box.clientWidth - _scVoHead(box), Math.ceil(total * pps) + 24);
  const step = _SC_VO_STEPS.find((s) => s * pps >= 64) || 600;
  let ticks = "";
  for (let s = 0; s <= total + 1e-6; s += step)
    ticks += `<span class="sc-vo-tick" style="left:${(s * pps).toFixed(1)}px">${_scVoFmt(s).replace(/\.0$/, "")}</span>`;
  const starts = _scVoSceneStarts();
  // Track Cảnh: mỗi cảnh một khối (kéo thân = đổi thứ tự, kéo mép phải = đổi thời lượng); dấu thoi ở
  // chỗ nối hai cảnh = kiểu chuyển vào cảnh sau.
  const segs = _scCues
    .map((c, i) => {
      const tr = c.tr || "fade";
      const set = c.tr0 && tr !== c.tr0;
      return `<span class="sc-vo-seg${i % 2 ? " is-alt" : ""}${i === _scTlScene ? " is-sel" : ""}" data-scene="${i}" tabindex="0" role="button" aria-label="Cảnh ${i + 1}: ${_scEsc(c.label)}, ${_scTlSec(c.dur / 1000)}" style="left:${(starts[i] * pps).toFixed(1)}px;width:${((c.dur / 1000) * pps).toFixed(1)}px" title="${_scEsc(c.label)} · ${_scTlSec(c.dur / 1000)} — kéo để đổi thứ tự">${_scEsc(c.label)}<i class="sc-tl-sedge" data-sedge="${i}" title="Kéo để đổi thời lượng cảnh"></i></span>${
        i > 0
          ? `<button type="button" class="sc-tl-tr${set ? " is-set" : ""}${tr === "cut" ? " is-cut" : ""}" data-tr="${i}" style="left:${(starts[i] * pps).toFixed(1)}px" aria-label="Chuyển vào cảnh ${i + 1}: ${_SC_TL_TR[tr]?.[0] || tr}" title="Chuyển cảnh: ${_SC_TL_TR[tr]?.[0] || tr}"></button>`
          : ""
      }`;
    })
    .join("");
  const mi = _scVoMuClip();
  const music = `<div class="sc-vo-row is-voice is-music${_scVo.mtr.lock ? " is-lock" : ""}" data-row="music">
      ${_scTlHead(_scVo.mtr, 0, true)}
      ${
        mi
          ? `<div class="sc-vo-lane" data-lane data-track="music">${_scTlClipHTML(mi, " is-music", `Nhạc nền: ${mi.name}`)}</div>`
          : `<div class="sc-vo-lane is-add" data-lane data-mu-add title="Bấm để chọn file nhạc nền"><span class="sc-vo-note">Chạm để thêm nhạc nền</span></div>`
      }
    </div>`;
  const R = _scVoRec;
  const live = (tid) => (R && !R.id && R.track === tid ? `<div class="sc-vo-live" style="left:${(R.start * pps).toFixed(1)}px"></div>` : "");
  const rows = _scVo.tracks
    .map(
      (t, k) => `<div class="sc-vo-row is-voice${t.lock ? " is-lock" : ""}${R && !R.id && R.track === t.id ? " is-rec" : ""}" data-row="${_scEsc(t.id)}">
        ${_scTlHead(t, k, false)}
        <div class="sc-vo-lane" data-lane data-track="${_scEsc(t.id)}">
          ${_scTlOn(t.id)
            .map((c) => _scTlClipHTML(c, _scVoHeard(t) ? "" : " is-mute"))
            .join("")}
          ${live(t.id)}
        </div>
      </div>`,
    )
    .join("");
  const canAdd = _scVo.tracks.length < _SC_VO_TRACKS;
  const newRow = canAdd
    ? `<div class="sc-vo-row is-voice is-new${R && !R.id && !R.track ? " is-rec" : ""}" data-row="new">
        <div class="sc-vo-head">${_scTlBadge({ id: "", icon: _scIco("audio-lines"), cls: " is-new", recOn: !!(R && !R.id && !R.track), name: "Track mới", add: true })}${_scTlWide(
          "",
          "Track mới",
          null,
          _scTlQ("file", "", "upload", "Tải âm thanh lên track mới") + _scTlQ("rec", "", "mic", "Ghi âm vào track mới") + _scTlQ("empty", "", "plus", "Thêm track trống"),
        )}</div>
        <div class="sc-vo-lane${R ? "" : " is-add"}" data-lane ${R ? "" : 'data-vo-addlane title="Bấm để thêm file vào track mới, bắt đầu từ chỗ này"'}>
          ${R && !R.id && !R.track ? live("") : `<span class="sc-vo-note">Chạm để thêm âm thanh · kéo clip thả vào đây để tạo track mới</span><i class="sc-vo-ghost" aria-hidden="true"></i>`}
        </div>
      </div>`
    : "";
  const sl = box.scrollLeft;
  const st = box.scrollTop;
  box.innerHTML = `<div class="sc-vo-in" style="--vo-w:${W}px">
      <div class="sc-vo-row is-ruler" data-row="ruler"><div class="sc-vo-head"><span class="sc-tl-snapi${_scTlSnap ? " is-on" : ""}" title="Hút vào mốc: ${_scTlSnap ? "bật" : "tắt"} (S)">${_scIco("magnet")}</span><span class="sc-tl-wide sc-tl-wlab">Hút mốc: ${_scTlSnap ? "bật" : "tắt"}</span></div><div class="sc-vo-lane" data-scrub>${ticks}</div></div>
      <div class="sc-vo-row is-scenes" data-row="scenes"><div class="sc-vo-head"><span class="sc-vo-n is-scenes" title="Cảnh" aria-label="Cảnh">${_scIco("film")}</span><span class="sc-tl-wide sc-tl-wlab">Cảnh · ${_scCues.length}</span></div><div class="sc-vo-lane" data-lane>${segs}</div></div>
      ${music}
      ${rows}
      ${newRow}
      <div class="sc-vo-ph" aria-hidden="true"><i></i></div>
      <div class="sc-tl-marq hidden" aria-hidden="true"></div>
      <i class="sc-tl-ins hidden" aria-hidden="true"></i>
    </div>`;
  box.scrollLeft = sl;
  box.scrollTop = st;
  window.lucide?.createIcons({ root: box });
  _scVo.clips.forEach((c) => _scVoPlace(c));
  if (mi) _scVoPlace(mi);
  _scEl("sc-vo-total").textContent = `/ ${_scVoFmt(total)}`;
  const duck = _scEl("sc-vo-duck");
  duck.value = String(Math.round(_scVo.duck * 100));
  _scRangeFill(duck);
  _scEl("sc-vo-duck-v").textContent = `${Math.round(_scVo.duck * 100)}%`;
  _scEl("sc-tl-snap")?.setAttribute("aria-pressed", String(_scTlSnap));
  _scTlHistUi();
  // Thẻ nổi đang mở thì bám lại vào đúng khối (khung báo lại danh sách cảnh mỗi lần tua sang cảnh
  // khác — đóng theo là vừa bấm đã mất); khối không còn thì đóng.
  if (pinned) {
    const el = box.querySelector(pinned.sel);
    if (!el) pinned.pop.close?.();
    else if (pinned.btn) pinned.pop.open(el);
    else _scTlOpenAt(pinned.pop, el, el.getBoundingClientRect().left + pinned.off, pinned.sel);
  }
  _scVoRecLabel();
  _scVoLoop();
}

// Đặt khối theo start/len (px), dốc fade, tay nắm fade, dạng sóng và đường âm lượng (khối đang chọn).
function _scVoPlace(c) {
  const el = _scTlBox()?.querySelector(`[data-clip="${CSS.escape(c.id)}"]`);
  if (!el) return;
  const pps = _scVoPx();
  const w = Math.max(6, c.len * pps);
  el.style.left = `${(c.start * pps).toFixed(1)}px`;
  el.style.width = `${w.toFixed(1)}px`;
  // Khối hẹp: bỏ tay nắm hai mép để cả khối là chỗ kéo dời.
  el.classList.toggle("is-narrow", w < 40);
  el.setAttribute("aria-label", `${c.name}, bắt đầu ${_scVoFmt(c.start)}, dài ${_scVoFmt(c.len)}`);
  // Dốc to dần / nhỏ dần (cùng phép thu của fadeGain khi hai dốc dài quá khối).
  const fi = c.fi || 0;
  const fo = c.fo || 0;
  const k = fi + fo > c.len ? c.len / (fi + fo) : 1;
  el.querySelector(".sc-vo-fade.is-in")?.style.setProperty("width", `${(fi * k * pps).toFixed(1)}px`);
  el.querySelector(".sc-vo-fade.is-out")?.style.setProperty("width", `${(fo * k * pps).toFixed(1)}px`);
  el.querySelector(".sc-tl-fh.is-in")?.style.setProperty("left", `${Math.min(w - 10, fi * k * pps).toFixed(1)}px`);
  el.querySelector(".sc-tl-fh.is-out")?.style.setProperty("right", `${Math.min(w - 10, fo * k * pps).toFixed(1)}px`);
  _scTlEnvDraw(el, c, w);
  const cv = el.querySelector("canvas");
  const P = _scVoPeaksOf(c);
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

// ── Đường âm lượng (dây cao su trên khối đang chọn) ──
// Điểm {t: giây trong file, g: 0..1}; không có điểm = 100%. Kéo dây = nâng / hạ cả đường; Ctrl + bấm
// dây = thêm điểm; kéo điểm = dời; bấm đúp điểm = xoá. Khung slide (envGain) và bộ xuất dựng y vậy.
const _SC_TL_ENV_PAD = 6;
function _scTlEnvAt(env, t) {
  if (!env?.length) return 1;
  if (t <= env[0].t) return env[0].g;
  for (let k = 1; k < env.length; k++) {
    const a = env[k - 1];
    const b = env[k];
    if (t <= b.t) return b.t > a.t ? a.g + ((b.g - a.g) * (t - a.t)) / (b.t - a.t) : b.g;
  }
  return env[env.length - 1].g;
}
function _scTlEnvDraw(el, c, w) {
  const svg = el.querySelector(".sc-tl-env");
  if (!svg) return;
  const on = _scTlSel.has(c.id) || !!c.env?.length;
  svg.classList.toggle("is-on", on);
  svg.classList.toggle("is-edit", _scTlSel.has(c.id));
  if (!on) return (svg.innerHTML = "");
  const h = el.clientHeight || 36;
  const pps = _scVoPx();
  const vol = c.vol ?? 1;
  const y = (g) => (_SC_TL_ENV_PAD + (1 - Math.min(1, g * vol)) * (h - 2 * _SC_TL_ENV_PAD)).toFixed(1);
  const env = c.env || [];
  const pts = [[0, y(_scTlEnvAt(env, c.in))]];
  const dots = [];
  env.forEach((p, k) => {
    if (p.t < c.in - 1e-3 || p.t > c.in + c.len + 1e-3) return;
    const x = ((p.t - c.in) * pps).toFixed(1);
    pts.push([x, y(p.g)]);
    dots.push(`<circle data-kf="${k}" cx="${x}" cy="${y(p.g)}" r="4"><title>${Math.round(p.g * vol * 100)}%</title></circle>`);
  });
  pts.push([w.toFixed(1), y(_scTlEnvAt(env, c.in + c.len))]);
  const d = pts.map((p) => p.join(",")).join(" ");
  svg.setAttribute("viewBox", `0 0 ${w.toFixed(1)} ${h}`);
  svg.innerHTML = `<polyline class="sc-tl-env-line" points="${d}"/><polyline class="sc-tl-env-hit" data-env points="${d}"><title>Kéo để chỉnh âm lượng · Ctrl + bấm để thêm điểm</title></polyline>${dots.join("")}`;
}

// ── Thẻ nổi neo trên dòng thời gian ──
// Neo vào một chấm vô hình đặt đúng chỗ bấm trên khối (khối nhạc trải cả slide, neo giữa khối là
// thẻ nằm tít ngoài khung nhìn); `sel` để tìm lại khối sau mỗi lần vẽ lại.
function _scTlOpenAt(pop, el, clientX, sel) {
  if (!pop?.open) return;
  el.querySelector(":scope > .sc-vo-pin")?.remove();
  const pin = document.createElement("i");
  pin.className = "sc-vo-pin";
  const r = el.getBoundingClientRect();
  const off = Math.max(8, Math.min(r.width - 8, clientX - r.left));
  pin.style.left = `${off}px`;
  el.appendChild(pin);
  _scTlPin = { pop, sel, off };
  pop.open(pin);
}
function _scTlPlacePops() {
  _scEl("sc-vo-act")?.place?.();
}

// Thanh của clip: hàng việc của clip (To dần · Nhỏ dần · Tách · Nhân bản · Thu lại · Thay thế · Xoá —
// nhạc nền chỉ có phần dùng được cho một bài lặp) + phần việc của TRACK chứa clip. Bấm biểu tượng / tên
// ở đầu track (kể cả track chưa có clip) cũng mở thanh này nhưng chỉ phần track.
let _scVoActId = "";
let _scVoActTrk = "";
function _scVoActOpen(clipEl, clientX) {
  const pop = _scEl("sc-vo-act");
  if (!pop) return;
  _scVoActId = clipEl.dataset.clip;
  _scVoActAddFill("");
  const mu = _scVoActId === _SC_VO_MU;
  _scVoActTrk = mu ? "music" : _scVoClip(_scVoActId)?.track || "";
  pop.querySelectorAll("[data-voice-only]").forEach((b) => b.classList.toggle("hidden", mu));
  pop.querySelector('[data-act-sec="clip"]')?.classList.remove("hidden");
  _scVoFadeLabels();
  _scVoActTrkFill();
  _scTlOpenAt(pop, clipEl, clientX, `[data-clip="${CSS.escape(_scVoActId)}"]`);
}
function _scVoActOpenTrack(btn, id) {
  const pop = _scEl("sc-vo-act");
  if (!pop || !_scTlTrk(id)) return;
  if (pop.isOpen && !_scVoActId && _scVoActTrk === id) return pop.close();
  _scVoActId = "";
  _scVoActTrk = id;
  pop.querySelector('[data-act-sec="clip"]')?.classList.add("hidden");
  _scVoActAddFill(id);
  _scVoActTrkFill();
  _scTlPin = { pop, sel: `[data-trk-menu="${CSS.escape(id)}"]`, btn: true };
  pop.open(btn);
}
// Hàng Thêm của thanh (chỉ khi mở từ ô đầu track): nguồn âm thanh theo loại track — cùng các mục
// của popover #sc-tl-add (_scTlAddItems). id rỗng = ẩn hàng (thanh mở từ clip).
function _scVoActAddFill(id) {
  const row = _scEl("sc-vo-act-add");
  if (!row) return;
  row.classList.toggle("hidden", !id);
  row.innerHTML = id ? _scTlAddItems(id) : "";
  if (id) window.lucide?.createIcons({ root: row });
}
_scEl("sc-vo-act-add")?.addEventListener("click", (e) => {
  const act = e.target.closest("[data-add-act]")?.dataset.addAct;
  if (act) _scTlAddDo(act, _scVoActTrk);
});
// Phần track của thanh: [tên (gõ để đổi) · âm lượng] rồi hàng nút Tắt tiếng · Solo · Khoá (bật/tắt,
// thanh giữ mở) · Lên · Xuống · Xoá track. Nhạc nền: tên cố định, không có thứ tự / xoá track.
function _scVoActTrkFill() {
  const box = _scEl("sc-vo-act-trk");
  const id = _scVoActTrk;
  const t = _scTlTrk(id);
  if (!box) return;
  if (!t) return void (box.innerHTML = "");
  const music = id === "music";
  const i = _scTlIdx(id);
  const v = _scTlVolPct(t);
  const btn = (act, icon, label, opt = {}) =>
    `<button type="button" class="sc-vo-act-btn${opt.on ? " is-on" : ""} is-${act}" data-trk-act="${act}"${opt.keep ? " data-keep-open" : ""}${opt.on != null ? ` aria-pressed="${opt.on}"` : ""}${opt.dis ? " disabled" : ""}><span class="sc-vo-act-ico">${_scIco(icon)}</span>${label}</button>`;
  box.innerHTML = `<div class="sc-vo-act-th">
      ${
        music
          ? `<span class="sc-vo-act-name is-fixed">Nhạc nền</span>`
          : `<input id="sc-vo-act-name" class="sc-vo-act-name" value="${_scEsc(t.name)}" maxlength="40" aria-label="Tên track" title="Đổi tên track" />`
      }
      <label class="sc-vo-act-vol" title="Âm lượng track">
        ${_scIco("volume-2")}
        <input id="sc-vo-act-vol" type="range" class="sc-vo-act-volr" min="0" max="100" step="5" value="${v}" style="--p: ${v}%" aria-label="Âm lượng track" />
        <output id="sc-vo-act-vol-v">${v}%</output>
      </label>
    </div>
    <div class="sc-vo-act-row">
      ${btn("mute", t.mute ? "volume-x" : "volume-2", "Tắt tiếng", { on: !!t.mute, keep: true })}
      ${btn("solo", "headphones", "Solo", { on: !!t.solo, keep: true })}
      ${btn("lock", t.lock ? "lock" : "lock-open", "Khoá", { on: !!t.lock, keep: true })}
      ${
        music
          ? ""
          : btn("up", "arrow-up", "Lên", { dis: i <= 0 }) +
            btn("down", "arrow-down", "Xuống", { dis: i >= _scVo.tracks.length - 1 }) +
            btn("del", "trash-2", "Xoá track")
      }
    </div>`;
  window.lucide?.createIcons({ root: box });
  const range = box.querySelector("#sc-vo-act-vol");
  range.addEventListener("input", () => {
    if (_scTlVolInput(id, range)) box.querySelector("#sc-vo-act-vol-v").textContent = `${range.value}%`;
  });
  range.addEventListener("change", _scTlVolDone);
  const name = box.querySelector("#sc-vo-act-name");
  if (name) {
    name.addEventListener("change", () => {
      const val = name.value.trim();
      const cur = _scVoTrack(id);
      if (!cur) return;
      if (val && val !== cur.name) _scTlTrackSet(id, { name: val }, "Đổi tên track");
      else name.value = cur.name;
    });
    name.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Enter") name.blur();
      if (e.key === "Escape") {
        name.value = _scVoTrack(id)?.name || "";
        name.blur();
      }
    });
  }
}
_scEl("sc-vo-act-trk")?.addEventListener("click", (e) => {
  const act = e.target.closest("[data-trk-act]")?.dataset.trkAct;
  const id = _scVoActTrk;
  const t = _scTlTrk(id);
  if (!act || !t) return;
  if (act === "mute" || act === "solo" || act === "lock") return _scTlTrackToggle(id, act);
  if (act === "up") return _scTlTrackMove(id, -1);
  if (act === "down") return _scTlTrackMove(id, 1);
  if (act === "del") return _scTlTrackDel(id);
});
// Nấc giây của nút To dần / Nhỏ dần (bấm là sang nấc kế, hết vòng về 0 = tắt).
const _SC_VO_FADES = [0, 0.5, 1, 1.5, 2, 3, 5];
function _scVoFadeLabels() {
  const c = _scVoClip(_scVoActId);
  _scEl("sc-vo-act")
    ?.querySelectorAll("[data-fade-v]")
    .forEach((el) => {
      const v = Number(c?.[el.dataset.fadeV]) || 0;
      el.textContent = v > 0 ? `${String(Math.round(v * 10) / 10).replace(".", ",")} giây` : "Tắt";
    });
}
_scEl("sc-vo-act")?.addEventListener("click", (e) => {
  const act = e.target.closest("[data-act]")?.dataset.act;
  const id = _scVoActId;
  if (!act || !id || _scVoBusy() || _scVoRec) return;
  const c = _scVoClip(id);
  if (!c) return;
  if (_scTlLocked(id)) return _scTlToast("Track đang khoá, mở khoá rồi hãy sửa.", "warning");
  if (act === "fi" || act === "fo") {
    const cur = Number(c[act]) || 0;
    const next = _SC_VO_FADES.find((v) => v > cur + 1e-6) ?? 0;
    _scTlDo(act === "fi" ? "To dần" : "Nhỏ dần", () => (c[act] = next));
    _scVoSave();
    _scVoSend();
    _scVoPlace(c);
    return _scVoFadeLabels();
  }
  if (act === "split") return _scTlSplit([id]);
  if (act === "dup") return _scTlDup([id]);
  if (act === "rerec") return scVoiceRecord(id);
  if (act === "replace") return id === _SC_VO_MU ? scMusicPick() : scVoiceReplace(id);
  if (act === "delete") {
    if (id === _SC_VO_MU) return _scTlMusicClear();
    _scTlSelectOnly([id]);
    return _scTlDelete(false);
  }
});

// Bỏ nhạc nền (Delete trên khối nhạc / nút trong thanh tuỳ chọn) — hoàn tác trả lại được cả bài.
async function _scTlMusicClear() {
  _scTlSel.delete(_SC_VO_MU);
  await scMusicClear();
  if (!_scMu.pick) _scTlToast("Đã bỏ nhạc nền. Ctrl+Z để hoàn tác.");
}

// ── Thao tác trên clip ──
const _scTlRoomClips = (n) => {
  if (_scVo.clips.length + n <= _SC_VO_CLIPS) return true;
  _scTlToast(`Dòng thời gian đã có ${_SC_VO_CLIPS} clip, xoá bớt rồi làm tiếp nhé.`, "warning");
  return false;
};
const _scTlEditable = (ids) => ids.filter((id) => id !== _SC_VO_MU && !_scTlLocked(id)).map(_scVoClip).filter(Boolean);
function _scTlCommit() {
  _scVoSave();
  _scVoSend();
  _scVoRender();
}

// Xoá clip đang chọn; `ripple` = dồn các clip phía sau CÙNG track lên lấp chỗ trống (Shift+Delete).
function _scTlDelete(ripple) {
  if (_scVoBusy() || _scVoRec) return;
  const list = _scTlEditable([..._scTlSel]);
  if (!list.length) {
    if ([..._scTlSel].some((id) => id !== _SC_VO_MU && _scTlLocked(id))) return _scTlToast("Track đang khoá, mở khoá rồi hãy xoá.", "warning");
    if (_scTlSel.has(_SC_VO_MU)) return _scTlMusicClear();
    if (_scTlScene >= 0) return _scVoSceneDel(_scTlScene);
    return;
  }
  _scTlDo(ripple ? "Xoá kéo theo" : "Xoá clip", () => {
    const gone = new Set(list.map((c) => c.id));
    if (ripple) {
      list
        .slice()
        .sort((a, b) => b.start - a.start)
        .forEach((c) =>
          _scVo.clips.forEach((o) => {
            if (o.track === c.track && !gone.has(o.id) && o.start >= c.start + c.len - 1e-3) o.start = Math.max(0, o.start - c.len);
          }),
        );
    }
    _scVo.clips = _scVo.clips.filter((c) => !gone.has(c.id));
  });
  _scTlSel = new Set([..._scTlSel].filter((id) => id === _SC_VO_MU));
  _scTlCommit();
  _scTlToast(`Đã xoá ${list.length} clip. Ctrl+Z để hoàn tác.`);
}

// Tách clip tại đầu phát (C / Ctrl+K): clip đang chọn nằm qua đầu phát; chưa chọn gì thì mọi clip
// nằm qua đầu phát trên các track không khoá. Hai nửa dùng chung file, đường âm lượng giữ nguyên.
function _scTlSplit(ids) {
  if (_scVoBusy() || _scVoRec) return;
  const at = _scVoNow();
  const pool = ids?.length ? _scTlEditable(ids) : _scTlSel.size ? _scTlEditable([..._scTlSel]) : _scTlEditable(_scVo.clips.map((c) => c.id));
  const hit = pool.filter((c) => at > c.start + 0.05 && at < c.start + c.len - 0.05);
  if (!hit.length) return _scTlToast("Đưa đầu phát vào giữa một clip rồi hãy tách.", "info");
  if (!_scTlRoomClips(hit.length)) return;
  const right = [];
  _scTlDo("Tách clip", () =>
    hit.forEach((c) => {
      const cut = at - c.start;
      const r = { ..._scVoClipMeta(c), id: _scVoId(), start: at, in: c.in + cut, len: c.len - cut, fi: 0 };
      c.len = cut;
      c.fo = 0;
      _scVo.clips.push(r);
      right.push(r.id);
    }),
  );
  _scTlSel = new Set([...hit.map((c) => c.id), ...right]);
  _scTlCommit();
}

// Nhân bản (Ctrl+D): bản sao đặt ngay sau cụm đang chọn, cùng track; chỗ đó bận thì chỗ trống gần
// nhất, hết chỗ thì track mới.
function _scTlDup(ids) {
  if (_scVoBusy() || _scVoRec) return;
  const list = _scTlEditable(ids || [..._scTlSel]);
  if (!list.length || !_scTlRoomClips(list.length)) return;
  const from = Math.min(...list.map((c) => c.start));
  const to = Math.max(...list.map((c) => c.start + c.len));
  const made = [];
  _scTlDo("Nhân bản", () => {
    list.forEach((c) => {
      const n = { ..._scVoClipMeta(c), id: _scVoId(), start: c.start + (to - from) };
      _scVo.clips.push(n);
      made.push(n);
    });
    _scTlSettle(made);
  });
  _scTlSel = new Set(made.map((c) => c.id));
  _scTlCommit();
}
// Clip đè lên clip khác (sau khi thả / dán / nhân bản) → dời tới chỗ trống gần nhất trên track đó;
// không còn chỗ thì xuống một track mới.
// Xếp lần lượt theo thời gian: clip đã xếp thành vật cản cho clip sau, clip chưa xếp thì bỏ qua.
function _scTlSettle(list) {
  const pending = new Set(list.map((c) => c.id));
  list
    .slice()
    .sort((a, b) => a.start - b.start)
    .forEach((c) => {
    pending.delete(c.id);
    const skip = new Set([...pending, c.id]);
    if (_scTlFree(c.track, c.start, c.len, skip)) return;
    const g = _scTlGap(c.track, c.start, c.len, skip);
    if (g != null) return (c.start = g);
    const t = _scVoTrackAdd(_scTlIdx(c.track) + 1);
    if (t) c.track = t.id;
    });
}

// Sao chép / cắt / dán (Ctrl+C / X / V): dán ở đầu phát, giữ khoảng cách + thứ tự track giữa các
// clip, bắt đầu từ track của clip đang chọn (không chọn gì thì track cũ).
function _scTlCopy(cut) {
  const list = _scTlEditable([..._scTlSel]);
  if (!list.length) return;
  const base = Math.min(...list.map((c) => c.start));
  const top = Math.min(...list.map((c) => _scTlIdx(c.track)));
  _scTlCb = list.map((c) => ({ meta: _scVoClipMeta(c), dt: c.start - base, dtrk: _scTlIdx(c.track) - top, top }));
  if (cut) _scTlDelete(false);
  else _scTlToast(`Đã chép ${list.length} clip. Đưa đầu phát tới chỗ cần dán rồi bấm Ctrl+V.`, "info");
}
function _scTlPaste() {
  if (_scVoBusy() || _scVoRec || !_scTlCb?.length) return;
  const items = _scTlCb.filter((x) => _scVo.srcs.has(x.meta.src));
  if (!items.length || !_scTlRoomClips(items.length)) return;
  const at = Math.min(_scVoNow(), Math.max(0, _scVoTotal() - _SC_TL_MIN));
  const sel = _scTlEditable([..._scTlSel])[0];
  let top = sel ? _scTlIdx(sel.track) : items[0].top;
  const made = [];
  _scTlDo("Dán", () => {
    items.forEach((x) => {
      let k = Math.max(0, top) + x.dtrk;
      while (k >= _scVo.tracks.length && _scVoTrackAdd()) {}
      k = Math.min(k, _scVo.tracks.length - 1);
      const n = { ...x.meta, env: _scVoEnvCopy(x.meta.env), id: _scVoId(), start: at + x.dt, track: _scVo.tracks[k].id };
      _scVo.clips.push(n);
      made.push(n);
    });
    _scTlSettle(made);
  });
  _scTlSel = new Set(made.map((c) => c.id));
  _scTlCommit();
}

// Nhích cụm đang chọn d giây (Alt + ← →; khối đang focus: ← →). Đụng clip khác thì đứng lại.
function _scTlNudge(d) {
  if (_scVoBusy() || _scVoRec) return;
  const ids = [..._scTlSel].filter((id) => !_scTlLocked(id));
  const list = ids.map(_scVoClip).filter(Boolean);
  if (!list.length) return;
  const group = new Set(ids);
  const total = _scVoTotal();
  const lo = -Math.min(...list.map((c) => c.start));
  const hi = Math.max(0, total - _SC_TL_MIN) - Math.max(...list.map((c) => c.start));
  d = Math.max(lo, Math.min(hi, d));
  // Đụng clip khác thì chỉ nhích tới sát mép nó.
  list.forEach((c) => {
    if (c.id === _SC_VO_MU) return;
    const on = _scTlOn(c.track, group);
    const room =
      d > 0
        ? Math.min(Infinity, ...on.filter((o) => o.start >= c.start + c.len - 1e-3).map((o) => o.start - c.start - c.len))
        : Math.min(Infinity, ...on.filter((o) => o.start + o.len <= c.start + 1e-3).map((o) => c.start - o.start - o.len));
    d = Math.sign(d) * Math.max(0, Math.min(Math.abs(d), room));
  });
  if (Math.abs(d) < 1e-3) return _scTlToast("Clip đã sát clip bên cạnh.", "info");
  _scTlDo("Nhích clip", () =>
    list.forEach((c) => {
      c.start += d;
      if (c.id === _SC_VO_MU) c.full = c.start + c.len >= total - 0.05;
    }),
  );
  _scVoSave();
  _scVoSend();
  list.forEach(_scVoPlace);
  _scTlPlacePops();
}

// ── Track ──
const _scTlTrk = (id) => (id === "music" ? _scVo.mtr : _scVoTrack(id));
function _scTlTrackSet(id, patch, label) {
  const t = _scTlTrk(id);
  if (!t || _scVoBusy()) return;
  _scTlDo(label, () => Object.assign(t, patch));
  _scTlCommit();
}
// Bật/tắt Tắt tiếng · Solo · Khoá — dùng chung cho thanh #sc-vo-act và nút nhanh ở cột đầu (màn rộng).
function _scTlTrackToggle(id, act) {
  const t = _scTlTrk(id);
  if (!t) return;
  const on = !t[act];
  const label = { mute: on ? "Tắt tiếng track" : "Bật tiếng track", solo: on ? "Solo track" : "Bỏ solo", lock: on ? "Khoá track" : "Mở khoá track" }[act];
  _scTlTrackSet(id, { [act]: on }, label);
  if (_scEl("sc-vo-act")?.isOpen && !_scVoActId && _scVoActTrk === id) _scVoActTrkFill();
}
// Nút nhanh ở cột đầu track (màn rộng).
function _scTlQuick(q, id) {
  if (q === "mute" || q === "solo" || q === "lock") return _scTlTrackToggle(id, q);
  if (id !== "music" && id && _scVoTrack(id)?.lock && (q === "file" || q === "rec")) return _scTlToast("Track đang khoá, mở khoá rồi hãy thêm.", "warning");
  _scTlAddDo(q, id);
}
function _scTlTrackMove(id, d) {
  const i = _scTlIdx(id);
  const j = i + d;
  if (i < 0 || j < 0 || j >= _scVo.tracks.length) return;
  _scTlDo("Đổi thứ tự track", () => {
    const [t] = _scVo.tracks.splice(i, 1);
    _scVo.tracks.splice(j, 0, t);
  });
  _scTlCommit();
}
function _scTlTrackDel(id) {
  if (_scVoBusy() || _scVoRec) return;
  const t = _scVoTrack(id);
  if (!t) return;
  const n = _scVo.clips.filter((c) => c.track === id).length;
  _scTlDo("Xoá track", () => {
    _scVo.clips = _scVo.clips.filter((c) => c.track !== id);
    _scVo.tracks = _scVo.tracks.filter((x) => x.id !== id);
  });
  _scTlSel = new Set([..._scTlSel].filter((x) => x === _SC_VO_MU || _scVo.clips.some((c) => c.id === x)));
  _scTlCommit();
  _scTlToast(`Đã xoá "${t.name}"${n ? ` cùng ${n} clip` : ""}. Ctrl+Z để hoàn tác.`);
}
// Kéo thanh âm lượng track: cả lượt kéo là MỘT bước hoàn tác; không vẽ lại bảng giữa lúc kéo.
function _scTlVolInput(id, range) {
  const t = _scTlTrk(id);
  if (!t || _scVoBusy()) return false;
  if (!_scTlVolBusy) {
    _scTlVolBusy = true;
    _scTlBegin();
  }
  t.vol = Number(range.value) / 100;
  _scRangeFill(range);
  _scVoSave();
  _scVoSend();
  return true;
}
function _scTlVolDone() {
  if (!_scTlVolBusy) return;
  _scTlVolBusy = false;
  _scTlEnd("Âm lượng track");
  _scVoRender(); // dòng trạng thái ở đầu track hiện mức mới
}
let _scTlVolBusy = false;
// Popover Thêm (ô của hàng Track mới) + hàng Thêm của thanh #sc-vo-act: nguồn âm thanh theo loại
// track — Nhạc nền: tải lên · thư viện; track giọng đọc / Track mới (id rỗng): tải lên · ghi âm
// (vào track đó, từ đầu phát).
let _scTlAddId = "";
function _scTlAddItems(id) {
  const item = (act, icon, label, tip) =>
    `<button type="button" class="sc-vo-act-btn is-${act}" data-add-act="${act}" title="${tip}"><span class="sc-vo-act-ico">${_scIco(icon)}</span>${label}</button>`;
  return id === "music"
    ? item("file", "upload", "Tải lên", "Chọn file nhạc trên máy (mp3, m4a, wav)") + item("lib", "list-music", "Thư viện", "Chọn bài có sẵn trong thư viện nhạc")
    : item("file", "upload", "Tải lên", "Chọn file âm thanh trên máy") +
        item("rec", "mic", "Ghi âm", "Thu giọng ngay, bắt đầu từ đầu phát") +
        (id ? "" : item("empty", "plus", "Track trống", "Thêm một track rỗng để kéo clip vào sau"));
}
// Thêm một track giọng đọc rỗng ở cuối (hàng Track mới → "Track trống").
function _scTlTrackNew() {
  if (_scVoBusy() || _scVoRec) return;
  if (_scVo.tracks.length >= _SC_VO_TRACKS) return _scTlToast(`Tối đa ${_SC_VO_TRACKS} track giọng đọc.`, "warning");
  _scEl("sc-tl-add")?.close?.();
  const t = _scTlDo("Thêm track", () => _scVoTrackAdd());
  _scTlCommit();
  if (t) _scTlToast(`Đã thêm "${t.name}".`);
}
function _scTlAddDo(act, id) {
  if (id === "music") return act === "lib" ? scMusicLibOpen(true) : scMusicPick();
  if (act === "file") return id ? scVoicePick(_scVoNow(), id) : scVoicePick(_scVoNow());
  if (act === "rec") return scVoiceRecord("", id);
  if (act === "empty") return _scTlTrackNew();
}
function _scTlAddMenu(btn, id) {
  const pop = _scEl("sc-tl-add");
  if (!pop) return;
  if (pop.isOpen && _scTlAddId === id) return pop.close();
  _scTlAddId = id;
  pop.innerHTML = _scTlAddItems(id);
  window.lucide?.createIcons({ root: pop });
  _scTlPin = { pop, sel: `[data-trk-add="${CSS.escape(id)}"]`, btn: true };
  pop.open(btn);
}
_scEl("sc-tl-add")?.addEventListener("click", (e) => {
  const act = e.target.closest("[data-add-act]")?.dataset.addAct;
  if (act) _scTlAddDo(act, _scTlAddId);
});

// ── Track Cảnh ──
// Về tab Cảnh, mở cảnh i rồi cuộn bảng tới đó (không lấy focus để phím tắt dòng thời gian vẫn ăn).
function _scTlFocusScene(i) {
  scTab("scenes");
  const li = _scOpenScene(i);
  const smooth = !matchMedia("(prefers-reduced-motion: reduce)").matches;
  li?.scrollIntoView({ block: "nearest", behavior: smooth ? "smooth" : "auto" });
}
function _scTlSceneSelect(i) {
  _scTlScene = i;
  if (i >= 0) _scTlSel = new Set();
  _scTlMark();
}
function _scVoSceneDel(i) {
  _scEl("sc-vo-scene")?.close?.();
  _scTlScene = -1;
  scSceneDelete(i);
}
_scEl("sc-vo-scene")?.addEventListener("click", (e) => {
  const act = e.target.closest("[data-scene-act]")?.dataset.sceneAct;
  const i = _scTlScene;
  if (!act || i < 0) return;
  if (act === "delete") return _scVoSceneDel(i);
  if (act === "tr") {
    const mark = _scTlBox()?.querySelector(`[data-tr="${i}"]`);
    if (mark) return setTimeout(() => _scTlTrOpen(mark, i));
    return _scTlToast("Cảnh đầu tiên không có chuyển cảnh vào.", "info");
  }
  scTab("scenes");
  _scOpenScene(i)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
});
// Đổi thứ tự: cảnh `from` sang trước mốc nối `to` (0..số cảnh) — lưu cả dãy id vào timing.order.
function _scTlSceneMove(from, to) {
  if (_scTimeBusy()) return;
  const ids = _scCues.map((c) => c.id);
  const k = to > from ? to - 1 : to;
  if (k === from) return;
  const [id] = ids.splice(from, 1);
  ids.splice(k, 0, id);
  _scTlDo("Đổi thứ tự cảnh", () => {
    const own = _scTiming();
    own.order = ids;
    _scTimingSave(own);
  });
  _scTlScene = k;
}
// Kiểu chuyển vào cảnh i (dấu thoi ở chỗ nối): "Mặc định" = theo mẫu.
let _scTlTrI = -1;
function _scTlTrOpen(mark, i) {
  const pop = _scEl("sc-tl-tr");
  const c = _scCues[i];
  if (!pop || !c) return;
  _scTlTrI = i;
  const cur = c.tr || "fade";
  const own = _scTiming().tr?.[c.id];
  const row = (v, label, icon, on) =>
    `<button type="button" class="x-pop-item${on ? " is-active" : ""}" role="menuitemradio" aria-checked="${on}" data-tr-v="${v}"><span class="x-pop-ico">${_scIco(icon)}</span><span>${label}</span></button>`;
  pop.innerHTML = `<p class="sc-tl-pop-h">Chuyển vào "${_scEsc(c.label)}"</p>
    ${row("", `Mặc định của mẫu (${_SC_TL_TR[c.tr0 || "fade"]?.[0] || c.tr0})`, "sparkles", !own)}
    <div class="x-pop-sep"></div>
    ${Object.entries(_SC_TL_TR)
      .map(([v, [label, icon]]) => row(v, label, icon, !!own && cur === v))
      .join("")}`;
  window.lucide?.createIcons({ root: pop });
  _scTlOpenAt(pop, mark, mark.getBoundingClientRect().left + mark.offsetWidth / 2, `[data-tr="${i}"]`);
}
_scEl("sc-tl-tr")?.addEventListener("click", (e) => {
  const b = e.target.closest("[data-tr-v]");
  const c = _scCues[_scTlTrI];
  if (!b || !c || _scTimeBusy()) return;
  const v = b.dataset.trV;
  _scTlDo("Đổi chuyển cảnh", () => {
    const own = _scTiming();
    const tr = { ...(own.tr || {}) };
    if (v) tr[c.id] = v;
    else delete tr[c.id];
    own.tr = tr;
    _scTimingSave(own);
  });
  c.tr = v || c.tr0;
  _scVoRender();
});

// ── Hút vào mốc ──
// Mốc: 0, hết slide, đầu phát, đầu các cảnh, hai mép các clip khác (trừ `skip`) — trong vòng 8px.
function _scTlSnapT(t, skip) {
  if (!_scTlSnap) return t;
  const pps = _scVoPx();
  const marks = [0, _scVoTotal(), _scVoNow(), ..._scVoSceneStarts()];
  _scVo.clips.forEach((c) => !skip?.has(c.id) && marks.push(c.start, c.start + c.len));
  const mu = _scVoMuClip();
  if (mu && !skip?.has(_SC_VO_MU)) marks.push(mu.start, mu.start + mu.len);
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
function scTlSnap() {
  _scTlSnap = !_scTlSnap;
  _scVoRender();
  _scTlToast(`Hút vào mốc: ${_scTlSnap ? "bật" : "tắt"}`, "info");
}

// ── Nhãn giờ chạy theo con trỏ lúc kéo ──
function _scTlTip(x, y, text) {
  let tip = _scEl("sc-tl-tip");
  if (!tip) {
    tip = document.createElement("div");
    tip.id = "sc-tl-tip";
    tip.className = "sc-tl-tip";
    tip.setAttribute("aria-hidden", "true");
    document.body.appendChild(tip);
  }
  if (text == null) return tip.classList.remove("is-on");
  tip.textContent = text;
  tip.style.left = `${Math.round(x)}px`;
  tip.style.top = `${Math.round(y)}px`;
  tip.classList.add("is-on");
}
const _scTlSign = (d) => `${d < 0 ? "−" : "+"}${_scVoFmt(Math.abs(d))}`;

// ── Đầu phát ──
function _scVoTime(m) {
  _scVoT = { t: Number(m.t) || 0, total: Number(m.total) || 0, playing: !!m.playing, at: performance.now() };
  _scEl("sc-vo-bar")?.classList.toggle("is-playing", _scVoT.playing);
  // Đang thu mà slide chạy tới cuối thì dừng thu.
  const total = _scVoTotal();
  if (_scVoRec?.phase === "rec" && total && _scVoT.t >= total - 0.15) _scVoRecStop();
}
const _scTlSeek = (t) => {
  t = Math.max(0, Math.min(_scVoTotal(), t));
  _scVoT = { ..._scVoT, t, playing: false, at: performance.now() };
  _scVoSeek(t, true);
};
function _scVoLoop() {
  if (_scTlRaf) return;
  const step = () => {
    const box = _scTlBox();
    if (!_scVoShown(box)) {
      _scTlRaf = 0;
      return;
    }
    const t = _scVoNow();
    const pps = _scVoPx();
    const ph = box.querySelector(".sc-vo-ph");
    if (ph) {
      ph.style.transform = `translateX(${(t * pps).toFixed(1)}px)`;
      // Cuộn quá đầu phát thì giấu, không thì nó vẽ đè lên cột tên track ghim bên trái.
      ph.style.visibility = t * pps < box.scrollLeft - 1 ? "hidden" : "";
    }
    const now = _scEl("sc-vo-now");
    if (now) now.textContent = _scVoFmt(t);
    const R = _scVoRec;
    if (R?.phase === "rec") {
      const lv = box.querySelector(".sc-vo-live");
      if (lv) lv.style.width = `${Math.max(2, ((performance.now() - R.at) / 1000) * pps).toFixed(1)}px`;
      _scVoRecLabel();
    }
    // Đang kéo mà con trỏ chạm sát mép khung thì tự cuộn cả dòng thời gian về phía đó, rồi áp lại
    // thao tác ở đúng chỗ con trỏ.
    const D = _scTlD;
    if (D?.moved && D.x != null) {
      const r = box.getBoundingClientRect();
      const left = r.left + _scVoHead(box);
      const zone = 48;
      const v = D.x < left + zone ? D.x - (left + zone) : D.x > r.right - zone ? D.x - (r.right - zone) : 0;
      const before = box.scrollLeft;
      if (v) box.scrollLeft = before + Math.max(-28, Math.min(28, v * 0.45));
      if (box.scrollLeft !== before) _scTlMove({ clientX: D.x, clientY: D.y });
    } else if (_scVoT.playing || Math.abs(t - _scTlLastT) > 0.05) {
      // Đầu phát chạy (đang phát) hay vừa nhảy mà ra khỏi khung nhìn thì cuộn theo; đứng yên thì
      // để khách tự cuộn xem chỗ khác.
      const x = t * pps;
      const vis = box.clientWidth - _scVoHead(box);
      if (x < box.scrollLeft || x > box.scrollLeft + vis - 24) box.scrollLeft = Math.max(0, x - vis * 0.2);
    }
    _scTlLastT = t;
    _scTlRaf = requestAnimationFrame(step);
  };
  _scTlRaf = requestAnimationFrame(step);
}

// ── Kéo trên dòng thời gian ──
// Bấm khối = chọn (Shift / Ctrl: thêm / bớt); kéo thân = dời cả cụm đang chọn, kể cả sang track khác
// (Alt: kéo ra bản sao); kéo mép = cắt; kéo tay nắm góc trên = fade; dây / điểm âm lượng; kéo thước =
// tua; kéo vùng trống của track = khung chọn; kéo khối cảnh = đổi thứ tự, mép phải = thời lượng.
const _SC_TL_MOVE_PX = 4;
function _scTlDown(e) {
  if (e.button > 0 || _scVoRec) return;
  const box = _scTlBox();
  const tg = e.target;
  _scTlTap = null;
  if (tg.closest("button, input")) return;
  // Kéo chặn focus mặc định — tự đưa focus về khung để phím tắt dòng thời gian ăn ngay (con trỏ còn
  // ở bảng chỉnh bên phải thì phím mũi tên / Delete thuộc về bảng chỉnh).
  box.focus({ preventScroll: true });
  const clipEl = tg.closest("[data-clip]");
  const base = { x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, sl0: box.scrollLeft, moved: false, pid: e.pointerId };
  if (clipEl) return _scTlDownClip(e, clipEl, base);
  const sedge = tg.closest("[data-sedge]");
  const seg = tg.closest("[data-scene]");
  if (sedge || seg) {
    const i = Number((sedge || seg).dataset.sedge ?? seg.dataset.scene);
    const c = _scCues[i];
    if (!c) return;
    e.preventDefault();
    box.setPointerCapture(e.pointerId);
    if (sedge) _scTlD = { ...base, mode: "sdur", i, d0: c.dur / 1000 };
    else {
      _scTlD = { ...base, mode: "scene", i };
      _scTlTap = { kind: "scene", i, x: e.clientX };
    }
    return;
  }
  if (tg.closest("[data-scrub]")) {
    e.preventDefault();
    box.setPointerCapture(e.pointerId);
    _scTlD = { ...base, mode: "scrub", moved: true };
    return _scTlMove(e);
  }
  const lane = tg.closest("[data-lane]");
  if (!lane || lane.matches(".is-add") || e.pointerType !== "mouse") return;
  // Vùng trống của track: kéo = khung chọn, bấm = bỏ chọn.
  e.preventDefault();
  box.setPointerCapture(e.pointerId);
  _scTlD = { ...base, mode: "marq", keep: e.shiftKey || e.ctrlKey || e.metaKey ? new Set(_scTlSel) : new Set() };
}
function _scTlDownClip(e, el, base) {
  const box = _scTlBox();
  const id = el.dataset.clip;
  const c = _scVoClip(id);
  if (!c) return;
  const tg = e.target;
  const kf = tg.closest("[data-kf]");
  const env = tg.closest("[data-env]");
  const mod = e.ctrlKey || e.metaKey;
  _scTlScene = -1;
  // Shift / Ctrl + bấm thân khối: thêm / bớt khỏi cụm chọn, không kéo.
  if ((e.shiftKey || (mod && !env)) && !kf) {
    if (_scTlSel.has(id)) _scTlSel.delete(id);
    else _scTlSel.add(id);
    _scTlMark();
    e.preventDefault();
    return;
  }
  if (!_scTlSel.has(id)) _scTlSelectOnly([id]);
  else _scTlMark();
  _scTlTap = { kind: "clip", id, x: e.clientX };
  if (_scTlLocked(id) || _scExState === "run") return;
  e.preventDefault();
  box.setPointerCapture(e.pointerId);
  const h = el.clientHeight;
  const pad = _SC_TL_ENV_PAD;
  const gAt = (y) => Math.min(1, Math.max(0, 1 - (y - el.getBoundingClientRect().top - pad) / (h - 2 * pad)) / (c.vol || 1));
  if (kf) {
    const k = Number(kf.dataset.kf);
    _scTlD = { ...base, mode: "kf", id, c, p: c.env[k], gAt, el };
    return;
  }
  if (env && mod) {
    // Ctrl + bấm dây: thêm điểm đúng chỗ bấm rồi kéo luôn điểm đó.
    const r = el.getBoundingClientRect();
    const t = c.in + (e.clientX - r.left) / _scVoPx();
    _scTlBegin();
    const p = { t, g: _scTlEnvAt(c.env, t) };
    c.env = [...(c.env || []), p].sort((a, b) => a.t - b.t);
    _scTlD = { ...base, mode: "kf", id, c, p, gAt, el, open: true, moved: true };
    _scTlTap = null;
    _scVoPlace(c);
    _scVoSend();
    return;
  }
  if (env) {
    _scTlD = { ...base, mode: "env", id, c, env0: c.env?.length ? _scVoEnvCopy(c.env) : [{ t: c.in, g: 1 }], h: h - 2 * pad };
    return;
  }
  const fh = tg.closest("[data-fh]")?.dataset.fh;
  if (fh) {
    _scTlD = { ...base, mode: "fade", id, c, which: fh, el };
    return;
  }
  const edge = tg.closest("[data-edge]")?.dataset.edge || "";
  if (edge) {
    _scTlD = { ...base, mode: "trim", id, c, edge, s0: { start: c.start, in: c.in, len: c.len }, ids: [id] };
    return;
  }
  const ids = [..._scTlSel].filter((x) => !_scTlLocked(x) && _scVoClip(x));
  _scTlD = { ...base, mode: "move", id, c, ids, dup: e.altKey, s0: new Map(ids.map((x) => [x, { start: _scVoClip(x).start, track: _scVoClip(x).track }])), made: [] };
}

function _scTlMove(e) {
  const D = _scTlD;
  if (!D) return;
  const box = _scTlBox();
  D.x = e.clientX;
  D.y = e.clientY;
  const dx = e.clientX - D.x0 + (box.scrollLeft - D.sl0);
  if (!D.moved && Math.abs(e.clientX - D.x0) < _SC_TL_MOVE_PX && Math.abs(e.clientY - D.y0) < _SC_TL_MOVE_PX) return;
  if (!D.moved) {
    D.moved = true;
    _scTlTap = null;
    if (!["scrub", "marq", "scene"].includes(D.mode)) _scTlBegin();
    _scEl("sc-vo-act")?.close?.();
    _scEl("sc-vo-scene")?.close?.();
    if (D.mode === "move" && D.dup) _scTlDupStart(D);
  }
  const pps = _scVoPx();
  const dt = dx / pps;
  const total = _scVoTotal();
  const M = _scTlMoves[D.mode];
  if (M) M(D, e, dt, pps, total, box);
}
const _scTlMoves = {
  scrub(D, e, dt, pps, total, box) {
    const lane = box.querySelector("[data-scrub]");
    _scTlSeek((e.clientX - lane.getBoundingClientRect().left) / pps);
  },
  marq(D, e, dt, pps, total, box) {
    const inner = box.querySelector(".sc-vo-in");
    const r = inner.getBoundingClientRect();
    const x1 = Math.min(D.x0 - (box.scrollLeft - D.sl0), e.clientX);
    const x2 = Math.max(D.x0 - (box.scrollLeft - D.sl0), e.clientX);
    const y1 = Math.min(D.y0, e.clientY);
    const y2 = Math.max(D.y0, e.clientY);
    const m = box.querySelector(".sc-tl-marq");
    Object.assign(m.style, { left: `${x1 - r.left}px`, top: `${y1 - r.top}px`, width: `${x2 - x1}px`, height: `${y2 - y1}px` });
    m.classList.remove("hidden");
    const sel = new Set(D.keep);
    box.querySelectorAll("[data-clip]").forEach((el) => {
      const b = el.getBoundingClientRect();
      if (b.right > x1 && b.left < x2 && b.bottom > y1 && b.top < y2) sel.add(el.dataset.clip);
    });
    _scTlSel = sel;
    _scTlMark();
  },
  move(D, e, dt, pps, total, box) {
    const a = D.s0.get(D.id);
    const c = D.c;
    const group = new Set(D.ids);
    // Hút: mép trái hoặc mép phải của khối được kéo, lấy mốc gần hơn.
    let s = a.start + dt;
    const p = _scTlSnapT(s, group);
    const q = _scTlSnapT(s + c.len, group) - c.len;
    s = Math.abs(p - s) <= Math.abs(q - s) ? p : q;
    let d = s - a.start;
    const list = D.ids.map(_scVoClip).filter(Boolean);
    d = Math.max(d, -Math.min(...list.map((x) => D.s0.get(x.id).start)));
    d = Math.min(d, Math.max(0, total - _SC_TL_MIN) - Math.max(...list.map((x) => D.s0.get(x.id).start)));
    // Đổi track theo hàng dưới con trỏ (nhạc nền đứng yên ở track của nó). Hàng "Track mới" = tạo
    // track tạm (thả xong mà trống thì bỏ).
    let shift = D.shift || 0;
    if (c.id !== _SC_VO_MU) {
      const row = document.elementFromPoint(e.clientX, e.clientY)?.closest("[data-row]")?.dataset.row;
      if (row === "new" && !D.tmp && _scVo.tracks.length < _SC_VO_TRACKS) {
        D.tmp = _scVoTrackAdd().id;
      }
      const to = row === "new" && D.tmp ? D.tmp : row;
      const ti = _scTlIdx(to);
      if (ti >= 0) {
        const want = ti - _scTlIdx(a.track);
        const ok = list.every((x) => {
          if (x.id === _SC_VO_MU) return true;
          const k = _scTlIdx(D.s0.get(x.id).track) + want;
          return k >= 0 && k < _scVo.tracks.length && !_scVo.tracks[k].lock;
        });
        if (ok) shift = want;
      }
    }
    const moved = shift !== (D.shift || 0);
    D.shift = shift;
    list.forEach((x) => {
      const o = D.s0.get(x.id);
      x.start = o.start + d;
      if (x.id === _SC_VO_MU) x.full = x.start + x.len >= total - 0.05;
      else x.track = _scVo.tracks[_scTlIdx(o.track) + shift].id;
    });
    if (moved) _scVoRender();
    else list.forEach(_scVoPlace);
    // Khối đè lên clip khác: viền đỏ — thả ra thì tự dời tới chỗ trống gần nhất.
    list.forEach((x) => {
      const bad = x.id !== _SC_VO_MU && !_scTlFree(x.track, x.start, x.len, group);
      box.querySelector(`[data-clip="${CSS.escape(x.id)}"]`)?.classList.add("is-drag");
      box.querySelector(`[data-clip="${CSS.escape(x.id)}"]`)?.classList.toggle("is-bad", bad);
    });
    _scVoSend();
    _scTlTip(e.clientX, e.clientY, `${_scVoFmt(c.start)}  (${_scTlSign(d)})${D.dup ? " · bản sao" : ""}`);
  },
  trim(D, e, dt, pps, total) {
    const c = D.c;
    const skip = new Set([c.id]);
    const on = c.id === _SC_VO_MU ? [] : _scTlOn(c.track, skip);
    if (D.edge === "l") {
      // Mép trái: lùi/tiến điểm vào của file, mép phải đứng yên; không lấn sang clip đứng trước.
      const prevEnd = Math.max(0, ...on.filter((o) => o.start < D.s0.start).map((o) => o.start + o.len));
      const s = _scTlSnapT(D.s0.start + dt, skip);
      let d = s - D.s0.start;
      d = Math.max(d, -D.s0.in, -D.s0.start, prevEnd - D.s0.start);
      d = Math.min(d, D.s0.len - _SC_TL_MIN);
      Object.assign(c, { start: D.s0.start + d, in: D.s0.in + d, len: D.s0.len - d });
    } else {
      const next = on.find((o) => o.start >= D.s0.start + D.s0.len - 1e-3);
      const end = _scTlSnapT(D.s0.start + D.s0.len + dt, skip);
      c.len = Math.max(_SC_TL_MIN, Math.min(end - c.start, c.dur - c.in, next ? next.start - c.start : Infinity));
      // Nhạc nền (bài lặp): mép phải chặn ở hết slide; chạm hết slide là lại "chạy tới cuối".
      if (c.id === _SC_VO_MU) {
        c.len = Math.min(c.len, Math.max(_SC_TL_MIN, total - c.start));
        c.full = c.start + c.len >= total - 0.05;
      }
    }
    _scVoPlace(c);
    _scTlPlacePops();
    _scVoSend();
    _scTlTip(e.clientX, e.clientY, `${D.edge === "l" ? "Bắt đầu" : "Hết"} ${_scVoFmt(D.edge === "l" ? c.start : c.start + c.len)} · dài ${_scVoFmt(c.len)}`);
  },
  fade(D, e, dt, pps) {
    const c = D.c;
    const r = D.el.getBoundingClientRect();
    const v = D.which === "fi" ? (e.clientX - r.left) / pps : (r.right - e.clientX) / pps;
    const other = D.which === "fi" ? c.fo || 0 : c.fi || 0;
    c[D.which] = Math.round(Math.max(0, Math.min(c.len - other, v)) * 10) / 10;
    _scVoPlace(c);
    _scVoSend();
    _scTlTip(e.clientX, e.clientY, `${D.which === "fi" ? "To dần" : "Nhỏ dần"} ${_scTlSec(c[D.which])}`);
  },
  kf(D, e, dt, pps) {
    const c = D.c;
    const r = D.el.getBoundingClientRect();
    D.p.t = Math.round(Math.max(c.in, Math.min(c.in + c.len, c.in + (e.clientX - r.left) / pps)) * 100) / 100;
    D.p.g = Math.round(D.gAt(e.clientY) * 100) / 100;
    c.env.sort((a, b) => a.t - b.t);
    _scVoPlace(c);
    _scVoSend();
    _scTlTip(e.clientX, e.clientY, `Âm lượng ${Math.round(D.p.g * (c.vol ?? 1) * 100)}% · ${_scVoFmt(c.start + D.p.t - c.in)}`);
  },
  env(D, e) {
    const c = D.c;
    const dg = -(e.clientY - D.y0) / D.h / (c.vol || 1);
    c.env = D.env0.map((p) => ({ t: p.t, g: Math.round(Math.min(1, Math.max(0, p.g + dg)) * 100) / 100 }));
    _scVoPlace(c);
    _scVoSend();
    const avg = c.env.reduce((n, p) => n + p.g, 0) / c.env.length;
    _scTlTip(e.clientX, e.clientY, `Âm lượng ${Math.round(avg * (c.vol ?? 1) * 100)}%`);
  },
  scene(D, e, dt, pps, total, box) {
    const seg = box.querySelector(`[data-scene="${D.i}"]`);
    if (seg) {
      seg.classList.add("is-drag");
      seg.style.transform = `translateX(${(dt * pps).toFixed(1)}px)`;
    }
    // Mốc nối gần nhất với tâm khối đang kéo.
    const starts = _scVoSceneStarts();
    const mid = starts[D.i] + _scCues[D.i].dur / 2000 + dt;
    const marks = [...starts, total];
    let k = 0;
    marks.forEach((m, j) => Math.abs(m - mid) < Math.abs(marks[k] - mid) && (k = j));
    D.to = k;
    const ins = box.querySelector(".sc-tl-ins");
    const lane = box.querySelector('[data-row="scenes"] [data-lane]');
    if (ins && lane) {
      ins.style.left = `${lane.offsetLeft + marks[k] * pps}px`;
      ins.classList.toggle("hidden", k === D.i || k === D.i + 1);
    }
    _scTlTip(e.clientX, e.clientY, k === D.i || k === D.i + 1 ? "Giữ nguyên chỗ" : `Chuyển tới vị trí ${k > D.i ? k : k + 1}`);
  },
  sdur(D, e, dt) {
    const c = _scCues[D.i];
    const d = Math.round(Math.max(c.min / 1000, Math.min(c.max / 1000, D.d0 + dt)) * 10) / 10;
    if (Math.abs(c.dur / 1000 - d) < 1e-3) return;
    c.dur = d * 1000;
    D.d = d;
    _scVoRender();
    _scTlTip(e.clientX, e.clientY, `${c.label} · ${_scTlSec(d)}`);
  },
};

// Alt + kéo: dựng bản sao của cụm ngay lúc bắt đầu kéo, kéo bản sao — bản gốc đứng nguyên.
function _scTlDupStart(D) {
  const list = D.ids.map(_scVoClip).filter((c) => c && c.id !== _SC_VO_MU);
  if (!list.length || !_scTlRoomClips(list.length)) return (D.dup = false);
  const map = new Map();
  list.forEach((c) => {
    const n = { ..._scVoClipMeta(c), id: _scVoId() };
    _scVo.clips.push(n);
    map.set(c.id, n.id);
  });
  D.ids = list.map((c) => map.get(c.id));
  D.s0 = new Map(list.map((c) => [map.get(c.id), D.s0.get(c.id)]));
  D.id = map.get(D.id) || D.ids[0];
  D.c = _scVoClip(D.id);
  _scTlSel = new Set(D.ids);
  _scVoRender();
}

function _scTlUp(e) {
  const D = _scTlD;
  if (!D) return;
  _scTlD = null;
  _scTlTip();
  const box = _scTlBox();
  box?.querySelector(".sc-tl-marq")?.classList.add("hidden");
  box?.querySelector(".sc-tl-ins")?.classList.add("hidden");
  if (!D.moved && D.mode === "kf") {
    // Chạm hai lần liền lên một điểm = xoá điểm (dblclick không tới được điểm: khung giữ con trỏ).
    const T = _scTlKfTap;
    _scTlKfTap = { c: D.c, p: D.p, at: performance.now() };
    _scTlTap = null;
    if (T && T.p === D.p && performance.now() - T.at < 450) {
      _scTlKfTap = null;
      _scTlDo("Xoá điểm âm lượng", () => (D.c.env = D.c.env.filter((x) => x !== D.p)));
      _scTlCommit();
    }
    return;
  }
  if (!D.moved && (D.mode === "env" || D.mode === "fade")) _scTlTap = null;
  if (!D.moved) {
    // Bấm vùng trống: bỏ chọn hết. Bấm một khối trong cụm đang chọn (không kéo): chỉ còn khối đó.
    // Click ngay sau đó mở thanh tuỳ chọn (_scTlClick).
    if (D.mode === "move" && !D.dup && _scTlSel.size > 1) _scTlSelectOnly([D.id]);
    if (D.mode === "marq") {
      _scTlSel = new Set(D.keep);
      _scTlScene = -1;
      _scTlMark();
    }
    return;
  }
  const end = (label) => {
    _scTlEnd(label);
    _scTlCommit();
  };
  switch (D.mode) {
    case "move": {
      const list = D.ids.map(_scVoClip).filter(Boolean);
      _scTlSettle(list.filter((c) => c.id !== _SC_VO_MU));
      if (D.tmp) _scTlDropEmpty([D.tmp]);
      return end(D.dup ? "Kéo bản sao" : "Dời clip");
    }
    case "trim":
      return end("Cắt clip");
    case "fade":
      return end(D.which === "fi" ? "To dần" : "Nhỏ dần");
    case "kf":
      return end("Điểm âm lượng");
    case "env":
      return end("Âm lượng clip");
    case "scene": {
      const seg = box?.querySelector(`[data-scene="${D.i}"]`);
      if (seg) seg.style.transform = "";
      if (D.to != null && D.to !== D.i && D.to !== D.i + 1) _scTlSceneMove(D.i, D.to);
      return _scVoRender();
    }
    case "sdur": {
      const c = _scCues[D.i];
      if (c && D.d != null) {
        const own = _scTiming();
        own.scenes = { ...(own.scenes || {}), [c.id]: D.d };
        _scTimingSave(own);
      }
      _scTlEnd("Thời lượng cảnh");
      return _scVoRender();
    }
  }
}

// Bấm (không kéo): khối → thanh tuỳ chọn; cảnh → nhảy tới cảnh đó + thanh; nút trong đầu track…
// Mở thanh ở click chứ không ở pointerup: x-popover đóng theo click ra ngoài ngay sau đó, mà khung giữ
// con trỏ (setPointerCapture) nên click rơi vào khung chứ không vào khối.
function _scTlClick(e) {
  const tap = _scTlTap;
  _scTlTap = null;
  const box = _scTlBox();
  if (tap?.kind === "clip") {
    const el = box.querySelector(`[data-clip="${CSS.escape(tap.id)}"]`);
    if (el && !_scVoRec && _scTlSel.size === 1) _scVoActOpen(el, tap.x);
    return;
  }
  if (tap?.kind === "scene") {
    const el = box.querySelector(`[data-scene="${tap.i}"]`);
    if (!el || _scVoRec) return;
    _scTlSceneSelect(tap.i);
    _scFrame.contentWindow?.postMessage({ type: "cx-slide-go", index: tap.i, pause: true }, location.origin);
    el.focus({ preventScroll: true });
    // Màn studio (dòng thời gian ở dock, tab bên cạnh vẫn thấy): mở luôn cảnh đó ở tab Cảnh. Điện thoại
    // thì không — dòng thời gian nằm trong tab Âm thanh, đổi tab là mất chỗ đang bấm.
    if (_SC_STUDIO.matches) _scTlFocusScene(tap.i);
    return _scTlOpenAt(_scEl("sc-vo-scene"), el, tap.x, `[data-scene="${tap.i}"]`);
  }
  const tg = e.target;
  const pick = (sel) => tg.closest(sel);
  let b;
  if ((b = pick("[data-tr]"))) return _scTlTrOpen(b, Number(b.dataset.tr));
  if ((b = pick("[data-trk-q]"))) return _scTlQuick(b.dataset.trkQ, b.dataset.id || "");
  if ((b = pick("[data-trk-menu]"))) return _scVoActOpenTrack(b, b.dataset.trkMenu);
  if ((b = pick("[data-trk-add]"))) return _scTlAddMenu(b, b.dataset.trkAdd);
  if ((b = pick("[data-trk-rec]"))) return scVoiceRecord("", b.dataset.trkRec);
  // Làn Nhạc nền đang trống: mở thanh của track nhạc (hàng Thêm: tải lên / thư viện).
  if (pick("[data-mu-add]")) {
    const b = _scTlBox()?.querySelector('[data-trk-menu="music"]');
    return b ? _scVoActOpenTrack(b, "music") : scMusicPick();
  }
  const addLane = pick("[data-vo-addlane]");
  if (addLane) return scVoicePick((e.clientX - addLane.getBoundingClientRect().left) / _scVoPx());
}

(() => {
  const box = _scTlBox();
  if (!box) return;
  box.addEventListener("pointerdown", _scTlDown);
  box.addEventListener("pointermove", (e) => {
    // Vạch "+" chạy theo con trỏ trên làn Track mới: chỗ file sẽ bắt đầu nếu bấm.
    const add = !_scTlD && e.pointerType === "mouse" && e.target.closest("[data-vo-addlane]");
    if (add) {
      const g = add.querySelector(".sc-vo-ghost");
      if (g) g.style.left = `${Math.max(0, e.clientX - add.getBoundingClientRect().left).toFixed(1)}px`;
    }
    if (_scTlD?.pid === e.pointerId) _scTlMove(e);
  });
  box.addEventListener("pointerup", _scTlUp);
  box.addEventListener("pointercancel", _scTlUp);
  box.addEventListener("click", _scTlClick);
  // Thanh âm lượng ở cột đầu track (màn rộng): cả lượt kéo là một bước hoàn tác, như thanh #sc-vo-act.
  box.addEventListener("input", (e) => {
    const r = e.target.closest?.("[data-trk-vol]");
    if (r && _scTlVolInput(r.dataset.trkVol, r)) r.nextElementSibling.textContent = `${r.value}%`;
  });
  box.addEventListener("change", (e) => {
    if (e.target.closest?.("[data-trk-vol]")) _scTlVolDone();
  });
  // Ctrl + lăn chuột = phóng to / thu nhỏ quanh con trỏ.
  box.addEventListener(
    "wheel",
    (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const lane = box.querySelector("[data-scrub]");
      if (!lane) return;
      const x = e.clientX - lane.getBoundingClientRect().left;
      const t = x / _scVoPx();
      const fit = _scVoFit(box, _scVoTotal());
      _scVoPps = Math.min(240, Math.max(fit, _scVoPx() * (e.deltaY < 0 ? 1.25 : 0.8)));
      _scVoRender();
      box.scrollLeft = Math.max(0, t * _scVoPx() - (x - box.scrollLeft));
    },
    { passive: false },
  );
})();

// ── Phím tắt (khi dòng thời gian đang hiện, con trỏ không ở ô gõ) ──
// Ctrl+Z / Ctrl+Shift+Z (Ctrl+Y) hoàn tác / làm lại · Delete xoá · Shift+Delete xoá kéo theo · Ctrl+A
// chọn hết · Esc bỏ chọn · Ctrl+C / X / V / D · C hoặc Ctrl+K tách · S hút mốc · J lùi 2 giây · K dừng
// · L phát · Home / End · ← → đầu phát 0,1 giây (Shift: 1 giây) · Alt + ← → nhích clip · ↑ ↓ mốc kế
// · + − phóng · ? bảng phím tắt. Phím cách (phát / dừng) do index.js lo.
function _scTlEdits(dir) {
  const t = _scVoNow();
  const marks = [0, _scVoTotal(), ..._scVoSceneStarts()];
  _scVo.clips.forEach((c) => marks.push(c.start, c.start + c.len));
  const mu = _scVoMuClip();
  if (mu) marks.push(mu.start, mu.start + mu.len);
  const list = [...new Set(marks.map((m) => Math.round(m * 100) / 100))].sort((a, b) => a - b);
  return dir > 0 ? list.find((m) => m > t + 0.02) : list.reverse().find((m) => m < t - 0.02);
}
// Phím đổi dữ liệu / di chuyển (trừ hoàn tác) chỉ khi con trỏ không ở bảng chỉnh bên phải — ở đó mũi
// tên còn để cuộn danh sách, Delete để sửa chữ.
document.addEventListener("keydown", (e) => {
  if (e.defaultPrevented || _scInField(e.target) || e.target.matches?.("input, select, textarea") || !_scVoShown(_scTlBox())) return;
  const k = e.key;
  const mod = e.ctrlKey || e.metaKey;
  const low = k.length === 1 ? k.toLowerCase() : k;
  const run = (fn) => {
    e.preventDefault();
    fn();
  };
  if (mod && low === "z") return run(() => (e.shiftKey ? scTlRedo() : scTlUndo()));
  if (mod && low === "y") return run(scTlRedo);
  if (e.target.closest?.(".sc-panel, x-popover, .sc-tabs")) return;
  if (mod && low === "a") return run(_scTlSelectAll);
  if (mod && low === "c") return run(() => _scTlCopy(false));
  if (mod && low === "x") return run(() => _scTlCopy(true));
  if (mod && low === "v") return run(_scTlPaste);
  if (mod && low === "d") return run(() => _scTlDup());
  if (mod && low === "k") return run(() => _scTlSplit());
  if (mod || (e.altKey && !["ArrowLeft", "ArrowRight"].includes(k))) return;
  if (k === "Delete" || k === "Backspace") return run(() => _scTlDelete(e.shiftKey));
  if (k === "Escape") {
    if (!_scTlSel.size && _scTlScene < 0) return;
    _scTlSel = new Set();
    _scTlScene = -1;
    return _scTlMark();
  }
  const focusClip = e.target.closest?.("#sc-vo-tl [data-clip]");
  if (k === "ArrowLeft" || k === "ArrowRight") {
    const d = (k === "ArrowLeft" ? -1 : 1) * (e.shiftKey ? 1 : 0.1);
    if (e.altKey || focusClip) return run(() => _scTlNudge(d));
    return run(() => _scTlSeek(_scVoNow() + d));
  }
  if (k === "ArrowUp" || k === "ArrowDown") {
    if (e.target.closest?.("x-popover")) return;
    const m = _scTlEdits(k === "ArrowDown" ? 1 : -1);
    return run(() => m != null && _scTlSeek(m));
  }
  if (k === "Home") return run(() => _scTlSeek(0));
  if (k === "End") return run(() => _scTlSeek(_scVoTotal()));
  if (k === "Enter" && focusClip) {
    const r = focusClip.getBoundingClientRect();
    return run(() => _scVoActOpen(focusClip, r.left + Math.min(40, r.width / 2)));
  }
  const seg = e.target.closest?.("#sc-vo-tl [data-scene]");
  if (k === "Enter" && seg) {
    const r = seg.getBoundingClientRect();
    _scTlSceneSelect(Number(seg.dataset.scene));
    return run(() => _scTlOpenAt(_scEl("sc-vo-scene"), seg, r.left + Math.min(40, r.width / 2), `[data-scene="${seg.dataset.scene}"]`));
  }
  const play = (on) => _scFrame.contentWindow?.postMessage({ type: "cx-slide-play", on }, location.origin);
  if (low === "c") return run(() => _scTlSplit());
  if (low === "s") return run(scTlSnap);
  if (low === "j") return run(() => _scTlSeek(_scVoNow() - 2));
  if (low === "k") return run(() => play(false));
  if (low === "l") return run(() => play(true));
  if (k === "+" || k === "=") return run(() => scVoiceZoom(1.6));
  if (k === "-" || k === "_") return run(() => scVoiceZoom(1 / 1.6));
  if (k === "\\") return run(() => scVoiceZoom(0));
  if (k === "?") return run(() => _scEl("sc-tl-keys")?.toggle(_scEl("sc-tl-keys-btn")));
});

// ── Thanh trên dòng thời gian ──
_scEl("sc-vo-duck")?.addEventListener("input", (e) => {
  if (_scVoBusy()) return;
  _scTlHoldOpen("Giảm nhạc khi có giọng");
  _scVo.duck = Number(e.target.value) / 100;
  _scRangeFill(e.target);
  _scEl("sc-vo-duck-v").textContent = `${e.target.value}%`;
  _scVoSave();
  _scVoSend();
});
_scEl("sc-vo-duck")?.addEventListener("change", _scTlHoldClose);
_scEl("sc-vo-play")?.addEventListener("click", () => {
  if (_scVoRec) return _scVoRecStop();
  _scFrame.contentWindow?.postMessage({ type: "cx-slide-play", on: !_scVoT.playing }, location.origin);
});
// Phóng to / thu nhỏ quanh đầu phát; "vừa khung" về 0.
function scVoiceZoom(k) {
  const box = _scTlBox();
  if (!box) return;
  const fit = _scVoFit(box, _scVoTotal());
  _scVoPps = k === 0 ? -1 : Math.min(240, Math.max(fit, _scVoPx() * k));
  const t = _scVoNow();
  _scVoRender();
  box.scrollLeft = Math.max(0, t * _scVoPx() - (box.clientWidth - _scVoHead(box)) / 2);
}
function scTlSplitBtn() {
  _scTlSplit();
}

// Gọi từ index.js: danh sách cảnh / thời lượng đổi, hay vừa mở tab.
function _scVoOnCues() {
  if (!_scTlD) _scVoRender();
}
addEventListener("resize", () => {
  clearTimeout(_scVoRender._t);
  _scVoRender._t = setTimeout(_scVoRender, 150);
});

// Bàn dựng phim (_SC_STUDIO): thanh phát + dòng thời gian ra dock đáy trang; màn nhỏ trả về tab
// Âm thanh, đúng chỗ cũ (trước ô chọn file nhạc ẩn). Chuyển nút thật nên sự kiện đã gắn giữ nguyên.
function _scVoDock() {
  const on = _SC_STUDIO.matches;
  const dock = _scEl("sc-dock");
  const tab = _scEl("sc-tab-audio");
  const anchor = _scEl("sc-mu-file");
  ["sc-vo-bar", "sc-vo-rec", "sc-vo-tl"].forEach((id) => {
    const el = _scEl(id);
    if (on) dock.appendChild(el);
    else tab.insertBefore(el, anchor);
  });
  _scVoRender();
}
_SC_STUDIO.addEventListener("change", _scVoDock);
_scVoDock();
