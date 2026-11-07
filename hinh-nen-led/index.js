// Trang "Hình nền LED": màn LED to chạy mẫu đang chọn (bộ vẽ slide dùng chung), nguồn thông tin là
// thiệp của tài khoản (getWeddingById, chỉ chủ thiệp) hoặc dữ liệu mẫu; tải xuống ảnh PNG
// 3840×2160 hoặc video MP4 4K nối vòng liền mạch. Mọi thứ dựng trên máy khách.

const _LED_TPLS = window.CX_LED_TEMPLATES || [];
const _ledS = { tpl: _LED_TPLS[0]?.id || "", real: false, wid: null, user: null };
let _ledList = null; // thiệp của tài khoản; null = chưa tải
let _ledSeq = 0; // ledLoadList chạy chồng: chỉ lần MỚI NHẤT được dùng
let _ledGen = 0; // dựng lại chạy chồng: chỉ lần mới nhất được dùng
const _ledData = new Map(); // id thiệp → hàng thiệp đầy đủ
const _ledP = new Map(); // id mẫu → dự án đã dựng (CXSlideEngine.build)
let _ledT0 = performance.now(); // mốc giờ của màn lớn (đặt lại khi đổi mẫu / mở toàn màn)
let _ledHold = null; // giây đang đứng khi tạm dừng; null = đang chạy
const _ledNow = () => _ledHold ?? (performance.now() - _ledT0) / 1000;
// Đặt giờ màn lớn về giây s (đang dừng thì vẫn dừng, đứng ở đó).
function _ledSetT(s) {
  if (_ledHold != null) _ledHold = s;
  else _ledT0 = performance.now() - s * 1000;
}
let _ledJob = null; // AbortController của việc tạo video đang chạy

const _ledEl = (id) => document.getElementById(id);
const _ledEsc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const _ledIco = (name) => `<i data-lucide="${name}"></i>`;
const _ledTpl = () => _LED_TPLS.find((t) => t.id === _ledS.tpl) || _LED_TPLS[0];
const _ledWed = () => (_ledS.real && _ledS.wid ? _ledData.get(_ledS.wid) || null : null);

// Lựa chọn giữ qua lần tải lại / quay về từ trang đăng nhập Google.
const _LED_PREF = "cx_led_prefs";
function _ledSave() {
  try {
    localStorage.setItem(_LED_PREF, JSON.stringify({ tpl: _ledS.tpl, real: _ledS.real, wid: _ledS.wid }));
  } catch (e) {}
}
function _ledRestore() {
  try {
    const p = JSON.parse(localStorage.getItem(_LED_PREF) || "null");
    if (!p) return;
    if (_LED_TPLS.some((t) => t.id === p.tpl)) _ledS.tpl = p.tpl;
    _ledS.real = !!p.real;
    _ledS.wid = typeof p.wid === "string" ? p.wid : null;
  } catch (e) {}
}

// ── Dựng ──
// Dữ liệu mẫu theo từng mẫu (mẫu khai `demo`): preview-data.js đọc tên mẫu thiệp từ URL, trang
// này không nằm dưới /public/themes/ nên khai thẳng.
async function _ledInput(tpl) {
  const w = _ledWed();
  if (w) return w;
  window.currentThemeName = () => tpl.demo || null;
  return cxPreviewWedding();
}

// Dựng lại mọi mẫu theo nguồn thông tin hiện tại: mẫu đang chọn trước (màn lớn), rồi tới ảnh nhỏ.
// keep: giữ nguyên giờ đang chiếu (đổi ảnh thì đứng lại đúng cảnh đó, không chạy lại từ đầu).
async function _ledBuild(keep) {
  const gen = ++_ledGen;
  await _ledPhLoad();
  if (gen !== _ledGen) return;
  const order = [_ledTpl(), ..._LED_TPLS.filter((t) => t !== _ledTpl())];
  for (const tpl of order) {
    const P = await CXSlideEngine.build(tpl, await _ledInput(tpl), _ledTexts(tpl.id), _ledPhFor(tpl.id), null);
    if (gen !== _ledGen) return;
    _ledP.set(tpl.id, P);
    if (tpl.id === _ledS.tpl) {
      if (!keep) _ledSetT(0);
      _ledSyncTpl();
    }
    _ledThumb(tpl, P);
  }
}

// Ảnh nhỏ của dải mẫu: một khung tĩnh ở giây `poster`.
function _ledThumb(tpl, P) {
  const img = _ledEl("led-grid").querySelector(`[data-tpl="${CSS.escape(tpl.id)}"] img`);
  if (!img) return;
  const cv = document.createElement("canvas");
  cv.width = 480;
  cv.height = Math.round((480 * P.H) / P.W);
  CXSlideEngine.frame(cv.getContext("2d"), P, tpl.poster ?? 0, { loop: true });
  img.src = cv.toDataURL("image/jpeg", 0.85);
}

