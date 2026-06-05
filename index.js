// Landing Page JavaScript

const TEMPLATES_API_URL = CONFIG.cloudflare.templatesCache
  ? CONFIG.cloudflare.templatesCache + "/"
  : null;

let templates = [];
let carouselActiveIndex = 0;
let isSectionVisible = false;

async function fetchTemplatesDirect() {
  const base = CONFIG.supabase.url;
  const key = CONFIG.supabase.anonKey;
  const [tRes, pRes] = await Promise.all([
    fetch(
      `${base}/rest/v1/templates?select=*&is_active=eq.true&order=sort_order.asc`,
      {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
      },
    ),
    fetch(`${base}/rest/v1/template_pricing?select=*&is_active=eq.true`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    }),
  ]);
  const tData = await tRes.json();
  const pData = await pRes.json();
  const pricingMap = Object.fromEntries(
    (pData || []).map((p) => [p.template_name, p]),
  );
  return (tData || []).map((t) => {
    const pricing = pricingMap[t.template_name] || {};
    return {
      id: t.template_id,
      name: t.display_name,
      theme: t.template_name,
      description: t.description,
      thumbnailUrl: t.thumbnail_url,
      previewUrl: t.preview_url,
      features: t.features || [],
      status: t.status,
      category: t.category,
      price: pricing.price || 159000,
      originalPrice: pricing.original_price || 199000,
    };
  });
}

