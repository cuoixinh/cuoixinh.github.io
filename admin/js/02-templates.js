// ============= TAB: Templates =============
let editingTemplateId = null;

async function purgeTemplatesCache() {
  const btn = document.getElementById("purge-cache-btn");
  const originalHTML = btn.innerHTML;

  if (!CONFIG.cloudflare.templatesCache) {
    alert(
      "⚠️ Cache proxy chưa được cấu hình (USE_CACHE = false trong core/config.js — đang ở chế độ test local). Tính năng này chỉ hoạt động ở production.",
    );
    return;
  }

  try {
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang xóa...';

    const response = await fetch(CONFIG.cloudflare.templatesCache + "/purge", {
      method: "POST",
      headers: {
        "X-Purge-Secret": CONFIG.cloudflare.purgeSecret,
        "Content-Type": "application/json",
      },
    });

    const result = await response.json();

    if (response.ok && result.success) {
      alert(
        "✅ Đã xóa cache thành công!\n\nTemplates mới sẽ được load trong lần truy cập tiếp theo.",
      );
    } else {
      alert("❌ Lỗi: " + (result.error || "Không thể xóa cache"));
    }
  } catch (error) {
    alert("❌ Lỗi kết nối: " + error.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalHTML;
  }
}

async function loadTemplates() {
  try {
    const res = await fetch(
      `${EDGE_URL}?resource=templates`,
      {
        headers: adminHeaders(),
      },
    );

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Lỗi tải templates");
    }

    const data = await res.json();
    renderTemplates(data);
  } catch (e) {
    document.getElementById("template-list").innerHTML =
      `<tr><td colspan="7" class="text-center py-8 text-red-500">${e.message}</td></tr>`;
  }
}

window.adminTemplates = [];

function renderTemplates(templates) {
  window.adminTemplates = templates || [];
  const tbody = document.getElementById("template-list");
  if (!templates || templates.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center py-8 text-gray-400">Chưa có template nào</td></tr>`;
    return;
  }

  tbody.innerHTML = templates
    .map(
      (t) => `
    <tr class="border-b border-gray-100 hover:bg-gray-50">
      <td class="py-3 px-4 w-10">
        <input type="checkbox" name="tpl-scan" value="${t.template_name}"
          onchange="updateScanBtn()"
          class="w-3.5 h-3.5 accent-violet-500 cursor-pointer" />
      </td>
      <td class="py-3 px-4 text-sm text-gray-800 font-medium">${t.display_name}</td>
      <td class="py-3 px-4 text-sm text-gray-600 font-mono">${t.template_name}</td>
      <td class="py-3 px-4 text-sm">
        <span class="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">${t.category || "-"}</span>
      </td>
      <td class="py-3 px-4 text-sm">
        <span class="px-2 py-1 ${getStatusColor(t.status)} rounded text-xs">${t.status}</span>
      </td>
      <td class="py-3 px-4 text-sm">
        <div class="w-2 h-2 rounded-full ${t.is_active ? "bg-green-500" : "bg-gray-400"}"></div>
      </td>
      <td class="py-3 px-4 text-sm text-gray-600">${t.sort_order}</td>
      <td class="py-3 px-4 text-sm">
        <div class="flex gap-2">
          <button onclick="editTemplate('${t.id}')" title="Sửa" class="text-blue-600 hover:text-blue-800">✏️</button>
          <button onclick="deleteTemplate('${t.id}', '${t.display_name}')" title="Xóa" class="text-red-600 hover:text-red-800">🗑️</button>
        </div>
      </td>
    </tr>`,
    )
    .join("");

  updateScanBtn();
}

function updateScanBtn() {
  const checked = document.querySelectorAll("input[name='tpl-scan']:checked").length;
  const btn = document.getElementById("scan-images-btn");
  if (btn) btn.disabled = checked === 0;

  // Sync "select all" header checkbox state
  const all = document.querySelectorAll("input[name='tpl-scan']").length;
  const allCb = document.getElementById("tpl-scan-all");
  if (allCb) {
    allCb.checked = all > 0 && checked === all;
    allCb.indeterminate = checked > 0 && checked < all;
  }
}

