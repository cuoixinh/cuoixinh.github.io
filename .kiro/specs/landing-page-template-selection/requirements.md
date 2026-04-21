# Requirements Document: Landing Page với Template Selection

## 1. Functional Requirements

### 1.1 Hero Section

- **FR-1.1.1:** Hệ thống PHẢI hiển thị hero section với tiêu đề "Thiệp Cưới Online" có gradient text effect
- **FR-1.1.2:** Hệ thống PHẢI hiển thị tagline "Tạo kỷ niệm đẹp cho ngày trọng đại" với font chữ italic
- **FR-1.1.3:** Hệ thống PHẢI hiển thị mô tả ngắn về dịch vụ (tối đa 2-3 câu)
- **FR-1.1.4:** Hệ thống PHẢI cung cấp CTA button "Xem Mẫu Thiệp" scroll xuống Template Gallery
- **FR-1.1.5:** Hero section PHẢI có background gradient từ cream-50 qua rose-pastel-100/30 đến cream-100

### 1.2 Features Grid

- **FR-1.2.1:** Hệ thống PHẢI hiển thị grid các tính năng nổi bật với layout responsive
- **FR-1.2.2:** Mỗi feature card PHẢI bao gồm: icon, tiêu đề, và mô tả ngắn
- **FR-1.2.3:** Grid PHẢI hiển thị 1 cột trên mobile, 2 cột trên tablet, 4 cột trên desktop
- **FR-1.2.4:** Feature cards PHẢI có hover effect với scale và shadow
- **FR-1.2.5:** Hệ thống PHẢI hiển thị ít nhất 4 features: Responsive Design, Thiết kế đẹp mắt, Nhanh chóng, và các tính năng khác

### 1.3 Template Gallery

- **FR-1.3.1:** Hệ thống PHẢI hiển thị gallery các mẫu thiệp cưới với layout grid responsive
- **FR-1.3.2:** Grid PHẢI hiển thị 1 cột trên mobile, 2 cột trên tablet, 3 cột trên desktop
- **FR-1.3.3:** Mỗi template card PHẢI hiển thị: thumbnail image, tên template, mô tả, và feature tags
- **FR-1.3.4:** Template cards với status "active" PHẢI có button "Xem Demo" và "Chọn mẫu này"
- **FR-1.3.5:** Template cards với status "coming-soon" PHẢI hiển thị badge "Sắp ra mắt" và KHÔNG có interactive buttons
- **FR-1.3.6:** Thumbnail image PHẢI có overlay hiển thị khi hover với button "Xem Demo"
- **FR-1.3.7:** Feature tags PHẢI hiển thị các tính năng của template (Gallery, Bản đồ, QR Code, RSVP)
- **FR-1.3.8:** Hệ thống PHẢI hiển thị ít nhất 3 templates: 1 active (Classic Elegance) và 2 coming soon

### 1.4 Modal Preview

- **FR-1.4.1:** Khi user click "Xem Demo", hệ thống PHẢI mở modal fullscreen với backdrop
- **FR-1.4.2:** Modal PHẢI hiển thị template preview trong iframe
- **FR-1.4.3:** Iframe PHẢI load URL: `/wedding.html?slug=demo` cho template Classic
- **FR-1.4.4:** Modal PHẢI có close button ở góc trên bên phải
- **FR-1.4.5:** User PHẢI có thể đóng modal bằng: click backdrop, click close button, hoặc nhấn ESC key
- **FR-1.4.6:** Khi modal mở, body scroll PHẢI bị disable
- **FR-1.4.7:** Khi modal đóng, body scroll PHẢI được restore và iframe src PHẢI được clear
- **FR-1.4.8:** Modal PHẢI hiển thị tên template và feature tags ở header
- **FR-1.4.9:** Modal PHẢI có button "Chọn mẫu này" ở footer để scroll đến contact section
- **FR-1.4.10:** Nếu iframe không load được sau 10 giây, hệ thống PHẢI hiển thị error message

### 1.5 How It Works Section

