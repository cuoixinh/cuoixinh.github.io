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

// Tính kích thước card để thiệp active lấp đầy chiều cao khả dụng (to & rộng nhất),
// giữ tỉ lệ dáng điện thoại; giới hạn bề rộng để card kề bên vẫn ló mép.
function sizeCarousel() {
  const stage = document.getElementById("templateCarousel");
  if (!stage) return;
  const h = stage.clientHeight;
  const w = stage.clientWidth;
  if (!h || !w) return;

  // Desktop dùng tỉ lệ rộng hơn để thiệp to hơn hẳn mobile (chiều cao đã kịch trần)
  const mobile = w < 640;
  const ASPECT = mobile ? 0.52 : 0.64;
  let cardH = h;
  let cardW = Math.round(cardH * ASPECT);

  const maxW = mobile ? w * 0.9 : Math.min(w * 0.5, 580);
  if (cardW > maxW) {
    cardW = Math.round(maxW);
    cardH = Math.round(cardW / ASPECT);
  }

  // Không bao giờ cao hơn khung: thẻ cao quá là mép trên/dưới (kể cả cụm nút
  // trong lớp phủ) bị cắt mất, ở điện thoại thấy rõ nhất.
  if (cardH > h) {
    cardH = h;
    cardW = Math.round(cardH * ASPECT);
  }

  _cardW = cardW;
  stage.style.setProperty("--cx-card-w", cardW + "px");
  stage.style.setProperty("--cx-card-h", cardH + "px");
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

  // Resize → tính lại kích thước card + transform
  let resizeTimer = null;
  window.addEventListener(
    "resize",
    () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        sizeCarousel();
        setActiveCard(carouselActiveIndex);
      }, 120);
    },
    { passive: true },
  );

  sizeCarousel();
  setActiveCard(0);
}

