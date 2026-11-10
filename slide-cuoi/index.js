// Trang "Slide cưới": chọn mẫu slide (CX_SLIDE_TEMPLATES) → tuỳ chọn lấy dữ liệu từ một
// thiệp của tài khoản → xem trước, trình chiếu toàn màn, xuất video MP4 (1080p/4K).
// Mẫu chạy trong iframe templates/<id>/?embed=1 và KHÔNG tự gọi API: trang này lấy thiệp
// (getWeddingById, chỉ chủ thiệp) rồi gửi sang bằng postMessage mỗi khi khung báo sẵn sàng.
// Ảnh khách tự thay cho từng cảnh nằm trong IndexedDB của máy, gửi sang dạng Blob.

const _scS = { tpl: CX_SLIDE_TEMPLATES[0]?.id || "", real: false, wid: null, user: null };
let _scList = null; // thiệp của tài khoản; null = chưa tải
let _scSeq = 0; // đổi phiên làm scLoadList chạy chồng; chỉ lần MỚI NHẤT được vẽ
let _scSent = ""; // bộ dữ liệu khung đang chiếu — trùng thì khỏi gửi lại (gửi là chạy lại từ đầu)
const _scData = new Map(); // id → hàng thiệp đầy đủ
// Xuất video — khai ở đầu file vì _scFrameLoad (chạy ngay lúc khởi động) đọc tới.
let _scCapsOk = null; // {h1080, h2160, tiktok} khung báo lên; null = chưa biết
let _scMusic = ""; // "file" có nhạc nền (ghép vào video) · "" không có nhạc
let _scExState = "";
let _scExRes = "tiktok"; // "tiktok" (video dọc 2K đăng TikTok) · 1080 · 2160
let _scExBlob = null;
let _scWake = null;

const _scFrame = document.getElementById("sc-frame");
const _scBox = document.getElementById("sc-stagebox");
const _scEl = (id) => document.getElementById(id);
const _scToggle = (id, show) => _scEl(id)?.classList.toggle("hidden", !show);
const _scEsc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const _scIco = (name) => `<i data-lucide="${name}"></i>`;

// Lựa chọn của người xem, giữ qua lần tải lại / quay về từ trang đăng nhập Google.
const _SC_PREF = "cx_slide_prefs";
function _scSave() {
  try {
    localStorage.setItem(_SC_PREF, JSON.stringify({ tpl: _scS.tpl, real: _scS.real, wid: _scS.wid }));
  } catch (e) {}
}
function _scRestore() {
  try {
    const p = JSON.parse(localStorage.getItem(_SC_PREF) || "null");
    if (!p) return;
    if (CX_SLIDE_TEMPLATES.some((t) => t.id === p.tpl)) _scS.tpl = p.tpl;
    _scS.real = !!p.real;
    _scS.wid = typeof p.wid === "string" ? p.wid : null;
  } catch (e) {}
}

// ── Mẫu slide ──
function _scRenderTpls() {
  const box = _scEl("sc-tpls");
  box.innerHTML = CX_SLIDE_TEMPLATES.map(
    (t) => `
    <button type="button" class="sc-tpl" data-tpl="${_scEsc(t.id)}" aria-pressed="${t.id === _scS.tpl}">
      <img class="sc-tpl-img" src="${_scEsc(t.thumb)}" alt="" loading="lazy" />
      <span class="sc-tpl-name">${_scEsc(t.name)}</span>
      <span class="sc-tpl-desc">${_scEsc(t.desc)}</span>
    </button>`,
  ).join("");
}

_scEl("sc-tpls").addEventListener("click", (e) => {
  const b = e.target.closest("[data-tpl]");
  if (!b || b.dataset.tpl === _scS.tpl) return;
  _scS.tpl = b.dataset.tpl;
  _scSave();
  _scRenderTpls();
  _scFrameLoad();
});

// ── Màn chờ khoá cả trang lúc slide đang dựng ──
// Khung chỉ vẽ khi MỌI ảnh của mẫu đã tải xong (CXSlideEngine.build), trước đó là ô trống mà
// bàn chỉnh vẫn bấm được → khoá trang cho tới khi khung báo dựng xong (cx-slide-state có
// scenes). _scWaitN = việc đang đọc dữ liệu (thiệp, IndexedDB) — còn việc thì giữ màn chờ để
// không nháy giữa bộ dữ liệu mẫu và thiệp thật; _scWaitFrame = đã giao dữ liệu, khung chưa dựng.
const _SC_WAIT_MAX = 20000; // ảnh treo không trả lời thì vẫn nhả trang ra
let _scWaitN = 0;
let _scWaitFrame = false;
let _scWaitTimer = 0;
function _scWaitSync(msg) {
  const box = _scEl("sc-wait");
  if (msg) _scEl("sc-wait-msg").textContent = msg;
  const on = _scWaitN > 0 || _scWaitFrame;
  if (on === !box.hidden) return;
  box.hidden = !on;
  // inert: bàn phím (phím tắt dòng thời gian, Tab) cũng không lọt xuống trang bên dưới.
  document.querySelector(".sc-app")?.toggleAttribute("inert", on);
  clearTimeout(_scWaitTimer);
  if (on)
    _scWaitTimer = setTimeout(() => {
      _scWaitN = 0;
      _scWaitFrame = false;
      _scWaitSync();
    }, _SC_WAIT_MAX);
}
const _scWaitHold = (msg) => (_scWaitN++, _scWaitSync(msg));
const _scWaitDone = () => (_scWaitN = Math.max(0, _scWaitN - 1), _scWaitSync());

function _scFrameLoad() {
  _scWaitFrame = true;
  _scWaitSync("Đang tải mẫu slide…");
  _scSent = "";
  // Khung nạp lại là mất việc xuất đang chạy (nó sống trong khung) — về lại bước chọn.
  if (_scExState === "run") _scExportState("error", "Slide vừa được nạp lại nên việc xuất đã dừng.");
  _scCapsOk = null;
  _scEl("sc-cues").innerHTML = "";
  _scSig = "";
  _scOpen = -1;
  _scPhSig = "";
  _scEl("sc-total").textContent = "–:––";
  _scEl("sc-now").textContent = "0:00";
  _scEl("sc-track").innerHTML = "";
  const t = CX_SLIDE_TEMPLATES.find((x) => x.id === _scS.tpl);
  // Tỉ lệ dạng chữ cho aspect-ratio của khung, dạng số cho phép tính bề ngang (hàng nút, ô xuất
  // video canh theo bề ngang slide) — đặt ở .sc-app để cả sân khấu cùng đọc.
  const ratio = t?.ratio || "16 / 9";
  const [rw, rh] = ratio.split("/").map(Number);
  _scBox.style.setProperty("--sc-ratio", ratio);
  _scBox.closest(".sc-app")?.style.setProperty("--sc-ratio-n", String(rw > 0 && rh > 0 ? rw / rh : 16 / 9));
  _scFrame.src = `/slide-cuoi/templates/${encodeURIComponent(_scS.tpl)}/?embed=1`;
}

// ── Gửi dữ liệu sang khung ──
async function _scPush(force) {
  const w = _scS.real && _scS.wid ? _scData.get(_scS.wid) : null;
  const key = w ? _scS.wid : "demo";
  if (!force && key === _scSent) return;
  _scSent = key;
  _scSig = ""; // bộ dữ liệu khác → các ô chữ phải vẽ lại dù khoá trùng
  _scPhSig = "";
  // voice.js nạp sau và có thể hỏng riêng — thiếu nó slide vẫn chạy, chỉ không có giọng đọc.
  const vo = typeof _scVoLoad === "function";
  _scWaitHold(w ? "Đang tải ảnh thiệp…" : "");
  try {
    await Promise.all([_scPhLoad(), _scMuLoad(), vo ? _scVoLoad().catch(() => null) : null]);
  } finally {
    // Giao dữ liệu là chờ khung dựng — bật cờ TRƯỚC khi nhả việc, không thì màn chờ nháy tắt.
    if (_scSent === key) _scWaitFrame = true;
    _scWaitDone();
  }
  if (_scSent !== key) return; // trong lúc đọc ảnh / nhạc đã đổi sang bộ dữ liệu khác
  _scFrame.contentWindow?.postMessage(
    {
      type: "cx-slide-data",
      wedding: w || null,
      texts: _scTexts(),
      photos: _scPhMsg(),
      music: _scMuMsg(),
      timing: _scTiming(),
      voice: vo ? _scVoMsg() : null,
    },
    location.origin,
  );
  if (vo) _scVoOnCues();
}

addEventListener("message", (e) => {
  if (e.source !== _scFrame.contentWindow || e.origin !== location.origin) return;
  const t = e.data?.type;
  if (t === "cx-slide-ready") _scPush(true);
  else if (t === "cx-slide-full") scFullscreen();
  else if (t === "cx-slide-state") {
    if (Array.isArray(e.data?.scenes) && _scWaitFrame) {
      _scWaitFrame = false;
      _scWaitSync();
    }
    _scCueState(e.data);
  }
  else if (t === "cx-slide-caps") _scCaps(e.data);
  else if (t === "cx-slide-export-state") _scExportMsg(e.data);
  else if (t === "cx-slide-edit") _scEditFromSlide(e.data);
  else if (t === "cx-slide-ui") _scCtlUi(e.data);
  else if (t === "cx-slide-time") {
    _scCtlTime(e.data);
    if (typeof _scVoTime === "function") _scVoTime(e.data);
  }
});

// ── Cụm điều khiển ở hàng nút dưới slide: lệnh vào khung, trạng thái khung báo về ──
const _scCtl = _scEl("sc-ctl");
let _scCtlPlaying = true;
function _scCtlUi(m) {
  _scCtlPlaying = !!m.playing;
  _scCtl.classList.toggle("is-playing", _scCtlPlaying);
  _scCtl.classList.toggle("has-music", !!m.music);
  _scCtl.classList.toggle("is-music-on", !!m.musicOn);
  _scCtl.querySelector('[data-ctl="music"]')?.setAttribute("aria-pressed", String(!!m.musicOn));
}
function _scCtlTime(m) {
  if (!!m.playing !== _scCtlPlaying) _scCtlUi({ ...m, music: _scCtl.classList.contains("has-music"), musicOn: _scCtl.classList.contains("is-music-on") });
  _scEl("sc-now").textContent = _scClock(Math.floor(m.t || 0) * 1000);
  _scTrackAt(m.t || 0);
}

