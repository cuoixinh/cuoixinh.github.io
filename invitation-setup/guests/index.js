const WEDDING_ID = new URLSearchParams(window.location.search).get("id");
// ?from=list: mở từ màn "Khách mời" (/guest-list/) — nút quay lại về đó thay vì
// trang Thiết lập. ?from=tab: màn đó tự chuyển thẳng tới đây (chỉ có một thiệp) nên
// quay lại là lùi lịch sử. Chỉ nhận đúng hai giá trị này, không nhận URL tuỳ ý.
const FROM = new URLSearchParams(window.location.search).get("from");
const FROM_LIST = FROM === "list";
const FROM_TAB = FROM === "tab";

let _importState = { headers: [], data: [], side: "" };
let _currentTab = "groom";

// ─── Init ─────────────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", async () => {
  // Đứng TRƯỚC lucide: CDN icon lỗi là dòng dưới ném, nút quay lại kẹt ở nhãn cũ.
  if (FROM_LIST || FROM_TAB) {
    const label = FROM_LIST ? "Chọn thiệp khác" : "Quay lại";
    const back = document.getElementById("gs-back");
    back?.setAttribute("title", label);
    back?.setAttribute("aria-label", label);
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
  if (action === "edit" && guestId) {
    e.stopPropagation();
    if (_sel.side === side) _selToggle(guestId);
    else _openEditGuest(_findGuest(guestId, side), side);
  }
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
  [["add-guest-modal", () => closeAddGuestModal()], ["import-mapping-modal", () => closeMappingModal()],
   ["ai-import-modal", () => closeAiImport()]]
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
  // Menu nút "+" đang mở thì Esc chỉ đóng menu.
  const attach = document.getElementById("ai-attach-pop");
  if (attach?.isOpen) { attach.close(); return; }
  const relPop = document.getElementById("ai-rel-pop");
  if (relPop?.isOpen) { relPop.close(); return; }
  if (!document.getElementById("ai-import-modal").classList.contains("hidden")) { closeAiImport(); return; }
  if (!document.getElementById("add-guest-modal").classList.contains("hidden")) { closeAddGuestModal(); return; }
  if (_sel.side) exitGuestSelect();
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
  // Mở thẳng link (không có trang trước) thì về danh sách thiệp thay vì đứng yên.
  if (FROM_TAB) {
    if (history.length > 1) history.back();
    else window.location.href = "/my-invitations/";
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
  if (_sel.side && _sel.side !== side) exitGuestSelect();
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

// Menu "⋯": các việc phụ, đều nhắm vào bên đang mở. Hai việc chính (Nhập từ Excel,
// Thêm khách) đứng ngoài thanh công cụ.
function _initMoreMenu() {
  const pop = document.getElementById("gs-more-pop");
  pop.setItems([
    { icon: `<span class="gs-pop-ico gs-tone-ai">${cxIcon("xuxi", 22)}</span>`, label: "Nhập bằng AI", onClick: openAiImport },
    { sep: true },
    { icon: _popIco("file-down", "gs-tone-blue"), label: "Xuất danh sách Excel", onClick: () => exportGuestList(_currentTab) },
    { icon: _popIco("download", "gs-tone-amber"), label: "Tải file Excel mẫu", onClick: downloadGuestTemplate },
    { sep: true },
    { icon: _popIco("link", "gs-tone-violet"), label: "Tạo link cho khách thiếu", onClick: () => regenerateLinks(_currentTab) },
    { sep: true },
    { icon: _popIco("list-checks", "gs-tone-red"), label: "Chọn nhiều để xoá", onClick: () => enterGuestSelect(_currentTab) },
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
  // Bên đang mở chưa có khách: ẩn cả thanh công cụ (chưa có gì để tìm, màn trống đã
  // có đủ ba cách thêm khách). Chỉ ẩn khi đã tải xong (đang tải/lỗi vẫn giữ).
  const bar = document.querySelector(".gs-toolbar");
  bar?.classList.toggle("is-empty", _loaded[_currentTab] && !list.length);
  _syncSelBar();
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
  guestBL.downloadTemplate(GUEST_RELATIONS);
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

// ─── Nhập bằng AI ─────────────────────────────────────────────────────────────
// Dán văn bản tự do → ai-invitation (mode=guests) tách thành từng khách → người
// dùng sửa/xoá ở bước xem lại → ghi vào ĐÚNG bên của tab đang mở qua guest-handler
// (kiểu "thêm vào"). Văn bản có chia nhóm "Nhà trai:/Nhà gái:" thì khách nhóm bên kia
// hiện mờ và bị bỏ qua (bấm nhãn để nhập vào bên này). Trạng thái hàng (bên kia, trùng, hết chỗ) do
// guestBL.planAiImport tính theo đúng luật server; server vẫn kiểm trần lúc ghi.

const AI_GUEST_MAX_CHARS = CONFIG.guestImport.aiMaxChars;

// side: bên của tab lúc bấm nút — cả lượt nhập chỉ ghi vào bên này. files: các tệp
// đang đính kèm (≤ aiMaxFiles): ảnh/PDF {kind, mime, data base64, name, size, url} gửi
// thẳng cho AI; Word/Excel/.txt {kind:"doc", fmt, text, name, size, lines} đã đọc ra chữ,
// gửi ngầm (KHÔNG đổ vào ô dán). Chữ trong ô là khách bổ sung / lời dặn, không bắt buộc. fromFile: kết quả đang xem đọc từ tệp (nhắc kiểm tra kỹ tên, dấu).
// abort: AbortController của lượt phân tích đang chạy (null = không chạy).
const _ai = { rows: [], side: "groom", busy: false, plan: null, files: [], fromFile: false, abort: null, filter: "" };

// mammoth.js (đọc chữ trong .docx) chỉ nạp khi người dùng chọn file Word.
const AI_MAMMOTH = {
  src: "https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.8.0/mammoth.browser.min.js",
  sri: "sha512-wuWo/cLB9W5BsZeyTYLuiTwr+FDlvjQC7C6atr+To7Jk92XHWI7WsImJZiruw7C9bnc8Zg7N0ncQI2Q/B4PQYw==",
};

// Trạng thái từng hàng ở bước xem lại: biểu tượng ở ô đầu hàng + nhãn ở dải đếm phía
// trên (thứ tự khai = thứ tự chip). Thẻ "other" có thêm nút nhập vào bên đang mở.
const _AI_ST = {
  ok:    { icon: "check",        label: "Sẽ nhập" },
  empty: { icon: "pencil-line",  label: "Thiếu tên", tip: "Nhập họ và tên để nhập khách này" },
  other: { icon: "arrow-left-right", label: "" },
  dup:   { icon: "copy",         label: "Đã có", tip: "Trùng Họ tên, Tên trên thiệp và Xưng hô với một khách đã có, sẽ bỏ qua" },
  over:  { icon: "ban",          label: "Hết chỗ" },
};

function _aiEl(id) { return document.getElementById(id); }

const _aiOtherSide = () => (_ai.side === "groom" ? "bride" : "groom");

function _aiFlag(st) {
  const me = _SIDE_LABEL[_ai.side];
  const base = _AI_ST[st] || _AI_ST.ok;
  if (st === "other") {
    const o = _SIDE_LABEL[_aiOtherSide()];
    return { ...base, label: `Thuộc ${o}`, action: true,
      tip: `XuXi xếp khách này vào nhóm ${o}` };
  }
  if (st === "over") return { ...base, tip: `Danh sách ${me} đã đủ ${_maxPerSide()} khách, khách này sẽ không được nhập` };
  if (st === "ok") return { ...base, tip: `Sẽ nhập vào ${me}` };
  return base;
}

function openAiImport() {
  if (!WEDDING_ID) { showToast("Không tìm thấy ID thiệp", "warning"); return; }
  // Chưa có danh sách thì không biết còn bao nhiêu chỗ và khách nào đã có.
  if (!_loaded[_currentTab]) {
    showToast(`Chưa tải xong danh sách khách ${_SIDE_LABEL[_currentTab]}, thử lại sau giây lát`, "warning");
    return;
  }
  // Mỗi lần mở là một lượt mới: không giữ chữ, tệp, kết quả của lần trước.
  _ai.rows = [];
  _ai.filter = "";
  _aiSetText("");
  _aiDetach();
  _aiError("");
  _ai.side = _currentTab;
  _aiShowStage("paste");
  _aiSyncCount();
  _aiRenderCap(_aiEl("ai-cap-now"), null);
  const { aiMaxFiles, aiFileMaxMB, aiFilesMaxMB } = CONFIG.guestImport;
  _aiEl("ai-formats-max").textContent = `Tối đa ${aiMaxFiles} tệp mỗi lượt`;
  _aiEl("ai-formats-size").textContent = `Ảnh/PDF tối đa ${aiFileMaxMB}MB/tệp, tổng ${aiFilesMaxMB}MB`;
  _modalShow(_aiEl("ai-import-modal"), _aiEl("ai-text"));
}

// Đóng popup giữa lúc XuXi đang đọc = huỷ lượt đó luôn, không chạy ngầm.
function closeAiImport() {
  if (_ai.abort) aiCancelParse();
  else if (_ai.busy) return;
  _modalHide(_aiEl("ai-import-modal"));
}

// Nút Huỷ ở chân popup: đang đọc thì dừng lượt đó và quay về ô dán, không thì đóng.
function aiCancelOrClose() {
  if (_ai.abort) aiCancelParse();
  else closeAiImport();
}

// Huỷ lượt phân tích đang chạy, về ô dán (giữ nguyên chữ và tệp đã chọn).
function aiCancelParse() {
  const ctrl = _ai.abort;
  if (!ctrl) return;
  _ai.abort = null;
  ctrl.abort();
  _aiSetBusy(false);
  _aiShowStage("paste");
}

// Nút cạnh nút chính: "Huỷ" ở ô dán và lúc XuXi đang đọc (dừng lượt đó), "Đóng" ở bước xem lại.
function _aiSyncCancel() {
  const review = !_aiEl("ai-review").classList.contains("hidden");
  _aiEl("ai-cancel").textContent = review && !_ai.busy ? "Đóng" : "Huỷ";
}

function aiBackToPaste() {
  if (_ai.busy) return;
  _aiShowStage("paste");
  _aiEl("ai-text").focus();
}

// Hai bước dùng chung một vỏ: đổi phần thân + nút ở chân popup.
function _aiShowStage(stage) {
  const review = stage === "review";
  _aiEl("ai-paste").classList.toggle("hidden", review);
  _aiEl("ai-review").classList.toggle("hidden", !review);
  _aiSyncCancel();
  _aiEl("ai-go").classList.toggle("hidden", review);
  // Lúc XuXi đang đọc chưa có gì để nhập — chân popup chỉ còn nút Huỷ.
  _aiEl("ai-save").classList.toggle("hidden", !review || _ai.busy);
  _aiEl("ai-title").textContent = review
    ? `Kiểm tra khách ${_SIDE_LABEL[_ai.side]} trước khi nhập`
    : `Nhập khách ${_SIDE_LABEL[_ai.side]} bằng AI`;
  _aiEl("ai-sub").textContent = review
    ? "Sửa trực tiếp trên từng dòng nếu cần"
    : "XuXi tách tên và xưng hô giúp bạn";
}

function _aiSyncCount() {
  const ta = _aiEl("ai-text");
  const n = ta.value.length;
  const over = n > AI_GUEST_MAX_CHARS;
  const count = _aiEl("ai-count");
  count.textContent = `${n.toLocaleString("vi-VN")} / ${AI_GUEST_MAX_CHARS.toLocaleString("vi-VN")} ký tự`;
  count.classList.toggle("is-over", over);
  _aiSyncGo();
  if (over) _aiError(`Danh sách dài quá ${AI_GUEST_MAX_CHARS.toLocaleString("vi-VN")} ký tự. Hãy chia làm nhiều lần nhập.`);
  else _aiError("");
}

function _aiError(msg) {
  const err = _aiEl("ai-err");
  _aiEl("ai-err-txt").textContent = msg;
  err.classList.toggle("hidden", !msg);
  _aiEl("ai-text").setAttribute("aria-invalid", msg ? "true" : "false");
}

// "Phân tích danh sách" chỉ bấm được khi đã có chữ hoặc tệp (và không đang chạy).
function _aiSyncGo() {
  const empty = !_ai.files.length && !_aiEl("ai-text").value.trim();
  _aiEl("ai-go").disabled = _ai.busy || empty;
}

function _aiSetBusy(busy) {
  _ai.busy = busy;
  const go = _aiEl("ai-go");
  _aiSyncGo();
  go.dataset.loading = busy ? "1" : "";
  go.querySelector("span").textContent = busy ? "XuXi đang đọc…" : "Phân tích danh sách";
  _aiSyncCancel();
  _aiEl("ai-save").classList.toggle("hidden", busy || _aiEl("ai-review").classList.contains("hidden"));
  _aiEl("ai-text").readOnly = busy;
  _aiEl("ai-plus").disabled = busy;
  if (busy) _aiEl("ai-attach-pop")?.close?.();
}

// ── Tệp: chọn / chụp / kéo thả / dán ảnh ──────────────────────────────────────

// Menu nút "+": Camera chỉ có trên máy cảm ứng (điện thoại, iPad) — ở máy tính
// capture không mở được camera mà chỉ ra hộp chọn tệp, trùng với "Ảnh".
function toggleAiAttachMenu() {
  if (_ai.busy) return;
  const pop = _aiEl("ai-attach-pop");
  if (!pop.isOpen) {
    const pick = (id) => () => _aiEl(id).click();
    pop.setItems([
      ...(matchMedia("(pointer: coarse)").matches
        ? [{ icon: _popIco("camera", "gs-tone-pink"), label: "Camera", onClick: pick("ai-cam") }] : []),
      { icon: _popIco("image", "gs-tone-green"), label: "Ảnh", onClick: pick("ai-photo") },
      { icon: _popIco("paperclip", "gs-tone-blue"), label: "Tệp", onClick: pick("ai-file") },
    ]);
    lucide.createIcons({ root: pop });
  }
  pop.toggle(_aiEl("ai-plus"));
}

const _aiExt = (name) => (String(name).toLowerCase().match(/\.([a-z0-9]+)$/) || [])[1] || "";
const _aiSize = (b) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

// Nhiều tệp một lúc (chọn nhiều, kéo thả, dán): xử lý lần lượt, dừng ở lỗi đầu tiên.
async function _aiHandleFiles(list) {
  if (_ai.busy) return;
  _aiError("");
  for (const f of Array.from(list || [])) {
    if (!(await _aiHandleFile(f))) break;
  }
}

// Một tệp bất kỳ → tệp đính kèm: ảnh/PDF gửi AI đọc, Word/Excel/.txt đọc ra chữ. Trả false khi lỗi.
async function _aiHandleFile(file) {
  if (!file || _ai.busy) return false;
  const ext = _aiExt(file.name);
  const type = file.type || "";
  try {
    const src = CONFIG.guestImport.aiSourceMaxMB;
    if (file.size > src * 1048576) throw new Error(`Tệp “${file.name}” lớn hơn ${src}MB, hãy chọn tệp nhỏ hơn.`);
    if (type.startsWith("image/") || ["jpg", "jpeg", "png", "webp", "heic", "heif"].includes(ext)) {
      _aiCheckRoom(0);
      const img = await _aiImageToJpeg(file);
      // Kích thước thật chỉ biết sau khi nén — kiểm lại cả trần từng tệp lẫn tổng.
      try {
        _aiCheckFile(img.size, file.name);
        _aiCheckRoom(img.size);
      } catch (e) {
        URL.revokeObjectURL(img.url);
        throw e;
      }
      _aiAttach(img, file.name);
    } else if (type === "application/pdf" || ext === "pdf") {
      _aiCheckFile(file.size, file.name);
      _aiCheckRoom(file.size);
      const pages = await _aiPdfPages(file);
      _aiAttach({ kind: "pdf", mime: "application/pdf", data: await _aiBase64(file), size: file.size, pages }, file.name);
    } else if (ext === "docx") {
      await _aiLoadMammoth();
      const { value } = await window.mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
      _aiAddDoc(value, "Word", file);
    } else if (ext === "doc") {
      throw new Error("File Word đời cũ (.doc) chưa đọc được. Hãy lưu lại dạng .docx hoặc PDF rồi chọn lại.");
    } else if (ext === "xlsx" || ext === "xls") {
      const wb = _XLSX.read(await file.arrayBuffer(), { type: "array" });
      _aiAddDoc(_aiSheetsToText(wb), "Excel", file);
    } else if (type.startsWith("text/") || ext === "txt" || ext === "csv") {
      _aiAddDoc(await file.text(), ext === "csv" ? "CSV" : ".txt", file);
    } else {
      throw new Error("Chưa đọc được loại tệp này. Hãy chọn ảnh, PDF, Word (.docx), Excel hoặc .txt.");
    }
    return true;
  } catch (err) {
    _aiError(err.message || "Không đọc được tệp, hãy thử tệp khác.");
    return false;
  }
}

// Kiểm PDF trước khi đính kèm (cùng luật với ai-invitation): đúng chữ ký "%PDF-",
// tổng số trang ≤ aiPdfMaxPages; không đếm được trang (PDF nén) thì chỉ nhận file nhỏ.
// Bảng tính → chữ cho XuXi: mỗi hàng một dòng, ô ngăn bằng " | " (dấu phẩy hay lẫn
// với dấu phẩy trong tên/ghi chú). Bỏ hàng trống và cột trống hẳn; nhiều sheet thì ghi
// tên sheet làm tiêu đề nhóm (sheet hay đặt tên "Nhà trai"/"Nhà gái").
function _aiSheetsToText(wb) {
  const parts = [];
  wb.SheetNames.forEach((name) => {
    const rows = _XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: false, defval: "", blankrows: false })
      .map((r) => r.map((c) => String(c).replace(/\s+/g, " ").trim()))
      .filter((r) => r.some(Boolean));
    if (!rows.length) return;
    const width = Math.max(...rows.map((r) => r.length));
    const keep = [...Array(width).keys()].filter((i) => rows.some((r) => r[i]));
    const lines = rows.map((r) => keep.map((i) => r[i] || "").join(" | ").replace(/( \| )+$/, ""));
    parts.push((wb.SheetNames.length > 1 ? `${name}:\n` : "") + lines.join("\n"));
  });
  return parts.join("\n\n");
}

async function _aiPdfPages(file) {
  const { aiPdfMaxPages, aiPdfUnknownMaxMB } = CONFIG.guestImport;
  const bin = new TextDecoder("latin1").decode(await file.arrayBuffer());
  if (!bin.startsWith("%PDF-")) throw new Error(`Tệp “${file.name}” không phải PDF hợp lệ.`);
  const n = (bin.match(/\/Type\s*\/Page(?![A-Za-z])/g) || []).length;
  if (!n && file.size > aiPdfUnknownMaxMB * 1048576) {
    throw new Error(`Không đếm được số trang của “${file.name}”. Hãy xuất lại PDF hoặc chụp ảnh danh sách.`);
  }
  const used = _ai.files.reduce((s, f) => s + (f.pages || 0), 0);
  if (used + (n || 1) > aiPdfMaxPages) {
    throw new Error(`PDF tối đa ${aiPdfMaxPages} trang mỗi lượt. Hãy tách bớt trang hoặc nhập ở lượt sau.`);
  }
  return n || 1;
}

// Trần từng tệp gửi AI (sau nén) — khớp MAX_GUEST_FILE_B64 của ai-invitation.
function _aiCheckFile(size, name) {
  const max = CONFIG.guestImport.aiFileMaxMB;
  if (size > max * 1048576) throw new Error(`Tệp “${name}” lớn hơn ${max}MB. Với PDF, hãy tách bớt trang rồi thử lại.`);
}

// Còn chỗ cho thêm một tệp nặng `size` byte không (số tệp + tổng dung lượng)?
// Cùng luật với ai-invitation (MAX_GUEST_FILES, MAX_GUEST_FILES_B64) — server vẫn kiểm lại.
function _aiCheckRoom(size) {
  const { aiMaxFiles, aiFilesMaxMB } = CONFIG.guestImport;
  if (_ai.files.length >= aiMaxFiles) throw new Error(`Mỗi lượt tối đa ${aiMaxFiles} tệp. Bỏ bớt tệp hoặc nhập phần còn lại ở lượt sau.`);
  const used = _aiBinSize();
  if (used + size > aiFilesMaxMB * 1048576) throw new Error(`Tổng dung lượng tệp vượt ${aiFilesMaxMB}MB. Bỏ bớt tệp rồi thử lại.`);
}

const _aiBinSize = () => _ai.files.reduce((n, f) => n + (f.kind === "doc" ? 0 : f.size), 0);
const _aiDocChars = () => _ai.files.reduce((n, f) => n + (f.kind === "doc" ? f.text.length : 0), 0);

// Chữ đọc từ Word/Excel/.txt → một tệp đính kèm (gửi ngầm, ghi rõ tên tệp cho AI).
function _aiAddDoc(text, fmt, file) {
  const t = String(text || "").replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!t) throw new Error(`Không thấy chữ nào trong “${file.name}”.`);
  _aiCheckRoom(0);
  const max = CONFIG.guestImport.aiDocsMaxChars;
  if (_aiDocChars() + t.length > max) {
    throw new Error(`Nội dung các tệp Word/Excel/.txt dài quá ${max.toLocaleString("vi-VN")} ký tự. Hãy chia làm nhiều lượt.`);
  }
  _aiAttach({ kind: "doc", fmt, text: t, size: file.size, lines: t.split("\n").filter((l) => l.trim()).length }, file.name);
}

function _aiBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] || "");
    r.onerror = () => reject(new Error("Không đọc được tệp"));
    r.readAsDataURL(blob);
  });
}

