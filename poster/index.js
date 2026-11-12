// Trang "Ảnh TikTok" (công cụ nội bộ làm ảnh quảng cáo): một loạt ảnh (mặc định 5) ghép lời lên ảnh
// cưới (+ khối chữ thêm tuỳ ý). Mọi thao tác làm thẳng trên ảnh lớn — kéo chữ/ảnh, bấm để sửa chữ/đổi ảnh, thả file vào; kiểu
// chữ (màu, nền, độ mờ nền, cỡ) chỉnh ở thẻ "Chữ" hiện khi bấm vào chữ. Mỗi ảnh một mẫu, kiểu chữ theo mẫu. Vẽ bằng canvas trên máy, tải về
// JPEG theo độ nét ảnh gốc. Lời + kiểu chữ cất localStorage, ảnh khách chọn cất BYTE ở IndexedDB.

const _PO_TPLS = window.CX_POSTER_TEMPLATES || [];
// Lời của loạt ảnh đầu tiên (máy chưa có loạt nào cất sẵn); sau đó khách tự sửa trên từng ảnh.
const _PO_DEFAULT = [
  "Lời đầu tiên, con xin được gửi lời chào và lời cảm ơn chân thành nhất đến ông bà, bố mẹ, gia đình hai bên cùng quý vị khách quý đã dành thời gian có mặt trong ngày trọng đại của chúng con hôm nay.",
  "Con cảm ơn bố mẹ đã sinh thành, nuôi nấng và luôn là chỗ dựa vững chắc nhất để chúng con có được ngày hôm nay.",
  "Cảm ơn anh chị em, bạn bè đã luôn ở bên, sẻ chia cùng chúng con trên suốt chặng đường đã qua.",
  "Từ hôm nay, chúng con xin hứa sẽ cùng nhau vun đắp một gia đình nhỏ thật nhiều yêu thương, không phụ lòng mong mỏi của mọi người.",
  "Một lần nữa, chúng con kính chúc quý vị thật nhiều sức khoẻ, hạnh phúc và an khang. Chúng con xin cảm ơn!",
];
// Khổ ảnh: luôn dọc 3:4 (khổ ảnh bài nhiều ảnh của TikTok). Đây là khổ tối thiểu lúc xuất + khổ
// vẽ ảnh nhỏ; ảnh xuất to theo ảnh gốc, xem _poOutSize. Tỉ lệ ở CSS khai thẳng trong index.html.
const _PO_R = { w: 1080, h: 1440 };
const _PO_MAX = 10;
const _PO_DEMO = "romantic-gold"; // ảnh mặc định: bộ ảnh mẫu assets/data-template/<mẫu>/
const _PO_KEY = "demo"; // khoá cất loạt ảnh + ảnh khách chọn trên máy
const _PO_TYPES = ["image/jpeg", "image/png", "image/webp"];
const _PO_EDIT_RGB = "225, 29, 72";
const _PO_MAX_TEXTS = 6; // khối chữ thêm tối đa mỗi ảnh // hồng nhấn — khung gợi ý sửa trên ảnh lớn (không lên ảnh xuất)

// tpl = mẫu khách chọn gần nhất — mẫu của ảnh mới thêm / ảnh cũ chưa ghi mẫu; mỗi ảnh mang mẫu riêng (frame.tpl).
// sel = khối chữ đang sửa: null = lời chính của ảnh, còn lại là id khối chữ thêm (frame.texts).
const _poS = { tpl: _PO_TPLS[0]?.id || "", cur: 0, sel: null };
let _poDoc = { frames: [] };
let _poPool = []; // ảnh mẫu: [{src, focal}]
let _poBusy = false;
let _poHit = null; // khung khối chữ đang chọn trên ảnh lớn (phần của khổ ảnh)
let _poHits = []; // mọi khối chữ của ảnh lớn [{id: null | id khối thêm, r}], khối vẽ sau đứng sau mảng
let _poBox = null; // ô ảnh của ảnh lớn {x, y, w, h (phần), img}
let _poHover = null; // {what: "text", id} | {what: "photo"} | null

const _poEl = (id) => document.getElementById(id);
const _poEsc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const _poTplById = (id) => _PO_TPLS.find((t) => t.id === id);
// Mẫu của ảnh thứ i (mặc định ảnh đang chọn).
const _poTpl = (i = _poS.cur) => _poTplById(_poDoc.frames[i]?.tpl) || _poTplById(_poS.tpl) || _PO_TPLS[0];
const _poRatio = () => _PO_R;
const _poUid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
const _poClamp = (v, a, b) => Math.min(b, Math.max(a, v));
const _poCur = () => _poDoc.frames[_poS.cur];

// ── Lựa chọn chung: mẫu chọn gần nhất ──
const _PO_PREF = "cx_poster_prefs";
function _poSavePrefs() {
  try {
    localStorage.setItem(_PO_PREF, JSON.stringify({ tpl: _poS.tpl }));
  } catch (e) {}
}
function _poRestore() {
  try {
    const p = JSON.parse(localStorage.getItem(_PO_PREF) || "null");
    if (!p) return;
    if (_PO_TPLS.some((t) => t.id === p.tpl)) _poS.tpl = p.tpl;
  } catch (e) {}
}

