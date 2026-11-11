// Lịch sử tab Giao diện (nút đồng hồ ở đầu bảng), dựng từ `theme_setting` theo từng MỤC
// (bộ màu, từng dòng chữ/ảnh, khối văn bản, thẻ nhạc…), gom theo tab. Hai loại dòng:
// tuỳ chỉnh ĐÃ CÓ trong JSON (mẫu gốc = theme_setting rỗng) → trả về như mẫu; thay đổi
// của LẦN CHỈNH NÀY (so với bản gốc nhớ trong sessionStorage, F5 không mất) → hoàn tác
// về lúc bắt đầu. Thứ khung thiệp tự đổi lúc nạp được nhập vào bản gốc, không thành dòng.

const TH_TOUCH_MS = 10000; // chạm cách đây quá lâu thì thay đổi kế tiếp không tính là của người dùng
const TH_SAMPLE_LEN = 48;

// Nhóm hiện trong popover, theo thứ tự dải tab. `ctab` = tab mở ra khi bấm đầu nhóm.
const TH_GROUPS = [
  { id: "main", ctab: "main" },
  { id: "line", title: "Chỉnh trên thiệp", icon: "mouse-pointer-click" },
  { id: "addtext", ctab: "addtext" },
  { id: "elements", ctab: "elements" },
  { id: "gift", ctab: "gift" },
  { id: "wishes", ctab: "wishes" },
  { id: "desktop", ctab: "desktop" },
];

const TH_TOP = { palette: "main", gift_box: "gift", wishes_mode: "wishes", desktop_wide: "desktop" };

let _thBase = null; // { key, items:{k:v}, idx:{k:n}, at:{k:ms}, sample:{k:str} }
let _thLast = null; // { k: chuỗi ổn định } ở lần ghi nhận trước
let _thTouchAt = 0;
let _thTimer = 0;

function _thStoreKey() {
  return `cx_theme_hist:${WEDDING_ID || "local"}:${WEDDING_THEME}`;
}

function _thClone(v) {
  return v === undefined ? undefined : JSON.parse(JSON.stringify(v));
}

// Bẻ theme_setting thành các mục hoàn tác được độc lập. Chỉnh riêng của khối văn bản
// (text_overrides["#cb_<id>…"]) đi CHUNG mục với khối — xoá khối là mất luôn phần đó.
function _thItems(ts) {
  const items = {};
  const idx = {};
  ts = ts || {};
  Object.keys(TH_TOP).forEach((k) => {
    if (ts[k] !== undefined) items[k] = ts[k];
  });
  const ov = (ts.text_overrides && typeof ts.text_overrides === "object" && ts.text_overrides) || {};
  const cbOv = {};
  Object.keys(ov).forEach((sel) => {
    const m = /^#(cb_[^\s.>+~:[]*)/.exec(sel);
    if (m) (cbOv[m[1].split("__")[0]] ||= {})[sel] = ov[sel];
    else items["ov:" + sel] = ov[sel];
  });
  (Array.isArray(ts.custom_blocks) ? ts.custom_blocks : []).forEach((b, i) => {
    if (!b || !b.id) return;
    items["cb:" + b.id] = { b, ov: cbOv[b.id] || {} };
    idx["cb:" + b.id] = i;
  });
  (Array.isArray(ts.elements) ? ts.elements : []).forEach((e, i) => {
    if (!e || !e.id) return;
    items["el:" + e.id] = e;
    idx["el:" + e.id] = i;
  });
  return { items, idx };
}

function _thStableMap(items) {
  const out = {};
  Object.keys(items).forEach((k) => (out[k] = _tsStable(items[k])));
  return out;
}

function _thSave() {
  try {
    sessionStorage.setItem(_thBase.key, JSON.stringify(_thBase));
  } catch (e) {}
}

// Lấy (hoặc dựng) bản gốc. Đổi mẫu thiệp là đổi khoá → bản gốc mới.
function _thEnsure() {
  const key = _thStoreKey();
  if (_thBase && _thBase.key === key) return;
  let saved = null;
  try {
    saved = JSON.parse(sessionStorage.getItem(key) || "null");
  } catch (e) {}
  if (saved && saved.items) {
    _thBase = { key, items: saved.items, idx: saved.idx || {}, at: saved.at || {}, sample: saved.sample || {} };
  } else {
    const { items, idx } = _thItems(_thClone(_themeSetting));
    _thBase = { key, items, idx, at: {}, sample: {} };
    _thSave();
  }
  _thLast = _thStableMap(_thItems(_themeSetting).items);
}