async function loadTemplates() {
  try {
    if (TEMPLATES_API_URL) {
      const response = await fetch(TEMPLATES_API_URL);
      if (!response.ok) throw new Error("Failed to fetch templates");
      templates = await response.json();
    } else {
      templates = await fetchTemplatesDirect();
    }
    renderTemplateCards();
    initHeroIframe();
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

// ============= MODAL =============

let currentTemplateId = null;
let iframeLoadTimeout = null;

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
  if (iframeLoadTimeout) {
    clearTimeout(iframeLoadTimeout);
    iframeLoadTimeout = null;
  }
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

function updateNavAuthBtn() {
  const btn = document.getElementById("navAuthBtn");
  if (!btn) return;
  if (getCurrentUser()) {
    btn.textContent = "Quản lý thiệp";
    btn.className = "text-sm hover:opacity-70 transition-opacity";
    btn.style.background = "";
    btn.style.color = "var(--mauve)";
  } else {
    btn.textContent = "Đăng nhập";
    btn.className = "px-4 py-2 rounded-full text-sm font-semibold text-white transition-all hover:opacity-90 shadow-sm";
    btn.style.background = "var(--pink)";
    btn.style.color = "";
  }
}

document.addEventListener("DOMContentLoaded", updateNavAuthBtn);

function toggleMobileMenu() {
  const menu = document.getElementById("mobileMenu");
  const icon = document.getElementById("navHamburgerIcon");
  const open = menu.classList.toggle("hidden");
  icon.className = open ? "fas fa-bars text-base" : "fas fa-xmark text-base";
}

function closeMobileMenu() {
  const menu = document.getElementById("mobileMenu");
  const icon = document.getElementById("navHamburgerIcon");
  menu.classList.add("hidden");
  icon.className = "fas fa-bars text-base";
}

function goCreateDraft(e) {
  e.preventDefault();
  const first = templates.find((t) => t.status === "active");
  if (first) {
    createDraft(first.id);
  } else {
    window.location.href = "/invitation-setup/";
  }
}

function fitHeroIframe() {
  const wrap = document.getElementById("hero-iframe-wrap");
  const iframe = document.getElementById("hero-iframe");
  if (!wrap || !iframe) return;
  const cardW = wrap.offsetWidth;
  const cardH = wrap.offsetHeight;
  if (!cardW || !cardH) { setTimeout(fitHeroIframe, 150); return; }
  try {
    const doc = iframe.contentDocument || iframe.contentWindow.document;
    const contentW = doc.documentElement.scrollWidth || doc.body.scrollWidth || 390;
    const scale = cardW / contentW;
    iframe.style.width = contentW + "px";
    iframe.style.height = cardH / scale + "px";
    iframe.style.transformOrigin = "top left";
    iframe.style.transform = `scale(${scale})`;
  } catch (e) {
    const scale = cardW / 390;
    iframe.style.width = "390px";
    iframe.style.height = cardH / scale + "px";
    iframe.style.transformOrigin = "top left";
    iframe.style.transform = `scale(${scale})`;
  }
}

function initHeroIframe() {
  const first = templates.find((t) => t.status === "active");
  if (!first?.previewUrl) return;
  const iframe = document.getElementById("hero-iframe");
  const skeleton = document.getElementById("hero-skeleton");
  const card = document.getElementById("hero-card-preview");
  if (!iframe) return;
  iframe.style.width = "390px";
  iframe.src = first.previewUrl + (first.previewUrl.includes("?") ? "&" : "?") + "embedded=true";
  iframe.addEventListener("load", () => {
    fitHeroIframe();
    iframe.style.opacity = "1";
    if (skeleton) skeleton.style.display = "none";
  }, { once: true });
  if (card) {
    card.style.cursor = "pointer";
    card.addEventListener("click", () => {
      window.location.href = first.previewUrl;
    });
  }
}

// ============= PAYMENT =============

function getCurrentUser() {
  try {
    const keys = Object.keys(localStorage);
    const sessionKey = keys.find(
      (k) => k.startsWith("sb-") && k.endsWith("-auth-token"),
    );
    if (!sessionKey) return null;
    const session = JSON.parse(localStorage.getItem(sessionKey));
    return session?.user ?? null;
  } catch (e) {
    return null;
  }
}

function openPayment(templateId) {
  const template = templates.find((t) => t.id === templateId);
  if (!template) return;
  PaymentModal.open(template.name, template.theme, {
    price: template.price,
    originalPrice: template.originalPrice,
  });
}

// ============= CAROUSEL SCROLL =============

function scrollCarousel(direction) {
  const count = templates.length;
  if (!count) return;
  const next =
    direction === "next"
      ? (carouselActiveIndex + 1) % count
      : (carouselActiveIndex - 1 + count) % count;
  setActiveCard(next);
}

function updateCarouselButtons() {
  // circular — both buttons always active
}

// ============= 3D CAROUSEL =============

function normalizeOffset(raw, count) {
  let o = raw;
  if (o > count / 2) o -= count;
  if (o < -count / 2) o += count;
  return o;
}

function setActiveCard(index) {
  const cards = document.querySelectorAll(".carousel-3d-card");
  if (!cards.length) return;
  const count = cards.length;
  const prevActive = carouselActiveIndex;
  carouselActiveIndex = ((index % count) + count) % count;

  cards.forEach((card, i) => {
    const prevOffset = normalizeOffset(i - prevActive, count);
    const newOffset = normalizeOffset(i - carouselActiveIndex, count);

    // Card ẩn cần nhảy từ trái sang phải (hoặc ngược lại) → snap, không animate
    const jumping =
      Math.abs(prevOffset) > 1 &&
      Math.abs(newOffset) > 1 &&
      Math.sign(prevOffset) !== Math.sign(newOffset);
    if (jumping) {
      card.style.transition = "none";
      applyCardTransform(card, newOffset);
      card.offsetHeight; // force reflow
      card.style.transition = "";
    } else {
      applyCardTransform(card, newOffset);
    }
  });

  updateDots();
  updateMobileInfoCard();
  if (isSectionVisible) loadIframesAround(carouselActiveIndex);
}

function applyCardTransform(card, offset) {
  const mobile = window.innerWidth < 640;
  const abs = Math.abs(offset);

  if (abs > 1) {
    const dir = offset > 0 ? 1 : -1;
    card.style.transform = `translateX(${dir * (mobile ? 400 : 600)}px) translateZ(-200px) scale(0.5)`;
    card.style.opacity = "0";
    card.style.zIndex = "1";
    card.style.pointerEvents = "none";
    card.classList.remove("is-active");
    return;
  }

  if (offset === 0) {
    card.style.transform =
      "translateX(0px) translateZ(0px) rotateY(0deg) scale(1)";
    card.style.opacity = "1";
    card.style.zIndex = "20";
    card.style.pointerEvents = "auto";
    card.classList.add("is-active");
  } else {
    const tx = mobile ? 145 : 175;
    const dir = offset > 0 ? 1 : -1;
    const ry = offset > 0 ? -24 : 24;
    card.style.transform = `translateX(${dir * tx}px) translateZ(-48px) rotateY(${ry}deg) scale(0.82)`;
    card.style.opacity = "0.38";
    card.style.zIndex = "19";
    card.style.pointerEvents = "auto";
    card.classList.remove("is-active");
  }
}

function updateDots() {
  const container = document.getElementById("carouselDots");
  if (!container) return;
  container.innerHTML = templates
    .map(
      (_, i) => `
    <button onclick="setActiveCard(${i})" class="carousel-dot"
      style="width:${i === carouselActiveIndex ? "20px" : "8px"};background:${i === carouselActiveIndex ? "var(--pink)" : "rgba(0,0,0,0.2)"};"
      aria-label="Slide ${i + 1}"></button>
  `,
    )
    .join("");
}

function updateMobileInfoCard() {
  const container = document.getElementById("carouselMobileInfo");
  if (!container) return;
  const t = templates[carouselActiveIndex];
  if (!t) {
    container.innerHTML = "";
    return;
  }
  const categoryLabel =
    t.category === "premium" ? "Thiệp cao cấp" : "Thiệp miễn phí";
  container.innerHTML = `
    <div class="mb-2 flex items-center gap-1.5">
      <span class="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold" style="background:rgba(255,183,202,0.15);color:var(--pink-deep);">
        <i class="fas fa-tag text-[9px] shrink-0"></i>
        <span class="truncate">${categoryLabel}</span>
      </span>
    </div>
    <p class="truncate font-playfair text-lg font-semibold leading-tight text-[#5a3a45]">${t.name}</p>
    <p class="mt-1 line-clamp-2 text-xs leading-relaxed" style="color:var(--mauve);">${t.description || ""}</p>
    <div class="mt-3 flex items-center gap-2">
      <button onclick="openPreview('${t.id}')"
        class="flex-1 h-9 rounded-md border text-xs font-semibold flex items-center justify-center gap-1.5 bg-white/75 transition-colors"
        style="border-color:rgba(212,165,165,0.2);">
        <i class="fas fa-eye text-[11px]"></i>Xem Demo
      </button>
      <button onclick="createDraft('${t.id}')"
        class="flex-1 h-9 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 text-white"
        style="background:var(--pink-deep);">
        Tạo nhanh <i class="fas fa-arrow-right text-[11px]"></i>
      </button>
    </div>
  `;
}

function initCarousel3D() {
  const stage = document.getElementById("templateCarousel");
  if (!stage) return;

  // Intercept clicks on non-active cards (capture phase → fires before inner button handlers)
  const track = document.getElementById("templateCarouselInner");
  if (track) {
    track.addEventListener(
      "click",
      (e) => {
        const card = e.target.closest(".carousel-3d-card");
        if (!card) return;
        const idx = parseInt(card.dataset.index);
        if (idx !== carouselActiveIndex) {
          e.preventDefault();
          e.stopImmediatePropagation();
          setActiveCard(idx);
        }
      },
      true,
    );
  }

  // Touch / swipe
  let touchStartX = 0,
    touchStartTime = 0;
  stage.addEventListener(
    "touchstart",
    (e) => {
      touchStartX = e.touches[0].clientX;
      touchStartTime = Date.now();
    },
    { passive: true },
  );
  stage.addEventListener(
    "touchend",
    (e) => {
      const delta = e.changedTouches[0].clientX - touchStartX;
      if (Math.abs(delta) > 40 && Date.now() - touchStartTime < 400)
        scrollCarousel(delta < 0 ? "next" : "prev");
    },
    { passive: true },
  );

  // Keyboard
  document.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") scrollCarousel("prev");
    if (e.key === "ArrowRight") scrollCarousel("next");
  });

  // Resize → recalc transforms
  let resizeTimer = null;
  window.addEventListener(
    "resize",
    () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => setActiveCard(carouselActiveIndex), 120);
    },
    { passive: true },
  );

  setActiveCard(0);
}