// ── Loạt ảnh: localStorage `cx_poster_docs`[_PO_KEY] = {frames}. Mỗi ảnh {id, tpl (id mẫu), st (kiểu
// chữ khách đổi — RIÊNG ảnh này, chép sang ảnh khác xong vẫn sửa độc lập),
// text, x | null (% bề ngang, tâm khối chữ; null = chỗ mẫu đặt), y (% chiều cao), pick (số thứ tự ảnh
// mẫu), focal | null, texts: [khối chữ thêm]}. ──
const _PO_DOCS = "cx_poster_docs";
// Mọi thay đổi đều đi qua _poSaveDoc nên lịch sử hoàn tác ghi ở đây: trạng thái khác bản ghi trước là
// một bước (gõ chữ / kéo thanh đã gom qua _poSaveSoon). Ảnh khách chọn (IndexedDB) không nằm trong lịch sử.
const _PO_HIST_MAX = 60;
const _poHist = { undo: [], redo: [], cur: "" };
function _poHistRec() {
  const now = JSON.stringify(_poDoc);
  if (now === _poHist.cur) return;
  if (_poHist.cur) _poHist.undo.push(_poHist.cur);
  if (_poHist.undo.length > _PO_HIST_MAX) _poHist.undo.shift();
  _poHist.redo = [];
  _poHist.cur = now;
  _poHistBtns();
}
function _poHistBtns() {
  _poEl("po-undo")?.toggleAttribute("disabled", !_poHist.undo.length);
  _poEl("po-redo")?.toggleAttribute("disabled", !_poHist.redo.length);
}
function _poHistGo(from, to) {
  clearTimeout(_poSaveT);
  _poSaveDoc(); // chốt thay đổi đang chờ thành một bước trước khi lùi
  if (!from.length) return;
  _poEdClose();
  to.push(_poHist.cur);
  _poHist.cur = from.pop();
  const d = JSON.parse(_poHist.cur);
  _poDoc = { frames: d.frames.map((f, i) => _poFrame(f, i)) };
  _poS.cur = _poClamp(_poS.cur, 0, _poDoc.frames.length - 1);
  _poS.sel = null;
  _poHistSave();
  _poHistBtns();
  _poRenderStrip();
  _poTplMark();
  _poSyncTools();
  _poPaint();
}
function _poHistSave() {
  try {
    const all = JSON.parse(localStorage.getItem(_PO_DOCS) || "{}") || {};
    all[_PO_KEY] = _poDoc;
    localStorage.setItem(_PO_DOCS, JSON.stringify(all));
  } catch (e) {}
}
const poUndo = () => _poHistGo(_poHist.undo, _poHist.redo);
const poRedo = () => _poHistGo(_poHist.redo, _poHist.undo);
function _poSaveDoc() {
  _poHistRec();
  _poHistSave();
}
let _poSaveT = 0;
function _poSaveSoon() {
  clearTimeout(_poSaveT);
  _poSaveT = setTimeout(_poSaveDoc, 300);
}
function _poLoadDoc() {
  let own = null;
  try {
    own = JSON.parse(localStorage.getItem(_PO_DOCS) || "{}")?.[_PO_KEY];
  } catch (e) {}
  const ok = own && Array.isArray(own.frames) && own.frames.length;
  _poDoc = {
    frames: ok
      ? own.frames.slice(0, _PO_MAX).map((f, i) => _poFrame(f, i))
      : _PO_DEFAULT.map((line, i) => _poFrame({ text: line }, i)),
  };
  // Loạt cất theo kiểu cũ (kiểu chữ chung theo mẫu, `styles`) → đổ vào từng ảnh đang dùng mẫu đó.
  const old = own?.styles && typeof own.styles === "object" ? own.styles : null;
  if (old) _poDoc.frames.forEach((f) => (f.st = { ...(old[f.tpl] || {}), ...f.st }));
  _poS.cur = _poClamp(_poS.cur, 0, _poDoc.frames.length - 1);
}
function _poFrame(f, i) {
  return {
    id: f.id || _poUid(),
    tpl: _poTplById(f.tpl) ? f.tpl : _poS.tpl,
    st: f.st && typeof f.st === "object" ? f.st : {},
    text: typeof f.text === "string" ? f.text : "",
    x: Number.isFinite(f.x) ? _poClamp(f.x, 0, 100) : null,
    y: Number.isFinite(f.y) ? _poClamp(f.y, 0, 100) : 72,
    pick: Number.isInteger(f.pick) ? f.pick : i,
    focal: f.focal && Number.isFinite(f.focal.x) ? { x: f.focal.x, y: f.focal.y } : null,
    texts: (Array.isArray(f.texts) ? f.texts : []).slice(0, _PO_MAX_TEXTS).map(_poBlock),
  };
}
// Khối chữ thêm: {id, tpl (kiểu chữ = một mẫu không cố định chỗ chữ), text, x, y (% tâm khối), st
// (màu/cỡ khách đổi riêng khối này)}. Chỉ phần CHỮ của mẫu được vẽ — mẫu full không vẽ lại ảnh.
const _poKinds = () => _PO_TPLS.filter((t) => !t.fixedY);
function _poBlock(t) {
  const ok = _poKinds().some((k) => k.id === t?.tpl);
  return {
    id: t?.id || _poUid(),
    tpl: ok ? t.tpl : _poKinds()[0]?.id,
    text: typeof t?.text === "string" ? t.text : "",
    x: Number.isFinite(t?.x) ? _poClamp(t.x, 0, 100) : 50,
    y: Number.isFinite(t?.y) ? _poClamp(t.y, 0, 100) : 30,
    st: t?.st && typeof t.st === "object" ? t.st : {},
    link: typeof t?.link === "string" ? t.link : undefined, // id khối gốc khi chép bằng "Dùng cho hàng loạt"
  };
}

// ── Kiểu chữ: mặc định của mẫu đè bằng phần khách đổi (own = st của ảnh/khối — mỗi nơi một bản riêng) ──
function _poStyle(tpl = _poTpl(), own) {
  return { color: "#ffffff", bg: "#000000", accent: "#b5541c", alpha: 1, size: 1, align: "center", ...(tpl?.style || {}), ...(own || {}) };
}
// Khối đang sửa: khối chữ thêm (hoặc null = lời chính), mẫu + kiểu chữ của nó.
const _poBlk = () => (_poS.sel && _poCur()?.texts.find((t) => t.id === _poS.sel)) || null;
const _poSelTpl = () => {
  const b = _poBlk();
  return b ? _poTplById(b.tpl) : _poTpl();
};
const _poBlkStyle = (b) => _poStyle(_poTplById(b.tpl), b.st);
const _poSelStyle = () => {
  const b = _poBlk();
  return b ? _poBlkStyle(b) : _poStyle(_poTpl(), _poCur()?.st);
};
// Lời chính và khối chữ thêm đều giữ kiểu riêng của mình — đổi ở đây không lan sang ảnh khác.
function _poStyleSet(patch) {
  const t = _poBlk() || _poCur();
  if (!t) return;
  t.st = { ...t.st, ...patch };
  _poSaveSoon();
  _poSyncTools();
  _poPaint();
}
function poStyleReset() {
  const t = _poBlk() || _poCur();
  if (t) t.st = {};
  _poSaveDoc();
  _poSyncTools();
  _poPaint();
}
// ── Thẻ "Chữ" (#po-style-pop): bấm vào chữ trên ảnh lớn là mở, neo vào khối chữ. Ô lời (riêng ảnh
// đang chọn) + chấm màu chọn sẵn / "Màu khác" (bảng màu của máy), độ mờ nền, cỡ chữ — kiểu riêng của khối đang sửa. ──
const _PO_SWATCHES = {
  color: [["#ffffff", "Trắng"], ["#141414", "Đen"], ["#2e1a1e", "Nâu mận"], ["#f7e6c4", "Kem"], ["#f4cdd3", "Hồng phấn"], ["#c9375e", "Hồng đậm"]],
  bg: [["#ffffff", "Trắng"], ["#0c0c0c", "Đen"], ["#fcf8f5", "Giấy ngà"], ["#f4cdd3", "Hồng phấn"], ["#8e1b1f", "Đỏ son"], ["#2e1a1e", "Nâu mận"]],
  accent: [["#b5541c", "Cam đất"], ["#c9375e", "Hồng đậm"], ["#8e1b1f", "Đỏ son"], ["#d4a017", "Vàng nghệ"], ["#ffd54a", "Vàng tươi"], ["#141414", "Đen"]],
};
const _PO_OWN_LABEL = { color: "Màu chữ khác", bg: "Màu nền khác", accent: "Màu nhấn khác" };
const _poStylePop = _poEl("po-style-pop");
function _poRenderSwatches() {
  _poStylePop.querySelectorAll(".po-sws").forEach((row) => {
    const key = row.dataset.for;
    row.innerHTML =
      _PO_SWATCHES[key]
        .map(([c, name]) => `<button type="button" class="po-sw" role="radio" data-c="${c}" style="--c: ${c}" aria-label="${name}" title="${name}" aria-checked="false"></button>`)
        .join("") +
      `<label class="po-sw po-sw-own" title="Màu khác"><input type="color" data-own="${key}" aria-label="${_PO_OWN_LABEL[key]}" /></label>`;
  });
}
// Dải kiểu của khối chữ thêm (chỉ hiện khi đang sửa khối thêm): tên các mẫu chữ kéo được.
function _poRenderKinds() {
  _poEl("po-kinds").innerHTML = _poKinds()
    .map((t) => `<button type="button" class="po-kind" role="radio" data-kind="${_poEsc(t.id)}" aria-checked="false">${_poEsc(t.name)}</button>`)
    .join("");
}
_poStylePop.addEventListener("click", (e) => {
  const b = e.target.closest(".po-sw[data-c]");
  if (b) _poStyleSet({ [b.closest(".po-sws").dataset.for]: b.dataset.c });
  // Căn cả khối chữ (không phải căn dòng): x 0/100 → mẫu kẹp khối sát lề trái/phải (clampX), 50 = giữa.
  const al = e.target.closest("[data-align]");
  const f = _poBlk() || _poCur();
  if (al && f) {
    f.x = Number(al.dataset.align);
    _poSaveDoc();
    _poAlignMark();
    _poPaint();
  }
  // − / + cạnh thanh kéo: 1 đơn vị (1%) mỗi lần bấm.
  const sb = e.target.closest("[data-step]");
  if (sb) {
    const d = Number(sb.dataset.d);
    const st = _poSelStyle();
    if (sb.dataset.step === "alpha") _poStyleSet({ alpha: 1 - _poClamp(Math.round((1 - st.alpha) * 100) + d, 0, 100) / 100 });
    else _poStyleSet({ size: _poClamp(Math.round(st.size * 100) + d, 60, 160) / 100 });
  }
  // Căn dòng chữ trong khối: là một phần kiểu chữ (như màu/cỡ).
  const ta = e.target.closest("[data-talign]");
  if (ta) _poStyleSet({ align: ta.dataset.talign });
  // Đổi kiểu của khối chữ thêm: bỏ màu/cỡ riêng của kiểu cũ (mỗi kiểu một bộ màu riêng).
  const kd = e.target.closest("[data-kind]");
  const blk = _poBlk();
  if (kd && blk && kd.dataset.kind !== blk.tpl) {
    blk.tpl = kd.dataset.kind;
    blk.st = {};
    _poSaveDoc();
    _poSyncTools();
    _poPaint();
  }
});
function _poAlignMark() {
  const x = (_poBlk() || _poCur())?.x ?? 50;
  _poStylePop.querySelectorAll("[data-align]").forEach((b) => b.setAttribute("aria-pressed", String(Number(b.dataset.align) === x)));
}
_poStylePop.addEventListener("input", (e) => {
  const t = e.target;
  if (t.id === "po-text") {
    const f = _poBlk() || _poCur();
    if (!f) return;
    f.text = t.value;
    _poGrow(t);
    _poSaveSoon();
    return _poPaint();
  }
  if (t.dataset.own) _poStyleSet({ [t.dataset.own]: t.value });
  else if (t.id === "po-alpha") _poStyleSet({ alpha: 1 - Number(t.value) / 100 });
  else if (t.id === "po-size") _poStyleSet({ size: Number(t.value) / 100 });
});

