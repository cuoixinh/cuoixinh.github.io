// ============= PERSONALIZED GREETING =============
const ENCRYPTION_KEY = "dqvinh";
const EDGE_URL = "https://lcobawmkywtxhpezndsh.supabase.co/functions/v1/wedding-admin";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxjb2Jhd21reXd0eGhwZXpuZHNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4OTA5ODMsImV4cCI6MjA5MTQ2Njk4M30.4BNmxnfixXdHOq0ovtaF_4wQZ9sap3IWbJNJK9H4Mg4";
const STORAGE_BASE_URL = "https://lcobawmkywtxhpezndsh.supabase.co/storage/v1/object/public/wedding-images";

const _urlParams = new URLSearchParams(window.location.search);
// Đọc slug từ query param hoặc từ sessionStorage (sau khi redirect từ 404.html)
let _weddingSlug = _urlParams.get('slug');

// Nếu có redirect từ 404.html, restore URL gốc
const redirectPath = sessionStorage.getItem('redirect');
const redirectSearch = sessionStorage.getItem('search');
if (redirectPath && !_weddingSlug) {
  // Lấy slug từ path
  _weddingSlug = redirectPath.split('/').filter(p => p).pop();
  // Restore URL gốc bằng History API
  const newUrl = window.location.origin + redirectPath + (redirectSearch || '');
  window.history.replaceState(null, '', newUrl);
  // Clear sessionStorage
  sessionStorage.removeItem('redirect');
  sessionStorage.removeItem('search');
}

const _isGroom = _urlParams.get('isGroom') !== 'false';

// Helper
function setText(id, value, placeholder = '') {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = value || placeholder;
}
function setAttr(id, attr, value, placeholder = '') {
  const el = document.getElementById(id);
  if (!el) return;
  el.setAttribute(attr, value || placeholder);
}
function setImageWithRing(id, filename) {
  const el = document.getElementById(id);
  if (!el) return;
  
  const url = getImageUrl(filename);
  el.setAttribute('src', url);
  
  // Get parent container
  const container = el.parentElement;
  if (!container) return;
  
  // If no image (placeholder), remove ring classes
  if (!filename) {
    container.classList.remove('ring-1', 'ring-white/80');
  } else {
    // Has image, add ring classes if not present
    if (!container.classList.contains('ring-1')) {
      container.classList.add('ring-1', 'ring-white/80');
    }
  }
}
function getImageUrl(filename) {
  if (!filename) {
    // Return a placeholder image with "Chưa có ảnh" text
    return createPlaceholderSVG('Chưa có ảnh');
  }
  if (filename.startsWith('http')) return filename;
  return `${STORAGE_BASE_URL}/${filename}`;
}

