// ============= CONFIGURATION =============
const EDGE_URL = CONFIG.supabase.edgeUrl;
const ANON_KEY = CONFIG.supabase.anonKey;
const SUPABASE_URL = CONFIG.supabase.url;
const DOMAIN = window.location.origin;

// Initialize Supabase client
const supabaseClient = supabase.createClient(SUPABASE_URL, ANON_KEY);

let ADMIN_TOKEN = sessionStorage.getItem("admin_token");
if (!ADMIN_TOKEN) {
  ADMIN_TOKEN = prompt("Nhập mã quản trị:");
  if (ADMIN_TOKEN) {
    sessionStorage.setItem("admin_token", ADMIN_TOKEN);
  } else {
    document.body.innerHTML =
      '<p style="text-align:center;margin-top:40px;color:#999">Không có quyền truy cập</p>';
  }
}

// ============= TAB SWITCHING =============
function switchTab(tabName) {
  // Update tab buttons
  document.querySelectorAll(".tab-button").forEach((btn) => {
    btn.classList.remove("active");
  });
  document.getElementById(`tab-${tabName}`).classList.add("active");

  // Update tab content
  document.querySelectorAll(".tab-content").forEach((content) => {
    content.classList.remove("active");
  });
  document.getElementById(`content-${tabName}`).classList.add("active");

  // Load data for the active tab
  if (tabName === "weddings") {
    loadPage(1);
  } else if (tabName === "templates") {
    loadTemplates();
  }
}

// ============= WEDDINGS TAB =============
let currentPage = 1;
let totalPages = 1;
let currentSearch = "";
let editingId = null;

function searchWeddings() {
  const searchValue = document.getElementById("search-input").value.trim();
  currentSearch = searchValue;
  loadPage(1);
}

function clearSearch() {
  document.getElementById("search-input").value = "";
  currentSearch = "";
  loadPage(1);
}

async function loadPage(page) {
  if (page < 1 || (totalPages > 0 && page > totalPages)) return;
  currentPage = page;
  try {
    let url = `${EDGE_URL}?list=true&page=${page}&limit=10&token=${ADMIN_TOKEN}`;
    if (currentSearch) url += `&search=${encodeURIComponent(currentSearch)}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${ANON_KEY}` },
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || "Lỗi tải danh sách");
    renderList(result.data);
    updatePagination(result.pagination);
  } catch (e) {
    document.getElementById("wedding-list").innerHTML =
      `<tr><td colspan="9" class="text-center py-8 text-red-500">${e.message}</td></tr>`;
  }
}

