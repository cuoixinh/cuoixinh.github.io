// ============= IMAGE SCROLL ANIMATION =============

// % chiều cao ảnh trượt mỗi frame. 60fps → 0.03 mất ~55s cho một lượt quét
// hết thiệp; nhanh hơn nữa thì người xem không kịp đọc nội dung thiệp mẫu.
const IMG_SCROLL_STEP = 0.03;

let _imgScrollPos = 0;
let _imgScrollDir = 1;
let _imgScrollPaused = false;
let _imgScrollRafId = null;

function startImageScroll() {
  if (_imgScrollRafId) return;

  function tick() {
    _imgScrollRafId = requestAnimationFrame(tick);
    if (_imgScrollPaused) return;

    const activeCard = document.querySelector(".carousel-3d-card.is-active");
    if (!activeCard) return;
    const img = activeCard.querySelector("img[src]");
    if (!img) return;

    _imgScrollPos += IMG_SCROLL_STEP * _imgScrollDir;
    if (_imgScrollPos >= 100) { _imgScrollPos = 100; _imgScrollDir = -1; }
    if (_imgScrollPos <= 0)   { _imgScrollPos = 0;   _imgScrollDir = 1;  }

    img.style.objectPosition = `center ${_imgScrollPos}%`;
  }

  _imgScrollRafId = requestAnimationFrame(tick);

  // Pause on hover
  document.getElementById("templateCarouselInner")?.addEventListener("mouseenter", () => {
    _imgScrollPaused = true;
  }, { passive: true });
  document.getElementById("templateCarouselInner")?.addEventListener("mouseleave", () => {
    _imgScrollPaused = false;
  }, { passive: true });
}

// Reset scroll position when carousel slide changes
function resetImageScroll() {
  _imgScrollPos = 0;
  _imgScrollDir = 1;
  const activeCard = document.querySelector(".carousel-3d-card.is-active");
  if (activeCard) {
    const img = activeCard.querySelector("img[src]");
    if (img) img.style.objectPosition = "center 0%";
  }
}