function getStatusColor(status) {
  switch (status) {
    case "active":
      return "bg-green-100 text-green-700";
    case "coming_soon":
      return "bg-yellow-100 text-yellow-700";
    case "inactive":
      return "bg-gray-100 text-gray-700";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

function openTemplateModal(templateId = null) {
  editingTemplateId = templateId;

  if (templateId) {
    // Edit mode - load template data
    document.getElementById("template-modal-title").textContent =
      "Sửa Template";
    loadTemplateData(templateId);
  } else {
    // Add mode - clear form
    document.getElementById("template-modal-title").textContent =
      "Thêm Template";
    clearTemplateForm();
  }

  document.getElementById("modal-template").classList.remove("hidden");
  document.getElementById("modal-template").classList.add("flex");
}

function closeTemplateModal() {
  editingTemplateId = null;
  document.getElementById("modal-template").classList.add("hidden");
  document.getElementById("modal-template").classList.remove("flex");
}

function clearTemplateForm() {
  document.getElementById("template-name").value = "";
  document.getElementById("template-display-name").value = "";
  document.getElementById("template-description").value = "";
  document.getElementById("template-preview-url").value = "";
  document
    .querySelectorAll(".feature-checkbox")
    .forEach((cb) => (cb.checked = false));
  document.getElementById("template-category").value = "traditional";
  document.getElementById("template-status").value = "active";
  document.getElementById("template-sort-order").value = "0";
  document.getElementById("template-is-active").checked = true;
}

// Auto-fill preview URL khi đổi template name. Không dùng DOMContentLoaded:
// file này chỉ chạy sau khi loader.js đã chèn xong partial templates-panel.html
// nên #template-name đã tồn tại, và lúc đó DOMContentLoaded của trang thường
// đã bắn xong từ lâu (script được loader chèn bằng createElement rất muộn).
const templateNameInput = document.getElementById("template-name");
const previewUrlInput = document.getElementById("template-preview-url");
templateNameInput.addEventListener("input", (e) => {
  const templateName = e.target.value.trim();
  if (templateName) {
    previewUrlInput.value = `public/themes/${templateName}.html?preview=true`;
  } else {
    previewUrlInput.value = "";
  }
});

async function loadTemplateData(templateId) {
  try {
    const res = await fetch(
      `${EDGE_URL}?resource=templates&id=${templateId}`,
      {
        headers: adminHeaders(),
      },
    );

    if (!res.ok) throw new Error("Lỗi tải template");

    const data = await res.json();

    document.getElementById("template-name").value = data.template_name || "";
    document.getElementById("template-display-name").value =
      data.display_name || "";
    document.getElementById("template-description").value =
      data.description || "";
    document.getElementById("template-preview-url").value =
      data.preview_url || "";

    // Set feature checkboxes
    const features = data.features || [];
    document.querySelectorAll(".feature-checkbox").forEach((cb) => {
      cb.checked = features.includes(cb.value);
    });

    document.getElementById("template-category").value =
      data.category || "traditional";
    document.getElementById("template-status").value = data.status || "active";
    document.getElementById("template-sort-order").value = data.sort_order || 0;
    document.getElementById("template-is-active").checked =
      data.is_active !== false;
  } catch (e) {
    alert("Lỗi tải dữ liệu template: " + e.message);
    closeTemplateModal();
  }
}

async function saveTemplate() {
  const templateName = document.getElementById("template-name").value.trim();
  const displayName = document
    .getElementById("template-display-name")
    .value.trim();

  if (!templateName || !displayName) {
    alert("Vui lòng điền đầy đủ các trường bắt buộc (*)");
    return;
  }

  // Get features from checkboxes
  const features = Array.from(
    document.querySelectorAll(".feature-checkbox:checked"),
  ).map((cb) => cb.value);

  const payload = {
    template_id: templateName, // Use template_name as template_id
    template_name: templateName,
    display_name: displayName,
    description:
      document.getElementById("template-description").value.trim() || null,
    thumbnail_url: null,
    preview_url:
      document.getElementById("template-preview-url").value.trim() || null,
    features: features,
    category: document.getElementById("template-category").value,
    status: document.getElementById("template-status").value,
    sort_order:
      parseInt(document.getElementById("template-sort-order").value) || 0,
    is_active: document.getElementById("template-is-active").checked,
  };

  try {
    let res;
    if (editingTemplateId) {
      // Update existing template
      res = await fetch(`${EDGE_URL}?resource=templates`, {
        method: "PATCH",
        headers: adminHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ id: editingTemplateId, ...payload }),
      });
    } else {
      // Insert new template
      res = await fetch(`${EDGE_URL}?resource=templates`, {
        method: "POST",
        headers: adminHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(payload),
      });
    }

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Lỗi lưu template");
    }

    alert(
      editingTemplateId
        ? "✅ Đã cập nhật template thành công!"
        : "✅ Đã thêm template thành công!",
    );

    closeTemplateModal();
    loadTemplates();

    // Suggest purging cache
    if (
      confirm(
        "Bạn có muốn xóa cache Cloudflare để cập nhật templates mới không?",
      )
    ) {
      purgeTemplatesCache();
    }
  } catch (e) {
    alert("❌ Lỗi: " + e.message);
  }
}