// Gọi ở mọi lần chạm trong tab (nhấn/thả/gõ) — kể cả trong khung thiệp.
function cxThemeHistTouch() {
  _thEnsure();
  _thTouchAt = Date.now();
}
window.cxThemeHistTouch = cxThemeHistTouch;

// Vào tab Giao diện: chụp bản gốc TRƯỚC thay đổi đầu tiên.
function cxThemeHistInit() {
  _thEnsure();
  _thRefresh();
}
window.cxThemeHistInit = cxThemeHistInit;

// Hẹn ghi nhận sau mỗi thay đổi (_scheduleAutoSave("theme")); gom nhịp kéo thanh trượt.
function cxThemeHistNote() {
  clearTimeout(_thTimer);
  _thTimer = setTimeout(_thTrack, 400);
}
window.cxThemeHistNote = cxThemeHistNote;

function _thFrameDoc() {
  try {
    return document.getElementById("theme-preview-iframe")?.contentDocument || null;
  } catch (e) {
    return null;
  }
}

// Chữ gốc của dòng (trước khi bị sửa) để người dùng nhận ra dòng nào.
function _thSampleOf(sel) {
  const doc = _thFrameDoc();
  let el = null;
  try {
    el = doc?.querySelector(sel);
  } catch (e) {}
  if (!el) return "";
  if (el.tagName === "IMG" || el.querySelector("img")) return "Ảnh";
  const t = (el.getAttribute("data-cx-orig") || el.textContent || "").replace(/\s+/g, " ").trim();
  return t.length > TH_SAMPLE_LEN ? t.slice(0, TH_SAMPLE_LEN - 1) + "…" : t;
}

function _thTrack() {
  clearTimeout(_thTimer);
  _thEnsure();
  const cur = _thItems(_themeSetting);
  const curS = _thStableMap(cur.items);
  const byUser = Date.now() - _thTouchAt < TH_TOUCH_MS;
  const keys = new Set([...Object.keys(curS), ...Object.keys(_thLast)]);
  keys.forEach((k) => {
    if (curS[k] === _thLast[k]) return;
    if (byUser) {
      _thBase.at[k] = Date.now();
      if (k.startsWith("ov:") && !_thBase.sample[k]) _thBase.sample[k] = _thSampleOf(k.slice(3));
    } else if (_tsStable(_thBase.items[k]) === _thLast[k]) {
      // Khung thiệp tự đổi một mục người dùng chưa đụng → đó vẫn là "gốc".
      if (k in cur.items) {
        _thBase.items[k] = _thClone(cur.items[k]);
        if (k in cur.idx) _thBase.idx[k] = cur.idx[k];
      } else delete _thBase.items[k];
    }
  });
  _thLast = curS;
  _thSave();
  _thRefresh();
}

// Trình phát nhạc sẵn có của mẫu được chuyển thành thành phần (id "el_music_…", xem
// _cxElSeedThemeMusic) — nó là của MẪU, không phải tuỳ chỉnh của khách.
function _thIsSeed(k) {
  return k.startsWith("el:el_music_");
}

// Mọi dòng của Lịch sử. `target`: "base" = đổi trong lần chỉnh này (hoàn tác về lúc bắt
// đầu), "tpl" = tuỳ chỉnh đã lưu trong theme_setting (trả về như mẫu gốc).
function _thEntries() {
  _thEnsure();
  const cur = _thItems(_themeSetting).items;
  const keys = new Set([...Object.keys(cur), ...Object.keys(_thBase.items)]);
  const out = [];
  keys.forEach((k) => {
    const before = _thBase.items[k];
    const after = cur[k];
    if (_tsStable(before) !== _tsStable(after))
      out.push(Object.assign({ key: k, target: "base", before, after, at: _thBase.at[k] || 0 }, _thDescribe(k, before, after)));
    else if (after !== undefined && !_thIsSeed(k))
      out.push(Object.assign({ key: k, target: "tpl", before: undefined, after, at: 0 }, _thDescribe(k, undefined, after)));
  });
  // Nhạc của mẫu đã bị xoá ở lần chỉnh trước: cờ music_seeded còn mà không còn thẻ nào.
  const hasSeed = (items) => Object.keys(items).some(_thIsSeed);
  if (_themeSetting.music_seeded && !hasSeed(cur) && !hasSeed(_thBase.items))
    out.push({ key: "seed:music", target: "tpl", at: 0, group: "elements", kind: "del", title: "Đã xoá trình phát nhạc của mẫu", detail: "" });
  return out;
}

