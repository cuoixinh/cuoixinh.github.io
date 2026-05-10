# TEMPLATE 2 - MODERN MINIMALIST CONCEPT

> Phong cách hiện đại, tối giản, thanh lịch với animation mượt mà

---

## 🎨 PHONG CÁCH THIẾT KẾ

### Theme: **Modern Minimalist Wedding**

**Đặc điểm:**

- Tối giản, không gian trống nhiều
- Typography to, rõ ràng
- Animation tinh tế, mượt mà
- Màu sắc nhẹ nhàng, thanh lịch
- Layout dọc, scroll mượt

---

## 🎨 COLOR PALETTE

```css
/* Primary Colors */
--sage-50: #f6f7f6 /* Background chính */ --sage-100: #e8ebe8
  /* Background phụ */ --sage-200: #d1d8d1 /* Border, divider */
  --sage-300: #b4bfb4 /* Text secondary */ --sage-400: #8a9a8a /* Text muted */
  /* Accent Colors */ --gold-100: #f5f0e8 /* Accent light */ --gold-200: #e8dcc8
  /* Accent medium */ --gold-300: #c9b896 /* Accent primary */
  --gold-400: #a89968 /* Accent dark */ /* Neutral */ --charcoal: #2d3436
  /* Text primary */ --white: #ffffff /* Pure white */ --black: #1a1a1a
  /* Pure black */;
```

---

## 📐 LAYOUT STRUCTURE

### 1. Cover Screen (Full Screen)

```
┌─────────────────────────┐
│                         │
│    [Monogram Logo]      │
│                         │
│   Wedding Invitation    │
│                         │
│      [Groom Name]       │
│          &              │
│      [Bride Name]       │
│                         │
│    [Date · Location]    │
│                         │
│    [Open Button]        │
│                         │
└─────────────────────────┘
```

### 2. Main Content (Vertical Scroll)

#### Section 1: Hero

```
┌─────────────────────────┐
│                         │
│   [Large Photo]         │
│   Full width            │
│                         │
│   Save The Date         │
│   [Groom] & [Bride]     │
│   [Date]                │
│                         │
└─────────────────────────┘
```

#### Section 2: Quote

```
┌─────────────────────────┐
│                         │
│   "Love Quote"          │
│   - Author              │
│                         │
└─────────────────────────┘
```

#### Section 3: Couple Info (Side by Side)

```
┌─────────────────────────┐
│  [Groom]    │  [Bride]  │
│  [Photo]    │  [Photo]  │
│  Name       │  Name     │
│  Parents    │  Parents  │
│  Address    │  Address  │
└─────────────────────────┘
```

#### Section 4: Event Timeline

```
┌─────────────────────────┐
│   Our Wedding Day       │
│                         │
│   ○ Ceremony            │
│     10:00 AM            │
│     Location            │
│                         │
│   ○ Reception           │
│     6:00 PM             │
│     Location            │
│                         │
│   [Mini Calendar]       │
│   [RSVP Buttons]        │
└─────────────────────────┘
```

#### Section 5: Gallery (Grid Layout)

```
┌─────────────────────────┐
│  [Photo] [Photo]        │
│  [Photo] [Photo]        │
│  [Photo] [Photo]        │
│                         │
│  View All Photos        │
└─────────────────────────┘
```

#### Section 6: Gift Registry

```
┌─────────────────────────┐
│   Wedding Gift          │
│                         │
│   [Groom QR]            │
│   Bank Info             │
│                         │
│   [Bride QR]            │
│   Bank Info             │
└─────────────────────────┘
```

#### Section 7: Location

```
┌─────────────────────────┐
│   Find Us               │
│                         │
│   [Map Preview]         │
│   Address               │
│   [Get Directions]      │
└─────────────────────────┘
```

#### Section 8: Footer

```
┌─────────────────────────┐
│   Thank You             │
│   [Monogram]            │
│   #GroomBride2024       │
└─────────────────────────┘
```

---

## 🎭 TYPOGRAPHY

### Font Families

