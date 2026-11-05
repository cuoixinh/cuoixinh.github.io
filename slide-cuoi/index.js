// Trang "Slide cưới": chọn mẫu slide (CX_SLIDE_TEMPLATES) → tuỳ chọn lấy dữ liệu từ một
// thiệp của tài khoản → xem trước, trình chiếu toàn màn, xuất video MP4 (1080p/4K).
// Mẫu chạy trong iframe templates/<id>/?embed=1 và KHÔNG tự gọi API: trang này lấy thiệp
// (getWeddingById, chỉ chủ thiệp) rồi gửi sang bằng postMessage mỗi khi khung báo sẵn sàng.

const _scS = { tpl: CX_SLIDE_TEMPLATES[0]?.id || "", real: false, wid: null, user: null };
let _scList = null; // thiệp của tài khoản; null = chưa tải
let _scSeq = 0; // đổi phiên làm scLoadList chạy chồng; chỉ lần MỚI NHẤT được vẽ
let _scSent = ""; // bộ dữ liệu khung đang chiếu — trùng thì khỏi gửi lại (gửi là chạy lại từ đầu)
const _scData = new Map(); // id → hàng thiệp đầy đủ
// Xuất video — khai ở đầu file vì _scFrameLoad (chạy ngay lúc khởi động) đọc tới.
let _scCapsOk = null; // {h1080, h2160} khung báo lên; null = chưa biết
let _scMusic = ""; // "file" ghép được tiếng · "yt" không · "" không có nhạc
let _scExState = "";
let _scExRes = 2160;
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
  if (!b) return;
  // Mục Mẫu slide nằm cuối trang — bấm mẫu nào (kể cả mẫu đang chọn) cũng cuộn về đầu để xem.
  scrollTo({ top: 0, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  if (b.dataset.tpl === _scS.tpl) return;
  _scS.tpl = b.dataset.tpl;
  _scSave();
  _scRenderTpls();
  _scFrameLoad();
});

function _scFrameLoad() {
  _scSent = "";
  // Khung nạp lại là mất việc xuất đang chạy (nó sống trong khung) — về lại bước chọn.
  if (_scExState === "run") _scExportState("error", "Slide vừa được nạp lại nên việc xuất đã dừng.");
  _scCapsOk = null;
  _scEl("sc-cues").innerHTML = "";
  _scSig = "";
  _scOpen = -1;
  const t = CX_SLIDE_TEMPLATES.find((x) => x.id === _scS.tpl);
  _scBox.style.setProperty("--sc-ratio", t?.ratio || "16 / 9");
  _scFrame.src = `/slide-cuoi/templates/${encodeURIComponent(_scS.tpl)}/?embed=1`;
}

// ── Gửi dữ liệu sang khung ──
function _scPush(force) {
  const w = _scS.real && _scS.wid ? _scData.get(_scS.wid) : null;
  const key = w ? _scS.wid : "demo";
  if (!force && key === _scSent) return;
  _scSent = key;
  _scSig = ""; // bộ dữ liệu khác → các ô chữ phải vẽ lại dù khoá trùng
  _scFrame.contentWindow?.postMessage(
    { type: "cx-slide-data", wedding: w || null, texts: _scTexts() },
    location.origin,
  );
}

addEventListener("message", (e) => {
  if (e.source !== _scFrame.contentWindow || e.origin !== location.origin) return;
  const t = e.data?.type;
  if (t === "cx-slide-ready") _scPush(true);
  else if (t === "cx-slide-full") scFullscreen();
  else if (t === "cx-slide-state") _scCueState(e.data);
  else if (t === "cx-slide-caps") _scCaps(e.data);
  else if (t === "cx-slide-export-state") _scExportMsg(e.data);
});

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
    b.querySelector(".sc-cue-d").textContent = `${Math.round(c.dur / 1000)} giây`;
    t += c.dur;
  });
}

function _scCueRender() {
  const ol = _scEl("sc-cues");
  ol.innerHTML = _scCues
    .map((c, i) => {
      const open = i === _scOpen;
      const fields = c.texts.length
        ? c.texts.map(_scFieldHTML).join("")
        : `<p class="sc-tx-none">Cảnh này chỉ có ảnh.</p>`;
      return `<li class="sc-scene${open ? " is-open" : ""}">
        <button type="button" class="sc-cue" data-cue="${i}" aria-expanded="${open}">
          <span class="sc-cue-t"></span>
          <span class="sc-cue-n">${_scEsc(c.label)}</span>
          <span class="sc-cue-d"></span>
        </button>
        <div class="sc-tx-list${open ? "" : " hidden"}">${fields}</div>
      </li>`;
    })
    .join("");
  _scCueTimes();
  window.lucide?.createIcons({ root: ol });
  ol.querySelectorAll(".sc-tx-in").forEach(_scGrow);
  _scResetBtn();
}

