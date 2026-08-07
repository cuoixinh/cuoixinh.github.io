// Popup đổi mẫu thiệp, khoá mục nâng cao và điểm khởi động (START).
//
// Tách từ index.js (dòng 4960–5117 bản gốc). Thứ tự nạp khai báo ở loader.js.

// ============= THEME PICKER =============

// Chuyển từ cụm expose ở 16-ceremony.js sang đây: hàm khai báo trong file này,
// mà function declaration chỉ hoist trong phạm vi một script.
window.openThemePicker = openThemePicker;

async function openThemePicker() {
  const sheet = openBottomSheet({
    id: "theme-picker-modal",
    title: "Chọn mẫu thiệp",
    height: "80vh",
  });
  if (!sheet) return;

  // Cho phép grid scroll trong body
  sheet.body.className = "flex-1 min-h-0 overflow-y-auto";
  sheet.body.innerHTML = `<div class="flex items-center justify-center py-10 text-gray-400 text-sm">Đang tải...</div>`;

  try {
    const res = await fetch(
      `${CONFIG.supabase.edgeUrl}?resource=public-templates`,
      {
        headers: { Authorization: `Bearer ${CONFIG.supabase.anonKey}` },
      },
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const rows = await res.json();

    sheet.body.innerHTML = `
      <div class="flex flex-col divide-y divide-gray-100">
        ${rows
          .map((t) => {
            const isCurrent = t.theme === WEDDING_THEME;
            const thumb =
              t.thumbnailUrl || `/assets/images/templates/${t.theme}.jpg`;
            return `
            <button type="button"
              ${isCurrent ? 'id="theme-picker-current"' : ""}
              onclick="_applyThemeChange('${t.theme}','${t.name}')"
              class="flex items-center gap-4 px-4 py-3 text-left transition-colors w-full ${isCurrent ? "bg-rose-50" : "hover:bg-gray-50"}">
              <img src="${thumb}" alt="${t.name}"
                class="w-16 h-24 rounded-xl object-cover object-top flex-shrink-0 border-2 ${isCurrent ? "border-rose-400" : "border-gray-200"}"
                loading="lazy" onerror="this.style.background='rgb(var(--gray-100-rgb))'" />
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium ${isCurrent ? "text-rose-600" : "text-gray-800"}">${t.name}</p>
                ${t.description ? `<p class="text-xs text-gray-400 mt-0.5 line-clamp-2">${t.description}</p>` : ""}
                <div class="flex items-center gap-1.5 mt-1">
                  <span class="text-xs font-semibold text-rose-500">${t.price.toLocaleString("vi-VN")}đ</span>
                  ${t.originalPrice > t.price ? `<span class="text-[11px] text-gray-400 line-through">${t.originalPrice.toLocaleString("vi-VN")}đ</span>` : ""}
                </div>
              </div>
              ${
                isCurrent
                  ? `<span class="flex-shrink-0 bg-rose-500 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">Đang dùng</span>`
                  : `<svg class="flex-shrink-0 w-4 h-4 text-gray-300" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>`
              }
            </button>`;
          })
          .join("")}
      </div>`;

    // Auto scroll đến mẫu đang dùng
    requestAnimationFrame(() => {
      const current = document.getElementById("theme-picker-current");
      if (current)
        current.scrollIntoView({ block: "center", behavior: "smooth" });
    });
  } catch {
    sheet.body.innerHTML = `<div class="text-center text-red-500 py-10 text-sm">Không thể tải danh sách mẫu. Vui lòng thử lại.</div>`;
  }
}

function closeThemePicker() {
  const el = document.getElementById("theme-picker-modal");
  if (el) el.remove();
}

function _updateHeaderThemeBadge(displayName) {
  // Thumbnail của mẫu đang dùng
  const thumb = document.getElementById("header-theme-thumb");
  if (thumb && WEDDING_THEME) {
    thumb.src = `../assets/images/templates/${WEDDING_THEME}.jpg`;
    thumb.style.display = "";
  }
  const el = document.getElementById("header-theme-name");
  if (!el) return;
  if (displayName) {
    el.textContent = displayName;
    return;
  }
  const stored = sessionStorage.getItem("draft_template_name");
  if (stored) {
    el.textContent = stored;
    return;
  }
  el.textContent = WEDDING_THEME.split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function _applyThemeChange(newTheme, displayName) {
  if (newTheme === WEDDING_THEME) {
    closeThemePicker();
    return;
  }
  WEDDING_THEME = newTheme;
  sessionStorage.setItem("draft_theme", newTheme);
  if (displayName) sessionStorage.setItem("draft_template_name", displayName);
  _updateHeaderThemeBadge(displayName);
  // Mẫu mới chỉ nằm trong bộ nhớ tới khi bấm Lưu → đánh dấu chưa lưu để nút Lưu
  // sáng lên và QR "xem trên điện thoại" báo đúng là đang lệch với bản trên hệ thống.
  _scheduleAutoSave("theme");
  if (_isPreviewActive) {
    _savePreviewData();
    const iframe = document.getElementById("preview-iframe");
    if (iframe) iframe.src = _previewIframeSrc();
  }
  closeThemePicker();
  showToast("Đã đổi mẫu thiệp", "success");
}
window._applyThemeChange = _applyThemeChange;

// ============= ADVANCED SECTION LOCK =============

function _syncAdvancedSection() {
  // Đã xuất bản NHƯNG phải còn đăng nhập (xem chú thích IS_PUBLISHED ở 01-state.js).
  // Đăng xuất rồi mở lại thiệp đã xuất bản thì quay về đúng bộ nút của khách chưa
  // đăng nhập: "Lưu nháp" + "Xuất bản" (bấm "Xuất bản" sẽ mở popup đăng nhập).
  const published = IS_PUBLISHED && IS_LOGIN;

  // Ẩn cả container nút "Lưu nháp" khi đã xuất bản → nhường không gian cho nút "Lưu & Xuất bản"
  const draftWrap = document.getElementById("tab-draft-wrap");
  if (draftWrap) draftWrap.classList.toggle("hidden", published);
  const draftTab = document.getElementById("tab-draft");
  if (draftTab) draftTab.classList.toggle("hidden", published);

  // Thiệp đã xuất bản: nút chính đóng vai trò "lưu lại" → đổi nhãn "Lưu & Xuất bản"
  const publishLabel = document.querySelector("#tab-publish span");
  if (publishLabel) {
    publishLabel.textContent = published ? "Lưu & Xuất bản" : "Xuất bản";
  }
  _updateDirtyMarks();

  // Tab Khách mời: vẫn bấm được, tooltip báo khi chưa xuất bản (không gắn badge trên navbar)
  const guestsTab = document.getElementById("tab-guests");
  if (guestsTab) {
    guestsTab.title = published
      ? ""
      : IS_PUBLISHED
        ? "Đăng nhập lại để quản lý khách mời"
        : "Cần xuất bản thiệp trước khi quản lý khách mời";
  }

  // Nếu panel khách mời đang mở → cập nhật lại lớp khoá/iframe ngay
  const guestsPanel = document.getElementById("guests-panel");
  if (guestsPanel && !guestsPanel.classList.contains("hidden")) {
    _updateGuestsPanelLock();
  }
  if (window.lucide) lucide.createIcons();
}

// ============= START =============

if (window.__cxOnReady) {
  window.__cxOnReady(initializePage);
} else if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializePage);
} else {
  initializePage();
}

