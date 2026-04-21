# Implementation Plan: Landing Page Template Selection

## Overview

This implementation plan transforms the current basic landing page into a professional, feature-rich template selection experience. The implementation focuses on creating a beautiful hero section, interactive template gallery with modal preview, smooth animations, and clear CTAs. All code will be written in HTML, CSS (TailwindCSS), and vanilla JavaScript.

## Tasks

- [ ] 1. Update HTML structure in index.html
  - [ ] 1.1 Create hero section with gradient background and typography
    - Replace existing hero with new structure including gradient text effect
    - Add tagline with Cormorant font italic styling
    - Add descriptive paragraph and CTA button with scroll functionality
    - _Requirements: FR-1.1.1, FR-1.1.2, FR-1.1.3, FR-1.1.4, FR-1.1.5_

  - [ ] 1.2 Create features grid section
    - Build responsive grid container (1/2/4 columns for mobile/tablet/desktop)
    - Add 4+ feature cards with icon, title, and description
    - Include features: Responsive Design, Thiết kế đẹp mắt, Nhanh chóng, and others
    - _Requirements: FR-1.2.1, FR-1.2.2, FR-1.2.3, FR-1.2.4, FR-1.2.5_

  - [ ] 1.3 Create template gallery section
    - Build responsive grid container (1/2/3 columns for mobile/tablet/desktop)
    - Add template card structure for Classic Elegance (active status)
    - Add 2 coming soon template cards (Modern Minimalist, Royal Elegance)
    - Include thumbnail images, overlay, feature tags, and action buttons
    - _Requirements: FR-1.3.1, FR-1.3.2, FR-1.3.3, FR-1.3.4, FR-1.3.5, FR-1.3.6, FR-1.3.7, FR-1.3.8_

  - [ ] 1.4 Create modal preview structure
    - Build modal container with backdrop and content area
    - Add modal header with template name and feature tags
    - Add modal body with iframe for template preview
    - Add modal footer with close and "Chọn mẫu này" buttons
    - Add close button in top-right corner
    - _Requirements: FR-1.4.1, FR-1.4.2, FR-1.4.3, FR-1.4.4, FR-1.4.8, FR-1.4.9_

  - [ ] 1.5 Create "How It Works" section
    - Build container for 3-step process
    - Add step cards with number badge, icon, title, and description
    - Implement responsive layout (horizontal on desktop, vertical on mobile)
    - _Requirements: FR-1.5.1, FR-1.5.2, FR-1.5.3, FR-1.5.4_

  - [ ] 1.6 Create contact/CTA section
    - Build CTA container with gradient background
    - Add heading and descriptive text
    - Add email and phone CTA buttons with mailto/tel links
    - Display contact information clearly
    - _Requirements: FR-1.6.1, FR-1.6.2, FR-1.6.3, FR-1.6.4, FR-1.6.5, FR-1.6.6_

  - [ ] 1.7 Create footer section
    - Build footer with copyright text
    - Apply white background with border-top
    - Use Cormorant font with italic style
    - _Requirements: FR-1.10.1, FR-1.10.2, FR-1.10.3_

  - [ ] 1.8 Update meta tags and SEO elements
    - Set page title to "Thiệp Cưới Online - Tạo Thiệp Cưới Đẹp & Miễn Phí"
    - Add meta description (150-160 characters)
    - Ensure proper heading hierarchy (h1 → h2 → h3)
    - Add descriptive alt text to all images
    - _Requirements: NFR-2.6.1, NFR-2.6.2, NFR-2.6.3, NFR-2.6.4, NFR-2.6.5_