// Thẻ mẫu cùng kiểu thẻ mẫu của Slide cưới; ảnh là khung tĩnh do _ledThumb vẽ.
function _ledRenderGrid() {
  _ledEl("led-grid").innerHTML = _LED_TPLS.map(
    (t) => `
    <button type="button" class="sc-tpl" data-tpl="${_ledEsc(t.id)}" aria-pressed="${t.id === _ledS.tpl}">
      <img class="sc-tpl-img" style="aspect-ratio: ${t.w} / ${t.h}" alt="" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" />
      <span class="sc-tpl-name">${_ledEsc(t.name)}</span>
      <span class="sc-tpl-desc">${_ledEsc(t.desc || "")}</span>
    </button>`,
  ).join("");
}
_ledEl("led-grid").addEventListener("click", (e) => {
  const b = e.target.closest("[data-tpl]");
  if (!b || b.dataset.tpl === _ledS.tpl) return;
  _ledS.tpl = b.dataset.tpl;
  _ledSave();
  _ledEl("led-grid").querySelectorAll("[data-tpl]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
  _ledSyncTpl();
  _ledSetT(0);
});

// Tỉ lệ màn theo mẫu (biến của .sc-screen / .sc-app) + dòng "N cảnh, nối vòng m:ss".
function _ledSyncTpl() {
  const t = _ledTpl();
  const r = t ? `${t.w} / ${t.h}` : "16 / 9";
  _ledEl("led-screen").style.setProperty("--sc-ratio", r);
  _ledEl("led-app").style.setProperty("--sc-ratio-n", t ? String(t.w / t.h) : "1.7778");
  const P = _ledP.get(_ledS.tpl);
  _ledEl("led-total").textContent = P ? _ledMin(Math.round(P.total)) : "–:––";
  _ledCueSync();
  // Dải cảnh của bàn điều khiển (cùng kiểu Slide cưới): mỗi cảnh một đoạn dài theo thời lượng.
  _ledEl("led-track").innerHTML = P
    ? P.scenes
        .map(
          (sc, i) =>
            `<button type="button" class="sc-seg" data-seg="${i}" style="flex-grow: ${Math.max(1, Math.round(sc.dur * 1000))}" aria-label="Chiếu cảnh ${i + 1}: ${_ledEsc(sc.label || "")}" title="${_ledEsc(sc.label || "")}"><i></i></button>`,
        )
        .join("")
    : "";
}

// ── Cụm điều khiển phát ──
const _ledMin = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
let _ledSec = -1;
// Giờ đang chiếu + phần đã chiếu của từng đoạn trong dải cảnh (--p 0–1, đoạn đang chiếu .is-on).
function _ledClock(P) {
  const tt = ((_ledNow() % P.total) + P.total) % P.total;
  _ledEl("led-track").querySelectorAll("[data-seg]").forEach((b, i) => {
    const p = Math.min(1, Math.max(0, (tt - P.starts[i]) / P.scenes[i].dur));
    b.style.setProperty("--p", p.toFixed(4));
    b.classList.toggle("is-on", p > 0 && p < 1);
  });
  _ledCueMark(CXSlideEngine.indexAt(P, tt));
  const s = Math.floor(tt);
  if (s === _ledSec) return;
  _ledSec = s;
  _ledEl("led-now").textContent = _ledMin(s);
}
function ledPlay(on) {
  if (on === (_ledHold == null)) return;
  if (on) {
    _ledT0 = performance.now() - _ledHold * 1000;
    _ledHold = null;
  } else _ledHold = _ledNow();
  _ledEl("led-ctl").classList.toggle("is-playing", on);
}
// Nhảy tới đầu cảnh trước / sau (theo vòng) — bộ vẽ tự làm chuyển cảnh từ cảnh liền trước.
function ledStep(d) {
  const P = _ledP.get(_ledS.tpl);
  if (!P) return;
  const n = P.scenes.length;
  const lap = Math.floor(_ledNow() / P.total);
  const i = CXSlideEngine.indexAt(P, ((_ledNow() % P.total) + P.total) % P.total);
  const j = i + d;
  _ledSetT(lap * P.total + (((j % n) + n) % n === j ? P.starts[j] : j < 0 ? P.starts[n - 1] - P.total : P.starts[0] + P.total));
}
// Phím tắt (cả lúc toàn màn): cách = phát/tạm dừng, mũi tên = chuyển cảnh.
document.addEventListener("keydown", (e) => {
  if (e.target.closest?.("input, textarea, [contenteditable]") || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === " " && !e.target.closest?.("button")) {
    e.preventDefault();
    ledPlay(_ledHold != null);
  } else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
    e.preventDefault();
    ledStep(e.key === "ArrowRight" ? 1 : -1);
  }
});
_ledEl("led-track").addEventListener("click", (e) => {
  const b = e.target.closest("[data-seg]");
  const P = _ledP.get(_ledS.tpl);
  if (!b || !P) return;
  _ledSetT(Math.floor(_ledNow() / P.total) * P.total + P.starts[Number(b.dataset.seg)]);
});
_ledEl("led-ctl").addEventListener("click", (e) => {
  const k = e.target.closest("[data-ctl]")?.dataset.ctl;
  if (k === "play") ledPlay(_ledHold != null);
  else if (k === "prev" || k === "next") ledStep(k === "next" ? 1 : -1);
});

// ── Tab "Cảnh": y như tab Cảnh của Slide cưới — mỗi cảnh một dòng (ảnh nhỏ · tên · mốc giờ ·
// thời lượng), bấm là chiếu cảnh đó, dừng lại và mở khối đổi ảnh + các ô sửa chữ của nó.
// · Chữ sửa: localStorage theo <mẫu>|<thiệp hoặc demo>, mẫu áp theo khoá (L.texts); sửa thành rỗng
//   là bỏ dòng đó. Gõ thì dựng lại màn (giữ nguyên giờ đang chiếu), dòng cảnh không vẽ lại nên
//   con trỏ đang gõ giữ nguyên.
// · Ảnh: nén rồi cất BYTE (không cất Blob: WebKit có máy đọc lại Blob đã cất thành rỗng) vào
//   IndexedDB theo <thiệp hoặc demo>|<mẫu>|<ô ảnh>, không lên server; chọn ảnh xong là mở bảng
//   lấy nét đúng khổ khung. Ô ảnh / khoá chữ do mẫu khai ở `photos` / `texts` của từng cảnh.
const _LED_PH_DB = "cx_led";
const _LED_PH_STORE = "photos";
const _LED_PH_LIMITS = { maxWidth: 2560, maxHeight: 2560, maxSizeMB: 2, quality: 0.9 };
const _LED_TEXTS = "cx_led_texts";
let _ledPh = { key: null, map: {} }; // map: "<mẫu>|<ô ảnh>" → {id, blob, url, focal}
let _ledPhPick = null; // ô đang chọn ảnh {slot, scene, w, h}
let _ledPhSig = "";
let _ledDbP = null;
let _ledOpen = -1; // cảnh đang mở phần chỉnh
let _ledSig = ""; // khung danh sách cảnh (đổi mới vẽ lại cả danh sách)
let _ledCueAt = ""; // cảnh đang chiếu + đang dừng, đã đổ lên danh sách
let _ledTxT = 0;
const _ledPhKey = () => (_ledWed() ? _ledS.wid : "demo");
const _ledSecTxt = (s) => `${(Math.round(s * 2) / 2).toLocaleString("vi-VN")} giây`;

function _ledTexts(tplId = _ledS.tpl) {
  try {
    const own = JSON.parse(localStorage.getItem(_LED_TEXTS) || "{}")?.[`${tplId}|${_ledPhKey()}`];
    return own && typeof own === "object" ? own : {};
  } catch (e) {
    return {};
  }
}
function _ledTextsSave(own) {
  try {
    const all = JSON.parse(localStorage.getItem(_LED_TEXTS) || "{}") || {};
    const k = `${_ledS.tpl}|${_ledPhKey()}`;
    if (Object.keys(own).length) all[k] = own;
    else delete all[k];
    localStorage.setItem(_LED_TEXTS, JSON.stringify(all));
  } catch (e) {}
}

