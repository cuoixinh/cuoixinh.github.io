const WEDDING_ID = new URLSearchParams(window.location.search).get("id");
// ?from=list: mở từ màn "Khách mời" (/guest-list/) — nút quay lại về đó thay vì
// trang Thiết lập. Chỉ nhận đúng giá trị này, không nhận URL tuỳ ý.
const FROM_LIST = new URLSearchParams(window.location.search).get("from") === "list";

let _importState = { headers: [], data: [], side: "" };
let _currentTab = "groom";

// ─── Init ─────────────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", async () => {
  // Đứng TRƯỚC lucide: CDN icon lỗi là dòng dưới ném, nút quay lại kẹt ở nhãn cũ.
  if (FROM_LIST) {
    const back = document.getElementById("gs-back");
    back?.setAttribute("title", "Chọn thiệp khác");
    back?.setAttribute("aria-label", "Chọn thiệp khác");
  }
  _initMoreMenu();
  _bindStatFilters();
  lucide.createIcons();
  if (!WEDDING_ID) { showToast("Không tìm thấy ID thiệp", "warning"); return; }
  await Promise.all([loadGuestList("groom"), loadGuestList("bride"), _getWedding().then(_syncTopSub)]);
});

// Event delegation cho nút trong danh sách (tránh inline onclick với dữ liệu user)
document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  const action = btn.dataset.action;
  const link   = btn.dataset.link;
  const guestId = btn.dataset.guestId;
  const side    = btn.dataset.side;

  if (action === "copy" && link)         { e.stopPropagation(); copyGuestLink(link); }
  if (action === "share" && guestId)     { e.stopPropagation(); _openShareModal(guestId, side); }
  if (action === "menu" && guestId)      { e.stopPropagation(); _openRowMenu(btn, guestId, side); }
  if (action === "wishes" && guestId)    { e.stopPropagation(); _openWishesModal(guestId, side); }
  if (action === "edit" && guestId)      { e.stopPropagation(); _openEditGuest(_findGuest(guestId, side), side); }
});

// Popup: nhớ phần tử đang focus lúc mở để trả focus về đó khi đóng (bàn phím /
// trình đọc màn hình không bị rơi về đầu trang).
function _modalShow(modal, focusEl) {
  modal._cxOpener = document.activeElement;
  modal.classList.remove("hidden");
  modal.classList.add("flex");
  setTimeout(() => focusEl?.focus(), 50);
}

function _modalHide(modal) {
  modal.classList.add("hidden");
  modal.classList.remove("flex");
  const opener = modal._cxOpener;
  modal._cxOpener = null;
  if (opener && document.contains(opener)) opener.focus();
}

// Bấm vào nền mờ quanh popup = đóng (popup thêm khách vẫn hỏi lại nếu đang dở).
document.addEventListener("DOMContentLoaded", () => {
  [["add-guest-modal", () => closeAddGuestModal()], ["import-mapping-modal", () => closeMappingModal()]]
    .forEach(([id, close]) => {
      const m = document.getElementById(id);
      m?.addEventListener("click", (e) => { if (e.target === m) close(); });
    });
});

// Esc đóng popup đang mở trên cùng (popup lời chúc dựng động nên nằm sau cùng).
// Nghe ở pha capture để chạy TRƯỚC alert.js — nó đóng hộp xác nhận rồi mới tới lượt
// mình thì không còn biết Esc ấy là của hộp xác nhận.
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  // Hộp xác nhận (core/helpers/alert.js) đang mở thì Esc là việc của nó.
  if (document.getElementById("cx-alert-backdrop")?.classList.contains("visible")) return;
  if (document.getElementById("wishes-modal")) { _closeWishesModal(); return; }
  if (!document.getElementById("import-mapping-modal").classList.contains("hidden")) { closeMappingModal(); return; }
  if (!document.getElementById("add-guest-modal").classList.contains("hidden")) closeAddGuestModal();
}, true);

function goBack() {
  // Khi nhúng trong iframe của trang thiết lập → quay lại panel cha, không load lại trang
  if (window.parent !== window && typeof window.parent.exitGuestsPanel === "function") {
    window.parent.exitGuestsPanel();
    return;
  }
  if (FROM_LIST) {
    window.location.href = "/guest-list/";
    return;
  }
  window.location.href = `../index.html?id=${WEDDING_ID}`;
}

// Dòng phụ dưới tiêu đề header: đường dẫn thiệp (host/slug).
function _syncTopSub(w) {
  const sub = document.getElementById("gs-top-sub");
  if (sub && w?.slug) sub.textContent = `${location.host}/${w.slug}`;
}

// ─── Tab ──────────────────────────────────────────────────────────────────────

// Dải segmented (.cx-seg ở styles/_common.css): con trượt chạy theo --i, nút
// đang chọn mang .is-on. Ô thống kê luôn là số của bên đang mở.
function switchTab(side) {
  _currentTab = side;
  const seg = document.getElementById("guest-seg");

  ["groom", "bride"].forEach((s, i) => {
    const on = s === side;
    document.getElementById(`panel-${s}`)?.classList.toggle("hidden", !on);
    const btn = document.getElementById(`tab-${s}`);
    if (!btn) return;
    btn.classList.toggle("is-on", on);
    btn.setAttribute("aria-selected", String(on));
    if (on) seg?.style.setProperty("--i", String(i));
  });
  _syncStats();
}

// ─── Thanh công cụ ────────────────────────────────────────────────────────────

const _ico = (name, size = 16) =>
  `<i data-lucide="${name}" style="width:${size}px;height:${size}px"></i>`;
// Icon "Nhập Excel": bảng tính xanh lá kiểu Excel ở mọi chỗ (thanh công cụ, khối trống).
const _ICO_EXCEL = `<i data-lucide="file-spreadsheet" class="gs-excel" style="width:16px;height:16px"></i>`;

