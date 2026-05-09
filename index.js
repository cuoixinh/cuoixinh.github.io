// Landing Page JavaScript

// Templates API URL (Cloudflare cached - includes pricing)
const TEMPLATES_API_URL = CONFIG.cloudflare.templatesCache + "/";

// Template Data Model (will be loaded from API)
let templates = [];

// Load templates from API
async function loadTemplates() {
  try {
    const response = await fetch(TEMPLATES_API_URL);
    if (!response.ok) throw new Error("Failed to fetch templates");

    templates = await response.json();
    console.log("Templates loaded:", templates);

    // Render templates after loading
    renderTemplateCards();

    // Initialize page after templates are rendered
    initializePage();
  } catch (error) {
    console.error("Failed to load templates:", error);
    // Show error message to user
    const inner = document.getElementById("templateCarouselInner");
    if (inner) {
      inner.innerHTML = `
        <div class="text-center text-red-500 p-8">
          <i class="fas fa-exclamation-triangle text-4xl mb-4"></i>
          <p class="text-lg font-semibold mb-2">Không thể tải danh sách mẫu thiệp</p>
          <p class="text-sm text-gray-600">Vui lòng thử lại sau hoặc liên hệ hỗ trợ</p>
        </div>
      `;
    }
  }
}

// Initialize templates on page load
loadTemplates();

// Feature icon and label mapping
const featureMap = {
  gallery: { icon: "fa-images", label: "Gallery" },
  map: { icon: "fa-map-marker-alt", label: "Bản đồ" },
  qrcode: { icon: "fa-qrcode", label: "QR Code" },
  rsvp: { icon: "fa-check-circle", label: "RSVP" },
  countdown: { icon: "fa-clock", label: "Đếm ngược" },
  music: { icon: "fa-music", label: "Nhạc nền" },
};

// Get feature icon
function getFeatureIcon(feature) {
  return featureMap[feature]?.icon || "fa-star";
}

// Get feature label
function getFeatureLabel(feature) {
  return featureMap[feature]?.label || feature;
}

// Modal Management
let currentTemplateId = null;
let iframeLoadTimeout = null;

function openPreview(templateId) {
  const modal = document.getElementById("previewModal");
  const iframe = document.getElementById("previewFrame");
  const title = document.getElementById("modalTitle");
  const featuresContainer = document.getElementById("modalFeatures");
  const modalBody = document.querySelector(".modal-body");

  // Find template data
  const template = templates.find((t) => t.id === templateId);

  if (!template || template.status !== "active") {
    console.error("Template not available for preview:", templateId);
    alert("Mẫu thiệp này sắp ra mắt. Vui lòng chọn mẫu khác!");
    return;
  }

  currentTemplateId = templateId;

  console.log(
    "Opening preview for:",
    template.name,
    "URL:",
    template.previewUrl,
  );

  // Update modal content
  title.textContent = template.name;

  // Render feature tags
  featuresContainer.innerHTML = template.features
    .map(
      (f) => `
    <span class="feature-tag">
      <i class="fas ${getFeatureIcon(f)}"></i> ${getFeatureLabel(f)}
    </span>
  `,
    )
    .join("");
  featuresContainer.className = "template-features";

  // Update gradient visibility based on scroll position
  const wrapper = featuresContainer.parentElement;
  function updateFeaturesGradient() {
    const { scrollLeft, scrollWidth, clientWidth } = featuresContainer;
    wrapper.classList.toggle("hide-fade-left", scrollLeft <= 0);
    wrapper.classList.toggle(
      "hide-fade-right",
      scrollLeft >= scrollWidth - clientWidth - 1,
    );
  }
  featuresContainer.addEventListener("scroll", updateFeaturesGradient);
  // Run once after render to set initial state
  requestAnimationFrame(updateFeaturesGradient);

  // Show loading spinner
  modalBody.innerHTML = '<div class="loading-spinner"></div>';

  // Show modal
  modal.classList.remove("hidden");
  modal.classList.add("flex");
  document.body.style.overflow = "hidden";

  // Load iframe after modal is visible
  setTimeout(() => {
    modalBody.innerHTML =
      '<iframe id="previewFrame" src="" class="preview-iframe"></iframe>';
    const newIframe = document.getElementById("previewFrame");
    newIframe.src = template.previewUrl;

    console.log("Iframe src set to:", newIframe.src);

    // Set timeout for iframe loading
    iframeLoadTimeout = setTimeout(() => {
      showIframeError();
    }, 10000);

    // Clear timeout when iframe loads
    newIframe.onload = () => {
      console.log("Iframe loaded successfully");
      if (iframeLoadTimeout) {
        clearTimeout(iframeLoadTimeout);
        iframeLoadTimeout = null;
      }
    };

    newIframe.onerror = () => {
      console.error("Iframe failed to load");
      showIframeError();
    };
  }, 100);
}

