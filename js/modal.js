// ============= MODAL =============

let currentTemplateId = null;

function openPreview(templateId) {
  const template = templates.find((t) => t.id === templateId);
  if (!template) return;
  window.location.href = template.previewUrl;
}

function closePreview() {
  const modal = document.getElementById("previewModal");
  if (!modal) return;
  modal.classList.add("hidden");
  document.getElementById("preview-modal-body").innerHTML = "";
  document.body.style.overflow = "auto";
  currentTemplateId = null;
}

function showIframeError() {
  const modalBody = document.getElementById("preview-modal-body");
  if (!modalBody) return;
  modalBody.innerHTML = `
    <div class="iframe-error" style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center">
      <i class="fas fa-exclamation-triangle"></i>
      <p class="text-lg font-semibold mb-2">Không thể tải preview</p>
      <button onclick="closePreview()" class="btn-secondary">Đóng</button>
    </div>
  `;
}

function chooseFromModal() {
  if (currentTemplateId) {
    closePreview();
    createDraft(currentTemplateId);
  }
}

function _generateUUID() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function _doCreateDraft(template) {
  const manage_id = _generateUUID();
  try {
    localStorage.setItem(
      `cuoixinh_draft_${manage_id}`,
      JSON.stringify({ theme: template.theme, is_published: false, _localOnly: true }),
    );
  } catch (e) {}
  sessionStorage.setItem("draft_template_name", template.name);
  sessionStorage.setItem("draft_theme", template.theme);
  sessionStorage.setItem("show_tour", "1");
  window.location.href = `/invitation-setup/?id=${manage_id}`;
}

function _findExistingDraftWithTheme(theme) {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith("cuoixinh_draft_")) continue;
      const data = JSON.parse(localStorage.getItem(key) || "null");
      if (data && data.theme === theme) {
        return { id: key.replace("cuoixinh_draft_", ""), data };
      }
    }
  } catch (e) {}
  return null;
}

function _showDraftConflictModal(existingId, template) {
  const overlay = document.createElement("div");
  overlay.id = "draft-conflict-overlay";
  overlay.className = "fixed inset-0 z-[9999] flex items-center justify-center px-4";
  overlay.style.background = "rgba(0,0,0,0.45)";
  overlay.innerHTML = `
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" style="animation:scaleIn .18s ease">
      <div class="text-center mb-4">
        <div class="w-12 h-12 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-3">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
          </svg>
        </div>
        <h3 class="text-base font-semibold text-gray-800 mb-1">Bạn đang có thiệp chưa hoàn thành</h3>
        <p class="text-sm text-gray-500">Mẫu <strong class="text-gray-700">${template.name}</strong> đang được chỉnh sửa. Bạn muốn tiếp tục hay tạo mới?</p>
      </div>
      <div class="flex gap-3">
        <button id="_draft-new-btn" class="flex-1 h-11 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer">Tạo mới</button>
        <button id="_draft-continue-btn" class="flex-1 h-11 rounded-xl text-sm font-semibold text-white transition-colors cursor-pointer" style="background:rgb(244 63 94)">Tiếp tục</button>
      </div>
    </div>
    <style>#draft-conflict-overlay * { box-sizing: border-box; } @keyframes scaleIn { from { opacity:0; transform:scale(.92) } to { opacity:1; transform:scale(1) } }</style>
  `;

  document.body.appendChild(overlay);

  overlay.querySelector("#_draft-continue-btn").addEventListener("click", () => {
    sessionStorage.setItem("draft_template_name", template.name);
    sessionStorage.setItem("draft_theme", template.theme);
    window.location.href = `/invitation-setup/?id=${existingId}`;
  });

  overlay.querySelector("#_draft-new-btn").addEventListener("click", () => {
    overlay.remove();
    _doCreateDraft(template);
  });

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });
}

function createDraft(templateId) {
  const template = templates.find((t) => t.id === templateId);
  if (!template) return;

  const existing = _findExistingDraftWithTheme(template.theme);
  if (existing) {
    _showDraftConflictModal(existing.id, template);
    return;
  }

  _doCreateDraft(template);
}

