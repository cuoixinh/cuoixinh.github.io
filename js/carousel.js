// ============= CAROUSEL SCROLL =============

function scrollCarousel(direction) {
  const count = templates.length;
  if (!count) return;
  const next =
    direction === "next"
      ? (carouselActiveIndex + 1) % count
      : (carouselActiveIndex - 1 + count) % count;
  setActiveCard(next);
}

function updateCarouselButtons() {
  // circular — both buttons always active
}

// ============= 3D CAROUSEL =============

function normalizeOffset(raw, count) {
  let o = raw;
  if (o > count / 2) o -= count;
  if (o < -count / 2) o += count;
  return o;
}

// Hình học vòng xoay. Thẻ phụ thứ k (tính từ thẻ đang mở) lùi ra xa tâm, lùi
// về sau và xoay quanh trục dọc thêm một bậc — phối cảnh ở .carousel-3d-track
// lo phần thu nhỏ, nên KHÔNG scale bằng tay (scale thủ công đá nhau với phối
// cảnh, thẻ trông bẹt).
// Bậc dịch ngang nhỏ hơn bậc đầu: càng ra xa thẻ càng dồn lại, đúng như mắt
// nhìn một vòng tròn quay. Mọi số nhân với BỀ NGANG thẻ nên đổi khổ màn không
// phải chỉnh lại; riêng quãng ngang còn nhân thêm `--cx-ring-spread` của CSS.
const RING_X0 = 0.52; // dịch ngang thẻ phụ đầu tiên (× bề ngang thẻ)
const RING_X1 = 0.36; // cộng thêm mỗi bậc ra xa
const RING_Z0 = 0.28; // lùi về sau ở bậc đầu
const RING_Z1 = 0.4; // lùi thêm mỗi bậc
const RING_ROT0 = 34; // độ xoay quanh trục dọc ở bậc đầu
const RING_ROT1 = 10; // xoay thêm mỗi bậc
const RING_FADE = 0.2; // mờ thêm mỗi bậc

// Cấu hình vòng xoay do CSS quyết (xem .carousel-3d-stage) nên chỉ cần sửa một
// chỗ khi đổi theo khổ màn. Đọc lại mỗi lần cuộn thì rẻ hơn là nghe matchMedia
// cho hai con số. `el` là phần tử BẤT KỲ trong sân khấu — hai biến này kế thừa
// xuống nên khỏi phải tìm lại đúng thẻ stage.
function carouselRing(el) {
  const st = getComputedStyle(el);
  const side = parseInt(st.getPropertyValue("--cx-side"));
  const spread = parseFloat(st.getPropertyValue("--cx-ring-spread"));
  return {
    side: Number.isFinite(side) ? Math.max(1, Math.min(CARD_WINDOW, side)) : 2,
    spread: Number.isFinite(spread) ? spread : 1,
  };
}

// Chỉ có ~7 thẻ trong DOM (xem CARD_WINDOW ở render-templates.js) và chúng được
// TÁI DÙNG: thẻ nào rơi ra khỏi cửa sổ thì nhận nội dung của mẫu vừa lọt vào,
// nên số thẻ phải đụng mỗi lần cuộn là hằng số, không phụ thuộc số mẫu.
function setActiveCard(index) {
  const inner = document.getElementById("templateCarouselInner");
  const count = templates.length;
  if (!inner || !count) return;

  const cards = Array.from(inner.querySelectorAll(".carousel-3d-card"));
  if (!cards.length) return;

  const prevActive = carouselActiveIndex;
  carouselActiveIndex = ((index % count) + count) % count;
  const ring = carouselRing(inner);

  // Mẫu cần có mặt sau bước này; thẻ đang giữ mẫu ngoài danh sách là thẻ rảnh.
  const want = cardWindowIndices(carouselActiveIndex);
  const wanted = new Set(want);
  const held = new Set();
  const spare = [];
  for (const card of cards) {
    const i = Number(card.dataset.index);
    if (wanted.has(i) && !held.has(i)) held.add(i);
    else spare.push(card);
  }

  // Thẻ vừa đổi nội dung phải nhảy thẳng tới chỗ mới thay vì bay ngang màn hình:
  // nó đang đứng ở phía đối diện với chỗ nó vừa được gán.
  const recycled = new Set();
  const missing = want.filter((i) => !held.has(i));
  missing.forEach((i, k) => {
    const card = spare[k];
    if (!card) return;
    assignCard(card, i);
    recycled.add(card);
  });

  for (const card of cards) {
    const i = Number(card.dataset.index);
    const newOffset = normalizeOffset(i - carouselActiveIndex, count);
    const prevOffset = normalizeOffset(i - prevActive, count);
    const prevHidden = Math.abs(prevOffset) > ring.side;
    const newHidden = Math.abs(newOffset) > ring.side;

    // Card đi vào/ra khỏi vùng nhìn thấy → snap tại chỗ, không bay ngang qua
    // màn hình (tránh cảm giác xoáy vòng khi nhiều thẻ di chuyển cùng lúc)
    const jumping =
      recycled.has(card) || prevHidden !== newHidden || (prevHidden && newHidden);
    if (jumping) {
      card.style.transition = "none";
      applyCardTransform(card, newOffset, ring);
      card.offsetHeight; // force reflow
      card.style.transition = "";
    } else {
      applyCardTransform(card, newOffset, ring);
    }
  }

  updateDots();
  resetImageScroll();
}

