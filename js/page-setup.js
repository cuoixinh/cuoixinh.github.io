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

// Ô hỏi XuXi ở màn mở đầu (#hero-ask-input): gõ rồi Enter/bấm mũi tên là mở
// khung chat và hỏi luôn; bỏ trống thì chỉ mở khung cho khách tự gõ trong đó.
// js/ai-assistant.js nạp ở cuối <body> nên có thể chưa xong — khi đó im lặng bỏ
// qua, ô nhập giữ nguyên chữ để khách bấm lại.
function cxHeroAsk(e) {
  e.preventDefault();
  if (typeof window.cxOpenAiChat !== "function") return;
  const el = document.getElementById("hero-ask-input");
  const q = (el?.value || "").trim();
  if (el) el.value = "";
  window.cxOpenAiChat(q ? { ask: q } : {});
}

// Chip gợi ý dưới ô hỏi: gửi thẳng câu đã soạn, không bắt khách gõ lại. Cùng
// nhánh dự phòng với cxHeroAsk — chat chưa nạp xong thì im lặng bỏ qua. `mode`
// "create" cho chip là việc tạo thiệp (khỏi đi vòng qua chế độ hỏi đáp).
function cxHeroChip(q, mode) {
  if (typeof window.cxOpenAiChat !== "function") return;
  window.cxOpenAiChat({ ask: q, mode });
}

// Dải chip ở màn mở đầu là MỘT hàng cuộn ngang: đặt cờ .is-more-l/.is-more-r
// cho CSS biết mép nào còn thẻ khuất mà làm mờ. Cùng phép đo với syncSugNav
// của khung chat (js/ai-assistant.js).
function cxSyncHeroChips() {
  const el = document.getElementById("hero-chips");
  if (!el) return;
  const max = el.scrollWidth - el.clientWidth;
  el.classList.toggle("is-more-l", el.scrollLeft > 4);
  el.classList.toggle("is-more-r", el.scrollLeft < max - 4);
}

function cxInitHeroChips() {
  const el = document.getElementById("hero-chips");
  if (!el) return;
  el.addEventListener("scroll", cxSyncHeroChips, { passive: true });
  window.addEventListener("resize", cxSyncHeroChips);
  // Khổ chip đổi khi font web vào — đo lại lúc đó, không thì cờ kẹt ở lần đo
  // bằng font dự phòng.
  document.fonts?.ready?.then(cxSyncHeroChips);
  cxSyncHeroChips();
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
  cxInitHeroChips();
  renderTemplateCards();
}

