// ============= MỤC "MẪU PHỔ BIẾN" =============

// Dải ngang lấy N mẫu ĐẦU danh sách (`templates` đã sắp theo `sort_order` ở
// templates-dal.js) — không có tiêu chí phổ biến riêng nào trong DB.
const POPULAR_COUNT = 10;

// Một thẻ: ảnh thiệp bo góc + tên mẫu Ở NGOÀI ảnh. Ảnh là ảnh chụp CẢ trang
// thiệp nên chỗ nào cũng đã có chữ của chính mẫu đó, đặt tên đè lên là hai lớp
// chữ chồng nhau.
// `<button>` viết tay chứ không phải <x-button>: đây là thẻ điều hướng trong
// một danh sách, không phải nút hành động (xem quy ước ở CLAUDE.md).
function popularCard(t) {
  return `
    <button
      type="button"
      class="cx-popcard"
      onclick="openPreview('${t.id}')"
      aria-label="Xem trước ${t.name}"
    >
      <span class="cx-popcard-frame">
        <img src="/assets/images/templates/${t.theme}.jpg" alt="" loading="lazy" />
      </span>
      <span class="cx-popcard-name">${t.name}</span>
    </button>`;
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
}
