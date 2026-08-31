// ============= RENDER TEMPLATE CARDS =============

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

// Ruột một thẻ = ĐÚNG một tấm ảnh. Tên mẫu, mô tả và hai nút nằm ở
// #templateMeta ngoài thiệp (xem updateTemplateMeta). Tách khỏi vỏ
// `.carousel-3d-card` vì vỏ được TÁI DÙNG: cuộn carousel chỉ thay ruột chứ
// không dựng lại phần tử.
function templateCardBody(t) {
  // Mẫu chưa bật thì không có ảnh chụp — để thẻ trắng còn hơn ảnh vỡ.
  if (t.status !== "active") return "";

  // KHÔNG `loading="lazy"`: chỉ 7 thẻ nằm trong DOM và thẻ ở bậc ngoài cùng nằm
  // ngoài tầm nhìn, lazy sẽ hoãn tải tới đúng lúc nó trượt vào → chớp một nhịp
  // trống ảnh.
  return `<img
      src="/assets/images/templates/${t.theme}.jpg"
      alt="${t.name}"
      style="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;object-position:top center;pointer-events:none;"
    />`;
}

// Đổ tên mẫu + mô tả của thẻ đang mở vào khối #templateMeta. Hai nút dùng chung
// cho mọi mẫu nên chỉ cần đọc `carouselActiveIndex` lúc bấm, không phải gắn lại
// handler.
function updateTemplateMeta() {
  const box = document.getElementById("templateMeta");
  const t = templates[carouselActiveIndex];
  if (!box || !t) return;

  // Vô hình cho tới lần đổ đầu tiên: lúc chưa tải xong (hoặc tải hỏng) thì hai
  // nút trơ ra dưới một cái tên rỗng. `invisible` chứ không phải `hidden` —
  // khối vẫn giữ chỗ nên bố cục không nhảy khi dữ liệu về.
  box.classList.remove("invisible");

  document.getElementById("tplMetaName").textContent = t.name;
  document.getElementById("tplMetaDesc").textContent = t.description || "";

  // Gỡ rồi gắn lại class mới chạy lại được animation; reflow ở giữa là bắt
  // buộc, không có nó trình duyệt gộp hai lần đổi thành không có gì đổi.
  const text = box.querySelector(".cx-metacard-text");
  text.classList.remove("is-swap");
  void text.offsetWidth;
  text.classList.add("is-swap");
}

function previewActiveTemplate() {
  const t = templates[carouselActiveIndex];
  if (t) openPreview(t.id);
}

function useActiveTemplate() {
  const t = templates[carouselActiveIndex];
  if (t) createDraft(t.id);
}

// Đổ mẫu thứ `index` vào một vỏ thẻ có sẵn. `data-index` là chỉ số MẪU (không
// phải vị trí trong DOM) — click handler và setActiveCard đều đọc nó.
function fillCard(card, index) {
  const t = templates[index];
  if (!t) return;
  card.dataset.index = index;
  card.innerHTML = `<div class="cx-tcard">${templateCardBody(t)}</div>`;
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