// ============= SMOOTH SCROLL =============

function scrollToTemplates() {
  window.location.href = "/theme-template/";
}

function scrollToContact() {
  const el = document.getElementById("contact");
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    el.classList.add("highlight-pulse");
    setTimeout(() => el.classList.remove("highlight-pulse"), 2000);
  }
}

function setupSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener("click", function (e) {
      e.preventDefault();
      const target = document.getElementById(
        this.getAttribute("href").substring(1),
      );
      if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

function setupModalListeners() {
  const modal = document.getElementById("previewModal");
  if (!modal) return;
  modal
    .querySelector(".modal-backdrop")
    ?.addEventListener("click", closePreview);
  modal.querySelector(".modal-close")?.addEventListener("click", closePreview);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modal.classList.contains("hidden"))
      closePreview();
  });
}

function setupScrollAnimations() {
  if (!("IntersectionObserver" in window)) {
    document
      .querySelectorAll(".feature-card, .template-card, .step-card")
      .forEach((el) => el.classList.add("animate-in"));
    return;
  }
  const observer = new IntersectionObserver(
    (entries) =>
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("animate-in");
          observer.unobserve(entry.target);
        }
      }),
    { threshold: 0.1, rootMargin: "0px 0px -80px 0px" },
  );
  document
    .querySelectorAll(".feature-card, .template-card, .step-card")
    .forEach((el) => observer.observe(el));
}

