# CHUẨN TẠO TEMPLATE THIỆP CƯỚI

> Tài liệu này mô tả cấu trúc và quy chuẩn để tạo template thiệp cưới mới cho hệ thống.

---

## 📁 CẤU TRÚC FILE

Mỗi template cần 3 file chính:

```
public/themes/
├── template{N}.html      # Giao diện HTML
├── template{N}.js        # Logic xử lý
└── preview-data.js       # Dữ liệu mẫu (dùng chung)
```

---

## 🎯 CHỨC NĂNG BẮT BUỘC

### 1. Preview Mode

- Hỗ trợ xem thử với `?preview=true`
- Tự động load dữ liệu mẫu từ `preview-data.js`
- Bỏ qua cover screen, vào thẳng màn chính
- Chặn các chức năng: RSVP, lưu QR, đánh dấu đã xem

### 2. Personalized Greeting (Lời chào cá nhân)

- Đọc tham số `?name=xxx&relationship=xxx` từ URL
- Giải mã bằng `decryptData()` từ utils.js
- Hiển thị tên khách mời trên cover screen
- Hiển thị RSVP section khi có tên khách

### 3. YouTube Music Player

- Hỗ trợ nhạc nền từ YouTube
- Nút play/pause cố định: `bottom-[48px] right-4`
- Tự động phát khi mở thiệp (không phải cover)
- Ẩn nút nếu không có nhạc

### 4. Carousel Gallery

- Hiển thị ảnh gallery với hiệu ứng carousel
- Ảnh giữa to nhất, 2 bên nhỏ hơn
- Swipe để chuyển ảnh
- Click vào ảnh giữa để mở lightbox

### 5. Lightbox

- Xem ảnh toàn màn hình
- Pinch to zoom (2 ngón tay)
- Swipe để chuyển ảnh
- Hiển thị counter (1/5)

### 6. Mini Calendar

- Hiển thị lịch tháng với 2 ngày được khoanh tròn
- Ngày 1: Lễ thành hôn
- Ngày 2: Tiệc cưới

### 7. QR Code

- Hiển thị QR chú rể và cô dâu
- Nút "Lưu QR" để tải về
- Hỗ trợ Web Share API trên mobile

### 8. Google Maps

- Hiển thị bản đồ địa điểm tổ chức
- Iframe preview + link mở Maps
- Hỗ trợ cả URL và iframe HTML

### 9. RSVP (Xác nhận tham dự)

- Chỉ hiển thị khi có personalized link
- 2 nút: Tham dự / Không tham dự
- Hiển thị thông báo sau khi chọn

### 10. Responsive Design

- Tối ưu cho mobile (430px)
- Hỗ trợ desktop với max-width
- Bo góc 40px trên desktop
- Fix viewport height cho iOS

---

## 📋 CẤU TRÚC HTML BẮT BUỘC

### 1. HEAD Section

```html
<head>
  <meta charset="UTF-8" />
  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover"
  />
  <title>Thiệp Cưới Online</title>
  <link rel="icon" type="image/png" href="../../assets/icons/logo.png" />

  <!-- Tailwind CSS -->
  <script src="https://cdn.tailwindcss.com"></script>

  <!-- Font Awesome -->
  <link
    rel="stylesheet"
    href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"
  />

  <!-- Google Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=..." rel="stylesheet" />

  <!-- Common CSS -->
  <link rel="stylesheet" href="../../styles/common.css" />

  <!-- CryptoJS for decryption -->
  <script src="https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.1.1/crypto-js.min.js"></script>
</head>
```

### 2. BODY Structure