// Dải cảnh của bàn điều khiển: mỗi cảnh một đoạn dài theo thời lượng, --p (0–1) là phần đã chiếu
// của đoạn, đoạn đang chiếu thêm .is-on. Bấm một đoạn là chiếu từ đầu cảnh đó.
let _scTrackT = 0;
function _scTrackRender() {
  _scEl("sc-track").innerHTML = _scCues
    .map(
      (c, i) =>
        `<button type="button" class="sc-seg" data-seg="${i}" style="flex-grow: ${Math.max(1, Math.round(c.dur))}" aria-label="Chiếu cảnh ${i + 1}: ${_scEsc(c.label)}" title="${_scEsc(c.label)}"><i></i></button>`,
    )
    .join("");
  _scTrackAt(_scTrackT);
}
function _scTrackAt(t) {
  _scTrackT = t;
  let at = 0;
  _scEl("sc-track").querySelectorAll("[data-seg]").forEach((b, i) => {
    const d = (_scCues[i]?.dur || 0) / 1000;
    const p = d ? Math.min(1, Math.max(0, (t - at) / d)) : 0;
    at += d;
    b.style.setProperty("--p", p.toFixed(4));
    b.classList.toggle("is-on", p > 0 && p < 1);
  });
}
_scEl("sc-track").addEventListener("click", (e) => {
  const b = e.target.closest("[data-seg]");
  if (b) _scFrame.contentWindow?.postMessage({ type: "cx-slide-go", index: Number(b.dataset.seg), pause: false }, location.origin);
});
_scCtl.addEventListener("click", (e) => {
  const k = e.target.closest("[data-ctl]")?.dataset.ctl;
  if (!k) return;
  const win = _scFrame.contentWindow;
  // Phát qua cx-slide-play (cũng là lúc bật tiếng — trình duyệt cần một cú bấm của người dùng).
  if (k === "play") win?.postMessage({ type: "cx-slide-play", on: !_scCtlPlaying }, location.origin);
  else win?.postMessage({ type: "cx-slide-act", k }, location.origin);
});

// Phím cách ở bất kỳ đâu trên trang = phát / tạm dừng, kể cả khi đang đứng trên một nút (bắt ở
// pha capture để nút không nhận cú bấm). Chỉ chừa ô gõ chữ. Trong khung slide thì runtime tự lo.
const _scInField = (el) => !!el?.closest?.('textarea, select, [contenteditable=""], [contenteditable="true"], input:not([type=button], [type=checkbox], [type=radio], [type=range], [type=file], [type=submit], [type=reset])');
addEventListener(
  "keydown",
  (e) => {
    if (e.key !== " " || e.ctrlKey || e.metaKey || e.altKey || _scInField(e.target)) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.repeat) return;
    if (typeof _scVoRec !== "undefined" && _scVoRec) return _scVoRecStop();
    _scFrame.contentWindow?.postMessage({ type: "cx-slide-play", on: !_scCtlPlaying }, location.origin);
  },
  true,
);
// Firefox kích hoạt nút đang focus lúc NHẢ phím cách — chặn luôn ở keyup.
addEventListener(
  "keyup",
  (e) => {
    if (e.key === " " && !_scInField(e.target)) e.preventDefault();
  },
  true,
);