function closePreview() {
  const modal = document.getElementById("previewModal");
  const modalBody = document.querySelector(".modal-body");

  // Hide modal
  modal.classList.add("hidden");
  modal.classList.remove("flex");

  // Clear iframe and timeout
  modalBody.innerHTML = "";
  if (iframeLoadTimeout) {
    clearTimeout(iframeLoadTimeout);
    iframeLoadTimeout = null;
  }

  // Re-enable body scroll
  document.body.style.overflow = "auto";

  currentTemplateId = null;
}

function showIframeError() {
  const modalBody = document.querySelector(".modal-body");
  modalBody.innerHTML = `
    <div class="iframe-error">
      <i class="fas fa-exclamation-triangle"></i>
      <p class="text-lg font-semibold mb-2">Không thể tải preview</p>
      <p class="text-sm mb-4">Vui lòng thử lại hoặc liên hệ với chúng tôi</p>
      <button onclick="closePreview()" class="btn-secondary">Đóng</button>
    </div>
  `;
}

function chooseFromModal() {
  if (currentTemplateId) {
    closePreview();
    openPayment(currentTemplateId);
  }
}

// ============= PAYMENT MODAL =============

function getCurrentUser() {
  // Supabase lưu session vào localStorage, đọc trực tiếp không cần async
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

// Carousel Scrolling
function scrollCarousel(direction) {
  const carousel = document.getElementById("templateCarousel");
  if (!carousel) return;

  // Get card width + gap (320px card + 24px gap = 344px on desktop, 260px + 24px = 284px on mobile)
  const isMobile = window.innerWidth < 768;
  const scrollAmount = isMobile ? 284 : 344;

  if (direction === "next") {
    carousel.scrollBy({
      left: scrollAmount,
      behavior: "smooth",
    });
  } else if (direction === "prev") {
    carousel.scrollBy({
      left: -scrollAmount,
      behavior: "smooth",
    });
  }
}

// Update carousel button visibility based on scroll position
function updateCarouselButtons() {
  const carousel = document.getElementById("templateCarousel");
  const prevBtn = document.getElementById("carouselPrevBtn");
  const nextBtn = document.getElementById("carouselNextBtn");

  if (!carousel || !prevBtn || !nextBtn) return;

  const isAtStart = carousel.scrollLeft <= 10;
  const isAtEnd =
    carousel.scrollLeft >= carousel.scrollWidth - carousel.clientWidth - 10;

  // Hide/show buttons based on scroll position
  prevBtn.style.opacity = isAtStart ? "0.3" : "1";
  prevBtn.style.pointerEvents = isAtStart ? "none" : "auto";

  nextBtn.style.opacity = isAtEnd ? "0.3" : "1";
  nextBtn.style.pointerEvents = isAtEnd ? "none" : "auto";
}

// Smooth Scrolling
function scrollToTemplates() {
  const templatesSection = document.getElementById("templates");
  if (templatesSection) {
    templatesSection.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function scrollToContact(templateId) {
  const contactSection = document.getElementById("contact");
  if (contactSection) {
    contactSection.scrollIntoView({ behavior: "smooth", block: "start" });
    contactSection.classList.add("highlight-pulse");
    setTimeout(() => contactSection.classList.remove("highlight-pulse"), 2000);
  }
}

function setupSmoothScroll() {
  // Get all anchor links
  const anchorLinks = document.querySelectorAll('a[href^="#"]');

  anchorLinks.forEach((link) => {
    link.addEventListener("click", function (e) {
      e.preventDefault();

      const targetId = this.getAttribute("href").substring(1);
      const targetElement = document.getElementById(targetId);

      if (targetElement) {
        targetElement.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
    });
  });
}

// Modal Event Listeners
function setupModalListeners() {
  const modal = document.getElementById("previewModal");
  if (!modal) return;

  const backdrop = modal.querySelector(".modal-backdrop");
  const closeBtn = modal.querySelector(".modal-close");

  // Close on backdrop click
  if (backdrop) {
    backdrop.addEventListener("click", closePreview);
  }

  // Close on close button click
  if (closeBtn) {
    closeBtn.addEventListener("click", closePreview);
  }

  // Close on ESC key
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !modal.classList.contains("hidden")) {
      closePreview();
    }
  });
}

// Scroll Animations with IntersectionObserver
function setupScrollAnimations() {
  // Check browser support
  if (!("IntersectionObserver" in window)) {
    console.warn("IntersectionObserver not supported, skipping animations");
    // Fallback: show all elements immediately
    const animatableElements = document.querySelectorAll(
      ".feature-card, .template-card, .step-card",
    );
    animatableElements.forEach((el) => el.classList.add("animate-in"));
    return;
  }

  const observerOptions = {
    threshold: 0.1,
    rootMargin: "0px 0px -100px 0px",
  };

  const observer = new IntersectionObserver(function (entries) {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("animate-in");
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);

  // Observe all animatable elements
  const animatableElements = document.querySelectorAll(
    ".feature-card, .template-card, .step-card",
  );

  animatableElements.forEach((el) => {
    observer.observe(el);
  });
}

// Check Selected Template from SessionStorage
function checkSelectedTemplate() {
  try {
    const selectedTemplate = sessionStorage.getItem("selectedTemplate");
    if (selectedTemplate) {
      console.log("Previously selected template:", selectedTemplate);
      // Could highlight the selected template or show a message
    }
  } catch (e) {
    console.warn("SessionStorage not available:", e);
  }
}

// Page Initialization
function initializePage() {
  // Templates will be rendered after loadTemplates() completes
  // Don't call renderTemplateCards() here to avoid race condition

  // Setup auto scroll sau khi cards đã render
  const templateSection = document.getElementById("templates");
  if (templateSection) {
    const sectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            templates
              .filter((t) => t.status === "active")
              .forEach((t) => {
                startIframeScroll("iframe-" + t.theme);
              });
            // Setup visibility observer after all iframes are initialized
            setTimeout(() => {
              setupIframeVisibilityObserver();
            }, 1000);
            sectionObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1 },
    );
    sectionObserver.observe(templateSection);
  }

  // Setup modal event listeners
  setupModalListeners();

  // Setup smooth scroll for navigation
  setupSmoothScroll();

  // Add intersection observer for animations
  setupScrollAnimations();

  // Check if redirected from template selection
  checkSelectedTemplate();

  // Setup carousel scroll listener
  const carousel = document.getElementById("templateCarousel");
  if (carousel) {
    carousel.addEventListener("scroll", updateCarouselButtons);

    // Pause iframe animations when user scrolls carousel
    carousel.addEventListener("scroll", () => {
      pauseAllIframes();

      // Clear existing timeout
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }

      // Resume after user stops scrolling for 150ms
      scrollTimeout = setTimeout(() => {
        resumeAllIframes();
      }, 150);
    });

    // Initial button state
    updateCarouselButtons();
  }

  // Pause iframe animations when user scrolls page (vertical scroll)
  let scrollThrottle = null;
  window.addEventListener(
    "scroll",
    () => {
      // Throttle scroll events for better performance
      if (!scrollThrottle) {
        scrollThrottle = setTimeout(() => {
          scrollThrottle = null;
        }, 50);

        pauseAllIframes();

        // Clear existing timeout
        if (scrollTimeout) {
          clearTimeout(scrollTimeout);
        }

        // Resume after user stops scrolling for 200ms (increased from 150ms)
        scrollTimeout = setTimeout(() => {
          resumeAllIframes();
        }, 200);
      }
    },
    { passive: true },
  );

  console.log("Landing page initialized");
}