```css
/* Headings - Elegant Serif */
font-family: "Cormorant Garamond", serif;
/* Weights: 300, 400, 600 */

/* Body Text - Clean Sans */
font-family: "Inter", sans-serif;
/* Weights: 300, 400, 500, 600 */

/* Accent - Script */
font-family: "Allura", cursive;
/* Weight: 400 */

/* Monogram - Decorative */
font-family: "Cinzel Decorative", cursive;
/* Weight: 400 */
```

### Font Sizes

```css
/* Headings */
h1: 48px / 3rem          /* Main titles */
h2: 36px / 2.25rem       /* Section titles */
h3: 24px / 1.5rem        /* Sub titles */
h4: 18px / 1.125rem      /* Small titles */

/* Body */
body: 16px / 1rem        /* Normal text */
small: 14px / 0.875rem   /* Small text */
tiny: 12px / 0.75rem     /* Tiny text */

/* Display */
display: 72px / 4.5rem   /* Hero text */
```

---

## ✨ ANIMATIONS & INTERACTIONS

### 1. Cover Screen

- Fade in từ trắng
- Monogram scale + rotate nhẹ
- Text fade in từng dòng (stagger)
- Button pulse nhẹ

### 2. Scroll Animations

- Parallax cho hero image
- Fade in + slide up cho sections
- Stagger animation cho gallery grid
- Progress bar khi scroll

### 3. Hover Effects

- Button: scale + shadow
- Photo: zoom + overlay
- Link: underline animation
- Card: lift + shadow

### 4. Transitions

- Smooth scroll giữa sections
- Page transition mượt mà
- Modal fade + scale
- Toast slide from top

---

## 🎯 UNIQUE FEATURES

### 1. Monogram Generator

- Tự động tạo monogram từ chữ cái đầu
- Hiển thị ở cover và footer
- Style: Circle với chữ cái đan xen

### 2. Timeline Vertical

- Event timeline dọc với dots
- Animated line khi scroll vào
- Icon cho từng event

### 3. Gallery Grid

- Masonry layout (Pinterest style)
- Lazy load images
- Lightbox với gesture support

### 4. Countdown Timer

- Đếm ngược đến ngày cưới
- Hiển thị: Days · Hours · Minutes
- Animation flip khi số thay đổi

### 5. RSVP Form

- Inline form thay vì chỉ buttons
- Fields: Name, Guests, Message
- Submit animation

### 6. Hashtag Section

- Hiển thị hashtag cưới
- Copy to clipboard
- Share to social media

### 7. Music Player Custom

- Custom UI thay vì YouTube default
- Progress bar
- Play/Pause/Volume controls

---

## 📱 RESPONSIVE BREAKPOINTS

```css
/* Mobile First */
mobile: 0-639px          /* Default */
tablet: 640px-1023px     /* md: */
desktop: 1024px+         /* lg: */

/* Adjustments */
- Mobile: Single column, full width
- Tablet: 2 columns for couple info
- Desktop: Max width 1200px, centered
```

---

## 🎨 COMPONENT DETAILS

### 1. Monogram Component

```html
<div class="monogram">
  <svg viewBox="0 0 100 100">
    <circle cx="50" cy="50" r="45" />
    <text x="35" y="60" class="letter-left">M</text>
    <text x="50" y="55" class="ampersand">&</text>
    <text x="65" y="60" class="letter-right">H</text>
  </svg>
</div>
```

### 2. Timeline Component

```html
<div class="timeline">
  <div class="timeline-item">
    <div class="timeline-dot"></div>
    <div class="timeline-line"></div>
    <div class="timeline-content">
      <h4>Ceremony</h4>
      <p>10:00 AM</p>
      <p>Church Name</p>
    </div>
  </div>
</div>
```

### 3. Countdown Component

```html
<div class="countdown">
  <div class="countdown-item">
    <div class="countdown-number">45</div>
    <div class="countdown-label">Days</div>
  </div>
  <div class="countdown-separator">:</div>
  <div class="countdown-item">
    <div class="countdown-number">12</div>
    <div class="countdown-label">Hours</div>
  </div>
</div>
```

### 4. Gallery Grid