// Icon mục menu ⋯: mỗi việc một tông màu (ô nền nhạt + icon đậm, .gs-tone-* ở
// _setup.css) cho dễ nhận ra bằng mắt. `tone` là tên lớp viết trọn.
const _popIco = (name, tone) => `<span class="gs-pop-ico ${tone}">${_ico(name)}</span>`;

// Menu "⋯": các việc ít dùng, đều nhắm vào bên đang mở. Dưới sm nút "Nhập Excel"
// của thanh công cụ bị ẩn (không đủ chỗ) nên mục đó chuyển vào đây.
function _initMoreMenu() {
  const pop = document.getElementById("gs-more-pop");
  const narrow = !matchMedia("(min-width: 640px)").matches;
  pop.setItems([
    ...(narrow ? [{ icon: _popIco("file-spreadsheet", "gs-tone-green"), label: "Nhập từ Excel", onClick: pickExcel }] : []),
    { icon: _popIco("file-down", "gs-tone-blue"), label: "Xuất danh sách Excel", onClick: () => exportGuestList(_currentTab) },
    { icon: _popIco("download", "gs-tone-amber"), label: "Tải file Excel mẫu", onClick: downloadGuestTemplate },
    { sep: true },
    { icon: _popIco("link", "gs-tone-violet"), label: "Tạo link cho khách thiếu", onClick: () => regenerateLinks(_currentTab) },
  ]);
  lucide.createIcons({ root: pop });
}

function toggleMoreMenu() {
  const pop = document.getElementById("gs-more-pop");
  if (!pop.isOpen) _initMoreMenu();
  pop.toggle(document.getElementById("gs-more"));
}

function pickExcel() {
  document.getElementById("gs-file").click();
}

// ─── Tìm kiếm & lọc ───────────────────────────────────────────────────────────

let _query = "";
let _filter = "all";
// Lần vẽ kế tiếp do người dùng tìm / lọc → báo số kết quả cho trình đọc màn hình.
let _announce = false;

// So khớp không dấu: "nguyen" tìm ra "Nguyễn".
function _fold(s) {
  return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase().trim();
}

const _FILTERS = {
  all:    () => true,
  viewed: (g) => !!g.viewed,
  yes:    (g) => _isAttending(g),
  wishes: (g) => _guestNoteCount(g) > 0,
};

function _isAttending(g) {
  return !!g.confirmed && g.confirmed.includes("Có");
}

function _visibleGuests(side) {
  const q = _fold(_query);
  const pass = _FILTERS[_filter] || _FILTERS.all;
  return _allGuests[side].filter((g) =>
    pass(g) && (!q || _fold(`${g.full_name} ${g.display_name || ""}`).includes(q)));
}

let _searchTimer = 0;
function onGuestSearch(value) {
  clearTimeout(_searchTimer);
  _searchTimer = setTimeout(() => {
    _query = value;
    _announce = true;
    _page.groom = _page.bride = 1;
    _renderGuestList(_currentTab);
  }, 150);
}

function _bindStatFilters() {
  document.querySelectorAll(".gs-stat").forEach((btn) =>
    btn.addEventListener("click", () => _setFilter(btn.dataset.filter)));
}

// Bấm lại ô đang lọc thì về "Tất cả".
function _setFilter(f) {
  _filter = f === _filter ? "all" : f;
  document.querySelectorAll(".gs-stat").forEach((b) =>
    b.setAttribute("aria-pressed", String(b.dataset.filter === _filter)));
  _page.groom = _page.bride = 1;
  _announce = true;
  _renderGuestList(_currentTab);
}

function resetGuestFilters() {
  const input = document.getElementById("gs-search");
  if (input) input.value = "";
  _query = "";
  _setFilter("all");
}

// Số trên ô thống kê (bên đang mở) + số khách trên hai tab.
function _syncStats() {
  const list = _allGuests[_currentTab];
  const n = {
    all: list.length,
    viewed: list.filter(_FILTERS.viewed).length,
    yes: list.filter(_FILTERS.yes).length,
    wishes: list.filter(_FILTERS.wishes).length,
  };
  document.querySelectorAll("[data-stat]").forEach((el) => {
    el.textContent = n[el.dataset.stat] ?? 0;
  });
  ["groom", "bride"].forEach((s) => {
    const el = document.getElementById(`tab-${s}-n`);
    if (el) el.textContent = _loaded[s] ? _allGuests[s].length : "";
  });
}

// ─── Add Single Guest ─────────────────────────────────────────────────────────

let _addGuestSide = "groom";

// Xưng hô đi vào link mời (thiếu là link không nhận ra khách) → mặc định "Bạn".
// Giá trị cũ không có trong danh sách vẫn hiện nguyên trên combobox.
const GUEST_RELATIONS = [
  "Bạn", "Anh", "Chị", "Em", "Anh chị", "Vợ chồng", "Cô", "Chú", "Bác", "Dì", "Cậu",
  "Mợ", "Thím", "Ông", "Bà", "Thầy", "Cô giáo", "Đồng nghiệp", "Sếp", "Họ hàng", "Gia đình",
];

function _relationBox(value) {
  const box = document.getElementById("add-guest-relationship");
  if (!box._cxFilled) {
    box.setOptions(GUEST_RELATIONS.map((v) => ({ value: v, label: v })));
    box._cxFilled = true;
    // Nối nhãn "Xưng hô" với nút của combobox (label for= không trỏ được vào nó).
    box.querySelector("button")?.setAttribute("aria-labelledby", "add-guest-rel-label");
  }
  box.value = value || GUEST_RELATIONS[0];
  return box;
}

// Popup dùng cho cả thêm lẫn sửa: _gmId = khách đang mở (null = chưa lưu lần nào).
// Đã lưu thì "Lưu" chỉ bật lại khi 3 ô khác bản đã lưu (_gmSnap), và sửa chính khách đó.
let _gmId = null;
let _gmSnap = "";
let _gmBusy = false;

function _gmValues() {
  return {
    full_name:    document.getElementById("add-guest-fullname").value.trim(),
    display_name: document.getElementById("add-guest-displayname").value.trim(),
    relationship: String(document.getElementById("add-guest-relationship").value || "").trim(),
  };
}