// Initialize on DOM ready - removed because initializePage is now called after loadTemplates()
// if (document.readyState === "loading") {
//   document.addEventListener("DOMContentLoaded", initializePage);
// } else {
//   initializePage();
// }

// ============= RENDER TEMPLATE CARDS =============
function renderTemplateCards() {
  const inner = document.getElementById("templateCarouselInner");
  if (!inner) return;

  inner.innerHTML = templates
    .map((t, i) => {
      const isActive = t.status === "active";
      const badge =
        i === 0
          ? '<span class="px-3 py-1 bg-rose-pastel-300 text-white text-xs font-semibold rounded-full">PHỔ BIẾN</span>'
          : i === 1
            ? '<span class="px-3 py-1 bg-blue-500 text-white text-xs font-semibold rounded-full">MỚI</span>'
            : "";

      const thumbnail = isActive
        ? `<div id="iframe-wrap-${t.theme}" style="position:absolute; top:0; left:0; width:100%; height:100%; overflow:hidden; pointer-events:none; background:#f3f4f6;">
           <!-- Skeleton placeholder while iframe loads -->
           <div class="absolute inset-0 bg-gradient-to-br from-gray-100 to-gray-200 animate-pulse flex items-center justify-center">
             <i class="fas fa-spinner fa-spin text-gray-400 text-2xl"></i>
           </div>
           <iframe
             id="iframe-${t.theme}"
             data-src="${t.previewUrl}"
             scrolling="no"
             loading="lazy"
             style="border:none; transform-origin:top left; pointer-events:none; position:absolute; top:0; left:0; opacity:0; transition:opacity 0.3s;"
             onload="this.style.opacity='1'; this.previousElementSibling.style.display='none';"
           ></iframe>
         </div>`
        : `<div class="w-full h-full flex items-center justify-center bg-gray-100">
           <span class="text-gray-400 text-sm">Sắp ra mắt</span>
         </div>`;

      return `
      <div class="template-card-carousel ${i === 0 ? "active" : ""} group">
        <div class="template-thumbnail-carousel" style="overflow:hidden; position:relative; cursor:pointer;" onclick="openPreview('${t.id}')">
          ${thumbnail}
          ${badge ? `<div class="absolute top-2 right-2">${badge}</div>` : ""}
        </div>
        <div class="template-info-carousel">
          <h3 class="font-playfair text-lg font-semibold text-gray-800 mb-1 group-hover:text-pink-500 transition-colors">
            ${t.name}
          </h3>
          <p class="text-gray-600 text-sm mb-3">${t.description}</p>
          <div class="flex flex-col gap-2">
            <button onclick="openPreview('${t.id}')" class="w-full px-4 py-2 rounded-full border transition-all text-sm font-medium" style="border-color: rgb(255 183 202); color: rgb(173 122 135);">
              <i class="fas fa-eye mr-2"></i>Xem Demo
            </button>
            <button onclick="event.stopPropagation(); openPayment('${t.id}')" class="btn-choose-carousel">
              Chọn mẫu này
            </button>
          </div>
        </div>
      </div>
    `;
    })
    .join("");
}