// Ảnh → JPEG cạnh dài ≤ aiImageMaxSide: ảnh điện thoại 3–8MB còn vài trăm KB.
async function _aiImageToJpeg(file) {
  let bmp;
  try {
    bmp = await createImageBitmap(file);
  } catch {
    throw new Error("Không mở được ảnh này (ảnh HEIC?). Hãy chụp lại hoặc lưu dạng JPG rồi thử lại.");
  }
  const side = CONFIG.guestImport.aiImageMaxSide;
  const k = Math.min(1, side / Math.max(bmp.width, bmp.height));
  const cv = document.createElement("canvas");
  cv.width = Math.round(bmp.width * k);
  cv.height = Math.round(bmp.height * k);
  const g = cv.getContext("2d");
  g.fillStyle = "#fff"; // ảnh PNG nền trong suốt → nền trắng cho chữ dễ đọc
  g.fillRect(0, 0, cv.width, cv.height);
  g.drawImage(bmp, 0, 0, cv.width, cv.height);
  bmp.close?.();
  const blob = await new Promise((res) => cv.toBlob(res, "image/jpeg", 0.85));
  if (!blob) throw new Error("Không nén được ảnh, hãy thử ảnh khác.");
  return { kind: "image", mime: "image/jpeg", data: await _aiBase64(blob), size: blob.size, url: URL.createObjectURL(blob) };
}