- [ ] 2. Create CSS styling with TailwindCSS
  - [ ] 2.1 Create landing-styles.css file with custom styles
    - Implement gradient-text class for hero title
    - Create section-title and section-subtitle utility classes
    - Add CTA button styles (primary and secondary variants)
    - _Requirements: UIR-3.1.1, UIR-3.1.2, UIR-3.2.4_

  - [ ] 2.2 Style feature cards with hover effects
    - Implement feature-card class with rounded corners and shadow
    - Add icon-wrapper class with circular background
    - Create hover effect with scale transform and shadow increase
    - _Requirements: FR-1.2.4, UIR-3.4.4_

  - [ ] 2.3 Style template cards with overlay and badges
    - Implement template-card class with rounded corners
    - Create template-thumbnail with aspect ratio 3:4
    - Add template-overlay with opacity transition on hover
    - Style coming-soon-badge for inactive templates
    - Add feature-tag styling for template features
    - _Requirements: FR-1.3.6, UIR-3.6.1, UIR-3.6.2, UIR-3.6.3_

  - [ ] 2.4 Style modal preview components
    - Implement modal backdrop with blur effect
    - Style modal-content with max-width and rounded corners
    - Create modal-close button styling
    - Style preview-iframe with proper dimensions (min-height 600px)
    - Add modal header and footer styling
    - _Requirements: FR-1.4.1, NFR-2.2.3_

  - [ ] 2.5 Style step cards for "How It Works" section
    - Implement step-card class with shadow and hover effects
    - Create step-number badge with gradient background
    - Style step-icon with circular background
    - _Requirements: FR-1.5.2_

  - [ ] 2.6 Implement animation keyframes and transitions
    - Create fadeIn, slideUp, and scaleIn keyframe animations
    - Add animate-in class for scroll animations
    - Implement highlight-pulse animation for contact section
    - Set transition durations (300ms for hover, 600ms for scroll animations)
    - _Requirements: UIR-3.4.1, UIR-3.4.2, UIR-3.4.3, NFR-2.1.5_

  - [ ] 2.7 Configure TailwindCSS theme extensions
    - Extend color palette with cream and rose-pastel colors
    - Add custom font families (Playfair, Cormorant, Inter, Great Vibes)
    - Configure custom animations in Tailwind config
    - _Requirements: UIR-3.1.1, UIR-3.1.2, UIR-3.1.3, UIR-3.1.4, UIR-3.2.1, UIR-3.2.2_

  - [ ] 2.8 Implement responsive design breakpoints
    - Apply responsive grid classes for all sections
    - Ensure proper spacing and padding at all breakpoints
    - Test touch target sizes (minimum 44x44px on mobile)
    - Verify text readability (minimum 16px on mobile)
    - _Requirements: NFR-2.2.1, NFR-2.2.2, NFR-2.2.4, NFR-2.2.5_