- **FR-1.5.1:** Hệ thống PHẢI hiển thị quy trình sử dụng dịch vụ theo 3 bước
- **FR-1.5.2:** Mỗi step card PHẢI bao gồm: step number badge, icon, tiêu đề, và mô tả
- **FR-1.5.3:** Step cards PHẢI hiển thị theo layout horizontal trên desktop và vertical trên mobile
- **FR-1.5.4:** 3 bước PHẢI là: (1) Chọn mẫu thiệp, (2) Liên hệ tư vấn, (3) Nhận thiệp & Chia sẻ

### 1.6 Contact Section

- **FR-1.6.1:** Hệ thống PHẢI hiển thị CTA section với tiêu đề rõ ràng
- **FR-1.6.2:** Hệ thống PHẢI cung cấp 2 CTA buttons: "Liên hệ qua Email" và "Gọi điện thoại"
- **FR-1.6.3:** Email button PHẢI mở email client với mailto link
- **FR-1.6.4:** Phone button PHẢI mở phone dialer với tel link
- **FR-1.6.5:** Hệ thống PHẢI hiển thị thông tin liên hệ rõ ràng: email address và phone number
- **FR-1.6.6:** Contact section PHẢI là scroll target khi user click "Chọn mẫu này"

### 1.7 Smooth Scrolling

- **FR-1.7.1:** Khi user click "Xem Mẫu Thiệp" từ hero, trang PHẢI scroll smooth đến Template Gallery
- **FR-1.7.2:** Khi user click "Chọn mẫu này", trang PHẢI scroll smooth đến Contact Section
- **FR-1.7.3:** Smooth scroll PHẢI có behavior: 'smooth' và block: 'start'
- **FR-1.7.4:** Tất cả anchor links với href bắt đầu bằng "#" PHẢI trigger smooth scroll

### 1.8 Template Selection Persistence

- **FR-1.8.1:** Khi user click "Chọn mẫu này", template ID PHẢI được lưu vào sessionStorage
- **FR-1.8.2:** SessionStorage key PHẢI là 'selectedTemplate'
- **FR-1.8.3:** Template ID được lưu PHẢI là string (ví dụ: 'classic', 'modern', 'elegant')

### 1.9 Scroll Animations

- **FR-1.9.1:** Feature cards, template cards, và step cards PHẢI có animation khi scroll vào viewport
- **FR-1.9.2:** Animation PHẢI sử dụng IntersectionObserver API
- **FR-1.9.3:** Animation PHẢI trigger khi element có ít nhất 10% visible trong viewport
- **FR-1.9.4:** Sau khi animation trigger, observer PHẢI unobserve element đó (performance optimization)
- **FR-1.9.5:** Animation PHẢI là slide-up effect với duration 0.6s

### 1.10 Footer

- **FR-1.10.1:** Hệ thống PHẢI hiển thị footer với copyright text
- **FR-1.10.2:** Footer PHẢI có background trắng với border-top
- **FR-1.10.3:** Footer text PHẢI sử dụng font Cormorant với style italic

## 2. Non-Functional Requirements

### 2.1 Performance

- **NFR-2.1.1:** Landing page PHẢI load trong vòng 3 giây trên 3G connection
- **NFR-2.1.2:** Template thumbnail images PHẢI được optimize và có kích thước tối đa 800x1200px
- **NFR-2.1.3:** Images below the fold PHẢI sử dụng lazy loading
- **NFR-2.1.4:** Iframe PHẢI chỉ load khi modal được mở (không preload)
- **NFR-2.1.5:** CSS animations PHẢI sử dụng GPU acceleration (transform, opacity)
- **NFR-2.1.6:** JavaScript bundle size PHẢI nhỏ hơn 50KB (minified)

### 2.2 Responsive Design

- **NFR-2.2.1:** Landing page PHẢI responsive hoàn hảo trên viewport từ 320px đến 2560px
- **NFR-2.2.2:** Breakpoints PHẢI tuân theo TailwindCSS defaults: sm (640px), md (768px), lg (1024px), xl (1280px)
- **NFR-2.2.3:** Modal PHẢI responsive và chiếm tối đa 90vh trên mobile
- **NFR-2.2.4:** Touch targets PHẢI có kích thước tối thiểu 44x44px trên mobile
- **NFR-2.2.5:** Text PHẢI readable với font size tối thiểu 16px trên mobile

### 2.3 Browser Compatibility