let _aiMammothP = null;
function _aiLoadMammoth() {
  if (window.mammoth) return Promise.resolve();
  _aiMammothP ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = AI_MAMMOTH.src;
    s.integrity = AI_MAMMOTH.sri;
    s.crossOrigin = "anonymous";
    s.onload = resolve;
    s.onerror = () => { _aiMammothP = null; reject(new Error("Chưa tải được bộ đọc file Word, kiểm tra mạng rồi thử lại.")); };
    document.head.appendChild(s);
  });
  return _aiMammothP;
}

// Đính kèm ảnh/PDF (tối đa aiMaxFiles): mỗi tệp một hàng dưới ô dán, ô vẫn gõ được
// để thêm khách hoặc dặn XuXi cách đọc.
function _aiAttach(att, name) {
  _ai.files.push({ ...att, name });
  _aiRenderFiles();
}

const _aiKindLabel = (f) => (f.kind === "doc" ? f.fmt : f.kind === "image" ? "Ảnh" : "PDF");

function _aiRenderFiles() {
  const box = _aiEl("ai-file-card");
  if (!box) return;
  const chips = _ai.files.map((f, i) => {
    const kind = _aiKindLabel(f);
    const thumb = f.kind === "image"
      ? `<img class="gs-ai-file-thumb" src="${f.url}" alt="" />`
      : `<span class="gs-ai-file-thumb gs-ai-file-thumb--${f.kind === "doc" ? (f.fmt === "Excel" ? "xls" : "doc") : "pdf"}">${
        _ico(f.fmt === "Excel" ? "file-spreadsheet" : "file-text", 20)}</span>`;
    const name = escapeHtml(f.name || (f.kind === "image" ? "Ảnh chụp" : `Tệp ${kind}`));
    const meta = f.kind === "doc" ? `${kind} · ${f.lines} dòng` : `${kind} · ${_aiSize(f.size)}`;
    return `
      <div class="gs-ai-file" title="${name}">
        ${thumb}
        <span class="gs-ai-file-txt">
          <span class="gs-ai-file-name">${name}</span>
          <span class="gs-ai-file-meta">${meta}</span>
        </span>
        <x-button variant="bare" type="button" class="gs-ai-file-x" onclick="aiRemoveFile(${i})"
          title="Bỏ tệp" aria-label="Bỏ tệp ${name}">${_ico("x", 12)}</x-button>
      </div>`;
  }).join("");
  box.innerHTML = _ai.files.length ? `<div class="gs-ai-strip">${chips}</div>` : "";
  lucide.createIcons({ root: box });
  _aiSyncAttachUi();
}