function _ledDB() {
  _ledDbP ||= new Promise((resolve, reject) => {
    const rq = indexedDB.open(_LED_PH_DB, 1);
    rq.onupgradeneeded = () => rq.result.objectStoreNames.contains(_LED_PH_STORE) || rq.result.createObjectStore(_LED_PH_STORE);
    rq.onsuccess = () => resolve(rq.result);
    rq.onerror = () => reject(rq.error);
  }).catch((e) => {
    _ledDbP = null;
    throw e;
  });
  return _ledDbP;
}
async function _ledDbDo(mode, fn) {
  const db = await _ledDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(_LED_PH_STORE, mode);
    const rq = fn(tx.objectStore(_LED_PH_STORE));
    tx.oncomplete = () => resolve(rq?.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

// Đọc ảnh đã cất của nguồn thông tin đang dùng (chỉ đọc lại khi đổi thiệp / về thông tin mẫu).
async function _ledPhLoad() {
  const key = _ledPhKey();
  if (_ledPh.key === key) return;
  Object.values(_ledPh.map).forEach((p) => URL.revokeObjectURL(p.url));
  _ledPh = { key, map: {} };
  const prefix = key + "|";
  let keys = [];
  let vals = [];
  try {
    const range = IDBKeyRange.bound(prefix, prefix + "￿");
    [keys, vals] = await Promise.all([_ledDbDo("readonly", (st) => st.getAllKeys(range)), _ledDbDo("readonly", (st) => st.getAll(range))]);
  } catch (e) {
    console.warn("Không đọc được ảnh LED đã lưu:", e);
  }
  if (_ledPh.key !== key) return;
  (keys || []).forEach((k, i) => {
    const v = vals[i];
    if (!v?.buf?.byteLength) return;
    const blob = new Blob([v.buf], { type: v.type || "image/jpeg" });
    _ledPh.map[String(k).slice(prefix.length)] = { id: v.id, blob, url: URL.createObjectURL(blob), focal: v.focal || null };
  });
}

// Ảnh khách chọn của một mẫu, đúng dạng `photos` mẫu đọc: {ô ảnh: {src, focal}}.
function _ledPhFor(tplId) {
  const out = {};
  const pre = tplId + "|";
  Object.entries(_ledPh.map).forEach(([k, p]) => k.startsWith(pre) && (out[k.slice(pre.length)] = { src: p.url, focal: p.focal }));
  return out;
}
const _ledOwn = (slot) => _ledPh.map[`${_ledS.tpl}|${slot}`];

function _ledFieldHTML(x) {
  return `<label class="sc-tx">
    <textarea class="sc-tx-in" data-key="${_ledEsc(x.key)}" data-def="${_ledEsc(x.def)}" rows="1" spellcheck="false">${_ledEsc(x.text)}</textarea>
    <button type="button" class="sc-tx-undo${x.text === x.def ? " is-off" : ""}" data-undo="${_ledEsc(x.key)}" aria-label="Trả lại lời mẫu" title="Trả lại lời mẫu">${_ledIco("undo-2")}</button>
  </label>`;
}
function _ledGrow(ta) {
  ta.style.height = "auto";
  ta.style.height = `${ta.scrollHeight}px`;
}

// Gọi sau mỗi lần dựng: khung danh sách (tên cảnh, khoá chữ, ô ảnh) đổi thì vẽ lại cả danh sách,
// không thì chỉ đổ lại ảnh + mốc giờ.
function _ledCueSync() {
  const P = _ledP.get(_ledS.tpl);
  const sig = P
    ? `${_ledS.tpl}|${_ledPhKey()}|` +
      P.scenes.map((c) => `${c.label}:${(c.texts || []).map((x) => x.key).join(",")}:${(c.photos || []).map((p) => p.key).join(",")}`).join("|")
    : "";
  if (sig !== _ledSig) {
    _ledSig = sig;
    if (!P || _ledOpen >= P.scenes.length) _ledOpen = -1;
    _ledCueRender();
  } else _ledPhRender();
  _ledCueTimes();
}

function _ledCueRender() {
  const P = _ledP.get(_ledS.tpl);
  const ol = _ledEl("led-cues");
  ol.innerHTML = (P?.scenes || [])
    .map((c, i) => {
      const open = i === _ledOpen;
      const texts = c.texts || [];
      const fields = texts.length ? texts.map(_ledFieldHTML).join("") : `<p class="sc-tx-none">Cảnh này chỉ có ảnh.</p>`;
      // Ô ảnh nhỏ (.sc-cue-thumb) và khối đổi ảnh (.sc-phbox) để trống: _ledPhRender đổ vào.
      return `<li class="sc-scene${open ? " is-open" : ""}">
        <button type="button" class="sc-cue" data-cue="${i}" aria-expanded="${open}">
          <span class="sc-cue-thumb" aria-hidden="true"></span>
          <span class="sc-cue-main">
            <span class="sc-cue-n">${_ledEsc(c.label)}</span>
            <span class="sc-cue-t"></span>
          </span>
          <span class="sc-cue-d"></span>
        </button>
        <div class="sc-tx-list${open ? "" : " hidden"}">
          ${c.photos?.length ? `<div class="sc-phbox"></div>` : ""}${fields}
        </div>
      </li>`;
    })
    .join("");
  window.lucide?.createIcons({ root: ol });
  ol.querySelectorAll(".sc-tx-in").forEach(_ledGrow);
  _ledEl("led-tx-reset").classList.toggle("hidden", !Object.keys(_ledTexts()).length);
  _ledCueAt = "";
  _ledPhSig = "";
  _ledPhRender();
}

function _ledCueTimes() {
  const P = _ledP.get(_ledS.tpl);
  if (!P) return;
  _ledEl("led-cues").querySelectorAll("[data-cue]").forEach((b, i) => {
    const c = P.scenes[i];
    if (!c) return;
    b.querySelector(".sc-cue-t").textContent = _ledMin(Math.round(P.starts[i]));
    b.querySelector(".sc-cue-d").textContent = _ledSecTxt(c.dur);
  });
}

// Cảnh đang chiếu sáng nền + vạch nhấn trên danh sách; đang chạy thì chấm "đang phát" nhịp.
function _ledCueMark(i) {
  const at = `${i}|${_ledHold != null}`;
  if (at === _ledCueAt) return;
  _ledCueAt = at;
  const ol = _ledEl("led-cues");
  ol.classList.toggle("is-paused", _ledHold != null);
  ol.querySelectorAll("[data-cue]").forEach((b) => {
    const on = Number(b.dataset.cue) === i;
    b.classList.toggle("is-on", on);
    if (on) b.setAttribute("aria-current", "step");
    else b.removeAttribute("aria-current");
  });
}

// Đổ ảnh vào từng dòng cảnh: ô ảnh nhỏ trên dòng + khối đổi ảnh trong phần mở rộng (cảnh một
// ảnh: ảnh đúng khổ khung + nút; cảnh nhiều ảnh: lưới ô vuông, nút nhỏ dưới ô đã thay). Chỉ thay
// hai chỗ đó, không vẽ lại cả danh sách — ô chữ đang gõ giữ nguyên con trỏ.
function _ledPhRender() {
  const P = _ledP.get(_ledS.tpl);
  if (!P) return;
  const sig = P.scenes
    .map((c) =>
      (c.photos || [])
        .map((p) => {
          const own = _ledOwn(p.key);
          return `${p.key}:${p.def}:${own ? `${own.id}@${own.focal?.x},${own.focal?.y}` : ""}`;
        })
        .join(","),
    )
    .join("|");
  _ledEl("led-ph-reset").classList.toggle("hidden", !P.scenes.some((c) => (c.photos || []).some((p) => _ledOwn(p.key))));
  if (sig === _ledPhSig) return;
  _ledPhSig = sig;
  const lis = _ledEl("led-cues").children;
  const demo = _ledPhKey() === "demo";
  const img = (p) => {
    const own = _ledOwn(p.key);
    const src = own?.url || p.def;
    const pos = own?.focal ? ` style="object-position:${Number(own.focal.x)}% ${Number(own.focal.y)}%"` : "";
    return src ? `<img src="${_ledEsc(src)}" alt="" loading="lazy"${pos} onerror="this.remove()" />` : "";
  };
  const at = (p, i) => `data-i="${i}" data-w="${p.w}" data-h="${p.h}"`;
  const back = demo ? "Dùng ảnh mẫu" : "Dùng ảnh thiệp";
  P.scenes.forEach((c, i) => {
    const li = lis[i];
    const photos = c.photos || [];
    if (!li || !photos.length) return;
    li.classList.toggle("is-own", photos.some((p) => _ledOwn(p.key)));
    li.querySelector(".sc-cue-thumb").innerHTML = img(photos[0]);
    const box = li.querySelector(".sc-phbox");
    if (!box) return;
    if (photos.length === 1) {
      const p = photos[0];
      const own = _ledOwn(p.key);
      box.classList.toggle("sc-ph-own", !!own);
      box.innerHTML = `
      <button type="button" class="sc-ph-pick" data-ph="${_ledEsc(p.key)}" ${at(p, i)} aria-label="Đổi ảnh cảnh ${_ledEsc(c.label)}">
        <span class="sc-ph-thumb" style="aspect-ratio:${p.w} / ${p.h}">${_ledIco("image-plus")}${img(p)}</span>
      </button>
      <div class="sc-ph-side">
        <p class="sc-ph-src">${own ? "Ảnh của bạn" : demo ? "Ảnh mẫu" : "Ảnh của thiệp"}</p>
        <div class="sc-ph-acts">
          <button type="button" class="sc-ph-act" data-ph="${_ledEsc(p.key)}" ${at(p, i)}>${_ledIco("image-up")}Đổi ảnh</button>
          ${
            own
              ? `<button type="button" class="sc-ph-act" data-ph-focal="${_ledEsc(p.key)}" ${at(p, i)}>${_ledIco("focus")}Lấy nét</button>
          <button type="button" class="sc-ph-act" data-ph-undo="${_ledEsc(p.key)}" data-i="${i}">${_ledIco("undo-2")}${back}</button>`
              : ""
          }
        </div>
      </div>`;
    } else {
      box.classList.add("sc-ph-many");
      box.innerHTML = `
      <p class="sc-ph-head">Cảnh có ${photos.length} ảnh. Bấm vào ảnh để đổi.</p>
      <div class="sc-ph-grid">${photos
        .map((p, n) => {
          const own = _ledOwn(p.key);
          return `<div class="sc-ph-cell${own ? " sc-ph-own" : ""}">
          <button type="button" class="sc-ph-pick" data-ph="${_ledEsc(p.key)}" ${at(p, i)} aria-label="Đổi ảnh ${n + 1} của cảnh ${_ledEsc(c.label)}">
            <span class="sc-ph-thumb">${_ledIco("image-plus")}${img(p)}</span>
          </button>${
            own
              ? `<div class="sc-ph-mini">
            <button type="button" class="sc-ph-ic" data-ph-focal="${_ledEsc(p.key)}" ${at(p, i)} title="Lấy nét" aria-label="Lấy nét ảnh ${n + 1}">${_ledIco("focus")}</button>
            <button type="button" class="sc-ph-ic" data-ph-undo="${_ledEsc(p.key)}" data-i="${i}" title="${back}" aria-label="${back} cho ảnh ${n + 1}">${_ledIco("undo-2")}</button>
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

// Dừng màn lớn ở cuối cảnh i (mọi chữ đã hiện đủ) — chỗ đứng khi đang sửa cảnh đó.
function _ledShowScene(i) {
  const P = _ledP.get(_ledS.tpl);
  if (!P?.scenes[i]) return;
  ledPlay(false);
  _ledSetT(Math.floor(_ledNow() / P.total) * P.total + P.starts[i] + Math.max(0, P.scenes[i].dur - 0.05));
}

// Mở phần chỉnh của cảnh i (-1 = đóng hết), trả về dòng đang mở.
function _ledOpenScene(i) {
  _ledOpen = i;
  let hit = null;
  _ledEl("led-cues").querySelectorAll(".sc-scene").forEach((li, k) => {
    const open = k === _ledOpen;
    li.classList.toggle("is-open", open);
    li.querySelector(".sc-tx-list").classList.toggle("hidden", !open);
    li.querySelector("[data-cue]").setAttribute("aria-expanded", String(open));
    if (open) {
      li.querySelectorAll(".sc-tx-in").forEach(_ledGrow);
      hit = li;
    }
  });
  return hit;
}

// Bấm thẳng lên màn (màn đã dừng ở cảnh đó): về tab Cảnh, mở cảnh, cuộn tới rồi đặt con trỏ vào
// đúng ô chữ — hoặc làm nổi khối ảnh — kèm một nhịp sáng để mắt tìm thấy.
function _ledEditFromScreen(h) {
  ledTab("scenes");
  const li = _ledOpenScene(h.scene);
  if (!li) return;
  const target =
    h.kind === "text"
      ? li.querySelector(`.sc-tx-in[data-key="${CSS.escape(String(h.key))}"]`)
      : li.querySelector(`.sc-ph-pick[data-ph="${CSS.escape(String(h.key))}"]`) || li.querySelector(".sc-ph-pick");
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

// Gom các phím gõ liền nhau thành một lần dựng lại màn.
function _ledTextSet(key, value, def) {
  const own = _ledTexts();
  if (value === def) delete own[key];
  else own[key] = value;
  _ledTextsSave(own);
  _ledEl("led-tx-reset").classList.toggle("hidden", !Object.keys(own).length);
  clearTimeout(_ledTxT);
  _ledTxT = setTimeout(() => _ledBuild(true), 300);
}
function ledTextsReset() {
  _ledTextsSave({});
  _ledEl("led-tx-reset").classList.add("hidden");
  _ledEl("led-cues").querySelectorAll(".sc-tx-in").forEach((ta) => {
    ta.value = ta.dataset.def;
    _ledGrow(ta);
    ta.parentElement.querySelector(".sc-tx-undo")?.classList.add("is-off");
  });
  _ledBuild(true);
}

_ledEl("led-cues").addEventListener("input", (e) => {
  const ta = e.target.closest(".sc-tx-in");
  if (!ta) return;
  _ledGrow(ta);
  ta.parentElement.querySelector(".sc-tx-undo")?.classList.toggle("is-off", ta.value === ta.dataset.def);
  _ledTextSet(ta.dataset.key, ta.value, ta.dataset.def);
});

_ledEl("led-cues").addEventListener("click", (e) => {
  const tu = e.target.closest("[data-undo]");
  if (tu) {
    const ta = tu.parentElement.querySelector(".sc-tx-in");
    ta.value = ta.dataset.def;
    _ledGrow(ta);
    tu.classList.add("is-off");
    _ledTextSet(ta.dataset.key, ta.value, ta.dataset.def);
    ta.focus();
    return;
  }
  const undo = e.target.closest("[data-ph-undo]");
  if (undo) return ledPhotoRemove(undo.dataset.phUndo, Number(undo.dataset.i));
  const fb = e.target.closest("[data-ph-focal]");
  if (fb) {
    _ledShowScene(Number(fb.dataset.i));
    return ledPhotoFocal(fb.dataset.phFocal, Number(fb.dataset.i), Number(fb.dataset.w), Number(fb.dataset.h));
  }
  const ph = e.target.closest("[data-ph]");
  if (ph) {
    _ledPhPick = { slot: ph.dataset.ph, scene: Number(ph.dataset.i), w: Number(ph.dataset.w), h: Number(ph.dataset.h) };
    // Chiếu đúng cảnh đó để thấy ảnh mới nằm ra sao.
    _ledShowScene(_ledPhPick.scene);
    const input = _ledEl("led-ph-file");
    input.value = "";
    input.click();
    return;
  }
  const b = e.target.closest("[data-cue]");
  if (!b) return;
  const i = Number(b.dataset.cue);
  _ledOpenScene(_ledOpen === i ? -1 : i);
  // Mở cảnh = dừng ở cuối cảnh đó để sửa; đóng = chiếu từ đầu cảnh.
  if (_ledOpen === i) _ledShowScene(i);
  else {
    const P = _ledP.get(_ledS.tpl);
    if (P) _ledSetT(Math.floor(_ledNow() / P.total) * P.total + P.starts[i]);
  }
});

// Bảng lấy nét dạng Promise: {x, y} (%) khi bấm Áp dụng, null khi đóng/huỷ.
function _ledPhFocal(src, current, w, h) {
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
    openFocalPointPicker(src, current || { x: 50, y: 50 }, (pt) => finish({ x: pt.x, y: pt.y }), null, [{ label: "Khung ảnh trên màn LED", w, h }]);
    if (document.getElementById("focal-modal")) obs.observe(document.body, { childList: true, subtree: true });
    else finish(null);
  });
}

_ledEl("led-ph-file").addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  const pick = _ledPhPick;
  e.target.value = "";
  if (!file || !pick) return;
  const H = window.ImageHelper;
  if (H && !H.isAllowedType(file)) {
    window.showToast?.("Định dạng không hỗ trợ — hãy dùng JPG, PNG hoặc WebP (ảnh iPhone .HEIC cần đổi sang JPG).", "error");
    return;
  }
  const key = _ledPhKey();
  const tpl = _ledS.tpl;
  let buf;
  let type;
  window.showLoading?.(true, "Đang xử lý ảnh...");
  try {
    const out = H ? (await H.prepareImage(file, _LED_PH_LIMITS)).file : file;
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
  const focal = await _ledPhFocal(url, null, pick.w, pick.h);
  if (!focal || _ledPh.key !== key) return URL.revokeObjectURL(url);
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const slot = `${tpl}|${pick.slot}`;
  try {
    await _ledDbDo("readwrite", (st) => st.put({ id, buf, type, name: file.name, focal }, `${key}|${slot}`));
  } catch (err) {
    console.warn("Không lưu được ảnh LED:", err);
    window.showToast?.("Máy không cho lưu ảnh (bộ nhớ trình duyệt đầy hoặc đang ở chế độ ẩn danh)", "warning");
  }
  if (_ledPh.key !== key) return URL.revokeObjectURL(url);
  const old = _ledPh.map[slot];
  if (old) URL.revokeObjectURL(old.url);
  _ledPh.map[slot] = { id, blob, url, focal };
  _ledBuild(true);
});

async function ledPhotoFocal(slotKey, i, w, h) {
  const key = _ledPhKey();
  const slot = `${_ledS.tpl}|${slotKey}`;
  const own = _ledPh.map[slot];
  if (!own) return;
  const focal = await _ledPhFocal(own.url, own.focal, w, h);
  if (!focal || _ledPh.key !== key || _ledPh.map[slot] !== own) return;
  own.focal = focal;
  try {
    const dbKey = `${key}|${slot}`;
    await _ledDbDo("readwrite", (st) => {
      const rq = st.get(dbKey);
      rq.onsuccess = () => rq.result && st.put({ ...rq.result, focal }, dbKey);
      return rq;
    });
  } catch (err) {
    console.warn("Không lưu được điểm lấy nét:", err);
  }
  _ledBuild(true);
}

async function ledPhotoRemove(slotKey, i) {
  const key = _ledPhKey();
  const slot = `${_ledS.tpl}|${slotKey}`;
  try {
    await _ledDbDo("readwrite", (st) => st.delete(`${key}|${slot}`));
  } catch (e) {}
  if (_ledPh.key !== key) return;
  const old = _ledPh.map[slot];
  if (old) URL.revokeObjectURL(old.url);
  delete _ledPh.map[slot];
  _ledShowScene(i);
  _ledBuild(true);
}

// Bỏ mọi ảnh đã đổi của mẫu đang chọn (với nguồn thông tin đang dùng).
async function ledPhotosReset() {
  const key = _ledPhKey();
  const pre = `${key}|${_ledS.tpl}|`;
  try {
    await _ledDbDo("readwrite", (st) => st.delete(IDBKeyRange.bound(pre, pre + "￿")));
  } catch (e) {}
  if (_ledPh.key !== key) return;
  Object.keys(_ledPh.map).forEach((k) => {
    if (!k.startsWith(`${_ledS.tpl}|`)) return;
    URL.revokeObjectURL(_ledPh.map[k].url);
    delete _ledPh.map[k];
  });
  _ledBuild(true);
}

// ── Tab của bảng chỉnh (Cảnh · Mẫu · Thiệp — mới vào mở Mẫu, HTML khai sẵn --i: 1): một dải
// .cx-seg, con trượt theo --i. ──
const _LED_TABS = ["scenes", "tpl", "data"];
function ledTab(id) {
  const i = Math.max(0, _LED_TABS.indexOf(id));
  const seg = _ledEl("led-tabs");
  seg.style.setProperty("--i", String(i));
  seg.querySelectorAll("[data-tab]").forEach((b) => {
    const on = b.dataset.tab === _LED_TABS[i];
    b.classList.toggle("is-on", on);
    b.setAttribute("aria-selected", String(on));
    b.tabIndex = on ? 0 : -1;
  });
  _LED_TABS.forEach((t, k) => _ledEl(`led-tab-${t}`).classList.toggle("hidden", k !== i));
  // Ô chữ đo chiều cao theo nội dung — vẽ lúc tab đang ẩn thì đo ra 0, đo lại khi tab hiện.
  if (_LED_TABS[i] === "scenes") _ledEl("led-cues").querySelectorAll(".sc-scene.is-open .sc-tx-in").forEach(_ledGrow);
}
_ledEl("led-tabs").addEventListener("click", (e) => {
  const b = e.target.closest("[data-tab]");
  if (b) ledTab(b.dataset.tab);
});
_ledEl("led-tabs").addEventListener("keydown", (e) => {
  const d = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
  if (!d) return;
  e.preventDefault();
  const cur = _LED_TABS.findIndex((t) => _ledEl(`led-tabbtn-${t}`).classList.contains("is-on"));
  const next = _LED_TABS[(cur + d + _LED_TABS.length) % _LED_TABS.length];
  ledTab(next);
  _ledEl(`led-tabbtn-${next}`).focus();
});

// Một vòng rAF vẽ màn lớn: canvas theo bề ngang thật × tỉ lệ điểm ảnh (trần 1920px, toàn màn 3840px).
function _ledTick(now) {
  const P = _ledP.get(_ledS.tpl);
  const cv = _ledEl("led-canvas");
  if (P && !document.hidden) {
    const k = Math.min(window.devicePixelRatio || 1, 2);
    const cw = Math.min(_ledFullOn ? 3840 : 1920, Math.round(cv.clientWidth * k));
    const ch = Math.round((cw * P.H) / P.W);
    if (cv.width !== cw || cv.height !== ch) {
      cv.width = cw;
      cv.height = ch;
    }
    CXSlideEngine.frame(cv.getContext("2d"), P, _ledNow(), { loop: true });
    _ledEditDraw(cv, P);
    _ledClock(P);
  }
  requestAnimationFrame(_ledTick);
}

// ── Toàn màn ──
// Fullscreen API trên khung màn; máy không có (iPhone) thì phủ kín bằng CSS. Cả hai cùng cờ
// .is-full. Mở là chạy lại từ cảnh đầu; đứng yên 2.5 giây thì ẩn nút thoát + con trỏ.
let _ledFullOn = false;
let _ledIdleT = 0;
const _ledFsEl = () => document.fullscreenElement || document.webkitFullscreenElement;
function _ledFullSet(on) {
  _ledFullOn = on;
  const el = _ledEl("led-screen");
  el.classList.toggle("is-full", on);
  el.classList.remove("is-idle");
  document.documentElement.classList.toggle("led-locked", on);
  if (on) _ledWake();
}
function ledFull(on) {
  const el = _ledEl("led-screen");
  if (!on) {
    if (_ledFsEl()) (document.exitFullscreen || document.webkitExitFullscreen)?.call(document);
    else _ledFullSet(false);
    return;
  }
  _ledSetT(0);
  _ledFullSet(true);
  (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el)?.catch?.(() => {});
}
function _ledFsSync() {
  if (!_ledFsEl() && _ledFullOn) _ledFullSet(false);
}
document.addEventListener("fullscreenchange", _ledFsSync);
document.addEventListener("webkitfullscreenchange", _ledFsSync);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && _ledFullOn && !_ledFsEl()) _ledFullSet(false);
});
function _ledWake() {
  if (!_ledFullOn) return;
  const el = _ledEl("led-screen");
  el.classList.remove("is-idle");
  clearTimeout(_ledIdleT);
  _ledIdleT = setTimeout(() => _ledFullOn && el.classList.add("is-idle"), 2500);
}
document.addEventListener("pointermove", _ledWake);
document.addEventListener("pointerdown", _ledWake);
// ── Sửa ngay trên màn (y như Slide cưới): rê chuột lên chữ/ảnh của cảnh đang chiếu thì vẽ khung
// nét đứt + nhãn ("Sửa chữ" / "Đổi ảnh"), bấm (hoặc chạm) thì dừng ở cảnh đó với chữ đã hiện đủ,
// mở tab Cảnh đúng ô sửa và làm nổi nó (_ledEditFromScreen). Lần dựng đầu, viền mọi vùng sửa được
// nhấp nháy một nhịp cho khách biết bấm được. Khung vẽ thẳng lên canvas xem trước, KHÔNG qua engine
// nên ảnh/video tải xuống không dính. Vùng = chữ có `key` và ảnh có `edit` (mẫu khai); bấm chỗ
// khác trên màn là mở toàn màn như cũ.
const _LED_EDIT_RGB = "225, 29, 72"; // hồng nhấn của Cưới Xinh, cùng màu khung sửa của Slide cưới
const _LED_EDIT_LABEL = { text: "Sửa chữ", photo: "Đổi ảnh" };
const _LED_EDIT_PAD = 6; // px màn hình, nhân đơn vị mẫu lúc vẽ
let _ledPtr = null; // vị trí chuột theo toạ độ mẫu; null = ngoài màn
let _ledHover = null;
let _ledPicked = null; // vùng vừa bấm, sáng đậm thêm một nhịp
let _ledHintUntil = 0;
let _ledHinted = false;
const _ledCv = _ledEl("led-canvas");
const _ledUnit = (P) => P.W / (_ledCv.getBoundingClientRect().width || P.W);

function _ledToDesign(e, P) {
  const r = _ledCv.getBoundingClientRect();
  if (!r.width || !r.height) return null;
  return { x: ((e.clientX - r.left) / r.width) * P.W, y: ((e.clientY - r.top) / r.height) * P.H };
}
// Vùng sửa được của cảnh đang chiếu — bỏ phần tử chưa tới lượt hiện.
function _ledEditables(P) {
  const tt = ((_ledNow() % P.total) + P.total) % P.total;
  const i = CXSlideEngine.indexAt(P, tt);
  const lt = tt - P.starts[i];
  const out = [];
  const walk = (el) => {
    if (el.anim && lt < (el.anim.d || 0)) return;
    if (el.kids) return el.kids.forEach(walk);
    if (el.type === "text" && el.key) out.push({ kind: "text", key: el.key, scene: i, ...CXSlideEngine.bounds(el) });
    else if (el.type === "image" && el.edit) out.push({ kind: "photo", key: el.edit, scene: i, x: el.x, y: el.y, w: el.w, h: el.h });
  };
  P.scenes[i].els.forEach(walk);
  return out;
}
// Chữ ưu tiên hơn ảnh (chữ nhỏ, dễ trượt); trong cùng loại lấy vùng nhỏ nhất chứa điểm.
function _ledHit(P, pt) {
  if (!pt) return null;
  const p = _LED_EDIT_PAD * _ledUnit(P);
  const inside = (r) => pt.x >= r.x - p && pt.x <= r.x + r.w + p && pt.y >= r.y - p && pt.y <= r.y + r.h + p;
  const all = _ledEditables(P).filter(inside);
  const pick = (kind) => all.filter((r) => r.kind === kind).sort((a, b) => a.w * a.h - b.w * b.h)[0] || null;
  return pick("text") || pick("photo");
}
function _ledBox(ctx, P, r, alpha, label, solid) {
  const u = _ledUnit(P);
  const pad = _LED_EDIT_PAD * u;
  // Vùng phủ kín màn (ảnh bìa) thì khung lùi vào trong mép một chút cho khỏi bị cắt.
  const x = Math.max(u, r.x - pad);
  const y = Math.max(u, r.y - pad);
  const w = Math.min(P.W - u, r.x + r.w + pad) - x;
  const h = Math.min(P.H - u, r.y + r.h + pad) - y;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, 6 * u);
  else ctx.rect(x, y, w, h);
  ctx.fillStyle = `rgba(${_LED_EDIT_RGB}, ${solid ? 0.14 : 0.06})`;
  ctx.fill();
  ctx.setLineDash(solid ? [] : [6 * u, 4 * u]);
  ctx.lineWidth = 1.5 * u;
  ctx.strokeStyle = `rgba(${_LED_EDIT_RGB}, 0.9)`;
  ctx.stroke();
  if (label) {
    const text = `✎  ${_LED_EDIT_LABEL[r.kind]}`;
    ctx.setLineDash([]);
    ctx.font = `600 ${13 * u}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
    const pw = ctx.measureText(text).width + 20 * u;
    const ph = 24 * u;
    const gap = 4 * u;
    // Nhãn đứng trên khung; sát mép trên thì xuống dưới, tràn phải thì dồn vào.
    const lx = Math.min(Math.max(gap, x), P.W - pw - gap);
    const ly = y - ph - gap >= gap ? y - ph - gap : Math.min(P.H - ph - gap, y + h + gap);
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(lx, ly, pw, ph, ph / 2);
    else ctx.rect(lx, ly, pw, ph);
    ctx.fillStyle = `rgb(${_LED_EDIT_RGB})`;
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.fillText(text, lx + 10 * u, ly + ph / 2 + u);
  }
  ctx.restore();
}
function _ledEditDraw(cv, P) {
  const on = !_ledFullOn;
  _ledHover = on ? _ledHit(P, _ledPtr) : null;
  cv.style.cursor = _ledHover ? "pointer" : "";
  if (!on) return;
  if (!_ledHinted) {
    _ledHinted = true;
    _ledHintUntil = performance.now() + 2600;
  }
  const now = performance.now();
  const ctx = cv.getContext("2d");
  const k = cv.width / P.W;
  ctx.setTransform(k, 0, 0, k, 0, 0);
  if (now < _ledHintUntil && !_ledHover) {
    const a = 0.35 + 0.35 * Math.sin(((now % 1300) / 1300) * Math.PI * 2);
    _ledEditables(P).forEach((r) => _ledBox(ctx, P, r, a, false, false));
  }
  if (_ledPicked && now - _ledPicked.at < 900) _ledBox(ctx, P, _ledPicked, 1 - (now - _ledPicked.at) / 900, false, true);
  if (_ledHover) _ledBox(ctx, P, _ledHover, 1, true, false);
}
_ledCv.addEventListener("pointermove", (e) => {
  const P = _ledP.get(_ledS.tpl);
  _ledPtr = P && e.pointerType === "mouse" ? _ledToDesign(e, P) : null;
});
_ledCv.addEventListener("pointerleave", () => (_ledPtr = null));

// Bấm thẳng lên màn (khi chưa toàn màn): trúng chữ/ảnh thì mở đúng ô sửa, chỗ khác thì toàn màn.
_ledEl("led-screen").addEventListener("click", (e) => {
  if (_ledFullOn || e.target.closest("button")) return;
  const P = _ledP.get(_ledS.tpl);
  const h = P ? _ledHit(P, _ledToDesign(e, P)) : null;
  if (!h) return ledFull(true);
  _ledShowScene(h.scene);
  _ledPicked = { ...h, at: performance.now() };
  _ledEditFromScreen(h);
});

// ── Tải xuống ──
function _ledFile(ext) {
  const slug = _ledWed()?.slug;
  return `hinh-nen-led-${_ledS.tpl}${slug ? "-" + slug : ""}.${ext}`;
}
function _ledSaveBlob(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 60000);
}

// Ảnh tĩnh 4K ở giây `poster` của mẫu (lúc chữ đã hiện hết).
function ledImage() {
  const P = _ledP.get(_ledS.tpl);
  if (!P) return;
  const cv = document.createElement("canvas");
  cv.width = 3840;
  cv.height = Math.round((3840 * P.H) / P.W);
  CXSlideEngine.frame(cv.getContext("2d", { alpha: false }), P, _ledTpl().poster ?? 0, { loop: true });
  cv.toBlob((blob) => blob && _ledSaveBlob(blob, _ledFile("png")), "image/png");
}

// Video MP4 4K nối vòng; máy không mã hoá nổi 4K thì lùi về 1080p và báo.
async function ledVideo() {
  const P = _ledP.get(_ledS.tpl);
  if (!P || _ledJob) return;
  _ledJob = new AbortController();
  const h = (await CXSlideExport.pickCodec(2160)) ? 2160 : 1080;
  _ledProg(0);
  let wake = null;
  try {
    // Giữ màn sáng suốt lúc tạo — máy tắt màn là trình duyệt bóp tốc độ tab.
    wake = await navigator.wakeLock?.request("screen");
  } catch (e) {}
  try {
    const blob = await CXSlideExport.run(P, { height: h, loop: true, signal: _ledJob.signal, onProgress: _ledProg });
    _ledSaveBlob(blob, _ledFile("mp4"));
    if (h !== 2160) window.showToast?.("Máy này không tạo được video 4K nên đã tạo bản 1080p", "warning");
  } catch (e) {
    if (e?.code !== "ABORTED")
      window.showToast?.(
        e?.code === "UNSUPPORTED"
          ? "Trình duyệt này không tạo được video. Hãy mở bằng Chrome hoặc Edge bản mới"
          : "Chưa tạo xong video. Đóng bớt tab khác rồi thử lại",
        "error",
      );
  } finally {
    wake?.release?.().catch(() => {});
    _ledJob = null;
    _ledProg(0);
  }
}
// Nút "Tải xuống" kiêm thanh tiến độ (cùng kiểu nút Xuất video của Slide cưới) + nút Huỷ cạnh bên.
function _ledProg(p) {
  const run = !!_ledJob;
  const v = Math.round(p * 100);
  const btn = _ledEl("led-dl");
  btn.classList.toggle("is-run", run);
  btn.closest(".sc-bar").classList.toggle("is-run", run);
  btn.style.setProperty("--p", String(run ? v / 100 : 0));
  _ledEl("led-dl-t").textContent = run ? `Đang tạo ${v}%` : "Tải xuống";
  _ledEl("led-stop").classList.toggle("hidden", !run);
}
function ledCancel() {
  _ledJob?.abort();
}

const _ledDlPop = _ledEl("led-dl-pop");
// Đang tạo video thì bấm nút không mở menu (nút là thanh tiến độ).
_ledEl("led-dl").addEventListener("click", (e) => {
  if (_ledJob) e.stopImmediatePropagation();
}, true);
_ledDlPop.setItems([
  { icon: _ledIco("image"), label: "Ảnh (PNG)", onClick: ledImage },
  { icon: _ledIco("film"), label: "Video (MP4 - 4K)", onClick: ledVideo, disabled: !window.CXSlideExport?.supported() },
]);
window.lucide?.createIcons({ root: _ledDlPop });

// ── Nguồn thông tin: công tắc "Dùng thiệp của tôi" + dải thẻ thiệp (cùng kiểu Slide cưới) ──
function _ledState(state) {
  ["loading", "guest", "empty", "error"].forEach((k) => _ledEl(`led-st-${k}`).classList.toggle("hidden", k !== state));
  _ledEl("led-weddings").classList.toggle("hidden", state !== "list");
}

function _ledCardHTML(w) {
  const names = [w.groom_name, w.bride_name].filter(Boolean).join(" & ") || "Thiệp cưới";
  const file = w.cover_image_url || (w.gallery_images || [])[0] || "";
  const cover = file ? storageDAL.getPublicUrl(file) : "";
  const tag = w.is_published
    ? `<span class="mi-tag mi-tag--live">${_ledIco("badge-check")}Đã xuất bản</span>`
    : `<span class="mi-tag mi-tag--trial">${_ledIco("pencil-line")}Nháp</span>`;
  return `
    <button type="button" class="sc-w" role="radio" data-wid="${_ledEsc(w.id)}" aria-checked="${w.id === _ledS.wid}">
      <span class="sc-w-thumb">${_ledIco("image")}${cover ? `<img src="${_ledEsc(cover)}" alt="" loading="lazy" onerror="this.remove()" />` : ""}</span>
      <span class="sc-w-info">
        ${tag}
        <span class="sc-w-names">${_ledEsc(names)}</span>
        <span class="sc-w-meta">${w.slug ? "/" + _ledEsc(w.slug) : ""}</span>
      </span>
      <span class="sc-w-dot" aria-hidden="true"></span>
    </button>`;
}

async function ledLoadList() {
  const seq = ++_ledSeq;
  if (!_ledS.user) return _ledState("guest");
  _ledState("loading");
  let rows;
  try {
    rows = await weddingDAL.listMyWeddings();
  } catch (e) {
    if (seq === _ledSeq) _ledState("error");
    return;
  }
  if (seq !== _ledSeq) return;
  // Thiệp đã xuất bản lên trước, trong mỗi nhóm thiệp mới tạo đứng đầu.
  _ledList = rows.sort(
    (a, b) => !!b.is_published - !!a.is_published || new Date(b.created_at || 0) - new Date(a.created_at || 0),
  );
  if (!_ledList.length) return _ledState("empty");
  if (_ledS.wid && !_ledList.some((w) => w.id === _ledS.wid)) _ledS.wid = null;
  // Chỉ có một thiệp thì chọn sẵn.
  if (!_ledS.wid && _ledList.length === 1) _ledS.wid = _ledList[0].id;
  const box = _ledEl("led-weddings");
  box.innerHTML = _ledList.map(_ledCardHTML).join("");
  window.lucide?.createIcons({ root: box });
  _ledState("list");
  // Thiệp đã chọn nằm khuất trong dải ngang → cuộn riêng dải cho nó lộ ra.
  const sel = box.querySelector('[aria-checked="true"]');
  if (sel) box.scrollLeft += sel.getBoundingClientRect().left - box.getBoundingClientRect().left - parseFloat(getComputedStyle(box).paddingLeft);
  if (_ledS.wid) ledPick(_ledS.wid, true);
}

// Lấy hàng thiệp đầy đủ lần đầu chọn, rồi dựng lại.
async function ledPick(id, again) {
  if (!_ledList?.some((w) => w.id === id) || (!again && id === _ledS.wid && _ledData.has(id))) return;
  _ledS.wid = id;
  _ledSave();
  const box = _ledEl("led-weddings");
  box.querySelectorAll("[data-wid]").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.wid === id)));
  if (!_ledData.has(id)) {
    const btn = box.querySelector(`[data-wid="${CSS.escape(id)}"]`);
    btn?.classList.add("is-busy");
    try {
      _ledData.set(id, await weddingDAL.getWeddingById(id));
    } catch (e) {
      if (_ledS.wid === id) {
        _ledS.wid = null;
        btn?.setAttribute("aria-checked", "false");
      }
      window.showToast?.("Không lấy được dữ liệu thiệp, hãy thử lại", "error");
      return;
    } finally {
      btn?.classList.remove("is-busy");
    }
  }
  if (_ledS.wid === id) _ledBuild();
}
_ledEl("led-weddings").addEventListener("click", (e) => {
  const b = e.target.closest("[data-wid]");
  if (b) ledPick(b.dataset.wid);
});

const _ledCheck = _ledEl("led-use-real");
_ledCheck.addEventListener("change", () => {
  _ledS.real = _ledCheck.checked;
  _ledSave();
  _ledEl("led-real").classList.toggle("hidden", !_ledS.real);
  if (_ledS.real && _ledList === null) ledLoadList();
  _ledBuild();
});

function ledLogin() {
  if (!window.AuthUI) return;
  AuthUI.openModal({
    title: "Đăng nhập",
    subtitle: "Đăng nhập để lấy thông tin từ thiệp của bạn",
    oauthRedirect: window.location.origin + window.location.pathname,
  });
}

(async function initLedPage() {
  _ledRestore();
  _ledRenderGrid();
  _ledSyncTpl();
  _ledCheck.checked = _ledS.real;
  _ledEl("led-real").classList.toggle("hidden", !_ledS.real);
  _ledBuild();
  requestAnimationFrame(_ledTick);
  _ledS.user = await CXAuth.getUser();
  if (_ledS.real) ledLoadList();
  // Lấy phiên TRƯỚC rồi mới nghe onChange, không thì lần đồng bộ đầu tải hai lần.
  CXAuth.onChange((user) => {
    if ((user?.id || null) === (_ledS.user?.id || null)) return;
    _ledS.user = user;
    _ledList = null;
    _ledData.clear();
    if (!user) _ledS.wid = null;
    if (_ledS.real) ledLoadList();
    _ledBuild();
  });
})();
