// ============= RENDER TEMPLATE CARDS =============

const CATEGORY_LABELS = {
  popular: "PHỔ BIẾN",
  new: "MỚI",
  premium: "CAO CẤP",
};

// Số thẻ giữ trong DOM mỗi bên thẻ đang xem → tối đa 7 thẻ tồn tại, dù danh
// sách có bao nhiêu mẫu. Không có cửa sổ này thì 100 mẫu = 100 thẻ, 2.300 node,
// 100 ảnh tải cùng lúc và setActiveCard phải đụng cả trăm thẻ mỗi lần vuốt.
// Phải LỚN HƠN `--cx-side` lớn nhất (3 ở máy tính, xem styles/tailwind-src.css):
// thẻ ở bậc ngoài cùng đứng sẵn trong DOM, trong suốt, để lúc trượt vào là đã
// có ảnh — không có bậc dự phòng đó thì mỗi lần vuốt lộ một khoảng trống.
const CARD_WINDOW = 3;

// Chỉ số mẫu cần có mặt trong DOM khi `active` đang mở, theo đúng thứ tự trái →
// phải. Danh sách ngắn hơn cửa sổ thì tự gộp trùng, không dựng thẻ thừa.
function cardWindowIndices(active) {
  const n = templates.length;
  const out = [];
  const seen = new Set();
  for (let d = -CARD_WINDOW; d <= CARD_WINDOW; d++) {
    const i = ((active + d) % n + n) % n;
    if (seen.has(i)) continue;
    seen.add(i);
    out.push(i);
  }
  return out;
}

// Ruột một thẻ. Tách khỏi vỏ `.carousel-3d-card` vì vỏ được TÁI DÙNG: cuộn
// carousel chỉ thay ruột chứ không dựng lại phần tử.
function templateCardBody(t) {
  const isActive = t.status === "active";

  // KHÔNG `loading="lazy"`: chỉ 7 thẻ nằm trong DOM và thẻ ở bậc ngoài cùng nằm
  // ngoài tầm nhìn, lazy sẽ hoãn tải tới đúng lúc nó trượt vào → chớp một nhịp
  // trống ảnh.
  const imageContent = isActive
    ? `<img
         src="/assets/images/templates/${t.theme}.jpg"
         alt="${t.name}"
         style="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;object-position:top center;pointer-events:none;"
       />`
    : "";

  const categoryLabel =
    t.category === "premium" ? "Thiệp cao cấp" : "Thiệp miễn phí";

  return `
        <!-- Ảnh thiệp bo góc, KHÔNG khung điện thoại (.cx-tcard ở
             styles/tailwind-src.css). Khổ + tỉ lệ do .carousel-3d-card. -->
        <div class="cx-tcard">
          ${imageContent}
          <!-- Lớp phủ chỉ có MỘT việc: giữ chữ trắng đọc được trên ảnh cưới bất kỳ
               (ảnh sáng, ảnh váy trắng…). Lấy đen mờ chứ không phải xám của bảng
               màu — xám 132 dù kéo 100% vẫn không đủ tương phản với chữ trắng.
               Chặng 46% phải còn đen: tên mẫu nằm ngay quãng đó, nhạt sớm hơn là
               chữ chìm vào ảnh. -->
          <div class="art-template-overlay absolute bottom-0 left-0 right-0 pt-16 pb-4 px-3"
            style="background:linear-gradient(to top, rgb(var(--scrim-rgb)/68%) 0%, rgb(var(--scrim-rgb)/50%) 46%, rgb(var(--landing-photo-overlay-rgb)/28%) 74%, transparent 100%);">
            <span class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 mb-2 text-[10px] font-semibold text-white" style="background:rgb(var(--white-rgb)/0.22);backdrop-filter:blur(4px);">
              <i data-lucide="tag" class="text-[9px]" style="width:16px;height:16px"></i>${categoryLabel}
            </span>
            <p class="text-white font-playfair font-semibold text-base leading-snug truncate drop-shadow-sm">${t.name}</p>
            <p class="text-white/85 text-xs mt-0.5 line-clamp-2 leading-relaxed">${t.description || ""}</p>
            <!-- Xếp DỌC ở điện thoại: thẻ phải hẹp lại để bốn thẻ phụ còn chỗ ló
                 ra, mà hai nút whitespace-nowrap thì không lọt một hàng. Để
                 flex-wrap thì hàng gãy hay không tuỳ độ dài tên nút — xếp dọc
                 hẳn mới ra cùng một hình ở mọi mẫu. -->
            <div class="mt-3 flex flex-col sm:flex-row gap-2" style="pointer-events:auto;">
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
        </div>`;
}

// Đổ mẫu thứ `index` vào một vỏ thẻ có sẵn. `data-index` là chỉ số MẪU (không
// phải vị trí trong DOM) — click handler và setActiveCard đều đọc nó.
function fillCard(card, index) {
  const t = templates[index];
  if (!t) return;
  card.dataset.index = index;
  card.innerHTML = templateCardBody(t);
  window.lucide?.createIcons({ root: card });
}

// Gán mẫu cho thẻ nhưng HOÃN dựng ruột sang frame sau. Thẻ vừa tái dùng luôn
// đứng ở bậc ngoài cùng (opacity 0) nên chưa ai nhìn thấy, mà innerHTML + upgrade
// <x-button> + lucide là phần nặng nhất của một lần cuộn — để nó chắn nhịp đầu
// là animation trượt thẻ mất luôn khúc mở đầu.
function assignCard(card, index) {
  card.dataset.index = index;
  requestAnimationFrame(() => {
    // Vuốt nhanh liên tiếp có thể gán lại thẻ này cho mẫu khác trước khi tới
    // lượt dựng — lúc đó bản dựng này đã lỗi thời, bỏ đi.
    if (Number(card.dataset.index) !== index) return;
    fillCard(card, index);
  });
}

function renderTemplateCards() {
  const inner = document.getElementById("templateCarouselInner");
  if (!inner) return;
  if (!templates.length) {
    inner.innerHTML = "";
    return;
  }

  if (carouselActiveIndex >= templates.length) carouselActiveIndex = 0;
  const want = cardWindowIndices(carouselActiveIndex);
  inner.innerHTML = want
    .map(() => '<div class="carousel-3d-card"></div>')
    .join("");
  inner.querySelectorAll(".carousel-3d-card").forEach((card, i) => {
    fillCard(card, want[i]);
  });
}
