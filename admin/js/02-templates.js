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
    btn.innerHTML = '<i data-lucide="loader-circle" class="animate-spin" style="width:16px;height:16px"></i> Đang xóa...';
    window.lucide?.createIcons({ root: btn });

    const response = await fetch(CONFIG.cloudflare.templatesCache + "/purge", {
      method: "POST",
      headers: {
        "X-Purge-Secret": CONFIG.cloudflare.purgeSecret,
        "Content-Type": "application/json",
      },
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      alert("❌ Lỗi: " + (result.error || "Không thể xóa cache"));
      return;
    }

    // Báo đúng số key xoá được, đừng nói suông "thành công": worker vẫn trả
    // success khi không xoá được gì (Cache API riêng từng colo, và trên
    // *.workers.dev thì nó không lưu gì cả) — nuốt con số này đi là lần sau
    // cache cũ lại bị đổ oan cho nút bấm.
    // Purge chỉ dọn phía edge; bản nhớ trong RAM và HTTP cache của chính máy
    // này vẫn là bản cũ → ép lấy lại luôn, không admin sửa xong vẫn thấy cũ.
    window.templatesDAL?.refresh().catch(() => {});

    const n = result.deletedCount ?? 0;
    alert(
      (n > 0
        ? `✅ Đã xóa ${n} bản cache ở edge.`
        : "ℹ️ Edge không có bản cache nào để xóa (bình thường với *.workers.dev).") +
        "\n\nCache trên trình duyệt khách KHÔNG xóa từ xa được — đổi template sẽ" +
        " tự lan tới mọi khách trong vòng 5 phút. Muốn thấy ngay trên máy này thì" +
        " Ctrl+F5 (hoặc tick Disable cache trong DevTools).",
    );
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
          <x-button variant="ghost" onclick="editTemplate('${t.id}')" title="Sửa" class="text-blue-600">✏️</x-button>
          <x-button variant="ghost" tone="danger" onclick="deleteTemplate('${t.id}', '${t.display_name}')" title="Xóa">🗑️</x-button>
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

// Gán giá trị cho ô bọc trong <x-input>/<x-textarea>: nút "x" xoá nhanh của
// chúng chỉ tự cập nhật khi người dùng gõ, gán bằng code phải gọi syncClearBtn.
function setTemplateField(id, value) {
  const el = document.getElementById(id);
  el.value = value ?? "";
  el.closest("x-input, x-textarea")?.syncClearBtn?.();
}

function clearTemplateForm() {
  setTemplateField("template-name", "");
  setTemplateField("template-display-name", "");
  setTemplateField("template-description", "");
  setTemplateField("template-preview-url", "");
  document.getElementById("template-category").value = "traditional";
  document.getElementById("template-status").value = "active";
  document.getElementById("template-sort-order").value = "0";
  document.getElementById("template-is-active").checked = true;
}

// Auto-fill preview URL khi đổi template name. Không dùng DOMContentLoaded:
// file này chỉ chạy sau khi loader.js đã chèn xong partial templates-panel.html
// nên #template-name đã tồn tại, và lúc đó DOMContentLoaded của trang thường
// đã bắn xong từ lâu (script được loader chèn bằng createElement rất muộn).
// Mỗi mẫu là một THƯ MỤC public/themes/<tên>/ (index.html + index.js +
// theme.css) nên đường dẫn kết thúc bằng "/", không phải "<tên>.html".
function templatePreviewUrl(templateName) {
  const name = (templateName || "").trim();
  return name ? `/public/themes/${name}/?preview=true` : null;
}

const templateNameInput = document.getElementById("template-name");
const previewUrlInput = document.getElementById("template-preview-url");
templateNameInput.addEventListener("input", (e) => {
  previewUrlInput.value = templatePreviewUrl(e.target.value) || "";
  previewUrlInput.closest("x-input")?.syncClearBtn?.();
});

// Nhờ AI điền TRỌN form từ vài chữ ý tưởng. Chỉ gửi Template Name + mô tả thô
// admin đang gõ; phần ví dụ (5 mẫu mới nhất) do Edge Function tự lấy từ DB và
// ghép vào prompt — xem resource=template-ai ở wedding-admin.
// Hai ngoại lệ không đè: Template Name đã gõ (là tên thư mục có thật) và, khi
// đang SỬA mẫu cũ, nhóm thứ tự / trạng thái / kích hoạt.
async function suggestTemplateMeta() {
  const themeName = document.getElementById("template-name").value.trim();
  const descEl = document.getElementById("template-description");
  const hint = descEl.value.trim();

  if (!themeName && !hint) {
    showToast("Nhập Template Name hoặc vài chữ mô tả để AI có gì mà dựa vào", "error");
    return;
  }

  const btn = document.getElementById("template-ai-btn");
  btn.disabled = true;
  descEl.closest("x-textarea")?.setLoading(true);

  try {
    const res = await fetch(`${EDGE_URL}?resource=template-ai`, {
      method: "POST",
      headers: adminHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ template_name: themeName, description: hint }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Không gọi được AI");

    // Ghi đè các ô chữ — admin bấm nút này là muốn bản gợi ý, chữ cũ đã nằm
    // trong prompt nên ý không mất.
    if (data.display_name) setTemplateField("template-display-name", data.display_name);
    if (data.description) setTemplateField("template-description", data.description);
    if (data.category) document.getElementById("template-category").value = data.category;

    // template_name chỉ nhận khi ô đang trống: nó là tên thư mục
    // public/themes/<tên>/ có thật, admin gõ rồi thì không được đổi.
    if (!themeName && data.template_name) {
      setTemplateField("template-name", data.template_name);
      setTemplateField(
        "template-preview-url",
        templatePreviewUrl(data.template_name) || "",
      );
    }

    // Phần cơ học chỉ áp khi đang THÊM mẫu mới — lúc sửa mẫu cũ, đè thứ tự /
    // trạng thái là âm thầm bật lại một mẫu đã ngừng bán.
    if (!editingTemplateId) {
      document.getElementById("template-sort-order").value = data.sort_order ?? 0;
      document.getElementById("template-status").value = data.status || "active";
      document.getElementById("template-is-active").checked = data.is_active !== false;
    }

    showToast("AI đã điền xong, xem lại rồi Lưu", "success");
  } catch (e) {
    showToast(e.message, "error");
  } finally {
    descEl.closest("x-textarea")?.setLoading(false);
    btn.disabled = false;
  }
}

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

    setTemplateField("template-name", data.template_name);
    setTemplateField("template-display-name", data.display_name);
    setTemplateField("template-description", data.description);
    setTemplateField("template-preview-url", data.preview_url);

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

  const payload = {
    template_id: templateName, // Use template_name as template_id
    template_name: templateName,
    display_name: displayName,
    description:
      document.getElementById("template-description").value.trim() || null,
    thumbnail_url: null,
    // Suy thẳng từ template_name chứ không đọc ô hiển thị: ô đó chỉ để xem
    // trước (readonly, có nút xoá của <x-input>) nên không đáng tin làm nguồn.
    preview_url: templatePreviewUrl(templateName),
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

// Có giá trị khi modal đang ở nhánh "scan server chưa bật" và luồng lưu đang
// chờ người dùng quyết định. Đóng modal lúc đó = huỷ, chứ không phải chỉ tắt
// cửa sổ — nếu không luồng lưu sẽ treo mãi.
let scanHelpResolve = null;

function settleScanHelp(goOn) {
  if (!scanHelpResolve) return;
  const resolve = scanHelpResolve;
  scanHelpResolve = null;
  document.getElementById("scan-continue-btn").classList.add("hidden");
  document.getElementById("scan-dismiss-btn").textContent = "Đóng";
  resolve(goOn);
}

function closeScanModal() {
  const m = document.getElementById("modal-scan");
  m.classList.add("hidden");
  m.classList.remove("flex");
  settleScanHelp(false);
}

function scanHelpContinue() {
  const m = document.getElementById("modal-scan");
  m.classList.add("hidden");
  m.classList.remove("flex");
  settleScanHelp(true);
}

// Báo "scan server chưa bật" bằng CHÍNH modal Scan Image IFrame, cùng khung log
// đen, thay vì confirm() native lạc lõng. Trả về true nếu người dùng chọn đi
// tiếp (lưu nhưng bỏ scan), false nếu huỷ để đi bật server.
function showScanServerHelp() {
  return new Promise((resolve) => {
    scanHelpResolve = resolve;

    const m = document.getElementById("modal-scan");
    m.classList.remove("hidden");
    m.classList.add("flex");
    document.getElementById("scan-log").innerHTML = "";
    document.getElementById("scan-done-bar").classList.add("hidden");
    document.getElementById("scan-close-btn").style.cssText = "";
    document.getElementById("scan-continue-btn").classList.remove("hidden");
    document.getElementById("scan-dismiss-btn").textContent = "Huỷ";

    appendScanLog("❌ Scan server chưa chạy ở " + SCAN_SERVER, "text-red-400");
    appendScanLog(" ");
    appendScanLog("Mở terminal ở thư mục dự án và chạy:", "text-yellow-300");
    appendScanLog("    cd scripts && npm run server", "text-white font-bold");
    appendScanLog("Lần đầu chạy thì cài trước: cd scripts && npm install", "text-gray-300");
    appendScanLog(" ");
    appendScanLog("Bật xong thì bấm \"Huỷ\" rồi Lưu lại để có cả ảnh thumbnail.", "text-gray-300");
    appendScanLog("Hoặc \"Vẫn lưu, bỏ scan\" để ghi dữ liệu ngay, thumbnail giữ ảnh cũ.", "text-gray-300");
  });
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
  // Modal dùng chung với showScanServerHelp() — dọn lại footer về dạng scan.
  document.getElementById("scan-continue-btn").classList.add("hidden");
  document.getElementById("scan-dismiss-btn").textContent = "Đóng";

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
      // Mẫu khai CX_THEME.noScan bị loại khỏi cả tử lẫn mẫu số.
      const rs = (d.results || []).filter((r) => !r.skipped);
      const ok = rs.filter((r) => r.ok).length;
      const total = rs.length;
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

  // Nói ĐÚNG câu lệnh mà showScanServerHelp() nói — hai chỗ lệch nhau thì người
  // dùng gõ nhầm rồi tưởng server hỏng. scripts/ có package.json RIÊNG (puppeteer
  // nằm ở đó, không phải node_modules gốc) nên lần đầu phải cài trước.
  es.onerror = () => {
    appendScanLog("❌ Không kết nối được scan server ở " + SCAN_SERVER, "text-red-400");
    appendScanLog("Mở terminal ở thư mục dự án và chạy:", "text-yellow-300");
    appendScanLog("    cd scripts && npm run server", "text-white font-bold");
    appendScanLog("Lần đầu chạy thì cài trước: cd scripts && npm install", "text-gray-300");
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