// ── Chữ trong slide: mỗi cảnh một dòng (mốc giờ · tên · thời lượng), bấm là chiếu cảnh đó,
// dừng lại và mở các ô chữ của nó. Chữ sửa lưu trên máy theo mẫu + thiệp, gửi sang khung
// bằng cx-slide-texts; khung dựng lại rồi báo cảnh mới lên — khoá ô không đổi thì chỉ cập
// nhật mốc giờ, không vẽ lại ô (vẽ lại là mất con trỏ đang gõ).
let _scCues = [];
let _scOpen = -1; // cảnh đang mở ô sửa
let _scSig = "";
let _scTxT = 0;
const _scClock = (ms) => {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

const _SC_TEXTS = "cx_slide_texts";
const _scTxKey = () => `${_scS.tpl}|${_scS.real && _scS.wid ? _scS.wid : "demo"}`;
function _scTexts() {
  try {
    const all = JSON.parse(localStorage.getItem(_SC_TEXTS) || "{}");
    const own = all?.[_scTxKey()];
    return own && typeof own === "object" ? own : {};
  } catch (e) {
    return {};
  }
}
function _scTextsSave(own) {
  try {
    const all = JSON.parse(localStorage.getItem(_SC_TEXTS) || "{}") || {};
    if (Object.keys(own).length) all[_scTxKey()] = own;
    else delete all[_scTxKey()];
    localStorage.setItem(_SC_TEXTS, JSON.stringify(all));
  } catch (e) {}
}

// ── Thời lượng: thanh "cả slide" (hệ số nhân thời lượng mẫu, 0,5×–2×) + thanh riêng từng cảnh
// (giây, đè hệ số). Lưu trên máy như chữ sửa — localStorage `cx_slide_timing` theo mẫu + thiệp,
// dạng {scale, scenes: {id cảnh: giây}, off: [id cảnh đã xoá]} — gửi khung bằng cx-slide-timing;
// khung chỉ đặt lại mốc (bỏ cảnh trong `off`), tự kẹp mỗi cảnh trong [min, max] (min = đủ cho mọi
// hiệu ứng chạy xong) rồi báo cảnh lên lại.
const _SC_TIMING = "cx_slide_timing";
let _scTmT = 0;
function _scTiming() {
  try {
    const own = JSON.parse(localStorage.getItem(_SC_TIMING) || "{}")?.[_scTxKey()];
    return own && typeof own === "object" ? own : {};
  } catch (e) {
    return {};
  }
}
function _scTimingSave(own) {
  if (own.scenes && !Object.keys(own.scenes).length) delete own.scenes;
  if (own.off && !own.off.length) delete own.off;
  if (own.order && !own.order.length) delete own.order;
  if (own.tr && !Object.keys(own.tr).length) delete own.tr;
  if (own.scale === 1) delete own.scale;
  try {
    const all = JSON.parse(localStorage.getItem(_SC_TIMING) || "{}") || {};
    if (Object.keys(own).length) all[_scTxKey()] = own;
    else delete all[_scTxKey()];
    localStorage.setItem(_SC_TIMING, JSON.stringify(all));
  } catch (e) {}
  // Gom các nấc kéo liền nhau thành một lần gửi.
  clearTimeout(_scTmT);
  _scTmT = setTimeout(() => _scFrame.contentWindow?.postMessage({ type: "cx-slide-timing", timing: _scTiming() }, location.origin), 120);
}
const _scSec = (s) => `${(Math.round(s * 2) / 2).toLocaleString("vi-VN")} giây`;
// Phần đã kéo của thanh (tô màu nhấn), CSS đọc qua --p.
function _scRangeFill(r) {
  const min = Number(r.min);
  const max = Number(r.max);
  r.style.setProperty("--p", `${max > min ? ((Number(r.value) - min) / (max - min)) * 100 : 0}%`);
}
// Đang xuất thì khung không nhận thời lượng mới — chặn và kéo thanh về chỗ cũ.
function _scTimeBusy() {
  if (_scExState !== "run") return false;
  window.showToast?.("Đang xuất video, đợi xong rồi hãy chỉnh thời gian", "warning");
  _scCueTimes();
  return true;
}

// Đồng bộ thẻ "cả slide" + thanh từng cảnh theo bản khung vừa báo; thanh đang kéo thì để yên.
function _scTimeSync() {
  const own = _scTiming();
  const sp = _scEl("sc-speed");
  const live = document.activeElement;
  if (sp && live !== sp) sp.value = String(own.scale || 1);
  if (sp) _scRangeFill(sp);
  const total = _scCues.reduce((n, c) => n + c.dur, 0);
  const base = _scCues.reduce((n, c) => n + Math.min(c.max, Math.max(c.min, c.base)), 0);
  const tv = _scEl("sc-time-total");
  if (tv) tv.textContent = _scCues.length ? _scClock(total) : "–:––";
  const changed = !!(own.scale || own.scenes);
  _scToggle("sc-time-reset", changed);
  const def = _scEl("sc-time-def");
  if (def) def.textContent = changed && _scCues.length ? `Mặc định ${_scClock(base)}` : "";
  _scEl("sc-cues").querySelectorAll("[data-dur]").forEach((r) => {
    const c = _scCues[Number(r.dataset.dur)];
    if (!c) return;
    r.min = String(c.min / 1000);
    r.max = String(c.max / 1000);
    if (r !== live) r.value = String(c.dur / 1000);
    _scRangeFill(r);
    const box = r.closest(".sc-dur");
    box.querySelector(".sc-dur-v").textContent = _scSec(Number(r.value));
    box.querySelector(".sc-dur-min").textContent = _scSec(c.min / 1000);
    box.querySelector(".sc-dur-max").textContent = _scSec(c.max / 1000);
    box.querySelector(".sc-dur-undo").classList.toggle("is-off", !(own.scenes && c.id in own.scenes));
  });
}

_scEl("sc-speed")?.addEventListener("input", (e) => {
  if (_scTimeBusy()) return;
  const own = _scTiming();
  own.scale = Number(e.target.value);
  _scRangeFill(e.target);
  // Hiện ngay tổng mới (ước lượng theo hệ số), khung báo lại số chính xác sau một nhịp.
  const total = _scCues.reduce((n, c) => {
    const s = own.scenes?.[c.id];
    return n + Math.min(c.max, Math.max(c.min, s ? s * 1000 : c.base * own.scale));
  }, 0);
  _scEl("sc-time-total").textContent = _scClock(total);
  _scTimingSave(own);
});

// Về thời lượng mặc định — cảnh đã xoá vẫn xoá (khôi phục riêng ở khối "Cảnh đã xoá").
// "Mặc định": chỉ trả thời lượng (cả slide + từng cảnh) — cảnh đã xoá, thứ tự và chuyển cảnh giữ nguyên.
function scTimingReset() {
  if (_scTimeBusy()) return;
  const { off, order, tr } = _scTiming();
  _scHistDo("Thời lượng mặc định", () => _scTimingSave({ off, order, tr }));
  _scEl("sc-speed").value = "1";
  _scRangeFill(_scEl("sc-speed"));
}

_scEl("sc-cues").addEventListener("input", (e) => {
  const r = e.target.closest("[data-dur]");
  if (!r || _scTimeBusy()) return;
  const c = _scCues[Number(r.dataset.dur)];
  if (!c) return;
  const own = _scTiming();
  own.scenes = { ...(own.scenes || {}), [c.id]: Number(r.value) };
  _scRangeFill(r);
  const box = r.closest(".sc-dur");
  box.querySelector(".sc-dur-v").textContent = _scSec(Number(r.value));
  box.querySelector(".sc-dur-undo").classList.remove("is-off");
  _scTimingSave(own);
});

_scEl("sc-cues").addEventListener("click", (e) => {
  const b = e.target.closest("[data-dur-undo]");
  if (!b || _scTimeBusy()) return;
  const c = _scCues[Number(b.dataset.durUndo)];
  const own = _scTiming();
  if (!c || !own.scenes) return;
  delete own.scenes[c.id];
  b.classList.add("is-off");
  _scTimingSave(own);
});

function _scFieldHTML(x) {
  return `<label class="sc-tx">
    <textarea class="sc-tx-in" data-key="${_scEsc(x.key)}" data-def="${_scEsc(x.def)}" rows="1" spellcheck="false">${_scEsc(x.text)}</textarea>
    <button type="button" class="sc-tx-undo${x.text === x.def ? " is-off" : ""}" data-undo="${_scEsc(x.key)}" aria-label="Trả lại lời mẫu" title="Trả lại lời mẫu">${_scIco("undo-2")}</button>
  </label>`;
}

function _scCueTimes() {
  let t = 0;
  _scEl("sc-cues").querySelectorAll("[data-cue]").forEach((b, i) => {
    const c = _scCues[i];
    if (!c) return;
    b.querySelector(".sc-cue-t").textContent = _scClock(t);
    b.querySelector(".sc-cue-d").textContent = _scSec(c.dur / 1000);
    t += c.dur;
  });
  _scTimeSync();
  _scEl("sc-total").textContent = _scCues.length ? _scClock(t) : "–:––";
  _scTrackRender();
}

function _scCueRender() {
  const ol = _scEl("sc-cues");
  ol.innerHTML = _scCues
    .map((c, i) => {
      const open = i === _scOpen;
      const fields = c.texts.length
        ? c.texts.map(_scFieldHTML).join("")
        : `<p class="sc-tx-none">Cảnh này chỉ có ảnh.</p>`;
      // Ô ảnh nhỏ (.sc-cue-thumb) và khối đổi ảnh (.sc-phbox) để trống: _scPhRender đổ vào.
      return `<li class="sc-scene${open ? " is-open" : ""}">
        <button type="button" class="sc-cue" data-cue="${i}" aria-expanded="${open}">
          <span class="sc-cue-thumb" aria-hidden="true"></span>
          <span class="sc-cue-main">
            <span class="sc-cue-n">${_scEsc(c.label)}</span>
            <span class="sc-cue-t"></span>
          </span>
          <span class="sc-cue-d"></span>
        </button>
        <div class="sc-tx-list${open ? "" : " hidden"}">
          <div class="sc-dur">
            <div class="sc-dur-row">
              <label class="sc-dur-l" for="sc-dur-${i}">${_scIco("timer")}Thời gian cảnh</label>
              <output class="sc-dur-v" for="sc-dur-${i}"></output>
              <button type="button" class="sc-dur-undo is-off" data-dur-undo="${i}" aria-label="Trả thời gian cảnh về mặc định" title="Về mặc định">${_scIco("undo-2")}</button>
            </div>
            <input id="sc-dur-${i}" type="range" class="sc-range" data-dur="${i}" step="0.5" />
            <div class="sc-range-ends"><span class="sc-dur-min"></span><span class="sc-dur-max"></span></div>
          </div>
          ${c.photos.length ? `<div class="sc-phbox"></div>` : ""}${fields}
          <div class="sc-scene-foot">
            <x-button variant="ghost" tone="danger" size="sm" icon="trash-2" data-scene-del="${i}">Xoá cảnh này</x-button>
          </div>
        </div>
      </li>`;
    })
    .join("");
  _scCueTimes();
  window.lucide?.createIcons({ root: ol });
  ol.querySelectorAll(".sc-tx-in").forEach(_scGrow);
  _scResetBtn();
  _scPhSig = "";
  _scPhRender();
}

function _scCueState(m) {
  const ol = _scEl("sc-cues");
  if (Array.isArray(m.scenes)) {
    _scMusic = m.music || "";
    _scExportNote();
    _scMuRender();
    _scCues = m.scenes.map((c, k) => ({
      id: String(c.id ?? k),
      label: String(c.label || ""),
      dur: Number(c.dur) || 0,
      base: Number(c.base) || Number(c.dur) || 0,
      min: Number(c.min) || 1000,
      max: Number(c.max) || 30000,
      tr: String(c.tr || "fade"),
      tr0: String(c.tr0 || "fade"),
      texts: (Array.isArray(c.texts) ? c.texts : []).map((x) => ({
        key: String(x.key),
        text: String(x.text ?? ""),
        def: String(x.def ?? ""),
      })),
      photos: (Array.isArray(c.photos) ? c.photos : [])
        .filter((p) => p?.key)
        .map((p) => ({ key: String(p.key), def: String(p.def || ""), w: Number(p.w) || 3, h: Number(p.h) || 4 })),
    }));
    _scHidden = (Array.isArray(m.hidden) ? m.hidden : []).map((c) => ({ id: String(c.id), label: String(c.label || "") }));
    _scHiddenRender();
    const sig = _scCues
      .map((c) => c.label + ":" + c.texts.map((x) => x.key).join(",") + ":" + c.photos.map((p) => p.key).join(","))
      .join("|");
    if (typeof _scVoOnCues === "function") setTimeout(_scVoOnCues);
    if (sig === _scSig) {
      _scCueTimes();
      _scPhRender();
    } else {
      _scSig = sig;
      if (_scOpen >= _scCues.length) _scOpen = -1;
      _scCueRender();
    }
  }
  ol.classList.toggle("is-paused", !m.playing);
  ol.querySelectorAll("[data-cue]").forEach((b) => {
    const on = Number(b.dataset.cue) === m.index;
    b.classList.toggle("is-on", on);
    if (on) b.setAttribute("aria-current", "step");
    else b.removeAttribute("aria-current");
  });
}

// ── Xoá cảnh: id cảnh vào timing.off (lưu + gửi khung như thời lượng); khung bỏ cảnh đó khỏi
// lượt chiếu lẫn video xuất và báo lại danh sách `hidden` để hiện ở khối "Cảnh đã xoá".
let _scHidden = []; // [{id, label}] cảnh đã xoá, theo thứ tự trong mẫu
function _scSceneOff(id, on) {
  if (_scTimeBusy()) return;
  const own = _scTiming();
  const off = new Set(own.off || []);
  if (on) off.add(id);
  else off.delete(id);
  own.off = [...off];
  _scTimingSave(own);
}
function _scHiddenRender() {
  const box = _scEl("sc-hidden");
  if (!box) return;
  box.classList.toggle("hidden", !_scHidden.length);
  if (!_scHidden.length) return (box.innerHTML = "");
  box.innerHTML = `<p class="sc-hidden-h">${_scIco("eye-off")}Cảnh đã xoá</p>
    <ul class="sc-hidden-list">${_scHidden
      .map(
        (c) => `<li class="sc-hidden-row">
          <span class="sc-hidden-n">${_scEsc(c.label)}</span>
          <x-button variant="soft" size="xs" icon="undo-2" data-scene-back="${_scEsc(c.id)}">Khôi phục</x-button>
        </li>`,
      )
      .join("")}</ul>`;
  window.lucide?.createIcons({ root: box });
}
// Bọc một thay đổi vào lịch sử hoàn tác của dòng thời gian (timeline.js) — trang chưa nạp nó thì chạy thẳng.
const _scHistDo = (label, fn) => (typeof _scTlDo === "function" ? _scTlDo(label, fn) : fn());
// Xoá cảnh thứ i — dùng chung cho nút trong danh sách cảnh và track Cảnh của dòng thời gian.
function scSceneDelete(i) {
  const c = _scCues[i];
  if (!c) return;
  if (_scCues.length <= 1) return window.showToast?.("Slide phải còn ít nhất một cảnh", "warning");
  if (_scExState === "run") return window.showToast?.("Đang xuất video, đợi xong rồi hãy xoá cảnh", "warning");
  _scOpen = -1;
  _scHistDo("Xoá cảnh", () => _scSceneOff(c.id, true));
  window.showToast?.(`Đã xoá cảnh "${c.label}". Ctrl+Z để hoàn tác, hoặc bấm Khôi phục ở cuối tab Cảnh.`, "success");
}
_scEl("sc-cues").addEventListener("click", (e) => {
  const b = e.target.closest("[data-scene-del]");
  if (b) scSceneDelete(Number(b.dataset.sceneDel));
});
_scEl("sc-hidden")?.addEventListener("click", (e) => {
  const b = e.target.closest("[data-scene-back]");
  if (b) _scHistDo("Khôi phục cảnh", () => _scSceneOff(b.dataset.sceneBack, false));
});

// Ô chữ cao theo nội dung.
function _scGrow(ta) {
  ta.style.height = "auto";
  ta.style.height = `${ta.scrollHeight}px`;
}

function _scResetBtn() {
  _scToggle("sc-tx-reset", Object.keys(_scTexts()).length > 0);
}

// Gom các phím gõ liền nhau thành một lần dựng lại khung.
function _scTextsPush() {
  clearTimeout(_scTxT);
  _scTxT = setTimeout(() => {
    _scFrame.contentWindow?.postMessage({ type: "cx-slide-texts", texts: _scTexts(), index: _scOpen }, location.origin);
  }, 300);
}

function _scTextSet(key, value, def) {
  const own = _scTexts();
  if (value === def) delete own[key];
  else own[key] = value;
  _scTextsSave(own);
  _scResetBtn();
  _scTextsPush();
}

function scTextsReset() {
  _scTextsSave({});
  _scResetBtn();
  _scEl("sc-cues").querySelectorAll(".sc-tx-in").forEach((ta) => {
    ta.value = ta.dataset.def;
    _scGrow(ta);
    ta.parentElement.querySelector(".sc-tx-undo")?.classList.add("is-off");
  });
  _scTextsPush();
}

_scEl("sc-cues").addEventListener("click", (e) => {
  const undo = e.target.closest("[data-undo]");
  if (undo) {
    const ta = undo.parentElement.querySelector(".sc-tx-in");
    ta.value = ta.dataset.def;
    _scGrow(ta);
    undo.classList.add("is-off");
    _scTextSet(ta.dataset.key, ta.value, ta.dataset.def);
    ta.focus();
    return;
  }
  const b = e.target.closest("[data-cue]");
  if (!b) return;
  const i = Number(b.dataset.cue);
  _scOpenScene(_scOpen === i ? -1 : i);
  _scFrame.contentWindow?.postMessage({ type: "cx-slide-go", index: i, pause: _scOpen === i }, location.origin);
});

// Mở phần chỉnh của cảnh i (-1 = đóng hết), trả về dòng đang mở.
function _scOpenScene(i) {
  _scOpen = i;
  let hit = null;
  _scEl("sc-cues").querySelectorAll(".sc-scene").forEach((li, k) => {
    const open = k === _scOpen;
    li.classList.toggle("is-open", open);
    li.querySelector(".sc-tx-list").classList.toggle("hidden", !open);
    li.querySelector("[data-cue]").setAttribute("aria-expanded", String(open));
    if (open) {
      li.querySelectorAll(".sc-tx-in").forEach(_scGrow);
      hit = li;
    }
  });
  return hit;
}

// Bấm thẳng lên slide (khung đã tự dừng ở cảnh đó): về tab Cảnh, mở cảnh, cuộn tới rồi đặt
// con trỏ vào đúng ô chữ — hoặc làm nổi khối ảnh — kèm một nhịp sáng để mắt tìm thấy.
function _scEditFromSlide(m) {
  if (!Number.isInteger(m.index)) return;
  scTab("scenes");
  const li = _scOpenScene(m.index);
  if (!li) return;
  const target =
    m.kind === "text"
      ? li.querySelector(`.sc-tx-in[data-key="${CSS.escape(String(m.key))}"]`)
      : li.querySelector(`.sc-ph-pick[data-ph="${CSS.escape(String(m.key))}"]`) || li.querySelector(".sc-ph-pick");
  const el = target || li;
  const smooth = !matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ block: "center", behavior: smooth ? "smooth" : "auto" });
  el.focus?.({ preventScroll: true });
  const box = target?.closest(".sc-tx") || target || li;
  box.classList.remove("is-flash");
  void box.offsetWidth; // chạy lại hiệu ứng khi bấm liên tiếp cùng một chỗ
  box.classList.add("is-flash");
  setTimeout(() => box.classList.remove("is-flash"), 1300);
}