const _gmKey = (v) => JSON.stringify([v.full_name, v.display_name, v.relationship]);

// Thay icon lucide trong một ô chỉ khi tên đổi (tránh vẽ lại mỗi phím gõ).
function _gmIcon(el, name, size) {
  if (!el || el.dataset.ico === name) return;
  el.dataset.ico = name;
  el.innerHTML = `<i data-lucide="${name}" style="width:${size}px;height:${size}px"></i>`;
  window.lucide?.createIcons({ root: el });
}

const _GM_SIDE = {
  groom: { label: "Khách nhà trai", icon: "mars",  cls: ["bg-sky-50", "text-sky-700", "ring-sky-100"] },
  bride: { label: "Khách nhà gái",  icon: "venus", cls: ["bg-rose-50", "text-rose-700", "ring-rose-100"] },
};

function _gmSyncSide() {
  const chip = document.getElementById("add-guest-side");
  Object.values(_GM_SIDE).forEach((s) => chip.classList.remove(...s.cls));
  const s = _GM_SIDE[_addGuestSide] || _GM_SIDE.groom;
  chip.classList.add(...s.cls);
  chip.dataset.ico = "";
  _gmIcon(chip, s.icon, 12);
  chip.insertAdjacentText("beforeend", s.label);
}

function _gmSync() {
  const v = _gmValues();
  const saved = !!_gmId;
  const dirty = saved && _gmKey(v) !== _gmSnap;
  document.getElementById("add-guest-save").disabled = _gmBusy || (saved && !dirty);
  document.getElementById("add-guest-new").disabled  = _gmBusy || !saved;
  document.getElementById("add-guest-title").textContent = saved ? "Sửa khách mời" : "Thêm khách mời";
  _gmIcon(document.getElementById("add-guest-ico"), saved ? "user-check" : "user-plus", 20);

  document.getElementById("add-guest-pv-rel").textContent = v.relationship || "…";
  const pvName = document.getElementById("add-guest-pv-name");
  pvName.textContent = v.display_name || v.full_name || "Tên khách";
  pvName.classList.toggle("text-gray-800", !!(v.display_name || v.full_name));
  pvName.classList.toggle("text-gray-500", !(v.display_name || v.full_name));

  // Sửa sau khi lưu → link đang hiện là của bản cũ: làm mờ + nhắc bấm Lưu.
  const status = document.getElementById("add-guest-status");
  status.classList.toggle("text-emerald-600", !dirty);
  status.classList.toggle("text-amber-600", dirty);
  status.dataset.ico = "";
  _gmIcon(status, dirty ? "circle-alert" : "circle-check", 14);
  status.insertAdjacentHTML("beforeend",
    `<span>${dirty ? "Có thay đổi chưa lưu · bấm Lưu để cập nhật link" : "Đã lưu · link mời riêng của khách"}</span>`);
  document.getElementById("add-guest-link-row").classList.toggle("opacity-50", dirty);
}

function _gmShowLink(link) {
  document.getElementById("add-guest-result").classList.toggle("hidden", !link);
  document.getElementById("add-guest-link").value = link || "";
}

function _gmFill(guest) {
  _gmId = guest?.id || null;
  document.getElementById("add-guest-fullname").value    = guest?.full_name || "";
  document.getElementById("add-guest-displayname").value = guest?.display_name || "";
  _relationBox(guest?.relationship);
  _gmSnap = _gmId ? _gmKey(_gmValues()) : "";
  _gmShowLink(guest?.link);
  _gmSync();
}

function _gmOpen(guest, side) {
  _addGuestSide = side;
  const modal = document.getElementById("add-guest-modal");
  if (!modal._cxBound) {
    modal._cxBound = true;
    ["add-guest-fullname", "add-guest-displayname"].forEach((id) =>
      document.getElementById(id).addEventListener("input", _gmSync));
    document.getElementById("add-guest-fullname").addEventListener("input", () => _gmError(false));
    document.getElementById("add-guest-relationship").addEventListener("change", _gmSync);
  }
  _gmSyncSide();
  _gmFill(guest);
  _gmError(false);
  _modalShow(modal, document.getElementById("add-guest-fullname"));
}

// Lỗi "thiếu họ tên" hiện ngay dưới ô (aria-invalid + dòng chữ có icon).
function _gmError(on) {
  document.getElementById("add-guest-err")?.classList.toggle("hidden", !on);
  const input = document.getElementById("add-guest-fullname");
  if (on) input.setAttribute("aria-invalid", "true");
  else input.removeAttribute("aria-invalid");
}

// Có chữ đã gõ mà chưa lưu (khách mới) hoặc đã sửa khác bản đã lưu.
function _gmDirty() {
  const v = _gmValues();
  return _gmId ? _gmKey(v) !== _gmSnap : !!(v.full_name || v.display_name);
}

function openAddGuestModal(side) {
  _gmOpen(null, side);
}

function resetAddGuestForm() {
  _gmFill(null);
  document.getElementById("add-guest-fullname").focus();
}

// Đóng khi còn thay đổi chưa lưu thì hỏi lại — bấm nhầm nền mờ / Esc là mất chữ.
async function closeAddGuestModal(force) {
  const modal = document.getElementById("add-guest-modal");
  if (modal.classList.contains("hidden")) return;
  if (!force && !_gmBusy && _gmDirty()) {
    const ok = await showConfirm("Bỏ thông tin đang nhập?", "Khách này chưa được lưu, đóng lại là mất phần vừa gõ.", {
      type: "warning", confirmText: "Bỏ", cancelText: "Tiếp tục nhập",
    });
    if (!ok) return;
  }
  _modalHide(modal);
}

function copyAddGuestLink() {
  const link = document.getElementById("add-guest-link").value;
  if (link) copyGuestLink(link);
}