function renderList(weddings) {
  const tbody = document.getElementById("wedding-list");
  if (!weddings || weddings.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="text-center py-8 text-gray-400">Chưa có thiệp nào</td></tr>`;
    return;
  }
  tbody.innerHTML = weddings
    .map(
      (w) => `
    <tr class="border-b border-gray-100 hover:bg-gray-50">
      <td class="py-3 px-4 text-sm text-gray-700 font-mono">${w.slug || "-"}</td>
      <td class="py-3 px-4 text-sm">
        <a href="${DOMAIN}/public/themes/template1.html?slug=${w.slug}" target="_blank" class="text-rose-500 hover:underline text-xs">${DOMAIN}/${w.slug}</a>
      </td>
      <td class="py-3 px-4 text-sm">
        <button onclick="copyManageLink('${w.id}')" class="text-blue-600 hover:underline text-xs">📋 Copy link</button>
      </td>
      <td class="py-3 px-4 text-sm text-gray-700">${w.groom_name || "-"}</td>
      <td class="py-3 px-4 text-sm text-gray-700">${w.bride_name || "-"}</td>
      <td class="py-3 px-4 text-sm">
        <span class="text-xs font-mono ${w.payment_order_id ? "text-blue-600" : "text-gray-400"}">${w.payment_order_id || "-"}</span>
      </td>
      <td class="py-3 px-4 text-sm">
        <span class="status-badge ${w.is_active ? "status-active" : "status-inactive"}">${w.is_active ? "Hoạt động" : "Tắt"}</span>
      </td>
      <td class="py-3 px-4 text-sm text-gray-500">${formatDate(w.created_at)}</td>
      <td class="py-3 px-4 text-sm">
        <div class="flex gap-2">
          <button onclick="toggleStatus('${w.id}', ${!w.is_active})" title="${w.is_active ? "Tắt" : "Bật"}">${w.is_active ? "🔒" : "🔓"}</button>
          <button onclick="openEditModal('${w.id}', '${w.slug}')" title="Sửa slug">✏️</button>
          <button onclick="deleteWedding('${w.id}', '${w.slug}')" title="Xóa">🗑️</button>
        </div>
      </td>
    </tr>`,
    )
    .join("");
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString("vi-VN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function updatePagination(pagination) {
  currentPage = pagination.page;
  totalPages = pagination.totalPages;
  document.getElementById("current-page").textContent = pagination.page;
  document.getElementById("total-pages").textContent = pagination.totalPages;
  document.getElementById("total-records").textContent = pagination.total;
  document.getElementById("btn-prev").disabled = pagination.page === 1;
  document.getElementById("btn-next").disabled =
    pagination.page === pagination.totalPages;
}

function copyManageLink(id) {
  navigator.clipboard.writeText(`${DOMAIN}/customer/manage.html?id=${id}`);
  alert("Đã copy link quản lý!");
}

async function toggleStatus(id, newStatus) {
  if (!confirm(`Bạn có chắc muốn ${newStatus ? "bật" : "tắt"} thiệp này?`))
    return;
  try {
    const res = await fetch(`${EDGE_URL}?token=${ADMIN_TOKEN}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ANON_KEY}`,
      },
      body: JSON.stringify({ id, is_active: newStatus }),
    });
    if (!res.ok) throw new Error("Lỗi cập nhật trạng thái");
    loadPage(currentPage);
  } catch (e) {
    alert(e.message);
  }
}

function openEditModal(id, slug) {
  editingId = id;
  document.getElementById("edit-slug-input").value = slug;
  document.getElementById("modal-edit").classList.remove("hidden");
  document.getElementById("modal-edit").classList.add("flex");
}

function closeModal() {
  editingId = null;
  document.getElementById("modal-edit").classList.add("hidden");
  document.getElementById("modal-edit").classList.remove("flex");
}

async function saveSlug() {
  const newSlug = document.getElementById("edit-slug-input").value.trim();
  if (!newSlug) {
    alert("Vui lòng nhập slug");
    return;
  }
  try {
    const res = await fetch(`${EDGE_URL}?token=${ADMIN_TOKEN}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ANON_KEY}`,
      },
      body: JSON.stringify({ id: editingId, slug: newSlug }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Lỗi cập nhật slug");
    closeModal();
    loadPage(currentPage);
  } catch (e) {
    alert(e.message);
  }
}

async function deleteWedding(id, slug) {
  if (
    !confirm(
      `Bạn có chắc muốn xóa thiệp "${slug}"?\n\nThao tác này không thể hoàn tác!`,
    )
  )
    return;
  try {
    const res = await fetch(`${EDGE_URL}?id=${id}&token=${ADMIN_TOKEN}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${ANON_KEY}` },
    });
    if (!res.ok) throw new Error("Lỗi xóa thiệp");
    loadPage(currentPage);
  } catch (e) {
    alert(e.message);
  }
}

async function purgeTemplatesCache() {
  const btn = document.getElementById("purge-cache-btn");
  const originalHTML = btn.innerHTML;

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

// ============= TEMPLATES TAB =============
let editingTemplateId = null;

async function loadTemplates() {
  try {
    const res = await fetch(
      `${EDGE_URL}?resource=templates&token=${ADMIN_TOKEN}`,
      {
        headers: { Authorization: `Bearer ${ANON_KEY}` },
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

function renderTemplates(templates) {
  const tbody = document.getElementById("template-list");
  if (!templates || templates.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center py-8 text-gray-400">Chưa có template nào</td></tr>`;
    return;
  }

  tbody.innerHTML = templates
    .map(
      (t) => `
    <tr class="border-b border-gray-100 hover:bg-gray-50">
      <td class="py-3 px-4 text-sm text-gray-800 font-medium">${t.display_name}</td>
      <td class="py-3 px-4 text-sm text-gray-600 font-mono">${t.template_name}</td>
      <td class="py-3 px-4 text-sm">
        <span class="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">${t.category || "-"}</span>
      </td>
      <td class="py-3 px-4 text-sm">
        <span class="px-2 py-1 ${getStatusColor(t.status)} rounded text-xs">${t.status}</span>
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

// Auto-fill preview URL when template name changes
document.addEventListener("DOMContentLoaded", () => {
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
});

async function loadTemplateData(templateId) {
  try {
    const res = await fetch(
      `${EDGE_URL}?resource=templates&id=${templateId}&token=${ADMIN_TOKEN}`,
      {
        headers: { Authorization: `Bearer ${ANON_KEY}` },
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
      res = await fetch(`${EDGE_URL}?resource=templates&token=${ADMIN_TOKEN}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ANON_KEY}`,
        },
        body: JSON.stringify({ id: editingTemplateId, ...payload }),
      });
    } else {
      // Insert new template
      res = await fetch(`${EDGE_URL}?resource=templates&token=${ADMIN_TOKEN}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ANON_KEY}`,
        },
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
      `${EDGE_URL}?resource=templates&id=${templateId}&token=${ADMIN_TOKEN}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${ANON_KEY}` },
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

// ============= EVENT LISTENERS =============
document.getElementById("search-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter") searchWeddings();
});

// Allow search when input changes (including when cleared)
document.getElementById("search-input").addEventListener("input", (e) => {
  if (e.target.value.trim() === "") {
    currentSearch = "";
  }
});

// ============= INITIALIZATION =============
// Load weddings by default
loadPage(1);