function initializePage() {
  const templateSection = document.getElementById("templates");
  if (templateSection) {
    const sectionObserver = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            isSectionVisible = true;
            templates
              .filter((t) => t.status === "active")
              .forEach((t) => startIframeScroll("iframe-" + t.theme));
            loadIframesAround(carouselActiveIndex);
            setTimeout(setupIframeVisibilityObserver, 1000);
            sectionObserver.unobserve(entry.target);
          }
        }),
      { threshold: 0.1 },
    );
    sectionObserver.observe(templateSection);
  }

  setupModalListeners();
  setupSmoothScroll();
  setupScrollAnimations();

  initCarousel3D();

  let scrollThrottle = null;
  window.addEventListener(
    "scroll",
    () => {
      if (!scrollThrottle) {
        scrollThrottle = setTimeout(() => {
          scrollThrottle = null;
        }, 50);
        pauseAllIframes();
        if (scrollTimeout) clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(resumeAllIframes, 200);
      }
    },
    { passive: true },
  );
}

// ============= RENDER TEMPLATE CARDS =============

const CATEGORY_LABELS = {
  popular: "PHỔ BIẾN",
  new: "MỚI",
  premium: "CAO CẤP",
};

function renderTemplateCards() {
  const inner = document.getElementById("templateCarouselInner");
  if (!inner) return;

  inner.innerHTML = templates
    .map((t, index) => {
      const isActive = t.status === "active";

      const imageContent = isActive
        ? `<div id="iframe-wrap-${t.theme}" style="position:absolute;top:0;left:0;width:100%;height:100%;overflow:hidden;pointer-events:none;background:#f9f0f3;">
           <div id="skeleton-${t.theme}" class="card-skeleton absolute inset-0">
             <div style="position:absolute;bottom:0;left:0;right:0;padding:12px;display:flex;flex-direction:column;gap:6px;">
               <div style="height:9px;width:58%;border-radius:6px;background:rgba(0,0,0,0.07);"></div>
               <div style="height:7px;width:78%;border-radius:6px;background:rgba(0,0,0,0.04);"></div>
               <div style="height:7px;width:42%;border-radius:6px;background:rgba(0,0,0,0.04);"></div>
             </div>
           </div>
           <iframe
             id="iframe-${t.theme}"
             data-src="${t.previewUrl}${t.previewUrl.includes('?') ? '&' : '?'}embedded=true"
             scrolling="no"
             loading="lazy"
             style="border:none;transform-origin:top left;pointer-events:none;position:absolute;top:0;left:0;opacity:0;transition:opacity 0.3s;"
             onload="onIframeLoad(this)"
           ></iframe>
         </div>`
        : "";

      return `
      <div class="carousel-3d-card" data-index="${index}">
        <div class="art-template-card">
          <div class="relative h-full overflow-hidden rounded-[6px]" style="background:#fff;">
            <div class="absolute inset-0 overflow-y-hidden">
              ${imageContent}
            </div>
          </div>
          <div class="art-template-overlay absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent pt-12 pb-4 px-3 rounded-b-[6px]">
            <p class="text-white font-semibold text-sm leading-snug truncate drop-shadow-sm">${t.name}</p>
            <p class="text-white/70 text-xs mt-0.5 line-clamp-2 leading-relaxed">${t.description || ""}</p>
            <div class="mt-2 flex gap-1.5" style="pointer-events:auto;">
              <button onclick="openPreview('${t.id}')"
                class="flex-1 h-7 rounded text-[10px] font-semibold bg-white/20 text-white border border-white/30 backdrop-blur-sm transition-colors hover:bg-white/30">
                Xem demo
              </button>
              <button onclick="event.stopPropagation(); createDraft('${t.id}')"
                class="flex-1 h-7 rounded text-[10px] font-semibold text-white transition-colors"
                style="pointer-events:auto;background:var(--pink-deep);">
                Dùng ngay
              </button>
            </div>
          </div>
        </div>
      </div>`;
    })
    .join("");
}

