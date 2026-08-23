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
        <!-- Mockup điện thoại vẽ bằng CSS (.cx-mock ở styles/_common.css) —
             không ảnh khung, không tai thỏ. Khổ + tỉ lệ do .carousel-3d-card. -->
        <div class="cx-mock">
          <div class="cx-mock-screen">
            ${imageContent}
          <div class="art-template-overlay absolute bottom-0 left-0 right-0 pt-16 pb-4 px-3"
            style="background:linear-gradient(to top, rgb(var(--landing-photo-overlay-rgb)/90%) 0%, rgb(var(--landing-photo-overlay-soft-rgb)/60%) 48%, transparent 100%);">
            <span class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 mb-2 text-[10px] font-semibold text-white" style="background:rgb(var(--white-rgb)/0.22);backdrop-filter:blur(4px);">
              <i data-lucide="tag" class="text-[9px]" style="width:16px;height:16px"></i>${categoryLabel}
            </span>
            <p class="text-white font-playfair font-semibold text-base leading-snug truncate drop-shadow-sm">${t.name}</p>
            <p class="text-white/85 text-xs mt-0.5 line-clamp-2 leading-relaxed">${t.description || ""}</p>
            <!-- flex-wrap + nút cỡ sm ở điện thoại: bề ngang thẻ suy ra từ CHIỀU CAO
                 khung (sizeCarousel) nên màn thấp là thẻ hẹp lại — hai nút
                 whitespace-nowrap cỡ md không lọt và thò ra ngoài mép thẻ. Hẹp quá
                 thì cho xuống dòng chứ không tràn. -->
            <div class="mt-3 flex flex-wrap gap-2" style="pointer-events:auto;">
              <!-- variant="outline" là BẮT BUỘC, không phải cho đẹp: variant mặc
                   định (fill) kèm class text-white, mà landing có luật ép
                   text-white thành trắng kèm !important (xem tailwind-src.css,
                   phần .cx-landing) — !important đè cả inline style nên chữ
                   không nâu được.
                   Nền TRẮNG ĐẶC: nút đè lên ảnh cưới, để trong mờ thì ảnh xuyên
                   qua làm chữ chìm và mỗi thẻ ra một sắc nền khác. -->
              <x-button size="sm" variant="outline" onclick="event.stopPropagation(); openPreview('${t.id}')" style="background:rgb(var(--white-rgb));color:rgb(var(--text-body-rgb));border:1px solid rgb(var(--brand-primary-rgb)/0.45);box-shadow:0 4px 12px rgb(var(--scrim-rgb)/0.18);" class="flex-1 sm:h-10 sm:px-5 sm:text-sm">
                <i data-lucide="eye" class="text-[11px]" style="width:16px;height:16px"></i>Xem trước
              </x-button>
              <!-- Cùng màu với nút "Tạo ngay" ở thanh xem trước mẫu
                   (core/utils.js): hai chỗ này là CÙNG một hành động — tạo bản
                   nháp từ mẫu đang xem. -->
              <x-button size="sm" onclick="event.stopPropagation(); createDraft('${t.id}')" style="pointer-events:auto;background:linear-gradient(135deg,rgb(var(--gift-btn-from-rgb)),rgb(var(--gift-btn-to-rgb)));box-shadow:0 4px 12px rgb(var(--gift-btn-to-rgb)/0.4);" class="flex-1 sm:h-10 sm:px-5 sm:text-sm">
                <!-- Cùng icon với nút "Dùng mẫu này" ở navbar bản xem thử
                     (SUG_ICONS.navigation trong core/utils.js) — hai nút là CÙNG
                     một hành động, đổi hình một bên thì phải đổi cả bên kia. -->
                <i data-lucide="navigation" class="shrink-0" style="width:13px;height:13px"></i>Dùng ngay
              </x-button>
            </div>
          </div>
          </div>
        </div>
      </div>`;
    })
    .join("");
  window.lucide?.createIcons({ root: inner });
}
