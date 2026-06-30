const WEDDING_ID = new URLSearchParams(window.location.search).get("id");

let _importState = { headers: [], data: [], side: "" };
let _currentTab = "groom";

// ─── Init ─────────────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", async () => {
  lucide.createIcons();
  if (!WEDDING_ID) { showToast("⚠️ Không tìm thấy ID thiệp"); return; }
  await _loadWeddingGASUrls();
  await Promise.all([loadGuestList("groom"), loadGuestList("bride")]);
});

// Event delegation cho action buttons trong table (tránh inline onclick với dữ liệu user)
document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  const action = btn.dataset.action;
  const link   = btn.dataset.link;
  const guestId = btn.dataset.guestId;
  const side    = btn.dataset.side;

  if (action === "copy" && link)      { e.stopPropagation(); copyGuestLink(link); }
  if (action === "messenger" && link) { e.stopPropagation(); shareViaMessenger(link); }
  if (action === "menu" && guestId)   { e.stopPropagation(); _openRowMenu(btn, guestId, side); }
});

function goBack() {
  window.location.href = `../index.html?id=${WEDDING_ID}`;
}

// ─── Tab ──────────────────────────────────────────────────────────────────────

function switchTab(side) {
  _currentTab = side;
  const other = side === "groom" ? "bride" : "groom";

  document.getElementById(`panel-${side}`).classList.remove("hidden");
  document.getElementById(`panel-${other}`).classList.add("hidden");

  const activeClass = ["bg-rose-50", "text-rose-600", "border-b-2", "border-rose-500"];
  const inactiveClass = ["text-gray-500", "hover:bg-gray-50"];

  const btn = document.getElementById(`tab-${side}`);
  const otherBtn = document.getElementById(`tab-${other}`);
  activeClass.forEach(c => btn.classList.add(c));
  inactiveClass.forEach(c => btn.classList.remove(c));
  activeClass.forEach(c => otherBtn.classList.remove(c));
  inactiveClass.forEach(c => otherBtn.classList.add(c));
}

// ─── GAS URL ──────────────────────────────────────────────────────────────────

async function _loadWeddingGASUrls() {
  try {
    const wedding = await guestDAL.getWedding(WEDDING_ID);
    if (wedding.groom_google_sheet_url)
      document.getElementById("gas-url-groom").value = wedding.groom_google_sheet_url;
    if (wedding.bride_google_sheet_url)
      document.getElementById("gas-url-bride").value = wedding.bride_google_sheet_url;
  } catch (err) {
    console.error("Load GAS URLs error:", err);
  }
}

async function saveGASUrl(side) {
  const url = document.getElementById(`gas-url-${side}`)?.value?.trim();
  const field = side === "groom" ? "groom_google_sheet_url" : "bride_google_sheet_url";
  try {
    await weddingBL.updateWedding({ id: WEDDING_ID, [field]: url || null });
    showToast("✅ Đã lưu URL");
  } catch (err) {
    showToast("❌ Lưu thất bại: " + err.message);
  }
}

// ─── Test GAS connection ───────────────────────────────────────────────────────

async function testGASConnection(side) {
  const url = document.getElementById(`gas-url-${side}`)?.value?.trim();
  const statusEl = document.getElementById(`gas-status-${side}`);
  const btn = document.getElementById(`test-gas-btn-${side}`);

  if (!url || !url.includes("script.google.com")) {
    _showGASStatus(statusEl, "error", "URL không hợp lệ — phải là link Google Apps Script");
    return;
  }

  btn.disabled = true;
  btn.classList.add("opacity-50");
  _showGASStatus(statusEl, "loading", "Đang kiểm tra...");

  try {
    const { guests } = await weddingDAL.getAllGuests(url);
    _showGASStatus(statusEl, "success",
      guests.length > 0 ? `Kết nối thành công — ${guests.length} khách` : "Kết nối thành công — chưa có khách");
  } catch (err) {
    const isTimeout = err.message?.includes("timeout");
    if (isTimeout) {
      _showGASStatus(statusEl, "error", "Script phản hồi quá chậm — thử lại sau");
    } else {
      const authUrl = url + (url.includes("?") ? "&" : "?") + "action=getAllGuests&callback=test";
      _showGASStatus(statusEl, "auth", authUrl);
    }
  } finally {
    btn.disabled = false;
    btn.classList.remove("opacity-50");
  }
}

