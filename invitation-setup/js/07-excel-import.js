// Nhập danh sách khách mời từ Excel: đọc file, map cột, xem trước.
//
// Tách từ index.js (dòng 1547–1850 bản gốc). Thứ tự nạp khai báo ở loader.js.

// ============= EXCEL IMPORT =============

let _importState = { headers: [], data: [], side: "" };

function downloadGuestTemplate() {
  if (typeof XLSX === "undefined") {
    showToast("Đang tải thư viện, thử lại sau", "warning");
    return;
  }
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
  const opts = headers
    .map(
      (h, i) => `<option value="${i}">${h || "(Cột " + (i + 1) + ")"}</option>`,
    )
    .join("");

  document.getElementById("map-full-name").innerHTML = opts;
  document.getElementById("map-display-name").innerHTML = noOpt + opts;
  document.getElementById("map-relationship").innerHTML = noOpt + opts;

  document.getElementById("map-full-name").value = mapping.full_name;
  document.getElementById("map-display-name").value = mapping.display_name;
  document.getElementById("map-relationship").value = mapping.relationship;

  _renderMappingPreview(headers, data.slice(0, 4));

  document.querySelector(
    "input[name='import-mode'][value='overwrite']",
  ).checked = true;

  const modal = document.getElementById("import-mapping-modal");
  modal.classList.remove("hidden");
  modal.classList.add("flex");
  if (window.lucide) lucide.createIcons();
}

function closeMappingModal() {
  const modal = document.getElementById("import-mapping-modal");
  modal.classList.add("hidden");
  modal.classList.remove("flex");
}

function _renderMappingPreview(headers, rows) {
  const th = headers
    .map(
      (h) =>
        `<th class="px-2 py-1.5 text-left text-xs font-medium text-gray-500 whitespace-nowrap">${h}</th>`,
    )
    .join("");
  const trs = rows
    .map(
      (row) =>
        `<tr class="border-t border-gray-100">${headers
          .map(
            (_, i) =>
              `<td class="px-2 py-1.5 text-xs text-gray-700 max-w-[100px] truncate">${row[i] ?? ""}</td>`,
          )
          .join("")}</tr>`,
    )
    .join("");
  document.getElementById("mapping-preview").innerHTML = `
    <div class="overflow-x-auto rounded-lg border border-gray-200">
      <table class="w-full text-left"><thead class="bg-gray-50"><tr>${th}</tr></thead><tbody>${trs}</tbody></table>
    </div>
    <p class="text-xs text-gray-400 mt-1">Hiển thị ${rows.length} dòng đầu</p>`;
}

async function confirmImport() {
  const colMapping = {
    full_name: parseInt(document.getElementById("map-full-name").value),
    display_name: parseInt(document.getElementById("map-display-name").value),
    relationship: parseInt(document.getElementById("map-relationship").value),
  };

  if (isNaN(colMapping.full_name) || colMapping.full_name < 0) {
    showToast("Vui lòng chọn cột Họ và tên", "warning");
    return;
  }

  const overwrite =
    document.querySelector("input[name='import-mode']:checked").value ===
    "overwrite";
  const { data, side } = _importState;

  closeMappingModal();
  showLoading(true, "Đang nhập khẩu...");

  try {
    const result = await guestBL.importGuests(
      WEDDING_ID,
      side,
      data,
      colMapping,
      overwrite,
    );
    const skipMsg =
      result.skipped > 0 ? `, bỏ qua ${result.skipped} trùng` : "";
    showToast(`Đã nhập ${result.inserted} khách${skipMsg}`, "success");
    await loadGuestList(side);
  } catch (err) {
    showToast("Nhập khẩu thất bại: " + err.message, "error");
  } finally {
    showLoading(false);
  }
}

async function loadGuestList(side) {
  if (!WEDDING_ID) return;
  try {
    const guests = await guestDAL.getGuests(WEDDING_ID, side);
    _renderGuestList(guests, side);
  } catch (err) {
    console.error("loadGuestList error:", err);
  }
}