- [ ] 3. Implement JavaScript functionality
  - [ ] 3.1 Create landing-script.js and define template data model
    - Define templates array with all required fields (id, name, description, thumbnail, previewUrl, features, status)
    - Add Classic Elegance template with active status
    - Add Modern Minimalist and Royal Elegance with coming-soon status
    - Validate template data structure
    - _Requirements: DR-4.1.1, DR-4.1.2, DR-4.1.3, DR-4.1.4, DR-4.1.5, DR-4.2.1, DR-4.2.2, DR-4.2.3, DR-4.2.4, DR-4.2.5_

  - [ ] 3.2 Implement modal management functions
    - Create openPreview(templateId) function with template validation
    - Implement modal display logic (show modal, load iframe, disable body scroll)
    - Create closePreview() function (hide modal, clear iframe, restore scroll)
    - Add setupModalListeners() for backdrop, close button, and ESC key
    - _Requirements: FR-1.4.1, FR-1.4.2, FR-1.4.3, FR-1.4.4, FR-1.4.5, FR-1.4.6, FR-1.4.7, NFR-2.4.6_

  - [ ]\* 3.3 Write unit tests for modal functions
    - **Property 1: Modal State Consistency**
    - **Validates: Requirements FR-1.4.6, FR-1.4.7**
    - Test openPreview with valid template ID
    - Test openPreview with invalid template ID
    - Test closePreview clears iframe and restores scroll
    - Test ESC key closes modal
    - Test backdrop click closes modal

  - [ ] 3.4 Implement smooth scrolling functions
    - Create scrollToTemplates() function for hero CTA
    - Create scrollToContact(templateId) function with sessionStorage persistence
    - Implement setupSmoothScroll() for all anchor links
    - Add smooth scroll behavior with block: 'start'
    - _Requirements: FR-1.7.1, FR-1.7.2, FR-1.7.3, FR-1.7.4, FR-1.8.1, FR-1.8.2, FR-1.8.3_

  - [ ]\* 3.5 Write unit tests for scroll functions
    - **Property 3: Smooth Scroll Behavior**
    - **Validates: Requirements FR-1.7.1, FR-1.7.2, FR-1.7.3, FR-1.7.4**
    - Test scrollToTemplates scrolls to correct section
    - Test scrollToContact scrolls and stores template ID
    - Test smooth scroll behavior for anchor links

  - [ ] 3.6 Implement scroll animations with IntersectionObserver
    - Create setupScrollAnimations() function
    - Configure IntersectionObserver with threshold 0.1
    - Add animate-in class when elements enter viewport
    - Unobserve elements after animation triggers (performance optimization)
    - _Requirements: FR-1.9.1, FR-1.9.2, FR-1.9.3, FR-1.9.4, FR-1.9.5_

  - [ ] 3.7 Implement template card rendering (if dynamic)
    - Create renderTemplateCards() function
    - Implement createTemplateCard(template) helper function
    - Add proper event handlers for buttons
    - Render active templates with preview and choose buttons
    - Render coming soon templates with badge only
    - _Requirements: FR-1.3.4, FR-1.3.5_

  - [ ]\* 3.8 Write property-based tests for template rendering
    - **Property 2: Template Card Rendering**
    - **Validates: Requirements FR-1.3.4, FR-1.3.5**
    - Test that active templates have preview and choose buttons
    - Test that coming soon templates have badge and no buttons
    - Test correct number of cards rendered

  - [ ] 3.9 Implement error handling
    - Add template validation in openPreview (check existence and status)
    - Implement iframe loading timeout (10 seconds)
    - Create showIframeError() function for loading failures
    - Add safeGetElement() helper for DOM element access
    - _Requirements: EHR-6.1.1, EHR-6.1.2, EHR-6.1.3, EHR-6.2.1, EHR-6.2.2, EHR-6.2.3, EHR-6.3.1, EHR-6.3.2, EHR-6.3.3, FR-1.4.10_

  - [ ] 3.10 Implement browser compatibility checks and fallbacks
    - Create checkBrowserSupport() function
    - Add fallback for IntersectionObserver (show all elements immediately)
    - Add fallback for smooth scroll (instant scroll)
    - Handle sessionStorage unavailability gracefully
    - _Requirements: NFR-2.3.1, NFR-2.3.2, NFR-2.3.3, NFR-2.3.4, EHR-6.4.1, EHR-6.4.2, EHR-6.4.3_

  - [ ] 3.11 Create page initialization function
    - Implement initializePage() function
    - Call renderTemplateCards() if using dynamic rendering
    - Call setupModalListeners()
    - Call setupSmoothScroll()
    - Call setupScrollAnimations()
    - Add DOMContentLoaded event listener
    - _Requirements: Integration of all JavaScript functionality_

- [ ] 4. Checkpoint - Verify core functionality
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Prepare assets and optimize images
  - [ ] 5.1 Optimize existing template thumbnail images
    - Compress ZIN_3506.jpg to appropriate size (max 800x1200px)
    - Ensure image quality is maintained
    - _Requirements: NFR-2.1.2_

  - [ ] 5.2 Create placeholder images for coming soon templates
    - Create or source placeholder image for Modern Minimalist template
    - Create or source placeholder image for Royal Elegance template
    - Optimize placeholder images (compress and resize)
    - Save as template-modern-placeholder.jpg and template-elegant-placeholder.jpg
    - _Requirements: UIR-3.6.4, DR-4.2.5_

  - [ ] 5.3 Implement lazy loading for images
    - Add loading="lazy" attribute to template thumbnail images
    - Ensure images below the fold use lazy loading
    - _Requirements: NFR-2.1.3_