```html
<body
  class="bg-gradient-to-br from-cream-50 via-[#f5ebe0] to-cream-50 min-h-screen flex justify-center items-center p-0 md:py-5"
>
  <!-- Music Control Button -->
  <button id="music-toggle" class="fixed bottom-[48px] right-4 z-[60] ...">
    <i id="music-icon" class="fas fa-music"></i>
  </button>

  <!-- Cover Screen -->
  <div id="cover-screen" class="fixed inset-0 z-50 ...">
    <!-- Cover content -->
  </div>

  <!-- Main Card -->
  <div
    id="main-card"
    class="relative w-full max-w-[430px] min-h-screen md:min-h-[932px] ..."
    style="display: none"
  >
    <!-- Main content -->
  </div>

  <!-- Lightbox -->
  <div id="lightbox" class="fixed inset-0 z-[100] bg-black/95 hidden ...">
    <!-- Lightbox content -->
  </div>

  <!-- Scripts -->
  <script src="preview-data.js"></script>
  <script src="../../core/config.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
  <script src="../../core/dal/wedding-dal.js"></script>
  <script src="../../core/dal/storage-dal.js"></script>
  <script src="../../core/bl/wedding-bl.js"></script>
  <script src="../../core/bl/image-bl.js"></script>
  <script src="../../core/supabase.js"></script>
  <script src="../../core/utils.js"></script>
  <script src="template{N}.js"></script>
</body>
```

---

## 🆔 ID ELEMENTS BẮT BUỘC

### Cover Screen

```
cover-bg-img          # Ảnh nền cover
cover-guest-name      # Tên khách mời
cover-groom-name      # Tên chú rể
cover-bride-name      # Tên cô dâu
```

### Main Content - Couple Names

```
couple-names-groom    # Tên chú rể (header)
couple-names-bride    # Tên cô dâu (header)
main-photo            # Ảnh chính
```

### Groom Info

```
groom-photo           # Ảnh chú rể
groom-name-label      # Tên chú rể
groom-father          # Tên bố chú rể
groom-mother          # Tên mẹ chú rể
groom-address         # Địa chỉ nhà trai
```

### Bride Info

```
bride-photo           # Ảnh cô dâu
bride-name-label      # Tên cô dâu
bride-father          # Tên bố cô dâu
bride-mother          # Tên mẹ cô dâu
bride-address         # Địa chỉ nhà gái
```

### Ceremony Info

```
invite-groom          # Tên chú rể (lời mời)
invite-bride          # Tên cô dâu (lời mời)
invite-day            # Ngày (số)
invite-month-year     # Tháng · Năm
invite-weekday        # Thứ
invite-time           # Giờ
invite-lunar          # Ngày âm lịch
```

### Party Info

```
party-datetime        # Giờ - Ngày.Tháng.Năm
party-lunar           # Ngày âm lịch
party-location        # Địa điểm tổ chức
```

### RSVP

```
rsvp-section          # Container (display: none mặc định)
btn-attend            # Nút tham dự
btn-decline           # Nút không tham dự
attend-msg            # Thông báo sau khi chọn
```

### Gallery

```
gallery-carousel      # Container carousel
carousel-track        # Track chứa các ảnh
carousel-dots         # Dots indicator
```

### QR Code - Groom

```
groom-bank-label      # Tên chú rể
groom-bank-name       # Tên ngân hàng
groom-bank-number     # Số tài khoản
groom-bank-owner      # Chủ tài khoản
groom-qr-img          # Ảnh QR
```

### QR Code - Bride

```
bride-bank-label      # Tên cô dâu
bride-bank-name       # Tên ngân hàng
bride-bank-number     # Số tài khoản
bride-bank-owner      # Chủ tài khoản
bride-qr-img          # Ảnh QR
```

### Map

```
map-location-name     # Tên địa điểm
map-link              # Link mở Maps
map-thumbnail-iframe  # Iframe preview
```

### Story

```
story-quote           # Câu quote tình yêu
```

### Calendar

```
mini-calendar         # Container lịch
```

### Music

```
music-toggle          # Nút play/pause
music-icon            # Icon nhạc
```

### Lightbox

```
lightbox              # Container lightbox
lb-img                # Ảnh trong lightbox
lb-counter            # Counter (1/5)
```

---

## 🔧 JAVASCRIPT BẮT BUỘC

### 1. Biến Global

```javascript
// Get slug and isGroom from URL
const _weddingSlug = getSlugFromUrl();
const _isGroom = isGroomSide();

// YouTube player
let youtubePlayer = null;
let isYouTubeMusicReady = false;
let isYouTubePlaying = false;

// Carousel
const images = [];
const track = document.getElementById("carousel-track");
const dotsContainer = document.getElementById("carousel-dots");
const container = document.getElementById("gallery-carousel");
let current = 0;

// Lightbox
const lightbox = document.getElementById("lightbox");
const lbImg = document.getElementById("lb-img");
const lbCounter = document.getElementById("lb-counter");
let lbIndex = 0;
let lbScale = 1;

// Mini Calendar
const weddingDates = [
  { year: 2024, month: 10, day: 20 }, // Lễ thành hôn
  { year: 2024, month: 10, day: 21 }, // Tiệc cưới
];

// Mark viewed callback
let _markViewedCallback = null;
```