function _renderGuestList(guests, side) {
  const container = document.getElementById(`guest-list-${side}`);
  if (!container) return;

  if (guests.length === 0) {
    container.innerHTML = `<p class="text-xs text-gray-400 text-center py-3">Chưa có khách mời nào</p>`;
    return;
  }

  const rows = guests
    .map(
      (g) => `
    <tr class="border-t border-gray-100 hover:bg-gray-50/50">
      <td class="px-3 py-2.5">
        <p class="text-xs font-medium text-gray-800 truncate max-w-[100px]">${g.full_name}</p>
        ${g.display_name ? `<p class="text-xs text-gray-400 truncate max-w-[100px]">${g.display_name}</p>` : ""}
      </td>
      <td class="px-3 py-2.5 text-xs text-gray-500 truncate max-w-[80px]">${g.relationship || "—"}</td>
      <td class="px-3 py-2.5 text-center">
        ${
          g.link
            ? `<x-button variant="ghost" icon-only type="button" onclick="copyGuestLink('${g.link}')">
               <i data-lucide="copy" style="width:14px;height:14px"></i>
             </x-button>`
            : `<span class="text-gray-300 text-xs">—</span>`
        }
      </td>
      <td class="px-3 py-2.5">
        ${
          g.viewed
            ? `<span class="inline-flex items-center gap-1 text-xs text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full whitespace-nowrap">✓ Đã xem</span>
             ${g.viewed_at ? `<p class="text-xs text-gray-400 mt-0.5 whitespace-nowrap">${_formatGuestDate(g.viewed_at)}</p>` : ""}`
            : `<span class="text-xs text-gray-400">Chưa xem</span>`
        }
      </td>
      <td class="px-3 py-2.5 text-xs whitespace-nowrap">
        ${
          g.confirmed
            ? `<span class="${g.confirmed.includes("Có") ? "text-green-600" : "text-red-500"}">${g.confirmed}</span>`
            : `<span class="text-gray-400">—</span>`
        }
      </td>
    </tr>`,
    )
    .join("");

  container.innerHTML = `
    <div class="overflow-x-auto rounded-lg border border-gray-200 -mx-0">
      <table class="w-full min-w-[440px]">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-3 py-2 text-left text-xs font-medium text-gray-500">Tên</th>
            <th class="px-3 py-2 text-left text-xs font-medium text-gray-500">Quan hệ</th>
            <th class="px-3 py-2 text-center text-xs font-medium text-gray-500">Link</th>
            <th class="px-3 py-2 text-left text-xs font-medium text-gray-500">Trạng thái</th>
            <th class="px-3 py-2 text-left text-xs font-medium text-gray-500">Xác nhận</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <p class="text-xs text-gray-400 text-right mt-1.5">${guests.length} khách</p>`;

  if (window.lucide) lucide.createIcons();
}

function copyGuestLink(link) {
  navigator.clipboard.writeText(link).then(() => showToast("Đã copy link", "success"));
}

function _formatGuestDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function switchGuestsTab(side) {
  const isGroom = side === "groom";
  document
    .getElementById("guests-panel-groom")
    .classList.toggle("hidden", !isGroom);
  document
    .getElementById("guests-panel-bride")
    .classList.toggle("hidden", isGroom);

  const ACTIVE = [
    "bg-rose-50",
    "text-rose-600",
    "border-b-2",
    "border-rose-400",
  ];
  const INACTIVE = ["text-gray-500", "hover:bg-gray-50", "hover:text-gray-700"];
  const tabGroom = document.getElementById("tab-guests-groom");
  const tabBride = document.getElementById("tab-guests-bride");

  if (isGroom) {
    tabGroom.classList.add(...ACTIVE);
    tabGroom.classList.remove(...INACTIVE);
    tabBride.classList.add(...INACTIVE);
    tabBride.classList.remove(...ACTIVE);
  } else {
    tabBride.classList.add(...ACTIVE);
    tabBride.classList.remove(...INACTIVE);
    tabGroom.classList.add(...INACTIVE);
    tabGroom.classList.remove(...ACTIVE);
  }
}

function generateQuickLink(side) {
  const name = document.getElementById(`quick-link-name-${side}`).value.trim();
  const rel = document.getElementById(`quick-link-rel-${side}`).value.trim();
  if (!name || !rel) {
    showToast("Vui lòng nhập tên và quan hệ khách", "error");
    return;
  }

  const slug =
    WEDDING_SLUG || (WEDDING_ID ? `wedding-${WEDDING_ID.slice(0, 8)}` : "");
  if (!slug) {
    showToast("Không xác định được thiệp, vui lòng tải lại trang", "error");
    return;
  }

  const encName = encryptData(name);
  const encRel = encryptData(rel);
  const base =
    side === "groom" ? `${DOMAIN}/${slug}?isGroom=true` : `${DOMAIN}/${slug}`;
  const link = `${base}&name=${encName}&relationship=${encRel}`;

  document.getElementById(`quick-link-output-${side}`).value = link;
  document
    .getElementById(`quick-link-result-${side}`)
    .classList.remove("hidden");
}

function shareViaMessenger(url, side) {
  if (!url) return;

  const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);

  if (isMobile) {
    window.location.href = `fb-messenger://share?link=${encodeURIComponent(url)}`;
    setTimeout(() => {
      if (!document.hidden && navigator.share) {
        navigator.share({ title: "Thiệp cưới", url }).catch(() => {});
      }
    }, 1500);
    return;
  }

  // Desktop: toggle share panel
  const panel = document.getElementById(`messenger-share-panel-${side}`);
  if (!panel) return;
  panel.classList.toggle("hidden");
  if (!panel.classList.contains("hidden")) lucide.createIcons();
}

function copyMessengerLink(side) {
  const link = document.getElementById(`quick-link-output-${side}`)?.value;
  if (!link) return;
  navigator.clipboard.writeText(link);
  showToast("Đã copy! Mở Messenger rồi dán link vào hộp chat", "default", "clipboard");
}

