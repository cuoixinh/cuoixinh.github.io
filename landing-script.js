// Landing Page JavaScript

// Template Data Model
const templates = [
  {
    id: 'classic',
    name: 'Classic Elegance',
    description: 'Thiết kế sang trọng, cổ điển với màu pastel nhẹ nhàng',
    thumbnail: 'assets/images/ZIN_3506.jpg',
    previewUrl: 'themes/wedding.html?preview=true',
    features: ['gallery', 'map', 'qrcode', 'rsvp'],
    status: 'active',
    category: 'traditional'
  },
  {
    id: 'modern',
    name: 'Modern Minimalist',
    description: 'Phong cách tối giản, hiện đại cho cặp đôi trẻ trung',
    thumbnail: 'assets/images/ZIN_3719.jpg',
    previewUrl: null,
    features: ['gallery', 'map', 'qrcode'],
    status: 'coming-soon',
    category: 'modern'
  },
  {
    id: 'elegant',
    name: 'Royal Elegance',
    description: 'Thiết kế hoàng gia, lộng lẫy cho đám cưới sang trọng',
    thumbnail: 'assets/images/ZIN_3735.jpg',
    previewUrl: null,
    features: ['gallery', 'map', 'qrcode', 'rsvp', 'countdown'],
    status: 'coming-soon',
    category: 'luxury'
  }
];

// Feature icon and label mapping
const featureMap = {
  gallery: { icon: 'fa-images', label: 'Gallery' },
  map: { icon: 'fa-map-marker-alt', label: 'Bản đồ' },
  qrcode: { icon: 'fa-qrcode', label: 'QR Code' },
  rsvp: { icon: 'fa-check-circle', label: 'RSVP' },
  countdown: { icon: 'fa-clock', label: 'Đếm ngược' },
  music: { icon: 'fa-music', label: 'Nhạc nền' }
};

// Get feature icon
function getFeatureIcon(feature) {
  return featureMap[feature]?.icon || 'fa-star';
}

// Get feature label
function getFeatureLabel(feature) {
  return featureMap[feature]?.label || feature;
}

// Modal Management
let currentTemplateId = null;
let iframeLoadTimeout = null;

function openPreview(templateId) {
  const modal = document.getElementById('previewModal');
  const iframe = document.getElementById('previewFrame');
  const title = document.getElementById('modalTitle');
  const featuresContainer = document.getElementById('modalFeatures');
  const modalBody = document.querySelector('.modal-body');

  // Find template data
  const template = templates.find(t => t.id === templateId);
  
  if (!template || template.status !== 'active') {
    console.error('Template not available for preview:', templateId);
    alert('Mẫu thiệp này sắp ra mắt. Vui lòng chọn mẫu khác!');
    return;
  }

  currentTemplateId = templateId;

  console.log('Opening preview for:', template.name, 'URL:', template.previewUrl);

  // Update modal content
  title.textContent = template.name;
  
  // Render feature tags
  featuresContainer.innerHTML = template.features.map(f => `
    <span class="feature-tag">
      <i class="fas ${getFeatureIcon(f)}"></i> ${getFeatureLabel(f)}
    </span>
  `).join('');

  // Show loading spinner
  modalBody.innerHTML = '<div class="loading-spinner"></div>';

  // Show modal
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  document.body.style.overflow = 'hidden';

  // Load iframe after modal is visible
  setTimeout(() => {
    modalBody.innerHTML = '<iframe id="previewFrame" src="" class="preview-iframe"></iframe>';
    const newIframe = document.getElementById('previewFrame');
    newIframe.src = template.previewUrl;
    
    console.log('Iframe src set to:', newIframe.src);

    // Set timeout for iframe loading
    iframeLoadTimeout = setTimeout(() => {
      showIframeError();
    }, 10000);

    // Clear timeout when iframe loads
    newIframe.onload = () => {
      console.log('Iframe loaded successfully');
      if (iframeLoadTimeout) {
        clearTimeout(iframeLoadTimeout);
        iframeLoadTimeout = null;
      }
    };
    
    newIframe.onerror = () => {
      console.error('Iframe failed to load');
      showIframeError();
    };
  }, 100);
}

function closePreview() {
  const modal = document.getElementById('previewModal');
  const modalBody = document.querySelector('.modal-body');

  // Hide modal
  modal.classList.add('hidden');
  modal.classList.remove('flex');

  // Clear iframe and timeout
  modalBody.innerHTML = '';
  if (iframeLoadTimeout) {
    clearTimeout(iframeLoadTimeout);
    iframeLoadTimeout = null;
  }

  // Re-enable body scroll
  document.body.style.overflow = 'auto';
  
  currentTemplateId = null;
}

function showIframeError() {
  const modalBody = document.querySelector('.modal-body');
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
    scrollToContact(currentTemplateId);
  }
}