// ── Mô tả một mục cho người đọc ─────────────────────────────────────────────

const TH_OV_FIELDS = {
  font: "phông",
  size: "cỡ chữ",
  color: "màu",
  gradient: "màu đổ",
  weight: "đậm",
  italic: "nghiêng",
  underline: "gạch chân",
  align: "căn lề",
};

function _thPalName(p) {
  return p ? p.name || "Bộ màu riêng" : "Mặc định của mẫu";
}

function _thGiftName(id) {
  if (!id) return "Mặc định của mẫu";
  if (id === "none") return "Không dùng hộp";
  return (window.CX_GIFT_BOXES || []).find((b) => b.id === id)?.name || id;
}

function _thWishName(id) {
  if (!id) return "Mặc định của mẫu";
  return (typeof WISH_MODES !== "undefined" && WISH_MODES.find((m) => m.id === id)?.name) || id;
}

function _thBlockText(b) {
  if (!b) return "";
  let t = "";
  if (b.type === "preset" && b.parts) t = Object.values(b.parts).filter(Boolean).join(" · ");
  else if (Array.isArray(b.content)) t = b.content.join(" · ");
  else t = String(b.content || "");
  t = t.replace(/\s+/g, " ").trim();
  return t.length > TH_SAMPLE_LEN ? t.slice(0, TH_SAMPLE_LEN - 1) + "…" : t;
}

function _thElName(e) {
  return (window.CX_ELEMENTS || {})[e?.element]?.name || "Thành phần";
}