// ============= IFRAME AUTO SCROLL =============

const iframeScrollStates = new Map();
let globalAnimationId = null;
let isUserScrolling = false;
let scrollTimeout = null;

const requestIdleCallback =
  window.requestIdleCallback || ((cb) => setTimeout(cb, 1));

function onIframeLoad(iframe) {
  setTimeout(() => {
    iframe.style.opacity = "1";
    const sk = document.getElementById("skeleton-" + iframe.id.replace("iframe-", ""));
    if (sk) sk.style.display = "none";
  }, 1000);
}

function startIframeScroll(iframeId) {
  const iframe = document.getElementById(iframeId);
  if (!iframe) return;

  const state = {
    iframe,
    scrollY: 0,
    direction: 1,
    isVisible: false,
    isPaused: false,
    lastUpdate: 0,
    isLoaded: false,
  };
  iframeScrollStates.set(iframeId, state);

  function fitIframe() {
    try {
      const wrap = iframe.parentElement;
      const cardW = wrap.offsetWidth;
      const cardH = wrap.offsetHeight;
      if (!cardW || !cardH) { setTimeout(fitIframe, 150); return; }
      const doc = iframe.contentDocument || iframe.contentWindow.document;
      const contentW =
        doc.documentElement.scrollWidth || doc.body.scrollWidth || 390;
      const scale = cardW / contentW;
      iframe.style.width = contentW + "px";
      iframe.style.height = cardH / scale + "px";
      iframe.style.transform = `scale(${scale})`;
      iframe.style.willChange = "transform";
    } catch (e) {
      const wrap = iframe.parentElement;
      const scale = wrap.offsetWidth / 390;
      if (!scale) { setTimeout(fitIframe, 150); return; }
      iframe.style.width = "390px";
      iframe.style.height = wrap.offsetHeight / scale + "px";
      iframe.style.transform = `scale(${scale})`;
      iframe.style.willChange = "transform";
    }
  }

  iframe.addEventListener("load", () => {
    fitIframe();
    state.isLoaded = true;
    state.isVisible = true;
    startGlobalAnimation();
  });

  const card = iframe.closest(".carousel-3d-card");
  if (card) {
    card.addEventListener("mouseenter", () => {
      state.isPaused = true;
    });
    card.addEventListener("mouseleave", () => {
      state.isPaused = false;
    });
  }
}

function pauseAllIframes() {
  isUserScrolling = true;
}
function resumeAllIframes() {
  isUserScrolling = false;
}

function startGlobalAnimation() {
  if (globalAnimationId) return;
  let lastFrameTime = performance.now();

  function animate(currentTime) {
    const deltaTime = currentTime - lastFrameTime;
    if (deltaTime >= 33.33 && !isUserScrolling) {
      lastFrameTime = currentTime;
      iframeScrollStates.forEach((state) => {
        if (!state.isLoaded || !state.isVisible || state.isPaused) return;
        const ownerCard = state.iframe.closest(".carousel-3d-card");
        if (!ownerCard || !ownerCard.classList.contains("is-active")) return;
        try {
          const doc =
            state.iframe.contentDocument || state.iframe.contentWindow.document;
          const scale =
            parseFloat(state.iframe.style.transform.replace("scale(", "")) || 1;
          const maxScroll =
            doc.body.scrollHeight - state.iframe.offsetHeight / scale;
          state.scrollY += 2.5 * state.direction;
          if (state.scrollY >= maxScroll) state.direction = -1;
          if (state.scrollY <= 0) state.direction = 1;
          state.iframe.contentWindow.scrollTo(0, state.scrollY);
        } catch (e) {}
      });
    }
    globalAnimationId = requestAnimationFrame(animate);
  }
  globalAnimationId = requestAnimationFrame(animate);
}