- **NFR-2.3.1:** Landing page PHẢI hoạt động trên Chrome 58+, Firefox 55+, Safari 11+, Edge 79+
- **NFR-2.3.2:** Nếu browser không support IntersectionObserver, hệ thống PHẢI fallback: hiển thị tất cả elements ngay lập tức
- **NFR-2.3.3:** Nếu browser không support smooth scroll, hệ thống PHẢI fallback: instant scroll
- **NFR-2.3.4:** Nếu browser không support sessionStorage, hệ thống PHẢI tiếp tục hoạt động nhưng không persist template selection

### 2.4 Accessibility

- **NFR-2.4.1:** Tất cả images PHẢI có alt text mô tả
- **NFR-2.4.2:** Buttons và links PHẢI có accessible labels
- **NFR-2.4.3:** Modal PHẢI trap focus khi mở
- **NFR-2.4.4:** Color contrast PHẢI đạt WCAG AA standard (tối thiểu 4.5:1 cho text)
- **NFR-2.4.5:** Keyboard navigation PHẢI hoạt động cho tất cả interactive elements
- **NFR-2.4.6:** ESC key PHẢI đóng modal

### 2.5 Security

- **NFR-2.5.1:** Template IDs PHẢI được validate against whitelist trước khi sử dụng
- **NFR-2.5.2:** Iframe PHẢI có sandbox attribute nếu load external content
- **NFR-2.5.3:** Tất cả external resources PHẢI load qua HTTPS
- **NFR-2.5.4:** Không được sử dụng innerHTML với user input (sử dụng textContent)
- **NFR-2.5.5:** Content Security Policy headers NÊN được implement

### 2.6 SEO

- **NFR-2.6.1:** Page title PHẢI là "Thiệp Cưới Online - Tạo Thiệp Cưới Đẹp & Miễn Phí"
- **NFR-2.6.2:** Meta description PHẢI mô tả rõ ràng về dịch vụ (150-160 characters)
- **NFR-2.6.3:** Heading hierarchy PHẢI đúng (h1 → h2 → h3)
- **NFR-2.6.4:** Images PHẢI có descriptive alt text
- **NFR-2.6.5:** Page PHẢI có semantic HTML structure

### 2.7 Maintainability

- **NFR-2.7.1:** Template data PHẢI được define trong JavaScript array để dễ dàng thêm/sửa templates
- **NFR-2.7.2:** CSS classes PHẢI follow naming convention rõ ràng
- **NFR-2.7.3:** JavaScript functions PHẢI có comments mô tả purpose và parameters
- **NFR-2.7.4:** Code PHẢI được organize theo modules: HTML structure, CSS styles, JavaScript logic

## 3. User Interface Requirements

### 3.1 Typography

- **UIR-3.1.1:** Heading chính PHẢI sử dụng font Playfair Display với font-weight 700
- **UIR-3.1.2:** Tagline và quotes PHẢI sử dụng font Cormorant Garamond với style italic
- **UIR-3.1.3:** Body text PHẢI sử dụng font Inter
- **UIR-3.1.4:** Decorative text PHẢI sử dụng font Great Vibes
- **UIR-3.1.5:** Font sizes PHẢI responsive: mobile (base 16px), desktop (base 18px)

### 3.2 Color Scheme

- **UIR-3.2.1:** Primary colors PHẢI là cream palette: #fffbf7, #fff5f0, #ffe8e0
- **UIR-3.2.2:** Accent colors PHẢI là rose-pastel palette: #f5d5d8, #e8b4b8, #d4a5a5
- **UIR-3.2.3:** Text colors PHẢI là gray-800 cho headings, gray-600 cho body text
- **UIR-3.2.4:** Gradient text PHẢI sử dụng linear-gradient từ #d4a5a5 đến #e8b4b8
- **UIR-3.2.5:** Background PHẢI sử dụng gradient từ cream-50 qua cream-100

### 3.3 Spacing và Layout

- **UIR-3.3.1:** Section padding PHẢI là py-20 (80px vertical)
- **UIR-3.3.2:** Container max-width PHẢI tuân theo TailwindCSS defaults
- **UIR-3.3.3:** Grid gap PHẢI là 8 (32px) cho template và feature grids
- **UIR-3.3.4:** Card padding PHẢI là p-6 hoặc p-8 tùy theo kích thước card
- **UIR-3.3.5:** Button padding PHẢI là px-8 py-4 cho CTA buttons