// → { group, kind (add|del|hide|edit|reset), title, detail, focus? }
function _thDescribe(k, before, after) {
  const add = before === undefined;
  const del = after === undefined;
  if (k === "palette") {
    if (before && after && before.id === after.id)
      return {
        group: "main",
        kind: "edit",
        title: "Độ đậm màu",
        detail: `${before.strength ?? 50} → ${after.strength ?? 50}`,
      };
    return { group: "main", kind: del ? "reset" : "edit", title: del ? "Về bộ màu của mẫu" : "Đổi bộ màu", detail: `${_thPalName(before)} → ${_thPalName(after)}` };
  }
  if (k === "gift_box")
    return { group: "gift", kind: del ? "reset" : "edit", title: del ? "Về hộp của mẫu" : "Đổi hộp", detail: `${_thGiftName(before)} → ${_thGiftName(after)}` };
  if (k === "wishes_mode")
    return { group: "wishes", kind: del ? "reset" : "edit", title: del ? "Về cách hiện của mẫu" : "Đổi cách hiện", detail: `${_thWishName(before)} → ${_thWishName(after)}` };
  if (k === "desktop_wide")
    return { group: "desktop", kind: "edit", title: after ? "Bật trải rộng trên máy tính" : "Tắt trải rộng trên máy tính", detail: "" };

  if (k.startsWith("ov:")) {
    const sel = k.slice(3);
    const sample = _thBase.sample[k] || _thSampleOf(sel);
    const quote = sample && sample !== "Ảnh" ? `“${sample}”` : sample || "Phần tử trên thiệp";
    const isImg = sample === "Ảnh" || (after || before || {}).width != null || (after || before || {}).height != null;
    const base = { group: "line", detail: quote, focus: sel };
    if (after?.hidden && !before?.hidden) return Object.assign(base, { kind: "hide", title: isImg ? "Đã ẩn ảnh" : "Đã ẩn chữ" });
    if (before?.hidden && !after?.hidden) return Object.assign(base, { kind: "reset", title: isImg ? "Đã hiện lại ảnh" : "Đã hiện lại chữ" });
    if (del) return Object.assign(base, { kind: "reset", title: "Đặt lại về như mẫu" });
    if ((after?.text ?? null) !== (before?.text ?? null)) return Object.assign(base, { kind: "edit", title: "Sửa nội dung" });
    if (isImg) return Object.assign(base, { kind: "edit", title: "Đổi cỡ ảnh" });
    const changed = Object.keys(TH_OV_FIELDS).filter(
      (f) => _tsStable(after?.[f]) !== _tsStable(before?.[f]),
    );
    const what = changed.map((f) => TH_OV_FIELDS[f]).join(", ");
    return Object.assign(base, { kind: "edit", title: what ? `Đổi ${what}` : "Đổi kiểu chữ" });
  }

  if (k.startsWith("cb:")) {
    const id = k.slice(3);
    const text = _thBlockText((after || before).b);
    const base = { group: "addtext", detail: text ? `“${text}”` : "", focus: `[data-cb-id="${id}"]` };
    if (add) return Object.assign(base, { kind: "add", title: "Thêm khối văn bản" });
    if (del) return Object.assign(base, { kind: "del", title: "Xoá khối văn bản", focus: null });
    const bChanged = _tsStable(before.b) !== _tsStable(after.b);
    const same = (f) => _tsStable(before.b[f]) === _tsStable(after.b[f]);
    let title = "Đổi kiểu chữ khối văn bản";
    if (bChanged) title = !same("content") || !same("parts") ? "Sửa khối văn bản" : "Đổi vị trí khối văn bản";
    return Object.assign(base, { kind: "edit", title });
  }

  if (k.startsWith("el:")) {
    const name = _thElName(after || before);
    if (add) return { group: "elements", kind: "add", title: `Thêm ${name.toLocaleLowerCase("vi")}`, detail: "" };
    if (del) return { group: "elements", kind: "del", title: `Xoá ${name.toLocaleLowerCase("vi")}`, detail: "" };
    const moved = before.x !== after.x || before.y !== after.y;
    const sized = before.w !== after.w;
    const parts = [moved && "vị trí", sized && "cỡ", (!moved && !sized) && "kiểu dáng"].filter(Boolean);
    return { group: "elements", kind: "edit", title: `Đổi ${parts.join(", ")}`, detail: name };
  }
  return { group: "main", kind: "edit", title: k, detail: "" };
}

// ── Hoàn tác ───────────────────────────────────────────────────────────────

function _thSetOv(sel, v) {
  if (v === undefined) {
    if (_themeSetting.text_overrides) delete _themeSetting.text_overrides[sel];
  } else {
    (_themeSetting.text_overrides ||= {})[sel] = _thClone(v);
  }
  if (_themeSetting.text_overrides && !Object.keys(_themeSetting.text_overrides).length)
    delete _themeSetting.text_overrides;
}

// Đặt lại một phần tử mảng (khối văn bản / thành phần) theo bản gốc, giữ chỗ cũ.
function _thSetInArray(field, id, v, at) {
  const arr = Array.isArray(_themeSetting[field]) ? _themeSetting[field] : [];
  const i = arr.findIndex((x) => x && x.id === id);
  if (v === undefined) {
    if (i >= 0) arr.splice(i, 1);
  } else if (i >= 0) arr[i] = _thClone(v);
  else arr.splice(Math.min(at ?? arr.length, arr.length), 0, _thClone(v));
  if (arr.length) _themeSetting[field] = arr;
  else delete _themeSetting[field];
}