function setupIframeVisibilityObserver() {
  const observer = new IntersectionObserver(
    (entries) =>
      entries.forEach((entry) => {
        const state = iframeScrollStates.get(entry.target.id);
        if (state) state.isVisible = entry.isIntersecting;
      }),
    { threshold: 0.1, rootMargin: "100px" },
  );
  iframeScrollStates.forEach((state) => observer.observe(state.iframe));
}

const PRELOAD_RADIUS = 2;

function loadIframesAround(activeIndex) {
  const count = templates.length;
  if (!count) return;
  for (let d = -PRELOAD_RADIUS; d <= PRELOAD_RADIUS; d++) {
    const idx = ((activeIndex + d) % count + count) % count;
    const t = templates[idx];
    if (!t || t.status !== "active") continue;
    const iframe = document.getElementById("iframe-" + t.theme);
    if (!iframe || iframe.src) continue;
    const src = iframe.dataset.src;
    if (src) {
      // Pre-size to 390px so template renders at the correct mobile viewport
      iframe.style.width = "390px";
      iframe.src = src;
    }
  }
}

// ============= LAZY SECTION RENDER =============

function lazyRender(sectionId, renderFn) {
  const section = document.getElementById(sectionId);
  if (!section) return;
  const obs = new IntersectionObserver(
    (entries) =>
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          renderFn();
          obs.unobserve(entry.target);
        }
      }),
    { threshold: 0.05, rootMargin: "120px" },
  );
  obs.observe(section);
}

// --- Features list (#inside right column) ---

const FEATURES_DATA = [
  { icon: "fa-user-tag",     title: "Thiệp riêng từng khách mời",       desc: "Mỗi người nhận một link thiệp với tên cá nhân hóa riêng — tạo cảm giác trân trọng." },
  { icon: "fa-heart",        title: "Câu chuyện tình yêu",               desc: "Kể lại hành trình từ lần đầu gặp, hẹn hò đến ngày cầu hôn — với ảnh và lời kể." },
  { icon: "fa-calendar-alt", title: "Lịch trình ngày cưới chi tiết",     desc: "Tiệc cưới nhà trai, tiệc nhà gái, lễ vu quy và lễ thành hôn — đầy đủ từng sự kiện." },
  { icon: "fa-images",       title: "Album ảnh cưới",                    desc: "Đăng tối đa 10 ảnh, hiển thị đẹp ngay trong thiệp với hiệu ứng trình chiếu." },
  { icon: "fa-music",        title: "Nhạc nền lãng mạn",                 desc: "Chọn bài hát yêu thích từ YouTube làm nhạc nền cho thiệp của bạn." },
  { icon: "fa-qrcode",       title: "QR mừng cưới & bản đồ",             desc: "QR ngân hàng nhận lì xì trực tuyến và Google Maps chỉ đường đến địa điểm tiệc." },
];

function renderFeatures() {
  const el = document.getElementById("featuresList");
  if (!el) return;
  el.innerHTML = FEATURES_DATA.map(
    (f, i) => `<div class="feature-row reveal reveal-delay-${(i % 3) + 1}">
  <div class="feature-icon"><i class="fas ${f.icon} text-sm" style="color:var(--pink);"></i></div>
  <div>
    <p class="font-semibold text-sm mb-0.5 text-[#5a3a45]">${f.title}</p>
    <p class="text-sm opacity-60 leading-relaxed">${f.desc}</p>
  </div>
</div>`,
  ).join("");
  setupRevealObserver();
}

// --- Steps list (#steps) ---

const STEPS_DATA = [
  { n: 1, icon: "fa-palette",        title: "Chọn mẫu thiệp",      desc: "Xem demo trực tiếp. Đổi mẫu thoải mái, miễn phí.",          last: false },
  { n: 2, icon: "fa-pen-to-square",  title: "Điền thông tin",       desc: "Tên, ảnh, ngày cưới, câu chuyện tình yêu, nhạc nền...",    last: false },
  { n: 3, icon: "fa-eye",            title: "Xem trước & chia sẻ", desc: "Xem thiệp thật, gửi link cho người thân thử trước.",       last: false },
  { n: 4, icon: "fa-lock",           title: "Thanh toán một lần",   desc: "Ưng ý mới cần thanh toán. Một lần — dùng trọn đời.",       last: true  },
];