// Thẻ ngoài tầm nhìn đứng ở bậc `side + 1` (đã trong suốt) chứ không bay đi xa:
// lúc nó được tái dùng và trượt vào, quãng đường phải khớp với các thẻ khác.
function applyCardTransform(card, offset, ring) {
  const abs = Math.abs(offset);
  const dir = Math.sign(offset);
  const hidden = abs > ring.side;
  const step = hidden ? ring.side + 1 : abs;

  const tx =
    dir * _cardW * ring.spread * (step ? RING_X0 + RING_X1 * (step - 1) : 0);
  const tz = -_cardW * (step ? RING_Z0 + RING_Z1 * (step - 1) : 0);
  const rot = dir * (step ? RING_ROT0 + RING_ROT1 * (step - 1) : 0);

  card.style.transform = `translate3d(${tx}px, 0, ${tz}px) rotateY(${rot}deg)`;
  card.style.opacity = hidden ? "0" : String(Math.max(0, 1 - RING_FADE * step));
  // Thẻ gần tâm phải đè lên thẻ xa hơn, không thì thẻ sau ló ra trước thẻ trước.
  card.style.zIndex = String(20 - step);
  card.style.pointerEvents = hidden ? "none" : "auto";
  card.classList.toggle("is-active", offset === 0);
}

// Khổ thẻ do CSS quyết (`--cx-ph-w` ở .carousel-3d-stage), số thẻ phụ cũng vậy
// (`--cx-side`). Ở đây chỉ ĐO lại để applyCardTransform biết dịch thẻ bao nhiêu
// px. Đo bằng offsetWidth/Height chứ KHÔNG phải getBoundingClientRect: thẻ đang
// mang transform 3D nên hộp bao đã bị xoay/thu, lấy số đó là khổ teo dần sau mỗi
// lần resize. Trả về true khi có gì đổi — resize gọi lại setActiveCard theo đó.
function sizeCarousel() {
  const card = document.querySelector(".carousel-3d-card");
  if (!card) return false;
  const w = card.offsetWidth;
  const h = card.offsetHeight;
  const ring = carouselRing(card);
  const key = ring.side + ":" + ring.spread;
  if (!w || !h) return false;
  if (w === _cardW && h === _cardH && key === _ringKey) return false;
  _cardW = w;
  _cardH = h;
  _ringKey = key;
  return true;
}

// Quá số này thì dãy chấm dài hơn bề ngang màn và không bấm trúng cái nào —
// đổi sang bộ đếm "3 / 100", điều hướng để cho hai nút mũi tên và vuốt lo.
const MAX_DOTS = 10;

function updateDots() {
  const container = document.getElementById("carouselDots");
  if (!container) return;

  if (templates.length > MAX_DOTS) {
    const label = `${carouselActiveIndex + 1} / ${templates.length}`;
    // Chỉ thay phần chữ khi khung đã dựng: updateDots chạy mỗi lần cuộn.
    const counter = container.querySelector("[data-carousel-counter]");
    if (counter) counter.textContent = label;
    else
      container.innerHTML = `<span data-carousel-counter class="text-xs font-semibold tabular-nums" style="color:rgb(var(--text-body-rgb)/0.65)">${label}</span>`;
    return;
  }

  container.innerHTML = templates
    .map(
      (_, i) => `
    <button onclick="setActiveCard(${i})" class="carousel-dot"
      style="width:${i === carouselActiveIndex ? "20px" : "8px"};background:${i === carouselActiveIndex ? "rgb(var(--brand-primary-rgb))" : "rgb(var(--scrim-rgb)/0.2)"};"
      aria-label="Slide ${i + 1}"></button>
  `,
    )
    .join("");
}

function initCarousel3D() {
  const stage = document.getElementById("templateCarousel");
  if (!stage) return;

  // Intercept clicks on non-active cards (capture phase → fires before inner button handlers)
  const track = document.getElementById("templateCarouselInner");
  if (track) {
    track.addEventListener(
      "click",
      (e) => {
        const card = e.target.closest(".carousel-3d-card");
        if (!card) return;
        const idx = parseInt(card.dataset.index);
        if (idx !== carouselActiveIndex) {
          e.preventDefault();
          e.stopImmediatePropagation();
          setActiveCard(idx);
        }
      },
      true,
    );
  }

  // Vuốt ngang để xoay vòng. KHÔNG xét thời gian vuốt: thẻ cao gần hết màn nên
  // người ta hay kéo chậm, tính giờ là cú vuốt thong thả rơi vào hư không. Bù
  // lại phải so với quãng dọc — vuốt chéo là đang cuộn trang, đổi thiệp lúc đó
  // là cướp cử chỉ của người dùng.
  let touchStartX = 0,
    touchStartY = 0;
  stage.addEventListener(
    "touchstart",
    (e) => {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    },
    { passive: true },
  );
  stage.addEventListener(
    "touchend",
    (e) => {
      const dx = e.changedTouches[0].clientX - touchStartX;
      const dy = e.changedTouches[0].clientY - touchStartY;
      if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
      scrollCarousel(dx < 0 ? "next" : "prev");
    },
    { passive: true },
  );

  // Keyboard
  document.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") scrollCarousel("prev");
    if (e.key === "ArrowRight") scrollCarousel("next");
  });

  // Resize → tính lại kích thước card + transform. iOS bắn `resize` mỗi lần ẩn/hiện
  // thanh URL dù bố cục không đổi (khung đo bằng svh), nên chỉ dựng lại transform
  // khi sizeCarousel() báo khổ thẻ thật sự đổi — nếu không thẻ giật một nhịp
  // (transition bị tắt/bật) suốt lúc cuộn.
  let resizeTimer = null;
  window.addEventListener(
    "resize",
    () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (sizeCarousel()) setActiveCard(carouselActiveIndex);
      }, 120);
    },
    { passive: true },
  );

  sizeCarousel();
  setActiveCard(0);
}