_scEl("sc-cues").addEventListener("input", (e) => {
  const ta = e.target.closest(".sc-tx-in");
  if (!ta) return;
  _scGrow(ta);
  ta.parentElement.querySelector(".sc-tx-undo")?.classList.toggle("is-off", ta.value === ta.dataset.def);
  _scTextSet(ta.dataset.key, ta.value, ta.dataset.def);
});

// ── Ảnh trong slide: mỗi cảnh có ảnh một ô, mặc định là ảnh khung báo lên (ảnh thiệp, hoặc
// ảnh mẫu khi chưa chọn thiệp). Ảnh khách chọn được nén rồi cất BYTE vào IndexedDB theo
// <mẫu>|<thiệp hoặc demo>|<id cảnh> — không lên server, đúng như chữ sửa. Cất byte chứ không
// cất Blob: WebKit có máy đọc lại Blob đã cất thành rỗng. Chọn ảnh xong là mở bảng lấy nét
// (openFocalPointPicker của core/utils.js, nạp lúc cần) với đúng khổ khung ảnh của cảnh.
const _SC_PH_DB = "cx_slide";
const _SC_PH_STORE = "photos";
const _SC_MU_STORE = "music";
const _SC_PH_LIMITS = { maxWidth: 2560, maxHeight: 2560, maxSizeMB: 2, quality: 0.9 };
let _scPh = { key: null, map: {} }; // map: id cảnh → {id, blob, url, focal}
let _scPhSig = "";
let _scPhPick = null; // {key, index} ô đang chọn ảnh
let _scDbP = null;

function _scDB() {
  _scDbP ||= new Promise((resolve, reject) => {
    // v2 thêm kho "music" (nhạc khách chọn theo thiệp), v3 kho "voice" (giọng đọc, voice.js);
    // tạo kho nào còn thiếu.
    const rq = indexedDB.open(_SC_PH_DB, 3);
    rq.onupgradeneeded = () => {
      [_SC_PH_STORE, _SC_MU_STORE, "voice"].forEach((n) => rq.result.objectStoreNames.contains(n) || rq.result.createObjectStore(n));
    };
    rq.onsuccess = () => resolve(rq.result);
    rq.onerror = () => reject(rq.error);
  }).catch((e) => {
    _scDbP = null;
    throw e;
  });
  return _scDbP;
}

async function _scDbDo(mode, fn, store = _SC_PH_STORE) {
  const db = await _scDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const rq = fn(tx.objectStore(store));
    tx.oncomplete = () => resolve(rq?.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function _scPhClear() {
  Object.values(_scPh.map).forEach((p) => URL.revokeObjectURL(p.url));
  _scPh.map = {};
}

// Đọc ảnh đã cất của bộ dữ liệu đang chiếu (đọc lại chỉ khi đổi mẫu / thiệp).
async function _scPhLoad() {
  const key = _scTxKey();
  if (_scPh.key === key) return;
  _scPhClear();
  _scPh.key = key;
  const prefix = key + "|";
  let keys = [];
  let vals = [];
  try {
    const range = IDBKeyRange.bound(prefix, prefix + "\uffff");
    [keys, vals] = await Promise.all([
      _scDbDo("readonly", (st) => st.getAllKeys(range)),
      _scDbDo("readonly", (st) => st.getAll(range)),
    ]);
  } catch (e) {
    console.warn("Không đọc được ảnh slide đã lưu:", e);
  }
  if (_scPh.key !== key) return;
  (keys || []).forEach((k, i) => {
    const v = vals[i];
    if (!v?.buf?.byteLength) return;
    const blob = new Blob([v.buf], { type: v.type || "image/jpeg" });
    _scPh.map[String(k).slice(prefix.length)] = { id: v.id, blob, url: URL.createObjectURL(blob), focal: v.focal || null };
  });
}

function _scPhMsg() {
  const out = {};
  Object.entries(_scPh.map).forEach(([k, p]) => (out[k] = { id: p.id, blob: p.blob, focal: p.focal }));
  return out;
}

function _scPhSend(index) {
  _scFrame.contentWindow?.postMessage({ type: "cx-slide-photos", photos: _scPhMsg(), index }, location.origin);
}

// Đổ ảnh vào từng dòng cảnh: ô ảnh nhỏ trên dòng + khối đổi ảnh trong phần mở rộng (cảnh một
// ảnh: ảnh đúng khổ khung + nút; cảnh nhiều ảnh: lưới ô vuông, nút nhỏ dưới ô đã thay). Chỉ thay
// hai chỗ đó, không vẽ lại cả danh sách — ô chữ đang gõ giữ nguyên con trỏ.
function _scPhRender() {
  const sig = _scCues
    .map((c) =>
      c.photos
        .map((p) => {
          const own = _scPh.map[p.key];
          return `${p.key}:${p.def}:${own ? `${own.id}@${own.focal?.x},${own.focal?.y}` : ""}`;
        })
        .join(","),
    )
    .join("|");
  _scToggle("sc-ph-reset", _scCues.some((c) => c.photos.some((p) => _scPh.map[p.key])));
  if (sig === _scPhSig) return;
  _scPhSig = sig;
  const lis = _scEl("sc-cues").children;
  const demo = _scTxKey().endsWith("|demo");
  const img = (p) => {
    const own = _scPh.map[p.key];
    const src = own?.url || p.def;
    const pos = own?.focal ? ` style="object-position:${Number(own.focal.x)}% ${Number(own.focal.y)}%"` : "";
    return src ? `<img src="${_scEsc(src)}" alt="" loading="lazy"${pos} onerror="this.remove()" />` : "";
  };
  const at = (p, i) => `data-i="${i}" data-w="${p.w}" data-h="${p.h}"`;
  const back = demo ? "Dùng ảnh mẫu" : "Dùng ảnh thiệp";
  _scCues.forEach((c, i) => {
    const li = lis[i];
    if (!li || !c.photos.length) return;
    li.classList.toggle("is-own", c.photos.some((p) => _scPh.map[p.key]));
    li.querySelector(".sc-cue-thumb").innerHTML = img(c.photos[0]);
    const box = li.querySelector(".sc-phbox");
    if (!box) return;
    if (c.photos.length === 1) {
      const p = c.photos[0];
      const own = _scPh.map[p.key];
      box.classList.toggle("sc-ph-own", !!own);
      box.innerHTML = `
      <button type="button" class="sc-ph-pick" data-ph="${_scEsc(p.key)}" ${at(p, i)} aria-label="Đổi ảnh cảnh ${_scEsc(c.label)}">
        <span class="sc-ph-thumb" style="aspect-ratio:${p.w} / ${p.h}">${_scIco("image-plus")}${img(p)}</span>
      </button>
      <div class="sc-ph-side">
        <p class="sc-ph-src">${own ? "Ảnh của bạn" : demo ? "Ảnh mẫu" : "Ảnh của thiệp"}</p>
        <div class="sc-ph-acts">
          <button type="button" class="sc-ph-act" data-ph="${_scEsc(p.key)}" ${at(p, i)}>${_scIco("image-up")}Đổi ảnh</button>
          ${
            own
              ? `<button type="button" class="sc-ph-act" data-ph-focal="${_scEsc(p.key)}" ${at(p, i)}>${_scIco("focus")}Lấy nét</button>
          <button type="button" class="sc-ph-act" data-ph-undo="${_scEsc(p.key)}" data-i="${i}">${_scIco("undo-2")}${back}</button>`
              : ""
          }
        </div>
      </div>`;
    } else {
      box.classList.add("sc-ph-many");
      box.innerHTML = `
      <p class="sc-ph-head">Cảnh có ${c.photos.length} ảnh. Bấm vào ảnh để đổi.</p>
      <div class="sc-ph-grid">${c.photos
        .map((p, n) => {
          const own = _scPh.map[p.key];
          return `<div class="sc-ph-cell${own ? " sc-ph-own" : ""}">
          <button type="button" class="sc-ph-pick" data-ph="${_scEsc(p.key)}" ${at(p, i)} aria-label="Đổi ảnh ${n + 1} của cảnh ${_scEsc(c.label)}">
            <span class="sc-ph-thumb">${_scIco("image-plus")}${img(p)}</span>
          </button>${
            own
              ? `<div class="sc-ph-mini">
            <button type="button" class="sc-ph-ic" data-ph-focal="${_scEsc(p.key)}" ${at(p, i)} title="Lấy nét" aria-label="Lấy nét ảnh ${n + 1}">${_scIco("focus")}</button>
            <button type="button" class="sc-ph-ic" data-ph-undo="${_scEsc(p.key)}" data-i="${i}" title="${back}" aria-label="${back} cho ảnh ${n + 1}">${_scIco("undo-2")}</button>
          </div>`
              : ""
          }
        </div>`;
        })
        .join("")}</div>`;
    }
    window.lucide?.createIcons({ root: box });
  });
}

// Đang xuất thì khung không nhận ảnh mới (nó đang vẽ bộ cũ) — chặn luôn ở đây cho khỏi lệch.
function _scPhBusy() {
  if (_scExState !== "run") return false;
  window.showToast?.("Đang xuất video, đợi xong rồi hãy đổi ảnh", "warning");
  return true;
}

// Bảng lấy nét dạng Promise: {x, y} (%) khi bấm Áp dụng, null khi đóng/huỷ. Xem trước đúng
// khổ khung ảnh của cảnh (w × h theo toạ độ mẫu).
let _scUtilsReq = null;
function _scUtils() {
  if (typeof openFocalPointPicker === "function") return Promise.resolve();
  _scUtilsReq ||= new Promise((resolve, reject) => {
    const sc = document.createElement("script");
    sc.src = "/core/utils.js" + (CONFIG.version ? "?v=" + CONFIG.version : "");
    sc.onload = resolve;
    sc.onerror = () => {
      _scUtilsReq = null;
      sc.remove();
      reject(new Error("utils"));
    };
    document.head.appendChild(sc);
  });
  return _scUtilsReq;
}

async function _scPhFocal(src, current, w, h) {
  try {
    await _scUtils();
  } catch (e) {
    window.showToast?.("Không mở được bảng lấy nét, bạn thử lại nhé", "error");
    return null;
  }
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => {
      if (done) return;
      done = true;
      obs.disconnect();
      resolve(v);
    };
    // Bảng gọi callback TRƯỚC khi gỡ thẻ nên lượt Áp dụng luôn thắng lượt "thẻ biến mất".
    const obs = new MutationObserver(() => !document.getElementById("focal-modal") && finish(null));
    openFocalPointPicker(src, current || { x: 50, y: 50 }, (pt) => finish({ x: pt.x, y: pt.y }), null, [
      { label: "Khung ảnh trên slide", w, h },
    ]);
    if (document.getElementById("focal-modal")) obs.observe(document.body, { childList: true, subtree: true });
    else finish(null);
  });
}