function aiRemoveFile(i) {
  if (_ai.busy) return;
  const [f] = _ai.files.splice(i, 1);
  if (f?.url) URL.revokeObjectURL(f.url);
  _aiRenderFiles();
  _aiError("");
  _aiEl("ai-text").focus();
}

function _aiDetach() {
  _ai.files.forEach((f) => f.url && URL.revokeObjectURL(f.url));
  _ai.files = [];
  _aiRenderFiles();
}

// Có tệp: hiện danh sách tệp, ô dán đổi gợi ý sang "gõ thêm"; "Dán ví dụ" chỉ có khi trống tệp.
function _aiSyncAttachUi() {
  const on = _ai.files.length > 0;
  _aiEl("ai-file-card")?.classList.toggle("hidden", !on);
  const ta = _aiEl("ai-text");
  if (ta) {
    ta.placeholder = on
      ? "Thêm ghi chú cho XuXi (không bắt buộc)"
      : "Dán danh sách khách mời vào đây...";
  }
  _aiSyncCount();
}

async function runAiParse() {
  if (_ai.busy) return;
  const files = _ai.files.filter((f) => f.kind !== "doc");
  const docs = _ai.files.filter((f) => f.kind === "doc");
  const text = _aiEl("ai-text").value.trim();
  if (!_ai.files.length && !text) {
    _aiError("Dán danh sách, chọn tệp hoặc chụp ảnh danh sách khách mời trước đã.");
    _aiEl("ai-text").focus();
    return;
  }
  if (text.length > AI_GUEST_MAX_CHARS) { _aiSyncCount(); return; }
  // Kiểm lại trước khi gửi (phòng trạng thái lệch) — cùng luật với server.
  const { aiMaxFiles, aiFilesMaxMB } = CONFIG.guestImport;
  if (_ai.files.length > aiMaxFiles) { _aiError(`Mỗi lượt tối đa ${aiMaxFiles} tệp.`); return; }
  if (_aiBinSize() > aiFilesMaxMB * 1048576) {
    _aiError(`Tổng dung lượng tệp vượt ${aiFilesMaxMB}MB. Bỏ bớt tệp rồi thử lại.`);
    return;
  }
  // Bên đã đủ khách: dừng trước khi tốn một lượt AI.
  const max = _maxPerSide();
  if (_allGuests[_ai.side].length >= max) {
    _aiError(`Danh sách ${_SIDE_LABEL[_ai.side]} đã đủ ${max} khách, không nhập thêm được.`);
    return;
  }
  _aiError("");

  const ctrl = new AbortController();
  _ai.abort = ctrl;
  _aiSetBusy(true);
  _aiShowStage("review");
  _aiEl("ai-save").disabled = true;
  _aiRenderLoading();
  try {
    const { guests, truncated } = await aiDAL.parseGuests({
      text,
      files: files.map((f) => ({ mime: f.mime, data: f.data, name: f.name })),
      docs: docs.map((f) => ({ name: f.name, type: f.fmt, text: f.text })),
    }, ctrl.signal);
    // Đã huỷ (Huỷ / đóng popup) thì bỏ kết quả về muộn.
    if (ctrl.signal.aborted) return;
    _ai.abort = null;
    _ai.rows = guestBL.normalizeAiGuests(guests);
    // Nhắc soát chính tả chỉ khi AI phải "nhìn" ảnh/PDF; chữ từ Word/Excel là nguyên văn.
    _ai.fromFile = files.length > 0;
    _ai.filter = "";
    _aiSetBusy(false);
    _aiRenderReview();
    _aiEl("ai-review").scrollTop = 0;
    if (truncated) {
      showToast(`Danh sách quá dài, XuXi chỉ đọc ${guests.length} khách đầu. Phần còn lại hãy nhập ở lượt sau.`, "warning");
    }
  } catch (err) {
    if (ctrl.signal.aborted) return;
    _ai.abort = null;
    _aiSetBusy(false);
    _aiShowStage("paste");
    _aiError(err.message || "XuXi chưa đọc được danh sách, vui lòng thử lại.");
  }
}