// Ghi giá trị đích của MỘT dòng vào `_themeSetting` — bản lúc bắt đầu chỉnh ("base")
// hoặc mẫu gốc ("tpl" = bỏ hẳn mục). Trả true khi phải nạp lại khung thiệp.
function _thApply(k, target) {
  if (k === "seed:music") {
    // Bỏ cờ → nạp lại khung là mẫu tự dựng lại trình phát của nó.
    delete _themeSetting.music_seeded;
    _scheduleAutoSave("theme");
    return true;
  }
  const v = target === "base" ? _thClone(_thBase.items[k]) : undefined;
  if (k === "palette") {
    if (v) _themeSetting.palette = v;
    else delete _themeSetting.palette;
    _syncPaletteGrid();
    _syncPaletteStrength();
    _applyThemeToFrame();
    _scheduleAutoSave("theme");
    return false;
  }
  if (k === "gift_box") return pickGiftBox(v || null), false;
  if (k === "wishes_mode") return pickWishMode(v || null), false;
  if (k === "desktop_wide") {
    onDesktopWideToggle(!!v);
    _syncDesktopWide();
    return false;
  }
  if (k.startsWith("ov:")) {
    const sel = k.slice(3);
    if (_lineSel === sel) closeLineEditor();
    _thSetOv(sel, v);
    _applyLine();
    return false;
  }
  if (k.startsWith("cb:")) {
    const id = k.slice(3);
    if (_lineBlockId === id) closeLineEditor();
    Object.keys(_themeSetting.text_overrides || {}).forEach((sel) => {
      if (sel.startsWith("#" + id)) _thSetOv(sel, undefined);
    });
    Object.entries(v?.ov || {}).forEach(([sel, o]) => _thSetOv(sel, o));
    _thSetInArray("custom_blocks", id, v?.b, _thBase.idx[k]);
    _scheduleAutoSave("theme");
    return true;
  }
  if (k.startsWith("el:")) {
    closeElementEditor();
    _thSetInArray("elements", k.slice(3), v, _thBase.idx[k]);
    _scheduleAutoSave("theme");
    return true;
  }
  return false;
}

// Sau hoàn tác: chụp lại để lần ghi nhận kế tiếp không coi việc vừa làm là thay đổi mới.
function _thAfterUndo(reload) {
  if (reload) _reloadThemeFrame();
  clearTimeout(_thTimer);
  _thLast = _thStableMap(_thItems(_themeSetting).items);
  _thSave();
  _thRefresh();
}

function cxThemeHistUndo(k) {
  _thEnsure();
  const e = _thEntries().find((x) => x.key === k);
  if (!e) return;
  // Trả về như mẫu cũng là một thay đổi của lần chỉnh này → có giờ, hoàn tác được.
  if (e.target === "tpl") _thBase.at[k] = Date.now();
  _thAfterUndo(_thApply(k, e.target));
  showToast(e.target === "base" ? `Đã hoàn tác: ${e.title}` : `${_thTplLabel(e)}: ${e.title}`, "success");
}
window.cxThemeHistUndo = cxThemeHistUndo;

// Chỉ các thay đổi của lần chỉnh này; về hẳn mẫu gốc đã có "Đặt lại cả thiệp".
async function cxThemeHistUndoAll() {
  const list = _thEntries().filter((e) => e.target === "base");
  if (!list.length) return;
  const ok = await showConfirm(
    "Hoàn tác thay đổi lần này?",
    `${list.length} thay đổi trong lần chỉnh này sẽ trở về như lúc bạn bắt đầu. ` +
      "Nội dung thiệp (tên, ngày, ảnh…) không đổi.",
    { confirmText: "Hoàn tác tất cả" },
  );
  if (!ok) return;
  let reload = false;
  list.forEach((e) => (reload = _thApply(e.key, "base") || reload));
  _thAfterUndo(reload);
  showToast("Đã hoàn tác các thay đổi lần này", "success");
}
window.cxThemeHistUndoAll = cxThemeHistUndoAll;

// ── Popup (openBottomSheet: bottom sheet dưới sm, hộp giữa màn từ sm) ─────────

const TH_KIND_ICON = { add: "plus", del: "trash-2", hide: "eye-off", edit: "pencil", reset: "rotate-ccw" };

let _thSheet = null; // { body, footer, close } khi popup đang mở

function _thAgo(ms) {
  if (!ms) return "";
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 45) return "Vừa xong";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} phút trước`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} giờ trước`;
  return new Date(ms).toLocaleDateString("vi");
}

function _thEsc(s) {
  return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
}

function _thGroupMeta(g) {
  if (!g.ctab) return { title: g.title, icon: g.icon };
  const v = CTRL_VIEWS.find((x) => x.key === g.ctab);
  return { title: v ? _ctrlTitle(v) : g.id, icon: v?.icon || "circle" };
}