const _scPhGo = (index) =>
  _scFrame.contentWindow?.postMessage({ type: "cx-slide-go", index, pause: true }, location.origin);

_scEl("sc-cues").addEventListener("click", (e) => {
  const undo = e.target.closest("[data-ph-undo]");
  if (undo) {
    if (_scPhBusy()) return;
    scPhotoRemove(undo.dataset.phUndo, Number(undo.dataset.i));
    return;
  }
  const fb = e.target.closest("[data-ph-focal]");
  if (fb) {
    if (_scPhBusy()) return;
    _scPhGo(Number(fb.dataset.i));
    scPhotoFocal(fb.dataset.phFocal, Number(fb.dataset.i), Number(fb.dataset.w), Number(fb.dataset.h));
    return;
  }
  const b = e.target.closest("[data-ph]");
  if (!b || _scPhBusy()) return;
  _scPhPick = { key: b.dataset.ph, index: Number(b.dataset.i), w: Number(b.dataset.w), h: Number(b.dataset.h) };
  // Chiếu đúng cảnh đó để thấy ảnh mới nằm ra sao.
  _scPhGo(_scPhPick.index);
  const input = _scEl("sc-ph-file");
  input.value = "";
  input.click();
});

_scEl("sc-ph-file").addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  const pick = _scPhPick;
  e.target.value = "";
  if (!file || !pick) return;
  const H = window.ImageHelper;
  if (H && !H.isAllowedType(file)) {
    window.showToast?.("Định dạng không hỗ trợ — hãy dùng JPG, PNG hoặc WebP (ảnh iPhone .HEIC cần đổi sang JPG).", "error");
    return;
  }
  const txKey = _scTxKey();
  let buf;
  let type;
  window.showLoading?.(true, "Đang xử lý ảnh...");
  try {
    const out = H ? (await H.prepareImage(file, _SC_PH_LIMITS)).file : file;
    buf = await out.arrayBuffer();
    type = out.type || file.type;
    if (!buf.byteLength) throw new Error("empty");
  } catch (err) {
    window.showToast?.(err?.message && err.message !== "empty" ? err.message : "Không đọc được ảnh này, bạn chọn lại nhé", "error");
    return;
  } finally {
    window.showLoading?.(false);
  }
  const blob = new Blob([buf], { type });
  const url = URL.createObjectURL(blob);
  // Huỷ bảng lấy nét = bỏ ảnh vừa chọn, giống trang Thiết lập.
  const focal = await _scPhFocal(url, null, pick.w, pick.h);
  if (!focal || _scPh.key !== txKey) {
    URL.revokeObjectURL(url);
    return;
  }
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  try {
    await _scDbDo("readwrite", (st) => st.put({ id, buf, type, name: file.name, focal }, `${txKey}|${pick.key}`));
  } catch (err) {
    console.warn("Không lưu được ảnh slide:", err);
    window.showToast?.("Máy không cho lưu ảnh (bộ nhớ trình duyệt đầy hoặc đang ở chế độ ẩn danh)", "warning");
  }
  if (_scPh.key !== txKey) return URL.revokeObjectURL(url); // đã đổi mẫu / thiệp trong lúc lưu
  const old = _scPh.map[pick.key];
  if (old) URL.revokeObjectURL(old.url);
  _scPh.map[pick.key] = { id, blob, url, focal };
  _scPhRender();
  _scPhSend(pick.index);
});

// Chỉnh lại điểm lấy nét của ảnh đã tải lên.
async function scPhotoFocal(key, index, w, h) {
  const txKey = _scTxKey();
  const own = _scPh.map[key];
  if (!own) return;
  const focal = await _scPhFocal(own.url, own.focal, w, h);
  if (!focal || _scPh.key !== txKey || _scPh.map[key] !== own) return;
  own.focal = focal;
  try {
    const dbKey = `${txKey}|${key}`;
    await _scDbDo("readwrite", (st) => {
      const rq = st.get(dbKey);
      rq.onsuccess = () => rq.result && st.put({ ...rq.result, focal }, dbKey);
      return rq;
    });
  } catch (err) {
    console.warn("Không lưu được điểm lấy nét:", err);
  }
  _scPhRender();
  _scPhSend(index);
}

async function scPhotoRemove(key, index) {
  const txKey = _scTxKey();
  try {
    await _scDbDo("readwrite", (st) => st.delete(`${txKey}|${key}`));
  } catch (e) {}
  if (_scPh.key !== txKey) return;
  const old = _scPh.map[key];
  if (old) URL.revokeObjectURL(old.url);
  delete _scPh.map[key];
  _scPhRender();
  _scPhSend(index);
}

async function scPhotosReset() {
  if (_scPhBusy()) return;
  const txKey = _scTxKey();
  try {
    const prefix = txKey + "|";
    await _scDbDo("readwrite", (st) => st.delete(IDBKeyRange.bound(prefix, prefix + "\uffff")));
  } catch (e) {}
  if (_scPh.key !== txKey) return;
  _scPhClear();
  _scPhRender();
  _scPhSend();
}

// ── Nhạc: file khách chọn từ máy · bài trong thư viện (CONFIG.slideMusic.library, kho ở
// cloudflare-media/); không chọn thì slide KHÔNG có nhạc — không lấy nhạc của thiệp (thường là
// YouTube, không ghép được vào video). Lựa chọn cất IndexedDB kho "music" theo thiệp, file cất
// BYTE như ảnh. Gửi sang khung: {id, blob} · {url} · null — khung phát + ghép vào video xuất ra.
const _SC_MU_MAX = 30 * 1024 * 1024;
const _SC_MU_EXT = /\.(mp3|m4a|aac|wav)$/i;
let _scMu = { key: null, pick: null }; // pick: {mode:"file", id, blob, name, dur} | {mode:"lib", id} | null
let _scLib = null; // bài trong thư viện; null = chưa tải
let _scLibReq = null;
let _scPrev = null; // <audio> nghe thử bài thư viện
let _scPrevId = "";

const _scMuKey = () => (_scS.real && _scS.wid ? _scS.wid : "demo");

// Đoạn nhạc nền trên dòng thời gian (giây, cùng khuôn lớp giọng đọc): đặt ở `start`, bắt đầu từ
// giây `in` của bài (bài LẶP nếu đoạn dài hơn bài), dài `len`; `full` = khối chạy tới hết slide,
// tự dài theo khi đổi thời lượng cảnh; `fi`/`fo` = giây to dần / nhỏ dần ở hai mép (mặc định
// _SC_MU_FADE); `env` = đường âm lượng [{t: giây trong bài, g}]. Lưu localStorage theo thiệp + bài —
// đổi bài là về nguyên bài. Mức + tắt tiếng / solo của track Nhạc nền nằm ở timeline.js (_scVo.mtr).
const _SC_MU_CUT = "cx_slide_mucut";
const _SC_MU_FADE = 1.5;
const _scMuPid = (p) => (p ? `${p.mode}:${p.id}` : "");
function _scMuCutAll() {
  try {
    return JSON.parse(localStorage.getItem(_SC_MU_CUT) || "{}") || {};
  } catch (e) {
    return {};
  }
}
// Đoạn của bài đang chọn (tạo mặc định "cả slide" lần đầu); null khi chưa có nhạc. Trả CÙNG một
// object suốt phiên để dòng thời gian kéo thẳng trên nó.
function _scMuCut() {
  const p = _scMu.pick;
  if (!p) return null;
  if (!p.cut) {
    const s = _scMuCutAll()[_scMuKey()];
    const ok = s && s.pid === _scMuPid(p);
    const n = (v) => Math.max(0, Number(v) || 0);
    const f = (v) => (v == null ? _SC_MU_FADE : n(v));
    const env = ok && Array.isArray(s.env) ? s.env.filter((x) => Number.isFinite(x?.t) && Number.isFinite(x?.g)) : [];
    p.cut = ok
      ? { start: n(s.start), in: n(s.in), len: n(s.len), full: s.full !== false, fi: f(s.fi), fo: f(s.fo), env }
      : { start: 0, in: 0, len: 0, full: true, fi: _SC_MU_FADE, fo: _SC_MU_FADE, env: [] };
  }
  return p.cut;
}
function _scMuCutSave() {
  const c = _scMu.pick?.cut;
  try {
    const all = _scMuCutAll();
    const key = _scMuKey();
    if (c && (c.start > 0.01 || c.in > 0.01 || !c.full || c.fi !== _SC_MU_FADE || c.fo !== _SC_MU_FADE || c.env?.length)) {
      all[key] = { pid: _scMuPid(_scMu.pick), start: c.start, in: c.in, len: c.len, full: c.full, fi: c.fi, fo: c.fo, env: c.env || [] };
    } else delete all[key];
    localStorage.setItem(_SC_MU_CUT, JSON.stringify(all));
  } catch (e) {}
}