function _aiRenderLoading() {
  const row = `<div class="gs-ai-row gs-ai-row--sk"><span class="gs-sk h-8 w-20"></span><span class="gs-sk h-8 flex-1"></span></div>`;
  const n = _ai.files.length;
  const what = n ? `XuXi đang đọc ${n > 1 ? `${n} tệp` : _ai.files[0].kind === "image" ? "ảnh" : `tệp ${_aiKindLabel(_ai.files[0])}`} và tách tên, xưng hô.` : "XuXi đang tách tên và xưng hô.";
  _aiEl("ai-review").innerHTML = `
    <div class="gs-ai-wait" role="status">
      <span class="gs-ai-wait-ico"><i data-icon="xuxi" data-size="22"></i></span>
      <span class="flex-1 min-w-0">${what} Danh sách dài có thể mất một lúc.</span>
      <x-button variant="bare" type="button" class="gs-ai-wait-stop" onclick="aiCancelParse()"
        title="Dừng đọc" aria-label="Dừng đọc"><i aria-hidden="true"></i></x-button>
    </div>
    <div class="gs-ai-list animate-pulse" aria-hidden="true">${row.repeat(5)}</div>`;
}

// Trạng thái từng hàng tính lại mỗi lần sửa.
function _aiReplan() {
  _ai.plan = guestBL.planAiImport(_ai.rows, _allGuests[_ai.side], _ai.side, _maxPerSide());
}

// Thanh sức chứa của bên đang nhập: khách có sẵn · khách sắp thêm · phần vượt trần.
// plan = null → chỉ vẽ phần có sẵn (bước dán).
function _aiCapHTML(plan) {
  const side = _ai.side;
  const max = _maxPerSide();
  const have = _allGuests[side].length;
  const add = plan ? plan.ok : 0;
  const over = plan ? plan.over : 0;
  const pct = (n) => `${Math.min(100, (n / max) * 100).toFixed(2)}%`;
  const free = Math.max(0, max - have);
  // Mức đầy của khách có sẵn → màu vạch: xanh · vàng (từ 80%) · đỏ (đủ trần).
  const lv = have >= max ? "full" : have >= max * 0.8 ? "warn" : "ok";
  let note;
  const full = `Danh sách đã đủ ${max} khách, không thêm được nữa`;
  if (!plan) note = free ? `Đã có ${have} khách, thêm được tối đa ${free} khách nữa` : full;
  else if (over) {
    note = add
      ? `Sẽ thêm ${add} khách. ${over} khách còn lại không thêm được vì mỗi bên chỉ tối đa ${max} khách.`
      : full;
  } else if (add) {
    note = free - add
      ? `Sẽ thêm ${add} khách, sau đó còn thêm được ${free - add} khách nữa`
      : `Sẽ thêm ${add} khách, danh sách vừa đủ ${max} khách`;
  } else note = free ? `Không có khách mới để thêm vào ${_SIDE_LABEL[side]}` : full;
  return `
    <div class="gs-cap gs-cap--${side}${over || !free ? " is-full" : ""}">
      <div class="gs-cap-top">
        <span class="gs-cap-name">${_ico(side === "groom" ? "mars" : "venus", 14)}Nhà ${side === "groom" ? "trai" : "gái"}</span>
        <span class="gs-cap-num"><strong>${have + add}</strong>/${max}</span>
      </div>
      <div class="gs-cap-bar" role="img" aria-label="Nhà ${side === "groom" ? "trai" : "gái"}: có sẵn ${have}, thêm ${add}, tối đa ${max}">
        <i class="gs-cap-have is-${lv}" style="width:${pct(have)}"></i><i class="gs-cap-add" style="width:${pct(Math.min(add, free))}"></i>
      </div>
      <p class="gs-cap-note">${note}</p>
    </div>`;
}

function _aiRenderCap(box, plan) {
  box.innerHTML = _aiCapHTML(plan);
  lucide.createIcons({ root: box });
}

function _aiRowHTML(r) {
  const k = escapeHtml(r.key);
  return `
    <div class="gs-ai-row" data-key="${k}">
      <div class="gs-ai-top">
        <p class="gs-ai-greet" data-greet></p>
        <span class="gs-ai-st"></span>
        <x-button variant="ghost" tone="neutral" size="sm" icon-only type="button" data-ai="remove" class="gs-ai-x"
          title="Bỏ khách này" aria-label="Bỏ khách này">${_ico("x", 15)}</x-button>
      </div>
      <label class="gs-ai-f gs-ai-f--rel"><span class="gs-ai-lb">Xưng hô</span>
        <span class="gs-ai-relbox">
          <input class="gs-ai-in gs-ai-rel" data-f="relationship" value="${escapeHtml(r.relationship)}" maxlength="100"
            placeholder="Bạn" autocomplete="off" role="combobox" aria-autocomplete="list" aria-controls="ai-rel-pop" />
          <span class="gs-ai-relchev" aria-hidden="true">${_ico("chevron-down", 16)}</span>
        </span></label>
      <label class="gs-ai-f gs-ai-f--name"><span class="gs-ai-lb">Họ và tên</span>
        <input class="gs-ai-in gs-ai-name" data-f="full_name" value="${escapeHtml(r.full_name)}" maxlength="200"
          placeholder="Nhập họ và tên" autocomplete="off" /></label>
      <label class="gs-ai-f gs-ai-f--disp"><span class="gs-ai-lb">Tên trên thiệp</span>
        <input class="gs-ai-in gs-ai-disp" data-f="display_name" value="${escapeHtml(r.display_name)}" maxlength="200"
          placeholder="${escapeHtml(r.full_name) || "Để trống = dùng họ tên"}" autocomplete="off" /></label>
      <div class="gs-ai-adopt">
        <span>${_ico("info", 14)}XuXi xếp khách này vào ${escapeHtml(_SIDE_LABEL[_aiOtherSide()])}</span>
        <x-button variant="bare" type="button" class="gs-ai-adopt-btn" data-ai="adopt">
          ${_ico("corner-down-left", 14)}<span>Nhập vào ${escapeHtml(_SIDE_LABEL[_ai.side])}</span>
        </x-button>
      </div>
    </div>`;
}