```html
<div class="gallery-grid">
  <div class="gallery-item tall">
    <img src="..." />
  </div>
  <div class="gallery-item wide">
    <img src="..." />
  </div>
  <div class="gallery-item">
    <img src="..." />
  </div>
</div>
```

---

## 🎵 MUSIC PLAYER CUSTOM

### Features

- Custom UI với progress bar
- Play/Pause button
- Volume slider
- Current time / Duration
- Minimized mode (floating button)

### UI States

```
Minimized: [🎵] floating button
Expanded:  [Progress Bar]
           [⏮ ⏯ ⏭]
           [🔊 Volume]
```

---

## 📋 DATA MAPPING

### Same as Template1

- Sử dụng cùng database structure
- Cùng ID elements (để tương thích)
- Cùng utils functions
- Chỉ khác giao diện và animations

---

## 🎨 DESIGN INSPIRATION

### Style References

- **Minimalist**: Apple product pages
- **Typography**: Medium articles
- **Animations**: Stripe website
- **Layout**: Pinterest masonry
- **Colors**: Sage green + gold (nature + luxury)

### Mood

- Elegant but not stuffy
- Modern but timeless
- Simple but sophisticated
- Calm but joyful

---

## 🚀 IMPLEMENTATION PRIORITY

### Phase 1: Core Structure

1. HTML structure với sections
2. Basic CSS styling
3. Responsive layout
4. Load wedding data

### Phase 2: Animations

1. Cover screen animations
2. Scroll reveal animations
3. Hover effects
4. Transitions

### Phase 3: Interactive Features

1. Countdown timer
2. Timeline animation
3. Gallery grid + lightbox
4. RSVP form

### Phase 4: Polish

1. Monogram generator
2. Custom music player
3. Hashtag section
4. Performance optimization

---

## 📊 COMPARISON: Template1 vs Template2

| Feature        | Template1           | Template2           |
| -------------- | ------------------- | ------------------- |
| **Style**      | Romantic, Vintage   | Modern, Minimalist  |
| **Colors**     | Rose + Cream        | Sage + Gold         |
| **Fonts**      | Playfair + Vibes    | Cormorant + Inter   |
| **Layout**     | Card-based          | Full-width sections |
| **Gallery**    | Carousel            | Grid (Masonry)      |
| **Music**      | YouTube embed       | Custom player       |
| **Timeline**   | Calendar only       | Vertical timeline   |
| **RSVP**       | Buttons only        | Form with fields    |
| **Animations** | Subtle              | More dynamic        |
| **Target**     | Traditional couples | Modern couples      |

---

## ✅ CHECKLIST IMPLEMENTATION

### Design

- [ ] Finalize color palette
- [ ] Choose Google Fonts
- [ ] Create monogram SVG template
- [ ] Design all sections in Figma/Sketch

### Development

- [ ] Create HTML structure
- [ ] Implement CSS with Tailwind
- [ ] Add scroll animations
- [ ] Build countdown timer
- [ ] Build timeline component
- [ ] Build gallery grid
- [ ] Build custom music player
- [ ] Build RSVP form
- [ ] Implement monogram generator
- [ ] Add all required IDs
- [ ] Integrate with BL/DAL layer

### Testing

- [ ] Test preview mode
- [ ] Test with real data
- [ ] Test responsive on all devices
- [ ] Test animations performance
- [ ] Test all interactions
- [ ] Cross-browser testing

---

## 💡 FUTURE ENHANCEMENTS

1. **Guest Book**: Khách để lại lời chúc
2. **Photo Booth**: Upload ảnh chụp tại tiệc
3. **Live Stream**: Embed YouTube live
4. **Gift Tracker**: Track ai đã gửi quà
5. **Seating Chart**: Sơ đồ chỗ ngồi
6. **Menu**: Thực đơn tiệc cưới
7. **Dress Code**: Hướng dẫn trang phục
8. **Accommodation**: Gợi ý khách sạn

---

**Kết luận**: Template2 sẽ mang phong cách hiện đại, tối giản, phù hợp với các cặp đôi trẻ, yêu thích sự đơn giản nhưng tinh tế. Khác biệt rõ rệt với Template1 về mặt thị giác và trải nghiệm người dùng.
