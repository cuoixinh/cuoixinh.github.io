// ============= MỤC "MẪU PHỔ BIẾN" =============

// Dải ngang lấy N mẫu ĐẦU danh sách (`templates` đã sắp theo `sort_order` ở
// templates-dal.js) — không có tiêu chí phổ biến riêng nào trong DB.
const POPULAR_COUNT = 10;

// Một thẻ = ĐÚNG cụm của mục Mẫu thiệp: thiệp ở trên, dưới là thẻ nổi
// .cx-metacard với tên + mô tả bên trái và hai nút bên phải. Ảnh là ảnh chụp CẢ
// trang thiệp nên chỗ nào cũng đã có chữ của chính mẫu đó — mọi thứ phải nằm
// NGOÀI ảnh.
// Chỉ hai nút bắt sự kiện, bấm vào ảnh không làm gì: có nút rõ ràng rồi thì cả
// thẻ bấm được chỉ tổ bấm nhầm lúc vuốt.
function popularCard(t) {
  return `
    <article class="cx-popcard">
      <span class="cx-popcard-frame">
        <img src="/assets/images/templates/${t.theme}.jpg" alt="${t.name}" loading="lazy" />
      </span>
      <div class="cx-metacard">
        <div class="cx-metacard-text">
          <h3 class="cx-metacard-name font-playfair">${t.name}</h3>
          <p class="cx-metacard-desc">${t.description || ""}</p>
        </div>
        <div class="cx-metacard-actions">
          <x-button
            variant="outline"
            tone="brand"
            size="sm"
            full
            onclick="openPreview('${t.id}')"
          >
            <i data-lucide="eye" style="width:16px;height:16px"></i>Xem trước
          </x-button>
          <!-- Cùng màu và cùng icon với nút "Dùng ngay" ở mục Mẫu thiệp — cùng
               một hành động, đổi một bên thì phải đổi cả bên kia. -->
          <x-button
            size="sm"
            full
            onclick="createDraft('${t.id}')"
            style="background:linear-gradient(135deg,rgb(var(--gift-btn-from-rgb)),rgb(var(--gift-btn-to-rgb)));box-shadow:0 4px 12px rgb(var(--gift-btn-to-rgb)/0.4);"
          >
            <i data-lucide="navigation" class="shrink-0" style="width:13px;height:13px"></i>Dùng ngay
          </x-button>
        </div>
      </div>
    </article>`;
}

// Cuộn gần trọn một khung nhìn của dải, chừa lại một thẻ làm mốc để mắt bắt
// được mình vừa đi tới đâu.
function scrollPopular(dir) {
  const row = document.getElementById("popularRow");
  if (!row) return;
  row.scrollBy({ left: dir * row.clientWidth * 0.8, behavior: "smooth" });
}

function renderPopularTemplates() {
  const row = document.getElementById("popularRow");
  const section = document.getElementById("popular");
  if (!row || !section) return;

  const list = templates.slice(0, POPULAR_COUNT);
  // Tải hỏng thì giấu cả mục: một tiêu đề với dải rỗng bên dưới khó hiểu hơn là
  // không có mục nào.
  section.hidden = !list.length;
  row.innerHTML = list.map(popularCard).join("");
  // lucide KHÔNG tự quét lại markup chèn động — thiếu dòng này là mất icon.
  window.lucide?.createIcons({ root: row });
}
