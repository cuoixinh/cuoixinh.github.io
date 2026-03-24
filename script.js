const images = ['img1', 'img2', 'img3', 'img4', 'img5', 'img6', 'img7'];
const track = document.getElementById('carousel-track');
const dotsContainer = document.getElementById('carousel-dots');
const container = document.getElementById('gallery-carousel');
let current = 3; // index 3 = ảnh số 4, mặc định focus
let startX = 0;
let isDragging = false;

// Render items & dots
for (let i = 0; i < images.length; i++) {
    const item = document.createElement('div');
    item.className = 'carousel-item shrink-0 rounded-2xl overflow-hidden cursor-pointer';
    item.style.cssText = 'transition: width 0.4s cubic-bezier(0.4,0,0.2,1), height 0.4s cubic-bezier(0.4,0,0.2,1), opacity 0.4s cubic-bezier(0.4,0,0.2,1), box-shadow 0.4s ease;';
    item.innerHTML = `<img src="assets/images/${images[i]}.jpg" class="w-full h-full object-cover pointer-events-none" alt="">`;
    item.addEventListener('click', () => { if (i !== current) { current = i; update(); } });
    track.appendChild(item);

    const dot = document.createElement('div');
    dot.style.cssText = 'height:6px; border-radius:9999px; transition: all 0.3s;';
    dotsContainer.appendChild(dot);
}

// Fix container height = tallest item (ảnh giữa to nhất)
function fixHeight() {
    const trackWidth = track.offsetWidth;
    const tallest = (trackWidth * 0.36) * (4 / 3);
    container.style.height = tallest + 'px';
    track.style.height = tallest + 'px';
    track.style.alignItems = 'center';
}

function update() {
    const items = track.querySelectorAll('.carousel-item');
    const dots = dotsContainer.querySelectorAll('div');

    for (let i = 0; i < items.length; i++) {
        const diff = Math.abs(i - current);
        if (diff === 0) {
            items[i].style.width = '36%';
            items[i].style.height = '100%';
            items[i].style.opacity = '1';
            items[i].style.transform = 'none';
            items[i].style.zIndex = '10';
            items[i].style.boxShadow = '0 20px 40px rgba(212,165,165,0.3)';
            items[i].style.visibility = 'visible';
        } else if (diff === 1) {
            const sideH = (track.offsetWidth * 0.28) * (4 / 3);
            const mainH = (track.offsetWidth * 0.36) * (4 / 3);
            const ratio = sideH / mainH; // ~0.85
            items[i].style.width = '28%';
            items[i].style.height = (ratio * 100) + '%';
            items[i].style.opacity = '0.55';
            items[i].style.transform = 'none';
            items[i].style.zIndex = '5';
            items[i].style.boxShadow = '0 4px 12px rgba(212,165,165,0.1)';
            items[i].style.visibility = 'visible';
        } else {
            items[i].style.width = '0';
            items[i].style.opacity = '0';
            items[i].style.visibility = 'hidden';
        }

        dots[i].style.background = i === current ? '#d4a5a5' : '#f5d5d8';
        dots[i].style.width = i === current ? '16px' : '6px';
    }
}

// Swipe handlers
function onStart(x) { startX = x; isDragging = true; }
function onEnd(x) {
    if (!isDragging) return;
    isDragging = false;
    const diff = startX - x;
    if (Math.abs(diff) > 30) {
        current = diff > 0
            ? Math.min(current + 1, images.length - 1)
            : Math.max(current - 1, 0);
        update();
    }
}

track.addEventListener('touchstart', e => onStart(e.touches[0].clientX), { passive: true });
track.addEventListener('touchend', e => onEnd(e.changedTouches[0].clientX));
track.addEventListener('mousedown', e => onStart(e.clientX));
track.addEventListener('mouseup', e => onEnd(e.clientX));
track.addEventListener('mouseleave', () => { isDragging = false; });

// Init
window.addEventListener('resize', fixHeight);
fixHeight();
update();