### 2. Hàm Bắt Buộc

#### YouTube Music

```javascript
function loadYouTubeAPI()
function extractYouTubeVideoId(url)
function initYouTubeMusic(musicUrl)
function toggleYouTubeMusic()
function updateMusicIcon()
window.onYouTubeIframeAPIReady = function()
```

#### Render Wedding Data

```javascript
function renderWedding(w) {
  // Xử lý music
  // Render cover
  // Render main content
  // Render gallery
  // Render QR
  // Render map
  // Render calendar
}
```

#### Load Data

```javascript
async function loadWeddingData() {
  if (!_weddingSlug) {
    if (!isPreviewMode()) {
      window.location.href = "/";
    }
    return;
  }

  try {
    const wedding = await weddingBL.getWeddingBySlug(_weddingSlug);

    if (!weddingBL.isActive(wedding)) {
      if (!isPreviewMode()) {
        window.location.href = "/";
      }
      return;
    }

    renderWedding(wedding);
  } catch (error) {
    console.error("Lỗi load wedding data:", error);
    if (!isPreviewMode()) {
      window.location.href = "/";
    }
  }
}

loadWeddingData();
```

#### Personalized Greeting

```javascript
function setupPersonalizedGreeting() {
  // Preview mode: vào thẳng màn chính
  if (isPreviewMode()) {
    openInvitation();
    return;
  }

  const urlParams = new URLSearchParams(window.location.search);
  const encryptedName = urlParams.get("name");
  const encryptedRelationship = urlParams.get("relationship");

  // Không có tham số → vào thẳng màn chính
  if (!encryptedName || !encryptedRelationship) {
    openInvitation();
    return;
  }

  // Giải mã và hiển thị
  try {
    const name = decryptData(encryptedName);
    const relationship = decryptData(encryptedRelationship);

    if (!name || !relationship) {
      openInvitation();
      return;
    }

    // Hiển thị tên khách
    const coverGuestName = document.getElementById("cover-guest-name");
    if (coverGuestName) coverGuestName.textContent = name;

    // Hiển thị RSVP
    const rsvpSection = document.getElementById("rsvp-section");
    if (rsvpSection) rsvpSection.style.display = "flex";
  } catch (error) {
    openInvitation();
    return;
  }

  // Chuẩn bị markViewed
  if (_weddingSlug && !isPreviewMode()) {
    weddingBL
      .getWeddingBySlug(_weddingSlug)
      .then((wedding) => {
        const urlParams = new URLSearchParams(window.location.search);
        _markViewedCallback = () => {
          weddingBL.trackView(wedding, _isGroom, urlParams);
        };
      })
      .catch(() => {});
  }
}

// Call on page load
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", setupPersonalizedGreeting);
} else {
  setupPersonalizedGreeting();
}
```

#### Cover Screen

```javascript
function openInvitation() {
  // Đánh dấu đã xem (CHẶN trong preview mode)
  if (_markViewedCallback && !isPreviewMode()) {
    _markViewedCallback();
    _markViewedCallback = null;
  }

  const cover = document.getElementById("cover-screen");
  const main = document.getElementById("main-card");

  // Preview mode: ẩn cover ngay, không animation
  if (isPreviewMode()) {
    cover.style.display = "none";
    main.style.display = "";
    main.style.opacity = "1";
    fixHeight();
    update();
    setTimeout(attachClickHandler, 100);
    window.scrollTo({ top: 0 });
    return;
  }

  // Normal mode: có animation
  cover.classList.add("closing");
  setTimeout(() => {
    cover.style.display = "none";
    main.style.display = "";
    main.style.opacity = "0";
    main.style.transition = "opacity 0.5s ease";
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        main.style.opacity = "1";
        fixHeight();
        update();
        setTimeout(attachClickHandler, 100);
      });
    });
    window.scrollTo({ top: 0 });
  }, 600);
}
```