function _aiRenderReview() {
  const box = _aiEl("ai-review");
  if (!_ai.rows.length) {
    box.innerHTML = _emptyHTML("search-x", "XuXi không tìm thấy tên khách nào",
      "Mỗi khách nên nằm trên một dòng hoặc cách nhau bằng dấu phẩy. Sửa lại danh sách rồi phân tích lần nữa.",
      `<x-button variant="outline" tone="neutral" type="button" onclick="aiBackToPaste()">${_ico("arrow-left")}<span>Sửa danh sách</span></x-button>`);
    lucide.createIcons({ root: box });
    _aiEl("ai-save").disabled = true;
    return;
  }

  box.innerHTML = `
    <div class="gs-ai-cap"><div data-cap></div><div class="gs-ai-tally" data-tally role="group" aria-label="Lọc theo trạng thái"></div></div>
    ${_ai.fromFile ? `<p class="gs-ai-tip gs-ai-read">${_ico("scan-eye", 16)}<span>Danh sách đọc từ tệp — kiểm tra kỹ tên và dấu, nhất là chữ viết tay.</span></p>` : ""}
    <div class="gs-ai-list" aria-label="Khách ${_SIDE_LABEL[_ai.side]} sắp nhập">
      ${_ai.rows.map(_aiRowHTML).join("")}
    </div>`;
  lucide.createIcons({ root: box });
  _aiRefresh();
  _aiApplyFilter();
}

// Cập nhật cờ hàng + thanh sức chứa + nút nhập mà KHÔNG dựng lại ô nhập (giữ con
// trỏ khi đang gõ).
function _aiRefresh() {
  _aiReplan();
  const box = _aiEl("ai-review");
  box.querySelectorAll(".gs-ai-row[data-key]").forEach((row) => {
    const r = _ai.rows.find((x) => x.key === row.dataset.key);
    if (!r) return;
    const st = _ai.plan.status[r.key];
    const flag = _aiFlag(st);
    row.classList.remove("is-ok", "is-other", "is-dup", "is-over", "is-empty");
    row.classList.add(`is-${st}`);
    const cell = row.querySelector(".gs-ai-st");
    if (cell.dataset.st !== st) {
      cell.dataset.st = st;
      cell.innerHTML = `${_ico(flag.icon, 12)}<span>${escapeHtml(flag.label)}</span>`;
      lucide.createIcons({ root: cell });
    }
    // Lời mời xem trước — đúng cách thiệp gọi khách (xưng hô + tên trên thiệp, trống thì họ tên).
    const who = (r.display_name.trim() || r.full_name.trim());
    row.querySelector("[data-greet]").innerHTML = who
      ? `Kính mời <b>${escapeHtml([r.relationship.trim(), who].filter(Boolean).join(" "))}</b>`
      : `<i>Chưa có tên khách</i>`;
    cell.title = flag.tip || flag.label;
  });
  const cap = box.querySelector("[data-cap]");
  if (cap) _aiRenderCap(cap, _ai.plan);
  _aiRenderTally(box.querySelector("[data-tally]"));

  const ok = _ai.plan.ok;
  _aiEl("ai-save-txt").textContent = ok ? `Nhập ${ok} khách` : "Không có khách để nhập";
  _aiEl("ai-save").disabled = !ok;
}

// Dải chip đếm theo trạng thái — cũng là bộ lọc. Chỉ hiện trạng thái đang có khách.
function _aiRenderTally(box) {
  if (!box) return;
  const n = {};
  Object.values(_ai.plan.status).forEach((st) => (n[st] = (n[st] || 0) + 1));
  if (_ai.filter && !n[_ai.filter]) _ai.filter = "";
  const chip = (key, icon, label, count) => `
    <button type="button" class="gs-ai-chip${key ? ` is-${key}` : ""}" data-filter="${key}" aria-pressed="${_ai.filter === key}">
      ${icon ? _ico(icon, 12) : ""}<span>${escapeHtml(label)}</span><b>${count}</b>
    </button>`;
  box.innerHTML = chip("", "", "Tất cả", _ai.rows.length) +
    Object.keys(_AI_ST).filter((k) => n[k]).map((k) => chip(k, _AI_ST[k].icon, _aiFlag(k).label, n[k])).join("");
  lucide.createIcons({ root: box });
}

// Lọc theo trạng thái LÚC BẤM (data-in): sửa một hàng làm nó đổi trạng thái thì nó vẫn
// nằm yên trong bộ lọc, không biến mất giữa lúc gõ.
function _aiApplyFilter() {
  const list = _aiEl("ai-review").querySelector(".gs-ai-list");
  if (!list) return;
  const f = _ai.filter;
  list.toggleAttribute("data-filter", !!f);
  list.querySelectorAll(".gs-ai-row[data-key]").forEach((row) => {
    row.toggleAttribute("data-in", !f || _ai.plan.status[row.dataset.key] === f);
  });
}

// Gợi ý xưng hô cho ô ở bước xem lại (thay <datalist>: mũi tên lệch, danh sách hệ thống
// không bám theo ô khi cuộn). all = hiện đủ danh sách (lúc mới focus/bấm), không thì lọc theo chữ đã gõ.
let _aiRelInput = null;
function _aiRelOpen(input, all) {
  const pop = _aiEl("ai-rel-pop");
  const cur = input.value.trim();
  const q = all ? "" : _fold(cur);
  const list = GUEST_RELATIONS.filter((v) => !q || _fold(v).includes(q));
  if (!list.length) { pop.close(); return; }
  _aiRelInput = input;
  pop.style.width = `${Math.max(160, input.offsetWidth)}px`;
  pop.setItems(list.map((v) => ({
    label: escapeHtml(v), active: v === cur,
    onClick: () => {
      input.value = v;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      pop.close();
    },
  })));
  if (pop.isOpen && pop._anchorEl === input) pop.place();
  else pop.open(input);
}

// Gán value bằng code thì nút "x" của <x-textarea> không tự biết — đồng bộ tay.
function _aiSetText(v) {
  const ta = _aiEl("ai-text");
  ta.value = v;
  ta.closest("x-textarea")?.syncClearBtn?.();
}