// Carousel Scrolling
function scrollCarousel(direction) {
  const carousel = document.getElementById('templateCarousel');
  if (!carousel) return;

  // Get card width + gap (320px card + 24px gap = 344px on desktop, 260px + 24px = 284px on mobile)
  const isMobile = window.innerWidth < 768;
  const scrollAmount = isMobile ? 284 : 344;

  if (direction === 'next') {
    carousel.scrollBy({
      left: scrollAmount,
      behavior: 'smooth'
    });
  } else if (direction === 'prev') {
    carousel.scrollBy({
      left: -scrollAmount,
      behavior: 'smooth'
    });
  }
}

// Update carousel button visibility based on scroll position
function updateCarouselButtons() {
  const carousel = document.getElementById('templateCarousel');
  const prevBtn = document.getElementById('carouselPrevBtn');
  const nextBtn = document.getElementById('carouselNextBtn');

  if (!carousel || !prevBtn || !nextBtn) return;

  const isAtStart = carousel.scrollLeft <= 10;
  const isAtEnd = carousel.scrollLeft >= (carousel.scrollWidth - carousel.clientWidth - 10);

  // Hide/show buttons based on scroll position
  prevBtn.style.opacity = isAtStart ? '0.3' : '1';
  prevBtn.style.pointerEvents = isAtStart ? 'none' : 'auto';
  
  nextBtn.style.opacity = isAtEnd ? '0.3' : '1';
  nextBtn.style.pointerEvents = isAtEnd ? 'none' : 'auto';
}

// Smooth Scrolling
function scrollToTemplates() {
  const templatesSection = document.getElementById('templates');
  if (templatesSection) {
    templatesSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function scrollToContact(templateId) {
  // Store selected template in sessionStorage
  if (templateId) {
    try {
      sessionStorage.setItem('selectedTemplate', templateId);
    } catch (e) {
      console.warn('SessionStorage not available:', e);
    }
  }

  // Scroll to contact section
  const contactSection = document.getElementById('contact');
  if (contactSection) {
    contactSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

    // Highlight contact section briefly
    contactSection.classList.add('highlight-pulse');
    setTimeout(() => {
      contactSection.classList.remove('highlight-pulse');
    }, 2000);
  }
}

function setupSmoothScroll() {
  // Get all anchor links
  const anchorLinks = document.querySelectorAll('a[href^="#"]');

  anchorLinks.forEach(link => {
    link.addEventListener('click', function(e) {
      e.preventDefault();

      const targetId = this.getAttribute('href').substring(1);
      const targetElement = document.getElementById(targetId);

      if (targetElement) {
        targetElement.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    });
  });
}

// Modal Event Listeners
function setupModalListeners() {
  const modal = document.getElementById('previewModal');
  if (!modal) return;

  const backdrop = modal.querySelector('.modal-backdrop');
  const closeBtn = modal.querySelector('.modal-close');

  // Close on backdrop click
  if (backdrop) {
    backdrop.addEventListener('click', closePreview);
  }

  // Close on close button click
  if (closeBtn) {
    closeBtn.addEventListener('click', closePreview);
  }

  // Close on ESC key
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
      closePreview();
    }
  });
}

// Scroll Animations with IntersectionObserver
function setupScrollAnimations() {
  // Check browser support
  if (!('IntersectionObserver' in window)) {
    console.warn('IntersectionObserver not supported, skipping animations');
    // Fallback: show all elements immediately
    const animatableElements = document.querySelectorAll('.feature-card, .template-card, .step-card');
    animatableElements.forEach(el => el.classList.add('animate-in'));
    return;
  }

  const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -100px 0px'
  };

  const observer = new IntersectionObserver(function(entries) {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('animate-in');
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);

  // Observe all animatable elements
  const animatableElements = document.querySelectorAll('.feature-card, .template-card, .step-card');
  
  animatableElements.forEach(el => {
    observer.observe(el);
  });
}

// Check Selected Template from SessionStorage
function checkSelectedTemplate() {
  try {
    const selectedTemplate = sessionStorage.getItem('selectedTemplate');
    if (selectedTemplate) {
      console.log('Previously selected template:', selectedTemplate);
      // Could highlight the selected template or show a message
    }
  } catch (e) {
    console.warn('SessionStorage not available:', e);
  }
}

// Page Initialization
function initializePage() {
  // Setup modal event listeners
  setupModalListeners();

  // Setup smooth scroll for navigation
  setupSmoothScroll();

  // Add intersection observer for animations
  setupScrollAnimations();

  // Check if redirected from template selection
  checkSelectedTemplate();

  // Setup carousel scroll listener
  const carousel = document.getElementById('templateCarousel');
  if (carousel) {
    carousel.addEventListener('scroll', updateCarouselButtons);
    // Initial button state
    updateCarouselButtons();
  }

  console.log('Landing page initialized');
}

// Initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializePage);
} else {
  initializePage();
}