#### Carousel Gallery

```javascript
function fixHeight() {
  const trackWidth = track.offsetWidth;
  const tallest = trackWidth * 0.36 * (4 / 3);
  container.style.height = tallest + "px";
  track.style.height = tallest + "px";
  track.style.alignItems = "center";
}

function update() {
  const items = track.querySelectorAll(".carousel-item");
  const dots = dotsContainer.querySelectorAll("div");

  for (let i = 0; i < items.length; i++) {
    const diff = Math.abs(i - current);
    if (diff === 0) {
      // Ảnh giữa: to nhất
      items[i].style.width = "36%";
      items[i].style.height = "100%";
      items[i].style.opacity = "1";
      items[i].style.zIndex = "10";
      items[i].style.boxShadow = "0 20px 40px rgba(212,165,165,0.3)";
      items[i].style.visibility = "visible";
    } else if (diff === 1) {
      // Ảnh 2 bên: nhỏ hơn
      const sideH = track.offsetWidth * 0.28 * (4 / 3);
      const mainH = track.offsetWidth * 0.36 * (4 / 3);
      const ratio = sideH / mainH;
      items[i].style.width = "28%";
      items[i].style.height = ratio * 100 + "%";
      items[i].style.opacity = "0.55";
      items[i].style.zIndex = "5";
      items[i].style.boxShadow = "0 4px 12px rgba(212,165,165,0.1)";
      items[i].style.visibility = "visible";
    } else {
      // Ảnh xa: ẩn
      items[i].style.width = "0";
      items[i].style.opacity = "0";
      items[i].style.visibility = "hidden";
    }

    // Update dots
    dots[i].style.background = i === current ? "#d4a5a5" : "#f5d5d8";
    dots[i].style.width = i === current ? "16px" : "6px";
  }
}

// Swipe handlers
function onStart(x) {
  startX = x;
  isDragging = true;
}

function onEnd(x) {
  if (!isDragging) return;
  isDragging = false;
  const diff = startX - x;
  if (Math.abs(diff) > 30) {
    current =
      diff > 0
        ? Math.min(current + 1, images.length - 1)
        : Math.max(current - 1, 0);
    update();
  }
}

track.addEventListener("touchstart", (e) => onStart(e.touches[0].clientX), {
  passive: true,
});
track.addEventListener("touchend", (e) => onEnd(e.changedTouches[0].clientX));
track.addEventListener("mousedown", (e) => onStart(e.clientX));
track.addEventListener("mouseup", (e) => onEnd(e.clientX));

// Click handler
function attachClickHandler() {
  track.querySelectorAll(".carousel-item").forEach((item, i) => {
    const clone = item.cloneNode(true);
    item.parentNode.replaceChild(clone, item);
    clone.dataset.index = i;
    clone.addEventListener("click", () => {
      const idx = parseInt(clone.dataset.index);
      if (idx === current) {
        openLightbox(idx);
      } else {
        current = idx;
        update();
      }
    });
  });
}

// Resize listener
window.addEventListener("resize", fixHeight);
```

#### Lightbox