function _showGASStatus(el, type, value) {
  el.classList.remove("hidden");
  const base = "rounded-lg p-2.5 text-xs flex items-start gap-2";
  if (type === "loading") {
    el.className = base + " bg-gray-50 text-gray-400";
    el.innerHTML = `<span>⏳</span><span>${value}</span>`;
  } else if (type === "success") {
    el.className = base + " bg-green-50 text-green-700";
    el.innerHTML = `<span class="font-bold">✓</span><span>${value}</span>`;
  } else if (type === "error") {
    el.className = base + " bg-red-50 text-red-600";
    el.innerHTML = `<span class="font-bold">✕</span><span>${value}</span>`;
  } else if (type === "auth") {
    el.className = base + " bg-amber-50 text-amber-700 flex-col";
    el.innerHTML = `
      <div class="flex items-center gap-2"><span class="font-bold">⚠</span><span>Script chưa được ủy quyền — cần mở link để cấp quyền lần đầu</span></div>
      <a href="${value}" target="_blank" rel="noopener" class="mt-1 inline-flex items-center gap-1 font-medium underline underline-offset-2">Mở để ủy quyền ↗</a>
      <span class="text-amber-500 mt-0.5">Sau khi ủy quyền xong, nhấn Kiểm tra lại</span>`;
  }
}

// ─── Add Single Guest ─────────────────────────────────────────────────────────

let _addGuestSide = "groom";

function openAddGuestModal(side) {
  _addGuestSide = side;
  document.getElementById("add-guest-fullname").value = "";
  document.getElementById("add-guest-displayname").value = "";
  document.getElementById("add-guest-relationship").value = "";
  const modal = document.getElementById("add-guest-modal");
  modal.classList.remove("hidden");
  modal.classList.add("flex");
  setTimeout(() => document.getElementById("add-guest-fullname").focus(), 50);
}

function closeAddGuestModal() {
  const modal = document.getElementById("add-guest-modal");
  modal.classList.add("hidden");
  modal.classList.remove("flex");
}

async function confirmAddGuest() {
  const full_name    = document.getElementById("add-guest-fullname").value.trim();
  const display_name = document.getElementById("add-guest-displayname").value.trim();
  const relationship = document.getElementById("add-guest-relationship").value.trim();

  if (!full_name) {
    document.getElementById("add-guest-fullname").focus();
    showToast("⚠️ Vui lòng nhập họ và tên");
    return;
  }

  closeAddGuestModal();
  showLoading(true, "Đang thêm khách...");
  try {
    await guestDAL.insertOneGuest(WEDDING_ID, _addGuestSide, { full_name, display_name, relationship });
    await _generateGuestLinks(_addGuestSide);
    await loadGuestList(_addGuestSide);
  } catch (err) {
    showToast("❌ " + err.message);
  } finally {
    showLoading(false);
  }
}

// ─── Export Excel ─────────────────────────────────────────────────────────────