// Link mã hoá tên hiển thị + xưng hô → đổi một trong hai là phải dựng lại link.
function _guestLink(slug, side, g) {
  const encName = encryptData(g.display_name || g.full_name);
  const encRel  = encryptData(g.relationship || "");
  return `${window.location.origin}/${slug}?isGroom=${side === "groom"}&name=${encName}&relationship=${encRel}`;
}

async function saveAddGuest() {
  const v = _gmValues();
  if (!v.full_name) {
    _gmError(true);
    document.getElementById("add-guest-fullname").focus();
    return;
  }

  const isNew = !_gmId;
  const side = _addGuestSide;
  const label = document.querySelector("#add-guest-save span");
  _gmBusy = true;
  _gmSync();
  if (label) label.textContent = "Đang lưu...";
  try {
    if (isNew) {
      const row = await guestDAL.insertOneGuest(WEDDING_ID, side, v);
      _gmId = row.id;
    } else {
      await guestDAL.updateGuest(_gmId, v);
    }
    _gmSnap = _gmKey(v);

    const slug = await _getWeddingSlug();
    let link = "";
    if (slug) {
      link = _guestLink(slug, side, v);
      await guestDAL.updateGuestsBatchLinks([{ id: _gmId, link }]);
    } else {
      showToast("Không tìm thấy slug thiệp, không thể tạo link", "warning");
    }
    _gmShowLink(link);
    showToast(isNew ? "Đã thêm khách mời" : "Đã cập nhật khách mời", "success");
    loadGuestList(side);
  } catch (err) {
    showToast((isNew ? "" : "Cập nhật thất bại: ") + err.message, "error");
  } finally {
    _gmBusy = false;
    if (label) label.textContent = "Lưu";
    _gmSync();
  }
}

// ─── Export Excel ─────────────────────────────────────────────────────────────

function exportGuestList(side) {
  const guests = _allGuests[side];
  if (!guests || guests.length === 0) { showToast("Chưa có khách mời để xuất", "warning"); return; }

  const headers = ["Họ và tên", "Tên hiển thị", "Xưng hô", "Link cá nhân", "Đã xem", "Xác nhận", "Lời nhắn xác nhận", "Lời chúc"];
  const rows = guests.map(g => [
    g.full_name    || "",
    g.display_name || "",
    g.relationship || "",
    g.link         || "",
    g.viewed ? "Đã xem" : "Chưa xem",
    g.confirmed    || "",
    g.message      || "",
    // Nhiều lời chúc gộp vào một ô, ngăn bằng dòng trống cho dễ đọc trong Excel.
    _guestWishes(g).map(w => w.text).join("\n\n"),
  ]);

  const ws = _XLSX.utils.aoa_to_sheet([headers, ...rows]);

  const headerStyle = {
    font: { bold: true, color: { rgb: "374151" } },
    fill: { fgColor: { rgb: "E5E7EB" } },
    alignment: { horizontal: "center", vertical: "center" },
    border: {
      top: { style: "thin", color: { rgb: "D1D5DB" } },
      bottom: { style: "thin", color: { rgb: "D1D5DB" } },
      left: { style: "thin", color: { rgb: "D1D5DB" } },
      right: { style: "thin", color: { rgb: "D1D5DB" } },
    },
  };
  ["A1","B1","C1","D1","E1","F1","G1","H1"].forEach(ref => { if (ws[ref]) ws[ref].s = headerStyle; });

  ws["!cols"] = [{ wch: 22 }, { wch: 18 }, { wch: 10 }, { wch: 55 }, { wch: 12 }, { wch: 16 }, { wch: 30 }, { wch: 40 }];
  ws["!rows"] = [{ hpt: 22 }];

  const sideLabel = side === "groom" ? "nha-trai" : "nha-gai";
  const wb = _XLSX.utils.book_new();
  _XLSX.utils.book_append_sheet(wb, ws, "Khách mời");
  _XLSX.writeFile(wb, `danh-sach-khach-${sideLabel}.xlsx`, { cellStyles: true });
  showToast(`Đã xuất ${guests.length} khách mời`, "success");
}

// ─── Excel Import ──────────────────────────────────────────────────────────────

// Chỉ dựng link cho khách CHƯA có (link cũ giữ nguyên, khách đã nhận vẫn mở được).
async function regenerateLinks(side) {
  showLoading(true, "Đang tạo link...");
  try {
    const n = await _generateGuestLinks(side);
    if (n === 0) showToast("Khách nào cũng đã có link mời", "success");
    await loadGuestList(side);
  } catch (err) {
    showToast(err.message, "error");
  } finally {
    showLoading(false);
  }
}

function downloadGuestTemplate() {
  if (typeof XLSX === "undefined") { showToast("Đang tải thư viện, thử lại sau", "warning"); return; }
  guestBL.downloadTemplate();
}

async function handleExcelUpload(event, side) {
  const file = event.target.files[0];
  event.target.value = "";
  if (!file) return;
  try {
    const { headers, data } = await guestBL.parseExcel(file);
    _importState = { headers, data, side };
    _openMappingModal(headers, data);
  } catch (err) {
    showToast(err.message, "error");
  }
}

function _openMappingModal(headers, data) {
  const mapping = guestBL.autoDetectMapping(headers);
  const noOpt = `<option value="-1">— Không chọn —</option>`;
  const opts = headers.map((h, i) => `<option value="${i}">${escapeHtml(h) || "(Cột " + (i + 1) + ")"}</option>`).join("");

  document.getElementById("map-full-name").innerHTML = opts;
  document.getElementById("map-display-name").innerHTML = noOpt + opts;
  document.getElementById("map-relationship").innerHTML = noOpt + opts;
  document.getElementById("map-full-name").value = mapping.full_name;
  document.getElementById("map-display-name").value = mapping.display_name;
  document.getElementById("map-relationship").value = mapping.relationship;

  _renderMappingPreview(headers, data.slice(0, 4));
  document.getElementById("map-sub").textContent =
    `${data.length} dòng · nhập vào danh sách khách ${_SIDE_LABEL[_importState.side] || ""}`;
  document.querySelector("input[name='import-mode'][value='overwrite']").checked = true;

  _modalShow(document.getElementById("import-mapping-modal"), document.getElementById("map-full-name"));
}

