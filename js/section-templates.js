// ============= MỤC "MẪU THIỆP" =============

// Dải ngang toàn bộ mẫu đang bán (`templates` đã sắp theo `sort_order` ở
// templates-dal.js). Cuộn ngang bằng cuộn thật của trình duyệt: cuộn native tự
// huỷ cú click khi ngón tay đã trượt nên bấm vào thẻ để xem trước là an toàn.

// Một thẻ = ĐÚNG thẻ mẫu của /theme-template (.tt-card, style ở
// styles/tailwind-src.css): ảnh bấm để xem trước, tên, mô tả, cụm giá rồi hai
// nút. Bỏ hai thứ gắn riêng với trang kia — nút sao yêu thích (kéo theo bộ đếm
// "Yêu thích" ở navbar) và hàng chip danh mục (nhãn nằm trong bảng CAT_META của
// riêng trang đó).
// Hàng giá gốc LUÔN có mặt (mẫu không giảm giá thì rỗng) để mọi thẻ cùng chiều
// cao, dải không so le.
function templateCard(t) {
  const off =
    t.originalPrice > t.price
      ? `<span class="tt-price-old">${t.originalPrice.toLocaleString("vi-VN")}<span class="tt-cur">đ</span></span>`
      : "";

  return `
    <article class="tt-card cx-tplcard">
      <div class="tt-media" role="button" tabindex="0" aria-label="Xem trước ${t.name}"
           onclick="openPreview('${t.id}')"
           onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openPreview('${t.id}')}">
        <img src="/assets/images/templates/${t.theme}.jpg" alt="${t.name}" loading="lazy" />
        <div class="tt-hover"></div>
      </div>

      <div class="mt-3 px-1.5 pb-1">
        <h3 class="text-[15px] font-semibold leading-snug truncate" style="color:rgb(var(--scrim-plum-rgb))">${t.name}</h3>
        <p class="mt-0.5 text-[13px] leading-snug line-clamp-2 min-h-[2.75em]" style="color:rgb(var(--text-heading-rgb)/0.55)">${t.description || ""}</p>
        <div class="mt-2 h-[16px]">${off}</div>
        <div class="mt-1.5 flex items-center justify-between gap-2">
          <span class="tt-price">${t.price.toLocaleString("vi-VN")}<span class="tt-cur">đ</span></span>
          <span class="tt-chip tt-chip-sm">trọn đời</span>
        </div>

        <!-- Đúng cặp nút của thẻ ở /theme-template — cùng nhãn, cùng icon, cùng
             màu vì là CÙNG hai hành động. -->
        <div class="tt-cardbtns mt-3">
          <x-button size="xs" variant="bare" class="tt-btn-preview"
                    onclick="event.stopPropagation();openPreview('${t.id}')"><i data-lucide="eye" style="width:13px;height:13px"></i>Xem trước</x-button>
          <x-button size="xs" variant="bare" class="tt-btn-use"
                    onclick="event.stopPropagation();createDraft('${t.id}')"><i data-lucide="navigation" class="shrink-0" style="width:13px;height:13px"></i>Dùng ngay</x-button>
        </div>
      </div>
    </article>`;
}

// Cuộn gần trọn một khung nhìn của dải, chừa lại một thẻ làm mốc để mắt bắt
// được mình vừa đi tới đâu.
function scrollTemplates(dir) {
  const row = document.getElementById("templatesRow");
  if (!row) return;
  row.scrollBy({ left: dir * row.clientWidth * 0.8, behavior: "smooth" });
}

function renderTemplateCards() {
  const row = document.getElementById("templatesRow");
  const section = document.getElementById("templates");
  if (!row || !section) return;

  // Tải hỏng thì giấu cả mục: một tiêu đề với dải rỗng bên dưới khó hiểu hơn là
  // không có mục nào.
  section.hidden = !templates.length;
  row.innerHTML = templates.map(templateCard).join("");
  // lucide KHÔNG tự quét lại markup chèn động — thiếu dòng này là mất icon.
  window.lucide?.createIcons({ root: row });
}