// Kho chưa dựng / lỗi mạng / file hỏng / quá _SC_LIB_WAIT đều ra danh sách rỗng ("Thư viện nhạc
// hiện đang chưa có") — kho là dịch vụ ngoài, không bao giờ được chặn slide.
const _SC_LIB_WAIT = 6000;
function _scLibLoad() {
  if (_scLibReq) return _scLibReq;
  const base = CONFIG.slideMusic?.library || "";
  const abs = (f) => {
    try {
      return new URL(f, base).href;
    } catch (e) {
      return "";
    }
  };
  const ctl = typeof AbortController === "function" ? new AbortController() : null;
  const timer = setTimeout(() => ctl?.abort(), _SC_LIB_WAIT);
  _scLibReq = (base ? fetch(base, { cache: "no-cache", signal: ctl?.signal }) : Promise.reject(new Error("no library")))
    .then((r) => (r.ok ? r.json() : { tracks: [] }))
    .finally(() => clearTimeout(timer))
    .catch(() => ({ tracks: [] }))
    .then((j) => {
      _scLib = (Array.isArray(j?.tracks) ? j.tracks : [])
        .filter((t) => t && t.id && t.title && t.file)
        .map((t) => ({
          id: String(t.id),
          title: String(t.title),
          artist: String(t.artist || ""),
          file: abs(String(t.file)),
          credit: String(t.credit || ""),
        }))
        .filter((t) => /^https:\/\//.test(t.file));
      _scMuRender();
      return _scLib;
    });
  return _scLibReq;
}
const _scTrack = (id) => _scLib?.find((t) => t.id === id) || null;

async function _scMuLoad() {
  const key = _scMuKey();
  if (_scMu.key === key) return;
  _scMu = { key, pick: null };
  let rec = null;
  try {
    rec = await _scDbDo("readonly", (st) => st.get(key), _SC_MU_STORE);
  } catch (e) {
    console.warn("Không đọc được nhạc slide đã lưu:", e);
  }
  if (_scMu.key !== key) return;
  if (rec?.mode === "file" && rec.buf?.byteLength) {
    _scMu.pick = { mode: "file", id: rec.id, blob: new Blob([rec.buf], { type: rec.type || "audio/mpeg" }), name: rec.name || "", dur: rec.dur || 0 };
  }
  // Bài thư viện: KHÔNG chờ kho (dịch vụ ngoài) — slide chạy ngay chưa có nhạc, kho tải xong mà
  // còn bài đó thì mới bật; kho chết thì slide chạy không nhạc.
  _scLibLoad().then(() => {
    if (rec?.mode !== "lib" || _scMu.key !== key || _scMu.pick || !_scTrack(rec.id)) return;
    _scMu.pick = { mode: "lib", id: rec.id };
    _scMuRender();
    _scMuSend();
  });
  _scMuRender();
}

// `cut` cho khung: {start, in, len, fi, fo} — len null = tới hết slide.
function _scMuMsg() {
  const p = _scMu.pick;
  const c = _scMuCut();
  const vol = typeof _scVoMuVol === "function" ? _scVoMuVol() : 1;
  const cut = c ? { start: c.start, in: c.in, len: c.full ? null : c.len, fi: c.fi, fo: c.fo, vol, env: c.env || [] } : null;
  if (p?.mode === "file") return { id: p.id, blob: p.blob, cut };
  if (p?.mode === "lib") return { url: _scTrack(p.id)?.file || "", cut };
  return null;
}

function _scMuSend() {
  _scFrame.contentWindow?.postMessage({ type: "cx-slide-music", music: _scMuMsg() }, location.origin);
}

function _scMuBusy() {
  if (_scExState !== "run") return false;
  window.showToast?.("Đang xuất video, đợi xong rồi hãy đổi nhạc", "warning");
  return true;
}

async function _scMuSave(rec) {
  const key = _scMuKey();
  try {
    await _scDbDo("readwrite", (st) => (rec ? st.put(rec, key) : st.delete(key)), _SC_MU_STORE);
  } catch (e) {
    console.warn("Không lưu được nhạc slide:", e);
    if (rec) window.showToast?.("Máy không cho lưu nhạc (bộ nhớ trình duyệt đầy hoặc đang ở chế độ ẩn danh)", "warning");
  }
  return _scMuKey() === key;
}

function scMusicPick() {
  if (_scMuBusy()) return;
  const input = _scEl("sc-mu-file");
  input.value = "";
  input.click();
}

// Thời lượng file nhạc (giây); 0 khi trình duyệt không đọc được file.
function _scAudioDur(blob) {
  return new Promise((resolve) => {
    const a = new Audio();
    const url = URL.createObjectURL(blob);
    const done = (d) => {
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(d) ? d : 0);
    };
    const t = setTimeout(() => done(0), 8000);
    a.onloadedmetadata = () => (clearTimeout(t), done(a.duration));
    a.onerror = () => (clearTimeout(t), done(0));
    a.preload = "metadata";
    a.src = url;
  });
}

_scEl("sc-mu-file").addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  e.target.value = "";
  if (!file) return;
  if (!_SC_MU_EXT.test(file.name) && !/^audio\//.test(file.type)) {
    window.showToast?.("Hãy chọn file nhạc MP3, M4A hoặc WAV", "error");
    return;
  }
  if (file.size > _SC_MU_MAX) {
    window.showToast?.("File nhạc quá 30 MB, hãy chọn file nhỏ hơn", "error");
    return;
  }
  let buf;
  try {
    buf = await file.arrayBuffer();
    if (!buf.byteLength) throw new Error("empty");
  } catch (err) {
    window.showToast?.("Không đọc được file nhạc này, bạn chọn lại nhé", "error");
    return;
  }
  const type = file.type || "audio/mpeg";
  const blob = new Blob([buf], { type });
  const dur = await _scAudioDur(blob);
  if (!dur) {
    window.showToast?.("Trình duyệt không phát được file này. Hãy đổi sang MP3 rồi chọn lại.", "error");
    return;
  }
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  if (!(await _scMuSave({ mode: "file", id, buf, type, name: file.name, dur }))) return;
  _scMu.pick = { mode: "file", id, blob, name: file.name, dur };
  _scMuCutSave(); // bài mới: về nguyên bài
  _scPreviewStop();
  _scMuRender();
  _scMuSend();
  window.showToast?.("Đã dùng file nhạc của bạn", "success");
});

async function scMusicLib(id) {
  if (_scMuBusy() || !_scTrack(id)) return;
  if (!(await _scMuSave({ mode: "lib", id }))) return;
  _scMu.pick = { mode: "lib", id };
  _scMuCutSave();
  _scPreviewStop();
  _scMuRender();
  _scMuSend();
}

async function scMusicClear() {
  if (_scMuBusy()) return;
  if (!(await _scMuSave(null))) return;
  _scMu.pick = null;
  _scMuCutSave();
  _scMuRender();
  _scMuSend();
}

// Nghe thử một bài thư viện ngay trên trang (không đổi nhạc của slide).
function scMusicPreview(id) {
  const t = _scTrack(id);
  if (!t) return;
  if (_scPrevId === id) return _scPreviewStop();
  _scPreviewStop();
  _scPrev = new Audio(t.file);
  _scPrevId = id;
  _scPrev.onended = _scPreviewStop;
  _scPrev.play().catch(_scPreviewStop);
  _scMuRender();
}
function _scPreviewStop() {
  _scPrev?.pause();
  _scPrev = null;
  _scPrevId = "";
  _scMuRender();
}

// Nhạc nền đang dùng cho làn Nhạc + bảng lớp đang chọn (voice.js); null khi chưa có.
function _scMuInfo() {
  const p = _scMu.pick;
  if (p?.mode === "file") {
    return { name: p.name || "File nhạc của bạn", desc: `File của bạn${p.dur ? `, dài ${_scClock(p.dur * 1000)}` : ""}. Có trong video xuất ra.` };
  }
  const track = p?.mode === "lib" ? _scTrack(p.id) : null;
  if (!track) return null;
  return { name: track.title, desc: `${track.artist ? track.artist + ". " : ""}Từ thư viện nhạc, có trong video xuất ra.`, credit: track.credit };
}

// Bảng thư viện nhạc dưới dòng thời gian — mở từ nút ở đầu làn Nhạc nền.
function scMusicLibOpen(on) {
  // Bàn dựng phim: nút mở nằm ở dock, còn bảng thư viện ở tab Âm thanh.
  if (on && _SC_STUDIO.matches) scTab("audio");
  _scToggle("sc-mu-libbox", on);
  if (!on) return _scPreviewStop();
  _scLibLoad();
  _scEl("sc-mu-libbox").scrollIntoView({ behavior: "smooth", block: "nearest" });
}

// Bỏ dấu + chữ thường để gõ "vay cuoi" vẫn ra "Váy Cưới".
const _scFold = (s) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .trim();

function _scMuRender() {
  const p = _scMu.pick;
  const track = p?.mode === "lib" ? _scTrack(p.id) : null;

  const box = _scEl("sc-mu-lib");
  _scEl("sc-mu-search").classList.toggle("hidden", !_scLib?.length);
  const words = _scFold(_scEl("sc-mu-q").value).split(/\s+/).filter(Boolean);
  const shown = (_scLib || []).filter((t) => {
    const hay = _scFold(`${t.title} ${t.artist}`);
    return words.every((w) => hay.includes(w));
  });
  if (_scLib === null) {
    box.innerHTML = `<p class="sc-mu-empty">Đang tải thư viện nhạc…</p>`;
  } else if (!_scLib.length) {
    box.innerHTML = `<p class="sc-mu-empty">Thư viện nhạc hiện đang chưa có</p>`;
  } else if (!shown.length) {
    box.innerHTML = `<p class="sc-mu-empty">Không có bài nào khớp với “${_scEsc(_scEl("sc-mu-q").value.trim())}”</p>`;
  } else {
    box.innerHTML = shown
      .map((t) => {
        const on = track?.id === t.id;
        const playing = _scPrevId === t.id;
        return `<div class="sc-mu-item${on ? " is-on" : ""}">
          <button type="button" class="sc-mu-play" data-mu-prev="${_scEsc(t.id)}" aria-label="${playing ? "Dừng nghe thử" : "Nghe thử"} ${_scEsc(t.title)}">${_scIco(playing ? "pause" : "play")}</button>
          <button type="button" class="sc-mu-pick" data-mu-lib="${_scEsc(t.id)}" role="radio" aria-checked="${on}">
            <span class="sc-mu-name">${_scEsc(t.title)}</span>
            ${t.artist ? `<span class="sc-mu-artist">${_scEsc(t.artist)}</span>` : ""}
          </button>
          ${on ? `<span class="sc-mu-check" aria-hidden="true">${_scIco("check")}</span>` : ""}
        </div>`;
      })
      .join("");
    window.lucide?.createIcons({ root: box });
  }
  const credit = _scEl("sc-mu-credit");
  credit.textContent = track?.credit || "";
  credit.classList.toggle("hidden", !track?.credit);
  // Làn Nhạc của dòng thời gian (voice.js) hiện tên bài đang chọn.
  if (typeof _scVoOnCues === "function") _scVoOnCues();
}

_scEl("sc-mu-lib").addEventListener("click", (e) => {
  const prev = e.target.closest("[data-mu-prev]");
  if (prev) return scMusicPreview(prev.dataset.muPrev);
  const pick = e.target.closest("[data-mu-lib]");
  if (pick) scMusicLib(pick.dataset.muLib);
});
_scEl("sc-mu-q").addEventListener("input", () => {
  _scMuRender();
  _scEl("sc-mu-lib").scrollTop = 0;
});

// Chiều cao tiêu đề trang → mốc ghim của dải tab ở cột phải (từ lg, xem .sc-tabs-bar).
if (typeof ResizeObserver === "function") {
  const head = _scEl("sc-head");
  new ResizeObserver(() => head.parentElement.style.setProperty("--sc-head-h", `${head.offsetHeight}px`)).observe(head);
}