// ============= AUTO SCROLL IFRAME PREVIEWS =============
// Global state for all iframes
const iframeScrollStates = new Map();
let globalAnimationId = null;
let isUserScrolling = false;
let scrollTimeout = null;

// Performance optimization: Use requestIdleCallback for non-critical updates
const requestIdleCallback =
  window.requestIdleCallback || ((cb) => setTimeout(cb, 1));

function startIframeScroll(iframeId) {
  const iframe = document.getElementById(iframeId);
  if (!iframe) return;

  // Initialize state for this iframe
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

      const doc = iframe.contentDocument || iframe.contentWindow.document;
      const contentW =
        doc.documentElement.scrollWidth || doc.body.scrollWidth || 390;

      const scale = cardW / contentW;
      const scaledH = cardH / scale;

      iframe.style.width = contentW + "px";
      iframe.style.height = scaledH + "px";
      iframe.style.transform = `scale(${scale})`;

      // Add will-change for better performance
      iframe.style.willChange = "transform";
    } catch (e) {
      // fallback nếu cross-origin
      const wrap = iframe.parentElement;
      const scale = wrap.offsetWidth / 390;
      iframe.style.width = "390px";
      iframe.style.height = wrap.offsetHeight / scale + "px";
      iframe.style.transform = `scale(${scale})`;
      iframe.style.willChange = "transform";
    }
  }

  iframe.addEventListener("load", () => {
    // Use requestIdleCallback to defer non-critical work
    requestIdleCallback(() => {
      fitIframe();
      state.isLoaded = true;
      state.isVisible = true;
      startGlobalAnimation();
    });
  });

  const card = iframe.closest(".template-card-carousel");
  if (card) {
    card.addEventListener("mouseenter", () => {
      state.isPaused = true;
    });
    card.addEventListener("mouseleave", () => {
      state.isPaused = false;
    });
  }
}

