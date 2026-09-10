// Landing Page JavaScript

let templates = [];

// Fetch có thể resolve ngay giữa hai thẻ <script>: lúc đó DOM chưa có mục
// #templates, mà initializePage() lại nằm ở file nạp SAU file này
// (page-setup.js) nên gọi thẳng còn ăn ReferenceError.
function whenReady(fn) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", fn, { once: true });
  } else {
    fn();
  }
}

// Trạng thái lỗi có nút thử lại: nguồn hỏng thường chỉ chập chờn (hoặc bị chặn
// ở phía khách), bấm lại là qua — đỡ phải tải lại cả trang. Mục #templates
// `hidden` sẵn từ HTML nên phải mở ra thì mới thấy chỗ báo lỗi.
function showTemplatesError() {
  const row = document.getElementById("templatesRow");
  const section = document.getElementById("templates");
  if (!row || !section) return;
  section.hidden = false;
  row.innerHTML = `
    <div class="w-full text-center p-8" style="color: rgb(var(--text-body-rgb));">
      <i data-lucide="triangle-alert" class="text-4xl mb-4" style="width:16px;height:16px;color: rgb(var(--brand-primary-rgb));"></i>
      <p class="text-lg font-semibold mb-2">Không thể tải danh sách mẫu thiệp</p>
      <p class="text-sm opacity-70 mb-4">Vui lòng thử lại sau hoặc liên hệ hỗ trợ</p>
      <x-button variant="outline" tone="brand" size="md" icon="refresh-cw" onclick="retryLoadTemplates()">Tải lại</x-button>
    </div>
  `;
  window.lucide?.createIcons({ root: row });
}

function retryLoadTemplates() {
  const row = document.getElementById("templatesRow");
  if (row) {
    row.innerHTML = `
      <div class="w-full text-center p-8 text-sm" style="color: rgb(var(--text-body-rgb));opacity:0.7;">Đang tải lại…</div>
    `;
  }
  loadTemplates();
}

async function loadTemplates() {
  try {
    // Nguồn + fallback nằm ở core/dal/templates-dal.js, dùng chung với mọi trang.
    templatesDAL.invalidate();
    templates = await templatesDAL.list();
  } catch (error) {
    // Chỉ bắt lỗi TẢI dữ liệu — lỗi khi dựng giao diện phải nổi lên console
    // chứ không được báo thành "không tải được mẫu".
    console.error("Failed to load templates:", error);
    whenReady(showTemplatesError);
    return;
  }
  // Bọc trong hàm mũi tên chứ KHÔNG truyền thẳng `initializePage`: nó khai ở
  // page-setup.js (nạp sau file này) nên đọc tên lúc này là ReferenceError.
  whenReady(() => initializePage());
}

loadTemplates();