// Bố cục bàn dựng phim (dòng thời gian ở dock đáy) — chuỗi phải khớp @media của .sc-studio ở
// styles/_slide-cuoi.css.
const _SC_STUDIO = matchMedia("(min-width: 1024px) and (min-height: 600px)");

// ── Các tab của bảng chỉnh (Cảnh · Thiệp · Âm thanh · Mẫu): một dải .cx-seg, con trượt theo --i. ──
const _SC_TABS = ["scenes", "data", "audio", "tpl"];
function scTab(id) {
  const i = Math.max(0, _SC_TABS.indexOf(id));
  const seg = _scEl("sc-tabs");
  seg.style.setProperty("--i", String(i));
  seg.querySelectorAll("[data-tab]").forEach((b) => {
    const on = b.dataset.tab === _SC_TABS[i];
    b.classList.toggle("is-on", on);
    b.setAttribute("aria-selected", String(on));
    b.tabIndex = on ? 0 : -1;
  });
  _SC_TABS.forEach((t, k) => _scToggle(`sc-tab-${t}`, k === i));
  // Dòng thời gian đo theo bề ngang khung — chỉ vẽ được khi tab đã hiện.
  if (_SC_TABS[i] === "audio" && typeof _scVoRender === "function") _scVoRender();
}
_scEl("sc-tabs").addEventListener("click", (e) => {
  const b = e.target.closest("[data-tab]");
  if (b) scTab(b.dataset.tab);
});
// Mũi tên trái/phải chuyển tab (mẫu tablist chuẩn).
_scEl("sc-tabs").addEventListener("keydown", (e) => {
  const d = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
  if (!d) return;
  e.preventDefault();
  const cur = _SC_TABS.findIndex((t) => _scEl(`sc-tabbtn-${t}`).classList.contains("is-on"));
  const next = _SC_TABS[(cur + d + _SC_TABS.length) % _SC_TABS.length];
  scTab(next);
  _scEl(`sc-tabbtn-${next}`).focus();
});

// ── Gõ chữ trên điện thoại: bàn phím ảo chiếm nửa dưới màn, khung chiếu dính đầu trang chiếm phần
// trên → ô đang gõ hết chỗ. Lúc gõ (dưới lg) đặt cờ html.sc-typing: khung chiếu thôi dính, thanh
// tab dưới ẩn, ô gõ cao tối đa bằng phần còn nhìn thấy (--sc-kb-h). Chỉ cuộn ô vào giữa ĐÚNG lúc
// bàn phím mọc lên — vuốt trang làm thanh địa chỉ ẩn/hiện cũng đổi khổ visualViewport, cuộn theo
// đó là kéo trang về ô mãi. Bàn phím cụp xuống (ô vẫn focus — nút Back của Android) = gõ xong:
// bỏ chọn ô, trả khung chiếu về chỗ.
const _SC_TYPE_SEL = "textarea, input[type=text], input[type=search], input:not([type])";
const _SC_KB_MIN = 120; // vùng nhìn thấy hụt hơn chừng này px so với cửa sổ = đang có bàn phím
let _scTypeT = 0;
let _scKbOn = false;
let _scTypeScroll = false; // còn nợ một lần cuộn ô vào giữa (đặt khi focus)
const _scTyping = () => document.documentElement.classList.contains("sc-typing");
const _scKbNow = () => !!window.visualViewport && innerHeight - visualViewport.height > _SC_KB_MIN;

function _scTypeFit() {
  const el = document.activeElement;
  if (!_scTyping() || !el?.matches?.(_SC_TYPE_SEL)) return;
  const vv = window.visualViewport;
  document.documentElement.style.setProperty("--sc-kb-h", `${Math.round(vv ? vv.height : innerHeight)}px`);
  const kb = _scKbNow();
  if (_scKbOn && !kb) {
    _scKbOn = false;
    el.blur();
    return;
  }
  // Cuộn MỘT lần: lúc bàn phím vừa mọc (hoặc máy không đo được bàn phím — ngay sau focus).
  if (kb && !_scKbOn) _scTypeScroll = true;
  _scKbOn = kb;
  if (!_scTypeScroll || (window.visualViewport && !kb)) return;
  _scTypeScroll = false;
  el.scrollIntoView({ block: "center" });
}
document.addEventListener("focusin", (e) => {
  if (!e.target.matches?.(_SC_TYPE_SEL) || !e.target.closest(".sc-panel")) return;
  if (!matchMedia("(max-width: 1023px)").matches) return;
  clearTimeout(_scTypeT);
  document.documentElement.classList.add("sc-typing");
  _scTypeScroll = true;
  // Bàn phím mọc lên sau focus một nhịp (iPhone còn trượt trang) — đo lại vài lần.
  [60, 350, 700].forEach((ms) => setTimeout(_scTypeFit, ms));
});
document.addEventListener("focusout", () => {
  clearTimeout(_scTypeT);
  // Chuyển sang ô kế tiếp thì giữ nguyên cờ, khỏi nhảy khung chiếu.
  _scTypeT = setTimeout(() => {
    if (document.activeElement?.matches?.(_SC_TYPE_SEL)) return;
    document.documentElement.classList.remove("sc-typing");
    _scKbOn = _scTypeScroll = false;
  }, 200);
});
window.visualViewport?.addEventListener("resize", _scTypeFit);

// ── Toàn màn hình: phóng cả iframe; máy không có Fullscreen API (iPhone) thì phủ kín bằng CSS ──
const _scFsEl = () => document.fullscreenElement || document.webkitFullscreenElement;
function _scFullSync() {
  const on = !!_scFsEl() || _scBox.classList.contains("is-full");
  _scFrame.contentWindow?.postMessage({ type: "cx-slide-full-state", on }, location.origin);
}
function _scPseudo(on) {
  _scBox.classList.toggle("is-full", on);
  document.documentElement.classList.toggle("sc-lock", on);
  _scFullSync();
  if (on) _scFrame.focus();
}
function scFullscreen() {
  if (_scFsEl()) {
    (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    return;
  }
  if (_scBox.classList.contains("is-full")) return _scPseudo(false);
  const req = _scFrame.requestFullscreen || _scFrame.webkitRequestFullscreen;
  if (!req || !(document.fullscreenEnabled || document.webkitFullscreenEnabled)) return _scPseudo(true);
  const r = req.call(_scFrame);
  if (r?.then) r.then(() => _scFrame.focus(), () => _scPseudo(true));
  else _scFrame.focus();
}
document.addEventListener("fullscreenchange", _scFullSync);
document.addEventListener("webkitfullscreenchange", _scFullSync);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && _scBox.classList.contains("is-full")) _scPseudo(false);
});

// ── Màn chiếu: đặt khung slide lên ảnh hội trường (đúng bố cục video TikTok) để xem slide
// trông ra sao trên sân khấu. Chỉ đổi CSS của khung — iframe không nạp lại, không mất cảnh đang chiếu.
function scHall(on) {
  const stage = _scBox.closest(".sc-stage");
  on = typeof on === "boolean" ? on : !stage.classList.contains("is-hall");
  stage.classList.toggle("is-hall", on);
  _scEl("sc-hall-btn")?.setAttribute("aria-pressed", String(on));
}

// ── Thiệp của tài khoản ──
// Mọi thiệp đã lưu của tài khoản đều dùng được, không xét gói/thanh toán — cái bán là
// MẪU slide, không phải quyền lấy dữ liệu.
function _scState(state) {
  ["loading", "guest", "empty", "error"].forEach((s) => _scToggle(`sc-st-${s}`, s === state));
  _scToggle("sc-weddings", state === "list");
}

function _scCardHTML(w) {
  const names = [w.groom_name, w.bride_name].filter(Boolean).join(" & ") || "Thiệp cưới";
  const file = w.cover_image_url || (w.gallery_images || [])[0] || "";
  const cover = file ? storageDAL.getPublicUrl(file) : "";
  const on = w.id === _scS.wid;
  const tag = w.is_published
    ? `<span class="mi-tag mi-tag--live">${_scIco("badge-check")}Đã xuất bản</span>`
    : `<span class="mi-tag mi-tag--trial">${_scIco("pencil-line")}Nháp</span>`;
  return `
    <button type="button" class="sc-w" role="radio" data-wid="${_scEsc(w.id)}" aria-checked="${on}">
      <span class="sc-w-thumb">${_scIco("image")}${cover ? `<img src="${_scEsc(cover)}" alt="" loading="lazy" onerror="this.remove()" />` : ""}</span>
      <span class="sc-w-info">
        ${tag}
        <span class="sc-w-names">${_scEsc(names)}</span>
        <span class="sc-w-meta">${w.slug ? "/" + _scEsc(w.slug) : ""}</span>
      </span>
      <span class="sc-w-dot" aria-hidden="true"></span>
    </button>`;
}

function _scRenderList() {
  const box = _scEl("sc-weddings");
  box.innerHTML = _scList.map(_scCardHTML).join("");
  window.lucide?.createIcons({ root: box });
}

async function scLoadList() {
  const seq = ++_scSeq;
  if (!_scS.user) {
    _scState("guest");
    return;
  }
  _scState("loading");
  let rows;
  try {
    rows = await weddingDAL.listMyWeddings();
  } catch (e) {
    if (seq === _scSeq) _scState("error");
    return;
  }
  if (seq !== _scSeq) return;
  // Thiệp đã xuất bản lên trước, trong mỗi nhóm thiệp mới tạo đứng đầu.
  _scList = rows.sort(
    (a, b) => !!b.is_published - !!a.is_published || new Date(b.created_at || 0) - new Date(a.created_at || 0),
  );
  if (!_scList.length) {
    _scState("empty");
    return;
  }
  if (_scS.wid && !_scList.some((w) => w.id === _scS.wid)) _scS.wid = null;
  // Chỉ có một thiệp thì chọn sẵn.
  if (!_scS.wid && _scList.length === 1) _scS.wid = _scList[0].id;
  _scRenderList();
  _scState("list");
  // Thiệp đã chọn nằm khuất trong dải ngang → cuộn dải (chỉ dải, không kéo cả trang) cho nó lộ ra.
  const box = _scEl("sc-weddings");
  const sel = box.querySelector('[aria-checked="true"]');
  if (sel) box.scrollLeft += sel.getBoundingClientRect().left - box.getBoundingClientRect().left - parseFloat(getComputedStyle(box).paddingLeft);
  if (_scS.wid) scPick(_scS.wid, true);
}