// Từ lg bên phải ảnh còn trống nên thẻ mở sang phải khối chữ, đè ít lên ảnh đang xem đổi màu; khổ
// hẹp không có chỗ thì mở trên/dưới khối chữ (thiếu chỗ phía trên thì tự lật xuống).
const _poWide = matchMedia("(min-width: 1024px)");
const _poPopSide = () => _poStylePop.setAttribute("placement", _poWide.matches ? "right" : "top");
_poPopSide();
_poWide.addEventListener?.("change", _poPopSide);

// Đổ kiểu chữ của mẫu đang chọn lên thẻ; dòng mẫu không dùng thì ẩn.
function _poSyncTools() {
  const blk = _poBlk();
  const tpl = _poSelTpl();
  const st = _poSelStyle();
  const ctl = [...(tpl?.controls || ["color", "bg", "alpha", "size"]), ...(tpl?.fixedY ? [] : ["align"]), "talign", ...(blk ? ["kind"] : [])];
  _poStylePop.querySelectorAll("[data-ctl]").forEach((el) => el.classList.toggle("hidden", !ctl.includes(el.dataset.ctl)));
  _poAlignMark();
  _poStylePop.querySelectorAll("[data-talign]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.talign === st.align)));
  // Câu nhắc cách gõ riêng của mẫu nằm ở placeholder — thẻ không chừa dòng chữ mô tả nào.
  _poEl("po-text").placeholder = tpl?.hint || "Gõ lời cho ảnh này";
  _poStylePop.querySelectorAll(".po-sws").forEach((row) => {
    const cur = String(st[row.dataset.for]).toLowerCase();
    let hit = false;
    row.querySelectorAll(".po-sw[data-c]").forEach((b) => {
      const on = b.dataset.c === cur;
      hit ||= on;
      b.setAttribute("aria-checked", String(on));
    });
    // Màu không nằm trong dải chọn sẵn: chấm "Màu khác" mang chính màu đó và sáng vòng chọn.
    const own = row.querySelector(".po-sw-own");
    own.classList.toggle("is-on", !hit);
    own.style.setProperty("--c", hit ? "" : cur);
    const inp = own.querySelector("input");
    if (document.activeElement !== inp) inp.value = cur;
  });
  const a = _poEl("po-alpha");
  const s = _poEl("po-size");
  if (document.activeElement !== a) a.value = String(Math.round((1 - st.alpha) * 100));
  if (document.activeElement !== s) s.value = String(Math.round(st.size * 100));
  a.style.setProperty("--c", st.bg);
  _poRangeFill(s);
  _poEl("po-alpha-v").textContent = `${a.value}%`;
  _poEl("po-size-v").textContent = `${s.value}%`;
  _poEl("po-style-reset").classList.toggle("hidden", !Object.keys((blk || _poCur())?.st || {}).length);
  _poEl("po-blk-del").classList.toggle("hidden", !blk);
  _poStylePop.querySelectorAll("[data-kind]").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.kind === tpl?.id)));
  // Chip kiểu đang chọn lộ ra trong dải vuốt (cuộn riêng dải, không kéo cả thẻ).
  const on = blk && _poEl("po-kinds").querySelector('[aria-checked="true"]');
  if (on) on.parentElement.scrollLeft = on.offsetLeft - on.parentElement.offsetLeft - 8;
  _poEl("po-app").classList.toggle("po-fixed", !!_poTpl()?.fixedY);
  // Dòng/nút vừa hiện hay ẩn làm thẻ đổi chiều cao → tính lại chỗ đứng cho khỏi tràn khung nhìn.
  if (_poStylePop.isOpen) _poStylePop.place();
}
function _poRangeFill(r) {
  const min = Number(r.min);
  const max = Number(r.max);
  r.style.setProperty("--p", `${max > min ? ((Number(r.value) - min) / (max - min)) * 100 : 0}%`);
}

// ── Ảnh ──
// Ảnh mẫu: album của bộ dữ liệu mẫu, album rỗng thì ảnh bìa, cô dâu, chú rể.
function _poMakePool(w) {
  const fps = w?.image_focal_points || {};
  const fp = (v) => (v && Number.isFinite(v.x) ? { x: v.x, y: v.y } : null);
  let all = (Array.isArray(w?.gallery_images) ? w.gallery_images : [])
    .filter(Boolean)
    .map((file) => ({ src: getImageUrl(file), focal: fp(fps.gallery_images?.[file]) }));
  if (!all.length)
    all = ["cover_image_url", "bride_image_url", "groom_image_url"]
      .filter((k) => w?.[k])
      .map((k) => ({ src: getImageUrl(w[k]), focal: fp(fps[k]) }));
  return all;
}