document.addEventListener("DOMContentLoaded", () => {
  const ta = _aiEl("ai-text");
  ta?.setAttribute("spellcheck", "false");
  ta?.setAttribute("aria-describedby", "ai-err");
  _aiEl("ai-attach-pop")?.addEventListener("open", () => _aiEl("ai-plus").classList.add("is-open"));
  _aiEl("ai-attach-pop")?.addEventListener("close", () => _aiEl("ai-plus").classList.remove("is-open"));
  ["ai-file", "ai-photo", "ai-cam"].forEach((id) => _aiEl(id)?.addEventListener("change", (e) => {
    const list = Array.from(e.target.files || []);
    e.target.value = "";
    _aiHandleFiles(list);
  }));
  // Dán ảnh (Ctrl+V ảnh chụp màn hình) vào ô = đính kèm ảnh; dán chữ thì như thường.
  ta?.addEventListener("paste", (e) => {
    const imgs = Array.from(e.clipboardData?.files || []).filter((f) => f.type.startsWith("image/"));
    if (imgs.length) { e.preventDefault(); _aiHandleFiles(imgs); }
  });
  // Kéo thả tệp vào khung ô dán.
  const pad = document.querySelector(".gs-ai-pad");
  pad?.addEventListener("dragover", (e) => {
    if (!e.dataTransfer?.types?.includes("Files")) return;
    e.preventDefault();
    pad.classList.add("is-drop");
  });
  pad?.addEventListener("dragleave", (e) => { if (!pad.contains(e.relatedTarget)) pad.classList.remove("is-drop"); });
  pad?.addEventListener("drop", (e) => {
    if (!e.dataTransfer?.files?.length) return;
    e.preventDefault();
    pad.classList.remove("is-drop");
    _aiHandleFiles(e.dataTransfer.files);
  });
  _aiEl("ai-text")?.addEventListener("input", _aiSyncCount);
  // Ctrl/⌘ + Enter trong ô dán = Phân tích.
  _aiEl("ai-text")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); runAiParse(); }
  });

  const review = _aiEl("ai-review");
  review?.addEventListener("focusin", (e) => { if (e.target.matches?.(".gs-ai-rel")) _aiRelOpen(e.target, true); });
  review?.addEventListener("keydown", (e) => {
    if (e.target.matches?.(".gs-ai-rel") && e.key === "Tab") _aiEl("ai-rel-pop")?.close();
  });
  // Danh sách bám theo ô khi cuộn (x-popover tự đặt lại), ô trôi khỏi khung thì ẩn.
  review?.addEventListener("scroll", () => {
    const pop = _aiEl("ai-rel-pop");
    if (!pop?.isOpen || !_aiRelInput) return;
    const a = _aiRelInput.getBoundingClientRect();
    const v = review.getBoundingClientRect();
    if (a.bottom < v.top || a.top > v.bottom) pop.close();
  }, { passive: true });
  review?.addEventListener("input", (e) => {
    if (e.target.matches?.(".gs-ai-rel")) _aiRelOpen(e.target, false);
    const f = e.target.dataset?.f;
    const key = e.target.closest(".gs-ai-row")?.dataset.key;
    const r = key && _ai.rows.find((x) => x.key === key);
    if (!f || !r) return;
    r[f] = e.target.value;
    if (f === "full_name") {
      // Tên trên thiệp để trống = dùng họ tên → placeholder là đúng họ tên đó.
      e.target.closest(".gs-ai-row").querySelector(".gs-ai-disp").placeholder = r.full_name.trim() || "Để trống = dùng họ tên";
    }
    _aiRefresh();
  });
  review?.addEventListener("click", (e) => {
    const rel = e.target.closest(".gs-ai-relbox")?.querySelector(".gs-ai-rel");
    if (rel) { if (!_aiEl("ai-rel-pop").isOpen) _aiRelOpen(rel, true); return; }
    const chip = e.target.closest("[data-filter]");
    if (chip && chip.tagName === "BUTTON") {
      _ai.filter = _ai.filter === chip.dataset.filter ? "" : chip.dataset.filter;
      _aiRenderTally(chip.parentElement);
      _aiApplyFilter();
      review.scrollTop = 0;
      return;
    }
    const btn = e.target.closest("[data-ai]");
    const key = btn?.closest(".gs-ai-row")?.dataset.key;
    if (!key) return;
    const i = _ai.rows.findIndex((x) => x.key === key);
    if (i < 0) return;
    if (btn.dataset.ai === "remove") _ai.rows.splice(i, 1);
    // Bấm nhãn "Thuộc nhà …": bỏ nhóm AI gắn, khách được nhập vào bên đang mở.
    else if (btn.dataset.ai === "adopt" && !btn.disabled) _ai.rows[i].group = "";
    else return;
    const top = review.scrollTop;
    _aiRenderReview();
    review.scrollTop = top;
  });
});

