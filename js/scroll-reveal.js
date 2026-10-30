// ============= LAZY SECTION RENDER =============

// Mục còn chờ vẽ, theo id — flushLazyRender() vẽ hết một lượt.
const _lazyPending = new Map();

function lazyRender(sectionId, renderFn) {
  const section = document.getElementById(sectionId);
  if (!section) return;
  const run = () => {
    if (!_lazyPending.delete(sectionId)) return;
    obs.disconnect();
    renderFn();
  };
  const obs = new IntersectionObserver(
    (entries) => entries.forEach((entry) => entry.isIntersecting && run()),
    { threshold: 0.05, rootMargin: "120px" },
  );
  _lazyPending.set(sectionId, run);
  obs.observe(section);
}

// Nhảy tới một mục (link "/#pricing", menu ☰) thì vẽ hết mục còn chờ TRƯỚC: mục phía trên
// vẽ trễ lúc lướt qua làm trang dài thêm, đích bị đẩy xuống giữa chừng.
function flushLazyRender() {
  [..._lazyPending.values()].forEach((run) => run());
}

document.addEventListener(
  "click",
  (e) => {
    const a = e.target.closest?.('a[href*="#"]');
    if (a && a.hash && a.pathname === location.pathname) flushLazyRender();
  },
  true,
);


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
  lazyRender("benefits",     renderBenefits);
  lazyRender("testimonials", renderTestimonials);
  setupRevealObserver();
  // Mở trang từ link có #mục (vd /#pricing từ trang khác): trình duyệt đã nhảy trước khi
  // các mục kịp vẽ nên vẽ hết rồi cuộn lại.
  const target = location.hash && document.getElementById(location.hash.slice(1));
  if (target) {
    flushLazyRender();
    target.scrollIntoView();
  }
});