- [ ] 6. Testing and validation
  - [ ]\* 6.1 Perform responsive design testing
    - Test layout at mobile viewport (320px, 375px, 414px)
    - Test layout at tablet viewport (768px, 834px)
    - Test layout at desktop viewport (1024px, 1440px, 1920px)
    - Verify grid columns adjust correctly at each breakpoint
    - Verify modal is responsive and usable on all screen sizes
    - _Requirements: NFR-2.2.1, NFR-2.2.2, NFR-2.2.3_

  - [ ]\* 6.2 Perform cross-browser compatibility testing
    - Test on Chrome 58+ (desktop and mobile)
    - Test on Firefox 55+
    - Test on Safari 11+ (desktop and mobile)
    - Test on Edge 79+
    - Verify all features work or have appropriate fallbacks
    - _Requirements: NFR-2.3.1_

  - [ ]\* 6.3 Perform accessibility testing
    - Verify all images have descriptive alt text
    - Test keyboard navigation for all interactive elements
    - Verify modal traps focus when open
    - Test ESC key closes modal
    - Check color contrast meets WCAG AA standard (4.5:1 minimum)
    - _Requirements: NFR-2.4.1, NFR-2.4.2, NFR-2.4.3, NFR-2.4.4, NFR-2.4.5, NFR-2.4.6_

  - [ ]\* 6.4 Perform performance testing
    - Run Lighthouse audit and aim for 85+ performance score
    - Measure First Contentful Paint (target: < 2 seconds)
    - Measure Largest Contentful Paint (target: < 3 seconds)
    - Verify page loads in < 3 seconds on 3G connection
    - Check JavaScript bundle size (target: < 50KB minified)
    - _Requirements: NFR-2.1.1, NFR-2.1.6, TR-7.4.1, TR-7.4.2, TR-7.4.3, TR-7.4.4_

  - [ ]\* 6.5 Test complete user flows end-to-end
    - Test flow: Browse templates → Preview template → Close modal
    - Test flow: Select template → Scroll to contact → Click email/phone
    - Test flow: Hero CTA → Scroll to templates → Select template
    - Verify sessionStorage persists template selection
    - Test error scenarios (invalid template, iframe timeout)
    - _Requirements: TR-7.2.1, TR-7.2.2, TR-7.2.3_

- [ ] 7. Final integration and polish
  - [ ] 7.1 Verify integration with existing wedding.html
    - Test modal iframe loads /wedding.html?slug=demo correctly
    - Verify wedding template displays properly in iframe
    - Ensure no conflicts with existing routing system
    - _Requirements: IR-5.1.1, IR-5.1.2, IR-5.1.3, IR-5.1.4_

  - [ ] 7.2 Implement security measures
    - Validate template IDs against whitelist before use
    - Add sandbox attribute to iframe if needed
    - Ensure all external resources load via HTTPS
    - Use textContent instead of innerHTML for dynamic text
    - _Requirements: NFR-2.5.1, NFR-2.5.2, NFR-2.5.3, NFR-2.5.4_

  - [ ] 7.3 Optimize for production
    - Minify landing-script.js
    - Minify landing-styles.css
    - Verify all images are compressed
    - Test final bundle sizes
    - _Requirements: DR-8.2.1, DR-8.2.2, DR-8.2.3_

  - [ ] 7.4 Verify backward compatibility
    - Ensure existing wedding.html is not modified
    - Verify routing system still works correctly
    - Check that existing assets are not affected
    - Test existing wedding page links still work
    - _Requirements: DR-8.3.1, DR-8.3.2, DR-8.3.3, DR-8.3.4_

- [ ] 8. Final checkpoint - Complete validation
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional testing tasks and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at key milestones
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific functions and edge cases
- The implementation uses vanilla JavaScript (no frameworks) for simplicity and performance
- TailwindCSS is used via CDN for rapid styling without build process
- All external dependencies (TailwindCSS, Font Awesome, Google Fonts) load from CDN
- Modal iframe only loads when opened (lazy loading for performance)
- IntersectionObserver provides smooth scroll animations with automatic cleanup
- SessionStorage persists template selection within the browser session