function renderSteps() {
  const el = document.getElementById("stepsList");
  if (!el) return;
  el.innerHTML = STEPS_DATA.map((s) => `
<div class="step-card reveal reveal-delay-${s.n}${s.last ? "" : " relative"} text-center px-2">
  ${s.last ? "" : '<div class="hidden lg:block step-connector"></div>'}
  <div class="relative w-16 h-16 mx-auto mb-5">
    <span class="absolute -top-1 -right-2 text-5xl font-black leading-none select-none pointer-events-none" style="color:rgba(255,183,202,0.22);">${s.n}</span>
    <div class="w-16 h-16 rounded-2xl flex items-center justify-center" style="background:linear-gradient(135deg,#fce7f3,#fbcfe8);box-shadow:0 4px 18px rgba(244,114,182,0.18);">
      <i class="fas ${s.icon} text-xl" style="color:#c96080;"></i>
    </div>
  </div>
  <div class="inline-flex items-center mb-3 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-widest uppercase" style="background:rgba(255,183,202,0.18);color:var(--pink-deep);">Bước ${s.n}</div>
  <h3 class="font-playfair font-semibold mb-2 text-[#5a3a45]">${s.title}</h3>
  <p class="text-sm opacity-60 leading-relaxed">${s.desc}</p>
</div>`).join("");
  setupRevealObserver();
}

// --- Benefits grid (#benefits) ---

const BENEFITS_DATA = [
  { icon: "fa-user-check",    iconCls: "border-pink-100 bg-pink-50 text-pink-500",       title: "Cá nhân hóa tên từng khách mời",          desc: "Mỗi khách nhận link thiệp riêng với tên gọi cá nhân — tạo cảm giác trân trọng và đặc biệt.", featured: true  },
  { icon: "fa-credit-card",   iconCls: "border-amber-100 bg-amber-50 text-amber-500",    title: "Thanh toán một lần — dùng trọn đời",       desc: "Không phí hàng tháng, không giới hạn thời gian. Một lần thanh toán, sở hữu thiệp mãi mãi.", featured: true  },
  { icon: "fa-bolt",          iconCls: "border-blue-100 bg-blue-50 text-blue-500",       title: "Tự tạo thiệp nhanh, không cần kỹ thuật",   desc: "Điền thông tin, chọn ảnh, chọn mẫu — hoàn thành thiệp đẹp chỉ trong vài phút.",             featured: false },
  { icon: "fa-share-nodes",   iconCls: "border-sky-100 bg-sky-50 text-sky-500",          title: "Chia sẻ link không giới hạn lượt xem",     desc: "Gửi qua Zalo, Facebook, SMS... thiệp luôn mở được, không hết hạn, không giới hạn khách.",   featured: false },
  { icon: "fa-arrows-rotate", iconCls: "border-emerald-100 bg-emerald-50 text-emerald-500", title: "Đổi mẫu & nội dung miễn phí mọi lúc",  desc: "Thay đổi mẫu thiệp và nội dung hoàn toàn miễn phí cả trước và sau khi thanh toán.",          featured: false },
  { icon: "fa-images",        iconCls: "border-violet-100 bg-violet-50 text-violet-500", title: "Album ảnh & nhạc nền lãng mạn",            desc: "Tải ảnh cưới, chọn nhạc nền yêu thích — thiệp trở thành kỷ niệm sống động cho cả hai.",     featured: false },
  { icon: "fa-circle-check",  iconCls: "border-orange-100 bg-orange-50 text-orange-500", title: "RSVP xác nhận tham dự trực tuyến",         desc: "Khách bấm xác nhận tham dự ngay trên thiệp. Bạn theo dõi số lượng dễ dàng, không cần gọi điện.", featured: false },
  { icon: "fa-headset",       iconCls: "border-rose-100 bg-rose-50 text-rose-500",       title: "Hỗ trợ tư vấn tận tình qua Messenger",    desc: "Đội ngũ phản hồi nhanh, hỗ trợ từ A đến Z — từ chọn mẫu đến chia sẻ thiệp cho khách.",     featured: false },
];