### 3.4 Animations và Transitions

- **UIR-3.4.1:** Hover transitions PHẢI có duration 300ms
- **UIR-3.4.2:** Scroll animations PHẢI có duration 600ms
- **UIR-3.4.3:** Modal open/close PHẢI có fade animation
- **UIR-3.4.4:** Card hover PHẢI có transform translateY(-8px) và shadow increase
- **UIR-3.4.5:** Button hover PHẢI có transform translateY(-1px) và shadow increase

### 3.5 Icons

- **UIR-3.5.1:** Icons PHẢI sử dụng Font Awesome 6.4.0
- **UIR-3.5.2:** Icon size PHẢI là text-2xl (24px) cho feature icons
- **UIR-3.5.3:** Icon color PHẢI là rose-pastel-300 (#d4a5a5)
- **UIR-3.5.4:** Icons PHẢI có margin-right khi đi kèm với text

### 3.6 Images

- **UIR-3.6.1:** Template thumbnails PHẢI có aspect ratio 3:4 (portrait)
- **UIR-3.6.2:** Images PHẢI có object-fit: cover
- **UIR-3.6.3:** Images PHẢI có rounded corners (rounded-3xl cho cards)
- **UIR-3.6.4:** Placeholder images PHẢI được cung cấp cho coming soon templates

## 4. Data Requirements

### 4.1 Template Data Structure

- **DR-4.1.1:** Mỗi template PHẢI có các fields: id, name, description, thumbnail, previewUrl, features, status
- **DR-4.1.2:** Field 'id' PHẢI là unique string trong kebab-case format
- **DR-4.1.3:** Field 'status' PHẢI là enum: 'active' hoặc 'coming-soon'
- **DR-4.1.4:** Field 'features' PHẢI là array of strings
- **DR-4.1.5:** Field 'previewUrl' PHẢI là valid URL hoặc null (cho coming soon templates)
- **DR-4.1.6:** Template data PHẢI được define trong JavaScript constant array

### 4.2 Initial Template Data

- **DR-4.2.1:** Hệ thống PHẢI có template "Classic Elegance" với status 'active'
- **DR-4.2.2:** Classic template PHẢI có previewUrl: '/wedding.html?slug=demo'
- **DR-4.2.3:** Classic template PHẢI có features: gallery, map, qrcode, rsvp
- **DR-4.2.4:** Classic template PHẢI có thumbnail: 'assets/images/ZIN_3506.jpg'
- **DR-4.2.5:** Hệ thống PHẢI có 2 coming soon templates: "Modern Minimalist" và "Royal Elegance"

### 4.3 SessionStorage Data

- **DR-4.3.1:** Selected template ID PHẢI được lưu với key 'selectedTemplate'
- **DR-4.3.2:** Value PHẢI là string (template ID)
- **DR-4.3.3:** Data PHẢI persist trong session (không expire cho đến khi tab đóng)

## 5. Integration Requirements

### 5.1 Existing System Integration

- **IR-5.1.1:** Landing page PHẢI accessible tại root URL: domain.com/
- **IR-5.1.2:** Wedding template PHẢI accessible tại: domain.com/slug
- **IR-5.1.3:** Modal iframe PHẢI load wedding.html với query param ?slug=demo
- **IR-5.1.4:** Routing system hiện tại KHÔNG được thay đổi

### 5.2 Asset Integration

- **IR-5.2.1:** Landing page PHẢI sử dụng existing images từ assets/images/
- **IR-5.2.2:** Landing page PHẢI sử dụng existing fonts từ assets/fonts/
- **IR-5.2.3:** Landing page PHẢI sử dụng same color scheme như wedding.html

### 5.3 External Dependencies

- **IR-5.3.1:** TailwindCSS PHẢI load từ CDN: https://cdn.tailwindcss.com
- **IR-5.3.2:** Font Awesome PHẢI load từ CDN: cdnjs.cloudflare.com
- **IR-5.3.3:** Google Fonts PHẢI load từ fonts.googleapis.com
- **IR-5.3.4:** Tất cả CDN resources PHẢI có fallback hoặc error handling

## 6. Error Handling Requirements

### 6.1 Template Not Found

- **EHR-6.1.1:** Nếu template ID không tồn tại, hệ thống PHẢI log error và return early
- **EHR-6.1.2:** Nếu template status không phải 'active', hệ thống PHẢI hiển thị notification "Mẫu thiệp này sắp ra mắt"
- **EHR-6.1.3:** Modal KHÔNG được mở nếu template không valid

### 6.2 Iframe Loading Failure

- **EHR-6.2.1:** Nếu iframe không load sau 10 giây, hệ thống PHẢI hiển thị error message
- **EHR-6.2.2:** Error message PHẢI bao gồm: icon, text mô tả, và button để đóng modal
- **EHR-6.2.3:** User PHẢI có option để close modal và thử lại

### 6.3 Missing DOM Elements

- **EHR-6.3.1:** Nếu required DOM element không tồn tại, hệ thống PHẢI log error
- **EHR-6.3.2:** Function PHẢI return early và KHÔNG crash
- **EHR-6.3.3:** User-facing notification NÊN được hiển thị: "Đã xảy ra lỗi. Vui lòng tải lại trang."

### 6.4 Browser Compatibility Issues

- **EHR-6.4.1:** Hệ thống PHẢI check browser support cho IntersectionObserver, smooth scroll, sessionStorage
- **EHR-6.4.2:** Nếu feature không support, hệ thống PHẢI log warning và provide fallback
- **EHR-6.4.3:** Page PHẢI vẫn functional với degraded experience

## 7. Testing Requirements

### 7.1 Unit Testing

- **TR-7.1.1:** Tất cả JavaScript functions PHẢI có unit tests
- **TR-7.1.2:** Test coverage PHẢI đạt tối thiểu 80%
- **TR-7.1.3:** Tests PHẢI cover: happy path, error cases, edge cases
- **TR-7.1.4:** Mock DOM elements PHẢI được sử dụng cho testing

### 7.2 Integration Testing

- **TR-7.2.1:** Complete user flows PHẢI được test end-to-end
- **TR-7.2.2:** Tests PHẢI cover: browse templates, preview template, select template, contact
- **TR-7.2.3:** Modal interactions PHẢI được test: open, close, ESC key, backdrop click
- **TR-7.2.4:** Responsive behavior PHẢI được test ở 3 viewport sizes: mobile, tablet, desktop

### 7.3 Visual Testing

- **TR-7.3.1:** Screenshots PHẢI được capture cho tất cả sections
- **TR-7.3.2:** Visual regression tests NÊN được implement
- **TR-7.3.3:** Cross-browser testing PHẢI được thực hiện trên Chrome, Firefox, Safari

### 7.4 Performance Testing

- **TR-7.4.1:** Page load time PHẢI được measure với Lighthouse
- **TR-7.4.2:** Performance score PHẢI đạt tối thiểu 85/100
- **TR-7.4.3:** First Contentful Paint PHẢI dưới 2 giây
- **TR-7.4.4:** Largest Contentful Paint PHẢI dưới 3 giây

## 8. Deployment Requirements

### 8.1 File Structure

- **DR-8.1.1:** index.html PHẢI được update với new structure
- **DR-8.1.2:** landing-styles.css PHẢI được tạo mới
- **DR-8.1.3:** landing-script.js PHẢI được tạo mới
- **DR-8.1.4:** Placeholder images PHẢI được thêm vào assets/images/

### 8.2 Production Optimization

- **DR-8.2.1:** JavaScript PHẢI được minified
- **DR-8.2.2:** CSS PHẢI được minified
- **DR-8.2.3:** Images PHẢI được compressed
- **DR-8.2.4:** Unused CSS PHẢI được removed (TailwindCSS purge)

### 8.3 Backward Compatibility

- **DR-8.3.1:** Existing wedding.html KHÔNG được modify
- **DR-8.3.2:** Routing system KHÔNG được thay đổi
- **DR-8.3.3:** Existing assets KHÔNG được xóa hoặc rename
- **DR-8.3.4:** Migration PHẢI không break existing wedding page links