async function editTemplate(templateId) {
  openTemplateModal(templateId);
}

async function deleteTemplate(templateId, displayName) {
  if (
    !confirm(
      `Bạn có chắc muốn xóa template "${displayName}"?\n\nThao tác này không thể hoàn tác!`,
    )
  )
    return;

  try {
    const res = await fetch(
      `${EDGE_URL}?resource=templates&id=${templateId}`,
      {
        method: "DELETE",
        headers: adminHeaders(),
      },
    );

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Lỗi xóa template");
    }

    alert("✅ Đã xóa template thành công!");
    loadTemplates();

    // Suggest purging cache
    if (
      confirm(
        "Bạn có muốn xóa cache Cloudflare để cập nhật danh sách templates không?",
      )
    ) {
      purgeTemplatesCache();
    }
  } catch (e) {
    alert("❌ Lỗi xóa template: " + e.message);
  }
}

// ============= SCAN IMAGE IFRAME =============
const SCAN_SERVER = "http://127.0.0.1:3001";

function closeScanModal() {
  const m = document.getElementById("modal-scan");
  m.classList.add("hidden");
  m.classList.remove("flex");
}

// templateNames (tuỳ chọn): mảng tên template cần scan — dùng khi gọi tự động
// (vd sau khi lưu Ảnh mẫu cho 1 theme). Bỏ trống thì đọc từ checkbox đã tick
// trong bảng Templates (hành vi cũ, gọi từ nút "Scan Image IFrame").
function startScanImages(templateNames) {
  const selected =
    templateNames ||
    [...document.querySelectorAll("input[name='tpl-scan']:checked")].map((cb) => cb.value);
  if (!selected.length) {
    alert("Hãy tick chọn ít nhất một template trong danh sách.");
    return;
  }

  const m = document.getElementById("modal-scan");
  m.classList.remove("hidden");
  m.classList.add("flex");
  document.getElementById("scan-log").innerHTML = "";
  document.getElementById("scan-done-bar").classList.add("hidden");
  document.getElementById("scan-close-btn").style.cssText = "pointer-events:none;opacity:0.4";

  appendScanLog("⏳ Đang kết nối scan server...", "text-yellow-300");

  const es = new EventSource(`${SCAN_SERVER}/scan?templates=${encodeURIComponent(selected.join(","))}`);

  es.onmessage = (e) => {
    const d = JSON.parse(e.data);
    if (d.type === "start") {
      appendScanLog(d.message, "text-yellow-300");
    } else if (d.type === "progress") {
      const cls = d.message.startsWith("✅") ? "text-green-400"
                : d.message.startsWith("❌") ? "text-red-400"
                : d.message.startsWith("⚠️") ? "text-yellow-300"
                : "text-gray-300";
      appendScanLog(d.message, cls);
    } else if (d.type === "done") {
      appendScanLog(d.message, "text-green-300 font-bold");
      const ok = (d.results || []).filter((r) => r.ok).length;
      const total = (d.results || []).length;
      document.getElementById("scan-progress-fill").style.width = total ? `${(ok / total) * 100}%` : "100%";
      document.getElementById("scan-done-label").textContent = `${ok}/${total}`;
      document.getElementById("scan-done-bar").classList.remove("hidden");
      document.getElementById("scan-close-btn").style.cssText = "";
      es.close();
    } else if (d.type === "error") {
      appendScanLog("❌ " + d.message, "text-red-400");
      document.getElementById("scan-close-btn").style.cssText = "";
      es.close();
    }
  };

  es.onerror = () => {
    appendScanLog("❌ Không kết nối được scan server. Chạy: node scripts/server.js", "text-red-400");
    document.getElementById("scan-close-btn").style.cssText = "";
    es.close();
  };
}

function appendScanLog(msg, cls = "text-green-400") {
  const log = document.getElementById("scan-log");
  const line = document.createElement("div");
  line.className = cls;
  line.textContent = msg;
  log.appendChild(line);
  log.scrollTop = log.scrollHeight;
}