// Pause all iframes when user is scrolling carousel
function pauseAllIframes() {
  isUserScrolling = true;
}

// Resume all iframes after user stops scrolling
function resumeAllIframes() {
  isUserScrolling = false;
}

// Single animation loop for all iframes
function startGlobalAnimation() {
  if (globalAnimationId) return; // Already running

  let frameCount = 0;
  let lastFrameTime = performance.now();

  function animate(currentTime) {
    frameCount++;

    // Adaptive frame rate: skip more frames if performance is poor
    const deltaTime = currentTime - lastFrameTime;
    const targetFrameTime = 33.33; // 30fps

    // Update every 2-3 frames depending on performance
    const shouldUpdate = deltaTime >= targetFrameTime && !isUserScrolling;

    if (shouldUpdate) {
      lastFrameTime = currentTime;

      iframeScrollStates.forEach((state, iframeId) => {
        // Skip if not loaded, not visible, or paused
        if (!state.isLoaded || !state.isVisible || state.isPaused) return;

        try {
          const iframe = state.iframe;
          const doc = iframe.contentDocument || iframe.contentWindow.document;
          const maxScroll =
            doc.body.scrollHeight -
            iframe.offsetHeight /
              parseFloat(iframe.style.transform.replace("scale(", ""));

          // Scroll with smooth speed
          state.scrollY += 2.5 * state.direction;

          if (state.scrollY >= maxScroll) state.direction = -1;
          if (state.scrollY <= 0) state.direction = 1;

          iframe.contentWindow.scrollTo(0, state.scrollY);
          state.lastUpdate = currentTime;
        } catch (e) {
          // Ignore cross-origin errors
        }
      });
    }

    globalAnimationId = requestAnimationFrame(animate);
  }

  globalAnimationId = requestAnimationFrame(animate);
}

// Intersection Observer to pause iframes outside viewport
function setupIframeVisibilityObserver() {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const iframe = entry.target;
        const iframeId = iframe.id;
        const state = iframeScrollStates.get(iframeId);

        if (state) {
          state.isVisible = entry.isIntersecting;

          // Lazy load iframe src only when visible
          if (entry.isIntersecting && !iframe.src) {
            const originalSrc = iframe.dataset.src;
            if (originalSrc) {
              iframe.src = originalSrc;
            }
          }
        }
      });
    },
    {
      threshold: 0.1,
      rootMargin: "100px", // Load slightly before entering viewport
    },
  );

  // Observe all iframes
  iframeScrollStates.forEach((state) => {
    observer.observe(state.iframe);
  });
}
