// Trang "Hình nền LED": màn LED to chạy mẫu đang chọn (bộ vẽ slide dùng chung), nguồn thông tin là
// thiệp của tài khoản (getWeddingById, chỉ chủ thiệp) hoặc dữ liệu mẫu; tải xuống ảnh PNG
// 3840×2160 hoặc video MP4 4K nối vòng liền mạch. Mọi thứ dựng trên máy khách.

const _LED_TPLS = window.CX_LED_TEMPLATES || [];
const _ledS = { tpl: _LED_TPLS[0]?.id || "", real: false, wid: null, user: null };
let _ledList = null; // thiệp của tài khoản; null = chưa tải
let _ledListState = "idle"; // idle · loading · error · ok
let _ledSeq = 0; // ledLoadList chạy chồng: chỉ lần MỚI NHẤT được dùng
let _ledGen = 0; // dựng lại chạy chồng: chỉ lần mới nhất được dùng
const _ledData = new Map(); // id thiệp → hàng thiệp đầy đủ
const _ledP = new Map(); // id mẫu → dự án đã dựng (CXSlideEngine.build)
let _ledT0 = performance.now(); // mốc giờ của màn lớn (đặt lại khi đổi mẫu / mở toàn màn)
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
async function _ledBuild() {
  const gen = ++_ledGen;
  const order = [_ledTpl(), ..._LED_TPLS.filter((t) => t !== _ledTpl())];
  for (const tpl of order) {
    const P = await CXSlideEngine.build(tpl, await _ledInput(tpl), {}, {}, null);
    if (gen !== _ledGen) return;
    _ledP.set(tpl.id, P);
    if (tpl.id === _ledS.tpl) _ledT0 = performance.now();
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

function _ledRenderGrid() {
  const grid = _ledEl("led-grid");
  grid.innerHTML = _LED_TPLS.map(
    (t) => `
    <button type="button" class="led-tpl" role="radio" data-tpl="${_ledEsc(t.id)}" aria-checked="${t.id === _ledS.tpl}">
      <span class="led-tpl-img" style="aspect-ratio: ${t.w} / ${t.h}"><img alt="" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" /></span>
      <span class="led-tpl-name">${_ledEsc(t.name)}</span>
    </button>`,
  ).join("");
}
_ledEl("led-grid").addEventListener("click", (e) => {
  const b = e.target.closest("[data-tpl]");
  if (!b || b.dataset.tpl === _ledS.tpl) return;
  _ledS.tpl = b.dataset.tpl;
  _ledSave();
  _ledEl("led-grid").querySelectorAll("[data-tpl]").forEach((x) => x.setAttribute("aria-checked", String(x === b)));
  _ledSyncName();
  _ledT0 = performance.now();
});

function _ledSyncName() {
  const t = _ledTpl();
  _ledEl("led-name").textContent = t?.name || "";
  _ledEl("led-app").style.setProperty("--led-r", t ? String(t.w / t.h) : "1.7778");
}

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
    CXSlideEngine.frame(cv.getContext("2d"), P, (now - _ledT0) / 1000, { loop: true });
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
  _ledT0 = performance.now();
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
// Bấm thẳng lên màn (khi chưa toàn màn) cũng mở toàn màn.
_ledEl("led-screen").addEventListener("click", (e) => {
  if (!_ledFullOn && !e.target.closest("button")) ledFull(true);
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
  _ledEl("led-prog").classList.remove("hidden");
  _ledEl("led-dl").classList.add("hidden");
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
    _ledEl("led-prog").classList.add("hidden");
    _ledEl("led-dl").classList.remove("hidden");
  }
}
function _ledProg(p) {
  const v = Math.round(p * 100);
  _ledEl("led-pct").textContent = `${v}%`;
  _ledEl("led-fill").style.transform = `scaleX(${v / 100})`;
}
function ledCancel() {
  _ledJob?.abort();
}

const _ledDlPop = _ledEl("led-dl-pop");
_ledDlPop.setItems([
  { icon: _ledIco("image"), label: "Ảnh (PNG)", onClick: ledImage },
  { icon: _ledIco("film"), label: "Video (MP4 - 4K)", onClick: ledVideo, disabled: !window.CXSlideExport?.supported() },
]);
window.lucide?.createIcons({ root: _ledDlPop });

// ── Nguồn thông tin: thông tin mẫu hoặc một thiệp của tài khoản ──
const _ledSrcPop = _ledEl("led-src-pop");
const _ledCover = (w) => {
  const file = w?.cover_image_url || (w?.gallery_images || [])[0] || "";
  return file ? storageDAL.getPublicUrl(file) : "";
};
const _ledNames = (w) => [w.groom_name, w.bride_name].filter(Boolean).join(" & ") || "Thiệp cưới";

function _ledSyncSrc() {
  const row = _ledS.real && _ledS.wid ? _ledList?.find((w) => w.id === _ledS.wid) : null;
  _ledEl("led-src-t").textContent = row ? _ledNames(row) : "Thông tin mẫu";
  const av = _ledEl("led-src-av");
  const cover = row ? _ledCover(row) : "";
  av.innerHTML = cover ? `<img src="${_ledEsc(cover)}" alt="" onerror="this.remove()" />` : _ledIco("heart");
  window.lucide?.createIcons({ root: av });
}

function _ledSrcItems() {
  const items = [
    { icon: _ledIco("sparkles"), label: "Thông tin mẫu", active: !_ledS.real, onClick: () => ledUse(null) },
    { sep: true },
  ];
  if (!_ledS.user) items.push({ icon: _ledIco("log-in"), label: "Đăng nhập để dùng thiệp của bạn", onClick: ledLogin });
  else if (_ledListState === "loading") items.push({ icon: _ledIco("loader"), label: "Đang tải thiệp…", disabled: true });
  else if (_ledListState === "error")
    items.push({ icon: _ledIco("refresh-cw"), label: "Không tải được thiệp. Thử lại", onClick: () => ledLoadList() });
  else if (!_ledList?.length)
    items.push({ icon: _ledIco("plus"), label: "Tạo thiệp đầu tiên", onClick: () => (location.href = "/theme-template/") });
  else
    _ledList.forEach((w) => {
      const cover = _ledCover(w);
      items.push({
        icon: cover ? `<img class="led-pop-av" src="${_ledEsc(cover)}" alt="" />` : _ledIco("heart"),
        label: _ledEsc(_ledNames(w)),
        active: _ledS.real && _ledS.wid === w.id,
        onClick: () => ledUse(w.id),
      });
    });
  _ledSrcPop.setItems(items);
  window.lucide?.createIcons({ root: _ledSrcPop });
}
_ledSrcPop.addEventListener("open", () => {
  if (_ledS.user && _ledList === null && _ledListState !== "loading") ledLoadList();
  _ledSrcItems();
});

async function ledLoadList() {
  const seq = ++_ledSeq;
  if (!_ledS.user) return;
  _ledListState = "loading";
  if (_ledSrcPop.isOpen) _ledSrcItems();
  let rows;
  try {
    rows = await weddingDAL.listMyWeddings();
  } catch (e) {
    if (seq === _ledSeq) _ledListState = "error";
    if (_ledSrcPop.isOpen) _ledSrcItems();
    return;
  }
  if (seq !== _ledSeq) return;
  // Thiệp đã xuất bản lên trước, trong mỗi nhóm thiệp mới tạo đứng đầu.
  _ledList = rows.sort(
    (a, b) => !!b.is_published - !!a.is_published || new Date(b.created_at || 0) - new Date(a.created_at || 0),
  );
  _ledListState = "ok";
  if (_ledS.wid && !_ledList.some((w) => w.id === _ledS.wid)) {
    _ledS.wid = null;
    _ledS.real = false;
  }
  if (_ledSrcPop.isOpen) _ledSrcItems();
  _ledSyncSrc();
  if (_ledS.real && _ledS.wid) ledUse(_ledS.wid, true);
}

// id = null → thông tin mẫu. Lấy hàng thiệp đầy đủ lần đầu chọn, rồi dựng lại.
async function ledUse(id, again) {
  if (!id) {
    if (!_ledS.real) return;
    _ledS.real = false;
  } else {
    if (!again && _ledS.real && _ledS.wid === id) return;
    _ledS.real = true;
    _ledS.wid = id;
    if (!_ledData.has(id)) {
      _ledSyncSrc();
      try {
        _ledData.set(id, await weddingDAL.getWeddingById(id));
      } catch (e) {
        if (_ledS.wid === id) _ledS.real = false;
        _ledSyncSrc();
        window.showToast?.("Không lấy được dữ liệu thiệp, hãy thử lại", "error");
        return;
      }
      if (_ledS.wid !== id) return;
    }
  }
  _ledSave();
  _ledSyncSrc();
  _ledBuild();
}

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
  _ledSyncName();
  _ledSyncSrc();
  _ledBuild();
  requestAnimationFrame(_ledTick);
  _ledS.user = await CXAuth.getUser();
  if (_ledS.real && _ledS.user) ledLoadList();
  // Lấy phiên TRƯỚC rồi mới nghe onChange, không thì lần đồng bộ đầu tải hai lần.
  CXAuth.onChange((user) => {
    if ((user?.id || null) === (_ledS.user?.id || null)) return;
    _ledS.user = user;
    _ledList = null;
    _ledListState = "idle";
    _ledData.clear();
    if (!user) {
      _ledS.wid = null;
      _ledS.real = false;
    } else if (_ledS.real) ledLoadList();
    _ledSyncSrc();
    _ledBuild();
  });
})();