async function scPick(id, again) {
  const w = _scList?.find((x) => x.id === id);
  if (!w || (!again && id === _scS.wid && _scData.has(id))) return;
  _scS.wid = id;
  _scSave();
  _scEl("sc-weddings").querySelectorAll("[data-wid]").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.wid === id)));
  if (!_scData.has(id)) {
    const btn = _scEl("sc-weddings").querySelector(`[data-wid="${CSS.escape(id)}"]`);
    btn?.classList.add("is-busy");
    _scWaitHold("Đang tải ảnh thiệp…");
    try {
      _scData.set(id, await weddingDAL.getWeddingById(id));
    } catch (e) {
      btn?.classList.remove("is-busy");
      _scWaitDone();
      if (_scS.wid === id) {
        _scS.wid = null;
        btn?.setAttribute("aria-checked", "false");
      }
      window.showToast?.("Không lấy được dữ liệu thiệp, hãy thử lại", "error");
      return;
    }
    btn?.classList.remove("is-busy");
    // _scPush giữ màn chờ của nó ngay khi gọi → nhả lượt đọc thiệp SAU đó, khỏi nháy.
    if (_scS.wid === id) _scPush();
    _scWaitDone();
    return;
  }
  if (_scS.wid !== id) return;
  _scPush();
}

_scEl("sc-weddings").addEventListener("click", (e) => {
  const b = e.target.closest("[data-wid]");
  if (b) scPick(b.dataset.wid);
});

// ── Công tắc "Lấy dữ liệu từ thiệp" ──
const _scCheck = _scEl("sc-use-real");
_scCheck.addEventListener("change", () => {
  _scS.real = _scCheck.checked;
  _scSave();
  _scToggle("sc-real", _scS.real);
  if (_scS.real && _scList === null) scLoadList();
  _scPush();
});

function scLogin() {
  if (!window.AuthUI) return;
  AuthUI.openModal({
    title: "Đăng nhập",
    subtitle: "Đăng nhập để lấy dữ liệu từ thiệp của bạn",
    oauthRedirect: window.location.origin + window.location.pathname,
  });
}

(async function initSlidePage() {
  _scRestore();
  _scRenderTpls();
  _scCheck.checked = _scS.real;
  _scToggle("sc-real", _scS.real);
  _scFrameLoad();
  // F5 khi đang dùng thiệp thật: giữ màn chờ qua lúc lấy phiên + danh sách thiệp, không thì
  // khung dựng xong bộ dữ liệu mẫu là trang mở khoá rồi lại khoá khi ảnh thiệp về.
  const hold = _scS.real && !!_scS.wid;
  if (hold) _scWaitHold("Đang tải ảnh thiệp…");
  try {
    _scS.user = await CXAuth.getUser();
    if (_scS.real) await scLoadList();
  } finally {
    if (hold) _scWaitDone();
  }
  // Lấy phiên TRƯỚC rồi mới nghe onChange, không thì lần đồng bộ đầu tải hai lần.
  // Làm mới token cũng báo về đây — cùng người thì giữ nguyên lựa chọn.
  CXAuth.onChange((user) => {
    if ((user?.id || null) === (_scS.user?.id || null)) return;
    _scS.user = user;
    _scList = null;
    _scData.clear();
    if (!user) _scS.wid = null;
    if (_scS.real) scLoadList();
    _scPush();
  });
})();

// ── Xuất video: chạy TRONG khung slide (CXSlideExport), trang này chỉ chọn khổ + báo tiến độ ──

function _scCaps(m) {
  _scCapsOk = { h1080: !!m.h1080, h2160: !!m.h2160, tiktok: !!m.tiktok, audio: String(m.audio || "") };
  // Máy không mã hoá nổi 4K thì khoá ô 4K, tự về 1080p.
  const b4k = _scEl("sc-ex-res").querySelector('[data-res="2160"]');
  b4k.disabled = !_scCapsOk.h2160;
  if (!_scCapsOk.h2160 && _scExRes === 2160) _scPickRes(1080);
  else if (!_scCapsOk.tiktok && _scExRes === "tiktok" && _scCapsOk.h1080) _scPickRes(1080);
  _scEl("sc-ex-res").querySelector('[data-res="tiktok"]').disabled = !_scCapsOk.tiktok;
  _scExportNote();
}

const _scResOf = (b) => (b.dataset.res === "tiktok" ? "tiktok" : Number(b.dataset.res));
const _scResName = (r) => (r === "tiktok" ? "TikTok" : r === 2160 ? "4K" : "1080p");

function _scPickRes(res) {
  _scExRes = res;
  const seg = _scEl("sc-ex-res");
  seg.querySelectorAll("[data-res]").forEach((b, i) => {
    const on = _scResOf(b) === res;
    b.classList.toggle("is-on", on);
    b.setAttribute("aria-pressed", String(on));
    if (on) seg.style.setProperty("--i", String(i));
  });
  _scExportNote();
}

_scEl("sc-ex-res").addEventListener("click", (e) => {
  const b = e.target.closest("[data-res]");
  if (b && !b.disabled) _scPickRes(_scResOf(b));
});

function _scExportNote() {
  const notes = [];
  if (_scCapsOk && !_scCapsOk.h1080) notes.push("Trình duyệt này chưa xuất được video. Hãy mở bằng Chrome hoặc Edge bản mới trên máy tính.");
  else {
    if (_scCapsOk && !_scCapsOk.h2160) notes.push("Máy này không mã hoá được 4K, chỉ xuất được 1080p.");
    if (_scExRes === "tiktok")
      notes.push("Video dọc 2K (1440×2560) để đăng TikTok, slide đặt trên màn chiếu hội trường.");
    if (_scExRes === 2160) notes.push("4K xuất lâu hơn và file nặng hơn khoảng 2,5 lần.");
    const voice = typeof _scVo !== "undefined" && _scVo.clips.some((c) => !c.mute);
    if (!_scMusic && !voice) notes.push("Slide chưa có nhạc nên video xuất ra sẽ không có tiếng. Chọn nhạc hoặc thêm giọng đọc ở tab Âm thanh.");
    if ((_scMusic === "file" || voice) && _scCapsOk && !_scCapsOk.audio)
      notes.push("Trình duyệt này không ghép được tiếng vào video, file xuất ra sẽ không có tiếng. Hãy dùng Chrome hoặc Edge bản mới.");
  }
  _scEl("sc-ex-note").textContent = notes.join(" ");
}

// Nút "Xuất video" kiêm thanh tiến độ: đang xuất thì nhãn thành phần trăm và nền tô dần
// (--p), xong thì "Tải lại video" — đóng thẻ nổi vẫn theo dõi được; nút "Huỷ" cạnh nó chỉ
// hiện lúc đang xuất.
function _scExportBtn(p) {
  const btn = _scEl("sc-export-open");
  const label = _scEl("sc-ex-btn-label");
  if (!btn || !label) return;
  btn.classList.toggle("is-run", _scExState === "run");
  _scToggle("sc-ex-stop", _scExState === "run");
  btn.closest(".sc-bar")?.classList.toggle("is-run", _scExState === "run");
  btn.style.setProperty("--p", String(_scExState === "run" ? (p || 0) / 100 : 0));
  label.textContent =
    _scExState === "run" ? `Đang xuất ${p || 0}%` : _scExState === "done" ? "Tải lại video" : "Xuất video";
}

function _scExportState(state, note) {
  _scExState = state;
  ["pick", "run", "done", "error"].forEach((k) => _scToggle(`sc-ex-${k}`, k === state));
  if (state === "error") _scEl("sc-ex-error-note").textContent = note || "";
  if (state !== "run") {
    _scWake?.release?.().catch(() => {});
    _scWake = null;
  }
  _scExportBtn(0);
  _scEl("sc-export").place?.(); // nội dung đổi khổ → đặt lại thẻ theo nút
}

// Bấm nút: mở/đóng thẻ nổi. Đang xuất hoặc đã xong thì mở đúng trạng thái đó; còn lại về
// bước chọn khổ. `again` (nút Thử lại) = về bước chọn khổ, giữ thẻ mở.
function scExportOpen(again) {
  const pop = _scEl("sc-export");
  if (again) {
    _scExportState("pick");
    _scExportNote();
    return pop.open?.(_scEl("sc-export-open"));
  }
  if (pop.isOpen) return pop.close();
  if (_scExState !== "run" && _scExState !== "done") _scExportState("pick");
  _scExportNote();
  pop.open?.(_scEl("sc-export-open"));
}

async function scExportStart() {
  if (_scCapsOk && !_scCapsOk.h1080) return;
  _scExBlob = null;
  _scEl("sc-ex-fill").style.transform = "scaleX(0)";
  _scEl("sc-ex-pct").textContent = "0%";
  _scExportState("run");
  // Giữ màn sáng suốt lúc xuất — máy tắt màn là trình duyệt bóp tốc độ tab.
  try {
    _scWake = await navigator.wakeLock?.request("screen");
  } catch (e) {}
  _scFrame.contentWindow?.postMessage({ type: "cx-slide-export", height: _scExRes }, location.origin);
}

function scExportCancel() {
  _scFrame.contentWindow?.postMessage({ type: "cx-slide-export-cancel" }, location.origin);
}

function _scExportMsg(m) {
  if (m.state === "run") {
    if (_scExState !== "run") _scExportState("run");
    const p = Math.round((Number(m.p) || 0) * 100);
    _scEl("sc-ex-pct").textContent = `${p}%`;
    _scEl("sc-ex-fill").style.transform = `scaleX(${p / 100})`;
    _scExportBtn(p);
  } else if (m.state === "done" && m.blob) {
    _scExBlob = m.blob;
    const mb = Math.max(1, Math.round(m.blob.size / 1048576));
    _scEl("sc-ex-done-note").textContent =
      `File MP4 ${_scResName(_scExRes)}, ${mb} MB.` +
      ({
        music: " Video có giọng đọc nhưng thiếu nhạc nền vì không đọc được file nhạc.",
        voice: " Có lớp giọng đọc không đọc được nên bị bỏ khỏi video. Hãy đổi file đó sang MP3 rồi tải lại.",
        codec: " Video không có tiếng vì trình duyệt này không ghép được tiếng. Hãy dùng Chrome hoặc Edge bản mới.",
        decode:
          _scMu.pick?.mode === "lib"
            ? " Video không có tiếng vì không tải được bài nhạc trong thư viện. Hãy thử lại sau hoặc chọn file từ máy."
            : " Video không có tiếng vì không đọc được file nhạc. Hãy đổi sang MP3 rồi chọn lại.",
      }[m.mute] || "");
    _scExportState("done");
    scExportSave();
  } else if (m.state === "cancel") {
    _scExportState("pick");
  } else if (m.state === "error") {
    _scExportState(
      "error",
      m.code === "UNSUPPORTED"
        ? "Máy này không mã hoá được video khổ này. Hãy chọn 1080p hoặc mở bằng Chrome, Edge bản mới."
        : "Máy có thể đã hết bộ nhớ giữa chừng. Đóng bớt tab khác rồi thử lại, hoặc chọn 1080p.",
    );
  }
}

function scExportSave() {
  if (!_scExBlob) return;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(_scExBlob);
  a.download = `slide-cuoi-${_scExRes === "tiktok" ? "tiktok" : _scExRes === 2160 ? "4k" : "1080p"}.mp4`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 60000);
}
