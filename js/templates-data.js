// Landing Page JavaScript

const TEMPLATES_API_URL = CONFIG.cloudflare.templatesCache
  ? CONFIG.cloudflare.templatesCache + "/"
  : null;

let templates = [];
let carouselActiveIndex = 0;
// Khổ card active hiện tại (px) — sizeCarousel() cập nhật, applyCardTransform()
// đọc _cardW để đặt card kề bên; _cardH chỉ để so sánh xem có gì đổi không.
let _cardW = 220;
let _cardH = 420;

async function fetchTemplatesViaEdge() {
  const res = await fetch(`${CONFIG.supabase.edgeUrl}?resource=public-templates`, {
    headers: { Authorization: `Bearer ${CONFIG.supabase.anonKey}` },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function fetchTemplatesViaCache() {
  const res = await fetch(TEMPLATES_API_URL);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// Hai NGUỒN khác nhau cho cùng danh sách: Worker (có cache, nhanh) rồi Edge
// Function. Worker hỏng — Supabase chập chờn, worker lỗi, hoặc *.workers.dev bị
// chặn ở phía khách — thì gọi lại chính nó cũng hỏng y vậy, phải đổi nguồn.
async function fetchTemplates() {
  if (!TEMPLATES_API_URL) return fetchTemplatesViaEdge();
  try {
    return await fetchTemplatesViaCache();
  } catch (err) {
    console.warn("Templates cache lỗi, chuyển sang Edge Function:", err);
    return fetchTemplatesViaEdge();
  }
}

// Ba hàm này nằm ở file nạp SAU file này (render-templates.js, auth-nav.js,
// page-setup.js…). Fetch có thể resolve ngay giữa hai thẻ <script> nên phải đợi
// DOM sẵn sàng mới gọi, không thì ReferenceError.
function renderTemplatesWhenReady() {
  const run = () => {
    renderTemplateCards();
    initHeroImage();
    initializePage();
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run, { once: true });
  } else {
    run();
  }
}

// Trạng thái lỗi có nút thử lại: nguồn hỏng thường chỉ chập chờn (hoặc bị chặn
// ở phía khách), bấm lại là qua — đỡ phải tải lại cả trang.
function showTemplatesError(inner) {
  inner.innerHTML = `
    <div class="text-center p-8" style="color: rgb(var(--text-body-rgb));">
      <i data-lucide="triangle-alert" class="text-4xl mb-4" style="width:16px;height:16px;color: rgb(var(--brand-primary-rgb));"></i>
      <p class="text-lg font-semibold mb-2">Không thể tải danh sách mẫu thiệp</p>
      <p class="text-sm opacity-70 mb-4">Vui lòng thử lại sau hoặc liên hệ hỗ trợ</p>
      <x-button variant="outline" tone="brand" size="md" icon="refresh-cw" onclick="retryLoadTemplates()">Tải lại</x-button>
    </div>
  `;
  window.lucide?.createIcons({ root: inner });
}

function retryLoadTemplates() {
  const inner = document.getElementById("templateCarouselInner");
  if (inner) {
    inner.innerHTML = `
      <div class="text-center p-8 text-sm" style="color: rgb(var(--text-body-rgb));opacity:0.7;">Đang tải lại…</div>
    `;
  }
  loadTemplates();
}

async function loadTemplates() {
  try {
    templates = await fetchTemplates();
  } catch (error) {
    // Chỉ bắt lỗi TẢI dữ liệu — lỗi khi dựng giao diện phải nổi lên console
    // chứ không được báo thành "không tải được mẫu".
    console.error("Failed to load templates:", error);
    const inner = document.getElementById("templateCarouselInner");
    if (inner) showTemplatesError(inner);
    return;
  }
  renderTemplatesWhenReady();
}

loadTemplates();
