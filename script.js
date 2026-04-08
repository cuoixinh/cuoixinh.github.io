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
let hintTimer = null;

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

// Show zoom hint khi carousel scroll vào viewport lần đầu
const carouselObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            carouselObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.5 });
carouselObserver.observe(container);

// Save QR
async function saveQR(id) {
    const img = document.querySelector(`img[src*="${id}"]`);
    const filename = `${id}.png`;

    try {
        const response = await fetch(img.src);
        const blob = await response.blob();
        const file = new File([blob], filename, { type: 'image/png' });

        // iOS/Android: dùng Web Share API nếu có (share + lưu ảnh)
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({ files: [file], title: 'QR Mừng Cưới' });
        } else {
            // Desktop: download trực tiếp
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = filename;
            a.click();
            URL.revokeObjectURL(a.href);
        }
    } catch (e) {
        // Fallback: mở ảnh tab mới
        window.open(img.src, '_blank');
    }
}


// Mini Calendar
// Config: 2 ngày cần khoanh
const weddingDates = [
    { year: 2024, month: 10, day: 20 }, // Lễ thành hôn
    { year: 2024, month: 10, day: 21 }, // Tiệc cưới
];

function renderMiniCalendar() {
    const container = document.getElementById('mini-calendar');
    if (!container) return;

    // Lấy tháng/năm từ ngày đầu tiên
    const { year, month } = weddingDates[0];
    const markedDays = weddingDates.map(d => d.day);

    const dayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    const firstDay = new Date(year, month - 1, 1).getDay(); // 0=CN
    const daysInMonth = new Date(year, month, 0).getDate();

    let html = `
        <div style="font-family:'Inter',sans-serif;">
            <!-- Header tháng -->
            <div style="text-align:center; font-size:12px; letter-spacing:2px; text-transform:uppercase; color:#a8a29e; font-weight:600; margin-bottom:10px;">
                Tháng ${month} · ${year}
            </div>
            <!-- Tên thứ -->
            <div style="display:grid; grid-template-columns:repeat(7,1fr); gap:2px; margin-bottom:4px;">
                ${dayNames.map(d => `<div style="text-align:center; font-size:10px; color:#c7c2bd; padding:2px 0;">${d}</div>`).join('')}
            </div>
            <!-- Các ngày -->
            <div style="display:grid; grid-template-columns:repeat(7,1fr); gap:2px;">
                ${Array(firstDay).fill('<div></div>').join('')}
                ${Array.from({ length: daysInMonth }, (_, i) => {
                    const day = i + 1;
                    const isMarked = markedDays.includes(day);
                    return `<div style="display:flex; align-items:center; justify-content:center; height:32px;">
                        <div style="
                            width:28px; height:28px;
                            display:flex; align-items:center; justify-content:center;
                            border-radius:50%;
                            font-size:11px;
                            ${isMarked
                                ? 'background:#d4a5a5; color:white; font-weight:600; box-shadow:0 2px 6px rgba(212,165,165,0.4);'
                                : 'color:#78716c;'}
                        ">${day}</div>
                    </div>`;
                }).join('')}
            </div>
        </div>
    `;

    container.innerHTML = html;
}

renderMiniCalendar();

// Scroll reveal animations
const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            revealObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.15 });

// Gán class reveal cho từng phần tử
document.querySelectorAll([
    '.invitation-content > *',           // các block chính
    '.w-full.flex.flex-col.gap-8 > *',   // các sub-block
    '.flex.gap-4.items-start',           // thông tin gia đình
    '.flex.flex-col.gap-4.border',       // tiệc mừng
    '.gallery-item',                     // gallery items
].join(',')).forEach((el, i) => {
    // Xen kẽ: chẵn từ trái, lẻ từ phải, còn lại từ dưới
    const mod = i % 3;
    if (mod === 0) el.classList.add('reveal', 'from-bottom');
    else if (mod === 1) el.classList.add('reveal', 'from-left');
    else el.classList.add('reveal', 'from-right');

    revealObserver.observe(el);
});

// Xác nhận tham dự
function confirmAttend(attending) {
    const btnAttend = document.getElementById('btn-attend');
    const btnDecline = document.getElementById('btn-decline');
    const msg = document.getElementById('attend-msg');

    // Dừng idle pulse
    btnAttend.classList.remove('btn-idle', 'btn-selected');
    btnDecline.classList.remove('btn-idle', 'btn-selected');
    btnAttend.style.cssText = '';
    btnDecline.style.cssText = '';

    if (attending) {
        btnAttend.style.background = 'rgba(212,165,165,0.2)';
        btnAttend.style.borderColor = '#d4a5a5';
        btnAttend.classList.add('btn-selected');
        msg.textContent = 'Cảm ơn bạn! Chúng tôi rất mong được gặp bạn 🌸';
    } else {
        btnDecline.style.background = 'rgba(168,162,158,0.1)';
        btnDecline.style.borderColor = '#a8a29e';
        btnDecline.classList.add('btn-selected');
        msg.textContent = 'Cảm ơn bạn đã phản hồi. Chúc bạn nhiều sức khỏe!';
    }

    msg.classList.remove('hidden');
}