```javascript
function openLightbox(index) {
  lbIndex = index;
  lightbox.classList.remove("hidden");
  lightbox.classList.add("flex");
  // Cho phép zoom
  document
    .querySelector('meta[name="viewport"]')
    .setAttribute(
      "content",
      "width=device-width, initial-scale=1.0, viewport-fit=cover",
    );
  lbShow();
}

function closeLightbox() {
  lightbox.classList.add("hidden");
  lightbox.classList.remove("flex");
  // Chặn zoom lại
  document
    .querySelector('meta[name="viewport"]')
    .setAttribute(
      "content",
      "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover",
    );
  lbScale = 1;
  lbImg.style.transform = "scale(1)";
}

function lbShow() {
  lbImg.style.opacity = "0";
  setTimeout(() => {
    lbImg.src = images[lbIndex];
    lbCounter.textContent = `${lbIndex + 1} / ${images.length}`;
    lbImg.style.opacity = "1";
  }, 150);
}

function lbNext() {
  lbIndex = (lbIndex + 1) % images.length;
  lbShow();
}

function lbPrev() {
  lbIndex = (lbIndex - 1 + images.length) % images.length;
  lbShow();
}

// Swipe trong lightbox
let lbStartX = 0;
lightbox.addEventListener(
  "touchstart",
  (e) => {
    lbStartX = e.touches[0].clientX;
  },
  { passive: true },
);

lightbox.addEventListener("touchend", (e) => {
  const diff = lbStartX - e.changedTouches[0].clientX;
  if (Math.abs(diff) > 50) diff > 0 ? lbNext() : lbPrev();
});

// Đóng khi click nền
lightbox.addEventListener("click", (e) => {
  if (e.target === lightbox) closeLightbox();
});

// Pinch to zoom
let lbLastDist = 0;
let lbPinching = false;

function getDist(touches) {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

lbImg.addEventListener(
  "touchstart",
  (e) => {
    if (e.touches.length === 2) {
      lbPinching = true;
      lbLastDist = getDist(e.touches);
      e.preventDefault();
    }
  },
  { passive: false },
);

lbImg.addEventListener(
  "touchmove",
  (e) => {
    if (e.touches.length === 2 && lbPinching) {
      const dist = getDist(e.touches);
      const ratio = dist / lbLastDist;
      lbScale = Math.min(Math.max(lbScale * ratio, 1), 4);
      lbImg.style.transform = `scale(${lbScale})`;
      lbLastDist = dist;
      e.preventDefault();
    }
  },
  { passive: false },
);

lbImg.addEventListener("touchend", (e) => {
  if (e.touches.length < 2) {
    lbPinching = false;
    if (lbScale < 1.05) {
      lbScale = 1;
      lbImg.style.transition = "transform 0.2s ease";
      lbImg.style.transform = "scale(1)";
      setTimeout(() => (lbImg.style.transition = ""), 200);
    }
  }
});
```

#### Mini Calendar

```javascript
function renderMiniCalendar() {
  const container = document.getElementById("mini-calendar");
  if (!container) return;

  const { year, month } = weddingDates[0];
  const markedDays = weddingDates.map((d) => d.day);

  const dayNames = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();

  let html = `
    <div style="font-family:'Inter',sans-serif;">
      <!-- Header tháng -->
      <div style="text-align:center; font-size:12px; letter-spacing:2px; text-transform:uppercase; color:#a8a29e; font-weight:600; margin-bottom:10px;">
        Tháng ${month} · ${year}
      </div>
      <!-- Tên thứ -->
      <div style="display:grid; grid-template-columns:repeat(7,1fr); gap:2px; margin-bottom:4px;">
        ${dayNames.map((d) => `<div style="text-align:center; font-size:10px; color:#c7c2bd; padding:2px 0;">${d}</div>`).join("")}
      </div>
      <!-- Các ngày -->
      <div style="display:grid; grid-template-columns:repeat(7,1fr); gap:2px;">
        ${Array(firstDay).fill("<div></div>").join("")}
        ${Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1;
          const isMarked = markedDays.includes(day);
          return `<div style="display:flex; align-items:center; justify-content:center; height:32px;">
            <div style="
              width:28px; height:28px;
              display:flex; align-items:center; justify-content:center;
              border-radius:50%;
              font-size:11px;
              ${
                isMarked
                  ? "background:#d4a5a5; color:white; font-weight:600; box-shadow:0 2px 6px rgba(212,165,165,0.4);"
                  : "color:#78716c;"
              }
            ">${day}</div>
          </div>`;
        }).join("")}
      </div>
    </div>
  `;

  container.innerHTML = html;
}

renderMiniCalendar();
```

#### Save QR (CHẶN trong preview mode)

```javascript
async function saveQR(id) {
  if (showPreviewAlert()) return;

  const img = document.querySelector(`img[src*="${id}"]`);
  const filename = `${id}.png`;

  try {
    const response = await fetch(img.src);
    const blob = await response.blob();
    const file = new File([blob], filename, { type: "image/png" });

    // iOS/Android: Web Share API
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: "QR Mừng Cưới" });
    } else {
      // Desktop: download
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);
    }
  } catch (e) {
    // Fallback: mở tab mới
    window.open(img.src, "_blank");
  }
}
```

#### RSVP (CHẶN trong preview mode)