// Ảnh khách chọn: byte trong IndexedDB `cx_poster` theo <_PO_KEY>|<id ảnh> (không cất Blob: WebKit
// có máy đọc lại Blob đã cất thành rỗng).
const _PO_DB = "cx_poster";
const _PO_STORE = "photos";
const _poOwn = {}; // id ảnh → {url}
let _poDbP = null;
function _poDB() {
  _poDbP ||= new Promise((resolve, reject) => {
    const rq = indexedDB.open(_PO_DB, 1);
    rq.onupgradeneeded = () => rq.result.objectStoreNames.contains(_PO_STORE) || rq.result.createObjectStore(_PO_STORE);
    rq.onsuccess = () => resolve(rq.result);
    rq.onerror = () => reject(rq.error);
  }).catch((e) => {
    _poDbP = null;
    throw e;
  });
  return _poDbP;
}
async function _poDbDo(mode, fn) {
  const db = await _poDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(_PO_STORE, mode);
    const rq = fn(tx.objectStore(_PO_STORE));
    tx.oncomplete = () => resolve(rq?.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
async function _poOwnLoad() {
  const prefix = _PO_KEY + "|";
  let keys = [];
  let vals = [];
  try {
    const range = IDBKeyRange.bound(prefix, prefix + "￿");
    [keys, vals] = await Promise.all([_poDbDo("readonly", (st) => st.getAllKeys(range)), _poDbDo("readonly", (st) => st.getAll(range))]);
  } catch (e) {
    console.warn("Không đọc được ảnh đã lưu:", e);
  }
  const live = new Set(_poDoc.frames.map((f) => f.id));
  (keys || []).forEach((k, i) => {
    const v = vals[i];
    const id = String(k).slice(prefix.length);
    // Ảnh của ảnh đã bỏ khỏi loạt (giữ lại trong phiên trước để hoàn tác) → dọn.
    if (!live.has(id)) return _poDbDo("readwrite", (st) => st.delete(k)).catch(() => {});
    if (!v?.buf?.byteLength) return;
    _poOwn[String(k).slice(prefix.length)] = { url: URL.createObjectURL(new Blob([v.buf], { type: v.type || "image/jpeg" })) };
  });
}
async function _poOwnDrop(id) {
  if (!_poOwn[id]) return;
  try {
    await _poDbDo("readwrite", (st) => st.delete(`${_PO_KEY}|${id}`));
  } catch (e) {}
  URL.revokeObjectURL(_poOwn[id].url);
  delete _poOwn[id];
}

// Ảnh của ảnh thứ i: ảnh khách chọn > ảnh mẫu theo thứ tự (lặp vòng). Điểm lấy nét khách kéo nằm ở
// frame.focal, áp cho cả hai loại.
function _poPhoto(i) {
  const f = _poDoc.frames[i];
  if (!f) return { src: "", focal: null, own: false };
  const own = _poOwn[f.id];
  if (own) return { src: own.url, focal: f.focal, own: true };
  if (!_poPool.length) return { src: "", focal: null, own: false };
  const p = _poPool[(((f.pick ?? i) % _poPool.length) + _poPool.length) % _poPool.length];
  return { src: p.src, focal: f.focal || p.focal, own: false };
}

// Ảnh tải một lần theo src. crossOrigin bắt buộc (thiếu là canvas "nhiễm", không xuất được ảnh);
// lượt CORS hỏng với ảnh khác miền thì thử lại bằng URL khác — bản trong cache trình duyệt có thể
// là của lượt tải không CORS.
const _poImgs = new Map(); // src → {p: Promise<img|null>, img}
function _poFetch(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}
function _poImg(src) {
  if (!src) return null;
  let e = _poImgs.get(src);
  if (!e) {
    e = { img: null };
    e.p = _poFetch(src)
      .then((img) => {
        if (img || !/^https?:/i.test(src) || new URL(src, location.href).origin === location.origin) return img;
        return _poFetch(src + (src.includes("?") ? "&" : "?") + "cx-cors=1");
      })
      .then((img) => {
        e.img = img;
        _poPaint();
        return img;
      });
    _poImgs.set(src, e);
  }
  return e;
}
const _poImgNow = (src) => _poImg(src)?.img || null;

// Vẽ ảnh phủ kín ô (x, y, w, h) theo điểm lấy nét (% của ảnh, như object-position).
function _poCover(ctx, img, x, y, W, H, focal) {
  const k = Math.max(W / img.naturalWidth, H / img.naturalHeight);
  const dw = img.naturalWidth * k;
  const dh = img.naturalHeight * k;
  const fx = (focal?.x ?? 50) / 100;
  const fy = (focal?.y ?? 50) / 100;
  ctx.drawImage(img, x + (W - dw) * fx, y + (H - dh) * fy, dw, dh);
}

// Vẽ ảnh thứ i lên ctx khổ W×H bằng mẫu tpl; trả về khung chữ (px) hoặc null. Mẫu `full` tự vẽ cả
// khung (ảnh qua c.photo); mẫu thường chỉ vẽ chữ đè lên ảnh phủ kín. rec(ô ảnh) báo chỗ ảnh nằm.
function _poDraw(ctx, W, H, i, tpl = _poTpl(i), rec, onBlk) {
  const f = _poDoc.frames[i];
  const ph = _poPhoto(i);
  const img = _poImgNow(ph.src);
  const photo = (x, y, w, h, path) => {
    ctx.save();
    if (path) path(ctx);
    else {
      ctx.beginPath();
      ctx.rect(x, y, w, h);
    }
    ctx.clip();
    ctx.fillStyle = "#2a2326";
    ctx.fillRect(x, y, w, h);
    if (img) _poCover(ctx, img, x, y, w, h, ph.focal);
    ctx.restore();
    rec?.({ x, y, w, h, img });
  };
  if (!tpl?.full) photo(0, 0, W, H);
  let b = null;
  if (tpl && (tpl.full || f?.text.trim())) {
    // Ảnh nhỏ trong thẻ Mẫu vẽ mẫu KHÁC mẫu của ảnh: dùng kiểu mặc định của mẫu đó (đổi mẫu là bỏ kiểu riêng).
    const style = _poStyle(tpl, tpl.id === f?.tpl ? f.st : null);
    ctx.save();
    b = tpl.draw(ctx, {
      W, H, u: W / 1080, i, n: _poDoc.frames.length,
      text: (f?.text || "").trim(),
      cx: f?.x != null && !tpl.fixedY ? (W * f.x) / 100 : null,
      cy: (H * (f?.y ?? 72)) / 100,
      size: style.size, style, photo, kit: window.CXPosterKit,
    });
    ctx.restore();
  }
  // Khối chữ thêm: vẽ đè lên sau cùng, chỉ phần chữ của kiểu (c.photo không vẽ gì).
  (f?.texts || []).forEach((t) => {
    const kt = _poTplById(t.tpl);
    const text = t.text.trim();
    let r = null;
    if (kt && text) {
      const style = _poBlkStyle(t);
      ctx.save();
      r = kt.draw(ctx, {
        W, H, u: W / 1080, i, n: _poDoc.frames.length, text,
        cx: (W * t.x) / 100, cy: (H * t.y) / 100,
        size: style.size, style, photo: () => {}, kit: window.CXPosterKit,
      });
      ctx.restore();
    }
    onBlk?.(t, r);
  });
  return b;
}

// ── Vẽ lại (gom vào một khung hình) ──
let _poRaf = 0;
function _poPaint() {
  if (_poRaf) return;
  _poRaf = requestAnimationFrame(() => {
    _poRaf = 0;
    _poPaintMain();
    _poPaintStrip();
    _poPaintGrid();
  });
}
function _poSizeCanvas(cv, cssW) {
  const R = _poRatio();
  const k = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.max(1, Math.min(R.w, Math.round(cssW * k)));
  const h = Math.round((w * R.h) / R.w);
  if (cv.width !== w || cv.height !== h) {
    cv.width = w;
    cv.height = h;
  }
}
// Ảnh lớn: vẽ như ảnh xuất, rồi thêm phần chỉ để sửa — khung nét đứt khi rê lên chữ/ảnh và ô
// "Bấm để thêm lời" khi ảnh chưa có lời.
function _poPaintMain() {
  const cv = _poEl("po-canvas");
  if (!cv.clientWidth) return;
  _poSizeCanvas(cv, cv.clientWidth);
  const W = cv.width;
  const H = cv.height;
  const ctx = cv.getContext("2d");
  const f = _poCur();
  let pr = null;
  const blks = [];
  const main = _poDraw(ctx, W, H, _poS.cur, undefined, (r) => (pr = r), (t, r) => blks.push({ t, r }));
  _poBox = pr ? { x: pr.x / W, y: pr.y / H, w: pr.w / W, h: pr.h / H, img: pr.img } : null;
  const k = W / 1080;
  // Khối chưa có lời: ô giữ chỗ tại tâm khối để còn bấm vào được.
  const hold = (x, y) => {
    const bw = W * 0.56;
    const bh = 96 * k;
    const cx = _poClamp(x != null ? (W * x) / 100 : W / 2, bw / 2 + W * 0.04, W * 0.96 - bw / 2);
    const cy = _poClamp((H * y) / 100, bh / 2, H - bh / 2);
    return { x: cx - bw / 2, y: cy - bh / 2, w: bw, h: bh };
  };
  const all = [];
  if (f) all.push({ id: null, r: main || (f.text.trim() ? null : hold(f.x, f.y)), empty: !f.text.trim() });
  blks.forEach((o) => all.push({ id: o.t.id, r: o.r || hold(o.t.x, o.t.y), empty: !o.t.text.trim() }));
  const open = _poStylePop.isOpen;
  const hov = _poHover;
  all.forEach((o) => {
    if (!o.r) return;
    if (o.empty) _poOutline(ctx, o.r, k, 0.9, "Bấm để thêm lời");
    else if ((open && o.id === _poS.sel) || (hov?.what === "text" && hov.id === o.id)) _poOutline(ctx, o.r, k, 1);
  });
  if (pr && hov?.what === "photo") _poOutline(ctx, pr, k, 0.7, "Bấm để đổi ảnh, kéo để căn");
  const frac = (r) => ({ x: r.x / W, y: r.y / H, w: r.w / W, h: r.h / H });
  _poHits = all.filter((o) => o.r).map((o) => ({ id: o.id, r: frac(o.r) }));
  _poHit = _poHits.find((o) => o.id === _poS.sel)?.r || null;
  _poAnchorSync();
}
// Mốc neo của thẻ "Chữ" khít lên khối chữ (theo %), thẻ đang mở thì đi theo khi chữ dời/giãn.
function _poAnchorSync() {
  const h = _poHit;
  const a = _poEl("po-text-anchor");
  if (!h) return;
  a.style.left = `${h.x * 100}%`;
  a.style.top = `${h.y * 100}%`;
  a.style.width = `${h.w * 100}%`;
  a.style.height = `${h.h * 100}%`;
  if (_poStylePop.isOpen) _poStylePop.place();
}
function _poOutline(ctx, r, k, alpha, label) {
  const pad = 8 * k;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.setLineDash([10 * k, 7 * k]);
  ctx.lineWidth = 3 * k;
  ctx.strokeStyle = `rgba(${_PO_EDIT_RGB}, 0.95)`;
  ctx.fillStyle = `rgba(${_PO_EDIT_RGB}, 0.08)`;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(r.x - pad, r.y - pad, r.w + pad * 2, r.h + pad * 2, 12 * k);
  else ctx.rect(r.x - pad, r.y - pad, r.w + pad * 2, r.h + pad * 2);
  // Khối chữ chỉ viền, không phủ màu: phủ lên là màu nền/chữ khách đang chọn trông lệch đi.
  if (label) ctx.fill();
  ctx.stroke();
  if (label) {
    ctx.setLineDash([]);
    ctx.font = `600 ${30 * k}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
    const tw = ctx.measureText(label).width + 40 * k;
    const th = 56 * k;
    const lx = r.x + r.w / 2 - tw / 2;
    const ly = r.y + r.h / 2 - th / 2;
    ctx.fillStyle = `rgb(${_PO_EDIT_RGB})`;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(lx, ly, tw, th, th / 2);
    else ctx.rect(lx, ly, tw, th);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, r.x + r.w / 2, ly + th / 2 + k);
  }
  ctx.restore();
}
function _poPaintStrip() {
  _poEl("po-strip").querySelectorAll("canvas[data-i]").forEach((cv) => {
    _poSizeCanvas(cv, cv.clientWidth || 48);
    _poDraw(cv.getContext("2d"), cv.width, cv.height, Number(cv.dataset.i));
  });
}
function _poPaintGrid() {
  _poEl("po-grid").querySelectorAll("canvas[data-tpl]").forEach((cv) => {
    _poSizeCanvas(cv, cv.clientWidth || 160);
    _poDraw(cv.getContext("2d"), cv.width, cv.height, _poS.cur, _poTplById(cv.dataset.tpl));
  });
}

// ── Thẻ "Mẫu" (nút ở bàn điều khiển): ảnh nhỏ của ảnh đang chọn theo từng mẫu; bấm là đổi mẫu RIÊNG
// ảnh đó (thẻ tự đóng), nút chân thẻ áp mẫu của ảnh đang chọn cho cả loạt.
const _poTplPop = _poEl("po-tpl-pop");
// Ảnh nhỏ đo khổ lúc vẽ — thẻ đóng thì khổ 0, nên vẽ lại khi mở.
_poTplPop.addEventListener("open", () => requestAnimationFrame(_poPaint));
function _poRenderGrid() {
  _poEl("po-grid").innerHTML = _PO_TPLS.map(
    (t) => `
    <button type="button" class="po-tpl" data-tpl="${_poEsc(t.id)}" aria-pressed="${t.id === _poTpl().id}" title="${_poEsc(t.desc || "")}">
      <canvas class="po-tpl-img" data-tpl="${_poEsc(t.id)}"></canvas>
      <span class="po-tpl-name">${_poEsc(t.name)}</span>
    </button>`,
  ).join("");
}
function _poTplMark() {
  const id = _poTpl().id;
  _poEl("po-grid").querySelectorAll("button[data-tpl]").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.tpl === id)));
  const n = _poDoc.frames.length;
  const cur = JSON.stringify(_poCur()?.st || {});
  const mixed = _poDoc.frames.some((f) => f.tpl !== id || JSON.stringify(f.st) !== cur);
  _poEl("po-tpl-all").classList.toggle("hidden", !mixed);
  _poEl("po-tpl-note").textContent = mixed ? `Bấm mẫu là đổi riêng ảnh ${_poS.cur + 1}.` : `Cả ${n} ảnh đang dùng mẫu này.`;
}
function _poSetTpl(id, all) {
  if (!_poTplById(id)) return;
  // Đổi mẫu: bỏ kiểu riêng của mẫu cũ. Cả loạt: mọi ảnh nhận mẫu + kiểu của ảnh đang chọn (bản chép, sửa độc lập).
  const src = _poCur();
  if (src.tpl !== id) Object.assign(src, { tpl: id, st: {} });
  if (all) _poDoc.frames.forEach((f) => f !== src && Object.assign(f, { tpl: id, st: { ...src.st } }));
  _poS.tpl = id;
  _poSavePrefs();
  _poSaveDoc();
  _poTplMark();
  _poSyncTools();
  _poPaint();
}
_poEl("po-grid").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-tpl]");
  if (b && b.dataset.tpl !== _poTpl().id) _poSetTpl(b.dataset.tpl);
});
const poTplAll = () => _poSetTpl(_poTpl().id, true);

// ── Dải ảnh của loạt: bấm để chọn, ô "+" thêm ảnh ──
function _poRenderStrip() {
  const n = _poDoc.frames.length;
  _poEl("po-strip").innerHTML =
    _poDoc.frames
      .map(
        (f, i) =>
          `<button type="button" class="po-thumb" role="tab" data-go="${i}" aria-selected="${i === _poS.cur}" aria-label="Ảnh ${i + 1}"><canvas data-i="${i}"></canvas><span class="po-thumb-n">${i + 1}</span></button>`,
      )
      .join("") +
    (n < _PO_MAX ? `<button type="button" class="po-thumb po-thumb-add" data-add aria-label="Thêm ảnh vào loạt" title="Thêm ảnh"><i data-lucide="plus"></i></button>` : "");
  window.lucide?.createIcons({ root: _poEl("po-strip") });
  _poMark();
  _poSyncTools();
  _poPaint();
}
function _poMark() {
  _poEl("po-strip").querySelectorAll("[data-go]").forEach((b) => {
    const on = Number(b.dataset.go) === _poS.cur;
    b.setAttribute("aria-selected", String(on));
    // Cuộn riêng dải (không kéo cả trang) cho ảnh đang chọn lộ ra.
    if (on) {
      const box = b.parentElement;
      const l = b.offsetLeft - box.offsetLeft;
      if (l < box.scrollLeft || l + b.offsetWidth > box.scrollLeft + box.clientWidth) box.scrollLeft = l - 8;
    }
  });
  _poEl("po-del").toggleAttribute("disabled", _poDoc.frames.length <= 1);
  _poEl("po-ph-undo").classList.toggle("hidden", !_poPhoto(_poS.cur).own);
  _poTplMark();
}
function _poGo(i) {
  _poEdClose();
  _poS.sel = null;
  _poS.cur = _poClamp(i, 0, _poDoc.frames.length - 1);
  _poMark();
  _poSyncTools();
  _poPaint();
}
function poStep(d) {
  const n = _poDoc.frames.length;
  _poGo((((_poS.cur + d) % n) + n) % n);
}
_poEl("po-strip").addEventListener("click", (e) => {
  if (e.target.closest("[data-add]")) return poAdd();
  const b = e.target.closest("[data-go]");
  if (b) _poGo(Number(b.dataset.go));
});
document.addEventListener("keydown", (e) => {
  if (e.target.closest?.("input, textarea, [contenteditable]")) return; // ô gõ có hoàn tác riêng của nó
  const k = e.key.toLowerCase();
  if ((e.ctrlKey || e.metaKey) && !e.altKey && (k === "z" || k === "y")) {
    e.preventDefault();
    return k === "y" || e.shiftKey ? poRedo() : poUndo();
  }
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
    e.preventDefault();
    poStep(e.key === "ArrowRight" ? 1 : -1);
  }
});

// Thêm ảnh sau ảnh cuối (lời trống, cùng chỗ chữ với ảnh trước) rồi mở ô sửa lời luôn.
function poAdd() {
  if (_poDoc.frames.length >= _PO_MAX) return;
  const i = _poDoc.frames.length;
  const prev = _poDoc.frames[i - 1];
  _poDoc.frames.push(_poFrame({ text: "", tpl: prev?.tpl, x: prev?.x, y: prev?.y }, i));
  _poSaveDoc();
  _poS.cur = i;
  _poRenderStrip();
  requestAnimationFrame(() => requestAnimationFrame(() => _poEditText(true)));
}
// Thêm một khối chữ lên ảnh đang chọn (kiểu của khối thêm gần nhất), mở thẻ "Chữ" gõ luôn.
function poAddText() {
  const f = _poCur();
  if (!f) return;
  if (f.texts.length >= _PO_MAX_TEXTS) return window.showToast?.(`Mỗi ảnh thêm tối đa ${_PO_MAX_TEXTS} khối chữ`, "warning");
  _poEdClose();
  const last = _poDoc.frames.flatMap((x) => x.texts).pop();
  const b = _poBlock({ tpl: last?.tpl, y: f.y > 50 ? 30 : 70 });
  f.texts.push(b);
  _poS.sel = b.id;
  _poSaveDoc();
  _poPaint();
  requestAnimationFrame(() => requestAnimationFrame(() => _poEditText(true)));
}
function poTextDel() {
  const f = _poCur();
  const b = _poBlk();
  if (!f || !b) return;
  f.texts = f.texts.filter((t) => t !== b);
  _poS.sel = null;
  _poEdClose();
  _poSaveDoc();
  _poPaint();
}
// Khối chữ thêm còn trống lúc đóng thẻ thì bỏ (trừ khối thẻ vừa mở lại ngay trong cùng cú bấm).
// ── Dùng cho hàng loạt (trong thẻ "Chữ"): chọn ảnh rồi CHÉP sang đó y hệt khối đang sửa — chép xong mỗi
// ảnh sửa độc lập. Lời chính: mẫu + kiểu chữ/nền + vị trí — lời từng ảnh giữ nguyên. Khối chữ thêm: kiểu,
// màu/cỡ riêng, vị trí; ảnh đích đã có bản chép trước (cùng `link`) thì cập nhật bản đó, chưa có thì
// thêm khối mới mang cả lời. ──
const _poAp = new Set();
function poApplyOpen() {
  _poAp.clear();
  const grid = _poEl("po-ap-grid");
  grid.innerHTML = _poDoc.frames
    .map((f, i) =>
      i === _poS.cur
        ? ""
        : `<button type="button" class="po-ap-it" data-ap="${i}" aria-pressed="false" aria-label="Ảnh ${i + 1}"><canvas></canvas><span class="po-thumb-n">${i + 1}</span></button>`,
    )
    .join("");
  _poEl("po-sp-main").classList.add("hidden");
  _poEl("po-apply").classList.remove("hidden");
  grid.querySelectorAll("[data-ap]").forEach((b) => {
    const cv = b.querySelector("canvas");
    _poSizeCanvas(cv, cv.clientWidth || 48);
    _poDraw(cv.getContext("2d"), cv.width, cv.height, Number(b.dataset.ap));
  });
  _poApMark();
  _poStylePop.place();
}
function poApplyClose() {
  _poEl("po-apply").classList.add("hidden");
  _poEl("po-sp-main").classList.remove("hidden");
  if (_poStylePop.isOpen) _poStylePop.place();
}
function _poApMark() {
  const items = [..._poEl("po-ap-grid").querySelectorAll("[data-ap]")];
  items.forEach((b) => b.setAttribute("aria-pressed", String(_poAp.has(Number(b.dataset.ap)))));
  const all = items.length > 0 && _poAp.size === items.length;
  _poEl("po-ap-all").textContent = all ? "Bỏ chọn" : "Chọn tất cả";
  const go = _poEl("po-ap-go");
  go.disabled = !_poAp.size;
  go.textContent = _poAp.size ? `Áp dụng cho ${_poAp.size} ảnh` : "Chọn ảnh để áp dụng";
}
function poApplyAll() {
  const n = _poEl("po-ap-grid").querySelectorAll("[data-ap]").length;
  if (_poAp.size === n) _poAp.clear();
  else _poDoc.frames.forEach((f, i) => i !== _poS.cur && _poAp.add(i));
  _poApMark();
}
_poEl("po-ap-grid").addEventListener("click", (e) => {
  const b = e.target.closest("[data-ap]");
  if (!b) return;
  const i = Number(b.dataset.ap);
  _poAp.has(i) ? _poAp.delete(i) : _poAp.add(i);
  _poApMark();
});
function poApplyGo() {
  const src = _poCur();
  const blk = _poBlk();
  if (!src || !_poAp.size) return;
  let n = 0;
  let full = 0;
  if (blk) blk.link ||= blk.id;
  _poAp.forEach((i) => {
    const f = _poDoc.frames[i];
    if (!f) return;
    if (!blk) {
      Object.assign(f, { tpl: src.tpl, st: { ...src.st }, x: src.x, y: src.y });
      return n++;
    }
    const copy = { tpl: blk.tpl, st: { ...blk.st }, x: blk.x, y: blk.y };
    const had = f.texts.find((t) => t.link === blk.link || t.id === blk.link);
    if (had) Object.assign(had, copy);
    else if (f.texts.length >= _PO_MAX_TEXTS) return full++;
    else f.texts.push({ ..._poBlock({ ...copy, text: blk.text }), link: blk.link });
    n++;
  });
  _poSaveDoc();
  poApplyClose();
  _poTplMark();
  _poSyncTools();
  _poPaint();
  window.showToast?.(
    full ? `Đã áp cho ${n} ảnh — ${full} ảnh đã đủ ${_PO_MAX_TEXTS} khối chữ nên bỏ qua` : `Đã áp cho ${n} ảnh`,
    full ? "warning" : "success",
  );
}

function _poPrune() {
  const f = _poCur();
  if (!f) return;
  const keep = _poStylePop.isOpen ? _poS.sel : undefined;
  const n = f.texts.length;
  f.texts = f.texts.filter((t) => t.text.trim() || t.id === keep);
  if (f.texts.length === n) return;
  if (!f.texts.some((t) => t.id === _poS.sel)) _poS.sel = null;
  _poSaveDoc();
  _poPaint();
}
function poRemove() {
  const f = _poCur();
  if (!f || _poDoc.frames.length <= 1) return;
  _poEdClose();
  // Giữ ảnh khách chọn của ảnh bị bỏ để còn hoàn tác; lần mở trang sau _poOwnLoad mới dọn.
  _poDoc.frames.splice(_poS.cur, 1);
  _poSaveDoc();
  _poS.cur = _poClamp(_poS.cur, 0, _poDoc.frames.length - 1);
  _poRenderStrip();
}

// ── Đổi ảnh: bấm vào ảnh (mở chọn file) hoặc thả file lên ảnh lớn ──
function _poPickPhoto() {
  const input = _poEl("po-ph-file");
  input.value = "";
  input.click();
}
async function _poSetPhoto(file) {
  const f = _poCur();
  if (!file || !f) return;
  if (!_PO_TYPES.includes(file.type)) {
    window.showToast?.("Định dạng không hỗ trợ — hãy dùng JPG, PNG hoặc WebP (ảnh iPhone .HEIC cần đổi sang JPG).", "error");
    return;
  }
  // Cất NGUYÊN file gốc (không nén) — ảnh xuất ra giữ đúng độ nét của ảnh khách chọn.
  let buf;
  try {
    buf = await file.arrayBuffer();
    if (!buf.byteLength) throw new Error("empty");
  } catch (err) {
    window.showToast?.("Không đọc được ảnh này, bạn chọn lại nhé", "error");
    return;
  }
  try {
    await _poDbDo("readwrite", (st) => st.put({ buf, type: file.type, name: file.name }, `${_PO_KEY}|${f.id}`));
  } catch (err) {
    console.warn("Không lưu được ảnh:", err);
    window.showToast?.("Máy không cho lưu ảnh (bộ nhớ trình duyệt đầy hoặc đang ở chế độ ẩn danh)", "warning");
  }
  if (_poOwn[f.id]) URL.revokeObjectURL(_poOwn[f.id].url);
  _poOwn[f.id] = { url: URL.createObjectURL(new Blob([buf], { type: file.type })) };
  f.focal = null;
  _poSaveDoc();
  _poMark();
  _poPaint();
}
_poEl("po-ph-file").addEventListener("change", (e) => {
  const file = e.target.files?.[0];
  e.target.value = "";
  _poSetPhoto(file);
});
async function poPhotoReset() {
  const f = _poCur();
  if (!f) return;
  await _poOwnDrop(f.id);
  f.focal = null;
  _poSaveDoc();
  _poMark();
  _poPaint();
}
const _poScr = _poEl("po-screen");
_poScr.addEventListener("dragover", (e) => {
  if (![...(e.dataTransfer?.items || [])].some((it) => it.kind === "file")) return;
  e.preventDefault();
  _poScr.classList.add("is-drop");
});
_poScr.addEventListener("dragleave", (e) => !_poScr.contains(e.relatedTarget) && _poScr.classList.remove("is-drop"));
_poScr.addEventListener("drop", (e) => {
  e.preventDefault();
  _poScr.classList.remove("is-drop");
  _poSetPhoto(e.dataTransfer?.files?.[0]);
});

// ── Mở thẻ "Chữ" cho ảnh đang chọn. focus: đặt con trỏ vào ô lời luôn (máy có chuột, ảnh mới thêm) —
// điện thoại thì không, kẻo bàn phím bật lên che mất ảnh khi khách chỉ muốn đổi màu. ──
function _poEditText(focus) {
  if (!_poCur()) return;
  const f = _poBlk() || _poCur();
  _poHit = _poHits.find((o) => o.id === _poS.sel)?.r || _poHit;
  _poAnchorSync();
  _poSyncTools();
  const ta = _poEl("po-text");
  ta.value = f.text;
  ta.setAttribute("aria-label", _poS.sel ? "Lời của khối chữ" : `Lời của ảnh ${_poS.cur + 1}`);
  _poStylePop.open();
  _poGrow(ta);
  _poStylePop.place();
  if (focus) {
    ta.focus({ preventScroll: true });
    ta.setSelectionRange(ta.value.length, ta.value.length);
  }
  _poPaint();
}
function _poGrow(ta) {
  ta.style.height = "auto";
  ta.style.height = `${ta.scrollHeight + 2}px`;
}
function _poEdClose() {
  if (_poStylePop.isOpen) _poStylePop.close();
}
_poStylePop.addEventListener("close", () => {
  poApplyClose();
  _poSaveDoc();
  _poPaint();
  setTimeout(_poPrune);
});

// ── Kéo/bấm trên ảnh lớn: khối chữ (lời chính hoặc khối thêm) → kéo dời (lời chính của mẫu fixedY
// thì không) / bấm sửa; ảnh → kéo căn (đổi điểm lấy nét) / bấm đổi ảnh. ──
const _poCv = _poEl("po-canvas");
let _poDrag = null;
const _poPt = (e) => {
  const r = _poCv.getBoundingClientRect();
  return r.width ? { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height } : null;
};
const _poIn = (r, pt, p = 0) => !!(r && pt && pt.x >= r.x - p && pt.x <= r.x + r.w + p && pt.y >= r.y - p && pt.y <= r.y + r.h + p);
// Khối vẽ sau nằm trên → dò từ cuối mảng.
function _poWhat(pt) {
  for (let n = _poHits.length - 1; n >= 0; n--) if (_poIn(_poHits[n].r, pt, 0.02)) return { what: "text", id: _poHits[n].id, r: _poHits[n].r };
  return _poIn(_poBox, pt) ? { what: "photo" } : null;
}
const _poSame = (a, b) => a?.what === b?.what && a?.id === b?.id;
// Lời chính của mẫu fixedY nằm ô cố định; khối thêm luôn kéo được.
const _poFixed = (id) => !id && !!_poTpl()?.fixedY;

_poCv.addEventListener("pointerdown", (e) => {
  const pt = _poPt(e);
  const f = _poCur();
  if (!pt || !f) return;
  _poAct = null;
  const hit = _poWhat(pt);
  if (!hit) return;
  const what = hit.what;
  const open = _poStylePop.isOpen;
  if (what === "text") _poS.sel = hit.id;
  const t = what === "text" ? _poBlk() || f : f;
  const ph = _poPhoto(_poS.cur);
  _poDrag = {
    id: e.pointerId, what, pt, moved: false, open, mouse: e.pointerType === "mouse",
    x: t.x ?? (hit.r ? (hit.r.x + hit.r.w / 2) * 100 : 50), y: t.y,
    fx: ph.focal?.x ?? 50, fy: ph.focal?.y ?? 50,
  };
  _poCv.setPointerCapture(e.pointerId);
  e.preventDefault();
});
_poCv.addEventListener("pointermove", (e) => {
  const pt = _poPt(e);
  const d = _poDrag;
  if (!d) {
    const hit = e.pointerType === "mouse" ? _poWhat(pt) : null;
    if (!_poSame(hit, _poHover)) {
      _poHover = hit;
      _poPaint();
    }
    _poCv.style.cursor = hit?.what === "text" ? (_poFixed(hit.id) ? "text" : "move") : hit?.what === "photo" ? "grab" : "";
    return;
  }
  if (d.id !== e.pointerId || !pt) return;
  const dx = pt.x - d.pt.x;
  const dy = pt.y - d.pt.y;
  if (!d.moved && Math.hypot(dx, dy) < 0.012) return;
  d.moved = true;
  const f = _poCur();
  if (d.what === "text") {
    if (_poFixed(_poS.sel)) return;
    const t = _poBlk() || f;
    t.x = _poClamp(Math.round((d.x + dx * 100) * 10) / 10, 0, 100);
    t.y = _poClamp(Math.round((d.y + dy * 100) * 10) / 10, 0, 100);
    _poAlignMark();
  } else {
    // Kéo ảnh = dời điểm lấy nét theo phần ảnh thừa ra ngoài ô (ảnh vừa khít trục nào thì trục đó đứng yên).
    const b = _poBox;
    const img = b?.img;
    if (!img) return;
    _poCv.style.cursor = "grabbing";
    const cw = _poCv.width;
    const ch = _poCv.height;
    const bw = b.w * cw;
    const bh = b.h * ch;
    const k = Math.max(bw / img.naturalWidth, bh / img.naturalHeight);
    const exX = img.naturalWidth * k - bw;
    const exY = img.naturalHeight * k - bh;
    f.focal = {
      x: exX > 1 ? _poClamp(d.fx - ((dx * cw) / exX) * 100, 0, 100) : d.fx,
      y: exY > 1 ? _poClamp(d.fy - ((dy * ch) / exY) * 100, 0, 100) : d.fy,
    };
  }
  _poPaint();
});
function _poUp(e) {
  const d = _poDrag;
  if (!d || d.id !== e.pointerId) return;
  _poDrag = null;
  _poCv.style.cursor = "";
  if (d.moved) _poSaveDoc();
  if (e.type !== "pointerup") return;
  // Việc cần làm để dành cho lượt click của chính cú bấm (xem listener "click" dưới).
  if (d.moved) _poAct = d.open && d.what === "text" ? () => _poEditText(false) : null; // kéo chữ lúc thẻ mở: giữ thẻ, đi theo chữ
  else if (d.what === "text") _poAct = () => _poEditText(d.mouse);
  else _poAct = d.open ? null : _poPickPhoto; // thẻ đang mở thì bấm ra ảnh chỉ để đóng thẻ
}
_poCv.addEventListener("pointerup", _poUp);
// Mở thẻ ở lượt click chứ không ở pointerup: thẻ nghe click (pha capture, trên document) để đóng khi bấm
// ra ngoài — chạy trước listener này, nên đóng xong mới mở lại. Với cảm ứng click tới trễ một nhịp, mở ở
// pointerup là bị chính cú chạm đó đóng liền.
let _poAct = null;
_poCv.addEventListener("click", () => {
  const fn = _poAct;
  _poAct = null;
  fn?.();
});
_poCv.addEventListener("pointercancel", _poUp);
_poCv.addEventListener("pointerleave", () => {
  if (_poDrag || !_poHover) return;
  _poHover = null;
  _poPaint();
});

// ── Tải xuống ──
async function _poReady() {
  await Promise.all(_poDoc.frames.map((f, i) => _poImg(_poPhoto(i).src)?.p));
  await _poFonts();
}
// Khổ xuất theo ảnh GỐC: lớn nhất mà ảnh vẫn phủ kín khung ở tỉ lệ 1:1 (không phóng, không thu),
// tối thiểu 1080px ngang; trần _PO_MAX_PX điểm ảnh — Safari iOS từ chối canvas lớn hơn ~16,7 triệu.
const _PO_MAX_PX = 16e6;
function _poOutSize(i) {
  const R = _poRatio();
  const img = _poImgNow(_poPhoto(i).src);
  let w = R.w;
  if (img?.naturalWidth) w = Math.max(R.w, Math.min(img.naturalWidth, (img.naturalHeight * R.w) / R.h));
  w = Math.floor(Math.min(w, Math.sqrt((_PO_MAX_PX * R.w) / R.h)));
  return { w, h: Math.round((w * R.h) / R.w) };
}
function _poBlob(i) {
  const { w, h } = _poOutSize(i);
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  _poDraw(cv.getContext("2d", { alpha: false }), w, h, i);
  return new Promise((resolve, reject) => {
    try {
      cv.toBlob((b) => (b ? resolve(b) : reject(new Error("blob"))), "image/jpeg", 1);
    } catch (e) {
      reject(e);
    }
  });
}
const _poName = (i) => `anh-tiktok-${String(i + 1).padStart(2, "0")}.jpg`;
function _poSaveBlob(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 60000);
}
const _poErr = () =>
  window.showToast?.("Chưa tạo được ảnh. Có ảnh trong loạt chưa tải xong hoặc không cho phép xuất, bạn thử đổi ảnh đó nhé", "error");
function _poSetBusy(on, label) {
  _poBusy = on;
  _poEl("po-all").classList.toggle("is-run", on);
  _poEl("po-all-t").textContent = label || "Tải cả bộ";
}
async function poSaveOne() {
  if (_poBusy) return;
  _poEdClose();
  _poSetBusy(true);
  try {
    await _poReady();
    _poSaveBlob(await _poBlob(_poS.cur), _poName(_poS.cur));
  } catch (e) {
    _poErr();
  } finally {
    _poSetBusy(false);
  }
}
// Cả loạt: điện thoại có bảng chia sẻ nhận file thì mở bảng đó (lưu vào Ảnh hoặc gửi thẳng sang
// TikTok); còn lại tải từng file một, cách nhau một nhịp để trình duyệt không gộp/chặn.
async function poSaveAll() {
  if (_poBusy) return;
  _poEdClose();
  const n = _poDoc.frames.length;
  _poSetBusy(true, "Đang tạo…");
  let blobs;
  try {
    await _poReady();
    blobs = [];
    for (let i = 0; i < n; i++) {
      _poSetBusy(true, `Đang tạo ${i + 1}/${n}`);
      blobs.push(await _poBlob(i));
    }
  } catch (e) {
    _poSetBusy(false);
    return _poErr();
  }
  _poSetBusy(false);
  const files = blobs.map((b, i) => new File([b], _poName(i), { type: "image/jpeg" }));
  if (matchMedia("(pointer: coarse)").matches && navigator.canShare?.({ files })) {
    try {
      await navigator.share({ files });
      return;
    } catch (e) {
      if (e?.name === "AbortError") return;
    }
  }
  for (let i = 0; i < files.length; i++) {
    _poSaveBlob(files[i], files[i].name);
    if (i < files.length - 1) await new Promise((r) => setTimeout(r, 350));
  }
}

let _poFontP = null;
function _poFonts() {
  if (!document.fonts?.load) return Promise.resolve();
  const sample = "AaĂăÂâĐđÊêÔôƠơƯư Ấấ Ữữ Ọọ 0123";
  _poFontP ||= Promise.all(_PO_TPLS.flatMap((t) => t.fonts || []).map((f) => document.fonts.load(f, sample).catch(() => null)));
  return _poFontP;
}

(async function initPosterPage() {
  _poRestore();
  _poLoadDoc();
  _poHist.cur = JSON.stringify(_poDoc);
  _poRenderGrid();
  _poRenderSwatches();
  _poRenderKinds();
  _poSyncTools();
  _poRenderStrip();
  // Khung ảnh đổi khổ (xoay máy, cột phải lg) → vẽ lại đúng độ nét.
  new ResizeObserver(() => _poPaint()).observe(_poScr);
  _poFonts().then(_poPaint);
  document.fonts?.ready?.then(_poPaint);
  await _poOwnLoad();
  _poMark();
  _poPaint();
  // preview-data.js đọc tên mẫu thiệp từ URL; trang này không nằm dưới /public/themes/ nên khai thẳng.
  window.currentThemeName = () => _PO_DEMO;
  _poPool = _poMakePool(await cxPreviewWedding());
  _poPaint();
})();
