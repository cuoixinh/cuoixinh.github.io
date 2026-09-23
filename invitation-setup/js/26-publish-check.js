// Popup "Kiểm tra thông tin" hiện trước lần xuất bản đầu: liệt kê các bước của form
// (lấy thẳng từ _cxSteps()/_cxStepState() ở 20-steps.js nên khớp với thanh bước),
// kèm vòng tiến độ. Chỉ nhắc, không chặn — ô [required] đã do validateForm chặn trước.
// Bấm một mục → đóng popup, nhảy tới bước đó ở tab Chỉnh sửa.

// Bước "bắt buộc" = panel có ô [required]; đọc từ DOM để không khai lặp danh sách.
function _pcIsRequired(step) {
  return !!document.querySelector(
    `#wedding-form [data-step="${step.id}"] [required]`,
  );
}

const _PC_STATE = {
  done: {
    wrap: "bg-emerald-50 text-emerald-600",
    icon: "check",
    text: "text-gray-800",
    note: "",
  },
  partial: {
    wrap: "bg-amber-50 text-amber-500",
    icon: "alert-triangle",
    text: "text-gray-700",
    note: "Còn thiếu thông tin",
  },
  empty: {
    wrap: "bg-gray-100 text-gray-400",
    icon: "circle",
    text: "text-gray-500",
    note: "Chưa điền",
  },
};

function _pcItemHTML(step, state) {
  const s = _PC_STATE[state] || _PC_STATE.empty;
  const note = s.note
    ? `<span class="block text-[11px] font-normal text-gray-400">${s.note}</span>`
    : "";
  return (
    `<button type="button" data-pc-step="${step.id}" class="group flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-rose-50">` +
    `<span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${s.wrap}"><i data-lucide="${s.icon}" style="width:16px;height:16px"></i></span>` +
    `<span class="min-w-0 flex-1 text-sm font-medium ${s.text}">${_cxEsc(step.label)}${note}</span>` +
    `<i data-lucide="chevron-right" class="shrink-0 text-gray-300 group-hover:text-rose-400" style="width:16px;height:16px"></i>` +
    `</button>`
  );
}

function _pcGroupHTML(title, rows) {
  if (!rows.length) return "";
  return (
    `<div class="mt-3 first:mt-0">` +
    `<div class="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">${title}</div>` +
    rows.join("") +
    `</div>`
  );
}

// Vòng tiến độ: chu vi r=26 ≈ 163.4; dashoffset tính theo phần trăm.
function _pcRingHTML(pct) {
  const C = 2 * Math.PI * 26;
  const color = pct === 100 ? "text-emerald-500" : "text-rose-500";
  return (
    `<div class="relative mx-auto mt-3 h-16 w-16">` +
    `<svg viewBox="0 0 64 64" class="h-16 w-16 -rotate-90">` +
    `<circle cx="32" cy="32" r="26" fill="none" stroke-width="6" class="stroke-current text-gray-100"></circle>` +
    `<circle cx="32" cy="32" r="26" fill="none" stroke-width="6" stroke-linecap="round" class="stroke-current ${color}"` +
    ` stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${(C * (1 - pct / 100)).toFixed(1)}"></circle>` +
    `</svg>` +
    `<span class="absolute inset-0 flex items-center justify-center text-sm font-bold text-gray-800">${pct}%</span>` +
    `</div>`
  );
}

/**
 * Mở popup kiểm tra. onConfirm chạy khi bấm "Xuất bản"/"Vẫn xuất bản";
 * loggedIn = false thì thêm dòng nhắc sẽ phải đăng nhập.
 */