function _scCueState(m) {
  const ol = _scEl("sc-cues");
  if (Array.isArray(m.scenes)) {
    _scMusic = m.music || "";
    _scExportNote();
    _scCues = m.scenes.map((c) => ({
      label: String(c.label || ""),
      dur: Number(c.dur) || 0,
      texts: (Array.isArray(c.texts) ? c.texts : []).map((x) => ({
        key: String(x.key),
        text: String(x.text ?? ""),
        def: String(x.def ?? ""),
      })),
    }));
    const sig = _scCues.map((c) => c.label + ":" + c.texts.map((x) => x.key).join(",")).join("|");
    if (sig === _scSig) _scCueTimes();
    else {
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
  _scOpen = _scOpen === i ? -1 : i;
  _scEl("sc-cues").querySelectorAll(".sc-scene").forEach((li, k) => {
    const open = k === _scOpen;
    li.classList.toggle("is-open", open);
    li.querySelector(".sc-tx-list").classList.toggle("hidden", !open);
    li.querySelector("[data-cue]").setAttribute("aria-expanded", String(open));
    if (open) li.querySelectorAll(".sc-tx-in").forEach(_scGrow);
  });
  _scFrame.contentWindow?.postMessage({ type: "cx-slide-go", index: i, pause: _scOpen === i }, location.origin);
});

_scEl("sc-cues").addEventListener("input", (e) => {
  const ta = e.target.closest(".sc-tx-in");
  if (!ta) return;
  _scGrow(ta);
  ta.parentElement.querySelector(".sc-tx-undo")?.classList.toggle("is-off", ta.value === ta.dataset.def);
  _scTextSet(ta.dataset.key, ta.value, ta.dataset.def);
});

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
    try {
      _scData.set(id, await weddingDAL.getWeddingById(id));
    } catch (e) {
      btn?.classList.remove("is-busy");
      if (_scS.wid === id) {
        _scS.wid = null;
        btn?.setAttribute("aria-checked", "false");
      }
      window.showToast?.("Không lấy được dữ liệu thiệp, hãy thử lại", "error");
      return;
    }
    btn?.classList.remove("is-busy");
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
  _scS.user = await CXAuth.getUser();
  if (_scS.real) scLoadList();
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
  _scCapsOk = { h1080: !!m.h1080, h2160: !!m.h2160 };
  // Máy không mã hoá nổi 4K thì khoá ô 4K, tự về 1080p.
  const b4k = _scEl("sc-ex-res").querySelector('[data-res="2160"]');
  b4k.disabled = !_scCapsOk.h2160;
  if (!_scCapsOk.h2160 && _scExRes === 2160) _scPickRes(1080);
  _scExportNote();
}

function _scPickRes(res) {
  _scExRes = res;
  const seg = _scEl("sc-ex-res");
  seg.querySelectorAll("[data-res]").forEach((b, i) => {
    const on = Number(b.dataset.res) === res;
    b.classList.toggle("is-on", on);
    b.setAttribute("aria-pressed", String(on));
    if (on) seg.style.setProperty("--i", String(i));
  });
  _scExportNote();
}

_scEl("sc-ex-res").addEventListener("click", (e) => {
  const b = e.target.closest("[data-res]");
  if (b && !b.disabled) _scPickRes(Number(b.dataset.res));
});

function _scExportNote() {
  const notes = [];
  if (_scCapsOk && !_scCapsOk.h1080) notes.push("Trình duyệt này chưa xuất được video. Hãy mở bằng Chrome hoặc Edge bản mới trên máy tính.");
  else {
    if (_scCapsOk && !_scCapsOk.h2160) notes.push("Máy này không mã hoá được 4K, chỉ xuất được 1080p.");
    if (_scExRes === 2160) notes.push("4K xuất lâu hơn và file nặng hơn khoảng 2,5 lần.");
    if (_scMusic === "yt") notes.push("Nhạc YouTube không ghép được vào video, file xuất ra sẽ không có tiếng.");
  }
  _scEl("sc-ex-note").textContent = notes.join(" ");
}

function _scExportState(state, note) {
  _scExState = state;
  ["pick", "run", "done", "error"].forEach((k) => _scToggle(`sc-ex-${k}`, k === state));
  if (state === "error") _scEl("sc-ex-error-note").textContent = note || "";
  if (state !== "run") {
    _scWake?.release?.().catch(() => {});
    _scWake = null;
  }
}

function scExportOpen(again) {
  const box = _scEl("sc-export");
  const open = again || box.classList.contains("hidden");
  if (_scExState === "run" && !again) return box.scrollIntoView({ block: "nearest", behavior: "smooth" });
  box.classList.toggle("hidden", !open);
  _scEl("sc-export-open").setAttribute("aria-expanded", String(open));
  if (open) {
    _scExportState("pick");
    _scExportNote();
    box.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
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
  } else if (m.state === "done" && m.blob) {
    _scExBlob = m.blob;
    const mb = Math.max(1, Math.round(m.blob.size / 1048576));
    _scEl("sc-ex-done-note").textContent =
      `File MP4 ${_scExRes === 2160 ? "4K" : "1080p"}, ${mb} MB.` + (m.silent ? " Video không có tiếng vì nhạc của thiệp là YouTube." : "");
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
  a.download = `slide-cuoi-${_scExRes === 2160 ? "4k" : "1080p"}.mp4`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 60000);
}
