// ============= TAB: Thiệp Cưới (weddings) =============
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
  if (page < 1) return;
  currentPage = page;
  try {
    let url = `${EDGE_URL}?list=true&page=${page}&limit=10`;
    if (currentSearch) url += `&search=${encodeURIComponent(currentSearch)}`;
    const res = await fetch(url, {
      headers: adminHeaders(),
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
        <a href="${DOMAIN}/public/themes/${w.theme || 'basic-gold'}/?slug=${w.slug}" target="_blank" class="text-rose-500 hover:underline text-xs">${DOMAIN}/${w.slug}</a>
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
        <span class="inline-block px-2 py-0.5 rounded-full text-xs font-medium ${w.is_active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}">${w.is_active ? "Hoạt động" : "Tắt"}</span>
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
  navigator.clipboard.writeText(`${DOMAIN}/invitation-setup/?id=${id}`);
  alert("Đã copy link quản lý!");
}

async function toggleStatus(id, newStatus) {
  if (!confirm(`Bạn có chắc muốn ${newStatus ? "bật" : "tắt"} thiệp này?`))
    return;
  try {
    const res = await fetch(`${EDGE_URL}`, {
      method: "PATCH",
      headers: adminHeaders({ "Content-Type": "application/json" }),
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
    const res = await fetch(`${EDGE_URL}`, {
      method: "PATCH",
      headers: adminHeaders({ "Content-Type": "application/json" }),
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
    const res = await fetch(`${EDGE_URL}?id=${id}`, {
      method: "DELETE",
      headers: adminHeaders(),
    });
    if (!res.ok) throw new Error("Lỗi xóa thiệp");
    loadPage(currentPage);
  } catch (e) {
    alert(e.message);
  }
}

// ============= EVENT LISTENERS =============
document.getElementById("search-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter") searchWeddings();
});

// Cho phép tìm kiếm khi input thay đổi (kể cả lúc xóa hết)
document.getElementById("search-input").addEventListener("input", (e) => {
  if (e.target.value.trim() === "") {
    currentSearch = "";
  }
});
