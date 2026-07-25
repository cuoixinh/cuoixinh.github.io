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
