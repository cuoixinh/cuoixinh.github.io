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

function setActiveCard(index) {
  const cards = document.querySelectorAll(".carousel-3d-card");
  if (!cards.length) return;
  const count = cards.length;
  const prevActive = carouselActiveIndex;
  carouselActiveIndex = ((index % count) + count) % count;

  cards.forEach((card, i) => {
    const prevOffset = normalizeOffset(i - prevActive, count);
    const newOffset = normalizeOffset(i - carouselActiveIndex, count);
    const prevHidden = Math.abs(prevOffset) > 1;
    const newHidden = Math.abs(newOffset) > 1;

    // Card đi vào/ra khỏi vùng nhìn thấy (±1) → snap tại chỗ, không bay ngang qua
    // màn hình (tránh cảm giác xoáy vòng khi nhiều thẻ di chuyển cùng lúc)
    const jumping = prevHidden !== newHidden || (prevHidden && newHidden);
    if (jumping) {
      card.style.transition = "none";
      applyCardTransform(card, newOffset);
      card.offsetHeight; // force reflow
      card.style.transition = "";
    } else {
      applyCardTransform(card, newOffset);
    }
  });

  updateDots();
  resetImageScroll();
}

function applyCardTransform(card, offset) {
  const abs = Math.abs(offset);

  if (abs > 1) {
    const dir = offset > 0 ? 1 : -1;
    card.style.transform = `translateX(${dir * _cardW * 1.8}px) scale(0.5)`;
    card.style.opacity = "0";
    card.style.zIndex = "1";
    card.style.pointerEvents = "none";
    card.classList.remove("is-active");
    return;
  }

  if (offset === 0) {
    card.style.transform = "translateX(0px) scale(1)";
    card.style.opacity = "1";
    card.style.zIndex = "20";
    card.style.pointerEvents = "auto";
    card.classList.add("is-active");
  } else {
    // Card kề bên chỉ ló ra ở mép — tỉ lệ theo bề rộng card để luôn cân đối
    const tx = _cardW * 0.8;
    const dir = offset > 0 ? 1 : -1;
    card.style.transform = `translateX(${dir * tx}px) scale(0.85)`;
    card.style.opacity = "0.4";
    card.style.zIndex = "19";
    card.style.pointerEvents = "auto";
    card.classList.remove("is-active");
  }
}

// Khổ thẻ active. Hai lối tính khác hẳn nhau theo bề ngang khung:
//   < 640px — mỗi chiều lấy 80% chiều TƯƠNG ỨNG của khung, bề ngang không suy ra
//     từ chiều cao. Thanh URL của iPhone ẩn/hiện làm khung thấp đi thì thẻ chỉ
//     thấp theo, không hẹp lại kéo nút trong lớp phủ tràn ra ngoài mép.
//   ≥ 640px — như cũ: thẻ cao kịch khung rồi suy bề ngang theo dáng điện thoại,
//     kẹp trần để hai thẻ kề bên vẫn ló mép (desktop không có chuyện thanh URL).
// Trả về true khi khổ thật sự đổi — resize gọi lại setActiveCard theo đó.
function sizeCarousel() {
  const stage = document.getElementById("templateCarousel");
  if (!stage) return false;
  const h = stage.clientHeight;
  const w = stage.clientWidth;
  if (!h || !w) return false;

  let cardW, cardH;
  if (w < 640) {
    cardW = Math.round(w * 0.8);
    cardH = Math.round(h * 0.8);
  } else {
    const ASPECT = 0.64;
    cardH = h;
    cardW = Math.round(cardH * ASPECT);

    const maxW = Math.min(w * 0.5, 580);
    if (cardW > maxW) {
      cardW = Math.round(maxW);
      cardH = Math.round(cardW / ASPECT);
    }
    // Không bao giờ cao hơn khung: thẻ cao quá là mép trên/dưới (kể cả cụm nút
    // trong lớp phủ) bị cắt mất.
    if (cardH > h) {
      cardH = h;
      cardW = Math.round(cardH * ASPECT);
    }
  }

  if (cardW === _cardW && cardH === _cardH) return false;
  _cardW = cardW;
  _cardH = cardH;
  stage.style.setProperty("--cx-card-w", cardW + "px");
  stage.style.setProperty("--cx-card-h", cardH + "px");
  return true;
}

function updateDots() {
  const container = document.getElementById("carouselDots");
  if (!container) return;
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

  // Touch / swipe
  let touchStartX = 0,
    touchStartTime = 0;
  stage.addEventListener(
    "touchstart",
    (e) => {
      touchStartX = e.touches[0].clientX;
      touchStartTime = Date.now();
    },
    { passive: true },
  );
  stage.addEventListener(
    "touchend",
    (e) => {
      const delta = e.changedTouches[0].clientX - touchStartX;
      if (Math.abs(delta) > 40 && Date.now() - touchStartTime < 400)
        scrollCarousel(delta < 0 ? "next" : "prev");
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