function exportGuestList(side) {
  const guests = _allGuests[side];
  if (!guests || guests.length === 0) { showToast("⚠️ Chưa có khách mời để xuất"); return; }

  const headers = ["Họ và tên", "Tên hiển thị", "Xưng hô", "Link cá nhân", "Đã xem", "Xác nhận", "Lời chúc"];
  const rows = guests.map(g => [
    g.full_name    || "",
    g.display_name || "",
    g.relationship || "",
    g.link         || "",
    g.viewed ? "Đã xem" : "Chưa xem",
    g.confirmed    || "",
    g.wish         || "",
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
  ["A1","B1","C1","D1","E1","F1","G1"].forEach(ref => { if (ws[ref]) ws[ref].s = headerStyle; });

  ws["!cols"] = [{ wch: 22 }, { wch: 18 }, { wch: 10 }, { wch: 55 }, { wch: 12 }, { wch: 16 }, { wch: 30 }];
  ws["!rows"] = [{ hpt: 22 }];

  const sideLabel = side === "groom" ? "nha-trai" : "nha-gai";
  const wb = _XLSX.utils.book_new();
  _XLSX.utils.book_append_sheet(wb, ws, "Khách mời");
  _XLSX.writeFile(wb, `danh-sach-khach-${sideLabel}.xlsx`, { cellStyles: true });
  showToast(`✅ Đã xuất ${guests.length} khách mời`);
}

// ─── Excel Import ──────────────────────────────────────────────────────────────

async function regenerateLinks(side) {
  showLoading(true, "Đang tạo lại link...");
  try {
    await _generateGuestLinks(side);
    await loadGuestList(side);
  } catch (err) {
    showToast("❌ " + err.message);
  } finally {
    showLoading(false);
  }
}

function downloadGuestTemplate() {
  if (typeof XLSX === "undefined") { showToast("⚠️ Đang tải thư viện, thử lại sau"); return; }
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
    showToast("❌ " + err.message);
  }
}

function _openMappingModal(headers, data) {
  const mapping = guestBL.autoDetectMapping(headers);
  const noOpt = `<option value="-1">— Không chọn —</option>`;
  const opts = headers.map((h, i) => `<option value="${i}">${h || "(Cột " + (i + 1) + ")"}</option>`).join("");

  document.getElementById("map-full-name").innerHTML = opts;
  document.getElementById("map-display-name").innerHTML = noOpt + opts;
  document.getElementById("map-relationship").innerHTML = noOpt + opts;
  document.getElementById("map-full-name").value = mapping.full_name;
  document.getElementById("map-display-name").value = mapping.display_name;
  document.getElementById("map-relationship").value = mapping.relationship;

  _renderMappingPreview(headers, data.slice(0, 4));
  document.querySelector("input[name='import-mode'][value='overwrite']").checked = true;

  const modal = document.getElementById("import-mapping-modal");
  modal.classList.remove("hidden");
  modal.classList.add("flex");
  lucide.createIcons();
}

function closeMappingModal() {
  const modal = document.getElementById("import-mapping-modal");
  modal.classList.add("hidden");
  modal.classList.remove("flex");
}

function _renderMappingPreview(headers, rows) {
  const th = headers.map(h => `<th class="px-2 py-1.5 text-left text-xs font-medium text-gray-500 whitespace-nowrap">${h}</th>`).join("");
  const trs = rows.map(row =>
    `<tr class="border-t border-gray-100">${headers.map((_, i) =>
      `<td class="px-2 py-1.5 text-xs text-gray-700 max-w-[100px] truncate">${row[i] ?? ""}</td>`
    ).join("")}</tr>`
  ).join("");
  document.getElementById("mapping-preview").innerHTML = `
    <div class="overflow-x-auto rounded-lg border border-gray-200">
      <table class="w-full text-left"><thead class="bg-gray-50"><tr>${th}</tr></thead><tbody>${trs}</tbody></table>
    </div>
    <p class="text-xs text-gray-400 mt-1">Hiển thị ${rows.length} dòng đầu</p>`;
}

async function confirmImport() {
  const colMapping = {
    full_name:    parseInt(document.getElementById("map-full-name").value),
    display_name: parseInt(document.getElementById("map-display-name").value),
    relationship: parseInt(document.getElementById("map-relationship").value),
  };

  if (isNaN(colMapping.full_name) || colMapping.full_name < 0) {
    showToast("⚠️ Vui lòng chọn cột Họ và tên");
    return;
  }

  const overwrite = document.querySelector("input[name='import-mode']:checked").value === "overwrite";
  const { data, side } = _importState;

  closeMappingModal();
  showLoading(true, "Đang nhập khẩu...");

  try {
    const result = await guestBL.importGuests(WEDDING_ID, side, data, colMapping, overwrite);
    const skipMsg = result.skipped > 0 ? `, bỏ qua ${result.skipped} trùng` : "";
    showToast(`✅ Đã nhập ${result.inserted} khách${skipMsg}`);
    await _generateGuestLinks(side);
    await loadGuestList(side);
  } catch (err) {
    showToast("❌ Nhập khẩu thất bại: " + err.message);
  } finally {
    showLoading(false);
  }
}

// ─── Link Generation ──────────────────────────────────────────────────────────

let _weddingSlug = null;

async function _getWeddingSlug() {
  if (_weddingSlug) return _weddingSlug;
  const wedding = await guestDAL.getWedding(WEDDING_ID);
  _weddingSlug = wedding?.slug || null;
  return _weddingSlug;
}

async function _generateGuestLinks(side) {
  try {
    const slug = await _getWeddingSlug();
    if (!slug) { showToast("⚠️ Không tìm thấy slug thiệp, không thể tạo link"); return; }

    const guests = await guestDAL.getGuests(WEDDING_ID, side);
    const noLink = guests.filter(g => !g.link);
    if (!noLink.length) return;

    const isGroom = side === "groom";
    const domain = window.location.origin;

    const updates = noLink.map(g => {
      const encName = encryptData(g.display_name || g.full_name);
      const encRel  = encryptData(g.relationship || "");
      const link = `${domain}/${slug}?isGroom=${isGroom}&name=${encName}&relationship=${encRel}`;
      return { id: g.id, link };
    });
    await guestDAL.updateGuestsBatchLinks(updates);

    showToast(`✅ Đã tạo link cho ${noLink.length} khách`);
  } catch (err) {
    console.error("Generate links error:", err);
    showToast("❌ Tạo link thất bại: " + err.message);
  }
}

// ─── Guest List ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;
const _page = { groom: 1, bride: 1 };
const _allGuests = { groom: [], bride: [] };

async function loadGuestList(side) {
  if (!WEDDING_ID) return;
  try {
    const guests = await guestDAL.getGuests(WEDDING_ID, side);
    _allGuests[side] = guests;
    _page[side] = 1;
    _renderGuestList(side);
  } catch (err) {
    console.error("loadGuestList error:", err);
  }
}

function goToPage(side, page) {
  _page[side] = page;
  _renderGuestList(side);
  document.getElementById(`guest-list-${side}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function _esc(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

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
  const dot = `<span class="w-7 h-7 flex items-center justify-center text-xs text-gray-400">…</span>`;
  return pages.map(p => p === "..." ? dot : `
    <button type="button" onclick="goToPage('${side}', ${p})"
      class="w-7 h-7 rounded-lg text-xs font-medium transition-colors ${p === cur
        ? "bg-rose-500 text-white"
        : "border border-gray-200 text-gray-500 hover:bg-gray-50"}">
      ${p}
    </button>`).join("");
}

function _renderGuestList(side) {
  const container = document.getElementById(`guest-list-${side}`);
  if (!container) return;

  const guests = _allGuests[side];

  if (guests.length === 0) {
    container.innerHTML = `<p class="text-xs text-gray-400 text-center py-4">Chưa có khách mời nào</p>`;
    return;
  }

  const totalPages = Math.ceil(guests.length / PAGE_SIZE);
  const cur = _page[side];
  const pageGuests = guests.slice((cur - 1) * PAGE_SIZE, cur * PAGE_SIZE);

  const rows = pageGuests.map(g => `
    <tr class="border-t border-gray-100 hover:bg-gray-50/50">
      <td class="px-3 py-2.5">
        <p class="text-xs font-medium text-gray-800">${_esc(g.full_name)}</p>
        ${g.display_name ? `<p class="text-xs text-gray-400">${_esc(g.display_name)}</p>` : ""}
      </td>
      <td class="px-3 py-2.5 text-xs text-gray-500">${_esc(g.relationship) || "—"}</td>
      <td class="px-3 py-2.5 max-w-[160px]">
        ${g.link
          ? `<a href="${_esc(g.link)}" target="_blank" rel="noopener noreferrer" class="text-xs text-blue-500 hover:underline block truncate font-mono">${_esc(g.link)}</a>`
          : `<span class="text-gray-300 text-xs">—</span>`}
      </td>
      <td class="px-3 py-2.5">
        ${g.viewed
          ? `<span class="inline-flex items-center gap-1 text-xs text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full whitespace-nowrap">✓ Đã xem</span>`
          : `<span class="text-xs text-gray-400">Chưa xem</span>`}
      </td>
      <td class="px-3 py-2.5 text-xs whitespace-nowrap">
        ${g.confirmed
          ? `<span class="${g.confirmed.includes("Có") ? "text-green-600" : "text-red-500"}">${_esc(g.confirmed)}</span>`
          : `<span class="text-gray-400">—</span>`}
      </td>
      <td class="sticky right-0 bg-white py-2 px-3 border-l border-gray-100 text-center">
        <div class="flex items-center justify-center gap-1.5">
          ${g.link ? `
          <button type="button" data-link="${_esc(g.link)}" data-action="copy" title="Copy link"
            class="w-6 h-6 rounded-md border border-gray-200 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors">
            <i data-lucide="copy" style="width:11px;height:11px"></i>
          </button>
          <button type="button" data-link="${_esc(g.link)}" data-action="messenger" title="Gửi Messenger"
            class="w-6 h-6 rounded-md flex items-center justify-center bg-[#0084FF] hover:bg-[#0070D8] transition-colors">
            <svg style="width:11px;height:11px;fill:white" viewBox="0 0 24 24"><path d="M12 0C5.373 0 0 4.975 0 11.111c0 3.497 1.745 6.616 4.472 8.652V24l4.086-2.242c1.09.301 2.246.464 3.442.464 6.627 0 12-4.975 12-11.111S18.627 0 12 0zm1.193 14.963L10.1 11.625l-6.112 3.338 6.724-7.143 3.093 3.338 6.112-3.338-6.724 7.143z"/></svg>
          </button>` : ""}
          <button type="button" data-guest-id="${_esc(g.id)}" data-side="${side}" data-action="menu"
            class="w-6 h-6 rounded-md border border-gray-200 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors">
            <i data-lucide="more-vertical" style="width:11px;height:11px"></i>
          </button>
        </div>
      </td>
    </tr>`).join("");

  const from = (cur - 1) * PAGE_SIZE + 1;
  const to   = Math.min(cur * PAGE_SIZE, guests.length);

  const pagination = `
    <div class="flex items-center justify-between mt-3 pt-2.5 border-t border-gray-100">
      <p class="text-xs text-gray-400">${from}–${to} / <span class="font-medium text-gray-600">${guests.length}</span> khách</p>
      <div class="flex items-center gap-1">
        <button type="button" onclick="goToPage('${side}', ${cur - 1})"
          ${cur === 1 ? "disabled" : ""}
          class="w-7 h-7 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors">
          <i data-lucide="chevron-left" style="width:13px;height:13px"></i>
        </button>
        ${_buildPageBtns(side, cur, totalPages)}
        <button type="button" onclick="goToPage('${side}', ${cur + 1})"
          ${cur === totalPages ? "disabled" : ""}
          class="w-7 h-7 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors">
          <i data-lucide="chevron-right" style="width:13px;height:13px"></i>
        </button>
      </div>
    </div>`;

  container.innerHTML = `
    <div class="overflow-x-auto rounded-lg border border-gray-200">
      <table class="w-full min-w-[660px]">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 w-36 min-w-[144px]">Tên</th>
            <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 w-20 min-w-[80px]">Xưng hô</th>
            <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 w-56 min-w-[224px]">Link cá nhân</th>
            <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 w-24 min-w-[96px]">Trạng thái</th>
            <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 w-24 min-w-[96px]">Xác nhận</th>
            <th class="sticky right-0 bg-gray-50 py-2 px-3 border-l border-gray-100 text-center text-xs font-medium text-gray-500 w-24 min-w-[96px]">Action</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    ${pagination}`;

  lucide.createIcons();
}

function shareViaMessenger(link) {
  const url = `fb-messenger://share/?link=${encodeURIComponent(link)}`;
  const web = `https://www.facebook.com/dialog/send?link=${encodeURIComponent(link)}&app_id=966242223397117&redirect_uri=${encodeURIComponent(window.location.href)}`;
  const a = document.createElement("a");
  a.href = url;
  a.click();
  // Fallback web nếu không mở được app
  setTimeout(() => window.open(web, "_blank"), 1000);
}

function copyGuestLink(link) {
  navigator.clipboard.writeText(link).then(() => showToast("✅ Đã copy link"));
}

// ─── Row Menu (3 chấm) ────────────────────────────────────────────────────────

let _rowMenu = null;

function _ensureRowMenu() {
  if (_rowMenu) return _rowMenu;
  _rowMenu = document.createElement("div");
  _rowMenu.id = "row-menu";
  _rowMenu.className = "hidden fixed z-[9999] bg-white rounded-xl shadow-lg border border-gray-100 py-1 min-w-[120px]";
  _rowMenu.innerHTML = `
    <button type="button" id="row-menu-edit"
      class="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors">
      <i data-lucide="pencil" style="width:13px;height:13px"></i> Sửa
    </button>
    <button type="button" id="row-menu-delete"
      class="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-red-500 hover:bg-red-50 transition-colors">
      <i data-lucide="trash-2" style="width:13px;height:13px"></i> Xóa
    </button>`;
  document.body.appendChild(_rowMenu);
  document.addEventListener("click", (e) => {
    if (!_rowMenu.contains(e.target)) _closeRowMenu();
  });
  return _rowMenu;
}

function _openRowMenu(triggerEl, guestId, side) {
  const menu = _ensureRowMenu();
  const guest = _allGuests[side]?.find(g => g.id === guestId);
  if (!guest) return;

  document.getElementById("row-menu-edit").onclick = () => { _closeRowMenu(); _openEditGuest(guest, side); };
  document.getElementById("row-menu-delete").onclick = () => { _closeRowMenu(); _deleteGuest(guest, side); };

  const rect = triggerEl.getBoundingClientRect();
  const menuW = 130;
  let left = rect.right - menuW;
  let top  = rect.bottom + 4;
  if (left < 8) left = 8;
  if (top + 80 > window.innerHeight) top = rect.top - 84;

  menu.style.left = `${left}px`;
  menu.style.top  = `${top}px`;
  menu.classList.remove("hidden");
  lucide.createIcons();
}

function _closeRowMenu() {
  _rowMenu?.classList.add("hidden");
}

// ─── Edit Guest ───────────────────────────────────────────────────────────────

let _editGuestId = null;

function _openEditGuest(guest, side) {
  _editGuestId = guest.id;
  _addGuestSide = side;
  document.getElementById("add-guest-fullname").value    = guest.full_name || "";
  document.getElementById("add-guest-displayname").value = guest.display_name || "";
  document.getElementById("add-guest-relationship").value = guest.relationship || "";
  // Đổi tiêu đề modal + nút confirm
  document.querySelector("#add-guest-modal h3").textContent = "Sửa khách mời";
  document.querySelector("#add-guest-modal button[onclick='confirmAddGuest()']").textContent = "Lưu thay đổi";
  document.querySelector("#add-guest-modal button[onclick='confirmAddGuest()']").setAttribute("onclick", "confirmEditGuest()");
  const modal = document.getElementById("add-guest-modal");
  modal.classList.remove("hidden");
  modal.classList.add("flex");
}

async function confirmEditGuest() {
  const full_name = document.getElementById("add-guest-fullname").value.trim();
  if (!full_name) { showToast("⚠️ Vui lòng nhập họ và tên"); return; }

  closeAddGuestModal();
  // Reset modal về trạng thái thêm mới
  document.querySelector("#add-guest-modal h3").textContent = "Thêm 1 khách mời";
  const btn = document.querySelector("#add-guest-modal button[onclick='confirmEditGuest()']");
  if (btn) { btn.textContent = "Thêm khách"; btn.setAttribute("onclick", "confirmAddGuest()"); }

  showLoading(true, "Đang cập nhật...");
  try {
    await guestDAL.updateGuest(_editGuestId, {
      full_name,
      display_name: document.getElementById("add-guest-displayname").value.trim(),
      relationship: document.getElementById("add-guest-relationship").value.trim(),
    });
    showToast("✅ Đã cập nhật khách mời");
    await loadGuestList(_addGuestSide);
  } catch (err) {
    showToast("❌ Cập nhật thất bại: " + err.message);
  } finally {
    showLoading(false);
    _editGuestId = null;
  }
}

// ─── Delete Guest ─────────────────────────────────────────────────────────────

async function _deleteGuest(guest, side) {
  if (!confirm(`Xóa khách "${guest.full_name}"?`)) return;
  showLoading(true, "Đang xóa...");
  try {
    await guestDAL.deleteGuestsByIds([guest.id]);
    showToast("✅ Đã xóa khách mời");
    await loadGuestList(side);
  } catch (err) {
    showToast("❌ Xóa thất bại: " + err.message);
  } finally {
    showLoading(false);
  }
}

function _fmtDate(dateStr) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleString("vi-VN", {
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit"
  });
}
