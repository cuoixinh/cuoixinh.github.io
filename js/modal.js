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
      <i data-lucide="triangle-alert" style="width:16px;height:16px"></i>
      <p class="text-lg font-semibold mb-2">Không thể tải preview</p>
      <x-button variant="outline" tone="neutral" onclick="closePreview()">Đóng</x-button>
    </div>
  `;
  window.lucide?.createIcons({ root: modalBody });
}

function chooseFromModal() {
  if (currentTemplateId) {
    closePreview();
    createDraft(currentTemplateId);
  }
}

// Tạo nháp / hỏi tiếp tục nháp cũ: dùng chung với navbar bản xem thử qua
// core/helpers/draft-start.js (cxStartDraft) — đừng viết lại ở đây, hai nơi lệch
// nhau là khách gặp hai kiểu hỏi khác nhau cho cùng một việc.
// opts.chosen = false khi mẫu do code chọn hộ (nút "Tạo thiệp ngay" ở hero) —
// hộp thoại sẽ không nhắc tên mẫu sắp dùng, vì khách chưa hề chọn mẫu nào.
function createDraft(templateId, opts) {
  const template = templates.find((t) => t.id === templateId);
  if (!template) return;
  cxStartDraft(template.theme, template.name, opts);
}