// Nhãn nút của dòng "tuỳ chỉnh đã lưu" — nói đúng việc sẽ xảy ra.
function _thTplLabel(e) {
  if (e.kind === "hide") return "Hiện lại";
  if (e.kind === "add") return "Gỡ";
  if (e.kind === "del") return "Khôi phục";
  return "Về như mẫu";
}

function _thRowHTML(e) {
  const when = e.target === "base" ? _thAgo(e.at) || "Lần chỉnh này" : "Đã lưu";
  const focus = e.focus
    ? ` data-th-focus="${_thEsc(e.focus)}" role="button" tabindex="0" title="Xem trên thiệp"`
    : "";
  return (
    `<li class="cx-hist-it">` +
    `<span class="cx-hist-ki is-${e.kind}"><i data-lucide="${TH_KIND_ICON[e.kind] || "pencil"}" style="width:14px;height:14px"></i></span>` +
    `<div class="cx-hist-tx"${focus}>` +
    `<span class="cx-hist-t">${_thEsc(e.title)}</span>` +
    (e.detail ? `<span class="cx-hist-d">${_thEsc(e.detail)}</span>` : "") +
    `<span class="cx-hist-w${e.target === "base" ? " is-new" : ""}">${when}</span>` +
    `</div>` +
    (e.target === "base"
      ? `<x-button variant="outline" tone="neutral" size="xs" icon="undo-2" data-th-undo="${_thEsc(e.key)}" title="Trả về như lúc bắt đầu chỉnh">Hoàn tác</x-button>`
      : `<x-button variant="outline" tone="neutral" size="xs" data-th-undo="${_thEsc(e.key)}" title="Trả phần này về như mẫu gốc">${_thTplLabel(e)}</x-button>`) +
    `</li>`
  );
}

function _thRender() {
  if (!_thSheet) return;
  const list = _thEntries();
  const { body, footer } = _thSheet;
  let html = "";
  if (!list.length) {
    html =
      `<div class="cx-hist-empty"><span class="cx-hist-empty-ico"><i data-lucide="history" style="width:24px;height:24px"></i></span>` +
      `<p class="cx-hist-empty-t">Thiệp đang y như mẫu gốc</p>` +
      `<p class="cx-hist-empty-d">Đổi màu, sửa hay ẩn chữ, thêm khối văn bản, thả thẻ nhạc… sẽ hiện ở đây theo từng tab để bạn xem lại và hoàn tác riêng từng việc.</p></div>`;
  } else {
    const fresh = list.filter((e) => e.target === "base").length;
    const saved = list.length - fresh;
    const parts = [
      saved && `<b>${saved} tuỳ chỉnh</b> đã lưu so với mẫu gốc`,
      fresh && `<b>${fresh} thay đổi</b> trong lần chỉnh này`,
    ].filter(Boolean);
    html = `<p class="cx-hist-intro">${parts.join(" · ")}. Bấm vào một dòng để xem nó trên thiệp.</p>`;
    TH_GROUPS.forEach((g) => {
      // Thay đổi lần này lên đầu (mới nhất trước), tuỳ chỉnh đã lưu xếp sau.
      const rows = list
        .filter((e) => e.group === g.id)
        .sort((a, b) => (b.target === "base") - (a.target === "base") || b.at - a.at);
      if (!rows.length) return;
      const meta = _thGroupMeta(g);
      html +=
        `<section class="cx-hist-grp"><div class="cx-hist-gh">` +
        `<span class="cx-hist-gi"><i data-lucide="${meta.icon}" style="width:16px;height:16px"></i></span>` +
        `<span class="cx-hist-gt">${_thEsc(meta.title)}</span><span class="cx-hist-gn">${rows.length}</span>` +
        (g.ctab
          ? `<button type="button" class="cx-hist-open" data-th-tab="${g.ctab}">Mở tab<i data-lucide="chevron-right" style="width:14px;height:14px"></i></button>`
          : "") +
        `</div><ul class="cx-hist-list">${rows.map(_thRowHTML).join("")}</ul></section>`;
    });
  }
  body.innerHTML = `<div class="cx-hist-body">${html}</div>`;
  footer.innerHTML =
    `<div class="cx-hist-foot">` +
    (list.some((e) => e.target === "base")
      ? `<x-button variant="ghost" tone="danger" size="md" icon="rotate-ccw" data-th-all>Hoàn tác lần này</x-button>`
      : "") +
    `<x-button variant="fill" tone="brand" size="md" class="ml-auto" data-th-close>Xong</x-button></div>`;
  window.lucide?.createIcons({ root: body });
  window.lucide?.createIcons({ root: footer });
}