```javascript
function confirmAttend(attending) {
  if (showPreviewAlert()) return;

  const btnAttend = document.getElementById("btn-attend");
  const btnDecline = document.getElementById("btn-decline");
  const msg = document.getElementById("attend-msg");

  btnAttend.classList.remove("btn-idle", "btn-selected");
  btnDecline.classList.remove("btn-idle", "btn-selected");
  btnAttend.style.cssText = "";
  btnDecline.style.cssText = "";

  if (attending) {
    btnAttend.style.background = "rgba(212,165,165,0.2)";
    btnAttend.style.borderColor = "#d4a5a5";
    btnAttend.classList.add("btn-selected");
    msg.textContent = "Cảm ơn bạn! Chúng tôi rất mong được gặp bạn 🌸";
  } else {
    btnDecline.style.background = "rgba(168,162,158,0.1)";
    btnDecline.style.borderColor = "#a8a29e";
    btnDecline.classList.add("btn-selected");
    msg.textContent = "Cảm ơn bạn đã phản hồi. Chúc bạn nhiều sức khỏe!";
  }

  msg.classList.remove("hidden");
}

// Idle pulse animation
document.getElementById("btn-attend").classList.add("btn-idle");
document.getElementById("btn-decline").classList.add("btn-idle");
```

#### Viewport Fix (iOS)

```javascript
initViewportFix();
```

#### Scroll Reveal Animations

```javascript
const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        revealObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.15 },
);

document
  .querySelectorAll(
    [
      ".invitation-content > *",
      ".w-full.flex.flex-col.gap-8 > *",
      ".flex.gap-4.items-start",
      ".flex.flex-col.gap-4.border",
      ".gallery-item",
    ].join(","),
  )
  .forEach((el, i) => {
    const mod = i % 3;
    if (mod === 0) el.classList.add("reveal", "from-bottom");
    else if (mod === 1) el.classList.add("reveal", "from-left");
    else el.classList.add("reveal", "from-right");

    revealObserver.observe(el);
  });
```

---

## 📦 UTILS FUNCTIONS (từ core/utils.js)

### DOM Helpers

```javascript
setText(id, value, placeholder); // Set text content
setAttr(id, attr, value, placeholder); // Set attribute
setImageWithRing(id, filename); // Set image với ring border
```

### Image Helpers

```javascript
getImageUrl(filename); // Get full URL từ filename
createPlaceholderSVG(text); // Tạo placeholder SVG
```

### Map Helpers

```javascript
extractMapEmbedUrl(value); // Extract clean embed URL
```

### Encryption Helpers

```javascript
decryptData(encryptedText); // Giải mã AES
```

### Preview Mode Helpers

```javascript
isPreviewMode(); // Check preview mode
showPreviewAlert(); // Hiển thị toast alert
```

### Viewport Helpers

```javascript
setVH(); // Set viewport height
initViewportFix(); // Init viewport fix
```

### URL Helpers

```javascript
getSlugFromUrl(); // Get slug từ URL
isGroomSide(); // Check isGroom param
```

### Image Crop Helpers

```javascript
openImageCropModal(file, callback); // Mở modal crop ảnh
closeCropModal(); // Đóng modal
applyCrop(); // Áp dụng crop
```

---

## 🎨 CSS CLASSES (từ styles/common.css)

### Animations

```css
.reveal                    /* Scroll reveal animation */
.from-bottom              /* Slide from bottom */
.from-left                /* Slide from left */
.from-right               /* Slide from right */
.visible                  /* Visible state */

.btn-shimmer              /* Button shimmer effect */
.shimmer-text             /* Text shimmer effect */

.btn-idle                 /* Button idle pulse */
.btn-selected             /* Button selected state */

.closing                  /* Cover closing animation */
```

### Utilities

```css
.bg-gradient-radial       /* Radial gradient */
```

---

## 🔌 BL/DAL LAYER

### Wedding BL (weddingBL)

```javascript
await weddingBL.getWeddingBySlug(slug);
await weddingBL.getWeddingById(id);
weddingBL.isActive(wedding);
await weddingBL.trackView(wedding, isGroom, urlParams);
await weddingBL.getGuestName(scriptUrl, slug);
```

### Image BL (imageBL)