// Bắt đầu idle pulse
document.getElementById('btn-attend').classList.add('btn-idle');
document.getElementById('btn-decline').classList.add('btn-idle');

// Cover screen
function openInvitation() {
    const cover = document.getElementById('cover-screen');
    const main = document.getElementById('main-card');

    cover.classList.add('closing');
    setTimeout(() => {
        cover.style.display = 'none';
        main.style.display = '';
        main.style.opacity = '0';
        main.style.transition = 'opacity 0.5s ease';
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                main.style.opacity = '1';
                // Re-init carousel vì lúc load main-card đang display:none
                fixHeight();
                update();
                setTimeout(attachClickHandler, 100);
            });
        });
        window.scrollTo({ top: 0 });
    }, 600);
}

// Fix viewport height cho iOS (tránh bị che bởi browser navbar)
function setVH() {
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
}
setVH();
window.addEventListener('resize', setVH);

// Lightbox
const lightbox = document.getElementById('lightbox');
const lbImg = document.getElementById('lb-img');
const lbCounter = document.getElementById('lb-counter');
let lbIndex = 0;

function openLightbox(index) {
    lbIndex = index;
    lightbox.classList.remove('hidden');
    lightbox.classList.add('flex');
    // Cho phép zoom khi xem ảnh
    document.querySelector('meta[name="viewport"]').setAttribute('content',
        'width=device-width, initial-scale=1.0, viewport-fit=cover');
    lbShow();
}

function closeLightbox() {
    lightbox.classList.add('hidden');
    lightbox.classList.remove('flex');
    // Chặn zoom lại
    document.querySelector('meta[name="viewport"]').setAttribute('content',
        'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover');
    lbScale = 1;
    lbImg.style.transform = 'scale(1)';
}

function lbShow() {
    lbImg.style.opacity = '0';
    setTimeout(() => {
        lbImg.src = `assets/images/${images[lbIndex]}.jpg`;
        lbCounter.textContent = `${lbIndex + 1} / ${images.length}`;
        lbImg.style.opacity = '1';
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
lightbox.addEventListener('touchstart', e => { lbStartX = e.touches[0].clientX; }, { passive: true });
lightbox.addEventListener('touchend', e => {
    const diff = lbStartX - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) diff > 0 ? lbNext() : lbPrev();
});

// Đóng khi click vào nền
lightbox.addEventListener('click', e => {
    if (e.target === lightbox) closeLightbox();
});

// Click vào carousel item
function attachClickHandler() {
    track.querySelectorAll('.carousel-item').forEach((item, i) => {
        // Clone để xóa hết listener cũ
        const clone = item.cloneNode(true);
        item.parentNode.replaceChild(clone, item);
        clone.dataset.index = i;
        clone.addEventListener('click', () => {
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
setTimeout(attachClickHandler, 100);

// Pinch to zoom trong lightbox
let lbScale = 1;
let lbLastDist = 0;
let lbPinching = false;

function getDist(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
}

lbImg.addEventListener('touchstart', e => {
    if (e.touches.length === 2) {
        lbPinching = true;
        lbLastDist = getDist(e.touches);
        e.preventDefault();
    }
}, { passive: false });

lbImg.addEventListener('touchmove', e => {
    if (e.touches.length === 2 && lbPinching) {
        const dist = getDist(e.touches);
        const ratio = dist / lbLastDist;
        lbScale = Math.min(Math.max(lbScale * ratio, 1), 4);
        lbImg.style.transform = `scale(${lbScale})`;
        lbLastDist = dist;
        e.preventDefault();
    }
}, { passive: false });

lbImg.addEventListener('touchend', e => {
    if (e.touches.length < 2) {
        lbPinching = false;
        // Snap về 1 nếu zoom quá nhỏ
        if (lbScale < 1.05) {
            lbScale = 1;
            lbImg.style.transition = 'transform 0.2s ease';
            lbImg.style.transform = 'scale(1)';
            setTimeout(() => lbImg.style.transition = '', 200);
        }
    }
});

// Reset zoom khi chuyển ảnh
const _lbShow = lbShow;
lbShow = function() {
    lbScale = 1;
    lbImg.style.transform = 'scale(1)';
    _lbShow();
};

// Fix iOS Chrome - thêm touchend listener cho nút mở thiệp
document.querySelector('.open-btn').addEventListener('touchend', function(e) {
    e.preventDefault();
    openInvitation();
}, { passive: false });

// Init
window.addEventListener('resize', fixHeight);
fixHeight();
update();