function renderBenefits() {
  const el = document.getElementById("benefitsGrid");
  if (!el) return;
  el.innerHTML = BENEFITS_DATA.map((b, i) => {
    const featuredBadge = b.featured
      ? `<div class="absolute top-4 right-4 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide" style="background:rgba(255,183,202,0.18);color:var(--pink-deep);">NỔI BẬT</div>`
      : "";
    const shadow = b.featured
      ? "hover:shadow-[0_20px_48px_-28px_rgba(88,45,54,0.45)] shadow-sm"
      : "hover:shadow-[0_20px_48px_-28px_rgba(88,45,54,0.30)]";
    const rel = b.featured ? " relative" : "";
    const delay = ` reveal-delay-${(i % 3) + 1}`;
    return `<div class="group reveal${delay}${rel} min-w-[82%] snap-start sm:min-w-0 rounded-[10px] border p-5 sm:p-6 transition-all duration-300 hover:-translate-y-1 ${shadow}" style="border-color:rgba(255,183,202,0.35);background:rgba(255,255,255,0.9);">
  ${featuredBadge}
  <div class="mb-4 flex h-10 w-10 items-center justify-center rounded-[8px] border ${b.iconCls} transition-transform duration-300 group-hover:-rotate-3 group-hover:scale-105">
    <i class="fas ${b.icon}" style="font-size:1rem;"></i>
  </div>
  <h3 class="font-semibold text-[15px] mb-1.5 text-[#5a3a45]">${b.title}</h3>
  <p class="text-sm leading-relaxed opacity-60">${b.desc}</p>
</div>`;
  }).join("");
  setupRevealObserver();
}

// ============= TESTIMONIALS =============

const TESTIMONIALS_DATA = [
  {
    avatar: "KC",
    name: "Anh Khoa & Minh Châu",
    date: "Tháng 3, 2026",
    rating: 5,
    text: "Mình lo thiệp online sẽ không đẹp bằng thiệp giấy, ai dè còn xịn hơn 😂 Mấy đứa bạn hỏi làm ở đâu hết á, share link cho cả nhóm luôn rồi.",
  },
  {
    avatar: "TL",
    name: "Tiến Dũng & Lan Anh",
    date: "Tháng 4, 2026",
    rating: 5,
    text: "Thật ra mình không rành mấy vụ này lắm nhưng tự mày mò làm xong trong 1 buổi chiều. Giá ok nha m.n, trả 1 lần xài tẹt ga.",
  },
  {
    avatar: "MH",
    name: "Mạnh Hùng & Thu Hà",
    date: "Tháng 5, 2026",
    rating: 5,
    text: "Đổi mẫu 2 lần vì không chịu được 😅 mà không tốn thêm gì. Hỏi bên support là rep liền, không phải chờ kiểu gửi mail rồi để đó.",
  },
];

function renderTestimonials() {
  const el = document.getElementById("testimonialsList");
  if (!el) return;
  el.innerHTML = TESTIMONIALS_DATA.map((t, i) => `
    <div class="testimonial-card reveal reveal-delay-${i + 1}">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
        <div class="testimonial-avatar">${t.avatar}</div>
        <div>
          <p style="font-weight:600;font-size:14px;color:#5a3a45;line-height:1.3;">${t.name}</p>
          <p style="font-size:12px;opacity:0.5;margin-top:2px;">${t.date}</p>
        </div>
      </div>
      <div style="display:flex;gap:2px;margin-bottom:12px;">
        ${"<i class='fas fa-star' style='font-size:10px;color:#f59e0b;'></i>".repeat(t.rating)}
      </div>
      <p style="font-size:14px;line-height:1.65;opacity:0.7;">"${t.text}"</p>
    </div>
  `).join("");
  setupRevealObserver();
}

// ============= SCROLL REVEAL =============

function setupRevealObserver() {
  if (!("IntersectionObserver" in window)) {
    document.querySelectorAll(".reveal").forEach((el) => el.classList.add("revealed"));
    return;
  }
  const observer = new IntersectionObserver(
    (entries) =>
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("revealed");
          observer.unobserve(entry.target);
        }
      }),
    { threshold: 0.1, rootMargin: "0px 0px -50px 0px" }
  );
  document.querySelectorAll(".reveal:not(.revealed)").forEach((el) => observer.observe(el));
}

// Wire up lazy rendering for all sections
document.addEventListener("DOMContentLoaded", () => {
  lazyRender("inside",       renderFeatures);
  lazyRender("steps",        renderSteps);
  lazyRender("benefits",     renderBenefits);
  lazyRender("testimonials", renderTestimonials);
  setupRevealObserver();
});