// Số đỏ trên nút = thay đổi của lần chỉnh này; kèm làm mới popup nếu đang mở.
function _thRefresh() {
  const n = _thBase ? _thEntries().filter((e) => e.target === "base").length : 0;
  const badge = document.getElementById("cx-ch-hist-n");
  if (badge) {
    badge.textContent = n > 99 ? "99+" : String(n);
    badge.classList.toggle("hidden", !n);
  }
  const btn = document.getElementById("cx-ch-hist");
  btn?.setAttribute("aria-label", n ? `Lịch sử thay đổi (${n})` : "Lịch sử thay đổi");
  if (_thSheet) _thRender();
}

function _thOnClick(e) {
  const t = e.target;
  const undo = t.closest("[data-th-undo]");
  if (undo) return cxThemeHistUndo(undo.dataset.thUndo);
  if (t.closest("[data-th-all]")) return cxThemeHistUndoAll();
  if (t.closest("[data-th-close]")) return _thSheet?.close();
  const tab = t.closest("[data-th-tab]");
  if (tab) {
    _thSheet?.close();
    return cxCtrlTab(tab.dataset.thTab);
  }
  const focus = t.closest("[data-th-focus]");
  if (focus) {
    // Dưới sm popup che kín thiệp → đóng trước rồi mới cuộn tới.
    if (!window.matchMedia?.("(min-width: 640px)").matches) _thSheet?.close();
    document
      .getElementById("theme-preview-iframe")
      ?.contentWindow?.postMessage({ type: "cx-scroll", selector: focus.dataset.thFocus }, "*");
  }
}

// Nút đồng hồ ở đầu bảng chỉnh.
function cxThemeHistOpen() {
  if (_thSheet) return;
  _thTrack();
  const sheet = openBottomSheet({
    id: "cx-hist-sheet",
    title:
      '<span class="cx-hist-gi"><i data-lucide="history" style="width:16px;height:16px"></i></span>Lịch sử thay đổi',
    height: 80,
    cardClass: "cx-sheet-fit sm:max-w-xl",
    onClose: () => {
      _thSheet = null;
      document.getElementById("cx-ch-hist")?.setAttribute("aria-expanded", "false");
    },
  });
  if (!sheet) return;
  _thSheet = sheet;
  document.getElementById("cx-ch-hist")?.setAttribute("aria-expanded", "true");
  sheet.body.className = "flex-1 min-h-0 overflow-y-auto overscroll-contain";
  const modal = document.getElementById("cx-hist-sheet");
  modal.addEventListener("click", (e) => {
    if (e.target === modal) return sheet.close(); // bấm ra nền mờ
    _thOnClick(e);
  });
  modal.addEventListener("keydown", (e) => {
    if (e.key === "Escape") sheet.close();
    else if (e.key === "Enter" && e.target.matches("[data-th-focus]")) e.target.click();
  });
  window.lucide?.createIcons({ root: modal });
  _thRender();
}
window.cxThemeHistOpen = cxThemeHistOpen;

// Chạm = nhấn/thả/gõ trong tab, kể cả trong khung thiệp (cùng origin; mỗi lần khung
// nạp lại là document mới nên gắn lại).
(function _thWatchTouch() {
  const opts = { capture: true, passive: true };
  const on = (root) =>
    ["pointerdown", "pointerup", "keydown", "input"].forEach((ev) =>
      root?.addEventListener(ev, cxThemeHistTouch, opts),
    );
  on(document.getElementById("theme-panel"));
  const frame = document.getElementById("theme-preview-iframe");
  frame?.addEventListener("load", () => {
    try {
      on(frame.contentDocument);
    } catch (e) {}
    _thRefresh();
  });
})();