async function confirmAiImport() {
  if (_ai.busy) return;
  _aiReplan();
  const side = _ai.side;
  const rows = _ai.rows.filter((r) => _ai.plan.status[r.key] === "ok");
  if (!rows.length) return;

  _ai.busy = true;
  _modalHide(_aiEl("ai-import-modal"));
  showLoading(true, "Đang nhập khách...");
  try {
    const res = await guestBL.importAiGuests(WEDDING_ID, side, rows);
    await _generateGuestLinks(side);
    await loadGuestList(side);
    // capped: server thấy danh sách đã kín (thiết bị khác vừa thêm khách) nên cắt bớt.
    const skipMsg = res.capped
      ? `. ${res.skipped} khách không nhập được vì danh sách đã đủ ${_maxPerSide()} khách hoặc trùng`
      : res.skipped ? `, bỏ qua ${res.skipped} trùng` : "";
    showToast(`Đã nhập ${res.inserted || 0} khách ${_SIDE_LABEL[side]}${skipMsg}`,
      res.inserted && !res.capped ? "success" : "warning");
    _aiSetText("");
    _aiDetach();
    _ai.rows = [];
  } catch (err) {
    // showToast gán innerHTML — lỗi từ server phải escape.
    showToast(`Chưa nhập được khách ${_SIDE_LABEL[side]}: ${escapeHtml(err.message)}`, "error");
  } finally {
    _ai.busy = false;
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

// Trần khách mỗi bên của thiệp này (server suy từ trạng thái thanh toán). Chưa nạp
// được thì lùi về trần chưa thanh toán — server vẫn kiểm lại lúc ghi.
function _maxPerSide() {
  return _wedding?.max_per_side || CONFIG.guestImport.maxPerSideUnpaid;
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

// Ba cách thêm khách ở màn trống — thẻ lựa chọn (.gs-path), mỗi thẻ ghi khi nào nên
// dùng. Thẻ XuXi mang tông AI, hai thẻ kia trung tính.
function _emptyPathsHTML(side) {
  const card = (tone, ico, title, desc, onclick) => `
    <button type="button" class="gs-path gs-path--${tone}" onclick="${onclick}">
      <span class="gs-path-ico">${ico}</span>
      <span class="gs-path-txt">
        <span class="gs-path-title">${title}</span>
        <span class="gs-path-desc">${desc}</span>
      </span>
    </button>`;
  return `<div class="gs-paths">
    ${card("ai", `<i data-icon="xuxi" data-size="28"></i>`, "Nhập khẩu với AI",
      "Hỗ trợ văn bản, ảnh chụp, PDF, Word, Excel. Tự động tách tên, xưng hô từng khách.", `switchTab('${side}'); openAiImport()`)}
    ${card("one", _ico("user-plus", 20), "Thêm từng khách",
      "Gõ tên và xưng hô cho một người.", `openAddGuestModal('${side}')`)}
    ${card("excel", _ico("file-spreadsheet", 20), "Nhập từ Excel",
      "Dùng file có cột Họ tên, Tên trên thiệp, Xưng hô.", "pickExcel()")}
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
  const selecting = _sel.side === side;
  const picked = selecting && _sel.ids.has(g.id);
  const who = selecting
    ? `title="${escapeHtml(g.full_name)}" aria-label="Chọn ${escapeHtml(g.full_name)}" aria-pressed="${picked}"`
    : `title="${escapeHtml(g.full_name)} — bấm để sửa" aria-label="${escapeHtml(g.full_name)}, sửa thông tin"`;
  return `
    <div class="gs-row${picked ? " is-picked" : ""}">
      <button type="button" class="gs-who" data-action="edit" data-guest-id="${id}" data-side="${side}" ${who}>
        ${selecting
          ? `<span class="gs-ava gs-pick" aria-hidden="true">${picked ? _ico("check", 18) : ""}</span>`
          : `<span class="gs-ava gs-ava--${side}" aria-hidden="true">${escapeHtml(_initial(g))}</span>`}
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
          data-action="share" title="Gửi link mời" aria-label="Gửi link mời">${_ico("share-2")}</x-button>` : ""}
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
      "Mỗi khách sẽ có một link mời gọi đúng tên. Chọn cách thêm khách tiện nhất với bạn.",
      _emptyPathsHTML(side),
    ) + `<p class="gs-empty-note">Chưa có file Excel? <button type="button" class="gs-link" onclick="downloadGuestTemplate()">Tải file mẫu</button></p>`;
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
  const selecting = _sel.side === side;
  container.innerHTML = `
    <div class="gs-list${selecting ? " is-selecting" : ""}">${_GUEST_HEAD}${pageGuests.map((g) => _rowHTML(g, side)).join("")}</div>
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
    { icon: _popIco("list-checks", "gs-tone-red"), label: "Chọn nhiều để xoá", onClick: () => enterGuestSelect(side, guest.id) },
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
    type: "error", icon: "trash-2", confirmText: "Xác nhận", cancelText: "Hủy bỏ",
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

// ─── Chọn nhiều để xoá ────────────────────────────────────────────────────────
// Chế độ chọn gắn với MỘT bên (_sel.side): bấm hàng là chọn/bỏ thay vì mở sửa, nút
// thao tác của hàng ẩn đi. Chọn giữ nguyên qua trang/tìm/lọc; đổi tab hoặc Esc là thoát.

const _sel = { side: null, ids: new Set() };

function enterGuestSelect(side, firstId) {
  _sel.side = side;
  _sel.ids = new Set(firstId ? [firstId] : []);
  _renderGuestList(side);
}

function exitGuestSelect() {
  const side = _sel.side;
  _sel.side = null;
  _sel.ids.clear();
  if (side) _renderGuestList(side);
}

// Vẽ lại rồi trả focus về đúng hàng vừa bấm (bàn phím không bị rơi về đầu trang).
function _selToggle(id) {
  const side = _sel.side;
  if (_sel.ids.has(id)) _sel.ids.delete(id);
  else _sel.ids.add(id);
  _renderGuestList(side);
  document.querySelector(`#guest-list-${side} [data-action="edit"][data-guest-id="${CSS.escape(id)}"]`)?.focus();
}

// "Chọn tất cả" áp cho mọi khách đang hiện theo tìm/lọc (mọi trang), không chỉ trang này.
function toggleSelectAllGuests() {
  const side = _sel.side;
  if (!side) return;
  const ids = _visibleGuests(side).map((g) => g.id);
  const all = ids.length && ids.every((id) => _sel.ids.has(id));
  ids.forEach((id) => (all ? _sel.ids.delete(id) : _sel.ids.add(id)));
  _renderGuestList(side);
}

// Cụm chọn nhiều nằm TRÊN thanh công cụ, thế chỗ .gs-actions (cờ .is-selecting) với
// cùng chiều cao nút — vào/ra chế độ chọn không làm danh sách nhảy. Gọi từ _syncStats.
function _syncSelBar() {
  const on = _sel.side === _currentTab;
  document.querySelector(".gs-toolbar")?.classList.toggle("is-selecting", on);
  const box = document.getElementById("gs-selbar");
  if (!box) return;
  if (!on) { box.innerHTML = ""; return; }
  const n = _sel.ids.size;
  const visible = _visibleGuests(_currentTab);
  const all = visible.length && visible.every((g) => _sel.ids.has(g.id));
  box.innerHTML = `
    <button type="button" class="gs-selbar-all" onclick="toggleSelectAllGuests()" aria-pressed="${!!all}">
      <span class="gs-pick${all ? " is-on" : ""}" aria-hidden="true">${all ? _ico("check", 14) : ""}</span>
      <span>${all ? "Bỏ chọn tất cả" : `Chọn tất cả ${visible.length}`}</span>
    </button>
    <div class="gs-selbar-acts">
      <x-button variant="outline" tone="neutral" onclick="exitGuestSelect()">Huỷ</x-button>
      <x-button variant="fill" tone="danger" onclick="deleteSelectedGuests()" ${n ? "" : "disabled"}>
        ${_ico("trash-2", 16)}<span>Xoá${n ? ` ${n}` : ""}</span>
      </x-button>
    </div>`;
  lucide.createIcons({ root: box });
}

async function deleteSelectedGuests() {
  const side = _sel.side;
  const ids = [..._sel.ids];
  if (!side || !ids.length) return;
  const ok = await showConfirm(`Xoá ${ids.length} khách ${_SIDE_LABEL[side]}?`,
    "Link mời riêng của những khách này sẽ không còn gọi đúng tên nữa. Không hoàn tác được.", {
      type: "error", icon: "trash-2", confirmText: "Xác nhận", cancelText: "Hủy bỏ",
    });
  if (!ok) return;
  showLoading(true, "Đang xoá...");
  let done = 0;
  try {
    // guest-handler nhận tối đa 200 id mỗi lần.
    for (let i = 0; i < ids.length; i += 200) {
      await guestDAL.deleteGuestsByIds(ids.slice(i, i + 200));
      done += Math.min(200, ids.length - i);
    }
    showToast(`Đã xoá ${done} khách mời`, "success");
  } catch (err) {
    showToast(escapeHtml(`Xoá thất bại${done ? ` sau ${done} khách` : ""}: ${err.message}`), "error");
  } finally {
    _sel.side = null;
    _sel.ids.clear();
    showLoading(false);
    await loadGuestList(side);
  }
}

// ─── Delete Guest ─────────────────────────────────────────────────────────────

async function _deleteGuest(guest, side) {
  const ok = await showConfirm(`Xoá khách “${guest.full_name}”?`,
    "Link mời riêng của khách này sẽ không còn gọi đúng tên nữa. Không hoàn tác được.", {
      type: "error", icon: "trash-2", confirmText: "Xác nhận", cancelText: "Hủy bỏ",
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