```javascript
await imageBL.uploadSingleImage(weddingId, fieldName, file);
await imageBL.uploadMultipleImages(weddingId, files);
await imageBL.deleteImages(filenames);
imageBL.validateImageFile(file);
await imageBL.resizeImage(file);
```

### Storage DAL (storageDAL)

```javascript
storageDAL.getPublicUrl(filename);
await storageDAL.uploadFile(filename, file);
await storageDAL.deleteFiles(filenames);
```

---

## ✅ CHECKLIST TẠO TEMPLATE MỚI

### 1. Tạo File

- [ ] `public/themes/template{N}.html`
- [ ] `public/themes/template{N}.js`
- [ ] Sử dụng `preview-data.js` có sẵn

### 2. HTML Structure

- [ ] Copy head section từ template1
- [ ] Tạo body với 4 phần: music button, cover, main card, lightbox
- [ ] Thêm tất cả ID elements bắt buộc
- [ ] Thêm scripts theo đúng thứ tự

### 3. JavaScript

- [ ] Khai báo biến global
- [ ] Implement YouTube music player
- [ ] Implement renderWedding()
- [ ] Implement loadWeddingData()
- [ ] Implement setupPersonalizedGreeting()
- [ ] Implement openInvitation()
- [ ] Implement carousel gallery
- [ ] Implement lightbox
- [ ] Implement mini calendar
- [ ] Implement saveQR()
- [ ] Implement confirmAttend()
- [ ] Init viewport fix
- [ ] Setup scroll reveal animations

### 4. Preview Mode

- [ ] Kiểm tra `?preview=true` hoạt động
- [ ] Tự động load dữ liệu mẫu
- [ ] Bỏ qua cover screen
- [ ] Chặn RSVP, lưu QR, mark viewed

### 5. Responsive

- [ ] Test trên mobile (430px)
- [ ] Test trên desktop
- [ ] Bo góc 40px trên desktop
- [ ] Fix viewport height iOS

### 6. Chức Năng

- [ ] YouTube music player
- [ ] Personalized greeting
- [ ] Carousel gallery + swipe
- [ ] Lightbox + pinch zoom
- [ ] Mini calendar
- [ ] QR code + save
- [ ] Google Maps
- [ ] RSVP
- [ ] Scroll reveal animations

### 7. Testing

- [ ] Test với dữ liệu thật
- [ ] Test với personalized link
- [ ] Test preview mode
- [ ] Test trên iOS Safari
- [ ] Test trên Android Chrome
- [ ] Test trên desktop browsers

---

## 🚨 LƯU Ý QUAN TRỌNG

1. **Preview Mode**: Luôn kiểm tra `isPreviewMode()` trước khi gọi API hoặc thực hiện hành động
2. **Music URL**: Nếu rỗng = không có nhạc (ẩn nút), không phải nhạc mặc định
3. **Music Button Position**: Luôn `bottom-[48px] right-4` trên mọi thiết bị
4. **Gallery Images**: Nếu không có ảnh, hiển thị 3 placeholder
5. **QR Images**: Luôn crop 1:1 aspect ratio
6. **Map Embed**: Hỗ trợ cả URL và iframe HTML
7. **RSVP**: Chỉ hiển thị khi có personalized link
8. **Mark Viewed**: Chỉ gọi 1 lần khi click "Mở Thiệp"
9. **iOS Fixes**: Viewport fix, touch-action, -webkit-tap-highlight-color
10. **Script Order**: Phải load đúng thứ tự: preview-data → config → supabase → dal → bl → supabase init → utils → template.js

---

## 📚 TÀI LIỆU THAM KHẢO

- Template1: `public/themes/template1.html`, `public/themes/template1.js`
- Utils: `core/utils.js`
- BL Layer: `core/bl/wedding-bl.js`, `core/bl/image-bl.js`
- DAL Layer: `core/dal/wedding-dal.js`, `core/dal/storage-dal.js`
- Common CSS: `styles/common.css`
- Preview Data: `public/themes/preview-data.js`

---

**Lưu ý**: Tài liệu này được tạo dựa trên template1. Khi tạo template mới, có thể tùy chỉnh giao diện nhưng phải giữ nguyên cấu trúc, ID elements, và các hàm bắt buộc để đảm bảo tương thích với hệ thống.