// Create simple placeholder SVG - camera icon style
function createPlaceholderSVG(text = 'Chưa có ảnh') {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
      <!-- Background -->
      <rect width="400" height="400" fill="#f5f5f5"/>
      
      <!-- Camera icon (smaller) -->
      <g transform="translate(200, 170)">
        <!-- Camera body -->
        <rect x="-35" y="-20" width="70" height="48" rx="5" fill="#d0d0d0"/>
        <!-- Camera top -->
        <path d="M -16,-20 L -10,-28 L 10,-28 L 16,-20 Z" fill="#d0d0d0"/>
        <!-- Lens outer circle -->
        <circle cx="0" cy="4" r="18" fill="#e0e0e0"/>
        <!-- Lens inner circle -->
        <circle cx="0" cy="4" r="12" fill="#f0f0f0"/>
        <!-- Flash dot -->
        <circle cx="22" cy="-10" r="3" fill="#e0e0e0"/>
      </g>
      
      <!-- Text below icon -->
      <text x="200" y="250" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" fill="#c0c0c0" font-weight="300" letter-spacing="0.5">No Photo Available</text>
    </svg>
  `;
  return 'data:image/svg+xml,' + encodeURIComponent(svg);
}

// ============= RENDER WEDDING DATA =============

function renderWedding(w) {
  if (!w || !w.is_active) return;

  const side = _isGroom ? 'groom' : 'bride';

  // --- COVER ---
  setAttr('cover-bg-img', 'src', getImageUrl(w.cover_image_url));
  setText('cover-groom-name', w.groom_name, '----------');
  setText('cover-bride-name', w.bride_name, '----------');

  // --- SAVE THE DATE ---
  setImageWithRing('main-photo', w.cover_image_url);
  setText('couple-names-groom', w.groom_name, '----------');
  setText('couple-names-bride', w.bride_name, '----------');

  // --- THÔNG TIN GIA ĐÌNH ---
  setText('groom-father', w.groom_father, '--------------------');
  setText('groom-mother', w.groom_mother, '--------------------');
  setText('groom-address', w.groom_address, '----------------------------------------');
  setText('groom-name-label', w.groom_name, '----------');
  setImageWithRing('groom-photo', w.groom_image_url);

  setText('bride-father', w.bride_father, '--------------------');
  setText('bride-mother', w.bride_mother, '--------------------');
  setText('bride-address', w.bride_address, '----------------------------------------');
  setText('bride-name-label', w.bride_name, '----------');
  setImageWithRing('bride-photo', w.bride_image_url);

  // --- LỄ THÀNH HÔN ---
  setText('invite-groom', w.groom_name, '----------');
  setText('invite-bride', w.bride_name, '----------');
  if (w.ceremony_date) {
    const d = new Date(w.ceremony_date);
    const weekdays = ['Chủ Nhật','Thứ Hai','Thứ Ba','Thứ Tư','Thứ Năm','Thứ Sáu','Thứ Bảy'];
    setText('invite-day', d.getDate());
    setText('invite-month-year', `Tháng ${d.getMonth() + 1} · ${d.getFullYear()}`);
    setText('invite-weekday', weekdays[d.getDay()]);
  }
  setText('invite-time', w.ceremony_time, '--:--');
  setText('invite-lunar', w.ceremony_lunar, '--------------------');

  // --- TIỆC CƯỚI (theo phía nhà trai/gái) ---
  const partyDate = w[`${side}_party_date`];
  const partyTime = w[`${side}_party_time`];
  const partyLunar = w[`${side}_party_lunar`];
  const partyLocation = w[`${side}_party_location`];

  if (partyDate && partyTime) {
    const d = new Date(partyDate);
    setText('party-datetime', `${partyTime} - ${d.getDate()}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`);
  } else {
    setText('party-datetime', '--:-- - --.--.----');
  }
  setText('party-lunar', partyLunar ? `(${partyLunar})` : '(----)');
  setText('party-location', partyLocation, '------------------------');

  // --- MINI CALENDAR ---
  const ceremonyDate = w.ceremony_date;
  if (ceremonyDate && partyDate) {
    const d1 = new Date(ceremonyDate);
    const d2 = new Date(partyDate);
    weddingDates[0] = { year: d1.getFullYear(), month: d1.getMonth() + 1, day: d1.getDate() };
    weddingDates[1] = { year: d2.getFullYear(), month: d2.getMonth() + 1, day: d2.getDate() };
    renderMiniCalendar();
  }

  // --- STORY QUOTE ---
  if (w.story_quote) setText('story-quote', `"${w.story_quote}"`);

  // --- GALLERY ---
  if (w.gallery_images && w.gallery_images.length > 0) {
    const urls = w.gallery_images.map(f => getImageUrl(f));
    images.length = 0;
    urls.forEach(url => images.push(url));
    track.innerHTML = '';
    dotsContainer.innerHTML = '';
    for (let i = 0; i < images.length; i++) {
      const item = document.createElement('div');
      item.className = 'carousel-item shrink-0 rounded-2xl overflow-hidden cursor-pointer';
      item.style.cssText = 'transition: width 0.4s cubic-bezier(0.4,0,0.2,1), height 0.4s cubic-bezier(0.4,0,0.2,1), opacity 0.4s cubic-bezier(0.4,0,0.2,1), box-shadow 0.4s ease;';
      item.innerHTML = `<img src="${images[i]}" class="w-full h-full object-cover pointer-events-none" alt="">`;
      item.addEventListener('click', () => { if (i !== current) { current = i; update(); } });
      track.appendChild(item);
      const dot = document.createElement('div');
      dot.style.cssText = 'height:6px; border-radius:9999px; transition: all 0.3s;';
      dotsContainer.appendChild(dot);
    }
    current = Math.floor(images.length / 2);
    fixHeight();
    update();
    setTimeout(attachClickHandler, 100);
  } else {
    // No gallery images - show 3 placeholders
    images.length = 0;
    for (let i = 0; i < 3; i++) {
      images.push(createPlaceholderSVG('Chưa có ảnh'));
    }
    track.innerHTML = '';
    dotsContainer.innerHTML = '';
    for (let i = 0; i < images.length; i++) {
      const item = document.createElement('div');
      item.className = 'carousel-item shrink-0 rounded-2xl overflow-hidden cursor-pointer';
      item.style.cssText = 'transition: width 0.4s cubic-bezier(0.4,0,0.2,1), height 0.4s cubic-bezier(0.4,0,0.2,1), opacity 0.4s cubic-bezier(0.4,0,0.2,1), box-shadow 0.4s ease;';
      item.innerHTML = `<img src="${images[i]}" class="w-full h-full object-cover pointer-events-none" alt="">`;
      track.appendChild(item);
      const dot = document.createElement('div');
      dot.style.cssText = 'height:6px; border-radius:9999px; transition: all 0.3s;';
      dotsContainer.appendChild(dot);
    }
    current = 1; // Middle placeholder
    fixHeight();
    update();
  }

  // --- HỘP MỪNG CƯỚI ---
  setText('groom-bank-label', w.groom_name, '----------');
  setText('groom-bank-name', w.groom_bank_name, '----------------');
  setText('groom-bank-number', w.groom_bank_number, '------------');
  setText('groom-bank-owner', w.groom_bank_owner, '--------------------');
  setAttr('groom-qr-img', 'src', getImageUrl(w.groom_qr_url));

  setText('bride-bank-label', w.bride_name, '----------');
  setText('bride-bank-name', w.bride_bank_name, '----------------');
  setText('bride-bank-number', w.bride_bank_number, '------------');
  setText('bride-bank-owner', w.bride_bank_owner, '--------------------');
  setAttr('bride-qr-img', 'src', getImageUrl(w.bride_qr_url));

  // --- BẢN ĐỒ (theo phía nhà trai/gái) ---
  const mapEmbed = w[`${side}_map_embed_url`];
  const mapLink = w[`${side}_map_link`];
  if (mapEmbed) {
    const iframe = document.getElementById('map-thumbnail-iframe');
    if (iframe) iframe.src = mapEmbed;
  }
  if (mapLink) {
    const link = document.getElementById('map-link');
    if (link) link.href = mapLink;
  }
  // Địa điểm tổ chức = party_location
  setText('map-location-name', partyLocation, '------------------------');
}

// Fetch và render wedding data
if (_weddingSlug) {
  fetch(`${EDGE_URL}?slug=${_weddingSlug}`, {
    headers: { Authorization: `Bearer ${ANON_KEY}` }
  })
  .then(r => r.json())
  .then(renderWedding)
  .catch(e => console.error('Lỗi load wedding data:', e));
}

function decryptData(encryptedText) {
  if (!encryptedText) return '';
  try {
    const decoded = decodeURIComponent(encryptedText);
    const decrypted = CryptoJS.AES.decrypt(decoded, ENCRYPTION_KEY);
    return decrypted.toString(CryptoJS.enc.Utf8);
  } catch (error) {
    console.error('Decryption error:', error);
    return '';
  }
}

// Biến lưu thông tin markViewed để gọi khi click Mở Thiệp
let _markViewedCallback = null;

function setupPersonalizedGreeting() {
  const urlParams = new URLSearchParams(window.location.search);
  const encryptedName = urlParams.get('name');
  const encryptedRelationship = urlParams.get('relationship');
  
  // Lấy slug từ URL hiện tại (đã được restore bởi code trên)
  const weddingSlug = urlParams.get('slug') || window.location.pathname.split('/').filter(p => p).pop();
  const isGroom = urlParams.get('isGroom') !== 'false';

  // Nếu không có tham số cá nhân hóa → vào thẳng màn chính
  if (!encryptedName || !encryptedRelationship) {
    openInvitation();
    return;
  }

  // Có tham số → thử giải mã
  try {
    const name = decryptData(encryptedName);
    const relationship = decryptData(encryptedRelationship);

    // Giải mã không hợp lệ → vào thẳng màn chính
    if (!name || !relationship) {
      openInvitation();
      return;
    }

    // Hợp lệ → hiển thị lời chào trên cover
    const coverGuestName = document.getElementById('cover-guest-name');
    if (coverGuestName) coverGuestName.textContent = name;

  } catch (error) {
    // Lỗi giải mã → vào thẳng màn chính
    openInvitation();
    return;
  }

  // Chuẩn bị markViewed - chỉ gọi khi click Mở Thiệp
  if (weddingSlug) {
    fetch(`${EDGE_URL}?slug=${weddingSlug}`, {
      headers: { Authorization: `Bearer ${ANON_KEY}` }
    }).then(res => res.json()).then(data => {
      const sheetUrl = isGroom ? data.groom_google_sheet_url : data.bride_google_sheet_url;
      if (sheetUrl) {
        _markViewedCallback = () => {
          fetch(sheetUrl, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({ action: 'markViewed', link: window.location.href })
          });
        };
      }
    }).catch(() => {});
  }
}

// Call on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupPersonalizedGreeting);
} else {
  setupPersonalizedGreeting();
}

// ============= CAROUSEL GALLERY =============

const images = [];
const track = document.getElementById('carousel-track');
const dotsContainer = document.getElementById('carousel-dots');
const container = document.getElementById('gallery-carousel');
let current = 0;
let startX = 0;
let isDragging = false;

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
    // Đánh dấu đã xem khi khách click Mở Thiệp
    if (_markViewedCallback) {
        _markViewedCallback();
        _markViewedCallback = null; // Chỉ gọi 1 lần
    }

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
        lbImg.src = images[lbIndex];
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

// Init resize listener for carousel
window.addEventListener('resize', fixHeight);
