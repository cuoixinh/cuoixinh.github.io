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
  setupModalListeners();
  setupSmoothScroll();
  setupScrollAnimations();
  initCarousel3D();
  startImageScroll();
}