function closeMappingModal() {
  _modalHide(document.getElementById("import-mapping-modal"));
}

function _renderMappingPreview(headers, rows) {
  const th = headers.map(h => `<th title="${escapeHtml(h)}">${escapeHtml(h)}</th>`).join("");
  const trs = rows.map(row =>
    `<tr>${headers.map((_, i) => `<td title="${escapeHtml(row[i] ?? "")}">${escapeHtml(row[i] ?? "")}</td>`).join("")}</tr>`
  ).join("");
  document.getElementById("mapping-preview").innerHTML = `
    <div class="gs-map-table">
      <table><thead><tr>${th}</tr></thead><tbody>${trs}</tbody></table>
    </div>
    <p class="gs-map-note">${rows.length} dòng đầu của file</p>`;
}

async function confirmImport() {
  const colMapping = {
    full_name:    parseInt(document.getElementById("map-full-name").value),
    display_name: parseInt(document.getElementById("map-display-name").value),
    relationship: parseInt(document.getElementById("map-relationship").value),
  };

  if (isNaN(colMapping.full_name) || colMapping.full_name < 0) {
    showToast("Vui lòng chọn cột Họ và tên", "warning");
    return;
  }

  const overwrite = document.querySelector("input[name='import-mode']:checked").value === "overwrite";
  const { data, side } = _importState;

  closeMappingModal();
  showLoading(true, "Đang nhập khách...");

  try {
    const result = await guestBL.importGuests(WEDDING_ID, side, data, colMapping, overwrite);
    const skipMsg = result.skipped > 0 ? `, bỏ qua ${result.skipped} trùng` : "";
    showToast(`Đã nhập ${result.inserted} khách${skipMsg}`, "success");
    await _generateGuestLinks(side);
    await loadGuestList(side);
  } catch (err) {
    showToast("Nhập khẩu thất bại: " + err.message, "error");
  } finally {
    showLoading(false);
  }
}

// ─── Link Generation ──────────────────────────────────────────────────────────

let _wedding = null;

async function _getWedding() {
  if (_wedding) return _wedding;
  _wedding = await guestDAL.getWedding(WEDDING_ID) || {};
  return _wedding;
}

async function _getWeddingSlug() {
  return (await _getWedding())?.slug || null;
}

// Trang cha (setup) gọi sau khi lưu để cập nhật câu mẫu chia sẻ ngay trong cache,
// khỏi phải reload iframe / F5 mới lấy được câu mới.
window.setShareTemplate = function (val) {
  if (!_wedding) _wedding = {};
  _wedding.share_message_template = val || "";
};

async function _generateGuestLinks(side) {
  try {
    const slug = await _getWeddingSlug();
    if (!slug) { showToast("Không tìm thấy slug thiệp, không thể tạo link", "warning"); return; }

    const guests = await guestDAL.getGuests(WEDDING_ID, side);
    const noLink = guests.filter(g => !g.link);
    if (!noLink.length) return 0;

    const updates = noLink.map(g => ({ id: g.id, link: _guestLink(slug, side, g) }));
    await guestDAL.updateGuestsBatchLinks(updates);

    showToast(`Đã tạo link cho ${noLink.length} khách`, "success");
    return noLink.length;
  } catch (err) {
    console.error("Generate links error:", err);
    showToast("Tạo link thất bại: " + err.message, "error");
  }
}

// ─── Guest List ────────────────────────────────────────────────────────────────
// Mỗi khách là MỘT hàng .gs-row: từ md là lưới cột thẳng hàng với .gs-head; dưới md
// thành thẻ hai tầng (tên + nút ở trên, nhãn trạng thái ở dưới). Style ở _setup.css.

const PAGE_SIZE = 20;
const _page = { groom: 1, bride: 1 };
const _allGuests = { groom: [], bride: [] };
// Bên đã tải xong lần nào chưa — chưa thì số trên tab để trống thay vì "0".
const _loaded = { groom: false, bride: false };

const _SIDE_LABEL = { groom: "nhà trai", bride: "nhà gái" };

const _GUEST_HEAD = `
  <div class="gs-head" aria-hidden="true">
    <span>Khách mời</span><span>Xưng hô</span><span>Xem thiệp</span>
    <span>Phản hồi</span><span>Lời chúc</span><span></span>
  </div>`;

// Khung xương lúc chờ API: cùng khổ hàng thật nên danh sách không nhảy.
function _renderGuestSkeleton(side) {
  const container = document.getElementById(`guest-list-${side}`);
  if (!container) return;
  const row = `
    <div class="gs-row">
      <div class="gs-who"><span class="gs-ava gs-sk"></span>
        <span class="gs-who-txt"><span class="gs-sk h-3 w-32"></span><span class="gs-sk mt-2 h-3 w-20"></span></span>
      </div>
      <div class="gs-meta"><span class="gs-sk h-3 w-12"></span><span class="gs-sk h-6 w-20"></span><span class="gs-sk h-6 w-20"></span></div>
    </div>`;
  container.innerHTML = `<div class="gs-list animate-pulse" aria-hidden="true">${_GUEST_HEAD}${row.repeat(4)}</div>`;
}

async function loadGuestList(side) {
  if (!WEDDING_ID) return;
  _renderGuestSkeleton(side);
  try {
    const guests = await guestDAL.getGuests(WEDDING_ID, side);
    _allGuests[side] = guests;
    _loaded[side] = true;
    _page[side] = 1;
    _renderGuestList(side);
  } catch (err) {
    console.error("loadGuestList error:", err);
    const container = document.getElementById(`guest-list-${side}`);
    if (container) {
      container.innerHTML = _emptyHTML("triangle-alert", "Không tải được danh sách khách",
        "Kiểm tra kết nối mạng rồi thử lại.",
        `<x-button variant="outline" tone="neutral" onclick="loadGuestList('${side}')">${_ico("refresh-cw")}<span>Thử lại</span></x-button>`);
      lucide.createIcons({ root: container });
    }
  }
}