function cxOpenPublishCheck({ onConfirm, loggedIn = true } = {}) {
  document.getElementById("publish-check-modal")?.remove();

  // Bước đang tắt công tắc là chủ ý bỏ mục đó khỏi thiệp → không tính.
  const items = _cxSteps()
    .map((step) => ({ step, state: _cxStepState(step) }))
    .filter((it) => it.state !== "off");
  const done = items.filter((it) => it.state === "done").length;
  const total = items.length;
  const pct = total ? Math.round((done / total) * 100) : 100;
  const all = done === total;

  const req = items.filter((it) => _pcIsRequired(it.step));
  const opt = items.filter((it) => !_pcIsRequired(it.step));
  const row = (it) => _pcItemHTML(it.step, it.state);

  const loginNote = loggedIn
    ? ""
    : `<div class="flex gap-2 border-t border-gray-100 bg-sky-50 px-5 py-3 text-xs leading-relaxed text-sky-800">` +
      `<i data-lucide="info" class="mt-0.5 shrink-0" style="width:16px;height:16px"></i>` +
      `<span>Thiệp hiện chỉ lưu trên thiết bị này. Bạn sẽ được yêu cầu đăng nhập khi xuất bản để truy cập từ mọi nơi và tránh mất dữ liệu.</span>` +
      `</div>`;

  const modal = document.createElement("div");
  modal.id = "publish-check-modal";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-labelledby", "pc-title");
  // Điện thoại: tấm trượt từ đáy lên; từ sm: hộp giữa màn.
  modal.className =
    "fixed inset-0 z-[300] flex items-end justify-center bg-black/40 opacity-0 transition-opacity duration-200 sm:items-center sm:p-4";
  modal.innerHTML =
    `<div data-pc-card class="flex max-h-[92dvh] w-full max-w-md translate-y-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl transition-transform duration-300 ease-out sm:translate-y-4 sm:rounded-3xl">` +
    `<div class="relative shrink-0 border-b border-gray-100 px-5 pb-4 pt-5 text-center">` +
    `<span class="absolute right-3 top-3"><x-button variant="ghost" tone="neutral" size="sm" icon-only data-pc-close aria-label="Đóng"><i data-lucide="x" style="width:18px;height:18px"></i></x-button></span>` +
    `<div class="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-500"><i data-lucide="clipboard-list" style="width:24px;height:24px"></i></div>` +
    `<h2 id="pc-title" class="mt-3 text-lg font-bold text-gray-800">Kiểm tra thông tin</h2>` +
    `<p class="mt-0.5 text-xs text-gray-500">${done}/${total} mục đã hoàn thành</p>` +
    _pcRingHTML(pct) +
    `</div>` +
    `<div class="min-h-0 flex-1 overflow-y-auto px-3 py-3">` +
    _pcGroupHTML("Bắt buộc", req.map(row)) +
    _pcGroupHTML("Tùy chọn", opt.map(row)) +
    `</div>` +
    loginNote +
    `<div class="flex shrink-0 gap-2 border-t border-gray-100 px-5 py-4" style="padding-bottom:max(16px,env(safe-area-inset-bottom))">` +
    `<x-button variant="ghost" tone="neutral" size="lg" class="flex-1" data-pc-close>Quay lại</x-button>` +
    `<x-button variant="fill" tone="brand" size="lg" class="flex-[1.4]" data-pc-ok>${all ? "Xuất bản" : "Vẫn xuất bản"}</x-button>` +
    `</div>` +
    `</div>`;

  const card = modal.querySelector("[data-pc-card]");
  const close = () => {
    document.removeEventListener("keydown", onKey, true);
    modal.remove();
  };
  const onKey = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  };

  modal.addEventListener("click", (e) => {
    if (e.target === modal || e.target.closest("[data-pc-close]")) return close();
    if (e.target.closest("[data-pc-ok]")) {
      close();
      onConfirm?.();
      return;
    }
    const go = e.target.closest("[data-pc-step]");
    if (go) {
      close();
      switchTab("edit");
      cxGoStep(go.getAttribute("data-pc-step"));
    }
  });

  document.body.appendChild(modal);
  document.addEventListener("keydown", onKey, true);
  window.lucide?.createIcons({ root: modal });
  // Khung đầu vẽ ở trạng thái ẩn, khung sau mới bỏ lớp → chạy transition.
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      modal.classList.remove("opacity-0");
      card.classList.remove("translate-y-full", "sm:translate-y-4");
    }),
  );
}
window.cxOpenPublishCheck = cxOpenPublishCheck;
