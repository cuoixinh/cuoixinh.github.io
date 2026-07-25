// Landing Page JavaScript

const TEMPLATES_API_URL = CONFIG.cloudflare.templatesCache
  ? CONFIG.cloudflare.templatesCache + "/"
  : null;

let templates = [];
let carouselActiveIndex = 0;
let _cardW = 220; // chiều rộng card active hiện tại (px), cập nhật bởi sizeCarousel()

async function fetchTemplatesViaEdge() {
  const res = await fetch(`${CONFIG.supabase.edgeUrl}?resource=public-templates`, {
    headers: { Authorization: `Bearer ${CONFIG.supabase.anonKey}` },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function loadTemplates() {
  try {
    if (TEMPLATES_API_URL) {
      const response = await fetch(TEMPLATES_API_URL);
      if (!response.ok) throw new Error("Failed to fetch templates");
      templates = await response.json();
    } else {
      templates = await fetchTemplatesViaEdge();
    }
    renderTemplateCards();
    initHeroImage();
    initializePage();
  } catch (error) {
    console.error("Failed to load templates:", error);
    const inner = document.getElementById("templateCarouselInner");
    if (inner) {
      inner.innerHTML = `
        <div class="text-center p-8" style="color: rgb(173 122 135);">
          <i class="fas fa-exclamation-triangle text-4xl mb-4" style="color: rgb(255 183 202);"></i>
          <p class="text-lg font-semibold mb-2">Không thể tải danh sách mẫu thiệp</p>
          <p class="text-sm opacity-70">Vui lòng thử lại sau hoặc liên hệ hỗ trợ</p>
        </div>
      `;
    }
  }
}

loadTemplates();