function goToPage(side, page) {
  _page[side] = page;
  _renderGuestList(side);
  document.getElementById(`guest-list-${side}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

// _esc: dùng escapeHtml() chung từ core/utils.js (nạp trước file này).

function _buildPageBtns(side, cur, total) {
  const pages = [];
  if (total <= 7) {
    for (let i = 1; i <= total; i++) pages.push(i);
  } else {
    pages.push(1);
    if (cur > 3) pages.push("...");
    for (let i = Math.max(2, cur - 1); i <= Math.min(total - 1, cur + 1); i++) pages.push(i);
    if (cur < total - 2) pages.push("...");
    pages.push(total);
  }
  const dot = `<span class="gs-page-dot" aria-hidden="true">…</span>`;
  return pages.map(p => p === "..." ? dot : `
    <x-button variant="${p === cur ? "soft" : "ghost"}" tone="${p === cur ? "brand" : "neutral"}"
      size="sm" icon-only type="button" onclick="goToPage('${side}', ${p})"
      aria-label="Trang ${p}" ${p === cur ? 'aria-current="page"' : ""}>
      ${p}
    </x-button>`).join("");
}

function _emptyHTML(icon, title, desc, actions = "") {
  return `
    <div class="gs-empty">
      <span class="gs-empty-ico">${_ico(icon, 24)}</span>
      <p class="gs-empty-title">${title}</p>
      <p class="gs-empty-desc">${desc}</p>
      ${actions ? `<div class="gs-empty-acts">${actions}</div>` : ""}
    </div>`;
}

// Chữ cái đầu của TÊN (từ cuối họ tên kiểu Việt) cho ô avatar.
function _initial(g) {
  const parts = String(g.full_name || "").trim().split(/\s+/);
  return (parts[parts.length - 1] || "?").charAt(0).toUpperCase();
}

// Nhãn trạng thái: luôn icon + chữ, không chỉ dựa vào màu.
function _viewChip(g) {
  return g.viewed
    ? `<span class="gs-chip gs-chip--info">${_ico("eye", 14)}Đã xem</span>`
    : `<span class="gs-chip gs-chip--muted">${_ico("eye-off", 14)}Chưa xem</span>`;
}

function _rsvpChip(g) {
  if (!g.confirmed) return `<span class="gs-chip gs-chip--muted gs-chip--wait">${_ico("clock", 14)}Chưa phản hồi</span>`;
  return _isAttending(g)
    ? `<span class="gs-chip gs-chip--ok">${_ico("circle-check", 14)}Tham dự</span>`
    : `<span class="gs-chip gs-chip--no">${_ico("circle-x", 14)}Không đến</span>`;
}

function _wishCell(g, side) {
  const n = _guestNoteCount(g);
  if (!n) return `<span class="gs-dash" aria-hidden="true">—</span>`;
  return `<x-button variant="bare" type="button" class="gs-chip gs-chip--wish" data-guest-id="${escapeHtml(g.id)}"
      data-side="${side}" data-action="wishes" aria-label="Xem ${n} lời chúc">${_ico("message-square-heart", 14)}${n}</x-button>`;
}

function _rowHTML(g, side) {
  const id = escapeHtml(g.id);
  const sub = g.display_name && g.display_name !== g.full_name
    ? `<span class="gs-sub">Trên thiệp: ${escapeHtml(g.display_name)}</span>` : "";
  const link = g.link ? escapeHtml(g.link) : "";
  return `
    <div class="gs-row">
      <button type="button" class="gs-who" data-action="edit" data-guest-id="${id}" data-side="${side}"
        title="${escapeHtml(g.full_name)} — bấm để sửa" aria-label="${escapeHtml(g.full_name)}, sửa thông tin">
        <span class="gs-ava gs-ava--${side}" aria-hidden="true">${escapeHtml(_initial(g))}</span>
        <span class="gs-who-txt"><span class="gs-name">${escapeHtml(g.full_name)}</span>${sub}</span>
      </button>
      <div class="gs-meta">
        ${g.relationship
          ? `<span class="gs-rel">${escapeHtml(g.relationship)}</span>`
          : `<span class="gs-rel gs-rel--none"><span class="gs-dash" aria-hidden="true">—</span></span>`}
        <span class="gs-cell">${_viewChip(g)}</span>
        <span class="gs-cell">${_rsvpChip(g)}</span>
        <span class="gs-cell gs-cell-wish">${_wishCell(g, side)}</span>
      </div>
      <div class="gs-acts">
        ${link ? `
        <x-button variant="ghost" tone="neutral" icon-only type="button" class="gs-act gs-act-copy" data-link="${link}"
          data-action="copy" title="Sao chép link mời" aria-label="Sao chép link mời">${_ico("copy")}</x-button>
        <x-button variant="ghost" tone="brand" icon-only type="button" class="gs-act" data-guest-id="${id}" data-side="${side}"
          data-action="share" title="Gửi link mời" aria-label="Gửi link mời">${_ico("send")}</x-button>` : ""}
        <x-button variant="ghost" tone="neutral" icon-only type="button" class="gs-act" data-guest-id="${id}" data-side="${side}"
          data-action="menu" title="Thao tác khác" aria-label="Thao tác khác" aria-haspopup="menu">${_ico("ellipsis-vertical")}</x-button>
      </div>
    </div>`;
}

function _renderGuestList(side) {
  _syncStats();
  const container = document.getElementById(`guest-list-${side}`);
  if (!container) return;

  const all = _allGuests[side];
  if (all.length === 0) {
    container.innerHTML = _emptyHTML(
      "users",
      `Chưa có khách ${_SIDE_LABEL[side]}`,
      "Thêm từng người hoặc nhập cả danh sách từ Excel. Mỗi khách nhận một link mời gọi đúng tên.",
      `<x-button onclick="openAddGuestModal('${side}')">${_ico("user-plus")}<span>Thêm khách</span></x-button>
       <x-button variant="outline" tone="neutral" onclick="pickExcel()">${_ICO_EXCEL}<span>Nhập Excel</span></x-button>`,
    ) + `<p class="gs-empty-note">Chưa có file? <button type="button" class="gs-link" onclick="downloadGuestTemplate()">Tải file Excel mẫu</button></p>`;
    lucide.createIcons({ root: container });
    return;
  }

  const guests = _visibleGuests(side);
  if (guests.length === 0) {
    _announceCount(side, 0);
    container.innerHTML = _emptyHTML(
      "search-x",
      "Không có khách phù hợp",
      _query ? `Không tìm thấy khách nào tên “${escapeHtml(_query.trim())}” trong bộ lọc này.` : "Chưa có khách nào ở trạng thái này.",
      `<x-button variant="outline" tone="neutral" onclick="resetGuestFilters()">${_ico("rotate-ccw")}<span>Xem tất cả khách</span></x-button>`,
    );
    lucide.createIcons({ root: container });
    return;
  }

  const totalPages = Math.ceil(guests.length / PAGE_SIZE);
  const cur = Math.min(_page[side], totalPages);
  const pageGuests = guests.slice((cur - 1) * PAGE_SIZE, cur * PAGE_SIZE);
  const from = (cur - 1) * PAGE_SIZE + 1;
  const to   = Math.min(cur * PAGE_SIZE, guests.length);
  const filtered = guests.length !== all.length;

  const pager = `
    <div class="gs-pager">
      <p class="gs-pager-txt">${totalPages > 1 ? `${from}–${to} / ` : ""}<strong>${guests.length}</strong> khách${filtered ? ` (lọc từ ${all.length})` : ""}</p>
      ${totalPages > 1 ? `
      <div class="flex items-center gap-1">
        <x-button variant="ghost" tone="neutral" size="sm" icon-only type="button" onclick="goToPage('${side}', ${cur - 1})"
          aria-label="Trang trước" ${cur === 1 ? "disabled" : ""}>${_ico("chevron-left")}</x-button>
        <span class="gs-pages">${_buildPageBtns(side, cur, totalPages)}</span>
        <span class="gs-page-now">Trang ${cur}/${totalPages}</span>
        <x-button variant="ghost" tone="neutral" size="sm" icon-only type="button" onclick="goToPage('${side}', ${cur + 1})"
          aria-label="Trang sau" ${cur === totalPages ? "disabled" : ""}>${_ico("chevron-right")}</x-button>
      </div>` : ""}
    </div>`;

  _announceCount(side, guests.length);
  container.innerHTML = `
    <div class="gs-list">${_GUEST_HEAD}${pageGuests.map((g) => _rowHTML(g, side)).join("")}</div>
    ${pager}`;

  lucide.createIcons({ root: container });
}

function _announceCount(side, n) {
  if (!_announce || side !== _currentTab) return;
  _announce = false;
  const live = document.getElementById("gs-live");
  if (live) live.textContent = n ? `Có ${n} khách phù hợp` : "Không có khách phù hợp";
}

function copyGuestLink(link) {
  navigator.clipboard.writeText(link).then(() => showToast("Đã sao chép link mời", "success"));
}

function _findGuest(guestId, side) {
  return _allGuests[side]?.find((g) => g.id === guestId);
}

// ─── Share (chia sẻ link 1 khách) ─────────────────────────────────────────────
// Popup + logic chia sẻ nằm ở core/share-social.js (dùng chung nhiều nơi).

function _openShareModal(guestId, side) {
  const guest = _findGuest(guestId, side);
  if (!guest || !guest.link) { showToast("Khách này chưa có link", "warning"); return; }

  const name = guest.display_name || guest.full_name || "";
  const tpl = _wedding?.share_message_template;
  // Có câu mẫu → trộn thông tin khách; không có → dùng câu mặc định của ShareSocial
  const message = tpl
    ? ShareSocial.renderTemplate(tpl, {
        relationship: guest.relationship || "Bạn",
        "danh xưng": name, // câu mẫu cũ còn biến này
        link: guest.link,
      })
    : undefined;

  ShareSocial.open({
    link: guest.link,
    subtitle: name,
    message,
  });
}

// ─── Row Menu (⋯ cuối hàng) ───────────────────────────────────────────────────

function _openRowMenu(triggerEl, guestId, side) {
  const pop = document.getElementById("gs-row-pop");
  const guest = _findGuest(guestId, side);
  if (!guest) return;
  // Bấm lại đúng nút đang mở menu thì đóng.
  if (pop.isOpen && pop._anchorEl === triggerEl) { pop.close(); return; }

  const items = [];
  if (guest.link) {
    items.push(
      { icon: _popIco("copy", "gs-tone-blue"), label: "Sao chép link mời", onClick: () => copyGuestLink(guest.link) },
      { icon: _popIco("external-link", "gs-tone-violet"), label: "Xem thiệp của khách", onClick: () => window.open(guest.link, "_blank", "noopener") },
    );
  }
  if (_guestNoteCount(guest)) {
    items.push({ icon: _popIco("message-square-heart", "gs-tone-pink"), label: "Xem lời chúc", onClick: () => _openWishesModal(guest.id, side) });
  }
  items.push(
    { icon: _popIco("pencil", "gs-tone-amber"), label: "Sửa thông tin", onClick: () => _openEditGuest(guest, side) },
    { sep: true },
    { id: "gs-row-pop-del", icon: _ico("trash-2"), label: "Xoá khách", onClick: () => _deleteGuest(guest, side) },
  );
  pop.setItems(items);
  document.getElementById("gs-row-pop-del")?.classList.add("mi-pop-danger");
  lucide.createIcons({ root: pop });
  pop.open(triggerEl);
}

// ─── Lời chúc của khách ───────────────────────────────────────────────────────
// Khách gửi lời chúc trên thiệp (guests.wishes) — gửi rồi không tự sửa/xoá được,
// chỉ chủ thiệp xoá ở đây. Gộp luôn lời nhắn kèm xác nhận tham dự (guests.message)
// vì với chủ thiệp cả hai đều là "khách nói gì".

function _guestWishes(g) {
  return Array.isArray(g?.wishes) ? g.wishes.filter(w => w && w.text) : [];
}

/** Số việc khách đã viết = lời chúc + lời nhắn kèm RSVP (nếu có). */
function _guestNoteCount(g) {
  return _guestWishes(g).length + (g?.message ? 1 : 0);
}

function _fmtWishTime(at) {
  if (!at) return "";
  const d = new Date(at);
  return isNaN(d) ? "" : d.toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" });
}

function _openWishesModal(guestId, side) {
  const guest = _findGuest(guestId, side);
  if (!guest) return;

  document.getElementById("wishes-modal")?.remove();

  const modal = document.createElement("div");
  modal.id = "wishes-modal";
  modal.className = "gs-modal";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-labelledby", "wishes-modal-title");
  modal.innerHTML = `
    <div class="gs-sheet sm:max-w-[440px]">
      <div class="gs-sheet-head">
        <span class="gs-sheet-ico">${_ico("message-square-heart", 20)}</span>
        <div class="flex-1 min-w-0">
          <h2 id="wishes-modal-title" class="gs-sheet-title">Lời chúc của khách</h2>
          <p class="gs-sheet-sub truncate">${escapeHtml(guest.display_name || guest.full_name)}</p>
        </div>
        <x-button variant="ghost" tone="neutral" icon-only type="button" id="wishes-modal-close" aria-label="Đóng" class="-mr-2 -mt-1">
          ${_ico("x", 18)}
        </x-button>
      </div>
      <div id="wishes-modal-body" class="flex-1 min-h-0 overflow-y-auto px-5 pb-5 space-y-3"></div>
    </div>`;
  modal._cxOpener = document.activeElement;
  document.body.appendChild(modal);
  lucide.createIcons({ root: modal });

  modal.addEventListener("click", (e) => { if (e.target === modal) _closeWishesModal(); });
  const close = document.getElementById("wishes-modal-close");
  close.onclick = _closeWishesModal;
  setTimeout(() => close.focus(), 50);

  _renderWishesModalBody(guest, side);
}

function _closeWishesModal() {
  const modal = document.getElementById("wishes-modal");
  if (!modal) return;
  const opener = modal._cxOpener;
  modal.remove();
  if (opener && document.contains(opener)) opener.focus();
}

function _renderWishesModalBody(guest, side) {
  const body = document.getElementById("wishes-modal-body");
  if (!body) return;

  const rsvpNote = guest.message
    ? `<div class="gs-wish gs-wish--rsvp">
         <p class="gs-wish-cap">${_ico("calendar-check", 14)}Lời nhắn kèm xác nhận tham dự</p>
         <p class="gs-wish-text">${escapeHtml(guest.message)}</p>
       </div>`
    : "";

  const wishes = _guestWishes(guest);
  const items = wishes.map(w => `
    <div class="gs-wish">
      <div class="flex items-start gap-2">
        <p class="gs-wish-text flex-1">${escapeHtml(w.text)}</p>
        <x-button variant="ghost" tone="danger" size="sm" icon-only type="button" class="-mr-1 -mt-1"
          data-wish-id="${escapeHtml(w.id)}" title="Xoá lời chúc này" aria-label="Xoá lời chúc này">
          ${_ico("trash-2", 14)}
        </x-button>
      </div>
      <p class="gs-wish-time">${escapeHtml(_fmtWishTime(w.at))}</p>
    </div>`).join("");

  body.innerHTML =
    rsvpNote +
    (items || `<p class="text-sm text-gray-500 text-center py-6">Khách chưa gửi lời chúc nào.</p>`);

  // lucide không tự quét lại phần chèn động.
  lucide.createIcons({ root: body });

  body.querySelectorAll("[data-wish-id]").forEach(btn => {
    btn.onclick = () => _deleteWish(guest, side, btn.dataset.wishId);
  });
}

async function _deleteWish(guest, side, wishId) {
  const ok = await showConfirm("Xoá lời chúc này?", "Lời chúc sẽ biến mất khỏi thiệp và không khôi phục được.", {
    type: "error", icon: "trash-2", confirmText: "Xoá", cancelText: "Giữ lại",
  });
  if (!ok) return;

  try {
    const res = await guestDAL.deleteWish(guest.id, wishId);
    // Cập nhật bản ghi trong bộ nhớ theo danh sách server trả về, rồi vẽ lại cả
    // modal lẫn danh sách (số lời chúc nằm ở cột "Lời chúc").
    guest.wishes = res?.wishes ?? _guestWishes(guest).filter(w => w.id !== wishId);
    _renderWishesModalBody(guest, side);
    _renderGuestList(side);
    showToast("Đã xoá lời chúc", "success");
  } catch (err) {
    showToast("Xoá thất bại: " + err.message, "error");
  }
}

// ─── Edit Guest ───────────────────────────────────────────────────────────────

// Sửa dùng chung popup Thêm khách (xem _gmOpen) — mở sẵn khách đó ở trạng thái đã lưu.
function _openEditGuest(guest, side) {
  if (guest) _gmOpen(guest, side);
}

// ─── Delete Guest ─────────────────────────────────────────────────────────────

async function _deleteGuest(guest, side) {
  const ok = await showConfirm(`Xoá khách “${guest.full_name}”?`,
    "Link mời riêng của khách này sẽ không còn gọi đúng tên nữa. Không hoàn tác được.", {
      type: "error", icon: "trash-2", confirmText: "Xoá khách", cancelText: "Giữ lại",
    });
  if (!ok) return;
  showLoading(true, "Đang xoá...");
  try {
    await guestDAL.deleteGuestsByIds([guest.id]);
    showToast("Đã xoá khách mời", "success");
    await loadGuestList(side);
  } catch (err) {
    showToast("Xoá thất bại: " + err.message, "error");
  } finally {
    showLoading(false);
  }
}
