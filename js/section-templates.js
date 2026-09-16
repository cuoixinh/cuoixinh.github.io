// ============= MỤC "MẪU THIỆP" =============

// Dải ngang toàn bộ mẫu đang bán (`templates` đã sắp theo `sort_order` ở
// templates-dal.js). Cuộn ngang bằng cuộn thật của trình duyệt: cuộn native tự
// huỷ cú click khi ngón tay đã trượt nên bấm vào thẻ để xem trước là an toàn.

// Thẻ do core/components/item-template.js dựng — CÙNG một thẻ với lưới ở
// /theme-template. Dải trang chủ bỏ hai thứ gắn riêng với trang kia: sao yêu
// thích (kéo theo bộ đếm ở navbar) và nhãn danh mục.
function templateCard(t) {
  return CXItemTemplate.cardHTML(t, { cardClass: "cx-tplcard" });
}

// Một cú bấm = đúng 2 thẻ.
const TPL_STEP_CARDS = 2;

// Bước cuộn của MỘT thẻ, đo từ DOM (hiệu offsetLeft của hai thẻ đầu nên tính
// luôn cả khoảng hở) — khổ thẻ đổi theo breakpoint, viết cứng là lệch.
function _tplCardStep(row) {
  const cards = row.children;
  if (cards.length > 1) {
    const d = cards[1].offsetLeft - cards[0].offsetLeft;
    if (d > 0) return d;
  }
  return cards[0]?.offsetWidth || row.clientWidth;
}

function scrollTemplates(dir) {
  const row = document.getElementById("templatesRow");
  if (!row) return;
  row.scrollBy({
    left: dir * _tplCardStep(row) * TPL_STEP_CARDS,
    behavior: "smooth",
  });
}

// ============= HÀNG CHẤM =============
// Một chấm = một KHUNG NHÌN của dải, không phải một mẫu: danh sách có bao nhiêu
// mẫu cũng chỉ ra vài chấm, đúng bằng số lần vuốt để đi hết dải.

// Số trang + trang đang xem. Trừ 1px cho phép cộng dồn khi trình duyệt làm tròn
// khổ thẻ — thiếu nó là dải vừa đủ hai trang lại ra ba, chấm cuối không bao giờ
// sáng.
// Trang đang xem chia theo QUÃNG CUỘN CÒN LẠI (`scrollWidth - clientWidth`) chứ
// không phải theo bề ngang khung: trang cuối bao giờ cũng cụt (dải hết chỗ để
// cuộn thêm), lấy `scrollLeft / clientWidth` thì cuộn tới đáy vẫn ra trang áp
// chót và chấm cuối chẳng bao giờ sáng.
function _tplPages(row) {
  const w = row.clientWidth;
  if (!w) return { count: 1, index: 0, max: 0 };
  const count = Math.max(1, Math.ceil((row.scrollWidth - 1) / w));
  const max = Math.max(0, row.scrollWidth - w);
  const index = max ? Math.round((row.scrollLeft / max) * (count - 1)) : 0;
  return { count, index: Math.min(count - 1, Math.max(0, index)), max };
}

// Dựng lại hàng chấm khi SỐ trang đổi (đổi khổ màn, dữ liệu về), còn lại chỉ
// đổi chấm nào đang sáng — dựng lại mỗi lần cuộn thì cú bấm vào chấm rơi vào
// phần tử đã bị thay.
function _syncTplDots() {
  const row = document.getElementById("templatesRow");
  const dots = document.getElementById("templatesDots");
  if (!row || !dots) return;

  const { count, index } = _tplPages(row);
  // Một trang thì hàng chấm không nói thêm gì — giấu hẳn.
  dots.hidden = count < 2;

  // Mờ hai mép dải theo phía còn cuộn được (js/scroll-fade.js). Đi nhờ nhịp
  // này thay vì `data-scroll-fade`: dải đổ nội dung sau nên phải cập nhật cả
  // lúc dữ liệu về, mà ở đây đã có sẵn cuộn + đổi khổ + vẽ lại.
  window.updateScrollFade?.(row);

  if (dots.childElementCount !== count) {
    dots.innerHTML = Array.from(
      { length: count },
      (_, i) =>
        `<button type="button" class="cx-tpldot" role="tab" aria-label="Trang ${i + 1}"></button>`,
    ).join("");
    dots.querySelectorAll(".cx-tpldot").forEach((dot, i) => {
      dot.addEventListener("click", () => {
        // Đi tới ĐÚNG mốc mà _tplPages() sẽ đọc ngược ra chấm này — cùng phép
        // chia thì bấm chấm nào là chấm đó sáng.
        const p = _tplPages(row);
        row.scrollTo({
          left: p.count > 1 ? (i / (p.count - 1)) * p.max : 0,
          behavior: "smooth",
        });
      });
    });
  }

  dots.querySelectorAll(".cx-tpldot").forEach((dot, i) => {
    dot.classList.toggle("is-on", i === index);
    dot.setAttribute("aria-selected", i === index ? "true" : "false");
  });
}

// Gắn MỘT lần cho cả đời trang: renderTemplateCards() có thể chạy lại (nút "Tải
// lại") nhưng #templatesRow vẫn là phần tử cũ.
function _bindTplDots(row) {
  if (row.dataset.dotsBound) return;
  row.dataset.dotsBound = "1";
  row.addEventListener("scroll", _syncTplDots, { passive: true });
  // Số trang đổi theo bề ngang dải (xoay máy, đổi khổ cửa sổ).
  if ("ResizeObserver" in window) {
    new ResizeObserver(_syncTplDots).observe(row);
  } else {
    window.addEventListener("resize", _syncTplDots);
  }
}

function renderTemplateCards() {
  const row = document.getElementById("templatesRow");
  const section = document.getElementById("templates");
  if (!row || !section) return;

  // Tải hỏng thì giấu cả mục: một tiêu đề với dải rỗng bên dưới khó hiểu hơn là
  // không có mục nào.
  section.hidden = !templates.length;
  row.innerHTML = templates.map(templateCard).join("");
  // Uỷ quyền sự kiện: gắn một lần cho cả dải, thẻ vẽ lại vẫn chạy.
  CXItemTemplate.bind(row, {
    onPreview: (id) => openPreview(id),
    onUse: (id) => createDraft(id),
  });
  // lucide KHÔNG tự quét lại markup chèn động — thiếu dòng này là mất icon.
  window.lucide?.createIcons({ root: row });

  _bindTplDots(row);
  _syncTplDots();
}
