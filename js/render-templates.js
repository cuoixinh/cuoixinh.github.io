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
        ? `<img
             src="/assets/images/templates/${t.theme}.jpg"
             alt="${t.name}"
             loading="lazy"
             style="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;object-position:top center;pointer-events:none;"
           />`
        : "";

      const categoryLabel =
        t.category === "premium" ? "Thiệp cao cấp" : "Thiệp miễn phí";

      return `
      <div class="carousel-3d-card" data-index="${index}">
        <div class="art-template-card">
          <div class="relative h-full overflow-hidden rounded-[16px]" style="background:#fff;">
            <div class="absolute inset-0 overflow-y-hidden">
              ${imageContent}
            </div>
          </div>
          <div class="art-template-overlay absolute bottom-0 left-0 right-0 pt-16 pb-4 px-4 rounded-b-[16px]"
            style="background:linear-gradient(to top, rgb(132 132 132 / 90%) 0%, rgb(186 186 186 / 60%) 48%, transparent 100%);">
            <span class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 mb-2 text-[10px] font-semibold text-white" style="background:rgba(255,255,255,0.22);backdrop-filter:blur(4px);">
              <i class="fas fa-tag text-[9px]"></i>${categoryLabel}
            </span>
            <p class="text-white font-playfair font-semibold text-base leading-snug truncate drop-shadow-sm">${t.name}</p>
            <p class="text-white/85 text-xs mt-0.5 line-clamp-2 leading-relaxed">${t.description || ""}</p>
            <div class="mt-3 flex gap-2" style="pointer-events:auto;">
              <button onclick="event.stopPropagation(); openPreview('${t.id}')"
                class="flex-1 h-9 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors hover:bg-white"
                style="background:rgba(255,255,255,0.85);color:#5a3a45;border:1px solid rgba(212,165,165,0.35);">
                <i class="fas fa-eye text-[11px]"></i>Xem demo
              </button>
              <button onclick="event.stopPropagation(); createDraft('${t.id}')"
                class="flex-1 h-9 rounded-lg text-xs font-semibold text-white flex items-center justify-center gap-1.5 transition-colors"
                style="pointer-events:auto;background:var(--pink-deep);">
                Dùng ngay<i class="fas fa-arrow-right text-[11px]"></i>
              </button>
            </div>
          </div>
        </div>
      </div>`;
    })
    .join("");
}


